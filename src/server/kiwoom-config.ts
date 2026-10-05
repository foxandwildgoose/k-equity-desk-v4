import { isIP } from "node:net";
import {
  kiwoomHealthFor,
  type FlowStatus,
  type KiwoomHealthStatus,
} from "../lib/charts/hts-flow.ts";

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
  authEnabled?: boolean;
  authenticationReady?: boolean;
  dataScopeId?: string;
  legacyDataScopeId?: string;
  readAuthRequired?: boolean;
  targetAuthRequired?: boolean;
  deploymentRevision?: string | null;
  expectedRevision?: string | null;
}
export const DEFAULT_KIWOOM_DATA_SCOPE = "market-global-v1";
export function kiwoomDataScope(config: KiwoomConfig): string {
  return config.dataScopeId ?? DEFAULT_KIWOOM_DATA_SCOPE;
}
export function shortKiwoomRevision(value: string | undefined): string | null {
  return value && /^[a-f0-9]{7,40}$/i.test(value) ? value.slice(0, 7).toLowerCase() : null;
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
  const mode = value("KIWOOM_FLOW_MODE") ?? "collector";
  const requestsPerSecond = Number(value("KIWOOM_REQUESTS_PER_SECOND") ?? 2);
  const enabled = value("KIWOOM_FLOW_ENABLED") ?? "false";
  const expectedEgressIp = value("KIWOOM_EXPECTED_EGRESS_IP");
  const dataScopeId = value("KIWOOM_DATA_SCOPE_ID") ?? DEFAULT_KIWOOM_DATA_SCOPE;
  const legacyDataScopeId = value("KIWOOM_LEGACY_DATA_SCOPE_ID");
  const readAuth = value("KIWOOM_READ_AUTH_REQUIRED") ?? "false";
  const targetAuth = value("KIWOOM_TARGET_AUTH_REQUIRED") ?? "false";
  if (
    !["real", "mock"].includes(environment) ||
    !["direct", "collector"].includes(mode) ||
    !["true", "false"].includes(enabled) ||
    !Number.isFinite(requestsPerSecond) ||
    requestsPerSecond <= 0 ||
    requestsPerSecond > 2 ||
    (expectedEgressIp && isIP(expectedEgressIp) !== 4) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(dataScopeId) ||
    (legacyDataScopeId && !/^[A-Za-z0-9_-]{1,128}$/.test(legacyDataScopeId)) ||
    !["true", "false"].includes(readAuth) ||
    !["true", "false"].includes(targetAuth)
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
    dataScopeId,
    legacyDataScopeId,
    readAuthRequired: readAuth === "true",
    targetAuthRequired: targetAuth === "true",
    // Build injection is used when the runtime platform does not supply its SHA.
    deploymentRevision: shortKiwoomRevision(value("VERCEL_GIT_COMMIT_SHA") ?? value("KIWOOM_BUILD_SHA") ??
      (env === process.env ? process.env.KIWOOM_BUILD_SHA : undefined)),
    expectedRevision: shortKiwoomRevision(value("KIWOOM_EXPECTED_REVISION")),
    databaseConfigured: Boolean(value("DATABASE_URL")),
    authEnabled: value("VITE_AUTH_ENABLED") !== "false",
    // Never accept the preview's ephemeral session secret on a deployed broker path.
    authenticationReady:
      value("VITE_AUTH_ENABLED") !== "false" &&
      (!(value("NODE_ENV") === "production" || value("VERCEL") || value("DATABASE_URL")) ||
        Boolean(value("BETTER_AUTH_SECRET") && value("BETTER_AUTH_URL"))),
  };
}
/** Never contains provider text, credentials, request bodies, URLs or account details. */
export class KiwoomError extends Error {
  readonly status: FlowStatus;
  readonly code: number | null;
  readonly retryAfterMs: number;
  readonly health: KiwoomHealthStatus;
  constructor(
    status: FlowStatus,
    message: string,
    code: number | null = null,
    retryAfterMs = 0,
    health?: KiwoomHealthStatus,
  ) {
    super(message);
    this.name = "KiwoomError";
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
    this.health = health ?? kiwoomHealthFor(status);
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
  if (
    config.authEnabled === false ||
    config.authenticationReady === false ||
    !verifiedUserId ||
    verifiedUserId === "dev-user" ||
    !config.ownerUserId ||
    verifiedUserId !== config.ownerUserId
  )
    throw new KiwoomError(
      "access",
      "인증된 키움 소유자만 조회 가능 · 로그인/서버 소유자 설정 필요",
      null,
      0,
      "OWNER_AUTH_FAILED",
    );
  return verifiedUserId;
}
/** Public market reads are independent of login; direct broker access never is. */
export function assertKiwoomReadAccess(config: KiwoomConfig, userId?: string | null): void {
  if (config.mode === "direct" || config.readAuthRequired) assertKiwoomOwner(config, userId);
}
/** Explicit allowlist of booleans and enums. Never spread the runtime config into responses. */
export function safeKiwoomConfig(config: KiwoomConfig) {
  return {
    flowEnabled: config.enabled,
    environment: config.environment,
    mode: config.mode,
    appKeyConfigured: Boolean(config.appKey),
    appSecretConfigured: Boolean(config.appSecret),
    credentialsRequired: config.mode === "direct",
    databaseConfigured: config.databaseConfigured,
    expectedEgressIpConfigured: Boolean(config.expectedEgressIp),
    ownerConfigured: Boolean(config.ownerUserId),
    authenticationEnabled: config.authEnabled !== false,
    authenticationReady: config.authenticationReady !== false,
    authEnabled: config.authEnabled !== false,
    authReady: config.authenticationReady !== false,
    dataScopeConfigured: Boolean(kiwoomDataScope(config)),
    ownerAuthorizationRequired: config.mode === "direct" || Boolean(config.readAuthRequired),
    readAuthRequired: Boolean(config.readAuthRequired),
    deploymentRevision: config.deploymentRevision ?? null,
    deploymentStatus: config.expectedRevision && config.deploymentRevision && config.expectedRevision !== config.deploymentRevision
      ? "DEPLOYMENT_REVISION_MISMATCH" : "DEPLOYMENT_NOT_VERIFIED",
    expectedEgressConfigured: Boolean(config.expectedEgressIp),
  };
}
export type EgressStatus = "IP_MATCH" | "IP_MISMATCH" | "IP_UNVERIFIED" | "EXPECTED_IP_MISSING";
/** This service sees no key/token/header. A missing/mismatched IP prevents broker calls. */
export async function checkKiwoomEgress(
  expected: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<{ status: EgressStatus; observedIp: string | null }> {
  if (!expected) return { status: "EXPECTED_IP_MISSING", observedIp: null };
  const services = ["https://api.ipify.org?format=json", "https://checkip.amazonaws.com", "https://icanhazip.com"] as const;
  const observations = await Promise.all(services.map(async (url) => {
    try {
    const response = await fetcher(url, {
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
      headers: { accept: "application/json,text/plain" },
    });
    if (!response.ok) return null;
    const raw = await response.text();
    if (raw.length > 1024) return null;
    const body = url.includes("ipify") ? JSON.parse(raw).ip : raw.trim();
    return typeof body === "string" && isIP(body) === 4 ? body : null;
    } catch { return null; }
  }));
  const valid = observations.filter((ip): ip is string => ip !== null);
  // Two independent observations are required; any disagreement fails closed.
  if (valid.length < 2 || new Set(valid).size !== 1) return { status: "IP_UNVERIFIED", observedIp: null };
  return { status: valid[0] === expected ? "IP_MATCH" : "IP_MISMATCH", observedIp: valid[0]! };
}
