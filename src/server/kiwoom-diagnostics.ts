import type { FlowRequest, KiwoomHealthStatus } from "../lib/charts/hts-flow.ts";
import { assertKiwoomOwner, type KiwoomConfig } from "./kiwoom-config.ts";
import { diagnoseKiwoomRuntime } from "./kiwoom-runtime.ts";
import { validateFlowRequest } from "./chart-flow-request.ts";

/** Public config booleans only; operational detail remains admin-only. */
export async function diagnoseKiwoom(config: KiwoomConfig, input: FlowRequest, verifiedUserId: string | null,
  options: Omit<NonNullable<Parameters<typeof diagnoseKiwoomRuntime>[2]>, "inspectOperational"> = {}) {
  const request = validateFlowRequest(input);
  let ownerAuthorized = false;
  try { assertKiwoomOwner(config, verifiedUserId); ownerAuthorized = true; } catch { /* no detailed work */ }
  const result = await diagnoseKiwoomRuntime(config, request, { ...options, inspectOperational: ownerAuthorized });
  const ownerReadRequired = config.mode === "direct" || Boolean(config.readAuthRequired);
  let status: KiwoomHealthStatus | "PUBLIC_READ_CONFIGURED" = result.status;
  if (!ownerAuthorized && ownerReadRequired) {
    result.issues.push("OWNER_AUTH_FAILED");
    if (!result.issues.slice(0, -1).length) status = "OWNER_AUTH_FAILED";
  } else if (!ownerAuthorized && !result.issues.length) {
    // No DB was opened: report public configuration, never READY or NO_HISTORY.
    status = "PUBLIC_READ_CONFIGURED";
  }
  return {
    ...result,
    status,
    ownerAuthorized,
    marketReadAccess: !ownerReadRequired
      ? "PUBLIC_READ_ALLOWED" as const
      : ownerAuthorized ? "OWNER_READ_ALLOWED" as const : "OWNER_LOGIN_REQUIRED" as const,
    operationalDetailsAccess: ownerAuthorized ? "OWNER_ALLOWED" as const : "OWNER_LOGIN_REQUIRED" as const,
  };
}
