import { randomUUID } from "node:crypto";
import { cloudJobScope, safeCloudJob, type BollingerCloudConfig, type CloudTarget } from "./bollinger-cloud-config.ts";
import { BENCHMARKS, collectDiscovery, contextHistory, precomputeDiscovery, type PriceProvider } from "./bollinger-discovery-jobs.ts";
import { selectUniverse, type UniverseSnapshot } from "../lib/bollinger/discovery-universe.ts";
import { completedPriceBars } from "../lib/bollinger/bar-completion.ts";
import { koreaDay, type KrMembershipProgress } from "./bollinger-membership.ts";
import type { DiscoveryStore } from "./bollinger-discovery-store.ts";
import type { BollingerBar } from "../lib/bollinger/types.ts";

type Phase = "membership" | "benchmarks" | "collect" | "refresh" | "complete" | "complete-with-errors";
type CloudState = {
  schema:1; jobId:string; target:CloudTarget; top:BollingerCloudConfig["top"]; sourceDay:string; phase:Phase;
  universeId:string|null; membership:KrMembershipProgress|null; membershipRows:number; membershipTotal:number;
  requested:number; supported:number; nextOffset:number; successfulKeys:string[]; computedKeys:string[]; pendingCompute:string[];
  errors:{symbol:string;code:string}[]; retryKeys:string[]; benchmarkKeys:string[]; benchmarkOffset:number; benchmarkStatus:Record<string,string>;
  lastRunAt:string; lastError:string|null; budgetStopped:boolean;
};
export type CloudProviders = {
  membership:(target:CloudTarget,previous:KrMembershipProgress|null,options:{checkpoint:()=>Promise<void>;onPage:(progress:KrMembershipProgress)=>Promise<void>})=>Promise<{progress:KrMembershipProgress|null;snapshot:UniverseSnapshot|null}>;
  prices:PriceProvider;
  benchmark:(symbol:typeof BENCHMARKS[keyof typeof BENCHMARKS])=>Promise<{bars:BollingerBar[];source:string}>;
};
const sourceDay=(target:CloudTarget,now:string)=>target==="NASDAQ_LISTED"?new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now)):koreaDay(now);
const isDone=(state:CloudState)=>state.phase==="complete"&&Object.values(state.benchmarkStatus).every(s=>s==="received");
const terminal=(state:CloudState)=>state.phase==="complete"||state.phase==="complete-with-errors";
const safeError=(error:unknown,fallback:string)=>error instanceof Error&&["JOB_BUDGET_EXHAUSTED","LEASE_LOST","KR_MEMBERSHIP_CHANGED_RESTART_REQUIRED","MEMBERSHIP_FAILED","COMPUTE_FAILED","DATABASE_QUERY_FAILED"].includes(error.message)?error.message:fallback;
function fresh(target:CloudTarget,config:BollingerCloudConfig,now:string):CloudState {
  return {schema:1,jobId:randomUUID(),target,top:config.top,sourceDay:sourceDay(target,now),phase:"membership",universeId:null,membership:null,membershipRows:0,membershipTotal:0,requested:0,supported:0,nextOffset:0,successfulKeys:[],computedKeys:[],pendingCompute:[],errors:[],retryKeys:[],benchmarkKeys:[],benchmarkOffset:0,benchmarkStatus:{},lastRunAt:now,lastError:null,budgetStopped:false};
}
/** One shared DB lease and durable job checkpoints. No background work outlives the request. */
export async function runBollingerCloud(store:DiscoveryStore,config:BollingerCloudConfig,providers:CloudProviders,options:{clock?:()=>number;spacingMs?:number}={}) {
  const clock=options.clock??Date.now,started=clock(),now=()=>new Date(clock()).toISOString();
  const deadline=started+config.budgetSeconds*1000-15000,scope="bollinger:daily-provider",token=randomUUID(),leaseSeconds=config.budgetSeconds+60;
  if(!await store.lease(scope,token,leaseSeconds))return {status:"ALREADY_RUNNING",jobs:[]};
  let state:CloudState|null=null;
  const save=async()=>{
    if(!state)return;
    state.lastRunAt=now();
    await store.endJob(state.jobId,state.phase,state);
  };
  const checkpoint=async()=>{
    if(clock()>=deadline)throw new Error("JOB_BUDGET_EXHAUSTED");
    if(!await store.renew(scope,token,leaseSeconds))throw new Error("LEASE_LOST");
  };
  let nextProviderRequest=started;
  const paced=async<T>(request:()=>Promise<T>)=>{
    const pause=Math.max(0,nextProviderRequest-clock());
    if(pause)await new Promise(resolve=>setTimeout(resolve,pause));
    await checkpoint();nextProviderRequest=clock()+(options.spacingMs??1500);
    return request();
  };
  try {
    const candidates=await Promise.all(config.targets.map(async target=>{
      const job=await store.latestJob(cloudJobScope(target,config.top));
      const old=job?.summary as unknown as CloudState|undefined;
      return old?.schema===1&&old.target===target&&old.top===config.top?old:fresh(target,config,now());
    }));
    // Finish checkpointed work first; a new day gets its own immutable membership snapshot.
    state=candidates.find(s=>!isDone(s)&&s.phase!=="complete-with-errors")??candidates.find(s=>s.sourceDay!==sourceDay(s.target,now()))??candidates.find(s=>s.phase==="complete-with-errors")??null;
    if(!state)return {status:"UP_TO_DATE",jobs:candidates.map(s=>safeCloudJob(s as unknown as Record<string,unknown>,s.target))};
    if((state.phase==="complete"||state.phase==="complete-with-errors")&&state.sourceDay!==sourceDay(state.target,now()))state=fresh(state.target,config,now());
    await store.startJob(state.jobId,cloudJobScope(state.target,config.top));
    state.budgetStopped=false;state.lastError=null;
    if(state.phase==="complete-with-errors") {
      state.retryKeys=state.errors.map(e=>e.symbol);state.phase="collect";
    }
    if(state.phase==="complete"){state.benchmarkOffset=0;state.phase="benchmarks";}
    await save();
    while(!terminal(state)) {
      await checkpoint();
      if(state.phase==="membership") {
        try {
          const result=await providers.membership(state.target,state.membership,{checkpoint,onPage:async progress=>{
            state!.membership=progress;state!.membershipRows=progress.members.length;state!.membershipTotal=progress.total??0;await save();
          }});
          state.membership=result.progress;
          if(!result.snapshot){await save();continue;}
          await store.saveUniverse(result.snapshot);
          state.sourceDay=sourceDay(state.target,result.snapshot.knownAt);
          const selected=selectUniverse(result.snapshot,{top:config.top,minWeight:0,sectors:[]});
          state.universeId=result.snapshot.id;state.requested=selected.selected.length;state.supported=selected.supportedCount;
          state.membershipRows=result.snapshot.members.length;state.membershipTotal=state.membership?.total??result.snapshot.members.length;state.membership=null;
          state.benchmarkKeys=[...new Set(selected.selected.map(m=>m.market==="KR"?m.exchange==="KOSDAQ"?"KOSDAQ":"KOSPI":result.snapshot!.kind==="NASDAQ_LISTED"?"NASDAQ_LISTED":"SP500"))];
          state.phase="benchmarks";await save();
        }catch(error){
          const code=safeError(error,"MEMBERSHIP_FAILED");
          if(code==="KR_MEMBERSHIP_CHANGED_RESTART_REQUIRED"){state.membership=null;state.membershipRows=0;state.membershipTotal=0;}
          throw new Error(code);
        }
      } else if(state.phase==="benchmarks") {
        const key=state.benchmarkKeys[state.benchmarkOffset] as keyof typeof BENCHMARKS|undefined;
        if(!key){state.phase="collect";await save();continue;}
        try {
          const response=await paced(()=>providers.benchmark(BENCHMARKS[key])),market=key==="KOSPI"||key==="KOSDAQ"?"KR":"US";
          const bars=completedPriceBars(response.bars,{market,interval:"day"}).filter(b=>b.completed);
          const stored=await store.saveBars({market,symbol:BENCHMARKS[key]},bars,response.source,"price-index",now());
          if(!stored)throw new Error("NO_HISTORY");
          const history=await store.bars(market,BENCHMARKS[key],"price-index");
          await store.saveContext(state.universeId!,`market:${key}`,contextHistory(history,response.source).slice(-config.recentStoredDays));
          state.benchmarkStatus[key]="received";
        }catch(error){
          const code=safeError(error,"BENCHMARK_FAILED");if(code!=="BENCHMARK_FAILED")throw error;
          state.benchmarkStatus[key]="failed-preserved-last-success";state.lastError="BENCHMARK_FAILED";
          const market=key==="KOSPI"||key==="KOSDAQ"?"KR":"US",history=await store.bars(market,BENCHMARKS[key],"price-index");
          if(history.length)await store.saveContext(state.universeId!,`market:${key}`,contextHistory(history,"stored benchmark / refresh failed").slice(-config.recentStoredDays));
        }
        state.benchmarkOffset++;await save();
      } else {
        if(state.pendingCompute.length) {
          const symbol=state.pendingCompute[0]!;
          try {
            const computed=await precomputeDiscovery(store,state.universeId!,undefined,checkpoint,{symbols:[symbol],recentDays:config.recentStoredDays,storeEvents:state.phase==="refresh",onSecurityComputed:async key=>{
              state!.computedKeys=[...new Set([...state!.computedKeys,key])];
            }});
            if(!computed.securities)throw new Error("COMPUTE_FAILED");
            state.pendingCompute.shift();await save();
          }catch(error){throw new Error(safeError(error,"COMPUTE_FAILED"));}
          continue;
        }
        if(state.phase==="refresh") {state.phase=state.errors.length?"complete-with-errors":"complete";await save();break;}
        if(state.nextOffset>=state.requested&&!state.retryKeys.length) {
          // Second pass updates the selected securities against all collected peer contexts.
          state.phase="refresh";state.pendingCompute=[...state.successfulKeys];await save();continue;
        }
        const retry=state.retryKeys.slice(0,1),remaining=Math.max(1,deadline-clock());
        const result=await collectDiscovery(store,state.universeId!,(member,initial)=>paced(()=>providers.prices(member,initial)),{offset:state.nextOffset,limit:retry.length?0:1,retrySymbols:retry,budgetMs:remaining,spacingMs:0,retries:1,precompute:false,heldLease:{token,seconds:leaseSeconds}});
        // Keep retry work until collection has made progress; budget exhaustion never consumes it.
        if(retry.length&&result.errors.every(e=>e.code!=="JOB_BUDGET_EXHAUSTED"&&e.code!=="RETRY_PENDING"))state.retryKeys.shift();
        state.nextOffset=Math.min(state.requested,result.nextOffset);
        const attempted=[...result.updatedSymbols,...result.errors.filter(e=>e.code!=="RETRY_PENDING").map(e=>e.symbol)];
        state.errors=state.errors.filter(e=>!attempted.includes(e.symbol));
        state.errors.push(...result.errors.filter(e=>e.code!=="RETRY_PENDING"));
        state.successfulKeys=[...new Set([...state.successfulKeys,...result.updatedSymbols])];
        state.pendingCompute=[...new Set([...state.pendingCompute,...result.updatedSymbols])];
        await save();
        if(result.status==="partial-budget")throw new Error("JOB_BUDGET_EXHAUSTED");
      }
    }
    return {status:state.phase==="complete"?isDone(state)?"COMPLETE":"COMPLETE_WITH_WARNINGS":"PARTIAL_ERRORS",jobs:[safeCloudJob(state as unknown as Record<string,unknown>,state.target)]};
  }catch(error){
    const code=safeError(error,"DATABASE_QUERY_FAILED");
    if(state){state.budgetStopped=code==="JOB_BUDGET_EXHAUSTED";state.lastError=state.budgetStopped?null:code;await save();}
    return {status:code==="JOB_BUDGET_EXHAUSTED"?"PARTIAL_BUDGET":code,jobs:state?[safeCloudJob(state as unknown as Record<string,unknown>,state.target)]:[]};
  }finally{await store.release(scope,token);}
}
