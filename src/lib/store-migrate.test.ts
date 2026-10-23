import assert from "node:assert/strict";
import { test } from "node:test";
import { migratePersisted, mergePersisted, STORE_VERSION, defaultAlertSettings, defaultPersisted, type PriceAlert } from "./store-migrate.ts";
import { sanitizeBollingerSettings } from "./bollinger/config.ts";

test("AT-08: unversioned snapshot keeps watchlist, theme and colorConvention", () => {
  // synthetic fixture (format sample), not market data
  const v1 = { watchlist: ["005930", "277810"], theme: "light", colorConvention: "global", focusMode: true, preferredSectors: ["robotics"] };
  const v2 = migratePersisted(v1, 0);
  assert.equal(STORE_VERSION, 2);
  assert.deepEqual(v2.watchlist, ["005930", "277810"]);
  assert.equal(v2.theme, "light");
  assert.equal(v2.colorConvention, "global");
  assert.equal(v2.focusMode, true);
  assert.deepEqual(v2.preferredSectors, ["robotics"]);
  assert.ok(v2.usWatchlist.includes("NVDA"));
  assert.deepEqual(v2.keywordWatch, []);
  assert.equal(v2.alertSettings.osEnabled, false, "OS notifications stay opt-in");
  assert.equal(v2.alertSettings.quietHours.start, "23:00");
  assert.equal(v2.newsPrefs.tz, "KST");
  assert.deepEqual(v2.roboticsCustom, { added: [], removed: [] });
});

test("migration tolerates garbage and partial nested settings", () => {
  assert.equal(migratePersisted(null, 0).theme, "dark");
  assert.equal(migratePersisted("x", 1).watchlist.length > 0, true);
  const partial = migratePersisted({ alertSettings: { sound: true, quietHours: { enabled: false } } }, 1);
  assert.equal(partial.alertSettings.sound, true);
  assert.equal(partial.alertSettings.quietHours.enabled, false);
  assert.equal(partial.alertSettings.quietHours.end, "07:00");
  assert.equal(partial.alertSettings.inAppMinTier, "high");
});

test("rehydrate merge keeps new default keys inside nested objects", () => {
  const current = { alertSettings: defaultAlertSettings(), watchlist: ["a"], fn: () => 1 };
  const merged = mergePersisted({ alertSettings: { sound: true }, watchlist: ["b"] }, current);
  assert.equal(merged.alertSettings.sound, true);
  assert.equal(merged.alertSettings.inAppEnabled, true);
  assert.deepEqual(merged.watchlist, ["b"]);
  assert.equal(typeof merged.fn, "function");
});

const validAlert: PriceAlert & { lastBarKey: string } = {
  id: "custom-price", market: "KR", code: "005930", name: "삼성전자",
  kind: "price-cross", level: 70000, direction: "up", repeat: "every", active: true,
  createdAt: "2026-10-22T00:00:00.000Z", lastFiredAt: "2026-10-22T01:00:00.000Z",
  lastSide: "below", lastBarKey: "2026-10-22",
};

test("current-version snapshots repair null fields while preserving valid preferences and actions", () => {
  const action = () => "retained";
  const current = { ...defaultPersisted(["robotics"]), theme: "light" as const, sidebarOpen: false, toggleTheme: action };
  // Zustand calls merge directly when the stored version already equals STORE_VERSION.
  const snapshot = { version: STORE_VERSION, state: {
    watchlist: null, alertSettings: null, newsPrefs: null, chartPrefs: null, roboticsCustom: null,
    theme: "unknown", focusMode: true, sidebarOpen: true, toggleTheme: "broken", unknown: "ignored",
  } };
  const merged = mergePersisted(snapshot.state, current);
  assert.deepEqual(merged.watchlist, current.watchlist);
  assert.equal(merged.theme, "light");
  assert.equal(merged.focusMode, true);
  assert.equal(merged.sidebarOpen, false, "runtime UI state is not a persisted preference");
  assert.equal(merged.toggleTheme, action);
  assert.equal("unknown" in merged, false);
  assert.equal(merged.alertSettings.tickerTape, false);
  assert.doesNotThrow(() => merged.watchlist.map((code) => code.trim()));
  assert.doesNotThrow(() => merged.alertSettings.priceAlerts.filter((alert) => alert.active));
});

test("nested settings reject malformed arrays and keep valid sibling values", () => {
  const merged = mergePersisted({
    usWatchlist: [null, "msft", 3], keywordWatch: [{ bad: true }, "반도체"],
    alertSettings: {
      sound: true, tickerTape: "yes", priceAlerts: [null, {}, validAlert, { ...validAlert, id: "bad-level", level: "70000" }],
      quietHours: { enabled: false, start: "25:99", end: "06:30" },
      regions: { KR: "yes", US: false }, categories: { news: false, disclosure: null },
    },
    newsPrefs: { disabledSources: [null, {}, "source-a"], watchOnly: true, minImportance: Number.NaN },
    roboticsCustom: { added: [null, {}, { market: "US", code: "isrg", name: "Intuitive", exposure: "pure-play" }], removed: [null, "KR:277810"] },
  }, defaultPersisted());
  assert.deepEqual(merged.usWatchlist, ["MSFT"]);
  assert.deepEqual(merged.keywordWatch, ["반도체"]);
  assert.deepEqual(merged.alertSettings.priceAlerts, [validAlert]);
  assert.equal(merged.alertSettings.sound, true);
  assert.equal(merged.alertSettings.tickerTape, false);
  assert.deepEqual(merged.alertSettings.quietHours, { enabled: false, start: "23:00", end: "06:30" });
  assert.deepEqual(merged.alertSettings.regions, { KR: true, US: false });
  assert.equal(merged.alertSettings.categories.news, false);
  assert.equal(merged.alertSettings.categories.disclosure, true);
  assert.deepEqual(merged.newsPrefs.disabledSources, ["source-a"]);
  assert.equal(merged.newsPrefs.watchOnly, true);
  assert.equal(merged.newsPrefs.minImportance, 0);
  assert.deepEqual(merged.roboticsCustom, { added: [{ market: "US", code: "ISRG", name: "Intuitive", exposure: "pure-play" }], removed: ["KR:277810"] });
});

test("invalid persisted enums cannot enter global display settings", () => {
  const merged = mergePersisted({
    theme: [], colorConvention: "purple", focusMode: "true", preferredSectors: [null, "robotics"],
    alertSettings: { inAppMinTier: "urgent", osMinTier: {}, priceAlerts: [{ ...validAlert, direction: "sideways" }] },
    newsPrefs: { tz: "Mars", minImportance: Number.POSITIVE_INFINITY },
    chartPrefs: { chartType: "unknown", scale: "unknown", syncInterval: [] },
  }, defaultPersisted());
  assert.equal(merged.theme, "dark");
  assert.equal(merged.colorConvention, "korea");
  assert.equal(merged.focusMode, false);
  assert.deepEqual(merged.preferredSectors, ["robotics"]);
  assert.equal(merged.alertSettings.inAppMinTier, "high");
  assert.equal(merged.alertSettings.osMinTier, "flash");
  assert.deepEqual(merged.alertSettings.priceAlerts, []);
  assert.equal(merged.newsPrefs.tz, "KST");
  assert.equal(merged.newsPrefs.minImportance, 0);
  assert.equal(merged.chartPrefs.chartType, "candles");
  assert.equal(merged.chartPrefs.scale, "normal");
  assert.equal(merged.chartPrefs.syncInterval, false);
});

test("alert variants require usable levels or periods and preserve notification deduplication", () => {
  const rsi = { ...validAlert, id: "rsi", kind: "rsi-cross", level: 70 };
  const ma = { ...validAlert, id: "ma", kind: "ma-cross", level: undefined, fast: 20, slow: 60 };
  const values = [validAlert, rsi, ma,
    { ...validAlert, id: "zero", level: 0 },
    { ...rsi, id: "outside-rsi", level: 101 },
    { ...ma, id: "invalid-ma", fast: -1 },
    { ...validAlert, id: "bad-time", createdAt: {} },
  ];
  const merged = mergePersisted({ alertSettings: { priceAlerts: values } }, defaultPersisted());
  assert.deepEqual(merged.alertSettings.priceAlerts.map((alert) => alert.id), ["custom-price", "rsi", "ma"]);
  assert.equal((merged.alertSettings.priceAlerts[0] as typeof validAlert).lastBarKey, validAlert.lastBarKey);
});

test("open-ended chart template names and valid indicator settings survive rehydration", () => {
  const indicator = { uid: "my-sma", id: "sma", params: { period: 120 }, visible: false, color: "#123456", colorMode: "custom", anchorTime: null };
  const template = {
    indicators: [indicator], chartType: "line", scale: "indexed", smaBundleVersion: 1,
    savedAt: "2026-10-22T00:00:00.000Z", bollinger: sanitizeBollingerSettings({ mode: "investment", period: 50, alerts: false }),
  };
  const saved = JSON.parse(JSON.stringify({ chartPrefs: { templates: { "내 장기 투자 120일": template, constructor: template } } }));
  const before = JSON.stringify(saved);
  const merged = mergePersisted(saved, defaultPersisted());
  assert.deepEqual(merged.chartPrefs.templates["내 장기 투자 120일"], template);
  assert.deepEqual(merged.chartPrefs.templates.constructor, template);
  assert.equal(JSON.stringify(saved), before, "rehydration must not mutate stored input");
});

test("malformed chart templates cannot crash applying a saved template", () => {
  const merged = mergePersisted({ chartPrefs: { templates: {
    broken: null, badArray: { indicators: {} },
    recoverable: { indicators: [null, {}, { uid: "safe", id: "sma", params: { period: 20, invalid: null }, visible: "yes" }],
      chartType: {}, scale: [], savedAt: null, bollinger: { alertSignals: [null, "squeeze"], period: Number.NaN } },
  } } }, defaultPersisted());
  assert.deepEqual(Object.keys(merged.chartPrefs.templates), ["recoverable"]);
  const template = merged.chartPrefs.templates.recoverable;
  assert.deepEqual(template.indicators, [{ id: "sma", uid: "safe", params: { period: 20 }, visible: true }]);
  assert.equal(template.chartType, undefined);
  assert.equal(template.scale, undefined);
  assert.deepEqual(template.bollinger?.alertSignals, ["squeeze"]);
  assert.equal(template.bollinger?.period, 20);
  assert.doesNotThrow(() => template.indicators.filter((raw) => (raw as { id: string }).id === "sma"));
});

test("valid empty lists stay empty and corrupt fields fall back individually", () => {
  const current = defaultPersisted(["robotics"]);
  current.alertSettings.priceAlerts = [validAlert];
  const merged = mergePersisted({ watchlist: [], keywordWatch: [], usWatchlist: [],
    alertSettings: { priceAlerts: { wrong: "type" }, paused: true }, preferredSectors: null }, current);
  assert.deepEqual(merged.watchlist, []);
  assert.deepEqual(merged.usWatchlist, []);
  assert.deepEqual(merged.keywordWatch, []);
  assert.deepEqual(merged.alertSettings.priceAlerts, [validAlert]);
  assert.equal(merged.alertSettings.paused, true);
  assert.deepEqual(merged.preferredSectors, ["robotics"]);
});

test("migration and current-version merge share validation without resetting unrelated valid data", () => {
  const raw = { watchlist: ["0246X0"], theme: "light", newsPrefs: { tz: "ET", disabledSources: [null, "disabled"] },
    alertSettings: { quietHours: { start: null }, priceAlerts: [validAlert, null] } };
  assert.deepEqual(mergePersisted(raw, defaultPersisted()), migratePersisted(raw, 0));
});
