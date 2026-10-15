import assert from "node:assert/strict";
import { test } from "node:test";
import { dailyMarketClock, parseNaverDailySnapshot, reconcileDailyChart } from "./daily-reconciliation.ts";
import type { LiveQuote, OhlcBar } from "../../server/naver-market";

const nowPreopen = new Date("2026-10-16T00:17:00+09:00");
const nowOpen = new Date("2026-10-16T10:00:00+09:00");
const bar = (date: string, close = 8450): OhlcBar => ({ date, label: date.slice(5), open: close * 1.1, high: close * 1.2, low: close * .9, close, volume: 100, volumeValid: true, bullish: false });
const actual = parseNaverDailySnapshot([{
  localTradedAt: "2026-10-15", closePrice: "7,770", openPrice: "7,925",
  highPrice: "7,995", lowPrice: "7,660", accumulatedTradingVolume: 705272,
}]);
const reconcile = (values: Partial<Parameters<typeof reconcileDailyChart>[0]> = {}) => reconcileDailyChart({
  code: "0246X0", market: "KOSPI", bars: [bar("2026-10-14")], now: nowPreopen, ...values,
});
const quote = (values: Partial<LiveQuote> = {}): LiveQuote => ({
  code: "0246X0", nameKo: "SOL", nameEn: "SOL", market: "KOSPI", sectorId: "semiconductors",
  price: 7800, change: 30, changePct: .39, volume: 200, volumeValid: true,
  marketCap: 10, high52: 9000, low52: 7000, open: 7900, high: 8000, low: 7600, prevClose: 7770,
  marketStatus: "OPEN", marketSessionType: "regularMarket", tradedAt: "2026-10-16T09:59:00+09:00",
  source: "naver-finance-snapshot", ...values,
});

test("Oct 16 preopen adds actual Oct 15 ETF bar to lagging Oct 14 history without inventing Oct 16", () => {
  const result = reconcile({ latestBars: actual });
  assert.deepEqual(result.bars.map(b => b.date), ["2026-10-14", "2026-10-15"]);
  assert.equal(result.bars.at(-1)?.close, 7770);
  assert.equal(result.bars.at(-1)?.open, 7925);
  assert.equal(result.bars.at(-1)?.high, 7995);
  assert.equal(result.bars.at(-1)?.low, 7660);
  assert.equal(result.bars.at(-1)?.volume, 705272);
  assert.equal(result.freshness.status, "awaiting-session");
  assert.equal(result.freshness.lastActualTradingDate, "2026-10-15");
  assert.match(result.freshness.note, /最近|최근 실제 거래일 2026-10-15/);
});

test("all KOSPI and KOSDAQ stocks use the same actual latest daily feed", () => {
  for (const market of ["KOSPI", "KOSDAQ"] as const) {
    const result = reconcile({ market, code: "005930", latestBars: actual });
    assert.equal(result.bars.at(-1)?.date, "2026-10-15");
  }
});

test("a valid actual current-session candle is appended during KRX regular hours", () => {
  const result = reconcile({ now: nowOpen, quote: quote() });
  assert.equal(result.bars.at(-1)?.date, "2026-10-16");
  assert.equal(result.bars.at(-1)?.close, 7800);
  assert.equal(result.freshness.status, "current-session");
  assert.equal(result.freshness.tradedAt, "2026-10-16T09:59:00+09:00");
});

test("a current price alone cannot fabricate open/high/low or a current bar", () => {
  const result = reconcile({ now: nowOpen, quote: quote({ open: 0, high: 0, low: 0 }) });
  assert.equal(result.bars.at(-1)?.date, "2026-10-14");
  assert.equal(result.freshness.status, "not-current");
});

test("wrong-symbol, undated, future and after-hours quotes do not alter a regular daily candle", () => {
  for (const invalid of [
    quote({ code: "005930" }), quote({ tradedAt: undefined }),
    quote({ tradedAt: "2026-10-16T11:00:00+09:00" }),
    quote({ marketSessionType: "afterMarket" }), quote({ marketSessionType: undefined }),
  ]) assert.equal(reconcile({ now: nowOpen, quote: invalid }).bars.at(-1)?.date, "2026-10-14");
});

test("yesterday's price is never moved to today's candle", () => {
  const result = reconcile({ now: nowOpen, quote: quote({ tradedAt: "2026-10-15T15:30:00+09:00" }) });
  assert.equal(result.bars.at(-1)?.date, "2026-10-14");
});

test("post-close quotes cannot overwrite a completed KRX daily candle despite a stale regular-market label", () => {
  const completed = { ...bar("2026-10-16", 7800), open: 7900, high: 8000, low: 7600, volume: 300 };
  for (const price of [7850, completed.close]) {
    const result = reconcile({
      now: new Date("2026-10-16T20:30:00+09:00"), bars: [completed],
      quote: quote({ tradedAt: "2026-10-16T20:20:25+09:00", price, volume: 400 }),
    });
    assert.equal(result.bars[0]?.close, 7800);
    assert.equal(result.bars[0]?.volume, 300);
    assert.equal(result.freshness.tradedAt, undefined);
  }
});

test("no current-date bar is accepted before actual regular market open or on weekends", () => {
  const preopen = reconcile({ latestBars: [bar("2026-10-16")], quote: quote() });
  assert.equal(preopen.bars.at(-1)?.date, "2026-10-14");
  const weekend = reconcile({ now: new Date("2026-10-17T12:00:00+09:00"), latestBars: [bar("2026-10-17")] });
  assert.equal(weekend.bars.at(-1)?.date, "2026-10-14");
});

test("future or invalid dates, partial OHLC and impossible candles are rejected", () => {
  const result = parseNaverDailySnapshot([
    { localTradedAt: "2026-02-30", closePrice: "10", openPrice: "10", highPrice: "10", lowPrice: "10" },
    { localTradedAt: "2026-10-15", closePrice: "10" },
    { localTradedAt: "2026-10-14", closePrice: "10", openPrice: "10", highPrice: "9", lowPrice: "10" },
  ]);
  assert.deepEqual(result, []);
  assert.equal(reconcile({ latestBars: [bar("2026-10-17")] }).bars.at(-1)?.date, "2026-10-14");
});

test("missing volume is unavailable rather than an observed zero", () => {
  const result = parseNaverDailySnapshot([{ localTradedAt: "2026-10-15", closePrice: 10, openPrice: 10, highPrice: 10, lowPrice: 10 }]);
  assert.equal(result[0]?.volumeValid, false);
});

test("a lagging current-session snapshot does not regress high, low, or cumulative volume", () => {
  const existing = { ...bar("2026-10-16", 7800), open: 7900, high: 8100, low: 7500, volume: 300 };
  const result = reconcile({ now: nowOpen, bars: [existing], quote: quote(), latestBars: [{ ...existing, volume: 200 }] });
  assert.equal(result.bars[0]?.high, 8100);
  assert.equal(result.bars[0]?.low, 7500);
  assert.equal(result.bars[0]?.volume, 300);
});

test("moving averages are recalculated when latest actual bar replaces or extends history", () => {
  const history = [11, 12, 13, 14].map(day => bar(`2026-10-${day}`, 100));
  const result = reconcile({ bars: history, latestBars: [{ ...bar("2026-10-15", 200), ma5: 999 }] });
  assert.equal(result.bars.at(-1)?.ma5, 120);
});

test("New York date and DST are independent from Korea's next calendar day", () => {
  assert.equal(dailyMarketClock("US", nowPreopen).date, "2026-10-15");
  assert.equal(dailyMarketClock("KOSPI", nowPreopen).date, "2026-10-16");
  assert.equal(dailyMarketClock("US", new Date("2026-01-15T14:30:00Z")).minute, 570);
  assert.equal(dailyMarketClock("US", new Date("2026-07-15T13:30:00Z")).minute, 570);
});

test("US adjusted history is not merged with raw KR daily rows or quote prices", () => {
  const result = reconcile({ market: "US", bars: [bar("2026-10-15", 10)], latestBars: actual, quote: quote() });
  assert.equal(result.bars[0]?.close, 10);
  assert.equal(result.freshness.status, "current-session");
  assert.equal(result.freshness.marketDate, "2026-10-15");
});

test("unavailable provider data is explicit rather than a generated last price", () => {
  const result = reconcile({ bars: [] });
  assert.deepEqual(result.bars, []);
  assert.equal(result.freshness.status, "unavailable");
  assert.equal(result.freshness.lastActualTradingDate, null);
});
