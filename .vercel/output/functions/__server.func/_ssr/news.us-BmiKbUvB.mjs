import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as formatAbsoluteTime, s as parseSourceTime } from "./time-By5ScNNo.mjs";
import { It as useAppStore, J as SourceHealthChip, K as usSessionEstimate, Pt as cn, et as TimeStamp, ft as useUsCalendar, lt as useFeed, q as NewsDesk, tt as useNow, ut as useMarketSnapshot } from "./router-B1V8nj-n.mjs";
import { t as PageDisclaimer } from "./PageDisclaimer-Dk4wCTj5.mjs";
import { n as themeMomentum, r as topStories, t as BriefingDigest } from "./briefing-5XLfzMfc.mjs";
import { n as AiTranslateButton, r as feedToAiItems, t as AiBriefingPanel } from "./AiBriefingPanel-HuDAM7_1.mjs";
import { t as PageHeader } from "./PageHeader-aQOrmONW.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/news.us-BmiKbUvB.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** KST/ET display toggle for US pages (A3.5 / F3.3), persisted in newsPrefs. */
function TzToggle() {
	const tz = useAppStore((s) => s.newsPrefs.tz);
	const setNewsPrefs = useAppStore((s) => s.setNewsPrefs);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "inline-flex rounded-md border border-border p-0.5",
		role: "group",
		"aria-label": "시간대",
		children: ["KST", "ET"].map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: () => setNewsPrefs({ tz: z }),
			"aria-pressed": tz === z,
			className: cn("min-h-8 rounded px-2 text-[11px] font-semibold", tz === z ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"),
			children: z
		}, z))
	});
}
var KINDS = [
	{
		id: "news",
		label: "뉴스"
	},
	{
		id: "policy",
		label: "정책"
	},
	{
		id: "rating",
		label: "등급"
	},
	{
		id: "filing",
		label: "SEC 공시"
	}
];
function fmt(n, digits = 2) {
	return n.toLocaleString("en-US", {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	});
}
function UsNewsPage() {
	const feed = useFeed({
		region: "US",
		limit: 60
	});
	const [translations, setTranslations] = (0, import_react.useState)({});
	const snap = useMarketSnapshot();
	const cal = useUsCalendar();
	const tz = useAppStore((s) => s.newsPrefs.tz);
	const now = useNow(6e4);
	const mounted = now != null;
	const tiles = (0, import_react.useMemo)(() => (mounted ? snap.data?.rows ?? [] : []).map((r) => ({
		id: r.id,
		label: r.label,
		value: r.price != null ? fmt(r.price, r.id === "btc" ? 0 : 2) : null,
		change: r.change != null ? `${r.change > 0 ? "+" : ""}${fmt(r.change, r.id === "btc" ? 0 : 2)}` : null,
		changePct: r.changePct,
		source: r.source,
		delay: r.delayMinutes ? `지연 ${r.delayMinutes}분` : "지연 시세",
		asOf: r.asOf,
		reason: r.error ? "미수신" : void 0
	})), [snap.data, mounted]);
	const events = (0, import_react.useMemo)(() => {
		if (!cal.data || !mounted) return void 0;
		return cal.data.events.map((e) => {
			const t = parseSourceTime(e.iso, { zone: "America/New_York" });
			return {
				id: e.id,
				when: `${formatAbsoluteTime({
					publishedAt: t.iso,
					precision: t.precision
				}).replace(" (날짜만 제공)", "")}${e.timeLabel ? ` ${e.timeLabel} ET` : ""}`,
				title: e.title,
				source: e.sourceName,
				url: e.url
			};
		});
	}, [cal.data]);
	const session = now != null ? usSessionEstimate(now) : null;
	const stories = (0, import_react.useMemo)(() => now ? topStories(feed.items, { now }) : [], [feed.items, now]);
	const themes = (0, import_react.useMemo)(() => now ? themeMomentum(feed.items, { now }) : [], [feed.items, now]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				kicker: "US News Briefing · 미국 증시",
				title: "미국 뉴스 브리핑",
				lead: "Bloomberg 공개 RSS 헤드라인, 네이버 해외뉴스(Reuters), 연준 보도자료, 월가 공개 등급, Google News를 최신순으로 모았습니다. 유료 매체는 제목과 링크만 표시합니다.",
				aside: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-start gap-1.5 sm:items-end",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [session && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "rounded-md border border-border px-2 py-1 text-[11px] font-semibold",
								title: "뉴욕 시계 기준 추정 · 휴장일 미반영",
								"data-testid": "us-session",
								children: [
									session.label,
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-normal text-muted-foreground",
										children: "(추정)"
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TzToggle, {})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[11px] text-muted-foreground",
							children: ["기준 ", feed.generatedAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
								publishedAt: feed.generatedAt,
								precision: "second",
								tz,
								withEt: true
							}) : "—"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceHealthChip, { sources: feed.sources })
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageDisclaimer, { extra: "미국 시세 타일은 Yahoo Finance 지연 시세입니다." }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BriefingDigest, {
				asOf: feed.generatedAt,
				session: session ? {
					label: session.label,
					estimated: true,
					detail: "뉴욕 시계 기준 · 휴장일 미반영"
				} : null,
				tiles: tiles.length ? tiles : void 0,
				topStories: stories,
				themes,
				events: events ?? [],
				eventsNote: !mounted || cal.isLoading ? "일정 불러오는 중…" : "향후 7일 내 연준·BEA 일정을 받지 못했습니다(소스 미검증일 수 있음).",
				tz,
				aiSlot: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AiBriefingPanel, {
					items: feedToAiItems(feed.items),
					context: "미국 증시 뉴스"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AiTranslateButton, {
					items: feed.items,
					onResult: setTranslations
				})] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewsDesk, {
				items: feed.items,
				sources: feed.sources,
				loading: feed.isLoading,
				hasMore: Boolean(feed.hasNextPage),
				loadingMore: feed.isFetchingNextPage,
				onLoadMore: () => void feed.fetchNextPage(),
				tz,
				withEt: true,
				kinds: KINDS,
				translations
			})
		]
	});
}
//#endregion
export { UsNewsPage as component };
