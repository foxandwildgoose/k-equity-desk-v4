import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { b as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { c as fairPriceFromEvMultiple, g as resliceValuation, l as fairPriceFromPer } from "./research-taxonomy-BpoDpMeG.mjs";
import { z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { I as useValuationSeries, Pt as cn, xt as formatUsd, y as useChartData, yt as formatPrice } from "./router-B1V8nj-n.mjs";
import { c as h, f as ye, l as le, s as bi, t as K, u as nr } from "../_libs/lightweight-charts.mjs";
import { E as computeSeriesRangePosition, O as detectMacdCrosses, at as readChartTheme, f as StreetTapeRow, ft as sma, gt as streetTape, k as detectRsiDivergences, l as RangePositionStrip, n as ChartAnalyticsStrip, nt as proChartOptions, o as MacdCrossStrip, r as ChartShell, rt as quantSnapshot, t as BandCompareStrip, u as RsiDivergenceStrip, w as compareBollingerAndPercentile } from "./tools-Cb8-otqN.mjs";
import { n as barTimeOf, t as ProChart } from "./ProChart-DdFCAGcv.mjs";
import { i as exportRowsCsv, r as exportChartPng } from "./chrome-CFMydwn4.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/TradingChart-BNzBrxV_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CHART_VIEWS = [
	{
		id: "price",
		label: "가격",
		tip: "캔들 · 거래량 · 이평 · 고점/저점 대비"
	},
	{
		id: "per",
		label: "PER",
		tip: "후행 PER = 수정주가 ÷ TTM 또는 직전 결산 EPS"
	},
	{
		id: "fwdPer",
		label: "선행 PER",
		tip: "수정주가 ÷ 최신 컨센서스 EPS"
	},
	{
		id: "evEbitda",
		label: "EV/EBITDA",
		tip: "기업가치 ÷ EBITDA"
	},
	{
		id: "evSales",
		label: "EV/Sales",
		tip: "기업가치 ÷ 매출과 가격 밴드"
	},
	{
		id: "band",
		label: "밴드·백분위",
		tip: "평균 ±1σ ±2σ와 구간 백분위"
	}
];
var TITLES = {
	per: "후행 PER",
	fwdPer: "선행 PER",
	evEbitda: "EV/EBITDA",
	evSales: "EV/Sales",
	band: "밸류에이션 밴드"
};
var RANGES$1 = [
	{
		id: "1y",
		label: "1년",
		years: 1
	},
	{
		id: "3y",
		label: "3년",
		years: 3
	},
	{
		id: "5y",
		label: "5년",
		years: 5
	},
	{
		id: "10y",
		label: "10년",
		years: 10
	},
	{
		id: "max",
		label: "최대",
		years: null
	}
];
function fmtMult(n) {
	if (n == null || !Number.isFinite(n)) return "—";
	const d = Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2;
	return `${n.toFixed(d)}배`;
}
function fmtPctile(n) {
	if (n == null || !Number.isFinite(n)) return "—";
	return `${n.toFixed(0)}%ile`;
}
function fmtQuote(n, currency) {
	if (!Number.isFinite(n)) return "—";
	if (currency === "USD") return n >= 1e3 ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${n.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	})}`;
	return formatPrice(n);
}
function zoneOf(percentile) {
	if (percentile == null) return {
		text: "백분위 없음",
		tone: "text-muted-foreground"
	};
	if (percentile <= 10) return {
		text: "역사적 하단",
		tone: "text-desk-teal"
	};
	if (percentile <= 30) return {
		text: "하위 구간",
		tone: "text-desk-teal"
	};
	if (percentile >= 90) return {
		text: "역사적 상단",
		tone: "text-desk-rose"
	};
	if (percentile >= 70) return {
		text: "상위 구간",
		tone: "text-desk-rose"
	};
	return {
		text: "중간 구간",
		tone: "text-desk-gold"
	};
}
function cutoff(to, range) {
	const years = RANGES$1.find((r) => r.id === range)?.years;
	if (!to || years == null) return null;
	const d = /* @__PURE__ */ new Date(`${to}T00:00:00Z`);
	if (Number.isNaN(d.getTime())) return null;
	d.setUTCFullYear(d.getUTCFullYear() - years);
	return d.toISOString().slice(0, 10);
}
function finiteLine(rows) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const row of rows) {
		const date = row.date.slice(0, 10);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || seen.has(date)) continue;
		if (row.value == null || !Number.isFinite(row.value)) continue;
		seen.add(date);
		out.push({
			time: date,
			value: row.value
		});
	}
	return out;
}
function ChartViewBar({ view, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center gap-1 border-b border-border px-2.5 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
			children: "보기"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-wrap gap-0.5 rounded-md bg-muted p-0.5",
			children: CHART_VIEWS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				title: item.tip,
				onClick: () => onChange(item.id),
				className: cn("rounded px-2.5 py-1 text-xs font-semibold min-h-8", view === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
				children: item.label
			}, item.id))
		})]
	});
}
function ValuationHistoryChart({ code, mode }) {
	if (mode === "price") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WeeklyPriceChart, { code });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MultipleChart, {
		code,
		mode
	});
}
function WeeklyPriceChart({ code }) {
	const q = useValuationSeries(code, true);
	const [range, setRange] = (0, import_react.useState)("5y");
	const [fault, setFault] = (0, import_react.useState)(null);
	const [api, setApi] = (0, import_react.useState)(null);
	const wrapRef = (0, import_react.useRef)(null);
	const view = (0, import_react.useMemo)(() => {
		const pack = q.data;
		if (!pack) return null;
		return resliceValuation(pack, cutoff(pack.window.to, range));
	}, [q.data, range]);
	const points = view?.drivers.filter((row) => row.price > 0) ?? [];
	(0, import_react.useEffect)(() => {
		const el = wrapRef.current;
		if (!el || points.length < 2 || !view) return;
		let chart = null;
		try {
			chart = le(el, {
				...proChartOptions(readChartTheme(), view.currency === "USD" ? "US" : "KR"),
				localization: { locale: "ko-KR" },
				crosshair: { mode: K.Normal },
				timeScale: { timeVisible: false }
			});
			chart.addSeries(ye, {
				color: "#e2e8f0",
				lineWidth: 2,
				priceLineVisible: false,
				title: "수정주가",
				priceFormat: {
					type: "custom",
					minMove: .01,
					formatter: (v) => fmtQuote(v, view.currency)
				}
			}).setData(finiteLine(points.map((p) => ({
				date: p.date,
				value: p.price
			}))));
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
			live.remove();
		};
	}, [
		view,
		points.length,
		range
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "bg-card",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-sm font-semibold",
				children: [view?.name ? `${view.name} · ` : "", "수정주가 · 주봉"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-muted-foreground",
				children: "Yahoo 수정종가. 국내 종목의 분·일 캔들과 드로잉은 가격 차트를 그대로 둡니다."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex gap-0.5 rounded-md bg-muted p-0.5",
				children: RANGES$1.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setRange(item.id),
					className: cn("rounded px-2 py-1 text-[11px] font-semibold min-h-8", range === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"),
					children: item.label
				}, item.id))
			})]
		}), q.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex h-80 items-center justify-center text-sm text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 size-4 animate-spin" }), " 주가 불러오는 중…"]
		}) : fault ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-4 py-16 text-center text-sm text-price-down",
			children: fault
		}) : points.length < 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-4 py-16 text-center text-sm text-muted-foreground",
			children: view?.note ?? "주가 시계열이 없습니다."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartShell, {
			title: "수정주가 · 주봉",
			status: {
				source: view?.source ? `Yahoo 수정종가 · ${view.source}` : "Yahoo 수정종가",
				mode: `주봉 · ${view?.currency ?? ""}`,
				asOfLabel: view?.window.to ?? null
			},
			onExportPng: () => exportChartPng(api, view?.currency === "USD" ? "US" : "KR", code, "weekly-price"),
			onExportCsv: () => exportRowsCsv(api, points.map((p) => ({
				time: p.date.slice(0, 10),
				price: p.price
			})), [{
				name: "adj_close",
				get: (r) => r.price
			}], view?.currency === "USD" ? "US" : "KR", code, "weekly-price"),
			height: 520,
			testId: "weekly-price-chart",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: wrapRef,
				className: "absolute inset-0"
			})
		})]
	});
}
function MultipleChart({ code, mode }) {
	const q = useValuationSeries(code, true);
	const [range, setRange] = (0, import_react.useState)("5y");
	const [fault, setFault] = (0, import_react.useState)(null);
	const [hover, setHover] = (0, import_react.useState)(null);
	const [showAvg, setShowAvg] = (0, import_react.useState)(true);
	const [logScale, setLogScale] = (0, import_react.useState)(false);
	const [api, setApi] = (0, import_react.useState)(null);
	const wrapRef = (0, import_react.useRef)(null);
	const view = (0, import_react.useMemo)(() => {
		const pack = q.data;
		if (!pack) return null;
		return resliceValuation(pack, cutoff(pack.window.to, range));
	}, [q.data, range]);
	const active = view ? mode === "per" ? view.per : mode === "fwdPer" ? view.forwardPer : mode === "evEbitda" ? view.evEbitda : mode === "band" ? null : view.evSales : null;
	const stats = mode === "band" ? view?.valuationBand.stats : active?.stats;
	const zone = zoneOf(stats?.percentile ?? null);
	const z = stats?.current != null && stats.mean != null && stats.sigma != null && stats.sigma > 0 ? (stats.current - stats.mean) / stats.sigma : null;
	const layout = mode === "evSales" || mode === "band" ? "price" : "multiple";
	const defined = mode === "band" ? view?.valuationBand.points.filter((p) => p.price != null).length ?? 0 : active?.stats.n ?? 0;
	const plotted = (0, import_react.useMemo)(() => {
		if (!view) return [];
		if (layout === "price") return (mode === "band" ? view.valuationBand.points : view.evSales.priceBands).filter((p) => p.price != null && p.price > 0).map((p) => ({
			date: p.date,
			value: p.price
		}));
		return (active?.points ?? []).filter((p) => p.value != null && p.value > 0).map((p) => ({
			date: p.date,
			value: p.value
		}));
	}, [
		view,
		mode,
		layout,
		active
	]);
	const multiplePlotted = (0, import_react.useMemo)(() => {
		if (!view || layout !== "price") return [];
		return (mode === "band" ? view.valuationBand.basis === "evSales" ? view.evSales : view.per : view.evSales).points.filter((p) => p.value != null && p.value > 0).map((p) => ({
			date: p.date,
			value: p.value
		}));
	}, [
		view,
		mode,
		layout
	]);
	const rangeStats = (0, import_react.useMemo)(() => computeSeriesRangePosition(plotted), [plotted]);
	const multipleStats = (0, import_react.useMemo)(() => multiplePlotted.length >= 2 ? computeSeriesRangePosition(multiplePlotted) : null, [multiplePlotted]);
	const tape = (0, import_react.useMemo)(() => streetTape(plotted.map((p) => ({
		high: p.value,
		low: p.value,
		close: p.value,
		date: p.date
	})), { lookback: 52 }), [plotted]);
	const valueFmt = (n) => layout === "price" && view ? fmtQuote(n, view.currency) : fmtMult(n);
	(0, import_react.useEffect)(() => {
		setFault(null);
		setHover(null);
	}, [
		code,
		mode,
		range
	]);
	(0, import_react.useEffect)(() => {
		const el = wrapRef.current;
		if (!el || !view || defined < 2 || fault) return;
		let chart = null;
		try {
			chart = le(el, {
				...proChartOptions(readChartTheme(), view.currency === "USD" ? "US" : "KR"),
				localization: { locale: "ko-KR" },
				crosshair: {
					mode: K.Normal,
					vertLine: {
						color: "rgba(148,163,184,0.45)",
						labelBackgroundColor: "#0f172a"
					},
					horzLine: {
						color: "rgba(148,163,184,0.45)",
						labelBackgroundColor: "#0f172a"
					}
				},
				rightPriceScale: {
					borderColor: "rgba(148,163,184,0.18)",
					mode: logScale ? bi.Logarithmic : bi.Normal
				},
				timeScale: {
					borderColor: "rgba(148,163,184,0.18)",
					rightOffset: 6,
					timeVisible: false
				}
			});
			const quote = (v) => fmtQuote(v, view.currency);
			const multFmt = (v) => v.toFixed(Math.abs(v) >= 10 ? 1 : 2);
			const lookup = /* @__PURE__ */ new Map();
			const addAverages = (rows, formatter) => {
				if (!showAvg || rows.length < 20) return;
				const values = rows.map((row) => row.value);
				for (const spec of [{
					period: 20,
					color: "#a78bfa",
					title: "20주"
				}, {
					period: 60,
					color: "#38bdf8",
					title: "60주"
				}]) {
					const avg = sma(values, spec.period);
					const data = finiteLine(rows.map((row, i) => ({
						date: row.date,
						value: avg[i] ?? null
					})));
					if (data.length < 2) continue;
					chart.addSeries(ye, {
						color: spec.color,
						lineWidth: 1,
						priceLineVisible: false,
						lastValueVisible: false,
						crosshairMarkerVisible: false,
						title: spec.title,
						priceFormat: {
							type: "custom",
							minMove: .01,
							formatter
						}
					}).setData(data);
				}
			};
			if (layout === "multiple" && active) {
				const line = chart.addSeries(ye, {
					color: "#22d3ee",
					lineWidth: 2,
					priceLineVisible: false,
					lastValueVisible: true,
					title: TITLES[mode],
					priceFormat: {
						type: "custom",
						minMove: .01,
						formatter: multFmt
					}
				});
				const data = finiteLine(active.points.map((p) => ({
					date: p.date,
					value: p.value
				})));
				line.setData(data);
				for (const row of data) lookup.set(String(row.time), [{
					label: TITLES[mode],
					value: fmtMult(row.value)
				}]);
				addLevelLines(line, active);
				addAverages(data.map((row) => ({
					date: String(row.time),
					value: row.value
				})), multFmt);
				try {
					chart.addSeries(nr, {
						color: "#fbbf24",
						priceScaleId: "pct",
						priceLineVisible: false,
						lastValueVisible: false,
						priceFormat: {
							type: "custom",
							minMove: 1,
							formatter: (v) => `${v.toFixed(0)}`
						}
					}, 1).setData(finiteLine(active.points.map((p) => ({
						date: p.date,
						value: p.percentile
					}))).map((row) => ({
						...row,
						color: row.value >= 80 ? "#fb7185" : row.value <= 20 ? "#2dd4bf" : "#fbbf24"
					})));
					chart.panes()[1]?.setHeight(92);
					chart.priceScale("pct", 1).applyOptions({
						scaleMargins: {
							top: .15,
							bottom: .15
						},
						borderVisible: false
					});
				} catch {}
			} else if (layout === "price" && view) {
				const bands = mode === "band" ? view.valuationBand.points : view.evSales.priceBands;
				const price = chart.addSeries(ye, {
					color: "#e2e8f0",
					lineWidth: 2,
					priceLineVisible: false,
					lastValueVisible: true,
					title: "주가",
					priceFormat: {
						type: "custom",
						minMove: .01,
						formatter: quote
					}
				});
				const priceRows = finiteLine(bands.map((p) => ({
					date: p.date,
					value: p.price
				})));
				price.setData(priceRows);
				addAverages(priceRows.map((row) => ({
					date: String(row.time),
					value: row.value
				})), quote);
				const specs = [
					{
						key: "mean",
						color: "#facc15",
						title: "평균",
						style: h.Solid
					},
					{
						key: "p1",
						color: "#fb7185",
						title: "+1σ",
						style: h.Dashed
					},
					{
						key: "m1",
						color: "#c084fc",
						title: "−1σ",
						style: h.Dashed
					},
					{
						key: "p2",
						color: "#e11d48",
						title: "+2σ",
						style: h.Dotted
					},
					{
						key: "m2",
						color: "#8b5cf6",
						title: "−2σ",
						style: h.Dotted
					}
				];
				for (const spec of specs) {
					const rows = finiteLine(bands.map((p) => ({
						date: p.date,
						value: typeof p[spec.key] === "number" ? p[spec.key] : null
					}))).filter((row) => row.value > 0);
					if (rows.length < 2) continue;
					chart.addSeries(ye, {
						color: spec.color,
						lineWidth: 1,
						lineStyle: spec.style,
						priceLineVisible: false,
						lastValueVisible: false,
						crosshairMarkerVisible: false,
						title: spec.title,
						priceFormat: {
							type: "custom",
							minMove: .01,
							formatter: quote
						}
					}).setData(rows);
				}
				const pctStats = mode === "evSales" ? view.evSales.stats : view.valuationBand.stats;
				const useEv = mode === "evSales" || view.valuationBand.basis === "evSales";
				for (const spec of [
					{
						key: "p10",
						color: "#2dd4bf",
						title: "p10"
					},
					{
						key: "p50",
						color: "#38bdf8",
						title: "p50"
					},
					{
						key: "p90",
						color: "#fb7185",
						title: "p90"
					}
				]) {
					const mult = pctStats[spec.key];
					if (mult == null || !(mult > 0)) continue;
					const rows = finiteLine(view.drivers.map((row) => ({
						date: row.date,
						value: useEv ? fairPriceFromEvMultiple(row.salesEok, mult, row.netDebtEok, row.shares) : fairPriceFromPer(row.eps, mult)
					}))).filter((row) => row.value > 0);
					if (rows.length < 2) continue;
					chart.addSeries(ye, {
						color: spec.color,
						lineWidth: 1,
						lineStyle: spec.key === "p50" ? h.Solid : h.Dashed,
						priceLineVisible: false,
						lastValueVisible: false,
						crosshairMarkerVisible: false,
						title: spec.title,
						priceFormat: {
							type: "custom",
							minMove: .01,
							formatter: quote
						}
					}).setData(rows);
				}
				for (const p of bands) {
					if (p.price == null) continue;
					const rows = [{
						label: "주가",
						value: quote(p.price)
					}];
					for (const spec of specs) {
						const v = p[spec.key];
						if (typeof v === "number" && v > 0) rows.push({
							label: spec.title,
							value: quote(v)
						});
					}
					lookup.set(p.date, rows);
				}
				if (mode === "evSales") try {
					const mult = chart.addSeries(ye, {
						color: "#22d3ee",
						lineWidth: 2,
						priceScaleId: "mult",
						priceLineVisible: false,
						lastValueVisible: true,
						title: "EV/Sales",
						priceFormat: {
							type: "custom",
							minMove: .01,
							formatter: multFmt
						}
					}, 1);
					mult.setData(finiteLine(view.evSales.points.map((p) => ({
						date: p.date,
						value: p.value
					}))));
					addLevelLines(mult, view.evSales);
					chart.panes()[1]?.setHeight(120);
				} catch {}
				else try {
					chart.addSeries(nr, {
						color: "#fbbf24",
						priceScaleId: "pct",
						priceLineVisible: false,
						lastValueVisible: false,
						priceFormat: {
							type: "custom",
							minMove: 1,
							formatter: (v) => `${v.toFixed(0)}`
						}
					}, 1).setData(finiteLine(view.valuationBand.percentilePoints.map((p) => ({
						date: p.date,
						value: p.percentile
					}))).map((row) => ({
						...row,
						color: row.value >= 80 ? "#fb7185" : row.value <= 20 ? "#2dd4bf" : "#fbbf24"
					})));
					chart.panes()[1]?.setHeight(92);
				} catch {}
			}
			chart.subscribeCrosshairMove((param) => {
				const t = param.time ? String(param.time) : "";
				const rows = t ? lookup.get(t) : void 0;
				if (!t || !rows) {
					setHover(null);
					return;
				}
				setHover({
					date: t,
					rows
				});
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
			live.remove();
		};
	}, [
		view,
		mode,
		layout,
		defined,
		fault,
		active,
		showAvg,
		logScale
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "bg-card",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-wrap items-start justify-between gap-3 border-b border-border px-3 py-2.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-baseline gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "text-sm font-semibold",
						children: [view?.name ? `${view.name} · ` : "", TITLES[mode]]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("text-xs font-semibold", zone.tone),
						children: zone.text
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground",
					children: mode === "band" ? view?.valuationBand.basisLabel : active?.basis
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setShowAvg((v) => !v),
						className: cn("rounded px-2 py-1 text-[11px] font-semibold min-h-8", showAvg ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"),
						children: "20·60주"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setLogScale((v) => !v),
						className: cn("rounded px-2 py-1 text-[11px] font-semibold min-h-8", logScale ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"),
						children: "Log"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-0.5 rounded-md bg-muted p-0.5",
						children: RANGES$1.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setRange(item.id),
							className: cn("rounded px-2 py-1 text-[11px] font-semibold min-h-8", range === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"),
							children: item.label
						}, item.id))
					})
				]
			})]
		}), q.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex h-80 items-center justify-center text-sm text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 size-4 animate-spin" }), " 투자지표 불러오는 중…"]
		}) : q.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-4 py-16 text-center text-sm text-price-down",
			children: "지표 서버가 응답하지 않았습니다. 배수를 만들지 않았습니다."
		}) : fault ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-4 py-16 text-center text-sm text-price-down",
			children: fault
		}) : defined < 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "px-4 py-14 text-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium",
				children: "이 보기로 그릴 시계열이 없습니다"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mx-auto mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground",
				children: emptyReason(mode, view)
			})]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-2 border-b border-border px-3 py-2 sm:grid-cols-4 lg:grid-cols-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "현재",
						value: fmtMult(stats?.current)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "평균",
						value: fmtMult(stats?.mean)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "σ",
						value: stats?.sigma != null ? stats.sigma.toFixed(2) : "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Z",
						value: z != null ? `${z >= 0 ? "+" : ""}${z.toFixed(2)}` : "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: mode === "fwdPer" ? "경로 순위" : "백분위",
						value: fmtPctile(stats?.percentile)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "+1σ / −1σ",
						value: `${fmtMult(positive(stats?.p1))} / ${fmtMult(positive(stats?.m1))}`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "+2σ / −2σ",
						value: `${fmtMult(positive(stats?.p2))} / ${fmtMult(positive(stats?.m2))}`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "표본",
						value: stats?.n ? `${stats.n}주` : "—"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "border-b border-border px-3 py-1 text-[10px] text-muted-foreground tabular",
				children: [
					"백분위 밴드 p10 ",
					fmtMult(positive(stats?.p10)),
					" · p50 ",
					fmtMult(positive(stats?.p50)),
					" · p90",
					" ",
					fmtMult(positive(stats?.p90)),
					layout === "price" ? " · 당시 실적에 투영한 가격선" : " · 배수 눈금의 가로선"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RangePositionStrip, {
				stats: rangeStats,
				compact: true,
				formatValue: valueFmt,
				caption: layout === "price" ? "선택한 구간의 주가 고점·저점 대비. 줌이 아니라 기간 버튼 기준입니다." : "선택한 구간의 배수 고점·저점 대비. 가격 차트와 같은 위치 지표입니다."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ChartShell, {
				title: TITLES[mode],
				status: {
					source: view?.source ? `${view.source} · Yahoo 수정주가` : "네이버 기업정보 · Yahoo",
					mode: `주간 · ${layout === "price" ? `가격(${view?.currency})` : "배수"}`,
					asOfLabel: view?.window.to ?? null
				},
				onExportPng: () => exportChartPng(api, view?.currency === "USD" ? "US" : "KR", code, `valuation-${mode}`),
				onExportCsv: () => exportRowsCsv(api, plotted.map((p) => ({
					time: p.date.slice(0, 10),
					value: p.value,
					mult: multiplePlotted.find((m) => m.date === p.date)?.value ?? null
				})), [{
					name: layout === "price" ? "price" : mode,
					get: (r) => r.value
				}, ...multiplePlotted.length ? [{
					name: "multiple",
					get: (r) => r.mult
				}] : []], view?.currency === "USD" ? "US" : "KR", code, `valuation-${mode}`),
				height: 520,
				testId: "valuation-history-chart",
				children: [hover && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pointer-events-none absolute left-3 top-2 z-10 rounded-md border border-border bg-background/90 px-2 py-1.5 text-[11px] shadow-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-semibold tabular",
						children: hover.date
					}), hover.rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-between gap-4 tabular text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-foreground",
							children: row.value
						})]
					}, row.label))]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: wrapRef,
					className: "absolute inset-0"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StreetTapeRow, {
				tape,
				formatValue: valueFmt,
				fastLabel: "50주",
				slowLabel: "200주"
			}),
			multipleStats ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RangePositionStrip, {
				stats: multipleStats,
				compact: true,
				formatValue: fmtMult,
				caption: mode === "band" ? "밴드 기준 배수의 고점·저점 대비" : "EV/Sales 배수의 고점·저점 대비"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "border-t border-border px-3 py-2 text-[10px] leading-relaxed text-muted-foreground",
				children: [
					view?.window.from,
					" – ",
					view?.window.to,
					view?.currency === "USD" ? " · USD" : " · KRW",
					" · ",
					"통계와 σ 밴드는 위 구간만 사용. 음수 σ 가격은 그리지 않음. ",
					view?.note,
					" ",
					view?.sourceUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: view.sourceUrl,
						target: "_blank",
						rel: "noreferrer",
						className: "underline",
						children: "원문"
					}) : null
				]
			})
		] })]
	});
}
function positive(n) {
	return n != null && n > 0 ? n : null;
}
function emptyReason(mode, view) {
	if (!view) return "재무 또는 주가가 없습니다.";
	if (mode === "fwdPer" && !view.consensus) return "최신 컨센서스 EPS를 확인하지 못했습니다. 과거 컨센서스를 지어내지 않으므로 선행 PER은 비워 둡니다. " + view.note;
	if (mode === "evEbitda") return "EV/EBITDA는 영업이익과 감가상각이 둘 다 있고, 부채와 현금이 공시에 있을 때만 그립니다. 하나라도 없으면 배수를 만들지 않습니다. " + view.note;
	if (mode === "evSales") return "EV/Sales는 매출과 시가총액, 그리고 공시된 순차입금이 있을 때만 그립니다. " + view.note;
	return view.note;
}
function Stat({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[10px] text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "truncate text-sm font-semibold tabular",
			children: value
		})]
	});
}
function addLevelLines(series, data) {
	const levels = [
		{
			value: positive(data.stats.mean),
			color: "#facc15",
			title: "평균",
			style: h.Solid
		},
		{
			value: positive(data.stats.p1),
			color: "#fb7185",
			title: "+1σ",
			style: h.Dashed
		},
		{
			value: positive(data.stats.m1),
			color: "#c084fc",
			title: "−1σ",
			style: h.Dashed
		},
		{
			value: positive(data.stats.p2),
			color: "#e11d48",
			title: "+2σ",
			style: h.Dotted
		},
		{
			value: positive(data.stats.m2),
			color: "#8b5cf6",
			title: "−2σ",
			style: h.Dotted
		},
		{
			value: positive(data.stats.p10),
			color: "#2dd4bf",
			title: "p10",
			style: h.Dashed
		},
		{
			value: positive(data.stats.p50),
			color: "#38bdf8",
			title: "p50",
			style: h.Solid
		},
		{
			value: positive(data.stats.p90),
			color: "#fb7185",
			title: "p90",
			style: h.Dashed
		}
	];
	for (const level of levels) {
		if (level.value == null) continue;
		series.createPriceLine({
			price: level.value,
			color: level.color,
			lineWidth: 1,
			lineStyle: level.style,
			axisLabelVisible: true,
			title: level.title
		});
	}
}
var INTERVALS = [
	{
		id: "minute",
		label: "분"
	},
	{
		id: "day",
		label: "일"
	},
	{
		id: "week",
		label: "주"
	},
	{
		id: "month",
		label: "월"
	},
	{
		id: "year",
		label: "년"
	}
];
var MINUTE_SIZES = [
	1,
	3,
	5,
	10,
	15,
	30,
	60
];
var RANGES = [
	{
		id: "1mo",
		label: "1M"
	},
	{
		id: "3mo",
		label: "3M"
	},
	{
		id: "6mo",
		label: "6M"
	},
	{
		id: "1y",
		label: "1Y"
	},
	{
		id: "2y",
		label: "2Y"
	},
	{
		id: "5y",
		label: "5Y"
	},
	{
		id: "max",
		label: "MAX"
	}
];
/** Professional minute history windows (Yahoo hard limits). */
function minuteRangesFor(size) {
	if (size <= 1) return [
		{
			id: "1d",
			label: "1일"
		},
		{
			id: "5d",
			label: "5일"
		},
		{
			id: "7d",
			label: "7일"
		}
	];
	if (size === 3) return [
		{
			id: "1d",
			label: "1일"
		},
		{
			id: "5d",
			label: "5일"
		},
		{
			id: "7d",
			label: "7일"
		}
	];
	if (size < 60) return [
		{
			id: "1d",
			label: "1일"
		},
		{
			id: "5d",
			label: "5일"
		},
		{
			id: "1mo",
			label: "1개월"
		},
		{
			id: "60d",
			label: "60일"
		}
	];
	return [
		{
			id: "1mo",
			label: "1개월"
		},
		{
			id: "3mo",
			label: "3개월"
		},
		{
			id: "6mo",
			label: "6개월"
		},
		{
			id: "1y",
			label: "1년"
		},
		{
			id: "2y",
			label: "2년"
		}
	];
}
function defaultMinuteRange(size) {
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
function TradingChart({ code, market, eventMarkers = [], researchMarkers, instrument, name }) {
	const isUs = market === "US";
	const mk = isUs ? "US" : "KR";
	const px = (n) => isUs ? formatUsd(n) : formatPrice(n);
	const navigate = useNavigate();
	const [interval, setInterval] = (0, import_react.useState)("day");
	const [minuteSize, setMinuteSize] = (0, import_react.useState)(5);
	const [range, setRange] = (0, import_react.useState)(isUs ? "5y" : "2y");
	const [prePost, setPrePost] = (0, import_react.useState)(false);
	const [view, setView] = (0, import_react.useState)("price");
	(0, import_react.useEffect)(() => {
		if (interval === "minute") {
			if (!minuteRangesFor(minuteSize).some((o) => o.id === range)) setRange(defaultMinuteRange(minuteSize));
		} else if (!RANGES.some((o) => o.id === range)) setRange("2y");
	}, [interval, minuteSize]);
	const minuteRangeOpts = minuteRangesFor(minuteSize);
	const { data, isLoading, isError, isFetching, dataUpdatedAt } = useChartData({
		code,
		market,
		interval,
		minuteSize,
		range,
		prePost: isUs && interval === "minute" ? prePost : void 0
	});
	const bars = (0, import_react.useMemo)(() => data?.bars ?? [], [data?.bars]);
	const source = data?.source ?? "";
	const street = (0, import_react.useMemo)(() => {
		if (bars.length < 2) return null;
		const lookback = interval === "week" ? 52 : interval === "month" ? 12 : interval === "year" ? bars.length : 252;
		return streetTape(bars.map((b) => ({
			high: b.high,
			low: b.low,
			close: b.close,
			date: b.date,
			volume: b.volume
		})), { lookback });
	}, [bars, interval]);
	const maWord = interval === "week" ? "주" : interval === "month" ? "개월" : interval === "year" ? "년" : interval === "minute" ? "봉" : "일";
	const periodsPerYear = interval === "day" ? 252 : interval === "week" ? 52 : interval === "month" ? 12 : interval === "year" ? 1 : null;
	const pctWindow = interval === "week" ? 52 : interval === "month" ? 24 : interval === "year" ? 10 : 120;
	const analytics = (0, import_react.useMemo)(() => quantSnapshot(bars, periodsPerYear), [bars, periodsPerYear]);
	const bandCompare = (0, import_react.useMemo)(() => compareBollingerAndPercentile(bars.map((b) => b.close), 20, 2, pctWindow), [bars, pctWindow]);
	const divergences = (0, import_react.useMemo)(() => {
		if (bars.length < 30) return [];
		return detectRsiDivergences(bars.map((b) => b.high), bars.map((b) => b.low), bars.map((b) => b.close), {
			rsiPeriod: 14,
			left: 5,
			right: 5,
			maxAge: interval === "minute" ? 80 : 60
		});
	}, [bars, interval]);
	const macdCrosses = (0, import_react.useMemo)(() => detectMacdCrosses(bars.map((b) => b.close), { maxAge: interval === "minute" ? 80 : 40 }), [bars, interval]);
	const signalMarkers = (0, import_react.useMemo)(() => {
		const out = [];
		for (const swing of divergences) {
			const bar = bars[swing.i2];
			if (!bar) continue;
			const bull = swing.kind.endsWith("bullish");
			out.push({
				time: barTimeOf(bar.date, mk),
				position: bull ? "belowBar" : "aboveBar",
				color: bull ? "#2dd4bf" : "#fb7185",
				shape: bull ? "arrowUp" : "arrowDown",
				text: swing.kind.startsWith("hidden") ? bull ? "히든↑" : "히든↓" : bull ? "RSI↑" : "RSI↓"
			});
		}
		for (const cross of macdCrosses) {
			const bar = bars[cross.index];
			if (!bar) continue;
			const golden = cross.kind === "golden";
			out.push({
				time: barTimeOf(bar.date, mk),
				position: golden ? "belowBar" : "aboveBar",
				color: golden ? "#e5b84c" : "#94a3b8",
				shape: golden ? "arrowUp" : "arrowDown",
				text: golden ? "골든" : "데드"
			});
		}
		return out;
	}, [
		divergences,
		macdCrosses,
		bars,
		mk
	]);
	const disclosureMarkers = (0, import_react.useMemo)(() => interval === "minute" ? [] : eventMarkers.map((e) => ({
		time: e.time.slice(0, 10),
		title: e.title
	})).slice(-60), [eventMarkers, interval]);
	const intervalKey = interval === "minute" ? `minute-${minuteSize}` : interval;
	const modeLabel = interval === "minute" ? isUs ? "분봉 · Yahoo 지연 시세" : "분봉 · 비공식 경로(지연 가능)" : isUs ? "Yahoo 분할조정 · 당일 봉 지연" : "일봉 이상 · 당일 봉은 지연·잠정";
	const controls = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center gap-1",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-0.5 rounded-md bg-muted p-0.5",
				role: "group",
				"aria-label": "봉 주기",
				children: INTERVALS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						setInterval(item.id);
						if (item.id === "minute") setRange(defaultMinuteRange(minuteSize));
						else if (item.id === "day") setRange(isUs ? "5y" : "2y");
						else if (item.id === "week") setRange("5y");
						else setRange("max");
					},
					className: cn("min-h-8 rounded px-2 text-xs font-medium", interval === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
					children: item.label
				}, item.id))
			}),
			interval === "minute" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
				value: minuteSize,
				onChange: (e) => {
					const s = Number(e.target.value);
					setMinuteSize(s);
					setRange(defaultMinuteRange(s));
				},
				className: "h-8 rounded-md border border-border bg-background px-1 text-[11px]",
				"aria-label": "분봉 크기",
				children: MINUTE_SIZES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
					value: s,
					children: [s, "분"]
				}, s))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
				value: range,
				onChange: (e) => setRange(e.target.value),
				className: "h-8 rounded-md border border-border bg-background px-1 text-[11px]",
				"aria-label": "기간",
				children: (interval === "minute" ? minuteRangeOpts : RANGES).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: r.id,
					children: r.label
				}, r.id))
			}),
			(isLoading || isFetching) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin text-muted-foreground" })
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "desk-card desk-card-navy overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartViewBar, {
				view,
				onChange: setView
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: view === "price" ? "contents" : "hidden",
				"aria-hidden": view !== "price",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProChart, {
						code: isUs ? code.toUpperCase() : code,
						market: mk,
						instrument,
						name,
						bars,
						interval,
						minuteSize,
						range,
						intervalKey,
						source,
						modeLabel,
						updatedAt: dataUpdatedAt || null,
						loading: isLoading,
						error: isError,
						events: data && "events" in data ? data.events : void 0,
						disclosureMarkers,
						signalMarkers,
						researchMarkers,
						toolbarExtra: controls,
						height: 460,
						onFullscreen: () => void navigate({
							to: "/chart",
							search: {
								symbols: `${mk}:${isUs ? code.toUpperCase() : code}`,
								layout: "1"
							}
						}),
						prePost: isUs && interval === "minute" ? {
							on: prePost,
							toggle: () => setPrePost((v) => !v)
						} : void 0,
						testId: "trading-chart"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StreetTapeRow, {
						tape: street,
						formatValue: isUs ? formatUsd : formatPrice,
						fastLabel: `50${maWord}`,
						slowLabel: `200${maWord}`,
						showVolume: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartAnalyticsStrip, { snap: analytics }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BandCompareStrip, {
						compare: bandCompare,
						formatValue: px
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RsiDivergenceStrip, {
						items: divergences,
						barCount: bars.length,
						formatValue: px
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MacdCrossStrip, {
						items: macdCrosses,
						barCount: bars.length
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border-t border-border bg-muted/20 px-3 py-1 text-[10px] leading-relaxed text-muted-foreground",
						children: [
							"차트 OHLC: ",
							isUs ? "Yahoo 분할조정 · 미국 정규장(시간외 버튼으로 프리·애프터 포함) · 뉴욕 시각" : "Yahoo/네이버 비공식 경로",
							" · 체결 스트림과 마지막 봉이 어긋날 수 있음 · 실주문 전 HTS 재확인 · 그림·지표는 종목·주기별로 이 브라우저에 저장",
							interval === "minute" ? " · 분봉은 봉주기별 최대 기간 지원(1m≤7일, 5~30m≤60일, 60m≤2년)" : ""
						]
					})
				]
			}),
			view !== "price" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ValuationHistoryChart, {
				code,
				mode: view
			}) : null
		]
	});
}
//#endregion
export { TradingChart as t };
