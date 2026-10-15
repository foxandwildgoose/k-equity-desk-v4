import assert from "node:assert/strict";
import { test } from "node:test";
import { formatQuoteSessionTime, normalizeNaverBasicQuote, normalizeNaverChange, normalizeNaverListingQuote, normalizeNaverPollingQuote, normalizeQuoteOhlc, parseQuoteNumber, parseQuoteTime } from "./quote-normalization.ts";

test("missing and malformed provider values remain missing rather than becoming zero", () => {
  for (const value of [undefined, null, "", " ", "-", "—", "N/A", "12원", "1.2%", "1,2", "0x11", false, [], {}, NaN, Infinity]) assert.equal(parseQuoteNumber(value), null);
  for (const [value, expected] of [[0, 0], ["0.00", 0], ["-24,500", -24500], ["+1,200.5", 1200.5], ["-.50", -.5]] as const) assert.equal(parseQuoteNumber(value), expected);
});

test("falling polling magnitude is negative, including the lower price limit", () => {
  for (const direction of ["4", "5", 4, 5, { code: "5", name: "FALLING" }]) {
    assert.deepEqual(normalizeNaverChange({ price: 900, change: 100, changePct: 10, direction }), { change: -100, changePct: -10, prevClose: 1000 });
  }
});

test("rising polling magnitude remains positive, including the upper price limit", () => {
  for (const direction of ["1", "2", 1, 2, { name: "RISING" }]) {
    assert.deepEqual(normalizeNaverChange({ price: 1100, change: 100, changePct: 10, direction }), { change: 100, changePct: 10, prevClose: 1000 });
  }
});

test("signed basic falls are not double-negated", () => {
  assert.deepEqual(normalizeNaverChange({ price: "900", change: "-100", changePct: "-10.00", direction: { code: "5" } }), { change: -100, changePct: -10, prevClose: 1000 });
});

test("only actual zero change establishes an unchanged quote", () => {
  assert.deepEqual(normalizeNaverChange({ price: 1000, change: 0, changePct: 0, direction: "3" }), { change: 0, changePct: 0, prevClose: 1000 });
  assert.equal(normalizeNaverChange({ price: 1000 }), null);
  assert.equal(normalizeNaverChange({ price: 1000, changePct: 0 }), null);
  assert.equal(normalizeNaverChange({ price: 1000, change: 5, changePct: 0, direction: "3" }), null);
  assert.equal(normalizeNaverChange({ price: 1000, change: 0, changePct: 0, direction: "5" }), null);
  assert.equal(normalizeNaverChange({ price: 1100, change: 100, changePct: 10, direction: "9" }), null);
});

test("independent previous close establishes direction when the code is absent", () => {
  assert.deepEqual(normalizeNaverChange({ price: 900, change: 100, changePct: 10, previousClose: 1000 }), { change: -100, changePct: -10, prevClose: 1000 });
  assert.deepEqual(normalizeNaverChange({ price: 900, previousClose: 1000 }), { change: -100, changePct: -10, prevClose: 1000 });
});

test("percentage rounding is accepted without changing the published percentage", () => {
  const quote = normalizeNaverChange({ price: 207500, change: -24500, changePct: -10.56, direction: { code: "5" } });
  assert.deepEqual(quote, { change: -24500, changePct: -10.56, prevClose: 232000 });
  assert.deepEqual(normalizeNaverChange({ price: 100001, change: 1, changePct: 0, direction: "2" }), { change: 1, changePct: 0, prevClose: 100000 });
});

test("mixed-session, impossible and contradictory quotes are rejected", () => {
  for (const input of [
    { price: 0, change: 1 }, { price: "N/A", change: 0 },
    { price: 100, change: 100 },
    { price: 1100, change: -100, changePct: -10, direction: "2" },
    { price: 900, change: 100, changePct: 1, direction: "5" },
    { price: 900, change: 100, changePct: 10, direction: "2", previousClose: 1000 },
    { price: 900, change: 50, changePct: 10, direction: "5", previousClose: 1000 },
  ]) assert.equal(normalizeNaverChange(input), null);
});

const polling = { cd: "005930", nm: "삼성전자", nv: 207500, cv: 24500, cr: 10.56, rf: "5", pcv: 232000, aq: 1234, aa: 950000000000, ms: "CLOSE" };

test("SERVICE_ITEM adapter repairs the all-positive sector regression at its source", () => {
  const result = normalizeNaverPollingQuote(polling)!;
  assert.equal(result.price, 207500);
  assert.equal(result.change, -24500);
  assert.equal(result.changePct, -10.56);
  assert.equal(result.prevClose, 232000);
  assert.equal(result.volume, 1234);
});

test("unsigned polling without a direction or previous close is unavailable", () => {
  assert.equal(normalizeNaverPollingQuote({ ...polling, rf: undefined, pcv: undefined }), null);
  assert.equal(normalizeNaverPollingQuote({ ...polling, nv: "-" }), null);
  assert.equal(normalizeNaverPollingQuote({ ...polling, cv: undefined, pcv: undefined }), null);
});

test("accumulated turnover is never reused as market capitalisation", () => {
  assert.equal(normalizeNaverPollingQuote(polling)!.marketCap, null);
  assert.equal(normalizeNaverPollingQuote({ ...polling, countOfListedStock: 1000000 })!.marketCap, 2075);
});

test("zero volume is valid, missing volume is unknown", () => {
  assert.equal(normalizeNaverPollingQuote({ ...polling, aq: 0 })!.volume, 0);
  assert.equal(normalizeNaverPollingQuote({ ...polling, aq: undefined })!.volume, null);
  assert.equal(normalizeNaverPollingQuote({ ...polling, aq: -1 })!.volume, null);
});

test("provider polling response time is not a stock's trading time", () => {
  assert.equal(normalizeNaverPollingQuote({ ...polling, time: 1792076400000 })!.tradedAt, undefined);
  assert.equal(normalizeNaverPollingQuote({ ...polling, localTradedAt: "2026-10-15T15:30:00+09:00" })!.tradedAt, "2026-10-15T15:30:00+09:00");
});

test("SERVICE_INDEX scales only points, retains percentage, and applies direction", () => {
  const index = normalizeNaverPollingQuote({ cd: "KOSPI", nv: 555422, cv: 45459, cr: 7.57, rf: "5", pcv: 600881, ov: 580000 }, true)!;
  assert.equal(index.price, 5554.22);
  assert.equal(index.change, -454.59);
  assert.equal(index.changePct, -7.57);
  assert.equal(index.open, 5800);
});

// Reduced actual public /basic response captured 2026-10-15 through verified TLS.
const basic = { itemCode: "005930", reutersCode: "005930", stockName: "삼성전자", closePrice: "207,500", compareToPreviousClosePrice: "-24,500", compareToPreviousPrice: { code: "5", text: "하락", name: "FALLING" }, fluctuationsRatio: "-10.56", marketStatus: "CLOSE", localTradedAt: "2026-10-15T20:20:22+09:00" };

test("mobile basic adapter retains the provider's negative return and previous-session time", () => {
  const quote = normalizeNaverBasicQuote(basic, "005930")!;
  assert.equal(quote.changePct, -10.56);
  assert.equal(quote.change, -24500);
  assert.equal(quote.prevClose, 232000);
  assert.equal(quote.tradedAt, basic.localTradedAt);
  assert.equal(quote.marketStatus, "CLOSE");
  assert.equal(quote.volume, null);
  assert.equal(quote.marketCap, null);
  assert.equal(quote.open, null);
});

test("mobile basic rejects the wrong security and missing required observations", () => {
  assert.equal(normalizeNaverBasicQuote(basic, "000660"), null);
  assert.equal(normalizeNaverBasicQuote({ ...basic, closePrice: "" }, "005930"), null);
  assert.equal(normalizeNaverBasicQuote({ ...basic, compareToPreviousClosePrice: undefined, fluctuationsRatio: undefined }, "005930"), null);
});

test("basic detail info supplies observed OHLC and zero trading volume", () => {
  const result = normalizeNaverBasicQuote({ ...basic, stockItemTotalInfos: [{ code: "openPrice", value: "209,000" }, { code: "highPrice", value: "210,000" }, { code: "lowPrice", value: "205,000" }, { code: "accumulatedTradingVolume", value: "0" }] }, "005930")!;
  assert.deepEqual([result.open, result.high, result.low, result.volume], [209000, 210000, 205000, 0]);
});

test("after-hours return is normalized independently and never substitutes the regular session", () => {
  const result = normalizeNaverBasicQuote({ ...basic, overMarketPriceInfo: { overPrice: "207,000", compareToPreviousClosePrice: "25,000", fluctuationsRatio: "10.78", compareToPreviousPrice: { code: "5" } } }, "005930")!;
  assert.equal(result.price, 207500);
  assert.equal(result.changePct, -10.56);
  assert.deepEqual([result.afterHoursPrice, result.afterHoursChange, result.afterHoursChangePct], [207000, -25000, -10.78]);
});

test("index basic fallback uses the same signed contract", () => {
  const result = normalizeNaverBasicQuote({ itemCode: "KOSPI", closePrice: "5,554.22", compareToPreviousClosePrice: "-454.59", compareToPreviousPrice: { code: "5" }, fluctuationsRatio: "-7.57", localTradedAt: "2026-10-15T20:15:00+09:00", marketStatus: "CLOSE" }, "KOSPI")!;
  assert.equal(result.price, 5554.22);
  assert.equal(result.changePct, -7.57);
  assert.equal(result.tradedAt, "2026-10-15T20:15:00+09:00");
});

test("provider times require date and zone, with explicit Korea handling for local dates", () => {
  assert.equal(parseQuoteTime("2026-10-15T15:30:00+09:00"), "2026-10-15T15:30:00+09:00");
  assert.equal(parseQuoteTime("20261015153000"), "2026-10-15T15:30:00+09:00");
  assert.equal(parseQuoteTime("2026-10-15 15:30:00"), "2026-10-15T15:30:00+09:00");
  for (const time of [null, undefined, "15:30:00", "2026-10-15", "N/A", "", "2026-13-15T15:30:00+09:00", "2026-02-30T15:30:00+09:00", "2026-10-15T24:00:00+09:00"]) assert.equal(parseQuoteTime(time), undefined);
});

test("daily and minute bars use the exchange calendar across UTC date boundaries", () => {
  const korea = Date.parse("2026-10-14T15:30:00Z") / 1000;
  assert.equal(formatQuoteSessionTime(korea, "Asia/Seoul"), "2026-10-15");
  assert.equal(formatQuoteSessionTime(korea, "Asia/Seoul", true), "2026-10-15 00:30");
  const us = Date.parse("2026-10-16T00:30:00Z") / 1000;
  assert.equal(formatQuoteSessionTime(us, "America/New_York"), "2026-10-15");
  assert.equal(formatQuoteSessionTime(us, "America/New_York", true), "2026-10-15 20:30");
  const winter = Date.parse("2026-12-15T01:30:00Z") / 1000;
  assert.equal(formatQuoteSessionTime(winter, "America/New_York", true), "2026-12-14 20:30");
  assert.equal(formatQuoteSessionTime(NaN, "Asia/Seoul"), undefined);
  assert.equal(formatQuoteSessionTime(us, "invalid-zone"), undefined);
});

test("close-only, zero and malformed candles cannot fabricate OHLC", () => {
  for (const values of [
    { open: null, high: null, low: null, close: 100 },
    { open: "null", high: "0", low: "-", close: 100 },
    { open: 100, high: 99, low: 95, close: 98 },
    { open: 100, high: 110, low: 105, close: 108 },
    { open: NaN, high: 110, low: 90, close: 100 },
    { open: 0, high: 110, low: 90, close: 100 },
  ]) assert.equal(normalizeQuoteOhlc(values), null);
  assert.deepEqual(normalizeQuoteOhlc({ open: "100", high: "110", low: "90", close: "105" }), { open: 100, high: 110, low: 90, close: 105 });
});

test("actual dated domestic listing retains same-row volume and KRW capitalisation", () => {
  const row = { ...basic, stockEndType: "stock", accumulatedTradingVolume: "33,002,824", marketValue: "12,131,028", marketValueRaw: "1213102811160000", accumulatedTradingValueRaw: "6976758000000" };
  const quote = normalizeNaverListingQuote(row)!;
  assert.equal(quote.price, 207500);
  assert.equal(quote.changePct, -10.56);
  assert.equal(quote.volume, 33002824);
  assert.equal(quote.marketCap, 12131028.1116);
  assert.equal(quote.tradedAt, basic.localTradedAt);
  assert.equal(quote.open, null, "an undated integration price is not imported");
  assert.equal(normalizeNaverListingQuote({ ...row, localTradedAt: undefined }), null);
  assert.equal(normalizeNaverListingQuote({ ...row, marketValue: "1,234" }), null);
  assert.equal(normalizeNaverListingQuote({ ...row, stockEndType: "etn" }), null);
  assert.equal(normalizeNaverListingQuote({ ...row, stockExchangeType: { name: "KOSPI" } })!.market, "KOSPI");
});
