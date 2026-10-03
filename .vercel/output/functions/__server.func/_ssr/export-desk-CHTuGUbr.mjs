import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as createServerFn } from "./ssr.mjs";
import { c as string, r as array, s as object } from "../_libs/zod.mjs";
import { d as normalizeKrTicker } from "./universe-BLkYDatc.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
import { d as createSsrRpc } from "./classify-DLKCwe5y.mjs";
import { r as useQuery } from "../_libs/tanstack__react-query.mjs";
import { J as Info, Q as FileUp, et as FileSpreadsheet, g as Ship, ot as Earth, s as TriangleAlert, st as Download } from "../_libs/lucide-react.mjs";
import { It as useAppStore, Nt as Input, Pt as cn, st as Button, v as Switch, wt as kstYmd } from "./router-B1V8nj-n.mjs";
import { f as ye } from "../_libs/lightweight-charts.mjs";
import { C as chartExportName, D as createProChart, E as computeSeriesRangePosition, L as formatChartPercent, M as downloadCsv, N as downloadSvgAsPng, at as readChartTheme, c as RangeMarkerPrimitive, et as planRangeMarkers, it as rangeMarkerText, l as RangePositionStrip, r as ChartShell } from "./tools-Cb8-otqN.mjs";
import { t as Badge } from "./badge-CgqpWL27.mjs";
import { a as useChartChrome, i as exportRowsCsv, n as ScaleToggle, r as exportChartPng, t as RangePresets } from "./chrome-CFMydwn4.mjs";
import { a as proxyForKey, r as hsName } from "./hs-map-CWBcqt5N.mjs";
import { a as Bar, i as CartesianGrid, n as YAxis, o as ResponsiveContainer, r as XAxis, s as Tooltip, t as BarChart } from "../_libs/recharts+[...].mjs";
import { i as Trigger, n as List, r as Root2, t as Content } from "../_libs/radix-ui__react-tabs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/export-desk-CHTuGUbr.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Tabs = Root2;
function TabsList({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, {
		className: cn("inline-flex h-9 items-center justify-center gap-0.5 rounded-lg bg-muted p-1 text-muted-foreground", className),
		...props
	});
}
function TabsTrigger({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trigger, {
		className: cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm", className),
		...props
	});
}
function TabsContent({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content, {
		className: cn("mt-3 focus-visible:outline-none", className),
		...props
	});
}
var DATA_SOURCES = [
	{
		id: "customs.total",
		displayName: "수출입총괄",
		operator: "Korea Customs Service",
		portal: "https://www.data.go.kr",
		baseUrl: "https://apis.data.go.kr",
		authMode: "SERVICE_KEY_QUERY",
		classification: "NONE",
		geographyLevel: "NATIONAL",
		cadence: "MONTHLY",
		status: "KEY_MISSING"
	},
	{
		id: "customs.item",
		displayName: "품목별 수출입실적",
		operator: "Korea Customs Service",
		portal: "https://www.data.go.kr",
		baseUrl: "https://apis.data.go.kr",
		authMode: "SERVICE_KEY_QUERY",
		classification: "HS",
		geographyLevel: "NATIONAL",
		cadence: "MONTHLY",
		status: "KEY_MISSING"
	},
	{
		id: "customs.item_country",
		displayName: "품목별 국가별 수출입실적",
		operator: "Korea Customs Service",
		portal: "https://www.data.go.kr",
		baseUrl: "http://apis.data.go.kr/1220000/nitemtrade",
		authMode: "SERVICE_KEY_QUERY",
		classification: "HS",
		geographyLevel: "COUNTRY",
		cadence: "MONTHLY",
		status: "UNVERIFIED",
		verifiedRequestPath: "http://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList"
	},
	{
		id: "customs.country",
		displayName: "국가별 수출입실적",
		operator: "Korea Customs Service",
		portal: "https://www.data.go.kr",
		baseUrl: "https://apis.data.go.kr",
		authMode: "SERVICE_KEY_QUERY",
		classification: "NONE",
		geographyLevel: "COUNTRY",
		cadence: "MONTHLY",
		status: "KEY_MISSING"
	},
	{
		id: "customs.sido",
		displayName: "시도별 수출입실적",
		operator: "Korea Customs Service",
		portal: "https://www.data.go.kr",
		baseUrl: "https://apis.data.go.kr",
		authMode: "SERVICE_KEY_QUERY",
		classification: "NONE",
		geographyLevel: "SIDO",
		cadence: "MONTHLY",
		status: "KEY_MISSING"
	},
	{
		id: "kita.kstat",
		displayName: "KITA K-stat (MTI)",
		operator: "KITA",
		portal: "https://stat.kita.net",
		baseUrl: "https://stat.kita.net",
		authMode: "NONE",
		classification: "MTI",
		geographyLevel: "NATIONAL",
		cadence: "MONTHLY",
		status: "UNVERIFIED"
	},
	{
		id: "motie.release",
		displayName: "MOTIE 수출입 동향",
		operator: "MOTIE",
		portal: "https://www.motie.go.kr",
		baseUrl: "https://www.motie.go.kr",
		authMode: "NONE",
		classification: "MTI",
		geographyLevel: "NATIONAL",
		cadence: "MONTHLY",
		status: "UNVERIFIED"
	},
	{
		id: "krx.datasys",
		displayName: "KRX 정보데이터시스템",
		operator: "KRX",
		portal: "https://data.krx.co.kr",
		baseUrl: "https://data.krx.co.kr",
		authMode: "NONE",
		classification: "NONE",
		geographyLevel: "MARKET",
		cadence: "DAILY",
		status: "UNVERIFIED"
	},
	{
		id: "naver.kospi",
		displayName: "KOSPI / 종목 시세 (Naver·Yahoo)",
		operator: "Naver Finance / Yahoo",
		portal: "https://finance.naver.com",
		baseUrl: "https://query1.finance.yahoo.com",
		authMode: "NONE",
		classification: "NONE",
		geographyLevel: "MARKET",
		cadence: "DAILY",
		status: "CONFIGURED"
	},
	{
		id: "bok.fx",
		displayName: "원/달러 (BOK / Naver / Yahoo)",
		operator: "Bank of Korea",
		portal: "https://ecos.bok.or.kr",
		baseUrl: "https://query1.finance.yahoo.com",
		authMode: "NONE",
		classification: "NONE",
		geographyLevel: "MARKET",
		cadence: "DAILY",
		status: "CONFIGURED"
	}
];
var regionalCapability_config_default = {
	schemaVersion: 1,
	note: "Administrative disclosure rules. 시군구 × HSK-10 is not an official published cube.",
	levels: [
		{
			"id": "NATIONAL",
			"ko": "전국",
			"available": true,
			"classifications": [
				"HS",
				"HSK",
				"MTI"
			]
		},
		{
			"id": "SIDO",
			"ko": "시도",
			"available": true,
			"classifications": ["HS", "MTI"],
			"count": 17
		},
		{
			"id": "SIGUNGU",
			"ko": "시군구",
			"available": false,
			"reason": "관세청 공식 월별 큐브가 시군구×HSK-10을 제공하지 않습니다."
		},
		{
			"id": "CUSTOMS_OFFICE",
			"ko": "세관",
			"available": true,
			"note": "세관 ≠ 생산지"
		},
		{
			"id": "COUNTRY",
			"ko": "국가",
			"available": true
		},
		{
			"id": "ECONOMIC_BLOC",
			"ko": "경제권",
			"available": true
		}
	],
	forbiddenCombos: [{
		"geo": "SIGUNGU",
		"classification": "HSK10",
		"reason": "시군구 × HSK-10 공식 시계열이 없습니다. 숫자를 합성하지 않습니다."
	}]
};
var KO = {
	"export.desk.title": "Korea Export × KOSPI Intelligence Desk",
	"export.total.title": "대한민국 총수출 × KOSPI",
	"export.core20.title": "20대 주력 수출",
	"export.all.title": "전체 수출 산업",
	"export.industry100.title": "산업 × KOSPI Top 100",
	"export.corr.title": "상관관계 / 선후행",
	"export.region.title": "지역 수출",
	"export.qa.title": "데이터 품질 / 출처",
	"export.admin.title": "매핑 관리",
	"export.import.title": "데이터 가져오기",
	"export.empty.exports": "공식 시계열을 불러오는 중이거나 소스가 비어 있습니다. 품질 탭에서 출처를 확인하세요.",
	"export.empty.sector": "해당 산업에 노출 기준을 충족하는 KOSPI 100대 기업이 없습니다.",
	"export.demo.banner": "DEMO MODE — 합성 수출 숫자입니다. 투자 판단에 쓰지 마세요.",
	"export.unverified": "미검증 매핑",
	"export.candidatesHidden": "검증 대기 후보 기업이 숨겨져 있습니다.",
	"export.provenance": "출처",
	"export.insufficient": "Insufficient data",
	"export.preliminary": "PRELIMINARY / PARTIAL MONTH",
	"export.seasonal": "seasonal — for reference",
	"export.spliced": "SPLICED — not an official series",
	"export.aggregated": "AGGREGATED_FROM_HSK",
	"export.taxonomy.badge": "분류체계"
};
var EN = {
	"export.desk.title": "Korea Export × KOSPI Intelligence Desk",
	"export.total.title": "Korea Total Exports × KOSPI",
	"export.core20.title": "20 Major Export Items",
	"export.all.title": "All Export Industries",
	"export.industry100.title": "Industry × KOSPI Top 100",
	"export.corr.title": "Correlation / Lead-lag",
	"export.region.title": "Regional exports",
	"export.qa.title": "Data quality / provenance",
	"export.admin.title": "Mapping admin",
	"export.import.title": "Import data",
	"export.empty.exports": "Official series is loading or unavailable. Check the quality tab for provenance.",
	"export.empty.sector": "No KOSPI Top-100 name meets the exposure threshold for this industry.",
	"export.demo.banner": "DEMO MODE — synthetic export figures. Do not trade on this.",
	"export.unverified": "Unverified mapping",
	"export.candidatesHidden": "Candidate companies hidden pending verification.",
	"export.provenance": "Source",
	"export.insufficient": "Insufficient data",
	"export.preliminary": "PRELIMINARY / PARTIAL MONTH",
	"export.seasonal": "seasonal — for reference",
	"export.spliced": "SPLICED — not an official series",
	"export.aggregated": "AGGREGATED_FROM_HSK",
	"export.taxonomy.badge": "Taxonomy"
};
function t(key, lang) {
	return (lang === "en" ? EN : KO)[key] ?? key;
}
/** Store-level guard: synthetic values never leave unless DEMO MODE is on. */
function assertNoSyntheticLeak(rows, demoMode) {
	if (demoMode) return;
	for (const r of rows) if (r.sourceFile === "DEMO" || r.vintage === "DEMO") throw new Error("DEMO series leaked into production mode");
}
var TIER_WEIGHT = {
	PRIMARY: .6,
	MATERIAL: .3,
	MINOR: .1
};
function seedWeight(tier) {
	return TIER_WEIGHT[tier];
}
function validateWeightConservation(rows) {
	const sums = /* @__PURE__ */ new Map();
	for (const r of rows) {
		if (r.active === false) continue;
		sums.set(r.ticker, (sums.get(r.ticker) ?? 0) + r.exposureWeight);
	}
	for (const [ticker, sum] of sums) if (sum > 1 + 1e-9) return {
		ok: false,
		ticker,
		sum,
		error: `exposure weights for ${ticker} sum to ${sum.toFixed(3)} > 1.00`
	};
	return { ok: true };
}
function isActiveOn(row, date) {
	if (row.active === false) return false;
	if (row.effectiveFrom && date < row.effectiveFrom) return false;
	if (row.effectiveTo && date > row.effectiveTo) return false;
	return true;
}
function resolveCompanySectorExposure(rows, opts) {
	const minW = opts.minWeight ?? .2;
	const minC = opts.minConfidence ?? .7;
	let list = rows.filter((r) => {
		if (!isActiveOn(r, opts.asOf)) return false;
		if (!opts.top100Tickers.has(r.ticker)) return false;
		if (!(r.exportCategoryId === opts.categoryId || opts.includeInheritedFrom != null && r.exportCategoryId === opts.includeInheritedFrom)) return false;
		if (r.exposureWeight < minW) return false;
		if (r.mappingConfidence < minC) return false;
		return true;
	});
	if (opts.primaryOnly) {
		const best = /* @__PURE__ */ new Map();
		for (const r of rows.filter((x) => isActiveOn(x, opts.asOf) && opts.top100Tickers.has(x.ticker))) {
			const prev = best.get(r.ticker);
			if (!prev || r.exposureWeight > prev.exposureWeight) best.set(r.ticker, r);
		}
		list = list.filter((r) => best.get(r.ticker)?.exportCategoryId === r.exportCategoryId);
	}
	return list.sort((a, b) => b.exposureWeight - a.exposureWeight);
}
function validateTradeTotals(parts, officialTotal, tolPct = 2) {
	const sum = parts.reduce((a, b) => a + b, 0);
	const gap = sum - officialTotal;
	const gapPct = officialTotal === 0 ? sum === 0 ? 0 : 100 : gap / officialTotal * 100;
	return {
		gap,
		gapPct,
		pass: Math.abs(gapPct) <= tolPct
	};
}
var exposureSeed_config_default = {
	schemaVersion: 1,
	verificationStatus: "UNVERIFIED_SEED",
	note: "Candidate links based on publicly-known lines of business. Weights must be replaced by DART segment-revenue derivation or manual review before a row is treated as verified. Ticker inclusion here is NOT a claim of KOSPI Top-100 membership.",
	links: [
		{
			"ticker": "005930",
			"name": "삼성전자",
			"category": "semiconductors",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "005930",
			"name": "삼성전자",
			"category": "wireless_devices",
			"role": "DEVICE_MAKER",
			"tier": "MATERIAL"
		},
		{
			"ticker": "005930",
			"name": "삼성전자",
			"category": "home_appliances",
			"role": "DEVICE_MAKER",
			"tier": "MINOR"
		},
		{
			"ticker": "000660",
			"name": "SK하이닉스",
			"category": "semiconductors",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "000990",
			"name": "DB하이텍",
			"category": "semiconductors",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "042700",
			"name": "한미반도체",
			"category": "semiconductors",
			"role": "EQUIPMENT",
			"tier": "PRIMARY"
		},
		{
			"ticker": "108320",
			"name": "LX세미콘",
			"category": "semiconductors",
			"role": "COMPONENTS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "034220",
			"name": "LG디스플레이",
			"category": "displays",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "011070",
			"name": "LG이노텍",
			"category": "wireless_devices",
			"role": "COMPONENTS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "066570",
			"name": "LG전자",
			"category": "home_appliances",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "005380",
			"name": "현대차",
			"category": "automobiles",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "000270",
			"name": "기아",
			"category": "automobiles",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "012330",
			"name": "현대모비스",
			"category": "auto_parts",
			"role": "COMPONENTS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "204320",
			"name": "HL만도",
			"category": "auto_parts",
			"role": "COMPONENTS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "018880",
			"name": "한온시스템",
			"category": "auto_parts",
			"role": "COMPONENTS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "011210",
			"name": "현대위아",
			"category": "auto_parts",
			"role": "COMPONENTS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "005850",
			"name": "에스엘",
			"category": "auto_parts",
			"role": "COMPONENTS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "010950",
			"name": "S-Oil",
			"category": "petroleum_products",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "096770",
			"name": "SK이노베이션",
			"category": "petroleum_products",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "096770",
			"name": "SK이노베이션",
			"category": "secondary_batteries",
			"role": "DEVICE_MAKER",
			"tier": "MATERIAL"
		},
		{
			"ticker": "051910",
			"name": "LG화학",
			"category": "petrochemicals",
			"role": "MATERIALS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "051910",
			"name": "LG화학",
			"category": "secondary_batteries",
			"role": "MATERIALS",
			"tier": "MATERIAL"
		},
		{
			"ticker": "011170",
			"name": "롯데케미칼",
			"category": "petrochemicals",
			"role": "MATERIALS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "011780",
			"name": "금호석유",
			"category": "petrochemicals",
			"role": "MATERIALS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "009830",
			"name": "한화솔루션",
			"category": "petrochemicals",
			"role": "MATERIALS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "006650",
			"name": "대한유화",
			"category": "petrochemicals",
			"role": "MATERIALS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "005490",
			"name": "POSCO홀딩스",
			"category": "steel",
			"role": "MATERIALS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "004020",
			"name": "현대제철",
			"category": "steel",
			"role": "MATERIALS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "460860",
			"name": "동국제강",
			"category": "steel",
			"role": "MATERIALS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "009540",
			"name": "HD한국조선해양",
			"category": "ships",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "329180",
			"name": "HD현대중공업",
			"category": "ships",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "042660",
			"name": "한화오션",
			"category": "ships",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "010140",
			"name": "삼성중공업",
			"category": "ships",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "010620",
			"name": "HD현대미포",
			"category": "ships",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "034020",
			"name": "두산에너빌리티",
			"category": "general_machinery",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "042670",
			"name": "HD현대인프라코어",
			"category": "general_machinery",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "267270",
			"name": "HD현대건설기계",
			"category": "general_machinery",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "373220",
			"name": "LG에너지솔루션",
			"category": "secondary_batteries",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "006400",
			"name": "삼성SDI",
			"category": "secondary_batteries",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "003670",
			"name": "포스코퓨처엠",
			"category": "secondary_batteries",
			"role": "MATERIALS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "066970",
			"name": "엘앤에프",
			"category": "secondary_batteries",
			"role": "MATERIALS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "207940",
			"name": "삼성바이오로직스",
			"category": "bio_health",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "068270",
			"name": "셀트리온",
			"category": "bio_health",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "000100",
			"name": "유한양행",
			"category": "bio_health",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "128940",
			"name": "한미약품",
			"category": "bio_health",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "006280",
			"name": "GC녹십자",
			"category": "bio_health",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "326030",
			"name": "SK바이오팜",
			"category": "bio_health",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "267260",
			"name": "HD현대일렉트릭",
			"category": "electrical_equipment",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "010120",
			"name": "LS ELECTRIC",
			"category": "electrical_equipment",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "298040",
			"name": "효성중공업",
			"category": "electrical_equipment",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "001440",
			"name": "대한전선",
			"category": "electrical_equipment",
			"role": "COMPONENTS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "010130",
			"name": "고려아연",
			"category": "non_ferrous_metals",
			"role": "MATERIALS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "103140",
			"name": "풍산",
			"category": "non_ferrous_metals",
			"role": "MATERIALS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "097950",
			"name": "CJ제일제당",
			"category": "agri_fishery_food",
			"role": "DOWNSTREAM",
			"tier": "PRIMARY"
		},
		{
			"ticker": "004370",
			"name": "농심",
			"category": "agri_fishery_food",
			"role": "DOWNSTREAM",
			"tier": "PRIMARY"
		},
		{
			"ticker": "271560",
			"name": "오리온",
			"category": "agri_fishery_food",
			"role": "DOWNSTREAM",
			"tier": "PRIMARY"
		},
		{
			"ticker": "003230",
			"name": "삼양식품",
			"category": "agri_fishery_food",
			"role": "DOWNSTREAM",
			"tier": "PRIMARY"
		},
		{
			"ticker": "001680",
			"name": "대상",
			"category": "agri_fishery_food",
			"role": "DOWNSTREAM",
			"tier": "PRIMARY"
		},
		{
			"ticker": "090430",
			"name": "아모레퍼시픽",
			"category": "cosmetics",
			"role": "DOWNSTREAM",
			"tier": "PRIMARY"
		},
		{
			"ticker": "051900",
			"name": "LG생활건강",
			"category": "cosmetics",
			"role": "DOWNSTREAM",
			"tier": "PRIMARY"
		},
		{
			"ticker": "051900",
			"name": "LG생활건강",
			"category": "household_goods",
			"role": "DOWNSTREAM",
			"tier": "MATERIAL"
		},
		{
			"ticker": "192820",
			"name": "코스맥스",
			"category": "cosmetics",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "161890",
			"name": "한국콜마",
			"category": "cosmetics",
			"role": "DEVICE_MAKER",
			"tier": "PRIMARY"
		},
		{
			"ticker": "298020",
			"name": "효성티앤씨",
			"category": "textiles",
			"role": "MATERIALS",
			"tier": "PRIMARY"
		},
		{
			"ticker": "003240",
			"name": "태광산업",
			"category": "textiles",
			"role": "MATERIALS",
			"tier": "PRIMARY"
		}
	],
	excludedByDefault: [
		{
			"ticker": "402340",
			"name": "SK스퀘어",
			"reason": "Holding company — semiconductor exposure is equity-method, not operating. Enable only with an explicit look-through model."
		},
		{
			"ticker": "078930",
			"name": "GS",
			"reason": "Holding company — refining exposure via affiliate. Enable only with an explicit look-through model."
		},
		{
			"ticker": "267250",
			"name": "HD현대",
			"reason": "Holding company — refining and shipbuilding exposure via subsidiaries. Enable only with an explicit look-through model."
		},
		{
			"ticker": "006260",
			"name": "LS",
			"reason": "Holding company — non-ferrous and electrical exposure via subsidiaries."
		}
	]
};
var core20_config_default = {
	taxonomyVersion: "MTI-2026",
	effectiveFrom: "2026-06-01",
	sourceNote: "MOTIE monthly export/import trend framework — 20 major export items (expanded from 15 in the 2026 MTI revision). Verify against the latest MOTIE monthly release before relying on this list.",
	verificationStatus: "UNVERIFIED_SEED",
	items: [
		{
			"key": "semiconductors",
			"ko": "반도체",
			"en": "Semiconductors",
			"subItems": [
				"메모리(DRAM)",
				"메모리(NAND)",
				"시스템반도체"
			]
		},
		{
			"key": "automobiles",
			"ko": "자동차",
			"en": "Automobiles",
			"subItems": ["신차", "중고차"]
		},
		{
			"key": "auto_parts",
			"ko": "자동차부품",
			"en": "Auto Parts",
			"subItems": []
		},
		{
			"key": "general_machinery",
			"ko": "일반기계",
			"en": "General Machinery",
			"subItems": []
		},
		{
			"key": "petrochemicals",
			"ko": "석유화학",
			"en": "Petrochemicals",
			"subItems": []
		},
		{
			"key": "petroleum_products",
			"ko": "석유제품",
			"en": "Petroleum Products",
			"subItems": []
		},
		{
			"key": "steel",
			"ko": "철강",
			"en": "Steel",
			"subItems": ["기타 철강금속제품"]
		},
		{
			"key": "ships",
			"ko": "선박",
			"en": "Ships / Shipbuilding",
			"subItems": []
		},
		{
			"key": "displays",
			"ko": "디스플레이",
			"en": "Displays",
			"subItems": []
		},
		{
			"key": "wireless_devices",
			"ko": "무선통신기기",
			"en": "Wireless Communication Devices",
			"subItems": []
		},
		{
			"key": "computers",
			"ko": "컴퓨터",
			"en": "Computers",
			"subItems": []
		},
		{
			"key": "bio_health",
			"ko": "바이오헬스",
			"en": "Bio-Health",
			"subItems": ["의약품", "의료기기"]
		},
		{
			"key": "secondary_batteries",
			"ko": "이차전지",
			"en": "Secondary Batteries",
			"subItems": ["리튬이온전지", "배터리 소재"]
		},
		{
			"key": "textiles",
			"ko": "섬유",
			"en": "Textiles",
			"subItems": [
				"천연소재",
				"가방",
				"신발"
			]
		},
		{
			"key": "home_appliances",
			"ko": "가전",
			"en": "Home Appliances",
			"subItems": []
		},
		{
			"key": "electrical_equipment",
			"ko": "전기기기",
			"en": "Electrical Equipment",
			"subItems": [],
			"addedIn2026Revision": true
		},
		{
			"key": "non_ferrous_metals",
			"ko": "비철금속",
			"en": "Non-ferrous Metals",
			"subItems": [],
			"addedIn2026Revision": true
		},
		{
			"key": "agri_fishery_food",
			"ko": "농수산식품",
			"en": "Agri-Fishery-Food",
			"subItems": [],
			"addedIn2026Revision": true
		},
		{
			"key": "cosmetics",
			"ko": "화장품",
			"en": "Cosmetics",
			"subItems": [],
			"addedIn2026Revision": true
		},
		{
			"key": "household_goods",
			"ko": "생활용품",
			"en": "Household / Lifestyle Goods",
			"subItems": [],
			"addedIn2026Revision": true
		}
	]
};
var TIER_CONF = .5;
function today() {
	return kstYmd();
}
function loadSeedExposures() {
	const links = exposureSeed_config_default.links.map((l) => ({
		ticker: l.ticker,
		companyName: l.name,
		exportCategoryId: l.category,
		exportCategoryName: l.category,
		valueChainRole: l.role,
		exposureWeight: seedWeight(l.tier),
		mappingConfidence: TIER_CONF,
		mappingType: l.tier === "PRIMARY" ? "PRIMARY" : "SECONDARY",
		verificationStatus: "UNVERIFIED_SEED",
		evidenceSummary: "Publicly-known line of business (seed). Not a revenue split.",
		evidenceSource: [],
		effectiveFrom: "2022-01-01",
		lastReviewedAt: today(),
		active: true
	}));
	const excluded = exposureSeed_config_default.excludedByDefault.map((e) => ({
		ticker: e.ticker,
		companyName: e.name,
		exportCategoryId: "holding",
		exportCategoryName: "holding",
		valueChainRole: "DOWNSTREAM",
		exposureWeight: 0,
		mappingConfidence: 0,
		mappingType: "MULTI_SEGMENT",
		verificationStatus: "UNVERIFIED_SEED",
		evidenceSummary: e.reason,
		evidenceSource: [],
		effectiveFrom: "2022-01-01",
		lastReviewedAt: today(),
		active: false,
		inactiveReason: e.reason
	}));
	const all = [...links, ...excluded];
	const check = validateWeightConservation(all);
	if (!check.ok) throw new Error(check.error ?? "export-desk seed weights exceed 1.00");
	return all;
}
var defaultSettings = {
	minWeight: .2,
	minConfidence: .7,
	universeN: 100,
	primaryOnly: false,
	chartMode: "indexed",
	levelSeries: "roll12",
	currency: "USD",
	alignment: "OBSERVATION",
	range: "5Y"
};
var useExportDeskStore = create()(persist((set, get) => ({
	demoMode: false,
	lang: "ko",
	settings: defaultSettings,
	observations: [],
	indexImported: [],
	exposures: loadSeedExposures(),
	snapshots: [],
	logs: [],
	sourceKeys: {},
	setDemoMode: (v) => set({ demoMode: v }),
	setLang: (v) => set({ lang: v }),
	patchSettings: (p) => set({ settings: {
		...get().settings,
		...p
	} }),
	upsertObservations: (rows, log) => {
		set({
			observations: [...get().observations.filter((o) => !rows.some((r) => r.period === o.period && r.categoryId === o.categoryId && (r.geo ?? "") === (o.geo ?? "") && (r.vintage ?? "") === (o.vintage ?? ""))), ...rows],
			logs: [log, ...get().logs].slice(0, 80)
		});
	},
	upsertIndex: (rows, log) => {
		const map = new Map(get().indexImported.map((r) => [r.date, r]));
		for (const r of rows) map.set(r.date, r);
		set({
			indexImported: [...map.values()].sort((a, b) => a.date.localeCompare(b.date)),
			logs: [log, ...get().logs].slice(0, 80)
		});
	},
	upsertExposure: (row) => {
		const next = get().exposures.filter((e) => !(e.ticker === row.ticker && e.exportCategoryId === row.exportCategoryId)).concat(row);
		const v = validateWeightConservation(next);
		if (!v.ok) return {
			ok: false,
			error: v.error
		};
		set({ exposures: next });
		return { ok: true };
	},
	removeExposure: (ticker, category) => set({ exposures: get().exposures.filter((e) => !(e.ticker === ticker && e.exportCategoryId === category)) }),
	setSourceKey: (id, key) => set({ sourceKeys: {
		...get().sourceKeys,
		[id]: key
	} }),
	exportStoreJson: () => JSON.stringify({
		observations: get().observations,
		indexImported: get().indexImported,
		exposures: get().exposures,
		snapshots: get().snapshots,
		logs: get().logs,
		settings: get().settings,
		demoMode: get().demoMode
	}, null, 2),
	importStoreJson: (raw) => {
		try {
			const j = JSON.parse(raw);
			set({
				observations: j.observations ?? get().observations,
				indexImported: j.indexImported ?? get().indexImported,
				exposures: j.exposures ?? get().exposures,
				snapshots: j.snapshots ?? get().snapshots,
				logs: j.logs ?? get().logs
			});
			return { ok: true };
		} catch (e) {
			return {
				ok: false,
				error: String(e)
			};
		}
	},
	resetStore: () => set({
		observations: [],
		indexImported: [],
		exposures: loadSeedExposures(),
		snapshots: [],
		logs: [],
		demoMode: false,
		settings: defaultSettings
	})
}), { name: "kx-export-desk-v2" }));
function getCore20() {
	return core20_config_default;
}
function getDemoExportSeries(demoMode) {
	if (!demoMode) return [];
	const start = /* @__PURE__ */ new Date("2018-01-01");
	const items = core20_config_default.items;
	const rows = [];
	for (let i = 0; i < 96; i++) {
		const d = new Date(start);
		d.setMonth(d.getMonth() + i);
		const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
		const seasonal = 1 + .08 * Math.sin(2 * Math.PI * (d.getMonth() + 1) / 12);
		const trend = 48e9 + i * 21e7;
		rows.push({
			period,
			categoryId: "TOTAL",
			categoryName: "TOTAL (DEMO)",
			valueUsd: trend * seasonal,
			classification: "TOTAL",
			sourceFile: "DEMO",
			vintage: "DEMO"
		});
		items.forEach((it, idx) => {
			const share = .18 / (1 + idx * .12);
			const cycle = 1 + .12 * Math.sin(2 * Math.PI * (i + idx * 3) / 18);
			rows.push({
				period,
				categoryId: it.key,
				categoryName: `${it.ko} (DEMO)`,
				valueUsd: trend * share * cycle * seasonal,
				classification: "MTI",
				sourceFile: "DEMO",
				vintage: "DEMO"
			});
		});
	}
	return rows;
}
function normalizeToBase100(values) {
	const base = values.find((v) => v > 0);
	if (base == null) return values.map(() => NaN);
	return values.map((v) => v / base * 100);
}
function resampleDailyToMonthEnd(rows) {
	const by = {};
	for (const r of rows) {
		const p = r.date.slice(0, 7);
		if (!by[p] || r.date > by[p].date) by[p] = r;
	}
	return Object.keys(by).sort().map((period) => ({
		period,
		value: by[period].value
	}));
}
function calculateYoYGrowth(values, periods = 12) {
	return values.map((v, i) => {
		const prev = values[i - periods];
		if (prev == null || prev === 0 || !Number.isFinite(v)) return NaN;
		return (v / prev - 1) * 100;
	});
}
function calculateRolling12MSum(values, window = 12) {
	return values.map((_, i) => {
		if (i < window - 1) return NaN;
		let s = 0;
		for (let j = i - window + 1; j <= i; j++) {
			const v = values[j];
			if (!Number.isFinite(v)) return NaN;
			s += v;
		}
		return s;
	});
}
function calculateWorkingDayAdjusted(value, workingDays) {
	if (!(workingDays > 0) || !Number.isFinite(value)) return null;
	return value / workingDays;
}
function calculateMomentum(values, lookback = 3) {
	return values.map((v, i) => {
		const prev = values[i - lookback];
		if (prev == null || prev === 0) return NaN;
		const ratio = v / prev;
		if (!(ratio > 0)) return NaN;
		return (Math.pow(ratio, 12 / lookback) - 1) * 100;
	});
}
function paired(x, y) {
	const n = Math.min(x.length, y.length);
	const out = [];
	for (let i = 0; i < n; i++) if (Number.isFinite(x[i]) && Number.isFinite(y[i])) out.push([x[i], y[i]]);
	return out;
}
function calculatePearson(x, y) {
	const p = paired(x, y);
	if (p.length < 3) return null;
	const n = p.length;
	const mx = p.reduce((s, v) => s + v[0], 0) / n;
	const my = p.reduce((s, v) => s + v[1], 0) / n;
	let num = 0;
	let dx = 0;
	let dy = 0;
	for (const [a, b] of p) {
		num += (a - mx) * (b - my);
		dx += (a - mx) ** 2;
		dy += (b - my) ** 2;
	}
	const den = Math.sqrt(dx * dy);
	if (den === 0) return null;
	return num / den;
}
function calculatePartialCorrelation(x, y, z) {
	const rxy = calculatePearson(x, y);
	const rxz = calculatePearson(x, z);
	const ryz = calculatePearson(y, z);
	if (rxy == null || rxz == null || ryz == null) return null;
	const den = Math.sqrt((1 - rxz * rxz) * (1 - ryz * ryz));
	if (den === 0) return null;
	return (rxy - rxz * ryz) / den;
}
function calculateCrossCorrelation(x, y, maxLag = 6) {
	const out = [];
	for (let lag = -maxLag; lag <= maxLag; lag++) if (lag < 0) out.push({
		lag,
		corr: calculatePearson(x.slice(-lag), y.slice(0, y.length + lag))
	});
	else if (lag > 0) out.push({
		lag,
		corr: calculatePearson(x.slice(0, x.length - lag), y.slice(lag))
	});
	else out.push({
		lag,
		corr: calculatePearson(x, y)
	});
	return out;
}
/** Newey–West HAC variance for mean of series (Bartlett kernel). */
function neweyWestStandardError(series, lags = 3) {
	const x = series.filter(Number.isFinite);
	const n = x.length;
	if (n < lags + 3) return null;
	const mean = x.reduce((a, b) => a + b, 0) / n;
	const u = x.map((v) => v - mean);
	let gamma0 = 0;
	for (const v of u) gamma0 += v * v;
	gamma0 /= n;
	let hac = gamma0;
	for (let j = 1; j <= lags; j++) {
		let g = 0;
		for (let t = j; t < n; t++) g += u[t] * u[t - j];
		g /= n;
		const w = 1 - j / (lags + 1);
		hac += 2 * w * g;
	}
	if (hac < 0) return null;
	return Math.sqrt(hac / n);
}
/** ADF-lite: reject non-stationarity if |Δ series| mean is large vs level (heuristic + variance ratio). */
function testStationarity(values) {
	const x = values.filter(Number.isFinite);
	if (x.length < 24) return {
		stationary: false,
		method: "insufficient",
		note: "N < 24"
	};
	const d = [];
	for (let i = 1; i < x.length; i++) d.push(x[i] - x[i - 1]);
	const varLevel = variance(x);
	const varDiff = variance(d);
	const stationary = (varLevel === 0 ? 0 : varDiff / varLevel) > .15;
	return {
		stationary,
		method: "variance-ratio-diff",
		note: stationary ? "Differenced series dominates — treat as I(0) after transform" : "Level looks I(1) — use YoY / log-return, not raw level"
	};
}
function variance(x) {
	if (x.length < 2) return 0;
	const m = x.reduce((a, b) => a + b, 0) / x.length;
	return x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1);
}
function convertUsdKrw(usd, fx) {
	if (!(usd >= 0) || !(fx > 0)) return null;
	return usd * fx;
}
/** Pick the FX rate valid for a YYYY-MM period. Never reuse today's spot for history. */
function fxRateForPeriod(period, series, spot) {
	const ym = period.slice(0, 7);
	if (!ym) return null;
	const sorted = [...series].filter((r) => r.value > 0 && r.date).sort((a, b) => a.date.localeCompare(b.date));
	if (!sorted.length) return spot && spot > 0 ? spot : null;
	const exact = sorted.find((r) => r.date.slice(0, 7) === ym);
	if (exact) return exact.value;
	const prior = sorted.filter((r) => r.date.slice(0, 7) <= ym).at(-1);
	if (prior) return prior.value;
	return null;
}
function alignByReleaseDate(rows, mode) {
	if (mode === "OBSERVATION") return [...rows].sort((a, b) => a.period.localeCompare(b.period));
	return [...rows].sort((a, b) => (a.releasedAt ?? a.period).localeCompare(b.releasedAt ?? b.period));
}
function pearsonWithInference(x, y, opts) {
	if ((opts?.transform ?? "yoy") === "level") {
		if (!testStationarity(x).stationary) return {
			r: null,
			n: 0,
			se: null,
			usedHac: false,
			insufficient: true
		};
	}
	const r = calculatePearson(x, y);
	const n = paired(x, y).length;
	if (n < 24) return {
		r: null,
		n,
		se: null,
		usedHac: false,
		insufficient: true
	};
	return {
		r,
		n,
		se: neweyWestStandardError(paired(x, y).map(([a, b]) => a * b), 3),
		usedHac: true,
		insufficient: false
	};
}
var DEFAULT_EXCLUSIONS = {
	PREFERRED: true,
	ETF: true,
	ETN: true,
	REIT: true,
	SPAC: true,
	NON_OPERATING: true
};
function applyExclusionRules(row, rules) {
	if (rules.PREFERRED && row.isPreferred) return false;
	if (rules.ETF && row.isEtf) return false;
	if (rules.ETN && row.isEtn) return false;
	if (rules.REIT && row.isReit) return false;
	if (rules.SPAC && row.isSpac) return false;
	if (rules.NON_OPERATING && row.isNonOperating) return false;
	return true;
}
/** Rank KOSPI common issuers by market cap on a single date. */
function rankKospiByMarketCap(rows, opts) {
	const n = opts?.n ?? 100;
	const rules = opts?.rules ?? DEFAULT_EXCLUSIONS;
	const date = opts?.date;
	const filtered = rows.filter((r) => {
		if (date && r.date !== date) return false;
		return applyExclusionRules(r, rules);
	});
	const byIssuer = /* @__PURE__ */ new Map();
	for (const r of filtered) {
		const key = r.commonTicker ?? r.ticker;
		const prev = byIssuer.get(key);
		if (!prev || r.marketCap > prev.marketCap) byIssuer.set(key, {
			...r,
			ticker: key
		});
	}
	return [...byIssuer.values()].sort((a, b) => b.marketCap - a.marketCap).slice(0, n).map((r, i) => ({
		rank: i + 1,
		ticker: r.ticker,
		name: r.name,
		marketCap: r.marketCap,
		asOf: r.date
	}));
}
function resolveRegionalCapability(geo, classification, cfg) {
	const forbidden = (cfg?.forbiddenCombos ?? []).find((f) => f.geo === geo && f.classification === classification);
	if (forbidden) return {
		available: false,
		reason: forbidden.reason
	};
	const level = (cfg?.levels ?? []).find((l) => l.id === geo);
	if (level && level.available === false) return {
		available: false,
		reason: level.reason
	};
	if (!cfg && geo === "SIGUNGU" && classification === "HSK10") return {
		available: false,
		reason: "시군구 × HSK-10 공식 시계열이 없습니다. 숫자를 합성하지 않습니다."
	};
	return { available: true };
}
var PERIOD_RE = [/^(20\d{2})[-./]?(0?[1-9]|1[0-2])$/, /^(20\d{2})년\s*(0?[1-9]|1[0-2])월$/];
function parsePeriod(raw) {
	const s = String(raw ?? "").trim();
	if (/^\d{4}-\d{2}$/.test(s)) return s;
	if (/^\d{6}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}`;
	const m1 = s.match(/^(20\d{2})[-./](0?[1-9]|1[0-2])$/);
	if (m1) return `${m1[1]}-${String(m1[2]).padStart(2, "0")}`;
	const m2 = s.match(/^(20\d{2})년\s*(0?[1-9]|1[0-2])월$/);
	if (m2) return `${m2[1]}-${String(m2[2]).padStart(2, "0")}`;
	for (const re of PERIOD_RE) {
		const m = s.match(re);
		if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}`;
	}
	return null;
}
function parseKoreanNumber(raw, unitHint) {
	if (raw == null) return null;
	let s = String(raw).trim();
	if (!s || s === "-" || s === "N/A" || s === "na") return null;
	s = s.replace(/,/g, "").replace(/\s/g, "");
	const n = Number(s.replace(/[^\d.+-]/g, ""));
	if (!Number.isFinite(n)) return null;
	const u = (unitHint ?? "").toLowerCase();
	if (/천달러|thousand/.test(u)) return n * 1e3;
	if (/백만불|million|백만달러/.test(u)) return n * 1e6;
	if (/억달러|억불/.test(u)) return n * 1e8;
	return n;
}
var HEADER_ALIASES = {
	period: [
		"기간",
		"년월",
		"period",
		"date",
		"yyyymm",
		"월",
		"기준년월"
	],
	value: [
		"수출액",
		"수출",
		"export",
		"value",
		"금액",
		"usd",
		"수출금액"
	],
	category: [
		"품목",
		"품목명",
		"item",
		"category",
		"mti",
		"hs",
		"코드명"
	],
	code: [
		"코드",
		"code",
		"mti코드",
		"hs코드",
		"품목코드"
	],
	geo: [
		"지역",
		"시도",
		"국가",
		"region",
		"sido",
		"country"
	],
	workingDays: [
		"가동일",
		"조업일수",
		"workingdays",
		"일수"
	]
};
function normHeader(h) {
	return h.replace(/\s+/g, "").toLowerCase();
}
function detectColumns(headers) {
	const map = {};
	headers.forEach((h, i) => {
		const n = normHeader(h);
		for (const [field, aliases] of Object.entries(HEADER_ALIASES)) if (aliases.some((a) => n.includes(normHeader(a))) && map[field] == null) map[field] = i;
	});
	return map;
}
function parseCsv(text) {
	return text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length).map((line) => {
		const cells = [];
		let cur = "";
		let q = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (ch === "\"") {
				q = !q;
				continue;
			}
			if (ch === "," && !q) {
				cells.push(cur.trim());
				cur = "";
				continue;
			}
			cur += ch;
		}
		cells.push(cur.trim());
		return cells;
	});
}
function importTradeCsv(text, filename, importer) {
	const table = parseCsv(text);
	const issues = [];
	if (table.length < 2) return {
		ok: false,
		importer,
		rows: [],
		issues: [{
			row: 0,
			message: "헤더+데이터 행이 필요합니다."
		}],
		filename,
		importedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	const headers = table[0];
	const cols = detectColumns(headers);
	if (cols.period == null || cols.value == null) return {
		ok: false,
		importer,
		rows: [],
		issues: [{
			row: 0,
			message: `필수 열 없음 (기간/수출액). 감지된 헤더: ${headers.join(", ")}`
		}],
		filename,
		importedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	const unitHint = headers.join(" ");
	const classification = importer === "HS_MONTHLY_EXPORT" ? "HS" : importer === "MTI_MONTHLY_EXPORT" ? "MTI" : "TOTAL";
	const rows = [];
	for (let i = 1; i < table.length; i++) {
		const rec = table[i];
		const period = parsePeriod(rec[cols.period] ?? "");
		const valueUsd = parseKoreanNumber(rec[cols.value] ?? "", unitHint);
		if (!period) {
			issues.push({
				row: i + 1,
				message: `기간 파싱 실패: ${rec[cols.period]}`
			});
			continue;
		}
		if (valueUsd == null) {
			issues.push({
				row: i + 1,
				message: `금액 파싱 실패: ${rec[cols.value]}`
			});
			continue;
		}
		if (valueUsd < 0) {
			issues.push({
				row: i + 1,
				message: "음수 수출액은 거부합니다."
			});
			continue;
		}
		const categoryId = (cols.code != null ? rec[cols.code] : void 0) || (cols.category != null ? rec[cols.category] : void 0) || "TOTAL";
		rows.push({
			period,
			categoryId: String(categoryId),
			categoryName: cols.category != null ? rec[cols.category] : categoryId,
			valueUsd,
			classification,
			geo: cols.geo != null ? rec[cols.geo] : void 0,
			workingDays: cols.workingDays != null ? Number(String(rec[cols.workingDays]).replace(/[^\d.]/g, "")) || void 0 : void 0,
			vintage: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
			sourceFile: filename
		});
	}
	if (rows.length === 0) return {
		ok: false,
		importer,
		rows: [],
		issues: issues.length ? issues : [{
			row: 0,
			message: "유효 행이 없습니다."
		}],
		filename,
		importedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	return {
		ok: true,
		importer,
		rows,
		issues,
		filename,
		importedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
var getExportMacro = createServerFn({ method: "GET" }).handler(createSsrRpc("802cd5e425d9403328a1ed61e59ab15c981ad90ac5f900cb4fd2f1c9312299e9"));
var getKospiCapQuotes = createServerFn({ method: "GET" }).handler(createSsrRpc("17f63d91d396ca6ee11ba0a10df4a4f009fc0642e7b8cb95c41fffb596bcb555"));
var getIndustryMonthlyPrices = createServerFn({ method: "GET" }).validator(object({ tickers: array(string().min(4).max(8)).max(12) })).handler(createSsrRpc("8c045cd3627c9fc5450292feee0cc4b9e0e260d881148e395524e48ff487291d"));
function useExportMacro() {
	return useQuery({
		queryKey: ["export-macro"],
		queryFn: () => getExportMacro(),
		staleTime: 18e5
	});
}
function useKospiCapQuotes() {
	return useQuery({
		queryKey: ["export-kospi-caps"],
		queryFn: () => getKospiCapQuotes(),
		staleTime: 6e4
	});
}
function useIndustryMonthlyPrices(tickers) {
	const key = [...tickers].sort().join(",");
	return useQuery({
		queryKey: ["export-industry-px", key],
		queryFn: () => getIndustryMonthlyPrices({ data: { tickers } }),
		staleTime: 18e5,
		enabled: tickers.length > 0
	});
}
var getLiveTradeBundle = createServerFn({ method: "GET" }).handler(createSsrRpc("d489b0d52357f9a21a93e40ac58eb85f3ba93f98f375bba794822788e13718c6"));
function useLiveTrade() {
	return useQuery({
		queryKey: ["export-live-trade"],
		queryFn: () => getLiveTradeBundle(),
		staleTime: 18e5,
		retry: 1,
		retryDelay: 1500,
		refetchOnWindowFocus: false
	});
}
function toDay(period) {
	if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period;
	if (/^\d{4}-\d{2}$/.test(period)) return `${period}-01`;
	return period.slice(0, 10);
}
function marksFor(stats, times, formatValue, up, down) {
	if (!stats || !times.length) return {
		marks: [],
		lastTime: null,
		lastPrice: null
	};
	return {
		marks: planRangeMarkers(stats).flatMap((p) => {
			const time = times[p.idx];
			if (!time) return [];
			const copy = rangeMarkerText(p, formatValue(p.price), formatChartPercent(p.pct));
			return [{
				time,
				price: p.price,
				role: p.role,
				place: copy.place,
				title: copy.title,
				pctText: copy.pctText,
				color: p.role === "high" ? down : up
			}];
		}),
		lastTime: times[times.length - 1] ?? null,
		lastPrice: stats.close
	};
}
/** Export × KOSPI dual-axis chart. Export amount series never get a volume profile. */
function ExportDualChart({ data, aName, bName, aColor = "#d4a017", bColor = "#3b82f6", source = "FRED/OECD · Yahoo", asOf = null, mode = "월간" }) {
	const elRef = (0, import_react.useRef)(null);
	const aPrim = (0, import_react.useRef)(new RangeMarkerPrimitive());
	const bPrim = (0, import_react.useRef)(new RangeMarkerPrimitive());
	const [chart, setChart] = (0, import_react.useState)(null);
	const [series, setSeries] = (0, import_react.useState)({
		a: null,
		b: null
	});
	const convention = useAppStore((s) => s.colorConvention);
	const up = convention === "korea" ? "#ef4444" : "#22c55e";
	const down = convention === "korea" ? "#3b82f6" : "#ef4444";
	const rows = (0, import_react.useMemo)(() => data.map((d) => ({
		...d,
		time: toDay(d.time)
	})), [data]);
	const hasData = data.some((d) => d.a != null || d.b != null);
	const aPoints = (0, import_react.useMemo)(() => rows.filter((d) => d.a != null && Number.isFinite(d.a)), [rows]);
	const bPoints = (0, import_react.useMemo)(() => rows.filter((d) => d.b != null && Number.isFinite(d.b)), [rows]);
	const fmt = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
	const aStats = (0, import_react.useMemo)(() => computeSeriesRangePosition(aPoints.map((d) => ({
		value: d.a,
		date: d.time
	})), void 0, { recentSpan: "52W" }), [aPoints]);
	const bStats = (0, import_react.useMemo)(() => computeSeriesRangePosition(bPoints.map((d) => ({
		value: d.b,
		date: d.time
	})), void 0, { recentSpan: "52W" }), [bPoints]);
	(0, import_react.useEffect)(() => {
		const el = elRef.current;
		if (!el || !hasData) return;
		const c = createProChart(el, readChartTheme(), "US");
		c.applyOptions({
			localization: {
				locale: "ko-KR",
				priceFormatter: (v) => v.toLocaleString("en-US", { maximumFractionDigits: 2 })
			},
			leftPriceScale: {
				visible: true,
				borderColor: "rgba(148,163,184,0.2)"
			},
			timeScale: {
				timeVisible: false,
				rightOffset: 2
			}
		});
		const a = c.addSeries(ye, {
			color: aColor,
			lineWidth: 2,
			title: aName,
			priceLineVisible: false,
			priceScaleId: "left"
		});
		const b = c.addSeries(ye, {
			color: bColor,
			lineWidth: 2,
			title: bName,
			priceLineVisible: false,
			priceScaleId: "right"
		});
		a.setData(aPoints.map((d) => ({
			time: d.time,
			value: d.a
		})));
		b.setData(bPoints.map((d) => ({
			time: d.time,
			value: d.b
		})));
		a.attachPrimitive(aPrim.current);
		b.attachPrimitive(bPrim.current);
		c.timeScale().fitContent();
		setChart(c);
		setSeries({
			a,
			b
		});
		return () => {
			setChart(null);
			setSeries({
				a: null,
				b: null
			});
			c.remove();
		};
	}, [
		aPoints,
		bPoints,
		aName,
		bName,
		aColor,
		bColor,
		hasData
	]);
	(0, import_react.useEffect)(() => {
		const a = marksFor(aStats, aPoints.map((d) => d.time), fmt, up, down);
		const b = marksFor(bStats, bPoints.map((d) => d.time), fmt, up, down);
		aPrim.current.set(a.marks, a.lastTime, a.lastPrice);
		bPrim.current.set(b.marks, b.lastTime, b.lastPrice);
	}, [
		aStats,
		bStats,
		aPoints,
		bPoints,
		up,
		down,
		series.a,
		series.b
	]);
	const { legend, hud } = useChartChrome(chart, [{
		id: "a",
		label: `${aName} (좌)`,
		color: aColor,
		api: series.a
	}, {
		id: "b",
		label: `${bName} (우)`,
		color: bColor,
		api: series.b
	}]);
	if (!hasData) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-[380px] items-center justify-center text-sm text-muted-foreground",
		children: "그릴 관측값이 없습니다."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RangePositionStrip, {
			stats: aStats,
			compact: true,
			caption: `${aName} · 최근 12개월(52W) · 수출 시계열에는 매물대 없음`,
			formatValue: fmt
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RangePositionStrip, {
			stats: bStats,
			compact: true,
			caption: `${bName} · 최근 12개월(52W) · 지수 라인에는 거래량 매물대 없음`,
			formatValue: fmt
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartShell, {
			title: `${aName} × ${bName}`,
			toolbar: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RangePresets, {
				chart,
				first: rows[0]?.time,
				last: rows.at(-1)?.time
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScaleToggle, {
				chart,
				allowed: [
					"normal",
					"log",
					"percent"
				],
				priceScaleIds: ["left", "right"]
			})] }),
			hud,
			legend,
			status: {
				source,
				mode,
				updatedAt: asOf,
				note: "고저 마커는 본체에 표시. 수출액 패널에는 매물대를 그리지 않습니다."
			},
			onExportPng: () => exportChartPng(chart, "KR", "EXPORT", "export-kospi"),
			onExportCsv: () => exportRowsCsv(chart, rows, [{
				name: aName,
				get: (r) => r.a
			}, {
				name: bName,
				get: (r) => r.b
			}], "KR", "EXPORT", "export-kospi"),
			height: 380,
			testId: "export-dual-chart",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: elRef,
				className: "absolute inset-0"
			})
		})
	] });
}
var LINE_COLORS = [
	"#d4a017",
	"#38bdf8",
	"#34d399",
	"#f472b6",
	"#a78bfa",
	"#fb7185"
];
/** Up to six official export series. No volume profile. Range markers on the focus series only. */
function ExportAmountChart({ series, focusId, source, asOf }) {
	const elRef = (0, import_react.useRef)(null);
	const focusPrim = (0, import_react.useRef)(new RangeMarkerPrimitive());
	const [chart, setChart] = (0, import_react.useState)(null);
	const [apis, setApis] = (0, import_react.useState)([]);
	const convention = useAppStore((s) => s.colorConvention);
	const up = convention === "korea" ? "#ef4444" : "#22c55e";
	const down = convention === "korea" ? "#3b82f6" : "#ef4444";
	const shown = series.slice(0, 6);
	const key = shown.map((s) => `${s.id}:${s.points.length}:${s.points.at(-1)?.time ?? ""}`).join("|");
	const focus = shown.find((s) => s.id === focusId) ?? shown[0];
	const focusStats = (0, import_react.useMemo)(() => focus ? computeSeriesRangePosition(focus.points.map((p) => ({
		value: p.value,
		date: p.time
	})), void 0, { recentSpan: "52W" }) : null, [focus]);
	(0, import_react.useEffect)(() => {
		const el = elRef.current;
		if (!el || !shown.length) return;
		const c = createProChart(el, readChartTheme(), "US");
		c.applyOptions({
			localization: {
				locale: "ko-KR",
				priceFormatter: (v) => `$${v.toFixed(1)}bn`
			},
			timeScale: {
				timeVisible: false,
				rightOffset: 2
			}
		});
		const next = [];
		shown.forEach((s, i) => {
			const api = c.addSeries(ye, {
				color: LINE_COLORS[i % LINE_COLORS.length],
				lineWidth: s.id === focus?.id ? 2 : 1,
				title: s.name,
				priceLineVisible: false,
				lastValueVisible: s.id === focus?.id
			});
			api.setData(s.points.map((p) => ({
				time: toDay(p.time),
				value: p.value
			})));
			if (s.id === focus?.id) api.attachPrimitive(focusPrim.current);
			next.push(api);
		});
		c.timeScale().fitContent();
		setChart(c);
		setApis(next);
		return () => {
			setChart(null);
			setApis([]);
			c.remove();
		};
	}, [key, focusId]);
	(0, import_react.useEffect)(() => {
		if (!focus) return focusPrim.current.set([], null, null);
		const times = focus.points.map((p) => toDay(p.time));
		const packed = marksFor(focusStats, times, (n) => `$${n.toFixed(1)}bn`, up, down);
		focusPrim.current.set(packed.marks, packed.lastTime, packed.lastPrice);
	}, [
		focus,
		focusStats,
		up,
		down,
		apis
	]);
	const { legend, hud } = useChartChrome(chart, shown.map((s, i) => ({
		id: s.id,
		label: s.name,
		color: LINE_COLORS[i % LINE_COLORS.length],
		api: apis[i] ?? null
	})));
	if (!shown.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-[320px] items-center justify-center text-sm text-muted-foreground",
		children: "선택한 품목에 Comtrade 관측이 없습니다."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [focusStats && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RangePositionStrip, {
		stats: focusStats,
		compact: true,
		caption: `${focus?.name ?? ""} · 최근 12개월 · 수출액 차트에는 매물대 없음`,
		formatValue: (n) => `$${n.toFixed(1)}bn`
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartShell, {
		title: "주력 품목 수출 (HS 근사, 십억달러)",
		toolbar: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RangePresets, {
			chart,
			first: shown[0]?.points[0] ? toDay(shown[0].points[0].time) : void 0,
			last: focus?.points.at(-1) ? toDay(focus.points.at(-1).time) : void 0
		}),
		hud,
		legend,
		status: {
			source,
			mode: "월간 · 확정 HS",
			updatedAt: asOf,
			note: "MOTIE MTI 금액이 아닙니다. 없는 월은 비워 둡니다."
		},
		onExportPng: () => exportChartPng(chart, "KR", "EXPORT", "core-items"),
		height: 340,
		testId: "export-amount-chart",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: elRef,
			className: "absolute inset-0"
		})
	})] });
}
/**
* Uniform chrome for non-lightweight charts (F7.17 Tier C): title, units,
* source / as-of line, accessible label, PNG (SVG rasterized) + CSV export.
*/
function ChartFrame({ title, unit, source, asOf, ariaLabel, csv, pngName, children, testId }) {
	const ref = (0, import_react.useRef)(null);
	const exportPng = () => {
		const svg = ref.current?.querySelector("svg");
		if (svg && pngName) downloadSvgAsPng(svg, pngName);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
		className: "min-w-0 rounded-lg border border-border",
		"data-testid": testId,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figcaption", {
				className: "flex flex-wrap items-center justify-between gap-2 border-b border-border px-2.5 py-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-[12px] font-semibold",
					children: [title, unit && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ml-1 font-normal text-muted-foreground",
						children: [
							"(",
							unit,
							")"
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex items-center gap-0.5",
					children: [pngName && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: exportPng,
						className: "inline-flex size-9 items-center justify-center rounded-md hover:bg-muted",
						"aria-label": "PNG로 저장",
						title: "PNG로 저장",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" })
					}), csv && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							const c = csv();
							downloadCsv(c.text, c.filename);
						},
						className: "inline-flex size-9 items-center justify-center rounded-md hover:bg-muted",
						"aria-label": "CSV로 저장",
						title: "CSV로 저장",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileSpreadsheet, { className: "size-3.5" })
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref,
				role: "img",
				"aria-label": ariaLabel,
				children
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "border-t border-border px-2.5 py-1 text-[10px] text-muted-foreground",
				children: [
					"출처 ",
					source,
					asOf ? ` · 기준 ${asOf}` : ""
				]
			})
		]
	});
}
var TABS = [
	{
		id: "total",
		key: "export.total.title"
	},
	{
		id: "core20",
		key: "export.core20.title"
	},
	{
		id: "all",
		key: "export.all.title"
	},
	{
		id: "industry",
		key: "export.industry100.title"
	},
	{
		id: "corr",
		key: "export.corr.title"
	},
	{
		id: "region",
		key: "export.region.title"
	},
	{
		id: "qa",
		key: "export.qa.title"
	},
	{
		id: "admin",
		key: "export.admin.title"
	},
	{
		id: "import",
		key: "export.import.title"
	}
];
function Provenance({ source, period, ingested, taxonomy }) {
	const lang = useExportDeskStore((s) => s.lang);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
				variant: "outline",
				className: "text-[10px]",
				children: [
					t("export.provenance", lang),
					" · ",
					source
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["기간 ", period || "N/A"] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["수집 ", ingested || "N/A"] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
				t("export.taxonomy.badge", lang),
				" ",
				taxonomy
			] })
		]
	});
}
function ExportDesk() {
	const lang = useExportDeskStore((s) => s.lang);
	const setLang = useExportDeskStore((s) => s.setLang);
	const demo = useExportDeskStore((s) => s.demoMode);
	const settings = useExportDeskStore((s) => s.settings);
	const patch = useExportDeskStore((s) => s.patchSettings);
	const [tab, setTab] = (0, import_react.useState)("total");
	const [selectedCat, setSelectedCat] = (0, import_react.useState)("semiconductors");
	function openIndustry(cat) {
		setSelectedCat(cat);
		setTab("industry");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [
			demo && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "sticky top-0 z-20 rounded-md bg-desk-copper px-3 py-2 text-sm font-semibold text-black",
				children: t("export.demo.banner", lang)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "page-header",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "desk-kicker mb-1.5",
						children: "Trade statistics × listed equity"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "page-title flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ship, { className: "size-7 text-desk-gold" }), t("export.desk.title", lang)]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "page-lead",
						children: "총수출은 FRED/OECD 월별 공식 시계열, 품목은 UN Comtrade HS, 시세는 거래소 스냅샷입니다. 데모 숫자가 기본값이 아닙니다."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveTape, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap items-center gap-3 text-xs",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "inline-flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: lang === "en",
									onCheckedChange: (v) => setLang(v ? "en" : "ko")
								}), "EN"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								className: "h-8 rounded-md border border-border bg-background px-2",
								value: settings.range,
								onChange: (e) => patch({ range: e.target.value }),
								children: [
									"1Y",
									"3Y",
									"5Y",
									"10Y",
									"MAX"
								].map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: r }, r))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								className: "h-8 rounded-md border border-border bg-background px-2",
								value: settings.chartMode,
								onChange: (e) => patch({ chartMode: e.target.value }),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "indexed",
										children: "Indexed=100"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "absolute",
										children: "Absolute"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "growth",
										children: "Growth"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "krw",
										children: "Export KRW"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								className: "h-8 rounded-md border border-border bg-background px-2",
								value: settings.levelSeries,
								onChange: (e) => patch({ levelSeries: e.target.value }),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "roll12",
										children: "12M 누적 (기본)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "wad",
										children: "일평균"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "raw",
										children: "원시계열 (계절성)"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								className: "h-8 rounded-md border border-border bg-background px-2",
								value: settings.universeN,
								onChange: (e) => patch({ universeN: Number(e.target.value) }),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: 100,
									children: "Top 100"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: 200,
									children: "Top 200"
								})]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
				value: tab,
				onValueChange: setTab,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsList, {
						className: "h-auto flex-wrap justify-start",
						children: TABS.map((tb) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
							value: tb.id,
							className: "text-[11px]",
							children: t(tb.key, lang)
						}, tb.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "total",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TotalPanel, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "core20",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Core20Panel, { onOpen: openIndustry })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "all",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AllIndustriesPanel, { onOpen: openIndustry })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "industry",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IndustryPanel, {
							cat: selectedCat,
							onCat: setSelectedCat
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "corr",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CorrPanel, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "region",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RegionPanel, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "qa",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QaPanel, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "admin",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminPanel, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "import",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportPanel, {})
					})
				]
			})
		]
	});
}
function useAllObservations() {
	const imported = useExportDeskStore((s) => s.observations);
	const live = useLiveTrade();
	return (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const o of live.data?.observations ?? []) map.set(`${o.categoryId}|${o.period}`, o);
		for (const o of imported) map.set(`${o.categoryId}|${o.period}`, o);
		return [...map.values()];
	}, [imported, live.data]);
}
function useExportSeries(categoryId = "TOTAL") {
	const demo = useExportDeskStore((s) => s.demoMode);
	const alignment = useExportDeskStore((s) => s.settings.alignment);
	const all = useAllObservations();
	return (0, import_react.useMemo)(() => {
		const real = all.filter((o) => o.categoryId === categoryId);
		const demoRows = getDemoExportSeries(demo).filter((o) => o.categoryId === categoryId);
		const used = real.length ? real : demo ? demoRows : [];
		if (!demo) assertNoSyntheticLeak(used, false);
		return alignByReleaseDate([...used].sort((a, b) => a.period.localeCompare(b.period)), alignment);
	}, [
		all,
		demo,
		categoryId,
		alignment
	]);
}
function LiveTape() {
	const live = useLiveTrade();
	const exports = useExportSeries("TOTAL");
	const values = exports.map((e) => e.valueUsd);
	const yoy = calculateYoYGrowth(values);
	const last = exports.at(-1);
	const prev = exports.at(-2);
	const y = yoy.at(-1);
	const mom = last && prev && prev.valueUsd ? (last.valueUsd / prev.valueUsd - 1) * 100 : null;
	const roll = calculateRolling12MSum(values).at(-1);
	const imp = live.data?.imports ?? [];
	const matchedImp = last ? imp.find((i) => i.period === last.period) : void 0;
	const bal = last && matchedImp ? last.valueUsd - matchedImp.valueUsd : null;
	const macro = useExportMacro();
	const k = macro.data?.kospi.at(-1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
				label: "총수출 (FRED/OECD)",
				value: last ? formatUsdBn(last.valueUsd) : live.isLoading ? "수집 중" : "N/A",
				sub: last?.period ?? "—"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
				label: "YoY",
				value: y != null && Number.isFinite(y) ? `${y.toFixed(1)}%` : "N/A",
				tone: y != null && y >= 0 ? "up" : "down"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
				label: "MoM",
				value: mom != null && Number.isFinite(mom) ? `${mom.toFixed(1)}%` : "N/A",
				tone: mom != null && mom >= 0 ? "up" : "down"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
				label: "12M 누적",
				value: roll != null && Number.isFinite(roll) ? formatUsdBn(roll) : "N/A"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
				label: "무역수지",
				value: bal != null ? formatUsdBn(bal) : "N/A",
				sub: matchedImp ? `수입 ${formatUsdBn(matchedImp.valueUsd)}` : "수입 대기",
				tone: bal != null && bal >= 0 ? "up" : "down"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
				label: "KOSPI",
				value: k ? k.value.toFixed(0) : "N/A",
				sub: k ? `${k.date.slice(0, 7)} 월말` : macro.data?.source
			})
		]
	});
}
function clipRange(rows, range) {
	if (range === "MAX" || rows.length === 0) return rows;
	const years = range === "1Y" ? 1 : range === "3Y" ? 3 : range === "10Y" ? 10 : 5;
	const [yy, mm] = kstYmd().slice(0, 7).split("-");
	const key = `${Number(yy) - years}-${mm}`;
	return rows.filter((r) => (r.period ?? r.date ?? "") >= key);
}
function addMonths(period, delta) {
	if (!period || !/^\d{4}-\d{2}$/.test(period)) return void 0;
	const [y, m] = period.split("-").map(Number);
	const d = new Date(Date.UTC(y, (m ?? 1) - 1 + delta, 1));
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function numOrNull(v) {
	return v != null && Number.isFinite(v) ? v : null;
}
function TotalPanel() {
	const lang = useExportDeskStore((s) => s.lang);
	const settings = useExportDeskStore((s) => s.settings);
	const demo = useExportDeskStore((s) => s.demoMode);
	const exports = useExportSeries("TOTAL");
	const macro = useExportMacro();
	const allObservations = useAllObservations();
	const kospiMonth = (0, import_react.useMemo)(() => resampleDailyToMonthEnd((macro.data?.kospi ?? []).map((p) => ({
		date: p.date,
		value: p.value
	}))), [macro.data?.kospi]);
	const chart = (0, import_react.useMemo)(() => {
		const values = exports.map((e) => e.valueUsd);
		const wad = exports.map((e) => calculateWorkingDayAdjusted(e.valueUsd, e.workingDays ?? 0) ?? NaN);
		const roll = calculateRolling12MSum(values);
		const yoy = calculateYoYGrowth(values);
		const mom = calculateMomentum(values, 3);
		const level = settings.levelSeries === "raw" ? values : settings.levelSeries === "wad" ? wad : roll;
		const byP = new Map(kospiMonth.map((k) => [k.period, k.value]));
		const clipped = clipRange(exports.map((e, i) => {
			const k = byP.get(e.period);
			return {
				period: e.period,
				exp: level[i],
				kospi: k ?? NaN,
				yoy: yoy[i],
				mom: mom[i]
			};
		}), settings.range).filter((r) => Number.isFinite(r.exp) || Number.isFinite(r.kospi));
		const expIdx = normalizeToBase100(clipped.map((r) => r.exp));
		const kIdx = normalizeToBase100(clipped.map((r) => r.kospi));
		const kYoy = calculateYoYGrowth(clipped.map((r) => r.kospi), 12);
		const fxSeries = macro.data?.fx ?? [];
		const spot = macro.data?.spotUsdKrw ?? 0;
		return clipped.map((r, i) => {
			const fx = fxRateForPeriod(r.period, fxSeries, spot);
			return {
				...r,
				exp: numOrNull(r.exp),
				kospi: numOrNull(r.kospi),
				yoy: numOrNull(r.yoy),
				mom: numOrNull(r.mom),
				expIdx: numOrNull(expIdx[i]),
				kIdx: numOrNull(kIdx[i]),
				kYoy: numOrNull(kYoy[i]),
				expKrw: numOrNull(fx != null ? convertUsdKrw(r.exp, fx) ?? NaN : NaN)
			};
		});
	}, [
		exports,
		kospiMonth,
		settings.levelSeries,
		settings.range,
		macro.data?.fx,
		macro.data?.spotUsdKrw
	]);
	const last = chart.filter((r) => r.exp != null).at(-1);
	const lastK = chart.filter((r) => r.kospi != null).at(-1);
	const totalSource = demo && !allObservations.some((o) => o.categoryId === "TOTAL" && o.sourceFile !== "DEMO") ? "DEMO" : last ? "FRED/OECD XTEXVA01KRM667S" : "대기";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "desk-card desk-card-navy p-4 space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-lg font-semibold",
				children: t("export.total.title", lang)
			}),
			settings.levelSeries === "raw" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-desk-copper",
				children: t("export.seasonal", lang)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-2 sm:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "수출 (선택 시계열)",
						value: last?.exp != null ? formatUsdBn(last.exp) : "N/A",
						sub: last?.period ?? "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "YoY",
						value: last?.yoy != null ? `${last.yoy.toFixed(1)}%` : "N/A"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "3M momentum",
						value: last?.mom != null ? `${last.mom.toFixed(1)}%` : "N/A"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "KOSPI",
						value: lastK?.kospi != null ? lastK.kospi.toFixed(0) : "N/A",
						sub: macro.data?.source ?? ""
					})
				]
			}),
			exports.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyExport, {}) : chart.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground",
				children: "시계열은 있으나 선택한 기간에 그릴 점이 없습니다. 기간을 MAX로 바꿔 보세요."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-3 text-[11px] text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "inline-flex items-center gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "inline-block size-2 rounded-full bg-desk-gold" }), " 수출"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "inline-flex items-center gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: "inline-block size-2 rounded-full",
								style: { background: "#3b82f6" }
							}), " KOSPI"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "드래그로 이동 · 휠로 확대" })
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportDualChart, {
					data: chart.map((r) => ({
						time: r.period,
						a: settings.chartMode === "absolute" ? r.exp : settings.chartMode === "growth" ? r.yoy : settings.chartMode === "krw" ? r.expKrw : r.expIdx,
						b: settings.chartMode === "krw" ? null : settings.chartMode === "growth" ? r.kYoy : settings.chartMode === "absolute" ? r.kospi : r.kIdx
					})),
					aName: settings.chartMode === "growth" ? "수출 YoY" : settings.chartMode === "krw" ? "수출 KRW" : settings.chartMode === "absolute" ? "수출 USD" : "수출=100",
					bName: settings.chartMode === "growth" ? "KOSPI YoY" : settings.chartMode === "absolute" ? "KOSPI" : "KOSPI=100",
					source: `수출 ${totalSource} · KOSPI ${macro.data?.source ?? "—"}`,
					asOf: macro.data?.fetchedAt ?? null,
					mode: settings.chartMode === "growth" ? "월간 · 전년 대비 %" : settings.chartMode === "absolute" ? "월간 · 수출 USD(좌) / KOSPI(우)" : settings.chartMode === "krw" ? "월간 · 원화 환산" : "월간 · 기준=100"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Provenance, {
				source: totalSource,
				period: `${chart[0]?.period ?? "—"} ~ ${chart.at(-1)?.period ?? "—"}`,
				ingested: macro.data?.fetchedAt ?? "—",
				taxonomy: getCore20().taxonomyVersion
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveNewsStrip, {})
		]
	});
}
function Kpi({ label, value, sub, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border bg-card/60 px-3 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[11px] text-muted-foreground",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("text-lg font-semibold tabular", tone === "up" && "text-price-up", tone === "down" && "text-price-down"),
				children: value
			}),
			sub && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[10px] text-muted-foreground truncate",
				children: sub
			})
		]
	});
}
function formatUsdBn(v) {
	if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}bn`;
	if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}m`;
	return `$${v.toLocaleString("en-US")}`;
}
function LiveNewsStrip() {
	const items = useLiveTrade().data?.news ?? [];
	if (!items.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[11px] font-semibold text-muted-foreground",
			children: "수출 헤드라인 (원문 링크 · 수치는 차트에 넣지 않음)"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-1",
			children: items.slice(0, 6).map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "text-xs leading-snug",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					href: n.url,
					target: "_blank",
					rel: "noreferrer",
					className: "hover:underline",
					children: n.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "ml-2 text-muted-foreground",
					children: [n.source, n.publishedAt ? ` · ${n.publishedAt.slice(0, 10)}` : ""]
				})]
			}, n.url))
		})]
	});
}
function EmptyExport() {
	const lang = useExportDeskStore((s) => s.lang);
	const live = useLiveTrade();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "mx-auto mb-2 size-5" }), live.isLoading ? "공식 수출 시계열을 수집하고 있습니다." : live.isError ? "공식 소스 연결에 실패했습니다. 잠시 후 새로고침하거나 CSV를 가져오세요." : t("export.empty.exports", lang)]
	});
}
function Core20Panel({ onOpen }) {
	const allItems = getCore20().items;
	const [rev, setRev] = (0, import_react.useState)("20");
	const [focus, setFocus] = (0, import_react.useState)("semiconductors");
	const [picked, setPicked] = (0, import_react.useState)([
		"semiconductors",
		"automobiles",
		"ships",
		"petroleum_products"
	]);
	const items = rev === "20" ? allItems : allItems.filter((it) => !it.addedIn2026Revision);
	const lang = useExportDeskStore((s) => s.lang);
	const all = useAllObservations();
	const exposures = useExportDeskStore((s) => s.exposures);
	const settings = useExportDeskStore((s) => s.settings);
	const live = useLiveTrade();
	const totals = all.filter((o) => o.categoryId === "TOTAL");
	const amountSeries = items.filter((it) => picked.includes(it.key)).map((it) => ({
		id: it.key,
		name: lang === "en" ? it.en : it.ko,
		points: all.filter((o) => o.categoryId === it.key && Number.isFinite(o.valueUsd) && o.valueUsd > 0).sort((a, b) => a.period.localeCompare(b.period)).map((o) => ({
			time: o.period,
			value: o.valueUsd / 1e9
		}))
	})).filter((s) => s.points.length >= 2);
	const focusId = amountSeries.some((s) => s.id === focus) ? focus : amountSeries[0]?.id ?? focus;
	function togglePick(key) {
		setPicked((cur) => {
			if (cur.includes(key)) return cur.filter((k) => k !== key);
			if (cur.length >= 6) return cur;
			return [...cur, key];
		});
		setFocus(key);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-1 flex flex-wrap items-center gap-1.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-300",
							children: "확정 · UN Comtrade HS"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-200",
							children: "MOTIE 속보 미연결"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-200",
							children: "관세청 API 키 없음"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded border border-border px-1.5 py-0.5",
							children: "MTI-2026 · 2026-06-01"
						})
					]
				}), "2026 MTI 개정으로 15대에서 20대로 늘었습니다. 구/신 토글은 품목 목록만 바꿉니다. 금액은 만들지 않습니다. 표시 금액은 HS 근사이며 MOTIE MTI 잠정치가 아닙니다. HS 85를 반도체로 대체하지 않습니다. 매핑이 없거나 관측이 없으면 N/A. 부분 품목 합을 총수출 100%로 늘려 맞추지 않습니다."]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: cn("h-8 rounded-md px-2 text-xs", rev === "20" ? "bg-desk-gold/20 text-desk-gold" : "bg-muted text-muted-foreground"),
						onClick: () => setRev("20"),
						children: "신 20대"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: cn("h-8 rounded-md px-2 text-xs", rev === "15" ? "bg-desk-gold/20 text-desk-gold" : "bg-muted text-muted-foreground"),
						onClick: () => setRev("15"),
						children: "구 15대"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "self-center text-[11px] text-muted-foreground",
						children: [
							"표시 ",
							items.length,
							" · Comtrade ",
							live.data?.comtradeLatestPeriod ?? "N/A",
							" · 캐시 ",
							live.data?.comtradeMonthsCached ?? 0,
							"개월"
						]
					})
				]
			}),
			amountSeries.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportAmountChart, {
				series: amountSeries,
				focusId,
				source: "UN Comtrade preview HS",
				asOf: live.data?.source.fetchedAt ?? null
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground",
				children: live.isLoading ? "HS 품목 시계열 수집 중" : "선택한 품목에 그릴 Comtrade 관측이 없습니다. 금액을 채우지 않습니다."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "최대 6개 오버레이. 카드를 누르면 산업 × 주가 비교로 이동합니다. 고저 마커는 포커스 품목(마지막에 고른 항목)에만 그립니다."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
				children: items.map((it) => {
					const series = all.filter((o) => o.categoryId === it.key).sort((a, b) => a.period.localeCompare(b.period));
					const last = series.at(-1);
					const prev = series.find((s) => s.period === addMonths(last?.period, -12));
					const yoy = last && prev && prev.valueUsd ? ((last.valueUsd / prev.valueUsd - 1) * 100).toFixed(1) : "N/A";
					const total = last ? totals.find((t) => t.period === last.period) : void 0;
					const share = last && total && total.valueUsd > 0 ? last.valueUsd / total.valueUsd * 100 : null;
					const mapped = exposures.filter((e) => e.exportCategoryId === it.key && e.active !== false);
					const verified = mapped.filter((e) => e.mappingConfidence >= settings.minConfidence);
					const proxy = proxyForKey(it.key);
					const on = picked.includes(it.key);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: cn("desk-card desk-card-teal p-3 text-left", on && "ring-1 ring-desk-gold/50"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => onOpen(it.key),
							className: "w-full text-left",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-sm font-semibold",
										children: lang === "en" ? it.en : it.ko
									}), it.addedIn2026Revision && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] text-desk-gold",
										children: "2026 신설"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1 text-lg tabular font-semibold",
									children: last ? formatUsdBn(last.valueUsd) : proxy ? "N/A" : "HS 없음"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[11px] text-muted-foreground",
									children: [
										"YoY ",
										yoy,
										share != null ? ` · FRED 총수출 대비 ${share.toFixed(1)}% (정의 상이)` : " · 비중 N/A"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 flex flex-wrap gap-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											variant: "outline",
											className: "text-[10px]",
											children: proxy ? "확정 HS" : "HS 없음"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											variant: "outline",
											className: "text-[10px]",
											children: proxy ? proxy.label : "N/A"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
											variant: "outline",
											className: "text-[10px]",
											children: [
												"매핑 ",
												verified.length,
												"/",
												mapped.length
											]
										})
									]
								}),
								it.subItems.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2 text-[11px] text-muted-foreground",
									children: it.subItems.join(" · ")
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "mt-2 text-[11px] text-desk-gold hover:underline",
							onClick: () => togglePick(it.key),
							children: on ? "오버레이에서 빼기" : picked.length >= 6 ? "오버레이 6개 가득 참" : "오버레이에 넣기"
						})]
					}, it.key);
				})
			})
		]
	});
}
function AllIndustriesPanel({ onOpen }) {
	const observations = useAllObservations();
	const [q, setQ] = (0, import_react.useState)("");
	const [onlyMapped, setOnlyMapped] = (0, import_react.useState)(false);
	const exposures = useExportDeskStore((s) => s.exposures);
	const core = getCore20().items;
	const cats = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const it of core) map.set(it.key, {
			id: it.key,
			name: it.ko,
			value: 0,
			period: ""
		});
		for (const o of observations) {
			const prev = map.get(o.categoryId);
			if (!prev || o.period >= prev.period) map.set(o.categoryId, {
				id: o.categoryId,
				name: o.categoryName ?? o.categoryId,
				value: o.valueUsd,
				period: o.period
			});
		}
		let rows = [...map.values()].filter((r) => r.value > 0 || core.some((c) => c.key === r.id));
		if (q.trim()) {
			const n = q.trim().toLowerCase();
			rows = rows.filter((r) => r.id.toLowerCase().includes(n) || r.name.toLowerCase().includes(n));
		}
		if (onlyMapped) {
			const ids = new Set(exposures.filter((e) => e.active !== false).map((e) => e.exportCategoryId));
			rows = rows.filter((r) => ids.has(r.id));
		}
		return rows.sort((a, b) => b.value - a.value);
	}, [
		observations,
		q,
		onlyMapped,
		exposures,
		core
	]);
	const barRows = cats.filter((c) => c.id.startsWith("hs2:") && c.value > 0).slice(0, 15);
	const bar = barRows.map((c) => ({
		name: c.name.replace(/ \(HS.*$/, ""),
		value: c.value / 1e9,
		id: c.id
	}));
	const barAsOf = barRows.reduce((m, c) => c.period > m ? c.period : m, "");
	const barSources = [...new Set(observations.filter((o) => barRows.some((c) => c.id === o.categoryId)).map((o) => o.sourceFile))].slice(0, 2).join(", ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "desk-card p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "품목명 · 코드",
					className: "max-w-xs"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "inline-flex items-center gap-1.5 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: onlyMapped,
						onCheckedChange: setOnlyMapped
					}), "Top-100 매칭 있는 산업만"]
				})]
			}),
			bar.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartFrame, {
					title: "수출 상위 품목 (HS 2단위, 품목별 최신월)",
					unit: "USD bn",
					source: barSources || "수출 관측값",
					asOf: barAsOf || null,
					ariaLabel: `수출 상위 ${bar.length}개 품목 막대 차트: ${bar.slice(0, 5).map((b) => `${b.name} ${b.value.toFixed(1)}bn`).join(", ")}`,
					pngName: chartExportName("KR", "EXPORT", "top-hs2", "png", Date.now()),
					csv: () => ({
						text: ["id,name,period,value_usd_bn", ...barRows.map((c) => `${c.id},"${c.name.replace(/"/g, "'")}",${c.period},${(c.value / 1e9).toFixed(3)}`)].join("\n"),
						filename: chartExportName("KR", "EXPORT", "top-hs2", "csv", Date.now())
					}),
					testId: "export-top-bar",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-[260px]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
							width: "100%",
							height: "100%",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
								data: bar,
								layout: "vertical",
								margin: { left: 80 },
								accessibilityLayer: true,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
										strokeDasharray: "3 3",
										opacity: .2
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
										type: "number",
										tick: { fontSize: 10 },
										unit: "bn"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
										type: "category",
										dataKey: "name",
										tick: { fontSize: 10 },
										width: 76
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, { formatter: (v) => `$${Number(v).toFixed(1)}bn` }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
										dataKey: "value",
										fill: "#d4a017",
										name: "수출 $bn",
										onClick: (d) => onOpen(String(d.id))
									})
								]
							})
						})
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-auto max-h-[520px] scroll-thin",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "desk-table w-full",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "산업" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "코드" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "text-right",
							children: "최신 수출"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "티어" })
					] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: cats.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "cursor-pointer hover:bg-muted/30",
						onClick: () => onOpen(c.id),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: c.name }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "tabular text-xs",
								children: c.id
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "text-right tabular",
								children: c.value ? formatUsdBn(c.value) : "N/A"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "outline",
								className: "text-[10px]",
								children: core.some((x) => x.key === c.id) ? "T1" : "T3"
							}) })
						]
					}, c.id)) })]
				})
			})
		]
	});
}
function IndustryPanel({ cat, onCat }) {
	const lang = useExportDeskStore((s) => s.lang);
	const items = getCore20().items;
	const observations = useAllObservations();
	const extraCats = [...new Set(observations.map((o) => o.categoryId))].filter((id) => id !== "TOTAL" && !items.some((it) => it.key === id));
	const settings = useExportDeskStore((s) => s.settings);
	const exposures = useExportDeskStore((s) => s.exposures);
	const caps = useKospiCapQuotes();
	const [verifiedOnly, setVerifiedOnly] = (0, import_react.useState)(false);
	const [showNames, setShowNames] = (0, import_react.useState)(true);
	const asOf = kstYmd();
	const universe = (0, import_react.useMemo)(() => {
		return rankKospiByMarketCap((caps.data?.quotes ?? []).filter((q) => q.market === "KOSPI" && q.marketCap > 0).map((q) => ({
			ticker: q.ticker,
			name: q.name,
			marketCap: q.marketCap,
			date: asOf,
			isPreferred: q.isPreferred
		})), {
			n: settings.universeN,
			date: asOf
		});
	}, [
		caps.data,
		asOf,
		settings.universeN
	]);
	const matched = resolveCompanySectorExposure(exposures, {
		categoryId: cat,
		asOf,
		top100Tickers: new Set(universe.map((u) => u.ticker)),
		minWeight: verifiedOnly ? settings.minWeight : .05,
		minConfidence: verifiedOnly ? settings.minConfidence : 0,
		primaryOnly: settings.primaryOnly
	});
	const chartNames = matched.slice(0, 8);
	const px = useIndustryMonthlyPrices(chartNames.map((m) => m.ticker));
	const exports = useExportSeries(cat);
	const quotes = new Map((caps.data?.quotes ?? []).map((q) => [q.ticker, q]));
	const overlay = (0, import_react.useMemo)(() => {
		const values = exports.map((e) => e.valueUsd);
		const roll = calculateRolling12MSum(values);
		const yoy = calculateYoYGrowth(values);
		const byPeriod = /* @__PURE__ */ new Map();
		for (const e of exports) byPeriod.set(e.period, { exp: e.valueUsd });
		for (const m of chartNames) {
			const s = px.data?.series[m.ticker] ?? [];
			for (const p of s) {
				const period = p.date.slice(0, 7);
				const row = byPeriod.get(period) ?? {};
				row[m.ticker] = p.value;
				byPeriod.set(period, row);
			}
		}
		const periods = [...byPeriod.keys()].sort();
		const expIdx = normalizeToBase100(periods.map((_, i) => {
			const match = exports.findIndex((e) => e.period === periods[i]);
			return match >= 0 ? roll[match] : NaN;
		}));
		chartNames.reduce((s, m) => s + m.exposureWeight, 0);
		const compIdx = normalizeToBase100(periods.map((p) => {
			let acc = 0;
			let w = 0;
			for (const m of chartNames) {
				const v = byPeriod.get(p)?.[m.ticker];
				if (v != null && Number.isFinite(v)) {
					acc += v * m.exposureWeight;
					w += m.exposureWeight;
				}
			}
			return w > 0 ? acc / w : NaN;
		}));
		const nameIdx = {};
		for (const m of chartNames) nameIdx[m.ticker] = normalizeToBase100(periods.map((p) => byPeriod.get(p)?.[m.ticker] ?? NaN));
		return periods.map((period, i) => {
			const rec = {
				period,
				expIdx: numOrNull(expIdx[i]),
				compIdx: numOrNull(compIdx[i]),
				yoy: (() => {
					const j = exports.findIndex((e) => e.period === period);
					return j >= 0 ? numOrNull(yoy[j]) : null;
				})()
			};
			for (const m of chartNames) rec[m.ticker] = numOrNull(nameIdx[m.ticker]?.[i]);
			return rec;
		});
	}, [
		exports,
		px.data,
		chartNames
	]);
	const clipped = (0, import_react.useMemo)(() => clipRange(overlay, settings.range), [overlay, settings.range]);
	const yoyByPeriod = /* @__PURE__ */ new Map();
	{
		const y = calculateYoYGrowth(exports.map((x) => x.valueUsd));
		exports.forEach((e, i) => {
			const v = y[i];
			if (v != null && Number.isFinite(v)) yoyByPeriod.set(e.period, v);
		});
	}
	const yoyCByPeriod = /* @__PURE__ */ new Map();
	{
		const y = calculateYoYGrowth(overlay.map((r) => typeof r.compIdx === "number" ? r.compIdx : NaN));
		overlay.forEach((r, i) => {
			const v = y[i];
			if (v != null && Number.isFinite(v)) yoyCByPeriod.set(String(r.period), v);
		});
	}
	const inf = pearsonWithInference(clipped.map((r) => yoyByPeriod.get(String(r.period)) ?? NaN), clipped.map((r) => yoyCByPeriod.get(String(r.period)) ?? NaN), { transform: "yoy" });
	const catLabel = items.find((i) => i.key === cat)?.ko ?? (cat.startsWith("hs2:") ? hsName(cat.slice(4)) : cat);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "desk-card desk-card-indigo p-4 space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2 items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						className: "h-9 rounded-md border border-border bg-background px-2 text-sm",
						value: cat,
						onChange: (e) => onCat(e.target.value),
						children: [items.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: it.key,
							children: it.ko
						}, it.key)), extraCats.sort().map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: id,
							children: id.startsWith("hs2:") ? hsName(id.slice(4)) : id
						}, id))]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "inline-flex items-center gap-1.5 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: settings.primaryOnly,
							onCheckedChange: (v) => useExportDeskStore.getState().patchSettings({ primaryOnly: v })
						}), "주력 노출만"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "inline-flex items-center gap-1.5 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: verifiedOnly,
							onCheckedChange: setVerifiedOnly
						}), "검증된 매핑만"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "inline-flex items-center gap-1.5 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: showNames,
							onCheckedChange: setShowNames
						}), "개별 종목선"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[11px] text-muted-foreground",
						children: [
							"Top ",
							settings.universeN,
							" · 매칭 ",
							matched.length
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-[11px] text-muted-foreground leading-relaxed",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: catLabel }),
					" 수출(12M 누적, 지수=100)과 시총 Top ",
					settings.universeN,
					" 중 해당 산업 노출 기업의 주가. 관세 통계는 제품이지 기업이 아닙니다 — 분석용 노출 맵이며 세관 귀속이 아닙니다. 시총 순위: ",
					caps.data?.source ?? "N/A",
					" (당일, 과거 소급 아님)."
				]
			}),
			exports.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyExport, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportDualChart, {
				data: clipped.map((r) => ({
					time: String(r.period),
					a: typeof r.expIdx === "number" ? r.expIdx : null,
					b: typeof r.compIdx === "number" ? r.compIdx : null
				})),
				aName: `${catLabel} 수출`,
				bName: "노출가중 주가"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-2 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "수출-주가 YoY 상관",
						value: inf.insufficient ? t("export.insufficient", lang) : inf.r == null ? "N/A" : inf.r.toFixed(3),
						sub: inf.insufficient ? `N=${inf.n}` : `N=${inf.n} HAC`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "매칭 기업",
						value: String(matched.length),
						sub: `차트 ${chartNames.length}개`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "유니버스",
						value: `${universe.length}`,
						sub: caps.data?.source ?? "N/A"
					})
				]
			}),
			matched.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-lg border border-dashed px-4 py-8 text-center text-sm",
				children: t("export.empty.sector", lang)
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "desk-table w-full",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "종목" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "역할" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "text-right",
						children: "노출"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "text-right",
						children: "시총순위"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "text-right",
						children: "등락"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "검증" })
				] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: matched.map((m) => {
					const q = quotes.get(m.ticker);
					const rank = universe.find((u) => u.ticker === m.ticker)?.rank;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/stock/$ticker",
							params: { ticker: m.ticker },
							className: "hover:underline",
							children: m.companyName
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[10px] tabular text-muted-foreground",
							children: m.ticker
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "text-xs",
							children: m.valueChainRole
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "text-right tabular",
							children: [(m.exposureWeight * 100).toFixed(0), "%"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "text-right tabular",
							children: rank ?? "N/A"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: cn("text-right tabular", (q?.changePct ?? 0) >= 0 ? "text-price-up" : "text-price-down"),
							children: q ? `${q.changePct.toFixed(2)}%` : "N/A"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: "outline",
							className: cn("text-[10px]", m.verificationStatus === "UNVERIFIED_SEED" && "text-desk-copper"),
							children: m.verificationStatus === "UNVERIFIED_SEED" ? "미검증" : m.verificationStatus
						}) })
					] }, m.ticker);
				}) })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Provenance, {
				source: `${caps.data?.source ?? "N/A"} · ${px.data?.source ?? "월봉 대기"}`,
				period: `${clipped[0]?.period ?? "—"} ~ ${clipped.at(-1)?.period ?? "—"}`,
				ingested: px.data?.fetchedAt ?? caps.data?.fetchedAt ?? "—",
				taxonomy: getCore20().taxonomyVersion
			})
		]
	});
}
function CorrPanel() {
	const lang = useExportDeskStore((s) => s.lang);
	const settings = useExportDeskStore((s) => s.settings);
	const exports = useExportSeries("TOTAL");
	const macro = useExportMacro();
	const kospi = (0, import_react.useMemo)(() => resampleDailyToMonthEnd((macro.data?.kospi ?? []).map((p) => ({
		date: p.date,
		value: p.value
	}))), [macro.data?.kospi]);
	const fx = (0, import_react.useMemo)(() => resampleDailyToMonthEnd((macro.data?.fx ?? []).map((p) => ({
		date: p.date,
		value: p.value
	}))), [macro.data?.fx]);
	const pack = (0, import_react.useMemo)(() => {
		const byK = new Map(kospi.map((k) => [k.period, k.value]));
		const byF = new Map(fx.map((k) => [k.period, k.value]));
		const aligned = exports.map((e) => ({
			period: e.period,
			exp: e.valueUsd,
			kospi: byK.get(e.period) ?? NaN,
			fx: byF.get(e.period) ?? NaN
		}));
		const yoyE = calculateYoYGrowth(aligned.map((r) => r.exp));
		const yoyK = calculateYoYGrowth(aligned.map((r) => r.kospi));
		const yoyF = calculateYoYGrowth(aligned.map((r) => r.fx));
		const windowed = clipRange(aligned.map((r, i) => ({
			period: r.period,
			yoyE: yoyE[i],
			yoyK: yoyK[i],
			yoyF: yoyF[i]
		})), settings.range);
		const e = windowed.map((r) => r.yoyE);
		const k = windowed.map((r) => r.yoyK);
		const f = windowed.map((r) => r.yoyF);
		return {
			inf: pearsonWithInference(e, k, { transform: "yoy" }),
			raw: calculatePearson(e, k),
			partial: calculatePartialCorrelation(e, k, f),
			xcorr: calculateCrossCorrelation(e, k, 6),
			n: e.filter(Number.isFinite).length
		};
	}, [
		exports,
		kospi,
		fx,
		settings.range
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "desk-card p-4 space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-lg font-semibold",
				children: t("export.corr.title", lang)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "RELEASE_TIME 정렬 권고. 점수는 예측이 아니라 사후 기술 통계입니다. 매수/매도 의견이 아닙니다."
			}),
			pack.inf.insufficient ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-md border px-3 py-6 text-center text-sm",
				children: [
					t("export.insufficient", lang),
					" (N=",
					pack.inf.n,
					")"
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-2 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Pearson YoY (HAC)",
						value: pack.inf.r == null ? "N/A" : pack.inf.r.toFixed(3),
						sub: `N=${pack.inf.n} SE=${pack.inf.se?.toFixed(3) ?? "N/A"}`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "USD/KRW 통제 편상관",
						value: pack.partial == null ? "N/A" : pack.partial.toFixed(3)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "최강 시차",
						value: pack.xcorr.filter((x) => x.corr != null).sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))[0] ? `lag ${pack.xcorr.filter((x) => x.corr != null).sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))[0].lag}` : "N/A"
					})
				]
			})
		]
	});
}
function RegionPanel() {
	const live = useLiveTrade();
	const dest = live.data?.destinations;
	const levels = regionalCapability_config_default.levels;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "desk-card p-4 space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-lg font-semibold flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Earth, { className: "size-4" }), " 수출 목적지 · 지역"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "국가별은 UN Comtrade 총수출(HS TOTAL) 상대국입니다. 시도/시군구는 공식 미제공 시 숫자를 만들지 않습니다."
			}),
			dest?.rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "desk-table w-full",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "상대국" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "text-right",
						children: "수출"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "text-right",
						children: "비중"
					})
				] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: dest.rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: r.name }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "text-right tabular",
						children: formatUsdBn(r.valueUsd)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
						className: "text-right tabular",
						children: [(r.share * 100).toFixed(1), "%"]
					})
				] }, r.partnerCode)) })]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-sm text-muted-foreground",
				children: live.isLoading ? "상대국 집계 수집 중" : "상대국 스냅샷이 아직 없습니다. 화면을 한 번 더 열면 캐시가 쌓입니다."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Provenance, {
				source: dest?.source ?? "N/A",
				period: dest?.period ?? "—",
				ingested: live.data?.source.fetchedAt ?? "—",
				taxonomy: "HS TOTAL"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-2",
				children: levels.map((lv) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-md border border-border px-3 py-2 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-medium",
						children: lv.ko
					}), lv.available === false ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-desk-copper",
						children: lv.reason ?? "제공되지 않음"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-muted-foreground",
						children: lv.note ?? "가져오기 후 표시"
					})]
				}, lv.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SigunguGuard, {})
		]
	});
}
function SigunguGuard() {
	const [geo, setGeo] = (0, import_react.useState)("SIDO");
	const [cls, setCls] = (0, import_react.useState)("HS");
	const cap = resolveRegionalCapability(geo, cls, regionalCapability_config_default);
	const forbidden = !cap.available;
	const reason = cap.reason;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-md bg-muted/40 p-3 text-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex gap-2 mb-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				value: geo,
				onChange: (e) => setGeo(e.target.value),
				className: "h-8 rounded border bg-background px-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "NATIONAL" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "SIDO" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "SIGUNGU" })
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				value: cls,
				onChange: (e) => setCls(e.target.value),
				className: "h-8 rounded border bg-background px-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "HS" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "MTI" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "HSK10" })
				]
			})]
		}), forbidden ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-desk-copper text-xs",
			children: reason ?? "공식 시계열이 없습니다. 숫자를 합성하지 않습니다."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-xs text-muted-foreground",
			children: "선택한 큐브는 가져오기 후에만 값이 있습니다."
		})]
	});
}
function QaPanel() {
	const observations = useAllObservations();
	const demo = useExportDeskStore((s) => s.demoMode);
	const logs = useExportDeskStore((s) => s.logs);
	const live = useLiveTrade();
	const totals = observations.filter((o) => o.categoryId === "TOTAL");
	const parts = observations.filter((o) => o.categoryId.startsWith("hs2:"));
	const lastP = [...new Set(parts.map((p) => p.period))].sort().at(-1);
	const official = totals.find((t) => t.period === lastP)?.valueUsd;
	const recon = lastP && official != null ? validateTradeTotals(parts.filter((p) => p.period === lastP).map((p) => p.valueUsd), official) : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "desk-card p-4 space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-lg font-semibold",
				children: "데이터 품질 / 출처"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "text-xs space-y-1 text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "· 총수출·총수입: FRED/OECD 월간 (XTEXVA01KRM667S, XTIMVA01KRM667S). 통관 속보가 아닙니다." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "· 품목: UN Comtrade HS 공개 프리뷰. MTI 코드가 아니며 HS 85를 반도체로 쓰지 않습니다." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "· 산업부 월간 수출입 동향(잠정)과 관세청 data.go.kr API는 서비스 키가 없어 미연결입니다. 없는 금액은 N/A입니다." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "· 2026-06-01 MTI 개정: 15대→20대. 구 15대 토글은 2026년 신설 5개 품목을 목록에서만 뺍니다." }),
					(live.data?.notes ?? []).map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["· ", n] }, n)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
						"· 총수출 관측 ",
						totals.length,
						"개월 · HS2 품목월 ",
						parts.length,
						"행 · Comtrade 캐시",
						" ",
						live.data?.comtradeMonthsCached ?? 0,
						"개월"
					] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceHealth, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-sm",
				children: [
					"HS2 합 vs FRED 총수출 ",
					recon ? recon.pass ? "PASS" : "WARN" : "N/A",
					recon && ` · gap ${recon.gapPct.toFixed(2)}%`,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-[11px] text-muted-foreground",
						children: "정의가 다르면 갭이 정상입니다 (HS vs OECD 총수출)."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "inline-flex items-center gap-1.5 text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
					checked: demo,
					onCheckedChange: (v) => useExportDeskStore.getState().setDemoMode(v)
				}), "DEMO MODE (합성 숫자 — 기본 꺼짐)"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-xs text-muted-foreground",
				children: [
					"로그 ",
					logs.length,
					"건"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "text-xs space-y-1 max-h-48 overflow-auto",
				children: logs.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
					l.importedAt.slice(0, 19),
					" · ",
					l.importer,
					" · ",
					l.filename,
					" · ",
					l.rowCount,
					"행"
				] }, l.id))
			})
		]
	});
}
function SourceHealth() {
	const keys = useExportDeskStore((s) => s.sourceKeys);
	const setKey = useExportDeskStore((s) => s.setSourceKey);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "overflow-auto",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "desk-table w-full text-xs",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "소스" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "운영" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "상태" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "키" })
			] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: DATA_SOURCES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					href: s.portal,
					target: "_blank",
					rel: "noreferrer",
					className: "hover:underline",
					children: s.displayName
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: s.operator }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: s.status }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: s.authMode === "NONE" ? "—" : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					type: "password",
					className: "h-7 text-xs",
					value: keys[s.id] ?? "",
					placeholder: "serviceKey (로컬만)",
					onChange: (e) => setKey(s.id, e.target.value)
				}) })
			] }, s.id)) })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-[10px] text-muted-foreground",
			children: "미검증 엔드포인트는 Settings에서 연결 테스트 전까지 live로 표시하지 않습니다."
		})]
	});
}
function AdminPanel() {
	const exposures = useExportDeskStore((s) => s.exposures);
	const upsert = useExportDeskStore((s) => s.upsertExposure);
	const remove = useExportDeskStore((s) => s.removeExposure);
	const [err, setErr] = (0, import_react.useState)(null);
	const [form, setForm] = (0, import_react.useState)({
		ticker: "",
		companyName: "",
		exportCategoryId: "semiconductors",
		exposureWeight: "0.6",
		mappingConfidence: "0.8"
	});
	function save() {
		const row = {
			ticker: normalizeKrTicker(form.ticker),
			companyName: form.companyName || form.ticker,
			exportCategoryId: form.exportCategoryId,
			exportCategoryName: form.exportCategoryId,
			valueChainRole: "DEVICE_MAKER",
			exposureWeight: Number(form.exposureWeight),
			mappingConfidence: Number(form.mappingConfidence),
			mappingType: "PRIMARY",
			verificationStatus: "VERIFIED_MANUAL",
			evidenceSummary: "Manual desk edit",
			evidenceSource: [],
			effectiveFrom: kstYmd(),
			lastReviewedAt: kstYmd(),
			active: true
		};
		const r = upsert(row);
		setErr(r.ok ? null : r.error ?? "저장 실패");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "desk-card p-4 space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-lg font-semibold",
				children: "매핑 관리"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-2 sm:grid-cols-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "코드",
						value: form.ticker,
						onChange: (e) => setForm({
							...form,
							ticker: e.target.value
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "이름",
						value: form.companyName,
						onChange: (e) => setForm({
							...form,
							companyName: e.target.value
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "산업 key",
						value: form.exportCategoryId,
						onChange: (e) => setForm({
							...form,
							exportCategoryId: e.target.value
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "가중",
						value: form.exposureWeight,
						onChange: (e) => setForm({
							...form,
							exposureWeight: e.target.value
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						onClick: save,
						children: "저장 (수동검증)"
					})
				]
			}),
			err && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-sm text-price-down",
				children: err
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-auto max-h-[420px]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "desk-table w-full text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "종목" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "산업" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "가중" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "신뢰" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "상태" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {})
					] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: exposures.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: e.active === false ? "opacity-50" : "",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
								e.companyName,
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular",
									children: e.ticker
								})
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: e.exportCategoryId }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "tabular",
								children: e.exposureWeight
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "tabular",
								children: e.mappingConfidence
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [e.verificationStatus, e.verificationStatus === "UNVERIFIED_SEED" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								className: "ml-1 chip-copper border-0 text-[9px]",
								children: "미검증"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "text-desk-rose",
								onClick: () => remove(e.ticker, e.exportCategoryId),
								children: "삭제"
							}) })
						]
					}, `${e.ticker}-${e.exportCategoryId}`)) })]
				})
			})
		]
	});
}
function ImportPanel() {
	const upsert = useExportDeskStore((s) => s.upsertObservations);
	const dump = useExportDeskStore((s) => s.exportStoreJson);
	const load = useExportDeskStore((s) => s.importStoreJson);
	const reset = useExportDeskStore((s) => s.resetStore);
	const [msg, setMsg] = (0, import_react.useState)(null);
	const [importer, setImporter] = (0, import_react.useState)("MTI_MONTHLY_EXPORT");
	async function onFile(f) {
		const res = importTradeCsv(await f.text(), f.name, importer);
		if (!res.ok) {
			setMsg(res.issues.map((i) => `${i.row}: ${i.message}`).join(" · "));
			return;
		}
		upsert(res.rows, {
			id: `${Date.now()}`,
			filename: f.name,
			importer,
			rowCount: res.rows.length,
			importedAt: res.importedAt,
			ok: true
		});
		setMsg(`${res.rows.length}행 반영. 경고 ${res.issues.length}`);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "desk-card p-4 space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-lg font-semibold flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileUp, { className: "size-4" }), " 데이터 가져오기 (Track F)"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "KITA/관세청/KRX에서 받은 CSV. 헤더는 한글·영문 모두 인식합니다. 단위: 천달러·백만불·억달러."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					value: importer,
					onChange: (e) => setImporter(e.target.value),
					className: "h-9 rounded-md border bg-background px-2 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "MTI_MONTHLY_EXPORT" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "HS_MONTHLY_EXPORT" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "REGIONAL_EXPORT" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "KOSPI_INDEX_DAILY" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "FX_USDKRW_DAILY" })
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					type: "file",
					accept: ".csv,text/csv",
					onChange: (e) => {
						const f = e.target.files?.[0];
						if (f) onFile(f);
					}
				})]
			}),
			msg && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-sm flex items-start gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 mt-0.5" }),
					" ",
					msg
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "outline",
						onClick: () => {
							const blob = new Blob([dump()], { type: "application/json" });
							const a = document.createElement("a");
							a.href = URL.createObjectURL(blob);
							a.download = "export-desk-store.json";
							a.click();
						},
						children: "Export Store"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "outline",
						onClick: () => reset(),
						children: "Reset"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "file",
						accept: "application/json",
						onChange: async (e) => {
							const f = e.target.files?.[0];
							if (!f) return;
							const r = load(await f.text());
							setMsg(r.ok ? "스토어 복원" : r.error ?? "실패");
						}
					})
				]
			})
		]
	});
}
var SplitComponent = ExportDesk;
//#endregion
export { SplitComponent as component };
