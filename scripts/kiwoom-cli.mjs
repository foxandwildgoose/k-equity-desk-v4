#!/usr/bin/env node
// Local collector CLI. Web diagnostics are read-only; no implicit schema migrations.
import { readFile, open, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  readKiwoomConfig,
  credentialsStatus,
  checkKiwoomEgress,
  KiwoomError,
  safeKiwoomError,
  safeKiwoomConfig,
} from "../src/server/kiwoom-config.ts";
import { createKiwoomClient, KIWOOM_APIS } from "../src/server/kiwoom-client.ts";
import { createKiwoomStore } from "../src/server/kiwoom-store.ts";
import {
  collectKiwoomMetric,
  kiwoomConditions,
  parseKiwoomRows,
} from "../src/server/kiwoom-flow.ts";
import { FLOW_METRICS, isFlowDate } from "../src/lib/charts/hts-flow.ts";
import { crossCheckKiwoom } from "../src/server/kiwoom-cross-check.ts";

const argumentsList = process.argv.slice(2);
const command = argumentsList.shift();
const allowed = new Set([
  "--check-config",
  "--live",
  "--single-process",
  "--code",
  "--from",
  "--to",
  "--instrument",
  "--scope",
  "--max-pages",
  "--budget-ms",
  "--resume",
  "--incremental",
  "--calendar",
  "--read-stored",
  "--check-database",
  "--cross-check",
]);
const switches = new Set([
  "--check-config",
  "--live",
  "--single-process",
  "--resume",
  "--incremental",
  "--read-stored",
  "--check-database",
  "--cross-check",
]);
const args = new Map();
for (let i = 0; i < argumentsList.length; i++) {
  const arg = argumentsList[i];
  if (!allowed.has(arg) || args.has(arg)) throw new Error("Invalid CLI option");
  if (switches.has(arg)) args.set(arg, true);
  else {
    const value = argumentsList[++i];
    if (!value || value.startsWith("--")) throw new Error("Missing CLI argument");
    args.set(arg, value);
  }
}
const emit = (value) => process.stdout.write(JSON.stringify(value, null, 2) + "\n");
let closeLocal = async () => {};
let lockFile;
try {
  const config = readKiwoomConfig();
  const status = credentialsStatus(config);
  if (!["verify", "sync"].includes(command))
    throw new KiwoomError("configuration", "Command must be verify or sync");
  if (
    args.has("--cross-check") &&
    (command !== "verify" ||
      !args.has("--live") ||
      args.has("--check-config") ||
      args.has("--read-stored") ||
      args.has("--check-database"))
  )
    throw new KiwoomError(
      "configuration",
      "Cross-check requires verify --live --single-process; diagnostic only",
    );
  if (args.has("--check-database")) {
    if (!config.databaseConfigured)
      throw new KiwoomError("storage", "Shared DATABASE_URL required", null, 0, "DATABASE_MISSING");
    const { getSql } = await import("../src/lib/db.ts");
    const schema = await createKiwoomStore(await getSql()).schema();
    emit({
      databaseConfigured: true,
      schema,
      status: schema.ready ? "READY" : "DATABASE_SCHEMA_MISSING",
      note: "Read-only schema inspection; no migration or broker request",
    });
    if (!schema.ready) process.exitCode = 1;
  } else if (
    args.has("--check-config") ||
    (command === "verify" && !args.has("--live") && !args.has("--read-stored"))
  ) {
    emit({
      ...safeKiwoomConfig(config),
      credentialsStatus: status,
      authentication: "NOT_TESTED",
      environment: config.environment,
      mode: config.mode,
      enabled: config.enabled,
      expectedEgressConfigured: Boolean(config.expectedEgressIp),
      egress: "NOT_CHECKED",
      databaseConfigured: config.databaseConfigured,
      ownerConfigured: Boolean(config.ownerUserId),
      requestsPerSecond: config.requestsPerSecond,
      note: "No network request or database connection. Credentials configured does not mean authentication succeeded.",
    });
  } else {
    const code = args.get("--code") ?? "005930";
    const from = args.get("--from");
    const to = args.get("--to");
    const instrument = args.get("--instrument") ?? "stock";
    const flowScope = args.get("--scope") ?? "KRX";
    if (
      !/^[0-9A-Z]{6}$/.test(code) ||
      !["stock", "etf", "etn"].includes(instrument) ||
      !["KRX", "NXT", "SOR"].includes(flowScope) ||
      !isFlowDate(from ?? "") ||
      !isFlowDate(to ?? "") ||
      from > to
    )
      throw new KiwoomError(
        "configuration",
        "Specify valid --code --from --to --instrument --scope",
      );
    const request = {
      code,
      market: "KR",
      instrument,
      exchange: "KRX",
      currency: "KRW",
      quantityUnit: "주",
      interval: "day",
      from,
      to,
      flowScope,
    };
    if (
      (!config.ownerUserId || config.ownerUserId === "dev-user") &&
      (command === "sync" || args.has("--read-stored"))
    )
      throw new KiwoomError(
        "access",
        "KIWOOM_OWNER_USER_ID required; local CLI runs under the authorized OS user",
        null,
        0,
        "OWNER_AUTH_FAILED",
      );
    const identity = {
      scopeId: config.ownerUserId ?? "isolated-local-diagnostic",
      environment: config.environment,
      request,
    };
    let store;
    if (args.has("--read-stored")) {
      if (!config.databaseConfigured)
        throw new KiwoomError(
          "storage",
          "Shared DATABASE_URL required; no memory fallback",
          null,
          0,
          "DATABASE_MISSING",
        );
      const { getSql } = await import("../src/lib/db.ts");
      store = createKiwoomStore(await getSql());
      if (!(await store.schema()).ready)
        throw new KiwoomError(
          "storage",
          "Apply existing migrations before reading",
          null,
          0,
          "DATABASE_SCHEMA_MISSING",
        );
      for (const metric of FLOW_METRICS) {
        const storedJob = await store.job(identity, metric);
        const rows = await store.read(identity, metric);
        const valid = rows.filter((row) => row.value !== null);
        emit({
          metric,
          environment: config.environment,
          marketScope: flowScope,
          stored: rows.length > 0,
          rows: rows.length,
          validValues: valid.length,
          from: valid[0]?.date ?? null,
          to: valid.at(-1)?.date ?? null,
          job: storedJob ? { ...storedJob, nextKey: undefined } : null,
        });
      }
    } else {
      if (!args.has("--live"))
        throw new KiwoomError(
          "configuration",
          "Actual collection requires explicit --live; default tests use fixtures only",
        );
      if (!config.enabled) throw new KiwoomError("disabled", "KIWOOM_FLOW_ENABLED=true required");
      if (status !== "CREDENTIALS_CONFIGURED")
        throw new KiwoomError("configuration", status, null, 0, "CREDENTIALS_MISSING");
      if (config.environment !== "real")
        throw new KiwoomError(
          "configuration",
          "--live verification is real only; mock is not real data evidence",
        );
      const ip = await checkKiwoomEgress(config.expectedEgressIp);
      emit({
        credentialsStatus: status,
        egress: ip.status,
        authentication: "NOT_TESTED",
      });
      if (ip.status !== "IP_MATCH")
        throw new KiwoomError("ip-check", ip.status, null, 0, ip.status);
      // Prevent concurrent local CLI runs. Never remove a lock blindly after a crash.
      lockFile = join(
        tmpdir(),
        "ked-kiwoom-" +
          createHash("sha256")
            .update(config.environment + "\0" + config.appKey)
            .digest("hex") +
          ".lock",
      );
      try {
        const handle = await open(lockFile, "wx", 0o600);
        await handle.writeFile(String(process.pid));
        await handle.close();
      } catch {
        lockFile = undefined;
        throw new KiwoomError(
          "collecting",
          "Local CLI lock exists; confirm prior process ended before removing its lock",
        );
      }
      if (command === "verify") {
        // Read-only diagnostic w.r.t. the operational DB. Explicit exclusive diagnostic runs only.
        if (!args.has("--single-process"))
          throw new KiwoomError(
            "configuration",
            "Stop all other credential consumers; verify --live requires --single-process acknowledgment",
          );
        if (code !== "005930")
          throw new KiwoomError(
            "configuration",
            "Initial small diagnostic uses 005930; use sync only after it succeeds",
          );
        const { PGlite } = await import("@electric-sql/pglite");
        const pg = new PGlite();
        await pg.waitReady;
        await pg.exec(
          await readFile(new URL("../migrations/0002_kiwoom_flow.sql", import.meta.url), "utf8"),
        );
        store = createKiwoomStore({
          query: async (text, params) => (await pg.query(text, params)).rows,
        });
        closeLocal = () => pg.close();
      } else {
        if (!config.databaseConfigured)
          throw new KiwoomError(
            "storage",
            "sync requires shared persistent DATABASE_URL; no memory fallback",
            null,
            0,
            "DATABASE_MISSING",
          );
        const { getSql } = await import("../src/lib/db.ts");
        store = createKiwoomStore(await getSql());
        if (!(await store.schema()).ready)
          throw new KiwoomError(
            "storage",
            "Apply existing migrations before collection",
            null,
            0,
            "DATABASE_SCHEMA_MISSING",
          );
      }
      const client = createKiwoomClient(config, store);
      await client.authenticate();
      emit({ authentication: "TOKEN_AVAILABLE", token: "REDACTED", environment: "real" });
      let expectedDates = [];
      if (args.has("--calendar")) {
        const parsed = JSON.parse(await readFile(args.get("--calendar"), "utf8"));
        if (
          !Array.isArray(parsed) ||
          parsed.length > 8000 ||
          parsed.some((date) => typeof date !== "string" || !isFlowDate(date))
        )
          throw new KiwoomError(
            "configuration",
            "Calendar must be JSON array of observed exchange-local daily price dates",
          );
        expectedDates = [...new Set(parsed)].filter((date) => date >= from && date <= to).sort();
      }
      identity.request.expectedDailyDates = expectedDates.length ? expectedDates : undefined;
      const primary = { credit: [], foreign: [] };
      for (const metric of FLOW_METRICS) {
        if (command === "verify") {
          try {
            const page = await client.page(
              KIWOOM_APIS[metric].id,
              kiwoomConditions(request, metric),
              new AbortController().signal,
            );
            const rows = page.body[KIWOOM_APIS[metric].array];
            if (!Array.isArray(rows))
              throw new KiwoomError("parsing", "Required response array missing");
            const result = parseKiwoomRows(
              rows,
              metric,
              new Date().toISOString(),
              "real",
              flowScope,
            );
            const valid = result.observations.filter((row) => row.value !== null);
            if (metric !== "investmentTrust") primary[metric] = result.observations;
            emit({
              metric,
              apiId: KIWOOM_APIS[metric].id,
              sourceField: KIWOOM_APIS[metric].field,
              status: valid.length ? "RECEIVED" : "NO_VALID_FIELDS",
              rows: rows.length,
              validValues: valid.length,
              invalidRows: result.invalidRows,
              from: valid[0]?.date ?? null,
              to: valid.at(-1)?.date ?? null,
              pages: 1,
              continuation: page.headers.get("cont-yn"),
              stored: false,
              note: "Small first page diagnostic; full history not verified. Operational DB untouched.",
            });
            if (!valid.length) process.exitCode = 1;
          } catch (error) {
            const safe = safeKiwoomError(error);
            emit({ metric, status: safe.status, errorCode: safe.code });
            process.exitCode = 1;
          }
        } else {
          let collectionIdentity = identity;
          if (args.has("--incremental")) {
            const existing = await store.read(identity, metric);
            const last = existing.filter((row) => row.value !== null).at(-1)?.date;
            if (last) {
              const date = new Date(last + "T00:00:00Z");
              date.setUTCDate(date.getUTCDate() - 14);
              collectionIdentity = {
                ...identity,
                request: {
                  ...request,
                  from:
                    date.toISOString().slice(0, 10) > from ? date.toISOString().slice(0, 10) : from,
                },
              };
            }
          }
          const maxPages = Number(args.get("--max-pages") ?? 25);
          const budgetMs = Number(args.get("--budget-ms") ?? 45000);
          if (
            !Number.isInteger(maxPages) ||
            maxPages < 1 ||
            maxPages > 200 ||
            !Number.isFinite(budgetMs) ||
            budgetMs < 50 ||
            budgetMs > 240000
          )
            throw new KiwoomError("configuration", "Invalid collection budget");
          const job = await collectKiwoomMetric(store, client, collectionIdentity, metric, {
            maxPages,
            budgetMs,
            resume: args.has("--resume"),
          });
          const rows = await store.read(identity, metric);
          const valid = rows.filter((row) => row.value !== null);
          const values = new Map(valid.map((row) => [row.date, row.value]));
          const missingDates = expectedDates.filter((date) => !values.has(date));
          // Record missing observed sessions with the job; absence of a calendar remains unknown.
          const safeJob = { ...job, nextKey: undefined };
          emit({
            metric,
            apiId: KIWOOM_APIS[metric].id,
            status: job.status,
            job: safeJob,
            rows: rows.length,
            validValues: valid.length,
            from: valid[0]?.date ?? null,
            to: valid.at(-1)?.date ?? null,
            stored: rows.length > 0,
            missingDates,
            missingSessions: expectedDates.length ? missingDates.length : null,
            calendarBasis: expectedDates.length
              ? "observed daily price sessions"
              : "UNVERIFIED; provide --calendar",
            unit: metric === "investmentTrust" ? "주" : "%",
            note:
              instrument === "stock"
                ? "Date basis/publication/finality unknown"
                : "ETF/ETN support and share/unit interpretation require real response and HTS comparison",
          });
          if (
            !job.complete ||
            !valid.length ||
            (job.status !== "ready" && job.status !== "history")
          )
            process.exitCode = 1;
        }
      }
      if (args.has("--cross-check")) emit(await crossCheckKiwoom(client, request, primary));
    }
  }
} catch (error) {
  const safe = safeKiwoomError(error);
  emit({ status: safe.status, health: safe.health, errorCode: safe.code, reason: safe.message });
  process.exitCode = 1;
} finally {
  await closeLocal();
  if (lockFile) await unlink(lockFile).catch(() => {});
}
// Existing pg pool is process-scoped; allow its idle connections to close without printing secrets.
