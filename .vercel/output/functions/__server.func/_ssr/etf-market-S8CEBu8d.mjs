import { r as toReadableDoc } from "./readable-text-D28LomX7.mjs";
import { d as normalizeKrTicker, t as UNIVERSE } from "./universe-BLkYDatc.mjs";
import { n as rankByQuery, t as matchesSearchQuery } from "./search-match-BMQS9B1C.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/etf-market-S8CEBu8d.js
function asKrCode$1(v) {
	const s = String(v ?? "").trim().toUpperCase();
	return /^[0-9A-Z]{6}$/.test(s) ? s : null;
}
/** KRX equity ISIN KR7 + 6-digit ticker (e.g. KR7005930003 → 005930). */
function krCodeFromIsin(isin) {
	const s = String(isin ?? "").toUpperCase();
	const m = /^KR[0-9](\d{6})/.exec(s);
	return m ? asKrCode$1(m[1]) : null;
}
/** NH-Amundi HANARO fund list: ticker → product uid. */
function parseHanaroFundCatalog(html) {
	const map = /* @__PURE__ */ new Map();
	const re = /href="\/fund\/([A-F0-9]+)"[^>]*class="baseInfo"([\s\S]{0,2500}?)종목코드<\/dt>\s*<dd>([0-9A-Z]{6})<\/dd>/gi;
	let m;
	while (m = re.exec(html)) {
		const uid = m[1];
		const ticker = m[3].toUpperCase();
		if (uid && ticker) map.set(ticker, uid);
	}
	return map;
}
/** Default PDF date on a HANARO product page (`2026.09.23` → `2026-09-23`). */
function parseHanaroPdfDate(html) {
	const m = /id="pdfDate"[\s\S]{0,800}?value="(\d{4})\.(\d{2})\.(\d{2})"/.exec(html);
	if (!m) return null;
	return `${m[1]}-${m[2]}-${m[3]}`;
}
/**
* HANARO `/api/v1/fund/{uid}/get-fund-holdings-list` HTML rows.
* Column order: index, ISIN/code, name, quantity, eval KRW, weight %.
* `설정현금액` is the CU total (always 100%), not a holding.
*/
function parseHanaroHoldingsHtml(html, asOf) {
	const rows = [];
	const re = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
	let m;
	while (m = re.exec(html)) {
		const cells = [...m[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((x) => stripHtml(x[1] ?? ""));
		if (cells.length < 6) continue;
		const codeRaw = (cells[1] ?? "").toUpperCase();
		const nameKo = cells[2] ?? "";
		if (!nameKo || isCuNotionalName(nameKo)) continue;
		const isin = /^[A-Z]{2}[A-Z0-9]{10}$/.test(codeRaw) ? codeRaw : null;
		rows.push({
			nameKo,
			weight: officialNum(cells[5] ?? ""),
			quantity: officialNum(cells[3] ?? ""),
			asOf,
			code: krCodeFromIsin(isin),
			isin
		});
	}
	return rows;
}
/**
* Quantity × retrieved price, only when every holding can be valued.
* Does not run if any official NAV weight is already present.
* A bond, future, or unquoted name blocks the whole basket so an equity
* sleeve is never stretched to 100% (IBK 0238C0).
*/
function fillLiveMarketWeights(rows, usdKrw) {
	if (rows.some((row) => row.weightSource === "official" && row.weight != null)) return {
		rows,
		published: false
	};
	if (!rows.length) return {
		rows,
		published: false
	};
	const values = [];
	for (const row of rows) {
		const value = liveHoldingValueKrw(row, usdKrw);
		if (value == null) return {
			rows,
			published: false
		};
		values.push(value);
	}
	const total = values.reduce((sum, value) => sum + value, 0);
	if (!(Math.abs(total) > 0)) return {
		rows,
		published: false
	};
	return {
		published: true,
		rows: rows.map((row, i) => ({
			...row,
			weight: values[i] / total * 100,
			weightSource: "live"
		}))
	};
}
function liveHoldingValueKrw(row, usdKrw) {
	if (isCuNotionalName(row.nameKo)) return null;
	if (row.isCash) {
		if (row.quantity == null || !Number.isFinite(row.quantity)) return null;
		if (/달러|USD|외화/i.test(row.nameKo)) {
			if (!(usdKrw > 0)) return null;
			return row.quantity * usdKrw;
		}
		return row.quantity;
	}
	if (row.isBond || row.isFuture) return null;
	const price = row.quote?.price;
	if (price == null || !(price > 0) || row.quantity == null || !Number.isFinite(row.quantity)) return null;
	const fx = row.quote?.currency === "USD" ? usdKrw : 1;
	if (!(fx > 0)) return null;
	return row.quantity * price * fx;
}
/** CU notional / NAV header row — not a portfolio holding. */
function isCuNotionalName(name) {
	return /설정현금액|설정단위/.test(name);
}
function stripHtml(raw) {
	return raw.replace(/<[^>]+>/g, "").replace(/&/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function officialNum(raw) {
	const t = raw.replace(/,/g, "").replace(/%/g, "").trim();
	if (!t || t === "-") return null;
	const n = Number(t);
	return Number.isFinite(n) ? n : null;
}
function sumNavWeights(rows) {
	let sum = 0;
	for (const row of rows) {
		if (!row.nameKo || isCuNotionalName(row.nameKo)) continue;
		if (row.weight == null || !Number.isFinite(row.weight)) continue;
		sum += row.weight;
	}
	return sum;
}
function isCompleteOfficialWeightSum(sum) {
	return Number.isFinite(sum) && sum >= 90 && sum <= 110;
}
function prepareOfficialRows(rows) {
	return rows.filter((row) => {
		const name = String(row.nameKo ?? "").trim();
		return Boolean(name) && !isCuNotionalName(name);
	}).map((row) => ({
		...row,
		nameKo: String(row.nameKo).trim()
	})).sort(compareHoldingsByWeight);
}
/**
* Publish one basket. A candidate is usable only when its official weights
* sum to about 100% of NAV. Otherwise keep the names and drop every weight
* so a priced subset cannot be mistaken for the fund.
*/
function chooseOfficialBasket(candidates) {
	const ranked = [...candidates].sort((a, b) => b.priority - a.priority || b.rows.length - a.rows.length);
	for (const candidate of ranked) {
		const rows = prepareOfficialRows(candidate.rows);
		if (!rows.length) continue;
		if (!isCompleteOfficialWeightSum(sumNavWeights(rows))) continue;
		return {
			rows,
			source: candidate.source,
			sourceKind: candidate.sourceKind,
			issuerUrl: candidate.issuerUrl ?? null,
			asOf: candidate.asOf ?? null,
			weightsPublished: true
		};
	}
	for (const candidate of ranked) {
		const rows = prepareOfficialRows(candidate.rows).map((row) => row.weight == null ? row : {
			...row,
			weight: null
		});
		if (!rows.length) continue;
		return {
			rows,
			source: `${candidate.source} · 공식 NAV 비중 없음 (추정 비중은 표시하지 않음)`,
			sourceKind: candidate.sourceKind,
			issuerUrl: candidate.issuerUrl ?? null,
			asOf: candidate.asOf ?? null,
			weightsPublished: false
		};
	}
	return {
		rows: [],
		source: "공식 편입내역 없음",
		sourceKind: "none",
		issuerUrl: null,
		asOf: null,
		weightsPublished: false
	};
}
/** Which issuer PDF to request. Never guesses a family from a holding name. */
function issuerHoldingsFamily(etfName, issuer) {
	const name = etfName.trim();
	const house = issuer.trim();
	if (/^KODEX\b/i.test(name) || /삼성자산운용/.test(house) && /KODEX/i.test(name)) return "kodex";
	if (/^IBK\b/i.test(name) || /IBK자산운용|아이비케이/.test(house)) return "ibk";
	if (/^PLUS\b/i.test(name) || /한화/.test(house) && /PLUS/i.test(name)) return "plus";
	if (/^HANARO\b/i.test(name) || /NH-?\s*Amundi|NH아문디|엔에이치아문디/i.test(house)) return "hanaro";
	return "other";
}
/** Higher official/derived weight first. Missing weight goes last. */
function compareHoldingsByWeight(a, b) {
	const aw = a.weight;
	const bw = b.weight;
	if (aw == null && bw == null) return Math.abs(b.quantity ?? 0) - Math.abs(a.quantity ?? 0);
	if (aw == null) return 1;
	if (bw == null) return -1;
	if (bw !== aw) return bw - aw;
	return Math.abs(b.quantity ?? 0) - Math.abs(a.quantity ?? 0);
}
/** Strip legal wrappers so "IBK …액티브" matches the issuer catalog name. */
function normalizeIssuerFundName(name) {
	return name.toUpperCase().replace(/증권상장지수투자신탁|상장지수투자신탁|투자신탁|증권/g, "").replace(/\[[^\]]*\]/g, "").replace(/[^A-Z0-9가-힣+]/g, "");
}
function matchIbkProductId(etfName, catalog) {
	const key = normalizeIssuerFundName(etfName);
	if (key.length < 4) return null;
	const scored = [];
	for (const item of catalog) {
		const k = normalizeIssuerFundName(item.name);
		if (!k) continue;
		if (k === key) scored.push({
			id: item.id,
			rank: 0,
			delta: 0
		});
		else if (k.startsWith(key) || key.startsWith(k)) scored.push({
			id: item.id,
			rank: 1,
			delta: Math.abs(k.length - key.length)
		});
	}
	scored.sort((a, b) => a.rank - b.rank || a.delta - b.delta);
	return scored[0]?.id ?? null;
}
/** IBK자산운용 /api/etf/{id}/pdf — 설정현금액(100%) is the CU total, not a holding. */
function parseIbkPdfRows(content, asOf) {
	const rows = [];
	for (const item of content) {
		const nameKo = String(item.name ?? "").trim();
		if (!nameKo || isCuNotionalName(nameKo)) continue;
		const codeRaw = String(item.pdfCode ?? "").trim().toUpperCase();
		const isin = /^[A-Z]{2}[A-Z0-9]{10}$/.test(codeRaw) ? codeRaw : null;
		const weight = item.weight == null || !Number.isFinite(Number(item.weight)) ? null : Number(item.weight);
		const quantity = item.quantity == null || !Number.isFinite(Number(item.quantity)) ? null : Number(item.quantity);
		rows.push({
			nameKo,
			weight,
			quantity,
			asOf,
			code: krCodeFromIsin(isin),
			isin
		});
	}
	rows.sort(compareHoldingsByWeight);
	return rows;
}
/** Samsung KODEX `/api/v1/kodex/product/{fId}.do` → pdf.list.
* `ratio` is the issuer NAV weight. 설정현금액 is the CU total, not a holding.
* Null ratios are left null — never filled from evalA / sum(evalA).
*/
function parseKodexPdfRows(content, asOf) {
	const rows = [];
	for (const item of content) {
		const nameKo = String(item.secNm ?? "").trim();
		if (!nameKo || isCuNotionalName(nameKo)) continue;
		const weight = item.ratio == null || item.ratio === "" || !Number.isFinite(Number(item.ratio)) ? null : Number(item.ratio);
		const quantity = item.applyQ == null || item.applyQ === "" || !Number.isFinite(Number(item.applyQ)) ? null : Number(item.applyQ);
		const itm = String(item.itmNo ?? "").trim().toUpperCase();
		const isin = /^[A-Z]{2}[A-Z0-9]{10}$/.test(itm) ? itm : null;
		const code = isin ? krCodeFromIsin(isin) : asKrCode$1(itm.split(/\s+/)[0] ?? "");
		rows.push({
			nameKo,
			weight,
			quantity,
			asOf,
			code,
			isin
		});
	}
	rows.sort(compareHoldingsByWeight);
	return rows;
}
/**
* Live Korea ETF market (Naver Finance full list).
* Retirement filter: exclude leverage / inverse / 2X products (DC·IRP common rule).
* New listings: estimated from price history + alphanumeric KRX codes.
*/
var UA = "Mozilla/5.0 (compatible; KoreaEquityCommand/1.0; +https://x.ai) AppleWebKit/537.36";
function headers() {
	return {
		"User-Agent": UA,
		Accept: "application/json,text/plain,*/*",
		"Accept-Language": "ko-KR,ko;q=0.9",
		Referer: "https://finance.naver.com/sise/etf.naver"
	};
}
async function getText(url) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 25e3);
	try {
		const res = await fetch(url, {
			headers: headers(),
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
async function getJsonUtf8(url) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 2e4);
	try {
		const res = await fetch(url, {
			headers: {
				...headers(),
				Referer: "https://m.stock.naver.com/"
			},
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return JSON.parse(await res.text());
	} finally {
		clearTimeout(t);
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
/** KRX ETF codes: 6 digits OR 6 alphanumerics (e.g. 0090B0, 0226A0) */
var ETF_CODE_RE = /^[0-9A-Za-z]{6}$/;
function normalizeEtfCode(code) {
	return normalizeKrTicker(code);
}
var ETF_TAB_LABEL = {
	1: "국내 시장지수",
	2: "국내 업종·테마",
	3: "파생 (레버리지·인버스)",
	4: "해외 주식",
	5: "원자재",
	6: "채권",
	7: "혼합·기타"
};
var LEV_NAME_RE = /레버리지|인버스|곱버스|2X|3X|×2|x2|X2|인버스\s*2|선물인버스/i;
function isLeverageOrInverseName(name, tabCode) {
	if (tabCode === 3) return true;
	return LEV_NAME_RE.test(name);
}
/** Alphanumeric KRX codes tend to be newer listings (2024+) */
function isAlphanumericCode(code) {
	return /[A-Za-z]/.test(code);
}
var listCache = null;
var LIST_TTL = 6e4;
async function fetchAllEtfs(force = false) {
	const now = Date.now();
	if (!force && listCache && now - listCache.at < LIST_TTL) return listCache.rows;
	const text = await getText("https://finance.naver.com/api/sise/etfItemList.nhn");
	const rows = (JSON.parse(text).result?.etfItemList ?? []).map((it) => {
		const code = normalizeEtfCode(String(it.itemcode));
		const nameKo = String(it.itemname ?? "");
		const tabCode = Number(it.etfTabCode) || 0;
		const lev = isLeverageOrInverseName(nameKo, tabCode);
		const newCandidate = isAlphanumericCode(code) || it.threeMonthEarnRate == null || code.length === 6 && /^\d+$/.test(code) && Number(code) >= 48e4;
		return {
			code,
			nameKo,
			tabCode,
			tabLabel: ETF_TAB_LABEL[tabCode] ?? `유형 ${tabCode}`,
			price: num(it.nowVal),
			change: num(it.changeVal),
			changePct: num(it.changeRate),
			nav: num(it.nav),
			threeMonthEarnRate: it.threeMonthEarnRate == null ? null : num(it.threeMonthEarnRate),
			volume: num(it.quant),
			amount: num(it.amonut),
			marketSum: num(it.marketSum),
			retirementEligible: !lev,
			isLeverageOrInverse: lev,
			isNewCandidate: newCandidate && !lev,
			source: "naver-etf-list"
		};
	});
	listCache = {
		at: now,
		rows
	};
	return rows;
}
async function fetchEtfListingDate(code) {
	const c = normalizeEtfCode(code);
	let oldest = null;
	let newest = null;
	for (let page = 1; page <= 90; page++) try {
		const rows = await getJsonUtf8(`https://m.stock.naver.com/api/stock/${c}/price?page=${page}&pageSize=20`);
		if (!rows?.length) break;
		if (!newest) newest = rows[0]?.localTradedAt ?? null;
		oldest = rows[rows.length - 1]?.localTradedAt ?? oldest;
		if (rows.length < 20) break;
	} catch {
		break;
	}
	if (!oldest) return null;
	const listed = new Date(oldest);
	const days = Math.max(0, Math.round((Date.now() - listed.getTime()) / 864e5));
	return {
		listedAt: Number.isNaN(listed.getTime()) ? oldest.slice(0, 10) : `${listed.getFullYear()}-${String(listed.getMonth() + 1).padStart(2, "0")}-${String(listed.getDate()).padStart(2, "0")}`,
		daysListed: days
	};
}
/** Enrich newest candidates with listing dates (bounded concurrency). */
async function fetchNewEtfs(limit = 40) {
	const candidates = (await fetchAllEtfs()).filter((e) => e.isNewCandidate && e.retirementEligible).sort((a, b) => {
		const aAlpha = isAlphanumericCode(a.code) ? 1 : 0;
		const bAlpha = isAlphanumericCode(b.code) ? 1 : 0;
		if (aAlpha !== bAlpha) return bAlpha - aAlpha;
		return b.code.localeCompare(a.code);
	}).slice(0, Math.min(60, limit + 20));
	const enriched = [];
	for (let i = 0; i < candidates.length; i += 6) {
		const batch = candidates.slice(i, i + 6);
		const parts = await Promise.all(batch.map(async (etf) => {
			const listed = await fetchEtfListingDate(etf.code).catch(() => null);
			return {
				...etf,
				listedAt: listed?.listedAt,
				daysListed: listed?.daysListed
			};
		}));
		enriched.push(...parts);
	}
	return enriched.filter((e) => e.daysListed == null || e.daysListed <= 90).sort((a, b) => {
		const da = a.daysListed ?? 9999;
		const db = b.daysListed ?? 9999;
		if (da !== db) return da - db;
		return b.code.localeCompare(a.code);
	}).slice(0, limit);
}
/** Industry themes and related keywords for peer scoring */
var ETF_THEME_GROUPS = [
	{
		id: "shipbuilding",
		label: "조선·해운·기자재",
		keywords: [
			"조선",
			"해운",
			"조선기자재",
			"친환경조선",
			"LNG선",
			"선박",
			"조선TOP",
			"조선해운"
		],
		related: [
			"steel",
			"power",
			"defense"
		]
	},
	{
		id: "semiconductor",
		label: "반도체·장비",
		keywords: [
			"반도체",
			"HBM",
			"AI반도체",
			"메모리",
			"소부장",
			"반도체TOP",
			"팹리스",
			"파운드리",
			"웨이퍼"
		],
		related: ["ai"]
	},
	{
		id: "battery",
		label: "2차전지·소재",
		keywords: [
			"2차전지",
			"배터리",
			"양극",
			"음극",
			"전해질",
			"전기차",
			"이차전지"
		],
		related: ["auto", "chemicals"]
	},
	{
		id: "bio",
		label: "바이오·헬스케어",
		keywords: [
			"바이오",
			"헬스케어",
			"제약",
			"의료",
			"코스닥150바이오",
			"K바이오"
		],
		related: []
	},
	{
		id: "defense",
		label: "방산·우주항공",
		keywords: [
			"방산",
			"우주항공",
			"항공우주",
			"K방산",
			"방산소부장",
			"국방"
		],
		related: ["shipbuilding"]
	},
	{
		id: "ai",
		label: "AI·데이터센터·테크",
		keywords: [
			"AI",
			"데이터센터",
			"인공지능",
			"로봇",
			"자동화",
			"클라우드",
			"테크"
		],
		related: ["semiconductor", "power"]
	},
	{
		id: "power",
		label: "전력·원전·에너지",
		keywords: [
			"원전",
			"원자력",
			"전력",
			"전력기기",
			"에너지",
			"SMR",
			"유틸리티",
			"전력인프라"
		],
		related: ["ai", "shipbuilding"]
	},
	{
		id: "auto",
		label: "자동차·모빌리티",
		keywords: [
			"자동차",
			"현대차",
			"기아",
			"모빌리티",
			"자율주행",
			"전기차"
		],
		related: ["battery"]
	},
	{
		id: "steel",
		label: "철강·금속",
		keywords: [
			"철강",
			"금속",
			"포스코",
			"비철"
		],
		related: ["shipbuilding", "auto"]
	},
	{
		id: "chemicals",
		label: "화학·소재",
		keywords: [
			"화학",
			"소재",
			"석유화학"
		],
		related: ["battery", "shipbuilding"]
	},
	{
		id: "finance",
		label: "금융",
		keywords: [
			"은행",
			"금융",
			"증권",
			"보험",
			"고배당"
		],
		related: []
	},
	{
		id: "us_equity",
		label: "미국·해외주식",
		keywords: [
			"미국",
			"S&P",
			"나스닥",
			"필라델피아",
			"엔비디아",
			"빅테크"
		],
		related: ["ai", "semiconductor"]
	},
	{
		id: "korea_index",
		label: "국내 시장지수",
		keywords: [
			"코스피200",
			"코스닥150",
			"KRX300",
			"KOSPI200",
			"200선물",
			"200커버드콜",
			"200"
		],
		related: []
	},
	{
		id: "bond",
		label: "채권·금리",
		keywords: [
			"채권",
			"국채",
			"국고",
			"CD금리",
			"KOFR",
			"머니마켓",
			"초단기"
		],
		related: []
	}
];
/** Numeric / Latin tokens must not match years ("2002") or "Soulbrain". */
function themeKeywordHits(nameKo, description, keyword) {
	if (keyword === "200" || /^\d{3,4}$/.test(keyword)) return new RegExp(`(^|[^0-9])${keyword}([^0-9]|$)`).test(nameKo);
	if (keyword === "AI") return /(^|[^A-Za-z])AI([^A-Za-z]|$)/i.test(`${nameKo} ${description}`);
	return `${nameKo} ${description}`.includes(keyword);
}
function detectEtfThemes(nameKo, description = "") {
	const hits = [];
	for (const g of ETF_THEME_GROUPS) if (g.keywords.some((k) => themeKeywordHits(nameKo, description, k))) hits.push(g.id);
	return hits;
}
function formatEtfDescription(raw) {
	const base = toReadableDoc(raw, { maxBullets: 5 });
	const bullets = [...base.bullets];
	const themes = detectEtfThemes(base.plain);
	for (const id of themes.slice(0, 2)) {
		const g = ETF_THEME_GROUPS.find((x) => x.id === id);
		if (g) {
			const b = `테마: ${g.label}`;
			if (!bullets.includes(b)) bullets.push(b);
		}
	}
	return {
		plain: base.plain,
		paragraphs: base.paragraphs,
		summary: base.summary,
		bullets: bullets.slice(0, 6)
	};
}
/**
* Find thematically related ETFs (same industry + value-chain),
* NOT Naver's generic mega-cap compare list (KODEX 200 / S&P500).
*/
function findRelatedEtfs(etf, universe, description = "", limit = 10) {
	const themes = detectEtfThemes(etf.nameKo, description);
	const themeSet = new Set(themes);
	for (const id of [...themeSet]) {
		const g = ETF_THEME_GROUPS.find((x) => x.id === id);
		for (const r of g?.related ?? []) themeSet.add(r);
	}
	const focusKeywords = [];
	for (const g of ETF_THEME_GROUPS) for (const k of g.keywords) if (themeKeywordHits(etf.nameKo, description, k)) focusKeywords.push(k);
	for (const m of etf.nameKo.match(/[가-힣A-Za-z0-9]{2,}/g) ?? []) if (!/^(KODEX|TIGER|SOL|ACE|PLUS|RISE|HANARO|TIME|WON|KB|1Q|KIWOOM|마이티|KoAct)$/i.test(m)) focusKeywords.push(m);
	const scored = [];
	for (const other of universe) {
		if (other.code === etf.code) continue;
		const otherThemes = detectEtfThemes(other.nameKo);
		let score = 0;
		const reasons = [];
		const shared = otherThemes.filter((t) => themes.includes(t));
		if (shared.length) {
			score += 50 * shared.length;
			const labels = shared.map((id) => ETF_THEME_GROUPS.find((g) => g.id === id)?.label ?? id).join(", ");
			reasons.push(`동일 테마(${labels})`);
		}
		const chain = otherThemes.filter((t) => !themes.includes(t) && themeSet.has(t));
		if (chain.length) {
			score += 22 * chain.length;
			const labels = chain.map((id) => ETF_THEME_GROUPS.find((g) => g.id === id)?.label ?? id).join(", ");
			reasons.push(`밸류체인(${labels})`);
		}
		let kwHits = 0;
		for (const k of focusKeywords) if (k.length >= 2 && themeKeywordHits(other.nameKo, "", k)) kwHits++;
		if (kwHits) {
			score += Math.min(40, kwHits * 12);
			reasons.push("명칭·키워드 유사");
		}
		if (etf.retirementEligible && other.retirementEligible) score += 4;
		if (other.isLeverageOrInverse) score -= 8;
		if (themes.length && !themes.includes("korea_index") && !themes.includes("us_equity") && /^(KODEX|TIGER)\s*(200|미국S&P|미국나스닥|코스피)/.test(other.nameKo)) score -= 30;
		if (score < 18) continue;
		scored.push({
			code: other.code,
			nameKo: other.nameKo,
			price: other.price,
			changePct: other.changePct,
			marketSum: other.marketSum,
			volume: other.volume,
			retirementEligible: other.retirementEligible,
			isLeverageOrInverse: other.isLeverageOrInverse,
			relation: reasons[0] ?? "테마 유사",
			score,
			themes: otherThemes
		});
	}
	return scored.sort((a, b) => b.score - a.score || b.marketSum - a.marketSum).slice(0, limit);
}
async function fetchEtfDetail(code) {
	const c = normalizeEtfCode(code);
	const all = await fetchAllEtfs();
	const etf = all.find((e) => e.code === c) ?? null;
	let issuer;
	let description;
	let fee;
	let nav;
	let marketValue;
	try {
		const integ = await getJsonUtf8(`https://m.stock.naver.com/api/stock/${c}/integration`);
		description = integ.description;
		issuer = integ.etfKeyIndicator?.issuerName;
		fee = integ.etfKeyIndicator?.totalFee;
		nav = num(String(integ.etfKeyIndicator?.nav ?? "").replace(/,/g, ""));
		marketValue = integ.etfKeyIndicator?.marketValue;
	} catch {}
	if (etf && issuer) etf.issuer = issuer;
	const nameForTheme = etf?.nameKo ?? c;
	const descriptionFormatted = formatEtfDescription(description);
	const themes = detectEtfThemes(nameForTheme, descriptionFormatted.plain);
	const themeLabels = themes.map((id) => ETF_THEME_GROUPS.find((g) => g.id === id)?.label ?? id).filter(Boolean);
	const relatedEtfs = etf ? findRelatedEtfs(etf, all, descriptionFormatted.plain, 12) : [];
	const relatedCodes = inferThemeStockCodes(nameForTheme);
	return {
		etf: etf ? {
			...etf,
			issuer: issuer ?? etf.issuer
		} : etf,
		issuer,
		description,
		descriptionFormatted,
		themes,
		themeLabels,
		fee,
		nav: nav || etf?.nav,
		marketValue,
		relatedCodes,
		relatedEtfs,
		relatedFromCompare: []
	};
}
/**
* Theme → universe stock mapping when official daily basket weights are unavailable.
* Labeled as "테마 관련 종목" not official AUM weights.
*/
function inferThemeStockCodes(etfName) {
	const n = etfName;
	const picks = [];
	const add = (...codes) => {
		for (const c of codes) if (UNIVERSE.some((u) => u.code === c) && !picks.includes(c)) picks.push(c);
	};
	if (/방산|우주항공|항공우주|K방산|국방/.test(n) && !/항공운송/.test(n)) add("012450", "047810", "079550", "272210", "064350", "103140", "009540");
	if (/조선|해운|선박|기자재/.test(n)) add("009540", "010140", "042660", "443060", "267250", "010620", "071970");
	if (/바이오|헬스케어|제약|코스닥150바이오/.test(n)) add("207940", "068270", "326030", "196170", "128940", "141080", "302440");
	if (/반도체|HBM|AI반도체|메모리|CPU반도체/.test(n)) add("005930", "000660", "042700", "058470", "240810", "039030", "000990");
	if (/(^|[^A-Za-z])AI([^A-Za-z]|$)|인공지능|데이터센터/.test(n) && !/미국|S&P|나스닥|필라델피아|해외/.test(n)) add("005930", "000660", "042700", "034020", "267260", "010120", "298040");
	if (/2차전지|배터리|양극/.test(n)) add("373220", "006400", "003670", "051910", "247540", "086520", "066970");
	if (/하이닉스|샌디스크|SK하이닉스/.test(n)) add("000660", "005930", "042700");
	if (/삼성전자/.test(n)) add("005930");
	if (/자동차|현대차|기아/.test(n)) add("005380", "000270", "012330", "204320");
	if (/원전|전력|에너지|유틸/.test(n)) add("034020", "015760", "267260", "010120", "298040", "052690");
	if (/은행|금융|증권/.test(n)) add("105560", "055550", "086790", "316140");
	if (/코스닥150(?!바이오)/.test(n) || /코스닥(?!.*바이오)/.test(n)) add("247540", "086520", "196170", "277810", "240810", "058470");
	if (/200(?!선물)/.test(n) && /KODEX|TIGER|KB|HANARO|RISE|PLUS|ACE|SOL/.test(n)) add("005930", "000660", "005380", "000270", "373220", "207940", "035420");
	return picks.slice(0, 14);
}
function searchEtfsInList(rows, q, opts) {
	const s = q.trim();
	let list = rows;
	if (opts?.retirementOnly) list = list.filter((e) => e.retirementEligible);
	if (!s) return list.slice(0, 40);
	const hits = list.filter((e) => matchesSearchQuery(s, [
		e.nameKo,
		e.code,
		e.tabLabel,
		e.issuer
	]));
	return rankByQuery(hits, s, (e) => ({
		name: e.nameKo,
		code: e.code
	})).slice(0, 50);
}
function filterEtfBucket(rows, bucket) {
	switch (bucket) {
		case "retirement": return rows.filter((e) => e.retirementEligible);
		case "new": return rows.filter((e) => e.isNewCandidate && e.retirementEligible);
		case "theme": return rows.filter((e) => e.retirementEligible && e.tabCode === 2);
		case "us": return rows.filter((e) => e.retirementEligible && (e.tabCode === 4 || /미국|S&P|나스닥|해외/.test(e.nameKo)));
		case "bond": return rows.filter((e) => e.retirementEligible && (e.tabCode === 6 || e.tabCode === 7));
		default: return rows;
	}
}
var ETF_ASSET_CLASS_LABEL = {
	"kr-equity": "국내주식",
	"kr-etf": "국내ETF",
	"us-equity": "미국주식",
	"overseas-equity": "해외주식",
	bond: "채권",
	future: "선물",
	cash: "현금",
	other: "기타"
};
var nameCodeCache = /* @__PURE__ */ new Map();
var ETF_BRAND_RE = /^(KODEX|TIGER|PLUS|ACE|RISE|SOL|FOCUS|HANARO|KBSTAR|KOSEF|ARIRANG|TIMEFOLIO|WOORI|1Q|KIWOOM|WON|KOACT|TIME|KOACT)\b/i;
function looksKoreanEtfName(name) {
	const n = name.trim();
	if (ETF_BRAND_RE.test(n)) return true;
	if (/상장지수/.test(n)) return true;
	return /\bETF\b/i.test(n) && /[가-힣]/.test(n);
}
function isCashLike(name) {
	if (looksKoreanEtfName(name)) return false;
	return /현금|예금|콜론|\bCD\b|\bRP\b|원화예치|외화예치|선물마진|MMF|단기금융|REPO|정기예금|설정현금액|원화현금|원화예금/i.test(name);
}
function isBondLike(name, isin) {
	if (looksKoreanEtfName(name)) return false;
	if (/선물/.test(name)) return false;
	if (isin && /^KR1/i.test(isin)) return true;
	return /국고\d|통안\d{2,}|국고채권|국고\s*채권|통안채|회사채|특수채|금융채|물가채|국민주택|국고채(?!선물)/.test(name);
}
function isFutureLike(name, isin) {
	if (looksKoreanEtfName(name)) return false;
	if (isin && /^KR4/i.test(isin)) return true;
	return /선물\d{2,}/.test(name);
}
function looksOverseas(name) {
	const n = name.trim();
	if (/[가-힣]/.test(n) && !/\b(INC|CORP|LTD|PLC|NV|SA|AG)\b/i.test(n)) return false;
	if (/\b(INC|CORP|LTD|PLC|NV|CLASS|CL A|CL B|CORPORATION|INCORPORATED)\b/i.test(n)) return true;
	if (n.split(/\s+/).filter(Boolean).length >= 2 && !/[가-힣]/.test(n)) return true;
	return false;
}
function asKrCode(v) {
	const s = String(v ?? "").trim().toUpperCase();
	return /^[0-9A-Z]{6}$/.test(s) ? s : null;
}
function formatYmd(raw) {
	if (!raw) return null;
	const d = raw.replace(/[^\d]/g, "");
	if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
	if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
	return raw;
}
function usClassHint(name) {
	if (/\bCLASS\s*C\b|\bCL\s*C\b/i.test(name)) return "class c";
	if (/\bCLASS\s*A\b|\bCL\s*A\b/i.test(name)) return "class a";
	if (/\bCLASS\s*B\b|\bCL\s*B\b/i.test(name)) return "class b";
	return null;
}
function searchQueriesForName(name) {
	const raw = name.trim();
	const cleaned = raw.replace(/\b(INC|CORP|LTD|PLC|CO|CLASS|CL A|CL B|COMMON|ORD|THE)\b/gi, " ").replace(/[-.,/]/g, " ").replace(/\s+/g, " ").trim();
	const words = cleaned.split(" ").filter((w) => w.length > 1);
	const qs = [raw];
	if (cleaned && cleaned.toLowerCase() !== raw.toLowerCase()) qs.push(cleaned);
	if (words.length >= 2) qs.push(words.slice(0, 2).join(" "));
	if (words[0]) qs.push(words[0]);
	return [...new Set(qs)].slice(0, 3);
}
/** Map holding name → KR ticker or US reuters code via Naver autocomplete */
async function resolveHoldingName(nameKo) {
	const key = nameKo.trim();
	if (!key || isCashLike(key) || isBondLike(key) || isFutureLike(key)) return null;
	if (nameCodeCache.has(key)) return nameCodeCache.get(key) ?? null;
	const uni = UNIVERSE.find((u) => u.nameKo === key || u.nameKo.replace(/\s/g, "") === key.replace(/\s/g, ""));
	if (uni) {
		const hit = {
			code: uni.code,
			market: uni.market,
			name: uni.nameKo,
			reutersCode: null,
			nation: "KOR",
			isEtf: false
		};
		nameCodeCache.set(key, hit);
		return hit;
	}
	for (const q of searchQueriesForName(key)) try {
		const items = (await getJsonUtf8(`https://m.stock.naver.com/front-api/search/autoComplete?query=${encodeURIComponent(q)}&target=stock`)).result?.items ?? [];
		const korStock = items.find((it) => it.nationCode === "KOR" && !it.isEtf && it.name === key && /^[0-9A-Za-z]{6}$/.test(String(it.code ?? ""))) ?? items.find((it) => it.nationCode === "KOR" && !it.isEtf && /^[0-9A-Za-z]{6}$/.test(String(it.code ?? "")));
		const korEtf = items.find((it) => it.nationCode === "KOR" && it.isEtf && /^[0-9A-Za-z]{6}$/.test(String(it.code ?? "")));
		const usaItems = items.filter((it) => it.nationCode === "USA" && Boolean(it.reutersCode || it.code));
		const hint = usClassHint(key);
		const us = (hint ? usaItems.find((it) => (it.name ?? "").toLowerCase().includes(hint)) : void 0) ?? usaItems[0] ?? items.find((it) => it.nationCode && it.nationCode !== "KOR" && Boolean(it.reutersCode || it.code));
		const pick = looksKoreanEtfName(key) ? korEtf ?? korStock ?? us : looksOverseas(key) ? us ?? korStock ?? korEtf : korStock ?? korEtf ?? us;
		if (!pick) continue;
		const nation = pick.nationCode ?? null;
		const reuters = pick.reutersCode || (nation && nation !== "KOR" ? String(pick.code ?? "") : null);
		const krCode = nation === "KOR" && /^[0-9A-Za-z]{6}$/.test(String(pick.code ?? "")) ? String(pick.code).toUpperCase() : null;
		const hit = {
			code: krCode,
			market: krCode ? pick.typeCode === "KOSDAQ" || pick.typeName?.includes("코스닥") ? "KOSDAQ" : "KOSPI" : null,
			name: String(pick.name ?? key),
			reutersCode: reuters,
			nation,
			isEtf: Boolean(pick.isEtf) || looksKoreanEtfName(key)
		};
		nameCodeCache.set(key, hit);
		return hit;
	} catch {}
	nameCodeCache.set(key, null);
	return null;
}
/** @deprecated use resolveHoldingName */
async function resolveStockName(nameKo) {
	const hit = await resolveHoldingName(nameKo);
	if (!hit?.code) return null;
	return {
		code: hit.code,
		market: hit.market ?? "KOSPI",
		name: hit.name
	};
}
async function fetchUsdKrw() {
	try {
		const n = num((await getJsonUtf8("https://api.stock.naver.com/marketindex/exchange/FX_USDKRW")).exchangeInfo?.closePrice);
		if (n > 100) return n;
	} catch {}
	try {
		const n = (await getJsonUtf8("https://query1.finance.yahoo.com/v8/finance/chart/USDKRW=X?interval=1d&range=1d")).chart?.result?.[0]?.meta?.regularMarketPrice ?? 0;
		if (n > 100) return n;
	} catch {}
	return 0;
}
async function fetchWorldQuotes(reutersCodes) {
	const unique = [...new Set(reutersCodes.filter(Boolean))];
	const out = {};
	for (let i = 0; i < unique.length; i += 6) {
		const batch = unique.slice(i, i + 6);
		const parts = await Promise.all(batch.map(async (rc) => {
			try {
				const j = await getJsonUtf8(`https://api.stock.naver.com/stock/${encodeURIComponent(rc)}/basic`);
				const infos = Object.fromEntries((j.stockItemTotalInfos ?? []).map((t) => [t.code ?? "", t.value ?? ""]));
				const price = num(j.closePrice);
				const change = num(j.compareToPreviousClosePrice);
				const changePct = num(j.fluctuationsRatio);
				const volume = num(infos.accumulatedTradingVolume);
				const cur = (j.currencyType?.name ?? "USD").toUpperCase() === "KRW" ? "KRW" : "USD";
				if (!(price > 0)) return null;
				return {
					rc,
					quote: {
						price,
						change,
						changePct,
						volume,
						currency: cur,
						name: j.stockName
					}
				};
			} catch {
				return null;
			}
		}));
		for (const p of parts) if (p) out[p.rc] = p.quote;
	}
	return out;
}
var HOLDING_RESOLVE_CAP = 100;
var HOLDINGS_TTL_MS = 9e4;
var holdingsCache = /* @__PURE__ */ new Map();
function classifyRow(input) {
	const name = input.nameKo;
	const isin = input.isin;
	const cash = isCashLike(name) || isin != null && /^KRD01/i.test(isin);
	const brandEtf = looksKoreanEtfName(name) || input.isEtf;
	const fut = !cash && !brandEtf && isFutureLike(name, isin);
	const bond = !cash && !brandEtf && !fut && isBondLike(name, isin);
	const hasKrCode = Boolean(input.code);
	const overseas = Boolean(!cash && !bond && !hasKrCode && (input.nation && input.nation !== "KOR" ? true : looksOverseas(name) || isin != null && /^(US|XS|LU|IE)/i.test(isin)));
	const krEtf = Boolean(brandEtf && (input.code || !overseas));
	const krEq = Boolean(input.code && !krEtf && !cash && !bond && !fut && !overseas);
	let assetClass = "other";
	if (cash) assetClass = "cash";
	else if (bond) assetClass = "bond";
	else if (fut) assetClass = "future";
	else if (krEtf) assetClass = "kr-etf";
	else if (krEq) assetClass = "kr-equity";
	else if (overseas) assetClass = input.nation === "USA" || isin != null && /^US/i.test(isin) ? "us-equity" : "overseas-equity";
	const nation = input.nation ?? (cash || bond || fut ? "KOR" : overseas ? "USA" : input.code ? "KOR" : null);
	return {
		isCash: cash,
		isBond: bond,
		isFuture: fut,
		isOverseas: overseas,
		isKoreanEquity: krEq,
		isKoreanEtf: krEtf,
		assetClass,
		currency: overseas ? "USD" : "KRW",
		nation
	};
}
async function fetchWiseReportCu(code) {
	const m = (await getJsonUtf8AsText(`https://navercomp.wisereport.co.kr/v2/ETF/index.aspx?cmp_cd=${encodeURIComponent(code)}`)).match(/var CU_data = (\{[\s\S]*?\});\s*var chartDraw/);
	if (!m) return {
		rows: [],
		asOf: null
	};
	let parsed;
	try {
		parsed = JSON.parse(m[1]);
	} catch {
		return {
			rows: [],
			asOf: null
		};
	}
	const grid = parsed.grid_data ?? [];
	const asOf = formatYmd(grid[0]?.TRD_DT ?? null);
	return {
		rows: grid.map((row) => {
			return {
				nameKo: String(row.STK_NM_KOR ?? "").trim(),
				weight: row.ETF_WEIGHT == null ? null : num(row.ETF_WEIGHT),
				quantity: row.AGMT_STK_CNT == null ? null : num(row.AGMT_STK_CNT),
				asOf: formatYmd(row.TRD_DT) ?? asOf,
				code: null,
				isin: null
			};
		}).filter((r) => r.nameKo),
		asOf
	};
}
async function fetchNaverEtfAssetTable(code) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 12e3);
	let html = "";
	try {
		const res = await fetch(`https://finance.naver.com/item/main.naver?code=${encodeURIComponent(code)}`, {
			headers: {
				...headers(),
				Accept: "text/html,*/*"
			},
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const buf = Buffer.from(await res.arrayBuffer());
		html = buf.toString("utf8");
		if (!html.includes("구성종목")) html = new TextDecoder("euc-kr").decode(buf);
	} finally {
		clearTimeout(t);
	}
	const idx = html.search(/구성종목/);
	if (idx < 0) return [];
	const slice = html.slice(idx, idx + 3e4);
	const rows = [];
	const re = /<td class="ctg">([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td class="per">([\s\S]*?)<\/td>/g;
	let m;
	while (m = re.exec(slice)) {
		const cell = m[1] ?? "";
		const qtyRaw = (m[2] ?? "").replace(/<[^>]+>/g, "").replace(/,/g, "").trim();
		const wRaw = (m[3] ?? "").replace(/<[^>]+>/g, "").replace(/,/g, "").trim();
		const href = cell.match(/code=([0-9A-Za-z]{6})/);
		const name = cell.match(/<a[^>]*>([\s\S]*?)<\/a>/)?.[1]?.replace(/<[^>]+>/g, "").trim() || cell.match(/<span[^>]*>([\s\S]*?)<\/span>/)?.[1]?.replace(/<[^>]+>/g, "").trim() || cell.replace(/<[^>]+>/g, "").trim();
		if (!name) continue;
		const qty = qtyRaw && qtyRaw !== "-" ? num(qtyRaw) : null;
		const hasWeight = wRaw && wRaw !== "-" && /[0-9]/.test(wRaw);
		rows.push({
			nameKo: name,
			code: href ? asKrCode(href[1]) : null,
			quantity: qty,
			weight: hasWeight ? num(wRaw.replace(/%/g, "")) : null,
			asOf: null,
			isin: null
		});
	}
	return rows;
}
async function fetchPlusJson(url, init) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 12e3);
	try {
		const res = await fetch(url, {
			...init,
			signal: ctrl.signal,
			headers: {
				"User-Agent": UA,
				Accept: "application/json,text/plain,*/*",
				"Accept-Language": "ko-KR,ko;q=0.9",
				Origin: "https://www.plusetf.co.kr",
				Referer: "https://www.plusetf.co.kr/product/overview",
				...init?.headers ?? {}
			}
		});
		if (!res.ok) throw new Error(`PLUS HTTP ${res.status}`);
		return JSON.parse(await res.text());
	} finally {
		clearTimeout(t);
	}
}
async function fetchPlusOfficialHoldings(ticker) {
	const hit = ((await fetchPlusJson("https://www.plusetf.co.kr/api/v1/product/find/list", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			searchSortTy: "",
			searchSort: "DESC",
			page: 0,
			searchAnnuityOptionTy: null,
			searchWord: ticker
		})
	})).content ?? []).find((p) => String(p.nameCode ?? "").toUpperCase() === ticker);
	if (!hit?.id) return null;
	const wkdate = String(hit.wkdate ?? "").replace(/[^\d]/g, "");
	if (!/^\d{8}$/.test(wkdate)) return null;
	const rows = [];
	let page = 0;
	let asOf = formatYmd(wkdate);
	for (let guard = 0; guard < 8; guard++) {
		const pack = await fetchPlusJson(`https://www.plusetf.co.kr/api/v1/product/pdf/list?n=${encodeURIComponent(hit.id)}&d=${wkdate}&page=${page}&pageSize=50`, { headers: { Referer: `https://www.plusetf.co.kr/product/detail?n=${hit.id}` } });
		const chunk = pack.content ?? [];
		for (const r of chunk) {
			const nameKo = String(r.jmNm ?? "").trim();
			if (!nameKo) continue;
			const jm = asKrCode(r.jmCd);
			rows.push({
				nameKo,
				code: jm,
				isin: r.krJmCd ? String(r.krJmCd).trim() : null,
				quantity: r.amount == null ? null : num(r.amount),
				weight: r.ratio == null ? null : num(r.ratio),
				asOf: formatYmd(r.wkdate) ?? asOf
			});
			if (!asOf) asOf = formatYmd(r.wkdate);
		}
		if (pack.last || page + 1 >= (pack.totalPages ?? 1) || !chunk.length) break;
		page += 1;
	}
	if (!rows.length) return null;
	return {
		rows,
		asOf,
		productId: hit.id,
		name: String(hit.displayName ?? "")
	};
}
function finalizeHolding(nameKo, opts) {
	const hit = opts.hit;
	const code = asKrCode(opts.code) ?? asKrCode(hit?.code);
	const isin = opts.isin;
	const reuters = hit?.reutersCode ?? null;
	const flags = classifyRow({
		nameKo,
		code,
		reutersCode: reuters,
		nation: hit?.nation ?? (isin && /^US/i.test(isin) ? "USA" : code ? "KOR" : null),
		isin,
		isEtf: Boolean(hit?.isEtf) || looksKoreanEtfName(nameKo)
	});
	return {
		nameKo,
		weight: opts.weight,
		weightSource: opts.weight != null ? "official" : null,
		quantity: opts.quantity,
		asOf: opts.asOf,
		code,
		market: hit?.market ?? (code ? "KOSPI" : null),
		reutersCode: reuters,
		nation: flags.nation,
		currency: flags.currency,
		isin,
		isCash: flags.isCash,
		isBond: flags.isBond,
		isFuture: flags.isFuture,
		isOverseas: flags.isOverseas,
		isKoreanEquity: flags.isKoreanEquity,
		isKoreanEtf: flags.isKoreanEtf,
		assetClass: flags.assetClass
	};
}
async function getJsonReferer(url, referer) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 2e4);
	try {
		const res = await fetch(url, {
			headers: {
				"User-Agent": UA,
				Accept: "application/json,text/plain,*/*",
				"Accept-Language": "ko-KR,ko;q=0.9",
				Referer: referer
			},
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return JSON.parse(await res.text());
	} finally {
		clearTimeout(t);
	}
}
async function fetchEtfIdentity(code) {
	try {
		const integ = await getJsonUtf8(`https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/integration`);
		return {
			name: String(integ.stockName ?? "").trim(),
			issuer: String(integ.etfKeyIndicator?.issuerName ?? "").trim()
		};
	} catch {
		return {
			name: "",
			issuer: ""
		};
	}
}
async function fetchIbkOfficialHoldings(etfName) {
	const catalog = await getJsonUtf8("https://www.ibkasset.com/api/etf");
	const id = matchIbkProductId(etfName, catalog.data?.content ?? []);
	if (id == null) return null;
	const pdf = await getJsonUtf8(`https://www.ibkasset.com/api/etf/${id}/pdf?page=0&size=200`);
	const asOf = pdf.data?.baseDate ?? catalog.data?.baseDate ?? null;
	const rows = parseIbkPdfRows(pdf.data?.content ?? [], asOf);
	if (!rows.length) return null;
	return {
		rows,
		asOf,
		issuerUrl: `https://www.ibkasset.com/etf/detail/${id}`
	};
}
var hanaroCatalogCache = {
	at: 0,
	map: /* @__PURE__ */ new Map()
};
var HANARO_CATALOG_TTL_MS = 216e5;
async function fetchHanaroText(url, referer) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 12e3);
	try {
		const res = await fetch(url, {
			headers: {
				"User-Agent": UA,
				Accept: "text/html,*/*",
				Referer: referer
			},
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.text();
	} finally {
		clearTimeout(t);
	}
}
async function hanaroFundUid(ticker) {
	const now = Date.now();
	if (hanaroCatalogCache.map.size > 0 && now - hanaroCatalogCache.at < HANARO_CATALOG_TTL_MS) return hanaroCatalogCache.map.get(ticker) ?? null;
	const map = /* @__PURE__ */ new Map();
	for (let page = 1; page <= 12; page++) {
		const chunk = parseHanaroFundCatalog(await fetchHanaroText(`https://www.hanaroetf.com/api/v1/fund/get-fund-search-list?pageNo=${page}`, "https://www.hanaroetf.com/fund/fund-list"));
		if (chunk.size === 0) break;
		for (const [code, uid] of chunk) map.set(code, uid);
		if (chunk.size < 10) break;
	}
	if (map.size === 0) return null;
	hanaroCatalogCache.at = now;
	hanaroCatalogCache.map = map;
	return map.get(ticker) ?? null;
}
async function fetchHanaroOfficialHoldings(ticker) {
	const uid = await hanaroFundUid(ticker);
	if (!uid) return null;
	const pageUrl = `https://www.hanaroetf.com/fund/${encodeURIComponent(uid)}`;
	const [listHtml, pageHtml] = await Promise.all([fetchHanaroText(`https://www.hanaroetf.com/api/v1/fund/${encodeURIComponent(uid)}/get-fund-holdings-list?baseDate=`, pageUrl), fetchHanaroText(pageUrl, "https://www.hanaroetf.com/fund/fund-list").catch(() => "")]);
	const asOf = parseHanaroPdfDate(pageHtml);
	const rows = parseHanaroHoldingsHtml(listHtml, asOf);
	if (!rows.length) return null;
	return {
		rows,
		asOf,
		issuerUrl: pageUrl
	};
}
var kodexCatalogCache = {
	at: 0,
	map: /* @__PURE__ */ new Map()
};
var KODEX_CATALOG_TTL_MS = 216e5;
async function kodexFundId(ticker) {
	const now = Date.now();
	if (kodexCatalogCache.map.size > 0 && now - kodexCatalogCache.at < KODEX_CATALOG_TTL_MS) return kodexCatalogCache.map.get(ticker) ?? null;
	const pageUrl = (page) => `https://www.samsungfund.com/api/v1/kodex/product.do?ordrColm=NAV&ordrSort=DESC&pageNo=${page}&pageRows=20&srchTerm=w`;
	const first = await getJsonReferer(pageUrl(1), "https://www.samsungfund.com/etf/main.do");
	const total = Number(first[0]?.totalCnt ?? first.length) || first.length;
	const pages = Math.min(20, Math.max(1, Math.ceil(total / 20)));
	const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => getJsonReferer(pageUrl(i + 2), "https://www.samsungfund.com/etf/main.do").catch(() => [])));
	const map = /* @__PURE__ */ new Map();
	for (const row of first.concat(...rest)) {
		const code = String(row.stkTicker ?? "").trim().toUpperCase();
		const fid = String(row.fId ?? "").trim();
		if (code && fid) map.set(code, fid);
	}
	kodexCatalogCache.at = now;
	kodexCatalogCache.map = map;
	return map.get(ticker) ?? null;
}
async function fetchKodexOfficialHoldings(ticker) {
	const fid = await kodexFundId(ticker);
	if (!fid) return null;
	const pack = await getJsonReferer(`https://www.samsungfund.com/api/v1/kodex/product/${encodeURIComponent(fid)}.do`, `https://www.samsungfund.com/etf/product/view.do?id=${encodeURIComponent(fid)}`);
	const asOf = formatYmd(pack.pdf?.gijunYMD ?? null);
	const rows = parseKodexPdfRows(pack.pdf?.list ?? [], asOf);
	if (!rows.length) return null;
	return {
		rows,
		asOf,
		issuerUrl: `https://www.samsungfund.com/etf/product/view.do?id=${encodeURIComponent(fid)}`
	};
}
async function buildEtfHoldings(code) {
	const c = normalizeEtfCode(code);
	const [wisePack, identity] = await Promise.all([fetchWiseReportCu(c).catch(() => ({
		rows: [],
		asOf: null
	})), fetchEtfIdentity(c)]);
	const family = issuerHoldingsFamily(identity.name, identity.issuer);
	const [naverRows, plusPack, ibkPack, kodexPack, hanaroPack] = await Promise.all([
		fetchNaverEtfAssetTable(c).catch(() => []),
		family === "plus" ? fetchPlusOfficialHoldings(c).catch(() => null) : Promise.resolve(null),
		family === "ibk" ? fetchIbkOfficialHoldings(identity.name).catch(() => null) : Promise.resolve(null),
		family === "kodex" ? fetchKodexOfficialHoldings(c).catch(() => null) : Promise.resolve(null),
		family === "hanaro" ? fetchHanaroOfficialHoldings(c).catch(() => null) : Promise.resolve(null)
	]);
	const chosen = chooseOfficialBasket([
		...kodexPack ? [{
			rows: kodexPack.rows,
			source: `삼성자산운용 KODEX 일별 PDF (${kodexPack.asOf ?? "기준일 확인"})`,
			sourceKind: "issuer-pdf",
			priority: 100,
			issuerUrl: kodexPack.issuerUrl,
			asOf: kodexPack.asOf
		}] : [],
		...hanaroPack ? [{
			rows: hanaroPack.rows,
			source: `NH-Amundi HANARO 일별 PDF (${hanaroPack.asOf ?? "기준일 확인"})`,
			sourceKind: "issuer-pdf",
			priority: 100,
			issuerUrl: hanaroPack.issuerUrl,
			asOf: hanaroPack.asOf
		}] : [],
		...ibkPack ? [{
			rows: ibkPack.rows,
			source: `IBK자산운용 일별 PDF (${ibkPack.asOf ?? "기준일 확인"})`,
			sourceKind: "issuer-pdf",
			priority: 100,
			issuerUrl: ibkPack.issuerUrl,
			asOf: ibkPack.asOf
		}] : [],
		...plusPack ? [{
			rows: plusPack.rows,
			source: `한화자산운용 PLUS 일별 구성종목 PDF (${plusPack.asOf ?? "기준일 확인"})`,
			sourceKind: "issuer-pdf",
			priority: 90,
			issuerUrl: `https://www.plusetf.co.kr/product/detail?n=${encodeURIComponent(plusPack.productId)}`,
			asOf: plusPack.asOf
		}] : [],
		{
			rows: wisePack.rows,
			source: `WiseReport CU 공시 (KRX/운용사, ${wisePack.asOf ?? "기준일 확인"})`,
			sourceKind: "wisereport-cu",
			priority: 50,
			asOf: wisePack.asOf
		},
		{
			rows: naverRows,
			source: "Naver Finance 구성종목 테이블",
			sourceKind: "naver-table",
			priority: 10,
			asOf: naverRows.find((r) => r.asOf)?.asOf ?? null
		}
	]);
	const asOf = chosen.asOf ?? wisePack.asOf;
	const rankedIdx = chosen.rows.map((row, idx) => ({
		idx,
		w: row.weight ?? -1,
		qty: Math.abs(row.quantity ?? 0),
		needs: !row.code && !isCashLike(row.nameKo) && !isBondLike(row.nameKo, row.isin) && !isFutureLike(row.nameKo, row.isin)
	})).sort((a, b) => b.w - a.w || b.qty - a.qty);
	const resolveIdx = new Set(rankedIdx.filter((r) => r.needs).slice(0, HOLDING_RESOLVE_CAP).map((r) => r.idx));
	const holdings = [];
	for (let i = 0; i < chosen.rows.length; i += 8) {
		const batch = chosen.rows.slice(i, i + 8);
		const resolved = await Promise.all(batch.map(async (row, j) => {
			const idx = i + j;
			let hit = null;
			if (resolveIdx.has(idx)) hit = await resolveHoldingName(row.nameKo);
			else if (row.code && looksKoreanEtfName(row.nameKo)) hit = {
				code: row.code,
				market: "KOSPI",
				name: row.nameKo,
				reutersCode: null,
				nation: "KOR",
				isEtf: true
			};
			return finalizeHolding(row.nameKo, {
				weight: chosen.weightsPublished ? row.weight : null,
				quantity: row.quantity,
				asOf: row.asOf ?? asOf,
				code: row.code,
				isin: row.isin,
				hit
			});
		}));
		holdings.push(...resolved);
	}
	holdings.sort(compareHoldingsByWeight);
	return {
		holdings,
		asOf,
		source: chosen.source,
		sourceKind: chosen.sourceKind,
		officialCount: holdings.filter((h) => h.weightSource === "official").length,
		issuerUrl: chosen.issuerUrl
	};
}
async function fetchEtfHoldings(code) {
	const c = normalizeEtfCode(code);
	const now = Date.now();
	const hit = holdingsCache.get(c);
	if (hit && now - hit.at < HOLDINGS_TTL_MS) return hit.data;
	const data = await buildEtfHoldings(c);
	holdingsCache.set(c, {
		at: now,
		data
	});
	return data;
}
async function getJsonUtf8AsText(url) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 12e3);
	try {
		const res = await fetch(url, {
			headers: {
				"User-Agent": UA,
				Referer: "https://finance.naver.com/",
				Accept: "text/html,*/*"
			},
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.text();
	} finally {
		clearTimeout(t);
	}
}
//#endregion
export { ETF_ASSET_CLASS_LABEL, ETF_CODE_RE, ETF_TAB_LABEL, ETF_THEME_GROUPS, detectEtfThemes, fetchAllEtfs, fetchEtfDetail, fetchEtfHoldings, fetchEtfListingDate, fetchNewEtfs, fetchUsdKrw, fetchWorldQuotes, filterEtfBucket, findRelatedEtfs, formatEtfDescription, inferThemeStockCodes, isAlphanumericCode, isLeverageOrInverseName, looksKoreanEtfName, normalizeEtfCode, resolveHoldingName, resolveStockName, searchEtfsInList, fillLiveMarketWeights as t, themeKeywordHits };
