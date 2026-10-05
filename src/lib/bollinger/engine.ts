import { bollinger, rsi, sma } from "../chart-indicators.ts";
import { computeBollingerPatterns, confirmedSwingLevelHistory } from "./patterns.ts";
import type {
  BollingerAnalysis, BollingerBar, BollingerEvent, BollingerPoint, BollingerSetup,
  BollingerSystemSettings, FlowConfirmation, ScoreComponent, SetupQuality,
  TrendRegime, VolatilityRegime,
} from "./types.ts";

/** Application heuristics, not a proprietary score or a return probability. */
export const BOLLINGER_RULES = {
  weights: { trend: 25, volatility: 20, momentum: 20, volume: 15, flow: 10, riskReward: 10 },
  trendScores: { "strong-bullish": 25, bullish: 18, neutral: 8, bearish: 18, "strong-bearish": 25 },
  volatilityScores: { "extreme-squeeze": 20, squeeze: 18, compression: 14, normal: 5, expansion: 20 },
  momentumBullRsi: 55, momentumBearRsi: 45,
  volumeWeak: 0.8, volumeImproving: 1.2, volumeStrong: 2,
  rewardGood: 2, rewardStrong: 3,
  pullbackLow: 0.2, pullbackHigh: 0.8,
  workflowExpiryBars: 20,
} as const;

type MaybeNumber = number | null | undefined;
const finite = (value: MaybeNumber): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number) => Math.round(value * 10) / 10;

/** Close-relative band location. Zero-width bands have no defined location. */
export function percentB(close: MaybeNumber, upper: MaybeNumber, lower: MaybeNumber): number | null {
  if (!finite(close) || !finite(upper) || !finite(lower) || upper <= lower) return null;
  const value = (close - lower) / (upper - lower);
  return Number.isFinite(value) ? value : null;
}

/** Percentage points; only a positive, finite security-price basis is valid. */
export function bandWidth(upper: MaybeNumber, middle: MaybeNumber, lower: MaybeNumber): number | null {
  if (!finite(upper) || !finite(middle) || !finite(lower) || middle <= 0 || upper < lower) return null;
  const value = (upper - lower) / middle * 100;
  return Number.isFinite(value) ? value : null;
}

export interface BbwRank {
  percentile: number | null; min: number | null; max: number | null; samples: number;
}

/** Last N valid observations, including current when supplied by the caller. */
export function empiricalBbwRank(values: readonly MaybeNumber[], current: MaybeNumber, required = 125): BbwRank {
  if (!Number.isSafeInteger(required) || required < 1) return { percentile: null, min: null, max: null, samples: 0 };
  const valid = values.filter(finite).slice(-required);
  const result: BbwRank = {
    percentile: null, min: valid.length ? Math.min(...valid) : null,
    max: valid.length ? Math.max(...valid) : null, samples: valid.length,
  };
  if (!finite(current) || valid.length < required) return result;
  let below = 0;
  let equal = 0;
  for (const value of valid) { if (value < current) below++; else if (value === current) equal++; }
  result.percentile = (below + 0.5 * equal) / valid.length * 100;
  return result;
}

/** Bounded sorted rolling distribution: O(N × lookback), no full-history scans. */
export function rollingBbwRanks(values: readonly MaybeNumber[], lookback: number): BbwRank[] {
  if (!Number.isSafeInteger(lookback) || lookback < 1) return values.map(() => ({ percentile: null, min: null, max: null, samples: 0 }));
  const ordered: number[] = [];
  const fifo: number[] = [];
  const lowerBound = (value: number, upper = false) => {
    let lo = 0; let hi = ordered.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (ordered[mid]! < value || (upper && ordered[mid] === value)) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return values.map(value => {
    if (finite(value)) {
      ordered.splice(lowerBound(value), 0, value);
      fifo.push(value);
      if (fifo.length > lookback) ordered.splice(lowerBound(fifo.shift()!), 1);
    }
    const samples = ordered.length;
    return {
      percentile: finite(value) && samples === lookback
        ? (lowerBound(value) + 0.5 * (lowerBound(value, true) - lowerBound(value))) / samples * 100 : null,
      min: samples ? ordered[0]! : null, max: samples ? ordered[samples - 1]! : null, samples,
    };
  });
}

export function classifyVolatility(
  rank: MaybeNumber,
  settings: Pick<BollingerSystemSettings, "extremeThreshold" | "squeezeThreshold" | "compressionThreshold" | "expansionRatio">,
  currentBbw?: MaybeNumber, previousBbw?: MaybeNumber, previousRegime?: VolatilityRegime | null,
): VolatilityRegime | null {
  if (!finite(rank) || rank < 0 || rank > 100) return null;
  if (finite(currentBbw) && finite(previousBbw) && currentBbw > previousBbw &&
      (previousRegime === "extreme-squeeze" || previousRegime === "squeeze" || previousRegime === "compression") &&
      (previousBbw === 0 || currentBbw >= previousBbw * settings.expansionRatio)) return "expansion";
  if (rank <= settings.extremeThreshold) return "extreme-squeeze";
  if (rank <= settings.squeezeThreshold) return "squeeze";
  if (rank <= settings.compressionThreshold) return "compression";
  return "normal";
}

export interface TrendInputs {
  close: MaybeNumber; sma20: MaybeNumber; sma60: MaybeNumber; sma120: MaybeNumber; sma200: MaybeNumber;
  slope60: MaybeNumber; slope120: MaybeNumber; slope200: MaybeNumber;
}

/** A normalized tolerance suppresses classifications from insignificant gaps. */
export function classifyTrend(inputs: TrendInputs, tolerance = 0.001): TrendRegime | null {
  const { close, sma20, sma60, sma120, sma200, slope60, slope120, slope200 } = inputs;
  if (![close, sma20, sma60, sma120, sma200].every(value => finite(value) && value > 0)) return null;
  const above = (a: number, b: number) => a - b > Math.max(Math.abs(a), Math.abs(b)) * tolerance;
  const bull = above(close!, sma20!) && above(sma20!, sma60!) && above(close!, sma200!);
  const bear = above(sma20!, close!) && above(sma60!, sma20!) && above(sma200!, close!);
  if (bull && above(sma60!, sma120!) && above(sma120!, sma200!) &&
      [slope60, slope120, slope200].every(value => finite(value) && value > tolerance)) return "strong-bullish";
  if (bear && above(sma120!, sma60!) && above(sma200!, sma120!) &&
      [slope60, slope120, slope200].every(value => finite(value) && value < -tolerance)) return "strong-bearish";
  return bull ? "bullish" : bear ? "bearish" : "neutral";
}

export interface BandObservation {
  close: number; upper: MaybeNumber; lower: MaybeNumber; completed?: boolean;
}

export function completedBreakout(current: BandObservation, previous: BandObservation | null): "upper" | "lower" | null {
  if (current.completed !== true || previous?.completed !== true || !finite(current.close) || !finite(previous.close)) return null;
  if (finite(current.upper) && finite(previous.upper) && current.close > current.upper && previous.close <= previous.upper) return "upper";
  if (finite(current.lower) && finite(previous.lower) && current.close < current.lower && previous.close >= previous.lower) return "lower";
  return null;
}

export function failedBreakoutSide(
  side: "upper" | "lower", current: BandObservation, elapsedCompletedBars: number, window = 2,
): "upper" | "lower" | null {
  if (current.completed !== true || elapsedCompletedBars < 1 || elapsedCompletedBars > window || !finite(current.close)) return null;
  if (side === "upper" && finite(current.upper) && current.close < current.upper) return side;
  if (side === "lower" && finite(current.lower) && current.close > current.lower) return side;
  return null;
}

export interface WalkObservation { close: number; middle: MaybeNumber; percentB: MaybeNumber; completed?: boolean; }
export function bandWalk(
  observations: readonly WalkObservation[], middleSlope: MaybeNumber,
  settings: Pick<BollingerSystemSettings, "walkWindow" | "walkCount" | "walkThreshold">,
): "upper" | "lower" | null {
  const window = observations.filter(row => row.completed === true).slice(-settings.walkWindow);
  if (window.length !== settings.walkWindow || !finite(middleSlope) ||
      window.some(row => !finite(row.close) || !finite(row.middle) || !finite(row.percentB))) return null;
  const latest = window[window.length - 1]!;
  if (middleSlope > 0 && latest.percentB! >= settings.walkThreshold &&
      window.filter(row => row.percentB! >= settings.walkThreshold).length >= settings.walkCount &&
      window.every(row => row.close >= row.middle!)) return "upper";
  const lowerThreshold = 1 - settings.walkThreshold;
  if (middleSlope < 0 && latest.percentB! <= lowerThreshold &&
      window.filter(row => row.percentB! <= lowerThreshold).length >= settings.walkCount &&
      window.every(row => row.close <= row.middle!)) return "lower";
  return null;
}

/** Current volume / current-inclusive SMA(volume). Same-slot uses prior sessions. */
export function relativeVolume(bars: readonly BollingerBar[], period = 20, intraday = false): {
  values: (number | null)[]; methods: BollingerPoint["rvolMethod"][];
} {
  const validVolume = (bar: BollingerBar) => bar.volumeValid !== false && finite(bar.volume) && bar.volume >= 0;
  const means = sma(bars.map(bar => validVolume(bar) ? bar.volume : Number.NaN), period);
  const slots = new Map<string, { date: string; volume: number }[]>();
  const values: (number | null)[] = [];
  const methods: BollingerPoint["rvolMethod"][] = [];
  for (let index = 0; index < bars.length; index++) {
    const bar = bars[index]!;
    const match = intraday ? /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(bar.date) : null;
    const samples = match ? slots.get(match[2]!) ?? [] : [];
    const priorSessions = match ? samples.filter(row => row.date < match[1]!).slice(-period) : [];
    const sameSlotMean = priorSessions.length === period ? priorSessions.reduce((sum, row) => sum + row.volume / period, 0) : null;
    const sameSlot = finite(sameSlotMean) && sameSlotMean > 0;
    const denominator = sameSlot ? sameSlotMean : means[index];
    values.push(validVolume(bar) && finite(denominator) && denominator > 0 ? bar.volume / denominator : null);
    methods.push(intraday ? sameSlot ? "same-slot" : "rolling-approximate" : "rolling");
    if (match && bar.completed === true && validVolume(bar)) {
      const next = samples.filter(row => row.date !== match[1]!);
      next.push({ date: match[1]!, volume: bar.volume });
      slots.set(match[2]!, next.slice(-period));
    }
  }
  return { values, methods };
}

export function volumeConfirmation(rvol: MaybeNumber, threshold = 1.5): "unavailable" | "weak" | "normal" | "improving" | "confirmed" | "strong" {
  if (!finite(rvol) || rvol < 0) return "unavailable";
  if (rvol >= Math.max(BOLLINGER_RULES.volumeStrong, threshold)) return "strong";
  if (rvol >= threshold) return "confirmed";
  if (rvol >= BOLLINGER_RULES.volumeImproving) return "improving";
  return rvol < BOLLINGER_RULES.volumeWeak ? "weak" : "normal";
}

export interface ScoreInputs {
  trend: TrendRegime | null; volatility: VolatilityRegime | null;
  percentB: MaybeNumber; rsi: MaybeNumber; rsiSlope: MaybeNumber; rvol: MaybeNumber;
  breakout: "upper" | "lower" | null; bandWalk: "upper" | "lower" | null;
  flow: FlowConfirmation; riskReward: MaybeNumber;
  close?: MaybeNumber; sma20?: MaybeNumber; sma60?: MaybeNumber; sma120?: MaybeNumber; sma200?: MaybeNumber;
  bbw?: MaybeNumber; bbwPercentile?: MaybeNumber;
}

const component = (max: number, score: number | null, reason: string, inputs: ScoreComponent["inputs"], availability?: ScoreComponent["availability"]): ScoreComponent => ({
  score, max, reason, inputs, availability: availability ?? (score == null ? "unknown" : "available"),
});

/** Missing subcategories are removed from the available denominator, never scored zero. */
export function normalizeSetupScore(components: SetupQuality["components"]): SetupQuality {
  let earnedScore = 0; let availableScore = 0;
  for (const value of Object.values(components)) {
    if (value.score == null || !Number.isFinite(value.score) || !Number.isFinite(value.max) || value.max <= 0) continue;
    earnedScore += Math.max(0, Math.min(value.max, value.score));
    availableScore += value.max;
  }
  const total = Object.values(BOLLINGER_RULES.weights).reduce((sum, value) => sum + value, 0);
  return {
    normalizedScore: availableScore > 0 ? round(earnedScore / availableScore * 100) : null,
    earnedScore: round(earnedScore), availableScore, coverage: availableScore / total, components,
  };
}

export function scoreSetupQuality(input: ScoreInputs, rvolThreshold = 1.5): SetupQuality {
  const w = BOLLINGER_RULES.weights;
  const direction = input.breakout ?? input.bandWalk ??
    (input.trend === "bullish" || input.trend === "strong-bullish" ? "upper" :
      input.trend === "bearish" || input.trend === "strong-bearish" ? "lower" : null);
  const momentumAvailable = finite(input.percentB) && finite(input.rsi) && finite(input.rsiSlope);
  const locationAligned = direction === "upper" ? input.percentB! >= BOLLINGER_RULES.pullbackHigh :
    direction === "lower" ? input.percentB! <= BOLLINGER_RULES.pullbackLow : false;
  const rsiAligned = direction === "upper" ? input.rsi! > BOLLINGER_RULES.momentumBullRsi && input.rsiSlope! > 0 :
    direction === "lower" ? input.rsi! < BOLLINGER_RULES.momentumBearRsi && input.rsiSlope! < 0 : false;
  const volume = volumeConfirmation(input.rvol, rvolThreshold);
  const volumeScores = { weak: 0, normal: 5, improving: 9, confirmed: 12, strong: 15 } as const;
  const flowEligible = input.flow.availability === "available" || input.flow.availability === "partial";
  const ownershipAvailable = flowEligible && finite(input.flow.foreignOwnershipChange);
  const trustAvailable = flowEligible && finite(input.flow.investmentTrustNet);
  const flowMax = (ownershipAvailable ? w.flow / 2 : 0) + (trustAvailable ? w.flow / 2 : 0);
  const flowAligned = (value: number) => direction === "lower" ? value < 0 : direction === "upper" ? value > 0 : false;
  const flowScore = (ownershipAvailable && flowAligned(input.flow.foreignOwnershipChange!) ? w.flow / 2 : 0) +
    (trustAvailable && flowAligned(input.flow.investmentTrustNet!) ? w.flow / 2 : 0);
  return normalizeSetupScore({
    trend: component(w.trend, input.trend ? BOLLINGER_RULES.trendScores[input.trend] : null,
      input.trend ? `SMA order / normalized slopes: ${input.trend}` : "SMA200 history unavailable", {
        trend: input.trend, close: input.close ?? null, sma20: input.sma20 ?? null, sma60: input.sma60 ?? null,
        sma120: input.sma120 ?? null, sma200: input.sma200 ?? null,
      }),
    volatility: component(w.volatility, input.volatility ? BOLLINGER_RULES.volatilityScores[input.volatility] : null,
      input.volatility ? `Empirical BBW distribution: ${input.volatility}; compression is direction-neutral` : "BBW distribution warmup incomplete", {
        regime: input.volatility, bbw: input.bbw ?? null, percentile: input.bbwPercentile ?? null,
      }),
    momentum: component(w.momentum, momentumAvailable ? (locationAligned ? 10 : 0) + (rsiAligned ? 10 : 0) : null,
      momentumAvailable ? "10 for aligned band location + 10 for RSI level and slope; band touch alone is not a trade" : "Band location / RSI slope unavailable", {
        direction, percentB: input.percentB ?? null, rsi: input.rsi ?? null, rsiSlope: input.rsiSlope ?? null,
        locationAligned, rsiAligned,
      }),
    volume: component(w.volume, volume === "unavailable" ? null : volumeScores[volume],
      volume === "unavailable" ? "Volume history unavailable or zero denominator" : `RVOL ${volume}; confirmation >= ${rvolThreshold}`, {
        rvol: input.rvol ?? null, threshold: rvolThreshold,
      }),
    flow: component(flowMax || w.flow, flowMax ? flowScore : null,
      flowMax ? "5 per available direction-aligned ownership change / trust net quantity; ownership is not net flow" : input.flow.reason, {
        foreignOwnershipChange: input.flow.foreignOwnershipChange, investmentTrustNet: input.flow.investmentTrustNet,
        direction, source: input.flow.source ?? null, asOf: input.flow.asOf ?? null,
      }, flowMax === w.flow ? "available" : flowMax ? "partial" : input.flow.availability),
    riskReward: component(w.riskReward, finite(input.riskReward) && input.riskReward >= 0
      ? input.riskReward >= BOLLINGER_RULES.rewardStrong ? 10 : input.riskReward >= BOLLINGER_RULES.rewardGood ? 7 : input.riskReward >= 1 ? 3 : 0 : null,
      finite(input.riskReward) ? "Confirmed entry, causal swing target and opposite boundary stop" : "No defensible confirmed target; excluded from score denominator", {
        riskReward: input.riskReward ?? null,
      }),
  });
}

export function classifySetup(input: Pick<BollingerPoint, "trend" | "volatility" | "percentB" | "rsi" | "rsiSlope" | "breakout" | "failedBreakout" | "bandWalk">): BollingerSetup {
  if (input.failedBreakout) return "failed-breakout";
  if (input.breakout) return input.breakout === "upper" ? "bull-breakout" : "bear-breakdown";
  if (input.bandWalk) return input.bandWalk === "upper" ? "upper-band-walk" : "lower-band-walk";
  const bull = input.trend === "bullish" || input.trend === "strong-bullish";
  const bear = input.trend === "bearish" || input.trend === "strong-bearish";
  const compressed = input.volatility === "extreme-squeeze" || input.volatility === "squeeze" || input.volatility === "compression";
  if (compressed && finite(input.percentB) && finite(input.rsi) && finite(input.rsiSlope) &&
      ((bull && input.percentB >= BOLLINGER_RULES.pullbackHigh && input.rsi > BOLLINGER_RULES.momentumBullRsi && input.rsiSlope > 0) ||
       (bear && input.percentB <= BOLLINGER_RULES.pullbackLow && input.rsi < BOLLINGER_RULES.momentumBearRsi && input.rsiSlope < 0))) return "pre-breakout";
  if (input.volatility === "extreme-squeeze" || input.volatility === "squeeze") return "squeeze";
  if (finite(input.percentB) && ((bull && input.percentB >= BOLLINGER_RULES.pullbackLow && input.percentB < 0.5) ||
      (bear && input.percentB <= BOLLINGER_RULES.pullbackHigh && input.percentB > 0.5))) return "pullback";
  if (input.trend === "neutral" && finite(input.percentB) && (input.percentB > 1 || input.percentB < 0)) return "mean-reversion-watch";
  return "mixed";
}

export function causalRiskReward(close: MaybeNumber, lower: MaybeNumber, upper: MaybeNumber,
  breakout: "upper" | "lower" | null, swings: { high: number | null; low: number | null }): number | null {
  if (!finite(close) || close <= 0 || !breakout) return null;
  const stop = breakout === "upper" ? lower : upper;
  const target = breakout === "upper" ? swings.high : swings.low;
  if (!finite(stop) || stop <= 0 || !finite(target) || target <= 0) return null;
  const risk = breakout === "upper" ? close - stop : stop - close;
  const reward = breakout === "upper" ? target - close : close - target;
  return risk > 0 && reward > 0 && Number.isFinite(reward / risk) ? reward / risk : null;
}

/** Same-frequency, chronological bars; callers mark completion using exchange metadata. */
export function analyzeBollinger(
  bars: BollingerBar[], config: BollingerSystemSettings,
  options: { market?: "KR" | "US"; intraday?: boolean; flowByDate?: Record<string, FlowConfirmation> } = {},
): BollingerAnalysis {
  const validPrice = (bar: BollingerBar) => [bar.open, bar.high, bar.low, bar.close].every(value => Number.isFinite(value) && value > 0) &&
    bar.high >= Math.max(bar.open, bar.close, bar.low) && bar.low <= Math.min(bar.open, bar.close, bar.high);
  const closes = bars.map(bar => validPrice(bar) ? bar.close : Number.NaN);
  const source = bars.map((bar, index) => !Number.isFinite(closes[index]) ? Number.NaN : config.source === "hlc3"
    ? bar.high / 3 + bar.low / 3 + bar.close / 3 : config.source === "ohlc4"
      ? bar.open / 4 + bar.high / 4 + bar.low / 4 + bar.close / 4 : bar.close);
  const bands = bollinger(source, config.period, config.mult);
  const pbs = closes.map((close, index) => percentB(close, bands.upper[index], bands.lower[index]));
  const widths = closes.map((_, index) => bandWidth(bands.upper[index], bands.mid[index], bands.lower[index]));
  const ranks = rollingBbwRanks(widths, config.bbwLookback);
  const averages = { sma20: sma(closes, 20), sma60: sma(closes, 60), sma120: sma(closes, 120), sma200: sma(closes, 200) };
  const rsis = rsi(closes, config.rsiPeriod);
  const volumes = relativeVolume(bars, config.rvolPeriod, options.intraday);
  const patterns = computeBollingerPatterns(bars, pbs, config);
  const patternByIndex = new Map<number, BollingerEvent[]>();
  for (const event of patterns) {
    const group = patternByIndex.get(event.index) ?? [];
    group.push(event); patternByIndex.set(event.index, group);
  }
  const swings = confirmedSwingLevelHistory(bars, config.pivotLeft, config.pivotRight);
  const points: BollingerPoint[] = [];
  const events: BollingerEvent[] = [];
  const completedIndices: number[] = [];
  let previousCompleted: number | null = null;
  let completedCount = 0;
  let pendingBreakout: { side: "upper" | "lower"; count: number } | null = null;
  let workflow: { squeezeCount: number; breakoutCount?: number; direction?: "upper" | "lower" } | null = null;
  const slope = (values: (number | null)[], index: number) => {
    const previous = values[index - config.slopeLookback]; const current = values[index];
    return finite(previous) && finite(current) && previous !== 0 ? (current - previous) / Math.abs(previous) : null;
  };
  const missingFlow: FlowConfirmation = { availability: options.market === "US" ? "not-applicable" : "unknown",
    foreignOwnershipChange: null, investmentTrustNet: null,
    reason: options.market === "US" ? "Korean ownership / investment-trust metrics are not applicable" : "Validated flow observations unavailable" };
  for (let index = 0; index < bars.length; index++) {
    const bar = bars[index]!;
    const completed = bar.completed === true;
    const previous = previousCompleted == null ? null : points[previousCompleted]!;
    const volatility = classifyVolatility(ranks[index]!.percentile, config, widths[index], previous?.bbw, previous?.volatility);
    const trendInputs: TrendInputs = { close: closes[index], sma20: averages.sma20[index], sma60: averages.sma60[index],
      sma120: averages.sma120[index], sma200: averages.sma200[index], slope60: slope(averages.sma60, index),
      slope120: slope(averages.sma120, index), slope200: slope(averages.sma200, index) };
    const trend = classifyTrend(trendInputs, config.trendTolerance);
    const currentObservation: BandObservation = { close: closes[index]!, upper: bands.upper[index], lower: bands.lower[index], completed };
    const breakout = completedBreakout(currentObservation, previous && previousCompleted != null
      ? { close: closes[previousCompleted]!, upper: previous.upper, lower: previous.lower, completed: true } : null);
    let failedBreakout: BollingerPoint["failedBreakout"] = null;
    let walk: BollingerPoint["bandWalk"] = null;
    const barEvents: BollingerEvent[] = [];
    const emit = (type: BollingerEvent["type"], direction: BollingerEvent["direction"], stage?: BollingerEvent["stage"]) => {
      barEvents.push({ type, index, date: bar.date, direction, id: `${type}:${bar.date}`, ...(stage ? { stage } : {}) });
    };
    if (completed) {
      completedCount++;
      if (pendingBreakout) {
        const elapsed = completedCount - pendingBreakout.count;
        failedBreakout = failedBreakoutSide(pendingBreakout.side, currentObservation, elapsed, config.failedWindow);
        if (failedBreakout || elapsed > config.failedWindow) pendingBreakout = null;
      }
      completedIndices.push(index);
      const recent = completedIndices.slice(-config.walkWindow).map(i => ({ close: closes[i]!, middle: bands.mid[i], percentB: pbs[i], completed: true }));
      walk = bandWalk(recent, slope(bands.mid, index), config);
      const squeezing = volatility === "squeeze" || volatility === "extreme-squeeze";
      const previousSqueezing = previous?.volatility === "squeeze" || previous?.volatility === "extreme-squeeze";
      if (squeezing && !previousSqueezing) { emit("squeeze", "neutral", 1); workflow = { squeezeCount: completedCount }; }
      if (workflow && completedCount - workflow.squeezeCount > BOLLINGER_RULES.workflowExpiryBars) workflow = null;
      if (failedBreakout) { emit(failedBreakout === "upper" ? "failed-upper" : "failed-lower", failedBreakout === "upper" ? "bearish" : "bullish"); workflow = null; }
      if (breakout) {
        emit(breakout === "upper" ? "upper-breakout" : "lower-breakdown", breakout === "upper" ? "bullish" : "bearish", workflow ? 2 : undefined);
        pendingBreakout = { side: breakout, count: completedCount };
        if (workflow) workflow = { ...workflow, breakoutCount: completedCount, direction: breakout };
      }
      if (walk && walk !== previous?.bandWalk) emit(walk === "upper" ? "upper-walk" : "lower-walk", walk === "upper" ? "bullish" : "bearish");
      if (volatility === "expansion" && previous?.volatility !== "expansion") emit("expansion", "neutral");
      if (workflow?.breakoutCount != null && finite(volumes.values[index]) && volumes.values[index]! >= config.rvolThreshold) {
        emit("volume-confirmed", workflow.direction === "upper" ? "bullish" : "bearish", 3); workflow = null;
      }
      barEvents.push(...(patternByIndex.get(index) ?? []));
    }
    const flow = options.market === "US" ? missingFlow : options.flowByDate?.[bar.date] ?? missingFlow;
    const rsiSlope = finite(rsis[index]) && previousCompleted != null && finite(rsis[previousCompleted]) ? rsis[index]! - rsis[previousCompleted]! : null;
    const riskReward = causalRiskReward(closes[index], bands.lower[index], bands.upper[index], breakout, swings[index]!);
    const partialPoint = { trend, volatility, percentB: pbs[index]!, rsi: rsis[index]!, rsiSlope, breakout, failedBreakout, bandWalk: walk };
    const point: BollingerPoint = {
      date: bar.date, index, completed, upper: bands.upper[index]!, middle: bands.mid[index]!, lower: bands.lower[index]!,
      percentB: pbs[index]!, bbw: widths[index]!, bbwPercentile: ranks[index]!.percentile,
      bbwMin: ranks[index]!.min, bbwMax: ranks[index]!.max, bbwSamples: ranks[index]!.samples,
      trend, volatility, sma20: averages.sma20[index]!, sma60: averages.sma60[index]!, sma120: averages.sma120[index]!, sma200: averages.sma200[index]!,
      rsi: rsis[index]!, rsiSlope, rvol: volumes.values[index]!, rvolMethod: volumes.methods[index]!, breakout, failedBreakout, bandWalk: walk,
      setup: classifySetup(partialPoint), flow, riskReward, events: barEvents,
      quality: scoreSetupQuality({ ...partialPoint, flow, riskReward, rvol: volumes.values[index], close: closes[index],
        sma20: averages.sma20[index], sma60: averages.sma60[index], sma120: averages.sma120[index], sma200: averages.sma200[index],
        bbw: widths[index], bbwPercentile: ranks[index]!.percentile }, config.rvolThreshold),
    };
    points.push(point); events.push(...barEvents);
    if (completed) previousCompleted = index;
  }
  return { points, events, warmupRequired: Math.max(200 + config.slopeLookback, config.period + config.bbwLookback - 1,
    config.rsiPeriod + 1, config.rvolPeriod, config.pivotLeft + config.pivotRight + 1) };
}
