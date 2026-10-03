import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { d as Star } from "../_libs/lucide-react.mjs";
import { It as useAppStore, Pt as cn, st as Button } from "./router-B1V8nj-n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/WatchButton-BIeRlFFv.js
var import_jsx_runtime = require_jsx_runtime();
function WatchButton({ code, size = "icon-sm", className }) {
	const watched = useAppStore((s) => s.watchlist.includes(code));
	const toggle = useAppStore((s) => s.toggleWatchlist);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
		type: "button",
		variant: "ghost",
		size,
		className: cn(className),
		onClick: (e) => {
			e.preventDefault();
			e.stopPropagation();
			toggle(code);
		},
		"aria-label": watched ? "관심종목 제거" : "관심종목 추가",
		title: watched ? "관심종목 제거" : "관심종목 추가",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: cn("size-3.5", watched ? "fill-amber-400 text-amber-400" : "text-muted-foreground") })
	});
}
//#endregion
export { WatchButton as t };
