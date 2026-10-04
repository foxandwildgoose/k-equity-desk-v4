import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifySwingDivergence,
  closePercentile,
  compareBollingerAndPercentile,
  computeRangePosition,
  computeSeriesRangePosition,
  planRangeMarkers,
  rangeMarkerText,
  detectMacdCrosses,
  detectRsiDivergences,
  disparity,
  findPivots,
  quantSnapshot,
  rsi,
  rsiWithSignal,
  rollingPercentileBands,
  stochastic,
} from "./chart-indicators.ts";

function bar(high: number, low: number, close: number, date: string) {
  return { high, low, close, date };
}

test("findPivots marks isolated swing high and low", () => {
  const highs = [10, 12, 18, 12, 11, 10, 11];
  const lows = [9, 10, 12, 10, 8, 9, 10];
  const p = findPivots(highs, lows, 2, 2);
  assert.deepEqual(p.highIdx, [2]);
  assert.deepEqual(p.lowIdx, [4]);
});

test("computeRangePosition: at period high, high-drawdown is 0 and low-rally is positive", () => {
  const bars = [
    bar(100, 80, 90, "2026-01-01"),
    bar(110, 85, 100, "2026-01-02"),
    bar(140, 100, 140, "2026-01-03"),
  ];
  const s = computeRangePosition(bars);
  assert.ok(s);
  assert.equal(s.periodHigh, 140);
  assert.equal(s.periodLow, 80);
  assert.equal(s.fromPeriodHighPct, 0);
  assert.equal(s.fromPeriodLowPct, ((140 - 80) / 80) * 100);
});

test("computeRangePosition: at period low, rally from low is 0", () => {
  const bars = [
    bar(120, 100, 110, "2026-01-01"),
    bar(110, 70, 70, "2026-01-02"),
  ];
  const s = computeRangePosition(bars);
  assert.ok(s);
  assert.equal(s.periodLow, 70);
  assert.equal(s.fromPeriodLowPct, 0);
  assert.ok(s.fromPeriodHighPct < 0);
});

test("recent swing high is the last confirmed pivot, not an unconfirmed new high", () => {
  // Swing high at idx 4 (18), pullback, then unconfirmed new high on last bars.
  const highs = [10, 12, 14, 16, 18, 16, 14, 12, 15, 17, 19, 21, 22];
  const lows = [9, 11, 13, 15, 17, 15, 13, 11, 14, 16, 18, 20, 21];
  const closes = [10, 12, 14, 16, 17, 15, 13, 12, 15, 17, 19, 21, 22];
  const bars = highs.map((h, i) =>
    bar(h, lows[i]!, closes[i]!, `2026-01-${String(i + 1).padStart(2, "0")}`),
  );
  const s = computeRangePosition(bars, { pivotLeft: 2, pivotRight: 2 });
  assert.ok(s);
  assert.equal(s.periodHigh, 22);
  assert.equal(s.periodHighIdx, 12);
  assert.equal(s.recentHigh, 18);
  assert.equal(s.recentHighIdx, 4);
  assert.equal(s.fromPeriodHighPct, 0);
  assert.ok(Math.abs(s.fromRecentHighPct - ((22 - 18) / 18) * 100) < 1e-9);
});

test("visible slice [from,to] uses only that window for extrema", () => {
  const bars = [
    bar(50, 40, 45, "2026-01-01"),
    bar(80, 60, 70, "2026-01-02"),
    bar(90, 70, 85, "2026-01-03"),
    bar(200, 90, 180, "2026-01-04"),
  ];
  const s = computeRangePosition(bars, { from: 0, to: 2, close: 180 });
  assert.ok(s);
  assert.equal(s.periodHigh, 90);
  assert.equal(s.periodLow, 40);
  assert.ok(s.fromPeriodHighPct > 0);
});

test("empty or invalid bars return null", () => {
  assert.equal(computeRangePosition([]), null);
  assert.equal(computeRangePosition([bar(0, 0, 0, "2026-01-01")]), null);
});

test("planRangeMarkers uses one label when the period extreme is the recent extreme", () => {
  const bars = [
    bar(100, 80, 90, "2026-01-01"),
    bar(110, 85, 100, "2026-01-02"),
    bar(140, 100, 140, "2026-01-03"),
  ];
  const s = computeRangePosition(bars, { recentSpan: "all" });
  assert.ok(s);
  const marks = planRangeMarkers(s);
  assert.equal(marks.length, 2);
  assert.equal(marks[0]!.scope, "both");
  assert.equal(marks[1]!.scope, "both");
  const text = rangeMarkerText(marks[0]!, "140", "+0.00%");
  assert.equal(text.place, "extreme");
  assert.match(text.title, /기간=최근 고점/);
});

test("planRangeMarkers keeps a separate recent swing when it is not the period high", () => {
  const highs = [10, 12, 14, 16, 18, 16, 14, 12, 15, 17, 19, 21, 22];
  const lows = [9, 11, 13, 15, 17, 15, 13, 11, 14, 16, 18, 20, 21];
  const closes = [10, 12, 14, 16, 17, 15, 13, 12, 15, 17, 19, 21, 22];
  const bars = highs.map((h, i) => bar(h, lows[i]!, closes[i]!, `2026-01-${String(i + 1).padStart(2, "0")}`));
  const s = computeRangePosition(bars, { pivotLeft: 2, pivotRight: 2 });
  assert.ok(s);
  const highsMarks = planRangeMarkers(s).filter((m) => m.role === "high");
  assert.equal(highsMarks.length, 2);
  const recent = highsMarks.find((m) => m.scope === "recent");
  assert.ok(recent);
  assert.equal(recent.price, 18);
  const text = rangeMarkerText(recent, "18", "+22.22%");
  assert.equal(text.place, "last");
  assert.match(text.pctText, /^돌파 /);
});

test("recentSpan 52W ignores an older period high", () => {
  const s = computeRangePosition(
    [
      bar(500, 400, 450, "2024-01-01"),
      bar(130, 100, 120, "2026-08-01"),
      bar(140, 110, 135, "2026-09-01"),
    ],
    { recentSpan: "52W" },
  );
  assert.ok(s);
  assert.equal(s.periodHigh, 500);
  assert.equal(s.recentHigh, 140);
  assert.equal(s.periodHighIdx, 0);
  assert.notEqual(s.recentHighIdx, s.periodHighIdx);
});

test("computeSeriesRangePosition maps a line onto the same stats", () => {
  const s = computeSeriesRangePosition([
    { value: 100, date: "2026-01-01" },
    { value: 80, date: "2026-01-02" },
    { value: 120, date: "2026-01-03" },
  ]);
  assert.ok(s);
  assert.equal(s.periodHigh, 120);
  assert.equal(s.periodLow, 80);
  assert.equal(s.fromPeriodHighPct, 0);
  assert.equal(s.fromPeriodLowPct, 50);
});

test("rolling percentile bands stay inside the window and do not use the future", () => {
  const values = Array.from({ length: 30 }, (_, i) => i + 1);
  const bands = rollingPercentileBands(values, 20);
  assert.equal(bands.p50[18], null);
  assert.ok(bands.p50[19] != null);
  assert.ok(bands.p10[29]! < bands.p50[29]! && bands.p50[29]! < bands.p90[29]!);
  const early = rollingPercentileBands(values.slice(0, 20), 20);
  assert.equal(early.p50[19], bands.p50[19]);
});

test("disparity is 100 on a flat series and stochastic is 100 at the high", () => {
  const flat = Array.from({ length: 25 }, () => 10);
  const disp = disparity(flat, 20);
  assert.equal(disp[19], 100);
  const highs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const lows = highs.map((n) => n - 1);
  const closes = highs.slice();
  const st = stochastic(highs, lows, closes, 5, 3);
  assert.equal(st.k[13], 100);
});

test("quant snapshot reports drawdown from the peak and a full-sample percentile", () => {
  const bars = [
    { high: 10, low: 9, close: 10 },
    { high: 12, low: 10, close: 12 },
    { high: 11, low: 8, close: 8 },
    { high: 9, low: 7, close: 9 },
    { high: 10, low: 8, close: 10 },
    { high: 11, low: 9, close: 11 },
    { high: 12, low: 10, close: 12 },
    { high: 13, low: 11, close: 12 },
  ];
  const snap = quantSnapshot(bars, 252);
  assert.ok(snap);
  assert.equal(snap!.currentDrawdownPct, 0);
  assert.ok(snap!.maxDrawdownPct < 0);
  assert.ok(Math.abs(snap!.maxDrawdownPct - ((8 - 12) / 12) * 100) < 1e-9);
  assert.equal(closePercentile(bars.map((b) => b.close)), 100);
});

test("bollinger percent-b and the longer percentile rank can disagree", () => {
  const calm = Array.from({ length: 40 }, () => 10);
  const spike = compareBollingerAndPercentile([...calm, 30], 20, 2, 120);
  assert.ok(spike);
  assert.ok(spike.percentB != null && spike.percentB > 1);
  assert.equal(spike.pctRank, 100);
  assert.match(spike.note, /같이 위에/);

  const mixed = compareBollingerAndPercentile(
    [...Array.from({ length: 100 }, () => 50), ...Array.from({ length: 19 }, () => 10), 30],
    20,
    2,
    120,
  );
  assert.ok(mixed);
  assert.ok(mixed.percentB != null && mixed.percentB > 1);
  assert.ok(mixed.pctRank != null && mixed.pctRank < 90);
  assert.match(mixed.note, /어긋난/);
});

test("swing divergence ignores ties and classifies both regular and hidden", () => {
  assert.equal(classifySwingDivergence("low", 10, 9, 20, 35), "regular-bullish");
  assert.equal(classifySwingDivergence("low", 10, 12, 40, 25), "hidden-bullish");
  assert.equal(classifySwingDivergence("high", 10, 12, 70, 55), "regular-bearish");
  assert.equal(classifySwingDivergence("high", 12, 10, 55, 70), "hidden-bearish");
  assert.equal(classifySwingDivergence("low", 10, 10, 20, 30), null);
  assert.equal(classifySwingDivergence("high", 10, 12, 40, 40), null);
});

test("RSI divergence uses only confirmed pivots and the latest pair", () => {
  const closes: number[] = [];
  for (let i = 0; i < 14; i++) closes.push(80 + i);
  closes.push(90, 82, 74, 66, 58, 50, 42);
  for (let i = 1; i <= 14; i++) closes.push(42 + i * 4);
  for (let i = 1; i <= 8; i++) closes.push(98 - i * 3);
  closes.push(80, 86, 90, 84, 70, 36);
  for (let i = 1; i <= 8; i++) closes.push(36 + i * 4);
  const highs = closes.map((c) => c + 0.4);
  const lows = closes.slice();
  const found = detectRsiDivergences(highs, lows, closes, {
    rsiPeriod: 14,
    left: 5,
    right: 5,
    maxAge: 40,
  });
  const bull = found.find((item) => item.kind === "regular-bullish");
  assert.ok(bull, `expected regular bullish, got ${found.map((item) => item.kind).join(",")}`);
  assert.ok(bull.price2 < bull.price1);
  assert.ok(bull.rsi2 > bull.rsi1);
  assert.ok(closes.length - 1 - bull.i2 <= 40);
});

test("MACD golden cross is the bar the MACD line rises through the signal", () => {
  const closes: number[] = [];
  for (let i = 0; i < 60; i++) closes.push(100);
  for (let i = 0; i < 15; i++) closes.push(100 - i * 2);
  for (let i = 0; i < 20; i++) closes.push(70 + i * 2);
  const crosses = detectMacdCrosses(closes, { maxAge: 40 });
  const golden = crosses.find((item) => item.kind === "golden");
  assert.ok(golden, `expected golden, got ${crosses.map((item) => item.kind).join(",")}`);
  assert.ok(golden.index >= 75);
  assert.ok(golden.macd > golden.signal);
  assert.equal(golden.belowZero, true);
});

test("hidden bullish is a higher price low with a lower RSI", () => {
  const closes: number[] = [];
  for (let i = 0; i < 15; i++) closes.push(100 + i);
  closes.push(112, 110, 108, 109, 111, 116, 122, 128, 134);
  closes.push(128, 120, 112, 114, 118, 124, 130, 136);
  const highs = closes.map((c) => c + 0.3);
  const lows = closes.slice();
  const found = detectRsiDivergences(highs, lows, closes, {
    rsiPeriod: 14,
    left: 3,
    right: 3,
    maxAge: 80,
  });
  const hidden = found.find((item) => item.kind === "hidden-bullish");
  assert.ok(hidden, `expected hidden bullish, got ${found.map((item) => item.kind).join(",") || "none"}`);
  assert.ok(hidden.price2 > hidden.price1);
  assert.ok(hidden.rsi2 < hidden.rsi1);
});

// ── AT-35: extended indicators — known values from an independent textbook
// reference implementation (values rounded to 1e-6). ──
import {
  adx,
  anchoredVwap,
  cci,
  donchian,
  heikinAshi,
  highLowN,
  hma,
  ichimoku,
  keltner,
  mfi,
  obv,
  parabolicSar,
  pivotPoints,
  stochRsi,
  supertrend,
  volumeProfile,
  williamsR,
  wma,
} from "./chart-indicators.ts";

// synthetic fixture (format sample), not market data
const FH = [10, 11, 12, 11.5, 12.5, 13, 12.8, 13.5, 14, 13.6, 14.2, 15, 14.8, 15.5, 16, 15.2, 15.8, 16.5, 17, 16.4];
const FL = [9, 9.8, 10.9, 10.6, 11.4, 12.1, 11.9, 12.6, 13.1, 12.8, 13.3, 14.1, 13.9, 14.6, 15.1, 14.4, 14.9, 15.6, 16.1, 15.5];
const FC = [9.5, 10.9, 11.5, 11, 12.2, 12.7, 12.1, 13.2, 13.8, 13, 14, 14.8, 14.2, 15.3, 15.4, 14.8, 15.6, 16.3, 16.2, 15.8];
const FV = [100, 120, 90, 110, 130, 150, 80, 160, 170, 90, 140, 180, 100, 190, 200, 120, 150, 210, 160, 130];

function close6(actual: (number | null)[], expected: (number | null)[], label: string) {
  assert.equal(actual.length, expected.length, `${label} length`);
  actual.forEach((a, i) => {
    const e = expected[i];
    if (e == null) assert.equal(a, null, `${label}[${i}]`);
    else assert.ok(a != null && Math.abs(a - e) < 1e-5, `${label}[${i}] ${a} ≠ ${e}`);
  });
}

test("AT-35 WMA / HMA known values", () => {
  close6(wma([1, 2, 3], 3), [null, null, 14 / 6], "wma small");
  close6(wma(FC, 5).slice(-3), [15.626667, 15.866667, 15.913333], "wma5");
  close6(hma(FC, 9).slice(-3), [15.870741, 16.205185, 16.339259], "hma9");
});

test("AT-35 Keltner / Donchian / Ichimoku", () => {
  close6(keltner(FH, FL, FC, 5, 4, 2).upper.slice(-3), [17.443518, 17.645017, 17.642015], "keltner upper");
  const d = donchian(FH, FL, 5);
  close6(d.upper.slice(-1), [17], "donchian upper");
  close6(d.lower.slice(-1), [14.4], "donchian lower");
  close6(d.mid.slice(-1), [15.7], "donchian mid");
  const ich = ichimoku(FH, FL, FC, 3, 5, 7, 2);
  // tenkan(3) at last = (max(16.5,17,16.4)+min(15.6,16.1,15.5))/2
  close6(ich.tenkan.slice(-1), [(17 + 15.5) / 2], "tenkan");
  assert.equal(ich.spanA[1], null, "spans shifted forward, never before data");
  assert.equal(ich.chikou[FC.length - 1], null, "no future close for chikou at the end");
  assert.equal(ich.chikou[0], FC[2]);
});

test("AT-35 Parabolic SAR / Supertrend", () => {
  close6(parabolicSar(FH, FL).slice(-4), [14.152931, 14.4, 14.82, 15.256], "sar");
  const st = supertrend(FH, FL, FC, 5, 2);
  close6(st.value.slice(-3), [14.030041, 14.574033, 14.574033], "supertrend");
  assert.deepEqual(st.direction.slice(-3), [1, 1, 1]);
});

test("AT-35 VWAP family / OBV / MFI", () => {
  assert.deepEqual(obv(FC, FV).slice(-3), [1390, 1230, 1100]);
  const av = anchoredVwap(FH, FL, FC, FV, 5);
  assert.equal(av[4], null, "nothing before the anchor");
  close6(av.slice(5, 8), [12.6, 12.484058, 12.736752], "anchored vwap");
  close6(mfi(FH, FL, FC, FV, 5).slice(-3), [86.799792, 86.553943, 68.436182], "mfi5");
});

test("AT-35 oscillators: CCI, Williams %R, ADX/DMI, Stoch RSI", () => {
  close6(cci(FH, FL, FC, 5).slice(-3), [141.025641, 103.386809, 21.390374], "cci5");
  close6(williamsR(FH, FL, FC, 5).slice(-3), [-9.52381, -30.769231, -46.153846], "willr5");
  const a = adx(FH, FL, FC, 5);
  close6(a.adx.slice(-2), [63.433369, 57.377827], "adx");
  close6(a.plusDi.slice(-2), [49.543244, 40.369947], "+di");
  close6(a.minusDi.slice(-2), [9.72206, 20.265774], "-di");
  const s = stochRsi(FC, 5, 5, 3, 3);
  close6(s.k.slice(-2), [80.965756, 61.454743], "stochrsi k");
  close6(s.d.slice(-2), [60.094362, 65.450144], "stochrsi d");
});

test("AT-35 pivot points (classic / fibonacci / camarilla) and 52-week levels", () => {
  const c = pivotPoints(110, 90, 105, "classic");
  close6([c.p, c.r1, c.r2, c.r3, c.s1, c.s2, c.s3], [101.666667, 113.333333, 121.666667, 133.333333, 93.333333, 81.666667, 73.333333], "classic");
  const f = pivotPoints(110, 90, 105, "fibonacci");
  close6([f.r1, f.s2], [109.306667, 89.306667], "fib");
  const m = pivotPoints(110, 90, 105, "camarilla");
  close6([m.r1, m.s3], [106.833333, 99.5], "camarilla");
  const hl = highLowN(FH, FL, 5);
  close6(hl.high.slice(-1), [17], "52w high (lookback 5)");
  close6(hl.low.slice(0, 1), [9], "uses bars available so far");
});

test("AT-35 volume profile POC / VAH / VAL", () => {
  // synthetic fixture (format sample), not market data
  const vp = volumeProfile(
    [
      { high: 10, low: 8, volume: 100 },
      { high: 12, low: 10, volume: 300 },
      { high: 11, low: 9, volume: 50 },
    ],
    4,
    0.7,
  );
  // Proportional overlap, not equal shares for every row touched at an edge.
  close6(vp.rows.map((r) => r.volume), [50, 75, 175, 150], "rows");
  assert.equal(vp.poc, 10.5);
  assert.equal(vp.vah, 12);
  assert.equal(vp.val, 10);
});

test("AT-35 Heikin-Ashi transform", () => {
  const opens = [FC[0]! - 0.3, ...FC.slice(0, -1)];
  const bars = FC.map((c, i) => ({ open: opens[i]!, high: FH[i]!, low: FL[i]!, close: c, date: `d${i}` }));
  const ha = heikinAshi(bars).slice(-2);
  close6([ha[0]!.open, ha[0]!.close, ha[0]!.high, ha[0]!.low], [15.561837, 16.4, 17, 15.561837], "ha[-2]");
  close6([ha[1]!.open, ha[1]!.close, ha[1]!.high, ha[1]!.low], [15.980919, 15.975, 16.4, 15.5], "ha[-1]");
  assert.equal(ha[1]!.date, "d19", "other fields preserved");
});

test("RSI of an empty series is empty (no phantom point)", async () => {
  const { rsi } = await import("./chart-indicators.ts");
  assert.deepEqual(rsi([], 14), []);
  assert.equal(rsi([1, 2, 3], 14).length, 3);
});

function near(actual: number, expected: number, relativeTolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= relativeTolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}

test("HTS volume profile divides a 100..120 bar equally between two equal overlaps", () => {
  const profile = volumeProfile([{ low: 100, high: 120, volume: 200 }], 2);
  assert.deepEqual(profile.rows, [
    { low: 100, high: 110, volume: 100, percent: 50 },
    { low: 110, high: 120, volume: 100, percent: 50 },
  ]);
  assert.equal(profile.totalVolume, 200);
  assert.equal(profile.totalValue, 200);
  assert.equal(profile.validBars, 1);
  assert.equal(profile.excludedBars, 0);
  assert.equal(profile.method, "ohlcv-overlap");
  assert.equal(profile.basis, "volume");
});

test("HTS volume profile uses unequal overlap lengths and does not count touching boundaries", () => {
  const profile = volumeProfile([
    { low: 100, high: 130, volume: 0 }, // Defines three linear bins.
    { low: 105, high: 120, volume: 300 },
  ], 3);
  assert.deepEqual(profile.rows.map((row) => row.volume), [100, 200, 0]);
  close6(profile.rows.map((row) => row.percent), [100 / 3, 200 / 3, 0], "overlap percentages");
  assert.equal(profile.totalVolume, 300);
  assert.equal(profile.validBars, 2, "reported zero volume is valid data");
  assert.equal(profile.poc, 115);
});

test("HTS point bars use half-open bins, with a closed uppermost boundary", () => {
  const profile = volumeProfile([
    { low: 100, high: 130, volume: 0 },
    { low: 100, high: 100, volume: 1 },
    { low: 110, high: 110, volume: 2 },
    { low: 120, high: 120, volume: 4 },
    { low: 130, high: 130, volume: 8 },
  ], 3);
  assert.deepEqual(profile.rows.map((row) => row.volume), [1, 2, 12]);
  assert.equal(profile.totalVolume, 15);
  assert.equal(profile.totalValue, 15);
});

test("HTS a wholly single-price dataset uses its actual price with finite 100%", () => {
  const profile = volumeProfile([
    { low: 12345, high: 12345, close: 12345, volume: 20 },
    { low: 12345, high: 12345, close: 12345, volume: 30 },
  ], 10);
  assert.deepEqual(profile.rows, [{ low: 12345, high: 12345, volume: 50, percent: 100 }]);
  assert.equal(profile.poc, 12345);
  assert.equal(profile.val, 12345);
  assert.equal(profile.vah, 12345);
});

test("HTS empty and all-zero volume have no invented POC or value area", () => {
  for (const bars of [[], [{ low: 100, high: 120, volume: 0 }]]) {
    const profile = volumeProfile(bars);
    assert.deepEqual(profile.rows, []);
    assert.equal(profile.poc, null);
    assert.equal(profile.val, null);
    assert.equal(profile.vah, null);
    assert.equal(profile.totalVolume, 0);
    assert.equal(profile.totalValue, 0);
    assert.equal(profile.validBars, bars.length);
    assert.equal(profile.excludedBars, 0);
  }
});

test("HTS validation reports excluded volume and abnormal OHLC without filling missing data with zero", () => {
  type InputBar = Parameters<typeof volumeProfile>[0][number];
  const invalid: InputBar[] = [
    { low: 100, high: 110, volume: Number.NaN },
    { low: 100, high: 110, volume: Number.POSITIVE_INFINITY },
    { low: 100, high: 110, volume: -1 },
    { low: 100, high: 110, volume: 0, volumeValid: false },
    { low: 100, high: 110 } as InputBar,
    { low: 100, high: 110, volume: null } as unknown as InputBar,
    { low: 110, high: 100, volume: 100 },
    { low: 0, high: 110, volume: 100 },
    { low: -1, high: 110, volume: 100 },
    { low: 100, high: Infinity, volume: 100 },
    { low: NaN, high: 110, volume: 100 },
    { low: 100, high: 110, close: 120, volume: 100 },
    { low: 100, high: 110, open: 90, volume: 100 },
    { low: 100, high: 110, close: NaN, volume: 100 },
  ];
  const profile = volumeProfile([...invalid, { low: 100, high: 110, open: 100, close: 110, volume: 10 }], 2);
  assert.equal(profile.excludedBars, invalid.length);
  assert.equal(profile.validBars, 1);
  assert.equal(profile.totalVolume, 10);
  assert.deepEqual(profile.rows.map((row) => row.volume), [5, 5]);
  const none = volumeProfile(invalid);
  assert.equal(none.excludedBars, invalid.length);
  assert.equal(none.validBars, 0);
  assert.deepEqual(none.rows, []);
  const reportedZero = volumeProfile([{ low: 100, high: 110, volume: 0, volumeValid: true }]);
  assert.equal(reportedZero.validBars, 1);
  assert.equal(reportedZero.excludedBars, 0);
});

test("HTS percentage denominator includes every bin, independent of price-axis clipping", () => {
  const profile = volumeProfile([{ low: 100, high: 200, volume: 1000 }], 10);
  const visibleRows = profile.rows.filter((row) => row.low >= 150);
  assert.equal(visibleRows.length, 5);
  assert.equal(visibleRows.reduce((sum, row) => sum + row.percent, 0), 50);
  assert.ok(visibleRows.every((row) => row.percent === 10));
  assert.equal(profile.totalValue, 1000);
  assert.deepEqual(volumeProfile([{ low: 100, high: 200, volume: 1000 }], 10), profile,
    "fixed-period calculation receives the same bars while the viewport scrolls");
});

test("HTS volume and percentages are conserved across fractional volumes and many bins", () => {
  // Deterministic synthetic numerical fixture, not fabricated market data.
  const bars = Array.from({ length: 257 }, (_, index) => {
    const low = 100 + ((index * 17) % 101) / 7;
    return { low, high: low + ((index * 31) % 37) / 11, volume: ((index * 19) % 71) / 13 };
  });
  const expected = bars.reduce((sum, entry) => sum + entry.volume, 0);
  for (const rows of [1, 2, 10, 29, 100, 257]) {
    const profile = volumeProfile(bars, rows);
    near(profile.totalVolume, expected);
    near(profile.rows.reduce((sum, row) => sum + row.volume, 0), expected);
    near(profile.totalValue, expected);
    near(profile.rows.reduce((sum, row) => sum + row.percent, 0), 100);
    assert.ok(profile.rows.every((row) => Number.isFinite(row.volume) && Number.isFinite(row.percent)));
  }
});

test("HTS 1..29 bars are displayed and quantity units are preserved without rounding", () => {
  for (let length = 1; length < 30; length++) {
    const profile = volumeProfile(Array.from({ length }, () => ({ low: 100, high: 110, volume: 0.125 })), 3);
    assert.equal(profile.rows.length, 3);
    near(profile.totalVolume, length * 0.125);
    near(profile.rows[0]!.volume, (length * 0.125) / 3);
    near(profile.rows.reduce((sum, row) => sum + row.percent, 0), 100);
  }
});

test("HTS turnover preserves raw totalVolume while percentages use the selected value basis", () => {
  const profile = volumeProfile([
    { low: 100, high: 110, close: 110, volume: 10 },
    { low: 110, high: 120, close: 115, volume: 20 },
  ], 2, 0.7, "turnover");
  assert.equal(profile.basis, "turnover");
  assert.equal(profile.totalVolume, 30);
  assert.equal(profile.totalValue, 3400);
  assert.deepEqual(profile.rows.map((row) => row.volume), [1100, 2300]);
  near(profile.rows[0]!.percent, (1100 / 3400) * 100);
  near(profile.rows.reduce((sum, row) => sum + row.percent, 0), 100);
  const midpoint = volumeProfile([{ low: 100, high: 120, volume: 3 }], 2, 0.7, "turnover");
  assert.equal(midpoint.totalValue, 330, "legacy absent-close midpoint estimate is retained");
});

test("HTS invalid bin/area settings and arithmetic overflow do not produce NaN", () => {
  for (const count of [0, -5, NaN, Infinity, 2.9, 2000]) {
    const profile = volumeProfile([{ low: 100, high: 120, volume: 5 }], count, NaN);
    assert.ok(profile.rows.length >= 1 && profile.rows.length <= 1000);
    near(profile.totalValue, 5);
    assert.ok(profile.rows.every((row) => Number.isFinite(row.percent)));
  }
  const overflow = volumeProfile([{ low: 1e200, high: 1e200, volume: 1e200 }], 10, 0.7, "turnover");
  assert.equal(overflow.excludedBars, 1);
  assert.equal(overflow.totalVolume, 0);
  assert.deepEqual(overflow.rows, []);
});

test("HTS tied POC always chooses the lower-price bin", () => {
  const profile = volumeProfile([{ low: 100, high: 140, volume: 400 }], 4);
  assert.equal(profile.poc, 105);
  assert.equal(profile.val, 100);
  assert.equal(profile.vah, 130);
});

test("HTS value area expands toward the larger neighbour and ties choose lower", () => {
  const points = (volumes: number[]) => [
    { low: 100, high: 100 + volumes.length * 10, volume: 0 },
    ...volumes.map((volume, index) => ({ low: 105 + index * 10, high: 105 + index * 10, volume })),
  ];
  // POC=125; equal 20 neighbours => first add 115, hitting exactly 60%.
  const tied = volumeProfile(points([10, 20, 40, 20, 10]), 5, 0.6);
  assert.equal(tied.poc, 125);
  assert.equal(tied.val, 110);
  assert.equal(tied.vah, 130);
  // Larger upper neighbour=30; it alone reaches 70%.
  const larger = volumeProfile(points([10, 10, 40, 30, 10]), 5, 0.7);
  assert.equal(larger.val, 120);
  assert.equal(larger.vah, 140);
  // Only adjacent bins compete: the low outer bin cannot be selected early.
  const adjacent = volumeProfile(points([29, 1, 40, 20, 10]), 5, 0.6);
  assert.equal(adjacent.val, 120);
  assert.equal(adjacent.vah, 140);
  const all = volumeProfile(points([10, 20, 40, 20, 10]), 5, 1);
  assert.equal(all.val, 100);
  assert.equal(all.vah, 150);
});

test("HTS uniform price scaling preserves quantity and rejects mixed adjusted-close OHLC", () => {
  const bars = [{ low: 100, high: 120, close: 110, volume: 200 }];
  const original = volumeProfile(bars, 2);
  const consistentlyScaled = volumeProfile(bars.map((entry) => ({ ...entry, low: entry.low / 2, high: entry.high / 2, close: entry.close / 2 })), 2);
  assert.deepEqual(original.rows.map((row) => row.volume), consistentlyScaled.rows.map((row) => row.volume));
  assert.deepEqual(original.rows.map((row) => row.percent), consistentlyScaled.rows.map((row) => row.percent));
  assert.equal(consistentlyScaled.totalVolume, original.totalVolume, "price scaling does not imply quantity scaling");
  assert.equal(consistentlyScaled.poc, original.poc! / 2);
  const mixed = volumeProfile([{ ...bars[0]!, close: 55 }], 2);
  assert.equal(mixed.excludedBars, 1);
  assert.deepEqual(mixed.rows, []);
  assert.equal("adjusted" in original, false, "calculation cannot fabricate source adjustment metadata");
});

test("HTS Wilder RSI matches the independently published 14-period reference sample", () => {
  const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46, 46.03, 46.41, 46.22, 45.64, 46.21];
  const result = rsi(closes);
  assert.ok(result.slice(0, 14).every((value) => value === null));
  // Wilder seed: gains=3.34/14, losses=1.40/14, RSI=70.464135... .
  close6(result.slice(14), [70.464135, 66.249619, 66.480942, 69.346853, 66.294713, 57.915021, 62.880718], "Wilder reference");
});

test("HTS RSI has explicit rising=100, falling=0, and flat=50 policies", () => {
  const rising = Array.from({ length: 40 }, (_, index) => 10 + index);
  const falling = Array.from({ length: 40 }, (_, index) => 100 - index);
  const flat = Array.from({ length: 40 }, () => 50);
  assert.ok(rsi(rising).slice(14).every((value) => value === 100));
  assert.ok(rsi(falling).slice(14).every((value) => value === 0));
  assert.ok(rsi(flat).slice(14).every((value) => value === 50));
  assert.deepEqual(rsi([10, 13, 12, 14, 12, 16], 3).slice(0, 3), [null, null, null]);
  close6(rsi([10, 13, 12, 14, 12, 16], 3).slice(3), [250 / 3, 500 / 9, 700 / 9], "hand-derived RSI");
});

test("HTS default RSI starts at index 14 and its SMA/EMA signal at index 22", () => {
  const closes = Array.from({ length: 40 }, (_, index) => 100 + Math.sin(index) * 5 + index / 3);
  for (const method of ["sma", "ema"] as const) {
    const result = rsiWithSignal(closes, 14, 9, method);
    assert.equal(result.rsi.length, closes.length);
    assert.equal(result.signal.length, closes.length);
    assert.equal(result.rsi.findIndex((value) => value !== null), 14);
    assert.equal(result.signal.findIndex((value) => value !== null), 22);
    const firstAverage = result.rsi.slice(14, 23).reduce<number>((sum, value) => sum + value!, 0) / 9;
    near(result.signal[22]!, firstAverage);
  }
  assert.deepEqual(rsiWithSignal(closes), rsiWithSignal(closes, 14, 9, "sma"));
  assert.deepEqual(rsiWithSignal([]), { rsi: [], signal: [] });
  assert.ok(rsiWithSignal(closes.slice(0, 22)).signal.every((value) => value === null));
});

test("HTS signal smooths RSI itself, with independent hand-derived SMA and EMA values", () => {
  const closes = [10, 13, 12, 14, 12, 16, 15];
  const smaSignal = rsiWithSignal(closes, 3, 3, "sma");
  const emaSignal = rsiWithSignal(closes, 3, 3, "ema");
  const rsi3 = 250 / 3;
  const rsi4 = 500 / 9;
  const rsi5 = 700 / 9;
  const rsi6 = 11200 / 171;
  const seed = (rsi3 + rsi4 + rsi5) / 3;
  near(smaSignal.signal[5]!, seed);
  near(emaSignal.signal[5]!, seed);
  near(smaSignal.signal[6]!, (rsi4 + rsi5 + rsi6) / 3);
  near(emaSignal.signal[6]!, (seed + rsi6) / 2);
  assert.notEqual(smaSignal.signal[6], emaSignal.signal[6]);
  assert.notEqual(smaSignal.signal[5], (14 + 12 + 16) / 3, "not SMA of price");
  assert.notEqual(smaSignal.signal[5], rsi(closes, 3)[5], "not a separate RSI");
});

test("HTS RSI and its signal restart warmup after invalid prices without bridging the gap", () => {
  for (const invalid of [NaN, Infinity, -Infinity, 0, -1, undefined, null]) {
    const closes = [10, 11, 12, invalid, 20, 21, 22, 23, 24] as number[];
    for (const method of ["sma", "ema"] as const) {
      const result = rsiWithSignal(closes, 2, 2, method);
      assert.deepEqual(result.rsi, [null, null, 100, null, null, null, 100, 100, 100]);
      assert.deepEqual(result.signal, [null, null, null, null, null, null, null, 100, 100]);
    }
  }
});

test("HTS invalid periods remain null and period-one signals equal RSI", () => {
  const closes = [10, 11, 12, 11, 13, 14];
  for (const period of [0, -1, 1.5, NaN, Infinity]) {
    assert.deepEqual(rsi(closes, period), closes.map(() => null));
    assert.deepEqual(rsiWithSignal(closes, 2, period).signal, closes.map(() => null));
  }
  assert.deepEqual(rsi(closes, 1), [null, 100, 100, 0, 100, 100]);
  for (const method of ["sma", "ema"] as const) {
    const result = rsiWithSignal(closes, 2, 1, method);
    assert.deepEqual(result.signal, result.rsi);
  }
});

test("HTS RSI replay prefixes contain no future information and loaded values survive viewport slicing", () => {
  const closes = Array.from({ length: 150 }, (_, index) => 100 + index / 20 + Math.sin(index * 0.7) * 10);
  for (const method of ["sma", "ema"] as const) {
    const loaded = rsiWithSignal(closes, 14, 9, method);
    for (const length of [14, 15, 22, 23, 50, 100]) {
      const replay = rsiWithSignal(closes.slice(0, length), 14, 9, method);
      assert.deepEqual(replay.rsi, loaded.rsi.slice(0, length));
      assert.deepEqual(replay.signal, loaded.signal.slice(0, length));
    }
    const leftViewport = loaded.rsi.slice(20, 70);
    const rightViewport = loaded.rsi.slice(50, 100);
    assert.deepEqual(leftViewport.slice(30), rightViewport.slice(0, 20));
    assert.ok(loaded.signal.slice(50, 100).every((value) => value !== null));
  }
});
