import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chartLayoutScope,
  existingUsChartSecurity,
  parseChartSymbols,
  parseNaverChartSecurity,
  parseYahooChartSecurity,
  sameChartPriceBasis,
} from "./security.ts";

const listing = (code: string, instrument: string, name: string) => ({
  itemCode: code,
  stockName: name,
  stockEndType: instrument,
  stockExchangeType: { nationCode: "KOR", nameEng: "KOSPI" },
});

test("overseas-underlying Korean ETF keeps KR listing identity and its own share units", () => {
  const security = parseNaverChartSecurity("360750", listing("360750", "etf", "TIGER 미국S&P500"));
  assert.equal(security?.instrument, "etf");
  assert.equal(security?.market, "KR");
  assert.equal(security?.exchange, "KOSPI");
  assert.equal(security?.currency, "KRW");
  assert.equal(security?.quantityUnit, "주");
});

test("valid alphabetic ETF codes survive direct entry and metadata parsing", () => {
  assert.deepEqual(parseChartSymbols("KR:0226a0,KR:A12345,US:NVDA"), [
    "KR:0226A0",
    "KR:A12345",
    "US:NVDA",
  ]);
  assert.equal(
    parseNaverChartSecurity("0226A0", listing("0226A0", "etf", "PLUS SK하이닉스샌디스크채권혼합50"))
      ?.instrument,
    "etf",
  );
});

test("identity requires provider fields, not product names or code patterns", () => {
  assert.equal(
    parseNaverChartSecurity("005930", listing("005930", "stock", "ETF named company"))?.instrument,
    "stock",
  );
  assert.equal(parseNaverChartSecurity("0226A0", listing("0226A0", "unknown", "TIGER 미국")), null);
  assert.equal(parseNaverChartSecurity("005930", listing("360750", "etf", "stale symbol")), null);
  assert.equal(
    parseNaverChartSecurity("005930", {
      ...listing("005930", "stock", "x"),
      stockExchangeType: { nationCode: "USA", nameEng: "KOSPI" },
    }),
    null,
  );
});

test("detail/fullscreen share scope while workspace cell scopes stay separate", () => {
  assert.equal(chartLayoutScope("detail"), "detail");
  assert.notEqual(chartLayoutScope("workspace", 0), chartLayoutScope("workspace", 1));
  assert.notEqual(chartLayoutScope("detail"), chartLayoutScope("workspace", 0));
});

test("existing overseas ETFs retain listing market and share units; US stocks stay stocks", () => {
  const etf = existingUsChartSecurity("BOTZ", ["BOTZ", "ROBO"]);
  assert.equal(etf.instrument, "etf");
  assert.equal(etf.market, "US");
  assert.equal(etf.currency, "USD");
  assert.equal(etf.quantityUnit, "주");
  assert.equal(existingUsChartSecurity("NVDA", ["BOTZ", "ROBO"]).instrument, "stock");
});

test("Yahoo explicit instrument metadata identifies other supported US ETFs without name inference", () => {
  const etf = {
    symbol: "SPY",
    instrumentType: "ETF",
    currency: "USD",
    exchangeName: "PCX",
    longName: "SPDR S&P 500 ETF Trust",
  };
  assert.equal(parseYahooChartSecurity("SPY", etf)?.instrument, "etf");
  assert.equal(parseYahooChartSecurity("SPY", etf)?.exchange, "PCX");
  assert.equal(
    parseYahooChartSecurity("NVDA", { ...etf, symbol: "NVDA", instrumentType: "EQUITY" })
      ?.instrument,
    "stock",
  );
  assert.equal(parseYahooChartSecurity("SPY", { ...etf, currency: "CAD" }), null);
  assert.equal(parseYahooChartSecurity("SPY", { ...etf, instrumentType: undefined }), null);
  assert.equal(parseYahooChartSecurity("BOTZ", etf), null);
});

test("only documented matching endpoint price bases share warmup/daily history", () => {
  assert.equal(sameChartPriceBasis("yahoo-360750.KS", "yahoo-360750.KS"), true);
  assert.equal(sameChartPriceBasis("yahoo-us-BOTZ-1wk", "yahoo-us-BOTZ-1d"), true);
  assert.equal(sameChartPriceBasis("yahoo-us-BOTZ-1wk", "yahoo-us-NVDA-1d"), false);
  assert.equal(sameChartPriceBasis("naver-fchart-week", "naver-fchart-day"), false);
  assert.equal(sameChartPriceBasis("yahoo-005930.KS", "naver-fchart-day"), false);
});
