import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchUsdKrw } from "@/server/etf-market";
import { fetchOhlc, fetchRealtimeQuotes, fetchDatedNaverMarketListing } from "@/server/naver-market";
import { UNIVERSE } from "@/data/universe";
import { capQuoteFromProvider, observedCapRanking, type ExportCapQuote } from "@/lib/export-desk/cap-ranking";

export type MacroPoint = { date: string; value: number };

async function yahooMonthly(symbol: string): Promise<MacroPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=10y`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 KoreaExportDesk/1.0" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      chart?: {
        result?: {
          timestamp?: number[];
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[];
      };
    };
    const r = data.chart?.result?.[0];
    const ts = r?.timestamp ?? [];
    const cl = r?.indicators?.quote?.[0]?.close ?? [];
    const out: MacroPoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = cl[i];
      if (c == null || !Number.isFinite(c)) continue;
      const d = new Date(ts[i]! * 1000 + 9 * 3600 * 1000);
      const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      out.push({ date, value: c });
    }
    return out;
  } finally {
    clearTimeout(t);
  }
}

async function naverIndexMonthly(symbol: string): Promise<MacroPoint[]> {
  const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${encodeURIComponent(symbol)}&timeframe=month&count=180&requestType=0`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 KoreaExportDesk/1.0" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const out: MacroPoint[] = [];
    for (const m of xml.matchAll(/<item data="([^"]+)"/g)) {
      const parts = m[1]!.split("|");
      const ymd = parts[0] ?? "";
      const close = Number(parts[4]);
      if (ymd.length < 8 || !Number.isFinite(close) || close <= 0) continue;
      const date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
      out.push({ date, value: close });
    }
    return out;
  } finally {
    clearTimeout(t);
  }
}

export const getExportMacro = createServerFn({ method: "GET" }).handler(async () => {
  const [kospiNaver, kospiYahoo, fxSeries, spotFx] = await Promise.all([
    naverIndexMonthly("KOSPI").catch(() => [] as MacroPoint[]),
    yahooMonthly("^KS11").catch(() => [] as MacroPoint[]),
    yahooMonthly("USDKRW=X").catch(() => [] as MacroPoint[]),
    fetchUsdKrw().catch(() => 0),
  ]);
  const kospi = kospiNaver.length >= 12 ? kospiNaver : kospiYahoo;
  return {
    kospi,
    fx: fxSeries,
    spotUsdKrw: spotFx,
    source: kospiNaver.length >= 12 ? "Naver fchart KOSPI monthly" : "Yahoo Finance ^KS11",
    fetchedAt: new Date().toISOString(),
  };
});

function isPreferredName(name: string): boolean {
  return /우$|우B$|우C$|우선|1우|2우|3우/.test(name.replace(/\s/g, ""));
}

/** Published listing rows carry their own price, market cap, volume and trade time. */
export async function fetchKospiMarketSum(pages = 4): Promise<ExportCapQuote[]> {
  const rows = await fetchDatedNaverMarketListing("KOSPI", pages);
  return rows.filter(row => row.isEtf !== true).map(row => capQuoteFromProvider(row, isPreferredName(row.nameKo)));
}

export const getKospiCapQuotes = createServerFn({ method: "GET" }).handler(async () => {
  const ranked = await fetchKospiMarketSum(4).catch(() => []);
  const fallback = ranked.length ? [] : await fetchRealtimeQuotes(UNIVERSE.filter(row => row.market === "KOSPI").map(row => row.code)).catch(() => []);
  const quotes = ranked.length ? ranked : fallback.filter(row => row.isEtf !== true).map(row => capQuoteFromProvider(row, isPreferredName(row.nameKo)));
  const verified = observedCapRanking(quotes, 200);
  return {
    quotes,
    asOf: verified.asOf,
    observedAt: verified.observedAt,
    dateBasis: verified.asOf ? "provider-trade-time" as const : "unknown" as const,
    verifiedCount: verified.verifiedCount,
    totalCount: quotes.length,
    fetchedAt: new Date().toISOString(),
    source: ranked.length ? "Naver KOSPI 시총 목록 · 동일 응답의 시총·거래시각" : "Naver 앱 커버리지 시총 · 관측일 확인",
    note: "확인된 종목 범위의 시총 정렬입니다. ETF·우선주 및 거래 기준일이나 유효 시총이 없는 관측값은 순위에서 제외하며 전체 KOSPI 순위를 보장하지 않습니다.",
  };
});

export const getIndustryMonthlyPrices = createServerFn({ method: "GET" })
  .validator(z.object({ tickers: z.array(z.string().min(4).max(8)).max(12) }))
  .handler(async ({ data }) => {
    const series: Record<string, MacroPoint[]> = {};
    await Promise.all(
      data.tickers.map(async (code) => {
        const pack = await fetchOhlc({
          code,
          market: "KOSPI",
          interval: "month",
          range: "10y",
        }).catch(() => ({ bars: [] as { date: string; close: number }[] }));
        series[code] = pack.bars.map((b) => ({ date: b.date, value: b.close }));
      }),
    );
    return {
      series,
      fetchedAt: new Date().toISOString(),
      source: "Yahoo/Naver monthly close",
    };
  });
