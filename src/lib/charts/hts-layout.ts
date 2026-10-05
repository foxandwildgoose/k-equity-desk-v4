import { HTS_PANEL_ORDER, type HtsPanel } from "./hts-settings.ts";
import { FLOW_STATUS_LABELS, KIWOOM_HEALTH_LABELS, type AlignedFlowMetric, type AlignedFlowPoint, type FlowMetric, type FlowObservation } from "./hts-flow.ts";

/** Extra oscillators preserve the six required panes' relative order; volume stays last. */
export function htsPaneIndices(extraCount = 0): Record<HtsPanel, number> {
  return { rsi: 0, price: 1, credit: 2, foreign: 3, investmentTrust: 4, volume: 5 + (Number.isFinite(extraCount) ? Math.max(0, Math.floor(extraCount)) : 0) };
}

/** All DOM pointer coordinates must be translated into the actual price pane. */
export function pricePanePoint(x: number, y: number, bounds: { left: number; top: number; width: number; height: number }): { x: number; y: number } | null {
  const px = x - bounds.left;
  const py = y - bounds.top;
  return Number.isFinite(px) && Number.isFinite(py) && px >= 0 && px < bounds.width && py >= 0 && py < bounds.height ? { x: px, y: py } : null;
}

/** The date attached to a weekly/monthly candle can be its first session. */
export function periodEndDay(day: string, interval: string): string {
  if (interval !== "week" && interval !== "month" && interval !== "year") return day;
  const d = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return day.slice(0, 10);
  if (interval === "week") d.setUTCDate(d.getUTCDate() + (7 - d.getUTCDay()) % 7);
  if (interval === "month") d.setUTCMonth(d.getUTCMonth() + 1, 0);
  if (interval === "year") d.setUTCMonth(11, 31);
  return d.toISOString().slice(0, 10);
}

/** Price-axis zoom deliberately is not an input: it cannot change bins or denominator. */
export function profileRangeBars<T extends { date: string }>(bars: readonly T[], options: {
  mode: "visible" | "fixed" | "all";
  visibleFrom?: string;
  visibleTo?: string;
  fixedFrom?: string;
  fixedTo?: string;
  replayTo?: string;
}): T[] {
  const from = options.mode === "visible" ? options.visibleFrom : options.mode === "fixed" ? options.fixedFrom : undefined;
  const to = options.mode === "visible" ? options.visibleTo : options.mode === "fixed" ? options.fixedTo : undefined;
  if (options.mode === "fixed" && (!from || !to)) return [];
  const lower = from ? htsTimestamp(from) : -Infinity;
  const upper = to ? htsTimestamp(to, true) : Infinity;
  const replayEnd = options.replayTo ? htsTimestamp(options.replayTo, true) : Infinity;
  if (lower == null || upper == null || replayEnd == null || lower > upper) return [];
  return bars.filter((bar) => {
    const time = htsTimestamp(bar.date);
    return time != null && time >= lower && time <= upper && time <= replayEnd;
  });
}

/**
 * Keep intraday precision, accepting the providers' space/T timestamp formats.
 * Unzoned timestamps retain provider wall-clock semantics, independent of the
 * browser timezone. Zoned timestamps compare by instant. A date-only upper
 * bound means the entire day; an intraday upper bound is that exact instant.
 */
function htsTimestamp(value: string, endOfDay = false): number | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)(Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
  if (!match) return null;
  const day = Date.parse(`${match[1]}T00:00:00Z`);
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== match[1]) return null;
  if (!match[2]) return day + (endOfDay ? 86_399_999 : 0);
  const [hour, minute, second = "0"] = match[2].split(":");
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) >= 60) return null;
  const time = Date.parse(`${match[1]}T${match[2]}${match[3] ?? "Z"}`);
  return Number.isFinite(time) ? time : null;
}

/**
 * Calculate once over the loaded history, then select points for display.
 * Replay/display bars override matching history bars so a partially replayed
 * weekly/monthly candle cannot inherit its future final close or volume.
 * History is sorted and deduplicated, and never extends beyond the replay end.
 * Caller supplies history for the same instrument and interval.
 */
export function prepareHtsIndicatorHistory<T extends { date: string }>(bars: readonly T[], history: readonly T[] = bars): {
  history: T[];
  visibleIndices: (number | null)[];
} {
  const times = bars.map((bar) => htsTimestamp(bar.date));
  const end = times.reduce<number>((latest, time) => time == null ? latest : Math.max(latest, time), -Infinity);
  const byTime = new Map<number, T>();
  for (const source of [history, bars]) {
    for (const bar of source) {
      const time = htsTimestamp(bar.date);
      if (time != null && time <= end) byTime.set(time, bar);
    }
  }
  const sorted = [...byTime].sort(([a], [b]) => a - b);
  const indices = new Map(sorted.map(([time], index) => [time, index]));
  return {
    history: sorted.map(([, bar]) => bar),
    visibleIndices: times.map((time) => time == null ? null : indices.get(time) ?? null),
  };
}

/** A missing quantity breaks the SMA window; a genuine reported zero does not. */
export function htsVolumeAverage(bars: readonly { volume: number; volumeValid?: boolean }[], period: number): (number | null)[] {
  const values: (number | null)[] = new Array(bars.length).fill(null);
  if (!Number.isSafeInteger(period) || period < 1) return values;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!;
    if (bar.volumeValid === false || !Number.isFinite(bar.volume) || bar.volume < 0) {
      sum = 0;
      count = 0;
      continue;
    }
    sum += bar.volume / period;
    if (count >= period) sum -= bars[i - period]!.volume / period;
    count++;
    if (count >= period && Number.isFinite(sum)) values[i] = sum;
  }
  return values;
}

/** Native chart whitespace omits points but joins lines across the omission.
 * Use separate series for these inclusive contiguous runs to show actual gaps.
 * Zero and signed observations remain data; missing/non-finite values split.
 */
export function contiguousHtsLineRuns(values: readonly (number | null | undefined)[]): { from: number; to: number }[] {
  const runs: { from: number; to: number }[] = [];
  let start: number | null = null;
  for (let i = 0; i <= values.length; i++) {
    const value = values[i];
    if (value != null && Number.isFinite(value)) {
      if (start == null) start = i;
    } else if (start != null) {
      runs.push({ from: start, to: i - 1 });
      start = null;
    }
  }
  return runs;
}

/** Persist native stretch factors, never viewport pixel heights. */
export function changedHtsPanelHeights(
  saved: Record<HtsPanel, number>,
  collapsed: Record<HtsPanel, boolean>,
  before: Partial<Record<HtsPanel, number>>,
  after: Partial<Record<HtsPanel, number>>,
): Record<HtsPanel, number> | null {
  const next = { ...saved };
  let changed = false;
  for (const id of HTS_PANEL_ORDER) {
    const oldValue = before[id];
    const value = after[id];
    if (collapsed[id] || oldValue == null || value == null || !Number.isFinite(oldValue) || !Number.isFinite(value) || value <= 0 || Math.abs(value - oldValue) < 1e-6) continue;
    // Match the saved-settings limits so reload cannot silently change a drag.
    const persisted = Math.round(Math.max(id === "price" ? 180 : 48, Math.min(1200, value)));
    if (persisted !== saved[id]) { next[id] = persisted; changed = true; }
  }
  return changed ? next : null;
}

/** Summary fallback never changes the chart's dated points or a historical hover. */
export function htsFlowSummaryPoint(metric: FlowMetric, aligned: AlignedFlowMetric, date: string, hovering: boolean, daily = true): AlignedFlowPoint | undefined {
  const exact = aligned.points.find(point => point.date === date);
  if (hovering || exact?.value != null || !["available", "partial"].includes(aligned.capability)) return exact;
  const real = (rows: FlowObservation[]) => rows.length > 0 && rows.every(row => row.provider === "kiwoom" && row.environment === "real");
  const previous = aligned.points.filter(point => point.date <= date && point.value != null && real(point.observations)).at(-1);
  if (previous) return { ...previous, reason: `최신 가격일 ${date} 자료 미공표/미수집 · 최근 실제 관측값` };
  // Daily raw quantities/ratios can be summarized even if that provider date is
  // absent from price bars. Cumulative/period sums must retain their coverage rules.
  if (daily) {
    const row = metric.observations.filter(row => row.date <= date && row.value != null && real([row])).at(-1);
    if (row) return { date: row.date, value: row.value, asOf: row.asOf, observations: [row], partial: true,
      reason: `최신 가격일 ${date} 자료 미공표/미수집 · 최근 실제 관측값` };
  }
  return exact;
}

/** A hovered missing observation cannot inherit the provider's latest as-of. */
export function htsFlowPointDetails(metric: FlowMetric, aligned: AlignedFlowMetric, point: AlignedFlowPoint | undefined, fetchedAt: string, stale: boolean): {
  capability: FlowMetric["capability"]; status: string; asOf: string; fetchedAt: string; dateBasis: string; final: string;
} {
  const unavailable = aligned.capability !== "available" && aligned.capability !== "partial";
  const reason = unavailable
    ? aligned.reason || metric.reason || point?.reason || "데이터 미확인"
    // Coverage at the hovered date must not hide an actionable collection/API
    // reason for the metric, including when valid older observations remain.
    : [...new Set([point?.reason, aligned.reason, metric.reason].filter(Boolean))].join(" · ");
  const observations = point?.observations ?? [];
  const basisNames = { "trade-date": "거래일", "settlement-date": "결제일", "publication-date": "공표일", unknown: "미확인" };
  const dateBasis = [...new Set(observations.map((observation) => basisNames[observation.dateBasis]))].join("/") || "미확인";
  const acquisition = observations.reduce((latest, observation) =>
    Number.isFinite(Date.parse(observation.fetchedAt)) && (!latest || Date.parse(observation.fetchedAt) > Date.parse(latest)) ? observation.fetchedAt : latest, "") || fetchedAt || "미확인";
  const final = observations.length === 0 || observations.some((observation) => observation.final === null) ? "확정 여부 미확인"
    : observations.every((observation) => observation.final === true) ? "확정" : "잠정";
  const acquisitionLabel = observations.length ? "취득" : "조회";
  const capabilityNames = {
    available: "제공", partial: "일부 기간 제공", "not-configured": "설정 필요",
    "not-supported": "공급자 미지원", "not-applicable": "해당 없음", error: "요청 오류", unknown: "확인 중",
  };
  return {
    capability: aligned.capability,
    status: [metric.health ? KIWOOM_HEALTH_LABELS[metric.health] : capabilityNames[aligned.capability], metric.health ? "" : metric.status ? FLOW_STATUS_LABELS[metric.status] : "", reason, (metric.stale ?? stale) ? "오래된 데이터" : "", `최종 관측 ${metric.providedTo ?? "미확인"}`, `확보 ${metric.providedFrom ?? "—"}~${metric.providedTo ?? "—"}`, `${acquisitionLabel} ${acquisition}`, `기준 ${dateBasis}`, final].filter(Boolean).join(" · "),
    asOf: point?.asOf || "미확인", fetchedAt: acquisition, dateBasis, final,
  };
}
