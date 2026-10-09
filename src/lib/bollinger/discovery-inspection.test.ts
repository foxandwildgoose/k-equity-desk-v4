import test from "node:test";
import assert from "node:assert/strict";
import { analyzeDiscovery, sanitizeDiscoveryConfig, STRATEGIES, type Candidate } from "./discovery.ts";
import { discoveryBars, discoveryContexts } from "./discovery-fixture.test-data.ts";
import { discoverySituation, discoveryStrategyDescription, discoveryStrategyReasons, discoveryStrategyRequiredInputs, inspectDiscoveryCandidate } from "./discovery-inspection.ts";

const bars=discoveryBars(303);
const candidate=analyzeDiscovery(bars,undefined,discoveryContexts(bars)).candidates.at(-1)!;
const conditions={strategy:"long-pre-breakout" as const,minScore:0,minCoverage:.8,asOf:candidate.date};
test("inspection retains missing, warmup, stale, coverage, strategy and score exclusions in screener order",()=>{
  assert.deepEqual(inspectDiscoveryCandidate(null,conditions).assessment,"NO_COMPUTED_HISTORY");
  assert.equal(inspectDiscoveryCandidate({...candidate,valid:false,score:{...candidate.score,coverage:0}},conditions).assessment,"WARMUP");
  assert.equal(inspectDiscoveryCandidate({...candidate,date:"2024-01-02"},conditions).assessment,"STALE");
  assert.equal(inspectDiscoveryCandidate({...candidate,score:{...candidate.score,coverage:.7}},conditions).assessment,"LOW_COVERAGE");
  assert.equal(inspectDiscoveryCandidate({...candidate,views:[]},conditions).assessment,"STRATEGY_MISMATCH");
  assert.equal(inspectDiscoveryCandidate({...candidate,score:{...candidate.score,value:null}},conditions).assessment,"DATA_UNAVAILABLE");
  assert.equal(inspectDiscoveryCandidate({...candidate,score:{...candidate.score,value:0}},{...conditions,minScore:1}).assessment,"LOW_SCORE");
  assert.equal(inspectDiscoveryCandidate(candidate,conditions).matched,true);
});
test("strategy tabs apply independent persisted flags and explanations rather than repeating Long gates",()=>{
  const observed={...candidate,state:"NEUTRAL" as const,views:[],bbwPercentile:30,percentB:.6,rvol:.8,trigger:null,trend:"bullish" as const};
  const explanations=STRATEGIES.map(strategy=>discoveryStrategyReasons(observed,strategy).reasons.join(" "));
  assert.equal(new Set(explanations).size,STRATEGIES.length);
  const squeeze=discoveryStrategyReasons(observed,"squeeze-watch");assert.equal(squeeze.reasons.length,1);assert.match(squeeze.reasons[0]!,/BBW.*30\.0.*10/);assert.doesNotMatch(squeeze.reasons.join(" "),/RSI|저항 거리|건조/);
  assert.match(discoveryStrategyReasons(observed,"pullback").reasons.join(" "),/%B.*0\.60.*0\.2.*0\.5/);
  assert.match(discoveryStrategyReasons(observed,"mean-reversion-watch").reasons.join(" "),/중립/);
  assert.match(discoveryStrategyReasons(observed,"follow-through").reasons.join(" "),/유효 돌파/);
  assert.match(discoveryStrategyReasons(observed,"failed-breakout").reasons.join(" "),/되밀림/);
  for(const strategy of STRATEGIES){
    const flagged={...observed,views:[strategy]};
    assert.equal(inspectDiscoveryCandidate(flagged,{...conditions,strategy}).assessment,"MATCH");
    for(const other of STRATEGIES.filter(s=>s!==strategy))assert.equal(inspectDiscoveryCandidate(flagged,{...conditions,strategy:other}).matched,false);
  }
});
test("unknown strategy inputs and null scores stay distinct from a known failed criterion",()=>{
  const incomplete={...candidate,state:"NEUTRAL" as const,views:[],bbwPercentile:null};
  const unknown=inspectDiscoveryCandidate(incomplete,{...conditions,strategy:"squeeze-watch"});assert.equal(unknown.assessment,"DATA_UNAVAILABLE");assert.match(unknown.reasons[0]!,/BBW.*資料|BBW.*자료/);
  const known=inspectDiscoveryCandidate({...incomplete,bbwPercentile:50},{...conditions,strategy:"squeeze-watch"});assert.equal(known.assessment,"STRATEGY_MISMATCH");assert.match(known.reasons[0]!,/50\.0/);
  const noMomentum={...candidate,state:"NEUTRAL" as const,views:["squeeze-watch" as const],bbwPercentile:5,rsi:null,rsiSlope:null};
  assert.equal(inspectDiscoveryCandidate(noMomentum,{...conditions,strategy:"squeeze-watch"}).matched,true);
  assert.equal(inspectDiscoveryCandidate(noMomentum,conditions).assessment,"DATA_UNAVAILABLE");
  const unknownTrend={...candidate,state:"NEUTRAL" as const,views:[],trend:null};assert.equal(inspectDiscoveryCandidate(unknownTrend,{...conditions,strategy:"mean-reversion-watch"}).assessment,"DATA_UNAVAILABLE");
  // The actual recorded lower-breakdown flag may be valid even when an unrelated trend field is unavailable.
  assert.equal(inspectDiscoveryCandidate({...unknownTrend,views:["bear-breakdown"]},{...conditions,strategy:"bear-breakdown"}).matched,true);
});
test("strategy criteria follow recognized configuration while optional market data never becomes a required squeeze gate",()=>{
  const config=sanitizeDiscoveryConfig({squeeze:7,compression:15,triggerRvol:2,distanceMax:3,requireMarket:1,requireSector:1});
  assert.match(discoveryStrategyDescription("squeeze-watch",config.version),/7%/);
  assert.match(discoveryStrategyDescription("triggered",config.version),/2배/);
  assert.match(discoveryStrategyDescription("long-pre-breakout",config.version),/0~3%/);
  assert.ok(discoveryStrategyRequiredInputs("long-pre-breakout",config.version).numeric.includes("score.components.market.score"));
  assert.deepEqual(discoveryStrategyRequiredInputs("squeeze-watch",config.version),{numeric:["bbwPercentile"],text:[]});
  assert.ok(!discoveryStrategyRequiredInputs("long-pre-breakout").numeric.includes("score.components.market.score"));
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
