//#region node_modules/.nitro/vite/services/ssr/assets/universe-BLkYDatc.js
function inferSectorId(name) {
	const n = name.replace(/\s/g, "");
	if (/바이오|제약|헬스케어|의료|백신|신약|진단|셀트리온|녹십자|유한양행/.test(n)) return "bio";
	if (/배터리|2차전지|이차전지|양극|음극|에코프로|에너지솔루션|퓨처엠|SDI|대주전자재료/.test(n)) return "battery";
	if (/삼성전자|하이닉|반도체|팹리스|파운드리|HBM|웨이퍼|마이크론|DB하이텍|세미콘/.test(n)) return "semiconductors";
	if (/방산|항공우주|미사일|무기|위성|에어로스페이스|쎄트렉|풍산/.test(n)) return "defense";
	if (/로봇|로보틱스|로보티즈|로보스타|클로봇|자동화/.test(n)) return "robotics";
	if (/자동차|모비스|기아|현대차|타이어|만도|한온/.test(n)) return "auto";
	if (/은행|증권|보험|금융|카드|캐피탈/.test(n)) return "finance";
	if (/조선|해양|현대중공업|한국조선|한화오션|한화엔진|STX엔진/.test(n)) return "shipbuilding";
	if (/전력|원전|가스|에너지|전력공사|퓨얼셀|에너빌리티|일렉트릭|일진전기|효성중공업|한국전력|가스공사|S-Oil|에쓰오일/.test(n)) return "energy";
	if (/철강|제철|포스코|POSCO|고려아연|알루미늄/.test(n)) return "steel";
	if (/화학|케미칼|정유|유화|이노베이션/.test(n)) return "chemicals";
	if (/통신|텔레콤|네이버|NAVER|카카오|크래프톤|넷마블|펄어비스/.test(n)) return "telecom";
	if (/건설|건자재|시멘트|산업개발|인프라코어|건설기계/.test(n)) return "construction";
	if (/식품|유통|화장품|패션|여행|카지노|콜마|코스맥스|아모레|오리온|농심|CJ|대상|삼양/.test(n)) return "consumer";
	if (/디스플레이|전자|전기|이노텍/.test(n)) return "electronics";
	return "electronics";
}
function inferMarket(typeCode, typeName) {
	const s = `${typeCode ?? ""} ${typeName ?? ""}`.toUpperCase();
	if (s.includes("KOSDAQ") || s.includes("코스닥") || /\bKQ\b/.test(s)) return "KOSDAQ";
	return "KOSPI";
}
/** Detect KOSPI vs KOSDAQ from any mix of Naver/Yahoo labels. */
function detectKrMarket(...parts) {
	const s = parts.filter(Boolean).join(" ").toUpperCase();
	if (s.includes("KOSDAQ") || s.includes("코스닥") || s.includes(".KQ") || /\bKQ\b/.test(s)) return "KOSDAQ";
	return "KOSPI";
}
/**
* KRX stock (6 digits) or ETF (6 alphanumerics, e.g. 0226A0).
* NEVER strip letters first — that turns 0226A0 into 002260 (wrong name).
*/
function normalizeKrTicker(raw) {
	const t = raw.trim().toUpperCase();
	if (/^[0-9A-Z]{6}$/.test(t)) return t;
	const compact = t.replace(/[\s\-_./]/g, "");
	if (/^[0-9A-Z]{6}$/.test(compact)) return compact;
	const d = t.replace(/\D/g, "");
	if (d.length >= 1 && d.length <= 6 && !/[A-Z]/.test(compact)) return d.padStart(6, "0").slice(-6);
	return compact.slice(0, 8);
}
function isKrTicker(raw) {
	return /^[0-9A-Z]{6}$/.test(normalizeKrTicker(raw));
}
function isDigitTicker(raw) {
	return /^\d{6}$/.test(normalizeKrTicker(raw));
}
function isAlphanumericTicker(raw) {
	const t = normalizeKrTicker(raw);
	return /^[0-9A-Z]{6}$/.test(t) && /[A-Z]/.test(t);
}
var ETF_BRAND_RE = /\b(ETF|ETN|KODEX|TIGER|ACE|PLUS|SOL|RISE|HANARO|KBSTAR)\b/i;
var ETF_KO_RE = /인버스|레버리지|곱버스|상장지수/;
function looksLikeEtf(code, name) {
	if (isAlphanumericTicker(code)) return true;
	if (!name) return false;
	return ETF_BRAND_RE.test(name) || ETF_KO_RE.test(name);
}
/** Route KRX cash equities vs ETFs. 6-digit KODEX/TIGER names are ETFs too. */
function isEtfTicker(code, name) {
	return looksLikeEtf(code, name);
}
function shouldRouteToEtf(code, name, isEtfFlag) {
	if (isEtfFlag) return true;
	return looksLikeEtf(code, name);
}
var UNIVERSE = [
	{
		code: "005930",
		nameKo: "삼성전자",
		nameEn: "Samsung Electronics",
		sectorId: "semiconductors",
		market: "KOSPI"
	},
	{
		code: "000660",
		nameKo: "SK하이닉스",
		nameEn: "SK Hynix",
		sectorId: "semiconductors",
		market: "KOSPI"
	},
	{
		code: "042700",
		nameKo: "한미반도체",
		nameEn: "Hanmi Semiconductor",
		sectorId: "semiconductors",
		market: "KOSPI"
	},
	{
		code: "240810",
		nameKo: "원익IPS",
		nameEn: "Wonik IPS",
		sectorId: "semiconductors",
		market: "KOSDAQ"
	},
	{
		code: "058470",
		nameKo: "리노공업",
		nameEn: "Leeno Industrial",
		sectorId: "semiconductors",
		market: "KOSDAQ"
	},
	{
		code: "039030",
		nameKo: "이오테크닉스",
		nameEn: "EO Technics",
		sectorId: "semiconductors",
		market: "KOSDAQ"
	},
	{
		code: "064760",
		nameKo: "티씨케이",
		nameEn: "TCK",
		sectorId: "semiconductors",
		market: "KOSDAQ"
	},
	{
		code: "095340",
		nameKo: "ISC",
		nameEn: "ISC Co.",
		sectorId: "semiconductors",
		market: "KOSDAQ"
	},
	{
		code: "357780",
		nameKo: "솔브레인",
		nameEn: "Soulbrain",
		sectorId: "semiconductors",
		market: "KOSDAQ"
	},
	{
		code: "403870",
		nameKo: "HPSP",
		nameEn: "HPSP",
		sectorId: "semiconductors",
		market: "KOSDAQ"
	},
	{
		code: "000990",
		nameKo: "DB하이텍",
		nameEn: "DB HiTek",
		sectorId: "semiconductors",
		market: "KOSPI"
	},
	{
		code: "108320",
		nameKo: "LX세미콘",
		nameEn: "LX Semicon",
		sectorId: "semiconductors",
		market: "KOSPI"
	},
	{
		code: "039440",
		nameKo: "에스티아이",
		nameEn: "STI",
		sectorId: "semiconductors",
		market: "KOSDAQ"
	},
	{
		code: "067310",
		nameKo: "하나마이크론",
		nameEn: "Hana Micron",
		sectorId: "semiconductors",
		market: "KOSDAQ"
	},
	{
		code: "066570",
		nameKo: "LG전자",
		nameEn: "LG Electronics",
		sectorId: "electronics",
		market: "KOSPI"
	},
	{
		code: "034220",
		nameKo: "LG디스플레이",
		nameEn: "LG Display",
		sectorId: "electronics",
		market: "KOSPI"
	},
	{
		code: "009150",
		nameKo: "삼성전기",
		nameEn: "Samsung Electro-Mechanics",
		sectorId: "electronics",
		market: "KOSPI"
	},
	{
		code: "011070",
		nameKo: "LG이노텍",
		nameEn: "LG Innotek",
		sectorId: "electronics",
		market: "KOSPI"
	},
	{
		code: "018260",
		nameKo: "삼성에스디에스",
		nameEn: "Samsung SDS",
		sectorId: "electronics",
		market: "KOSPI"
	},
	{
		code: "348370",
		nameKo: "엔젯",
		nameEn: "Enjet",
		sectorId: "electronics",
		market: "KOSDAQ"
	},
	{
		code: "005380",
		nameKo: "현대차",
		nameEn: "Hyundai Motor",
		sectorId: "auto",
		market: "KOSPI"
	},
	{
		code: "000270",
		nameKo: "기아",
		nameEn: "Kia",
		sectorId: "auto",
		market: "KOSPI"
	},
	{
		code: "012330",
		nameKo: "현대모비스",
		nameEn: "Hyundai Mobis",
		sectorId: "auto",
		market: "KOSPI"
	},
	{
		code: "204320",
		nameKo: "HL만도",
		nameEn: "HL Mando",
		sectorId: "auto",
		market: "KOSPI"
	},
	{
		code: "161390",
		nameKo: "한국타이어앤테크놀로지",
		nameEn: "Hankook Tire",
		sectorId: "auto",
		market: "KOSPI"
	},
	{
		code: "018880",
		nameKo: "한온시스템",
		nameEn: "Hanon Systems",
		sectorId: "auto",
		market: "KOSPI"
	},
	{
		code: "011210",
		nameKo: "현대위아",
		nameEn: "Hyundai Wia",
		sectorId: "auto",
		market: "KOSPI"
	},
	{
		code: "000240",
		nameKo: "한국앤컴퍼니",
		nameEn: "Hankook & Company",
		sectorId: "auto",
		market: "KOSPI"
	},
	{
		code: "005850",
		nameKo: "에스엘",
		nameEn: "SL Corporation",
		sectorId: "auto",
		market: "KOSPI"
	},
	{
		code: "373220",
		nameKo: "LG에너지솔루션",
		nameEn: "LG Energy Solution",
		sectorId: "battery",
		market: "KOSPI"
	},
	{
		code: "006400",
		nameKo: "삼성SDI",
		nameEn: "Samsung SDI",
		sectorId: "battery",
		market: "KOSPI"
	},
	{
		code: "247540",
		nameKo: "에코프로비엠",
		nameEn: "EcoPro BM",
		sectorId: "battery",
		market: "KOSDAQ"
	},
	{
		code: "086520",
		nameKo: "에코프로",
		nameEn: "EcoPro",
		sectorId: "battery",
		market: "KOSDAQ"
	},
	{
		code: "003670",
		nameKo: "포스코퓨처엠",
		nameEn: "POSCO Future M",
		sectorId: "battery",
		market: "KOSPI"
	},
	{
		code: "450080",
		nameKo: "에코프로머티",
		nameEn: "EcoPro Materials",
		sectorId: "battery",
		market: "KOSDAQ"
	},
	{
		code: "137400",
		nameKo: "피엔티",
		nameEn: "PNT",
		sectorId: "battery",
		market: "KOSDAQ"
	},
	{
		code: "066970",
		nameKo: "엘앤에프",
		nameEn: "L&F",
		sectorId: "battery",
		market: "KOSDAQ"
	},
	{
		code: "078600",
		nameKo: "대주전자재료",
		nameEn: "Daejoo Electronic Materials",
		sectorId: "battery",
		market: "KOSDAQ"
	},
	{
		code: "207940",
		nameKo: "삼성바이오로직스",
		nameEn: "Samsung Biologics",
		sectorId: "bio",
		market: "KOSPI"
	},
	{
		code: "068270",
		nameKo: "셀트리온",
		nameEn: "Celltrion",
		sectorId: "bio",
		market: "KOSPI"
	},
	{
		code: "326030",
		nameKo: "SK바이오팜",
		nameEn: "SK Biopharm",
		sectorId: "bio",
		market: "KOSPI"
	},
	{
		code: "196170",
		nameKo: "알테오젠",
		nameEn: "Alteogen",
		sectorId: "bio",
		market: "KOSDAQ"
	},
	{
		code: "141080",
		nameKo: "리가켐바이오",
		nameEn: "LegoChem Biosciences",
		sectorId: "bio",
		market: "KOSDAQ"
	},
	{
		code: "302440",
		nameKo: "SK바이오사이언스",
		nameEn: "SK Bioscience",
		sectorId: "bio",
		market: "KOSPI"
	},
	{
		code: "128940",
		nameKo: "한미약품",
		nameEn: "Hanmi Pharm",
		sectorId: "bio",
		market: "KOSPI"
	},
	{
		code: "145020",
		nameKo: "휴젤",
		nameEn: "Hugel",
		sectorId: "bio",
		market: "KOSDAQ"
	},
	{
		code: "000100",
		nameKo: "유한양행",
		nameEn: "Yuhan",
		sectorId: "bio",
		market: "KOSPI"
	},
	{
		code: "006280",
		nameKo: "GC녹십자",
		nameEn: "GC Biopharma",
		sectorId: "bio",
		market: "KOSPI"
	},
	{
		code: "105560",
		nameKo: "KB금융",
		nameEn: "KB Financial",
		sectorId: "finance",
		market: "KOSPI"
	},
	{
		code: "055550",
		nameKo: "신한지주",
		nameEn: "Shinhan Financial",
		sectorId: "finance",
		market: "KOSPI"
	},
	{
		code: "032830",
		nameKo: "삼성생명",
		nameEn: "Samsung Life",
		sectorId: "finance",
		market: "KOSPI"
	},
	{
		code: "086790",
		nameKo: "하나금융지주",
		nameEn: "Hana Financial",
		sectorId: "finance",
		market: "KOSPI"
	},
	{
		code: "316140",
		nameKo: "우리금융지주",
		nameEn: "Woori Financial",
		sectorId: "finance",
		market: "KOSPI"
	},
	{
		code: "000810",
		nameKo: "삼성화재",
		nameEn: "Samsung Fire & Marine",
		sectorId: "finance",
		market: "KOSPI"
	},
	{
		code: "138040",
		nameKo: "메리츠금융지주",
		nameEn: "Meritz Financial",
		sectorId: "finance",
		market: "KOSPI"
	},
	{
		code: "024110",
		nameKo: "기업은행",
		nameEn: "IBK",
		sectorId: "finance",
		market: "KOSPI"
	},
	{
		code: "009540",
		nameKo: "HD한국조선해양",
		nameEn: "HD Korea Shipbuilding",
		sectorId: "shipbuilding",
		market: "KOSPI"
	},
	{
		code: "042660",
		nameKo: "한화오션",
		nameEn: "Hanwha Ocean",
		sectorId: "shipbuilding",
		market: "KOSPI"
	},
	{
		code: "010140",
		nameKo: "삼성중공업",
		nameEn: "Samsung Heavy Industries",
		sectorId: "shipbuilding",
		market: "KOSPI"
	},
	{
		code: "329180",
		nameKo: "HD현대중공업",
		nameEn: "HD Hyundai Heavy Industries",
		sectorId: "shipbuilding",
		market: "KOSPI"
	},
	{
		code: "267250",
		nameKo: "HD현대",
		nameEn: "HD Hyundai",
		sectorId: "shipbuilding",
		market: "KOSPI"
	},
	{
		code: "010620",
		nameKo: "HD현대미포",
		nameEn: "HD Hyundai Mipo",
		sectorId: "shipbuilding",
		market: "KOSPI"
	},
	{
		code: "082740",
		nameKo: "한화엔진",
		nameEn: "Hanwha Engine",
		sectorId: "shipbuilding",
		market: "KOSPI"
	},
	{
		code: "071970",
		nameKo: "STX엔진",
		nameEn: "STX Engine",
		sectorId: "shipbuilding",
		market: "KOSPI"
	},
	{
		code: "443060",
		nameKo: "HD현대마린솔루션",
		nameEn: "HD Hyundai Marine Solution",
		sectorId: "shipbuilding",
		market: "KOSPI"
	},
	{
		code: "011170",
		nameKo: "롯데케미칼",
		nameEn: "Lotte Chemical",
		sectorId: "chemicals",
		market: "KOSPI"
	},
	{
		code: "051910",
		nameKo: "LG화학",
		nameEn: "LG Chem",
		sectorId: "chemicals",
		market: "KOSPI"
	},
	{
		code: "009830",
		nameKo: "한화솔루션",
		nameEn: "Hanwha Solutions",
		sectorId: "chemicals",
		market: "KOSPI"
	},
	{
		code: "014680",
		nameKo: "한솔케미칼",
		nameEn: "Hansol Chemical",
		sectorId: "chemicals",
		market: "KOSPI"
	},
	{
		code: "093370",
		nameKo: "후성",
		nameEn: "Foosung",
		sectorId: "chemicals",
		market: "KOSPI"
	},
	{
		code: "298050",
		nameKo: "효성첨단소재",
		nameEn: "Hyosung Advanced Materials",
		sectorId: "chemicals",
		market: "KOSPI"
	},
	{
		code: "011780",
		nameKo: "금호석유",
		nameEn: "Kumho Petrochemical",
		sectorId: "chemicals",
		market: "KOSPI"
	},
	{
		code: "096770",
		nameKo: "SK이노베이션",
		nameEn: "SK Innovation",
		sectorId: "chemicals",
		market: "KOSPI"
	},
	{
		code: "006650",
		nameKo: "대한유화",
		nameEn: "Korea Petrochemical",
		sectorId: "chemicals",
		market: "KOSPI"
	},
	{
		code: "003240",
		nameKo: "태광산업",
		nameEn: "Taekwang Industrial",
		sectorId: "chemicals",
		market: "KOSPI"
	},
	{
		code: "015760",
		nameKo: "한국전력",
		nameEn: "KEPCO",
		sectorId: "energy",
		market: "KOSPI"
	},
	{
		code: "036460",
		nameKo: "한국가스공사",
		nameEn: "KOGAS",
		sectorId: "energy",
		market: "KOSPI"
	},
	{
		code: "267260",
		nameKo: "HD현대일렉트릭",
		nameEn: "HD Hyundai Electric",
		sectorId: "energy",
		market: "KOSPI"
	},
	{
		code: "010120",
		nameKo: "LS ELECTRIC",
		nameEn: "LS Electric",
		sectorId: "energy",
		market: "KOSPI"
	},
	{
		code: "298040",
		nameKo: "효성중공업",
		nameEn: "Hyosung Heavy Industries",
		sectorId: "energy",
		market: "KOSPI"
	},
	{
		code: "034020",
		nameKo: "두산에너빌리티",
		nameEn: "Doosan Enerbility",
		sectorId: "energy",
		market: "KOSPI"
	},
	{
		code: "112610",
		nameKo: "씨에스윈드",
		nameEn: "CS Wind",
		sectorId: "energy",
		market: "KOSPI"
	},
	{
		code: "052690",
		nameKo: "한전기술",
		nameEn: "KEPCO E&C",
		sectorId: "energy",
		market: "KOSPI"
	},
	{
		code: "010950",
		nameKo: "S-Oil",
		nameEn: "S-Oil",
		sectorId: "energy",
		market: "KOSPI"
	},
	{
		code: "336260",
		nameKo: "두산퓨얼셀",
		nameEn: "Doosan Fuel Cell",
		sectorId: "energy",
		market: "KOSPI"
	},
	{
		code: "103590",
		nameKo: "일진전기",
		nameEn: "Iljin Electric",
		sectorId: "energy",
		market: "KOSPI"
	},
	{
		code: "001440",
		nameKo: "대한전선",
		nameEn: "Taihan Cable",
		sectorId: "energy",
		market: "KOSPI"
	},
	{
		code: "000150",
		nameKo: "두산",
		nameEn: "Doosan",
		sectorId: "energy",
		market: "KOSPI"
	},
	{
		code: "017670",
		nameKo: "SK텔레콤",
		nameEn: "SK Telecom",
		sectorId: "telecom",
		market: "KOSPI"
	},
	{
		code: "030200",
		nameKo: "KT",
		nameEn: "KT",
		sectorId: "telecom",
		market: "KOSPI"
	},
	{
		code: "032640",
		nameKo: "LG유플러스",
		nameEn: "LG Uplus",
		sectorId: "telecom",
		market: "KOSPI"
	},
	{
		code: "035420",
		nameKo: "NAVER",
		nameEn: "NAVER",
		sectorId: "telecom",
		market: "KOSPI"
	},
	{
		code: "035720",
		nameKo: "카카오",
		nameEn: "Kakao",
		sectorId: "telecom",
		market: "KOSPI"
	},
	{
		code: "259960",
		nameKo: "크래프톤",
		nameEn: "Krafton",
		sectorId: "telecom",
		market: "KOSPI"
	},
	{
		code: "251270",
		nameKo: "넷마블",
		nameEn: "Netmarble",
		sectorId: "telecom",
		market: "KOSPI"
	},
	{
		code: "263750",
		nameKo: "펄어비스",
		nameEn: "Pearl Abyss",
		sectorId: "telecom",
		market: "KOSDAQ"
	},
	{
		code: "097950",
		nameKo: "CJ제일제당",
		nameEn: "CJ CheilJedang",
		sectorId: "consumer",
		market: "KOSPI"
	},
	{
		code: "271560",
		nameKo: "오리온",
		nameEn: "Orion",
		sectorId: "consumer",
		market: "KOSPI"
	},
	{
		code: "090430",
		nameKo: "아모레퍼시픽",
		nameEn: "Amorepacific",
		sectorId: "consumer",
		market: "KOSPI"
	},
	{
		code: "051900",
		nameKo: "LG생활건강",
		nameEn: "LG H&H",
		sectorId: "consumer",
		market: "KOSPI"
	},
	{
		code: "004370",
		nameKo: "농심",
		nameEn: "Nongshim",
		sectorId: "consumer",
		market: "KOSPI"
	},
	{
		code: "139480",
		nameKo: "이마트",
		nameEn: "E-mart",
		sectorId: "consumer",
		market: "KOSPI"
	},
	{
		code: "282330",
		nameKo: "BGF리테일",
		nameEn: "BGF Retail",
		sectorId: "consumer",
		market: "KOSPI"
	},
	{
		code: "192820",
		nameKo: "코스맥스",
		nameEn: "Cosmax",
		sectorId: "consumer",
		market: "KOSPI"
	},
	{
		code: "161890",
		nameKo: "한국콜마",
		nameEn: "Kolmar Korea",
		sectorId: "consumer",
		market: "KOSPI"
	},
	{
		code: "001040",
		nameKo: "CJ",
		nameEn: "CJ Corp",
		sectorId: "consumer",
		market: "KOSPI"
	},
	{
		code: "001120",
		nameKo: "LX인터내셔널",
		nameEn: "LX International",
		sectorId: "consumer",
		market: "KOSPI"
	},
	{
		code: "003230",
		nameKo: "삼양식품",
		nameEn: "Samyang Foods",
		sectorId: "consumer",
		market: "KOSPI"
	},
	{
		code: "001680",
		nameKo: "대상",
		nameEn: "Daesang",
		sectorId: "consumer",
		market: "KOSPI"
	},
	{
		code: "298020",
		nameKo: "효성티앤씨",
		nameEn: "Hyosung TNC",
		sectorId: "consumer",
		market: "KOSPI"
	},
	{
		code: "000720",
		nameKo: "현대건설",
		nameEn: "Hyundai E&C",
		sectorId: "construction",
		market: "KOSPI"
	},
	{
		code: "028260",
		nameKo: "삼성물산",
		nameEn: "Samsung C&T",
		sectorId: "construction",
		market: "KOSPI"
	},
	{
		code: "006360",
		nameKo: "GS건설",
		nameEn: "GS E&C",
		sectorId: "construction",
		market: "KOSPI"
	},
	{
		code: "047040",
		nameKo: "대우건설",
		nameEn: "Daewoo E&C",
		sectorId: "construction",
		market: "KOSPI"
	},
	{
		code: "375500",
		nameKo: "DL이앤씨",
		nameEn: "DL E&C",
		sectorId: "construction",
		market: "KOSPI"
	},
	{
		code: "002380",
		nameKo: "KCC",
		nameEn: "KCC",
		sectorId: "construction",
		market: "KOSPI"
	},
	{
		code: "294870",
		nameKo: "HDC현대산업개발",
		nameEn: "HDC Hyundai Development",
		sectorId: "construction",
		market: "KOSPI"
	},
	{
		code: "042670",
		nameKo: "HD현대인프라코어",
		nameEn: "HD Hyundai Infracore",
		sectorId: "construction",
		market: "KOSPI"
	},
	{
		code: "267270",
		nameKo: "HD현대건설기계",
		nameEn: "HD Hyundai Construction Equipment",
		sectorId: "construction",
		market: "KOSPI"
	},
	{
		code: "001230",
		nameKo: "동국홀딩스",
		nameEn: "Dongkuk Holdings",
		sectorId: "steel",
		market: "KOSPI"
	},
	{
		code: "460860",
		nameKo: "동국제강",
		nameEn: "Dongkuk Steel",
		sectorId: "steel",
		market: "KOSPI"
	},
	{
		code: "004020",
		nameKo: "현대제철",
		nameEn: "Hyundai Steel",
		sectorId: "steel",
		market: "KOSPI"
	},
	{
		code: "005490",
		nameKo: "POSCO홀딩스",
		nameEn: "POSCO Holdings",
		sectorId: "steel",
		market: "KOSPI"
	},
	{
		code: "010130",
		nameKo: "고려아연",
		nameEn: "Korea Zinc",
		sectorId: "steel",
		market: "KOSPI"
	},
	{
		code: "001430",
		nameKo: "세아베스틸지주",
		nameEn: "SeAH Besteel",
		sectorId: "steel",
		market: "KOSPI"
	},
	{
		code: "000670",
		nameKo: "영풍",
		nameEn: "Young Poong",
		sectorId: "steel",
		market: "KOSPI"
	},
	{
		code: "004890",
		nameKo: "동일산업",
		nameEn: "Dongil Industries",
		sectorId: "steel",
		market: "KOSPI"
	},
	{
		code: "008350",
		nameKo: "남선알미늄",
		nameEn: "Namsun Aluminum",
		sectorId: "steel",
		market: "KOSPI"
	},
	{
		code: "277810",
		nameKo: "레인보우로보틱스",
		nameEn: "Rainbow Robotics",
		sectorId: "robotics",
		market: "KOSDAQ"
	},
	{
		code: "108490",
		nameKo: "로보티즈",
		nameEn: "Robotis",
		sectorId: "robotics",
		market: "KOSDAQ"
	},
	{
		code: "090360",
		nameKo: "로보스타",
		nameEn: "Robostar",
		sectorId: "robotics",
		market: "KOSDAQ"
	},
	{
		code: "466100",
		nameKo: "클로봇",
		nameEn: "CLOBOT",
		sectorId: "robotics",
		market: "KOSDAQ"
	},
	{
		code: "454910",
		nameKo: "두산로보틱스",
		nameEn: "Doosan Robotics",
		sectorId: "robotics",
		market: "KOSPI"
	},
	{
		code: "099320",
		nameKo: "쎄트렉아이",
		nameEn: "Satrec Initiative",
		sectorId: "defense",
		market: "KOSDAQ"
	},
	{
		code: "058610",
		nameKo: "에스피지",
		nameEn: "SPG",
		sectorId: "robotics",
		market: "KOSDAQ"
	},
	{
		code: "012450",
		nameKo: "한화에어로스페이스",
		nameEn: "Hanwha Aerospace",
		sectorId: "defense",
		market: "KOSPI"
	},
	{
		code: "047810",
		nameKo: "한국항공우주",
		nameEn: "KAI",
		sectorId: "defense",
		market: "KOSPI"
	},
	{
		code: "079550",
		nameKo: "LIG넥스원",
		nameEn: "LIG Nex1",
		sectorId: "defense",
		market: "KOSPI"
	},
	{
		code: "272210",
		nameKo: "한화시스템",
		nameEn: "Hanwha Systems",
		sectorId: "defense",
		market: "KOSPI"
	},
	{
		code: "064350",
		nameKo: "현대로템",
		nameEn: "Hyundai Rotem",
		sectorId: "defense",
		market: "KOSPI"
	},
	{
		code: "103140",
		nameKo: "풍산",
		nameEn: "Poongsan",
		sectorId: "defense",
		market: "KOSPI"
	},
	{
		code: "003570",
		nameKo: "SNT다이내믹스",
		nameEn: "SNT Dynamics",
		sectorId: "defense",
		market: "KOSPI"
	}
];
var UNIVERSE_BY_CODE = Object.fromEntries(UNIVERSE.map((u) => [u.code, u]));
function getUniverseItem(code) {
	return UNIVERSE_BY_CODE[normalizeKrTicker(code)] ?? UNIVERSE_BY_CODE[code] ?? UNIVERSE_BY_CODE[code.trim()];
}
//#endregion
export { inferMarket as a, isEtfTicker as c, normalizeKrTicker as d, shouldRouteToEtf as f, getUniverseItem as i, isKrTicker as l, UNIVERSE_BY_CODE as n, inferSectorId as o, detectKrMarket as r, isDigitTicker as s, UNIVERSE as t, looksLikeEtf as u };
