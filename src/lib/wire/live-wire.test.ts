import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalRegions,
  diffNewItems,
  EMPTY_NOTIFY,
  EMPTY_SEEN,
  inQuietHours,
  matchesWireTab,
  passesToggles,
  planNotifications,
  pollIntervalMs,
  type NotifyState,
} from "./live-wire.ts";
import { evaluatePriceAlert } from "../alerts/price-alert.ts";
import { defaultAlertSettings, type AlertSettings, type PriceAlert } from "../store-migrate.ts";
import type { FeedItem } from "../feed/types.ts";

// synthetic fixture (format sample), not market data
function wireItem(id: string, tier: "flash" | "high" | "normal", extra: Partial<FeedItem> = {}): FeedItem {
  return {
    id,
    kind: "news",
    region: "KR",
    sourceId: "naver-flash",
    sourceName: "네이버 증권 속보",
    sourceTier: 1,
    title: `[QA] ${id}`,
    url: `https://example.com/${id}`,
    publishedAt: "2026-09-25T01:00:00.000Z",
    precision: "minute",
    fetchedAt: "2026-09-25T01:00:00.000Z",
    tickers: [],
    sectors: [],
    topics: [],
    lang: "ko",
    importance: { score: tier === "flash" ? 85 : tier === "high" ? 65 : 20, tier, reasons: ["QA"] },
    ...extra,
  };
}

const DAY_KST = Date.parse("2026-09-25T02:00:00Z"); // Fri 11:00 KST (KRX open)
const NIGHT_KST = Date.parse("2026-09-25T16:30:00Z"); // Sat 01:30 KST
const SUNDAY = Date.parse("2026-09-27T03:00:00Z"); // Sun 12:00 KST — both closed

function settings(patch: Partial<AlertSettings> = {}): AlertSettings {
  return { ...defaultAlertSettings(), osEnabled: true, ...patch };
}

test("polling cadence: 20 s visible, 60 s hidden, 180 s both closed, backoff ≤ 5 min", () => {
  assert.equal(pollIntervalMs({ visible: true, now: DAY_KST }), 20_000);
  assert.equal(pollIntervalMs({ visible: false, now: DAY_KST }), 60_000);
  assert.equal(pollIntervalMs({ visible: true, now: SUNDAY }), 180_000);
  assert.equal(pollIntervalMs({ visible: true, now: DAY_KST, errorCount: 2 }), 80_000);
  assert.equal(pollIntervalMs({ visible: true, now: DAY_KST, errorCount: 10 }), 300_000);
});

test("new items by id and cluster; first diff only records", () => {
  const a = wireItem("a", "high");
  const b = wireItem("b", "high", { cluster: { id: "c1", size: 2, sources: ["x", "y"], members: [] } });
  const first = diffNewItems([a, b], EMPTY_SEEN, DAY_KST);
  assert.equal(first.fresh.length, 0, "no flood on first load");
  const b2 = wireItem("b2", "high", { cluster: { id: "c1", size: 3, sources: ["x", "y", "z"], members: [] } });
  const c = wireItem("c", "normal");
  const second = diffNewItems([c, b2, a], first.next, DAY_KST + 20_000);
  assert.deepEqual(second.fresh.map((i) => i.id), ["c"], "same cluster is not new");
  const again = diffNewItems([c, a], second.next, DAY_KST + 40_000);
  assert.equal(again.fresh.length, 0, "dedupe by id");
});

test("AT-31 twelve qualifying items in 10 minutes → ≤ 5 notifications + 1 digest", () => {
  const s = settings({ inAppMinTier: "high" });
  let state: NotifyState = EMPTY_NOTIFY;
  let notified = 0;
  let digests = 0;
  for (let i = 0; i < 12; i++) {
    const plan = planNotifications([wireItem(`n${i}`, "flash")], s, { now: DAY_KST + i * 45_000, osPermission: "granted", visible: true, leader: true }, state);
    notified += new Set([...plan.toasts, ...plan.os].map((x) => x.id)).size;
    if (plan.digest) digests += 1;
    state = plan.next;
  }
  assert.ok(notified <= 5, `notified ${notified}`);
  assert.equal(notified, 5);
  assert.equal(digests, 1);
});

test("AT-32 quiet hours suppress OS notifications but the badge still counts", () => {
  const s = settings();
  assert.equal(inQuietHours(NIGHT_KST, s.quietHours), true);
  assert.equal(inQuietHours(DAY_KST, s.quietHours), false);
  assert.equal(inQuietHours(NIGHT_KST, { ...s.quietHours, enabled: false }), false);
  const seen = diffNewItems([wireItem("x", "flash")], EMPTY_SEEN, NIGHT_KST).next;
  const { fresh, next } = diffNewItems([wireItem("y", "flash"), wireItem("x", "flash")], seen, NIGHT_KST + 20_000);
  const unread = next.unread + fresh.filter((i) => passesToggles(i, s)).length;
  const plan = planNotifications(fresh, s, { now: NIGHT_KST + 20_000, osPermission: "granted", visible: false, leader: true }, EMPTY_NOTIFY);
  assert.equal(plan.os.length, 0);
  assert.equal(plan.quiet, true);
  assert.equal(plan.sound, false);
  assert.equal(unread, 1, "badge still updates");
  const day = planNotifications(fresh, s, { now: DAY_KST, osPermission: "granted", visible: false, leader: true }, EMPTY_NOTIFY);
  assert.equal(day.os.length, 1, "outside quiet hours the flash item goes to the OS");
});

test("OS rules: permission, leader, flash or watch match; toggles and pause", () => {
  const s = settings();
  const high = wireItem("h", "high", { tickers: [{ market: "KR", code: "005930" }] });
  const ctx = { now: DAY_KST, osPermission: "granted" as const, visible: true, leader: true };
  assert.equal(planNotifications([high], s, ctx, EMPTY_NOTIFY).os.length, 0, "high is not OS by default");
  assert.equal(planNotifications([high], s, { ...ctx, watch: { tickers: ["005930"], keywords: [] } }, EMPTY_NOTIFY).os.length, 1, "watch match goes to OS");
  assert.equal(planNotifications([wireItem("f", "flash")], s, { ...ctx, osPermission: "default" }, EMPTY_NOTIFY).os.length, 0, "no permission → no OS");
  assert.equal(planNotifications([wireItem("f", "flash")], s, { ...ctx, leader: false }, EMPTY_NOTIFY).os.length, 0, "followers never send OS");
  assert.equal(planNotifications([wireItem("f", "flash")], settings({ paused: true }), ctx, EMPTY_NOTIFY).toasts.length, 0);
  const us = wireItem("u", "flash", { region: "US" });
  assert.equal(passesToggles(us, settings({ regions: { KR: true, US: false } })), false);
  const etf = wireItem("e", "flash", { topics: ["etf"] });
  assert.equal(passesToggles(etf, settings({ categories: { ...defaultAlertSettings().categories, etf: false } })), false);
  assert.equal(matchesWireTab(etf, "etf"), true);
  assert.equal(matchesWireTab(etf, "robotics"), false);
  assert.equal(canonicalRegions(["us", "KR", "KR", "xx"]), "KR,US");
});

test("AT-33 chart price alert fires once when the price crosses the line", () => {
  const alert: PriceAlert = { id: "a1", market: "KR", code: "005930", kind: "price-cross", level: 100, direction: "up", repeat: "once", active: true, createdAt: "2026-09-25T00:00:00.000Z" };
  const t = "2026-09-25T01:00:00.000Z";
  let a = evaluatePriceAlert(alert, 98, t);
  assert.equal(a.fired, false, "first observation records the side");
  a = evaluatePriceAlert(a.next, 99, t);
  assert.equal(a.fired, false);
  a = evaluatePriceAlert(a.next, 101, t);
  assert.equal(a.fired, true);
  assert.equal(a.next.active, false);
  assert.equal(a.next.lastFiredAt, t);
  a = evaluatePriceAlert(a.next, 98, t);
  a = evaluatePriceAlert(a.next, 103, t);
  assert.equal(a.fired, false, "once → never again");
  const every: PriceAlert = { ...alert, id: "a2", repeat: "every", direction: "any", lastSide: "below" };
  let e = evaluatePriceAlert(every, 101, t);
  assert.equal(e.fired, true);
  e = evaluatePriceAlert(e.next, 99, t);
  assert.equal(e.fired, true);
  assert.equal(e.direction, "down");
});

test("F7.11 indicator alerts: RSI 70/30 and MA crosses fire once per bar", async () => {
  const { crossOfLevel, crossOfLines, evaluateIndicatorAlert } = await import("../alerts/price-alert.ts");
  assert.equal(crossOfLevel(68, 71, 70), "up");
  assert.equal(crossOfLevel(32, 29, 30), "down");
  assert.equal(crossOfLevel(71, 72, 70), null);
  assert.equal(crossOfLines(9, 10, 11, 10), "up");
  assert.equal(crossOfLines(11, 10, 9, 10), "down");
  const base: PriceAlert = { id: "r", market: "KR", code: "005930", kind: "rsi-cross", level: 70, direction: "any", repeat: "every", active: true, createdAt: "2026-09-25T00:00:00.000Z" };
  const r1 = evaluateIndicatorAlert(base, { rsi: [65, 72], barKey: "2026-09-25" }, "t1");
  assert.equal(r1.fired, true);
  const r2 = evaluateIndicatorAlert(r1.next, { rsi: [65, 72], barKey: "2026-09-25" }, "t2");
  assert.equal(r2.fired, false, "same bar never re-fires");
  const ma: PriceAlert = { ...base, id: "m", kind: "ma-cross", level: undefined, fast: 20, slow: 60, direction: "up", repeat: "once" };
  const m1 = evaluateIndicatorAlert(ma, { fast: [9, 11], slow: [10, 10], barKey: "b" }, "t");
  assert.equal(m1.fired, true);
  assert.equal(m1.next.active, false);
});
