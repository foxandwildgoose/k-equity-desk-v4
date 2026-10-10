import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListedSearchHit, SecuritySearchPage } from "./security-search.ts";
import {
  currentSearchPages,
  loadRecentSecurities,
  mergeSecuritySearchHits,
  parseRecentSecurities,
  saveRecentSecurity,
  securityIdentity,
  securityMarketLabel,
  securitySearchDestination,
} from "./security-search-ui.ts";

function hit(code: string, nameKo = code, extra: Partial<ListedSearchHit> = {}): ListedSearchHit {
  return { code, nameKo, nameEn: nameKo, market: "KOSPI", region: "KR", sectorId: "electronics", isEtf: false, source: "universe", ...extra };
}
function page(q: string, hits: ListedSearchHit[]): SecuritySearchPage {
  return { q, hits, total: hits.length, offset: 0, limit: 40, nextOffset: null, hasMore: false, fetchedAt: "2026-10-10T00:00:00.000Z", source: "test", status: "ready", providers: [] };
}

test("current pages never display the previous query during debounce or a late response", () => {
  const samsung = page("삼성", [hit("005930", "삼성전자")]);
  const apple = page("Apple", [hit("AAPL", "Apple", { region: "US", market: "NASDAQ" })]);
  assert.deepEqual(currentSearchPages([samsung], "Apple"), []);
  assert.deepEqual(currentSearchPages([samsung, apple], " Apple "), [apple]);
  assert.deepEqual(currentSearchPages([apple], ""), []);
});

test("merge globally ranks exact tickers, retains ETF results beyond the first 20 stocks and deduplicates identity", () => {
  const stocks = Array.from({ length: 28 }, (_, index) => hit(String(index).padStart(6, "0"), `삼성 계열 ${index}`));
  const etf = hit("069500", "KODEX 삼성그룹", { isEtf: true, source: "naver-etf" });
  const rows = mergeSecuritySearchHits("삼성", stocks, [etf, { ...stocks[0]!, source: "naver-listing" }]);
  assert.equal(rows.length, 29);
  assert.ok(rows.some((row) => row.isEtf));
  assert.equal(rows.filter((row) => row.code === "000000").length, 1);
  const exact = mergeSecuritySearchHits("069500", stocks, [etf]);
  assert.equal(exact[0]?.code, "069500");
});

test("KR and US identities cannot collide while remote canonical metadata wins", () => {
  const kr = hit("ABCDEF", "국내 ETF", { isEtf: true });
  const us = hit("ABCDEF", "US company", { region: "US", market: "NASDAQ", source: "nasdaq-directory" });
  assert.notEqual(securityIdentity(kr), securityIdentity(us));
  assert.equal(mergeSecuritySearchHits("ABCDEF", [kr], [us]).length, 2);
  const rows = mergeSecuritySearchHits("삼성", [hit("005930", "삼성전자", { nameEn: "Samsung Electronics" })], [hit("005930", "삼성전자", { source: "naver-autocomplete" })]);
  assert.equal(rows[0]?.nameEn, "Samsung Electronics");
  assert.equal(rows[0]?.source, "naver-autocomplete");
});

test("a provider's current echoed query preserves translated company matches without honoring stale metadata", () => {
  const apple = hit("AAPL", "애플", { region: "US", market: "NASDAQ", nameEn: "애플", source: "naver-autocomplete", matchedQuery: "Apple", providerRank: 0 });
  const hospitality = hit("APLE", "Apple Hospitality REIT", { region: "US", market: "NYSE", source: "naver-autocomplete", matchedQuery: "Apple", providerRank: 1 });
  assert.equal(mergeSecuritySearchHits(" Apple ", [], [hospitality, apple])[0]?.code, "AAPL");
  const microsoft = hit("MSFT", "Microsoft", { region: "US", market: "NASDAQ" });
  assert.equal(mergeSecuritySearchHits("Microsoft", [], [apple, microsoft])[0]?.code, "MSFT");
  assert.equal(mergeSecuritySearchHits("APLE", [], [hospitality, apple])[0]?.code, "APLE");
  const parsed = parseRecentSecurities(JSON.stringify([apple]));
  assert.equal(parsed[0]?.matchedQuery, undefined);
  assert.equal(parsed[0]?.providerRank, undefined);
});

test("destinations keep US share classes separate from Korean ticker normalization", () => {
  assert.deepEqual(securitySearchDestination(hit("005930", "삼성전자")).params, { ticker: "005930" });
  assert.equal(securitySearchDestination(hit("069500", "KODEX 200", { isEtf: true })).to, "/etfs/$code");
  assert.deepEqual(securitySearchDestination(hit("1032A0", "국내 신규 주식", { isEtf: false })).params, { ticker: "1032A0" });
  assert.equal(securitySearchDestination(hit("1032A0", "국내 신규 주식", { isEtf: false })).to, "/stock/$ticker");
  assert.deepEqual(securitySearchDestination(hit("aapl", "Apple", { region: "US", market: "NASDAQ" })).params, { symbol: "AAPL" });
  assert.deepEqual(securitySearchDestination(hit("BRK-B", "Berkshire", { region: "US", market: "NYSE" })).params, { symbol: "BRK-B" });
  assert.deepEqual(securitySearchDestination(hit("BRK.B", "Berkshire", { region: "US", market: "NYSE" })).params, { symbol: "BRK.B" });
  assert.equal(securitySearchDestination(hit("SPY", "SPDR S&P 500", { region: "US", market: "AMEX", isEtf: true })).to, "/us/$symbol");
});

test("recent migration validates legacy entries and rejects corrupt codes, routes and market conflicts", () => {
  const legacy = { ...hit("005930", "삼성전자"), region: undefined };
  const validUs = hit("AAPL", "Apple", { region: "US", market: "NASDAQ", source: "us-universe" });
  const data = JSON.stringify([
    null, legacy, legacy, validUs,
    { ...validUs, region: "KR" },
    { ...validUs, code: "../../api/admin" },
    { ...legacy, market: "unknown" },
    { ...legacy, isEtf: "false" },
  ]);
  const recent = parseRecentSecurities(data);
  assert.equal(recent.length, 2);
  assert.deepEqual(recent.map(securityIdentity), ["KR:005930", "US:AAPL"]);
  assert.deepEqual(parseRecentSecurities("broken"), []);
  assert.deepEqual(parseRecentSecurities('{"code":"005930"}'), []);
});

test("storage denial does not throw or change the valid navigation target", () => {
  const entry = hit("005930", "삼성전자");
  const denied = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); } };
  assert.deepEqual(loadRecentSecurities(denied), []);
  assert.equal(saveRecentSecurity(entry, denied), false);
  assert.equal(securitySearchDestination(entry).to, "/stock/$ticker");
});

test("recent selection is most recent first, idempotent, capped and labels distinguish markets", () => {
  let saved: string | null = null;
  const storage = { getItem() { return saved; }, setItem(_key: string, value: string) { saved = value; } };
  for (let index = 0; index < 12; index++) assert.equal(saveRecentSecurity(hit(String(index).padStart(6, "0")), storage), true);
  const selected = hit("000010", "Ten");
  assert.equal(saveRecentSecurity(selected, storage), true);
  const entries = loadRecentSecurities(storage);
  assert.equal(entries.length, 8);
  assert.equal(entries[0]?.code, "000010");
  assert.equal(entries.filter((entry) => entry.code === "000010").length, 1);
  assert.equal(securityMarketLabel(hit("005930")), "코스피");
  assert.equal(securityMarketLabel(hit("403870", "HPSP", { market: "KOSDAQ" })), "코스닥");
  assert.equal(securityMarketLabel(hit("AAPL", "Apple", { region: "US", market: "NASDAQ" })), "미국 · NASDAQ");
});
