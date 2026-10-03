import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import {
  AreaSeries,
  BarSeries,
  BaselineSeries,
  CandlestickSeries,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type SeriesType,
  type Time,
} from "lightweight-charts";
import {
  Bell,
  BrainCircuit,
  Crosshair,
  Layers,
  ListTree,
  Magnet,
  MousePointer2,
  Pause,
  Play,
  Redo2,
  Rewind,
  SkipForward,
  Undo2,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ChartShell, type LegendItem } from "@/components/charts/core/ChartShell";
import { useChartTheme } from "@/components/charts/core/theme";
import { useProChart } from "@/components/charts/core/create-pro-chart";
import { downloadCanvasPng, downloadCsv } from "@/components/charts/core/export";
import type { ChartSync } from "@/components/charts/core/sync";
import { formatChartPercent, formatChartPrice, formatChartVolume, priceFormatFor, type KrxInstrument } from "@/components/charts/core/formatters";
import { RangePositionStrip } from "@/components/stocks/RangePositionStrip";
import { computeRangePosition, planRangeMarkers, rangeMarkerText, type RangePositionStats, type RecentSpan } from "@/lib/chart-indicators";
import { AlertsPanel, IndicatorPanel, instanceLabel, ObjectManager } from "@/components/charts/pro/ChartPanels";
import { DrawingPrimitive, RangeMarkerPrimitive, SessionPrimitive, VolumeProfilePrimitive } from "@/components/charts/pro/primitives";
import { FeedList } from "@/components/feed/FeedList";
import { useAppStore } from "@/lib/store";
import { useChartData } from "@/lib/use-market";
import { useFeed } from "@/lib/use-feed";
import { notifyAlert } from "@/lib/wire/use-live-wire";
import { evaluateIndicatorAlert, evaluatePriceAlert } from "@/lib/alerts/price-alert";
import { findPivots, heikinAshi, pivotPoints, rsi as calcRsi, sma as calcSma, volumeProfile, type PivotKind } from "@/lib/chart-indicators";
import {
  computeInstance,
  INDICATOR_BY_ID,
  indicatorCacheKey,
  newInstance,
  PALETTE,
  defaultIndicators,
  type CatalogBars,
  type IndicatorDef,
  type IndicatorInstance,
  type Series,
} from "@/lib/charts/catalog";
import {
  anchorsFor,
  DRAWING_TOOLS,
  drawingReducer,
  initHistory,
  newDrawing,
  snapPrice,
  type Anchor,
  type Drawing,
  type DrawingType,
} from "@/lib/charts/drawings";
import {
  CHART_SCALES,
  CHART_TYPES,
  defaultLayout,
  loadChartState,
  migrateLegacyOnce,
  saveChartState,
  type ChartLayoutState,
  type ChartScale,
  type ChartType,
} from "@/lib/charts/persistence";
import {
  alignByTime,
  barsToCsv,
  capBars,
  chartExportName,
  extendedHoursRuns,
  percentFromFirstVisible,
  REPLAY_SPEEDS,
  replaySlice,
  replayStep,
  replayTickMs,
  sessionBreaks,
  visibleWindow,
} from "@/lib/charts/tools";
import { barTimeOf, dayOfTime } from "@/lib/charts/bar-time";
import { kstDayKey } from "@/lib/feed/time";
import type { ChartEvents, ChartInterval, MinuteSize, OhlcBar } from "@/server/naver-market";
import type { FeedItem } from "@/lib/feed/types";
import type { PriceAlert } from "@/lib/store-migrate";
import { cn } from "@/lib/utils";

type Tool = "cursor" | DrawingType | "avwap-anchor" | "replay-pick";

export interface ChartMarkerInput {
  time: string | number;
  text: string;
  position?: "aboveBar" | "belowBar";
  shape?: "circle" | "arrowUp" | "arrowDown" | "square";
  color?: string;
}

export interface ProChartProps {
  code: string;
  market: "KR" | "US";
  instrument?: KrxInstrument;
  name?: string;
  bars: OhlcBar[];
  interval: ChartInterval;
  minuteSize?: MinuteSize;
  range?: string;
  /** Persistence key part, e.g. "day" or "minute-5". */
  intervalKey: string;
  source: string;
  /** e.g. "KIS 실시간", "지연 15분", "네이버 스냅샷". */
  modeLabel: string;
  updatedAt: number | null;
  loading?: boolean;
  error?: boolean;
  events?: ChartEvents;
  disclosureMarkers?: { time: string; title: string }[];
  signalMarkers?: ChartMarkerInput[];
  researchMarkers?: ChartMarkerInput[];
  toolbarExtra?: ReactNode;
  height?: number | string;
  sync?: ChartSync;
  syncId?: string;
  onFullscreen?: () => void;
  onVisibleRange?: (r: { from: number; to: number } | null) => void;
  onHover?: (bar: OhlcBar | null) => void;
  /** US intraday: include pre/post bars. */
  prePost?: { on: boolean; toggle: () => void };
  testId?: string;
  /** Dense layout (workspace 2/4): toolbar lives in the sheet. */
  compact?: boolean;
}

const SCALE_MODE: Record<ChartScale, PriceScaleMode> = {
  normal: PriceScaleMode.Normal,
  log: PriceScaleMode.Logarithmic,
  percent: PriceScaleMode.Percentage,
  indexed: PriceScaleMode.IndexedTo100,
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function safeStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function RangeHud({ stats, up, down }: { stats: RangePositionStats; up: string; down: string }) {
  const cells: { label: string; pct: number }[] = [
    { label: stats.fromPeriodLowPct < -0.005 ? "저점이탈" : "저점대비", pct: stats.fromPeriodLowPct },
    { label: stats.fromPeriodHighPct > 0.005 ? "고점돌파" : "고점대비", pct: stats.fromPeriodHighPct },
    { label: stats.fromRecentHighPct > 0.005 ? "최근고 돌파" : "최근고", pct: stats.fromRecentHighPct },
    { label: stats.fromRecentLowPct < -0.005 ? "최근저 이탈" : "최근저", pct: stats.fromRecentLowPct },
  ];
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5" data-testid="chart-range-hud">
      {cells.map((cell) => (
        <span key={cell.label} className="whitespace-nowrap">
          <span className="text-muted-foreground">{cell.label} </span>
          <span style={{ color: cell.pct > 0.005 ? up : cell.pct < -0.005 ? down : undefined }}>
            {Number.isFinite(cell.pct) ? formatChartPercent(cell.pct) : "—"}
          </span>
        </span>
      ))}
    </span>
  );
}

/** One compare symbol's bars (F7.8). */
function CompareLoader({ sym, interval, minuteSize, range, onBars }: { sym: string; interval: ChartInterval; minuteSize?: MinuteSize; range?: string; onBars: (sym: string, bars: OhlcBar[] | null) => void }) {
  const [m, code] = sym.split(":") as ["KR" | "US", string];
  const q = useChartData({ code, market: m === "US" ? "US" : "KOSPI", interval, minuteSize, range });
  useEffect(() => {
    onBars(sym, q.data?.bars ?? (q.isError ? [] : null));
  }, [sym, q.data, q.isError, onBars]);
  return null;
}

const COMPARE_COLORS = ["#e879f9", "#84cc16", "#f97316"];
const VP_KEY = "ked:vp:v1";
const VP_WIDTH = { thin: 0.1, mid: 0.14, wide: 0.18 } as const;

type VpPrefs = {
  enabled: boolean;
  preset: "hide" | "ref" | "emph";
  rows: number;
  basis: "volume" | "turnover";
  showVa: boolean;
  showPoc: boolean;
  width: keyof typeof VP_WIDTH;
  opacity: number;
  visibleOnly: boolean;
  rangeOn: boolean;
  recentSpan: RecentSpan;
};

const DEFAULT_VP: VpPrefs = {
  enabled: true,
  preset: "ref",
  rows: 24,
  basis: "volume",
  showVa: true,
  showPoc: true,
  width: "thin",
  opacity: 0.22,
  visibleOnly: false,
  rangeOn: true,
  recentSpan: "52W",
};

function readVpPrefs(): VpPrefs | null {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(VP_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<VpPrefs>;
    const rows = [16, 24, 32, 48].includes(Number(p.rows)) ? Number(p.rows) : DEFAULT_VP.rows;
    const width = p.width === "mid" || p.width === "wide" || p.width === "thin" ? p.width : DEFAULT_VP.width;
    const recentSpan: RecentSpan =
      p.recentSpan === "3M" || p.recentSpan === "6M" || p.recentSpan === "52W" || p.recentSpan === "all" || p.recentSpan === "swing"
        ? p.recentSpan
        : DEFAULT_VP.recentSpan;
    return {
      ...DEFAULT_VP,
      ...p,
      rows,
      width,
      recentSpan,
      opacity: Number.isFinite(p.opacity) ? Math.min(0.4, Math.max(0.12, Number(p.opacity))) : DEFAULT_VP.opacity,
      basis: p.basis === "turnover" ? "turnover" : "volume",
      preset: p.preset === "hide" || p.preset === "emph" || p.preset === "ref" ? p.preset : DEFAULT_VP.preset,
    };
  } catch {
    return null;
  }
}

function applyVpPreset(preset: VpPrefs["preset"], prev: VpPrefs): VpPrefs {
  if (preset === "hide") return { ...prev, preset, enabled: false };
  if (preset === "emph") return { ...prev, preset, enabled: true, width: "wide", opacity: 0.32 };
  return { ...prev, preset: "ref", enabled: true, width: "thin", opacity: 0.22 };
}

/**
 * Pro chart (F7 Tier A): chart types + scales, indicator catalog, drawing
 * tools with undo/redo, compare overlay, event overlays, alerts, bar replay,
 * extended-hours shading, PNG/CSV export and per-layout persistence.
 */
export function ProChart(props: ProChartProps) {
  const { code, market, bars: rawBars, interval, intervalKey } = props;
  const theme = useChartTheme();
  const convention = useAppStore((s) => s.colorConvention);
  const upColor = convention === "korea" ? "#ef4444" : "#22c55e";
  const downColor = convention === "korea" ? "#3b82f6" : "#ef4444";
  const chartPrefs = useAppStore((s) => s.chartPrefs);
  const setChartPrefs = useAppStore((s) => s.setChartPrefs);
  const priceAlerts = useAppStore((s) => s.alertSettings.priceAlerts);
  const upsertPriceAlert = useAppStore((s) => s.upsertPriceAlert);
  const removePriceAlert = useAppStore((s) => s.removePriceAlert);

  const containerRef = useRef<HTMLDivElement>(null);
  const chart = useProChart(containerRef, theme, market);
  const fmt = useCallback((p: number) => formatChartPrice(p, market, rawBars[rawBars.length - 1]?.close), [market, rawBars]);
  const [vp, setVp] = useState<VpPrefs>(DEFAULT_VP);
  const [vpHydrated, setVpHydrated] = useState(false);
  useEffect(() => {
    const saved = readVpPrefs();
    if (saved) setVp(saved);
    else if (window.matchMedia("(max-width: 767px)").matches) setVp((v) => ({ ...v, enabled: false, preset: "hide" }));
    setVpHydrated(true);
  }, []);
  useEffect(() => {
    if (!vpHydrated) return;
    try {
      window.localStorage.setItem(VP_KEY, JSON.stringify(vp));
    } catch {
      /* private mode */
    }
  }, [vp, vpHydrated]);

  // ── Layout state (persisted per market/code/interval) ─────────────────
  const [layout, setLayout] = useState<ChartLayoutState>(() => defaultLayout(defaultIndicators(market), chartPrefs.chartType, chartPrefs.scale));
  const [history, dispatch] = useReducer(drawingReducer, undefined, () => initHistory());
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const layoutKey = `${market}:${code}:${intervalKey}`;
  useEffect(() => {
    const store = safeStorage();
    const saved = store ? loadChartState(store, market, code, intervalKey) : null;
    const next = saved ?? defaultLayout(defaultIndicators(market), chartPrefs.chartType, chartPrefs.scale);
    setLayout(next);
    dispatch({ type: "reset", items: next.drawings });
    setLoadedKey(layoutKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);
  useEffect(() => {
    if (loadedKey !== layoutKey) return;
    const store = safeStorage();
    if (!store) return;
    const t = setTimeout(() => saveChartState(store, market, code, intervalKey, { ...layout, drawings: history.items }), 250);
    return () => clearTimeout(t);
  }, [layout, history.items, loadedKey, layoutKey, market, code, intervalKey]);

  // One-time migration of legacy `ke-chart-draw:{code}` (KR daily).
  useEffect(() => {
    if (market !== "KR" || interval !== "day" || !rawBars.length || loadedKey !== layoutKey) return;
    const store = safeStorage();
    if (!store) return;
    const n = migrateLegacyOnce(store, code, rawBars.map((b) => barTimeOf(b.date, market)), { ...layout, drawings: history.items });
    if (n > 0) {
      const next = loadChartState(store, market, code, intervalKey);
      if (next) dispatch({ type: "reset", items: next.drawings });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawBars, loadedKey, layoutKey]);

  // ── Replay ─────────────────────────────────────────────────────────────
  const replayable = interval === "day" || interval === "week";
  const [replay, setReplay] = useState<{ cursor: number; playing: boolean; speed: number } | null>(null);
  useEffect(() => {
    if (!replay?.playing) return;
    const id = setInterval(() => {
      setReplay((r) => {
        if (!r) return r;
        const next = replayStep(r.cursor, rawBars.length);
        return next == null ? { ...r, cursor: rawBars.length - 1, playing: false } : { ...r, cursor: next };
      });
    }, replayTickMs(replay.speed));
    return () => clearInterval(id);
  }, [replay?.playing, replay?.speed, rawBars.length]);
  useEffect(() => setReplay(null), [layoutKey]);

  const bars = useMemo(() => capBars(replaySlice(rawBars, replay ? replay.cursor : null)), [rawBars, replay]);
  const times = useMemo(() => bars.map((b) => barTimeOf(b.date, market)), [bars, market]);
  const timeIndex = useMemo(() => new Map(times.map((t, i) => [t, i])), [times]);
  const version = `${bars.length}|${bars[0]?.date ?? ""}|${bars[bars.length - 1]?.date ?? ""}|${bars[bars.length - 1]?.close ?? ""}`;
  const catalogBars = useMemo<CatalogBars>(
    () => ({
      open: bars.map((b) => b.open),
      high: bars.map((b) => b.high),
      low: bars.map((b) => b.low),
      close: bars.map((b) => b.close),
      volume: bars.map((b) => b.volume),
      sessionKeys: interval === "minute" ? bars.map((b) => b.date.slice(0, 10)) : undefined,
    }),
    [bars, interval],
  );

  // ── Indicator values (memoized by data version + params) ───────────────
  const cacheRef = useRef(new Map<string, Record<string, Series>>());
  const values = useMemo(() => {
    const out = new Map<string, Record<string, Series>>();
    const cache = cacheRef.current;
    for (const inst of layout.indicators) {
      if (!inst.visible) continue;
      const key = indicatorCacheKey(version, inst);
      let v = cache.get(key);
      if (!v) {
        v = computeInstance(inst, catalogBars, times);
        cache.set(key, v);
        if (cache.size > 200) cache.delete(cache.keys().next().value!);
      }
      out.set(inst.uid, v);
    }
    return out;
  }, [layout.indicators, version, catalogBars, times]);

  // ── Main series ────────────────────────────────────────────────────────
  const mainRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const drawingPrim = useRef(new DrawingPrimitive());
  const sessionPrim = useRef(new SessionPrimitive());
  const vpPrim = useRef(new VolumeProfilePrimitive());
  const rangePrim = useRef(new RangeMarkerPrimitive());
  const [mainEpoch, setMainEpoch] = useState(0);
  const compareActive = useRef(false);

  useEffect(() => {
    if (!chart) return;
    const type = layout.chartType;
    const pf = priceFormatFor(market, rawBars[rawBars.length - 1]?.close);
    const common = { priceFormat: pf, priceLineVisible: true, lastValueVisible: true } as const;
    let s: ISeriesApi<SeriesType>;
    if (type === "line") s = chart.addSeries(LineSeries, { ...common, color: theme.text, lineWidth: 2 });
    else if (type === "area") s = chart.addSeries(AreaSeries, { ...common, lineColor: "#38bdf8", topColor: "rgba(56,189,248,0.28)", bottomColor: "rgba(56,189,248,0.02)" });
    else if (type === "baseline")
      s = chart.addSeries(BaselineSeries, { ...common, baseValue: { type: "price", price: rawBars[0]?.close ?? 0 }, topLineColor: upColor, bottomLineColor: downColor, topFillColor1: `${upColor}33`, bottomFillColor2: `${downColor}33` });
    else if (type === "bars") s = chart.addSeries(BarSeries, { ...common, upColor, downColor, thinBars: false });
    else
      s = chart.addSeries(CandlestickSeries, {
        ...common,
        upColor: type === "hollow" ? "rgba(0,0,0,0)" : upColor,
        downColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
        wickUpColor: upColor,
        wickDownColor: downColor,
      });
    mainRef.current = s;
    s.attachPrimitive(sessionPrim.current);
    s.attachPrimitive(vpPrim.current);
    s.attachPrimitive(drawingPrim.current);
    s.attachPrimitive(rangePrim.current);
    markersRef.current = createSeriesMarkers(s, []);
    setMainEpoch((e) => e + 1);
    return () => {
      markersRef.current?.detach();
      markersRef.current = null;
      try {
        s.detachPrimitive(drawingPrim.current);
        s.detachPrimitive(rangePrim.current);
        s.detachPrimitive(vpPrim.current);
        s.detachPrimitive(sessionPrim.current);
        chart.removeSeries(s);
      } catch {
        /* chart already removed */
      }
      mainRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, layout.chartType, upColor, downColor, market]);

  // Main data.
  useEffect(() => {
    const s = mainRef.current;
    if (!s) return;
    const type = layout.chartType;
    const src = type === "heikin-ashi" ? heikinAshi(bars) : bars;
    if (type === "line" || type === "area" || type === "baseline") {
      s.setData(src.map((b, i) => ({ time: times[i] as Time, value: b.close })));
    } else {
      s.setData(src.map((b, i) => ({ time: times[i] as Time, open: b.open, high: b.high, low: b.low, close: b.close })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainEpoch, bars, times, layout.chartType]);

  // Fit once per dataset key.
  const fittedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!chart || !rawBars.length) return;
    const key = `${layoutKey}|${props.range ?? ""}|${props.minuteSize ?? ""}`;
    if (fittedKey.current === key) return;
    fittedKey.current = key;
    const n = rawBars.length;
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - (interval === "minute" ? 160 : 180)), to: n + 4 });
  }, [chart, rawBars.length, layoutKey, props.range, props.minuteSize, interval]);

  // ── Compare overlay (F7.8) ─────────────────────────────────────────────
  const [compare, setCompare] = useState<string[]>([]);
  const [compareBars, setCompareBars] = useState<Record<string, OhlcBar[] | null>>({});
  const onCompareBars = useCallback((sym: string, b: OhlcBar[] | null) => setCompareBars((m) => (m[sym] === b ? m : { ...m, [sym]: b })), []);
  const compareSeries = useRef(new Map<string, ISeriesApi<"Line">>());
  useEffect(() => {
    if (!chart) return;
    const map = compareSeries.current;
    for (const [sym, s] of map) {
      if (!compare.includes(sym)) {
        chart.removeSeries(s);
        map.delete(sym);
      }
    }
    compare.forEach((sym, i) => {
      let s = map.get(sym);
      if (!s) {
        s = chart.addSeries(LineSeries, { color: COMPARE_COLORS[i % 3], lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: sym.split(":")[1] });
        map.set(sym, s);
      }
      const other = (compareBars[sym] ?? []).map((b) => ({ time: barTimeOf(b.date, sym.startsWith("US") ? "US" : "KR"), close: b.close }));
      const aligned = alignByTime(times, other);
      s.setData(times.map((t, j) => (aligned[j] == null ? { time: t as Time } : { time: t as Time, value: aligned[j]! })));
    });
    compareActive.current = compare.length > 0;
  }, [chart, compare, compareBars, times, mainEpoch]);

  // Price scale mode (compare forces % from first visible bar).
  useEffect(() => {
    if (!chart) return;
    chart.priceScale("right").applyOptions({ mode: compare.length ? PriceScaleMode.Percentage : SCALE_MODE[layout.scale] });
  }, [chart, layout.scale, compare.length, mainEpoch]);

  // ── Indicator series ───────────────────────────────────────────────────
  const indSeries = useRef(new Map<string, { series: Map<string, ISeriesApi<SeriesType>>; lines: IPriceLine[] }>());
  const pivotLines = useRef<IPriceLine[]>([]);
  const structureKey = JSON.stringify(layout.indicators.map((i) => [i.uid, i.id, i.visible, i.color, i.params]));
  useEffect(() => {
    if (!chart) return;
    const store = indSeries.current;
    for (const [, v] of store) for (const s of v.series.values()) chart.removeSeries(s);
    store.clear();
    for (let i = chart.panes().length - 1; i >= 1; i--) {
      const pane = chart.panes()[i];
      if (pane && pane.getSeries().length === 0) chart.removePane(i);
    }
    let pane = 1;
    layout.indicators.forEach((inst, idx) => {
      if (!inst.visible) return;
      const def = INDICATOR_BY_ID.get(inst.id);
      if (!def || def.render !== "series") return;
      const paneIndex = def.pane === "separate" ? pane++ : 0;
      const color = inst.color ?? PALETTE[idx % PALETTE.length]!;
      const series = new Map<string, ISeriesApi<SeriesType>>();
      const lines: IPriceLine[] = [];
      def.outputs.forEach((o, oi) => {
        const c = oi === 0 ? color : o.key === "signal" || o.key === "d" || o.key === "minusDi" ? "#f97316" : o.key === "plusDi" ? "#22c55e" : o.key === "lower" || o.key === "p10" || o.key === "low" ? color : `${color}`;
        let s: ISeriesApi<SeriesType>;
        if (o.style === "histogram") {
          s = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false, priceFormat: inst.id === "volume" ? { type: "volume" } : { type: "price", precision: 2, minMove: 0.01 } }, paneIndex);
        } else {
          s = chart.addSeries(
            LineSeries,
            {
              color: o.style === "dots" ? color : oi === 0 ? c : def.outputs.length > 2 && oi === 1 ? `${color}` : c,
              lineWidth: 1,
              lineStyle: def.id === "ichimoku" && (o.key === "spanA" || o.key === "spanB") ? LineStyle.Dotted : LineStyle.Solid,
              lineVisible: o.style !== "dots",
              pointMarkersVisible: o.style === "dots",
              pointMarkersRadius: 1.5,
              priceLineVisible: false,
              lastValueVisible: def.pane === "separate",
              crosshairMarkerVisible: false,
              priceFormat: def.pane === "overlay" ? priceFormatFor(market, rawBars[rawBars.length - 1]?.close) : { type: "price", precision: 2, minMove: 0.01 },
            },
            paneIndex,
          );
        }
        for (const lv of o.levels ?? []) lines.push(s.createPriceLine({ price: lv, color: "rgba(148,163,184,0.5)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "" }));
        series.set(o.key, s);
      });
      store.set(inst.uid, { series, lines });
    });
    const panes = chart.panes();
    // Main pane keeps most of the height; each indicator pane gets one share.
    panes[0]?.setStretchFactor(Math.max(3, panes.length));
    for (let i = 1; i < panes.length; i++) panes[i]?.setStretchFactor(1);
    setIndEpoch((e) => e + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, structureKey, market]);
  const [indEpoch, setIndEpoch] = useState(0);

  // Indicator data.
  useEffect(() => {
    for (const inst of layout.indicators) {
      const entry = indSeries.current.get(inst.uid);
      const v = values.get(inst.uid);
      if (!entry || !v) continue;
      for (const [key, s] of entry.series) {
        const arr = v[key] ?? [];
        if (inst.id === "volume" && key === "v") {
          s.setData(bars.map((b, i) => ({ time: times[i] as Time, value: b.volume, color: b.close >= b.open ? `${upColor}88` : `${downColor}88` })));
        } else if (key === "hist") {
          s.setData(times.map((t, i) => { const x = arr[i]; return x == null ? { time: t as Time } : { time: t as Time, value: x, color: x >= 0 ? `${upColor}99` : `${downColor}99` }; }));
        } else {
          // Always aligned to bar times (an output may be shorter/longer than the bars).
          s.setData(times.map((t, i) => { const x = arr[i]; return x == null ? { time: t as Time } : { time: t as Time, value: x }; }));
        }
      }
    }
  }, [values, indEpoch, bars, times, layout.indicators, upColor, downColor]);

  // Pivots (price lines from the previous bar) + volume profile (visible window).
  const [visible, setVisible] = useState<{ from: number; to: number } | null>(null);
  useEffect(() => {
    const s = mainRef.current;
    if (!s) return;
    for (const l of pivotLines.current) s.removePriceLine(l);
    pivotLines.current = [];
    const piv = layout.indicators.find((i) => i.id === "pivots" && i.visible);
    const prev = bars[bars.length - 2];
    if (piv && prev) {
      const lv = pivotPoints(prev.high, prev.low, prev.close, String(piv.params.kind) as PivotKind);
      for (const [k, p] of Object.entries(lv)) {
        pivotLines.current.push(s.createPriceLine({ price: p, color: k === "p" ? "#f59e0b" : k.startsWith("r") ? "#ef444499" : "#3b82f699", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: k.toUpperCase() }));
      }
    }
  }, [mainEpoch, layout.indicators, bars]);
  useEffect(() => {
    const catalog = layout.indicators.find((i) => i.id === "vprofile" && i.visible);
    const builtin = vp.enabled;
    if (!builtin && !catalog) {
      vpPrim.current.set(null);
      return;
    }
    const w = visibleWindow(bars.length, visible);
    const slice = builtin && !vp.visibleOnly ? bars : bars.slice(w.from, w.to + 1);
    if (slice.length < 30) {
      vpPrim.current.set(null);
      return;
    }
    const profile = volumeProfile(
      slice,
      builtin ? vp.rows : Number(catalog?.params.rows ?? 24),
      builtin ? 0.7 : Number(catalog?.params.va ?? 0.7),
      builtin ? vp.basis : "volume",
    );
    const narrow = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    const ratio = narrow ? Math.min(VP_WIDTH[vp.width], 0.08) : VP_WIDTH[vp.width];
    vpPrim.current.set(profile);
    vpPrim.current.setStyle({
      widthRatio: builtin ? ratio : 0.1,
      opacity: builtin ? vp.opacity : 0.22,
      showVa: builtin ? vp.showVa : true,
      showPoc: builtin ? vp.showPoc : true,
      hoverPrice: null,
    });
  }, [layout.indicators, bars, visible, vp, mainEpoch]);

  // Visible range tracking.
  const onVisibleRangeRef = useRef(props.onVisibleRange);
  onVisibleRangeRef.current = props.onVisibleRange;
  useEffect(() => {
    if (!chart) return;
    const h = (r: { from: number; to: number } | null) => {
      setVisible(r ? { from: r.from, to: r.to } : null);
      onVisibleRangeRef.current?.(r ? { from: r.from, to: r.to } : null);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(h);
    return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(h);
  }, [chart]);

  // Crosshair / time sync (F7.4).
  useEffect(() => {
    if (!chart || !props.sync || !mainRef.current) return;
    return props.sync.register(props.syncId ?? layoutKey, chart, mainRef.current, (t) => {
      const idx = t == null ? undefined : stateRef.current.timeIndex.get(t as string | number);
      setHoverIdx(idx ?? null);
    });
  }, [chart, props.sync, props.syncId, layoutKey, mainEpoch]);

  // ── Session shading (F7.13) ────────────────────────────────────────────
  useEffect(() => {
    if (interval !== "minute") return sessionPrim.current.set([], []);
    const tb = times.map((t) => ({ time: t }));
    sessionPrim.current.set(extendedHoursRuns(tb, market), sessionBreaks(tb, market));
  }, [times, interval, market, mainEpoch]);

  // ── Event overlays (F7.10) ─────────────────────────────────────────────
  const overlays = layout.overlays;
  const newsFeed = useFeed({ region: market, tickers: [code], limit: 100, enabled: overlays.news, refetchMs: 180_000 });
  const newsByBar = useMemo(() => {
    const m = new Map<string | number, FeedItem[]>();
    if (!overlays.news) return m;
    const dayIdx = new Map<string, string | number>();
    for (const t of times) {
      const d = dayOfTime(t, market);
      if (!dayIdx.has(d) || interval !== "minute") dayIdx.set(d, t);
    }
    for (const it of newsFeed.items) {
      if (!it.publishedAt) continue;
      const day = market === "US" ? dayOfTime(Math.floor(Date.parse(it.publishedAt) / 1000), "US") : kstDayKey(it.publishedAt);
      const t = day ? dayIdx.get(day) : undefined;
      if (t === undefined) continue;
      m.set(t, [...(m.get(t) ?? []), it]);
    }
    return m;
  }, [overlays.news, newsFeed.items, times, market, interval]);
  const [newsList, setNewsList] = useState<FeedItem[] | null>(null);

  useEffect(() => {
    const api = markersRef.current;
    if (!api) return;
    const out: SeriesMarker<Time>[] = [];
    const has = (t: string | number) => timeIndex.has(t);
    if (overlays.disclosures) for (const e of props.disclosureMarkers ?? []) if (has(e.time)) out.push({ time: e.time as Time, position: "aboveBar", color: "#f59e0b", shape: "circle", text: "공시" });
    if (overlays.signals) for (const m of props.signalMarkers ?? []) if (has(m.time)) out.push({ time: m.time as Time, position: m.position ?? "aboveBar", color: m.color ?? "#a78bfa", shape: m.shape ?? "circle", text: m.text });
    if (overlays.research) for (const m of props.researchMarkers ?? []) if (has(m.time)) out.push({ time: m.time as Time, position: m.position ?? "belowBar", color: m.color ?? "#2dd4bf", shape: m.shape ?? "square", text: m.text });
    if (overlays.dividends) {
      for (const d of props.events?.dividends ?? []) if (has(d.date)) out.push({ time: d.date as Time, position: "belowBar", color: "#22c55e", shape: "circle", text: `배당 $${d.amount}` });
      for (const d of props.events?.splits ?? []) if (has(d.date)) out.push({ time: d.date as Time, position: "belowBar", color: "#eab308", shape: "square", text: `분할 ${d.ratio}` });
    }
    if (overlays.news) for (const [t, items] of newsByBar) out.push({ time: t as Time, position: "aboveBar", color: "#38bdf8", shape: "circle", text: `뉴스 ${items.length}` });
    out.sort((a, b) => (timeIndex.get(a.time as string | number) ?? 0) - (timeIndex.get(b.time as string | number) ?? 0));
    api.setMarkers(out);
  }, [overlays, props.disclosureMarkers, props.signalMarkers, props.researchMarkers, props.events, newsByBar, timeIndex, mainEpoch]);

  // ── Drawing interaction (F7.7) ─────────────────────────────────────────
  const [tool, setTool] = useState<Tool>("cursor");
  const [magnet, setMagnet] = useState(true);
  const [pending, setPending] = useState<Anchor[]>([]);
  const [preview, setPreview] = useState<Drawing | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Drawing | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  useEffect(() => {
    const price = hoverIdx != null ? bars[hoverIdx]?.close ?? null : null;
    vpPrim.current.setStyle({ hoverPrice: price });
  }, [hoverIdx, bars, mainEpoch]);
  const [pendingAvwap, setPendingAvwap] = useState<string | null>(null);
  const shown = useMemo(() => (dragging ? history.items.map((d) => (d.id === dragging.id ? dragging : d)) : history.items), [history.items, dragging]);

  useEffect(() => {
    const p = drawingPrim.current;
    p.formatPrice = fmt;
    p.barsBetween = (a, b) => {
      const i = timeIndex.get(a);
      const j = timeIndex.get(b);
      return i == null || j == null ? null : Math.abs(j - i);
    };
    p.set(shown, selected, preview);
  }, [shown, selected, preview, fmt, timeIndex, mainEpoch]);

  const toolRef = useRef(tool);
  toolRef.current = tool;
  const stateRef = useRef({ pending, magnet, bars, times, timeIndex, history, selected, newsByBar, pendingAvwap });
  stateRef.current = { pending, magnet, bars, times, timeIndex, history, selected, newsByBar, pendingAvwap };

  const anchorAt = useCallback(
    (x: number, y: number, t: Time | undefined): Anchor | null => {
      const s = mainRef.current;
      if (!s || !chart) return null;
      const st = stateRef.current;
      let time = t as string | number | undefined;
      if (time === undefined) {
        const lg = chart.timeScale().coordinateToLogical(x);
        if (lg == null) return null;
        time = st.times[Math.max(0, Math.min(st.times.length - 1, Math.round(lg)))];
      }
      if (time === undefined) return null;
      const raw = s.coordinateToPrice(y);
      if (raw == null) return null;
      const idx = st.timeIndex.get(time);
      const bar = idx != null ? st.bars[idx] : undefined;
      return { t: time, p: snapPrice(raw, { market, instrument: props.instrument, magnet: st.magnet, bar }) };
    },
    [chart, market, props.instrument],
  );

  useEffect(() => {
    if (!chart) return;
    const onMove = (param: MouseEventParams<Time>) => {
      const st = stateRef.current;
      const idx = param.time != null ? st.timeIndex.get(param.time as string | number) : undefined;
      setHoverIdx(idx ?? null);
      props.onHover?.(idx != null ? st.bars[idx]! : null);
      const cur = toolRef.current;
      if (cur === "cursor" || cur === "replay-pick" || cur === "avwap-anchor" || !param.point || !st.pending.length) return;
      const a = anchorAt(param.point.x, param.point.y, param.time);
      if (a) setPreview(newDrawing(cur, [...st.pending, a], "preview"));
    };
    chart.subscribeCrosshairMove(onMove);
    return () => {
      chart.unsubscribeCrosshairMove(onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, anchorAt]);

  /**
   * Tap/click handling from DOM pointer events: lightweight-charts swallows a
   * second click inside its double-click window, which breaks quick two-point
   * drawing. A press that moves < 5 px is a click.
   */
  const handleClick = useCallback(
    (x: number, y: number) => {
      const st = stateRef.current;
      const cur = toolRef.current;
      const a = anchorAt(x, y, undefined);
      if (cur === "replay-pick") {
        const idx = a ? st.timeIndex.get(a.t) : undefined;
        if (idx != null) setReplay({ cursor: idx, playing: false, speed: 1 });
        setTool("cursor");
        return;
      }
      if (cur === "avwap-anchor") {
        if (a && st.pendingAvwap) {
          const at = a.t;
          setLayout((l) => ({ ...l, indicators: l.indicators.map((i) => (i.uid === st.pendingAvwap ? { ...i, anchorTime: at } : i)) }));
        }
        setPendingAvwap(null);
        setTool("cursor");
        return;
      }
      if (cur === "cursor") {
        const hit = drawingPrim.current.hit(x, y);
        if (hit) return setSelected(hit.id);
        setSelected(null);
        if (a && st.newsByBar.has(a.t)) setNewsList(st.newsByBar.get(a.t)!);
        return;
      }
      if (!a) return;
      const next = [...st.pending, a];
      if (next.length >= anchorsFor(cur)) {
        const d = newDrawing(cur, next, uid());
        dispatch({ type: "add", drawing: d });
        setSelected(d.id);
        setPending([]);
        setPreview(null);
        setTool("cursor");
      } else setPending(next);
    },
    [anchorAt],
  );

  // Drag selected drawing / handle (pointer events on the container).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !chart) return;
    let drag: { id: string; handle: number | null; start: Anchor; orig: Drawing } | null = null;
    let press: { x: number; y: number } | null = null;
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      press = local(e);
      if (toolRef.current !== "cursor") return;
      const { x, y } = local(e);
      const hit = drawingPrim.current.hit(x, y);
      if (!hit) return;
      const d = stateRef.current.history.items.find((i) => i.id === hit.id);
      if (!d || d.locked) {
        setSelected(hit.id);
        return;
      }
      const a = anchorAt(x, y, undefined);
      if (!a) return;
      drag = { id: d.id, handle: hit.handle, start: a, orig: d };
      setSelected(d.id);
      chart.applyOptions({ handleScroll: false, handleScale: false });
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const { x, y } = local(e);
      const a = anchorAt(x, y, undefined);
      if (!a) return;
      const st = stateRef.current;
      let anchors: Anchor[];
      if (drag.handle != null) anchors = drag.orig.anchors.map((p, i) => (i === drag!.handle ? a : p));
      else {
        const di = (st.timeIndex.get(a.t) ?? 0) - (st.timeIndex.get(drag.start.t) ?? 0);
        const dp = a.p - drag.start.p;
        anchors = drag.orig.anchors.map((p) => {
          const i = st.timeIndex.get(p.t);
          const t = i == null ? p.t : st.times[Math.max(0, Math.min(st.times.length - 1, i + di))]!;
          return { t, p: p.p + dp };
        });
      }
      setDragging({ ...drag.orig, anchors });
    };
    const up = (e: PointerEvent) => {
      const p0 = press;
      press = null;
      if (!drag) {
        const q = local(e);
        if (p0 && Math.abs(q.x - p0.x) + Math.abs(q.y - p0.y) < 5) handleClick(q.x, q.y);
        return;
      }
      const id = drag.id;
      const moved = p0 ? Math.abs(local(e).x - p0.x) + Math.abs(local(e).y - p0.y) >= 5 : true;
      drag = null;
      chart.applyOptions({ handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false }, handleScale: true });
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* not captured */
      }
      setDragging((cur) => {
        if (cur && cur.id === id && moved) dispatch({ type: "update", id, patch: { anchors: cur.anchors } });
        return null;
      });
    };
    el.addEventListener("pointerdown", down, { capture: true });
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down, { capture: true });
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [chart, anchorAt, handleClick]);

  const cancelTool = () => {
    setTool("cursor");
    setPending([]);
    setPreview(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      dispatch({ type: e.shiftKey ? "redo" : "undo" });
      return;
    }
    if (e.key === "Escape") return cancelTool();
    if ((e.key === "Delete" || e.key === "Backspace") && selected) {
      e.preventDefault();
      dispatch({ type: "remove", id: selected });
      setSelected(null);
      return;
    }
    if (mod || e.altKey) return;
    const t = DRAWING_TOOLS.find((x) => x.key === e.key.toLowerCase());
    if (t) {
      setTool(t.type);
      setPending([]);
      setPreview(null);
    }
  };

  // ── Alerts (F7.11) ─────────────────────────────────────────────────────
  const myAlerts = useMemo(() => priceAlerts.filter((a) => a.market === market && a.code.toUpperCase() === code.toUpperCase()), [priceAlerts, market, code]);
  const lastBar = rawBars[rawBars.length - 1];
  useEffect(() => {
    if (!lastBar || replay) return;
    const now = new Date().toISOString();
    const closes = rawBars.map((b) => b.close);
    for (const a of myAlerts) {
      if (!a.active) continue;
      if (a.kind === "price-cross") {
        const r = evaluatePriceAlert(a, lastBar.close, now);
        if (r.next !== a && (r.fired || r.next.lastSide !== a.lastSide)) upsertPriceAlert(r.next);
        if (r.fired) notifyAlert(`${props.name ?? code} ${fmt(a.level!)} ${r.direction === "up" ? "상향" : "하향"} 돌파`, `현재 ${fmt(lastBar.close)} · ${props.source}`);
      } else {
        const input =
          a.kind === "rsi-cross"
            ? { rsi: calcRsi(closes, 14).slice(-2), barKey: lastBar.date }
            : { fast: calcSma(closes, a.fast ?? 20).slice(-2), slow: calcSma(closes, a.slow ?? 60).slice(-2), barKey: lastBar.date };
        const r = evaluateIndicatorAlert(a, input, now);
        if (r.fired) {
          upsertPriceAlert(r.next);
          notifyAlert(
            `${props.name ?? code} ${a.kind === "rsi-cross" ? `RSI ${a.level}` : `이평 ${a.fast}/${a.slow}`} ${r.direction === "up" ? "상향" : "하향"} 교차`,
            `${lastBar.date} · ${props.source}`,
          );
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastBar?.date, lastBar?.close, myAlerts.length]);

  const toggleHlineAlert = (d: Drawing) => {
    if (d.alertId) {
      removePriceAlert(d.alertId);
      dispatch({ type: "update", id: d.id, patch: { alertId: undefined } });
      return;
    }
    const price = d.anchors[0]!.p;
    const cur = lastBar?.close;
    const alert: PriceAlert = {
      id: `pa-${uid()}`,
      market,
      code: code.toUpperCase(),
      name: props.name,
      kind: "price-cross",
      level: price,
      direction: cur == null ? "any" : cur < price ? "up" : "down",
      repeat: "once",
      active: true,
      createdAt: new Date().toISOString(),
      lastSide: cur == null ? undefined : cur >= price ? "above" : "below",
    };
    upsertPriceAlert(alert);
    dispatch({ type: "update", id: d.id, patch: { alertId: alert.id } });
  };

  // ── Toolbar actions ────────────────────────────────────────────────────
  const [panel, setPanel] = useState<null | "indicators" | "objects" | "alerts">(null);
  const [compareInput, setCompareInput] = useState("");
  const setType = (t: ChartType) => {
    setLayout((l) => ({ ...l, chartType: t }));
    setChartPrefs({ chartType: t });
  };
  const setScale = (s: ChartScale) => {
    setLayout((l) => ({ ...l, scale: s }));
    setChartPrefs({ scale: s });
  };
  const addIndicator = (def: IndicatorDef) => {
    const inst = newInstance(def.id, undefined, PALETTE[layout.indicators.length % PALETTE.length]);
    setLayout((l) => ({ ...l, indicators: [...l.indicators, inst] }));
    if (def.anchored) {
      setPendingAvwap(inst.uid);
      setTool("avwap-anchor");
      setPanel(null);
    }
  };
  const autoSR = () => {
    const hs = bars.map((b) => b.high);
    const ls = bars.map((b) => b.low);
    const p = findPivots(hs, ls, 5, 5);
    const pick = [...p.highIdx.slice(-3).map((i) => ({ i, p: hs[i]! })), ...p.lowIdx.slice(-3).map((i) => ({ i, p: ls[i]! }))];
    for (const x of pick) dispatch({ type: "add", drawing: { ...newDrawing("hray", [{ t: times[x.i]!, p: x.p }], uid(), { color: "#94a3b8", width: 1 }) } });
  };
  const addCompare = () => {
    const raw = compareInput.trim().toUpperCase();
    const sym = /^[0-9][0-9A-Z]{5}$/.test(raw) ? `KR:${raw}` : /^[A-Z][A-Z0-9.]{0,9}$/.test(raw) ? `US:${raw}` : null;
    if (sym && !compare.includes(sym) && compare.length < 3 && sym !== `${market}:${code.toUpperCase()}`) setCompare((c) => [...c, sym]);
    setCompareInput("");
  };
  const templates = Object.keys(chartPrefs.templates ?? {});

  // ── Export (F7.2) ──────────────────────────────────────────────────────
  const exportPng = () => {
    if (!chart) return;
    downloadCanvasPng(chart.takeScreenshot(true, false), chartExportName(market, code, intervalKey, "png", Date.now()));
  };
  const exportCsv = () => {
    const w = visibleWindow(bars.length, visible);
    const rows = bars.slice(w.from, w.to + 1).map((b, i) => ({ time: times[w.from + i]!, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }));
    const extra: { name: string; values: (number | null)[] }[] = [];
    for (const inst of layout.indicators) {
      const v = values.get(inst.uid);
      const def = INDICATOR_BY_ID.get(inst.id);
      if (!v || !def || inst.id === "volume") continue;
      for (const o of def.outputs) extra.push({ name: `${instanceLabel(inst)}${def.outputs.length > 1 ? `.${o.key}` : ""}`, values: (v[o.key] ?? []).slice(w.from, w.to + 1) });
    }
    downloadCsv(barsToCsv(rows, extra), chartExportName(market, code, intervalKey, "csv", Date.now()));
  };

  // ── HUD + legend ───────────────────────────────────────────────────────
  const hi = hoverIdx ?? bars.length - 1;
  const hb = bars[hi];
  const prevClose = hi > 0 ? bars[hi - 1]?.close : undefined;
  const legend: LegendItem[] = [
    ...layout.indicators.map((inst) => {
      const def = INDICATOR_BY_ID.get(inst.id);
      const v = values.get(inst.uid);
      const first = def?.outputs[0]?.key;
      const val = first && v ? v[first]?.[hi] : null;
      return {
        id: inst.uid,
        label: instanceLabel(inst),
        color: inst.color,
        value: val != null ? (def?.pane === "overlay" ? fmt(val) : inst.id === "volume" ? formatChartVolume(val, market) : val.toFixed(2)) : null,
        visible: inst.visible,
        onToggle: () => setLayout((l) => ({ ...l, indicators: l.indicators.map((i) => (i.uid === inst.uid ? { ...i, visible: !i.visible } : i)) })),
      };
    }),
    ...compare.map((sym, i) => {
      const other = (compareBars[sym] ?? []).map((b) => ({ time: barTimeOf(b.date, sym.startsWith("US") ? "US" : "KR"), close: b.close }));
      const aligned = alignByTime(times, other);
      const w = visibleWindow(times.length, visible);
      const pct = percentFromFirstVisible(aligned, w.from).slice(0, w.to + 1);
      const last = [...pct].reverse().find((x) => x != null);
      return {
        id: `cmp-${sym}`,
        label: `비교 ${sym.split(":")[1]}`,
        color: COMPARE_COLORS[i % 3],
        value: compareBars[sym] == null ? "수신 중" : compareBars[sym]!.length === 0 ? "데이터 없음" : last != null ? formatChartPercent(last) : "—",
        visible: true,
        onToggle: () => setCompare((c) => c.filter((x) => x !== sym)),
      };
    }),
  ];

  const rangeStats = useMemo(() => {
    if (bars.length < 2) return null;
    const w = visibleWindow(bars.length, visible);
    const close = bars[bars.length - 1]?.close;
    return computeRangePosition(
      bars.map((b) => ({ high: b.high, low: b.low, close: b.close, date: b.date })),
      { from: w.from, to: w.to, close, recentSpan: vp.recentSpan },
    );
  }, [bars, visible, vp.recentSpan]);

  useEffect(() => {
    const prim = rangePrim.current;
    if (!vp.rangeOn || !rangeStats) {
      prim.set([], null, null);
      return;
    }
    const lastTime = times[times.length - 1];
    const lastPrice = bars[bars.length - 1]?.close;
    if (lastTime == null || lastPrice == null) {
      prim.set([], null, null);
      return;
    }
    const marks = planRangeMarkers(rangeStats).flatMap((p) => {
      const time = times[p.idx];
      if (time == null) return [];
      const copy = rangeMarkerText(p, fmt(p.price), formatChartPercent(p.pct));
      return [{ time, price: p.price, role: p.role, place: copy.place, title: copy.title, pctText: copy.pctText, color: p.role === "high" ? downColor : upColor }];
    });
    prim.set(marks, lastTime, lastPrice);
  }, [vp.rangeOn, rangeStats, times, bars, fmt, upColor, downColor, mainEpoch]);

  const vpProfile = useMemo(() => {
    if (!vp.enabled || bars.length < 30) return null;
    const w = visibleWindow(bars.length, visible);
    const slice = vp.visibleOnly ? bars.slice(w.from, w.to + 1) : bars;
    if (slice.length < 30) return null;
    return volumeProfile(slice, vp.rows, 0.7, vp.basis);
  }, [vp.enabled, vp.visibleOnly, vp.rows, vp.basis, bars, visible]);

  const hud = hb ? (
    <div className="flex flex-wrap items-center gap-x-2 tabular" data-testid="chart-ohlc">
      <span className="text-muted-foreground">{hb.date}</span>
      <span>O {fmt(hb.open)}</span>
      <span>H {fmt(hb.high)}</span>
      <span>L {fmt(hb.low)}</span>
      <span style={{ color: hb.close >= hb.open ? upColor : downColor }}>C {fmt(hb.close)}</span>
      {prevClose ? <span style={{ color: hb.close >= prevClose ? upColor : downColor }}>{formatChartPercent(((hb.close - prevClose) / prevClose) * 100)}</span> : null}
      <span className="text-muted-foreground">V {formatChartVolume(hb.volume, market)}</span>
      {rangeStats ? <RangeHud stats={rangeStats} up={upColor} down={downColor} /> : null}
      {vpProfile?.poc != null && (
        <span className="text-muted-foreground">
          POC {fmt(vpProfile.poc)}
          {vpProfile.val != null && vpProfile.vah != null ? ` · VA ${fmt(vpProfile.val)}–${fmt(vpProfile.vah)}` : ""}
          {vp.basis === "turnover" ? " · 거래대금" : " · 거래량"}
        </span>
      )}
      {replay && <span className="rounded bg-amber-500/15 px-1 font-semibold text-amber-500">리플레이 {replay.cursor + 1}/{rawBars.length}</span>}
    </div>
  ) : null;

  const btn = (on: boolean) => cn("inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-[11px] font-medium", on ? "bg-desk-gold/20 text-desk-gold ring-1 ring-desk-gold/40" : "bg-muted text-muted-foreground hover:text-foreground");
  const toolbar = (
    <>
      <select value={layout.chartType} onChange={(e) => setType(e.target.value as ChartType)} className="h-8 rounded-md border border-border bg-background px-1.5 text-[11px]" aria-label="차트 종류" data-testid="chart-type">
        {CHART_TYPES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <select value={compare.length ? "percent" : layout.scale} onChange={(e) => setScale(e.target.value as ChartScale)} disabled={compare.length > 0} className="h-8 rounded-md border border-border bg-background px-1.5 text-[11px]" aria-label="스케일" title={compare.length ? "비교 중에는 첫 보이는 봉 대비 %" : undefined}>
        {CHART_SCALES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <button type="button" className={btn(false)} onClick={() => setPanel("indicators")} data-testid="open-indicators">
        <BrainCircuit className="size-3.5" /> 지표
      </button>
      <span className="mx-0.5 h-5 w-px bg-border" />
      <button type="button" className={btn(tool === "cursor")} onClick={cancelTool} title="선택 (Esc)" aria-label="선택 도구">
        <MousePointer2 className="size-3.5" />
      </button>
      <select
        value={tool !== "cursor" && tool !== "replay-pick" && tool !== "avwap-anchor" ? tool : ""}
        onChange={(e) => {
          setTool((e.target.value || "cursor") as Tool);
          setPending([]);
          setPreview(null);
        }}
        className="h-8 rounded-md border border-border bg-background px-1.5 text-[11px]"
        aria-label="그리기 도구"
        data-testid="drawing-tool"
      >
        <option value="">그리기…</option>
        {DRAWING_TOOLS.map((t) => (
          <option key={t.type} value={t.type}>
            {t.label} ({t.key.toUpperCase()})
          </option>
        ))}
      </select>
      <button type="button" className={btn(magnet)} onClick={() => setMagnet((v) => !v)} title="자석 (OHLC 스냅)" aria-pressed={magnet}>
        <Magnet className="size-3.5" /> 자석
      </button>
      <button type="button" className={btn(false)} onClick={() => dispatch({ type: "undo" })} disabled={!history.past.length} title="실행 취소 (Ctrl/⌘+Z)" aria-label="실행 취소">
        <Undo2 className="size-3.5" />
      </button>
      <button type="button" className={btn(false)} onClick={() => dispatch({ type: "redo" })} disabled={!history.future.length} title="다시 실행 (Shift+Ctrl/⌘+Z)" aria-label="다시 실행">
        <Redo2 className="size-3.5" />
      </button>
      <button type="button" className={btn(false)} onClick={() => setPanel("objects")} data-testid="open-objects">
        <ListTree className="size-3.5" /> 그리기 {history.items.length}
      </button>
      <button type="button" className={btn(vp.rangeOn)} onClick={() => setVp((v) => ({ ...v, rangeOn: !v.rangeOn }))} aria-pressed={vp.rangeOn} title="차트 본체 고저점">
        고저
      </button>
      <select
        value={vp.recentSpan}
        onChange={(e) => setVp((v) => ({ ...v, recentSpan: e.target.value as RecentSpan }))}
        className="h-8 rounded-md border border-border bg-background px-1.5 text-[11px]"
        aria-label="최근 고저 창"
      >
        <option value="3M">최근 3M</option>
        <option value="6M">최근 6M</option>
        <option value="52W">최근 52W</option>
        <option value="all">최근=전체</option>
        <option value="swing">최근 스윙</option>
      </select>
      <details className="relative" data-testid="vp-menu">
        <summary className={cn(btn(vp.enabled), "cursor-pointer list-none")}>매물대 {vp.enabled ? "ON" : "OFF"}</summary>
        <div className="absolute left-0 top-9 z-30 flex w-56 flex-col gap-1.5 rounded-md border border-border bg-card p-2 text-[11px] shadow-lg">
          <div className="flex gap-1">
            {(["hide", "ref", "emph"] as const).map((p) => (
              <button key={p} type="button" className={btn(vp.preset === p)} onClick={() => setVp((v) => applyVpPreset(p, v))}>
                {p === "hide" ? "숨김" : p === "ref" ? "참고" : "강조"}
              </button>
            ))}
          </div>
          <label className="flex items-center justify-between gap-2">
            빈
            <select
              value={vp.rows}
              onChange={(e) => setVp((v) => ({ ...v, rows: Number(e.target.value) }))}
              className="h-7 rounded border border-border bg-background px-1"
              aria-label="매물대 빈 개수"
            >
              {[16, 24, 32, 48].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            값
            <select
              value={vp.basis}
              onChange={(e) => setVp((v) => ({ ...v, basis: e.target.value as VpPrefs["basis"] }))}
              className="h-7 rounded border border-border bg-background px-1"
              aria-label="매물대 기준"
            >
              <option value="volume">거래량</option>
              <option value="turnover">거래대금</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            폭
            <select
              value={vp.width}
              onChange={(e) => setVp((v) => ({ ...v, width: e.target.value as VpPrefs["width"], preset: "ref", enabled: true }))}
              className="h-7 rounded border border-border bg-background px-1"
              aria-label="매물대 폭"
            >
              <option value="thin">얇게</option>
              <option value="mid">보통</option>
              <option value="wide">넓게</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            투명도
            <input
              type="range"
              min={0.12}
              max={0.4}
              step={0.02}
              value={vp.opacity}
              onChange={(e) => setVp((v) => ({ ...v, opacity: Number(e.target.value), enabled: true, preset: v.preset === "hide" ? "ref" : v.preset }))}
              aria-label="매물대 투명도"
              className="w-full"
            />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={vp.showVa} onChange={() => setVp((v) => ({ ...v, showVa: !v.showVa }))} className="size-3.5 accent-primary" />
            밸류영역
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={vp.showPoc} onChange={() => setVp((v) => ({ ...v, showPoc: !v.showPoc }))} className="size-3.5 accent-primary" />
            POC 점선
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={vp.visibleOnly} onChange={() => setVp((v) => ({ ...v, visibleOnly: !v.visibleOnly }))} className="size-3.5 accent-primary" />
            화면구간만 (고급)
          </label>
          {bars.length < 30 && <p className="text-muted-foreground">30봉 미만이라 매물대를 숨깁니다.</p>}
        </div>
      </details>
      <span className="mx-0.5 h-5 w-px bg-border" />
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          addCompare();
        }}
      >
        <Input value={compareInput} onChange={(e) => setCompareInput(e.target.value)} placeholder="비교: 005930 / NVDA" className="h-8 w-32 text-[11px]" aria-label="비교 종목" disabled={compare.length >= 3} />
        <button type="submit" className={btn(false)} disabled={compare.length >= 3}>
          비교
        </button>
      </form>
      <span className="mx-0.5 h-5 w-px bg-border" />
      <details className="relative" data-testid="overlay-menu">
        <summary className={cn(btn(Object.values(overlays).some(Boolean)), "cursor-pointer list-none")}>
          <Layers className="size-3.5" /> 오버레이 {Object.values(overlays).filter(Boolean).length}
        </summary>
        <div className="absolute left-0 top-9 z-30 flex w-44 flex-col gap-1 rounded-md border border-border bg-card p-1.5 shadow-lg">
          {(["disclosures", "news", "research", "dividends", "signals"] as const).map((k) => (
            <label key={k} className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-1.5 text-[11px] hover:bg-muted">
              <input type="checkbox" checked={overlays[k]} onChange={() => setLayout((l) => ({ ...l, overlays: { ...l.overlays, [k]: !l.overlays[k] } }))} className="size-3.5 accent-primary" />
              {{ disclosures: "공시", news: "뉴스 (봉별 건수)", research: "리서치 목표가", dividends: "배당·분할 (미국)", signals: "RSI 다이버전스·MACD 교차" }[k]}
            </label>
          ))}
        </div>
      </details>
      <button type="button" className={btn(myAlerts.length > 0)} onClick={() => setPanel("alerts")} data-testid="open-alerts">
        <Bell className="size-3.5" /> 알림 {myAlerts.length || ""}
      </button>
      {replayable && (
        <button type="button" className={btn(Boolean(replay) || tool === "replay-pick")} onClick={() => (replay ? setReplay(null) : setTool("replay-pick"))} data-testid="replay-toggle">
          <Rewind className="size-3.5" /> {replay ? "리플레이 종료" : "리플레이"}
        </button>
      )}
      {props.prePost && (
        <button type="button" className={btn(props.prePost.on)} aria-pressed={props.prePost.on} onClick={props.prePost.toggle} title="미국 프리·애프터마켓 봉 포함">
          시간외
        </button>
      )}
    </>
  );

  const hasData = rawBars.length > 0;
  const sepPanes = layout.indicators.filter((i) => i.visible && INDICATOR_BY_ID.get(i.id)?.pane === "separate" && INDICATOR_BY_ID.get(i.id)?.render === "series").length;
  const shellHeight = typeof props.height === "number" ? props.height + Math.max(0, sepPanes - 1) * 88 : (props.height ?? 480);
  const status = hasData ? { source: props.source, mode: props.modeLabel, updatedAt: props.updatedAt, note: `${rawBars.length.toLocaleString("ko-KR")}봉${rawBars.length > 10_000 ? " (최근 10,000봉)" : ""}` } : null;

  return (
    <>
      <ChartShell
        title={props.name ? `${props.name} · ${code}` : code}
        toolbarExtra={props.toolbarExtra}
        toolbar={toolbar}
        hud={hud}
        legend={[
          ...legend,
          ...(vp.enabled && bars.length < 30
            ? [{ id: "vp-short", label: "매물대: 30봉 미만", value: "기간을 늘리면 표시", visible: true, color: "#94a3b8" } satisfies LegendItem]
            : []),
        ]}
        status={status}
        onExportPng={hasData ? exportPng : undefined}
        onExportCsv={hasData ? exportCsv : undefined}
        onFullscreen={props.onFullscreen}
        onKeyDown={onKeyDown}
        height={shellHeight}
        testId={props.testId ?? "pro-chart"}
        collapseToolbar={props.compact}
        footer={
          <RangePositionStrip
            stats={rangeStats}
            compact={props.compact}
            formatValue={fmt}
            caption={
              vp.recentSpan === "swing"
                ? "보이는 구간 기준. 최근 고점·저점은 오른쪽이 확정된 스윙입니다. 같으면 기간=최근."
                : `보이는 구간 기준. 최근 고저 창은 ${vp.recentSpan === "all" ? "구간 전체" : vp.recentSpan}입니다. 기간 극값과 같으면 기간=최근.`
            }
          />
        }
        shortcuts={[
          ...DRAWING_TOOLS.map((t) => ({ keys: t.key.toUpperCase(), label: t.label })),
          { keys: "Esc", label: "도구 취소" },
          { keys: "Delete", label: "선택한 그림 삭제" },
          { keys: "Ctrl/⌘+Z", label: "실행 취소" },
          { keys: "Shift+Ctrl/⌘+Z", label: "다시 실행" },
        ]}
      >
        {!hasData && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-4 text-center text-sm text-muted-foreground" data-testid="chart-empty">
            {props.loading ? "차트 데이터 수신 중…" : props.error ? "차트 데이터를 불러오지 못했습니다. 데이터를 채워 넣지 않습니다." : "표시할 봉이 없습니다."}
          </div>
        )}
        {(tool !== "cursor" || pending.length > 0) && (
          <div className="pointer-events-none absolute left-2 top-2 z-30 rounded-md bg-amber-500/15 px-2 py-1 text-[11px] text-amber-500" data-testid="tool-hint">
            {tool === "replay-pick"
              ? "리플레이 시작 봉을 클릭하세요"
              : tool === "avwap-anchor"
                ? "앵커드 VWAP 기준 봉을 클릭하세요"
                : `${DRAWING_TOOLS.find((t) => t.type === tool)?.label ?? ""}: 점 ${pending.length + 1}/${tool !== "cursor" ? anchorsFor(tool as DrawingType) : 0} 클릭 · Esc 취소`}
          </div>
        )}
        {replay && (
          <div className="absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-card/95 px-2 py-1 shadow" data-testid="replay-bar">
            <button type="button" className="inline-flex size-9 items-center justify-center rounded hover:bg-muted" onClick={() => setReplay((r) => (r ? { ...r, playing: !r.playing } : r))} aria-label={replay.playing ? "일시정지" : "재생"}>
              {replay.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded hover:bg-muted"
              onClick={() => setReplay((r) => (r ? { ...r, cursor: replayStep(r.cursor, rawBars.length) ?? rawBars.length - 1 } : r))}
              aria-label="한 봉 앞으로"
              data-testid="replay-step"
            >
              <SkipForward className="size-4" />
            </button>
            <select value={replay.speed} onChange={(e) => setReplay((r) => (r ? { ...r, speed: Number(e.target.value) } : r))} className="h-9 rounded-md border border-border bg-background px-1 text-xs" aria-label="속도">
              {REPLAY_SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
            <button type="button" className="inline-flex size-9 items-center justify-center rounded hover:bg-muted" onClick={() => setReplay(null)} aria-label="리플레이 종료">
              <X className="size-4" />
            </button>
          </div>
        )}
        <div ref={containerRef} className="absolute inset-0 isolate" style={{ cursor: tool === "cursor" ? "crosshair" : "cell", touchAction: "pan-y" }} data-testid="chart-canvas" />
      </ChartShell>
      {compare.map((sym) => (
        <CompareLoader key={sym} sym={sym} interval={interval} minuteSize={props.minuteSize} range={props.range} onBars={onCompareBars} />
      ))}
      <IndicatorPanel
        open={panel === "indicators"}
        onOpenChange={(v) => setPanel(v ? "indicators" : null)}
        instances={layout.indicators}
        onAdd={addIndicator}
        onChange={(id, patch) => setLayout((l) => ({ ...l, indicators: l.indicators.map((i) => (i.uid === id ? { ...i, ...patch } : i)) }))}
        onRemove={(id) => setLayout((l) => ({ ...l, indicators: l.indicators.filter((i) => i.uid !== id) }))}
        templates={templates}
        onSaveTemplate={(name) =>
          setChartPrefs({ templates: { ...(chartPrefs.templates ?? {}), [name]: { indicators: layout.indicators, chartType: layout.chartType, scale: layout.scale, savedAt: new Date().toISOString() } } })
        }
        onApplyTemplate={(name) => {
          const t = chartPrefs.templates?.[name];
          if (!t) return;
          setLayout((l) => ({
            ...l,
            indicators: (t.indicators as IndicatorInstance[]).map((i) => ({ ...i, uid: `${i.id}-${uid()}` })),
            chartType: (t.chartType as ChartType) ?? l.chartType,
            scale: (t.scale as ChartScale) ?? l.scale,
          }));
        }}
        onDeleteTemplate={(name) => {
          const next = { ...(chartPrefs.templates ?? {}) };
          delete next[name];
          setChartPrefs({ templates: next });
        }}
      />
      <ObjectManager
        open={panel === "objects"}
        onOpenChange={(v) => setPanel(v ? "objects" : null)}
        drawings={history.items}
        selectedId={selected}
        onSelect={setSelected}
        onUpdate={(id, patch) => dispatch({ type: "update", id, patch })}
        onRemove={(id) => dispatch({ type: "remove", id })}
        onToggleAlert={toggleHlineAlert}
        formatPrice={fmt}
      />
      <AlertsPanel
        open={panel === "alerts"}
        onOpenChange={(v) => setPanel(v ? "alerts" : null)}
        alerts={myAlerts}
        onAddRsi={() => {
          const base = { market, code: code.toUpperCase(), name: props.name, direction: "any" as const, repeat: "every" as const, active: true, createdAt: new Date().toISOString() };
          upsertPriceAlert({ ...base, id: `rsi70-${uid()}`, kind: "rsi-cross", level: 70 });
          upsertPriceAlert({ ...base, id: `rsi30-${uid()}`, kind: "rsi-cross", level: 30 });
        }}
        onAddMa={() => upsertPriceAlert({ id: `ma-${uid()}`, market, code: code.toUpperCase(), name: props.name, kind: "ma-cross", fast: 20, slow: 60, direction: "any", repeat: "every", active: true, createdAt: new Date().toISOString() })}
        onRemove={removePriceAlert}
      />
      <Sheet open={newsList != null} onOpenChange={(v) => !v && setNewsList(null)}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>이 봉의 뉴스 ({newsList?.length ?? 0})</SheetTitle>
            <SheetDescription>피드에서 이 종목으로 태그된 기사 · 최신순</SheetDescription>
          </SheetHeader>
          <div className="p-3">
            <FeedList items={newsList ?? []} emptyReason="기사가 없습니다." />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export type { IChartApi };
