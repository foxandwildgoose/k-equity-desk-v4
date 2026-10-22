import assert from "node:assert/strict";
import { test } from "node:test";
import { createExportTradeStore } from "./export-trade-store.ts";
import { createSharedComtradeClient } from "./export-comtrade-shared.ts";
import type { ComtradeTrade } from "./export-comtrade.ts";

test("separate clients share the provider's Retry-After across totals and categories", async () => {
  let clock = Date.parse("2026-10-22T01:00:00Z"),
    calls = 0;
  const now = () => new Date(clock);
  const store = createExportTradeStore(undefined, { now });
  const result: ComtradeTrade = {
    exports: [],
    imports: [],
    observations: [],
    destinations: { period: "", rows: [], source: "UN Comtrade" },
    latestPeriod: null,
    monthsCached: 0,
    providers: [
      {
        id: "comtrade.total",
        name: "UN Comtrade",
        configured: true,
        state: "rate-limited",
        message: "TEST_FIXTURE_ONLY",
        checkedAt: now().toISOString(),
        asOf: null,
        recordCount: 0,
        sourceUrl: "https://comtradeplus.un.org/",
        retryAt: new Date(clock + 3_600_000).toISOString(),
      },
    ],
  };
  const options = {
    store: async () => store,
    now,
    load: async () => {
      calls++;
      return result;
    },
  };
  await createSharedComtradeClient(options).fetchSharedComtradeTrade({ months: 4 });
  const blocked = await createSharedComtradeClient(options).fetchSharedComtradeTrade({
    categoryId: "hs2:85",
    months: 36,
  });
  assert.equal(calls, 1, "a new category or server client must not circumvent the origin cooldown");
  assert.equal(blocked.providers[0]!.reasonCode, "SHARED_PROVIDER_COOLDOWN");
  assert.equal(blocked.providers[0]!.retryAt, result.providers[0]!.retryAt);
  clock += 3_600_001;
  await createSharedComtradeClient(options).fetchSharedComtradeTrade({ months: 4 });
  assert.equal(calls, 2);
});

test("only one cross-client request wave reaches the public provider at a time", async () => {
  const store = createExportTradeStore();
  let release: () => void = () => {},
    calls = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const load = async (): Promise<ComtradeTrade> => {
    calls++;
    await gate;
    return {
      exports: [],
      imports: [],
      observations: [],
      destinations: { period: "", rows: [], source: "" },
      providers: [],
      latestPeriod: null,
      monthsCached: 0,
    };
  };
  const options = { store: async () => store, load };
  const first = createSharedComtradeClient(options).fetchSharedComtradeTrade({ months: 4 });
  while (!calls) await new Promise((resolve) => setImmediate(resolve));
  const other = await createSharedComtradeClient(options).fetchSharedComtradeTrade({
    categoryId: "hs2:84",
  });
  assert.equal(calls, 1);
  assert.equal(other.providers[0]!.reasonCode, "REFRESH_IN_PROGRESS");
  release();
  await first;
  await createSharedComtradeClient(options).fetchSharedComtradeTrade({ categoryId: "hs2:84" });
  assert.equal(
    calls,
    2,
    "completion releases the lease without suppressing future legitimate requests",
  );
});
