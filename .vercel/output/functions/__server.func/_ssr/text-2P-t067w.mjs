import { t as decodeHtmlEntities } from "./readable-text-D28LomX7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/text-2P-t067w.js
/** Strip tags + CDATA, decode entities, collapse whitespace. */
function stripHtml(input) {
	if (input == null) return "";
	const s = String(input).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<\s*br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ");
	const once = decodeHtmlEntities(s);
	return (/&[a-z#0-9]+;/i.test(once) ? decodeHtmlEntities(once) : once).replace(/<[^>]*>/g, " ").replace(/[\u00a0\u200b\uFEFF]/g, " ").replace(/\s+/g, " ").trim();
}
/** Source snippet capped at 240 chars (never more — A4). */
function clampSnippet(input, max = 240) {
	const s = stripHtml(input);
	if (!s) return void 0;
	if (s.length <= max) return s;
	return `${s.slice(0, max - 1).trimEnd()}…`;
}
var TRACKING_PARAM = /^(utm_[a-z0-9_]+|fbclid|gclid|mc_cid|mc_eid)$/i;
/**
* Canonical https URL: forces https, drops `utm_*` (and common click ids) and
* the fragment. Google News redirect URLs are returned untouched. Returns null
* for anything that is not an http(s) URL.
*/
function canonicalizeUrl(raw) {
	if (typeof raw !== "string") return null;
	const t = raw.trim();
	if (!t) return null;
	let u;
	try {
		u = new URL(t);
	} catch {
		return null;
	}
	if (u.protocol !== "https:" && u.protocol !== "http:") return null;
	if (/(^|\.)news\.google\.com$/i.test(u.hostname)) return u.protocol === "http:" ? t.replace(/^http:/i, "https:") : t;
	u.protocol = "https:";
	u.hash = "";
	for (const key of [...u.searchParams.keys()]) if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
	return u.toString();
}
/** FNV-1a 32-bit → base36; stable across runtimes. */
function hashString(input) {
	let h = 2166136261;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0).toString(36);
}
/** Stable item id: `sourceId:nativeId`, else `sourceId:h<hash(canonical url)>`. */
function stableItemId(sourceId, nativeId, url) {
	const native = nativeId == null ? "" : String(nativeId).trim();
	if (native) return `${sourceId}:${native}`;
	return `${sourceId}:h${hashString(url ?? "")}`;
}
//#endregion
export { stripHtml as a, stableItemId as i, clampSnippet as n, hashString as r, canonicalizeUrl as t };
