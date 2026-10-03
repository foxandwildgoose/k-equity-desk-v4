/**
 * Source runner: maps registry ids → adapter functions, runs them with health
 * bookkeeping, and powers `/status/sources` retries. Adapters register
 * themselves via `registerAdapter` (see `src/server/feeds/adapters/index.ts`).
 */
import { recordFailure, recordResult, type AdapterPath } from "./health.ts";
import { FetchPolicyError, sourceRunnable } from "./http.ts";
import type { FeedItem } from "../../lib/feed/types.ts";

export interface AdapterRunOptions {
  bypassCache?: boolean;
  now?: number;
}

export interface AdapterOutput {
  items: FeedItem[];
  adapterPath?: AdapterPath;
}

export type Adapter = (opts: AdapterRunOptions) => Promise<AdapterOutput>;

const adapters = new Map<string, Adapter>();

export function registerAdapter(id: string, fn: Adapter): void {
  adapters.set(id, fn);
}

export function hasAdapter(id: string): boolean {
  return adapters.has(id);
}

export type RunState = "ok" | "empty" | "disabled" | "circuit-open" | "timeout" | "error" | "no-adapter";

export interface RunResult {
  id: string;
  state: RunState;
  items: FeedItem[];
  error?: string;
  ms: number;
}

function newest(items: FeedItem[]): string | null {
  let best: string | null = null;
  for (const it of items) if (it.publishedAt && (!best || it.publishedAt > best)) best = it.publishedAt;
  return best;
}

/** Run one source with a hard per-source timeout. Never throws. */
export async function runSource(id: string, opts: AdapterRunOptions & { timeoutMs?: number } = {}): Promise<RunResult> {
  const started = Date.now();
  const run = sourceRunnable(id);
  if (!run.ok) return { id, state: "disabled", items: [], error: run.reason, ms: 0 };
  const fn = adapters.get(id);
  if (!fn) return { id, state: "no-adapter", items: [], ms: 0 };
  const timeoutMs = opts.timeoutMs ?? 7_500;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const out = await Promise.race([
      fn(opts),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("source timeout")), timeoutMs);
      }),
    ]);
    recordResult(id, { count: out.items.length, newestPublishedAt: newest(out.items), adapterPath: out.adapterPath ?? null });
    return { id, state: out.items.length ? "ok" : "empty", items: out.items, ms: Date.now() - started };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof FetchPolicyError) {
      if (err.code === "circuit-open") return { id, state: "circuit-open", items: [], error: msg, ms: Date.now() - started };
      if (err.code === "source-disabled") return { id, state: "disabled", items: [], error: msg, ms: 0 };
    }
    const timeout = /timeout/i.test(msg);
    recordFailure(id, timeout ? "timeout" : msg.slice(0, 200));
    return { id, state: timeout ? "timeout" : "error", items: [], error: msg, ms: Date.now() - started };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Fan out to many sources under a global budget. Returns whatever arrived by
 * the deadline; sources still running are reported as `timeout` (partial).
 */
export async function runSources(
  ids: string[],
  opts: AdapterRunOptions & { budgetMs?: number; perSourceMs?: number } = {},
): Promise<{ results: RunResult[]; partial: boolean }> {
  const budget = opts.budgetMs ?? 8_000;
  const settled = new Map<string, RunResult>();
  const tasks = ids.map((id) =>
    runSource(id, { ...opts, timeoutMs: Math.min(opts.perSourceMs ?? 7_000, budget - 250) }).then((r) => {
      settled.set(id, r);
    }),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.all(tasks),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, budget);
    }),
  ]);
  if (timer) clearTimeout(timer);
  const results = ids.map((id) => settled.get(id) ?? { id, state: "timeout" as const, items: [], error: "budget exceeded", ms: budget });
  const partial = results.some((r) => r.state === "timeout" || r.state === "error" || r.state === "circuit-open");
  return { results, partial };
}
