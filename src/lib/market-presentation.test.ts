import assert from "node:assert/strict";
import { test } from "node:test";
import { selectMarketQuotes, type TimedMarketQuote } from "./market-freshness.ts";
import { coverageLabel, preopenMarketSnapshot } from "./market-presentation.ts";

// Explicit regression fixtures, never used as production market observations.
const now = Date.parse("2026-10-23T08:44:02+09:00");
const preopen: TimedMarketQuote = {
  code: "005930", price: 10000, change: 0, changePct: 0, changeValid: true,
  tradedAt: "2026-10-23T08:44:02+09:00", marketStatus: "PREOPEN",
};

test("a dated same-day preopen snapshot is described without inventing regular-session returns", () => {
  const selected = selectMarketQuotes([preopen], now);
  assert.equal(selected.count, 0);
  assert.equal(selected.staleCount, 1);
  assert.equal(preopenMarketSnapshot(selected.all, now)?.count, 1);
  assert.match(coverageLabel(selected, now), /장전 집계 대기/);
  assert.match(coverageLabel(selected, now), /08:44/);
  assert.equal(selected.quotes.length, 0);
});

test("a verified previous closing observation remains recent-trading-day coverage", () => {
  const previous = { ...preopen, tradedAt: "2026-10-22T15:30:00+09:00", marketStatus: "CLOSE", change: -100, changePct: -1 };
  const selected = selectMarketQuotes([previous, { ...preopen, code: "000660" }], now);
  assert.equal(selected.count, 1);
  assert.equal(selected.quotes[0].changePct, -1);
  assert.doesNotMatch(coverageLabel(selected, now), /장전 집계 대기/);
  assert.match(coverageLabel(selectMarketQuotes([previous], now), now), /최근 거래일/);
});

test("preopen presentation requires provider status, positive price and a same-day nonfuture timestamp", () => {
  for (const patch of [
    { marketStatus: "OPEN" }, { marketStatus: "CLOSE" }, { marketStatus: undefined },
    { price: 0 }, { price: NaN }, { code: "" }, { tradedAt: undefined },
    { tradedAt: "2026-10-23" }, { tradedAt: "2026-10-22T08:44:02+09:00" },
    { tradedAt: "2026-10-23T08:46:03+09:00" },
  ]) assert.equal(preopenMarketSnapshot([{ ...preopen, ...patch }], now), null, JSON.stringify(patch));
  assert.equal(preopenMarketSnapshot([], now), null);
  assert.equal(preopenMarketSnapshot([preopen], NaN), null);
});

test("preopen messaging stops at regular-session start and never masks weekend observations", () => {
  assert.equal(preopenMarketSnapshot([preopen], Date.parse("2026-10-23T09:00:00+09:00")), null);
  const saturday = { ...preopen, tradedAt: "2026-10-24T08:44:02+09:00" };
  assert.equal(preopenMarketSnapshot([saturday], Date.parse(saturday.tradedAt)), null);
  assert.doesNotMatch(coverageLabel(selectMarketQuotes([], now), now), /장전/);
});
