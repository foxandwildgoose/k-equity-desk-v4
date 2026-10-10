import { isFlowDate, type FlowRequest } from "../lib/charts/hts-flow.ts";

/** Read scope may include a listed stock's full history; collector backfill remains separately bounded. */
export function validateFlowRequest(input: FlowRequest): FlowRequest {
  const code = input.code?.trim().toUpperCase();
  if (
    (input.flowScope && !["KRX", "NXT", "SOR"].includes(input.flowScope)) ||
    (input.expectedDailyDates &&
      (input.expectedDailyDates.length > 8000 ||
        input.expectedDailyDates.some((date) => !isFlowDate(date))))
  )
    throw new Error("유효하지 않은 일별 관측/시장 범위");
  if (!code || !(input.market === "KR" ? /^[0-9A-Z]{6}$/ : /^[A-Z][A-Z0-9.\-^=]{0,14}$/).test(code))
    throw new Error("유효하지 않은 종목 코드");
  if (
    !["KR", "US"].includes(input.market) ||
    !["stock", "etf", "etn"].includes(input.instrument) ||
    !["day", "week", "month", "year", "minute"].includes(input.interval) ||
    !["KRW", "USD"].includes(input.currency) ||
    !["주", "좌", "shares"].includes(input.quantityUnit) ||
    !/^[A-Za-z0-9 _-]{1,24}$/.test(input.exchange)
  )
    throw new Error("유효하지 않은 시장 메타데이터");
  if (
    !isFlowDate(input.from) ||
    !isFlowDate(input.to) ||
    input.from > input.to ||
    Date.parse(input.to) - Date.parse(input.from) > 100 * 366 * 86_400_000
  )
    throw new Error("유효하지 않은 조회 기간");
  return { ...input, code };
}
