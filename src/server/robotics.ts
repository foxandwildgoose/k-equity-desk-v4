/**
 * Robotics section server layer (F6.1 / F6.5–F6.7).
 *
 * - Universe: KR seed codes verified via Naver quotes, KR candidates/exposure
 *   names resolved by EXACT name via the security search, US seed verified via
 *   the Yahoo chart endpoint. Anything unresolved is hidden and listed in
 *   Source Health (`robotics-universe`). Nothing is guessed.
 * - ETF: KR by name regex over the live ETF list; US seed verified via Yahoo.
 * - Research: v2 industry (robot keywords), v2 company for robot tickers
 *   (≤ 10 itemCodes per call), US Street notes for robot symbols.
 */
import {
  ROBOT_ETF_NAME_RE,
  ROBOTICS_KR,
  ROBOTICS_US,
  ROBOTICS_US_ETFS,
  type RoboticsEntry,
  type RoboticsExposure,
} from "@/data/robotics";
import { fetchNews, fetchRealtimeQuotes, type ResearchReport } from "@/server/naver-market";
import { searchListedSecurities } from "@/server/security-search";
import { fetchJsonWithPolicy } from "@/server/feeds/http";
import { recordFailure, recordResult, setHealthNote } from "@/server/feeds/health";
import { yahooChartSnapshot } from "@/lib/feed/parsers/generic";
import { parseSourceTime } from "@/lib/feed/time";
import { newsItemToFeed, sortReportsNewestFirst } from "@/lib/feed/mappers";
import { sortNewestFirst } from "@/lib/feed/sort";
import { discoverRobotEtfs, pickExactListing, position52w, roboticsKey } from "@/lib/robotics/classify";
import { issuerOfEtfName } from "@/lib/etf-news";
import { isRoboticsText } from "@/data/research-taxonomy";
import type { FeedItem } from "@/lib/feed/types";

export interface RoboticsQuoteRow {
  key: string;
  market: "KR" | "US";
  code: string;
  name: string;
  nameEn: string | null;
  segment: string | null;
  exposure: RoboticsExposure | null;
  kind: RoboticsEntry["kind"] | "custom";
  price: number | null;
  changePct: number | null;
  /** 0–100 inside the 52-week range; null when the source gave no range. */
  pos52w: number | null;
  /** KR: 억원 from the quote; US: null (not in the Yahoo chart response). */
  marketCap: number | null;
  volume: number | null;
  currency: "KRW" | "USD";
  asOf: string | null;
  source: string;
  delay: string;
}

export interface RoboticsUnresolved {
  market: "KR" | "US";
  name: string;
  code?: string;
  reason: string;
}

export interface RoboticsUniverse {
  kr: RoboticsQuoteRow[];
  us: RoboticsQuoteRow[];
  unresolved: RoboticsUnresolved[];
  fetchedAt: string;
}

export interface CustomName {
  code: string;
  name: string;
  segment?: string;
  exposure?: RoboticsExposure;
}

async function mapLimit<T, R>(list: readonly T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (i < list.length) {
      const idx = i++;
      out[idx] = await fn(list[idx]!);
    }
  });
  await Promise.all(workers);
  return out;
}

// ── KR name resolution (exact name only; cached) ─────────────────────────
const nameCache = new Map<string, { at: number; code: string | null; reason?: string }>();
const NAME_OK_TTL = 12 * 3_600_000;
const NAME_MISS_TTL = 30 * 60_000;

async function resolveKrName(name: string): Promise<{ code: string | null; reason?: string }> {
  const hit = nameCache.get(name);
  const now = Date.now();
  if (hit && now - hit.at < (hit.code ? NAME_OK_TTL : NAME_MISS_TTL)) return hit;
  try {
    const hits = await searchListedSecurities(name);
    const pick = pickExactListing(name, hits);
    const row = { at: now, code: pick?.code ?? null, reason: pick ? undefined : "종목 검색에서 정확히 같은 이름이 없음" };
    nameCache.set(name, row);
    return row;
  } catch (err) {
    return { code: null, reason: `종목 검색 실패: ${err instanceof Error ? err.message.slice(0, 60) : "error"}` };
  }
}

// ── US quotes via Yahoo chart meta ───────────────────────────────────────
const US_SYMBOL_RE = /^[A-Z][A-Z0-9.]{0,9}$/;

interface UsSnap {
  price: number | null;
  changePct: number | null;
  high52: number | null;
  low52: number | null;
  volume: number | null;
  name: string | null;
  asOf: string | null;
  delay: number | null;
}

async function yahooSnap(symbol: string): Promise<UsSnap | null> {
  if (!US_SYMBOL_RE.test(symbol)) return null;
  try {
    const json = await fetchJsonWithPolicy<unknown>(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`,
      { sourceId: "yahoo-chart", ttlMs: 60_000 },
    );
    const s = yahooChartSnapshot(json);
    if (!s || s.price == null) return null;
    return { price: s.price, changePct: s.changePct, high52: s.high52, low52: s.low52, volume: s.volume, name: s.name, asOf: s.asOf, delay: s.delayMinutes };
  } catch {
    return null;
  }
}

const universeCache = new Map<string, { at: number; data: RoboticsUniverse }>();
const UNIVERSE_TTL = 60_000;

function krRowFrom(e: { code: string; name: string; nameEn?: string | null; segment?: string | null; exposure?: RoboticsExposure | null; kind: RoboticsQuoteRow["kind"] }, q: Awaited<ReturnType<typeof fetchRealtimeQuotes>>[number]): RoboticsQuoteRow {
  return {
    key: roboticsKey("KR", e.code),
    market: "KR",
    code: e.code,
    name: e.name,
    nameEn: e.nameEn ?? null,
    segment: e.segment ?? null,
    exposure: e.exposure ?? null,
    kind: e.kind,
    price: q.price > 0 ? q.price : null,
    changePct: Number.isFinite(q.changePct) ? q.changePct : null,
    pos52w: position52w(q.price, q.low52 || null, q.high52 || null),
    marketCap: q.marketCap > 0 ? q.marketCap : null,
    volume: q.volume > 0 ? q.volume : null,
    currency: "KRW",
    asOf: null,
    source: "네이버 시세",
    delay: "약 30초 캐시",
  };
}

/** Resolve + quote the robotics universe (base config ∪ user additions). */
export async function resolveRoboticsUniverse(opts: { addedKr?: CustomName[]; addedUs?: CustomName[]; force?: boolean } = {}): Promise<RoboticsUniverse> {
  const key = JSON.stringify([opts.addedKr ?? [], opts.addedUs ?? []]);
  const now = Date.now();
  const cached = universeCache.get(key);
  if (!opts.force && cached && now - cached.at < UNIVERSE_TTL) return cached.data;
  const unresolved: RoboticsUnresolved[] = [];

  // KR: seeds keep their spec codes; candidates/exposure resolve by exact name.
  const krEntries: { code: string; name: string; nameEn?: string | null; segment?: string | null; exposure?: RoboticsExposure | null; kind: RoboticsQuoteRow["kind"] }[] = [];
  for (const e of ROBOTICS_KR.filter((x) => x.kind === "seed")) krEntries.push({ code: e.code!, name: e.name, nameEn: e.nameEn, segment: e.segment, exposure: e.exposure, kind: e.kind });
  const byName = ROBOTICS_KR.filter((x) => x.kind === "candidate" || x.kind === "exposure");
  const resolved = await mapLimit(byName, 3, async (e) => ({ e, r: await resolveKrName(e.name) }));
  for (const { e, r } of resolved) {
    if (r.code) krEntries.push({ code: r.code, name: e.name, nameEn: e.nameEn, segment: e.segment, exposure: e.exposure, kind: e.kind });
    else unresolved.push({ market: "KR", name: e.name, reason: r.reason ?? "이름으로 종목을 찾지 못함" });
  }
  for (const c of opts.addedKr ?? []) {
    if (!/^[0-9][0-9A-Z]{5}$/.test(c.code)) continue;
    if (krEntries.some((x) => x.code === c.code)) continue;
    krEntries.push({ code: c.code, name: c.name, segment: c.segment ?? null, exposure: c.exposure ?? null, kind: "custom" });
  }
  let krQuotes: Awaited<ReturnType<typeof fetchRealtimeQuotes>> = [];
  let krError: string | null = null;
  try {
    krQuotes = await fetchRealtimeQuotes(krEntries.map((e) => e.code));
  } catch (err) {
    krError = err instanceof Error ? err.message.slice(0, 80) : "error";
  }
  const qByCode = new Map(krQuotes.map((q) => [q.code, q]));
  const kr: RoboticsQuoteRow[] = [];
  for (const e of krEntries) {
    const q = qByCode.get(e.code);
    if (!q || !(q.price > 0)) {
      unresolved.push({ market: "KR", name: e.name, code: e.code, reason: krError ? `시세 조회 실패 (${krError})` : "시세 응답에 없음 — 코드 확인 불가" });
      continue;
    }
    kr.push(krRowFrom(e, q));
  }

  // US: seeds + user additions, verified through Yahoo.
  const usEntries: { code: string; name: string; segment: string | null; exposure: RoboticsExposure | null; kind: RoboticsQuoteRow["kind"] }[] = ROBOTICS_US.map((e) => ({
    code: e.code!,
    name: e.name,
    segment: e.segment,
    exposure: e.exposure,
    kind: e.kind,
  }));
  for (const c of opts.addedUs ?? []) {
    const code = c.code.toUpperCase();
    if (!US_SYMBOL_RE.test(code) || usEntries.some((x) => x.code === code)) continue;
    usEntries.push({ code, name: c.name || code, segment: c.segment ?? null, exposure: c.exposure ?? null, kind: "custom" });
  }
  const snaps = await mapLimit(usEntries, 4, async (e) => ({ e, s: await yahooSnap(e.code) }));
  const us: RoboticsQuoteRow[] = [];
  for (const { e, s } of snaps) {
    if (!s) {
      unresolved.push({ market: "US", name: e.name, code: e.code, reason: "Yahoo 차트 응답 없음 — 심볼 확인 불가" });
      continue;
    }
    us.push({
      key: roboticsKey("US", e.code),
      market: "US",
      code: e.code,
      name: e.name,
      nameEn: s.name,
      segment: e.segment,
      exposure: e.exposure,
      kind: e.kind,
      price: s.price,
      changePct: s.changePct,
      pos52w: position52w(s.price, s.low52, s.high52),
      marketCap: null,
      volume: s.volume,
      currency: "USD",
      asOf: s.asOf,
      source: "Yahoo Finance",
      delay: s.delay ? `지연 ${s.delay}분` : "지연 시세",
    });
  }

  const data: RoboticsUniverse = { kr, us, unresolved, fetchedAt: new Date().toISOString() };
  if (kr.length + us.length > 0) {
    recordResult("robotics-universe", { count: kr.length + us.length, adapterPath: "json" });
    universeCache.set(key, { at: now, data });
    if (universeCache.size > 20) universeCache.delete(universeCache.keys().next().value!);
  } else {
    recordFailure("robotics-universe", "유니버스 종목을 하나도 확인하지 못함 (시세·검색 소스 응답 없음)");
  }
  setHealthNote(
    "robotics-universe",
    "unresolved",
    unresolved.length ? `미확인 ${unresolved.length}건(화면에서 숨김): ${unresolved.map((u) => (u.code ? `${u.name}(${u.code})` : u.name)).join(", ")}` : null,
  );
  return data;
}

// ── ETF (F6.6) ───────────────────────────────────────────────────────────
export interface RoboticsEtfRow {
  market: "KR" | "US";
  code: string;
  name: string;
  price: number | null;
  changePct: number | null;
  volume: number | null;
  /** KR: 억원 (시가총액); US: null */
  marketSum: number | null;
  issuer: string | null;
  source: string;
  delay: string;
}

export async function fetchRoboticsEtfs(): Promise<{ kr: RoboticsEtfRow[]; us: RoboticsEtfRow[]; unresolved: string[]; krError: string | null; fetchedAt: string }> {
  let krError: string | null = null;
  let kr: RoboticsEtfRow[] = [];
  try {
    const { fetchAllEtfs } = await import("@/server/etf-market");
    const list = await fetchAllEtfs();
    kr = discoverRobotEtfs(list, ROBOT_ETF_NAME_RE)
      .sort((a, b) => b.marketSum - a.marketSum)
      .map((e) => ({
        market: "KR" as const,
        code: e.code,
        name: e.nameKo,
        price: e.price > 0 ? e.price : null,
        changePct: Number.isFinite(e.changePct) ? e.changePct : null,
        volume: e.volume > 0 ? e.volume : null,
        marketSum: e.marketSum > 0 ? e.marketSum : null,
        issuer: e.issuer ?? issuerOfEtfName(e.nameKo),
        source: "네이버 ETF 목록",
        delay: "약 60초 캐시",
      }));
  } catch (err) {
    krError = err instanceof Error ? err.message.slice(0, 80) : "error";
  }
  const snaps = await mapLimit(ROBOTICS_US_ETFS, 3, async (s) => ({ s, q: await yahooSnap(s) }));
  const us: RoboticsEtfRow[] = [];
  const unresolved: string[] = [];
  for (const { s, q } of snaps) {
    if (!q) {
      unresolved.push(s);
      continue;
    }
    us.push({ market: "US", code: s, name: q.name ?? s, price: q.price, changePct: q.changePct, volume: q.volume, marketSum: null, issuer: null, source: "Yahoo Finance", delay: q.delay ? `지연 ${q.delay}분` : "지연 시세" });
  }
  setHealthNote("robotics-universe", "us-etf", unresolved.length ? `미확인 미국 로봇 ETF(숨김): ${unresolved.join(", ")}` : null);
  return { kr, us, unresolved, krError, fetchedAt: new Date().toISOString() };
}

// ── Research (F6.7) ─────────────────────────────────────────────────────
export async function fetchRoboticsResearch(krCodes: string[]): Promise<{
  industry: ResearchReport[];
  company: ResearchReport[];
  paths: string[];
  errors: string[];
  fetchedAt: string;
}> {
  const { fetchCompanyResearchFor, fetchResearchV2List } = await import("@/server/research-v2");
  const codes = [...new Set(krCodes.filter((c) => /^[0-9][0-9A-Z]{5}$/.test(c)))].slice(0, 30);
  const [industryPages, companyPages] = await Promise.all([
    Promise.all([0, 1].map((index) => fetchResearchV2List({ type: "industry", index, size: 40 }))),
    codes.length ? fetchCompanyResearchFor(codes, 30) : Promise.resolve([]),
  ]);
  const text = (r: ResearchReport) => `${r.title} ${r.preview ?? ""} ${r.summary ?? ""} ${r.tags.join(" ")}`;
  const industry = sortReportsNewestFirst(industryPages.flatMap((p) => p.reports).filter((r) => isRoboticsText(text(r))));
  const company = sortReportsNewestFirst(companyPages.flatMap((p) => p.reports));
  const all = [...industryPages, ...companyPages];
  return {
    industry,
    company,
    paths: [...new Set(all.map((p) => p.path))],
    errors: all.map((p) => p.error).filter((e): e is string => Boolean(e)),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchRoboticsStreet(symbols: string[]) {
  const { fetchUsStreetPack } = await import("@/lib/us-street");
  const list = [...new Set(symbols.map((s) => s.toUpperCase()).filter((s) => US_SYMBOL_RE.test(s)))].slice(0, 24);
  const chunks: string[][] = [];
  for (let i = 0; i < list.length; i += 12) chunks.push(list.slice(i, i + 12));
  const packs = await Promise.all(chunks.map((c) => fetchUsStreetPack(c).catch(() => null)));
  const ok = packs.filter((p): p is NonNullable<typeof p> => p != null);
  return {
    notes: ok.flatMap((p) => p.notes),
    headlines: ok.flatMap((p) => p.headlines),
    note: ok[0]?.note ?? "월가 공개 피드를 받지 못했습니다.",
    fetchedAt: new Date().toISOString(),
  };
}

// ── Companies: latest news time + latest research date (F6.5) ───────────
const krNewsLatest = new Map<string, { at: number; iso: string | null }>();
const KR_NEWS_TTL = 15 * 60_000;

async function latestKrNewsAt(code: string): Promise<string | null> {
  const hit = krNewsLatest.get(code);
  if (hit && Date.now() - hit.at < KR_NEWS_TTL) return hit.iso;
  try {
    const items = await fetchNews(code, 1);
    let best: number | null = null;
    for (const n of items) {
      const t = parseSourceTime(n.datetime, { zone: "Asia/Seoul" });
      const ms = t.iso ? Date.parse(t.iso) : NaN;
      if (Number.isFinite(ms) && (best == null || ms > best)) best = ms;
    }
    const iso = best != null ? new Date(best).toISOString() : null;
    krNewsLatest.set(code, { at: Date.now(), iso });
    return iso;
  } catch {
    return null;
  }
}

export async function fetchRoboticsCompanyMeta(krCodes: string[], usSymbols: string[]): Promise<{
  latestNews: Record<string, string | null>;
  latestResearch: Record<string, string | null>;
  fetchedAt: string;
}> {
  const codes = [...new Set(krCodes.filter((c) => /^[0-9][0-9A-Z]{5}$/.test(c)))].slice(0, 40);
  const [newsTimes, research, street] = await Promise.all([
    mapLimit(codes, 3, async (c) => [c, await latestKrNewsAt(c)] as const),
    fetchRoboticsResearch(codes).catch(() => null),
    fetchRoboticsStreet(usSymbols).catch(() => null),
  ]);
  const latestNews: Record<string, string | null> = {};
  const latestResearch: Record<string, string | null> = {};
  for (const [c, iso] of newsTimes) latestNews[roboticsKey("KR", c)] = iso;
  for (const r of research?.company ?? []) {
    if (!r.code) continue;
    const k = roboticsKey("KR", r.code);
    if (latestResearch[k]) continue; // newest first
    latestResearch[k] = parseSourceTime(r.date, { zone: "Asia/Seoul" }).iso;
  }
  const maxIso = (a: string | null | undefined, b: string | null) => (!a ? b : !b ? a : Date.parse(b) > Date.parse(a) ? b : a);
  for (const h of street?.headlines ?? []) {
    const k = roboticsKey("US", h.symbol);
    latestNews[k] = maxIso(latestNews[k], h.publishedAt);
  }
  for (const n of street?.notes ?? []) {
    const k = roboticsKey("US", n.symbol);
    latestResearch[k] = maxIso(latestResearch[k], n.publishedAt);
  }
  return { latestNews, latestResearch, fetchedAt: new Date().toISOString() };
}

// ── Company news drawer ───────────────────────────────────────────────────
export async function fetchRoboticsCompanyNews(market: "KR" | "US", code: string, name: string): Promise<{ items: FeedItem[]; source: string; error: string | null; fetchedAt: string }> {
  const fetchedAt = new Date().toISOString();
  try {
    if (market === "KR") {
      const rows = await fetchNews(code, 1);
      const items = rows
        .map((n) => newsItemToFeed(n, { sourceId: "naver-stock-news", sourceName: "네이버 종목 뉴스", tier: 3, fetchedAt }, { tickers: [{ market: "KR", code }] }))
        .filter((x): x is FeedItem => x != null);
      return { items: sortNewestFirst(items), source: "네이버 종목 뉴스", error: null, fetchedAt };
    }
    const { runGoogleNews } = await import("@/server/feeds/adapters/news");
    const out = await runGoogleNews("gn-robotics-en", [{ q: `"${name.replace(/"/g, "")}" when:30d`, locale: "en" }], {});
    const items = out.items.map((it) => (it.tickers.some((t) => t.code === code) ? it : { ...it, tickers: [...it.tickers, { market: "US" as const, code }] }));
    return { items: sortNewestFirst(items), source: "Google News (EN)", error: null, fetchedAt };
  } catch (err) {
    return { items: [], source: market === "KR" ? "네이버 종목 뉴스" : "Google News (EN)", error: err instanceof Error ? err.message.slice(0, 120) : "error", fetchedAt };
  }
}
