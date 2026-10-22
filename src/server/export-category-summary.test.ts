import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import {
  assembleHs2CategorySummaries,
  createHs2CategorySummaryClient,
  HS2_SUMMARY_CATEGORIES,
  hs2SummariesFromBundle,
  parseHs2Availability,
} from "./export-category-summary.ts";
import {
  createMemoryExportTradeStore,
  type TradeCategorySummaryPeriod,
} from "./export-trade-store.ts";
import type { LiveTradeBundle } from "./export-trade-pipeline.ts";

const at = new Date("2026-10-22T03:00:00Z");
const allIds = HS2_SUMMARY_CATEGORIES.map((proxy) => proxy.key);
const allCodes = [...new Set(HS2_SUMMARY_CATEGORIES.flatMap((proxy) => proxy.codes))].sort();
const row = (period: number, code: string, value = 100, extra: Record<string, unknown> = {}) => ({
  period,
  cmdCode: code,
  primaryValue: value,
  classificationCode: "H6",
  reporterCode: 410,
  partnerCode: 0,
  partner2Code: 0,
  flowCode: "X",
  customsCode: "C00",
  motCode: 0,
  ...extra,
});
const json = (data: unknown[]) => new Response(JSON.stringify({ count: data.length, data }));
const evidence = (
  period: string,
  extra: Partial<TradeCategorySummaryPeriod> = {},
): TradeCategorySummaryPeriod => ({
  period,
  classificationCode: "H6",
  reporterCode: "410",
  partnerCode: "0",
  partner2Code: "0",
  flowCode: "X",
  customsCode: "C00",
  motCode: "0",
  unit: "USD",
  source: "public-preview",
  originCheckedAt: at.toISOString(),
  components: allCodes.map((code) => ({ code, valueUsd: period.startsWith("2026") ? 150 : 100 })),
  ...extra,
});

test("all thirteen exact HS2 baskets use only two real month queries and stay separate from histories", async () => {
  const store = createMemoryExportTradeStore({ now: () => at });
  const requests: URL[] = [];
  const read = createHs2CategorySummaryClient({
    store,
    now: () => at,
    fetch: async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      assert.equal(url.hostname, "comtradeapi.un.org");
      assert.equal(url.searchParams.get("flowCode"), "X");
      assert.equal(url.searchParams.get("partnerCode"), "0");
      assert.equal(url.searchParams.get("cmdCode")!.split(",").length, 51);
      const period = Number(url.searchParams.get("period"));
      return json(allCodes.map((code) => row(period, code, period === 202609 ? 150 : 100)));
    },
  });
  const batch = await read({ categoryIds: allIds, referencePeriod: "2026-09" });
  assert.equal(requests.length, 2);
  assert.deepEqual(
    requests.map((u) => u.searchParams.get("period")),
    ["202609", "202509"],
  );
  assert.equal(Object.keys(batch.summaries).length, 13);
  const food = batch.summaries.agri_fishery_food!;
  assert.deepEqual(
    food.observations.map((r) => r.valueUsd),
    [2400, 3600],
  );
  assert.equal(food.summaryBasis.periods[1]!.components.length, 24);
  for (const [id, value] of Object.entries(batch.summaries)) {
    assert.equal(await store.saveCategorySummary(id, value), true);
    assert.equal(await store.saveCategory(id, value), false);
    assert.equal(await store.readCategory(id), null);
  }
  assert.equal(Object.keys(await store.readCategorySummaries(allIds)).length, 13);
});

test("missing current constituents never become zero or partial sums; missing prior yields current only", () => {
  const previous = evidence("2025-09");
  const current = evidence("2026-09");
  current.components = current.components.filter((row) => row.code !== "24");
  previous.components = previous.components.filter((row) => row.code !== "63");
  const values = assembleHs2CategorySummaries(allIds, [previous, current], at);
  assert.equal(values.agri_fishery_food, undefined);
  assert.equal(values.textiles!.observations.length, 1);
  assert.equal(values.textiles!.observations[0]!.valueUsd, 14 * 150);
  assert.equal(values.cosmetics!.observations.length, 2);
});

test("exact prior year and same actual HS edition are required for a two-point comparison", () => {
  const current = evidence("2026-09");
  for (const previous of [
    evidence("2025-08"),
    evidence("2025-09", { classificationCode: "H5" }),
    evidence("2025-09", { classificationCode: null }),
  ]) {
    const values = assembleHs2CategorySummaries(["cosmetics"], [previous, current], at);
    assert.deepEqual(
      values.cosmetics!.observations.map((r) => r.period),
      ["2026-09"],
    );
  }
});

test("the first HTTP429 persists the shared origin cooldown, prevents the second query and subsequent visitors", async () => {
  const store = createMemoryExportTradeStore({ now: () => at });
  let calls = 0;
  const client = createHs2CategorySummaryClient({
    store,
    now: () => at,
    fetch: async () => {
      calls++;
      return new Response("provider text must not leak", {
        status: 429,
        headers: { "Retry-After": "900" },
      });
    },
  });
  const first = await client({ categoryIds: allIds, referencePeriod: "2026-09" });
  assert.equal(calls, 1);
  assert.equal(Object.keys(first.summaries).length, 0);
  assert.equal(first.providers[0]!.reasonCode, "HTTP_429");
  assert.equal(first.providers[0]!.retryAt, "2026-10-22T03:15:00.000Z");
  const second = await client({ categoryIds: allIds, referencePeriod: "2026-09" });
  assert.equal(calls, 1);
  assert.equal(second.providers[0]!.reasonCode, "SHARED_PROVIDER_COOLDOWN");
  assert.doesNotMatch(JSON.stringify(first), /provider text/);
});

test("active global Comtrade lease stays pending and performs no origin request", async () => {
  const store = createMemoryExportTradeStore({ now: () => at });
  const owner = await store.acquireRefresh("comtrade-origin");
  let calls = 0;
  const batch = await createHs2CategorySummaryClient({
    store,
    now: () => at,
    fetch: async () => {
      calls++;
      return json([]);
    },
  })({ categoryIds: allIds, referencePeriod: "2026-09" });
  assert.equal(calls, 0);
  assert.equal(batch.providers[0]!.reasonCode, "REFRESH_IN_PROGRESS");
  await store.releaseRefresh("comtrade-origin", owner!);
});

test("mixed editions, unit/flow/geography mismatches and duplicate components reject the response", async () => {
  for (const change of [
    { classificationCode: "H5" },
    { unit: "thousand USD" },
    { flowCode: "M" },
    { reporterCode: 392 },
    { partnerCode: 842 },
    { partner2Code: 1 },
    { customsCode: "C01" },
    { motCode: 1 },
    { period: 202608 },
    { classificationCode: "HS" },
  ]) {
    const store = createMemoryExportTradeStore({ now: () => at });
    const batch = await createHs2CategorySummaryClient({
      store,
      now: () => at,
      fetch: async () => json([row(202609, "74"), row(202609, "76", 100, change)]),
    })({ categoryIds: ["non_ferrous_metals"], referencePeriod: "2026-09" });
    assert.deepEqual(batch.summaries, {}, JSON.stringify(change));
  }
  const store = createMemoryExportTradeStore({ now: () => at });
  const duplicate = await createHs2CategorySummaryClient({
    store,
    now: () => at,
    fetch: async () => json([row(202609, "74"), row(202609, "74"), row(202609, "76")]),
  })({ categoryIds: ["non_ferrous_metals"], referencePeriod: "2026-09" });
  assert.deepEqual(duplicate.summaries, {});
});

test("prior-year transport failure retains verified current points and explicit failure metadata", async () => {
  const store = createMemoryExportTradeStore({ now: () => at });
  let calls = 0;
  const result = await createHs2CategorySummaryClient({
    store,
    now: () => at,
    fetch: async () => {
      calls++;
      return calls === 1 ? json([row(202609, "33", 123)]) : new Response("", { status: 503 });
    },
  })({ categoryIds: ["cosmetics"], referencePeriod: "2026-09" });
  assert.equal(result.summaries.cosmetics!.observations.length, 1);
  assert.equal(result.summaries.cosmetics!.observations[0]!.valueUsd, 123);
  assert.equal(result.providers[0]!.state, "unavailable");
});

test("verified main bundle evidence is reused current-only because its HS edition was not recorded", () => {
  const value = {
    observations: ["2025-09", "2026-09"].map((period) => ({
      period,
      categoryId: "hs2:33",
      classification: "HS",
      geo: "KR",
      valueUsd: 123,
      vintage: "UN Comtrade HS as reported",
      sourceFile: "UN Comtrade · 대한민국/전세계 · HS 2단위",
    })),
    providers: [
      {
        id: "comtrade.total",
        configured: true,
        recordCount: 2,
        state: "ok",
        asOf: "2026-09",
        checkedAt: at.toISOString(),
      },
    ],
  } as LiveTradeBundle;
  const entry = {
    value,
    stale: true,
    verifiedAt: at.toISOString(),
    freshUntil: at.toISOString(),
    validUntil: at.toISOString(),
  };
  const result = hs2SummariesFromBundle(entry, ["cosmetics"], at);
  assert.equal(result.cosmetics!.observations.length, 1);
  assert.equal(result.cosmetics!.summaryBasis.periods[0]!.classificationCode, null);
  assert.equal(result.cosmetics!.providers[0]!.state, "stale");
  assert.equal(result.cosmetics!.providers[0]!.checkedAt, at.toISOString());
});

test("invalid/future reference periods never hit the origin and unpublished current does not scan history", async () => {
  const store = createMemoryExportTradeStore({ now: () => at });
  let calls = 0;
  const read = createHs2CategorySummaryClient({
    store,
    now: () => at,
    fetch: async () => {
      calls++;
      return json([]);
    },
  });
  for (const referencePeriod of ["2026-10", "2026-13", "2026-9", "0000-01"])
    assert.deepEqual((await read({ categoryIds: allIds, referencePeriod })).summaries, {});
  assert.equal(calls, 0);
  await read({ categoryIds: allIds, referencePeriod: "2026-09" });
  assert.equal(calls, 1);
});

test("explicit zero is a verified observation and a chosen older month is never relabelled as latest", async () => {
  const store = createMemoryExportTradeStore({ now: () => at });
  const result = await createHs2CategorySummaryClient({
    store,
    now: () => at,
    fetch: async (input) => {
      const period = Number(new URL(String(input)).searchParams.get("period"));
      return json([row(period, "33", 0)]);
    },
  })({ categoryIds: ["cosmetics"], referencePeriod: "2026-07" });
  const value = result.summaries.cosmetics!;
  assert.deepEqual(
    value.observations.map((row) => [row.period, row.valueUsd]),
    [
      ["2025-07", 0],
      ["2026-07", 0],
    ],
  );
  assert.equal(value.providers[0]!.asOf, "2026-07");
  assert.doesNotMatch(value.providers[0]!.message, /최신|latest/i);
  assert.equal(await store.saveCategorySummary("cosmetics", value), true);
});

test("reversed decimal constituent order uses the same canonical sum as strict cache validation", async () => {
  const components = Array.from({ length: 24 }, (_, index) => ({
    code: String(24 - index).padStart(2, "0"),
    valueUsd: index < 3 ? [0.3, 0.2, 0.1][index]! : 0,
  }));
  const values = assembleHs2CategorySummaries(
    ["agri_fishery_food"],
    [evidence("2026-09", { components })],
    at,
  );
  assert.equal(values.agri_fishery_food!.observations[0]!.valueUsd, 0.1 + 0.2 + 0.3);
  const store = createMemoryExportTradeStore({ now: () => at });
  assert.equal(
    await store.saveCategorySummary("agri_fishery_food", values.agri_fishery_food!),
    true,
  );
  assert.equal(
    (await store.readCategorySummary("agri_fishery_food"))!.value.observations[0]!.valueUsd,
    0.1 + 0.2 + 0.3,
  );
});

const publication = (period = 202512, extra: Record<string, unknown> = {}) => ({
  typeCode: "C",
  freqCode: "M",
  reporterCode: 410,
  period,
  classificationCode: "H6",
  classificationSearchCode: "HS",
  isOriginalClassification: true,
  totalRecords: 218160,
  lastReleased: "2026-05-21T01:05:13.8366667",
  ...extra,
});

test("complete official availability chooses the actual latest published monthly dataset", () => {
  const body = { count: 3, data: [publication(202509), publication(202512), publication(202511)] };
  assert.deepEqual(parseHs2Availability(body, at), {
    period: "2025-12",
    classificationCode: "H6",
    releasedAt: "2026-05-21T01:05:13.836Z",
  });
  for (const invalid of [
    { ...body, count: 4 },
    { ...body, error: "provider failure" },
    { count: 2, data: [publication(), publication()] },
    ...[
      { reporterCode: 392 },
      { freqCode: "A" },
      { typeCode: "S" },
      { classificationSearchCode: "SITC" },
      { classificationCode: "HS" },
      { isOriginalClassification: false },
      { period: 202610 },
      { period: 202613 },
      { period: 202699 },
      { totalRecords: 0 },
      { totalRecords: Infinity },
      { lastReleased: "2027-01-01T00:00:00Z" },
      { lastReleased: "invalid" },
      { lastReleased: "2026-02-31T01:00:00" },
    ].map((change) => ({ count: 1, data: [publication(202512, change)] })),
  ])
    assert.throws(() => parseHs2Availability(invalid, at));
  assert.equal(parseHs2Availability({ count: 0, data: [] }, at), null);
});

test("availability plus one current query fills thirteen baskets in two requests and preserves old published dates", async () => {
  const store = createMemoryExportTradeStore({ now: () => at });
  const urls: URL[] = [];
  const client = createHs2CategorySummaryClient({
    store,
    now: () => at,
    fetch: async (input) => {
      const url = new URL(String(input));
      urls.push(url);
      if (url.pathname.includes("getDa")) {
        assert.equal(url.searchParams.get("reportercode"), "410");
        assert.equal(url.searchParams.has("period"), false);
        return json([publication(202511), publication()]);
      }
      assert.equal(url.searchParams.get("period"), "202512");
      return json(allCodes.map((code) => row(202512, code, 123)));
    },
  });
  const result = await client({
    categoryIds: allIds,
    discoverLatest: true,
    referencePeriod: "2026-07",
  });
  assert.equal(urls.length, 2);
  assert.equal(Object.keys(result.summaries).length, 13);
  for (const [id, value] of Object.entries(result.summaries)) {
    assert.equal(value.observations.length, 1);
    assert.equal(value.observations[0]!.period, "2025-12");
    assert.equal(value.observations[0]!.releasedAt, "2026-05-21T01:05:13.836Z");
    assert.equal(value.providers[0]!.state, "stale");
    assert.equal(value.providers[0]!.reasonCode, undefined);
    assert.match(value.providers[0]!.message, /2025-12/);
    assert.match(value.providers[0]!.message, /2026-05-21/);
    assert.equal(await store.saveCategorySummary(id, value), true);
    assert.equal((await store.readCategorySummary(id))!.stale, false);
  }
});

test("unverified or empty availability never triggers a guessed month query", async () => {
  for (const body of [
    { count: 0, data: [] },
    { count: 2, data: [publication()] },
    { count: 1, data: [publication(202512, { reporterCode: 842 })] },
  ]) {
    let calls = 0;
    const store = createMemoryExportTradeStore({ now: () => at });
    const result = await createHs2CategorySummaryClient({
      store,
      now: () => at,
      fetch: async () => {
        calls++;
        return new Response(JSON.stringify(body));
      },
    })({ categoryIds: allIds, discoverLatest: true });
    assert.equal(calls, 1);
    assert.deepEqual(result.summaries, {});
    assert.ok(
      ["NO_PUBLISHED_MONTH", "AVAILABILITY_UNVERIFIED"].includes(result.providers[0]!.reasonCode!),
    );
  }
});

test("availability HTTP429 shares cooldown and stops before a data request", async () => {
  const store = createMemoryExportTradeStore({ now: () => at });
  let calls = 0;
  const read = createHs2CategorySummaryClient({
    store,
    now: () => at,
    fetch: async () => {
      calls++;
      return new Response("", { status: 429, headers: { "retry-after": "900" } });
    },
  });
  const result = await read({ categoryIds: allIds, discoverLatest: true });
  assert.equal(calls, 1);
  assert.equal(result.providers[0]!.reasonCode, "HTTP_429");
  assert.equal(await store.retryAt("comtrade-origin", true), "2026-10-22T03:15:00.000Z");
  await read({ categoryIds: allIds, discoverLatest: true });
  assert.equal(calls, 1);
});

test("data edition must match discovered metadata and unpublished data cannot start a third request", async () => {
  for (const data of [[], [row(202512, "33", 123, { classificationCode: "H5" })]]) {
    let calls = 0;
    const store = createMemoryExportTradeStore({ now: () => at });
    const result = await createHs2CategorySummaryClient({
      store,
      now: () => at,
      fetch: async () => {
        calls++;
        return calls === 1 ? json([publication()]) : json(data);
      },
    })({ categoryIds: ["cosmetics"], discoverLatest: true });
    assert.equal(calls, 2);
    assert.deepEqual(result.summaries, {});
  }
});

test("bounded slow response headers and body both succeed before the configured deadline", async () => {
  const store = createMemoryExportTradeStore({ now: () => at });
  let calls = 0;
  const read = createHs2CategorySummaryClient({
    store,
    now: () => at,
    timeoutMs: 1000,
    fetch: async (input, init) => {
      calls++;
      if (String(input).includes("getDa")) return json([publication()]);
      await delay(20, undefined, { signal: init?.signal ?? undefined });
      return new Response(
        new ReadableStream({
          async start(controller) {
            await delay(20);
            controller.enqueue(
              new TextEncoder().encode(
                JSON.stringify({ count: 1, data: [row(202512, "33", 321)] }),
              ),
            );
            controller.close();
          },
        }),
      );
    },
  });
  const result = await read({ categoryIds: ["cosmetics"], discoverLatest: true });
  assert.equal(calls, 2);
  assert.equal(result.summaries.cosmetics!.observations[0]!.valueUsd, 321);
});

test("short overrides distinguish request and body timeouts without exposing upstream text", async () => {
  for (const bodyTimeout of [false, true]) {
    const store = createMemoryExportTradeStore({ now: () => at });
    let cancelled = false;
    let keepConnected: ReturnType<typeof setTimeout> | undefined;
    const result = await createHs2CategorySummaryClient({
      store,
      now: () => at,
      timeoutMs: 10,
      fetch: async (_input, init) => {
        if (!bodyTimeout) {
          await delay(100, undefined, { signal: init?.signal ?? undefined });
          return json([]);
        }
        return new Response(
          new ReadableStream({
            start(controller) {
              // Keep the simulated connection alive; AbortSignal's timer is
              // intentionally unref'ed by Node and cannot keep a test alive.
              keepConnected = setTimeout(() => controller.close(), 1000);
            },
            cancel() {
              cancelled = true;
              clearTimeout(keepConnected);
            },
          }),
        );
      },
    })({ categoryIds: ["cosmetics"], referencePeriod: "2025-12" });
    assert.deepEqual(result.summaries, {});
    assert.equal(
      result.providers[0]!.reasonCode,
      bodyTimeout ? "SUMMARY_BODY_TIMEOUT" : "SUMMARY_REQUEST_TIMEOUT",
    );
    if (bodyTimeout) assert.equal(cancelled, true);
  }
});

test("safe diagnostics distinguish HTTP, decoding, fetch and dimension failures", async () => {
  for (const [fetcher, expected] of [
    [async () => new Response("credential=do-not-expose", { status: 503 }), "SUMMARY_HTTP_ERROR"],
    [async () => new Response("credential=do-not-expose"), "SUMMARY_DECODE_FAILED"],
    [
      async () => {
        throw new Error("credential=do-not-expose");
      },
      "SUMMARY_FETCH_FAILED",
    ],
    [
      async () => json([row(202512, "33", 123, { reporterCode: 392 })]),
      "SUMMARY_DIMENSIONS_UNVERIFIED",
    ],
  ] as const) {
    const store = createMemoryExportTradeStore({ now: () => at });
    const result = await createHs2CategorySummaryClient({ store, now: () => at, fetch: fetcher })({
      categoryIds: ["cosmetics"],
      referencePeriod: "2025-12",
    });
    assert.equal(result.providers[0]!.reasonCode, expected);
    assert.doesNotMatch(JSON.stringify(result), /credential|do-not-expose/);
  }
});

test("the shared origin lease covers slow metadata and data without admitting a peer after45seconds", async () => {
  let now = new Date(at);
  const store = createMemoryExportTradeStore({ now: () => now });
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const read = createHs2CategorySummaryClient({
    store,
    now: () => now,
    fetch: async (input) => {
      if (String(input).includes("getDa")) return json([publication()]);
      now = new Date(at.getTime() + 60_000);
      entered();
      await gate;
      return json([row(202512, "33", 123)]);
    },
  });
  const result = read({ categoryIds: ["cosmetics"], discoverLatest: true });
  await started;
  assert.equal(await store.acquireRefresh("comtrade-origin"), null);
  assert.equal(
    await store.retryAt("comtrade-origin"),
    new Date(at.getTime() + 75_000).toISOString(),
  );
  release();
  assert.ok((await result).summaries.cosmetics);
  assert.ok(
    await store.acquireRefresh("comtrade-origin"),
    "fenced release permits the next worker after completion",
  );
});
