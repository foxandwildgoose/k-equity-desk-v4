import assert from "node:assert/strict";
import { test } from "node:test";
import type { LiveQuote, OhlcBar } from "../server/naver-market.ts";
import {
  isAvailableStockQuote,
  observedRangePosition,
  stockQuotePresentation,
  tradeMetrics,
} from "./trade-metrics.ts";

const quote: LiveQuote = {
  code: "005930",
  nameKo: "삼성전자",
  nameEn: "Samsung",
  sectorId: "semiconductors",
  market: "KOSPI",
  price: 100,
  change: -5,
  changePct: (-5 / 105) * 100,
  prevClose: 105,
  open: 105,
  high: 110,
  low: 90,
  high52: 150,
  low52: 80,
  volume: 2_000,
  volumeValid: true,
  marketCap: 1_000,
  marketCapValid: true,
  changeValid: true,
  previousCloseValid: true,
  marketStatus: "OPEN",
  marketSessionType: "regularMarket",
  tradedAt: "2026-10-16T10:00:00+09:00",
  source: "naver-finance-snapshot",
};

function priorBars(count: number): OhlcBar[] {
  const result: OhlcBar[] = [];
  const date = new Date("2026-10-16T00:00:00Z");
  while (result.length < count) {
    date.setUTCDate(date.getUTCDate() - 1);
    if ([0, 6].includes(date.getUTCDay())) continue;
    result.unshift({
      date: date.toISOString().slice(0, 10),
      label: "",
      open: 100,
      high: 110,
      low: 90,
      close: 100,
      volume: 1_000,
      volumeValid: true,
      bullish: true,
    });
  }
  return result;
}

test("missing OHLC carriers never produce a -100% gap or invented 50% range position", () => {
  const metrics = tradeMetrics({ ...quote, open: 0, high: 0, low: 0 });
  assert.equal(metrics.gapPct, null);
  assert.equal(metrics.dayRange, null);
  assert.equal(metrics.dayRangePct, null);
  assert.equal(metrics.open, null);
  assert.equal(metrics.price, 100);
});

test("unknown previous close and change do not become a fabricated prior close", () => {
  assert.equal(tradeMetrics({ ...quote, prevClose: 0, change: 0, changeValid: false }).prev, null);
  const metrics = tradeMetrics({ ...quote, previousCloseValid: false });
  assert.equal(metrics.prev, null);
  assert.equal(metrics.gapPct, null);
  assert.equal(tradeMetrics({ ...quote, prevClose: 0 }).prev, 105);
});

test("range pointers require a finite positive price and a non-flat enclosing range", () => {
  assert.equal(observedRangePosition(0, 110, 90), null);
  assert.equal(observedRangePosition(Number.NaN, 110, 90), null);
  assert.equal(observedRangePosition(100, 100, 100), null);
  assert.equal(observedRangePosition(120, 110, 90), null);
  assert.equal(observedRangePosition(100, 110, 90), 50);
  assert.equal(observedRangePosition(90, 110, 90), 0);
});

test("missing and nonfinite stock quotes stay unavailable while a verified flat quote remains valid", () => {
  const flat = { price: 100, change: 0, changePct: 0 };
  assert.equal(isAvailableStockQuote(flat), true);
  assert.equal(isAvailableStockQuote({ ...flat, quoteAvailable: false }), false);
  assert.equal(isAvailableStockQuote({ ...flat, price: 0 }), false);
  assert.equal(isAvailableStockQuote({ ...flat, changePct: Number.NaN }), false);
  assert.equal(isAvailableStockQuote({ ...flat, change: Number.POSITIVE_INFINITY }), false);
});

test("RVOL requires twenty actual prior daily volume observations and excludes today's bar", () => {
  const today = { ...priorBars(1)[0]!, date: "2026-10-16", volume: 1_000_000 };
  assert.equal(tradeMetrics(quote, [...priorBars(19), today]).rvol, null);
  assert.equal(tradeMetrics(quote, priorBars(20)).rvol, 2);
  assert.equal(tradeMetrics(quote, [...priorBars(20), today]).rvol, 2);
});

test("RVOL never silently skips invalid volume days or uses missing quote volume", () => {
  const bars = priorBars(21);
  bars[bars.length - 1]!.volumeValid = false;
  assert.equal(tradeMetrics(quote, bars).rvol, null);
  assert.equal(tradeMetrics({ ...quote, volume: 0, volumeValid: false }, priorBars(20)).rvol, null);
  assert.equal(tradeMetrics({ ...quote, volume: 0, volumeValid: true }, priorBars(20)).rvol, 0);
  assert.equal(tradeMetrics({ ...quote, tradedAt: undefined }, priorBars(20)).rvol, null);
  assert.equal(
    tradeMetrics(
      quote,
      priorBars(20).map((bar) => ({ ...bar, volume: 0 })),
    ).rvol,
    null,
  );
});

test("invalid and duplicate dates cannot manufacture a twenty-day sample", () => {
  const bars = priorBars(20);
  bars[0] = { ...bars[1]! };
  assert.equal(tradeMetrics(quote, bars).rvol, null);
  bars[0] = { ...bars[1]!, date: "2026-02-30" };
  assert.equal(tradeMetrics(quote, bars).rvol, null);
});

test("a historical twenty-session chart cannot masquerade as today's RVOL denominator", () => {
  const old = priorBars(21).slice(0, -1);
  assert.equal(old.length, 20);
  assert.equal(tradeMetrics(quote, old).rvol, null);
});

test("ATR and moving-average comparisons reject missing price rows and invalid averages", () => {
  const bars = priorBars(15);
  assert.equal(tradeMetrics(quote, bars).atr14, 20);
  bars[bars.length - 1] = { ...bars.at(-1)!, close: 0, ma20: 0, ma60: 0 };
  const missing = tradeMetrics(quote, bars);
  assert.equal(missing.atr14, null);
  assert.equal(missing.maBias, null);
  assert.equal(tradeMetrics({ ...quote, price: 0, high52: 150, low52: 80 }).fromHigh52, null);
  assert.equal(tradeMetrics({ ...quote, price: Number.NaN }, priorBars(15)).atrPct, null);
});

test("LIVE requires a connected stream and this security's fresh verified KIS trade", () => {
  const now = Date.parse("2026-10-16T10:00:10+09:00");
  const kis = { ...quote, source: "kis-krx-websocket" as const };
  assert.equal(stockQuotePresentation(quote, true, now).isLive, false);
  assert.equal(stockQuotePresentation(kis, false, now).isLive, false);
  assert.equal(stockQuotePresentation(kis, true, now).isLive, true);
  const old = stockQuotePresentation(
    { ...kis, tradedAt: "2026-10-15T10:00:00+09:00", fetchedAt: new Date(now).toISOString() },
    true,
    now,
  );
  assert.equal(old.isLive, false);
  assert.equal(old.freshness?.status, "stale");
  const undated = stockQuotePresentation({ ...quote, tradedAt: undefined }, true, now);
  assert.equal(undated.isLive, false);
  assert.equal(undated.canDisplay, false);
  assert.equal(
    stockQuotePresentation({ ...kis, tradedAt: "2026-10-19T10:00:00+09:00" }, true, now).canDisplay,
    false,
  );
});


test("after-hours volume cannot be compared with regular-session historical volume", () => {
  const afterHours = { ...quote, marketSessionType: "afterMarket", tradedAt: "2026-10-16T20:20:22+09:00", volume: 33_002_824 };
  const previous = priorBars(20);
  assert.equal(tradeMetrics(afterHours, previous).rvol, null);
  const current = { ...previous.at(-1)!, date: "2026-10-16", volume: 56_671_284 };
  assert.equal(tradeMetrics(afterHours, [...previous, current]).rvol, 56_671.284);
  assert.equal(tradeMetrics(afterHours, [...previous, { ...current, volumeValid: false }]).rvol, null);
  assert.equal(tradeMetrics({ ...quote, marketSessionType: undefined }, previous).rvol, null);
});
