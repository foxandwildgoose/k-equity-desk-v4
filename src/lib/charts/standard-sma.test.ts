import test from "node:test";
import assert from "node:assert/strict";
import { sma } from "../chart-indicators.ts";
import { defaultIndicators, instanceLabel, newInstance } from "./catalog.ts";
import { defaultLayout, parseChartState } from "./persistence.ts";
import { alignSmaValues, getStandardSmaStyle, latestSmaPoint, layoutSmaLabels, migrateStandardSmas, prepareSmaHistory, resolveSmaStyle, smaHistoryRange, STANDARD_SMA_PERIODS, standardSmaValues, toggleStandardSma } from "./standard-sma.ts";

const values = Array.from({ length: 400 }, (_, i) => i + 1);
const rows = values.map((value, time) => ({ time, value }));

test("all standard periods use complete O(n) rolling windows and preserve zero/negative observations", () => {
  for (const period of STANDARD_SMA_PERIODS) {
    const result = sma(values, period);
    assert.ok(result.slice(0, period - 1).every(v => v === null));
    for (let i = period - 1; i < values.length; i++) assert.equal(result[i], i + 1 - (period - 1) / 2);
  }
  assert.deepEqual(sma([-5, 0, 5, NaN, 5, 0, -5], 3), [null, null, 0, null, null, null, 0]);
  for (const invalid of [0, -1, 1.5, NaN]) assert.ok(sma(values, invalid).every(v => v === null));
});

test("pre-roll aligns by timestamp to a shorter displayed range and is invariant under viewport zoom", () => {
  const display = rows.slice(-25);
  const result = standardSmaValues(display, rows);
  for (const period of STANDARD_SMA_PERIODS) assert.deepEqual(result[period], sma(values, period).slice(-25));
  assert.equal(result[200][0], 276.5);
  assert.deepEqual(standardSmaValues(rows.slice(-10), rows)[200], result[200].slice(-10));
  assert.deepEqual(alignSmaValues(rows, sma(values, 200), [{ time: 250 }, { time: -1 }]), [151.5, null]);
});

test("replay excludes future calculation rows; displayed corrections win; pre-roll survives display cap", () => {
  const display = rows.slice(300, 320);
  const futureShock = rows.map(row => row.time > 319 ? { ...row, value: 1e9 } : row);
  assert.deepEqual(standardSmaValues(display, futureShock), standardSmaValues(display, rows));
  assert.ok(prepareSmaHistory(display, futureShock).every(row => row.time <= 319));
  const corrected = [...display.slice(0, -1), { time: 319, value: -85 }];
  assert.equal(prepareSmaHistory(corrected, rows).at(-1)?.value, -85);
  const many = Array.from({ length: 10500 }, (_, time) => ({ time, value: time }));
  const capped = many.slice(-10000);
  assert.equal(prepareSmaHistory(capped, many).length, 10499);
  assert.notEqual(standardSmaValues(capped.slice(0, 1), many)[200][0], null);
});

test("minute/day/week/month/year semantics average selected-frame bars without session resets", () => {
  for (const interval of ["minute", "day", "week", "month", "year"]) {
    const frame = rows.map((row, i) => ({ value: row.value, time: interval === "minute" ? 100000 + i * 300
      : interval === "month" ? new Date(Date.UTC(1980, i, 1)).toISOString().slice(0, 10)
      : interval === "year" ? `${1700 + i}-01-01`
      : new Date(Date.UTC(2024, 0, 1) + i * (interval === "week" ? 7 : 1) * 86400000).toISOString().slice(0, 10) }));
    const result = standardSmaValues(frame.slice(-20), frame);
    assert.deepEqual(result[200], sma(values, 200).slice(-20), interval);
  }
  for (const minuteSize of [1, 3, 5, 10, 15, 30, 60]) {
    const frame = rows.map(row => ({ ...row, time: 100000 + row.time * minuteSize * 60 }));
    assert.deepEqual(standardSmaValues(frame.slice(-20), frame)[200], sma(values, 200).slice(-20), `${minuteSize} minute bars across sessions`);
  }
  assert.equal(smaHistoryRange("minute", "1d", 1), "7d");
  assert.equal(smaHistoryRange("minute", "5d", 30), "60d");
  assert.equal(smaHistoryRange("minute", "1mo", 60), "2y");
  assert.equal(smaHistoryRange("week", "1y"), "max");
  assert.equal(smaHistoryRange("month", "1y"), "max");
  assert.equal(smaHistoryRange("day", "1mo"), "2y");
  assert.equal(smaHistoryRange("day", "5y"), "10y");
});

test("fresh KR/US defaults bundle exactly 5/20/60/120/200 with semantic colors", () => {
  for (const market of ["KR", "US"] as const) {
    const indicators = defaultIndicators(market).filter(i => i.id === "sma");
    assert.deepEqual(indicators.map(i => i.params.period), STANDARD_SMA_PERIODS);
    assert.ok(indicators.every(i => i.visible && i.colorMode === "theme" && i.color === undefined));
    assert.deepEqual(indicators.map(instanceLabel), ["SMA5", "SMA20", "SMA60", "SMA120", "SMA200"]);
  }
});

test("legacy migration is deterministic/idempotent; SMA200, SMA50, custom color, OFF and drawings survive", () => {
  const custom = newInstance("sma", { period: 50 }, "#123456");
  const long = { ...newInstance("sma", { period: 200 }, "#abcdef"), visible: false };
  const rsi = newInstance("rsi");
  const legacy = { v: 2, indicators: [custom, long, rsi], drawings: [{ id: "draw", type: "hline", anchors: [{ t: "2026-01-01", p: 1 }] }], chartType: "area", scale: "log", overlays: { news: true } };
  const first = parseChartState(JSON.stringify(legacy))!;
  assert.deepEqual(parseChartState(JSON.stringify(first)), first);
  assert.deepEqual(migrateStandardSmas(migrateStandardSmas([custom, long])), migrateStandardSmas([custom, long]));
  assert.equal(first.indicators.filter(i => i.id === "sma" && Number(i.params.period) === 200).length, 1);
  assert.deepEqual(first.indicators.find(i => i.uid === custom.uid), custom);
  assert.deepEqual(first.indicators.find(i => i.uid === long.uid), long);
  assert.equal(first.indicators.find(i => i.uid === rsi.uid)?.id, "rsi");
  assert.equal(first.drawings[0]?.id, "draw");
  assert.equal(first.chartType, "area"); assert.equal(first.scale, "log"); assert.equal(first.overlays.news, true);
  // A later intentional removal is not undone by every reload.
  const edited = { ...first, indicators: first.indicators.filter(i => Number(i.params.period) !== 120) };
  assert.deepEqual(parseChartState(JSON.stringify(edited)), edited);
});

test("independent toggles share catalog state; removing then enabling re-adds only that SMA", () => {
  const initial = defaultIndicators("KR");
  for (const period of STANDARD_SMA_PERIODS) {
    const off = toggleStandardSma(initial, period);
    assert.equal(off.find(i => i.id === "sma" && i.params.period === period)?.visible, false);
    assert.deepEqual(off.filter(i => i.params.period !== period), initial.filter(i => i.params.period !== period));
    assert.deepEqual(toggleStandardSma(off, period), initial);
  }
  const removed = initial.filter(i => i.params.period !== 120);
  assert.equal(toggleStandardSma(removed, 120).filter(i => i.params.period === 120).length, 1);
  const state = defaultLayout(toggleStandardSma(initial, 200));
  assert.equal(parseChartState(JSON.stringify(state))!.indicators.find(i => i.params.period === 200)?.visible, false);
});

test("exact theme colors, strongest supported width, explicit overrides and reset to semantic default", () => {
  const light = ["#B8860B", "#A23B8F", "#00796B", "#1565C0", "#C62828"];
  const dark = ["#FFD54F", "#E07BCB", "#35D0A0", "#42A5F5", "#FF5C5C"];
  STANDARD_SMA_PERIODS.forEach((period, i) => {
    assert.equal(getStandardSmaStyle(period, "light").color, light[i]);
    assert.equal(getStandardSmaStyle(period, "dark").color, dark[i]);
    assert.equal(getStandardSmaStyle(period, "light").lineWidth, [1, 2, 2, 2, 3][i]);
  });
  const instance = newInstance("sma", { period: 200 }, "#123456");
  assert.equal(resolveSmaStyle(instance, "light")?.color, "#123456");
  assert.equal(resolveSmaStyle(instance, "dark")?.color, "#123456");
  assert.equal(resolveSmaStyle({ ...instance, colorMode: "theme" }, "dark")?.color, "#FF5C5C");
});

test("direct labels disappear when disabled/unavailable; collision layout stays inside pane", () => {
  assert.equal(latestSmaPoint(rows, sma(values, 200), false), null);
  assert.equal(latestSmaPoint(rows.slice(0, 20), sma(values.slice(0, 20), 200), true), null);
  assert.deepEqual(latestSmaPoint(rows, sma(values, 200), true), { time: 399, value: 300.5 });
  const labels = layoutSmaLabels(STANDARD_SMA_PERIODS.map(period => ({ period, y: 98, targetY: 98 })), 120);
  assert.equal(labels.length, 5);
  for (let i = 1; i < labels.length; i++) assert.ok(labels[i]!.y - labels[i - 1]!.y >= 22);
  assert.ok(labels.every(row => row.y >= 16 && row.y <= 104));
  assert.deepEqual(layoutSmaLabels([], 0), []);
});

test("dual-series focus binds averages solely to its source, preserving nulls and signed values", () => {
  const dual = rows.map(row => ({ time: row.time, a: row.value, b: -row.value * 2 }));
  const focused = (key: "a" | "b") => standardSmaValues(dual.map(row => ({ time: row.time, value: row[key] })));
  assert.equal(focused("a")[200].at(-1), 300.5);
  assert.equal(focused("b")[200].at(-1), -601);
  const missing = rows.map(row => row.time === 350 ? { ...row, value: null } : row);
  assert.equal(standardSmaValues(missing)[200].at(-1), null);
});
