import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { at as ExternalLink } from "../_libs/lucide-react.mjs";
import { Pt as cn } from "./router-B1V8nj-n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/SourceLinks-BhZNbLNu.js
var import_jsx_runtime = require_jsx_runtime();
/**
* Always-visible "원문 보기" block for desk briefs, pillars, reports.
* Design intent: every summary/editorial card must offer at least one primary original source.
*/
function SourceLinks({ primaryUrl, primaryLabel = "원문 보기", more = [], searchQuery, className, size = "md" }) {
	const fallback = !primaryUrl && searchQuery ? `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}` : null;
	const main = primaryUrl || fallback;
	if (!main && more.length === 0) return null;
	const text = size === "sm" ? "text-xs" : "text-sm";
	const gap = size === "sm" ? "gap-1.5" : "gap-2";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex flex-col gap-2", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn("flex flex-wrap items-center", gap),
			children: [main && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
				href: main,
				target: "_blank",
				rel: "noopener noreferrer",
				className: cn("inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2.5 py-1.5 font-semibold text-primary hover:bg-primary/25 min-h-9", text),
				children: [primaryUrl ? primaryLabel : "관련 원문 검색", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5 shrink-0" })]
			}), more.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
				href: s.url,
				target: "_blank",
				rel: "noopener noreferrer",
				className: cn("inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-foreground hover:bg-muted/50 min-h-9", text),
				children: [s.label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3 shrink-0 opacity-70" })]
			}, s.url + s.label))]
		}), !primaryUrl && fallback && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[11px] text-muted-foreground",
			children: "1차 공식 링크가 없어 관련 검색으로 연결합니다. 가능하면 공식·증권사 원문을 확인하세요."
		})]
	});
}
//#endregion
export { SourceLinks as t };
