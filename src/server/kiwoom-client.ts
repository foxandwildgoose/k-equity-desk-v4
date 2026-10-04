import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { isFlowDate } from "../lib/charts/hts-flow.ts";
import { credentialsStatus, KiwoomError, type KiwoomConfig } from "./kiwoom-config.ts";

export const KIWOOM_APIS = {
  credit: { id: "ka10013", path: "/api/dostk/stkinfo", array: "crd_trde_trend", field: "remn_rt" },
  foreign: { id: "ka10008", path: "/api/dostk/frgnistt", array: "stk_frgnr", field: "wght" },
  investmentTrust: {
    id: "ka10059",
    path: "/api/dostk/stkinfo",
    array: "stk_invsr_orgn",
    field: "invtrt",
  },
} as const;
/** Diagnostic only; never included in the three production metric adapters. */
export const KIWOOM_CROSS_CHECK_API = {
  id: "ka10015",
  path: "/api/dostk/stkinfo",
  array: "daly_trde_dtl",
} as const;
export type KiwoomApiId =
  (typeof KIWOOM_APIS)[keyof typeof KIWOOM_APIS]["id"] | typeof KIWOOM_CROSS_CHECK_API.id;
export interface KiwoomCoordination {
  exclusive<T>(
    key: string,
    run: (signal: AbortSignal) => Promise<T>,
    signal: AbortSignal,
  ): Promise<T>;
  /** Shared, atomic admission at actual dispatch time, across all processes. */
  admit(key: string, spacingMs: number, signal: AbortSignal): Promise<void>;
  readToken(key: string): Promise<{ encrypted: string; expires: number } | null>;
  writeToken(key: string, value: { encrypted: string; expires: number } | null): Promise<void>;
}
export function kiwoomCredentialKey(config: KiwoomConfig): string {
  return createHash("sha256")
    .update(`kiwoom-v1\0${config.environment}\0${config.appKey ?? ""}`)
    .digest("hex");
}
/** Official auth.py parses naive expires_dt as KST and converts to UTC. No host timezone dependence. */
export function parseKiwoomExpiry(value: unknown): number {
  if (typeof value !== "string" || !/^\d{14}$/.test(value))
    throw new KiwoomError("parsing", "키움 토큰 만료 필드 오류");
  const day = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  if (
    !isFlowDate(day) ||
    Number(value.slice(8, 10)) > 23 ||
    Number(value.slice(10, 12)) > 59 ||
    Number(value.slice(12, 14)) > 59
  )
    throw new KiwoomError("parsing", "키움 토큰 만료 날짜 오류");
  return Date.parse(
    `${day}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}+09:00`,
  );
}
export function waitKiwoom(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("요청 취소", "AbortError"));
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new DOMException("요청 취소", "AbortError"));
    };
    const timer = setTimeout(
      () => {
        signal.removeEventListener("abort", abort);
        resolve();
      },
      Math.max(0, ms),
    );
    signal.addEventListener("abort", abort, { once: true });
  });
}
/** Cancellation detaches a waiter; it never cancels shared authentication. */
export function detachedWait<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(new DOMException("요청 취소", "AbortError"));
    };
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
function codeOf(body: Record<string, unknown>): number {
  const raw = body.return_code;
  if ((typeof raw !== "string" && typeof raw !== "number") || !/^-?\d+$/.test(String(raw).trim()))
    throw new KiwoomError("parsing", "키움 필수 return_code 누락/오류");
  const code = Number(raw);
  if (code === 0) return 0;
  // Inspect only the official numeric error pattern; never forward return_msg.
  const embedded = String(body.return_msg ?? "").match(/\[(\d{3,5}):|CODE=(\d{3,5})/);
  return embedded ? Number(embedded[1] ?? embedded[2]) : code;
}
function businessError(code: number): KiwoomError {
  if ([1700, 1701, 1702].includes(code))
    return new KiwoomError("rate-limit", "키움 호출 제한", code);
  if ([8010, 8040, 8050, 8103].includes(code))
    return new KiwoomError("ip-check", "키움 IP/단말 인증 확인 필요", code);
  if ([8001, 8002, 8011, 8012, 8003, 8005, 8006, 8009, 8015, 8016, 8030, 8031].includes(code))
    return new KiwoomError("authentication", "키움 인증/환경 오류", code);
  return new KiwoomError("access", "키움 업무 요청 거절 · 권한/파라미터 확인 필요", code);
}
function retryAfter(value: string | null, now: number): number {
  if (!value) return 0;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value) * 1000;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? Math.max(0, instant - now) : 0;
}
export function createKiwoomClient(
  config: KiwoomConfig,
  coordination: KiwoomCoordination,
  options: {
    fetch?: typeof fetch;
    now?: () => number;
    timeoutMs?: number;
    retryBaseMs?: number;
    random?: () => number;
  } = {},
) {
  const fetcher = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const key = kiwoomCredentialKey(config);
  const tokenKey = `${key}:${config.expectedEgressIp ?? "unknown"}`;
  const encryptionKey = createHash("sha256")
    .update(`kiwoom-token-v1\0${config.appKey}\0${config.appSecret}`)
    .digest();
  const seal = (token: string) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
  };
  const open = (encrypted: string) => {
    const bytes = Buffer.from(encrypted, "base64");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
  };
  let sharedAuth: Promise<string> | null = null;
  async function post(
    path: string,
    apiId: string | null,
    body: Record<string, string>,
    signal: AbortSignal,
    token?: string,
  ) {
    for (let attempt = 0; ; attempt++) {
      signal.throwIfAborted();
      try {
        // Only these fixed endpoints can be reached, including all retries and authentication.
        await coordination.admit(key, Math.ceil(1000 / config.requestsPerSecond), signal);
        const response = await fetcher(
          `${config.environment === "real" ? "https://api.kiwoom.com" : "https://mockapi.kiwoom.com"}${path}`,
          {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.any([signal, AbortSignal.timeout(options.timeoutMs ?? 8_000)]),
            headers: {
              "Content-Type": "application/json;charset=UTF-8",
              ...(token ? { authorization: `Bearer ${token}` } : {}),
              ...(apiId
                ? { "api-id": apiId, "cont-yn": body.__cont ?? "N", "next-key": body.__next ?? "" }
                : {}),
            },
            body: JSON.stringify(
              Object.fromEntries(Object.entries(body).filter(([name]) => !name.startsWith("__"))),
            ),
          },
        );
        if (!response.ok)
          throw new KiwoomError(
            response.status === 401 || (!apiId && response.status === 403)
              ? "authentication"
              : response.status === 429
                ? "rate-limit"
                : response.status >= 500
                  ? "network"
                  : "access",
            `키움 HTTP ${response.status}`,
            response.status,
            retryAfter(response.headers.get("retry-after"), now()),
          );
        const raw = await response.text();
        if (raw.length > 2_000_000) throw new KiwoomError("parsing", "키움 응답 크기 초과");
        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          throw new KiwoomError("parsing", "키움 JSON 응답 오류");
        }
        if (!payload || typeof payload !== "object" || Array.isArray(payload))
          throw new KiwoomError("parsing", "키움 응답 객체 오류");
        const data = payload as Record<string, unknown>;
        const code = codeOf(data);
        if (code !== 0) throw businessError(code);
        return { body: data, headers: response.headers };
      } catch (rawError) {
        if (signal.aborted) throw new DOMException("요청 취소", "AbortError");
        const error =
          rawError instanceof KiwoomError
            ? rawError
            : new KiwoomError(
                rawError instanceof DOMException && rawError.name === "TimeoutError"
                  ? "timeout"
                  : "network",
                "키움 통신/시간 초과",
              );
        if (!["network", "timeout", "rate-limit"].includes(error.status) || attempt >= 2)
          throw error;
        const backoff = Math.max(
          error.retryAfterMs,
          (options.retryBaseMs ?? 300) * 2 ** attempt + (options.random ?? Math.random)() * 150,
        );
        // Respect a long Retry-After by ending this bounded operation, never retrying sooner.
        if (backoff > 10_000) throw error;
        await waitKiwoom(backoff, signal);
      }
    }
  }
  function accessToken(signal?: AbortSignal): Promise<string> {
    if (credentialsStatus(config) !== "CREDENTIALS_CONFIGURED")
      return Promise.reject(
        new KiwoomError("configuration", credentialsStatus(config), null, 0, "CREDENTIALS_MISSING"),
      );
    sharedAuth ??= coordination
      .exclusive(
        `token:${key}`,
        async (authSignal) => {
          const saved = await coordination.readToken(tokenKey);
          if (saved && saved.expires > now() + 60_000) {
            try {
              return open(saved.encrypted);
            } catch {
              /* Credentials rotated: issue anew. */
            }
          }
          const result = await post(
            "/oauth2/token",
            null,
            {
              grant_type: "client_credentials",
              appkey: config.appKey!,
              secretkey: config.appSecret!,
            },
            authSignal,
          );
          const { token, token_type: type, expires_dt: expiresDt } = result.body;
          if (
            typeof token !== "string" ||
            !token ||
            typeof type !== "string" ||
            type.toLowerCase() !== "bearer"
          )
            throw new KiwoomError("parsing", "키움 필수 token/token_type 오류");
          const expires = parseKiwoomExpiry(expiresDt);
          if (expires <= now() + 60_000)
            throw new KiwoomError("authentication", "키움 토큰 만료/서버시각 확인 필요");
          await coordination.writeToken(tokenKey, { encrypted: seal(token), expires });
          return token;
        },
        AbortSignal.timeout(30_000),
      )
      .finally(() => {
        sharedAuth = null;
      });
    return detachedWait(sharedAuth, signal);
  }
  return {
    authenticate: accessToken,
    async page(
      apiId: KiwoomApiId,
      body: Record<string, string>,
      signal: AbortSignal,
      continuation?: { nextKey: string },
    ) {
      const api = [...Object.values(KIWOOM_APIS), KIWOOM_CROSS_CHECK_API].find(
        (value) => value.id === apiId,
      );
      if (!api) throw new KiwoomError("configuration", "허용되지 않은 키움 API ID");
      let bearer = await accessToken(signal);
      const conditions = {
        ...body,
        __cont: continuation ? "Y" : "N",
        __next: continuation?.nextKey ?? "",
      };
      try {
        return await post(api.path, apiId, conditions, signal, bearer);
      } catch (error) {
        // 8031 is environment mismatch and 8103 ambiguous device auth: never mask those by refreshing.
        if (!(error instanceof KiwoomError) || error.code !== 8005) throw error;
        await coordination.exclusive(
          `token:${key}`,
          async () => {
            const saved = await coordination.readToken(tokenKey);
            if (saved) {
              try {
                if (open(saved.encrypted) !== bearer) return;
              } catch {
                /* rotated */
              }
            }
            await coordination.writeToken(tokenKey, null);
          },
          signal,
        );
        bearer = await accessToken(signal);
        return post(api.path, apiId, conditions, signal, bearer); // exactly one auth recovery
      }
    },
  };
}
