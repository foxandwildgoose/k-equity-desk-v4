import { useEffect, useMemo, useRef, useState } from "react";
import { LineSeries, LineStyle, type AutoscaleInfo, type IChartApi, type IPaneApi, type IPriceLine, type ISeriesApi, type Time } from "lightweight-charts";
import type { ChartTheme } from "@/components/charts/core/theme";
import type { BollingerFillPrimitive } from "@/components/charts/core/bollinger-fill-primitive";
import { BOLLINGER_PERCENT_B_GUIDES, bollingerMiddleVisible, bollingerPanePlan, getBollingerRenderingStyle, percentBAutoscaleRange } from "@/lib/bollinger/rendering";
import type { BollingerPoint, BollingerSystemSettings } from "@/lib/bollinger/types";
import { contiguousHtsLineRuns } from "@/lib/charts/hts-layout";
import { PaneCaptionPrimitive } from "./primitives";

type NativeLine = { base: ISeriesApi<"Line">; runs: ISeriesApi<"Line">[] };
type NativePanel = NativeLine & { guides: IPriceLine[]; caption: PaneCaptionPrimitive; pane: IPaneApi<Time> | null; element: HTMLElement | null };
type NativeSystem = { upper: NativeLine; middle: NativeLine; lower: NativeLine; percentB: NativePanel | null; bandwidth: NativePanel | null };

function clearPaneTag(element: HTMLElement | null) {
  element?.removeAttribute("data-bollinger-pane");
  // The HTS/layout reconciler may already have rebound this same DOM row.
  // Remove only this hook's accessible name, preserving the next owner's name.
  if (["%B · 볼린저 상대 가격", "BBW · 볼린저 밴드폭 (%)"].includes(element?.getAttribute("aria-label") ?? "")) element?.removeAttribute("aria-label");
}

/** Cross-market native rendering only. Financial calculations/persistence belong
 * to shared pure engine/ProChart state; this hook never fetches market data. */
export function useBollingerSystem(options: {
  chart: IChartApi | null;
  fillPrimitive: BollingerFillPrimitive;
  mainEpoch: number;
  layoutEpoch?: number;
  pricePaneIndex: number;
  paneStartIndex: number;
  points: BollingerPoint[];
  times: (string | number)[];
  settings: BollingerSystemSettings;
  panesExpanded: boolean;
  theme: ChartTheme;
  themeMode: "light" | "dark";
  sma20Visible: boolean;
  hoverIndex?: number | null;
  priceVisible?: boolean;
  onSettings?: (settings: BollingerSystemSettings) => void;
}) {
  const { chart, fillPrimitive, mainEpoch, pricePaneIndex, paneStartIndex, points, times, settings, panesExpanded, theme, themeMode, sma20Visible } = options;
  const native = useRef<NativeSystem | null>(null);
  const [epoch, setEpoch] = useState(0);
  const latest = useRef(options);
  latest.current = options;
  const { enabled, percentB, bandwidth } = settings;
  const plan = useMemo(() => bollingerPanePlan({ enabled, percentB, bandwidth }, panesExpanded, paneStartIndex),
    [enabled, percentB, bandwidth, panesExpanded, paneStartIndex]);
  const style = useMemo(() => getBollingerRenderingStyle(themeMode, settings.overlayColor), [themeMode, settings.overlayColor]);
  const middleVisible = bollingerMiddleVisible(settings, sma20Visible);

  useEffect(() => {
    if (!chart) return;
    while (chart.panes().length <= pricePaneIndex) chart.addPane(true);
    const add = (): NativeLine => ({ base: chart.addSeries(LineSeries, {
      lineWidth: 1, lineStyle: LineStyle.Solid, visible: false,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      // Price owns the scale. Boundaries must not squash candles or make the
      // duplicated middle line stronger than the shared SMA20.
      autoscaleInfoProvider: () => null,
    }, pricePaneIndex), runs: [] });
    const state: NativeSystem = { upper: add(), middle: add(), lower: add(), percentB: null, bandwidth: null };
    native.current = state;
    setEpoch(value => value + 1);
    return () => {
      native.current = null;
      for (const panel of [state.percentB, state.bandwidth]) if (panel) {
        try { panel.pane?.detachPrimitive(panel.caption); } catch { /* chart teardown */ }
        clearPaneTag(panel.element);
      }
      for (const line of [state.upper, state.middle, state.lower, state.percentB, state.bandwidth]) if (line) {
        for (const series of [line.base, ...line.runs]) {
          try { chart.removeSeries(series); } catch { /* chart teardown */ }
        }
      }
    };
    // Native series stay alive across theme, settings, scope and source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);

  // A panel's identity survives count/index changes. Existing user-selected
  // native stretch factors are left intact when it remains at the same pane.
  useEffect(() => {
    const state = native.current;
    if (!chart || !state) return;
    const clearPanel = (panel: NativePanel) => {
      try { panel.pane?.detachPrimitive(panel.caption); } catch { /* pane teardown */ }
      clearPaneTag(panel.element);
      for (const line of [panel.base, ...panel.runs]) chart.removeSeries(line);
    };
    const reconcile = (id: "percentB" | "bandwidth", paneIndex: number | null) => {
      let panel = state[id];
      if (paneIndex == null) {
        if (panel) clearPanel(panel);
        state[id] = null;
        return;
      }
      while (chart.panes().length <= paneIndex) chart.addPane(true);
      const pane = chart.panes()[paneIndex]!;
      pane.setPreserveEmptyPane(true);
      if (!panel) {
        const percentB = id === "percentB";
        const base = chart.addSeries(LineSeries, {
          lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
          crosshairMarkerVisible: true,
          priceFormat: { type: "custom", minMove: percentB ? 0.01 : 0.001,
            formatter: (value: number) => percentB ? value.toFixed(2) : `${value.toFixed(2)}%` },
          ...(percentB ? { autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
            const info = original();
            return { ...info, priceRange: percentBAutoscaleRange(info?.priceRange?.minValue ?? 0, info?.priceRange?.maxValue ?? 1) };
          } } : {}),
        }, paneIndex);
        const guides = percentB ? BOLLINGER_PERCENT_B_GUIDES.map(level => base.createPriceLine({
          price: level, lineWidth: 1, lineStyle: LineStyle.Dashed,
          axisLabelVisible: true, title: "", color: style.guide,
        })) : [];
        panel = { base, runs: [], guides, caption: new PaneCaptionPrimitive(), pane: null, element: null };
        state[id] = panel;
        // New BB panels stay subordinate to the price pane. These factors use
        // either HTS pixel-like factors or the ordinary relative pane system.
        const priceFactor = chart.panes()[pricePaneIndex]?.getStretchFactor() ?? 3;
        pane.setStretchFactor(priceFactor > 20 ? 100 : 1);
      }
      for (const series of [panel.base, ...panel.runs]) series.moveToPane(paneIndex);
      if (panel.pane !== pane) {
        try { panel.pane?.detachPrimitive(panel.caption); } catch { /* pane changed */ }
        clearPaneTag(panel.element);
        pane.attachPrimitive(panel.caption);
        panel.pane = pane;
      }
      chart.priceScale("right", paneIndex).applyOptions({ autoScale: true, scaleMargins: { top: 0.22, bottom: 0.08 } });
    };
    reconcile("percentB", plan.percentB);
    reconcile("bandwidth", plan.bandwidth);
    let frame = 0;
    let attempts = 0;
    const tag = () => {
      let missing = false;
      for (const id of ["percentB", "bandwidth"] as const) {
        const panel = state[id];
        if (!panel) continue;
        const element = panel.pane?.getHTMLElement();
        if (!element) { missing = true; continue; }
        panel.element = element;
        element.dataset.bollingerPane = id;
        element.setAttribute("aria-label", id === "percentB" ? "%B · 볼린저 상대 가격" : "BBW · 볼린저 밴드폭 (%)");
      }
      if (missing && ++attempts < 4) frame = requestAnimationFrame(tag);
    };
    frame = requestAnimationFrame(tag);
    setEpoch(value => value + 1);
    return () => cancelAnimationFrame(frame);
    // Style updates below do not detach/rebuild panes or price series.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, plan, pricePaneIndex]);

  useEffect(() => {
    if (!chart) return;
    const unit = (chart.panes()[pricePaneIndex]?.getStretchFactor() ?? 3) > 20 ? 1 : 100;
    for (const id of ["percentB", "bandwidth"] as const) {
      const pane = native.current?.[id]?.pane;
      const factor = (settings.paneHeights?.[id] ?? 100) / unit;
      if (pane && Number.isFinite(factor) && factor > 0 && pane.getStretchFactor() !== factor) pane.setStretchFactor(factor);
    }
  }, [chart, epoch, plan, pricePaneIndex, settings.paneHeights, options.layoutEpoch]);

  useEffect(() => {
    if (!chart || !options.onSettings) return;
    const element = chart.chartElement();
    let frame = 0;
    let gesture: { pointerId: number; settings: BollingerSystemSettings; before: Partial<Record<"percentB" | "bandwidth", number>> } | null = null;
    const snapshot = () => Object.fromEntries(["percentB", "bandwidth"].map(id => {
      const panel = native.current?.[id as "percentB" | "bandwidth"];
      return [id, panel?.pane?.getStretchFactor()];
    })) as Partial<Record<"percentB" | "bandwidth", number>>;
    const begin = (event: PointerEvent) => {
      if (event.target instanceof Element && getComputedStyle(event.target).cursor === "row-resize") {
        gesture = { pointerId: event.pointerId, settings: latest.current.settings, before: snapshot() };
      }
    };
    const finish = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const started = gesture;
      gesture = null;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = latest.current;
        if (started.settings !== current.settings) return;
        const unit = (chart.panes()[current.pricePaneIndex]?.getStretchFactor() ?? 3) > 20 ? 1 : 100;
        const after = snapshot();
        const heights = { percentB: 100, bandwidth: 100, ...current.settings.paneHeights };
        let changed = false;
        for (const id of ["percentB", "bandwidth"] as const) {
          const factor = after[id];
          if (factor == null || !Number.isFinite(factor) || factor <= 0 || started.before[id] == null || Math.abs(factor - started.before[id]!) < 0.001) continue;
          heights[id] = Math.max(34, Math.min(600, Math.round(factor * unit)));
          changed = true;
        }
        if (changed) current.onSettings?.({ ...current.settings, paneHeights: heights });
      });
    };
    element.addEventListener("pointerdown", begin, true);
    document.addEventListener("pointerup", finish, true);
    document.addEventListener("pointercancel", finish, true);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("pointerdown", begin, true);
      document.removeEventListener("pointerup", finish, true);
      document.removeEventListener("pointercancel", finish, true);
    };
  }, [chart, options.onSettings]);

  useEffect(() => {
    const state = native.current;
    if (!chart || !state) return;
    const setLine = (line: NativeLine, values: (number | null)[], pane: number, color: string, visible: boolean) => {
      line.base.applyOptions({ color, visible });
      line.base.moveToPane(pane);
      const runs = contiguousHtsLineRuns(values);
      while (line.runs.length > Math.max(0, runs.length - 1)) chart.removeSeries(line.runs.pop()!);
      while (line.runs.length < runs.length - 1) line.runs.push(chart.addSeries(LineSeries, {
        ...line.base.options(), color, visible, priceLineVisible: false, lastValueVisible: false,
      }, pane));
      [line.base, ...line.runs].forEach((series, index) => {
        const run = runs[index];
        const data = run ? times.slice(run.from, run.to + 1).map((time, offset) => ({ time: time as Time, value: values[run.from + offset]! })) : [];
        series.moveToPane(pane);
        series.applyOptions({ color, visible, pointMarkersVisible: data.length === 1, pointMarkersRadius: 2 });
        series.setData(data);
      });
    };
    const values = (key: "upper" | "middle" | "lower" | "percentB" | "bbw") => times.map((_, index) => {
      const value = points[index]?.[key];
      return value != null && Number.isFinite(value) ? value : null;
    });
    const overlayVisible = settings.enabled && settings.overlay && options.priceVisible !== false;
    setLine(state.upper, values("upper"), pricePaneIndex, style.upper, overlayVisible);
    setLine(state.middle, values("middle"), pricePaneIndex, style.middle, overlayVisible && middleVisible);
    setLine(state.lower, values("lower"), pricePaneIndex, style.lower, overlayVisible);
    if (state.percentB && plan.percentB != null) {
      setLine(state.percentB, values("percentB"), plan.percentB, style.percentB, true);
      for (const guide of state.percentB.guides) guide.applyOptions({ color: style.guide });
    }
    if (state.bandwidth && plan.bandwidth != null) setLine(state.bandwidth, values("bbw"), plan.bandwidth, style.bandwidth, true);
    fillPrimitive.set(overlayVisible ? times.map((time, index) => ({ time, upper: points[index]?.upper ?? null, lower: points[index]?.lower ?? null })) : [], style.fill, style.fillOpacity);
  }, [chart, epoch, mainEpoch, fillPrimitive, pricePaneIndex, points, times, settings.enabled, settings.overlay, options.priceVisible, style, middleVisible, plan]);

  useEffect(() => {
    const state = native.current;
    if (!state) return;
    const index = options.hoverIndex ?? points.length - 1;
    const point = points[index];
    const number = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? "—" : value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
    const context = options.hoverIndex == null ? "최근" : "해당 봉 당시";
    state.percentB?.caption.set({ title: "%B", unit: "상대 가격", hover: `${context} · ${number(point?.percentB)}`,
      status: point?.percentB == null ? "실제 봉 이력 부족 / 결측" : "1 상단 · 0.5 중심 · 0 하단 · 범위 밖 값 유지",
      asOf: point?.date, color: theme.text, mutedColor: theme.muted, backgroundColor: theme.card });
    state.bandwidth?.caption.set({ title: "BBW", unit: "%", hover: `${context} · ${number(point?.bbw)}%`,
      status: `BBW 백분위 ${number(point?.bbwPercentile)}% · ${point?.volatility ?? "이력 부족"}`,
      asOf: point?.date, color: theme.text, mutedColor: theme.muted, backgroundColor: theme.card });
  }, [epoch, points, options.hoverIndex, theme, plan]);

  return { paneCount: plan.paneCount, panes: { percentB: plan.percentB, bandwidth: plan.bandwidth }, middleVisible };
}
