import assert from "node:assert/strict";
import { test, after } from "node:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../lib/db.ts";
import { createKiwoomStore } from "./kiwoom-store.ts";
import { createKiwoomCollectorRuntime, isKiwoomCollectorErrorCode, kiwoomCollectorDiagnostics, runKiwoomTargetCycle,
  validateKiwoomCollectorInstance } from "./kiwoom-collector-runtime.ts";

const core = (await Promise.all(["0002_kiwoom_flow.sql", "0003_kiwoom_collection_targets.sql"].map(name =>
  readFile(new URL(`../../migrations/${name}`, import.meta.url), "utf8")))).join("\n");
const migration = await readFile(new URL("../../migrations/0004_kiwoom_collector_runtime.sql", import.meta.url), "utf8");
const sqlFor = (pg: PGlite) => ({ query: async <T>(text: string, params?: unknown[]) =>
  (await pg.query<T>(text, params)).rows }) as Sql;
const pg = new PGlite();
await pg.exec(core + "\n" + migration);
after(() => pg.close());
const runtime = createKiwoomCollectorRuntime(sqlFor(pg));
const identity = { scopeId: "fixture-collector-runtime", environment: "real" as const };
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const heartbeat = "2026-10-05T07:00:00.000Z";
const row = { startedAt: "2026-10-05T06:00:00.000Z", lastHeartbeatAt: heartbeat,
  lastSuccessAt: null, lastErrorCode: null, lastQueueCount: 0 };

test("collector state distinguishes exact 10/30 minute boundaries; missing/invalid/future times are unknown", () => {
  const start = Date.parse(heartbeat);
  for (const [age, state] of [[0, "RUNNING"], [600_000, "RUNNING"], [600_001, "STALE"],
    [1_800_000, "STALE"], [1_800_001, "OFFLINE"]] as const)
    assert.equal(kiwoomCollectorDiagnostics(row, start + age).state, state);
  assert.equal(kiwoomCollectorDiagnostics(null, start).state, "UNKNOWN");
  assert.equal(kiwoomCollectorDiagnostics(row, start, false).state, "UNKNOWN");
  for (const broken of [
    { ...row, lastHeartbeatAt: "invalid" }, { ...row, lastHeartbeatAt: "2026-02-30T07:00:00Z" },
    { ...row, lastHeartbeatAt: "2026-10-05 07:00:00" },
    { ...row, lastSuccessAt: "Bearer fixture-raw-secret" },
    { ...row, startedAt: "2026-10-06T06:00:00.000Z" },
  ]) assert.equal(kiwoomCollectorDiagnostics(broken, start).state, "UNKNOWN");
  assert.equal(kiwoomCollectorDiagnostics(row, start - 1).state, "UNKNOWN");
});

test("telemetry rejects arbitrary error text and identifiers; safe view cannot expose unexpected fields", () => {
  assert.equal(isKiwoomCollectorErrorCode("STARTUP_DOCTOR_FAILED"), true);
  assert.equal(isKiwoomCollectorErrorCode("TOKEN_FAILED"), true);
  assert.equal(isKiwoomCollectorErrorCode("Bearer fixture-raw-secret"), false);
  assert.throws(() => validateKiwoomCollectorInstance("fixture-app-key"));
  assert.equal(validateKiwoomCollectorInstance(first.toUpperCase()), first);
  const untrustedRow = { ...row, lastErrorCode: "fixture-raw-secret", scopeId: "fixture-private-scope", instanceId: first };
  const payload = kiwoomCollectorDiagnostics(untrustedRow, Date.parse(heartbeat));
  const json = JSON.stringify(payload);
  assert.equal(payload.lastErrorCode, null);
  for (const privateValue of ["fixture-raw-secret", "fixture-private-scope", first, "instanceId", "scopeId"])
    assert.equal(json.includes(privateValue), false);
});

test("optional telemetry migration never invalidates ready core tables and missing telemetry reads UNKNOWN", async () => {
  const oldDb = new PGlite();
  try {
    await oldDb.exec(core);
    const oldStore = createKiwoomStore(sqlFor(oldDb));
    assert.equal((await oldStore.schema()).ready, true);
    assert.equal((await oldStore.collectorRuntime!.read(identity)).state, "UNKNOWN");
    assert.equal(await oldStore.collectorRuntime!.schema(), false);
    await assert.rejects(oldStore.collectorRuntime!.start(identity, first), /migration required/);
    assert.equal((await oldStore.schema()).ready, true);
  } finally { await oldDb.close(); }
});

test("startup/progress/success/error persist safely; repeated start of same instance preserves start and success", async () => {
  const id = { ...identity, scopeId: "fixture-events" };
  assert.equal((await runtime.read(id)).state, "UNKNOWN");
  await runtime.start(id, first);
  const started = await runtime.read(id);
  assert.equal(started.state, "RUNNING");
  assert.equal(started.pendingTargets, 0);
  assert.equal(started.lastSuccessAt, null);
  assert.equal(await runtime.update(id, first, { event: "success" }), true);
  const success = await runtime.read(id);
  assert.ok(success.lastSuccessAt);
  await runtime.start(id, first);
  assert.equal((await runtime.read(id)).startedAt, started.startedAt);
  assert.equal((await runtime.read(id)).lastSuccessAt, success.lastSuccessAt);
  await runtime.update(id, first, { event: "error", errorCode: "QUEUE_CYCLE_FAILED" });
  assert.equal((await runtime.read(id)).lastErrorCode, "QUEUE_CYCLE_FAILED");
  assert.equal((await runtime.read(id)).lastSuccessAt, success.lastSuccessAt);
  await runtime.update(id, first, { event: "heartbeat" });
  assert.equal((await runtime.read(id)).lastErrorCode, "QUEUE_CYCLE_FAILED");
  await runtime.update(id, first, { event: "success" });
  assert.equal((await runtime.read(id)).lastErrorCode, null);
  await assert.rejects(runtime.update(id, first, { event: "error", errorCode: "Bearer fixture-raw-secret" }), /fixed safe enum/);
});

test("new worker replaces only active instance; late old worker progress/success/error cannot overwrite it", async () => {
  const id = { ...identity, scopeId: "fixture-worker-replacement" };
  await runtime.start(id, first);
  await runtime.start(id, second);
  const before = await runtime.read(id);
  for (const event of ["heartbeat", "success", "error"] as const)
    assert.equal(await runtime.update(id, first, { event, ...(event === "error" ? { errorCode: "QUEUE_CYCLE_FAILED" } : {}) }), false);
  assert.deepEqual(await runtime.read(id), before);
  const rows = (await pg.query<{ instance_id: string }>("select instance_id from kiwoom_collector_runtime where scope_id=$1", [id.scopeId])).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].instance_id, second);
  assert.equal(await runtime.update(id, second, { event: "success" }), true);
});

test("scope/environment isolation and due-only bounded queue count", async () => {
  const id = { ...identity, scopeId: "fixture-bounded-queue" };
  await pg.query(`insert into kiwoom_collection_targets(scope_id,environment,code,instrument,market_scope,requested_from,requested_to,next_due_at)
    select $1,'real',lpad(n::text,6,'0'),'stock','KRX','2026-10-01','2026-10-02',clock_timestamp()-interval '1 minute'
    from generate_series(1,105) n`, [id.scopeId]);
  await pg.query(`insert into kiwoom_collection_targets(scope_id,environment,code,instrument,market_scope,requested_from,requested_to,next_due_at)
    values($1,'mock','005930','stock','KRX','2026-10-01','2026-10-02',clock_timestamp()-interval '1 minute'),
    ($1,'mock','000001','stock','KRX','2026-10-01','2026-10-02',clock_timestamp()+interval '1 hour')`, [id.scopeId]);
  await runtime.start(id, first);
  assert.equal((await runtime.read(id)).pendingTargets, 100);
  assert.equal((await runtime.read(id)).lastQueueCount, 100);
  assert.equal((await runtime.read({ ...id, environment: "mock" })).state, "UNKNOWN");
  assert.equal((await runtime.read({ ...id, environment: "mock" })).pendingTargets, 1);
  assert.equal((await runtime.read({ ...id, scopeId: "fixture-unrelated" })).state, "UNKNOWN");
  await runtime.start({ ...id, environment: "mock" }, second);
  assert.equal((await runtime.read({ ...id, environment: "mock" })).pendingTargets, 1);
  assert.equal((await runtime.read(id)).pendingTargets, 100);
});

test("persisted heartbeat survives an isolated on-disk PGlite close/reopen; this is not production DB verification", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kiwoom-heartbeat-test-"));
  const id = { ...identity, scopeId: "fixture-restart" };
  let database = new PGlite(directory);
  try {
    await database.exec(core + "\n" + migration);
    const firstRuntime = createKiwoomCollectorRuntime(sqlFor(database));
    await firstRuntime.start(id, first);
    await firstRuntime.update(id, first, { event: "success" });
    const before = await firstRuntime.read(id);
    await database.close();
    database = new PGlite(directory);
    const afterRestart = await createKiwoomCollectorRuntime(sqlFor(database)).read(id);
    assert.deepEqual(afterRestart, before);
  } finally { await database.close(); await rm(directory, { recursive: true, force: true }); }
});

test("telemetry query failure returns safe UNKNOWN without raw errors", async () => {
  const failedQuery = async () => { throw new Error("postgresql://fixture-private-password@private-host/database"); };
  const broken = createKiwoomCollectorRuntime(Object.assign(failedQuery, { query: failedQuery }));
  const result = await broken.read(identity);
  assert.equal(result.state, "UNKNOWN");
  assert.equal(JSON.stringify(result).includes("password"), false);
});

test("additive migration is idempotent and preserves market observations plus existing runtime timestamps", async () => {
  const id = { ...identity, scopeId: "fixture-additive-migration" };
  await pg.query(`insert into kiwoom_flow_observations(scope_id,provider,environment,code,instrument,market_scope,metric,unit,date,value,observation,fetched_at,parsing_status)
    values($1,'kiwoom','real','005930','stock','KRX','investmentTrust','주','2026-10-02',-10,'{}',clock_timestamp(),'valid')`, [id.scopeId]);
  await runtime.start(id, first);
  await runtime.update(id, first, { event: "success" });
  const before = await runtime.read(id);
  await pg.exec(migration);
  assert.deepEqual(await runtime.read(id), before);
  assert.equal((await pg.query<{ value: number }>("select value from kiwoom_flow_observations where scope_id=$1", [id.scopeId])).rows[0].value, -10);
  assert.equal((await createKiwoomStore(sqlFor(pg)).schema()).ready, true);
});

test("loss of the inner target lease aborts work while outer credential lease is alive and prevents target finish", async () => {
  const outer = new AbortController(), inner = new AbortController();
  const signal = AbortSignal.any([outer.signal, inner.signal]);
  const request = { code: "005930", market: "KR" as const, instrument: "stock" as const, exchange: "KRX",
    currency: "KRW" as const, quantityUnit: "주" as const, interval: "day" as const, from: "2026-10-01", to: "2026-10-02" };
  let starts = 0, finishes = 0;
  await assert.rejects(runKiwoomTargetCycle({ ...identity, request }, {
    start: async () => { starts++; }, finish: async () => { finishes++; },
  }, signal, async workSignal => {
    assert.equal(workSignal, signal);
    inner.abort();
    // Simulate a provider completing after the scope lease was lost.
    return { complete: true, hasValues: true };
  }), { name: "AbortError" });
  assert.equal(outer.signal.aborted, false);
  assert.equal(signal.aborted, true);
  assert.equal(starts, 1);
  assert.equal(finishes, 0);
});

test("target cycle checks cancellation before start and records normal successful/failed work only with a live lease", async () => {
  const request = { code: "005930", market: "KR" as const, instrument: "stock" as const, exchange: "KRX",
    currency: "KRW" as const, quantityUnit: "주" as const, interval: "day" as const, from: "2026-10-01", to: "2026-10-02" };
  const id = { ...identity, request };
  const finished: [boolean, boolean][] = [];
  let starts = 0, runs = 0;
  const targets = { start: async () => { starts++; },
    finish: async (_identity: typeof id, complete: boolean, hasValues: boolean) => { finished.push([complete, hasValues]); } };
  await assert.rejects(runKiwoomTargetCycle(id, targets, AbortSignal.abort(), async () => {
    runs++; return { complete: true, hasValues: true };
  }), { name: "AbortError" });
  assert.equal(starts, 0); assert.equal(runs, 0);
  const live = new AbortController().signal;
  assert.deepEqual(await runKiwoomTargetCycle(id, targets, live, async () => ({ complete: true, hasValues: true })),
    { complete: true, hasValues: true });
  await assert.rejects(runKiwoomTargetCycle(id, targets, live, async () => { throw new Error("fixture-provider-failure"); }),
    /fixture-provider-failure/);
  assert.deepEqual(finished, [[true, true], [false, false]]);
});
