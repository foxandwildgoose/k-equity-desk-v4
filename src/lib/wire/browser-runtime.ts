import { isFeedPage } from "../feed-client.ts";
import type { FeedPage } from "../feed/types.ts";

/** Validate before the first shared-store write, for HTTP and cross-tab pages. */
export function commitWireFeedPage(value: unknown, commit: (page: FeedPage) => void): FeedPage {
  if (!isFeedPage(value)) throw new Error("Live Wire 응답 형식을 확인할 수 없습니다.");
  commit(value);
  return value;
}

/** Optional cross-tab coordination must never be a prerequisite for news. */
type Channel = Pick<BroadcastChannel, "addEventListener" | "removeEventListener" | "postMessage" | "close">;
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
type Locks = Pick<LockManager, "request">;

export interface WireCoordinationOptions<T> {
  id: string;
  lockName: string;
  heartbeatKey: string;
  channel?: () => Channel | null;
  locks?: () => Locks | undefined;
  storage?: () => Storage;
  onLeader: () => void;
  onFollower: () => void;
  onPage: (page: T) => void;
  validatePage?: (page: unknown) => page is T;
  now?: () => number;
  heartbeatMs?: number;
  heartbeatStaleMs?: number;
  initialFollowerWaitMs?: number;
  followerStaleMs?: number;
}

export function startWireCoordination<T>(options: WireCoordinationOptions<T>) {
  const now = options.now ?? Date.now;
  const lockAbort = new AbortController();
  let stopped = false;
  let leader = false;
  let independent = false;
  let channel: Channel | null = null;
  let lastPage: T | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let followerTimer: ReturnType<typeof setTimeout> | undefined;
  let releaseLock: (() => void) | undefined;

  const becomeLeader = () => {
    if (stopped || leader) return;
    leader = true;
    if (followerTimer) clearTimeout(followerTimer);
    options.onLeader();
  };
  const closeChannel = () => {
    const old = channel;
    channel = null;
    try { old?.removeEventListener("message", onMessage); } catch { /* optional API */ }
    try { old?.removeEventListener("messageerror", onMessageError); } catch { /* optional API */ }
    try { old?.close(); } catch { /* optional API */ }
  };
  const independently = () => {
    if (stopped || independent) return;
    independent = true;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
    lockAbort.abort();
    releaseLock?.();
    closeChannel();
    becomeLeader();
  };
  const send = (message: unknown) => {
    if (stopped || !channel) return;
    try { channel.postMessage(message); }
    catch { independently(); }
  };
  const watchFollower = (ms: number) => {
    if (followerTimer) clearTimeout(followerTimer);
    if (!stopped && !leader)
      followerTimer = setTimeout(independently, ms);
  };
  const onMessage = (event: Event) => {
    if (stopped || independent) return;
    const message = (event as MessageEvent<{ type?: string; page?: T }>).data;
    if (message?.type === "page" && message.page != null && !leader) {
      try {
        if (options.validatePage && !options.validatePage(message.page)) return independently();
        options.onPage(message.page);
        // A healthy leader may back off for five minutes after provider errors.
        watchFollower(options.followerStaleMs ?? 330_000);
      } catch { independently(); }
    }
    if (message?.type === "hello" && leader && lastPage !== undefined)
      send({ type: "page", page: lastPage });
  };
  const onMessageError = () => independently();

  const startHeartbeat = () => {
    if (stopped || independent || heartbeat) return;
    const tick = () => {
      if (stopped || independent) return;
      try {
        const storage = options.storage?.();
        if (!storage) return independently();
        const raw = storage.getItem(options.heartbeatKey);
        const candidate: unknown = raw ? JSON.parse(raw) : null;
        const current = candidate && typeof candidate === "object"
          ? candidate as { id?: unknown; at?: unknown } : null;
        const valid = current && typeof current.id === "string" &&
          typeof current.at === "number" && Number.isFinite(current.at) &&
          current.at <= now() + 5_000;
        if (!valid || current.id === options.id || now() - (current.at as number) > (options.heartbeatStaleMs ?? 15_000)) {
          storage.setItem(options.heartbeatKey, JSON.stringify({ id: options.id, at: now() }));
          becomeLeader();
        } else if (!leader) options.onFollower();
      } catch { independently(); }
    };
    tick();
    if (!stopped && !independent)
      heartbeat = setInterval(tick, options.heartbeatMs ?? 5_000);
  };

  try {
    channel = options.channel?.() ?? null;
    channel?.addEventListener("message", onMessage);
    channel?.addEventListener("messageerror", onMessageError);
  } catch { independently(); }

  // Without a working channel a lock only prevents this tab receiving news.
  if (!channel) independently();
  if (!independent) {
    watchFollower(options.initialFollowerWaitMs ?? 20_000);
    try {
      const locks = options.locks?.();
      if (locks?.request) {
        options.onFollower();
        Promise.resolve(locks.request(options.lockName, { signal: lockAbort.signal }, () =>
          new Promise<void>((resolve) => {
            if (stopped || independent) return resolve();
            releaseLock = resolve;
            becomeLeader();
          }),
        )).catch(() => {
          if (!stopped && !independent) startHeartbeat();
        });
      } else startHeartbeat();
    } catch { startHeartbeat(); }
    send({ type: "hello" });
  }

  return {
    publish(page: T) {
      if (stopped) return;
      if (options.validatePage && !options.validatePage(page)) return;
      lastPage = page;
      send({ type: "page", page });
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (heartbeat) clearInterval(heartbeat);
      if (followerTimer) clearTimeout(followerTimer);
      lockAbort.abort();
      releaseLock?.();
      closeChannel();
      try {
        const storage = options.storage?.();
        const raw = storage?.getItem(options.heartbeatKey);
        if (raw && (JSON.parse(raw) as { id?: string } | null)?.id === options.id)
          storage?.removeItem(options.heartbeatKey);
      } catch { /* blocked storage remains optional */ }
    },
  };
}

/** Bound headers and body even when a transport ignores AbortSignal. */
export async function withWireRequestDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  parent: AbortSignal,
  timeoutMs = 15_000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => {
      const error = new Error("Live Wire request cancelled");
      error.name = "AbortError";
      reject(error);
      controller.abort();
    };
    parent.addEventListener("abort", onAbort, { once: true });
    if (parent.aborted) return onAbort();
    timer = setTimeout(() => {
      reject(new Error("Live Wire request timed out"));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      interrupted,
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error("Live Wire request cancelled");
        return run(controller.signal);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort) parent.removeEventListener("abort", onAbort);
  }
}
