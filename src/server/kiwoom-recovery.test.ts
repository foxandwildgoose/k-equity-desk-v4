import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../lib/db.ts";
import {
  alignChartFlow,
  FLOW_METRICS,
  type FlowMetricId,
  type FlowRequest,
  type FlowStatus,
} from "../lib/charts/hts-flow.ts";
import { createChartFlowService } from "./chart-flow.ts";
import { validateFlowRequest } from "./chart-flow-request.ts";
import { createKiwoomClient, KIWOOM_APIS } from "./kiwoom-client.ts";
import { kiwoomDataScope, readKiwoomConfig, type KiwoomConfig } from "./kiwoom-config.ts";
import { collectKiwoomMetric, parseKiwoomRows } from "./kiwoom-flow.ts";
import { createKiwoomStore, type FlowIdentity, type KiwoomJob } from "./kiwoom-store.ts";

// SYNTHETIC RECOVERY FIXTURES ONLY. Never reads process credentials, connects to
// an operational database, or performs network/broker requests. In-memory PGlite
// verifies the shared SQL contract; it is not evidence of production durability.
const pg = new PGlite();
await pg.waitReady;
for (const name of [
  "0002_kiwoom_flow.sql",
  "0003_kiwoom_collection_targets.sql",
  "0004_kiwoom_collector_runtime.sql",
])
  await pg.exec(await readFile(new URL(`../../migrations/${name}`, import.meta.url), "utf8"));
after(() => pg.close());
const sql = {
  query: async <T>(text: string, params?: unknown[]) => (await pg.query<T>(text, params)).rows,
} as Sql;
const store = createKiwoomStore(sql);
const dates = ["2026-09-01", "2026-09-02", "2026-09-03"];
const request: FlowRequest = {
  code: "018260",
  market: "KR",
  instrument: "stock",
  exchange: "KOSPI",
  currency: "KRW",
  quantityUnit: "주",
  interval: "day",
  flowScope: "KRX",
  from: dates[0],
  to: dates[2],
  expectedDailyDates: dates,
};
let serial = 0;
function fixtureIdentity(): FlowIdentity {
  return {
    scopeId: `synthetic-recovery-${++serial}`,
    environment: "real",
    request: { ...request, expectedDailyDates: [...dates] },
  };
}
function webConfig(identity: FlowIdentity): KiwoomConfig {
  return readKiwoomConfig({
    NODE_ENV: "production",
    KIWOOM_FLOW_ENABLED: "true",
    KIWOOM_FLOW_MODE: "collector",
    KIWOOM_ENV: identity.environment,
    KIWOOM_DATA_SCOPE_ID: identity.scopeId,
    VITE_AUTH_ENABLED: "false",
    // Configuration flag only. All SQL is explicitly injected above.
    DATABASE_URL: "postgresql://synthetic.invalid/not-connected",
  });
}
function webService(identity: FlowIdentity) {
  const counters = { broker: 0, egress: 0, telemetry: 0 };
  const service = createChartFlowService({
    config: () => webConfig(identity),
    // Listing verification is synthetic and local too; no public metadata fetch.
    authorizeTarget: async (target) =>
      target.market === "KR" &&
      ["018260", "005930", "910001", "910002", "910003"].includes(target.code),
    store: async () => ({
      ...store,
      collectorRuntime: {
        ...store.collectorRuntime!,
        read: async () => {
          counters.telemetry++;
          throw new Error("public synthetic fixture must not inspect operational telemetry");
        },
      },
    }),
    client: () => {
      counters.broker++;
      throw new Error("collector web fixture must not construct a broker client");
    },
    checkEgress: async () => {
      counters.egress++;
      throw new Error("collector web fixture must not probe egress");
    },
  });
  return { service, counters };
}
const response = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { headers: { "cont-yn": "N", ...headers } });
const syntheticValues: Record<FlowMetricId, string[]> = {
  credit: ["+3.42%", "0", "3.65"],
  foreign: ["51.72", "0%", "+52.61"],
  investmentTrust: ["+120,000", "0", "-85,000"],
};
function providerRow(metric: FlowMetricId, index: number, value = syntheticValues[metric][index]) {
  return {
    dt: dates[index].replaceAll("-", ""),
    [KIWOOM_APIS[metric].field]: value,
    ...(metric === "credit" ? { remn: "1,234" } : {}),
    ...(metric === "foreign" ? { poss_stkcnt: "1,234,567" } : {}),
  };
}
function readyJob(patch: Partial<KiwoomJob> = {}): KiwoomJob {
  const instant = new Date().toISOString();
  return {
    status: "ready",
    stopReason: "requested-start-reached",
    pages: 1,
    rows: dates.length,
    invalidRows: 0,
    oldestDate: dates[0],
    newestDate: dates[2],
    nextKey: null,
    complete: true,
    updatedAt: instant,
    lastSuccessAt: instant,
    errorCode: null,
    ...patch,
  };
}
async function seed(identity: FlowIdentity, missingMiddle = false) {
  for (const metric of FLOW_METRICS) {
    const parsed = parseKiwoomRows(
      dates.map((_, index) =>
        providerRow(metric, index, missingMiddle && index === 1 ? "-" : undefined),
      ),
      metric,
      new Date().toISOString(),
      identity.environment,
      identity.request.flowScope ?? "KRX",
    );
    await store.upsert(identity, metric, parsed.observations);
    await store.saveJob(identity, metric, readyJob({ invalidRows: parsed.invalidRows }));
  }
}

test("synthetic 018260 recovery: queued public chart becomes READY through official adapters and the same shared SQL service", async () => {
  const identity = fixtureIdentity();
  const config = webConfig(identity);
  assert.equal(config.appKey, undefined);
  assert.equal(config.appSecret, undefined);
  assert.equal(config.authEnabled, false);
  assert.equal(config.authenticationReady, false);
  assert.equal(kiwoomDataScope(config), identity.scopeId);
  const { service, counters } = webService(identity);
  const [initial, concurrent] = await Promise.all([
    service(identity.request, undefined, null),
    service(identity.request, undefined, null),
  ]);
  for (const result of [initial, concurrent])
    for (const metric of FLOW_METRICS) {
      assert.equal(result[metric].health, "COLLECTION_QUEUED");
      assert.deepEqual(result[metric].observations, []);
      assert.equal(result[metric].diagnostics?.stored, false);
    }
  const [queued] = await sql.query<{ count: number }>(
    "select count(*)::int as count from kiwoom_collection_targets where scope_id=$1",
    [identity.scopeId],
  );
  assert.equal(queued.count, 1, "concurrent chart requests deduplicate the 018260 target");
  assert.equal(await store.targets.state(identity), "queued");
  const syntheticKey = `SYNTHETIC_RECOVERY_APP_KEY_${serial}`;
  const syntheticSecret = "SYNTHETIC_RECOVERY_APP_SECRET";
  const syntheticToken = "SYNTHETIC_RECOVERY_TOKEN";
  const collectorConfig = {
    ...config,
    mode: "direct" as const,
    appKey: syntheticKey,
    appSecret: syntheticSecret,
    expectedEgressIp: "192.0.2.1",
  };
  let tokenRequests = 0;
  const calls: { apiId: string; cursor: string }[] = [];
  const client = createKiwoomClient(
    collectorConfig,
    {
      ...store,
      // No live dispatch; omit wall-clock throttling for deterministic fixtures.
      admit: async () => {},
    },
    {
      fetch: async (url, init) => {
        const parsedUrl = new URL(String(url));
        assert.equal(parsedUrl.host, "api.kiwoom.com");
        const body = JSON.parse(String(init?.body)) as Record<string, string>;
        if (parsedUrl.pathname === "/oauth2/token") {
          tokenRequests++;
          assert.deepEqual(Object.keys(body).sort(), ["appkey", "grant_type", "secretkey"]);
          assert.equal(body.grant_type, "client_credentials");
          return response({
            return_code: 0,
            token: syntheticToken,
            token_type: "bearer",
            expires_dt: "20300101090000",
          });
        }
        const headers = new Headers(init?.headers);
        const apiId = headers.get("api-id")!;
        const metric = FLOW_METRICS.find((id) => KIWOOM_APIS[id].id === apiId);
        assert.ok(metric, "only ka10013/ka10008/ka10059 may serve production metrics");
        assert.equal(parsedUrl.pathname, KIWOOM_APIS[metric].path);
        assert.equal(body.stk_cd, "018260");
        if (metric === "credit") assert.equal(body.qry_tp, "1");
        if (metric === "investmentTrust") {
          assert.equal(body.amt_qty_tp, "2");
          assert.equal(body.trde_tp, "0");
          assert.equal(body.unit_tp, "1");
        }
        const cursor = headers.get("next-key") ?? "";
        calls.push({ apiId, cursor });
        const nextKey = `synthetic-cursor-${apiId}`;
        if (!cursor) {
          assert.equal(headers.get("cont-yn"), "N");
          return response(
            {
              return_code: 0,
              [KIWOOM_APIS[metric].array]: [providerRow(metric, 2), providerRow(metric, 1)],
            },
            { "cont-yn": "Y", "next-key": nextKey },
          );
        }
        assert.equal(cursor, nextKey);
        assert.equal(headers.get("cont-yn"), "Y");
        // The second page reverses provider order and repeats an already stored date.
        return response({
          return_code: 0,
          [KIWOOM_APIS[metric].array]: [providerRow(metric, 0), providerRow(metric, 1)],
        });
      },
    },
  );
  await store.targets.start(identity);
  for (const metric of FLOW_METRICS) {
    const job = await collectKiwoomMetric(store, client, identity, metric, {
      maxPages: 2,
      budgetMs: 10_000,
      resume: true,
    });
    assert.equal(job.complete, true);
    assert.equal(job.stopReason, "requested-start-reached");
    assert.equal(job.pages, 2);
  }
  await store.targets.finish(identity, true, true);
  assert.equal(await store.targets.state(identity), "ready");
  assert.equal(tokenRequests, 1, "all metrics reuse server-only authentication");
  assert.equal(calls.length, 6);
  const fresh = await service(identity.request, undefined, null);
  assert.notEqual(
    initial,
    fresh,
    "fresh reads observe collector writes without restarting the web service",
  );
  const otherVisitor = await service(identity.request, undefined, "unrelated-verified-user");
  for (const metric of FLOW_METRICS) {
    assert.equal(fresh[metric].health, "READY");
    assert.equal(fresh[metric].capability, "available");
    assert.equal(fresh[metric].stale, false);
    assert.deepEqual(
      fresh[metric].observations.map((row) => row.date),
      dates,
    );
    assert.deepEqual(fresh[metric].observations, otherVisitor[metric].observations);
    assert.equal(fresh[metric].diagnostics?.validValues, 3);
    assert.deepEqual(fresh[metric].diagnostics?.missingDates, []);
  }
  assert.deepEqual(
    fresh.credit.observations.map((row) => row.value),
    [3.42, 0, 3.65],
  );
  assert.deepEqual(
    fresh.foreign.observations.map((row) => row.value),
    [51.72, 0, 52.61],
  );
  assert.equal(fresh.foreign.observations[0].referenceValue, 1234567);
  assert.deepEqual(
    fresh.investmentTrust.observations.map((row) => row.value),
    [120000, 0, -85000],
  );
  for (const mode of ["daily", "cumulative", "available-cumulative"] as const) {
    const aligned = alignChartFlow(fresh, {
      dates,
      interval: "day",
      expectedDailyDates: dates,
      cumulativeStart: request.from,
      investmentTrustMode: mode,
    });
    assert.deepEqual(
      aligned.investmentTrust.points.map((point) => point.value),
      mode === "daily" ? [120000, 0, -85000] : [120000, 120000, 35000],
    );
  }
  const serialized = JSON.stringify(fresh);
  for (const secret of [syntheticKey, syntheticSecret, syntheticToken, "authorization"])
    assert.equal(
      serialized.includes(secret),
      false,
      "browser response never includes credential/token/header material",
    );
  assert.deepEqual(counters, { broker: 0, egress: 0, telemetry: 0 });
});

test("synthetic null gaps remain null after persistence and poison fixed cumulative values after the missing date", async () => {
  const identity = fixtureIdentity();
  await seed(identity, true);
  const { service } = webService(identity);
  const result = await service(identity.request);
  for (const metric of FLOW_METRICS) {
    assert.equal(result[metric].health, "PARTIAL");
    assert.deepEqual(result[metric].diagnostics?.missingDates, [dates[1]]);
    assert.equal(result[metric].observations[1].value, null);
  }
  for (const mode of ["daily", "cumulative", "available-cumulative"] as const) {
    const aligned = alignChartFlow(result, {
      dates,
      interval: "day",
      expectedDailyDates: dates,
      cumulativeStart: request.from,
      investmentTrustMode: mode,
    });
    assert.deepEqual(
      aligned.credit.points.map((point) => point.value),
      [3.42, null, 3.65],
    );
    assert.deepEqual(
      aligned.foreign.points.map((point) => point.value),
      [51.72, null, 52.61],
    );
    assert.deepEqual(
      aligned.investmentTrust.points.map((point) => point.value),
      mode === "daily"
        ? [120000, null, -85000]
        : mode === "cumulative"
          ? [120000, null, null]
          : [null, null, -85000],
    );
    assert.equal(aligned.investmentTrust.points[1].partial, true);
  }
});

test("synthetic recovery rows stay isolated by code, environment, market scope, instrument and shared data scope", async () => {
  const identity = fixtureIdentity();
  await seed(identity);
  const { service, counters } = webService(identity);
  for (const patch of [
    { code: "005930" },
    { flowScope: "NXT" as const },
    { flowScope: "SOR" as const },
    { instrument: "etf" as const, quantityUnit: "좌" as const },
  ]) {
    const result = await service({ ...identity.request, ...patch });
    for (const metric of FLOW_METRICS) assert.deepEqual(result[metric].observations, []);
  }
  const mockIdentity = { ...identity, environment: "mock" as const };
  const mock = await webService(mockIdentity).service(identity.request);
  for (const metric of FLOW_METRICS) assert.deepEqual(mock[metric].observations, []);
  const otherScope = { ...identity, scopeId: `${identity.scopeId}-other` };
  const other = await webService(otherScope).service(identity.request);
  for (const metric of FLOW_METRICS) {
    assert.deepEqual(other[metric].observations, []);
    assert.equal(other[metric].health, "DATA_SCOPE_MISMATCH");
  }
  assert.equal(
    await store.targets.state(otherScope),
    null,
    "scope mismatch does not create unrelated collector work",
  );
  const restored = await service(identity.request);
  for (const metric of FLOW_METRICS) assert.equal(restored[metric].health, "READY");
  assert.deepEqual(counters, { broker: 0, egress: 0, telemetry: 0 });
});

test("synthetic stored authentication, network and parsing failures remain actionable after target enqueue", async () => {
  let fixtureCode = 910001;
  for (const [status, health] of [
    ["authentication", "TOKEN_FAILED"],
    ["network", "API_FAILED"],
    ["parsing", "PARSING_FAILED"],
  ] as const satisfies readonly (readonly [FlowStatus, string])[]) {
    const identity = fixtureIdentity();
    // Distinct synthetic symbols avoid the intentional DATA_SCOPE_MISMATCH
    // warning from other tests' stored 018260 rows in this shared isolated DB.
    identity.request = { ...identity.request, code: String(fixtureCode++) };
    for (const metric of FLOW_METRICS)
      await store.saveJob(
        identity,
        metric,
        readyJob({
          status,
          stopReason: `synthetic-${status}-failure`,
          pages: 0,
          rows: 0,
          complete: false,
          oldestDate: null,
          newestDate: null,
          lastSuccessAt: null,
          errorCode: 999,
        }),
      );
    const { service, counters } = webService(identity);
    const result = await service(identity.request);
    assert.equal(await store.targets.state(identity), "queued");
    for (const metric of FLOW_METRICS) {
      assert.equal(result[metric].status, status);
      assert.equal(
        result[metric].health,
        health,
        "an enqueue is not proof that a stored provider failure disappeared",
      );
      assert.deepEqual(result[metric].observations, []);
      assert.equal(result[metric].diagnostics?.errorCode, 999);
    }
    assert.deepEqual(counters, { broker: 0, egress: 0, telemetry: 0 });
  }
});

test("synthetic range expansion stays partial and registers the missing earlier history without shortening refresh delay", async () => {
  const identity = fixtureIdentity();
  identity.request = { ...identity.request, from: dates[1], expectedDailyDates: dates.slice(1) };
  await store.targets.enqueue(identity);
  await store.targets.start(identity);
  for (const metric of FLOW_METRICS) {
    const parsed = parseKiwoomRows(
      [providerRow(metric, 1), providerRow(metric, 2)],
      metric,
      new Date().toISOString(),
      "real",
      "KRX",
    );
    await store.upsert(identity, metric, parsed.observations);
    await store.saveJob(identity, metric, readyJob({ oldestDate: dates[1], rows: 2 }));
  }
  await store.targets.finish(identity, true, true);
  const target = () =>
    sql.query<{ requestedFrom: string; due: string; state: string }>(
      `select to_char(requested_from,'YYYY-MM-DD') as "requestedFrom",next_due_at::text as due,state
      from kiwoom_collection_targets where scope_id=$1`,
      [identity.scopeId],
    );
  const [before] = await target();
  const { service } = webService(identity);
  const widened = await service({ ...identity.request, from: dates[0], expectedDailyDates: dates });
  for (const metric of FLOW_METRICS) {
    assert.equal(widened[metric].health, "PARTIAL");
    assert.equal(widened[metric].capability, "partial");
    assert.deepEqual(widened[metric].diagnostics?.missingDates, [dates[0]]);
  }
  const [after] = await target();
  assert.equal(
    after.requestedFrom,
    dates[0],
    "a wider chart must register the earlier missing history",
  );
  assert.equal(after.state, "partial");
  assert.equal(
    after.due,
    before.due,
    "public reads cannot accelerate the collector refresh schedule",
  );
});

test("synthetic same-date correction persists while a later missing value cannot erase valid zero or signed quantities", async () => {
  const identity = fixtureIdentity();
  await seed(identity);
  const acquiredAt = Date.now();
  for (const [metric, index, replacement] of [
    ["credit", 0, "+4.25"],
    ["foreign", 1, "0"],
    ["investmentTrust", 2, "-50,000"],
  ] as const) {
    const corrected = parseKiwoomRows(
      [providerRow(metric, index, replacement)],
      metric,
      new Date(acquiredAt + 1000).toISOString(),
      "real",
      "KRX",
    );
    await store.upsert(identity, metric, corrected.observations);
    const missing = parseKiwoomRows(
      [providerRow(metric, index, "-")],
      metric,
      new Date(acquiredAt + 2000).toISOString(),
      "real",
      "KRX",
    );
    await store.upsert(identity, metric, missing.observations);
  }
  const { service } = webService(identity);
  const result = await service(identity.request);
  assert.equal(result.credit.observations[0].value, 4.25);
  assert.equal(result.foreign.observations[1].value, 0);
  assert.equal(result.investmentTrust.observations[2].value, -50000);
  for (const metric of FLOW_METRICS) {
    assert.equal(result[metric].health, "READY");
    assert.equal(
      result[metric].observations.length,
      3,
      "date corrections never duplicate observations",
    );
  }
});

test("synthetic later-date expansion keeps stored observations visible and queues the new missing date", async () => {
  const identity = fixtureIdentity();
  await store.targets.enqueue(identity);
  await store.targets.start(identity);
  await seed(identity);
  await store.targets.finish(identity, true, true);
  const target = () =>
    sql.query<{ requestedTo: string; due: string; state: string }>(
      `select to_char(requested_to,'YYYY-MM-DD') as "requestedTo",next_due_at::text as due,state
      from kiwoom_collection_targets where scope_id=$1`,
      [identity.scopeId],
    );
  const [before] = await target();
  const laterDate = "2026-09-04";
  const { service, counters } = webService(identity);
  const existing = await service(identity.request);
  const expandedDates = [...dates, laterDate];
  const expanded = await service({
    ...identity.request,
    to: laterDate,
    expectedDailyDates: expandedDates,
  });
  for (const metric of FLOW_METRICS) {
    assert.equal(existing[metric].health, "READY");
    assert.equal(expanded[metric].health, "PARTIAL");
    assert.equal(expanded[metric].capability, "partial");
    assert.deepEqual(
      expanded[metric].observations,
      existing[metric].observations,
      "previously stored values remain visible while a later date is pending",
    );
    assert.deepEqual(expanded[metric].diagnostics?.missingDates, [laterDate]);
  }
  const [after] = await target();
  assert.equal(after.requestedTo, laterDate);
  assert.equal(after.state, "partial");
  assert.equal(
    after.due,
    before.due,
    "newer chart dates cannot shorten the bounded refresh schedule",
  );
  const aligned = alignChartFlow(expanded, {
    dates: expandedDates,
    interval: "day",
    expectedDailyDates: expandedDates,
    cumulativeStart: request.from,
    investmentTrustMode: "daily",
  });
  for (const metric of FLOW_METRICS) assert.equal(aligned[metric].points.at(-1)?.value, null);
  assert.deepEqual(counters, { broker: 0, egress: 0, telemetry: 0 });
});

test("synthetic unknown listing cannot enqueue, while public stored observations remain readable without broker or IP calls", async () => {
  const identity = fixtureIdentity();
  identity.request = { ...identity.request, code: "910004" };
  const counters = { listing: 0, broker: 0, egress: 0 };
  const service = createChartFlowService({
    config: () => webConfig(identity),
    store: async () => store,
    authorizeTarget: async () => {
      counters.listing++;
      return false;
    },
    client: () => {
      counters.broker++;
      throw new Error("synthetic collector cannot construct broker");
    },
    checkEgress: async () => {
      counters.egress++;
      throw new Error("synthetic collector cannot check egress");
    },
  });
  const blocked = await service(identity.request, undefined, null);
  for (const metric of FLOW_METRICS) {
    assert.equal(blocked[metric].health, "PRODUCT_TYPE_UNKNOWN");
    assert.deepEqual(blocked[metric].observations, []);
  }
  assert.equal(
    await store.targets.state(identity),
    null,
    "unconfirmed listing cannot create a target",
  );
  await seed(identity, true);
  const stored = await service(identity.request, undefined, null);
  for (const metric of FLOW_METRICS) {
    assert.equal(stored[metric].health, "PARTIAL");
    assert.equal(stored[metric].observations.length, 3);
    assert.equal(stored[metric].observations[1].value, null);
  }
  assert.equal(stored.credit.observations[0].value, 3.42);
  assert.equal(stored.foreign.observations[0].value, 51.72);
  assert.equal(stored.investmentTrust.observations.at(-1)?.value, -85000);
  assert.equal(
    await store.targets.state(identity),
    null,
    "stored partial data does not bypass listing authorization",
  );
  assert.deepEqual(counters, { listing: 2, broker: 0, egress: 0 });
});

test("synthetic price history beyond twenty years is readable while collector subscriptions stay bounded to 1830 days", async () => {
  const identity = fixtureIdentity();
  await seed(identity);
  const historicalDate = "2000-01-03";
  for (const metric of FLOW_METRICS) {
    const parsed = parseKiwoomRows(
      [
        {
          dt: "20000103",
          [KIWOOM_APIS[metric].field]: metric === "investmentTrust" ? "-1,500" : "1.25",
        },
      ],
      metric,
      new Date().toISOString(),
      "real",
      "KRX",
    );
    await store.upsert(identity, metric, parsed.observations);
  }
  const longRequest = {
    ...identity.request,
    from: "1990-01-01",
    expectedDailyDates: [historicalDate, ...dates],
  };
  assert.ok(Date.parse(longRequest.to) - Date.parse(longRequest.from) > 20 * 366 * 86_400_000);
  assert.equal(validateFlowRequest(longRequest).from, "1990-01-01");
  const { service, counters } = webService(identity);
  const result = await service(longRequest);
  assert.equal(
    result.request.from,
    "1990-01-01",
    "public read scope must not be silently truncated to collector backfill limits",
  );
  for (const metric of FLOW_METRICS) {
    assert.equal(result[metric].health, "PARTIAL");
    assert.equal(result[metric].providedFrom, historicalDate);
    assert.equal(result[metric].observations.length, 4);
    assert.equal(
      result[metric].observations[0].date,
      historicalDate,
      "existing older provider observations remain accessible in a long price window",
    );
  }
  const [target] = await sql.query<{ from: string; to: string; historyDays: number }>(
    `select to_char(requested_from,'YYYY-MM-DD') as "from",to_char(requested_to,'YYYY-MM-DD') as "to",
      requested_to-requested_from as "historyDays" from kiwoom_collection_targets where scope_id=$1`,
    [identity.scopeId],
  );
  assert.equal(target.to, longRequest.to);
  assert.equal(target.historyDays, 1830);
  assert.ok(
    target.from > historicalDate,
    "older displayed history cannot create an unbounded backfill subscription",
  );
  assert.throws(
    () => validateFlowRequest({ ...longRequest, from: "1800-01-01" }),
    /조회 기간/,
    "read access retains its separate hundred-year safety ceiling",
  );
  assert.deepEqual(counters, { broker: 0, egress: 0, telemetry: 0 });
});
