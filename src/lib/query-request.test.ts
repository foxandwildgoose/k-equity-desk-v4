import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryRequestTimeoutError, withQueryDeadline } from "./query-request.ts";

test("a successful decoded result and provider metadata are returned unchanged", async () => {
  const data = { quotes: [{ price: 100, tradedAt: "2026-10-22T15:30:00+09:00" }], fetchedAt: "2026-10-22T06:30:01Z" };
  let received: AbortSignal | undefined;
  const result = await withQueryDeadline(async signal => { received = signal; return data; }, { timeoutMs: 50 });
  assert.equal(result, data);
  assert.equal(received!.aborted, false);
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(received!.aborted, false, "settled requests do not retain a deadline timer");
});

test("an indefinitely stalled server-function call rejects and propagates its deadline to transport", async () => {
  let received: AbortSignal | undefined;
  let aborted = false;
  await assert.rejects(withQueryDeadline(signal => {
    received = signal;
    signal.addEventListener("abort", () => { aborted = true; }, { once: true });
    return new Promise<never>(() => {});
  }, { timeoutMs: 10 }), QueryRequestTimeoutError);
  assert.equal(received!.aborted, true);
  assert.equal(aborted, true);
});

test("receiving headers does not stop the deadline while body decoding remains stalled", async () => {
  let bodyCancelled = false;
  await assert.rejects(withQueryDeadline(async signal => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"quotes":['));
        signal.addEventListener("abort", () => { bodyCancelled = true; controller.error(signal.reason); }, { once: true });
      },
    });
    const response = new Response(stream, { headers: { "content-type": "application/json" } });
    return response.json();
  }, { timeoutMs: 10 }), QueryRequestTimeoutError);
  assert.equal(bodyCancelled, true);
});

test("TanStack cancellation aborts active transport without replacing the cancellation reason", async () => {
  const parent = new AbortController();
  const reason = new DOMException("query no longer observed", "AbortError");
  let received: AbortSignal | undefined;
  const result = withQueryDeadline(signal => {
    received = signal;
    return new Promise<never>(() => {});
  }, { signal: parent.signal, timeoutMs: 100 });
  await Promise.resolve();
  parent.abort(reason);
  await assert.rejects(result, error => error === reason);
  assert.equal(received!.aborted, true);
  assert.equal(received!.reason, reason);
});

test("already-cancelled queries do not start a server request", async () => {
  const parent = new AbortController();
  parent.abort();
  let called = false;
  await assert.rejects(withQueryDeadline(async () => { called = true; return 1; }, { signal: parent.signal }), { name: "AbortError" });
  assert.equal(called, false);
});

test("success and failure both remove parent listeners; original failures do not trigger retries", async () => {
  const parent = new AbortController();
  let added = 0, removed = 0, calls = 0;
  const add = parent.signal.addEventListener.bind(parent.signal);
  const remove = parent.signal.removeEventListener.bind(parent.signal);
  parent.signal.addEventListener = ((...args: Parameters<typeof add>) => { added++; return add(...args); }) as typeof add;
  parent.signal.removeEventListener = ((...args: Parameters<typeof remove>) => { removed++; return remove(...args); }) as typeof remove;
  await withQueryDeadline(async () => { calls++; return 1; }, { signal: parent.signal });
  const original = new Error("actual provider failure");
  await assert.rejects(withQueryDeadline(async () => { calls++; throw original; }, { signal: parent.signal }), error => error === original);
  assert.equal(calls, 2);
  assert.equal(added, 2);
  assert.equal(removed, 2);
});
