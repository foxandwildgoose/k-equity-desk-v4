import type { FlowRequest } from "../lib/charts/hts-flow.ts";

type TargetInstrument = FlowRequest["instrument"];
const ORIGIN = "https://m.stock.naver.com";
const MAX_BYTES = 128 * 1024;
const POSITIVE_TTL_MS = 60 * 60_000;
const NEGATIVE_TTL_MS = 30_000;
const MAX_INFLIGHT = 32;
const isInstrument = (value: unknown): value is TargetInstrument => value === "stock" || value === "etf" || value === "etn";

/** Listing metadata authorizes a new target; it never supplies any Kiwoom metric. */
export function createKiwoomTargetIdentityVerifier(options: {
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  cacheLimit?: number;
} = {}) {
  const fetcher = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const timeoutMs = Math.max(10, Math.min(options.timeoutMs ?? 4_000, 4_000));
  const cacheLimit = Math.max(1, Math.min(options.cacheLimit ?? 6_000, 6_000));
  const cache = new Map<string, { instrument: TargetInstrument | null; expires: number }>();
  const inflight = new Map<string, Promise<TargetInstrument | null>>();

  async function fetchIdentity(code: string): Promise<TargetInstrument | null> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<null>(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve(null); }, timeoutMs);
    });
    const work = async (): Promise<TargetInstrument | null> => {
      const response = await fetcher(`${ORIGIN}/api/stock/${code}/basic`, {
        redirect: "error", signal: controller.signal, headers: { accept: "application/json" },
      });
      if (!response.ok || !response.body) return null;
      if (response.url && new URL(response.url).origin !== ORIGIN) return null;
      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) return null;
      const reader = response.body.getReader();
      const cancel = () => { void reader.cancel().catch(() => {}); };
      controller.signal.addEventListener("abort", cancel, { once: true });
      const decoder = new TextDecoder();
      let bytes = 0, raw = "";
      try {
        while (!controller.signal.aborted) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > MAX_BYTES) return null;
          raw += decoder.decode(chunk.value, { stream: true });
        }
        if (controller.signal.aborted) return null;
        raw += decoder.decode();
        const body: unknown = JSON.parse(raw);
        if (!body || typeof body !== "object" || Array.isArray(body)) return null;
        const row = body as Record<string, unknown>;
        const exchange = row.stockExchangeType;
        if (row.itemCode !== code || !exchange || typeof exchange !== "object" || Array.isArray(exchange) ||
          (exchange as Record<string, unknown>).nationType !== "KOR" ||
          !isInstrument(row.stockEndType)) return null;
        return row.stockEndType;
      } finally {
        controller.signal.removeEventListener("abort", cancel);
        await reader.cancel().catch(() => {});
      }
    };
    try { return await Promise.race([work(), deadline]); }
    catch { return null; }
    finally { if (timer) clearTimeout(timer); }
  }

  return async (request: FlowRequest): Promise<boolean> => {
    if (request.market !== "KR" || !/^[0-9A-Z]{6}$/.test(request.code) || !isInstrument(request.instrument)) return false;
    const saved = cache.get(request.code);
    if (saved && saved.expires > now()) return saved.instrument === request.instrument;
    if (saved) cache.delete(request.code);
    let operation = inflight.get(request.code);
    if (!operation) {
      if (inflight.size >= MAX_INFLIGHT) return false;
      operation = fetchIdentity(request.code).then(instrument => {
        if (cache.size >= cacheLimit) cache.delete(cache.keys().next().value!);
        cache.set(request.code, { instrument, expires: now() + (instrument ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS) });
        return instrument;
      }).finally(() => { inflight.delete(request.code); });
      inflight.set(request.code, operation);
    }
    return (await operation) === request.instrument;
  };
}

export const verifyKiwoomTargetIdentity = createKiwoomTargetIdentityVerifier();
