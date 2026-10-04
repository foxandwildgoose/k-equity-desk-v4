import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Market } from "@/data/types";
import type { ChartInterval, MinuteSize } from "@/server/naver-market";
import { useAnalysisChartData } from "@/lib/charts/use-analysis-chart-data";
import { useChartSecurity } from "@/lib/charts/use-chart-security";
import { chartLayoutScope } from "@/lib/charts/security";
import { formatPrice, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StreetTapeRow, ChartAnalyticsStrip, BandCompareStrip, RsiDivergenceStrip, MacdCrossStrip } from "@/components/stocks/RangePositionStrip";
import { ChartViewBar, ValuationHistoryChart, type ChartViewMode } from "@/components/stocks/ValuationHistoryChart";
import {
  compareBollingerAndPercentile,
  detectMacdCrosses,
  detectRsiDivergences,
  quantSnapshot,
  streetTape,
} from "@/lib/chart-indicators";
import { ProChart, type ChartMarkerInput } from "@/components/charts/pro/ProChart";
import { barTimeOf } from "@/lib/charts/bar-time";
import { Loader2 } from "lucide-react";

const INTERVALS: { id: ChartInterval; label: string }[] = [
  { id: "minute", label: "분" },
  { id: "day", label: "일" },
  { id: "week", label: "주" },
  { id: "month", label: "월" },
  { id: "year", label: "년" },
];

const MINUTE_SIZES: MinuteSize[] = [1, 3, 5, 10, 15, 30, 60];

const RANGES: { id: string; label: string }[] = [
  { id: "1mo", label: "1M" },
  { id: "3mo", label: "3M" },
  { id: "6mo", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "2y", label: "2Y" },
  { id: "5y", label: "5Y" },
  { id: "max", label: "MAX" },
];

/** Professional minute history windows (Yahoo hard limits). */
function minuteRangesFor(size: MinuteSize): { id: string; label: string }[] {
  if (size <= 1) {
    return [
      { id: "1d", label: "1일" },
      { id: "5d", label: "5일" },
      { id: "7d", label: "7일" },
    ];
  }
  if (size === 3) {
    // True 3m = bucketed 1m; Yahoo 1m history ≤7d
    return [
      { id: "1d", label: "1일" },
      { id: "5d", label: "5일" },
      { id: "7d", label: "7일" },
    ];
  }
  if (size < 60) {
    return [
      { id: "1d", label: "1일" },
      { id: "5d", label: "5일" },
      { id: "1mo", label: "1개월" },
      { id: "60d", label: "60일" },
    ];
  }
  return [
    { id: "1mo", label: "1개월" },
    { id: "3mo", label: "3개월" },
    { id: "6mo", label: "6개월" },
    { id: "1y", label: "1년" },
    { id: "2y", label: "2년" },
  ];
}

function defaultMinuteRange(size: MinuteSize): string {
  if (size <= 1) return "7d";
  if (size === 3) return "7d";
  if (size < 60) return "60d";
  return "1y";
}

/**
 * Price chart used on /stock, /etfs and /us (F7 Tier A): data + interval
 * controls + analytics strips around the shared `ProChart` core. Fullscreen
 * opens the `/chart` workspace for this symbol.
 */
export function TradingChart({
  code,
  market,
  eventMarkers = [],
  researchMarkers,
  instrument,
  name,
}: {
  code: string;
  market: Market | "US";
  /** Optional disclosure/event dates (YYYY-MM-DD) for chart markers */
  eventMarkers?: { time: string; title: string }[];
  /** Research TP-change markers (daily bars). */
  researchMarkers?: ChartMarkerInput[];
  instrument?: "stock" | "etf" | "etn";
  name?: string;
}) {
  const isUs = market === "US";
  const mk: "KR" | "US" = isUs ? "US" : "KR";
  const security = useChartSecurity(code, mk);
  const product = instrument ?? security.data?.instrument;
  const layoutScope = chartLayoutScope("detail");
  const px = (n: number) => (isUs ? formatUsd(n) : formatPrice(n));
  const navigate = useNavigate();
  const [interval, setInterval] = useState<ChartInterval>("day");
  const [minuteSize, setMinuteSize] = useState<MinuteSize>(5);
  const [range, setRange] = useState(isUs ? "5y" : "2y");
  const [prePost, setPrePost] = useState(false);
  const [view, setView] = useState<ChartViewMode>("price");

  // Keep range valid for interval / minute size (pro default = max useful history)
  useEffect(() => {
    if (interval === "minute") {
      const opts = minuteRangesFor(minuteSize);
      if (!opts.some((o) => o.id === range)) setRange(defaultMinuteRange(minuteSize));
    } else if (!RANGES.some((o) => o.id === range)) {
      setRange("2y");
    }
  }, [interval, minuteSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const minuteRangeOpts = minuteRangesFor(minuteSize);
  const { data, isLoading, isError, isFetching, dataUpdatedAt, profileBars, profileSource, indicatorBars, priceBasisNote } = useAnalysisChartData({
    code,
    market,
    interval,
    minuteSize,
    range,
    prePost: isUs && interval === "minute" ? prePost : undefined,
  });

  const bars = useMemo(() => data?.bars ?? [], [data?.bars]);
  const source = data?.source ?? "";

  const street = useMemo(() => {
    if (bars.length < 2) return null;
    const lookback = interval === "week" ? 52 : interval === "month" ? 12 : interval === "year" ? bars.length : 252;
    return streetTape(
      bars.map((b) => ({ high: b.high, low: b.low, close: b.close, date: b.date, volume: b.volume })),
      { lookback },
    );
  }, [bars, interval]);

  const maWord = interval === "week" ? "주" : interval === "month" ? "개월" : interval === "year" ? "년" : interval === "minute" ? "봉" : "일";
  const periodsPerYear = interval === "day" ? 252 : interval === "week" ? 52 : interval === "month" ? 12 : interval === "year" ? 1 : null;
  const pctWindow = interval === "week" ? 52 : interval === "month" ? 24 : interval === "year" ? 10 : 120;
  const analytics = useMemo(() => quantSnapshot(bars, periodsPerYear), [bars, periodsPerYear]);
  const bandCompare = useMemo(() => compareBollingerAndPercentile(bars.map((b) => b.close), 20, 2, pctWindow), [bars, pctWindow]);
  const divergences = useMemo(() => {
    if (bars.length < 30) return [];
    return detectRsiDivergences(
      bars.map((b) => b.high),
      bars.map((b) => b.low),
      bars.map((b) => b.close),
      { rsiPeriod: 14, left: 5, right: 5, maxAge: interval === "minute" ? 80 : 60 },
    );
  }, [bars, interval]);
  const macdCrosses = useMemo(() => detectMacdCrosses(bars.map((b) => b.close), { maxAge: interval === "minute" ? 80 : 40 }), [bars, interval]);

  // RSI divergence + MACD cross markers (toggle: 신호).
  const signalMarkers = useMemo<ChartMarkerInput[]>(() => {
    const out: ChartMarkerInput[] = [];
    for (const swing of divergences) {
      const bar = bars[swing.i2];
      if (!bar) continue;
      const bull = swing.kind.endsWith("bullish");
      out.push({ time: barTimeOf(bar.date, mk), position: bull ? "belowBar" : "aboveBar", color: bull ? "#2dd4bf" : "#fb7185", shape: bull ? "arrowUp" : "arrowDown", text: swing.kind.startsWith("hidden") ? (bull ? "히든↑" : "히든↓") : bull ? "RSI↑" : "RSI↓" });
    }
    for (const cross of macdCrosses) {
      const bar = bars[cross.index];
      if (!bar) continue;
      const golden = cross.kind === "golden";
      out.push({ time: barTimeOf(bar.date, mk), position: golden ? "belowBar" : "aboveBar", color: golden ? "#e5b84c" : "#94a3b8", shape: golden ? "arrowUp" : "arrowDown", text: golden ? "골든" : "데드" });
    }
    return out;
  }, [divergences, macdCrosses, bars, mk]);

  const disclosureMarkers = useMemo(
    () => (interval === "minute" ? [] : eventMarkers.map((e) => ({ time: e.time.slice(0, 10), title: e.title })).slice(-60)),
    [eventMarkers, interval],
  );

  const intervalKey = interval === "minute" ? `minute-${minuteSize}` : interval;
  const modeLabel = interval === "minute" ? (isUs ? "분봉 · Yahoo 지연 시세" : "분봉 · 비공식 경로(지연 가능)") : isUs ? "Yahoo 가격 조정 · 당일 봉 지연" : "일봉 이상 · 당일 봉은 지연·잠정";

  const controls = (
    <div className="flex flex-wrap items-center gap-1">
      <div className="flex flex-wrap gap-0.5 rounded-md bg-muted p-0.5" role="group" aria-label="봉 주기">
        {INTERVALS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setInterval(item.id);
              if (item.id === "minute") setRange(defaultMinuteRange(minuteSize));
              else if (item.id === "day") setRange(isUs ? "5y" : "2y");
              else if (item.id === "week") setRange("5y");
              else setRange("max");
            }}
            className={cn("min-h-8 rounded px-2 text-xs font-medium", interval === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {item.label}
          </button>
        ))}
      </div>
      {interval === "minute" && (
        <select value={minuteSize} onChange={(e) => { const s = Number(e.target.value) as MinuteSize; setMinuteSize(s); setRange(defaultMinuteRange(s)); }} className="h-8 rounded-md border border-border bg-background px-1 text-[11px]" aria-label="분봉 크기">
          {MINUTE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}분
            </option>
          ))}
        </select>
      )}
      <select value={range} onChange={(e) => setRange(e.target.value)} className="h-8 rounded-md border border-border bg-background px-1 text-[11px]" aria-label="기간">
        {(interval === "minute" ? minuteRangeOpts : RANGES).map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      {(isLoading || isFetching) && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
    </div>
  );

  return (
    <div className="desk-card desk-card-navy overflow-hidden">
      <ChartViewBar view={view} onChange={setView} />
      <div className={view === "price" ? "contents" : "hidden"} aria-hidden={view !== "price"}>
        <ProChart
          code={isUs ? code.toUpperCase() : code}
          market={mk}
          instrument={product}
          exchange={security.data?.exchange ?? market}
          currency={security.data?.currency ?? (isUs ? "USD" : "KRW")}
          quantityUnit={security.data?.quantityUnit ?? "주"}
          layoutScope={layoutScope}
          name={name}
          bars={bars}
          profileBars={profileBars}
          profileSource={profileSource}
          indicatorBars={indicatorBars}
          priceBasisNote={priceBasisNote}
          interval={interval}
          minuteSize={minuteSize}
          range={range}
          intervalKey={intervalKey}
          source={source}
          modeLabel={modeLabel}
          updatedAt={dataUpdatedAt || null}
          loading={isLoading}
          error={isError}
          events={data && "events" in data ? data.events : undefined}
          disclosureMarkers={disclosureMarkers}
          signalMarkers={signalMarkers}
          researchMarkers={researchMarkers}
          toolbarExtra={controls}
          height={isUs && product !== "etf" ? 460 : 800}
          onFullscreen={() => void navigate({ to: "/chart", search: { symbols: `${mk}:${isUs ? code.toUpperCase() : code}`, layout: "1", scope: layoutScope, interval, minuteSize, range } })}
          prePost={isUs && interval === "minute" ? { on: prePost, toggle: () => setPrePost((v) => !v) } : undefined}
          testId="trading-chart"
        />
        <StreetTapeRow tape={street} formatValue={isUs ? formatUsd : formatPrice} fastLabel={`50${maWord}`} slowLabel={`200${maWord}`} showVolume />
        <ChartAnalyticsStrip snap={analytics} />
        <BandCompareStrip compare={bandCompare} formatValue={px} />
        <RsiDivergenceStrip items={divergences} barCount={bars.length} formatValue={px} />
        <MacdCrossStrip items={macdCrosses} barCount={bars.length} />
        <div className="border-t border-border bg-muted/20 px-3 py-1 text-[10px] leading-relaxed text-muted-foreground">
          차트 OHLC: {isUs ? "Yahoo 조정계수 적용 · 미국 정규장(시간외 버튼으로 프리·애프터 포함) · 뉴욕 시각" : "Yahoo/네이버 비공식 경로"} · 체결 스트림과 마지막 봉이 어긋날 수 있음 · 실주문 전 HTS 재확인 · 그림·지표는 종목·주기별로 이 브라우저에 저장
          {interval === "minute" ? " · 분봉은 봉주기별 최대 기간 지원(1m≤7일, 5~30m≤60일, 60m≤2년)" : ""}
        </div>
      </div>
      {view !== "price" ? <ValuationHistoryChart code={code} mode={view} /> : null}
    </div>
  );
}
