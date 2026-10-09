import { DISCOVERY_DEFAULTS, discoveryConfigFromVersion, type Candidate, type Strategy } from "./discovery.ts";
import type { SecurityMember } from "./discovery-universe.ts";
import { isDiscoveryDay } from "./discovery-dates.ts";

export type DiscoveryInspectionAssessment = "MATCH" | "NO_COMPUTED_HISTORY" | "WARMUP" | "STALE" | "LOW_COVERAGE" | "DATA_UNAVAILABLE" | "STRATEGY_MISMATCH" | "LOW_SCORE";
export type DiscoveryInspectionRow = Pick<SecurityMember, "market" | "symbol" | "name" | "sector" | "exchange"> & {
  candidate: Candidate | null;
  source: string | null;
  priceBasis: string | null;
  computedAt: string | null;
  assessment: DiscoveryInspectionAssessment;
  reasons: string[];
  matched: boolean;
  dataStatus?: {priceCount:number;lastPriceDate:string|null;outdatedCalculation?:boolean;reason:"NO_PRICE_HISTORY"|"FINAL_COMPUTE_MISSING"|"CONFIGURATION_NOT_COMPUTED"|"FINAL_COMPUTE_OUTDATED"|null};
};
export type DiscoveryInspectionConditions = { strategy: Strategy; minScore: number; minCoverage: number; asOf: string; configVersion?:string };
const configOf=(version?:string)=>version?discoveryConfigFromVersion(version).config:DISCOVERY_DEFAULTS;
const numeric=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value);

/** The actual view predicates in analyzeDiscovery, not a shared Long-only explanation. */
export function discoveryStrategyDescription(strategy:Strategy,version?:string):string {
  const c=configOf(version);
  switch(strategy){
    case "long-pre-breakout":return `상승 추세·BBW 분위수 ${c.squeeze}% 이하·저항 거리 0~${c.distanceMax}%·%B ${c.percentBMin}~${c.percentBMax}·상승 RSI ${c.rsiMin}~${c.rsiMax}·건조 RVOL ${c.dryMax}배 이하·준비 점수 ${c.armedScore} 이상을 충족한 ARMED 상태입니다.${c.requireMarket?" 시장도 SMA200 위이고 기울기가 0 이상이어야 합니다.":""}${c.requireSector?" 섹터 상대 환경 점수도 3.75 이상이어야 합니다.":""}`;
    case "squeeze-watch":return `BBW 분위수가 ${c.squeeze}% 이하인 변동성 압축 종목입니다. 상승 추세·RSI·저항 거리 조건은 이 보기의 필수 조건이 아닙니다.`;
    case "triggered":return `이전 WATCH/ARMED 상태에서 저항을 상향 돌파하고 RVOL ${c.triggerRvol}배 이상을 충족한 완료 일봉입니다.`;
    case "follow-through":return "확인된 돌파 뒤 1~10개 완료 일봉 동안 종가가 당시 고정 저항 위에 유지된 상태입니다.";
    case "failed-breakout":return `확인된 돌파 뒤 ${c.failedWindow}개 완료 일봉 안에 종가가 고정 저항 아래로 되밀린 상태이며, 이력의 실패 상태도 포함합니다.`;
    case "pullback":return "종가가 SMA200 위에 있고 %B가 0.2 이상 0.5 미만인 상승 추세 조정 구간입니다.";
    case "mean-reversion-watch":return "공유 추세 분류가 중립이며 %B가 0 미만 또는 1 초과인 밴드 바깥 관찰 대상입니다.";
    case "bear-breakdown":return "공유 추세 분류가 하락·강한 하락이거나 완료 일봉에서 하단 밴드를 새로 이탈한 종목입니다.";
  }
}

/** Fixed JSON paths shared with DB counts so an unknown input is never a known strategy rejection. */
export function discoveryStrategyRequiredInputs(strategy:Strategy,version?:string):{numeric:string[];text:string[]} {
  const c=configOf(version);
  switch(strategy){
    case "long-pre-breakout":return {numeric:["bbwPercentile","distance","percentB","rsi","rsiSlope","dryRvol","sma200Slope","score.components.trend.inputs.sma200",...(c.requireMarket?["score.components.market.score"]:[]),...(c.requireSector?["score.components.sector.score"]:[])],text:[]};
    case "squeeze-watch":return {numeric:["bbwPercentile"],text:[]};
    case "triggered":return {numeric:["rvol","resistance","sma200Slope","score.components.trend.inputs.sma200"],text:[]};
    case "pullback":return {numeric:["percentB","score.components.trend.inputs.sma200"],text:[]};
    case "mean-reversion-watch":return {numeric:["percentB"],text:["trend"]};
    case "bear-breakdown":return {numeric:[],text:["trend"]};
    case "follow-through":case "failed-breakout":return {numeric:[],text:[]};
  }
}
const inputLabels:Record<string,string>={bbwPercentile:"BBW 분위수",distance:"저항 거리",percentB:"%B",rsi:"RSI",rsiSlope:"RSI 기울기",dryRvol:"건조 RVOL",sma200Slope:"SMA200 기울기",rvol:"RVOL",resistance:"저항 가격",trend:"추세 분류","score.components.trend.inputs.sma200":"SMA200","score.components.market.score":"필수 시장 환경","score.components.sector.score":"필수 섹터 환경"};
function pathValue(candidate:Candidate,path:string):unknown {
  let value:unknown=candidate;
  for(const key of path.split(".")){if(!value||typeof value!=="object")return undefined;value=(value as Record<string,unknown>)[key];}
  return value;
}
export function discoveryStrategyReasons(candidate:Candidate,strategy:Strategy,version?:string):{reasons:string[];missing:string[]} {
  // Persisted views are authoritative. A legacy optional field cannot negate a recorded match.
  if(candidate.views.includes(strategy))return {reasons:[discoveryStrategyDescription(strategy,version)],missing:[]};
  const required=discoveryStrategyRequiredInputs(strategy,version),missing=[...required.numeric.filter(path=>!numeric(pathValue(candidate,path))),...required.text.filter(path=>typeof pathValue(candidate,path)!=="string")].map(path=>inputLabels[path]??path);
  if(missing.length)return {reasons:[`전략 평가에 필요한 ${missing.join("·")} 자료가 없습니다. 조건 불일치로 확정하지 않습니다.`],missing};
  const c=configOf(version),reasons:string[]=[];
  switch(strategy){
    case "long-pre-breakout":
      if(!candidate.gates.bullish)reasons.push("SMA200 위·기울기 기준의 상승 추세를 충족하지 않았습니다.");
      if(candidate.bbwPercentile!>c.squeeze)reasons.push(`BBW 분위수 ${candidate.bbwPercentile!.toFixed(1)}%가 압축 기준 ${c.squeeze}%를 넘습니다.`);
      if(candidate.distance!<0||candidate.distance!>c.distanceMax)reasons.push(`저항 거리 ${candidate.distance!.toFixed(1)}%가 돌파 전 범위 0~${c.distanceMax}% 밖입니다.`);
      if(candidate.percentB!<c.percentBMin||candidate.percentB!>c.percentBMax)reasons.push(`%B ${candidate.percentB!.toFixed(2)}가 준비 범위 ${c.percentBMin}~${c.percentBMax} 밖입니다.`);
      if(candidate.rsi!<c.rsiMin||candidate.rsi!>c.rsiMax||candidate.rsiSlope!<=0)reasons.push(`RSI ${candidate.rsi!.toFixed(1)}·기울기가 상승 모멘텀 기준을 충족하지 않았습니다.`);
      if(candidate.dryRvol!>c.dryMax)reasons.push(`건조 RVOL ${candidate.dryRvol!.toFixed(2)}배가 ${c.dryMax}배를 넘습니다.`);
      if(candidate.extended)reasons.push("이미 확장된 가격 구간으로 사전 돌파 대상에서 제외됩니다.");
      if(candidate.score.coverage<c.minCoverage)reasons.push(`ARMED에 필요한 자료 커버리지 ${c.minCoverage*100}%에 못 미칩니다.`);
      if(candidate.score.value===null||candidate.score.value<c.armedScore)reasons.push(`ARMED 준비 점수 기준 ${c.armedScore} 이상을 충족하지 않았습니다.`);
      if(c.requireMarket&&candidate.score.components.market?.score===0)reasons.push("필수 시장 환경의 상승 기준을 충족하지 않았습니다.");
      if(c.requireSector&&candidate.score.components.sector!.score!<3.75)reasons.push("필수 섹터 환경 점수가 3.75 미만입니다.");
      if(!reasons.length)reasons.push(`저장 상태는 ${candidate.state}이며, 이번 완료 일봉의 ARMED 상태가 아닙니다.`);
      break;
    case "squeeze-watch":reasons.push(candidate.bbwPercentile!>c.squeeze?`BBW 분위수 ${candidate.bbwPercentile!.toFixed(1)}%가 변동성 압축 기준 ${c.squeeze}%를 넘습니다.`:"BBW 값은 압축 범위에 있지만 저장된 전략 판정에 압축 관찰 상태가 기록되지 않았습니다.");break;
    case "triggered":
      if(candidate.rvol!<c.triggerRvol)reasons.push(`RVOL ${candidate.rvol!.toFixed(2)}배가 돌파 거래량 기준 ${c.triggerRvol}배 미만입니다.`);
      reasons.push("이번 완료 일봉은 이전 WATCH/ARMED 저항 돌파가 확인된 TRIGGERED 상태가 아닙니다.");break;
    case "follow-through":reasons.push(candidate.trigger?`저장 상태 ${candidate.state}는 돌파 후 1~10봉 저항 위 유지 상태가 아닙니다.`:"최근 이력에 거래량까지 확인된 유효 돌파 기준이 없습니다. 돌파 후 유지 상태로 분류하지 않습니다.");break;
    case "failed-breakout":reasons.push(candidate.trigger?`저장 상태 ${candidate.state}에서 돌파 후 ${c.failedWindow}봉 안의 실패 상태를 확인하지 않았습니다.`:"확인된 유효 돌파 이후의 되밀림 상태가 기록되지 않았습니다.");break;
    case "pullback":
      if(candidate.close<=Number(pathValue(candidate,"score.components.trend.inputs.sma200")))reasons.push("종가가 SMA200 위에 있지 않습니다.");
      if(candidate.percentB!<.2||candidate.percentB!>=.5)reasons.push(`%B ${candidate.percentB!.toFixed(2)}가 조정 범위 0.2 이상 0.5 미만에 해당하지 않습니다.`);break;
    case "mean-reversion-watch":
      if(candidate.trend!=="neutral")reasons.push("추세 분류가 중립이 아닙니다.");
      if(candidate.percentB!>=0&&candidate.percentB!<=1)reasons.push(`%B ${candidate.percentB!.toFixed(2)}가 밴드 밖 범위(0 미만 또는 1 초과)에 있지 않습니다.`);break;
    case "bear-breakdown":reasons.push("공유 추세 분류의 하락·강한 하락 또는 신규 하단 이탈 상태가 기록되지 않았습니다.");break;
  }
  if(!reasons.length)reasons.push("현재 저장된 전략 판정에 해당 상태가 기록되지 않았습니다.");
  return {reasons,missing:[]};
}

/** Describes stored observations, never a trade recommendation or a return probability. */
export function discoverySituation(candidate: Candidate | null): { label: string; summary: string } {
  if (!candidate) return { label: "분석 자료 미확보", summary: "저장 가격 또는 최종 계산이 아직 없습니다. 없는 값을 0으로 판단하지 않습니다." };
  if (!candidate.valid) return { label: "분석 준비 중", summary: "완료 일봉·거래량·SMA200·밴드 폭 이력 또는 기본 조건이 부족합니다." };
  if (candidate.state === "ARMED") return { label: "돌파 준비", summary: "상승 추세에서 밴드가 좁아지고 저항 아래 준비 조건을 충족했습니다. 돌파 확정은 아닙니다." };
  if (candidate.state === "TRIGGERED") return { label: "거래량 동반 돌파", summary: "저장된 완료 일봉에서 저항 돌파와 거래량 기준을 함께 확인했습니다." };
  if (candidate.state === "FOLLOW_THROUGH") return { label: "돌파 후 유지", summary: "이전 돌파 뒤 종가가 기준 저항 위에 있습니다. 이후 유지 여부는 추가 관측이 필요합니다." };
  if (candidate.state === "FAILED") return { label: "돌파 후 되밀림", summary: "돌파 이후 기준 저항 아래로 되밀린 완료 일봉을 확인했습니다." };
  if (candidate.state === "WATCH" || candidate.views.includes("squeeze-watch")) return { label: candidate.gates.bullish ? "상승 추세 압축" : "변동성 압축", summary: "밴드 폭이 줄어든 관찰 대상입니다. 상승 돌파 준비 조건 전체를 충족했다는 뜻은 아닙니다." };
  if (candidate.views.includes("bear-breakdown")) return { label: "하락 추세 주의", summary: "하락 추세 또는 하단 이탈 조건을 관측했습니다. 반등이나 추가 하락을 확정하지 않습니다." };
  if (candidate.views.includes("pullback")) return { label: "상승 추세 조정", summary: "SMA200 위에서 밴드의 중·하단 쪽으로 조정한 상태입니다." };
  if (candidate.views.includes("mean-reversion-watch")) return {label:"밴드 밖 관찰",summary:"중립 추세에서 가격이 볼린저 밴드 밖에 있습니다. 평균으로의 복귀를 확정하는 신호는 아닙니다."};
  if (candidate.extended) return { label: "상승 후 확장", summary: "가격·RSI 또는 밴드 위치가 확장되어 사전 돌파 후보에서는 제외됩니다." };
  if (candidate.gates.bullish) return { label: "상승 추세 관찰", summary: "장기 상승 추세를 관측했습니다. 밴드 폭·저항 거리·모멘텀 조건은 전략별로 별도 확인합니다." };
  return { label: "중립·관찰", summary: "완료 일봉의 추세·밴드 위치가 아래 지표에 반영되어 있습니다. 전략별 일치 여부와 평가 이유를 함께 확인하세요." };
}

/** Mirrors the persisted screener's disjoint exclusion order without hiding a selected stock. */
export function inspectDiscoveryCandidate(candidate: Candidate | null, conditions: DiscoveryInspectionConditions): Pick<DiscoveryInspectionRow, "assessment" | "reasons" | "matched"> {
  if (!candidate) return { assessment: "NO_COMPUTED_HISTORY", reasons: ["조회 기준일 이전의 저장된 최종 계산이 없습니다. 가격 저장과 최종 계산은 별도입니다."], matched: false };
  if (!candidate.valid) return { assessment: "WARMUP", reasons: [...new Set(["워밍업 또는 기본 조건이 부족하여 후보 평가에서 제외했습니다.", ...candidate.warnings])], matched: false };
  const cutoff = isDiscoveryDay(conditions.asOf) ? new Date(`${conditions.asOf}T00:00:00Z`).getTime() - 4 * 86_400_000 : Number.NaN;
  const observed = isDiscoveryDay(candidate.date) ? new Date(`${candidate.date}T00:00:00Z`).getTime() : Number.NaN;
  if (!Number.isFinite(cutoff) || !Number.isFinite(observed) || observed < cutoff || candidate.date > conditions.asOf) return { assessment: "STALE", reasons: ["조회 기준일 대비 최근 4달력일 밖의 계산입니다. 휴장일을 임의로 확정하지 않습니다."], matched: false };
  if (candidate.score.coverage < conditions.minCoverage) return { assessment: "LOW_COVERAGE", reasons: [`자료 커버리지 ${(candidate.score.coverage * 100).toFixed(0)}%가 설정한 ${(conditions.minCoverage * 100).toFixed(0)}% 미만입니다.`, ...candidate.warnings], matched: false };
  if (!numeric(candidate.score.value))return {assessment:"DATA_UNAVAILABLE",reasons:["준비 점수를 계산할 자료가 없습니다. 점수 미달로 판단하지 않습니다."],matched:false};
  const strategy=discoveryStrategyReasons(candidate,conditions.strategy,conditions.configVersion);
  if(strategy.missing.length)return {assessment:"DATA_UNAVAILABLE",reasons:strategy.reasons,matched:false};
  if (!candidate.views.includes(conditions.strategy)) return { assessment: "STRATEGY_MISMATCH", reasons: strategy.reasons, matched: false };
  if (candidate.score.value < conditions.minScore) return { assessment: "LOW_SCORE", reasons: [`준비 점수 ${candidate.score.value}가 설정한 ${conditions.minScore} 미만입니다.`], matched: false };
  return { assessment: "MATCH", reasons: strategy.reasons, matched: true };
}
