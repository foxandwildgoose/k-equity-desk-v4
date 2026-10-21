import assert from "node:assert/strict";
import { test } from "node:test";
import { createTradePipeline } from "./export-trade-pipeline.ts";
import type { ExportProviderStatus } from "../lib/export-desk/provider-status.ts";

const points = [
  { period: "2026-08", valueUsd: 10 },
  { period: "2026-09", valueUsd: 20 },
];
const status = (id: string): ExportProviderStatus => ({
  id,
  name: id,
  configured: true,
  state: "ok",
  message: "fixture",
  checkedAt: "2026-10-21T00:00:00Z",
  asOf: "2026-09",
  recordCount: 2,
  sourceUrl: "https://www.data.go.kr/",
});
const destinations = { period: "", rows: [], source: "fixture" };
const official = {
  exports: points,
  imports: points,
  observations: [],
  destinations,
  providers: [status("customs-total")],
};
const fred = {
  exports: points.map((r) => ({ ...r, valueUsd: r.valueUsd * 100 })),
  imports: [],
  providers: [status("fred.exports")],
  source: "FRED verified SA fixture",
};
const un = {
  exports: [{ period: "2026-07", valueUsd: 30 }],
  imports: [],
  observations: [],
  destinations,
  providers: [status("comtrade.total")],
  latestPeriod: "2026-07",
  monthsCached: 1,
};

test("official totals stay whole while a small independent UN snapshot supplies HS tables", async () => {
  let calls = 0;
  const pipeline = createTradePipeline({
    hasCustomsKey: () => true,
    customs: async () => official,
    fred: async () => fred,
    comtrade: async (request) => {
      calls++;
      assert.equal(request?.months, 4, "only recent HS tables are needed with official total history");
      return un;
    },
  });
  const result = await pipeline.fetchLiveTradeSnapshot();
  assert.deepEqual(result.exports, points);
  assert.equal(calls, 1);
  assert.deepEqual(
    result.observations.map((r) => r.period),
    ["2026-08", "2026-09"],
  );
  assert.ok(result.providers.some((p) => p.id === "customs.total"));
});

test("verified FRED remains one coherent source; missing Customs does not prevent key-free retrieval", async () => {
  let calls = 0;
  const pipeline = createTradePipeline({
    hasCustomsKey: () => false,
    customs: async () => ({ ...official, exports: [], imports: [] }),
    fred: async () => fred,
    comtrade: async () => {
      calls++;
      return un;
    },
  });
  const result = await pipeline.fetchLiveTradeSnapshot();
  assert.deepEqual(result.exports, fred.exports);
  assert.equal(result.source.totals, fred.source);
  assert.equal(calls, 1);
  assert.ok(!result.observations.some((r) => r.categoryId === "TOTAL" && r.period === "2026-07"));
});

test("unavailable FRED falls back to actual UN total records, never zero or synthetic rows", async () => {
  const pipeline = createTradePipeline({
    hasCustomsKey: () => false,
    customs: async () => ({ ...official, exports: [], imports: [] }),
    fred: async () => ({ ...fred, exports: [] }),
    comtrade: async () => un,
  });
  const result = await pipeline.fetchLiveTradeSnapshot();
  assert.deepEqual(result.exports, un.exports);
  assert.equal(result.observations.length, 1);
  assert.match(result.source.totals, /UN Comtrade/);
});

test("category histories prefer the complete official dataset and load only the selected category", async () => {
  const ids: (string | undefined)[] = [];
  const observed = {
    period: "2026-09",
    categoryId: "semiconductors",
    valueUsd: 30,
    classification: "HS" as const,
    sourceFile: "fixture",
  };
  const pipeline = createTradePipeline({
    customs: async (request) => {
      ids.push(request?.categoryId);
      return { ...official, observations: [observed] };
    },
    comtrade: async () => {
      throw new Error("fallback must not replace official history");
    },
  });
  const result = await pipeline.fetchTradeCategorySnapshot("semiconductors");
  assert.deepEqual(ids, ["semiconductors"]);
  assert.deepEqual(result.observations, [observed]);
});
