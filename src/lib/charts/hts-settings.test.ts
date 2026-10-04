import assert from "node:assert/strict";
import { test } from "node:test";
import { volumeProfile } from "../chart-indicators.ts";
import {
  applyHtsProfilePreset,
  applyChartReadabilityPreset,
  defaultHtsSettings,
  hasSavedHtsSettings,
  HTS_PANEL_ORDER,
  htsSettingsKey,
  LEGACY_VP_KEY,
  loadHtsSettings,
  migrateLegacyHtsSettings,
  parseHtsSettings,
  profileToCsv,
  saveHtsSettings,
  validHtsDate,
  type HtsScope,
  type ProfileMetadata,
} from "./hts-settings.ts";

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
const scope: HtsScope = { market: "KR", instrument: "etf", code: "0043Y0", interval: "day", layout: "etf-detail" };

test("HTS defaults are shared by domestic shares, domestic/foreign-asset ETFs and ETNs", () => {
  for (const instrument of ["stock", "etf", "etn"] as const) {
    const state = defaultHtsSettings("KR", instrument);
    assert.equal(state.enabled, true);
    assert.deepEqual(HTS_PANEL_ORDER, ["rsi", "price", "credit", "foreign", "investmentTrust", "volume"]);
    assert.ok(HTS_PANEL_ORDER.every((panel) => state.collapsed[panel] === false));
    assert.equal(state.rsiPeriod, 14);
    assert.equal(state.signalPeriod, 9);
    assert.equal(state.signalMethod, "sma");
    assert.equal(state.profile.rows, 10);
    assert.equal(state.profile.widthRatio, 0.85);
    assert.equal(state.profile.opacity, 0.32);
    assert.equal(state.profile.color, "#E6B77C");
    assert.equal(state.profile.colorMode, "auto");
    assert.equal(state.profile.showLabels, true);
    assert.equal(state.profile.rangeMode, "visible");
    assert.equal(state.profile.showVa, false);
    assert.equal(state.profile.showPoc, false);
    assert.equal(state.profile.rangeOn, false);
  }
  assert.equal(defaultHtsSettings("US", "stock").enabled, false, "US individual-stock layout remains opt-out");
  assert.equal(defaultHtsSettings("US", "etf").enabled, true, "supported overseas ETFs reuse the layout");
});

test("default objects do not share mutable nested panel/profile state", () => {
  const first = defaultHtsSettings("KR", "stock");
  first.collapsed.credit = true;
  first.volumeMa[20] = false;
  first.profile.rows = 64;
  const next = defaultHtsSettings("KR", "etf");
  assert.equal(next.collapsed.credit, false);
  assert.equal(next.volumeMa[20], true);
  assert.equal(next.profile.rows, 10);
});

test("HTS keys isolate market, instrument, symbol, interval and layout with escaped delimiters", () => {
  const variants: HtsScope[] = [scope, { ...scope, market: "US" }, { ...scope, instrument: "stock" }, { ...scope, code: "069500" }, { ...scope, interval: "week" }, { ...scope, layout: "workspace:1" }, { ...scope, layout: "workspace:2" }];
  assert.equal(new Set(variants.map(htsSettingsKey)).size, variants.length);
  assert.equal(htsSettingsKey({ ...scope, code: " 0043y0 " }), htsSettingsKey(scope));
  assert.notEqual(htsSettingsKey({ ...scope, interval: "day:workspace", layout: "1" }), htsSettingsKey({ ...scope, interval: "day", layout: "workspace:1" }));
  assert.equal(htsSettingsKey({ ...scope, layout: undefined }), htsSettingsKey({ ...scope, layout: "detail" }));
});

test("parse validates nested input without truthy strings, invalid dates or unsupported versions", () => {
  const state = parseHtsSettings(JSON.stringify({
    v: 1, enabled: "false", rsiPeriod: -1, signalPeriod: 999, signalMethod: "rsi",
    trustStartDate: "2026-02-31", collapsed: { credit: "false", foreign: true },
    panelHeights: { price: 10, rsi: -20, volume: 9999 }, volumeMa: { 5: false, 20: "off" },
    profile: { rows: 64.6, opacity: 12, widthRatio: 0.98, color: "url(javascript:bad)", enabled: "false", showLabels: false, rangeMode: "fixed", startDate: "2024-02-29", endDate: "2026-02-31" },
  }))!;
  assert.equal(state.enabled, true);
  assert.equal(state.rsiPeriod, 2);
  assert.equal(state.signalPeriod, 200);
  assert.equal(state.signalMethod, "sma");
  assert.equal(state.trustStartDate, "");
  assert.equal(state.collapsed.credit, false);
  assert.equal(state.collapsed.foreign, true);
  assert.deepEqual([state.panelHeights.price, state.panelHeights.rsi, state.panelHeights.volume], [180, 48, 1200]);
  assert.equal(state.volumeMa[5], false);
  assert.equal(state.volumeMa[20], true);
  assert.equal(state.profile.rows, 65);
  assert.equal(state.profile.widthRatio, 0.9);
  assert.equal(state.profile.opacity, 0.6);
  assert.equal(state.profile.color, "#E6B77C");
  assert.equal(state.profile.colorMode, "custom", "finite saved opacity preserves the prior style despite missing mode");
  assert.equal(state.profile.enabled, true);
  assert.equal(state.profile.showLabels, false);
  assert.equal(state.profile.startDate, "2024-02-29");
  assert.equal(state.profile.endDate, "");
  for (const raw of [null, "{", "null", "[]", '{"v":2}', '{"v":"1"}']) assert.equal(parseHtsSettings(raw), null);
  assert.equal(validHtsDate("2026-02-29"), false);
  assert.equal(validHtsDate("2024-02-29"), true);
});

test("legacy migration preserves explicit user settings and never deletes/overwrites the source", () => {
  const raw = JSON.stringify({ enabled: false, preset: "hide", rows: 48, basis: "turnover", width: "wide", opacity: 0.32, visibleOnly: false, showVa: false, showPoc: false, rangeOn: false, recentSpan: "6M" });
  const store = memoryStore({ [LEGACY_VP_KEY]: raw });
  assert.equal(hasSavedHtsSettings(store, scope), false);
  const migrated = loadHtsSettings(store, scope);
  assert.equal(migrated.enabled, true, "legacy profile visibility does not suppress the six domestic panels");
  assert.equal(migrated.profile.enabled, false, "ambiguous legacy mobile hide is not destructively replaced");
  assert.equal(migrated.profile.rows, 48);
  assert.equal(migrated.profile.basis, "turnover");
  assert.equal(migrated.profile.widthRatio, 0.18);
  assert.equal(migrated.profile.rangeMode, "all");
  assert.equal(migrated.profile.showVa, false);
  assert.equal(migrated.profile.rangeOn, false);
  assert.equal(migrated.profile.recentSpan, "6M");
  assert.equal(store.getItem(LEGACY_VP_KEY), raw);
  assert.equal(hasSavedHtsSettings(store, scope), true);
  const changed = { ...migrated, profile: { ...migrated.profile, rows: 10 } };
  saveHtsSettings(store, scope, changed);
  assert.equal(loadHtsSettings(store, scope).profile.rows, 10, "once migrated, old global prefs cannot overwrite scoped edits");
  assert.equal(loadHtsSettings(store, { ...scope, code: "069500" }).profile.rows, 48, "a second symbol does not inherit the first symbol's edits");
});

test("migration preserves US profile width and only applies values that actually existed", () => {
  const defaults = defaultHtsSettings("US", "stock");
  const result = migrateLegacyHtsSettings('{"width":"mid","enabled":true}', defaults)!;
  assert.equal(result.enabled, false);
  assert.equal(result.profile.widthRatio, 0.14);
  assert.equal(result.profile.rangeMode, "visible", "absent legacy flag should not change new default");
  assert.equal(result.profile.rows, 10);
  for (const raw of ["null", "[]", "bad", "false"]) assert.equal(migrateLegacyHtsSettings(raw, defaults), null);
});

test("saved changes preserve trust baseline, collapse, heights and independent volume averages", () => {
  const store = memoryStore();
  const state = defaultHtsSettings("KR", "etf");
  state.trustStartDate = "2026-01-05";
  state.trustMode = "daily";
  state.collapsed.credit = true;
  state.panelHeights.rsi = 180;
  state.volumeMa[60] = false;
  saveHtsSettings(store, scope, state);
  assert.deepEqual(loadHtsSettings(store, scope), state);
  assert.equal(loadHtsSettings(store, { ...scope, interval: "week" }).trustStartDate, "");
});

test("blocked storage keeps defaults and interactions usable without exceptions", () => {
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
  assert.equal(loadHtsSettings(blocked, scope).enabled, true);
  assert.equal(hasSavedHtsSettings(blocked, scope), false);
  assert.doesNotThrow(() => saveHtsSettings(blocked, scope, defaultHtsSettings("KR")));
});

test("HTS preset restores readable quantity profile while hide/ref/emphasis remain available", () => {
  const previous = { ...defaultHtsSettings("KR").profile, basis: "turnover" as const, startDate: "2026-01-01", endDate: "2026-02-01", rangeMode: "fixed" as const, enabled: false, showLabels: false };
  const restored = applyHtsProfilePreset("hts", previous);
  assert.equal(restored.rows, 10);
  assert.equal(restored.widthRatio, 0.85);
  assert.equal(restored.enabled, true);
  assert.equal(restored.showLabels, true);
  assert.equal(restored.rangeMode, "visible");
  assert.equal(restored.basis, "volume");
  assert.equal(restored.colorMode, "auto");
  assert.equal(restored.showVa, false);
  assert.equal(restored.showPoc, false);
  assert.equal(restored.rangeOn, false);
  assert.equal(applyHtsProfilePreset("hide", restored).enabled, false);
  assert.equal(applyHtsProfilePreset("ref", restored).widthRatio, 0.1);
  assert.equal(applyHtsProfilePreset("emph", restored).widthRatio, 0.18);
  assert.equal(applyHtsProfilePreset("ref", restored).colorMode, "custom", "preset opacity remains an explicit style");
});

test("older scoped profile styles and narrow/full-period settings survive until explicit readability action", () => {
  const oldProfile = { enabled: false, rows: 64, widthRatio: 0.1, rangeMode: "all", color: "#123AbC", opacity: 0.15, showLabels: false, showVa: true, showPoc: true, rangeOn: true };
  const store = memoryStore({ [htsSettingsKey(scope)]: JSON.stringify({ v: 1, profile: oldProfile }) });
  const loaded = loadHtsSettings(store, scope);
  for (const [key, value] of Object.entries(oldProfile)) assert.equal(loaded.profile[key as keyof typeof loaded.profile], value);
  assert.equal(loaded.profile.colorMode, "custom", "ambiguous prior styles are not assumed to be defaults");
  saveHtsSettings(store, scope, loaded);
  assert.deepEqual(loadHtsSettings(store, scope).profile, loaded.profile);
  assert.equal(loadHtsSettings(store, { ...scope, code: "069500" }).profile.widthRatio, 0.85);
});

test("profile color mode distinguishes explicit automatic choice, old styles and malformed values", () => {
  const parse = (profile: unknown) => parseHtsSettings(JSON.stringify({ v: 1, profile }))!.profile;
  assert.equal(parse({}).colorMode, "auto");
  assert.equal(parse({ color: "#e7b157" }).colorMode, "custom");
  assert.equal(parse({ opacity: 0.22 }).colorMode, "custom");
  assert.equal(parse({ color: "#123456", opacity: 0.1, colorMode: "auto" }).colorMode, "auto");
  assert.equal(parse({ colorMode: "custom" }).colorMode, "custom");
  const malformed = parse({ color: "red", opacity: "0.1", colorMode: true, widthRatio: null, rows: null, enabled: "false", showLabels: "false" });
  assert.equal(malformed.colorMode, "auto");
  assert.equal(malformed.color, "#E6B77C");
  assert.equal(malformed.opacity, 0.32);
  assert.equal(malformed.widthRatio, 0.85);
  assert.equal(malformed.rows, 10);
  assert.equal(malformed.enabled, true);
  assert.equal(malformed.showLabels, true);
});

test("chart readability resets only display profile fields and persists in the current scope", () => {
  const settings = defaultHtsSettings("KR", "etf");
  settings.enabled = false;
  settings.collapsed.credit = true;
  settings.panelHeights.price = 780;
  settings.volumeMa[20] = false;
  settings.rsiPeriod = 21;
  settings.signalMethod = "ema";
  settings.trustMode = "daily";
  settings.trustStartDate = "2026-01-05";
  settings.profile = { ...settings.profile, enabled: false, rows: 64, widthRatio: 0.1, basis: "turnover", rangeMode: "fixed", startDate: "2026-02-02", endDate: "2026-03-03", recentSpan: "6M", colorMode: "custom", color: "#112233", opacity: 0.08, showLabels: false, showPoc: true, showVa: true, rangeOn: true };
  const before = structuredClone(settings);
  const result = applyChartReadabilityPreset(settings);
  const { profile: previousProfile, ...previousOther } = before;
  const { profile, ...other } = result;
  assert.deepEqual(other, previousOther, "HTS layout, pane settings and trust origin are untouched");
  assert.deepEqual(settings, before, "action does not mutate its input");
  assert.deepEqual([profile.startDate, profile.endDate, profile.recentSpan], [previousProfile.startDate, previousProfile.endDate, previousProfile.recentSpan]);
  assert.deepEqual(profile, { ...previousProfile, preset: "hts", enabled: true, rows: 10, widthRatio: 0.85, rangeMode: "visible", basis: "volume", showLabels: true, showPoc: false, showVa: false, rangeOn: false, colorMode: "auto", color: "#E6B77C", opacity: 0.32 });
  const store = memoryStore();
  saveHtsSettings(store, scope, result);
  assert.deepEqual(loadHtsSettings(store, scope), result);
  assert.equal(loadHtsSettings(store, { ...scope, layout: "other-workspace" }).trustStartDate, "");
});

const metadata: ProfileMetadata = {
  market: "KR", instrument: "etf", code: "069500", name: "KODEX 200", quantityUnit: "주", currency: "KRW",
  source: "NAVER", sourceResolution: "day", asOf: "2026-10-02", fetchedAt: "2026-10-03T00:00:00Z",
  rangeMode: "fixed", requestedFrom: "2026-09-01", requestedTo: "2026-10-02", actualFrom: "2026-09-02", actualTo: "2026-10-02", adjustment: "수정주가, 거래량 조정 여부 미확인", adjustmentWarning: "조정 일관성 미확인", estimated: true,
};

test("profile CSV includes exact fractional allocation, total denominator and source/range/unit metadata", () => {
  const profile = volumeProfile([{ low: 100, high: 103, volume: 10, close: 101 }], 2);
  const csv = profileToCsv(profile, metadata);
  const lines = csv.split("\r\n");
  assert.equal(lines.length, 3);
  assert.ok(lines[0]!.includes("quantity_or_turnover,percent,basis,value_unit,total_quantity,total_value,quantity_unit,currency"));
  assert.ok(lines[1]!.includes(",100,101.5,5,50,volume,주,10,10,주,KRW,ohlcv-overlap,true,fixed,2026-09-01,2026-10-02,2026-09-02,2026-10-02,"));
  assert.ok(csv.includes('"수정주가, 거래량 조정 여부 미확인"'));
  assert.ok(csv.includes(",NAVER,2026-10-02,2026-10-03T00:00:00Z,"));
  const fractional = volumeProfile([{ low: 100, high: 130, volume: 100, close: 110 }], 3);
  assert.ok(profileToCsv(fractional, metadata).includes(String(fractional.rows[0]!.volume)), "export does not round away allocation precision");
});

test("turnover CSV identifies actual currency separately from native ETF quantity", () => {
  const profile = volumeProfile([{ low: 100, high: 120, volume: 20, close: 110 }], 2, 0.7, "turnover");
  const csv = profileToCsv(profile, { ...metadata, quantityUnit: "좌" });
  assert.ok(csv.includes(",1100,50,turnover,KRW,20,2200,좌,KRW,"));
  assert.equal(profile.totalVolume, 20, "unit label does not convert numbers");
});

test("empty and excluded profile export keeps diagnostics; text safely escapes CSV and formulas", () => {
  const profile = volumeProfile([{ low: 10, high: 20, volume: -1 }]);
  const csv = profileToCsv(profile, { ...metadata, source: 'provider, "daily"', name: "=SUM(1,2)" });
  assert.equal(csv.split("\r\n").length, 2, "metadata remains exportable even with no bins");
  assert.ok(csv.includes('"provider, ""daily"""'));
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.endsWith(",0,1,,,"));
});
