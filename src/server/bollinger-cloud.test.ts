import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PGlite } from "@electric-sql/pglite";
import { createDiscoveryStore } from "./bollinger-discovery-store.ts";
import { readBollingerCloudConfig, cloudJobScope, safeCloudJob } from "./bollinger-cloud-config.ts";
import { handleBollingerCloud } from "./bollinger-cloud-handler.ts";
import { runBollingerCloud, type CloudProviders } from "./bollinger-cloud.ts";
import { fetchKrMembershipBatch, koreaDay } from "./bollinger-membership.ts";
import { collectDiscovery, contextHistory, precomputeDiscovery } from "./bollinger-discovery-jobs.ts";
import { discoveryBars, member, universe } from "../lib/bollinger/discovery-fixture.test-data.ts";
import { DISCOVERY_DEFAULTS } from "../lib/bollinger/discovery.ts";
const migration=await readFile(new URL("../../migrations/0005_bollinger_discovery.sql",import.meta.url),"utf8");
const SECRET="QA_ONLY_NOT_A_REAL_OPERATOR_SECRET_12345";
const environment={BOLLINGER_CLOUD_ENABLED:"true",CRON_SECRET:SECRET};
const config=readBollingerCloudConfig(environment);
async function database(path?:string) {
  const pg=new PGlite(path);await pg.waitReady;await pg.exec(migration);
  const store=createDiscoveryStore({query:async<T>(sql:string,params:unknown[]=[]) => (await pg.query<T>(sql,params)).rows});
  return {pg,store};
}
const time=()=>Date.parse("2024-10-29T09:30:00Z");
function providers(count=2):CloudProviders {
  // A current-provider receipt is known at collection time, not the fixture's old membership date.
  return {membership:async()=>({progress:null,snapshot:{...universe(Array.from({length:count},(_,i)=>({...member(String(500000+i)),marketCap:(100-i)*1e12}))),knownAt:new Date(time()).toISOString(),fetchedAt:new Date(time()).toISOString(),historical:false}}),prices:async()=>({bars:discoveryBars(303),basis:"yahoo-kr-raw-ohlcv",source:"QA SYNTHETIC"}),benchmark:async()=>({bars:discoveryBars(303),source:"QA SYNTHETIC INDEX"})};
}
test("cloud defaults fit a bounded KOSPI Top20 job and serialize no secret",()=>{
  const defaults=readBollingerCloudConfig({});assert.equal(defaults.enabled,false);assert.equal(defaults.secretConfigured,false);
  assert.deepEqual(defaults.targets,["KOSPI"]);assert.equal(defaults.top,20);assert.equal(defaults.budgetSeconds,180);
  assert.equal(config.secretValid,true);assert.doesNotMatch(JSON.stringify(config),new RegExp(SECRET));
  for(const override of [{CRON_SECRET:"short"},{CRON_SECRET:" "+SECRET},{BOLLINGER_CLOUD_TARGETS:"http://untrusted.example"},{BOLLINGER_CLOUD_TOP:"3"},{BOLLINGER_CLOUD_BUDGET_SECONDS:"301"},{BOLLINGER_CLOUD_TARGETS:"ETF:069500",BOLLINGER_CLOUD_TOP:"200"}]) {
    const value=readBollingerCloudConfig({...environment,...override});assert.equal(value.secretValid&&value.configurationValid,false);
  }
});
test("operator authorization blocks anonymous/wrong secrets and query strings before any write",async()=>{
  let runs=0;const run=async()=>{runs++;return{status:"OK"};};
  const req=(authorization?:string,url="https://personal.example/api/cron/bollinger")=>new Request(url,{headers:authorization?{authorization}:undefined});
  assert.equal((await handleBollingerCloud(req(),run,environment)).status,401);
  assert.equal((await handleBollingerCloud(req("Bearer wrong"),run,environment)).status,401);
  assert.equal((await handleBollingerCloud(req(`Bearer ${SECRET}`,"https://personal.example/api/cron/bollinger?owner=anything"),run,environment)).status,400);
  assert.equal((await handleBollingerCloud(req(),run,{})).status,503);assert.equal(runs,0);
  const disabled=await handleBollingerCloud(req(`Bearer ${SECRET}`),run,{...environment,BOLLINGER_CLOUD_ENABLED:"false"});assert.equal((await disabled.json()).status,"DISABLED");assert.equal(runs,0);
  const preview=await handleBollingerCloud(req(`Bearer ${SECRET}`),run,{...environment,VERCEL_ENV:"preview"});assert.equal(preview.status,409);assert.equal(runs,0);
  const allowed=await handleBollingerCloud(req(`Bearer ${SECRET}`),run,environment);assert.equal(allowed.status,200);assert.equal(runs,1);assert.equal(allowed.headers.get("cache-control"),"no-store");
});
test("operator failure returns only an allowlisted reason, no raw provider/DB secret",async()=>{
  const req=new Request("https://personal.example/api/cron/bollinger",{headers:{authorization:`Bearer ${SECRET}`}});
  const response=await handleBollingerCloud(req,async()=>{throw new Error(`private ${SECRET}`);},environment);
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{status:"COLLECTION_FAILED"});
  const missing=await handleBollingerCloud(req,async()=>{throw new Error("DATABASE_MISSING");},environment);assert.equal((await missing.json()).status,"DATABASE_MISSING");
});
const listing=(symbols:string[],total:number)=>new Response(JSON.stringify({totalCount:total,stocks:symbols.map(itemCode=>({itemCode,stockName:`QA ${itemCode}`,stockEndType:"stock",marketValue:"1,234",localTradedAt:"2026-10-06T15:30:00"}))}),{headers:{"content-type":"application/json"}});
test("listing pagination resumes by actual page; a partial listing is never published",async()=>{
  const urls:string[]=[],fetcher=(async(url:RequestInfo|URL)=>{urls.push(String(url));return listing(urls.length===1?["005930","000660"]:["403870"],3);}) as typeof fetch;
  const first=await fetchKrMembershipBatch("KOSPI",null,{fetcher,maxPages:1,spacingMs:0,now:()=>"2026-10-06T09:00:00Z"});
  assert.equal(first.snapshot,null);assert.equal(first.progress.nextPage,2);
  const second=await fetchKrMembershipBatch("KOSPI",first.progress,{fetcher,maxPages:1,spacingMs:0,now:()=>"2026-10-06T09:01:00Z"});
  assert.equal(second.snapshot?.members.length,3);assert.match(urls[1]!,/page=2&/);assert.equal(second.snapshot?.knownAt,"2026-10-06T09:01:00Z");
  assert.equal(second.snapshot?.members[0]?.marketCap,1234e8);assert.equal(second.snapshot?.historical,false);
});
test("listing rejects repeated/empty pages, changed totals and malformed responses",async()=>{
  const first=await fetchKrMembershipBatch("KOSPI",null,{fetcher:(async()=>listing(["005930"],2)) as typeof fetch,maxPages:1,now:()=>"2026-10-06T09:00:00Z"});
  for(const response of [listing(["005930"],2),listing([],2),listing(["000660"],3),new Response('{}')]) {
    await assert.rejects(fetchKrMembershipBatch("KOSPI",first.progress,{fetcher:(async()=>response) as typeof fetch,maxPages:1,now:()=>"2026-10-06T09:00:00Z"}),/MEMBERSHIP/);
  }
});
test("listing cannot combine current-membership pages from different Korean dates",async()=>{
  const first=await fetchKrMembershipBatch("KOSPI",null,{fetcher:(async()=>listing(["005930"],2)) as typeof fetch,maxPages:1,now:()=>"2026-10-06T14:59:00Z"});
  const urls:string[]=[];
  const restarted=await fetchKrMembershipBatch("KOSPI",first.progress,{fetcher:(async(url)=>{urls.push(String(url));return listing(["000660"],2);}) as typeof fetch,maxPages:1,now:()=>"2026-10-06T15:01:00Z"});
  assert.equal(koreaDay("2026-10-06T15:01:00Z"),"2026-10-07");assert.match(urls[0]!,/page=1&/);assert.equal(restarted.progress.members[0]?.symbol,"000660");
});
test("bounded collection persists calculations from full pre-roll, not a 25-bar SMA",async()=>{
  const {pg,store}=await database();try{
    const u=universe(),bars=discoveryBars(303);await store.saveUniverse(u);await store.saveBars(member(),bars,"QA","yahoo-kr-raw-ohlcv","2024-10-29T09:00:00Z");
    await precomputeDiscovery(store,u.id,undefined,undefined,{recentDays:25});
    const history=await store.featureHistory(u.id,member(),DISCOVERY_DEFAULTS.version),contexts=await store.contextScope(u.id,"security:KR:005930");
    assert.equal(history.length,25);assert.equal(contexts.length,25);assert.equal(contexts[0]?.aboveSma200,contextHistory(bars,"QA").slice(-25)[0]?.aboveSma200);assert.notEqual(contexts[0]?.aboveSma200,null);
    const expected=bars.slice(79,279).reduce((sum,b)=>sum+b.close,0)/200,actual=history[0]?.payload.score.components.trend?.inputs.sma200;
    assert.equal(typeof actual,"number");assert.ok(Math.abs((actual as number)-expected)<1e-10);
  }finally{await pg.close();}
});
test("provisional cloud calculations do not publish signals before the peer refresh",async()=>{
  const {pg,store}=await database();try{
    const u=universe(),bars=discoveryBars(303);await store.saveUniverse(u);await store.saveBars(member(),bars,"QA","yahoo-kr-raw-ohlcv","2024-10-29T09:00:00Z");
    let eventWrites=0;const original=store.saveEvents;store.saveEvents=async(...args)=>{eventWrites++;return original(...args);};
    await precomputeDiscovery(store,u.id,undefined,undefined,{recentDays:25,storeEvents:false});assert.equal(eventWrites,0);
    await precomputeDiscovery(store,u.id,undefined,undefined,{recentDays:25,storeEvents:true});assert.equal(eventWrites,1);
  }finally{await pg.close();}
});
test("cloud → persisted frontend contract is scope-honest and same-day rerun avoids provider work",async()=>{
  const {pg,store}=await database();try{
    const p=providers(23);let prices=0;const price=p.prices;p.prices=async(...args)=>{prices++;return price(...args);};
    const result=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});assert.equal(result.status,"COMPLETE");assert.equal(prices,20);
    assert.equal(result.jobs[0]?.requested,20);assert.equal(result.jobs[0]?.supported,23);assert.equal(result.jobs[0]?.computed,20);
    const persisted=await store.latestJob(cloudJobScope("KOSPI",20));assert.equal(persisted?.status,"complete");
    const contract=await store.query({universeId:universe().id,configVersion:DISCOVERY_DEFAULTS.version,strategy:"squeeze-watch",selection:{top:20,minWeight:0,sectors:[]},page:1,pageSize:50,minScore:0,minCoverage:0,asOf:"2024-10-29"});
    assert.equal(contract.requestedCount,20);assert.equal(contract.pipeline.investible,20);assert.ok(contract.counts.length);assert.equal(contract.dates.last,"2024-10-29");
    assert.equal((await runBollingerCloud(store,config,p,{clock:time,spacingMs:0})).status,"UP_TO_DATE");assert.equal(prices,20);
  }finally{await pg.close();}
});
test("time budget saves pending computation and resumes after a separate DB instance restart",async()=>{
  const path=await mkdtemp(join(tmpdir(),"bollinger-cloud-test-"));try{
    const first=await database(path),p=providers();let elapsed=0,prices=0;const price=p.prices;
    p.prices=async(...args)=>{prices++;elapsed=170000;return price(...args);};
    const partial=await runBollingerCloud(first.store,config,p,{clock:()=>time()+elapsed,spacingMs:0});
    assert.equal(partial.status,"PARTIAL_BUDGET");assert.equal(partial.jobs[0]?.collected,1);assert.equal(partial.jobs[0]?.computed,0);await first.pg.close();
    const second=await database(path);elapsed=0;p.prices=async(...args)=>{prices++;return price(...args);};
    const resumed=await runBollingerCloud(second.store,config,p,{clock:()=>time()+elapsed,spacingMs:0});
    assert.equal(resumed.status,"COMPLETE");assert.equal(prices,2);assert.equal(resumed.jobs[0]?.computed,2);
    assert.equal((await second.store.universes()).length,1);await second.pg.close();
  }finally{await rm(path,{recursive:true,force:true});}
});
test("membership resumed on a new collection day does not trigger a redundant same-day refresh",async()=>{
  const {pg,store}=await database();try{
    let timestamp=time(),first=true;
    const p=providers(1);
    p.membership=async(_target,_previous,options)=>{
      if(first){first=false;timestamp+=170000;return{progress:null,snapshot:null};}
      await options.checkpoint();const now=new Date(timestamp).toISOString();
      return{progress:null,snapshot:{...universe([member()]),id:`KOSPI:${now}`,knownAt:now,fetchedAt:now,historical:false}};
    };
    assert.equal((await runBollingerCloud(store,config,p,{clock:()=>timestamp,spacingMs:0})).status,"PARTIAL_BUDGET");
    timestamp=time()+86400000;
    assert.equal((await runBollingerCloud(store,config,p,{clock:()=>timestamp,spacingMs:0})).status,"COMPLETE");
    assert.equal((await runBollingerCloud(store,config,p,{clock:()=>timestamp,spacingMs:0})).status,"UP_TO_DATE");
  }finally{await pg.close();}
});
test("global lease covers nested API and calculation work and blocks the local CLI too",async()=>{
  const {pg,store}=await database();try{
    const p=providers(1);let nested=false;
    p.prices=async()=>{
      assert.equal((await runBollingerCloud(store,config,providers(),{clock:time,spacingMs:0})).status,"ALREADY_RUNNING");
      await assert.rejects(collectDiscovery(store,universe().id,p.prices,{limit:1}),/ALREADY_RUNNING/);nested=true;
      return{bars:discoveryBars(303),source:"QA",basis:"yahoo-kr-raw-ohlcv"};
    };
    assert.equal((await runBollingerCloud(store,config,p,{clock:time,spacingMs:0})).status,"COMPLETE");assert.equal(nested,true);
    assert.equal(await store.lease("bollinger:daily-provider","after"),true);await store.release("bollinger:daily-provider","after");
  }finally{await pg.close();}
});
test("individual fetch failures preserve good bars and a subsequent run retries only errors",async()=>{
  const {pg,store}=await database();try{
    const p=providers(2),price=p.prices;let failed=true;const fetched:string[]=[];
    p.prices=async(m,initial)=>{fetched.push(m.symbol);if(failed&&m.symbol==="500001")throw new Error(`private error ${SECRET}`);return price(m,initial);};
    const partial=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});assert.equal(partial.status,"PARTIAL_ERRORS");assert.equal(partial.jobs[0]?.errors,1);assert.doesNotMatch(JSON.stringify(partial),new RegExp(SECRET));
    assert.equal((await store.bars("KR","500000","yahoo-kr-raw-ohlcv")).length,303);
    failed=false;const complete=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});assert.equal(complete.status,"COMPLETE");assert.deepEqual(fetched,["500000","500001","500001"]);
  }finally{await pg.close();}
});
test("missing benchmark is explicit rather than a complete real-data claim",async()=>{
  const {pg,store}=await database();try{
    const p=providers(1);p.benchmark=async()=>{throw new Error("private-provider-body");};
    const result=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});assert.equal(result.status,"COMPLETE_WITH_WARNINGS");assert.equal(result.jobs[0]?.benchmarkFailures,1);
    assert.doesNotMatch(JSON.stringify(result),/private-provider-body/);
  }finally{await pg.close();}
});
test("a zero-row or invalid-price provider response is not counted as stored history",async()=>{
  const {pg,store}=await database();try{
    const p=providers(1);p.prices=async()=>({bars:[{...discoveryBars(1)[0]!,close:NaN}],source:"QA",basis:"yahoo-kr-raw-ohlcv"});
    const result=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});assert.equal(result.status,"PARTIAL_ERRORS");assert.equal(result.jobs[0]?.collected,0);assert.equal(result.jobs[0]?.computed,0);
  }finally{await pg.close();}
});
test("job diagnostics never serialize arbitrary nested job fields",()=>{
  const value=safeCloudJob({phase:"collect",successfulKeys:["KR:005930"],computedKeys:[],lastError:SECRET,secret:SECRET,headers:{authorization:SECRET},membership:{members:[]}},"KOSPI");
  assert.equal(value.collected,1);assert.equal(value.lastError,null);assert.doesNotMatch(JSON.stringify(value),new RegExp(SECRET));
});
test("Hobby uses one daily cron and only the collector requests the maximum function duration",async()=>{
  const vercel=JSON.parse(await readFile(new URL("../../vercel.json",import.meta.url),"utf8"));assert.deepEqual(vercel.crons,[{path:"/api/cron/bollinger",schedule:"30 9 * * *"}]);
  const vite=await readFile(new URL("../../vite.config.ts",import.meta.url),"utf8");assert.match(vite,/functionRules:.*"\/api\/cron\/bollinger".*maxDuration: "max"/);
});
