/**
 * Stock universe accessors. Prices are NOT stored here —
 * load live quotes via getMarketQuotes / useMarketQuotes.
 */
import { UNIVERSE, UNIVERSE_BY_CODE, getUniverseItem, type UniverseItem } from "./universe";
import type { SectorId, Stock } from "./types";
import type { LiveQuote } from "@/server/naver-market";
import { US_LINKED_CODES } from "./us-link";
import { matchesSearchQuery, rankByQuery } from "@/lib/search-match";
import { SECTOR_BY_ID } from "./sectors";
import { normalizeKrTicker } from "@/lib/infer-sector";
import { isValidMarketQuote, marketQuoteMovers, quoteCoverage, quoteFreshness } from "@/lib/market-freshness";

export { UNIVERSE, UNIVERSE_BY_CODE, getUniverseItem };
export type { UniverseItem };

export function normalizeCode(code: string): string {
  return normalizeKrTicker(code);
}

export function stocksBySector(sectorId: SectorId | string): UniverseItem[] {
  if (sectorId === "us-linked") {
    return US_LINKED_CODES.map((c) => UNIVERSE_BY_CODE[c]).filter(
      Boolean,
    ) as UniverseItem[];
  }
  return UNIVERSE.filter((s) => s.sectorId === sectorId);
}

export const getStocksBySector = stocksBySector;

export function searchUniverse(q: string): UniverseItem[] {
  const s = q.trim();
  if (!s) return [];
  const hits = UNIVERSE.filter((x) =>
    matchesSearchQuery(s, [
      x.nameKo,
      x.nameEn,
      x.code,
      SECTOR_BY_ID[x.sectorId]?.nameKo,
      SECTOR_BY_ID[x.sectorId]?.nameEn,
    ]),
  );
  return rankByQuery(hits, s, (x) => ({ name: x.nameKo, code: x.code })).slice(
    0,
    20,
  );
}

export function searchEtfs(q: string): { code: string; nameKo: string }[] {
  // Live ETF search is handled by useEtfMarket server query; keep stub for command palette fallback.
  void q;
  return [];
}

export const searchStocks = searchUniverse;

export function mergeQuote(
  meta: UniverseItem,
  q: LiveQuote | undefined | null,
): Stock {
  const price = q?.price ?? 0;
  const marketCap = q?.marketCap ?? 0;
  const freshness = q ? quoteFreshness(q) : null;
  return {
    code: meta.code,
    nameKo: meta.nameKo,
    nameEn: meta.nameEn,
    sectorId: meta.sectorId,
    market: meta.market,
    quoteAvailable: Boolean(q && isValidMarketQuote(q)),
    quoteAsOf: freshness?.asOf ?? null,
    quoteStatus: freshness?.status ?? "unavailable",
    price,
    change: q?.change ?? 0,
    changePct: q?.changePct ?? 0,
    volume: q?.volume ?? 0,
    volumeValid: Boolean(q && q.volumeValid !== false && Number.isFinite(q.volume) && q.volume >= 0),
    marketCap,
    marketCapValid: Boolean(q && q.marketCapValid !== false && Number.isFinite(q.marketCap) && q.marketCap > 0),
    high52: q?.high52 ?? 0,
    low52: q?.low52 ?? 0,
    sparkline: [],
    capBand:
      marketCap >= 100_000 ? "대형" : marketCap >= 20_000 ? "중형" : "소형",
  };
}

export function quoteToStock(q: LiveQuote): Stock {
  return mergeQuote(
    {
      code: q.code,
      nameKo: q.nameKo,
      nameEn: q.nameEn,
      sectorId: q.sectorId,
      market: q.market,
    },
    q,
  );
}

export function marketMoversFromQuotes(
  quotes: LiveQuote[],
  n = 6,
  now = Date.now(),
): { gainers: Stock[]; losers: Stock[] } {
  const selected = marketQuoteMovers(quotes, n, now);
  return {
    gainers: selected.gainers.map(quoteToStock),
    losers: selected.losers.map(quoteToStock),
  };
}

export function sectorStatsFromQuotes(
  sectorId: string,
  quotes: LiveQuote[],
  now = Date.now(),
) {
  const codes =
    sectorId === "us-linked"
      ? new Set(US_LINKED_CODES)
      : new Set(
          UNIVERSE.filter((u) => u.sectorId === sectorId).map((u) => u.code),
        );
  const coverage = quoteCoverage(quotes, codes, now);
  const sorted = [...coverage.quotes].sort((a, b) => b.changePct - a.changePct);
  const topGainer = sorted.find((quote) => quote.changePct > 0);
  const topLoser = [...sorted].reverse().find((quote) => quote.changePct < 0);
  return {
    ...coverage,
    topGainer: topGainer ? quoteToStock(topGainer) : null,
    topLoser: topLoser ? quoteToStock(topLoser) : null,
  };
}
