import { XMLParser, XMLValidator } from "fast-xml-parser";

export type MacroPoint = { date: string; value: number };

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1_000;

/** Calendar month in Korea; the server's local time zone must not affect cutoffs. */
export function koreaMonth(now = new Date()): string {
  return new Date(now.getTime() + SEOUL_OFFSET_MS).toISOString().slice(0, 7);
}

export function previousCompletedMonth(now = new Date()): string {
  const [year, month] = koreaMonth(now).split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 2, 1)).toISOString().slice(0, 7);
}

function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/**
 * A monthly bar's date is its provider label, not necessarily its last trading
 * day. Preserve that label and exclude the still-open Korean calendar month.
 * Missing months stay missing; a spot quote cannot supply a historical close.
 */
export function completedMonthlyPoints(
  points: readonly MacroPoint[],
  now = new Date(),
): MacroPoint[] {
  const cutoff = koreaMonth(now);
  const byDate = new Map<string, number>();
  const conflicts = new Set<string>();
  for (const point of points) {
    if (
      !validDate(point.date) ||
      point.date.slice(0, 7) >= cutoff ||
      !Number.isFinite(point.value) ||
      point.value <= 0
    )
      continue;
    if (byDate.has(point.date) && byDate.get(point.date) !== point.value)
      conflicts.add(point.date.slice(0, 7));
    byDate.set(point.date, point.value);
  }
  const byMonth = new Map<string, MacroPoint>();
  for (const [date, value] of byDate) {
    const month = date.slice(0, 7);
    if (conflicts.has(month)) continue;
    const previous = byMonth.get(month);
    if (!previous || date > previous.date) byMonth.set(month, { date, value });
  }
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date)); // ked-allow-string-date-sort: single-format time series; validated ISO calendar dates
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Naver fchart uses the requested security's own chartdata symbol. */
export function parseNaverMonthly(
  xml: string,
  expectedSymbol: string,
  now = new Date(),
): MacroPoint[] {
  if (
    xml.length > 2_000_000 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    return [];
  let payload: unknown;
  try {
    payload = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
      parseAttributeValue: false,
      processEntities: false,
    }).parse(xml);
  } catch {
    return [];
  }
  const protocol = record(record(payload)?.protocol);
  const chart = record(protocol?.chartdata);
  if (chart?.["@_symbol"] !== expectedSymbol) return [];
  const items = Array.isArray(chart.item) ? chart.item : chart.item ? [chart.item] : [];
  const points: MacroPoint[] = [];
  for (const item of items) {
    const data = record(item)?.["@_data"];
    if (typeof data !== "string") continue;
    const parts = data.split("|");
    const ymd = parts[0] ?? "";
    const close = parts[4]?.trim();
    if (!/^\d{8}$/.test(ymd) || !close || !/^\d+(?:\.\d+)?$/.test(close)) continue;
    points.push({
      date: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
      value: Number(close),
    });
  }
  return completedMonthlyPoints(points, now);
}

function providerDate(timestamp: number, timeZone: string): string | null {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const date = new Date(timestamp * 1_000);
  if (!Number.isFinite(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value;
    const result = `${get("year")}-${get("month")}-${get("day")}`;
    return validDate(result) ? result : null;
  } catch {
    return null;
  }
}

/** Verify instrument identity before accepting a Yahoo monthly close. */
export function parseYahooMonthly(
  payload: unknown,
  expectedSymbol: string,
  now = new Date(),
): MacroPoint[] {
  const chart = record(record(payload)?.chart);
  if (!chart || chart.error) return [];
  const result = Array.isArray(chart.result) ? record(chart.result[0]) : null;
  const meta = record(result?.meta);
  if (
    !result ||
    meta?.symbol !== expectedSymbol ||
    (typeof meta.currency === "string" && meta.currency !== "KRW")
  )
    return [];
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const indicators = record(result.indicators);
  const quote = Array.isArray(indicators?.quote) ? record(indicators.quote[0]) : null;
  const closes = Array.isArray(quote?.close) ? quote.close : [];
  // Yahoo publishes its exchange time zone. Use the known instrument zone only
  // when that metadata is absent; never reinterpret a supplied invalid zone.
  const timeZone =
    typeof meta.exchangeTimezoneName === "string"
      ? meta.exchangeTimezoneName
      : expectedSymbol === "^KS11" || /^\w+\.K[QS]$/.test(expectedSymbol)
        ? "Asia/Seoul"
        : "UTC";
  const points: MacroPoint[] = [];
  for (let index = 0; index < timestamps.length; index++) {
    const timestamp = timestamps[index];
    const value = closes[index];
    if (
      typeof timestamp !== "number" ||
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value <= 0
    )
      continue;
    const date = providerDate(timestamp, timeZone);
    if (date) points.push({ date, value });
  }
  return completedMonthlyPoints(points, now);
}

/** Known Naver exchange endpoint; this quote is never used as FX history. */
export function parseNaverSpotUsdKrw(payload: unknown): number {
  const info = record(record(payload)?.exchangeInfo);
  const raw = info?.closePrice;
  if (typeof raw !== "number" && typeof raw !== "string") return 0;
  const text = String(raw).trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)) return 0;
  const value = Number(text.replace(/,/g, ""));
  return Number.isFinite(value) && value > 100 && value < 100_000 ? value : 0;
}
