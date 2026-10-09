import { STRATEGIES, type Strategy } from "./discovery.ts";
import type { TopChoice, UniverseKind } from "./discovery-universe.ts";
import { bootstrapBollingerRequestSchema, type BootstrapBollingerInput, type BollingerCollectionInput } from "./collection-request.ts";
import { isDiscoveryDay } from "./discovery-dates.ts";
import { z } from "zod";

export type DiscoverySearchDraft = {
  universeId: string;
  bootstrapTarget?: BootstrapBollingerInput["bootstrapTarget"];
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
  return JSON.stringify([request.universeId, request.universeId ? null : request.bootstrapTarget ?? null, request.configVersion, request.strategy, request.selection.top,
    request.selection.minWeight, [...request.selection.sectors].sort(),
    request.symbols === undefined ? null : [...new Set(request.symbols)].sort(),
    request.minScore, request.minCoverage, request.sort, request.asOf]);
}
/** View filters are DB reads; changing them must not create a new collection job. */
export function discoveryCollectionSelectionSignature(request: DiscoverySearchDraft): string {
  return JSON.stringify([request.universeId, request.universeId ? null : request.bootstrapTarget ?? null,
    request.configVersion, request.selection.top, request.selection.minWeight,
    [...request.selection.sectors].sort(), request.symbols === undefined ? null : [...new Set(request.symbols)].sort()]);
}
export function applyDiscoveryStrategy(request: AppliedDiscoverySearch, strategy: Strategy): AppliedDiscoverySearch {
  return applyDiscoverySearch({ ...request, strategy }, request.asOf);
}
/** Missing snapshots can be acquired only through verified, explicit provider targets. */
export function discoveryBootstrapTarget(kind: UniverseKind, etfCode: string): BootstrapBollingerInput["bootstrapTarget"] | null {
  if (kind === "KOSPI" || kind === "KOSDAQ" || kind === "NASDAQ_LISTED") return kind;
  if (kind === "ETF" && /^[0-9A-Z]{6}$/.test(etfCode)) return `ETF:${etfCode}`;
  return null;
}
/** Bootstrap progress keeps its original scope after membership supplies a real snapshot ID. */
export function discoveryCollectionRequest(request: DiscoverySearchDraft): BollingerCollectionInput | null {
  const common = { configVersion: request.configVersion, selection: { ...request.selection, sectors: [...request.selection.sectors] },
    symbols: request.symbols === undefined ? undefined : [...request.symbols] };
  if (request.bootstrapTarget) return { ...common, bootstrapTarget: request.bootstrapTarget };
  return request.universeId ? { ...common, universeId: request.universeId } : null;
}
/** A delayed response may bind its frozen result, but cannot change a newly edited market or selection. */
export function canBindBootstrapToDraft(frozen: DiscoverySearchDraft, draft: DiscoverySearchDraft, universeId: string,
  currentTarget: BootstrapBollingerInput["bootstrapTarget"] | null): boolean {
  if (!frozen.bootstrapTarget || frozen.bootstrapTarget !== currentTarget || (draft.universeId && draft.universeId !== universeId)) return false;
  return discoveryCollectionSelectionSignature({ ...frozen, universeId: "" }) === discoveryCollectionSelectionSignature({ ...draft, universeId: "", bootstrapTarget: currentTarget });
}
type IntentStorage = { getItem(key:string):string|null; setItem(key:string,value:string):void; removeItem(key:string):void };
export const DISCOVERY_BOOTSTRAP_SESSION_KEY = "ked:bollinger:bootstrap-intent:v1";
const persistedBootstrapSchema = bootstrapBollingerRequestSchema.extend({ universeId:z.string().max(160),
  strategy:z.enum(STRATEGIES),minScore:z.number().min(0).max(100),minCoverage:z.number().min(0).max(1),
  sort:z.enum(["score","distance","rs"]),asOf:z.string().refine(isDiscoveryDay) }).strict();
/** Only public selection data is stored. No permission, cookie, secret or automatic execution is persisted. */
export function saveDiscoveryBootstrapIntent(storage:IntentStorage|null,request:AppliedDiscoverySearch|null):void {
  try {
    if(!storage)return;
    if(!request?.bootstrapTarget){storage.removeItem(DISCOVERY_BOOTSTRAP_SESSION_KEY);return;}
    const result=persistedBootstrapSchema.safeParse(request);if(!result.success)return;
    storage.setItem(DISCOVERY_BOOTSTRAP_SESSION_KEY,JSON.stringify({v:1,search:result.data}));
  } catch { /* Storage denial does not block an explicitly requested run. */ }
}
export function loadDiscoveryBootstrapIntent(storage:IntentStorage|null):AppliedDiscoverySearch|null {
  try {
    const raw=storage?.getItem(DISCOVERY_BOOTSTRAP_SESSION_KEY);if(!raw||raw.length>150000)return null;
    const value:unknown=JSON.parse(raw);
    const parsed=z.object({v:z.literal(1),search:persistedBootstrapSchema}).strict().safeParse(value);
    return parsed.success?applyDiscoverySearch(parsed.data.search,parsed.data.search.asOf):null;
  } catch { return null; }
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
