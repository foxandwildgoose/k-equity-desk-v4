import { useEffect, useMemo, useRef, useState } from "react";
import type { FlowDay } from "@/server/naver-market";
import { usePriceColors, useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type MouseEventParams,
  type LogicalRange,
} from "lightweight-charts";
import { computeRangePosition } from "@/lib/chart-indicators";
import { ChartShell } from "@/components/charts/core/ChartShell";
import { useStandardSma } from "@/components/charts/core/use-standard-sma";
import { SmaControls } from "@/components/charts/core/SmaControls";
import { createProChart } from "@/components/charts/core/create-pro-chart";
import { readChartTheme } from "@/components/charts/core/theme";
import { exportChartPng, exportRowsCsv } from "@/components/charts/core/chrome";
import { RangePositionStrip } from "@/components/stocks/RangePositionStrip";
import {
  Users,
  Building2,
  Globe2,
  ZoomIn,
  Maximize2,
  Loader2,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";

type FlowKey = "foreign" | "institution" | "individual";
type ViewMode = "daily" | "cumulative";

const SERIES: {
  key: FlowKey;
  name: string;
  color: string;
  icon: typeof Globe2;
}[] = [
  { key: "foreign", name: "외국인", color: "#38bdf8", icon: Globe2 },
  { key: "institution", name: "기관", color: "#a78bfa", icon: Building2 },
  { key: "individual", name: "개인", color: "#fbbf24", icon: Users },
];

const WINDOWS = [
  { id: 5, label: "5일" },
  { id: 10, label: "10일" },
  { id: 20, label: "20일" },
  { id: 60, label: "60일" },
  { id: 120, label: "120일" },
  { id: 0, label: "전체" },
] as const;

/** Desk glossary — how pros read each flow statistic */
const STAT_GUIDE: {
  id: string;
  title: string;
  formula: string;
  meaning: string;
  howToUse: string;
  caution: string;
}[] = [
  {
    id: "net",
    title: "순매수 합",
    formula: "선택 구간 일별 순매수(주)의 합계",
    meaning:
      "그 기간 동안 해당 주체가 시장에서 순수하게 사들인(또는 판) 주식 수. 양수=순매수, 음수=순매도.",
    howToUse:
      "20·60일 순매수 합이 동시에 큰 양수면 추세적 매집 가능성. 외인+기관이 같이 양수면 스마트머니 매집으로 해석하는 경우가 많습니다.",
    caution:
      "단발성 블록딜·지수 리밸런싱·선물 베이시스 차익이 왜곡할 수 있어 공시·뉴스와 교차 확인하세요.",
  },
  {
    id: "avg",
    title: "일평균",
    formula: "순매수 합 ÷ 구간 거래일 수",
    meaning:
      "하루 평균 얼마나 사고팔았는지. 종목 유동성 대비 수급 강도를 가늠하는 스케일입니다.",
    howToUse:
      "일평균이 평소 거래량의 수 % 이상을 꾸준히 가져가면 가격 영향력이 커집니다. 구간을 바꿔 평균이 유지되는지 보세요.",
    caution: "거래대금·유통주식 대비 비율은 별도 확인이 필요합니다(절대 주수만으로는 부족).",
  },
  {
    id: "buyRatio",
    title: "매수일%",
    formula: "순매수>0인 날 수 ÷ (순매수≠0인 날) × 100",
    meaning:
      "방향의 일관성. 합계가 비슷해도 매수일%가 높으면 ‘꾸준한 매집’, 낮으면 ‘하루 몰아사기’에 가깝습니다.",
    howToUse:
      "매수일% 60%+ & 순매수 합 양수 → 분산 매집 패턴. 매수일% 낮고 합만 크면 이벤트성 수급 가능성.",
    caution: "휴장·이상치 하루가 비율을 흔들 수 있어 5일·20일을 함께 봅니다.",
  },
  {
    id: "max",
    title: "최대매수 / 최대매도",
    formula: "구간 내 일별 순매수 최댓값·최솟값",
    meaning:
      "한 번에 들어온 수급 충격의 크기. 급등·급락 당일 주체를 찾는 데 유용합니다.",
    howToUse:
      "최대매수일이 갭상승·실적일·정책 발표일과 겹치면 이벤트 매수. 최대매도일이 악재·만기일과 겹치면 일회성 매도 여부 판단.",
    caution: "단일 지표로 추세를 단정하지 마세요. 전후 며칠 흐름을 보세요.",
  },
  {
    id: "streak",
    title: "연속 (스트릭)",
    formula: "가장 최근 거래일부터 같은 방향(매수/매도)이 이어진 일수",
    meaning:
      "지금 이 순간 수급 모멘텀. 3일 이상 연속 순매수는 단기 수급 추세로 자주 인용됩니다.",
    howToUse:
      "외인 3일+ 연속 매수 + 가격 상승 = 추세 동조. 가격은 오르는데 연속 매도 = 상승 중 매도(디스트리뷰션) 경계.",
    caution: "연속이 길수록 되돌림 가능성도 커집니다. 과열 구간에서는 역추세 함정에 주의.",
  },
  {
    id: "corr",
    title: "익일수익 상관",
    formula:
      "당일 순매수 vs 다음 날 종가 수익률의 피어슨 상관계수 (−1~+1)",
    meaning:
      "이 구간에 한해, 그 주체가 산 다음 날 주가가 같은 방향으로 움직인 경향. +면 동조, −면 역행.",
    howToUse:
      "|상관| 0.25 이상이면 구간 내 통계적 연관이 눈에 띕니다. 외인 상관이 꾸준히 양수면 ‘외인 따라가기’ 전략의 참고 신호가 될 수 있습니다.",
    caution:
      "상관≠인과. 표본이 짧거나 변동성이 크면 불안정합니다. 미래 수익을 보장하지 않으며 투자 권유가 아닙니다.",
  },
  {
    id: "smart",
    title: "스마트머니 (외인+기관)",
    formula: "외국인 순매수 + 기관 순매수",
    meaning:
      "개인을 제외한 상대적 ‘정보·규모 우위’ 수급으로 시장에서 자주 묶는 지표. 금색 라인으로 표시됩니다.",
    howToUse:
      "누적 모드에서 스마트머니가 우상향인데 가격이 횡보하면 매집 구간 후보. 가격 급등 후 스마트머니 누적 꺾이면 차익 실현 가능성.",
    caution:
      "기관 안에는 투신·연기금·사모 등 성격이 다른 주체가 섞여 있습니다. ‘전부 스마트’는 아닙니다.",
  },
  {
    id: "modes",
    title: "일별 vs 누적 보기",
    formula: "일별=그날 순매수 막대 / 누적=구간 시작부터 합산 곡선",
    meaning:
      "일별은 충격·이벤트, 누적은 중기 매집·매도 궤적을 보는 데 적합합니다.",
    howToUse:
      "스윙: 누적 60일 + 종가 오버레이. 단타: 일별 5~10일 + 연속 스트릭. 가격선(왼쪽 축)과 수급(오른쪽 축)을 같이 보세요.",
    caution: "누적 곡선은 시작점(구간의 왼쪽 끝)에 따라 모양이 달라집니다. 기간 버튼을 바꿔 민감도를 확인하세요.",
  },
  {
    id: "insight",
    title: "자동 시사점",
    formula: "규칙 기반 패턴 매칭 (동반매수·디커플링·개인홀로매수·연속·상관)",
    meaning:
      "선택 구간 통계를 읽어 데스크가 자주 쓰는 해석을 한 줄로 요약합니다.",
    howToUse:
      "시사점은 ‘가설’입니다. 차트 지지/저항·공시·미국 연계 뉴스와 맞춰 채택/기각하세요.",
    caution: "자동 문구만으로 매매하지 마세요. 백테스트·포지션 관리가 없는 휴리스틱입니다.",
  },
];

function formatSharesShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(0)}만`;
  return `${sign}${new Intl.NumberFormat("ko-KR").format(abs)}`;
}

function formatShares(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  return `${sign}${new Intl.NumberFormat("ko-KR").format(n)}주`;
}

function toTime(date: string): Time {
  return date.slice(0, 10) as Time;
}

function sumKeys(days: FlowDay[], key: FlowKey) {
  return days.reduce((s, d) => s + d[key], 0);
}

function statsFor(days: FlowDay[], key: FlowKey) {
  if (!days.length) {
    return {
      net: 0,
      avg: 0,
      buyDays: 0,
      sellDays: 0,
      buyRatio: 0,
      maxBuy: 0,
      maxSell: 0,
      streak: 0,
      streakDir: 0 as -1 | 0 | 1,
    };
  }
  const vals = days.map((d) => d[key]);
  const net = vals.reduce((a, b) => a + b, 0);
  const avg = net / vals.length;
  const buyDays = vals.filter((v) => v > 0).length;
  const sellDays = vals.filter((v) => v < 0).length;
  const maxBuy = Math.max(0, ...vals);
  const maxSell = Math.min(0, ...vals);
  // trailing streak from end
  let streak = 0;
  let streakDir: -1 | 0 | 1 = 0;
  const last = vals[vals.length - 1]!;
  if (last > 0) streakDir = 1;
  else if (last < 0) streakDir = -1;
  if (streakDir !== 0) {
    for (let i = vals.length - 1; i >= 0; i--) {
      if (streakDir === 1 && vals[i]! > 0) streak++;
      else if (streakDir === -1 && vals[i]! < 0) streak++;
      else break;
    }
  }
  return {
    net,
    avg,
    buyDays,
    sellDays,
    buyRatio: buyDays + sellDays ? (buyDays / (buyDays + sellDays)) * 100 : 0,
    maxBuy,
    maxSell,
    streak,
    streakDir,
  };
}

/** Pearson correlation between flow and next-day return */
function corrFlowPrice(days: FlowDay[], key: FlowKey): number | null {
  if (days.length < 8) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < days.length - 1; i++) {
    const a = days[i]!;
    const b = days[i + 1]!;
    if (!a.close || !b.close) continue;
    xs.push(a[key]);
    ys.push((b.close - a.close) / a.close);
  }
  if (xs.length < 6) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const ax = xs[i]! - mx;
    const ay = ys[i]! - my;
    num += ax * ay;
    dx += ax * ax;
    dy += ay * ay;
  }
  const den = Math.sqrt(dx * dy);
  if (!den) return null;
  return num / den;
}

export function InvestorFlow({
  code,
  days,
  source,
  loading,
}: {
  code?: string;
  days: FlowDay[];
  source?: string;
  loading?: boolean;
}) {
  const [windowN, setWindowN] = useState<number>(60);
  const [mode, setMode] = useState<ViewMode>("daily");
  const [visible, setVisible] = useState<Record<FlowKey, boolean>>({
    foreign: true,
    institution: true,
    individual: true,
  });
  const [showPrice, setShowPrice] = useState(true);
  const [hover, setHover] = useState<FlowDay | null>(null);
  const [chartH, setChartH] = useState(320);
  const [showGuide, setShowGuide] = useState(false);
  const hasFlowData = days.length > 0;
  const colors = usePriceColors();
  const convention = useAppStore((s) => s.colorConvention);
  const upColor = convention === "korea" ? "#ef4444" : "#22c55e";
  const downColor = convention === "korea" ? "#3b82f6" : "#ef4444";

  const slice = useMemo(() => {
    if (!windowN) return days;
    return days.slice(-windowN);
  }, [days, windowN]);

  const last = days[days.length - 1];
  const display = hover ?? last;

  const rangeStats = useMemo(() => {
    const bars = slice
      .filter((d) => d.close > 0)
      .map((d) => ({
        high: d.close,
        low: d.close,
        close: d.close,
        date: d.date,
      }));
    return computeRangePosition(bars);
  }, [slice]);

  const smartMoney = useMemo(
    () =>
      slice.map((d) => ({
        ...d,
        smart: d.foreign + d.institution,
      })),
    [slice],
  );

  const stats = useMemo(() => {
    return {
      foreign: statsFor(slice, "foreign"),
      institution: statsFor(slice, "institution"),
      individual: statsFor(slice, "individual"),
      smartNet: sumKeys(slice, "foreign") + sumKeys(slice, "institution"),
      corrF: corrFlowPrice(slice, "foreign"),
      corrI: corrFlowPrice(slice, "institution"),
      corrP: corrFlowPrice(slice, "individual"),
    };
  }, [slice]);

  const insight = useMemo(() => {
    if (slice.length < 5) return "데이터 부족 — 기간을 늘려 보세요.";
    const f = stats.foreign;
    const i = stats.institution;
    const p = stats.individual;
    const parts: string[] = [];
    if (f.net > 0 && i.net > 0)
      parts.push("스마트머니(외인+기관) 동반 순매수 구간");
    else if (f.net < 0 && i.net < 0)
      parts.push("스마트머니 동반 순매도 — 수급 약세 경계");
    else if (f.net > 0 && i.net < 0)
      parts.push("외인 매수 vs 기관 매도 — 수급 디커플링");
    else if (f.net < 0 && i.net > 0)
      parts.push("기관 매수 vs 외인 매도 — 수급 디커플링");
    if (p.net > 0 && f.net < 0 && i.net < 0)
      parts.push("개인 홀로 매수(반대매매 패턴 주의)");
    if (f.streak >= 3 && f.streakDir === 1)
      parts.push(`외인 ${f.streak}일 연속 순매수`);
    if (f.streak >= 3 && f.streakDir === -1)
      parts.push(`외인 ${f.streak}일 연속 순매도`);
    if (stats.corrF != null && Math.abs(stats.corrF) > 0.25)
      parts.push(
        `외인 수급↔익일 수익률 상관 ${stats.corrF >= 0 ? "+" : ""}${stats.corrF.toFixed(2)}`,
      );
    if (!parts.length) parts.push("뚜렷한 편향 없음 — 추세·가격과 교차 확인");
    return parts.join(" · ");
  }, [slice, stats]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const histRefs = useRef<Partial<Record<FlowKey, ISeriesApi<"Histogram">>>>(
    {},
  );
  const lineRefs = useRef<Partial<Record<FlowKey, ISeriesApi<"Line">>>>({});
  const priceRef = useRef<ISeriesApi<"Line"> | null>(null);
  const smartRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [smaFocus, setSmaFocus] = useState<FlowKey | "smart" | "price">("smart");
  const smaData = useMemo(() => {
    const start = slice[0]?.date;
    let cumulative = 0;
    const points = days.map(d => {
      const value = smaFocus === "price" ? d.close > 0 ? d.close : null : smaFocus === "smart" ? d.foreign + d.institution : d[smaFocus];
      // Existing cumulative flows are anchored at the chosen range. Extend that
      // same definition backwards from zero; no silent change to source lines.
      return { time: d.date.slice(0, 10), value };
    });
    if (smaFocus !== "price" && mode === "cumulative") {
      const before = points.filter(p => start && p.time < start.slice(0, 10)).reduce((sum, p) => sum + (p.value ?? 0), 0);
      cumulative = -before;
      for (const point of points) { cumulative += point.value ?? 0; point.value = cumulative; }
    }
    return { history: points, points: points.filter(p => start && p.time >= start.slice(0, 10)) };
  }, [days, slice, smaFocus, mode]);
  const averages = useStandardSma({ chart: chartApi,
    source: smaFocus === "price" ? priceRef.current : smaFocus === "smart" ? smartRef.current : mode === "daily" ? histRefs.current[smaFocus] ?? null : lineRefs.current[smaFocus] ?? null,
    points: smaData.points, history: smaData.history, scope: `investor-flow:${code ?? "unknown"}:${mode}:${smaFocus}`,
    scaleId: smaFocus === "price" ? "left" : "right", formatValue: n => n.toLocaleString("ko-KR", { maximumFractionDigits: 0 }),
    available: smaFocus === "price" ? showPrice : smaFocus === "smart" || visible[smaFocus] });

  // chart init
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const chart = createProChart(el, readChartTheme(), "KR");
    chart.applyOptions({
      localization: { locale: "ko-KR", priceFormatter: (v: number) => Math.round(v).toLocaleString("ko-KR") },
      rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.15 } },
      leftPriceScale: { visible: true, borderColor: "rgba(148,163,184,0.15)", scaleMargins: { top: 0.1, bottom: 0.15 } },
      timeScale: { rightOffset: 4, barSpacing: 10, minBarSpacing: 3, timeVisible: false },
    });

    for (const s of SERIES) {
      histRefs.current[s.key] = chart.addSeries(HistogramSeries, {
        color: s.color,
        priceFormat: { type: "volume" },
        priceScaleId: "right",
        lastValueVisible: true,
        priceLineVisible: false,
      });
      lineRefs.current[s.key] = chart.addSeries(LineSeries, {
        color: s.color,
        lineWidth: 2,
        priceScaleId: "right",
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });
    }

    smartRef.current = chart.addSeries(LineSeries, {
      color: "#e5b84c",
      lineWidth: 2,
      priceScaleId: "right",
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    priceRef.current = chart.addSeries(LineSeries, {
      color: "#94a3b8",
      lineWidth: 1,
      priceScaleId: "left",
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    chartRef.current = chart;

    const onCross = (param: MouseEventParams<Time>) => {
      if (!param.time) {
        setHover(null);
        return;
      }
      const d = days.find((x) => x.date === String(param.time));
      setHover(d ?? null);
    };
    chart.subscribeCrosshairMove(onCross);
    setChartApi(chart);

    return () => {
      setChartApi(null);
      queueMicrotask(() => chart.remove());
      chartRef.current = null;
      histRefs.current = {};
      lineRefs.current = {};
      smartRef.current = null;
      priceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFlowData, code]);

  // data push
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    for (const s of SERIES) {
      const hist = histRefs.current[s.key];
      const line = lineRefs.current[s.key];
      if (!hist || !line) continue;
      if (!visible[s.key]) {
        hist.setData([]);
        line.setData([]);
        continue;
      }
      if (mode === "daily") {
        hist.setData(
          slice.map((d) => ({
            time: toTime(d.date),
            value: d[s.key],
            color:
              d[s.key] >= 0 ? s.color + "cc" : s.color + "66",
          })),
        );
        line.setData([]);
      } else {
        hist.setData([]);
        let cum = 0;
        line.setData(
          slice.map((d) => {
            cum += d[s.key];
            return { time: toTime(d.date), value: cum };
          }),
        );
      }
    }

    // smart money cumulative always as gold line in cumulative mode; daily as thin
    if (smartRef.current) {
      if (mode === "cumulative") {
        let cum = 0;
        smartRef.current.setData(
          smartMoney.map((d) => {
            cum += d.smart;
            return { time: toTime(d.date), value: cum };
          }),
        );
        smartRef.current.applyOptions({ visible: true });
      } else {
        smartRef.current.setData(
          smartMoney.map((d) => ({
            time: toTime(d.date),
            value: d.smart,
          })),
        );
      }
    }

    if (priceRef.current) {
      if (showPrice) {
        priceRef.current.setData(
          slice
            .filter((d) => d.close > 0)
            .map((d) => ({ time: toTime(d.date), value: d.close })),
        );
      } else {
        priceRef.current.setData([]);
      }
    }

    chart.timeScale().fitContent();
  }, [slice, mode, visible, showPrice, smartMoney]);

  const fit = () => chartRef.current?.timeScale().fitContent();
  const zoomIn = () => {
    const ts = chartRef.current?.timeScale();
    const r = ts?.getVisibleLogicalRange();
    if (!ts || !r) return;
    const mid = (r.from + r.to) / 2;
    const half = (r.to - r.from) / 2 / 1.35;
    ts.setVisibleLogicalRange({ from: mid - half, to: mid + half } as LogicalRange);
  };
  const zoomOut = () => {
    const ts = chartRef.current?.timeScale();
    const r = ts?.getVisibleLogicalRange();
    if (!ts || !r) return;
    const mid = (r.from + r.to) / 2;
    const half = ((r.to - r.from) / 2) * 1.35;
    ts.setVisibleLogicalRange({ from: mid - half, to: mid + half } as LogicalRange);
  };

  // height drag
  const dragH = useRef<{ y: number; h: number } | null>(null);
  const onHeightDown = (e: React.MouseEvent) => {
    dragH.current = { y: e.clientY, h: chartH };
    const move = (ev: MouseEvent) => {
      if (!dragH.current) return;
      setChartH(
        Math.min(640, Math.max(240, dragH.current.h + (ev.clientY - dragH.current.y))),
      );
    };
    const up = () => {
      dragH.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <section className="desk-card desk-card-teal overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 md:px-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight flex items-center gap-1.5">
            <BarChart3 className="size-4 text-desk-teal" />
            투자자 수급
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            개인·기관·외국인 순매수(주) · 휠 줌·드래그 이동 · 출처{" "}
            {source || "네이버 증권"} · {days.length}거래일
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
            {(
              [
                ["daily", "일별"],
                ["cumulative", "누적"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium min-h-8",
                  mode === id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-0.5 rounded-md bg-muted p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWindowN(w.id)}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium min-h-8",
                  windowN === w.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={zoomIn}
            className="rounded bg-muted px-2 py-1 min-h-8"
            title="확대"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={zoomOut}
            className="rounded bg-muted px-2 py-1 min-h-8"
            title="축소"
          >
            <ZoomIn className="size-3.5 rotate-180" />
          </button>
          <button
            type="button"
            onClick={fit}
            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs min-h-8"
          >
            <Maximize2 className="size-3.5" /> Fit
          </button>
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs min-h-8 font-medium",
              showGuide
                ? "bg-desk-teal/20 text-desk-teal ring-1 ring-desk-teal/40"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <BookOpen className="size-3.5" />
            통계 설명
            {showGuide ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {loading && days.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin inline mr-2" />
          수급 불러오는 중…
        </div>
      ) : days.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          수급 데이터 없음
        </div>
      ) : (
        <>
          {/* Today / hover strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border-b border-border">
            {SERIES.map((s) => {
              const v = display?.[s.key] ?? 0;
              const Icon = s.icon;
              return (
                <div
                  key={s.key}
                  className="rounded-lg border border-border bg-card/60 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Icon className="size-3" style={{ color: s.color }} />
                      {s.name}
                    </span>
                    <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={visible[s.key]}
                        onChange={() =>
                          setVisible((v0) => ({
                            ...v0,
                            [s.key]: !v0[s.key],
                          }))
                        }
                      />
                      표시
                    </label>
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 text-sm font-semibold tabular",
                      v > 0
                        ? colors.up
                        : v < 0
                          ? colors.down
                          : "text-muted-foreground",
                    )}
                  >
                    {formatSharesShort(v)}
                  </div>
                </div>
              );
            })}
            <div className="rounded-lg border border-border bg-card/60 px-3 py-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>종가 · 스마트머니</span>
                <label className="flex items-center gap-1 text-[10px]">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={() => setShowPrice((v) => !v)}
                  />
                  가격
                </label>
              </div>
              <div className="mt-0.5 text-sm font-semibold tabular">
                {display?.close
                  ? display.close.toLocaleString("ko-KR")
                  : "—"}
              </div>
              <div
                className={cn(
                  "text-xs tabular font-medium",
                  stats.smartNet > 0
                    ? colors.up
                    : stats.smartNet < 0
                      ? colors.down
                      : "text-muted-foreground",
                )}
              >
                구간 스마머니 {formatSharesShort(stats.smartNet)}
              </div>
            </div>
          </div>

          <RangePositionStrip
            stats={rangeStats}
            compact
            caption="선택 구간 종가 기준 · 기간 고/저는 절대 최고·최저, 최근 고/저는 확인된 스윙."
          />

          {/* Interactive chart (F7.16: shared chart core + chrome) */}
          <ChartShell
            title={mode === "daily" ? "주체별 일별 순매수 (주)" : "주체별 누적 순매수 (주)"}
            displayControls={<><label className="flex min-h-11 items-center gap-1 text-xs">SMA 대상<select aria-label="SMA 대상 시계열" value={smaFocus} onChange={event => setSmaFocus(event.target.value as typeof smaFocus)} className="h-9 rounded border border-border bg-background px-1"><option value="smart">스마트머니</option><option value="foreign">외국인</option><option value="institution">기관</option><option value="individual">개인</option><option value="price">종가 (좌)</option></select></label><SmaControls instances={averages.instances} unavailable={averages.unavailable} mode={averages.mode} onToggle={averages.toggle} disabled={!averages.ready} /></>}
            status={days.length ? { source: source || "네이버 증권", mode: `${slice.length}거래일 · 수량(주) · 좌축 종가`, asOfLabel: last?.date ? `${last.date.slice(0, 10)} (일별 집계)` : null } : null}
            onExportPng={days.length ? () => exportChartPng(chartApi, "KR", "FLOW", `investor-flow-${mode}`) : undefined}
            onExportCsv={
              days.length
                ? () =>
                    exportRowsCsv(
                      chartApi,
                      slice.map((d) => ({ ...d, time: d.date.slice(0, 10) })),
                      [
                        { name: "foreign", get: (r) => r.foreign },
                        { name: "institution", get: (r) => r.institution },
                        { name: "individual", get: (r) => r.individual },
                        { name: "close", get: (r) => r.close },
                      ],
                      "KR",
                      "FLOW",
                      `investor-flow-${mode}`,
                    )
                : undefined
            }
            height={chartH}
            testId="investor-flow-chart"
          >
            <div ref={wrapRef} className="absolute inset-0" />
          </ChartShell>
          <div
            role="separator"
            onMouseDown={onHeightDown}
            className="flex h-3 cursor-ns-resize items-center justify-center border-y border-border bg-muted/30 hover:bg-desk-teal/20"
          >
            <div className="h-0.5 w-10 rounded bg-border" />
          </div>

          {/* Stats desk */}
          <div className="p-3 md:p-4 space-y-3">
            <div className="rounded-lg border border-desk-gold/30 bg-desk-gold/5 px-3 py-2.5 text-sm leading-relaxed">
              <span className="font-semibold text-desk-gold">시사점 · </span>
              {insight}
              <span className="text-muted-foreground">
                {" "}
                (선택 구간 {slice.length}거래일
                {display ? ` · 커서 ${display.date}` : ""})
              </span>
            </div>

            <div className="overflow-x-auto scroll-thin rounded-lg border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">주체</th>
                    <th
                      className="px-3 py-2 text-right font-medium"
                      title="선택 구간 일별 순매수 합계"
                    >
                      순매수 합
                    </th>
                    <th
                      className="px-3 py-2 text-right font-medium"
                      title="순매수 합 ÷ 거래일 수"
                    >
                      일평균
                    </th>
                    <th
                      className="px-3 py-2 text-right font-medium"
                      title="순매수 날 비율 — 매집 일관성"
                    >
                      매수일%
                    </th>
                    <th
                      className="px-3 py-2 text-right font-medium"
                      title="구간 내 하루 최대 순매수"
                    >
                      최대매수
                    </th>
                    <th
                      className="px-3 py-2 text-right font-medium"
                      title="구간 내 하루 최대 순매도"
                    >
                      최대매도
                    </th>
                    <th
                      className="px-3 py-2 text-right font-medium"
                      title="최근 같은 방향 연속 일수"
                    >
                      연속
                    </th>
                    <th
                      className="px-3 py-2 text-right font-medium"
                      title="당일 순매수 vs 익일 수익률 피어슨 상관 (인과 아님)"
                    >
                      익일수익 상관
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {SERIES.map((s) => {
                    const st = stats[s.key];
                    const corr =
                      s.key === "foreign"
                        ? stats.corrF
                        : s.key === "institution"
                          ? stats.corrI
                          : stats.corrP;
                    return (
                      <tr key={s.key}>
                        <td className="px-3 py-2 font-medium" style={{ color: s.color }}>
                          {s.name}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right tabular font-semibold",
                            st.net > 0
                              ? colors.up
                              : st.net < 0
                                ? colors.down
                                : "text-muted-foreground",
                          )}
                        >
                          {formatSharesShort(st.net)}
                        </td>
                        <td className="px-3 py-2 text-right tabular text-muted-foreground">
                          {formatSharesShort(Math.round(st.avg))}
                        </td>
                        <td className="px-3 py-2 text-right tabular">
                          {st.buyRatio.toFixed(0)}%
                          <span className="text-muted-foreground text-xs">
                            {" "}
                            ({st.buyDays}/{st.buyDays + st.sellDays})
                          </span>
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right tabular",
                            colors.up,
                          )}
                        >
                          {formatSharesShort(st.maxBuy)}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right tabular",
                            colors.down,
                          )}
                        >
                          {formatSharesShort(st.maxSell)}
                        </td>
                        <td className="px-3 py-2 text-right tabular">
                          {st.streak > 0
                            ? `${st.streak}일 ${st.streakDir > 0 ? "매수" : "매도"}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular text-muted-foreground">
                          {corr == null
                            ? "—"
                            : `${corr >= 0 ? "+" : ""}${corr.toFixed(2)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto scroll-thin rounded-lg border border-border max-h-56">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-muted/40 sticky top-0 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">일자</th>
                    <th className="px-3 py-2 text-right">외국인</th>
                    <th className="px-3 py-2 text-right">기관</th>
                    <th className="px-3 py-2 text-right">개인</th>
                    <th className="px-3 py-2 text-right">종가</th>
                  </tr>
                </thead>
                <tbody>
                  {[...slice].reverse().map((row) => (
                    <tr
                      key={row.date}
                      className="border-t border-border/50 hover:bg-muted/20"
                    >
                      <td className="px-3 py-1.5 text-xs tabular text-muted-foreground">
                        {row.date}
                      </td>
                      {(["foreign", "institution", "individual"] as const).map(
                        (k) => (
                          <td
                            key={k}
                            className={cn(
                              "px-3 py-1.5 text-right tabular text-xs font-medium",
                              row[k] > 0
                                ? colors.up
                                : row[k] < 0
                                  ? colors.down
                                  : "text-muted-foreground",
                            )}
                          >
                            {formatSharesShort(row[k])}
                          </td>
                        ),
                      )}
                      <td className="px-3 py-1.5 text-right tabular text-xs">
                        {row.close ? row.close.toLocaleString("ko-KR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Column legend chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                ["순매수 합", "구간 순매수 총량"],
                ["일평균", "하루 평균 강도"],
                ["매수일%", "방향 일관성"],
                ["연속", "최근 모멘텀"],
                ["익일상관", "다음날 수익 연관(≠인과)"],
              ].map(([k, v]) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  <Info className="size-3 text-desk-teal" />
                  <b className="text-foreground font-medium">{k}</b>
                  {v}
                </span>
              ))}
            </div>

            {showGuide && (
              <div className="rounded-xl border border-border bg-card/80 p-4 md:p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <BookOpen className="size-4 text-desk-teal" />
                      수급 통계 상세 가이드
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-3xl">
                      Wall Street·국내 기관 데스크에서 수급을 읽을 때 쓰는 해석
                      프레임입니다. 모든 수치는{" "}
                      <b className="text-foreground">위에서 고른 기간 버튼</b>
                      구간에만 계산됩니다. 투자 권유가 아닌 분석 도구 설명입니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGuide(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    접기
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {STAT_GUIDE.map((g) => (
                    <article
                      key={g.id}
                      className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2"
                    >
                      <h4 className="text-[15px] font-semibold tracking-tight">
                        {g.title}
                      </h4>
                      <p className="text-xs text-desk-teal font-medium leading-snug">
                        계산 · {g.formula}
                      </p>
                      <div className="text-sm leading-relaxed space-y-1.5">
                        <p>
                          <span className="text-muted-foreground">의미 · </span>
                          {g.meaning}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">
                            실전 활용 ·{" "}
                          </span>
                          {g.howToUse}
                        </p>
                        <p className="text-desk-rose/90 text-[13px]">
                          <span className="font-medium">주의 · </span>
                          {g.caution}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="rounded-lg border border-desk-gold/25 bg-desk-gold/5 p-3.5 text-sm leading-relaxed">
                  <p className="font-semibold text-desk-gold mb-1.5">
                    추천 읽기 순서 (실전)
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-foreground/95">
                    <li>
                      기간을 <b>20일·60일</b>로 놓고 누적 모드에서 스마트머니
                      방향 확인
                    </li>
                    <li>
                      일별 모드로 전환해 <b>연속 스트릭</b>과 최근 충격(최대매수·매도)
                      확인
                    </li>
                    <li>
                      표에서 <b>매수일%</b>로 매집이 꾸준한지, 이벤트성인지 구분
                    </li>
                    <li>
                      <b>익일상관</b>은 참고만 — 차트 지지/저항·공시와 반드시 교차
                    </li>
                    <li>
                      시사점 한 줄을 가설로 두고, 맞으면 유지·틀리면 기간을 바꿔
                      재검증
                    </li>
                  </ol>
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              스마트머니 = 외국인+기관. 상관은 당일 순매수와{" "}
              <b>익일</b> 종가 수익률의 피어슨 계수(참고용, 인과 아님). 휠=줌,
              드래그=이동, 축 드래그=스케일. 가격선은 왼쪽 축. 상세는{" "}
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                className="text-primary hover:underline"
              >
                통계 설명
              </button>
              을 펼치세요.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
