import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { l as zonedParts } from "./time-By5ScNNo.mjs";
import { F as Maximize2, N as Minimize2, et as FileSpreadsheet, it as EyeOff, m as SlidersHorizontal, rt as Eye, st as Download, ut as CircleHelp } from "../_libs/lucide-react.mjs";
import { It as useAppStore, Lt as usePriceColors, Pt as cn, at as SheetHeader, et as TimeStamp, it as SheetDescription, nt as Sheet, ot as SheetTitle, rt as SheetContent, vt as formatPct, yt as formatPrice } from "./router-B1V8nj-n.mjs";
import { a as Wi, l as le, t as K } from "../_libs/lightweight-charts.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tools-Cb8-otqN.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Shared chart chrome (F7.2): toolbar slot (bottom sheet on mobile), HUD,
* legend with visibility toggles, source/as-of status line, fullscreen,
* PNG + CSV export, and `?` keyboard help. The chart itself is `children`.
*/
function ChartShell({ title, toolbar, toolbarExtra, hud, legend = [], status, onExportPng, onExportCsv, onFullscreen, shortcuts = [], onKeyDown, children, footer, className, testId, height, collapseToolbar = false }) {
	const rootRef = (0, import_react.useRef)(null);
	const [isFull, setIsFull] = (0, import_react.useState)(false);
	const [help, setHelp] = (0, import_react.useState)(false);
	const [tools, setTools] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const on = () => setIsFull(document.fullscreenElement === rootRef.current);
		document.addEventListener("fullscreenchange", on);
		return () => document.removeEventListener("fullscreenchange", on);
	}, []);
	const toggleFull = (0, import_react.useCallback)(() => {
		if (onFullscreen) return onFullscreen();
		const el = rootRef.current;
		if (!el) return;
		if (document.fullscreenElement) document.exitFullscreen().catch(() => void 0);
		else el.requestFullscreen?.().catch(() => void 0);
	}, [onFullscreen]);
	const handleKey = (e) => {
		const target = e.target;
		if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
		if (e.key === "?") {
			e.preventDefault();
			setHelp(true);
			return;
		}
		onKeyDown?.(e);
	};
	const allShortcuts = [{
		keys: "?",
		label: "단축키 도움말"
	}, ...shortcuts];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: rootRef,
		className: cn("flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card outline-none", isFull && "h-full rounded-none", className),
		tabIndex: 0,
		onKeyDown: handleKey,
		"data-testid": testId ?? "chart-shell",
		"aria-label": typeof title === "string" ? title : "차트",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-wrap items-center gap-1.5 border-b border-border px-2 py-1.5",
				children: [
					title && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mr-1 min-w-0 truncate text-[12px] font-semibold",
						children: title
					}),
					toolbarExtra,
					toolbar && !collapseToolbar && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "hidden min-w-0 flex-wrap items-center gap-1 md:flex",
						children: toolbar
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ml-auto flex items-center gap-0.5",
						children: [
							toolbar && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setTools(true),
								className: cn("inline-flex size-11 items-center justify-center rounded-md hover:bg-muted", collapseToolbar ? "md:size-8" : "md:hidden"),
								"aria-label": "차트 도구",
								"data-testid": "chart-tools-mobile",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, { className: "size-4" })
							}),
							onExportPng && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: onExportPng,
								className: "inline-flex size-11 items-center justify-center rounded-md hover:bg-muted md:size-8",
								"aria-label": "PNG로 저장",
								title: "PNG로 저장",
								"data-testid": "chart-export-png",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" })
							}),
							onExportCsv && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: onExportCsv,
								className: "inline-flex size-11 items-center justify-center rounded-md hover:bg-muted md:size-8",
								"aria-label": "보이는 구간 CSV",
								title: "보이는 구간 CSV",
								"data-testid": "chart-export-csv",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileSpreadsheet, { className: "size-3.5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setHelp(true),
								className: "hidden size-8 items-center justify-center rounded-md hover:bg-muted md:inline-flex",
								"aria-label": "단축키 도움말 (?)",
								title: "단축키 (?)",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleHelp, { className: "size-3.5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: toggleFull,
								className: "inline-flex size-11 items-center justify-center rounded-md hover:bg-muted md:size-8",
								"aria-label": isFull ? "전체 화면 종료" : "전체 화면",
								title: isFull ? "전체 화면 종료" : "전체 화면",
								"data-testid": "chart-fullscreen",
								children: isFull ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minimize2, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Maximize2, { className: "size-3.5" })
							})
						]
					})
				]
			}),
			(hud || legend.length > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-2 py-1 text-[11px]",
				"data-testid": "chart-hud",
				children: [hud, legend.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex min-w-0 flex-wrap items-center gap-1",
					"aria-label": "범례",
					children: legend.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: l.onToggle,
						disabled: !l.onToggle,
						"aria-pressed": l.visible,
						className: cn("inline-flex min-h-8 items-center gap-1 rounded px-1.5 text-[10.5px] hover:bg-muted", !l.visible && "opacity-50"),
						title: l.onToggle ? l.visible ? "숨기기" : "표시" : void 0,
						children: [
							l.onToggle ? l.visible ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "size-3" }) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								style: { color: l.color },
								children: l.label
							}),
							l.value != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular text-muted-foreground",
								children: l.value
							})
						]
					}, l.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("relative", isFull && "min-h-0 flex-1"),
				style: isFull ? void 0 : { height },
				children
			}),
			footer,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-border px-2 py-1 text-[10px] text-muted-foreground",
				"data-testid": "chart-status",
				children: status ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["출처 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
						className: "font-semibold text-foreground/80",
						children: status.source || "—"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["· ", status.mode] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["· 기준 ", status.asOfLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular",
						children: status.asOfLabel
					}) : status.updatedAt != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
						publishedAt: typeof status.updatedAt === "number" ? new Date(status.updatedAt).toISOString() : status.updatedAt,
						precision: "second"
					}) : "—"] }),
					status.note && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["· ", status.note] })
				] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "출처·기준 시각 확인 전 — 데이터가 없으면 차트를 그리지 않습니다." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
				open: tools,
				onOpenChange: setTools,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
					side: "bottom",
					className: "max-h-[75vh] overflow-y-auto",
					"data-testid": "chart-tools-sheet",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: "차트 도구" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetDescription, { children: "차트 종류·스케일·지표·그리기·비교·리플레이" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap items-center gap-1.5 px-4 pb-6 [&_button]:min-h-11 [&_select]:min-h-11",
						children: toolbar
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
				open: help,
				onOpenChange: setHelp,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
					side: "right",
					className: "w-full max-w-sm overflow-y-auto",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: "단축키" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetDescription, { children: "차트를 한 번 클릭한 뒤 사용하세요." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-1 px-4 pb-6 text-[12px]",
						children: allShortcuts.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: s.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
								className: "rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]",
								children: s.keys
							})]
						}, s.keys))
					})]
				})
			})
		]
	});
}
var DARK = {
	background: "#0d1524",
	text: "#e8eef8",
	muted: "#8b9cb8",
	grid: "rgba(139,156,184,0.10)",
	border: "rgba(139,156,184,0.22)",
	crosshair: "rgba(139,156,184,0.45)",
	labelBg: "#1a2a44",
	card: "#0d1524"
};
function hexToRgba(hex, a) {
	const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return null;
	const n = parseInt(m[1], 16);
	return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
/** Resolve the palette from `:root` CSS variables (SSR → dark defaults). */
function readChartTheme() {
	if (typeof window === "undefined") return DARK;
	const cs = getComputedStyle(document.documentElement);
	const v = (name, fb) => cs.getPropertyValue(name).trim() || fb;
	const muted = v("--muted-foreground", DARK.muted);
	const border = v("--border", "#1a2a44");
	return {
		background: v("--card", DARK.background),
		card: v("--card", DARK.card),
		text: v("--foreground", DARK.text),
		muted,
		grid: hexToRgba(muted, .1) ?? DARK.grid,
		border: hexToRgba(muted, .25) ?? DARK.border,
		crosshair: hexToRgba(muted, .5) ?? DARK.crosshair,
		labelBg: border
	};
}
/** Re-reads the palette whenever the app theme toggles. */
function useChartTheme() {
	const mode = useAppStore((s) => s.theme);
	const [theme, setTheme] = (0, import_react.useState)(DARK);
	(0, import_react.useEffect)(() => {
		const id = requestAnimationFrame(() => setTheme(readChartTheme()));
		return () => cancelAnimationFrame(id);
	}, [mode]);
	return theme;
}
var KRW_FMT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
function formatKrwPrice(value) {
	if (!Number.isFinite(value)) return "—";
	return KRW_FMT.format(Math.round(value));
}
function usdPrecision(sample) {
	return sample != null && Number.isFinite(sample) && Math.abs(sample) > 0 && Math.abs(sample) < 1 ? 4 : 2;
}
function formatUsdPrice(value, precision = usdPrecision(value)) {
	if (!Number.isFinite(value)) return "—";
	return value.toLocaleString("en-US", {
		minimumFractionDigits: precision,
		maximumFractionDigits: precision
	});
}
/** Series `priceFormat` for a market. KRW uses a custom formatter so axis labels get separators. */
function priceFormatFor(market, sampleClose) {
	if (market === "KR") return {
		type: "custom",
		precision: 0,
		minMove: 1,
		formatter: formatKrwPrice
	};
	const p = usdPrecision(sampleClose);
	return {
		type: "price",
		precision: p,
		minMove: p === 4 ? 1e-4 : .01
	};
}
/** Axis/crosshair label for a price in the given market. */
function formatChartPrice(value, market, sampleClose) {
	return market === "KR" ? formatKrwPrice(value) : formatUsdPrice(value, usdPrecision(sampleClose ?? value));
}
function formatChartPercent(value, digits = 2) {
	if (!Number.isFinite(value)) return "—";
	return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}
/** Volume: KR → 만/억 units, US → K/M/B. */
function formatChartVolume(value, market) {
	if (!Number.isFinite(value)) return "—";
	const abs = Math.abs(value);
	if (market === "KR") {
		if (abs >= 1e8) return `${(value / 1e8).toFixed(abs >= 1e9 ? 0 : 1)}억`;
		if (abs >= 1e4) return `${(value / 1e4).toFixed(abs >= 1e5 ? 0 : 1)}만`;
		return KRW_FMT.format(Math.round(value));
	}
	if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
	if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
	if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
	return String(Math.round(value));
}
/**
* KRX tick size (호가가격단위). Stocks: unified KOSPI/KOSDAQ table effective
* 2023-01-25. ETF/ETN: flat 5 KRW. Status: NOT re-verified in this session
* (OFFLINE-BUILD) — used only for snapping drawings, never for orders.
*/
function krxTickSize(price, instrument = "stock") {
	if (!Number.isFinite(price) || price <= 0) return 1;
	if (instrument === "etf" || instrument === "etn") return 5;
	if (price < 2e3) return 1;
	if (price < 5e3) return 5;
	if (price < 2e4) return 10;
	if (price < 5e4) return 50;
	if (price < 2e5) return 100;
	if (price < 5e5) return 500;
	return 1e3;
}
/** Snap a price to the nearest valid KRX tick. */
function snapToKrxTick(price, instrument = "stock") {
	const tick = krxTickSize(price, instrument);
	return Math.round(price / tick) * tick;
}
/** Shared chart options (F7.1). `attributionLogo: false` is allowed because the footer credit link exists (F7.3). */
function proChartOptions(theme, market) {
	return {
		autoSize: true,
		layout: {
			background: { color: "transparent" },
			textColor: theme.muted,
			fontSize: 11,
			attributionLogo: false,
			panes: {
				separatorColor: theme.border,
				separatorHoverColor: theme.crosshair
			}
		},
		grid: {
			vertLines: { color: theme.grid },
			horzLines: { color: theme.grid }
		},
		crosshair: {
			mode: K.Normal,
			vertLine: {
				color: theme.crosshair,
				labelBackgroundColor: theme.labelBg
			},
			horzLine: {
				color: theme.crosshair,
				labelBackgroundColor: theme.labelBg
			}
		},
		rightPriceScale: {
			borderColor: theme.border,
			scaleMargins: {
				top: .08,
				bottom: .12
			}
		},
		timeScale: {
			borderColor: theme.border,
			timeVisible: true,
			secondsVisible: false,
			rightOffset: 6,
			barSpacing: 8,
			minBarSpacing: .5
		},
		localization: {
			locale: "ko-KR",
			priceFormatter: (p) => formatChartPrice(p, market)
		},
		handleScroll: {
			mouseWheel: true,
			pressedMouseMove: true,
			horzTouchDrag: true,
			vertTouchDrag: false
		},
		handleScale: {
			axisPressedMouseMove: {
				time: true,
				price: true
			},
			axisDoubleClickReset: true,
			mouseWheel: true,
			pinch: true
		},
		trackingMode: { exitMode: Wi.OnTouchEnd }
	};
}
function createProChart(el, theme, market) {
	return le(el, proChartOptions(theme, market));
}
/** Create/destroy a chart bound to `ref`; re-applies theme/market options on change. */
function useProChart(ref, theme, market) {
	const [chart, setChart] = (0, import_react.useState)(null);
	const first = (0, import_react.useRef)(true);
	(0, import_react.useEffect)(() => {
		const el = ref.current;
		if (!el) return;
		const c = createProChart(el, theme, market);
		setChart(c);
		return () => {
			setChart(null);
			c.remove();
		};
	}, [ref]);
	(0, import_react.useEffect)(() => {
		if (first.current) {
			first.current = false;
			return;
		}
		chart?.applyOptions(proChartOptions(theme, market));
	}, [
		chart,
		theme,
		market
	]);
	return chart;
}
/** Client-side downloads for chart exports (PNG via `takeScreenshot`, CSV text). */
function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function downloadCanvasPng(canvas, filename) {
	canvas.toBlob((blob) => {
		if (blob) downloadBlob(blob, filename);
	}, "image/png");
}
function downloadCsv(text, filename) {
	downloadBlob(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }), filename);
}
/** Rasterize an inline SVG chart (e.g. Recharts) to PNG (Tier C). */
function downloadSvgAsPng(svg, filename, background = "#0d1524") {
	const { width, height } = svg.getBoundingClientRect();
	const clone = svg.cloneNode(true);
	clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	clone.setAttribute("width", String(width));
	clone.setAttribute("height", String(height));
	const xml = new XMLSerializer().serializeToString(clone);
	const img = new Image();
	const scale = window.devicePixelRatio || 1;
	img.onload = () => {
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(width * scale));
		canvas.height = Math.max(1, Math.round(height * scale));
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.scale(scale, scale);
		ctx.drawImage(img, 0, 0, width, height);
		downloadCanvasPng(canvas, filename);
	};
	img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}
var CELLS = [
	{
		key: "fromPeriodLowPct",
		label: "저점 대비 상승",
		sub: "periodLow",
		date: "periodLowDate",
		hint: "표시 구간 최저점 대비 현재가 상승률"
	},
	{
		key: "fromPeriodHighPct",
		label: "고점 대비 하락",
		sub: "periodHigh",
		date: "periodHighDate",
		hint: "표시 구간 최고점 대비 현재가 하락률"
	},
	{
		key: "fromRecentHighPct",
		label: "최근 고점 대비 하락",
		sub: "recentHigh",
		date: "recentHighDate",
		hint: "최근 고저 창의 고점 대비 현재가. 가격 차트 기본은 52주, 툴바에서 스윙으로 바꿀 수 있음"
	},
	{
		key: "fromRecentLowPct",
		label: "최근 저점 대비 상승",
		sub: "recentLow",
		date: "recentLowDate",
		hint: "최근 고저 창의 저점 대비 현재가. 가격 차트 기본은 52주"
	}
];
function RangePositionStrip({ stats, caption, compact = false, className, formatValue }) {
	const colors = usePriceColors();
	if (!stats) return null;
	const fmt = formatValue ?? formatPrice;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("border-b border-border", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 lg:grid-cols-4 gap-px bg-border",
			children: CELLS.map((c) => {
				const pct = stats[c.key];
				const px = stats[c.sub];
				const dt = stats[c.date];
				const label = c.key === "fromRecentHighPct" && pct > .005 ? "최근 고점 돌파" : c.key === "fromPeriodHighPct" && pct > .005 ? "구간 고점 돌파" : c.key === "fromRecentLowPct" && pct < -.005 ? "최근 저점 이탈" : c.key === "fromPeriodLowPct" && pct < -.005 ? "구간 저점 이탈" : c.label;
				const tone = pct > .005 ? colors.up : pct < -.005 ? colors.down : "text-muted-foreground";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					title: c.hint,
					className: cn("bg-card min-w-0", compact ? "px-2.5 py-1.5" : "px-3 py-2"),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[10px] font-semibold tracking-wide text-muted-foreground",
							children: label
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: cn("mt-0.5 font-semibold tabular leading-tight", compact ? "text-sm" : "text-lg", tone),
							children: Number.isFinite(pct) ? formatPct(pct) : "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-0.5 truncate text-[10px] tabular text-muted-foreground",
							children: [fmt(px), dt ? ` · ${dt.slice(0, 10)}` : ""]
						})
					]
				}, c.key);
			})
		}), caption ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-3 py-1 text-[10px] text-muted-foreground leading-relaxed",
			children: caption
		}) : null]
	});
}
function StreetTapeRow({ tape, formatValue, fastLabel, slowLabel, showVolume = false, className }) {
	const colors = usePriceColors();
	if (!tape) return null;
	const fmt = formatValue ?? formatPrice;
	const cells = [
		{
			label: "52주 고점 대비 하락",
			tone: tape.offHighPct < -.005 ? colors.down : "text-muted-foreground",
			value: formatPct(tape.offHighPct),
			sub: `${fmt(tape.high)}${tape.highDate ? ` · ${tape.highDate}` : ""}`
		},
		{
			label: "52주 저점 대비 상승",
			tone: tape.offLowPct > .005 ? colors.up : "text-muted-foreground",
			value: formatPct(tape.offLowPct),
			sub: `${fmt(tape.low)}${tape.lowDate ? ` · ${tape.lowDate}` : ""}`
		},
		{
			label: "52주 레인지 위치",
			tone: "text-foreground",
			value: `${tape.rangeLocation.toFixed(0)}%`,
			sub: "0 저점 · 100 고점"
		},
		{
			label: `${fastLabel} 이격`,
			tone: tape.vsSma50Pct == null ? "text-muted-foreground" : tape.vsSma50Pct > .005 ? colors.up : tape.vsSma50Pct < -.005 ? colors.down : "text-muted-foreground",
			value: tape.vsSma50Pct == null ? "—" : formatPct(tape.vsSma50Pct),
			sub: tape.sma50 != null ? fmt(tape.sma50) : "50개 미만"
		},
		{
			label: `${slowLabel} 이격`,
			tone: tape.vsSma200Pct == null ? "text-muted-foreground" : tape.vsSma200Pct > .005 ? colors.up : tape.vsSma200Pct < -.005 ? colors.down : "text-muted-foreground",
			value: tape.vsSma200Pct == null ? "—" : formatPct(tape.vsSma200Pct),
			sub: tape.sma200 != null ? fmt(tape.sma200) : "200개 미만"
		}
	];
	if (showVolume) cells.push({
		label: "상대거래량",
		tone: "text-foreground",
		value: tape.relVolume != null ? `${tape.relVolume.toFixed(2)}×` : "—",
		sub: "직전 20봉 평균 대비"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("border-b border-border", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: cn("grid grid-cols-2 gap-px bg-border", showVolume ? "lg:grid-cols-6" : "lg:grid-cols-5"),
			children: cells.map((cell) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-card px-2.5 py-1.5 min-w-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[10px] font-semibold tracking-wide text-muted-foreground",
						children: cell.label
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cn("mt-0.5 text-sm font-semibold tabular leading-tight", cell.tone),
						children: cell.value
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-0.5 truncate text-[10px] tabular text-muted-foreground",
						children: cell.sub
					})
				]
			}, cell.label))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "px-3 py-1 text-[10px] text-muted-foreground",
			children: [
				"줌과 무관한 고정 창(",
				tape.barsUsed,
				"봉 / 요청 ",
				tape.lookback,
				"). 52주 고점은 월가 데스크의 % off highs."
			]
		})]
	});
}
function numText(n, digits = 1, suffix = "") {
	if (n == null || !Number.isFinite(n)) return "—";
	return `${n.toFixed(digits)}${suffix}`;
}
/** Return, drawdown, and Korean technical readings for the loaded bars. */
function ChartAnalyticsStrip({ snap, className }) {
	const colors = usePriceColors();
	if (!snap) return null;
	const tone = (n) => n == null || !Number.isFinite(n) ? "text-muted-foreground" : n > .005 ? colors.up : n < -.005 ? colors.down : "text-muted-foreground";
	const cells = [
		{
			label: "구간 수익률",
			value: formatPct(snap.totalReturnPct),
			sub: `${snap.bars}봉`,
			tone: tone(snap.totalReturnPct)
		},
		{
			label: snap.volAnnualized ? "연환산 변동성" : "봉 변동성",
			value: snap.volPct == null ? "—" : `${snap.volPct.toFixed(1)}%`,
			sub: snap.volAnnualized ? "로그수익 표본표준편차" : "분봉은 연환산하지 않음",
			tone: "text-foreground"
		},
		{
			label: "최대 낙폭",
			value: formatPct(snap.maxDrawdownPct),
			sub: "구간 고점 대비 최저",
			tone: colors.down
		},
		{
			label: "고점 대비 하락",
			value: formatPct(snap.currentDrawdownPct),
			sub: "지금 낙폭",
			tone: tone(snap.currentDrawdownPct)
		},
		{
			label: "저점 대비 상승",
			value: Number.isFinite(snap.fromLowPct) ? formatPct(snap.fromLowPct) : "—",
			sub: "구간 저점 기준",
			tone: tone(snap.fromLowPct)
		},
		{
			label: "종가 백분위",
			value: snap.closePercentile == null ? "—" : `${snap.closePercentile.toFixed(0)}%ile`,
			sub: "이 구간 종가 중 현재 이하",
			tone: "text-foreground"
		},
		{
			label: "이격도 20",
			value: numText(snap.disparity20, 1),
			sub: "100 = 20이평",
			tone: "text-foreground"
		},
		{
			label: "스토캐스틱",
			value: snap.stochasticK == null ? "—" : `${snap.stochasticK.toFixed(0)} / ${snap.stochasticD == null ? "—" : snap.stochasticD.toFixed(0)}`,
			sub: "%K / %D · 14, 3",
			tone: "text-foreground"
		},
		{
			label: "투자심리선",
			value: numText(snap.psych12, 0, "%"),
			sub: "12봉 중 상승 비율",
			tone: "text-foreground"
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("border-b border-border", className),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-5",
			children: cells.map((cell) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-card px-2.5 py-1.5 min-w-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[10px] font-semibold tracking-wide text-muted-foreground",
						children: cell.label
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cn("mt-0.5 text-sm font-semibold tabular leading-tight", cell.tone),
						children: cell.value
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-0.5 truncate text-[10px] text-muted-foreground",
						children: cell.sub
					})
				]
			}, cell.label))
		})
	});
}
function bbZone(percentB) {
	if (percentB == null) return "폭이 0";
	if (percentB > 1) return "상단 밖";
	if (percentB < 0) return "하단 밖";
	if (percentB >= .8) return "상단 근접";
	if (percentB <= .2) return "하단 근접";
	return "밴드 안";
}
function pctZone(rank, close, p10, p90) {
	if (p90 != null && close > p90) return "P90 위";
	if (p10 != null && close < p10) return "P10 아래";
	if (rank == null) return "표본 부족";
	if (rank >= 90) return "상위 10%";
	if (rank <= 10) return "하위 10%";
	return "중간 분포";
}
/** Bollinger (20, 2σ) against the empirical percentile channel. */
function BandCompareStrip({ compare, formatValue }) {
	if (!compare) return null;
	const fmt = formatValue ?? formatPrice;
	const pctGap = compare.p50 != null && compare.p50 > 0 ? (compare.close / compare.p50 - 1) * 100 : null;
	const bbGap = compare.bbMid != null && compare.bbMid > 0 ? (compare.close / compare.bbMid - 1) * 100 : null;
	const cells = [
		{
			label: "볼린저 %b",
			value: compare.percentB == null ? "—" : compare.percentB.toFixed(2),
			sub: `20봉 · 2σ · ${bbZone(compare.percentB)}`
		},
		{
			label: "볼린저 폭",
			value: compare.bbWidthPct == null ? "—" : `${compare.bbWidthPct.toFixed(1)}%`,
			sub: compare.bbUpper != null && compare.bbLower != null ? `${fmt(compare.bbLower)} – ${fmt(compare.bbUpper)}` : "상·하단"
		},
		{
			label: "이평 이격",
			value: bbGap == null ? "—" : formatPct(bbGap),
			sub: compare.bbMid != null ? `중심 ${fmt(compare.bbMid)}` : "SMA20"
		},
		{
			label: "백분위 순위",
			value: compare.pctRank == null ? "—" : `${compare.pctRank.toFixed(0)}%ile`,
			sub: `${compare.window}봉 · ${pctZone(compare.pctRank, compare.close, compare.p10, compare.p90)}`
		},
		{
			label: "P10 · P90",
			value: compare.p10 != null && compare.p90 != null ? `${fmt(compare.p10)} · ${fmt(compare.p90)}` : "—",
			sub: compare.p50 != null ? `중앙 ${fmt(compare.p50)}` : "경험 분포"
		},
		{
			label: "중앙 이격",
			value: pctGap == null ? "—" : formatPct(pctGap),
			sub: "종가 / P50 − 1"
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-border",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 pt-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[10px] font-semibold tracking-wide text-muted-foreground",
					children: "볼린저 × 백분위"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[10px] text-muted-foreground",
					children: "회색 실선 볼린저 · 청록 P10 · 노랑 P50 · 장미 P90"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6",
				children: cells.map((cell) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 bg-card px-2.5 py-1.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[10px] font-semibold tracking-wide text-muted-foreground",
							children: cell.label
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-0.5 truncate text-sm font-semibold tabular leading-tight",
							children: cell.value
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-0.5 truncate text-[10px] text-muted-foreground",
							children: cell.sub
						})
					]
				}, cell.label))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-3 py-1.5 text-[11px] leading-relaxed text-muted-foreground",
				children: compare.note
			})
		]
	});
}
var DIVERGENCE_TONE = {
	"regular-bullish": "text-desk-teal",
	"hidden-bullish": "text-desk-teal",
	"regular-bearish": "text-desk-rose",
	"hidden-bearish": "text-desk-rose"
};
function divergenceRead(kind) {
	if (kind === "hidden-bullish") return "히든 · 가격 저점↑ RSI 저점↓ · 상승 지속";
	if (kind === "hidden-bearish") return "히든 · 가격 고점↓ RSI 고점↑ · 하락 지속";
	if (kind === "regular-bullish") return "정규 · 가격 저점↓ RSI 저점↑ · 반등 후보";
	return "정규 · 가격 고점↑ RSI 고점↓ · 조정 후보";
}
/** Confirmed-pivot RSI divergence, including hidden continuation pairs. */
function RsiDivergenceStrip({ items, barCount, formatValue }) {
	const fmt = formatValue ?? formatPrice;
	const hidden = items.filter((item) => item.kind.startsWith("hidden"));
	const regular = items.filter((item) => !item.kind.startsWith("hidden"));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-border px-3 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[10px] font-semibold tracking-wide text-muted-foreground",
					children: "RSI 다이버전스 · 히든"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[10px] text-muted-foreground",
					children: "확정 스윙 최근 6쌍 · RSI 14"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-[11px] leading-relaxed text-muted-foreground",
				children: "히든 상승은 저점이 높아지는데 RSI는 더 낮아진 눌림이고, 히든 하락은 고점이 낮아지는데 RSI는 더 높아진 반등입니다. 정규는 추세가 꺾이는 쪽입니다."
			}),
			items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-[11px] leading-relaxed text-muted-foreground",
				children: "최근 확정 스윙에서 정규·히든 다이버전스가 없습니다. 오른쪽 5봉이 지나지 않은 고점·저점은 빼 둡니다."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-1.5 flex flex-col gap-1.5",
				children: [...hidden, ...regular].map((item) => {
					const ago = Math.max(0, barCount - 1 - item.i2);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "text-[11px] leading-relaxed",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("font-semibold", DIVERGENCE_TONE[item.kind]),
							children: item.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted-foreground",
							children: [
								" ",
								"· ",
								divergenceRead(item.kind),
								" · 가격 ",
								fmt(item.price1),
								" → ",
								fmt(item.price2),
								" · RSI",
								" ",
								item.rsi1.toFixed(1),
								" → ",
								item.rsi2.toFixed(1),
								" · ",
								ago === 0 ? "마지막 확정 봉" : `${ago}봉 전`
							]
						})]
					}, `${item.kind}-${item.i1}-${item.i2}`);
				})
			})
		]
	});
}
/** Latest MACD/signal cross inside the lookback. */
function MacdCrossStrip({ items, barCount }) {
	const golden = items.find((item) => item.kind === "golden");
	const dead = items.find((item) => item.kind === "dead");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-border px-3 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[10px] font-semibold tracking-wide text-muted-foreground",
					children: "MACD 골든크로스"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[10px] text-muted-foreground",
					children: "12 · 26 · 시그널 9"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-[11px] leading-relaxed text-muted-foreground",
				children: "MACD선이 시그널을 아래에서 위로 돌파하면 골든크로스, 위에서 아래로 깨면 데드크로스입니다. 0선 아래 골든은 반등, 0선 위 골든은 상승 지속으로 읽습니다."
			}),
			items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-[11px] text-muted-foreground",
				children: "최근 40봉 안에 MACD 크로스가 없습니다."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-1.5 flex flex-col gap-1",
				children: [golden, dead].filter((item) => item != null).map((item) => {
					const ago = Math.max(0, barCount - 1 - item.index);
					const tone = item.kind === "golden" ? "text-desk-teal" : "text-desk-rose";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "text-[11px] leading-relaxed",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("font-semibold", tone),
							children: item.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted-foreground",
							children: [
								" ",
								"· MACD ",
								item.macd.toFixed(2),
								" · 시그널 ",
								item.signal.toFixed(2),
								" ·",
								" ",
								ago === 0 ? "이번 봉" : `${ago}봉 전`
							]
						})]
					}, item.kind);
				})
			})
		]
	});
}
/** Client-side technical indicators used by the pro trading chart. */
function sma(values, period) {
	const out = [];
	let sum = 0;
	for (let i = 0; i < values.length; i++) {
		sum += values[i];
		if (i >= period) sum -= values[i - period];
		out.push(i >= period - 1 ? sum / period : null);
	}
	return out;
}
function ema(values, period) {
	const out = [];
	const k = 2 / (period + 1);
	let prev = null;
	for (let i = 0; i < values.length; i++) {
		const v = values[i];
		if (i < period - 1) {
			out.push(null);
			continue;
		}
		if (prev == null) {
			let s = 0;
			for (let j = i - period + 1; j <= i; j++) s += values[j];
			prev = s / period;
		} else prev = v * k + prev * (1 - k);
		out.push(prev);
	}
	return out;
}
function bollinger(closes, period = 20, mult = 2) {
	const mid = sma(closes, period);
	const upper = [];
	const lower = [];
	for (let i = 0; i < closes.length; i++) {
		if (mid[i] == null) {
			upper.push(null);
			lower.push(null);
			continue;
		}
		let sumSq = 0;
		for (let j = i - period + 1; j <= i; j++) {
			const d = closes[j] - mid[i];
			sumSq += d * d;
		}
		const sd = Math.sqrt(sumSq / period);
		upper.push(mid[i] + mult * sd);
		lower.push(mid[i] - mult * sd);
	}
	return {
		mid,
		upper,
		lower
	};
}
function rsi(closes, period = 14) {
	if (!closes.length) return [];
	const out = [null];
	let avgGain = 0;
	let avgLoss = 0;
	for (let i = 1; i < closes.length; i++) {
		const ch = closes[i] - closes[i - 1];
		const gain = Math.max(ch, 0);
		const loss = Math.max(-ch, 0);
		if (i < period) {
			avgGain += gain;
			avgLoss += loss;
			out.push(null);
			continue;
		}
		if (i === period) {
			avgGain = (avgGain + gain) / period;
			avgLoss = (avgLoss + loss) / period;
		} else {
			avgGain = (avgGain * (period - 1) + gain) / period;
			avgLoss = (avgLoss * (period - 1) + loss) / period;
		}
		if (avgLoss === 0) out.push(100);
		else {
			const rs = avgGain / avgLoss;
			out.push(100 - 100 / (1 + rs));
		}
	}
	return out;
}
function macd(closes, fast = 12, slow = 26, signal = 9) {
	const emaFast = ema(closes, fast);
	const emaSlow = ema(closes, slow);
	const macdLine = closes.map((_, i) => emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null);
	const compact = [];
	const idxMap = [];
	macdLine.forEach((v, i) => {
		if (v != null) {
			compact.push(v);
			idxMap.push(i);
		}
	});
	const sigCompact = ema(compact, signal);
	const signalLine = closes.map(() => null);
	const hist = closes.map(() => null);
	idxMap.forEach((orig, j) => {
		signalLine[orig] = sigCompact[j];
		if (macdLine[orig] != null && sigCompact[j] != null) hist[orig] = macdLine[orig] - sigCompact[j];
	});
	return {
		macd: macdLine,
		signal: signalLine,
		hist
	};
}
/**
* MACD(12,26,9) line crossing the signal line.
* Golden: previous bar MACD ≤ signal and this bar MACD > signal.
* Dead: the opposite cross. Ties on the previous bar still count as a cross
* when the current bar separates. The latest golden and latest dead inside
* `maxAge` are kept. An unfinished bar is included because the cross is on
* the close, not a future pivot.
*/
function detectMacdCrosses(closes, opts) {
	const fast = opts?.fast ?? 12;
	const slow = opts?.slow ?? 26;
	const signalPeriod = opts?.signal ?? 9;
	const maxAge = opts?.maxAge ?? 40;
	if (closes.length < slow + signalPeriod) return [];
	const series = macd(closes, fast, slow, signalPeriod);
	let golden = null;
	let dead = null;
	for (let i = 1; i < closes.length; i++) {
		const prevMacd = series.macd[i - 1];
		const macdNow = series.macd[i];
		const prevSignal = series.signal[i - 1];
		const signalNow = series.signal[i];
		if (prevMacd == null || macdNow == null || prevSignal == null || signalNow == null) continue;
		const prevDiff = prevMacd - prevSignal;
		const nowDiff = macdNow - signalNow;
		if (prevDiff <= 0 && nowDiff > 0) golden = {
			kind: "golden",
			label: macdNow < 0 ? "MACD 골든크로스 · 0선 아래" : "MACD 골든크로스 · 0선 위",
			index: i,
			macd: macdNow,
			signal: signalNow,
			belowZero: macdNow < 0
		};
		else if (prevDiff >= 0 && nowDiff < 0) dead = {
			kind: "dead",
			label: macdNow > 0 ? "MACD 데드크로스 · 0선 위" : "MACD 데드크로스 · 0선 아래",
			index: i,
			macd: macdNow,
			signal: signalNow,
			belowZero: macdNow < 0
		};
	}
	const last = closes.length - 1;
	const out = [];
	if (golden && last - golden.index <= maxAge) out.push(golden);
	if (dead && last - dead.index <= maxAge) out.push(dead);
	out.sort((a, b) => b.index - a.index);
	return out;
}
/**
* VWAP. For intraday, pass sessionKeys (e.g. YYYY-MM-DD) to reset each KRX session.
* Without keys, computes one cumulative series (daily “anchored” style — label accordingly).
*/
function vwap(highs, lows, closes, volumes, sessionKeys) {
	const out = [];
	let cumPV = 0;
	let cumV = 0;
	let prevKey;
	for (let i = 0; i < closes.length; i++) {
		const key = sessionKeys?.[i];
		if (key != null && prevKey != null && key !== prevKey) {
			cumPV = 0;
			cumV = 0;
		}
		if (key != null) prevKey = key;
		const tp = (highs[i] + lows[i] + closes[i]) / 3;
		const v = Math.max(volumes[i], 0);
		cumPV += tp * v;
		cumV += v;
		out.push(cumV > 0 ? cumPV / cumV : null);
	}
	return out;
}
/** Last non-null ATR value helper */
function lastNumber(arr) {
	for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
	return null;
}
/** Pivot highs/lows for auto support & resistance. */
function findPivots(highs, lows, left = 3, right = 3) {
	const highIdx = [];
	const lowIdx = [];
	for (let i = left; i < highs.length - right; i++) {
		let isH = true;
		let isL = true;
		for (let j = i - left; j <= i + right; j++) {
			if (j === i) continue;
			if (highs[j] > highs[i]) isH = false;
			if (lows[j] < lows[i]) isL = false;
		}
		if (isH) highIdx.push(i);
		if (isL) lowIdx.push(i);
	}
	return {
		highIdx,
		lowIdx
	};
}
function atr(highs, lows, closes, period = 14) {
	const tr = [];
	for (let i = 0; i < highs.length; i++) if (i === 0) tr.push(highs[i] - lows[i]);
	else tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
	return sma(tr, period);
}
function pctChange(now, ref) {
	if (!(ref > 0) || !Number.isFinite(now)) return NaN;
	return (now - ref) / ref * 100;
}
function recentWindowStart(bars, from, to, span) {
	if (span === "all") return from;
	const last = bars[to]?.date;
	const days = span === "3M" ? 92 : span === "6M" ? 183 : 366;
	const endMs = last ? Date.parse(last.slice(0, 10)) : NaN;
	if (!Number.isFinite(endMs)) return Math.max(from, to - (span === "3M" ? 63 : span === "6M" ? 126 : 252) + 1);
	const cut = endMs - days * 864e5;
	for (let i = from; i <= to; i++) {
		const d = Date.parse((bars[i]?.date ?? "").slice(0, 10));
		if (Number.isFinite(d) && d >= cut) return i;
	}
	return from;
}
/**
* Desk-style range position vs current price.
* Period high/low = extrema of [from, to].
* Recent high/low default to the last confirmed swing. Pass `recentSpan`
* (`3M`/`6M`/`52W`/`all`) to use a trailing calendar window instead.
*/
function computeRangePosition(bars, opts) {
	if (!bars.length) return null;
	const from = Math.max(0, Math.floor(opts?.from ?? 0));
	const to = Math.min(bars.length - 1, Math.floor(opts?.to ?? bars.length - 1));
	if (to < from) return null;
	const close = opts?.close ?? bars[bars.length - 1].close;
	if (!(close > 0) || !Number.isFinite(close)) return null;
	let periodHigh = -Infinity;
	let periodLow = Infinity;
	let periodHighIdx = from;
	let periodLowIdx = from;
	for (let i = from; i <= to; i++) {
		const b = bars[i];
		if (b.high >= periodHigh) {
			periodHigh = b.high;
			periodHighIdx = i;
		}
		if (b.low <= periodLow) {
			periodLow = b.low;
			periodLowIdx = i;
		}
	}
	if (!(periodHigh > 0) || !(periodLow > 0) || !Number.isFinite(periodHigh)) return null;
	const span = opts?.recentSpan ?? "swing";
	let recentHighIdx = periodHighIdx;
	let recentLowIdx = periodLowIdx;
	if (span === "swing") {
		const n = to - from + 1;
		const left = opts?.pivotLeft ?? Math.max(3, Math.min(8, Math.floor(n / 40) || 3));
		const right = opts?.pivotRight ?? left;
		const highs = [];
		const lows = [];
		for (let i = from; i <= to; i++) {
			highs.push(bars[i].high);
			lows.push(bars[i].low);
		}
		const piv = findPivots(highs, lows, left, right);
		recentHighIdx = piv.highIdx.length > 0 ? from + piv.highIdx[piv.highIdx.length - 1] : periodHighIdx;
		recentLowIdx = piv.lowIdx.length > 0 ? from + piv.lowIdx[piv.lowIdx.length - 1] : periodLowIdx;
		const winStart = from + Math.max(0, n - Math.max(8, Math.floor(n * .2)));
		if (piv.highIdx.length === 0) {
			let h = -Infinity;
			let hi = winStart;
			for (let i = winStart; i <= to; i++) if (bars[i].high >= h) {
				h = bars[i].high;
				hi = i;
			}
			recentHighIdx = hi;
		}
		if (piv.lowIdx.length === 0) {
			let l = Infinity;
			let li = winStart;
			for (let i = winStart; i <= to; i++) if (bars[i].low <= l) {
				l = bars[i].low;
				li = i;
			}
			recentLowIdx = li;
		}
	} else {
		const start = recentWindowStart(bars, from, to, span);
		let h = -Infinity;
		let l = Infinity;
		for (let i = start; i <= to; i++) {
			const b = bars[i];
			if (b.high >= h) {
				h = b.high;
				recentHighIdx = i;
			}
			if (b.low <= l) {
				l = b.low;
				recentLowIdx = i;
			}
		}
	}
	const recentHigh = bars[recentHighIdx].high;
	const recentLow = bars[recentLowIdx].low;
	const dateOf = (i) => bars[i]?.date?.slice(0, 16) ?? null;
	return {
		close,
		periodHigh,
		periodLow,
		periodHighDate: dateOf(periodHighIdx),
		periodLowDate: dateOf(periodLowIdx),
		periodHighIdx,
		periodLowIdx,
		recentHigh,
		recentLow,
		recentHighDate: dateOf(recentHighIdx),
		recentLowDate: dateOf(recentLowIdx),
		recentHighIdx,
		recentLowIdx,
		fromPeriodLowPct: pctChange(close, periodLow),
		fromPeriodHighPct: pctChange(close, periodHigh),
		fromRecentHighPct: pctChange(close, recentHigh),
		fromRecentLowPct: pctChange(close, recentLow)
	};
}
/** One marker per distinct high and low. Recent labels sit near the last price when they differ. */
function planRangeMarkers(stats) {
	const highSame = stats.periodHighIdx === stats.recentHighIdx;
	const lowSame = stats.periodLowIdx === stats.recentLowIdx;
	const out = [{
		role: "high",
		scope: highSame ? "both" : "period",
		idx: stats.periodHighIdx,
		price: stats.periodHigh,
		date: stats.periodHighDate,
		pct: stats.fromPeriodHighPct
	}, {
		role: "low",
		scope: lowSame ? "both" : "period",
		idx: stats.periodLowIdx,
		price: stats.periodLow,
		date: stats.periodLowDate,
		pct: stats.fromPeriodLowPct
	}];
	if (!highSame) out.push({
		role: "high",
		scope: "recent",
		idx: stats.recentHighIdx,
		price: stats.recentHigh,
		date: stats.recentHighDate,
		pct: stats.fromRecentHighPct
	});
	if (!lowSame) out.push({
		role: "low",
		scope: "recent",
		idx: stats.recentLowIdx,
		price: stats.recentLow,
		date: stats.recentLowDate,
		pct: stats.fromRecentLowPct
	});
	return out;
}
/** Canvas copy shared by the price chart and the export chart so the wording cannot drift. */
function rangeMarkerText(plan, priceText, pctText) {
	const date = plan.date?.slice(0, 10) ?? "";
	const place = plan.scope === "recent" ? "last" : "extreme";
	const head = plan.role === "high" ? plan.scope === "both" ? "기간=최근 고점" : plan.scope === "period" ? "기간고점" : "최근고점" : plan.scope === "both" ? "기간=최근 저점" : plan.scope === "period" ? "기간저점" : "최근저점";
	const rel = plan.role === "high" ? plan.pct > .005 ? `돌파 ${pctText}` : plan.scope === "recent" ? `최근고점 대비 ${pctText}` : `최고점대비 ${pctText}` : plan.scope === "recent" ? `최근저점 대비 ${pctText}` : `최저점대비 ${pctText}`;
	return {
		place,
		title: [
			head,
			date,
			priceText
		].filter(Boolean).join(" "),
		pctText: rel
	};
}
/** Line-series variant (export desk, flow). High = low = close = value. */
function computeSeriesRangePosition(points, close, opts) {
	return computeRangePosition(points.filter((p) => Number.isFinite(p.value) && p.value !== 0).map((p) => ({
		high: p.value,
		low: p.value,
		close: p.value,
		date: p.date
	})), {
		...close != null ? { close } : {},
		...opts?.recentSpan ? { recentSpan: opts.recentSpan } : {}
	});
}
/**
* Fixed-window desk tape. Daily charts pass 252 bars (52 weeks).
* Weekly valuation series pass 52. This does not move when the user zooms.
*/
function streetTape(bars, opts) {
	if (bars.length < 2) return null;
	const close = bars[bars.length - 1].close;
	if (!(close > 0) || !Number.isFinite(close)) return null;
	const lookback = Math.max(2, Math.floor(opts?.lookback ?? Math.min(252, bars.length)));
	const start = Math.max(0, bars.length - lookback);
	const window = bars.slice(start);
	let high = -Infinity;
	let low = Infinity;
	let highDate = null;
	let lowDate = null;
	for (const bar of window) {
		if (bar.high >= high) {
			high = bar.high;
			highDate = bar.date?.slice(0, 10) ?? null;
		}
		if (bar.low > 0 && bar.low <= low) {
			low = bar.low;
			lowDate = bar.date?.slice(0, 10) ?? null;
		}
	}
	if (!(high > 0) || !(low > 0) || !Number.isFinite(high) || !Number.isFinite(low)) return null;
	const closes = bars.map((bar) => bar.close);
	const s50 = sma(closes, 50);
	const s200 = sma(closes, 200);
	const sma50 = s50[s50.length - 1] ?? null;
	const sma200 = s200[s200.length - 1] ?? null;
	let relVolume = null;
	const vols = bars.map((bar) => bar.volume ?? 0);
	const lastVol = vols[vols.length - 1] ?? 0;
	if (vols.length >= 21 && lastVol > 0) {
		let sum = 0;
		let n = 0;
		for (let i = vols.length - 21; i < vols.length - 1; i++) if (vols[i] > 0) {
			sum += vols[i];
			n += 1;
		}
		if (n >= 10 && sum > 0) relVolume = lastVol / (sum / n);
	}
	const span = high - low;
	return {
		lookback,
		barsUsed: window.length,
		high,
		low,
		highDate,
		lowDate,
		offHighPct: pctChange(close, high),
		offLowPct: pctChange(close, low),
		rangeLocation: span > 0 ? (close - low) / span * 100 : 100,
		sma50: sma50 != null && sma50 > 0 ? sma50 : null,
		sma200: sma200 != null && sma200 > 0 ? sma200 : null,
		vsSma50Pct: sma50 != null && sma50 > 0 ? pctChange(close, sma50) : null,
		vsSma200Pct: sma200 != null && sma200 > 0 ? pctChange(close, sma200) : null,
		relVolume
	};
}
/** Linear interpolation percentile. `q` is 0–1. `sorted` must be ascending. */
function linearPercentile(sorted, q) {
	if (!sorted.length) return NaN;
	const clamped = Math.min(1, Math.max(0, q));
	const pos = (sorted.length - 1) * clamped;
	const lo = Math.floor(pos);
	const hi = Math.ceil(pos);
	if (lo === hi) return sorted[lo];
	const w = pos - lo;
	return sorted[lo] * (1 - w) + sorted[hi] * w;
}
/**
* Rolling close percentile channel. Each point uses only the past `window`
* closes (no look-ahead). Needs 20 positive prints before a band is drawn.
*/
function rollingPercentileBands(values, window = 120) {
	const p10 = [];
	const p50 = [];
	const p90 = [];
	const span = Math.max(20, Math.floor(window));
	for (let i = 0; i < values.length; i++) {
		const start = Math.max(0, i - span + 1);
		const slice = values.slice(start, i + 1).filter((v) => Number.isFinite(v) && v > 0);
		if (slice.length < 20) {
			p10.push(null);
			p50.push(null);
			p90.push(null);
			continue;
		}
		slice.sort((a, b) => a - b);
		p10.push(linearPercentile(slice, .1));
		p50.push(linearPercentile(slice, .5));
		p90.push(linearPercentile(slice, .9));
	}
	return {
		p10,
		p50,
		p90
	};
}
/** Share of positive values at or below the last one, 0–100. Null until 8 prints. */
function closePercentile(values) {
	const xs = values.filter((v) => Number.isFinite(v) && v > 0);
	if (xs.length < 8) return null;
	const last = xs[xs.length - 1];
	let le = 0;
	for (const v of xs) if (v <= last) le += 1;
	return le / xs.length * 100;
}
/** 이격도 = 종가 / 이평 × 100. 100이면 이평과 같다. */
function disparity(closes, period) {
	const ma = sma(closes, period);
	return closes.map((c, i) => ma[i] != null && ma[i] > 0 ? c / ma[i] * 100 : null);
}
/** Fast stochastic. %K uses the high-low range; %D is an SMA of %K. */
function stochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
	const k = [];
	for (let i = 0; i < closes.length; i++) {
		if (i + 1 < kPeriod) {
			k.push(null);
			continue;
		}
		let hh = -Infinity;
		let ll = Infinity;
		for (let j = i - kPeriod + 1; j <= i; j++) {
			if (highs[j] > hh) hh = highs[j];
			if (lows[j] < ll) ll = lows[j];
		}
		const span = hh - ll;
		k.push(span > 0 ? (closes[i] - ll) / span * 100 : null);
	}
	const d = [];
	for (let i = 0; i < k.length; i++) {
		if (i + 1 < dPeriod) {
			d.push(null);
			continue;
		}
		let sum = 0;
		let n = 0;
		for (let j = i - dPeriod + 1; j <= i; j++) {
			if (k[j] == null) continue;
			sum += k[j];
			n += 1;
		}
		d.push(n === dPeriod ? sum / dPeriod : null);
	}
	return {
		k,
		d
	};
}
/** 투자심리선: 최근 N봉 중 상승 봉 비율 × 100. */
function psychologicalLine(closes, period = 12) {
	const out = [];
	for (let i = 0; i < closes.length; i++) {
		if (i < period) {
			out.push(null);
			continue;
		}
		let up = 0;
		for (let j = i - period + 1; j <= i; j++) if (closes[j] > closes[j - 1]) up += 1;
		out.push(up / period * 100);
	}
	return out;
}
function sampleStdev(xs) {
	if (xs.length < 2) return null;
	let mean = 0;
	for (const x of xs) mean += x;
	mean /= xs.length;
	let acc = 0;
	for (const x of xs) {
		const d = x - mean;
		acc += d * d;
	}
	return Math.sqrt(acc / (xs.length - 1));
}
/**
* Window statistics used on stock and ETF charts.
* Volatility is the sample stdev of log returns. It is annualized only when
* `periodsPerYear` is the bar frequency (252 daily, 52 weekly, 12 monthly).
*/
function quantSnapshot(bars, periodsPerYear) {
	if (bars.length < 8) return null;
	const closes = bars.map((b) => b.close);
	const first = closes[0];
	const last = closes[closes.length - 1];
	if (!(first > 0) || !(last > 0)) return null;
	const rets = [];
	for (let i = 1; i < closes.length; i++) {
		const prev = closes[i - 1];
		const cur = closes[i];
		if (prev > 0 && cur > 0) rets.push(Math.log(cur / prev));
	}
	const sd = sampleStdev(rets);
	const volPct = sd == null ? null : periodsPerYear != null && periodsPerYear > 0 ? sd * Math.sqrt(periodsPerYear) * 100 : sd * 100;
	let peak = closes[0];
	let trough = closes[0];
	let maxDd = 0;
	let currentDd = 0;
	for (const c of closes) {
		if (!(c > 0)) continue;
		if (c > peak) peak = c;
		if (c < trough) trough = c;
		const dd = (c / peak - 1) * 100;
		if (dd < maxDd) maxDd = dd;
		currentDd = dd;
	}
	const disp = disparity(closes, 20);
	const st = stochastic(bars.map((b) => b.high), bars.map((b) => b.low), closes);
	const psych = psychologicalLine(closes, 12);
	return {
		bars: bars.length,
		totalReturnPct: (last - first) / first * 100,
		volPct,
		volAnnualized: periodsPerYear != null && periodsPerYear > 0,
		maxDrawdownPct: maxDd,
		currentDrawdownPct: currentDd,
		fromLowPct: trough > 0 ? (last - trough) / trough * 100 : NaN,
		closePercentile: closePercentile(closes),
		disparity20: disp[disp.length - 1] ?? null,
		stochasticK: st.k[st.k.length - 1] ?? null,
		stochasticD: st.d[st.d.length - 1] ?? null,
		psych12: psych[psych.length - 1] ?? null
	};
}
/**
* Bollinger is a 20-bar mean ± 2 sample-style σ (population σ of that window).
* Percentile bands are the empirical 10/50/90 of the longer window.
* They diverge when the short window is skewed or the longer window has fat tails.
*/
function compareBollingerAndPercentile(closes, bbPeriod = 20, bbMult = 2, pctWindow = 120) {
	if (closes.length < bbPeriod) return null;
	const close = closes[closes.length - 1];
	if (!(close > 0)) return null;
	const bb = bollinger(closes, bbPeriod, bbMult);
	const upper = bb.upper[bb.upper.length - 1] ?? null;
	const lower = bb.lower[bb.lower.length - 1] ?? null;
	const mid = bb.mid[bb.mid.length - 1] ?? null;
	const span = upper != null && lower != null ? upper - lower : null;
	const percentB = span != null && span > 0 ? (close - lower) / span : null;
	const bbWidthPct = span != null && mid != null && mid > 0 ? span / mid * 100 : null;
	const bands = rollingPercentileBands(closes, pctWindow);
	const p10 = bands.p10[bands.p10.length - 1] ?? null;
	const p50 = bands.p50[bands.p50.length - 1] ?? null;
	const p90 = bands.p90[bands.p90.length - 1] ?? null;
	const start = Math.max(0, closes.length - Math.max(20, pctWindow));
	const pctRank = closePercentile(closes.slice(start));
	let note = "볼린저는 최근 20봉 평균±2σ입니다. 백분위는 더 긴 구간의 종가 10·50·90%로, 분포를 정규라고 가정하지 않습니다.";
	const aboveBb = percentB != null && percentB > 1;
	const belowBb = percentB != null && percentB < 0;
	const highPct = pctRank != null && pctRank >= 90;
	const lowPct = pctRank != null && pctRank <= 10;
	if (aboveBb && !highPct) note = "단기 볼린저 상단 밖이지만, 긴 구간 백분위는 아직 상위 10%가 아닙니다. σ 밴드와 경험적 분포가 어긋난 상태입니다.";
	else if (belowBb && !lowPct) note = "단기 볼린저 하단 밖이지만, 긴 구간 백분위는 하위 10%가 아닙니다. 단기 변동성만 크게 벗어난 상태입니다.";
	else if (aboveBb && highPct) note = "볼린저 상단과 백분위 상단이 같이 위에 있습니다. 단기 σ와 중기 분포가 모두 비싼 쪽입니다.";
	else if (belowBb && lowPct) note = "볼린저 하단과 백분위 하단이 같이 아래에 있습니다. 단기 σ와 중기 분포가 모두 싼 쪽입니다.";
	else if (percentB != null && percentB > .8 && pctRank != null && pctRank < 60) note = "볼린저 %b는 상단에 가깝고 백분위 순위는 중간입니다. 최근 20봉 변동성이 줄며 밴드가 좁아진 경우입니다.";
	return {
		close,
		bbMid: mid,
		bbUpper: upper,
		bbLower: lower,
		percentB,
		bbWidthPct,
		p10,
		p50,
		p90,
		pctRank,
		window: Math.min(pctWindow, closes.length),
		note
	};
}
var DIVERGENCE_LABEL = {
	"regular-bullish": "정규 상승 다이버전스",
	"regular-bearish": "정규 하락 다이버전스",
	"hidden-bullish": "히든 상승 다이버전스",
	"hidden-bearish": "히든 하락 다이버전스"
};
/**
* Compare two confirmed swings.
* Lows: later price lower + RSI higher = regular bullish. Later price higher + RSI lower = hidden bullish.
* Highs: later price higher + RSI lower = regular bearish. Later price lower + RSI higher = hidden bearish.
* Equal prices or equal RSI are not a divergence.
*/
function classifySwingDivergence(side, earlierPrice, laterPrice, earlierRsi, laterRsi) {
	if (![
		earlierPrice,
		laterPrice,
		earlierRsi,
		laterRsi
	].every((n) => Number.isFinite(n))) return null;
	if (side === "low") {
		if (laterPrice < earlierPrice && laterRsi > earlierRsi) return "regular-bullish";
		if (laterPrice > earlierPrice && laterRsi < earlierRsi) return "hidden-bullish";
		return null;
	}
	if (laterPrice > earlierPrice && laterRsi < earlierRsi) return "regular-bearish";
	if (laterPrice < earlierPrice && laterRsi > earlierRsi) return "hidden-bearish";
	return null;
}
/**
* RSI divergence from confirmed pivots only.
* A pivot needs `right` bars after it, so the signal does not use an unfinished swing.
* On each side the latest regular pair and the latest hidden pair are kept,
* scanning the last six adjacent swings, and only if the later pivot is inside `maxAge`.
* Hidden bullish: higher price low, lower RSI low (uptrend continuation).
* Hidden bearish: lower price high, higher RSI high (downtrend continuation).
*/
function detectRsiDivergences(highs, lows, closes, opts) {
	const rsiPeriod = opts?.rsiPeriod ?? 14;
	const left = opts?.left ?? 5;
	const right = opts?.right ?? 5;
	const maxAge = opts?.maxAge ?? 40;
	if (closes.length < rsiPeriod + left + right + 2) return [];
	const rsi = rsiOf(closes, rsiPeriod);
	const pivots = findPivots(highs, lows, left, right);
	const out = [];
	const consider = (idxs, side, priceOf) => {
		const usable = idxs.filter((i) => rsi[i] != null && Number.isFinite(priceOf[i]));
		if (usable.length < 2) return;
		let latestRegular = null;
		let latestHidden = null;
		const start = Math.max(1, usable.length - 6);
		for (let k = usable.length - 1; k >= start; k--) {
			const i2 = usable[k];
			const i1 = usable[k - 1];
			if (closes.length - 1 - i2 > maxAge) continue;
			if (i2 - i1 < left) continue;
			const kind = classifySwingDivergence(side, priceOf[i1], priceOf[i2], rsi[i1], rsi[i2]);
			if (!kind) continue;
			const item = {
				kind,
				label: DIVERGENCE_LABEL[kind],
				i1,
				i2,
				price1: priceOf[i1],
				price2: priceOf[i2],
				rsi1: rsi[i1],
				rsi2: rsi[i2]
			};
			if (kind.startsWith("hidden")) {
				if (!latestHidden) latestHidden = item;
			} else if (!latestRegular) latestRegular = item;
			if (latestHidden && latestRegular) break;
		}
		if (latestHidden) out.push(latestHidden);
		if (latestRegular) out.push(latestRegular);
	};
	consider(pivots.lowIdx, "low", lows);
	consider(pivots.highIdx, "high", highs);
	return out;
}
function rsiOf(closes, period) {
	return rsi(closes, period);
}
/** Weighted moving average (weights 1..period, newest heaviest). */
function wma(values, period) {
	const out = [];
	const denom = period * (period + 1) / 2;
	for (let i = 0; i < values.length; i++) {
		if (i + 1 < period) {
			out.push(null);
			continue;
		}
		let s = 0;
		for (let j = 0; j < period; j++) s += values[i - period + 1 + j] * (j + 1);
		out.push(s / denom);
	}
	return out;
}
function wmaSparse(values, period) {
	const out = [];
	const denom = period * (period + 1) / 2;
	for (let i = 0; i < values.length; i++) {
		if (i + 1 < period) {
			out.push(null);
			continue;
		}
		let s = 0;
		let ok = true;
		for (let j = 0; j < period; j++) {
			const v = values[i - period + 1 + j];
			if (v == null) {
				ok = false;
				break;
			}
			s += v * (j + 1);
		}
		out.push(ok ? s / denom : null);
	}
	return out;
}
/** Hull moving average: WMA(2·WMA(n/2) − WMA(n), √n). */
function hma(values, period) {
	const half = wma(values, Math.max(1, Math.floor(period / 2)));
	const full = wma(values, period);
	return wmaSparse(values.map((_, i) => half[i] != null && full[i] != null ? 2 * half[i] - full[i] : null), Math.max(1, Math.floor(Math.sqrt(period))));
}
/** True range (first bar: high − low). */
function trueRange(highs, lows, closes) {
	return highs.map((h, i) => i === 0 ? h - lows[i] : Math.max(h - lows[i], Math.abs(h - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
}
/** Wilder smoothing (RMA): first value = SMA of the first `period`, then (prev·(n−1)+x)/n. */
function rma(values, period) {
	const out = [];
	let prev = null;
	let sum = 0;
	for (let i = 0; i < values.length; i++) {
		if (prev == null) {
			sum += values[i];
			if (i + 1 === period) {
				prev = sum / period;
				out.push(prev);
			} else out.push(null);
			continue;
		}
		prev = (prev * (period - 1) + values[i]) / period;
		out.push(prev);
	}
	return out;
}
/** Keltner channel: EMA(close) ± mult · ATR (Wilder). */
function keltner(highs, lows, closes, emaPeriod = 20, atrPeriod = 10, mult = 2) {
	const mid = ema(closes, emaPeriod);
	const a = rma(trueRange(highs, lows, closes), atrPeriod);
	return {
		mid,
		upper: mid.map((m, i) => m != null && a[i] != null ? m + mult * a[i] : null),
		lower: mid.map((m, i) => m != null && a[i] != null ? m - mult * a[i] : null)
	};
}
function rollingMax(values, period) {
	return values.map((_, i) => i + 1 < period ? null : Math.max(...values.slice(i - period + 1, i + 1)));
}
function rollingMin(values, period) {
	return values.map((_, i) => i + 1 < period ? null : Math.min(...values.slice(i - period + 1, i + 1)));
}
/** Donchian channel: highest high / lowest low over `period`, mid = average. */
function donchian(highs, lows, period = 20) {
	const upper = rollingMax(highs, period);
	const lower = rollingMin(lows, period);
	return {
		upper,
		lower,
		mid: upper.map((u, i) => u != null && lower[i] != null ? (u + lower[i]) / 2 : null)
	};
}
/**
* Ichimoku. `spanA`/`spanB` are plotted `displacement` bars ahead: index i
* holds the value computed at i − displacement (no bars are projected past
* the last real bar). `chikou` at i is close[i + displacement].
*/
function ichimoku(highs, lows, closes, tenkanP = 9, kijunP = 26, spanBP = 52, displacement = 26) {
	const mid = (p) => {
		const hi = rollingMax(highs, p);
		const lo = rollingMin(lows, p);
		return hi.map((h, i) => h != null && lo[i] != null ? (h + lo[i]) / 2 : null);
	};
	const tenkan = mid(tenkanP);
	const kijun = mid(kijunP);
	const rawB = mid(spanBP);
	const rawA = tenkan.map((t, i) => t != null && kijun[i] != null ? (t + kijun[i]) / 2 : null);
	const shift = (s) => s.map((_, i) => i - displacement >= 0 ? s[i - displacement] : null);
	const chikou = closes.map((_, i) => i + displacement < closes.length ? closes[i + displacement] : null);
	return {
		tenkan,
		kijun,
		spanA: shift(rawA),
		spanB: shift(rawB),
		chikou
	};
}
/** Parabolic SAR (Wilder): step/max acceleration. First value at index 1. */
function parabolicSar(highs, lows, step = .02, maxStep = .2) {
	const n = highs.length;
	const out = new Array(n).fill(null);
	if (n < 2) return out;
	let up = highs[1] + lows[1] >= highs[0] + lows[0];
	let sar = up ? lows[0] : highs[0];
	let ep = up ? highs[1] : lows[1];
	let af = step;
	out[1] = sar;
	for (let i = 2; i < n; i++) {
		sar = sar + af * (ep - sar);
		if (up) {
			sar = Math.min(sar, lows[i - 1], lows[i - 2]);
			if (lows[i] < sar) {
				up = false;
				sar = ep;
				ep = lows[i];
				af = step;
			} else if (highs[i] > ep) {
				ep = highs[i];
				af = Math.min(af + step, maxStep);
			}
		} else {
			sar = Math.max(sar, highs[i - 1], highs[i - 2]);
			if (highs[i] > sar) {
				up = true;
				sar = ep;
				ep = highs[i];
				af = step;
			} else if (lows[i] < ep) {
				ep = lows[i];
				af = Math.min(af + step, maxStep);
			}
		}
		out[i] = sar;
	}
	return out;
}
/** Supertrend (ATR Wilder). direction 1 = up (line below price), −1 = down. */
function supertrend(highs, lows, closes, period = 10, mult = 3) {
	const a = rma(trueRange(highs, lows, closes), period);
	const value = [];
	const direction = [];
	let fu = 0;
	let fl = 0;
	let dir = 1;
	let started = false;
	for (let i = 0; i < closes.length; i++) {
		if (a[i] == null) {
			value.push(null);
			direction.push(null);
			continue;
		}
		const hl2 = (highs[i] + lows[i]) / 2;
		const bu = hl2 + mult * a[i];
		const bl = hl2 - mult * a[i];
		if (!started) {
			fu = bu;
			fl = bl;
			dir = closes[i] >= hl2 ? 1 : -1;
			started = true;
		} else {
			const pc = closes[i - 1];
			fu = bu < fu || pc > fu ? bu : fu;
			fl = bl > fl || pc < fl ? bl : fl;
			if (dir === -1 && closes[i] > fu) dir = 1;
			else if (dir === 1 && closes[i] < fl) dir = -1;
		}
		value.push(dir === 1 ? fl : fu);
		direction.push(dir);
	}
	return {
		value,
		direction
	};
}
/** Anchored VWAP from `anchor` (inclusive); null before the anchor. */
function anchoredVwap(highs, lows, closes, volumes, anchor) {
	const out = [];
	let pv = 0;
	let v = 0;
	for (let i = 0; i < closes.length; i++) {
		if (i < anchor) {
			out.push(null);
			continue;
		}
		const vol = Math.max(volumes[i], 0);
		pv += (highs[i] + lows[i] + closes[i]) / 3 * vol;
		v += vol;
		out.push(v > 0 ? pv / v : null);
	}
	return out;
}
/** On-balance volume (starts at 0). */
function obv(closes, volumes) {
	const out = [];
	let acc = 0;
	for (let i = 0; i < closes.length; i++) {
		if (i > 0) {
			if (closes[i] > closes[i - 1]) acc += volumes[i];
			else if (closes[i] < closes[i - 1]) acc -= volumes[i];
		}
		out.push(acc);
	}
	return out;
}
/**
* Volume profile over the given bars: each bar's volume is spread evenly over
* the rows its high–low range touches. POC = middle of the max-volume row;
* value area grows from the POC toward the larger neighbour until `valueArea`.
*/
function volumeProfile(bars, rowCount = 24, valueArea = .7, basis = "volume") {
	if (!bars.length) return {
		rows: [],
		poc: null,
		vah: null,
		val: null
	};
	const lo = Math.min(...bars.map((b) => b.low));
	const span = Math.max(...bars.map((b) => b.high)) - lo;
	const n = span > 0 ? rowCount : 1;
	const size = span > 0 ? span / n : 1;
	const rows = Array.from({ length: n }, (_, i) => ({
		low: lo + i * size,
		high: lo + (i + 1) * size,
		volume: 0
	}));
	for (const b of bars) {
		const px = basis === "turnover" ? b.close ?? (b.high + b.low) / 2 : 1;
		const v = Math.max(b.volume, 0) * (basis === "turnover" ? Math.max(px, 0) : 1);
		if (!v) continue;
		const a = span > 0 ? Math.min(n - 1, Math.floor((b.low - lo) / size)) : 0;
		const z = span > 0 ? Math.min(n - 1, Math.floor((Math.max(b.high, b.low) - lo) / size)) : 0;
		const share = v / (z - a + 1);
		for (let r = a; r <= z; r++) rows[r].volume += share;
	}
	let pocIdx = 0;
	for (let i = 1; i < n; i++) if (rows[i].volume > rows[pocIdx].volume) pocIdx = i;
	const total = rows.reduce((s, r) => s + r.volume, 0);
	let lowI = pocIdx;
	let highI = pocIdx;
	let acc = rows[pocIdx].volume;
	while (total > 0 && acc / total < valueArea && (lowI > 0 || highI < n - 1)) {
		const below = lowI > 0 ? rows[lowI - 1].volume : -1;
		if ((highI < n - 1 ? rows[highI + 1].volume : -1) >= below) acc += rows[++highI].volume;
		else acc += rows[--lowI].volume;
	}
	return {
		rows,
		poc: (rows[pocIdx].low + rows[pocIdx].high) / 2,
		vah: rows[highI].high,
		val: rows[lowI].low
	};
}
/** Stochastic RSI: %K = SMA(k) of the stochastic of RSI, %D = SMA(d) of %K. */
function stochRsi(closes, rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3) {
	const r = rsi(closes, rsiPeriod);
	const raw = r.map((v, i) => {
		if (v == null || i + 1 < stochPeriod) return null;
		const win = r.slice(i - stochPeriod + 1, i + 1);
		if (win.some((x) => x == null)) return null;
		const hh = Math.max(...win);
		const ll = Math.min(...win);
		return hh - ll > 0 ? (v - ll) / (hh - ll) * 100 : null;
	});
	const smooth = (s, p) => s.map((_, i) => {
		if (i + 1 < p) return null;
		const win = s.slice(i - p + 1, i + 1);
		return win.some((x) => x == null) ? null : win.reduce((a, b) => a + b, 0) / p;
	});
	const k = smooth(raw, kSmooth);
	return {
		k,
		d: smooth(k, dSmooth)
	};
}
/** ADX / +DI / −DI (Wilder). */
function adx(highs, lows, closes, period = 14) {
	const n = highs.length;
	const pdm = [0];
	const mdm = [0];
	for (let i = 1; i < n; i++) {
		const up = highs[i] - highs[i - 1];
		const dn = lows[i - 1] - lows[i];
		pdm.push(up > dn && up > 0 ? up : 0);
		mdm.push(dn > up && dn > 0 ? dn : 0);
	}
	const tr = trueRange(highs, lows, closes);
	const sm = (xs) => {
		return [null, ...rma(xs.slice(1), period)];
	};
	const atrS = sm(tr);
	const pS = sm(pdm);
	const mS = sm(mdm);
	const plusDi = atrS.map((a, i) => a != null && a > 0 && pS[i] != null ? 100 * pS[i] / a : null);
	const minusDi = atrS.map((a, i) => a != null && a > 0 && mS[i] != null ? 100 * mS[i] / a : null);
	const dx = plusDi.map((p, i) => {
		const m = minusDi[i];
		if (p == null || m == null) return null;
		return p + m > 0 ? 100 * Math.abs(p - m) / (p + m) : 0;
	});
	const firstDx = dx.findIndex((v) => v != null);
	const adxOut = new Array(n).fill(null);
	if (firstDx >= 0) rma(dx.slice(firstDx), period).forEach((v, j) => adxOut[firstDx + j] = v);
	return {
		adx: adxOut,
		plusDi,
		minusDi
	};
}
/** Commodity channel index (mean deviation, 0.015 constant). */
function cci(highs, lows, closes, period = 20) {
	const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
	const m = sma(tp, period);
	return tp.map((v, i) => {
		if (m[i] == null) return null;
		let md = 0;
		for (let j = i - period + 1; j <= i; j++) md += Math.abs(tp[j] - m[i]);
		md /= period;
		return md > 0 ? (v - m[i]) / (.015 * md) : 0;
	});
}
/** Money flow index. */
function mfi(highs, lows, closes, volumes, period = 14) {
	const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
	return tp.map((_, i) => {
		if (i < period) return null;
		let pos = 0;
		let neg = 0;
		for (let j = i - period + 1; j <= i; j++) {
			const flow = tp[j] * volumes[j];
			if (tp[j] > tp[j - 1]) pos += flow;
			else if (tp[j] < tp[j - 1]) neg += flow;
		}
		if (neg === 0) return pos === 0 ? 50 : 100;
		return 100 - 100 / (1 + pos / neg);
	});
}
/** Williams %R (−100…0). */
function williamsR(highs, lows, closes, period = 14) {
	const hh = rollingMax(highs, period);
	const ll = rollingMin(lows, period);
	return closes.map((c, i) => hh[i] != null && ll[i] != null && hh[i] - ll[i] > 0 ? (hh[i] - c) / (hh[i] - ll[i]) * -100 : null);
}
/** Pivot points from the previous period's high/low/close. */
function pivotPoints(high, low, close, kind = "classic") {
	const p = (high + low + close) / 3;
	const r = high - low;
	if (kind === "fibonacci") return {
		p,
		r1: p + .382 * r,
		r2: p + .618 * r,
		r3: p + r,
		s1: p - .382 * r,
		s2: p - .618 * r,
		s3: p - r
	};
	if (kind === "camarilla") return {
		p,
		r1: close + r * 1.1 / 12,
		r2: close + r * 1.1 / 6,
		r3: close + r * 1.1 / 4,
		s1: close - r * 1.1 / 12,
		s2: close - r * 1.1 / 6,
		s3: close - r * 1.1 / 4
	};
	return {
		p,
		r1: 2 * p - low,
		r2: p + r,
		r3: high + 2 * (p - low),
		s1: 2 * p - high,
		s2: p - r,
		s3: low - 2 * (high - p)
	};
}
/** Rolling N-bar high/low (default 252 = 52 weeks of daily bars), using bars available so far. */
function highLowN(highs, lows, lookback = 252) {
	return {
		high: highs.map((_, i) => Math.max(...highs.slice(Math.max(0, i - lookback + 1), i + 1))),
		low: lows.map((_, i) => Math.min(...lows.slice(Math.max(0, i - lookback + 1), i + 1)))
	};
}
/** Heikin-Ashi transform (pure). */
function heikinAshi(bars) {
	const out = [];
	for (let i = 0; i < bars.length; i++) {
		const b = bars[i];
		const close = (b.open + b.high + b.low + b.close) / 4;
		const open = i === 0 ? (b.open + b.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2;
		out.push({
			...b,
			open,
			close,
			high: Math.max(b.high, open, close),
			low: Math.min(b.low, open, close)
		});
	}
	return out;
}
/**
* Drawing model (F7.7): time/price anchors (bar-time keyed so drawings survive
* reloads), geometry helpers, fib/position/measure maths, magnet + KRX tick
* snapping, and an undo/redo history reducer. Pure module.
*/
var DRAWING_TOOLS = [
	{
		type: "trend",
		label: "추세선",
		key: "t",
		anchors: 2
	},
	{
		type: "ray",
		label: "레이",
		key: "r",
		anchors: 2
	},
	{
		type: "extended",
		label: "연장선",
		key: "e",
		anchors: 2
	},
	{
		type: "hline",
		label: "수평선",
		key: "h",
		anchors: 1
	},
	{
		type: "hray",
		label: "수평 레이",
		key: "j",
		anchors: 1
	},
	{
		type: "vline",
		label: "수직선",
		key: "v",
		anchors: 1
	},
	{
		type: "channel",
		label: "평행 채널",
		key: "c",
		anchors: 3
	},
	{
		type: "rect",
		label: "사각형",
		key: "b",
		anchors: 2
	},
	{
		type: "fib",
		label: "피보나치 되돌림",
		key: "f",
		anchors: 2
	},
	{
		type: "fibext",
		label: "피보나치 확장",
		key: "x",
		anchors: 3
	},
	{
		type: "measure",
		label: "측정",
		key: "m",
		anchors: 2
	},
	{
		type: "long",
		label: "롱 포지션",
		key: "l",
		anchors: 2
	},
	{
		type: "short",
		label: "숏 포지션",
		key: "s",
		anchors: 2
	},
	{
		type: "text",
		label: "텍스트",
		key: "n",
		anchors: 1
	},
	{
		type: "arrow",
		label: "화살표",
		key: "a",
		anchors: 2
	}
];
function anchorsFor(type) {
	return DRAWING_TOOLS.find((t) => t.type === type)?.anchors ?? 2;
}
function newDrawing(type, anchors, id, opts = {}) {
	let a = anchors;
	if ((type === "long" || type === "short") && anchors.length === 2) {
		const [entry, target] = anchors;
		a = [
			entry,
			target,
			{
				t: target.t,
				p: entry.p - (target.p - entry.p) / 2
			}
		];
	}
	const d = {
		id,
		type,
		anchors: a,
		color: opts.color ?? (type === "long" ? "#22c55e" : type === "short" ? "#ef4444" : "#f59e0b"),
		width: opts.width ?? 2,
		locked: false,
		hidden: false
	};
	const text = opts.text ?? (type === "text" ? "메모" : void 0);
	if (text !== void 0) d.text = text;
	return d;
}
var FIB_RETRACEMENT = [
	0,
	.236,
	.382,
	.5,
	.618,
	.786,
	1
];
var FIB_EXTENSION = [
	.618,
	1,
	1.272,
	1.618,
	2.618
];
/** Retracement from `from` (level 1) to `to` (level 0). */
function fibRetracementLevels(from, to) {
	return FIB_RETRACEMENT.map((level) => ({
		level,
		price: to - (to - from) * level
	}));
}
/** Extension of the A→B move projected from C. */
function fibExtensionLevels(a, b, c) {
	return FIB_EXTENSION.map((level) => ({
		level,
		price: c + (b - a) * level
	}));
}
function positionStats(side, entry, target, stop) {
	const risk = side === "long" ? entry - stop : stop - entry;
	const reward = side === "long" ? target - entry : entry - target;
	return {
		side,
		entry,
		stop,
		target,
		risk,
		reward,
		rr: risk > 0 ? reward / risk : null,
		stopPct: entry ? (stop - entry) / entry * 100 : 0,
		targetPct: entry ? (target - entry) / entry * 100 : 0
	};
}
function distToSegment(p, a, b, mode = "segment") {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len2 = dx * dx + dy * dy;
	if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
	let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
	if (mode === "segment") t = Math.max(0, Math.min(1, t));
	else if (mode === "ray") t = Math.max(0, t);
	return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
/** Extend a→b to the given x bounds (for rays / extended lines). */
function extendLine(a, b, minX, maxX, mode) {
	if (a.x === b.x) return [a, b];
	const slope = (b.y - a.y) / (b.x - a.x);
	const at = (x) => ({
		x,
		y: a.y + slope * (x - a.x)
	});
	const end = at((b.x > a.x ? 1 : -1) > 0 ? maxX : minX);
	return mode === "ray" ? [a, end] : [at(minX), at(maxX)];
}
/** Magnet: nearest of O/H/L/C. */
function magnetPrice(price, bar) {
	if (!bar) return price;
	let best = bar.close;
	for (const v of [
		bar.open,
		bar.high,
		bar.low,
		bar.close
	]) if (Math.abs(v - price) < Math.abs(best - price)) best = v;
	return best;
}
function snapPrice(price, opts) {
	const p = opts.magnet ? magnetPrice(price, opts.bar) : price;
	if (opts.market === "KR") return snapToKrxTick(p, opts.instrument ?? "stock");
	return Math.round(p * 100) / 100;
}
function initHistory(items = []) {
	return {
		items,
		past: [],
		future: []
	};
}
function commit(h, items) {
	return {
		items,
		past: [...h.past, h.items].slice(-100),
		future: []
	};
}
/** Locked drawings cannot be moved/edited (only unlocked, hidden/shown or removed via the manager). */
function drawingReducer(h, a) {
	switch (a.type) {
		case "add": return commit(h, [...h.items, a.drawing]);
		case "update": {
			const cur = h.items.find((d) => d.id === a.id);
			if (!cur) return h;
			const editsGeometry = a.patch.anchors !== void 0 || a.patch.color !== void 0 || a.patch.width !== void 0 || a.patch.text !== void 0;
			if (cur.locked && editsGeometry) return h;
			return commit(h, h.items.map((d) => d.id === a.id ? {
				...d,
				...a.patch
			} : d));
		}
		case "remove": return h.items.some((d) => d.id === a.id) ? commit(h, h.items.filter((d) => d.id !== a.id)) : h;
		case "clear": return h.items.length ? commit(h, []) : h;
		case "reset": return initHistory(a.items);
		case "undo":
			if (!h.past.length) return h;
			return {
				items: h.past[h.past.length - 1],
				past: h.past.slice(0, -1),
				future: [h.items, ...h.future].slice(0, 100)
			};
		case "redo": {
			if (!h.future.length) return h;
			const [next, ...rest] = h.future;
			return {
				items: next,
				past: [...h.past, h.items].slice(-100),
				future: rest
			};
		}
	}
}
var VP_STYLE = {
	widthRatio: .1,
	opacity: .22,
	showVa: true,
	showPoc: true,
	hoverPrice: null
};
var BasePrimitive = class {
	chart = null;
	series = null;
	requestUpdate = null;
	view;
	constructor(z, background = false) {
		const renderer = background ? {
			draw: () => void 0,
			drawBackground: (t) => this.render(t)
		} : { draw: (t) => this.render(t) };
		this.view = {
			zOrder: () => z,
			renderer: () => renderer
		};
	}
	attached(p) {
		this.chart = p.chart;
		this.series = p.series;
		this.requestUpdate = p.requestUpdate;
	}
	detached() {
		this.chart = null;
		this.series = null;
		this.requestUpdate = null;
	}
	paneViews() {
		return [this.view];
	}
	update() {
		this.requestUpdate?.();
	}
	x(t) {
		const c = this.chart?.timeScale().timeToCoordinate(t);
		return c == null ? null : c;
	}
	y(p) {
		const c = this.series?.priceToCoordinate(p);
		return c == null ? null : c;
	}
	pt(a) {
		const x = this.x(a.t);
		const y = this.y(a.p);
		return x == null || y == null ? null : {
			x,
			y
		};
	}
	render(target) {
		target.useMediaCoordinateSpace(({ context, mediaSize }) => this.paint(context, mediaSize.width, mediaSize.height));
	}
};
function label(ctx, text, x, y, color, align = "left") {
	ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
	ctx.textAlign = align;
	ctx.textBaseline = "middle";
	const w = ctx.measureText(text).width + 8;
	const bx = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
	ctx.fillStyle = "rgba(15,23,42,0.78)";
	ctx.fillRect(bx, y - 8, w, 16);
	ctx.fillStyle = color;
	ctx.fillText(text, align === "right" ? x - 4 : align === "center" ? x : x + 4, y);
}
function line(ctx, a, b) {
	ctx.beginPath();
	ctx.moveTo(a.x, a.y);
	ctx.lineTo(b.x, b.y);
	ctx.stroke();
}
function alpha(color, a) {
	const m = /^#([0-9a-f]{6})$/i.exec(color);
	if (!m) return color;
	const n = parseInt(m[1], 16);
	return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
/** All drawings + selection handles + in-progress preview. */
var DrawingPrimitive = class extends BasePrimitive {
	drawings = [];
	selectedId = null;
	preview = null;
	formatPrice = (p) => String(p);
	barsBetween = () => null;
	constructor() {
		super("top");
	}
	set(drawings, selectedId, preview) {
		this.drawings = drawings;
		this.selectedId = selectedId;
		this.preview = preview;
		this.update();
	}
	/** Pixel hit test (handles first, then bodies). */
	hit(x, y, tol = 6) {
		const w = this.chartWidth();
		const p = {
			x,
			y
		};
		for (const d of [...this.drawings].reverse()) {
			if (d.hidden) continue;
			if (d.id === this.selectedId) {
				const idx = d.anchors.findIndex((a) => {
					const q = this.anchorPoint(d, a);
					return q != null && Math.abs(q.x - x) <= tol + 2 && Math.abs(q.y - y) <= tol + 2;
				});
				if (idx >= 0) return {
					id: d.id,
					handle: idx
				};
			}
			if (this.distance(d, p, w) <= tol) return {
				id: d.id,
				handle: null
			};
		}
		return null;
	}
	chartWidth() {
		return this.chart?.timeScale().width() ?? 2e3;
	}
	anchorPoint(d, a) {
		if (d.type === "hline") {
			const y = this.y(a.p);
			return y == null ? null : {
				x: this.chartWidth() - 30,
				y
			};
		}
		return this.pt(a);
	}
	distance(d, p, w) {
		const [a, b, c] = d.anchors.map((a) => this.pt(a));
		switch (d.type) {
			case "hline": {
				const y = this.y(d.anchors[0].p);
				return y == null ? Infinity : Math.abs(p.y - y);
			}
			case "hray":
				if (!a) return Infinity;
				return p.x >= a.x - 4 ? Math.abs(p.y - a.y) : Infinity;
			case "vline": return a ? Math.abs(p.x - a.x) : Infinity;
			case "text": return a ? Math.hypot(p.x - a.x - 20, p.y - a.y) - 18 : Infinity;
			case "trend":
			case "arrow":
			case "measure": return a && b ? distToSegment(p, a, b) : Infinity;
			case "ray": return a && b ? distToSegment(p, a, b, "ray") : Infinity;
			case "extended": return a && b ? distToSegment(p, a, b, "line") : Infinity;
			case "channel": {
				if (!a || !b) return Infinity;
				const d1 = distToSegment(p, a, b);
				if (!c) return d1;
				const off = this.channelOffset(a, b, c);
				return Math.min(d1, distToSegment(p, {
					x: a.x,
					y: a.y + off
				}, {
					x: b.x,
					y: b.y + off
				}));
			}
			case "rect":
			case "fib":
			case "fibext":
			case "long":
			case "short": {
				if (!a || !b) return Infinity;
				const xs = [
					a.x,
					b.x,
					c?.x ?? a.x
				];
				const ys = [
					a.y,
					b.y,
					c?.y ?? a.y
				];
				const x0 = Math.min(...xs);
				const x1 = d.type === "fib" || d.type === "fibext" ? w : Math.max(...xs);
				const y0 = Math.min(...ys);
				const y1 = Math.max(...ys);
				return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 ? 0 : Infinity;
			}
		}
	}
	channelOffset(a, b, c) {
		if (b.x === a.x) return c.y - a.y;
		return c.y - (a.y + (b.y - a.y) * (c.x - a.x) / (b.x - a.x));
	}
	paint(ctx, w) {
		const all = this.preview ? [...this.drawings, this.preview] : this.drawings;
		for (const d of all) {
			if (d.hidden) continue;
			ctx.save();
			ctx.strokeStyle = d.color;
			ctx.fillStyle = d.color;
			ctx.lineWidth = d.width;
			ctx.setLineDash(d === this.preview ? [5, 4] : []);
			this.paintOne(ctx, d, w);
			ctx.restore();
			if (d.id === this.selectedId) this.paintHandles(ctx, d);
		}
	}
	paintHandles(ctx, d) {
		ctx.save();
		for (const a of d.anchors) {
			const q = this.anchorPoint(d, a);
			if (!q) continue;
			ctx.fillStyle = "#ffffff";
			ctx.strokeStyle = d.color;
			ctx.lineWidth = 1.5;
			ctx.fillRect(q.x - 4, q.y - 4, 8, 8);
			ctx.strokeRect(q.x - 4, q.y - 4, 8, 8);
		}
		if (d.locked) {
			const q = d.anchors[0] ? this.anchorPoint(d, d.anchors[0]) : null;
			if (q) label(ctx, "잠금", q.x + 8, q.y - 14, "#fbbf24");
		}
		ctx.restore();
	}
	paintOne(ctx, d, w) {
		const [a, b, c] = d.anchors.map((a) => this.pt(a));
		switch (d.type) {
			case "hline": {
				const y = this.y(d.anchors[0].p);
				if (y == null) return;
				line(ctx, {
					x: 0,
					y
				}, {
					x: w,
					y
				});
				label(ctx, `${d.text ? `${d.text} ` : ""}${this.formatPrice(d.anchors[0].p)}${d.alertId ? " 🔔" : ""}`, w - 4, y - 10, d.color, "right");
				return;
			}
			case "hray":
				if (!a) return;
				line(ctx, a, {
					x: w,
					y: a.y
				});
				label(ctx, this.formatPrice(d.anchors[0].p), w - 4, a.y - 10, d.color, "right");
				return;
			case "vline": {
				const x = this.x(d.anchors[0].t);
				if (x == null) return;
				line(ctx, {
					x,
					y: 0
				}, {
					x,
					y: 4e3
				});
				return;
			}
			case "text":
				if (!a) return;
				label(ctx, d.text ?? "메모", a.x, a.y, d.color);
				return;
			case "trend":
				if (a && b) line(ctx, a, b);
				return;
			case "arrow": {
				if (!a || !b) return;
				line(ctx, a, b);
				const ang = Math.atan2(b.y - a.y, b.x - a.x);
				ctx.beginPath();
				ctx.moveTo(b.x, b.y);
				ctx.lineTo(b.x - 10 * Math.cos(ang - .4), b.y - 10 * Math.sin(ang - .4));
				ctx.lineTo(b.x - 10 * Math.cos(ang + .4), b.y - 10 * Math.sin(ang + .4));
				ctx.closePath();
				ctx.fill();
				return;
			}
			case "ray":
			case "extended": {
				if (!a || !b) return;
				const [p, q] = extendLine(a, b, 0, w, d.type === "ray" ? "ray" : "line");
				line(ctx, p, q);
				return;
			}
			case "channel": {
				if (!a || !b) return;
				line(ctx, a, b);
				if (!c) return;
				const off = this.channelOffset(a, b, c);
				line(ctx, {
					x: a.x,
					y: a.y + off
				}, {
					x: b.x,
					y: b.y + off
				});
				ctx.fillStyle = alpha(d.color, .08);
				ctx.beginPath();
				ctx.moveTo(a.x, a.y);
				ctx.lineTo(b.x, b.y);
				ctx.lineTo(b.x, b.y + off);
				ctx.lineTo(a.x, a.y + off);
				ctx.closePath();
				ctx.fill();
				return;
			}
			case "rect":
				if (!a || !b) return;
				ctx.fillStyle = alpha(d.color, .12);
				ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
				ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
				return;
			case "fib":
			case "fibext": {
				if (!a || !b) return;
				const levels = d.type === "fib" ? fibRetracementLevels(d.anchors[0].p, d.anchors[1].p) : d.anchors[2] ? fibExtensionLevels(d.anchors[0].p, d.anchors[1].p, d.anchors[2].p) : [];
				if (d.type === "fibext") line(ctx, a, b);
				if (d.type === "fibext" && c) line(ctx, b, c);
				const x0 = Math.min(a.x, b.x, c?.x ?? a.x);
				ctx.lineWidth = 1;
				for (const l of levels) {
					const y = this.y(l.price);
					if (y == null) continue;
					line(ctx, {
						x: x0,
						y
					}, {
						x: w,
						y
					});
					label(ctx, `${l.level} (${this.formatPrice(l.price)})`, x0 + 2, y - 8, d.color);
				}
				return;
			}
			case "measure": {
				if (!a || !b) return;
				ctx.fillStyle = alpha(d.color, .1);
				ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
				line(ctx, a, b);
				const p1 = d.anchors[0].p;
				const p2 = d.anchors[1].p;
				const bars = this.barsBetween(d.anchors[0].t, d.anchors[1].t);
				const pct = p1 ? (p2 - p1) / p1 * 100 : 0;
				label(ctx, `${p2 - p1 >= 0 ? "+" : ""}${this.formatPrice(p2 - p1)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)${bars != null ? ` · ${bars}봉` : ""}`, (a.x + b.x) / 2, Math.min(a.y, b.y) - 12, "#e2e8f0", "center");
				return;
			}
			case "long":
			case "short": {
				if (!a || !b) return;
				const entry = d.anchors[0].p;
				const target = d.anchors[1].p;
				const stop = d.anchors[2]?.p ?? entry;
				const x0 = Math.min(a.x, b.x);
				const x1 = Math.max(a.x, b.x, x0 + 40);
				const ye = this.y(entry);
				const yt = this.y(target);
				const ys = this.y(stop);
				if (ye == null || yt == null || ys == null) return;
				ctx.fillStyle = "rgba(34,197,94,0.16)";
				ctx.fillRect(x0, Math.min(ye, yt), x1 - x0, Math.abs(yt - ye));
				ctx.fillStyle = "rgba(239,68,68,0.16)";
				ctx.fillRect(x0, Math.min(ye, ys), x1 - x0, Math.abs(ys - ye));
				ctx.strokeStyle = "#94a3b8";
				ctx.lineWidth = 1;
				line(ctx, {
					x: x0,
					y: ye
				}, {
					x: x1,
					y: ye
				});
				const st = positionStats(d.type, entry, target, stop);
				label(ctx, `목표 ${this.formatPrice(target)} (${st.targetPct >= 0 ? "+" : ""}${st.targetPct.toFixed(2)}%)`, x0 + 2, yt, "#86efac");
				label(ctx, `손절 ${this.formatPrice(stop)} (${st.stopPct >= 0 ? "+" : ""}${st.stopPct.toFixed(2)}%)`, x0 + 2, ys, "#fca5a5");
				label(ctx, `${d.type === "long" ? "롱" : "숏"} ${this.formatPrice(entry)} · R:R ${st.rr != null ? st.rr.toFixed(2) : "—"}`, x0 + 2, ye, "#e2e8f0");
				return;
			}
		}
	}
};
/** Extended-hours shading + session break lines (background; F7.13). */
var SessionPrimitive = class extends BasePrimitive {
	runs = [];
	breaks = [];
	constructor() {
		super("bottom", true);
	}
	set(runs, breaks) {
		this.runs = runs;
		this.breaks = breaks;
		this.update();
	}
	paint(ctx, _w, h) {
		const spacing = (this.chart?.timeScale().options().barSpacing ?? 6) / 2;
		ctx.fillStyle = "rgba(148,163,184,0.10)";
		for (const r of this.runs) {
			const x0 = this.x(r.from);
			const x1 = this.x(r.to);
			if (x0 == null || x1 == null) continue;
			ctx.fillRect(x0 - spacing, 0, x1 - x0 + spacing * 2, h);
		}
		ctx.strokeStyle = "rgba(148,163,184,0.35)";
		ctx.setLineDash([3, 3]);
		ctx.lineWidth = 1;
		for (const t of this.breaks) {
			const x = this.x(t);
			if (x == null) continue;
			line(ctx, {
				x: x - spacing,
				y: 0
			}, {
				x: x - spacing,
				y: h
			});
		}
	}
};
/** Left-edge volume profile. Behind candles; fades before it covers the price path. */
var VolumeProfilePrimitive = class extends BasePrimitive {
	profile = null;
	style = { ...VP_STYLE };
	constructor() {
		super("bottom", true);
	}
	set(profile) {
		this.profile = profile;
		this.update();
	}
	setStyle(style) {
		this.style = {
			...this.style,
			...style
		};
		this.update();
	}
	paint(ctx, w) {
		const vp = this.profile;
		if (!vp || !vp.rows.length) return;
		const max = Math.max(...vp.rows.map((r) => r.volume));
		if (!(max > 0)) return;
		const widthRatio = Math.min(.18, Math.max(.06, this.style.widthRatio));
		const width = Math.max(8, w * widthRatio);
		const base = Math.min(.4, Math.max(.08, this.style.opacity));
		for (const r of vp.rows) {
			const y0 = this.y(r.high);
			const y1 = this.y(r.low);
			if (y0 == null || y1 == null) continue;
			const top = Math.min(y0, y1);
			const bh = Math.abs(y1 - y0);
			const gap = bh > 3 ? 1 : 0;
			const inVa = this.style.showVa && vp.val != null && vp.vah != null && r.low >= vp.val - 1e-9 && r.high <= vp.vah + 1e-9;
			const isPoc = vp.poc != null && r.low <= vp.poc && vp.poc <= r.high;
			const hovered = this.style.hoverPrice != null && r.low <= this.style.hoverPrice && this.style.hoverPrice <= r.high;
			let alpha = inVa ? base + .08 : base * .72;
			if (isPoc) alpha = Math.min(.5, base + .16);
			if (hovered) alpha = Math.min(.55, alpha + .16);
			const bw = Math.max(1, r.volume / max * width);
			const grad = ctx.createLinearGradient(0, 0, bw, 0);
			grad.addColorStop(0, `rgba(148,163,184,${alpha.toFixed(3)})`);
			grad.addColorStop(.72, `rgba(148,163,184,${(alpha * .45).toFixed(3)})`);
			grad.addColorStop(1, "rgba(148,163,184,0)");
			ctx.fillStyle = grad;
			ctx.fillRect(0, top + gap / 2, bw, Math.max(1, bh - gap));
		}
		if (this.style.showPoc && vp.poc != null) {
			const y = this.y(vp.poc);
			if (y != null) {
				ctx.save();
				ctx.strokeStyle = "rgba(148,163,184,0.22)";
				ctx.lineWidth = 1;
				ctx.setLineDash([3, 4]);
				line(ctx, {
					x: 0,
					y
				}, {
					x: w,
					y
				});
				ctx.restore();
			}
		}
	}
};
/** High/low triangles and dashed links. Foreground, above candles and the profile. */
var RangeMarkerPrimitive = class extends BasePrimitive {
	marks = [];
	lastTime = null;
	lastPrice = null;
	constructor() {
		super("top");
	}
	set(marks, lastTime, lastPrice) {
		this.marks = marks;
		this.lastTime = lastTime;
		this.lastPrice = lastPrice;
		this.update();
	}
	paint(ctx, w, h) {
		const lx = this.lastTime != null ? this.x(this.lastTime) : null;
		const ly = this.lastPrice != null ? this.y(this.lastPrice) : null;
		const clear = w * .13;
		for (let i = 0; i < this.marks.length; i++) {
			const m = this.marks[i];
			const x = this.x(m.time);
			const y = this.y(m.price);
			if (x == null || y == null) continue;
			const up = m.role === "high";
			if (lx != null && ly != null) {
				ctx.save();
				ctx.strokeStyle = m.color;
				ctx.globalAlpha = .4;
				ctx.setLineDash([4, 3]);
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(lx, m.place === "last" ? y : ly);
				ctx.stroke();
				ctx.restore();
			}
			triangle(ctx, x, up ? y - 8 : y + 8, up, m.color);
			const anchorX = m.place === "last" && lx != null ? lx : x;
			const text = m.place === "last" ? `${m.title} · ${m.pctText}` : m.title;
			ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
			const tw = ctx.measureText(text).width + 10;
			let tx = Math.max(clear, anchorX + 8);
			let align = "left";
			if (tx + tw > w - 4) {
				tx = Math.max(4, anchorX - 8);
				align = "right";
			}
			const stack = i % 2 * 14;
			const ty = Math.min(h - 12, Math.max(12, (up ? y - 16 : y + 16) + (up ? -stack : stack)));
			label(ctx, text, tx, ty, m.color, align);
			if (m.place === "extreme" && lx != null && ly != null && m.pctText) {
				const py = Math.min(h - 12, Math.max(12, ly + (up ? -14 - stack : 14 + stack)));
				label(ctx, m.pctText, Math.min(w - 8, Math.max(clear, lx - 6)), py, m.color, "right");
			}
		}
	}
};
function triangle(ctx, x, y, up, color) {
	ctx.beginPath();
	if (up) {
		ctx.moveTo(x, y - 5);
		ctx.lineTo(x + 5, y + 4);
		ctx.lineTo(x - 5, y + 4);
	} else {
		ctx.moveTo(x, y + 5);
		ctx.lineTo(x + 5, y - 4);
		ctx.lineTo(x - 5, y - 4);
	}
	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();
	ctx.lineWidth = 1;
	ctx.strokeStyle = "rgba(15,23,42,0.8)";
	ctx.stroke();
}
/**
* Chart helpers (pure): bar replay (F7.12), extended-hours + session breaks
* (F7.13), compare percent-from-first-visible (F7.8), export names + CSV
* (F7.2), bar cap (F7.15).
*/
var MAX_BARS = 1e4;
/** Keep the newest `MAX_BARS` bars (F7.15). */
function capBars(bars, max = MAX_BARS) {
	return bars.length > max ? bars.slice(bars.length - max) : [...bars];
}
var REPLAY_SPEEDS = [
	1,
	2,
	3,
	5,
	10
];
/** Bars visible during replay: everything up to and including `cursor` — never later bars. */
function replaySlice(bars, cursor) {
	if (cursor == null) return [...bars];
	const c = Math.max(0, Math.min(bars.length - 1, Math.floor(cursor)));
	return bars.slice(0, c + 1);
}
/** Next cursor after one tick; null when the replay reached the last bar. */
function replayStep(cursor, total, steps = 1) {
	const next = cursor + Math.max(1, Math.floor(steps));
	return next >= total - 1 ? null : next;
}
/** Tick interval for a speed multiplier (1× = 1 bar / second). */
function replayTickMs(speed) {
	return Math.round(1e3 / Math.max(1, Math.min(10, speed)));
}
function minutesIn(sec, zone) {
	const p = zonedParts(sec * 1e3, zone);
	return {
		day: `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`,
		mins: p.h * 60 + p.mi
	};
}
/**
* Runs of bars outside the regular session (US 09:30–16:00 ET; KR 09:00–15:30
* KST, i.e. NXT/after-hours). Only intraday bars that actually exist are
* shaded — nothing is synthesized.
*/
function extendedHoursRuns(bars, market) {
	const zone = market === "US" ? "America/New_York" : "Asia/Seoul";
	const [open, close] = market === "US" ? [570, 960] : [540, 930];
	const runs = [];
	let cur = null;
	for (const b of bars) {
		if (typeof b.time !== "number") return [];
		const { mins } = minutesIn(b.time, zone);
		if (mins < open || mins >= close) {
			if (cur) cur.to = b.time;
			else cur = {
				from: b.time,
				to: b.time
			};
		} else if (cur) {
			runs.push(cur);
			cur = null;
		}
	}
	if (cur) runs.push(cur);
	return runs;
}
/** First bar time of each new trading day (intraday only). */
function sessionBreaks(bars, market) {
	const zone = market === "US" ? "America/New_York" : "Asia/Seoul";
	const out = [];
	let prev = null;
	for (const b of bars) {
		if (typeof b.time !== "number") return [];
		const { day } = minutesIn(b.time, zone);
		if (prev != null && day !== prev) out.push(b.time);
		prev = day;
	}
	return out;
}
/** Percent change of each value from the first finite value at/after `fromIndex` (AT-37). */
function percentFromFirstVisible(values, fromIndex) {
	let base = null;
	return values.map((v, i) => {
		if (i < fromIndex || v == null || !Number.isFinite(v)) return null;
		if (base == null) base = v;
		return base ? (v - base) / base * 100 : null;
	});
}
/** Align a compare series to base bar times (exact time match only; gaps stay null). */
function alignByTime(baseTimes, other) {
	const map = new Map(other.map((b) => [b.time, b.close]));
	return baseTimes.map((t) => map.get(t) ?? null);
}
function stamp(now) {
	const p = zonedParts(now, "Asia/Seoul");
	const z = (x) => String(x).padStart(2, "0");
	return `${p.y}${z(p.m)}${z(p.d)}-${z(p.h)}${z(p.mi)}`;
}
/** `ked-chart-{market}-{code}-{interval}-{YYYYMMDD-HHmm}.{ext}` (KST) — AT-41. */
function chartExportName(market, code, interval, ext, now) {
	const safe = (s) => s.replace(/[^0-9A-Za-z._-]/g, "");
	return `ked-chart-${market}-${safe(code.toUpperCase())}-${safe(interval)}-${stamp(now)}.${ext}`;
}
function timeLabel(t) {
	if (typeof t === "string") return t;
	const p = zonedParts(t * 1e3, "Asia/Seoul");
	const z = (x) => String(x).padStart(2, "0");
	return `${p.y}-${z(p.m)}-${z(p.d)} ${z(p.h)}:${z(p.mi)} KST`;
}
/** CSV of the given (visible) bars with optional extra columns. */
function barsToCsv(bars, extra = []) {
	const head = [
		"time",
		"open",
		"high",
		"low",
		"close",
		"volume",
		...extra.map((e) => e.name)
	];
	const rows = bars.map((b, i) => [
		timeLabel(b.time),
		b.open,
		b.high,
		b.low,
		b.close,
		b.volume,
		...extra.map((e) => e.values[i] ?? "")
	].join(","));
	return [head.join(","), ...rows].join("\n");
}
/** Visible index window from a logical range, clamped to the data. */
function visibleWindow(total, range) {
	if (!range || total === 0) return {
		from: 0,
		to: Math.max(0, total - 1)
	};
	return {
		from: Math.max(0, Math.ceil(range.from)),
		to: Math.min(total - 1, Math.floor(range.to))
	};
}
//#endregion
export { pivotPoints as $, donchian as A, heikinAshi as B, chartExportName as C, williamsR as Ct, createProChart as D, computeSeriesRangePosition as E, ema as F, keltner as G, hma as H, extendedHoursRuns as I, mfi as J, lastNumber as K, formatChartPercent as L, downloadCsv as M, downloadSvgAsPng as N, detectMacdCrosses as O, drawingReducer as P, percentFromFirstVisible as Q, formatChartPrice as R, cci as S, vwap as St, computeRangePosition as T, ichimoku as U, highLowN as V, initHistory as W, obv as X, newDrawing as Y, parabolicSar as Z, anchorsFor as _, supertrend as _t, DrawingPrimitive as a, readChartTheme as at, bollinger as b, visibleWindow as bt, RangeMarkerPrimitive as c, replayTickMs as ct, SessionPrimitive as d, sessionBreaks as dt, planRangeMarkers as et, StreetTapeRow as f, sma as ft, anchoredVwap as g, streetTape as gt, alignByTime as h, stochastic as ht, DRAWING_TOOLS as i, rangeMarkerText as it, downloadCanvasPng as j, detectRsiDivergences as k, RangePositionStrip as l, rollingPercentileBands as lt, adx as m, stochRsi as mt, ChartAnalyticsStrip as n, proChartOptions as nt, MacdCrossStrip as o, replaySlice as ot, VolumeProfilePrimitive as p, snapPrice as pt, macd as q, ChartShell as r, quantSnapshot as rt, REPLAY_SPEEDS as s, replayStep as st, BandCompareStrip as t, priceFormatFor as tt, RsiDivergenceStrip as u, rsi as ut, atr as v, useChartTheme as vt, compareBollingerAndPercentile as w, wma as wt, capBars as x, volumeProfile as xt, barsToCsv as y, useProChart as yt, formatChartVolume as z };
