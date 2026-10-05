import test from "node:test";
import assert from "node:assert/strict";
import { defaultIndicators, type IndicatorInstance } from "../charts/catalog.ts";
import { defaultLayout, parseChartState } from "../charts/persistence.ts";
import { applyBollingerPreset, DEFAULT_BOLLINGER_SYSTEM_CONFIG, migrateBollingerSystem, sanitizeBollingerSettings } from "./config.ts";

test("Bollinger defaults and presets remain timeframe-independent", () => {
  const settings = sanitizeBollingerSettings(undefined);
  assert.deepEqual(settings, DEFAULT_BOLLINGER_SYSTEM_CONFIG);
  assert.equal(settings.alerts, false);
  assert.equal(settings.panesExpanded, null);
  const short = applyBollingerPreset(settings, "fidelity-short");
  assert.equal(short.period, 10); assert.equal(short.mult, 1.5);
  const long = applyBollingerPreset(settings, "fidelity-long");
  assert.equal(long.period, 50); assert.equal(long.mult, 2.5);
  assert.equal(long.bbwLookback, 125);
  assert.deepEqual(applyBollingerPreset(settings, "unknown"), settings);
  assert.equal(sanitizeBollingerSettings({ ...settings, mode: "investment" }).period, 20);
});

test("Bollinger settings reject damaged types, clamp values and enforce dependent bounds", () => {
  const actual = sanitizeBollingerSettings({ enabled: "false", overlay: false, period: NaN, mult: Infinity, source: "unsupported", basis: "ema", bbwLookback: -3, extremeThreshold: 20, squeezeThreshold: 5, compressionThreshold: 10, walkWindow: 2, walkCount: 9, pivotLeft: 8, pivotRight: 8, patternMaxBars: 5, overlayColor: "javascript:bad", alertSignals: ["squeeze", "squeeze", "oops"] });
  assert.equal(actual.enabled, true); assert.equal(actual.overlay, false);
  assert.equal(actual.period, 20); assert.equal(actual.mult, 2);
  assert.equal(actual.source, "close"); assert.equal(actual.basis, "sma");
  assert.equal(actual.bbwLookback, 10);
  assert.deepEqual([actual.extremeThreshold, actual.squeezeThreshold, actual.compressionThreshold], [20, 20, 20]);
  assert.equal(actual.walkCount, 2); assert.equal(actual.patternMaxBars, 17);
  assert.equal(actual.overlayColor, undefined);
  assert.deepEqual(actual.alertSignals, ["squeeze"]);
  const off = sanitizeBollingerSettings({ enabled: false, panesExpanded: false, alertSignals: [] });
  assert.equal(off.enabled, false); assert.equal(off.panesExpanded, false); assert.deepEqual(off.alertSignals, []);
});

test("legacy default BB is adopted once without deleting custom periods, colors or OFF", () => {
  const indicators: IndicatorInstance[] = [
    { uid: "old-default", id: "bb", params: { period: 20, mult: 2 }, visible: false, color: "#ABCDEF" },
    { uid: "custom", id: "bb", params: { period: 30, mult: 2.3 }, visible: true, color: "#123456" },
    { uid: "another-default-looking", id: "bb", params: { period: 20, mult: 2 }, visible: true },
  ];
  const first = migrateBollingerSystem(indicators);
  assert.deepEqual(first.indicators, indicators);
  assert.equal(first.settings.adoptedIndicatorUid, "old-default");
  assert.equal(first.settings.overlay, false); assert.equal(first.settings.overlayColor, "#ABCDEF");
  assert.deepEqual(migrateBollingerSystem(first.indicators, first.settings), first);
  assert.deepEqual(migrateBollingerSystem(indicators.slice(1, 2)).indicators, indicators.slice(1, 2));
  const noDefault = migrateBollingerSystem(indicators.slice(1, 2));
  assert.equal(noDefault.settings.adoptedIndicatorUid, undefined);
  assert.equal(noDefault.settings.period, 20);
});

test("versioned system settings win over legacy reference on reload and preserve unrelated layout", () => {
  const layout = defaultLayout(defaultIndicators("KR"), "hollow", "log");
  assert.equal(layout.bollinger?.version, 1);
  assert.equal(layout.indicators.filter(i => i.id === "bb").length, 1);
  assert.equal(layout.bollinger?.overlayColor, undefined);
  const configured = { ...layout, bollinger: sanitizeBollingerSettings({ ...layout.bollinger, period: 50, mult: 2.5, enabled: false, overlayColor: "#987654" }), drawings: [{ id: "line", type: "hline", anchors: [{ t: "2026-01-01", p: 100 }], color: "#123456", width: 2, hidden: false, locked: true }] };
  const loaded = parseChartState(JSON.stringify(configured));
  assert.equal(loaded?.bollinger?.period, 50); assert.equal(loaded?.bollinger?.mult, 2.5);
  assert.equal(loaded?.bollinger?.enabled, false); assert.equal(loaded?.bollinger?.overlayColor, "#987654");
  assert.equal(loaded?.chartType, "hollow"); assert.equal(loaded?.scale, "log");
  assert.deepEqual(loaded?.drawings, configured.drawings);
  assert.deepEqual(parseChartState(JSON.stringify(loaded)), loaded);
  assert.deepEqual(parseChartState(JSON.stringify({ ...layout, bollinger: "damaged" }))?.indicators, JSON.parse(JSON.stringify(layout.indicators)));
});

test("native BB pane choices persist independently and reject invalid heights", () => {
  assert.deepEqual(sanitizeBollingerSettings({ paneHeights: { percentB: 200, bandwidth: 300 } }).paneHeights, { percentB: 200, bandwidth: 300 });
  assert.deepEqual(sanitizeBollingerSettings({ paneHeights: { percentB: -5, bandwidth: Infinity } }).paneHeights, { percentB: 34, bandwidth: 100 });
  assert.deepEqual(sanitizeBollingerSettings({ paneHeights: { percentB: 900, bandwidth: "200" } }).paneHeights, { percentB: 600, bandwidth: 100 });
});

test("adopted BB multiplier retains the existing generic catalog's full supported range", () => {
  for (const mult of [0.001, 0.1, 2, 20, 100]) assert.equal(sanitizeBollingerSettings({ mult }).mult, mult);
  assert.equal(sanitizeBollingerSettings({ mult: -1 }).mult, 0.001);
  assert.equal(sanitizeBollingerSettings({ mult: 101 }).mult, 100);
  assert.equal(sanitizeBollingerSettings({ mult: "20" }).mult, 2);
  assert.equal(sanitizeBollingerSettings({ mult: NaN }).mult, 2);
  const reference: IndicatorInstance = { uid: "adopted", id: "bb", params: { period: 20, mult: 20 }, visible: true };
  const result = migrateBollingerSystem([reference], { version: 1, adoptedIndicatorUid: "adopted", mult: 20 });
  assert.equal(result.settings.mult, 20);
  assert.equal(result.indicators[0]?.params.mult, 20);
});
