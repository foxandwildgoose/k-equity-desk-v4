import { createHash, randomUUID } from "node:crypto";
import { cloudJobScope, safeCloudJob, type BollingerCloudConfig, type CloudTarget } from "./bollinger-cloud-config.ts";
import { BENCHMARKS, collectDiscovery, contextHistory, precomputeDiscovery, type PriceProvider } from "./bollinger-discovery-jobs.ts";
import { selectUniverse, securityKey, type UniverseSnapshot, type UniverseSelection } from "../lib/bollinger/discovery-universe.ts";
import { discoveryConfigFromVersion, DISCOVERY_DEFAULTS, type DiscoveryConfig } from "../lib/bollinger/discovery.ts";
import { completedPriceBars } from "../lib/bollinger/bar-completion.ts";
import { koreaDay, type KrMembershipProgress } from "./bollinger-membership.ts";
import type { DiscoveryStore } from "./bollinger-discovery-store.ts";
import type { BollingerBar } from "../lib/bollinger/types.ts";
import type { BootstrapBollingerInput } from "../lib/bollinger/collection-request.ts";

type Phase = "membership" | "benchmarks" | "collect" | "refresh" | "complete" | "complete-with-errors";
type CloudState = {
  schema:2; jobId:string; target:CloudTarget; top:BollingerCloudConfig["top"]; sourceDay:string; phase:Phase;
  universeId:string|null; membership:KrMembershipProgress|null; membershipRows:number; membershipTotal:number;
  requested:number; supported:number; nextOffset:number; successfulKeys:string[]; provisionalKeys:string[]; computedKeys:string[]; pendingCompute:string[];
  errors:{symbol:string;code:string}[]; retryKeys:string[]; benchmarkKeys:string[]; benchmarkOffset:number; benchmarkStatus:Record<string,string>;
  lastRunAt:string; lastError:string|null; budgetStopped:boolean;runToken:string|null;execution:"RUNNING"|"PAUSED"|"COMPLETE"|"FAILED";configVersion:string;selectedKeys:string[]|null;
};
export type CloudProviders = {
  membership:(target:CloudTarget,previous:KrMembershipProgress|null,options:{checkpoint:()=>Promise<void>;onPage:(progress:KrMembershipProgress)=>Promise<void>})=>Promise<{progress:KrMembershipProgress|null;snapshot:UniverseSnapshot|null}>;
  prices:PriceProvider;
  benchmark:(symbol:typeof BENCHMARKS[keyof typeof BENCHMARKS])=>Promise<{bars:BollingerBar[];source:string}>;
};
const sourceDay=(target:CloudTarget,now:string)=>target==="NASDAQ_LISTED"?new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now)):koreaDay(now);
const isDone=(state:CloudState)=>state.phase==="complete"&&Object.values(state.benchmarkStatus).every(s=>s==="received");
const terminal=(state:CloudState)=>state.phase==="complete"||state.phase==="complete-with-errors";
const safeError=(error:unknown,fallback:string)=>error instanceof Error&&["JOB_BUDGET_EXHAUSTED","LEASE_LOST","KR_MEMBERSHIP_CHANGED_RESTART_REQUIRED","MEMBERSHIP_FAILED","COMPUTE_FAILED","DATABASE_QUERY_FAILED","NO_SELECTION","SELECTION_INVALID","UNIVERSE_UNSUPPORTED"].includes(error.message)?error.message:fallback;
function fresh(target:CloudTarget,config:BollingerCloudConfig,now:string):CloudState {
  return {schema:2,jobId:randomUUID(),target,top:config.top,sourceDay:sourceDay(target,now),phase:"membership",universeId:null,membership:null,membershipRows:0,membershipTotal:0,requested:0,supported:0,nextOffset:0,successfulKeys:[],provisionalKeys:[],computedKeys:[],pendingCompute:[],errors:[],retryKeys:[],benchmarkKeys:[],benchmarkOffset:0,benchmarkStatus:{},lastRunAt:now,lastError:null,budgetStopped:false,runToken:null,execution:"PAUSED",configVersion:DISCOVERY_DEFAULTS.version,selectedKeys:null};
}
function upgradeState(raw:Record<string,unknown>|undefined,target:CloudTarget,top:BollingerCloudConfig["top"]):CloudState|null {
  if(!raw||![1,2].includes(Number(raw.schema))||raw.target!==target||raw.top!==top)return null;
  const state=raw as unknown as CloudState;
  if(raw.schema===1){
    // Legacy counts described first-pass features, not completed peer refreshes.
    state.provisionalKeys=[...state.computedKeys];
    if(!terminal(state)){state.computedKeys=[];if(state.phase==="refresh")state.pendingCompute=[...state.successfulKeys];}
    state.schema=2;state.configVersion=DISCOVERY_DEFAULTS.version;state.selectedKeys=null;state.runToken=null;state.execution="PAUSED";
  }
  return state;
}
export type SelectedBollingerRequest={universeId:string;configVersion:string;selection:UniverseSelection;symbols?:string[]};
function canonicalRequest(request:SelectedBollingerRequest) {
  if(typeof request.universeId!=="string"||!request.universeId||request.universeId.length>160)throw new Error("SELECTION_INVALID");
  if(typeof request.configVersion!=="string"||request.configVersion.length>1500||!discoveryConfigFromVersion(request.configVersion).recognized)throw new Error("CONFIGURATION_VERSION_INVALID");
  const s=request.selection;
  if(!s||!["ALL",10,20,50,100,200].includes(s.top)||!Number.isFinite(s.minWeight)||s.minWeight<0||s.minWeight>100||!Array.isArray(s.sectors)||s.sectors.length>30||s.sectors.some(v=>typeof v!=="string"||v.length>80))throw new Error("SELECTION_INVALID");
  if(request.symbols!==undefined&&(!Array.isArray(request.symbols)||request.symbols.length>15000||request.symbols.some(v=>typeof v!=="string"||!/^(KR:[0-9A-Z]{6}|US:[A-Z][A-Z0-9.-]{0,14})$/.test(v))))throw new Error("SELECTION_INVALID");
  return {universeId:request.universeId,configVersion:request.configVersion,selection:{top:s.top,minWeight:s.minWeight,sectors:[...new Set(s.sectors)].sort()},...(request.symbols===undefined?{}:{symbols:[...new Set(request.symbols)].sort()})};
}
export function selectedBollingerScope(request:SelectedBollingerRequest) {return `bollinger:selected:v1:${createHash("sha256").update(JSON.stringify(canonicalRequest(request))).digest("hex")}`;}
function canonicalBootstrap(request:BootstrapBollingerInput) {
  if(typeof request.bootstrapTarget!=="string"||!["KOSPI","KOSDAQ","NASDAQ_LISTED"].includes(request.bootstrapTarget)&&!/^ETF:[0-9A-Z]{6}$/.test(request.bootstrapTarget))throw new Error("UNIVERSE_UNSUPPORTED");
  const {configVersion,selection,symbols}=canonicalRequest({...request,universeId:"bootstrap"});
  if(request.bootstrapTarget.startsWith("ETF:")&&![10,20,50,"ALL"].includes(selection.top))throw new Error("SELECTION_INVALID");
  if(symbols?.length===0)throw new Error("NO_SELECTION");
  return {bootstrapTarget:request.bootstrapTarget as CloudTarget,configVersion,selection,...(symbols===undefined?{}:{symbols})};
}
export function bootstrapBollingerScope(request:BootstrapBollingerInput) {return `bollinger:bootstrap:v1:${createHash("sha256").update(JSON.stringify(canonicalBootstrap(request))).digest("hex")}`;}
function targetOf(universe:UniverseSnapshot):CloudTarget {
  if(["KOSPI","KOSDAQ","NASDAQ_LISTED"].includes(universe.kind))return universe.kind as CloudTarget;
  const code=/^ETF:([0-9A-Z]{6}):/.exec(universe.id)?.[1];
  if(universe.kind==="ETF"&&code)return `ETF:${code}`;
  throw new Error("UNIVERSE_UNSUPPORTED");
}
type SelectedRun={scope:string;universe:UniverseSnapshot;keys:string[];supported:number;calculation:DiscoveryConfig};
type BootstrapRun={scope:string;request:ReturnType<typeof canonicalBootstrap>};
async function resolveSelected(store:DiscoveryStore,request:SelectedBollingerRequest):Promise<SelectedRun> {
  const canonical=canonicalRequest(request),universe=await store.universe(canonical.universeId);
  if(!universe)throw new Error("UNIVERSE_MISSING");targetOf(universe);
  if(universe.kind==="ETF"&&![10,20,50,"ALL"].includes(canonical.selection.top))throw new Error("SELECTION_INVALID");
  const selection=selectUniverse(universe,canonical.selection),keys=selection.selected.map(securityKey).filter(key=>canonical.symbols===undefined||canonical.symbols.includes(key));
  if(!keys.length)throw new Error("NO_SELECTION");
  return {scope:selectedBollingerScope(canonical),universe,keys,supported:selection.supportedCount,calculation:discoveryConfigFromVersion(canonical.configVersion).config};
}
export async function readSelectedBollingerProgress(store:DiscoveryStore,request:SelectedBollingerRequest) {
  const selected=await resolveSelected(store,request),summary=(await store.latestJob(selected.scope))?.summary??null;
  const active=typeof summary?.runToken==="string"&&await store.leaseMatches("bollinger:daily-provider",summary.runToken);
  const state=summary?upgradeState(summary,targetOf(selected.universe),request.selection.top):null;
  return {status:"READY",jobs:[safeCloudJob(state as unknown as Record<string,unknown>|null,targetOf(selected.universe),active)]};
}
export async function runSelectedBollingerCloud(store:DiscoveryStore,config:BollingerCloudConfig,providers:CloudProviders,request:SelectedBollingerRequest,options:{clock?:()=>number;spacingMs?:number}={}) {
  const selected=await resolveSelected(store,request);
  return runBollingerCloud(store,{...config,targets:[targetOf(selected.universe)],top:request.selection.top},providers,{...options,selected});
}
/** Read-only progress does not acquire a lease, import providers, or publish a partial membership. */
export async function readBootstrapBollingerProgress(store:DiscoveryStore,input:BootstrapBollingerInput) {
  const request=canonicalBootstrap(input),summary=(await store.latestJob(bootstrapBollingerScope(request)))?.summary??null;
  const active=typeof summary?.runToken==="string"&&await store.leaseMatches("bollinger:daily-provider",summary.runToken);
  const state=summary?upgradeState(summary,request.bootstrapTarget,request.selection.top):null;
  return {status:"READY",jobs:[safeCloudJob(state as unknown as Record<string,unknown>|null,request.bootstrapTarget,active)]};
}
export async function runBootstrapBollingerCloud(store:DiscoveryStore,config:BollingerCloudConfig,providers:CloudProviders,input:BootstrapBollingerInput,options:{clock?:()=>number;spacingMs?:number}={}) {
  const request=canonicalBootstrap(input);
  return runBollingerCloud(store,{...config,targets:[request.bootstrapTarget],top:request.selection.top},providers,{...options,bootstrap:{scope:bootstrapBollingerScope(request),request}});
}
/** One shared DB lease and durable job checkpoints. No background work outlives the request. */
export async function runBollingerCloud(store:DiscoveryStore,config:BollingerCloudConfig,providers:CloudProviders,options:{clock?:()=>number;spacingMs?:number;selected?:SelectedRun;bootstrap?:BootstrapRun}={}) {
  const clock=options.clock??Date.now,started=clock(),now=()=>new Date(clock()).toISOString();
  const deadline=started+config.budgetSeconds*1000-15000,scope="bollinger:daily-provider",token=randomUUID(),leaseSeconds=config.budgetSeconds+60;
  if(!await store.lease(scope,token,leaseSeconds))return {status:"ALREADY_RUNNING",jobs:[]};
  let state:CloudState|null=null;
  const save=async()=>{
    if(!state)return;
    state.lastRunAt=now();
    const status=state.execution==="RUNNING"?"running":state.execution==="PAUSED"?"paused":state.execution==="FAILED"?"failed":state.phase;
    await store.endJob(state.jobId,status,state);
  };
  const publicJob=()=>safeCloudJob(state as unknown as Record<string,unknown>|null,state!.target,false);
  const jobScope=(target:CloudTarget)=>options.selected?.scope??options.bootstrap?.scope??cloudJobScope(target,config.top);
  const freshState=(target:CloudTarget)=>{
    const value=fresh(target,config,now()),selected=options.selected;
    if(options.bootstrap)value.configVersion=options.bootstrap.request.configVersion;
    if(!selected)return value;
    const keys=new Set(selected.keys),members=selectUniverse(selected.universe,{top:"ALL",minWeight:0,sectors:[]}).selected.filter(m=>keys.has(securityKey(m)));
    value.universeId=selected.universe.id;value.configVersion=selected.calculation.version;value.selectedKeys=selected.keys;
    value.requested=members.length;value.supported=selected.supported;value.membershipRows=selected.universe.members.length;value.membershipTotal=selected.universe.members.length;
    value.benchmarkKeys=[...new Set(members.map(m=>m.market==="KR"?m.exchange==="KOSDAQ"?"KOSDAQ":"KOSPI":selected.universe.kind==="NASDAQ_LISTED"?"NASDAQ_LISTED":"SP500"))];
    value.phase="benchmarks";return value;
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
      const job=await store.latestJob(jobScope(target));
      return upgradeState(job?.summary,target,config.top)??freshState(target);
    }));
    // Finish checkpointed work first; a new day gets its own immutable membership snapshot.
    state=candidates.find(s=>!isDone(s)&&s.phase!=="complete-with-errors")??candidates.find(s=>s.sourceDay!==sourceDay(s.target,now()))??candidates.find(s=>s.phase==="complete-with-errors")??null;
    if(!state)return {status:"UP_TO_DATE",jobs:candidates.map(s=>safeCloudJob(s as unknown as Record<string,unknown>,s.target))};
    if((terminal(state)||state.lastError==="NO_SELECTION")&&state.sourceDay!==sourceDay(state.target,now()))state=freshState(state.target);
    // A completed membership already proved this exact intersection empty; do not fetch it again today.
    if(options.bootstrap&&state.universeId&&state.lastError==="NO_SELECTION")return {status:"NO_SELECTION",jobs:[publicJob()]};
    await store.startJob(state.jobId,jobScope(state.target));
    state.budgetStopped=false;state.lastError=null;state.runToken=token;state.execution="RUNNING";
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
          if(options.bootstrap&&targetOf(result.snapshot)!==state.target)throw new Error("UNIVERSE_UNSUPPORTED");
          await store.saveUniverse(result.snapshot);
          state.sourceDay=sourceDay(state.target,result.snapshot.knownAt);
          const request=options.bootstrap?.request,selected=selectUniverse(result.snapshot,request?.selection??{top:config.top,minWeight:0,sectors:[]});
          const allowed=request?.symbols===undefined?null:new Set(request.symbols),members=selected.selected.filter(m=>!allowed||allowed.has(securityKey(m)));
          state.universeId=result.snapshot.id;state.requested=members.length;state.supported=selected.supportedCount;
          state.membershipRows=result.snapshot.members.length;state.membershipTotal=state.membership?.total??result.snapshot.members.length;state.membership=null;
          if(request){state.selectedKeys=members.map(securityKey);if(!members.length)throw new Error("NO_SELECTION");}
          state.benchmarkKeys=[...new Set(members.map(m=>m.market==="KR"?m.exchange==="KOSDAQ"?"KOSDAQ":"KOSPI":result.snapshot!.kind==="NASDAQ_LISTED"?"NASDAQ_LISTED":"SP500"))];
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
            const computed=await precomputeDiscovery(store,state.universeId!,discoveryConfigFromVersion(state.configVersion).config,checkpoint,{symbols:[symbol],recentDays:config.recentStoredDays,contextOnly:state.phase!=="refresh",storeEvents:state.phase==="refresh",onSecurityComputed:async key=>{
              state!.computedKeys=[...new Set([...state!.computedKeys,key])];
            }});
            if(!computed.securities)throw new Error("COMPUTE_FAILED");
            if(state.phase!=="refresh")state.provisionalKeys=[...new Set([...state.provisionalKeys,symbol])];
            state.pendingCompute.shift();await save();
          }catch(error){throw new Error(safeError(error,"COMPUTE_FAILED"));}
          continue;
        }
        if(state.phase==="refresh") {state.phase=state.errors.length?"complete-with-errors":"complete";state.execution="COMPLETE";await save();break;}
        if(state.nextOffset>=state.requested&&!state.retryKeys.length) {
          // Second pass updates the selected securities against all collected peer contexts.
          state.phase="refresh";state.computedKeys=[];state.pendingCompute=[...state.successfulKeys];await save();continue;
        }
        const retry=state.retryKeys.slice(0,1),remaining=Math.max(1,deadline-clock());
        const result=await collectDiscovery(store,state.universeId!,(member,initial)=>paced(()=>providers.prices(member,initial)),{offset:state.nextOffset,limit:retry.length?0:1,symbols:state.selectedKeys??undefined,retrySymbols:retry,budgetMs:remaining,spacingMs:0,retries:1,precompute:false,heldLease:{token,seconds:leaseSeconds}});
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
    return {status:state.phase==="complete"?isDone(state)?"COMPLETE":"COMPLETE_WITH_WARNINGS":"PARTIAL_ERRORS",jobs:[publicJob()]};
  }catch(error){
    const code=safeError(error,"DATABASE_QUERY_FAILED");
    if(state){state.budgetStopped=code==="JOB_BUDGET_EXHAUSTED";state.lastError=state.budgetStopped?null:code;state.execution=state.budgetStopped?"PAUSED":"FAILED";await save();}
    return {status:code==="JOB_BUDGET_EXHAUSTED"?"PARTIAL_BUDGET":code,jobs:state?[publicJob()]:[]};
  }finally{await store.release(scope,token);}
}
