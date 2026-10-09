import assert from "node:assert/strict";
import test from "node:test";
import { applyDiscoverySearch, applyDiscoveryStrategy, discoveryCollectionSelectionSignature, discoverySearchSignature, discoveryResultState, discoveryBootstrapTarget, discoveryCollectionRequest, canBindBootstrapToDraft, saveDiscoveryBootstrapIntent, loadDiscoveryBootstrapIntent, DISCOVERY_BOOTSTRAP_SESSION_KEY, DISCOVERY_EXECUTION_LABELS } from "./discovery-execution.ts";

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
test("strategy and read filters change the results without changing a resumable collection selection", () => {
  const original=applyDiscoverySearch({...draft(),bootstrapTarget:"KOSDAQ"},"2026-10-09");
  const next=applyDiscoveryStrategy(original,"squeeze-watch");
  assert.equal(original.strategy,"long-pre-breakout");assert.equal(next.strategy,"squeeze-watch");
  assert.notEqual(discoverySearchSignature(next),discoverySearchSignature(original));
  assert.equal(discoveryCollectionSelectionSignature(next),discoveryCollectionSelectionSignature(original));
  assert.deepEqual(discoveryCollectionRequest(next),discoveryCollectionRequest(original));
  assert.equal(discoveryCollectionSelectionSignature({...next,minScore:70,minCoverage:.95,sort:"distance",asOf:"2026-10-02"}),discoveryCollectionSelectionSignature(original));
  for(const change of [{universeId:"other"},{configVersion:"other"},{selection:{...next.selection,top:20 as const}},{symbols:["KR:000660"]}])assert.notEqual(discoveryCollectionSelectionSignature({...next,...change}),discoveryCollectionSelectionSignature(original));
  const missing={...original,universeId:""};
  assert.equal(canBindBootstrapToDraft(missing,{...missing,strategy:"squeeze-watch"},"acquired","KOSDAQ"),true);
});
test("supported missing universes have explicit bootstrap targets while verified index membership is never substituted", () => {
  assert.equal(discoveryBootstrapTarget("KOSDAQ", ""), "KOSDAQ");
  assert.equal(discoveryBootstrapTarget("NASDAQ_LISTED", ""), "NASDAQ_LISTED");
  for (const kind of ["SP500", "NASDAQ100", "WATCHLIST", "MANUAL"] as const) assert.equal(discoveryBootstrapTarget(kind, ""), null);
  assert.equal(discoveryBootstrapTarget("ETF", "069500"), "ETF:069500");
  assert.equal(discoveryBootstrapTarget("ETF", "KODEX"), null); assert.equal(discoveryBootstrapTarget("ETF", "QQQ"), null);
});
test("bootstrap operation retains exact progress scope after binding acquired snapshot and keeps search choices frozen", () => {
  const intent = applyDiscoverySearch({ ...draft(), universeId: "", bootstrapTarget: "KOSDAQ" }, "2026-10-09");
  const request = discoveryCollectionRequest(intent);
  assert.ok(request && "bootstrapTarget" in request); assert.equal(request.bootstrapTarget, "KOSDAQ");
  assert.deepEqual(discoveryCollectionRequest({ ...intent, universeId: "actual-kosdaq" }), request);
  assert.notEqual(discoverySearchSignature(intent), discoverySearchSignature({ ...intent, bootstrapTarget: "KOSPI" }));
  assert.equal(canBindBootstrapToDraft(intent, intent, "actual-kosdaq", "KOSDAQ"), true);
  assert.equal(canBindBootstrapToDraft(intent, { ...intent, universeId: "actual-kosdaq", bootstrapTarget: undefined }, "actual-kosdaq", "KOSDAQ"), true);
  assert.equal(canBindBootstrapToDraft(intent, intent, "actual-kosdaq", "KOSPI"), false);
  assert.equal(canBindBootstrapToDraft(intent, { ...intent, selection: { ...intent.selection, top: 20 } }, "actual-kosdaq", "KOSDAQ"), false);
  assert.equal(canBindBootstrapToDraft(intent, { ...intent, universeId: "user-selected-other" }, "actual-kosdaq", "KOSDAQ"), false);
  assert.equal(discoveryCollectionRequest({ ...draft(), universeId: "", bootstrapTarget: undefined }), null);
});
test("reload restores bounded public bootstrap intent, including acquired ID, without replacing exact resume scope", () => {
  const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const intent=applyDiscoverySearch({...draft(),universeId:"actual-kosdaq",bootstrapTarget:"KOSDAQ",selection:{top:20,minWeight:0,sectors:[]}},"2026-10-09");
  saveDiscoveryBootstrapIntent(storage,intent);
  const restored=loadDiscoveryBootstrapIntent(storage);assert.deepEqual(restored,intent);
  assert.deepEqual(discoveryCollectionRequest(restored!),discoveryCollectionRequest(intent));
  assert.doesNotMatch(values.get(DISCOVERY_BOOTSTRAP_SESSION_KEY)!,/secret|token|authorized|cookie/i);
  saveDiscoveryBootstrapIntent(storage,draft());assert.equal(loadDiscoveryBootstrapIntent(storage),null);
  values.set(DISCOVERY_BOOTSTRAP_SESSION_KEY,"{invalid");assert.equal(loadDiscoveryBootstrapIntent(storage),null);
  values.set(DISCOVERY_BOOTSTRAP_SESSION_KEY,JSON.stringify({v:1,search:{...intent,secret:"not-allowed"}}));assert.equal(loadDiscoveryBootstrapIntent(storage),null);
  values.set(DISCOVERY_BOOTSTRAP_SESSION_KEY,JSON.stringify({v:1,search:{...intent,selection:{...intent.selection,top:999}}}));assert.equal(loadDiscoveryBootstrapIntent(storage),null);
  const blocked={getItem:()=>{throw new Error("blocked");},setItem:()=>{throw new Error("blocked");},removeItem:()=>{throw new Error("blocked");}};
  assert.equal(loadDiscoveryBootstrapIntent(blocked),null);assert.doesNotThrow(()=>saveDiscoveryBootstrapIntent(blocked,intent));
});
