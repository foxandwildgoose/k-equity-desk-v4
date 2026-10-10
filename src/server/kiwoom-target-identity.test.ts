import assert from "node:assert/strict";
import { test } from "node:test";
import type { FlowRequest } from "../lib/charts/hts-flow.ts";
import { createKiwoomTargetIdentityVerifier } from "./kiwoom-target-identity.ts";

const request = (code = "018260", instrument: FlowRequest["instrument"] = "stock"): FlowRequest => ({
  code, instrument, market: "KR", exchange: "KOSPI", currency: "KRW", quantityUnit: "주",
  interval: "day", from: "2026-09-01", to: "2026-10-08",
});
const json = (body: unknown, headers?: Record<string, string>) => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json", ...headers },
});
const basic = (code = "018260", instrument = "stock", nation = "KOR", market = "KS") => ({
  itemCode: code, stockEndType: instrument, stockExchangeType: { nationType: nation, code: market },
});

test("KOSPI/KOSDAQ stocks and alphanumeric Korean ETF/ETN metadata authorize only their exact instrument", async () => {
  const calls: string[] = [];
  const verify = createKiwoomTargetIdentityVerifier({ fetch: async (url, init) => {
    const target = new URL(String(url));
    calls.push(target.pathname);
    assert.equal(target.origin, "https://m.stock.naver.com");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("authorization"), null);
    assert.ok(init?.signal instanceof AbortSignal);
    const code = target.pathname.split("/").at(-2)!;
    return json(basic(code, code === "0226A0" ? "etf" : code === "500001" ? "etn" : "stock", "KOR", code === "403870" ? "KQ" : "KS"));
  } });
  for (const [code, instrument] of [["018260", "stock"], ["403870", "stock"], ["0226A0", "etf"], ["500001", "etn"]] as const)
    assert.equal(await verify(request(code, instrument)), true);
  assert.equal(await verify(request("0226A0", "stock")), false);
  assert.equal(await verify(request("018260", "etf")), false);
  assert.equal(calls.length, 4, "metadata is cached by code without mixing instrument authorization");
});

test("missing/unknown product types, a different code, and non-Korean identity fail closed without stock guessing", async () => {
  for (const body of [
    { itemCode: "018260", stockExchangeType: { nationType: "KOR" } },
    basic("018260", "unknown"), basic("005930"), basic("018260", "stock", "USA"),
    { itemCode: "018260", stockEndType: "stock" }, null, [], { error: "unverified" },
  ]) {
    const verify = createKiwoomTargetIdentityVerifier({ fetch: async () => json(body) });
    assert.equal(await verify(request()), false);
  }
});

test("invalid identifiers and US requests cannot initiate any provider request", async () => {
  let calls = 0;
  const verify = createKiwoomTargetIdentityVerifier({ fetch: async () => { calls++; throw Error("FORBIDDEN_FETCH"); } });
  for (const code of ["../018260", "018260/", "https://example.test", "삼성", "01826", "0226a0", "018260\n"])
    assert.equal(await verify(request(code)), false);
  assert.equal(await verify({ ...request("AAPL"), market: "US" }), false);
  assert.equal(calls, 0);
});

test("concurrent requests share one metadata fetch; positive entries expire after an hour", async () => {
  let clock = 0, calls = 0;
  const verify = createKiwoomTargetIdentityVerifier({ now: () => clock, fetch: async () => { calls++; return json(basic()); } });
  assert.deepEqual(await Promise.all(Array.from({ length: 8 }, () => verify(request()))), Array(8).fill(true));
  assert.equal(calls, 1);
  clock = 3_599_999;
  assert.equal(await verify(request()), true);
  assert.equal(calls, 1);
  clock++;
  assert.equal(await verify(request()), true);
  assert.equal(calls, 2);
});

test("transient errors use a short negative cache and retry rather than permanently rejecting a real stock", async () => {
  let clock = 0, calls = 0;
  const verify = createKiwoomTargetIdentityVerifier({ now: () => clock, fetch: async () => {
    calls++;
    if (calls === 1) throw Error("fixture provider unavailable");
    return json(basic());
  } });
  assert.equal(await verify(request()), false);
  assert.equal(await verify(request()), false);
  assert.equal(calls, 1);
  clock = 30_000;
  assert.equal(await verify(request()), true);
  assert.equal(calls, 2);
});

test("HTTP, malformed JSON, redirects, and oversized bodies fail safely with no raw response exposure", async () => {
  const redirected = json(basic());
  Object.defineProperty(redirected, "url", { value: "https://example.test/private" });
  for (const response of [new Response("provider detail", { status: 503 }), new Response("invalid JSON"), redirected,
    json(basic(), { "content-length": "131073" }), json({ ...basic(), padding: "x".repeat(131073) })]) {
    const verify = createKiwoomTargetIdentityVerifier({ fetch: async () => response });
    assert.equal(await verify(request()), false);
  }
});

test("a provider that ignores fetch cancellation or stalls the response body still has a bounded deadline", async () => {
  for (const fetcher of [
    async () => new Promise<Response>(() => {}),
    async () => new Response(new ReadableStream<Uint8Array>({ start() { /* no response bytes */ } })),
  ]) {
    const verify = createKiwoomTargetIdentityVerifier({ fetch: fetcher, timeoutMs: 15 });
    assert.equal(await verify(request()), false);
  }
});

test("the metadata cache evicts bounded entries and does not grow with all previously entered codes", async () => {
  let calls = 0;
  const verify = createKiwoomTargetIdentityVerifier({ cacheLimit: 2, fetch: async url => {
    calls++; return json(basic(new URL(String(url)).pathname.split("/").at(-2)!));
  } });
  for (const code of ["018260", "403870", "005930", "018260"]) assert.equal(await verify(request(code)), true);
  assert.equal(calls, 4);
});

test("distinct concurrent metadata lookups are bounded while duplicate callers can join existing work", async () => {
  let calls = 0;
  let finish!: () => void;
  const ready = new Promise<void>(resolve => { finish = resolve; });
  const verify = createKiwoomTargetIdentityVerifier({ fetch: async url => {
    calls++; await ready; return json(basic(new URL(String(url)).pathname.split("/").at(-2)!));
  } });
  const first = Array.from({ length: 32 }, (_, index) => verify(request(String(index).padStart(6, "0"))));
  const shared = verify(request("000000"));
  assert.equal(await verify(request("018260")), false);
  assert.equal(calls, 32);
  finish();
  assert.ok((await Promise.all(first)).every(Boolean));
  assert.equal(await shared, true);
});
