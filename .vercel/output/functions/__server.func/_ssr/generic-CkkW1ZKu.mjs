import { a as stripHtml, i as stableItemId, n as clampSnippet, t as canonicalizeUrl } from "./text-2P-t067w.mjs";
import { s as parseSourceTime } from "./time-By5ScNNo.mjs";
import { a as topicsFromText, r as outletTier } from "./importance-C2QKgaE9.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/generic-CkkW1ZKu.js
/** Generic RSS/Atom entry → FeedItem. */
function rssEntryToItem(e, ctx) {
	const url = canonicalizeUrl(e.link) ?? canonicalizeUrl(e.guid);
	const title = stripHtml(e.title);
	if (!url || !title) return null;
	const t = parseSourceTime(e.pubDate, { zone: ctx.zone ?? "UTC" });
	return {
		id: stableItemId(ctx.sourceId, e.guid && e.guid !== e.link ? e.guid : null, url),
		kind: ctx.kind ?? "news",
		region: ctx.region,
		sourceId: ctx.sourceId,
		sourceName: ctx.sourceName,
		sourceTier: ctx.tier,
		title,
		snippet: ctx.headlineOnly ? void 0 : clampSnippet(e.description),
		url,
		publishedAt: t.iso,
		precision: t.precision,
		fetchedAt: ctx.fetchedAt,
		tickers: [],
		sectors: [],
		topics: [.../* @__PURE__ */ new Set([...ctx.topics ?? [], ...topicsFromText(`${title} ${e.categories.join(" ")}`)])],
		lang: ctx.lang,
		paywalled: ctx.paywalled
	};
}
/** Strip Google News' trailing ` - Publisher` when it matches the <source>. */
function stripPublisherSuffix(title, publisher) {
	if (!publisher) return title;
	const suffix = ` - ${publisher}`;
	return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}
/** Google News RSS entry → FeedItem (redirect link kept, outlet from <source>). */
function googleNewsEntryToItem(e, ctx) {
	const url = canonicalizeUrl(e.link);
	const outlet = e.source?.trim() || void 0;
	const title = stripPublisherSuffix(stripHtml(e.title), outlet);
	if (!url || !title || /Google (뉴스|News)$/.test(title)) return null;
	const t = parseSourceTime(e.pubDate, { zone: "UTC" });
	const paywalled = ctx.paywalled || /bloomberg/i.test(outlet ?? "") || /bloomberg/i.test(e.sourceUrl ?? "");
	return {
		id: stableItemId(ctx.sourceId, e.guid || null, url),
		kind: ctx.kind ?? "news",
		region: ctx.region,
		sourceId: ctx.sourceId,
		sourceName: ctx.sourceName,
		sourceTier: outletTier(outlet, ctx.tier),
		outlet,
		title,
		snippet: void 0,
		url,
		publishedAt: t.iso,
		precision: t.precision,
		fetchedAt: ctx.fetchedAt,
		tickers: [],
		sectors: [],
		topics: [.../* @__PURE__ */ new Set([...ctx.topics ?? [], ...topicsFromText(title)])],
		lang: ctx.lang,
		paywalled: paywalled || void 0
	};
}
/** KIS `FHKST01011800` output row → FeedItem. KIS gives titles only (no link). */
function kisNewsRowToItem(row, ctx) {
	const title = stripHtml(row.hts_pbnt_titl_cntt);
	if (!title) return null;
	const day = String(row.data_dt ?? "").trim();
	const tm = String(row.data_tm ?? "").trim().padStart(6, "0");
	const raw = /^\d{8}$/.test(day) ? /^\d{6}$/.test(tm) ? `${day}${tm}` : day : "";
	const t = parseSourceTime(raw, { zone: "Asia/Seoul" });
	const serial = String(row.cntt_usiq_srno ?? "").trim();
	const codes = [
		"iscd1",
		"iscd2",
		"iscd3",
		"iscd4",
		"iscd5"
	].map((k) => String(row[k] ?? "").trim().toUpperCase()).filter((c) => /^[0-9A-Z]{6}$/.test(c));
	const outlet = stripHtml(row.dorg) || void 0;
	const url = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(title)}`;
	return {
		id: stableItemId(ctx.sourceId, serial || null, url),
		kind: "news",
		region: "KR",
		sourceId: ctx.sourceId,
		sourceName: ctx.sourceName,
		sourceTier: outletTier(outlet, ctx.tier),
		outlet,
		title,
		snippet: "KIS 제목 전용 피드 — 원문 링크가 제공되지 않아 기사 검색으로 연결합니다.",
		url,
		publishedAt: t.iso,
		precision: t.precision,
		fetchedAt: ctx.fetchedAt,
		seq: /^\d+$/.test(serial) ? Number(serial) : void 0,
		tickers: [...new Set(codes)].map((code) => ({
			market: "KR",
			code
		})),
		sectors: [],
		topics: [.../* @__PURE__ */ new Set([...ctx.topics ?? [], ...topicsFromText(title)])],
		lang: "ko"
	};
}
/** Finnhub `/news` row → FeedItem. */
function finnhubRowToItem(row, ctx) {
	const url = canonicalizeUrl(row.url);
	const title = stripHtml(row.headline);
	if (!url || !title) return null;
	const t = parseSourceTime(typeof row.datetime === "number" ? row.datetime : null, { zone: "UTC" });
	const outlet = stripHtml(row.source) || void 0;
	const related = String(row.related ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z][A-Z0-9.]{0,9}$/.test(s));
	return {
		id: stableItemId(ctx.sourceId, row.id ?? null, url),
		kind: "news",
		region: "US",
		sourceId: ctx.sourceId,
		sourceName: ctx.sourceName,
		sourceTier: outletTier(outlet, ctx.tier),
		outlet,
		title,
		snippet: clampSnippet(row.summary),
		url,
		publishedAt: t.iso,
		precision: t.precision,
		fetchedAt: ctx.fetchedAt,
		tickers: related.map((code) => ({
			market: "US",
			code
		})),
		sectors: [],
		topics: [.../* @__PURE__ */ new Set([...ctx.topics ?? [], ...topicsFromText(title)])],
		lang: "en"
	};
}
/** SEC `getcurrent` Atom entry title → CIK (e.g. `8-K - NVIDIA CORP (0001045810) (Filer)`). */
function secAtomCik(title) {
	const m = title.match(/\((\d{7,10})\)\s*\((?:Filer|Subject|Reporting)\)/i) ?? title.match(/\((\d{7,10})\)/);
	return m ? String(Number(m[1])) : null;
}
/** Yahoo `v8/finance/chart` payload → snapshot numbers from `meta` (no invention). */
/**
* Previous session close from daily bars: when the last bar is the session of
* `regularMarketTime`, the prior finite close; otherwise the last bar's close.
*/
function prevCloseFromBars(result, marketTimeSec, gmtOffsetSec) {
	const ts = Array.isArray(result?.timestamp) ? result.timestamp : null;
	const closes = Array.isArray(result?.indicators?.quote?.[0]?.close) ? result.indicators.quote[0].close : null;
	if (!ts || !closes || !ts.length || marketTimeSec == null) return null;
	const finite = (v) => typeof v === "number" && Number.isFinite(v);
	let last = -1;
	for (let i = Math.min(ts.length, closes.length) - 1; i >= 0; i--) if (finite(closes[i]) && finite(ts[i])) {
		last = i;
		break;
	}
	if (last < 0) return null;
	const day = (sec) => Math.floor((sec + gmtOffsetSec) / 86400);
	if (day(ts[last]) !== day(marketTimeSec)) return closes[last];
	for (let i = last - 1; i >= 0; i--) if (finite(closes[i])) return closes[i];
	return null;
}
function yahooChartSnapshot(payload) {
	const result = payload?.chart?.result?.[0];
	const meta = result?.meta;
	if (!meta) return null;
	const num = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
	const str = (v) => typeof v === "string" && v.trim() ? v.trim() : null;
	const price = num(meta.regularMarketPrice);
	const tsec = num(meta.regularMarketTime);
	const hasBars = Array.isArray(result?.timestamp) && result.timestamp.length > 0;
	const range = str(meta.range);
	const prev = num(meta.previousClose) ?? num(meta.regularMarketPreviousClose) ?? prevCloseFromBars(result, tsec, num(meta.gmtoffset) ?? 0) ?? (!hasBars && (range == null || range === "1d") ? num(meta.chartPreviousClose) : null);
	const change = price != null && prev != null ? price - prev : null;
	const changePct = change != null && prev ? change / prev * 100 : null;
	return {
		symbol: String(meta.symbol ?? ""),
		name: str(meta.longName) ?? str(meta.shortName),
		price,
		prevClose: prev,
		change,
		changePct,
		currency: str(meta.currency),
		asOf: tsec ? (/* @__PURE__ */ new Date(tsec * 1e3)).toISOString() : null,
		delayMinutes: num(meta.exchangeDataDelayedBy),
		exchange: str(meta.exchangeName),
		high52: num(meta.fiftyTwoWeekHigh),
		low52: num(meta.fiftyTwoWeekLow),
		volume: num(meta.regularMarketVolume),
		instrumentType: str(meta.instrumentType)
	};
}
//#endregion
export { secAtomCik as a, rssEntryToItem as i, googleNewsEntryToItem as n, stripPublisherSuffix as o, kisNewsRowToItem as r, yahooChartSnapshot as s, finnhubRowToItem as t };
