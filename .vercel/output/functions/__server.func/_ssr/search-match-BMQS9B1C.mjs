import { d as normalizeKrTicker } from "./universe-BLkYDatc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/search-match-BMQS9B1C.js
/**
* Strict desk search: every query token must match a real field.
* Never treat empty strings as a match (`"466920".includes("") === true`).
*/
var STOP = /* @__PURE__ */ new Set([
	"etf",
	"펀드",
	"주식",
	"지수",
	"자산",
	"운용",
	"투자",
	"증권",
	"plus",
	"tiger",
	"kodex",
	"ace",
	"sol",
	"rise",
	"kbstar",
	"hanaro"
]);
/** Theme / alias expansion — only used as extra hay, not as a free pass. */
var SYNONYMS = {
	방산: [
		"방산",
		"국방",
		"방위",
		"우주항공",
		"항공우주"
	],
	바이오: [
		"바이오",
		"헬스케어",
		"제약",
		"의료기기",
		"바이오테크"
	],
	반도체: [
		"반도체",
		"hbm",
		"메모리",
		"파운드리",
		"칩"
	],
	조선: [
		"조선",
		"선박",
		"해운",
		"기자재"
	],
	배터리: [
		"배터리",
		"2차전지",
		"이차전지",
		"양극",
		"음극"
	],
	이차전지: [
		"2차전지",
		"배터리",
		"양극"
	],
	"2차전지": ["배터리", "이차전지"],
	원전: [
		"원전",
		"원자력",
		"전력기기",
		"원전설비"
	],
	로봇: [
		"로봇",
		"로보틱스",
		"로보티즈",
		"로보스타",
		"클로봇",
		"자동화",
		"휴머노이드"
	],
	데이터센터: [
		"데이터센터",
		"전력설비",
		"ai전력"
	],
	ai: [
		"ai",
		"인공지능",
		"데이터센터"
	],
	인공지능: ["ai", "인공지능"],
	나스닥: [
		"나스닥",
		"nasdaq",
		"미국테크"
	],
	미국: [
		"미국",
		"s&p",
		"나스닥"
	],
	배당: [
		"배당",
		"고배당",
		"인컴"
	],
	채권: [
		"채권",
		"금리",
		"국채",
		"회사채"
	],
	은행: ["은행", "금융지주"]
};
function tokenizeQuery(q) {
	return q.trim().toLowerCase().split(/[\s,/+|·•]+/).map((t) => t.trim()).filter((t) => t.length >= 2 || /^\d+$/.test(t));
}
function compact(s) {
	return s.toLowerCase().replace(/[\s_\-./]/g, "");
}
function expandToken(token) {
	const t = token.toLowerCase();
	const extra = SYNONYMS[t] ?? [];
	return [.../* @__PURE__ */ new Set([t, ...extra.map((x) => x.toLowerCase())])];
}
function isCodeLike(token) {
	const digits = token.replace(/\D/g, "");
	if (digits.length >= 2 && digits.length === token.replace(/[\s-]/g, "").length) return true;
	return /^[0-9a-z]{4,8}$/i.test(token);
}
function textHas(hay, needle) {
	if (!needle) return false;
	const h = hay.toLowerCase();
	const n = needle.toLowerCase();
	if (h.includes(n)) return true;
	return compact(h).includes(compact(n));
}
/** One token hits any of the provided fields (name, code, issuer, …). */
function tokenMatchesFields(token, fields) {
	const t = token.trim().toLowerCase();
	if (!t) return false;
	const clean = fields.map((f) => (f ?? "").toString().trim()).filter((f) => f.length > 0);
	if (!clean.length) return false;
	const alts = expandToken(t);
	for (const alt of alts) for (const field of clean) {
		if (textHas(field, alt)) return true;
		if (isCodeLike(t) || isCodeLike(alt)) {
			if (/[a-z]/i.test(alt) || /[a-z]/i.test(field)) {
				if (compact(field).includes(compact(alt))) return true;
				continue;
			}
			const digits = alt.replace(/\D/g, "");
			const fDigits = field.replace(/\D/g, "");
			if (digits.length >= 2 && fDigits.includes(digits)) return true;
			if (compact(field).includes(compact(alt))) return true;
		}
	}
	return false;
}
/**
* AND-match: every token must hit. Empty / 1-char junk queries match nothing
* (callers that want "show all" should skip calling this).
*/
function matchesSearchQuery(query, fields, opts) {
	const tokens = tokenizeQuery(query);
	if (!tokens.length) return false;
	const usable = fields.map((f) => f ?? "");
	return tokens.every((tok) => {
		if (STOP.has(tok) && tokens.length === 1) {
			if (tok === "sol") return usable.some((f) => /(^|[^a-z])sol([^a-z]|$)/i.test(f));
			return usable.some((f) => textHas(f, tok));
		}
		if (!opts?.allowIssuer && /자산|운용/.test(tok) && tokens.length === 1) return usable.some((f) => textHas(f, tok) && !/운용|자산/.test(f));
		return tokenMatchesFields(tok, usable);
	});
}
function scoreSearchHit(query, name, code) {
	const q = query.trim().toLowerCase();
	const n = name.toLowerCase();
	const c = (code ?? "").toLowerCase();
	if (!q) return 0;
	if (c && (c === q || c === normalizeKrTicker(q).toLowerCase())) return 200;
	if (n === q) return 180;
	if (n.startsWith(q) || compact(n).startsWith(compact(q))) return 140;
	if (n.includes(q) || compact(n).includes(compact(q))) return 100;
	const qDigits = q.replace(/\D/g, "");
	if (!/[a-z]/i.test(q) && qDigits.length >= 2 && c.includes(qDigits)) return 90;
	return 40;
}
function rankByQuery(items, query, pick) {
	return [...items].sort((a, b) => {
		const pa = pick(a);
		const pb = pick(b);
		return scoreSearchHit(query, pb.name, pb.code) - scoreSearchHit(query, pa.name, pa.code);
	});
}
//#endregion
export { rankByQuery as n, scoreSearchHit as r, matchesSearchQuery as t };
