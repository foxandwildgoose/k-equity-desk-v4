import type { Strategy } from "./discovery.ts";
import type { TopChoice } from "./discovery-universe.ts";

export type DiscoverySearchDraft = {
  universeId: string;
  configVersion: string;
  strategy: Strategy;
  selection: { top: TopChoice; minWeight: number; sectors: string[] };
  symbols?: string[];
  minScore: number;
  minCoverage: number;
  sort: "score" | "distance" | "rs";
  asOf: string;
};
export type AppliedDiscoverySearch = DiscoverySearchDraft & { asOf: string };

/** Draft edits never mutate the request/results that the user already executed. */
export function applyDiscoverySearch(draft: DiscoverySearchDraft, asOf: string): AppliedDiscoverySearch {
  return { ...draft, asOf, selection: { ...draft.selection, sectors: [...draft.selection.sectors] },
    symbols: draft.symbols === undefined ? undefined : [...new Set(draft.symbols)] };
}
export function discoverySearchSignature(request: DiscoverySearchDraft): string {
  return JSON.stringify([request.universeId, request.configVersion, request.strategy, request.selection.top,
    request.selection.minWeight, [...request.selection.sectors].sort(),
    request.symbols === undefined ? null : [...new Set(request.symbols)].sort(),
    request.minScore, request.minCoverage, request.sort, request.asOf]);
}
export const DISCOVERY_EXECUTION_LABELS: Record<string, string> = {
  RUNNING: "실행 중", PAUSED: "시간 예산 종료 · 이어받기 대기", INTERRUPTED: "이전 실행 중단 · 이어받기 필요",
  COMPLETE: "실행 완료", FAILED: "실행 실패 · 재시도 필요", NOT_STARTED: "실행 전",
};
export const DISCOVERY_PHASE_LABELS: Record<string, string> = {
  "not-started": "최초 수집", membership: "편입 목록 수집", benchmarks: "시장 지표 수집", collect: "가격 수집·계산",
  refresh: "상대 강도 최종 계산", complete: "선택 범위 계산", "complete-with-errors": "선택 범위 일부 실패",
};
export function discoveryResultState(input: {
  applied: boolean; fetching: boolean; failed: boolean; status?: string; selected?: number;
  stored?: number; missingStored?: number; matched?: number;
}): "not-started" | "running" | "failed" | "empty-selection" | "no-history" | "partial" | "no-matches" | "complete" {
  if (!input.applied) return "not-started";
  if (input.fetching) return "running";
  if (input.failed || (input.status !== undefined && input.status !== "READY")) return "failed";
  if (input.selected === 0) return "empty-selection";
  if (input.stored === 0) return "no-history";
  if ((input.missingStored ?? 0) > 0) return "partial";
  return (input.matched ?? 0) === 0 ? "no-matches" : "complete";
}
