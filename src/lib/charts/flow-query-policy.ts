import { FLOW_METRICS, isFlowDate, type FlowRequest, type FlowResponse } from "./hts-flow.ts";
import { periodEndDay } from "./hts-layout.ts";

export const FLOW_NORMAL_REFRESH_MS = 300_000;
export const FLOW_PENDING_REFRESH_MS = 15_000;
export const FLOW_PENDING_WINDOW_MS = 120_000;
export const FLOW_SLOW_PENDING_REFRESH_MS = 60_000;

/** This policy only repeats the existing market-read request, never a collection command. */
export function flowRefreshInterval(response: FlowResponse | undefined, elapsedMs: number): number | false {
  if (!response) return FLOW_NORMAL_REFRESH_MS;
  const metrics = FLOW_METRICS.map(id => response[id]);
  if (metrics.every(metric => metric.capability === "not-applicable" || metric.capability === "not-supported")) return false;
  // Direct mode has its own server throttle/token/IP checks. It must never acquire
  // the collector's fast read interval, including mixed or unknown responses.
  if (!metrics.every(metric => metric.diagnostics?.mode === "collector")) return FLOW_NORMAL_REFRESH_MS;
  const blocking = new Set(["DISABLED", "CREDENTIALS_MISSING", "OWNER_AUTH_FAILED", "DATABASE_MISSING", "DATABASE_SCHEMA_MISSING", "DATABASE_FAILED", "EXPECTED_IP_MISSING", "IP_MISMATCH", "IP_UNVERIFIED", "TOKEN_FAILED", "CONFIGURATION_FAILED", "DATA_SCOPE_MISMATCH", "PRODUCT_TYPE_UNKNOWN", "DEPLOYMENT_REVISION_MISMATCH", "RATE_LIMIT"]);
  if (metrics.some(metric => metric.health && blocking.has(metric.health))) return FLOW_NORMAL_REFRESH_MS;
  if (metrics.some(metric => metric.health === "TARGET_LIMIT_REACHED" || metric.diagnostics?.collectionState === "TARGET_LIMIT_REACHED")) return FLOW_SLOW_PENDING_REFRESH_MS;
  const pending = metrics.some(metric =>
    metric.health === "COLLECTION_QUEUED" || metric.health === "COLLECTING" ||
    metric.diagnostics?.collectionState === "COLLECTION_QUEUED" || metric.diagnostics?.collectionState === "COLLECTING" ||
    (metric.health === "PARTIAL" && (!metric.observations.length || Boolean(metric.diagnostics?.missingDates?.length))),
  );
  if (!pending) return metrics.some(metric => metric.health === "PARTIAL") ? FLOW_SLOW_PENDING_REFRESH_MS : FLOW_NORMAL_REFRESH_MS;
  return Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < FLOW_PENDING_WINDOW_MS
    ? FLOW_PENDING_REFRESH_MS : FLOW_SLOW_PENDING_REFRESH_MS;
}

export function koreaMarketDay(nowMs: number): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(nowMs));
}

/** Candle period ends are display labels, not evidence of future daily observations. */
export function makeChartFlowRequest(identity: Omit<FlowRequest, "from" | "to" | "expectedDailyDates" | "flowScope">, options: {
  priceDates: readonly string[];
  dailyPriceDates?: readonly string[];
  trustStartDate: string;
  currentDay: string;
}): FlowRequest {
  const days = (dates: readonly string[]) => [...new Set(dates.map(date => date.slice(0, 10)).filter(isFlowDate))].sort();
  const visible = days(options.priceDates);
  const daily = days(options.dailyPriceDates ?? (identity.interval === "day" ? options.priceDates : []));
  const first = visible[0] ?? "";
  const from = isFlowDate(options.trustStartDate) && first && options.trustStartDate < first ? options.trustStartDate : first;
  const periodEnd = visible.at(-1) ? periodEndDay(visible.at(-1)!, identity.interval).slice(0, 10) : "";
  const currentDay = isFlowDate(options.currentDay) ? options.currentDay : "";
  let to = periodEnd && currentDay ? periodEnd < currentDay ? periodEnd : currentDay : "";
  const actualLast = daily.filter(date => date <= to).at(-1);
  if (actualLast && ["week", "month", "year"].includes(identity.interval)) to = actualLast;
  const validRange = Boolean(from && to && from <= to);
  return {
    ...identity, from: validRange ? from : "", to: validRange ? to : "",
    flowScope: identity.exchange === "NXT" ? "NXT" : identity.exchange === "SOR" ? "SOR" : "KRX",
    expectedDailyDates: validRange ? daily.filter(date => date >= from && date <= to) : [],
  };
}
