import { median, type Candidate } from "./discovery.ts";
import { securityKey, universeAt, type UniverseSnapshot } from "./discovery-universe.ts";
import type { BollingerBar } from "./types.ts";
import { discoveryDailyBars, isDiscoveryDay, membershipKnowledgeCutoff } from "./discovery-dates.ts";

export const EVENT_HORIZONS = [5, 10, 20, 60] as const;
export type StudyInput = { market: "KR" | "US"; symbol: string; bars: BollingerBar[]; candidates: Candidate[]; benchmarkBars?: BollingerBar[]; sectorBars?: BollingerBar[]; priceBasis: string };
/** Select features computed with that date's known membership/sector/cap snapshot,
 * rather than relabeling today's precompute as historical evidence. */
export function studyFeatureHistory(histories:{snapshot:UniverseSnapshot;features:{payload:Candidate;price_basis:string}[]}[],market:"KR"|"US",allowCurrentResearch:boolean) {
  const sorted=[...histories].sort((a,b)=>Date.parse(b.snapshot.knownAt)-Date.parse(a.snapshot.knownAt));
  const selected=new Map<string,{payload:Candidate;price_basis:string}>();
  for(const {snapshot,features} of sorted)for(const row of features){
    if(!isDiscoveryDay(row.payload.date))throw new Error("INVALID_DAILY_DATE");
    if(!allowCurrentResearch&&(!snapshot.historical||snapshot.asOf>row.payload.date||Date.parse(snapshot.knownAt)>Date.parse(membershipKnowledgeCutoff(row.payload.date,market))))continue;
    if(!selected.has(row.payload.date))selected.set(row.payload.date,row);
  }
  return [...selected.values()].sort((a,b)=>a.payload.date.localeCompare(b.payload.date)); // ked-allow-string-date-sort: single-format time series
}
export type StudyOptions = { start: string; end: string; developmentEnd: string; validationEnd: string; minimumSamples: number; allowCurrentResearch: boolean; commissionBps: number; slippageBps: number; configVersion: string };
export type StudyObservation = {
  key: string; signal: "ARMED" | "TRIGGERED"; date: string; entryDate: string; horizon: number; score: number | null; bucket: string; split: string;
  returnPct: number; netReturnPct: number; mfe: number; mae: number; benchmarkReturn: number | null; sectorReturn: number | null;
  universeReturn: number | null; failed: boolean | null; triggeredWithinHorizon: boolean;
  followThrough: Record<string, boolean | null>; hits: Record<string, "target-first" | "stop-first" | "ambiguous" | "neither">; biased: boolean;
};
/** Intrabar OHLC does not establish whether the high or low happened first. */
export function hitOrder(bars: readonly BollingerBar[], entry: number, targetPct: number, stopPct: number): StudyObservation["hits"][string] {
  for (const b of bars) {
    const target = b.high >= entry * (1 + targetPct / 100), stop = b.low <= entry * (1 - stopPct / 100);
    if (target && stop) return "ambiguous";
    if (target) return "target-first";
    if (stop) return "stop-first";
  }
  return "neither";
}
export function scoreBucket(value: number | null) {
  return value === null ? "unavailable" : value < 60 ? "0–59" : value < 70 ? "60–69" : value < 80 ? "70–79" : value < 90 ? "80–89" : "90–100";
}
function comparisonReturn(bars: BollingerBar[] | undefined, entryDate: string, exitDate: string): number | null {
  const entry = bars?.find(b => b.date === entryDate && b.completed === true), exit = bars?.find(b => b.date === exitDate && b.completed === true);
  return entry && exit && entry.open > 0 ? (exit.close / entry.open - 1) * 100 : null;
}
export function eventStudy(inputs: StudyInput[], universes: UniverseSnapshot[], options: StudyOptions) {
  if (![options.start,options.end,options.developmentEnd,options.validationEnd].every(isDiscoveryDay) || !(options.start <= options.developmentEnd && options.developmentEnd < options.validationEnd && options.validationEnd < options.end) || ![options.minimumSamples,options.commissionBps,options.slippageBps].every(Number.isFinite) || options.minimumSamples < 1 || options.commissionBps < 0 || options.slippageBps < 0) throw new Error("INVALID_STUDY_OPTIONS");
  const observations: StudyObservation[] = [];
  const priceMaps = new Map(inputs.map(i => [`${i.market}:${i.symbol}`,new Map(discoveryDailyBars(i.bars).map(b=>[b.date,b]))]));
  let excludedMembership = 0, censored = 0, missingEntry = 0;
  for (const input of inputs) {
    if (!["raw-ohlcv-unverified-actions","yahoo-kr-raw-ohlcv","naver-raw-ohlcv","yahoo-us-adjusted-ohlcv"].includes(input.priceBasis)) throw new Error("UNSUPPORTED_STUDY_PRICE_BASIS");
    const bars = discoveryDailyBars(input.bars);
    const index = new Map(bars.map((b,i) => [b.date,i]));
    let priorState = "";
    for (const candidate of input.candidates) {
      const entered = candidate.state === "ARMED" && priorState !== "ARMED" || candidate.state === "TRIGGERED";
      priorState = candidate.state;
      if (!entered || candidate.date < options.start || candidate.date > options.end || !candidate.valid) continue;
      const membership = universeAt(universes,candidate.date,membershipKnowledgeCutoff(candidate.date,input.market),options.allowCurrentResearch);
      if (!membership.snapshot?.members.some(m => securityKey(m) === `${input.market}:${input.symbol}` && m.assetType === "equity" && m.identityVerified)) { excludedMembership++; continue; }
      const signalIndex = index.get(candidate.date), entry = signalIndex === undefined ? undefined : bars[signalIndex+1];
      if (!entry || !(entry.open > 0)) { missingEntry++; continue; }
      for (const horizon of EVENT_HORIZONS) {
        const forward = bars.slice(signalIndex!+1,signalIndex!+1+horizon), exit = forward.at(-1);
        if (forward.length < horizon || !exit || exit.date > options.end) { censored++; continue; }
        const split = candidate.date<=options.developmentEnd ? "development" : candidate.date<=options.validationEnd ? "validation" : "out-of-sample";
        const splitEnd = split === "development" ? options.developmentEnd : split === "validation" ? options.validationEnd : options.end;
        if (exit.date > splitEnd) { censored++; continue; } // Embargo outcomes that cross a research split.
        const returnPct = (exit.close / entry.open - 1) * 100;
        const hits: StudyObservation["hits"] = {};
        for (const target of [3,5,10]) for (const stop of [3,5]) hits[`+${target}/-${stop}`] = hitOrder(forward,entry.open,target,stop);
        const resistance = candidate.trigger?.resistance ?? candidate.resistance;
        const followThrough: Record<string,boolean|null> = {};
        for (const n of [1,3,5,10]) followThrough[n] = candidate.state !== "TRIGGERED" || resistance === null || forward.length < n ? null : forward[n-1]!.close >= resistance;
        const selfMember = membership.snapshot.members.find(m=>securityKey(m)===`${input.market}:${input.symbol}`);
        const peerReturns = membership.snapshot.members.filter(m=>m.market===input.market&&m.assetType==="equity"&&m.identityVerified).flatMap(m=>{
          const prices=priceMaps.get(securityKey(m)),a=prices?.get(entry.date),z=prices?.get(exit.date);
          return a&&z&&a.open>0?[{value:(z.close/a.open-1)*100,sector:m.sector}]:[];
        });
        const sectorPeers=selfMember?.sector==="Unknown"?[]:peerReturns.filter(p=>p.sector===selfMember?.sector).map(p=>p.value);
        observations.push({ key:`${input.market}:${input.symbol}:${candidate.date}:${candidate.state}:${horizon}`,signal:candidate.state as "ARMED"|"TRIGGERED",date:candidate.date,entryDate:entry.date,horizon,score:candidate.score.value,bucket:scoreBucket(candidate.score.value),
          split,
          returnPct,netReturnPct:returnPct - 2*(options.commissionBps+options.slippageBps)/100,
          mfe:(Math.max(...forward.map(b=>b.high))/entry.open-1)*100,mae:(Math.min(...forward.map(b=>b.low))/entry.open-1)*100,
          benchmarkReturn:comparisonReturn(input.benchmarkBars,entry.date,exit.date),sectorReturn:comparisonReturn(input.sectorBars,entry.date,exit.date)??(sectorPeers.length>=3?median(sectorPeers):null),
          universeReturn:peerReturns.length>=3?peerReturns.reduce((n,p)=>n+p.value,0)/peerReturns.length:null,
          failed:candidate.state === "TRIGGERED" && resistance !== null ? forward.slice(0,3).some(b=>b.close<resistance) : null,
          triggeredWithinHorizon:input.candidates.some(c=>c.date>candidate.date&&c.date<=exit.date&&c.state==="TRIGGERED"),followThrough,hits,biased:membership.biased });
      }
    }
  }
  const mean = (values:number[]) => values.length ? values.reduce((n,x)=>n+x,0)/values.length : null;
  const summarize = (rows:StudyObservation[]) => {
    const reliable = rows.length>=options.minimumSamples;
    const stats = { samples:rows.length,reliable,mean:mean(rows.map(r=>r.returnPct)),median:median(rows.map(r=>r.returnPct)),winRate:rows.length ? rows.filter(r=>r.returnPct>0).length/rows.length : null,
      mfe:mean(rows.map(r=>r.mfe)),mae:mean(rows.map(r=>r.mae)),medianMfe:median(rows.map(r=>r.mfe)),medianMae:median(rows.map(r=>r.mae)),failedRate:rows.some(r=>r.failed!==null) ? rows.filter(r=>r.failed===true).length/rows.filter(r=>r.failed!==null).length : null,failedSamples:rows.filter(r=>r.failed!==null).length,
      triggeredRate:rows.length?rows.filter(r=>r.triggeredWithinHorizon).length/rows.length:null,
      benchmarkExcess:mean(rows.filter(r=>r.benchmarkReturn!==null).map(r=>r.returnPct-r.benchmarkReturn!)),benchmarkSamples:rows.filter(r=>r.benchmarkReturn!==null).length,
      sectorExcess:mean(rows.filter(r=>r.sectorReturn!==null).map(r=>r.returnPct-r.sectorReturn!)),sectorSamples:rows.filter(r=>r.sectorReturn!==null).length,
      universeExcess:mean(rows.filter(r=>r.universeReturn!==null).map(r=>r.returnPct-r.universeReturn!)),universeSamples:rows.filter(r=>r.universeReturn!==null).length,
      netReturnMean:mean(rows.map(r=>r.netReturnPct)),followThrough:Object.fromEntries([1,3,5,10].map(n=>{const valid=rows.filter(r=>r.followThrough[n]!==null);return [n,{samples:valid.length,rate:valid.length ? valid.filter(r=>r.followThrough[n]).length/valid.length:null}];})),
      hits:Object.fromEntries([3,5,10].flatMap(t=>[3,5].map(s=>{const k=`+${t}/-${s}`;return [k,Object.fromEntries(["target-first","stop-first","ambiguous","neither"].map(v=>[v,rows.filter(r=>r.hits[k]===v).length]))];}))) };
    return stats;
  };
  const groups = [];
  for (const signal of ["ARMED","TRIGGERED"]) for (const horizon of EVENT_HORIZONS) for (const split of ["all","development","validation","out-of-sample"]) for (const bucket of ["all","0–59","60–69","70–79","80–89","90–100"]) {
    const rows=observations.filter(r=>r.signal===signal && r.horizon===horizon && (split==="all"||r.split===split) && (bucket==="all"||r.bucket===bucket));
    groups.push({signal,horizon,split,bucket,...summarize(rows)});
  }
  return { version:options.configVersion,options,generatedAt:new Date().toISOString(),researchOnly:true,survivorshipBiased:observations.some(r=>r.biased)||options.allowCurrentResearch,
    biasFlags:{membership:observations.some(r=>r.biased)||options.allowCurrentResearch,corporateActionVintageUnverified:true,priceRevisionVintageUnverified:true},
    membershipExcluded:excludedMembership,censored,missingEntry,observations,groups,
    priceBases:[...new Set(inputs.map(i=>i.priceBasis))], warnings:["Event study, not a portfolio trading simulation; overlapping signals are not independent.","KR raw / US provider-adjusted OHLCV are kept separate. Corporate-action vintage and volume adjustments are unverified; split/dividend dates may distort returns.","Next session open entry; costs are an optional two-sided bps approximation, not execution evidence.","Sector total-return benchmark and contemporaneous universe-average baseline may be unavailable.",options.allowCurrentResearch ? "SURVIVORSHIP-BIASED / RESEARCH ONLY: current membership explicitly allowed." : "Only membership known by signal date is accepted.","Below minimumSamples, descriptive observations are not reliable profitability evidence."] };
}
