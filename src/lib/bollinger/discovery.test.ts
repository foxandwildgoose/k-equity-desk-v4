import test from "node:test";
import assert from "node:assert/strict";
import { analyzeDiscovery, discoveryConfigFromVersion, DISCOVERY_DEFAULTS, normalizeLongScore, sanitizeDiscoveryConfig } from "./discovery.ts";
import { evaluateDiscoveryAlerts } from "./alerts.ts";
import { discoveryBars, discoveryContexts } from "./discovery-fixture.test-data.ts";
import { discoveryDailyBars, isDiscoveryDay, membershipKnowledgeCutoff } from "./discovery-dates.ts";

test("daily labels reject impossible/mixed dates and normalize completed provider row order",()=>{
  assert.equal(isDiscoveryDay("2024-02-29"),true);assert.equal(isDiscoveryDay("2025-02-29"),false);assert.equal(isDiscoveryDay("2024-02-30"),false);
  const bars=discoveryBars(3);assert.deepEqual(discoveryDailyBars([...bars].reverse()),bars);
  assert.throws(()=>analyzeDiscovery([{...bars[0]!,date:"2024-02-30"}]),/INVALID_DAILY_DATE/);
  assert.throws(()=>analyzeDiscovery([{...bars[0]!,date:"2024-01-01 09:00"}]),/INVALID_DAILY_DATE/);
  assert.equal(membershipKnowledgeCutoff("2026-10-06","KR"),"2026-10-05T15:00:00.000Z");
  assert.equal(membershipKnowledgeCutoff("2026-10-06","US"),"2026-10-06T04:00:00.000Z");
  assert.equal(membershipKnowledgeCutoff("2026-01-06","US"),"2026-01-06T05:00:00.000Z");
  assert.equal(membershipKnowledgeCutoff("2026-11-01","US"),"2026-11-01T04:00:00.000Z");
  assert.equal(membershipKnowledgeCutoff("2026-03-08","US"),"2026-03-08T05:00:00.000Z");
});

test("directional score materially favors bullish trend, preserving chart engine",()=>{
  const bull=analyzeDiscovery(discoveryBars(),undefined,discoveryContexts(discoveryBars())).candidates.at(-1)!;
  const bear=analyzeDiscovery(discoveryBars(360,-1),undefined,discoveryContexts(discoveryBars(360,-1))).candidates.at(-1)!;
  assert.ok(bull.score.components.trend!.score!>=16);assert.ok(bear.score.components.trend!.score!<=4);
  assert.ok(bull.score.value!>bear.score.value!+15);assert.notEqual(bear.state,"ARMED");
});
test("unknown context is unavailable, excluded from denominator, not neutral/zero",()=>{
  const p=analyzeDiscovery(discoveryBars()).candidates.at(-1)!;
  assert.equal(p.score.components.market!.score,null);assert.equal(p.score.components.sector!.score,null);assert.equal(p.score.components.relativeStrength!.score,null);
  assert.equal(p.score.coverage,.775);assert.notEqual(p.state,"ARMED");
  assert.equal(normalizeLongScore({missing:{max:100,score:null,reason:"missing",availability:"unknown",inputs:{}}}).value,null);
});
test("default ARMED gates combine compression, bullish location, RSI, dry-up and coverage",()=>{
  const b=discoveryBars(),p=analyzeDiscovery(b,undefined,discoveryContexts(b)).candidates[302]!;
  assert.equal(p.state,"ARMED");assert.ok(p.views.includes("long-pre-breakout"));assert.ok(p.bbwPercentile!<=10);assert.ok(p.percentB!>=.65&&p.percentB!<=.95);
  assert.ok(p.rsi!>=50&&p.rsi!<=68&&p.rsiSlope!>0);assert.ok(p.distance!>=0&&p.distance!<=5);assert.ok(p.dryRvol!<=.9);assert.ok(p.score.coverage>=.8);
});
test("prefix invariance: future prices cannot alter historical resistance, state or score",()=>{
  const bars=discoveryBars(),contexts=discoveryContexts(bars),prefix=analyzeDiscovery(bars.slice(0,335),undefined,contexts);
  const full=analyzeDiscovery([...bars,...discoveryBars(10).map((b,i)=>({...b,date:`2025-01-${String(i+1).padStart(2,"0")}`,close:999,high:1000,low:998,open:999}))],undefined,contexts);
  assert.deepEqual(full.candidates.slice(0,335),prefix.candidates);assert.deepEqual(full.events.filter(e=>e.date<=bars[334]!.date),prefix.events);
});
test("current high excluded, incomplete candle excluded, warmup and zero volume honest",()=>{
  const bars=discoveryBars(210);const last=bars.at(-1)!;last.high=10000;
  const result=analyzeDiscovery(bars);assert.ok(result.candidates.at(-1)!.resistance!<10000);
  assert.equal(analyzeDiscovery([...bars,{...last,date:"2025-01-01",completed:false}]).candidates.length,210);
  assert.equal(result.candidates[100]!.state,"WARMUP");
  const missing=analyzeDiscovery(bars.map(b=>({...b,volume:0}))).candidates.at(-1)!;assert.equal(missing.dryRvol,null);assert.notEqual(missing.state,"ARMED");
});
test("resistance break requires close and volume; triggered boundary stays frozen",()=>{
  const bars=discoveryBars(340),config={...DISCOVERY_DEFAULTS,squeeze:100,compression:100,rsiMin:0,rsiMax:100,percentBMin:0,percentBMax:1.2,dryMax:3,armedScore:0,minCoverage:.5};
  const contexts=discoveryContexts(bars),before=analyzeDiscovery(bars,config,contexts).candidates.at(-1)!;
  assert.ok(["WATCH","ARMED"].includes(before.state));
  const prior=bars.at(-1)!,r=before.resistance!;
  const wick={...prior,date:"2025-01-01",high:r+5,close:r-.02,open:r-.03,low:r-.2,volume:5000};
  assert.notEqual(analyzeDiscovery([...bars,wick],config,{...contexts,...discoveryContexts([wick])}).candidates.at(-1)!.state,"TRIGGERED");
  const trigger={...wick,close:r+1,open:r+.5,high:r+2};
  const after={...trigger,date:"2025-01-02",close:r+1.5,high:r+20};
  const result=analyzeDiscovery([...bars,trigger,after],config,{...contexts,...discoveryContexts([trigger,after])});
  assert.equal(result.candidates.at(-2)!.state,"TRIGGERED");assert.equal(result.candidates.at(-1)!.trigger?.resistance,r);assert.equal(result.candidates.at(-1)!.state,"FOLLOW_THROUGH");
  assert.ok(result.events.some(e=>e.type==="volume-confirmed"));assert.equal(new Set(result.events.map(e=>e.id)).size,result.events.length);
  const failed={...after,date:"2025-01-03",close:r-1,open:r-1,low:r-2};
  assert.equal(analyzeDiscovery([...bars,trigger,after,failed],config,{...contexts,...discoveryContexts([trigger,after,failed])}).candidates.at(-1)!.state,"FAILED");
});
test("config finite validation, bounded values and deterministic cache identity",()=>{
  assert.deepEqual(sanitizeDiscoveryConfig({squeeze:NaN,minCoverage:"bad"}),DISCOVERY_DEFAULTS);
  const a=sanitizeDiscoveryConfig({squeeze:20}),b=sanitizeDiscoveryConfig({squeeze:20});assert.equal(a.version,b.version);assert.notEqual(a.version,DISCOVERY_DEFAULTS.version);
  assert.deepEqual(discoveryConfigFromVersion(a.version).config,a);assert.equal(discoveryConfigFromVersion("unknown").recognized,false);
  assert.equal(sanitizeDiscoveryConfig({resistanceLookback:200}).resistanceLookback,60);
});
test("cap and liquidity exclusions do not silently invent market cap",()=>{
  const b=discoveryBars(),c=discoveryContexts(b);
  const blocked=analyzeDiscovery(b,{minMarketCap:1e12},c).candidates[302]!;assert.equal(blocked.valid,false);assert.notEqual(blocked.state,"ARMED");
  assert.equal(analyzeDiscovery(b,{minMarketCap:1e12},c,"KR:test",{marketCap:2e12}).candidates[302]!.state,"ARMED");
});
test("advanced RS threshold and required market/sector gates are explicit and versioned",()=>{
  const bars=discoveryBars(),contexts=discoveryContexts(bars);
  const base=analyzeDiscovery(bars,undefined,contexts).candidates[302]!;
  const rs=analyzeDiscovery(bars,{rsMin:99},contexts).candidates[302]!;assert.equal(rs.score.components.relativeStrength!.score,0);assert.ok(rs.score.value!<base.score.value!);
  const missing=structuredClone(contexts);delete missing[bars[302]!.date]!.sector;
  assert.notEqual(analyzeDiscovery(bars,{requireSector:1},missing).candidates[302]!.state,"ARMED");
  assert.equal(analyzeDiscovery(bars,{requireMarket:1,requireSector:1},contexts).candidates[302]!.state,"ARMED");
});
test("discovery reuses active-session alert ledger, initial history is not delivered",()=>{
  const first={id:"KR:A:armed",date:"2026-10-05",type:"entered-armed" as const,triggerDate:null,delivery:"detected" as const},second={...first,id:"KR:A:trigger",date:"2026-10-06",type:"triggered" as const};
  const baseline=evaluateDiscoveryAlerts([first],null,"scope");assert.deepEqual(baseline.fired,[]);
  const next=evaluateDiscoveryAlerts([first,second],baseline.ledger,"scope");assert.equal(next.fired.length,1);assert.deepEqual(evaluateDiscoveryAlerts([first,second],next.ledger,"scope").fired,[]);
  const correction={...second,date:first.date},sameDay=evaluateDiscoveryAlerts([first,correction,correction],baseline.ledger,"scope");
  assert.equal(sameDay.fired.length,1);assert.deepEqual(evaluateDiscoveryAlerts([first,correction],sameDay.ledger,"scope").fired,[]);
});
