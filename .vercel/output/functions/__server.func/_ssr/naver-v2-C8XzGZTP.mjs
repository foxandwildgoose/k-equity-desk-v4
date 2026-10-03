import { r as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { a as stripHtml, t as canonicalizeUrl } from "./text-2P-t067w.mjs";
import { s as parseSourceTime } from "./time-By5ScNNo.mjs";
import { t as compareNewestFirst } from "./mappers-DlpCqw-E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/naver-v2-C8XzGZTP.js
var naver_v2_C8XzGZTP_exports = /* @__PURE__ */ __exportAll({
	a: () => parseGoalPriceSets,
	c: () => researchPageUrl,
	i: () => naver_v2_exports,
	l: () => sortV2NewestFirst,
	n: () => annotatePrevTargets,
	o: () => parseV2Detail,
	r: () => legacyCategory,
	s: () => parseV2List,
	t: () => V2_LABEL,
	u: () => targetDeltaPct
});
/**
* stock.naver.com research v2 (unofficial). Documented by the
* dd3ok/naverstock-api-skill catalog (47a4274): list response
* `{ hasNext, totalCount, items[] }`, id `nid`, 0-based `index`, types
* market|company|industry|invest|economy|debenture, detail `/{type}/{id}`,
* `detail-page` prev/next, `goal-price-changed` → `researchSets`,
* `weekly-hot`. Per-item field names beyond `nid`/`title` are NOT documented,
* so mappers accept several candidates (status: unverified). Pure module.
*/
var naver_v2_exports = /* @__PURE__ */ __exportAll$1({
	V2_LABEL: () => V2_LABEL,
	annotatePrevTargets: () => annotatePrevTargets,
	isNewCoverage: () => isNewCoverage,
	legacyCategory: () => legacyCategory,
	mapV2ResearchRow: () => mapV2ResearchRow,
	normalizeRatingText: () => normalizeRatingText,
	parseGoalPriceSets: () => parseGoalPriceSets,
	parseV2Detail: () => parseV2Detail,
	parseV2List: () => parseV2List,
	researchPageUrl: () => researchPageUrl,
	sortV2NewestFirst: () => sortV2NewestFirst,
	targetDeltaPct: () => targetDeltaPct
});
var V2_LABEL = {
	company: "기업",
	industry: "산업",
	invest: "시황/전략",
	economy: "경제",
	debenture: "채권",
	market: "데일리"
};
/** finance.naver.com read pages (existing app pattern; nid shared with v2). */
var PC_READ = {
	company: "company_read.naver",
	industry: "industry_read.naver",
	invest: "invest_read.naver",
	economy: "economy_read.naver",
	debenture: "debenture_read.naver",
	market: "market_info_read.naver"
};
function researchPageUrl(type, nid) {
	return `https://finance.naver.com/research/${PC_READ[type]}?nid=${nid}`;
}
/** Map a v2 type onto the legacy `ResearchCategory` used by older consumers. */
function legacyCategory(type) {
	if (type === "company" || type === "industry" || type === "economy") return type;
	if (type === "debenture") return "economy";
	return "market";
}
var isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
function pick(row, keys) {
	for (const k of keys) {
		const v = row[k];
		if (v != null && v !== "") return v;
	}
}
function num(v) {
	if (typeof v === "number" && Number.isFinite(v)) return v;
	if (typeof v === "string") {
		const n = Number(v.replace(/[^\d.-]/g, ""));
		return v.replace(/[^\d]/g, "").length && Number.isFinite(n) ? n : void 0;
	}
}
var RATING_MAP = [
	[/strong\s*buy|적극\s*매수/i, "적극매수"],
	[/^buy$|매수|outperform|overweight|비중\s*확대/i, "매수"],
	[/hold|neutral|중립|marketperform|보유/i, "중립"],
	[/sell|매도|underperform|underweight|비중\s*축소/i, "매도"],
	[/not\s*rated|nr|의견\s*없음/i, "Not Rated"]
];
function normalizeRatingText(raw) {
	const s = stripHtml(raw);
	if (!s) return void 0;
	for (const [re, label] of RATING_MAP) if (re.test(s)) return label;
	return s.length <= 12 ? s : void 0;
}
function mapV2ResearchRow(row, type) {
	if (!isObj(row)) return null;
	const item = isObj(row.item) ? row.item : isObj(row.stock) ? row.stock : null;
	const nid = num(pick(row, [
		"nid",
		"researchId",
		"id"
	]));
	const title = stripHtml(pick(row, [
		"title",
		"researchTitle",
		"subject"
	]));
	if (!nid || !title) return null;
	const date = String(pick(row, [
		"writeDate",
		"publishDate",
		"registeredAt",
		"createdAt",
		"date",
		"writeDateTime",
		"researchDate"
	]) ?? "").trim();
	const t = parseSourceTime(date, { zone: "Asia/Seoul" });
	const itemCode = String(pick(row, [
		"itemCode",
		"stockCode",
		"code"
	]) ?? (item ? pick(item, ["itemCode", "code"]) : "") ?? "").trim().toUpperCase();
	const pdf = canonicalizeUrl(pick(row, [
		"attachUrl",
		"pdfUrl",
		"attachFileUrl",
		"fileUrl",
		"attachmentUrl"
	]));
	return {
		nid,
		type,
		title,
		broker: stripHtml(pick(row, [
			"brokerName",
			"broker",
			"securitiesCompanyName",
			"officeName",
			"brokerageName"
		])) || "증권사 미상",
		date,
		publishedAt: t.iso,
		precision: t.precision,
		itemCode: /^[0-9A-Z]{6}$/.test(itemCode) ? itemCode : void 0,
		itemName: stripHtml(pick(row, [
			"itemName",
			"stockName",
			"name"
		]) ?? (item ? pick(item, ["itemName", "name"]) : "")) || void 0,
		preview: stripHtml(pick(row, [
			"previewContent",
			"summary",
			"preview",
			"content",
			"researchSummary"
		])) || void 0,
		rating: normalizeRatingText(pick(row, [
			"opinion",
			"investmentOpinion",
			"rating",
			"recommend",
			"recommendation"
		])),
		targetPrice: num(pick(row, [
			"goalPrice",
			"targetPrice",
			"targetStockPrice",
			"priceTarget"
		])),
		pdfUrl: pdf && /\.pdf($|\?)/i.test(pdf) ? pdf : void 0,
		readCount: num(pick(row, [
			"readCount",
			"viewCount",
			"hit"
		])),
		industry: stripHtml(pick(row, [
			"industryName",
			"industry",
			"industryType",
			"upjongName"
		])) || void 0,
		pageUrl: researchPageUrl(type, nid)
	};
}
/** `{ hasNext, totalCount, items[] }` → rows sorted newest first (nid desc tie-break). */
function parseV2List(payload, type) {
	const p = isObj(payload) ? payload : {};
	const items = (Array.isArray(p.items) ? p.items : Array.isArray(payload) ? payload : []).map((r) => mapV2ResearchRow(r, type)).filter((x) => x != null);
	const totalCount = num(p.totalCount) ?? null;
	return {
		items: sortV2NewestFirst(items),
		totalCount,
		hasNext: Boolean(p.hasNext)
	};
}
function sortV2NewestFirst(rows) {
	return [...rows].sort((a, b) => compareNewestFirst({
		id: `${a.type}:${a.nid}`,
		publishedAt: a.publishedAt,
		precision: a.precision,
		seq: a.nid,
		sourceTier: 3
	}, {
		id: `${b.type}:${b.nid}`,
		publishedAt: b.publishedAt,
		precision: b.precision,
		seq: b.nid,
		sourceTier: 3
	}));
}
/** Detail (`/{type}/{id}`) and detail-page (`researchContent` + `researchSummaries.prev/next`). */
function parseV2Detail(payload, type) {
	const p = isObj(payload) ? payload : {};
	const content = isObj(p.researchContent) ? p.researchContent : isObj(p.research) ? p.research : p;
	const row = mapV2ResearchRow(content, type);
	const text = stripHtml(pick(content, [
		"content",
		"researchContent",
		"body",
		"detail",
		"previewContent"
	]) ?? "");
	const sums = isObj(p.researchSummaries) ? p.researchSummaries : {};
	return {
		row,
		text,
		prev: mapV2ResearchRow(sums.prev, type),
		next: mapV2ResearchRow(sums.next, type)
	};
}
/**
* `goal-price-changed` → rows. Accepts either flat sets (current + previous
* price fields) or nested lists of the broker's two latest reports.
*/
function parseGoalPriceSets(payload, direction) {
	const p = isObj(payload) ? payload : {};
	const sets = Array.isArray(p.researchSets) ? p.researchSets : Array.isArray(payload) ? payload : [];
	const out = [];
	for (const set of sets) {
		if (!isObj(set)) continue;
		const nested = pick(set, [
			"researches",
			"items",
			"reports",
			"researchList"
		]);
		let cur = set;
		let prevPrice = num(pick(set, [
			"beforeGoalPrice",
			"previousGoalPrice",
			"preGoalPrice",
			"prevGoalPrice",
			"lastGoalPrice",
			"beforeTargetPrice"
		]));
		if (Array.isArray(nested) && nested.length && isObj(nested[0])) {
			cur = {
				...set,
				...nested[0]
			};
			const older = nested[1];
			if (prevPrice == null && isObj(older)) {
				if (String(pick(older, ["brokerName", "broker"]) ?? "") === String(pick(cur, ["brokerName", "broker"]) ?? "")) prevPrice = num(pick(older, ["goalPrice", "targetPrice"]));
			}
		}
		const row = mapV2ResearchRow({
			title: "목표주가 변경",
			...cur
		}, "company");
		const target = num(pick(cur, [
			"goalPrice",
			"targetPrice",
			"afterGoalPrice",
			"currentGoalPrice"
		])) ?? null;
		const prev = prevPrice ?? null;
		const t = parseSourceTime(pick(cur, [
			"writeDate",
			"publishDate",
			"date",
			"registeredAt"
		]), { zone: "Asia/Seoul" });
		const itemCode = String(pick(cur, [
			"itemCode",
			"stockCode",
			"code"
		]) ?? "").toUpperCase();
		out.push({
			nid: row?.nid ?? null,
			itemCode: /^[0-9A-Z]{6}$/.test(itemCode) ? itemCode : void 0,
			itemName: stripHtml(pick(cur, [
				"itemName",
				"stockName",
				"name"
			])) || void 0,
			broker: stripHtml(pick(cur, ["brokerName", "broker"])) || "증권사 미상",
			targetPrice: target,
			prevTargetPrice: prev,
			deltaPct: target != null && prev != null && prev > 0 ? Math.round((target - prev) / prev * 1e3) / 10 : null,
			rating: normalizeRatingText(pick(cur, [
				"opinion",
				"investmentOpinion",
				"rating"
			])),
			publishedAt: t.iso,
			precision: t.precision,
			direction,
			pageUrl: row?.nid ? researchPageUrl("company", row.nid) : null
		});
	}
	return out.sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0));
}
/** Heuristic "신규 커버리지" flag from the title (labeled as heuristic in the UI). */
function isNewCoverage(title) {
	return /신규\s*(커버리지|편입|분석)|커버리지\s*개시|첫\s*리포트|Initiat(e|ion|ing)|Initiate coverage|분석\s*개시/i.test(title);
}
/**
* Δ% rule (F2.5): a report gets `prevTargetPrice`/`prevRating` only from an
* OLDER report by the SAME broker on the SAME ticker that was actually fetched.
* `list` must be newest first.
*/
function annotatePrevTargets(list) {
	return list.map((r, i) => {
		const code = r.code ?? r.itemCode;
		if (!code || r.targetPrice == null || r.targetPrice <= 0) return r;
		const prev = list.slice(i + 1).find((o) => (o.code ?? o.itemCode) === code && o.broker === r.broker && o.targetPrice != null && o.targetPrice > 0);
		return prev ? {
			...r,
			prevTargetPrice: prev.targetPrice,
			prevRating: prev.rating
		} : r;
	});
}
function targetDeltaPct(r) {
	if (r.targetPrice == null || r.prevTargetPrice == null || r.prevTargetPrice <= 0) return null;
	return Math.round((r.targetPrice - r.prevTargetPrice) / r.prevTargetPrice * 1e3) / 10;
}
//#endregion
export { parseGoalPriceSets as a, researchPageUrl as c, naver_v2_C8XzGZTP_exports as i, sortV2NewestFirst as l, annotatePrevTargets as n, parseV2Detail as o, legacyCategory as r, parseV2List as s, V2_LABEL as t, targetDeltaPct as u };
