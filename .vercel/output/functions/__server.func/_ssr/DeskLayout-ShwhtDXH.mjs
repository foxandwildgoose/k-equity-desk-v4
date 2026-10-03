import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { Ot as ArrowRight } from "../_libs/lucide-react.mjs";
import { Pt as cn } from "./router-B1V8nj-n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/DeskLayout-ShwhtDXH.js
var import_jsx_runtime = require_jsx_runtime();
function Panel({ title, kicker, hint, href, hrefLabel = "전체", tone, children, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: cn("desk-card p-4 md:p-5 flex flex-col gap-3 min-w-0", tone === "gold" && "desk-card-gold", tone === "teal" && "desk-card-teal", tone === "indigo" && "desk-card-indigo", tone === "navy" && "desk-card-navy", tone === "rose" && "desk-card-rose", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [
					kicker ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "desk-kicker mb-1",
						children: kicker
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "desk-section-title",
						children: title
					}),
					hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground leading-relaxed",
						children: hint
					}) : null
				]
			}), href ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: href,
				className: "shrink-0 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline min-h-9",
				children: [
					hrefLabel,
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-3.5" })
				]
			}) : null]
		}), children]
	});
}
function Toolbar({ children, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("desk-toolbar", className),
		children
	});
}
//#endregion
export { Toolbar as n, Panel as t };
