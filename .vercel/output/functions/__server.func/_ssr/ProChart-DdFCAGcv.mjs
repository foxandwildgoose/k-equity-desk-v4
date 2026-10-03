import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { a as kstDayKey } from "./time-By5ScNNo.mjs";
import { B as ListTree, D as Play, E as Plus, G as Layers, I as Magnet, L as Lock, O as Pause, R as LockOpen, S as Rewind, St as Bell, a as Undo2, b as Search, h as SkipForward, it as EyeOff, j as MousePointer2, l as Trash2, n as X, rt as Eye, w as Redo2, wt as BellOff, yt as BrainCircuit } from "../_libs/lucide-react.mjs";
import { H as notifyAlert, It as useAppStore, Nt as Input, Pt as cn, Y as FeedList, at as SheetHeader, it as SheetDescription, lt as useFeed, nt as Sheet, ot as SheetTitle, rt as SheetContent, y as useChartData } from "./router-B1V8nj-n.mjs";
import { c as h, d as qe, f as ye, i as Ue, n as Nr, o as Ze, r as Qe, s as bi, u as nr } from "../_libs/lightweight-charts.mjs";
import { $ as pivotPoints, A as donchian, B as heikinAshi, C as chartExportName, Ct as williamsR, F as ema, G as keltner, H as hma, I as extendedHoursRuns, J as mfi, L as formatChartPercent, M as downloadCsv, P as drawingReducer, Q as percentFromFirstVisible, R as formatChartPrice, S as cci, St as vwap, T as computeRangePosition, U as ichimoku, V as highLowN, W as initHistory, X as obv, Y as newDrawing, Z as parabolicSar, _ as anchorsFor, _t as supertrend, a as DrawingPrimitive, b as bollinger, bt as visibleWindow, c as RangeMarkerPrimitive, ct as replayTickMs, d as SessionPrimitive, dt as sessionBreaks, et as planRangeMarkers, ft as sma, g as anchoredVwap, h as alignByTime, ht as stochastic, i as DRAWING_TOOLS, it as rangeMarkerText, j as downloadCanvasPng, l as RangePositionStrip, lt as rollingPercentileBands, m as adx, mt as stochRsi, ot as replaySlice, p as VolumeProfilePrimitive, pt as snapPrice, q as macd, r as ChartShell, s as REPLAY_SPEEDS, st as replayStep, tt as priceFormatFor, ut as rsi, v as atr, vt as useChartTheme, wt as wma, x as capBars, xt as volumeProfile, y as barsToCsv, yt as useProChart, z as formatChartVolume } from "./tools-Cb8-otqN.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ProChart-DdFCAGcv.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Indicator catalog (F7.6): searchable definitions with editable params and
* pure compute functions over bar arrays. Rendering lives in the chart
* component; this module only says what to draw and computes the values.
*/
var int = (key, label, d, min = 1, max = 500) => ({
	key,
	label,
	type: "int",
	default: d,
	min,
	max,
	step: 1
});
var flt = (key, label, d, min = .001, max = 100, step = .1) => ({
	key,
	label,
	type: "float",
	default: d,
	min,
	max,
	step
});
var n = (p, k) => Number(p[k]);
var line = (key, label, levels) => ({
	key,
	label,
	style: "line",
	levels
});
var INDICATORS = [
	{
		id: "sma",
		label: "SMA 단순이동평균",
		group: "이동평균",
		pane: "overlay",
		render: "series",
		params: [int("period", "기간", 20)],
		outputs: [line("v", "SMA")],
		keywords: "ma moving average 이평",
		compute: (b, p) => ({ v: sma(b.close, n(p, "period")) })
	},
	{
		id: "ema",
		label: "EMA 지수이동평균",
		group: "이동평균",
		pane: "overlay",
		render: "series",
		params: [int("period", "기간", 20)],
		outputs: [line("v", "EMA")],
		keywords: "ma exponential",
		compute: (b, p) => ({ v: ema(b.close, n(p, "period")) })
	},
	{
		id: "wma",
		label: "WMA 가중이동평균",
		group: "이동평균",
		pane: "overlay",
		render: "series",
		params: [int("period", "기간", 20)],
		outputs: [line("v", "WMA")],
		keywords: "ma weighted",
		compute: (b, p) => ({ v: wma(b.close, n(p, "period")) })
	},
	{
		id: "hma",
		label: "HMA 헐 이동평균",
		group: "이동평균",
		pane: "overlay",
		render: "series",
		params: [int("period", "기간", 20, 2)],
		outputs: [line("v", "HMA")],
		keywords: "ma hull",
		compute: (b, p) => ({ v: hma(b.close, n(p, "period")) })
	},
	{
		id: "bb",
		label: "볼린저 밴드",
		group: "밴드·채널",
		pane: "overlay",
		render: "series",
		params: [int("period", "기간", 20, 2), flt("mult", "배수", 2)],
		outputs: [
			line("upper", "상단"),
			line("mid", "중심"),
			line("lower", "하단")
		],
		keywords: "bollinger bands",
		compute: (b, p) => bollinger(b.close, n(p, "period"), n(p, "mult"))
	},
	{
		id: "keltner",
		label: "켈트너 채널",
		group: "밴드·채널",
		pane: "overlay",
		render: "series",
		params: [
			int("ema", "EMA", 20),
			int("atr", "ATR", 10),
			flt("mult", "배수", 2)
		],
		outputs: [
			line("upper", "상단"),
			line("mid", "중심"),
			line("lower", "하단")
		],
		keywords: "keltner channel",
		compute: (b, p) => keltner(b.high, b.low, b.close, n(p, "ema"), n(p, "atr"), n(p, "mult"))
	},
	{
		id: "donchian",
		label: "돈치안 채널",
		group: "밴드·채널",
		pane: "overlay",
		render: "series",
		params: [int("period", "기간", 20)],
		outputs: [
			line("upper", "상단"),
			line("mid", "중심"),
			line("lower", "하단")
		],
		keywords: "donchian channel",
		compute: (b, p) => donchian(b.high, b.low, n(p, "period"))
	},
	{
		id: "ichimoku",
		label: "일목균형표",
		group: "밴드·채널",
		pane: "overlay",
		render: "series",
		params: [
			int("tenkan", "전환선", 9),
			int("kijun", "기준선", 26),
			int("spanB", "선행스팬B", 52),
			int("disp", "이동", 26)
		],
		outputs: [
			line("tenkan", "전환선"),
			line("kijun", "기준선"),
			line("spanA", "선행A"),
			line("spanB", "선행B"),
			line("chikou", "후행")
		],
		keywords: "ichimoku cloud 일목",
		compute: (b, p) => ichimoku(b.high, b.low, b.close, n(p, "tenkan"), n(p, "kijun"), n(p, "spanB"), n(p, "disp"))
	},
	{
		id: "psar",
		label: "파라볼릭 SAR",
		group: "추세·스탑",
		pane: "overlay",
		render: "series",
		params: [flt("step", "가속", .02, .001, 1, .01), flt("max", "최대", .2, .01, 1, .01)],
		outputs: [{
			key: "v",
			label: "SAR",
			style: "dots"
		}],
		keywords: "parabolic sar stop",
		compute: (b, p) => ({ v: parabolicSar(b.high, b.low, n(p, "step"), n(p, "max")) })
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
			return {
				up: st.value.map((v, i) => st.direction[i] === 1 ? v : null),
				down: st.value.map((v, i) => st.direction[i] === -1 ? v : null)
			};
		}
	},
	{
		id: "vwap",
		label: "VWAP (세션)",
		group: "VWAP",
		pane: "overlay",
		render: "series",
		params: [],
		outputs: [line("v", "VWAP")],
		keywords: "vwap volume weighted",
		compute: (b) => ({ v: vwap(b.high, b.low, b.close, b.volume, b.sessionKeys) })
	},
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
		compute: (b, _p, ctx) => ({ v: ctx.anchorIndex == null ? b.close.map(() => null) : anchoredVwap(b.high, b.low, b.close, b.volume, ctx.anchorIndex) })
	},
	{
		id: "volume",
		label: "거래량 (+이동평균)",
		group: "거래량",
		pane: "separate",
		render: "series",
		params: [int("ma", "이동평균", 20)],
		outputs: [{
			key: "v",
			label: "거래량",
			style: "histogram"
		}, line("ma", "MA")],
		keywords: "volume",
		compute: (b, p) => ({
			v: b.volume.map((x) => x),
			ma: sma(b.volume, n(p, "ma"))
		})
	},
	{
		id: "obv",
		label: "OBV",
		group: "거래량",
		pane: "separate",
		render: "series",
		params: [],
		outputs: [line("v", "OBV")],
		keywords: "on balance volume",
		compute: (b) => ({ v: obv(b.close, b.volume) })
	},
	{
		id: "vprofile",
		label: "볼륨 프로파일 (내장 매물대가 꺼져 있을 때만)",
		group: "거래량",
		pane: "overlay",
		render: "volume-profile",
		params: [int("rows", "가격 구간 수", 24, 6, 80), flt("va", "밸류 영역", .7, .5, .95, .05)],
		outputs: [],
		keywords: "volume profile poc vah val",
		compute: () => ({})
	},
	{
		id: "rsi",
		label: "RSI",
		group: "오실레이터",
		pane: "separate",
		render: "series",
		params: [int("period", "기간", 14, 2)],
		outputs: [line("v", "RSI", [70, 30])],
		keywords: "relative strength",
		compute: (b, p) => ({ v: rsi(b.close, n(p, "period")) })
	},
	{
		id: "stoch",
		label: "스토캐스틱",
		group: "오실레이터",
		pane: "separate",
		render: "series",
		params: [int("k", "%K", 14), int("d", "%D", 3)],
		outputs: [line("k", "%K", [80, 20]), line("d", "%D")],
		keywords: "stochastic",
		compute: (b, p) => stochastic(b.high, b.low, b.close, n(p, "k"), n(p, "d"))
	},
	{
		id: "stochrsi",
		label: "Stoch RSI",
		group: "오실레이터",
		pane: "separate",
		render: "series",
		params: [
			int("rsi", "RSI", 14),
			int("stoch", "Stoch", 14),
			int("k", "%K", 3),
			int("d", "%D", 3)
		],
		outputs: [line("k", "%K", [80, 20]), line("d", "%D")],
		keywords: "stochastic rsi",
		compute: (b, p) => stochRsi(b.close, n(p, "rsi"), n(p, "stoch"), n(p, "k"), n(p, "d"))
	},
	{
		id: "macd",
		label: "MACD",
		group: "오실레이터",
		pane: "separate",
		render: "series",
		params: [
			int("fast", "단기", 12),
			int("slow", "장기", 26),
			int("signal", "시그널", 9)
		],
		outputs: [
			{
				key: "hist",
				label: "히스토그램",
				style: "histogram"
			},
			line("macd", "MACD", [0]),
			line("signal", "시그널")
		],
		keywords: "macd",
		compute: (b, p) => macd(b.close, n(p, "fast"), n(p, "slow"), n(p, "signal"))
	},
	{
		id: "adx",
		label: "ADX / DMI",
		group: "오실레이터",
		pane: "separate",
		render: "series",
		params: [int("period", "기간", 14, 2)],
		outputs: [
			line("adx", "ADX", [25]),
			line("plusDi", "+DI"),
			line("minusDi", "−DI")
		],
		keywords: "adx dmi directional",
		compute: (b, p) => adx(b.high, b.low, b.close, n(p, "period"))
	},
	{
		id: "cci",
		label: "CCI",
		group: "오실레이터",
		pane: "separate",
		render: "series",
		params: [int("period", "기간", 20, 2)],
		outputs: [line("v", "CCI", [100, -100])],
		keywords: "commodity channel",
		compute: (b, p) => ({ v: cci(b.high, b.low, b.close, n(p, "period")) })
	},
	{
		id: "mfi",
		label: "MFI",
		group: "오실레이터",
		pane: "separate",
		render: "series",
		params: [int("period", "기간", 14, 2)],
		outputs: [line("v", "MFI", [80, 20])],
		keywords: "money flow",
		compute: (b, p) => ({ v: mfi(b.high, b.low, b.close, b.volume, n(p, "period")) })
	},
	{
		id: "willr",
		label: "Williams %R",
		group: "오실레이터",
		pane: "separate",
		render: "series",
		params: [int("period", "기간", 14, 2)],
		outputs: [line("v", "%R", [-20, -80])],
		keywords: "williams r",
		compute: (b, p) => ({ v: williamsR(b.high, b.low, b.close, n(p, "period")) })
	},
	{
		id: "atr",
		label: "ATR",
		group: "변동성",
		pane: "separate",
		render: "series",
		params: [int("period", "기간", 14, 2)],
		outputs: [line("v", "ATR")],
		keywords: "average true range volatility",
		compute: (b, p) => ({ v: atr(b.high, b.low, b.close, n(p, "period")) })
	},
	{
		id: "pctbands",
		label: "종가 백분위 밴드 (10·50·90)",
		group: "밴드·채널",
		pane: "overlay",
		render: "series",
		params: [int("window", "기간", 120, 10, 1e3)],
		outputs: [
			line("p90", "P90"),
			line("p50", "P50"),
			line("p10", "P10")
		],
		keywords: "percentile",
		compute: (b, p) => {
			const r = rollingPercentileBands(b.close, n(p, "window"));
			return {
				p10: r.p10,
				p50: r.p50,
				p90: r.p90
			};
		}
	},
	{
		id: "hl52",
		label: "52주 고가·저가",
		group: "레벨",
		pane: "overlay",
		render: "series",
		params: [int("lookback", "봉 수 (일봉 252)", 252, 5, 2e3)],
		outputs: [line("high", "고가"), line("low", "저가")],
		keywords: "52 week high low",
		compute: (b, p) => highLowN(b.high, b.low, n(p, "lookback"))
	},
	{
		id: "pivots",
		label: "피봇 포인트",
		group: "레벨",
		pane: "overlay",
		render: "pivots",
		params: [{
			key: "kind",
			label: "방식",
			type: "select",
			default: "classic",
			options: [
				{
					value: "classic",
					label: "Classic"
				},
				{
					value: "fibonacci",
					label: "Fibonacci"
				},
				{
					value: "camarilla",
					label: "Camarilla"
				}
			]
		}],
		outputs: [],
		keywords: "pivot points classic fibonacci camarilla",
		compute: () => ({})
	}
];
var INDICATOR_BY_ID = new Map(INDICATORS.map((d) => [d.id, d]));
function defaultParams(def) {
	return Object.fromEntries(def.params.map((p) => [p.key, p.default]));
}
/** Clamp/validate user-edited params against the definition. */
function sanitizeParams(def, raw) {
	const out = {};
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
function searchIndicators(q) {
	const needle = q.trim().toLowerCase();
	if (!needle) return INDICATORS;
	return INDICATORS.filter((d) => `${d.label} ${d.id} ${d.group} ${d.keywords ?? ""}`.toLowerCase().includes(needle));
}
/** Memo key: data version + indicator id + params + anchor (F7.15). */
function indicatorCacheKey(version, inst) {
	return `${version}|${inst.id}|${JSON.stringify(inst.params)}|${inst.anchorTime ?? ""}`;
}
var PALETTE = [
	"#f59e0b",
	"#a78bfa",
	"#38bdf8",
	"#94a3b8",
	"#f97316",
	"#2563eb",
	"#2dd4bf",
	"#e879f9",
	"#84cc16",
	"#f43f5e"
];
var seq = 0;
function newInstance(id, params, color) {
	const def = INDICATOR_BY_ID.get(id);
	seq += 1;
	return {
		uid: `${id}-${Date.now().toString(36)}-${seq}`,
		id,
		params: def ? sanitizeParams(def, {
			...defaultParams(def),
			...params ?? {}
		}) : { ...params ?? {} },
		visible: true,
		color
	};
}
/** Default layout indicators (keeps the pre-v3 chart's defaults). */
function defaultIndicators(market) {
	const out = [
		newInstance("sma", { period: 5 }, PALETTE[0]),
		newInstance("sma", { period: 20 }, PALETTE[1]),
		newInstance("sma", { period: 60 }, PALETTE[2]),
		newInstance("bb", {
			period: 20,
			mult: 2
		}, "#64748b"),
		newInstance("volume", { ma: 20 }),
		newInstance("rsi", { period: 14 }, "#a78bfa"),
		newInstance("macd", {}, "#38bdf8")
	];
	if (market === "US") out.push(newInstance("sma", { period: 50 }, PALETTE[4]), newInstance("sma", { period: 200 }, PALETTE[5]));
	return out;
}
/** Compute one instance; anchored VWAP resolves its anchor time to an index. */
function computeInstance(inst, bars, times) {
	const def = INDICATOR_BY_ID.get(inst.id);
	if (!def) return {};
	const anchorIndex = inst.anchorTime == null ? null : times.findIndex((t) => t === inst.anchorTime);
	return def.compute(bars, inst.params, { anchorIndex: anchorIndex != null && anchorIndex >= 0 ? anchorIndex : null });
}
function instanceLabel(inst) {
	const def = INDICATOR_BY_ID.get(inst.id);
	if (!def) return inst.id;
	const short = def.label.split(" ")[0];
	const ps = def.params.filter((p) => p.type !== "select").map((p) => inst.params[p.key]);
	const sel = def.params.filter((p) => p.type === "select").map((p) => inst.params[p.key]);
	const all = [...ps, ...sel];
	return all.length ? `${short}(${all.join(",")})` : short;
}
/** Searchable catalog + per-instance params / color / visibility / remove + templates (F7.6). */
function IndicatorPanel({ open, onOpenChange, instances, onAdd, onChange, onRemove, templates, onSaveTemplate, onApplyTemplate, onDeleteTemplate }) {
	const [q, setQ] = (0, import_react.useState)("");
	const [edit, setEdit] = (0, import_react.useState)(null);
	const [tplName, setTplName] = (0, import_react.useState)("");
	const results = (0, import_react.useMemo)(() => searchIndicators(q), [q]);
	const groups = (0, import_react.useMemo)(() => {
		const m = /* @__PURE__ */ new Map();
		for (const d of results) m.set(d.group, [...m.get(d.group) ?? [], d]);
		return [...m.entries()];
	}, [results]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
			side: "right",
			className: "w-full max-w-md overflow-y-auto p-0",
			"data-testid": "indicator-panel",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, {
				className: "border-b border-border",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: "지표" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetDescription, { children: "검색해서 추가하고, 매개변수·색·표시를 바꿉니다. 설정은 이 차트 레이아웃에 저장됩니다." })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3 p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
						className: "mb-1 text-[11px] font-semibold text-muted-foreground",
						children: [
							"사용 중 (",
							instances.length,
							")"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-1",
						children: instances.map((inst) => {
							const def = INDICATOR_BY_ID.get(inst.id);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "rounded-md border border-border p-1.5 text-[12px]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "color",
											value: inst.color ?? PALETTE[0],
											onChange: (e) => onChange(inst.uid, { color: e.target.value }),
											className: "size-7 cursor-pointer rounded border-0 bg-transparent p-0",
											"aria-label": "색"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											className: "min-w-0 flex-1 truncate text-left font-medium",
											onClick: () => setEdit(edit === inst.uid ? null : inst.uid),
											children: [instanceLabel(inst), def?.anchored && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "ml-1 text-[10px] text-muted-foreground",
												children: inst.anchorTime != null ? `기준 ${inst.anchorTime}` : "기준봉 미지정"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => onChange(inst.uid, { visible: !inst.visible }),
											className: "inline-flex size-9 items-center justify-center rounded hover:bg-muted",
											"aria-label": inst.visible ? "숨기기" : "표시",
											children: inst.visible ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "size-3.5" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => onRemove(inst.uid),
											className: "inline-flex size-9 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground",
											"aria-label": "삭제",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
										})
									]
								}), edit === inst.uid && def && def.params.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1.5 grid grid-cols-2 gap-1.5",
									children: def.params.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "flex flex-col gap-0.5 text-[10.5px] text-muted-foreground",
										children: [p.label, p.type === "select" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
											value: String(inst.params[p.key]),
											onChange: (e) => onChange(inst.uid, { params: sanitizeParams(def, {
												...inst.params,
												[p.key]: e.target.value
											}) }),
											className: "h-9 rounded-md border border-border bg-background px-1 text-xs text-foreground",
											children: p.options?.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: o.value,
												children: o.label
											}, o.value))
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											type: "number",
											value: String(inst.params[p.key]),
											min: p.min,
											max: p.max,
											step: p.step,
											onChange: (e) => onChange(inst.uid, { params: sanitizeParams(def, {
												...inst.params,
												[p.key]: e.target.value
											}) }),
											className: "h-9 text-xs"
										})]
									}, p.key))
								})]
							}, inst.uid);
						})
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: q,
							onChange: (e) => setQ(e.target.value),
							placeholder: "지표 검색 (예: RSI, 볼린저, vwap)",
							className: "h-9 pl-8 text-xs",
							"aria-label": "지표 검색"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 space-y-2",
						children: groups.map(([g, defs]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mb-0.5 text-[10px] font-semibold text-muted-foreground",
							children: g
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-1",
							children: defs.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => onAdd(d),
								className: "inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-[11px] hover:bg-muted",
								"data-indicator": d.id,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3" }),
									" ",
									d.label
								]
							}, d.id))
						})] }, g))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "border-t border-border pt-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "mb-1 text-[11px] font-semibold text-muted-foreground",
								children: "템플릿"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
								className: "flex gap-1",
								onSubmit: (e) => {
									e.preventDefault();
									if (tplName.trim()) onSaveTemplate(tplName.trim().slice(0, 40));
									setTplName("");
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: tplName,
									onChange: (e) => setTplName(e.target.value),
									placeholder: "현재 지표·차트 종류를 템플릿으로 저장",
									className: "h-9 text-xs",
									"aria-label": "템플릿 이름"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "submit",
									className: "inline-flex min-h-9 items-center rounded-md border border-border px-2 text-[11px] font-semibold hover:bg-muted",
									children: "저장"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 flex flex-wrap gap-1",
								children: templates.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "inline-flex items-center rounded-md border border-border text-[11px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => onApplyTemplate(t),
										className: "min-h-9 px-2 hover:bg-muted",
										children: t
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => onDeleteTemplate(t),
										className: "inline-flex size-9 items-center justify-center text-muted-foreground hover:text-foreground",
										"aria-label": `${t} 삭제`,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3" })
									})]
								}, t))
							})
						]
					})
				]
			})]
		})
	});
}
var TYPE_LABEL = Object.fromEntries(DRAWING_TOOLS.map((t) => [t.type, t.label]));
/** Object manager (F7.7): select, color, width, lock, hide, delete, hline alerts. */
function ObjectManager({ open, onOpenChange, drawings, selectedId, onSelect, onUpdate, onRemove, onToggleAlert, formatPrice }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
			side: "right",
			className: "w-full max-w-md overflow-y-auto p-0",
			"data-testid": "object-manager",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, {
				className: "border-b border-border",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: "그리기 목록" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetDescription, { children: "선택·색·두께·잠금·숨김·삭제. 수평선은 가격 알림으로 바꿀 수 있습니다. 실행 취소 Ctrl/⌘+Z." })]
			}), drawings.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "p-4 text-[12px] text-muted-foreground",
				children: "그린 도형이 없습니다."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-1 p-3",
				children: drawings.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: cn("flex flex-wrap items-center gap-1 rounded-md border p-1.5 text-[12px]", selectedId === d.id ? "border-amber-500/60" : "border-border"),
					"data-drawing": d.id,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => onSelect(d.id),
							className: "min-h-9 min-w-0 flex-1 truncate text-left",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: TYPE_LABEL[d.type] ?? d.type
								}),
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: formatPrice(d.anchors[0]?.p ?? 0)
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "color",
							value: /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : "#f59e0b",
							onChange: (e) => onUpdate(d.id, { color: e.target.value }),
							disabled: d.locked,
							className: "size-7 cursor-pointer rounded border-0 bg-transparent p-0",
							"aria-label": "색"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							value: d.width,
							onChange: (e) => onUpdate(d.id, { width: Number(e.target.value) }),
							disabled: d.locked,
							className: "h-9 rounded-md border border-border bg-background px-1 text-xs",
							"aria-label": "두께",
							children: [
								1,
								2,
								3,
								4
							].map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value: w,
								children: [w, "px"]
							}, w))
						}),
						d.type === "hline" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => onToggleAlert(d),
							className: "inline-flex size-9 items-center justify-center rounded hover:bg-muted",
							"aria-label": d.alertId ? "가격 알림 해제" : "가격 알림 만들기",
							title: d.alertId ? "가격 알림 해제" : "이 가격을 넘으면 알림",
							children: d.alertId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-3.5 text-amber-500" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellOff, { className: "size-3.5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => onUpdate(d.id, { locked: !d.locked }),
							className: "inline-flex size-9 items-center justify-center rounded hover:bg-muted",
							"aria-label": d.locked ? "잠금 해제" : "잠금",
							children: d.locked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-3.5 text-amber-500" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockOpen, { className: "size-3.5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => onUpdate(d.id, { hidden: !d.hidden }),
							className: "inline-flex size-9 items-center justify-center rounded hover:bg-muted",
							"aria-label": d.hidden ? "표시" : "숨기기",
							children: d.hidden ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-3.5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => onRemove(d.id),
							className: "inline-flex size-9 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground",
							"aria-label": "삭제",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
						})
					]
				}, d.id))
			})]
		})
	});
}
/** Alerts for this symbol (F7.11): add RSI / MA-cross alerts; list + remove. */
function AlertsPanel({ open, onOpenChange, alerts, onAddRsi, onAddMa, onRemove }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
			side: "right",
			className: "w-full max-w-md overflow-y-auto p-0",
			"data-testid": "alerts-panel",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, {
				className: "border-b border-border",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: "차트 알림" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetDescription, { children: "데이터가 새로 들어올 때 이 브라우저에서 확인합니다. 알림은 Live Wire(토스트·데스크톱 알림 설정)로 보냅니다." })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2 p-3 text-[12px]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: onAddRsi,
							className: "inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 hover:bg-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3" }), " RSI 70·30 돌파"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: onAddMa,
							className: "inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 hover:bg-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3" }), " 이평 20·60 교차"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] text-muted-foreground",
						children: "수평선 가격 알림은 그리기 목록에서 수평선의 종 아이콘으로 만듭니다."
					}),
					alerts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground",
						children: "이 종목의 알림이 없습니다."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-1",
						children: alerts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center gap-2 rounded-md border border-border p-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0 flex-1 truncate",
								children: [
									a.kind === "price-cross" ? `가격 ${a.level?.toLocaleString("ko-KR")}` : a.kind === "rsi-cross" ? `RSI ${a.level}` : `이평 ${a.fast}/${a.slow}`,
									" ·",
									" ",
									a.direction === "up" ? "상향" : a.direction === "down" ? "하향" : "양방향",
									" · ",
									a.repeat === "once" ? "한 번" : "매번",
									" · ",
									a.active ? "대기" : "완료"
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => onRemove(a.id),
								className: "inline-flex size-9 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground",
								"aria-label": "알림 삭제",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
							})]
						}, a.id))
					})
				]
			})]
		})
	});
}
function sideOf(price, level) {
	return price >= level ? "above" : "below";
}
function evaluatePriceAlert(alert, price, nowIso) {
	if (!alert.active || alert.kind !== "price-cross" || alert.level == null || !Number.isFinite(price) || price <= 0) return {
		fired: false,
		direction: null,
		next: alert
	};
	const side = sideOf(price, alert.level);
	const prev = alert.lastSide;
	if (!prev) return {
		fired: false,
		direction: null,
		next: {
			...alert,
			lastSide: side
		}
	};
	const dir = prev === "below" && side === "above" ? "up" : prev === "above" && side === "below" ? "down" : null;
	const fired = dir != null && (alert.direction === "any" || alert.direction === dir);
	const next = {
		...alert,
		lastSide: side
	};
	if (fired) {
		next.lastFiredAt = nowIso;
		if (alert.repeat === "once") next.active = false;
	}
	return {
		fired,
		direction: fired ? dir : null,
		next
	};
}
/**
* Indicator alerts (F7.11): RSI crossing 70/30 and moving-average crosses,
* detected between the last two finite values. Returns the direction or null.
*/
function crossOfLevel(prev, cur, level) {
	if (prev == null || cur == null || !Number.isFinite(prev) || !Number.isFinite(cur)) return null;
	if (prev < level && cur >= level) return "up";
	if (prev > level && cur <= level) return "down";
	return null;
}
function crossOfLines(fastPrev, slowPrev, fastCur, slowCur) {
	if ([
		fastPrev,
		slowPrev,
		fastCur,
		slowCur
	].some((v) => v == null || !Number.isFinite(v))) return null;
	const before = fastPrev - slowPrev;
	const after = fastCur - slowCur;
	if (before < 0 && after >= 0) return "up";
	if (before > 0 && after <= 0) return "down";
	return null;
}
/** Evaluate an indicator alert on the latest bars; `seenBarKey` prevents re-firing on the same bar. */
function evaluateIndicatorAlert(alert, input, nowIso) {
	if (!alert.active) return {
		fired: false,
		direction: null,
		next: alert
	};
	const lastTwo = (s) => s && s.length >= 2 ? [s[s.length - 2], s[s.length - 1]] : [null, null];
	let dir = null;
	if (alert.kind === "rsi-cross" && alert.level != null) {
		const [a, b] = lastTwo(input.rsi);
		dir = crossOfLevel(a, b, alert.level);
	} else if (alert.kind === "ma-cross") {
		const [fa, fb] = lastTwo(input.fast);
		const [sa, sb] = lastTwo(input.slow);
		dir = crossOfLines(fa, sa, fb, sb);
	}
	const already = alert.lastFiredAt != null && alert.lastBarKey === input.barKey;
	if (!(dir != null && !already && (alert.direction === "any" || alert.direction === dir))) return {
		fired: false,
		direction: null,
		next: alert
	};
	const next = {
		...alert,
		lastFiredAt: nowIso,
		active: alert.repeat === "once" ? false : true,
		lastBarKey: input.barKey
	};
	return {
		fired: true,
		direction: dir,
		next
	};
}
var CHART_TYPES = [
	{
		id: "candles",
		label: "캔들"
	},
	{
		id: "hollow",
		label: "할로우 캔들"
	},
	{
		id: "bars",
		label: "OHLC 바"
	},
	{
		id: "heikin-ashi",
		label: "하이킨아시"
	},
	{
		id: "line",
		label: "라인"
	},
	{
		id: "area",
		label: "영역"
	},
	{
		id: "baseline",
		label: "베이스라인"
	}
];
var CHART_SCALES = [
	{
		id: "normal",
		label: "일반"
	},
	{
		id: "log",
		label: "로그"
	},
	{
		id: "percent",
		label: "%"
	},
	{
		id: "indexed",
		label: "100 기준"
	}
];
function chartStateKey(market, code, interval) {
	return `ked:chart:v2:${market}:${code.trim().toUpperCase()}:${interval}`;
}
var LEGACY_DRAW_KEY = (code) => `ke-chart-draw:${code}`;
var TYPES = new Set(CHART_TYPES.map((t) => t.id));
var SCALES = new Set(CHART_SCALES.map((s) => s.id));
var DEFAULT_OVERLAYS = {
	disclosures: true,
	news: false,
	research: true,
	dividends: true,
	signals: true
};
function defaultLayout(indicators, chartType = "candles", scale = "normal") {
	return {
		v: 2,
		indicators,
		drawings: [],
		chartType,
		scale,
		overlays: { ...DEFAULT_OVERLAYS }
	};
}
function isAnchor(a) {
	const x = a;
	return !!x && (typeof x.t === "string" || typeof x.t === "number") && typeof x.p === "number" && Number.isFinite(x.p);
}
function validDrawing(d) {
	const x = d;
	return !!x && typeof x.id === "string" && typeof x.type === "string" && Array.isArray(x.anchors) && x.anchors.every(isAnchor);
}
/** Parse + validate a stored layout; null when absent or invalid. */
function parseChartState(raw) {
	if (!raw) return null;
	try {
		const v = JSON.parse(raw);
		if (v?.v !== 2) return null;
		return {
			v: 2,
			indicators: Array.isArray(v.indicators) ? v.indicators.filter((i) => i && typeof i.id === "string" && typeof i.uid === "string") : [],
			drawings: Array.isArray(v.drawings) ? v.drawings.filter(validDrawing).map((d) => ({
				...d,
				color: d.color ?? "#f59e0b",
				width: d.width ?? 2,
				locked: Boolean(d.locked),
				hidden: Boolean(d.hidden)
			})) : [],
			chartType: TYPES.has(v.chartType) ? v.chartType : "candles",
			scale: SCALES.has(v.scale) ? v.scale : "normal",
			overlays: {
				...DEFAULT_OVERLAYS,
				...v.overlays ?? {}
			}
		};
	} catch {
		return null;
	}
}
function loadChartState(store, market, code, interval) {
	try {
		return parseChartState(store.getItem(chartStateKey(market, code, interval)));
	} catch {
		return null;
	}
}
function saveChartState(store, market, code, interval, state) {
	try {
		store.setItem(chartStateKey(market, code, interval), JSON.stringify(state));
	} catch {}
}
/**
* Convert legacy `ke-chart-draw:{code}` drawings. Segment anchors were bar
* indices into the daily bars; they are mapped through `barTimes` and dropped
* when out of range (never guessed). Horizontal lines keep their price.
*/
function migrateLegacyDrawings(raw, barTimes) {
	if (!raw) return {
		drawings: [],
		dropped: 0
	};
	let list;
	try {
		list = JSON.parse(raw);
	} catch {
		return {
			drawings: [],
			dropped: 0
		};
	}
	if (!Array.isArray(list)) return {
		drawings: [],
		dropped: 0
	};
	const out = [];
	let dropped = 0;
	const lastT = barTimes[barTimes.length - 1];
	for (const item of list) {
		if (!item || typeof item !== "object" || typeof item.id !== "string") {
			dropped += 1;
			continue;
		}
		if (item.type === "hline" && Number.isFinite(item.price)) {
			out.push({
				id: `legacy-${item.id}`,
				type: "hline",
				anchors: [{
					t: lastT ?? 0,
					p: item.price
				}],
				color: item.color ?? "#f59e0b",
				width: 2,
				locked: false,
				hidden: false,
				text: item.label
			});
			continue;
		}
		const seg = item;
		const t1 = barTimes[Math.round(seg.t1)];
		const t2 = barTimes[Math.round(seg.t2)];
		if (t1 === void 0 || t2 === void 0 || !Number.isFinite(seg.p1) || !Number.isFinite(seg.p2)) {
			dropped += 1;
			continue;
		}
		out.push({
			id: `legacy-${seg.id}`,
			type: seg.type,
			anchors: [{
				t: t1,
				p: seg.p1
			}, {
				t: t2,
				p: seg.p2
			}],
			color: seg.color ?? "#f59e0b",
			width: 2,
			locked: false,
			hidden: false
		});
	}
	return {
		drawings: out,
		dropped
	};
}
/**
* One-time migration into the daily layout: merges legacy drawings into
* `ked:chart:v2:KR:{code}:day` and removes the legacy key. Returns the
* number migrated (0 when nothing to do).
*/
function migrateLegacyOnce(store, code, barTimes, defaults) {
	const legacyKey = LEGACY_DRAW_KEY(code);
	const raw = store.getItem(legacyKey);
	if (raw == null || !barTimes.length) return 0;
	const { drawings } = migrateLegacyDrawings(raw, barTimes);
	const cur = loadChartState(store, "KR", code, "day") ?? defaults;
	const ids = new Set(cur.drawings.map((d) => d.id));
	saveChartState(store, "KR", code, "day", {
		...cur,
		drawings: [...cur.drawings, ...drawings.filter((d) => !ids.has(d.id))]
	});
	store.removeItem(legacyKey);
	return drawings.length;
}
/**
* OHLC bar date → chart time. Daily+ bars keep "YYYY-MM-DD" (business day);
* intraday "YYYY-MM-DD HH:mm" wall-clock (KST for KR, New York for US) →
* unix seconds. Pure (Intl only).
*/
function zonedWallToUnix(ymdHm, timeZone) {
	const [date, hm] = ymdHm.split(" ");
	const [year, month, day] = (date ?? "").split("-").map(Number);
	const [hour, minute] = (hm ?? "00:00").split(":").map(Number);
	if (!year || !month || !day) return 0;
	const want = Date.UTC(year, month - 1, day, hour || 0, minute || 0);
	let utc = want;
	const fmt = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit"
	});
	for (let i = 0; i < 3; i++) {
		const parts = fmt.formatToParts(new Date(utc));
		const g = (t) => Number(parts.find((p) => p.type === t)?.value);
		const delta = want - Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") === 24 ? 0 : g("hour"), g("minute"));
		if (delta === 0) break;
		utc += delta;
	}
	return Math.floor(utc / 1e3);
}
function barTimeOf(date, market) {
	if (date.includes(" ")) return zonedWallToUnix(date, market === "US" ? "America/New_York" : "Asia/Seoul");
	return date.slice(0, 10);
}
/** Calendar day ("YYYY-MM-DD") of a chart time in the market's zone. */
function dayOfTime(t, market) {
	if (typeof t === "string") return t.slice(0, 10);
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: market === "US" ? "America/New_York" : "Asia/Seoul",
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(/* @__PURE__ */ new Date(t * 1e3));
}
var SCALE_MODE = {
	normal: bi.Normal,
	log: bi.Logarithmic,
	percent: bi.Percentage,
	indexed: bi.IndexedTo100
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
function RangeHud({ stats, up, down }) {
	const cells = [
		{
			label: stats.fromPeriodLowPct < -.005 ? "저점이탈" : "저점대비",
			pct: stats.fromPeriodLowPct
		},
		{
			label: stats.fromPeriodHighPct > .005 ? "고점돌파" : "고점대비",
			pct: stats.fromPeriodHighPct
		},
		{
			label: stats.fromRecentHighPct > .005 ? "최근고 돌파" : "최근고",
			pct: stats.fromRecentHighPct
		},
		{
			label: stats.fromRecentLowPct < -.005 ? "최근저 이탈" : "최근저",
			pct: stats.fromRecentLowPct
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "inline-flex flex-wrap items-center gap-x-2 gap-y-0.5",
		"data-testid": "chart-range-hud",
		children: cells.map((cell) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "whitespace-nowrap",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-muted-foreground",
				children: [cell.label, " "]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				style: { color: cell.pct > .005 ? up : cell.pct < -.005 ? down : void 0 },
				children: Number.isFinite(cell.pct) ? formatChartPercent(cell.pct) : "—"
			})]
		}, cell.label))
	});
}
/** One compare symbol's bars (F7.8). */
function CompareLoader({ sym, interval, minuteSize, range, onBars }) {
	const [m, code] = sym.split(":");
	const q = useChartData({
		code,
		market: m === "US" ? "US" : "KOSPI",
		interval,
		minuteSize,
		range
	});
	(0, import_react.useEffect)(() => {
		onBars(sym, q.data?.bars ?? (q.isError ? [] : null));
	}, [
		sym,
		q.data,
		q.isError,
		onBars
	]);
	return null;
}
var COMPARE_COLORS = [
	"#e879f9",
	"#84cc16",
	"#f97316"
];
var VP_KEY = "ked:vp:v1";
var VP_WIDTH = {
	thin: .1,
	mid: .14,
	wide: .18
};
var DEFAULT_VP = {
	enabled: true,
	preset: "ref",
	rows: 24,
	basis: "volume",
	showVa: true,
	showPoc: true,
	width: "thin",
	opacity: .22,
	visibleOnly: false,
	rangeOn: true,
	recentSpan: "52W"
};
function readVpPrefs() {
	try {
		const raw = typeof window === "undefined" ? null : window.localStorage.getItem(VP_KEY);
		if (!raw) return null;
		const p = JSON.parse(raw);
		const rows = [
			16,
			24,
			32,
			48
		].includes(Number(p.rows)) ? Number(p.rows) : DEFAULT_VP.rows;
		const width = p.width === "mid" || p.width === "wide" || p.width === "thin" ? p.width : DEFAULT_VP.width;
		const recentSpan = p.recentSpan === "3M" || p.recentSpan === "6M" || p.recentSpan === "52W" || p.recentSpan === "all" || p.recentSpan === "swing" ? p.recentSpan : DEFAULT_VP.recentSpan;
		return {
			...DEFAULT_VP,
			...p,
			rows,
			width,
			recentSpan,
			opacity: Number.isFinite(p.opacity) ? Math.min(.4, Math.max(.12, Number(p.opacity))) : DEFAULT_VP.opacity,
			basis: p.basis === "turnover" ? "turnover" : "volume",
			preset: p.preset === "hide" || p.preset === "emph" || p.preset === "ref" ? p.preset : DEFAULT_VP.preset
		};
	} catch {
		return null;
	}
}
function applyVpPreset(preset, prev) {
	if (preset === "hide") return {
		...prev,
		preset,
		enabled: false
	};
	if (preset === "emph") return {
		...prev,
		preset,
		enabled: true,
		width: "wide",
		opacity: .32
	};
	return {
		...prev,
		preset: "ref",
		enabled: true,
		width: "thin",
		opacity: .22
	};
}
/**
* Pro chart (F7 Tier A): chart types + scales, indicator catalog, drawing
* tools with undo/redo, compare overlay, event overlays, alerts, bar replay,
* extended-hours shading, PNG/CSV export and per-layout persistence.
*/
function ProChart(props) {
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
	const containerRef = (0, import_react.useRef)(null);
	const chart = useProChart(containerRef, theme, market);
	const fmt = (0, import_react.useCallback)((p) => formatChartPrice(p, market, rawBars[rawBars.length - 1]?.close), [market, rawBars]);
	const [vp, setVp] = (0, import_react.useState)(DEFAULT_VP);
	const [vpHydrated, setVpHydrated] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const saved = readVpPrefs();
		if (saved) setVp(saved);
		else if (window.matchMedia("(max-width: 767px)").matches) setVp((v) => ({
			...v,
			enabled: false,
			preset: "hide"
		}));
		setVpHydrated(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!vpHydrated) return;
		try {
			window.localStorage.setItem(VP_KEY, JSON.stringify(vp));
		} catch {}
	}, [vp, vpHydrated]);
	const [layout, setLayout] = (0, import_react.useState)(() => defaultLayout(defaultIndicators(market), chartPrefs.chartType, chartPrefs.scale));
	const [history, dispatch] = (0, import_react.useReducer)(drawingReducer, void 0, () => initHistory());
	const [loadedKey, setLoadedKey] = (0, import_react.useState)(null);
	const layoutKey = `${market}:${code}:${intervalKey}`;
	(0, import_react.useEffect)(() => {
		const store = safeStorage();
		const next = (store ? loadChartState(store, market, code, intervalKey) : null) ?? defaultLayout(defaultIndicators(market), chartPrefs.chartType, chartPrefs.scale);
		setLayout(next);
		dispatch({
			type: "reset",
			items: next.drawings
		});
		setLoadedKey(layoutKey);
	}, [layoutKey]);
	(0, import_react.useEffect)(() => {
		if (loadedKey !== layoutKey) return;
		const store = safeStorage();
		if (!store) return;
		const t = setTimeout(() => saveChartState(store, market, code, intervalKey, {
			...layout,
			drawings: history.items
		}), 250);
		return () => clearTimeout(t);
	}, [
		layout,
		history.items,
		loadedKey,
		layoutKey,
		market,
		code,
		intervalKey
	]);
	(0, import_react.useEffect)(() => {
		if (market !== "KR" || interval !== "day" || !rawBars.length || loadedKey !== layoutKey) return;
		const store = safeStorage();
		if (!store) return;
		if (migrateLegacyOnce(store, code, rawBars.map((b) => barTimeOf(b.date, market)), {
			...layout,
			drawings: history.items
		}) > 0) {
			const next = loadChartState(store, market, code, intervalKey);
			if (next) dispatch({
				type: "reset",
				items: next.drawings
			});
		}
	}, [
		rawBars,
		loadedKey,
		layoutKey
	]);
	const replayable = interval === "day" || interval === "week";
	const [replay, setReplay] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!replay?.playing) return;
		const id = setInterval(() => {
			setReplay((r) => {
				if (!r) return r;
				const next = replayStep(r.cursor, rawBars.length);
				return next == null ? {
					...r,
					cursor: rawBars.length - 1,
					playing: false
				} : {
					...r,
					cursor: next
				};
			});
		}, replayTickMs(replay.speed));
		return () => clearInterval(id);
	}, [
		replay?.playing,
		replay?.speed,
		rawBars.length
	]);
	(0, import_react.useEffect)(() => setReplay(null), [layoutKey]);
	const bars = (0, import_react.useMemo)(() => capBars(replaySlice(rawBars, replay ? replay.cursor : null)), [rawBars, replay]);
	const times = (0, import_react.useMemo)(() => bars.map((b) => barTimeOf(b.date, market)), [bars, market]);
	const timeIndex = (0, import_react.useMemo)(() => new Map(times.map((t, i) => [t, i])), [times]);
	const version = `${bars.length}|${bars[0]?.date ?? ""}|${bars[bars.length - 1]?.date ?? ""}|${bars[bars.length - 1]?.close ?? ""}`;
	const catalogBars = (0, import_react.useMemo)(() => ({
		open: bars.map((b) => b.open),
		high: bars.map((b) => b.high),
		low: bars.map((b) => b.low),
		close: bars.map((b) => b.close),
		volume: bars.map((b) => b.volume),
		sessionKeys: interval === "minute" ? bars.map((b) => b.date.slice(0, 10)) : void 0
	}), [bars, interval]);
	const cacheRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const values = (0, import_react.useMemo)(() => {
		const out = /* @__PURE__ */ new Map();
		const cache = cacheRef.current;
		for (const inst of layout.indicators) {
			if (!inst.visible) continue;
			const key = indicatorCacheKey(version, inst);
			let v = cache.get(key);
			if (!v) {
				v = computeInstance(inst, catalogBars, times);
				cache.set(key, v);
				if (cache.size > 200) cache.delete(cache.keys().next().value);
			}
			out.set(inst.uid, v);
		}
		return out;
	}, [
		layout.indicators,
		version,
		catalogBars,
		times
	]);
	const mainRef = (0, import_react.useRef)(null);
	const markersRef = (0, import_react.useRef)(null);
	const drawingPrim = (0, import_react.useRef)(new DrawingPrimitive());
	const sessionPrim = (0, import_react.useRef)(new SessionPrimitive());
	const vpPrim = (0, import_react.useRef)(new VolumeProfilePrimitive());
	const rangePrim = (0, import_react.useRef)(new RangeMarkerPrimitive());
	const [mainEpoch, setMainEpoch] = (0, import_react.useState)(0);
	const compareActive = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		if (!chart) return;
		const type = layout.chartType;
		const common = {
			priceFormat: priceFormatFor(market, rawBars[rawBars.length - 1]?.close),
			priceLineVisible: true,
			lastValueVisible: true
		};
		let s;
		if (type === "line") s = chart.addSeries(ye, {
			...common,
			color: theme.text,
			lineWidth: 2
		});
		else if (type === "area") s = chart.addSeries(qe, {
			...common,
			lineColor: "#38bdf8",
			topColor: "rgba(56,189,248,0.28)",
			bottomColor: "rgba(56,189,248,0.02)"
		});
		else if (type === "baseline") s = chart.addSeries(Ue, {
			...common,
			baseValue: {
				type: "price",
				price: rawBars[0]?.close ?? 0
			},
			topLineColor: upColor,
			bottomLineColor: downColor,
			topFillColor1: `${upColor}33`,
			bottomFillColor2: `${downColor}33`
		});
		else if (type === "bars") s = chart.addSeries(Ze, {
			...common,
			upColor,
			downColor,
			thinBars: false
		});
		else s = chart.addSeries(Qe, {
			...common,
			upColor: type === "hollow" ? "rgba(0,0,0,0)" : upColor,
			downColor,
			borderUpColor: upColor,
			borderDownColor: downColor,
			wickUpColor: upColor,
			wickDownColor: downColor
		});
		mainRef.current = s;
		s.attachPrimitive(sessionPrim.current);
		s.attachPrimitive(vpPrim.current);
		s.attachPrimitive(drawingPrim.current);
		s.attachPrimitive(rangePrim.current);
		markersRef.current = Nr(s, []);
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
			} catch {}
			mainRef.current = null;
		};
	}, [
		chart,
		layout.chartType,
		upColor,
		downColor,
		market
	]);
	(0, import_react.useEffect)(() => {
		const s = mainRef.current;
		if (!s) return;
		const type = layout.chartType;
		const src = type === "heikin-ashi" ? heikinAshi(bars) : bars;
		if (type === "line" || type === "area" || type === "baseline") s.setData(src.map((b, i) => ({
			time: times[i],
			value: b.close
		})));
		else s.setData(src.map((b, i) => ({
			time: times[i],
			open: b.open,
			high: b.high,
			low: b.low,
			close: b.close
		})));
	}, [
		mainEpoch,
		bars,
		times,
		layout.chartType
	]);
	const fittedKey = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!chart || !rawBars.length) return;
		const key = `${layoutKey}|${props.range ?? ""}|${props.minuteSize ?? ""}`;
		if (fittedKey.current === key) return;
		fittedKey.current = key;
		const n = rawBars.length;
		chart.timeScale().setVisibleLogicalRange({
			from: Math.max(0, n - (interval === "minute" ? 160 : 180)),
			to: n + 4
		});
	}, [
		chart,
		rawBars.length,
		layoutKey,
		props.range,
		props.minuteSize,
		interval
	]);
	const [compare, setCompare] = (0, import_react.useState)([]);
	const [compareBars, setCompareBars] = (0, import_react.useState)({});
	const onCompareBars = (0, import_react.useCallback)((sym, b) => setCompareBars((m) => m[sym] === b ? m : {
		...m,
		[sym]: b
	}), []);
	const compareSeries = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	(0, import_react.useEffect)(() => {
		if (!chart) return;
		const map = compareSeries.current;
		for (const [sym, s] of map) if (!compare.includes(sym)) {
			chart.removeSeries(s);
			map.delete(sym);
		}
		compare.forEach((sym, i) => {
			let s = map.get(sym);
			if (!s) {
				s = chart.addSeries(ye, {
					color: COMPARE_COLORS[i % 3],
					lineWidth: 2,
					priceLineVisible: false,
					lastValueVisible: true,
					title: sym.split(":")[1]
				});
				map.set(sym, s);
			}
			const other = (compareBars[sym] ?? []).map((b) => ({
				time: barTimeOf(b.date, sym.startsWith("US") ? "US" : "KR"),
				close: b.close
			}));
			const aligned = alignByTime(times, other);
			s.setData(times.map((t, j) => aligned[j] == null ? { time: t } : {
				time: t,
				value: aligned[j]
			}));
		});
		compareActive.current = compare.length > 0;
	}, [
		chart,
		compare,
		compareBars,
		times,
		mainEpoch
	]);
	(0, import_react.useEffect)(() => {
		if (!chart) return;
		chart.priceScale("right").applyOptions({ mode: compare.length ? bi.Percentage : SCALE_MODE[layout.scale] });
	}, [
		chart,
		layout.scale,
		compare.length,
		mainEpoch
	]);
	const indSeries = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const pivotLines = (0, import_react.useRef)([]);
	const structureKey = JSON.stringify(layout.indicators.map((i) => [
		i.uid,
		i.id,
		i.visible,
		i.color,
		i.params
	]));
	(0, import_react.useEffect)(() => {
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
			const color = inst.color ?? PALETTE[idx % PALETTE.length];
			const series = /* @__PURE__ */ new Map();
			const lines = [];
			def.outputs.forEach((o, oi) => {
				const c = oi === 0 ? color : o.key === "signal" || o.key === "d" || o.key === "minusDi" ? "#f97316" : o.key === "plusDi" ? "#22c55e" : o.key === "lower" || o.key === "p10" || o.key === "low" ? color : `${color}`;
				let s;
				if (o.style === "histogram") s = chart.addSeries(nr, {
					priceLineVisible: false,
					lastValueVisible: false,
					priceFormat: inst.id === "volume" ? { type: "volume" } : {
						type: "price",
						precision: 2,
						minMove: .01
					}
				}, paneIndex);
				else s = chart.addSeries(ye, {
					color: o.style === "dots" ? color : oi === 0 ? c : def.outputs.length > 2 && oi === 1 ? `${color}` : c,
					lineWidth: 1,
					lineStyle: def.id === "ichimoku" && (o.key === "spanA" || o.key === "spanB") ? h.Dotted : h.Solid,
					lineVisible: o.style !== "dots",
					pointMarkersVisible: o.style === "dots",
					pointMarkersRadius: 1.5,
					priceLineVisible: false,
					lastValueVisible: def.pane === "separate",
					crosshairMarkerVisible: false,
					priceFormat: def.pane === "overlay" ? priceFormatFor(market, rawBars[rawBars.length - 1]?.close) : {
						type: "price",
						precision: 2,
						minMove: .01
					}
				}, paneIndex);
				for (const lv of o.levels ?? []) lines.push(s.createPriceLine({
					price: lv,
					color: "rgba(148,163,184,0.5)",
					lineWidth: 1,
					lineStyle: h.Dashed,
					axisLabelVisible: true,
					title: ""
				}));
				series.set(o.key, s);
			});
			store.set(inst.uid, {
				series,
				lines
			});
		});
		const panes = chart.panes();
		panes[0]?.setStretchFactor(Math.max(3, panes.length));
		for (let i = 1; i < panes.length; i++) panes[i]?.setStretchFactor(1);
		setIndEpoch((e) => e + 1);
	}, [
		chart,
		structureKey,
		market
	]);
	const [indEpoch, setIndEpoch] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		for (const inst of layout.indicators) {
			const entry = indSeries.current.get(inst.uid);
			const v = values.get(inst.uid);
			if (!entry || !v) continue;
			for (const [key, s] of entry.series) {
				const arr = v[key] ?? [];
				if (inst.id === "volume" && key === "v") s.setData(bars.map((b, i) => ({
					time: times[i],
					value: b.volume,
					color: b.close >= b.open ? `${upColor}88` : `${downColor}88`
				})));
				else if (key === "hist") s.setData(times.map((t, i) => {
					const x = arr[i];
					return x == null ? { time: t } : {
						time: t,
						value: x,
						color: x >= 0 ? `${upColor}99` : `${downColor}99`
					};
				}));
				else s.setData(times.map((t, i) => {
					const x = arr[i];
					return x == null ? { time: t } : {
						time: t,
						value: x
					};
				}));
			}
		}
	}, [
		values,
		indEpoch,
		bars,
		times,
		layout.indicators,
		upColor,
		downColor
	]);
	const [visible, setVisible] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const s = mainRef.current;
		if (!s) return;
		for (const l of pivotLines.current) s.removePriceLine(l);
		pivotLines.current = [];
		const piv = layout.indicators.find((i) => i.id === "pivots" && i.visible);
		const prev = bars[bars.length - 2];
		if (piv && prev) {
			const lv = pivotPoints(prev.high, prev.low, prev.close, String(piv.params.kind));
			for (const [k, p] of Object.entries(lv)) pivotLines.current.push(s.createPriceLine({
				price: p,
				color: k === "p" ? "#f59e0b" : k.startsWith("r") ? "#ef444499" : "#3b82f699",
				lineWidth: 1,
				lineStyle: h.Dashed,
				axisLabelVisible: false,
				title: k.toUpperCase()
			}));
		}
	}, [
		mainEpoch,
		layout.indicators,
		bars
	]);
	(0, import_react.useEffect)(() => {
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
		const profile = volumeProfile(slice, builtin ? vp.rows : Number(catalog?.params.rows ?? 24), builtin ? .7 : Number(catalog?.params.va ?? .7), builtin ? vp.basis : "volume");
		const ratio = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? Math.min(VP_WIDTH[vp.width], .08) : VP_WIDTH[vp.width];
		vpPrim.current.set(profile);
		vpPrim.current.setStyle({
			widthRatio: builtin ? ratio : .1,
			opacity: builtin ? vp.opacity : .22,
			showVa: builtin ? vp.showVa : true,
			showPoc: builtin ? vp.showPoc : true,
			hoverPrice: null
		});
	}, [
		layout.indicators,
		bars,
		visible,
		vp,
		mainEpoch
	]);
	const onVisibleRangeRef = (0, import_react.useRef)(props.onVisibleRange);
	onVisibleRangeRef.current = props.onVisibleRange;
	(0, import_react.useEffect)(() => {
		if (!chart) return;
		const h = (r) => {
			setVisible(r ? {
				from: r.from,
				to: r.to
			} : null);
			onVisibleRangeRef.current?.(r ? {
				from: r.from,
				to: r.to
			} : null);
		};
		chart.timeScale().subscribeVisibleLogicalRangeChange(h);
		return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(h);
	}, [chart]);
	(0, import_react.useEffect)(() => {
		if (!chart || !props.sync || !mainRef.current) return;
		return props.sync.register(props.syncId ?? layoutKey, chart, mainRef.current, (t) => {
			const idx = t == null ? void 0 : stateRef.current.timeIndex.get(t);
			setHoverIdx(idx ?? null);
		});
	}, [
		chart,
		props.sync,
		props.syncId,
		layoutKey,
		mainEpoch
	]);
	(0, import_react.useEffect)(() => {
		if (interval !== "minute") return sessionPrim.current.set([], []);
		const tb = times.map((t) => ({ time: t }));
		sessionPrim.current.set(extendedHoursRuns(tb, market), sessionBreaks(tb, market));
	}, [
		times,
		interval,
		market,
		mainEpoch
	]);
	const overlays = layout.overlays;
	const newsFeed = useFeed({
		region: market,
		tickers: [code],
		limit: 100,
		enabled: overlays.news,
		refetchMs: 18e4
	});
	const newsByBar = (0, import_react.useMemo)(() => {
		const m = /* @__PURE__ */ new Map();
		if (!overlays.news) return m;
		const dayIdx = /* @__PURE__ */ new Map();
		for (const t of times) {
			const d = dayOfTime(t, market);
			if (!dayIdx.has(d) || interval !== "minute") dayIdx.set(d, t);
		}
		for (const it of newsFeed.items) {
			if (!it.publishedAt) continue;
			const day = market === "US" ? dayOfTime(Math.floor(Date.parse(it.publishedAt) / 1e3), "US") : kstDayKey(it.publishedAt);
			const t = day ? dayIdx.get(day) : void 0;
			if (t === void 0) continue;
			m.set(t, [...m.get(t) ?? [], it]);
		}
		return m;
	}, [
		overlays.news,
		newsFeed.items,
		times,
		market,
		interval
	]);
	const [newsList, setNewsList] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const api = markersRef.current;
		if (!api) return;
		const out = [];
		const has = (t) => timeIndex.has(t);
		if (overlays.disclosures) {
			for (const e of props.disclosureMarkers ?? []) if (has(e.time)) out.push({
				time: e.time,
				position: "aboveBar",
				color: "#f59e0b",
				shape: "circle",
				text: "공시"
			});
		}
		if (overlays.signals) {
			for (const m of props.signalMarkers ?? []) if (has(m.time)) out.push({
				time: m.time,
				position: m.position ?? "aboveBar",
				color: m.color ?? "#a78bfa",
				shape: m.shape ?? "circle",
				text: m.text
			});
		}
		if (overlays.research) {
			for (const m of props.researchMarkers ?? []) if (has(m.time)) out.push({
				time: m.time,
				position: m.position ?? "belowBar",
				color: m.color ?? "#2dd4bf",
				shape: m.shape ?? "square",
				text: m.text
			});
		}
		if (overlays.dividends) {
			for (const d of props.events?.dividends ?? []) if (has(d.date)) out.push({
				time: d.date,
				position: "belowBar",
				color: "#22c55e",
				shape: "circle",
				text: `배당 $${d.amount}`
			});
			for (const d of props.events?.splits ?? []) if (has(d.date)) out.push({
				time: d.date,
				position: "belowBar",
				color: "#eab308",
				shape: "square",
				text: `분할 ${d.ratio}`
			});
		}
		if (overlays.news) for (const [t, items] of newsByBar) out.push({
			time: t,
			position: "aboveBar",
			color: "#38bdf8",
			shape: "circle",
			text: `뉴스 ${items.length}`
		});
		out.sort((a, b) => (timeIndex.get(a.time) ?? 0) - (timeIndex.get(b.time) ?? 0));
		api.setMarkers(out);
	}, [
		overlays,
		props.disclosureMarkers,
		props.signalMarkers,
		props.researchMarkers,
		props.events,
		newsByBar,
		timeIndex,
		mainEpoch
	]);
	const [tool, setTool] = (0, import_react.useState)("cursor");
	const [magnet, setMagnet] = (0, import_react.useState)(true);
	const [pending, setPending] = (0, import_react.useState)([]);
	const [preview, setPreview] = (0, import_react.useState)(null);
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [dragging, setDragging] = (0, import_react.useState)(null);
	const [hoverIdx, setHoverIdx] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const price = hoverIdx != null ? bars[hoverIdx]?.close ?? null : null;
		vpPrim.current.setStyle({ hoverPrice: price });
	}, [
		hoverIdx,
		bars,
		mainEpoch
	]);
	const [pendingAvwap, setPendingAvwap] = (0, import_react.useState)(null);
	const shown = (0, import_react.useMemo)(() => dragging ? history.items.map((d) => d.id === dragging.id ? dragging : d) : history.items, [history.items, dragging]);
	(0, import_react.useEffect)(() => {
		const p = drawingPrim.current;
		p.formatPrice = fmt;
		p.barsBetween = (a, b) => {
			const i = timeIndex.get(a);
			const j = timeIndex.get(b);
			return i == null || j == null ? null : Math.abs(j - i);
		};
		p.set(shown, selected, preview);
	}, [
		shown,
		selected,
		preview,
		fmt,
		timeIndex,
		mainEpoch
	]);
	const toolRef = (0, import_react.useRef)(tool);
	toolRef.current = tool;
	const stateRef = (0, import_react.useRef)({
		pending,
		magnet,
		bars,
		times,
		timeIndex,
		history,
		selected,
		newsByBar,
		pendingAvwap
	});
	stateRef.current = {
		pending,
		magnet,
		bars,
		times,
		timeIndex,
		history,
		selected,
		newsByBar,
		pendingAvwap
	};
	const anchorAt = (0, import_react.useCallback)((x, y, t) => {
		const s = mainRef.current;
		if (!s || !chart) return null;
		const st = stateRef.current;
		let time = t;
		if (time === void 0) {
			const lg = chart.timeScale().coordinateToLogical(x);
			if (lg == null) return null;
			time = st.times[Math.max(0, Math.min(st.times.length - 1, Math.round(lg)))];
		}
		if (time === void 0) return null;
		const raw = s.coordinateToPrice(y);
		if (raw == null) return null;
		const idx = st.timeIndex.get(time);
		const bar = idx != null ? st.bars[idx] : void 0;
		return {
			t: time,
			p: snapPrice(raw, {
				market,
				instrument: props.instrument,
				magnet: st.magnet,
				bar
			})
		};
	}, [
		chart,
		market,
		props.instrument
	]);
	(0, import_react.useEffect)(() => {
		if (!chart) return;
		const onMove = (param) => {
			const st = stateRef.current;
			const idx = param.time != null ? st.timeIndex.get(param.time) : void 0;
			setHoverIdx(idx ?? null);
			props.onHover?.(idx != null ? st.bars[idx] : null);
			const cur = toolRef.current;
			if (cur === "cursor" || cur === "replay-pick" || cur === "avwap-anchor" || !param.point || !st.pending.length) return;
			const a = anchorAt(param.point.x, param.point.y, param.time);
			if (a) setPreview(newDrawing(cur, [...st.pending, a], "preview"));
		};
		chart.subscribeCrosshairMove(onMove);
		return () => {
			chart.unsubscribeCrosshairMove(onMove);
		};
	}, [chart, anchorAt]);
	/**
	* Tap/click handling from DOM pointer events: lightweight-charts swallows a
	* second click inside its double-click window, which breaks quick two-point
	* drawing. A press that moves < 5 px is a click.
	*/
	const handleClick = (0, import_react.useCallback)((x, y) => {
		const st = stateRef.current;
		const cur = toolRef.current;
		const a = anchorAt(x, y, void 0);
		if (cur === "replay-pick") {
			const idx = a ? st.timeIndex.get(a.t) : void 0;
			if (idx != null) setReplay({
				cursor: idx,
				playing: false,
				speed: 1
			});
			setTool("cursor");
			return;
		}
		if (cur === "avwap-anchor") {
			if (a && st.pendingAvwap) {
				const at = a.t;
				setLayout((l) => ({
					...l,
					indicators: l.indicators.map((i) => i.uid === st.pendingAvwap ? {
						...i,
						anchorTime: at
					} : i)
				}));
			}
			setPendingAvwap(null);
			setTool("cursor");
			return;
		}
		if (cur === "cursor") {
			const hit = drawingPrim.current.hit(x, y);
			if (hit) return setSelected(hit.id);
			setSelected(null);
			if (a && st.newsByBar.has(a.t)) setNewsList(st.newsByBar.get(a.t));
			return;
		}
		if (!a) return;
		const next = [...st.pending, a];
		if (next.length >= anchorsFor(cur)) {
			const d = newDrawing(cur, next, uid());
			dispatch({
				type: "add",
				drawing: d
			});
			setSelected(d.id);
			setPending([]);
			setPreview(null);
			setTool("cursor");
		} else setPending(next);
	}, [anchorAt]);
	(0, import_react.useEffect)(() => {
		const el = containerRef.current;
		if (!el || !chart) return;
		let drag = null;
		let press = null;
		const local = (e) => {
			const r = el.getBoundingClientRect();
			return {
				x: e.clientX - r.left,
				y: e.clientY - r.top
			};
		};
		const down = (e) => {
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
			const a = anchorAt(x, y, void 0);
			if (!a) return;
			drag = {
				id: d.id,
				handle: hit.handle,
				start: a,
				orig: d
			};
			setSelected(d.id);
			chart.applyOptions({
				handleScroll: false,
				handleScale: false
			});
			el.setPointerCapture(e.pointerId);
			e.preventDefault();
		};
		const move = (e) => {
			if (!drag) return;
			const { x, y } = local(e);
			const a = anchorAt(x, y, void 0);
			if (!a) return;
			const st = stateRef.current;
			let anchors;
			if (drag.handle != null) anchors = drag.orig.anchors.map((p, i) => i === drag.handle ? a : p);
			else {
				const di = (st.timeIndex.get(a.t) ?? 0) - (st.timeIndex.get(drag.start.t) ?? 0);
				const dp = a.p - drag.start.p;
				anchors = drag.orig.anchors.map((p) => {
					const i = st.timeIndex.get(p.t);
					return {
						t: i == null ? p.t : st.times[Math.max(0, Math.min(st.times.length - 1, i + di))],
						p: p.p + dp
					};
				});
			}
			setDragging({
				...drag.orig,
				anchors
			});
		};
		const up = (e) => {
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
			chart.applyOptions({
				handleScroll: {
					mouseWheel: true,
					pressedMouseMove: true,
					horzTouchDrag: true,
					vertTouchDrag: false
				},
				handleScale: true
			});
			try {
				el.releasePointerCapture(e.pointerId);
			} catch {}
			setDragging((cur) => {
				if (cur && cur.id === id && moved) dispatch({
					type: "update",
					id,
					patch: { anchors: cur.anchors }
				});
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
	}, [
		chart,
		anchorAt,
		handleClick
	]);
	const cancelTool = () => {
		setTool("cursor");
		setPending([]);
		setPreview(null);
	};
	const onKeyDown = (e) => {
		const mod = e.metaKey || e.ctrlKey;
		if (mod && e.key.toLowerCase() === "z") {
			e.preventDefault();
			dispatch({ type: e.shiftKey ? "redo" : "undo" });
			return;
		}
		if (e.key === "Escape") return cancelTool();
		if ((e.key === "Delete" || e.key === "Backspace") && selected) {
			e.preventDefault();
			dispatch({
				type: "remove",
				id: selected
			});
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
	const myAlerts = (0, import_react.useMemo)(() => priceAlerts.filter((a) => a.market === market && a.code.toUpperCase() === code.toUpperCase()), [
		priceAlerts,
		market,
		code
	]);
	const lastBar = rawBars[rawBars.length - 1];
	(0, import_react.useEffect)(() => {
		if (!lastBar || replay) return;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const closes = rawBars.map((b) => b.close);
		for (const a of myAlerts) {
			if (!a.active) continue;
			if (a.kind === "price-cross") {
				const r = evaluatePriceAlert(a, lastBar.close, now);
				if (r.next !== a && (r.fired || r.next.lastSide !== a.lastSide)) upsertPriceAlert(r.next);
				if (r.fired) notifyAlert(`${props.name ?? code} ${fmt(a.level)} ${r.direction === "up" ? "상향" : "하향"} 돌파`, `현재 ${fmt(lastBar.close)} · ${props.source}`);
			} else {
				const r = evaluateIndicatorAlert(a, a.kind === "rsi-cross" ? {
					rsi: rsi(closes, 14).slice(-2),
					barKey: lastBar.date
				} : {
					fast: sma(closes, a.fast ?? 20).slice(-2),
					slow: sma(closes, a.slow ?? 60).slice(-2),
					barKey: lastBar.date
				}, now);
				if (r.fired) {
					upsertPriceAlert(r.next);
					notifyAlert(`${props.name ?? code} ${a.kind === "rsi-cross" ? `RSI ${a.level}` : `이평 ${a.fast}/${a.slow}`} ${r.direction === "up" ? "상향" : "하향"} 교차`, `${lastBar.date} · ${props.source}`);
				}
			}
		}
	}, [
		lastBar?.date,
		lastBar?.close,
		myAlerts.length
	]);
	const toggleHlineAlert = (d) => {
		if (d.alertId) {
			removePriceAlert(d.alertId);
			dispatch({
				type: "update",
				id: d.id,
				patch: { alertId: void 0 }
			});
			return;
		}
		const price = d.anchors[0].p;
		const cur = lastBar?.close;
		const alert = {
			id: `pa-${uid()}`,
			market,
			code: code.toUpperCase(),
			name: props.name,
			kind: "price-cross",
			level: price,
			direction: cur == null ? "any" : cur < price ? "up" : "down",
			repeat: "once",
			active: true,
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			lastSide: cur == null ? void 0 : cur >= price ? "above" : "below"
		};
		upsertPriceAlert(alert);
		dispatch({
			type: "update",
			id: d.id,
			patch: { alertId: alert.id }
		});
	};
	const [panel, setPanel] = (0, import_react.useState)(null);
	const [compareInput, setCompareInput] = (0, import_react.useState)("");
	const setType = (t) => {
		setLayout((l) => ({
			...l,
			chartType: t
		}));
		setChartPrefs({ chartType: t });
	};
	const setScale = (s) => {
		setLayout((l) => ({
			...l,
			scale: s
		}));
		setChartPrefs({ scale: s });
	};
	const addIndicator = (def) => {
		const inst = newInstance(def.id, void 0, PALETTE[layout.indicators.length % PALETTE.length]);
		setLayout((l) => ({
			...l,
			indicators: [...l.indicators, inst]
		}));
		if (def.anchored) {
			setPendingAvwap(inst.uid);
			setTool("avwap-anchor");
			setPanel(null);
		}
	};
	const addCompare = () => {
		const raw = compareInput.trim().toUpperCase();
		const sym = /^[0-9][0-9A-Z]{5}$/.test(raw) ? `KR:${raw}` : /^[A-Z][A-Z0-9.]{0,9}$/.test(raw) ? `US:${raw}` : null;
		if (sym && !compare.includes(sym) && compare.length < 3 && sym !== `${market}:${code.toUpperCase()}`) setCompare((c) => [...c, sym]);
		setCompareInput("");
	};
	const templates = Object.keys(chartPrefs.templates ?? {});
	const exportPng = () => {
		if (!chart) return;
		downloadCanvasPng(chart.takeScreenshot(true, false), chartExportName(market, code, intervalKey, "png", Date.now()));
	};
	const exportCsv = () => {
		const w = visibleWindow(bars.length, visible);
		const rows = bars.slice(w.from, w.to + 1).map((b, i) => ({
			time: times[w.from + i],
			open: b.open,
			high: b.high,
			low: b.low,
			close: b.close,
			volume: b.volume
		}));
		const extra = [];
		for (const inst of layout.indicators) {
			const v = values.get(inst.uid);
			const def = INDICATOR_BY_ID.get(inst.id);
			if (!v || !def || inst.id === "volume") continue;
			for (const o of def.outputs) extra.push({
				name: `${instanceLabel(inst)}${def.outputs.length > 1 ? `.${o.key}` : ""}`,
				values: (v[o.key] ?? []).slice(w.from, w.to + 1)
			});
		}
		downloadCsv(barsToCsv(rows, extra), chartExportName(market, code, intervalKey, "csv", Date.now()));
	};
	const hi = hoverIdx ?? bars.length - 1;
	const hb = bars[hi];
	const prevClose = hi > 0 ? bars[hi - 1]?.close : void 0;
	const legend = [...layout.indicators.map((inst) => {
		const def = INDICATOR_BY_ID.get(inst.id);
		const v = values.get(inst.uid);
		const first = def?.outputs[0]?.key;
		const val = first && v ? v[first]?.[hi] : null;
		return {
			id: inst.uid,
			label: instanceLabel(inst),
			color: inst.color,
			value: val != null ? def?.pane === "overlay" ? fmt(val) : inst.id === "volume" ? formatChartVolume(val, market) : val.toFixed(2) : null,
			visible: inst.visible,
			onToggle: () => setLayout((l) => ({
				...l,
				indicators: l.indicators.map((i) => i.uid === inst.uid ? {
					...i,
					visible: !i.visible
				} : i)
			}))
		};
	}), ...compare.map((sym, i) => {
		const other = (compareBars[sym] ?? []).map((b) => ({
			time: barTimeOf(b.date, sym.startsWith("US") ? "US" : "KR"),
			close: b.close
		}));
		const aligned = alignByTime(times, other);
		const w = visibleWindow(times.length, visible);
		const last = [...percentFromFirstVisible(aligned, w.from).slice(0, w.to + 1)].reverse().find((x) => x != null);
		return {
			id: `cmp-${sym}`,
			label: `비교 ${sym.split(":")[1]}`,
			color: COMPARE_COLORS[i % 3],
			value: compareBars[sym] == null ? "수신 중" : compareBars[sym].length === 0 ? "데이터 없음" : last != null ? formatChartPercent(last) : "—",
			visible: true,
			onToggle: () => setCompare((c) => c.filter((x) => x !== sym))
		};
	})];
	const rangeStats = (0, import_react.useMemo)(() => {
		if (bars.length < 2) return null;
		const w = visibleWindow(bars.length, visible);
		const close = bars[bars.length - 1]?.close;
		return computeRangePosition(bars.map((b) => ({
			high: b.high,
			low: b.low,
			close: b.close,
			date: b.date
		})), {
			from: w.from,
			to: w.to,
			close,
			recentSpan: vp.recentSpan
		});
	}, [
		bars,
		visible,
		vp.recentSpan
	]);
	(0, import_react.useEffect)(() => {
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
			return [{
				time,
				price: p.price,
				role: p.role,
				place: copy.place,
				title: copy.title,
				pctText: copy.pctText,
				color: p.role === "high" ? downColor : upColor
			}];
		});
		prim.set(marks, lastTime, lastPrice);
	}, [
		vp.rangeOn,
		rangeStats,
		times,
		bars,
		fmt,
		upColor,
		downColor,
		mainEpoch
	]);
	const vpProfile = (0, import_react.useMemo)(() => {
		if (!vp.enabled || bars.length < 30) return null;
		const w = visibleWindow(bars.length, visible);
		const slice = vp.visibleOnly ? bars.slice(w.from, w.to + 1) : bars;
		if (slice.length < 30) return null;
		return volumeProfile(slice, vp.rows, .7, vp.basis);
	}, [
		vp.enabled,
		vp.visibleOnly,
		vp.rows,
		vp.basis,
		bars,
		visible
	]);
	const hud = hb ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center gap-x-2 tabular",
		"data-testid": "chart-ohlc",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-muted-foreground",
				children: hb.date
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["O ", fmt(hb.open)] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["H ", fmt(hb.high)] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["L ", fmt(hb.low)] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				style: { color: hb.close >= hb.open ? upColor : downColor },
				children: ["C ", fmt(hb.close)]
			}),
			prevClose ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				style: { color: hb.close >= prevClose ? upColor : downColor },
				children: formatChartPercent((hb.close - prevClose) / prevClose * 100)
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-muted-foreground",
				children: ["V ", formatChartVolume(hb.volume, market)]
			}),
			rangeStats ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RangeHud, {
				stats: rangeStats,
				up: upColor,
				down: downColor
			}) : null,
			vpProfile?.poc != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-muted-foreground",
				children: [
					"POC ",
					fmt(vpProfile.poc),
					vpProfile.val != null && vpProfile.vah != null ? ` · VA ${fmt(vpProfile.val)}–${fmt(vpProfile.vah)}` : "",
					vp.basis === "turnover" ? " · 거래대금" : " · 거래량"
				]
			}),
			replay && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "rounded bg-amber-500/15 px-1 font-semibold text-amber-500",
				children: [
					"리플레이 ",
					replay.cursor + 1,
					"/",
					rawBars.length
				]
			})
		]
	}) : null;
	const btn = (on) => cn("inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-[11px] font-medium", on ? "bg-desk-gold/20 text-desk-gold ring-1 ring-desk-gold/40" : "bg-muted text-muted-foreground hover:text-foreground");
	const toolbar = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
			value: layout.chartType,
			onChange: (e) => setType(e.target.value),
			className: "h-8 rounded-md border border-border bg-background px-1.5 text-[11px]",
			"aria-label": "차트 종류",
			"data-testid": "chart-type",
			children: CHART_TYPES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: t.id,
				children: t.label
			}, t.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
			value: compare.length ? "percent" : layout.scale,
			onChange: (e) => setScale(e.target.value),
			disabled: compare.length > 0,
			className: "h-8 rounded-md border border-border bg-background px-1.5 text-[11px]",
			"aria-label": "스케일",
			title: compare.length ? "비교 중에는 첫 보이는 봉 대비 %" : void 0,
			children: CHART_SCALES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: s.id,
				children: s.label
			}, s.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: btn(false),
			onClick: () => setPanel("indicators"),
			"data-testid": "open-indicators",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrainCircuit, { className: "size-3.5" }), " 지표"]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mx-0.5 h-5 w-px bg-border" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: btn(tool === "cursor"),
			onClick: cancelTool,
			title: "선택 (Esc)",
			"aria-label": "선택 도구",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MousePointer2, { className: "size-3.5" })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
			value: tool !== "cursor" && tool !== "replay-pick" && tool !== "avwap-anchor" ? tool : "",
			onChange: (e) => {
				setTool(e.target.value || "cursor");
				setPending([]);
				setPreview(null);
			},
			className: "h-8 rounded-md border border-border bg-background px-1.5 text-[11px]",
			"aria-label": "그리기 도구",
			"data-testid": "drawing-tool",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: "",
				children: "그리기…"
			}), DRAWING_TOOLS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
				value: t.type,
				children: [
					t.label,
					" (",
					t.key.toUpperCase(),
					")"
				]
			}, t.type))]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: btn(magnet),
			onClick: () => setMagnet((v) => !v),
			title: "자석 (OHLC 스냅)",
			"aria-pressed": magnet,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Magnet, { className: "size-3.5" }), " 자석"]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: btn(false),
			onClick: () => dispatch({ type: "undo" }),
			disabled: !history.past.length,
			title: "실행 취소 (Ctrl/⌘+Z)",
			"aria-label": "실행 취소",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo2, { className: "size-3.5" })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: btn(false),
			onClick: () => dispatch({ type: "redo" }),
			disabled: !history.future.length,
			title: "다시 실행 (Shift+Ctrl/⌘+Z)",
			"aria-label": "다시 실행",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Redo2, { className: "size-3.5" })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: btn(false),
			onClick: () => setPanel("objects"),
			"data-testid": "open-objects",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListTree, { className: "size-3.5" }),
				" 그리기 ",
				history.items.length
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: btn(vp.rangeOn),
			onClick: () => setVp((v) => ({
				...v,
				rangeOn: !v.rangeOn
			})),
			"aria-pressed": vp.rangeOn,
			title: "차트 본체 고저점",
			children: "고저"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
			value: vp.recentSpan,
			onChange: (e) => setVp((v) => ({
				...v,
				recentSpan: e.target.value
			})),
			className: "h-8 rounded-md border border-border bg-background px-1.5 text-[11px]",
			"aria-label": "최근 고저 창",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "3M",
					children: "최근 3M"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "6M",
					children: "최근 6M"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "52W",
					children: "최근 52W"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "all",
					children: "최근=전체"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "swing",
					children: "최근 스윙"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
			className: "relative",
			"data-testid": "vp-menu",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
				className: cn(btn(vp.enabled), "cursor-pointer list-none"),
				children: ["매물대 ", vp.enabled ? "ON" : "OFF"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute left-0 top-9 z-30 flex w-56 flex-col gap-1.5 rounded-md border border-border bg-card p-2 text-[11px] shadow-lg",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-1",
						children: [
							"hide",
							"ref",
							"emph"
						].map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: btn(vp.preset === p),
							onClick: () => setVp((v) => applyVpPreset(p, v)),
							children: p === "hide" ? "숨김" : p === "ref" ? "참고" : "강조"
						}, p))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center justify-between gap-2",
						children: ["빈", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							value: vp.rows,
							onChange: (e) => setVp((v) => ({
								...v,
								rows: Number(e.target.value)
							})),
							className: "h-7 rounded border border-border bg-background px-1",
							"aria-label": "매물대 빈 개수",
							children: [
								16,
								24,
								32,
								48
							].map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: n,
								children: n
							}, n))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center justify-between gap-2",
						children: ["값", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: vp.basis,
							onChange: (e) => setVp((v) => ({
								...v,
								basis: e.target.value
							})),
							className: "h-7 rounded border border-border bg-background px-1",
							"aria-label": "매물대 기준",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "volume",
								children: "거래량"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "turnover",
								children: "거래대금"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center justify-between gap-2",
						children: ["폭", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: vp.width,
							onChange: (e) => setVp((v) => ({
								...v,
								width: e.target.value,
								preset: "ref",
								enabled: true
							})),
							className: "h-7 rounded border border-border bg-background px-1",
							"aria-label": "매물대 폭",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "thin",
									children: "얇게"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "mid",
									children: "보통"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "wide",
									children: "넓게"
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2",
						children: ["투명도", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "range",
							min: .12,
							max: .4,
							step: .02,
							value: vp.opacity,
							onChange: (e) => setVp((v) => ({
								...v,
								opacity: Number(e.target.value),
								enabled: true,
								preset: v.preset === "hide" ? "ref" : v.preset
							})),
							"aria-label": "매물대 투명도",
							className: "w-full"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: vp.showVa,
							onChange: () => setVp((v) => ({
								...v,
								showVa: !v.showVa
							})),
							className: "size-3.5 accent-primary"
						}), "밸류영역"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: vp.showPoc,
							onChange: () => setVp((v) => ({
								...v,
								showPoc: !v.showPoc
							})),
							className: "size-3.5 accent-primary"
						}), "POC 점선"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: vp.visibleOnly,
							onChange: () => setVp((v) => ({
								...v,
								visibleOnly: !v.visibleOnly
							})),
							className: "size-3.5 accent-primary"
						}), "화면구간만 (고급)"]
					}),
					bars.length < 30 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground",
						children: "30봉 미만이라 매물대를 숨깁니다."
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mx-0.5 h-5 w-px bg-border" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "flex items-center gap-1",
			onSubmit: (e) => {
				e.preventDefault();
				addCompare();
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: compareInput,
				onChange: (e) => setCompareInput(e.target.value),
				placeholder: "비교: 005930 / NVDA",
				className: "h-8 w-32 text-[11px]",
				"aria-label": "비교 종목",
				disabled: compare.length >= 3
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "submit",
				className: btn(false),
				disabled: compare.length >= 3,
				children: "비교"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mx-0.5 h-5 w-px bg-border" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
			className: "relative",
			"data-testid": "overlay-menu",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
				className: cn(btn(Object.values(overlays).some(Boolean)), "cursor-pointer list-none"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "size-3.5" }),
					" 오버레이 ",
					Object.values(overlays).filter(Boolean).length
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute left-0 top-9 z-30 flex w-44 flex-col gap-1 rounded-md border border-border bg-card p-1.5 shadow-lg",
				children: [
					"disclosures",
					"news",
					"research",
					"dividends",
					"signals"
				].map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex min-h-9 cursor-pointer items-center gap-2 rounded px-1.5 text-[11px] hover:bg-muted",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: overlays[k],
						onChange: () => setLayout((l) => ({
							...l,
							overlays: {
								...l.overlays,
								[k]: !l.overlays[k]
							}
						})),
						className: "size-3.5 accent-primary"
					}), {
						disclosures: "공시",
						news: "뉴스 (봉별 건수)",
						research: "리서치 목표가",
						dividends: "배당·분할 (미국)",
						signals: "RSI 다이버전스·MACD 교차"
					}[k]]
				}, k))
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: btn(myAlerts.length > 0),
			onClick: () => setPanel("alerts"),
			"data-testid": "open-alerts",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-3.5" }),
				" 알림 ",
				myAlerts.length || ""
			]
		}),
		replayable && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: btn(Boolean(replay) || tool === "replay-pick"),
			onClick: () => replay ? setReplay(null) : setTool("replay-pick"),
			"data-testid": "replay-toggle",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rewind, { className: "size-3.5" }),
				" ",
				replay ? "리플레이 종료" : "리플레이"
			]
		}),
		props.prePost && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: btn(props.prePost.on),
			"aria-pressed": props.prePost.on,
			onClick: props.prePost.toggle,
			title: "미국 프리·애프터마켓 봉 포함",
			children: "시간외"
		})
	] });
	const hasData = rawBars.length > 0;
	const sepPanes = layout.indicators.filter((i) => i.visible && INDICATOR_BY_ID.get(i.id)?.pane === "separate" && INDICATOR_BY_ID.get(i.id)?.render === "series").length;
	const shellHeight = typeof props.height === "number" ? props.height + Math.max(0, sepPanes - 1) * 88 : props.height ?? 480;
	const status = hasData ? {
		source: props.source,
		mode: props.modeLabel,
		updatedAt: props.updatedAt,
		note: `${rawBars.length.toLocaleString("ko-KR")}봉${rawBars.length > 1e4 ? " (최근 10,000봉)" : ""}`
	} : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ChartShell, {
			title: props.name ? `${props.name} · ${code}` : code,
			toolbarExtra: props.toolbarExtra,
			toolbar,
			hud,
			legend: [...legend, ...vp.enabled && bars.length < 30 ? [{
				id: "vp-short",
				label: "매물대: 30봉 미만",
				value: "기간을 늘리면 표시",
				visible: true,
				color: "#94a3b8"
			}] : []],
			status,
			onExportPng: hasData ? exportPng : void 0,
			onExportCsv: hasData ? exportCsv : void 0,
			onFullscreen: props.onFullscreen,
			onKeyDown,
			height: shellHeight,
			testId: props.testId ?? "pro-chart",
			collapseToolbar: props.compact,
			footer: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RangePositionStrip, {
				stats: rangeStats,
				compact: props.compact,
				formatValue: fmt,
				caption: vp.recentSpan === "swing" ? "보이는 구간 기준. 최근 고점·저점은 오른쪽이 확정된 스윙입니다. 같으면 기간=최근." : `보이는 구간 기준. 최근 고저 창은 ${vp.recentSpan === "all" ? "구간 전체" : vp.recentSpan}입니다. 기간 극값과 같으면 기간=최근.`
			}),
			shortcuts: [
				...DRAWING_TOOLS.map((t) => ({
					keys: t.key.toUpperCase(),
					label: t.label
				})),
				{
					keys: "Esc",
					label: "도구 취소"
				},
				{
					keys: "Delete",
					label: "선택한 그림 삭제"
				},
				{
					keys: "Ctrl/⌘+Z",
					label: "실행 취소"
				},
				{
					keys: "Shift+Ctrl/⌘+Z",
					label: "다시 실행"
				}
			],
			children: [
				!hasData && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-4 text-center text-sm text-muted-foreground",
					"data-testid": "chart-empty",
					children: props.loading ? "차트 데이터 수신 중…" : props.error ? "차트 데이터를 불러오지 못했습니다. 데이터를 채워 넣지 않습니다." : "표시할 봉이 없습니다."
				}),
				(tool !== "cursor" || pending.length > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "pointer-events-none absolute left-2 top-2 z-30 rounded-md bg-amber-500/15 px-2 py-1 text-[11px] text-amber-500",
					"data-testid": "tool-hint",
					children: tool === "replay-pick" ? "리플레이 시작 봉을 클릭하세요" : tool === "avwap-anchor" ? "앵커드 VWAP 기준 봉을 클릭하세요" : `${DRAWING_TOOLS.find((t) => t.type === tool)?.label ?? ""}: 점 ${pending.length + 1}/${tool !== "cursor" ? anchorsFor(tool) : 0} 클릭 · Esc 취소`
				}),
				replay && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-card/95 px-2 py-1 shadow",
					"data-testid": "replay-bar",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "inline-flex size-9 items-center justify-center rounded hover:bg-muted",
							onClick: () => setReplay((r) => r ? {
								...r,
								playing: !r.playing
							} : r),
							"aria-label": replay.playing ? "일시정지" : "재생",
							children: replay.playing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "inline-flex size-9 items-center justify-center rounded hover:bg-muted",
							onClick: () => setReplay((r) => r ? {
								...r,
								cursor: replayStep(r.cursor, rawBars.length) ?? rawBars.length - 1
							} : r),
							"aria-label": "한 봉 앞으로",
							"data-testid": "replay-step",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkipForward, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							value: replay.speed,
							onChange: (e) => setReplay((r) => r ? {
								...r,
								speed: Number(e.target.value)
							} : r),
							className: "h-9 rounded-md border border-border bg-background px-1 text-xs",
							"aria-label": "속도",
							children: REPLAY_SPEEDS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value: s,
								children: [s, "×"]
							}, s))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "inline-flex size-9 items-center justify-center rounded hover:bg-muted",
							onClick: () => setReplay(null),
							"aria-label": "리플레이 종료",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: containerRef,
					className: "absolute inset-0 isolate",
					style: {
						cursor: tool === "cursor" ? "crosshair" : "cell",
						touchAction: "pan-y"
					},
					"data-testid": "chart-canvas"
				})
			]
		}),
		compare.map((sym) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompareLoader, {
			sym,
			interval,
			minuteSize: props.minuteSize,
			range: props.range,
			onBars: onCompareBars
		}, sym)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IndicatorPanel, {
			open: panel === "indicators",
			onOpenChange: (v) => setPanel(v ? "indicators" : null),
			instances: layout.indicators,
			onAdd: addIndicator,
			onChange: (id, patch) => setLayout((l) => ({
				...l,
				indicators: l.indicators.map((i) => i.uid === id ? {
					...i,
					...patch
				} : i)
			})),
			onRemove: (id) => setLayout((l) => ({
				...l,
				indicators: l.indicators.filter((i) => i.uid !== id)
			})),
			templates,
			onSaveTemplate: (name) => setChartPrefs({ templates: {
				...chartPrefs.templates ?? {},
				[name]: {
					indicators: layout.indicators,
					chartType: layout.chartType,
					scale: layout.scale,
					savedAt: (/* @__PURE__ */ new Date()).toISOString()
				}
			} }),
			onApplyTemplate: (name) => {
				const t = chartPrefs.templates?.[name];
				if (!t) return;
				setLayout((l) => ({
					...l,
					indicators: t.indicators.map((i) => ({
						...i,
						uid: `${i.id}-${uid()}`
					})),
					chartType: t.chartType ?? l.chartType,
					scale: t.scale ?? l.scale
				}));
			},
			onDeleteTemplate: (name) => {
				const next = { ...chartPrefs.templates ?? {} };
				delete next[name];
				setChartPrefs({ templates: next });
			}
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ObjectManager, {
			open: panel === "objects",
			onOpenChange: (v) => setPanel(v ? "objects" : null),
			drawings: history.items,
			selectedId: selected,
			onSelect: setSelected,
			onUpdate: (id, patch) => dispatch({
				type: "update",
				id,
				patch
			}),
			onRemove: (id) => dispatch({
				type: "remove",
				id
			}),
			onToggleAlert: toggleHlineAlert,
			formatPrice: fmt
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertsPanel, {
			open: panel === "alerts",
			onOpenChange: (v) => setPanel(v ? "alerts" : null),
			alerts: myAlerts,
			onAddRsi: () => {
				const base = {
					market,
					code: code.toUpperCase(),
					name: props.name,
					direction: "any",
					repeat: "every",
					active: true,
					createdAt: (/* @__PURE__ */ new Date()).toISOString()
				};
				upsertPriceAlert({
					...base,
					id: `rsi70-${uid()}`,
					kind: "rsi-cross",
					level: 70
				});
				upsertPriceAlert({
					...base,
					id: `rsi30-${uid()}`,
					kind: "rsi-cross",
					level: 30
				});
			},
			onAddMa: () => upsertPriceAlert({
				id: `ma-${uid()}`,
				market,
				code: code.toUpperCase(),
				name: props.name,
				kind: "ma-cross",
				fast: 20,
				slow: 60,
				direction: "any",
				repeat: "every",
				active: true,
				createdAt: (/* @__PURE__ */ new Date()).toISOString()
			}),
			onRemove: removePriceAlert
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
			open: newsList != null,
			onOpenChange: (v) => !v && setNewsList(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
				side: "right",
				className: "w-full max-w-lg overflow-y-auto p-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, {
					className: "border-b border-border",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetTitle, { children: [
						"이 봉의 뉴스 (",
						newsList?.length ?? 0,
						")"
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetDescription, { children: "피드에서 이 종목으로 태그된 기사 · 최신순" })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "p-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedList, {
						items: newsList ?? [],
						emptyReason: "기사가 없습니다."
					})
				})]
			})
		})
	] });
}
//#endregion
export { barTimeOf as n, ProChart as t };
