import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { selectKiwoomCollection, completeKiwoomIncrementalJob } from "./kiwoom-collection.mjs";

const configUrl = pathToFileURL(resolve("src/server/kiwoom-config.ts")).href;
const instance = "11111111-1111-4111-8111-111111111111";
function runFixture(scenario, options = ["sync", "--targets", "--live", "--resume", "--incremental", "--collector-instance-id", instance]) {
  const directory = mkdtempSync(join(tmpdir(), "kiwoom-collection-test-"));
  const loader = join(directory, "fixture.mjs");
  const sources = {
    "kiwoom-cross-check.ts": `export async function crossCheckKiwoom() { throw new Error('CROSS_CHECK_MUST_NOT_BE_USED'); }`,
    "kiwoom-runtime.ts": `export async function diagnoseKiwoomRuntime() {
      return { databaseConnected:true, schemaReady:true, appKeyConfigured:true, appSecretConfigured:true, egressStatus:'IP_MATCH' };
    }`,
    "kiwoom-db.ts": `export async function openKiwoomDatabase() {
      const state=globalThis.kiwoomFixture;
      const store={
        schema:async()=>({ready:true}),
        read:async()=>state.scenario.rows??[{date:'2026-10-01',value:3,provider:'kiwoom',environment:'real',derived:false}],
        job:async(id,metric,exact)=>exact?(state.scenario.exact??null):(state.scenario.latest??state.scenario.exact??null),
        completedCoverage:async()=>state.scenario.coverage??null,
        saveJob:async(id,metric,job)=>{state.trace.saved.push({metric,from:id.request.from,to:id.request.to,complete:job.complete,status:job.status});},
        exclusive:async(key,run,signal)=>run(signal??new AbortController().signal),
        targets:{
          enqueue:async(id)=>{state.trace.enqueued.push(id.request.code);return state.scenario.targetLimit?'TARGET_LIMIT_REACHED':'COLLECTION_QUEUED';},
          pending:async()=>{state.trace.pending++;return state.targets;},
          start:async(id)=>{state.trace.started.push(id.request.code);},
          finish:async(id,complete,values)=>{state.trace.finished.push({code:id.request.code,complete,values});},
        },
        collectorRuntime:{
          schema:async()=>!state.scenario.telemetryMissing,
          start:async()=>{state.trace.registered++;},
          update:async(identity,instance,update)=>{state.trace.telemetry.push(update);return true;},
        },
      };
      return {store,close:async()=>{state.trace.closed++;}};
    }`,
    "kiwoom-client.ts": `import {KiwoomError} from ${JSON.stringify(configUrl)};
      export const KIWOOM_APIS={credit:{id:'ka10013',array:'crd_trde_trend'},foreign:{id:'ka10008',array:'stk_frgnr'},investmentTrust:{id:'ka10059',array:'stk_invsr_orgn'}};
      export const KIWOOM_CROSS_CHECK_API={id:'ka10015'};
      export const kiwoomCredentialKey=()=> 'fixture-key';
      export function createKiwoomClient(){return {authenticate:async()=>{
        const state=globalThis.kiwoomFixture;state.trace.authenticated++;
        if(state.scenario.authFailure) throw new KiwoomError('authentication','Fixture authentication failed');
      },page:async(api)=>{
        const state=globalThis.kiwoomFixture;state.trace.pages.push(api);
        if(state.scenario.pageStatus) throw new KiwoomError(state.scenario.pageStatus,'Fixture first-page failure');
        return {body:{crd_trde_trend:[{}],stk_frgnr:[{}],stk_invsr_orgn:[{}]}};
      }}};`,
    "kiwoom-flow.ts": `export const kiwoomConditions=()=>({});
      export const parseKiwoomRows=()=>({observations:globalThis.kiwoomFixture.scenario.emptyDiagnostic?[]:[{date:'2026-10-01',value:3}]});
      export async function collectKiwoomMetric(store,client,id,metric) {
        const state=globalThis.kiwoomFixture;state.trace.metrics.push({code:id.request.code,metric,from:id.request.from,to:id.request.to});
        const status=id.request.code===(state.scenario.problemCode??'018260')?(state.scenario.status??'ready'):'ready';
        return {status,complete:status==='ready',pages:1,invalidRows:0,errorCode:status==='access'?1517:null};
      }`,
  };
  writeFileSync(loader, `import {registerHooks} from 'node:module';
    const sources=${JSON.stringify(sources)};
    globalThis.kiwoomFixture={scenario:${JSON.stringify(scenario)},
      trace:{registered:0,authenticated:0,pending:0,enqueued:[],started:[],finished:[],metrics:[],pages:[],saved:[],cycles:[],telemetry:[],closed:0},
      targets:['018260','005930'].map(code=>({code,instrument:'stock',marketScope:'KRX',requestedFrom:'2026-09-01',requestedTo:'2026-10-01'}))};
    globalThis.fetch=()=>{throw new Error('NETWORK_MUST_NOT_BE_USED');};
    registerHooks({
      resolve(specifier,context,nextResolve){
        const name=specifier.split('/').at(-1);
        if(Object.hasOwn(sources,name)) return {url:'kiwoom-fixture:'+name,shortCircuit:true};
        return nextResolve(specifier,context);
      },
      load(url,context,nextLoad){
        if(url.startsWith('kiwoom-fixture:')) return {format:'module',source:sources[url.slice('kiwoom-fixture:'.length)],shortCircuit:true};
        return nextLoad(url,context);
      }
    });
    process.on('exit',()=>{process.stdout.write('MOCKTRACE:'+JSON.stringify(globalThis.kiwoomFixture.trace)+'\\n');});
  `);
  try {
    let entry = "scripts/kiwoom-cli.mjs";
    let entryOptions = options;
    if (scenario.sequence) {
      entry = join(directory, "sequence.mjs");
      entryOptions = [];
      const cli = resolve("scripts/kiwoom-cli.mjs");
      writeFileSync(entry, `const steps=${JSON.stringify(scenario.sequence)};
        for(let index=0;index<steps.length;index++) {
          process.argv=[process.execPath,${JSON.stringify(cli)},...steps[index]];
          process.exitCode=0;
          await import(${JSON.stringify(pathToFileURL(cli).href)}+'?fixture-cycle='+index);
          globalThis.kiwoomFixture.trace.cycles.push(process.exitCode??0);
        }
        const cycles=globalThis.kiwoomFixture.trace.cycles;
        process.exitCode=cycles.includes(1)?1:cycles.includes(2)?2:0;
      `);
    }
    if (scenario.calendar) {
      const calendar = join(directory, "calendar.json");
      writeFileSync(calendar, JSON.stringify(scenario.calendar));
      entryOptions = [...entryOptions, "--calendar", calendar];
    }
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (key.startsWith("KIWOOM_") || key === "DATABASE_URL") delete env[key];
    const result = spawnSync(process.execPath, ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--import", loader,
      entry, ...entryOptions], {
      encoding: "utf8", timeout: 10000,
      env: { ...env, KIWOOM_APP_KEY: "fixture-collection-key", KIWOOM_APP_SECRET: "fixture-collection-secret",
        KIWOOM_FLOW_ENABLED: "true", KIWOOM_FLOW_MODE: "direct", KIWOOM_ENV: "real", KIWOOM_EXPECTED_EGRESS_IP: "192.0.2.1" },
    });
    for (const privateValue of ["fixture-collection-key", "fixture-collection-secret", instance])
      assert.equal((result.stdout + result.stderr).includes(privateValue), false);
    assert.doesNotMatch(result.stdout + result.stderr, /NETWORK_MUST_NOT_BE_USED/);
    const line = result.stdout.split(/\r?\n/).find(line => line.startsWith("MOCKTRACE:"));
    assert.ok(line, result.stderr);
    return { ...result, trace: JSON.parse(line.slice("MOCKTRACE:".length)) };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test("bounded partial CLI target collection keeps other queued stocks moving without claiming cycle success", () => {
  const result = runFixture({ status: "collecting" });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.trace.authenticated, 1);
  assert.equal(result.trace.metrics.length, 6);
  assert.deepEqual(result.trace.started, ["018260", "005930"]);
  assert.deepEqual(result.trace.finished, [
    { code: "018260", complete: false, values: true },
    { code: "005930", complete: true, values: true },
  ]);
  assert.equal(result.trace.telemetry.some(update => update.event === "success" || update.event === "error"), false);
  assert.equal(result.trace.closed, 1);
});

test("stock-specific business rejection is isolated and later queued stocks are collected", () => {
  const result = runFixture({ status: "access" });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.trace.metrics.length, 6);
  assert.equal(result.trace.finished.at(-1).complete, true);
  assert.equal(result.trace.telemetry.at(-1).errorCode, "API_FAILED");
});

for (const [status, health] of [["authentication", "TOKEN_FAILED"], ["ip-check", "IP_UNVERIFIED"], ["storage", "DATABASE_FAILED"]]) {
  test(`fatal ${status} metric result stops before later metrics or queued stocks`, () => {
    const result = runFixture({ status });
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.trace.metrics.length, 1);
    assert.deepEqual(result.trace.started, ["018260"]);
    assert.equal(result.trace.telemetry.at(-1).errorCode, health);
    assert.equal(result.trace.closed, 1);
  });
}

test("failed token authentication stops before any target lookup or broker collection", () => {
  const result = runFixture({ authFailure: true });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.trace.authenticated, 1);
  assert.equal(result.trace.pending, 0);
  assert.deepEqual(result.trace.metrics, []);
});

test("absent optional heartbeat migration reports unavailable without registering a running worker", () => {
  const result = runFixture({ telemetryMissing: true }, ["heartbeat", "--event", "start", "--instance-id", instance]);
  assert.equal(result.status, 3, result.stderr);
  assert.match(result.stdout, /COLLECTOR_TELEMETRY_UNAVAILABLE/);
  assert.doesNotMatch(result.stdout, /COLLECTOR_STARTED/);
  assert.equal(result.trace.registered, 0);
  assert.equal(result.trace.authenticated, 0);
  assert.deepEqual(result.trace.telemetry, []);
});

const identity = { scopeId: "fixture-scope", environment: "real", request: { from: "2026-01-01", to: "2026-10-01" } };
const certificate = { status: "ready", complete: true, invalidRows: 0,
  requestedFrom: "2026-01-01", requestedTo: "2026-09-30", oldestDate: "2026-01-02", newestDate: "2026-09-30" };
const ready = { status: "ready", complete: true, invalidRows: 0, oldestDate: "2026-09-16", newestDate: "2026-10-01" };
const stored = [{ date: "2026-01-02", value: 2 }, { date: "2026-09-30", value: 3 }, { date: "2026-10-01", value: 4 }];
const mockStore = ({ exact = null, latest = certificate, coverage = certificate, rows = stored } = {}) => ({
  job: async (_id, _metric, exactRequest) => exactRequest ? exact : latest,
  completedCoverage: async id => coverage && coverage.requestedFrom <= id.request.from && coverage.requestedTo >= id.request.from ? coverage : null,
  read: async () => rows,
});

test("successive daily incremental refreshes advance the historical certificate and keep a bounded overlap", async () => {
  const first = await selectKiwoomCollection(mockStore(), identity, "credit", { incremental: true, resume: true });
  assert.equal(first.identity.request.from, "2026-09-16");
  const merged = completeKiwoomIncrementalJob(identity, first.identity, first.coverage, ready, stored);
  assert.ok(merged);
  assert.equal(merged.oldestDate, "2026-01-02");
  const nextIdentity = { ...identity, request: { ...identity.request, to: "2026-10-02" } };
  const nextCoverage = { ...merged, requestedFrom: identity.request.from, requestedTo: identity.request.to };
  const next = await selectKiwoomCollection(mockStore({ coverage: nextCoverage, latest: nextCoverage }), nextIdentity, "credit", { incremental: true, resume: true });
  assert.equal(next.identity.request.from, "2026-09-17");
  assert.equal(next.identity.request.to, "2026-10-02");
});

test("an earlier historical expansion cannot shortcut from a narrower completed request", async () => {
  const expanded = { ...identity, request: { ...identity.request, from: "2025-12-01" } };
  const result = await selectKiwoomCollection(mockStore(), expanded, "foreign", { incremental: true, resume: true });
  assert.equal(result.identity.request.from, "2025-12-01");
  assert.equal(result.coverage, null);
});

test("an exact unfinished backfill takes precedence over completed or newer narrowed history", async () => {
  const result = await selectKiwoomCollection(mockStore({ exact: { status: "collecting", complete: false, nextKey: "opaque-fixture-cursor" } }), identity, "credit", { incremental: true, resume: true });
  assert.equal(result.identity.request.from, "2026-01-01");
  assert.equal(result.identity.request.to, "2026-10-01");
});

test("unfinished narrowed refresh keeps its cursor request range even after partial rows advance the latest date", async () => {
  const unfinished = { status: "collecting", complete: false, nextKey: "opaque-fixture-cursor", requestedFrom: "2026-09-20", requestedTo: "2026-10-01" };
  const result = await selectKiwoomCollection(mockStore({ latest: unfinished }), identity, "credit", { incremental: true, resume: true });
  assert.equal(result.identity.request.from, "2026-09-20");
  assert.equal(result.identity.request.to, "2026-10-01");
  const changedTo = await selectKiwoomCollection(mockStore({ latest: { ...unfinished, requestedTo: "2026-09-30" } }), identity, "credit", { incremental: true, resume: true });
  assert.equal(changedTo.identity.request.from, "2026-09-16");
  assert.equal(changedTo.identity.request.to, "2026-10-01");
});

test("a completed narrowed refresh alone cannot certify the full requested history", async () => {
  const narrowed = { ...certificate, requestedFrom: "2026-09-20", requestedTo: "2026-10-01" };
  const result = await selectKiwoomCollection(mockStore({ latest: narrowed, coverage: null }), identity, "investmentTrust", { incremental: true, resume: true });
  assert.equal(result.identity.request.from, "2026-01-01");
  assert.equal(result.coverage, null);
});

test("provider-end completion retains history status and empty or malformed refresh never extends coverage", () => {
  const narrowed = { ...identity, request: { ...identity.request, from: "2026-09-16" } };
  const history = { ...ready, status: "history", stopReason: "provider-end" };
  const merged = completeKiwoomIncrementalJob(identity, narrowed, certificate, history, stored);
  assert.equal(merged.status, "history");
  assert.equal(merged.calendarBasis, "unknown");
  assert.equal(merged.missingDates, null);
  assert.equal(completeKiwoomIncrementalJob(identity, narrowed, certificate, { ...history, complete: false }, stored), null);
  assert.equal(completeKiwoomIncrementalJob(identity, narrowed, certificate, { ...history, invalidRows: 1 }, stored), null);
  assert.equal(completeKiwoomIncrementalJob(identity, narrowed, certificate, history, []), null);
});

test("completed narrow refresh cannot erase provider-end shortage in older historical coverage", () => {
  const historical = { ...certificate, status: "history", stopReason: "provider-end" };
  const narrowed = { ...identity, request: { ...identity.request, from: "2026-09-16" } };
  const merged = completeKiwoomIncrementalJob(identity, narrowed, historical, { ...ready, stopReason: "requested-start-reached" }, stored);
  assert.equal(merged.status, "history");
  assert.equal(merged.stopReason, "provider-end");
  const result = runFixture({ coverage: historical }, ["sync", "--live", "--resume", "--incremental", "--from", "2026-01-01", "--to", "2026-10-01"]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.trace.saved.every(job => job.status === "history"));
  assert.match(result.stdout, /"status": "history"/);
});

test("coverage extension rechecks expected sessions against the full stored request and rejects a refresh gap", () => {
  const fullCalendar = { ...identity, request: { ...identity.request, expectedDailyDates: ["2026-01-02", "2026-09-30", "2026-10-01"] } };
  const narrowed = { ...identity, request: { ...identity.request, from: "2026-09-16" } };
  assert.equal(completeKiwoomIncrementalJob(fullCalendar, narrowed, certificate, { ...ready, missingDates: [] }, stored.slice(1)), null);
  const covered = completeKiwoomIncrementalJob(fullCalendar, narrowed, certificate, { ...ready, missingDates: [] }, stored);
  assert.equal(covered.calendarBasis, "observed-price-sessions");
  assert.deepEqual(covered.missingDates, []);
  assert.equal(completeKiwoomIncrementalJob(identity, { ...narrowed, request: { ...narrowed.request, from: "2026-10-03" } }, certificate, ready, stored), null);
});

test("actual CLI persists extended full-request completion after a successful narrowed refresh", () => {
  const result = runFixture({ coverage: certificate }, ["sync", "--live", "--resume", "--incremental", "--from", "2026-01-01", "--to", "2026-10-01"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.trace.metrics.length, 3);
  assert.ok(result.trace.metrics.every(metric => metric.from === "2026-09-16" && metric.to === "2026-10-01"));
  assert.equal(result.trace.saved.length, 3);
  assert.ok(result.trace.saved.every(job => job.from === "2026-01-01" && job.to === "2026-10-01" && job.complete));
});

test("partial explicit seed is enqueued and the next CLI queue cycle collects other stocks", () => {
  const result = runFixture({ status: "collecting", sequence: [
    ["sync", "--live", "--enqueue", "--code", "018260", "--resume", "--incremental", "--from", "2026-09-01", "--to", "2026-10-01"],
    ["sync", "--live", "--targets", "--resume", "--incremental"],
  ] });
  assert.equal(result.status, 2, result.stderr);
  assert.deepEqual(result.trace.cycles, [2, 2]);
  assert.deepEqual(result.trace.enqueued, ["018260"]);
  assert.equal(result.trace.metrics.length, 9);
  assert.equal(result.trace.metrics.at(-1).code, "005930");
  assert.deepEqual(result.trace.finished.map(target => target.complete), [false, false, true]);
});

test("explicit seed respects the bounded queue limit with a nonfatal partial exit", () => {
  const result = runFixture({ targetLimit: true }, ["sync", "--live", "--enqueue"]);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout, /TARGET_LIMIT_REACHED/);
  assert.equal(result.trace.enqueued.length, 1);
  assert.deepEqual(result.trace.started, []);
  assert.deepEqual(result.trace.metrics, []);
});

test("fatal token failure happens before explicit seed enqueue", () => {
  const result = runFixture({ authFailure: true }, ["sync", "--live", "--enqueue"]);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(result.trace.enqueued, []);
  assert.deepEqual(result.trace.metrics, []);
});

test("first-page authentication or IP failure stops verification immediately", () => {
  for (const pageStatus of ["authentication", "ip-check"]) {
    const result = runFixture({ pageStatus }, ["verify", "--live"]);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.trace.pages.length, 1);
    assert.equal(result.trace.authenticated, 1);
  }
});

test("stock-specific or empty first-page diagnostic remains partial without denying other stock collection", () => {
  for (const scenario of [{ pageStatus: "access" }, { emptyDiagnostic: true }]) {
    const result = runFixture(scenario, ["verify", "--live"]);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.trace.pages.length, 3);
  }
});

test("malformed historical certificate and missing full-range calendar sessions cannot claim completion", async () => {
  const malformed = { ...certificate, invalidRows: 1 };
  const selected = await selectKiwoomCollection(mockStore({ coverage: malformed }), identity, "foreign", { incremental: true, resume: true });
  assert.equal(selected.identity.request.from, "2026-01-01");
  const narrowed = { ...identity, request: { ...identity.request, from: "2026-09-16" } };
  assert.equal(completeKiwoomIncrementalJob(identity, narrowed, malformed, ready, stored), null);
  const result = runFixture({ coverage: certificate, calendar: ["2026-01-02", "2026-10-01"] },
    ["sync", "--live", "--resume", "--incremental", "--from", "2026-01-01", "--to", "2026-10-01"]);
  assert.equal(result.status, 2, result.stderr);
  assert.deepEqual(result.trace.saved, []);
});
