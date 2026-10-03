/**
 * Importance weights and keyword classes (B0.6). Data only — the scorer lives in
 * `src/lib/feed/importance.ts`. Every weight here surfaces as a Korean reason chip.
 */

export const TIER_POINTS: Record<1 | 2 | 3, { points: number; label: string }> = {
  1: { points: 25, label: "1차 출처" },
  2: { points: 15, label: "주요 매체" },
  3: { points: 5, label: "기타 출처" },
};

export const FLASH_MARKERS = ["[속보]", "속보", "BREAKING", "FLASH", "긴급", "[긴급]"];
export const FLASH_POINTS = 15;

export const WATCH_POINTS = 20;
export const CLUSTER_POINTS = 10;
export const CLUSTER_MIN_SIZE = 3;
export const KEYWORD_CAP = 40;
export const DECAY_GRACE_HOURS = 2;
export const DECAY_PER_HOUR = 5;
export const FLASH_TIER_MIN = 80;
export const HIGH_TIER_MIN = 60;

export interface KeywordClass {
  id: string;
  label: string;
  points: number;
  /** Case-insensitive substrings. Latin terms match on word boundaries. */
  terms: string[];
  topic: string;
}

export const KEYWORD_CLASSES: KeywordClass[] = [
  {
    id: "macro",
    label: "거시·정책",
    points: 20,
    topic: "macro",
    terms: [
      "FOMC", "기준금리", "금리 인상", "금리 인하", "CPI", "PCE", "소비자물가", "고용", "비농업",
      "실업률", "관세", "수출통제", "환율 급등", "환율 급락", "금통위", "연준", "Fed", "파월",
      "rate hike", "rate cut", "tariff", "export control", "payrolls", "inflation", "treasury yield",
    ],
  },
  {
    id: "corporate",
    label: "기업 이벤트",
    points: 20,
    topic: "earnings",
    terms: [
      "실적", "어닝", "가이던스", "유상증자", "무상증자", "자사주", "공개매수", "인수", "합병",
      "분할", "상장폐지", "거래정지", "감사의견", "횡령", "earnings", "guidance", "buyback",
      "acquisition", "merger", "tender offer", "spin-off", "delisting",
    ],
  },
  {
    id: "structure",
    label: "시장 구조",
    points: 30,
    topic: "market-structure",
    terms: ["서킷브레이커", "사이드카", "상한가", "하한가", "VI 발동", "변동성완화장치", "circuit breaker", "trading halt"],
  },
  {
    id: "rating",
    label: "등급·목표가",
    points: 10,
    topic: "rating",
    terms: [
      "목표가 상향", "목표가 하향", "목표주가 상향", "목표주가 하향", "투자의견 상향", "투자의견 하향",
      "upgrade", "downgrade", "initiate", "initiates", "price target",
    ],
  },
];

/** Publisher → tier for aggregator sources (Naver, Google News) that relay many outlets. */
export const OUTLET_TIERS: { match: RegExp; tier: 1 | 2 }[] = [
  { match: /^(연합뉴스|연합인포맥스|뉴스1|뉴시스|Yonhap|Reuters|로이터|Bloomberg|블룸버그|AP|AFP|Dow Jones)/i, tier: 1 },
  {
    match:
      /^(한국경제|한경|매일경제|매경|머니투데이|서울경제|이데일리|파이낸셜뉴스|헤럴드경제|아시아경제|조선비즈|조선일보|중앙일보|동아일보|한겨레|경향신문|전자신문|디지털타임스|KBS|MBC|SBS|YTN|연합뉴스TV|CNBC|MarketWatch|Wall Street Journal|WSJ|Financial Times|FT|Barron's|The New York Times|Nikkei)/i,
    tier: 2,
  },
];

/** Stopwords for title clustering (Latin words and Hangul bigrams). */
export const CLUSTER_STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "are", "was", "with", "as",
  "at", "by", "from", "after", "amid", "its", "it", "this", "that", "be", "has", "have", "will",
  "속보", "단독", "종합", "기자", "뉴스", "보도", "특징", "특징주",
]);
