import test from "node:test";
import assert from "node:assert/strict";
import { analyzeDiscovery, type Candidate } from "./discovery.ts";
import { discoveryBars, discoveryContexts } from "./discovery-fixture.test-data.ts";
import { discoverySituation, inspectDiscoveryCandidate } from "./discovery-inspection.ts";

const bars=discoveryBars(303);
const candidate=analyzeDiscovery(bars,undefined,discoveryContexts(bars)).candidates.at(-1)!;
const conditions={strategy:"long-pre-breakout" as const,minScore:0,minCoverage:.8,asOf:candidate.date};
test("inspection retains missing, warmup, stale, coverage, strategy and score exclusions in screener order",()=>{
  assert.deepEqual(inspectDiscoveryCandidate(null,conditions).assessment,"NO_COMPUTED_HISTORY");
  assert.equal(inspectDiscoveryCandidate({...candidate,valid:false,score:{...candidate.score,coverage:0}},conditions).assessment,"WARMUP");
  assert.equal(inspectDiscoveryCandidate({...candidate,date:"2024-01-02"},conditions).assessment,"STALE");
  assert.equal(inspectDiscoveryCandidate({...candidate,score:{...candidate.score,coverage:.7}},conditions).assessment,"LOW_COVERAGE");
  assert.equal(inspectDiscoveryCandidate({...candidate,views:[]},conditions).assessment,"STRATEGY_MISMATCH");
  assert.equal(inspectDiscoveryCandidate({...candidate,score:{...candidate.score,value:null}},conditions).assessment,"LOW_SCORE");
  assert.equal(inspectDiscoveryCandidate({...candidate,score:{...candidate.score,value:0}},{...conditions,minScore:1}).assessment,"LOW_SCORE");
  assert.equal(inspectDiscoveryCandidate(candidate,conditions).matched,true);
});
test("recent previous completed trading date stays visible and future/invalid dates never match",()=>{
  assert.equal(inspectDiscoveryCandidate(candidate,{...conditions,asOf:"2024-10-30"}).matched,true);
  assert.equal(inspectDiscoveryCandidate(candidate,{...conditions,asOf:"2024-10-28"}).assessment,"STALE");
  assert.equal(inspectDiscoveryCandidate({...candidate,date:"not-a-date"},conditions).matched,false);
});
test("situations describe nonmatches and stored states without turning a missing observation into zero",()=>{
  assert.equal(discoverySituation(null).label,"분석 자료 미확보");
  const stateLabels={ARMED:"돌파 준비",TRIGGERED:"거래량 동반 돌파",FOLLOW_THROUGH:"돌파 후 유지",FAILED:"돌파 후 되밀림"};
  for(const [state,label] of Object.entries(stateLabels))assert.equal(discoverySituation({...candidate,state:state as Candidate["state"]}).label,label);
  assert.equal(discoverySituation({...candidate,state:"NEUTRAL",views:[],extended:false,gates:{...candidate.gates,bullish:true}}).label,"상승 추세 관찰");
  assert.equal(discoverySituation({...candidate,valid:false}).label,"분석 준비 중");
  const missing=inspectDiscoveryCandidate(null,conditions);assert.equal(missing.matched,false);assert.ok(missing.reasons.some(r=>r.includes("최종 계산")));
});
