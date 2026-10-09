import test from "node:test";import assert from "node:assert/strict";
import { readFile,mkdtemp,rm } from "node:fs/promises";import {tmpdir} from "node:os";import {join} from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createDiscoveryStore,getDiscoveryStore } from "./bollinger-discovery-store.ts";
import { collectDiscovery,runDiscoveryPrecompute } from "./bollinger-discovery-jobs.ts";
import { analyzeDiscovery,DISCOVERY_DEFAULTS } from "../lib/bollinger/discovery.ts";
import { discoveryBars,discoveryContexts,member,universe } from "../lib/bollinger/discovery-fixture.test-data.ts";
import { readDiscoveryStockChart } from "./bollinger-discovery.ts";
const migration=await readFile(new URL("../../migrations/0005_bollinger_discovery.sql",import.meta.url),"utf8");
async function database(path?:string){const pg=new PGlite(path);await pg.waitReady;await pg.exec(migration);const store=createDiscoveryStore({query:async<T>(text:string,params:unknown[]=[]) => (await pg.query<T>(text,params)).rows});return{pg,store};}
test("operational store fails explicitly without DATABASE_URL, never process-memory success",async()=>{
  const old=process.env.DATABASE_URL;delete process.env.DATABASE_URL;
  try{await assert.rejects(getDiscoveryStore(),/DATABASE_MISSING/);}finally{if(old!==undefined)process.env.DATABASE_URL=old;}
});
test("additive schema, idempotent membership, bars corrections and incomplete values preserve good data",async()=>{
  const {pg,store}=await database();try{
    assert.equal(await store.schemaReady(),true);await store.saveUniverse(universe());await store.saveUniverse(universe());assert.equal((await store.universes()).length,1);
    await assert.rejects(store.saveUniverse({...universe(),source:"changed"}),/IMMUTABLE/);
    const bars=discoveryBars(2),m=member();await store.saveBars(m,bars,"QA","yahoo-kr-raw-ohlcv","2024-01-04T00:00:00Z");
    await store.saveBars(m,[{...bars[0]!,close:NaN}],"QA","yahoo-kr-raw-ohlcv","2024-01-04T00:00:00Z");assert.equal((await store.bars("KR",m.symbol,"yahoo-kr-raw-ohlcv"))[0]!.close,bars[0]!.close);
    const corrected={...bars[0]!,close:100.1,high:101};await store.saveBars(m,[corrected],"QA","yahoo-kr-raw-ohlcv","2024-01-04T00:00:00Z");assert.equal((await store.bars("KR",m.symbol,"yahoo-kr-raw-ohlcv"))[0]!.close,100.1);
    assert.equal((await store.bars("KR",m.symbol,"yahoo-us-adjusted-ohlcv")).length,0);
  }finally{await pg.close();}
});
test("stored engine results reach DB-only frontend contract with filter/sort/pagination",async()=>{
  const {pg,store}=await database();try{
    const members=Array.from({length:60},(_,i)=>member(String(500000+i))),u=universe(members);await store.saveUniverse(u);
    const bars=discoveryBars(303),result=analyzeDiscovery(bars,undefined,discoveryContexts(bars));
    for(const m of members)await store.saveFeatures(u.id,m,DISCOVERY_DEFAULTS.version,[result.candidates.at(-1)!],"QA SYNTHETIC","yahoo-kr-raw-ohlcv");
    const q={universeId:u.id,configVersion:DISCOVERY_DEFAULTS.version,strategy:"long-pre-breakout" as const,selection:{top:"ALL" as const,minWeight:0,sectors:[]},page:1,pageSize:25 as const,minScore:0,minCoverage:.8,asOf:"2024-10-29"};
    const page=await store.query(q);assert.equal(page.total,60);assert.equal(page.rows.length,25);assert.equal(page.rows[0]!.state,"ARMED");assert.ok(page.rows[0]!.name.startsWith("QA"));
    const next=await store.query({...q,page:2});assert.notEqual(page.rows[0]!.symbol,next.rows[0]!.symbol);
    assert.equal((await store.query({...q,symbols:[]})).total,0);assert.equal((await store.query({...q,asOf:"2025-01-01"})).total,0);
    const e={id:"QA:entered",date:"2024-10-29",type:"entered-armed" as const,triggerDate:null,delivery:"detected" as const};await store.saveEvents(u.id,members[0]!,DISCOVERY_DEFAULTS.version,[e,e]);assert.equal((await store.events(u.id)).length,1);
  }finally{await pg.close();}
});
test("sector peer medians and sector/stock percentile require sufficient actual samples",async()=>{
  const {pg,store}=await database();try{
    const sectors=["Semiconductors","Technology","Healthcare"],members=sectors.flatMap((sector,j)=>Array.from({length:3},(_,i)=>({...member(String(500000+j*3+i)),sector}))),u=universe(members);
    await store.saveUniverse(u);
    for(const m of members){const j=sectors.indexOf(m.sector);await store.saveContext(u.id,`security:KR:${m.symbol}`,[{asOf:"2024-01-02",source:"QA",return20:j*10,return63:j*20,aboveSma200:true,slope200:.1}]);}
    await store.saveContext(u.id,"market:KOSPI",[{asOf:"2024-01-02",source:"QA",return20:0,return63:0,aboveSma200:true,slope200:.1}]);
    await store.aggregateContexts(u.id,"SP500");
    const mid=(await store.contextScope(u.id,"sector:KR:Technology"))[0]!,high=(await store.contextScope(u.id,"sector:KR:Healthcare"))[0]!;
    assert.equal(mid.return20,10);assert.equal(mid.rsPercentile,50);assert.ok(high.rsPercentile!>80&&high.rsPercentile!<100);
    assert.ok((await store.contextScope(u.id,"security:KR:500008"))[0]!.rsPercentile!>80);
  }finally{await pg.close();}
});
test("shared lease prevents duplicate collectors and bounded job records its resume position",async()=>{
  const {pg,store}=await database();try{
    const u=universe([member(),member("000660")]);await store.saveUniverse(u);
    assert.equal(await store.lease("shared","a"),true);assert.equal(await store.lease("shared","b"),false);await store.release("shared","b");assert.equal(await store.renew("shared","a"),true);await store.release("shared","a");
    let calls=0;const summary=await collectDiscovery(store,u.id,async()=>{calls++;return{bars:discoveryBars(220),source:"QA",basis:"yahoo-kr-raw-ohlcv"};},{limit:1,spacingMs:0});
    assert.equal(calls,1);assert.equal(summary.status,"partial-limit");assert.equal(summary.nextOffset,1);assert.equal(summary.collected,1);assert.equal(summary.features,220);
    const noHistory=await collectDiscovery(store,u.id,async()=>({bars:[],source:"QA",basis:"yahoo-kr-raw-ohlcv"}),{limit:1,spacingMs:0});assert.equal(noHistory.errors[0]!.code,"NO_HISTORY");assert.equal((await store.bars("KR","000660","yahoo-kr-raw-ohlcv")).length,220);
    assert.equal((await store.jobs(u.id)).length,2);
  }finally{await pg.close();}
});
test("file-backed isolated PGlite observations survive a separate instance restart",async()=>{
  const path=await mkdtemp(join(tmpdir(),"bollinger-persistence-test-"));try{
    const first=await database(path);await first.store.saveUniverse(universe());await first.store.saveBars(member(),discoveryBars(2),"QA","yahoo-kr-raw-ohlcv","2024-01-04T00:00:00Z");await first.pg.close();
    const second=await database(path);assert.equal((await second.store.bars("KR","005930","yahoo-kr-raw-ohlcv")).length,2);assert.ok(await second.store.universe(universe().id));await second.pg.close();
  }finally{await rm(path,{recursive:true,force:true});}
});
test("budget stops collection/precompute safely and releases shared lease for resumable work",async()=>{
  const {pg,store}=await database();try{
    const u=universe();await store.saveUniverse(u);let calls=0;
    const summary=await collectDiscovery(store,u.id,async()=>{calls++;return{bars:[],source:"QA",basis:"yahoo-kr-raw-ohlcv"};},{budgetMs:0,spacingMs:0});
    assert.equal(summary.status,"partial-budget");assert.equal(summary.nextOffset,0);assert.equal(summary.precomputeStatus,"partial-rerun-precompute");assert.equal(calls,0);
    const computed=await runDiscoveryPrecompute(store,u.id,undefined,0);assert.equal("status" in computed?computed.status:null,"partial-budget");
    assert.equal(await store.lease("bollinger:daily-provider","next"),true);await store.release("bollinger:daily-provider","next");
  }finally{await pg.close();}
});
test("interactive server performs no provider/collector import or credential access",async()=>{
  const source=await readFile(new URL("./bollinger-discovery.ts",import.meta.url),"utf8");assert.doesNotMatch(source,/fetchOhlc|kiwoom|collectDiscovery|APP_KEY|APP_SECRET/);
});
test("zero matches retain all selected stocks, including nonmatch, missing, warmup and stale, with independent inspection pagination",async()=>{
  const {pg,store}=await database();try{
    const members=Array.from({length:30},(_,i)=>member(String(610000+i))),u=universe(members);await store.saveUniverse(u);
    const bars=discoveryBars(303),candidate=analyzeDiscovery(bars,undefined,discoveryContexts(bars)).candidates.at(-1)!;
    await store.saveFeatures(u.id,members[0]!,DISCOVERY_DEFAULTS.version,[{...candidate,state:"NEUTRAL",views:[]}],"QA NONMATCH","naver-raw-ohlcv");
    await store.saveFeatures(u.id,members[2]!,DISCOVERY_DEFAULTS.version,[{...candidate,valid:false,state:"WARMUP"}],"QA WARMUP","naver-raw-ohlcv");
    await store.saveFeatures(u.id,members[3]!,DISCOVERY_DEFAULTS.version,[{...candidate,date:"2024-01-02"}],"QA STALE","naver-raw-ohlcv");
    const q={universeId:u.id,configVersion:DISCOVERY_DEFAULTS.version,strategy:"long-pre-breakout" as const,selection:{top:"ALL" as const,minWeight:0,sectors:[]},page:1,pageSize:25 as const,minScore:0,minCoverage:.8,asOf:candidate.date};
    const response=await store.query(q);assert.equal(response.total,0);assert.equal(response.rows.length,0);assert.equal(response.inspection.total,30);assert.equal(response.inspection.rows.length,25);
    const bySymbol=new Map(response.inspection.rows.map(r=>[r.symbol,r]));
    assert.equal(bySymbol.get(members[0]!.symbol)?.assessment,"STRATEGY_MISMATCH");
    const missing=bySymbol.get(members[1]!.symbol)!;assert.equal(missing.assessment,"NO_COMPUTED_HISTORY");assert.equal(missing.candidate,null);assert.equal(missing.source,null);assert.equal(missing.priceBasis,null);assert.equal(missing.computedAt,null);
    assert.equal(bySymbol.get(members[2]!.symbol)?.assessment,"WARMUP");assert.equal(bySymbol.get(members[3]!.symbol)?.assessment,"STALE");
    const second=await store.query({...q,page:2});assert.equal(second.inspection.rows.length,5);assert.ok(second.inspection.rows.every(r=>!bySymbol.has(r.symbol)));
    const limited=await store.query({...q,symbols:[`${members[1]!.market}:${members[1]!.symbol}`]});assert.equal(limited.inspection.total,1);assert.equal(limited.inspection.rows[0]?.symbol,members[1]!.symbol);
    const empty=await store.query({...q,symbols:[]});assert.deepEqual(empty.inspection,{total:0,rows:[]});
  }finally{await pg.close();}
});
test("stored stock chart uses exact feature basis, preserves full warmup history and excludes future bars/features with reads only",async()=>{
  const {pg,store}=await database();try{
    const m=member(),u=universe([m]),bars=discoveryBars(303);await store.saveUniverse(u);
    const candidate=analyzeDiscovery(bars,undefined,discoveryContexts(bars)).candidates.at(-1)!;
    await store.saveBars(m,[...bars,{...bars.at(-1)!,date:"2024-10-30",close:999,high:1000}],"QA EXACT","naver-raw-ohlcv","2024-10-31T00:00:00Z");
    await store.saveBars(m,[{...bars.at(-1)!,close:888,high:900}],"QA OTHER","yahoo-kr-raw-ohlcv","2024-10-31T00:00:00Z");
    await store.saveFeatures(u.id,m,DISCOVERY_DEFAULTS.version,[candidate,{...candidate,date:"2024-10-30",close:999}],"QA EXACT","naver-raw-ohlcv");
    const statements:string[]=[];const readStore=createDiscoveryStore({query:async<T>(text:string,params:unknown[]=[])=>{statements.push(text);return(await pg.query<T>(text,params)).rows;}});
    const data=await readDiscoveryStockChart(readStore,{universeId:u.id,configVersion:DISCOVERY_DEFAULTS.version,market:m.market,symbol:m.symbol,asOf:"2024-10-29"},Date.parse("2024-11-01T00:00:00Z"));
    assert.ok(data);assert.equal(data.priceBasis,"naver-raw-ohlcv");assert.equal(data.source,"QA EXACT");assert.equal(data.bars.length,303);assert.equal(data.bars.at(-1)?.close,bars.at(-1)?.close);assert.equal(data.candidate?.date,"2024-10-29");assert.equal(data.observation.last,"2024-10-29");assert.ok(data.discovery?.history.every(r=>r.date<="2024-10-29"));
    assert.ok(statements.every(s=>/^SELECT\b/i.test(s.trim())));assert.ok(statements.some(s=>s.includes("LIMIT 5000")));
    await assert.rejects(readDiscoveryStockChart(readStore,{universeId:u.id,configVersion:DISCOVERY_DEFAULTS.version,market:m.market,symbol:m.symbol,asOf:"2024-11-02"},Date.parse("2024-11-01T00:00:00Z")),/INVALID_AS_OF/);
    await assert.rejects(readDiscoveryStockChart(readStore,{universeId:u.id,configVersion:DISCOVERY_DEFAULTS.version,market:"KR",symbol:"000000",asOf:"2024-10-29"},Date.parse("2024-11-01T00:00:00Z")),/MEMBER_MISSING/);
  }finally{await pg.close();}
});
test("chart can inspect persisted prices before final feature but never substitutes another basis for a known feature",async()=>{
  const {pg,store}=await database();try{
    const m=member(),u=universe([m]),bars=discoveryBars(303);await store.saveUniverse(u);
    await store.saveBars(m,bars,"QA ONLY STORED","yahoo-kr-raw-ohlcv","2024-10-29T00:00:00Z");
    const request={universeId:u.id,configVersion:DISCOVERY_DEFAULTS.version,market:m.market,symbol:m.symbol,asOf:"2024-10-29"};
    const data=await readDiscoveryStockChart(store,request,Date.parse("2024-11-01T00:00:00Z"));assert.ok(data);assert.equal(data.candidate,null);assert.equal(data.discovery,null);assert.equal(data.bars.length,303);assert.equal(data.source,"QA ONLY STORED");
    const candidate=analyzeDiscovery(bars,undefined,discoveryContexts(bars)).candidates.at(-1)!;await store.saveFeatures(u.id,m,DISCOVERY_DEFAULTS.version,[candidate],"QA MISSING BASIS","naver-raw-ohlcv");
    assert.equal(await readDiscoveryStockChart(store,request,Date.parse("2024-11-01T00:00:00Z")),null);
  }finally{await pg.close();}
});
