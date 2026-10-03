import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { c as string, s as object } from "../_libs/zod.mjs";
import { a as inferMarket, d as normalizeKrTicker, l as isKrTicker, o as inferSectorId, t as UNIVERSE, u as looksLikeEtf } from "./universe-BLkYDatc.mjs";
import { r as SECTOR_BY_ID } from "./sectors-CSrSXBVT.mjs";
import { n as rankByQuery, r as scoreSearchHit, t as matchesSearchQuery } from "./search-match-BMQS9B1C.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/classify-DLKCwe5y.js
var SEGMENT_LABEL = {
	humanoid: "휴머노이드",
	cobot: "협동로봇",
	industrial: "산업용",
	"logistics-amr": "물류·AMR",
	service: "서비스",
	medical: "의료",
	"components-actuator-reducer": "부품(감속기·액추에이터)",
	"sensors-vision": "센서·비전",
	"software-ai": "SW·AI"
};
var EXPOSURE_LABEL = {
	"pure-play": "순수 로봇",
	significant: "비중 큼",
	indirect: "간접 노출"
};
var ROBOTICS_KR = [
	{
		name: "레인보우로보틱스",
		nameEn: "Rainbow Robotics",
		code: "277810",
		market: "KR",
		segment: "humanoid",
		exposure: "pure-play",
		kind: "seed"
	},
	{
		name: "두산로보틱스",
		nameEn: "Doosan Robotics",
		code: "454910",
		market: "KR",
		segment: "cobot",
		exposure: "pure-play",
		kind: "seed"
	},
	{
		name: "로보티즈",
		nameEn: "Robotis",
		code: "108490",
		market: "KR",
		segment: "components-actuator-reducer",
		exposure: "pure-play",
		kind: "seed"
	},
	{
		name: "로보스타",
		nameEn: "Robostar",
		code: "090360",
		market: "KR",
		segment: "industrial",
		exposure: "pure-play",
		kind: "seed"
	},
	{
		name: "클로봇",
		nameEn: "CLOBOT",
		code: "466100",
		market: "KR",
		segment: "software-ai",
		exposure: "pure-play",
		kind: "seed"
	},
	{
		name: "에스피지",
		nameEn: "SPG",
		code: "058610",
		market: "KR",
		segment: "components-actuator-reducer",
		exposure: "significant",
		kind: "seed"
	},
	{
		name: "유일로보틱스",
		market: "KR",
		segment: "industrial",
		exposure: "pure-play",
		kind: "candidate"
	},
	{
		name: "뉴로메카",
		market: "KR",
		segment: "cobot",
		exposure: "pure-play",
		kind: "candidate"
	},
	{
		name: "티로보틱스",
		market: "KR",
		segment: "logistics-amr",
		exposure: "pure-play",
		kind: "candidate"
	},
	{
		name: "에브리봇",
		market: "KR",
		segment: "service",
		exposure: "pure-play",
		kind: "candidate"
	},
	{
		name: "엔젤로보틱스",
		market: "KR",
		segment: "medical",
		exposure: "pure-play",
		kind: "candidate"
	},
	{
		name: "휴림로봇",
		market: "KR",
		segment: "industrial",
		exposure: "pure-play",
		kind: "candidate"
	},
	{
		name: "하이젠알앤엠",
		market: "KR",
		segment: "components-actuator-reducer",
		exposure: "significant",
		kind: "candidate"
	},
	{
		name: "알에스오토메이션",
		market: "KR",
		segment: "components-actuator-reducer",
		exposure: "significant",
		kind: "candidate"
	},
	{
		name: "삼익THK",
		market: "KR",
		segment: "components-actuator-reducer",
		exposure: "significant",
		kind: "candidate"
	},
	{
		name: "에스비비테크",
		market: "KR",
		segment: "components-actuator-reducer",
		exposure: "significant",
		kind: "candidate"
	},
	{
		name: "현대무벡스",
		market: "KR",
		segment: "logistics-amr",
		exposure: "significant",
		kind: "candidate"
	},
	{
		name: "브이원텍",
		market: "KR",
		segment: "sensors-vision",
		exposure: "significant",
		kind: "candidate"
	},
	{
		name: "삼성전자",
		market: "KR",
		segment: "humanoid",
		exposure: "indirect",
		kind: "exposure"
	},
	{
		name: "LG전자",
		market: "KR",
		segment: "service",
		exposure: "indirect",
		kind: "exposure"
	},
	{
		name: "현대차",
		market: "KR",
		segment: "humanoid",
		exposure: "indirect",
		kind: "exposure"
	},
	{
		name: "현대모비스",
		market: "KR",
		segment: "components-actuator-reducer",
		exposure: "indirect",
		kind: "exposure"
	},
	{
		name: "두산",
		market: "KR",
		segment: "cobot",
		exposure: "indirect",
		kind: "exposure"
	},
	{
		name: "한화",
		market: "KR",
		segment: "industrial",
		exposure: "indirect",
		kind: "exposure"
	}
];
var ROBOTICS_US = [
	{
		name: "Tesla",
		code: "TSLA",
		market: "US",
		segment: "humanoid",
		exposure: "indirect",
		kind: "seed"
	},
	{
		name: "NVIDIA",
		code: "NVDA",
		market: "US",
		segment: "software-ai",
		exposure: "indirect",
		kind: "seed"
	},
	{
		name: "Intuitive Surgical",
		code: "ISRG",
		market: "US",
		segment: "medical",
		exposure: "pure-play",
		kind: "seed"
	},
	{
		name: "Symbotic",
		code: "SYM",
		market: "US",
		segment: "logistics-amr",
		exposure: "pure-play",
		kind: "seed"
	},
	{
		name: "Teradyne",
		code: "TER",
		market: "US",
		segment: "cobot",
		exposure: "significant",
		kind: "seed"
	},
	{
		name: "Rockwell Automation",
		code: "ROK",
		market: "US",
		segment: "industrial",
		exposure: "significant",
		kind: "seed"
	},
	{
		name: "Zebra Technologies",
		code: "ZBRA",
		market: "US",
		segment: "logistics-amr",
		exposure: "significant",
		kind: "seed"
	},
	{
		name: "Cognex",
		code: "CGNX",
		market: "US",
		segment: "sensors-vision",
		exposure: "significant",
		kind: "seed"
	},
	{
		name: "PROCEPT BioRobotics",
		code: "PRCT",
		market: "US",
		segment: "medical",
		exposure: "pure-play",
		kind: "seed"
	},
	{
		name: "Serve Robotics",
		code: "SERV",
		market: "US",
		segment: "service",
		exposure: "pure-play",
		kind: "seed"
	},
	{
		name: "Richtech Robotics",
		code: "RR",
		market: "US",
		segment: "service",
		exposure: "pure-play",
		kind: "seed"
	},
	{
		name: "Knightscope",
		code: "KSCP",
		market: "US",
		segment: "service",
		exposure: "pure-play",
		kind: "seed"
	},
	{
		name: "Fanuc (ADR)",
		code: "FANUY",
		market: "US",
		segment: "industrial",
		exposure: "pure-play",
		kind: "seed"
	},
	{
		name: "Yaskawa (ADR)",
		code: "YASKY",
		market: "US",
		segment: "industrial",
		exposure: "significant",
		kind: "seed"
	},
	{
		name: "ABB (ADR)",
		code: "ABBNY",
		market: "US",
		segment: "industrial",
		exposure: "significant",
		kind: "seed"
	}
];
/** US robot ETF seed (verify via Yahoo at runtime; hide if unresolved). */
var ROBOTICS_US_ETFS = [
	"BOTZ",
	"ROBO",
	"ARKQ",
	"KOID",
	"HUMN",
	"BOTT"
];
/** KR robot/humanoid ETF discovery regex over the live ETF list (F6.6). */
var ROBOT_ETF_NAME_RE = /로봇|휴머노이드|로보틱스|robot|humanoid/i;
var ROBOTICS_US_SYMBOLS = ROBOTICS_US.map((e) => e.code);
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
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
var getSecuritySearch = createServerFn({ method: "GET" }).validator(object({ q: string().min(1).max(80) })).handler(createSsrRpc("1a24cb119da9e6a2541edadee6c36926c6686f6648440daee51b9dd5311a79db"));
var ROBOT_TOPICS = [
	{
		id: "humanoid",
		label: "휴머노이드",
		re: /휴머노이드|humanoid|옵티머스|optimus|figure ai|agility|apptronik|boston dynamics|\b1x\b/i
	},
	{
		id: "industrial",
		label: "산업용",
		re: /산업용\s*로봇|industrial robot|용접\s*로봇|스마트\s*팩토리|factory automation|robot orders/i
	},
	{
		id: "cobot",
		label: "협동로봇",
		re: /협동\s*로봇|cobot|collaborative robot|universal robots/i
	},
	{
		id: "logistics",
		label: "물류·AMR",
		re: /물류\s*로봇|AMR|AGV|자율주행\s*로봇|warehouse robot|logistics robot|mobile robot/i
	},
	{
		id: "surgical",
		label: "의료·수술",
		re: /수술\s*로봇|surgical|의료\s*로봇|웨어러블\s*로봇|exoskeleton|da vinci/i
	},
	{
		id: "components",
		label: "부품",
		re: /감속기|액추에이터|서보|모션\s*제어|reducer|actuator|servo|gripper|그리퍼|센서/i
	},
	{
		id: "funding-ma",
		label: "투자·M&A",
		re: /투자\s*유치|시리즈\s*[A-F]|펀딩|인수|합병|funding|raises|series [a-f]|acquir|merger|valuation|IPO|상장/i
	},
	{
		id: "statistics",
		label: "통계",
		re: /통계|출하|판매량|설치\s*대수|IFR|World Robotics|shipments|installations|orders rose|orders fell/i
	}
];
function robotTopicsOf(text) {
	return ROBOT_TOPICS.filter((t) => t.re.test(text)).map((t) => t.id);
}
var POLICY_STATUS_LABEL = {
	announced: "발표",
	proposed: "입법예고",
	effective: "시행",
	review: "조사/검토",
	other: "기타"
};
var STATUS_RULES = [
	{
		status: "effective",
		re: /시행|발효|effective (date|on|immediately)|takes effect|went into effect|final rule/i
	},
	{
		status: "proposed",
		re: /입법\s*예고|법안\s*발의|개정안\s*(발의|예고)|proposed rule|notice of proposed|NPRM|bill introduced|introduces bill/i
	},
	{
		status: "review",
		re: /조사|검토|의견\s*수렴|investigation|Section 232|request for (comment|information)|RFI|inquiry|review/i
	},
	{
		status: "announced",
		re: /발표|공개|추진|계획|전략|announce|unveil|executive order|strategy|plan\b/i
	}
];
/**
* Status chips set ONLY from keywords present in the source text (AT-27).
* Returns every status whose keyword appears; `other` when none does.
*/
function policyStatusesOf(text) {
	const hits = STATUS_RULES.filter((r) => r.re.test(text)).map((r) => r.status);
	return hits.length ? hits : ["other"];
}
/** Robot ETF discovery over the live ETF list (AT-24). */
function discoverRobotEtfs(etfs, re) {
	return etfs.filter((e) => re.test(e.nameKo));
}
/** Equal-weight average of 1D % over quotes that exist (null when none). */
function equalWeightChange(values) {
	const xs = values.filter((v) => typeof v === "number" && Number.isFinite(v));
	if (!xs.length) return null;
	return Math.round(xs.reduce((s, v) => s + v, 0) / xs.length * 100) / 100;
}
/** Position of price inside the 52-week range, 0–100 (null when any input is missing). */
function position52w(price, low, high) {
	if (price == null || low == null || high == null || !(high > low) || price <= 0) return null;
	return Math.max(0, Math.min(100, Math.round((price - low) / (high - low) * 100)));
}
var KR_POLICY_RE = /정책|정부|법안|개정안|입법|규제|샌드박스|지원\s*사업|예산|산업통상|산업부|과기정통부|과학기술정보통신부|국회|시행령|고시|국가\s*전략|로드맵|특별법|로봇법/;
var EN_POLICY_RE = /executive order|legislation|\bbill\b|congress|senate|federal register|regulation|regulatory|tariff|section 232|national (robotics )?strategy|department of commerce|white house|policy/i;
/** Policy-relevant robot story (used to pull 로봇신문 items into the policy tab). */
function isRobotPolicyText(text) {
	return KR_POLICY_RE.test(text) || EN_POLICY_RE.test(text);
}
/** `robot:*` topic ids for an item (F6.3 classifier). */
function robotTopicIds(text) {
	return robotTopicsOf(text).map((id) => `robot:${id}`);
}
/** `status:*` topic ids (F6.4 chips) — keyword presence only. */
function policyStatusTopicIds(text) {
	return policyStatusesOf(text).map((s) => `status:${s}`);
}
/** Company name normalization for exact name resolution (spaces, (주)/㈜ removed, upper-case). */
function normalizeCompanyName(name) {
	return name.replace(/\(주\)|㈜|주식회사/g, "").replace(/\s+/g, "").toUpperCase();
}
/**
* Exact-name listing pick from security-search hits (F6.1 candidates):
* same normalized name, not an ETF, 6-char KR code. Never guesses.
*/
function pickExactListing(name, hits) {
	const want = normalizeCompanyName(name);
	return hits.find((h) => !h.isEtf && /^[0-9][0-9A-Z]{5}$/.test(h.code) && normalizeCompanyName(h.nameKo) === want) ?? null;
}
function roboticsKey(market, code) {
	return `${market}:${code.toUpperCase()}`;
}
/** Top gainers / losers among rows with a finite 1D %. */
function topMovers(rows, n = 3) {
	const xs = rows.filter((r) => typeof r.changePct === "number" && Number.isFinite(r.changePct));
	return {
		up: xs.filter((r) => r.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, n),
		down: xs.filter((r) => r.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, n)
	};
}
/** Count items whose publish time falls within the last `hours` (undated excluded). */
function countWithin(items, now, hours) {
	const from = now - hours * 36e5;
	return items.filter((it) => {
		const t = it.publishedAt ? Date.parse(it.publishedAt) : NaN;
		return Number.isFinite(t) && t >= from && t <= now + 36e5;
	}).length;
}
//#endregion
export { topMovers as S, policyStatusTopicIds as _, ROBOTICS_US_ETFS as a, roboticsKey as b, ROBOT_TOPICS as c, createSsrRpc as d, discoverRobotEtfs as f, pickExactListing as g, isRobotPolicyText as h, ROBOTICS_US as i, SEGMENT_LABEL as l, getSecuritySearch as m, POLICY_STATUS_LABEL as n, ROBOTICS_US_SYMBOLS as o, equalWeightChange as p, ROBOTICS_KR as r, ROBOT_ETF_NAME_RE as s, EXPOSURE_LABEL as t, countWithin as u, position52w as v, searchListedSecurities as x, robotTopicIds as y };
