import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { Pt as cn } from "./router-B1V8nj-n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/badge-CgqpWL27.js
var import_jsx_runtime = require_jsx_runtime();
var badgeVariants = cva("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors", {
	variants: { variant: {
		default: "border-transparent bg-primary text-primary-foreground",
		secondary: "border-transparent bg-secondary text-secondary-foreground",
		outline: "border-border text-muted-foreground",
		news: "border-transparent bg-signal-news/15 text-signal-news",
		disclosure: "border-transparent bg-signal-disclosure/15 text-signal-disclosure",
		social: "border-transparent bg-signal-social/15 text-signal-social",
		market: "border-border bg-muted/50 text-muted-foreground"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
//#endregion
export { Badge as t };
