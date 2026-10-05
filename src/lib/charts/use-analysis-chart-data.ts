import { useChartData } from "@/lib/use-market";
import { chartPriceBasisNote, sameChartPriceBasis } from "./security";
import { smaHistoryRange } from "./standard-sma";

/** Shared cached history for detail/fullscreen/workspace, including SMA/RSI/Bollinger warmup. */
export function useAnalysisChartData(opts: Parameters<typeof useChartData>[0]) {
  const normalized = {
    ...opts,
    minuteSize: opts.interval === "minute" ? opts.minuteSize : undefined,
  };
  const chart = useChartData(normalized);
  const aggregated =
    opts.interval === "week" || opts.interval === "month" || opts.interval === "year";
  const historyRange = smaHistoryRange(opts.interval, opts.range, opts.minuteSize);
  const needsHistory = opts.range !== historyRange;
  const daily = useChartData({
    ...normalized,
    interval: "day",
    minuteSize: undefined,
    prePost: undefined,
    enabled: aggregated && opts.enabled !== false,
  });
  const warmup = useChartData({
    ...normalized,
    range: historyRange,
    enabled: needsHistory && opts.enabled !== false,
  });
  const source = chart.data?.source ?? "";
  const profileUsable = Boolean(
    aggregated && daily.data?.bars.length && sameChartPriceBasis(source, daily.data.source),
  );
  const warmupUsable = Boolean(
    needsHistory && warmup.data?.bars.length && sameChartPriceBasis(source, warmup.data.source),
  );
  const note = chartPriceBasisNote(source, opts.market === "US" ? "US" : "KR");
  return {
    ...chart,
    profileBars: profileUsable ? daily.data!.bars : undefined,
    profileSource: profileUsable ? daily.data!.source : undefined,
    indicatorBars: warmupUsable ? warmup.data!.bars : undefined,
    priceBasisNote: `${note}${aggregated && !profileUsable ? " · 동일 가격기준의 일봉 미확보: 표시 봉 해상도로 추정" : ""}${needsHistory && !warmupUsable ? " · 동일 주기·가격기준의 추가 워밍업 이력 미확보" : ""} · SMA/볼린저는 해당 주기의 실제 봉으로 계산; BBW 백분위는 실제 밴드폭 125개 필요; 부족 구간은 결측`,
  };
}
