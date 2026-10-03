import { r as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as SOURCE_REGISTRY } from "./registry-BWVqhaYN.mjs";
import { s as setHealthNote } from "./health-z1OjkYee.mjs";
import { a as parseFeed, n as fetchJsonWithPolicy, r as fetchWithPolicy } from "./http-CCgilygj.mjs";
import { n as registerAdapter } from "./runner-JXC75WOo.mjs";
import { t as UNIVERSE } from "./universe-BLkYDatc.mjs";
import { i as kstCompactDate } from "./time-By5ScNNo.mjs";
import { r as disclosureToFeed } from "./mappers-DlpCqw-E.mjs";
import { n as mapNaverWorldNews, r as naverList, t as mapNaverArticle } from "./naver-C7W4a0B0.mjs";
import { a as secAtomCik, i as rssEntryToItem, n as googleNewsEntryToItem, r as kisNewsRowToItem, t as finnhubRowToItem } from "./generic-CkkW1ZKu.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/news-DxJZGpZd.js
var news_DxJZGpZd_exports = /* @__PURE__ */ __exportAll({
	n: () => buildUsTickerIndex,
	r: () => tagUsTickers,
	t: () => news_exports
});
var ASCII_NAME = /^[A-Za-z0-9&.\- ]+$/;
function buildKrTickerIndex(entries) {
	const codes = /* @__PURE__ */ new Set();
	const names = [];
	const seen = /* @__PURE__ */ new Set();
	for (const e of entries) {
		const code = e.code.trim().toUpperCase();
		if (!/^[0-9A-Z]{6}$/.test(code)) continue;
		codes.add(code);
		for (const raw of [e.nameKo]) {
			const name = (raw ?? "").trim();
			if (name.length < 2) continue;
			const key = `${name}|${code}`;
			if (seen.has(key)) continue;
			seen.add(key);
			names.push({
				name,
				code,
				ascii: ASCII_NAME.test(name)
			});
		}
	}
	names.sort((a, b) => b.name.length - a.name.length || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	return {
		codes,
		names
	};
}
function isAsciiWordChar(ch) {
	return ch != null && /[A-Za-z0-9]/.test(ch);
}
/** KR tickers mentioned in `text`, in order of first appearance. */
function tagKrTickers(text, index) {
	if (!text) return [];
	const hits = [];
	const masked = new Array(text.length).fill(false);
	for (const m of text.matchAll(/(?<![0-9A-Za-z])([0-9][0-9A-Z]{5})(?![0-9A-Za-z])/g)) {
		const code = m[1];
		if (!index.codes.has(code)) continue;
		const start = m.index;
		for (let i = start; i < start + 6; i++) masked[i] = true;
		hits.push({
			pos: start,
			code
		});
	}
	for (const { name, code, ascii } of index.names) {
		let from = 0;
		while (from <= text.length - name.length) {
			const pos = text.indexOf(name, from);
			if (pos < 0) break;
			from = pos + 1;
			let free = true;
			for (let i = pos; i < pos + name.length; i++) if (masked[i]) {
				free = false;
				break;
			}
			if (!free) continue;
			if (ascii && (isAsciiWordChar(text[pos - 1]) || isAsciiWordChar(text[pos + name.length]))) continue;
			for (let i = pos; i < pos + name.length; i++) masked[i] = true;
			hits.push({
				pos,
				code
			});
		}
	}
	hits.sort((a, b) => a.pos - b.pos);
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const h of hits) {
		if (seen.has(h.code)) continue;
		seen.add(h.code);
		out.push({
			market: "KR",
			code: h.code
		});
	}
	return out;
}
function buildUsTickerIndex(entries) {
	const symbols = /* @__PURE__ */ new Set();
	const names = [];
	for (const e of entries) {
		const sym = e.symbol.trim().toUpperCase();
		if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(sym)) continue;
		symbols.add(sym);
		for (const n of e.names) if (n.trim().length >= 3) names.push({
			name: n.trim(),
			symbol: sym
		});
	}
	names.sort((a, b) => b.name.length - a.name.length);
	return {
		symbols,
		names
	};
}
/** US tickers from cashtags, exchange notation and exact company names. */
function tagUsTickers(text, index) {
	if (!text) return [];
	const hits = [];
	for (const m of text.matchAll(/(?<![A-Za-z0-9])\$([A-Z]{1,5}(?:\.[A-Z])?)(?![A-Za-z0-9])/g)) hits.push({
		pos: m.index,
		code: m[1]
	});
	for (const m of text.matchAll(/\b(?:NASDAQ|NYSE|NYSEARCA|AMEX|Nasdaq|Nyse)\s*:\s*([A-Z]{1,5}(?:\.[A-Z])?)\b/g)) hits.push({
		pos: m.index,
		code: m[1]
	});
	const masked = new Array(text.length).fill(false);
	for (const { name, symbol } of index.names) {
		let from = 0;
		while (from <= text.length - name.length) {
			const pos = text.indexOf(name, from);
			if (pos < 0) break;
			from = pos + 1;
			if (isAsciiWordChar(text[pos - 1]) || isAsciiWordChar(text[pos + name.length])) continue;
			let free = true;
			for (let i = pos; i < pos + name.length; i++) if (masked[i]) free = false;
			if (!free) continue;
			for (let i = pos; i < pos + name.length; i++) masked[i] = true;
			hits.push({
				pos,
				code: symbol
			});
		}
	}
	hits.sort((a, b) => a.pos - b.pos);
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const h of hits) {
		if (seen.has(h.code)) continue;
		seen.add(h.code);
		out.push({
			market: "US",
			code: h.code
		});
	}
	return out;
}
/**
* Exact US company-name map for headline tagging (F3.5): the default US
* watchlist (US_STREET_SYMBOLS), the official universe and the robotics US
* seed. Data only. Names are matched case-sensitively on word boundaries.
*/
var US_COMPANY_NAMES = [
	{
		symbol: "NVDA",
		names: ["Nvidia", "NVIDIA"]
	},
	{
		symbol: "AAPL",
		names: ["Apple"]
	},
	{
		symbol: "MSFT",
		names: ["Microsoft"]
	},
	{
		symbol: "AMZN",
		names: ["Amazon"]
	},
	{
		symbol: "GOOGL",
		names: ["Alphabet", "Google"]
	},
	{
		symbol: "META",
		names: ["Meta Platforms"]
	},
	{
		symbol: "AVGO",
		names: ["Broadcom"]
	},
	{
		symbol: "TSLA",
		names: ["Tesla"]
	},
	{
		symbol: "AMD",
		names: ["Advanced Micro Devices"]
	},
	{
		symbol: "TSM",
		names: ["TSMC", "Taiwan Semiconductor"]
	},
	{
		symbol: "ISRG",
		names: ["Intuitive Surgical"]
	},
	{
		symbol: "SYM",
		names: ["Symbotic"]
	},
	{
		symbol: "TER",
		names: ["Teradyne"]
	},
	{
		symbol: "ROK",
		names: ["Rockwell Automation"]
	},
	{
		symbol: "ZBRA",
		names: ["Zebra Technologies"]
	},
	{
		symbol: "CGNX",
		names: ["Cognex"]
	},
	{
		symbol: "PRCT",
		names: ["PROCEPT BioRobotics", "Procept BioRobotics"]
	},
	{
		symbol: "SERV",
		names: ["Serve Robotics"]
	},
	{
		symbol: "RR",
		names: ["Richtech Robotics"]
	},
	{
		symbol: "KSCP",
		names: ["Knightscope"]
	},
	{
		symbol: "FANUY",
		names: ["Fanuc", "FANUC"]
	},
	{
		symbol: "YASKY",
		names: ["Yaskawa"]
	},
	{
		symbol: "ABBNY",
		names: ["ABB Ltd"]
	}
];
/**
* Server-side ticker tagging with the static dictionaries (F1.3 / F3.5).
*/
var krIndex = null;
var usIndex = null;
function krTickerIndex() {
	if (!krIndex) krIndex = buildKrTickerIndex(UNIVERSE.map((u) => ({
		code: u.code,
		nameKo: u.nameKo
	})));
	return krIndex;
}
function usTickerIndex() {
	if (!usIndex) usIndex = buildUsTickerIndex(US_COMPANY_NAMES);
	return usIndex;
}
/** Add KR/US tickers found in title (+ snippet) without dropping source-provided ones. */
function tagItem(it) {
	const text = `${it.title} ${it.snippet ?? ""}`;
	const found = it.lang === "en" ? tagUsTickers(text, usTickerIndex()) : [...tagKrTickers(text, krTickerIndex()), ...tagUsTickers(text, usTickerIndex())];
	if (!found.length) return it;
	const seen = new Set(it.tickers.map((t) => `${t.market}:${t.code}`));
	const tickers = [...it.tickers];
	for (const t of found) {
		const key = `${t.market}:${t.code}`;
		if (!seen.has(key)) {
			seen.add(key);
			tickers.push(t);
		}
	}
	return {
		...it,
		tickers
	};
}
/**
* News-family adapters (F1.1 / F3.1). Every request goes through
* `fetchWithPolicy`; every item is tagged with tickers. Registering happens at
* import time (see `adapters/index.ts`).
*/
var news_exports = /* @__PURE__ */ __exportAll$1({
	GN_QUERIES: () => GN_QUERIES,
	googleNewsUrl: () => googleNewsUrl,
	naverFocusUrl: () => naverFocusUrl,
	runGoogleNews: () => runGoogleNews,
	runRss: () => runRss
});
var DEF = new Map(SOURCE_REGISTRY.map((s) => [s.id, s]));
function def(id) {
	const d = DEF.get(id);
	if (!d) throw new Error(`unknown source ${id}`);
	return d;
}
function nowIso(opts) {
	return new Date(opts.now ?? Date.now()).toISOString();
}
function dedupe(items) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const it of items) {
		if (!it || seen.has(it.id)) continue;
		seen.add(it.id);
		out.push(tagItem(it));
	}
	return out;
}
async function runRss(id, opts) {
	const d = def(id);
	if (!d.url) return { items: [] };
	const res = await fetchWithPolicy(d.url, {
		sourceId: id,
		bypassCache: opts.bypassCache,
		accept: "application/rss+xml,application/atom+xml,application/xml,text/xml"
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const entries = parseFeed(res.text);
	if (!entries.length && !/<(rss|feed|rdf:RDF)[\s>]/i.test(res.text)) throw new Error("parse-fail");
	const fetchedAt = nowIso(opts);
	const bloomberg = id.startsWith("bloomberg-");
	return {
		items: dedupe(entries.slice(0, 60).map((e) => rssEntryToItem(e, {
			sourceId: id,
			sourceName: d.name,
			tier: d.tier,
			fetchedAt,
			region: d.region,
			lang: d.lang,
			kind: d.kind,
			topics: d.topics,
			paywalled: d.paywalled,
			zone: d.lang === "ko" ? "Asia/Seoul" : "UTC",
			headlineOnly: bloomberg
		}))),
		adapterPath: d.format === "atom" ? "rss" : "rss"
	};
}
var NAVER = "https://stock.naver.com";
async function runNaverList(id, url, opts, world = false) {
	const d = def(id);
	const json = await fetchJsonWithPolicy(url, {
		sourceId: id,
		bypassCache: opts.bypassCache
	});
	const rows = naverList(json);
	const fetchedAt = nowIso(opts);
	const ctx = {
		sourceId: id,
		sourceName: d.name,
		tier: d.tier,
		fetchedAt,
		region: d.region,
		topics: d.topics
	};
	const items = rows.slice(0, 40).map((r) => world ? mapNaverWorldNews(r, ctx) : mapNaverArticle(r, ctx));
	if (rows.length && !items.some(Boolean)) setHealthNote(id, "shape", "응답 구조가 예상과 다릅니다(필드 매핑 실패) — 소스 재검증 필요");
	else setHealthNote(id, "shape", null);
	return {
		items: dedupe(items),
		adapterPath: "v2"
	};
}
function naverFocusUrl(sid, page = 1, date = kstCompactDate()) {
	return `${NAVER}/api/domestic/news/focus?sid=${sid}&page=${page}&pageSize=15&date=${date}&enableFallback=true`;
}
var GN_QUERIES = {
	"gn-kr-market": [
		"코스피",
		"코스닥",
		"외국인 순매수",
		"증시 마감"
	].map((q) => ({
		q: `${q} when:1d`,
		locale: "ko"
	})),
	"gn-us-market": [
		"stock market today",
		"S&P 500",
		"Nasdaq",
		"Treasury yields"
	].map((q) => ({
		q: `${q} when:1d`,
		locale: "en"
	})),
	"gn-bloomberg": [{
		q: "site:bloomberg.com when:1d",
		locale: "en"
	}]
};
function googleNewsUrl(q, locale) {
	return locale === "ko" ? `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko` : `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
}
async function runGoogleNews(id, queries, opts, extra) {
	const d = def(id);
	const fetchedAt = nowIso(opts);
	const settled = await Promise.allSettled(queries.map(async ({ q, locale }) => {
		const res = await fetchWithPolicy(googleNewsUrl(q, locale), {
			sourceId: id,
			bypassCache: opts.bypassCache
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return parseFeed(res.text).slice(0, 25).map((e) => googleNewsEntryToItem(e, {
			sourceId: id,
			sourceName: d.name,
			tier: d.tier,
			fetchedAt,
			region: d.region,
			lang: locale,
			kind: d.kind,
			topics: [...d.topics ?? [], ...extra?.topics ?? []],
			paywalled: d.paywalled,
			query: q
		}));
	}));
	const ok = settled.filter((s) => s.status === "fulfilled");
	if (!ok.length) {
		const first = settled.find((s) => s.status === "rejected");
		throw first?.reason instanceof Error ? first.reason : /* @__PURE__ */ new Error("all queries failed");
	}
	return {
		items: dedupe(ok.flatMap((s) => s.value)),
		adapterPath: "rss"
	};
}
async function runDisclosures(opts) {
	const { fetchKrxDisclosureDesk } = await import("./krx-disclosures-CIF4Ihdf.mjs");
	const desk = await fetchKrxDisclosureDesk();
	if (!desk.all.length && !desk.kind.available) throw new Error(desk.kind.message || "KRX·DART 공시 응답 없음");
	const fetchedAt = nowIso(opts);
	const d = def("krx-disclosures");
	return {
		items: dedupe(desk.all.slice(0, 80).map((x) => disclosureToFeed({
			id: x.id,
			title: x.title,
			datetime: x.datetime,
			author: x.author,
			code: x.code ?? "",
			nameKo: x.nameKo,
			dartUrl: x.dartUrl ?? x.kindUrl,
			dartSearchUrl: x.dartSearchUrl ?? "https://dart.fss.or.kr/dsab007/main.do",
			canLoadBody: false,
			sourceLabel: x.sourceLabel
		}, {
			sourceId: d.id,
			sourceName: d.name,
			tier: 1,
			fetchedAt
		}))),
		adapterPath: "legacy"
	};
}
var KIS_BASE = "https://openapi.koreainvestment.com:9443";
var kisToken = null;
var kisLastTokenRequest = 0;
async function kisAccessToken() {
	if (kisToken && Date.now() < kisToken.expiresAt - 6e4) return kisToken.token;
	if (Date.now() - kisLastTokenRequest < 6e4) throw new Error("KIS token rate limit (1/min)");
	kisLastTokenRequest = Date.now();
	const res = await fetchWithPolicy(`${KIS_BASE}/oauth2/tokenP`, {
		sourceId: "kis-news-title",
		method: "POST",
		ttlMs: 0,
		headers: { "content-type": "application/json; charset=utf-8" },
		body: JSON.stringify({
			grant_type: "client_credentials",
			appkey: process.env.KIS_APP_KEY,
			appsecret: process.env.KIS_APP_SECRET
		})
	});
	if (!res.ok) throw new Error(`KIS token HTTP ${res.status}`);
	const j = JSON.parse(res.text);
	if (!j.access_token) throw new Error("KIS token missing");
	kisToken = {
		token: j.access_token,
		expiresAt: Date.now() + Math.max(600, j.expires_in ?? 3600) * 1e3
	};
	return kisToken.token;
}
async function runKisNews(opts) {
	const d = def("kis-news-title");
	const token = await kisAccessToken();
	const params = new URLSearchParams({
		FID_NEWS_OFER_ENTP_CODE: "",
		FID_COND_MRKT_CLS_CODE: "",
		FID_INPUT_ISCD: "",
		FID_TITL_CNTT: "",
		FID_INPUT_DATE_1: "",
		FID_INPUT_HOUR_1: "",
		FID_RANK_SORT_CLS_CODE: "",
		FID_INPUT_SRNO: ""
	});
	const res = await fetchWithPolicy(`${KIS_BASE}/uapi/domestic-stock/v1/quotations/news-title?${params}`, {
		sourceId: d.id,
		bypassCache: opts.bypassCache,
		headers: {
			"content-type": "application/json; charset=utf-8",
			authorization: `Bearer ${token}`,
			appkey: process.env.KIS_APP_KEY ?? "",
			appsecret: process.env.KIS_APP_SECRET ?? "",
			tr_id: "FHKST01011800",
			custtype: "P"
		}
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const j = JSON.parse(res.text);
	if (j.rt_cd && j.rt_cd !== "0") throw new Error(`KIS ${j.rt_cd} ${j.msg1 ?? ""}`.trim());
	const rows = Array.isArray(j.output) ? j.output : [];
	const fetchedAt = nowIso(opts);
	return {
		items: dedupe(rows.slice(0, 60).map((r) => kisNewsRowToItem(r, {
			sourceId: d.id,
			sourceName: d.name,
			tier: d.tier,
			fetchedAt
		}))),
		adapterPath: "json"
	};
}
async function runFinnhub(opts) {
	const d = def("finnhub-news");
	const key = process.env.FINNHUB_API_KEY ?? "";
	const rows = await fetchJsonWithPolicy(`https://finnhub.io/api/v1/news?category=general&token=${encodeURIComponent(key)}`, {
		sourceId: d.id,
		bypassCache: opts.bypassCache
	});
	const fetchedAt = nowIso(opts);
	return {
		items: dedupe((Array.isArray(rows) ? rows : []).slice(0, 60).map((r) => finnhubRowToItem(r, {
			sourceId: d.id,
			sourceName: d.name,
			tier: d.tier,
			fetchedAt,
			region: "US",
			lang: "en"
		}))),
		adapterPath: "json"
	};
}
async function runSec8k(opts) {
	const d = def("sec-8k-atom");
	const res = await fetchWithPolicy(d.url, {
		sourceId: d.id,
		bypassCache: opts.bypassCache,
		accept: "application/atom+xml"
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const { cikTickerMap } = await import("./us-official-research-B2JCCI2h.mjs");
	const byCik = await cikTickerMap().catch(() => /* @__PURE__ */ new Map());
	const fetchedAt = nowIso(opts);
	return {
		items: dedupe(parseFeed(res.text).slice(0, 60).map((e) => {
			const it = rssEntryToItem(e, {
				sourceId: d.id,
				sourceName: d.name,
				tier: 1,
				fetchedAt,
				region: "US",
				lang: "en",
				kind: "filing",
				topics: ["filing"]
			});
			if (!it) return null;
			const cik = secAtomCik(e.title);
			const ticker = cik ? byCik.get(cik) : void 0;
			return ticker ? {
				...it,
				tickers: [{
					market: "US",
					code: ticker
				}]
			} : it;
		})),
		adapterPath: "rss"
	};
}
async function runStreetRatings(opts) {
	const { fetchUsStreetPack, originalUrlForNote } = await import("./us-street-Dx2s8JR4.mjs").then((n) => n.i);
	const pack = await fetchUsStreetPack();
	if (!pack.notes.length && !pack.headlines.length && !pack.consensus.length) throw new Error(pack.note.slice(0, 120));
	const d = def("finviz-ratings");
	const fetchedAt = nowIso(opts);
	return {
		items: dedupe(pack.notes.slice(0, 60).map((n) => {
			const orig = originalUrlForNote(n, pack.headlines);
			const title = `${n.symbol}: ${n.broker} ${n.action}${n.rating && n.rating !== "—" ? ` · ${n.rating}` : ""}${n.target ? ` · PT ${n.target}` : ""}`;
			return {
				id: `finviz-ratings:${n.id}`,
				kind: "rating",
				region: "US",
				sourceId: d.id,
				sourceName: d.name,
				sourceTier: 3,
				title,
				snippet: n.summary.slice(0, 240),
				url: orig.url,
				publishedAt: n.publishedAt,
				precision: n.precision,
				fetchedAt,
				seq: n.seq,
				tickers: [{
					market: "US",
					code: n.symbol
				}],
				sectors: [],
				topics: ["rating"],
				lang: "en"
			};
		})),
		adapterPath: "html"
	};
}
for (const s of SOURCE_REGISTRY) if ((s.format === "rss" || s.format === "atom") && s.url && !s.builder && s.id !== "sec-8k-atom") registerAdapter(s.id, (o) => runRss(s.id, o));
registerAdapter("naver-flash", (o) => runNaverList("naver-flash", `${NAVER}/api/domestic/news/list?category=FLASHNEWS&page=1&pageSize=15`, o));
registerAdapter("naver-main", (o) => runNaverList("naver-main", `${NAVER}/api/domestic/news/list?category=MAINNEWS&page=1&pageSize=15`, o));
for (const sid of [
	"401",
	"402",
	"403",
	"404",
	"406",
	"429"
]) registerAdapter(`naver-focus-${sid}`, (o) => runNaverList(`naver-focus-${sid}`, naverFocusUrl(sid, 1, kstCompactDate(o.now)), o));
registerAdapter("naver-worldnews", (o) => runNaverList("naver-worldnews", `${NAVER}/api/foreign/news/worldNews?page=1&pageSize=15&date=${kstCompactDate(o.now)}`, o, true));
registerAdapter("naver-news-search-etf", (o) => runNaverList("naver-news-search-etf", `${NAVER}/api/domestic/news/search?query=ETF&page=1&pageSize=20`, o));
for (const [id, queries] of Object.entries(GN_QUERIES)) registerAdapter(id, (o) => runGoogleNews(id, queries, o));
registerAdapter("krx-disclosures", runDisclosures);
registerAdapter("kis-news-title", runKisNews);
registerAdapter("finnhub-news", runFinnhub);
registerAdapter("sec-8k-atom", runSec8k);
registerAdapter("finviz-ratings", runStreetRatings);
//#endregion
export { news_DxJZGpZd_exports as n, tagUsTickers as r, buildUsTickerIndex as t };
