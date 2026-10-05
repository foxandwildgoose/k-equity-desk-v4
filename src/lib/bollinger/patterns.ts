import { classifySwingDivergence, findPivots } from "../chart-indicators.ts";
import type { BollingerBar, BollingerEvent, BollingerSystemSettings } from "./types.ts";

type SwingSide = "low" | "high";
type ConfirmedPivot = { side: SwingSide; index: number; confirmedIndex: number };
type PendingPattern = { side: SwingSide; firstIndex: number; pivotIndex: number; setupIndex: number; reaction: number; invalidation: number };
export type ConfirmedSwingLevels = { high: number | null; low: number | null };

function usableBar(bar: BollingerBar | undefined): boolean {
  // Missing completion metadata is unknown, rather than permission to issue a historical alert.
  return !!bar && bar.completed === true && [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite)
    && bar.high >= bar.low && bar.high >= Math.max(bar.open, bar.close) && bar.low <= Math.min(bar.open, bar.close);
}

function pivotSizes(left: number, right: number): { left: number; right: number } | null {
  if (!Number.isInteger(left) || !Number.isInteger(right) || left < 1 || right < 1) return null;
  return { left, right };
}

/** Existing pivot comparison/tie semantics; every bar in the confirmation window must be explicitly completed and valid. */
function confirmedPivots(bars: readonly BollingerBar[], left: number, right: number): ConfirmedPivot[] {
  if (!pivotSizes(left, right)) return [];
  const pivots = findPivots(bars.map(bar => bar.high), bars.map(bar => bar.low), left, right);
  // Prefix counts avoid rechecking every confirmation window when many plateau pivots exist.
  const invalid = [0];
  for (let i = 0; i < bars.length; i++) invalid.push(invalid[i]! + (usableBar(bars[i]) ? 0 : 1));
  const accepted = (index: number) => invalid[index + right + 1] === invalid[index - left];
  return [
    ...pivots.lowIdx.filter(accepted).map(index => ({ side: "low" as const, index, confirmedIndex: index + right })),
    ...pivots.highIdx.filter(accepted).map(index => ({ side: "high" as const, index, confirmedIndex: index + right })),
  ].sort((a, b) => a.confirmedIndex - b.confirmedIndex || (a.side === "low" ? -1 : 1));
}

/** Causal O(n) history after the shared pivot scan; no repeated whole-prefix scans for risk/reward. */
export function confirmedSwingLevelHistory(bars: readonly BollingerBar[], left: number, right: number): ConfirmedSwingLevels[] {
  const pivots = confirmedPivots(bars, left, right);
  const out: ConfirmedSwingLevels[] = [];
  let next = 0;
  let high: number | null = null;
  let low: number | null = null;
  for (let i = 0; i < bars.length; i++) {
    while (pivots[next]?.confirmedIndex === i) {
      const pivot = pivots[next++]!;
      if (pivot.side === "high") high = bars[pivot.index]!.high;
      else low = bars[pivot.index]!.low;
    }
    out.push({ high, low });
  }
  return out;
}

export function confirmedSwingLevels(bars: readonly BollingerBar[], left: number, right: number, asOfIndex = bars.length - 1): ConfirmedSwingLevels {
  if (!Number.isInteger(asOfIndex) || asOfIndex < 0) return { high: null, low: null };
  return confirmedSwingLevelHistory(bars.slice(0, asOfIndex + 1), left, right).at(-1) ?? { high: null, low: null };
}

function finitePercentB(values: readonly (number | null)[], index: number): number | null {
  const value = values[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function event(type: BollingerEvent["type"], bars: readonly BollingerBar[], index: number, firstIndex: number, pivotIndex: number): BollingerEvent {
  const bullish = type === "bullish-divergence" || type.startsWith("w-");
  return {
    type, index, date: bars[index]!.date, direction: bullish ? "bullish" : "bearish",
    id: `${type}:${bars[firstIndex]!.date}:${bars[pivotIndex]!.date}`,
    pivotIndex, pivotDate: bars[pivotIndex]!.date,
    stage: type.endsWith("-confirmed") ? 2 : 1,
  };
}

/**
 * Systematic app heuristic, not an official Bollinger trading rule or a buy/sell recommendation.
 * Adjacent confirmed swings must retest within patternTolerance (a relative price fraction).
 * The first close %B is near/outside the outer band by that same dimensionless margin;
 * the second has strictly stronger %B. An inside-band second swing is preferable, not mandatory.
 * A later completed close crossing the observed reaction extreme confirms the structure.
 * Events use the knowledge/confirmation bar; the original pivot is separate metadata.
 */
export function computeBollingerPatterns(
  bars: readonly BollingerBar[], percentB: readonly (number | null)[], config: BollingerSystemSettings,
): BollingerEvent[] {
  const { pivotLeft: left, pivotRight: right, patternMaxBars: maxBars, patternTolerance: tolerance } = config;
  if (!pivotSizes(left, right) || !Number.isInteger(maxBars) || maxBars < 1 || !Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1) return [];
  const pivots = confirmedPivots(bars, left, right);
  const events: BollingerEvent[] = [];
  const emitted = new Set<string>();
  const previous: Record<SwingSide, number | null> = { low: null, high: null };
  const pending: Record<SwingSide, PendingPattern | null> = { low: null, high: null };
  const emit = (item: BollingerEvent) => { if (!emitted.has(item.id)) { emitted.add(item.id); events.push(item); } };
  let next = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!;
    if (!usableBar(bar)) {
      // A missing/unfinished observation cannot prove a reaction or structural break.
      previous.low = previous.high = null;
      pending.low = pending.high = null;
      continue;
    }
    for (const side of ["low", "high"] as const) {
      const active = pending[side];
      if (!active) continue;
      if (i - active.pivotIndex > maxBars || (side === "low" ? bar.low < active.invalidation : bar.high > active.invalidation)) {
        pending[side] = null;
        continue;
      }
      const prior = bars[i - 1];
      const crossed = usableBar(prior) && (side === "low"
        ? bar.close > active.reaction && prior!.close <= active.reaction
        : bar.close < active.reaction && prior!.close >= active.reaction);
      if (i > active.setupIndex && crossed) {
        emit(event(side === "low" ? "w-confirmed" : "m-confirmed", bars, i, active.firstIndex, active.pivotIndex));
        pending[side] = null;
      }
    }

    while (pivots[next]?.confirmedIndex === i) {
      const pivot = pivots[next++]!;
      const { side, index } = pivot;
      const firstIndex = previous[side];
      previous[side] = index;
      if (firstIndex === null || index - firstIndex > maxBars || index - firstIndex <= Math.max(left, right)) continue;
      const firstB = finitePercentB(percentB, firstIndex);
      const secondB = finitePercentB(percentB, index);
      if (firstB === null || secondB === null) continue;
      const firstPrice = side === "low" ? bars[firstIndex]!.low : bars[firstIndex]!.high;
      const secondPrice = side === "low" ? bars[index]!.low : bars[index]!.high;
      const divergence = classifySwingDivergence(side, firstPrice, secondPrice, firstB, secondB);
      if (divergence === "regular-bullish" || divergence === "regular-bearish") {
        emit(event(divergence === "regular-bullish" ? "bullish-divergence" : "bearish-divergence", bars, i, firstIndex, index));
      }
      const nearBand = side === "low" ? firstB <= tolerance : firstB >= 1 - tolerance;
      const stronger = side === "low" ? secondB > firstB : secondB < firstB;
      const retest = firstPrice !== 0 && Math.abs(secondPrice - firstPrice) / Math.abs(firstPrice) <= tolerance;
      if (!nearBand || !stronger || !retest) continue;
      let reaction = side === "low" ? -Infinity : Infinity;
      let excursion = false;
      let complete = true;
      for (let k = firstIndex + 1; k < index; k++) {
        const between = bars[k]!;
        if (!usableBar(between)) { complete = false; break; }
        reaction = side === "low" ? Math.max(reaction, between.high) : Math.min(reaction, between.low);
        // Equal adjacent plateau extrema are not two distinct swings.
        excursion ||= side === "low" ? between.low > Math.max(firstPrice, secondPrice) : between.high < Math.min(firstPrice, secondPrice);
      }
      if (!complete || !excursion || !Number.isFinite(reaction)) continue;
      emit(event(side === "low" ? "w-setup" : "m-setup", bars, i, firstIndex, index));
      pending[side] = {
        side, firstIndex, pivotIndex: index, setupIndex: i, reaction,
        invalidation: side === "low" ? Math.min(firstPrice, secondPrice) : Math.max(firstPrice, secondPrice),
      };
    }
  }
  return events;
}
