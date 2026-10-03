import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { b as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as UNIVERSE } from "./universe-BLkYDatc.mjs";
import { m as getSecuritySearch } from "./classify-DLKCwe5y.mjs";
import { U as LayoutGrid, V as Link2, b as Search, f as Square, lt as Columns2 } from "../_libs/lucide-react.mjs";
import { It as useAppStore, Nt as Input, Pt as cn, d as Route$24, y as useChartData } from "./router-B1V8nj-n.mjs";
import { t as PageDisclaimer } from "./PageDisclaimer-Dk4wCTj5.mjs";
import { t as ProChart } from "./ProChart-DdFCAGcv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/chart-C9299Tv_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function createChartSync() {
	const members = /* @__PURE__ */ new Map();
	let syncing = false;
	let timeSync = true;
	return {
		setTimeSync(on) {
			timeSync = on;
		},
		register(id, chart, series, onTime) {
			members.set(id, {
				chart,
				series,
				onTime
			});
			const onMove = (p) => {
				if (syncing) return;
				syncing = true;
				for (const [otherId, m] of members) {
					if (otherId === id) continue;
					if (p.time == null || !p.point) {
						m.chart.clearCrosshairPosition();
						m.onTime?.(null);
					} else {
						const price = m.series.coordinateToPrice(p.point.y);
						try {
							m.chart.setCrosshairPosition(price ?? 0, p.time, m.series);
						} catch {}
						m.onTime?.(p.time);
					}
				}
				syncing = false;
			};
			const onRange = () => {
				if (syncing || !timeSync) return;
				const r = chart.timeScale().getVisibleRange();
				if (!r) return;
				syncing = true;
				for (const [otherId, m] of members) {
					if (otherId === id) continue;
					try {
						m.chart.timeScale().setVisibleRange(r);
					} catch {}
				}
				syncing = false;
			};
			chart.subscribeCrosshairMove(onMove);
			chart.timeScale().subscribeVisibleTimeRangeChange(onRange);
			return () => {
				chart.unsubscribeCrosshairMove(onMove);
				chart.timeScale().unsubscribeVisibleTimeRangeChange(onRange);
				members.delete(id);
			};
		}
	};
}
var SYMBOL_RE = /^(KR:[0-9][0-9A-Z]{5}|US:[A-Z][A-Z0-9.]{0,9})$/;
function parseSymbols(raw) {
	return (raw ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => SYMBOL_RE.test(s)).slice(0, 4);
}
var DEFAULT_SYMBOLS = [
	"KR:005930",
	"KR:000660",
	"US:NVDA",
	"US:TSLA"
];
var NAME = new Map(UNIVERSE.map((u) => [u.code, u.nameKo]));
var INTERVALS = [
	{
		id: "minute",
		label: "5분",
		range: "5d"
	},
	{
		id: "day",
		label: "일",
		range: "2y"
	},
	{
		id: "week",
		label: "주",
		range: "5y"
	},
	{
		id: "month",
		label: "월",
		range: "max"
	}
];
function SymbolPicker({ value, onPick }) {
	const [q, setQ] = (0, import_react.useState)("");
	const [hits, setHits] = (0, import_react.useState)([]);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const submit = async () => {
		const raw = q.trim().toUpperCase();
		if (!raw) return;
		if (/^[0-9][0-9A-Z]{5}$/.test(raw)) return void (onPick(`KR:${raw}`), setQ(""), setHits([]));
		if (/^[A-Z][A-Z0-9.]{0,9}$/.test(raw)) return void (onPick(`US:${raw}`), setQ(""), setHits([]));
		setBusy(true);
		try {
			const r = await getSecuritySearch({ data: { q: q.trim() } });
			setHits(r.hits.slice(0, 6));
		} catch {
			setHits([]);
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "flex items-center gap-1",
			onSubmit: (e) => {
				e.preventDefault();
				submit();
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: value.split(":")[1] ?? "종목",
				className: "h-8 w-28 text-[11px]",
				"aria-label": "종목 검색 (코드·심볼·이름)"
			})]
		}), (hits.length > 0 || busy) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
			className: "absolute left-0 top-9 z-30 w-56 rounded-md border border-border bg-card p-1 text-[11px] shadow-lg",
			children: [busy && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "px-2 py-1 text-muted-foreground",
				children: "검색 중…"
			}), hits.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "flex min-h-9 w-full items-center justify-between rounded px-2 hover:bg-muted",
				onClick: () => {
					onPick(`KR:${h.code}`);
					setHits([]);
					setQ("");
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate",
					children: h.nameKo
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular text-muted-foreground",
					children: h.code
				})]
			}) }, h.code))]
		})]
	});
}
function Pane({ sym, idx, interval, onInterval, onSymbol, sync, height, compact }) {
	const [m, code] = sym.split(":");
	const conf = INTERVALS.find((x) => x.id === interval) ?? INTERVALS[1];
	const minuteSize = 5;
	const q = useChartData({
		code,
		market: m === "US" ? "US" : "KOSPI",
		interval,
		minuteSize,
		range: conf.range
	});
	const bars = q.data?.bars ?? [];
	const controls = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center gap-1",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SymbolPicker, {
			value: sym,
			onPick: onSymbol
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex gap-0.5 rounded-md bg-muted p-0.5",
			role: "group",
			"aria-label": "봉 주기",
			children: INTERVALS.map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => onInterval(x.id),
				className: cn("min-h-8 rounded px-2 text-[11px] font-medium", interval === x.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"),
				children: x.label
			}, x.id))
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProChart, {
		code,
		market: m,
		name: m === "KR" ? NAME.get(code) : void 0,
		bars,
		interval,
		minuteSize,
		range: conf.range,
		intervalKey: interval === "minute" ? "minute-5" : interval,
		source: q.data?.source ?? "",
		modeLabel: m === "US" ? "Yahoo 지연 시세" : "비공식 경로 · 당일 봉 지연 가능",
		updatedAt: q.dataUpdatedAt || null,
		loading: q.isLoading,
		error: q.isError,
		events: q.data && "events" in q.data ? q.data.events : void 0,
		toolbarExtra: controls,
		height,
		sync,
		syncId: `pane-${idx}`,
		testId: `workspace-pane-${idx}`,
		compact
	});
}
/** `/chart` workspace (F7.9): 1-, 2- or 4-chart layout, synced crosshair, optional synced interval. */
function ChartWorkspace() {
	const search = Route$24.useSearch();
	const navigate = useNavigate({ from: "/chart" });
	const layout = search.layout ?? "1";
	const count = Number(layout);
	const parsed = parseSymbols(search.symbols);
	const symbols = (0, import_react.useMemo)(() => {
		const out = [...parsed];
		for (const d of DEFAULT_SYMBOLS) if (out.length < count && !out.includes(d)) out.push(d);
		return out.slice(0, count);
	}, [parsed.join(","), count]);
	const syncInterval = useAppStore((s) => s.chartPrefs.syncInterval);
	const setChartPrefs = useAppStore((s) => s.setChartPrefs);
	const [shared, setShared] = (0, import_react.useState)("day");
	const [own, setOwn] = (0, import_react.useState)([
		"day",
		"day",
		"day",
		"day"
	]);
	const sync = (0, import_react.useMemo)(() => createChartSync(), []);
	const setSymbols = (next, nextLayout = layout) => void navigate({
		search: {
			symbols: next.join(","),
			layout: nextLayout
		},
		replace: true
	});
	const height = count === 1 ? "max(420px, calc(100dvh - 22rem))" : count === 2 ? "max(380px, calc(100dvh - 20rem))" : "max(300px, calc((100dvh - 24rem) / 2))";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-2",
		"data-testid": "chart-workspace",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "desk-kicker",
					children: "Chart workspace"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-lg font-semibold",
					children: "차트 워크스페이스"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-1",
					children: [[
						[
							"1",
							Square,
							"1개"
						],
						[
							"2",
							Columns2,
							"2개"
						],
						[
							"4",
							LayoutGrid,
							"4개"
						]
					].map(([id, Icon, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setSymbols(symbols, id),
						"aria-pressed": layout === id,
						className: cn("inline-flex min-h-9 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold", layout === id ? "border-foreground/30 bg-foreground text-background" : "border-border hover:bg-muted"),
						"data-testid": `layout-${id}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-3.5" }),
							" ",
							label
						]
					}, id)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setChartPrefs({ syncInterval: !syncInterval }),
						"aria-pressed": syncInterval,
						className: cn("inline-flex min-h-9 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold", syncInterval ? "border-desk-teal/50 text-desk-teal" : "border-border text-muted-foreground"),
						title: "모든 창의 봉 주기를 함께 바꿉니다",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link2, { className: "size-3.5" }), " 주기 동기화"]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageDisclaimer, { extra: "크로스헤어와 표시 기간은 창끼리 동기화됩니다." }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("grid gap-2", count === 2 && "md:grid-cols-2", count === 4 && "md:grid-cols-2"),
				children: symbols.map((sym, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pane, {
					sym,
					idx: i,
					interval: syncInterval ? shared : own[i],
					onInterval: (iv) => syncInterval ? setShared(iv) : setOwn((o) => o.map((x, j) => j === i ? iv : x)),
					onSymbol: (s) => setSymbols(symbols.map((x, j) => j === i ? s : x)),
					sync,
					height,
					compact: count > 1
				}, `${i}-${sym}`))
			})
		]
	});
}
//#endregion
export { ChartWorkspace as component };
