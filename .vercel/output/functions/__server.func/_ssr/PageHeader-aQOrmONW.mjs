import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { Pt as cn } from "./router-B1V8nj-n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/PageHeader-aQOrmONW.js
var import_jsx_runtime = require_jsx_runtime();
function PageHeader({ kicker, title, lead, aside, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: cn("page-header flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [
				kicker ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "desk-kicker mb-1.5",
					children: kicker
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "page-title",
					children: title
				}),
				lead ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "page-lead",
					children: lead
				}) : null
			]
		}), aside ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "shrink-0 sm:text-right",
			children: aside
		}) : null]
	});
}
//#endregion
export { PageHeader as t };
