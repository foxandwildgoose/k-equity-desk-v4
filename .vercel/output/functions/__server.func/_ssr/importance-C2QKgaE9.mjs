//#region node_modules/.nitro/vite/services/ssr/assets/importance-C2QKgaE9.js
/**
* Importance weights and keyword classes (B0.6). Data only — the scorer lives in
* `src/lib/feed/importance.ts`. Every weight here surfaces as a Korean reason chip.
*/
var TIER_POINTS = {
	1: {
		points: 25,
		label: "1차 출처"
	},
	2: {
		points: 15,
		label: "주요 매체"
	},
	3: {
		points: 5,
		label: "기타 출처"
	}
};
var FLASH_MARKERS = [
	"[속보]",
	"속보",
	"BREAKING",
	"FLASH",
	"긴급",
	"[긴급]"
];
var KEYWORD_CLASSES = [
	{
		id: "macro",
		label: "거시·정책",
		points: 20,
		topic: "macro",
		terms: [
			"FOMC",
			"기준금리",
			"금리 인상",
			"금리 인하",
			"CPI",
			"PCE",
			"소비자물가",
			"고용",
			"비농업",
			"실업률",
			"관세",
			"수출통제",
			"환율 급등",
			"환율 급락",
			"금통위",
			"연준",
			"Fed",
			"파월",
			"rate hike",
			"rate cut",
			"tariff",
			"export control",
			"payrolls",
			"inflation",
			"treasury yield"
		]
	},
	{
		id: "corporate",
		label: "기업 이벤트",
		points: 20,
		topic: "earnings",
		terms: [
			"실적",
			"어닝",
			"가이던스",
			"유상증자",
			"무상증자",
			"자사주",
			"공개매수",
			"인수",
			"합병",
			"분할",
			"상장폐지",
			"거래정지",
			"감사의견",
			"횡령",
			"earnings",
			"guidance",
			"buyback",
			"acquisition",
			"merger",
			"tender offer",
			"spin-off",
			"delisting"
		]
	},
	{
		id: "structure",
		label: "시장 구조",
		points: 30,
		topic: "market-structure",
		terms: [
			"서킷브레이커",
			"사이드카",
			"상한가",
			"하한가",
			"VI 발동",
			"변동성완화장치",
			"circuit breaker",
			"trading halt"
		]
	},
	{
		id: "rating",
		label: "등급·목표가",
		points: 10,
		topic: "rating",
		terms: [
			"목표가 상향",
			"목표가 하향",
			"목표주가 상향",
			"목표주가 하향",
			"투자의견 상향",
			"투자의견 하향",
			"upgrade",
			"downgrade",
			"initiate",
			"initiates",
			"price target"
		]
	}
];
/** Publisher → tier for aggregator sources (Naver, Google News) that relay many outlets. */
var OUTLET_TIERS = [{
	match: /^(연합뉴스|연합인포맥스|뉴스1|뉴시스|Yonhap|Reuters|로이터|Bloomberg|블룸버그|AP|AFP|Dow Jones)/i,
	tier: 1
}, {
	match: /^(한국경제|한경|매일경제|매경|머니투데이|서울경제|이데일리|파이낸셜뉴스|헤럴드경제|아시아경제|조선비즈|조선일보|중앙일보|동아일보|한겨레|경향신문|전자신문|디지털타임스|KBS|MBC|SBS|YTN|연합뉴스TV|CNBC|MarketWatch|Wall Street Journal|WSJ|Financial Times|FT|Barron's|The New York Times|Nikkei)/i,
	tier: 2
}];
/** Stopwords for title clustering (Latin words and Hangul bigrams). */
var CLUSTER_STOPWORDS = /* @__PURE__ */ new Set([
	"the",
	"a",
	"an",
	"of",
	"to",
	"in",
	"on",
	"for",
	"and",
	"or",
	"is",
	"are",
	"was",
	"with",
	"as",
	"at",
	"by",
	"from",
	"after",
	"amid",
	"its",
	"it",
	"this",
	"that",
	"be",
	"has",
	"have",
	"will",
	"속보",
	"단독",
	"종합",
	"기자",
	"뉴스",
	"보도",
	"특징",
	"특징주"
]);
/**
* Explainable importance score 0–100 (B0.6). Every contribution adds a Korean
* reason chip. Weights live in `src/data/news-keywords.ts`. Pure module.
*/
function escapeRe(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var termCache = /* @__PURE__ */ new Map();
function termRe(term) {
	let re = termCache.get(term);
	if (!re) {
		re = /^[A-Za-z0-9 .&'-]+$/.test(term) ? new RegExp(`(^|[^A-Za-z0-9])${escapeRe(term)}($|[^A-Za-z0-9])`, "i") : new RegExp(escapeRe(term), "i");
		termCache.set(term, re);
	}
	return re;
}
/** True when `text` contains `term` (Latin terms on word boundaries). */
function containsTerm(text, term) {
	return termRe(term).test(text);
}
/** Tier for an aggregator-relayed outlet name (e.g. `연합뉴스` → 1). */
function outletTier(outlet, fallback) {
	if (!outlet) return fallback;
	const name = outlet.trim();
	for (const row of OUTLET_TIERS) if (row.match.test(name)) return Math.min(row.tier, fallback);
	return fallback;
}
/** Keyword classes present in the text (for topics + reasons). */
function matchKeywordClasses(text) {
	const out = [];
	for (const cls of KEYWORD_CLASSES) {
		const term = cls.terms.find((t) => containsTerm(text, t));
		if (term) out.push({
			id: cls.id,
			label: cls.label,
			points: cls.points,
			topic: cls.topic,
			term
		});
	}
	return out;
}
function isFlashTitle(title) {
	const t = title.trim();
	return FLASH_MARKERS.some((m) => m.startsWith("[") ? t.includes(m) : containsTerm(t, m));
}
function tierFor(score) {
	if (score >= 80) return "flash";
	if (score >= 60) return "high";
	return "normal";
}
function scoreImportance(item, ctx = {}) {
	const reasons = [];
	let score = 0;
	const tier = TIER_POINTS[item.sourceTier] ?? TIER_POINTS[3];
	score += tier.points;
	reasons.push(`${tier.label} +${tier.points}`);
	if (isFlashTitle(item.title)) {
		score += 15;
		reasons.push(`속보 +15`);
	}
	const text = `${item.title} ${item.snippet ?? ""}`;
	let kw = 0;
	for (const m of matchKeywordClasses(text)) {
		const add = Math.min(m.points, 40 - kw);
		if (add <= 0) break;
		kw += add;
		reasons.push(`${m.label}: ${m.term} +${add}`);
	}
	score += kw;
	const watchTickers = new Set([...ctx.watchTickers ?? []].map((t) => t.toUpperCase()));
	const tickerHit = item.tickers.find((t) => watchTickers.has(`${t.market}:${t.code}`.toUpperCase()) || watchTickers.has(t.code.toUpperCase()));
	const keywordHit = tickerHit ? void 0 : [...ctx.watchKeywords ?? []].find((k) => k.trim().length >= 2 && containsTerm(text, k.trim()));
	if (tickerHit) {
		score += 20;
		reasons.push(`관심종목 ${tickerHit.code} +20`);
	} else if (keywordHit) {
		score += 20;
		reasons.push(`키워드 "${keywordHit.trim()}" +20`);
	}
	const size = item.cluster?.size ?? 1;
	if (size >= 3) {
		score += 10;
		reasons.push(`${size}개 매체 보도 +10`);
	}
	const now = ctx.now ?? Date.now();
	const ms = item.publishedAt ? Date.parse(item.publishedAt) : NaN;
	if (Number.isNaN(ms) || item.precision === "unknown") {
		const cut = score;
		score = 0;
		reasons.push(`시각 미상 −${cut}`);
	} else {
		const hours = Math.max(0, (now - ms) / 36e5);
		const decay = Math.floor(Math.max(0, hours - 2)) * 5;
		if (decay > 0) {
			const applied = Math.min(decay, score);
			score -= applied;
			reasons.push(`경과 ${Math.floor(hours)}시간 −${applied}`);
		}
	}
	score = Math.max(0, Math.min(100, score));
	return {
		score,
		tier: tierFor(score),
		reasons
	};
}
/** Topics implied by keyword classes (merged with source defaults by adapters). */
function topicsFromText(text) {
	return [...new Set(matchKeywordClasses(text).map((m) => m.topic))];
}
//#endregion
export { topicsFromText as a, scoreImportance as i, containsTerm as n, outletTier as r, CLUSTER_STOPWORDS as t };
