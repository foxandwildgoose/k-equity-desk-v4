import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { at as ExternalLink, p as Sparkles } from "../_libs/lucide-react.mjs";
import { C as useMarketIndices, G as krSessionEstimate, J as SourceHealthChip, W as krIndexStatusLabel, dt as useNaverAiBriefing, et as TimeStamp, lt as useFeed, q as NewsDesk, tt as useNow, ut as useMarketSnapshot } from "./router-B1V8nj-n.mjs";
import { t as PageDisclaimer } from "./PageDisclaimer-Dk4wCTj5.mjs";
import { n as themeMomentum, r as topStories, t as BriefingDigest } from "./briefing-5XLfzMfc.mjs";
import { r as feedToAiItems, t as AiBriefingPanel } from "./AiBriefingPanel-HuDAM7_1.mjs";
import { t as PageHeader } from "./PageHeader-aQOrmONW.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/news.kr-HzwbqsBM.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* F1.5: Naver Pay's own AI market briefing, attributed and linked. This is a
* third-party AI text shown as provided — clearly labeled, never mixed with
* the app's deterministic digest.
*/
function NaverAiBriefingCard() {
	const q = useNaverAiBriefing();
	const cur = q.data?.current;
	const list = (q.data?.list ?? []).filter((b) => b.id !== cur?.id).slice(0, 4);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-lg border border-border bg-muted/15 p-3",
		"aria-label": "네이버페이 증권 AI 시장 브리핑",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
					className: "inline-flex items-center gap-1 text-[11px] font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5 text-desk-indigo" }), " 네이버페이 증권 AI 시장 브리핑"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: "https://stock.naver.com/",
					target: "_blank",
					rel: "noopener noreferrer",
					className: "inline-flex min-h-8 items-center gap-1 text-[10px] font-semibold text-primary hover:underline",
					children: ["원문 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3" })]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-[10px] text-muted-foreground",
				children: "제3자(네이버) AI 생성 요약 · 원문 확인 필요 · 이 앱이 작성하지 않았습니다"
			}),
			q.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[11px] text-muted-foreground",
				children: "불러오는 중…"
			}) : !cur && !list.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-[11px] text-muted-foreground",
				children: [
					"브리핑을 받지 못했습니다",
					q.data?.error ? ` (${q.data.error})` : "",
					". 소스 미검증 상태일 수 있습니다."
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 space-y-2",
				children: [cur && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
							publishedAt: cur.publishedAt,
							precision: cur.precision
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[12px] font-semibold leading-snug",
						children: cur.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-foreground/90",
						children: cur.bullets.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: b }, b))
					})
				] }), list.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "space-y-1 border-t border-border pt-2",
					children: list.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex gap-2 text-[11px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
							publishedAt: b.publishedAt,
							precision: b.precision,
							className: "text-[10px] text-muted-foreground"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "min-w-0 truncate",
							children: b.title
						})]
					}, b.id))
				})]
			})
		]
	});
}
var KINDS = [{
	id: "news",
	label: "뉴스"
}, {
	id: "disclosure",
	label: "공시"
}];
function fmt(n, digits = 2) {
	return n.toLocaleString("en-US", {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	});
}
function KrNewsPage() {
	const feed = useFeed({
		region: "KR",
		limit: 60
	});
	const indices = useMarketIndices();
	const fx = useMarketSnapshot(["usdkrw"]);
	const now = useNow(6e4);
	const mounted = now != null;
	const tiles = (0, import_react.useMemo)(() => {
		const out = [];
		const byId = new Map((mounted ? indices.data?.indices ?? [] : []).map((i) => [i.id, i]));
		for (const [id, label] of [
			["kospi", "코스피"],
			["kosdaq", "코스닥"],
			["kpi200", "코스피200"]
		]) {
			const i = byId.get(id);
			out.push({
				id,
				label,
				value: i ? fmt(i.value) : null,
				change: i ? `${i.change > 0 ? "+" : ""}${fmt(i.change)}` : null,
				changePct: i ? i.changePct : null,
				source: "네이버 스냅샷",
				delay: "약 30초 갱신",
				reason: !mounted || indices.isLoading ? "수신 중" : "지수 미수신"
			});
		}
		const usd = mounted ? fx.data?.rows.find((r) => r.id === "usdkrw") : void 0;
		out.push({
			id: "usdkrw",
			label: "원/달러",
			value: usd?.price != null ? fmt(usd.price) : null,
			change: usd?.change != null ? `${usd.change > 0 ? "+" : ""}${fmt(usd.change)}` : null,
			changePct: usd?.changePct ?? null,
			source: "Yahoo Finance",
			delay: usd?.delayMinutes ? `지연 ${usd.delayMinutes}분` : "지연 시세",
			reason: !mounted || fx.isLoading ? "수신 중" : "환율 미수신"
		});
		return out;
	}, [
		indices.data,
		indices.isLoading,
		fx.data,
		fx.isLoading,
		mounted
	]);
	const sourceSession = mounted ? krIndexStatusLabel(indices.data?.indices?.[0]?.marketStatus) : null;
	const session = sourceSession ? {
		label: sourceSession,
		detail: "네이버 지수 marketStatus"
	} : now != null ? {
		...krSessionEstimate(now),
		detail: "KST 시계 기준 추정 · 휴장일 미반영"
	} : null;
	const stories = (0, import_react.useMemo)(() => now ? topStories(feed.items, { now }) : [], [feed.items, now]);
	const themes = (0, import_react.useMemo)(() => now ? themeMomentum(feed.items, { now }) : [], [feed.items, now]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				kicker: "KR News Briefing · 한국 증시",
				title: "한국 뉴스 브리핑",
				lead: "네이버 증권 속보·주요뉴스·포커스, 한국경제 RSS, Google 뉴스, KRX·DART 공시를 모아 최신순으로 보여줍니다. 모든 항목은 출처와 원문 링크를 가집니다.",
				aside: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-start gap-1.5 sm:items-end",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[11px] text-muted-foreground",
						children: [
							"기준 ",
							feed.generatedAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
								publishedAt: feed.generatedAt,
								precision: "second"
							}) : "—",
							session ? ` · ${session.label}${"estimated" in session ? " (추정)" : ""}` : ""
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceHealthChip, { sources: feed.sources })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageDisclaimer, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BriefingDigest, {
				asOf: feed.generatedAt,
				session: session ? {
					label: session.label,
					estimated: "estimated" in session,
					detail: session.detail
				} : null,
				tiles,
				topStories: stories,
				themes,
				extra: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NaverAiBriefingCard, {}),
				aiSlot: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AiBriefingPanel, {
					items: feedToAiItems(feed.items),
					context: "한국 증시 뉴스"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewsDesk, {
				items: feed.items,
				sources: feed.sources,
				loading: feed.isLoading,
				hasMore: Boolean(feed.hasNextPage),
				loadingMore: feed.isFetchingNextPage,
				onLoadMore: () => void feed.fetchNextPage(),
				kinds: KINDS
			})
		]
	});
}
//#endregion
export { KrNewsPage as component };
