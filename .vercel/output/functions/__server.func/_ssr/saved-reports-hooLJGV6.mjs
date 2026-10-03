import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { at as ExternalLink, d as Star } from "../_libs/lucide-react.mjs";
import { Pt as cn, st as Button } from "./router-B1V8nj-n.mjs";
import { a as badgeTone, u as formatDay } from "./us-official-parse-DdEnQc7w.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/saved-reports-hooLJGV6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function OriginalLink({ url, label = "View original report", className }) {
	if (!url) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: cn("text-sm text-muted-foreground", className),
		children: "Original link unavailable"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
		asChild: true,
		variant: "default",
		size: "sm",
		className,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
			href: url,
			target: "_blank",
			rel: "noopener noreferrer",
			children: [
				label,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "sr-only",
					children: "opens in a new tab"
				})
			]
		})
	});
}
function OfficialReportCard({ report, saved, onToggleSave, compact = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "flex h-full flex-col rounded-xl border border-border bg-card p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", badgeTone(report.kind)),
						children: [report.badge, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-1 font-normal opacity-80",
							children: report.badgeKo
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted-foreground",
						children: report.sourceClass === "official" ? "FACT" : report.sourceClass
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
						className: "text-xs tabular text-muted-foreground",
						dateTime: report.publishedAt ?? void 0,
						children: formatDay(report.publishedAt)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-2 text-base font-semibold leading-snug tracking-tight",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/us-research/$reportId",
					params: { reportId: report.id },
					className: "hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					children: report.title
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: report.titleKo
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-xs text-muted-foreground",
				children: [
					report.sourceName,
					report.tickers.length ? ` · ${report.tickers.join(", ")}` : "",
					report.sectors.length ? ` · ${report.sectors.join(", ")}` : ""
				]
			}),
			report.summaryLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs text-desk-gold",
				children: report.summaryLabel
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs text-muted-foreground",
				children: "Summary not retrieved."
			}),
			report.bottomLine ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm leading-relaxed",
				children: report.bottomLine
			}) : null,
			report.bullets.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-foreground/90",
				children: (compact ? report.bullets.slice(0, 4) : report.bullets).map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: b }, b))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted-foreground",
				children: "No extract is shown. Open the original document rather than relying on a generated summary."
			}),
			!compact && report.keyFigures.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyFigureTable, { figures: report.keyFigures }) : null,
			!compact && report.whatChanged ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-sm leading-relaxed",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium",
					children: "What changed. "
				}), report.whatChanged]
			}) : null,
			!compact && report.risks.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium uppercase tracking-wide text-muted-foreground",
					children: "Risks in the extract"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-1 list-disc space-y-1 pl-4 text-sm",
					children: report.risks.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: r }, r))
				})]
			}) : null,
			!compact && report.implications ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted-foreground",
				children: report.implications
			}) : null,
			!compact && report.nextWatch ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium",
					children: "Next watch. "
				}), report.nextWatch]
			}) : null,
			!compact && report.notes.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-1 text-xs text-muted-foreground",
				children: report.notes.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: n }, n))
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OriginalLink, {
						url: report.url,
						label: report.badge === "Earnings release" ? "Exhibit 99 원문" : "원문"
					}),
					report.pdfUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OriginalLink, {
						url: report.pdfUrl,
						label: "PDF"
					}) : null,
					report.indexUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OriginalLink, {
						url: report.indexUrl,
						label: "Filing index"
					}) : null,
					onToggleSave ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						variant: saved ? "secondary" : "outline",
						size: "sm",
						onClick: () => onToggleSave(report),
						"aria-pressed": saved,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: saved ? "fill-current" : void 0 }), saved ? "Saved" : "Save"]
					}) : null
				]
			})
		]
	});
}
function KeyFigureTable({ figures }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-3 overflow-x-auto",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full min-w-[36rem] border-collapse text-left text-xs",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("caption", {
					className: "sr-only",
					children: "Key figures from the retrieved source"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-b border-border text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "py-1.5 pr-3 font-medium",
							children: "Metric"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "py-1.5 pr-3 font-medium",
							children: "Period"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "py-1.5 pr-3 font-medium tabular",
							children: "Actual"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "py-1.5 pr-3 font-medium",
							children: "Prior"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "py-1.5 font-medium",
							children: "Source"
						})
					]
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: figures.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-b border-border/70 align-top",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-1.5 pr-3",
							children: f.metric
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-1.5 pr-3",
							children: f.period
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-1.5 pr-3 tabular",
							children: f.actual
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-1.5 pr-3",
							children: f.prior ?? "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-1.5",
							children: f.source
						})
					]
				}, `${f.metric}-${f.period}`)) })
			]
		})
	});
}
var KEY = "kx-us-research-saved-v1";
function useSavedReports() {
	const [items, setItems] = (0, import_react.useState)([]);
	const [ready, setReady] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		try {
			const raw = localStorage.getItem(KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) setItems(parsed.filter((r) => r && typeof r.id === "string"));
			}
		} catch {}
		setReady(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!ready) return;
		try {
			localStorage.setItem(KEY, JSON.stringify(items.slice(0, 40)));
		} catch {}
	}, [items, ready]);
	return {
		items,
		ready,
		has: (0, import_react.useCallback)((id) => items.some((r) => r.id === id), [items]),
		toggle: (0, import_react.useCallback)((report) => {
			setItems((prev) => {
				if (prev.some((r) => r.id === report.id)) return prev.filter((r) => r.id !== report.id);
				return [report, ...prev].slice(0, 40);
			});
		}, [])
	};
}
//#endregion
export { useSavedReports as i, OfficialReportCard as n, OriginalLink as r, KeyFigureTable as t };
