import type { BollingerBar } from "./types.ts";
import { zonedWallToUnix } from "../charts/bar-time.ts";

/** Daily exchange labels, never server-local instants or mixed intraday strings. */
export function isDiscoveryDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.toISOString().slice(0, 10) === value;
}
export function discoveryDailyBars(input: readonly BollingerBar[]): BollingerBar[] {
  const completed = input.filter(b => b.completed === true);
  if (completed.some(b => !isDiscoveryDay(b.date))) throw new Error("INVALID_DAILY_DATE");
  return [...new Map(completed.map(b => [b.date, b])).values()]
    .sort((a, b) => a.date.localeCompare(b.date)); // ked-allow-string-date-sort: single-format time series
}
/** Conservative PIT cutoff: membership must be known BEFORE the signal's local
 * calendar day. This cannot admit an after-close release on an early-close day.
 * It may exclude a legitimate intraday announcement; no guessed holiday hours. */
export function membershipKnowledgeCutoff(day: string, market: "KR" | "US"): string {
  if (!isDiscoveryDay(day)) throw new Error("INVALID_DAILY_DATE");
  return new Date(zonedWallToUnix(`${day} 00:00`,market==="KR"?"Asia/Seoul":"America/New_York")*1000).toISOString();
}
