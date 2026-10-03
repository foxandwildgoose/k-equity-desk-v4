import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as rankByQuery, t as matchesSearchQuery } from "./search-match-BMQS9B1C.mjs";
import { A as Newspaper, G as Layers, _ as ShieldCheck, b as Search, ft as ChevronRight, p as Sparkles, s as TriangleAlert, z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { Lt as usePriceColors, Nt as Input, Pt as cn, gt as formatIsoDate, vt as formatPct, x as useEtfMarket, yt as formatPrice } from "./router-B1V8nj-n.mjs";
import { t as Badge } from "./badge-CgqpWL27.mjs";
import { t as EtfNewsDesk } from "./EtfNewsDesk-DP3MGzB6.mjs";
import { n as Toolbar } from "./DeskLayout-ShwhtDXH.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/etfs.index-DgQCnS30.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ETF_BUCKET_LABEL = {
	retirement: "퇴직연금 가능",
	all: "전체 ETF",
	new: "신규 상장",
	theme: "국내 테마",
	us: "미국·해외",
	bond: "채권·혼합"
};
var ETF_BUCKET_HINT = {
	retirement: "레버리지·인버스·2X 등 파생 ETF를 제외한 목록입니다. DC·IRP 공통 제한을 반영한 1차 필터이며, 운영사(미래에셋 등) 최종 허용 목록과 100% 일치하지 않을 수 있습니다.",
	all: "한국거래소 상장 ETF 전체(네이버 금융 실시간 목록).",
	new: "최근 3개월 이내 상장 후보. 상장일은 YYYY-MM-DD. 3개월 등락률은 성립하지 않아 표시하지 않습니다.",
	theme: "국내 업종·테마형 (퇴직연금 필터 적용).",
	us: "미국·해외 주식형 및 미국 테마 (퇴직연금 필터 적용).",
	bond: "채권·혼합·기타 (퇴직연금 필터 적용)."
};
function EtfIndexPage() {
	const [tab, setTab] = (0, import_react.useState)("retirement");
	const [q, setQ] = (0, import_react.useState)("");
	const [qDebounced, setQDebounced] = (0, import_react.useState)("");
	const [sort, setSort] = (0, import_react.useState)("default");
	const colors = usePriceColors();
	const isNews = tab === "etf-news";
	const bucket = isNews ? "new" : tab;
	const isNew = tab === "new";
	(0, import_react.useEffect)(() => {
		const t = setTimeout(() => setQDebounced(q), 250);
		return () => clearTimeout(t);
	}, [q]);
	(0, import_react.useEffect)(() => {
		if (tab !== "new" && sort === "listed-new") setSort("default");
		if (tab === "new" && sort === "default") setSort("listed-new");
	}, [tab, sort]);
	const { data, isLoading, isError, isFetching } = useEtfMarket({
		bucket,
		q: isNews ? "" : qDebounced,
		limit: bucket === "all" ? 200 : 150,
		enabled: !isNews
	});
	const etfs = (0, import_react.useMemo)(() => {
		const raw = data?.etfs ?? [];
		const needle = q.trim();
		let rows = raw;
		if (needle) {
			const hits = raw.filter((e) => matchesSearchQuery(needle, [
				e.nameKo,
				e.code,
				e.tabLabel,
				e.issuer
			]));
			rows = rankByQuery(hits, needle, (e) => ({
				name: e.nameKo,
				code: e.code
			}));
		}
		if (sort === "listed-new") return [...rows].sort((a, b) => {
			const da = a.listedAt ? formatIsoDate(a.listedAt) : "";
			const db = b.listedAt ? formatIsoDate(b.listedAt) : "";
			if (da && db && da !== db) return db.localeCompare(da);
			if (da && !db) return -1;
			if (!da && db) return 1;
			return (a.daysListed ?? 9999) - (b.daysListed ?? 9999);
		});
		if (sort === "price-low") return [...rows].sort((a, b) => {
			const pa = a.price > 0 ? a.price : Number.POSITIVE_INFINITY;
			const pb = b.price > 0 ? b.price : Number.POSITIVE_INFINITY;
			if (pa !== pb) return pa - pb;
			return a.nameKo.localeCompare(b.nameKo, "ko");
		});
		if (sort === "volume-high") return [...rows].sort((a, b) => {
			const va = a.volume > 0 ? a.volume : Number.NEGATIVE_INFINITY;
			const vb = b.volume > 0 ? b.volume : Number.NEGATIVE_INFINITY;
			if (va !== vb) return vb - va;
			return a.nameKo.localeCompare(b.nameKo, "ko");
		});
		if (sort === "market-sum-high") return [...rows].sort((a, b) => {
			const ma = a.marketSum > 0 ? a.marketSum : Number.NEGATIVE_INFINITY;
			const mb = b.marketSum > 0 ? b.marketSum : Number.NEGATIVE_INFINITY;
			if (ma !== mb) return mb - ma;
			return a.nameKo.localeCompare(b.nameKo, "ko");
		});
		return rows;
	}, [
		data?.etfs,
		q,
		sort
	]);
	const stats = data?.stats;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "page-header",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "desk-kicker mb-1.5",
						children: "Retirement & listed ETF"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "page-title flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "size-7 text-desk-gold" }), "ETF 데스크"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "page-lead",
						children: "한국거래소 상장 ETF. ETF 뉴스 탭은 신규 상장·상장 예정·상장폐지·자금 흐름·퇴직연금 기사를 최신순으로 모으고, 기사 속 ETF를 실시간 목록과 맞춰 보여줍니다."
					}),
					stats && !isNews && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "chip-gold px-2 py-1",
								children: ["전체 ", stats.total.toLocaleString()]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "chip-teal px-2 py-1",
								children: ["퇴직연금 후보 ", stats.retirementEligible.toLocaleString()]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "chip-copper px-2 py-1",
								children: ["파생 제외 ", stats.leverageExcluded.toLocaleString()]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "chip-indigo px-2 py-1",
								children: ["신규 후보 ", stats.newCandidates.toLocaleString()]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Toolbar, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "seg-tabs",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setTab("retirement"),
							className: cn("seg-tab", tab === "retirement" ? "seg-tab-on" : ""),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "size-3 text-desk-teal" }), "퇴직연금 가능"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setTab("new"),
							className: cn("seg-tab", tab === "new" ? "seg-tab-on" : ""),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3 text-desk-gold" }), "신규 상장"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setTab("etf-news"),
							className: cn("seg-tab", isNews ? "seg-tab-on" : ""),
							"data-testid": "etf-news-tab",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Newspaper, { className: "size-3 text-desk-gold" }), "ETF 뉴스"]
						}),
						[
							"all",
							"theme",
							"us",
							"bond"
						].map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setTab(b),
							className: cn("seg-tab", tab === b ? "seg-tab-on" : ""),
							children: ETF_BUCKET_LABEL[b]
						}, b))
					]
				}),
				!isNews && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative w-full sm:w-72",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: q,
							onChange: (e) => setQ(e.target.value),
							placeholder: "방산소부장 · AI데이터센터 · 바이오…",
							className: "h-10 pl-9 text-sm"
						}),
						q.trim() && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1.5 text-xs text-muted-foreground",
							children: [
								"“",
								q.trim(),
								"” 검색 ",
								etfs.length,
								"건"
							]
						})
					]
				}),
				!isNews && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] font-semibold text-muted-foreground mr-1",
							children: "정렬"
						}),
						isNew ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setSort("listed-new"),
							className: cn("seg-tab text-[11px]", sort === "listed-new" && "seg-tab-on"),
							children: "상장일 최신순"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setSort("default"),
							className: cn("seg-tab text-[11px]", sort === "default" && "seg-tab-on"),
							children: "기본"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setSort("price-low"),
							className: cn("seg-tab text-[11px]", sort === "price-low" && "seg-tab-on"),
							children: "현재가 낮은순"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setSort("volume-high"),
							className: cn("seg-tab text-[11px]", sort === "volume-high" && "seg-tab-on"),
							children: "거래량 많은순"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setSort("market-sum-high"),
							className: cn("seg-tab text-[11px]", sort === "market-sum-high" && "seg-tab-on"),
							children: "시총(억) 높은순"
						})
					]
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted-foreground flex items-start gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-3.5 shrink-0 mt-0.5 text-desk-copper" }), isNews ? "국내 언론의 ETF 기사입니다. 제목을 누르면 원문이 새 창에서 열립니다." : data?.note ?? ETF_BUCKET_HINT[bucket]]
			}),
			isNews ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EtfNewsDesk, { embedded: true }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				(isLoading || isFetching) && etfs.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-sm text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), " ETF 목록 로딩…"]
				}),
				isError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-price-down",
					children: "ETF 목록 조회 실패"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "desk-card desk-card-navy overflow-hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-x-auto scroll-thin",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "desk-table min-w-[720px]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "ETF" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "유형" }),
								isNew && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "text-right",
									children: "상장일"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "text-right",
									children: "현재가"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "text-right",
									children: "등락률"
								}),
								!isNew && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "text-right",
									children: "3M"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "text-right",
									children: "거래량"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "text-right",
									children: "시총(억)"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {})
							] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
								className: "divide-y divide-border",
								children: [etfs.length === 0 && q.trim() && !isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									colSpan: 8,
									className: "px-3 py-10 text-center text-sm text-muted-foreground",
									children: [
										"“",
										q.trim(),
										"”에 해당하는 ETF가 없습니다. 종목명·코드·테마 키워드로 다시 검색하세요."
									]
								}) }) : null, etfs.map((e) => {
									const up = e.changePct > 0;
									const down = e.changePct < 0;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
										className: "hover:bg-muted/25",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "px-3 py-2.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
													to: "/etfs/$code",
													params: { code: e.code },
													className: "font-medium hover:underline",
													children: e.nameKo
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "tabular",
															children: e.code
														}),
														e.isNewCandidate && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
															className: "chip-gold border-0 text-[9px] h-4",
															children: "NEW"
														}),
														!e.retirementEligible && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
															variant: "outline",
															className: "text-[9px] h-4 text-desk-rose",
															children: "파생"
														}),
														e.daysListed != null && e.daysListed <= 90 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-desk-teal",
															children: [
																"상장 ",
																e.daysListed,
																"일"
															]
														})
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "px-3 py-2.5 text-[11px] text-muted-foreground",
												children: e.tabLabel
											}),
											isNew && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "px-3 py-2.5 text-right tabular text-xs font-semibold",
												children: formatIsoDate(e.listedAt)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "px-3 py-2.5 text-right tabular font-semibold",
												children: e.price ? formatPrice(e.price) : "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: cn("px-3 py-2.5 text-right tabular text-xs font-semibold", up ? colors.up : down ? colors.down : "text-muted-foreground"),
												children: formatPct(e.changePct)
											}),
											!isNew && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "px-3 py-2.5 text-right tabular text-xs text-muted-foreground",
												children: e.threeMonthEarnRate == null ? "—" : formatPct(e.threeMonthEarnRate)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "px-3 py-2.5 text-right tabular text-xs text-muted-foreground",
												children: e.volume ? e.volume.toLocaleString("ko-KR") : "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "px-3 py-2.5 text-right tabular text-xs text-muted-foreground",
												children: e.marketSum ? e.marketSum.toLocaleString("ko-KR") : "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "px-3 py-2.5 text-right",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
													to: "/etfs/$code",
													params: { code: e.code },
													className: "inline-flex items-center text-[11px] text-primary hover:underline",
													children: ["상세 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3" })]
												})
											})
										]
									}, e.code);
								})]
							})]
						})
					}), etfs.length === 0 && !isLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-3 py-10 text-center text-sm text-muted-foreground",
						children: "조건에 맞는 ETF가 없습니다. 검색어나 탭을 바꿔 보세요."
					})]
				})
			] })
		]
	});
}
//#endregion
export { EtfIndexPage as component };
