import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as getUniverseItem, o as inferSectorId, t as UNIVERSE } from "./universe-BLkYDatc.mjs";
import { d as Star, n as X } from "../_libs/lucide-react.mjs";
import { E as useQuotesByCodes, It as useAppStore, Nt as Input, st as Button, w as useMarketQuotes, z as mergeQuote } from "./router-B1V8nj-n.mjs";
import { n as StockTable } from "./StockTable-DzGDNMwe.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/watchlist-CoGjvC1l.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** F3.5: user US watchlist (persisted), used for tagging, scoring and alerts. */
function UsWatchEditor() {
	const list = useAppStore((s) => s.usWatchlist);
	const add = useAppStore((s) => s.addUsWatch);
	const remove = useAppStore((s) => s.removeUsWatch);
	const [v, setV] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-3",
		"aria-label": "미국 관심종목",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-sm font-semibold",
				children: "미국 관심종목"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-[11px] text-muted-foreground",
				children: "뉴스 태깅($TICKER·회사명), 중요도 점수, 알림 필터에 쓰입니다. 브라우저에 저장."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-2 flex gap-2",
				onSubmit: (e) => {
					e.preventDefault();
					add(v);
					setV("");
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: v,
					onChange: (e) => setV(e.target.value.toUpperCase()),
					placeholder: "예: ISRG",
					className: "h-9 max-w-40 text-xs",
					"aria-label": "미국 티커 추가"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					size: "sm",
					variant: "outline",
					className: "min-h-9",
					children: "추가"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: list.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/us/$symbol",
						params: { symbol: s },
						className: "hover:underline",
						children: s
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => remove(s),
						"aria-label": `${s} 삭제`,
						className: "inline-flex min-h-6 min-w-6 items-center justify-center text-muted-foreground hover:text-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3" })
					})]
				}, s))
			})
		]
	});
}
/** B0.6c: user keyword watch (persisted) — feeds the importance score and alert filters. */
function KeywordWatchEditor() {
	const list = useAppStore((s) => s.keywordWatch);
	const add = useAppStore((s) => s.addKeyword);
	const remove = useAppStore((s) => s.removeKeyword);
	const [v, setV] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-3",
		"aria-label": "키워드 감시",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-sm font-semibold",
				children: "키워드 감시"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-[11px] text-muted-foreground",
				children: "제목·요약에 키워드가 있으면 중요도 +20, 알림 필터(관심종목·키워드 일치)에 포함됩니다. 2자 이상."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-2 flex gap-2",
				onSubmit: (e) => {
					e.preventDefault();
					add(v);
					setV("");
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: v,
					onChange: (e) => setV(e.target.value),
					placeholder: "예: HBM, 휴머노이드, FOMC",
					className: "h-9 max-w-56 text-xs",
					"aria-label": "키워드 추가"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					size: "sm",
					variant: "outline",
					className: "min-h-9",
					children: "추가"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: [list.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[11px] text-muted-foreground",
					children: "등록된 키워드가 없습니다."
				}), list.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px]",
					children: [k, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => remove(k),
						"aria-label": `${k} 삭제`,
						className: "inline-flex min-h-6 min-w-6 items-center justify-center text-muted-foreground hover:text-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3" })
					})]
				}, k))]
			})
		]
	});
}
function WatchlistPage() {
	const watchlist = useAppStore((s) => s.watchlist);
	const add = useAppStore((s) => s.addToWatchlist);
	const { data } = useMarketQuotes();
	const extra = useQuotesByCodes(watchlist);
	const quotes = [...data?.quotes ?? [], ...extra.data?.quotes ?? []];
	const stocks = watchlist.map((c) => {
		const q = quotes.find((x) => x.code === c);
		const meta = getUniverseItem(c) ?? (q ? {
			code: q.code,
			nameKo: q.nameKo,
			nameEn: q.nameEn,
			sectorId: q.sectorId,
			market: q.market
		} : {
			code: c,
			nameKo: c,
			nameEn: c,
			sectorId: inferSectorId(c),
			market: "KOSPI"
		});
		return mergeQuote(meta, q);
	}).filter(Boolean);
	const suggestions = UNIVERSE.filter((s) => !watchlist.includes(s.code)).slice(0, 6);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
				className: "flex items-center gap-2 text-xl font-semibold tracking-tight md:text-2xl",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: "size-5 text-amber-400 fill-amber-400" }), "관심종목"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted-foreground",
				children: "코스피·코스닥 전 종목을 검색해 추가할 수 있습니다. 로컬 저장."
			})] }),
			stocks.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-dashed border-border py-16 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground mb-4",
						children: "아직 관심종목이 없습니다. 상단 검색에서 종목을 찾아 별을 누르세요."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap justify-center gap-2",
						children: suggestions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "outline",
							size: "sm",
							onClick: () => add(s.code),
							children: ["+ ", s.nameKo]
						}, s.code))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/",
							className: "text-xs text-muted-foreground hover:underline",
							children: "대시보드로 돌아가기"
						})
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StockTable, { stocks }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 md:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsWatchEditor, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeywordWatchEditor, {})]
			})
		]
	});
}
//#endregion
export { WatchlistPage as component };
