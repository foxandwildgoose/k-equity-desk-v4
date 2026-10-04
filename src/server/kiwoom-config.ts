import { isIP } from "node:net";
import type { FlowStatus } from "../lib/charts/hts-flow.ts";

export interface KiwoomConfig {
  appKey?: string;
  appSecret?: string;
  environment: "real" | "mock";
  enabled: boolean;
  mode: "direct" | "collector";
  requestsPerSecond: number;
  expectedEgressIp?: string;
  ownerUserId?: string;
  databaseConfigured: boolean;
}
export type CredentialsStatus =
  | "CREDENTIALS_CONFIGURED"
  | "APP_SECRET_MISSING"
  | "APP_KEY_MISSING"
  | "CREDENTIALS_NOT_CONFIGURED";
export function credentialsStatus(
  config: Pick<KiwoomConfig, "appKey" | "appSecret">,
): CredentialsStatus {
  return config.appKey
    ? config.appSecret
      ? "CREDENTIALS_CONFIGURED"
      : "APP_SECRET_MISSING"
    : config.appSecret
      ? "APP_KEY_MISSING"
      : "CREDENTIALS_NOT_CONFIGURED";
}
export function readKiwoomConfig(
  env: Record<string, string | undefined> = process.env,
): KiwoomConfig {
  const value = (key: string) => env[key]?.trim() || undefined;
  const environment = value("KIWOOM_ENV") ?? "real";
  const mode = value("KIWOOM_FLOW_MODE") ?? "direct";
  const requestsPerSecond = Number(value("KIWOOM_REQUESTS_PER_SECOND") ?? 2);
  const enabled = value("KIWOOM_FLOW_ENABLED") ?? "false";
  const expectedEgressIp = value("KIWOOM_EXPECTED_EGRESS_IP");
  if (
    !["real", "mock"].includes(environment) ||
    !["direct", "collector"].includes(mode) ||
    !["true", "false"].includes(enabled) ||
    !Number.isFinite(requestsPerSecond) ||
    requestsPerSecond <= 0 ||
    requestsPerSecond > 2 ||
    (expectedEgressIp && isIP(expectedEgressIp) !== 4)
  )
    throw new KiwoomError("configuration", "키움 환경/모드/속도/IP 설정 오류");
  return {
    appKey: value("KIWOOM_APP_KEY"),
    appSecret: value("KIWOOM_APP_SECRET"),
    environment: environment as KiwoomConfig["environment"],
    mode: mode as KiwoomConfig["mode"],
    enabled: enabled === "true",
    requestsPerSecond,
    expectedEgressIp,
    ownerUserId: value("KIWOOM_OWNER_USER_ID"),
    databaseConfigured: Boolean(value("DATABASE_URL")),
  };
}
/** Never contains provider text, credentials, request bodies, URLs or account details. */
export class KiwoomError extends Error {
  readonly status: FlowStatus;
  readonly code: number | null;
  readonly retryAfterMs: number;
  constructor(status: FlowStatus, message: string, code: number | null = null, retryAfterMs = 0) {
    super(message);
    this.name = "KiwoomError";
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}
export function safeKiwoomError(error: unknown): KiwoomError {
  return error instanceof KiwoomError
    ? error
    : new KiwoomError("storage", "키움 저장소/처리 실패 · 서버 설정 확인 필요");
}
export function assertKiwoomOwner(
  config: KiwoomConfig,
  verifiedUserId: string | null | undefined,
): string {
  if (!verifiedUserId || !config.ownerUserId || verifiedUserId !== config.ownerUserId)
    throw new KiwoomError(
      "access",
      "인증된 키움 소유자만 조회 가능 · 로그인/서버 소유자 설정 필요",
    );
  return verifiedUserId;
}
export type EgressStatus = "IP_MATCH" | "IP_MISMATCH" | "IP_UNVERIFIED" | "EXPECTED_IP_MISSING";
/** This service sees no key/token/header. A missing/mismatched IP prevents broker calls. */
export async function checkKiwoomEgress(
  expected: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<{ status: EgressStatus; observedIp: string | null }> {
  if (!expected) return { status: "EXPECTED_IP_MISSING", observedIp: null };
  try {
    const response = await fetcher("https://api.ipify.org?format=json", {
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return { status: "IP_UNVERIFIED", observedIp: null };
    const body = (await response.json()) as { ip?: unknown };
    if (typeof body.ip !== "string" || isIP(body.ip) !== 4)
      return { status: "IP_UNVERIFIED", observedIp: null };
    return { status: body.ip === expected ? "IP_MATCH" : "IP_MISMATCH", observedIp: body.ip };
  } catch {
    return { status: "IP_UNVERIFIED", observedIp: null };
  }
}
