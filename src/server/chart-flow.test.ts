import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createLegacyChartFlowService as createChartFlowService,
  parseKisFlow,
  parseNaverForeign,
  validateFlowRequest,
} from "./chart-flow-legacy.ts";
import type { FlowRequest } from "../lib/charts/hts-flow.ts";

const request: FlowRequest = {
  code: "0005A0",
  market: "KR",
  instrument: "etf",
  exchange: "KOSPI",
  currency: "KRW",
  quantityUnit: "주",
  from: "2026-09-01",
  to: "2026-09-03",
  interval: "day",
};
const fetchedAt = "2026-10-03T00:00:00Z";
const reply = (data: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(data), { status, headers });
const identity = (code = request.code) => ({
  itemCode: code,
  stockEndType: "etf",
  stockExchangeType: { nationType: "KOR" },
});
const trend = [{ itemCode: request.code, bizdate: "20260903", foreignerHoldRatio: "0%" }];
const noAuth = () => ({});

test("request allows existing alphanumeric ETF codes and validates dates/market/url characters", () => {
  assert.equal(validateFlowRequest({ ...request, code: "0005a0" }).code, "0005A0");
  for (const patch of [
    { code: "../secret" },
    { from: "2026-02-30" },
    { to: "2025-01-01" },
    { exchange: "https://evil" },
  ])
    assert.throws(() => validateFlowRequest({ ...request, ...patch }));
});
test("Naver ownership field preserves null/zero and never substitutes limit consumption", () => {
  const rows = parseNaverForeign(
    [
      { bizdate: "20260901", foreignerHoldRatio: "-", foreignRate: "99%" },
      { bizdate: "20260902", foreignerHoldRatio: "0%" },
    ],
    request.code,
    fetchedAt,
  );
  assert.deepEqual(
    rows.map((r) => r.value),
    [null, 0],
  );
  assert.equal(rows[1]?.unit, "%");
  assert.throws(() =>
    parseNaverForeign([{ ...trend[0], itemCode: "069500" }], request.code, fetchedAt),
  );
});
test("KIS exact loan ratio uses settlement date, not lending ratio or trade date", () => {
  const rows = parseKisFlow(
    [
      {
        deal_date: "20260901",
        stlm_date: "20260903",
        whol_loan_rmnd_rate: "1.25",
        whol_stln_rmnd_rate: "99",
      },
    ],
    "credit",
    fetchedAt,
  );
  assert.equal(rows[0]?.value, 1.25);
  assert.equal(rows[0]?.date, "2026-09-03");
  assert.equal(rows[0]?.dateBasis, "settlement-date");
});
test("KIS rejects institution/pension substitutions and derives only trust buy minus sell", () => {
  const rows = parseKisFlow(
    [
      { stck_bsop_date: "20260901", orgn_ntby_qty: "300", fund_ntby_qty: "20" },
      { stck_bsop_date: "20260902", ivtr_shnu_vol: "1,200", ivtr_seln_vol: "1,240" },
      { stck_bsop_date: "20260903", ivtr_ntby_qty: "0" },
    ],
    "investmentTrust",
    fetchedAt,
  );
  assert.deepEqual(
    rows.map((r) => r.value),
    [null, -40, 0],
  );
  assert.equal(rows[1]?.derived, true);
  assert.equal(rows[1]?.unit, "주");
});
test("auth absence is independent from live foreign zeros; caching deduplicates and separates ETF identity", async () => {
  let calls = 0;
  const service = createChartFlowService({
    credentials: noAuth,
    fetch: (async (url) => {
      calls++;
      const code = String(url).split("/").at(-2)!;
      return reply(
        String(url).endsWith("basic") ? identity(code) : [{ ...trend[0], itemCode: code }],
      );
    }) as typeof fetch,
  });
  const [a, b] = await Promise.all([service(request), service(request)]);
  assert.equal(calls, 2);
  assert.equal(a, b);
  assert.equal(a.credit.capability, "not-configured");
  assert.equal(a.foreign.observations[0]?.value, 0);
  await service(request);
  assert.equal(calls, 2);
  const c = await service({ ...request, code: "069500" });
  assert.equal(calls, 4);
  assert.equal(c.request.code, "069500");
});
test("403 is not retried and cannot label every ETF unsupported", async () => {
  let calls = 0;
  const service = createChartFlowService({
    credentials: noAuth,
    fetch: (async () => {
      calls++;
      return reply({}, 403);
    }) as typeof fetch,
  });
  const r = await service(request);
  assert.equal(calls, 1);
  assert.equal(r.foreign.capability, "error");
  assert.match(r.foreign.reason, /권한/);
  assert.equal(r.investmentTrust.capability, "not-configured");
});
test("429 gets one bounded retry then an isolated metric error", async () => {
  let calls = 0;
  const service = createChartFlowService({
    credentials: noAuth,
    retryDelayMs: 1,
    fetch: (async () => {
      calls++;
      return reply({}, 429);
    }) as typeof fetch,
  });
  const r = await service(request);
  assert.equal(calls, 2);
  assert.equal(r.foreign.capability, "error");
  assert.match(r.foreign.reason, /429/);
});
test("abort cancels only its subscriber; late old-ETF response stays with its original request", async () => {
  let resolveBasic!: (r: Response) => void;
  const service = createChartFlowService({
    credentials: noAuth,
    fetch: (async (url) =>
      String(url).endsWith("basic")
        ? new Promise<Response>((resolve) => {
            resolveBasic = resolve;
          })
        : reply(trend)) as typeof fetch,
  });
  const controller = new AbortController();
  const first = service(request, controller.signal);
  const second = service(request);
  controller.abort();
  await assert.rejects(first, { name: "AbortError" });
  resolveBasic(reply(identity()));
  assert.equal((await second).request.code, request.code);
});
test("last subscriber cancellation aborts actual provider work", async () => {
  let providerSignal: AbortSignal | null = null;
  const service = createChartFlowService({
    credentials: noAuth,
    fetch: (async (_url, init) => {
      providerSignal = init!.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) =>
        providerSignal!.addEventListener("abort", () =>
          reject(new DOMException("cancelled", "AbortError")),
        ),
      );
    }) as typeof fetch,
  });
  const controller = new AbortController();
  const promise = service(request, controller.signal);
  controller.abort();
  await assert.rejects(promise, { name: "AbortError" });
  assert.equal((providerSignal as AbortSignal | null)?.aborted, true);
});
test("timeout retries once and never fabricates a zero response", async () => {
  let calls = 0;
  const service = createChartFlowService({
    credentials: noAuth,
    timeoutMs: 5,
    retryDelayMs: 1,
    fetch: (async (_url, init) => {
      calls++;
      return new Promise<Response>((_resolve, reject) => {
        const timer = setTimeout(() => {}, 30);
        init!.signal!.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("timeout", "TimeoutError"));
        });
      });
    }) as typeof fetch,
  });
  const result = await service(request);
  assert.equal(calls, 2);
  assert.equal(result.foreign.capability, "error");
  assert.deepEqual(result.foreign.observations, []);
});
test("verified KIS request fields, token dedupe, duplicate-page termination and independent parsing", async () => {
  let tokenCalls = 0;
  let trustCalls = 0;
  const service = createChartFlowService({
    credentials: () => ({ appKey: "fixture-key", appSecret: "fixture-secret" }),
    retryDelayMs: 1,
    fetch: (async (url, init) => {
      const path = String(url);
      if (path.endsWith("basic")) return reply(identity());
      if (path.endsWith("trend")) return reply(trend);
      if (path.endsWith("tokenP")) {
        tokenCalls++;
        return reply({ access_token: "fixture-token", expires_in: 86400 });
      }
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer fixture-token");
      if (path.includes("daily-credit-balance")) {
        assert.equal(new Headers(init?.headers).get("tr_id"), "FHPST04760000");
        return reply({ rt_cd: "0", output: [{ stlm_date: "20260901", whol_loan_rmnd_rate: "0" }] });
      }
      assert.equal(new Headers(init?.headers).get("tr_id"), "FHPTJ04160001");
      trustCalls++;
      return reply(
        { rt_cd: "0", output2: [{ stck_bsop_date: "20260903", ivtr_ntby_qty: "60" }] },
        200,
        { tr_cont: "M" },
      );
    }) as typeof fetch,
  });
  const r = await service(request);
  assert.equal(tokenCalls, 1);
  assert.equal(trustCalls, 2);
  assert.equal(r.credit.observations[0]?.value, 0);
  assert.equal(r.investmentTrust.observations.length, 1);
  assert.match(r.investmentTrust.reason, /중복/);
  assert.equal(JSON.stringify(r).includes("fixture-secret"), false);
  assert.equal(JSON.stringify(r).includes("fixture-token"), false);
});
test("missing required KIS output is an error while other metrics succeed; US definitions remain unknown", async () => {
  const service = createChartFlowService({
    credentials: () => ({ appKey: "fixture-key", appSecret: "fixture-secret" }),
    retryDelayMs: 1,
    fetch: (async (url) =>
      String(url).endsWith("basic")
        ? reply(identity())
        : String(url).endsWith("trend")
          ? reply(trend)
          : String(url).endsWith("tokenP")
            ? reply({ access_token: "fixture-token" })
            : reply({ rt_cd: "0" })) as typeof fetch,
  });
  const r = await service(request);
  assert.equal(r.credit.capability, "error");
  assert.equal(r.foreign.observations.length, 1);
  const us = await service({
    ...request,
    code: "BOTZ",
    market: "US",
    exchange: "NASDAQ",
    currency: "USD",
    quantityUnit: "shares",
  });
  assert.equal(us.foreign.capability, "unknown");
  assert.equal(us.investmentTrust.capability, "unknown");
});
