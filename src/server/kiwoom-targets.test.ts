import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../lib/db.ts";
import { createKiwoomStore, type FlowIdentity, type KiwoomJob } from "./kiwoom-store.ts";
import { KIWOOM_TARGET_LIMIT, KIWOOM_TARGET_SUBSCRIPTION_LIMIT } from "./kiwoom-targets.ts";

// Isolated in-memory SQL contract tests. No broker/network/operational DB access.
const pg = new PGlite();
await pg.waitReady;
for (const name of ["0002_kiwoom_flow.sql", "0003_kiwoom_collection_targets.sql"])
  await pg.exec(await readFile(new URL(`../../migrations/${name}`, import.meta.url), "utf8"));
after(() => pg.close());
const sql = { query: async <T>(text: string, params?: unknown[]) => (await pg.query<T>(text, params)).rows } as Sql;
const store = createKiwoomStore(sql);
let serial = 0;
const identity = (): FlowIdentity => ({
  scopeId: `fixture-target-${++serial}`, environment: "real",
  request: { code: "018260", market: "KR", instrument: "stock", exchange: "KOSPI", currency: "KRW",
    quantityUnit: "주", interval: "day", flowScope: "KRX", from: "2026-09-01", to: "2026-09-03" },
});
const fill = async (scopeId: string, count: number, state: "queued" | "ready" | "failed") => pg.query(
  `insert into kiwoom_collection_targets(scope_id,environment,code,instrument,market_scope,requested_from,requested_to,state)
   select $1,'real',lpad(n::text,6,'0'),'stock','KRX','2026-09-01','2026-09-03',$3
   from generate_series(1,$2) n`, [scopeId, count, state]);
const target = async (id: FlowIdentity) => (await pg.query<{
  state: string; attemptCount: number; delay: number; requestedFrom: string; requestedTo: string; nextDue: string;
}>(`select state,attempt_count as "attemptCount",
    extract(epoch from next_due_at-clock_timestamp())::double precision as delay,
    to_char(requested_from,'YYYY-MM-DD') as "requestedFrom",to_char(requested_to,'YYYY-MM-DD') as "requestedTo",
    next_due_at::text as "nextDue" from kiwoom_collection_targets
    where scope_id=$1 and environment=$2 and code=$3 and instrument=$4 and market_scope=$5`,
  [id.scopeId, id.environment, id.request.code, id.request.instrument, id.request.flowScope])).rows[0];

test("unfinished work has a bounded active cap and a separate reason from absent provider history", async () => {
  const id = identity();
  await fill(id.scopeId, KIWOOM_TARGET_LIMIT, "queued");
  assert.equal(await store.targets.enqueue(id), "TARGET_LIMIT_REACHED");
  assert.equal(await store.targets.state(id), null);
  assert.equal(await store.targets.enqueue({ ...id, request: { ...id.request, code: "000001" } }), "COLLECTION_QUEUED",
    "an existing slot stays usable without creating new work");
});

test("100 completed symbols do not permanently prevent another listed stock from being collected", async () => {
  for (const state of ["ready", "failed"] as const) {
    const id = identity();
    await fill(id.scopeId, KIWOOM_TARGET_LIMIT, state);
    assert.equal(await store.targets.enqueue(id), "COLLECTION_QUEUED");
    assert.equal(await store.targets.state(id), "queued");
  }
});

test("the absolute subscription cap still includes ready and failed records", async () => {
  const id = identity();
  await fill(id.scopeId, KIWOOM_TARGET_SUBSCRIPTION_LIMIT, "ready");
  assert.equal(await store.targets.enqueue(id), "TARGET_LIMIT_REACHED");
  assert.equal(await store.targets.state(id), null);
  assert.equal(await store.targets.enqueue({ ...id, request: { ...id.request, code: "000001" } }), "COLLECTION_QUEUED");
});

test("concurrent requests register one target and cannot shorten its retry/refresh spacing", async () => {
  const id = identity();
  await Promise.all(Array.from({ length: 5 }, () => store.targets.enqueue(id)));
  const count = await pg.query<{ count: number }>("select count(*)::int as count from kiwoom_collection_targets where scope_id=$1", [id.scopeId]);
  assert.equal(count.rows[0].count, 1);
  await store.targets.start(id);
  await store.targets.finish(id, true, true);
  const before = await target(id);
  await store.targets.enqueue({ ...id, request: { ...id.request, from: "2026-08-01", to: "2026-09-04" } });
  const after = await target(id);
  assert.equal(after.nextDue, before.nextDue);
  assert.equal(after.state, "partial", "a widened completed subscription is no longer ready");
  assert.equal(after.requestedFrom, "2026-08-01");
  assert.equal(after.requestedTo, "2026-09-04");
  assert.equal((await store.targets.pending(id.scopeId, id.environment)).length, 0);
});

test("reactivating a completed range requires an active slot and leaves the old range intact when capped", async () => {
  const id = identity();
  await store.targets.enqueue(id);
  await store.targets.start(id);
  await store.targets.finish(id, true, true);
  await fill(id.scopeId, KIWOOM_TARGET_LIMIT, "queued");
  const before = await target(id);
  const expanded = { ...id, request: { ...id.request, from: "2026-08-01" } };
  assert.equal(await store.targets.enqueue(expanded), "TARGET_LIMIT_REACHED");
  const rejected = await target(id);
  assert.equal(rejected.state, before.state);
  assert.equal(rejected.requestedFrom, before.requestedFrom);
  assert.equal(rejected.requestedTo, before.requestedTo);
  assert.equal(rejected.nextDue, before.nextDue);
  await pg.query("update kiwoom_collection_targets set state='ready' where scope_id=$1 and code='000001'", [id.scopeId]);
  assert.equal(await store.targets.enqueue(expanded), "COLLECTION_QUEUED");
  assert.equal((await target(id)).state, "partial");
  assert.equal((await target(id)).requestedFrom, "2026-08-01");
  assert.equal((await target(id)).nextDue, before.nextDue);
});

test("a collecting target can widen within its existing active slot while the new-work queue is full", async () => {
  const id = identity();
  await store.targets.enqueue(id);
  await store.targets.start(id);
  await fill(id.scopeId, KIWOOM_TARGET_LIMIT - 1, "queued");
  const before = await target(id);
  assert.equal(await store.targets.enqueue({ ...id, request: { ...id.request, from: "2026-08-01" } }), "COLLECTING");
  const after = await target(id);
  assert.equal(after.state, "collecting");
  assert.equal(after.requestedFrom, "2026-08-01");
  assert.equal(after.nextDue, before.nextDue);
});

test("range expansion during collection stays partial and does not reset attempts or apply a successful refresh delay", async () => {
  const id = identity();
  await store.targets.enqueue(id);
  await store.targets.start(id);
  await store.targets.enqueue({ ...id, request: { ...id.request, from: "2026-08-01" } });
  await store.targets.finish(id, true, true);
  const row = await target(id);
  assert.equal(row.state, "partial");
  assert.equal(row.attemptCount, 1);
  assert.ok(row.delay > 880 && row.delay <= 900, `partial retry spacing: ${row.delay}`);
  await store.targets.start({ ...id, request: { ...id.request, from: "2026-08-01" } });
  await store.targets.finish({ ...id, request: { ...id.request, from: "2026-08-01" } }, true, true);
  const complete = await target(id);
  assert.equal(complete.state, "ready");
  assert.equal(complete.attemptCount, 0);
  assert.ok(complete.delay > 3580 && complete.delay <= 3600);
});

test("repeated collection failures keep the bounded day backoff; anonymous reads cannot accelerate it", async () => {
  const id = identity();
  await store.targets.enqueue(id);
  for (let attempt = 0; attempt < 8; attempt++) {
    await store.targets.start(id);
    await store.targets.finish(id, false, false);
  }
  const before = await target(id);
  assert.equal(before.state, "failed");
  assert.equal(before.attemptCount, 8);
  assert.ok(before.delay > 86380 && before.delay <= 86400);
  await store.targets.enqueue(id);
  assert.equal((await target(id)).nextDue, before.nextDue);
});

test("due subscriptions advance to the current Korean day without advancing queued timestamps or unrelated rows", async () => {
  const id = identity();
  await store.targets.enqueue(id);
  const other = { ...identity(), environment: "mock" as const };
  await store.targets.enqueue(other);
  const before = await target(id);
  // UTC date is September 30 while the Korean trading date is October 1.
  const pending = await store.targets.pending(id.scopeId, "real", 10, Date.parse("2026-09-30T15:01:00Z"));
  assert.equal(pending.length, 1);
  assert.equal(pending[0].requestedTo, "2026-10-01");
  assert.equal(pending[0].requestedFrom, id.request.from);
  assert.equal((await target(id)).nextDue, before.nextDue);
  assert.equal((await target(other)).requestedTo, "2026-09-03");
  const refreshed = { ...id, request: { ...id.request, from: pending[0].requestedFrom, to: pending[0].requestedTo } };
  await store.targets.start(refreshed);
  await store.targets.finish(refreshed, true, true);
  assert.equal((await target(id)).state, "ready");
  assert.equal((await store.targets.pending(id.scopeId, "real", 10, Date.parse("2026-10-02T01:00:00Z"))).length, 0,
    "a later date cannot bypass next_due_at");
  assert.equal((await target(id)).requestedTo, "2026-10-01");
});

test("refresh advances only the bounded due batch and preserves the five-year history ceiling", async () => {
  const id = identity();
  await fill(id.scopeId, 3, "ready");
  await pg.query("update kiwoom_collection_targets set requested_from='2021-09-01',requested_to='2026-09-03' where scope_id=$1", [id.scopeId]);
  const pending = await store.targets.pending(id.scopeId, "real", 2, Date.parse("2026-10-10T00:00:00Z"));
  assert.equal(pending.length, 2);
  for (const row of pending) {
    assert.equal(row.state, "queued", "a new date cannot retain the previous date's ready state");
    assert.equal(row.requestedTo, "2026-10-10");
    assert.equal((Date.parse(row.requestedTo) - Date.parse(row.requestedFrom)) / 86_400_000, 1830);
  }
  const old = await pg.query<{ count: number }>("select count(*)::int as count from kiwoom_collection_targets where scope_id=$1 and requested_to='2026-09-03'", [id.scopeId]);
  assert.equal(old.rows[0].count, 1, "work beyond the batch limit does not advance");
});

const job = (overrides: Partial<KiwoomJob> = {}): KiwoomJob => ({
  status: "ready", stopReason: "requested-start-reached", pages: 1, rows: 1, invalidRows: 0,
  oldestDate: "2026-09-01", newestDate: "2026-09-03", nextKey: null, complete: true,
  updatedAt: new Date().toISOString(), lastSuccessAt: new Date().toISOString(), errorCode: null, ...overrides,
});

test("a completed historical backfill remains discoverable after a newer narrow refresh job", async () => {
  const id = identity();
  const historical = { ...id, request: { ...id.request, from: "2026-08-01" } };
  await store.saveJob(historical, "credit", job());
  await store.saveJob({ ...id, request: { ...id.request, from: "2026-09-02" } }, "credit", job());
  assert.equal((await store.job(id, "credit"))?.requestedFrom, "2026-09-02");
  const proof = await store.completedCoverage!(id, "credit");
  assert.equal(proof?.requestedFrom, "2026-08-01");
  assert.equal(proof?.requestedTo, "2026-09-03");
  assert.equal((await store.completedCoverage!({ ...id, request: { ...id.request, to: "2026-09-10" } }, "credit"))?.requestedFrom, "2026-08-01",
    "a later end date preserves proof of the prior historical backfill, not proof of the new tail");
  assert.equal(await store.completedCoverage!({ ...id, request: { ...id.request, from: "2026-07-01" } }, "credit"), null);
  assert.equal(await store.completedCoverage!({ ...id, request: { ...id.request, from: "2026-09-10", to: "2026-09-12" } }, "credit"), null);
  assert.equal(await store.completedCoverage!(id, "foreign"), null);
  assert.equal(await store.completedCoverage!({ ...id, environment: "mock" }, "credit"), null);
  assert.equal(await store.completedCoverage!({ ...id, request: { ...id.request, flowScope: "NXT" } }, "credit"), null);
  assert.equal(await store.completedCoverage!({ ...id, request: { ...id.request, instrument: "etf" } }, "credit"), null);
});

test("an incomplete/error job or only a narrow refresh never proves a wider historical backfill", async () => {
  const id = identity();
  await store.saveJob(id, "credit", job({ complete: false, status: "collecting", stopReason: "page-budget" }));
  await store.saveJob({ ...id, request: { ...id.request, from: "2026-09-02" } }, "credit", job());
  assert.equal(await store.completedCoverage!(id, "credit"), null);
  await store.saveJob(id, "credit", job({ status: "parsing" }));
  assert.equal(await store.completedCoverage!(id, "credit"), null);
  await store.saveJob(id, "credit", job({ status: "history", stopReason: "provider-end" }));
  assert.equal((await store.completedCoverage!(id, "credit"))?.stopReason, "provider-end",
    "exhausted provider history is a completed attempt; actual missing observations remain separately partial");
});

test("a newer complete job with invalid rows or missing sessions cannot hide an older valid historical certificate", async () => {
  const id = identity();
  await store.saveJob({ ...id, request: { ...id.request, from: "2026-08-01" } }, "credit", job());
  await store.saveJob({ ...id, request: { ...id.request, from: "2026-07-01" } }, "credit", job({ invalidRows: 1 }));
  await store.saveJob({ ...id, request: { ...id.request, from: "2026-06-01" } }, "credit", job({ missingDates: ["2026-09-02"] }));
  assert.equal((await store.completedCoverage!(id, "credit"))?.requestedFrom, "2026-08-01");
  const onlyInvalid = identity();
  await store.saveJob(onlyInvalid, "credit", job({ invalidRows: 1 }));
  assert.equal(await store.completedCoverage!(onlyInvalid, "credit"), null);
  await store.saveJob(onlyInvalid, "credit", job({ missingDates: ["2026-09-02"] }));
  assert.equal(await store.completedCoverage!(onlyInvalid, "credit"), null);
  await store.saveJob(onlyInvalid, "credit", job({ missingDates: [] }));
  assert.equal((await store.completedCoverage!(onlyInvalid, "credit"))?.complete, true);
});
