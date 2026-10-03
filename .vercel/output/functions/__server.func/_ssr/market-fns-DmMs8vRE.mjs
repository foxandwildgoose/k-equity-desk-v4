import { t as decodeHtmlEntities } from "./readable-text-D28LomX7.mjs";
import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
import { a as literal, c as string, i as boolean, l as union, n as _enum, o as number, r as array, s as object } from "../_libs/zod.mjs";
import { d as normalizeKrTicker, l as isKrTicker, o as inferSectorId, r as detectKrMarket, t as UNIVERSE } from "./universe-BLkYDatc.mjs";
import { s as parseSourceTime } from "./time-By5ScNNo.mjs";
import { c as sortDisclosuresNewestFirst, d as sortReportsNewestFirst, f as sortTimedNewestFirst, t as compareNewestFirst } from "./mappers-DlpCqw-E.mjs";
import { c as etfStageOf, f as matchEtf } from "./etf-news-D8YKQLOx.mjs";
import { a as classifyResearchSectors, n as RESEARCH_SECTOR_RULES, t as NAVER_UPJONG_ENC } from "./research-taxonomy-BpoDpMeG.mjs";
import { a as US_POLICY_BRIEFS, t as US_LINKED_CODES } from "./us-link-7--eFHFs.mjs";
import { ETF_ASSET_CLASS_LABEL, ETF_CODE_RE, fetchAllEtfs, fetchEtfDetail, fetchEtfHoldings, fetchNewEtfs, fetchUsdKrw, fetchWorldQuotes, filterEtfBucket, normalizeEtfCode, searchEtfsInList, t as fillLiveMarketWeights } from "./etf-market-S8CEBu8d.mjs";
import { n as buildResearchExecutiveSummary } from "./research-utils-_RqvZcrM.mjs";
import { a as fetchNews, c as fetchResearchDesk, d as fetchStockBasic, i as fetchInvestorFlow, l as fetchResearchPack, n as fetchDisclosureDetail, o as fetchOhlc, r as fetchIndices, s as fetchRealtimeQuotes, t as fetchAllUniverseQuotes, u as fetchResearchPdf } from "./naver-market-C1ZunDb_.mjs";
import { n as fetchUsLinkLiveFeeds, t as fetchGoogleNewsRss } from "./us-link-feed-CgXffHwi.mjs";
import { fetchKrxDisclosureDesk, fetchStockDisclosureBundle } from "./krx-disclosures-CIF4Ihdf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/market-fns-DmMs8vRE.js
var UA = "Mozilla/5.0 (compatible; KoreaEquityCommand/1.0; +https://x.ai) AppleWebKit/537.36";
async function getEucKr(url) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 1e4);
	try {
		const res = await fetch(url, {
			headers: {
				"User-Agent": UA,
				Accept: "text/html,*/*",
				"Accept-Language": "ko-KR,ko;q=0.9",
				Referer: "https://finance.naver.com/research/industry_list.naver"
			},
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
		clearTimeout(t);
	}
}
async function getUtf8(url, referer) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 1e4);
	try {
		const res = await fetch(url, {
			headers: {
				"User-Agent": UA,
				Accept: "text/html,*/*",
				"Accept-Language": "ko-KR,ko;q=0.9",
				Referer: referer
			},
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.text();
	} finally {
		clearTimeout(t);
	}
}
function decodeHtml(s) {
	return decodeHtmlEntities(s).replace(/\s+/g, " ").trim();
}
function toIsoDate(raw) {
	const s = raw.trim();
	const m1 = s.match(/(\d{2})\.(\d{2})\.(\d{2})/);
	if (m1) {
		const yy = Number(m1[1]);
		return `${yy >= 70 ? 1900 + yy : 2e3 + yy}.${m1[2]}.${m1[3]}`;
	}
	const m2 = s.match(/(\d{4})[-.](\d{2})[-.](\d{2})/);
	if (m2) return `${m2[1]}.${m2[2]}.${m2[3]}`;
	return s;
}
function naverListUrl(upjong, page) {
	return `https://finance.naver.com/research/industry_list.naver?page=${page}&searchType=upjong&upjong=${NAVER_UPJONG_ENC[upjong] ?? encodeURIComponent(upjong)}`;
}
function naverIndustrySearchUrl(upjong) {
	return naverListUrl(upjong, 1);
}
function parseNaverIndustryPage(html, sectorId, upjong) {
	const parts = html.split(/industry_read\.naver\?nid=/);
	const out = [];
	for (const part of parts.slice(1)) {
		const idm = part.match(/^(\d+)/);
		if (!idm) continue;
		const nid = Number(idm[1]);
		const titleM = part.match(/>([^<]{2,160})<\/a>/);
		if (!titleM) continue;
		const title = decodeHtml(titleM[1]);
		const tds = [...part.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => decodeHtml(m[1].replace(/<[^>]+>/g, ""))).filter(Boolean);
		const broker = tds.find((t) => /증권|투자|IR|평가|가이드/.test(t)) ?? tds[0] ?? "증권사";
		const date = toIsoDate(tds.find((t) => /\d{2}\.\d{2}\.\d{2}/.test(t)) ?? "");
		const pageUrl = `https://finance.naver.com/research/industry_read.naver?nid=${nid}`;
		const blob = `${title} ${upjong}`;
		out.push({
			researchId: nid,
			title,
			broker,
			date,
			preview: `${upjong} 업종 산업분석 · ${broker}`,
			category: "industry",
			categoryLabel: "산업분석",
			pageUrl,
			pdfUrl: pageUrl,
			summary: buildResearchExecutiveSummary(`${upjong} 업종 산업분석. ${title}`, title),
			sectorIds: [sectorId, ...classifyResearchSectors(blob).filter((s) => s !== sectorId)],
			tags: [upjong, "네이버 업종검색"],
			hasInvestmentView: false,
			sourceKind: "naver",
			sourceLabel: `네이버 · ${upjong}`
		});
	}
	return out;
}
async function fetchNaverUpjong(upjong, sectorId, pages = 2) {
	return (await Promise.all(Array.from({ length: pages }, (_, i) => getEucKr(naverListUrl(upjong, i + 1)).catch(() => "")))).flatMap((h) => h ? parseNaverIndustryPage(h, sectorId, upjong) : []);
}
function parseHankyungIndustry(html, sectorId) {
	const kws = RESEARCH_SECTOR_RULES.find((r) => r.sectorId === sectorId)?.keywords ?? [];
	const rows = html.split(/<tr/i);
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const row of rows) {
		const idm = row.match(/report_idx=(\d+)/);
		if (!idm) continue;
		const rid = Number(idm[1]);
		if (seen.has(rid)) continue;
		seen.add(rid);
		const titleM = row.match(/report_idx=\d+[^>]*>([^<]{2,160})<\/a>/) ?? row.match(/>([^<]{6,160})<\/a>/);
		if (!titleM) continue;
		const title = decodeHtml(titleM[1]);
		const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => decodeHtml(m[1].replace(/<[^>]+>/g, " ")));
		const dateRaw = tds.find((t) => /\d{4}-\d{2}-\d{2}/.test(t)) ?? "";
		const broker = tds.find((t) => /증권|투자|IR/.test(t) && t.length < 30) ?? "한경 컨센서스";
		const blob = `${title} ${broker}`;
		if (kws.length && !kws.some((k) => blob.toLowerCase().includes(k.toLowerCase()))) continue;
		const pdfUrl = `https://consensus.hankyung.com/analysis/downpdf?report_idx=${rid}`;
		out.push({
			researchId: 8e6 + rid % 1e6,
			title,
			broker,
			date: toIsoDate(dateRaw),
			preview: `한경 컨센서스 산업 리포트 · ${broker}`,
			category: "industry",
			categoryLabel: "산업분석",
			pageUrl: pdfUrl,
			pdfUrl,
			summary: buildResearchExecutiveSummary(`한경 컨센서스. ${title}`, title),
			sectorIds: [sectorId, ...classifyResearchSectors(blob).filter((s) => s !== sectorId)],
			tags: ["한경 컨센서스"],
			hasInvestmentView: false,
			sourceKind: "hankyung",
			sourceLabel: "한경 컨센서스"
		});
	}
	return out;
}
async function fetchHankyungForSector(sectorId) {
	const html = await getUtf8("https://consensus.hankyung.com/analysis/list?skinType=industry&pagenum=20", "https://consensus.hankyung.com/").catch(() => "");
	if (!html) return [];
	return parseHankyungIndustry(html, sectorId);
}
function dedupe(list) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const r of list) {
		const key = `${r.sourceKind ?? "naver"}:${r.researchId}:${r.title}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(r);
	}
	return sortReportsNewestFirst(out);
}
async function fetchIndustryResearchBySector(sectorId) {
	const upjongs = (RESEARCH_SECTOR_RULES.find((r) => r.sectorId === sectorId)?.naverUpjongs ?? []).filter((u) => NAVER_UPJONG_ENC[u]);
	const [naverLists, hankyung] = await Promise.all([Promise.all(upjongs.map((u) => fetchNaverUpjong(u, sectorId, 2).catch(() => []))), fetchHankyungForSector(sectorId).catch(() => [])]);
	const naver = naverLists.flat();
	return {
		reports: dedupe([...naver, ...hankyung]).slice(0, 80),
		naverCount: naver.length,
		hankyungCount: hankyung.length,
		upjongs,
		naverUrl: upjongs[0] ? naverIndustrySearchUrl(upjongs[0]) : "https://finance.naver.com/research/industry_list.naver",
		hankyungUrl: "https://consensus.hankyung.com/analysis/list?skinType=industry"
	};
}
/**
* KR ETF news (F5).
*
* - `/news/etf` and the `/etfs` "ETF 뉴스" tab read `GET /api/feed?group=etf`:
*   registry sources `ETF_NEWS_SOURCE_IDS` (GN topic + issuer-brand queries,
*   Hankyung finance filtered by ETF keywords, Naver news search `query=ETF`),
*   post-processed by `enrichEtfStory` (stage/theme/brand + live-list match).
* - `fetchEtfListingNews` (listing / listing-scheduled only) is kept for the
*   existing `getEtfListingNews` server fn; its stage and matching rules now
*   live in `src/lib/etf-news.ts` so both paths share one implementation.
*/
var QUERIES = [
	"ETF 신규 상장",
	"ETF 상장예정",
	"한국거래소 ETF 상장",
	"ACE OR TIGER OR KODEX OR PLUS ETF 신규 상장"
];
function stageOf(title) {
	const st = etfStageOf(title);
	return st === "listed" || st === "scheduled" ? st : "other";
}
function isListingStory(title) {
	const t = title.replace(/\s+/g, " ");
	if (!/ETF|상장지수/.test(t)) return false;
	if (/상장폐지|상장 폐지/.test(t) && !/신규|예정/.test(t)) return false;
	return /상장|출시|신규상장|상장예정|상장 예고/.test(t);
}
async function fetchEtfListingNews(limit = 40) {
	const rssPromise = Promise.all(QUERIES.map((q) => fetchGoogleNewsRss(q, 18, "ko", "gn-etf-kr").catch(() => [])));
	const etfPromise = fetchAllEtfs().catch(() => []);
	const rssLists = await rssPromise;
	const etfs = await Promise.race([etfPromise, new Promise((resolve) => setTimeout(() => resolve([]), 5e3))]);
	const seen = /* @__PURE__ */ new Set();
	const items = [];
	for (const list of rssLists) for (const raw of list) {
		if (!isListingStory(raw.title)) continue;
		const key = raw.title.replace(/\s+/g, "").slice(0, 80);
		if (seen.has(key) || seen.has(raw.url)) continue;
		seen.add(key);
		seen.add(raw.url);
		const hit = matchEtf(raw.title, etfs);
		items.push({
			id: raw.id,
			title: raw.title,
			url: raw.url,
			source: raw.source,
			datetime: raw.datetime,
			matchedCode: hit?.code,
			matchedName: hit?.nameKo,
			stage: stageOf(raw.title)
		});
	}
	return {
		items: items.map((it) => {
			const t = parseSourceTime(it.datetime, { zone: "UTC" });
			return {
				it,
				key: {
					id: it.id,
					publishedAt: t.iso,
					precision: t.precision,
					sourceTier: 3
				}
			};
		}).sort((a, b) => compareNewestFirst(a.key, b.key)).map((r) => r.it).slice(0, limit),
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
		queries: QUERIES
	};
}
var quoteCache = {
	at: 0,
	data: null
};
var QUOTE_TTL_MS = 3e4;
var indexCache = {
	at: 0,
	data: null
};
var INDEX_TTL_MS = 25e3;
var deskCache = {
	at: 0,
	data: null
};
var DESK_TTL_MS = 18e4;
var etfCache = {
	at: 0,
	rows: null
};
var ETF_TTL = 6e4;
var newEtfCache = {
	at: 0,
	rows: null
};
var NEW_ETF_TTL = 6e5;
var stockBundleCache = /* @__PURE__ */ new Map();
var STOCK_BUNDLE_TTL_MS = 25e3;
var getQuotesByCodes_createServerFn_handler = createServerRpc({
	id: "20ea6d9740e1873a46832e044191aca791a44d54741a82c0515cc1024ed4809f",
	name: "getQuotesByCodes",
	filename: "src/lib/market-fns.ts"
}, (opts) => getQuotesByCodes.__executeServer(opts));
var getQuotesByCodes = createServerFn({ method: "GET" }).validator(object({ codes: array(string()).max(80) })).handler(getQuotesByCodes_createServerFn_handler, async ({ data }) => {
	const codes = [...new Set(data.codes.map((c) => normalizeKrTicker(c)).filter((c) => isKrTicker(c)))];
	if (!codes.length) return {
		quotes: [],
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	return {
		quotes: await fetchRealtimeQuotes(codes, Object.fromEntries(codes.map((c) => {
			const u = UNIVERSE.find((x) => x.code === c);
			return [c, {
				nameKo: u?.nameKo ?? c,
				nameEn: u?.nameEn ?? u?.nameKo ?? c,
				sectorId: u?.sectorId ?? inferSectorId(u?.nameKo ?? c),
				market: u?.market ?? "KOSPI"
			}];
		}))),
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
});
var getMarketQuotes_createServerFn_handler = createServerRpc({
	id: "22317702d830bba22c18bf55ff9aebcad93b94248c8d7055bab2fcde519e8e40",
	name: "getMarketQuotes",
	filename: "src/lib/market-fns.ts"
}, (opts) => getMarketQuotes.__executeServer(opts));
var getMarketQuotes = createServerFn({ method: "GET" }).handler(getMarketQuotes_createServerFn_handler, async () => {
	const now = Date.now();
	if (quoteCache.data && now - quoteCache.at < QUOTE_TTL_MS) return {
		quotes: quoteCache.data,
		fetchedAt: new Date(quoteCache.at).toISOString(),
		source: "naver-finance-snapshot",
		cached: true,
		live: false
	};
	const quotes = await fetchAllUniverseQuotes();
	quoteCache.data = quotes;
	quoteCache.at = now;
	return {
		quotes,
		fetchedAt: new Date(now).toISOString(),
		source: "naver-finance-snapshot",
		cached: false,
		live: false
	};
});
var getStockBundle_createServerFn_handler = createServerRpc({
	id: "e9288d88bf1ce8e8e4c2f168f1315f422eb2b842f1836dbace9e44e9e3397186",
	name: "getStockBundle",
	filename: "src/lib/market-fns.ts"
}, (opts) => getStockBundle.__executeServer(opts));
var getStockBundle = createServerFn({ method: "GET" }).validator(object({ code: string().regex(/^\d{6}$/) })).handler(getStockBundle_createServerFn_handler, async ({ data }) => {
	const code = normalizeKrTicker(data.code);
	const now = Date.now();
	const hit = stockBundleCache.get(code);
	if (hit && now - hit.at < STOCK_BUNDLE_TTL_MS) return hit.data;
	async function buildFresh() {
		const uni = UNIVERSE.find((u) => u.code === code);
		const seedMeta = {
			code,
			nameKo: uni?.nameKo ?? code,
			nameEn: uni?.nameEn ?? uni?.nameKo ?? code,
			sectorId: uni?.sectorId ?? "electronics",
			market: uni?.market ?? "KOSPI"
		};
		const v2CompanyP = import("./research-v2-DNVSaUnS.mjs").then((m) => m.fetchResearchV2List({
			type: "company",
			itemCodes: [code],
			size: 30
		})).catch(() => null);
		const [basic, quotes, flow, researchPack, news, discBundle] = await Promise.all([
			fetchStockBasic(code).catch(() => null),
			fetchRealtimeQuotes([code], { [code]: {
				nameKo: seedMeta.nameKo,
				nameEn: seedMeta.nameEn,
				sectorId: seedMeta.sectorId,
				market: seedMeta.market
			} }),
			fetchInvestorFlow(code).catch(() => ({
				days: [],
				source: "naver"
			})),
			fetchResearchPack(code).catch(() => ({
				company: [],
				industry: [],
				market: [],
				economy: []
			})),
			fetchNews(code).catch(() => []),
			fetchStockDisclosureBundle(code, seedMeta.nameKo).catch(() => ({
				items: [],
				dart: [],
				koscom: [],
				kindStatus: {
					available: false,
					message: "",
					url: "https://kind.krx.co.kr/disclosure/todaydisclosure.do"
				}
			}))
		]);
		const nameKo = uni?.nameKo ?? basic?.stockName ?? seedMeta.nameKo;
		const market = detectKrMarket(uni?.market, basic?.stockExchangeName, seedMeta.market);
		const meta = uni ?? {
			code,
			nameKo,
			nameEn: nameKo,
			sectorId: inferSectorId(nameKo),
			market
		};
		const disclosures = discBundle.items.map((d) => ({
			id: d.id,
			title: d.title,
			datetime: d.datetime,
			author: d.author,
			code: d.code ?? code,
			nameKo: d.nameKo ?? meta.nameKo,
			dartUrl: d.dartUrl,
			dartSearchUrl: d.dartSearchUrl,
			canLoadBody: d.canLoadBody,
			source: d.source,
			sourceLabel: d.sourceLabel,
			rcpNo: d.rcpNo
		}));
		const quote = quotes[0] ?? null;
		if (quote && basic) {
			if (basic.high52) quote.high52 = basic.high52;
			if (basic.low52) quote.low52 = basic.low52;
			if (basic.tradedAt) quote.tradedAt = basic.tradedAt;
			if (basic.marketStatus) quote.marketStatus = basic.marketStatus;
		}
		const v2Company = await v2CompanyP;
		if (v2Company && v2Company.path === "v2" && v2Company.reports.length) researchPack.company = v2Company.reports;
		const payload = {
			meta,
			quote,
			basic,
			flow,
			research: researchPack.company,
			researchPack,
			news: sortTimedNewestFirst(news),
			disclosures,
			disclosureMeta: {
				kind: discBundle.kindStatus,
				dartCount: discBundle.dart.length,
				koscomCount: discBundle.koscom.length
			},
			fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		stockBundleCache.set(code, {
			at: Date.now(),
			data: payload
		});
		if (stockBundleCache.size > 80) {
			const first = stockBundleCache.keys().next().value;
			if (first) stockBundleCache.delete(first);
		}
		return payload;
	}
	return buildFresh();
});
var getChartData_createServerFn_handler = createServerRpc({
	id: "2741e40ab8821427d8bcf896deb105a7fc19dc0babb8b6aaa02a412130fbdcb1",
	name: "getChartData",
	filename: "src/lib/market-fns.ts"
}, (opts) => getChartData.__executeServer(opts));
var getChartData = createServerFn({ method: "GET" }).validator(object({
	code: string().trim().min(1).max(12),
	market: _enum([
		"KOSPI",
		"KOSDAQ",
		"US"
	]),
	interval: _enum([
		"minute",
		"day",
		"week",
		"month",
		"year"
	]),
	minuteSize: union([
		literal(1),
		literal(3),
		literal(5),
		literal(10),
		literal(15),
		literal(30),
		literal(60)
	]).optional(),
	range: string().max(12).optional(),
	/** US intraday: include pre/post-market bars (F7.13). */
	prePost: boolean().optional()
})).handler(getChartData_createServerFn_handler, async ({ data }) => {
	if (data.market === "US") return fetchOhlc({
		code: data.code.trim().toUpperCase(),
		market: "US",
		interval: data.interval,
		minuteSize: data.minuteSize,
		range: data.range,
		prePost: data.prePost
	});
	const code = normalizeKrTicker(data.code);
	return fetchOhlc({
		code,
		market: data.market,
		interval: data.interval,
		minuteSize: data.minuteSize,
		range: data.range
	});
});
var getValuationSeries_createServerFn_handler = createServerRpc({
	id: "ab33f5943578ad6a4c2d3b553d37dde601acd42bf9821710ba94b3b49b64bff9",
	name: "getValuationSeries",
	filename: "src/lib/market-fns.ts"
}, (opts) => getValuationSeries.__executeServer(opts));
var getValuationSeries = createServerFn({ method: "GET" }).validator(object({ code: string().trim().min(1).max(12) })).handler(getValuationSeries_createServerFn_handler, async ({ data }) => {
	const { fetchValuationSeries } = await import("./valuation-series-C-o6S2XC.mjs");
	return fetchValuationSeries(data.code);
});
var getUsStreet_createServerFn_handler = createServerRpc({
	id: "c896e3ab110f1205a7679a339a05886599385517722877e90211332040abcd2b",
	name: "getUsStreet",
	filename: "src/lib/market-fns.ts"
}, (opts) => getUsStreet.__executeServer(opts));
var getUsStreet = createServerFn({ method: "GET" }).validator(object({
	symbol: string().trim().max(12).optional(),
	symbols: array(string().trim().regex(/^[A-Za-z][A-Za-z0-9.]{0,9}$/)).max(12).optional()
})).handler(getUsStreet_createServerFn_handler, async ({ data }) => {
	const { emptyUsStreetPack, fetchUsStreetPack, fetchUsStreetSymbol } = await import("./us-street-Dx2s8JR4.mjs").then((n) => n.i);
	const symbol = data.symbol?.trim();
	try {
		if (symbol) return await fetchUsStreetSymbol(symbol);
		return await fetchUsStreetPack(data.symbols?.length ? data.symbols : void 0);
	} catch {
		return emptyUsStreetPack("월가 공개 피드를 받지 못했습니다. 등급을 추정해 채우지 않습니다.");
	}
});
var getResearchPdf_createServerFn_handler = createServerRpc({
	id: "ec3f9140d0f0bf9b88ddf1a2d851c83947f39c599f5e8d3b49ee04869396705b",
	name: "getResearchPdf",
	filename: "src/lib/market-fns.ts"
}, (opts) => getResearchPdf.__executeServer(opts));
var getResearchPdf = createServerFn({ method: "GET" }).validator(object({
	researchId: number().int().positive(),
	category: _enum([
		"company",
		"industry",
		"market",
		"economy"
	]).optional()
})).handler(getResearchPdf_createServerFn_handler, async ({ data }) => fetchResearchPdf(data.researchId, data.category ?? "company"));
var getResearchDesk_createServerFn_handler = createServerRpc({
	id: "7f1eda26b4ed9a12a5244298a15abb0733dcd49bd061fc8a0accfab120cc103f",
	name: "getResearchDesk",
	filename: "src/lib/market-fns.ts"
}, (opts) => getResearchDesk.__executeServer(opts));
var getResearchDesk = createServerFn({ method: "GET" }).handler(getResearchDesk_createServerFn_handler, async () => {
	const now = Date.now();
	if (deskCache.data && now - deskCache.at < DESK_TTL_MS) return {
		...deskCache.data,
		fetchedAt: new Date(deskCache.at).toISOString(),
		cached: true
	};
	const desk = await fetchResearchDesk();
	deskCache.data = desk;
	deskCache.at = now;
	return {
		...desk,
		fetchedAt: new Date(now).toISOString(),
		cached: false
	};
});
var industryCache = /* @__PURE__ */ new Map();
var INDUSTRY_TTL_MS = 18e4;
var getIndustryResearch_createServerFn_handler = createServerRpc({
	id: "fa901486ee32fe838f7ec1e2616b9ca96d283759d098635f15bc3ca29270f2b4",
	name: "getIndustryResearch",
	filename: "src/lib/market-fns.ts"
}, (opts) => getIndustryResearch.__executeServer(opts));
var getIndustryResearch = createServerFn({ method: "GET" }).validator(object({ sectorId: string().min(2).max(40) })).handler(getIndustryResearch_createServerFn_handler, async ({ data }) => {
	const sectorId = data.sectorId;
	const now = Date.now();
	const hit = industryCache.get(sectorId);
	if (hit && now - hit.at < INDUSTRY_TTL_MS) return {
		...hit.data,
		cached: true
	};
	const pack = await fetchIndustryResearchBySector(sectorId);
	industryCache.set(sectorId, {
		at: now,
		data: pack
	});
	return {
		...pack,
		cached: false
	};
});
var getDisclosureDetail_createServerFn_handler = createServerRpc({
	id: "1107098a65d0f5af81534960a39838855f849486e0bdbe3da960184f336bc8d6",
	name: "getDisclosureDetail",
	filename: "src/lib/market-fns.ts"
}, (opts) => getDisclosureDetail.__executeServer(opts));
var getDisclosureDetail = createServerFn({ method: "GET" }).validator(object({
	code: string().regex(/^[0-9A-Za-z]{6}$/),
	disclosureId: string().min(1).max(80)
})).handler(getDisclosureDetail_createServerFn_handler, async ({ data }) => fetchDisclosureDetail(normalizeKrTicker(data.code), data.disclosureId));
var getStockNews_createServerFn_handler = createServerRpc({
	id: "aac9fd6614014e29cf27670f2be6ab9c85b5af0b0913b45ab895e8c3186392fa",
	name: "getStockNews",
	filename: "src/lib/market-fns.ts"
}, (opts) => getStockNews.__executeServer(opts));
var getStockNews = createServerFn({ method: "GET" }).validator(object({
	code: string().regex(/^[0-9A-Z]{6}$/),
	page: number().int().min(1).max(20)
})).handler(getStockNews_createServerFn_handler, async ({ data }) => {
	const code = normalizeKrTicker(data.code);
	try {
		const items = await fetchNews(code, data.page);
		return {
			items: sortTimedNewestFirst(items),
			page: data.page,
			hasMore: items.length >= 20,
			error: null,
			fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	} catch (err) {
		return {
			items: [],
			page: data.page,
			hasMore: false,
			error: err instanceof Error ? err.message.slice(0, 120) : "error",
			fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	}
});
var getMarketIndices_createServerFn_handler = createServerRpc({
	id: "f154a3830a7fa769b3681442c51672d43b9a273e148420e7f4105ddbb9cec5a6",
	name: "getMarketIndices",
	filename: "src/lib/market-fns.ts"
}, (opts) => getMarketIndices.__executeServer(opts));
var getMarketIndices = createServerFn({ method: "GET" }).handler(getMarketIndices_createServerFn_handler, async () => {
	const now = Date.now();
	if (indexCache.data && now - indexCache.at < INDEX_TTL_MS) return {
		indices: indexCache.data,
		fetchedAt: new Date(indexCache.at).toISOString(),
		source: "naver-finance-snapshot",
		cached: true
	};
	const indices = await fetchIndices();
	indexCache.data = indices;
	indexCache.at = now;
	return {
		indices,
		fetchedAt: new Date(now).toISOString(),
		source: "naver-finance-snapshot",
		cached: false
	};
});
var getScanDisclosures_createServerFn_handler = createServerRpc({
	id: "9e6270a121f70ddeb2c53fa068debfb416fa043638edf949510802e4c35a32b9",
	name: "getScanDisclosures",
	filename: "src/lib/market-fns.ts"
}, (opts) => getScanDisclosures.__executeServer(opts));
var getScanDisclosures = createServerFn({ method: "GET" }).handler(getScanDisclosures_createServerFn_handler, async () => {
	const desk = await fetchKrxDisclosureDesk();
	return sortDisclosuresNewestFirst([...desk.koscom, ...desk.dart]).slice(0, 100).map((d) => ({
		id: d.id,
		title: d.title,
		datetime: d.datetime,
		author: d.author,
		code: d.code,
		nameKo: d.nameKo,
		dartUrl: d.dartUrl,
		dartSearchUrl: d.dartSearchUrl,
		canLoadBody: d.canLoadBody,
		source: d.source,
		sourceLabel: d.sourceLabel,
		rcpNo: d.rcpNo,
		market: d.market
	}));
});
var getKrxDisclosureDesk_createServerFn_handler = createServerRpc({
	id: "6281abd8e0ea4fcb2e73102513eb9f1836f4cfa213660d96e1f42e5efd6335e4",
	name: "getKrxDisclosureDesk",
	filename: "src/lib/market-fns.ts"
}, (opts) => getKrxDisclosureDesk.__executeServer(opts));
var getKrxDisclosureDesk = createServerFn({ method: "GET" }).handler(getKrxDisclosureDesk_createServerFn_handler, async () => fetchKrxDisclosureDesk());
var getStockDisclosures_createServerFn_handler = createServerRpc({
	id: "f6e1258df5ed0a87b70ff13bb9ab8a207cc972029afee820bfc15f9d9ec58fa9",
	name: "getStockDisclosures",
	filename: "src/lib/market-fns.ts"
}, (opts) => getStockDisclosures.__executeServer(opts));
var getStockDisclosures = createServerFn({ method: "GET" }).validator(object({
	code: string().min(4).max(8),
	nameKo: string().max(40).optional()
})).handler(getStockDisclosures_createServerFn_handler, async ({ data }) => {
	const code = data.code.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
	return fetchStockDisclosureBundle(code, data.nameKo);
});
var getEtfMarket_createServerFn_handler = createServerRpc({
	id: "1f550e4983ce6593c02d459289b03dbcfd2ca8e5672e4ed84b0ed31936d8a6a3",
	name: "getEtfMarket",
	filename: "src/lib/market-fns.ts"
}, (opts) => getEtfMarket.__executeServer(opts));
var getEtfMarket = createServerFn({ method: "GET" }).validator(object({
	bucket: _enum([
		"retirement",
		"all",
		"new",
		"theme",
		"us",
		"bond"
	]).optional(),
	q: string().max(80).optional(),
	limit: number().int().min(1).max(300).optional()
}).optional()).handler(getEtfMarket_createServerFn_handler, async ({ data }) => {
	const bucket = data?.bucket ?? "retirement";
	const q = data?.q?.trim() ?? "";
	const limit = data?.limit ?? 120;
	const now = Date.now();
	let rows = etfCache.rows;
	if (!rows || now - etfCache.at >= ETF_TTL) {
		rows = await fetchAllEtfs();
		etfCache.rows = rows;
		etfCache.at = now;
	}
	let newRows = newEtfCache.rows;
	if (bucket === "new") {
		if (!newRows || now - newEtfCache.at >= NEW_ETF_TTL) {
			newRows = await fetchNewEtfs(48);
			newEtfCache.rows = newRows;
			newEtfCache.at = now;
		}
	}
	const base = bucket === "new" ? newRows ?? filterEtfBucket(rows, "new") : filterEtfBucket(rows, bucket);
	const sorted = [...q ? searchEtfsInList(base, q, { retirementOnly: bucket !== "all" }) : base].sort((a, b) => b.volume - a.volume);
	const stats = {
		total: rows.length,
		retirementEligible: rows.filter((e) => e.retirementEligible).length,
		leverageExcluded: rows.filter((e) => e.isLeverageOrInverse).length,
		newCandidates: rows.filter((e) => e.isNewCandidate && e.retirementEligible).length
	};
	return {
		etfs: sorted.slice(0, limit),
		stats,
		bucket,
		q,
		fetchedAt: new Date(etfCache.at).toISOString(),
		source: "naver-etf-list",
		note: bucket === "retirement" ? "레버리지·인버스·파생(2X) ETF 제외. 운영사 DC 허용 목록과 다를 수 있습니다." : bucket === "new" ? "상장일은 일봉 이력 최초일로 추정. 최근 1년 이내 우선 표시." : "한국거래소 상장 ETF · 네이버 금융 시세."
	};
});
var etfNewsCache = {
	at: 0,
	data: null
};
var ETF_NEWS_TTL = 18e4;
var getEtfListingNews_createServerFn_handler = createServerRpc({
	id: "958e0e687e7dc66dfb3df70d2a767358d6db1234c44cbf9a9b449ac225dd3e84",
	name: "getEtfListingNews",
	filename: "src/lib/market-fns.ts"
}, (opts) => getEtfListingNews.__executeServer(opts));
var getEtfListingNews = createServerFn({ method: "GET" }).handler(getEtfListingNews_createServerFn_handler, async () => {
	const now = Date.now();
	if (etfNewsCache.data && now - etfNewsCache.at < ETF_NEWS_TTL) return {
		...etfNewsCache.data,
		cached: true
	};
	const pack = await fetchEtfListingNews(48);
	etfNewsCache.data = pack;
	etfNewsCache.at = now;
	return {
		...pack,
		cached: false
	};
});
var getEtfBundle_createServerFn_handler = createServerRpc({
	id: "53180af1c07730e82baef51d15e76df4b7cb48694d71483a894406251d5d9db7",
	name: "getEtfBundle",
	filename: "src/lib/market-fns.ts"
}, (opts) => getEtfBundle.__executeServer(opts));
var getEtfBundle = createServerFn({ method: "GET" }).validator(object({ code: string().min(4).max(8) })).handler(getEtfBundle_createServerFn_handler, async ({ data }) => {
	const code = normalizeEtfCode(data.code);
	if (!ETF_CODE_RE.test(code)) return { error: "not_found" };
	const [detail, holdingPack] = await Promise.all([fetchEtfDetail(code), fetchEtfHoldings(code).catch(() => ({
		holdings: [],
		asOf: null,
		source: "공식 편입내역 없음",
		sourceKind: "none",
		officialCount: 0,
		issuerUrl: null
	}))]);
	if (!detail.etf) return { error: "not_found" };
	const krCodes = [...new Set(holdingPack.holdings.map((h) => h.code).filter((c) => Boolean(c)))];
	const usCodes = [...new Set(holdingPack.holdings.map((h) => h.reutersCode).filter((c) => Boolean(c) && !krCodes.includes(c)))];
	const metaByCode = Object.fromEntries(holdingPack.holdings.filter((h) => h.code).map((h) => [h.code, {
		nameKo: h.nameKo,
		nameEn: h.nameKo,
		sectorId: "electronics",
		market: h.market ?? "KOSPI"
	}]));
	const [stockQuotes, worldQuotes, usdKrw] = await Promise.all([
		krCodes.length > 0 ? fetchRealtimeQuotes(krCodes, metaByCode).catch(() => []) : Promise.resolve([]),
		usCodes.length > 0 ? fetchWorldQuotes(usCodes).catch(() => ({})) : Promise.resolve({}),
		usCodes.length > 0 ? fetchUsdKrw().catch(() => 0) : Promise.resolve(0)
	]);
	const qmap = {};
	for (const q of stockQuotes) qmap[q.code] = {
		price: q.price,
		change: q.change,
		changePct: q.changePct,
		volume: q.volume,
		currency: "KRW"
	};
	for (const [rc, q] of Object.entries(worldQuotes)) qmap[rc] = q;
	const holdingsWithQuotes = holdingPack.holdings.map((h) => {
		const q = h.code && qmap[h.code] || h.reutersCode && qmap[h.reutersCode] || void 0;
		return {
			nameKo: h.nameKo,
			code: h.code,
			reutersCode: h.reutersCode,
			nation: h.nation,
			market: h.market,
			isin: h.isin,
			weight: h.weight,
			weightSource: h.weightSource,
			quantity: h.quantity,
			asOf: h.asOf,
			isCash: h.isCash,
			isBond: h.isBond,
			isFuture: h.isFuture,
			isOverseas: h.isOverseas,
			isKoreanEquity: h.isKoreanEquity,
			isKoreanEtf: h.isKoreanEtf,
			assetClass: h.assetClass,
			quote: q ? {
				price: q.price,
				change: q.change,
				changePct: q.changePct,
				volume: q.volume,
				currency: q.currency
			} : null
		};
	});
	const holdings = fillLiveMarketWeights(holdingsWithQuotes, usdKrw).rows;
	const sleeveMap = /* @__PURE__ */ new Map();
	for (const h of holdings) {
		if (h.weight == null) continue;
		if (h.weightSource !== "official" && h.weightSource !== "live") continue;
		sleeveMap.set(h.assetClass, (sleeveMap.get(h.assetClass) ?? 0) + h.weight);
	}
	const allocation = [...sleeveMap.entries()].map(([id, weight]) => ({
		id,
		label: ETF_ASSET_CLASS_LABEL[id],
		weight
	})).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
	const officialWeightSum = allocation.reduce((s, a) => s + a.weight, 0);
	const officialCount = holdings.filter((h) => h.weightSource === "official").length;
	const liveCount = holdings.filter((h) => h.weightSource === "live").length;
	const weightBasis = officialCount > 0 ? "official" : liveCount > 0 ? "live" : "none";
	const quotedCount = holdings.filter((h) => h.quote && h.quote.price > 0).length;
	const hasOfficialBasket = holdings.length > 0;
	const themeStocks = hasOfficialBasket ? [] : detail.relatedCodes.map((c) => {
		const meta = UNIVERSE.find((u) => u.code === c);
		return {
			code: c,
			nameKo: meta?.nameKo ?? c,
			nameEn: meta?.nameEn ?? c,
			sectorId: meta?.sectorId,
			quote: null
		};
	});
	const missingOfficial = holdings.filter((h) => h.weight == null).length;
	const themeNote = hasOfficialBasket ? weightBasis === "official" ? `비중은 운용사·KRX 공식 공시만 사용합니다(추정 없음). 출처: ${holdingPack.source}. 국내 시세는 KRX(네이버 중계), 해외 시세는 네이버 해외주식입니다. 채권·선물·현금은 지분 시세가 없어 ISIN·수량을 표시합니다.${missingOfficial ? ` 공식 비중이 없는 ${missingOfficial}개 종목은 — 로 둡니다.` : ""}` : weightBasis === "live" ? `공식 NAV 비중이 없어, 편입 수량 × 조회된 실시간 시세(달러는 원/달러)로 시가 비중을 냈습니다. 가격이 비거나 채권·선물이 있으면 일부만 100%로 늘리지 않습니다. 출처: ${holdingPack.source}.` : `출처: ${holdingPack.source}. 공식 NAV 비중도, 전 종목을 시세로 나눌 수도 없어 비중은 — 입니다. 국내 시세는 KRX(네이버 중계), 해외 시세는 네이버 해외주식입니다.` : "공식 편입내역을 받지 못해 테마 매핑으로 대체합니다. 비중은 표시하지 않습니다.";
	return {
		etf: detail.etf,
		issuer: detail.issuer,
		description: detail.description,
		descriptionFormatted: detail.descriptionFormatted,
		themes: detail.themes,
		themeLabels: detail.themeLabels,
		fee: detail.fee,
		nav: detail.nav,
		marketValue: detail.marketValue,
		holdings,
		holdingsAsOf: holdingPack.asOf,
		holdingsSource: holdingPack.source,
		holdingsSourceKind: holdingPack.sourceKind,
		holdingsIssuerUrl: holdingPack.issuerUrl ?? null,
		holdingsCount: holdings.length,
		officialCount,
		liveCount,
		weightBasis,
		officialWeightSum,
		quotedCount,
		krEquityCount: holdings.filter((h) => h.isKoreanEquity).length,
		allocation,
		themeStocks,
		peerEtfs: detail.relatedEtfs,
		peerNote: "동일 테마·밸류체인 ETF입니다. (지수 메가캡 비교 목록이 아닙니다.)",
		themeNote,
		usdKrw,
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
});
var getUsLinkDesk_createServerFn_handler = createServerRpc({
	id: "f52dc16aa5a4dbef8932d53da7a78136dd3815103ce8fd839ab0848dc7c35b11",
	name: "getUsLinkDesk",
	filename: "src/lib/market-fns.ts"
}, (opts) => getUsLinkDesk.__executeServer(opts));
var getUsLinkDesk = createServerFn({ method: "GET" }).handler(getUsLinkDesk_createServerFn_handler, async () => {
	const codes = US_LINKED_CODES.slice(0, 28);
	const [quotes, live] = await Promise.all([fetchRealtimeQuotes(codes), fetchUsLinkLiveFeeds()]);
	return {
		quotes,
		briefs: US_POLICY_BRIEFS,
		feeds: {
			aiRace: live.aiRace,
			policy: live.policy,
			industry: live.industry
		},
		news: live.stockNews,
		research: live.research,
		fetchedAt: live.fetchedAt
	};
});
var getUsOfficialPolicy_createServerFn_handler = createServerRpc({
	id: "f9e5b26032bcb7dd5ceae5cf107843715380b06b12481625af8fab1a61d3c6c2",
	name: "getUsOfficialPolicy",
	filename: "src/lib/market-fns.ts"
}, (opts) => getUsOfficialPolicy.__executeServer(opts));
var getUsOfficialPolicy = createServerFn({ method: "GET" }).handler(getUsOfficialPolicy_createServerFn_handler, async () => {
	const { fetchUsOfficialPolicy } = await import("./us-official-research-B2JCCI2h.mjs");
	return fetchUsOfficialPolicy();
});
var getUsOfficialUniverse_createServerFn_handler = createServerRpc({
	id: "a398b94dab0e26b2679346ed1504000b9dd7747f368736a3f1c1b30ca0efc3db",
	name: "getUsOfficialUniverse",
	filename: "src/lib/market-fns.ts"
}, (opts) => getUsOfficialUniverse.__executeServer(opts));
var getUsOfficialUniverse = createServerFn({ method: "GET" }).handler(getUsOfficialUniverse_createServerFn_handler, async () => {
	const { fetchUsOfficialUniverse } = await import("./us-official-research-B2JCCI2h.mjs");
	return fetchUsOfficialUniverse();
});
var getUsOfficialCompany_createServerFn_handler = createServerRpc({
	id: "62954cbe6ed624015e6ae33cf86fcecc6945b9bf459f8abc95ef84f3c7302614",
	name: "getUsOfficialCompany",
	filename: "src/lib/market-fns.ts"
}, (opts) => getUsOfficialCompany.__executeServer(opts));
var getUsOfficialCompany = createServerFn({ method: "GET" }).validator(object({ symbol: string().trim().min(1).max(12) })).handler(getUsOfficialCompany_createServerFn_handler, async ({ data }) => {
	const { fetchUsOfficialCompany } = await import("./us-official-research-B2JCCI2h.mjs");
	return fetchUsOfficialCompany(data.symbol);
});
var getUsOfficialReport_createServerFn_handler = createServerRpc({
	id: "162a03eb73c1068bbf58ffcf83b1f34a32ae0d5d303189029ac364c8919906da",
	name: "getUsOfficialReport",
	filename: "src/lib/market-fns.ts"
}, (opts) => getUsOfficialReport.__executeServer(opts));
var getUsOfficialReport = createServerFn({ method: "GET" }).validator(object({ id: string().trim().min(3).max(180) })).handler(getUsOfficialReport_createServerFn_handler, async ({ data }) => {
	const { fetchUsOfficialReport } = await import("./us-official-research-B2JCCI2h.mjs");
	return fetchUsOfficialReport(data.id);
});
var V2_TYPES = [
	"market",
	"company",
	"industry",
	"invest",
	"economy",
	"debenture"
];
var getResearchV2_createServerFn_handler = createServerRpc({
	id: "1e043142b984a445c8fbb7fa56fb21b08e0f6acc0e8d1155afb1bdf2a548f6be",
	name: "getResearchV2",
	filename: "src/lib/market-fns.ts"
}, (opts) => getResearchV2.__executeServer(opts));
var getResearchV2 = createServerFn({ method: "GET" }).validator(object({
	type: _enum(V2_TYPES),
	index: number().int().min(0).max(200).default(0),
	size: number().int().min(1).max(50).default(20),
	itemCodes: array(string().regex(/^[0-9A-Z]{6}$/)).max(10).optional()
})).handler(getResearchV2_createServerFn_handler, async ({ data }) => {
	const { fetchResearchV2List } = await import("./research-v2-DNVSaUnS.mjs");
	return fetchResearchV2List({
		type: data.type,
		index: data.index,
		size: data.size,
		itemCodes: data.itemCodes
	});
});
var getResearchV2Detail_createServerFn_handler = createServerRpc({
	id: "c36e8a86edb908a7b4f8479449dead1d41987096122802bef08f8aed44518632",
	name: "getResearchV2Detail",
	filename: "src/lib/market-fns.ts"
}, (opts) => getResearchV2Detail.__executeServer(opts));
var getResearchV2Detail = createServerFn({ method: "GET" }).validator(object({
	type: _enum(V2_TYPES),
	nid: number().int().positive(),
	itemCode: string().regex(/^[0-9A-Z]{6}$/).optional()
})).handler(getResearchV2Detail_createServerFn_handler, async ({ data }) => {
	const { fetchResearchV2Detail } = await import("./research-v2-DNVSaUnS.mjs");
	return fetchResearchV2Detail(data.type, data.nid, data.itemCode);
});
var resolveResearchOriginal_createServerFn_handler = createServerRpc({
	id: "4bd52a35d9b41432c406a3498236398eb58afdb9f5ea3cff08c10dccce87d194",
	name: "resolveResearchOriginal",
	filename: "src/lib/market-fns.ts"
}, (opts) => resolveResearchOriginal.__executeServer(opts));
var resolveResearchOriginal = createServerFn({ method: "GET" }).validator(object({
	type: _enum(V2_TYPES),
	nid: number().int().positive()
})).handler(resolveResearchOriginal_createServerFn_handler, async ({ data }) => {
	const { resolveResearchOriginal: resolve } = await import("./research-v2-DNVSaUnS.mjs");
	return resolve(data.type, data.nid);
});
var getResearchBriefing_createServerFn_handler = createServerRpc({
	id: "7535ab763956273b1340d9d7a6ab2cb0d30a41f762613441900a615fac6075ae",
	name: "getResearchBriefing",
	filename: "src/lib/market-fns.ts"
}, (opts) => getResearchBriefing.__executeServer(opts));
var getResearchBriefing = createServerFn({ method: "GET" }).handler(getResearchBriefing_createServerFn_handler, async () => {
	const { fetchResearchBriefing } = await import("./research-v2-DNVSaUnS.mjs");
	return fetchResearchBriefing();
});
//#endregion
export { getChartData_createServerFn_handler, getDisclosureDetail_createServerFn_handler, getEtfBundle_createServerFn_handler, getEtfListingNews_createServerFn_handler, getEtfMarket_createServerFn_handler, getIndustryResearch_createServerFn_handler, getKrxDisclosureDesk_createServerFn_handler, getMarketIndices_createServerFn_handler, getMarketQuotes_createServerFn_handler, getQuotesByCodes_createServerFn_handler, getResearchBriefing_createServerFn_handler, getResearchDesk_createServerFn_handler, getResearchPdf_createServerFn_handler, getResearchV2Detail_createServerFn_handler, getResearchV2_createServerFn_handler, getScanDisclosures_createServerFn_handler, getStockBundle_createServerFn_handler, getStockDisclosures_createServerFn_handler, getStockNews_createServerFn_handler, getUsLinkDesk_createServerFn_handler, getUsOfficialCompany_createServerFn_handler, getUsOfficialPolicy_createServerFn_handler, getUsOfficialReport_createServerFn_handler, getUsOfficialUniverse_createServerFn_handler, getUsStreet_createServerFn_handler, getValuationSeries_createServerFn_handler, resolveResearchOriginal_createServerFn_handler };
