import test from "node:test";
import assert from "node:assert/strict";
import { computeBollingerPatterns, confirmedSwingLevelHistory, confirmedSwingLevels } from "./patterns.ts";
import { DEFAULT_BOLLINGER_SYSTEM_CONFIG } from "./config.ts";
import type { BollingerBar, BollingerSystemSettings } from "./types.ts";

const settings: BollingerSystemSettings = {
  ...DEFAULT_BOLLINGER_SYSTEM_CONFIG,
  pivotLeft: 1, pivotRight: 1, patternMaxBars: 20, patternTolerance: 0.03,
};

function barsFromLows(lows: number[]): BollingerBar[] {
  return lows.map((low, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`, low, high: low + 2, open: low + 1, close: low + 1, volume: 100, completed: true,
  }));
}
const wBars = barsFromLows([105, 102, 100, 104, 110, 106, 99, 103, 108, 111, 115]);
const wB = [0.5, 0.3, -0.1, 0.4, 0.9, 0.5, 0.3, 0.6, 0.8, 0.9, 1.2];
const mirror = (bars: readonly BollingerBar[]) => bars.map(bar => ({ ...bar, low: 200 - bar.high, high: 200 - bar.low, open: 200 - bar.open, close: 200 - bar.close }));

test("W setup and %B bullish divergence wait for right-side confirmation; structural close break is separate", () => {
  assert.deepEqual(computeBollingerPatterns(wBars.slice(0, 7), wB.slice(0, 7), settings), []);
  const setup = computeBollingerPatterns(wBars.slice(0, 8), wB.slice(0, 8), settings);
  assert.deepEqual(setup.map(item => item.type), ["bullish-divergence", "w-setup"]);
  for (const item of setup) {
    assert.equal(item.index, 7); assert.equal(item.date, "2026-01-08");
    assert.equal(item.pivotIndex, 6); assert.equal(item.pivotDate, "2026-01-07"); assert.equal(item.stage, 1);
  }
  const all = computeBollingerPatterns(wBars, wB, settings);
  assert.deepEqual(all.map(item => item.type), ["bullish-divergence", "w-setup", "w-confirmed"]);
  assert.equal(all.at(-1)!.index, 10); assert.equal(all.at(-1)!.stage, 2);
  assert.equal(all.at(-1)!.pivotIndex, 6);
});

test("M top and bearish %B divergence are the exact price/%B mirror", () => {
  const events = computeBollingerPatterns(mirror(wBars), wB.map(value => 1 - value), settings);
  assert.deepEqual(events.map(item => item.type), ["bearish-divergence", "m-setup", "m-confirmed"]);
  assert.deepEqual(events.map(item => item.index), [7, 7, 10]);
  assert.ok(events.every(item => item.direction === "bearish" && item.pivotIndex === 6));
});

test("all historical events and swing levels are prefix invariant with no future-bar leakage", () => {
  const all = computeBollingerPatterns(wBars, wB, settings);
  const levels = confirmedSwingLevelHistory(wBars, settings.pivotLeft, settings.pivotRight);
  for (let count = 0; count <= wBars.length; count++) {
    assert.deepEqual(computeBollingerPatterns(wBars.slice(0, count), wB.slice(0, count), settings), all.filter(item => item.index < count), `prefix ${count}`);
    assert.deepEqual(confirmedSwingLevelHistory(wBars.slice(0, count), 1, 1), levels.slice(0, count));
  }
  const changedFuture = [...wBars.slice(0, 8), ...barsFromLows([1e8, 2e8, 1e8]).map((bar, i) => ({ ...bar, date: wBars[i + 8]!.date }))];
  assert.deepEqual(computeBollingerPatterns(changedFuture, wB, settings).filter(item => item.index < 8), all.filter(item => item.index < 8));
  assert.deepEqual(confirmedSwingLevels(wBars, 1, 1, 6), { high: 112, low: 100 });
  assert.deepEqual(confirmedSwingLevels(wBars, 1, 1, 7), { high: 112, low: 99 });
});

test("unfinished or invalid confirmation bars cannot confirm pivots, patterns or structural breaks", () => {
  const unfinishedPivot = wBars.slice(0, 8).map((bar, i) => i === 7 ? { ...bar, completed: false } : bar);
  assert.deepEqual(computeBollingerPatterns(unfinishedPivot, wB, settings), []);
  assert.equal(confirmedSwingLevels(unfinishedPivot, 1, 1).low, 100);
  const unfinishedBreak = wBars.map((bar, i) => i === 10 ? { ...bar, completed: false } : bar);
  assert.equal(computeBollingerPatterns(unfinishedBreak, wB, settings).some(item => item.type === "w-confirmed"), false);
  const gap = wBars.map((bar, i) => i === 5 ? { ...bar, close: NaN } : bar);
  assert.deepEqual(computeBollingerPatterns(gap, wB, settings), []);
  const malformed = wBars.map((bar, i) => i === 7 ? { ...bar, high: bar.low - 1 } : bar);
  assert.deepEqual(computeBollingerPatterns(malformed, wB, settings), []);
  const unknownCompletion = wBars.map(bar => ({ ...bar, completed: undefined }));
  assert.deepEqual(computeBollingerPatterns(unknownCompletion, wB, settings), []);
  assert.deepEqual(confirmedSwingLevelHistory(unknownCompletion, 1, 1), unknownCompletion.map(() => ({ high: null, low: null })));
  const unknownPivot = wBars.map((bar, i) => i === 6 ? { ...bar, completed: undefined } : bar);
  assert.deepEqual(computeBollingerPatterns(unknownPivot, wB, settings), []);
});

test("configured confirmation delay is respected and no hindsight pivot-date signal is emitted", () => {
  const config = { ...settings, pivotRight: 2 };
  const events = computeBollingerPatterns(wBars, wB, config);
  assert.equal(events.find(item => item.type === "w-setup")!.index, 8);
  assert.equal(events.find(item => item.type === "bullish-divergence")!.index, 8);
  for (let count = 0; count <= wBars.length; count++) {
    assert.deepEqual(computeBollingerPatterns(wBars.slice(0, count), wB, config), events.filter(item => item.index < count));
  }
});

test("strict divergence preserves unclipped %B; equal price or equal %B is not divergence", () => {
  const equalPrices = wBars.map((bar, i) => i === 6 ? { ...bar, low: 100, high: 102, open: 101, close: 101 } : bar);
  assert.ok(computeBollingerPatterns(equalPrices, wB, settings).some(item => item.type === "w-setup"));
  assert.ok(!computeBollingerPatterns(equalPrices, wB, settings).some(item => item.type === "bullish-divergence"));
  const equalB = wB.map((value, i) => i === 6 ? -0.1 : value);
  assert.deepEqual(computeBollingerPatterns(wBars, equalB, settings), []);
  for (const value of [null, NaN, Infinity]) {
    const missingB = wB.map((v, i) => i === 6 ? value : v);
    assert.deepEqual(computeBollingerPatterns(wBars, missingB, settings), []);
  }
  const insideFirst = wB.map((v, i) => i === 2 ? 0.1 : v);
  const divergenceOnly = computeBollingerPatterns(wBars, insideFirst, settings);
  assert.deepEqual(divergenceOnly.map(item => item.type), ["bullish-divergence"]);
});

test("no plateau fake setups; max span, retest tolerance and invalid settings are enforced", () => {
  const flat = barsFromLows(Array(20).fill(100));
  assert.deepEqual(computeBollingerPatterns(flat, Array.from({ length: 20 }, (_, i) => i / 20), settings), []);
  assert.deepEqual(computeBollingerPatterns(wBars, wB, { ...settings, patternMaxBars: 3 }), []);
  assert.deepEqual(computeBollingerPatterns(wBars, wB, { ...settings, patternTolerance: 0.005 }).map(item => item.type), ["bullish-divergence"]);
  for (const invalid of [{ pivotLeft: 0 }, { pivotRight: -1 }, { pivotLeft: 1.5 }, { patternMaxBars: 0 }, { patternTolerance: NaN }]) {
    assert.deepEqual(computeBollingerPatterns(wBars, wB, { ...settings, ...invalid }), []);
  }
  assert.deepEqual(confirmedSwingLevelHistory(wBars, 0, 1), wBars.map(() => ({ high: null, low: null })));
});

test("structure violation/expiry prevents confirmation and sustained break does not duplicate events", () => {
  const invalidated = wBars.map((bar, i) => i === 8 ? { ...bar, low: 98 } : bar);
  assert.ok(!computeBollingerPatterns(invalidated, wB, settings).some(item => item.type === "w-confirmed"));
  const delayed = barsFromLows([105, 102, 100, 104, 110, 106, 99, 103, 108, 110, 109, 108, 109, 110, 115]);
  assert.ok(!computeBollingerPatterns(delayed, [...wB.slice(0, 8), ...Array(7).fill(0.7)], { ...settings, patternMaxBars: 5 }).some(item => item.type === "w-confirmed"));
  const continued = [...wBars, ...barsFromLows([116, 117, 118, 119]).map((bar, i) => ({ ...bar, date: `2026-01-${12 + i}` }))];
  const all = computeBollingerPatterns(continued, [...wB, 1.3, 1.4, 1.5, 1.6], settings);
  assert.equal(all.filter(item => item.type === "w-confirmed").length, 1);
  assert.equal(new Set(all.map(item => item.id)).size, all.length);
  assert.deepEqual(computeBollingerPatterns(continued, [...wB, 1.3, 1.4, 1.5, 1.6], settings), all);
});
