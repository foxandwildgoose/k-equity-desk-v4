import { providerQuoteTime, type MarketCoverageStatus, type TimedMarketQuote } from "./market-freshness.ts";

const KST_OFFSET_MS = 9 * 60 * 60_000;

/**
 * Presentation evidence only. A dated PREOPEN price does not establish a daily
 * return or replace the previous regular session's closing observation.
 */
export function preopenMarketSnapshot(input: readonly TimedMarketQuote[], now: number) {
  if (!Number.isFinite(now)) return null;
  const local = new Date(now + KST_OFFSET_MS);
  if ([0, 6].includes(local.getUTCDay()) || local.getUTCHours() >= 9) return null;
  const date = local.toISOString().slice(0, 10);
  let latest: number | null = null;
  let count = 0;
  for (const quote of input) {
    if (!quote.code || !Number.isFinite(quote.price) || quote.price <= 0 ||
      !["PRE", "PREOPEN"].includes((quote.marketStatus ?? "").toUpperCase())) continue;
    const at = providerQuoteTime(quote.tradedAt);
    if (at == null || at > now + 60_000 || new Date(at + KST_OFFSET_MS).toISOString().slice(0, 10) !== date) continue;
    count++;
    latest = latest == null ? at : Math.max(latest, at);
  }
  return latest == null ? null : { count, asOf: new Date(latest).toISOString() };
}

const marketTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
});

export function formatMarketAsOf(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "기준 시각 미확인";
  return marketTime.format(new Date(value));
}

export function coverageLabel(value: {
  count: number; expectedCount?: number; status: MarketCoverageStatus;
  asOf: string | null; staleCount?: number; missingTimeCount?: number;
  all?: readonly TimedMarketQuote[];
}, now = Date.now()) {
  const preopen = value.count === 0 ? preopenMarketSnapshot(value.all ?? [], now) : null;
  if (preopen) return `장전 집계 대기 · 스냅샷 ${formatMarketAsOf(preopen.asOf)} · 수신 ${preopen.count}${value.expectedCount == null ? "" : `/${value.expectedCount}`}종목`;
  const state = value.status === "closed" ? "최근 거래일"
    : value.status === "fresh" ? "거래 기준"
      : value.status === "partial" ? "일부 확인"
        : value.status === "stale" ? "이전 자료 제외" : "확인 불가";
  return `${state} · ${formatMarketAsOf(value.asOf)} · 유효 ${value.count}${value.expectedCount == null ? "" : `/${value.expectedCount}`}종목`;
}
