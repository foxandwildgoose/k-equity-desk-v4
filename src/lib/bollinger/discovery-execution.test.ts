import assert from "node:assert/strict";
import test from "node:test";
import { applyDiscoverySearch, discoverySearchSignature, discoveryResultState, DISCOVERY_EXECUTION_LABELS } from "./discovery-execution.ts";

const draft = () => ({ universeId: "kospi-snapshot", configVersion: "long-daily-2.0.0", strategy: "long-pre-breakout" as const,
  selection: { top: 100 as const, minWeight: 0, sectors: ["IT"] }, symbols: ["KR:005930"],
  minScore: 0, minCoverage: .8, sort: "score" as const, asOf: "2026-10-09" });
test("executed search freezes universe, filters, symbols and market date without following subsequent draft edits", () => {
  const editing = draft(), applied = applyDiscoverySearch(editing, "2026-10-09");
  editing.selection.sectors.push("finance"); editing.symbols.push("KR:000660"); editing.minCoverage = .2;
  assert.deepEqual(applied.selection.sectors, ["IT"]); assert.deepEqual(applied.symbols, ["KR:005930"]);
  assert.equal(applied.minCoverage, .8); assert.equal(applied.asOf, "2026-10-09");
  assert.notEqual(discoverySearchSignature(editing), discoverySearchSignature(applied));
});
test("request identity includes strategy, version, independent filters and sort, ignores duplicate symbol order", () => {
  const original = draft(), key = discoverySearchSignature(original);
  for (const change of [{ strategy: "squeeze-watch" as const }, { universeId: "another" }, { configVersion: "new" },
    { minScore: 50 }, { minCoverage: .9 }, { sort: "distance" as const }, { asOf: "2026-10-02" }, { selection: { ...original.selection, top: 20 as const } }]) {
    assert.notEqual(discoverySearchSignature({ ...original, ...change }), key);
  }
  assert.equal(discoverySearchSignature({ ...original, symbols: ["KR:005930", "KR:005930"] }), key);
  assert.notEqual(discoverySearchSignature({ ...original, symbols: [] }), discoverySearchSignature({ ...original, symbols: undefined }));
});
test("historical lookup changes reference date explicitly without relabeling it as today's search", () => {
  const original = draft(), historical = applyDiscoverySearch(original, "2026-10-02");
  assert.equal(original.asOf, "2026-10-09"); assert.equal(historical.asOf, "2026-10-02");
  assert.notEqual(discoverySearchSignature(original), discoverySearchSignature(historical));
});
test("result state separates never executed, empty selection, missing history, partial coverage and legitimate zero matches", () => {
  const baseline = { applied: true, fetching: false, failed: false, status: "READY", selected: 100, stored: 20, missingStored: 80, matched: 0 };
  assert.equal(discoveryResultState({ ...baseline, applied: false }), "not-started");
  assert.equal(discoveryResultState({ ...baseline, fetching: true }), "running");
  assert.equal(discoveryResultState({ ...baseline, failed: true }), "failed");
  assert.equal(discoveryResultState({ ...baseline, selected: 0 }), "empty-selection");
  assert.equal(discoveryResultState({ ...baseline, stored: 0 }), "no-history");
  assert.equal(discoveryResultState(baseline), "partial");
  assert.equal(discoveryResultState({ ...baseline, stored: 100, missingStored: 0 }), "no-matches");
  assert.equal(discoveryResultState({ ...baseline, stored: 100, missingStored: 0, matched: 1 }), "complete");
  assert.equal(discoveryResultState({ ...baseline, status: "DATABASE_QUERY_FAILED" }), "failed");
});
test("inactive persisted phases are visibly paused or interrupted, never called background execution", () => {
  assert.match(DISCOVERY_EXECUTION_LABELS.PAUSED, /이어받기 대기/);
  assert.match(DISCOVERY_EXECUTION_LABELS.INTERRUPTED, /중단/);
  assert.equal(DISCOVERY_EXECUTION_LABELS.RUNNING, "실행 중");
});
