import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { M as useUsOfficialPolicy, j as useUsOfficialCompany } from "./router-B1V8nj-n.mjs";
import { m as kindPolicyTag, n as RESEARCH_DISCLAIMER, r as RESEARCH_DISCLAIMER_KO, x as policyTagsForSic } from "./us-official-parse-DdEnQc7w.mjs";
import { i as useSavedReports, n as OfficialReportCard } from "./saved-reports-hooLJGV6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/CompanyOfficial-Besnc9ph.js
var import_jsx_runtime = require_jsx_runtime();
function CompanyOfficial({ symbol }) {
	const ticker = symbol.trim().toUpperCase();
	const company = useUsOfficialCompany(ticker);
	const policy = useUsOfficialPolicy();
	const saved = useSavedReports();
	const data = company.data;
	const sic = data?.sic ?? "";
	const tags = new Set(policyTagsForSic(sic));
	const related = (policy.data?.macro ?? []).filter((r) => tags.has(kindPolicyTag(r.kind, r.title))).slice(0, 4);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-3 md:p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold uppercase tracking-wide text-desk-navy",
						children: "FACT · Company research"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "mt-1 text-lg font-semibold tracking-tight",
						children: [data?.name ?? ticker, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-2 text-sm font-normal text-muted-foreground",
							children: ticker
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: [
							"회사 공시 · SEC EDGAR. Titles stay in English.",
							data?.cik ? ` CIK ${data.cik}.` : "",
							sic ? ` SIC: ${sic}.` : ""
						]
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/us-research",
					className: "text-sm text-primary hover:underline",
					children: "Open in Research"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs leading-relaxed text-muted-foreground",
				children: RESEARCH_DISCLAIMER
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: RESEARCH_DISCLAIMER_KO
			}),
			company.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }),
					"Loading SEC submissions for ",
					ticker,
					". Figures are not filled in while this runs."
				]
			}) : null,
			company.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-destructive",
				children: "SEC filings could not be loaded. Nothing was estimated."
			}) : null,
			data?.errors.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: e
			}, e)),
			data && !data.investorWebsite && !data.website ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs text-muted-foreground",
				children: "SEC submissions did not list an https investor-relations site, so no IR button is shown."
			}) : null,
			data?.investorWebsite || data?.website ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-sm",
				children: [data.investorWebsite ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					className: "mr-3 underline",
					href: data.investorWebsite,
					target: "_blank",
					rel: "noopener noreferrer",
					children: "Investor site listed on SEC"
				}) : null, data.website ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					className: "underline",
					href: data.website,
					target: "_blank",
					rel: "noopener noreferrer",
					children: "Company site listed on SEC"
				}) : null]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportGroup, {
				title: "Latest 10-Q and 10-K",
				empty: "No 10-Q or 10-K in the recent SEC feed.",
				reports: filingsOf(data?.filings, ["10-Q", "10-K"]),
				saved
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportGroup, {
				title: "Earnings package",
				empty: "No item 2.02 8-K was in the recent feed.",
				reports: data?.earnings ?? [],
				saved
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportGroup, {
				title: "Other filings",
				empty: "No proxy or other 8-K rows.",
				reports: (data?.filings ?? []).filter((r) => r.kind !== "10-Q" && r.kind !== "10-K"),
				saved
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportGroup, {
				title: "Form 4",
				empty: "No recent Form 4.",
				reports: data?.form4 ?? [],
				saved
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportGroup, {
				title: "13F filed by this CIK",
				empty: "This issuer has no 13F-HR in the recent feed. Holder 13Fs are a different search and are not invented here.",
				reports: data?.holdings ?? [],
				saved
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-semibold",
						children: "Related macro"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: ["Desk map from the SIC text on the SEC submission, not a sentence in the filing.", sic ? ` Tags: ${[...tags].join(", ")}.` : ""]
					}),
					policy.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted-foreground",
						children: "Loading Fed, BEA, and BLS documents…"
					}) : null,
					related.length === 0 && !policy.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted-foreground",
						children: "No matching official macro card was retrieved."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 grid gap-3 lg:grid-cols-2",
						children: related.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OfficialReportCard, {
							report: r,
							compact: true,
							saved: saved.has(r.id),
							onToggleSave: saved.toggle
						}, r.id))
					})
				]
			}),
			data ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-4 text-xs tabular text-muted-foreground",
				children: ["SEC pull ", new Date(data.fetchedAt).toLocaleString("en-US")]
			}) : null
		]
	});
}
function filingsOf(rows, kinds) {
	return (rows ?? []).filter((r) => kinds.includes(r.kind));
}
function ReportGroup({ title, empty, reports, saved }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "text-sm font-semibold",
			children: title
		}), reports.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-sm text-muted-foreground",
			children: empty
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 grid gap-3",
			children: reports.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OfficialReportCard, {
				report: r,
				saved: saved.has(r.id),
				onToggleSave: saved.toggle
			}, r.id))
		})]
	});
}
//#endregion
export { CompanyOfficial as t };
