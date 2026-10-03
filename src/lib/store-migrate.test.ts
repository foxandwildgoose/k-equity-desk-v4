import assert from "node:assert/strict";
import { test } from "node:test";
import { migratePersisted, mergePersisted, STORE_VERSION, defaultAlertSettings } from "./store-migrate.ts";

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
