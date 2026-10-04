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
  type SeriesType,
  type Time,
} from "lightweight-charts";
import {
  Bell,
  BrainCircuit,
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
import { composeChartPng, downloadCanvasPng, downloadCsv } from "@/components/charts/core/export";
import type { ChartSync } from "@/components/charts/core/sync";
import { formatChartPercent, formatChartPrice, formatChartVolume, priceFormatFor, type KrxInstrument } from "@/components/charts/core/formatters";
import { RangePositionStrip } from "@/components/stocks/RangePositionStrip";
import { computeRangePosition, planRangeMarkers, rangeMarkerText, type RangePositionStats } from "@/lib/chart-indicators";
import { AlertsPanel, IndicatorPanel, instanceLabel, ObjectManager } from "@/components/charts/pro/ChartPanels";
import { DrawingPrimitive, RangeMarkerPrimitive, SessionPrimitive, VolumeProfilePrimitive } from "@/components/charts/pro/primitives";
import { ChartDisplayControls } from "./ChartDisplayControls";
import { resolveProfileStyle } from "@/lib/charts/profile-style";
import { buildChartEvents, filterChartEvents, alignChartEvents, groupScreenEvents, formatChartEventTime, CHART_EVENT_LABELS, type ChartEventInput, type ChartEvent, type ChartEventGroup } from "@/lib/charts/chart-events";
import { openKnownUrl } from "@/lib/open-original";
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
  migrateLegacyDrawings,
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
import type { PriceAlert } from "@/lib/store-migrate";
import { cn } from "@/lib/utils";
import { useHtsPanes, ensureHtsPanes } from "./useHtsPanes";
import { HtsSettingsPanel } from "./HtsSettingsPanel";
import { ProfileDetails } from "./ProfileDetails";
import { applyChartReadabilityPreset, defaultHtsSettings, hasSavedHtsSettings, loadHtsSettings, saveHtsSettings, htsSettingsKey, HTS_PANEL_ORDER, profileToCsv, type HtsProfileSettings, type ProfileMetadata } from "@/lib/charts/hts-settings";
import { pricePanePoint, periodEndDay, profileRangeBars } from "@/lib/charts/hts-layout";
import { alignChartFlow, availableFlowStart, emptyChartFlow, FLOW_METRICS, type FlowRequest } from "@/lib/charts/hts-flow";
import { chartReplayInstant, flowToCsv } from "@/lib/charts/hts-flow-export";
import { useChartFlow } from "@/lib/use-chart-flow";
import { alignSmaValues, latestSmaPoint, migrateStandardSmas, prepareSmaHistory, resolveSmaStyle, STANDARD_SMA_PERIODS, toggleStandardSma } from "@/lib/charts/standard-sma";
import { SmaControls } from "@/components/charts/core/SmaControls";
import { SmaLabelsPrimitive } from "@/components/charts/core/sma-labels-primitive";

type Tool = "cursor" | DrawingType | "avwap-anchor" | "replay-pick";

export type ChartMarkerInput = ChartEventInput;

export interface ProChartProps {
  code: string;
  market: "KR" | "US";
  instrument?: KrxInstrument;
  name?: string;
  exchange?: string;
  currency?: "KRW" | "USD";
  quantityUnit?: "주" | "좌";
  layoutScope?: string;
  profileBars?: OhlcBar[];
  profileSource?: string;
  indicatorBars?: OhlcBar[];
  priceBasisNote?: string;
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
  disclosureMarkers?: ChartEventInput[];
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
/**
 * Pro chart (F7 Tier A): chart types + scales, indicator catalog, drawing
 * tools with undo/redo, compare overlay, event overlays, alerts, bar replay,
 * extended-hours shading, PNG/CSV export and per-layout persistence.
 */
export function ProChart(props: ProChartProps) {
  const { code, market, bars: rawBars, interval, intervalKey } = props;
  const theme = useChartTheme();
  const themeMode = useAppStore((s) => s.theme);
  const [fullscreenPortal, setFullscreenPortal] = useState<HTMLElement | undefined>();
  useEffect(() => {
    const update = () => setFullscreenPortal(document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : undefined);
    update(); document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

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
  const instrument = props.instrument ?? "stock";
  const scope = useMemo(() => ({ market, instrument, code, interval: intervalKey, layout: props.layoutScope ?? "detail" }), [market, instrument, code, intervalKey, props.layoutScope]);
  const scopeKey = htsSettingsKey(scope);
  const [hts, setHts] = useState(() => defaultHtsSettings(market, instrument));
  const [legacyNotice, setLegacyNotice] = useState(false);
  const [htsLoaded, setHtsLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (!props.instrument) return;
    const storage = safeStorage();
    const hadScoped = storage ? hasSavedHtsSettings(storage, scope) : false;
    const loaded = storage ? loadHtsSettings(storage, scope) : defaultHtsSettings(market, instrument);
    const oldLayout = storage && scope.layout === "detail" ? loadChartState(storage, market, code, intervalKey) : null;
    const oldRsi = oldLayout?.indicators.find((i) => i.id === "rsi");
    if (!hadScoped && oldRsi && Number.isFinite(Number(oldRsi.params.period))) loaded.rsiPeriod = Math.max(2, Math.min(200, Number(oldRsi.params.period)));
    setLegacyNotice(Boolean(!hadScoped && oldLayout));
    setHts(loaded);
    setHtsLoaded(scopeKey);
  }, [scope, scopeKey, market, instrument, code, intervalKey, props.instrument]);
  useEffect(() => {
    if (htsLoaded !== scopeKey || !props.instrument) return;
    const storage = safeStorage();
    if (storage) saveHtsSettings(storage, scope, hts);
  }, [scope, scopeKey, htsLoaded, hts, props.instrument]);
  useEffect(() => {
    if (htsLoaded === scopeKey && !hts.trustStartDate && rawBars[0]) setHts((prev) => ({ ...prev, trustStartDate: rawBars[0]!.date.slice(0, 10) }));
  }, [rawBars, htsLoaded, scopeKey, hts.trustStartDate]);
  const htsAllowed = market === "KR" || instrument === "etf" || instrument === "etn";
  const htsEnabled = htsAllowed && hts.enabled;
  const pricePaneIndex = htsEnabled ? 1 : 0;
  const vp = hts.profile;
  const setVp = (update: (old: HtsProfileSettings) => HtsProfileSettings) => setHts((old) => ({ ...old, profile: update(old.profile) }));
  const quantityUnit = props.quantityUnit ?? "주";
  const currency = props.currency ?? (market === "KR" ? "KRW" : "USD");

  // ── Layout state (persisted per market/code/interval) ─────────────────
  const [layout, setLayout] = useState<ChartLayoutState>(() => defaultLayout(defaultIndicators(market).filter((i) => !htsAllowed || i.id !== "macd"), chartPrefs.chartType, chartPrefs.scale));
  const [history, dispatch] = useReducer(drawingReducer, undefined, () => initHistory());
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const persistenceInterval = `${intervalKey}:${instrument}:${props.layoutScope ?? "detail"}`;
  const layoutKey = `${market}:${code}:${persistenceInterval}`;
  useEffect(() => {
    const store = safeStorage();
    const saved = store ? loadChartState(store, market, code, persistenceInterval) ?? (scope.layout === "detail" ? loadChartState(store, market, code, intervalKey) : null) : null;
    const next = saved ?? defaultLayout(defaultIndicators(market).filter((i) => !htsAllowed || i.id !== "macd"), chartPrefs.chartType, chartPrefs.scale);
    setLayout(next);
    dispatch({ type: "reset", items: next.drawings });
    setLoadedKey(layoutKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);
  useEffect(() => {
    if (loadedKey !== layoutKey || !props.instrument) return;
    const store = safeStorage();
    if (!store) return;
    const t = setTimeout(() => saveChartState(store, market, code, persistenceInterval, { ...layout, drawings: history.items }), 250);
    return () => clearTimeout(t);
  }, [layout, history.items, loadedKey, layoutKey, market, code, persistenceInterval, props.instrument]);

  // The catalog entry is a second control for the same native profile, never a fallback.
  useEffect(() => {
    if (loadedKey !== layoutKey || htsLoaded !== scopeKey) return;
    setLayout(previous => previous.indicators.some(item => item.id === "vprofile" && item.visible !== vp.enabled)
      ? { ...previous, indicators: previous.indicators.map(item => item.id === "vprofile" ? { ...item, visible: vp.enabled } : item) } : previous);
  }, [vp.enabled, layout.indicators, loadedKey, layoutKey, htsLoaded, scopeKey]);

  // Copy legacy drawings into this detail scope, keeping all original storage intact.
  useEffect(() => {
    if (market !== "KR" || interval !== "day" || scope.layout !== "detail" || !props.instrument || !rawBars.length || loadedKey !== layoutKey) return;
    const store = safeStorage();
    if (!store) return;
    const migrated = migrateLegacyDrawings(store.getItem(`ke-chart-draw:${code}`), rawBars.map((b) => barTimeOf(b.date, market)));
    const ids = new Set(history.items.map((d) => d.id));
    const added = migrated.drawings.filter((d) => !ids.has(d.id));
    if (added.length) dispatch({ type: "reset", items: [...history.items, ...added] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawBars, loadedKey, layoutKey, props.instrument]);

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
  // Identity and every input field participate: a volume correction must invalidate cached indicators.
  const calculationBars = useMemo(() => prepareSmaHistory(
    bars.map(b => ({ ...b, time: barTimeOf(b.date, market) })),
    (props.indicatorBars ?? rawBars).map(b => ({ ...b, time: barTimeOf(b.date, market) })),
  ), [bars, props.indicatorBars, rawBars, market]);
  const calculationTimes = useMemo(() => calculationBars.map(b => b.time), [calculationBars]);
  const version = useMemo(() => `${market}:${code}:${intervalKey}:${props.source}:${JSON.stringify(calculationBars)}:${times[0]}`, [market, code, intervalKey, props.source, calculationBars, times]);
  const renderedIndicators = layout.indicators.filter((i) => !htsEnabled || (i.id !== "rsi" && i.id !== "volume"));
  const extraCount = renderedIndicators.filter((i) => i.visible && INDICATOR_BY_ID.get(i.id)?.pane === "separate" && INDICATOR_BY_ID.get(i.id)?.render === "series").length;
  const catalogBars = useMemo<CatalogBars>(
    () => ({
      open: calculationBars.map((b) => b.open),
      high: calculationBars.map((b) => b.high),
      low: calculationBars.map((b) => b.low),
      close: calculationBars.map((b) => b.close),
      volume: calculationBars.map((b) => b.volumeValid === false ? NaN : b.volume),
      sessionKeys: interval === "minute" ? calculationBars.map((b) => b.date.slice(0, 10)) : undefined,
    }),
    [calculationBars, interval],
  );
  // Keep the existing calculation origin for unrelated indicators (notably
  // non-intraday VWAP). SMA alone consumes the additional selected-frame history.
  const displayCatalogBars = useMemo<CatalogBars>(() => ({
    open: bars.map(b => b.open), high: bars.map(b => b.high), low: bars.map(b => b.low),
    close: bars.map(b => b.close), volume: bars.map(b => b.volumeValid === false ? NaN : b.volume),
    sessionKeys: interval === "minute" ? bars.map(b => b.date.slice(0, 10)) : undefined,
  }), [bars, interval]);

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
        if (inst.id === "sma") {
          const calculated = computeInstance(inst, catalogBars, calculationTimes);
          v = Object.fromEntries(Object.entries(calculated).map(([key, array]) => [key, alignSmaValues(calculationBars, array, bars.map(b => ({ time: barTimeOf(b.date, market) })))]));
        } else v = computeInstance(inst, displayCatalogBars, times);
        cache.set(key, v);
        if (cache.size > 200) cache.delete(cache.keys().next().value!);
      }
      out.set(inst.uid, v);
    }
    return out;
  }, [layout.indicators, version, catalogBars, calculationTimes, calculationBars, bars, market, displayCatalogBars, times]);

  // ── Main series ────────────────────────────────────────────────────────
  const mainRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const drawingPrim = useRef(new DrawingPrimitive());
  const sessionPrim = useRef(new SessionPrimitive());
  const vpPrim = useRef(new VolumeProfilePrimitive());
  const rangePrim = useRef(new RangeMarkerPrimitive());
  const smaLabels = useRef(new SmaLabelsPrimitive());
  const [mainEpoch, setMainEpoch] = useState(0);
  const compareActive = useRef(false);

  useEffect(() => {
    if (!chart) return;
    if (htsEnabled) ensureHtsPanes(chart, extraCount);
    const type = layout.chartType;
    const pf = priceFormatFor(market, rawBars[rawBars.length - 1]?.close);
    const common = { priceFormat: pf, priceLineVisible: true, lastValueVisible: true } as const;
    let s: ISeriesApi<SeriesType>;
    if (type === "line") s = chart.addSeries(LineSeries, { ...common, color: theme.text, lineWidth: 2 }, pricePaneIndex);
    else if (type === "area") s = chart.addSeries(AreaSeries, { ...common, lineColor: "#38bdf8", topColor: "rgba(56,189,248,0.28)", bottomColor: "rgba(56,189,248,0.02)" }, pricePaneIndex);
    else if (type === "baseline")
      s = chart.addSeries(BaselineSeries, { ...common, baseValue: { type: "price", price: rawBars[0]?.close ?? 0 }, topLineColor: upColor, bottomLineColor: downColor, topFillColor1: `${upColor}33`, bottomFillColor2: `${downColor}33` }, pricePaneIndex);
    else if (type === "bars") s = chart.addSeries(BarSeries, { ...common, upColor, downColor, thinBars: false }, pricePaneIndex);
    else
      s = chart.addSeries(CandlestickSeries, {
        ...common,
        upColor: type === "hollow" ? "rgba(0,0,0,0)" : upColor,
        downColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
        wickUpColor: upColor,
        wickDownColor: downColor,
      }, pricePaneIndex);
    mainRef.current = s;
    s.attachPrimitive(sessionPrim.current);
    s.attachPrimitive(vpPrim.current);
    s.attachPrimitive(drawingPrim.current);
    s.attachPrimitive(rangePrim.current);
    const smaPrimitive = smaLabels.current;
    s.attachPrimitive(smaPrimitive);
    markersRef.current = createSeriesMarkers(s, [], { autoScale: false });
    setMainEpoch((e) => e + 1);
    return () => {
      markersRef.current?.detach();
      markersRef.current = null;
      try {
        s.detachPrimitive(smaPrimitive);
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
  }, [chart, layout.chartType, upColor, downColor, market, pricePaneIndex]);

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
  }, [mainEpoch, bars, times, layout.chartType]);

  // Fit once per dataset key.
  const fittedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!chart || !rawBars.length) return;
    const key = `${layoutKey}|${props.range ?? ""}|${props.minuteSize ?? ""}`;
    if (fittedKey.current === key) return;
    fittedKey.current = key;
    const n = bars.length;
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - (interval === "minute" ? 160 : 180)), to: n + 4 });
  }, [chart, bars.length, rawBars.length, layoutKey, props.range, props.minuteSize, interval]);

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
        s = chart.addSeries(LineSeries, { color: COMPARE_COLORS[i % 3], lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: sym.split(":")[1] }, pricePaneIndex);
        map.set(sym, s);
      }
      s.moveToPane(pricePaneIndex);
      const other = (compareBars[sym] ?? []).map((b) => ({ time: barTimeOf(b.date, sym.startsWith("US") ? "US" : "KR"), close: b.close }));
      const aligned = alignByTime(times, other);
      s.setData(times.map((t, j) => (aligned[j] == null ? { time: t as Time } : { time: t as Time, value: aligned[j]! })));
    });
    compareActive.current = compare.length > 0;
  }, [chart, compare, compareBars, times, mainEpoch, pricePaneIndex]);

  // Price scale mode (compare forces % from first visible bar).
  useEffect(() => {
    if (!chart) return;
    chart.priceScale("right", pricePaneIndex).applyOptions({ mode: compare.length ? PriceScaleMode.Percentage : SCALE_MODE[layout.scale] });
  }, [chart, layout.scale, compare.length, mainEpoch, pricePaneIndex]);

  // ── Indicator series ───────────────────────────────────────────────────
  const indSeries = useRef(new Map<string, { series: Map<string, ISeriesApi<SeriesType>>; lines: IPriceLine[] }>());
  const pivotLines = useRef<IPriceLine[]>([]);
  const structureKey = JSON.stringify([htsEnabled, renderedIndicators.filter(i => INDICATOR_BY_ID.get(i.id)?.render === "series").map((i) => [i.uid, i.id, INDICATOR_BY_ID.get(i.id)?.pane === "separate" ? i.visible : null])]);
  useEffect(() => {
    if (!chart) return;
    const store = indSeries.current;
    const retained = new Set(renderedIndicators.filter(i => i.visible || INDICATOR_BY_ID.get(i.id)?.pane === "overlay").map(i => i.uid));
    for (const [id, entry] of store) if (!retained.has(id)) {
      for (const series of entry.series.values()) chart.removeSeries(series);
      store.delete(id);
    }
    if (htsEnabled) ensureHtsPanes(chart, extraCount);
    for (let i = chart.panes().length - 1; !htsEnabled && i >= 1; i--) {
      const pane = chart.panes()[i];
      if (pane && pane.getSeries().length === 0) chart.removePane(i);
    }
    let pane = htsEnabled ? 5 : 1;
    renderedIndicators.forEach((inst, idx) => {
      const def = INDICATOR_BY_ID.get(inst.id);
      if (!def || def.render !== "series") return;
      if (!inst.visible && def.pane === "separate") return;
      const paneIndex = def.pane === "separate" ? pane++ : pricePaneIndex;
      const existing = store.get(inst.uid);
      if (existing) {
        for (const series of existing.series.values()) series.moveToPane(paneIndex);
        return;
      }
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
              lineWidth: resolveSmaStyle(inst, themeMode)?.lineWidth ?? 1,
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
    if (!htsEnabled) {
      panes[0]?.setStretchFactor(Math.max(3, panes.length));
      for (let i = 1; i < panes.length; i++) panes[i]?.setStretchFactor(1);
    }
    setIndEpoch((e) => e + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, structureKey, market]);
  const [indEpoch, setIndEpoch] = useState(0);

  // Presentation-only changes never rebuild price/indicator series or reset zoom.
  useEffect(() => {
    renderedIndicators.forEach((instance, index) => {
      const entry = indSeries.current.get(instance.uid);
      const style = resolveSmaStyle(instance, themeMode);
      const color = style?.color ?? instance.color ?? PALETTE[index % PALETTE.length]!;
      for (const [key, series] of entry?.series ?? []) if (series.seriesType() === "Line") {
        series.applyOptions({ color: key === "signal" || key === "d" || key === "minusDi" ? "#f97316" : key === "plusDi" ? "#22c55e" : color, lineWidth: style?.lineWidth ?? 1,
          visible: instance.visible && (INDICATOR_BY_ID.get(instance.id)?.pane !== "overlay" || !htsEnabled || !hts.collapsed.price) });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.indicators, themeMode, indEpoch, htsEnabled, hts.collapsed.price]);

  useEffect(() => {
    const endpoints = STANDARD_SMA_PERIODS.flatMap(period => {
      const instance = layout.indicators.find(i => i.id === "sma" && Number(i.params?.period) === period && i.visible);
      if (!instance || (htsEnabled && hts.collapsed.price)) return [];
      const point = latestSmaPoint(bars.map((b, i) => ({ time: times[i]! })), values.get(instance.uid)?.v ?? [], instance.visible);
      if (point?.value == null) return [];
      return [{ period, time: point.time, value: point.value, color: resolveSmaStyle(instance, themeMode)!.color, text: `SMA${period} ${fmt(point.value)}`, coordinateSeries: indSeries.current.get(instance.uid)?.series.get("v") }];
    });
    smaLabels.current.set(endpoints, theme.background, htsEnabled ? 42 : 16);
  }, [layout.indicators, values, bars, times, themeMode, theme.background, fmt, htsEnabled, hts.collapsed.price, mainEpoch, indEpoch]);

  // Indicator data.
  useEffect(() => {
    for (const inst of layout.indicators) {
      const entry = indSeries.current.get(inst.uid);
      const v = values.get(inst.uid);
      if (!entry || !v) continue;
      for (const [key, s] of entry.series) {
        const arr = v[key] ?? [];
        if (inst.id === "volume" && key === "v") {
          s.setData(bars.map((b, i) => b.volumeValid === false ? { time: times[i] as Time } : { time: times[i] as Time, value: b.volume, color: b.close >= b.open ? `${upColor}88` : `${downColor}88` }));
        } else if (key === "hist") {
          s.setData(times.map((t, i) => { const x = arr[i]; return x == null ? { time: t as Time } : { time: t as Time, value: x, color: x >= 0 ? `${upColor}99` : `${downColor}99` }; }));
        } else {
          // Always aligned to bar times (an output may be shorter/longer than the bars).
          s.setData(times.map((t, i) => { const x = arr[i]; return x == null ? { time: t as Time } : { time: t as Time, value: x }; }));
        }
      }
    }
  }, [values, indEpoch, bars, times, layout.indicators, upColor, downColor]);

  useEffect(() => {
    const visible = !htsEnabled || !hts.collapsed.price;
    mainRef.current?.applyOptions({ visible });
    for (const series of compareSeries.current.values()) series.applyOptions({ visible });
    for (const instance of renderedIndicators) {
      if (INDICATOR_BY_ID.get(instance.id)?.pane !== "overlay") continue;
      for (const series of indSeries.current.get(instance.uid)?.series.values() ?? []) series.applyOptions({ visible: visible && instance.visible });
    }
    // Series identities are tracked by their construction epochs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htsEnabled, hts.collapsed.price, mainEpoch, indEpoch, compare]);

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
  const profileInput = useMemo(() => {
    const w = visibleWindow(bars.length, visible);
    const from = bars[w.from]?.date;
    const to = bars[w.to]?.date;
    if (vp.rangeMode === "visible" && (!from || !to || w.from > w.to)) return [];
    const loaded = props.profileBars?.length ? props.profileBars : bars;
    return profileRangeBars(loaded, {
      mode: vp.rangeMode,
      visibleFrom: from, visibleTo: to ? periodEndDay(to, interval) : undefined,
      fixedFrom: vp.startDate, fixedTo: vp.endDate,
      replayTo: replay && bars.at(-1) ? periodEndDay(bars.at(-1)!.date, interval) : undefined,
    });
  }, [bars, props.profileBars, visible, vp.rangeMode, vp.startDate, vp.endDate, replay, interval]);
  // Both catalog and HTS controls use one profile; an OFF setting cannot be bypassed.
  const vpProfile = useMemo(() => !vp.enabled ? null : volumeProfile(profileInput, vp.rows, 0.7, vp.basis),
    [profileInput, vp.enabled, vp.rows, vp.basis]);
  const profileMetadata: ProfileMetadata = {
    market, instrument, code, name: props.name, quantityUnit, currency,
    source: props.profileBars?.length ? props.profileSource ?? props.source : props.source,
    asOf: profileInput.at(-1)?.date ?? null,
    fetchedAt: props.updatedAt ? new Date(props.updatedAt).toISOString() : null,
    sourceResolution: props.profileBars?.length ? "day" : interval,
    rangeMode: vp.rangeMode, actualFrom: profileInput[0]?.date ?? null, actualTo: profileInput.at(-1)?.date ?? null,
    requestedFrom: vp.rangeMode === "fixed" ? vp.startDate : undefined,
    requestedTo: vp.rangeMode === "fixed" ? vp.endDate : undefined,
    adjustment: props.priceBasisNote ?? "제공처 수정주가·거래량 조정 계약 미확인", estimated: true,
    adjustmentWarning: "OHLCV 가격대 겹침 배분 추정치 · 실제 체결가격별 거래량 아님",
  };
  const profileDescription = `${vp.rangeMode === "visible" ? "보이는 구간" : vp.rangeMode === "fixed" ? "고정 구간" : "로드 전체"} · ${profileInput[0]?.date ?? "—"}~${profileInput.at(-1)?.date ?? "—"} · ${profileMetadata.sourceResolution} · ${vp.basis === "volume" ? quantityUnit : currency} · 추정`;
  useEffect(() => {
    vpPrim.current.set(vpProfile);
    vpPrim.current.setStyle({ widthRatio: vp.widthRatio, ...resolveProfileStyle(vp, themeMode),
      showVa: vp.showVa, showPoc: vp.showPoc, showLabels: vp.showLabels,
      unit: vp.basis === "volume" ? quantityUnit : currency, estimated: true,
      backgroundColor: theme.background, currentPrice: bars.at(-1)?.close ?? null,
      labelReservedTop: htsEnabled ? 38 : 0, labelReservedBottom: htsEnabled ? 38 : 0 });
  }, [vpProfile, vp, quantityUnit, currency, theme, themeMode, htsEnabled, bars, mainEpoch]);
  const flowRequest = useMemo<FlowRequest>(() => ({ code, market, instrument, exchange: props.exchange ?? (market === "KR" ? "KRX" : "US"),
    currency, quantityUnit, from: hts.trustStartDate && hts.trustStartDate < (rawBars[0]?.date.slice(0, 10) ?? "") ? hts.trustStartDate : rawBars[0]?.date.slice(0, 10) ?? "",
    to: rawBars.at(-1) ? periodEndDay(rawBars.at(-1)!.date, interval).slice(0, 10) : "", interval,
    expectedDailyDates: (props.profileBars ?? (interval === "day" ? props.indicatorBars ?? rawBars : [])).map((b) => b.date.slice(0, 10)) }),
  [code, market, instrument, props.exchange, currency, quantityUnit, hts.trustStartDate, rawBars, interval, props.profileBars, props.indicatorBars]);
  const flowQuery = useChartFlow(flowRequest, htsEnabled && Boolean(props.instrument) && htsLoaded === scopeKey && Boolean(hts.trustStartDate));
  const flow = useMemo(() => flowQuery.data ?? emptyChartFlow(flowRequest, flowQuery.isError ? "데이터 요청 실패 · 재시도 필요" : props.instrument ? "데이터 확인 중" : "상품 유형 확인 중"), [flowQuery.data, flowQuery.isError, flowRequest, props.instrument]);
  const effectiveTrustStart = useMemo(() => hts.trustMode === "available-cumulative"
    ? availableFlowStart(flow, (props.profileBars ?? (interval === "day" ? props.indicatorBars ?? rawBars : [])).map((b) => b.date.slice(0, 10)), hts.trustStartDate) ?? hts.trustStartDate
    : hts.trustStartDate, [flow, hts.trustMode, hts.trustStartDate, props.profileBars, props.indicatorBars, interval, rawBars]);
  const replayAt = replay && bars.at(-1) ? chartReplayInstant(periodEndDay(bars.at(-1)!.date, interval).slice(0, 10), market) : undefined;
  const alignedFlow = useMemo(() => alignChartFlow(flow, { dates: bars.map((b) => b.date.slice(0, 10)), interval,
    cumulativeStart: hts.trustStartDate, investmentTrustMode: hts.trustMode,
    expectedDailyDates: (props.profileBars ?? (interval === "day" ? props.indicatorBars ?? rawBars : [])).map((b) => b.date.slice(0, 10)),
    replayAt,
  }), [flow, bars, interval, hts.trustStartDate, hts.trustMode, props.profileBars, props.indicatorBars, rawBars, replayAt]);

  // Visible range tracking.
  const onVisibleRangeRef = useRef(props.onVisibleRange);
  onVisibleRangeRef.current = props.onVisibleRange;
  useEffect(() => {
    if (!chart) return;
    let timer: ReturnType<typeof setTimeout>;
    const h = (r: { from: number; to: number } | null) => {
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(r ? { from: r.from, to: r.to } : null), 60);
      onVisibleRangeRef.current?.(r ? { from: r.from, to: r.to } : null);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(h);
    return () => { clearTimeout(timer); chart.timeScale().unsubscribeVisibleLogicalRangeChange(h); };
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
  const newsEventSnapshot = JSON.stringify(newsFeed.items.flatMap(item => {
        if (!item.publishedAt) return [];
        const instant = Date.parse(item.publishedAt);
        if (!Number.isFinite(instant)) return [];
        const time = interval === "minute" ? Math.floor(instant / 1000) : market === "US" ? dayOfTime(Math.floor(instant / 1000), "US") : kstDayKey(item.publishedAt);
        return time ? [{ time, id: item.id, title: item.title, text: "뉴스", source: item.sourceName, url: item.url, publishedAt: item.publishedAt, publicationPrecision: item.precision }] : [];
      }));
  const newsEvents = useMemo(() => buildChartEvents(JSON.parse(newsEventSnapshot) as ChartEventInput[], "news"), [newsEventSnapshot]);
  const alignedEvents = useMemo(() => {
    const source = [
      ...buildChartEvents(props.disclosureMarkers ?? [], "disclosures"),
      ...buildChartEvents(props.signalMarkers ?? [], "signals"),
      ...buildChartEvents(props.researchMarkers ?? [], "research"),
      ...buildChartEvents((props.events?.dividends ?? []).map(d => ({ time: d.date, title: `배당 ${d.amount} USD`, text: "배당", subtype: "cash-dividend" })), "dividends"),
      ...buildChartEvents((props.events?.splits ?? []).map(d => ({ time: d.date, title: `주식 분할 ${d.ratio}`, text: "분할", subtype: "split" })), "splits"),
      ...newsEvents,
    ];
    return alignChartEvents(filterChartEvents(source, overlays, replayAt ?? undefined, market), { times, market, interval, intervalSeconds: interval === "minute" ? (props.minuteSize ?? 5) * 60 : undefined });
  }, [props.disclosureMarkers, props.signalMarkers, props.researchMarkers, props.events, newsEvents, overlays, replayAt, market, times, interval, props.minuteSize]);
  // Existing page refetches/SSE can recreate identical input arrays. Stable
  // content keeps open details and native markers through those rerenders.
  const eventSnapshot = JSON.stringify(alignedEvents);
  const chartEvents = useMemo(() => JSON.parse(eventSnapshot) as ChartEvent[], [eventSnapshot]);
  const [eventGroups, setEventGroups] = useState<ChartEventGroup[]>([]);
  const [eventSelection, setEventSelection] = useState<{ scope: string; items: ChartEvent[] } | null>(null);
  const eventTriggerRef = useRef<HTMLElement | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<ChartEventGroup | null>(null);
  const eventGroupsRef = useRef<ChartEventGroup[]>([]);
  eventGroupsRef.current = eventGroups;
  useEffect(() => {
    setEventSelection(null);
    setHoveredEvent(null);
  }, [layoutKey, overlays, chartEvents]);
  useEffect(() => {
    if (!chart || !markersRef.current) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setHoveredEvent(null);
        const groups = groupScreenEvents(chartEvents, time => chart.timeScale().timeToCoordinate(time as Time), { gapPx: 112, plotWidth: chart.timeScale().width() });
        eventGroupsRef.current = groups;
        setEventGroups(groups);
        markersRef.current?.setMarkers(groups.map(({ id, time, position, color, shape, text }) => ({ id, time: time as Time, position, color, shape, text, size: 0.7 })));
      });
    };
    // Disabled categories lose both their native markers and hit targets immediately.
    markersRef.current.setMarkers([]);
    eventGroupsRef.current = [];
    setEventGroups([]);
    update();
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    chart.timeScale().subscribeVisibleLogicalRangeChange(update);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); chart.timeScale().unsubscribeVisibleLogicalRangeChange(update); };
  }, [chart, chartEvents, mainEpoch]);

  // ── Drawing interaction (F7.7) ─────────────────────────────────────────
  const [tool, setTool] = useState<Tool>("cursor");
  const [magnet, setMagnet] = useState(true);
  const [pending, setPending] = useState<Anchor[]>([]);
  const [preview, setPreview] = useState<Drawing | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Drawing | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const htsPanes = useHtsPanes({ chart, enabled: htsEnabled, settings: hts, onSettings: setHts,
    container: containerRef, extraCount, bars, indicatorBars: props.indicatorBars, times,
    flow, aligned: alignedFlow, effectiveTrustStart, hoverIndex: hoverIdx, theme, upColor, downColor,
    quantityUnit, source: props.source, profileDescription, interval });
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
  const stateRef = useRef({ pending, magnet, bars, times, timeIndex, history, selected, pendingAvwap });
  stateRef.current = { pending, magnet, bars, times, timeIndex, history, selected, pendingAvwap };

  const toPricePoint = useCallback((x: number, y: number) => {
    if (htsEnabled && hts.collapsed.price) return null;
    const container = containerRef.current;
    const pane = chart?.panes()[pricePaneIndex];
    const element = pane?.getHTMLElement();
    if (!chart || !container || !element || !pane) return null;
    const outer = container.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return pricePanePoint(x, y, { left: chart.priceScale("left", pricePaneIndex).width(), top: rect.top - outer.top,
      width: chart.timeScale().width(), height: pane.getHeight() });
  }, [chart, pricePaneIndex, htsEnabled, hts.collapsed.price]);

  const anchorAt = useCallback(
    (x: number, y: number, t: Time | undefined, paneLocal = false): Anchor | null => {
      const s = mainRef.current;
      if (!s || !chart) return null;
      const point = paneLocal ? { x, y } : toPricePoint(x, y);
      if (!point) return null;
      const st = stateRef.current;
      let time = t as string | number | undefined;
      if (time === undefined) {
        const lg = chart.timeScale().coordinateToLogical(point.x);
        if (lg == null) return null;
        time = st.times[Math.max(0, Math.min(st.times.length - 1, Math.round(lg)))];
      }
      if (time === undefined) return null;
      const raw = s.coordinateToPrice(point.y);
      if (raw == null) return null;
      const idx = st.timeIndex.get(time);
      const bar = idx != null ? st.bars[idx] : undefined;
      return { t: time, p: snapPrice(raw, { market, instrument: props.instrument, magnet: st.magnet, bar }) };
    },
    [chart, market, props.instrument, toPricePoint],
  );

  useEffect(() => {
    if (!chart) return;
    const onMove = (param: MouseEventParams<Time>) => {
      const st = stateRef.current;
      const idx = param.time != null ? st.timeIndex.get(param.time as string | number) : undefined;
      setHoverIdx(idx ?? null);
      props.onHover?.(idx != null ? st.bars[idx]! : null);
      const inPrice = param.paneIndex === pricePaneIndex;
      const group = inPrice && toolRef.current === "cursor" ? eventGroupsRef.current.find(item => item.id === param.hoveredObjectId) ?? null : null;
      setHoveredEvent(group);
      vpPrim.current.setStyle({ hoverPrice: inPrice && param.point ? mainRef.current?.coordinateToPrice(param.point.y) ?? null : null });
      const cur = toolRef.current;
      if (!inPrice || cur === "cursor" || cur === "replay-pick" || cur === "avwap-anchor" || !param.point || !st.pending.length) return;
      const a = anchorAt(param.point.x, param.point.y, param.time, true);
      if (a) setPreview(newDrawing(cur, [...st.pending, a], "preview"));
    };
    chart.subscribeCrosshairMove(onMove);
    return () => {
      chart.unsubscribeCrosshairMove(onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, anchorAt]);

  useEffect(() => {
    if (!chart) return;
    const onClick = (param: MouseEventParams<Time>) => {
      if (toolRef.current !== "cursor" || param.paneIndex !== pricePaneIndex || !param.point || drawingPrim.current.hit(param.point.x, param.point.y)) return;
      const group = eventGroupsRef.current.find(item => item.id === param.hoveredObjectId);
      if (group) {
        eventTriggerRef.current = containerRef.current?.parentElement?.parentElement ?? null;
        setEventSelection({ scope: layoutKey, items: group.items });
      }
    };
    chart.subscribeClick(onClick);
    return () => chart.unsubscribeClick(onClick);
  }, [chart, pricePaneIndex, layoutKey]);

  /**
   * Tap/click handling from DOM pointer events: lightweight-charts swallows a
   * second click inside its double-click window, which breaks quick two-point
   * drawing. A press that moves < 5 px is a click.
   */
  const handleClick = useCallback(
    (x: number, y: number) => {
      const point = toPricePoint(x, y);
      if (!point) return;
      const st = stateRef.current;
      const cur = toolRef.current;
      const a = anchorAt(x, y, undefined);
      if (cur === "replay-pick") {
        const idx = a ? st.timeIndex.get(a.t) : undefined;
        if (idx != null) {
          const rawIndex = rawBars.findIndex((bar) => bar.date === st.bars[idx]?.date);
          if (rawIndex >= 0) setReplay({ cursor: rawIndex, playing: false, speed: 1 });
        }
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
        const hit = drawingPrim.current.hit(point.x, point.y);
        if (hit) return setSelected(hit.id);
        setSelected(null);
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
    [anchorAt, toPricePoint, rawBars],
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
      const point = toPricePoint(x, y);
      if (!point) return;
      const hit = drawingPrim.current.hit(point.x, point.y);
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
  }, [chart, anchorAt, handleClick, toPricePoint]);

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
  const [panel, setPanel] = useState<null | "indicators" | "objects" | "alerts" | "hts">(null);
  const [compareInput, setCompareInput] = useState("");
  const htsTriggerRef = useRef<HTMLButtonElement | null>(null);
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
    if (def.id === "vprofile") setVp(previous => ({ ...previous, enabled: true }));
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
  const profileVisible = (on: boolean) => {
    setVp(previous => ({ ...previous, enabled: on }));
    setLayout(previous => ({ ...previous, indicators: previous.indicators.map(item => item.id === "vprofile" ? { ...item, visible: on } : item) }));
  };
  const changeAnnotations = (on: boolean) => {
    setLayout(previous => ({ ...previous, overlays: Object.fromEntries(Object.keys(previous.overlays).map(key => [key, on])) as ChartLayoutState["overlays"] }));
    setVp(previous => ({ ...previous, rangeOn: on }));
  };
  const readability = () => {
    setHts(applyChartReadabilityPreset);
    setLayout(previous => ({ ...previous,
      overlays: Object.fromEntries(Object.keys(previous.overlays).map(key => [key, false])) as ChartLayoutState["overlays"],
      indicators: previous.indicators.map(item => item.id === "vprofile" ? { ...item, visible: true } : item),
    }));
  };


  // ── Export (F7.2) ──────────────────────────────────────────────────────
  const exportPng = () => {
    if (!chart) return;
    downloadCanvasPng(composeChartPng(chart.takeScreenshot(true, false), [
      `${props.name ?? code} · ${market} ${code} · ${intervalKey} · ${props.source}`,
      `매물대 ${vp.enabled ? profileDescription : "OFF"} · 합계 ${vpProfile?.totalValue ?? 0} · ${vpProfile?.method ?? "자료 없음"}`,
      ...(htsEnabled ? [`RSI(${hts.rsiPeriod}) ${hts.signalMethod.toUpperCase()}(${hts.signalPeriod}) · ${hts.trustMode === "daily" ? "투신 일별 순매수" : `투신 누적순매수 시작 ${effectiveTrustStart || "확인 중"}`}`] : []),
      ...htsPanes.summaries.filter(() => htsEnabled).map((item) => `${item.title}: ${item.value} ${item.unit} · ${item.status} · ${item.asOf} · ${item.source}`),
      profileMetadata.adjustment,
    ]), chartExportName(market, code, intervalKey, "png", Date.now()));
  };
  const exportCsv = () => {
    const w = visibleWindow(bars.length, visible);
    const rows = bars.slice(w.from, w.to + 1).map((b, i) => ({ time: times[w.from + i]!, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volumeValid === false ? null : b.volume }));
    const extra: { name: string; values: (number | null)[] }[] = [{ name: "volume_valid", values: bars.slice(w.from, w.to + 1).map((b) => b.volumeValid === false ? 0 : 1) }];
    for (const inst of renderedIndicators) {
      const v = values.get(inst.uid);
      const def = INDICATOR_BY_ID.get(inst.id);
      if (!inst.visible || !v || !def || inst.id === "volume") continue;
      for (const o of def.outputs) extra.push({ name: `${instanceLabel(inst)}${def.outputs.length > 1 ? `.${o.key}` : ""}`, values: (v[o.key] ?? []).slice(w.from, w.to + 1) });
    }
    if (htsEnabled) {
      extra.push({ name: `RSI(${hts.rsiPeriod})`, values: htsPanes.rsiData.rsi.slice(w.from, w.to + 1) }, { name: `${hts.signalMethod.toUpperCase()}(${hts.signalPeriod})`, values: htsPanes.rsiData.signal.slice(w.from, w.to + 1) });
      for (const period of [5, 20, 60] as const) extra.push({ name: `VolumeSMA${period}`, values: htsPanes.averages[period].slice(w.from, w.to + 1) });
      for (const id of FLOW_METRICS) extra.push({ name: id, values: alignedFlow[id].points.slice(w.from, w.to + 1).map((p) => p.value) });
    }
    const flowRows = flowToCsv(flow, alignedFlow, replayAt, { trustMode: hts.trustMode, cumulativeStart: effectiveTrustStart });
    downloadCsv(`${barsToCsv(rows, extra)}\r\n\r\n${(vpProfile ? profileToCsv(vpProfile, profileMetadata) : "profile,status\r\n,disabled")}\r\n\r\ntrustMode,${hts.trustMode}\r\ncumulativeStart,${effectiveTrustStart}\r\n${flowRows}`, chartExportName(market, code, intervalKey, "csv", Date.now()));
  };

  // ── HUD + legend ───────────────────────────────────────────────────────
  const hi = hoverIdx ?? bars.length - 1;
  const hb = bars[hi];
  const prevClose = hi > 0 ? bars[hi - 1]?.close : undefined;
  const legend: LegendItem[] = [
    ...renderedIndicators.map((inst) => {
      const def = INDICATOR_BY_ID.get(inst.id);
      const v = values.get(inst.uid);
      const first = def?.outputs[0]?.key;
      const val = first && v ? v[first]?.[hi] : null;
      return {
        id: inst.uid,
        label: instanceLabel(inst),
        color: resolveSmaStyle(inst, themeMode)?.color ?? inst.color,
        value: val != null ? (def?.pane === "overlay" ? fmt(val) : inst.id === "volume" ? formatChartVolume(val, market) : val.toFixed(2)) : null,
        visible: inst.id === "vprofile" ? vp.enabled : inst.visible,
        onToggle: () => inst.id === "vprofile" ? profileVisible(!vp.enabled) : setLayout((l) => ({ ...l, indicators: l.indicators.map((i) => (i.uid === inst.uid ? { ...i, visible: !i.visible } : i)) })),
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

  const hud = hb ? (
    <div className="flex flex-wrap items-center gap-x-2 tabular" data-testid="chart-ohlc">
      <span className="text-muted-foreground">{hb.date}</span>
      <span>O {fmt(hb.open)}</span>
      <span>H {fmt(hb.high)}</span>
      <span>L {fmt(hb.low)}</span>
      <span style={{ color: hb.close >= hb.open ? upColor : downColor }}>C {fmt(hb.close)}</span>
      {prevClose ? <span style={{ color: hb.close >= prevClose ? upColor : downColor }}>{formatChartPercent(((hb.close - prevClose) / prevClose) * 100)}</span> : null}
      <span className="text-muted-foreground">V {hb.volumeValid === false ? "— (거래량 결측)" : formatChartVolume(hb.volume, market)}</span>
      {vp.rangeOn && rangeStats ? <RangeHud stats={rangeStats} up={upColor} down={downColor} /> : null}
      {vp.showPoc && vpProfile?.poc != null && (
        <span className="text-muted-foreground">
          POC {fmt(vpProfile.poc)}
          {vp.showVa && vpProfile.val != null && vpProfile.vah != null ? ` · VA ${fmt(vpProfile.val)}–${fmt(vpProfile.vah)}` : ""}
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
  const htsHeight = HTS_PANEL_ORDER.reduce((sum, id) => sum + (hts.collapsed[id] ? 34 : hts.panelHeights[id]), 34) + extraCount * 100;
  const shellHeight = htsEnabled ? htsHeight : typeof props.height === "number" ? props.height + Math.max(0, sepPanes - 1) * 88 : (props.height ?? 480);
  const status = hasData ? { source: props.source, mode: props.modeLabel, updatedAt: props.updatedAt, note: `${rawBars.length.toLocaleString("ko-KR")}봉${rawBars.length > 10_000 ? " (최근 10,000봉)" : ""}` } : null;

  return (
    <>
      <ChartShell
        title={props.name ? `${props.name} · ${code}` : code}
        toolbarExtra={props.toolbarExtra}
        toolbar={toolbar}
        displayControls={<><SmaControls instances={layout.indicators} unavailable={STANDARD_SMA_PERIODS.filter(period => layout.indicators.some(i => i.id === "sma" && Number(i.params.period) === period && i.visible) && !layout.indicators.filter(i => i.id === "sma" && Number(i.params.period) === period).some(i => values.get(i.uid)?.v?.some(value => value != null)))} mode={themeMode} disabled={loadedKey !== layoutKey} onToggle={period => setLayout(previous => ({ ...previous, indicators: toggleStandardSma(previous.indicators, period) }))} /><ChartDisplayControls overlays={overlays} rangeOn={vp.rangeOn} profileOn={vp.enabled}
          legacyProfile={vp.widthRatio < 0.4 || vp.rangeMode === "all" || vp.rows > 20}
          ready={loadedKey === layoutKey && htsLoaded === scopeKey}
          onToggle={key => setLayout(previous => ({ ...previous, overlays: { ...previous.overlays, [key]: !previous.overlays[key] } }))}
          onRange={() => setVp(previous => ({ ...previous, rangeOn: !previous.rangeOn }))}
          onProfile={() => profileVisible(!vp.enabled)} onAll={changeAnnotations} onReadability={readability}
          onSettings={trigger => { htsTriggerRef.current = trigger; setPanel("hts"); }}
          onIndicators={() => setPanel("indicators")} onObjects={() => setPanel("objects")}
          eventCount={chartEvents.length} onEvents={trigger => { eventTriggerRef.current = trigger; setEventSelection({ scope: layoutKey, items: chartEvents }); }} /></> }
        hud={hud}
        legend={legend}
        status={status}
        onExportPng={hasData ? exportPng : undefined}
        onExportCsv={hasData ? exportCsv : undefined}
        onFullscreen={props.onFullscreen}
        onKeyDown={onKeyDown}
        height={shellHeight}
        minPlotHeight={htsEnabled ? htsHeight : undefined}
        testId={props.testId ?? "pro-chart"}
        collapseToolbar={props.compact}
        footer={<>
          {vp.rangeOn && <RangePositionStrip
            stats={rangeStats}
            compact={props.compact}
            formatValue={fmt}
            caption={
              vp.recentSpan === "swing"
                ? "보이는 구간 기준. 최근 고점·저점은 오른쪽이 확정된 스윙입니다. 같으면 기간=최근."
                : `보이는 구간 기준. 최근 고저 창은 ${vp.recentSpan === "all" ? "구간 전체" : vp.recentSpan}입니다. 기간 극값과 같으면 기간=최근.`
            }
          />}
          {eventGroups.length > 0 && <details className="border-t border-border px-3 py-2 text-xs" data-testid="chart-event-groups">
            <summary className="min-h-11 cursor-pointer">화면의 주석 묶음 {eventGroups.length}개 · 원래 날짜별 상세</summary>
            <div className="flex flex-wrap gap-1">{eventGroups.map(group => <button type="button" key={group.id} className="min-h-11 rounded bg-muted px-2 text-left text-xs" data-testid="chart-event-group" data-event-count={group.items.length} data-event-categories={JSON.stringify(group.categoryCounts)} onClick={event => { eventTriggerRef.current = event.currentTarget; setEventSelection({ scope: layoutKey, items: group.items }); }} title={group.items.map(item => `${CHART_EVENT_LABELS[item.category]} · ${formatChartEventTime(item.originalTime ?? item.time, market)} · ${item.title}`).join("\n")}>
              {group.text} · {group.from === group.to ? formatChartEventTime(group.from, market) : `${formatChartEventTime(group.from, market)}~${formatChartEventTime(group.to, market)}`}
            </button>)}</div>
          </details>}
          <ProfileDetails profile={vpProfile} metadata={profileMetadata} onExport={() => downloadCsv((vpProfile ? profileToCsv(vpProfile, profileMetadata) : "profile,status\r\n,disabled"), `${code}-profile.csv`)} />
          {htsEnabled && <details className="border-t border-border p-3 text-xs" data-testid="hts-data-details">
            <summary className="min-h-11 cursor-pointer">6단 지표 값·출처·제공 상태 · {hts.trustMode === "daily" ? "투신 일별 순매수" : `${hts.trustMode === "available-cumulative" ? "가용 시작 " : ""}${effectiveTrustStart || "확인 중"}부터 누적`}</summary>
            <div className="overflow-x-auto"><table className="w-full text-left"><caption className="text-left text-muted-foreground">같은 날짜의 실제 값과 결측 사유 · 투신은 범위를 이동해도 누적 시작일 유지</caption><thead><tr><th>패널</th><th>값</th><th>상태</th><th>기준일</th><th>출처</th></tr></thead><tbody>
              {htsPanes.summaries.map((item) => <tr key={item.id}><th className="p-2">{item.title}</th><td>{item.value} {item.unit}</td><td>{item.status}</td><td>{item.asOf}</td><td>{item.source}</td></tr>)}
            </tbody></table></div>
          </details>}
        </>}
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
        {hoveredEvent && <div role="tooltip" className="pointer-events-none absolute left-2 top-2 z-30 max-w-xs rounded border border-border bg-card/95 p-2 text-xs" data-testid="chart-event-tooltip">
          <div>{formatChartEventTime(hoveredEvent.from, market)}~{formatChartEventTime(hoveredEvent.to, market)} · {Object.entries(hoveredEvent.categoryCounts).map(([key, count]) => `${CHART_EVENT_LABELS[key as keyof typeof CHART_EVENT_LABELS]} ${count}`).join(" · ")}</div>
          {hoveredEvent.items.slice(0, 3).map(item => <div key={item.id} className="truncate">{item.title}</div>)}
          <div className="text-muted-foreground">클릭·탭 또는 ‘주석 상세’에서 전체 {hoveredEvent.items.length}건 확인</div>
        </div>}
        <div ref={containerRef} className="absolute inset-0 isolate" style={{ cursor: tool === "cursor" ? "crosshair" : "cell", touchAction: "pan-y" }} data-testid="chart-canvas" data-visible-from={visible?.from} data-visible-to={visible?.to} data-event-groups={eventGroups.length} data-event-items={chartEvents.length} data-marker-count={eventGroups.length} data-event-categories={JSON.stringify(chartEvents.reduce((counts, item) => ({ ...counts, [item.category]: (counts[item.category] ?? 0) + 1 }), {} as Record<string, number>))} data-range-enabled={vp.rangeOn} />
      </ChartShell>
      {compare.map((sym) => (
        <CompareLoader key={sym} sym={sym} interval={interval} minuteSize={props.minuteSize} range={props.range} onBars={onCompareBars} />
      ))}
      <Sheet open={panel === "hts"} onOpenChange={(open) => setPanel(open ? "hts" : null)}>
        <SheetContent portalContainer={fullscreenPortal} className="overflow-y-auto" onCloseAutoFocus={(event) => { if (htsTriggerRef.current?.isConnected) { event.preventDefault(); htsTriggerRef.current.focus(); } }}><SheetHeader><SheetTitle>차트·매물대 설정</SheetTitle><SheetDescription>현재 종목·주기·화면의 설정을 저장합니다. 기존 드로잉은 유지됩니다.</SheetDescription></SheetHeader>
          {legacyNotice && <p className="m-4 text-xs text-muted-foreground" role="status">기존 지표·드로잉과 RSI 기간을 보존했습니다. 공통 6단과 추가 지표를 함께 표시합니다. 기본값 복원은 공통 6단 설정만 변경합니다.</p>}
          <HtsSettingsPanel settings={hts} onChange={setHts} allowHts={htsAllowed} onRestore={() => {
            setHts({ ...defaultHtsSettings(market, instrument), trustStartDate: hts.trustStartDate || rawBars[0]?.date.slice(0, 10) || "" });
            setLegacyNotice(false);
          }} />
        </SheetContent>
      </Sheet>
      <IndicatorPanel portalContainer={fullscreenPortal}
        open={panel === "indicators"}
        onOpenChange={(v) => setPanel(v ? "indicators" : null)}
        instances={layout.indicators}
        onAdd={addIndicator}
        onChange={(id, patch) => {
          if (layout.indicators.find(item => item.uid === id)?.id === "vprofile" && typeof patch.visible === "boolean") setVp(previous => ({ ...previous, enabled: patch.visible! }));
          setLayout((l) => ({ ...l, indicators: l.indicators.map((i) => (i.uid === id ? { ...i, ...patch } : i)) }));
        }}
        onRemove={(id) => {
          if (layout.indicators.find(item => item.uid === id)?.id === "vprofile") setVp(previous => ({ ...previous, enabled: false }));
          setLayout((l) => ({ ...l, indicators: l.indicators.filter((i) => i.uid !== id) }));
        }}
        templates={templates}
        onSaveTemplate={(name) =>
          setChartPrefs({ templates: { ...(chartPrefs.templates ?? {}), [name]: { indicators: layout.indicators, smaBundleVersion: 1, chartType: layout.chartType, scale: layout.scale, savedAt: new Date().toISOString() } } })
        }
        onApplyTemplate={(name) => {
          const t = chartPrefs.templates?.[name];
          if (!t) return;
          const profiles = (t.indicators as IndicatorInstance[]).filter(item => item.id === "vprofile");
          if (profiles.length) setVp(previous => ({ ...previous, enabled: profiles.some(item => item.visible) }));
          setLayout((l) => ({
            ...l,
            indicators: (t.smaBundleVersion === 1 ? t.indicators as IndicatorInstance[] : migrateStandardSmas(t.indicators as IndicatorInstance[])).map((i) => ({ ...i, uid: `${i.id}-${uid()}` })),
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
      <ObjectManager portalContainer={fullscreenPortal}
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
      <AlertsPanel portalContainer={fullscreenPortal}
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
      <Sheet open={eventSelection?.scope === layoutKey} onOpenChange={open => { if (!open) setEventSelection(null); }}>
        <SheetContent portalContainer={fullscreenPortal} side="right" className="w-full max-w-lg overflow-y-auto p-0" data-testid="chart-event-details" onCloseAutoFocus={event => { if (eventTriggerRef.current?.isConnected) { event.preventDefault(); eventTriggerRef.current.focus(); } }}>
          <SheetHeader className="border-b border-border">
            <SheetTitle>차트 주석 상세 ({eventSelection?.items.length ?? 0})</SheetTitle>
            <SheetDescription>표시만 묶은 원본 항목 · 날짜와 분류를 보존합니다.</SheetDescription>
          </SheetHeader>
          <ul className="divide-y divide-border px-4">{eventSelection?.items.map(item => <li key={item.id} className="py-3 text-sm" data-testid="chart-event-item" data-event-category={item.category}>
            <div className="text-xs text-muted-foreground">{CHART_EVENT_LABELS[item.category]} · {formatChartEventTime(item.originalTime ?? item.time, market)}{item.source ? ` · ${item.source}` : ""}</div>
            <div className="break-words">{item.title}</div>
            {item.publishedAt && <div className="text-xs text-muted-foreground">공표 {formatChartEventTime(item.publishedAt, market)}</div>}
            {item.url && /^https?:\/\//i.test(item.url) && <button type="button" onClick={() => openKnownUrl(item.url!)} className="min-h-11 text-primary underline">원문 보기</button>}
          </li>)}</ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

export type { IChartApi };
