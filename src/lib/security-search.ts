import type { SectorId } from "../data/types.ts";
import { scoreSearchHit } from "./search-match.ts";

export type SearchMarket = "KOSPI" | "KOSDAQ" | "NASDAQ" | "NYSE" | "AMEX" | "US";
export type SearchRegion = "KR" | "US";
export type SearchSource = "naver-autocomplete" | "naver-search" | "naver-listing" | "naver-etf" | "yahoo-search" | "nasdaq-directory" | "universe" | "us-universe";
export interface ListedSearchHit {
  code: string;
  nameKo: string;
  nameEn: string;
  market: SearchMarket;
  region: SearchRegion;
  sectorId: SectorId;
  isEtf: boolean;
  source: SearchSource;
  /** Actual echoed provider query/row ordinal, preserving translated company-name results. */
  matchedQuery?: string;
  providerRank?: number;
}
export type SearchProviderStatus = "ready" | "partial" | "unavailable";
export interface SearchProviderHealth {
  id: string;
  status: SearchProviderStatus;
  count: number;
}
export interface SecuritySearchResponse {
  q: string;
  hits: ListedSearchHit[];
  total: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  hasMore: boolean;
  status: SearchProviderStatus;
  providers: SearchProviderHealth[];
  fetchedAt: string;
  source: string;
}
export type SecuritySearchPage = SecuritySearchResponse;

/** Identity includes the country: a US ticker is never padded into a KRX code. */
export function searchSecurityKey(hit: Pick<ListedSearchHit, "region" | "code">): string {
  return `${hit.region}:${hit.code.toUpperCase()}`;
}

/** Class shares use Yahoo's symbol convention, also used by the existing US chart. */
export function normalizeSearchUsSymbol(value: string): string | null {
  const raw = value.trim().toUpperCase();
  if (raw.length > 15 || !/^[A-Z][A-Z0-9]*(?:[.-][A-Z0-9]+)*$/.test(raw)) return null;
  return raw.replaceAll(".", "-");
}

export function providerMatchesSearchQuery(query: string, hit: ListedSearchHit): boolean {
  const normalized = (value: string) => value.trim().normalize("NFKC").toLowerCase();
  return hit.source === "naver-autocomplete" && typeof hit.matchedQuery === "string" && normalized(query) !== "" && normalized(query) === normalized(hit.matchedQuery);
}

/** Exact ticker/name hits remain strongest; a provider's translated-name match stays visible. */
export function scoreSecuritySearchHit(query: string, hit: ListedSearchHit): number {
  const named = Math.max(scoreSearchHit(query, hit.nameKo, hit.code), scoreSearchHit(query, hit.nameEn, hit.code));
  return providerMatchesSearchQuery(query, hit) && Number.isInteger(hit.providerRank) && hit.providerRank! >= 0 && hit.providerRank! <= 1000 ? Math.max(named, 160 - Math.min(hit.providerRank!, 80)) : named;
}
