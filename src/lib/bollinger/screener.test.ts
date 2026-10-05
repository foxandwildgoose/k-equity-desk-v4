import assert from "node:assert/strict";
import test from "node:test";
import { createBollingerSnapshotCache, DEFAULT_SCREENER_FILTERS, matchesScreener, normalizeScreenerBars, parseScreenerSymbols, rankScreener, snapshotFreshness, type BollingerSnapshot } from "./screener.ts";

const snapshot = (patch: Partial<BollingerSnapshot> = {}): BollingerSnapshot => ({
  symbol: "005930", market: "KR", name: "삼성전자", timeframe: "day", asOf: "2026-10-02", source: "fixture-only",
  fetchedAt: "2026-10-03T00:00:00Z", status: "recent", reason: "test", close: 210, sma200: 200,
  bbw: 12, bbwPercentile: 5, percentB: 1.1, rvol: 1.6, trend: "strong-bullish", setup: "bull-breakout",
  score: 80, coverage: 0.85, flow: { availability: "available", foreignOwnershipChange: 0.3, investmentTrustNet: 123, reason: "fixture-only" }, ...patch,
});
test("screener accepts bounded mixed price symbols, preserves zero-prefixed codes, rejects malformed/large universes", () => {
  assert.deepEqual(parseScreenerSymbols("KR:005930,us:nvda KR:069500 KR:005930"), [{ market: "KR", symbol: "005930" }, { market: "US", symbol: "NVDA" }, { market: "KR", symbol: "069500" }]);
  assert.deepEqual(parseScreenerSymbols("005930 NVDA"), [{ market: "KR", symbol: "005930" }, { market: "US", symbol: "NVDA" }]);
  assert.throws(() => parseScreenerSymbols(""));
  assert.throws(() => parseScreenerSymbols("https://invalid"));
  assert.throws(() => parseScreenerSymbols("KR:005930:extra"));
  assert.throws(() => parseScreenerSymbols(Array.from({ length: 11 }, (_, index) => `KR:${String(index).padStart(6, "0")}`).join(",")));
});
test("screener normalizes descending/ascending dates and corrections before bounded analysis", () => {
  const bars = [{ date: "2026-10-03", close: 3 }, { date: "2026-10-01", close: 1 }, { date: "2026-10-02", close: 2 }, { date: "2026-10-02", close: 22 }];
  assert.deepEqual(normalizeScreenerBars(bars).map(row => row.close), [1, 22, 3]);
  assert.deepEqual(normalizeScreenerBars([...bars].reverse()).map(row => row.close), [1, 2, 3]);
  const long = Array.from({ length: 600 }, (_, index) => ({ date: new Date(Date.UTC(2024, 0, index + 1)).toISOString().slice(0, 10), close: index }));
  assert.equal(normalizeScreenerBars(long).length, 500);
  assert.equal(normalizeScreenerBars(long)[0]?.close, 100);
});
test("each required screener filter independently validates available values", () => {
  for (const key of ["lowBandwidth", "aboveSma200", "highRvol", "upperBreakout", "foreignPositive", "trustPositive"] as const)
    assert.equal(matchesScreener(snapshot(), { ...DEFAULT_SCREENER_FILTERS, [key]: true }), true, key);
  assert.equal(matchesScreener(snapshot({ bbwPercentile: 11 }), { ...DEFAULT_SCREENER_FILTERS, lowBandwidth: true }), false);
  assert.equal(matchesScreener(snapshot({ close: 199 }), { ...DEFAULT_SCREENER_FILTERS, aboveSma200: true }), false);
  assert.equal(matchesScreener(snapshot({ rvol: 1.4 }), { ...DEFAULT_SCREENER_FILTERS, highRvol: true }), false);
  assert.equal(matchesScreener(snapshot({ percentB: 0.99 }), { ...DEFAULT_SCREENER_FILTERS, upperBreakout: true }), false);
  assert.equal(matchesScreener(snapshot(), { ...DEFAULT_SCREENER_FILTERS, trend: "bullish", minScore: 80 }), true);
  assert.equal(matchesScreener(snapshot(), { ...DEFAULT_SCREENER_FILTERS, trend: "bearish" }), false);
  assert.equal(matchesScreener(snapshot({ trend: "strong-bearish" }), { ...DEFAULT_SCREENER_FILTERS, trend: "bearish" }), true);
  assert.equal(matchesScreener(snapshot({ score: 79 }), { ...DEFAULT_SCREENER_FILTERS, minScore: 80 }), false);
});
test("unavailable percentiles/SMA/RVOL/score and KR flow cannot silently match filters", () => {
  assert.equal(matchesScreener(snapshot({ bbwPercentile: null }), { ...DEFAULT_SCREENER_FILTERS, lowBandwidth: true }), false);
  assert.equal(matchesScreener(snapshot({ sma200: null }), { ...DEFAULT_SCREENER_FILTERS, aboveSma200: true }), false);
  assert.equal(matchesScreener(snapshot({ rvol: null }), { ...DEFAULT_SCREENER_FILTERS, highRvol: true }), false);
  assert.equal(matchesScreener(snapshot({ score: null }), { ...DEFAULT_SCREENER_FILTERS, minScore: 1 }), false);
  const us = snapshot({ market: "US", symbol: "NVDA", flow: { availability: "not-applicable", foreignOwnershipChange: null, investmentTrustNet: null, reason: "US" } });
  assert.equal(matchesScreener(us, { ...DEFAULT_SCREENER_FILTERS, foreignPositive: true }), false);
  assert.equal(matchesScreener(us, { ...DEFAULT_SCREENER_FILTERS, trustPositive: true }), false);
  const foreignOnly = snapshot({ flow: { availability: "partial", foreignOwnershipChange: 0.1, investmentTrustNet: null, reason: "partial" } });
  assert.equal(matchesScreener(foreignOnly, { ...DEFAULT_SCREENER_FILTERS, foreignPositive: true }), true);
  assert.equal(matchesScreener(foreignOnly, { ...DEFAULT_SCREENER_FILTERS, trustPositive: true }), false);
  assert.equal(matchesScreener(snapshot({ flow: { availability: "available", foreignOwnershipChange: -0.1, investmentTrustNet: -100, reason: "real selling" } }), { ...DEFAULT_SCREENER_FILTERS, trustPositive: true }), false);
});
test("stale/missing/warmup/error/deferred rows are excluded from current score ranking", () => {
  const rows = [snapshot({ symbol: "000660", score: 70 }), snapshot({ symbol: "005930", score: 80 }),
    ...(["stale", "missing", "warmup", "error", "deferred"] as const).map(status => snapshot({ status, score: 100 }))];
  assert.deepEqual(rankScreener(rows, DEFAULT_SCREENER_FILTERS).map(row => row.symbol), ["005930", "000660"]);
  const now = Date.parse("2026-10-05T00:00:00Z");
  assert.equal(snapshotFreshness("2026-10-02", now), "recent"); // Weekends do not imply missing trade rows.
  assert.equal(snapshotFreshness("2026-09-01", now), "stale");
  assert.equal(snapshotFreshness(null, now), "missing");
  assert.equal(snapshotFreshness("2026-10-20", now), "stale");
});
test("bounded snapshot cache shares in-flight reads, separates keys, respects TTL and preserves deterministic limits", async () => {
  let now = 0, calls = 0;
  const cache = createBollingerSnapshotCache<number>({ ttlMs: 100, maxEntries: 2 }, () => now);
  let release!: (value: number) => void;
  const fetcher = () => { calls++; return new Promise<number>(resolve => { release = resolve; }); };
  const first = cache.load("KR:005930:day:scope-a", fetcher);
  const second = cache.load("KR:005930:day:scope-a", fetcher);
  await Promise.resolve(); release(1);
  assert.deepEqual(await Promise.all([first, second]), [1, 1]); assert.equal(calls, 1);
  assert.equal(await cache.load("KR:005930:day:scope-a", async () => ++calls), 1);
  assert.equal(await cache.load("KR:005930:day:scope-b", async () => ++calls), 2);
  await cache.load("US:NVDA:day:scope-a", async () => ++calls);
  assert.equal(cache.size(), 2); assert.equal(cache.peek("KR:005930:day:scope-a"), undefined);
  now = 100; assert.equal(cache.peek("US:NVDA:day:scope-a"), undefined);
  assert.equal(await cache.load("US:NVDA:day:scope-a", async () => ++calls), 4);
  await assert.rejects(cache.load("failed", async () => { throw new Error("fixture failed"); }));
  assert.equal(cache.peek("failed"), undefined);
  assert.equal(await cache.load("failed", async () => 5), 5);
});
