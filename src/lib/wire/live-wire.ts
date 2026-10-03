/**
 * Live Wire client logic (F8.2 / F8.4) — pure, unit-tested:
 * polling cadence, new-item detection (id + cluster), region/category
 * toggles, quiet hours, and the notification planner (tier rules, OS only
 * for flash / watch matches, ≤ 5 per 10 minutes then one digest).
 */
import type { FeedItem } from "../feed/types.ts";
import type { AlertSettings, ImportanceTierPref } from "../store-migrate.ts";
import { isWatchMatch, type WatchContext } from "../feed/filters.ts";
import { krSessionEstimate, usSessionEstimate } from "../feed/session.ts";
import { zonedParts } from "../feed/time.ts";

export const WIRE_TABS = [
  { id: "all", label: "전체" },
  { id: "kr", label: "한국" },
  { id: "us", label: "미국" },
  { id: "etf", label: "ETF" },
  { id: "robotics", label: "로봇" },
  { id: "watch", label: "관심종목" },
] as const;
export type WireTab = (typeof WIRE_TABS)[number]["id"];

const RANK: Record<ImportanceTierPref, number> = { normal: 1, high: 2, flash: 3 };

export function itemTier(it: Pick<FeedItem, "importance">): ImportanceTierPref {
  return it.importance?.tier ?? "normal";
}

export function meetsTier(it: Pick<FeedItem, "importance">, min: ImportanceTierPref): boolean {
  return RANK[itemTier(it)] >= RANK[min];
}

// ── Polling cadence ────────────────────────────────────────────────────
export const POLL_VISIBLE_MS = 20_000;
export const POLL_HIDDEN_MS = 60_000;
export const POLL_CLOSED_MS = 180_000;
export const POLL_MAX_BACKOFF_MS = 300_000;

export function bothMarketsClosed(now: number): boolean {
  return krSessionEstimate(now).session === "closed" && usSessionEstimate(now).session === "closed";
}

/** 20 s visible / 60 s hidden / 180 s when KR and US are both closed; errors back off ×2 up to 5 min. */
export function pollIntervalMs(opts: { visible: boolean; now: number; errorCount?: number }): number {
  const base = bothMarketsClosed(opts.now) ? POLL_CLOSED_MS : opts.visible ? POLL_VISIBLE_MS : POLL_HIDDEN_MS;
  const n = Math.max(0, opts.errorCount ?? 0);
  if (!n) return base;
  return Math.min(base * 2 ** n, POLL_MAX_BACKOFF_MS);
}

// ── New-item detection ─────────────────────────────────────────────────
export interface WireSeenState {
  seenIds: string[];
  seenClusters: string[];
  unread: number;
  /** ISO time of the last diff that saw items. */
  lastSeenAt: string | null;
  initialized: boolean;
}

export const EMPTY_SEEN: WireSeenState = { seenIds: [], seenClusters: [], unread: 0, lastSeenAt: null, initialized: false };
const SEEN_CAP = 600;

/**
 * Items not seen before by id or by cluster id. The first diff only records
 * what is on the wire (no flood of "new" items on first load).
 */
export function diffNewItems(items: readonly FeedItem[], state: WireSeenState, now: number): { fresh: FeedItem[]; next: WireSeenState } {
  const ids = new Set(state.seenIds);
  const clusters = new Set(state.seenClusters);
  const fresh: FeedItem[] = [];
  for (const it of items) {
    const memberIds = it.cluster?.members?.map((m) => m.id) ?? [];
    const seen = ids.has(it.id) || (it.cluster?.id ? clusters.has(it.cluster.id) : false) || memberIds.some((m) => ids.has(m));
    if (!seen && state.initialized) fresh.push(it);
    ids.add(it.id);
    for (const m of memberIds) ids.add(m);
    if (it.cluster?.id) clusters.add(it.cluster.id);
  }
  const cap = (xs: Set<string>) => [...xs].slice(-SEEN_CAP);
  return {
    fresh,
    next: {
      seenIds: cap(ids),
      seenClusters: cap(clusters),
      unread: state.unread,
      lastSeenAt: items.length ? new Date(now).toISOString() : state.lastSeenAt,
      initialized: true,
    },
  };
}

// ── Toggles ────────────────────────────────────────────────────────────
type Category = keyof AlertSettings["categories"];

export function wireCategories(it: Pick<FeedItem, "kind" | "topics">): Category[] {
  const out: Category[] = [it.kind === "briefing" ? "news" : (it.kind as Category)];
  if (it.topics.includes("etf")) out.push("etf");
  if (it.topics.includes("robotics")) out.push("robotics");
  return out;
}

/** Region and category toggles (every applicable category must be on). */
export function passesToggles(it: Pick<FeedItem, "kind" | "topics" | "region">, s: Pick<AlertSettings, "regions" | "categories">): boolean {
  const regionOk = it.region === "GLOBAL" ? s.regions.KR || s.regions.US : s.regions[it.region];
  if (!regionOk) return false;
  return wireCategories(it).every((c) => s.categories[c] !== false);
}

// ── Quiet hours (KST) ──────────────────────────────────────────────────
function minutesOf(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

export function inQuietHours(now: number, q: AlertSettings["quietHours"]): boolean {
  if (!q.enabled) return false;
  const start = minutesOf(q.start);
  const end = minutesOf(q.end);
  if (start == null || end == null || start === end) return false;
  const p = zonedParts(now, "Asia/Seoul");
  const t = p.h * 60 + p.mi;
  return start < end ? t >= start && t < end : t >= start || t < end;
}

// ── Notification planner ───────────────────────────────────────────────
export const RATE_LIMIT = 5;
export const RATE_WINDOW_MS = 10 * 60_000;

export interface NotifyState {
  /** Epoch ms of notifications sent inside the rolling window. */
  sentAt: number[];
  /** Epoch ms of the last digest (one digest per window). */
  digestAt: number | null;
  /** Items held back since the last digest. */
  held: number;
}

export const EMPTY_NOTIFY: NotifyState = { sentAt: [], digestAt: null, held: 0 };

export interface NotifyContext {
  now: number;
  watch?: WatchContext;
  osPermission: "granted" | "denied" | "default" | "unsupported";
  /** This tab is visible (in-app toasts). */
  visible: boolean;
  /** This tab is the elected poller (OS notifications fire from one tab only). */
  leader: boolean;
}

export interface NotifyPlan {
  toasts: FeedItem[];
  os: FeedItem[];
  digest: { count: number } | null;
  sound: boolean;
  quiet: boolean;
  next: NotifyState;
}

export function planNotifications(fresh: readonly FeedItem[], s: AlertSettings, ctx: NotifyContext, state: NotifyState): NotifyPlan {
  const quiet = inQuietHours(ctx.now, s.quietHours);
  const sentAt = state.sentAt.filter((t) => ctx.now - t < RATE_WINDOW_MS);
  let held = state.held;
  let digestAt = state.digestAt;
  const toasts: FeedItem[] = [];
  const os: FeedItem[] = [];
  if (s.paused) return { toasts, os, digest: null, sound: false, quiet, next: { sentAt, digestAt, held } };
  for (const it of fresh) {
    if (!passesToggles(it, s)) continue;
    const wantToast = s.inAppEnabled && ctx.visible && meetsTier(it, s.inAppMinTier);
    const watchHit = s.osWatchMatches && ctx.watch ? isWatchMatch(it as FeedItem, ctx.watch) : false;
    const wantOs = s.osEnabled && ctx.osPermission === "granted" && ctx.leader && !quiet && (meetsTier(it, s.osMinTier) || watchHit);
    if (!wantToast && !wantOs) continue;
    if (sentAt.length >= RATE_LIMIT) {
      held += 1;
      continue;
    }
    sentAt.push(ctx.now);
    if (wantToast) toasts.push(it);
    if (wantOs) os.push(it);
  }
  let digest: { count: number } | null = null;
  if (held > 0 && (digestAt == null || ctx.now - digestAt >= RATE_WINDOW_MS)) {
    digest = { count: held };
    digestAt = ctx.now;
    held = 0;
  }
  const sound = s.sound && !quiet && (toasts.length > 0 || os.length > 0);
  return { toasts, os, digest, sound, quiet, next: { sentAt, digestAt, held } };
}

// ── Drawer tabs ────────────────────────────────────────────────────────
export function matchesWireTab(it: FeedItem, tab: WireTab, watch?: WatchContext): boolean {
  switch (tab) {
    case "all":
      return true;
    case "kr":
      return it.region === "KR";
    case "us":
      return it.region === "US";
    case "etf":
      return it.topics.includes("etf");
    case "robotics":
      return it.topics.includes("robotics");
    case "watch":
      return watch ? isWatchMatch(it, watch) : false;
  }
}

/** Canonical `regions` param for `/api/wire` (sorted, de-duplicated). */
export function canonicalRegions(input: readonly string[]): string {
  const ok = new Set(["KR", "US"]);
  const list = [...new Set(input.map((r) => r.trim().toUpperCase()).filter((r) => ok.has(r)))].sort();
  return (list.length ? list : ["KR", "US"]).join(",");
}
