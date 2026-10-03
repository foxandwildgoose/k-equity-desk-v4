import { a as recordFailure, o as recordResult, s as setHealthNote } from "./health-z1OjkYee.mjs";
import { n as fetchJsonWithPolicy } from "./http-CCgilygj.mjs";
import { s as parseSourceTime } from "./time-By5ScNNo.mjs";
import { a as newsItemToFeed, d as sortReportsNewestFirst, l as sortNewestFirst } from "./mappers-DlpCqw-E.mjs";
import { a as ROBOTICS_US_ETFS, b as roboticsKey, f as discoverRobotEtfs, g as pickExactListing, i as ROBOTICS_US, r as ROBOTICS_KR, s as ROBOT_ETF_NAME_RE, v as position52w, x as searchListedSecurities } from "./classify-DLKCwe5y.mjs";
import { d as issuerOfEtfName } from "./etf-news-D8YKQLOx.mjs";
import { u as isRoboticsText } from "./research-taxonomy-BpoDpMeG.mjs";
import { s as yahooChartSnapshot } from "./generic-CkkW1ZKu.mjs";
import { a as fetchNews, s as fetchRealtimeQuotes } from "./naver-market-C1ZunDb_.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/robotics-B6CXjHtc.js
/**
* Robotics section server layer (F6.1 / F6.5–F6.7).
*
* - Universe: KR seed codes verified via Naver quotes, KR candidates/exposure
*   names resolved by EXACT name via the security search, US seed verified via
*   the Yahoo chart endpoint. Anything unresolved is hidden and listed in
*   Source Health (`robotics-universe`). Nothing is guessed.
* - ETF: KR by name regex over the live ETF list; US seed verified via Yahoo.
* - Research: v2 industry (robot keywords), v2 company for robot tickers
*   (≤ 10 itemCodes per call), US Street notes for robot symbols.
*/
async function mapLimit(list, limit, fn) {
	const out = new Array(list.length);
	let i = 0;
	const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
		while (i < list.length) {
			const idx = i++;
			out[idx] = await fn(list[idx]);
		}
	});
	await Promise.all(workers);
	return out;
}
var nameCache = /* @__PURE__ */ new Map();
var NAME_OK_TTL = 432e5;
var NAME_MISS_TTL = 18e5;
async function resolveKrName(name) {
	const hit = nameCache.get(name);
	const now = Date.now();
	if (hit && now - hit.at < (hit.code ? NAME_OK_TTL : NAME_MISS_TTL)) return hit;
	try {
		const hits = await searchListedSecurities(name);
		const pick = pickExactListing(name, hits);
		const row = {
			at: now,
			code: pick?.code ?? null,
			reason: pick ? void 0 : "종목 검색에서 정확히 같은 이름이 없음"
		};
		nameCache.set(name, row);
		return row;
	} catch (err) {
		return {
			code: null,
			reason: `종목 검색 실패: ${err instanceof Error ? err.message.slice(0, 60) : "error"}`
		};
	}
}
var US_SYMBOL_RE = /^[A-Z][A-Z0-9.]{0,9}$/;
async function yahooSnap(symbol) {
	if (!US_SYMBOL_RE.test(symbol)) return null;
	try {
		const json = await fetchJsonWithPolicy(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`, {
			sourceId: "yahoo-chart",
			ttlMs: 6e4
		});
		const s = yahooChartSnapshot(json);
		if (!s || s.price == null) return null;
		return {
			price: s.price,
			changePct: s.changePct,
			high52: s.high52,
			low52: s.low52,
			volume: s.volume,
			name: s.name,
			asOf: s.asOf,
			delay: s.delayMinutes
		};
	} catch {
		return null;
	}
}
var universeCache = /* @__PURE__ */ new Map();
var UNIVERSE_TTL = 6e4;
function krRowFrom(e, q) {
	return {
		key: roboticsKey("KR", e.code),
		market: "KR",
		code: e.code,
		name: e.name,
		nameEn: e.nameEn ?? null,
		segment: e.segment ?? null,
		exposure: e.exposure ?? null,
		kind: e.kind,
		price: q.price > 0 ? q.price : null,
		changePct: Number.isFinite(q.changePct) ? q.changePct : null,
		pos52w: position52w(q.price, q.low52 || null, q.high52 || null),
		marketCap: q.marketCap > 0 ? q.marketCap : null,
		volume: q.volume > 0 ? q.volume : null,
		currency: "KRW",
		asOf: null,
		source: "네이버 시세",
		delay: "약 30초 캐시"
	};
}
/** Resolve + quote the robotics universe (base config ∪ user additions). */
async function resolveRoboticsUniverse(opts = {}) {
	const key = JSON.stringify([opts.addedKr ?? [], opts.addedUs ?? []]);
	const now = Date.now();
	const cached = universeCache.get(key);
	if (!opts.force && cached && now - cached.at < UNIVERSE_TTL) return cached.data;
	const unresolved = [];
	const krEntries = [];
	for (const e of ROBOTICS_KR.filter((x) => x.kind === "seed")) krEntries.push({
		code: e.code,
		name: e.name,
		nameEn: e.nameEn,
		segment: e.segment,
		exposure: e.exposure,
		kind: e.kind
	});
	const resolved = await mapLimit(ROBOTICS_KR.filter((x) => x.kind === "candidate" || x.kind === "exposure"), 3, async (e) => ({
		e,
		r: await resolveKrName(e.name)
	}));
	for (const { e, r } of resolved) if (r.code) krEntries.push({
		code: r.code,
		name: e.name,
		nameEn: e.nameEn,
		segment: e.segment,
		exposure: e.exposure,
		kind: e.kind
	});
	else unresolved.push({
		market: "KR",
		name: e.name,
		reason: r.reason ?? "이름으로 종목을 찾지 못함"
	});
	for (const c of opts.addedKr ?? []) {
		if (!/^[0-9][0-9A-Z]{5}$/.test(c.code)) continue;
		if (krEntries.some((x) => x.code === c.code)) continue;
		krEntries.push({
			code: c.code,
			name: c.name,
			segment: c.segment ?? null,
			exposure: c.exposure ?? null,
			kind: "custom"
		});
	}
	let krQuotes = [];
	let krError = null;
	try {
		krQuotes = await fetchRealtimeQuotes(krEntries.map((e) => e.code));
	} catch (err) {
		krError = err instanceof Error ? err.message.slice(0, 80) : "error";
	}
	const qByCode = new Map(krQuotes.map((q) => [q.code, q]));
	const kr = [];
	for (const e of krEntries) {
		const q = qByCode.get(e.code);
		if (!q || !(q.price > 0)) {
			unresolved.push({
				market: "KR",
				name: e.name,
				code: e.code,
				reason: krError ? `시세 조회 실패 (${krError})` : "시세 응답에 없음 — 코드 확인 불가"
			});
			continue;
		}
		kr.push(krRowFrom(e, q));
	}
	const usEntries = ROBOTICS_US.map((e) => ({
		code: e.code,
		name: e.name,
		segment: e.segment,
		exposure: e.exposure,
		kind: e.kind
	}));
	for (const c of opts.addedUs ?? []) {
		const code = c.code.toUpperCase();
		if (!US_SYMBOL_RE.test(code) || usEntries.some((x) => x.code === code)) continue;
		usEntries.push({
			code,
			name: c.name || code,
			segment: c.segment ?? null,
			exposure: c.exposure ?? null,
			kind: "custom"
		});
	}
	const snaps = await mapLimit(usEntries, 4, async (e) => ({
		e,
		s: await yahooSnap(e.code)
	}));
	const us = [];
	for (const { e, s } of snaps) {
		if (!s) {
			unresolved.push({
				market: "US",
				name: e.name,
				code: e.code,
				reason: "Yahoo 차트 응답 없음 — 심볼 확인 불가"
			});
			continue;
		}
		us.push({
			key: roboticsKey("US", e.code),
			market: "US",
			code: e.code,
			name: e.name,
			nameEn: s.name,
			segment: e.segment,
			exposure: e.exposure,
			kind: e.kind,
			price: s.price,
			changePct: s.changePct,
			pos52w: position52w(s.price, s.low52, s.high52),
			marketCap: null,
			volume: s.volume,
			currency: "USD",
			asOf: s.asOf,
			source: "Yahoo Finance",
			delay: s.delay ? `지연 ${s.delay}분` : "지연 시세"
		});
	}
	const data = {
		kr,
		us,
		unresolved,
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	if (kr.length + us.length > 0) {
		recordResult("robotics-universe", {
			count: kr.length + us.length,
			adapterPath: "json"
		});
		universeCache.set(key, {
			at: now,
			data
		});
		if (universeCache.size > 20) universeCache.delete(universeCache.keys().next().value);
	} else recordFailure("robotics-universe", "유니버스 종목을 하나도 확인하지 못함 (시세·검색 소스 응답 없음)");
	setHealthNote("robotics-universe", "unresolved", unresolved.length ? `미확인 ${unresolved.length}건(화면에서 숨김): ${unresolved.map((u) => u.code ? `${u.name}(${u.code})` : u.name).join(", ")}` : null);
	return data;
}
async function fetchRoboticsEtfs() {
	let krError = null;
	let kr = [];
	try {
		const { fetchAllEtfs } = await import("./etf-market-S8CEBu8d.mjs");
		const list = await fetchAllEtfs();
		kr = discoverRobotEtfs(list, ROBOT_ETF_NAME_RE).sort((a, b) => b.marketSum - a.marketSum).map((e) => ({
			market: "KR",
			code: e.code,
			name: e.nameKo,
			price: e.price > 0 ? e.price : null,
			changePct: Number.isFinite(e.changePct) ? e.changePct : null,
			volume: e.volume > 0 ? e.volume : null,
			marketSum: e.marketSum > 0 ? e.marketSum : null,
			issuer: e.issuer ?? issuerOfEtfName(e.nameKo),
			source: "네이버 ETF 목록",
			delay: "약 60초 캐시"
		}));
	} catch (err) {
		krError = err instanceof Error ? err.message.slice(0, 80) : "error";
	}
	const snaps = await mapLimit(ROBOTICS_US_ETFS, 3, async (s) => ({
		s,
		q: await yahooSnap(s)
	}));
	const us = [];
	const unresolved = [];
	for (const { s, q } of snaps) {
		if (!q) {
			unresolved.push(s);
			continue;
		}
		us.push({
			market: "US",
			code: s,
			name: q.name ?? s,
			price: q.price,
			changePct: q.changePct,
			volume: q.volume,
			marketSum: null,
			issuer: null,
			source: "Yahoo Finance",
			delay: q.delay ? `지연 ${q.delay}분` : "지연 시세"
		});
	}
	setHealthNote("robotics-universe", "us-etf", unresolved.length ? `미확인 미국 로봇 ETF(숨김): ${unresolved.join(", ")}` : null);
	return {
		kr,
		us,
		unresolved,
		krError,
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
async function fetchRoboticsResearch(krCodes) {
	const { fetchCompanyResearchFor, fetchResearchV2List } = await import("./research-v2-DNVSaUnS.mjs");
	const codes = [...new Set(krCodes.filter((c) => /^[0-9][0-9A-Z]{5}$/.test(c)))].slice(0, 30);
	const [industryPages, companyPages] = await Promise.all([Promise.all([0, 1].map((index) => fetchResearchV2List({
		type: "industry",
		index,
		size: 40
	}))), codes.length ? fetchCompanyResearchFor(codes, 30) : Promise.resolve([])]);
	const text = (r) => `${r.title} ${r.preview ?? ""} ${r.summary ?? ""} ${r.tags.join(" ")}`;
	const industry = sortReportsNewestFirst(industryPages.flatMap((p) => p.reports).filter((r) => isRoboticsText(text(r))));
	const company = sortReportsNewestFirst(companyPages.flatMap((p) => p.reports));
	const all = [...industryPages, ...companyPages];
	return {
		industry,
		company,
		paths: [...new Set(all.map((p) => p.path))],
		errors: all.map((p) => p.error).filter((e) => Boolean(e)),
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
async function fetchRoboticsStreet(symbols) {
	const { fetchUsStreetPack } = await import("./us-street-Dx2s8JR4.mjs").then((n) => n.i);
	const list = [...new Set(symbols.map((s) => s.toUpperCase()).filter((s) => US_SYMBOL_RE.test(s)))].slice(0, 24);
	const chunks = [];
	for (let i = 0; i < list.length; i += 12) chunks.push(list.slice(i, i + 12));
	const ok = (await Promise.all(chunks.map((c) => fetchUsStreetPack(c).catch(() => null)))).filter((p) => p != null);
	return {
		notes: ok.flatMap((p) => p.notes),
		headlines: ok.flatMap((p) => p.headlines),
		note: ok[0]?.note ?? "월가 공개 피드를 받지 못했습니다.",
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
var krNewsLatest = /* @__PURE__ */ new Map();
var KR_NEWS_TTL = 9e5;
async function latestKrNewsAt(code) {
	const hit = krNewsLatest.get(code);
	if (hit && Date.now() - hit.at < KR_NEWS_TTL) return hit.iso;
	try {
		const items = await fetchNews(code, 1);
		let best = null;
		for (const n of items) {
			const t = parseSourceTime(n.datetime, { zone: "Asia/Seoul" });
			const ms = t.iso ? Date.parse(t.iso) : NaN;
			if (Number.isFinite(ms) && (best == null || ms > best)) best = ms;
		}
		const iso = best != null ? new Date(best).toISOString() : null;
		krNewsLatest.set(code, {
			at: Date.now(),
			iso
		});
		return iso;
	} catch {
		return null;
	}
}
async function fetchRoboticsCompanyMeta(krCodes, usSymbols) {
	const codes = [...new Set(krCodes.filter((c) => /^[0-9][0-9A-Z]{5}$/.test(c)))].slice(0, 40);
	const [newsTimes, research, street] = await Promise.all([
		mapLimit(codes, 3, async (c) => [c, await latestKrNewsAt(c)]),
		fetchRoboticsResearch(codes).catch(() => null),
		fetchRoboticsStreet(usSymbols).catch(() => null)
	]);
	const latestNews = {};
	const latestResearch = {};
	for (const [c, iso] of newsTimes) latestNews[roboticsKey("KR", c)] = iso;
	for (const r of research?.company ?? []) {
		if (!r.code) continue;
		const k = roboticsKey("KR", r.code);
		if (latestResearch[k]) continue;
		latestResearch[k] = parseSourceTime(r.date, { zone: "Asia/Seoul" }).iso;
	}
	const maxIso = (a, b) => !a ? b : !b ? a : Date.parse(b) > Date.parse(a) ? b : a;
	for (const h of street?.headlines ?? []) {
		const k = roboticsKey("US", h.symbol);
		latestNews[k] = maxIso(latestNews[k], h.publishedAt);
	}
	for (const n of street?.notes ?? []) {
		const k = roboticsKey("US", n.symbol);
		latestResearch[k] = maxIso(latestResearch[k], n.publishedAt);
	}
	return {
		latestNews,
		latestResearch,
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
async function fetchRoboticsCompanyNews(market, code, name) {
	const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
	try {
		if (market === "KR") {
			const items = (await fetchNews(code, 1)).map((n) => newsItemToFeed(n, {
				sourceId: "naver-stock-news",
				sourceName: "네이버 종목 뉴스",
				tier: 3,
				fetchedAt
			}, { tickers: [{
				market: "KR",
				code
			}] })).filter((x) => x != null);
			return {
				items: sortNewestFirst(items),
				source: "네이버 종목 뉴스",
				error: null,
				fetchedAt
			};
		}
		const { runGoogleNews } = await import("./news-DxJZGpZd.mjs").then((n) => n.n).then((n) => n.t);
		const items = (await runGoogleNews("gn-robotics-en", [{
			q: `"${name.replace(/"/g, "")}" when:30d`,
			locale: "en"
		}], {})).items.map((it) => it.tickers.some((t) => t.code === code) ? it : {
			...it,
			tickers: [...it.tickers, {
				market: "US",
				code
			}]
		});
		return {
			items: sortNewestFirst(items),
			source: "Google News (EN)",
			error: null,
			fetchedAt
		};
	} catch (err) {
		return {
			items: [],
			source: market === "KR" ? "네이버 종목 뉴스" : "Google News (EN)",
			error: err instanceof Error ? err.message.slice(0, 120) : "error",
			fetchedAt
		};
	}
}
//#endregion
export { fetchRoboticsCompanyMeta, fetchRoboticsCompanyNews, fetchRoboticsEtfs, fetchRoboticsResearch, fetchRoboticsStreet, resolveRoboticsUniverse };
