import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as getUniverseItem, o as inferSectorId } from "./universe-BLkYDatc.mjs";
import { d as sortReportsNewestFirst, s as reportDay } from "./mappers-DlpCqw-E.mjs";
import { n as SECTORS, t as FOCUS_SECTOR_IDS } from "./sectors-CSrSXBVT.mjs";
import { t as matchesSearchQuery } from "./search-match-BMQS9B1C.mjs";
import { S as topMovers, p as equalWeightChange } from "./classify-DLKCwe5y.mjs";
import { n as RESEARCH_SECTOR_RULES } from "./research-taxonomy-BpoDpMeG.mjs";
import { $ as FileText, G as Layers, Ot as ArrowRight, T as Radio, Y as Gauge, Z as Flag, at as ExternalLink, b as Search, bt as Bot, d as Star, gt as ChartLine, jt as Activity, m as SlidersHorizontal, nt as Factory, ot as Earth, tt as FileSearch, z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { B as sectorStatsFromQuotes, D as useResearchDesk, E as useQuotesByCodes, It as useAppStore, Lt as usePriceColors, Nt as Input, Ot as getResearchPdf, Pt as cn, Q as SourceBadge, R as marketMoversFromQuotes, S as useIndustryResearch, U as useWireStore, at as SheetHeader, et as TimeStamp, g as DATA_LABEL, h as DATA_DELAY_NOTE, it as SheetDescription, m as PriceValue, nt as Sheet, ot as SheetTitle, p as PriceChange, rt as SheetContent, st as Button, ut as useMarketSnapshot, vt as formatPct, w as useMarketQuotes, x as useEtfMarket, yt as formatPrice, z as mergeQuote } from "./router-B1V8nj-n.mjs";
import { t as Badge } from "./badge-CgqpWL27.mjs";
import { o as useRoboticsUniverse } from "./use-themes-BkxRsJtl.mjs";
import { t as Panel } from "./DeskLayout-ShwhtDXH.mjs";
import { n as buildResearchExecutiveSummary } from "./research-utils-_RqvZcrM.mjs";
import { t as StockMiniRow } from "./StockTable-DzGDNMwe.mjs";
import { i as reportTime, o as useResearchBriefing, r as openOriginal } from "./ResearchCard-B9UdtEGW.mjs";
import { t as UsResearchDesk } from "./UsResearchDesk-Du-FOQ6b.mjs";
import { t as useMarketStream } from "./use-market-stream-Bd71nqjQ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-Tpsz0l8m.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Deep-fetch rating / TP / PDF / longer body when user opens detail or PDF. */
async function fetchResearchDeepDetail(report) {
	return getResearchPdf({ data: {
		researchId: report.researchId,
		category: report.category
	} });
}
function mergeResearchDeep(report, deep) {
	const preview = deep.previewExtra && (!report.preview || deep.previewExtra.length > report.preview.length) ? deep.previewExtra : report.preview;
	const rating = deep.rating ?? report.rating;
	const targetPrice = deep.targetPrice != null && deep.targetPrice > 0 ? deep.targetPrice : report.targetPrice;
	return {
		...report,
		pdfUrl: deep.pdfUrl || report.pdfUrl,
		pageUrl: deep.pageUrl || report.pageUrl,
		rating,
		targetPrice,
		preview,
		summary: buildResearchExecutiveSummary(preview || report.summary || report.title, report.title),
		hasInvestmentView: Boolean(rating || targetPrice != null && targetPrice > 0)
	};
}
var TABS = [
	{
		id: "industry",
		label: "산업",
		icon: Factory,
		blurb: "섹터별 리포트를 바로 골라 읽는 산업 리서치 터미널"
	},
	{
		id: "market",
		label: "시황·전략",
		icon: ChartLine,
		blurb: "마켓 레이더 · 투자전략 · 수급/스타일 변화"
	},
	{
		id: "economy",
		label: "경제",
		icon: Earth,
		blurb: "환율 · 금리 · 정책 · 거시경제 리서치"
	}
];
function RatingBadge({ rating }) {
	if (!rating) return null;
	const buy = /매수|비중확대|BUY|OUTPERFORM|OVERWEIGHT/i.test(rating);
	const sell = /매도|비중축소|SELL|UNDERPERFORM|UNDERWEIGHT/i.test(rating);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold", buy && "bg-price-up/15 text-price-up", sell && "bg-price-down/15 text-price-down", !buy && !sell && "bg-amber-500/15 text-amber-400"),
		children: rating
	});
}
function listFor(pack, tab) {
	if (tab === "industry") return pack.industry;
	if (tab === "market") return pack.market;
	if (tab === "economy") return pack.economy;
	return pack.featured ?? [];
}
function withinRange(dateText, range) {
	if (range === "all") return true;
	const day = reportDay({ date: dateText });
	if (!day) return true;
	const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
	return Date.now() - Date.parse(`${day}T12:00:00Z`) <= days * 864e5;
}
function ResearchDeskPanel({ pack, loading, defaultTab = "industry", defaultSector, defaultMarket = "KR", onMarketChange, compact = false, showHeader = true }) {
	const data = pack ?? {
		industry: [],
		market: [],
		economy: [],
		featured: []
	};
	const [tab, setTab] = (0, import_react.useState)(defaultTab);
	const [market, setMarket] = (0, import_react.useState)(defaultMarket);
	const [sector, setSector] = (0, import_react.useState)(defaultSector ?? "all");
	const [range, setRange] = (0, import_react.useState)("30d");
	const [query, setQuery] = (0, import_react.useState)("");
	const [broker, setBroker] = (0, import_react.useState)("all");
	const [active, setActive] = (0, import_react.useState)(null);
	const [pdfLoading, setPdfLoading] = (0, import_react.useState)(false);
	const [deepLoading, setDeepLoading] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => setTab(defaultTab), [defaultTab]);
	(0, import_react.useEffect)(() => setSector(defaultSector ?? "all"), [defaultSector]);
	(0, import_react.useEffect)(() => setMarket(defaultMarket), [defaultMarket]);
	function pickMarket(next) {
		setMarket(next);
		onMarketChange?.(next);
	}
	const extraQ = useIndustryResearch(market === "KR" && tab === "industry" && sector !== "all" ? sector : void 0);
	const mergedIndustry = (0, import_react.useMemo)(() => {
		if (sector === "all" || tab !== "industry") return data.industry;
		const extra = extraQ.data?.reports ?? [];
		if (!extra.length) return data.industry;
		const seen = new Set(extra.map((r) => `${r.sourceKind}:${r.researchId}`));
		const rest = data.industry.filter((r) => !seen.has(`${r.sourceKind ?? "naver"}:${r.researchId}`));
		return [...extra, ...rest];
	}, [
		data.industry,
		extraQ.data?.reports,
		sector,
		tab
	]);
	const viewPack = {
		...data,
		industry: mergedIndustry
	};
	const brokers = (0, import_react.useMemo)(() => {
		return [...new Set(listFor(viewPack, tab).map((r) => r.broker).filter(Boolean))].sort();
	}, [viewPack, tab]);
	const list = (0, import_react.useMemo)(() => {
		const q = query.trim();
		const targeted = tab === "industry" && sector !== "all" && (extraQ.data?.reports?.length ?? 0) > 0;
		const filtered = sortReportsNewestFirst(listFor(viewPack, tab)).filter((r) => tab !== "industry" || sector === "all" || targeted || r.sectorIds.includes(sector)).filter((r) => broker === "all" || r.broker === broker).filter((r) => withinRange(r.date, range)).filter((r) => !q || matchesSearchQuery(q, [
			r.title,
			r.summary,
			r.preview,
			r.broker,
			r.nameKo,
			r.code,
			r.categoryLabel,
			r.sourceLabel
		]));
		return compact ? filtered.slice(0, 5) : filtered.slice(0, 80);
	}, [
		viewPack,
		tab,
		sector,
		broker,
		range,
		query,
		compact,
		extraQ.data?.reports
	]);
	async function openDetail(report) {
		setActive(report);
		if (report.sourceKind === "hankyung" && report.pdfUrl) return;
		setDeepLoading(true);
		try {
			const deep = await fetchResearchDeepDetail(report);
			setActive((prev) => prev && prev.researchId === report.researchId ? mergeResearchDeep(prev, deep) : prev);
		} catch {} finally {
			setDeepLoading(false);
		}
	}
	function openPdf(report) {
		const known = report.sourceKind === "hankyung" ? report.pdfUrl || report.pageUrl : report.pdfUrl && /\.pdf($|\?)/i.test(report.pdfUrl) ? report.pdfUrl : null;
		setPdfLoading(!known);
		openOriginal({
			knownUrl: known,
			fallbackUrl: report.pageUrl || "https://finance.naver.com/research/",
			resolve: async () => {
				const merged = mergeResearchDeep(report, await fetchResearchDeepDetail(report));
				setActive((prev) => prev && prev.researchId === report.researchId ? merged : prev);
				return merged.pdfUrl || merged.pageUrl;
			}
		}).finally(() => setPdfLoading(false));
	}
	const tabMeta = TABS.find((t) => t.id === tab);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: cn("space-y-3", showHeader && "rounded-xl border border-border bg-card p-3 md:p-4"),
		children: [
			showHeader && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-semibold",
					children: "리서치 데스크"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-0.5 text-[11px] text-muted-foreground",
					children: "한국 증권사 리포트와 미국 월가 공개 의견을 나눠 봅니다"
				})] }), loading && market === "KR" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin text-muted-foreground" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-1 rounded-lg bg-muted p-1",
				children: [["KR", "한국 주식"], ["US", "미국 주식"]].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => pickMarket(id),
					className: cn("min-h-8 rounded-md px-2.5 py-1.5 text-[12px] font-semibold", market === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
					children: label
				}, id))
			}),
			market === "US" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsResearchDesk, { compact }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-1 rounded-lg bg-muted p-1",
					children: TABS.map((t) => {
						const Icon = t.icon;
						const count = listFor(viewPack, t.id).length;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setTab(t.id),
							className: cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium", tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-3" }),
								t.label,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular opacity-70",
									children: count
								})
							]
						}, t.id);
					})
				}),
				tabMeta && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] text-muted-foreground",
					children: tabMeta.blurb
				}),
				!compact && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-lg border border-border bg-muted/15 p-2.5 space-y-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1 text-[10px] font-semibold text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, { className: "size-3" }), " 리서치 필터"]
						}),
						tab === "industry" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterButton, {
								active: sector === "all",
								onClick: () => setSector("all"),
								children: "전체 산업"
							}), RESEARCH_SECTOR_RULES.map((rule) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterButton, {
								active: sector === rule.sectorId,
								onClick: () => setSector(rule.sectorId),
								children: rule.label
							}, rule.sectorId))]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-2 sm:grid-cols-[1fr_auto_auto]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										value: query,
										onChange: (e) => setQuery(e.target.value),
										placeholder: "제목·요약·종목 검색",
										className: "h-8 pl-8 text-xs"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: broker,
									onChange: (e) => setBroker(e.target.value),
									className: "h-8 rounded-md border border-border bg-background px-2 text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "all",
										children: "전체 증권사"
									}), brokers.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: b,
										children: b
									}, b))]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex gap-1",
									children: [
										["7d", "7일"],
										["30d", "30일"],
										["90d", "90일"],
										["all", "전체"]
									].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterButton, {
										active: range === id,
										onClick: () => setRange(id),
										children: label
									}, id))
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						"표시 ",
						list.length,
						"건",
						extraQ.isFetching && " · 업종 검색 중",
						extraQ.data && sector !== "all" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							" · 네이버 업종 ",
							extraQ.data.naverCount,
							" · 한경 ",
							extraQ.data.hankyungCount
						] })
					] }), tab === "industry" && sector !== "all" && extraQ.data && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: extraQ.data.naverUrl,
							target: "_blank",
							rel: "noopener noreferrer",
							className: "text-primary hover:underline",
							children: [
								"네이버 ",
								extraQ.data.upjongs.join("·"),
								" 원문"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: extraQ.data.hankyungUrl,
							target: "_blank",
							rel: "noopener noreferrer",
							className: "text-primary hover:underline",
							children: "한경 컨센서스"
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "flex flex-col gap-2",
					children: list.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground",
						children: loading ? "리포트 수신 중…" : "현재 필터에 맞는 리포트가 없습니다."
					}) : list.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-lg border border-border bg-card overflow-hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => void openDetail(r),
							className: "w-full px-3 py-3 text-left hover:bg-muted/35",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center gap-1.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											variant: "outline",
											className: "text-[10px]",
											children: r.categoryLabel
										}),
										r.sourceLabel && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											className: "chip-indigo border-0 text-[10px]",
											children: r.sourceLabel
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-medium",
											children: r.broker
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RatingBadge, { rating: r.rating }),
										r.targetPrice != null && r.targetPrice > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[10px] font-semibold tabular",
											children: ["TP ", formatPrice(r.targetPrice)]
										}),
										r.nameKo && r.code && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
											to: "/stock/$ticker",
											params: { ticker: r.code },
											onClick: (e) => e.stopPropagation(),
											className: "text-[10px] text-primary hover:underline",
											children: r.nameKo
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "ml-auto text-[10px] tabular text-muted-foreground",
											children: r.date
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1 text-sm font-medium leading-snug",
									children: r.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 border-l-2 border-foreground/20 pl-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] font-semibold text-muted-foreground",
										children: "핵심요약"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-0.5 line-clamp-3 text-[12px] leading-relaxed text-foreground/95",
										children: r.summary || r.preview || r.title
									})]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2 border-t border-border bg-muted/20 px-3 py-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline min-h-8",
									onClick: () => openPdf(r),
									children: ["원문 보기 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground min-h-8",
									onClick: () => openPdf(r),
									children: "PDF 열기"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground min-h-8 ml-auto",
									onClick: () => void openDetail(r),
									children: "상세"
								})
							]
						})]
					}, `${r.category}-${r.researchId}`))
				}),
				compact && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-1.5",
					children: RESEARCH_SECTOR_RULES.filter((r) => [
						"semiconductors",
						"battery",
						"bio",
						"energy",
						"robotics"
					].includes(r.sectorId)).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/research",
						search: {
							tab: "industry",
							sector: r.sectorId
						},
						className: "rounded-md border border-border px-2 py-1 text-[10px] hover:bg-muted/40",
						children: [r.label, " 리포트"]
					}, r.sectorId))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
					open: !!active,
					onOpenChange: (o) => !o && setActive(null),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, {
						side: "right",
						className: "w-full max-w-lg overflow-y-auto scroll-thin p-0",
						children: active && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, {
							className: "sticky top-0 z-10 border-b border-border bg-card",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, {
								className: "pr-6 text-base leading-snug",
								children: active.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetDescription, {
								asChild: true,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-medium text-foreground",
											children: active.broker
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: active.date }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RatingBadge, { rating: active.rating }),
										deepLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "inline-flex items-center gap-1 text-muted-foreground",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3 animate-spin" }), " 원문 상세 조회"]
										})
									]
								})
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-4 px-4 py-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										size: "sm",
										disabled: pdfLoading || deepLoading,
										onClick: () => openPdf(active),
										className: "gap-1.5",
										children: [pdfLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" }), " PDF / 원문"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										asChild: true,
										size: "sm",
										variant: "outline",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
											href: active.pageUrl || "https://finance.naver.com/research/",
											target: "_blank",
											rel: "noopener noreferrer",
											children: "리서치 페이지 원문"
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-lg border border-border bg-muted/25 p-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[10px] text-muted-foreground",
											children: "투자의견"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-1 min-h-6",
											children: active.rating ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RatingBadge, { rating: active.rating }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs text-muted-foreground",
												children: deepLoading ? "조회 중…" : "원문에 의견 없음/미추출"
											})
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-lg border border-border bg-muted/25 p-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[10px] text-muted-foreground",
											children: "목표주가"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-1 text-base font-semibold tabular min-h-7",
											children: active.targetPrice ? formatPrice(active.targetPrice) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs font-normal text-muted-foreground",
												children: deepLoading ? "조회 중…" : "—"
											})
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-border bg-muted/20 p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[11px] font-semibold",
										children: "핵심요약"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 whitespace-pre-wrap text-sm leading-relaxed",
										children: active.summary || active.preview || active.title
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[10px] text-muted-foreground",
									children: "목록은 경량 표시, 상세·PDF·원문 클릭 시 리서치 API와 원문 페이지를 깊게 조회해 목표가·의견·PDF를 채웁니다. 투자 전 원문·공시를 교차 확인하세요."
								})
							]
						})] })
					})
				})
			] })
		]
	});
}
function FilterButton({ active, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: cn("rounded-md border px-2 py-1 text-[10px] font-medium", active ? "border-foreground/30 bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:text-foreground"),
		children
	});
}
function DecisionSnapshot({ quotes, research, liveConnected, liveReconnecting = false, snapshotAgeMs }) {
	const colors = usePriceColors();
	const [ready, setReady] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setReady(true);
	}, []);
	const liveQuotes = ready ? quotes : [];
	const valid = liveQuotes.filter((q) => q.price > 0);
	const adv = valid.filter((q) => q.changePct > 0).length;
	const dec = valid.filter((q) => q.changePct < 0).length;
	const unchanged = valid.length - adv - dec;
	const breadth = valid.length ? (adv - dec) / valid.length * 100 : 0;
	const sectorRanks = SECTORS.map((s) => ({
		sector: s,
		stats: sectorStatsFromQuotes(s.id, liveQuotes)
	})).filter((x) => x.stats.count > 0).sort((a, b) => b.stats.avgChangePct - a.stats.avgChangePct);
	const leader = sectorRanks[0];
	const laggard = sectorRanks[sectorRanks.length - 1];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "desk-card desk-card-gold p-3.5 md:p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3.5 flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "desk-kicker mb-1",
						children: "Morning Brief"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "desk-section-title text-base",
						children: "Decision Snapshot"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "가격 → 시장 폭 → 주도 산업 → 새 리서치 순으로 판단"
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold", liveConnected ? "bg-price-up/15 text-price-up" : "bg-muted text-muted-foreground"),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-3" }),
						" ",
						liveConnected ? "KIS·KRX LIVE" : ready && liveReconnecting ? "재연결 중" : "스냅샷 모드"
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						icon: Gauge,
						label: "시장 폭 (커버리지 기준)",
						value: `${adv}↑ / ${dec}↓ / ${unchanged}→`,
						sub: `${valid.length}종목 · Breadth ${breadth >= 0 ? "+" : ""}${breadth.toFixed(0)}`,
						className: breadth >= 0 ? colors.up : colors.down
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						icon: Activity,
						label: "주도 / 부진 산업",
						value: leader ? `${leader.sector.nameKo} ${formatPct(leader.stats.avgChangePct)}` : "—",
						sub: laggard ? `${laggard.sector.nameKo} ${formatPct(laggard.stats.avgChangePct)}` : "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						icon: FileSearch,
						label: "신규 산업 리서치",
						value: `${research.length}건`,
						sub: research[0]?.summary || research[0]?.title || "최근 리포트 대기"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						icon: Radio,
						label: "데이터 상태",
						value: liveConnected ? "실시간 체결 스트림" : "20초 스냅샷 백업",
						sub: snapshotAgeMs == null ? "갱신 확인 중" : `스냅샷 ${Math.max(0, Math.round(snapshotAgeMs / 1e3))}초 전`
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-[10px] leading-relaxed text-muted-foreground border-t border-border pt-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
						className: "text-foreground",
						children: "Red Team:"
					}),
					" 시장 폭·주도 산업은 ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "앱 커버리지 종목 샘플" }),
					" 기준이며 전체 코스피/코스닥이 아닙니다. 로테이션 판단 시 왜곡될 수 있습니다. 투자 권유가 아닙니다."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap gap-1.5 border-t border-border pt-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[10px] font-medium text-muted-foreground mr-1",
					children: "산업 리서치 바로가기"
				}), SECTORS.filter((s) => s.focus).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/research",
					search: {
						tab: "industry",
						sector: s.id
					},
					className: "rounded-md border border-border px-2 py-1 text-[10px] hover:bg-muted/50",
					children: s.nameKo
				}, s.id))]
			})
		]
	});
}
function Metric({ icon: Icon, label, value, sub, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "desk-stat",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1 desk-stat-label",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-3" }),
					" ",
					label
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("desk-stat-value", className),
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground",
				children: sub
			})
		]
	});
}
function Card({ title, icon, href, action, children, testId }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "desk-card flex min-w-0 flex-col gap-2 p-3",
		"data-testid": testId,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "inline-flex min-w-0 items-center gap-1.5 truncate text-[12.5px] font-semibold",
				children: [
					icon,
					" ",
					title
				]
			}), action ?? (href && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: href,
				className: "inline-flex min-h-8 shrink-0 items-center whitespace-nowrap text-[11px] font-semibold text-primary hover:underline",
				children: "열기 →"
			}))]
		}), children]
	});
}
function Muted({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-[10.5px] text-muted-foreground",
		children
	});
}
function Pct({ v }) {
	const colors = usePriceColors();
	if (v == null) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "text-muted-foreground",
		children: "—"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("tabular font-semibold", v > 0 && colors.up, v < 0 && colors.down),
		children: formatPct(v)
	});
}
/** Live Wire top 5 from the shared engine (polled by the shell; no extra request). */
function WireCard() {
	const items = useWireStore((s) => s.items);
	const role = useWireStore((s) => s.role);
	const lastError = useWireStore((s) => s.lastError);
	const setDrawerOpen = useWireStore((s) => s.setDrawerOpen);
	const top = items.slice(0, 5);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		title: "Live Wire 최신 5",
		icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-3.5 text-price-up" }),
		testId: "dash-wire",
		action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: () => setDrawerOpen(true),
			className: "inline-flex min-h-8 shrink-0 items-center whitespace-nowrap text-[11px] font-semibold text-primary hover:underline",
			children: "전체 →"
		}),
		children: top.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Muted, { children: lastError ? `와이어 미수신 (${lastError})` : role === "starting" ? "와이어 연결 중…" : "새 항목 대기 중" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-1.5",
			children: top.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "min-w-0 text-[11.5px]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
						publishedAt: it.publishedAt,
						precision: it.precision
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceBadge, { item: it })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					href: it.url,
					target: "_blank",
					rel: "noopener noreferrer",
					className: "line-clamp-2 font-medium hover:underline",
					children: it.title
				})]
			}, it.id))
		})
	});
}
/** 오늘의 리서치: today's counts per v2 category + the 3 newest reports. */
function ResearchCard3({ enabled }) {
	const q = useResearchBriefing({ enabled });
	const b = q.data;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		title: "오늘의 리서치",
		icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3.5 text-desk-indigo" }),
		href: "/research",
		testId: "dash-research",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-1 text-[10.5px]",
				children: [(b?.todayCounts ?? []).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "rounded border border-border px-1.5 py-0.5 tabular",
					children: [
						c.label,
						" ",
						c.count ?? "—"
					]
				}, c.type)), !b && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Muted, { children: q.isError ? "리서치 집계 미수신" : "수신 중…" })]
			}),
			b && b.latest.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Muted, { children: "최신 리포트를 받지 못했습니다 (소스 미검증일 수 있음)." }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-1.5",
				children: (b?.latest ?? []).map((r) => {
					const t = reportTime(r);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "min-w-0 text-[11.5px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
									publishedAt: t.publishedAt,
									precision: t.precision
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: r.broker }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: r.categoryLabel })
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: r.pageUrl,
							target: "_blank",
							rel: "noopener noreferrer",
							className: "line-clamp-2 font-medium hover:underline",
							children: [r.nameKo ? `[${r.nameKo}] ` : "", r.title]
						})]
					}, `${r.v2Type ?? r.category}:${r.researchId}`);
				})
			}),
			b && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-auto text-[10px] text-muted-foreground",
				children: ["네이버 리서치 v2 · 집계 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
					publishedAt: b.fetchedAt,
					precision: "minute"
				})]
			})
		]
	});
}
/** US snapshot: same ids/key as the MarketBar, so the query is shared. */
function UsCard({ enabled }) {
	const q = useMarketSnapshot([
		"spx",
		"ndx",
		"vix",
		"tnx",
		"usdkrw"
	], {
		enabled,
		refetchMs: 18e4
	});
	const rows = q.data?.rows ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		title: "미국 스냅샷",
		icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flag, { className: "size-3.5 text-desk-teal" }),
		href: "/news/us",
		testId: "dash-us",
		children: [rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Muted, { children: q.isError ? "미국 시세 미수신" : "수신 중…" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-1 text-[11.5px]",
			children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-baseline justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate",
					children: r.label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "shrink-0 tabular",
					children: [
						r.price != null ? r.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pct, { v: r.changePct })
					]
				})]
			}, r.id))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-auto text-[10px] text-muted-foreground",
			children: [
				"Yahoo Finance · 지연 시세",
				q.data ? " · 갱신 " : "",
				q.data && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
					publishedAt: q.data.fetchedAt,
					precision: "minute"
				})
			]
		})]
	});
}
/** Robotics snapshot: equal-weight 1D baskets (direct/partial exposure) and the top mover per market. */
function RoboticsCard({ enabled }) {
	const u = useRoboticsUniverse({ enabled });
	const kr = u.kr.filter((r) => r.exposure !== "indirect");
	const us = u.us.filter((r) => r.exposure !== "indirect");
	const rows = [{
		id: "KR",
		label: `KR 바스켓 (${kr.length})`,
		ew: equalWeightChange(kr.map((r) => r.changePct)),
		movers: topMovers(kr, 1)
	}, {
		id: "US",
		label: `US 바스켓 (${us.length})`,
		ew: equalWeightChange(us.map((r) => r.changePct)),
		movers: topMovers(us, 1)
	}];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		title: "로봇 스냅샷",
		icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bot, { className: "size-3.5 text-desk-teal" }),
		href: "/robotics",
		testId: "dash-robotics",
		children: [!u.data ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Muted, { children: u.isError ? "로봇 유니버스 미수신" : "수신 중…" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-1.5 text-[11.5px]",
			children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-baseline justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-medium",
						children: [r.label, " 1D"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pct, { v: r.ew })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-x-2 text-[10.5px] text-muted-foreground",
					children: [
						r.movers.up[0] && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							"▲ ",
							r.movers.up[0].name,
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pct, { v: r.movers.up[0].changePct })
						] }),
						r.movers.down[0] && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							"▼ ",
							r.movers.down[0].name,
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pct, { v: r.movers.down[0].changePct })
						] }),
						!r.movers.up[0] && !r.movers.down[0] && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "확인된 등락 없음" })
					]
				})]
			}, r.id))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-auto text-[10px] text-muted-foreground",
			children: "동일가중 · 간접 노출 제외 · 네이버 시세 / Yahoo(지연)"
		})]
	});
}
/**
* F10.3 dashboard cards. Mounted only after first paint (`deferSecondary`) so
* the quote tape keeps priority; every row keeps its source, time and link.
*/
function DashboardBriefCards({ enabled }) {
	if (!enabled) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
		"aria-busy": "true",
		children: [
			"Live Wire",
			"오늘의 리서치",
			"미국 스냅샷",
			"로봇 스냅샷"
		].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "desk-card min-h-32 p-3 text-[11px] text-muted-foreground",
			children: [t, " 불러오는 중…"]
		}, t))
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
		"data-testid": "dash-brief-cards",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WireCard, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchCard3, { enabled }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsCard, { enabled }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RoboticsCard, { enabled })
		]
	});
}
function SectorTile({ id, nameKo, nameEn, quotes }) {
	const stats = sectorStatsFromQuotes(id, quotes);
	const colors = usePriceColors();
	const up = stats.avgChangePct > 0;
	const color = stats.avgChangePct === 0 ? "text-muted-foreground" : up ? colors.up : colors.down;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/industry/$sectorId",
		params: { sectorId: id },
		className: "group flex flex-col gap-1 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40 hover:border-border",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm font-semibold leading-tight group-hover:underline",
					children: nameKo
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: cn("text-xs font-semibold tabular shrink-0", color),
					children: stats.count ? formatPct(stats.avgChangePct) : "—"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[10px] text-muted-foreground line-clamp-1",
				children: nameEn
			}),
			(stats.topGainer || stats.topLoser) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-1 flex flex-col gap-0.5 text-[11px]",
				children: [stats.topGainer && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground truncate",
						children: stats.topGainer.nameKo
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("tabular", colors.up),
						children: formatPct(stats.topGainer.changePct)
					})]
				}), stats.topLoser && stats.topLoser.code !== stats.topGainer?.code && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground truncate",
						children: stats.topLoser.nameKo
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("tabular", colors.down),
						children: formatPct(stats.topLoser.changePct)
					})]
				})]
			})
		]
	});
}
function Dashboard() {
	const watchlist = useAppStore((s) => s.watchlist);
	const focusMode = useAppStore((s) => s.focusMode);
	const colors = usePriceColors();
	const { data, isLoading, isError, dataUpdatedAt } = useMarketQuotes();
	const [deferSecondary, setDeferSecondary] = (0, import_react.useState)(false);
	const [mounted, setMounted] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setMounted(true);
		const id = window.setTimeout(() => setDeferSecondary(true), 150);
		return () => window.clearTimeout(id);
	}, []);
	const showLoading = isLoading || !mounted;
	const researchQ = useResearchDesk({ enabled: deferSecondary });
	const etfQ = useEtfMarket({
		bucket: "retirement",
		limit: 12,
		enabled: deferSecondary
	});
	const liveStatus = useMarketStream([
		...watchlist,
		"005930",
		"000660",
		"005380",
		"000270",
		"373220",
		"034020",
		"009540",
		"207940",
		"035420",
		"105560"
	]);
	const extra = useQuotesByCodes(watchlist);
	const quotes = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const q of data?.quotes ?? []) map.set(q.code, q);
		for (const q of extra.data?.quotes ?? []) if (!map.has(q.code)) map.set(q.code, q);
		return [...map.values()];
	}, [data?.quotes, extra.data?.quotes]);
	const { gainers, losers } = marketMoversFromQuotes(quotes, 6);
	const watched = watchlist.map((c) => {
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
	}).slice(0, 8);
	const sectorList = focusMode ? SECTORS.filter((s) => FOCUS_SECTOR_IDS.includes(s.id) || s.focus) : SECTORS;
	const marketOpen = mounted && quotes.some((q) => q.marketStatus === "OPEN" || q.marketStatus === "PREOPEN");
	const sessionLabel = !mounted ? "세션 확인 중" : marketOpen ? "정규장 개장" : "장 마감 / 휴장";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "dash-layout",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "area-head page-header flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "desk-kicker mb-1.5",
						children: "Institutional Equity Desk"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "page-title",
						children: "Korea Equity Command Center"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "page-lead",
						children: "시세 → 시장 폭 → 산업 리서치 → 공시 순으로 판단하는 데스크"
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-end gap-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", marketOpen ? "bg-price-up/15 text-price-up" : "bg-muted text-muted-foreground"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-1.5 rounded-full", marketOpen ? "bg-price-up animate-pulse" : "bg-muted-foreground") }), sessionLabel]
							}), mounted && isLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3 animate-spin" }), " 시세"]
							})]
						}),
						mounted && isError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] text-price-down",
							children: "시세 조회 실패 — 자동 재시도"
						}),
						mounted && dataUpdatedAt > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[10px] text-muted-foreground tabular",
							children: ["시세 갱신 ", new Date(dataUpdatedAt).toLocaleTimeString("ko-KR")]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: "outline",
							className: "text-[10px] font-normal",
							children: DATA_LABEL
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground max-w-xs",
							children: DATA_DELAY_NOTE
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "area-snap",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DecisionSnapshot, {
					quotes,
					research: researchQ.data?.industry ?? [],
					liveConnected: liveStatus.connected,
					liveReconnecting: Boolean(liveStatus.enabled && liveStatus.reconnecting),
					snapshotAgeMs: mounted && dataUpdatedAt > 0 ? Date.now() - dataUpdatedAt : null
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "area-brief",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardBriefCards, { enabled: deferSecondary })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				className: "area-etf",
				tone: "gold",
				title: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "size-4 text-desk-gold" }), " ETF · 퇴직연금"] }),
				hint: "실시간 목록 · 레버리지·인버스 제외",
				href: "/etfs",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-1.5",
					children: (etfQ.data?.etfs ?? []).slice(0, 6).map((e) => {
						const pct = e.changePct ?? 0;
						const price = e.price;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/etfs/$code",
							params: { code: e.code },
							className: "flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5 hover:bg-muted/40 min-h-12",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-semibold truncate",
									children: e.nameKo
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-xs text-muted-foreground tabular",
									children: [e.code, e.isNewCandidate ? " · NEW" : ""]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-right shrink-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-semibold tabular",
									children: price ? Number(price).toLocaleString("ko-KR") : "—"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: pct > 0 ? colors.up + " text-xs tabular font-medium" : pct < 0 ? colors.down + " text-xs tabular font-medium" : "text-xs text-muted-foreground tabular",
									children: formatPct(pct)
								})]
							})]
						}, e.code);
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				className: "area-us",
				tone: "teal",
				title: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flag, { className: "size-4 text-desk-teal" }), " 미국 연계 산업"] }),
				hint: "AI·IRA·방산·원전 공급망",
				href: "/us-link",
				hrefLabel: "열기",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/industry/$sectorId",
					params: { sectorId: "us-linked" },
					className: "block rounded-lg border border-desk-gold/30 bg-desk-gold/5 px-3 py-3 hover:bg-desk-gold/10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm font-semibold text-desk-gold",
						children: "미국 연계 섹터 보드"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground leading-relaxed",
						children: "AI 메모리·배터리·방산·전력 밸류체인 종목 등락"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "desk-grid desk-grid-2",
					children: [{
						to: "/us-link",
						label: "미·중 AI 패권",
						sub: "HBM · CHIPS"
					}, {
						to: "/us-link",
						label: "미국 정책",
						sub: "IRA · 관세"
					}].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: x.to,
						className: "rounded-lg border border-border bg-muted/20 px-3 py-2.5 hover:bg-muted/40",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm font-semibold",
							children: x.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted-foreground",
							children: x.sub
						})]
					}, x.label))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				className: "area-research",
				tone: "indigo",
				title: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-4" }), " 리서치 데스크"] }),
				hint: "한국 리포트와 미국 월가 의견을 나눠 바로 선택",
				href: "/research",
				hrefLabel: "전체 열기",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 gap-2 sm:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/research",
							search: { tab: "industry" },
							className: "group flex items-start gap-2.5 rounded-lg border border-border bg-muted/15 px-3 py-2.5 hover:bg-muted/35 transition-colors",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Factory, { className: "size-4 mt-0.5 text-muted-foreground group-hover:text-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs font-semibold",
										children: "산업 리포트"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[11px] text-muted-foreground tabular",
										children: [researchQ.data?.industry.length ?? "—", "건 · 섹터 분석"]
									}),
									researchQ.data?.industry[0] && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-1 text-[11px] line-clamp-2 text-foreground/80",
										children: researchQ.data.industry[0].summary || researchQ.data.industry[0].title
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/research",
							search: { tab: "invest" },
							className: "group flex items-start gap-2.5 rounded-lg border border-border bg-muted/15 px-3 py-2.5 hover:bg-muted/35 transition-colors",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartLine, { className: "size-4 mt-0.5 text-muted-foreground group-hover:text-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs font-semibold",
										children: "시황 · 전략"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[11px] text-muted-foreground tabular",
										children: [researchQ.data?.market.length ?? "—", "건 · 마켓레이더"]
									}),
									researchQ.data?.market[0] && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-1 text-[11px] line-clamp-2 text-foreground/80",
										children: researchQ.data.market[0].summary || researchQ.data.market[0].title
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/research",
							search: { tab: "economy" },
							className: "group flex items-start gap-2.5 rounded-lg border border-border bg-muted/15 px-3 py-2.5 hover:bg-muted/35 transition-colors",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Earth, { className: "size-4 mt-0.5 text-muted-foreground group-hover:text-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs font-semibold",
										children: "경제 · 매크로"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[11px] text-muted-foreground tabular",
										children: [researchQ.data?.economy.length ?? "—", "건 · FX·정책"]
									}),
									researchQ.data?.economy[0] && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-1 text-[11px] line-clamp-2 text-foreground/80",
										children: researchQ.data.economy[0].summary || researchQ.data.economy[0].title
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/research",
							search: { market: "us" },
							className: "group flex items-start gap-2.5 rounded-lg border border-border bg-muted/15 px-3 py-2.5 hover:bg-muted/35 transition-colors",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flag, { className: "size-4 mt-0.5 text-desk-teal group-hover:text-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs font-semibold",
										children: "미국 · 월가"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[11px] text-muted-foreground",
										children: "투자은행 등급 · 목표가 · 기사 원문"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-1 text-[11px] line-clamp-2 text-foreground/80",
										children: "공개된 의견만 요약하고, 카드를 누르면 원문 페이지로 갑니다."
									})
								]
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchDeskPanel, {
					pack: researchQ.data ? {
						industry: researchQ.data.industry,
						market: researchQ.data.market,
						economy: researchQ.data.economy,
						featured: researchQ.data.featured
					} : null,
					loading: researchQ.isLoading,
					defaultTab: "industry",
					compact: true,
					showHeader: false
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "area-watch",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-2 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "desk-section-title",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: "size-4 text-amber-400" }), " 관심종목"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/watchlist",
						className: "text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 min-h-9",
						children: ["전체 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-3" })]
					})]
				}), watched.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "empty-state rounded-lg border border-dashed border-border",
					children: "관심종목을 추가하면 여기에 실시간 시세가 표시됩니다."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "desk-grid desk-grid-4",
					children: watched.map((st) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/stock/$ticker",
						params: { ticker: st.code },
						className: "rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-medium truncate",
									children: st.nameKo
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted-foreground tabular",
									children: st.code
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-right",
								children: st.price > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriceValue, {
									value: st.price,
									changePct: st.changePct,
									size: "sm"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriceChange, {
									change: st.change,
									changePct: st.changePct,
									size: "sm"
								})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted-foreground",
									children: "—"
								})
							})]
						})
					}, st.code))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "area-sectors",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-2 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "desk-section-title",
						children: "산업 커버리지"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted-foreground",
						children: "유니버스 평균 등락"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "desk-grid desk-grid-6",
					children: sectorList.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectorTile, {
						id: s.id,
						nameKo: s.nameKo,
						nameEn: s.nameEn,
						quotes
					}, s.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "area-up desk-card p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: cn("mb-2 text-sm font-semibold", colors.up),
					children: "상승 상위"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-col gap-0.5",
					children: gainers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "empty-state",
						children: showLoading ? "로딩 중…" : "데이터 없음"
					}) : gainers.map((st) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StockMiniRow, { stock: st }, st.code))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "area-down desk-card p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: cn("mb-2 text-sm font-semibold", colors.down),
					children: "하락 상위"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-col gap-0.5",
					children: losers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "empty-state",
						children: showLoading ? "로딩 중…" : "데이터 없음"
					}) : losers.map((st) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StockMiniRow, { stock: st }, st.code))
				})]
			})
		]
	});
}
var SplitComponent = Dashboard;
//#endregion
export { SplitComponent as component };
