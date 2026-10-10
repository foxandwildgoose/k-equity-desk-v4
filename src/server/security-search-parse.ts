import { inferSectorId } from "../lib/infer-sector.ts";
import { normalizeSearchUsSymbol, type ListedSearchHit, type SearchMarket, type SearchSource } from "../lib/security-search.ts";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const krCode = (value: unknown): string | null => /^[0-9A-Z]{6}$/.test(text(value).toUpperCase()) ? text(value).toUpperCase() : null;
const etfName = (name: string) => /\b(?:ETF|KODEX|TIGER|ACE|PLUS|SOL|RISE|HANARO|KBSTAR)\b|상장지수/i.test(name);
const krMarket = (value: string): "KOSPI" | "KOSDAQ" | null => /KOSDAQ|코스닥|\bKQ\b/i.test(value) ? "KOSDAQ" : /KOSPI|코스피|유가증권|\bKS\b|ETF/i.test(value) ? "KOSPI" : null;

function krHit(code: string, name: string, market: "KOSPI" | "KOSDAQ", isEtf: boolean, source: SearchSource): ListedSearchHit {
  return { code, nameKo: name, nameEn: name, market, region: "KR", sectorId: inferSectorId(name), isEtf, source };
}
function usHit(code: string, name: string, market: SearchMarket, isEtf: boolean, source: SearchSource): ListedSearchHit {
  return { code, nameKo: name, nameEn: name, market, region: "US", sectorId: inferSectorId(name), isEtf, source };
}

/** Existing Naver mobile response contract; malformed schemas fail visibly. */
export function parseNaverAutocomplete(payload: unknown): ListedSearchHit[] {
  const root = record(payload), result = record(root?.result);
  const items = result?.items ?? root?.items;
  if (!Array.isArray(items)) throw new Error("SEARCH_RESPONSE_SCHEMA");
  const hits: ListedSearchHit[] = [];
  for (const [providerRank, value] of items.entries()) {
    const row = record(value);
    if (!row) continue;
    const name = text(row.name) || text(row.stockName), nation = text(row.nationCode).toUpperCase();
    if (!name) continue;
    const type = `${text(row.typeCode)} ${text(row.typeName)}`;
    if (/ETN|채권|선물|지수/i.test(type) && !/ETF/i.test(type)) continue;
    const market = krMarket(type), code = krCode(row.code ?? row.itemCode);
    if ((nation === "KOR" || nation === "KR" || !nation) && code && market) {
      hits.push({ ...krHit(code, name, market, row.isEtf === true || row.isEtf !== false && (/ETF/i.test(type) || etfName(name)), "naver-autocomplete"), ...(text(result?.query) ? { matchedQuery: text(result?.query), providerRank } : {}) });
    } else if (nation === "USA" || nation === "US") {
      const symbol = normalizeSearchUsSymbol(text(row.code)) ?? normalizeSearchUsSymbol(text(row.reutersCode).replace(/\.(?:O|N|K|P)$/i, ""));
      if (!symbol) continue;
      const exchange: SearchMarket = /NASDAQ|나스닥/i.test(type) ? "NASDAQ" : /NYSE|뉴욕/i.test(type) ? "NYSE" : /AMEX|아멕스/i.test(type) ? "AMEX" : "US";
      hits.push({ ...usHit(symbol, name, exchange, row.isEtf === true || /ETF/i.test(type), "naver-autocomplete"), ...(text(result?.query) ? { matchedQuery: text(result?.query), providerRank } : {}) });
    }
  }
  return hits;
}

/** Naver desktop autocomplete's JSON item tuples contain name, code and exchange. */
export function parseNaverDesktopSearch(payload: unknown): ListedSearchHit[] {
  const root = record(payload);
  if (!Array.isArray(root?.items)) throw new Error("SEARCH_RESPONSE_SCHEMA");
  const hits: ListedSearchHit[] = [];
  for (const group of root.items) {
    if (!Array.isArray(group)) continue;
    for (const item of group) {
      if (!Array.isArray(item)) continue;
      const fields = item.map(text), code = fields.map(krCode).find(Boolean), name = fields[0];
      const market = krMarket(fields.join(" "));
      if (code && name && market) hits.push(krHit(code, name, market, etfName(name), "naver-search"));
    }
  }
  return hits;
}

/** Reuses the current stock listing endpoint contract from bollinger-membership. */
export function parseKrSearchListing(payload: unknown, market: "KOSPI" | "KOSDAQ"): { rows: ListedSearchHit[]; total: number; identities: string[] } {
  const root = record(payload);
  if (!root || !Number.isInteger(root.totalCount) || Number(root.totalCount) < 0 || Number(root.totalCount) > 10000 || !Array.isArray(root.stocks)) throw new Error("SEARCH_LISTING_SCHEMA");
  const rows: ListedSearchHit[] = [];
  const identities: string[] = [];
  for (const value of root.stocks) {
    const row = record(value), code = krCode(row?.itemCode), name = text(row?.stockName);
    if (!row || !code || !name) throw new Error("SEARCH_LISTING_SCHEMA");
    identities.push(code);
    if (row.stockEndType === "stock" || row.stockEndType === "etf") rows.push(krHit(code, name, market, row.stockEndType === "etf", "naver-listing"));
  }
  return { rows, total: Number(root.totalCount), identities };
}

export function parseNaverSearchEtfs(payload: unknown): ListedSearchHit[] {
  const items = record(record(payload)?.result)?.etfItemList;
  if (!Array.isArray(items)) throw new Error("SEARCH_ETF_SCHEMA");
  return items.map(value => {
    const row = record(value), code = krCode(row?.itemcode), name = text(row?.itemname);
    if (!code || !name) throw new Error("SEARCH_ETF_SCHEMA");
    return krHit(code, name, "KOSPI", true, "naver-etf");
  });
}

const yahooMarkets: Record<string, SearchMarket> = { NMS: "NASDAQ", NGM: "NASDAQ", NCM: "NASDAQ", NAS: "NASDAQ", NYQ: "NYSE", NYS: "NYSE", ASE: "AMEX", AMS: "AMEX", PCX: "US", BTS: "US", BATS: "US", PNK: "US", OQX: "US", OQB: "US" };
export function parseYahooSecuritySearch(payload: unknown): ListedSearchHit[] {
  const quotes = record(payload)?.quotes;
  if (!Array.isArray(quotes)) throw new Error("SEARCH_RESPONSE_SCHEMA");
  const hits: ListedSearchHit[] = [];
  for (const value of quotes) {
    const row = record(value);
    if (!row || !["EQUITY", "ETF"].includes(text(row.quoteType).toUpperCase())) continue;
    const market = yahooMarkets[text(row.exchange).toUpperCase()], code = normalizeSearchUsSymbol(text(row.symbol));
    const name = text(row.longname) || text(row.shortname);
    // Never mistake overseas .KS/.KQ/.L tickers, indices or cryptocurrency for US equities.
    if (!market || !code || !name || /\.[A-Z]{1,3}$/.test(text(row.symbol)) && !/^[A-Z]+\.[A-Z]$/.test(text(row.symbol))) continue;
    hits.push(usHit(code, name, market, row.quoteType === "ETF", "yahoo-search"));
  }
  return hits;
}

/** Official Nasdaq Trader Symbol Directory pipe-delimited formats (no third-party snapshot). */
export function parseNasdaqSearchDirectory(body: string, kind: "nasdaq" | "other"): ListedSearchHit[] {
  const lines = body.replace(/^\uFEFF/, "").split(/\r?\n/), header = (lines.shift() ?? "").split("|");
  const symbolColumn = header.indexOf(kind === "nasdaq" ? "Symbol" : "ACT Symbol"), nameColumn = header.indexOf("Security Name");
  const testColumn = header.indexOf("Test Issue"), etfColumn = header.indexOf("ETF"), exchangeColumn = header.indexOf("Exchange");
  if (symbolColumn < 0 || nameColumn < 0 || testColumn < 0 || etfColumn < 0 || kind === "other" && exchangeColumn < 0) throw new Error("SEARCH_DIRECTORY_SCHEMA");
  const hits: ListedSearchHit[] = [];
  let footer = false;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith("File Creation Time:")) { footer = true; continue; }
    const values = line.split("|");
    if (values.length !== header.length) throw new Error("SEARCH_DIRECTORY_SCHEMA");
    if (values[testColumn] !== "N") continue;
    const rawSymbol = values[symbolColumn]!, name = values[nameColumn]?.trim(), code = normalizeSearchUsSymbol(rawSymbol);
    // Warrants, rights, units and preferred symbols may use unsupported directory suffixes.
    if (!code || !name || /[$^/]/.test(rawSymbol)) continue;
    const market: SearchMarket | undefined = kind === "nasdaq" ? "NASDAQ" : ({ N: "NYSE", A: "AMEX", P: "US", Z: "US", V: "US" } as Record<string, SearchMarket>)[values[exchangeColumn]!];
    if (!market) continue;
    hits.push(usHit(code, name, market, values[etfColumn] === "Y", "nasdaq-directory"));
  }
  if (!footer || !hits.length) throw new Error("SEARCH_DIRECTORY_INCOMPLETE");
  return hits;
}
