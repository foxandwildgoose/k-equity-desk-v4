import { useEffect, useMemo, useRef, useState } from "react";
import { LineSeries, type IChartApi, type ISeriesApi, type SeriesType, type Time } from "lightweight-charts";
import { defaultLayout, loadChartState, saveChartState, safeChartStorage } from "@/lib/charts/persistence";
import { latestSmaPoint, resolveSmaStyle, standardSmaInstance, standardSmaValues, STANDARD_SMA_PERIODS, toggleStandardSma, type SmaPoint, type StandardSmaPeriod } from "@/lib/charts/standard-sma";
import { useAppStore } from "@/lib/store";
import { proChartOptions } from "./create-pro-chart";
import { useChartTheme } from "./theme";
import { SmaLabelsPrimitive } from "./sma-labels-primitive";

/** Shared adapter for non-catalog chart families. Persists with the existing layout
 * parser/keys; stock ProChart uses its own catalog state and the same primitives. */
export function useStandardSma({ chart, source, points, history, scope, formatValue, scaleId = "right", paneIndex = 0, available = true }: {
  chart: IChartApi | null;
  source: ISeriesApi<SeriesType> | null;
  points: readonly SmaPoint[];
  history?: readonly SmaPoint[];
  scope: string;
  formatValue: (value: number) => string;
  scaleId?: string;
  paneIndex?: number;
  available?: boolean;
}) {
  const mode = useAppStore(s => s.theme);
  const theme = useChartTheme();
  const [layout, setLayout] = useState(() => defaultLayout(STANDARD_SMA_PERIODS.map(standardSmaInstance)));
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    const storage = safeChartStorage();
    setLayout(storage ? loadChartState(storage, "KR", scope, "sma") ?? defaultLayout(STANDARD_SMA_PERIODS.map(standardSmaInstance)) : defaultLayout(STANDARD_SMA_PERIODS.map(standardSmaInstance)));
    setLoaded(scope);
  }, [scope]);
  useEffect(() => {
    if (loaded !== scope) return;
    const storage = safeChartStorage();
    if (storage) saveChartState(storage, "KR", scope, "sma", layout);
  }, [scope, loaded, layout]);
  const values = useMemo(() => standardSmaValues(points, history), [points, history]);
  const unavailable = useMemo(() => STANDARD_SMA_PERIODS.filter(period => layout.indicators.some(i => i.id === "sma" && Number(i.params.period) === period && i.visible) && !values[period].some(value => value != null)), [layout.indicators, values]);
  const entries = useRef(new Map<StandardSmaPeriod, ISeriesApi<"Line">>());
  const primitive = useRef(new SmaLabelsPrimitive());
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    if (!chart || !source) return;
    const store = entries.current;
    for (const period of STANDARD_SMA_PERIODS) {
      const style = resolveSmaStyle(standardSmaInstance(period), mode)!;
      store.set(period, chart.addSeries(LineSeries, { color: style.color, lineWidth: style.lineWidth, title: `SMA${period}`, priceScaleId: scaleId, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }, paneIndex));
    }
    source.attachPrimitive(primitive.current);
    setEpoch(e => e + 1);
    const attached = primitive.current;
    return () => {
      // Older standalone charts dispose synchronously; native cleanup can follow it.
      try { source.detachPrimitive(attached); } catch { /* chart disposed */ }
      for (const series of store.values()) { try { chart.removeSeries(series); } catch { /* chart disposed */ } }
      store.clear();
    };
    // Style updates are independent of binding/series lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, source, scaleId, paneIndex]);
  useEffect(() => {
    for (const [period, series] of entries.current) series.setData(points.map((row, i) => {
      const value = values[period][i];
      return value == null ? { time: row.time as Time } : { time: row.time as Time, value };
    }));
  }, [points, values, epoch]);
  useEffect(() => {
    const endpoints = [];
    for (const period of STANDARD_SMA_PERIODS) {
      const instance = layout.indicators.find(i => i.id === "sma" && Number(i.params?.period) === period);
      const style = resolveSmaStyle(instance ?? standardSmaInstance(period), mode)!;
      const visible = available && Boolean(instance?.visible) && loaded === scope;
      entries.current.get(period)?.applyOptions({ color: style.color, lineWidth: style.lineWidth, visible });
      const point = latestSmaPoint(points, values[period], visible);
      if (point?.value != null) endpoints.push({ period, time: point.time, value: point.value, color: style.color, text: `SMA${period} ${formatValue(point.value)}`, coordinateSeries: entries.current.get(period) });
    }
    primitive.current.set(endpoints, theme.background);
  }, [layout.indicators, loaded, scope, available, mode, points, values, epoch, formatValue, theme.background]);
  useEffect(() => {
    if (!chart) return;
    const options = proChartOptions(theme, "US");
    chart.applyOptions({ layout: options.layout, grid: options.grid, crosshair: options.crosshair, timeScale: { borderColor: theme.border } });
  }, [chart, theme]);
  return { instances: layout.indicators, mode, ready: loaded === scope,
    toggle: (period: StandardSmaPeriod) => setLayout(previous => ({ ...previous, indicators: toggleStandardSma(previous.indicators, period) })),
    setAll: (visible: boolean) => setLayout(previous => ({ ...previous, indicators: previous.indicators.map(i => ({ ...i, visible })) })),
    values,
    unavailable,
  };
}
