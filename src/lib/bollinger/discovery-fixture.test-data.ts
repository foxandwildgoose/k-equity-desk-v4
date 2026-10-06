/** Synthetic data for tests/isolated QA only; never imported by application code. */
import type { BollingerBar } from "./types.ts";
import type { DailyContext } from "./discovery.ts";
import type { SecurityMember, UniverseSnapshot } from "./discovery-universe.ts";
export function discoveryBars(count=360,direction=1):BollingerBar[] {
  return Array.from({length:count},(_,i)=>{
    const date=new Date(Date.UTC(2024,0,1+i)).toISOString().slice(0,10);
    const close=100+direction*(i<300?i*.12+Math.sin(i/3)*2:36+Math.sin(i/3)*.15+(i-300)*.004);
    const open=close+.04;
    return {date,open,high:open+.15,low:close-.15,close,volume:i>=300?400:1000+Math.sin(i)*100,volumeValid:true,completed:true};
  });
}
export function discoveryContexts(bars:BollingerBar[]):Record<string,DailyContext> {
  return Object.fromEntries(bars.map(b=>[b.date,{market:{asOf:b.date,source:"QA SYNTHETIC BENCHMARK",return20:1,return63:2,aboveSma200:true,slope200:.01},sector:{asOf:b.date,source:"QA SYNTHETIC SECTOR",return20:2,return63:3,aboveSma200:true,slope200:.02},rsPercentile:90}]));
}
export function member(symbol="005930"):SecurityMember { return {market:"KR",symbol,name:`QA SYNTHETIC ${symbol}`,exchange:"KOSPI",sector:"Technology",sectorSource:"QA SYNTHETIC",marketCap:1e12,indexWeight:null,weight:null,assetType:"equity",identityVerified:true}; }
export function universe(members=[member()]):UniverseSnapshot { return {id:"QA-SYNTHETIC-KOSPI",kind:"KOSPI",label:"QA SYNTHETIC / NOT MARKET DATA",asOf:"2024-01-01",knownAt:"2024-01-01T00:00:00Z",fetchedAt:"2024-01-01T00:00:00Z",source:"QA SYNTHETIC",sourceUrl:null,authoritative:false,historical:true,members}; }
