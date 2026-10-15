import { providerQuoteTime, quoteFreshness } from "../market-freshness.ts";
import { rankKospiByMarketCap } from "./ranking.ts";

export interface ExportCapQuote {
  ticker: string;
  name: string;
  market: "KOSPI" | "KOSDAQ";
  marketCap: number;
  marketCapValid: boolean;
  price: number;
  changePct: number;
  changeValid: boolean;
  tradedAt: string | null;
  fetchedAt: string | null;
  marketStatus?: string;
  isPreferred: boolean;
  isEtf?: boolean;
  source: string;
  sourceUrl?: string;
}

/** Metadata and the observation time must come from the same provider row. */
export function capQuoteFromProvider(q: {
  code: string; nameKo: string; market: "KOSPI" | "KOSDAQ"; marketCap: number;
  marketCapValid?: boolean; price: number; changePct: number; changeValid?: boolean;
  tradedAt?: string; fetchedAt?: string; marketStatus?: string; source?: string; sourceUrl?: string; isEtf?: boolean;
}, isPreferred: boolean): ExportCapQuote {
  return { ticker: q.code, name: q.nameKo, market: q.market, marketCap: q.marketCap,
    marketCapValid: q.marketCapValid !== false && Number.isFinite(q.marketCap) && q.marketCap > 0,
    price: q.price, changePct: q.changePct, changeValid: q.changeValid !== false,
    tradedAt: q.tradedAt ?? null, fetchedAt: q.fetchedAt ?? null,
    marketStatus: q.marketStatus, isPreferred, isEtf: q.isEtf, source: q.source ?? "naver-finance-snapshot", sourceUrl: q.sourceUrl };
}

/** Never stamp a received HTML value with today's date or a different quote's time. */
export function observedCapRanking(rows: readonly ExportCapQuote[], n = 100, now = Date.now()) {
  const quotes = rows.filter(row => {
    if (row.market !== "KOSPI" || row.isEtf || !row.marketCapValid || !Number.isFinite(row.marketCap) || row.marketCap <= 0) return false;
    const state = quoteFreshness({ code: row.ticker, price: row.price, changePct: row.changePct,
      changeValid: row.changeValid, tradedAt: row.tradedAt ?? undefined, marketStatus: row.marketStatus }, now);
    return state.status === "fresh" || state.status === "closed";
  });
  const dated = quotes.map(row => ({ row, time: providerQuoteTime(row.tradedAt)! }));
  const latest = dated.length ? Math.max(...dated.map(row => row.time)) : null;
  const session = (time: number) => new Date(time + 9 * 3_600_000).toISOString().slice(0, 10);
  const asOf = latest == null ? null : session(latest);
  const members = asOf ? rankKospiByMarketCap(dated.map(({ row, time }) => ({ ticker: row.ticker,
    name: row.name, marketCap: row.marketCap, date: session(time), isPreferred: row.isPreferred })), { n, date: asOf }) : [];
  return { members, quotes, asOf, observedAt: latest == null ? null : new Date(latest).toISOString(),
    verifiedCount: quotes.length, totalCount: rows.length, excludedCount: rows.length - quotes.length };
}
