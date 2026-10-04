/** Display-only chart event classification and grouping. Source items stay intact. */
import { parseSourceTime, zonedParts, zonedWallToUtcMs } from "../feed/time.ts";
import { dayOfTime } from "./bar-time.ts";

export type ChartEventCategory = "disclosures" | "research" | "targets" | "signals" | "news" | "dividends" | "splits";
export const CHART_EVENT_LABELS: Readonly<Record<ChartEventCategory, string>> = {
  disclosures: "공시", research: "리포트", targets: "목표가", signals: "신호", news: "뉴스", dividends: "배당", splits: "분할",
};
type EventTime = string | number;
type EventPosition = "aboveBar" | "belowBar";
type EventShape = "circle" | "arrowUp" | "arrowDown" | "square";

export interface ChartEventInput {
  time: EventTime;
  text?: string;
  position?: EventPosition;
  color?: string;
  shape?: EventShape;
  category?: ChartEventCategory;
  id?: string;
  subtype?: string;
  title?: string;
  source?: string;
  url?: string;
  publishedAt?: EventTime | null;
  /** Keep date-only publication precision even if a feed normalized it to ISO. */
  publicationPrecision?: "day" | "minute" | "second" | "unknown";
  /** Actual confirming candle, e.g. the five right-hand RSI pivot candles. */
  confirmedAt?: EventTime | null;
  originalTime?: EventTime;
}

export interface ChartEvent extends ChartEventInput {
  id: string;
  category: ChartEventCategory;
  title: string;
  text: string;
  position: EventPosition;
  shape: EventShape;
  color: string;
}

const EVENT_STYLES: Record<ChartEventCategory, { position: EventPosition; shape: EventShape; color: string }> = {
  disclosures: { position: "aboveBar", shape: "circle", color: "#f59e0b" },
  research: { position: "belowBar", shape: "square", color: "#94a3b8" },
  targets: { position: "belowBar", shape: "arrowUp", color: "#2dd4bf" },
  signals: { position: "aboveBar", shape: "circle", color: "#a78bfa" },
  news: { position: "aboveBar", shape: "circle", color: "#38bdf8" },
  dividends: { position: "belowBar", shape: "circle", color: "#22c55e" },
  splits: { position: "belowBar", shape: "square", color: "#eab308" },
};

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

function validTime(time: EventTime): boolean {
  if (typeof time === "number") return Number.isFinite(time) && time > 0;
  // Providers carry full calendar dates. Never infer the year of a partial date.
  return /^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(time) && parseSourceTime(time).iso !== null;
}

/** Display actual chart instants in the exchange zone, preserving date-only precision. */
export function formatChartEventTime(time: EventTime, market: "KR" | "US"): string {
  if (!validTime(time)) return "시각 미상";
  const zone = market === "US" ? "America/New_York" : "Asia/Seoul";
  const parsed = parseSourceTime(time, { zone });
  if (!parsed.iso || parsed.precision === "unknown") return "시각 미상";
  const pad = (value: number) => String(value).padStart(2, "0");
  if (parsed.precision === "day") return parsed.iso.slice(0, 10);
  const { y, m, d, h, mi, s } = zonedParts(Date.parse(parsed.iso), zone);
  const seconds = parsed.precision === "second" ? `:${pad(s)}` : "";
  return `${y}-${pad(m)}-${pad(d)} ${pad(h)}:${pad(mi)}${seconds} ${market === "US" ? "ET" : "KST"}`;
}

function originalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Explicit source category is the compatibility boundary; text never decides it. */
export function normalizeChartEvents(inputs: readonly ChartEventInput[], fallback: ChartEventCategory): ChartEvent[] {
  const events = new Map<string, ChartEvent>();
  for (const input of inputs) {
    if (!validTime(input.time)) continue;
    const category = input.category && Object.hasOwn(CHART_EVENT_LABELS, input.category) ? input.category : fallback;
    const style = EVENT_STYLES[category];
    const title = input.title?.trim() || input.text?.trim() || CHART_EVENT_LABELS[category];
    const key = input.id || stableHash(JSON.stringify([input.time, input.subtype, title, input.source, input.url, input.position]));
    const id = `${category}:${key}`;
    if (events.has(id)) continue;
    events.set(id, {
      ...input,
      id,
      category,
      title,
      text: input.text?.trim() || CHART_EVENT_LABELS[category],
      position: input.position === "aboveBar" || input.position === "belowBar" ? input.position : style.position,
      shape: input.shape && ["circle", "arrowUp", "arrowDown", "square"].includes(input.shape) ? input.shape : style.shape,
      color: input.color || style.color,
      url: originalUrl(input.url),
      originalTime: input.originalTime ?? input.time,
    });
  }
  return [...events.values()];
}

export const buildChartEvents = normalizeChartEvents;

/** The caller annotates prior same-broker targets from fetched documents. */
export function researchChartEvents(reports: readonly {
  researchId: number;
  date: string;
  title: string;
  broker: string;
  pdfUrl?: string;
  pageUrl: string;
  targetPrice?: number;
  prevTargetPrice?: number;
}[]): ChartEvent[] {
  const inputs: ChartEventInput[] = [];
  for (const report of reports) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(report.date)) continue;
    const metadata = { time: report.date.slice(0, 10), source: report.broker, url: report.pdfUrl ?? report.pageUrl, publishedAt: report.date, publicationPrecision: parseSourceTime(report.date).precision, position: "belowBar" as const };
    inputs.push({ ...metadata, category: "research", subtype: "report-publication", id: `report:${report.researchId}`, title: report.title, text: "리포트", shape: "square", color: "#94a3b8" });
    if (report.targetPrice === undefined || report.prevTargetPrice === undefined || !Number.isFinite(report.targetPrice) || !Number.isFinite(report.prevTargetPrice) || report.targetPrice <= 0 || report.prevTargetPrice <= 0 || report.targetPrice === report.prevTargetPrice) continue;
    const up = report.targetPrice > report.prevTargetPrice;
    inputs.push({ ...metadata, category: "targets", subtype: up ? "target-up" : "target-down", id: `target:${report.researchId}`, title: `${report.title} · 목표가 ${report.prevTargetPrice.toLocaleString("ko-KR")} → ${report.targetPrice.toLocaleString("ko-KR")}원`, text: up ? "TP↑" : "TP↓", shape: up ? "arrowUp" : "arrowDown", color: up ? "#2dd4bf" : "#fb7185" });
  }
  return buildChartEvents(inputs, "research");
}

function eventInstant(value: EventTime | null | undefined, market: "KR" | "US", allowDay = false, dayEnd = true): number | null {
  if (value == null || (typeof value === "string" && !/^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(value))) return null;
  const zone = market === "US" ? "America/New_York" : "Asia/Seoul";
  const parsed = parseSourceTime(value, { zone });
  if (!parsed.iso || parsed.precision === "unknown") return null;
  if (parsed.precision === "day") {
    if (!allowDay || typeof value !== "string") return null;
    const [y, m, d] = value.slice(0, 10).replaceAll(".", "-").replaceAll("/", "-").split("-").map(Number);
    return zonedWallToUtcMs(y!, m!, d!, dayEnd ? 23 : 0, dayEnd ? 59 : 0, dayEnd ? 59 : 0, zone) + (dayEnd ? 999 : 0);
  }
  const time = Date.parse(parsed.iso);
  return Number.isFinite(time) ? time : null;
}

/** Unknown publication time is never promoted to information known in replay. */
export function filterChartEvents(
  events: readonly ChartEvent[],
  overlays: Partial<Record<ChartEventCategory, boolean>>,
  replayCutoff?: EventTime,
  market: "KR" | "US" = "KR",
): ChartEvent[] {
  const cutoff = replayCutoff === undefined ? null : eventInstant(replayCutoff, market, true);
  if (replayCutoff !== undefined && cutoff === null) return [];
  return events.filter((event) => {
    if (overlays[event.category] !== true) return false;
    if (replayCutoff === undefined) return true;
    const publicEvent = event.category !== "signals";
    if (publicEvent && (event.publicationPrecision === "day" || event.publicationPrecision === "unknown")) return false;
    const available = eventInstant(publicEvent ? event.publishedAt : event.confirmedAt, market, !publicEvent);
    const occurrence = eventInstant(event.originalTime ?? event.time, market, true, false);
    return available !== null && available <= cutoff! && occurrence !== null && occurrence <= cutoff!;
  });
}

function periodKey(day: string, interval: "day" | "week" | "month" | "year" | "minute"): string {
  if (interval === "month") return day.slice(0, 7);
  if (interval === "year") return day.slice(0, 4);
  if (interval !== "week") return day;
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

function eventDay(time: EventTime, market: "KR" | "US"): string | null {
  if (!validTime(time)) return null;
  if (typeof time === "string" && /^\d{4}-\d{2}-\d{2}$/.test(time)) return time;
  const parsed = parseSourceTime(time, { zone: market === "US" ? "America/New_York" : "Asia/Seoul" });
  return parsed.iso ? dayOfTime(Date.parse(parsed.iso) / 1000, market) : null;
}

/** Attach to actual loaded candle times; retain original dates for group detail. */
export function alignChartEvents(events: readonly ChartEvent[], options: {
  times: readonly EventTime[];
  market: "KR" | "US";
  interval: "day" | "week" | "month" | "year" | "minute";
  /** Actual configured minute candle duration; absent means exact time only. */
  intervalSeconds?: number;
}): ChartEvent[] {
  const { times, market, interval } = options;
  const exact = new Set(times);
  const byPeriod = new Map<string, EventTime>();
  if (interval !== "minute") {
    for (const time of times) {
      const day = eventDay(time, market);
      if (day) byPeriod.set(periodKey(day, interval), time);
    }
  }
  const numericTimes = interval === "minute" ? times.filter((time): time is number => typeof time === "number").sort((a, b) => a - b) : [];
  const result: ChartEvent[] = [];
  for (const event of events) {
    if (interval === "minute" && event.category !== "signals" && (event.publicationPrecision === "day" || event.publicationPrecision === "unknown")) continue;
    let time: EventTime | undefined;
    if (exact.has(event.time)) time = event.time;
    else if (interval !== "minute") {
      const day = eventDay(event.originalTime ?? event.time, market);
      if (day) time = byPeriod.get(periodKey(day, interval));
    } else {
      const instant = eventInstant(event.originalTime ?? event.time, market);
      // A date-only event cannot become an invented intraday timestamp.
      if (instant !== null) {
        const sec = instant / 1000;
        const day = dayOfTime(sec, market);
        for (let i = numericTimes.length - 1; i >= 0; i--) {
          const bar = numericTimes[i]!;
          const duration = options.intervalSeconds;
          const matches = sec === bar || (duration !== undefined && Number.isFinite(duration) && duration > 0 && bar <= sec && sec < bar + duration);
          if (matches && dayOfTime(bar, market) === day) { time = bar; break; }
        }
      }
    }
    if (time !== undefined) result.push({ ...event, time, originalTime: event.originalTime ?? event.time });
  }
  const index = new Map(times.map((time, i) => [time, i]));
  return result.sort((a, b) => (index.get(a.time) ?? 0) - (index.get(b.time) ?? 0) || a.id.localeCompare(b.id));
}

export interface ChartEventGroup {
  id: string;
  time: EventTime;
  position: EventPosition;
  color: string;
  shape: EventShape;
  text: string;
  x: number;
  items: ChartEvent[];
  categoryCounts: Partial<Record<ChartEventCategory, number>>;
  from: EventTime;
  to: EventTime;
}

/** Native markers remain at most one per screen column and above/below side. */
export function groupScreenEvents(events: readonly ChartEvent[], coordinateOf: (time: EventTime) => number | null, options: {
  gapPx?: number;
  plotWidth?: number;
} = {}): ChartEventGroup[] {
  const gap = Number.isFinite(options.gapPx) ? Math.max(1, options.gapPx!) : 110;
  const seen = new Set<string>();
  const positioned = events.flatMap((event) => {
    if (seen.has(event.id)) return [];
    seen.add(event.id);
    const x = coordinateOf(event.time);
    return x !== null && Number.isFinite(x) && x >= 0 && (options.plotWidth === undefined || x < options.plotWidth) ? [{ event, x }] : [];
  }).sort((a, b) => a.x - b.x || a.event.id.localeCompare(b.event.id));
  const groups: ChartEventGroup[] = [];
  for (const position of ["aboveBar", "belowBar"] as const) {
    let current: ChartEventGroup | undefined;
    for (const { event, x } of positioned) {
      if (event.position !== position) continue;
      if (!current || x - current.x >= gap) {
        current = { id: "", time: event.time, position, color: event.color, shape: event.shape, text: "", x, items: [], categoryCounts: {}, from: event.originalTime ?? event.time, to: event.originalTime ?? event.time };
        groups.push(current);
      }
      current.items.push(event);
      current.categoryCounts[event.category] = (current.categoryCounts[event.category] ?? 0) + 1;
    }
  }
  for (const group of groups) {
    const categories = Object.keys(group.categoryCounts) as ChartEventCategory[];
    group.text = categories.length > 2 ? `주석 ${group.items.length} · ${categories.length}종` : categories.map((category) => `${CHART_EVENT_LABELS[category]} ${group.categoryCounts[category]}`).join(" · ");
    group.id = `event-${stableHash(JSON.stringify([group.position, group.items.map((event) => event.id).sort()]))}`;
    const originalTimes = group.items.map((item) => item.originalTime ?? item.time).sort((a, b) => String(a).localeCompare(String(b)));
    group.from = originalTimes[0]!;
    group.to = originalTimes.at(-1)!;
    if (group.items.length > 1) group.shape = "circle";
  }
  return groups.sort((a, b) => a.x - b.x || a.position.localeCompare(b.position));
}
