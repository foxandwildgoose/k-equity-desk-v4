import type { Candidate, Strategy } from "./discovery.ts";
import type { SecurityMember } from "./discovery-universe.ts";
import { isDiscoveryDay } from "./discovery-dates.ts";

export type DiscoveryInspectionAssessment = "MATCH" | "NO_COMPUTED_HISTORY" | "WARMUP" | "STALE" | "LOW_COVERAGE" | "STRATEGY_MISMATCH" | "LOW_SCORE";
export type DiscoveryInspectionRow = Pick<SecurityMember, "market" | "symbol" | "name" | "sector" | "exchange"> & {
  candidate: Candidate | null;
  source: string | null;
  priceBasis: string | null;
  computedAt: string | null;
  assessment: DiscoveryInspectionAssessment;
  reasons: string[];
  matched: boolean;
};
export type DiscoveryInspectionConditions = { strategy: Strategy; minScore: number; minCoverage: number; asOf: string };

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
  if (candidate.extended) return { label: "상승 후 확장", summary: "가격·RSI 또는 밴드 위치가 확장되어 사전 돌파 후보에서는 제외됩니다." };
  if (candidate.gates.bullish) return { label: "상승 추세 관찰", summary: "장기 상승 추세를 관측했지만 현재 전략의 압축·위치·모멘텀 조건 전체를 충족하지 않았습니다." };
  return { label: "중립·관찰", summary: "현재 완료 일봉은 선택 전략의 조건을 충족하지 않았습니다. 아래 지표와 제외 이유를 확인하세요." };
}

/** Mirrors the persisted screener's disjoint exclusion order without hiding a selected stock. */
export function inspectDiscoveryCandidate(candidate: Candidate | null, conditions: DiscoveryInspectionConditions): Pick<DiscoveryInspectionRow, "assessment" | "reasons" | "matched"> {
  if (!candidate) return { assessment: "NO_COMPUTED_HISTORY", reasons: ["조회 기준일 이전의 저장된 최종 계산이 없습니다. 가격 저장과 최종 계산은 별도입니다."], matched: false };
  if (!candidate.valid) return { assessment: "WARMUP", reasons: [...new Set(["워밍업 또는 기본 조건이 부족하여 후보 평가에서 제외했습니다.", ...candidate.warnings])], matched: false };
  const cutoff = isDiscoveryDay(conditions.asOf) ? new Date(`${conditions.asOf}T00:00:00Z`).getTime() - 4 * 86_400_000 : Number.NaN;
  const observed = isDiscoveryDay(candidate.date) ? new Date(`${candidate.date}T00:00:00Z`).getTime() : Number.NaN;
  if (!Number.isFinite(cutoff) || !Number.isFinite(observed) || observed < cutoff || candidate.date > conditions.asOf) return { assessment: "STALE", reasons: ["조회 기준일 대비 최근 4달력일 밖의 계산입니다. 휴장일을 임의로 확정하지 않습니다."], matched: false };
  if (candidate.score.coverage < conditions.minCoverage) return { assessment: "LOW_COVERAGE", reasons: [`자료 커버리지 ${(candidate.score.coverage * 100).toFixed(0)}%가 설정한 ${(conditions.minCoverage * 100).toFixed(0)}% 미만입니다.`, ...candidate.warnings], matched: false };
  if (!candidate.views.includes(conditions.strategy)) return { assessment: "STRATEGY_MISMATCH", reasons: [...new Set(["선택한 전략의 조건 전체를 충족하지 않았습니다.", ...candidate.reasons])], matched: false };
  if (candidate.score.value === null || !Number.isFinite(candidate.score.value) || candidate.score.value < conditions.minScore) return { assessment: "LOW_SCORE", reasons: [candidate.score.value === null ? "준비 점수를 계산할 자료가 없습니다." : `준비 점수 ${candidate.score.value}가 설정한 ${conditions.minScore} 미만입니다.`], matched: false };
  return { assessment: "MATCH", reasons: [...candidate.reasons], matched: true };
}
