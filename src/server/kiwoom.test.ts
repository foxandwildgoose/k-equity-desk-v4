import assert from "node:assert/strict";
import { test, after } from "node:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  credentialsStatus,
  readKiwoomConfig,
  checkKiwoomEgress,
  assertKiwoomOwner,
  type KiwoomConfig,
  KiwoomError,
  safeKiwoomConfig,
} from "./kiwoom-config.ts";
import { createKiwoomClient, parseKiwoomExpiry, kiwoomCredentialKey } from "./kiwoom-client.ts";
import { createKiwoomStore, type FlowIdentity } from "./kiwoom-store.ts";
import {
  collectKiwoomMetric,
  kiwoomConditions,
  kiwoomDateExtent,
  parseKiwoomRows,
} from "./kiwoom-flow.ts";
import { diagnoseKiwoom } from "./kiwoom-diagnostics.ts";
import { crossCheckKiwoom } from "./kiwoom-cross-check.ts";
import { htsFlowPointDetails } from "../lib/charts/hts-layout.ts";
import { createChartFlowService } from "./chart-flow.ts";
import {
  alignChartFlow,
  emptyChartFlow,
  FLOW_METRICS,
  flowRequestKey,
  type FlowRequest,
} from "../lib/charts/hts-flow.ts";
import type { Sql } from "../lib/db.ts";

const schema = await readFile(
  new URL("../../migrations/0002_kiwoom_flow.sql", import.meta.url),
  "utf8",
);
const pg = new PGlite();
await pg.waitReady;
await pg.exec(schema);
after(() => pg.close());
const sqlFor = (db: PGlite) =>
  ({
    query: async <T>(text: string, params?: unknown[]) => (await db.query<T>(text, params)).rows,
  }) as Sql;
const store = createKiwoomStore(sqlFor(pg));
const config: KiwoomConfig = {
  appKey: "fixture-app-key",
  appSecret: "fixture-secret-key",
  environment: "real",
  enabled: true,
  mode: "direct",
  requestsPerSecond: 2,
  expectedEgressIp: "192.0.2.1",
  ownerUserId: "fixture-owner",
  databaseConfigured: true,
};
const request: FlowRequest = {
  code: "005930",
  market: "KR",
  instrument: "stock",
  exchange: "KOSPI",
  currency: "KRW",
  quantityUnit: "주",
  from: "2026-09-01",
  to: "2026-09-03",
  interval: "day",
  expectedDailyDates: ["2026-09-01", "2026-09-02", "2026-09-03"],
};
let serial = 0;
const identity = (): FlowIdentity => ({
  scopeId: "fixture-" + ++serial,
  environment: "real",
  request: { ...request },
});
const ok = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { headers: { "cont-yn": "N", ...headers } });
const auth = () =>
  ok({
    return_code: 0,
    token: "fixture-bearer-token",
    token_type: "bearer",
    expires_dt: "20300101090000",
  });
const quickStore = (base = store) => ({ ...base, admit: async () => {} });
const fixtureRows = (metric: (typeof FLOW_METRICS)[number], date = "20260903", value = "10") => [
  { dt: date, [metric === "credit" ? "remn_rt" : metric === "foreign" ? "wght" : "invtrt"]: value },
];
const arrayName = (metric: (typeof FLOW_METRICS)[number]) =>
  metric === "credit" ? "crd_trde_trend" : metric === "foreign" ? "stk_frgnr" : "stk_invsr_orgn";

test("four credential presence states; defaults do not imply authentication or enable live access", () => {
  assert.equal(credentialsStatus({}), "CREDENTIALS_NOT_CONFIGURED");
  assert.equal(credentialsStatus({ appKey: "x" }), "APP_SECRET_MISSING");
  assert.equal(credentialsStatus({ appSecret: "x" }), "APP_KEY_MISSING");
  assert.equal(credentialsStatus({ appKey: "x", appSecret: "y" }), "CREDENTIALS_CONFIGURED");
  assert.equal(readKiwoomConfig({}).enabled, false);
  for (const env of [
    { KIWOOM_ENV: "demo" },
    { KIWOOM_FLOW_MODE: "proxy" },
    { KIWOOM_REQUESTS_PER_SECOND: "5" },
    { KIWOOM_EXPECTED_EGRESS_IP: "invalid" },
  ])
    assert.throws(() => readKiwoomConfig(env));
});

test("safe runtime flags distinguish collector requirements and reject disabled/dev/unready owner auth", () => {
  const safe = safeKiwoomConfig({
    ...config,
    mode: "collector",
    appKey: undefined,
    appSecret: undefined,
  });
  assert.equal(safe.credentialsRequired, false);
  assert.equal(safe.appKeyConfigured, false);
  assert.equal(safe.databaseConfigured, true);
  assert.equal(JSON.stringify(safe).includes(config.ownerUserId!), false);
  for (const cfg of [
    { ...config, authEnabled: false },
    { ...config, authenticationReady: false },
    { ...config, ownerUserId: "dev-user" },
  ])
    assert.throws(
      () => assertKiwoomOwner(cfg, cfg.ownerUserId),
      (error: unknown) => error instanceof KiwoomError && error.health === "OWNER_AUTH_FAILED",
    );
  assert.equal(
    readKiwoomConfig({ NODE_ENV: "production", VITE_AUTH_ENABLED: "true" }).authenticationReady,
    false,
  );
  assert.equal(
    readKiwoomConfig({
      DATABASE_URL: "postgresql://fixture.test/isolated",
      VITE_AUTH_ENABLED: "true",
    }).authenticationReady,
    false,
  );
  assert.equal(
    readKiwoomConfig({
      NODE_ENV: "production",
      VITE_AUTH_ENABLED: "true",
      BETTER_AUTH_SECRET: "TEST_ONLY_AUTH_SECRET",
      BETTER_AUTH_URL: "https://app.example.test",
    }).authenticationReady,
    true,
  );
});

test("read-only diagnostics gate stored rows and distinguish every missing configuration", async () => {
  let reads = 0;
  const options = {
    store: async () => {
      reads++;
      return store;
    },
    checkEgress: async () => {
      throw new Error("collector must not check IP");
    },
  };
  const unauthorized = await diagnoseKiwoom(
    { ...config, mode: "collector" },
    request,
    "another-user",
    options,
  );
  assert.equal(unauthorized.status, "OWNER_AUTH_FAILED");
  assert.equal(Object.keys(unauthorized.metrics).length, 0);
  assert.equal(reads, 0);
  const disabled = await diagnoseKiwoom(
    {
      ...config,
      enabled: false,
      databaseConfigured: false,
      appSecret: undefined,
      expectedEgressIp: undefined,
    },
    request,
    null,
    options,
  );
  assert.deepEqual(disabled.issues, [
    "DISABLED",
    "CREDENTIALS_MISSING",
    "EXPECTED_IP_MISSING",
    "DATABASE_MISSING",
    "OWNER_AUTH_FAILED",
  ]);
  assert.equal(reads, 0);
  const diagnosticOwner = "diagnostic-owner-" + ++serial;
  const id = {
    scopeId: diagnosticOwner,
    environment: "real" as const,
    request: { ...request, code: "005930" },
  };
  await store.upsert(
    id,
    "foreign",
    parseKiwoomRows(
      [{ dt: "20260903", wght: "51.72", poss_stkcnt: "1,234" }],
      "foreign",
      new Date().toISOString(),
      "real",
      "KRX",
    ).observations,
  );
  const result = await diagnoseKiwoom(
    {
      ...config,
      ownerUserId: diagnosticOwner,
      mode: "collector",
      appKey: undefined,
      appSecret: undefined,
    },
    request,
    diagnosticOwner,
    options,
  );
  assert.equal(result.ownerAuthorized, true);
  assert.equal(result.latestStored.foreign, "2026-09-03");
  assert.equal(result.egressStatus, "NOT_REQUIRED");
  assert.equal(result.tokenStatus, "NOT_REQUIRED");
  assert.equal(result.apis.ka10008, "NOT_TESTED");
  for (const secret of [
    config.appKey!,
    config.appSecret!,
    config.ownerUserId!,
    config.expectedEgressIp!,
  ])
    assert.equal(JSON.stringify(result).includes(secret), false);
});

test("schema inspection reports missing/applied tables without creating them or swallowing DB errors", async () => {
  const empty = new PGlite();
  await empty.waitReady;
  try {
    const emptyStore = createKiwoomStore(sqlFor(empty));
    assert.deepEqual(await emptyStore.schema(), {
      observations: false,
      jobs: false,
      coordination: false,
      ready: false,
      migrationRecorded: null,
    });
    const before = await empty.query(
      "select count(*)::int as n from pg_tables where schemaname='public'",
    );
    const response = await createChartFlowService({
      config: () => config,
      store: async () => emptyStore,
    })(request, undefined, config.ownerUserId);
    assert.equal(response.credit.health, "DATABASE_SCHEMA_MISSING");
    const after = await empty.query(
      "select count(*)::int as n from pg_tables where schemaname='public'",
    );
    assert.deepEqual(after.rows, before.rows);
    await empty.exec(
      schema +
        "; create table _migrations(name text primary key); insert into _migrations values ('0002_kiwoom_flow.sql')",
    );
    assert.equal((await emptyStore.schema()).migrationRecorded, true);
    assert.equal((await emptyStore.schema()).ready, true);
  } finally {
    await empty.close();
  }
});

test("safe panel health preserves disabled/database/IP/auth/parser/API distinctions", async () => {
  for (const [cfg, userId, expected] of [
    [{ ...config, enabled: false }, config.ownerUserId, "DISABLED"],
    [{ ...config, databaseConfigured: false }, config.ownerUserId, "DATABASE_MISSING"],
    [{ ...config, appSecret: undefined }, config.ownerUserId, "CREDENTIALS_MISSING"],
    [config, null, "OWNER_AUTH_FAILED"],
  ] as const) {
    const response = await createChartFlowService({ config: () => cfg, store: async () => store })(
      request,
      undefined,
      userId,
    );
    assert.equal(response.credit.health, expected);
    const aligned = alignChartFlow(response, {
      dates: request.expectedDailyDates!,
      interval: "day",
      cumulativeStart: request.from,
      investmentTrustMode: "daily",
    });
    const status = htsFlowPointDetails(
      response.credit,
      aligned.credit,
      undefined,
      response.fetchedAt,
      true,
    ).status;
    assert.equal(status.includes("인증 미설정"), false);
  }
});

test("page extent and continuation do not depend on provider row order; terminal headers are optional", async () => {
  assert.deepEqual(
    kiwoomDateExtent([
      { date: "2026-09-03" },
      { date: "invalid" },
      { date: "2026-09-01" },
      { date: "2026-09-02" },
    ]),
    { oldestDate: "2026-09-01", newestDate: "2026-09-03" },
  );
  for (const ascending of [true, false]) {
    const id = identity();
    let calls = 0;
    const client = createKiwoomClient({ ...config, appKey: "order-" + ++serial }, quickStore(), {
      fetch: async (url, init) => {
        if (String(url).endsWith("/token")) return auth();
        calls++;
        if (calls === 2) assert.equal(new Headers(init?.headers).get("next-key"), "ordered-page");
        const rows =
          calls === 1
            ? [
                { dt: "20260903", invtrt: "0" },
                { dt: "20260902", invtrt: "-85000" },
              ]
            : [{ dt: "20260901", invtrt: "+120000" }];
        if (ascending) rows.reverse();
        return new Response(JSON.stringify({ return_code: 0, stk_invsr_orgn: rows }), {
          headers: calls === 1 ? { "cont-yn": "Y", "next-key": "ordered-page" } : {},
        });
      },
    });
    const job = await collectKiwoomMetric(store, client, id, "investmentTrust");
    assert.equal(job.oldestDate, "2026-09-01");
    assert.equal(job.newestDate, "2026-09-03");
    assert.equal(job.complete, true);
    assert.deepEqual(
      (await store.read(id, "investmentTrust")).map((row) => row.value),
      [120000, -85000, 0],
    );
  }
});

test("same-page invalid duplicate never erases valid zero or signed net sells", () => {
  for (const value of ["0", "-85,000", "+120,000"]) {
    for (const reversed of [false, true]) {
      const rows = [
        { dt: "20260903", invtrt: value },
        { dt: "20260903", invtrt: "" },
      ];
      if (reversed) rows.reverse();
      const parsed = parseKiwoomRows(
        rows,
        "investmentTrust",
        new Date().toISOString(),
        "real",
        "KRX",
      );
      assert.equal(parsed.observations[0].value, Number(value.replaceAll(",", "")));
      assert.equal(parsed.invalidRows, 1);
    }
  }
});

test("005930 mocked OAuth/API/persistence/collector response reaches all frontend modes without ka10015", async () => {
  const owner = "integration-owner-" + ++serial;
  const cfg = { ...config, ownerUserId: owner, appKey: "integration-key-" + ++serial };
  let apiCalls = 0;
  const service = createChartFlowService({
    config: () => cfg,
    store: async () => store,
    checkEgress: async () => ({ status: "IP_MATCH", observedIp: "192.0.2.1" }),
    client: (c, s) =>
      createKiwoomClient(c, quickStore(s), {
        fetch: async (url, init) => {
          if (String(url).endsWith("/token")) return auth();
          const api = new Headers(init?.headers).get("api-id");
          apiCalls++;
          const metric =
            api === "ka10013" ? "credit" : api === "ka10008" ? "foreign" : "investmentTrust";
          assert.notEqual(api, "ka10015");
          return ok({
            return_code: 0,
            [arrayName(metric)]: ["20260903", "20260902", "20260901"].map((dt, i) => ({
              dt,
              remn_rt: "3.42",
              wght: "51.72",
              poss_stkcnt: "1,234",
              invtrt: ["0", "-85000", "+120000"][i],
            })),
          });
        },
      }),
  });
  const response = await service(request, undefined, owner);
  assert.equal(apiCalls, 3);
  assert.equal(response.credit.observations.at(-1)?.value, 3.42);
  assert.equal(response.foreign.observations.at(-1)?.referenceValue, 1234);
  assert.deepEqual(
    response.investmentTrust.observations.map((row) => row.value),
    [120000, -85000, 0],
  );
  for (const metric of FLOW_METRICS) assert.equal(response[metric].health, "READY");
  const collector = createChartFlowService({
    config: () => ({ ...cfg, mode: "collector", appKey: undefined, appSecret: undefined }),
    store: async () => store,
    client: () => {
      throw new Error("web must not call Kiwoom");
    },
  });
  const stored = await collector(request, undefined, owner);
  for (const mode of ["daily", "cumulative", "available-cumulative"] as const) {
    const aligned = alignChartFlow(stored, {
      dates: request.expectedDailyDates!,
      interval: "day",
      cumulativeStart: request.from,
      investmentTrustMode: mode,
    });
    assert.deepEqual(
      aligned.investmentTrust.points.map((point) => point.value),
      mode === "daily" ? [120000, -85000, 0] : [120000, 35000, 35000],
    );
  }
});

test("direct mode revalidates egress before every operation despite a previous match", async () => {
  let checks = 0;
  let clients = 0;
  const cfg = { ...config, ownerUserId: "repeat-ip-" + ++serial };
  const service = createChartFlowService({
    config: () => cfg,
    store: async () => store,
    checkEgress: async () => ({
      status: ++checks === 1 ? "IP_MATCH" : "IP_MISMATCH",
      observedIp: "192.0.2.1",
    }),
    client: (c, s) => {
      clients++;
      return createKiwoomClient({ ...c, appKey: "repeat-key-" + serial }, quickStore(s), {
        fetch: async (url, init) => {
          if (String(url).endsWith("/token")) return auth();
          const api = new Headers(init?.headers).get("api-id");
          const metric =
            api === "ka10013" ? "credit" : api === "ka10008" ? "foreign" : "investmentTrust";
          return ok({ return_code: 0, [arrayName(metric)]: fixtureRows(metric, "20260901") });
        },
      });
    },
  });
  await service(request, undefined, cfg.ownerUserId);
  const second = await service(request, undefined, cfg.ownerUserId);
  assert.equal(checks, 2);
  assert.equal(clients, 1);
  assert.equal(second.credit.health, "IP_MISMATCH");
  assert.equal(second.credit.observations.length, 1);
});

test("ka10015 is an explicit read-only date-aligned diagnostic using strt_dt and warning on disagreement", async () => {
  let calls = 0;
  const primary = {
    credit: parseKiwoomRows(
      [{ dt: "20260903", remn_rt: "3.42" }],
      "credit",
      new Date().toISOString(),
      "real",
      "KRX",
    ).observations,
    foreign: parseKiwoomRows(
      [{ dt: "20260903", wght: "51.72" }],
      "foreign",
      new Date().toISOString(),
      "real",
      "KRX",
    ).observations,
  };
  const original = JSON.stringify(primary);
  const client = createKiwoomClient({ ...config, appKey: "cross-key-" + ++serial }, quickStore(), {
    fetch: async (url, init) => {
      if (String(url).endsWith("/token")) return auth();
      calls++;
      assert.equal(new Headers(init?.headers).get("api-id"), "ka10015");
      assert.deepEqual(JSON.parse(String(init?.body)), { stk_cd: "005930", strt_dt: "20260903" });
      return ok({
        return_code: 0,
        daly_trde_dtl: [
          { dt: "20260902", crd_remn_rt: "80", for_wght: "90" },
          { dt: "20260903", crd_remn_rt: "3.43", for_wght: "50.00" },
        ],
      });
    },
  });
  const result = await crossCheckKiwoom(client, request, primary);
  assert.equal(calls, 1);
  assert.equal(result.comparedValues, 2);
  assert.equal(result.discrepancies.length, 1);
  assert.equal(result.discrepancies[0].metric, "foreign");
  assert.equal(result.persisted, false);
  assert.ok(result.warning);
  assert.equal(JSON.stringify(primary), original);
  assert.equal(JSON.stringify(result).includes("cross-key"), false);
});
test("egress distinguishes matched, mismatched, unknown and unset without credential headers", async () => {
  for (const [ip, status] of [
    ["192.0.2.1", "IP_MATCH"],
    ["192.0.2.2", "IP_MISMATCH"],
  ] as const) {
    const value = await checkKiwoomEgress("192.0.2.1", (async (url, init) => {
      assert.equal(url, "https://api.ipify.org?format=json");
      assert.equal(new Headers(init?.headers).get("authorization"), null);
      return ok({ ip });
    }) as typeof fetch);
    assert.equal(value.status, status);
  }
  assert.equal(
    (await checkKiwoomEgress("192.0.2.1", async () => new Response("", { status: 503 }))).status,
    "IP_UNVERIFIED",
  );
  assert.equal(
    (
      await checkKiwoomEgress(undefined, async () => {
        throw Error("must not call");
      })
    ).status,
    "EXPECTED_IP_MISSING",
  );
});
test("official field mappings exclude similar fields; missing and bad values never become zero", () => {
  for (const metric of FLOW_METRICS) {
    const wrong = {
      dt: "20260903",
      shr_rt: "91",
      limit_exh_rt: "92",
      orgn: "93",
      fnnc_invt: "94",
      penfnd_etc: "95",
      samo_fund: "96",
    };
    assert.equal(
      parseKiwoomRows([wrong], metric, "2026-10-04T00:00:00Z", "real", "KRX").observations[0]
        ?.value,
      null,
    );
    const field = metric === "credit" ? "remn_rt" : metric === "foreign" ? "wght" : "invtrt";
    for (const input of ["", "-", "N/A", undefined, null, "1x", "1e3"])
      assert.equal(
        parseKiwoomRows(
          [{ ...wrong, [field]: input }],
          metric,
          "2026-10-04T00:00:00Z",
          "real",
          "KRX",
        ).observations[0]?.value,
        null,
      );
    assert.equal(
      parseKiwoomRows([{ ...wrong, [field]: "+0" }], metric, "2026-10-04T00:00:00Z", "real", "KRX")
        .observations[0]?.value,
      0,
    );
    assert.equal(
      parseKiwoomRows(
        [{ ...wrong, [field]: metric === "investmentTrust" ? "-1,234" : "+12.34" }],
        metric,
        "2026-10-04T00:00:00Z",
        "real",
        "KRX",
      ).observations[0]?.value,
      metric === "investmentTrust" ? -1234 : 12.34,
    );
  }
  for (const value of ["-0.1", "100.1"])
    assert.equal(
      parseKiwoomRows(
        [{ dt: "20260903", remn_rt: value }],
        "credit",
        "2026-10-04T00:00:00Z",
        "real",
        "KRX",
      ).observations[0]?.value,
      null,
    );
  const row = parseKiwoomRows(
    [{ dt: "20260903", remn_rt: "1", remn: "15" }],
    "credit",
    "2026-10-04T00:00:00Z",
    "real",
    "KRX",
  ).observations[0]!;
  assert.equal(row.dateBasis, "unknown");
  assert.equal(row.availableAt, null);
  assert.equal(row.final, null);
  assert.equal(row.referenceUnit, "백만원 (융자)");
  assert.equal(
    parseKiwoomRows(
      [{ dt: "20260230", wght: "1" }],
      "foreign",
      "2026-10-04T00:00:00Z",
      "real",
      "KRX",
    ).invalidRows,
    1,
  );
});
test("official request bodies, leading zeroes, explicit market suffix and alphanumeric ETF", () => {
  assert.deepEqual(kiwoomConditions(request, "credit"), {
    stk_cd: "005930",
    dt: "20260903",
    qry_tp: "1",
  });
  assert.deepEqual(kiwoomConditions(request, "foreign"), { stk_cd: "005930" });
  assert.deepEqual(kiwoomConditions(request, "investmentTrust"), {
    stk_cd: "005930",
    dt: "20260903",
    amt_qty_tp: "2",
    trde_tp: "0",
    unit_tp: "1",
  });
  assert.equal(kiwoomConditions({ ...request, flowScope: "NXT" }, "foreign").stk_cd, "005930_NX");
  assert.equal(kiwoomConditions({ ...request, flowScope: "SOR" }, "foreign").stk_cd, "005930_AL");
  assert.equal(
    kiwoomConditions({ ...request, code: "0000D0", instrument: "etf" }, "foreign").stk_cd,
    "0000D0",
  );
  assert.throws(() => kiwoomConditions({ ...request, code: "https://example.com" }, "foreign"));
});
test("expiry parsing is explicit KST with strict date and time validation", () => {
  assert.equal(parseKiwoomExpiry("20261004120000"), Date.parse("2026-10-04T03:00:00Z"));
  for (const value of ["20260230090000", "20261004240000", "20261004096000", "2026-10-04", null])
    assert.throws(() => parseKiwoomExpiry(value));
});
test("expired token response and HTTP401 reject without retries or secret leakage", async () => {
  for (const response of [
    ok({
      return_code: 0,
      token: "TEST_EXPIRED_TOKEN",
      token_type: "bearer",
      expires_dt: "20000101090000",
    }),
    new Response("must not expose provider authentication text", { status: 401 }),
  ]) {
    let calls = 0;
    const client = createKiwoomClient(
      { ...config, appKey: "expired-key-" + ++serial },
      quickStore(),
      {
        fetch: async () => {
          calls++;
          return response;
        },
      },
    );
    await assert.rejects(
      client.authenticate(),
      (error: unknown) =>
        error instanceof KiwoomError &&
        error.health === "TOKEN_FAILED" &&
        !error.message.includes("TEST_EXPIRED_TOKEN"),
    );
    assert.equal(calls, 1);
  }
});
test("token expiry safety margin refreshes the cached token before actual KST expiry", async () => {
  let current = Date.UTC(2026, 8, 3, 1, 0, 0); // KST 10:00
  let calls = 0;
  const client = createKiwoomClient({ ...config, appKey: "clock-key-" + ++serial }, quickStore(), {
    now: () => current,
    fetch: async () => {
      calls++;
      return ok({
        return_code: 0,
        token: `TEST_REFRESH_${calls}`,
        token_type: "bearer",
        expires_dt: calls === 1 ? "20260903100200" : "20260904100200",
      });
    },
  });
  assert.equal(await client.authenticate(), "TEST_REFRESH_1");
  assert.equal(await client.authenticate(), "TEST_REFRESH_1");
  current += 61000;
  assert.equal(await client.authenticate(), "TEST_REFRESH_2");
  assert.equal(calls, 2);
});
test("authentication single-flight across clients, encrypted cache, detached caller cancellation and reuse", async () => {
  const cfg = { ...config, appKey: "auth-" + ++serial };
  let issued = 0;
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(String(url), "https://api.kiwoom.com/oauth2/token");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      grant_type: "client_credentials",
      appkey: cfg.appKey,
      secretkey: cfg.appSecret,
    });
    issued++;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return auth();
  };
  const clientA = createKiwoomClient(cfg, quickStore(), { fetch: fetcher });
  const clientB = createKiwoomClient(cfg, quickStore(), { fetch: fetcher });
  const abort = new AbortController();
  const cancelled = clientA.authenticate(abort.signal);
  const retained = clientA.authenticate();
  const other = clientB.authenticate();
  abort.abort();
  await assert.rejects(cancelled, { name: "AbortError" });
  assert.equal(await retained, "fixture-bearer-token");
  await other;
  assert.equal(issued, 1);
  await clientA.authenticate();
  assert.equal(issued, 1);
  const encrypted = await store.readToken(`${kiwoomCredentialKey(cfg)}:${cfg.expectedEgressIp}`);
  assert.ok(encrypted);
  assert.equal(encrypted.encrypted.includes("fixture-bearer-token"), false);
});
test("HTTP200 business/auth/missing-status errors are not success; provider messages are redacted", async () => {
  for (const code of [8001, 8010, 1700]) {
    const cfg = { ...config, appKey: "error-" + ++serial };
    let calls = 0;
    const client = createKiwoomClient(cfg, quickStore(), {
      fetch: async () => {
        calls++;
        return ok({
          return_code: code,
          return_msg: "secret " + cfg.appSecret + " token fixture-bearer-token",
        });
      },
      retryBaseMs: 0,
      random: () => 0,
    });
    await assert.rejects(
      client.authenticate(),
      (error: unknown) =>
        error instanceof KiwoomError &&
        error.code === code &&
        !error.message.includes(cfg.appSecret!),
    );
    assert.equal(calls, code === 1700 ? 3 : 1);
  }
  for (const body of [
    { token: "x", expires_dt: "20300101090000", token_type: "bearer" },
    { return_code: 0, token: "x", expires_dt: "20300101090000" },
    { return_code: 0, token: "", expires_dt: "20300101090000", token_type: "bearer" },
  ]) {
    const client = createKiwoomClient({ ...config, appKey: "schema-" + ++serial }, quickStore(), {
      fetch: async () => ok(body),
    });
    await assert.rejects(client.authenticate());
  }
});
test("token invalid 8005 recovers once; mode/IP ambiguity does not trigger auth loops", async () => {
  for (const code of [8005, 8031, 8103]) {
    let tokens = 0,
      pages = 0;
    const cfg = { ...config, appKey: "refresh-" + ++serial };
    const client = createKiwoomClient(cfg, quickStore(), {
      fetch: async (url) => {
        if (String(url).endsWith("/token")) {
          tokens++;
          return auth();
        }
        pages++;
        return ok(
          pages === 1
            ? { return_code: 3, return_msg: `[${code}:...]` }
            : { return_code: 0, stk_frgnr: [] },
        );
      },
    });
    if (code === 8005)
      await client.page("ka10008", { stk_cd: "005930" }, new AbortController().signal);
    else
      await assert.rejects(
        client.page("ka10008", { stk_cd: "005930" }, new AbortController().signal),
      );
    assert.equal(tokens, code === 8005 ? 2 : 1);
    assert.equal(pages, code === 8005 ? 2 : 1);
  }
});
test("HTTP429 Retry-After and 5xx retries share admission; excessive wait ends bounded work", async () => {
  const cfg = { ...config, appKey: "retry-" + ++serial };
  let calls = 0,
    admissions = 0;
  const client = createKiwoomClient(
    cfg,
    {
      ...store,
      admit: async () => {
        admissions++;
      },
    },
    {
      fetch: async () => {
        calls++;
        return calls === 1
          ? new Response("", { status: 429, headers: { "retry-after": "0.01" } })
          : calls === 2
            ? new Response("", { status: 503 })
            : auth();
      },
      retryBaseMs: 0,
      random: () => 0,
    },
  );
  await client.authenticate();
  assert.equal(calls, 3);
  assert.equal(admissions, 3);
  let excessive = 0;
  const long = createKiwoomClient({ ...cfg, appKey: "long-" + ++serial }, quickStore(), {
    fetch: async () => {
      excessive++;
      return new Response("", { status: 429, headers: { "retry-after": "60" } });
    },
  });
  await assert.rejects(long.authenticate());
  assert.equal(excessive, 1);
});
test("timeouts retry boundedly and never print request bodies", async () => {
  let calls = 0;
  const client = createKiwoomClient({ ...config, appKey: "timeout-" + ++serial }, quickStore(), {
    fetch: async () => {
      calls++;
      throw new DOMException("fixture", "TimeoutError");
    },
    retryBaseMs: 0,
    random: () => 0,
  });
  await assert.rejects(
    client.authenticate(),
    (error: unknown) => error instanceof KiwoomError && error.status === "timeout",
  );
  assert.equal(calls, 3);
});
test("shared DB rate limiter serializes independent instances and releases cancelled waiters", async () => {
  const a = createKiwoomStore(sqlFor(pg)),
    b = createKiwoomStore(sqlFor(pg));
  const key = "rate-test-" + ++serial;
  const times: number[] = [];
  await Promise.all(
    [a, b, a, b].map(async (s) => {
      await s.admit(key, 40, new AbortController().signal);
      times.push(Date.now());
    }),
  );
  times.sort((x, y) => x - y);
  for (let i = 1; i < times.length; i++) assert.ok(times[i]! - times[i - 1]! >= 30);
  const controller = new AbortController();
  const wait = a.admit(key, 1000, controller.signal);
  controller.abort();
  await assert.rejects(wait, { name: "AbortError" });
});
test("two pages use real headers, deduplicate dates and persist raw signed quantities", async () => {
  const id = identity();
  let page = 0;
  const client = createKiwoomClient({ ...config, appKey: "pages-" + ++serial }, quickStore(), {
    fetch: async (url, init) => {
      if (String(url).endsWith("/token")) return auth();
      page++;
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("api-id"), "ka10059");
      if (page === 1) {
        assert.equal(headers.get("cont-yn"), "N");
        return ok(
          {
            return_code: 0,
            stk_invsr_orgn: [
              { dt: "20260903", invtrt: "60" },
              { dt: "20260902", invtrt: "-40" },
            ],
          },
          { "cont-yn": "Y", "next-key": "fixture-next" },
        );
      }
      assert.equal(headers.get("cont-yn"), "Y");
      assert.equal(headers.get("next-key"), "fixture-next");
      return ok({
        return_code: 0,
        stk_invsr_orgn: [
          { dt: "20260902", invtrt: "-40" },
          { dt: "20260901", invtrt: "100" },
        ],
      });
    },
  });
  const job = await collectKiwoomMetric(store, client, id, "investmentTrust");
  assert.equal(job.pages, 2);
  assert.equal(job.complete, true);
  assert.equal(job.stopReason, "requested-start-reached");
  const rows = await store.read(id, "investmentTrust");
  assert.deepEqual(
    rows.map((r) => r.value),
    [100, -40, 60],
  );
  assert.deepEqual(job.missingDates, []);
  const response = emptyChartFlow(request);
  response.investmentTrust = {
    ...response.investmentTrust,
    observations: rows,
    capability: "available",
  };
  assert.deepEqual(
    alignChartFlow(response, {
      dates: request.expectedDailyDates!,
      interval: "day",
      cumulativeStart: request.from,
      investmentTrustMode: "cumulative",
    }).investmentTrust.points.map((p) => p.value),
    [100, 60, 120],
  );
});
test("page budget persists cursor; resumed work reaches old history without fabricated offsets", async () => {
  const id = identity();
  let page = 0;
  const client = createKiwoomClient({ ...config, appKey: "resume-" + ++serial }, quickStore(), {
    fetch: async (url, init) => {
      if (String(url).endsWith("/token")) return auth();
      page++;
      assert.deepEqual(JSON.parse(String(init?.body)), { stk_cd: "005930" });
      return page === 1
        ? ok(
            { return_code: 0, stk_frgnr: fixtureRows("foreign") },
            { "cont-yn": "Y", "next-key": "resume-key" },
          )
        : ok({ return_code: 0, stk_frgnr: fixtureRows("foreign", "20260901") });
    },
  });
  const first = await collectKiwoomMetric(store, client, id, "foreign", { maxPages: 1 });
  assert.equal(first.complete, false);
  assert.equal(first.stopReason, "page-budget");
  assert.equal(first.nextKey, "resume-key");
  const second = await collectKiwoomMetric(store, client, id, "foreign", {
    maxPages: 1,
    resume: true,
  });
  assert.equal(second.complete, true);
  assert.equal(second.pages, 2);
  assert.equal((await store.read(id, "foreign")).length, 2);
});
test("repeated cursor/page, empty page and absent next key stop with partial diagnostics", async () => {
  for (const scenario of ["cursor", "page", "empty", "missing-next"] as const) {
    const id = identity();
    let page = 0;
    const client = createKiwoomClient({ ...config, appKey: "loop-" + ++serial }, quickStore(), {
      fetch: async (url) => {
        if (String(url).endsWith("/token")) return auth();
        page++;
        const date = page === 1 || scenario === "page" ? "20260903" : "20260902";
        const rows = scenario === "empty" ? [] : fixtureRows("credit", date);
        return ok(
          { return_code: 0, crd_trde_trend: rows },
          { "cont-yn": "Y", ...(scenario === "missing-next" ? {} : { "next-key": "same" }) },
        );
      },
    });
    const job = await collectKiwoomMetric(store, client, id, "credit");
    assert.equal(job.complete, false);
    assert.ok(
      ["repeated-cursor", "no-older-progress", "empty-page", "missing-next-key"].includes(
        job.stopReason,
      ),
    );
    assert.ok(page <= 2);
  }
});
test("time budget retains acquired data and resume state", async () => {
  const id = identity();
  const client = createKiwoomClient({ ...config, appKey: "budget-" + ++serial }, quickStore(), {
    fetch: async (url, init) => {
      if (String(url).endsWith("/token")) return auth();
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => resolve(ok({ return_code: 0, crd_trde_trend: [] })), 200);
        init?.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new DOMException("abort", "AbortError"));
          },
          { once: true },
        );
      });
    },
  });
  const job = await collectKiwoomMetric(store, client, id, "credit", { budgetMs: 50 });
  assert.equal(job.complete, false);
  assert.equal(job.stopReason, "time-budget");
});
test("upserts correct raw values, invalid updates retain good data; user/env/market/product keys separate", async () => {
  const id = identity();
  const make = (value: string, when: string) =>
    parseKiwoomRows(
      fixtureRows("investmentTrust", "20260901", value),
      "investmentTrust",
      when,
      "real",
      "KRX",
    ).observations;
  await store.upsert(id, "investmentTrust", make("100", "2026-10-04T00:00:00Z"));
  await store.upsert(id, "investmentTrust", make("120", "2026-10-04T01:00:00Z"));
  await store.upsert(id, "investmentTrust", make("-", "2026-10-04T02:00:00Z"));
  assert.equal((await store.read(id, "investmentTrust"))[0]?.value, 120);
  for (const other of [
    { ...id, scopeId: "other" },
    { ...id, environment: "mock" as const },
    { ...id, request: { ...request, flowScope: "NXT" as const } },
    { ...id, request: { ...request, instrument: "etf" as const } },
  ])
    assert.equal((await store.read(other, "investmentTrust")).length, 0);
  assert.notEqual(flowRequestKey(request), flowRequestKey({ ...request, flowScope: "NXT" }));
});
test("stored history survives closing/reopening an independent persistent test backend", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kiwoom-test-"));
  let disk = new PGlite(dir);
  await disk.waitReady;
  await disk.exec(schema);
  const id = identity();
  await createKiwoomStore(sqlFor(disk)).upsert(
    id,
    "foreign",
    parseKiwoomRows(fixtureRows("foreign"), "foreign", "2026-10-04T00:00:00Z", "real", "KRX")
      .observations,
  );
  await disk.close();
  disk = new PGlite(dir);
  await disk.waitReady;
  assert.equal((await createKiwoomStore(sqlFor(disk)).read(id, "foreign"))[0]?.value, 10);
  await disk.close();
  await rm(dir, { recursive: true, force: true });
});
test("collector reads existing history without keys, IP probes or client creation; unauthorized reads denied", async () => {
  const id = {
    scopeId: config.ownerUserId!,
    environment: "real" as const,
    request: { ...request, code: "403870" },
  };
  await store.upsert(
    id,
    "foreign",
    parseKiwoomRows(fixtureRows("foreign"), "foreign", "2026-10-04T00:00:00Z", "real", "KRX")
      .observations,
  );
  let clients = 0;
  const service = createChartFlowService({
    config: () => ({ ...config, mode: "collector", appKey: undefined, appSecret: undefined }),
    store: async () => store,
    client: () => {
      clients++;
      throw Error("no API");
    },
    checkEgress: async () => {
      throw Error("no IP check");
    },
  });
  const response = await service(id.request, undefined, config.ownerUserId);
  assert.equal(response.foreign.observations[0]?.value, 10);
  assert.equal(clients, 0);
  const unauthorized = await service(id.request, undefined, null);
  assert.equal(unauthorized.foreign.status, "access");
  assert.equal(unauthorized.foreign.observations.length, 0);
  assert.throws(() => assertKiwoomOwner(config, "unrelated"));
  assert.equal(JSON.stringify(response).includes("fixture-secret"), false);
});
test("direct access blocks API when IP mismatches; failed metric preserves other successes and price is independent", async () => {
  let calls = 0;
  const blocked = createChartFlowService({
    config: () => config,
    store: async () => store,
    checkEgress: async () => ({ status: "IP_MISMATCH", observedIp: "192.0.2.2" }),
    client: () => {
      calls++;
      throw Error("no call");
    },
  });
  const response = await blocked(request, undefined, config.ownerUserId);
  assert.equal(response.credit.status, "ip-check");
  assert.equal(calls, 0);
  const enabled = createChartFlowService({
    config: () => ({ ...config, appKey: "direct-" + ++serial }),
    store: async () => store,
    checkEgress: async () => ({ status: "IP_MATCH", observedIp: "192.0.2.1" }),
    client: (cfg, s) =>
      createKiwoomClient(cfg, quickStore(s), {
        fetch: async (url, init) => {
          if (String(url).endsWith("/token")) return auth();
          const api = new Headers(init?.headers).get("api-id");
          if (api === "ka10013") return ok({ return_code: 8001 });
          const metric = api === "ka10008" ? "foreign" : "investmentTrust";
          return ok({ return_code: 0, [arrayName(metric)]: fixtureRows(metric, "20260901") });
        },
      }),
  });
  const output = await enabled(request, undefined, config.ownerUserId);
  assert.equal(output.credit.status, "authentication");
  assert.equal(output.foreign.observations.length, 1);
  assert.equal(output.investmentTrust.observations.length, 1);
});

test("real/mock token namespaces and safe result metadata do not mix", async () => {
  const cfg = { ...config, appKey: "environments-" + ++serial };
  const hosts: string[] = [];
  const fetcher: typeof fetch = async (url) => {
    hosts.push(String(url));
    return auth();
  };
  await createKiwoomClient(cfg, quickStore(), { fetch: fetcher }).authenticate();
  await createKiwoomClient({ ...cfg, environment: "mock" }, quickStore(), {
    fetch: fetcher,
  }).authenticate();
  assert.deepEqual(hosts, [
    "https://api.kiwoom.com/oauth2/token",
    "https://mockapi.kiwoom.com/oauth2/token",
  ]);
  const rows = parseKiwoomRows(
    fixtureRows("foreign"),
    "foreign",
    "2026-10-04T00:00:00Z",
    "mock",
    "KRX",
  ).observations;
  assert.equal(rows[0]?.environment, "mock");
  assert.match(rows[0]!.source, /모의/);
});
test("a wider requested history collects immediately and an IP change creates a separate client", async () => {
  const id = identity();
  const cfg = { ...config, ownerUserId: id.scopeId, appKey: "wider-history-" + ++serial };
  const clientIps: Array<string | undefined> = [];
  let pages = 0;
  const service = createChartFlowService({
    config: () => ({ ...cfg }),
    store: async () => store,
    checkEgress: async (expected) => ({ status: "IP_MATCH", observedIp: expected ?? null }),
    client: (settings, coordination) => {
      clientIps.push(settings.expectedEgressIp);
      return createKiwoomClient(settings, quickStore(coordination), {
        fetch: async (url, init) => {
          if (String(url).endsWith("/token")) return auth();
          pages++;
          const apiId = new Headers(init?.headers).get("api-id");
          const metric =
            apiId === "ka10013" ? "credit" : apiId === "ka10008" ? "foreign" : "investmentTrust";
          return ok({
            return_code: 0,
            [arrayName(metric)]: [
              ...fixtureRows(metric, "20260903"),
              ...fixtureRows(metric, "20260901"),
            ],
          });
        },
      });
    },
  });
  await service(
    { ...request, from: "2026-09-03", expectedDailyDates: ["2026-09-03"] },
    undefined,
    id.scopeId,
  );
  assert.equal(pages, 3);
  const wider = await service(request, undefined, id.scopeId);
  assert.equal(pages, 6);
  assert.equal(wider.foreign.providedFrom, "2026-09-01");
  cfg.expectedEgressIp = "192.0.2.2";
  await service({ ...request, to: "2026-09-04" }, undefined, id.scopeId);
  assert.deepEqual(clientIps, ["192.0.2.1", "192.0.2.2"]);
});
test("resume dates remain exchange date labels with Korean timezone and non-ISO database DateStyle", async () => {
  const id = identity();
  const client = createKiwoomClient({ ...config, appKey: "date-label-" + ++serial }, quickStore(), {
    fetch: async (url) =>
      String(url).endsWith("/token")
        ? auth()
        : ok({ return_code: 0, stk_frgnr: fixtureRows("foreign", "20260901") }),
  });
  await collectKiwoomMetric(store, client, id, "foreign");
  try {
    await pg.exec("set timezone='Asia/Seoul'; set datestyle='SQL, DMY'");
    const job = await store.job(id, "foreign", true);
    assert.equal(job?.requestedFrom, request.from);
    assert.equal(job?.requestedTo, request.to);
  } finally {
    await pg.exec("set timezone='UTC'; set datestyle='ISO, MDY'");
  }
});
test("rejected resume cursor restarts once with official body and deduplicates already saved rows", async () => {
  const id = identity();
  let page = 0;
  const cfg = { ...config, appKey: "cursor-reset-" + ++serial };
  const client = createKiwoomClient(cfg, quickStore(), {
    fetch: async (url, init) => {
      if (String(url).endsWith("/token")) return auth();
      page++;
      const headers = new Headers(init?.headers);
      if (page === 1)
        return ok(
          { return_code: 0, stk_frgnr: fixtureRows("foreign") },
          { "cont-yn": "Y", "next-key": "expired-key" },
        );
      if (page === 2) {
        assert.equal(headers.get("next-key"), "expired-key");
        return ok({ return_code: 1517 });
      }
      assert.equal(headers.get("cont-yn"), "N");
      return ok({
        return_code: 0,
        stk_frgnr: [...fixtureRows("foreign"), ...fixtureRows("foreign", "20260901")],
      });
    },
  });
  await collectKiwoomMetric(store, client, id, "foreign", { maxPages: 1 });
  const job = await collectKiwoomMetric(store, client, id, "foreign", {
    maxPages: 3,
    resume: true,
  });
  assert.equal(job.complete, true);
  assert.equal((await store.read(id, "foreign")).length, 2);
  assert.equal(page, 3);
});
test("empty ETF responses and malformed grouping remain unknown/partial, never unsupported or zero", async () => {
  for (const value of ["1,,234", "12,34", "1,234%"])
    assert.equal(
      parseKiwoomRows(
        [{ dt: "20260903", invtrt: value }],
        "investmentTrust",
        "2026-10-04T00:00:00Z",
        "real",
        "KRX",
      ).observations[0]?.value,
      null,
    );
  const cfg = { ...config, appKey: "empty-etf-" + ++serial };
  const service = createChartFlowService({
    config: () => cfg,
    store: async () => store,
    checkEgress: async () => ({ status: "IP_MATCH", observedIp: "192.0.2.1" }),
    client: (c, s) =>
      createKiwoomClient(c, quickStore(s), {
        fetch: async (url, init) =>
          String(url).endsWith("/token")
            ? auth()
            : ok({
                return_code: 0,
                [new Headers(init?.headers).get("api-id") === "ka10013"
                  ? "crd_trde_trend"
                  : new Headers(init?.headers).get("api-id") === "ka10008"
                    ? "stk_frgnr"
                    : "stk_invsr_orgn"]: [],
              }),
      }),
  });
  const response = await service(
    { ...request, code: "069500", instrument: "etf" },
    undefined,
    cfg.ownerUserId,
  );
  for (const metric of FLOW_METRICS) {
    assert.equal(response[metric].observations.length, 0);
    assert.notEqual(response[metric].capability, "not-supported");
    assert.equal(response[metric].status, "history");
  }
});
