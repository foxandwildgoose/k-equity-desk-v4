import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { Pt as cn, _ as RISK_DISCLAIMER } from "./router-B1V8nj-n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/PageDisclaimer-Dk4wCTj5.js
var import_jsx_runtime = require_jsx_runtime();
/** A3.6: every new page repeats the not-investment-advice notice. */
function PageDisclaimer({ className, extra }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: cn("text-[11px] leading-relaxed text-muted-foreground", className),
		"data-testid": "risk-disclaimer",
		children: [RISK_DISCLAIMER, extra ? ` ${extra}` : ""]
	});
}
//#endregion
export { PageDisclaimer as t };
