import { sma } from "../chart-indicators.ts";
import type { IndicatorInstance } from "./catalog.ts";

export const STANDARD_SMA_PERIODS = [5, 20, 60, 120, 200] as const;
export type StandardSmaPeriod = typeof STANDARD_SMA_PERIODS[number];
export type SmaThemeMode = "light" | "dark";

/** Semantic defaults, never a persisted theme-specific hex. LWC accepts integer widths. */
const STYLES = {
  5: { light: "#B8860B", dark: "#FFD54F", width: 1, visualWidth: 1.5 },
  20: { light: "#A23B8F", dark: "#E07BCB", width: 2, visualWidth: 1.8 },
  60: { light: "#00796B", dark: "#35D0A0", width: 2, visualWidth: 1.9 },
  120: { light: "#1565C0", dark: "#42A5F5", width: 2, visualWidth: 2 },
  200: { light: "#C62828", dark: "#FF5C5C", width: 3, visualWidth: 2.5 },
} as const;

export function isStandardSmaPeriod(period: number): period is StandardSmaPeriod {
  return STANDARD_SMA_PERIODS.some(p => p === period);
}

export function getStandardSmaStyle(period: StandardSmaPeriod, mode: SmaThemeMode) {
  const style = STYLES[period];
  return { color: style[mode], lineWidth: style.width, visualWidth: style.visualWidth };
}

export function standardSmaInstance(period: StandardSmaPeriod): IndicatorInstance {
  return { uid: `sma-standard-${period}`, id: "sma", params: { period }, visible: true, colorMode: "theme" };
}

/** Preserve every existing instance, including OFF/custom colors and custom SMA periods.
 * Legacy colors have no provenance: retain them rather than guessing user intent. */
export function migrateStandardSmas(indicators: readonly IndicatorInstance[]): IndicatorInstance[] {
  const result = indicators.map(i => ({ ...i }));
  for (const period of STANDARD_SMA_PERIODS) {
    if (result.some(i => i.id === "sma" && Number(i.params?.period) === period)) continue;
    const instance = standardSmaInstance(period);
    const ids = new Set(result.map(i => i.uid));
    while (ids.has(instance.uid)) instance.uid += "-bundle";
    result.push(instance);
  }
  return result;
}

export function toggleStandardSma(indicators: readonly IndicatorInstance[], period: StandardSmaPeriod): IndicatorInstance[] {
  const matches = indicators.filter(i => i.id === "sma" && Number(i.params?.period) === period);
  if (!matches.length) return [...indicators, standardSmaInstance(period)];
  const visible = !matches.some(i => i.visible);
  return indicators.map(i => matches.some(m => m.uid === i.uid) ? { ...i, visible } : i);
}

export function resolveSmaStyle(instance: IndicatorInstance, mode: SmaThemeMode) {
  const period = Number(instance.params?.period);
  if (instance.id !== "sma" || !isStandardSmaPeriod(period)) return null;
  const style = getStandardSmaStyle(period, mode);
  return { ...style, color: instance.colorMode !== "theme" && instance.color ? instance.color : style.color };
}

export interface SmaPoint { time: string | number; value: number | null }

/** Calculation history is the same timeframe/price basis. Displayed corrections win;
 * future bars are excluded before computation, including replay. Retain pre-roll past
 * the 10,000 display cap without feeding pre-roll dates into the chart time scale. */
export function prepareSmaHistory<T extends { time: string | number }>(display: readonly T[], history: readonly T[] = [], preRoll = 499): T[] {
  if (!display.length) return [];
  const last = display.at(-1)!.time;
  const rows = new Map<string | number, T>();
  for (const row of history) if (typeof row.time === typeof last && row.time <= last) rows.set(row.time, row);
  for (const row of display) rows.set(row.time, row);
  const sorted = [...rows.values()].sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0);
  const first = sorted.findIndex(row => row.time === display[0]!.time);
  return sorted.slice(Math.max(0, first - preRoll));
}

export function alignSmaValues(history: readonly { time: string | number }[], values: readonly (number | null)[], display: readonly { time: string | number }[]): (number | null)[] {
  const indexed = new Map(history.map((row, i) => [row.time, values[i] ?? null]));
  return display.map(row => indexed.get(row.time) ?? null);
}

/** All families reuse the O(n) calculator. Missing observations rewarm; never zero fill. */
export function standardSmaValues(display: readonly SmaPoint[], history: readonly SmaPoint[] = []): Record<StandardSmaPeriod, (number | null)[]> {
  const calculation = prepareSmaHistory(display, history);
  const values = calculation.map(p => p.value ?? NaN);
  return Object.fromEntries(STANDARD_SMA_PERIODS.map(period => [period, alignSmaValues(calculation, sma(values, period), display)])) as Record<StandardSmaPeriod, (number | null)[]>;
}

export function latestSmaPoint(points: readonly { time: string | number }[], values: readonly (number | null)[], visible: boolean): SmaPoint | null {
  if (!visible) return null;
  for (let i = points.length - 1; i >= 0; i--) {
    const value = values[i];
    if (value != null && Number.isFinite(value)) return { time: points[i]!.time, value };
  }
  return null;
}

/** Provider-supported same-interval requests. They may still return fewer than 200
 * bars (new listings, Yahoo intraday limits, short fallback histories). */
export function smaHistoryRange(interval: string, range?: string, minuteSize = 5): string {
  if (interval === "minute") return minuteSize <= 3 ? "7d" : minuteSize < 60 ? "60d" : "2y";
  if (interval === "week" || interval === "month" || interval === "year") return "max";
  if (range === "max" || range === "10y") return "max";
  return range === "5y" || !range ? "10y" : range === "2y" ? "5y" : "2y";
}

export interface SmaLabelPosition { period: StandardSmaPeriod; y: number; targetY: number }
/** Five labels fit without collision. Shrink spacing only in genuinely tiny panes. */
export function layoutSmaLabels(rows: readonly SmaLabelPosition[], height: number, top = 16, bottom = 16): SmaLabelPosition[] {
  if (!Number.isFinite(height) || height <= top + bottom) return [];
  const sorted = rows.filter(r => Number.isFinite(r.y)).map(r => ({ ...r })).sort((a, b) => a.y - b.y || a.period - b.period);
  const gap = Math.min(22, (height - top - bottom) / Math.max(1, sorted.length - 1));
  for (let i = 0; i < sorted.length; i++) sorted[i]!.y = Math.max(top, sorted[i]!.y, i ? sorted[i - 1]!.y + gap : top);
  for (let i = sorted.length - 1; i >= 0; i--) sorted[i]!.y = Math.min(height - bottom, sorted[i]!.y, i < sorted.length - 1 ? sorted[i + 1]!.y - gap : height - bottom);
  return sorted;
}
