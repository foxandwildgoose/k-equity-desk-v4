import assert from "node:assert/strict";
import test from "node:test";
import { FEED_REQUEST_TIMEOUT_MS, FeedRequestError, feedEmptyReason, fetchFeedPage, isFeedPage } from "./feed-client.ts";
import type { FeedItem, FeedPage } from "./feed/types.ts";

const item: FeedItem = {
  id: "source:1", kind: "news", region: "KR", sourceId: "source", sourceName: "공식 출처", sourceTier: 2,
  title: "실제 출처 제목", url: "https://example.test/news/1", publishedAt: "2026-10-23T00:00:00Z",
  fetchedAt: "2026-10-23T00:01:00Z", precision: "second", tickers: [{ market: "KR", code: "005930" }],
  sectors: [], topics: ["earnings"], lang: "ko", importance: { score: 50, tier: "high", reasons: ["관심 종목"] },
};
const page = (items: FeedItem[] = []): FeedPage => ({ items, sources: [{ id: "source", ok: true, count: items.length, state: items.length ? "ok" : "empty" }], nextCursor: null, partial: false, generatedAt: "2026-10-23T00:01:00Z" });
const respond = (body: unknown): typeof fetch => async () => Response.json(body);
const code = (expected: string) => (error: unknown) => error instanceof FeedRequestError && error.code === expected;

test("normal news and successful empty pages retain their source evidence and query dimensions", async () => {
  assert.equal(FEED_REQUEST_TIMEOUT_MS, 15_000);
  let url = "", requestSignal: AbortSignal | null | undefined;
  const result = await fetchFeedPage({ region: "KR", group: "etf", kinds: ["news"], topics: ["etf"], tickers: ["005930"], limit: 60 }, "cursor+value", undefined, {
    fetch: async (input, init) => { url = String(input); requestSignal = init?.signal; return Response.json(page([item])); },
  });
  assert.deepEqual(result, page([item]));
  const query = new URL(url, "https://example.test").searchParams;
  assert.deepEqual(Object.fromEntries(query), { region: "KR", limit: "60", group: "etf", kinds: "news", topics: "etf", tickers: "005930", cursor: "cursor+value" });
  assert.equal(requestSignal?.aborted, true, "the settled request releases its controller");
  assert.deepEqual(await fetchFeedPage({ region: "US" }, null, undefined, { fetch: respond(page()) }), page());
});

test("hung headers stop at the client deadline even if the transport ignores AbortSignal", async () => {
  let signal: AbortSignal | null | undefined;
  await assert.rejects(fetchFeedPage({ region: "KR" }, null, undefined, { timeoutMs: 20, fetch: (_input, init) => { signal = init?.signal; return new Promise(() => {}); } }), code("TIMEOUT"));
  assert.equal(signal?.aborted, true);
});

test("the same deadline covers a stalled response body and does not wait for stream cancellation", async () => {
  let cancelled = 0;
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('{"items":')); }, cancel() { cancelled++; return new Promise(() => {}); } });
  await assert.rejects(fetchFeedPage({ region: "KR" }, null, undefined, { timeoutMs: 20, fetch: async () => new Response(body) }), code("TIMEOUT"));
  assert.equal(cancelled, 1);
});

test("an abort-aware fetch still reports the timeout as TIMEOUT instead of an ordinary network failure", async () => {
  const fetcher: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  });
  await assert.rejects(fetchFeedPage({ region: "KR" }, null, undefined, { timeoutMs: 20, fetch: fetcher }), code("TIMEOUT"));
});

test("React Query cancellation aborts the transport and a previously cancelled query makes no request", async () => {
  const parent = new AbortController();
  let signal: AbortSignal | null | undefined, calls = 0;
  const fetcher: typeof fetch = (_input, init) => { calls++; signal = init?.signal; return new Promise(() => {}); };
  const pending = fetchFeedPage({ region: "KR" }, null, parent.signal, { fetch: fetcher });
  parent.abort();
  await assert.rejects(pending, (error) => error instanceof DOMException && error.name === "AbortError");
  assert.equal(signal?.aborted, true);
  await assert.rejects(fetchFeedPage({ region: "KR" }, null, parent.signal, { fetch: fetcher }), (error) => error instanceof DOMException && error.name === "AbortError");
  assert.equal(calls, 1);
});

test("HTTP and transport errors are visible failures without exposing upstream response text", async () => {
  await assert.rejects(fetchFeedPage({ region: "KR" }, null, undefined, { fetch: async () => new Response("private gateway diagnostic", { status: 503 }) }), (error) => code("HTTP")(error) && error instanceof Error && !error.message.includes("private"));
  await assert.rejects(fetchFeedPage({ region: "KR" }, null, undefined, { fetch: async () => { throw new Error("sensitive transport detail"); } }), (error) => code("NETWORK")(error) && error instanceof Error && !error.message.includes("sensitive"));
});

test("malformed JSON, invalid payloads and oversized streams do not enter feed state", async () => {
  await assert.rejects(fetchFeedPage({ region: "KR" }, null, undefined, { fetch: async () => new Response("<html>gateway</html>") }), code("INVALID_RESPONSE"));
  for (const payload of [{ ...page(), sources: null }, { ...page(), items: [{}] }, { ...page(), generatedAt: "not a date" }]) {
    await assert.rejects(fetchFeedPage({ region: "KR" }, null, undefined, { fetch: respond(payload) }), code("INVALID_RESPONSE"));
  }
  await assert.rejects(fetchFeedPage({ region: "KR" }, null, undefined, { fetch: respond(page()), maxBytes: 8 }), code("TOO_LARGE"));
});

test("the shared validator rejects corrupted nested HTTP/BroadcastChannel items before consumers can render them", () => {
  assert.equal(isFeedPage(page([item])), true);
  for (const override of [
    { tickers: null }, { tickers: [{ market: "KR", code: {} }] }, { topics: [null] }, { sectors: {} },
    { title: {} }, { sourceName: [] }, { sourceTier: 7 }, { url: "javascript:alert(1)" },
    { importance: { tier: "high", score: 10, reasons: null } },
    { cluster: { id: "c", size: 2, sources: null } },
    { cluster: { id: "c", size: 2, sources: ["source"], members: [{}] } },
    { etf: { code: "0246X0", name: {} } },
  ]) assert.equal(isFeedPage({ ...page(), items: [{ ...item, ...override }] }), false, JSON.stringify(override));
  for (const source of [null, {}, { id: "s", count: 1, ok: "yes" }, { id: "s", count: -1, ok: true }]) assert.equal(isFeedPage({ ...page(), sources: [source] }), false);
});

test("valid optional article/ETF enrichments and all-failed source pages remain valid rather than invented empty successes", () => {
  const enriched = { ...item, cluster: { id: "c", size: 1, sources: ["source"], members: [{ id: "m", sourceId: "s", sourceName: "source", title: "기사", url: "https://example.test/m", publishedAt: null, precision: "unknown" as const }] }, etf: { code: "0246X0", name: "SOL ETF", price: null, changePct: null, volume: null, marketSum: null, issuer: null, retirementEligible: null } };
  assert.equal(isFeedPage(page([enriched])), true);
  const failed = { ...page(), partial: true, sources: [{ id: "source", ok: false, count: 0, state: "timeout" }] };
  assert.equal(isFeedPage(failed), true);
  assert.match(feedEmptyReason(failed.sources, false, false), /모두 응답하지/);
  assert.match(feedEmptyReason(page().sources, false, false), /응답한 소스/);
  assert.match(feedEmptyReason([], false, false), /상태를 받지 못/);
  assert.match(feedEmptyReason([], false, false, { failed: true }), /조회에 실패/);
  assert.match(feedEmptyReason([], false, false, { paused: true }), /인터넷 연결/);
  assert.match(feedEmptyReason(page().sources, false, true), /필터/);
});
