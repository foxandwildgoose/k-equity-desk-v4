import { randomUUID } from "node:crypto";
import { sma } from "../lib/chart-indicators.ts";
import { analyzeDiscovery, returnAt, sanitizeDiscoveryConfig, type Context, type DailyContext } from "../lib/bollinger/discovery.ts";
import { selectUniverse, securityKey, type SecurityMember } from "../lib/bollinger/discovery-universe.ts";
import { completedPriceBars } from "../lib/bollinger/bar-completion.ts";
import type { BollingerBar } from "../lib/bollinger/types.ts";
import type { DiscoveryStore } from "./bollinger-discovery-store.ts";

export type PriceProvider = (member: SecurityMember, initial: boolean) => Promise<{ bars: BollingerBar[]; source: string; basis: string }>;
export const BENCHMARKS = { KOSPI:"^KS11",KOSDAQ:"^KQ11",SP500:"^GSPC",NASDAQ100:"^NDX",NASDAQ_LISTED:"^IXIC" } as const;
export function contextHistory(bars: BollingerBar[], source: string): Context[] {
  const averages=sma(bars.map(b=>b.close),200);
  return bars.map((b,i)=>({asOf:b.date,source,return20:returnAt(bars,i,20),return63:returnAt(bars,i,63),aboveSma200:averages[i]===null?null:b.close>averages[i]!,slope200:averages[i]!==null&&averages[i-5]!=null&&averages[i-5]!>0?averages[i]!/averages[i-5]!-1:null}));
}
/** Single global DB lease covers this provider's rate budget across processes.
 * The bounded serial runner is deliberately conservative; retries use the same pacing. */
export async function collectDiscovery(store: DiscoveryStore, universeId: string, provider: PriceProvider, options: { offset?: number; limit?: number; budgetMs?: number; spacingMs?: number; config?: unknown; symbols?:readonly string[]; retrySymbols?:string[]; precompute?:boolean; retries?:number; heldLease?:{token:string;seconds:number}; fetchBenchmarks?: (symbol: typeof BENCHMARKS[keyof typeof BENCHMARKS]) => Promise<{bars:BollingerBar[];source:string}> } = {}) {
  const universe=await store.universe(universeId);if(!universe)throw new Error("UNIVERSE_MISSING");
  const config=sanitizeDiscoveryConfig(options.config), members=selectUniverse(universe,{top:"ALL",minWeight:0,sectors:[]}).selected.filter(m=>options.symbols===undefined||options.symbols.includes(securityKey(m)));
  const jobId=randomUUID(),scope="bollinger:daily-provider",token=options.heldLease?.token??randomUUID(),leaseSeconds=options.heldLease?.seconds??900;
  if(options.heldLease?!await store.renew(scope,token,leaseSeconds):!await store.lease(scope,token,leaseSeconds))throw new Error("COLLECTOR_ALREADY_RUNNING");
  const started=Date.now(),deadline=started+Math.min(options.budgetMs??1_800_000,3_600_000),spacing=Math.max(options.spacingMs??1500,0);
  let nextRequest=0;
  const summary={jobId,universeId,version:config.version,status:"running",requested:members.length,collected:0,updatedSymbols:[] as string[],errors:(options.retrySymbols??[]).map(symbol=>({symbol,code:"RETRY_PENDING"})),nextOffset:options.offset??0,storedBars:0,features:0,events:0,precomputeStatus:options.precompute===false?"deferred":"pending",benchmarkStatus:{} as Record<string,string>,mode:"daily",notificationDelivery:"not-configured",scheduler:"external-not-verified"};
  const paced=async<T>(request:()=>Promise<T>):Promise<T>=>{
    let failure:unknown;
    const retries=Math.max(1,Math.min(options.retries??3,3));
    for(let attempt=0;attempt<retries;attempt++) {
      if(Date.now()>=deadline)throw new Error("JOB_BUDGET_EXHAUSTED");
      if(!await store.renew(scope,token,leaseSeconds))throw new Error("LEASE_LOST");
      const pause=Math.max(0,nextRequest-Date.now());if(pause)await new Promise(resolve=>setTimeout(resolve,pause));
      nextRequest=Date.now()+spacing;
      try{return await request();}catch(error){failure=error;if(attempt<retries-1)await new Promise(resolve=>setTimeout(resolve,500*2**attempt+Math.random()*200));}
    }
    throw failure;
  };
  try {
    await store.startJob(jobId,universeId);
    if(options.fetchBenchmarks) {
      const keys=new Set(members.map(m=>m.market==="KR"?m.exchange==="KOSDAQ"?"KOSDAQ":"KOSPI":universe.kind==="NASDAQ100"?"NASDAQ100":universe.kind==="NASDAQ_LISTED"?"NASDAQ_LISTED":"SP500"));
      for(const key of keys) {
        try {
          const response=await paced(()=>options.fetchBenchmarks!(BENCHMARKS[key]));
          const bars=completedPriceBars(response.bars,{market:key==="KOSPI"||key==="KOSDAQ"?"KR":"US",interval:"day"}).filter(b=>b.completed);
          await store.saveBars({market:key==="KOSPI"||key==="KOSDAQ"?"KR":"US",symbol:BENCHMARKS[key]},bars,response.source,"price-index",new Date().toISOString());
          const history=await store.bars(key==="KOSPI"||key==="KOSDAQ"?"KR":"US",BENCHMARKS[key],"price-index");
          await store.saveContext(universeId,`market:${key}`,contextHistory(history,response.source));summary.benchmarkStatus[key]=bars.length?"received":"unavailable";
        }catch{summary.benchmarkStatus[key]="failed-preserved-last-success";}
      }
    }
    const offset=options.offset??0,end=Math.min(members.length,offset+(options.limit??members.length));
    const indexes=[...new Set([...members.flatMap((m,i)=>options.retrySymbols?.includes(securityKey(m))?[i]:[]),...Array.from({length:Math.max(0,end-offset)},(_,i)=>offset+i)])];
    for(const i of indexes) {
      if(Date.now()>=deadline){summary.status="partial-budget";break;}
      const member=members[i]!;
      summary.errors=summary.errors.filter(e=>e.symbol!==securityKey(member));
      try {
        // Probe existing source-separated bases; never mix adjusted and raw bars.
        const basis=member.market==="US"?"yahoo-us-adjusted-ohlcv":"yahoo-kr-raw-ohlcv";
        const existing=await store.bars(member.market,member.symbol,basis);
        const response=await paced(()=>provider(member,existing.length<205));
        if(!response.bars.length)throw new Error("NO_HISTORY");
        const stored=await store.saveBars(member,response.bars,response.source,response.basis,new Date().toISOString());
        if(!stored)throw new Error("NO_HISTORY");
        summary.storedBars+=stored;
        summary.collected++;
        summary.updatedSymbols.push(securityKey(member));
      }catch(error){
        if(error instanceof Error&&error.message==="JOB_BUDGET_EXHAUSTED"){summary.status="partial-budget";break;}
        if(error instanceof Error&&error.message==="LEASE_LOST")throw error;
        summary.errors.push({symbol:securityKey(member),code:error instanceof Error&&error.message==="NO_HISTORY"?error.message:"PRICE_FETCH_FAILED"});
      }
      summary.nextOffset=Math.max(summary.nextOffset,i+1);
      // A checkpoint is persisted after each security; explicit resume starts at nextOffset.
      await store.endJob(jobId,"running",summary);
    }
    if(options.precompute!==false) try {
      const precomputed=await precomputeDiscovery(store,universeId,config,async()=>{if(Date.now()>=deadline)throw new Error("JOB_BUDGET_EXHAUSTED");if(!await store.renew(scope,token,leaseSeconds))throw new Error("LEASE_LOST");});
      summary.features=precomputed.features;summary.events=precomputed.events;summary.precomputeStatus="complete";
    }catch(error){
      if(!(error instanceof Error)||error.message!=="JOB_BUDGET_EXHAUSTED")throw error;
      summary.status="partial-budget";summary.precomputeStatus="partial-rerun-precompute";
    }
    summary.status=summary.status==="partial-budget"?summary.status:summary.nextOffset<members.length?"partial-limit":summary.errors.length?"partial-errors":"complete";
    await store.endJob(jobId,summary.status,summary);
    return summary;
  }catch(error){summary.status="failed";await store.endJob(jobId,"failed",summary);throw error;}
  finally{if(!options.heldLease)await store.release(scope,token);}
}
/** Shared two-pass SQL precompute. Memory is bounded to one security, not the whole market. */
export async function precomputeDiscovery(store: DiscoveryStore, universeId: string, raw?:unknown, checkpoint?:()=>Promise<void>,options:{symbols?:readonly string[];recentDays?:number;storeEvents?:boolean;contextOnly?:boolean;onSecurityComputed?:(key:string)=>Promise<void>}={}) {
  const universe=await store.universe(universeId);if(!universe)throw new Error("UNIVERSE_MISSING");
  const config=sanitizeDiscoveryConfig(raw),members=selectUniverse(universe,{top:"ALL",minWeight:0,sectors:[]}).selected.filter(m=>!options.symbols||options.symbols.includes(securityKey(m)));
  const recentDays=options.recentDays===undefined?null:Math.max(1,Math.min(Math.floor(options.recentDays),5000));
  const histories=async(member:SecurityMember)=>{
    const meta=(await store.barMetadata(member)).filter(m=>["yahoo-us-adjusted-ohlcv","yahoo-kr-raw-ohlcv","naver-raw-ohlcv"].includes(m.price_basis)).sort((a,b)=>b.day.localeCompare(a.day)||b.fetched_at.localeCompare(a.fetched_at));
    if(!meta[0])return null;
    return {bars:await store.bars(member.market,member.symbol,meta[0].price_basis),basis:meta[0].price_basis,source:meta[0].source};
  };
  let contextSecurities=0;
  for(const member of members) {
    await checkpoint?.();const history=await histories(member);if(!history)continue;
    const contexts=contextHistory(history.bars,history.source);
    await store.saveContext(universeId,`security:${securityKey(member)}`,recentDays===null?contexts:contexts.slice(-recentDays));
    contextSecurities++;
  }
  // Collection builds the peer observations first. The final pass alone publishes features/events.
  if(options.contextOnly)return {features:0,events:0,version:config.version,securities:contextSecurities,priceBasis:"source-separated",delivery:"detected-only"};
  const usBenchmark=universe.kind==="NASDAQ100"?"NASDAQ100":universe.kind==="NASDAQ_LISTED"?"NASDAQ_LISTED":"SP500";
  await checkpoint?.();await store.aggregateContexts(universeId,usBenchmark);
  let features=0,events=0,securities=0;
  for(const member of members) {
    await checkpoint?.();const history=await histories(member);if(!history)continue;
    const benchmark=member.market==="US"?usBenchmark:member.exchange==="KOSDAQ"?"KOSDAQ":"KOSPI";
    const markets=new Map((await store.contextScope(universeId,`market:${benchmark}`)).map(c=>[c.asOf,c]));
    const sectors=new Map((await store.contextScope(universeId,`sector:${member.market}:${member.sector}`)).map(c=>[c.asOf,c]));
    const security=await store.contextScope(universeId,`security:${securityKey(member)}`),contexts:Record<string,DailyContext>={};
    for(const c of security)contexts[c.asOf]={market:markets.get(c.asOf),sector:sectors.get(c.asOf),rsPercentile:c.rsPercentile??null};
    const result=analyzeDiscovery(history.bars,config,contexts,securityKey(member),{marketCap:member.marketCap});
    // Calculate on the full real chronological history. Only storage is sliced for bounded cloud work.
    const candidates=recentDays===null?result.candidates:result.candidates.slice(-recentDays),first=candidates[0]?.date;
    const detected=recentDays===null?result.events:result.events.filter(e=>first&&e.date>=first);
    for(let i=0;i<candidates.length;i+=500){await checkpoint?.();await store.saveFeatures(universeId,member,result.config.version,candidates.slice(i,i+500),history.source,history.basis);}
    if(options.storeEvents!==false)await store.saveEvents(universeId,member,result.config.version,detected);
    features+=candidates.length;events+=options.storeEvents===false?0:detected.length;securities++;
    await options.onSecurityComputed?.(securityKey(member));
  }
  return {features,events,version:config.version,securities,priceBasis:"source-separated",delivery:"detected-only"};
}
export async function runDiscoveryPrecompute(store:DiscoveryStore,universeId:string,config?:unknown,budgetMs=1_800_000) {
  const token=randomUUID(),scope="bollinger:daily-provider";
  if(!await store.lease(scope,token))throw new Error("COLLECTOR_ALREADY_RUNNING");
  const jobId=randomUUID(),deadline=Date.now()+Math.min(budgetMs,3_600_000);
  try {
    await store.startJob(jobId,universeId);
    const result=await precomputeDiscovery(store,universeId,config,async()=>{if(Date.now()>=deadline)throw new Error("JOB_BUDGET_EXHAUSTED");if(!await store.renew(scope,token))throw new Error("LEASE_LOST");});
    await store.endJob(jobId,"precomputed",result);return result;
  }catch(error){
    if(error instanceof Error&&error.message==="JOB_BUDGET_EXHAUSTED") {const result={status:"partial-budget",jobId,recovery:"rerun-precompute-idempotently",version:sanitizeDiscoveryConfig(config).version};await store.endJob(jobId,"partial-budget",result);return result;}
    await store.endJob(jobId,"precompute-failed",{});throw error;
  }
  finally{await store.release(scope,token);}
}
