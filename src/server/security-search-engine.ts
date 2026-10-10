import { matchesSearchQuery } from "../lib/search-match.ts";
import { providerMatchesSearchQuery, scoreSecuritySearchHit, searchSecurityKey, type ListedSearchHit, type SearchProviderHealth, type SecuritySearchResponse } from "../lib/security-search.ts";
import { parseKrSearchListing, parseNasdaqSearchDirectory, parseNaverAutocomplete, parseNaverDesktopSearch, parseNaverSearchEtfs, parseYahooSecuritySearch } from "./security-search-parse.ts";

const UA = "Mozilla/5.0 KoreaEquityCommand/1.0";
const DIRECTORY_TTL = 6 * 60 * 60_000;
const RETRY_TTL = 30_000;
const QUERY_TTL = 30_000;
const REQUEST_BUDGET = 10_000;
const BODY_LIMIT = 8 * 1024 * 1024;
interface ProviderRows { rows: ListedSearchHit[]; health: SearchProviderHealth }
interface DirectoryCache { rows: ListedSearchHit[]; at: number; attemptedAt: number; complete: boolean }
interface KrDirectoryCache extends DirectoryCache { pages: Map<number, { rows: ListedSearchHit[]; identities: string[] }>; total: number | null; day: string; lastGoodRows: ListedSearchHit[] }

/** One-character tickers and name prefixes are meaningful stock searches. */
export function matchesSecurityQuery(query: string, hit: ListedSearchHit): boolean {
  const q = query.trim();
  if (!q) return false;
  if (providerMatchesSearchQuery(query, hit)) return true;
  if (q.length === 1) return /^[a-z0-9가-힣]$/i.test(q) && [hit.code, hit.nameKo, hit.nameEn].some(value => value.toLowerCase().includes(q.toLowerCase()));
  return matchesSearchQuery(q, [hit.nameKo, hit.nameEn, hit.code]);
}

export function mergeSearchRows(query: string, collections: ListedSearchHit[][]): ListedSearchHit[] {
  const byKey = new Map<string, ListedSearchHit>();
  for (const rows of collections) for (const hit of rows) {
    if (!matchesSecurityQuery(query, hit)) continue;
    const key = searchSecurityKey(hit), previous = byKey.get(key);
    const explicitAssetType = ["naver-listing", "naver-etf", "nasdaq-directory", "yahoo-search"].includes(hit.source);
    byKey.set(key, previous ? { ...hit, sectorId: previous.sectorId, nameEn: previous.nameEn !== previous.nameKo ? previous.nameEn : hit.nameEn, isEtf: explicitAssetType ? hit.isEtf : previous.isEtf || hit.isEtf } : hit);
  }
  return [...byKey.values()].sort((a, b) => {
    const score = (hit: ListedSearchHit) => scoreSecuritySearchHit(query, hit);
    return score(b) - score(a) || a.nameKo.localeCompare(b.nameKo, "ko") || searchSecurityKey(a).localeCompare(searchSecurityKey(b));
  });
}

/** Public market lookup only: fixed hosts/paths, no broker credentials or database writes. */
export function createSecuritySearchEngine(options: { localRows: readonly ListedSearchHit[]; fetcher?: typeof fetch; now?: () => number; budgetMs?: number } ) {
  const fetcher = options.fetcher ?? fetch, now = options.now ?? Date.now;
  const directory = new Map<string, DirectoryCache>();
  const directoryFlights = new Map<string, Promise<ProviderRows>>();
  const krDirectory = new Map<string, KrDirectoryCache>();
  const queries = new Map<string, { at: number; rows: ListedSearchHit[]; providers: SearchProviderHealth[] }>();
  const queryFlights = new Map<string, Promise<{ rows: ListedSearchHit[]; providers: SearchProviderHealth[] }>>();

  async function body(url: string, deadline: number): Promise<string> {
    const remaining = deadline - now();
    if (remaining <= 0) throw new Error("SEARCH_TIMEOUT");
    const response = await fetcher(url, { headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*", Referer: "https://m.stock.naver.com/" }, redirect: "error", signal: AbortSignal.timeout(Math.min(3_500, remaining)) });
    if (!response.ok) throw new Error("SEARCH_PROVIDER_UNAVAILABLE");
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > BODY_LIMIT) throw new Error("SEARCH_RESPONSE_LIMIT");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > BODY_LIMIT) throw new Error("SEARCH_RESPONSE_LIMIT");
    const contentType = response.headers.get("content-type") ?? "";
    if (/charset=(?:euc-kr|ks_c_5601|cp949)/i.test(contentType)) return new TextDecoder("euc-kr").decode(bytes);
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch {
      // The existing Naver desktop ETF endpoint also serves EUC-KR without a charset.
      if (new URL(url).hostname === "finance.naver.com" && !/charset=/i.test(contentType)) return new TextDecoder("euc-kr").decode(bytes);
      throw new Error("SEARCH_RESPONSE_ENCODING");
    }
  }
  async function json(url: string, deadline: number): Promise<unknown> { return JSON.parse(await body(url, deadline)); }
  function health(id: string, rows: ListedSearchHit[], complete: boolean): ProviderRows {
    return { rows, health: { id, count: rows.length, status: complete ? "ready" : rows.length ? "partial" : "unavailable" } };
  }
  async function cachedDirectory(id: string, url: string, parse: (value: string) => ListedSearchHit[], deadline: number): Promise<ProviderRows> {
    const previous = directory.get(id), stamp = now();
    if (previous && stamp - previous.at < DIRECTORY_TTL && previous.complete) return health(id, previous.rows, true);
    if (previous && stamp - previous.attemptedAt < RETRY_TTL) return health(id, previous.rows, false);
    const flight = directoryFlights.get(id);
    if (flight) return flight;
    const promise = (async () => {
      try {
        const rows = parse(await body(url, deadline));
        if (!rows.length) throw new Error("SEARCH_DIRECTORY_EMPTY");
        directory.set(id, { rows, at: now(), attemptedAt: stamp, complete: true });
        return health(id, rows, true);
      } catch {
        const fallback = previous?.rows ?? [];
        directory.set(id, { rows: fallback, at: previous?.at ?? 0, attemptedAt: stamp, complete: false });
        return health(id, fallback, false);
      }
    })();
    directoryFlights.set(id, promise);
    try { return await promise; } finally { directoryFlights.delete(id); }
  }

  async function krListing(market: "KOSPI" | "KOSDAQ", deadline: number): Promise<ProviderRows> {
    const id = `kr-listing-${market.toLowerCase()}`, stamp = now();
    const previous = krDirectory.get(id);
    if (previous?.complete && stamp - previous.at < DIRECTORY_TTL) return health(id, previous.rows, true);
    if (previous && stamp - previous.attemptedAt < RETRY_TTL) return health(id, previous.rows, previous.complete);
    const flight = directoryFlights.get(id);
    if (flight) return flight;
    const promise = (async () => {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(stamp));
      const cache: KrDirectoryCache = previous?.day === day && !previous.complete ? previous : { pages: new Map(), rows: [], total: null, day, complete: false, at: 0, attemptedAt: stamp, lastGoodRows: previous?.lastGoodRows ?? [] };
      cache.attemptedAt = stamp;
      let failed = false;
      let changed = false;
      async function page(index: number) {
        if (cache.pages.has(index) || now() >= deadline) return;
        try {
          const parsed = parseKrSearchListing(await json(`https://m.stock.naver.com/api/stocks/marketValue/${market}?page=${index}&pageSize=100`, deadline), market);
          if (cache.total !== null && cache.total !== parsed.total) { changed = true; throw new Error("SEARCH_LISTING_CHANGED"); }
          cache.total = parsed.total;
          const expected = Math.min(100, parsed.total - (index - 1) * 100);
          if (parsed.identities.length !== expected || new Set(parsed.identities).size !== parsed.identities.length) throw new Error("SEARCH_LISTING_PARTIAL");
          const priorIdentities = new Set([...cache.pages.values()].flatMap(item => item.identities));
          if (parsed.identities.some(code => priorIdentities.has(code))) throw new Error("SEARCH_LISTING_REPEATED_PAGE");
          cache.pages.set(index, { rows: parsed.rows, identities: parsed.identities });
        } catch { failed = true; }
      }
      await page(1);
      if (cache.total !== null) {
        const count = Math.ceil(cache.total / 100);
        for (let index = 2; index <= count && now() < deadline; index += 6) {
          await Promise.all(Array.from({ length: Math.min(6, count - index + 1) }, (_, offset) => page(index + offset)));
        }
      }
      const byCode = new Map<string, ListedSearchHit>();
      if (changed) { cache.pages.clear(); cache.total = null; }
      const allIdentities = new Set<string>();
      for (const page of cache.pages.values()) {
        for (const code of page.identities) allIdentities.add(code);
        for (const row of page.rows) byCode.set(searchSecurityKey(row), row);
      }
      cache.complete = !failed && cache.total !== null && allIdentities.size === cache.total && cache.pages.size === Math.ceil(cache.total / 100);
      if (cache.complete) { cache.rows = [...byCode.values()]; cache.lastGoodRows = cache.rows; cache.at = now(); }
      else { cache.rows = [...new Map([...cache.lastGoodRows, ...byCode.values()].map(row => [searchSecurityKey(row), row])).values()]; }
      krDirectory.set(id, cache);
      return health(id, cache.rows.length ? cache.rows : previous?.rows ?? [], cache.complete);
    })();
    directoryFlights.set(id, promise);
    try { return await promise; } finally { directoryFlights.delete(id); }
  }

  async function remote(id: string, url: string, parser: (value: unknown) => ListedSearchHit[], deadline: number): Promise<ProviderRows> {
    try { const rows = parser(await json(url, deadline)); return health(id, rows, true); }
    catch { return health(id, [], false); }
  }
  async function lookup(query: string) {
    const key = query.trim().normalize("NFKC").toLowerCase(), cached = queries.get(key);
    if (cached && now() - cached.at < QUERY_TTL) return cached;
    const existing = queryFlights.get(key);
    if (existing) return existing;
    // Bound concurrent unique query work; shared callers cannot cancel one another's lookup.
    if (queryFlights.size >= 8) return { rows: mergeSearchRows(query, [[...options.localRows]]), providers: [{ id: "public-search", status: "unavailable" as const, count: 0 }] };
    const promise = (async () => {
      const deadline = now() + Math.max(50, Math.min(options.budgetMs ?? REQUEST_BUDGET, REQUEST_BUDGET));
      const encoded = encodeURIComponent(query);
      const providers = await Promise.all([
        remote("naver-autocomplete", `https://m.stock.naver.com/front-api/search/autoComplete?query=${encoded}&target=stock`, parseNaverAutocomplete, deadline),
        remote("naver-search", `https://ac.stock.naver.com/ac?q=${encoded}&q_enc=UTF-8&st=111&r_format=json&r_enc=UTF-8`, parseNaverDesktopSearch, deadline),
        remote("us-search", `https://query1.finance.yahoo.com/v1/finance/search?q=${encoded}&quotesCount=100&newsCount=0&enableFuzzyQuery=false`, parseYahooSecuritySearch, deadline),
        krListing("KOSPI", deadline), krListing("KOSDAQ", deadline),
        cachedDirectory("etf-listing", "https://finance.naver.com/api/sise/etfItemList.nhn", value => parseNaverSearchEtfs(JSON.parse(value)), deadline),
        cachedDirectory("us-listing-nasdaq", "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt", value => parseNasdaqSearchDirectory(value, "nasdaq"), deadline),
        cachedDirectory("us-listing-other", "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt", value => parseNasdaqSearchDirectory(value, "other"), deadline),
      ]);
      const value = { at: now(), rows: mergeSearchRows(query, [[...options.localRows], ...providers.map(item => item.rows)]), providers: providers.map(item => item.health) };
      if (queries.size >= 200) queries.delete(queries.keys().next().value!);
      queries.set(key, value);
      return value;
    })();
    queryFlights.set(key, promise);
    try { return await promise; } finally { queryFlights.delete(key); }
  }
  return async function search(query: string, offset = 0, limit = 40): Promise<SecuritySearchResponse> {
    const q = query.trim().slice(0, 80), start = Math.max(0, Math.floor(Number.isFinite(offset) ? offset : 0)), size = Math.max(1, Math.min(100, Math.floor(Number.isFinite(limit) ? limit : 40)));
    const found = q ? await lookup(q) : { rows: [], providers: [] };
    const hits = found.rows.slice(start, start + size), hasMore = start + hits.length < found.rows.length;
    const completeKr = ["kr-listing-kospi", "kr-listing-kosdaq", "etf-listing"].every(id => found.providers.some(item => item.id === id && item.status === "ready"));
    const completeUs = ["us-listing-nasdaq", "us-listing-other"].every(id => found.providers.some(item => item.id === id && item.status === "ready"));
    const remoteAvailable = found.providers.some(item => item.status !== "unavailable");
    return { q, hits, total: found.rows.length, offset: start, limit: size, nextOffset: hasMore ? start + hits.length : null, hasMore, status: completeKr && completeUs ? "ready" : remoteAvailable ? "partial" : "unavailable", providers: found.providers, fetchedAt: new Date(now()).toISOString(), source: "Naver KOSPI/KOSDAQ/ETF listings and search · Nasdaq Trader symbol directories · Yahoo US search · saved desk coverage" };
  };
}
