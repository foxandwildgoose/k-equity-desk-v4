import assert from "node:assert/strict";
import { test } from "node:test";
import { expectedKrSessionDate, isValidMarketQuote, marketQuoteMovers, providerQuoteTime, quoteCoverage, quoteFreshness, selectMarketQuotes, type TimedMarketQuote } from "./market-freshness.ts";

// Explicit regression fixtures: these are not a production market-data source.
const openNow = Date.parse("2026-10-16T10:30:00+09:00");
const preopenNow = Date.parse("2026-10-16T08:00:00+09:00");
function quote(code: string, changePct: number, overrides: Partial<TimedMarketQuote> = {}): TimedMarketQuote {
  return { code, price: 10000, change: changePct * 100, changePct, tradedAt: "2026-10-16 10:29:00", marketStatus: "OPEN", ...overrides };
}

test("provider-local and offset timestamps refer to the same KST observation", () => {
  const expected = Date.parse("2026-10-16T01:29:00Z");
  for (const value of ["2026-10-16 10:29:00", "2026-10-16T10:29:00+09:00", "20261016 102900", "2026-10-16T01:29:00Z"]) assert.equal(providerQuoteTime(value), expected, value);
  for (const value of [undefined, "", "2026-10-16", "10:29:00", "2026-02-30 10:29:00", "2026-10-16 24:00:00", "invalid"]) assert.equal(providerQuoteTime(value), null, String(value));
});

test("preopen and weekends accept the dated previous weekday; Monday open requires Monday", () => {
  assert.equal(expectedKrSessionDate(preopenNow), "2026-10-15");
  assert.equal(expectedKrSessionDate(Date.parse("2026-10-17T12:00:00+09:00")), "2026-10-16");
  assert.equal(expectedKrSessionDate(Date.parse("2026-10-18T12:00:00+09:00")), "2026-10-16");
  assert.equal(expectedKrSessionDate(Date.parse("2026-10-19T08:59:00+09:00")), "2026-10-16");
  assert.equal(expectedKrSessionDate(Date.parse("2026-10-19T09:00:00+09:00")), "2026-10-19");
  const previousClose = quote("005930", -4, { tradedAt: "2026-10-15 15:30:00", marketStatus: "CLOSE" });
  assert.equal(quoteFreshness(previousClose, preopenNow).status, "closed");
  assert.equal(quoteFreshness(previousClose, preopenNow).sessionDate, "2026-10-15");
  assert.equal(quoteFreshness(previousClose, openNow).status, "stale");
});

test("fetching an old observation now does not change its provider time or freshness", () => {
  const old = quote("005930", 13.84, { tradedAt: "2026-10-15 15:30:00", fetchedAt: new Date(openNow).toISOString() });
  assert.equal(quoteFreshness(old, openNow).reason, "different-session");
  assert.equal(quoteFreshness(old, openNow).asOf, "2026-10-15T06:30:00.000Z");
  assert.equal(quoteCoverage([old], ["005930"], openNow).avgChangePct, null);
});

test("missing, malformed and future provider times cannot become a current aggregate", () => {
  for (const tradedAt of [undefined, "", "2026-10-16", "not-a-date"]) {
    const coverage = quoteCoverage([quote("005930", 8, { tradedAt })], ["005930"], openNow);
    assert.equal(coverage.avgChangePct, null);
    assert.equal(coverage.missingTimeCount, 1);
    assert.equal(coverage.status, "unavailable");
  }
  assert.equal(quoteFreshness(quote("005930", 8, { tradedAt: "2026-10-16 10:32:00" }), openNow).reason, "future-provider-time");
  assert.equal(quoteFreshness(quote("005930", 8, { tradedAt: "2026-10-16 10:14:59" }), openNow).reason, "old-intraday-observation");
});

test("actual declines stay negative; all-declining quotes produce no fake gainers", () => {
  const rows = [quote("005930", -4), quote("000660", -6), quote("042700", -2)];
  const coverage = quoteCoverage(rows, rows.map((row) => row.code), openNow);
  assert(Math.abs(coverage.avgChangePct! + 4) < 1e-12);
  assert.equal(coverage.count, 3);
  assert.equal(coverage.status, "fresh");
  assert.equal(coverage.basis, "equal-weight-coverage");
  assert.deepEqual(marketQuoteMovers(rows, 6, openNow).gainers, []);
  assert.deepEqual(marketQuoteMovers(rows, 2, openNow).losers.map((row) => row.changePct), [-6, -4]);
});

test("mixed signs, genuine zero and all-positive rankings remain distinct", () => {
  const rows = [quote("005930", -4), quote("000660", 2), quote("042700", 0)];
  assert.equal(quoteCoverage(rows, rows.map((row) => row.code), openNow).avgChangePct, -2 / 3);
  const movers = marketQuoteMovers(rows, 6, openNow);
  assert.deepEqual(movers.gainers.map((row) => row.changePct), [2]);
  assert.deepEqual(movers.losers.map((row) => row.changePct), [-4]);
  assert.deepEqual(marketQuoteMovers([quote("005930", 3), quote("000660", 2)], 6, openNow).losers, []);
  assert.equal(quoteCoverage([quote("005930", 0)], ["005930"], openNow).avgChangePct, 0);
});

test("empty quotes mean unavailable rather than an invented flat market", () => {
  const coverage = quoteCoverage([], ["005930", "000660"], openNow);
  assert.equal(coverage.avgChangePct, null);
  assert.equal(coverage.count, 0);
  assert.equal(coverage.missingCount, 2);
  assert.equal(coverage.expectedCount, 2);
  assert.equal(coverage.asOf, null);
  assert.equal(coverage.status, "unavailable");
  assert.deepEqual(marketQuoteMovers([], 6, openNow), { gainers: [], losers: [] });
});

test("partial coverage separates missing, stale, invalid and undated observations", () => {
  const rows = [
    quote("005930", -5),
    quote("000660", 13, { tradedAt: "2026-10-15 15:30:00" }),
    quote("042700", 0, { changeValid: false }),
    quote("240810", 8, { tradedAt: undefined }),
    quote("OUTSIDE", 30),
  ];
  const coverage = quoteCoverage(rows, ["005930", "000660", "042700", "240810", "058470"], openNow);
  assert.equal(coverage.avgChangePct, -5);
  assert.equal(coverage.expectedCount, 5);
  assert.equal(coverage.count, 1);
  assert.equal(coverage.missingCount, 1);
  assert.equal(coverage.staleCount, 1);
  assert.equal(coverage.invalidCount, 1);
  assert.equal(coverage.missingTimeCount, 1);
  assert.equal(coverage.status, "partial");
  assert.equal(coverage.oldestAsOf, "2026-10-16T01:29:00.000Z");
  assert.equal(coverage.oldestObservedAsOf, "2026-10-15T06:30:00.000Z");
});

test("NaN, infinity, zero-price carriers and explicitly invalid changes do not enter statistics", () => {
  const invalid = [quote("1", NaN), quote("2", Infinity), quote("3", 2, { price: 0 }), quote("4", 0, { changeValid: false }), quote("5", 2, { change: NaN })];
  assert(invalid.every((row) => !isValidMarketQuote(row)));
  const result = selectMarketQuotes(invalid, openNow);
  assert.equal(result.quotes.length, 0);
  assert.equal(result.invalidCount, invalid.length);
  assert.equal(result.status, "unavailable");
});

test("duplicate codes contribute once and the latest provider observation wins", () => {
  const rows = [quote("005930", 13.84, { tradedAt: "2026-10-15 15:30:00" }), quote("005930", -4), quote("000660", -2), quote("000660", -2)];
  const result = quoteCoverage(rows, ["005930", "000660"], openNow);
  assert.equal(result.count, 2);
  assert.equal(result.duplicateCount, 2);
  assert.equal(result.avgChangePct, -3);
  assert.equal(result.expectedCount, 2);
  assert.equal(result.missingCount, 0);
});

test("partial or missing coverage is not advertised as a complete closed-session aggregate", () => {
  const rows = [quote("005930", -4, { tradedAt: "2026-10-15 15:30:00", marketStatus: "CLOSE" })];
  const result = quoteCoverage(rows, ["005930", "000660"], preopenNow);
  assert.equal(result.status, "partial");
  assert.equal(result.closedCount, 1);
  assert.equal(result.freshCount, 0);
  assert.equal(result.sessionDate, "2026-10-15");
  assert.equal(quoteFreshness(quote("005930", 8, { tradedAt: "2026-10-15 14:00:00" }), preopenNow).reason, "closing-observation-unconfirmed");
});
