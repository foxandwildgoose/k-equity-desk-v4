import { FLOW_METRICS, kiwoomHealthFor, type FlowRequest, type KiwoomHealthStatus } from "../lib/charts/hts-flow.ts";
import { KIWOOM_APIS } from "./kiwoom-client.ts";
import { checkKiwoomEgress, kiwoomDataScope, safeKiwoomConfig, safeKiwoomError, type KiwoomConfig } from "./kiwoom-config.ts";
import type { KiwoomFlowStore, KiwoomSchemaStatus } from "./kiwoom-store.ts";
import { getKiwoomStore } from "./kiwoom-db.ts";
import type { KiwoomCollectorDiagnostics } from "./kiwoom-collector-runtime.ts";

/** Shared read-only diagnostic. Operational detail requires web admin or local OS authority.
 * Collector web never probes egress, authenticates, constructs a broker client or migrates. */
export async function diagnoseKiwoomRuntime(config: KiwoomConfig, request: FlowRequest, options: {
  inspectOperational?: boolean;
  store?: () => Promise<KiwoomFlowStore>;
  checkEgress?: typeof checkKiwoomEgress;
} = {}) {
  const result = {
    ...safeKiwoomConfig(config), status: "DISABLED" as KiwoomHealthStatus,
    databaseConnected: false, schemaReady: false, dataScopeMatched: false,
    schema: null as KiwoomSchemaStatus | null,
    egressStatus: config.mode === "collector" ? "NOT_REQUIRED" : "NOT_CHECKED",
    tokenStatus: config.mode === "collector" ? "NOT_REQUIRED" : "NOT_TESTED",
    apis: Object.fromEntries(FLOW_METRICS.map(id => [KIWOOM_APIS[id].id, "NOT_TESTED"])),
    latestStored: { credit: null, foreign: null, investmentTrust: null } as Record<(typeof FLOW_METRICS)[number], string | null>,
    metrics: {} as Record<string, { status: KiwoomHealthStatus; rows: number; validValues: number; firstDate: string | null; lastDate: string | null; lastSuccessAt: string | null; pages: number; stopReason: string | null; errorCode: number | null }>,
    collector: null as KiwoomCollectorDiagnostics | null,
    issues: [] as KiwoomHealthStatus[],
  };
  if (result.deploymentStatus === "DEPLOYMENT_REVISION_MISMATCH") result.issues.push("DEPLOYMENT_REVISION_MISMATCH");
  if (!config.enabled) result.issues.push("DISABLED");
  if (!config.databaseConfigured) result.issues.push("DATABASE_MISSING");
  if (config.mode === "direct" && (!config.appKey || !config.appSecret)) result.issues.push("CREDENTIALS_MISSING");
  if (config.mode === "direct" && !config.expectedEgressIp) result.issues.push("EXPECTED_IP_MISSING");
  if (options.inspectOperational && config.databaseConfigured) {
    try {
      const store = await (options.store ?? getKiwoomStore)();
      result.schema = await store.schema(); result.databaseConnected = true; result.schemaReady = result.schema.ready;
      // This branch is only reached by the verified web owner or OS-operator CLI.
      // Missing optional heartbeat schema must not break previously stored metrics.
      if (store.collectorRuntime) result.collector = await store.collectorRuntime.read({ scopeId: kiwoomDataScope(config), environment: config.environment });
      if (!result.schemaReady) result.issues.push("DATABASE_SCHEMA_MISSING");
      else {
        const identity = { scopeId: kiwoomDataScope(config), environment: config.environment, request };
        const targetState = await store.targets.state(identity);
        for (const metric of FLOW_METRICS) {
          const rows = await store.read(identity, metric);
          const valid = rows.filter(row => row.value !== null);
          const mismatch = !valid.length && await store.hasOtherScope(identity, metric);
          const job = await store.job(identity, metric);
          const jobError = job && !["ready", "history", "collecting"].includes(job.status) ? kiwoomHealthFor(job.status) : null;
          const status: KiwoomHealthStatus = mismatch ? "DATA_SCOPE_MISMATCH" : jobError ?? (job?.status === "collecting" || targetState === "collecting" ? "COLLECTING"
            : !valid.length ? targetState === "queued" || targetState === "partial" ? "COLLECTION_QUEUED" : "NO_HISTORY"
            : job?.complete && job.status === "ready" ? "READY" : "PARTIAL");
          result.metrics[metric] = { status, rows: rows.length, validValues: valid.length,
            firstDate: valid[0]?.date ?? null, lastDate: valid.at(-1)?.date ?? null,
            lastSuccessAt: job?.lastSuccessAt ?? null, pages: job?.pages ?? 0,
            stopReason: job?.stopReason ?? null, errorCode: job?.errorCode ?? null };
          result.latestStored[metric] = valid.at(-1)?.date ?? null;
          result.apis[KIWOOM_APIS[metric].id] = job ? `STORED_JOB_${status}` : "NOT_TESTED";
          if (mismatch && !result.issues.includes("DATA_SCOPE_MISMATCH")) result.issues.push("DATA_SCOPE_MISMATCH");
          if (jobError && !result.issues.includes(jobError)) result.issues.push(jobError);
        }
        result.dataScopeMatched = FLOW_METRICS.every(id => Boolean(result.latestStored[id]));
      }
    } catch (error) { result.issues.push(safeKiwoomError(error).health); }
  }
  if (options.inspectOperational && config.enabled && config.mode === "direct") {
    const ip = await (options.checkEgress ?? checkKiwoomEgress)(config.expectedEgressIp);
    result.egressStatus = ip.status;
    if (ip.status !== "IP_MATCH" && !result.issues.includes(ip.status)) result.issues.push(ip.status);
  }
  result.status = result.issues[0] ?? (result.dataScopeMatched
    ? FLOW_METRICS.every(id => result.metrics[id]?.status === "READY") ? "READY" : "PARTIAL"
    : FLOW_METRICS.some(id => result.metrics[id]?.status === "COLLECTING") ? "COLLECTING"
    : FLOW_METRICS.some(id => result.metrics[id]?.status === "COLLECTION_QUEUED") ? "COLLECTION_QUEUED" : "NO_HISTORY");
  return result;
}
