import { a as stripHtml, i as stableItemId, n as clampSnippet, t as canonicalizeUrl } from "./text-2P-t067w.mjs";
import { a as kstDayKey, s as parseSourceTime } from "./time-By5ScNNo.mjs";
import { a as topicsFromText, r as outletTier } from "./importance-C2QKgaE9.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/mappers-DlpCqw-E.js
/**
* One shared newest-first comparator (B0.2) + opaque cursor paging.
* Pure module — relative `.ts` imports only.
*/
function timed(item) {
	return item.precision === "second" || item.precision === "minute";
}
function ts(item) {
	const ms = item.publishedAt ? Date.parse(item.publishedAt) : NaN;
	return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}
/**
* Total, deterministic newest-first order:
* 1. items with `publishedAt` before items without;
* 2. KST calendar day, newest first;
* 3. same day: timed items by time (newest first), then date-only items;
* 4. `seq` descending (missing seq last);
* 5. `sourceTier` ascending;
* 6. `id` ascending.
*/
function compareNewestFirst(a, b) {
	const aHas = a.publishedAt != null && a.precision !== "unknown" && Number.isFinite(ts(a));
	const bHas = b.publishedAt != null && b.precision !== "unknown" && Number.isFinite(ts(b));
	if (aHas !== bHas) return aHas ? -1 : 1;
	if (aHas && bHas) {
		const ad = kstDayKey(a.publishedAt) ?? "";
		const bd = kstDayKey(b.publishedAt) ?? "";
		if (ad !== bd) return ad < bd ? 1 : -1;
		const at = timed(a);
		const bt = timed(b);
		if (at !== bt) return at ? -1 : 1;
		if (at && bt) {
			const diff = ts(b) - ts(a);
			if (diff !== 0) return diff;
		}
	}
	const as = typeof a.seq === "number" && Number.isFinite(a.seq) ? a.seq : Number.NEGATIVE_INFINITY;
	const bs = typeof b.seq === "number" && Number.isFinite(b.seq) ? b.seq : Number.NEGATIVE_INFINITY;
	if (as !== bs) return as > bs ? -1 : 1;
	if (a.sourceTier !== b.sourceTier) return a.sourceTier - b.sourceTier;
	if (a.id === b.id) return 0;
	return a.id < b.id ? -1 : 1;
}
/** New array sorted newest first. */
function sortNewestFirst(items) {
	return [...items].sort(compareNewestFirst);
}
/** Drop later duplicates by id (keeps the first occurrence). */
function dedupeById(items) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const it of items) {
		if (seen.has(it.id)) continue;
		seen.add(it.id);
		out.push(it);
	}
	return out;
}
function b64urlEncode(s) {
	const bytes = new TextEncoder().encode(s);
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s) {
	try {
		const norm = s.replace(/-/g, "+").replace(/_/g, "/");
		const bin = atob(norm + "===".slice((norm.length + 3) % 4));
		const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
		return new TextDecoder().decode(bytes);
	} catch {
		return null;
	}
}
/** Opaque cursor from `publishedAt|id` of the last item on a page. */
function encodeCursor(item) {
	return b64urlEncode(`${item.publishedAt ?? ""}|${item.id}`);
}
function decodeCursor(cursor) {
	if (!cursor) return null;
	const raw = b64urlDecode(cursor);
	if (!raw) return null;
	const i = raw.indexOf("|");
	if (i < 0) return null;
	const publishedAt = raw.slice(0, i) || null;
	const id = raw.slice(i + 1);
	if (!id) return null;
	return {
		publishedAt,
		id
	};
}
/**
* Page a newest-first list after `cursor`. When the cursor item is still in the
* list, the page starts right after it; otherwise it starts at the first item
* strictly older than the cursor time (so a refreshed list never repeats rows).
*/
function pageAfterCursor(sorted, cursor, limit) {
	const c = decodeCursor(cursor);
	let start = 0;
	if (c) {
		const idx = sorted.findIndex((it) => it.id === c.id);
		if (idx >= 0) start = idx + 1;
		else {
			const cms = c.publishedAt ? Date.parse(c.publishedAt) : NaN;
			start = sorted.findIndex((it) => {
				if (Number.isNaN(cms)) return !it.publishedAt && it.id > c.id;
				const ms = it.publishedAt ? Date.parse(it.publishedAt) : NaN;
				return Number.isNaN(ms) || ms < cms;
			});
			if (start < 0) start = sorted.length;
		}
	}
	const items = sorted.slice(start, start + Math.max(0, limit));
	const last = items[items.length - 1];
	return {
		items,
		nextCursor: last && start + items.length < sorted.length ? encodeCursor(last) : null
	};
}
/** Sort any list by a derived sortable key, newest first (kernel order). */
function sortByKernel(list, key) {
	const decorated = list.map((item, index) => ({
		item,
		key: key(item),
		index
	}));
	decorated.sort((a, b) => compareNewestFirst(a.key, b.key) || a.index - b.index);
	return decorated.map((d) => d.item);
}
/** Kernel key for a research report (date-only precision, nid tie-break). */
function researchSortKey(r) {
	const t = parseSourceTime(r.date, { zone: "Asia/Seoul" });
	const naver = (r.sourceKind ?? "naver") === "naver";
	return {
		id: `${r.sourceKind ?? "naver"}:${r.category}:${r.researchId}`,
		publishedAt: t.iso,
		precision: t.precision,
		seq: naver ? r.researchId : void 0,
		sourceTier: 3
	};
}
/** D1a/b: research lists newest first (mixed `YYYY.MM.DD`/`YY.MM.DD`/ISO safe). */
function sortReportsNewestFirst(list) {
	return sortByKernel(list, researchSortKey);
}
/** Latest report per broker (newest first by the kernel). */
function latestPerBrokerByKernel(list) {
	const byBroker = /* @__PURE__ */ new Map();
	for (const r of sortReportsNewestFirst(list)) if (!byBroker.has(r.broker)) byBroker.set(r.broker, r);
	return [...byBroker.values()];
}
/** KST day key of a report date (`YYYY-MM-DD`) or null. */
function reportDay(r) {
	const t = parseSourceTime(r.date, { zone: "Asia/Seoul" });
	return t.iso ? t.iso.slice(0, 10) : null;
}
function disclosureSortKey(d) {
	const t = parseSourceTime(d.datetime, { zone: "Asia/Seoul" });
	return {
		id: d.id,
		publishedAt: t.iso,
		precision: t.precision,
		sourceTier: 1
	};
}
/** D1e: disclosure merges newest first across KIND/DART/Naver formats. */
function sortDisclosuresNewestFirst(list) {
	return sortByKernel(list, disclosureSortKey);
}
/** Generic `{ id, datetime }` news-like sorter (ISO / RFC-822 / Naver compact). */
function sortTimedNewestFirst(list, zone = "Asia/Seoul") {
	return sortByKernel(list, (n) => {
		const t = parseSourceTime(n.datetime, { zone });
		return {
			id: n.id,
			publishedAt: t.iso,
			precision: t.precision,
			sourceTier: 3
		};
	});
}
/** Naver per-stock `NewsItem` → FeedItem (outlet tier from publisher name). */
function newsItemToFeed(n, ctx, extra) {
	const url = canonicalizeUrl(n.url);
	const title = stripHtml(n.title);
	if (!url || !title) return null;
	const t = parseSourceTime(n.datetime, { zone: ctx.zone ?? "Asia/Seoul" });
	const outlet = n.source && n.source !== "언론" ? n.source : void 0;
	return {
		id: stableItemId(ctx.sourceId, n.id, url),
		kind: "news",
		region: ctx.region ?? "KR",
		sourceId: ctx.sourceId,
		sourceName: ctx.sourceName,
		sourceTier: outletTier(outlet, ctx.tier),
		outlet,
		title,
		snippet: clampSnippet(n.body),
		url,
		publishedAt: t.iso,
		precision: t.precision,
		fetchedAt: ctx.fetchedAt,
		tickers: [],
		sectors: [],
		topics: [.../* @__PURE__ */ new Set([...ctx.topics ?? [], ...topicsFromText(title)])],
		lang: ctx.lang ?? "ko",
		paywalled: ctx.paywalled,
		...extra
	};
}
/** Existing `DisclosureItem` → FeedItem (`kind: "disclosure"`, tier 1). */
function disclosureToFeed(d, ctx) {
	const url = canonicalizeUrl(d.dartUrl) ?? canonicalizeUrl(d.dartSearchUrl);
	const title = stripHtml(d.title);
	if (!url || !title) return null;
	const t = parseSourceTime(d.datetime, { zone: "Asia/Seoul" });
	return {
		id: stableItemId(ctx.sourceId, d.id, url),
		kind: "disclosure",
		region: "KR",
		sourceId: ctx.sourceId,
		sourceName: d.sourceLabel ? `${ctx.sourceName} · ${d.sourceLabel}` : ctx.sourceName,
		sourceTier: 1,
		title: d.nameKo ? `[${d.nameKo}] ${title}` : title,
		url,
		publishedAt: t.iso,
		precision: t.precision,
		fetchedAt: ctx.fetchedAt,
		tickers: d.code && /^[0-9A-Z]{6}$/.test(d.code) ? [{
			market: "KR",
			code: d.code
		}] : [],
		sectors: [],
		topics: ["disclosure", ...topicsFromText(title)],
		lang: "ko"
	};
}
/** Official US documents (`publishedAt` YYYY-MM-DD or ISO) newest first (D1d). */
function sortOfficialNewestFirst(list) {
	return sortByKernel(list, (r) => {
		const t = parseSourceTime(r.publishedAt, { zone: "America/New_York" });
		return {
			id: r.id,
			publishedAt: t.iso,
			precision: t.precision,
			sourceTier: 1
		};
	});
}
//#endregion
export { newsItemToFeed as a, sortDisclosuresNewestFirst as c, sortReportsNewestFirst as d, sortTimedNewestFirst as f, latestPerBrokerByKernel as i, sortNewestFirst as l, dedupeById as n, pageAfterCursor as o, disclosureToFeed as r, reportDay as s, compareNewestFirst as t, sortOfficialNewestFirst as u };
