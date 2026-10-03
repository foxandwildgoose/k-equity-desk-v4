import { t as decodeHtmlEntities } from "./readable-text-D28LomX7.mjs";
import { t as UNIVERSE } from "./universe-BLkYDatc.mjs";
import { c as sortDisclosuresNewestFirst } from "./mappers-DlpCqw-E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/krx-disclosures-CIF4Ihdf.js
/**
* KRX-linked disclosure desk
*
* Source map (how brokers also get data):
* 1) KIND (kind.krx.co.kr) — KRX official listed-company disclosure portal
* 2) DART (dart.fss.or.kr) — FSS electronic filings (statutory reports)
* 3) Naver stock disclosure feed — redistributes KRX/KOSCOM market notices
*
* KIND is attempted first for "today" feed; when KIND is unavailable from this
* environment we still ship DART + KOSCOM (Naver) with honest source labels.
*/
var UA = "Mozilla/5.0 (compatible; KoreaEquityCommand/1.0; +https://x.ai) AppleWebKit/537.36";
function headers(extra) {
	return {
		"User-Agent": UA,
		Accept: "text/html,application/json,application/xhtml+xml,*/*",
		"Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
		...extra
	};
}
async function getText(url, extra) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 22e3);
	try {
		const res = await fetch(url, {
			headers: headers(extra),
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.text();
	} finally {
		clearTimeout(t);
	}
}
async function postForm(url, body, extra) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 22e3);
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: headers({
				"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
				"X-Requested-With": "XMLHttpRequest",
				...extra
			}),
			body,
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.text();
	} finally {
		clearTimeout(t);
	}
}
function decodeEntities(s) {
	return decodeHtmlEntities(s);
}
function kstYmd(d = /* @__PURE__ */ new Date()) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Seoul",
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(d);
}
function stripTags(s) {
	return decodeEntities(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
function dartViewerUrl(rcpNo) {
	return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcpNo}`;
}
function dartSearchUrl(nameOrCode) {
	return `https://dart.fss.or.kr/dsab001/main.do?autoSearch=Y&textCrpNm=${encodeURIComponent(nameOrCode)}`;
}
function kindViewerUrl(acptNo) {
	return `https://kind.krx.co.kr/common/disclsviewer.do?method=search&acptno=${acptNo}`;
}
function kindTodayUrl() {
	return "https://kind.krx.co.kr/disclosure/todaydisclosure.do";
}
var SOURCE_LABEL = {
	"kind-krx": "KRX KIND",
	"dart-fss": "DART(금감원)",
	"krx-koscom": "KRX·KOSCOM",
	"naver-disclosure": "네이버 공시"
};
function toIsoDateTime(date, time) {
	const d = date.replace(/\./g, "-");
	if (!time || !/^\d{2}:\d{2}/.test(time)) return d;
	return `${d}T${time.length === 5 ? `${time}:00` : time.slice(0, 8)}+09:00`;
}
function mapNameToCode(name) {
	if (!name) return void 0;
	const n = name.trim();
	return UNIVERSE.find((u) => u.nameKo === n || u.nameKo.replace(/\s/g, "") === n.replace(/\s/g, ""))?.code;
}
async function fetchKindStatus() {
	try {
		const html = await getText("https://kind.krx.co.kr/main.do", { Referer: "https://kind.krx.co.kr/" });
		if (html.includes("페이지 오류") || html.includes("잠시 후 다시") || html.length < 3e3) return {
			available: false,
			message: "KIND(한국거래소 공시) 포털이 현재 점검/차단 상태입니다. DART·KOSCOM 피드로 대체합니다.",
			url: kindTodayUrl()
		};
		return {
			available: true,
			message: "KIND 연결 가능",
			url: kindTodayUrl()
		};
	} catch (e) {
		return {
			available: false,
			message: `KIND 연결 실패: ${e instanceof Error ? e.message : "network"}`,
			url: kindTodayUrl()
		};
	}
}
/**
* Attempt KIND today-disclosure search.
* Returns empty list when KIND is unavailable (common from cloud IPs).
*/
async function fetchKindTodayDisclosures() {
	const status = await fetchKindStatus();
	if (!status.available) return {
		items: [],
		available: false,
		message: status.message
	};
	try {
		const html = await postForm("https://kind.krx.co.kr/disclosure/todaydisclosure.do", [
			"method=searchTodayDisclosure",
			"currentPageSize=30",
			"pageIndex=1",
			"orderMode=0",
			"orderStat=D",
			"forward=todaydisclosure_sub",
			"chose=S",
			"todayFlag=Y"
		].join("&"), {
			Referer: kindTodayUrl(),
			Origin: "https://kind.krx.co.kr"
		});
		if (html.includes("페이지 오류") || html.length < 2e3) return {
			items: [],
			available: false,
			message: status.message
		};
		const items = [];
		for (const tr of html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
			const acpt = tr.match(/acptno=(\d{14})/i)?.[1] ?? tr.match(/openDisclsViewer\(['"]?(\d{14})/i)?.[1];
			const title = stripTags(tr.match(/class=['"][^"]*first[^"]*['"][^>]*>([\s\S]*?)<\//i)?.[1] ?? tr.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "") || "";
			if (!title || title.length < 2) continue;
			const company = stripTags(tr.match(/class=['"][^"]*second[^"]*['"][^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
			const time = tr.match(/(\d{2}:\d{2}(?::\d{2})?)/)?.[1];
			const today = kstYmd();
			const code = mapNameToCode(company);
			items.push({
				id: `kind-${acpt ?? items.length}-${title.slice(0, 20)}`,
				title,
				datetime: toIsoDateTime(today.replace(/-/g, "."), time),
				author: "KIND",
				code,
				nameKo: company || void 0,
				acptNo: acpt,
				source: "kind-krx",
				sourceLabel: SOURCE_LABEL["kind-krx"],
				kindUrl: acpt ? kindViewerUrl(acpt) : kindTodayUrl(),
				dartSearchUrl: dartSearchUrl(company || " "),
				canLoadBody: false
			});
		}
		return {
			items: items.slice(0, 40),
			available: true,
			message: `KIND 금일 공시 ${items.length}건`
		};
	} catch (e) {
		return {
			items: [],
			available: false,
			message: `KIND 조회 실패: ${e instanceof Error ? e.message : "error"}`
		};
	}
}
function parseDartTableRows(html) {
	const items = [];
	const seen = /* @__PURE__ */ new Set();
	for (const tr of html.match(/<tr>([\s\S]*?)<\/tr>/gi) ?? []) {
		const rcp = tr.match(/rcpNo=(\d{14})/)?.[1];
		if (!rcp || seen.has(rcp)) continue;
		seen.add(rcp);
		const dateM = tr.match(/webOnly">(\d{4}\.\d{2}\.\d{2})<\/span>\s*(\d{2}:\d{2})/);
		const market = tr.match(/webOnly">(유가증권시장|코스닥시장|코넥스시장|기타법인)<\/span>/)?.[1];
		const corp = tr.match(/openCorpInfoNew\(['"](\d+)['"][\s\S]*?>\s*([^<\n]+)/);
		const title = stripTags((tr.match(/rcpNo=\d{14}[^"]*"[^>]*>([\s\S]*?)<\/a>/) ?? tr.match(/openReportViewer(?:Main)?\(['"]\d+['"]\);[^>]*>([\s\S]*?)<\/a>/))?.[1] ?? "");
		if (!title) continue;
		const nameKo = corp?.[2]?.trim();
		const code = mapNameToCode(nameKo);
		const date = dateM?.[1] ?? "";
		const time = dateM?.[2];
		items.push({
			id: `dart-${rcp}`,
			title,
			datetime: date ? toIsoDateTime(date, time) : "",
			author: "DART",
			code,
			nameKo,
			market,
			rcpNo: rcp,
			corpCode: corp?.[1],
			source: "dart-fss",
			sourceLabel: SOURCE_LABEL["dart-fss"],
			dartUrl: dartViewerUrl(rcp),
			dartSearchUrl: dartSearchUrl(nameKo ?? rcp),
			canLoadBody: false
		});
	}
	return items;
}
/** Market-wide latest filings from DART main page (실시간 최근공시). */
async function fetchDartRecentMarket() {
	const html = await getText("https://dart.fss.or.kr/main.do", { Referer: "https://dart.fss.or.kr/" });
	const idx = html.indexOf("최근공시");
	return parseDartTableRows(idx >= 0 ? html.slice(idx, idx + 1e5) : html).slice(0, 60);
}
/** Company-level DART search (by Korean name). */
async function fetchDartByCompany(nameKo, days = 90) {
	const end = /* @__PURE__ */ new Date();
	const start = /* @__PURE__ */ new Date(end.getTime() - days * 864e5);
	const fmt = kstYmd;
	return parseDartTableRows(await postForm("https://dart.fss.or.kr/dsab001/search.ax", new URLSearchParams({
		currentPage: "1",
		maxResults: "30",
		maxLinks: "10",
		sort: "date",
		series: "desc",
		textCrpNm: nameKo,
		startDate: fmt(start),
		endDate: fmt(end)
	}).toString(), {
		Referer: "https://dart.fss.or.kr/dsab001/main.do",
		Origin: "https://dart.fss.or.kr"
	})).map((it) => ({
		...it,
		nameKo: it.nameKo ?? nameKo,
		code: it.code ?? mapNameToCode(nameKo)
	}));
}
async function fetchKrxKoscomDisclosures(code, nameKo, pageSize = 30) {
	const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/disclosure?pageSize=${pageSize}`, { headers: headers({
		Referer: `https://m.stock.naver.com/domestic/stock/${code}/total`,
		Accept: "application/json"
	}) });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const rows = await res.json();
	const name = nameKo ?? UNIVERSE.find((u) => u.code === code)?.nameKo;
	return (rows ?? []).map((d) => {
		const author = d.author ?? "공시";
		const source = /KOSCOM|KRX|거래소/i.test(author) ? "krx-koscom" : "naver-disclosure";
		return {
			id: String(d.disclosureId),
			title: d.title,
			datetime: d.datetime,
			author,
			code: d.itemCode ?? code,
			nameKo: name,
			source,
			sourceLabel: SOURCE_LABEL[source],
			dartSearchUrl: dartSearchUrl(name ?? code),
			canLoadBody: true
		};
	});
}
async function fetchKrxDisclosureDesk(opts) {
	const scan = opts?.scanCodes ?? [
		"005930",
		"000660",
		"373220",
		"005380",
		"000270",
		"034020",
		"012450",
		"207940",
		"035420",
		"006400"
	];
	const [kindPack, dart, koscomBundles] = await Promise.all([
		fetchKindTodayDisclosures(),
		fetchDartRecentMarket().catch(() => []),
		Promise.all(scan.map(async (code) => {
			const name = UNIVERSE.find((u) => u.code === code)?.nameKo;
			try {
				return await fetchKrxKoscomDisclosures(code, name, 8);
			} catch {
				return [];
			}
		}))
	]);
	const koscom = sortDisclosuresNewestFirst(koscomBundles.flat()).slice(0, 80);
	return {
		kind: {
			available: kindPack.available,
			message: kindPack.message,
			items: kindPack.items,
			portalUrl: kindTodayUrl()
		},
		dart,
		koscom,
		/** KIND + KOSCOM + DART merged, newest first via the shared kernel (D1e). */
		all: sortDisclosuresNewestFirst([
			...koscom,
			...dart,
			...kindPack.items
		]),
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
/** Merge KOSCOM + DART for a single stock. */
async function fetchStockDisclosureBundle(code, nameKo) {
	const name = nameKo ?? UNIVERSE.find((u) => u.code === code)?.nameKo ?? code;
	const [koscom, dart, kindStatus] = await Promise.all([
		fetchKrxKoscomDisclosures(code, name).catch(() => []),
		fetchDartByCompany(name, 120).catch(() => []),
		fetchKindStatus()
	]);
	return {
		items: sortDisclosuresNewestFirst([...koscom, ...dart]),
		dart,
		koscom,
		kindStatus
	};
}
//#endregion
export { fetchKrxDisclosureDesk, fetchStockDisclosureBundle };
