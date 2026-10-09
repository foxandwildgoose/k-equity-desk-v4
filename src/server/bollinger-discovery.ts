import { getDiscoveryStore, type DiscoveryQuery, type DiscoveryStore, type StoredCandidate } from "./bollinger-discovery-store.ts";
import { DISCOVERY_DEFAULTS } from "../lib/bollinger/discovery.ts";
import type { DiscoveryChartContext } from "../lib/bollinger/discovery.ts";
import { selectUniverse, type TopChoice } from "../lib/bollinger/discovery-universe.ts";
import { readBollingerCloudConfig, cloudJobScope, safeCloudJob } from "./bollinger-cloud-config.ts";
import type { BollingerBar } from "../lib/bollinger/types.ts";
import type { SecurityMember } from "../lib/bollinger/discovery-universe.ts";
import { isDiscoveryDay } from "../lib/bollinger/discovery-dates.ts";

const safeStatus=(error:unknown)=>error instanceof Error&&["DATABASE_MISSING","MIGRATION_0005_REQUIRED","UNIVERSE_MISSING","MEMBER_MISSING","INVALID_AS_OF"].includes(error.message)?error.message:"DATABASE_QUERY_FAILED";
export type DiscoveryStockChartRequest={universeId:string;configVersion:string;market:"KR"|"US";symbol:string;asOf:string};
export type StoredDiscoveryStockChart={member:Pick<SecurityMember,"market"|"symbol"|"name"|"exchange"|"sector">;bars:BollingerBar[];source:string;priceBasis:string;fetchedAt:string|null;candidate:StoredCandidate|null;asOf:string;observation:{first:string|null;last:string|null;count:number};discovery:DiscoveryChartContext|null};
const storedPriceBases=new Set(["yahoo-us-adjusted-ohlcv","yahoo-kr-raw-ohlcv","naver-raw-ohlcv"]);
/** Bounded persisted reads for the selected stock. No provider refresh or operational writes. */
export async function readDiscoveryStockChart(store:DiscoveryStore,request:DiscoveryStockChartRequest,now=Date.now()):Promise<StoredDiscoveryStockChart|null> {
  const currentDay=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));
  if(!isDiscoveryDay(request.asOf)||request.asOf>currentDay)throw new Error("INVALID_AS_OF");
  const universe=await store.universe(request.universeId);if(!universe)throw new Error("UNIVERSE_MISSING");
  const member=universe.members.find(m=>m.market===request.market&&m.symbol===request.symbol&&m.identityVerified&&m.assetType==="equity");
  if(!member)throw new Error("MEMBER_MISSING");
  const candidate=await store.latestFeature(universe.id,member,request.configVersion,request.asOf);
  const metadata=await store.barMetadata(member,request.asOf);
  // A final feature fixes the basis. Missing prices in that basis must never fall back to another one.
  const meta=candidate?metadata.find(m=>m.price_basis===candidate.priceBasis):metadata.filter(m=>storedPriceBases.has(m.price_basis)).sort((a,b)=>b.day.localeCompare(a.day)||b.fetched_at.localeCompare(a.fetched_at))[0];
  const basis=candidate?.priceBasis??meta?.price_basis;if(!basis||!storedPriceBases.has(basis))return null;
  const bars=(await store.bars(member.market,member.symbol,basis,request.asOf)).filter(b=>b.completed===true&&isDiscoveryDay(b.date)&&b.date<=request.asOf);
  if(!bars.length)return null;
  const source=meta?.source??candidate?.source??basis;
  const history=candidate?(await store.featureHistory(universe.id,member,request.configVersion,request.asOf)).filter(f=>f.price_basis===basis&&f.payload.date<=request.asOf).map(f=>({date:f.payload.date,resistance:f.payload.trigger?.resistance??f.payload.resistance})):[];
  return {member:{market:member.market,symbol:member.symbol,name:member.name,exchange:member.exchange,sector:member.sector},bars,source,priceBasis:basis,fetchedAt:meta?.fetched_at??null,candidate,asOf:request.asOf,observation:{first:bars[0]?.date??null,last:bars.at(-1)?.date??null,count:bars.length},discovery:candidate?{candidate,market:member.market,symbol:member.symbol,source,priceBasis:basis,history}:null};
}
export async function discoveryStockChart(request:DiscoveryStockChartRequest):Promise<{status:string;data:StoredDiscoveryStockChart|null}> {
  try {const data=await readDiscoveryStockChart(await getDiscoveryStore(),request);return {status:data?"READY":"NO_HISTORY",data};}
  catch(error){return {status:safeStatus(error),data:null};}
}
export async function discoveryChartContext(universeId:string,version:string,market:"KR"|"US",symbol:string):Promise<{status:string;data:DiscoveryChartContext|null}> {
  try {
    const store=await getDiscoveryStore(),universe=await store.universe(universeId);
    const member=universe?.members.find(m=>m.market===market&&m.symbol===symbol);if(!member)return{status:"NO_HISTORY",data:null};
    const features=await store.featureHistory(universeId,member,version),latest=features.at(-1);if(!latest)return{status:"NO_HISTORY",data:null};
    const meta=(await store.barMetadata(member)).find(m=>m.price_basis===latest.price_basis);
    return {status:"READY",data:{candidate:latest.payload,market,symbol,source:meta?.source??latest.price_basis,priceBasis:latest.price_basis,history:features.filter(f=>f.price_basis===latest.price_basis).map(f=>({date:f.payload.date,resistance:f.payload.trigger?.resistance??f.payload.resistance}))}};
  }catch(error){return{status:safeStatus(error),data:null};}
}
/** Interactive requests are persisted reads only. No market-price or broker imports here. */
export async function discoveryCatalog() {
  const configuration=readBollingerCloudConfig(),cloud={...configuration,jobs:[] as ReturnType<typeof safeCloudJob>[]};
  try {
    const store=await getDiscoveryStore();
    const universes=await store.universes();
    cloud.jobs=await Promise.all(configuration.targets.map(async target=>{
      const summary=(await store.latestJob(cloudJobScope(target,configuration.top)))?.summary??null;
      const active=typeof summary?.runToken==="string"&&await store.leaseMatches("bollinger:daily-provider",summary.runToken);
      return safeCloudJob(summary,target,active);
    }));
    return {status:"READY",cloud,version:DISCOVERY_DEFAULTS.version,versions:await store.configurations(),universes:universes.map(u=>({id:u.id,kind:u.kind,label:u.label,asOf:u.asOf,knownAt:u.knownAt,fetchedAt:u.fetchedAt,source:u.source,sourceUrl:u.sourceUrl,historical:u.historical,rankAsOf:u.rankAsOf??null,members:u.members.length,sectors:[...new Set(u.members.map(m=>m.sector))].sort()}))};
  }catch(error){return {status:safeStatus(error),cloud,version:DISCOVERY_DEFAULTS.version,versions:[],universes:[]};}
}
export async function queryDiscovery(q:DiscoveryQuery) {
  try {
    const store=await getDiscoveryStore();
    return {status:"READY",...await store.query(q)};
  }catch(error){return {status:safeStatus(error),rows:[],inspection:{rows:[],total:0},total:0,counts:[],requestedCount:0};}
}
export async function discoveryDetails(universeId:string,version:string) {
  try {const store=await getDiscoveryStore();return {status:"READY",events:await store.events(universeId,version),jobs:await store.jobs(universeId),evidence:await store.evidence(universeId,version)};}
  catch(error){return {status:safeStatus(error),events:[],jobs:[],evidence:null};}
}
export async function previewDiscoveryUniverse(universeId:string,top:TopChoice,minWeight:number,sectors:string[],page:number) {
  try {
    const store=await getDiscoveryStore(),universe=await store.universe(universeId);if(!universe)throw new Error("UNIVERSE_MISSING");
    const result=selectUniverse(universe,{top,minWeight,sectors});
    return {status:"READY",asOf:universe.asOf,source:universe.source,rankingBasis:result.rankingBasis,total:result.selected.length,supportedCount:result.supportedCount,excludedCount:result.excludedCount,selectedWeight:result.selectedWeight,knownWeight:result.knownWeight,warnings:result.warnings,
      rows:result.selected.slice((page-1)*50,page*50).map(m=>({market:m.market,symbol:m.symbol,name:m.name,sector:m.sector,weight:m.weight,marketCap:m.marketCap,indexWeight:m.indexWeight})),excluded:[...result.excluded.map(m=>({name:m.name,reason:m.assetType==="equity"?"identity-unverified":m.assetType})),...(universe.excludedHoldings??[])].slice(0,50)};
  }catch(error){return {status:safeStatus(error),rows:[],total:0,excluded:[],warnings:[]};}
}
