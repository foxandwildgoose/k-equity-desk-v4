import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
import { c as string, s as object } from "../_libs/zod.mjs";
import { a as inferMarket, d as normalizeKrTicker, l as isKrTicker, o as inferSectorId, t as UNIVERSE, u as looksLikeEtf } from "./universe-BLkYDatc.mjs";
import { r as SECTOR_BY_ID } from "./sectors-CSrSXBVT.mjs";
import { n as rankByQuery, r as scoreSearchHit, t as matchesSearchQuery } from "./search-match-BMQS9B1C.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/security-search-BkEQTMpJ.js
var UA = "Mozilla/5.0 KoreaEquityCommand/1.0";
async function naverAutoComplete(query) {
	const url = `https://m.stock.naver.com/front-api/search/autoComplete?query=${encodeURIComponent(query)}&target=stock`;
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 8e3);
	try {
		const res = await fetch(url, {
			headers: {
				"User-Agent": UA,
				Accept: "application/json",
				Referer: "https://m.stock.naver.com/"
			},
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const j = await res.json();
		const out = [];
		for (const it of j.result?.items ?? []) {
			if (it.nationCode && it.nationCode !== "KOR") continue;
			const code = normalizeKrTicker(String(it.code ?? ""));
			if (!isKrTicker(code)) continue;
			const nameKo = String(it.name ?? "").trim();
			if (!nameKo) continue;
			const isEtf = Boolean(it.isEtf) || looksLikeEtf(code, nameKo);
			out.push({
				code,
				nameKo,
				nameEn: nameKo,
				market: inferMarket(it.typeCode, it.typeName),
				sectorId: inferSectorId(nameKo),
				isEtf,
				source: "naver-autocomplete"
			});
		}
		return out;
	} finally {
		clearTimeout(t);
	}
}
function universeHits(query) {
	const hits = UNIVERSE.filter((x) => matchesSearchQuery(query, [
		x.nameKo,
		x.nameEn,
		x.code,
		SECTOR_BY_ID[x.sectorId]?.nameKo,
		SECTOR_BY_ID[x.sectorId]?.nameEn
	]));
	return rankByQuery(hits, query, (x) => ({
		name: x.nameKo,
		code: x.code
	})).map((x) => ({
		code: x.code,
		nameKo: x.nameKo,
		nameEn: x.nameEn,
		market: x.market,
		sectorId: x.sectorId,
		isEtf: false,
		source: "universe"
	}));
}
async function searchListedSecurities(query) {
	const q = query.trim();
	if (q.length < 1) return [];
	const local = universeHits(q);
	const remote = await naverAutoComplete(q).catch(() => []);
	const byCode = /* @__PURE__ */ new Map();
	for (const h of local) byCode.set(h.code, h);
	for (const h of remote) {
		const prev = byCode.get(h.code);
		byCode.set(h.code, {
			...h,
			sectorId: prev?.sectorId ?? h.sectorId,
			nameEn: prev?.nameEn && prev.nameEn !== prev.nameKo ? prev.nameEn : h.nameEn,
			isEtf: h.isEtf || prev?.isEtf || looksLikeEtf(h.code, h.nameKo)
		});
	}
	const typed = normalizeKrTicker(q);
	if (isKrTicker(typed) && !byCode.has(typed)) byCode.set(typed, {
		code: typed,
		nameKo: typed,
		nameEn: typed,
		market: "KOSPI",
		sectorId: inferSectorId(typed),
		isEtf: looksLikeEtf(typed),
		source: "universe"
	});
	return [...byCode.values()].sort((a, b) => scoreSearchHit(q, b.nameKo, b.code) - scoreSearchHit(q, a.nameKo, a.code)).slice(0, 24);
}
var getSecuritySearch_createServerFn_handler = createServerRpc({
	id: "1a24cb119da9e6a2541edadee6c36926c6686f6648440daee51b9dd5311a79db",
	name: "getSecuritySearch",
	filename: "src/server/security-search.ts"
}, (opts) => getSecuritySearch.__executeServer(opts));
var getSecuritySearch = createServerFn({ method: "GET" }).validator(object({ q: string().min(1).max(80) })).handler(getSecuritySearch_createServerFn_handler, async ({ data }) => {
	const hits = await searchListedSecurities(data.q);
	return {
		q: data.q,
		hits,
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
		source: "Naver stock autocomplete + desk universe"
	};
});
//#endregion
export { getSecuritySearch_createServerFn_handler };
