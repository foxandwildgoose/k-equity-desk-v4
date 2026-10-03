import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as createServerFn } from "./ssr.mjs";
import { c as string, n as _enum, r as array, s as object } from "../_libs/zod.mjs";
import { d as createSsrRpc } from "./classify-DLKCwe5y.mjs";
import { r as useQuery } from "../_libs/tanstack__react-query.mjs";
import { It as useAppStore } from "./router-B1V8nj-n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-themes-BkxRsJtl.js
var import_react = /* @__PURE__ */ __toESM(require_react());
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
var getEtfNewsSnapshot = createServerFn({ method: "GET" }).handler(createSsrRpc("8edeb943cde0c1b34fe49b524932218f225241079a3583dc1383904f3c325cf4"));
var getRoboticsUniverse = createServerFn({ method: "GET" }).validator(object({
	addedKr: array(CUSTOM).max(30).optional(),
	addedUs: array(CUSTOM).max(30).optional()
})).handler(createSsrRpc("c84ef0d1dd1d1c95da6f5e1ef7d40615a045360134945b9e8ca2a673a9268670"));
var getRoboticsEtfs = createServerFn({ method: "GET" }).handler(createSsrRpc("65a7c373b2d4d90c28856afd36b8930f7b85a170a1c15267a124f76e9f90e81f"));
var getRoboticsResearch = createServerFn({ method: "GET" }).validator(object({
	krCodes: array(KR_CODE).max(40),
	usSymbols: array(US_SYMBOL).max(24)
})).handler(createSsrRpc("26dcbaae5ed7a4acefef1b802358db4e87f87c72cdbf59368fe8fc383af5b344"));
var getRoboticsCompanyMeta = createServerFn({ method: "GET" }).validator(object({
	krCodes: array(KR_CODE).max(40),
	usSymbols: array(US_SYMBOL).max(24)
})).handler(createSsrRpc("8c0b0c0b7249d2f00ab876529f15ef26b58bb7272970c9a3348657ec1ef1fb2b"));
var getRoboticsCompanyNews = createServerFn({ method: "GET" }).validator(object({
	market: _enum(["KR", "US"]),
	code: string().min(1).max(12),
	name: string().min(1).max(60)
})).handler(createSsrRpc("c7d88cb8304622d6e918e0646b566102473708ebf19bb6e525e86ceb9972c61d"));
function useEtfNewsSnapshot(opts) {
	return useQuery({
		queryKey: ["etf-news-snapshot"],
		queryFn: () => getEtfNewsSnapshot(),
		staleTime: 6e4,
		refetchInterval: 12e4,
		refetchOnWindowFocus: false,
		enabled: opts?.enabled ?? true
	});
}
/**
* Robotics universe (F6.1): config ∪ user additions, verified server-side;
* user-hidden keys are removed here. Unresolved names come back separately.
*/
function useRoboticsUniverse(opts) {
	const custom = useAppStore((s) => s.roboticsCustom);
	const addedKr = (0, import_react.useMemo)(() => custom.added.filter((e) => e.market === "KR").map(({ code, name, segment, exposure }) => ({
		code,
		name,
		segment,
		exposure
	})), [custom.added]);
	const addedUs = (0, import_react.useMemo)(() => custom.added.filter((e) => e.market === "US").map(({ code, name, segment, exposure }) => ({
		code,
		name,
		segment,
		exposure
	})), [custom.added]);
	const q = useQuery({
		queryKey: [
			"robotics-universe",
			JSON.stringify(addedKr),
			JSON.stringify(addedUs)
		],
		queryFn: () => getRoboticsUniverse({ data: {
			addedKr,
			addedUs
		} }),
		staleTime: 55e3,
		refetchInterval: 9e4,
		refetchOnWindowFocus: false,
		enabled: opts?.enabled ?? true
	});
	const removed = (0, import_react.useMemo)(() => new Set(custom.removed), [custom.removed]);
	const kr = (0, import_react.useMemo)(() => (q.data?.kr ?? []).filter((r) => !removed.has(r.key)), [q.data?.kr, removed]);
	const us = (0, import_react.useMemo)(() => (q.data?.us ?? []).filter((r) => !removed.has(r.key)), [q.data?.us, removed]);
	const hidden = (0, import_react.useMemo)(() => [...q.data?.kr ?? [], ...q.data?.us ?? []].filter((r) => removed.has(r.key)), [q.data, removed]);
	return {
		...q,
		kr,
		us,
		hidden
	};
}
function useRoboticsEtfs(opts) {
	return useQuery({
		queryKey: ["robotics-etfs"],
		queryFn: () => getRoboticsEtfs(),
		staleTime: 6e4,
		refetchInterval: 12e4,
		refetchOnWindowFocus: false,
		enabled: opts?.enabled ?? true
	});
}
function useRoboticsResearch(krCodes, usSymbols, opts) {
	return useQuery({
		queryKey: [
			"robotics-research",
			krCodes.join(","),
			usSymbols.join(",")
		],
		queryFn: () => getRoboticsResearch({ data: {
			krCodes: krCodes.slice(0, 40),
			usSymbols: usSymbols.slice(0, 24)
		} }),
		staleTime: 3e5,
		refetchOnWindowFocus: false,
		enabled: (opts?.enabled ?? true) && krCodes.length + usSymbols.length > 0
	});
}
function useRoboticsCompanyMeta(krCodes, usSymbols, opts) {
	return useQuery({
		queryKey: [
			"robotics-company-meta",
			krCodes.join(","),
			usSymbols.join(",")
		],
		queryFn: () => getRoboticsCompanyMeta({ data: {
			krCodes: krCodes.slice(0, 40),
			usSymbols: usSymbols.slice(0, 24)
		} }),
		staleTime: 6e5,
		refetchOnWindowFocus: false,
		enabled: (opts?.enabled ?? true) && krCodes.length + usSymbols.length > 0
	});
}
function useRoboticsCompanyNews(target) {
	return useQuery({
		queryKey: [
			"robotics-company-news",
			target?.market,
			target?.code
		],
		queryFn: () => getRoboticsCompanyNews({ data: target }),
		staleTime: 3e5,
		refetchOnWindowFocus: false,
		enabled: target != null
	});
}
//#endregion
export { useRoboticsResearch as a, useRoboticsEtfs as i, useRoboticsCompanyMeta as n, useRoboticsUniverse as o, useRoboticsCompanyNews as r, useEtfNewsSnapshot as t };
