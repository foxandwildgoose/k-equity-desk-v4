#!/usr/bin/env node
// OS-operator CLI. Actual broker operations require --live, real mode, persistent DB and matching egress.
import { readFile } from "node:fs/promises";
import { mergeAppEnv, readAppEnv, projectRoot } from "./with-app-env.mjs";
import { readKiwoomConfig, checkKiwoomEgress, kiwoomDataScope, KiwoomError, safeKiwoomError, credentialsStatus } from "../src/server/kiwoom-config.ts";
import { diagnoseKiwoomRuntime } from "../src/server/kiwoom-runtime.ts";
import { openKiwoomDatabase } from "../src/server/kiwoom-db.ts";
import { createKiwoomClient, KIWOOM_APIS, kiwoomCredentialKey } from "../src/server/kiwoom-client.ts";
import { collectKiwoomMetric, kiwoomConditions, parseKiwoomRows } from "../src/server/kiwoom-flow.ts";
import { FLOW_METRICS, isFlowDate } from "../src/lib/charts/hts-flow.ts";
import { boundKiwoomTarget } from "../src/server/kiwoom-targets.ts";
import { crossCheckKiwoom } from "../src/server/kiwoom-cross-check.ts";
import { validateFlowRequest } from "../src/server/chart-flow-request.ts";

const emit = value => process.stdout.write(JSON.stringify(value, null, 2) + "\n");
const argv = process.argv.slice(2);
const command = argv.shift();
const switches = new Set(["--check-config", "--live", "--single-process", "--resume", "--incremental", "--read-stored", "--check-database", "--cross-check", "--targets", "--show-ip"]);
const values = new Set(["--code", "--from", "--to", "--instrument", "--scope", "--max-pages", "--budget-ms", "--calendar", "--limit"]);
const args = new Map();
let database;
try {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (args.has(arg) || (!switches.has(arg) && !values.has(arg))) throw new KiwoomError("configuration", "Invalid CLI option");
    if (switches.has(arg)) args.set(arg, true);
    else {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new KiwoomError("configuration", "Missing CLI argument");
      args.set(arg, value);
    }
  }
  if (!["doctor", "egress", "verify", "sync", "migrate-scope"].includes(command))
    throw new KiwoomError("configuration", "Command must be doctor, egress, verify, sync or migrate-scope");
  // Identical precedence even when CLI is invoked directly rather than via npm.
  const config = readKiwoomConfig(mergeAppEnv(readAppEnv(projectRoot()), process.env));
  if (args.has("--cross-check") && (command !== "verify" || !args.has("--live") || args.has("--read-stored") || args.has("--check-config") || args.has("--check-database")))
    throw new KiwoomError("configuration", "Cross-check requires verify --live; diagnostic only");
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
  const request = validateFlowRequest({
    code: args.get("--code") ?? "005930", market: "KR",
    instrument: args.get("--instrument") ?? "stock", exchange: "KRX", currency: "KRW", quantityUnit: "주",
    interval: "day", flowScope: args.get("--scope") ?? "KRX",
    from: args.get("--from") ?? new Date(Date.parse(today) - 366 * 86400000).toISOString().slice(0, 10),
    to: args.get("--to") ?? today,
  });
  const getStore = async () => {
    database ??= await openKiwoomDatabase();
    return database.store;
  };
  const doctor = () => diagnoseKiwoomRuntime(config, request, { inspectOperational: true, store: getStore });
  if (command === "egress") {
    // Only this explicit local flag may show an address; never used in web payloads.
    const ip = await checkKiwoomEgress(config.expectedEgressIp);
    emit({ egressStatus: ip.status, ...(args.has("--show-ip") ? { observedIp: ip.observedIp } : {}) });
    if (ip.status !== "IP_MATCH") process.exitCode = 1;
  } else if (command === "doctor" || args.has("--check-config") || args.has("--check-database") ||
      (command === "verify" && !args.has("--live") && !args.has("--read-stored"))) {
    const result = args.has("--check-config")
      ? { ...await diagnoseKiwoomRuntime(config, request), credentialsStatus: credentialsStatus(config), authentication: "NOT_TESTED", egress: "NOT_CHECKED" }
      : await doctor();
    emit(result);
    if (!args.has("--check-config") && (result.status === "DEPLOYMENT_REVISION_MISMATCH" || !result.flowEnabled || !result.databaseConnected || !result.schemaReady ||
        (config.mode === "direct" && (!result.appKeyConfigured || !result.appSecretConfigured || result.egressStatus !== "IP_MATCH")))
      ) process.exitCode = 1;
  } else {
    if (command !== "migrate-scope" && !args.has("--read-stored")) {
      if (!args.has("--live")) throw new KiwoomError("configuration", "Broker operation requires explicit --live");
      if (!config.enabled) throw new KiwoomError("disabled", "KIWOOM_FLOW_ENABLED=true required");
      if (credentialsStatus(config) !== "CREDENTIALS_CONFIGURED")
        throw new KiwoomError("configuration", "Collector credentials missing", null, 0, "CREDENTIALS_MISSING");
      if (config.mode !== "direct" || config.environment !== "real") throw new KiwoomError("configuration", "Collector requires direct/real");
    }
    const store = await getStore();
    if (!(await store.schema()).ready) throw new KiwoomError("storage", "Run npm run db:migrate explicitly", null, 0, "DATABASE_SCHEMA_MISSING");
    const identity = { scopeId: kiwoomDataScope(config), environment: config.environment, request };
    if (command === "migrate-scope") {
      if (!config.legacyDataScopeId) throw new KiwoomError("configuration", "Set server-only KIWOOM_LEGACY_DATA_SCOPE_ID for additive copy");
      const rowsCopied = await store.copyLegacyScope(config.legacyDataScopeId, identity.scopeId, identity.environment);
      emit({ status: "SCOPE_COPY_COMPLETE", rowsCopied, existingRowsRetained: true, cursorsCopied: false });
    } else if (args.has("--read-stored")) {
      for (const metric of FLOW_METRICS) {
        const rows = await store.read(identity, metric);
        const valid = rows.filter(row => row.value !== null);
        emit({ metric, rows: rows.length, validValues: valid.length, firstDate: valid[0]?.date ?? null,
          lastDate: valid.at(-1)?.date ?? null,
          status: !valid.length && await store.hasOtherScope(identity, metric) ? "DATA_SCOPE_MISMATCH" : valid.length ? "STORED" : "NO_HISTORY",
          providerReal: valid.length > 0 && valid.every(row => row.provider === "kiwoom" && row.environment === "real" && !row.derived) });
        if (!valid.length) process.exitCode = 1;
      }
    } else {
      if (!args.has("--live") || !config.enabled || config.mode !== "direct" || config.environment !== "real")
        throw new KiwoomError("configuration", "Broker operations require --live, enabled, direct and real");
      const readiness = await doctor();
      emit(readiness);
      if (!readiness.databaseConnected || !readiness.schemaReady || !readiness.appKeyConfigured || !readiness.appSecretConfigured ||
          readiness.egressStatus !== "IP_MATCH")
        throw new KiwoomError("configuration", "Collector runtime gate failed; inspect safe doctor statuses");
      if (args.has("--cross-check") && command !== "verify") throw new KiwoomError("configuration", "ka10015 is verify-only");
      if (command === "verify" && request.code !== "005930") throw new KiwoomError("configuration", "First page verification requires 005930");
      const maxPages = Number(args.get("--max-pages") ?? 25);
      const budgetMs = Number(args.get("--budget-ms") ?? 45000);
      const limit = Number(args.get("--limit") ?? 10);
      if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 200 || !Number.isFinite(budgetMs) ||
          budgetMs < 50 || budgetMs > 240000 || !Number.isInteger(limit) || limit < 1 || limit > 10)
        throw new KiwoomError("configuration", "Invalid bounded collection budget");
      if (args.has("--calendar")) {
        const parsed = JSON.parse(await readFile(args.get("--calendar"), "utf8"));
        if (!Array.isArray(parsed) || parsed.length > 8000 || parsed.some(date => typeof date !== "string" || !isFlowDate(date)))
          throw new KiwoomError("configuration", "Calendar must contain observed daily price dates");
        request.expectedDailyDates = [...new Set(parsed)].filter(date => date >= request.from && date <= request.to).sort();
      }
      // Database lease protects scheduled/manual CLI instances across machines; heartbeats handle long work.
      await store.exclusive("collector-run:" + kiwoomCredentialKey(config), async signal => {
        const client = createKiwoomClient(config, store);
        await client.authenticate(signal);
        emit({ authentication: "TOKEN_OK", environment: "real" });
        const primary = { credit: [], foreign: [] };
        if (command === "verify") {
          for (const metric of FLOW_METRICS) {
            try {
              const page = await client.page(KIWOOM_APIS[metric].id, kiwoomConditions(request, metric), signal);
              const rows = page.body[KIWOOM_APIS[metric].array];
              if (!Array.isArray(rows)) throw new KiwoomError("parsing", "Required response array missing");
              const parsed = parseKiwoomRows(rows, metric, new Date().toISOString(), "real", request.flowScope);
              const valid = parsed.observations.filter(row => row.value !== null);
              if (metric !== "investmentTrust") primary[metric] = parsed.observations;
              emit({ apiId: KIWOOM_APIS[metric].id, httpSuccess: true, businessSuccess: true,
                rows: rows.length, validValues: valid.length, firstDate: valid[0]?.date ?? null, lastDate: valid.at(-1)?.date ?? null });
              if (!valid.length) process.exitCode = 1;
            } catch (error) {
              const safe = safeKiwoomError(error);
              emit({ apiId: KIWOOM_APIS[metric].id, status: safe.health, errorCode: safe.code });
              process.exitCode = 1;
            }
          }
          if (args.has("--cross-check")) emit(await crossCheckKiwoom(client, request, primary));
          return;
        }
        const processIdentity = async (id, target = false) => {
          if (target) await store.targets.start(id);
          let complete = true, hasValues = true;
          try {
            for (const metric of FLOW_METRICS) {
              const previous = await store.job(id, metric, true);
              let collectionIdentity = id;
              if (args.has("--incremental") && previous?.complete) {
                const existing = await store.read(id, metric);
                const last = existing.filter(row => row.value !== null).at(-1)?.date;
                if (last) {
                  const from = new Date(Date.parse(last) - 14 * 86400000).toISOString().slice(0, 10);
                  collectionIdentity = { ...id, request: { ...id.request, from: from > id.request.from ? from : id.request.from } };
                }
              }
              const job = await collectKiwoomMetric(store, client, collectionIdentity, metric, { maxPages, budgetMs, resume: target || args.has("--resume"), signal });
              const rows = await store.read(id, metric);
              const valid = rows.filter(row => row.value !== null);
              complete &&= job.complete && ["ready", "history"].includes(job.status) && valid.length > 0;
              hasValues &&= valid.length > 0;
              emit({ metric, apiId: KIWOOM_APIS[metric].id, code: id.request.code, rows: rows.length, validValues: valid.length,
                firstDate: valid[0]?.date ?? null, lastDate: valid.at(-1)?.date ?? null,
                status: job.status, complete: job.complete, pages: job.pages, errorCode: job.errorCode,
                providerReal: valid.length > 0 && valid.every(row => row.provider === "kiwoom" && row.environment === "real" && !row.derived) });
            }
          } catch (error) { complete = false; hasValues = false; throw error; }
          finally { if (target) await store.targets.finish(id, complete, hasValues); }
          if (!complete) process.exitCode = 1;
        };
        if (args.has("--targets")) {
          await store.exclusive("collector-targets:" + identity.scopeId, async () => {
            const pending = await store.targets.pending(identity.scopeId, config.environment, limit);
            emit({ pendingTargets: pending.length, maxTargetsPerRun: limit });
            for (const target of pending) {
              const bounded = boundKiwoomTarget({ ...request, code: target.code, instrument: target.instrument,
                flowScope: target.marketScope, from: target.requestedFrom, to: target.requestedTo });
              await processIdentity({ ...identity, request: bounded }, true);
            }
          }, signal);
        } else await processIdentity({ ...identity, request: boundKiwoomTarget(request) });
      }, AbortSignal.timeout(30 * 60_000));
    }
  }
} catch (error) {
  const safe = safeKiwoomError(error);
  emit({ status: safe.health, errorCode: safe.code, reason: safe.message });
  process.exitCode = 1;
} finally { await database?.close(); }
