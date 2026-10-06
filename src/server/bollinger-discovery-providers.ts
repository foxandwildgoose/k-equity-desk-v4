import { fetchOhlc } from "./naver-market";
import { fetchAllEtfs, fetchEtfHoldings } from "./etf-market";
import { UNIVERSE } from "../data/universe";
import { completedPriceBars } from "../lib/bollinger/bar-completion";
import { parseNasdaqListedUniverse, validateUniverseSnapshot, type SecurityMember, type UniverseSnapshot } from "../lib/bollinger/discovery-universe";
import type { BollingerBar } from "../lib/bollinger/types";

export const DAILY_PRICE_BASES = ["yahoo-kr-raw-ohlcv", "naver-raw-ohlcv", "yahoo-us-adjusted-ohlcv"] as const;
export async function fetchDiscoveryPrices(member: SecurityMember, initial: boolean) {
  const response = await fetchOhlc({ code:member.symbol,market:member.market === "US" ? "US" : member.exchange === "KOSDAQ" ? "KOSDAQ" : "KOSPI",interval:"day",range:initial ? "5y" : "6mo" });
  const basis = member.market === "US" ? "yahoo-us-adjusted-ohlcv" : response.source.startsWith("yahoo") ? "yahoo-kr-raw-ohlcv" : "naver-raw-ohlcv";
  const bars = completedPriceBars(response.bars,{market:member.market,interval:"day"}).filter(b=>b.completed).map(b=>({date:b.date,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume,volumeValid:b.volumeValid,completed:true} satisfies BollingerBar));
  return { bars,source:response.source,basis };
}
import { fetchKrMembershipBatch, type KrMembershipProgress } from "./bollinger-membership";
const blankMember = {sector:"Unknown",sectorSource:null,indexWeight:null,weight:null,identityVerified:true} as const;
export async function fetchNasdaqListedDiscoveryUniverse() {
  const response=await fetch("https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&exchange=nasdaq",{headers:{"User-Agent":"Mozilla/5.0","Accept":"application/json","Origin":"https://www.nasdaq.com"},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error("NASDAQ_LISTING_FETCH_FAILED");
  return parseNasdaqListedUniverse(await response.json(),new Date().toISOString());
}
/** Same pagination service for standalone and checkpointed cloud collectors. */
export function fetchKrDiscoveryUniverseBatch(kind:"KOSPI"|"KOSDAQ", previous:KrMembershipProgress|null, options:Parameters<typeof fetchKrMembershipBatch>[2]={}) {
  return fetchKrMembershipBatch(kind,previous,{...options,sector:symbol=>{
    const metadata=UNIVERSE.find(s=>s.code===symbol);
    return metadata?{sector:metadata.sectorId,source:"desk-curated-sector-taxonomy"}:null;
  }});
}
export async function fetchKrDiscoveryUniverse(kind:"KOSPI"|"KOSDAQ"): Promise<UniverseSnapshot> {
  const result=await fetchKrDiscoveryUniverseBatch(kind,null,{maxPages:100});
  if(!result.snapshot)throw new Error("KR_MEMBERSHIP_INCOMPLETE");
  return result.snapshot;
}
/** Issuer/verified existing holdings parser. No name-only fabricated overseas mapping. */
export async function fetchEtfDiscoveryUniverse(code:string):Promise<UniverseSnapshot> {
  if(!/^[0-9A-Z]{6}$/.test(code))throw new Error("INVALID_ETF_CODE");
  const [etfs,pack]=await Promise.all([fetchAllEtfs(),fetchEtfHoldings(code)]);
  const etf=etfs.find(e=>e.code===code);
  if(!etf||!pack.asOf||pack.sourceKind==="none")throw new Error("ETF_HOLDINGS_UNAVAILABLE");
  const members:SecurityMember[]=pack.holdings.flatMap(h=>{
    const kr=h.assetClass==="kr-equity"&&h.code&&/^[0-9A-Z]{6}$/.test(h.code)&&h.market;
    const us=h.assetClass==="us-equity"&&h.reutersCode&&/^[A-Z][A-Z0-9.]{0,9}(\.[ON])?$/.test(h.reutersCode);
    const symbol=kr?h.code!:us?h.reutersCode!.replace(/\.[ON]$/,""):h.code;
    // Unresolved rows stay in the metadata diagnostics, not the investible set.
    if(!symbol||!(kr?/^[0-9A-Z]{6}$/.test(symbol):/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)))return [];
    const meta=kr?UNIVERSE.find(m=>m.code===symbol):undefined;
    return [{...blankMember,market:kr?"KR":"US",symbol,name:h.nameKo,exchange:kr?h.market!:"OTHER",sector:meta?.sectorId??"Unknown",sectorSource:meta?"desk-curated-sector-taxonomy":null,marketCap:null,
      weight:h.weightSource==="official"?h.weight:null,identityVerified:!!(kr||us),assetType:kr||us?"equity":h.isCash?"cash":h.isBond?"bond":h.isFuture?"future":h.isKoreanEtf?"etf":"unknown"} as SecurityMember];
  });
  const now=new Date().toISOString();
  // Include unresolved non-security rows separately; they cannot be assigned invented tickers.
  const excludedHoldings=pack.holdings.filter(h=>!members.some(m=>m.name===h.nameKo)).map(h=>({name:h.nameKo,reason:`${h.assetClass}: security identity unavailable`,weight:h.weightSource==="official"?h.weight:null}));
  const snapshot=validateUniverseSnapshot({id:`ETF:${code}:${now}`,kind:"ETF",label:`${etf.nameKo} (${code})`,asOf:pack.asOf,knownAt:now,fetchedAt:now,source:`${pack.source}; unresolved rows ${excludedHoldings.length}`,sourceUrl:pack.issuerUrl,authoritative:pack.sourceKind==="issuer-pdf",historical:false,members,excludedHoldings});
  return snapshot;
}
