import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  createExportTradeStore,
  createMemoryExportTradeStore,
  staleTradeBundle,
} from "./export-trade-store.ts";
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
const pg = new PGlite();
await pg.waitReady;
await pg.exec(
  await readFile(new URL("../../migrations/0006_export_trade_cache.sql", import.meta.url), "utf8"),
);
after(async () => {
  await pg.close();
});
const sql = {
  query: async <T>(text: string, params?: unknown[]) => (await pg.query<T>(text, params)).rows,
};

test("verified public snapshots survive a new store instance and stale labels preserve reference dates", async () => {
  let now = new Date(checked);
  const first = createExportTradeStore(sql, { now: () => now });
  assert.equal(await first.saveBundle(bundle()), true);
  const second = createExportTradeStore(sql, { now: () => now });
  const read = await second.readBundle();
  assert.equal(second.storage, "postgres");
  assert.equal(read?.stale, false);
  assert.equal(read?.value.exports.at(-1)?.period, "2026-09");
  now = new Date(checked.getTime() + 7 * 3_600_000);
  const old = await second.readBundle();
  assert.equal(old?.stale, true);
  const shown = staleTradeBundle(old!);
  assert.deepEqual(shown.exports, bundle().exports);
  assert.equal(shown.source.fetchedAt, bundle().source.fetchedAt);
  assert.equal(shown.providers[0]!.state, "stale");
  assert.equal(shown.providers[0]!.asOf, "2026-09");
  assert.match(shown.notes.at(-1)!, /저장 검증본/);
  now = new Date(checked.getTime() + 91 * 86_400_000);
  assert.equal(await second.readBundle(), null);
});

test("failed, malformed and regressing candidates cannot overwrite the last verified dataset", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  assert.equal(await store.saveBundle(bundle()), true);
  for (const invalid of [
    { ...bundle(), exports: [] },
    { ...bundle(), exports: [{ period: "2026-13", valueUsd: 10 }] },
    { ...bundle(), exports: [{ period: "2026-09", valueUsd: NaN }] },
    {
      ...bundle(),
      providers: [{ ...bundle().providers[0]!, sourceUrl: "https://data.go.kr.attacker.example/" }],
    },
    {
      ...bundle(),
      providers: [
        { ...bundle().providers[0]!, state: "stale" as const, reasonCode: "NETWORK_ERROR" },
      ],
    },
  ])
    assert.equal(await store.saveBundle(invalid), false);
  const older = bundle();
  older.exports.pop();
  older.imports.pop();
  older.providers[0]!.asOf = "2026-08";
  assert.equal(await store.saveBundle(older), false);
  const latest = await store.readBundle();
  assert.equal(latest?.value.exports.at(-1)!.valueUsd, 20);
  latest!.value.exports[0]!.valueUsd = 999;
  assert.equal((await store.readBundle())!.value.exports[0]!.valueUsd, 10);
});

test("database lease acquisition is atomic across store instances, fenced release preserves a newer owner", async () => {
  const a = createExportTradeStore(sql),
    b = createExportTradeStore(sql);
  const owners = await Promise.all([
    a.acquireRefresh("test:shared"),
    b.acquireRefresh("test:shared"),
  ]);
  assert.equal(owners.filter(Boolean).length, 1);
  const oldOwner = owners.find(Boolean)!;
  await sql.query(
    "update export_trade_refresh_state set lease_until=clock_timestamp()-interval '1 second' where scope=$1",
    ["test:shared"],
  );
  const replacement = await b.acquireRefresh("test:shared");
  assert.ok(replacement);
  await a.releaseRefresh("test:shared", oldOwner);
  assert.equal(await a.acquireRefresh("test:shared"), null);
  assert.ok(await a.retryAt("test:shared"));
  assert.equal(
    await a.retryAt("test:shared", true),
    null,
    "an active refresh is not a provider cooldown",
  );
  await b.releaseRefresh("test:shared", replacement!);
  assert.ok(await a.acquireRefresh("test:shared"));
});

test("a shared provider cooldown cannot be shortened or cleared by releasing a refresh lease", async () => {
  const a = createExportTradeStore(sql),
    b = createExportTradeStore(sql);
  const owner = await a.acquireRefresh("test:cooldown");
  assert.ok(owner);
  assert.equal(await a.setCooldown("test:cooldown", 60_000), true);
  const long = await b.retryAt("test:cooldown");
  assert.ok(long);
  await b.setCooldown("test:cooldown", 1000);
  await a.releaseRefresh("test:cooldown", owner!);
  assert.equal(await b.acquireRefresh("test:cooldown"), null);
  assert.equal(await b.retryAt("test:cooldown"), long);
  assert.equal(await b.retryAt("test:cooldown", true), long);
});

test("category snapshots require exact identity, complete valid values and trusted provider metadata", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  const value = {
    observations: [
      {
        period: "2026-09",
        categoryId: "semiconductors",
        classification: "HS" as const,
        sourceFile: "관세청 공식",
        valueUsd: 10,
      },
    ],
    providers: [{ ...bundle().providers[0]!, id: "customs.item", recordCount: 1 }],
  };
  assert.equal(await store.saveCategory("semiconductors", value), true);
  assert.equal(await store.saveCategory("ships", value), false);
  assert.equal(
    await store.saveCategory("semiconductors", {
      ...value,
      observations: [{ ...value.observations[0]!, valueUsd: Infinity }],
    }),
    false,
  );
  assert.equal((await store.readCategory("semiconductors"))?.value.observations[0]?.valueUsd, 10);
});

test("category catalog batches are bounded to exact requested identities and validate each SQL payload", async () => {
  const queries: string[] = [];
  const store = createExportTradeStore(
    {
      query: async <T>(query: string, params?: unknown[]) => {
        queries.push(query);
        return sql.query<T>(query, params);
      },
    },
    { now: () => checked },
  );
  const category = (id: string) => ({
    observations: [
      {
        period: "2026-09",
        categoryId: id,
        classification: "HS" as const,
        sourceFile: "관세청 공식",
        valueUsd: 10,
      },
    ],
    providers: [{ ...bundle().providers[0]!, id: "customs.item", recordCount: 1 }],
  });
  await store.saveCategory("computers", category("computers"));
  await store.saveCategory("auto_parts", category("auto_parts"));
  queries.length = 0;
  const values = await store.readCategories([
    "computers",
    "auto_parts",
    "computers",
    "bundle",
    "not-a-category",
  ]);
  assert.deepEqual(Object.keys(values).sort(), ["auto_parts", "computers"]);
  assert.equal(queries.length, 1);
  assert.match(queries[0]!, /cache_key=any\(\$1::text\[\]\)/);
  values.computers!.value.observations[0]!.valueUsd = 999;
  assert.equal(
    (await store.readCategories(["computers"])).computers!.value.observations[0]!.valueUsd,
    10,
  );
  await sql.query(
    "update export_trade_snapshots set payload=jsonb_set(payload,'{observations,0,categoryId}',to_jsonb($1::text)) where cache_key=$2",
    ["ships", "category:auto_parts"],
  );
  assert.deepEqual(Object.keys(await store.readCategories(["auto_parts", "computers"])), [
    "computers",
  ]);
  queries.length = 0;
  assert.deepEqual(await store.readCategories(Array.from({ length: 65 }, () => "computers")), {});
  assert.equal(queries.length, 0);
});

test("batch category reads retain verified mirrors during a database outage", async () => {
  let offline = false;
  const store = createExportTradeStore(
    {
      query: async <T>(query: string, params?: unknown[]) => {
        if (offline) throw new Error("private database detail");
        return sql.query<T>(query, params);
      },
    },
    { now: () => checked },
  );
  await store.saveCategory("wireless_devices", {
    observations: [
      {
        period: "2026-09",
        categoryId: "wireless_devices",
        classification: "HS",
        sourceFile: "관세청 공식",
        valueUsd: 15,
      },
    ],
    providers: [{ ...bundle().providers[0]!, id: "customs.item", recordCount: 1 }],
  });
  const first = await store.readCategories(["wireless_devices"]);
  assert.equal(first.wireless_devices!.value.observations[0]!.valueUsd, 15);
  offline = true;
  const retained = await store.readCategories(["wireless_devices"]);
  assert.equal(store.storage, "memory");
  assert.equal(retained.wireless_devices!.value.observations[0]!.valueUsd, 15);
});

test("batch refresh-state reads use one bounded query and distinguish cooldown from an active lease", async () => {
  let queries = 0;
  const store = createExportTradeStore({
    query: async <T>(query: string, params?: unknown[]) => {
      queries++;
      return sql.query<T>(query, params);
    },
  });
  const owner = await store.acquireRefresh("test:catalog-batch-lease");
  assert.ok(owner);
  await store.setCooldown("test:catalog-batch-cooldown", 60_000);
  queries = 0;
  const both = await store.retryAts([
    "test:catalog-batch-lease",
    "test:catalog-batch-cooldown",
    "bad/unsafe",
  ]);
  assert.equal(queries, 1);
  assert.deepEqual(Object.keys(both).sort(), [
    "test:catalog-batch-cooldown",
    "test:catalog-batch-lease",
  ]);
  const cooldown = await store.retryAts(
    ["test:catalog-batch-lease", "test:catalog-batch-cooldown"],
    true,
  );
  assert.deepEqual(Object.keys(cooldown), ["test:catalog-batch-cooldown"]);
  assert.deepEqual(
    await store.retryAts(Array.from({ length: 65 }, () => "test:catalog-batch-lease")),
    {},
  );
  await store.releaseRefresh("test:catalog-batch-lease", owner!);
});

test("absent or unavailable database has an explicit bounded memory fallback without fake durability", async () => {
  const memory = createMemoryExportTradeStore({ now: () => checked });
  assert.equal(memory.storage, "memory");
  assert.equal(await memory.saveBundle(bundle()), true);
  const offline = createExportTradeStore({
    query: async () => {
      throw new Error("private DB detail");
    },
  });
  assert.equal(await offline.readBundle(), null);
  assert.equal(offline.storage, "memory");
  assert.ok(
    await offline.acquireRefresh("test:offline"),
    "database failure does not masquerade as a permanently busy worker",
  );
});

test("released and expired memory scopes do not permanently exhaust refresh admission", async () => {
  let time = new Date(checked);
  const store = createMemoryExportTradeStore({ now: () => time });
  for (let i = 0; i < 300; i++) {
    const owner = await store.acquireRefresh(`test:released:${i}`);
    assert.ok(owner);
    await store.releaseRefresh(`test:released:${i}`, owner!);
  }
  for (let i = 0; i < 256; i++) assert.ok(await store.acquireRefresh(`test:expired:${i}`, 1000));
  time = new Date(time.getTime() + 1001);
  assert.ok(await store.acquireRefresh("test:after-expiry"));
});

test("new snapshots require selected totals identity and exact category evidence", async () => {
  const store = createMemoryExportTradeStore({ now: () => checked });
  const missing = bundle();
  delete missing.source.totalsProviderId;
  assert.equal(await store.saveBundle(missing), false);
  assert.equal(
    await store.saveCategory("semiconductors", {
      observations: [
        {
          period: "2026-09",
          categoryId: "semiconductors",
          classification: "HS",
          sourceFile: "공식",
          valueUsd: 10,
        },
      ],
      providers: bundle().providers,
    }),
    false,
  );
});
