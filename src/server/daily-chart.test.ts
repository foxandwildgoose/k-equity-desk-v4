import assert from "node:assert/strict";
import { test } from "node:test";
import { createDailyChartFetcher } from "./daily-chart.ts";

const time = Date.parse("2026-10-16T00:17:00+09:00");
const rows = [{ localTradedAt: "2026-10-15", openPrice: "7,925", highPrice: "7,995", lowPrice: "7,660", closePrice: "7,770", accumulatedTradingVolume: 705272 }];
const json = () => new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json" } });

test("concurrent same-symbol detail and indicator requests share one provider request", async () => {
  let calls = 0;
  let complete!: (response: Response) => void;
  const fetchDaily = createDailyChartFetcher({ now: () => time, fetcher: async () => {
    calls++;
    return new Promise<Response>(resolve => { complete = resolve; });
  } });
  const first = fetchDaily("0246X0"), second = fetchDaily("0246X0");
  assert.equal(calls, 1);
  assert.strictEqual(first, second);
  complete(json());
  const [a, b] = await Promise.all([first, second]);
  assert.strictEqual(a, b);
  assert.equal(a.bars[0]?.close, 7770);
});

test("successful 20-second cache preserves receipt and actual trade dates, then expires", async () => {
  let clock = time, calls = 0;
  const fetchDaily = createDailyChartFetcher({ now: () => clock, fetcher: async () => { calls++; return json(); } });
  const first = await fetchDaily("0246X0");
  clock += 19_999;
  const cached = await fetchDaily("0246X0");
  assert.equal(calls, 1);
  assert.equal(cached.fetchedAt, first.fetchedAt);
  assert.equal(cached.bars[0]?.date, "2026-10-15");
  clock++;
  const refreshed = await fetchDaily("0246X0");
  assert.equal(calls, 2);
  assert.notEqual(refreshed.fetchedAt, first.fetchedAt);
});

test("transient HTTP failure retries once and returns the actual recovered snapshot", async () => {
  let calls = 0;
  const fetchDaily = createDailyChartFetcher({ now: () => time, fetcher: async () => ++calls === 1 ? new Response("busy", { status: 503 }) : json() });
  const snapshot = await fetchDaily("0246X0");
  assert.equal(calls, 2);
  assert.equal(snapshot.bars[0]?.volume, 705272);
});

test("unavailable responses are never cached and a later request recovers immediately", async () => {
  let calls = 0;
  const fetchDaily = createDailyChartFetcher({ now: () => time, fetcher: async () => ++calls <= 2 ? new Response("busy", { status: 503 }) : json() });
  const failed = await fetchDaily("0246X0");
  assert.equal(calls, 2);
  assert.deepEqual(failed.bars, []);
  assert.equal(failed.fetchedAt, undefined);
  assert.equal((await fetchDaily("0246X0")).bars[0]?.close, 7770);
  assert.equal(calls, 3);
});

test("permanent provider denial is not retried or cached", async () => {
  let calls = 0;
  const fetchDaily = createDailyChartFetcher({ now: () => time, fetcher: async () => ++calls === 1 ? new Response("denied", { status: 403 }) : json() });
  assert.deepEqual((await fetchDaily("0246X0")).bars, []);
  assert.equal(calls, 1);
  assert.equal((await fetchDaily("0246X0")).bars[0]?.close, 7770);
  assert.equal(calls, 2);
});

test("empty, malformed or impossible daily observations retry without invented prices", async () => {
  for (const first of ["[]", "not JSON", JSON.stringify([{ ...rows[0], highPrice: "1" }])]) {
    let calls = 0;
    const fetchDaily = createDailyChartFetcher({ now: () => time, fetcher: async () => ++calls === 1 ? new Response(first) : json() });
    assert.equal((await fetchDaily("0246X0")).bars[0]?.close, 7770);
    assert.equal(calls, 2);
  }
});

test("each attempt is time bounded and aborted attempts do not poison a later request", async () => {
  let calls = 0, recovered = false;
  const fetchDaily = createDailyChartFetcher({ now: () => time, timeoutMs: 1, fetcher: async (_url, init) => {
    calls++;
    if (recovered) return json();
    return new Promise<Response>((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
  } });
  assert.deepEqual((await fetchDaily("0246X0")).bars, []);
  assert.equal(calls, 2);
  recovered = true;
  assert.equal((await fetchDaily("0246X0")).bars[0]?.close, 7770);
  assert.equal(calls, 3);
});

test("success cache evicts least recently used symbols and remains bounded", async () => {
  const calls = new Map<string, number>();
  const fetchDaily = createDailyChartFetcher({ now: () => time, maxEntries: 2, fetcher: async url => {
    const code = String(url).match(/stock\/([^/]+)/)![1]!;
    calls.set(code, (calls.get(code) ?? 0) + 1);
    return json();
  } });
  await fetchDaily("0246X0"); await fetchDaily("305540"); await fetchDaily("0246X0");
  await fetchDaily("005930"); await fetchDaily("0246X0");
  assert.equal(calls.get("0246X0"), 1);
  await fetchDaily("305540");
  assert.equal(calls.get("305540"), 2);
});

test("invalid symbols and preopen current-day candles are never cached as observations", async () => {
  let calls = 0;
  const fetchDaily = createDailyChartFetcher({ now: () => time, fetcher: async () => { calls++; return new Response(JSON.stringify([{ ...rows[0], localTradedAt: "2026-10-16" }])); } });
  assert.deepEqual((await fetchDaily("../bad")).bars, []);
  assert.equal(calls, 0);
  assert.deepEqual((await fetchDaily("0246X0")).bars, []);
  assert.equal(calls, 2);
  assert.deepEqual((await fetchDaily("0246X0")).bars, []);
  assert.equal(calls, 4);
});
