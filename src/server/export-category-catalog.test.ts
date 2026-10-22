import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createTradeCategoryCatalog } from "./export-category-catalog.ts";
import { createMemoryExportTradeStore, type TradeCategorySnapshot } from "./export-trade-store.ts";

const checked = new Date("2026-10-22T03:00:00Z");
const categories = (ids: string[]) => ids.map((id) => ({ id, label: id }));
function snapshot(id: string): TradeCategorySnapshot {
  return {
    observations: Array.from({ length: 36 }, (_, index) => ({
      period: new Date(Date.UTC(2023, 9 + index, 1)).toISOString().slice(0, 7),
      categoryId: id,
      categoryName: id,
      classification: "HS" as const,
      geo: "KR",
      valueUsd: 100 + index,
      sourceFile: "관세청 공식 월별 통계 · 테스트 fixture",
    })),
    providers: [
      {
        id: "customs.public-item",
        name: "관세청 공개 웹통계 HS4",
        configured: true,
        state: "ok",
        message: "정확한 품목과 월을 확인했습니다.",
        checkedAt: checked.toISOString(),
        asOf: "2026-09",
        recordCount: 36,
        sourceUrl: "https://tradedata.go.kr/cts/hmpg/openETS0100019Q.do",
      },
    ],
  };
}
const unavailable = (): TradeCategorySnapshot => ({
  observations: [],
  providers: [
    {
      id: "customs.item",
      name: "관세청 품목별 수출입실적",
      configured: false,
      state: "missing-key",
      message: "서버 키 미등록",
      reasonCode: "KEY_MISSING",
      checkedAt: checked.toISOString(),
      asOf: null,
      recordCount: 0,
      sourceUrl: "https://www.data.go.kr/data/15101609/openapi.do",
    },
  ],
});

test("cache-only catalog exposes every stored category to a new browser without origin requests", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  const ids = ["semiconductors", "auto_parts", "computers"];
  for (const id of ids) assert.equal(await store.saveCategory(id, snapshot(id)), true);
  let calls = 0;
  const read = createTradeCategoryCatalog({
    store,
    now: () => checked,
    categories: categories([...ids, "automobiles"]),
    loadCategory: async () => {
      calls++;
      return unavailable();
    },
  });
  const result = await read();
  assert.equal(calls, 0);
  assert.equal(result.items.length, 4);
  for (const item of result.items.slice(0, 3)) {
    assert.equal(item.current?.period, "2026-09");
    assert.equal(item.current?.valueUsd, 135);
    assert.equal(item.previousYoY?.period, "2025-09");
    assert.equal(item.previousYoY?.valueUsd, 123);
    assert.equal(item.yoyPct, (135 / 123 - 1) * 100);
    assert.equal(item.classification, "HS");
    assert.equal(item.count, 36);
    assert.equal(item.state, "ok");
    assert.equal(item.verifiedAt, checked.toISOString());
  }
  assert.deepEqual(result.pending, ["automobiles"]);
  assert.deepEqual(result.attempted, []);
});

test("YoY requires the exact prior-year month and the same source, classification, geography and vintage", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  const missing = snapshot("semiconductors");
  missing.observations = missing.observations.filter((row) => row.period !== "2025-09");
  await store.saveCategory("semiconductors", missing);
  const mixed = snapshot("auto_parts");
  mixed.observations.find((row) => row.period === "2025-09")!.sourceFile = "다른 공식 집계 정의";
  await store.saveCategory("auto_parts", mixed);
  const read = createTradeCategoryCatalog({
    store,
    now: () => checked,
    categories: categories(["semiconductors", "auto_parts"]),
  });
  const result = await read();
  assert.ok(result.items.every((item) => item.previousYoY === null && item.yoyPct === null));
  assert.deepEqual(
    result.items.map((item) => item.count),
    [35, 35],
  );
});

test("a zero prior-year observation is retained but does not manufacture infinite growth", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  const value = snapshot("semiconductors");
  value.observations.find((row) => row.period === "2025-09")!.valueUsd = 0;
  await store.saveCategory("semiconductors", value);
  const result = await createTradeCategoryCatalog({
    store,
    now: () => checked,
    categories: categories(["semiconductors"]),
  })();
  assert.equal(result.items[0]!.previousYoY?.valueUsd, 0);
  assert.equal(result.items[0]!.yoyPct, null);
});

test("automatic warming awaits at most two category loaders and leaves the remaining queue pending", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  let active = 0,
    maxActive = 0;
  const calls: string[] = [];
  const read = createTradeCategoryCatalog({
    store,
    now: () => checked,
    categories: categories(["semiconductors", "auto_parts", "computers"]),
    loadCategory: async (id) => {
      calls.push(id);
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(10);
      const value = snapshot(id);
      await store.saveCategory(id, value);
      active--;
      return value;
    },
  });
  const first = await read({ refresh: true });
  assert.equal(calls.length, 2);
  assert.equal(maxActive, 2);
  assert.equal(active, 0, "no unawaited serverless work survives the response");
  assert.equal(first.refreshed.length, 2);
  assert.deepEqual(first.pending, ["computers"]);
  const second = await read({ refresh: true });
  assert.equal(calls.length, 3);
  assert.equal(second.items.filter((item) => item.current).length, 3);
  assert.deepEqual(second.pending, []);
});

test("global admission stops concurrent visitors from multiplying category warming", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  let resolve: () => void;
  const gate = new Promise<void>((done) => {
    resolve = done;
  });
  let started: () => void;
  const entered = new Promise<void>((done) => {
    started = done;
  });
  let calls = 0;
  const dependencies = {
    store,
    now: () => checked,
    categories: categories(["semiconductors", "auto_parts", "computers"]),
    loadCategory: async () => {
      calls++;
      started();
      await gate;
      return unavailable();
    },
  };
  const first = createTradeCategoryCatalog(dependencies)({ refresh: true });
  await entered;
  const peer = await createTradeCategoryCatalog(dependencies)({ refresh: true });
  assert.deepEqual(peer.attempted, []);
  assert.equal(calls, 2);
  resolve!();
  await first;
});

test("persistent failure cooldown settles unavailable rows, advances the queue and applies to later visitors", async () => {
  let time = new Date(checked),
    calls = 0;
  const store = createMemoryExportTradeStore({ now: () => time });
  const dependencies = {
    store,
    now: () => time,
    categories: categories(["semiconductors", "auto_parts", "computers", "automobiles"]),
    loadCategory: async () => {
      calls++;
      return unavailable();
    },
  };
  const read = createTradeCategoryCatalog(dependencies);
  const first = await read({ refresh: true });
  assert.equal(first.items.filter((item) => item.state === "unavailable").length, 2);
  assert.equal(first.items[0]!.providers[0]!.reasonCode, "KEY_MISSING");
  const second = await read({ refresh: true });
  assert.equal(calls, 4);
  assert.deepEqual(second.pending, []);
  const visitor = await createTradeCategoryCatalog(dependencies)({ refresh: true });
  assert.equal(calls, 4);
  assert.ok(visitor.items.every((item) => item.state === "unavailable" && item.retryAt));
  assert.ok(
    visitor.items.every((item) => item.providers[0]!.reasonCode === "RECENT_REFRESH_UNAVAILABLE"),
  );
  time = new Date(time.getTime() + 5 * 60_000 + 1);
  const retry = await read();
  assert.equal(retry.pending.length, 4);
  assert.equal(calls, 4);
});

test("busy category refreshes stay pending instead of being negative-cached as source failures", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  let calls = 0;
  const read = createTradeCategoryCatalog({
    store,
    now: () => checked,
    categories: categories(["semiconductors"]),
    loadCategory: async () => {
      calls++;
      return {
        observations: [],
        providers: [
          { ...unavailable().providers[0]!, state: "partial", reasonCode: "REFRESH_IN_PROGRESS" },
        ],
      };
    },
  });
  assert.deepEqual((await read({ refresh: true })).pending, ["semiconductors"]);
  assert.equal((await read()).items[0]!.state, "pending");
  await read({ refresh: true });
  assert.equal(calls, 2);
});

test("a refresh failure preserves stale verified values and their original statistical/verification dates", async () => {
  let time = new Date(checked);
  const store = createMemoryExportTradeStore({ now: () => time });
  await store.saveCategory("semiconductors", snapshot("semiconductors"));
  time = new Date(time.getTime() + 7 * 3_600_000);
  const read = createTradeCategoryCatalog({
    store,
    now: () => time,
    categories: categories(["semiconductors"]),
    loadCategory: async () => unavailable(),
  });
  const before = await read();
  assert.equal(before.items[0]!.state, "stale");
  assert.deepEqual(before.pending, ["semiconductors"]);
  const after = await read({ refresh: true });
  assert.equal(after.items[0]!.current?.valueUsd, 135);
  assert.equal(after.items[0]!.current?.period, "2026-09");
  assert.equal(after.items[0]!.verifiedAt, checked.toISOString());
  assert.equal(after.items[0]!.state, "stale");
  assert.ok(after.items[0]!.retryAt);
  assert.deepEqual(after.pending, []);
});

test("foreign geography and rejected identity cannot become national card observations", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  const foreign = snapshot("semiconductors");
  for (const row of foreign.observations) row.geo = "US";
  // The catalog adds its national scope guard to the pre-existing store checks.
  assert.equal(await store.saveCategory("semiconductors", foreign), true);
  const result = await createTradeCategoryCatalog({
    store,
    now: () => checked,
    categories: categories(["semiconductors"]),
    loadCategory: async () => foreign,
  })({ refresh: true });
  assert.equal(result.items[0]!.current, null);
  assert.equal(result.items[0]!.state, "unavailable");
});

test("a regressing refresh cannot replace a newer positive cached card", async () => {
  let time = new Date(checked);
  const store = createMemoryExportTradeStore({ now: () => time });
  await store.saveCategory("semiconductors", snapshot("semiconductors"));
  time = new Date(time.getTime() + 7 * 3_600_000);
  const older = snapshot("semiconductors");
  older.observations.pop();
  older.providers[0]!.asOf = "2026-08";
  const result = await createTradeCategoryCatalog({
    store,
    now: () => time,
    categories: categories(["semiconductors"]),
    loadCategory: async () => older,
  })({ refresh: true });
  assert.equal(result.items[0]!.current?.period, "2026-09");
  assert.equal(result.items[0]!.state, "stale");
});

test("a publication-lag stale provider in a fresh stored entry does not create an endless refresh queue", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  const value = snapshot("semiconductors");
  value.providers[0]!.state = "stale";
  assert.equal(await store.saveCategory("semiconductors", value), true);
  let calls = 0;
  const result = await createTradeCategoryCatalog({
    store,
    now: () => checked,
    categories: categories(["semiconductors"]),
    loadCategory: async () => {
      calls++;
      return value;
    },
  })({ refresh: true });
  assert.equal(result.items[0]!.state, "stale");
  assert.deepEqual(result.pending, []);
  assert.equal(calls, 0);
});

test("negative admission respects a longer provider-directed retry time across visitors", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  const value = unavailable();
  value.providers[0]!.retryAt = new Date(checked.getTime() + 15 * 60_000).toISOString();
  const dependencies = {
    store,
    now: () => checked,
    categories: categories(["automobiles"]),
    loadCategory: async () => value,
  };
  const first = await createTradeCategoryCatalog(dependencies)({ refresh: true });
  assert.equal(first.items[0]!.retryAt, value.providers[0]!.retryAt);
  const visitor = await createTradeCategoryCatalog(dependencies)();
  assert.equal(visitor.items[0]!.retryAt, value.providers[0]!.retryAt);
});

test("a malformed loader result cannot suppress the remaining verified cached categories", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  await store.saveCategory("semiconductors", snapshot("semiconductors"));
  const result = await createTradeCategoryCatalog({
    store,
    now: () => checked,
    categories: categories(["semiconductors", "automobiles"]),
    loadCategory: async () =>
      ({ observations: [], providers: null }) as unknown as TradeCategorySnapshot,
  })({ refresh: true });
  assert.equal(result.items[0]!.current?.valueUsd, 135);
  assert.equal(result.items[1]!.state, "unavailable");
  assert.deepEqual(result.pending, []);
});

test("an unrelated positive provider cannot replace the category verification timestamp", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  const value = snapshot("semiconductors");
  value.providers.unshift({
    ...value.providers[0]!,
    id: "customs.total",
    checkedAt: new Date(checked.getTime() - 3_600_000).toISOString(),
  });
  const result = await createTradeCategoryCatalog({
    store,
    now: () => checked,
    categories: categories(["semiconductors"]),
    loadCategory: async () => value,
  })({ refresh: true });
  assert.equal(result.items[0]!.verifiedAt, checked.toISOString());
});
