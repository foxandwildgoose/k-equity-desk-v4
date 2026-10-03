import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as compareNewestFirst } from "./mappers-DlpCqw-E.mjs";
import { S as topMovers, l as SEGMENT_LABEL, p as equalWeightChange, t as EXPOSURE_LABEL, u as countWithin } from "./classify-DLKCwe5y.mjs";
import { E as Plus, bt as Bot, it as EyeOff, x as RotateCcw } from "../_libs/lucide-react.mjs";
import { $ as ThemeChips, It as useAppStore, J as SourceHealthChip, Lt as usePriceColors, Nt as Input, Pt as cn, Q as SourceBadge, X as EmptyState, Y as FeedList, at as SheetHeader, c as Route$19, et as TimeStamp, it as SheetDescription, l as TABS, lt as useFeed, nt as Sheet, ot as SheetTitle, q as NewsDesk, rt as SheetContent, tt as useNow, vt as formatPct, yt as formatPrice } from "./router-B1V8nj-n.mjs";
import { t as PageDisclaimer } from "./PageDisclaimer-Dk4wCTj5.mjs";
import { r as feedToAiItems, t as AiBriefingPanel } from "./AiBriefingPanel-HuDAM7_1.mjs";
import { a as useRoboticsResearch, i as useRoboticsEtfs, n as useRoboticsCompanyMeta, o as useRoboticsUniverse, r as useRoboticsCompanyNews } from "./use-themes-BkxRsJtl.mjs";
import { t as PageHeader } from "./PageHeader-aQOrmONW.mjs";
import { i as reportTime, n as ResearchCard } from "./ResearchCard-B9UdtEGW.mjs";
import { n as PublicResearchNote, r as StreetMovesTable } from "./UsResearchKit-DK5mRrrP.mjs";
import { t as ResearchDetailSheet } from "./ResearchDetailSheet-Cdb2zg_Q.mjs";
import { t as CompanyOfficial } from "./CompanyOfficial-Besnc9ph.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/robotics-C7wPKZ4n.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function KpiTile({ label, value, pct, source, reason, testId }) {
	const colors = usePriceColors();
	const shown = value ?? (pct != null ? formatPct(pct) : null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 rounded-lg border border-border bg-muted/20 p-2",
		"data-kpi": testId,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "truncate text-[10px] font-semibold text-muted-foreground",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("mt-0.5 truncate text-base font-semibold tabular", pct != null && pct > 0 && colors.up, pct != null && pct < 0 && colors.down),
				children: shown ?? "—"
			}),
			shown == null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "truncate text-[10px] text-muted-foreground",
				children: reason
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-0.5 truncate text-[9px] text-muted-foreground",
				title: source,
				children: source
			})
		]
	});
}
function SectionCard({ title, note, children, action, testId }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "min-w-0 space-y-2 rounded-xl border border-border bg-card p-3",
		"data-testid": testId,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-baseline justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-[12px] font-semibold",
					children: title
				}), action]
			}),
			note && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[10.5px] leading-relaxed text-muted-foreground",
				children: note
			}),
			children
		]
	});
}
function priceText(r) {
	if (r.price == null) return "—";
	return r.currency === "USD" ? `$${r.price.toFixed(2)}` : `${formatPrice(r.price)}원`;
}
function MoverList({ rows, market }) {
	const colors = usePriceColors();
	if (!rows.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-[10.5px] text-muted-foreground",
		children: "해당 없음 또는 시세 미수신"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "space-y-0.5 text-[11px]",
		children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "flex items-center justify-between gap-2",
			children: [market === "KR" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/stock/$ticker",
				params: { ticker: r.code },
				className: "min-w-0 truncate font-medium hover:underline",
				children: r.name
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/us/$symbol",
				params: { symbol: r.code },
				className: "min-w-0 truncate font-medium hover:underline",
				children: [
					r.code,
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-normal text-muted-foreground",
						children: r.name
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: cn("shrink-0 tabular font-semibold", (r.changePct ?? 0) > 0 && colors.up, (r.changePct ?? 0) < 0 && colors.down),
				children: r.changePct != null ? formatPct(r.changePct) : "—"
			})]
		}, r.key))
	});
}
/** F6.5 company table; row click opens the news drawer (newest first). */
function CompanyTable({ rows, market, latestNews, latestResearch, metaLoading, onOpen }) {
	const colors = usePriceColors();
	const hide = useAppStore((s) => s.hideRoboticsName);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "overflow-x-auto scroll-thin rounded-lg border border-border",
		"data-testid": `robotics-companies-${market.toLowerCase()}`,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full min-w-[860px] text-[11.5px]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
				className: "bg-muted/40 text-[10px] text-muted-foreground",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-left font-semibold",
						children: "종목"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-left font-semibold",
						children: "코드"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-left font-semibold",
						children: "세그먼트"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-left font-semibold",
						children: "노출"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-right font-semibold",
						children: "현재가"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-right font-semibold",
						children: "1D"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-right font-semibold",
						children: "52주 위치"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-right font-semibold",
						children: market === "KR" ? "시총(억)" : "시총"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-left font-semibold",
						children: "최근 뉴스"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-left font-semibold",
						children: market === "KR" ? "최근 리서치" : "최근 등급 변경"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "px-2 py-1.5" })
				] })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
				className: "divide-y divide-border",
				children: rows.map((r) => {
					const news = latestNews?.[r.key];
					const res = latestResearch?.[r.key];
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "cursor-pointer hover:bg-muted/25",
						tabIndex: 0,
						onClick: () => onOpen(r),
						onKeyDown: (e) => {
							if (e.key === "Enter") onOpen(r);
						},
						"data-row": r.key,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "px-2 py-1.5",
								children: [market === "KR" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/stock/$ticker",
									params: { ticker: r.code },
									onClick: (e) => e.stopPropagation(),
									className: "font-semibold hover:underline",
									children: r.name
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/us/$symbol",
									params: { symbol: r.code },
									onClick: (e) => e.stopPropagation(),
									className: "font-semibold hover:underline",
									children: r.name
								}), r.kind === "custom" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-1 rounded bg-muted px-1 text-[9px] text-muted-foreground",
									children: "추가"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5 tabular text-muted-foreground",
								children: r.code
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5",
								children: r.segment ? SEGMENT_LABEL[r.segment] ?? r.segment : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5 text-muted-foreground",
								children: r.exposure ? EXPOSURE_LABEL[r.exposure] : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5 text-right tabular font-semibold",
								children: priceText(r)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: cn("px-2 py-1.5 text-right tabular font-semibold", (r.changePct ?? 0) > 0 && colors.up, (r.changePct ?? 0) < 0 && colors.down),
								children: r.changePct != null ? formatPct(r.changePct) : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5 text-right tabular",
								title: "52주 저가=0, 고가=100",
								children: r.pos52w != null ? r.pos52w : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5 text-right tabular text-muted-foreground",
								title: market === "US" ? "Yahoo 차트 응답에 시가총액이 없어 표시하지 않습니다" : void 0,
								children: r.marketCap != null ? r.marketCap.toLocaleString("ko-KR") : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5 text-muted-foreground",
								children: news ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
									publishedAt: news,
									precision: "minute"
								}) : metaLoading ? "…" : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5 text-muted-foreground",
								children: res ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
									publishedAt: res,
									precision: "day"
								}) : metaLoading ? "…" : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5 text-right",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: (e) => {
										e.stopPropagation();
										hide(r.key);
									},
									className: "inline-flex min-h-8 items-center gap-0.5 rounded px-1 text-[10px] text-muted-foreground hover:text-foreground",
									title: "이 종목 숨기기 (복원 가능)",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "size-3" }), " 숨김"]
								})
							})
						]
					}, r.key);
				})
			})]
		})
	});
}
function CompanyNewsSheet({ target, onClose }) {
	const q = useRoboticsCompanyNews(target ? {
		market: target.market,
		code: target.code,
		name: target.market === "US" ? target.nameEn ?? target.name : target.name
	} : null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: target != null,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, {
			side: "right",
			className: "w-full max-w-lg overflow-y-auto scroll-thin p-0",
			children: target && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, {
				className: "sticky top-0 z-10 border-b border-border bg-card",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetTitle, {
					className: "pr-6 text-base",
					children: [
						target.name,
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm font-normal text-muted-foreground",
							children: target.code
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetDescription, { children: [target.market === "KR" ? "네이버 종목 뉴스" : "Google News (영문, 회사명 검색 · 최근 30일)", " · 최신순"] })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedList, {
					items: q.data?.items ?? [],
					loading: q.isLoading,
					emptyReason: q.data?.error ? `뉴스를 받지 못했습니다 (${q.data.error}). 데이터를 채워 넣지 않습니다.` : "표시할 기사가 없습니다."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 text-[11px]",
					children: target.market === "KR" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/stock/$ticker",
						params: { ticker: target.code },
						className: "font-semibold text-primary hover:underline",
						children: "종목 페이지 →"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/us/$symbol",
						params: { symbol: target.code },
						className: "font-semibold text-primary hover:underline",
						children: "미국 종목 페이지 →"
					})
				})]
			})] })
		})
	});
}
var SEGMENTS = Object.keys(SEGMENT_LABEL);
/** User add / restore (F6.1: additions and removals persist in the store). */
function UniverseEditor({ hidden, unresolved }) {
	const add = useAppStore((s) => s.addRoboticsName);
	const restore = useAppStore((s) => s.restoreRoboticsName);
	const removed = useAppStore((s) => s.roboticsCustom.removed);
	const [market, setMarket] = (0, import_react.useState)("KR");
	const [code, setCode] = (0, import_react.useState)("");
	const [name, setName] = (0, import_react.useState)("");
	const [segment, setSegment] = (0, import_react.useState)("industrial");
	const [exposure, setExposure] = (0, import_react.useState)("significant");
	const normalized = market === "KR" ? code.trim().toUpperCase() : code.trim().toUpperCase();
	const valid = market === "KR" ? /^[0-9][0-9A-Z]{5}$/.test(normalized) : /^[A-Z][A-Z0-9.]{0,9}$/.test(normalized);
	const hiddenOrphans = (0, import_react.useMemo)(() => removed.filter((k) => !hidden.some((h) => h.key === k)), [removed, hidden]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2 rounded-lg border border-border bg-muted/15 p-2.5 text-[11px]",
		"data-testid": "robotics-universe-editor",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "flex flex-wrap items-center gap-1.5",
				onSubmit: (e) => {
					e.preventDefault();
					if (!valid) return;
					add({
						market,
						code: normalized,
						name: name.trim() || normalized,
						segment,
						exposure
					});
					setCode("");
					setName("");
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold text-muted-foreground",
						children: "종목 추가"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: market,
						onChange: (e) => setMarket(e.target.value),
						className: "h-9 rounded-md border border-border bg-background px-2",
						"aria-label": "시장",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "KR",
							children: "한국"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "US",
							children: "미국"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: code,
						onChange: (e) => setCode(e.target.value),
						placeholder: market === "KR" ? "종목코드 6자리" : "심볼 (예: ABB)",
						className: "h-9 w-32 text-xs",
						"aria-label": "코드"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: name,
						onChange: (e) => setName(e.target.value),
						placeholder: "이름 (선택)",
						className: "h-9 w-32 text-xs",
						"aria-label": "이름"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						value: segment,
						onChange: (e) => setSegment(e.target.value),
						className: "h-9 rounded-md border border-border bg-background px-2",
						"aria-label": "세그먼트",
						children: SEGMENTS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: s,
							children: SEGMENT_LABEL[s]
						}, s))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						value: exposure,
						onChange: (e) => setExposure(e.target.value),
						className: "h-9 rounded-md border border-border bg-background px-2",
						"aria-label": "노출",
						children: Object.keys(EXPOSURE_LABEL).map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: x,
							children: EXPOSURE_LABEL[x]
						}, x))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "submit",
						disabled: !valid,
						className: "inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 font-semibold hover:bg-muted/50 disabled:opacity-40",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3" }), " 추가"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] text-muted-foreground",
						children: "추가한 종목도 시세로 확인되지 않으면 숨겨집니다."
					})
				]
			}),
			(hidden.length > 0 || hiddenOrphans.length > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold text-muted-foreground",
						children: "숨긴 종목"
					}),
					hidden.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => restore(h.key),
						className: "inline-flex min-h-8 items-center gap-1 rounded border border-border px-1.5 hover:bg-muted/50",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-3" }),
							" ",
							h.name
						]
					}, h.key)),
					hiddenOrphans.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => restore(k),
						className: "inline-flex min-h-8 items-center gap-1 rounded border border-border px-1.5 hover:bg-muted/50",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-3" }),
							" ",
							k
						]
					}, k))
				]
			}),
			unresolved.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-[10.5px] text-muted-foreground",
				"data-testid": "robotics-unresolved-note",
				children: [
					"확인되지 않은 종목 ",
					unresolved.length,
					"개는 표에서 숨겼습니다(코드·이름을 추정하지 않음).",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/status/sources",
						className: "font-semibold text-primary hover:underline",
						children: "소스 상태에서 목록 보기 →"
					})
				]
			})
		]
	});
}
function EtfTable({ rows, market }) {
	const colors = usePriceColors();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "overflow-x-auto scroll-thin rounded-lg border border-border",
		"data-testid": `robotics-etf-${market.toLowerCase()}`,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full min-w-[560px] text-[11.5px]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
				className: "bg-muted/40 text-[10px] text-muted-foreground",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-left font-semibold",
						children: "ETF"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-left font-semibold",
						children: "코드"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-right font-semibold",
						children: "현재가"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-right font-semibold",
						children: "1D"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-right font-semibold",
						children: "거래량"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-1.5 text-right font-semibold",
						children: market === "KR" ? "시총(억)" : "시총"
					})
				] })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
				className: "divide-y divide-border",
				children: rows.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "hover:bg-muted/25",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "px-2 py-1.5",
							children: [e.market === "KR" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/etfs/$code",
								params: { code: e.code },
								className: "font-semibold hover:underline",
								children: e.name
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/us/$symbol",
								params: { symbol: e.code },
								className: "font-semibold hover:underline",
								children: e.name
							}), e.issuer && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-1 text-[10px] text-muted-foreground",
								children: e.issuer
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-1.5 tabular text-muted-foreground",
							children: e.code
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-1.5 text-right tabular font-semibold",
							children: priceText({
								price: e.price,
								currency: e.market === "US" ? "USD" : "KRW"
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: cn("px-2 py-1.5 text-right tabular font-semibold", (e.changePct ?? 0) > 0 && colors.up, (e.changePct ?? 0) < 0 && colors.down),
							children: e.changePct != null ? formatPct(e.changePct) : "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-1.5 text-right tabular text-muted-foreground",
							children: e.volume != null ? e.volume.toLocaleString("ko-KR") : "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-1.5 text-right tabular text-muted-foreground",
							children: e.marketSum != null ? e.marketSum.toLocaleString("ko-KR") : "—"
						})
					]
				}, e.code))
			})]
		})
	});
}
function reportRow(r) {
	const t = reportTime(r);
	return {
		id: `kr:${r.v2Type ?? r.category}:${r.researchId}`,
		title: r.nameKo ? `[${r.nameKo}] ${r.title}` : r.title,
		source: r.broker,
		url: r.pdfUrl || r.pageUrl,
		publishedAt: t.publishedAt,
		precision: t.precision,
		sourceTier: 3
	};
}
/** The overview's on-screen previews (market 5 + policy 5 + research 5) → optional AI input, newest first. */
function overviewAiItems(market, policy, research) {
	const feed = feedToAiItems([...market.slice(0, 5), ...policy.slice(0, 5)]);
	const byId = new Map(feed.map((i) => [i.id, i]));
	for (const r of research.slice(0, 5)) byId.set(r.id, {
		id: r.id,
		title: r.title,
		source: r.source,
		time: r.publishedAt ?? "날짜 미상",
		url: r.url
	});
	return [
		...market.slice(0, 5),
		...policy.slice(0, 5),
		...research.slice(0, 5)
	].map((x) => ({
		id: x.id,
		publishedAt: x.publishedAt,
		precision: x.precision,
		sourceTier: x.sourceTier
	})).sort(compareNewestFirst).map((x) => byId.get(x.id)).filter((x) => x != null);
}
function FeedPreview({ items, empty }) {
	if (!items.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-[10.5px] text-muted-foreground",
		children: empty
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "space-y-1.5",
		children: items.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "min-w-0 text-[11.5px]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
						publishedAt: it.publishedAt,
						precision: it.precision
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceBadge, { item: it }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeChips, {
						item: it,
						max: 2
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				href: it.url,
				target: "_blank",
				rel: "noopener noreferrer",
				className: "line-clamp-2 font-medium hover:underline",
				lang: it.lang,
				children: it.title
			})]
		}, it.id))
	});
}
function feedEmptyReason(sources, loading) {
	if (loading) return "수신 중…";
	const active = sources.filter((s) => s.state !== "disabled");
	if (active.length && active.every((s) => !s.ok)) return `소스 ${active.length}곳 모두 응답 없음(소스 미검증·네트워크 차단 등) — 채워 넣지 않습니다.`;
	return "해당 기간 항목 없음";
}
function RoboticsPage() {
	const { tab = "overview" } = Route$19.useSearch();
	const now = useNow(6e4);
	const market = useFeed({
		region: "GLOBAL",
		group: "robotics-market",
		limit: 80
	});
	const policy = useFeed({
		region: "GLOBAL",
		group: "robotics-policy",
		limit: 60
	});
	const universe = useRoboticsUniverse();
	const etfs = useRoboticsEtfs({ enabled: tab === "overview" || tab === "etf" });
	const krCodes = (0, import_react.useMemo)(() => universe.kr.map((r) => r.code), [universe.kr]);
	const usSymbols = (0, import_react.useMemo)(() => universe.us.map((r) => r.code), [universe.us]);
	const research = useRoboticsResearch(krCodes, usSymbols, { enabled: tab === "overview" || tab === "research" });
	const meta = useRoboticsCompanyMeta(krCodes, usSymbols, { enabled: tab === "companies" });
	const [drawer, setDrawer] = (0, import_react.useState)(null);
	const [detail, setDetail] = (0, import_react.useState)(null);
	const [officialSymbol, setOfficialSymbol] = (0, import_react.useState)(null);
	const krReports = (0, import_react.useMemo)(() => {
		const d = research.data?.kr;
		if (!d) return [];
		const seen = /* @__PURE__ */ new Set();
		return [...d.company, ...d.industry].filter((r) => {
			const k = `${r.v2Type ?? r.category}:${r.researchId}`;
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		}).map((r) => ({
			r,
			row: reportRow(r)
		})).sort((a, b) => compareNewestFirst(a.row, b.row)).map((x) => x.r);
	}, [research.data?.kr]);
	const researchRows = (0, import_react.useMemo)(() => {
		const kr = krReports.map(reportRow);
		const us = (research.data?.street.notes ?? []).map((n) => ({
			id: `us:${n.id}`,
			title: `${n.symbol} · ${n.broker} ${n.actionKo || n.action}${n.rating ? ` → ${n.rating}` : ""}`,
			source: n.sourceLabel,
			url: n.pageUrl,
			publishedAt: n.publishedAt,
			precision: n.precision,
			sourceTier: 3
		}));
		return [...kr, ...us].sort(compareNewestFirst);
	}, [krReports, research.data?.street.notes]);
	const basketKr = universe.kr.filter((r) => r.exposure !== "indirect");
	const basketUs = universe.us.filter((r) => r.exposure !== "indirect");
	const krEw = equalWeightChange(basketKr.map((r) => r.changePct));
	const usEw = equalWeightChange(basketUs.map((r) => r.changePct));
	const moversKr = topMovers(universe.kr);
	const moversUs = topMovers(universe.us);
	const allSources = [...market.sources, ...policy.sources];
	const uniReason = universe.isLoading ? "수신 중" : universe.isError ? "유니버스 조회 실패" : "확인된 종목 시세 없음";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				kicker: "Robotics · 로봇·자동화·피지컬 AI",
				title: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bot, { className: "size-7 text-desk-teal" }), " 로봇 섹션"]
				}),
				lead: "국내·미국 로봇 기업 시세, 시장 동향, 정책(Federal Register·국내 보도), 리서치와 로봇 ETF를 한 곳에서 최신순으로 봅니다. 기업 목록은 실행 시점에 시세로 확인된 종목만 표시합니다.",
				aside: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-start gap-1.5 sm:items-end",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[11px] text-muted-foreground",
						children: ["기준 ", market.generatedAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
							publishedAt: market.generatedAt,
							precision: "second"
						}) : "—"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceHealthChip, { sources: allSources })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageDisclaimer, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1",
				role: "tablist",
				"aria-label": "로봇 섹션 탭",
				children: TABS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/robotics",
					search: { tab: t.id },
					role: "tab",
					"aria-selected": tab === t.id,
					className: cn("flex min-h-10 flex-1 basis-[30%] items-center justify-center rounded-md px-2 text-[12px] font-semibold sm:basis-0", tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
					children: t.label
				}, t.id))
			}),
			tab === "overview" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3",
				"data-testid": "robotics-overview",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KpiTile, {
								testId: "kr-basket",
								label: "KR 바스켓 1D (동일가중)",
								pct: krEw,
								source: `네이버 시세 · ${basketKr.length}종목 · 간접 노출 제외`,
								reason: uniReason
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KpiTile, {
								testId: "us-basket",
								label: "US 바스켓 1D (동일가중)",
								pct: usEw,
								source: `Yahoo Finance(지연) · ${basketUs.length}종목 · 간접 노출 제외`,
								reason: uniReason
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KpiTile, {
								testId: "policy-7d",
								label: "정책 항목 (7일)",
								value: now != null && policy.sources.some((s) => s.ok) ? `${countWithin(policy.items, now, 168)}건` : null,
								source: "Federal Register · Google 뉴스 · 로봇신문",
								reason: feedEmptyReason(policy.sources, policy.isLoading)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KpiTile, {
								testId: "research-7d",
								label: "리서치 (7일)",
								value: now != null && research.data ? `${countWithin(researchRows, now, 168)}건` : null,
								source: "네이버 리서치 v2 · Finviz 공개 등급",
								reason: research.isLoading ? "수신 중" : "리서치 미수신"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KpiTile, {
								testId: "news-24h",
								label: "뉴스 (24시간)",
								value: now != null && market.sources.some((s) => s.ok) ? `${countWithin(market.items, now, 24)}건` : null,
								source: "Robot Report · 로봇신문 · Google 뉴스",
								reason: feedEmptyReason(market.sources, market.isLoading)
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 md:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
							title: "상승·하락 상위 (KR)",
							note: "네이버 시세 · 약 30초 캐시",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-2 gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoverList, {
									rows: moversKr.up,
									market: "KR"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoverList, {
									rows: moversKr.down,
									market: "KR"
								})]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
							title: "상승·하락 상위 (US)",
							note: "Yahoo Finance · 지연 시세",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-2 gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoverList, {
									rows: moversUs.up,
									market: "US"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoverList, {
									rows: moversUs.down,
									market: "US"
								})]
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 lg:grid-cols-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
								title: "최신 시장 동향 5",
								action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/robotics",
									search: { tab: "market" },
									className: "text-[11px] font-semibold text-primary hover:underline",
									children: "전체 →"
								}),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedPreview, {
									items: market.items.slice(0, 5),
									empty: feedEmptyReason(market.sources, market.isLoading)
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
								title: "최신 정책 5 (KR·US)",
								action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/robotics",
									search: { tab: "policy" },
									className: "text-[11px] font-semibold text-primary hover:underline",
									children: "전체 →"
								}),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedPreview, {
									items: policy.items.slice(0, 5),
									empty: feedEmptyReason(policy.sources, policy.isLoading)
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
								title: "최신 리서치 5",
								action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/robotics",
									search: { tab: "research" },
									className: "text-[11px] font-semibold text-primary hover:underline",
									children: "전체 →"
								}),
								children: researchRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[10.5px] text-muted-foreground",
									children: research.isLoading ? "수신 중…" : "리서치 미수신 또는 해당 없음"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "space-y-1.5",
									children: researchRows.slice(0, 5).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "min-w-0 text-[11.5px]",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
												publishedAt: r.publishedAt,
												precision: r.precision
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: r.source })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
											href: r.url,
											target: "_blank",
											rel: "noopener noreferrer",
											className: "line-clamp-2 font-medium hover:underline",
											children: r.title
										})]
									}, r.id))
								})
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AiBriefingPanel, {
						items: overviewAiItems(market.items, policy.items, researchRows),
						context: "로봇 산업 동향"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
						title: "로봇 ETF 스냅샷",
						note: "국내: 네이버 ETF 목록에서 이름(로봇·휴머노이드·로보틱스) 기준 · 미국: 지정 목록을 Yahoo로 확인",
						action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/robotics",
							search: { tab: "etf" },
							className: "text-[11px] font-semibold text-primary hover:underline",
							children: "전체 →"
						}),
						children: (etfs.data?.kr.length ?? 0) + (etfs.data?.us.length ?? 0) === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10.5px] text-muted-foreground",
							children: etfs.isLoading ? "수신 중…" : `ETF 시세 미수신${etfs.data?.krError ? ` (${etfs.data.krError})` : ""}`
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EtfTable, {
							rows: [...(etfs.data?.kr ?? []).slice(0, 5), ...(etfs.data?.us ?? []).slice(0, 3)],
							market: "KR"
						})
					})
				]
			}),
			tab === "market" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
				title: "시장 동향",
				note: "The Robot Report · 로봇신문 · Google 뉴스(KR·EN) · 한국경제 IT(로봇 키워드). 주제 칩은 기사 제목·요약의 로봇 용어로 분류합니다.",
				testId: "robotics-market",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewsDesk, {
					items: market.items,
					sources: market.sources,
					loading: market.isLoading,
					hasMore: Boolean(market.hasNextPage),
					loadingMore: market.isFetchingNextPage,
					onLoadMore: () => void market.fetchNextPage()
				})
			}),
			tab === "policy" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
				title: "정책",
				note: "미국: Federal Register(로봇 용어가 제목·초록에 있는 문서만, 합병 사전신고·조기종료 공고 제외) · Google News. 국내: Google 뉴스 · 로봇신문(정책 기사). 상태 칩(발표·입법예고·시행·조사/검토·기타)은 원문에 있는 표현으로만 표시하며 현재 정책 상태를 단정하지 않습니다.",
				testId: "robotics-policy",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewsDesk, {
					items: policy.items,
					sources: policy.sources,
					loading: policy.isLoading,
					hasMore: Boolean(policy.hasNextPage),
					loadingMore: policy.isFetchingNextPage,
					onLoadMore: () => void policy.fetchNextPage()
				})
			}),
			tab === "companies" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UniverseEditor, {
						hidden: universe.hidden,
						unresolved: universe.data?.unresolved ?? []
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
						title: `한국 (${universe.kr.length})`,
						note: "시세: 네이버 · 약 30초 캐시. 최근 뉴스: 네이버 종목 뉴스 · 최근 리서치: 네이버 리서치 v2(기업). 행을 누르면 종목 뉴스가 열립니다.",
						children: universe.kr.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanyTable, {
							rows: universe.kr,
							market: "KR",
							latestNews: meta.data?.latestNews,
							latestResearch: meta.data?.latestResearch,
							metaLoading: meta.isLoading,
							onOpen: setDrawer
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, { reason: universe.isLoading ? "수신 중…" : "시세로 확인된 한국 로봇 종목이 없습니다(소스 응답 없음). 코드를 추정해 채우지 않습니다." })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
						title: `미국 (${universe.us.length})`,
						note: "시세: Yahoo Finance(지연). 시가총액은 Yahoo 차트 응답에 없어 표시하지 않습니다. 최근 뉴스·등급 변경: Finviz 공개 페이지. 행을 누르면 영문 Google News가 열립니다.",
						children: universe.us.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanyTable, {
							rows: universe.us,
							market: "US",
							latestNews: meta.data?.latestNews,
							latestResearch: meta.data?.latestResearch,
							metaLoading: meta.isLoading,
							onOpen: setDrawer
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, { reason: universe.isLoading ? "수신 중…" : "Yahoo로 확인된 미국 로봇 종목이 없습니다(소스 응답 없음)." })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-[10.5px] text-muted-foreground",
						children: [
							"비상장 관심 기업(뉴스만): Figure AI · Agility Robotics · Apptronik · 1X · Boston Dynamics(현대차그룹) — 시장 동향 탭 기사로만 다룹니다.",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/industry/$sectorId",
								params: { sectorId: "robotics" },
								className: "font-semibold text-primary hover:underline",
								children: "기존 섹터 종목표 →"
							})
						]
					})
				]
			}),
			tab === "research" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3",
				"data-testid": "robotics-research",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
						title: `한국 리서치 (${krReports.length})`,
						note: `네이버 리서치 v2 — 산업 리포트 중 로봇 키워드 포함 + 로봇 종목 기업 리포트(요청당 10종목). 요약은 원문 발췌 · 최신순.${research.data?.kr.paths.length ? ` 경로: ${research.data.kr.paths.join(", ")}` : ""}`,
						children: krReports.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, { reason: research.isLoading ? "수신 중…" : research.data?.kr.errors.length ? `리서치를 받지 못했습니다 (${research.data.kr.errors[0]}).` : "로봇 관련 리포트가 없습니다." }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid gap-2 md:grid-cols-2",
							children: krReports.slice(0, 40).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchCard, {
								report: r,
								onDetail: setDetail
							}, `${r.v2Type ?? r.category}:${r.researchId}`))
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
						title: "미국 — 공개 등급·목표가 변경 (STREET)",
						note: "Finviz 공개 페이지의 로봇 종목 등급 변경. 공개된 정보만이며 원문 리포트가 아닙니다.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StreetMovesTable, { pack: research.data ? {
							notes: research.data.street.notes,
							headlines: research.data.street.headlines,
							consensus: [],
							note: research.data.street.note,
							fetchedAt: research.data.street.fetchedAt
						} : void 0 })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SectionCard, {
							title: "미국 — OFFICIAL 공시 (요청 시 조회)",
							note: "종목을 고르면 SEC EDGAR 원문 목록을 불러옵니다.",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-1",
								children: [universe.us.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setOfficialSymbol(r.code),
									"aria-pressed": officialSymbol === r.code,
									className: cn("inline-flex min-h-9 items-center rounded-md border px-2 text-[11px] font-semibold", officialSymbol === r.code ? "border-foreground/30 bg-foreground text-background" : "border-border hover:bg-muted/50"),
									children: r.code
								}, r.code)), universe.us.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[10.5px] text-muted-foreground",
									children: "확인된 미국 종목이 없습니다."
								})]
							}), officialSymbol && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanyOfficial, { symbol: officialSymbol })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicResearchNote, {})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchDetailSheet, {
						report: detail,
						onClose: () => setDetail(null),
						onOpenReport: setDetail
					})
				]
			}),
			tab === "etf" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3",
				"data-testid": "robotics-etf",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
						title: `국내 로봇 ETF (${etfs.data?.kr.length ?? 0})`,
						note: "네이버 ETF 목록에서 이름에 로봇·휴머노이드·로보틱스·robot·humanoid가 들어간 ETF를 실행 시점에 찾습니다 · 시총 큰 순.",
						children: (etfs.data?.kr.length ?? 0) > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EtfTable, {
							rows: etfs.data.kr,
							market: "KR"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, { reason: etfs.isLoading ? "수신 중…" : `ETF 목록을 받지 못했습니다${etfs.data?.krError ? ` (${etfs.data.krError})` : ""}.` })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionCard, {
						title: `미국 로봇 ETF (${etfs.data?.us.length ?? 0})`,
						note: "지정 목록(BOTZ·ROBO·ARKQ·KOID·HUMN·BOTT)을 Yahoo 차트로 확인한 것만 표시합니다. 확인되지 않은 심볼은 숨기고 소스 상태에 적습니다.",
						children: (etfs.data?.us.length ?? 0) > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EtfTable, {
							rows: etfs.data.us,
							market: "US"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, { reason: etfs.isLoading ? "수신 중…" : "Yahoo로 확인된 미국 로봇 ETF가 없습니다(소스 응답 없음)." })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/news/etf",
						className: "inline-flex min-h-9 items-center text-[11px] font-semibold text-primary hover:underline",
						children: "ETF 뉴스 브리핑 →"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanyNewsSheet, {
				target: drawer,
				onClose: () => setDrawer(null)
			})
		]
	});
}
//#endregion
export { RoboticsPage as component };
