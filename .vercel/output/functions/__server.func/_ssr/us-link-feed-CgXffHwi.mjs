import { a as parseFeed, r as fetchWithPolicy } from "./http-CCgilygj.mjs";
import { s as parseSourceTime } from "./time-By5ScNNo.mjs";
import { f as sortTimedNewestFirst } from "./mappers-DlpCqw-E.mjs";
import { n as US_LINKED_NAMES, t as US_LINKED_CODES } from "./us-link-7--eFHFs.mjs";
import { o as stripPublisherSuffix } from "./generic-CkkW1ZKu.mjs";
import { a as fetchNews, c as fetchResearchDesk } from "./naver-market-C1ZunDb_.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/us-link-feed-CgXffHwi.js
/**
* Live US-link intelligence desk
* - Google News RSS (no API key) for 미중 AI 패권 / 미국 정책 / 산업
* - Broker research from Naver (industry/market/economy + stock coverage)
* Expert briefs remain editorial context; live items are clickable sources.
*/
function hashStr(s) {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
	return h;
}
/**
* Google News RSS search (no key). Goes through `fetchWithPolicy` (allowlist,
* cache, circuit) and the shared RSS parser. `sourceId` selects the registry
* entry for health/kill switch (defaults by locale).
*/
async function fetchGoogleNewsRss(query, limit = 10, locale = "ko", sourceId) {
	const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${locale === "ko" ? "ko" : "en-US"}&gl=${locale === "ko" ? "KR" : "US"}&ceid=${locale === "ko" ? "KR:ko" : "US:en"}`;
	const res = await fetchWithPolicy(url, {
		sourceId: sourceId ?? (locale === "ko" ? "gn-kr-market" : "gn-us-market"),
		accept: "application/rss+xml,application/xml,text/xml"
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const items = [];
	for (const e of parseFeed(res.text).slice(0, limit)) {
		const source = e.source?.trim() || "Google News";
		const title = stripPublisherSuffix(e.title, e.source);
		if (!title || !e.link) continue;
		if (title.includes("Google 뉴스") || title.includes("Google News")) continue;
		const iso = parseSourceTime(e.pubDate, { zone: "UTC" }).iso ?? "";
		items.push({
			id: `gn-${Math.abs(hashStr(e.link + title)).toString(36)}`,
			title,
			url: e.link,
			source,
			datetime: iso,
			query
		});
	}
	return items;
}
/** Keyword → Korean equity codes (desk mapping, not holdings) */
var CODE_HINTS = [
	{
		re: /HBM|고대역|메모리|삼성전자|SK하이닉스|반도체/,
		codes: ["005930", "000660"]
	},
	{
		re: /패키징|본딩|후공정|한미반도체/,
		codes: [
			"042700",
			"058470",
			"039030"
		]
	},
	{
		re: /장비|식각|증착|소부장/,
		codes: [
			"240810",
			"042700",
			"039030"
		]
	},
	{
		re: /배터리|2차전지|IRA|양극|셀 |LG에너지|삼성SDI/,
		codes: [
			"373220",
			"006400",
			"051910",
			"247540"
		]
	},
	{
		re: /방산|무기|한화에어로|LIG|현대로템/,
		codes: [
			"012450",
			"047810",
			"079550",
			"272210"
		]
	},
	{
		re: /조선|LNG|해군|한화오션|HD현대/,
		codes: [
			"009540",
			"042660",
			"329180"
		]
	},
	{
		re: /원전|SMR|전력|변압|두산에너빌|HD현대일렉/,
		codes: [
			"034020",
			"267260",
			"298040",
			"052690"
		]
	},
	{
		re: /바이오|CDMO|삼성바이오로직|셀트리온/,
		codes: ["207940", "068270"]
	},
	{
		re: /현대차|기아|전기차|자동차/,
		codes: ["005380", "000270"]
	}
];
function relatedCodesFromText(text) {
	const hits = /* @__PURE__ */ new Set();
	for (const h of CODE_HINTS) if (h.re.test(text)) h.codes.forEach((c) => hits.add(c));
	for (const n of US_LINKED_NAMES);
	return [...hits].slice(0, 6);
}
function deskNoteFor(category, title) {
	const t = title;
	if (category === "ai-race") {
		if (/수출통제|entity|BIS|제재|금지|restrict/i.test(t)) return "수출통제 강화 → 중국향 장비·칩 매출 리스크 vs 미국·동맹 프리미엄. 라이선스·고객 믹스 확인.";
		if (/HBM|고대역|패키징|메모리/i.test(t)) return "AI 병목(HBM·패키징) 공급 이슈. ASP·배분·증설 타임라인이 메모리·장비 주가 핵심 촉매.";
		if (/CHIPS|보조금|fab|팹 /i.test(t)) return "미국 보조금·가드레일 → 한국 기업의 미국 투자/JV 인센티브와 중국 사업 제약 동시 점검.";
		if (/엔비디아|NVIDIA|가속기|GPU|AI 서버/i.test(t)) return "빅테크 capex 가이던스는 HBM·전력·냉각 밸류체인 수요의 선행 지표.";
		return "미·중 AI 기술 경쟁 뉴스. 공급망·규제·수요 세 축으로 한국 수혜/피해 종목을 분류해 보세요.";
	}
	if (category === "policy") {
		if (/IRA|세액|세금|보조금/i.test(t)) return "IRA·산업정책 변화는 북미 셀·소재 공장 NPV와 수주 가시성을 직접 흔듭니다.";
		if (/관세|tariff|통상/i.test(t)) return "관세·통상 리스크는 자동차·철강·배터리 마진 가정 재작성이 필요.";
		if (/연준|금리|Fed|FOMC|달러/i.test(t)) return "미 금리·달러는 외국인 수급·성장주 멀티플·원자재 가격의 공통 변수.";
		if (/방산|안보|NATO|동맹/i.test(t)) return "동맹 방산 예산·FMS 파이프라인 → 한국 방산 수출 모멘텀.";
		return "미국 정책 이벤트. 시행 시점·예외조항·한국 적용 여부를 원문에서 확인하세요.";
	}
	if (/반도체|HBM|AI/i.test(t)) return "반도체 산업 사이클·AI 수요. 메모리/장비/소재 중 어느 레이어 수혜인지 구분.";
	if (/전지|배터리|ESS/i.test(t)) return "배터리 산업: 북미 램프업, 원가, ESS 수요가 실적 레버리지.";
	if (/원전|전력|그리드/i.test(t)) return "AI 전력 수요 + 미국 그리드 노후화가 한국 전력기기·원전 기자재 테마.";
	return "산업 동향이 밸류에이션 재평가 촉매가 되는지 수주·가동률·가격으로 검증.";
}
/** Curated search queries per desk (Wall Street style coverage map) */
var US_FEED_QUERIES = {
	"ai-race": [
		{ q: "미중 반도체 수출통제" },
		{ q: "중국 AI 반도체 제재 미국" },
		{ q: "HBM AI 반도체 수요" },
		{
			q: "US China AI chip export controls",
			locale: "en"
		},
		{
			q: "BIS semiconductor entity list",
			locale: "en"
		},
		{ q: "CHIPS Act Korea semiconductor" }
	],
	policy: [
		{ q: "미국 CHIPS Act 보조금" },
		{ q: "IRA 배터리 세액공제" },
		{ q: "미국 관세 한국 자동차" },
		{ q: "연준 금리 한국 증시" },
		{
			q: "US IRA EV tax credit battery",
			locale: "en"
		},
		{
			q: "US defense budget ally export",
			locale: "en"
		}
	],
	industry: [
		{ q: "한국 반도체 산업 전망" },
		{ q: "2차전지 미국 공장" },
		{ q: "방산 수출 미국 동맹" },
		{ q: "원전 수주 미국 SMR" },
		{ q: "AI 데이터센터 전력 변압기" },
		{ q: "조선 LNG 미국 에너지" }
	]
};
var RESEARCH_KW = {
	"ai-race": /AI|인공지능|HBM|미중|중국|수출통제|반도체|메모리|패키징|엔비디아|가속기|CHIPS|소부장/,
	policy: /미국|IRA|관세|통상|연준|금리|달러|보조금|정책|규제|FOMC|트럼프|바이든|행정부|안보/,
	industry: /산업|업종|전망|배터리|2차전지|방산|원전|전력|조선|자동차|바이오|CDMO|그리드|ESS/
};
async function fetchCategoryNews(category) {
	const queries = US_FEED_QUERIES[category];
	const packs = await Promise.all(queries.map(async ({ q, locale }) => {
		try {
			return (await fetchGoogleNewsRss(q, 8, locale ?? "ko")).map((r) => {
				const related = relatedCodesFromText(r.title);
				return {
					...r,
					id: `${category}-${r.id}`,
					category,
					kind: "news",
					deskNote: deskNoteFor(category, r.title),
					relatedCodes: related
				};
			});
		} catch {
			return [];
		}
	}));
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const row of packs.flat()) {
		const key = row.title.replace(/\s+/g, "").slice(0, 40);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(row);
	}
	return sortTimedNewestFirst(out, "UTC").slice(0, 28);
}
function researchToArticle(r, category) {
	const text = `${r.title} ${r.summary} ${r.preview}`;
	return {
		id: `rs-${category}-${r.researchId}`,
		category,
		title: r.title,
		url: r.pdfUrl || r.pageUrl || "https://finance.naver.com/research/",
		source: r.broker || "증권사 리서치",
		datetime: parseSourceTime(r.date, { zone: "Asia/Seoul" }).iso?.slice(0, 10) ?? "",
		query: "broker-research",
		kind: "report",
		summary: r.summary || r.preview,
		broker: r.broker,
		pdfUrl: r.pdfUrl,
		deskNote: deskNoteFor(category, text),
		relatedCodes: relatedCodesFromText(text).slice(0, 6)
	};
}
/** Official / primary sources (always available, high signal) */
var US_OFFICIAL_SOURCES = [
	{
		id: "off-bis",
		category: "ai-race",
		title: "U.S. BIS — Export Administration (반도체·AI 관련 통제 공지)",
		url: "https://www.bis.doc.gov/",
		source: "U.S. Department of Commerce / BIS",
		datetime: "",
		query: "official",
		kind: "official",
		deskNote: "수출통제 1차 소스. Entity List·라이선스 정책 변경 시 장비·소재 중국 매출 가정을 즉시 재작성.",
		relatedCodes: [
			"005930",
			"000660",
			"042700",
			"240810"
		]
	},
	{
		id: "off-chips",
		category: "policy",
		title: "CHIPS.gov — 미국 반도체 보조금·가드레일",
		url: "https://www.nist.gov/chips",
		source: "U.S. NIST / CHIPS Program",
		datetime: "",
		query: "official",
		kind: "official",
		deskNote: "보조금 수혜·가드레일(중국 확장 제한) 조항이 한국 기업의 미국 투자와 중국 전략을 동시에 규정.",
		relatedCodes: ["005930", "000660"]
	},
	{
		id: "off-ira",
		category: "policy",
		title: "IRS — IRA Clean Vehicle / 제조 세액공제 안내",
		url: "https://www.irs.gov/credits-deductions/credits-for-new-clean-vehicles-purchased-in-2023-or-after",
		source: "U.S. IRS",
		datetime: "",
		query: "official",
		kind: "official",
		deskNote: "북미 조립·핵심광물 요건 충족 여부가 한국 셀·소재의 미국 ASP·물량 프리미엄을 결정.",
		relatedCodes: [
			"373220",
			"006400",
			"051910",
			"005380"
		]
	},
	{
		id: "off-fed",
		category: "policy",
		title: "Federal Reserve — FOMC 성명·경제전망 (SEP)",
		url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
		source: "U.S. Federal Reserve",
		datetime: "",
		query: "official",
		kind: "official",
		deskNote: "금리 경로 → 외국인 수급·성장주 멀티플·원/달러. 한국 수출주 베타의 매크로 앵커.",
		relatedCodes: [
			"005930",
			"000660",
			"005380"
		]
	},
	{
		id: "off-doe",
		category: "industry",
		title: "U.S. DOE — 원전·그리드·에너지 인프라",
		url: "https://www.energy.gov/",
		source: "U.S. Department of Energy",
		datetime: "",
		query: "official",
		kind: "official",
		deskNote: "미국 전력·원전 정책이 한국 원전 기자재·변압기·가스터빈 수출 파이프라인의 수요 측.",
		relatedCodes: [
			"034020",
			"267260",
			"298040"
		]
	},
	{
		id: "off-defense",
		category: "industry",
		title: "U.S. DoD — 국방예산·동맹 협력",
		url: "https://www.defense.gov/",
		source: "U.S. Department of Defense",
		datetime: "",
		query: "official",
		kind: "official",
		deskNote: "동맹 방산 조달·MRO·함정 협력이 한국 방산·조선 수주의 중기 가시성.",
		relatedCodes: [
			"012450",
			"047810",
			"009540",
			"329180"
		]
	}
];
async function fetchUsLinkLiveFeeds() {
	const [aiRaceNews, policyNews, industryNews, desk, stockBundles] = await Promise.all([
		fetchCategoryNews("ai-race"),
		fetchCategoryNews("policy"),
		fetchCategoryNews("industry"),
		fetchResearchDesk().catch(() => ({
			industry: [],
			market: [],
			economy: [],
			featured: []
		})),
		Promise.all(US_LINKED_CODES.slice(0, 12).map(async (code) => {
			try {
				return (await fetchNews(code)).slice(0, 4).map((n) => ({
					...n,
					code
				}));
			} catch {
				return [];
			}
		}))
	]);
	const allResearch = [
		...desk.industry ?? [],
		...desk.market ?? [],
		...desk.economy ?? [],
		...desk.featured ?? []
	];
	const aiReports = allResearch.filter((r) => RESEARCH_KW["ai-race"].test(`${r.title} ${r.summary} ${r.preview}`)).slice(0, 16).map((r) => researchToArticle(r, "ai-race"));
	const policyReports = allResearch.filter((r) => RESEARCH_KW.policy.test(`${r.title} ${r.summary} ${r.preview}`)).slice(0, 16).map((r) => researchToArticle(r, "policy"));
	const industryReports = allResearch.filter((r) => RESEARCH_KW.industry.test(`${r.title} ${r.summary} ${r.preview}`)).slice(0, 20).map((r) => researchToArticle(r, "industry"));
	const officialAi = US_OFFICIAL_SOURCES.filter((x) => x.category === "ai-race");
	const officialPol = US_OFFICIAL_SOURCES.filter((x) => x.category === "policy");
	const officialInd = US_OFFICIAL_SOURCES.filter((x) => x.category === "industry");
	const stockNews = sortTimedNewestFirst(stockBundles.flat()).slice(0, 48);
	return {
		aiRace: [
			...officialAi,
			...aiRaceNews,
			...aiReports
		].slice(0, 40),
		policy: [
			...officialPol,
			...policyNews,
			...policyReports
		].slice(0, 40),
		industry: [
			...officialInd,
			...industryNews,
			...industryReports
		].slice(0, 40),
		stockNews,
		research: allResearch.slice(0, 40),
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
//#endregion
export { fetchUsLinkLiveFeeds as n, fetchGoogleNewsRss as t };
