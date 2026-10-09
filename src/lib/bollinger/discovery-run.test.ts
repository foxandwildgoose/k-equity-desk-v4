import test from "node:test";
import assert from "node:assert/strict";
import { runDiscoveryCollection, needsDiscoveryCollection } from "./discovery-run.ts";

const input = { universeId: "KOSPI-test", configVersion: "long-daily-2.0.0", selection: { top: 20 as const, minWeight: 0, sectors: [] as string[] } };
test("missing selected analyses start collection; zero matches and historical complete data do not", () => {
  const base = { status: "READY", availability: { selected: 20, missingStored: 0, stale: 0 }, incomplete: false };
  assert.equal(needsDiscoveryCollection(base), false);
  assert.equal(needsDiscoveryCollection({ ...base, availability: { ...base.availability, missingStored: 8 } }), true);
  assert.equal(needsDiscoveryCollection({ ...base, incomplete: true }), true);
  assert.equal(needsDiscoveryCollection({ ...base, availability: { ...base.availability, missingPriceHistory: 1 } }), true);
  assert.equal(needsDiscoveryCollection({ ...base, availability: { ...base.availability, outdatedCalculation: 1 } }), true);
  assert.equal(needsDiscoveryCollection({ ...base, status: "DATABASE_QUERY_FAILED", incomplete: true }), false);
  assert.equal(needsDiscoveryCollection({ ...base, availability: { ...base.availability, selected: 0 }, incomplete: true }), false);
});
test("explicit run resumes serially to completion with immutable selection", async () => {
  let active = 0, maximum = 0, calls = 0;
  const statuses: string[] = [];
  const result = await runDiscoveryCollection(input, { signal: new AbortController().signal,
    request: async (request) => {
      assert.deepEqual(request, input); active++; maximum = Math.max(maximum, active); calls++;
      request.selection.sectors.push("ignored-mutation");
      await Promise.resolve(); active--;
      return { status: calls === 3 ? "COMPLETE" : "PARTIAL_BUDGET", jobs: [{ computed: calls * 5 }] };
    }, onRound: value => { statuses.push(value.status); } });
  assert.equal(result.status, "COMPLETE"); assert.equal(result.rounds, 3); assert.equal(maximum, 1);
  assert.deepEqual(statuses, ["PARTIAL_BUDGET", "PARTIAL_BUDGET", "COMPLETE"]);
  assert.deepEqual(input.selection.sectors, []);
});
test("permanent failures and stock errors never cause an automatic retry storm", async () => {
  for (const status of ["PARTIAL_ERRORS", "UNAUTHORIZED", "ALREADY_RUNNING", "COMPUTE_FAILED", "COMPLETE_WITH_WARNINGS", "UP_TO_DATE"]) {
    let calls = 0;
    const result = await runDiscoveryCollection(input, { signal: new AbortController().signal,
      request: async () => { calls++; return { status }; }, onRound: () => {} });
    assert.equal(result.status, status); assert.equal(calls, 1);
  }
});
test("stalled durable progress and a changing but too-long run have hard limits", async () => {
  let calls = 0;
  const stalled = await runDiscoveryCollection(input, { signal: new AbortController().signal,
    request: async () => { calls++; return { status: "PARTIAL_BUDGET", jobs: [{ computed: 3, lastRunAt: calls }] }; }, onRound: () => {} });
  assert.equal(stalled.status, "NO_PROGRESS"); assert.equal(calls, 4);
  const bounded = await runDiscoveryCollection(input, { signal: new AbortController().signal, maxRounds: 2,
    request: async () => ({ status: "PARTIAL_BUDGET", jobs: [{ computed: ++calls }] }), onRound: () => {} });
  assert.equal(bounded.status, "CONTINUATION_LIMIT"); assert.equal(bounded.rounds, 2);
});
test("cancel stops the next request; already committed server work is not described as undone", async () => {
  const controller = new AbortController(); let calls = 0;
  const result = await runDiscoveryCollection(input, { signal: controller.signal,
    request: async () => { calls++; return { status: "PARTIAL_BUDGET", jobs: [{ computed: 3 }] }; },
    onRound: () => { controller.abort(); } });
  assert.equal(result.status, "STOPPED"); assert.equal(calls, 1);
});
test("elapsed-time limit prevents starting another server request even when progress increases", async () => {
  let now = 0, calls = 0;
  const result = await runDiscoveryCollection(input, { signal: new AbortController().signal, clock: () => now, maxElapsedMs: 1500,
    request: async () => { now += 1000; calls++; return { status: "PARTIAL_BUDGET", jobs: [{ computed: calls }] }; }, onRound: () => {} });
  assert.equal(result.status, "CONTINUATION_LIMIT"); assert.equal(calls, 2); assert.equal(result.rounds, 2);
});
