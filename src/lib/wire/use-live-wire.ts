import { useEffect, useRef } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import type { FeedItem, FeedPage, FeedSourceResult } from "@/lib/feed/types";
import { filterDisabledSources } from "@/lib/feed/cluster";
import { sortNewestFirst } from "@/lib/feed/sort";
import { useAppStore, useDisabledSources } from "@/lib/store";
import { personalize, useWatchContext } from "@/lib/use-feed";
import {
  canonicalRegions,
  diffNewItems,
  inQuietHours,
  EMPTY_NOTIFY,
  EMPTY_SEEN,
  passesToggles,
  planNotifications,
  pollIntervalMs,
  type NotifyState,
  type WireSeenState,
} from "@/lib/wire/live-wire";

const LS_KEY = "ked-live-wire-v1";
const LOCK_NAME = "ked-live-wire-leader";
const CHANNEL = "ked-live-wire";
const HEARTBEAT_KEY = "ked-live-wire-heartbeat";

export type WireRole = "starting" | "leader" | "follower";

interface WireRuntime {
  items: FeedItem[];
  sources: FeedSourceResult[];
  generatedAt: string | null;
  partial: boolean;
  unread: number;
  role: WireRole;
  errorCount: number;
  lastError: string | null;
  lastFetchAt: number | null;
  drawerOpen: boolean;
  highlightId: string | null;
  setDrawerOpen: (open: boolean) => void;
  markAllRead: () => void;
  openItem: (id: string) => void;
}

function loadSeen(): WireSeenState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return EMPTY_SEEN;
    const v = JSON.parse(raw) as Partial<WireSeenState>;
    return {
      seenIds: Array.isArray(v.seenIds) ? v.seenIds.filter((x) => typeof x === "string") : [],
      seenClusters: Array.isArray(v.seenClusters) ? v.seenClusters.filter((x) => typeof x === "string") : [],
      unread: typeof v.unread === "number" && v.unread >= 0 ? v.unread : 0,
      lastSeenAt: typeof v.lastSeenAt === "string" ? v.lastSeenAt : null,
      initialized: v.initialized === true,
    };
  } catch {
    return EMPTY_SEEN;
  }
}

function saveSeen(s: WireSeenState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked — in-memory only */
  }
}

let seen: WireSeenState = EMPTY_SEEN;

export const useWireStore = create<WireRuntime>()((set) => ({
  items: [],
  sources: [],
  generatedAt: null,
  partial: false,
  unread: 0,
  role: "starting",
  errorCount: 0,
  lastError: null,
  lastFetchAt: null,
  drawerOpen: false,
  highlightId: null,
  setDrawerOpen: (open) => {
    set({ drawerOpen: open, ...(open ? {} : { highlightId: null }) });
    if (open) {
      seen = { ...seen, unread: 0 };
      saveSeen(seen);
      set({ unread: 0 });
    }
  },
  markAllRead: () => {
    seen = { ...seen, unread: 0 };
    saveSeen(seen);
    set({ unread: 0 });
  },
  openItem: (id) => {
    seen = { ...seen, unread: 0 };
    saveSeen(seen);
    set({ drawerOpen: true, highlightId: id, unread: 0 });
  },
}));

/** Short WebAudio beep (F8.4, off by default; no external asset). */
export function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => void ctx.close();
  } catch {
    /* audio unavailable */
  }
}

export function notificationPermission(): "granted" | "denied" | "default" | "unsupported" {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

/**
 * "데스크톱 알림 켜기" — requests permission INSIDE the click handler (never on
 * load) and switches OS notifications on only when granted.
 */
export async function enableDesktopAlerts(): Promise<"granted" | "denied" | "default" | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  const result = await Notification.requestPermission();
  useAppStore.getState().setAlertSettings({ osEnabled: result === "granted" });
  return result;
}

function showOs(item: FeedItem) {
  try {
    const n = new Notification(item.title, {
      body: `${item.outlet ?? item.sourceName}${item.importance?.reasons.length ? ` · ${item.importance.reasons.slice(0, 2).join(" · ")}` : ""}`,
      tag: item.id,
      lang: item.lang,
    });
    n.onclick = () => {
      window.focus();
      useWireStore.getState().openItem(item.id);
      n.close();
    };
  } catch {
    /* notification constructor unavailable (e.g. Android Chrome requires SW) */
  }
}

function showToast(item: FeedItem) {
  toast(item.title, {
    id: `wire:${item.id}`,
    description: `${item.importance?.tier === "flash" ? "FLASH" : "HIGH"} · ${item.outlet ?? item.sourceName}`,
    action: { label: "원문", onClick: () => window.open(item.url, "_blank", "noopener,noreferrer") },
    duration: 8_000,
  });
}

/**
 * Live Wire engine (F8.2). Mount once (AppShell). One tab — elected with the
 * Web Locks API, else a localStorage heartbeat — polls `/api/wire`; the page
 * is shared with other tabs over BroadcastChannel. Every tab diffs what it
 * has seen, updates the unread badge and plans its own notifications.
 */
export function useLiveWireEngine() {
  const settings = useAppStore((s) => s.alertSettings);
  const disabled = useDisabledSources();
  const watch = useWatchContext();
  const latest = useRef({ settings, disabled, watch });
  latest.current = { settings, disabled, watch };
  const notify = useRef<NotifyState>(EMPTY_NOTIFY);

  useEffect(() => {
    seen = loadSeen();
    useWireStore.setState({ unread: seen.unread });
    const tabId = Math.random().toString(36).slice(2);
    let leader = false;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const lockAbort = new AbortController();
    let releaseLock: (() => void) | null = null;
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
    let lastPage: FeedPage | null = null;

    const apply = (page: FeedPage) => {
      lastPage = page;
      const { settings: s, disabled: d, watch: w } = latest.current;
      const now = Date.now();
      const items = sortNewestFirst(personalize(filterDisabledSources(page.items, d), w, now));
      const { fresh, next } = diffNewItems(items, seen, now);
      const counted = fresh.filter((it) => passesToggles(it, s)).length;
      const drawerOpen = useWireStore.getState().drawerOpen;
      seen = { ...next, unread: drawerOpen ? 0 : next.unread + counted };
      saveSeen(seen);
      useWireStore.setState({ items, sources: page.sources, generatedAt: page.generatedAt, partial: page.partial, unread: seen.unread });
      if (!fresh.length) return;
      const plan = planNotifications(
        fresh,
        s,
        { now, watch: w, osPermission: notificationPermission(), visible: document.visibilityState === "visible", leader },
        notify.current,
      );
      notify.current = plan.next;
      for (const it of plan.toasts.slice(0, 5)) showToast(it);
      for (const it of plan.os) showOs(it);
      if (plan.digest) {
        toast(`새 주요 뉴스 ${plan.digest.count}건 더`, {
          id: `wire-digest:${now}`,
          description: "알림이 많아 묶었습니다 (10분에 최대 5건). Live Wire에서 확인하세요.",
          action: { label: "열기", onClick: () => useWireStore.getState().setDrawerOpen(true) },
        });
      }
      if (plan.sound) beep();
    };

    const schedule = () => {
      if (stopped || !leader) return;
      if (timer) clearTimeout(timer);
      const { errorCount } = useWireStore.getState();
      timer = setTimeout(poll, pollIntervalMs({ visible: document.visibilityState === "visible", now: Date.now(), errorCount }));
    };

    const poll = async () => {
      if (stopped || !leader) return;
      if (latest.current.settings.paused) return schedule();
      const { regions } = latest.current.settings;
      const list = [regions.KR ? "KR" : "", regions.US ? "US" : ""].filter(Boolean);
      try {
        const res = await fetch(`/api/wire?regions=${canonicalRegions(list)}`, { headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const page = (await res.json()) as FeedPage;
        useWireStore.setState({ errorCount: 0, lastError: null, lastFetchAt: Date.now() });
        apply(page);
        channel?.postMessage({ type: "page", page });
      } catch (err) {
        useWireStore.setState((st) => ({ errorCount: st.errorCount + 1, lastError: err instanceof Error ? err.message : "error" }));
      }
      schedule();
    };

    const becomeLeader = () => {
      if (leader || stopped) return;
      leader = true;
      useWireStore.setState({ role: "leader" });
      void poll();
    };

    channel?.addEventListener("message", (ev: MessageEvent<{ type: string; page?: FeedPage }>) => {
      if (ev.data?.type === "page" && ev.data.page && !leader) apply(ev.data.page);
      if (ev.data?.type === "hello" && leader && lastPage) channel.postMessage({ type: "page", page: lastPage });
    });

    const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
    if (locks?.request) {
      useWireStore.setState({ role: "follower" });
      locks
        .request(LOCK_NAME, { signal: lockAbort.signal }, () =>
          new Promise<void>((resolve) => {
            releaseLock = resolve;
            becomeLeader();
          }),
        )
        .catch(() => undefined);
    } else {
      // Fallback: localStorage heartbeat (leader refreshes every 5 s; stale after 15 s).
      const tick = () => {
        try {
          const raw = localStorage.getItem(HEARTBEAT_KEY);
          const cur = raw ? (JSON.parse(raw) as { id: string; at: number }) : null;
          if (!cur || cur.id === tabId || Date.now() - cur.at > 15_000) {
            localStorage.setItem(HEARTBEAT_KEY, JSON.stringify({ id: tabId, at: Date.now() }));
            becomeLeader();
          } else if (!leader) useWireStore.setState({ role: "follower" });
        } catch {
          becomeLeader();
        }
      };
      tick();
      heartbeat = setInterval(tick, 5_000);
    }
    channel?.postMessage({ type: "hello" });

    const onVisibility = () => schedule();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (heartbeat) clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      lockAbort.abort();
      releaseLock?.();
      channel?.close();
      try {
        const raw = localStorage.getItem(HEARTBEAT_KEY);
        if (raw && (JSON.parse(raw) as { id: string }).id === tabId) localStorage.removeItem(HEARTBEAT_KEY);
      } catch {
        /* ignore */
      }
    };
  }, []);
}

/** Live Wire state for UI (F8.2 `useLiveWire`): items, unread, role, errors, drawer. */
export function useLiveWire() {
  return useWireStore();
}

/**
 * Fire a chart alert through the Live Wire notifier (F7.11): in-app toast
 * always; OS notification when enabled + granted and outside quiet hours.
 */
export function notifyAlert(title: string, body: string) {
  const s = useAppStore.getState().alertSettings;
  toast(title, { id: `alert:${title}:${Date.now()}`, description: body, duration: 10_000, action: { label: "Live Wire", onClick: () => useWireStore.getState().setDrawerOpen(true) } });
  if (s.osEnabled && notificationPermission() === "granted" && !inQuietHours(Date.now(), s.quietHours)) {
    try {
      const n = new Notification(title, { body, tag: `alert:${title}` });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      /* unavailable */
    }
  }
  if (s.sound && !inQuietHours(Date.now(), s.quietHours)) beep();
}
