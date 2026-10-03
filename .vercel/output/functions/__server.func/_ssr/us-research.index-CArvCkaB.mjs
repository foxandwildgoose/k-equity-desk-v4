import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { u as sortOfficialNewestFirst } from "./mappers-DlpCqw-E.mjs";
import { z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { M as useUsOfficialPolicy, Nt as Input, P as useUsOfficialUniverse, Pt as cn, i as Route$2 } from "./router-B1V8nj-n.mjs";
import { t as PageDisclaimer } from "./PageDisclaimer-Dk4wCTj5.mjs";
import { i as UsScopeBanner, n as PublicResearchNote, t as OriginTierBadge } from "./UsResearchKit-DK5mRrrP.mjs";
import { t as UsResearchDesk } from "./UsResearchDesk-Du-FOQ6b.mjs";
import { n as RESEARCH_DISCLAIMER, r as RESEARCH_DISCLAIMER_KO, u as formatDay } from "./us-official-parse-DdEnQc7w.mjs";
import { i as useSavedReports, n as OfficialReportCard } from "./saved-reports-hooLJGV6.mjs";
import { t as CompanyOfficial } from "./CompanyOfficial-Besnc9ph.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/us-research.index-CArvCkaB.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var PERIODS = [
	{
		id: "7",
		label: "최근 7일"
	},
	{
		id: "30",
		label: "최근 30일"
	},
	{
		id: "90",
		label: "최근 90일"
	},
	{
		id: "all",
		label: "전체"
	}
];
/** Period filter (F4.3, default 최근 30일). Undated cards stay (sorted last). */
function inPeriod(r, period) {
	if (period === "all" || !r.publishedAt) return true;
	const t = Date.parse(r.publishedAt.length === 10 ? `${r.publishedAt}T12:00:00Z` : r.publishedAt);
	return Number.isNaN(t) || t >= Date.now() - Number(period) * 864e5;
}
var CHIPS = [
	{
		id: "all",
		label: "All",
		ko: "전체"
	},
	{
		id: "filings",
		label: "Filings",
		ko: "공시"
	},
	{
		id: "earnings",
		label: "Earnings",
		ko: "실적"
	},
	{
		id: "macro",
		label: "Policy",
		ko: "정책"
	},
	{
		id: "industry",
		label: "Industry",
		ko: "산업"
	},
	{
		id: "analyst",
		label: "Analyst opinion",
		ko: "의견"
	},
	{
		id: "saved",
		label: "Saved",
		ko: "저장"
	}
];
function ResearchHome({ initialTicker }) {
	const policy = useUsOfficialPolicy();
	const universe = useUsOfficialUniverse();
	const saved = useSavedReports();
	const [q, setQ] = (0, import_react.useState)(initialTicker ?? "");
	const [chip, setChip] = (0, import_react.useState)("all");
	const [lookup, setLookup] = (0, import_react.useState)(initialTicker?.trim().toUpperCase() ?? "");
	const [period, setPeriod] = (0, import_react.useState)("30");
	const within = (list) => sortOfficialNewestFirst(list.filter((r) => inPeriod(r, period)));
	const featured = (0, import_react.useMemo)(() => {
		const rows = [];
		const push = (r) => {
			if (!r || rows.some((x) => x.id === r.id)) return;
			rows.push(r);
		};
		for (const r of policy.data?.featured ?? []) push(r);
		push(universe.data?.featuredFiling);
		push((universe.data?.earnings ?? []).find((r) => r.summaryStatus === "document-extract"));
		return sortOfficialNewestFirst(rows).slice(0, 8);
	}, [policy.data, universe.data]);
	const pool = (0, import_react.useMemo)(() => {
		const rows = [
			...policy.data?.macro ?? [],
			...policy.data?.industry ?? [],
			...universe.data?.filings ?? [],
			...universe.data?.earnings ?? []
		];
		const seen = /* @__PURE__ */ new Set();
		return sortOfficialNewestFirst(rows.filter((r) => {
			if (seen.has(r.id)) return false;
			seen.add(r.id);
			return true;
		}));
	}, [policy.data, universe.data]);
	const filtered = (0, import_react.useMemo)(() => {
		const needle = q.trim().toLowerCase();
		return pool.filter((r) => {
			if (chip === "filings" && ![
				"10-K",
				"10-Q",
				"8-K",
				"DEF 14A",
				"4",
				"13F-HR"
			].includes(r.kind)) return false;
			if (chip === "earnings" && r.kind !== "earnings-release" && r.badge !== "Earnings 8-K") return false;
			if (chip === "macro" && ![
				"fomc-statement",
				"fomc-minutes",
				"fomc-sep",
				"fomc-press",
				"fomc-implementation",
				"beige-book",
				"bea-release",
				"bls-series"
			].includes(r.kind)) return false;
			if (chip === "industry" && r.kind !== "industry") return false;
			if (!needle) return true;
			return [
				r.title,
				r.titleKo,
				r.sourceName,
				...r.tickers,
				...r.sectors,
				...r.bullets
			].join(" ").toLowerCase().includes(needle);
		});
	}, [
		pool,
		q,
		chip
	]);
	const showEditorial = chip === "all" && !q.trim();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "page-header",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "desk-kicker mb-1.5",
						children: "US official sources · 공식 원문"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "page-title",
						children: "Research"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "page-lead",
						children: "Primary filings and policy releases, then the original page in one click. Analyst notes stay in a separate opinion layer. 원문 제목은 영어입니다."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground",
						children: RESEARCH_DISCLAIMER
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "max-w-3xl text-xs text-muted-foreground",
						children: RESEARCH_DISCLAIMER_KO
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageDisclaimer, { className: "mt-1" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-xs tabular text-muted-foreground",
						children: [policy.data ? `Policy updated ${new Date(policy.data.fetchedAt).toLocaleString("en-US")}` : "Policy not loaded yet", universe.data ? ` · Filings updated ${new Date(universe.data.fetchedAt).toLocaleString("en-US")}` : ""]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsScopeBanner, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "flex flex-col gap-2 sm:flex-row",
				onSubmit: (e) => {
					e.preventDefault();
					const t = q.trim().toUpperCase();
					if (/^[A-Z][A-Z0-9.]{0,9}$/.test(t)) setLookup(t);
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "sr-only",
						htmlFor: "research-q",
						children: "Search ticker, company, or keyword"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "research-q",
						value: q,
						onChange: (e) => setQ(e.target.value),
						placeholder: "Ticker, company, or keyword (FOMC, revenue)",
						className: "sm:max-w-md"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						className: "h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground",
						children: "Load ticker filings"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-2",
				role: "tablist",
				"aria-label": "Report type",
				children: CHIPS.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					role: "tab",
					"aria-selected": chip === c.id,
					onClick: () => setChip(c.id),
					className: cn("rounded-md border px-3 py-1.5 text-sm", chip === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"),
					children: [c.label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-1 text-xs opacity-80",
						children: c.ko
					})]
				}, c.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-1.5",
				role: "group",
				"aria-label": "기간",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted-foreground",
						children: "기간"
					}),
					PERIODS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-pressed": period === p.id,
						onClick: () => setPeriod(p.id),
						className: cn("min-h-9 rounded-md border px-2.5 text-xs", period === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"),
						children: p.label
					}, p.id)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-1 text-[11px] text-muted-foreground",
						children: "모든 목록 최신순 · 날짜 없는 카드는 맨 뒤"
					})
				]
			}),
			(policy.isLoading || universe.isLoading) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "inline-flex items-center gap-2 text-sm text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), "Retrieving Federal Reserve, BEA, BLS, and SEC records. Cards appear only after a source responds."]
			}),
			[...policy.data?.errors ?? [], ...universe.data?.errors ?? []].map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: e
			}, e)),
			lookup ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "text-sm font-semibold",
					children: ["Company lookup · ", lookup]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "text-xs text-muted-foreground underline",
					onClick: () => setLookup(""),
					children: "Clear"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanyOfficial, { symbol: lookup })] }) : null,
			chip === "saved" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Saved reports",
				ko: "이 브라우저에만 저장됩니다. 계정은 없습니다.",
				children: saved.items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Nothing saved yet. Save a card to keep it in this browser."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Grid, {
					reports: saved.items,
					saved
				})
			}) : null,
			showEditorial ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Featured this week",
					ko: "이번 주 문서. 받아 온 것만 표시합니다.",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Grid, {
						reports: within(featured),
						saved
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calendar, { events: policy.data?.calendar ?? [] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Company filings",
					ko: "NVDA, AAPL, MSFT, AMZN, GOOGL, META의 최근 SEC 제출.",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Grid, {
						reports: within((universe.data?.filings ?? []).filter((r) => r.kind === "10-Q" || r.kind === "10-K")),
						saved
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Earnings",
					ko: "실적 8-K와, 받아 온 경우 Exhibit 99.",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Grid, {
						reports: within(universe.data?.earnings ?? []),
						saved
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Macro and policy",
					ko: "연준, BEA, BLS.",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Grid, {
						reports: within(policy.data?.macro ?? []),
						saved
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Industry",
					ko: "공식 페이지에서 산업이 제목에 있는 자료만.",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Grid, {
						reports: within(policy.data?.industry ?? []),
						saved
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hubs, {
					hubs: policy.data?.hubs ?? [],
					paid: policy.data?.paidNote
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicResearchNote, {})
			] }) : null,
			chip === "analyst" || showEditorial ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl border border-desk-slate/40 bg-muted/40 p-3 md:p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold uppercase tracking-wide text-desk-slate",
						children: "OPINION · Analyst"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-1 text-lg font-semibold",
						children: "Analyst opinion"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 max-w-3xl text-sm text-muted-foreground",
						children: "Public ratings and headlines only. Sell-side ratings are opinions and have historically skewed toward Buy. Bulge-bracket PDFs are not hosted here. 월가 의견이며 공식 공시가 아닙니다."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsResearchDesk, {})
					})
				]
			}) : null,
			chip !== "all" && chip !== "saved" && chip !== "analyst" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Filtered reports",
				ko: "필터 결과",
				children: filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "No retrieved report matches this filter."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Grid, {
					reports: within(filtered),
					saved
				})
			}) : null,
			chip === "all" && q.trim() ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "Search results",
				ko: "불러온 카드 안에서만 찾습니다.",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Grid, {
					reports: filtered,
					saved
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted-foreground",
					children: [
						"For a full filing list, submit the ticker. Or open",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/us/$symbol",
							params: { symbol: q.trim().toUpperCase() },
							className: "underline",
							children: q.trim().toUpperCase()
						}),
						"."
					]
				})]
			}) : null
		]
	});
}
function Section({ title, ko, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
			className: "flex items-center gap-2 text-lg font-semibold tracking-tight",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OriginTierBadge, { tier: "OFFICIAL" }),
				" ",
				title
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mb-3 text-xs text-muted-foreground",
			children: ko
		}),
		children
	] });
}
function Grid({ reports, saved }) {
	if (!reports.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground",
		children: "Nothing retrieved for this section."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-3 lg:grid-cols-2",
		children: sortOfficialNewestFirst(reports).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OfficialReportCard, {
			report: r,
			compact: true,
			saved: saved.has(r.id),
			onToggleSave: saved.toggle
		}, r.id))
	});
}
function Calendar({ events }) {
	const upcoming = events.filter((e) => e.kind === "scheduled");
	const released = events.filter((e) => e.kind === "released").slice(0, 8);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-lg font-semibold",
				children: "Economic calendar"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "Dates are copied from the Fed and BEA pages that were retrieved. No consensus column — a surprise versus economists is not shown unless that figure was in the source, and it was not. 예상치는 출처에 없어서 비워 둡니다."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[40rem] text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-border text-xs text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 pr-3 font-medium",
								children: "When"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 pr-3 font-medium",
								children: "Event"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 pr-3 font-medium",
								children: "Source"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 font-medium",
								children: "Original"
							})
						]
					}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: [...upcoming, ...released].map((e, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-border/70 align-top",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "py-2 pr-3 tabular",
								children: [
									e.iso ? formatDay(e.iso) : e.dateLabel,
									e.timeLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "block text-xs text-muted-foreground",
										children: e.timeLabel
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "block text-xs text-muted-foreground",
										children: e.kind === "scheduled" ? "Scheduled" : "Released"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2 pr-3",
								children: e.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2 pr-3 text-muted-foreground",
								children: e.sourceName
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2",
								children: e.url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									className: "underline",
									href: e.url,
									target: "_blank",
									rel: "noopener noreferrer",
									children: "Open"
								}) : "Original link unavailable"
							})
						]
					}, `${e.id}-${i}`)) })]
				})
			})
		]
	});
}
function Hubs({ hubs, paid }) {
	if (!hubs.length && !paid) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "text-lg font-semibold",
			children: "Official hubs"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mb-3 text-xs text-muted-foreground",
			children: "링크는 이번 조회에서 확인된 페이지만 엽니다."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "grid gap-2 md:grid-cols-2",
			children: hubs.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "rounded-lg border border-border bg-card p-3 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-medium",
						children: [
							h.label,
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-normal text-muted-foreground",
								children: h.labelKo
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: h.note
					}),
					h.url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						className: "mt-2 inline-block text-sm underline",
						href: h.url,
						target: "_blank",
						rel: "noopener noreferrer",
						children: "View original"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs",
						children: "Original link unavailable"
					})
				]
			}, h.id))
		}),
		paid ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-xs text-muted-foreground",
			children: paid
		}) : null
	] });
}
function ResearchIndex() {
	const { ticker } = Route$2.useSearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchHome, { initialTicker: ticker });
}
//#endregion
export { ResearchIndex as component };
