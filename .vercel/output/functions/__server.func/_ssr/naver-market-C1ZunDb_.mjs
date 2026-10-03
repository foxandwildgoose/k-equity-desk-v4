import { r as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as htmlToReadableText } from "./readable-text-D28LomX7.mjs";
import { d as normalizeKrTicker, l as isKrTicker, o as inferSectorId, t as UNIVERSE } from "./universe-BLkYDatc.mjs";
import { d as sortReportsNewestFirst } from "./mappers-DlpCqw-E.mjs";
import { a as classifyResearchSectors, v as yahooUsSymbol } from "./research-taxonomy-BpoDpMeG.mjs";
import { n as buildResearchExecutiveSummary } from "./research-utils-_RqvZcrM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/naver-market-C1ZunDb_.js
var naver_market_C1ZunDb__exports = /* @__PURE__ */ __exportAll({
	a: () => fetchNews,
	c: () => fetchResearchDesk,
	d: () => fetchStockBasic,
	f: () => naver_market_exports,
	i: () => fetchInvestorFlow,
	l: () => fetchResearchPack,
	n: () => fetchDisclosureDetail,
	o: () => fetchOhlc,
	r: () => fetchIndices,
	s: () => fetchRealtimeQuotes,
	t: () => fetchAllUniverseQuotes,
	u: () => fetchResearchPdf
});
/**
* Live Korean market data adapters (Naver Finance + Yahoo Finance + DART).
* Quotes/indices: KRX via Naver realtime (exchange feed). Charts: Yahoo + Naver day fallback.
* Server-only — called from createServerFn handlers. No synthetic prices.
*/
var naver_market_exports = /* @__PURE__ */ __exportAll$1({
	enrichResearchFromPage: () => enrichResearchFromPage,
	fetchAllUniverseQuotes: () => fetchAllUniverseQuotes,
	fetchCategoryResearch: () => fetchCategoryResearch,
	fetchDisclosureDetail: () => fetchDisclosureDetail,
	fetchIndices: () => fetchIndices,
	fetchInvestorFlow: () => fetchInvestorFlow,
	fetchNews: () => fetchNews,
	fetchOhlc: () => fetchOhlc,
	fetchRealtimeQuotes: () => fetchRealtimeQuotes,
	fetchResearchDesk: () => fetchResearchDesk,
	fetchResearchList: () => fetchResearchList,
	fetchResearchPack: () => fetchResearchPack,
	fetchResearchPdf: () => fetchResearchPdf,
	fetchStockBasic: () => fetchStockBasic
});
var UA = "Mozilla/5.0 (compatible; KoreaEquityCommand/1.0; +https://x.ai) AppleWebKit/537.36";
function headers(extra) {
	return {
		"User-Agent": UA,
		Accept: "application/json,text/plain,*/*",
		"Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
		Referer: "https://m.stock.naver.com/",
		...extra
	};
}
async function getText(url, init) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 1e4);
	try {
		const res = await fetch(url, {
			...init,
			headers: {
				...headers(),
				...init?.headers
			},
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
		return await res.text();
	} finally {
		clearTimeout(timer);
	}
}
async function getJson(url) {
	return JSON.parse(await getText(url));
}
async function getEucKr(url) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 8e3);
	try {
		const res = await fetch(url, {
			headers: headers({ Referer: "https://finance.naver.com/" }),
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const buf = Buffer.from(await res.arrayBuffer());
		try {
			return new TextDecoder("euc-kr").decode(buf);
		} catch {
			return buf.toString("utf8");
		}
	} finally {
		clearTimeout(timer);
	}
}
function num(v) {
	if (typeof v === "number" && Number.isFinite(v)) return v;
	if (typeof v === "string") {
		const n = Number(v.replace(/[+,]/g, "").trim());
		return Number.isFinite(n) ? n : 0;
	}
	return 0;
}
function parseSignedShares(v) {
	if (v == null) return 0;
	if (typeof v === "number") return v;
	return num(v);
}
function sma(closes, end, period, round = true) {
	if (end + 1 < period) return void 0;
	let sum = 0;
	for (let i = end - period + 1; i <= end; i++) sum += closes[i];
	const value = sum / period;
	return round ? Math.round(value) : value;
}
function withMas(bars, opts) {
	const round = opts?.round !== false;
	const closes = bars.map((b) => b.close);
	return bars.map((bar, i) => ({
		...bar,
		ma5: sma(closes, i, 5, round),
		ma20: sma(closes, i, 20, round),
		ma60: sma(closes, i, 60, round),
		ma120: sma(closes, i, 120, round)
	}));
}
function yahooSymbol(code, market) {
	return `${code}.${market === "KOSDAQ" ? "KQ" : "KS"}`;
}
function yahooSymbolCandidates(code, market) {
	return [yahooSymbol(code, market), market === "KOSDAQ" ? `${code}.KS` : `${code}.KQ`];
}
function dartSearchUrl(nameOrCode) {
	return `https://dart.fss.or.kr/dsab001/main.do?autoSearch=Y&textCrpNm=${encodeURIComponent(nameOrCode)}`;
}
function dartViewerUrl(rcpNo) {
	return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcpNo}`;
}
function extractRcpNo(html) {
	return (html.match(/rcpNo[=:](\d{14})/i) || html.match(/rcpno[=:](\d{14})/i) || html.match(/acptno[=:](\d{14})/i))?.[1];
}
function htmlToText(html) {
	return htmlToReadableText(html);
}
function sanitizeDisclosureHtml(html, rcpNo) {
	let out = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/javascript:/gi, "");
	out = out.replace(/https?:\/\/kind\.krx\.or\.kr[^"'\\\s>]*/gi, rcpNo ? dartViewerUrl(rcpNo) : "https://dart.fss.or.kr/");
	return out;
}
/** Drop empty / placeholder ratings like "없음" */
function normalizeRating(raw) {
	if (raw == null) return void 0;
	const u = raw.trim();
	if (!u || u === "-" || u === "—" || u === "없음" || u === "N/A" || u === "n/a") return;
	const up = u.toUpperCase();
	if (up === "BUY" || u === "매수" || u.includes("매수") && !u.includes("축소")) return u.includes("비중확대") ? "비중확대" : "매수";
	if (up === "HOLD" || u === "중립" || u.includes("중립")) return "중립";
	if (up === "SELL" || u === "매도" || u.includes("매도")) return "매도";
	if (u.includes("비중확대") || up === "OUTPERFORM" || up === "OVERWEIGHT") return "비중확대";
	if (u.includes("비중축소") || up === "UNDERPERFORM" || up === "UNDERWEIGHT") return "비중축소";
	if (up.includes("TRADING")) return "단기매수";
	return u;
}
function extractTargetAndRating(text) {
	let targetPrice;
	let rating;
	for (const re of [
		/목표주가\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/,
		/목표\s*주가\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/,
		/목표주가\s*([0-9]{4,})\s*원/,
		/목표주가를?\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/,
		/TP\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/i,
		/목표주가\s*([0-9]{1,3}(?:,[0-9]{3})*)/
	]) {
		const m = text.match(re);
		if (m) {
			const n = num(m[1]);
			if (n >= 1e3) {
				targetPrice = n;
				break;
			}
		}
	}
	for (const re of [
		/투자의견\s*[:：]?\s*(매수|중립|매도|비중확대|비중축소|Buy|Hold|Sell|BUY|HOLD|SELL|OUTPERFORM|UNDERPERFORM|OVERWEIGHT|UNDERWEIGHT)/i,
		/\[투자의견\][^\n]{0,60}(매수|중립|매도|비중확대|비중축소|BUY|HOLD|SELL)/i,
		/투자의견\s+(BUY|HOLD|SELL|매수|중립|매도)/i
	]) {
		const m = text.match(re);
		if (m) {
			rating = normalizeRating(m[1]);
			if (rating) break;
		}
	}
	return {
		targetPrice,
		rating
	};
}
async function fetchRealtimeQuotes(codes, metaByCode) {
	const unique = [...new Set(codes.map((c) => normalizeKrTicker(c)).filter((c) => isKrTicker(c)))];
	const batches = [];
	for (let i = 0; i < unique.length; i += 40) batches.push(unique.slice(i, i + 40));
	const rows = [];
	const batchResults = await Promise.all(batches.map(async (batch) => {
		const url = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${batch.join(",")}`;
		try {
			return (await getJson(url)).result?.areas?.[0]?.datas ?? [];
		} catch {
			return (await Promise.all(batch.map(async (code) => {
				try {
					const basic = await getJson(`https://m.stock.naver.com/api/stock/${code}/basic`);
					return {
						cd: code,
						nm: String(basic.stockName ?? ""),
						nv: num(String(basic.closePrice ?? "0").replace(/,/g, "")),
						cv: num(String(basic.compareToPreviousClosePrice ?? "0").replace(/,/g, "")),
						cr: num(basic.fluctuationsRatio),
						aq: num(String(basic.accumulatedTradingVolume ?? "0").replace(/,/g, "")),
						ms: String(basic.marketStatus ?? "")
					};
				} catch {
					return null;
				}
			}))).filter((x) => x != null);
		}
	}));
	for (const part of batchResults) rows.push(...part);
	const out = [];
	for (const r of rows) {
		const code = normalizeKrTicker(String(r.cd));
		const u = UNIVERSE.find((x) => x.code === code);
		const meta = metaByCode?.[code] ?? metaByCode?.[String(r.cd)];
		const price = num(r.nv);
		const listed = num(r.countOfListedStock);
		const marketCapEok = listed > 0 ? Math.round(listed * price / 1e8) : r.aa ? Math.round(num(r.aa) / 1e8) : 0;
		const ah = r.nxtOverMarketPriceInfo;
		out.push({
			code,
			nameKo: u?.nameKo ?? meta?.nameKo ?? r.nm ?? code,
			nameEn: u?.nameEn ?? meta?.nameEn ?? code,
			sectorId: u?.sectorId ?? meta?.sectorId ?? inferSectorId(u?.nameKo ?? meta?.nameKo ?? r.nm ?? code),
			market: u?.market ?? meta?.market ?? "KOSPI",
			price,
			change: num(r.cv),
			changePct: num(r.cr),
			volume: num(r.aq),
			marketCap: marketCapEok,
			high52: num(r.highPriceOf52Weeks),
			low52: num(r.lowPriceOf52Weeks),
			open: num(r.ov),
			high: num(r.hv),
			low: num(r.lv),
			prevClose: num(r.pcv),
			afterHoursPrice: ah?.overPrice ? num(ah.overPrice.replace(/,/g, "")) : void 0,
			afterHoursChange: ah?.compareToPreviousClosePrice ? num(ah.compareToPreviousClosePrice.replace(/,/g, "")) : void 0,
			afterHoursChangePct: ah?.fluctuationsRatio ? num(ah.fluctuationsRatio) : void 0,
			marketStatus: r.ms ?? "",
			source: "naver-finance-snapshot"
		});
	}
	return out;
}
async function fetchAllUniverseQuotes() {
	return fetchRealtimeQuotes(UNIVERSE.map((u) => u.code));
}
/** Yahoo + optional Naver fchart for professional minute coverage. */
function yahooMinutePlan(minuteSize, range) {
	const size = minuteSize;
	if (size <= 1) return {
		yahooInterval: "1m",
		range: range && (/* @__PURE__ */ new Set([
			"1d",
			"5d",
			"7d"
		])).has(range) ? range : "7d",
		bucket: 1
	};
	if (size === 3) return {
		yahooInterval: "1m",
		range: range && (/* @__PURE__ */ new Set([
			"1d",
			"5d",
			"7d"
		])).has(range) ? range : "7d",
		bucket: 3
	};
	if (size === 5) return {
		yahooInterval: "5m",
		range: range && (/* @__PURE__ */ new Set([
			"1d",
			"5d",
			"1mo",
			"60d"
		])).has(range) ? range : "60d",
		bucket: 1
	};
	if (size === 10) return {
		yahooInterval: "5m",
		range: range && (/* @__PURE__ */ new Set([
			"1d",
			"5d",
			"1mo",
			"60d"
		])).has(range) ? range : "60d",
		bucket: 2
	};
	if (size === 15) return {
		yahooInterval: "15m",
		range: range && (/* @__PURE__ */ new Set([
			"1d",
			"5d",
			"1mo",
			"60d"
		])).has(range) ? range : "60d",
		bucket: 1
	};
	if (size === 30) return {
		yahooInterval: "30m",
		range: range && (/* @__PURE__ */ new Set([
			"5d",
			"1mo",
			"60d"
		])).has(range) ? range : "60d",
		bucket: 1
	};
	return {
		yahooInterval: "60m",
		range: range && (/* @__PURE__ */ new Set([
			"1mo",
			"3mo",
			"6mo",
			"1y",
			"2y"
		])).has(range) ? range : "1y",
		bucket: 1
	};
}
function bucketMinuteBars(raw, size) {
	if (size <= 1) return raw;
	const buckets = /* @__PURE__ */ new Map();
	for (const bar of raw) {
		const [ymd, hm] = bar.date.split(" ");
		if (!ymd || !hm) continue;
		const [hh, mm] = hm.split(":").map(Number);
		if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
		const total = hh * 60 + mm;
		const floored = Math.floor(total / size) * size;
		const bh = Math.floor(floored / 60);
		const bm = floored % 60;
		const key = `${ymd} ${String(bh).padStart(2, "0")}:${String(bm).padStart(2, "0")}`;
		const list = buckets.get(key) ?? [];
		list.push(bar);
		buckets.set(key, list);
	}
	const grouped = [];
	for (const [key, chunk] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
		const first = chunk[0];
		const last = chunk[chunk.length - 1];
		grouped.push({
			date: key,
			label: key.slice(5),
			open: first.open,
			high: Math.max(...chunk.map((x) => x.high)),
			low: Math.min(...chunk.map((x) => x.low)),
			close: last.close,
			volume: chunk.reduce((sum, x) => sum + x.volume, 0),
			bullish: last.close >= first.open
		});
	}
	return grouped;
}
function parseYahooMinuteResult(result) {
	const q = result.indicators.quote[0];
	const raw = [];
	for (let i = 0; i < result.timestamp.length; i++) {
		const o = q.open[i];
		const h = q.high[i];
		const l = q.low[i];
		const c = q.close[i];
		const v = q.volume[i];
		if (o == null || h == null || l == null || c == null) continue;
		const kst = /* @__PURE__ */ new Date(result.timestamp[i] * 1e3 + 324e5);
		const hh = String(kst.getUTCHours()).padStart(2, "0");
		const mm = String(kst.getUTCMinutes()).padStart(2, "0");
		const ymd = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
		raw.push({
			date: `${ymd} ${hh}:${mm}`,
			label: `${ymd.slice(5)} ${hh}:${mm}`,
			open: Math.round(o),
			high: Math.round(h),
			low: Math.round(l),
			close: Math.round(c),
			volume: Math.round(v ?? 0),
			bullish: c >= o
		});
	}
	return raw;
}
/** Naver fchart minute fallback (often close-only; reconstruct OHLC). */
async function fetchNaverMinuteFchart(code) {
	try {
		const items = [...(await getText(`https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=minute&count=5000&requestType=0`)).matchAll(/item data="([^"]+)"/g)].map((m) => m[1]);
		const raw = [];
		for (const row of items) {
			const [dt, o, h, l, c, v] = row.split("|");
			if (!dt || dt.length < 12) continue;
			const ymd = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
			const hm = `${dt.slice(8, 10)}:${dt.slice(10, 12)}`;
			const close = num(c);
			if (!close) continue;
			const open = o && o !== "null" ? num(o) : close;
			const high = h && h !== "null" ? num(h) : close;
			const low = l && l !== "null" ? num(l) : close;
			raw.push({
				date: `${ymd} ${hm}`,
				label: `${ymd.slice(5)} ${hm}`,
				open,
				high: Math.max(high, open, close),
				low: Math.min(low, open, close),
				close,
				volume: num(v),
				bullish: close >= open
			});
		}
		return raw;
	} catch {
		return [];
	}
}
async function fetchMinuteOhlc(code, market, minuteSize, range) {
	const symbols = yahooSymbolCandidates(code, market);
	const plan = yahooMinutePlan(minuteSize, range);
	const tryRanges = [plan.range];
	if (plan.yahooInterval === "1m") {
		for (const r of [
			"7d",
			"5d",
			"1d"
		]) if (!tryRanges.includes(r)) tryRanges.push(r);
	} else if (plan.yahooInterval === "60m") {
		for (const r of [
			"2y",
			"1y",
			"6mo",
			"3mo",
			"1mo"
		]) if (!tryRanges.includes(r)) tryRanges.push(r);
	} else for (const r of [
		"60d",
		"1mo",
		"5d",
		"1d"
	]) if (!tryRanges.includes(r)) tryRanges.push(r);
	let raw = [];
	let source = "yahoo-minute";
	for (const symbol of symbols) {
		for (const rng of tryRanges) try {
			const result = (await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${plan.yahooInterval}&range=${rng}&includePrePost=false`)).chart.result?.[0];
			if (!result?.timestamp?.length) continue;
			raw = parseYahooMinuteResult(result);
			if (raw.length) {
				source = `yahoo-${symbol}-${plan.yahooInterval}-${rng}`;
				break;
			}
		} catch {}
		if (raw.length) break;
	}
	if (raw.length < 30) {
		const naver = await fetchNaverMinuteFchart(code);
		if (naver.length > raw.length) {
			raw = naver;
			source = "naver-fchart-minute";
		}
	}
	if (!raw.length) return {
		bars: [],
		source: "minute-empty"
	};
	let grouped = raw;
	if (plan.yahooInterval === "1m" && minuteSize > 1) grouped = bucketMinuteBars(raw, minuteSize);
	else if (plan.yahooInterval === "5m" && minuteSize === 10) grouped = bucketMinuteBars(raw, 10);
	return {
		bars: withMas(grouped),
		source
	};
}
function wallClock(tsSec, withTime) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/New_York",
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		...withTime ? {
			hour: "2-digit",
			minute: "2-digit"
		} : {}
	}).formatToParts(/* @__PURE__ */ new Date(tsSec * 1e3));
	const g = (t) => parts.find((p) => p.type === t)?.value ?? "";
	const ymd = `${g("year")}-${g("month")}-${g("day")}`;
	if (!withTime) return ymd;
	return `${ymd} ${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
}
function roundPx(n) {
	return Math.round(n * 1e4) / 1e4;
}
function parseUsYahooBars(result, withTime) {
	const ts = result.timestamp ?? [];
	const q = result.indicators?.quote?.[0];
	if (!q || !ts.length) return [];
	const adj = result.indicators?.adjclose?.[0]?.adjclose ?? [];
	const raw = [];
	const seen = /* @__PURE__ */ new Set();
	for (let i = 0; i < ts.length; i++) {
		const o = q.open?.[i];
		const h = q.high?.[i];
		const l = q.low?.[i];
		const c = q.close?.[i];
		if (o == null || h == null || l == null || c == null) continue;
		if (!(c > 0)) continue;
		const stamp = ts[i];
		if (typeof stamp !== "number") continue;
		const factor = adj[i] != null && adj[i] > 0 ? adj[i] / c : 1;
		const open = roundPx(o * factor);
		const high = roundPx(Math.max(h, o, c) * factor);
		const low = roundPx(Math.min(l, o, c) * factor);
		const close = roundPx(c * factor);
		if (!(close > 0) || !(high > 0) || !(low > 0)) continue;
		const date = wallClock(stamp, withTime);
		if (!date || seen.has(date)) continue;
		seen.add(date);
		raw.push({
			date,
			label: withTime ? date.slice(5) : date.slice(5).replace("-", "/"),
			open,
			high: Math.max(high, open, close),
			low: Math.min(low, open, close),
			close,
			volume: Math.round(q.volume?.[i] ?? 0),
			bullish: close >= open
		});
	}
	return raw;
}
async function fetchYahooChart(symbol, interval, range, opts = {}) {
	for (const host of ["query1", "query2"]) try {
		const result = (await getJson(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includeAdjustedClose=true&includePrePost=${opts.prePost ? "true" : "false"}${opts.events ? "&events=div%2Csplits" : ""}`)).chart?.result?.[0];
		if (result?.timestamp?.length) return result;
	} catch {}
	return null;
}
function parseYahooEvents(result) {
	const ev = result.events;
	if (!ev) return void 0;
	const day = (sec) => typeof sec === "number" ? wallClock(sec, false) : "";
	return {
		dividends: Object.values(ev.dividends ?? {}).filter((d) => typeof d.amount === "number" && d.amount > 0 && typeof d.date === "number").map((d) => ({
			date: day(d.date),
			amount: d.amount
		})).filter((d) => d.date),
		splits: Object.values(ev.splits ?? {}).filter((d) => typeof d.date === "number" && (d.splitRatio || d.numerator && d.denominator)).map((d) => ({
			date: day(d.date),
			ratio: d.splitRatio ?? `${d.numerator}:${d.denominator}`
		})).filter((d) => d.date)
	};
}
/** Split-adjusted US OHLC. Prices stay in dollars (not rounded to a won). */
async function fetchUsOhlc(opts) {
	const symbol = yahooUsSymbol(opts.code);
	if (!symbol) return {
		bars: [],
		source: "us-invalid"
	};
	const interval = opts.interval;
	let yahooInterval = "1d";
	let range = opts.range ?? "5y";
	let bucket = 1;
	if (interval === "minute") {
		const plan = yahooMinutePlan(opts.minuteSize ?? 5, opts.range);
		yahooInterval = plan.yahooInterval;
		range = plan.range;
		bucket = plan.bucket;
	} else if (interval === "week") {
		yahooInterval = "1wk";
		range = opts.range ?? "10y";
	} else if (interval === "month" || interval === "year") {
		yahooInterval = interval === "year" ? "3mo" : "1mo";
		range = opts.range ?? "max";
	} else {
		yahooInterval = "1d";
		range = opts.range ?? "5y";
	}
	const prePost = interval === "minute" && Boolean(opts.prePost);
	const result = await fetchYahooChart(symbol, yahooInterval, range, {
		prePost,
		events: interval === "day" || interval === "week"
	});
	if (!result) return {
		bars: [],
		source: "us-yahoo-empty"
	};
	const events = parseYahooEvents(result);
	let raw = parseUsYahooBars(result, interval === "minute");
	if (interval === "minute" && bucket > 1) raw = bucketMinuteBars(raw, bucket);
	if (!raw.length) return {
		bars: [],
		source: "us-ohlc-empty"
	};
	if (interval === "year") {
		const byYear = /* @__PURE__ */ new Map();
		for (const bar of raw) {
			const y = bar.date.slice(0, 4);
			const list = byYear.get(y) ?? [];
			list.push(bar);
			byYear.set(y, list);
		}
		const yearly = [];
		for (const [y, list] of [...byYear.entries()].sort()) {
			const first = list[0];
			const last = list[list.length - 1];
			yearly.push({
				date: `${y}-01-01`,
				label: y,
				open: first.open,
				high: Math.max(...list.map((x) => x.high)),
				low: Math.min(...list.map((x) => x.low)),
				close: last.close,
				volume: list.reduce((s, x) => s + x.volume, 0),
				bullish: last.close >= first.open
			});
		}
		raw = yearly;
	}
	return {
		bars: withMas(raw, { round: false }),
		source: `yahoo-us-${symbol}-${yahooInterval}${prePost ? "-prepost" : ""}`,
		events
	};
}
async function fetchOhlc(opts) {
	const { code, market, interval } = opts;
	if (market === "US") return fetchUsOhlc({
		code,
		interval,
		minuteSize: opts.minuteSize,
		range: opts.range,
		prePost: opts.prePost
	});
	if (interval === "minute") return fetchMinuteOhlc(code, market, opts.minuteSize ?? 5, opts.range);
	const intervalMap = {
		day: {
			interval: "1d",
			range: opts.range ?? "5y"
		},
		week: {
			interval: "1wk",
			range: opts.range ?? "5y"
		},
		month: {
			interval: "1mo",
			range: opts.range ?? "max"
		},
		year: {
			interval: "3mo",
			range: opts.range ?? "max"
		}
	};
	const conf = intervalMap[interval] ?? intervalMap.day;
	let raw = [];
	let source = "yahoo";
	for (const symbol of yahooSymbolCandidates(code, market)) try {
		const result = (await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${conf.interval}&range=${conf.range}`)).chart.result?.[0];
		if (!result?.timestamp?.length) continue;
		const q = result.indicators.quote[0];
		const parsed = [];
		for (let i = 0; i < result.timestamp.length; i++) {
			const o = q.open[i];
			const h = q.high[i];
			const l = q.low[i];
			const c = q.close[i];
			const v = q.volume[i];
			if (o == null || h == null || l == null || c == null) continue;
			const kst = /* @__PURE__ */ new Date(result.timestamp[i] * 1e3 + 324e5);
			const date = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
			parsed.push({
				date,
				label: interval === "year" || interval === "month" ? `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, "0")}` : `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}`,
				open: Math.round(o),
				high: Math.round(h),
				low: Math.round(l),
				close: Math.round(c),
				volume: Math.round(v ?? 0),
				bullish: c >= o
			});
		}
		if (parsed.length) {
			raw = parsed;
			source = `yahoo-${symbol}`;
			break;
		}
	} catch {}
	if (!raw.length) {
		const tf = interval === "week" ? "week" : interval === "month" || interval === "year" ? "month" : "day";
		const naver = await fetchNaverFchart(code, tf, interval === "day" ? 1200 : interval === "week" ? 400 : 180);
		if (naver.length) {
			raw = naver;
			source = `naver-fchart-${tf}`;
		}
	}
	if (!raw.length && interval === "day") return fetchNaverDayOhlc(code);
	if (!raw.length) return {
		bars: [],
		source: "ohlc-empty"
	};
	if (interval === "year") {
		const byYear = /* @__PURE__ */ new Map();
		for (const b of raw) {
			const y = b.date.slice(0, 4);
			const list = byYear.get(y) ?? [];
			list.push(b);
			byYear.set(y, list);
		}
		const yearly = [];
		for (const [y, list] of [...byYear.entries()].sort()) {
			const first = list[0];
			const last = list[list.length - 1];
			yearly.push({
				date: `${y}-01-01`,
				label: y,
				open: first.open,
				high: Math.max(...list.map((x) => x.high)),
				low: Math.min(...list.map((x) => x.low)),
				close: last.close,
				volume: list.reduce((s, x) => s + x.volume, 0),
				bullish: last.close >= first.open
			});
		}
		return {
			bars: withMas(yearly),
			source
		};
	}
	return {
		bars: withMas(raw),
		source
	};
}
async function fetchNaverFchart(code, timeframe, count) {
	try {
		const items = [...(await getText(`https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=${timeframe}&count=${count}&requestType=0`)).matchAll(/item data="([^"]+)"/g)].map((m) => m[1]);
		const raw = [];
		for (const row of items) {
			const [dt, o, h, l, c, v] = row.split("|");
			if (!dt || dt.length < 8) continue;
			const ymd = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
			const close = num(c);
			if (!close) continue;
			const open = num(o) || close;
			const high = num(h) || close;
			const low = num(l) || close;
			raw.push({
				date: ymd,
				label: `${Number(dt.slice(4, 6))}/${Number(dt.slice(6, 8))}`,
				open,
				high: Math.max(high, open, close),
				low: Math.min(low, open, close),
				close,
				volume: num(v),
				bullish: close >= open
			});
		}
		return raw;
	} catch {
		return [];
	}
}
async function fetchNaverDayOhlc(code) {
	const end = /* @__PURE__ */ new Date();
	const start = /* @__PURE__ */ new Date();
	start.setFullYear(start.getFullYear() - 5);
	const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
	const match = (await getText(`https://api.finance.naver.com/siseJson.naver?symbol=${code}&requestType=1&startTime=${fmt(start)}&endTime=${fmt(end)}&timeframe=day`)).match(/\[[\s\S]*\]/);
	if (!match) return {
		bars: [],
		source: "naver"
	};
	let rows;
	try {
		const normalized = match[0].replace(/'/g, "\"");
		rows = JSON.parse(normalized);
	} catch {
		return {
			bars: [],
			source: "naver-parse-error"
		};
	}
	const raw = [];
	for (const row of rows) {
		if (!Array.isArray(row) || typeof row[0] !== "string") continue;
		const ymd = String(row[0]);
		if (!/^\d{8}$/.test(ymd)) continue;
		const date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
		const open = num(row[1]);
		const high = num(row[2]);
		const low = num(row[3]);
		const close = num(row[4]);
		const volume = num(row[5]);
		raw.push({
			date,
			label: `${Number(ymd.slice(4, 6))}/${Number(ymd.slice(6, 8))}`,
			open,
			high,
			low,
			close,
			volume,
			bullish: close >= open
		});
	}
	return {
		bars: withMas(raw),
		source: "naver"
	};
}
async function fetchInvestorFlow(code) {
	const urls = [`https://m.stock.naver.com/api/stock/${code}/trend`, `https://m.stock.naver.com/front-api/product/trend?reutersCode=${code}`];
	let rows = [];
	let source = "naver-trend";
	for (const url of urls) try {
		const raw = await getJson(url);
		const list = Array.isArray(raw) ? raw : Array.isArray(raw.result) ? raw.result : [];
		if (list.length) {
			rows = list;
			source = url.includes("front-api") ? "naver-front-trend" : "naver-trend";
			break;
		}
	} catch {}
	return {
		days: (rows ?? []).map((r) => {
			const bd = String(r.bizdate ?? r.localBizDate ?? "").replace(/\D/g, "");
			if (bd.length < 8) return null;
			return {
				date: `${bd.slice(0, 4)}-${bd.slice(4, 6)}-${bd.slice(6, 8)}`,
				label: `${Number(bd.slice(4, 6))}/${Number(bd.slice(6, 8))}`,
				foreign: parseSignedShares(r.foreignerPureBuyQuant),
				institution: parseSignedShares(r.organPureBuyQuant),
				individual: parseSignedShares(r.individualPureBuyQuant),
				close: num(String(r.closePrice ?? "0").replace(/,/g, "")),
				foreignHoldRatio: r.foreignerHoldRatio ? num(String(r.foreignerHoldRatio).replace(/%/g, "")) : void 0
			};
		}).filter((d) => d != null).sort((a, b) => a.date.localeCompare(b.date)),
		source
	};
}
var CAT_LABEL = {
	company: "기업",
	industry: "산업",
	market: "시황·전략",
	economy: "경제"
};
var PC_PATH = {
	company: "company_read.naver",
	industry: "industry_read.naver",
	market: "invest_read.naver",
	economy: "economy_read.naver"
};
var API_DETAIL = {
	company: "company",
	industry: "industry",
	market: "invest",
	economy: "economy"
};
async function enrichFromApiDetail(researchId, kind) {
	const apiKind = API_DETAIL[kind];
	try {
		const rc = (await getJson(`https://m.stock.naver.com/api/research/${apiKind}/${researchId}`)).researchContent;
		if (!rc) return {};
		const plain = htmlToText(rc.content ?? "");
		const extracted = extractTargetAndRating(plain);
		return {
			rating: extracted.rating,
			targetPrice: extracted.targetPrice,
			pdfUrl: rc.attachUrl || void 0,
			previewExtra: plain.slice(0, 420)
		};
	} catch {
		return {};
	}
}
async function enrichResearchFromPage(researchId, kind = "company") {
	const pageUrl = `https://finance.naver.com/research/${PC_PATH[kind]}?nid=${researchId}`;
	try {
		const text = await getEucKr(pageUrl);
		const extracted = extractTargetAndRating(text);
		const coment = text.match(/class=["']coment["'][^>]*>\s*([^<]+)\s*</i);
		if (coment && !extracted.rating) extracted.rating = normalizeRating(coment[1]);
		const money = text.match(/목표가\s*<em[^>]*>\s*([^<]+)\s*</i);
		if (money && !extracted.targetPrice) {
			const t = money[1].replace(/[^\d,]/g, "");
			if (t && t !== "없음") {
				const n = num(t);
				if (n >= 1e3) extracted.targetPrice = n;
			}
		}
		const pdf = text.match(/https?:\/\/stock\.pstatic\.net\/stock-research\/[^"'\\\s>]+\.pdf/i)?.[0] ?? text.match(/https?:\/\/[^"'\\\s>]+\.pdf/i)?.[0];
		return {
			rating: extracted.rating,
			targetPrice: extracted.targetPrice,
			pdfUrl: pdf,
			pageUrl
		};
	} catch {
		return { pageUrl };
	}
}
function mapResearchRow(r, category) {
	const preview = r.previewContent ?? "";
	const blob = `${r.title} ${preview}`;
	const extracted = extractTargetAndRating(blob);
	return {
		researchId: r.researchId,
		code: r.itemCode,
		nameKo: r.itemName,
		title: r.title,
		broker: r.brokerName,
		date: r.writeDate,
		preview,
		rating: extracted.rating,
		targetPrice: extracted.targetPrice,
		category,
		categoryLabel: CAT_LABEL[category],
		pdfUrl: r.attachUrl,
		pageUrl: `https://finance.naver.com/research/${PC_PATH[category]}?nid=${r.researchId}`,
		readCount: r.readCount ? num(r.readCount) : void 0,
		summary: buildResearchExecutiveSummary(preview, r.title),
		sectorIds: classifyResearchSectors(blob),
		tags: [],
		hasInvestmentView: Boolean(extracted.rating || extracted.targetPrice)
	};
}
async function enrichReports(reports, limit = 12) {
	const head = reports.slice(0, limit);
	const tail = reports.slice(limit);
	const enriched = await Promise.all(head.map(async (r) => {
		const api = await enrichFromApiDetail(r.researchId, r.category);
		let rating = r.rating ?? api.rating;
		const targetPrice = r.targetPrice ?? api.targetPrice;
		const pdfUrl = r.pdfUrl ?? api.pdfUrl;
		let preview = r.preview;
		if (api.previewExtra && (!preview || preview.length < api.previewExtra.length)) preview = api.previewExtra;
		rating = normalizeRating(rating);
		return {
			...r,
			rating,
			targetPrice,
			pdfUrl,
			preview,
			summary: buildResearchExecutiveSummary(preview, r.title),
			sectorIds: classifyResearchSectors(`${r.title} ${preview}`),
			hasInvestmentView: Boolean(rating || targetPrice)
		};
	}));
	const normalizedTail = tail.map((r) => ({
		...r,
		rating: normalizeRating(r.rating),
		summary: r.summary || buildResearchExecutiveSummary(r.preview, r.title),
		sectorIds: r.sectorIds?.length ? r.sectorIds : classifyResearchSectors(`${r.title} ${r.preview}`),
		hasInvestmentView: Boolean(normalizeRating(r.rating) || r.targetPrice)
	}));
	return [...enriched, ...normalizedTail];
}
async function fetchResearchList(code) {
	return enrichReports((await getJson(`https://m.stock.naver.com/api/research/stock/${code}`) ?? []).map((r) => mapResearchRow(r, "company")), 6);
}
async function fetchCategoryResearch(category, limit = 15) {
	const apiPath = category === "market" ? "invest" : category;
	try {
		let list = (await getJson(`https://m.stock.naver.com/api/research/${apiPath}`) ?? []).slice(0, limit).map((r) => mapResearchRow(r, category));
		if (category === "market") try {
			const extra = (await getJson(`https://m.stock.naver.com/api/research/market`) ?? []).slice(0, 10).map((r) => mapResearchRow(r, "market"));
			const seen = new Set(list.map((x) => x.researchId));
			for (const e of extra) if (!seen.has(e.researchId)) list.push(e);
			list = sortReportsNewestFirst(list).slice(0, limit);
		} catch {}
		return enrichReports(list, Math.min(5, limit));
	} catch {
		return [];
	}
}
async function fetchResearchPack(code) {
	const [company, industryAll, market, economy] = await Promise.all([
		fetchResearchList(code).catch(() => []),
		fetchCategoryResearch("industry", 30).catch(() => []),
		fetchCategoryResearch("market", 12).catch(() => []),
		fetchCategoryResearch("economy", 12).catch(() => [])
	]);
	const sectorId = UNIVERSE.find((u) => u.code === code)?.sectorId;
	return {
		company,
		industry: sectorId ? industryAll.filter((r) => r.sectorIds.includes(sectorId)).slice(0, 12) : industryAll.slice(0, 12),
		market,
		economy
	};
}
/**
* Market-wide legacy research desk (fallback path only). The former fixed
* 7-stock "featured" list is gone (D6/AT-18): company research now pages the
* full v2 category (`src/server/research-v2.ts`).
*/
async function fetchResearchDesk() {
	const [industry, market, economy] = await Promise.all([
		fetchCategoryResearch("industry", 40).catch(() => []),
		fetchCategoryResearch("market", 40).catch(() => []),
		fetchCategoryResearch("economy", 40).catch(() => [])
	]);
	return {
		industry,
		market,
		economy,
		featured: []
	};
}
/** Deep research detail — used on PDF/원문 click & detail sheet open (not list path). */
var researchDeepCache = /* @__PURE__ */ new Map();
var RESEARCH_DEEP_TTL_MS = 6e5;
async function fetchResearchPdf(researchId, category = "company") {
	const key = `${category}:${researchId}`;
	const now = Date.now();
	const hit = researchDeepCache.get(key);
	if (hit && now - hit.at < RESEARCH_DEEP_TTL_MS) return hit.data;
	const [api, page] = await Promise.all([enrichFromApiDetail(researchId, category), enrichResearchFromPage(researchId, category)]);
	const rating = normalizeRating(api.rating ?? page.rating);
	const targetPrice = api.targetPrice ?? page.targetPrice;
	const pdfUrl = api.pdfUrl || page.pdfUrl;
	const previewExtra = (api.previewExtra && api.previewExtra.length >= 40 ? api.previewExtra : void 0) ?? page.previewExtra;
	const data = {
		pdfUrl,
		pageUrl: page.pageUrl || `https://finance.naver.com/research/${PC_PATH[category]}?nid=${researchId}`,
		rating,
		targetPrice,
		previewExtra
	};
	researchDeepCache.set(key, {
		at: now,
		data
	});
	if (researchDeepCache.size > 200) {
		const first = researchDeepCache.keys().next().value;
		if (first) researchDeepCache.delete(first);
	}
	return data;
}
async function fetchNews(code, page = 1) {
	const data = await getJson(`https://m.stock.naver.com/api/news/stock/${code}?pageSize=20&page=${Math.max(1, Math.min(page, 20))}`);
	const items = [];
	for (const group of data ?? []) for (const it of group.items ?? []) {
		const dt = it.datetime ?? "";
		const iso = dt.length >= 12 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}T${dt.slice(8, 10)}:${dt.slice(10, 12)}:00+09:00` : dt;
		items.push({
			id: it.id ?? `${it.officeId}${it.articleId}`,
			title: it.titleFull ?? it.title ?? "",
			body: it.body ?? "",
			source: it.officeName ?? "언론",
			datetime: iso,
			url: it.mobileNewsUrl ?? (it.officeId && it.articleId ? `https://n.news.naver.com/mnews/article/${it.officeId}/${it.articleId}` : "")
		});
	}
	return items;
}
async function fetchDisclosureDetail(code, disclosureId) {
	const nameKo = UNIVERSE.find((u) => u.code === code)?.nameKo;
	const search = dartSearchUrl(nameKo ?? code);
	const d = (await getJson(`https://m.stock.naver.com/api/stock/${code}/disclosure/${disclosureId}`)).disclosure;
	if (!d) return {
		id: disclosureId,
		code,
		title: "공시를 불러오지 못했습니다",
		datetime: "",
		author: "공시",
		html: "",
		text: "본문을 불러오지 못했습니다. DART에서 검색해 주세요.",
		dartSearchUrl: search
	};
	const rawHtml = d.contents ?? "";
	const rcpNo = extractRcpNo(rawHtml);
	const dartUrl = rcpNo ? dartViewerUrl(rcpNo) : void 0;
	const text = htmlToText(sanitizeDisclosureHtml(rawHtml, rcpNo));
	return {
		id: String(d.disclosureId ?? disclosureId),
		code: d.itemCode ?? code,
		title: d.title ?? "",
		datetime: d.datetime ?? "",
		author: d.author ?? "공시",
		html: "",
		text,
		rcpNo,
		dartUrl,
		dartSearchUrl: search
	};
}
var INDEX_META = [
	{
		cd: "KOSPI",
		id: "kospi",
		nameKo: "코스피",
		nameEn: "KOSPI"
	},
	{
		cd: "KOSDAQ",
		id: "kosdaq",
		nameKo: "코스닥",
		nameEn: "KOSDAQ"
	},
	{
		cd: "KPI200",
		id: "kpi200",
		nameKo: "코스피200",
		nameEn: "KOSPI 200"
	}
];
/** Naver polling stores index levels ×100 (integer). */
function scaleIndex(v) {
	return Math.round(v) / 100;
}
async function fetchIndices() {
	try {
		const datas = (await getJson(`https://polling.finance.naver.com/api/realtime?query=SERVICE_INDEX:${INDEX_META.map((x) => x.cd).join(",")}`)).result?.areas?.[0]?.datas ?? [];
		if (datas.length > 0) {
			const out = [];
			for (const meta of INDEX_META) {
				const row = datas.find((d) => d.cd === meta.cd);
				if (!row) continue;
				out.push({
					id: meta.id,
					nameKo: meta.nameKo,
					nameEn: meta.nameEn,
					value: scaleIndex(num(row.nv)),
					change: scaleIndex(num(row.cv)),
					changePct: num(row.cr),
					marketStatus: row.ms,
					open: row.ov != null ? scaleIndex(num(row.ov)) : void 0,
					high: row.hv != null ? scaleIndex(num(row.hv)) : void 0,
					low: row.lv != null ? scaleIndex(num(row.lv)) : void 0,
					source: "naver-finance-snapshot"
				});
			}
			if (out.length) return out;
		}
	} catch {}
	const out = [];
	for (const meta of INDEX_META) try {
		const basic = await getJson(`https://m.stock.naver.com/api/index/${meta.cd}/basic`);
		out.push({
			id: meta.id,
			nameKo: meta.nameKo,
			nameEn: meta.nameEn,
			value: num(basic.closePrice),
			change: num(basic.compareToPreviousClosePrice),
			changePct: num(basic.fluctuationsRatio),
			marketStatus: basic.marketStatus,
			open: basic.openPrice ? num(basic.openPrice) : void 0,
			high: basic.highPrice ? num(basic.highPrice) : void 0,
			low: basic.lowPrice ? num(basic.lowPrice) : void 0,
			source: "naver-finance-snapshot"
		});
	} catch {}
	return out;
}
function parseNumLoose(v) {
	if (v == null) return 0;
	if (typeof v === "number") return Number.isFinite(v) ? v : 0;
	const raw = String(v).trim();
	if (!raw || raw === "-" || raw === "N/A" || raw === "—") return 0;
	const loss = /적자|손실/.test(raw);
	const compact = raw.replace(/,/g, "").replace(/\s/g, "");
	const m = compact.match(/-?\d+(?:\.\d+)?/);
	if (!m) return 0;
	let n = Number(m[0]);
	if (!Number.isFinite(n)) return 0;
	if (/조/.test(compact)) n *= 0xe8d4a51000;
	else if (/억/.test(compact)) n *= 1e8;
	else if (/만/.test(compact) && !/원|배/.test(compact)) n *= 1e4;
	if (loss && n > 0) n = -n;
	return n;
}
/** Latest non-consensus column (raw number, not unit-converted). */
function latestReported(finance, title) {
	if (!finance?.rowList?.length) return {
		value: 0,
		key: null
	};
	const row = finance.rowList.find((r) => r.title === title);
	if (!row?.columns) return {
		value: 0,
		key: null
	};
	const keys = (finance.trTitleList ?? []).filter((t) => t.isConsensus !== "Y").map((t) => t.key).reverse();
	for (const k of keys) {
		const v = parseNumLoose(row.columns[k]?.value);
		if (v !== 0) return {
			value: v,
			key: k
		};
	}
	return {
		value: 0,
		key: null
	};
}
/**
* True TTM EPS = sum of last 4 reported (non-consensus) quarterly EPS.
* Korean issuers report quarterly EPS already on a per-share basis.
*/
function ttmEpsFromQuarters(finance) {
	if (!finance?.rowList?.length) return {
		eps: 0,
		quarters: []
	};
	const row = finance.rowList.find((r) => r.title === "EPS");
	if (!row?.columns) return {
		eps: 0,
		quarters: []
	};
	const keys = (finance.trTitleList ?? []).filter((t) => t.isConsensus !== "Y").map((t) => t.key).reverse();
	const used = [];
	let sum = 0;
	for (const k of keys) {
		const raw = row.columns[k]?.value;
		if (raw == null || raw === "" || raw === "-") continue;
		const v = parseNumLoose(raw);
		sum += v;
		used.push(k);
		if (used.length === 4) break;
	}
	return {
		eps: used.length === 4 ? sum : 0,
		quarters: used
	};
}
/** Latest non-consensus annual row value (억원 unit in Naver finance). */
function latestAnnualEok(finance, title) {
	return latestReported(finance, title).value;
}
async function fetchStockBasic(code) {
	const [basicRes, integRes, summaryRes, finRes, qRes] = await Promise.all([
		getJson(`https://m.stock.naver.com/api/stock/${code}/basic`).catch(() => null),
		getJson(`https://m.stock.naver.com/api/stock/${code}/integration`).catch(() => null),
		getJson(`https://api.finance.naver.com/service/itemSummary.nhn?itemcode=${code}`).catch(() => null),
		getJson(`https://m.stock.naver.com/api/stock/${code}/finance/annual`).catch(() => null),
		getJson(`https://m.stock.naver.com/api/stock/${code}/finance/quarter`).catch(() => null)
	]);
	const basic = basicRes ?? {};
	const map = Object.fromEntries((integRes?.totalInfos ?? []).map((t) => [t.code, t.value]));
	const summary = summaryRes ?? {};
	const salesEok = latestAnnualEok(finRes?.financeInfo ?? null, "매출액");
	const price = parseNumLoose(summary.now) || parseNumLoose(basic.closePrice) || parseNumLoose(map.lastClosePrice);
	const headlineEps = parseNumLoose(summary.eps) || parseNumLoose(map.eps);
	const ttm = ttmEpsFromQuarters(qRes?.financeInfo ?? null);
	const fyEps = latestReported(finRes?.financeInfo ?? null, "EPS").value;
	let epsFinal = 0;
	let epsSource;
	if (ttm.eps !== 0) {
		epsFinal = ttm.eps;
		epsSource = "ttm-4q";
	} else if (headlineEps !== 0) {
		epsFinal = headlineEps;
		epsSource = "naver-headline";
	} else if (fyEps !== 0) {
		epsFinal = fyEps;
		epsSource = "fy";
	}
	const cnsEps = parseNumLoose(map.cnsEps);
	let perNum = parseNumLoose(summary.per) || parseNumLoose(map.per);
	if (!perNum && epsFinal !== 0 && price > 0) perNum = price / epsFinal;
	const cnsPer = parseNumLoose(map.cnsPer) || (cnsEps > 0 && price > 0 ? price / cnsEps : 0);
	const pbrNum = parseNumLoose(summary.pbr) || parseNumLoose(map.pbr);
	let bps = parseNumLoose(map.bps) || latestReported(finRes?.financeInfo ?? null, "BPS").value;
	if (!bps && pbrNum > 0 && price > 0) bps = price / pbrNum;
	if (!epsFinal && perNum > 0 && price > 0) {
		epsFinal = price / perNum;
		epsSource = "implied";
	}
	let marketCapKrw = 0;
	if (summary.marketSum && summary.marketSum > 0) marketCapKrw = summary.marketSum * 1e6;
	const salesKrw = salesEok > 0 ? salesEok * 1e8 : 0;
	let sps = 0;
	let psrNum = 0;
	if (salesKrw > 0 && marketCapKrw > 0 && price > 0) {
		const shares = marketCapKrw / price;
		if (shares > 0) {
			sps = salesKrw / shares;
			psrNum = price / sps;
		}
	} else if (salesKrw > 0 && marketCapKrw > 0) psrNum = marketCapKrw / salesKrw;
	return {
		stockName: basic.stockName,
		stockExchangeName: basic.stockExchangeName,
		high52: parseNumLoose(map.highPriceOf52Weeks),
		low52: parseNumLoose(map.lowPriceOf52Weeks),
		marketCapLabel: map.marketValue,
		per: map.per ?? (perNum ? perNum.toFixed(2) : void 0),
		pbr: map.pbr ?? (pbrNum ? pbrNum.toFixed(2) : void 0),
		psr: psrNum > 0 ? psrNum.toFixed(2) : void 0,
		foreignRate: map.foreignRate,
		tradedAt: basic.localTradedAt,
		marketStatus: basic.marketStatus,
		price: price || void 0,
		eps: epsFinal !== 0 ? epsFinal : void 0,
		bps: bps || void 0,
		sps: sps || void 0,
		perNum: perNum || void 0,
		pbrNum: pbrNum || void 0,
		psrNum: psrNum || void 0,
		cnsEps: cnsEps || void 0,
		cnsPer: cnsPer || void 0,
		epsSource,
		ttmQuarters: ttm.quarters.length ? ttm.quarters : void 0,
		fyEps: fyEps || void 0,
		marketCapKrw: marketCapKrw || void 0,
		salesKrw: salesKrw || void 0
	};
}
//#endregion
export { fetchNews as a, fetchResearchDesk as c, fetchStockBasic as d, naver_market_C1ZunDb__exports as f, fetchInvestorFlow as i, fetchResearchPack as l, fetchDisclosureDetail as n, fetchOhlc as o, fetchIndices as r, fetchRealtimeQuotes as s, fetchAllUniverseQuotes as t, fetchResearchPdf as u };
