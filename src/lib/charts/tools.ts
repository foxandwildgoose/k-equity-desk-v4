/**
 * Chart helpers (pure): bar replay (F7.12), extended-hours + session breaks
 * (F7.13), compare percent-from-first-visible (F7.8), export names + CSV
 * (F7.2), bar cap (F7.15).
 */
import { zonedParts, type SourceZone } from "../feed/time.ts";

export const MAX_BARS = 10_000;

/** Keep the newest `MAX_BARS` bars (F7.15). */
export function capBars<T>(bars: readonly T[], max = MAX_BARS): T[] {
  return bars.length > max ? bars.slice(bars.length - max) : [...bars];
}

// ── Replay ────────────────────────────────────────────────────────────
export const REPLAY_SPEEDS = [1, 2, 3, 5, 10] as const;

/** Bars visible during replay: everything up to and including `cursor` — never later bars. */
export function replaySlice<T>(bars: readonly T[], cursor: number | null): T[] {
  if (cursor == null) return [...bars];
  const c = Math.max(0, Math.min(bars.length - 1, Math.floor(cursor)));
  return bars.slice(0, c + 1);
}

/** Next cursor after one tick; null when the replay reached the last bar. */
export function replayStep(cursor: number, total: number, steps = 1): number | null {
  const next = cursor + Math.max(1, Math.floor(steps));
  return next >= total - 1 ? null : next;
}

/** Tick interval for a speed multiplier (1× = 1 bar / second). */
export function replayTickMs(speed: number): number {
  return Math.round(1000 / Math.max(1, Math.min(10, speed)));
}

// ── Sessions ─────────────────────────────────────────────────────────
export interface SessionBar {
  /** unix seconds (intraday) or "YYYY-MM-DD" (daily). */
  time: number | string;
}

function minutesIn(sec: number, zone: SourceZone): { day: string; mins: number } {
  const p = zonedParts(sec * 1000, zone);
  return { day: `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`, mins: p.h * 60 + p.mi };
}

/**
 * Runs of bars outside the regular session (US 09:30–16:00 ET; KR 09:00–15:30
 * KST, i.e. NXT/after-hours). Only intraday bars that actually exist are
 * shaded — nothing is synthesized.
 */
export function extendedHoursRuns(bars: readonly SessionBar[], market: "KR" | "US"): { from: number; to: number }[] {
  const zone: SourceZone = market === "US" ? "America/New_York" : "Asia/Seoul";
  const [open, close] = market === "US" ? [9 * 60 + 30, 16 * 60] : [9 * 60, 15 * 60 + 30];
  const runs: { from: number; to: number }[] = [];
  let cur: { from: number; to: number } | null = null;
  for (const b of bars) {
    if (typeof b.time !== "number") return [];
    const { mins } = minutesIn(b.time, zone);
    const ext = mins < open || mins >= close;
    if (ext) {
      if (cur) cur.to = b.time;
      else cur = { from: b.time, to: b.time };
    } else if (cur) {
      runs.push(cur);
      cur = null;
    }
  }
  if (cur) runs.push(cur);
  return runs;
}

/** First bar time of each new trading day (intraday only). */
export function sessionBreaks(bars: readonly SessionBar[], market: "KR" | "US"): number[] {
  const zone: SourceZone = market === "US" ? "America/New_York" : "Asia/Seoul";
  const out: number[] = [];
  let prev: string | null = null;
  for (const b of bars) {
    if (typeof b.time !== "number") return [];
    const { day } = minutesIn(b.time, zone);
    if (prev != null && day !== prev) out.push(b.time);
    prev = day;
  }
  return out;
}

// ── Compare ──────────────────────────────────────────────────────────
/** Percent change of each value from the first finite value at/after `fromIndex` (AT-37). */
export function percentFromFirstVisible(values: readonly (number | null)[], fromIndex: number): (number | null)[] {
  let base: number | null = null;
  return values.map((v, i) => {
    if (i < fromIndex || v == null || !Number.isFinite(v)) return null;
    if (base == null) base = v;
    return base ? ((v - base) / base) * 100 : null;
  });
}

/** Align a compare series to base bar times (exact time match only; gaps stay null). */
export function alignByTime<T extends { time: string | number; close: number }>(baseTimes: readonly (string | number)[], other: readonly T[]): (number | null)[] {
  const map = new Map(other.map((b) => [b.time, b.close]));
  return baseTimes.map((t) => map.get(t) ?? null);
}

// ── Export ───────────────────────────────────────────────────────────
function stamp(now: number): string {
  const p = zonedParts(now, "Asia/Seoul");
  const z = (x: number) => String(x).padStart(2, "0");
  return `${p.y}${z(p.m)}${z(p.d)}-${z(p.h)}${z(p.mi)}`;
}

/** `ked-chart-{market}-{code}-{interval}-{YYYYMMDD-HHmm}.{ext}` (KST) — AT-41. */
export function chartExportName(market: "KR" | "US", code: string, interval: string, ext: "png" | "csv", now: number): string {
  const safe = (s: string) => s.replace(/[^0-9A-Za-z._-]/g, "");
  return `ked-chart-${market}-${safe(code.toUpperCase())}-${safe(interval)}-${stamp(now)}.${ext}`;
}

export interface CsvBar {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

function timeLabel(t: string | number): string {
  if (typeof t === "string") return t;
  const p = zonedParts(t * 1000, "Asia/Seoul");
  const z = (x: number) => String(x).padStart(2, "0");
  return `${p.y}-${z(p.m)}-${z(p.d)} ${z(p.h)}:${z(p.mi)} KST`;
}

/** CSV of the given (visible) bars with optional extra columns. */
export function barsToCsv(bars: readonly CsvBar[], extra: { name: string; values: readonly (number | null)[] }[] = []): string {
  const head = ["time", "open", "high", "low", "close", "volume", ...extra.map((e) => e.name)];
  const rows = bars.map((b, i) => [timeLabel(b.time), b.open, b.high, b.low, b.close, b.volume, ...extra.map((e) => e.values[i] ?? "")].join(","));
  return [head.join(","), ...rows].join("\n");
}

/** Visible index window from a logical range, clamped to the data. */
export function visibleWindow(total: number, range: { from: number; to: number } | null): { from: number; to: number } {
  if (!range || total === 0) return { from: 0, to: Math.max(0, total - 1) };
  return { from: Math.max(0, Math.ceil(range.from)), to: Math.min(total - 1, Math.floor(range.to)) };
}
