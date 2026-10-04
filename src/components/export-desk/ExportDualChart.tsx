import { useEffect, useMemo, useRef, useState } from "react";
import { LineSeries, type IChartApi, type ISeriesApi, type SeriesType } from "lightweight-charts";
import { computeSeriesRangePosition, planRangeMarkers, rangeMarkerText, type RangePositionStats } from "@/lib/chart-indicators";
import { RangeMarkerPrimitive, type RangeMark } from "@/components/charts/pro/primitives";
import { RangePositionStrip } from "@/components/stocks/RangePositionStrip";
import { ChartShell } from "@/components/charts/core/ChartShell";
import { createProChart } from "@/components/charts/core/create-pro-chart";
import { readChartTheme } from "@/components/charts/core/theme";
import { exportChartPng, exportRowsCsv, RangePresets, ScaleToggle, useChartChrome } from "@/components/charts/core/chrome";
import { formatChartPercent } from "@/lib/chart-format";
import { useAppStore } from "@/lib/store";
import { useStandardSma } from "@/components/charts/core/use-standard-sma";
import { SmaControls } from "@/components/charts/core/SmaControls";

export type DualPoint = {
  time: string;
  a: number | null;
  b: number | null;
};

function toDay(period: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period;
  if (/^\d{4}-\d{2}$/.test(period)) return `${period}-01`;
  return period.slice(0, 10);
}

function marksFor(stats: RangePositionStats | null, times: string[], formatValue: (n: number) => string, up: string, down: string): { marks: RangeMark[]; lastTime: string | null; lastPrice: number | null } {
  if (!stats || !times.length) return { marks: [], lastTime: null, lastPrice: null };
  const marks = planRangeMarkers(stats).flatMap((p) => {
    const time = times[p.idx];
    if (!time) return [];
    const copy = rangeMarkerText(p, formatValue(p.price), formatChartPercent(p.pct));
    return [{ time, price: p.price, role: p.role, place: copy.place, title: copy.title, pctText: copy.pctText, color: p.role === "high" ? down : up }];
  });
  return { marks, lastTime: times[times.length - 1] ?? null, lastPrice: stats.close };
}

/** Export × KOSPI dual-axis chart. Export amount series never get a volume profile. */
export function ExportDualChart({
  data,
  history,
  aName,
  bName,
  aColor = "#d4a017",
  bColor = "#3b82f6",
  source = "FRED/OECD · Yahoo",
  asOf = null,
  mode = "월간",
}: {
  data: DualPoint[];
  /** Same transformations/base/scales, before the parent clips its date range. */
  history?: DualPoint[];
  aName: string;
  bName: string;
  aColor?: string;
  bColor?: string;
  source?: string;
  asOf?: string | null;
  mode?: string;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const aPrim = useRef(new RangeMarkerPrimitive());
  const bPrim = useRef(new RangeMarkerPrimitive());
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [series, setSeries] = useState<{ a: ISeriesApi<SeriesType> | null; b: ISeriesApi<SeriesType> | null }>({ a: null, b: null });
  const [smaFocus, setSmaFocus] = useState<"a" | "b">("a");
  const convention = useAppStore((s) => s.colorConvention);
  const up = convention === "korea" ? "#ef4444" : "#22c55e";
  const down = convention === "korea" ? "#3b82f6" : "#ef4444";
  const rows = useMemo(() => data.map((d) => ({ ...d, time: toDay(d.time) })), [data]);
  const hasData = data.some((d) => d.a != null || d.b != null);
  const aPoints = useMemo(() => rows.filter((d) => d.a != null && Number.isFinite(d.a)), [rows]);
  const bPoints = useMemo(() => rows.filter((d) => d.b != null && Number.isFinite(d.b)), [rows]);
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const smaPoints = useMemo(() => rows.map(row => ({ time: row.time, value: row[smaFocus] })), [rows, smaFocus]);
  const smaHistory = useMemo(() => history?.map(row => ({ time: toDay(row.time), value: row[smaFocus] })), [history, smaFocus]);
  const averages = useStandardSma({ chart, source: series[smaFocus], points: smaPoints,
    history: smaHistory, scope: `export-dual:${aName}:${bName}:${mode}`, formatValue: fmt, scaleId: smaFocus === "a" ? "left" : "right" });

  const aStats = useMemo(
    () => computeSeriesRangePosition(aPoints.map((d) => ({ value: d.a as number, date: d.time })), undefined, { recentSpan: "52W" }),
    [aPoints],
  );
  const bStats = useMemo(
    () => computeSeriesRangePosition(bPoints.map((d) => ({ value: d.b as number, date: d.time })), undefined, { recentSpan: "52W" }),
    [bPoints],
  );

  useEffect(() => {
    const el = elRef.current;
    if (!el || !hasData) return;
    const c = createProChart(el, readChartTheme(), "US");
    c.applyOptions({
      localization: { locale: "ko-KR", priceFormatter: (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 2 }) },
      leftPriceScale: { visible: true, borderColor: "rgba(148,163,184,0.2)" },
      timeScale: { timeVisible: false, rightOffset: 2 },
    });
    const a = c.addSeries(LineSeries, { color: aColor, lineWidth: 2, title: aName, priceLineVisible: false, priceScaleId: "left" });
    const b = c.addSeries(LineSeries, { color: bColor, lineWidth: 2, title: bName, priceLineVisible: false, priceScaleId: "right" });
    a.setData(aPoints.map((d) => ({ time: d.time as "2020-01-01", value: d.a as number })));
    b.setData(bPoints.map((d) => ({ time: d.time as "2020-01-01", value: d.b as number })));
    a.attachPrimitive(aPrim.current);
    b.attachPrimitive(bPrim.current);
    c.timeScale().fitContent();
    setChart(c);
    setSeries({ a, b });
    return () => {
      setChart(null);
      setSeries({ a: null, b: null });
      queueMicrotask(() => c.remove());
    };
  }, [aPoints, bPoints, aName, bName, aColor, bColor, hasData]);

  useEffect(() => {
    const a = marksFor(aStats, aPoints.map((d) => d.time), fmt, up, down);
    const b = marksFor(bStats, bPoints.map((d) => d.time), fmt, up, down);
    aPrim.current.set(a.marks, a.lastTime, a.lastPrice);
    bPrim.current.set(b.marks, b.lastTime, b.lastPrice);
  }, [aStats, bStats, aPoints, bPoints, up, down, series.a, series.b]);

  const { legend, hud } = useChartChrome(chart, [
    { id: "a", label: `${aName} (좌)`, color: aColor, api: series.a },
    { id: "b", label: `${bName} (우)`, color: bColor, api: series.b },
  ]);

  if (!hasData) {
    return <div className="flex h-[380px] items-center justify-center text-sm text-muted-foreground">그릴 관측값이 없습니다.</div>;
  }

  return (
    <div>
      <RangePositionStrip stats={aStats} compact caption={`${aName} · 최근 12개월(52W) · 수출 시계열에는 매물대 없음`} formatValue={fmt} />
      <RangePositionStrip stats={bStats} compact caption={`${bName} · 최근 12개월(52W) · 지수 라인에는 거래량 매물대 없음`} formatValue={fmt} />
      <ChartShell
        title={`${aName} × ${bName}`}
        displayControls={<><label className="flex min-h-11 items-center gap-1 text-xs">SMA 대상<select aria-label="SMA 대상 시계열" value={smaFocus} onChange={event => setSmaFocus(event.target.value === "b" ? "b" : "a")} className="h-9 max-w-40 rounded border border-border bg-background px-1"><option value="a">{aName} (좌)</option><option value="b">{bName} (우)</option></select></label><SmaControls instances={averages.instances} unavailable={averages.unavailable} mode={averages.mode} onToggle={averages.toggle} disabled={!averages.ready} /></>}
        toolbar={
          <>
            <RangePresets chart={chart} first={rows[0]?.time} last={rows.at(-1)?.time} />
            <ScaleToggle chart={chart} allowed={["normal", "log", "percent"]} priceScaleIds={["left", "right"]} />
          </>
        }
        hud={hud}
        legend={legend}
        status={{ source, mode, updatedAt: asOf, note: "고저 마커는 본체에 표시. 수출액 패널에는 매물대를 그리지 않습니다." }}
        onExportPng={() => exportChartPng(chart, "KR", "EXPORT", "export-kospi")}
        onExportCsv={() => exportRowsCsv(chart, rows, [{ name: aName, get: (r) => r.a }, { name: bName, get: (r) => r.b }], "KR", "EXPORT", "export-kospi")}
        height={380}
        testId="export-dual-chart"
      >
        <div ref={elRef} className="absolute inset-0" />
      </ChartShell>
    </div>
  );
}

const LINE_COLORS = ["#d4a017", "#38bdf8", "#34d399", "#f472b6", "#a78bfa", "#fb7185"];

export type AmountSeries = { id: string; name: string; points: { time: string; value: number }[] };

/** Up to six official export series. No volume profile. Range markers on the focus series only. */
export function ExportAmountChart({
  series,
  focusId,
  source,
  asOf,
}: {
  series: AmountSeries[];
  focusId: string;
  source: string;
  asOf: string | null;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const focusPrim = useRef(new RangeMarkerPrimitive());
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [apis, setApis] = useState<ISeriesApi<SeriesType>[]>([]);
  const convention = useAppStore((s) => s.colorConvention);
  const up = convention === "korea" ? "#ef4444" : "#22c55e";
  const down = convention === "korea" ? "#3b82f6" : "#ef4444";
  const shown = series.slice(0, 6);
  const key = shown.map((s) => `${s.id}:${s.points.length}:${s.points.at(-1)?.time ?? ""}`).join("|");
  const focus = shown.find((s) => s.id === focusId) ?? shown[0];
  const smaPoints = useMemo(() => focus?.points.map(p => ({ time: toDay(p.time), value: p.value })) ?? [], [focus]);
  const averages = useStandardSma({ chart, source: apis[shown.findIndex(s => s.id === focus?.id)] ?? null,
    points: smaPoints, scope: `export-amount:${focus?.id ?? "none"}`, formatValue: n => `$${n.toFixed(1)}bn` });
  const focusStats = useMemo(
    () => (focus ? computeSeriesRangePosition(focus.points.map((p) => ({ value: p.value, date: p.time })), undefined, { recentSpan: "52W" }) : null),
    [focus],
  );

  useEffect(() => {
    const el = elRef.current;
    if (!el || !shown.length) return;
    const c = createProChart(el, readChartTheme(), "US");
    c.applyOptions({
      localization: { locale: "ko-KR", priceFormatter: (v: number) => `$${v.toFixed(1)}bn` },
      timeScale: { timeVisible: false, rightOffset: 2 },
    });
    const next: ISeriesApi<SeriesType>[] = [];
    shown.forEach((s, i) => {
      const api = c.addSeries(LineSeries, {
        color: LINE_COLORS[i % LINE_COLORS.length],
        lineWidth: s.id === focus?.id ? 2 : 1,
        title: s.name,
        priceLineVisible: false,
        lastValueVisible: s.id === focus?.id,
      });
      api.setData(s.points.map((p) => ({ time: toDay(p.time) as "2020-01-01", value: p.value })));
      if (s.id === focus?.id) api.attachPrimitive(focusPrim.current);
      next.push(api);
    });
    c.timeScale().fitContent();
    setChart(c);
    setApis(next);
    return () => {
      setChart(null);
      setApis([]);
      queueMicrotask(() => c.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, focusId]);

  useEffect(() => {
    if (!focus) return focusPrim.current.set([], null, null);
    const times = focus.points.map((p) => toDay(p.time));
    const packed = marksFor(focusStats, times, (n) => `$${n.toFixed(1)}bn`, up, down);
    focusPrim.current.set(packed.marks, packed.lastTime, packed.lastPrice);
  }, [focus, focusStats, up, down, apis]);

  const { legend, hud } = useChartChrome(
    chart,
    shown.map((s, i) => ({ id: s.id, label: s.name, color: LINE_COLORS[i % LINE_COLORS.length], api: apis[i] ?? null })),
  );

  if (!shown.length) {
    return <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">선택한 품목에 Comtrade 관측이 없습니다.</div>;
  }

  return (
    <div>
      {focusStats && <RangePositionStrip stats={focusStats} compact caption={`${focus?.name ?? ""} · 최근 12개월 · 수출액 차트에는 매물대 없음`} formatValue={(n) => `$${n.toFixed(1)}bn`} />}
      <ChartShell
        title="주력 품목 수출 (HS 근사, 십억달러)"
        displayControls={<><span className="text-xs text-muted-foreground">SMA 대상: {focus?.name}</span><SmaControls instances={averages.instances} unavailable={averages.unavailable} mode={averages.mode} onToggle={averages.toggle} disabled={!averages.ready} /></>}
        toolbar={<RangePresets chart={chart} first={shown[0]?.points[0] ? toDay(shown[0].points[0].time) : undefined} last={focus?.points.at(-1) ? toDay(focus.points.at(-1)!.time) : undefined} />}
        hud={hud}
        legend={legend}
        status={{ source, mode: "월간 · 확정 HS", updatedAt: asOf, note: "MOTIE MTI 금액이 아닙니다. 없는 월은 비워 둡니다." }}
        onExportPng={() => exportChartPng(chart, "KR", "EXPORT", "core-items")}
        height={340}
        testId="export-amount-chart"
      >
        <div ref={elRef} className="absolute inset-0" />
      </ChartShell>
    </div>
  );
}
