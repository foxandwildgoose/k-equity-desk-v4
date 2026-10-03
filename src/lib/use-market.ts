import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { US_STREET_SYMBOLS } from "@/lib/us-street";
import { ROBOTICS_US_SYMBOLS } from "@/data/robotics";
import {
  getMarketQuotes,
  getStockBundle,
  getChartData,
  getValuationSeries,
  getMarketIndices,
  getResearchPdf,
  getResearchDesk,
  getIndustryResearch,
  getEtfMarket,
  getEtfListingNews,
  getEtfBundle,
  getUsLinkDesk,
  getSecuritySearch,
  getQuotesByCodes,
  getUsStreet,
  getUsOfficialPolicy,
  getUsOfficialUniverse,
  getUsOfficialCompany,
  getUsOfficialReport,
} from "@/lib/market-fns";
import type { ChartInterval, MinuteSize, LiveQuote } from "@/server/naver-market";
import type { SectorId } from "@/data/types";
import { normalizeKrTicker, isKrTicker, isDigitTicker } from "@/lib/infer-sector";
import { yahooUsSymbol } from "@/lib/valuation-series";
import type { EtfMarketBucket } from "@/server/etf-market";
import { UNIVERSE } from "@/data/universe";
import { US_LINKED_CODES } from "@/data/us-link";

/** Coverage-universe snapshot quotes (Naver). KIS ticks overlay via useMarketStream. */
export function useMarketQuotes(refetchMs = 45_000) {
  return useQuery({
    queryKey: ["market-quotes"],
    queryFn: () => getMarketQuotes(),
    staleTime: 40_000,
    refetchInterval: refetchMs,
    refetchOnWindowFocus: false,
  });
}

export function useQuoteMap() {
  const q = useMarketQuotes();
  const map = new Map<string, LiveQuote>();
  for (const quote of q.data?.quotes ?? []) {
    map.set(quote.code, quote);
  }
  return { ...q, map };
}

export function useSectorStocks(sectorId: SectorId) {
  const { map, ...rest } = useQuoteMap();
  const list =
    sectorId === "us-linked"
      ? US_LINKED_CODES.map((c) => UNIVERSE.find((u) => u.code === c)).filter(
          (u): u is (typeof UNIVERSE)[number] => Boolean(u),
        )
      : UNIVERSE.filter((u) => u.sectorId === sectorId);
  const stocks = list.map((u) => {
    const q = map.get(u.code);
    return {
      ...u,
      price: q?.price ?? null,
      change: q?.change ?? null,
      changePct: q?.changePct ?? null,
      volume: q?.volume ?? null,
      marketCap: q?.marketCap ?? null,
      high52: q?.high52 ?? null,
      low52: q?.low52 ?? null,
      quote: q ?? null,
    };
  });
  return { stocks, ...rest };
}

export function useStockBundle(code: string) {
  const padded = normalizeKrTicker(code);
  return useQuery({
    queryKey: ["stock-bundle", padded],
    queryFn: () => getStockBundle({ data: { code: padded } }),
    staleTime: 25_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: false,
    enabled: isDigitTicker(padded),
  });
}

export function useChartData(opts: {
  code: string;
  market: "KOSPI" | "KOSDAQ" | "US";
  interval: ChartInterval;
  minuteSize?: MinuteSize;
  range?: string;
  enabled?: boolean;
  /** US intraday pre/post-market bars. */
  prePost?: boolean;
}) {
  const us = opts.market === "US";
  const code = us ? (yahooUsSymbol(opts.code) ?? opts.code.trim().toUpperCase()) : normalizeKrTicker(opts.code);
  return useQuery({
    queryKey: [
      "chart",
      code,
      opts.market,
      opts.interval,
      opts.minuteSize ?? 1,
      opts.range ?? "default",
      opts.prePost ? "prepost" : "",
    ],
    queryFn: () =>
      getChartData({
        data: {
          code,
          market: opts.market,
          interval: opts.interval,
          minuteSize: opts.minuteSize,
          range: opts.range,
          prePost: us && opts.interval === "minute" ? Boolean(opts.prePost) : undefined,
        },
      }),
    staleTime: opts.interval === "minute" ? 15_000 : 60_000,
    enabled: (opts.enabled ?? true) && (us ? yahooUsSymbol(code) != null : isKrTicker(code)),
    refetchOnWindowFocus: false,
  });
}

export function useValuationSeries(code: string, enabled = true) {
  const us = yahooUsSymbol(code);
  const kr = normalizeKrTicker(code);
  const key = us ?? kr;
  return useQuery({
    queryKey: ["valuation-series", key],
    queryFn: () => getValuationSeries({ data: { code: key } }),
    staleTime: 6 * 60 * 60_000,
    enabled: enabled && Boolean(us || isKrTicker(kr)),
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useMarketIndices() {
  return useQuery({
    queryKey: ["market-indices"],
    queryFn: () => getMarketIndices(),
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useResearchPdf(
  researchId: number | undefined,
  category?: "company" | "industry" | "market" | "economy",
) {
  return useQuery({
    queryKey: ["research-pdf", researchId, category],
    queryFn: () =>
      getResearchPdf({
        data: { researchId: researchId!, category },
      }),
    enabled: researchId != null,
    staleTime: 10 * 60_000,
  });
}

export function useResearchDesk(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["research-desk"],
    queryFn: () => getResearchDesk(),
    staleTime: 5 * 60_000,
    enabled: opts?.enabled ?? true,
    refetchOnWindowFocus: false,
  });
}

/** First 12 of usWatchlist ∪ US_STREET_SYMBOLS ∪ robotics US names (F4.5). */
export function useStreetUniverse(): string[] {
  const usWatch = useAppStore((s) => s.usWatchlist);
  return useMemo(() => [...new Set([...usWatch, ...US_STREET_SYMBOLS, ...ROBOTICS_US_SYMBOLS])].slice(0, 12), [usWatch]);
}

export function useUsStreet(symbol?: string, opts?: { enabled?: boolean; symbols?: string[] }) {
  const ticker = symbol?.trim().toUpperCase() || "";
  const symbols = ticker ? undefined : opts?.symbols;
  return useQuery({
    queryKey: ["us-street", "v3", ticker || "desk", symbols?.join(",") ?? ""],
    queryFn: () => getUsStreet({ data: ticker ? { symbol: ticker } : { symbols } }),
    staleTime: 10 * 60_000,
    enabled: opts?.enabled ?? true,
    refetchOnWindowFocus: false,
  });
}

export function useUsOfficialPolicy(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["us-official-policy"],
    queryFn: () => getUsOfficialPolicy(),
    staleTime: 10 * 60_000,
    enabled: opts?.enabled ?? true,
    refetchOnWindowFocus: false,
  });
}

export function useUsOfficialUniverse(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["us-official-universe"],
    queryFn: () => getUsOfficialUniverse(),
    staleTime: 10 * 60_000,
    enabled: opts?.enabled ?? true,
    refetchOnWindowFocus: false,
  });
}

export function useUsOfficialCompany(symbol?: string) {
  const ticker = symbol?.trim().toUpperCase() || "";
  return useQuery({
    queryKey: ["us-official-company", ticker],
    queryFn: () => getUsOfficialCompany({ data: { symbol: ticker } }),
    enabled: ticker.length > 0,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useUsOfficialReport(id?: string) {
  const key = id?.trim() || "";
  return useQuery({
    queryKey: ["us-official-report", key],
    queryFn: () => getUsOfficialReport({ data: { id: key } }),
    enabled: key.length > 2,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useIndustryResearch(sectorId?: string) {
  return useQuery({
    queryKey: ["industry-research", sectorId],
    queryFn: () => getIndustryResearch({ data: { sectorId: sectorId! } }),
    enabled: Boolean(sectorId),
    staleTime: 3 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useEtfMarket(opts: {
  bucket?: EtfMarketBucket;
  q?: string;
  limit?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["etf-market", opts.bucket ?? "all", opts.q ?? "", opts.limit ?? 100],
    queryFn: () =>
      getEtfMarket({
        data: {
          bucket: opts.bucket,
          q: opts.q,
          limit: opts.limit,
        },
      }),
    staleTime: 45_000,
    enabled: opts.enabled ?? true,
    refetchOnWindowFocus: false,
  });
}

export function useEtfListingNews(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["etf-listing-news"],
    queryFn: () => getEtfListingNews(),
    staleTime: 5 * 60_000,
    enabled: opts?.enabled ?? true,
    refetchOnWindowFocus: false,
  });
}

export function useEtfBundle(code: string) {
  const normalized = normalizeKrTicker(code);
  return useQuery({
    queryKey: ["etf-bundle", normalized],
    queryFn: () => getEtfBundle({ data: { code: normalized } }),
    staleTime: 30_000,
    enabled: isKrTicker(normalized),
    refetchOnWindowFocus: false,
  });
}

export function useUsLinkDesk() {
  return useQuery({
    queryKey: ["us-link-desk"],
    queryFn: () => getUsLinkDesk(),
    staleTime: 90_000,
    refetchInterval: 180_000,
    refetchOnWindowFocus: false,
  });
}

export function useSecuritySearch(q: string) {
  const needle = q.trim();
  return useQuery({
    queryKey: ["security-search", needle],
    queryFn: () => getSecuritySearch({ data: { q: needle } }),
    enabled: needle.length >= 1,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useQuotesByCodes(codes: string[]) {
  const key = [...codes].sort().join(",");
  return useQuery({
    queryKey: ["quotes-by-codes", key],
    queryFn: () => getQuotesByCodes({ data: { codes } }),
    enabled: codes.length > 0,
    staleTime: 30_000,
  });
}
