import type { MarketCoverageStatus } from "./market-freshness";

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
}) {
  const state = value.status === "closed" ? "최근 거래일"
    : value.status === "fresh" ? "거래 기준"
      : value.status === "partial" ? "일부 확인"
        : value.status === "stale" ? "이전 자료 제외" : "확인 불가";
  return `${state} · ${formatMarketAsOf(value.asOf)} · 유효 ${value.count}${value.expectedCount == null ? "" : `/${value.expectedCount}`}종목`;
}
