import type { Sql } from "../lib/db.ts";
import { KiwoomError } from "./kiwoom-config.ts";
import { KIWOOM_TARGET_LIMIT } from "./kiwoom-targets.ts";
import type { FlowIdentity, KiwoomFlowStore } from "./kiwoom-store.ts";

export type KiwoomCollectorState = "RUNNING" | "STALE" | "OFFLINE" | "UNKNOWN";
export interface KiwoomCollectorIdentity {
  scopeId: string;
  environment: "real" | "mock";
}
/** Safe persisted telemetry only: no worker/scope IDs, URLs, IPs or broker payloads. */
export interface KiwoomCollectorDiagnostics {
  state: KiwoomCollectorState;
  schemaReady: boolean;
  startedAt: string | null;
  lastHeartbeatAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  pendingTargets: number | null;
  lastQueueCount: number | null;
}
const safeErrors = new Set([
  "STARTUP_DOCTOR_FAILED", "STARTUP_API_FAILED", "STARTUP_SYNC_FAILED", "STARTUP_READ_FAILED",
  "QUEUE_CYCLE_FAILED", "WORKER_SETUP_FAILED", "COLLECTOR_FAILED", "CREDENTIALS_MISSING",
  "DATABASE_MISSING", "DATABASE_SCHEMA_MISSING", "DATABASE_FAILED", "EXPECTED_IP_MISSING",
  "IP_MISMATCH", "IP_UNVERIFIED", "TOKEN_FAILED", "API_FAILED", "PARSING_FAILED", "RATE_LIMIT",
  "CONFIGURATION_FAILED", "DISABLED", "OWNER_AUTH_FAILED", "DATA_SCOPE_MISMATCH",
  "DEPLOYMENT_REVISION_MISMATCH", "PRODUCT_TYPE_UNKNOWN",
]);
export function isKiwoomCollectorErrorCode(value: unknown): value is string {
  return typeof value === "string" && safeErrors.has(value);
}
export function validateKiwoomCollectorInstance(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    throw new KiwoomError("configuration", "Collector requires a random UUID instance");
  return value.toLowerCase();
}
/** A worker that lost either collection lease must not finish targets now owned by another worker. */
export async function runKiwoomTargetCycle(identity: FlowIdentity,
  targets: Pick<KiwoomFlowStore["targets"], "start" | "finish">, signal: AbortSignal,
  run: (signal: AbortSignal) => Promise<{ complete: boolean; hasValues: boolean }>) {
  signal.throwIfAborted();
  await targets.start(identity);
  let complete = false, hasValues = false;
  try {
    signal.throwIfAborted();
    const result = await run(signal);
    signal.throwIfAborted();
    complete = result.complete; hasValues = result.hasValues;
    return result;
  } finally {
    // Do not alter a target after lease loss, even if a provider ignored cancellation and returned ready.
    if (!signal.aborted) await targets.finish(identity, complete, hasValues);
  }
}
type RuntimeRow = {
  startedAt: unknown;
  lastHeartbeatAt: unknown;
  lastSuccessAt: unknown;
  lastErrorCode: unknown;
  lastQueueCount: unknown;
};
const isoTime = (value: unknown): string | null => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  const normalized = new Date(milliseconds).toISOString();
  // Reject calendar rollover rather than interpreting malformed telemetry as a live worker.
  return normalized.slice(0, 19) === value.slice(0, 19) ? normalized : null;
};
const boundedCount = (value: unknown): number | null => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= KIWOOM_TARGET_LIMIT ? value : null;
export function unknownKiwoomCollector(): KiwoomCollectorDiagnostics {
  return { state: "UNKNOWN", schemaReady: false, startedAt: null, lastHeartbeatAt: null,
    lastSuccessAt: null, lastErrorCode: null, pendingTargets: null, lastQueueCount: null };
}
/** Pure clock boundary calculation. RUNNING means a recent heartbeat, not guaranteed broker readiness. */
export function kiwoomCollectorDiagnostics(row: RuntimeRow | null, now = Date.now(), schemaReady = true,
  pendingTargets: number | null = null): KiwoomCollectorDiagnostics {
  const result = { ...unknownKiwoomCollector(), schemaReady, pendingTargets: boundedCount(pendingTargets) };
  if (!row || !schemaReady || !Number.isFinite(now)) return result;
  const startedAt = isoTime(row.startedAt), lastHeartbeatAt = isoTime(row.lastHeartbeatAt);
  const lastSuccessAt = row.lastSuccessAt === null ? null : isoTime(row.lastSuccessAt);
  if (!startedAt || !lastHeartbeatAt || (row.lastSuccessAt !== null && !lastSuccessAt) ||
    Date.parse(startedAt) > Date.parse(lastHeartbeatAt) || Date.parse(lastHeartbeatAt) > now ||
    (lastSuccessAt !== null && Date.parse(lastSuccessAt) > now)) return result;
  const age = now - Date.parse(lastHeartbeatAt);
  return { ...result, state: age <= 10 * 60_000 ? "RUNNING" : age <= 30 * 60_000 ? "STALE" : "OFFLINE",
    startedAt, lastHeartbeatAt, lastSuccessAt,
    lastErrorCode: isKiwoomCollectorErrorCode(row.lastErrorCode) ? row.lastErrorCode : null,
    lastQueueCount: boundedCount(row.lastQueueCount) };
}

/** Reuses the existing PostgreSQL Sql abstraction; no memory or filesystem telemetry fallback. */
export function createKiwoomCollectorRuntime(sql: Sql) {
  const identityParams = (identity: KiwoomCollectorIdentity) => [identity.scopeId, identity.environment];
  const schema = async () => Boolean((await sql.query<{ ready: boolean }>(
    "select to_regclass('kiwoom_collector_runtime') is not null as ready"))[0]?.ready);
  const pending = async (identity: KiwoomCollectorIdentity): Promise<number> => {
    // Count the bounded due queue, not the whole market or private target identifiers.
    const [row] = await sql.query<{ count: number }>(`select count(*)::int as count from (
      select 1 from kiwoom_collection_targets where scope_id=$1 and environment=$2
      and next_due_at<=clock_timestamp() limit $3) due`, [...identityParams(identity), KIWOOM_TARGET_LIMIT]);
    return boundedCount(row?.count) ?? 0;
  };
  const requireSchema = async () => {
    if (!await schema()) throw new KiwoomError("storage", "Collector heartbeat migration required", null, 0, "DATABASE_SCHEMA_MISSING");
  };
  return {
    schema,
    pending,
    async start(identity: KiwoomCollectorIdentity, instanceId: string): Promise<void> {
      const instance = validateKiwoomCollectorInstance(instanceId);
      await requireSchema();
      await sql.query(`insert into kiwoom_collector_runtime(scope_id,environment,instance_id,last_queue_count)
        values($1,$2,$3::uuid,$4) on conflict(scope_id,environment) do update set
        started_at=case when kiwoom_collector_runtime.instance_id=excluded.instance_id then kiwoom_collector_runtime.started_at else clock_timestamp() end,
        instance_id=excluded.instance_id,last_heartbeat_at=clock_timestamp(),last_error_code=null,
        last_queue_count=excluded.last_queue_count,updated_at=clock_timestamp()`,
      [...identityParams(identity), instance, await pending(identity)]);
    },
    async update(identity: KiwoomCollectorIdentity, instanceId: string, update: {
      event: "heartbeat" | "success" | "error";
      errorCode?: string;
    }): Promise<boolean> {
      const instance = validateKiwoomCollectorInstance(instanceId);
      if (!["heartbeat", "success", "error"].includes(update.event) ||
        (update.event === "error" && !isKiwoomCollectorErrorCode(update.errorCode)))
        throw new KiwoomError("configuration", "Collector error code must be a fixed safe enum");
      await requireSchema();
      const rows = await sql.query(`update kiwoom_collector_runtime set last_heartbeat_at=clock_timestamp(),
        last_success_at=case when $4='success' then clock_timestamp() else last_success_at end,
        last_error_code=case when $4='success' then null when $4='error' then $5 else last_error_code end,
        last_queue_count=$6,updated_at=clock_timestamp()
        where scope_id=$1 and environment=$2 and instance_id=$3::uuid returning 1`,
      [...identityParams(identity), instance, update.event, update.event === "error" ? update.errorCode : null, await pending(identity)]);
      return rows.length > 0;
    },
    async read(identity: KiwoomCollectorIdentity): Promise<KiwoomCollectorDiagnostics> {
      try {
        if (!await schema()) return unknownKiwoomCollector();
        const [row] = await sql.query<RuntimeRow>(`select
          to_char(started_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "startedAt",
          to_char(last_heartbeat_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "lastHeartbeatAt",
          to_char(last_success_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "lastSuccessAt",
          last_error_code as "lastErrorCode",last_queue_count as "lastQueueCount"
          from kiwoom_collector_runtime where scope_id=$1 and environment=$2`, identityParams(identity));
        return kiwoomCollectorDiagnostics(row ?? null, Date.now(), true, await pending(identity));
      } catch { return unknownKiwoomCollector(); }
    },
  };
}
