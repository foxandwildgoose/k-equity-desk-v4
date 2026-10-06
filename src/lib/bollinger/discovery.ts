import { analyzeBollinger } from "./engine.ts";
import { DEFAULT_BOLLINGER_SYSTEM_CONFIG } from "./config.ts";
import { confirmedSwingLevelHistory } from "./patterns.ts";
import type { BollingerBar, BollingerPoint, ScoreComponent } from "./types.ts";
import { discoveryDailyBars } from "./discovery-dates.ts";

/** Application heuristics. A version identifies every threshold, not a return probability. */
export const DISCOVERY_DEFAULTS = Object.freeze({
  version: "long-daily-2.0.0", squeeze: 10, compression: 20, extreme: 5,
  resistanceLookback: 60, pivotLeft: 3, pivotRight: 3, distanceMax: 5,
  percentBMin: .65, percentBMax: .95, rsiMin: 50, rsiMax: 68,
  smaSlopeTolerance: .001, dryWindow: 5, dryStrong: .75, dryMax: .9,
  triggerRvol: 1.5, strongRvol: 2, minCoverage: .8, armedScore: 70,
  extensionPct: 5, extensionSma20Pct: 10, failedWindow: 3,
  minVolume20: 0, minTurnover20: 0, minMarketCap: 0,
  rsMin: 0, requireMarket: 0, requireSector: 0,
});
export type DiscoveryConfig = { -readonly [K in keyof typeof DISCOVERY_DEFAULTS]: K extends "version" ? string : number };
export const STRATEGIES = ["long-pre-breakout", "squeeze-watch", "triggered", "follow-through", "failed-breakout", "pullback", "mean-reversion-watch", "bear-breakdown"] as const;
export type Strategy = typeof STRATEGIES[number];
export type DiscoveryState = "WARMUP" | "WATCH" | "ARMED" | "TRIGGERED" | "FOLLOW_THROUGH" | "FAILED" | "NEUTRAL";
export type Context = { return20: number | null; return63: number | null; aboveSma200: boolean | null; slope200: number | null; source: string; asOf: string; rsPercentile?: number | null };
export type DailyContext = { market?: Context; sector?: Context; rsPercentile?: number | null };
export type LongScore = { value: number | null; coverage: number; earned: number; available: number; components: Record<string, ScoreComponent> };
export type Trigger = { date: string; index: number; price: number; resistance: number; priorCompression: number | null; priorArmedScore: number | null };
export type DiscoveryEvent = { id: string; date: string; type: "entered-armed" | "exited-armed" | "price-breakout" | "triggered" | "volume-confirmed" | "follow-through" | "failed"; triggerDate: string | null; delivery: "detected" };
export type Candidate = {
  date: string; state: DiscoveryState; views: Strategy[]; close: number;
  resistance: number | null; resistanceMethod: "confirmed-pivot" | "prior-rolling-high" | "unavailable";
  distance: number | null; dryRvol: number | null; sma200Slope: number | null;
  return20: number | null; return63: number | null; rs20: number | null; rs63: number | null; rsPercentile: number | null;
  sectorStrengthPercentile: number | null;
  bbwPercentile: number | null; percentB: number | null; rsi: number | null; rsiSlope: number | null; rvol: number | null;
  trend: BollingerPoint["trend"]; score: LongScore; confirmationScore: number | null;
  trigger: Trigger | null; followThroughBars: number | null; extended: boolean; valid: boolean;
  volume20: number | null; turnover20: number | null; reasons: string[]; warnings: string[];
  gates: { investible:boolean; liquid:boolean; bullish:boolean; compressed:boolean; preBreakout:boolean };
};
export type DiscoveryChartContext = { candidate: Candidate; market:"KR"|"US"; symbol:string; source:string; priceBasis:string; history:{date:string;resistance:number|null}[] };
const valid = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export function median(values: readonly number[]): number | null {
  const a = values.filter(valid).sort((a, b) => a - b);
  if (!a.length) return null;
  const i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i]! : (a[i - 1]! + a[i]!) / 2;
}
export function sanitizeDiscoveryConfig(raw: unknown): DiscoveryConfig {
  const out: DiscoveryConfig = { ...DISCOVERY_DEFAULTS };
  if (!raw || typeof raw !== "object") return out;
  const value = raw as Record<string, unknown>;
  const bounds: Record<string, [number, number]> = {
    squeeze: [0, 100], compression: [0, 100], extreme: [0, 100], resistanceLookback: [20, 60], pivotLeft: [1, 10], pivotRight: [1, 10],
    distanceMax: [0, 20], percentBMin: [0, 1], percentBMax: [0, 1.2], rsiMin: [0, 100], rsiMax: [0, 100], smaSlopeTolerance: [0, .02],
    dryWindow: [1, 20], dryStrong: [.1, 2], dryMax: [.1, 3], triggerRvol: [1, 10], strongRvol: [1, 15], minCoverage: [.5, 1], armedScore: [0, 100],
    extensionPct: [0, 30], extensionSma20Pct: [0, 50], failedWindow: [1, 3], minVolume20: [0, 1e12], minTurnover20: [0, 1e16], minMarketCap: [0, 1e18],
    rsMin: [-100, 100], requireMarket: [0, 1], requireSector: [0, 1],
  };
  for (const [key, [lo, hi]] of Object.entries(bounds)) if (valid(value[key])) (out as unknown as Record<string, unknown>)[key] = Math.min(hi, Math.max(lo, value[key]));
  for (const key of ["resistanceLookback", "pivotLeft", "pivotRight", "dryWindow", "failedWindow", "requireMarket", "requireSector"] as const) out[key] = Math.round(out[key]);
  out.squeeze = Math.max(out.extreme, out.squeeze); out.compression = Math.max(out.squeeze, out.compression);
  out.percentBMax = Math.max(out.percentBMin, out.percentBMax); out.rsiMax = Math.max(out.rsiMin, out.rsiMax);
  out.dryMax = Math.max(out.dryStrong, out.dryMax); out.strongRvol = Math.max(out.triggerRvol, out.strongRvol);
  // All nondefault configurations have deterministic separate cache/event identities.
  const changed = Object.entries(out).filter(([k, v]) => k !== "version" && v !== DISCOVERY_DEFAULTS[k as keyof DiscoveryConfig]);
  out.version = changed.length ? `${DISCOVERY_DEFAULTS.version}:${changed.map(([k, v]) => `${k}=${v}`).join(";")}` : DISCOVERY_DEFAULTS.version;
  return out;
}
export function discoveryConfigFromVersion(version:string) {
  const raw:Record<string,number>={};
  for(const pair of version.slice(DISCOVERY_DEFAULTS.version.length+1).split(";")){const [k,v]=pair.split("=");if(k&&v!==undefined)raw[k]=Number(v);}
  const config=sanitizeDiscoveryConfig(raw);return {config,recognized:config.version===version};
}
function component(max: number, score: number | null, reason: string, inputs: ScoreComponent["inputs"]): ScoreComponent {
  return { max, score, reason, inputs, availability: score === null ? "unknown" : "available" };
}
export function normalizeLongScore(components: Record<string, ScoreComponent>): LongScore {
  const available = Object.values(components).reduce((n, c) => n + (valid(c.score) ? c.max : 0), 0);
  const earned = Object.values(components).reduce((n, c) => n + (valid(c.score) ? Math.min(c.max, Math.max(0, c.score)) : 0), 0);
  return { value: available ? Math.round(earned / available * 1000) / 10 : null, earned, available, coverage: available / 100, components };
}
export function returnAt(bars: readonly BollingerBar[], i: number, n: number): number | null {
  const now = bars[i], past = bars[i - n];
  return now?.completed === true && past?.completed === true && now.close > 0 && past.close > 0 ? (now.close / past.close - 1) * 100 : null;
}
function contextScore(c: Context | undefined, date: string): number | null {
  return c && c.asOf === date && c.aboveSma200 !== null && valid(c.slope200) && valid(c.return20) && valid(c.return63)
    ? (c.aboveSma200 ? .4 : 0) + (c.slope200 >= 0 ? .2 : 0) + (c.return20 > 0 ? .2 : 0) + (c.return63 > 0 ? .2 : 0) : null;
}
/** One shared BB/RSI/SMA engine. Completed chronological daily bars only; prefix-invariant. */
export function analyzeDiscovery(input: readonly BollingerBar[], raw: unknown = DISCOVERY_DEFAULTS, contexts: Record<string, DailyContext> = {}, identity = "security", metadata?: {marketCap:number|null}): { candidates: Candidate[]; events: DiscoveryEvent[]; config: DiscoveryConfig } {
  const config = sanitizeDiscoveryConfig(raw);
  const bars = discoveryDailyBars(input);
  const analysis = analyzeBollinger(bars, { ...DEFAULT_BOLLINGER_SYSTEM_CONFIG, pivotLeft: config.pivotLeft, pivotRight: config.pivotRight });
  const swings = confirmedSwingLevelHistory(bars, config.pivotLeft, config.pivotRight);
  const candidates: Candidate[] = [], events: DiscoveryEvent[] = [];
  const validRvols: number[] = [];
  let active: Trigger | null = null;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]!, p = analysis.points[i]!, prev = candidates[i - 1];
    const recent = bars.slice(Math.max(0, i - config.resistanceLookback), i);
    // A pivot can be used only once its right-hand confirmation is known, and only within the lookback.
    const swing = swings[i - 1]?.high ?? null;
    const pivotInRange = swing !== null && recent.some(x => x.high === swing);
    const resistance = pivotInRange ? swing : recent.length >= 20 ? Math.max(...recent.map(x => x.high)) : null;
    const distance = resistance !== null && b.close > 0 ? (resistance - b.close) / b.close * 100 : null;
    const s200 = analysis.points[i - 5]?.sma200;
    const slope = valid(s200) && s200 > 0 && valid(p.sma200) ? p.sma200 / s200 - 1 : null;
    if (valid(p.rvol)) { validRvols.push(p.rvol); if (validRvols.length > config.dryWindow) validRvols.shift(); }
    const dry = validRvols.length === config.dryWindow ? median(validRvols) : null;
    const r20 = returnAt(bars, i, 20), r63 = returnAt(bars, i, 63), c = contexts[b.date];
    const m = c?.market?.asOf === b.date ? c.market : undefined, s = c?.sector?.asOf === b.date ? c.sector : undefined;
    const rs20 = valid(r20) && valid(m?.return20) ? r20 - m.return20 : null;
    const rs63 = valid(r63) && valid(m?.return63) ? r63 - m.return63 : null;
    const volWindow = bars.slice(Math.max(0, i - 19), i + 1);
    const volumeOK = volWindow.length === 20 && volWindow.every(x => x.volumeValid !== false && valid(x.volume) && x.volume >= 0);
    const volume20 = volumeOK ? volWindow.reduce((n, x) => n + x.volume / 20, 0) : null;
    const turnover20 = volumeOK ? volWindow.reduce((n, x) => n + x.volume * x.close / 20, 0) : null;
    const above = valid(p.sma200) && b.close > p.sma200;
    const trendOK = above && valid(slope) && slope >= -config.smaSlopeTolerance;
    const ordering = [[b.close, p.sma20], [p.sma20, p.sma60], [p.sma60, p.sma120], [p.sma120, p.sma200]].filter(([a, z]) => valid(a) && valid(z) && a > z).length;
    const locationOK = valid(distance) && distance >= 0 && distance <= config.distanceMax && valid(p.percentB) && p.percentB >= config.percentBMin && p.percentB <= config.percentBMax;
    const momentumOK = valid(p.rsi) && valid(p.rsiSlope) && p.rsi >= config.rsiMin && p.rsi <= config.rsiMax && p.rsiSlope > 0;
    const extended = (valid(distance) && distance < -config.extensionPct) || (valid(p.percentB) && p.percentB > 1.2) ||
      (valid(p.sma20) && p.sma20 > 0 && (b.close / p.sma20 - 1) * 100 > config.extensionSma20Pct) || (valid(p.rsi) && p.rsi > 75);
    const components: Record<string, ScoreComponent> = {
      market: component(7.5, contextScore(m, b.date) === null ? null : 7.5 * contextScore(m, b.date)!, "완료 일봉 벤치마크의 추세·20/63봉 수익률", { source: m?.source ?? null, asOf: m?.asOf ?? null }),
      sector: component(7.5, contextScore(s, b.date) === null || !valid(m?.return20) || !valid(m?.return63) ? null : 7.5 * ((s!.return20! > m.return20 ? .5 : 0) + (s!.return63! > m.return63 ? .5 : 0)), "당시 편입 종목의 섹터 중앙값 수익률 − 시장 수익률", { source: s?.source ?? null, asOf: s?.asOf ?? null, percentile:s?.rsPercentile??null }),
      trend: component(20, valid(p.sma200) && valid(slope) ? (above ? 8 : 0) + (slope >= -config.smaSlopeTolerance ? 4 : 0) + (above ? ordering * 2 : 0) : null, "롱 전용: SMA200 위·기울기·선호 정배열", { close: b.close, sma200: p.sma200, slope, ordering }),
      compression: component(20, valid(p.bbwPercentile) ? p.bbwPercentile <= config.extreme ? 20 : p.bbwPercentile <= config.squeeze ? 18 : p.bbwPercentile <= config.compression ? 12 : 0 : null, "BBW(20,2) 125개 유효 관측의 실제 분위수", { percentile: p.bbwPercentile, samples: p.bbwSamples }),
      position: component(20, valid(distance) && valid(p.percentB) ? (locationOK ? 20 : distance >= 0 && distance <= config.distanceMax ? 8 : 0) : null, "현재 봉을 제외한 인과적 저항과 사전 돌파 구간", { resistance, distance, percentB: p.percentB }),
      momentum: component(7.5, valid(p.rsi) && valid(p.rsiSlope) ? momentumOK ? 7.5 : p.rsi >= config.rsiMin && p.rsiSlope > 0 ? 3 : 0 : null, "Wilder RSI 수준과 양의 기울기", { rsi: p.rsi, slope: p.rsiSlope }),
      relativeStrength: component(7.5, valid(rs20) && valid(rs63) ? (rs20 > config.rsMin ? 3.75 : 0) + (rs63 > config.rsMin ? 3.75 : 0) : null, "같은 거래일 시장 대비 20/63봉 수익률 차이", { rs20, rs63, minimum:config.rsMin }),
      dryUp: component(10, valid(dry) ? dry <= config.dryStrong ? 10 : dry <= config.dryMax ? 8 : dry <= 1.2 ? 3 : 0 : null, "최근 유효 일별 RVOL의 중앙값; 결측은 0 아님", { medianRvol: dry, window: config.dryWindow }),
    };
    const score = normalizeLongScore(components);
    const investible = b.close > 0 && valid(b.close) && [b.open, b.high, b.low].every(valid) && b.high >= Math.max(b.open, b.close) && b.low <= Math.min(b.open, b.close);
    const liquid = valid(volume20) && volume20 >= config.minVolume20 && valid(turnover20) && turnover20 >= config.minTurnover20;
    const capitalizationOK = config.minMarketCap === 0 || metadata?.marketCap != null && metadata.marketCap >= config.minMarketCap;
    const ready = investible && liquid && capitalizationOK && valid(p.bbwPercentile) && valid(slope);
    let state: DiscoveryState = ready ? "NEUTRAL" : "WARMUP";
    if (ready && valid(p.bbwPercentile) && p.bbwPercentile <= config.compression && trendOK && !extended) state = "WATCH";
    const environmentOK = (!config.requireMarket || m?.aboveSma200===true && valid(m.slope200) && m.slope200>=0) && (!config.requireSector || valid(components.sector!.score) && components.sector!.score>=3.75);
    if (state === "WATCH" && environmentOK && p.bbwPercentile! <= config.squeeze && locationOK && momentumOK && valid(dry) && dry <= config.dryMax && score.coverage >= config.minCoverage && score.value! >= config.armedScore) state = "ARMED";
    const emit = (type: DiscoveryEvent["type"], triggerDate: string | null = active?.date ?? null) => events.push({ id: `${identity}:day:${config.version}:${type}:${b.date}:${triggerDate ?? "none"}`, date: b.date, type, triggerDate, delivery: "detected" });
    const crossed = prev && valid(prev.resistance) && bars[i - 1]!.close <= prev.resistance && b.close > prev.resistance;
    if (crossed && ["WATCH", "ARMED"].includes(prev.state) && trendOK) {
      emit("price-breakout", b.date);
      if (valid(p.rvol) && p.rvol >= config.triggerRvol) {
        active = { date: b.date, index: i, price: b.close, resistance: prev.resistance!, priorCompression: prev.bbwPercentile, priorArmedScore: prev.score.value };
        state = "TRIGGERED"; emit("triggered"); emit("volume-confirmed");
      }
    }
    let followThroughBars: number | null = null;
    if (active && i > active.index) {
      const elapsed = i - active.index;
      if (elapsed > 10) active = null;
      else if (elapsed <= config.failedWindow && b.close < active.resistance) { state = "FAILED"; if (prev?.state !== "FAILED") emit("failed"); }
      else if (prev?.state === "FAILED") state = "FAILED";
      else if (elapsed <= 10 && b.close >= active.resistance) { state = "FOLLOW_THROUGH"; followThroughBars = elapsed; if ([1, 3, 5, 10].includes(elapsed)) emit("follow-through"); }
    }
    if (state === "ARMED" && prev?.state !== "ARMED") emit("entered-armed", null);
    if (prev?.state === "ARMED" && state !== "ARMED") emit("exited-armed");
    const views: Strategy[] = [];
    if (state === "ARMED") views.push("long-pre-breakout");
    if (ready && p.bbwPercentile! <= config.squeeze) views.push("squeeze-watch");
    if (state === "TRIGGERED") views.push("triggered"); if (state === "FOLLOW_THROUGH") views.push("follow-through"); if (state === "FAILED") views.push("failed-breakout");
    if (above && valid(p.percentB) && p.percentB >= .2 && p.percentB < .5) views.push("pullback");
    if (p.trend === "neutral" && valid(p.percentB) && (p.percentB < 0 || p.percentB > 1)) views.push("mean-reversion-watch");
    if (p.trend === "bearish" || p.trend === "strong-bearish" || p.breakout === "lower") views.push("bear-breakdown");
    const warnings = Object.entries(components).filter(([, c]) => c.score === null).map(([key]) => `${key}: 데이터 미확보`);
    if (extended) warnings.push("Already Extended · 사전 돌파 후보에서 제외");
    if(!environmentOK)warnings.push("필수 시장/섹터 gate 미충족 또는 데이터 미확보");
    if (!ready) warnings.push("완료 가격/거래량/SMA200/BBW 워밍업 부족");
    if (!capitalizationOK) warnings.push("최소 시가총액 조건 미충족 또는 시가총액 미확보");
    candidates.push({ date: b.date, state, views, close: b.close, resistance, resistanceMethod: resistance === null ? "unavailable" : pivotInRange ? "confirmed-pivot" : "prior-rolling-high",
      distance, dryRvol: dry, sma200Slope: slope, return20: r20, return63: r63, rs20, rs63, rsPercentile: c?.rsPercentile ?? null,sectorStrengthPercentile:s?.rsPercentile??null,
      bbwPercentile: p.bbwPercentile, percentB: p.percentB, rsi: p.rsi, rsiSlope: p.rsiSlope, rvol: p.rvol, trend: p.trend, score,
      confirmationScore: active ? Math.min(100, (b.close > active.resistance ? 40 : 0) + (valid(p.rvol) && p.rvol >= config.strongRvol ? 30 : valid(p.rvol) && p.rvol >= config.triggerRvol ? 20 : 0) + (valid(p.percentB) && p.percentB >= 1 ? 15 : 0) + (above ? 15 : 0)) : null,
      trigger: active ? { ...active } : null, followThroughBars, extended, valid: ready, volume20, turnover20,
      gates:{investible,liquid:liquid&&capitalizationOK,bullish:trendOK,compressed:valid(p.bbwPercentile)&&p.bbwPercentile<=config.compression,preBreakout:locationOK&&trendOK&&!extended},
      reasons: [trendOK ? "SMA200 위·기울기 통과" : "롱 추세 조건 미충족", locationOK ? "저항 아래 사전 돌파 구간" : "사전 돌파 위치 미충족", momentumOK ? "RSI 상승 모멘텀" : "RSI 조건 미충족", valid(dry) && dry <= config.dryMax ? "거래량 건조" : "거래량 건조 미충족"], warnings });
  }
  return { candidates, events, config };
}
