import type { BollingerSetup, FlowConfirmation, TrendRegime } from "./types.ts";

/** Small, user-selected daily universe. This is not a full-market scanner. */
export const BOLLINGER_SCREENER_LIMITS = {
  maxSymbols: 10, cacheEntries: 256, cacheTtlMs: 10 * 60_000,
  recentCalendarDays: 4, requestBudgetMs: 20_000, calculationBars: 500, providerSpacingMs: 1_500,
} as const;
export interface ScreenerSymbol { symbol: string; market: "KR" | "US"; }
export type ScreenerStatus = "recent" | "stale" | "missing" | "warmup" | "error" | "deferred";
export interface BollingerSnapshot extends ScreenerSymbol {
  name: string; timeframe: "day"; asOf: string | null; source: string;
  fetchedAt: string; status: ScreenerStatus; reason: string;
  close: number | null; sma200: number | null;
  bbw: number | null; bbwPercentile: number | null; percentB: number | null; rvol: number | null;
  trend: TrendRegime | null; setup: BollingerSetup | null;
  score: number | null; coverage: number | null; flow: FlowConfirmation;
}
export interface ScreenerFilters {
  lowBandwidth: boolean; aboveSma200: boolean; highRvol: boolean; upperBreakout: boolean;
  trend: "any" | "bullish" | "bearish"; foreignPositive: boolean; trustPositive: boolean; minScore: number;
}
export const DEFAULT_SCREENER_FILTERS: ScreenerFilters = {
  lowBandwidth: false, aboveSma200: false, highRvol: false, upperBreakout: false,
  trend: "any", foreignPositive: false, trustPositive: false, minScore: 0,
};
export function parseScreenerSymbols(raw: string): ScreenerSymbol[] {
  const result: ScreenerSymbol[] = [];
  const seen = new Set<string>();
  for (const token of raw.split(/[\s,;]+/).filter(Boolean)) {
    const clean = token.toUpperCase();
    if (clean.split(":").length > 2) throw new Error("종목 입력의 시장 접두사를 확인하세요.");
    const [prefix, body] = clean.includes(":") ? clean.split(":") : [/^[0-9A-Z]{6}$/.test(clean) && /\d/.test(clean) ? "KR" : "US", clean];
    if (!(prefix === "KR" ? /^[0-9A-Z]{6}$/.test(body ?? "") : prefix === "US" && /^[A-Z][A-Z0-9.-]{0,11}$/.test(body ?? "")))
      throw new Error("종목은 KR:005930 또는 US:NVDA 형식으로 입력하세요.");
    const key = `${prefix}:${body}`;
    if (!seen.has(key)) { seen.add(key); result.push({ market: prefix as "KR" | "US", symbol: body }); }
  }
  if (!result.length || result.length > BOLLINGER_SCREENER_LIMITS.maxSymbols)
    throw new Error(`1~${BOLLINGER_SCREENER_LIMITS.maxSymbols}개 종목을 선택하세요.`);
  return result;
}
/** Daily provider keys are homogeneous exchange dates; later corrections win. */
export function normalizeScreenerBars<T extends { date: string }>(bars: readonly T[]): T[] {
  const unique = new Map<string, T>();
  for (const bar of bars) if (/^\d{4}-\d{2}-\d{2}$/.test(bar.date)) unique.set(bar.date, bar);
  return [...unique.values()].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0).slice(-BOLLINGER_SCREENER_LIMITS.calculationBars); // ked-allow-string-date-sort: single-format time series
}
export function snapshotFreshness(asOf: string | null, now: number): "recent" | "stale" | "missing" {
  if (!asOf || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return "missing";
  const epoch = Date.parse(`${asOf}T00:00:00Z`);
  const age = now - epoch;
  return Number.isFinite(age) && age >= -86_400_000 && age <= BOLLINGER_SCREENER_LIMITS.recentCalendarDays * 86_400_000 ? "recent" : "stale";
}
/** Missing/stale observations are never treated as filter matches or ranked as current. */
export function matchesScreener(snapshot: BollingerSnapshot, filters: ScreenerFilters): boolean {
  if (snapshot.status !== "recent") return false;
  if (filters.lowBandwidth && !(snapshot.bbwPercentile !== null && snapshot.bbwPercentile <= 10)) return false;
  if (filters.aboveSma200 && !(snapshot.close !== null && snapshot.sma200 !== null && snapshot.close > snapshot.sma200)) return false;
  if (filters.highRvol && !(snapshot.rvol !== null && snapshot.rvol >= 1.5)) return false;
  if (filters.upperBreakout && !(snapshot.percentB !== null && snapshot.percentB >= 1)) return false;
  if (filters.trend === "bullish" && !["bullish", "strong-bullish"].includes(snapshot.trend ?? "")) return false;
  if (filters.trend === "bearish" && !["bearish", "strong-bearish"].includes(snapshot.trend ?? "")) return false;
  if (filters.foreignPositive && !(["available", "partial"].includes(snapshot.flow.availability) && snapshot.flow.foreignOwnershipChange !== null && snapshot.flow.foreignOwnershipChange > 0)) return false;
  if (filters.trustPositive && !(["available", "partial"].includes(snapshot.flow.availability) && snapshot.flow.investmentTrustNet !== null && snapshot.flow.investmentTrustNet > 0)) return false;
  if (filters.minScore > 0 && !(snapshot.score !== null && snapshot.score >= filters.minScore)) return false;
  return true;
}
export function rankScreener(rows: readonly BollingerSnapshot[], filters: ScreenerFilters): BollingerSnapshot[] {
  return rows.filter(row => matchesScreener(row, filters)).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || `${a.market}:${a.symbol}`.localeCompare(`${b.market}:${b.symbol}`));
}
/** Bounded ephemeral snapshot cache; not an operational history database. */
export function createBollingerSnapshotCache<T>(limits = { ttlMs: BOLLINGER_SCREENER_LIMITS.cacheTtlMs as number, maxEntries: BOLLINGER_SCREENER_LIMITS.cacheEntries as number }, now: () => number = Date.now) {
  const cache = new Map<string, { value: T; at: number }>();
  const inflight = new Map<string, Promise<T>>();
  return {
    peek(key: string): T | undefined {
      const hit = cache.get(key);
      if (!hit || now() - hit.at >= limits.ttlMs) { cache.delete(key); return undefined; }
      return hit.value;
    },
    async load(key: string, fetcher: () => Promise<T>): Promise<T> {
      const hit = this.peek(key);
      if (hit !== undefined) return hit;
      const shared = inflight.get(key);
      if (shared) return shared;
      const task = Promise.resolve().then(fetcher).then(value => {
        cache.delete(key); cache.set(key, { value, at: now() });
        while (cache.size > limits.maxEntries) cache.delete(cache.keys().next().value!);
        return value;
      }).finally(() => inflight.delete(key));
      inflight.set(key, task); return task;
    },
    size: () => cache.size,
  };
}
