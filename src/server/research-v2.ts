/**
 * KR research adapter (F2.1): stock.naver.com research v2 first, legacy
 * m.stock.naver.com/api/research/* as fallback. The serving path is recorded
 * in source health (`v2` / `legacy`). Server-only.
 */
import { fetchJsonWithPolicy } from "@/server/feeds/http";
import { recordResult, setHealthNote } from "@/server/feeds/health";
import {
  legacyCategory,
  parseGoalPriceSets,
  parseV2Detail,
  parseV2List,
  researchPageUrl,
  sortV2NewestFirst,
  V2_LABEL,
  type GoalPriceMove,
  type ResearchV2Detail,
  type ResearchV2Row,
  type ResearchV2Type,
} from "@/lib/research/naver-v2";
import { buildResearchExecutiveSummary } from "@/lib/research-utils";
import { classifyResearchSectors } from "@/data/research-taxonomy";
import { kstToday } from "@/lib/feed/time";
import type { ResearchReport } from "@/server/naver-market";

const BASE = "https://stock.naver.com/api/stockSecurity/researches/v2";

export interface ResearchListQuery {
  type: ResearchV2Type;
  index?: number;
  size?: number;
  itemCodes?: string[];
  industryTypes?: string[];
  startDate?: string;
  endDate?: string;
  bypassCache?: boolean;
}

export interface ResearchListResult {
  type: ResearchV2Type;
  index: number;
  reports: ResearchReport[];
  totalCount: number | null;
  hasNext: boolean;
  path: "v2" | "legacy" | "none";
  error: string | null;
  fetchedAt: string;
}

/** v2 row → the existing ResearchReport shape (kept for current consumers). */
export function v2ToReport(r: ResearchV2Row): ResearchReport {
  const blob = `${r.title} ${r.preview ?? ""} ${r.industry ?? ""}`;
  return {
    researchId: r.nid,
    code: r.itemCode,
    nameKo: r.itemName,
    title: r.title,
    broker: r.broker,
    date: r.date,
    preview: r.preview ?? "",
    rating: r.rating,
    targetPrice: r.targetPrice,
    category: legacyCategory(r.type),
    categoryLabel: V2_LABEL[r.type],
    pdfUrl: r.pdfUrl,
    pageUrl: r.pageUrl,
    readCount: r.readCount,
    summary: buildResearchExecutiveSummary(r.preview ?? "", r.title),
    sectorIds: classifyResearchSectors(blob),
    tags: r.industry ? [r.industry] : [],
    hasInvestmentView: Boolean(r.rating || r.targetPrice),
    sourceKind: "naver",
    sourceLabel: "네이버 리서치 v2",
    v2Type: r.type,
    summarySource: r.preview ? "preview" : "none",
  };
}

function listUrl(q: ResearchListQuery): string {
  const params = new URLSearchParams({ index: String(q.index ?? 0), size: String(q.size ?? 20) });
  for (const c of q.itemCodes ?? []) params.append("itemCodes", c);
  for (const t of q.industryTypes ?? []) params.append("industryTypes", t);
  if (q.startDate) params.set("startDate", q.startDate);
  if (q.endDate) params.set("endDate", q.endDate);
  return `${BASE}/${q.type}?${params}`;
}

const LEGACY_PATH: Partial<Record<ResearchV2Type, string>> = {
  company: "company",
  industry: "industry",
  invest: "invest",
  economy: "economy",
  market: "market",
};

async function legacyList(q: ResearchListQuery): Promise<ResearchReport[]> {
  const { fetchResearchList, fetchCategoryResearch } = await import("@/server/naver-market");
  if (q.type === "company" && q.itemCodes?.length === 1) return fetchResearchList(q.itemCodes[0]!);
  const path = LEGACY_PATH[q.type];
  if (!path || q.type === "company") return [];
  const cat = q.type === "invest" || q.type === "market" ? "market" : (q.type as "industry" | "economy");
  const list = await fetchCategoryResearch(cat, 40);
  return list.map((r) => ({ ...r, v2Type: q.type, categoryLabel: V2_LABEL[q.type], sourceLabel: "네이버 리서치 (레거시)" }));
}

/** One category page: v2 first, legacy fallback (page 0 only; no totalCount). */
export async function fetchResearchV2List(q: ResearchListQuery): Promise<ResearchListResult> {
  const fetchedAt = new Date().toISOString();
  const index = q.index ?? 0;
  try {
    const json = await fetchJsonWithPolicy<unknown>(listUrl(q), { sourceId: "naver-research-v2", bypassCache: q.bypassCache, ttlMs: 180_000 });
    const page = parseV2List(json, q.type);
    recordResult("naver-research-v2", { count: page.items.length, newestPublishedAt: page.items[0]?.publishedAt ?? null, adapterPath: "v2" });
    if (Array.isArray((json as { items?: unknown[] })?.items) && (json as { items: unknown[] }).items.length && !page.items.length) {
      setHealthNote("naver-research-v2", "shape", "v2 응답 필드 매핑 실패 — 재검증 필요");
    }
    return { type: q.type, index, reports: page.items.map(v2ToReport), totalCount: page.totalCount, hasNext: page.hasNext, path: "v2", error: null, fetchedAt };
  } catch (v2err) {
    if (index > 0) {
      return { type: q.type, index, reports: [], totalCount: null, hasNext: false, path: "none", error: v2err instanceof Error ? v2err.message : "v2 error", fetchedAt };
    }
    try {
      const reports = await legacyList(q);
      recordResult("naver-research-legacy", { count: reports.length, adapterPath: "legacy" });
      setHealthNote("naver-research-v2", "fallback", reports.length ? "v2 실패 → 레거시 경로로 제공" : null);
      return { type: q.type, index, reports, totalCount: null, hasNext: false, path: reports.length ? "legacy" : "none", error: reports.length ? null : (v2err instanceof Error ? v2err.message : "v2 error"), fetchedAt };
    } catch (legacyErr) {
      return { type: q.type, index, reports: [], totalCount: null, hasNext: false, path: "none", error: legacyErr instanceof Error ? legacyErr.message : "legacy error", fetchedAt };
    }
  }
}

/** Company reports for many tickers (≤ 10 itemCodes per call — F6.7). */
export async function fetchCompanyResearchFor(codes: string[], size = 30): Promise<ResearchListResult[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < codes.length; i += 10) chunks.push(codes.slice(i, i + 10));
  return Promise.all(chunks.map((c) => fetchResearchV2List({ type: "company", itemCodes: c, size })));
}

export interface ResearchDetailResult {
  report: ResearchReport | null;
  bulletsText: string;
  prev: ResearchReport | null;
  next: ResearchReport | null;
  pdfUrl: string | null;
  pageUrl: string;
  summarySource: "detail" | "preview" | "none";
  path: "v2" | "legacy" | "none";
  error: string | null;
}

const detailCache = new Map<string, { at: number; data: ResearchDetailResult }>();
const DETAIL_TTL_MS = 10 * 60_000;

/** Detail + prev/next for the same ticker (F2.7). Never calls `/view`. */
export async function fetchResearchV2Detail(type: ResearchV2Type, nid: number, itemCode?: string): Promise<ResearchDetailResult> {
  const key = `${type}:${nid}:${itemCode ?? ""}`;
  const hit = detailCache.get(key);
  if (hit && Date.now() - hit.at < DETAIL_TTL_MS) return hit.data;
  const pageUrl = researchPageUrl(type, nid);
  let data: ResearchDetailResult;
  try {
    const detail: ResearchV2Detail = parseV2Detail(await fetchJsonWithPolicy<unknown>(`${BASE}/${type}/${nid}`, { sourceId: "naver-research-v2", ttlMs: DETAIL_TTL_MS }), type);
    let prev: ResearchV2Row | null = null;
    let next: ResearchV2Row | null = null;
    if (itemCode && /^[0-9A-Z]{6}$/.test(itemCode)) {
      try {
        const dp = parseV2Detail(
          await fetchJsonWithPolicy<unknown>(`${BASE}/${type}/${nid}/detail-page?itemCode=${itemCode}&size=1`, { sourceId: "naver-research-v2", ttlMs: DETAIL_TTL_MS }),
          type,
        );
        prev = dp.prev;
        next = dp.next;
      } catch {
        /* optional */
      }
    }
    const report = detail.row ? v2ToReport(detail.row) : null;
    data = {
      report,
      bulletsText: detail.text || report?.preview || "",
      prev: prev ? v2ToReport(prev) : null,
      next: next ? v2ToReport(next) : null,
      pdfUrl: detail.row?.pdfUrl ?? null,
      pageUrl,
      summarySource: detail.text ? "detail" : report?.preview ? "preview" : "none",
      path: "v2",
      error: null,
    };
  } catch (err) {
    // Legacy deep detail (mobile API + PC page) as fallback.
    try {
      const { fetchResearchPdf } = await import("@/server/naver-market");
      const deep = await fetchResearchPdf(nid, legacyCategory(type));
      data = {
        report: null,
        bulletsText: deep.previewExtra ?? "",
        prev: null,
        next: null,
        pdfUrl: deep.pdfUrl ?? null,
        pageUrl: deep.pageUrl || pageUrl,
        summarySource: deep.previewExtra ? "detail" : "none",
        path: "legacy",
        error: null,
      };
    } catch {
      data = { report: null, bulletsText: "", prev: null, next: null, pdfUrl: null, pageUrl, summarySource: "none", path: "none", error: err instanceof Error ? err.message : "detail error" };
    }
  }
  detailCache.set(key, { at: Date.now(), data });
  if (detailCache.size > 300) detailCache.delete(detailCache.keys().next().value!);
  return data;
}

/** F2.6 pre-resolve: PDF URL for a row (10-min server cache via the detail cache). */
export async function resolveResearchOriginal(type: ResearchV2Type, nid: number): Promise<{ pdfUrl: string | null; pageUrl: string }> {
  const d = await fetchResearchV2Detail(type, nid);
  return { pdfUrl: d.pdfUrl, pageUrl: d.pageUrl };
}

export interface ResearchBriefing {
  todayCounts: { type: ResearchV2Type; label: string; count: number | null }[];
  up: GoalPriceMove[];
  down: GoalPriceMove[];
  weeklyHot: ResearchReport[];
  newCoverage: ResearchReport[];
  /** F10.3 dashboard: 3 newest reports across categories (today's first; else the latest listing pages). */
  latest: ResearchReport[];
  errors: string[];
  fetchedAt: string;
}

let briefingCache: { at: number; data: ResearchBriefing } | null = null;

/** F2.4 strip: today's count per category, TP up/down TOP, weekly-hot, new coverage (heuristic). */
export async function fetchResearchBriefing(): Promise<ResearchBriefing> {
  if (briefingCache && Date.now() - briefingCache.at < 10 * 60_000) return briefingCache.data;
  const today = kstToday();
  const weekAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  const errors: string[] = [];
  const types = ["company", "industry", "invest", "economy", "debenture", "market"] as ResearchV2Type[];
  const counts = await Promise.all(
    types.map(async (type) => {
      try {
        const json = await fetchJsonWithPolicy<unknown>(listUrl({ type, index: 0, size: 20, startDate: today, endDate: today }), { sourceId: "naver-research-v2", ttlMs: 600_000 });
        const page = parseV2List(json, type);
        return { type, label: V2_LABEL[type], count: page.totalCount ?? page.items.length, items: page.items };
      } catch (err) {
        errors.push(`${V2_LABEL[type]}: ${err instanceof Error ? err.message : "error"}`);
        return { type, label: V2_LABEL[type], count: null, items: [] as ResearchV2Row[] };
      }
    }),
  );
  const goal = async (direction: "up" | "down") => {
    try {
      return parseGoalPriceSets(await fetchJsonWithPolicy<unknown>(`${BASE}/company/goal-price-changed?direction=${direction}&size=10`, { sourceId: "naver-research-goal" }), direction);
    } catch (err) {
      errors.push(`목표가 ${direction === "up" ? "상향" : "하향"}: ${err instanceof Error ? err.message : "error"}`);
      return [];
    }
  };
  const [up, down, weekly] = await Promise.all([
    goal("up"),
    goal("down"),
    (async () => {
      try {
        const json = await fetchJsonWithPolicy<unknown>(`${BASE}/weekly-hot?startDate=${weekAgo}&size=10`, { sourceId: "naver-research-weekly" });
        return parseV2List(json, "company").items.map(v2ToReport);
      } catch (err) {
        errors.push(`주간 인기: ${err instanceof Error ? err.message : "error"}`);
        return [];
      }
    })(),
  ]);
  const { isNewCoverage } = await import("@/lib/research/naver-v2");
  const companyToday = counts.find((c) => c.type === "company")?.items ?? [];
  let latestRows = sortV2NewestFirst(counts.flatMap((c) => c.items)).slice(0, 3);
  if (latestRows.length < 3) {
    // Weekend/holiday: same first-page URLs as the research desk's 전체 tab (shared fetch cache).
    const pages = await Promise.all(
      types.map(async (type) => {
        try {
          return parseV2List(await fetchJsonWithPolicy<unknown>(listUrl({ type, index: 0, size: 20 }), { sourceId: "naver-research-v2", ttlMs: 180_000 }), type).items;
        } catch {
          return [] as ResearchV2Row[];
        }
      }),
    );
    latestRows = sortV2NewestFirst(pages.flat()).slice(0, 3);
  }
  const data: ResearchBriefing = {
    todayCounts: counts.map(({ type, label, count }) => ({ type, label, count })),
    up: up.slice(0, 5),
    down: down.slice(0, 5),
    weeklyHot: weekly.slice(0, 5),
    newCoverage: sortV2NewestFirst(companyToday.filter((r) => isNewCoverage(r.title))).slice(0, 5).map(v2ToReport),
    latest: latestRows.map(v2ToReport),
    errors,
    fetchedAt: new Date().toISOString(),
  };
  briefingCache = { at: Date.now(), data };
  return data;
}
