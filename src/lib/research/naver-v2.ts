/**
 * stock.naver.com research v2 (unofficial). Documented by the
 * dd3ok/naverstock-api-skill catalog (47a4274): list response
 * `{ hasNext, totalCount, items[] }`, id `nid`, 0-based `index`, types
 * market|company|industry|invest|economy|debenture, detail `/{type}/{id}`,
 * `detail-page` prev/next, `goal-price-changed` → `researchSets`,
 * `weekly-hot`. Per-item field names beyond `nid`/`title` are NOT documented,
 * so mappers accept several candidates (status: unverified). Pure module.
 */
import { parseSourceTime } from "../feed/time.ts";
import { compareNewestFirst } from "../feed/sort.ts";
import { canonicalizeUrl, stripHtml } from "../feed/text.ts";

export type ResearchV2Type = "market" | "company" | "industry" | "invest" | "economy" | "debenture";
export const RESEARCH_V2_TYPES: ResearchV2Type[] = ["company", "industry", "invest", "economy", "debenture", "market"];

export const V2_LABEL: Record<ResearchV2Type, string> = {
  company: "기업",
  industry: "산업",
  invest: "시황/전략",
  economy: "경제",
  debenture: "채권",
  market: "데일리",
};

/** finance.naver.com read pages (existing app pattern; nid shared with v2). */
const PC_READ: Record<ResearchV2Type, string> = {
  company: "company_read.naver",
  industry: "industry_read.naver",
  invest: "invest_read.naver",
  economy: "economy_read.naver",
  debenture: "debenture_read.naver",
  market: "market_info_read.naver",
};

export function researchPageUrl(type: ResearchV2Type, nid: number): string {
  return `https://finance.naver.com/research/${PC_READ[type]}?nid=${nid}`;
}

/** Map a v2 type onto the legacy `ResearchCategory` used by older consumers. */
export function legacyCategory(type: ResearchV2Type): "company" | "industry" | "market" | "economy" {
  if (type === "company" || type === "industry" || type === "economy") return type;
  if (type === "debenture") return "economy";
  return "market";
}

type Row = Record<string, unknown>;
const isObj = (v: unknown): v is Row => v != null && typeof v === "object" && !Array.isArray(v);

function pick(row: Row, keys: string[]): unknown {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v !== "") return v;
  }
  return undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    return v.replace(/[^\d]/g, "").length && Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export interface ResearchV2Row {
  nid: number;
  type: ResearchV2Type;
  title: string;
  broker: string;
  /** Raw source date (parse with parseSourceTime). */
  date: string;
  publishedAt: string | null;
  precision: "second" | "minute" | "day" | "unknown";
  itemCode?: string;
  itemName?: string;
  preview?: string;
  rating?: string;
  targetPrice?: number;
  pdfUrl?: string;
  readCount?: number;
  industry?: string;
  pageUrl: string;
}

const RATING_MAP: [RegExp, string][] = [
  [/strong\s*buy|적극\s*매수/i, "적극매수"],
  [/^buy$|매수|outperform|overweight|비중\s*확대/i, "매수"],
  [/hold|neutral|중립|marketperform|보유/i, "중립"],
  [/sell|매도|underperform|underweight|비중\s*축소/i, "매도"],
  [/not\s*rated|nr|의견\s*없음/i, "Not Rated"],
];

export function normalizeRatingText(raw: unknown): string | undefined {
  const s = stripHtml(raw);
  if (!s) return undefined;
  for (const [re, label] of RATING_MAP) if (re.test(s)) return label;
  return s.length <= 12 ? s : undefined;
}

export function mapV2ResearchRow(row: unknown, type: ResearchV2Type): ResearchV2Row | null {
  if (!isObj(row)) return null;
  const item = isObj(row.item) ? row.item : isObj(row.stock) ? row.stock : null;
  const nid = num(pick(row, ["nid", "researchId", "id"]));
  const title = stripHtml(pick(row, ["title", "researchTitle", "subject"]));
  if (!nid || !title) return null;
  const date = String(pick(row, ["writeDate", "publishDate", "registeredAt", "createdAt", "date", "writeDateTime", "researchDate"]) ?? "").trim();
  const t = parseSourceTime(date, { zone: "Asia/Seoul" });
  const itemCode = String(pick(row, ["itemCode", "stockCode", "code"]) ?? (item ? pick(item, ["itemCode", "code"]) : "") ?? "")
    .trim()
    .toUpperCase();
  const pdf = canonicalizeUrl(pick(row, ["attachUrl", "pdfUrl", "attachFileUrl", "fileUrl", "attachmentUrl"]));
  return {
    nid,
    type,
    title,
    broker: stripHtml(pick(row, ["brokerName", "broker", "securitiesCompanyName", "officeName", "brokerageName"])) || "증권사 미상",
    date,
    publishedAt: t.iso,
    precision: t.precision,
    itemCode: /^[0-9A-Z]{6}$/.test(itemCode) ? itemCode : undefined,
    itemName: stripHtml(pick(row, ["itemName", "stockName", "name"]) ?? (item ? pick(item, ["itemName", "name"]) : "")) || undefined,
    preview: stripHtml(pick(row, ["previewContent", "summary", "preview", "content", "researchSummary"])) || undefined,
    rating: normalizeRatingText(pick(row, ["opinion", "investmentOpinion", "rating", "recommend", "recommendation"])),
    targetPrice: num(pick(row, ["goalPrice", "targetPrice", "targetStockPrice", "priceTarget"])),
    pdfUrl: pdf && /\.pdf($|\?)/i.test(pdf) ? pdf : undefined,
    readCount: num(pick(row, ["readCount", "viewCount", "hit"])),
    industry: stripHtml(pick(row, ["industryName", "industry", "industryType", "upjongName"])) || undefined,
    pageUrl: researchPageUrl(type, nid),
  };
}

export interface ResearchV2Page {
  items: ResearchV2Row[];
  totalCount: number | null;
  hasNext: boolean;
}

/** `{ hasNext, totalCount, items[] }` → rows sorted newest first (nid desc tie-break). */
export function parseV2List(payload: unknown, type: ResearchV2Type): ResearchV2Page {
  const p = isObj(payload) ? payload : {};
  const raw = Array.isArray(p.items) ? p.items : Array.isArray(payload) ? payload : [];
  const items = raw.map((r) => mapV2ResearchRow(r, type)).filter((x): x is ResearchV2Row => x != null);
  const totalCount = num(p.totalCount) ?? null;
  return { items: sortV2NewestFirst(items), totalCount, hasNext: Boolean(p.hasNext) };
}

export function sortV2NewestFirst<T extends Pick<ResearchV2Row, "nid" | "publishedAt" | "precision" | "type">>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) =>
    compareNewestFirst(
      { id: `${a.type}:${a.nid}`, publishedAt: a.publishedAt, precision: a.precision, seq: a.nid, sourceTier: 3 },
      { id: `${b.type}:${b.nid}`, publishedAt: b.publishedAt, precision: b.precision, seq: b.nid, sourceTier: 3 },
    ),
  );
}

export interface ResearchV2Detail {
  row: ResearchV2Row | null;
  /** HTML-stripped detail text (never republished in full; used for extractive bullets). */
  text: string;
  prev: ResearchV2Row | null;
  next: ResearchV2Row | null;
}

/** Detail (`/{type}/{id}`) and detail-page (`researchContent` + `researchSummaries.prev/next`). */
export function parseV2Detail(payload: unknown, type: ResearchV2Type): ResearchV2Detail {
  const p = isObj(payload) ? payload : {};
  const content = isObj(p.researchContent) ? p.researchContent : isObj(p.research) ? p.research : p;
  const row = mapV2ResearchRow(content, type);
  const text = stripHtml(pick(content, ["content", "researchContent", "body", "detail", "previewContent"]) ?? "");
  const sums = isObj(p.researchSummaries) ? p.researchSummaries : {};
  return {
    row,
    text,
    prev: mapV2ResearchRow(sums.prev, type),
    next: mapV2ResearchRow(sums.next, type),
  };
}

export interface GoalPriceMove {
  nid: number | null;
  itemCode?: string;
  itemName?: string;
  broker: string;
  targetPrice: number | null;
  prevTargetPrice: number | null;
  /** Δ% only when BOTH values come from the source (AT-17). */
  deltaPct: number | null;
  rating?: string;
  publishedAt: string | null;
  precision: ResearchV2Row["precision"];
  direction: "up" | "down";
  pageUrl: string | null;
}

/**
 * `goal-price-changed` → rows. Accepts either flat sets (current + previous
 * price fields) or nested lists of the broker's two latest reports.
 */
export function parseGoalPriceSets(payload: unknown, direction: "up" | "down"): GoalPriceMove[] {
  const p = isObj(payload) ? payload : {};
  const sets = Array.isArray(p.researchSets) ? p.researchSets : Array.isArray(payload) ? payload : [];
  const out: GoalPriceMove[] = [];
  for (const set of sets) {
    if (!isObj(set)) continue;
    const nested = pick(set, ["researches", "items", "reports", "researchList"]);
    let cur: Row = set;
    let prevPrice = num(pick(set, ["beforeGoalPrice", "previousGoalPrice", "preGoalPrice", "prevGoalPrice", "lastGoalPrice", "beforeTargetPrice"]));
    if (Array.isArray(nested) && nested.length && isObj(nested[0])) {
      cur = { ...set, ...(nested[0] as Row) };
      const older = nested[1];
      if (prevPrice == null && isObj(older)) {
        const sameBroker = String(pick(older, ["brokerName", "broker"]) ?? "") === String(pick(cur, ["brokerName", "broker"]) ?? "");
        if (sameBroker) prevPrice = num(pick(older, ["goalPrice", "targetPrice"]));
      }
    }
    const row = mapV2ResearchRow({ title: "목표주가 변경", ...cur }, "company");
    const target = num(pick(cur, ["goalPrice", "targetPrice", "afterGoalPrice", "currentGoalPrice"])) ?? null;
    const prev = prevPrice ?? null;
    const t = parseSourceTime(pick(cur, ["writeDate", "publishDate", "date", "registeredAt"]), { zone: "Asia/Seoul" });
    const itemCode = String(pick(cur, ["itemCode", "stockCode", "code"]) ?? "").toUpperCase();
    out.push({
      nid: row?.nid ?? null,
      itemCode: /^[0-9A-Z]{6}$/.test(itemCode) ? itemCode : undefined,
      itemName: stripHtml(pick(cur, ["itemName", "stockName", "name"])) || undefined,
      broker: stripHtml(pick(cur, ["brokerName", "broker"])) || "증권사 미상",
      targetPrice: target,
      prevTargetPrice: prev,
      deltaPct: target != null && prev != null && prev > 0 ? Math.round(((target - prev) / prev) * 1000) / 10 : null,
      rating: normalizeRatingText(pick(cur, ["opinion", "investmentOpinion", "rating"])),
      publishedAt: t.iso,
      precision: t.precision,
      direction,
      pageUrl: row?.nid ? researchPageUrl("company", row.nid) : null,
    });
  }
  return out.sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0));
}

/** Heuristic "신규 커버리지" flag from the title (labeled as heuristic in the UI). */
export function isNewCoverage(title: string): boolean {
  return /신규\s*(커버리지|편입|분석)|커버리지\s*개시|첫\s*리포트|Initiat(e|ion|ing)|Initiate coverage|분석\s*개시/i.test(title);
}

export interface PrevTargetAnnotated {
  broker: string;
  targetPrice?: number;
  rating?: string;
  prevTargetPrice?: number;
  prevRating?: string;
}

/**
 * Δ% rule (F2.5): a report gets `prevTargetPrice`/`prevRating` only from an
 * OLDER report by the SAME broker on the SAME ticker that was actually fetched.
 * `list` must be newest first.
 */
export function annotatePrevTargets<T extends PrevTargetAnnotated & { code?: string; itemCode?: string }>(list: readonly T[]): T[] {
  return list.map((r, i) => {
    const code = r.code ?? r.itemCode;
    if (!code || r.targetPrice == null || r.targetPrice <= 0) return r;
    const prev = list.slice(i + 1).find((o) => (o.code ?? o.itemCode) === code && o.broker === r.broker && o.targetPrice != null && o.targetPrice > 0);
    return prev ? { ...r, prevTargetPrice: prev.targetPrice, prevRating: prev.rating } : r;
  });
}

export function targetDeltaPct(r: Pick<PrevTargetAnnotated, "targetPrice" | "prevTargetPrice">): number | null {
  if (r.targetPrice == null || r.prevTargetPrice == null || r.prevTargetPrice <= 0) return null;
  return Math.round(((r.targetPrice - r.prevTargetPrice) / r.prevTargetPrice) * 1000) / 10;
}
