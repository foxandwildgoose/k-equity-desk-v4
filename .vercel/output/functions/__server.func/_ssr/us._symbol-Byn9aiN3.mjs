import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { v as yahooUsSymbol } from "./research-taxonomy-BpoDpMeG.mjs";
import { n as Route } from "./router-B1V8nj-n.mjs";
import { t as TradingChart } from "./TradingChart-BNzBrxV_.mjs";
import { t as UsResearchDesk } from "./UsResearchDesk-Du-FOQ6b.mjs";
import { t as CompanyOfficial } from "./CompanyOfficial-Besnc9ph.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/us._symbol-Byn9aiN3.js
var import_jsx_runtime = require_jsx_runtime();
function UsStockPage() {
	const { symbol } = Route.useParams();
	const ticker = yahooUsSymbol(symbol) ?? symbol.trim().toUpperCase();
	const valid = yahooUsSymbol(ticker) != null || yahooUsSymbol(symbol) != null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "page-header",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] font-semibold uppercase tracking-wide text-desk-teal",
						children: "미국 상장"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-2xl font-semibold tracking-tight",
						children: ticker
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 max-w-2xl text-sm text-muted-foreground",
						children: "Chart, then official SEC filings, then public Wall Street opinion. Opinion is not a filing."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/etfs",
					className: "text-sm text-primary hover:underline",
					children: "ETF 목록"
				})]
			})
		}), valid ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TradingChart, {
				code: ticker,
				market: "US"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanyOfficial, { symbol: ticker }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl border border-desk-slate/40 bg-muted/30 p-3 md:p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold uppercase tracking-wide text-desk-slate",
						children: "OPINION"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-1 text-sm font-semibold",
						children: "Analyst opinion"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-0.5 text-xs text-muted-foreground",
						children: [
							"Public ratings and headlines for ",
							ticker,
							". These are opinions, historically skewed toward Buy, and they are not SEC filings. 월가 공개 의견입니다."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsResearchDesk, { symbol: ticker })
					})
				]
			})
		] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "px-4 py-16 text-center text-sm text-muted-foreground",
			children: [symbol, " 는 미국 티커로 읽지 못했습니다."]
		})]
	});
}
//#endregion
export { UsStockPage as component };
