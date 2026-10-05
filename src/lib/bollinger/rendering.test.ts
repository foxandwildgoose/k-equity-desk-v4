import test from "node:test";
import assert from "node:assert/strict";
import { BOLLINGER_PERCENT_B_GUIDES, bollingerFillPolygons, bollingerMiddleVisible, bollingerPaneCount, bollingerPanePlan, getBollingerRenderingStyle, percentBAutoscaleRange, type BollingerFillRow } from "./rendering.ts";

test("BB middle auto avoids only the genuinely equivalent visible SMA20", () => {
  const standard = { middle: "auto" as const, period: 20, source: "close" as const, basis: "sma" as const };
  assert.equal(bollingerMiddleVisible(standard, true), false);
  assert.equal(bollingerMiddleVisible(standard, false), true);
  assert.equal(bollingerMiddleVisible({ ...standard, period: 30 }, true), true);
  assert.equal(bollingerMiddleVisible({ ...standard, source: "hlc3" }, true), true);
  assert.equal(bollingerMiddleVisible({ ...standard, middle: "on" }, true), true);
  assert.equal(bollingerMiddleVisible({ ...standard, middle: "off" }, false), false);
});

test("master/collapse/child pane options are independent and consume deterministic native slots", () => {
  const enabled = { enabled: true, percentB: true, bandwidth: true };
  assert.deepEqual(bollingerPanePlan(enabled, true, 7), { percentB: 7, bandwidth: 8, paneCount: 2 });
  assert.deepEqual(bollingerPanePlan({ ...enabled, percentB: false }, true, 7), { percentB: null, bandwidth: 7, paneCount: 1 });
  assert.equal(bollingerPaneCount(enabled, false), 0);
  assert.equal(bollingerPaneCount({ ...enabled, enabled: false }, true), 0);
});

test("%B references include 0/1 without clamping valid out-of-band observations", () => {
  assert.deepEqual(BOLLINGER_PERCENT_B_GUIDES, [1, 0.8, 0.5, 0.2, 0]);
  assert.deepEqual(percentBAutoscaleRange(-0.4, 1.7), { minValue: -0.4, maxValue: 1.7 });
  assert.deepEqual(percentBAutoscaleRange(0.4, 0.6), { minValue: 0, maxValue: 1 });
});

test("native band fill uses only continuous valid bands, clips the requested index window and retains zero-width rows", () => {
  const rows = [
    { time: 0, upper: 2, lower: 1 }, { time: 1, upper: 3, lower: 2 },
    { time: 2, upper: null, lower: null }, { time: 3, upper: 5, lower: 5 },
    { time: 4, upper: 6, lower: 4 }, { time: 5, upper: NaN, lower: 4 },
    { time: 6, upper: 1, lower: 2 }, { time: 7, upper: 8, lower: 7 },
  ];
  const project = (row: BollingerFillRow) => ({ x: Number(row.time) * 10, upperY: row.upper!, lowerY: row.lower! });
  const polygons = bollingerFillPolygons(rows, project);
  assert.equal(polygons.length, 2);
  assert.deepEqual(polygons.map(polygon => polygon.map(vertex => vertex.x)), [[0, 10], [30, 40]]);
  assert.deepEqual(bollingerFillPolygons(rows, project, 3, 4), [polygons[1]]);
  assert.deepEqual(bollingerFillPolygons(rows, () => null), []);
  assert.deepEqual(bollingerFillPolygons([], project), []);
});

test("BB rendering styles follow theme while genuine custom overlays retain their selected color", () => {
  const light = getBollingerRenderingStyle("light");
  const dark = getBollingerRenderingStyle("dark");
  assert.notEqual(light.upper, dark.upper);
  assert.notEqual(light.percentB, dark.percentB);
  assert.ok(light.fillOpacity < 0.1 && dark.fillOpacity < 0.1);
  for (const mode of ["light", "dark"] as const) {
    const custom = getBollingerRenderingStyle(mode, "#123456");
    assert.equal(custom.upper, "#123456");
    assert.equal(custom.lower, "#123456");
    assert.equal(custom.middle, "#123456");
    assert.equal(custom.fill, "#123456");
    assert.equal(custom.bandwidth, getBollingerRenderingStyle(mode).bandwidth);
  }
});
