import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { H as notFound, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { r as SECTOR_BY_ID } from "./sectors-CSrSXBVT.mjs";
import { ft as ChevronRight, z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { B as sectorStatsFromQuotes, L as getStocksBySector, Lt as usePriceColors, Pt as cn, g as DATA_LABEL, o as Route$10, vt as formatPct, w as useMarketQuotes, z as mergeQuote } from "./router-B1V8nj-n.mjs";
import { t as SourceLinks } from "./SourceLinks-BhZNbLNu.mjs";
import { n as StockTable } from "./StockTable-DzGDNMwe.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/industry._sectorId-D926aCIP.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function IndustryPage() {
	const { sectorId } = Route$10.useParams();
	const sector = SECTOR_BY_ID[sectorId];
	const { data, isLoading: queryLoading } = useMarketQuotes();
	const colors = usePriceColors();
	const [mounted, setMounted] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => setMounted(true), []);
	if (!sector) throw notFound();
	const isLoading = queryLoading || !mounted;
	const quotes = mounted ? data?.quotes ?? [] : [];
	const stocks = getStocksBySector(sectorId).map((u) => {
		const q = quotes.find((x) => x.code === u.code);
		return mergeQuote(u, q);
	});
	const stats = sectorStatsFromQuotes(sectorId, quotes);
	const up = stats.avgChangePct > 0;
	const avgColor = stats.avgChangePct === 0 ? "text-muted-foreground" : up ? colors.up : colors.down;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
				className: "flex items-center gap-1 text-xs text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "hover:text-foreground",
						children: "대시보드"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-foreground font-medium",
						children: sector.nameKo
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-col gap-3 md:flex-row md:items-start md:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-2xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
							className: "text-xl font-semibold tracking-tight md:text-2xl",
							children: [
								sector.nameKo,
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-muted-foreground font-normal text-base md:text-lg",
									children: [
										"(",
										sector.nameEn,
										")"
									]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 rounded-xl border border-border bg-card p-3.5 space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-semibold",
									children: "산업 핵심 관점"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-muted-foreground leading-relaxed",
									children: sector.thesis
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceLinks, {
									primaryUrl: sector.sourceUrl,
									primaryLabel: "원문 보기",
									more: sector.moreSources ?? [],
									searchQuery: `${sector.nameKo} 산업 리포트`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/research",
									search: {
										tab: "industry",
										sector: sector.id
									},
									className: "inline-flex text-sm text-primary hover:underline",
									children: "앱 내 산업 리포트 더 보기 →"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[10px] text-muted-foreground",
							children: DATA_LABEL
						})
					]
				}), isLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3 animate-spin" }), " 시세 수신"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 sm:grid-cols-3 gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-border bg-card px-3 py-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[11px] text-muted-foreground",
							children: "섹터 평균 등락"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: cn("mt-0.5 text-lg font-semibold tabular", avgColor),
							children: stats.count ? formatPct(stats.avgChangePct) : "—"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-border bg-card px-3 py-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[11px] text-muted-foreground",
							children: "상승 1위"
						}), stats.topGainer ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-0.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-sm font-medium",
								children: stats.topGainer.nameKo
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: cn("text-xs tabular", colors.up),
								children: formatPct(stats.topGainer.changePct)
							})]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm text-muted-foreground mt-0.5",
							children: "—"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-border bg-card px-3 py-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[11px] text-muted-foreground",
							children: "하락 1위"
						}), stats.topLoser ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-0.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-sm font-medium",
								children: stats.topLoser.nameKo
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: cn("text-xs tabular", colors.down),
								children: formatPct(stats.topLoser.changePct)
							})]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm text-muted-foreground mt-0.5",
							children: "—"
						})]
					})
				]
			}),
			sectorId === "us-linked" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "desk-card desk-card-gold p-3 flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground max-w-xl",
					children: "미국 AI·안보·에너지 수요와 연결된 한국 공급망 종목입니다. 정책 브리프·뉴스·리서치는 미국 연계 데스크에서 모읍니다."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/us-link",
					className: "text-xs font-medium text-primary hover:underline shrink-0",
					children: "미국 연계 데스크 →"
				})]
			}),
			sectorId === "robotics" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "desk-card desk-card-gold p-3 flex flex-wrap items-center justify-between gap-2",
				"data-testid": "robotics-crosslink",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground max-w-xl",
					children: "로봇 기업 시세·시장 동향·정책·리서치·로봇 ETF는 로봇 섹션에서 한 번에 봅니다."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/robotics",
					className: "inline-flex min-h-9 items-center text-xs font-medium text-primary hover:underline shrink-0",
					children: "로봇 섹션 열기 →"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StockTable, { stocks })
		]
	});
}
//#endregion
export { IndustryPage as component };
