import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { s as parseSourceTime } from "./time-By5ScNNo.mjs";
import { d as sortReportsNewestFirst } from "./mappers-DlpCqw-E.mjs";
import { r as useQuery, t as useInfiniteQuery } from "../_libs/tanstack__react-query.mjs";
import { $ as FileText, at as ExternalLink, z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { At as getResearchV2Detail, Dt as getResearchBriefing, Lt as usePriceColors, Mt as resolveResearchOriginal, Pt as cn, et as TimeStamp, kt as getResearchV2, yt as formatPrice } from "./router-B1V8nj-n.mjs";
import { n as annotatePrevTargets, u as targetDeltaPct } from "./naver-v2-C8XzGZTP.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ResearchCard-B9UdtEGW.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function httpsOrHttp(url) {
	if (!url) return null;
	try {
		const u = new URL(url);
		return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
	} catch {
		return null;
	}
}
/**
* Call synchronously from a click handler. Returns a promise with the final
* URL and whether a tab was opened.
*/
function openOriginalWithResolver(resolve, opts) {
	const host = opts.host ?? (typeof window !== "undefined" ? window : void 0);
	const w = host ? host.open("about:blank", "_blank") : null;
	if (w?.document) try {
		w.document.title = opts.loadingText ?? "원문 여는 중…";
		if (w.document.body) w.document.body.textContent = opts.loadingText ?? "원문 여는 중…";
	} catch {}
	return (async () => {
		let url = null;
		try {
			url = httpsOrHttp(await resolve());
		} catch {
			url = null;
		}
		const target = url ?? httpsOrHttp(opts.fallbackUrl);
		if (!target) {
			w?.close?.();
			return {
				opened: false,
				url: null
			};
		}
		if (!w) {
			opts.onBlocked?.(target);
			return {
				opened: false,
				url: target
			};
		}
		try {
			w.opener = null;
		} catch {}
		w.location.replace(target);
		return {
			opened: true,
			url: target
		};
	})();
}
/** Known URL: open directly (callers should prefer a real <a> element). */
function openKnownUrl(url, host) {
	const target = httpsOrHttp(url);
	const h = host ?? (typeof window !== "undefined" ? window : void 0);
	if (!target || !h) return false;
	h.open(target, "_blank", "noopener,noreferrer");
	return true;
}
/** Popup blocked → show the resolved link; tapping the action is a fresh user gesture. */
function toastBlockedOriginal(url) {
	toast("팝업이 차단되어 원문을 열지 못했습니다", {
		description: url,
		duration: 12e3,
		action: {
			label: "원문 열기",
			onClick: () => openKnownUrl(url)
		}
	});
}
/**
* Click-handler helper (D2 / F2.6): known URL → open directly; otherwise open a
* blank tab synchronously, resolve, then navigate it. MUST be called
* synchronously from the click event (no `await` before it).
*/
function openOriginal(opts) {
	if (opts.knownUrl) {
		openKnownUrl(opts.knownUrl);
		return Promise.resolve({
			opened: true,
			url: opts.knownUrl
		});
	}
	if (!opts.resolve) {
		openKnownUrl(opts.fallbackUrl);
		return Promise.resolve({
			opened: true,
			url: opts.fallbackUrl
		});
	}
	return openOriginalWithResolver(opts.resolve, {
		fallbackUrl: opts.fallbackUrl,
		onBlocked: toastBlockedOriginal
	});
}
var TAB_TYPES = [
	"company",
	"industry",
	"invest",
	"economy",
	"debenture",
	"market"
];
function dedupeReports(list) {
	const seen = /* @__PURE__ */ new Set();
	return list.filter((r) => {
		const k = `${r.v2Type ?? r.category}:${r.researchId}`;
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
}
/**
* Paged KR research (F2.2/F2.3): one v2 category, or 전체 = every category at
* the same `index`. Newest first via the kernel; Δ% annotated only from
* fetched same-broker/same-ticker reports.
*/
function useResearchList(tab, opts = {}) {
	const codes = opts.itemCodes?.slice(0, 10);
	const q = useInfiniteQuery({
		queryKey: [
			"research-v2",
			tab,
			codes?.join(",") ?? "",
			opts.size ?? 20
		],
		queryFn: async ({ pageParam }) => {
			const types = tab === "all" ? TAB_TYPES : [tab];
			return {
				index: pageParam,
				pages: await Promise.all(types.map((type) => getResearchV2({ data: {
					type,
					index: pageParam,
					size: opts.size ?? 20,
					itemCodes: type === "company" ? codes : void 0
				} })))
			};
		},
		initialPageParam: 0,
		getNextPageParam: (last) => last.pages.some((p) => p.hasNext) ? last.index + 1 : void 0,
		staleTime: 18e4,
		refetchOnWindowFocus: false
	});
	const all = q.data?.pages ?? [];
	const reports = (0, import_react.useMemo)(() => annotatePrevTargets(sortReportsNewestFirst(dedupeReports(all.flatMap((m) => m.pages.flatMap((p) => p.reports))))), [all]);
	const first = all[0]?.pages ?? [];
	const totals = first.map((p) => p.totalCount);
	const totalCount = totals.length && totals.every((t) => t != null) ? totals.reduce((s, t) => s + (t ?? 0), 0) : null;
	const paths = [...new Set(first.map((p) => p.path))];
	const errors = first.map((p) => p.error).filter((e) => Boolean(e));
	return {
		...q,
		reports,
		totalCount,
		paths,
		errors
	};
}
function useResearchBriefing(opts) {
	return useQuery({
		queryKey: ["research-briefing"],
		queryFn: () => getResearchBriefing(),
		staleTime: 6e5,
		refetchOnWindowFocus: false,
		enabled: opts?.enabled ?? true
	});
}
function useResearchDetail(r) {
	const type = r?.v2Type ?? (r?.category === "market" ? "invest" : r?.category);
	return useQuery({
		queryKey: [
			"research-v2-detail",
			type,
			r?.researchId,
			r?.code
		],
		queryFn: () => getResearchV2Detail({ data: {
			type,
			nid: r.researchId,
			itemCode: r?.code && /^[0-9A-Z]{6}$/.test(r.code) ? r.code : void 0
		} }),
		enabled: Boolean(r && type && r.sourceKind !== "hankyung"),
		staleTime: 6e5
	});
}
/**
* F2.6 pre-resolve: for rows that scroll into view (first 12 only), resolve
* the PDF URL in the background with at most 3 concurrent requests.
*/
function usePdfPreResolver(limit = 12, concurrency = 3) {
	const [resolved, setResolved] = (0, import_react.useState)(() => /* @__PURE__ */ new Map());
	const queue = (0, import_react.useRef)([]);
	const active = (0, import_react.useRef)(0);
	const seen = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const observed = (0, import_react.useRef)(0);
	const pump = (0, import_react.useCallback)(() => {
		while (active.current < concurrency && queue.current.length) {
			const job = queue.current.shift();
			active.current += 1;
			resolveResearchOriginal({ data: {
				type: job.type,
				nid: job.nid
			} }).then((r) => setResolved((m) => new Map(m).set(job.key, r.pdfUrl))).catch(() => setResolved((m) => new Map(m).set(job.key, null))).finally(() => {
				active.current -= 1;
				pump();
			});
		}
	}, [concurrency]);
	const observe = (0, import_react.useCallback)((el, r) => {
		if (!el || typeof IntersectionObserver === "undefined") return;
		const key = `${r.v2Type ?? r.category}:${r.researchId}`;
		if (r.pdfUrl || seen.current.has(key) || observed.current >= limit || r.sourceKind === "hankyung" || !r.v2Type) return;
		observed.current += 1;
		seen.current.add(key);
		const io = new IntersectionObserver((entries) => {
			if (entries.some((e) => e.isIntersecting)) {
				io.disconnect();
				queue.current.push({
					key,
					type: r.v2Type,
					nid: r.researchId
				});
				pump();
			}
		});
		io.observe(el);
	}, [limit, pump]);
	(0, import_react.useEffect)(() => () => void (queue.current = []), []);
	return {
		resolved,
		observe
	};
}
function RatingBadge({ rating }) {
	if (!rating) return null;
	const buy = /매수|비중확대|BUY|OUTPERFORM|OVERWEIGHT/i.test(rating);
	const sell = /매도|비중축소|SELL|UNDERPERFORM|UNDERWEIGHT/i.test(rating);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold", buy && "bg-price-up/15 text-price-up", sell && "bg-price-down/15 text-price-down", !buy && !sell && "bg-amber-500/15 text-amber-400"),
		children: rating
	});
}
var SUMMARY_LABEL = {
	preview: "요약 출처: 증권사 미리보기 발췌",
	detail: "요약 출처: 리서치 본문 발췌",
	"pdf-text": "요약 출처: PDF 텍스트 발췌",
	none: "요약 없음 — 제목만 제공"
};
function reportTime(r) {
	const t = parseSourceTime(r.date, { zone: "Asia/Seoul" });
	return {
		publishedAt: t.iso,
		precision: t.precision
	};
}
/** F2.5 report card: category, broker, date (day), ticker, rating, TP, Δ% (fetched prior only), summary + source, 3 actions. */
function ResearchCard({ report: r, resolvedPdf, onDetail, observeRef }) {
	const colors = usePriceColors();
	const [opening, setOpening] = (0, import_react.useState)(false);
	const t = reportTime(r);
	const pdf = r.pdfUrl && /\.pdf($|\?)/i.test(r.pdfUrl) ? r.pdfUrl : resolvedPdf ?? null;
	const delta = targetDeltaPct(r);
	const openPdf = () => {
		setOpening(true);
		openOriginal({
			knownUrl: null,
			fallbackUrl: r.pageUrl || "https://finance.naver.com/research/",
			resolve: async () => {
				if (!r.v2Type) return r.pdfUrl || r.pageUrl;
				const res = await resolveResearchOriginal({ data: {
					type: r.v2Type,
					nid: r.researchId
				} });
				return res.pdfUrl ?? res.pageUrl;
			}
		}).finally(() => setOpening(false));
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		ref: observeRef,
		className: "overflow-hidden rounded-lg border border-border bg-card",
		"data-research-id": r.researchId,
		"data-published": t.publishedAt ?? "",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => onDetail(r),
			className: "w-full px-3 py-2.5 text-left hover:bg-muted/35",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-1.5 text-[10px]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded border border-border px-1.5 py-0.5 font-medium text-muted-foreground",
							children: r.categoryLabel
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs font-semibold",
							children: r.broker
						}),
						r.nameKo && r.code && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/stock/$ticker",
							params: { ticker: r.code },
							onClick: (e) => e.stopPropagation(),
							className: "font-medium text-primary hover:underline",
							children: r.nameKo
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RatingBadge, { rating: r.rating }),
						r.targetPrice != null && r.targetPrice > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-semibold tabular",
							children: ["TP ", formatPrice(r.targetPrice)]
						}),
						delta != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: cn("font-semibold tabular", delta > 0 ? colors.up : delta < 0 ? colors.down : "text-muted-foreground"),
							title: `같은 증권사 직전 리포트 TP ${formatPrice(r.prevTargetPrice)}`,
							children: [
								delta > 0 ? "▲" : delta < 0 ? "▼" : "―",
								" ",
								Math.abs(delta).toFixed(1),
								"%"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-auto text-muted-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
								publishedAt: t.publishedAt,
								precision: t.precision === "unknown" ? "unknown" : "day"
							})
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 text-[13px] font-semibold leading-snug",
					children: r.title
				}),
				(r.summary || r.preview) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1.5 border-l-2 border-foreground/20 pl-2.5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "line-clamp-3 text-[12px] leading-relaxed text-foreground/90",
						children: r.summary || r.preview
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 text-[9.5px] text-muted-foreground",
					children: SUMMARY_LABEL[r.summarySource ?? (r.preview ? "preview" : "none")]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-1 border-t border-border bg-muted/20 px-2 py-1",
			children: [
				pdf ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: pdf,
					target: "_blank",
					rel: "noopener noreferrer",
					className: "inline-flex min-h-9 items-center gap-1 rounded px-2 text-xs font-semibold text-primary hover:underline",
					"data-action": "pdf",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3.5" }), " PDF 원문"]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: openPdf,
					className: "inline-flex min-h-9 items-center gap-1 rounded px-2 text-xs font-semibold text-primary hover:underline",
					"data-action": "pdf",
					children: [opening ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3.5" }), " PDF 원문"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: r.pageUrl,
					target: "_blank",
					rel: "noopener noreferrer",
					className: "inline-flex min-h-9 items-center gap-1 rounded px-2 text-xs text-muted-foreground hover:text-foreground",
					"data-action": "page",
					children: ["리서치 페이지 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => onDetail(r),
					className: "ml-auto inline-flex min-h-9 items-center rounded px-2 text-xs text-muted-foreground hover:text-foreground",
					children: "상세"
				})
			]
		})]
	});
}
//#endregion
export { usePdfPreResolver as a, useResearchList as c, reportTime as i, ResearchCard as n, useResearchBriefing as o, openOriginal as r, useResearchDetail as s, RatingBadge as t };
