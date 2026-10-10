import { inferSectorId, normalizeKrTicker } from "./infer-sector.ts";
import { scoreSecuritySearchHit, type ListedSearchHit, type SecuritySearchPage } from "./security-search.ts";

export const SECURITY_RECENT_KEY = "kx-search-recent-v1";

export function securityIdentity(hit: ListedSearchHit): string {
  return `${hit.region}:${hit.code.toUpperCase()}`;
}

/** A provider page belongs only to its exact query, including during debounce. */
export function currentSearchPages(
  pages: SecuritySearchPage[] | undefined,
  query: string,
): SecuritySearchPage[] {
  const needle = query.trim();
  if (!needle) return [];
  return (pages ?? []).filter((page) => page.q.trim() === needle);
}

export function mergeSecuritySearchHits(
  query: string,
  local: ListedSearchHit[],
  remote: ListedSearchHit[],
): ListedSearchHit[] {
  const byIdentity = new Map<string, ListedSearchHit>();
  for (const hit of [...local, ...remote]) {
    const key = securityIdentity(hit);
    const previous = byIdentity.get(key);
    byIdentity.set(key, {
      ...hit,
      // Keep the desk's real English company name when a provider repeats its Korean name.
      nameEn: previous?.nameEn && previous.nameEn !== previous.nameKo && hit.nameEn === hit.nameKo
        ? previous.nameEn
        : hit.nameEn,
    });
  }
  return [...byIdentity.values()].sort((a, b) => (
    scoreSecuritySearchHit(query, b) - scoreSecuritySearchHit(query, a)
    || a.nameKo.localeCompare(b.nameKo, "ko")
    || securityIdentity(a).localeCompare(securityIdentity(b))
  ));
}

export type SecuritySearchDestination =
  | { to: "/us/$symbol"; params: { symbol: string }; hit: ListedSearchHit }
  | { to: "/etfs/$code"; params: { code: string }; hit: ListedSearchHit }
  | { to: "/stock/$ticker"; params: { ticker: string }; hit: ListedSearchHit };

export function securitySearchDestination(hit: ListedSearchHit): SecuritySearchDestination {
  if (hit.region === "US") {
    // Dots / hyphens encode real US share classes. Never run Korean ticker padding here.
    const symbol = hit.code.trim().toUpperCase();
    return { to: "/us/$symbol", params: { symbol }, hit: { ...hit, code: symbol } };
  }
  const code = normalizeKrTicker(hit.code);
  // Search providers explicitly classify the product. Letters in a new KRX
  // stock code do not make that verified cash equity an ETF.
  const isEtf = hit.isEtf;
  const routed = { ...hit, code, isEtf };
  return isEtf
    ? { to: "/etfs/$code", params: { code }, hit: routed }
    : { to: "/stock/$ticker", params: { ticker: code }, hit: routed };
}

const US_MARKETS = new Set(["US", "NASDAQ", "NYSE", "AMEX"]);
const SOURCES = new Set([
  "naver-autocomplete", "naver-search", "naver-listing", "naver-etf",
  "yahoo-search", "nasdaq-directory", "universe", "us-universe",
]);

/** Validate old scoped recent entries without trusting arbitrary stored route data. */
function recentHit(value: unknown): ListedSearchHit | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.code !== "string" || typeof raw.nameKo !== "string") return null;
  const nameKo = raw.nameKo.trim();
  if (!nameKo || nameKo.length > 240) return null;
  const code = raw.code.trim().toUpperCase();
  const market = raw.market;
  const region = market === "KOSPI" || market === "KOSDAQ" ? "KR" : US_MARKETS.has(String(market)) ? "US" : null;
  if (!region || (raw.region != null && raw.region !== region)) return null;
  if (region === "KR" ? !/^[0-9A-Z]{6}$/.test(code) : !/^[A-Z][A-Z0-9.-]{0,14}$/.test(code)) return null;
  if (typeof raw.isEtf !== "boolean" || typeof raw.source !== "string" || !SOURCES.has(raw.source)) return null;
  // Sector metadata is display-only here; derive it from the verified name rather than stored arbitrary values.
  return {
    code, nameKo,
    nameEn: typeof raw.nameEn === "string" ? raw.nameEn.slice(0, 240) : nameKo,
    market: market as ListedSearchHit["market"], region,
    sectorId: inferSectorId(nameKo), isEtf: raw.isEtf,
    source: raw.source as ListedSearchHit["source"],
  };
}

export function parseRecentSecurities(serialized: string | null): ListedSearchHit[] {
  try {
    const data: unknown = JSON.parse(serialized ?? "[]");
    if (!Array.isArray(data)) return [];
    const byIdentity = new Map<string, ListedSearchHit>();
    for (const value of data) {
      const hit = recentHit(value);
      if (!hit || byIdentity.has(securityIdentity(hit))) continue;
      byIdentity.set(securityIdentity(hit), hit);
      if (byIdentity.size >= 8) break;
    }
    return [...byIdentity.values()];
  } catch {
    return [];
  }
}

export interface SearchStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadRecentSecurities(storage: Pick<SearchStorage, "getItem">): ListedSearchHit[] {
  try { return parseRecentSecurities(storage.getItem(SECURITY_RECENT_KEY)); }
  catch { return []; }
}

/** Storage denial must never prevent navigating to the selected security. */
export function saveRecentSecurity(hit: ListedSearchHit, storage: SearchStorage): boolean {
  try {
    const previous = loadRecentSecurities(storage).filter((entry) => securityIdentity(entry) !== securityIdentity(hit));
    storage.setItem(SECURITY_RECENT_KEY, JSON.stringify([hit, ...previous].slice(0, 8)));
    return true;
  } catch { return false; }
}

export function securityMarketLabel(hit: ListedSearchHit): string {
  if (hit.region === "US") return hit.market === "US" ? "미국" : `미국 · ${hit.market}`;
  return hit.market === "KOSDAQ" ? "코스닥" : "코스피";
}
