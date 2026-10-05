import type { FlowRequest } from "../lib/charts/hts-flow.ts";
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
  if (!ownerAuthorized) {
    result.issues.push("OWNER_AUTH_FAILED");
    if (!result.issues.slice(0, -1).length) result.status = "OWNER_AUTH_FAILED";
  }
  return { ...result, ownerAuthorized };
}
