import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { Pt as cn } from "./router-B1V8nj-n.mjs";
import { s as bi } from "../_libs/lightweight-charts.mjs";
import { C as chartExportName, M as downloadCsv, j as downloadCanvasPng } from "./tools-Cb8-otqN.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/chrome-CFMydwn4.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function timeLabel(t) {
	if (t == null) return "";
	if (typeof t === "string") return t;
	if (typeof t === "number") return (/* @__PURE__ */ new Date(t * 1e3)).toISOString().slice(0, 16).replace("T", " ");
	return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
}
function useChartChrome(chart, series) {
	const [hidden, setHidden] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
	const [hover, setHover] = (0, import_react.useState)(null);
	const key = series.map((s) => s.id).join(",");
	(0, import_react.useEffect)(() => {
		for (const s of series) s.api?.applyOptions({ visible: !hidden.has(s.id) });
	}, [
		hidden,
		key,
		chart
	]);
	(0, import_react.useEffect)(() => {
		if (!chart) return;
		const onMove = (p) => {
			if (p.time == null) return setHover(null);
			const values = {};
			for (const s of series) {
				const d = s.api ? p.seriesData.get(s.api) : void 0;
				values[s.id] = d?.value ?? d?.close ?? null;
			}
			setHover({
				time: timeLabel(p.time),
				values
			});
		};
		chart.subscribeCrosshairMove(onMove);
		return () => chart.unsubscribeCrosshairMove(onMove);
	}, [chart, key]);
	return {
		legend: series.map((s) => {
			const v = hover?.values[s.id];
			return {
				id: s.id,
				label: s.label,
				color: s.color,
				value: v != null ? s.format ? s.format(v) : v.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) : null,
				visible: !hidden.has(s.id),
				onToggle: () => setHidden((h) => {
					const n = new Set(h);
					if (n.has(s.id)) n.delete(s.id);
					else n.add(s.id);
					return n;
				})
			};
		}),
		hud: hover ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "tabular text-muted-foreground",
			children: hover.time
		}) : null
	};
}
var PRESETS = [
	{
		id: "1m",
		label: "1M",
		days: 31
	},
	{
		id: "3m",
		label: "3M",
		days: 92
	},
	{
		id: "6m",
		label: "6M",
		days: 183
	},
	{
		id: "1y",
		label: "1Y",
		days: 366
	},
	{
		id: "3y",
		label: "3Y",
		days: 1096
	},
	{
		id: "5y",
		label: "5Y",
		days: 1827
	},
	{
		id: "all",
		label: "전체",
		days: null
	}
];
function toDate(t) {
	return typeof t === "number" ? /* @__PURE__ */ new Date(t * 1e3) : /* @__PURE__ */ new Date(`${t.slice(0, 10)}T00:00:00Z`);
}
/** Range presets relative to the last data point (daily/weekly/monthly series). */
function RangePresets({ chart, first, last, compact = false }) {
	const [active, setActive] = (0, import_react.useState)("all");
	const usable = (0, import_react.useMemo)(() => {
		if (first == null || last == null) return [];
		const spanDays = (toDate(last).getTime() - toDate(first).getTime()) / 864e5;
		return PRESETS.filter((p) => p.days == null || p.days < spanDays);
	}, [first, last]);
	if (!usable.length || last == null) return null;
	const apply = (p) => {
		setActive(p.id);
		if (!chart) return;
		if (p.days == null) return chart.timeScale().fitContent();
		const end = toDate(last);
		const start = /* @__PURE__ */ new Date(end.getTime() - p.days * 864e5);
		const fmt = (d) => typeof last === "number" ? Math.floor(d.getTime() / 1e3) : d.toISOString().slice(0, 10);
		try {
			chart.timeScale().setVisibleRange({
				from: fmt(start),
				to: fmt(end)
			});
		} catch {
			chart.timeScale().fitContent();
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex flex-wrap gap-0.5 rounded-md bg-muted p-0.5",
		role: "group",
		"aria-label": "기간",
		children: usable.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: () => apply(p),
			className: cn("rounded px-1.5 text-[11px] font-medium", compact ? "min-h-8" : "min-h-8", active === p.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"),
			children: p.label
		}, p.id))
	});
}
var SCALE_LABEL = {
	normal: "일반",
	log: "로그",
	percent: "%"
};
var SCALE_MODE = {
	normal: bi.Normal,
	log: bi.Logarithmic,
	percent: bi.Percentage
};
function ScaleToggle({ chart, allowed = [
	"normal",
	"log",
	"percent"
], priceScaleIds = ["right"] }) {
	const [mode, setMode] = (0, import_react.useState)("normal");
	const ids = priceScaleIds.join(",");
	(0, import_react.useEffect)(() => {
		for (const id of ids.split(",")) try {
			chart?.priceScale(id).applyOptions({ mode: SCALE_MODE[mode] });
		} catch {}
	}, [
		chart,
		mode,
		ids
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
		value: mode,
		onChange: (e) => setMode(e.target.value),
		className: "h-8 rounded-md border border-border bg-background px-1 text-[11px]",
		"aria-label": "스케일",
		children: allowed.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: m,
			children: SCALE_LABEL[m]
		}, m))
	});
}
function exportChartPng(chart, market, code, kind) {
	if (!chart) return;
	downloadCanvasPng(chart.takeScreenshot(true, false), chartExportName(market, code || "chart", kind, "png", Date.now()));
}
/** CSV of rows inside the chart's visible time range (all rows when unknown). */
function exportRowsCsv(chart, rows, columns, market, code, kind) {
	const r = chart?.timeScale().getVisibleRange();
	const inRange = (t) => {
		if (!r) return true;
		const from = r.from;
		const to = r.to;
		return typeof t === "number" && typeof from === "number" ? t >= from && t <= to : String(t) >= String(from) && String(t) <= String(to);
	};
	const lines = [["time", ...columns.map((c) => c.name)].join(",")];
	for (const row of rows) if (inRange(row.time)) lines.push([row.time, ...columns.map((c) => c.get(row) ?? "")].join(","));
	downloadCsv(lines.join("\n"), chartExportName(market, code || "chart", kind, "csv", Date.now()));
}
//#endregion
export { useChartChrome as a, exportRowsCsv as i, ScaleToggle as n, exportChartPng as r, RangePresets as t };
