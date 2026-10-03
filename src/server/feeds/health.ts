/**
 * Per-source health (B0.5). In-memory per server instance (serverless
 * instances each keep their own view; the status page says so).
 */

export type AdapterPath = "v2" | "legacy" | "html" | "rss" | "json" | "fallback";

export interface SourceHealth {
  id: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  httpStatus: number | null;
  latencyMs: number | null;
  itemCount: number | null;
  newestPublishedAt: string | null;
  consecutiveFailures: number;
  circuit: "closed" | "open";
  circuitUntil: string | null;
  circuitOpens: number;
  adapterPath: AdapterPath | null;
  lastError: string | null;
  /** Keyed notes, e.g. { "unresolved": "미해결 심볼: FANUY" }. */
  notes: Record<string, string>;
}

const store = new Map<string, SourceHealth>();

function blank(id: string): SourceHealth {
  return {
    id,
    lastAttemptAt: null,
    lastSuccessAt: null,
    httpStatus: null,
    latencyMs: null,
    itemCount: null,
    newestPublishedAt: null,
    consecutiveFailures: 0,
    circuit: "closed",
    circuitUntil: null,
    circuitOpens: 0,
    adapterPath: null,
    lastError: null,
    notes: {},
  };
}

export function healthOf(id: string): SourceHealth {
  let h = store.get(id);
  if (!h) {
    h = blank(id);
    store.set(id, h);
  }
  return h;
}

export function allHealth(): SourceHealth[] {
  return [...store.values()].map((h) => ({ ...h, notes: { ...h.notes } }));
}

/** One HTTP attempt finished (success or failure). */
export function recordAttempt(
  id: string,
  r: { ok: boolean; status: number | null; latencyMs: number; error?: string | null },
): void {
  const h = healthOf(id);
  const now = new Date().toISOString();
  h.lastAttemptAt = now;
  h.httpStatus = r.status;
  h.latencyMs = r.latencyMs;
  if (r.ok) {
    h.lastSuccessAt = now;
    h.consecutiveFailures = 0;
    h.lastError = null;
  } else {
    h.consecutiveFailures += 1;
    h.lastError = r.error ?? (r.status ? `HTTP ${r.status}` : "network error");
  }
}

/** Parsed output of a source (after an attempt). */
export function recordResult(
  id: string,
  r: { count: number; newestPublishedAt?: string | null; adapterPath?: AdapterPath | null },
): void {
  const h = healthOf(id);
  h.itemCount = r.count;
  if (r.newestPublishedAt !== undefined) h.newestPublishedAt = r.newestPublishedAt;
  if (r.adapterPath !== undefined) h.adapterPath = r.adapterPath;
}

/** A failure outside HTTP (parse-fail, adapter error). */
export function recordFailure(id: string, error: string): void {
  const h = healthOf(id);
  h.lastAttemptAt = new Date().toISOString();
  h.consecutiveFailures += 1;
  h.lastError = error;
}

const CIRCUIT_MS = 15 * 60_000;
const CIRCUIT_REPEAT_MS = 30 * 60_000;

/** 403/429 → open the circuit (15 min, 30 min on a repeat). */
export function openCircuit(id: string, status: number): void {
  const h = healthOf(id);
  const ms = h.circuitOpens > 0 ? CIRCUIT_REPEAT_MS : CIRCUIT_MS;
  h.circuitOpens += 1;
  h.circuit = "open";
  h.circuitUntil = new Date(Date.now() + ms).toISOString();
  h.lastError = `HTTP ${status} — ${Math.round(ms / 60_000)}분간 요청 중단 (circuit)`;
}

export function isCircuitOpen(id: string, now = Date.now()): boolean {
  const h = store.get(id);
  if (!h || h.circuit !== "open" || !h.circuitUntil) return false;
  if (Date.parse(h.circuitUntil) <= now) {
    h.circuit = "closed";
    h.circuitUntil = null;
    return false;
  }
  return true;
}

export function setHealthNote(id: string, key: string, text: string | null): void {
  const h = healthOf(id);
  if (text) h.notes[key] = text;
  else delete h.notes[key];
}

/** Test helper. */
export function resetHealth(): void {
  store.clear();
}
