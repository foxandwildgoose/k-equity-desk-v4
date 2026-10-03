import { useEffect, useMemo, useRef, useState } from "react";
import type { OhlcBar, StockValuation } from "@/server/naver-market";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useChartData } from "@/lib/use-market";
import { computeRangePosition } from "@/lib/chart-indicators";
import { RangePositionStrip } from "@/components/stocks/RangePositionStrip";
import {
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
  type IPriceLine,
} from "lightweight-charts";
import { ChartShell } from "@/components/charts/core/ChartShell";
import { createProChart } from "@/components/charts/core/create-pro-chart";
import { readChartTheme } from "@/components/charts/core/theme";
import { exportChartPng, exportRowsCsv, RangePresets, ScaleToggle, useChartChrome } from "@/components/charts/core/chrome";
import { Loader2, LineChart } from "lucide-react";

type Metric = "per" | "pbr" | "psr";
type Basis = "ttm" | "cns";

const METRICS: { id: Metric; label: string; unit: string; help: string }[] = [
  { id: "per", label: "PER", unit: "배", help: "밴드 = EPS × 배수 (주가와 동일 축)" },
  { id: "pbr", label: "PBR", unit: "배", help: "밴드 = BPS × 배수" },
  { id: "psr", label: "PSR", unit: "배", help: "밴드 = SPS × 배수" },
];

function fundFor(
  metric: Metric,
  basis: Basis,
  basic: StockValuation | null | undefined,
): { fund: number; currentMultiple: number | null; label: string } {
  if (!basic) return { fund: 0, currentMultiple: null, label: "—" };
  const price = basic.price ?? 0;
  if (metric === "per") {
    const fund =
      basis === "cns"
        ? (basic.cnsEps ?? 0)
        : (basic.eps ?? (basic.perNum && price ? price / basic.perNum : 0));
    const mult =
      basis === "cns"
        ? (basic.cnsPer ?? (fund > 0 && price ? price / fund : null))
        : (basic.perNum ?? (fund > 0 && price ? price / fund : null));
    return {
      fund,
      currentMultiple: mult && Number.isFinite(mult) ? mult : null,
      label:
        basis === "cns"
          ? "컨센서스 EPS"
          : basic.epsSource === "ttm-4q"
            ? "TTM EPS (최근 4분기 합)"
            : basic.epsSource === "naver-headline"
              ? "TTM EPS (네이버)"
              : basic.epsSource === "fy"
                ? "FY EPS (연간·TTM 아님)"
                : basic.epsSource === "implied"
                  ? "암시 EPS (주가÷PER)"
                  : "TTM EPS",
    };
  }
  if (metric === "pbr") {
    const fund = basic.bps ?? (basic.pbrNum && price ? price / basic.pbrNum : 0);
    const mult = basic.pbrNum ?? (fund > 0 && price ? price / fund : null);
    return { fund, currentMultiple: mult, label: "BPS" };
  }
  const fund = basic.sps ?? 0;
  const mult = basic.psrNum ?? (fund > 0 && price ? price / fund : null);
  return { fund, currentMultiple: mult, label: "SPS" };
}

function toTime(date: string): Time {
  return date.slice(0, 10) as Time;
}

function zoneOf(price: number, lo: number, mid: number, hi: number) {
  if (!(price > 0) || !(mid > 0)) return { label: "—", tone: "text-muted-foreground" };
  if (price < lo) return { label: "밴드 하단 이탈 · 상대 저평가 구간", tone: "text-desk-teal" };
  if (price > hi) return { label: "밴드 상단 이탈 · 상대 고평가 구간", tone: "text-desk-rose" };
  if (price < mid) return { label: "기준선 아래 · 할인 구간", tone: "text-desk-gold" };
  return { label: "기준선 위 · 할증 구간", tone: "text-desk-copper" };
}

/**
 * Price vs user PER/PBR/PSR fair-value bands on one axis.
 */
export function ValuationBandChart({
  code,
  market,
  bars: barsProp,
  basic,
  loading: loadingProp,
}: {
  code?: string;
  market?: "KOSPI" | "KOSDAQ";
  bars: OhlcBar[];
  basic?: StockValuation | null;
  loading?: boolean;
}) {
  const [metric, setMetric] = useState<Metric>("per");
  const [basis, setBasis] = useState<Basis>("ttm");
  const [minStr, setMinStr] = useState("0.5");
  const [maxStr, setMaxStr] = useState("2");
  const [midStr, setMidStr] = useState("1");
  const seeded = useRef("");

  const own = useChartData({
    code: code ?? "",
    market: market ?? "KOSPI",
    interval: "day",
    range: "2y",
    enabled: !!code,
  });
  const bars =
    (own.data?.bars?.length ? own.data.bars : null) ??
    (barsProp.length > 0 ? barsProp : []);
  const loading = loadingProp || own.isLoading;

  const { fund, currentMultiple, label: fundLabel } = fundFor(metric, basis, basic);

  useEffect(() => {
    const key = `${metric}:${basis}`;
    if (currentMultiple == null || currentMultiple <= 0) return;
    if (seeded.current === key) return;
    seeded.current = key;
    if (metric === "per") {
      const mid = currentMultiple;
      setMidStr(mid.toFixed(1));
      setMinStr((mid * 0.6).toFixed(1));
      setMaxStr((mid * 1.4).toFixed(1));
    } else {
      const mid = currentMultiple;
      setMidStr(mid.toFixed(2));
      setMinStr(Math.max(0.05, mid * 0.5).toFixed(2));
      setMaxStr((mid * 1.5).toFixed(2));
    }
  }, [metric, basis, currentMultiple]);

  const minM = Number(minStr);
  const maxM = Number(maxStr);
  const midM = Number(midStr);
  const loM = Number.isFinite(minM) && minM > 0 ? Math.min(minM, Number.isFinite(maxM) ? maxM : minM) : 0.5;
  const hiM = Number.isFinite(maxM) && maxM > 0 ? Math.max(maxM, Number.isFinite(minM) ? minM : maxM) : 2;
  const midUse = Number.isFinite(midM) && midM > 0 ? midM : 1;

  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<"Line"> | null>(null);
  const midRef = useRef<ISeriesApi<"Line"> | null>(null);
  const upperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const lowerRef = useRef<ISeriesApi<"Line"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const chart = createProChart(el, readChartTheme(), "KR");
    chart.applyOptions({
      rightPriceScale: { scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { rightOffset: 4, barSpacing: 6, timeVisible: false },
    });
    priceRef.current = chart.addSeries(LineSeries, {
      color: "#22d3ee",
      lineWidth: 3,
      title: "주가",
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerRadius: 5,
    });
    midRef.current = chart.addSeries(LineSeries, {
      color: "#facc15",
      lineWidth: 3,
      lineStyle: 0,
      title: "기준배수",
      lastValueVisible: true,
      priceLineVisible: false,
    });
    upperRef.current = chart.addSeries(LineSeries, {
      color: "#fb7185",
      lineWidth: 3,
      lineStyle: 2,
      title: "상단",
      lastValueVisible: true,
      priceLineVisible: false,
    });
    lowerRef.current = chart.addSeries(LineSeries, {
      color: "#c084fc",
      lineWidth: 3,
      lineStyle: 2,
      title: "하단",
      lastValueVisible: true,
      priceLineVisible: false,
    });
    chartRef.current = chart;
    setChartApi(chart);
    return () => {
      setChartApi(null);
      chart.remove();
      chartRef.current = null;
      priceRef.current = null;
      midRef.current = null;
      upperRef.current = null;
      lowerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!priceRef.current || !midRef.current || !upperRef.current || !lowerRef.current)
      return;

    const priceData = bars
      .filter((b) => b.close > 0 && b.date)
      .map((b) => ({ time: toTime(b.date), value: b.close }));

    priceRef.current.setData(priceData);

    for (const pl of linesRef.current) {
      try {
        priceRef.current.removePriceLine(pl);
      } catch {
        /* */
      }
    }
    linesRef.current = [];

    if (fund > 0 && priceData.length) {
      const times = priceData.map((d) => d.time);
      const midV = fund * midUse;
      const upV = fund * hiM;
      const loV = fund * loM;
      midRef.current.setData(times.map((time) => ({ time, value: midV })));
      upperRef.current.setData(times.map((time) => ({ time, value: upV })));
      lowerRef.current.setData(times.map((time) => ({ time, value: loV })));
      const mk = (price: number, color: string, title: string, style: number) => {
        const pl = priceRef.current!.createPriceLine({
          price,
          color,
          lineWidth: 2,
          lineStyle: style,
          axisLabelVisible: true,
          title,
        });
        linesRef.current.push(pl);
      };
      mk(midV, "#facc15", `${midUse}×`, 0);
      mk(upV, "#fb7185", `상단 ${hiM}×`, 2);
      mk(loV, "#c084fc", `하단 ${loM}×`, 2);
    } else {
      midRef.current.setData([]);
      upperRef.current.setData([]);
      lowerRef.current.setData([]);
    }
    chartRef.current?.timeScale().fitContent();
  }, [bars, fund, loM, hiM, midUse, metric, basis]);

  const lastClose = useMemo(() => {
    for (let i = bars.length - 1; i >= 0; i--) {
      if (bars[i].close > 0) return bars[i].close;
    }
    return basic?.price ?? 0;
  }, [bars, basic?.price]);

  const midPrice = fund > 0 ? fund * midUse : null;
  const upPrice = fund > 0 ? fund * hiM : null;
  const loPrice = fund > 0 ? fund * loM : null;
  const zone = zoneOf(lastClose, loPrice ?? 0, midPrice ?? 0, upPrice ?? 0);
  const vsMid =
    midPrice && lastClose
      ? ((lastClose / midPrice - 1) * 100)
      : null;
  const vsHi =
    upPrice && lastClose ? ((lastClose / upPrice - 1) * 100) : null;

  const rangeStats = useMemo(
    () => computeRangePosition(bars, { close: lastClose }),
    [bars, lastClose],
  );

  const { legend, hud } = useChartChrome(chartApi, [
    { id: "price", label: "주가", color: "#22d3ee", api: priceRef.current as ISeriesApi<SeriesType> | null, format: (v) => formatPrice(Math.round(v)) },
    { id: "mid", label: `기준 ${midUse}×`, color: "#facc15", api: midRef.current as ISeriesApi<SeriesType> | null, format: (v) => formatPrice(Math.round(v)) },
    { id: "upper", label: `상단 ${hiM}×`, color: "#fb7185", api: upperRef.current as ISeriesApi<SeriesType> | null, format: (v) => formatPrice(Math.round(v)) },
    { id: "lower", label: `하단 ${loM}×`, color: "#c084fc", api: lowerRef.current as ISeriesApi<SeriesType> | null, format: (v) => formatPrice(Math.round(v)) },
  ]);
  const csvRows = useMemo(() => bars.filter((b) => b.close > 0 && b.date).map((b) => ({ time: b.date.slice(0, 10), close: b.close })), [bars]);

  return (
    <section className="desk-card desk-card-gold overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-3 py-2.5 md:px-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold flex items-center gap-1.5">
            <LineChart className="size-4 text-desk-gold" />
            밸류에이션 밴드
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            주가와 {METRICS.find((m) => m.id === metric)?.label} 공정가치 밴드를 같은 가격축에 겹침 ·{" "}
            {METRICS.find((m) => m.id === metric)?.help}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {metric === "per" && (
            <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
              {([
                ["ttm", "TTM"],
                ["cns", "컨센서스"],
              ] as const).map(([id, lab]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBasis(id)}
                  className={cn(
                    "rounded px-2.5 py-1.5 text-xs font-semibold min-h-8",
                    basis === id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {lab}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
            {METRICS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetric(m.id)}
                className={cn(
                  "rounded px-2.5 py-1.5 text-xs font-semibold min-h-8",
                  metric === m.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-1.5 rounded-lg border border-border bg-card/80 px-2 py-1.5">
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">기준(배)</span>
              <input
                type="number"
                step="0.1"
                min="0.01"
                value={midStr}
                onChange={(e) => setMidStr(e.target.value)}
                className="w-16 rounded border-2 border-yellow-400/60 bg-background px-1.5 py-1 text-xs tabular font-bold text-yellow-300"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">최소(배)</span>
              <input
                type="number"
                step="0.1"
                min="0.01"
                value={minStr}
                onChange={(e) => setMinStr(e.target.value)}
                className="w-16 rounded border-2 border-violet-400/60 bg-background px-1.5 py-1 text-xs tabular font-bold text-violet-300"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">최대(배)</span>
              <input
                type="number"
                step="0.1"
                min="0.01"
                value={maxStr}
                onChange={(e) => setMaxStr(e.target.value)}
                className="w-16 rounded border-2 border-rose-400/60 bg-background px-1.5 py-1 text-xs tabular font-bold text-rose-300"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 border-b border-border px-3 py-2.5 md:px-4 text-xs">
        <div>
          <div className="text-muted-foreground">{fundLabel}</div>
          <div className="font-semibold tabular">
            {fund !== 0 ? formatPrice(Math.round(fund)) : "—"}
          </div>
          {metric === "per" && basis === "ttm" && basic?.ttmQuarters?.length === 4 && (
            <div className="text-[10px] text-muted-foreground tabular">
              {basic.ttmQuarters
                .slice()
                .reverse()
                .map((k) => `${k.slice(0, 4)}.${k.slice(4)}`)
                .join(" + ")}
            </div>
          )}
        </div>
        <div>
          <div className="text-muted-foreground">
            현재 {METRICS.find((m) => m.id === metric)?.label}
          </div>
          <div className="font-semibold tabular">
            {currentMultiple != null ? `${currentMultiple.toFixed(2)}배` : "—"}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">하단 {loM}×</div>
          <div className="font-bold tabular text-violet-300">
            {loPrice != null ? formatPrice(Math.round(loPrice)) : "—"}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">기준 {midUse}× / 상단 {hiM}×</div>
          <div className="font-semibold tabular">
            {midPrice != null ? formatPrice(Math.round(midPrice)) : "—"}
            {upPrice != null && (
              <span className="text-rose-300 ml-1">
                / {formatPrice(Math.round(upPrice))}
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">기준선 대비</div>
          <div className="font-semibold tabular">
            {vsMid == null ? "—" : `${vsMid >= 0 ? "+" : ""}${vsMid.toFixed(1)}%`}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">상단까지</div>
          <div className={cn("font-semibold tabular", zone.tone)}>
            {vsHi == null ? "—" : `${vsHi >= 0 ? "+" : ""}${vsHi.toFixed(1)}%`}
          </div>
        </div>
      </div>

      {fund > 0 && lastClose > 0 && (
        <div className={cn("px-3 py-2 text-xs font-medium border-b border-border", zone.tone)}>
          {zone.label}
          {vsMid != null && (
            <span className="text-muted-foreground font-normal">
              {" "}
              · 주가 {formatPrice(lastClose)} vs 기준 {formatPrice(Math.round(midPrice ?? 0))}
            </span>
          )}
        </div>
      )}

      <RangePositionStrip
        stats={rangeStats}
        compact
        caption="주가 차트 구간 기준 · 기간 고/저는 절대 최고·최저, 최근 고/저는 확인된 스윙."
      />

      <ChartShell
        title={`${METRICS.find((m) => m.id === metric)?.label} 밴드 · ${fundLabel}`}
        toolbar={
          <>
            <RangePresets chart={chartApi} first={csvRows[0]?.time} last={csvRows.at(-1)?.time} />
            <ScaleToggle chart={chartApi} allowed={["normal", "log"]} />
          </>
        }
        hud={hud}
        legend={legend}
        status={bars.length ? { source: own.data?.source ? `${own.data.source} · 펀더멘털 네이버` : "Yahoo/네이버 · 펀더멘털 네이버", mode: `일봉 종가 · 밴드 = ${fundLabel} × 배수`, updatedAt: own.dataUpdatedAt || null } : null}
        onExportPng={bars.length ? () => exportChartPng(chartApi, "KR", code ?? "", `band-${metric}`) : undefined}
        onExportCsv={
          bars.length
            ? () =>
                exportRowsCsv(
                  chartApi,
                  csvRows,
                  [
                    { name: "close", get: (r) => r.close },
                    { name: `mid_${midUse}x`, get: () => (fund > 0 ? Math.round(fund * midUse) : null) },
                    { name: `upper_${hiM}x`, get: () => (fund > 0 ? Math.round(fund * hiM) : null) },
                    { name: `lower_${loM}x`, get: () => (fund > 0 ? Math.round(fund * loM) : null) },
                  ],
                  "KR",
                  code ?? "",
                  `band-${metric}`,
                )
            : undefined
        }
        height={340}
        testId="valuation-band-chart"
      >
        <div ref={wrapRef} className="absolute inset-0" />
        {loading && bars.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-card/70">
            <Loader2 className="size-4 animate-spin mr-2" /> 차트 로딩…
          </div>
        )}
        {!loading && bars.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            가격 데이터 없음
          </div>
        )}
        {bars.length > 0 && fund <= 0 && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {metric === "per"
              ? "EPS를 아직 읽지 못했습니다. PBR로 전환하거나 잠시 후 새로고침하세요."
              : `${fundLabel}가 없어 밴드를 계산할 수 없습니다.`}
          </div>
        )}
      </ChartShell>

      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
        <span className="font-semibold text-sky-300">시안 실선</span> = 종가 ·{" "}
        <span className="font-semibold text-yellow-300">노란 실선</span> = 기준 배수(
        {midUse}×) ·{" "}
        <span className="font-semibold text-rose-300">로즈 점선</span> = 최대 ·{" "}
        <span className="font-semibold text-violet-300">보라 점선</span> = 최소.
        PER은 최근 4개 보고 분기 EPS 합(TTM) 또는 컨센서스. 배수는 오른쪽 위 칸에서 입력.
        분기 합이 없으면 네이버 헤드라인 → 연간 EPS → 주가÷PER 순으로 대체하며 라벨에 출처를 표시합니다.
        투자 권유가 아닙니다.
      </div>
    </section>
  );
}
