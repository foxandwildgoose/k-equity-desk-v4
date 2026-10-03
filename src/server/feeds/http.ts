/**
 * `fetchWithPolicy` (B0.4): the only way feed adapters touch the network.
 *
 * - https only; host must be on the registry allowlist (SSRF guard)
 * - manual redirects: ≤ 3 hops, each re-checked against the allowlist
 * - ≤ 2 concurrent requests per host + a minimum interval between starts
 * - 5 MiB response cap; per-request timeout (≤ 8 s, ≤ 10 s for HTML/PDF)
 * - URL cache (TTL, LRU ≤ 500) + in-flight de-duplication
 * - one retry with jitter on timeout / 5xx
 * - 403/429 opens the source circuit (15 min, 30 min on repeat) → health
 */
import { SOURCE_REGISTRY, type SourceDef } from "./registry.ts";
import { decodeFeedBytes } from "../../lib/feed/rss-parse.ts";
import { isCircuitOpen, openCircuit, recordAttempt } from "./health.ts";

export const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_PER_HOST = 2;
const CACHE_MAX = 500;

export class FetchPolicyError extends Error {
  code: "non-https" | "host-not-allowed" | "circuit-open" | "source-disabled" | "too-many-redirects" | "too-large" | "bad-url";
  constructor(code: FetchPolicyError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "FetchPolicyError";
  }
}

export interface PolicyResponse {
  ok: boolean;
  status: number;
  url: string;
  contentType: string | null;
  text: string;
  latencyMs: number;
  fromCache: boolean;
}

export interface FetchPolicyOptions {
  sourceId: string;
  timeoutMs?: number;
  accept?: string;
  /** Force a charset instead of header/prolog detection. */
  charset?: string;
  headers?: Record<string, string>;
  /** Cache TTL (default: registry pollSec). 0 disables caching. */
  ttlMs?: number;
  /** Skip the cache once (still respects the circuit). */
  bypassCache?: boolean;
  method?: "GET" | "POST";
  body?: string;
}

const REGISTRY_BY_ID = new Map<string, SourceDef>(SOURCE_REGISTRY.map((s) => [s.id, s]));

function hostsOf(s: SourceDef): string[] {
  const out: string[] = [];
  for (const u of [s.url, s.probeUrl]) {
    if (!u) continue;
    try {
      out.push(new URL(u.replaceAll("{today}", "20260101").replaceAll("{startDate7}", "2026-01-01")).hostname);
    } catch {
      /* ignore */
    }
  }
  return [...out, ...(s.hosts ?? [])];
}

/** SSRF allowlist derived from the registry (all sources, enabled or not). */
export const ALLOWED_HOSTS: ReadonlySet<string> = new Set(SOURCE_REGISTRY.flatMap(hostsOf));

export function isAllowedUrl(raw: string): { ok: true; url: URL } | { ok: false; code: FetchPolicyError["code"] } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, code: "bad-url" };
  }
  if (u.protocol !== "https:") return { ok: false, code: "non-https" };
  if (!ALLOWED_HOSTS.has(u.hostname)) return { ok: false, code: "host-not-allowed" };
  if (u.username || u.password) return { ok: false, code: "bad-url" };
  return { ok: true, url: u };
}

/** Env kill switches + required env for a source. */
export function sourceRunnable(id: string): { ok: boolean; reason?: string } {
  const s = REGISTRY_BY_ID.get(id);
  if (!s) return { ok: false, reason: "레지스트리에 없음" };
  if (!s.enabled) return { ok: false, reason: s.status === "disabled" ? "비활성(폐지)" : "비활성(검증 전 후보)" };
  if (s.envFlag && String(process.env[s.envFlag] ?? "true").trim().toLowerCase() === "false") {
    return { ok: false, reason: `${s.envFlag}=false` };
  }
  const extraOff = (process.env.FEED_SOURCES_DISABLED ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (extraOff.includes(id)) return { ok: false, reason: "FEED_SOURCES_DISABLED" };
  const missing = (s.requiresEnv ?? []).filter((k) => !process.env[k]);
  if (missing.length) return { ok: false, reason: `환경변수 미설정: ${missing.join(", ")}` };
  return { ok: true };
}

export function secUserAgent(): string {
  return process.env.SEC_USER_AGENT?.trim() || "KoreaEquityDesk research@example.com";
}

const BROWSER_UA = "Mozilla/5.0 (compatible; KoreaEquityDesk/1.0) AppleWebKit/537.36";

function defaultHeaders(u: URL, accept?: string): Record<string, string> {
  const host = u.hostname;
  if (host.endsWith("sec.gov")) {
    return { "User-Agent": secUserAgent(), Accept: accept ?? "application/json,application/atom+xml,text/html;q=0.8" };
  }
  const h: Record<string, string> = {
    "User-Agent": BROWSER_UA,
    Accept: accept ?? "application/json,application/rss+xml,application/atom+xml,application/xml,text/xml,text/html;q=0.8,*/*;q=0.5",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
  };
  if (host === "stock.naver.com") h.Referer = "https://stock.naver.com/";
  else if (host.endsWith("naver.com")) h.Referer = "https://m.stock.naver.com/";
  return h;
}

// ── per-host concurrency + spacing ──────────────────────────────────────
const MIN_INTERVAL_MS: Record<string, number> = {
  "www.sec.gov": 130,
  "data.sec.gov": 130,
  "stock.naver.com": 300,
  "m.stock.naver.com": 250,
  "news.google.com": 200,
};
const hostState = new Map<string, { active: number; lastStart: number; queue: (() => void)[] }>();

async function acquire(host: string): Promise<() => void> {
  let st = hostState.get(host);
  if (!st) {
    st = { active: 0, lastStart: 0, queue: [] };
    hostState.set(host, st);
  }
  const s = st;
  if (s.active >= MAX_PER_HOST) await new Promise<void>((resolve) => s.queue.push(resolve));
  s.active += 1;
  const gap = (MIN_INTERVAL_MS[host] ?? 150) - (Date.now() - s.lastStart);
  if (gap > 0) await new Promise((r) => setTimeout(r, gap));
  s.lastStart = Date.now();
  return () => {
    s.active -= 1;
    const next = s.queue.shift();
    if (next) next();
  };
}

// ── cache + in-flight ───────────────────────────────────────────────────
const cache = new Map<string, { at: number; ttl: number; res: PolicyResponse }>();
const inflight = new Map<string, Promise<PolicyResponse>>();

function cacheGet(key: string): PolicyResponse | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > hit.ttl) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, hit);
  return { ...hit.res, fromCache: true };
}

function cacheSet(key: string, ttl: number, res: PolicyResponse): void {
  if (ttl <= 0) return;
  cache.set(key, { at: Date.now(), ttl, res });
  while (cache.size > CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

export function cacheSize(): number {
  return cache.size;
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const len = Number(res.headers.get("content-length") ?? "0");
  if (len > MAX_BYTES) throw new FetchPolicyError("too-large", `response ${len} bytes > 5 MiB`);
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new FetchPolicyError("too-large", "response exceeded 5 MiB");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

type FetchImpl = (input: string, init: RequestInit) => Promise<Response>;
let fetchImpl: FetchImpl = (input, init) => fetch(input, init);

/** Test hook: swap the network layer. */
export function __setFetchImpl(fn: FetchImpl | null): void {
  fetchImpl = fn ?? ((input, init) => fetch(input, init));
}

async function attempt(startUrl: string, opts: FetchPolicyOptions, timeoutMs: number): Promise<PolicyResponse> {
  let current = startUrl;
  const started = Date.now();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = isAllowedUrl(current);
    if (!check.ok) throw new FetchPolicyError(check.code, `${check.code}: ${current}`);
    const release = await acquire(check.url.hostname);
    let res: Response;
    try {
      res = await fetchImpl(current, {
        method: opts.method ?? "GET",
        body: opts.body,
        headers: { ...defaultHeaders(check.url, opts.accept), ...(opts.headers ?? {}) },
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } finally {
      release();
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      await res.body?.cancel().catch(() => undefined);
      continue;
    }
    const bytes = await readCapped(res);
    const contentType = res.headers.get("content-type");
    const text = opts.charset
      ? new TextDecoder(opts.charset).decode(bytes)
      : decodeFeedBytes(bytes, contentType);
    return { ok: res.ok, status: res.status, url: current, contentType, text, latencyMs: Date.now() - started, fromCache: false };
  }
  throw new FetchPolicyError("too-many-redirects", `more than ${MAX_REDIRECTS} redirects: ${startUrl}`);
}

function isTimeout(err: unknown): boolean {
  const e = err as { name?: string; cause?: { name?: string } } | null;
  return e?.name === "TimeoutError" || e?.name === "AbortError" || e?.cause?.name === "TimeoutError";
}

/**
 * Fetch `url` for registry source `sourceId` under the A4/B0.4 policy.
 * Throws `FetchPolicyError` for policy violations; returns non-2xx responses
 * with `ok: false` (after opening the circuit on 403/429).
 */
export async function fetchWithPolicy(url: string, opts: FetchPolicyOptions): Promise<PolicyResponse> {
  const run = sourceRunnable(opts.sourceId);
  if (!run.ok) throw new FetchPolicyError("source-disabled", run.reason ?? "disabled");
  if (isCircuitOpen(opts.sourceId)) throw new FetchPolicyError("circuit-open", `circuit open for ${opts.sourceId}`);
  const check = isAllowedUrl(url);
  if (!check.ok) throw new FetchPolicyError(check.code, `${check.code}: ${url}`);

  const def = REGISTRY_BY_ID.get(opts.sourceId);
  const ttl = opts.ttlMs ?? (def ? def.pollSec * 1000 : 60_000);
  const key = `${opts.method ?? "GET"} ${url} ${opts.body ?? ""}`;
  if (!opts.bypassCache) {
    const hit = cacheGet(key);
    if (hit) return hit;
    const pending = inflight.get(key);
    if (pending) return pending;
  }
  const timeoutMs = Math.min(opts.timeoutMs ?? 8_000, 10_000);

  const task = (async () => {
    let res: PolicyResponse | null = null;
    let lastErr: unknown = null;
    for (let i = 0; i < 2; i++) {
      try {
        res = await attempt(url, opts, timeoutMs);
        if (res.status >= 500 && i === 0) {
          recordAttempt(opts.sourceId, { ok: false, status: res.status, latencyMs: res.latencyMs });
          await new Promise((r) => setTimeout(r, 200 + Math.floor(Math.random() * 400)));
          continue;
        }
        break;
      } catch (err) {
        lastErr = err;
        if (err instanceof FetchPolicyError) throw err;
        if (i === 0 && isTimeout(err)) {
          await new Promise((r) => setTimeout(r, 200 + Math.floor(Math.random() * 400)));
          continue;
        }
        break;
      }
    }
    if (!res) {
      const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
      recordAttempt(opts.sourceId, { ok: false, status: null, latencyMs: timeoutMs, error: isTimeout(lastErr) ? "timeout" : msg });
      throw lastErr instanceof Error ? lastErr : new Error(msg);
    }
    recordAttempt(opts.sourceId, { ok: res.ok, status: res.status, latencyMs: res.latencyMs });
    if (res.status === 403 || res.status === 429) openCircuit(opts.sourceId, res.status);
    if (res.ok) cacheSet(key, ttl, res);
    return res;
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

/** JSON convenience wrapper: throws on non-2xx / invalid JSON. */
export async function fetchJsonWithPolicy<T>(url: string, opts: FetchPolicyOptions): Promise<T> {
  const res = await fetchWithPolicy(url, { accept: "application/json", ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(res.text) as T;
}
