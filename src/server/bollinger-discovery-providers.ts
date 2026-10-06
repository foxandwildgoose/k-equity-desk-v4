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
const numeric = (v: unknown) => typeof v === "string" && /^\d[\d,]*(\.\d+)?$/.test(v) ? Number(v.replaceAll(",","")) : null;
const blankMember = {sector:"Unknown",sectorSource:null,indexWeight:null,weight:null,identityVerified:true} as const;
export async function fetchNasdaqListedDiscoveryUniverse() {
  const response=await fetch("https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&exchange=nasdaq",{headers:{"User-Agent":"Mozilla/5.0","Accept":"application/json","Origin":"https://www.nasdaq.com"},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error("NASDAQ_LISTING_FETCH_FAILED");
  return parseNasdaqListedUniverse(await response.json(),new Date().toISOString());
}
/** Current membership only. Pagination must reach the disclosed total; partial lists are rejected. */
export async function fetchKrDiscoveryUniverse(kind:"KOSPI"|"KOSDAQ"): Promise<UniverseSnapshot> {
  const members:SecurityMember[]=[];const seen=new Set<string>();let total:number|null=null;let asOf="";
  for(let page=1;page<=100;page++) {
    if(page>1) await new Promise(resolve=>setTimeout(resolve,500));
    const response=await fetch(`https://m.stock.naver.com/api/stocks/marketValue/${kind}?page=${page}&pageSize=100`,{headers:{"User-Agent":"Mozilla/5.0 KoreaEquityCommand/1.0"},signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error("KR_MEMBERSHIP_FETCH_FAILED");
    const data=await response.json() as {totalCount?:number;stocks?:{itemCode?:string;stockName?:string;stockEndType?:string;marketValue?:string;localTradedAt?:string}[]};
    if(!Number.isInteger(data.totalCount)||!Array.isArray(data.stocks))throw new Error("KR_MEMBERSHIP_SCHEMA_FAILED");
    total=data.totalCount!;
    let progressed=0;
    for(const row of data.stocks) {
      if(!row.itemCode||!row.stockName||seen.has(row.itemCode))continue;
      seen.add(row.itemCode);progressed++;
      const metadata=UNIVERSE.find(s=>s.code===row.itemCode),cap=numeric(row.marketValue);
      asOf=[asOf,row.localTradedAt?.slice(0,10)??""].sort().at(-1)!;
      members.push({...blankMember,market:"KR",symbol:row.itemCode,name:row.stockName,exchange:kind,sector:metadata?.sectorId??"Unknown",sectorSource:metadata ? "desk-curated-sector-taxonomy" : null,marketCap:cap===null?null:cap*1e8,
        // Supported common stocks; preferred shares are conservatively excluded by disclosed name.
        assetType:row.stockEndType==="stock"&&!/우$|우B$|우C$|우선|[123]우/.test(row.stockName.replaceAll(" ",""))?"equity":row.stockEndType==="etf"?"etf":"unknown"});
    }
    if(seen.size>=total)break;
    if(!progressed)throw new Error("KR_MEMBERSHIP_PARTIAL_OR_REPEATED_PAGE");
  }
  if(total===null||seen.size<total||!asOf)throw new Error("KR_MEMBERSHIP_INCOMPLETE");
  const now=new Date().toISOString();
  return validateUniverseSnapshot({id:`${kind}:${now}`,kind,label:kind,asOf,knownAt:now,fetchedAt:now,source:"Naver market-value listing; cap in KRW (억 × 10^8)",sourceUrl:`https://m.stock.naver.com/api/stocks/marketValue/${kind}`,authoritative:false,historical:false,members});
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
