import assert from "node:assert/strict";
import test from "node:test";
import { bollinger, closePercentile, rollingPopulationStdDev } from "../chart-indicators.ts";
import { DEFAULT_BOLLINGER_SYSTEM_CONFIG } from "./config.ts";
import {
  analyzeBollinger, bandWalk, bandWidth, BOLLINGER_RULES, causalRiskReward, classifySetup,
  classifyTrend, classifyVolatility, completedBreakout, empiricalBbwRank, failedBreakoutSide,
  normalizeSetupScore, percentB, relativeVolume, rollingBbwRanks, scoreSetupQuality, volumeConfirmation,
} from "./engine.ts";
import type { BollingerBar, FlowConfirmation, SetupQuality } from "./types.ts";

const settings = { ...DEFAULT_BOLLINGER_SYSTEM_CONFIG };
const missingFlow: FlowConfirmation = { availability: "unknown", foreignOwnershipChange: null, investmentTrustNet: null, reason: "unavailable" };
const assertNear = (actual: number | null | undefined, expected: number, tolerance = 1e-8) => {
  assert.ok(typeof actual === "number" && Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};
const bars = (closes: number[]): BollingerBar[] => closes.map((close, index) => ({
  date: `2025-${String(Math.floor(index / 28) + 1).padStart(2, "0")}-${String(index % 28 + 1).padStart(2, "0")}`,
  open: close, high: close + 1, low: close - 1, close, volume: 100 + index, completed: true,
}));

test("population BB known values, warmup, flat window and invalid inputs", () => {
  const result = bollinger([1, 2, 3, 4, 5], 5, 2);
  assert.deepEqual(result.mid.slice(0, 4), [null, null, null, null]);
  assertNear(result.mid[4], 3);
  assertNear(result.upper[4], 3 + 2 * Math.sqrt(2));
  assertNear(result.lower[4], 3 - 2 * Math.sqrt(2));
  assert.deepEqual(bollinger([100, 100, 100], 2), { mid: [null, 100, 100], upper: [null, 100, 100], lower: [null, 100, 100] });
  assert.deepEqual(bollinger([1, NaN, 3, 4], 2).upper.slice(0, 3), [null, null, null]);
  assertNear(bollinger([1, NaN, 3, 4], 2).upper[3], 4.5);
  for (const period of [0, -1, NaN, 2.5]) assert.deepEqual(bollinger([1, 2], period).mid, [null, null]);
  for (const mult of [0, -1, NaN, Infinity]) assert.deepEqual(bollinger([1, 2], 2, mult).upper, [null, null]);
});

test("rolling population deviation matches direct reference and remains stable at large prices", () => {
  const input = Array.from({ length: 1000 }, (_, i) => 1_000_000 + Math.sin(i * 0.7) * 200 + i / 10);
  for (const period of [1, 5, 20, 50, 200]) {
    const actual = rollingPopulationStdDev(input, period);
    for (let i = period - 1; i < input.length; i++) {
      const sample = input.slice(i - period + 1, i + 1);
      const mean = sample.reduce((sum, value) => sum + value / period, 0);
      const expected = Math.sqrt(sample.reduce((sum, value) => sum + (value - mean) ** 2 / period, 0));
      assertNear(actual[i], expected, 1e-6);
    }
  }
  assertNear(rollingPopulationStdDev([1e12 + 1, 1e12 + 2, 1e12 + 3], 3)[2], Math.sqrt(2 / 3));
  assert.deepEqual(rollingPopulationStdDev([1, Infinity, 3, 4, 5], 2).slice(0, 3), [null, null, null]);
});

test("percentB is unbounded, reflects all reference levels and handles zero width", () => {
  assert.equal(percentB(120, 120, 80), 1);
  assert.equal(percentB(100, 120, 80), 0.5);
  assert.equal(percentB(80, 120, 80), 0);
  assert.equal(percentB(140, 120, 80), 1.5);
  assert.equal(percentB(60, 120, 80), -0.5);
  assert.equal(percentB(100, 100, 100), null);
  assert.equal(percentB(NaN, 120, 80), null);
  assert.equal(percentB(100, null, 80), null);
});

test("bandwidth uses percentage points, flat volatility is zero, invalid basis unavailable", () => {
  assert.equal(bandWidth(120, 100, 80), 40);
  assert.equal(bandWidth(100, 100, 100), 0);
  assert.equal(bandWidth(10, 0, 0), null);
  assert.equal(bandWidth(10, -1, 0), null);
  assert.equal(bandWidth(10, 5, 20), null);
  assert.equal(bandWidth(Infinity, 100, 80), null);
});

test("true BBW rank uses all distribution observations and exact tie midrank", () => {
  const distribution = [1, 2, 3, 4, 5];
  assert.equal(empiricalBbwRank(distribution, 1, 5).percentile, 10);
  assert.equal(empiricalBbwRank(distribution, 5, 5).percentile, 90);
  assert.equal(empiricalBbwRank(distribution, 3, 5).percentile, 50);
  assert.equal(empiricalBbwRank([1, 1, 2, 3], 1, 4).percentile, 25);
  assert.equal(empiricalBbwRank([1, 1, 1], 1, 3).percentile, 50);
  assert.equal(empiricalBbwRank([1, NaN, null, Infinity, 3], 3, 3).percentile, null);
  assert.deepEqual(empiricalBbwRank([1, NaN, 3], 3, 2), { percentile: 75, min: 1, max: 3, samples: 2 });
  assert.equal(empiricalBbwRank([1, 2], null, 2).percentile, null);
  assert.equal(empiricalBbwRank([1, 2], 2, 0).percentile, null);
});

test("rolling BBW rank excludes nonfinite observations and is causally prefix-stable", () => {
  const values = [5, 1, NaN, 3, 1, null, 10];
  const actual = rollingBbwRanks(values, 3);
  for (let i = 0; i < values.length; i++) {
    assert.deepEqual(actual[i], empiricalBbwRank(values.slice(0, i + 1), values[i], 3));
    assert.deepEqual(actual.slice(0, i + 1), rollingBbwRanks(values.slice(0, i + 1), 3));
  }
  assert.deepEqual(rollingBbwRanks([1, 2], 0).map(point => point.percentile), [null, null]);
});

test("BBW percentile is demonstrably not the existing close-price percentile", () => {
  const closes = Array.from({ length: 145 }, (_, i) => 100 + i);
  const result = analyzeBollinger(bars(closes), settings);
  const latest = result.points.at(-1)!;
  const priceRank = closePercentile(closes);
  assert.ok(priceRank != null && latest.bbwPercentile != null);
  assert.ok(priceRank > 90);
  assert.ok(latest.bbwPercentile < 1);
  assert.notEqual(priceRank, latest.bbwPercentile);
  assert.equal(result.points[142]!.bbwPercentile, null);
  assert.equal(result.points[143]!.bbwSamples, 125);
});

test("volatility thresholds 5/10/20 and expansion follow configurable boundary rules", () => {
  assert.equal(classifyVolatility(5, settings), "extreme-squeeze");
  assert.equal(classifyVolatility(5.01, settings), "squeeze");
  assert.equal(classifyVolatility(10, settings), "squeeze");
  assert.equal(classifyVolatility(10.01, settings), "compression");
  assert.equal(classifyVolatility(20, settings), "compression");
  assert.equal(classifyVolatility(20.01, settings), "normal");
  assert.equal(classifyVolatility(null, settings), null);
  assert.equal(classifyVolatility(30, settings, 3, 2, "squeeze"), "expansion");
  assert.equal(classifyVolatility(30, settings, 2.99, 2, "squeeze"), "normal");
  assert.equal(classifyVolatility(30, settings, 3, 2, "normal"), "normal");
});

test("all trend classes use standard SMAs and normalized slope/tolerance", () => {
  const bullish = { close: 110, sma20: 105, sma60: 100, sma120: 95, sma200: 90, slope60: 0.01, slope120: 0.01, slope200: 0.01 };
  assert.equal(classifyTrend(bullish), "strong-bullish");
  assert.equal(classifyTrend({ ...bullish, slope200: -0.01 }), "bullish");
  const bearish = { close: 90, sma20: 95, sma60: 100, sma120: 105, sma200: 110, slope60: -0.01, slope120: -0.01, slope200: -0.01 };
  assert.equal(classifyTrend(bearish), "strong-bearish");
  assert.equal(classifyTrend({ ...bearish, slope200: 0.01 }), "bearish");
  assert.equal(classifyTrend({ ...bullish, close: 100 }), "neutral");
  assert.equal(classifyTrend({ ...bullish, sma200: null }), null);
  assert.equal(classifyTrend({ ...bullish, close: 105.01, sma20: 105, sma60: 104.99 }), "neutral");
});

test("breakout needs completed close beyond band and previous completed inside relationship", () => {
  const previous = { close: 100, upper: 105, lower: 95, completed: true };
  assert.equal(completedBreakout({ close: 104, upper: 105, lower: 95, completed: true }, previous), null);
  assert.equal(completedBreakout({ close: 106, upper: 105, lower: 95, completed: true }, previous), "upper");
  assert.equal(completedBreakout({ close: 94, upper: 105, lower: 95, completed: true }, previous), "lower");
  assert.equal(completedBreakout({ close: 106, upper: 105, lower: 95, completed: false }, previous), null);
  assert.equal(completedBreakout({ close: 106, upper: 105, lower: 95 }, previous), null);
  assert.equal(completedBreakout({ close: 107, upper: 105, lower: 95, completed: true }, { ...previous, close: 106 }), null);
  assert.equal(completedBreakout({ close: 93, upper: 105, lower: 95, completed: true }, { ...previous, close: 94 }), null);
});

test("failed breakout is confirmed re-entry only within 1–2 completed bars", () => {
  const reentry = { close: 104, upper: 105, lower: 95, completed: true };
  assert.equal(failedBreakoutSide("upper", reentry, 1), "upper");
  assert.equal(failedBreakoutSide("upper", reentry, 2), "upper");
  assert.equal(failedBreakoutSide("upper", reentry, 3), null);
  assert.equal(failedBreakoutSide("upper", reentry, 0), null);
  assert.equal(failedBreakoutSide("upper", { ...reentry, completed: false }, 1), null);
  assert.equal(failedBreakoutSide("lower", { ...reentry, close: 96 }, 2), "lower");
});

test("band walks need five completed bars, three touches, slope and no middle violations", () => {
  const upper = [0.8, 0.7, 0.9, 0.7, 0.8].map(pb => ({ close: 100 + pb * 10, middle: 100, percentB: pb, completed: true }));
  assert.equal(bandWalk(upper, 0.01, settings), "upper");
  assert.equal(bandWalk(upper, 0, settings), null);
  assert.equal(bandWalk(upper.slice(1), 0.01, settings), null);
  assert.equal(bandWalk(upper.map((row, i) => i === 1 ? { ...row, close: 99 } : row), 0.01, settings), null);
  assert.equal(bandWalk(upper.map((row, i) => i === 0 ? { ...row, percentB: 0.79 } : row), 0.01, settings), null);
  const lower = upper.map(row => ({ ...row, close: 90, percentB: 1 - row.percentB }));
  assert.equal(bandWalk(lower, -0.01, settings), "lower");
  assert.equal(bandWalk(lower, 0.01, settings), null);
});

test("RVOL preserves valid zero, requires full valid volume window, and classifies thresholds", () => {
  const input = bars([10, 10, 10]);
  input[0]!.volume = 100; input[1]!.volume = 100; input[2]!.volume = 200;
  assert.deepEqual(relativeVolume(input, 2).values, [null, 1, 4 / 3]);
  input[2]!.volume = 0; assert.equal(relativeVolume(input, 2).values[2], 0);
  input[1]!.volumeValid = false; assert.equal(relativeVolume(input, 2).values[2], null);
  assert.deepEqual(relativeVolume(input.map(row => ({ ...row, volume: 0, volumeValid: true })), 2).values, [null, null, null]);
  assert.equal(volumeConfirmation(null), "unavailable");
  assert.equal(volumeConfirmation(0.79), "weak");
  assert.equal(volumeConfirmation(0.8), "normal");
  assert.equal(volumeConfirmation(1.2), "improving");
  assert.equal(volumeConfirmation(1.5), "confirmed");
  assert.equal(volumeConfirmation(2), "strong");
});

test("intraday RVOL uses prior same-session slots when available and labels rolling fallback", () => {
  const input = bars([10, 10, 10, 10, 10]).map((row, i) => ({ ...row, date: `2026-01-0${i + 1} 09:05`, volume: i === 4 ? 200 : 100 }));
  const result = relativeVolume(input, 3, true);
  assert.equal(result.methods[2], "rolling-approximate");
  assert.equal(result.methods[3], "same-slot");
  assert.equal(result.values[4], 2);
  const unfinished = input.map((row, i) => ({ ...row, completed: i !== 1 }));
  assert.equal(relativeVolume(unfinished, 3, true).methods[3], "rolling-approximate");
});

test("score maximum 100, missing category normalization and explicit raw component inputs", () => {
  const flow: FlowConfirmation = { availability: "available", foreignOwnershipChange: 0.25, investmentTrustNet: 100, reason: "known publication", source: "kiwoom" };
  const input = { trend: "strong-bullish" as const, volatility: "extreme-squeeze" as const, percentB: 1.1, rsi: 60, rsiSlope: 1,
    rvol: 2, breakout: "upper" as const, bandWalk: null, flow, riskReward: 3 };
  const full = scoreSetupQuality(input);
  assert.equal(full.normalizedScore, 100); assert.equal(full.earnedScore, 100); assert.equal(full.availableScore, 100); assert.equal(full.coverage, 1);
  assert.equal(full.components.flow.inputs.foreignOwnershipChange, 0.25);
  const missing = scoreSetupQuality({ ...input, flow: missingFlow, riskReward: null });
  assert.equal(missing.earnedScore, 80); assert.equal(missing.availableScore, 80); assert.equal(missing.normalizedScore, 100); assert.equal(missing.coverage, 0.8);
  assert.equal(missing.components.flow.score, null);
  assert.equal(missing.components.riskReward.score, null);
  const partial = scoreSetupQuality({ ...input, flow: { ...flow, availability: "partial", investmentTrustNet: null } });
  assert.equal(partial.availableScore, 95); assert.equal(partial.normalizedScore, 100); assert.equal(partial.coverage, 0.95);
});

test("normalization distinguishes unavailable from a measured zero and never fabricates score", () => {
  const components = Object.fromEntries(Object.entries(BOLLINGER_RULES.weights).map(([key, max]) => [key,
    { score: null, max, reason: "missing", availability: "unknown", inputs: {} }])) as SetupQuality["components"];
  assert.equal(normalizeSetupScore(components).normalizedScore, null);
  assert.equal(normalizeSetupScore(components).coverage, 0);
  components.volume.score = 0; components.volume.availability = "available";
  assert.equal(normalizeSetupScore(components).normalizedScore, 0);
  assert.equal(normalizeSetupScore(components).coverage, 0.15);
});

test("risk/reward uses a causal structural target or remains unavailable", () => {
  assert.equal(causalRiskReward(110, 100, 108, "upper", { high: 130, low: 90 }), 2);
  assert.equal(causalRiskReward(110, 100, 108, "upper", { high: 105, low: 90 }), null);
  assert.equal(causalRiskReward(90, 92, 100, "lower", { high: 110, low: 70 }), 2);
  assert.equal(causalRiskReward(90, 92, 100, null, { high: 110, low: 70 }), null);
  assert.equal(causalRiskReward(110, 110, 108, "upper", { high: 130, low: 90 }), null);
  assert.equal(causalRiskReward(110, -100, 108, "upper", { high: 130, low: 90 }), null);
  assert.equal(causalRiskReward(90, 92, 100, "lower", { high: 110, low: 0 }), null);
});

test("squeeze alone is direction-neutral and band touches never imply an automatic trade", () => {
  const point = { trend: "neutral" as const, volatility: "squeeze" as const, percentB: 0.5, rsi: 50, rsiSlope: 0, breakout: null, failedBreakout: null, bandWalk: null };
  assert.equal(classifySetup(point), "squeeze");
  assert.equal(classifySetup({ ...point, percentB: 1 }), "squeeze");
  assert.equal(classifySetup({ ...point, volatility: "normal", percentB: 1.1 }), "mean-reversion-watch");
  assert.equal(classifySetup({ ...point, trend: "bullish", percentB: 0.9, rsi: 60, rsiSlope: 1 }), "pre-breakout");
  assert.equal(classifySetup({ ...point, breakout: "lower" }), "bear-breakdown");
});

test("full engine integrates same-frequency warmup without changing historical points or events", () => {
  const input = bars(Array.from({ length: 240 }, (_, i) => 100 + i / 3 + Math.sin(i / 3) * 4));
  const full = analyzeBollinger(input, settings, { market: "US" });
  for (const cutoff of [30, 143, 205, 230]) {
    const prefix = analyzeBollinger(input.slice(0, cutoff), settings, { market: "US" });
    assert.deepEqual(prefix.points, full.points.slice(0, cutoff));
    assert.deepEqual(prefix.events, full.events.filter(event => event.index < cutoff));
  }
  assert.equal(full.warmupRequired, 205);
  const final = full.points.at(-1)!;
  assert.equal(final.flow.availability, "not-applicable");
  assert.equal(final.quality.components.flow.score, null);
  assert.ok(final.quality.coverage <= 0.9);
});

test("unfinished bar can have previews but cannot create confirmed breakout/pattern/alert event", () => {
  const input = bars(Array.from({ length: 150 }, (_, i) => 100 + Math.sin(i)));
  input.push({ date: "2026-01-01", open: 150, high: 151, low: 149, close: 150, volume: 1000, completed: false });
  const result = analyzeBollinger(input, settings);
  const latest = result.points.at(-1)!;
  assert.equal(latest.completed, false);
  assert.ok(latest.percentB != null && latest.percentB > 1);
  assert.equal(latest.breakout, null); assert.equal(latest.bandWalk, null);
  assert.deepEqual(latest.events, []);
  assert.ok(result.events.every(event => event.index < input.length - 1));
  const closed = analyzeBollinger(input.map(row => ({ ...row, completed: true })), settings);
  assert.equal(closed.points.at(-1)!.breakout, "upper");
  assert.ok(closed.events.some(event => event.index === input.length - 1 && event.type === "upper-breakout"));
});

test("engine breakout failure is one transition and wick-only bars do not confirm", () => {
  const input = bars(Array.from({ length: 145 }, (_, i) => 100 + Math.sin(i)));
  input.push(...bars([130, 100, 100]).map((row, i) => ({ ...row, date: `2026-01-0${i + 1}` })));
  const result = analyzeBollinger(input, settings);
  assert.equal(result.points[145]!.breakout, "upper");
  assert.equal(result.points[146]!.failedBreakout, "upper");
  assert.equal(result.points[147]!.failedBreakout, null);
  assert.equal(result.events.filter(event => event.type === "failed-upper").length, 1);
  const wick = [...input.slice(0, 145), { ...input[145]!, close: 100, open: 100, high: 150, low: 99 }];
  assert.equal(analyzeBollinger(wick, settings).points.at(-1)!.breakout, null);
});

test("three-stage workflow emits squeeze then breakout then volume once, with stable identity", () => {
  const input = bars(Array.from({ length: 160 }, (_, i) => 100 + Math.sin(i) * Math.max(0.1, 10 - i * 0.07)));
  for (const row of input) row.volume = 100;
  input.push({ date: "2026-01-01", open: 120, high: 121, low: 119, close: 120, volume: 1000, completed: true });
  const result = analyzeBollinger(input, settings);
  const stages = result.events.filter(event => event.stage);
  assert.deepEqual(stages.map(event => [event.type, event.stage]), [["squeeze", 1], ["upper-breakout", 2], ["volume-confirmed", 3]]);
  assert.equal(stages[0]!.direction, "neutral");
  assert.ok(stages[0]!.index < stages[1]!.index);
  assert.equal(stages[1]!.index, stages[2]!.index);
  assert.equal(new Set(result.events.map(event => event.id)).size, result.events.length);
  assert.deepEqual(analyzeBollinger(input, settings).events, result.events);
  const following = { ...input.at(-1)!, date: "2026-01-02", volume: 2000 };
  assert.equal(analyzeBollinger([...input, following], settings).events.filter(event => event.type === "volume-confirmed").length, 1);
});

test("validated KR flow is exact-date bound; U.S. never inherits Korean flow", () => {
  const input = bars(Array.from({ length: 220 }, (_, i) => 100 + i));
  const finalDate = input.at(-1)!.date;
  const flow: FlowConfirmation = { availability: "available", foreignOwnershipChange: 0.1, investmentTrustNet: -100, reason: "known publication", source: "kiwoom", asOf: finalDate };
  const options = { market: "KR" as const, flowByDate: { [finalDate]: flow } };
  const result = analyzeBollinger(input, settings, options);
  assert.equal(result.points.at(-1)!.flow, flow);
  assert.equal(result.points.at(-2)!.flow.availability, "unknown");
  assert.equal(result.points.at(-1)!.flow.investmentTrustNet, -100);
  const us = analyzeBollinger(input, settings, { ...options, market: "US" });
  assert.equal(us.points.at(-1)!.flow.availability, "not-applicable");
  assert.equal(us.points.at(-1)!.quality.components.flow.score, null);
});

test("source customization is deterministic and does not alter timeframe parameters", () => {
  const input = bars(Array.from({ length: 220 }, (_, i) => 100 + i)).map(row => ({ ...row, high: row.high + 9 }));
  const close = analyzeBollinger(input, settings);
  const hlc = analyzeBollinger(input, { ...settings, source: "hlc3" });
  assertNear(hlc.points.at(-1)!.middle! - close.points.at(-1)!.middle!, 3);
  for (const suffix of [" 09:05", "", "W", "M"]) {
    const frequency = analyzeBollinger(input.map(row => ({ ...row, date: row.date + suffix })), settings);
    assert.equal(frequency.points.at(-1)!.middle, close.points.at(-1)!.middle);
    assert.equal(frequency.points.at(-1)!.sma200, close.points.at(-1)!.sma200);
  }
});

test("invalid OHLC does not produce invented BB, score, or confirmed signals", () => {
  const input = bars(Array.from({ length: 220 }, (_, i) => 100 + i));
  input[219] = { ...input[219]!, high: 1 };
  const latest = analyzeBollinger(input, settings).points.at(-1)!;
  assert.equal(latest.upper, null); assert.equal(latest.percentB, null); assert.equal(latest.bbw, null);
  assert.equal(latest.trend, null); assert.equal(latest.rsi, null); assert.equal(latest.breakout, null);
  assert.deepEqual(latest.events, []);
});
