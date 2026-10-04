import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { HistogramSeries, LineSeries, LineStyle, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { rsiWithSignal } from "@/lib/chart-indicators";
import { HTS_PANEL_ORDER, HTS_PANEL_LABELS, type HtsPanel, type HtsSettings } from "@/lib/charts/hts-settings";
import { changedHtsPanelHeights, contiguousHtsLineRuns, htsFlowPointDetails, htsPaneIndices, htsVolumeAverage, prepareHtsIndicatorHistory } from "@/lib/charts/hts-layout";
import type { AlignedFlowMetric, FlowCapability, FlowMetricId, FlowResponse } from "@/lib/charts/hts-flow";
import type { OhlcBar } from "@/server/naver-market";
import type { ChartTheme } from "@/components/charts/core/theme";
import { PaneCaptionPrimitive, RsiZonesPrimitive } from "./primitives";

export function ensureHtsPanes(chart: IChartApi, extraCount: number) {
  for (const pane of chart.panes()) pane.setPreserveEmptyPane(true);
  while (chart.panes().length <= htsPaneIndices(extraCount).volume) chart.addPane(true);
}

type FlowValues = Record<FlowMetricId, AlignedFlowMetric>;
type HtsSeries = {
  rsi: ISeriesApi<"Line">;
  signal: ISeriesApi<"Line">;
  credit: ISeriesApi<"Line">;
  foreign: ISeriesApi<"Line">;
  investmentTrust: ISeriesApi<"Line">;
  volume: ISeriesApi<"Histogram">;
  averages: Map<number, ISeriesApi<"Line">>;
  segments: Map<ISeriesApi<"Line">, ISeriesApi<"Line">[]>;
  zones: RsiZonesPrimitive;
};

export interface PaneSummary {
  id: HtsPanel;
  title: string;
  unit: string;
  status: string;
  value: string;
  asOf: string;
  source: string;
  capability?: FlowCapability;
  fetchedAt?: string;
  dateBasis?: string;
  final?: string;
}

/** A single native chart owns the common timeline, crosshair and resizable panes. */
export function useHtsPanes(options: {
  chart: IChartApi | null;
  enabled: boolean;
  settings: HtsSettings;
  onSettings: (settings: HtsSettings) => void;
  container: RefObject<HTMLDivElement | null>;
  extraCount: number;
  bars: OhlcBar[];
  indicatorBars?: OhlcBar[];
  times: (string | number)[];
  flow: FlowResponse;
  aligned: FlowValues;
  hoverIndex: number | null;
  theme: ChartTheme;
  upColor: string;
  downColor: string;
  quantityUnit: string;
  source: string;
  profileDescription: string;
  interval: string;
}) {
  const { chart, enabled, settings, extraCount, bars, times, flow, aligned, hoverIndex, theme } = options;
  const panes = useMemo(() => htsPaneIndices(extraCount), [extraCount]);
  const series = useRef<HtsSeries | null>(null);
  const captions = useRef(new Map<HtsPanel, PaneCaptionPrimitive>());
  const [epoch, setEpoch] = useState(0);
  const latest = useRef(options);
  latest.current = options;
  const extraStretch = useRef(new Map<number, number>());
  const indicatorHistory = useMemo(() => prepareHtsIndicatorHistory(bars, options.indicatorBars), [bars, options.indicatorBars]);
  const rsiData = useMemo(() => {
    const calculated = rsiWithSignal(indicatorHistory.history.map((b) => b.close), settings.rsiPeriod, settings.signalPeriod, settings.signalMethod);
    return {
      rsi: indicatorHistory.visibleIndices.map((i) => i == null ? null : calculated.rsi[i] ?? null),
      signal: indicatorHistory.visibleIndices.map((i) => i == null ? null : calculated.signal[i] ?? null),
    };
  }, [indicatorHistory, settings.rsiPeriod, settings.signalPeriod, settings.signalMethod]);
  const averages = useMemo(() => {
    return Object.fromEntries([5, 20, 60].map((period) => {
      const values = htsVolumeAverage(indicatorHistory.history, period);
      return [period, indicatorHistory.visibleIndices.map((i) => i == null ? null : values[i] ?? null)];
    })) as Record<5 | 20 | 60, (number | null)[]>;
  }, [indicatorHistory]);

  useEffect(() => {
    if (!chart || !enabled) return;
    ensureHtsPanes(chart, extraCount);
    const indices = htsPaneIndices(extraCount);
    const addLine = (id: HtsPanel, color: string, fixedRsi = false) => chart.addSeries(LineSeries, {
      color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      crosshairMarkerVisible: true,
      priceFormat: id === "rsi" || id === "foreign" || id === "credit"
        ? { type: "custom", minMove: 0.01, formatter: (n: number) => n.toFixed(2) }
        : { type: "volume" },
      ...(fixedRsi ? { autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) } : {}),
    }, indices[id]);
    const rsi = addLine("rsi", "#D84A4A", true);
    const signal = addLine("rsi", "#2E9E57", true);
    for (const level of [30, 50, 70]) rsi.createPriceLine({ price: level, color: theme.muted, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "" });
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false }, indices.volume);
    const averages = new Map([5, 20, 60].map((n, i) => [n, addLine("volume", ["#e7b157", "#a78bfa", "#38bdf8"][i]!)]));
    const zones = new RsiZonesPrimitive();
    rsi.attachPrimitive(zones);
    const instance: HtsSeries = { rsi, signal, volume, averages, zones, segments: new Map(),
      credit: addLine("credit", "#e7b157"), foreign: addLine("foreign", "#38bdf8"), investmentTrust: addLine("investmentTrust", "#a78bfa") };
    series.current = instance;
    const captionMap = captions.current;
    const attached = HTS_PANEL_ORDER.map((id) => {
      const pane = chart.panes()[indices[id]]!;
      const caption = new PaneCaptionPrimitive();
      pane.attachPrimitive(caption);
      captionMap.set(id, caption);
      const element = pane.getHTMLElement();
      if (element) {
        element.dataset.htsPane = id;
        element.setAttribute("aria-label", HTS_PANEL_LABELS[id]);
      }
      return { id, pane, caption, element };
    });
    let tagFrame = 0;
    let tagAttempts = 0;
    const tagPanes = () => {
      let pending = false;
      for (const item of attached) {
        item.element = item.pane.getHTMLElement();
        if (!item.element) { pending = true; continue; }
        item.element.dataset.htsPane = item.id;
        item.element.setAttribute("aria-label", HTS_PANEL_LABELS[item.id]);
      }
      if (pending && ++tagAttempts < 3) tagFrame = requestAnimationFrame(tagPanes);
    };
    tagFrame = requestAnimationFrame(tagPanes);
    setEpoch((e) => e + 1);
    return () => {
      cancelAnimationFrame(tagFrame);
      series.current = null;
      captionMap.clear();
      for (const { pane, caption, element } of attached) {
        try { pane.detachPrimitive(caption); } catch { /* chart teardown */ }
        element?.removeAttribute("data-hts-pane");
        element?.removeAttribute("aria-label");
      }
      for (const runs of instance.segments.values()) for (const run of runs) {
        try { chart.removeSeries(run); } catch { /* chart teardown */ }
      }
      instance.segments.clear();
      for (const s of [rsi, signal, volume, instance.credit, instance.foreign, instance.investmentTrust, ...averages.values()]) {
        try { chart.removeSeries(s); } catch { /* chart teardown */ }
      }
    };
    // Theme changes update captions and existing series without rebuilding pane identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, enabled, extraCount]);

  useEffect(() => {
    const s = series.current;
    if (!enabled || !s || !chart) return;
    const setLineRuns = (base: ISeriesApi<"Line">, values: (number | null)[], pane: number, visible: boolean) => {
      const runs = contiguousHtsLineRuns(values);
      const siblings = s.segments.get(base) ?? [];
      // Keep the first native series for primitives/reference lines. Each next
      // run is a distinct series: whitespace in one LWC line would bridge gaps.
      while (siblings.length > Math.max(0, runs.length - 1)) chart.removeSeries(siblings.pop()!);
      const options = { ...base.options(), visible, lastValueVisible: false, priceLineVisible: false };
      while (siblings.length < runs.length - 1) siblings.push(chart.addSeries(LineSeries, options, pane));
      s.segments.set(base, siblings);
      const seriesRuns = [base, ...siblings];
      for (let index = 0; index < seriesRuns.length; index++) {
        const run = runs[index];
        const data = run == null ? [] : times.slice(run.from, run.to + 1).map((time, offset) => ({ time: time as Time, value: values[run.from + offset]! }));
        seriesRuns[index]!.applyOptions({ visible, pointMarkersVisible: data.length === 1, pointMarkersRadius: 2 });
        seriesRuns[index]!.setData(data);
      }
    };
    setLineRuns(s.rsi, rsiData.rsi, panes.rsi, !settings.collapsed.rsi);
    setLineRuns(s.signal, rsiData.signal, panes.rsi, !settings.collapsed.rsi);
    s.zones.setEnabled(settings.rsiZones && !settings.collapsed.rsi);
    for (const id of ["credit", "foreign", "investmentTrust"] as const) {
      const byDate = new Map(aligned[id].points.map((p) => [p.date, p.value]));
      setLineRuns(s[id], bars.map((b) => byDate.get(b.date.slice(0, 10)) ?? null), panes[id], !settings.collapsed[id]);
    }
    s.volume.setData(bars.map((b, i) => b.volumeValid !== false && Number.isFinite(b.volume) && b.volume >= 0
      ? { time: times[i] as Time, value: b.volume, color: b.close >= b.open ? options.upColor : options.downColor }
      : { time: times[i] as Time }));
    s.volume.applyOptions({ visible: !settings.collapsed.volume });
    for (const [period, line] of s.averages) {
      setLineRuns(line, averages[period as 5 | 20 | 60], panes.volume, settings.volumeMa[period as 5 | 20 | 60] && !settings.collapsed.volume);
    }
    const hasTrust = aligned.investmentTrust.points.some((p) => p.value !== null);
    const zero = hasTrust ? s.investmentTrust.createPriceLine({ price: 0, color: theme.muted, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "0" }) : null;
    return () => { if (zero) { try { s.investmentTrust.removePriceLine(zero); } catch { /* removed */ } } };
  }, [chart, enabled, epoch, panes, bars, times, rsiData, averages, aligned, settings.rsiZones, settings.collapsed, settings.volumeMa, options.upColor, options.downColor, theme.muted]);

  const heightKey = JSON.stringify([settings.panelHeights, settings.collapsed]);
  useEffect(() => {
    if (!chart || !enabled) return;
    for (const id of HTS_PANEL_ORDER) {
      const pane = chart.panes()[panes[id]];
      const factor = settings.collapsed[id] ? 34 : settings.panelHeights[id];
      if (pane && pane.getStretchFactor() !== factor) pane.setStretchFactor(factor);
      if (id !== "price") chart.priceScale("right", panes[id]).applyOptions({ autoScale: true,
        scaleMargins: id === "rsi" ? { top: 0, bottom: 0 } : { top: 0.32, bottom: 0.09 } });
    }
    for (let i = 5; i < panes.volume; i++) chart.panes()[i]?.setStretchFactor(extraStretch.current.get(i) ?? 100);
    for (let i = chart.panes().length - 1; i > panes.volume; i--) {
      if (chart.panes()[i]?.getSeries().length === 0) chart.removePane(i);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, enabled, epoch, extraCount, heightKey]);

  useEffect(() => {
    const element = options.container.current;
    if (!element || !chart || !enabled) return;
    let frame = 0;
    let gesture: { pointerId: number; before: Partial<Record<HtsPanel, number>>; settings: HtsSettings } | null = null;
    const snapshot = (positions: Record<HtsPanel, number>) => Object.fromEntries(HTS_PANEL_ORDER.map((id) => [id, chart.panes()[positions[id]]?.getStretchFactor()])) as Partial<Record<HtsPanel, number>>;
    const beginResize = (event: PointerEvent) => {
      // Native Lightweight Charts separators expose a row-resize cursor. Chart
      // pans, crosshair moves and other pointer gestures must never save sizes.
      if (event.target instanceof Element && getComputedStyle(event.target).cursor === "row-resize") {
        gesture = { pointerId: event.pointerId, before: snapshot(htsPaneIndices(latest.current.extraCount)), settings: latest.current.settings };
      }
    };
    const recordResize = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const started = gesture;
      gesture = null;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = latest.current;
        // A settings/instrument change during a drag must not overwrite the new
        // selection with the previous chart's gesture.
        if (started.settings !== current.settings) return;
        const positions = htsPaneIndices(current.extraCount);
        const heights = changedHtsPanelHeights(current.settings.panelHeights, current.settings.collapsed, started.before, snapshot(positions));
        for (let i = 5; i < positions.volume; i++) {
          const factor = chart.panes()[i]?.getStretchFactor();
          if (factor != null && Number.isFinite(factor) && factor > 0) extraStretch.current.set(i, factor);
        }
        if (heights) current.onSettings({ ...current.settings, panelHeights: heights });
      });
    };
    element.addEventListener("pointerdown", beginResize, true);
    document.addEventListener("pointerup", recordResize, true);
    document.addEventListener("pointercancel", recordResize, true);
    return () => {
      element.removeEventListener("pointerdown", beginResize, true);
      document.removeEventListener("pointerup", recordResize, true);
      document.removeEventListener("pointercancel", recordResize, true);
      cancelAnimationFrame(frame);
    };
  }, [chart, enabled, extraCount, options.container]);

  const at = hoverIndex ?? bars.length - 1;
  const day = bars[at]?.date ?? "";
  const number = (v: number | null | undefined, digits = 2) => v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("ko-KR", { maximumFractionDigits: digits });
  const summaries: PaneSummary[] = HTS_PANEL_ORDER.map((id) => {
    if (id === "rsi") return { id, title: "RSI", unit: "0–100", value: `${number(rsiData.rsi[at])} / Signal ${number(rsiData.signal[at])}`,
      status: `종가 · Wilder ${settings.rsiPeriod} / Signal · ${settings.signalMethod.toUpperCase()} ${settings.signalPeriod}${rsiData.signal[at] == null ? " · 워밍업 부족" : ""}`, asOf: day, source: options.source };
    if (id === "price") return { id, title: "가격·매물대", unit: "", value: number(bars[at]?.close), status: options.profileDescription, asOf: day, source: options.source };
    if (id === "volume") return { id, title: "거래량", unit: options.quantityUnit, value: number(bars[at]?.volumeValid === false ? null : bars[at]?.volume, 0),
      status: `SMA ${[5, 20, 60].filter((n) => settings.volumeMa[n as 5 | 20 | 60]).join("/")} · 최근 봉은 장중·기간 중 미완성 가능`, asOf: day, source: options.source };
    const point = aligned[id].points.find((p) => p.date === day.slice(0, 10));
    const metric = flow[id];
    const title = id === "investmentTrust" ? settings.trustMode === "cumulative" ? `투신 누적순매수 · 기준 ${settings.trustStartDate || "확인 중"}` : "투신 일별 순매수" : HTS_PANEL_LABELS[id].replace(/\s*\(%\)$/, "");
    const details = htsFlowPointDetails(metric, aligned[id], point, flow.fetchedAt, flow.stale);
    return { id, title, unit: metric.unit, value: number(point?.value, id === "investmentTrust" ? 0 : 2),
      ...details, source: metric.source };
  });
  useEffect(() => {
    if (!enabled) return;
    for (const item of summaries) captions.current.get(item.id)?.set({
      title: item.title, unit: item.unit, status: settings.collapsed[item.id] ? "접힘" : item.status,
      hover: settings.collapsed[item.id] ? undefined : `${day || "날짜 미확인"} · ${item.value}`,
      asOf: item.asOf, source: item.source, color: theme.text, mutedColor: theme.muted, backgroundColor: theme.card,
    });
    // Captions are lightweight; no indicator/profile calculation runs on pointer movement.
  }, [enabled, epoch, summaries, settings.collapsed, day, theme]);
  return { rsiData, averages, summaries, panes };
}
