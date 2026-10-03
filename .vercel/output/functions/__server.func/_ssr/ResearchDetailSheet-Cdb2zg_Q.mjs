import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { $ as FileText, at as ExternalLink, z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { at as SheetHeader, et as TimeStamp, it as SheetDescription, nt as Sheet, ot as SheetTitle, rt as SheetContent, st as Button, yt as formatPrice } from "./router-B1V8nj-n.mjs";
import { t as buildResearchBullets } from "./research-utils-_RqvZcrM.mjs";
import { u as targetDeltaPct } from "./naver-v2-C8XzGZTP.mjs";
import { i as reportTime, r as openOriginal, s as useResearchDetail, t as RatingBadge } from "./ResearchCard-B9UdtEGW.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ResearchDetailSheet-Cdb2zg_Q.js
var import_jsx_runtime = require_jsx_runtime();
/**
* F2.7 detail sheet: extractive bullets from the source text, rating/TP (Δ only
* from a fetched prior same-broker report), previous/next report for the same
* ticker (detail-page), PDF + research-page links, broker filter.
*/
function ResearchDetailSheet({ report, onClose, onBrokerFilter, onOpenReport }) {
	const detail = useResearchDetail(report);
	const d = detail.data;
	const merged = report ? {
		...report,
		rating: report.rating ?? d?.report?.rating,
		targetPrice: report.targetPrice ?? d?.report?.targetPrice
	} : null;
	const bullets = merged ? buildResearchBullets(d?.bulletsText || merged.preview || merged.summary || "", merged.title) : [];
	const source = d?.summarySource ?? (merged?.preview ? "preview" : "none");
	const pdf = merged?.pdfUrl ?? d?.pdfUrl ?? null;
	const delta = merged ? targetDeltaPct(merged) : null;
	const t = merged ? reportTime(merged) : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!report,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, {
			side: "right",
			className: "w-full max-w-lg overflow-y-auto scroll-thin p-0",
			children: merged && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, {
				className: "sticky top-0 z-10 border-b border-border bg-card",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, {
					className: "pr-6 text-base leading-snug",
					children: merged.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetDescription, {
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2 text-xs",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium text-foreground",
								children: merged.broker
							}),
							t && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
								publishedAt: t.publishedAt,
								precision: t.precision === "unknown" ? "unknown" : "day"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground",
								children: merged.categoryLabel
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RatingBadge, { rating: merged.rating }),
							detail.isFetching && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "inline-flex items-center gap-1 text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3 animate-spin" }), " 상세 조회"]
							})
						]
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4 px-4 py-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							pdf ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								asChild: true,
								size: "sm",
								className: "gap-1.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: pdf,
									target: "_blank",
									rel: "noopener noreferrer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3.5" }), " PDF 원문"]
								})
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								className: "gap-1.5",
								onClick: () => void openOriginal({
									fallbackUrl: d?.pageUrl || merged.pageUrl,
									resolve: async () => (await detail.refetch()).data?.pdfUrl ?? d?.pageUrl ?? merged.pageUrl
								}),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3.5" }), " PDF 원문"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								asChild: true,
								size: "sm",
								variant: "outline",
								className: "gap-1.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: d?.pageUrl || merged.pageUrl,
									target: "_blank",
									rel: "noopener noreferrer",
									children: ["리서치 페이지 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" })]
								})
							}),
							onBrokerFilter && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								variant: "ghost",
								onClick: () => onBrokerFilter(merged.broker),
								children: [merged.broker, "만 보기"]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-lg border border-border bg-muted/25 p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[10px] text-muted-foreground",
									children: "투자의견"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1 min-h-6",
									children: merged.rating ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RatingBadge, { rating: merged.rating }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs text-muted-foreground",
										children: "— (원문에 의견 없음/미추출)"
									})
								}),
								merged.prevRating && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 text-[10px] text-muted-foreground",
									children: ["직전 ", merged.prevRating]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-lg border border-border bg-muted/25 p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[10px] text-muted-foreground",
									children: "목표주가"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1 text-base font-semibold tabular",
									children: merged.targetPrice ? formatPrice(merged.targetPrice) : "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[10px] text-muted-foreground",
									children: delta != null ? `직전 ${formatPrice(merged.prevTargetPrice)} 대비 ${delta > 0 ? "+" : ""}${delta.toFixed(1)}%` : "직전 동일 증권사 리포트 미확인 → Δ 미표시"
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-border bg-muted/20 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-[11px] font-semibold",
								children: "핵심 문장 (원문 발췌)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed",
								children: bullets.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: b }, b))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-[10px] text-muted-foreground",
								children: [source === "detail" ? "리서치 본문에서 발췌" : source === "preview" ? "증권사 미리보기에서 발췌" : "본문을 받지 못해 제목만 표시", " · 전문은 원문에서 확인하세요."]
							})
						]
					}),
					(d?.prev || d?.next) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-border p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-[11px] font-semibold",
							children: "같은 종목의 이전·다음 리포트"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-2 space-y-1.5 text-xs",
							children: [["이전", d?.prev], ["다음", d?.next]].map(([label, r]) => r && typeof r === "object" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "shrink-0 text-muted-foreground",
									children: String(label)
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "min-w-0 text-left hover:underline",
									onClick: () => onOpenReport?.(r),
									children: [
										r.broker,
										" · ",
										r.title
									]
								})]
							}, String(label)) : null)
						})]
					}),
					d?.error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-[11px] text-price-down",
						children: ["상세를 받지 못했습니다: ", d.error]
					})
				]
			})] })
		})
	});
}
//#endregion
export { ResearchDetailSheet as t };
