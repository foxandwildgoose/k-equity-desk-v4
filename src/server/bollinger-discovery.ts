import { getDiscoveryStore, type DiscoveryQuery } from "./bollinger-discovery-store.ts";
import { DISCOVERY_DEFAULTS } from "../lib/bollinger/discovery.ts";
import type { DiscoveryChartContext } from "../lib/bollinger/discovery.ts";
import { selectUniverse, type TopChoice } from "../lib/bollinger/discovery-universe.ts";
import { readBollingerCloudConfig, cloudJobScope, safeCloudJob } from "./bollinger-cloud-config.ts";

const safeStatus=(error:unknown)=>error instanceof Error&&["DATABASE_MISSING","MIGRATION_0005_REQUIRED","UNIVERSE_MISSING"].includes(error.message)?error.message:"DATABASE_QUERY_FAILED";
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
    cloud.jobs=await Promise.all(configuration.targets.map(async target=>safeCloudJob((await store.latestJob(cloudJobScope(target,configuration.top)))?.summary??null,target)));
    return {status:"READY",cloud,version:DISCOVERY_DEFAULTS.version,versions:await store.configurations(),universes:universes.map(u=>({id:u.id,kind:u.kind,label:u.label,asOf:u.asOf,knownAt:u.knownAt,fetchedAt:u.fetchedAt,source:u.source,sourceUrl:u.sourceUrl,historical:u.historical,rankAsOf:u.rankAsOf??null,members:u.members.length,sectors:[...new Set(u.members.map(m=>m.sector))].sort()}))};
  }catch(error){return {status:safeStatus(error),cloud,version:DISCOVERY_DEFAULTS.version,versions:[],universes:[]};}
}
export async function queryDiscovery(q:DiscoveryQuery) {
  try {
    const store=await getDiscoveryStore();
    return {status:"READY",...await store.query(q)};
  }catch(error){return {status:safeStatus(error),rows:[],total:0,counts:[],requestedCount:0};}
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
