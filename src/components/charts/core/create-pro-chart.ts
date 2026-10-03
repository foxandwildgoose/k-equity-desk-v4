import { useEffect, useRef, useState, type RefObject } from "react";
import {
  createChart,
  CrosshairMode,
  TrackingModeExitMode,
  type DeepPartial,
  type ChartOptions,
  type IChartApi,
} from "lightweight-charts";
import { formatChartPrice, type ChartMarket } from "@/components/charts/core/formatters";
import type { ChartTheme } from "@/components/charts/core/theme";

/** Shared chart options (F7.1). `attributionLogo: false` is allowed because the footer credit link exists (F7.3). */
export function proChartOptions(theme: ChartTheme, market: ChartMarket): DeepPartial<ChartOptions> {
  return {
    autoSize: true,
    layout: { background: { color: "transparent" }, textColor: theme.muted, fontSize: 11, attributionLogo: false, panes: { separatorColor: theme.border, separatorHoverColor: theme.crosshair } },
    grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: theme.crosshair, labelBackgroundColor: theme.labelBg },
      horzLine: { color: theme.crosshair, labelBackgroundColor: theme.labelBg },
    },
    rightPriceScale: { borderColor: theme.border, scaleMargins: { top: 0.08, bottom: 0.12 } },
    timeScale: { borderColor: theme.border, timeVisible: true, secondsVisible: false, rightOffset: 6, barSpacing: 8, minBarSpacing: 0.5 },
    localization: { locale: "ko-KR", priceFormatter: (p: number) => formatChartPrice(p, market) },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: true, mouseWheel: true, pinch: true },
    // Touch: long-press shows the crosshair; lifting the finger ends tracking (F7.14).
    trackingMode: { exitMode: TrackingModeExitMode.OnTouchEnd },
  };
}

export function createProChart(el: HTMLElement, theme: ChartTheme, market: ChartMarket): IChartApi {
  return createChart(el, proChartOptions(theme, market));
}

/** Create/destroy a chart bound to `ref`; re-applies theme/market options on change. */
export function useProChart(ref: RefObject<HTMLDivElement | null>, theme: ChartTheme, market: ChartMarket): IChartApi | null {
  const [chart, setChart] = useState<IChartApi | null>(null);
  const first = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const c = createProChart(el, theme, market);
    setChart(c);
    return () => {
      setChart(null);
      c.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    chart?.applyOptions(proChartOptions(theme, market));
  }, [chart, theme, market]);
  return chart;
}
