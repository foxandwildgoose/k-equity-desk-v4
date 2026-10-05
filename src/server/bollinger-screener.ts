import { fetchOhlc } from "./naver-market";
import { fetchChartSecurity, fetchUsChartSecurity } from "./chart-security";
import { getKiwoomStore } from "./kiwoom-db";
import { assertKiwoomReadAccess, kiwoomDataScope, readKiwoomConfig } from "./kiwoom-config";
import { UNIVERSE } from "../data/universe";
import { emptyChartFlow } from "../lib/charts/hts-flow";
import { DEFAULT_BOLLINGER_SYSTEM_CONFIG } from "../lib/bollinger/config";
import { analyzeBollinger } from "../lib/bollinger/engine";
import { completedPriceBars } from "../lib/bollinger/bar-completion";
import { bollingerFlowByDate } from "../lib/bollinger/flow-confirmation";
import { BOLLINGER_SCREENER_LIMITS as LIMITS, createBollingerSnapshotCache, normalizeScreenerBars, snapshotFreshness, type BollingerSnapshot, type ScreenerSymbol } from "../lib/bollinger/screener";
import type { ChartSecurity } from "../lib/charts/security";
import type { FlowConfirmation } from "../lib/bollinger/types";

const snapshots = createBollingerSnapshotCache<BollingerSnapshot>();
// One bounded worker per runtime. Serverless replicas do not share this worker/cache.
// This is deliberately a small explicit universe, not a full-market rate limiter.
let busy = false;
let nextProviderAt = 0;
const absentFlow = (market: "KR" | "US", reason = "공표시각이 확인된 저장 수급 미확보"): FlowConfirmation => ({
  availability: market === "US" ? "not-applicable" : "unknown", foreignOwnershipChange: null, investmentTrustNet: null,
  reason: market === "US" ? "국내 수급 정의 적용 대상 아님" : reason,
});
function emptySnapshot(symbol: ScreenerSymbol, status: BollingerSnapshot["status"], reason: string, now: number): BollingerSnapshot {
  return { ...symbol, name: UNIVERSE.find(row => row.code === symbol.symbol && symbol.market === "KR")?.nameKo ?? symbol.symbol,
    timeframe: "day", asOf: null, source: "미확보", fetchedAt: new Date(now).toISOString(), status, reason,
    close: null, sma200: null, bbw: null, bbwPercentile: null, percentB: null, rvol: null, trend: null, setup: null,
    score: null, coverage: null, flow: absentFlow(symbol.market) };
}
/** Existing PostgreSQL store only: never call fetchChartFlow(), collect, broker OAuth or an API here. */
async function storedFlow(security: ChartSecurity, dates: string[], userId: string | null) {
  if (security.market !== "KR" || !dates.length) return {};
  try {
    const config = readKiwoomConfig();
    if (!config.enabled || config.environment !== "real" || !config.databaseConfigured) return {};
    assertKiwoomReadAccess(config, userId);
    const store = await getKiwoomStore();
    if (!(await store.schema()).ready) return {};
    const request = { code: security.code, market: "KR" as const, instrument: security.instrument,
      exchange: security.exchange, currency: "KRW" as const, quantityUnit: security.quantityUnit,
      from: dates[Math.max(0, dates.length - 200)]!, to: dates.at(-1)!, interval: "day" as const, flowScope: "KRX" as const };
    const identity = { scopeId: kiwoomDataScope(config), environment: config.environment, request };
    const flow = emptyChartFlow(request);
    for (const metric of ["foreign", "investmentTrust"] as const) {
      const observations = await store.read(identity, metric);
      flow[metric] = { ...flow[metric], observations, source: "키움증권", capability: observations.length ? "partial" : "unknown" };
    }
    return bollingerFlowByDate(dates, flow, { market: "KR", interval: "day", expectedDailyDates: dates,
      priceMarketScope: security.exchange === "NXT" || security.exchange === "SOR" ? security.exchange : "KRX" });
  } catch {
    // No sensitive provider/DB/session errors become public snapshot messages.
    return {};
  }
}
async function computeSnapshot(symbol: ScreenerSymbol, userId: string | null): Promise<BollingerSnapshot> {
  if (busy) throw new Error("SCREENER_BUSY");
  busy = true;
  try {
    const wait = nextProviderAt - Date.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    const meta = symbol.market === "KR" ? await fetchChartSecurity(symbol.symbol) : await fetchUsChartSecurity(symbol.symbol);
    if (!meta) return emptySnapshot(symbol, "missing", "가격 상품 메타데이터 미확보 · 지원 여부를 추정하지 않습니다", Date.now());
    const result = await fetchOhlc({ code: symbol.symbol, market: symbol.market === "US" ? "US" : meta.exchange === "KOSDAQ" ? "KOSDAQ" : "KOSPI", interval: "day", range: "5y" });
    // Preserve chronological bar keys and real volume validity; no fabricated calendar rows.
    const bars = completedPriceBars(normalizeScreenerBars(result.bars), { market: symbol.market, interval: "day" }).filter(bar => bar.completed);
    if (!bars.length) return { ...emptySnapshot(symbol, "missing", "완료된 실제 일봉 이력 없음", Date.now()), name: meta.name ?? symbol.symbol, source: result.source };
    const dates = bars.map(bar => bar.date);
    const flowByDate = await storedFlow(meta, dates, userId);
    const analysis = analyzeBollinger(bars, { ...DEFAULT_BOLLINGER_SYSTEM_CONFIG }, { market: symbol.market, flowByDate });
    const point = analysis.points.at(-1);
    const asOf = bars.at(-1)!.date;
    const now = Date.now();
    if (!point) return { ...emptySnapshot(symbol, "warmup", "계산 가능한 관측 미확보", now), name: meta.name ?? symbol.symbol, asOf, source: result.source };
    const freshness = snapshotFreshness(asOf, now);
    const status = freshness === "stale" ? "stale" : point.bbwPercentile == null || point.sma200 == null ? "warmup" : "recent";
    return { ...symbol, name: meta.name ?? UNIVERSE.find(row => row.code === symbol.symbol)?.nameKo ?? symbol.symbol, timeframe: "day", asOf,
      source: result.source, fetchedAt: new Date(now).toISOString(), status,
      reason: status === "stale" ? "마지막 완료봉이 4일보다 오래됨 · 최신 순위에서 제외" : status === "warmup" ? "SMA200 또는 BBW 분위수 워밍업 이력 부족 · 최신 순위에서 제외" : "최근 완료 일봉 · 거래소 휴장/공표 확정 시각은 미확인",
      close: bars.at(-1)!.close, sma200: point.sma200, bbw: point.bbw, bbwPercentile: point.bbwPercentile,
      percentB: point.percentB, rvol: point.rvol, trend: point.trend, setup: point.setup,
      score: point.quality.normalizedScore, coverage: point.quality.coverage, flow: point.flow };
  } finally { busy = false; nextProviderAt = Date.now() + LIMITS.providerSpacingMs; }
}
export async function fetchBollingerScreener(symbols: ScreenerSymbol[], userId: string | null = null) {
  const start = Date.now();
  const rows: BollingerSnapshot[] = [];
  let scope = "no-flow";
  try {
    const config = readKiwoomConfig();
    let authorized = false;
    try { assertKiwoomReadAccess(config, userId); authorized = true; } catch { /* Fail closed. */ }
    scope = JSON.stringify([config.environment, kiwoomDataScope(config), config.enabled, config.mode, config.readAuthRequired, authorized, userId]);
  } catch { /* Prices still work when optional flow configuration is invalid. */ }
  for (const symbol of symbols.slice(0, LIMITS.maxSymbols)) {
    if (Date.now() - start >= LIMITS.requestBudgetMs) {
      rows.push(emptySnapshot(symbol, "deferred", "요청 시간 예산 도달 · 종목을 줄여 다시 조회하세요", Date.now()));
      continue;
    }
    try {
      const key = JSON.stringify(["bollinger-snapshot-v1", symbol.market, symbol.symbol, "day", DEFAULT_BOLLINGER_SYSTEM_CONFIG, scope]);
      const row = await snapshots.load(key, () => computeSnapshot(symbol, userId));
      rows.push(row.status === "recent" && snapshotFreshness(row.asOf, Date.now()) === "stale" ? { ...row, status: "stale", reason: "완료봉 이력 오래됨 · 최신 순위에서 제외" } : row);
    } catch (error) {
      rows.push(emptySnapshot(symbol, error instanceof Error && error.message === "SCREENER_BUSY" ? "deferred" : "error",
        error instanceof Error && error.message === "SCREENER_BUSY" ? "다른 조회 진행 중 · 잠시 후 다시 조회하세요" : "가격 조회/분석 실패 · 안전한 재시도 필요", Date.now()));
    }
  }
  return { rows, fetchedAt: new Date().toISOString(), timeframe: "day" as const, scope: "selected-universe" as const,
    cacheTtlSeconds: LIMITS.cacheTtlMs / 1000, note: "최대 10개 선택 종목 · 사용자 요청 시에만 조회 · 동일 서버 10분 캐시 · 운영 이력 저장소가 아님" };
}
