import assert from "node:assert/strict";
import { test } from "node:test";
import { createCachedTradePipeline } from "./export-trade-cache.ts";
import { createMemoryExportTradeStore } from "./export-trade-store.ts";
import type { LiveTradeBundle } from "./export-trade-pipeline.ts";

const checked = new Date("2026-10-22T03:00:00Z");
const bundle = (): LiveTradeBundle => ({
  exports: [
    { period: "2026-08", valueUsd: 10 },
    { period: "2026-09", valueUsd: 20 },
  ],
  imports: [
    { period: "2026-08", valueUsd: 8 },
    { period: "2026-09", valueUsd: 15 },
  ],
  observations: [],
  destinations: { period: "", rows: [], source: "미확보" },
  news: [],
  comtradeLatestPeriod: null,
  comtradeMonthsCached: 0,
  source: {
    totals: "관세청 공식 USD 비계절조정",
    items: "자료 미확보",
    fetchedAt: checked.toISOString(),
    totalsProviderId: "customs.total",
  },
  notes: [],
  providers: [
    {
      id: "customs.total",
      name: "관세청",
      configured: true,
      state: "ok",
      message: "검증됨",
      checkedAt: checked.toISOString(),
      asOf: "2026-09",
      recordCount: 2,
      sourceUrl: "https://www.data.go.kr/data/15102108/openapi.do",
    },
  ],
});
const category = () => ({
  observations: [
    {
      period: "2026-09",
      categoryId: "semiconductors",
      classification: "HS" as const,
      sourceFile: "관세청 공식",
      valueUsd: 5,
    },
  ],
  providers: [{ ...bundle().providers[0]!, id: "customs.item", recordCount: 1 }],
});

test("a repaired acquisition revision rechecks persisted provider results instead of serving an old failure for six hours", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  const previous = bundle();
  previous.source.pipelineRevision = "old";
  await store.saveBundle(previous);
  let requests = 0;
  const service = createCachedTradePipeline({
    store,
    now: () => checked,
    revision: "new",
    loadBundle: async () => {
      requests++;
      return { ...bundle(), source: { ...bundle().source, pipelineRevision: "new" } };
    },
    loadCategory: async () => category(),
  });
  const repaired = await service.fetchLiveTradeSnapshot();
  assert.equal(requests, 1);
  assert.equal(repaired.source.pipelineRevision, "new");
  await service.fetchLiveTradeSnapshot();
  assert.equal(requests, 1, "the repaired verified result is cached normally");
});

test("a deployment or credential activation rechecks category history without discarding verified fallback", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  let requests = 0;
  const dependencies = {
    store,
    now: () => checked,
    loadBundle: async () => bundle(),
    loadCategory: async () => {
      requests++;
      return category();
    },
  };
  const first = createCachedTradePipeline({ ...dependencies, revision: "deployment-a" });
  await first.fetchTradeCategorySnapshot("semiconductors");
  await first.fetchTradeCategorySnapshot("semiconductors");
  assert.equal(requests, 1);
  const redeployed = createCachedTradePipeline({ ...dependencies, revision: "deployment-b" });
  const updated = await redeployed.fetchTradeCategorySnapshot("semiconductors");
  assert.equal(requests, 2);
  assert.equal(updated.cacheRevision, "deployment-b");
});

test("fresh verified cache returns immediately without any source requests", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  await store.saveBundle(bundle());
  const service = createCachedTradePipeline({
    store,
    now: () => checked,
    loadBundle: async () => {
      throw new Error("must not fetch");
    },
    loadCategory: async () => {
      throw new Error("must not fetch");
    },
  });
  const result = await service.fetchLiveTradeSnapshot();
  assert.deepEqual(result.exports, bundle().exports);
  assert.equal(result.providers.at(-1)!.reasonCode, "CACHE_HIT");
  assert.match(result.providers.at(-1)!.message, /memory/);
});

test("in-process singleflight and cross-instance leases prevent a cold-page request flood", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  let finish: (value: LiveTradeBundle) => void = () => {};
  let started: () => void = () => {};
  const running = new Promise<void>((resolve) => {
    started = resolve;
  });
  let calls = 0;
  const loadBundle = async () => {
    calls++;
    started();
    return new Promise<LiveTradeBundle>((resolve) => {
      finish = resolve;
    });
  };
  const one = createCachedTradePipeline({
    store,
    now: () => checked,
    loadBundle,
    loadCategory: async () => category(),
  });
  const two = createCachedTradePipeline({
    store,
    now: () => checked,
    loadBundle,
    loadCategory: async () => category(),
  });
  const first = one.fetchLiveTradeSnapshot(),
    duplicate = one.fetchLiveTradeSnapshot();
  assert.equal(first, duplicate);
  await running;
  const waiting = await two.fetchLiveTradeSnapshot();
  assert.equal(waiting.exports.length, 0);
  assert.equal(waiting.providers.at(-1)!.reasonCode, "REFRESH_IN_PROGRESS");
  assert.equal(calls, 1);
  finish(bundle());
  await first;
  assert.deepEqual((await two.fetchLiveTradeSnapshot()).exports, bundle().exports);
  assert.equal(calls, 1);
});

test("failed refresh retains real data, original source and statistical month plus the current failure", async () => {
  let time = new Date(checked);
  const store = createMemoryExportTradeStore({ now: () => time });
  await store.saveBundle(bundle());
  time = new Date(checked.getTime() + 7 * 3_600_000);
  const failed = bundle();
  failed.exports = [];
  failed.imports = [];
  failed.providers = [
    {
      ...failed.providers[0]!,
      state: "rate-limited",
      recordCount: 0,
      asOf: null,
      reasonCode: "HTTP_429",
      checkedAt: time.toISOString(),
    },
  ];
  const service = createCachedTradePipeline({
    store,
    now: () => time,
    loadBundle: async () => failed,
    loadCategory: async () => category(),
  });
  const shown = await service.fetchLiveTradeSnapshot();
  assert.deepEqual(shown.exports, bundle().exports);
  assert.deepEqual(shown.source, bundle().source);
  assert.equal(shown.providers.find((p) => p.id === "customs.total")!.state, "stale");
  assert.equal(
    shown.providers.find((p) => p.id === "customs.total.refresh")!.reasonCode,
    "HTTP_429",
  );
  assert.equal(shown.providers.at(-1)!.reasonCode, "VERIFIED_CACHE");
  assert.equal((await store.readBundle())!.verifiedAt, checked.toISOString());
});

test("an unexpected loader exception cannot suppress the last verified snapshot or leak details", async () => {
  let time = new Date(checked);
  const store = createMemoryExportTradeStore({ now: () => time });
  await store.saveBundle(bundle());
  time = new Date(checked.getTime() + 7 * 3_600_000);
  const service = createCachedTradePipeline({
    store,
    now: () => time,
    loadBundle: async () => {
      throw new Error("sensitive upstream detail");
    },
    loadCategory: async () => category(),
  });
  const result = await service.fetchLiveTradeSnapshot();
  assert.equal(result.exports.length, 2);
  assert.ok(!JSON.stringify(result).includes("sensitive"));
});

test("a source's older publication cannot replace a newer coherent saved dataset", async () => {
  let time = new Date(checked);
  const store = createMemoryExportTradeStore({ now: () => time });
  await store.saveBundle(bundle());
  time = new Date(checked.getTime() + 7 * 3_600_000);
  const older = bundle();
  older.exports.pop();
  older.imports.pop();
  older.providers[0]!.asOf = "2026-08";
  const service = createCachedTradePipeline({
    store,
    now: () => time,
    loadBundle: async () => older,
    loadCategory: async () => category(),
  });
  assert.equal((await service.fetchLiveTradeSnapshot()).exports.at(-1)!.period, "2026-09");
  assert.equal((await store.readBundle())!.value.exports.length, 2);
});

test("selected-source evidence must be valid even when a different provider is healthy in the same month", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  const unverified = bundle();
  unverified.providers = [
    { ...unverified.providers[0]!, state: "unavailable", recordCount: 0 },
    { ...unverified.providers[0]!, id: "comtrade.total", state: "ok" },
  ];
  const service = createCachedTradePipeline({
    store,
    now: () => checked,
    loadBundle: async () => unverified,
    loadCategory: async () => category(),
  });
  assert.equal((await service.fetchLiveTradeSnapshot()).exports.length, 0);
  assert.equal(await store.readBundle(), null);
});

test("category histories use their own verified cache and failed refresh preserves values", async () => {
  let time = new Date(checked),
    calls = 0;
  const store = createMemoryExportTradeStore({ now: () => time });
  const service = createCachedTradePipeline({
    store,
    now: () => time,
    loadBundle: async () => bundle(),
    loadCategory: async () => {
      calls++;
      if (calls === 1) return category();
      throw new Error("failed");
    },
  });
  assert.equal(
    (await service.fetchTradeCategorySnapshot("semiconductors")).observations[0]!.valueUsd,
    5,
  );
  assert.equal(
    (await service.fetchTradeCategorySnapshot("semiconductors")).providers.at(-1)!.reasonCode,
    "CACHE_HIT",
  );
  assert.equal(calls, 1);
  time = new Date(checked.getTime() + 7 * 3_600_000);
  const old = await service.fetchTradeCategorySnapshot("semiconductors");
  assert.equal(old.observations[0]!.valueUsd, 5);
  assert.equal(old.providers.at(-1)!.state, "stale");
  assert.equal(calls, 2);
});

test("an officially verified stale source remains visible without being promoted to a fresh cache entry", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  const existing = bundle();
  existing.providers[0] = { ...existing.providers[0]!, state: "stale", reasonCode: "HTTP_429" };
  const oldCategory = category();
  oldCategory.providers[0] = {
    ...oldCategory.providers[0]!,
    state: "stale",
    reasonCode: "HTTP_429",
  };
  const service = createCachedTradePipeline({
    store,
    now: () => checked,
    loadBundle: async () => existing,
    loadCategory: async () => oldCategory,
  });
  const shown = await service.fetchLiveTradeSnapshot();
  assert.deepEqual(shown.exports, existing.exports);
  assert.equal(shown.providers.at(-1)!.state, "stale");
  assert.equal(shown.providers.at(-1)!.reasonCode, "VERIFIED_SOURCE_STALE");
  assert.equal(await store.readBundle(), null);
  const industry = await service.fetchTradeCategorySnapshot("semiconductors");
  assert.equal(industry.observations[0]!.valueUsd, 5);
  assert.equal(industry.providers.at(-1)!.state, "stale");
  assert.equal(await store.readCategory("semiconductors"), null);
});

test("a failed SQL admission falls back to real memory coordination and still fetches healthy official data", async () => {
  const { createExportTradeStore } = await import("./export-trade-store.ts");
  const store = createExportTradeStore(
    {
      query: async () => {
        throw new Error("database offline");
      },
    },
    { now: () => checked },
  );
  let calls = 0;
  const service = createCachedTradePipeline({
    store,
    now: () => checked,
    loadBundle: async () => {
      calls++;
      return bundle();
    },
    loadCategory: async () => category(),
  });
  const shown = await service.fetchLiveTradeSnapshot();
  assert.equal(calls, 1);
  assert.equal(shown.exports.length, 2);
  assert.match(shown.providers.at(-1)!.message, /memory/);
  assert.notEqual(shown.providers.at(-1)!.reasonCode, "REFRESH_IN_PROGRESS");
});

test("failed totals do not hide independently verified HS and destination records", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  const partial = bundle();
  partial.exports = [];
  partial.imports = [];
  partial.observations = [
    ...category().observations,
    { ...category().observations[0]!, categoryId: "TOTAL", classification: "TOTAL", valueUsd: 999 },
  ];
  partial.destinations = {
    period: "2026-09",
    source: "관세청 국가별",
    rows: [{ partnerCode: "US", name: "미국", valueUsd: 8, share: null }],
  };
  partial.providers = [
    { ...partial.providers[0]!, state: "invalid-key", recordCount: 0 },
    ...category().providers,
    { ...partial.providers[0]!, id: "customs.country", state: "ok", recordCount: 1 },
  ];
  const service = createCachedTradePipeline({
    store,
    now: () => checked,
    loadBundle: async () => partial,
    loadCategory: async () => category(),
  });
  const shown = await service.fetchLiveTradeSnapshot();
  assert.equal(shown.exports.length, 0);
  assert.deepEqual(shown.observations, category().observations);
  assert.deepEqual(shown.destinations, partial.destinations);
  assert.equal(await store.readBundle(), null);
});
