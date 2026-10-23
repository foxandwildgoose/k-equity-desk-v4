import assert from "node:assert/strict";
import { test } from "node:test";
import { commitWireFeedPage, startWireCoordination, withWireRequestDeadline, type WireCoordinationOptions } from "./browser-runtime.ts";
import { isFeedPage } from "../feed-client.ts";
import type { FeedPage } from "../feed/types.ts";

class Channel extends EventTarget {
  sent: unknown[] = [];
  closed = false;
  failPost = false;
  failClose = false;
  failListener = false;
  override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) {
    if (this.failListener) throw new Error("channel listener denied");
    super.addEventListener(...args);
  }
  postMessage(message: unknown) {
    if (this.failPost) throw new Error("channel post denied");
    this.sent.push(message);
  }
  close() {
    this.closed = true;
    if (this.failClose) throw new Error("channel close denied");
  }
  page(page: unknown) { this.dispatchEvent(new MessageEvent("message", { data: { type: "page", page } })); }
}
function storage(initial?: string) {
  const values = new Map(initial ? [["heartbeat", initial]] : []);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}
function pendingLocks() {
  let grant: (() => Promise<unknown>) | undefined;
  let requested = 0;
  return {
    get requested() { return requested; },
    grant: () => grant?.(),
    locks: {
      request: (_name: string, _options: unknown, callback: () => Promise<unknown>) => {
        requested++;
        grant = callback;
        return new Promise(() => undefined);
      },
    } as unknown as LockManager,
  };
}
function setup(extra: Partial<WireCoordinationOptions<number>> = {}) {
  let leaders = 0;
  let followers = 0;
  const pages: number[] = [];
  const channel = new Channel();
  const value = startWireCoordination<number>({
    id: "this-tab", lockName: "lock", heartbeatKey: "heartbeat",
    channel: () => channel, storage: () => storage(),
    onLeader: () => { leaders++; }, onFollower: () => { followers++; },
    onPage: (page) => { pages.push(page); },
    ...extra,
  });
  return { ...value, channel, pages, get leaders() { return leaders; }, get followers() { return followers; } };
}
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

test("a missing or forbidden BroadcastChannel polls independently without acquiring a lock", () => {
  for (const factory of [() => null, () => { throw new Error("SecurityError"); }]) {
    const lock = pendingLocks();
    const session = setup({ channel: factory, locks: () => lock.locks });
    assert.equal(session.leaders, 1);
    assert.equal(lock.requested, 0);
    session.stop();
  }
});

test("channel listener/post/message/close failures stay outside the application shell", () => {
  const attached = new Channel(); attached.failListener = true; attached.failClose = true;
  const first = setup({ channel: () => attached });
  assert.equal(first.leaders, 1); assert.equal(attached.closed, true);
  assert.doesNotThrow(first.stop);

  const posting = new Channel(); posting.failPost = true;
  const lock = pendingLocks();
  const second = setup({ channel: () => posting, locks: () => lock.locks });
  assert.equal(second.leaders, 1); assert.equal(posting.closed, true);
  assert.doesNotThrow(() => second.publish(1)); second.stop();

  const receiving = setup({ locks: () => pendingLocks().locks, onPage: () => { throw new Error("bad message"); } });
  assert.doesNotThrow(() => receiving.channel.page(2));
  assert.equal(receiving.leaders, 1);
  receiving.channel.failClose = true;
  assert.doesNotThrow(receiving.stop);
});

test("messageerror abandons cross-tab coordination and receives its own feed", () => {
  const session = setup({ locks: () => pendingLocks().locks });
  session.channel.dispatchEvent(new Event("messageerror"));
  assert.equal(session.leaders, 1);
  assert.equal(session.channel.closed, true);
  session.stop();
});

test("rejected or synchronously denied Web Locks fall back instead of remaining followers", async () => {
  for (const request of [() => Promise.reject(new Error("not allowed")), () => { throw new Error("denied"); }]) {
    const session = setup({ locks: () => ({ request } as unknown as LockManager) });
    await wait(0);
    assert.equal(session.leaders, 1);
    session.stop();
  }
});

test("a silent channel or unavailable leader cannot block a new tab indefinitely", async () => {
  const lock = pendingLocks();
  const session = setup({ locks: () => lock.locks, initialFollowerWaitMs: 5 });
  assert.equal(session.leaders, 0);
  await wait(20);
  assert.equal(session.leaders, 1);
  await lock.grant(); // A lock grant after the timeout does not restart the session.
  assert.equal(session.leaders, 1);
  session.stop();
});

test("healthy channel followers apply shared pages and release queued work on unmount", async () => {
  const lock = pendingLocks();
  const session = setup({ locks: () => lock.locks, initialFollowerWaitMs: 5, followerStaleMs: 500 });
  session.channel.page(42);
  await wait(20);
  assert.deepEqual(session.pages, [42]);
  assert.equal(session.leaders, 0);
  session.stop();
  await lock.grant();
  session.channel.page(43);
  await wait(10);
  assert.deepEqual(session.pages, [42]);
  assert.equal(session.leaders, 0);
});

test("heartbeat fallback tolerates blocked storage and invalid future timestamps", () => {
  const blocked = setup({ storage: () => { throw new Error("SecurityError"); } });
  assert.equal(blocked.leaders, 1); blocked.stop();
  const saved = storage(JSON.stringify({ id: "old-tab", at: 99_999_999 }));
  const future = setup({ storage: () => saved, now: () => 10_000 });
  assert.equal(future.leaders, 1);
  future.stop();
  assert.equal(saved.getItem("heartbeat"), null);
});

test("stopped heartbeat cannot write or promote after unmount", async () => {
  let reads = 0;
  const shared = storage(JSON.stringify({ id: "other-tab", at: 10_000 }));
  const session = setup({
    now: () => 10_000, heartbeatMs: 5,
    storage: () => ({ ...shared, getItem: (key) => { reads++; return shared.getItem(key); } }),
  });
  session.stop();
  const afterStop = reads;
  await wait(20);
  assert.equal(reads, afterStop);
  assert.equal(session.leaders, 0);
  assert.notEqual(shared.getItem("heartbeat"), null, "another tab's heartbeat is preserved");
});

test("request deadline aborts hung headers and body even if the transport ignores cancellation", async () => {
  for (const phase of ["headers", "body"]) {
    let signal: AbortSignal | undefined;
    await assert.rejects(withWireRequestDeadline(async (next) => {
      signal = next;
      if (phase === "body") await Promise.resolve();
      return await new Promise<never>(() => undefined);
    }, new AbortController().signal, 5), /timed out/);
    assert.equal(signal?.aborted, true);
  }
});

test("parent cancellation stops a request and never starts an already cancelled request", async () => {
  const parent = new AbortController();
  let signal: AbortSignal | undefined;
  const pending = withWireRequestDeadline(async (next) => {
    signal = next;
    return await new Promise<never>(() => undefined);
  }, parent.signal, 500);
  await wait(0); parent.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(signal?.aborted, true);
  let started = false;
  await assert.rejects(withWireRequestDeadline(async () => { started = true; }, parent.signal));
  assert.equal(started, false);
});

test("successful requests clear their deadline and preserve the real response", async () => {
  const result = await withWireRequestDeadline(async signal => {
    assert.equal(signal.aborted, false);
    return { items: ["actual response fixture"] };
  }, new AbortController().signal, 500);
  assert.deepEqual(result, { items: ["actual response fixture"] });
});

const validPage: FeedPage = {
  items: [], sources: [{ id: "fixture-source", ok: false, count: 0 }],
  generatedAt: "2026-10-23T00:00:00.000Z", nextCursor: null, partial: true,
};
const validItem = {
  id: "fixture-story", title: "Fixture story", url: "https://example.com/story",
  sourceId: "fixture-source", sourceName: "Fixture source", sourceTier: 1,
  kind: "news", region: "KR", fetchedAt: validPage.generatedAt,
  publishedAt: validPage.generatedAt, precision: "second", lang: "ko",
  tickers: [], sectors: [], topics: [],
};
const malformedPages: unknown[] = [
  { ...validPage, sources: null },
  { ...validPage, items: null },
  { ...validPage, items: [null] },
  { ...validPage, sources: [null] },
  { ...validPage, items: [{ ...validItem, topics: null }] },
  { ...validPage, items: [{ ...validItem, tickers: [null] }] },
  { ...validPage, items: [{ ...validItem, importance: { tier: "high", score: 70, reasons: null } }] },
  { ...validPage, items: [{ ...validItem, cluster: { id: "cluster", size: 2, sources: [], members: [null] } }] },
];

test("malformed HTTP200 feed containers and rows cannot commit or replace good shared state", async () => {
  let shared = validPage;
  let writes = 0;
  for (const malformed of malformedPages) {
    const response = new Response(JSON.stringify(malformed), { status: 200 });
    const received: unknown = await withWireRequestDeadline(() => response.json(), new AbortController().signal);
    assert.throws(() => commitWireFeedPage(received, (page) => { shared = page; writes++; }), /응답 형식/);
    assert.equal(shared, validPage);
  }
  assert.equal(writes, 0);
  assert.equal(commitWireFeedPage(validPage, (page) => { shared = page; writes++; }), validPage);
  assert.equal(writes, 1, "a validated empty/partial source result remains a legitimate response");
});

test("malformed cross-tab feeds do not poison stores and fall back to independent retrieval", (t) => {
  for (const malformed of malformedPages) {
    let shared = validPage;
    let leaders = 0;
    let writes = 0;
    const channel = new Channel();
    const session = startWireCoordination<FeedPage>({
      id: "reader", lockName: "lock", heartbeatKey: "heartbeat", channel: () => channel,
      locks: () => pendingLocks().locks, validatePage: isFeedPage,
      onFollower: () => undefined, onLeader: () => { leaders++; },
      onPage: (value) => commitWireFeedPage(value, (page) => { shared = page; writes++; }),
    });
    t.after(session.stop);
    assert.doesNotThrow(() => channel.page(malformed));
    assert.equal(shared, validPage);
    assert.equal(writes, 0);
    assert.equal(leaders, 1);
    assert.equal(channel.closed, true);
    session.stop();
  }
});

test("unverified published pages never enter the coordination cache or get replayed to other tabs", (t) => {
  const channel = new Channel();
  const session = startWireCoordination<FeedPage>({
    id: "writer", lockName: "lock", heartbeatKey: "heartbeat", channel: () => channel,
    storage: () => storage(), validatePage: isFeedPage,
    onFollower: () => undefined, onLeader: () => undefined, onPage: () => undefined,
  });
  t.after(session.stop);
  for (const malformed of malformedPages) {
    session.publish(malformed as FeedPage);
    channel.dispatchEvent(new MessageEvent("message", { data: { type: "hello" } }));
  }
  assert.equal(channel.sent.filter((message) => (message as { type?: string }).type === "page").length, 0);
  session.publish(validPage);
  channel.dispatchEvent(new MessageEvent("message", { data: { type: "hello" } }));
  assert.equal(channel.sent.filter((message) => (message as { type?: string }).type === "page").length, 2);
  session.stop();
});
