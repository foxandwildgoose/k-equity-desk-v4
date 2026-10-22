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

const empty = { exports: [], imports: [], providers: [], source: "TEST_FIXTURE_ONLY" };
function fixturePipeline(dependencies: Parameters<typeof createTradePipeline>[0]) {
  return createTradePipeline({
    publicCustoms: async () => ({ observations: [], providers: [], source: "TEST_FIXTURE_ONLY" }),
    oecd: async () => empty,
    worldbank: async () => empty,
    ...dependencies,
  });
}

test("official totals stay whole while a small independent UN snapshot supplies HS tables", async () => {
  let calls = 0;
  const pipeline = fixturePipeline({
    customs: async () => official,
    fred: async () => fred,
    comtrade: async (request) => {
      calls++;
      assert.equal(
        request?.months,
        4,
        "only recent HS tables are needed with official total history",
      );
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
  const pipeline = fixturePipeline({
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
  const pipeline = fixturePipeline({
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
  const pipeline = fixturePipeline({
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

test("direct key-free official totals are selected without mixing older provider months", async () => {
  const direct = {
    ...fred,
    exports: points,
    imports: points,
    source: "OECD verified NSA fixture",
    providers: [status("oecd.exports")],
  };
  const pipeline = fixturePipeline({
    customs: async () => ({ ...official, exports: [], imports: [] }),
    oecd: async () => direct,
    fred: async () => ({ ...fred, exports: [{ period: "2025-09", valueUsd: 500 }] }),
    comtrade: async () => un,
  });
  const result = await pipeline.fetchLiveTradeSnapshot();
  assert.equal(result.source.totals, direct.source);
  assert.deepEqual(result.exports, direct.exports);
  assert.deepEqual(result.imports, direct.imports);
  assert.ok(result.observations.every((p) => p.period.startsWith("2026-")));
});

test("a newer verified dataset supersedes a discontinued preferred source as a whole", async () => {
  const global = {
    ...fred,
    exports: [{ period: "2026-09", valueUsd: 400 }],
    imports: [{ period: "2026-09", valueUsd: 300 }],
    source: "World Bank GEM verified NSA fixture",
  };
  const pipeline = fixturePipeline({
    customs: async () => ({
      ...official,
      exports: [{ period: "2026-05", valueUsd: 10 }],
      imports: [],
    }),
    oecd: async () => ({ ...empty, exports: [{ period: "2026-08", valueUsd: 20 }] }),
    worldbank: async () => global,
    fred: async () => ({ ...fred, exports: [{ period: "2023-12", valueUsd: 99 }] }),
    comtrade: async () => un,
  });
  const result = await pipeline.fetchLiveTradeSnapshot();
  assert.equal(result.source.totals, global.source);
  assert.deepEqual(result.exports, global.exports);
  assert.deepEqual(result.imports, global.imports);
});

test("an unexpected provider exception cannot discard a healthy independent export dataset", async () => {
  const pipeline = fixturePipeline({
    customs: async () => {
      throw new Error("private upstream detail must not escape");
    },
    oecd: async () => ({ ...fred, source: "OECD TEST_FIXTURE_ONLY" }),
    fred: async () => ({ ...fred, exports: [] }),
    comtrade: async () => {
      throw new Error("unavailable");
    },
  });
  const result = await pipeline.fetchLiveTradeSnapshot();
  assert.deepEqual(result.exports, fred.exports);
  assert.equal(result.source.totalsProviderId, "oecd.exports");
  assert.equal(
    result.providers.find((p) => p.id === "customs.total")?.reasonCode,
    "PROVIDER_REQUEST_FAILED",
  );
  assert.ok(!JSON.stringify(result).includes("private upstream"));
});

test("equal publication months prefer an analysis-ready whole history over a one-month response", async () => {
  const history = Array.from({ length: 24 }, (_, i) => ({
    period: new Date(Date.UTC(2024, 9 + i, 1)).toISOString().slice(0, 7),
    valueUsd: i + 1,
  }));
  const pipeline = fixturePipeline({
    customs: async () => ({ ...official, exports: [history.at(-1)!], imports: [] }),
    oecd: async () => ({
      ...fred,
      exports: history,
      imports: history,
      source: "OECD TEST_FIXTURE_ONLY",
    }),
    fred: async () => ({ ...fred, exports: [] }),
    comtrade: async () => un,
  });
  const result = await pipeline.fetchLiveTradeSnapshot();
  assert.deepEqual(result.exports, history);
  assert.equal(result.source.totalsProviderId, "oecd.exports");
});

test("a category provider exception still permits independently verified fallback history", async () => {
  const observations = [
    {
      period: "2026-09",
      categoryId: "hs2:85",
      classification: "HS" as const,
      sourceFile: "TEST_FIXTURE_ONLY",
      valueUsd: 50,
    },
  ];
  const pipeline = fixturePipeline({
    customs: async () => {
      throw new Error("unexpected upstream failure");
    },
    comtrade: async (request) => {
      assert.equal(request?.categoryId, "hs2:85");
      return { ...un, observations };
    },
  });
  const result = await pipeline.fetchTradeCategorySnapshot("hs2:85");
  assert.deepEqual(result.observations, observations);
  assert.equal(result.providers[0]?.reasonCode, "PROVIDER_REQUEST_FAILED");
});

test("verified public Customs HS4 history works without an OpenAPI key or a UN request", async () => {
  const observations = [
    {
      period: "2026-09",
      categoryId: "semiconductors",
      classification: "HS" as const,
      sourceFile: "TEST_FIXTURE_ONLY",
      valueUsd: 50,
    },
  ];
  const pipeline = fixturePipeline({
    customs: async () => ({ ...official, observations: [] }),
    publicCustoms: async (request) => {
      assert.equal(request.categoryId, "semiconductors");
      return {
        observations,
        providers: [
          { ...status("customs.public-item"), sourceUrl: "https://tradedata.go.kr/cts/index.do" },
        ],
        source: "TEST_FIXTURE_ONLY",
      };
    },
    comtrade: async () => {
      throw new Error("must not spend the public UN quota");
    },
  });
  const result = await pipeline.fetchTradeCategorySnapshot("semiconductors");
  assert.deepEqual(result.observations, observations);
  assert.ok(result.providers.some((p) => p.id === "customs.public-item"));
});
