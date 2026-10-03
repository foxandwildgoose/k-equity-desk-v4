import { r as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { a as stripHtml, i as stableItemId, n as clampSnippet, t as canonicalizeUrl } from "./text-2P-t067w.mjs";
import { s as parseSourceTime } from "./time-By5ScNNo.mjs";
import { a as topicsFromText, r as outletTier } from "./importance-C2QKgaE9.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/naver-C7W4a0B0.js
var naver_C7W4a0B0_exports = /* @__PURE__ */ __exportAll({
	i: () => naver_exports,
	n: () => mapNaverWorldNews,
	r: () => naverList,
	t: () => mapNaverArticle
});
/**
* Tolerant mappers for stock.naver.com JSON (unofficial, undocumented API).
*
* The dd3ok/naverstock-api-skill catalog (47a4274) documents list keys
* (`articles`, `items`, `researchSets`, `content`, top-level `aid` arrays),
* id fields (`nid`, `aid`, `researchId`) and `datetime` = `YYYYMMDDHHmm`, but
* not every per-item field. Each mapper therefore accepts several candidate
* field names and drops rows without a title or link. Status: unverified.
* Pure module.
*/
var naver_exports = /* @__PURE__ */ __exportAll$1({
	mapNaverAiBriefing: () => mapNaverAiBriefing,
	mapNaverArticle: () => mapNaverArticle,
	mapNaverWorldNews: () => mapNaverWorldNews,
	naverList: () => naverList,
	pick: () => pick
});
function isObj(v) {
	return v != null && typeof v === "object" && !Array.isArray(v);
}
function pick(row, keys) {
	for (const k of keys) {
		const v = row[k];
		if (v != null && v !== "") return v;
	}
}
function str(v) {
	return v == null ? "" : String(v).trim();
}
/** First array under the documented list keys (or the payload itself). */
function naverList(payload, keys = [
	"articles",
	"items",
	"content",
	"list",
	"newsList",
	"result",
	"data"
]) {
	if (Array.isArray(payload)) return payload.filter(isObj);
	if (!isObj(payload)) return [];
	for (const k of keys) {
		const v = payload[k];
		if (Array.isArray(v)) return v.filter(isObj);
		if (isObj(v)) {
			const inner = naverList(v, keys);
			if (inner.length) return inner;
		}
	}
	return [];
}
var TITLE_KEYS = [
	"titleFull",
	"title",
	"articleTitle",
	"tit",
	"subject",
	"headline"
];
var BODY_KEYS = [
	"body",
	"subcontent",
	"summary",
	"content",
	"articleSummary",
	"subContent",
	"description"
];
var OFFICE_KEYS = [
	"officeName",
	"office",
	"press",
	"pressName",
	"ohnm",
	"source",
	"provider",
	"dorg"
];
var TIME_KEYS = [
	"datetime",
	"dateTime",
	"articleDateTime",
	"dt",
	"date",
	"publishDateTime",
	"publishDate",
	"createdAt",
	"registeredAt",
	"serviceDateTime"
];
var URL_KEYS = [
	"mobileNewsUrl",
	"linkUrl",
	"url",
	"newsUrl",
	"originalUrl",
	"link"
];
/** Domestic news list / focus / search article → FeedItem. */
function mapNaverArticle(row, ctx) {
	const title = stripHtml(pick(row, TITLE_KEYS));
	if (!title) return null;
	const officeId = str(pick(row, [
		"officeId",
		"oid",
		"pressId"
	]));
	const articleId = str(pick(row, [
		"articleId",
		"aid",
		"articleNo"
	]));
	const url = canonicalizeUrl(str(pick(row, URL_KEYS))) ?? (officeId && articleId ? `https://n.news.naver.com/mnews/article/${officeId}/${articleId}` : null);
	if (!url) return null;
	const t = parseSourceTime(pick(row, TIME_KEYS), { zone: "Asia/Seoul" });
	const outlet = stripHtml(pick(row, OFFICE_KEYS)) || void 0;
	const native = str(pick(row, ["id"])) || (officeId && articleId ? `${officeId}-${articleId}` : "");
	const seq = /^\d{1,15}$/.test(articleId) ? Number(articleId) : void 0;
	return {
		id: stableItemId(ctx.sourceId, native, url),
		kind: "news",
		region: ctx.region ?? "KR",
		sourceId: ctx.sourceId,
		sourceName: ctx.sourceName,
		sourceTier: outletTier(outlet, ctx.tier),
		outlet,
		title,
		snippet: clampSnippet(pick(row, BODY_KEYS)),
		url,
		publishedAt: t.iso,
		precision: t.precision,
		fetchedAt: ctx.fetchedAt,
		seq,
		tickers: [],
		sectors: [],
		topics: [.../* @__PURE__ */ new Set([...ctx.topics ?? [], ...topicsFromText(title)])],
		lang: "ko"
	};
}
/** `/api/foreign/news/worldNews` row (keyed by `aid`) → FeedItem. */
function mapNaverWorldNews(row, ctx) {
	const title = stripHtml(pick(row, TITLE_KEYS));
	const aid = str(pick(row, [
		"aid",
		"articleId",
		"id"
	]));
	if (!title || !aid) return null;
	const url = `https://stock.naver.com/news/worldnews/${encodeURIComponent(aid)}`;
	const t = parseSourceTime(pick(row, TIME_KEYS), { zone: "Asia/Seoul" });
	const outlet = stripHtml(pick(row, OFFICE_KEYS)) || "Reuters";
	return {
		id: `${ctx.sourceId}:${aid}`,
		kind: "news",
		region: ctx.region ?? "US",
		sourceId: ctx.sourceId,
		sourceName: ctx.sourceName,
		sourceTier: outletTier(outlet, ctx.tier),
		outlet,
		title,
		snippet: clampSnippet(pick(row, BODY_KEYS)),
		url,
		publishedAt: t.iso,
		precision: t.precision,
		fetchedAt: ctx.fetchedAt,
		seq: /^\d+$/.test(aid) ? Number(aid) : void 0,
		tickers: [],
		sectors: [],
		topics: [.../* @__PURE__ */ new Set([...ctx.topics ?? ["global"], ...topicsFromText(title)])],
		lang: "ko"
	};
}
/**
* Naver Pay AI market briefing (current / v2 list item). Catalog-documented v2
* list fields: `id` (int), `title`, `summary`, `detail`, `briefingDate`,
* `briefingHour` (strings; KST). Text is shown as provided, attributed, and
* linked to stock.naver.com (no public per-briefing page route is documented).
*/
function mapNaverAiBriefing(row) {
	if (!isObj(row)) return null;
	const inner = isObj(row.marketBriefing) ? row.marketBriefing : isObj(row.briefing) ? row.briefing : row;
	const id = str(pick(inner, [
		"id",
		"briefingId",
		"marketBriefingId"
	]));
	const title = stripHtml(pick(inner, [
		"title",
		"headline",
		"summaryTitle"
	]));
	const bullets = [];
	const rawBullets = pick(inner, [
		"contents",
		"summaries",
		"items",
		"bullets",
		"summaryList"
	]);
	if (Array.isArray(rawBullets)) for (const b of rawBullets) {
		const t = isObj(b) ? stripHtml(pick(b, [
			"content",
			"text",
			"summary",
			"title"
		])) : stripHtml(b);
		if (t) bullets.push(t.slice(0, 240));
	}
	if (!bullets.length) {
		const text = stripHtml(pick(inner, [
			"summary",
			"content",
			"body"
		]));
		if (text) bullets.push(text.slice(0, 240));
	}
	if (!title && !bullets.length) return null;
	const day = str(pick(inner, [
		"briefingDate",
		"date",
		"baseDate"
	]));
	const hourRaw = str(pick(inner, ["briefingHour", "hour"]));
	const hour = /^\d{1,2}$/.test(hourRaw) ? `${hourRaw.padStart(2, "0")}:00` : /^\d{1,2}:\d{2}/.test(hourRaw) ? hourRaw.slice(0, 5) : "";
	const t = day ? parseSourceTime(hour ? `${day} ${hour}` : day, { zone: "Asia/Seoul" }) : parseSourceTime(pick(inner, [
		"createdAt",
		"publishedAt",
		"datetime",
		"updatedAt"
	]), { zone: "Asia/Seoul" });
	return {
		id: id || "current",
		title: title || "AI 시장 브리핑",
		bullets: bullets.slice(0, 6),
		publishedAt: t.iso,
		precision: t.precision,
		url: "https://stock.naver.com/"
	};
}
//#endregion
export { naver_C7W4a0B0_exports as i, mapNaverWorldNews as n, naverList as r, mapNaverArticle as t };
