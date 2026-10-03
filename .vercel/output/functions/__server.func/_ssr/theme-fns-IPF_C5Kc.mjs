import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
import { c as string, n as _enum, r as array, s as object } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/theme-fns-IPF_C5Kc.js
/**
* Server functions for the theme pages: ETF news snapshot (F5.3) and the
* robotics section (F6). Heavy modules are imported lazily inside handlers.
*/
var KR_CODE = string().regex(/^[0-9][0-9A-Z]{5}$/);
var US_SYMBOL = string().regex(/^[A-Z][A-Z0-9.]{0,9}$/);
var EXPOSURE = _enum([
	"pure-play",
	"significant",
	"indirect"
]);
var CUSTOM = object({
	code: string().max(12),
	name: string().max(60),
	segment: string().max(40).optional(),
	exposure: EXPOSURE.optional()
});
/** Live ETF list snapshot for the ETF news briefing: top trading value + robot/AI ETFs. */
var getEtfNewsSnapshot_createServerFn_handler = createServerRpc({
	id: "8edeb943cde0c1b34fe49b524932218f225241079a3583dc1383904f3c325cf4",
	name: "getEtfNewsSnapshot",
	filename: "src/lib/theme-fns.ts"
}, (opts) => getEtfNewsSnapshot.__executeServer(opts));
var getEtfNewsSnapshot = createServerFn({ method: "GET" }).handler(getEtfNewsSnapshot_createServerFn_handler, async () => {
	const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
	try {
		const [{ fetchAllEtfs }, { buildEtfBriefing, issuerOfEtfName }] = await Promise.all([import("./etf-market-S8CEBu8d.mjs"), import("./etf-news-D8YKQLOx.mjs").then((n) => n.l)]);
		const list = await fetchAllEtfs();
		const b = buildEtfBriefing([], list, Date.now());
		const pick = (e) => ({
			code: e.code,
			name: e.nameKo,
			price: e.price > 0 ? e.price : null,
			changePct: Number.isFinite(e.changePct) ? e.changePct : null,
			volume: e.volume > 0 ? e.volume : null,
			amount: e.amount > 0 ? e.amount : null,
			marketSum: e.marketSum > 0 ? e.marketSum : null,
			issuer: e.issuer ?? issuerOfEtfName(e.nameKo)
		});
		return {
			topTrading: b.topTrading.map(pick),
			robotAi: b.robotAi.map(pick),
			total: list.length,
			error: null,
			fetchedAt
		};
	} catch (err) {
		return {
			topTrading: [],
			robotAi: [],
			total: 0,
			error: err instanceof Error ? err.message.slice(0, 120) : "error",
			fetchedAt
		};
	}
});
var getRoboticsUniverse_createServerFn_handler = createServerRpc({
	id: "c84ef0d1dd1d1c95da6f5e1ef7d40615a045360134945b9e8ca2a673a9268670",
	name: "getRoboticsUniverse",
	filename: "src/lib/theme-fns.ts"
}, (opts) => getRoboticsUniverse.__executeServer(opts));
var getRoboticsUniverse = createServerFn({ method: "GET" }).validator(object({
	addedKr: array(CUSTOM).max(30).optional(),
	addedUs: array(CUSTOM).max(30).optional()
})).handler(getRoboticsUniverse_createServerFn_handler, async ({ data }) => {
	const { resolveRoboticsUniverse } = await import("./robotics-B6CXjHtc.mjs");
	return resolveRoboticsUniverse({
		addedKr: data.addedKr?.filter((c) => KR_CODE.safeParse(c.code).success),
		addedUs: data.addedUs?.filter((c) => US_SYMBOL.safeParse(c.code.toUpperCase()).success)
	});
});
var getRoboticsEtfs_createServerFn_handler = createServerRpc({
	id: "65a7c373b2d4d90c28856afd36b8930f7b85a170a1c15267a124f76e9f90e81f",
	name: "getRoboticsEtfs",
	filename: "src/lib/theme-fns.ts"
}, (opts) => getRoboticsEtfs.__executeServer(opts));
var getRoboticsEtfs = createServerFn({ method: "GET" }).handler(getRoboticsEtfs_createServerFn_handler, async () => {
	const { fetchRoboticsEtfs } = await import("./robotics-B6CXjHtc.mjs");
	return fetchRoboticsEtfs();
});
var getRoboticsResearch_createServerFn_handler = createServerRpc({
	id: "26dcbaae5ed7a4acefef1b802358db4e87f87c72cdbf59368fe8fc383af5b344",
	name: "getRoboticsResearch",
	filename: "src/lib/theme-fns.ts"
}, (opts) => getRoboticsResearch.__executeServer(opts));
var getRoboticsResearch = createServerFn({ method: "GET" }).validator(object({
	krCodes: array(KR_CODE).max(40),
	usSymbols: array(US_SYMBOL).max(24)
})).handler(getRoboticsResearch_createServerFn_handler, async ({ data }) => {
	const { fetchRoboticsResearch, fetchRoboticsStreet } = await import("./robotics-B6CXjHtc.mjs");
	const [kr, street] = await Promise.all([fetchRoboticsResearch(data.krCodes), fetchRoboticsStreet(data.usSymbols).catch(() => ({
		notes: [],
		headlines: [],
		note: "월가 공개 피드를 받지 못했습니다.",
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	}))]);
	return {
		kr,
		street
	};
});
var getRoboticsCompanyMeta_createServerFn_handler = createServerRpc({
	id: "8c0b0c0b7249d2f00ab876529f15ef26b58bb7272970c9a3348657ec1ef1fb2b",
	name: "getRoboticsCompanyMeta",
	filename: "src/lib/theme-fns.ts"
}, (opts) => getRoboticsCompanyMeta.__executeServer(opts));
var getRoboticsCompanyMeta = createServerFn({ method: "GET" }).validator(object({
	krCodes: array(KR_CODE).max(40),
	usSymbols: array(US_SYMBOL).max(24)
})).handler(getRoboticsCompanyMeta_createServerFn_handler, async ({ data }) => {
	const { fetchRoboticsCompanyMeta } = await import("./robotics-B6CXjHtc.mjs");
	return fetchRoboticsCompanyMeta(data.krCodes, data.usSymbols);
});
var getRoboticsCompanyNews_createServerFn_handler = createServerRpc({
	id: "c7d88cb8304622d6e918e0646b566102473708ebf19bb6e525e86ceb9972c61d",
	name: "getRoboticsCompanyNews",
	filename: "src/lib/theme-fns.ts"
}, (opts) => getRoboticsCompanyNews.__executeServer(opts));
var getRoboticsCompanyNews = createServerFn({ method: "GET" }).validator(object({
	market: _enum(["KR", "US"]),
	code: string().min(1).max(12),
	name: string().min(1).max(60)
})).handler(getRoboticsCompanyNews_createServerFn_handler, async ({ data }) => {
	if (!(data.market === "KR" ? KR_CODE.safeParse(data.code).success : US_SYMBOL.safeParse(data.code).success)) return {
		items: [],
		source: "",
		error: "invalid code",
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	const { fetchRoboticsCompanyNews } = await import("./robotics-B6CXjHtc.mjs");
	return fetchRoboticsCompanyNews(data.market, data.code, data.name);
});
//#endregion
export { getEtfNewsSnapshot_createServerFn_handler, getRoboticsCompanyMeta_createServerFn_handler, getRoboticsCompanyNews_createServerFn_handler, getRoboticsEtfs_createServerFn_handler, getRoboticsResearch_createServerFn_handler, getRoboticsUniverse_createServerFn_handler };
