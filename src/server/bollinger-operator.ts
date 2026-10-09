import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readBollingerCloudConfig } from "./bollinger-cloud-config.ts";

type Environment = Record<string, string | undefined>;
const COOKIE = "__Host-bollinger-operator";
const SESSION_SECONDS = 30 * 60;
const MAX_BODY_BYTES = 2048;
const SCOPE = "bollinger-collect";

/** This module never imports a database, provider, broker, or client auth fallback. */
function json(status: string, code: number, authorized?: boolean, cookie?: string): Response {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  if (cookie) headers.set("Set-Cookie", cookie);
  return Response.json(authorized === undefined ? { status } : { status, authorized }, { status: code, headers });
}

function configuredSecret(env: Environment): string | Response {
  const config = readBollingerCloudConfig(env);
  return config.secretValid
    ? env.CRON_SECRET!
    : json(config.secretConfigured ? "CRON_SECRET_INVALID" : "CRON_SECRET_MISSING", 503, false);
}

function requestOrigin(request: Request, env: Environment): string | null {
  const url = new URL(request.url);
  if (url.username || url.password || url.origin === "null") return null;
  if (url.protocol === "https:") return url.origin;
  // Secure cookies are retained in development too. Production never accepts plaintext unlocks.
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return url.protocol === "http:" && local && env.NODE_ENV !== "production" && !env.VERCEL ? url.origin : null;
}

function browserGuard(request: Request, env: Environment, mutation: boolean): Response | null {
  if (new URL(request.url).search) return json("QUERY_NOT_ALLOWED", 400);
  const origin = requestOrigin(request, env);
  if (!origin) return json("SECURE_ORIGIN_REQUIRED", 403);
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return json("CROSS_SITE_REQUEST_BLOCKED", 403);
  const incomingOrigin = request.headers.get("origin");
  if ((mutation || incomingOrigin !== null) && incomingOrigin !== origin) return json("CROSS_SITE_REQUEST_BLOCKED", 403);
  if (request.method === "POST" && !/^application\/json(?:\s*;[^\r\n]*)?$/i.test(request.headers.get("content-type") ?? "")) {
    return json("JSON_REQUIRED", 415);
  }
  return null;
}

function signature(encoded: string, secret: string): string {
  const key = createHmac("sha256", secret).update("bollinger:operator:key:v1").digest();
  return createHmac("sha256", key).update("bollinger:operator:session:v1\0").update(encoded).digest("base64url");
}

function constantMatch(left: string, right: string): boolean {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}

function issue(origin: string, secret: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const encoded = Buffer.from(JSON.stringify({ v: 1, scope: SCOPE, origin, iat, exp: iat + SESSION_SECONDS, nonce: randomBytes(16).toString("base64url") })).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

function operatorCookie(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  if (header.length > 16384) return null;
  const matches = header.split(";").map(part => part.trim()).filter(part => part.startsWith(`${COOKIE}=`));
  return matches.length === 1 ? matches[0]!.slice(COOKIE.length + 1) : null;
}

function sessionValid(request: Request, secret: string): boolean {
  const token = operatorCookie(request);
  if (!token || token.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [encoded, signed] = token.split(".");
  if (!constantMatch(signed!, signature(encoded!, secret))) return false;
  try {
    const payload: unknown = JSON.parse(Buffer.from(encoded!, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    const value = payload as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    return Object.keys(value).length === 6 && value.v === 1 && value.scope === SCOPE && value.origin === new URL(request.url).origin &&
      typeof value.iat === "number" && Number.isInteger(value.iat) && value.iat <= now &&
      typeof value.exp === "number" && Number.isInteger(value.exp) && value.exp > now && value.exp - value.iat === SESSION_SECONDS &&
      typeof value.nonce === "string" && /^[A-Za-z0-9_-]{22}$/.test(value.nonce);
  } catch { return false; }
}

function cookie(value: string, seconds: number): string {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
}

async function boundedBody(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new Error("INVALID_BODY");
  if (!request.body) throw new Error("INVALID_BODY");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("INVALID_BODY"); }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** Exchange an operator-owned secret once; only an expiring opaque HttpOnly cookie is issued. */
export async function handleBollingerOperator(request: Request, env: Environment = process.env): Promise<Response> {
  if (!["GET", "POST", "DELETE"].includes(request.method)) return json("METHOD_NOT_ALLOWED", 405);
  const blocked = browserGuard(request, env, request.method !== "GET");
  if (blocked) return blocked;
  if (request.method === "DELETE") return json("OPERATOR_SIGNED_OUT", 200, false, cookie("", 0));
  const secret = configuredSecret(env);
  if (secret instanceof Response) return secret;
  if (request.method === "GET") {
    const authorized = sessionValid(request, secret);
    return json(authorized ? "OPERATOR_AUTHORIZED" : "OPERATOR_AUTH_REQUIRED", 200, authorized);
  }
  let body: unknown;
  try { body = await boundedBody(request); } catch { return json("INVALID_BODY", 400, false); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json("INVALID_BODY", 400, false);
  const value = body as Record<string, unknown>;
  if (Object.keys(value).length !== 1 || typeof value.secret !== "string" || value.secret.length > 256) return json("INVALID_BODY", 400, false);
  if (!constantMatch(value.secret, secret)) return json("OPERATOR_AUTH_REQUIRED", 401, false);
  return json("OPERATOR_AUTHORIZED", 200, true, cookie(issue(new URL(request.url).origin, secret), SESSION_SECONDS));
}

/** Authentication is checked before a caller imports DB/provider modules or starts collection. */
export async function authorizeBollingerCollection(request: Request, env: Environment = process.env): Promise<Response | null> {
  if (request.method !== "POST") return json("METHOD_NOT_ALLOWED", 405);
  const blocked = browserGuard(request, env, true);
  if (blocked) return blocked;
  const secret = configuredSecret(env);
  if (secret instanceof Response) return secret;
  return sessionValid(request, secret) ? null : json("OPERATOR_AUTH_REQUIRED", 401);
}
