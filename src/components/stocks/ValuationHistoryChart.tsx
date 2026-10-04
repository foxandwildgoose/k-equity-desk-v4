import { useEffect, useMemo, useRef, useState } from "react";
import { useValuationSeries } from "@/lib/use-market";
import {
  fairPriceFromEvMultiple,
  fairPriceFromPer,
  resliceValuation,
  type MultipleSeries,
  type PriceBandPoint,
} from "@/lib/valuation-series";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RangePositionStrip, StreetTapeRow } from "@/components/stocks/RangePositionStrip";
import { computeSeriesRangePosition, streetTape } from "@/lib/chart-indicators";
import {
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { Loader2 } from "lucide-react";
import { ChartShell } from "@/components/charts/core/ChartShell";
import { proChartOptions } from "@/components/charts/core/create-pro-chart";
import { readChartTheme } from "@/components/charts/core/theme";
import { exportChartPng, exportRowsCsv } from "@/components/charts/core/chrome";
import { useStandardSma } from "@/components/charts/core/use-standard-sma";
import { SmaControls } from "@/components/charts/core/SmaControls";

export type ChartViewMode = "price" | "per" | "fwdPer" | "evEbitda" | "evSales" | "band";
export type ValuationMode = Exclude<ChartViewMode, "price">;

export const CHART_VIEWS: { id: ChartViewMode; label: string; tip: string }[] = [
  { id: "price", label: "가격", tip: "캔들 · 거래량 · 이평 · 고점/저점 대비" },
  { id: "per", label: "PER", tip: "후행 PER = 수정주가 ÷ TTM 또는 직전 결산 EPS" },
  { id: "fwdPer", label: "선행 PER", tip: "수정주가 ÷ 최신 컨센서스 EPS" },
  { id: "evEbitda", label: "EV/EBITDA", tip: "기업가치 ÷ EBITDA" },
  { id: "evSales", label: "EV/Sales", tip: "기업가치 ÷ 매출과 가격 밴드" },
  { id: "band", label: "밴드·백분위", tip: "평균 ±1σ ±2σ와 구간 백분위" },
];

const TITLES: Record<ValuationMode, string> = {
  per: "후행 PER",
  fwdPer: "선행 PER",
  evEbitda: "EV/EBITDA",
  evSales: "EV/Sales",
  band: "밸류에이션 밴드",
};

type RangeId = "1y" | "3y" | "5y" | "10y" | "max";
const RANGES: { id: RangeId; label: string; years: number | null }[] = [
  { id: "1y", label: "1년", years: 1 },
  { id: "3y", label: "3년", years: 3 },
  { id: "5y", label: "5년", years: 5 },
  { id: "10y", label: "10년", years: 10 },
  { id: "max", label: "최대", years: null },
];

function fmtMult(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const d = Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2;
  return `${n.toFixed(d)}배`;
}

function fmtPctile(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(0)}%ile`;
}

function fmtQuote(n: number, currency: "KRW" | "USD"): string {
  if (!Number.isFinite(n)) return "—";
  if (currency === "USD") {
    return n >= 1000
      ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return formatPrice(n);
}

function zoneOf(percentile: number | null): { text: string; tone: string } {
  if (percentile == null) return { text: "백분위 없음", tone: "text-muted-foreground" };
  if (percentile <= 10) return { text: "역사적 하단", tone: "text-desk-teal" };
  if (percentile <= 30) return { text: "하위 구간", tone: "text-desk-teal" };
  if (percentile >= 90) return { text: "역사적 상단", tone: "text-desk-rose" };
  if (percentile >= 70) return { text: "상위 구간", tone: "text-desk-rose" };
  return { text: "중간 구간", tone: "text-desk-gold" };
}

function cutoff(to: string | null, range: RangeId): string | null {
  const years = RANGES.find((r) => r.id === range)?.years;
  if (!to || years == null) return null;
  const d = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function finiteLine(rows: { date: string; value: number | null }[]): { time: Time; value: number }[] {
  const seen = new Set<string>();
  const out: { time: Time; value: number }[] = [];
  for (const row of rows) {
    const date = row.date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || seen.has(date)) continue;
    if (row.value == null || !Number.isFinite(row.value)) continue;
    seen.add(date);
    out.push({ time: date as Time, value: row.value });
  }
  return out;
}

type Hover = { date: string; rows: { label: string; value: string }[] };

export function ChartViewBar({
  view,
  onChange,
}: {
  view: ChartViewMode;
  onChange: (view: ChartViewMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-2.5 py-2">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        보기
      </span>
      <div className="flex flex-wrap gap-0.5 rounded-md bg-muted p-0.5">
        {CHART_VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.tip}
            onClick={() => onChange(item.id)}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-semibold min-h-8",
              view === item.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ValuationHistoryChart({
  code,
  mode,
}: {
  code: string;
  mode: ChartViewMode;
}) {
  if (mode === "price") return <WeeklyPriceChart code={code} />;
  return <MultipleChart code={code} mode={mode} />;
}

function WeeklyPriceChart({ code }: { code: string }) {
  const q = useValuationSeries(code, true);
  const [range, setRange] = useState<RangeId>("5y");
  const [fault, setFault] = useState<string | null>(null);
  const [api, setApi] = useState<IChartApi | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const smaSource = useRef<ISeriesApi<"Line"> | null>(null);
  const view = useMemo(() => {
    const pack = q.data;
    if (!pack) return null;
    return resliceValuation(pack, cutoff(pack.window.to, range));
  }, [q.data, range]);
  const points = view?.drivers.filter((row) => row.price > 0) ?? [];
  const smaPoints = useMemo(() => (view?.drivers ?? []).map(p => ({ time: p.date.slice(0, 10), value: p.price > 0 ? p.price : null })), [view]);
  const smaHistory = useMemo(() => (q.data?.drivers ?? []).map(p => ({ time: p.date.slice(0, 10), value: p.price > 0 ? p.price : null })), [q.data]);
  const averages = useStandardSma({ chart: api, source: smaSource.current, points: smaPoints, history: smaHistory,
    scope: `weekly-price:${code}:week`, formatValue: n => fmtQuote(n, view?.currency ?? "KRW") });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || points.length < 2 || !view) return;
    let chart: IChartApi | null = null;
    try {
      chart = createChart(el, {
        ...proChartOptions(readChartTheme(), view.currency === "USD" ? "US" : "KR"),
        // Series keep their own currency formatters (no global price formatter).
        localization: { locale: "ko-KR" },
        crosshair: { mode: CrosshairMode.Normal },
        timeScale: { timeVisible: false },
      });
      const line = chart.addSeries(LineSeries, {
        color: "#e2e8f0",
        lineWidth: 2,
        priceLineVisible: false,
        title: "수정주가",
        priceFormat: {
          type: "custom",
          minMove: 0.01,
          formatter: (v: number) => fmtQuote(v, view.currency),
        },
      });
      smaSource.current = line;
      line.setData(finiteLine(points.map((p) => ({ date: p.date, value: p.price }))));
      chart.timeScale().fitContent();
    } catch {
      chart?.remove();
      setFault("주가 차트를 그리지 못했습니다.");
      return;
    }
    const live = chart;
    setApi(live);
    return () => {
      setApi(null);
      smaSource.current = null;
      queueMicrotask(() => live.remove());
    };
  }, [view, points.length, range]);

  return (
    <section className="bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold">{view?.name ? `${view.name} · ` : ""}수정주가 · 주봉</h2>
          <p className="text-[11px] text-muted-foreground">
            Yahoo 수정종가. 국내 종목의 분·일 캔들과 드로잉은 가격 차트를 그대로 둡니다.
          </p>
        </div>
        <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-semibold min-h-8",
                range === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
      {q.isLoading ? (
        <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> 주가 불러오는 중…
        </div>
      ) : fault ? (
        <p className="px-4 py-16 text-center text-sm text-price-down">{fault}</p>
      ) : points.length < 2 ? (
        <p className="px-4 py-16 text-center text-sm text-muted-foreground">
          {view?.note ?? "주가 시계열이 없습니다."}
        </p>
      ) : (
        <ChartShell
          title="수정주가 · 주봉"
          displayControls={<SmaControls instances={averages.instances} unavailable={averages.unavailable} mode={averages.mode} onToggle={averages.toggle} disabled={!averages.ready} />}
          status={{ source: view?.source ? `Yahoo 수정종가 · ${view.source}` : "Yahoo 수정종가", mode: `주봉 · ${view?.currency ?? ""}`, asOfLabel: view?.window.to ?? null }}
          onExportPng={() => exportChartPng(api, view?.currency === "USD" ? "US" : "KR", code, "weekly-price")}
          onExportCsv={() => exportRowsCsv(api, points.map((p) => ({ time: p.date.slice(0, 10), price: p.price })), [{ name: "adj_close", get: (r) => r.price }], view?.currency === "USD" ? "US" : "KR", code, "weekly-price")}
          height={520}
          testId="weekly-price-chart"
        >
          <div ref={wrapRef} className="absolute inset-0" />
        </ChartShell>
      )}
    </section>
  );
}

function MultipleChart({
  code,
  mode,
}: {
  code: string;
  mode: ValuationMode;
}) {
  const q = useValuationSeries(code, true);
  const [range, setRange] = useState<RangeId>("5y");
  const [fault, setFault] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [logScale, setLogScale] = useState(false);
  const [api, setApi] = useState<IChartApi | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const smaSource = useRef<ISeriesApi<"Line"> | null>(null);

  const view = useMemo(() => {
    const pack = q.data;
    if (!pack) return null;
    return resliceValuation(pack, cutoff(pack.window.to, range));
  }, [q.data, range]);

  const active: MultipleSeries | null = view
    ? mode === "per"
      ? view.per
      : mode === "fwdPer"
        ? view.forwardPer
        : mode === "evEbitda"
          ? view.evEbitda
          : mode === "band"
            ? null
            : view.evSales
    : null;

  const stats = mode === "band" ? view?.valuationBand.stats : active?.stats;
  const zone = zoneOf(stats?.percentile ?? null);
  const z =
    stats?.current != null && stats.mean != null && stats.sigma != null && stats.sigma > 0
      ? (stats.current - stats.mean) / stats.sigma
      : null;

  const layout = mode === "evSales" || mode === "band" ? "price" : "multiple";
  const defined =
    mode === "band"
      ? (view?.valuationBand.points.filter((p) => p.price != null).length ?? 0)
      : (active?.stats.n ?? 0);

  const plotted = useMemo(() => {
    if (!view) return [] as { date: string; value: number }[];
    if (layout === "price") {
      const bands = mode === "band" ? view.valuationBand.points : view.evSales.priceBands;
      return bands
        .filter((p) => p.price != null && p.price > 0)
        .map((p) => ({ date: p.date, value: p.price as number }));
    }
    return (active?.points ?? [])
      .filter((p) => p.value != null && p.value > 0)
      .map((p) => ({ date: p.date, value: p.value as number }));
  }, [view, mode, layout, active]);

  const multiplePlotted = useMemo(() => {
    if (!view || layout !== "price") return [] as { date: string; value: number }[];
    const series = mode === "band"
      ? view.valuationBand.basis === "evSales"
        ? view.evSales
        : view.per
      : view.evSales;
    return series.points
      .filter((p) => p.value != null && p.value > 0)
      .map((p) => ({ date: p.date, value: p.value as number }));
  }, [view, mode, layout]);

  const rangeStats = useMemo(() => computeSeriesRangePosition(plotted), [plotted]);
  const multipleStats = useMemo(
    () => (multiplePlotted.length >= 2 ? computeSeriesRangePosition(multiplePlotted) : null),
    [multiplePlotted],
  );
  const tape = useMemo(
    () =>
      streetTape(
        plotted.map((p) => ({ high: p.value, low: p.value, close: p.value, date: p.date })),
        { lookback: 52 },
      ),
    [plotted],
  );
  const valueFmt = (n: number) =>
    layout === "price" && view ? fmtQuote(n, view.currency) : fmtMult(n);
  const smaHistory = useMemo(() => {
    const pack = q.data;
    if (!pack) return [];
    if (layout === "price") return (mode === "band" ? pack.valuationBand.points : pack.evSales.priceBands).map(p => ({ time: p.date.slice(0, 10), value: p.price }));
    const multiple = mode === "per" ? pack.per : mode === "fwdPer" ? pack.forwardPer : mode === "evEbitda" ? pack.evEbitda : pack.evSales;
    return multiple.points.map(p => ({ time: p.date.slice(0, 10), value: p.value }));
  }, [q.data, mode, layout]);
  const smaPoints = useMemo(() => smaHistory.filter(p => !view?.window.from || p.time >= view.window.from.slice(0, 10)), [smaHistory, view?.window.from]);
  const averages = useStandardSma({ chart: api, source: smaSource.current, points: smaPoints, history: smaHistory,
    scope: `valuation:${code}:${mode}:week`, formatValue: valueFmt });

  useEffect(() => {
    setFault(null);
    setHover(null);
  }, [code, mode, range]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !view || defined < 2 || fault) return;
    let chart: IChartApi | null = null;
    try {
      chart = createChart(el, {
        ...proChartOptions(readChartTheme(), view.currency === "USD" ? "US" : "KR"),
        // Multiples (e.g. 12.3×) keep per-series formatters — no global price formatter.
        localization: { locale: "ko-KR" },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "rgba(148,163,184,0.45)", labelBackgroundColor: "#0f172a" },
          horzLine: { color: "rgba(148,163,184,0.45)", labelBackgroundColor: "#0f172a" },
        },
        rightPriceScale: {
          borderColor: "rgba(148,163,184,0.18)",
          mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
        },
        timeScale: { borderColor: "rgba(148,163,184,0.18)", rightOffset: 6, timeVisible: false },
      });

      const quote = (v: number) => fmtQuote(v, view.currency);
      const multFmt = (v: number) => v.toFixed(Math.abs(v) >= 10 ? 1 : 2);
      const lookup = new Map<string, { label: string; value: string }[]>();

      if (layout === "multiple" && active) {
        const line = chart.addSeries(LineSeries, {
          color: "#22d3ee",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: TITLES[mode],
          priceFormat: { type: "custom", minMove: 0.01, formatter: multFmt },
        });
        const data = finiteLine(active.points.map((p) => ({ date: p.date, value: p.value })));
        smaSource.current = line;
        line.setData(data);
        for (const row of data) {
          lookup.set(String(row.time), [{ label: TITLES[mode], value: fmtMult(row.value) }]);
        }
        addLevelLines(line, active);
        try {
        const pct = chart.addSeries(
          HistogramSeries,
          {
            color: "#fbbf24",
            priceScaleId: "pct",
            priceLineVisible: false,
            lastValueVisible: false,
            priceFormat: { type: "custom", minMove: 1, formatter: (v: number) => `${v.toFixed(0)}` },
          },
          1,
        );
        pct.setData(
          finiteLine(active.points.map((p) => ({ date: p.date, value: p.percentile }))).map((row) => ({
            ...row,
            color: row.value >= 80 ? "#fb7185" : row.value <= 20 ? "#2dd4bf" : "#fbbf24",
          })),
        );
        chart.panes()[1]?.setHeight(92);
        chart.priceScale("pct", 1).applyOptions({
          scaleMargins: { top: 0.15, bottom: 0.15 },
          borderVisible: false,
        });
        } catch {
          /* percentile pane is optional; the multiple line still stands */
        }
      } else if (layout === "price" && view) {
        const bands: PriceBandPoint[] =
          mode === "band" ? view.valuationBand.points : view.evSales.priceBands;
        const price = chart.addSeries(LineSeries, {
          color: "#e2e8f0",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: "주가",
          priceFormat: { type: "custom", minMove: 0.01, formatter: quote },
        });
        const priceRows = finiteLine(bands.map((p) => ({ date: p.date, value: p.price })));
        smaSource.current = price;
        price.setData(priceRows);
        const specs: { key: keyof PriceBandPoint; color: string; title: string; style: number }[] = [
          { key: "mean", color: "#facc15", title: "평균", style: LineStyle.Solid },
          { key: "p1", color: "#fb7185", title: "+1σ", style: LineStyle.Dashed },
          { key: "m1", color: "#c084fc", title: "−1σ", style: LineStyle.Dashed },
          { key: "p2", color: "#e11d48", title: "+2σ", style: LineStyle.Dotted },
          { key: "m2", color: "#8b5cf6", title: "−2σ", style: LineStyle.Dotted },
        ];
        for (const spec of specs) {
          const rows = finiteLine(
            bands.map((p) => ({
              date: p.date,
              value: typeof p[spec.key] === "number" ? (p[spec.key] as number) : null,
            })),
          ).filter((row) => row.value > 0);
          if (rows.length < 2) continue;
          const series = chart.addSeries(LineSeries, {
            color: spec.color,
            lineWidth: 1,
            lineStyle: spec.style,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
            title: spec.title,
            priceFormat: { type: "custom", minMove: 0.01, formatter: quote },
          });
          series.setData(rows);
        }
        const pctStats = mode === "evSales" ? view.evSales.stats : view.valuationBand.stats;
        const useEv = mode === "evSales" || view.valuationBand.basis === "evSales";
        const pctSpecs: { key: "p10" | "p50" | "p90"; color: string; title: string }[] = [
          { key: "p10", color: "#2dd4bf", title: "p10" },
          { key: "p50", color: "#38bdf8", title: "p50" },
          { key: "p90", color: "#fb7185", title: "p90" },
        ];
        for (const spec of pctSpecs) {
          const mult = pctStats[spec.key];
          if (mult == null || !(mult > 0)) continue;
          const rows = finiteLine(
            view.drivers.map((row) => ({
              date: row.date,
              value: useEv
                ? fairPriceFromEvMultiple(row.salesEok, mult, row.netDebtEok, row.shares)
                : fairPriceFromPer(row.eps, mult),
            })),
          ).filter((row) => row.value > 0);
          if (rows.length < 2) continue;
          const series = chart.addSeries(LineSeries, {
            color: spec.color,
            lineWidth: 1,
            lineStyle: spec.key === "p50" ? LineStyle.Solid : LineStyle.Dashed,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
            title: spec.title,
            priceFormat: { type: "custom", minMove: 0.01, formatter: quote },
          });
          series.setData(rows);
        }
        for (const p of bands) {
          if (p.price == null) continue;
          const rows = [{ label: "주가", value: quote(p.price) }];
          for (const spec of specs) {
            const v = p[spec.key];
            if (typeof v === "number" && v > 0) rows.push({ label: spec.title, value: quote(v) });
          }
          lookup.set(p.date, rows);
        }
        if (mode === "evSales") {
          try {
          const mult = chart.addSeries(
            LineSeries,
            {
              color: "#22d3ee",
              lineWidth: 2,
              priceScaleId: "mult",
              priceLineVisible: false,
              lastValueVisible: true,
              title: "EV/Sales",
              priceFormat: { type: "custom", minMove: 0.01, formatter: multFmt },
            },
            1,
          );
          mult.setData(finiteLine(view.evSales.points.map((p) => ({ date: p.date, value: p.value }))));
          addLevelLines(mult, view.evSales);
          chart.panes()[1]?.setHeight(120);
          } catch {
            /* lower pane optional */
          }
        } else {
          try {
          const pct = chart.addSeries(
            HistogramSeries,
            {
              color: "#fbbf24",
              priceScaleId: "pct",
              priceLineVisible: false,
              lastValueVisible: false,
              priceFormat: { type: "custom", minMove: 1, formatter: (v: number) => `${v.toFixed(0)}` },
            },
            1,
          );
          pct.setData(
            finiteLine(view.valuationBand.percentilePoints.map((p) => ({ date: p.date, value: p.percentile }))).map(
              (row) => ({
                ...row,
                color: row.value >= 80 ? "#fb7185" : row.value <= 20 ? "#2dd4bf" : "#fbbf24",
              }),
            ),
          );
          chart.panes()[1]?.setHeight(92);
          } catch {
            /* percentile pane optional */
          }
        }
      }

      chart.subscribeCrosshairMove((param) => {
        const t = param.time ? String(param.time) : "";
        const rows = t ? lookup.get(t) : undefined;
        if (!t || !rows) {
          setHover(null);
          return;
        }
        setHover({ date: t, rows });
      });
      chart.timeScale().fitContent();
    } catch {
      chart?.remove();
      setFault("차트를 그리지 못했습니다. 가격 보기로 돌아간 뒤 다시 선택하세요.");
      return;
    }
    const live = chart;
    setApi(live);
    return () => {
      setApi(null);
      smaSource.current = null;
      queueMicrotask(() => live.remove());
    };
  }, [view, mode, layout, defined, fault, active, logScale]);

  return (
    <section className="bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-sm font-semibold">
              {view?.name ? `${view.name} · ` : ""}
              {TITLES[mode]}
            </h2>
            <span className={cn("text-xs font-semibold", zone.tone)}>{zone.text}</span>
          </div>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
            {mode === "band" ? view?.valuationBand.basisLabel : active?.basis}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => averages.setAll(!averages.instances.some(i => i.visible))}
            className={cn(
              "rounded px-2 py-1 text-[11px] font-semibold min-h-8",
              averages.instances.some(i => i.visible) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            SMA 모두
          </button>
          <button
            type="button"
            onClick={() => setLogScale((v) => !v)}
            className={cn(
              "rounded px-2 py-1 text-[11px] font-semibold min-h-8",
              logScale ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            Log
          </button>
          <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-semibold min-h-8",
                range === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
          </div>
        </div>
      </header>

      {q.isLoading ? (
        <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> 투자지표 불러오는 중…
        </div>
      ) : q.isError ? (
        <p className="px-4 py-16 text-center text-sm text-price-down">
          지표 서버가 응답하지 않았습니다. 배수를 만들지 않았습니다.
        </p>
      ) : fault ? (
        <p className="px-4 py-16 text-center text-sm text-price-down">{fault}</p>
      ) : defined < 2 ? (
        <div className="px-4 py-14 text-center">
          <p className="text-sm font-medium">이 보기로 그릴 시계열이 없습니다</p>
          <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
            {emptyReason(mode, view)}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 border-b border-border px-3 py-2 sm:grid-cols-4 lg:grid-cols-8">
            <Stat label="현재" value={fmtMult(stats?.current)} />
            <Stat label="평균" value={fmtMult(stats?.mean)} />
            <Stat label="σ" value={stats?.sigma != null ? stats.sigma.toFixed(2) : "—"} />
            <Stat label="Z" value={z != null ? `${z >= 0 ? "+" : ""}${z.toFixed(2)}` : "—"} />
            <Stat
              label={mode === "fwdPer" ? "경로 순위" : "백분위"}
              value={fmtPctile(stats?.percentile)}
            />
            <Stat label="+1σ / −1σ" value={`${fmtMult(positive(stats?.p1))} / ${fmtMult(positive(stats?.m1))}`} />
            <Stat label="+2σ / −2σ" value={`${fmtMult(positive(stats?.p2))} / ${fmtMult(positive(stats?.m2))}`} />
            <Stat label="표본" value={stats?.n ? `${stats.n}주` : "—"} />
          </div>
          <p className="border-b border-border px-3 py-1 text-[10px] text-muted-foreground tabular">
            백분위 밴드 p10 {fmtMult(positive(stats?.p10))} · p50 {fmtMult(positive(stats?.p50))} · p90{" "}
            {fmtMult(positive(stats?.p90))}
            {layout === "price" ? " · 당시 실적에 투영한 가격선" : " · 배수 눈금의 가로선"}
          </p>
          <RangePositionStrip
            stats={rangeStats}
            compact
            formatValue={valueFmt}
            caption={
              layout === "price"
                ? "선택한 구간의 주가 고점·저점 대비. 줌이 아니라 기간 버튼 기준입니다."
                : "선택한 구간의 배수 고점·저점 대비. 가격 차트와 같은 위치 지표입니다."
            }
          />
          <ChartShell
            title={TITLES[mode]}
            displayControls={<SmaControls instances={averages.instances} unavailable={averages.unavailable} mode={averages.mode} onToggle={averages.toggle} disabled={!averages.ready} />}
            status={{ source: view?.source ? `${view.source} · Yahoo 수정주가` : "네이버 기업정보 · Yahoo", mode: `주간 · ${layout === "price" ? `가격(${view?.currency})` : "배수"}`, asOfLabel: view?.window.to ?? null }}
            onExportPng={() => exportChartPng(api, view?.currency === "USD" ? "US" : "KR", code, `valuation-${mode}`)}
            onExportCsv={() =>
              exportRowsCsv(
                api,
                plotted.map((p) => ({ time: p.date.slice(0, 10), value: p.value, mult: multiplePlotted.find((m) => m.date === p.date)?.value ?? null })),
                [
                  { name: layout === "price" ? "price" : mode, get: (r) => r.value },
                  ...(multiplePlotted.length ? [{ name: "multiple", get: (r: { mult: number | null }) => r.mult }] : []),
                ],
                view?.currency === "USD" ? "US" : "KR",
                code,
                `valuation-${mode}`,
              )
            }
            height={520}
            testId="valuation-history-chart"
          >
            {hover && (
              <div className="pointer-events-none absolute left-3 top-2 z-10 rounded-md border border-border bg-background/90 px-2 py-1.5 text-[11px] shadow-sm">
                <div className="font-semibold tabular">{hover.date}</div>
                {hover.rows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-4 tabular text-muted-foreground">
                    <span>{row.label}</span>
                    <span className="text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
            )}
            <div ref={wrapRef} className="absolute inset-0" />
          </ChartShell>
          <StreetTapeRow
            tape={tape}
            formatValue={valueFmt}
            fastLabel="50주"
            slowLabel="200주"
          />
          {multipleStats ? (
            <RangePositionStrip
              stats={multipleStats}
              compact
              formatValue={fmtMult}
              caption={mode === "band" ? "밴드 기준 배수의 고점·저점 대비" : "EV/Sales 배수의 고점·저점 대비"}
            />
          ) : null}
          <p className="border-t border-border px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
            {view?.window.from} – {view?.window.to}
            {view?.currency === "USD" ? " · USD" : " · KRW"}
            {" · "}
            통계와 σ 밴드는 위 구간만 사용. 음수 σ 가격은 그리지 않음. {view?.note}{" "}
            {view?.sourceUrl ? (
              <a href={view.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                원문
              </a>
            ) : null}
          </p>
        </>
      )}
    </section>
  );
}

function positive(n: number | null | undefined): number | null {
  return n != null && n > 0 ? n : null;
}

function emptyReason(
  mode: ValuationMode,
  view: { note: string; consensus: { eps: number } | null } | null,
): string {
  if (!view) return "재무 또는 주가가 없습니다.";
  if (mode === "fwdPer" && !view.consensus) {
    return "최신 컨센서스 EPS를 확인하지 못했습니다. 과거 컨센서스를 지어내지 않으므로 선행 PER은 비워 둡니다. " + view.note;
  }
  if (mode === "evEbitda") {
    return "EV/EBITDA는 영업이익과 감가상각이 둘 다 있고, 부채와 현금이 공시에 있을 때만 그립니다. 하나라도 없으면 배수를 만들지 않습니다. " + view.note;
  }
  if (mode === "evSales") {
    return "EV/Sales는 매출과 시가총액, 그리고 공시된 순차입금이 있을 때만 그립니다. " + view.note;
  }
  return view.note;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-semibold tabular">{value}</div>
    </div>
  );
}

function addLevelLines(series: ISeriesApi<"Line">, data: MultipleSeries) {
  const levels: { value: number | null; color: string; title: string; style: number }[] = [
    { value: positive(data.stats.mean), color: "#facc15", title: "평균", style: LineStyle.Solid },
    { value: positive(data.stats.p1), color: "#fb7185", title: "+1σ", style: LineStyle.Dashed },
    { value: positive(data.stats.m1), color: "#c084fc", title: "−1σ", style: LineStyle.Dashed },
    { value: positive(data.stats.p2), color: "#e11d48", title: "+2σ", style: LineStyle.Dotted },
    { value: positive(data.stats.m2), color: "#8b5cf6", title: "−2σ", style: LineStyle.Dotted },
    { value: positive(data.stats.p10), color: "#2dd4bf", title: "p10", style: LineStyle.Dashed },
    { value: positive(data.stats.p50), color: "#38bdf8", title: "p50", style: LineStyle.Solid },
    { value: positive(data.stats.p90), color: "#fb7185", title: "p90", style: LineStyle.Dashed },
  ];
  for (const level of levels) {
    if (level.value == null) continue;
    series.createPriceLine({
      price: level.value,
      color: level.color,
      lineWidth: 1,
      lineStyle: level.style,
      axisLabelVisible: true,
      title: level.title,
    });
  }
}
