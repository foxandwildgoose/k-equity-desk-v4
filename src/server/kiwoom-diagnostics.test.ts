import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../lib/db.ts";
import { FLOW_METRICS, type FlowRequest } from "../lib/charts/hts-flow.ts";
import type { KiwoomConfig } from "./kiwoom-config.ts";
import { diagnoseKiwoom } from "./kiwoom-diagnostics.ts";
import { parseKiwoomRows } from "./kiwoom-flow.ts";
import { createKiwoomStore } from "./kiwoom-store.ts";

const request: FlowRequest = {
  code: "005930",
  market: "KR",
  instrument: "stock",
  exchange: "KRX",
  currency: "KRW",
  quantityUnit: "주",
  interval: "day",
  flowScope: "KRX",
  from: "2026-09-01",
  to: "2026-09-03",
};
const config: KiwoomConfig = {
  enabled: true,
  mode: "collector",
  environment: "real",
  requestsPerSecond: 2,
  databaseConfigured: true,
  readAuthRequired: false,
  authEnabled: true,
  authenticationReady: true,
  ownerUserId: "fixture-private-owner",
  dataScopeId: "fixture-market-scope",
  appKey: "fixture-private-key",
  appSecret: "fixture-private-secret",
  expectedEgressIp: "192.0.2.15",
};

function rejectOperationalWork() {
  let calls = 0;
  return {
    calls: () => calls,
    options: {
      store: async () => {
        calls++;
        throw new Error("visitor must not open operational DB");
      },
      checkEgress: async () => {
        calls++;
        throw new Error("visitor must not probe external IP");
      },
    },
  };
}

test("public collector reports configured read access, not owner failure or uninspected history", async () => {
  for (const verifiedUserId of [null, "another-user", "dev-user"]) {
    const guard = rejectOperationalWork();
    const result = await diagnoseKiwoom(config, request, verifiedUserId, guard.options);
    assert.equal(result.status, "PUBLIC_READ_CONFIGURED");
    assert.equal(result.marketReadAccess, "PUBLIC_READ_ALLOWED");
    assert.equal(result.operationalDetailsAccess, "OWNER_LOGIN_REQUIRED");
    assert.equal(result.ownerAuthorized, false);
    assert.equal(result.ownerAuthorizationRequired, false);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.metrics, {});
    assert.deepEqual(result.latestStored, { credit: null, foreign: null, investmentTrust: null });
    assert.equal(result.schema, null);
    assert.equal(result.databaseConnected, false);
    assert.equal(result.schemaReady, false);
    assert.equal(result.tokenStatus, "NOT_REQUIRED");
    assert.equal(result.egressStatus, "NOT_REQUIRED");
    assert.equal(guard.calls(), 0);
    for (const secret of [config.appKey, config.appSecret, config.ownerUserId, config.expectedEgressIp, config.dataScopeId]) {
      assert.equal(JSON.stringify(result).includes(secret!), false);
    }
    assert.equal("request" in result, false);
  }
});

test("public collector needs neither owner login nor web broker credentials when auth is disabled", async () => {
  const guard = rejectOperationalWork();
  const result = await diagnoseKiwoom({ ...config, authEnabled: false, authenticationReady: false,
    ownerUserId: undefined, appKey: undefined, appSecret: undefined, expectedEgressIp: undefined },
  request, null, guard.options);
  assert.equal(result.status, "PUBLIC_READ_CONFIGURED");
  assert.equal(result.marketReadAccess, "PUBLIC_READ_ALLOWED");
  assert.equal(result.operationalDetailsAccess, "OWNER_LOGIN_REQUIRED");
  assert.equal(result.credentialsRequired, false);
  assert.deepEqual(result.issues, []);
  assert.equal(guard.calls(), 0);
});

test("public configuration failures remain actionable without a false owner-read error", async () => {
  for (const [patch, expected] of [
    [{ enabled: false }, "DISABLED"],
    [{ databaseConfigured: false }, "DATABASE_MISSING"],
    [{ deploymentRevision: "aaaaaaa", expectedRevision: "bbbbbbb" }, "DEPLOYMENT_REVISION_MISMATCH"],
  ] as const) {
    const guard = rejectOperationalWork();
    const result = await diagnoseKiwoom({ ...config, ...patch }, request, null, guard.options);
    assert.equal(result.status, expected);
    assert.equal(result.marketReadAccess, "PUBLIC_READ_ALLOWED");
    assert.equal(result.issues.includes("OWNER_AUTH_FAILED"), false);
    assert.equal(guard.calls(), 0);
  }
});

test("private collector and direct diagnostics preserve real owner authorization before any operation", async () => {
  for (const mode of ["collector", "direct"] as const) {
    for (const verifiedUserId of [null, "another-user", "dev-user"]) {
      const guard = rejectOperationalWork();
      const result = await diagnoseKiwoom({ ...config, mode, readAuthRequired: true }, request,
        verifiedUserId, guard.options);
      assert.equal(result.status, "OWNER_AUTH_FAILED");
      assert.equal(result.marketReadAccess, "OWNER_LOGIN_REQUIRED");
      assert.equal(result.operationalDetailsAccess, "OWNER_LOGIN_REQUIRED");
      assert.equal(result.ownerAuthorized, false);
      assert.equal(result.ownerAuthorizationRequired, true);
      assert.deepEqual(result.metrics, {});
      assert.equal(guard.calls(), 0);
    }
  }
  for (const patch of [{ authEnabled: false }, { authenticationReady: false }]) {
    const guard = rejectOperationalWork();
    const result = await diagnoseKiwoom({ ...config, mode: "direct", ...patch }, request,
      config.ownerUserId!, guard.options);
    assert.equal(result.status, "OWNER_AUTH_FAILED");
    assert.equal(guard.calls(), 0);
  }
});

test("verified owner sees stored metrics through read-only diagnostics; visitors never see those rows", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  try {
    for (const name of ["0002_kiwoom_flow.sql", "0003_kiwoom_collection_targets.sql"]) {
      await pg.exec(await readFile(new URL(`../../migrations/${name}`, import.meta.url), "utf8"));
    }
    const statements: string[] = [];
    const sql: Sql = Object.assign(async () => { throw new Error("unused SQL template path"); }, {
      query: async <T>(text: string, params?: unknown[]) => {
        statements.push(text);
        return (await pg.query<T>(text, params)).rows;
      },
    });
    const store = createKiwoomStore(sql);
    const identity = { scopeId: config.dataScopeId!, environment: "real" as const, request };
    const fetchedAt = "2026-09-03T09:00:00Z";
    for (const metric of FLOW_METRICS) {
      const row = metric === "credit" ? { dt: "20260903", remn_rt: "3.42", remn: "12,345" }
        : metric === "foreign" ? { dt: "20260903", wght: "51.72", poss_stkcnt: "1,234" }
          : { dt: "20260903", invtrt: "-85,000" };
      await store.upsert(identity, metric, parseKiwoomRows([row], metric, fetchedAt, "real", "KRX").observations);
      await store.saveJob(identity, metric, { status: "ready", stopReason: "provider-end", pages: 1, rows: 1,
        invalidRows: 0, oldestDate: "2026-09-03", newestDate: "2026-09-03", nextKey: null,
        complete: true, updatedAt: fetchedAt, lastSuccessAt: fetchedAt, errorCode: null });
    }
    statements.length = 0;
    let opened = 0;
    const options = { store: async () => { opened++; return store; }, checkEgress: async () => {
      throw new Error("collector diagnostic must not probe IP");
    } };
    const owner = await diagnoseKiwoom(config, request, config.ownerUserId!, options);
    assert.equal(owner.status, "READY");
    assert.equal(owner.marketReadAccess, "PUBLIC_READ_ALLOWED");
    assert.equal(owner.operationalDetailsAccess, "OWNER_ALLOWED");
    assert.equal(owner.ownerAuthorized, true);
    assert.equal(owner.databaseConnected, true);
    assert.equal(owner.schemaReady, true);
    for (const metric of FLOW_METRICS) {
      assert.equal(owner.metrics[metric]?.validValues, 1);
      assert.equal(owner.metrics[metric]?.lastDate, "2026-09-03");
      assert.equal(owner.metrics[metric]?.lastSuccessAt, fetchedAt);
      assert.equal(owner.metrics[metric]?.status, "READY");
    }
    assert.equal(statements.length > 0, true);
    assert.equal(statements.every(statement => /^\s*select\b/i.test(statement)), true);
    assert.equal(opened, 1);
    const visitor = await diagnoseKiwoom(config, request, null, options);
    assert.equal(visitor.status, "PUBLIC_READ_CONFIGURED");
    assert.deepEqual(visitor.metrics, {});
    assert.equal(visitor.schema, null);
    assert.equal(opened, 1);
    let ipChecks = 0;
    for (const mode of ["collector", "direct"] as const) {
      const privateOwner = await diagnoseKiwoom({ ...config, mode, readAuthRequired: true }, request,
        config.ownerUserId!, { store: options.store, checkEgress: async () => {
          ipChecks++;
          return { status: "IP_MATCH" as const, observedIp: config.expectedEgressIp! };
        } });
      assert.equal(privateOwner.status, "READY");
      assert.equal(privateOwner.marketReadAccess, "OWNER_READ_ALLOWED");
      assert.equal(privateOwner.operationalDetailsAccess, "OWNER_ALLOWED");
      assert.equal(privateOwner.tokenStatus, mode === "collector" ? "NOT_REQUIRED" : "NOT_TESTED");
      assert.equal(JSON.stringify(privateOwner).includes(config.expectedEgressIp!), false);
    }
    assert.equal(ipChecks, 1);
    assert.equal(opened, 3);
    for (const result of [owner, visitor]) {
      for (const secret of [config.appKey, config.appSecret, config.ownerUserId, config.expectedEgressIp, config.dataScopeId]) {
        assert.equal(JSON.stringify(result).includes(secret!), false);
      }
    }
  } finally {
    await pg.close();
  }
});
