import assert from "node:assert/strict";
import { test } from "node:test";
import {
  drawingReducer,
  fibExtensionLevels,
  fibRetracementLevels,
  initHistory,
  magnetPrice,
  newDrawing,
  positionStats,
  snapPrice,
  distToSegment,
  type Drawing,
} from "./drawings.ts";
import { chartStateKey, defaultLayout, DEFAULT_OVERLAYS, loadChartState, migrateLegacyDrawings, migrateLegacyOnce, parseChartState, saveChartState, type StorageLike } from "./persistence.ts";
import { computeInstance, INDICATORS, indicatorCacheKey, newInstance, sanitizeParams, searchIndicators, INDICATOR_BY_ID, defaultIndicators } from "./catalog.ts";
import { alignByTime, barsToCsv, capBars, chartExportName, extendedHoursRuns, normalizeLogicalRange, percentFromFirstVisible, recentBarsLogicalRange, replaySlice, replayStep, sessionBreaks, visibleWindow } from "./tools.ts";
import { sma, rsi } from "../chart-indicators.ts";

function memStore(init: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k] };
}

test("native axis resize roundoff preserves the selected candle window and fractional pans", () => {
  const noise = 2.842170943040401e-14;
  assert.deepEqual(normalizeLogicalRange({ from: noise, to: 164 - noise }), { from: 0, to: 164 });
  assert.deepEqual(normalizeLogicalRange({ from: -noise, to: 164 + noise }), { from: 0, to: 164 });
  assert.deepEqual(visibleWindow(160, { from: noise, to: 159 - noise }), { from: 0, to: 159 });
  assert.deepEqual(visibleWindow(200, { from: 122 + noise, to: 165 - noise }), { from: 122, to: 165 });
  assert.deepEqual(normalizeLogicalRange({ from: 122.0833333333, to: 165.125 }), { from: 122.0833333333, to: 165.125 });
  assert.deepEqual(visibleWindow(200, { from: 122.0833333333, to: 165.125 }), { from: 123, to: 165 });
  assert.equal(normalizeLogicalRange(null), null);
});

test("explicit recent-bar windows fit the requested real-candle count and half-bar boundaries", () => {
  const total = 303;
  for (const count of [120, 250, total]) {
    const range = recentBarsLogicalRange(total, count)!;
    assert.equal(range.to - range.from, count);
    assert.deepEqual(visibleWindow(total, range), { from: total - count, to: total - 1 });
  }
  assert.deepEqual(recentBarsLogicalRange(303, 120), { from: 182.5, to: 302.5 });
  assert.deepEqual(recentBarsLogicalRange(303, 250), { from: 52.5, to: 302.5 });
  assert.deepEqual(recentBarsLogicalRange(80, 250), { from: -0.5, to: 79.5 }, "limited history is shown honestly");
  assert.deepEqual(recentBarsLogicalRange(1, 120), { from: -0.5, to: 0.5 });
  for (const [total, count] of [[0, 120], [303, 0], [303, Number.NaN], [Number.POSITIVE_INFINITY, 120]]) {
    assert.equal(recentBarsLogicalRange(total, count), null);
  }
});

test("AT-36 drawings: create, update, lock, hide, remove, undo/redo, persist", () => {
  let h = initHistory();
  const d1 = newDrawing("trend", [{ t: "2026-09-01", p: 100 }, { t: "2026-09-10", p: 120 }], "d1");
  h = drawingReducer(h, { type: "add", drawing: d1 });
  h = drawingReducer(h, { type: "add", drawing: newDrawing("hline", [{ t: "2026-09-10", p: 110 }], "d2") });
  assert.equal(h.items.length, 2);
  h = drawingReducer(h, { type: "update", id: "d1", patch: { anchors: [{ t: "2026-09-01", p: 101 }, { t: "2026-09-10", p: 121 }] } });
  assert.equal(h.items[0]!.anchors[0]!.p, 101);
  h = drawingReducer(h, { type: "update", id: "d1", patch: { locked: true } });
  const locked = drawingReducer(h, { type: "update", id: "d1", patch: { anchors: [{ t: "2026-09-01", p: 0 }] } });
  assert.equal(locked, h, "locked drawing ignores geometry edits");
  h = drawingReducer(h, { type: "update", id: "d2", patch: { hidden: true } });
  assert.equal(h.items[1]!.hidden, true);
  h = drawingReducer(h, { type: "remove", id: "d2" });
  assert.equal(h.items.length, 1);
  h = drawingReducer(h, { type: "undo" });
  assert.equal(h.items.length, 2, "undo restores the removed drawing");
  h = drawingReducer(h, { type: "undo" });
  assert.equal(h.items[1]!.hidden, false);
  h = drawingReducer(h, { type: "redo" });
  h = drawingReducer(h, { type: "redo" });
  assert.equal(h.items.length, 1, "redo re-applies");
  // persist round-trip
  const store = memStore();
  const layout = { ...defaultLayout([newInstance("sma", { period: 5 })]), drawings: h.items };
  store.setItem(chartStateKey("KR", "005930", "day"), JSON.stringify(layout));
  const back = parseChartState(store.getItem(chartStateKey("KR", "005930", "day")))!;
  assert.deepEqual(back.drawings, h.items);
  assert.equal(back.indicators[0]!.params.period, 5);
});

test("drawing maths: fib levels, position R:R, magnet + KRX snapping, hit distance", () => {
  const fib = fibRetracementLevels(100, 200);
  assert.deepEqual(fib.map((l) => Math.round(l.price * 100) / 100), [200, 176.4, 161.8, 150, 138.2, 121.4, 100]);
  assert.equal(fibExtensionLevels(100, 150, 120).find((l) => l.level === 1)!.price, 170);
  const long = newDrawing("long", [{ t: 1, p: 100 }, { t: 5, p: 110 }], "p");
  assert.equal(long.anchors[2]!.p, 95, "default stop = half the target distance");
  const st = positionStats("long", 100, 110, 95);
  assert.equal(st.rr, 2);
  assert.equal(st.targetPct, 10);
  assert.equal(st.stopPct, -5);
  assert.equal(positionStats("short", 100, 90, 105).rr, 2);
  assert.equal(magnetPrice(104.2, { open: 100, high: 105, low: 99, close: 103 }), 105);
  assert.equal(snapPrice(12_345, { market: "KR" }), 12_350, "KRX tick 10 below 20,000");
  assert.equal(snapPrice(10_003, { market: "KR", instrument: "etf" }), 10_005, "ETF tick 5");
  assert.equal(snapPrice(1.2345, { market: "US" }), 1.23);
  assert.equal(distToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 5);
  assert.equal(distToSegment({ x: 20, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, "ray"), 0);
});

test("AT-39 layout key format and one-time legacy migration", () => {
  assert.equal(chartStateKey("KR", "005930", "day"), "ked:chart:v2:KR:005930:day");
  assert.equal(chartStateKey("US", "nvda", "minute"), "ked:chart:v2:US:NVDA:minute");
  const legacy = JSON.stringify([
    { id: "a", type: "hline", price: 71000, color: "#fff", label: "지지" },
    { id: "b", type: "trend", t1: 0, p1: 70000, t2: 2, p2: 72000, color: "#0f0" },
    { id: "c", type: "fib", t1: 1, p1: 1, t2: 99, p2: 2 },
  ]);
  const times = ["2026-09-01", "2026-09-02", "2026-09-03"];
  const m = migrateLegacyDrawings(legacy, times);
  assert.equal(m.drawings.length, 2);
  assert.equal(m.dropped, 1, "out-of-range bar index dropped, never guessed");
  assert.deepEqual(m.drawings[1]!.anchors, [{ t: "2026-09-01", p: 70000 }, { t: "2026-09-03", p: 72000 }]);
  const store = memStore({ "ke-chart-draw:005930": legacy });
  const n = migrateLegacyOnce(store, "005930", times, defaultLayout([]));
  assert.equal(n, 2);
  assert.equal(store.getItem("ke-chart-draw:005930"), null, "legacy key removed");
  const saved = parseChartState(store.getItem("ked:chart:v2:KR:005930:day"))!;
  assert.equal(saved.drawings.length, 2);
  assert.equal(migrateLegacyOnce(store, "005930", times, defaultLayout([])), 0, "runs once");
  assert.equal(parseChartState("{bad json"), null);
  assert.equal(parseChartState(JSON.stringify({ v: 1 })), null);
});

test("chart annotations start OFF and preserve prior combined report/target and dividend/split choices", () => {
  assert.ok(Object.values(DEFAULT_OVERLAYS).every((enabled) => enabled === false));
  assert.deepEqual(defaultLayout([]).overlays, DEFAULT_OVERLAYS);
  for (const enabled of [true, false]) {
    const state = parseChartState(JSON.stringify({ v: 2, overlays: { research: enabled, dividends: enabled, disclosures: true } }))!;
    assert.equal(state.overlays.research, enabled);
    assert.equal(state.overlays.targets, enabled);
    assert.equal(state.overlays.dividends, enabled);
    assert.equal(state.overlays.splits, enabled);
    assert.equal(state.overlays.disclosures, true);
    assert.equal(state.overlays.signals, false);
  }
  const separated = parseChartState(JSON.stringify({ v: 2, overlays: { research: true, targets: false, dividends: false, splits: true } }))!;
  assert.deepEqual([separated.overlays.research, separated.overlays.targets, separated.overlays.dividends, separated.overlays.splits], [true, false, false, true]);
});

test("annotation persistence strictly validates booleans without truthy strings or arbitrary stored keys", () => {
  for (const overlays of [null, [], true, { disclosures: "false", research: "true", targets: 1, dividends: "on", splits: 0, news: {}, signals: null, injected: true }]) {
    assert.deepEqual(parseChartState(JSON.stringify({ v: 2, overlays }))!.overlays, DEFAULT_OVERLAYS);
  }
  const first = defaultLayout([]);
  first.overlays.targets = true;
  assert.equal(defaultLayout([]).overlays.targets, false, "defaults are independent mutable state");
  const store = memStore();
  saveChartState(store, "KR", "005930", "day", first);
  assert.deepEqual(loadChartState(store, "KR", "005930", "day")!.overlays, first.overlays);
  assert.equal(loadChartState(store, "KR", "005930", "week"), null);
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); }, removeItem: () => {} };
  assert.equal(loadChartState(blocked, "KR", "005930", "day"), null);
  assert.doesNotThrow(() => saveChartState(blocked, "KR", "005930", "day", first));
});

test("indicator catalog: every definition computes, params sanitized, memo key", () => {
  // synthetic fixture (format sample), not market data
  const N = 80;
  const close = Array.from({ length: N }, (_, i) => 100 + Math.sin(i / 5) * 10 + i * 0.2);
  const bars = { open: close.map((c) => c - 0.5), high: close.map((c) => c + 1), low: close.map((c) => c - 1), close, volume: close.map((_, i) => 1000 + i * 10) };
  const times = close.map((_, i) => i);
  for (const def of INDICATORS) {
    const out = computeInstance(newInstance(def.id), bars, times);
    for (const o of def.outputs) assert.equal(out[o.key]?.length, N, `${def.id}.${o.key}`);
  }
  const avwap = newInstance("avwap");
  assert.ok(computeInstance(avwap, bars, times).v!.every((v) => v == null), "no anchor → nothing drawn");
  assert.equal(computeInstance({ ...avwap, anchorTime: 10 }, bars, times).v![9], null);
  assert.ok(computeInstance({ ...avwap, anchorTime: 10 }, bars, times).v![10] != null);
  assert.deepEqual(sanitizeParams(INDICATOR_BY_ID.get("rsi")!, { period: "0.4" }), { period: 2 });
  assert.equal(searchIndicators("볼린저")[0]!.id, "bb");
  assert.ok(searchIndicators("vwap").length >= 2);
  const inst = newInstance("sma", { period: 7 });
  assert.notEqual(indicatorCacheKey(1, inst), indicatorCacheKey(2, inst));
  assert.equal(defaultIndicators("US").filter((i) => i.id === "sma").length, 5);
});

test("AT-37 compare: percent from the first visible bar; exact time alignment", () => {
  assert.deepEqual(percentFromFirstVisible([50, 100, 110, null, 90], 1), [null, 0, 10, null, -10]);
  assert.deepEqual(alignByTime(["a", "b", "c"], [{ time: "a", close: 1 }, { time: "c", close: 3 }]), [1, null, 3]);
});

test("AT-40 replay hides future bars; indicators on the slice have no lookahead", () => {
  const close = Array.from({ length: 50 }, (_, i) => 100 + ((i * 7) % 11));
  const slice = replaySlice(close, 29);
  assert.equal(slice.length, 30);
  assert.equal(slice[slice.length - 1], close[29]);
  const full = sma(close, 5);
  assert.deepEqual(sma(slice, 5), full.slice(0, 30), "causal indicator matches the full history up to the cursor");
  assert.deepEqual(rsi(slice, 14), rsi(close, 14).slice(0, 30));
  assert.equal(replayStep(28, 50), 29);
  assert.equal(replayStep(48, 50), null, "stops at the last bar");
  assert.equal(replaySlice(close, null).length, 50);
});

test("AT-41 export names carry symbol + interval + KST timestamp; CSV = given rows", () => {
  const now = Date.parse("2026-09-26T08:05:00Z");
  assert.equal(chartExportName("KR", "005930", "day", "png", now), "ked-chart-KR-005930-day-20260926-1705.png");
  assert.equal(chartExportName("US", "brk.b", "minute", "csv", now), "ked-chart-US-BRK.B-minute-20260926-1705.csv");
  const csv = barsToCsv([{ time: "2026-09-25", open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }], [{ name: "sma5", values: [null] }]).split("\n");
  assert.equal(csv[0], "time,open,high,low,close,volume,sma5");
  assert.equal(csv[1], "2026-09-25,1,2,0.5,1.5,10,");
  assert.equal(capBars(Array.from({ length: 12_000 }, (_, i) => i)).length, 10_000);
});

test("extended hours + session breaks only from real intraday bars", () => {
  // 2026-09-24 ET: 08:00 (pre), 09:30 (regular), 16:30 (post); next day 09:30
  const t = (iso: string) => Date.parse(iso) / 1000;
  const bars = [t("2026-09-24T12:00:00Z"), t("2026-09-24T13:30:00Z"), t("2026-09-24T20:30:00Z"), t("2026-09-25T13:30:00Z")].map((time) => ({ time }));
  assert.deepEqual(extendedHoursRuns(bars, "US"), [{ from: bars[0]!.time as number, to: bars[0]!.time as number }, { from: bars[2]!.time as number, to: bars[2]!.time as number }]);
  assert.deepEqual(sessionBreaks(bars, "US"), [bars[3]!.time]);
  assert.deepEqual(extendedHoursRuns([{ time: "2026-09-24" }], "US"), [], "daily bars are never shaded");
});

export type _Unused = Drawing;

test("bar time: daily keeps the date; intraday wall clock → unix seconds per market zone", async () => {
  const { barTimeOf, dayOfTime } = await import("./bar-time.ts");
  assert.equal(barTimeOf("2026-09-25", "KR"), "2026-09-25");
  assert.equal(barTimeOf("2026-09-25 09:00", "KR"), Date.parse("2026-09-25T00:00:00Z") / 1000);
  assert.equal(barTimeOf("2026-09-25 09:30", "US"), Date.parse("2026-09-25T13:30:00Z") / 1000);
  assert.equal(dayOfTime(Date.parse("2026-09-25T15:30:00Z") / 1000, "KR"), "2026-09-26");
  assert.equal(dayOfTime(Date.parse("2026-09-25T15:30:00Z") / 1000, "US"), "2026-09-25");
});
