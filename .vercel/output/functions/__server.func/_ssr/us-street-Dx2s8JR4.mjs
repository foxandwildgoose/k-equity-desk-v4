import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { l as zonedParts, u as zonedWallToUtcMs } from "./time-By5ScNNo.mjs";
import { t as compareNewestFirst } from "./mappers-DlpCqw-E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/us-street-Dx2s8JR4.js
var us_street_exports = /* @__PURE__ */ __exportAll({
	US_STREET_SYMBOLS: () => US_STREET_SYMBOLS,
	actionKo: () => actionKo,
	emptyUsStreetPack: () => emptyUsStreetPack,
	fetchUsStreetPack: () => fetchUsStreetPack,
	fetchUsStreetSymbol: () => fetchUsStreetSymbol,
	finvizEventTime: () => finvizEventTime,
	originalUrlForNote: () => originalUrlForNote,
	parseFinvizHeadlines: () => parseFinvizHeadlines,
	parseFinvizRatings: () => parseFinvizRatings,
	parseFinvizWhen: () => parseFinvizWhen,
	parseNasdaqTarget: () => parseNasdaqTarget,
	safeExternalUrl: () => safeExternalUrl,
	sortHeadlinesNewestFirst: () => sortHeadlinesNewestFirst,
	sortNotesNewestFirst: () => sortNotesNewestFirst
});
var US_STREET_SYMBOLS = [
	"NVDA",
	"AAPL",
	"MSFT",
	"AMZN",
	"GOOGL",
	"META",
	"AVGO",
	"TSLA",
	"AMD",
	"TSM"
];
var ANALYST_HEADLINE = /upgrade|downgrade|price target|initiates|reiterate|overweight|outperform|underweight|goldman|morgan stanley|jpmorgan|bank of america|barclays|wells fargo|\bubs\b|citi|deutsche|hsbc|jefferies|piper|evercore|cowen|bofa|target price/i;
function actionKo(action) {
	const a = action.toLowerCase();
	if (a.includes("upgrade")) return "상향";
	if (a.includes("downgrade")) return "하향";
	if (a.includes("initiat")) return "개시";
	if (a.includes("reiterat")) return "유지";
	return action.trim() || "의견";
}
function cleanText(raw) {
	return raw.replace(/\\u0026rarr;|\\u0026rArr;|\\u0026amp;/gi, (token) => /amp/i.test(token) ? "&" : "→").replace(/\u0026amp;/gi, "&").replace(/\u0026nbsp;/gi, " ").replace(/\u0026#39;|\u0026apos;/gi, "'").replace(/\u0026quot;/gi, "\"").replace(/\u0026rarr;|\u0026rArr;|&#8594;/gi, "→").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function isoDate(seconds) {
	if (!Number.isFinite(seconds) || seconds < 1e9) return null;
	const d = /* @__PURE__ */ new Date(seconds * 1e3);
	if (Number.isNaN(d.getTime())) return null;
	return d.toISOString().slice(0, 10);
}
/** Finviz event timestamp → ISO; midnight-UTC stamps are day-precision. */
function finvizEventTime(seconds) {
	if (!Number.isFinite(seconds) || seconds < 1e9) return {
		iso: null,
		precision: "unknown"
	};
	if (seconds % 86400 === 0) return {
		iso: `${(/* @__PURE__ */ new Date(seconds * 1e3)).toISOString().slice(0, 10)}T12:00:00.000Z`,
		precision: "day"
	};
	return {
		iso: (/* @__PURE__ */ new Date(seconds * 1e3)).toISOString(),
		precision: "second"
	};
}
var MONTHS = {
	Jan: 1,
	Feb: 2,
	Mar: 3,
	Apr: 4,
	May: 5,
	Jun: 6,
	Jul: 7,
	Aug: 8,
	Sep: 9,
	Oct: 10,
	Nov: 11,
	Dec: 12
};
/**
* Finviz news `when` → ISO. Formats: `Today 09:35AM`, `Yesterday 04:10PM`,
* `Sep-24-26 08:00AM` (ET wall time). Unknown → null.
*/
function parseFinvizWhen(when, now = Date.now()) {
	const m = when.trim().match(/^(Today|Yesterday|([A-Z][a-z]{2})-(\d{2})-(\d{2}))\s+(\d{1,2}):(\d{2})(AM|PM)$/);
	if (!m) return {
		iso: null,
		precision: "unknown"
	};
	let h = Number(m[5]) % 12;
	if (m[7] === "PM") h += 12;
	const mi = Number(m[6]);
	let y;
	let mo;
	let d;
	if (m[1] === "Today" || m[1] === "Yesterday") {
		const p = zonedParts(now - (m[1] === "Yesterday" ? 864e5 : 0), "America/New_York");
		[y, mo, d] = [
			p.y,
			p.m,
			p.d
		];
	} else {
		mo = MONTHS[m[2]] ?? 0;
		d = Number(m[3]);
		y = 2e3 + Number(m[4]);
		if (!mo) return {
			iso: null,
			precision: "unknown"
		};
	}
	const ms = zonedWallToUtcMs(y, mo, d, h, mi, 0, "America/New_York");
	return Number.isFinite(ms) ? {
		iso: new Date(ms).toISOString(),
		precision: "minute"
	} : {
		iso: null,
		precision: "unknown"
	};
}
function parseFinvizRatings(html, symbol) {
	const ticker = symbol.trim().toUpperCase();
	const re = /"dateTimestamp":(\d+),"eventType":"chartEvent\/ratings","ratings":(\[[\s\S]*?\])\}/g;
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const match of html.matchAll(re)) {
		const date = isoDate(Number(match[1]));
		if (!date) continue;
		const when = finvizEventTime(Number(match[1]));
		let rows = [];
		try {
			rows = JSON.parse(match[2]);
		} catch {
			continue;
		}
		for (const row of rows) {
			const broker = cleanText(String(row.analyst ?? ""));
			const action = cleanText(String(row.action ?? ""));
			const rating = cleanText(String(row.rating ?? ""));
			if (!broker || !action) continue;
			const target = cleanText(String(row.targetPrice ?? "")) || null;
			const id = `${ticker}|${date}|${broker}|${action}|${rating}`;
			if (seen.has(id)) continue;
			seen.add(id);
			const targetBit = target ? ` 목표가 ${target}.` : " 목표가는 이 행에 없습니다.";
			out.push({
				id,
				symbol: ticker,
				broker,
				action,
				actionKo: actionKo(action),
				rating: rating || "—",
				target,
				date,
				publishedAt: when.iso,
				precision: when.precision,
				seq: 0,
				summary: `${broker}가 등급을 ${actionKo(action)}했습니다. 표시된 등급은 ${rating || "미기재"}입니다.${targetBit} 증권사 PDF 원문은 공개되어 있지 않습니다.`,
				pageUrl: `https://finviz.com/quote.ashx?t=${encodeURIComponent(ticker)}`,
				sourceLabel: "Finviz 공개 등급 테이블"
			});
		}
	}
	out.forEach((n, i) => n.seq = out.length - i);
	return sortNotesNewestFirst(out);
}
function noteKey(n) {
	return {
		id: n.id,
		publishedAt: n.publishedAt,
		precision: n.precision,
		seq: n.seq,
		sourceTier: 3
	};
}
/** D1c: notes newest first by event time (kernel), not by ticker. */
function sortNotesNewestFirst(notes) {
	return [...notes].sort((a, b) => compareNewestFirst(noteKey(a), noteKey(b)));
}
/** D1c: headlines newest first across symbols (kernel), before any cap. */
function sortHeadlinesNewestFirst(items) {
	return [...items].sort((a, b) => compareNewestFirst({
		id: a.id,
		publishedAt: a.publishedAt,
		precision: a.precision,
		sourceTier: 3
	}, {
		id: b.id,
		publishedAt: b.publishedAt,
		precision: b.precision,
		sourceTier: 3
	}));
}
function parseFinvizHeadlines(html, symbol, now = Date.now()) {
	const ticker = symbol.trim().toUpperCase();
	const re = /<a class="tab-link-news" href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const match of html.matchAll(re)) {
		const url = match[1];
		const title = cleanText(match[2] ?? "");
		if (!title || !ANALYST_HEADLINE.test(title)) continue;
		if (seen.has(url)) continue;
		seen.add(url);
		const when = html.slice(Math.max(0, match.index - 280), match.index).match(/((?:Today|Yesterday)\s+\d{1,2}:\d{2}[AP]M|[A-Z][a-z]{2}-\d{2}-\d{2}\s+\d{1,2}:\d{2}[AP]M)/)?.[1] ?? "";
		const parsed = when ? parseFinvizWhen(when, now) : {
			iso: null,
			precision: "unknown"
		};
		out.push({
			id: `${ticker}|${url}`,
			symbol: ticker,
			title,
			source: "기사",
			url,
			when: when || "시각 미상",
			publishedAt: parsed.iso,
			precision: parsed.precision
		});
		if (out.length >= 6) break;
	}
	return out;
}
function num(v) {
	const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
	return Number.isFinite(n) ? n : null;
}
function parseNasdaqTarget(json, symbol) {
	const ticker = symbol.trim().toUpperCase();
	const overview = (json && typeof json === "object" ? json : null)?.data?.consensusOverview;
	if (!overview) return null;
	const mean = num(overview.priceTarget);
	const low = num(overview.lowPriceTarget);
	const high = num(overview.highPriceTarget);
	const buy = num(overview.buy) ?? 0;
	const hold = num(overview.hold) ?? 0;
	const sell = num(overview.sell) ?? 0;
	if (mean == null && buy + hold + sell === 0) return null;
	return {
		symbol: ticker,
		mean,
		low,
		high,
		buy,
		hold,
		sell,
		summary: `${ticker} ${mean == null ? "목표가 평균 없음" : `평균 목표가 $${mean.toFixed(2)}`}${low != null && high != null ? ` (하단 $${low.toFixed(2)} · 상단 $${high.toFixed(2)})` : ""}. 매수 ${buy} · 보유 ${hold} · 매도 ${sell}. Nasdaq에 모인 공개 추정치이며 개별 투자은행 보고서 전문이 아닙니다.`,
		pageUrl: `https://www.nasdaq.com/market-activity/stocks/${ticker.toLowerCase()}/analyst-research`
	};
}
function safeExternalUrl(raw) {
	if (!raw) return null;
	try {
		const url = new URL(raw);
		if (url.protocol !== "https:" && url.protocol !== "http:") return null;
		return url.toString();
	} catch {
		return null;
	}
}
var BROKER_NEEDLES = [
	{
		test: /j\.?\s*p\.?\s*morgan|jpmorgan|\bjpm\b/i,
		keys: [
			"jpmorgan",
			"jp morgan",
			"j.p. morgan"
		]
	},
	{
		test: /goldman/i,
		keys: ["goldman"]
	},
	{
		test: /morgan stanley/i,
		keys: ["morgan stanley"]
	},
	{
		test: /bank of america|\bbofa\b|\bb of a\b/i,
		keys: ["bofa", "bank of america"]
	},
	{
		test: /barclays/i,
		keys: ["barclays"]
	},
	{
		test: /wells fargo/i,
		keys: ["wells fargo"]
	},
	{
		test: /citigroup|\bciti\b/i,
		keys: ["citi", "citigroup"]
	},
	{
		test: /\bubs\b/i,
		keys: ["ubs"]
	},
	{
		test: /hsbc/i,
		keys: ["hsbc"]
	},
	{
		test: /jefferies/i,
		keys: ["jefferies"]
	},
	{
		test: /evercore/i,
		keys: ["evercore"]
	},
	{
		test: /deutsche/i,
		keys: ["deutsche"]
	},
	{
		test: /piper/i,
		keys: ["piper"]
	}
];
function brokerNeedles(broker) {
	const keys = /* @__PURE__ */ new Set();
	const token = broker.toLowerCase().split(/[^a-z0-9]+/).find((word) => word.length >= 4);
	if (token) keys.add(token);
	for (const row of BROKER_NEEDLES) {
		if (!row.test.test(broker)) continue;
		for (const key of row.keys) keys.add(key);
	}
	return [...keys];
}
/** Prefer the article that names the broker. The ratings table stays as the second link. */
function originalUrlForNote(note, headlines) {
	const needles = brokerNeedles(note.broker);
	const article = headlines.find((item) => {
		if (item.symbol !== note.symbol) return false;
		if (!safeExternalUrl(item.url)) return false;
		const title = item.title.toLowerCase();
		return needles.some((needle) => title.includes(needle));
	});
	const tableUrl = note.pageUrl;
	const articleUrl = article ? article.url : null;
	if (articleUrl) return {
		url: articleUrl,
		kind: "article",
		articleUrl,
		tableUrl
	};
	return {
		url: tableUrl,
		kind: "table",
		articleUrl: null,
		tableUrl
	};
}
var EMPTY_NOTE = "미국 투자은행 PDF는 고객에게만 배포됩니다. 여기에는 Finviz에 올라온 등급·목표가 변경과, 제목이 애널리스트 의견인 기사 원문, Nasdaq 컨센서스만 표시합니다. 없는 보고서는 만들지 않습니다.";
function emptyUsStreetPack(note = EMPTY_NOTE) {
	return {
		notes: [],
		headlines: [],
		consensus: [],
		note,
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
async function getText(url, headers) {
	try {
		const res = await fetch(url, {
			headers,
			signal: AbortSignal.timeout(12e3)
		});
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	}
}
var packCache = /* @__PURE__ */ new Map();
var TTL_MS = 12e5;
var CACHE_REV = "kernel-3";
/** At most 3 symbol pages load at once (F4.5 load control). */
var MAX_CONCURRENT = 3;
async function mapLimit(items, limit, fn) {
	const out = new Array(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i]);
		}
	});
	await Promise.all(workers);
	return out;
}
var pageCache = /* @__PURE__ */ new Map();
async function loadSymbolPage(symbol) {
	const ticker = symbol.trim().toUpperCase();
	const hit = pageCache.get(ticker);
	if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
	const data = await loadSymbolPageUncached(ticker);
	if (data.notes.length || data.consensus || data.headlines.length) {
		pageCache.set(ticker, {
			at: Date.now(),
			data
		});
		if (pageCache.size > 120) pageCache.delete(pageCache.keys().next().value);
	}
	return data;
}
async function loadSymbolPageUncached(ticker) {
	const [html, target] = await Promise.all([getText(`https://finviz.com/quote.ashx?t=${encodeURIComponent(ticker)}`, {
		"User-Agent": UA,
		Accept: "text/html"
	}), getText(`https://api.nasdaq.com/api/analyst/${encodeURIComponent(ticker)}/targetprice`, {
		"User-Agent": UA,
		Accept: "application/json",
		Origin: "https://www.nasdaq.com",
		Referer: "https://www.nasdaq.com/"
	})]);
	let consensus = null;
	if (target) try {
		consensus = parseNasdaqTarget(JSON.parse(target), ticker);
	} catch {
		consensus = null;
	}
	return {
		notes: html ? parseFinvizRatings(html, ticker) : [],
		headlines: html ? parseFinvizHeadlines(html, ticker) : [],
		consensus
	};
}
function packFromPages(pages, emptyNote) {
	const notes = sortNotesNewestFirst(pages.flatMap((page) => page.notes)).slice(0, 60);
	const headlines = sortHeadlinesNewestFirst(pages.flatMap((page) => page.headlines)).slice(0, 40);
	const consensus = pages.flatMap((page) => page.consensus ? [page.consensus] : []);
	return {
		notes,
		headlines,
		consensus,
		note: notes.length || headlines.length || consensus.length ? EMPTY_NOTE : emptyNote,
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
var symbolCache = /* @__PURE__ */ new Map();
async function fetchUsStreetSymbol(symbol) {
	const ticker = symbol.trim().toUpperCase();
	if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(ticker) || ticker.startsWith(".") || ticker.endsWith(".")) return emptyUsStreetPack("미국 티커로 읽지 못했습니다. 등급을 추정해 채우지 않습니다.");
	const now = Date.now();
	const hit = symbolCache.get(ticker);
	if (hit && hit.rev === CACHE_REV && now - hit.at < TTL_MS) return hit.data;
	const page = await loadSymbolPage(ticker);
	const data = packFromPages([page], `${ticker}의 공개 등급·컨센서스를 받지 못했습니다. 없는 보고서는 만들지 않습니다.`);
	if (page.notes.length || page.consensus) symbolCache.set(ticker, {
		rev: CACHE_REV,
		at: now,
		data
	});
	return data;
}
function validTicker(t) {
	return /^[A-Z][A-Z0-9.]{0,9}$/.test(t) && !t.startsWith(".") && !t.endsWith(".");
}
/**
* Desk pack for a ticker set (default: US_STREET_SYMBOLS). Callers pass the
* first 12 of usWatchlist ∪ US_STREET_SYMBOLS ∪ robotics US names (F4.5);
* pages load 3 at a time and are cached for 20 minutes.
*/
async function fetchUsStreetPack(symbols = US_STREET_SYMBOLS) {
	const list = [...new Set(symbols.map((x) => x.trim().toUpperCase()).filter(validTicker))].slice(0, 12);
	const key = list.join(",");
	const now = Date.now();
	const hit = packCache.get(key);
	if (hit && hit.rev === CACHE_REV && now - hit.at < TTL_MS) return hit.data;
	const data = packFromPages(await mapLimit(list, MAX_CONCURRENT, (symbol) => loadSymbolPage(symbol)), "월가 공개 피드를 받지 못했습니다. 등급을 추정해 채우지 않습니다.");
	if (data.notes.length || data.consensus.length) {
		packCache.set(key, {
			rev: CACHE_REV,
			at: now,
			data
		});
		if (packCache.size > 20) packCache.delete(packCache.keys().next().value);
	}
	return data;
}
//#endregion
export { us_street_exports as i, originalUrlForNote as n, safeExternalUrl as r, US_STREET_SYMBOLS as t };
