import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { l as zonedParts, o as kstToday, s as parseSourceTime, t as dateGroupLabel } from "./time-By5ScNNo.mjs";
import { t as compareNewestFirst } from "./mappers-DlpCqw-E.mjs";
import { n as originalUrlForNote } from "./us-street-Dx2s8JR4.mjs";
import { t as matchesSearchQuery } from "./search-match-BMQS9B1C.mjs";
import { n as RESEARCH_SECTOR_RULES } from "./research-taxonomy-BpoDpMeG.mjs";
import { At as ArrowDownRight, Et as ArrowUpRight, X as Flame, b as Search, p as Sparkles, z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { F as useUsStreet, It as useAppStore, Lt as usePriceColors, Nt as Input, P as useUsOfficialUniverse, Pt as cn, X as EmptyState, ft as useUsCalendar, k as useStreetUniverse, tt as useNow, u as Route$20, yt as formatPrice } from "./router-B1V8nj-n.mjs";
import { t as PageDisclaimer } from "./PageDisclaimer-Dk4wCTj5.mjs";
import { t as AiBriefingPanel } from "./AiBriefingPanel-HuDAM7_1.mjs";
import { t as V2_LABEL, u as targetDeltaPct } from "./naver-v2-C8XzGZTP.mjs";
import { t as PageHeader } from "./PageHeader-aQOrmONW.mjs";
import { a as usePdfPreResolver, c as useResearchList, i as reportTime, n as ResearchCard, o as useResearchBriefing, t as RatingBadge } from "./ResearchCard-B9UdtEGW.mjs";
import { a as toStreetMove, i as UsScopeBanner, n as PublicResearchNote, r as StreetMovesTable, t as OriginTierBadge } from "./UsResearchKit-DK5mRrrP.mjs";
import { t as UsResearchDesk } from "./UsResearchDesk-Du-FOQ6b.mjs";
import { t as ResearchDetailSheet } from "./ResearchDetailSheet-Cdb2zg_Q.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/research-Jwf9NW_1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TABS = [
	{
		id: "all",
		label: "전체"
	},
	{
		id: "company",
		label: V2_LABEL.company
	},
	{
		id: "industry",
		label: V2_LABEL.industry
	},
	{
		id: "invest",
		label: V2_LABEL.invest
	},
	{
		id: "economy",
		label: V2_LABEL.economy
	},
	{
		id: "debenture",
		label: V2_LABEL.debenture
	},
	{
		id: "market",
		label: V2_LABEL.market
	}
];
/** On-screen reports → optional AI briefing input (F9.2): title, extractive summary, broker, time, page link — never PDFs. */
function researchAiItems(reports) {
	return reports.slice(0, 30).map((r) => ({
		id: String(r.researchId),
		title: `${r.nameKo ? `${r.nameKo} · ` : ""}${r.title}`,
		snippet: r.summary || void 0,
		source: r.broker,
		time: reportTime(r).publishedAt ?? "날짜 미상",
		url: r.pageUrl
	}));
}
/** Former fixed coverage names, kept only as part of the 관심종목 filter (F2.2). */
var FEATURED_CODES = [
	"005930",
	"000660",
	"373220",
	"034020",
	"005380",
	"207940",
	"009540"
];
function Chip({ active, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		"aria-pressed": active,
		className: cn("inline-flex min-h-9 items-center rounded-md border px-2 text-[11px] font-medium sm:min-h-7", active ? "border-foreground/30 bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:text-foreground"),
		children
	});
}
function ResearchBriefingStrip() {
	const q = useResearchBriefing();
	const colors = usePriceColors();
	const b = q.data;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "space-y-2 rounded-xl border border-border bg-card p-3",
		"aria-label": "리서치 브리핑",
		"data-testid": "research-briefing",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-1.5 text-[11px]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-semibold",
					children: "오늘 발간"
				}),
				(b?.todayCounts ?? []).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "rounded-md border border-border px-2 py-0.5 tabular",
					children: [
						c.label,
						" ",
						c.count ?? "—"
					]
				}, c.type)),
				q.isLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3 animate-spin text-muted-foreground" }),
				b && b.todayCounts.every((c) => c.count == null) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted-foreground",
					children: "집계를 받지 못했습니다 (소스 미검증일 수 있음)"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-2 md:grid-cols-4",
			children: [
				["up", "down"].map((dir) => {
					const rows = dir === "up" ? b?.up ?? [] : b?.down ?? [];
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-border p-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-1 inline-flex items-center gap-1 text-[11px] font-semibold",
							children: [
								dir === "up" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: cn("size-3.5", colors.up) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDownRight, { className: cn("size-3.5", colors.down) }),
								"목표주가 ",
								dir === "up" ? "상향" : "하향",
								" TOP"
							]
						}), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] text-muted-foreground",
							children: q.isLoading ? "…" : "데이터 없음"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "space-y-0.5 text-[11px]",
							children: rows.map((m, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-baseline justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "min-w-0 truncate",
									children: [
										m.itemCode ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
											to: "/stock/$ticker",
											params: { ticker: m.itemCode },
											className: "hover:underline",
											children: m.itemName ?? m.itemCode
										}) : m.itemName ?? "—",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-muted-foreground",
											children: m.broker
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "shrink-0 tabular",
									children: [m.targetPrice != null ? formatPrice(m.targetPrice) : "—", m.deltaPct != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: cn("ml-1", m.deltaPct > 0 ? colors.up : colors.down),
										children: [
											m.deltaPct > 0 ? "+" : "",
											m.deltaPct.toFixed(1),
											"%"
										]
									})]
								})]
							}, `${m.nid}-${i}`))
						})]
					}, dir);
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-lg border border-border p-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-1 inline-flex items-center gap-1 text-[11px] font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "size-3.5 text-price-up" }), " 주간 인기"]
					}), (b?.weeklyHot ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[10px] text-muted-foreground",
						children: q.isLoading ? "…" : "데이터 없음"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-0.5 text-[11px]",
						children: b.weeklyHot.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "truncate",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: r.pageUrl,
								target: "_blank",
								rel: "noopener noreferrer",
								className: "hover:underline",
								children: r.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[10px] text-muted-foreground",
								children: [" · ", r.broker]
							})]
						}, r.researchId))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-lg border border-border p-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-1 inline-flex items-center gap-1 text-[11px] font-semibold",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5 text-desk-indigo" }),
							" 신규 커버리지 ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-normal text-muted-foreground",
								children: "(제목 키워드 추정)"
							})
						]
					}), (b?.newCoverage ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[10px] text-muted-foreground",
						children: q.isLoading ? "…" : "오늘 해당 없음"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-0.5 text-[11px]",
						children: b.newCoverage.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "truncate",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: r.pageUrl,
								target: "_blank",
								rel: "noopener noreferrer",
								className: "hover:underline",
								children: [r.nameKo ? `${r.nameKo} · ` : "", r.title]
							})
						}, r.researchId))
					})]
				})
			]
		})]
	});
}
/** F2.8 KR Street Moves: latest report per (ticker, broker) for watchlist names. */
function KrStreetMoves({ reports }) {
	const colors = usePriceColors();
	const rows = (0, import_react.useMemo)(() => {
		const seen = /* @__PURE__ */ new Set();
		const out = [];
		for (const r of reports) {
			if (!r.code || !r.rating && !r.targetPrice) continue;
			const k = `${r.code}|${r.broker}`;
			if (seen.has(k)) continue;
			seen.add(k);
			out.push(r);
		}
		return out.slice(0, 40);
	}, [reports]);
	if (!rows.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card",
		"aria-label": "KR Street Moves",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "border-b border-border px-3 py-2 text-[12px] font-semibold",
				children: "KR Street Moves · 관심종목 증권사별 최신"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "max-h-80 overflow-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-[11px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "sticky top-0 bg-muted/90 text-muted-foreground backdrop-blur",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-2 py-1.5 text-left",
								children: "일자"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-2 py-1.5 text-left",
								children: "종목"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-2 py-1.5 text-left",
								children: "증권사"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-2 py-1.5 text-left",
								children: "의견"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-2 py-1.5 text-right",
								children: "TP"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-2 py-1.5 text-right",
								children: "Δ"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
						className: "divide-y divide-border",
						children: rows.map((r) => {
							const d = targetDeltaPct(r);
							const t = reportTime(r);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-2 py-1.5 tabular text-muted-foreground",
									children: t.publishedAt ? t.publishedAt.slice(5, 10).replace("-", ".") : "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-2 py-1.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/stock/$ticker",
										params: { ticker: r.code },
										className: "hover:underline",
										children: r.nameKo ?? r.code
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-2 py-1.5",
									children: r.broker
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-2 py-1.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RatingBadge, { rating: r.rating })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-2 py-1.5 text-right tabular",
									children: r.targetPrice ? formatPrice(r.targetPrice) : "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: cn("px-2 py-1.5 text-right tabular", d == null ? "text-muted-foreground" : d > 0 ? colors.up : d < 0 ? colors.down : ""),
									children: d == null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}%`
								})
							] }, `${r.code}-${r.broker}-${r.researchId}`);
						})
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-3 py-1.5 text-[10px] text-muted-foreground",
				children: "Δ는 같은 증권사의 직전 리포트를 실제로 받아온 경우에만 표시합니다."
			})
		]
	});
}
/**
* KR research desk (F2): tabs 전체·기업·산업·시황/전략·경제·채권·데일리,
* newest first with date headers, counts, 더 보기 (next index), 관심종목 and
* industry filters, briefing strip, detail sheet.
*/
function KrResearchDesk({ defaultTab = "all", defaultSector }) {
	const [tab, setTab] = (0, import_react.useState)(defaultTab);
	const [watchOnly, setWatchOnly] = (0, import_react.useState)(false);
	const [sector, setSector] = (0, import_react.useState)(defaultSector ?? "all");
	const [broker, setBroker] = (0, import_react.useState)("all");
	const [q, setQ] = (0, import_react.useState)("");
	const [active, setActive] = (0, import_react.useState)(null);
	const watchlist = useAppStore((s) => s.watchlist);
	const watchCodes = (0, import_react.useMemo)(() => [.../* @__PURE__ */ new Set([...watchlist, ...FEATURED_CODES])].filter((c) => /^\d{6}$/.test(c)).slice(0, 10), [watchlist]);
	const list = useResearchList(watchOnly ? "company" : tab, { itemCodes: watchOnly ? watchCodes : void 0 });
	const watchList = useResearchList("company", { itemCodes: watchCodes });
	const pre = usePdfPreResolver();
	const now = useNow(6e4);
	const brokers = (0, import_react.useMemo)(() => [...new Set(list.reports.map((r) => r.broker))].sort(), [list.reports]);
	const visible = (0, import_react.useMemo)(() => {
		const needle = q.trim();
		return list.reports.filter((r) => {
			if (sector !== "all" && !r.sectorIds.includes(sector)) return false;
			if (broker !== "all" && r.broker !== broker) return false;
			if (needle && !matchesSearchQuery(needle, [
				r.title,
				r.summary,
				r.preview,
				r.broker,
				r.nameKo,
				r.code,
				r.categoryLabel
			])) return false;
			return true;
		});
	}, [
		list.reports,
		sector,
		broker,
		q
	]);
	const today = now ? kstToday(now) : null;
	const todayCount = today ? visible.filter((r) => reportTime(r).publishedAt?.slice(0, 10) === today).length : 0;
	const weekCount = now ? visible.filter((r) => {
		const t = reportTime(r).publishedAt;
		return t != null && Date.parse(t) >= now - 6048e5;
	}).length : 0;
	let lastDay;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchBriefingStrip, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KrStreetMoves, { reports: watchList.reports }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-1 rounded-lg bg-muted p-1",
				role: "tablist",
				"aria-label": "리서치 분류",
				children: [TABS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					role: "tab",
					"aria-selected": !watchOnly && tab === t.id,
					onClick: () => {
						setWatchOnly(false);
						setTab(t.id);
					},
					className: cn("min-h-9 rounded-md px-2.5 text-[12px] font-medium", !watchOnly && tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
					children: t.label
				}, t.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					role: "tab",
					"aria-selected": watchOnly,
					onClick: () => setWatchOnly(true),
					className: cn("min-h-9 rounded-md px-2.5 text-[12px] font-medium", watchOnly ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
					title: "관심종목 + 주요 종목(앞 10개) 기업 리포트",
					children: "관심종목"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2 rounded-lg border border-border bg-muted/15 p-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-1",
					"aria-label": "산업(고정 분류)",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
						active: sector === "all",
						onClick: () => setSector("all"),
						children: "전체 산업"
					}), RESEARCH_SECTOR_RULES.map((rule) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
						active: sector === rule.sectorId,
						onClick: () => setSector(rule.sectorId),
						children: rule.label
					}, rule.sectorId))]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-2 sm:grid-cols-[1fr_auto]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: q,
							onChange: (e) => setQ(e.target.value),
							placeholder: "제목·요약·종목·증권사 검색",
							className: "h-9 pl-8 text-xs",
							"aria-label": "리서치 검색"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: broker,
						onChange: (e) => setBroker(e.target.value),
						className: "h-9 rounded-md border border-border bg-background px-2 text-xs",
						"aria-label": "증권사",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "all",
							children: "전체 증권사"
						}), brokers.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: b,
							children: b
						}, b))]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground",
				"data-testid": "research-counts",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					"오늘 ",
					todayCount,
					"건 · 이번 주 ",
					weekCount,
					"건 · 전체 ",
					list.totalCount != null ? list.totalCount.toLocaleString("ko-KR") : "—",
					list.totalCount == null && list.paths.includes("legacy") ? " (레거시 경로: 총건수 미제공)" : ""
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					"경로 ",
					list.paths.join("·") || "—",
					" ",
					watchOnly ? `· 관심종목 ${watchCodes.length}개 기준` : ""
				] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AiBriefingPanel, {
				items: researchAiItems(visible),
				context: "국내 증권사 리서치"
			}),
			visible.length === 0 ? list.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-10 text-xs text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }), " 리서치 수신 중"]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, { reason: list.reports.length ? "현재 필터에 맞는 리포트가 없습니다." : `리서치를 받지 못했습니다${list.errors[0] ? ` (${list.errors[0]})` : ""}. 목록을 채워 넣지 않습니다.` }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "flex flex-col gap-2",
				"data-research-list": true,
				children: visible.map((r) => {
					const t = reportTime(r);
					const day = t.publishedAt ? t.publishedAt.slice(0, 10) : null;
					const header = day !== lastDay;
					lastDay = day;
					const key = `${r.v2Type ?? r.category}:${r.researchId}`;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.Fragment, { children: [header && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "px-1 pt-1 text-[10px] font-semibold text-muted-foreground",
						"data-date-header": day ?? "unknown",
						children: now == null && day ? day.replace(/-/g, ".") : dateGroupLabel(day, now ?? void 0)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchCard, {
						report: r,
						resolvedPdf: pre.resolved.get(key),
						onDetail: setActive,
						observeRef: (el) => pre.observe(el, r)
					})] }, key);
				})
			}),
			list.hasNextPage && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => void list.fetchNextPage(),
				disabled: list.isFetchingNextPage,
				className: "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md border border-border text-xs font-semibold text-primary hover:bg-muted/50 disabled:opacity-60",
				children: [list.isFetchingNextPage && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }), " 더 보기"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchDetailSheet, {
				report: active,
				onClose: () => setActive(null),
				onBrokerFilter: (b) => {
					setBroker(b);
					setActive(null);
				},
				onOpenReport: setActive
			})
		]
	});
}
function etDay(ms) {
	const p = zonedParts(ms, "America/New_York");
	return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}
/** Street notes + headlines on screen → optional AI briefing input (F9.2), newest first, ≤ 30. */
function usResearchAiItems(street) {
	if (!street) return [];
	return [...street.notes.map((n) => ({
		id: `note:${n.id}`,
		publishedAt: n.publishedAt,
		precision: n.precision,
		sourceTier: 2,
		ai: {
			id: `note:${n.id}`,
			title: `${n.symbol} · ${n.broker} ${n.action}${n.rating ? ` ${n.rating}` : ""}${n.target ? ` (목표 ${n.target})` : ""}`,
			snippet: n.summary || void 0,
			source: n.sourceLabel,
			time: n.publishedAt ?? "날짜 미상",
			url: originalUrlForNote(n, street.headlines).url
		}
	})), ...street.headlines.map((h) => ({
		id: `head:${h.id}`,
		publishedAt: h.publishedAt,
		precision: h.precision,
		sourceTier: 3,
		ai: {
			id: `head:${h.id}`,
			title: `${h.symbol} · ${h.title}`,
			source: h.source,
			time: h.publishedAt ?? "날짜 미상",
			url: h.url
		}
	}))].sort(compareNewestFirst).slice(0, 30).map((r) => r.ai);
}
/**
* F4.7 "US 리서치 브리핑": tier counts (today / 7 days), today's top up/down
* grades, the day's filings for the universe, and the next macro releases.
* Counts only what was actually fetched.
*/
function UsResearchBriefing({ street, official }) {
	const now = useNow(6e4);
	const cal = useUsCalendar();
	const colors = usePriceColors();
	const stats = (0, import_react.useMemo)(() => {
		if (now == null) return null;
		const today = etDay(now);
		const weekAgo = now - 6048e5;
		const inDay = (iso) => iso ? etDay(Date.parse(iso)) === today : false;
		const inWeek = (iso) => iso ? Date.parse(iso) >= weekAgo : false;
		const notes = street?.notes ?? [];
		const heads = street?.headlines ?? [];
		const filings = [...official?.filings ?? [], ...official?.earnings ?? []].map((f) => ({
			...f,
			iso: parseSourceTime(f.publishedAt, { zone: "America/New_York" }).iso
		}));
		const moves = notes.map((n) => toStreetMove(n));
		return {
			tiers: [
				{
					tier: "OFFICIAL",
					today: filings.filter((f) => inDay(f.iso)).length,
					week: filings.filter((f) => inWeek(f.iso)).length
				},
				{
					tier: "PUBLIC_RESEARCH",
					today: 0,
					week: 0
				},
				{
					tier: "STREET",
					today: notes.filter((n) => inDay(n.publishedAt)).length,
					week: notes.filter((n) => inWeek(n.publishedAt)).length
				},
				{
					tier: "NEWS",
					today: heads.filter((h) => inDay(h.publishedAt)).length,
					week: heads.filter((h) => inWeek(h.publishedAt)).length
				}
			],
			up: moves.filter((m) => m.action === "Upgrade" && inDay(m.publishedAt)).slice(0, 5),
			down: moves.filter((m) => m.action === "Downgrade" && inDay(m.publishedAt)).slice(0, 5),
			filingsToday: filings.filter((f) => inDay(f.iso)).slice(0, 6)
		};
	}, [
		now,
		street,
		official
	]);
	const nextMacro = (cal.data?.events ?? []).filter((e) => e.kind === "scheduled").slice(0, 4);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "space-y-2 rounded-xl border border-border bg-card p-3",
		"aria-label": "US 리서치 브리핑",
		"data-testid": "us-research-briefing",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "text-[12px] font-semibold",
				children: ["US 리서치 브리핑 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-normal text-muted-foreground",
					children: "(뉴욕 날짜 기준)"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-1.5 text-[11px]",
				children: (stats?.tiers ?? []).map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OriginTierBadge, { tier: t.tier }),
						" 오늘 ",
						t.today,
						" · 7일 ",
						t.week
					]
				}, t.tier))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-2 md:grid-cols-4",
				children: [
					["up", "down"].map((dir) => {
						const rows = dir === "up" ? stats?.up ?? [] : stats?.down ?? [];
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-lg border border-border p-2 text-[11px]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: cn("mb-1 font-semibold", dir === "up" ? colors.up : colors.down),
								children: ["오늘 ", dir === "up" ? "상향" : "하향"]
							}), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] text-muted-foreground",
								children: "없음 또는 미수신"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "space-y-0.5",
								children: rows.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "truncate",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
											to: "/us/$symbol",
											params: { symbol: m.ticker },
											className: "font-semibold hover:underline",
											children: m.ticker
										}),
										" ",
										m.broker,
										" ",
										m.ratingTo ? `→ ${m.ratingTo}` : ""
									]
								}, m.id))
							})]
						}, dir);
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-border p-2 text-[11px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mb-1 font-semibold",
							children: "오늘 공시 (유니버스)"
						}), (stats?.filingsToday ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] text-muted-foreground",
							children: "없음 또는 미수신"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "space-y-0.5",
							children: stats.filingsToday.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "truncate",
								children: f.url ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: f.url,
									target: "_blank",
									rel: "noopener noreferrer",
									className: "hover:underline",
									children: [
										f.tickers[0] ?? "",
										" ",
										f.badge
									]
								}) : `${f.tickers[0] ?? ""} ${f.badge}`
							}, f.id))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-border p-2 text-[11px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mb-1 font-semibold",
							children: "다음 매크로 발표"
						}), nextMacro.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] text-muted-foreground",
							children: cal.isLoading ? "…" : "일정 미수신"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "space-y-0.5",
							children: nextMacro.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "truncate",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "tabular text-muted-foreground",
										children: e.dateLabel
									}),
									" ",
									e.title
								]
							}, e.id))
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AiBriefingPanel, {
				items: usResearchAiItems(street),
				context: "미국 리서치·월가 등급"
			})
		]
	});
}
function MarketSwitch({ market }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid grid-cols-2 gap-1 rounded-lg bg-muted p-1",
		role: "tablist",
		"aria-label": "시장",
		children: [["kr", "한국 주식"], ["us", "미국 주식"]].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/research",
			search: { market: id },
			role: "tab",
			"aria-selected": market === id,
			className: cn("flex min-h-9 items-center justify-center rounded-md px-2.5 text-[12px] font-semibold", market === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
			children: label
		}, id))
	});
}
function UsResearchMode() {
	const universe = useStreetUniverse();
	const street = useUsStreet(void 0, { symbols: universe });
	const official = useUsOfficialUniverse();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsScopeBanner, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsResearchBriefing, {
				street: street.data,
				official: official.data
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StreetMovesTable, { pack: street.data }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsResearchDesk, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-border p-3 text-[11px]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mb-1 font-semibold",
								children: "OFFICIAL 공식 원문"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-muted-foreground",
								children: "SEC 공시·연준·BEA·BLS 원문 카드는 공식 원문 페이지에 있습니다."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/us-research",
								className: "mt-1 inline-flex min-h-8 items-center font-semibold text-primary hover:underline",
								children: "공식 원문 열기 →"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicResearchNote, {})]
				})]
			})
		]
	});
}
function ResearchPage() {
	const { tab, sector, market } = Route$20.useSearch();
	const m = market === "us" ? "us" : "kr";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				kicker: m === "us" ? "US Research Briefing · 미국 리서치" : "KR Research Briefing · 한국 리서치",
				title: "리서치 데스크",
				lead: m === "us" ? "공식 문서, 공개 리서치, 공개된 등급·목표가 변경과 관련 기사만 원문으로 연결합니다. 모든 목록은 최신순입니다." : "네이버 리서치 v2(실패 시 레거시)의 기업·산업·시황/전략·경제·채권·데일리 리포트를 최신순으로 보여줍니다. 요약은 원문 발췌이며 PDF·리서치 페이지로 바로 연결됩니다."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageDisclaimer, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MarketSwitch, { market: m }),
			m === "us" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsResearchMode, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KrResearchDesk, {
				defaultTab: tab ?? "all",
				defaultSector: sector
			})
		]
	});
}
//#endregion
export { ResearchPage as component };
