import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { a as applyEtfNewsFilter, i as ETF_THEMES, n as ETF_ISSUER_BRANDS, o as buildEtfBriefing, r as ETF_STAGE_LABEL, t as EMPTY_ETF_FILTER } from "./etf-news-D8YKQLOx.mjs";
import { _ as ShieldCheck, bt as Bot } from "../_libs/lucide-react.mjs";
import { J as SourceHealthChip, Lt as usePriceColors, Pt as cn, Q as SourceBadge, et as TimeStamp, lt as useFeed, q as NewsDesk, tt as useNow, vt as formatPct, yt as formatPrice } from "./router-B1V8nj-n.mjs";
import { n as themeMomentum, r as topStories, t as BriefingDigest } from "./briefing-5XLfzMfc.mjs";
import { r as feedToAiItems, t as AiBriefingPanel } from "./AiBriefingPanel-HuDAM7_1.mjs";
import { t as useEtfNewsSnapshot } from "./use-themes-BkxRsJtl.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/EtfNewsDesk-DP3MGzB6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var STAGES = [
	"listed",
	"scheduled",
	"delisting",
	"flow",
	"retirement",
	"other"
];
function toggle(list, v) {
	return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}
function Chip({ on, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		"aria-pressed": on,
		onClick,
		className: cn("inline-flex min-h-9 items-center rounded-md border px-2 text-[11px] font-medium sm:min-h-7", on ? "border-foreground/30 bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:text-foreground"),
		children
	});
}
function BriefList({ title, items, window, empty }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 rounded-lg border border-border p-2",
		"data-etf-brief": title,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-1 text-[11px] font-semibold",
			children: [
				title,
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "font-normal text-muted-foreground",
					children: [
						"(",
						window,
						")"
					]
				})
			]
		}), items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[10.5px] text-muted-foreground",
			children: empty
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-1",
			children: items.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "min-w-0 text-[11px]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
							publishedAt: it.publishedAt,
							precision: it.precision
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceBadge, { item: it })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: it.url,
						target: "_blank",
						rel: "noopener noreferrer",
						className: "line-clamp-2 font-medium hover:underline",
						children: it.title
					}),
					it.etf && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/etfs/$code",
						params: { code: it.etf.code },
						className: "text-[10px] text-primary hover:underline",
						children: [it.etf.name, " →"]
					})
				]
			}, it.id))
		})]
	});
}
/**
* KR ETF News Briefing (F5): ETF-only stories from GN topic + issuer queries,
* Hankyung finance (ETF keyword filter) and Naver search, matched to the live
* ETF list. Used by `/news/etf` and the `/etfs` "ETF 뉴스" tab.
*/
function EtfNewsDesk({ embedded = false }) {
	const feed = useFeed({
		region: "KR",
		group: "etf",
		limit: 80
	});
	const snap = useEtfNewsSnapshot();
	const now = useNow(6e4);
	const colors = usePriceColors();
	const [ef, setEf] = (0, import_react.useState)(EMPTY_ETF_FILTER);
	const brief = (0, import_react.useMemo)(() => now ? buildEtfBriefing(feed.items, [], now) : null, [feed.items, now]);
	const stories = (0, import_react.useMemo)(() => now ? topStories(feed.items, { now }) : [], [feed.items, now]);
	const themes = (0, import_react.useMemo)(() => now ? themeMomentum(feed.items, { now }) : [], [feed.items, now]);
	const visible = (0, import_react.useMemo)(() => applyEtfNewsFilter(feed.items, ef), [feed.items, ef]);
	const brandsPresent = (0, import_react.useMemo)(() => {
		const set = new Set(feed.items.flatMap((it) => it.topics.filter((t) => t.startsWith("brand:")).map((t) => t.slice(6))));
		return ETF_ISSUER_BRANDS.filter((b) => set.has(b.brand));
	}, [feed.items]);
	const themesPresent = (0, import_react.useMemo)(() => {
		const set = new Set(feed.items.flatMap((it) => it.topics.filter((t) => t.startsWith("theme:")).map((t) => t.slice(6))));
		return ETF_THEMES.filter((t) => set.has(t.id));
	}, [feed.items]);
	const tiles = (0, import_react.useMemo)(() => (snap.data?.topTrading ?? []).slice(0, 4).map((e, i) => ({
		id: e.code,
		label: `거래대금 ${i + 1}위 · ${e.name}`,
		value: e.price != null ? `${formatPrice(e.price)}원` : null,
		change: "",
		changePct: e.changePct,
		source: "네이버 ETF 목록",
		delay: "약 60초 캐시",
		reason: "시세 미수신"
	})), [snap.data?.topTrading]);
	const snapshotNote = snap.isLoading ? "ETF 목록 수신 중…" : snap.data?.error ? `ETF 목록 미수신 (${snap.data.error})` : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		"data-testid": "etf-news-desk",
		children: [
			embedded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					"ETF 뉴스 브리핑 · 기준 ",
					feed.generatedAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
						publishedAt: feed.generatedAt,
						precision: "second"
					}) : "—",
					" ·",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/news/etf",
						className: "font-semibold text-primary hover:underline",
						children: "전체 화면 →"
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceHealthChip, { sources: feed.sources })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BriefingDigest, {
				asOf: feed.generatedAt,
				tiles,
				topStories: stories,
				themes,
				extra: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [snapshotNote && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[10.5px] text-muted-foreground",
						children: snapshotNote
					}), (snap.data?.robotAi.length ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "mb-1 inline-flex items-center gap-1 text-[11px] font-semibold",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bot, { className: "size-3.5 text-desk-teal" }),
								" 로봇·AI ETF ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-normal text-muted-foreground",
									children: "(이름 기준 · 네이버 ETF 목록)"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-1",
							"data-testid": "etf-robot-chips",
							children: snap.data.robotAi.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/etfs/$code",
								params: { code: e.code },
								className: "inline-flex min-h-8 items-center gap-1 rounded-md border border-border px-1.5 text-[10.5px] hover:bg-muted/50",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "max-w-[11rem] truncate",
									children: e.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("tabular", (e.changePct ?? 0) > 0 && colors.up, (e.changePct ?? 0) < 0 && colors.down),
									children: e.changePct != null ? formatPct(e.changePct) : "—"
								})]
							}, e.code))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/robotics",
							search: { tab: "etf" },
							className: "mt-1 inline-flex min-h-8 items-center text-[10.5px] font-semibold text-primary hover:underline",
							children: "로봇 섹션 ETF 탭 →"
						})
					] })]
				}),
				aiSlot: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AiBriefingPanel, {
					items: feedToAiItems(feed.items),
					context: "국내 ETF 뉴스"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-2 sm:grid-cols-2 xl:grid-cols-4",
				"aria-label": "ETF 브리핑 목록",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BriefList, {
						title: "신규 상장 · 상장 예정",
						window: "최근 14일 보도",
						items: brief?.listing ?? [],
						empty: "해당 기사 없음 또는 미수신"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BriefList, {
						title: "상장폐지 예정",
						window: "최근 30일 보도",
						items: brief?.delisting ?? [],
						empty: "해당 기사 없음 또는 미수신"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BriefList, {
						title: "자금 흐름",
						window: "최근 7일",
						items: brief?.flow ?? [],
						empty: "해당 기사 없음 또는 미수신"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BriefList, {
						title: "퇴직연금 제도",
						window: "최근 14일",
						items: brief?.retirement ?? [],
						empty: "해당 기사 없음 또는 미수신"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5 rounded-lg border border-border bg-muted/15 p-2.5",
				"data-testid": "etf-filter-row",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-1",
						"aria-label": "단계",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mr-1 text-[10px] font-semibold text-muted-foreground",
								children: "단계"
							}),
							STAGES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
								on: ef.stages.includes(s),
								onClick: () => setEf({
									...ef,
									stages: toggle(ef.stages, s)
								}),
								children: ETF_STAGE_LABEL[s]
							}, s)),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
								on: ef.retirementOnly,
								onClick: () => setEf({
									...ef,
									retirementOnly: !ef.retirementOnly
								}),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "mr-0.5 size-3" }), " 퇴직연금 가능만"]
							})
						]
					}),
					brandsPresent.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-1",
						"aria-label": "운용사",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mr-1 text-[10px] font-semibold text-muted-foreground",
							children: "운용사"
						}), brandsPresent.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
							on: ef.issuers.includes(b.brand),
							onClick: () => setEf({
								...ef,
								issuers: toggle(ef.issuers, b.brand)
							}),
							children: b.brand
						}, b.brand))]
					}),
					themesPresent.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-1",
						"aria-label": "테마",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mr-1 text-[10px] font-semibold text-muted-foreground",
							children: "테마"
						}), themesPresent.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
							on: ef.themes.includes(t.id),
							onClick: () => setEf({
								...ef,
								themes: toggle(ef.themes, t.id)
							}),
							children: t.label
						}, t.id))]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[10px] text-muted-foreground",
						children: "퇴직연금 가능 = 레버리지·인버스 제외(기존 휴리스틱)이며 운용사 DC/IRP 허용 목록과 다를 수 있습니다."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewsDesk, {
				items: visible,
				sources: feed.sources,
				loading: feed.isLoading,
				hasMore: Boolean(feed.hasNextPage),
				loadingMore: feed.isFetchingNextPage,
				onLoadMore: () => void feed.fetchNextPage()
			})
		]
	});
}
//#endregion
export { EtfNewsDesk as t };
