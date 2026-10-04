import {
  FLOW_METRICS,
  kiwoomHealthFor,
  type FlowRequest,
  type KiwoomHealthStatus,
} from "../lib/charts/hts-flow.ts";
import {
  assertKiwoomOwner,
  checkKiwoomEgress,
  KiwoomError,
  safeKiwoomConfig,
  safeKiwoomError,
  type KiwoomConfig,
} from "./kiwoom-config.ts";
import { KIWOOM_APIS } from "./kiwoom-client.ts";
import {
  createKiwoomStore,
  type KiwoomFlowStore,
  type KiwoomSchemaStatus,
} from "./kiwoom-store.ts";
import { validateFlowRequest } from "./chart-flow-request.ts";

/** Read-only diagnostics. No token issuance, collection or implicit migration. */
export async function diagnoseKiwoom(
  config: KiwoomConfig,
  input: FlowRequest,
  verifiedUserId: string | null,
  options: {
    store?: () => Promise<KiwoomFlowStore>;
    checkEgress?: typeof checkKiwoomEgress;
  } = {},
) {
  const request = validateFlowRequest(input);
  const result = {
    ...safeKiwoomConfig(config),
    ownerAuthorized: false,
    status: "DISABLED" as KiwoomHealthStatus,
    schema: null as KiwoomSchemaStatus | null,
    egressStatus: config.mode === "collector" ? "NOT_REQUIRED" : "NOT_CHECKED",
    tokenStatus: config.mode === "collector" ? "NOT_REQUIRED" : "NOT_TESTED",
    apis: Object.fromEntries(FLOW_METRICS.map((id) => [KIWOOM_APIS[id].id, "NOT_TESTED"])),
    latestStored: { credit: null, foreign: null, investmentTrust: null } as Record<
      (typeof FLOW_METRICS)[number],
      string | null
    >,
    metrics: {} as Record<
      string,
      {
        status: KiwoomHealthStatus;
        rows: number;
        validValues: number;
        firstDate: string | null;
        lastDate: string | null;
        lastSuccessAt: string | null;
        pages: number;
        stopReason: string | null;
        errorCode: number | null;
      }
    >,
    issues: [] as KiwoomHealthStatus[],
  };
  if (!config.enabled) result.issues.push("DISABLED");
  if (config.mode === "direct" && (!config.appKey || !config.appSecret))
    result.issues.push("CREDENTIALS_MISSING");
  if (config.mode === "direct" && !config.expectedEgressIp)
    result.issues.push("EXPECTED_IP_MISSING");
  if (!config.databaseConfigured) result.issues.push("DATABASE_MISSING");
  try {
    assertKiwoomOwner(config, verifiedUserId);
    result.ownerAuthorized = true;
  } catch {
    result.issues.push("OWNER_AUTH_FAILED");
  }
  // Unauthenticated visitors may see booleans, never stored data or trigger network/DB work.
  if (!result.ownerAuthorized || !config.enabled || !config.databaseConfigured) {
    result.status = result.issues[0] ?? "OWNER_AUTH_FAILED";
    return result;
  }
  try {
    const store = await (options.store
      ? options.store()
      : import("../lib/db.ts").then(async ({ getSql }) => createKiwoomStore(await getSql())));
    result.schema = await store.schema();
    if (!result.schema.ready)
      throw new KiwoomError("storage", "키움 스키마 적용 필요", null, 0, "DATABASE_SCHEMA_MISSING");
    if (config.mode === "direct") {
      const ip = await (options.checkEgress ?? checkKiwoomEgress)(config.expectedEgressIp);
      result.egressStatus = ip.status;
      if (ip.status !== "IP_MATCH" && !result.issues.includes(ip.status))
        result.issues.push(ip.status);
    }
    for (const metric of FLOW_METRICS) {
      const identity = { scopeId: verifiedUserId!, environment: config.environment, request };
      const rows = await store.read(identity, metric);
      const valid = rows.filter((row) => row.value !== null);
      const job = await store.job(identity, metric);
      const status = kiwoomHealthFor(job?.status ?? "history", valid.length);
      result.metrics[metric] = {
        status,
        rows: rows.length,
        validValues: valid.length,
        firstDate: valid[0]?.date ?? null,
        lastDate: valid.at(-1)?.date ?? null,
        lastSuccessAt: job?.lastSuccessAt ?? null,
        pages: job?.pages ?? 0,
        stopReason: job?.stopReason ?? null,
        errorCode: job?.errorCode ?? null,
      };
      result.latestStored[metric] = valid.at(-1)?.date ?? null;
      // A saved job is evidence of that job, not a new API/token test.
      result.apis[KIWOOM_APIS[metric].id] = job ? `STORED_JOB_${status}` : "NOT_TESTED";
    }
    result.status =
      result.issues[0] ??
      (FLOW_METRICS.every((id) => result.latestStored[id]) ? "READY" : "NO_HISTORY");
  } catch (error) {
    const safe = safeKiwoomError(error);
    result.issues.push(safe.health);
    result.status = safe.health;
  }
  return result;
}
