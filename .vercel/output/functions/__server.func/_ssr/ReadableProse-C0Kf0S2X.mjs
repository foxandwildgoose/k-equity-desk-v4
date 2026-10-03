import { o as __toESM } from "../_runtime.mjs";
import { r as toReadableDoc } from "./readable-text-D28LomX7.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { dt as ChevronUp, pt as ChevronDown } from "../_libs/lucide-react.mjs";
import { Pt as cn } from "./router-B1V8nj-n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ReadableProse-C0Kf0S2X.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Reader-first long-form block for market copy (ETF blurbs, research, notes).
* Always strips HTML — never injects raw markup.
*/
function ReadableProse({ raw, doc: docProp, title, className, collapsedParagraphs = 2, showBullets = true, density = "comfortable" }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const doc = docProp ?? toReadableDoc(raw);
	if (!doc.plain && doc.bullets.length === 0) return null;
	const paras = open ? doc.paragraphs : doc.paragraphs.slice(0, collapsedParagraphs);
	const canToggle = doc.paragraphs.length > collapsedParagraphs;
	const bodyCls = density === "comfortable" ? "text-base md:text-[1.0625rem] leading-[1.8]" : "text-sm md:text-[0.95rem] leading-[1.65]";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: cn("rounded-xl border border-border bg-card/80 p-5 md:p-6 space-y-4", className),
		children: [
			(title || canToggle) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-3",
				children: [title ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-lg font-semibold tracking-tight text-balance",
					children: title
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}), canToggle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setOpen((v) => !v),
					className: "inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline min-h-11",
					children: open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["접기 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-4" })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["전체 보기 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4" })] })
				})]
			}),
			showBullets && doc.bullets.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "grid gap-2 sm:grid-cols-2",
				children: doc.bullets.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-[0.95rem] leading-snug text-foreground/95",
					children: b
				}, b))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("space-y-4 text-pretty text-foreground/95", bodyCls),
				children: paras.map((para, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: para }, i))
			}),
			!open && canToggle && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted-foreground",
				children: [
					"…외 ",
					doc.paragraphs.length - collapsedParagraphs,
					"개 단락 · 전체 보기로 펼치기"
				]
			})
		]
	});
}
//#endregion
export { ReadableProse as t };
