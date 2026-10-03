import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as PageDisclaimer } from "./PageDisclaimer-Dk4wCTj5.mjs";
import { t as EtfNewsDesk } from "./EtfNewsDesk-DP3MGzB6.mjs";
import { t as PageHeader } from "./PageHeader-aQOrmONW.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/news.etf-CipmcBp6.js
var import_jsx_runtime = require_jsx_runtime();
function EtfNewsPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				kicker: "KR ETF News Briefing · 국내 ETF",
				title: "ETF 뉴스 브리핑",
				lead: "ETF 신규 상장·상장 예정·상장폐지·자금 흐름·퇴직연금 기사를 Google 뉴스(주제·운용사별), 한국경제 증권 RSS(ETF 키워드), 네이버 뉴스 검색에서 모아 최신순으로 보여줍니다. 기사 속 ETF는 실시간 ETF 목록과 이름으로 맞춰 코드·시세를 붙입니다."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageDisclaimer, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EtfNewsDesk, {})
		]
	});
}
//#endregion
export { EtfNewsPage as component };
