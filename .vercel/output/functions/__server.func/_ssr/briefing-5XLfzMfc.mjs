import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as CLUSTER_STOPWORDS } from "./importance-C2QKgaE9.mjs";
import { t as compareNewestFirst } from "./mappers-DlpCqw-E.mjs";
import { X as Flame, _t as CalendarClock, c as TrendingUp } from "../_libs/lucide-react.mjs";
import { Lt as usePriceColors, Pt as cn, Q as SourceBadge, Z as ImportanceChip, ct as normalizeClusterTitle, et as TimeStamp } from "./router-B1V8nj-n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/briefing-5XLfzMfc.js
var import_jsx_runtime = require_jsx_runtime();
/**
* Deterministic briefing digest (B0.7): as-of + session, snapshot tiles (each
* with source + delay), top stories (≤ 7 clusters / 12 h by importance, with
* reasons and every source link), theme momentum (6 h vs prior 24 h counts),
* upcoming events, optional AI slot. Never generated prose.
*/
function BriefingDigest({ asOf, session, tiles = [], topStories = [], themes = [], events, eventsNote, aiSlot, tz = "KST", extra }) {
	const colors = usePriceColors();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "space-y-3 rounded-xl border border-border bg-card p-3 md:p-4",
		"aria-label": "브리핑",
		"data-testid": "briefing-digest",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					"기준 시각",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold text-foreground",
						children: asOf ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
							publishedAt: asOf,
							precision: "second",
							tz,
							withEt: tz === "ET"
						}) : "—"
					})
				] }), session && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "rounded-md border border-border px-2 py-0.5 font-semibold text-foreground",
					title: session.detail,
					children: [session.label, session.estimated && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-1 font-normal text-muted-foreground",
						children: "(추정)"
					})]
				})]
			}),
			tiles.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
				children: tiles.map((t) => {
					const up = (t.changePct ?? 0) > 0;
					const down = (t.changePct ?? 0) < 0;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 rounded-lg border border-border bg-muted/20 p-2",
						"data-tile": t.id,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-[10px] font-semibold text-muted-foreground",
								children: t.label
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-0.5 truncate text-sm font-semibold tabular",
								children: t.value ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: cn("truncate text-[11px] tabular", up && colors.up, down && colors.down, !up && !down && "text-muted-foreground"),
								children: t.value == null ? t.reason ?? "데이터 없음" : `${t.change ?? ""}${t.changePct != null ? ` (${t.changePct > 0 ? "+" : ""}${t.changePct.toFixed(2)}%)` : ""}`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-0.5 truncate text-[9px] text-muted-foreground",
								title: `${t.source} · ${t.delay}`,
								children: [
									t.source,
									" · ",
									t.delay
								]
							})
						]
					}, t.id);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "mb-1.5 inline-flex items-center gap-1 text-[11px] font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "size-3.5 text-price-up" }), " 주요 뉴스 (최근 12시간 · 중요도순)"]
					}), topStories.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "rounded-md border border-dashed border-border px-3 py-4 text-[11px] text-muted-foreground",
						children: "최근 12시간에 시각이 확인된 기사가 없습니다. 소스가 응답하지 않았거나(소스 상태 참조) 아직 수집 전입니다."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "space-y-1.5",
						children: topStories.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-md border border-border bg-background/40 px-2.5 py-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-foreground/70",
											children: i + 1
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
											publishedAt: s.publishedAt,
											precision: s.precision,
											tz
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceBadge, { item: s }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportanceChip, { item: s })
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: s.url,
									target: "_blank",
									rel: "noopener noreferrer",
									className: "mt-0.5 block text-[12.5px] font-semibold leading-snug hover:underline",
									children: s.title
								}),
								(s.importance?.reasons.length ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1 flex flex-wrap gap-1",
									children: s.importance.reasons.slice(0, 4).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded bg-muted/70 px-1.5 py-0.5 text-[9.5px] text-muted-foreground",
										children: r
									}, r))
								}),
								(s.cluster?.members?.length ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]",
									children: s.cluster.members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
										href: m.url,
										target: "_blank",
										rel: "noopener noreferrer",
										className: "text-primary hover:underline",
										children: m.sourceName
									}, m.id))
								})
							]
						}, s.id))
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "mb-1.5 inline-flex items-center gap-1 text-[11px] font-semibold",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className: "size-3.5 text-desk-teal" }), " 테마 모멘텀 (최근 6시간 vs 이전 24시간)"]
						}), themes.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-muted-foreground",
							children: "6시간 내 2건 이상 반복된 용어가 없습니다."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "space-y-1",
							children: themes.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center justify-between gap-2 text-[11px]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate font-medium",
									children: t.term
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "shrink-0 tabular text-muted-foreground",
									children: [
										"6h ",
										t.recent,
										"건 · 이전 24h ",
										t.prior,
										"건"
									]
								})]
							}, t.term))
						})] }),
						events !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "mb-1.5 inline-flex items-center gap-1 text-[11px] font-semibold",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalendarClock, { className: "size-3.5 text-desk-gold" }), " 예정 일정"]
						}), events.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-muted-foreground",
							children: eventsNote ?? "확인된 일정 소스가 없습니다."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "space-y-1",
							children: events.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "text-[11px]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "tabular text-muted-foreground",
										children: e.when
									}),
									" ",
									e.url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
										href: e.url,
										target: "_blank",
										rel: "noopener noreferrer",
										className: "hover:underline",
										children: e.title
									}) : e.title,
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[10px] text-muted-foreground",
										children: [" · ", e.source]
									})
								]
							}, e.id))
						})] }),
						extra,
						aiSlot
					]
				})]
			})
		]
	});
}
/**
* Deterministic briefing digest helpers (B0.7 "Briefing" definition). Pure.
* No generated text: every entry is a real item or a counted term.
*/
var HOUR = 36e5;
function ms(it) {
	if (!it.publishedAt) return null;
	const t = Date.parse(it.publishedAt);
	return Number.isNaN(t) ? null : t;
}
/**
* Top stories: up to `max` clusters from the last `windowHours`, ranked by
* importance score (desc), then newest first.
*/
function topStories(items, opts = {}) {
	const cutoff = (opts.now ?? Date.now()) - (opts.windowHours ?? 12) * HOUR;
	return items.filter((it) => {
		const t = ms(it);
		return t != null && t >= cutoff && it.precision !== "day" && it.kind !== "research";
	}).sort((a, b) => (b.importance?.score ?? 0) - (a.importance?.score ?? 0) || compareNewestFirst(a, b)).slice(0, opts.max ?? 7);
}
var KO_PARTICLE = /(으로|에서|에게|까지|부터|보다|처럼|이며|이고|했다|한다|하는|되는|된다|은|는|이|가|을|를|의|에|로|와|과|도|만)$/u;
/** Candidate theme terms from a headline (words ≥ 2 chars, particles trimmed). */
function headlineTerms(title) {
	const norm = normalizeClusterTitle(title);
	const out = /* @__PURE__ */ new Set();
	for (const raw of norm.split(" ")) {
		let w = raw.trim();
		if (!w) continue;
		if (/^[가-힣]+$/.test(w) && w.length > 2) w = w.replace(KO_PARTICLE, "");
		if (w.length < 2 || /^\d+$/.test(w)) continue;
		if (CLUSTER_STOPWORDS.has(w)) continue;
		out.add(w);
	}
	return [...out];
}
/**
* Theme momentum: top terms of the last `recentHours` (default 6) vs the prior
* `priorHours` (default 24), with raw counts shown. Terms need ≥ 2 recent hits.
*/
function themeMomentum(items, opts = {}) {
	const now = opts.now ?? Date.now();
	const rh = opts.recentHours ?? 6;
	const ph = opts.priorHours ?? 24;
	const recentStart = now - rh * HOUR;
	const priorStart = recentStart - ph * HOUR;
	const recent = /* @__PURE__ */ new Map();
	const prior = /* @__PURE__ */ new Map();
	for (const it of items) {
		if (it.precision === "day" || it.precision === "unknown") continue;
		const t = ms(it);
		if (t == null || t > now + 3e5 || t < priorStart) continue;
		const bucket = t >= recentStart ? recent : prior;
		for (const term of headlineTerms(it.title)) bucket.set(term, (bucket.get(term) ?? 0) + 1);
	}
	const rows = [];
	for (const [term, r] of recent) {
		if (r < 2) continue;
		const p = prior.get(term) ?? 0;
		rows.push({
			term,
			recent: r,
			prior: p,
			momentum: Math.round((r - p * rh / ph) * 100) / 100
		});
	}
	return rows.sort((a, b) => b.momentum - a.momentum || b.recent - a.recent || (a.term < b.term ? -1 : 1)).slice(0, opts.max ?? 8);
}
//#endregion
export { themeMomentum as n, topStories as r, BriefingDigest as t };
