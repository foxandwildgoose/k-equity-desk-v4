import type { FlowResponse, FlowObservation } from "../charts/hts-flow.ts";
import { chartReplayInstant } from "../charts/hts-flow-export.ts";
import { periodEndDay } from "../charts/hts-layout.ts";
import type { FlowConfirmation } from "./types.ts";

/** Never borrow today's unknown publication time for a historical score.
 * The ownership feature is a 5-observed-session percentage-point change,
 * not foreign buying. Quantities are actual DAILY investment trust net buying.
 * A common market scope, real provider, known trade date and known publication
 * instant are required. No extra broker requests are issued by this adapter. */
export function bollingerFlowByDate(dates: readonly string[], flow: FlowResponse, options: {
  market: "KR" | "US"; interval: string; expectedDailyDates: readonly string[];
  nowMs?: number; priceMarketScope?: "KRX" | "NXT" | "SOR";
}): Record<string, FlowConfirmation> {
  const unavailable = (reason: string, availability: FlowConfirmation["availability"]): FlowConfirmation =>
    ({ availability, foreignOwnershipChange: null, investmentTrustNet: null, reason });
  if (options.market === "US" || options.interval === "minute") return Object.fromEntries(dates.map(date => [date,
    unavailable(options.market === "US" ? "국내 수급 정의 적용 대상 아님" : "일별 수급을 분봉 확인 신호로 사용하지 않음", "not-applicable")]));
  if ((flow.request.flowScope ?? "KRX") !== (options.priceMarketScope ?? "KRX")) {
    return Object.fromEntries(dates.map(date => [date, unavailable("가격 시장과 수급 시장 범위 불일치", "not-applicable")]));
  }
  const valid = (row: FlowObservation, field: string) => row.provider === "kiwoom" && row.environment === "real"
    && row.marketScope === (flow.request.flowScope ?? "KRX") && row.sourceField === field && row.dateBasis === "trade-date"
    && row.parsingStatus === "valid" && row.value != null && Number.isFinite(row.value) && row.availableAt != null
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(row.availableAt)
    && Number.isFinite(Date.parse(row.availableAt)) && row.final !== false;
  const sessions = [...new Set(options.expectedDailyDates)].sort();
  const foreignMap = new Map(flow.foreign.observations.filter(row => valid(row, "wght") && row.unit === "%" && row.value! >= 0 && row.value! <= 100).map(row => [row.date, row]));
  const trustMap = new Map(flow.investmentTrust.observations.filter(row => valid(row, "invtrt") && row.unit === flow.request.quantityUnit).map(row => [row.date, row]));
  const upperBound = (day: string) => {
    let lo = 0, hi = sessions.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (sessions[mid]! <= day) lo = mid + 1; else hi = mid; }
    return lo;
  };
  return Object.fromEntries(dates.map(date => {
    const end = periodEndDay(date.slice(0, 10), options.interval);
    const boundary = Math.min(Date.parse(chartReplayInstant(end, "KR")), options.nowMs ?? Date.now());
    const endIndex = upperBound(end);
    const lastSession = sessions[endIndex - 1];
    if (!lastSession) return [date, unavailable("거래일 관측 미확보", "unknown")];
    const known = (row: FlowObservation | undefined) => row?.availableAt != null && Date.parse(row.availableAt) <= boundary;
    const previousSession = sessions[endIndex - 6];
    const current = foreignMap.get(lastSession);
    const previous = previousSession ? foreignMap.get(previousSession) : undefined;
    const foreignOwnershipChange = current?.value != null && previous?.value != null
      && sessions.slice(endIndex - 6, endIndex).every(day => known(foreignMap.get(day))) ? current.value - previous.value : null;
    const startIndex = options.interval === "day" ? endIndex - 1 : (() => { const after = upperBound(date.slice(0, 10)); return sessions[after - 1] === date.slice(0, 10) ? after - 1 : after; })();
    const periodSessions = sessions.slice(startIndex, endIndex);
    const investmentTrustNet = periodSessions.length && periodSessions.every(day => known(trustMap.get(day)))
      ? periodSessions.reduce((sum, day) => sum + trustMap.get(day)!.value!, 0) : null;
    if (foreignOwnershipChange == null && investmentTrustNet == null) {
      const capabilities = [flow.foreign.capability, flow.investmentTrust.capability];
      const availability = capabilities.includes("error") ? "error" : capabilities.includes("not-configured") ? "not-configured" : capabilities.every(c => c === "not-supported") ? "not-supported" : "unknown";
      return [date, unavailable("같은 거래일·단위·공표시각이 확인된 수급 미확보", availability)];
    }
    return [date, { availability: foreignOwnershipChange != null && investmentTrustNet != null ? "available" : "partial",
      foreignOwnershipChange, investmentTrustNet, reason: "외국인 보유비율 5관측 거래일 변화(pp) · 투신 실제 일별/기간 순매수 수량",
      asOf: lastSession, source: `키움증권 · ${options.priceMarketScope ?? "KRX"}` } satisfies FlowConfirmation];
  }));
}
