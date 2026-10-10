import assert from "node:assert/strict";
import { test } from "node:test";
import { createSecuritySearchEngine, matchesSecurityQuery, mergeSearchRows } from "./security-search-engine.ts";
import { parseKrSearchListing, parseNasdaqSearchDirectory, parseNaverAutocomplete, parseNaverDesktopSearch, parseNaverSearchEtfs, parseYahooSecuritySearch } from "./security-search-parse.ts";
import { normalizeSearchUsSymbol, searchSecurityKey, type ListedSearchHit } from "../lib/security-search.ts";

const hit = (code: string, nameKo = code, extras: Partial<ListedSearchHit> = {}): ListedSearchHit => ({ code, nameKo, nameEn: nameKo, region: "KR", market: "KOSPI", sectorId: "electronics", isEtf: false, source: "naver-listing", ...extras });
const local = hit("005930", "삼성전자", { nameEn: "Samsung Electronics", sectorId: "semiconductors", source: "universe" });
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json; charset=utf-8" } });
const nasdaq = "Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares\nAAPL|Apple Inc.|Q|N|N|100|N|N\nNVDA|NVIDIA Corp.|Q|N|N|100|N|N\nQQQ|Invesco QQQ Trust|G|N|N|100|Y|N\nTEST|Test Only|G|Y|N|100|N|N\nFile Creation Time: 1010202610:00|||||||\n";
const other = "ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol\nBRK.B|Berkshire Hathaway Class B|N|BRK.B|N|100|N|BRK.B\nBRK.A|Berkshire Hathaway Class A|N|BRK.A|N|100|N|BRK.A\nSPY|SPDR S&P 500 Trust|P|SPY|Y|100|N|SPY\nFile Creation Time: 1010202610:00|||||||\n";
const stock = (index: number, market = "KOSPI") => ({ itemCode: String(index + (market === "KOSDAQ" ? 400000 : 100000)).padStart(6, "0"), stockName: `삼성 QA ${String(index).padStart(3, "0")}`, stockEndType: "stock" });
const listing = (market: string, count: number, page: number) => ({ totalCount: count, stocks: Array.from({ length: Math.max(0, Math.min(100, count - (page - 1) * 100)) }, (_, i) => stock((page - 1) * 100 + i, market)) });
function providerFetch(options: { count?: number; kosdaqCount?: number; failPage?: number; repeatPage?: number; override?: (url: URL) => Response | undefined } = {}) {
  const calls: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = new URL(String(input)); calls.push(url.href);
    const replaced = options.override?.(url);
    if (replaced) return replaced;
    if (url.pathname.includes("marketValue")) {
      const market = url.pathname.split("/").at(-1)!, page = Number(url.searchParams.get("page"));
      if (page === options.failPage && market === "KOSPI") return new Response("unavailable", { status: 503 });
      return json(listing(market, market === "KOSPI" ? options.count ?? 150 : options.kosdaqCount ?? 1, page === options.repeatPage && market === "KOSPI" ? 1 : page));
    }
    if (url.hostname === "finance.naver.com") return json({ result: { etfItemList: [{ itemcode: "0226A0", itemname: "KODEX 삼성 QA" }] } });
    if (url.hostname === "www.nasdaqtrader.com") return new Response(url.pathname.includes("nasdaqlisted") ? nasdaq : other);
    if (url.hostname === "query1.finance.yahoo.com") return json({ quotes: [{ symbol: "AAPL", longname: "Apple Inc.", exchange: "NMS", quoteType: "EQUITY" }] });
    if (url.hostname === "ac.stock.naver.com") return json({ items: [[ ["삼성전자", "005930", "KOSPI"] ]] });
    if (url.hostname === "m.stock.naver.com") return json({ result: { items: [{ code: "005930", name: "삼성전자", nationCode: "KOR", typeCode: "KOSPI", isEtf: false }] } });
    throw new Error("Unexpected fixed provider URL");
  }) as typeof fetch;
  return { fetcher, calls };
}

test("KR provider mapping preserves KOSDAQ, preferred shares, explicit stock type and ETF codes", () => {
  const rows = parseNaverAutocomplete({ result: { items: [
    { code: "005930", name: "삼성전자", nationCode: "KOR", typeCode: "KOSPI", isEtf: false },
    { code: "005935", name: "삼성전자우", nationCode: "KOR", typeName: "코스피" },
    { code: "403870", name: "HPSP", nationCode: "KOR", typeName: "코스닥" },
    { code: "0226A0", name: "KODEX 반도체", nationCode: "KOR", typeName: "ETF", isEtf: true },
    { code: "123456", name: "TIGER 이름의 일반 기업", nationCode: "KOR", typeCode: "KOSDAQ", isEtf: false },
    { code: "100001", name: "QA ETN", nationCode: "KOR", typeName: "KOSPI ETN" },
    { code: "600519", name: "Shanghai stock", nationCode: "CHN", typeCode: "SSE" },
    { code: "999999", name: "No verified market", nationCode: "KOR" },
  ] } });
  assert.deepEqual(rows.map(row => [row.code, row.market, row.region, row.isEtf]), [["005930", "KOSPI", "KR", false], ["005935", "KOSPI", "KR", false], ["403870", "KOSDAQ", "KR", false], ["0226A0", "KOSPI", "KR", true], ["123456", "KOSDAQ", "KR", false]]);
  assert.throws(() => parseNaverAutocomplete({ return_code: 1, return_msg: "provider failure" }), /SCHEMA/);
});

test("Naver US search removes Reuters exchange suffix but preserves class A and B", () => {
  const rows = parseNaverAutocomplete({ result: { items: [
    { code: "AAPL", reutersCode: "AAPL.O", name: "애플", nationCode: "USA", typeCode: "NASDAQ" },
    { code: "APLE", reutersCode: "APLE.K", name: "Apple Hospitality REIT", nationCode: "USA", typeCode: "NYSE" },
    { code: "BRK.A", reutersCode: "BRK.A.N", name: "Berkshire Class A", nationCode: "USA", typeCode: "NYSE" },
    { code: "GOOGL", name: "Alphabet", nationCode: "USA", typeCode: "NASDAQ" },
  ] } });
  assert.deepEqual(rows.map(row => [row.code, row.region, row.market]), [["AAPL", "US", "NASDAQ"], ["APLE", "US", "NYSE"], ["BRK-A", "US", "NYSE"], ["GOOGL", "US", "NASDAQ"]]);
});

test("desktop autocomplete tuple parsing requires a real six-character code and exchange", () => {
  assert.deepEqual(parseNaverDesktopSearch({ items: [[ ["삼성전자", "005930", "코스피"], ["삼성 QA", "0333A0", "코스닥"], ["Unknown exchange", "999999", ""], ["Index", "KOSPI", "코스피"] ]] }).map(row => row.code), ["005930", "0333A0"]);
  assert.throws(() => parseNaverDesktopSearch({ items: null }), /SCHEMA/);
});

test("KR directory validates rows and tracks unsupported instruments without routing them as equities", () => {
  const listing = parseKrSearchListing({ totalCount: 3, stocks: [{ itemCode: "005930", stockName: "삼성전자", stockEndType: "stock" }, { itemCode: "0226A0", stockName: "KODEX QA", stockEndType: "etf" }, { itemCode: "500001", stockName: "QA ETN", stockEndType: "etn" }] }, "KOSPI");
  assert.equal(listing.total, 3); assert.equal(listing.identities.length, 3); assert.equal(listing.rows.length, 2); assert.equal(listing.rows[1]!.isEtf, true);
  assert.throws(() => parseKrSearchListing({ totalCount: "1", stocks: [] }, "KOSPI"), /SCHEMA/);
  assert.throws(() => parseKrSearchListing({ totalCount: 1, stocks: [{ itemCode: "../../", stockName: "bad" }] }, "KOSPI"), /SCHEMA/);
  assert.equal(parseNaverSearchEtfs({ result: { etfItemList: [{ itemcode: "0226A0", itemname: "KODEX QA" }] } })[0]!.code, "0226A0");
});

test("Yahoo maps only US equity and ETF exchanges, not crypto, indices, mutual funds or foreign stocks", () => {
  const rows = parseYahooSecuritySearch({ quotes: [
    { symbol: "AAPL", longname: "Apple Inc.", exchange: "NMS", quoteType: "EQUITY" },
    { symbol: "BRK.B", shortname: "Berkshire B", exchange: "NYQ", quoteType: "EQUITY" },
    { symbol: "SPY", shortname: "SPDR", exchange: "PCX", quoteType: "ETF" },
    { symbol: "005930.KS", shortname: "Samsung", exchange: "KSC", quoteType: "EQUITY" },
    { symbol: "VOD.L", shortname: "Vodafone", exchange: "LSE", quoteType: "EQUITY" },
    { symbol: "^GSPC", shortname: "S&P500", exchange: "SNP", quoteType: "INDEX" },
    { symbol: "BTC-USD", shortname: "Bitcoin", exchange: "CCC", quoteType: "CRYPTOCURRENCY" },
    { symbol: "VTSAX", shortname: "Fund", exchange: "NAS", quoteType: "MUTUALFUND" },
    { symbol: "ABC", shortname: "Unconfirmed exchange", exchange: "", quoteType: "EQUITY" },
  ] });
  assert.deepEqual(rows.map(row => [row.code, row.market, row.isEtf]), [["AAPL", "NASDAQ", false], ["BRK-B", "NYSE", false], ["SPY", "US", true]]);
});

test("official Nasdaq directory headers/footer, test securities and class shares are handled", () => {
  assert.deepEqual(parseNasdaqSearchDirectory(nasdaq, "nasdaq").map(row => [row.code, row.isEtf]), [["AAPL", false], ["NVDA", false], ["QQQ", true]]);
  assert.deepEqual(parseNasdaqSearchDirectory(other, "other").map(row => [row.code, row.market]), [["BRK-B", "NYSE"], ["BRK-A", "NYSE"], ["SPY", "US"]]);
  assert.throws(() => parseNasdaqSearchDirectory(nasdaq.split("File Creation")[0]!, "nasdaq"), /INCOMPLETE/);
  assert.throws(() => parseNasdaqSearchDirectory("Symbol|Security Name\nABC|QA", "nasdaq"), /SCHEMA/);
});

test("US identities normalize safely without padding or losing class shares", () => {
  for (const code of ["AAPL", "GOOGL", "ABCDEF", "BRK.A", "BRK-B"]) assert.ok(normalizeSearchUsSymbol(code));
  assert.equal(normalizeSearchUsSymbol("brk.a"), "BRK-A");
  for (const code of ["005930", "ABC-", "BRK..B", "http://example.com", "^GSPC", "애플", "A/B"]) assert.equal(normalizeSearchUsSymbol(code), null);
  assert.notEqual(searchSecurityKey(hit("ABCDEF")), searchSecurityKey(hit("ABCDEF", "US QA", { region: "US", market: "US" })));
});

test("search name/code matching and market-qualified merge preserve curated metadata", () => {
  assert.equal(matchesSecurityQuery("F", hit("F", "Ford", { market: "US", region: "US" })), true);
  assert.equal(matchesSecurityQuery("삼", local), true);
  assert.equal(matchesSecurityQuery("삼성 바이오", hit("207940", "삼성바이오로직스")), true);
  assert.equal(matchesSecurityQuery(" ", local), false);
  const merged = mergeSearchRows("삼성", [[local], [hit("005930", "삼성전자"), hit("005935", "삼성전자우"), hit("207940", "삼성바이오로직스")]]);
  assert.equal(merged.length, 3); assert.equal(merged.find(row => row.code === "005930")!.nameEn, "Samsung Electronics");
  assert.equal(merged.find(row => row.code === "005930")!.sectorId, "semiconductors");
});

test("full KR listings beyond the first page reach paged search; no 24-result cap", async () => {
  const { fetcher, calls } = providerFetch({ count: 250, kosdaqCount: 105 });
  const search = createSecuritySearchEngine({ localRows: [local], fetcher });
  const first = await search("삼성", 0, 40);
  assert.equal(first.status, "ready"); assert.equal(first.total, 357); assert.equal(first.hits.length, 40); assert.equal(first.nextOffset, 40);
  const rest = await search("삼성", 320, 100);
  assert.equal(rest.hits.length, 37); assert.equal(rest.nextOffset, null); assert.equal(rest.hasMore, false);
  assert.equal(calls.filter(url => url.includes("marketValue/KOSPI")).length, 3);
  assert.equal(calls.filter(url => url.includes("marketValue/KOSDAQ")).length, 2);
  assert.equal(new Set([...first.hits, ...rest.hits].map(searchSecurityKey)).size, 77);
});

test("all US directory rows can be found by English name or ticker and retain source exchange", async () => {
  const { fetcher } = providerFetch();
  const search = createSecuritySearchEngine({ localRows: [local], fetcher });
  const result = await search("Berkshire");
  assert.equal(result.total, 2); assert.deepEqual(result.hits.map(row => row.code).sort(), ["BRK-A", "BRK-B"]);
  assert.ok(result.hits.every(row => row.region === "US" && row.market === "NYSE"));
  const single = await search("QQQ"); assert.equal(single.hits[0]!.isEtf, true); assert.equal(single.hits[0]!.region, "US");
});

test("unavailable and malformed providers remain visible; invented six-digit entries are forbidden", async () => {
  const search = createSecuritySearchEngine({ localRows: [local], fetcher: (async () => json({ providerError: "not a listing" })) as typeof fetch });
  const samsung = await search("삼성"); assert.equal(samsung.status, "unavailable"); assert.equal(samsung.total, 1); assert.equal(samsung.providers.length, 8);
  const missing = await search("999999"); assert.equal(missing.total, 0); assert.deepEqual(missing.hits, []);
  assert.ok(missing.providers.every(row => row.status === "unavailable"));
  assert.equal(JSON.stringify(missing).includes("providerError"), false);
});

test("partial and repeated listing pages cannot establish complete coverage", async () => {
  const { fetcher } = providerFetch({ count: 200, repeatPage: 2 });
  const search = createSecuritySearchEngine({ localRows: [], fetcher });
  const result = await search("삼성");
  assert.equal(result.status, "partial"); assert.equal(result.providers.find(row => row.id === "kr-listing-kospi")!.status, "partial");
  assert.equal(result.providers.find(row => row.id === "kr-listing-kospi")!.count, 100);
});

test("partial collection resumes only missing pages, then exposes full search coverage", async () => {
  let stamp = Date.parse("2026-10-10T00:00:00Z"), failing = true;
  const { fetcher, calls } = providerFetch({ count: 250, override: url => url.pathname.endsWith("KOSPI") && url.searchParams.get("page") === "2" && failing ? new Response("bad", { status: 503 }) : undefined });
  const search = createSecuritySearchEngine({ localRows: [], fetcher, now: () => stamp });
  const partial = await search("삼성"); assert.equal(partial.status, "partial"); assert.equal(partial.providers.find(row => row.id === "kr-listing-kospi")!.count, 150);
  stamp += 31_000; failing = false;
  const complete = await search("삼성"); assert.equal(complete.status, "ready"); assert.equal(complete.providers.find(row => row.id === "kr-listing-kospi")!.count, 250);
  assert.equal(calls.filter(url => url.includes("marketValue/KOSPI?page=1")).length, 1);
  assert.equal(calls.filter(url => url.includes("marketValue/KOSPI?page=2")).length, 2);
  assert.equal(calls.filter(url => url.includes("marketValue/KOSPI?page=3")).length, 1);
});

test("membership total changes invalidate the checkpoint rather than mixing incompatible listings", async () => {
  let stamp = Date.parse("2026-10-10T00:00:00Z"), changing = true;
  const { fetcher } = providerFetch({ count: 200, override: url => url.pathname.endsWith("KOSPI") && url.searchParams.get("page") === "2" && changing ? json(listing("KOSPI", 201, 2)) : undefined });
  const search = createSecuritySearchEngine({ localRows: [], fetcher, now: () => stamp });
  assert.equal((await search("삼성")).status, "partial");
  stamp += 31_000; changing = false;
  const second = await search("삼성"); assert.equal(second.status, "ready"); assert.equal(second.providers.find(row => row.id === "kr-listing-kospi")!.count, 200);
});

test("concurrent callers and repeated paging share lookup work; different queries share the directory", async () => {
  const { fetcher, calls } = providerFetch();
  const search = createSecuritySearchEngine({ localRows: [], fetcher });
  const [a, b] = await Promise.all([search("삼성", 0, 40), search("삼성", 40, 40)]);
  assert.equal(a.total, b.total); assert.equal(calls.length, 9);
  await search("Apple");
  assert.equal(calls.length, 12); // only the three query providers run again
  assert.equal(calls.filter(url => url.includes("nasdaqtrader")).length, 2);
});

test("one query caller's cancellation is not attached to shared provider authentication or market lookup", async () => {
  const { fetcher } = providerFetch();
  let resolveFirst!: () => void;
  const barrier = new Promise<void>(resolve => { resolveFirst = resolve; });
  const guarded = (async (input: string | URL | Request, init?: RequestInit) => { await barrier; assert.equal(init?.signal?.aborted, false); return fetcher(input, init); }) as typeof fetch;
  const search = createSecuritySearchEngine({ localRows: [], fetcher: guarded });
  const a = search("삼성"), b = search("삼성"); resolveFirst();
  const results = await Promise.all([a, b]); assert.equal(results[0]!.total, results[1]!.total); assert.equal(results[0]!.status, "ready");
});

test("blank search performs no provider calls and paging is bounded", async () => {
  const { fetcher, calls } = providerFetch();
  const search = createSecuritySearchEngine({ localRows: [], fetcher });
  assert.equal((await search(" ")).total, 0); assert.equal(calls.length, 0);
  const result = await search("삼성", -3, 500); assert.equal(result.offset, 0); assert.equal(result.limit, 100); assert.equal(result.hits.length, 100);
});

test("listing ETNs do not block directory completeness and are not routed as stocks", async () => {
  const { fetcher } = providerFetch({ count: 1, override: url => url.pathname.endsWith("KOSPI") ? json({ totalCount: 1, stocks: [{ itemCode: "500001", stockName: "삼성 ETN QA", stockEndType: "etn" }] }) : undefined });
  const search = createSecuritySearchEngine({ localRows: [], fetcher });
  const result = await search("삼성"); assert.equal(result.status, "ready"); assert.equal(result.hits.some(row => row.code === "500001"), false);
});

test("failed directory refresh retains the last confirmed listing for subsequent queries", async () => {
  let stamp = Date.parse("2026-10-10T00:00:00Z"), fail = false;
  const { fetcher } = providerFetch({ override: url => fail && url.pathname.includes("marketValue") ? new Response("bad", { status: 503 }) : undefined });
  const search = createSecuritySearchEngine({ localRows: [], fetcher, now: () => stamp });
  assert.equal((await search("삼성")).status, "ready");
  stamp += 7 * 60 * 60_000; fail = true;
  const first = await search("삼성");
  assert.equal(first.status, "partial"); assert.equal(first.providers.find(row => row.id === "kr-listing-kospi")!.count, 150);
  const second = await search("삼성 QA 149");
  assert.equal(second.total, 1); assert.equal(second.hits[0]!.code, "100149"); assert.equal(second.status, "partial");
});

test("explicit directory asset types replace autocomplete name heuristics", () => {
  const rows = mergeSearchRows("QA", [[hit("123456", "TIGER QA 일반 기업", { isEtf: true, source: "naver-autocomplete" })], [hit("123456", "TIGER QA 일반 기업", { isEtf: false, source: "naver-listing", market: "KOSDAQ" })]]);
  assert.equal(rows[0]!.isEtf, false); assert.equal(rows[0]!.market, "KOSDAQ");
});

test("public provider timeouts are bounded and return safe unavailable status", async () => {
  const hanging = (async (_input: string | URL | Request, init?: RequestInit) => await new Promise<Response>((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("test provider fallback timer")), 500);
    init?.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("provider timeout")); }, { once: true });
  })) as typeof fetch;
  const search = createSecuritySearchEngine({ localRows: [local], fetcher: hanging, budgetMs: 50 });
  const started = Date.now(), result = await search("삼성");
  assert.ok(Date.now() - started < 400); assert.equal(result.status, "unavailable"); assert.equal(result.hits[0]!.code, "005930");
  assert.equal(JSON.stringify(result).includes("provider timeout"), false);
});

test("charset-less desktop ETF EUC-KR is decoded without corrupting Korean names", async () => {
  const { fetcher } = providerFetch({ override: url => url.hostname === "finance.naver.com" ? new Response(Buffer.concat([Buffer.from('{"result":{"etfItemList":[{"itemcode":"0226A0","itemname":"KODEX '), Buffer.from([0xbb, 0xef, 0xbc, 0xba]), Buffer.from('"}]}}')]), { headers: { "content-type": "application/json" } }) : undefined });
  const search = createSecuritySearchEngine({ localRows: [], fetcher });
  const result = await search("0226A0");
  assert.equal(result.hits.find(row => row.code === "0226A0")!.nameKo, "KODEX 삼성"); assert.equal(result.status, "ready");
});

test("translated Naver name results survive English queries only when the actual echoed query matches", async () => {
  const payload = { result: { query: "Apple", items: [{ code: "AAPL", name: "애플", nationCode: "USA", typeCode: "NASDAQ", reutersCode: "AAPL.O" }, { code: "APLE", name: "Apple Hospitality REIT Inc", nationCode: "USA", typeCode: "NYSE", reutersCode: "APLE.K" }] } };
  const rows = parseNaverAutocomplete(payload);
  assert.deepEqual(mergeSearchRows("Apple", [rows]).map(row => row.code), ["AAPL", "APLE"]);
  assert.deepEqual(mergeSearchRows("apple", [rows]).map(row => row.code), ["AAPL", "APLE"]);
  assert.equal(mergeSearchRows("Microsoft", [rows]).length, 0);
  const search = createSecuritySearchEngine({ localRows: [], fetcher: (async input => new URL(String(input)).pathname.includes("autoComplete") ? json(payload) : new Response("unavailable", { status: 503 })) as typeof fetch });
  const apple = await search("Apple"); assert.deepEqual(apple.hits.map(row => row.code), ["AAPL", "APLE"]); assert.equal(apple.status, "partial");
  const microsoft = await search("Microsoft"); assert.equal(microsoft.total, 0); assert.equal(microsoft.hits.length, 0);
});

test("exact ticker and company-name matches outrank provider synonym matches", () => {
  const rows = parseNaverAutocomplete({ result: { query: "Apple", items: [{ code: "AAPL", name: "애플", nationCode: "USA", typeCode: "NASDAQ" }] } });
  const exactName = hit("APPL", "Apple", { market: "US", region: "US" });
  assert.equal(mergeSearchRows("Apple", [[exactName], rows])[0]!.code, "APPL");
  const misleading = { ...rows[0]!, providerRank: -100000 };
  assert.equal(mergeSearchRows("Apple", [[exactName], [misleading]])[0]!.code, "APPL");
});
