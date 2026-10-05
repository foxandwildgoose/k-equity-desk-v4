/**
 * Indicator catalog (F7.6): searchable definitions with editable params and
 * pure compute functions over bar arrays. Rendering lives in the chart
 * component; this module only says what to draw and computes the values.
 */
import {
  adx,
  anchoredVwap,
  atr,
  bollinger,
  cci,
  donchian,
  ema,
  highLowN,
  hma,
  ichimoku,
  keltner,
  macd,
  mfi,
  obv,
  parabolicSar,
  rollingPercentileBands,
  rsi,
  sma,
  stochastic,
  stochRsi,
  supertrend,
  vwap,
  williamsR,
  wma,
} from "../chart-indicators.ts";
import { isStandardSmaPeriod, STANDARD_SMA_PERIODS, standardSmaInstance } from "./standard-sma.ts";

export type Series = (number | null)[];

export interface CatalogBars {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  /** Session keys (YYYY-MM-DD) for intraday VWAP resets; absent for daily+. */
  sessionKeys?: string[];
}

export interface IndicatorParam {
  key: string;
  label: string;
  type: "int" | "float" | "select";
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

export interface IndicatorOutput {
  key: string;
  label: string;
  style: "line" | "histogram" | "dots";
  /** Horizontal guide levels for oscillators. */
  levels?: number[];
}

export type IndicatorRender = "series" | "volume-profile" | "pivots";

export interface IndicatorDef {
  id: string;
  label: string;
  group: "이동평균" | "밴드·채널" | "추세·스탑" | "VWAP" | "거래량" | "오실레이터" | "변동성" | "레벨";
  pane: "overlay" | "separate";
  render: IndicatorRender;
  params: IndicatorParam[];
  outputs: IndicatorOutput[];
  /** Needs an anchor click (Anchored VWAP). */
  anchored?: boolean;
  keywords?: string;
  compute: (b: CatalogBars, p: Record<string, number | string>, ctx: { anchorIndex?: number | null }) => Record<string, Series>;
}

export interface IndicatorInstance {
  uid: string;
  id: string;
  params: Record<string, number | string>;
  visible: boolean;
  color?: string;
  /** Standard SMA defaults resolve live from theme; color is an explicit override. */
  colorMode?: "theme" | "custom";
  /** Anchored VWAP anchor bar time. */
  anchorTime?: string | number | null;
}

const int = (key: string, label: string, d: number, min = 1, max = 500): IndicatorParam => ({ key, label, type: "int", default: d, min, max, step: 1 });
const flt = (key: string, label: string, d: number, min = 0.001, max = 100, step = 0.1): IndicatorParam => ({ key, label, type: "float", default: d, min, max, step });
const n = (p: Record<string, number | string>, k: string) => Number(p[k]);
const line = (key: string, label: string, levels?: number[]): IndicatorOutput => ({ key, label, style: "line", levels });

export const INDICATORS: IndicatorDef[] = [
  { id: "sma", label: "SMA 단순이동평균", group: "이동평균", pane: "overlay", render: "series", params: [int("period", "기간", 20)], outputs: [line("v", "SMA")], keywords: "ma moving average 이평", compute: (b, p) => ({ v: sma(b.close, n(p, "period")) }) },
  { id: "ema", label: "EMA 지수이동평균", group: "이동평균", pane: "overlay", render: "series", params: [int("period", "기간", 20)], outputs: [line("v", "EMA")], keywords: "ma exponential", compute: (b, p) => ({ v: ema(b.close, n(p, "period")) }) },
  { id: "wma", label: "WMA 가중이동평균", group: "이동평균", pane: "overlay", render: "series", params: [int("period", "기간", 20)], outputs: [line("v", "WMA")], keywords: "ma weighted", compute: (b, p) => ({ v: wma(b.close, n(p, "period")) }) },
  { id: "hma", label: "HMA 헐 이동평균", group: "이동평균", pane: "overlay", render: "series", params: [int("period", "기간", 20, 2)], outputs: [line("v", "HMA")], keywords: "ma hull", compute: (b, p) => ({ v: hma(b.close, n(p, "period")) }) },
  {
    id: "bb",
    label: "볼린저 밴드",
    group: "밴드·채널",
    pane: "overlay",
    render: "series",
    params: [int("period", "기간", 20, 2), flt("mult", "배수", 2)],
    outputs: [line("upper", "상단"), line("mid", "중심"), line("lower", "하단")],
    keywords: "bollinger bands",
    compute: (b, p) => bollinger(b.close, n(p, "period"), n(p, "mult")),
  },
  {
    id: "keltner",
    label: "켈트너 채널",
    group: "밴드·채널",
    pane: "overlay",
    render: "series",
    params: [int("ema", "EMA", 20), int("atr", "ATR", 10), flt("mult", "배수", 2)],
    outputs: [line("upper", "상단"), line("mid", "중심"), line("lower", "하단")],
    keywords: "keltner channel",
    compute: (b, p) => keltner(b.high, b.low, b.close, n(p, "ema"), n(p, "atr"), n(p, "mult")),
  },
  { id: "donchian", label: "돈치안 채널", group: "밴드·채널", pane: "overlay", render: "series", params: [int("period", "기간", 20)], outputs: [line("upper", "상단"), line("mid", "중심"), line("lower", "하단")], keywords: "donchian channel", compute: (b, p) => donchian(b.high, b.low, n(p, "period")) },
  {
    id: "ichimoku",
    label: "일목균형표",
    group: "밴드·채널",
    pane: "overlay",
    render: "series",
    params: [int("tenkan", "전환선", 9), int("kijun", "기준선", 26), int("spanB", "선행스팬B", 52), int("disp", "이동", 26)],
    outputs: [line("tenkan", "전환선"), line("kijun", "기준선"), line("spanA", "선행A"), line("spanB", "선행B"), line("chikou", "후행")],
    keywords: "ichimoku cloud 일목",
    compute: (b, p) => ichimoku(b.high, b.low, b.close, n(p, "tenkan"), n(p, "kijun"), n(p, "spanB"), n(p, "disp")),
  },
  {
    id: "psar",
    label: "파라볼릭 SAR",
    group: "추세·스탑",
    pane: "overlay",
    render: "series",
    params: [flt("step", "가속", 0.02, 0.001, 1, 0.01), flt("max", "최대", 0.2, 0.01, 1, 0.01)],
    outputs: [{ key: "v", label: "SAR", style: "dots" }],
    keywords: "parabolic sar stop",
    compute: (b, p) => ({ v: parabolicSar(b.high, b.low, n(p, "step"), n(p, "max")) }),
  },
  {
    id: "supertrend",
    label: "슈퍼트렌드",
    group: "추세·스탑",
    pane: "overlay",
    render: "series",
    params: [int("period", "ATR 기간", 10), flt("mult", "배수", 3)],
    outputs: [line("up", "상승"), line("down", "하락")],
    keywords: "supertrend",
    compute: (b, p) => {
      const st = supertrend(b.high, b.low, b.close, n(p, "period"), n(p, "mult"));
      return { up: st.value.map((v, i) => (st.direction[i] === 1 ? v : null)), down: st.value.map((v, i) => (st.direction[i] === -1 ? v : null)) };
    },
  },
  { id: "vwap", label: "VWAP (세션)", group: "VWAP", pane: "overlay", render: "series", params: [], outputs: [line("v", "VWAP")], keywords: "vwap volume weighted", compute: (b) => ({ v: vwap(b.high, b.low, b.close, b.volume, b.sessionKeys) }) },
  {
    id: "avwap",
    label: "앵커드 VWAP (클릭해 기준봉 지정)",
    group: "VWAP",
    pane: "overlay",
    render: "series",
    params: [],
    outputs: [line("v", "AVWAP")],
    anchored: true,
    keywords: "anchored vwap",
    compute: (b, _p, ctx) => ({ v: ctx.anchorIndex == null ? b.close.map(() => null) : anchoredVwap(b.high, b.low, b.close, b.volume, ctx.anchorIndex) }),
  },
  { id: "volume", label: "거래량 (+이동평균)", group: "거래량", pane: "separate", render: "series", params: [int("ma", "이동평균", 20)], outputs: [{ key: "v", label: "거래량", style: "histogram" }, line("ma", "MA")], keywords: "volume", compute: (b, p) => ({ v: b.volume.map((x) => x), ma: sma(b.volume, n(p, "ma")) }) },
  { id: "obv", label: "OBV", group: "거래량", pane: "separate", render: "series", params: [], outputs: [line("v", "OBV")], keywords: "on balance volume", compute: (b) => ({ v: obv(b.close, b.volume) }) },
  {
    id: "vprofile",
    label: "매물대 (공통 표시·설정)",
    group: "거래량",
    pane: "overlay",
    render: "volume-profile",
    params: [],
    outputs: [],
    keywords: "volume profile poc vah val",
    compute: () => ({}),
  },
  { id: "rsi", label: "RSI", group: "오실레이터", pane: "separate", render: "series", params: [int("period", "기간", 14, 2)], outputs: [line("v", "RSI", [70, 30])], keywords: "relative strength", compute: (b, p) => ({ v: rsi(b.close, n(p, "period")) }) },
  {
    id: "stoch",
    label: "스토캐스틱",
    group: "오실레이터",
    pane: "separate",
    render: "series",
    params: [int("k", "%K", 14), int("d", "%D", 3)],
    outputs: [line("k", "%K", [80, 20]), line("d", "%D")],
    keywords: "stochastic",
    compute: (b, p) => stochastic(b.high, b.low, b.close, n(p, "k"), n(p, "d")),
  },
  {
    id: "stochrsi",
    label: "Stoch RSI",
    group: "오실레이터",
    pane: "separate",
    render: "series",
    params: [int("rsi", "RSI", 14), int("stoch", "Stoch", 14), int("k", "%K", 3), int("d", "%D", 3)],
    outputs: [line("k", "%K", [80, 20]), line("d", "%D")],
    keywords: "stochastic rsi",
    compute: (b, p) => stochRsi(b.close, n(p, "rsi"), n(p, "stoch"), n(p, "k"), n(p, "d")),
  },
  {
    id: "macd",
    label: "MACD",
    group: "오실레이터",
    pane: "separate",
    render: "series",
    params: [int("fast", "단기", 12), int("slow", "장기", 26), int("signal", "시그널", 9)],
    outputs: [{ key: "hist", label: "히스토그램", style: "histogram" }, line("macd", "MACD", [0]), line("signal", "시그널")],
    keywords: "macd",
    compute: (b, p) => macd(b.close, n(p, "fast"), n(p, "slow"), n(p, "signal")),
  },
  {
    id: "adx",
    label: "ADX / DMI",
    group: "오실레이터",
    pane: "separate",
    render: "series",
    params: [int("period", "기간", 14, 2)],
    outputs: [line("adx", "ADX", [25]), line("plusDi", "+DI"), line("minusDi", "−DI")],
    keywords: "adx dmi directional",
    compute: (b, p) => adx(b.high, b.low, b.close, n(p, "period")),
  },
  { id: "cci", label: "CCI", group: "오실레이터", pane: "separate", render: "series", params: [int("period", "기간", 20, 2)], outputs: [line("v", "CCI", [100, -100])], keywords: "commodity channel", compute: (b, p) => ({ v: cci(b.high, b.low, b.close, n(p, "period")) }) },
  { id: "mfi", label: "MFI", group: "오실레이터", pane: "separate", render: "series", params: [int("period", "기간", 14, 2)], outputs: [line("v", "MFI", [80, 20])], keywords: "money flow", compute: (b, p) => ({ v: mfi(b.high, b.low, b.close, b.volume, n(p, "period")) }) },
  { id: "willr", label: "Williams %R", group: "오실레이터", pane: "separate", render: "series", params: [int("period", "기간", 14, 2)], outputs: [line("v", "%R", [-20, -80])], keywords: "williams r", compute: (b, p) => ({ v: williamsR(b.high, b.low, b.close, n(p, "period")) }) },
  { id: "atr", label: "ATR", group: "변동성", pane: "separate", render: "series", params: [int("period", "기간", 14, 2)], outputs: [line("v", "ATR")], keywords: "average true range volatility", compute: (b, p) => ({ v: atr(b.high, b.low, b.close, n(p, "period")) }) },
  {
    id: "pctbands",
    label: "종가 백분위 밴드 (10·50·90)",
    group: "밴드·채널",
    pane: "overlay",
    render: "series",
    params: [int("window", "기간", 120, 10, 1000)],
    outputs: [line("p90", "P90"), line("p50", "P50"), line("p10", "P10")],
    keywords: "percentile",
    compute: (b, p) => {
      const r = rollingPercentileBands(b.close, n(p, "window"));
      return { p10: r.p10, p50: r.p50, p90: r.p90 };
    },
  },
  {
    id: "hl52",
    label: "52주 고가·저가",
    group: "레벨",
    pane: "overlay",
    render: "series",
    params: [int("lookback", "봉 수 (일봉 252)", 252, 5, 2000)],
    outputs: [line("high", "고가"), line("low", "저가")],
    keywords: "52 week high low",
    compute: (b, p) => highLowN(b.high, b.low, n(p, "lookback")),
  },
  {
    id: "pivots",
    label: "피봇 포인트",
    group: "레벨",
    pane: "overlay",
    render: "pivots",
    params: [{ key: "kind", label: "방식", type: "select", default: "classic", options: [{ value: "classic", label: "Classic" }, { value: "fibonacci", label: "Fibonacci" }, { value: "camarilla", label: "Camarilla" }] }],
    outputs: [],
    keywords: "pivot points classic fibonacci camarilla",
    compute: () => ({}),
  },
];

export const INDICATOR_BY_ID = new Map(INDICATORS.map((d) => [d.id, d]));

export function defaultParams(def: IndicatorDef): Record<string, number | string> {
  return Object.fromEntries(def.params.map((p) => [p.key, p.default]));
}

/** Clamp/validate user-edited params against the definition. */
export function sanitizeParams(def: IndicatorDef, raw: Record<string, unknown>): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const p of def.params) {
    const v = raw[p.key];
    if (p.type === "select") {
      out[p.key] = p.options?.some((o) => o.value === v) ? String(v) : p.default;
      continue;
    }
    let x = Number(v);
    if (!Number.isFinite(x)) x = Number(p.default);
    if (p.min != null) x = Math.max(p.min, x);
    if (p.max != null) x = Math.min(p.max, x);
    if (p.type === "int") x = Math.round(x);
    out[p.key] = x;
  }
  return out;
}

export function searchIndicators(q: string): IndicatorDef[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return INDICATORS;
  return INDICATORS.filter((d) => `${d.label} ${d.id} ${d.group} ${d.keywords ?? ""}`.toLowerCase().includes(needle));
}

/** Memo key: data version + indicator id + params + anchor (F7.15). */
export function indicatorCacheKey(version: string | number, inst: IndicatorInstance): string {
  return `${version}|${inst.id}|${JSON.stringify(inst.params)}|${inst.anchorTime ?? ""}`;
}

export const PALETTE = ["#f59e0b", "#a78bfa", "#38bdf8", "#94a3b8", "#f97316", "#2563eb", "#2dd4bf", "#e879f9", "#84cc16", "#f43f5e"];

export function instanceLabel(inst: IndicatorInstance): string {
  const def = INDICATOR_BY_ID.get(inst.id);
  if (!def) return inst.id;
  if (inst.id === "sma") return `SMA${inst.params.period}`;
  const short = def.label.split(" ")[0]!;
  const params = [...def.params.filter(p => p.type !== "select"), ...def.params.filter(p => p.type === "select")].map(p => inst.params[p.key]);
  return params.length ? `${short}(${params.join(",")})` : short;
}

let seq = 0;
export function newInstance(id: string, params?: Record<string, number | string>, color?: string): IndicatorInstance {
  const def = INDICATOR_BY_ID.get(id);
  seq += 1;
  return {
    uid: `${id}-${Date.now().toString(36)}-${seq}`,
    id,
    params: def ? sanitizeParams(def, { ...defaultParams(def), ...(params ?? {}) }) : { ...(params ?? {}) },
    visible: true,
    color,
    ...(id === "sma" && isStandardSmaPeriod(Number(params?.period ?? 20)) ? { colorMode: color ? "custom" as const : "theme" as const } : {}),
  };
}

/** Default layout indicators (keeps the pre-v3 chart's defaults). */
export function defaultIndicators(_market: "KR" | "US"): IndicatorInstance[] {
  const out = [
    ...STANDARD_SMA_PERIODS.map(standardSmaInstance),
    newInstance("bb", { period: 20, mult: 2 }),
    newInstance("volume", { ma: 20 }),
    newInstance("rsi", { period: 14 }, "#a78bfa"),
    newInstance("macd", {}, "#38bdf8"),
  ];
  return out;
}

/** Compute one instance; anchored VWAP resolves its anchor time to an index. */
export function computeInstance(inst: IndicatorInstance, bars: CatalogBars, times: readonly (string | number)[]): Record<string, Series> {
  const def = INDICATOR_BY_ID.get(inst.id);
  if (!def) return {};
  const anchorIndex = inst.anchorTime == null ? null : times.findIndex((t) => t === inst.anchorTime);
  return def.compute(bars, inst.params, { anchorIndex: anchorIndex != null && anchorIndex >= 0 ? anchorIndex : null });
}
