import test from "node:test";import assert from "node:assert/strict";
import { eventStudy, hitOrder, scoreBucket,studyFeatureHistory } from "./discovery-backtest.ts";
import { analyzeDiscovery } from "./discovery.ts";
import { discoveryBars,discoveryContexts,universe } from "./discovery-fixture.test-data.ts";
const options={start:"2024-01-01",end:"2025-02-01",developmentEnd:"2024-07-01",validationEnd:"2024-10-01",minimumSamples:30,allowCurrentResearch:false,commissionBps:5,slippageBps:10,configVersion:"test-v1"};
test("event study enters next open, valid horizons, costs, no last-row fabricated returns",()=>{
  const bars=discoveryBars(400),candidates=analyzeDiscovery(bars,undefined,discoveryContexts(bars)).candidates;
  const input={market:"KR" as const,symbol:"005930",bars,candidates,priceBasis:"raw-ohlcv-unverified-actions",benchmarkBars:bars};
  const r=eventStudy([input],[universe()],options),row=r.observations[0]!;
  assert.ok(row);assert.equal(row.date,"2024-10-29");assert.equal(row.entryDate,"2024-10-30");assert.equal(row.split,"out-of-sample");
  const signal=bars.findIndex(b=>b.date===row.date),entry=bars[signal+1]!;assert.equal(row.returnPct,(bars[signal+row.horizon]!.close/entry.open-1)*100);
  assert.ok(Math.abs(row.returnPct-row.netReturnPct-.3)<1e-9);assert.equal(row.returnPct,row.benchmarkReturn);
  assert.equal(r.researchOnly,true);assert.equal(r.survivorshipBiased,false);assert.ok(r.groups.every(g=>!g.reliable));assert.ok(r.groups.find(g=>g.horizon===60&&g.samples>0));
  assert.equal(row.failed,null);assert.equal(row.followThrough[1],null); // ARMED below resistance is not a failed breakout.
  const short=eventStudy([{...input,bars:bars.slice(0,305),candidates:candidates.slice(0,305)}],[universe()],options);assert.equal(short.observations.length,0);assert.ok(short.censored>0);
});
test("forward outcomes crossing development/validation split are embargoed",()=>{
  const bars=discoveryBars(),candidates=analyzeDiscovery(bars,undefined,discoveryContexts(bars)).candidates;
  const report=eventStudy([{market:"KR",symbol:"005930",bars,candidates,priceBasis:"yahoo-kr-raw-ohlcv"}],[universe()],{...options,developmentEnd:"2024-10-30",validationEnd:"2024-11-20"});
  assert.equal(report.observations.length,0);assert.ok(report.censored>0);
});
test("current membership is never silently treated as point-in-time",()=>{
  const bars=discoveryBars(),candidates=analyzeDiscovery(bars,undefined,discoveryContexts(bars)).candidates,input={market:"KR" as const,symbol:"005930",bars,candidates,priceBasis:"yahoo-kr-raw-ohlcv"};
  const current={...universe(),historical:false,asOf:"2026-10-06",knownAt:"2026-10-06T00:00:00Z"};
  const strict=eventStudy([input],[current],options);assert.equal(strict.observations.length,0);assert.ok(strict.membershipExcluded>0);
  const research=eventStudy([input],[current],{...options,allowCurrentResearch:true});assert.ok(research.observations.length);assert.equal(research.researchOnly,true);assert.ok(research.observations.every(r=>r.biased));
});
test("membership published on or after signal day cannot leak into strict PIT evidence",()=>{
  const bars=discoveryBars(400),candidates=analyzeDiscovery(bars,undefined,discoveryContexts(bars)).candidates;
  const input={market:"KR" as const,symbol:"005930",bars,candidates,priceBasis:"yahoo-kr-raw-ohlcv"};
  const late={...universe(),asOf:"2024-10-29",knownAt:"2024-10-29T08:00:00Z"};
  const report=eventStudy([input],[late],options);assert.equal(report.observations.length,0);assert.ok(report.membershipExcluded>0);
});
test("strict study uses historical precompute snapshots, not current-sector backfill",()=>{
  const candidate=analyzeDiscovery(discoveryBars(),undefined,discoveryContexts(discoveryBars())).candidates[302]!;
  const row={payload:candidate,price_basis:"yahoo-kr-raw-ohlcv"},historical=universe(),current={...historical,historical:false,knownAt:"2026-10-06T00:00:00Z"};
  assert.deepEqual(studyFeatureHistory([{snapshot:current,features:[row]}],"KR",false),[]);
  assert.equal(studyFeatureHistory([{snapshot:current,features:[row]},{snapshot:historical,features:[row]}],"KR",false).length,1);
  assert.equal(studyFeatureHistory([{snapshot:current,features:[row]}],"KR",true).length,1);
});
test("same-bar target and stop are ambiguous, not profitable by assumption",()=>{
  const b=discoveryBars(1)[0]!;assert.equal(hitOrder([{...b,high:110,low:90}],100,5,3),"ambiguous");assert.equal(hitOrder([{...b,high:106,low:99}],100,5,3),"target-first");assert.equal(hitOrder([{...b,high:101,low:95}],100,5,3),"stop-first");
  assert.equal(scoreBucket(null),"unavailable");assert.equal(scoreBucket(59.9),"0–59");assert.equal(scoreBucket(90),"90–100");
});
test("invalid splits, unsupported mixed basis and negative costs fail",()=>{
  assert.throws(()=>eventStudy([],[],{...options,validationEnd:"2023-01-01"}),/INVALID/);
  assert.throws(()=>eventStudy([],[],{...options,commissionBps:-1}),/INVALID/);
  assert.throws(()=>eventStudy([{market:"US",symbol:"AAPL",bars:[],candidates:[],priceBasis:"mixed"}],[],options),/PRICE_BASIS/);
});
