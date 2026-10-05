import test from "node:test";
import assert from "node:assert/strict";
import { completedPriceBars } from "./bar-completion.ts";
import { bollingerFlowByDate } from "./flow-confirmation.ts";
import { analyzeBollinger } from "./engine.ts";
import { sanitizeBollingerSettings } from "./config.ts";
import { bollingerFinancialKey, evaluateBollingerAlerts, initialBollingerLedger, loadBollingerLedger, saveBollingerLedger } from "./alerts.ts";
import { bollingerToCsv } from "./export.ts";
import { emptyChartFlow, type FlowObservation } from "../charts/hts-flow.ts";
import type { BollingerAnalysis, BollingerEvent } from "./types.ts";

const cfg = sanitizeBollingerSettings({});
const bar = (date: string) => ({date,open:100,high:102,low:98,close:101,volume:100});
test("completion uses market local dates, conservative aggregate periods and minute end instants", () => {
  const nowMs = Date.parse("2026-10-05T01:07:00Z"); // Seoul10:07, NYpreviousday21:07
  assert.deepEqual(completedPriceBars([bar("2026-10-02"),bar("2026-10-05")], {market:"KR",interval:"day",nowMs}).map(b=>b.completed),[true,false]);
  assert.equal(completedPriceBars([bar("2026-10-04")],{market:"US",interval:"day",nowMs})[0]!.completed,false);
  assert.deepEqual(completedPriceBars([bar("2026-09-28"),bar("2026-10-05")],{market:"KR",interval:"week",nowMs}).map(b=>b.completed),[true,false]);
  assert.deepEqual(completedPriceBars([bar("2026-09-01"),bar("2026-10-01")],{market:"KR",interval:"month",nowMs}).map(b=>b.completed),[true,false]);
  assert.deepEqual(completedPriceBars([bar("2026-10-05 10:00"),bar("2026-10-05 10:05")],{market:"KR",interval:"minute",minuteSize:5,nowMs}).map(b=>b.completed),[true,false]);
  assert.equal(completedPriceBars([{...bar("2026-10-02"),completed:false}],{market:"KR",interval:"day",nowMs})[0]!.completed,false);
  const us = completedPriceBars([bar("2026-07-01 09:30"),bar("2026-01-02 09:30")],{market:"US",interval:"minute",minuteSize:5,nowMs:Date.parse("2026-07-01T13:36:00Z")});
  assert.ok(us.every(b=>b.completed));
});
const days = ["2026-09-21","2026-09-22","2026-09-23","2026-09-24","2026-09-25","2026-09-28"];
const flow = emptyChartFlow({code:"005930",market:"KR",instrument:"stock",exchange:"KRX",currency:"KRW",quantityUnit:"주",from:days[0]!,to:days.at(-1)!,interval:"day"});
const obs = (date:string,value:number,field:string):FlowObservation => ({date,value,unit:field==="wght"?"%":"주",source:"키움증권",sourceField:field,asOf:date,dateBasis:"trade-date",fetchedAt:`${date}T21:00:00+09:00`,availableAt:`${date}T20:00:00+09:00`,final:true,derived:false,provider:"kiwoom",environment:"real",marketScope:"KRX",parsingStatus:"valid"});
test("flow uses dated real published quantities and ownership pp, unknown publication never enters history", () => {
  const response = {...flow,foreign:{...flow.foreign,capability:"available" as const,observations:days.map((d,i)=>obs(d,50+i,"wght"))},investmentTrust:{...flow.investmentTrust,capability:"available" as const,observations:days.map(d=>obs(d,-12,"invtrt"))}};
  const value = bollingerFlowByDate([days.at(-1)!],response,{market:"KR",interval:"day",expectedDailyDates:days})[days.at(-1)!]!;
  assert.equal(value.foreignOwnershipChange,5); assert.equal(value.investmentTrustNet,-12); assert.equal(value.availability,"available");
  const early = bollingerFlowByDate([days.at(-1)!],response,{market:"KR",interval:"day",expectedDailyDates:days,nowMs:Date.parse("2026-09-28T10:00:00+09:00")})[days.at(-1)!]!;
  assert.equal(early.foreignOwnershipChange,null); assert.equal(early.investmentTrustNet,null);
  assert.equal(bollingerFlowByDate([days.at(-1)!],response,{market:"KR",interval:"day",expectedDailyDates:days,priceMarketScope:"NXT"})[days.at(-1)!]!.availability,"not-applicable");
  response.foreign.observations[0]!.availableAt = null;
  response.investmentTrust.observations.at(-1)!.availableAt = "2026-10-01T20:00:00+09:00";
  const missing = bollingerFlowByDate([days.at(-1)!],response,{market:"KR",interval:"day",expectedDailyDates:days})[days.at(-1)!]!;
  assert.equal(missing.foreignOwnershipChange,null); assert.equal(missing.investmentTrustNet,null);
  assert.equal(bollingerFlowByDate([days.at(-1)!],response,{market:"US",interval:"day",expectedDailyDates:days})[days.at(-1)!]!.availability,"not-applicable");
  response.foreign.observations[0]!.availableAt = `${days[0]}T20:00:00`;
  assert.equal(bollingerFlowByDate([days.at(-1)!],response,{market:"KR",interval:"day",expectedDailyDates:days})[days.at(-1)!]!.foreignOwnershipChange,null);
  response.foreign.observations[0]!.availableAt = `${days[0]}T20:00:00+09:00`;
  response.foreign.observations[1]!.marketScope = "NXT";
  assert.equal(bollingerFlowByDate([days.at(-1)!],response,{market:"KR",interval:"day",expectedDailyDates:days})[days.at(-1)!]!.foreignOwnershipChange,null);
});
test("same-window bars receive causal preroll values and CSV retains nulls/text safely", () => {
  const bars = Array.from({length:250},(_,i)=>({...bar(new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10)),open:100+i,high:102+i,low:98+i,close:101+i,completed:true}));
  const analysis = analyzeBollinger(bars,cfg,{market:"US"});
  assert.notEqual(analysis.points[199]!.sma200,null);
  assert.equal(analysis.points[143]!.bbwSamples,125);
  assert.notEqual(analysis.points[143]!.bbwPercentile,null);
  assert.equal(analysis.points[142]!.bbwPercentile,null);
  for (const n of [150,200,249]) assert.deepEqual(analyzeBollinger(bars.slice(0,n),cfg,{market:"US"}).points.at(-1),analysis.points[n-1]);
  const csv = bollingerToCsv(analysis.points.slice(0,1),cfg,"=CMD(1)");
  assert.ok(csv.includes("BBW_percentile")); assert.ok(csv.includes("\"'=")); assert.ok(csv.includes('""')); assert.ok(!csv.includes("undefined"));
});
test("local alerts baseline, masterOFF, repeated identities and three-stage ledger remain deduplicated", () => {
  const bars = days.map(d=>({...bar(d),completed:true}));
  const baseline = analyzeBollinger(bars.slice(0,3),cfg,{market:"KR"});
  const ledger = initialBollingerLedger(baseline);
  const events:BollingerEvent[] = [
    {type:"squeeze",index:3,date:days[3]!,direction:"neutral",stage:1,id:"squeeze1"},
    {type:"upper-breakout",index:4,date:days[4]!,direction:"bullish",stage:2,id:"break1"},
    {type:"volume-confirmed",index:5,date:days[5]!,direction:"bullish",stage:3,id:"vol1"},
  ];
  const current:BollingerAnalysis = {...analyzeBollinger(bars,cfg),events};
  const enabled={...cfg,alerts:true};
  const result = evaluateBollingerAlerts(current,enabled,ledger,"KR:005930:day");
  assert.deepEqual(result.fired.map(e=>e.stage),[1,2,3]);
  assert.equal(evaluateBollingerAlerts(current,enabled,result.ledger,"KR:005930:day").fired.length,0);
  assert.equal(evaluateBollingerAlerts(current,{...enabled,enabled:false},ledger,"KR:005930:day").fired.length,0);
  assert.equal(evaluateBollingerAlerts(current,enabled,initialBollingerLedger(current),"KR:005930:day").fired.length,0);
  const map=new Map<string,string>(); const storage={getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value);},removeItem:(key:string)=>{map.delete(key);}};
  saveBollingerLedger(storage,"key",result.ledger); assert.deepEqual(loadBollingerLedger(storage,"key"),result.ledger);
  assert.doesNotThrow(()=>saveBollingerLedger({ ...storage,setItem:()=>{throw Error("blocked");}},"key",result.ledger));
});
test("alert financial identities reset for changed rules, not presentation", () => {
  assert.notEqual(bollingerFinancialKey(cfg),bollingerFinancialKey({...cfg,walkThreshold:0.9}));
  assert.notEqual(bollingerFinancialKey(cfg),bollingerFinancialKey({...cfg,rvolThreshold:2}));
  assert.notEqual(bollingerFinancialKey(cfg),bollingerFinancialKey({...cfg,pivotRight:4}));
  assert.equal(bollingerFinancialKey(cfg),bollingerFinancialKey({...cfg,mode:"investment",overlay:false,overlayColor:"#112233"}));
});
