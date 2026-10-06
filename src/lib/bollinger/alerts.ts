import type { BollingerAnalysis, BollingerEvent, BollingerSignal, BollingerSystemSettings } from "./types.ts";
import type { StorageLike } from "../charts/persistence.ts";
import type { DiscoveryEvent } from "./discovery.ts";

export const BOLLINGER_SIGNAL_LABELS: Record<BollingerSignal, string> = {
  squeeze: "스퀴즈 감지", "upper-breakout": "상단 종가 돌파", "lower-breakdown": "하단 종가 이탈",
  "failed-upper": "상단 돌파 실패", "failed-lower": "하단 이탈 실패", "upper-walk": "상단 밴드워크 시작", "lower-walk": "하단 밴드워크 시작",
  "bullish-divergence": "%B 상승 다이버전스", "bearish-divergence": "%B 하락 다이버전스",
  "w-setup": "W 바닥 준비", "w-confirmed": "W 바닥 구조 확인", "m-setup": "M 천장 준비", "m-confirmed": "M 천장 구조 확인",
  expansion: "압축 후 변동성 확장", "volume-confirmed": "돌파 거래량 확인",
};
export interface BollingerAlertLedger { version: 1; throughDate: string | null; seen: string[]; }
export function initialBollingerLedger(analysis: BollingerAnalysis): BollingerAlertLedger {
  return { version: 1, throughDate: analysis.points.filter(p => p.completed).at(-1)?.date ?? null, seen: [] };
}
/** Active-session evaluation: baseline never emits retrospective history.
 * Repeated calls and persisting regimes cannot emit the same stable event twice. */
export function evaluateBollingerAlerts(analysis: BollingerAnalysis, settings: BollingerSystemSettings,
  ledger: BollingerAlertLedger, identity: string): { ledger: BollingerAlertLedger; fired: BollingerEvent[] } {
  if (!settings.enabled || !settings.alerts) return { ledger, fired: [] };
  const latest = analysis.points.filter(p => p.completed).at(-1)?.date ?? null;
  if (latest == null || ledger.throughDate == null) return { ledger: { ...ledger, throughDate: latest }, fired: [] };
  const seen = new Set(ledger.seen);
  const fired = analysis.events.filter(event => event.date > ledger.throughDate! && event.date <= latest
    && settings.alertSignals.includes(event.type) && analysis.points[event.index]?.completed && !seen.has(`${identity}:${event.id}`));
  for (const event of fired) seen.add(`${identity}:${event.id}`);
  return { fired, ledger: { version: 1, throughDate: latest > ledger.throughDate ? latest : ledger.throughDate,
    seen: [...seen].slice(-1000) } };
}
export function loadBollingerLedger(storage: StorageLike | null, key: string): BollingerAlertLedger | null {
  try {
    const value = JSON.parse(storage?.getItem(key) ?? "null") as Partial<BollingerAlertLedger> | null;
    return value?.version === 1 && Array.isArray(value.seen) && (value.throughDate == null || typeof value.throughDate === "string")
      ? { version: 1, throughDate: value.throughDate ?? null, seen: value.seen.filter(s => typeof s === "string").slice(-1000) } : null;
  } catch { return null; }
}
export function saveBollingerLedger(storage: StorageLike | null, key: string, ledger: BollingerAlertLedger) {
  try { storage?.setItem(key, JSON.stringify(ledger)); } catch { /* blocked/full storage */ }
}
/** Shared within this browser module: two workspace cells cannot notify twice. */
export const activeBollingerLedgers = new Map<string, BollingerAlertLedger>();

/** Discovery uses the same persisted active-session ledger and delivery UI.
 * First observation is a baseline; stored historical detections never become retrospective notifications. */
export function evaluateDiscoveryAlerts(events: readonly DiscoveryEvent[], ledger: BollingerAlertLedger | null, identity: string) {
  const latest = events.reduce<string | null>((date,event)=>date===null||event.date>date?event.date:date,null);
  if (!ledger || ledger.throughDate===null) return { ledger:{version:1 as const,throughDate:latest,seen:[...new Set([...(ledger?.seen??[]),...events.map(event=>`${identity}:${event.id}`)])].slice(-1000)},fired:[] as DiscoveryEvent[] };
  const seen=new Set(ledger.seen);
  const fired:DiscoveryEvent[]=[];
  for(const event of events){const key=`${identity}:${event.id}`;if(event.date>=ledger.throughDate&&!seen.has(key)){fired.push(event);seen.add(key);}}
  return {ledger:{version:1 as const,throughDate:latest&&latest>ledger.throughDate?latest:ledger.throughDate,seen:[...seen].slice(-1000)},fired};
}

/** Financial-rule identity excludes presentation settings and captures every heuristic. */
export function bollingerFinancialKey(settings: BollingerSystemSettings): string {
  const { period, mult, source, basis, bbwLookback, extremeThreshold, squeezeThreshold, compressionThreshold, expansionRatio,
    slopeLookback, trendTolerance, rvolPeriod, rvolThreshold, rsiPeriod, failedWindow, walkWindow, walkCount, walkThreshold,
    pivotLeft, pivotRight, patternMaxBars, patternTolerance } = settings;
  return JSON.stringify([period,mult,source,basis,bbwLookback,extremeThreshold,squeezeThreshold,compressionThreshold,expansionRatio,
    slopeLookback,trendTolerance,rvolPeriod,rvolThreshold,rsiPeriod,failedWindow,walkWindow,walkCount,walkThreshold,pivotLeft,pivotRight,patternMaxBars,patternTolerance]);
}
