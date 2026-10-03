import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as getUniverseItem } from "./universe-BLkYDatc.mjs";
import { r as formatItemTime, s as parseSourceTime } from "./time-By5ScNNo.mjs";
import { i as US_LINK_PILLARS, n as US_LINKED_NAMES, r as US_LINK_CATEGORY_LABEL } from "./us-link-7--eFHFs.mjs";
import { A as Newspaper, C as RefreshCw, T as Radio, Z as Flag, at as ExternalLink, ct as Crosshair, nt as Factory, q as Landmark, z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { A as useUsLinkDesk, Lt as usePriceColors, Pt as cn, T as useQuoteMap, vt as formatPct, yt as formatPrice } from "./router-B1V8nj-n.mjs";
import { t as Badge } from "./badge-CgqpWL27.mjs";
import { t as ReadableProse } from "./ReadableProse-C0Kf0S2X.mjs";
import { t as SourceLinks } from "./SourceLinks-BhZNbLNu.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/us-link-BEY7K2Fe.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function fmtTime(raw) {
	const t = parseSourceTime(raw, { zone: "Asia/Seoul" });
	if (!t.iso) return raw ? "날짜 미상" : "상시 링크";
	return formatItemTime({
		publishedAt: t.iso,
		precision: t.precision
	});
}
function kindLabel(kind) {
	if (kind === "official") return "공식";
	if (kind === "report") return "리포트";
	return "기사";
}
function kindClass(kind) {
	if (kind === "official") return "chip-gold border-0";
	if (kind === "report") return "chip-rose border-0";
	return "chip-teal border-0";
}
function LiveFeedList({ items, empty }) {
	if (!items.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "py-10 text-center text-sm text-muted-foreground",
		children: empty
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "divide-y divide-border max-h-[640px] overflow-y-auto scroll-thin",
		children: items.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "py-3.5 first:pt-1",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-1.5 mb-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							className: cn("text-[10px]", kindClass(a.kind)),
							children: kindLabel(a.kind)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted-foreground",
							children: a.source
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted-foreground tabular",
							children: fmtTime(a.datetime)
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: a.url,
					target: "_blank",
					rel: "noopener noreferrer",
					className: "group inline-flex items-start gap-1.5 text-base font-semibold leading-snug text-pretty hover:underline",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: a.title }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5 shrink-0 mt-1 opacity-50 group-hover:opacity-100" })]
				}),
				a.summary && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1.5 text-sm leading-relaxed text-foreground/90 line-clamp-3 text-pretty",
					children: a.summary
				}),
				a.deskNote && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-sm leading-relaxed text-desk-gold/95",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold",
						children: "Desk · "
					}), a.deskNote]
				}),
				a.relatedCodes.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 flex flex-wrap gap-1.5",
					children: a.relatedCodes.map((code) => {
						const meta = getUniverseItem(code);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/stock/$ticker",
							params: { ticker: code },
							className: "rounded-md bg-muted px-2 py-1 text-xs font-medium hover:bg-muted/80",
							children: meta?.nameKo ?? code
						}, code);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: a.url,
						target: "_blank",
						rel: "noopener noreferrer",
						className: "inline-flex items-center gap-1 text-sm text-primary hover:underline",
						children: ["원문 보기 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" })]
					}), a.pdfUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: a.pdfUrl,
						target: "_blank",
						rel: "noopener noreferrer",
						className: "inline-flex items-center gap-1 text-sm text-primary hover:underline",
						children: ["PDF ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" })]
					})]
				})
			]
		}, a.id))
	});
}
function UsLinkPage() {
	const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useUsLinkDesk();
	const { map } = useQuoteMap();
	const colors = usePriceColors();
	const [tab, setTab] = (0, import_react.useState)("ai-race");
	const [pillar, setPillar] = (0, import_react.useState)("all");
	const [activeBrief, setActiveBrief] = (0, import_react.useState)(null);
	const quoteByCode = (0, import_react.useMemo)(() => {
		const m = new Map(map);
		for (const q of data?.quotes ?? []) m.set(q.code, q);
		return m;
	}, [map, data?.quotes]);
	const names = (0, import_react.useMemo)(() => {
		return (pillar === "all" ? US_LINKED_NAMES : US_LINKED_NAMES.filter((n) => n.pillar === pillar)).map((n) => {
			const meta = getUniverseItem(n.code);
			const q = quoteByCode.get(n.code);
			return {
				...n,
				meta,
				q
			};
		}).sort((a, b) => (b.q?.changePct ?? -999) - (a.q?.changePct ?? -999));
	}, [pillar, quoteByCode]);
	const briefs = data?.briefs ?? [];
	const feeds = data?.feeds;
	const stockNews = data?.news ?? [];
	const tabs = [
		{
			id: "overview",
			label: "개요"
		},
		{
			id: "ai-race",
			label: "미중 AI 패권 전쟁",
			count: feeds?.aiRace?.length
		},
		{
			id: "policy",
			label: "미국 정책",
			count: feeds?.policy?.length
		},
		{
			id: "industry",
			label: "산업 리포트",
			count: feeds?.industry?.length
		},
		{
			id: "names",
			label: "연계 종목"
		},
		{
			id: "news",
			label: "종목 뉴스"
		}
	];
	const filteredBriefs = briefs.filter((b) => {
		if (tab === "overview") return true;
		if (tab === "ai-race") return b.category === "ai-race";
		if (tab === "policy") return b.category === "policy";
		if (tab === "industry") return b.category === "industry" || b.category === "risk";
		return false;
	});
	const liveItems = tab === "ai-race" ? feeds?.aiRace ?? [] : tab === "policy" ? feeds?.policy ?? [] : tab === "industry" ? feeds?.industry ?? [] : tab === "overview" ? [
		...(feeds?.aiRace ?? []).slice(0, 6),
		...(feeds?.policy ?? []).slice(0, 5),
		...(feeds?.industry ?? []).slice(0, 5)
	] : [];
	const openBrief = briefs.find((b) => b.id === activeBrief);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "desk-card desk-card-gold p-5 md:p-6 relative overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute right-0 top-0 size-44 rounded-full bg-desk-gold/15 blur-3xl" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative flex flex-wrap items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "max-w-3xl space-y-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
							className: "text-2xl font-semibold tracking-tight md:text-3xl flex items-center gap-2 text-balance",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flag, { className: "size-6 text-desk-gold" }), "미국 연계 인텔리전스 데스크"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-base text-muted-foreground leading-relaxed text-pretty",
							children: "Wall Street 관점: 미국 정책·미중 AI 패권·산업 수요가 한국 공급망 실적과 멀티플을 결정합니다. 실시간 기사·공식 문서·증권사 리포트를 클릭해 원문을 확인하고, 연계 종목으로 바로 이동하세요."
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col items-end gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
							className: "chip-gold border-0 gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-3" }), " Live feeds"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => refetch(),
							className: "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: cn("size-3.5", isFetching && "animate-spin") }),
								"새로고침",
								dataUpdatedAt > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground tabular",
									children: new Date(dataUpdatedAt).toLocaleTimeString("ko-KR")
								})
							]
						})]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-1 rounded-lg bg-muted p-1",
				children: tabs.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setTab(t.id),
					className: cn("rounded-md px-3 py-2 text-sm font-medium min-h-11", tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
					children: [t.label, t.count != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-1 tabular text-muted-foreground text-xs",
						children: t.count
					})]
				}, t.id))
			}),
			(tab === "overview" || tab === "ai-race" || tab === "policy" || tab === "industry") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-5 lg:grid-cols-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "lg:col-span-2 space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
							className: "text-lg font-semibold flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "size-4 text-desk-indigo" }), tab === "ai-race" ? "패권 전쟁 핵심 관점" : tab === "policy" ? "정책 핵심 관점" : tab === "industry" ? "산업 핵심 관점" : "데스크 핵심 관점"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-2.5",
							children: filteredBriefs.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setActiveBrief((id) => id === b.id ? null : b.id),
								className: cn("w-full text-left rounded-xl border border-border p-4 transition-colors hover:bg-muted/30", activeBrief === b.id && "ring-1 ring-primary/40 bg-muted/20"),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex flex-wrap items-center gap-1.5 mb-1",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											variant: "outline",
											className: "text-[10px]",
											children: US_LINK_CATEGORY_LABEL[b.category]
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-base font-semibold leading-snug text-balance",
										children: b.title
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-sm leading-relaxed text-foreground/90 line-clamp-3 text-pretty",
										children: b.summary
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-xs text-primary",
										children: "클릭 → 시장 영향·체크리스트·원문 보기"
									})
								]
							}, b.id))
						}),
						openBrief && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-desk-gold/30 bg-card p-4 space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-base font-semibold leading-snug",
									children: openBrief.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadableProse, {
									raw: [
										openBrief.summary,
										`Why it matters: ${openBrief.whyItMatters}`,
										`Market impact: ${openBrief.marketImpact}`
									].join("\n\n"),
									title: "전문가 브리프",
									className: "border-0 p-0 shadow-none ring-0 bg-transparent",
									collapsedParagraphs: 4,
									showBullets: false,
									density: "compact"
								}),
								"watchItems" in openBrief && openBrief.watchItems?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-semibold mb-1.5",
									children: "Watch list"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "space-y-1 text-sm text-foreground/90",
									children: openBrief.watchItems.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "flex gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-desk-gold",
											children: "•"
										}), w]
									}, w))
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-wrap gap-1.5",
									children: openBrief.relatedCodes?.map((code) => {
										const meta = getUniverseItem(code);
										const q = quoteByCode.get(code);
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
											to: "/stock/$ticker",
											params: { ticker: code },
											className: "rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-muted/40",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-medium",
												children: meta?.nameKo ?? code
											}), q && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: cn("ml-1.5 tabular text-xs font-semibold", q.changePct > 0 ? colors.up : q.changePct < 0 ? colors.down : "text-muted-foreground"),
												children: formatPct(q.changePct)
											})]
										}, code);
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "border-t border-border pt-3 space-y-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-sm font-semibold",
											children: "원문 · 1차 자료"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceLinks, {
											primaryUrl: openBrief.sourceUrl,
											primaryLabel: "원문 보기 (1차 소스)",
											more: openBrief.moreSources ?? [],
											searchQuery: `${openBrief.title} ${openBrief.tags?.join(" ") ?? ""}`
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-[11px] text-muted-foreground",
											children: [
												"출처 표기: ",
												openBrief.source,
												". 본 관점은 데스크 요약이며 투자 권유가 아닙니다."
											]
										})
									]
								})
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "lg:col-span-3 desk-card desk-card-indigo p-4 md:p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-2 mb-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
							className: "text-lg font-semibold flex items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Newspaper, { className: "size-4 text-desk-indigo" }),
								"실시간 기사 · 리포트 · 공식",
								isLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin text-muted-foreground" })
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: "Google News + 증권사 리서치 + 미국 공식 기관"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveFeedList, {
						items: liveItems,
						empty: isLoading ? "실시간 피드 수집 중…" : "피드를 불러오지 못했습니다. 새로고침 해 보세요."
					})]
				})]
			}),
			(tab === "overview" || tab === "names") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "grid gap-2 sm:grid-cols-2 lg:grid-cols-3",
				children: US_LINK_PILLARS.map((p) => {
					const codes = US_LINKED_NAMES.filter((n) => n.pillar === p.id);
					const qs = codes.map((c) => quoteByCode.get(c.code)).filter(Boolean);
					const avg = qs.length ? qs.reduce((s, q) => s + (q?.changePct ?? 0), 0) / qs.length : 0;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => {
							setPillar(p.id);
							setTab("names");
						},
						className: cn("desk-card p-4 text-left transition-colors hover:bg-muted/30", `desk-card-${p.accent}`, pillar === p.id && tab === "names" && "ring-1 ring-primary/40"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-base font-semibold",
									children: p.nameKo
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("text-sm font-semibold tabular", avg > 0 ? colors.up : avg < 0 ? colors.down : "text-muted-foreground"),
									children: qs.length ? formatPct(avg) : "—"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-muted-foreground line-clamp-3 leading-relaxed",
								children: p.thesis
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2",
								onClick: (e) => e.stopPropagation(),
								onKeyDown: (e) => e.stopPropagation(),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceLinks, {
									primaryUrl: p.sourceUrl,
									primaryLabel: "원문 보기",
									more: p.moreSources ?? [],
									searchQuery: p.nameKo + " " + p.nameEn,
									size: "sm"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 text-xs text-muted-foreground",
								children: [codes.length, "종목 · 카드 클릭 시 종목 목록"]
							})
						]
					}, p.id);
				})
			}),
			(tab === "overview" || tab === "names") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "desk-card desk-card-teal overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "text-lg font-semibold flex items-center gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Factory, { className: "size-4 text-desk-teal" }), "미국 연계 종목 시세"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setPillar("all"),
							className: cn("rounded px-2.5 py-1.5 text-xs", pillar === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"),
							children: "전체"
						}), US_LINK_PILLARS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setPillar(p.id),
							className: cn("rounded px-2.5 py-1.5 text-xs", pillar === p.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"),
							children: p.nameKo
						}, p.id))]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto scroll-thin",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[720px] text-base",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "bg-muted/40 text-sm text-muted-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "text-left",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-4 py-3",
										children: "종목"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-4 py-3",
										children: "필러"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-4 py-3 text-right",
										children: "현재가"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-4 py-3 text-right",
										children: "등락률"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-4 py-3",
										children: "미국 앵글"
									})
								]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
							className: "divide-y divide-border",
							children: names.map((n) => {
								const pct = n.q?.changePct ?? 0;
								const pillarMeta = US_LINK_PILLARS.find((p) => p.id === n.pillar);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									className: "hover:bg-muted/25",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
											className: "px-4 py-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
												to: "/stock/$ticker",
												params: { ticker: n.code },
												className: "font-semibold hover:underline",
												children: n.meta?.nameKo ?? n.code
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-xs text-muted-foreground tabular",
												children: n.code
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-4 py-3 text-sm text-muted-foreground",
											children: pillarMeta?.nameKo
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-4 py-3 text-right tabular font-semibold",
											children: n.q?.price ? formatPrice(n.q.price) : "—"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: cn("px-4 py-3 text-right tabular text-sm font-semibold", pct > 0 ? colors.up : pct < 0 ? colors.down : "text-muted-foreground"),
											children: n.q ? formatPct(pct) : "—"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-4 py-3 text-sm text-muted-foreground max-w-md leading-relaxed",
											children: n.usAngle
										})
									]
								}, n.code);
							})
						})]
					})
				})]
			}),
			tab === "news" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "desk-card desk-card-copper p-4 md:p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "text-lg font-semibold flex items-center gap-2 mb-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Newspaper, { className: "size-4 text-desk-copper" }), "연계 종목 실시간 뉴스"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "divide-y divide-border max-h-[640px] overflow-y-auto scroll-thin",
					children: [stockNews.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "py-10 text-center text-sm text-muted-foreground",
						children: isLoading ? "로딩…" : "뉴스 없음"
					}), stockNews.map((n) => {
						const meta = getUniverseItem(n.code);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "py-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: n.url || "#",
								target: "_blank",
								rel: "noopener noreferrer",
								className: "text-base font-semibold leading-snug hover:underline",
								children: n.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground",
								children: [
									meta && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/stock/$ticker",
										params: { ticker: n.code },
										className: "text-foreground font-medium hover:underline",
										children: meta.nameKo
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: n.source }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "tabular",
										children: fmtTime(n.datetime)
									})
								]
							})]
						}, `${n.id}-${n.code}`);
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "text-xs text-muted-foreground leading-relaxed max-w-3xl",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Landmark, { className: "size-3.5 inline mr-1" }),
					"공식 소스(BIS, NIST/CHIPS, IRS, Fed, DOE, DoD)와 Google News 검색, 네이버 금융 증권사 리서치를 병합합니다. 편집 관점(요약)은 투자 권유가 아니며, 포지션은 원문·공시로 재확인하세요.",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/research",
						className: "ml-2 text-primary hover:underline",
						children: "리서치 데스크 →"
					})
				]
			})
		]
	});
}
//#endregion
export { UsLinkPage as component };
