import type { BollingerCollectionInput } from "./collection-request.ts";

export type DiscoveryRunReply = { status: string; jobs?: Record<string, unknown>[] };
export type DiscoveryRunResult = DiscoveryRunReply & { rounds: number };

/** Only durable counters count as progress; timestamps/spinners cannot prolong a stalled job. */
export function discoveryProgressFingerprint(reply: DiscoveryRunReply): string {
  return JSON.stringify((reply.jobs ?? []).map(job => [job.target, job.universeId, job.configVersion,
    job.phase, job.membershipRows, job.nextOffset, job.collected, job.provisional, job.computed,
    job.pendingCompute, job.errors, job.benchmarkFailures, job.computedSymbols]));
}

export function needsDiscoveryCollection(input: { status?: string; availability?: {
  selected: number; missingStored: number; stale: number; missingPriceHistory?: number; outdatedCalculation?: number;
}; incomplete: boolean }): boolean {
  return input.status === "READY" && !!input.availability && input.availability.selected > 0 &&
    (input.availability.missingStored > 0 || input.availability.stale > 0 || (input.availability.missingPriceHistory ?? 0) > 0 ||
      (input.availability.outdatedCalculation ?? 0) > 0 || input.incomplete);
}

/** Started only by a user action. Each bounded server request settles before the next one starts. */
export async function runDiscoveryCollection(input: BollingerCollectionInput, options: {
  request: (input: BollingerCollectionInput, signal: AbortSignal) => Promise<DiscoveryRunReply>;
  signal: AbortSignal;
  onRound: (reply: DiscoveryRunResult) => void | Promise<void>;
  delay?: (signal: AbortSignal) => Promise<void>;
  maxRounds?: number;
  maxUnchanged?: number;
  clock?: () => number;
  maxElapsedMs?: number;
}): Promise<DiscoveryRunResult> {
  const frozen = structuredClone(input);
  const maxRounds = Math.max(1, Math.min(20, options.maxRounds ?? 20));
  const maxUnchanged = Math.max(1, Math.min(3, options.maxUnchanged ?? 3));
  let previous: string | null = null, unchanged = 0;
  const clock = options.clock ?? Date.now, started = clock();
  const maxElapsedMs = Math.max(1, Math.min(30 * 60_000, options.maxElapsedMs ?? 30 * 60_000));
  let last: DiscoveryRunResult = { status: "STOPPED", rounds: 0 };
  for (let rounds = 1; rounds <= maxRounds; rounds++) {
    if (options.signal.aborted) return { ...last, status: "STOPPED" };
    if (clock() - started >= maxElapsedMs) return { ...last, status: "CONTINUATION_LIMIT" };
    let reply: DiscoveryRunReply;
    try { reply = await options.request(structuredClone(frozen), options.signal); }
    catch { return { ...last, status: options.signal.aborted ? "STOPPED" : "NETWORK_FAILED" }; }
    if (options.signal.aborted) return { ...last, status: "STOPPED" };
    last = { ...reply, rounds };
    await options.onRound(last);
    if (reply.status !== "PARTIAL_BUDGET") return last;
    const fingerprint = discoveryProgressFingerprint(reply);
    unchanged = fingerprint === previous ? unchanged + 1 : 0;
    previous = fingerprint;
    if (unchanged >= maxUnchanged) return { ...last, status: "NO_PROGRESS" };
    if (rounds === maxRounds) return { ...last, status: "CONTINUATION_LIMIT" };
    try { await options.delay?.(options.signal); }
    catch { return { ...last, status: options.signal.aborted ? "STOPPED" : "NETWORK_FAILED" }; }
  }
  return last;
}
