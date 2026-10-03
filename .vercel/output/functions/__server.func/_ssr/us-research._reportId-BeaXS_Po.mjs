import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { N as useUsOfficialReport, Pt as cn, r as Route$1, st as Button } from "./router-B1V8nj-n.mjs";
import { a as badgeTone, n as RESEARCH_DISCLAIMER, r as RESEARCH_DISCLAIMER_KO, u as formatDay } from "./us-official-parse-DdEnQc7w.mjs";
import { i as useSavedReports, r as OriginalLink, t as KeyFigureTable } from "./saved-reports-hooLJGV6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/us-research._reportId-BeaXS_Po.js
var import_jsx_runtime = require_jsx_runtime();
function ReportDetailPage() {
	const { reportId } = Route$1.useParams();
	const q = useUsOfficialReport(reportId);
	const saved = useSavedReports();
	const report = q.data;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack pb-24 md:pb-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/us-research",
				className: "text-sm text-primary hover:underline",
				children: "Back to Research"
			}),
			q.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "inline-flex items-center gap-2 text-sm text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), "Loading this document from the official source. No summary is shown until it returns."]
			}) : null,
			q.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-destructive",
				children: "The report request failed. Nothing was estimated."
			}) : null,
			!q.isLoading && !report ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "This id was not found in SEC submissions or the cached official pages. Original link unavailable."
			}) : null,
			report ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "rounded-xl border border-border bg-card p-4 md:p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", badgeTone(report.kind)),
								children: [report.badge, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-1 opacity-80",
									children: report.badgeKo
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-muted-foreground",
								children: "FACT"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
								className: "text-xs tabular text-muted-foreground",
								children: formatDay(report.publishedAt)
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-3 text-2xl font-semibold tracking-tight",
						children: report.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: report.titleKo
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm text-muted-foreground",
						children: [
							report.sourceName,
							report.tickers.length ? ` · ${report.tickers.join(", ")}` : "",
							report.sectors.length ? ` · ${report.sectors.join(", ")}` : "",
							report.accession ? ` · Accession ${report.accession}` : ""
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-xs leading-relaxed text-muted-foreground",
						children: RESEARCH_DISCLAIMER
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: RESEARCH_DISCLAIMER_KO
					}),
					report.summaryLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm text-desk-gold",
						children: report.summaryLabel
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm text-muted-foreground",
						children: "Summary not retrieved."
					}),
					report.bottomLine ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-base leading-relaxed",
						children: report.bottomLine
					}) : null,
					report.bullets.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed",
						children: report.bullets.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: b }, b))
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm text-muted-foreground",
						children: "No extract is available. Use the original document."
					}),
					report.keyFigures.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyFigureTable, { figures: report.keyFigures }) : null,
					report.whatChanged ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-4 text-sm leading-relaxed",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: "What changed. "
						}), report.whatChanged]
					}) : null,
					report.risks.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold",
							children: "Risks mentioned in the extract"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-2 list-disc space-y-1 pl-5 text-sm",
							children: report.risks.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: r }, r))
						})]
					}) : null,
					report.implications ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm text-muted-foreground",
						children: report.implications
					}) : null,
					report.nextWatch ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: "Next watch. "
						}), report.nextWatch]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-4 space-y-1 text-xs text-muted-foreground",
						children: report.notes.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: n }, n))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OriginalLink, { url: report.url }),
							report.pdfUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OriginalLink, {
								url: report.pdfUrl,
								label: "PDF"
							}) : null,
							report.indexUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OriginalLink, {
								url: report.indexUrl,
								label: "Filing index"
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: saved.has(report.id) ? "secondary" : "outline",
								size: "sm",
								onClick: () => saved.toggle(report),
								children: saved.has(report.id) ? "Saved" : "Save"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-3 md:hidden",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OriginalLink, {
							url: report.url,
							className: "w-full"
						})
					})
				]
			}) : null
		]
	});
}
//#endregion
export { ReportDetailPage as component };
