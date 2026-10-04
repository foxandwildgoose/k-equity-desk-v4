import { useChartData } from "@/lib/use-market";
import { chartPriceBasisNote, sameChartPriceBasis } from "./security";

/** Shared cached history for detail/fullscreen/workspace, including RSI warmup. */
export function useAnalysisChartData(opts: Parameters<typeof useChartData>[0]) {
  const normalized = {
    ...opts,
    minuteSize: opts.interval === "minute" ? opts.minuteSize : undefined,
  };
  const chart = useChartData(normalized);
  const aggregated =
    opts.interval === "week" || opts.interval === "month" || opts.interval === "year";
  const shortDaily = opts.interval === "day" && ["1mo", "3mo", "6mo"].includes(opts.range ?? "");
  const daily = useChartData({
    ...normalized,
    interval: "day",
    minuteSize: undefined,
    prePost: undefined,
    enabled: aggregated && opts.enabled !== false,
  });
  const warmup = useChartData({
    ...normalized,
    range: "2y",
    enabled: shortDaily && opts.enabled !== false,
  });
  const source = chart.data?.source ?? "";
  const profileUsable = Boolean(
    aggregated && daily.data?.bars.length && sameChartPriceBasis(source, daily.data.source),
  );
  const warmupUsable = Boolean(
    shortDaily && warmup.data?.bars.length && sameChartPriceBasis(source, warmup.data.source),
  );
  const note = chartPriceBasisNote(source, opts.market === "US" ? "US" : "KR");
  return {
    ...chart,
    profileBars: profileUsable ? daily.data!.bars : undefined,
    profileSource: profileUsable ? daily.data!.source : undefined,
    indicatorBars: warmupUsable ? warmup.data!.bars : undefined,
    priceBasisNote: `${note}${aggregated && !profileUsable ? " · 동일 가격기준의 일봉 미확보: 표시 봉 해상도로 추정" : ""}${shortDaily && !warmupUsable ? " · 추가 워밍업 이력 미확보" : ""}`,
  };
}
