import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchRealtimeQuotes, fetchDatedNaverMarketListing } from "@/server/naver-market";
import { UNIVERSE } from "@/data/universe";
import {
  capQuoteFromProvider,
  observedCapRanking,
  type ExportCapQuote,
} from "@/lib/export-desk/cap-ranking";
import type { ExportProviderStatus } from "@/lib/export-desk/provider-status";
import {
  koreaMonth,
  parseNaverMonthly,
  parseNaverSpotUsdKrw,
  parseYahooMonthly,
  previousCompletedMonth,
  type MacroPoint,
} from "./export-macro-parse";

export type { MacroPoint } from "./export-macro-parse";

const REQUEST_TIMEOUT_MS = 5_000;
const RESPONSE_LIMIT_BYTES = 2_000_000;
const SUCCESS_CACHE_MS = 5 * 60_000;
const FAILURE_CACHE_MS = 30_000;
const NAVER_SPOT_FX_URL = "https://api.stock.naver.com/marketindex/exchange/FX_USDKRW";

/** Safe reason codes only: upstream error bodies and request URLs are not public diagnostics. */
class MacroRequestError extends Error {
  readonly reasonCode: string;
  constructor(reasonCode: string) {
    super("시장 데이터 제공처 응답을 확인할 수 없습니다.");
    this.reasonCode = reasonCode;
  }
}

/** The deadline covers headers AND the complete, size-limited body. */
async function macroResponseText(url: string): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new MacroRequestError("TIMEOUT"));
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 KoreaExportDesk/1.0",
            Accept: "application/json, application/xml, text/xml, */*",
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          void response.body?.cancel().catch(() => undefined);
          throw new MacroRequestError(
            response.status === 429 ? "RATE_LIMITED" : `HTTP_${response.status}`,
          );
        }
        if (!response.body) throw new MacroRequestError("EMPTY_BODY");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let size = 0;
        let text = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > RESPONSE_LIMIT_BYTES) throw new MacroRequestError("RESPONSE_TOO_LARGE");
            text += decoder.decode(value, { stream: true });
          }
          return text + decoder.decode();
        } finally {
          void reader.cancel().catch(() => undefined);
        }
      })(),
      timeout,
    ]);
  } catch (error) {
    if (error instanceof MacroRequestError) throw error;
    throw new MacroRequestError(controller.signal.aborted ? "TIMEOUT" : "PROVIDER_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}

function naverMonthlyUrl(symbol: string): string {
  return `https://fchart.stock.naver.com/sise.nhn?symbol=${encodeURIComponent(symbol)}&timeframe=month&count=180&requestType=0`;
}

function yahooMonthlyUrl(symbol: string): string {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=10y`;
}

async function macroJson(url: string): Promise<unknown> {
  const text = await macroResponseText(url);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new MacroRequestError("INVALID_PAYLOAD");
  }
}

type MonthlyResult = {
  points: MacroPoint[];
  source: string;
  sourceUrl: string;
  checkedAt: string;
  reasonCode?: string;
};
const monthlyCache = new Map<string, { expiresAt: number; data: MonthlyResult }>();
const monthlyFlights = new Map<string, Promise<MonthlyResult>>();

async function cachedMonthly(
  key: string,
  now: Date,
  load: () => Promise<MonthlyResult>,
): Promise<MonthlyResult> {
  const cached = monthlyCache.get(key);
  if (cached && cached.expiresAt > now.getTime()) return cached.data;
  const inFlight = monthlyFlights.get(key);
  if (inFlight) return inFlight;
  const promise = load()
    .then((data) => {
      if (monthlyCache.size >= 256) monthlyCache.delete(monthlyCache.keys().next().value!);
      const fresh = data.points.at(-1)?.date.slice(0, 7) === previousCompletedMonth(now);
      monthlyCache.set(key, {
        data,
        expiresAt: Date.now() + (fresh ? SUCCESS_CACHE_MS : FAILURE_CACHE_MS),
      });
      return data;
    })
    .finally(() => monthlyFlights.delete(key));
  monthlyFlights.set(key, promise);
  return promise;
}

async function loadNaverMonthly(symbol: string, now: Date): Promise<MonthlyResult> {
  const sourceUrl = naverMonthlyUrl(symbol);
  const source = `Naver fchart ${symbol} monthly`;
  const checkedAt = new Date().toISOString();
  try {
    const points = parseNaverMonthly(await macroResponseText(sourceUrl), symbol, now);
    return {
      points,
      source,
      sourceUrl,
      checkedAt,
      ...(!points.length ? { reasonCode: "NO_VERIFIED_COMPLETED_MONTHS" } : {}),
    };
  } catch (error) {
    return {
      points: [],
      source,
      sourceUrl,
      checkedAt,
      reasonCode: error instanceof MacroRequestError ? error.reasonCode : "PROVIDER_UNAVAILABLE",
    };
  }
}

function naverMonthly(symbol: string, now: Date): Promise<MonthlyResult> {
  return cachedMonthly(`naver:${koreaMonth(now)}:${symbol}`, now, () =>
    loadNaverMonthly(symbol, now),
  );
}

async function loadYahooMonthly(symbol: string, now: Date): Promise<MonthlyResult> {
  const sourceUrl = yahooMonthlyUrl(symbol);
  const source = `Yahoo Finance ${symbol} monthly`;
  const checkedAt = new Date().toISOString();
  try {
    const points = parseYahooMonthly(await macroJson(sourceUrl), symbol, now);
    return {
      points,
      source,
      sourceUrl,
      checkedAt,
      ...(!points.length ? { reasonCode: "NO_VERIFIED_COMPLETED_MONTHS" } : {}),
    };
  } catch (error) {
    return {
      points: [],
      source,
      sourceUrl,
      checkedAt,
      reasonCode: error instanceof MacroRequestError ? error.reasonCode : "PROVIDER_UNAVAILABLE",
    };
  }
}

function yahooMonthly(symbol: string, now: Date): Promise<MonthlyResult> {
  return cachedMonthly(`yahoo:${koreaMonth(now)}:${symbol}`, now, () =>
    loadYahooMonthly(symbol, now),
  );
}

async function kospiMonthly(now: Date): Promise<MonthlyResult> {
  const naver = await naverMonthly("KOSPI", now);
  const expected = previousCompletedMonth(now);
  if (naver.points.length >= 12 && naver.points.at(-1)!.date.slice(0, 7) === expected) return naver;
  // An unused secondary request must not delay healthy Naver data. Retain a
  // valid shorter primary history if the secondary provider is unavailable.
  const yahoo = await yahooMonthly("^KS11", now);
  const naverAsOf = naver.points.at(-1)?.date.slice(0, 7) ?? "";
  const yahooAsOf = yahoo.points.at(-1)?.date.slice(0, 7) ?? "";
  return yahooAsOf > naverAsOf ||
    (yahooAsOf === naverAsOf && yahoo.points.length > naver.points.length)
    ? yahoo
    : naver.points.length
      ? naver
      : yahoo;
}

function monthlyStatus(id: string, result: MonthlyResult, now: Date): ExportProviderStatus {
  const asOf = result.points.at(-1)?.date.slice(0, 7) ?? null;
  const firstMonth = result.points[0]?.date.slice(0, 7);
  const ordinal = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
  const hasGaps =
    asOf && firstMonth ? ordinal(asOf) - ordinal(firstMonth) + 1 !== result.points.length : false;
  const state: ExportProviderStatus["state"] = !asOf
    ? result.reasonCode === "RATE_LIMITED"
      ? "rate-limited"
      : "unavailable"
    : asOf < previousCompletedMonth(now)
      ? "stale"
      : result.points.length < 12 || hasGaps
        ? "partial"
        : "ok";
  return {
    id,
    name: result.source,
    configured: true,
    state,
    message: asOf
      ? `${asOf}까지 완료된 월간 종가 ${result.points.length}개 · 날짜는 제공처의 월간 봉 표기입니다.${state === "stale" ? " 최근 완료월 자료가 아직 확인되지 않았습니다." : ""}${state === "partial" ? " 분석에 필요한 과거 관측이 부족할 수 있습니다." : ""}`
      : "검증된 완료월 자료를 받지 못했습니다. 다른 데이터와 분리해 재시도하며, 과거 수치를 현재 값으로 만들지 않습니다.",
    checkedAt: result.checkedAt,
    asOf,
    recordCount: result.points.length,
    sourceUrl: result.sourceUrl,
    ...(result.reasonCode ? { reasonCode: result.reasonCode } : {}),
  };
}

type ExportMacroSnapshot = {
  kospi: MacroPoint[];
  fx: MacroPoint[];
  spotUsdKrw: number;
  source: string;
  fxSource: string;
  spotFxSource: string | null;
  fetchedAt: string;
  providers: ExportProviderStatus[];
};

let macroCache: { month: string; expiresAt: number; data: ExportMacroSnapshot } | null = null;
let macroFlight: { month: string; promise: Promise<ExportMacroSnapshot> } | null = null;

async function loadExportMacroSnapshot(now: Date): Promise<ExportMacroSnapshot> {
  const [kospi, fx, spotUsdKrw] = await Promise.all([
    kospiMonthly(now),
    yahooMonthly("USDKRW=X", now),
    macroJson(NAVER_SPOT_FX_URL)
      .then(parseNaverSpotUsdKrw)
      .catch(() => 0),
  ]);
  return {
    kospi: kospi.points,
    fx: fx.points,
    spotUsdKrw,
    source: kospi.source,
    fxSource: fx.source,
    // This endpoint does not establish a historical fixing date. A spot value
    // is separate from fx and must never be expanded into the monthly series.
    spotFxSource: spotUsdKrw > 0 ? "Naver FX_USDKRW · 조회값 (기준시각 미확인)" : null,
    fetchedAt: new Date().toISOString(),
    providers: [monthlyStatus("naver.kospi", kospi, now), monthlyStatus("bok.fx", fx, now)],
  };
}

/** Single-flight, short-lived memory cache; failures are retried after 30 seconds. */
export async function fetchExportMacroSnapshot(): Promise<ExportMacroSnapshot> {
  const now = new Date();
  const month = koreaMonth(now);
  if (macroCache?.month === month && macroCache.expiresAt > now.getTime()) return macroCache.data;
  if (macroFlight?.month === month) return macroFlight.promise;
  const promise = loadExportMacroSnapshot(now)
    .then((data) => {
      const healthy = data.providers.every((provider) => provider.state === "ok");
      macroCache = {
        month,
        data,
        expiresAt: Date.now() + (healthy ? SUCCESS_CACHE_MS : FAILURE_CACHE_MS),
      };
      return data;
    })
    .finally(() => {
      if (macroFlight?.promise === promise) macroFlight = null;
    });
  macroFlight = { month, promise };
  return promise;
}

export const getExportMacro = createServerFn({ method: "GET" }).handler(async () => {
  return fetchExportMacroSnapshot();
});

function isPreferredName(name: string): boolean {
  return /우$|우B$|우C$|우선|1우|2우|3우/.test(name.replace(/\s/g, ""));
}

/** Published listing rows carry their own price, market cap, volume and trade time. */
export async function fetchKospiMarketSum(pages = 4): Promise<ExportCapQuote[]> {
  const rows = await fetchDatedNaverMarketListing("KOSPI", pages);
  return rows
    .filter((row) => row.isEtf !== true)
    .map((row) => capQuoteFromProvider(row, isPreferredName(row.nameKo)));
}

export const getKospiCapQuotes = createServerFn({ method: "GET" }).handler(async () => {
  const ranked = await fetchKospiMarketSum(4).catch(() => []);
  const fallback = ranked.length
    ? []
    : await fetchRealtimeQuotes(
        UNIVERSE.filter((row) => row.market === "KOSPI").map((row) => row.code),
      ).catch(() => []);
  const quotes = ranked.length
    ? ranked
    : fallback
        .filter((row) => row.isEtf !== true)
        .map((row) => capQuoteFromProvider(row, isPreferredName(row.nameKo)));
  const verified = observedCapRanking(quotes, 200);
  return {
    quotes,
    asOf: verified.asOf,
    observedAt: verified.observedAt,
    dateBasis: verified.asOf ? ("provider-trade-time" as const) : ("unknown" as const),
    verifiedCount: verified.verifiedCount,
    totalCount: quotes.length,
    fetchedAt: new Date().toISOString(),
    source: ranked.length
      ? "Naver KOSPI 시총 목록 · 동일 응답의 시총·거래시각"
      : "Naver 앱 커버리지 시총 · 관측일 확인",
    note: "확인된 종목 범위의 시총 정렬입니다. ETF·우선주 및 거래 기준일이나 유효 시총이 없는 관측값은 순위에서 제외하며 전체 KOSPI 순위를 보장하지 않습니다.",
  };
});

export const getIndustryMonthlyPrices = createServerFn({ method: "GET" })
  .validator(z.object({ tickers: z.array(z.string().regex(/^[0-9A-Z]{6}$/)).max(12) }))
  .handler(async ({ data }) => {
    const series: Record<string, MacroPoint[]> = {};
    const providers: ExportProviderStatus[] = [];
    const now = new Date();
    await Promise.all(
      [...new Set(data.tickers)].map(async (code) => {
        const result = await naverMonthly(code, now);
        series[code] = result.points;
        providers.push(monthlyStatus(`naver.stock.${code}`, result, now));
      }),
    );
    return {
      series,
      providers: providers.sort((a, b) => a.id.localeCompare(b.id)),
      fetchedAt: new Date().toISOString(),
      source: "Naver fchart · 완료월 종가 · 날짜는 제공처 월간 봉 표기",
    };
  });
