import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PGlite } from "@electric-sql/pglite";
import { createDiscoveryStore } from "./bollinger-discovery-store.ts";
import { readBollingerCloudConfig, cloudJobScope, safeCloudJob } from "./bollinger-cloud-config.ts";
import { handleBollingerCloud } from "./bollinger-cloud-handler.ts";
import { runBollingerCloud, runSelectedBollingerCloud, readSelectedBollingerProgress, selectedBollingerScope, runBootstrapBollingerCloud, readBootstrapBollingerProgress, bootstrapBollingerScope, type SelectedBollingerRequest, type CloudProviders } from "./bollinger-cloud.ts";
import { fetchKrMembershipBatch, koreaDay } from "./bollinger-membership.ts";
import { collectDiscovery, contextHistory, precomputeDiscovery, prepareDiscoveryContexts } from "./bollinger-discovery-jobs.ts";
import { discoveryBars, member, universe } from "../lib/bollinger/discovery-fixture.test-data.ts";
import { analyzeDiscovery, sanitizeDiscoveryConfig, DISCOVERY_DEFAULTS } from "../lib/bollinger/discovery.ts";
import type { BootstrapBollingerInput } from "../lib/bollinger/collection-request.ts";
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
test("public final-computation identities are validated symbols and legacy progress stays unconfirmed",()=>{
  const summary={schema:2,phase:"refresh",computedKeys:["KR:005930","KR:005930","KR:0233A0","US:BRK.B",SECRET,"Bearer private-token",{authorization:SECRET},null]};
  const safe=safeCloudJob(summary,"KOSPI");
  assert.deepEqual(safe.computedSymbols,["KR:005930","KR:0233A0","US:BRK.B"]);
  assert.doesNotMatch(JSON.stringify(safe),new RegExp(SECRET));
  assert.equal(safeCloudJob({...summary,schema:1},"KOSPI").computedSymbols,null);
  assert.equal(safeCloudJob(null,"KOSPI").computedSymbols,null);
});
test("Hobby uses one daily cron and only the collector requests the maximum function duration",async()=>{
  const vercel=JSON.parse(await readFile(new URL("../../vercel.json",import.meta.url),"utf8"));assert.deepEqual(vercel.crons,[{path:"/api/cron/bollinger",schedule:"30 9 * * *"}]);
  const vite=await readFile(new URL("../../vite.config.ts",import.meta.url),"utf8");assert.match(vite,/functionRules:.*"\/api\/cron\/bollinger".*maxDuration: "max"/);
  assert.doesNotMatch(vite,/deploymentConfig|config:\s*\{\s*crons:/,"the schedule belongs only in vercel.json, not generated Build Output API config");
});
const selectedRequest=(overrides:Partial<SelectedBollingerRequest>={}):SelectedBollingerRequest=>({universeId:universe().id,configVersion:DISCOVERY_DEFAULTS.version,selection:{top:10,minWeight:0,sectors:[]},...overrides});
test("selected collection freezes exact stored snapshot, sector and symbol intersection instead of cron Top20",async()=>{
  const {pg,store}=await database();try{
    const members=Array.from({length:30},(_,i)=>({...member(String(500000+i)),marketCap:(100-i)*1e12,sector:i%2?"Technology":"Healthcare"}));
    await store.saveUniverse(universe(members));const p=providers(),fetched:string[]=[];
    p.membership=async()=>{throw new Error("selected request must not replace the snapshot");};
    p.prices=async m=>{fetched.push(m.symbol);return{bars:discoveryBars(303),source:"QA",basis:"yahoo-kr-raw-ohlcv"};};
    const request=selectedRequest({selection:{top:10,minWeight:0,sectors:["Technology"]},symbols:["KR:500001","KR:500007","KR:500027"]});
    const result=await runSelectedBollingerCloud(store,config,p,request,{clock:time,spacingMs:0});
    assert.equal(result.status,"COMPLETE");assert.deepEqual(fetched,["500001","500007"]);
    assert.equal(result.jobs[0]?.requested,2);assert.equal(result.jobs[0]?.computed,2);assert.equal(result.jobs[0]?.provisional,2);assert.equal(result.jobs[0]?.execution,"COMPLETE");
    assert.equal(result.jobs[0]?.universeId,request.universeId);
    const progress=await readSelectedBollingerProgress(store,request);assert.equal(progress.jobs[0]?.execution,"COMPLETE");
    assert.equal((await runSelectedBollingerCloud(store,config,p,request,{clock:time,spacingMs:0})).status,"UP_TO_DATE");assert.equal(fetched.length,2);
  }finally{await pg.close();}
});
test("selected Top100 is the requested scope even when scheduled configuration is Top20",async()=>{
  const {pg,store}=await database();try{
    await store.saveUniverse(universe(Array.from({length:110},(_,i)=>({...member(String(500000+i)),marketCap:(110-i)*1e12}))));
    let elapsed=0;const p=providers();p.prices=async()=>{elapsed=170000;return{bars:discoveryBars(303),source:"QA",basis:"yahoo-kr-raw-ohlcv"};};
    const result=await runSelectedBollingerCloud(store,config,p,selectedRequest({selection:{top:100,minWeight:0,sectors:[]}}),{clock:()=>time()+elapsed,spacingMs:0});
    assert.equal(result.status,"PARTIAL_BUDGET");assert.equal(result.jobs[0]?.requested,100);assert.equal(result.jobs[0]?.supported,110);assert.equal(result.jobs[0]?.collected,1);assert.equal(result.jobs[0]?.computed,0);assert.equal(result.jobs[0]?.execution,"PAUSED");
  }finally{await pg.close();}
});
test("selected scope is deterministic, idempotent and separate across snapshot/config/top/symbols",()=>{
  const a=selectedRequest({selection:{top:10,minWeight:0,sectors:["Technology","Healthcare"]},symbols:["KR:005930","KR:000660"]});
  const b=selectedRequest({selection:{top:10,minWeight:0,sectors:["Healthcare","Technology","Technology"]},symbols:["KR:000660","KR:005930","KR:005930"]});
  assert.equal(selectedBollingerScope(a),selectedBollingerScope(b));
  for(const other of [selectedRequest({universeId:"another"}),selectedRequest({configVersion:sanitizeDiscoveryConfig({squeeze:12}).version}),selectedRequest({selection:{top:100,minWeight:0,sectors:[]}}),selectedRequest({symbols:[]})])assert.notEqual(selectedBollingerScope(a),selectedBollingerScope(other));
  assert.throws(()=>selectedBollingerScope(selectedRequest({configVersion:"forged"})),/CONFIGURATION_VERSION_INVALID/);
  assert.throws(()=>selectedBollingerScope(selectedRequest({symbols:["http://untrusted.example"]})),/SELECTION_INVALID/);
});
test("selected scope retains frozen security keys and configured engine version across a separate DB restart",async()=>{
  const path=await mkdtemp(join(tmpdir(),"bollinger-selected-test-"));try{
    const first=await database(path),members=[{...member("500000"),marketCap:2e12},member("500001")];await first.store.saveUniverse(universe(members));
    const version=sanitizeDiscoveryConfig({squeeze:12}).version,request=selectedRequest({configVersion:version});
    let elapsed=0;const p=providers();const received:string[]=[];
    p.membership=async()=>{throw new Error("must keep stored snapshot");};
    p.prices=async m=>{received.push(m.symbol);elapsed=170000;return{bars:discoveryBars(303),source:"QA",basis:"yahoo-kr-raw-ohlcv"};};
    assert.equal((await runSelectedBollingerCloud(first.store,config,p,request,{clock:()=>time()+elapsed,spacingMs:0})).status,"PARTIAL_BUDGET");
    assert.deepEqual((await first.store.latestJob(selectedBollingerScope(request)))?.summary.selectedKeys,["KR:500000","KR:500001"]);await first.pg.close();
    const second=await database(path);elapsed=0;p.prices=async m=>{received.push(m.symbol);return{bars:discoveryBars(303),source:"QA",basis:"yahoo-kr-raw-ohlcv"};};
    const complete=await runSelectedBollingerCloud(second.store,config,p,request,{clock:()=>time()+elapsed,spacingMs:0});assert.equal(complete.status,"COMPLETE");assert.deepEqual(received,["500000","500001"]);
    assert.equal(complete.jobs[0]?.configVersion,version);assert.equal((await second.store.featureHistory(request.universeId,members[0]!,version)).length,25);assert.equal((await second.store.featureHistory(request.universeId,members[0]!,DISCOVERY_DEFAULTS.version)).length,0);await second.pg.close();
  }finally{await rm(path,{recursive:true,force:true});}
});
test("selected requests reject missing/unsupported/empty snapshots before providers are invoked",async()=>{
  const {pg,store}=await database();try{
    const p=providers();await assert.rejects(runSelectedBollingerCloud(store,config,p,selectedRequest()),/UNIVERSE_MISSING/);
    await store.saveUniverse({...universe(),kind:"MANUAL"});await assert.rejects(runSelectedBollingerCloud(store,config,p,selectedRequest()),/UNSUPPORTED/);
    await store.saveUniverse({...universe(),id:"another"});await assert.rejects(runSelectedBollingerCloud(store,config,p,selectedRequest({universeId:"another",symbols:[]})),/NO_SELECTION/);
  }finally{await pg.close();}
});
test("progress matches the current private run lease and distinguishes lost worker from live processing",async()=>{
  const {pg,store}=await database();try{
    await store.saveUniverse(universe());const request=selectedRequest(),p=providers(1);
    p.prices=async()=>{
      const progress=await readSelectedBollingerProgress(store,request);assert.equal(progress.jobs[0]?.execution,"RUNNING");
      const raw=(await store.latestJob(selectedBollingerScope(request)))!.summary;assert.equal(typeof raw.runToken,"string");
      assert.doesNotMatch(JSON.stringify(progress),new RegExp(raw.runToken as string));return{bars:discoveryBars(303),source:"QA",basis:"yahoo-kr-raw-ohlcv"};
    };
    await runSelectedBollingerCloud(store,config,p,request,{clock:time,spacingMs:0});
    const job=(await store.latestJob(selectedBollingerScope(request)))!;
    await store.endJob(job.id,"running",{...job.summary,phase:"refresh",execution:"RUNNING",budgetStopped:false});
    assert.equal((await readSelectedBollingerProgress(store,request)).jobs[0]?.execution,"INTERRUPTED");
    await store.lease("bollinger:daily-provider","unrelated-private-run");
    assert.equal((await readSelectedBollingerProgress(store,request)).jobs[0]?.execution,"INTERRUPTED");await store.release("bollinger:daily-provider","unrelated-private-run");
  }finally{await pg.close();}
});
test("first-pass observations are counted separately and final refresh resumes without reporting false completion",async()=>{
  const {pg,store}=await database();try{
    const p=providers(2);let elapsed=0,refreshes=0;
    const original=store.saveFeatures;store.saveFeatures=async(...args)=>{await original(...args);if(++refreshes===1)elapsed=170000;};
    const partial=await runBollingerCloud(store,config,p,{clock:()=>time()+elapsed,spacingMs:0});
    assert.equal(partial.status,"PARTIAL_BUDGET");assert.equal(partial.jobs[0]?.provisional,2);assert.equal(partial.jobs[0]?.computed,1);assert.equal(partial.jobs[0]?.pendingCompute,1);assert.equal(partial.jobs[0]?.execution,"PAUSED");
    elapsed=0;const resumed=await runBollingerCloud(store,config,p,{clock:()=>time()+elapsed,spacingMs:0});assert.equal(resumed.status,"COMPLETE");assert.equal(resumed.jobs[0]?.computed,2);
  }finally{await pg.close();}
});
test("final cloud refresh prepares SQL peer contexts once without rewriting security observations or their RS ranks",async()=>{
  const {pg,store}=await database();try{
    const p=providers(20),prices=p.prices,aggregate=store.aggregateContexts,saveContext=store.saveContext;
    let priceCalls=0,aggregations=0,securityContextWrites=0;
    p.prices=async(...args)=>{priceCalls++;return prices(...args);};
    store.saveContext=async(...args)=>{if(args[1].startsWith("security:"))securityContextWrites++;return saveContext(...args);};
    store.aggregateContexts=async(...args)=>{aggregations++;assert.equal(securityContextWrites,20,"all first-pass observations exist before ranking");return aggregate(...args);};
    const result=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});
    assert.equal(result.status,"COMPLETE");assert.equal(result.jobs[0]?.computed,20);assert.equal(result.jobs[0]?.pendingCompute,0);
    assert.equal(priceCalls,20);assert.equal(securityContextWrites,20);assert.equal(aggregations,1);
    const contexts=await store.contextScope(universe().id,"security:KR:500019");
    assert.ok(contexts.length);assert.ok(contexts.every(c=>c.rsPercentile!==null&&c.rsPercentile!==undefined),"final stock retains the peer ranks instead of overwriting them with first-pass values");
  }finally{await pg.close();}
});
test("resumed final refresh prepares current peers again once and only computes pending securities without price refetch",async()=>{
  const {pg,store}=await database();try{
    const p=providers(6),prices=p.prices,aggregate=store.aggregateContexts,saveContext=store.saveContext,saveFeatures=store.saveFeatures;
    let elapsed=0,priceCalls=0,aggregations=0,securityContextWrites=0,featureWrites=0;
    const featureKeys:string[]=[];
    p.prices=async(...args)=>{priceCalls++;return prices(...args);};
    store.saveContext=async(...args)=>{if(args[1].startsWith("security:"))securityContextWrites++;return saveContext(...args);};
    store.aggregateContexts=async(...args)=>{aggregations++;return aggregate(...args);};
    store.saveFeatures=async(...args)=>{featureKeys.push(args[1].symbol);await saveFeatures(...args);if(++featureWrites===1)elapsed=170000;};
    const partial=await runBollingerCloud(store,config,p,{clock:()=>time()+elapsed,spacingMs:0});
    assert.equal(partial.status,"PARTIAL_BUDGET");assert.equal(partial.jobs[0]?.computed,1);assert.equal(partial.jobs[0]?.pendingCompute,5);assert.equal(aggregations,1);assert.equal(securityContextWrites,6);
    const first=(await store.latestJob(cloudJobScope("KOSPI",20)))!;
    // A different completed collection may update context between requests. No durable "prepared"
    // flag can be trusted on resume, so the pending refresh must rank the current stored peers again.
    const changed=(await store.contextScope(universe().id,"security:KR:500005")).map(c=>({...c,return63:100}));
    await saveContext(universe().id,"security:KR:500005",changed);
    elapsed=0;const resumed=await runBollingerCloud(store,config,p,{clock:()=>time()+elapsed,spacingMs:0});
    assert.equal(resumed.status,"COMPLETE");assert.equal(resumed.jobs[0]?.computed,6);assert.equal(resumed.jobs[0]?.pendingCompute,0);assert.equal(aggregations,2);assert.equal(securityContextWrites,6);assert.equal(priceCalls,6);
    assert.deepEqual(featureKeys,["500000","500001","500002","500003","500004","500005"]);
    assert.equal((await store.latestJob(cloudJobScope("KOSPI",20)))?.id,first.id);
    assert.ok((await store.contextScope(universe().id,"security:KR:500005")).every(c=>(c.rsPercentile??0)>80),"resume uses changed peer observations instead of a stale preparation");
    assert.ok(((await store.featureHistory(universe().id,member("500005"),DISCOVERY_DEFAULTS.version)).at(-1)?.payload.rsPercentile??0)>80);
  }finally{await pg.close();}
});
test("budget expiry after aggregate SQL stops before final feature writes and prepares again on resume",async()=>{
  const {pg,store}=await database();try{
    const aggregate=store.aggregateContexts,saveFeatures=store.saveFeatures;let elapsed=0,aggregations=0,writes=0;
    store.aggregateContexts=async(...args)=>{await aggregate(...args);if(++aggregations===1)elapsed=170000;};
    store.saveFeatures=async(...args)=>{writes++;return saveFeatures(...args);};
    const p=providers(2),partial=await runBollingerCloud(store,config,p,{clock:()=>time()+elapsed,spacingMs:0});
    assert.equal(partial.status,"PARTIAL_BUDGET");assert.equal(partial.jobs[0]?.computed,0);assert.equal(partial.jobs[0]?.pendingCompute,2);assert.equal(writes,0);
    elapsed=0;const resumed=await runBollingerCloud(store,config,p,{clock:()=>time()+elapsed,spacingMs:0});
    assert.equal(resumed.status,"COMPLETE");assert.equal(aggregations,2);assert.equal(writes,2);
  }finally{await pg.close();}
});
test("lease loss after aggregate SQL does not publish final features",async()=>{
  const {pg,store}=await database();try{
    const aggregate=store.aggregateContexts,saveFeatures=store.saveFeatures;let writes=0;
    store.aggregateContexts=async(...args)=>{await aggregate(...args);const state=(await store.latestJob(cloudJobScope("KOSPI",20)))!.summary;await store.release("bollinger:daily-provider",String(state.runToken));};
    store.saveFeatures=async(...args)=>{writes++;return saveFeatures(...args);};
    const result=await runBollingerCloud(store,config,providers(2),{clock:time,spacingMs:0});
    assert.equal(result.status,"LEASE_LOST");assert.equal(result.jobs[0]?.computed,0);assert.equal(result.jobs[0]?.pendingCompute,2);assert.equal(writes,0);
  }finally{await pg.close();}
});
test("prepared context handles cannot be persisted, forged, rebound to another store or used for first-pass writes",async()=>{
  const first=await database(),second=await database();try{
    const u=universe();await first.store.saveUniverse(u);await second.store.saveUniverse(u);
    await first.store.saveBars(member(),discoveryBars(303),"QA","yahoo-kr-raw-ohlcv","2024-10-29T09:00:00Z");
    await precomputeDiscovery(first.store,u.id,undefined,undefined,{contextOnly:true,recentDays:25});
    const prepared=await prepareDiscoveryContexts(first.store,u.id);
    await assert.rejects(precomputeDiscovery(first.store,u.id,undefined,undefined,{preparedContexts:JSON.parse(JSON.stringify(prepared))}),/PREPARED_CONTEXTS_INVALID/);
    await assert.rejects(precomputeDiscovery(second.store,u.id,undefined,undefined,{preparedContexts:prepared}),/PREPARED_CONTEXTS_INVALID/);
    await assert.rejects(precomputeDiscovery(first.store,u.id,undefined,undefined,{preparedContexts:prepared,contextOnly:true}),/PREPARED_CONTEXTS_INVALID/);
    await first.store.saveUniverse({...u,id:"another-preparation-scope"});
    await assert.rejects(precomputeDiscovery(first.store,"another-preparation-scope",undefined,undefined,{preparedContexts:prepared}),/PREPARED_CONTEXTS_INVALID/);
  }finally{await first.pg.close();await second.pg.close();}
});
test("legacy interrupted refresh counts are upgraded to final-only counts before retry",async()=>{
  const {pg,store}=await database();try{
    const p=providers(1);await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});
    const job=(await store.latestJob(cloudJobScope("KOSPI",20)))!;
    const summary={...job.summary,schema:1,phase:"refresh",computedKeys:["KR:500000"],pendingCompute:[],runToken:undefined,provisionalKeys:undefined,execution:undefined};
    await store.endJob(job.id,"refresh",summary);
    assert.equal(safeCloudJob(summary,"KOSPI").computed,0);assert.equal(safeCloudJob(summary,"KOSPI").pendingCompute,1);
    let refreshed=0;const original=store.saveFeatures;store.saveFeatures=async(...args)=>{refreshed++;return original(...args);};
    const result=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});assert.equal(result.status,"COMPLETE");assert.equal(refreshed,1);assert.equal(result.jobs[0]?.computed,1);
  }finally{await pg.close();}
});
test("availability exclusions distinguish missing storage, warmup, stale, coverage, strategy and score",async()=>{
  const {pg,store}=await database();try{
    const members=Array.from({length:7},(_,i)=>member(String(500000+i))),u=universe(members);await store.saveUniverse(u);
    const candidate=analyzeDiscovery(discoveryBars(303)).candidates.at(-1)!;
    const cases=[{...candidate,valid:false},{...candidate,date:"2024-10-01",valid:true},{...candidate,valid:true,score:{...candidate.score,value:90,coverage:.7}},{...candidate,valid:true,score:{...candidate.score,value:90,coverage:1},views:[]},{...candidate,valid:true,score:{...candidate.score,value:20,coverage:1},views:["squeeze-watch" as const]},{...candidate,valid:true,score:{...candidate.score,value:90,coverage:1},views:["squeeze-watch" as const]}];
    for(let i=0;i<cases.length;i++)await store.saveFeatures(u.id,members[i]!,DISCOVERY_DEFAULTS.version,[cases[i]!],"QA","yahoo-kr-raw-ohlcv");
    const result=await store.query({universeId:u.id,configVersion:DISCOVERY_DEFAULTS.version,strategy:"squeeze-watch",selection:{top:"ALL",minWeight:0,sectors:[]},page:1,pageSize:50,minScore:50,minCoverage:.8,asOf:"2024-10-29"});
    assert.deepEqual(result.availability,{selected:7,stored:6,missingStored:1,warmup:1,stale:1,lowCoverage:1,unavailable:0,strategyMismatch:1,lowScore:1,matched:1,missingPriceHistory:7,outdatedCalculation:0});
  }finally{await pg.close();}
});
const bootstrapRequest=(overrides:Partial<BootstrapBollingerInput>={}):BootstrapBollingerInput=>({bootstrapTarget:"KOSDAQ",configVersion:DISCOVERY_DEFAULTS.version,selection:{top:10,minWeight:0,sectors:[]},...overrides});
test("empty KOSDAQ bootstrap checkpoints membership, resumes and applies exact intersection/version without exposing a partial universe",async()=>{
  const {pg,store}=await database();try{
    const members=Array.from({length:25},(_,i)=>({...member(String(500000+i)),exchange:"KOSDAQ" as const,marketCap:(100-i)*1e12,sector:i%2?"Technology":"Healthcare"}));
    let elapsed=0,first=true,memberships=0;const fetched:string[]=[];
    const p=providers(),version=sanitizeDiscoveryConfig({squeeze:12}).version;
    const request=bootstrapRequest({configVersion:version,selection:{top:10,minWeight:0,sectors:["Technology"]},symbols:["KR:500001","KR:500007","KR:500023"]});
    p.membership=async(target,previous,options)=>{
      memberships++;assert.equal(target,"KOSDAQ");
      if(first){first=false;elapsed=170000;const progress={nextPage:2,total:25,members:members.slice(0,10),asOf:"2024-10-29",collectionDay:"2024-10-29",startedAt:new Date(time()).toISOString()};await options.onPage(progress);return{progress,snapshot:null};}
      assert.equal(previous?.nextPage,2);return{progress:null,snapshot:{...universe(members),id:"KOSDAQ:QA-BOOTSTRAP",kind:"KOSDAQ",knownAt:new Date(time()).toISOString(),fetchedAt:new Date(time()).toISOString(),historical:false}};
    };
    p.prices=async m=>{fetched.push(m.symbol);return{bars:discoveryBars(303),source:"QA",basis:"yahoo-kr-raw-ohlcv"};};
    const initial=await runBootstrapBollingerCloud(store,config,p,request,{clock:()=>time()+elapsed,spacingMs:0});
    assert.equal(initial.status,"PARTIAL_BUDGET");assert.equal(initial.jobs[0]?.universeId,null);assert.equal(initial.jobs[0]?.membershipRows,10);assert.equal(initial.jobs[0]?.execution,"PAUSED");assert.equal((await store.universes()).length,0);
    const progress=await readBootstrapBollingerProgress(store,request);assert.equal(progress.jobs[0]?.universeId,null);assert.equal(memberships,1,"read-only polling never requests membership");
    elapsed=0;const complete=await runBootstrapBollingerCloud(store,config,p,request,{clock:()=>time()+elapsed,spacingMs:0});
    assert.equal(complete.status,"COMPLETE");assert.deepEqual(fetched,["500001","500007"]);assert.equal(complete.jobs[0]?.requested,2);assert.equal(complete.jobs[0]?.computed,2);assert.equal(complete.jobs[0]?.configVersion,version);assert.equal(complete.jobs[0]?.universeId,"KOSDAQ:QA-BOOTSTRAP");
    assert.equal((await store.featureHistory("KOSDAQ:QA-BOOTSTRAP",members[1]!,version)).length,25);
    assert.equal((await runBootstrapBollingerCloud(store,config,p,request,{clock:time,spacingMs:0})).status,"UP_TO_DATE");assert.equal(memberships,2);
    assert.notEqual(bootstrapBollingerScope(request),selectedBollingerScope(selectedRequest({universeId:"KOSDAQ:QA-BOOTSTRAP",selection:request.selection,configVersion:version,symbols:request.symbols})));
  }finally{await pg.close();}
});
test("bootstrap rejects fabricated targets, invalid versions, ETF Top100 and an empty symbol intersection before provider work",async()=>{
  const {pg,store}=await database();try{
    let providersCalled=0;const p=providers();p.membership=async()=>{providersCalled++;throw new Error("must not run");};
    for(const [request,error] of [[bootstrapRequest({bootstrapTarget:"SP500"}),/UNIVERSE_UNSUPPORTED/],[bootstrapRequest({bootstrapTarget:"https://untrusted.example"}),/UNIVERSE_UNSUPPORTED/],[bootstrapRequest({configVersion:"forged"}),/CONFIGURATION_VERSION_INVALID/],[bootstrapRequest({bootstrapTarget:"ETF:069500",selection:{top:100,minWeight:0,sectors:[]}}),/SELECTION_INVALID/],[bootstrapRequest({symbols:[]}),/NO_SELECTION/]] as const)await assert.rejects(runBootstrapBollingerCloud(store,config,p,request,{clock:time,spacingMs:0}),error);
    assert.equal(providersCalled,0);assert.equal((await store.universes()).length,0);
  }finally{await pg.close();}
});
test("completed bootstrap preserves membership but does not invent prices when its chosen sector has no members",async()=>{
  const {pg,store}=await database();try{
    const p=providers();let memberships=0,prices=0,benchmarks=0;
    p.membership=async()=>{memberships++;return{progress:null,snapshot:{...universe([{...member(),exchange:"KOSDAQ"}]),id:"KOSDAQ:EMPTY-QA",kind:"KOSDAQ",knownAt:new Date(time()).toISOString(),fetchedAt:new Date(time()).toISOString(),historical:false}};};
    p.prices=async()=>{prices++;throw new Error("must not invent prices");};p.benchmark=async()=>{benchmarks++;throw new Error("empty selection needs no benchmark");};
    const request=bootstrapRequest({selection:{top:10,minWeight:0,sectors:["Healthcare"]}});
    const failed=await runBootstrapBollingerCloud(store,config,p,request,{clock:time,spacingMs:0});assert.equal(failed.status,"NO_SELECTION");assert.equal(failed.jobs[0]?.universeId,"KOSDAQ:EMPTY-QA");assert.equal(failed.jobs[0]?.lastError,"NO_SELECTION");assert.equal(failed.jobs[0]?.execution,"FAILED");assert.equal(prices,0);assert.equal(benchmarks,0);assert.equal((await store.universes()).length,1);
    assert.equal((await runBootstrapBollingerCloud(store,config,p,request,{clock:time,spacingMs:0})).status,"NO_SELECTION");assert.equal(memberships,1);
  }finally{await pg.close();}
});
test("bootstrap partial membership crossing collection days restarts pages through the existing shared membership service",async()=>{
  const {pg,store}=await database();try{
    const request=bootstrapRequest(),p=providers();let timestamp=Date.parse("2026-10-06T09:00:00Z"),pageCalls=0;
    p.membership=async(_target,previous,options)=>{
      const result=await fetchKrMembershipBatch("KOSDAQ",previous,{maxPages:1,spacingMs:0,now:()=>new Date(timestamp).toISOString(),checkpoint:options.checkpoint,onPage:options.onPage,fetcher:(async url=>{
        const page=new URL(String(url)).searchParams.get("page");pageCalls++;
        if(pageCalls===1){assert.equal(page,"1");timestamp+=170000;return listing(["005930"],2);}
        if(pageCalls===2){assert.equal(page,"1","previous-day pages must restart");return listing(["403870"],2);}
        assert.equal(page,"2");return listing(["000660"],2);
      }) as typeof fetch});return{progress:result.progress,snapshot:result.snapshot};
    };
    assert.equal((await runBootstrapBollingerCloud(store,config,p,request,{clock:()=>timestamp,spacingMs:0})).status,"PARTIAL_BUDGET");assert.equal((await store.universes()).length,0);
    timestamp=Date.parse("2026-10-07T09:00:00Z");const complete=await runBootstrapBollingerCloud(store,config,p,request,{clock:()=>timestamp,spacingMs:0});assert.equal(complete.status,"COMPLETE");
    const snapshot=await store.universe(complete.jobs[0]!.universeId!);assert.deepEqual(snapshot?.members.map(m=>m.symbol),["403870","000660"]);assert.equal(snapshot?.asOf,"2026-10-06","retain the provider observation date");assert.equal(snapshot?.knownAt,"2026-10-07T09:00:00.000Z");assert.equal(pageCalls,3);
  }finally{await pg.close();}
});
test("bootstrap retains completed snapshot, frozen keys and calculation version when a separate DB process resumes after price checkpoint",async()=>{
  const path=await mkdtemp(join(tmpdir(),"bollinger-bootstrap-test-"));try{
    const first=await database(path),members=Array.from({length:3},(_,i)=>({...member(String(500000+i)),exchange:"KOSDAQ" as const,marketCap:(3-i)*1e12})),version=sanitizeDiscoveryConfig({squeeze:12}).version;
    const request=bootstrapRequest({configVersion:version}),received:string[]=[];let elapsed=0;
    const p=providers();p.membership=async()=>({progress:null,snapshot:{...universe(members),id:"KOSDAQ:DISK-QA",kind:"KOSDAQ",knownAt:new Date(time()).toISOString(),fetchedAt:new Date(time()).toISOString(),historical:false}});
    p.prices=async m=>{received.push(m.symbol);elapsed=170000;return{bars:discoveryBars(303),source:"QA",basis:"yahoo-kr-raw-ohlcv"};};
    const partial=await runBootstrapBollingerCloud(first.store,config,p,request,{clock:()=>time()+elapsed,spacingMs:0});
    assert.equal(partial.status,"PARTIAL_BUDGET");assert.equal(partial.jobs[0]?.universeId,"KOSDAQ:DISK-QA");assert.equal(partial.jobs[0]?.collected,1);
    const originalJob=(await first.store.latestJob(bootstrapBollingerScope(request)))!;assert.deepEqual(originalJob.summary.selectedKeys,["KR:500000","KR:500001","KR:500002"]);await first.pg.close();
    const second=await database(path);elapsed=0;p.membership=async()=>{throw new Error("completed membership must remain frozen across process/date changes");};
    p.prices=async m=>{received.push(m.symbol);return{bars:discoveryBars(303),source:"QA",basis:"yahoo-kr-raw-ohlcv"};};
    const resumed=await runBootstrapBollingerCloud(second.store,config,p,request,{clock:()=>time()+86400000+elapsed,spacingMs:0});
    assert.equal(resumed.status,"COMPLETE");assert.equal(resumed.jobs[0]?.computed,3);assert.equal(resumed.jobs[0]?.universeId,"KOSDAQ:DISK-QA");assert.equal(resumed.jobs[0]?.configVersion,version);assert.deepEqual(received,["500000","500001","500002"]);
    assert.equal((await second.store.latestJob(bootstrapBollingerScope(request)))?.id,originalJob.id);assert.equal((await second.store.universes()).length,1);assert.equal((await second.store.featureHistory("KOSDAQ:DISK-QA",members[0]!,version)).length,25);
    assert.equal((await readBootstrapBollingerProgress(second.store,request)).jobs[0]?.execution,"COMPLETE");await second.pg.close();
  }finally{await rm(path,{recursive:true,force:true});}
});
test("a completed selected Top20 checkpoint repairs missing scoped calculations from existing prices before returning complete",async()=>{
  const {pg,store}=await database();try{
    const members=Array.from({length:20},(_,i)=>({...member(String(500000+i)),marketCap:(20-i)*1e12}));await store.saveUniverse(universe(members));
    const request=selectedRequest({selection:{top:20,minWeight:0,sectors:[]},configVersion:sanitizeDiscoveryConfig({squeeze:12}).version}),p=providers(20);let priceCalls=0;
    const prices=p.prices;p.prices=async(...args)=>{priceCalls++;return prices(...args);};
    assert.equal((await runSelectedBollingerCloud(store,config,p,request,{clock:time,spacingMs:0})).status,"COMPLETE");
    const job=(await store.latestJob(selectedBollingerScope(request)))!;
    await pg.query("DELETE FROM bollinger_features WHERE universe_id=$1 AND config_version=$2 AND symbol=ANY($3::text[])",[request.universeId,request.configVersion,members.slice(2).map(m=>m.symbol)]);
    const before=await store.query({universeId:request.universeId,configVersion:request.configVersion,strategy:"squeeze-watch",selection:request.selection,page:1,pageSize:50,minScore:0,minCoverage:0,asOf:"2024-10-29"});
    assert.equal(before.availability.missingStored,18);
    const repaired=await runSelectedBollingerCloud(store,config,p,request,{clock:time,spacingMs:0});
    assert.equal(repaired.status,"COMPLETE",JSON.stringify(repaired));assert.equal(repaired.jobs[0]?.computed,20);assert.equal(repaired.jobs[0]?.pendingCompute,0);assert.equal(priceCalls,20,"repair never repeats already persisted price requests");
    assert.equal((await store.latestJob(selectedBollingerScope(request)))?.id,job.id);
    const after=await store.query({universeId:request.universeId,configVersion:request.configVersion,strategy:"squeeze-watch",selection:request.selection,page:1,pageSize:50,minScore:0,minCoverage:0,asOf:"2024-10-29"});
    assert.equal(after.availability.missingStored,0);assert.equal(after.availability.missingPriceHistory,0);assert.equal(after.inspection.rows.length,20);
    assert.ok(after.inspection.rows.every(r=>r.candidate!==null));
    assert.equal((await store.featureHistory(request.universeId,members[0]!,DISCOVERY_DEFAULTS.version)).length,0,"custom configuration is not relabelled as default");
    assert.equal((await runSelectedBollingerCloud(store,config,p,request,{clock:time,spacingMs:0})).status,"UP_TO_DATE");assert.equal(priceCalls,20);
  }finally{await pg.close();}
});
test("completed calculations with absent same-basis prices refetch only the missing stock and verify all selected data",async()=>{
  const {pg,store}=await database();try{
    const members=Array.from({length:3},(_,i)=>({...member(String(500000+i)),marketCap:(3-i)*1e12}));await store.saveUniverse(universe(members));
    const p=providers(3),request=selectedRequest();const prices=p.prices,received:string[]=[];p.prices=async(m,initial)=>{received.push(m.symbol);return prices(m,initial);};
    assert.equal((await runSelectedBollingerCloud(store,config,p,request,{clock:time,spacingMs:0})).status,"COMPLETE");
    await pg.query("DELETE FROM bollinger_daily_bars WHERE market='KR' AND symbol='500001'");
    const repaired=await runSelectedBollingerCloud(store,config,p,request,{clock:time,spacingMs:0});assert.equal(repaired.status,"COMPLETE",JSON.stringify(repaired));assert.equal(repaired.jobs[0]?.computed,3);
    assert.deepEqual(received,["500000","500001","500002","500001"]);
    const coverage=await store.calculationCoverage(request.universeId,request.configVersion,members.map(m=>`KR:${m.symbol}`));
    assert.ok(coverage.every(r=>r.priceDate&&r.featureDate===r.priceDate&&r.featureComputedAt&&r.priceFetchedAt&&Date.parse(r.featureComputedAt)>=Date.parse(r.priceFetchedAt)));
  }finally{await pg.close();}
});
test("one stock without computable history does not block other selected stocks and explicit retry computes it without refetching prices",async()=>{
  const {pg,store}=await database();try{
    const p=providers(6),metadata=store.barMetadata,prices=p.prices;let priceCalls=0;
    p.prices=async(...args)=>{priceCalls++;return prices(...args);};store.barMetadata=async(...args)=>args[0].symbol==="500000"?[]:metadata(...args);
    const partial=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});
    assert.equal(partial.status,"PARTIAL_ERRORS");assert.equal(partial.jobs[0]?.computed,5);assert.equal(partial.jobs[0]?.pendingCompute,0);assert.deepEqual(partial.jobs[0]?.stockErrors,[{symbol:"KR:500000",code:"COMPUTE_FAILED"}]);assert.equal(priceCalls,6);
    for(let i=1;i<6;i++)assert.equal((await store.featureHistory(universe().id,member(String(500000+i)),DISCOVERY_DEFAULTS.version)).length,25);
    store.barMetadata=metadata;const retried=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});
    assert.equal(retried.status,"COMPLETE");assert.equal(retried.jobs[0]?.computed,6);assert.deepEqual(retried.jobs[0]?.stockErrors,[]);assert.equal(priceCalls,6);
  }finally{await pg.close();}
});
test("final feature persistence is verified and a falsely acknowledged write cannot report complete",async()=>{
  const {pg,store}=await database();try{
    const p=providers(2),saveFeatures=store.saveFeatures,prices=p.prices;let priceCalls=0;
    p.prices=async(...args)=>{priceCalls++;return prices(...args);};store.saveFeatures=async(...args)=>{if(args[1].symbol!=="500000")return saveFeatures(...args);};
    const partial=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});
    assert.equal(partial.status,"PARTIAL_ERRORS");assert.equal(partial.jobs[0]?.computed,1);assert.deepEqual(partial.jobs[0]?.stockErrors,[{symbol:"KR:500000",code:"COMPUTE_FAILED"}]);
    store.saveFeatures=saveFeatures;const retry=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});
    assert.equal(retry.status,"COMPLETE");assert.equal(retry.jobs[0]?.computed,2);assert.equal(priceCalls,2);
  }finally{await pg.close();}
});
test("infrastructure SQL failure preserves pending work and is not misreported as a stock failure",async()=>{
  const {pg,store}=await database();try{
    const saveFeatures=store.saveFeatures,p=providers(2),prices=p.prices;let priceCalls=0;
    p.prices=async(...args)=>{priceCalls++;return prices(...args);};store.saveFeatures=async()=>{throw new Error("private SQL connection detail");};
    const failed=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});
    assert.equal(failed.status,"DATABASE_QUERY_FAILED");assert.equal(failed.jobs[0]?.computed,0);assert.equal(failed.jobs[0]?.pendingCompute,2);assert.deepEqual(failed.jobs[0]?.stockErrors,[]);assert.doesNotMatch(JSON.stringify(failed),/private SQL/);
    store.saveFeatures=saveFeatures;assert.equal((await runBollingerCloud(store,config,p,{clock:time,spacingMs:0})).status,"COMPLETE");assert.equal(priceCalls,2);
  }finally{await pg.close();}
});
test("unsupported provider price basis is not stored as successful history",async()=>{
  const {pg,store}=await database();try{
    const p=providers(1);p.prices=async()=>({bars:discoveryBars(303),source:"QA",basis:"unsupported-basis"});
    const result=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});assert.equal(result.status,"PARTIAL_ERRORS");assert.equal(result.jobs[0]?.collected,0);assert.deepEqual(result.jobs[0]?.stockErrors,[{symbol:"KR:500000",code:"PRICE_FETCH_FAILED"}]);
    assert.equal((await store.bars("KR","500000","unsupported-basis")).length,0);
  }finally{await pg.close();}
});
test("correction to an older stored bar invalidates completed calculations even when the latest observation date did not change",async()=>{
  const {pg,store}=await database();try{
    const p=providers(1),prices=p.prices;let priceCalls=0;p.prices=async(...args)=>{priceCalls++;return prices(...args);};
    assert.equal((await runBollingerCloud(store,config,p,{clock:time,spacingMs:0})).status,"COMPLETE");
    const before=(await store.featureHistory(universe().id,member("500000"),DISCOVERY_DEFAULTS.version)).at(-1)!;
    const correctedDay=discoveryBars(303)[150]!.date;
    await pg.query(`UPDATE bollinger_daily_bars SET payload=jsonb_set(payload,'{close}',to_jsonb((payload->>'close')::float8+0.01)),
      fetched_at=(SELECT max(computed_at)+interval '1 millisecond' FROM bollinger_features WHERE universe_id=$1 AND symbol='500000')
      WHERE market='KR' AND symbol='500000' AND day=$2`,[universe().id,correctedDay]);
    const proof=(await store.calculationCoverage(universe().id,DISCOVERY_DEFAULTS.version,["KR:500000"]))[0]!;
    assert.equal(proof.priceDate,proof.featureDate);assert.ok(Date.parse(proof.priceFetchedAt!)>Date.parse(proof.featureComputedAt!));
    const query={universeId:universe().id,configVersion:DISCOVERY_DEFAULTS.version,strategy:"squeeze-watch" as const,selection:{top:20 as const,minWeight:0,sectors:[]},page:1,pageSize:50 as const,minScore:0,minCoverage:0,asOf:"2024-10-29"};
    const pending=await store.query(query);assert.equal(pending.availability.outdatedCalculation,1);assert.equal(pending.availability.stale,0);
    assert.equal(pending.inspection.rows[0]?.dataStatus?.reason,"FINAL_COMPUTE_OUTDATED");assert.equal(pending.inspection.rows[0]?.dataStatus?.priceCount,303);assert.ok(pending.inspection.rows[0]?.candidate,"previous analysis remains available with a pending update explanation");
    const repaired=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});assert.equal(repaired.status,"COMPLETE");assert.equal(priceCalls,1);
    assert.equal((await store.query(query)).availability.outdatedCalculation,0);
    const after=(await store.featureHistory(universe().id,member("500000"),DISCOVERY_DEFAULTS.version)).at(-1)!;
    const priorSma=before.payload.score.components.trend!.inputs.sma200,currentSma=after.payload.score.components.trend!.inputs.sma200;
    assert.equal(typeof priorSma,"number");assert.equal(typeof currentSma,"number");assert.ok(Math.abs((currentSma as number)-(priorSma as number)-0.01/200)<1e-10);
  }finally{await pg.close();}
});
test("legacy cross-market price bases cannot satisfy Korean or US calculation coverage",async()=>{
  const {pg,store}=await database();try{
    const kr=member("500000"),us={...member("AAPL"),market:"US" as const,exchange:"NASDAQ" as const},u=universe([kr,us]);await store.saveUniverse(u);
    await store.saveBars(kr,discoveryBars(303),"QA WRONG MARKET","yahoo-us-adjusted-ohlcv",new Date(time()).toISOString());
    await store.saveBars(us,discoveryBars(303),"QA WRONG MARKET","naver-raw-ohlcv",new Date(time()).toISOString());
    const coverage=await store.calculationCoverage(u.id,DISCOVERY_DEFAULTS.version,["KR:500000","US:AAPL"]);assert.ok(coverage.every(r=>r.priceDate===null));
    const computed=await precomputeDiscovery(store,u.id,undefined,undefined,{contextOnly:true,recentDays:25});assert.equal(computed.securities,0);
  }finally{await pg.close();}
});
test("price persistence SQL failure stops the collector without advancing the stock or masquerading as provider failure",async()=>{
  const {pg,store}=await database();try{
    const saveBars=store.saveBars,p=providers(2),prices=p.prices,received:string[]=[];
    p.prices=async(m,initial)=>{received.push(m.symbol);return prices(m,initial);};
    store.saveBars=async(...args)=>{if(args[0].symbol==="500000")throw new Error("private persistence connection detail");return saveBars(...args);};
    const failed=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});
    assert.equal(failed.status,"DATABASE_QUERY_FAILED");assert.equal(failed.jobs[0]?.nextOffset,0);assert.equal(failed.jobs[0]?.collected,0);assert.deepEqual(failed.jobs[0]?.stockErrors,[]);assert.doesNotMatch(JSON.stringify(failed),/private persistence/);assert.deepEqual(received,["500000"]);
    store.saveBars=saveBars;const resumed=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});assert.equal(resumed.status,"COMPLETE");assert.deepEqual(received,["500000","500000","500001"]);
  }finally{await pg.close();}
});
test("benchmark persistence SQL failure is fatal rather than a recoverable provider warning",async()=>{
  const {pg,store}=await database();try{
    const saveBars=store.saveBars,p=providers(2);let priceCalls=0;p.prices=async()=>{priceCalls++;throw new Error("must not continue after DB failure");};
    store.saveBars=async(...args)=>{if(args[0].symbol==="^KS11")throw new Error("private benchmark DB detail");return saveBars(...args);};
    const failed=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});
    assert.equal(failed.status,"DATABASE_QUERY_FAILED");assert.equal(priceCalls,0);assert.equal(failed.jobs[0]?.nextOffset,0);assert.deepEqual(failed.jobs[0]?.stockErrors,[]);assert.doesNotMatch(JSON.stringify(failed),/private benchmark/);
  }finally{await pg.close();}
});
test("completed selected checkpoints repair wrong or duplicated identities instead of trusting equal counts",async()=>{
  const {pg,store}=await database();try{
    const members=Array.from({length:3},(_,i)=>({...member(String(500000+i)),marketCap:(3-i)*1e12}));await store.saveUniverse(universe(members));
    const p=providers(3),request=selectedRequest(),prices=p.prices;let priceCalls=0;p.prices=async(...args)=>{priceCalls++;return prices(...args);};
    assert.equal((await runSelectedBollingerCloud(store,config,p,request,{clock:time,spacingMs:0})).status,"COMPLETE");
    const keys=members.map(m=>`KR:${m.symbol}`),original=(await store.latestJob(selectedBollingerScope(request)))!;
    for(const wrong of [[keys[0]!,keys[1]!,"KR:999999"],[keys[0]!,keys[0]!,keys[2]!]]) {
      const job=(await store.latestJob(selectedBollingerScope(request)))!;await store.endJob(job.id,"complete",{...job.summary,computedKeys:wrong});
      const repaired=await runSelectedBollingerCloud(store,config,p,request,{clock:time,spacingMs:0});
      assert.equal(repaired.status,"COMPLETE");assert.deepEqual(repaired.jobs[0]?.computedSymbols,keys);assert.equal(priceCalls,3,"identity repair uses existing prices");
      assert.equal((await store.latestJob(selectedBollingerScope(request)))?.id,original.id);
      assert.equal((await runSelectedBollingerCloud(store,config,p,request,{clock:time,spacingMs:0})).status,"UP_TO_DATE");
    }
  }finally{await pg.close();}
});
test("bootstrap completed checkpoint reconstructs frozen requested identities after legacy selected keys are corrupted",async()=>{
  const {pg,store}=await database();try{
    const p=providers(3),prices=p.prices,request=bootstrapRequest({bootstrapTarget:"KOSPI"});let priceCalls=0;p.prices=async(...args)=>{priceCalls++;return prices(...args);};
    assert.equal((await runBootstrapBollingerCloud(store,config,p,request,{clock:time,spacingMs:0})).status,"COMPLETE");
    const job=(await store.latestJob(bootstrapBollingerScope(request)))!;
    await store.endJob(job.id,"complete",{...job.summary,selectedKeys:["KR:500000","KR:500001","KR:999999"],computedKeys:["KR:500000","KR:500001","KR:999999"]});
    p.membership=async()=>{throw new Error("completed immutable membership must not be re-fetched");};
    const repaired=await runBootstrapBollingerCloud(store,config,p,request,{clock:time,spacingMs:0});
    assert.equal(repaired.status,"COMPLETE");assert.deepEqual(repaired.jobs[0]?.computedSymbols,["KR:500000","KR:500001","KR:500002"]);assert.equal(priceCalls,3);
    assert.deepEqual((await store.latestJob(bootstrapBollingerScope(request)))?.summary.selectedKeys,["KR:500000","KR:500001","KR:500002"]);
  }finally{await pg.close();}
});
test("new same-basis prices expose pending final analysis before the four-day stale threshold and only after their observation date",async()=>{
  const {pg,store}=await database();try{
    const p=providers(1);assert.equal((await runBollingerCloud(store,config,p,{clock:time,spacingMs:0})).status,"COMPLETE");
    const newBar={...discoveryBars(303).at(-1)!,date:"2024-10-30"};await store.saveBars(member("500000"),[newBar],"QA SHARED RANGE","yahoo-kr-raw-ohlcv","2024-10-30T09:30:00Z");
    const query={universeId:universe().id,configVersion:DISCOVERY_DEFAULTS.version,strategy:"squeeze-watch" as const,selection:{top:20 as const,minWeight:0,sectors:[]},page:1,pageSize:50 as const,minScore:0,minCoverage:0,asOf:"2024-10-30"};
    const pending=await store.query(query);assert.equal(pending.availability.stale,0);assert.equal(pending.availability.outdatedCalculation,1);assert.equal(pending.availability.missingStored,0);
    const row=pending.inspection.rows[0]!;assert.equal(row.dataStatus?.lastPriceDate,"2024-10-30");assert.equal(row.dataStatus?.reason,"FINAL_COMPUTE_OUTDATED");assert.ok(row.candidate);
    const prior=await store.query({...query,asOf:"2024-10-29"});assert.equal(prior.availability.outdatedCalculation,0);assert.equal(prior.inspection.rows[0]?.dataStatus?.reason,null);
  }finally{await pg.close();}
});
test("completed-checkpoint coverage SQL failure is a terminal database error without provider work",async()=>{
  const {pg,store}=await database();try{
    const p=providers(1);assert.equal((await runBollingerCloud(store,config,p,{clock:time,spacingMs:0})).status,"COMPLETE");
    store.calculationCoverage=async()=>{throw new Error("private database credentials detail");};p.prices=async()=>{throw new Error("no provider retry allowed");};
    const failed=await runBollingerCloud(store,config,p,{clock:time,spacingMs:0});assert.equal(failed.status,"DATABASE_QUERY_FAILED");assert.doesNotMatch(JSON.stringify(failed),/private|credentials/);
  }finally{await pg.close();}
});
test("availability detects a newer allowed price basis while displayed analysis stays pinned and future or wrong-market prices are excluded",async()=>{
  const {pg,store}=await database();try{
    assert.equal((await runBollingerCloud(store,config,providers(3),{clock:time,spacingMs:0})).status,"COMPLETE");
    const bars=discoveryBars(303),next={...bars.at(-1)!,date:"2024-10-30"};
    await store.saveBars(member("500000"),[next],"QA NAVER NEXT DAY","naver-raw-ohlcv","2024-10-30T09:30:00Z");
    await store.saveBars(member("500001"),bars,"QA NAVER SAME DAY","naver-raw-ohlcv","2024-10-29T09:31:00Z");
    await store.saveBars(member("500002"),[...bars,next],"QA WRONG MARKET","yahoo-us-adjusted-ohlcv","2024-10-30T09:30:00Z");
    const query={universeId:universe().id,configVersion:DISCOVERY_DEFAULTS.version,strategy:"squeeze-watch" as const,selection:{top:20 as const,minWeight:0,sectors:[]},page:1,pageSize:50 as const,minScore:0,minCoverage:0,asOf:"2024-10-30"};
    const current=await store.query(query);assert.equal(current.availability.outdatedCalculation,2);assert.equal(current.availability.missingPriceHistory,0);assert.equal(current.availability.stale,0);
    for(const row of current.inspection.rows){assert.equal(row.priceBasis,"yahoo-kr-raw-ohlcv");assert.equal(row.source,"QA SYNTHETIC");assert.equal(row.dataStatus?.priceCount,303);assert.equal(row.dataStatus?.lastPriceDate,"2024-10-29");assert.equal(row.candidate?.date,"2024-10-29");}
    assert.equal(current.inspection.rows.find(r=>r.symbol==="500000")?.dataStatus?.reason,"FINAL_COMPUTE_OUTDATED");
    assert.equal(current.inspection.rows.find(r=>r.symbol==="500001")?.dataStatus?.reason,"FINAL_COMPUTE_OUTDATED");
    assert.equal(current.inspection.rows.find(r=>r.symbol==="500002")?.dataStatus?.reason,null);
    const prior=await store.query({...query,asOf:"2024-10-29"});assert.equal(prior.availability.outdatedCalculation,1);assert.equal(prior.inspection.rows.find(r=>r.symbol==="500000")?.dataStatus?.reason,null,"future Naver observation is excluded before its date");
    const proof=await store.calculationCoverage(universe().id,DISCOVERY_DEFAULTS.version,["KR:500000","KR:500001","KR:500002"]);
    assert.equal(proof.find(r=>r.key==="KR:500000")?.priceBasis,"naver-raw-ohlcv");assert.equal(proof.find(r=>r.key==="KR:500001")?.priceBasis,"naver-raw-ohlcv");assert.equal(proof.find(r=>r.key==="KR:500002")?.priceBasis,"yahoo-kr-raw-ohlcv");
  }finally{await pg.close();}
});
