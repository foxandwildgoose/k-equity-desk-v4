import { withEtfDeadline } from "@/server/etf-request";
import { etfIssuerIdentity } from "@/server/etf-issuer";
import { resolveEtfIssuer } from "@/server/etf-issuer";
import { fetchIssuerPageHoldings } from "@/server/etf-issuer-holdings";
import { findUploadedIssuerHoldingsSnapshot } from "@/data/etf-official-snapshots";
import { fetchSolOfficialHoldings } from "@/server/etf-sol";
/**
 * Live Korea ETF market (Naver Finance full list).
 * Retirement filter: exclude leverage / inverse / 2X products (DC·IRP common rule).
 * New listings: estimated from price history + alphanumeric KRX codes.
 */
import { holdingQuoteCurrency } from "@/server/etf-currency";
import { UNIVERSE } from "@/data/universe";
import { toReadableDoc } from "@/lib/readable-text";
import { matchesSearchQuery, rankByQuery } from "@/lib/search-match";
import { normalizeKrTicker } from "@/lib/infer-sector";
import type { Market } from "@/data/types";
import {
  chooseOfficialBasket,
  compareHoldingsByWeight,
  issuerHoldingsFamily,
  matchIbkProductId,
  parseHanaroFundCatalog,
  parseHanaroHoldingsHtml,
  parseHanaroPdfDate,
  parseIbkPdfRows,
  parseKodexPdfRows,
  normalizeIssuerFundName,
  type IbkPdfItem,
  type KodexPdfItem,
} from "@/server/etf-holdings-parse";


const UA =
  "Mozilla/5.0 (compatible; KoreaEquityCommand/1.0; +https://x.ai) AppleWebKit/537.36";

function headers(): HeadersInit {
  return {
    "User-Agent": UA,
    Accept: "application/json,text/plain,*/*",
    "Accept-Language": "ko-KR,ko;q=0.9",
    Referer: "https://finance.naver.com/sise/etf.naver",
  };
}

async function getText(url: string, signal?: AbortSignal): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, { headers: headers(), signal: signal ? AbortSignal.any([ctrl.signal, signal]) : ctrl.signal });
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

async function getJsonUtf8<T>(url: string, signal?: AbortSignal): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      headers: {
        ...headers(),
        Referer: "https://m.stock.naver.com/",
      },
      signal: signal ? AbortSignal.any([ctrl.signal, signal]) : ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return JSON.parse(await res.text()) as T;
  } finally {
    clearTimeout(t);
  }
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[+,]/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** KRX ETF codes: 6 digits OR 6 alphanumerics (e.g. 0090B0, 0226A0) */
export const ETF_CODE_RE = /^[0-9A-Za-z]{6}$/;

export function normalizeEtfCode(code: string): string {
  return normalizeKrTicker(code);
}

export type EtfTabCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ETF_TAB_LABEL: Record<number, string> = {
  1: "국내 시장지수",
  2: "국내 업종·테마",
  3: "파생 (레버리지·인버스)",
  4: "해외 주식",
  5: "원자재",
  6: "채권",
  7: "혼합·기타",
};

export interface LiveEtfRow {
  code: string;
  nameKo: string;
  tabCode: number;
  tabLabel: string;
  price: number;
  change: number;
  changePct: number;
  nav: number;
  threeMonthEarnRate: number | null;
  volume: number;
  amount: number;
  /** 시가총액 (억) as provided by Naver */
  marketSum: number;
  issuer?: string;
  quoteAvailable?: boolean;
  /** DC/IRP common exclusion: leverage / inverse */
  /** Heuristic only — NOT a DC/IRP whitelist */
    retirementEligible: boolean;
  isLeverageOrInverse: boolean;
  /** Heuristic: likely listed recently */
  isNewCandidate: boolean;
  listedAt?: string;
  daysListed?: number;
  source: "naver-etf-list" | "issuer-file";
}

const LEV_NAME_RE =
  /레버리지|인버스|곱버스|2X|3X|×2|x2|X2|인버스\s*2|선물인버스/i;

export function isLeverageOrInverseName(name: string, tabCode?: number): boolean {
  if (tabCode === 3) return true;
  return LEV_NAME_RE.test(name);
}

/** Alphanumeric KRX codes tend to be newer listings (2024+) */
export function isAlphanumericCode(code: string): boolean {
  return /[A-Za-z]/.test(code);
}

type NaverEtfItem = {
  itemcode: string;
  etfTabCode: number;
  itemname: string;
  nowVal: number;
  changeVal: number;
  changeRate: number;
  nav: number | null;
  threeMonthEarnRate: number | null;
  quant: number;
  amonut: number;
  marketSum: number;
};

let listCache: { at: number; rows: LiveEtfRow[] } | null = null;
const LIST_TTL = 60_000;

export async function fetchAllEtfs(force = false, signal?: AbortSignal): Promise<LiveEtfRow[]> {
  const now = Date.now();
  if (!force && listCache && now - listCache.at < LIST_TTL) {
    return listCache.rows;
  }

  const text = await getText(
    "https://finance.naver.com/api/sise/etfItemList.nhn", signal,
  );
  const parsed = JSON.parse(text) as {
    result?: { etfItemList?: NaverEtfItem[] };
  };
  const items = parsed.result?.etfItemList ?? [];

  const rows: LiveEtfRow[] = items.map((it) => {
    const code = normalizeEtfCode(String(it.itemcode));
    const nameKo = String(it.itemname ?? "");
    const tabCode = Number(it.etfTabCode) || 0;
    const lev = isLeverageOrInverseName(nameKo, tabCode);
    const newCandidate =
      isAlphanumericCode(code) ||
      it.threeMonthEarnRate == null ||
      (code.length === 6 && /^\d+$/.test(code) && Number(code) >= 480000);

    return {
      code,
      nameKo,
      tabCode,
      tabLabel: ETF_TAB_LABEL[tabCode] ?? `유형 ${tabCode}`,
      price: num(it.nowVal),
      change: num(it.changeVal),
      changePct: num(it.changeRate),
      nav: num(it.nav),
      threeMonthEarnRate:
        it.threeMonthEarnRate == null ? null : num(it.threeMonthEarnRate),
      volume: num(it.quant),
      amount: num(it.amonut),
      marketSum: num(it.marketSum),
      retirementEligible: !lev,
      isLeverageOrInverse: lev,
      isNewCandidate: newCandidate && !lev,
      source: "naver-etf-list",
    };
  });

  listCache = { at: now, rows };
  return rows;
}

export async function fetchEtfListingDate(
  code: string,
): Promise<{ listedAt: string; daysListed: number } | null> {
  const c = normalizeEtfCode(code);
  let oldest: string | null = null;
  let newest: string | null = null;
  for (let page = 1; page <= 90; page++) {
    try {
      const rows = await getJsonUtf8<
        { localTradedAt?: string }[]
      >(
        `https://m.stock.naver.com/api/stock/${c}/price?page=${page}&pageSize=20`,
      );
      if (!rows?.length) break;
      if (!newest) newest = rows[0]?.localTradedAt ?? null;
      oldest = rows[rows.length - 1]?.localTradedAt ?? oldest;
      if (rows.length < 20) break;
    } catch {
      break;
    }
  }
  if (!oldest) return null;
  const listed = new Date(oldest);
  const days = Math.max(
    0,
    Math.round((Date.now() - listed.getTime()) / 86_400_000),
  );
  const iso = Number.isNaN(listed.getTime())
    ? oldest.slice(0, 10)
    : `${listed.getFullYear()}-${String(listed.getMonth() + 1).padStart(2, "0")}-${String(listed.getDate()).padStart(2, "0")}`;
  return { listedAt: iso, daysListed: days };
}

/** Enrich newest candidates with listing dates (bounded concurrency). */
export async function fetchNewEtfs(limit = 40): Promise<LiveEtfRow[]> {
  const all = await fetchAllEtfs();
  const candidates = all
    .filter((e) => e.isNewCandidate && e.retirementEligible)
    .sort((a, b) => {
      // Prefer alphanumeric high codes, then null 3m return
      const aAlpha = isAlphanumericCode(a.code) ? 1 : 0;
      const bAlpha = isAlphanumericCode(b.code) ? 1 : 0;
      if (aAlpha !== bAlpha) return bAlpha - aAlpha;
      return b.code.localeCompare(a.code);
    })
    .slice(0, Math.min(60, limit + 20));

  const enriched: LiveEtfRow[] = [];
  // sequential batches of 6 to avoid hammering
  for (let i = 0; i < candidates.length; i += 6) {
    const batch = candidates.slice(i, i + 6);
    const parts = await Promise.all(
      batch.map(async (etf) => {
        const listed = await fetchEtfListingDate(etf.code).catch(() => null);
        return {
          ...etf,
          listedAt: listed?.listedAt,
          daysListed: listed?.daysListed,
        };
      }),
    );
    enriched.push(...parts);
  }

  return enriched
    .filter((e) => e.daysListed == null || e.daysListed <= 90)
    .sort((a, b) => {
      const da = a.daysListed ?? 9999;
      const db = b.daysListed ?? 9999;
      if (da !== db) return da - db;
      return b.code.localeCompare(a.code);
    })
    .slice(0, limit);
}


// ── Theme / value-chain peer ETFs (not Naver industryCompare mega-caps) ────

/** Industry themes and related keywords for peer scoring */
export const ETF_THEME_GROUPS: {
  id: string;
  label: string;
  keywords: string[];
  /** Adjacent value-chain themes for related peers */
  related: string[];
}[] = [
  {
    id: "shipbuilding",
    label: "조선·해운·기자재",
    keywords: ["조선", "해운", "조선기자재", "친환경조선", "LNG선", "선박", "조선TOP", "조선해운"],
    related: ["steel", "power", "defense"],
  },
  {
    id: "semiconductor",
    label: "반도체·장비",
    keywords: ["반도체", "HBM", "AI반도체", "메모리", "소부장", "반도체TOP", "팹리스", "파운드리", "웨이퍼"],
    related: ["ai"],
  },
  {
    id: "battery",
    label: "2차전지·소재",
    keywords: ["2차전지", "배터리", "양극", "음극", "전해질", "전기차", "이차전지"],
    related: ["auto", "chemicals"],
  },
  {
    id: "bio",
    label: "바이오·헬스케어",
    keywords: ["바이오", "헬스케어", "제약", "의료", "코스닥150바이오", "K바이오"],
    related: [],
  },
  {
    id: "defense",
    label: "방산·우주항공",
    keywords: ["방산", "우주항공", "항공우주", "K방산", "방산소부장", "국방"],
    related: ["shipbuilding"],
  },
  {
    id: "ai",
    label: "AI·데이터센터·테크",
    keywords: ["AI", "데이터센터", "인공지능", "로봇", "자동화", "클라우드", "테크"],
    related: ["semiconductor", "power"],
  },
  {
    id: "power",
    label: "전력·원전·에너지",
    keywords: ["원전", "원자력", "전력", "전력기기", "에너지", "SMR", "유틸리티", "전력인프라"],
    related: ["ai", "shipbuilding"],
  },
  {
    id: "auto",
    label: "자동차·모빌리티",
    keywords: ["자동차", "현대차", "기아", "모빌리티", "자율주행", "전기차"],
    related: ["battery"],
  },
  {
    id: "steel",
    label: "철강·금속",
    keywords: ["철강", "금속", "포스코", "비철"],
    related: ["shipbuilding", "auto"],
  },
  {
    id: "chemicals",
    label: "화학·소재",
    keywords: ["화학", "소재", "석유화학"],
    related: ["battery", "shipbuilding"],
  },
  {
    id: "finance",
    label: "금융",
    keywords: ["은행", "금융", "증권", "보험", "고배당"],
    related: [],
  },
  {
    id: "us_equity",
    label: "미국·해외주식",
    keywords: ["미국", "S&P", "나스닥", "필라델피아", "엔비디아", "빅테크"],
    related: ["ai", "semiconductor"],
  },
  {
    id: "korea_index",
    label: "국내 시장지수",
    keywords: ["코스피200", "코스닥150", "KRX300", "KOSPI200", "200선물", "200커버드콜", "200"],
    related: [],
  },
  {
    id: "bond",
    label: "채권·금리",
    keywords: ["채권", "국채", "국고", "CD금리", "KOFR", "머니마켓", "초단기"],
    related: [],
  },
];

/** Numeric / Latin tokens must not match years ("2002") or "Soulbrain". */
export function themeKeywordHits(
  nameKo: string,
  description: string,
  keyword: string,
): boolean {
  if (keyword === "200" || /^\d{3,4}$/.test(keyword)) {
    return new RegExp(`(^|[^0-9])${keyword}([^0-9]|$)`).test(nameKo);
  }
  if (keyword === "AI") {
    return /(^|[^A-Za-z])AI([^A-Za-z]|$)/i.test(`${nameKo} ${description}`);
  }
  return `${nameKo} ${description}`.includes(keyword);
}

export function detectEtfThemes(nameKo: string, description = ""): string[] {
  const hits: string[] = [];
  for (const g of ETF_THEME_GROUPS) {
    if (g.keywords.some((k) => themeKeywordHits(nameKo, description, k))) hits.push(g.id);
  }
  return hits;
}

export function formatEtfDescription(raw?: string | null): {
  plain: string;
  paragraphs: string[];
  summary: string;
  bullets: string[];
} {
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
    bullets: bullets.slice(0, 6),
  };
}

export interface RelatedEtfPeer {
  code: string;
  nameKo: string;
  price: number;
  changePct: number;
  marketSum: number;
  volume: number;
  retirementEligible: boolean;
  isLeverageOrInverse: boolean;
  relation: string;
  score: number;
  themes: string[];
}

/**
 * Find thematically related ETFs (same industry + value-chain),
 * NOT Naver's generic mega-cap compare list (KODEX 200 / S&P500).
 */
export function findRelatedEtfs(
  etf: LiveEtfRow,
  universe: LiveEtfRow[],
  description = "",
  limit = 10,
): RelatedEtfPeer[] {
  const themes = detectEtfThemes(etf.nameKo, description);
  const themeSet = new Set(themes);
  // expand related themes once
  for (const id of [...themeSet]) {
    const g = ETF_THEME_GROUPS.find((x) => x.id === id);
    for (const r of g?.related ?? []) themeSet.add(r);
  }

  // extract concrete keywords present in this ETF name/desc
  const focusKeywords: string[] = [];
  for (const g of ETF_THEME_GROUPS) {
    for (const k of g.keywords) {
      if (themeKeywordHits(etf.nameKo, description, k)) focusKeywords.push(k);
    }
  }
  // also pull multi-char hangul tokens from name (e.g. 조선, TOP3)
  for (const m of etf.nameKo.match(/[가-힣A-Za-z0-9]{2,}/g) ?? []) {
    if (!/^(KODEX|TIGER|SOL|ACE|PLUS|RISE|HANARO|TIME|WON|KB|1Q|KIWOOM|마이티|KoAct)$/i.test(m)) {
      focusKeywords.push(m);
    }
  }

  const scored: RelatedEtfPeer[] = [];
  for (const other of universe) {
    if (other.code === etf.code) continue;
    const otherThemes = detectEtfThemes(other.nameKo);
    let score = 0;
    const reasons: string[] = [];

    // shared primary theme
    const shared = otherThemes.filter((t) => themes.includes(t));
    if (shared.length) {
      score += 50 * shared.length;
      const labels = shared
        .map((id) => ETF_THEME_GROUPS.find((g) => g.id === id)?.label ?? id)
        .join(", ");
      reasons.push(`동일 테마(${labels})`);
    }

    // value-chain adjacent
    const chain = otherThemes.filter(
      (t) => !themes.includes(t) && themeSet.has(t),
    );
    if (chain.length) {
      score += 22 * chain.length;
      const labels = chain
        .map((id) => ETF_THEME_GROUPS.find((g) => g.id === id)?.label ?? id)
        .join(", ");
      reasons.push(`밸류체인(${labels})`);
    }

    // keyword overlap in names
    let kwHits = 0;
    for (const k of focusKeywords) {
      if (k.length >= 2 && themeKeywordHits(other.nameKo, "", k)) kwHits++;
    }
    if (kwHits) {
      score += Math.min(40, kwHits * 12);
      reasons.push("명칭·키워드 유사");
    }

    // soft preference: non-leverage peers for retirement investors
    if (etf.retirementEligible && other.retirementEligible) score += 4;
    if (other.isLeverageOrInverse) score -= 8;

    // avoid pure mega-cap index when themes are thematic
    if (
      themes.length &&
      !themes.includes("korea_index") &&
      !themes.includes("us_equity") &&
      /^(KODEX|TIGER)\s*(200|미국S&P|미국나스닥|코스피)/.test(other.nameKo)
    ) {
      score -= 30;
    }

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
      themes: otherThemes,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || b.marketSum - a.marketSum)
    .slice(0, limit);
}

export async function fetchEtfDetail(code: string): Promise<{
  etf: LiveEtfRow | null;
  issuer?: string;
  description?: string;
  descriptionFormatted: ReturnType<typeof formatEtfDescription>;
  themes: string[];
  themeLabels: string[];
  fee?: number;
  nav?: number;
  marketValue?: string;
  relatedCodes: string[];
  /** Theme / value-chain peers (preferred) */
  relatedEtfs: RelatedEtfPeer[];
  /** @deprecated generic Naver compare — kept empty for safety */
  relatedFromCompare: RelatedEtfPeer[];
}> {
  const c = normalizeEtfCode(code);
  const snapshot = findUploadedIssuerHoldingsSnapshot(c);
  const integrationP = withEtfDeadline((signal) => getJsonUtf8<{
    description?: string;
    etfKeyIndicator?: { issuerName?: string; totalFee?: number; nav?: string | number; marketValue?: string };
  }>(`https://m.stock.naver.com/api/stock/${c}/integration`, signal), null);
  const [all, integ] = await Promise.all([
    withEtfDeadline((signal) => fetchAllEtfs(false, signal), [] as LiveEtfRow[]),
    integrationP,
  ]);
  const etf = all.find((e) => e.code === c) ?? (snapshot ? {
    code: c, nameKo: "SOL 글로벌DRAM반도체플러스", issuer: snapshot.issuerName,
    tabCode: 4, tabLabel: "해외 주식", price: 0, change: 0, changePct: 0,
    nav: 0, threeMonthEarnRate: null, volume: 0, amount: 0, marketSum: 0,
    retirementEligible: true, isLeverageOrInverse: false, isNewCandidate: false,
    source: "issuer-file", quoteAvailable: false,
  } : null);

  let issuer: string | undefined = snapshot?.issuerName;
  let description: string | undefined;
  let fee: number | undefined;
  let nav: number | undefined;
  let marketValue: string | undefined;

  if (integ) {
    description = integ.description;
    issuer = integ.etfKeyIndicator?.issuerName ?? issuer;
    fee = integ.etfKeyIndicator?.totalFee;
    nav = num(String(integ.etfKeyIndicator?.nav ?? "").replace(/,/g, ""));
    marketValue = integ.etfKeyIndicator?.marketValue;
  }

  if (etf && issuer) etf.issuer = issuer;

  const nameForTheme = etf?.nameKo ?? c;
  const descriptionFormatted = formatEtfDescription(description);
  const themes = detectEtfThemes(nameForTheme, descriptionFormatted.plain);
  const themeLabels = themes
    .map((id) => ETF_THEME_GROUPS.find((g) => g.id === id)?.label ?? id)
    .filter(Boolean);

  const relatedEtfs = etf
    ? findRelatedEtfs(etf, all, descriptionFormatted.plain, 12)
    : [];

  const relatedCodes = inferThemeStockCodes(nameForTheme);

  return {
    etf: etf ? { ...etf, issuer: issuer ?? etf.issuer } : etf,
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
    relatedFromCompare: [],
  };
}

/**
 * Theme → universe stock mapping when official daily basket weights are unavailable.
 * Labeled as "테마 관련 종목" not official AUM weights.
 */
export function inferThemeStockCodes(etfName: string): string[] {
  const n = etfName;
  const picks: string[] = [];
  const add = (...codes: string[]) => {
    for (const c of codes) {
      if (UNIVERSE.some((u) => u.code === c) && !picks.includes(c)) {
        picks.push(c);
      }
    }
  };

  if (/방산|우주항공|항공우주|K방산|국방/.test(n) && !/항공운송/.test(n)) {
    add("012450", "047810", "079550", "272210", "064350", "103140", "009540");
  }
  if (/조선|해운|선박|기자재/.test(n)) {
    add("009540", "010140", "042660", "443060", "267250", "010620", "071970");
  }
  if (/바이오|헬스케어|제약|코스닥150바이오/.test(n)) {
    add("207940", "068270", "326030", "196170", "128940", "141080", "302440");
  }
  if (/반도체|HBM|AI반도체|메모리|CPU반도체/.test(n)) {
    add("005930", "000660", "042700", "058470", "240810", "039030", "000990");
  }
  if (
    (/(^|[^A-Za-z])AI([^A-Za-z]|$)|인공지능|데이터센터/.test(n)) &&
    !/미국|S&P|나스닥|필라델피아|해외/.test(n)
  ) {
    add("005930", "000660", "042700", "034020", "267260", "010120", "298040");
  }
  if (/2차전지|배터리|양극/.test(n)) {
    add("373220", "006400", "003670", "051910", "247540", "086520", "066970");
  }
  if (/하이닉스|샌디스크|SK하이닉스/.test(n)) {
    add("000660", "005930", "042700");
  }
  if (/삼성전자/.test(n)) add("005930");
  if (/자동차|현대차|기아/.test(n)) {
    add("005380", "000270", "012330", "204320");
  }
  if (/원전|전력|에너지|유틸/.test(n)) {
    add("034020", "015760", "267260", "010120", "298040", "052690");
  }
  if (/은행|금융|증권/.test(n)) {
    add("105560", "055550", "086790", "316140");
  }
  if (/코스닥150(?!바이오)/.test(n) || /코스닥(?!.*바이오)/.test(n)) {
    add("247540", "086520", "196170", "277810", "240810", "058470");
  }
  if (/200(?!선물)/.test(n) && /KODEX|TIGER|KB|HANARO|RISE|PLUS|ACE|SOL/.test(n)) {
    add("005930", "000660", "005380", "000270", "373220", "207940", "035420");
  }

  return picks.slice(0, 14);
}

export function searchEtfsInList(
  rows: LiveEtfRow[],
  q: string,
  opts?: { retirementOnly?: boolean },
): LiveEtfRow[] {
  const s = q.trim();
  let list = rows;
  if (opts?.retirementOnly) list = list.filter((e) => e.retirementEligible);
  if (!s) return list.slice(0, 40);
  const hits = list.filter((e) =>
    matchesSearchQuery(s, [
      e.nameKo,
      e.code,
      e.tabLabel,
      e.issuer,
    ]),
  );
  return rankByQuery(hits, s, (e) => ({ name: e.nameKo, code: e.code })).slice(
    0,
    50,
  );
}


export type EtfMarketBucket = "retirement" | "all" | "new" | "theme" | "us" | "bond";

export function filterEtfBucket(
  rows: LiveEtfRow[],
  bucket: EtfMarketBucket,
): LiveEtfRow[] {
  switch (bucket) {
    case "retirement":
      return rows.filter((e) => e.retirementEligible);
    case "new":
      return rows.filter((e) => e.isNewCandidate && e.retirementEligible);
    case "theme":
      return rows.filter((e) => e.retirementEligible && e.tabCode === 2);
    case "us":
      return rows.filter(
        (e) => e.retirementEligible && (e.tabCode === 4 || /미국|S&P|나스닥|해외/.test(e.nameKo)),
      );
    case "bond":
      return rows.filter((e) => e.retirementEligible && (e.tabCode === 6 || e.tabCode === 7));
    case "all":
    default:
      return rows;
  }
}

export type { Market };


// ── Official NAV weights only. Never qty × price rescaled to 100%. ─────────
// A priced subset (equities) used to be stretched to 100% after bonds/cash
// with no quote dropped out. That is not a NAV weight.
// Source selection: issuer publications only. Third-party tables may provide
// reference names, but their weights are never promoted to issuer percentages.

export type EtfAssetClass =
  | "kr-equity"
  | "kr-etf"
  | "us-equity"
  | "overseas-equity"
  | "bond"
  | "future"
  | "cash"
  | "other";

export const ETF_ASSET_CLASS_LABEL: Record<EtfAssetClass, string> = {
  "kr-equity": "국내주식",
  "kr-etf": "국내ETF",
  "us-equity": "미국주식",
  "overseas-equity": "해외주식",
  bond: "채권",
  future: "선물",
  cash: "현금",
  other: "기타",
};

export interface EtfHoldingRow {
  nameKo: string;
  /** Official NAV weight only. Never estimated. */
  weight: number | null;
  weightSource: "official" | null;
  quantity: number | null;
  asOf: string | null;
  code: string | null;
  market: "KOSPI" | "KOSDAQ" | null;
  reutersCode: string | null;
  nation: string | null;
  currency: string | null;
  isin: string | null;
  isCash: boolean;
  isBond: boolean;
  isFuture: boolean;
  isOverseas: boolean;
  isKoreanEquity: boolean;
  isKoreanEtf: boolean;
  assetClass: EtfAssetClass;
}

export interface HoldingLiveQuote {
  price: number;
  change: number;
  changePct: number;
  volume: number;
  currency: string | null;
}

const nameCodeCache = new Map<
  string,
  {
    code: string | null;
    market: "KOSPI" | "KOSDAQ" | null;
    name: string;
    reutersCode: string | null;
    nation: string | null;
    isEtf: boolean;
  } | null
>();

const ETF_BRAND_RE =
  /^(KODEX|TIGER|PLUS|ACE|RISE|SOL|FOCUS|HANARO|KBSTAR|KOSEF|ARIRANG|TIMEFOLIO|WOORI|1Q|KIWOOM|WON|KOACT|TIME|KOACT)\b/i;

export function looksKoreanEtfName(name: string): boolean {
  const n = name.trim();
  if (ETF_BRAND_RE.test(n)) return true;
  if (/상장지수/.test(n)) return true;
  return /\bETF\b/i.test(n) && /[가-힣]/.test(n);
}

function isCashLike(name: string): boolean {
  if (looksKoreanEtfName(name)) return false;
  return /현금|예금|콜론|\bCD\b|\bRP\b|원화예치|외화예치|선물마진|MMF|단기금융|REPO|정기예금|설정현금액|원화현금|원화예금/i.test(
    name,
  );
}

function isBondLike(name: string, isin?: string | null): boolean {
  if (looksKoreanEtfName(name)) return false;
  if (/선물/.test(name)) return false;
  if (isin && /^KR1/i.test(isin)) return true;
  return /국고\d|통안\d{2,}|국고채권|국고\s*채권|통안채|회사채|특수채|금융채|물가채|국민주택|국고채(?!선물)/.test(
    name,
  );
}

function isFutureLike(name: string, isin?: string | null): boolean {
  if (looksKoreanEtfName(name)) return false;
  if (isin && /^KR4/i.test(isin)) return true;
  return /선물\d{2,}/.test(name);
}

function looksOverseas(name: string): boolean {
  const n = name.trim();
  if (/[가-힣]/.test(n) && !/\b(INC|CORP|LTD|PLC|NV|SA|AG)\b/i.test(n)) {
    return false;
  }
  if (/\b(INC|CORP|LTD|PLC|NV|CLASS|CL A|CL B|CORPORATION|INCORPORATED)\b/i.test(n)) {
    return true;
  }
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && !/[가-힣]/.test(n)) return true;
  return false;
}

function asKrCode(v: unknown): string | null {
  const s = String(v ?? "").trim().toUpperCase();
  return /^[0-9A-Z]{6}$/.test(s) ? s : null;
}

function formatYmd(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/[^\d]/g, "");
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return raw;
}

function usClassHint(name: string): string | null {
  if (/\bCLASS\s*C\b|\bCL\s*C\b/i.test(name)) return "class c";
  if (/\bCLASS\s*A\b|\bCL\s*A\b/i.test(name)) return "class a";
  if (/\bCLASS\s*B\b|\bCL\s*B\b/i.test(name)) return "class b";
  return null;
}

function searchQueriesForName(name: string): string[] {
  const raw = name.trim();
  const cleaned = raw
    .replace(/\b(INC|CORP|LTD|PLC|CO|CLASS|CL A|CL B|COMMON|ORD|THE)\b/gi, " ")
    .replace(/[-.,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter((w) => w.length > 1);
  const qs = [raw];
  if (cleaned && cleaned.toLowerCase() !== raw.toLowerCase()) qs.push(cleaned);
  if (words.length >= 2) qs.push(words.slice(0, 2).join(" "));
  if (words[0]) qs.push(words[0]);
  return [...new Set(qs)].slice(0, 3);
}

type NameHit = {
  code: string | null;
  market: "KOSPI" | "KOSDAQ" | null;
  name: string;
  reutersCode: string | null;
  nation: string | null;
  isEtf: boolean;
};

/** Map holding name → KR ticker or US reuters code via Naver autocomplete */
export async function resolveHoldingName(nameKo: string, signal?: AbortSignal): Promise<NameHit | null> {
  const key = nameKo.trim();
  if (!key || isCashLike(key) || isBondLike(key) || isFutureLike(key)) return null;
  if (nameCodeCache.has(key)) return nameCodeCache.get(key) ?? null;

  const uni = UNIVERSE.find(
    (u) =>
      u.nameKo === key ||
      u.nameKo.replace(/\s/g, "") === key.replace(/\s/g, ""),
  );
  if (uni) {
    const hit: NameHit = {
      code: uni.code,
      market: uni.market,
      name: uni.nameKo,
      reutersCode: null,
      nation: "KOR",
      isEtf: false,
    };
    nameCodeCache.set(key, hit);
    return hit;
  }

  for (const q of searchQueriesForName(key)) {
    if (signal?.aborted) return null;
    try {
      const url = `https://m.stock.naver.com/front-api/search/autoComplete?query=${encodeURIComponent(q)}&target=stock`;
      const j = await getJsonUtf8<{
        result?: {
          items?: {
            code?: string;
            name?: string;
            typeCode?: string;
            typeName?: string;
            isEtf?: boolean;
            nationCode?: string;
            reutersCode?: string;
          }[];
        };
      }>(url, signal);
      const items = j.result?.items ?? [];
      const korStock =
        items.find(
          (it) =>
            it.nationCode === "KOR" &&
            !it.isEtf &&
            it.name === key &&
            /^[0-9A-Za-z]{6}$/.test(String(it.code ?? "")),
        ) ??
        items.find(
          (it) =>
            it.nationCode === "KOR" &&
            !it.isEtf &&
            /^[0-9A-Za-z]{6}$/.test(String(it.code ?? "")),
        );
      const korEtf = items.find(
        (it) =>
          it.nationCode === "KOR" &&
          it.isEtf &&
          /^[0-9A-Za-z]{6}$/.test(String(it.code ?? "")),
      );
      const usaItems = items.filter(
        (it) => it.nationCode === "USA" && Boolean(it.reutersCode || it.code),
      );
      const hint = usClassHint(key);
      const hinted = hint
        ? usaItems.find((it) => (it.name ?? "").toLowerCase().includes(hint))
        : undefined;
      const us =
        hinted ??
        usaItems[0] ??
        items.find(
          (it) =>
            it.nationCode &&
            it.nationCode !== "KOR" &&
            Boolean(it.reutersCode || it.code),
        );

      const pick = looksKoreanEtfName(key)
        ? korEtf ?? korStock ?? us
        : looksOverseas(key)
          ? us ?? korStock ?? korEtf
          : korStock ?? korEtf ?? us;
      if (!pick) continue;

      const nation = pick.nationCode ?? null;
      const reuters =
        pick.reutersCode ||
        (nation && nation !== "KOR" ? String(pick.code ?? "") : null);
      const krCode =
        nation === "KOR" && /^[0-9A-Za-z]{6}$/.test(String(pick.code ?? ""))
          ? String(pick.code).toUpperCase()
          : null;
      const market: "KOSPI" | "KOSDAQ" | null = krCode
        ? pick.typeCode === "KOSDAQ" || pick.typeName?.includes("코스닥")
          ? "KOSDAQ"
          : "KOSPI"
        : null;
      const hit: NameHit = {
        code: krCode,
        market,
        name: String(pick.name ?? key),
        reutersCode: reuters,
        nation,
        isEtf: Boolean(pick.isEtf) || looksKoreanEtfName(key),
      };
      nameCodeCache.set(key, hit);
      return hit;
    } catch {
      /* try next query */
    }
  }

  if (!signal?.aborted) nameCodeCache.set(key, null);
  return null;
}

/** @deprecated use resolveHoldingName */
export async function resolveStockName(
  nameKo: string,
): Promise<{ code: string; market: "KOSPI" | "KOSDAQ"; name: string } | null> {
  const hit = await resolveHoldingName(nameKo);
  if (!hit?.code) return null;
  return { code: hit.code, market: hit.market ?? "KOSPI", name: hit.name };
}

export async function fetchUsdKrw(): Promise<number> {
  try {
    const j = await getJsonUtf8<{ exchangeInfo?: { closePrice?: string } }>(
      "https://api.stock.naver.com/marketindex/exchange/FX_USDKRW",
    );
    const n = num(j.exchangeInfo?.closePrice);
    if (n > 100) return n;
  } catch {
    /* fallback */
  }
  try {
    const j = await getJsonUtf8<{
      chart?: { result?: { meta?: { regularMarketPrice?: number } }[] };
    }>(
      "https://query1.finance.yahoo.com/v8/finance/chart/USDKRW=X?interval=1d&range=1d",
    );
    const n = j.chart?.result?.[0]?.meta?.regularMarketPrice ?? 0;
    if (n > 100) return n;
  } catch {
    /* ignore */
  }
  return 0;
}

export async function fetchWorldQuotes(
  reutersCodes: string[],
  signal?: AbortSignal,
): Promise<Record<string, HoldingLiveQuote & { name?: string }>> {
  const unique = [...new Set(reutersCodes.filter(Boolean))];
  const out: Record<string, HoldingLiveQuote & { name?: string }> = {};
  for (let i = 0; i < unique.length; i += 6) {
    if (signal?.aborted) break;
    const batch = unique.slice(i, i + 6);
    const parts = await Promise.all(
      batch.map(async (rc) => {
        try {
          const j = await getJsonUtf8<{
            reutersCode?: string;
            closePrice?: string | number;
            compareToPreviousClosePrice?: string | number;
            fluctuationsRatio?: string | number;
            currencyType?: { name?: string; code?: string };
            stockItemTotalInfos?: { code?: string; value?: string }[];
            stockName?: string;
          }>(`https://api.stock.naver.com/stock/${encodeURIComponent(rc)}/basic`, signal);
          const infos = Object.fromEntries(
            (j.stockItemTotalInfos ?? []).map((t) => [t.code ?? "", t.value ?? ""]),
          );
          const price = num(j.closePrice);
          const change = num(j.compareToPreviousClosePrice);
          const changePct = num(j.fluctuationsRatio);
          const volume = num(infos.accumulatedTradingVolume);
          const cur = holdingQuoteCurrency(j.currencyType?.code ?? j.currencyType?.name, rc);
          if (!(price > 0)) return null;
          return {
            rc,
            quote: {
              price,
              change,
              changePct,
              volume,
              currency: cur,
              name: j.stockName,
            },
          };
        } catch {
          return null;
        }
      }),
    );
    for (const p of parts) {
      if (p) out[p.rc] = p.quote;
    }
  }
  return out;
}

const HOLDING_RESOLVE_CAP = 100;
const HOLDINGS_TTL_MS = 90_000;
const holdingsCache = new Map<
  string,
  { at: number; data: Awaited<ReturnType<typeof buildEtfHoldings>> }
>();

type CuRow = {
  nameKo: string;
  weight: number | null;
  quantity: number | null;
  asOf: string | null;
  code: string | null;
  isin: string | null;
};

function classifyRow(input: {
  nameKo: string;
  code: string | null;
  reutersCode: string | null;
  nation: string | null;
  isin: string | null;
  isEtf: boolean;
}): Pick<
  EtfHoldingRow,
  | "isCash"
  | "isBond"
  | "isFuture"
  | "isOverseas"
  | "isKoreanEquity"
  | "isKoreanEtf"
  | "assetClass"
  | "currency"
  | "nation"
> {
  const name = input.nameKo;
  const isin = input.isin;
  const cash = isCashLike(name) || (isin != null && /^KRD01/i.test(isin));
  const brandEtf = looksKoreanEtfName(name) || input.isEtf;
  const fut = !cash && !brandEtf && isFutureLike(name, isin);
  const bond = !cash && !brandEtf && !fut && isBondLike(name, isin);
  const hasKrCode = Boolean(input.code);
  const overseas = Boolean(
    !cash &&
      !bond &&
      !hasKrCode &&
      (input.nation && input.nation !== "KOR"
        ? true
        : looksOverseas(name) || (isin != null && /^(US|JP|HK|GB|CA|DE|FR|XS|LU|IE)/i.test(isin))),
  );
  const krEtf = Boolean(brandEtf && (input.code || !overseas));
  const krEq = Boolean(input.code && !krEtf && !cash && !bond && !fut && !overseas);
  let assetClass: EtfAssetClass = "other";
  if (cash) assetClass = "cash";
  else if (bond) assetClass = "bond";
  else if (fut) assetClass = "future";
  else if (krEtf) assetClass = "kr-etf";
  else if (krEq) assetClass = "kr-equity";
  else if (overseas)
    assetClass =
      input.nation === "USA" || (isin != null && /^US/i.test(isin))
        ? "us-equity"
        : "overseas-equity";
  const nation =
    input.nation ??
    (isin && /^JP/i.test(isin) ? "JPN" : null) ??
    (cash || bond || fut || input.code ? "KOR" : null);
  return {
    isCash: cash,
    isBond: bond,
    isFuture: fut,
    isOverseas: overseas,
    isKoreanEquity: krEq,
    isKoreanEtf: krEtf,
    assetClass,
    currency: overseas ? (nation === "USA" ? "USD" : nation === "JPN" ? "JPY" : null) : "KRW",
    nation,
  };
}

async function fetchWiseReportCu(code: string, signal?: AbortSignal): Promise<{
  rows: CuRow[];
  asOf: string | null;
}> {
  const url = `https://navercomp.wisereport.co.kr/v2/ETF/index.aspx?cmp_cd=${encodeURIComponent(code)}`;
  const text = await getJsonUtf8AsText(url, signal);
  const m = text.match(/var CU_data = (\{[\s\S]*?\});\s*var chartDraw/);
  if (!m) return { rows: [], asOf: null };
  let parsed: {
    grid_data?: {
      TRD_DT?: string;
      AGMT_STK_CNT?: number;
      STK_NM_KOR?: string;
      ETF_WEIGHT?: number | null;
    }[];
  };
  try {
    parsed = JSON.parse(m[1]!);
  } catch {
    return { rows: [], asOf: null };
  }
  const grid = parsed.grid_data ?? [];
  const asOf = formatYmd(grid[0]?.TRD_DT ?? null);
  const rows: CuRow[] = grid
    .map((row) => {
      const nameKo = String(row.STK_NM_KOR ?? "").trim();
      const official = row.ETF_WEIGHT == null ? null : num(row.ETF_WEIGHT);
      return {
        nameKo,
        weight: official,
        quantity: row.AGMT_STK_CNT == null ? null : num(row.AGMT_STK_CNT),
        asOf: formatYmd(row.TRD_DT) ?? asOf,
        code: null,
        isin: null,
      };
    })
    .filter((r) => r.nameKo);
  return { rows, asOf };
}

async function fetchNaverEtfAssetTable(code: string, signal?: AbortSignal): Promise<CuRow[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  let html = "";
  try {
    const res = await fetch(
      `https://finance.naver.com/item/main.naver?code=${encodeURIComponent(code)}`,
      {
        headers: { ...headers(), Accept: "text/html,*/*" },
        signal: signal ? AbortSignal.any([ctrl.signal, signal]) : ctrl.signal,
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    html = buf.toString("utf8");
    if (!html.includes("구성종목")) {
      html = new TextDecoder("euc-kr").decode(buf);
    }
  } finally {
    clearTimeout(t);
  }
  const idx = html.search(/구성종목/);
  if (idx < 0) return [];
  const slice = html.slice(idx, idx + 30_000);
  const rows: CuRow[] = [];
  const re =
    /<td class="ctg">([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td class="per">([\s\S]*?)<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice))) {
    const cell = m[1] ?? "";
    const qtyRaw = (m[2] ?? "").replace(/<[^>]+>/g, "").replace(/,/g, "").trim();
    const wRaw = (m[3] ?? "").replace(/<[^>]+>/g, "").replace(/,/g, "").trim();
    const href = cell.match(/code=([0-9A-Za-z]{6})/);
    const name =
      cell.match(/<a[^>]*>([\s\S]*?)<\/a>/)?.[1]?.replace(/<[^>]+>/g, "").trim() ||
      cell.match(/<span[^>]*>([\s\S]*?)<\/span>/)?.[1]?.replace(/<[^>]+>/g, "").trim() ||
      cell.replace(/<[^>]+>/g, "").trim();
    if (!name) continue;
    const qty = qtyRaw && qtyRaw !== "-" ? num(qtyRaw) : null;
    const hasWeight = wRaw && wRaw !== "-" && /[0-9]/.test(wRaw);
      rows.push({
        nameKo: name,
        code: href ? asKrCode(href[1]) : null,
      quantity: qty,
      weight: hasWeight ? num(wRaw.replace(/%/g, "")) : null,
      asOf: null,
      isin: null,
    });
  }
  return rows;
}

type PlusPdfRow = {
  num?: number;
  wkdate?: string;
  jmCd?: string | null;
  krJmCd?: string | null;
  jmNm?: string;
  amount?: number;
  ratio?: number | null;
};

async function fetchPlusJson<T>(
  url: string,
  init?: RequestInit,
  signal?: AbortSignal,
): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: signal ? AbortSignal.any([ctrl.signal, signal]) : ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "ko-KR,ko;q=0.9",
        Origin: "https://www.plusetf.co.kr",
        Referer: "https://www.plusetf.co.kr/product/overview",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`PLUS HTTP ${res.status}`);
    return JSON.parse(await res.text()) as T;
  } finally {
    clearTimeout(t);
  }
}

async function fetchPlusOfficialHoldings(ticker: string, signal?: AbortSignal): Promise<{
  rows: CuRow[];
  asOf: string | null;
  productId: string;
  name: string;
} | null> {
  const catalog = await fetchPlusJson<{
    content?: {
      id?: string;
      nameCode?: string;
      displayName?: string;
      wkdate?: string;
    }[];
  }>("https://www.plusetf.co.kr/api/v1/product/find/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      searchSortTy: "",
      searchSort: "DESC",
      page: 0,
      searchAnnuityOptionTy: null,
      searchWord: ticker,
    }),
  }, signal);
  const hit = (catalog.content ?? []).find(
    (p) => String(p.nameCode ?? "").toUpperCase() === ticker,
  );
  if (!hit?.id) return null;
  const wkdate = String(hit.wkdate ?? "").replace(/[^\d]/g, "");
  if (!/^\d{8}$/.test(wkdate)) return null;

  const rows: CuRow[] = [];
  let page = 0;
  let asOf = formatYmd(wkdate);
  let completePagination = false;
  for (let guard = 0; guard < 8; guard++) {
    const pack = await fetchPlusJson<{
      content?: PlusPdfRow[];
      last?: boolean;
      totalPages?: number;
    }>(
      `https://www.plusetf.co.kr/api/v1/product/pdf/list?n=${encodeURIComponent(hit.id)}&d=${wkdate}&page=${page}&pageSize=50`,
      {
        headers: {
          Referer: `https://www.plusetf.co.kr/product/detail?n=${hit.id}`,
        },
      },
      signal,
    );
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
        asOf: formatYmd(r.wkdate) ?? asOf,
      });
      if (!asOf) asOf = formatYmd(r.wkdate);
    }
    const totalPages = pack.totalPages;
    if (pack.last === true || (totalPages != null && totalPages > 0 && page + 1 >= totalPages)) {
      completePagination = true;
      break;
    }
    if (!chunk.length) { completePagination = totalPages == null; break; }
    page += 1;
  }
  if (!rows.length || !completePagination) return null;
  return {
    rows,
    asOf,
    productId: hit.id,
    name: String(hit.displayName ?? ""),
  };
}

function finalizeHolding(
  nameKo: string,
  opts: {
    weight: number | null;
    quantity: number | null;
    asOf: string | null;
    code: string | null;
    isin: string | null;
    hit: NameHit | null;
  },
): EtfHoldingRow {
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
    isEtf: Boolean(hit?.isEtf) || looksKoreanEtfName(nameKo),
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
    assetClass: flags.assetClass,
  };
}

async function getJsonReferer<T>(url: string, referer: string, signal?: AbortSignal): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "ko-KR,ko;q=0.9",
        Referer: referer,
      },
      signal: signal ? AbortSignal.any([ctrl.signal, signal]) : ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return JSON.parse(await res.text()) as T;
  } finally {
    clearTimeout(t);
  }
}

async function fetchEtfIdentity(code: string, signal?: AbortSignal): Promise<{ name: string; issuer: string }> {
  try {
    const snapshot = findUploadedIssuerHoldingsSnapshot(code);
    const integ = await getJsonUtf8<{
      stockName?: string;
      etfKeyIndicator?: { issuerName?: string };
    }>(`https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/integration`, signal);
    return {
      name: String(integ.stockName ?? snapshot?.fundName ?? "").trim(),
      issuer: String(integ.etfKeyIndicator?.issuerName ?? snapshot?.issuerName ?? "").trim(),
    };
  } catch {
    const snapshot = findUploadedIssuerHoldingsSnapshot(code);
    return { name: snapshot?.fundName ?? "", issuer: snapshot?.issuerName ?? "" };
  }
}

async function fetchIbkOfficialHoldings(etfName: string, signal?: AbortSignal): Promise<{
  rows: CuRow[];
  asOf: string | null;
  issuerUrl: string;
} | null> {
  const catalog = await getJsonUtf8<{
    data?: { content?: { id: number; name: string }[]; baseDate?: string };
  }>("https://www.ibkasset.com/api/etf", signal);
  const id = matchIbkProductId(etfName, catalog.data?.content ?? []);
  if (id == null) return null;
  const matched = catalog.data?.content?.find((item) => item.id === id);
  if (!matched || normalizeIssuerFundName(matched.name) !== normalizeIssuerFundName(etfName)) return null;
  const pdf = await getJsonUtf8<{
    data?: { baseDate?: string; content?: IbkPdfItem[]; totalElements?: number; totalPages?: number; last?: boolean };
  }>(`https://www.ibkasset.com/api/etf/${id}/pdf?page=0&size=200`, signal);
  const content = pdf.data?.content ?? [];
  if (pdf.data?.last === false || (pdf.data?.totalPages ?? 1) > 1 || (pdf.data?.totalElements ?? content.length) > content.length) return null;
  const asOf = pdf.data?.baseDate ?? catalog.data?.baseDate ?? null;
  const rows = parseIbkPdfRows(pdf.data?.content ?? [], asOf);
  if (!rows.length) return null;
  return {
    rows,
    asOf,
    issuerUrl: `https://www.ibkasset.com/etf/detail/${id}`,
  };
}

const hanaroCatalogCache: { at: number; map: Map<string, string> } = {
  at: 0,
  map: new Map(),
};
const HANARO_CATALOG_TTL_MS = 6 * 60 * 60_000;

async function fetchHanaroText(url: string, referer: string, signal?: AbortSignal): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,*/*",
        Referer: referer,
      },
      signal: signal ? AbortSignal.any([ctrl.signal, signal]) : ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } finally {
    clearTimeout(t);
  }
}

async function hanaroFundUid(ticker: string, signal?: AbortSignal): Promise<string | null> {
  const now = Date.now();
  if (hanaroCatalogCache.map.size > 0 && now - hanaroCatalogCache.at < HANARO_CATALOG_TTL_MS) {
    return hanaroCatalogCache.map.get(ticker) ?? null;
  }
  const map = new Map<string, string>();
  for (let page = 1; page <= 12; page++) {
    const html = await fetchHanaroText(
      `https://www.hanaroetf.com/api/v1/fund/get-fund-search-list?pageNo=${page}`,
      "https://www.hanaroetf.com/fund/fund-list", signal,
    );
    const chunk = parseHanaroFundCatalog(html);
    if (chunk.size === 0) break;
    for (const [code, uid] of chunk) map.set(code, uid);
    if (chunk.size < 10) break;
  }
  if (map.size === 0) return null;
  hanaroCatalogCache.at = now;
  hanaroCatalogCache.map = map;
  return map.get(ticker) ?? null;
}

async function fetchHanaroOfficialHoldings(ticker: string, signal?: AbortSignal): Promise<{
  rows: CuRow[];
  asOf: string | null;
  issuerUrl: string;
} | null> {
  const uid = await hanaroFundUid(ticker, signal);
  if (!uid) return null;
  const pageUrl = `https://www.hanaroetf.com/fund/${encodeURIComponent(uid)}`;
  const [listHtml, pageHtml] = await Promise.all([
    fetchHanaroText(
      `https://www.hanaroetf.com/api/v1/fund/${encodeURIComponent(uid)}/get-fund-holdings-list?baseDate=`,
      pageUrl, signal,
    ),
    fetchHanaroText(pageUrl, "https://www.hanaroetf.com/fund/fund-list", signal).catch(() => ""),
  ]);
  const asOf = parseHanaroPdfDate(pageHtml);
  const rows = parseHanaroHoldingsHtml(listHtml, asOf);
  if (!rows.length) return null;
  return { rows, asOf, issuerUrl: pageUrl };
}

const kodexCatalogCache: { at: number; map: Map<string, string> } = {
  at: 0,
  map: new Map(),
};
const KODEX_CATALOG_TTL_MS = 6 * 60 * 60_000;

async function kodexFundId(ticker: string, signal?: AbortSignal): Promise<string | null> {
  const now = Date.now();
  if (kodexCatalogCache.map.size > 0 && now - kodexCatalogCache.at < KODEX_CATALOG_TTL_MS) {
    return kodexCatalogCache.map.get(ticker) ?? null;
  }
  const pageUrl = (page: number) =>
    `https://www.samsungfund.com/api/v1/kodex/product.do?ordrColm=NAV&ordrSort=DESC&pageNo=${page}&pageRows=20&srchTerm=w`;
  const first = await getJsonReferer<KodexListItem[]>(
    pageUrl(1),
    "https://www.samsungfund.com/etf/main.do", signal,
  );
  const total = Number(first[0]?.totalCnt ?? first.length) || first.length;
  const pages = Math.min(20, Math.max(1, Math.ceil(total / 20)));
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      getJsonReferer<KodexListItem[]>(pageUrl(i + 2), "https://www.samsungfund.com/etf/main.do", signal).catch(
        () => [] as KodexListItem[],
      ),
    ),
  );
  const map = new Map<string, string>();
  for (const row of first.concat(...rest)) {
    const code = String(row.stkTicker ?? "").trim().toUpperCase();
    const fid = String(row.fId ?? "").trim();
    if (code && fid) map.set(code, fid);
  }
  kodexCatalogCache.at = now;
  kodexCatalogCache.map = map;
  return map.get(ticker) ?? null;
}

type KodexListItem = { stkTicker?: string; fId?: string; totalCnt?: string };

async function fetchKodexOfficialHoldings(ticker: string, signal?: AbortSignal): Promise<{
  rows: CuRow[];
  asOf: string | null;
  issuerUrl: string;
} | null> {
  const fid = await kodexFundId(ticker, signal);
  if (!fid) return null;
  const pack = await getJsonReferer<{
    pdf?: { gijunYMD?: string; list?: KodexPdfItem[] };
  }>(
    `https://www.samsungfund.com/api/v1/kodex/product/${encodeURIComponent(fid)}.do`,
    `https://www.samsungfund.com/etf/product/view.do?id=${encodeURIComponent(fid)}`, signal,
  );
  const asOf = formatYmd(pack.pdf?.gijunYMD ?? null);
  const rows = parseKodexPdfRows(pack.pdf?.list ?? [], asOf);
  if (!rows.length) return null;
  return {
    rows,
    asOf,
    issuerUrl: `https://www.samsungfund.com/etf/product/view.do?id=${encodeURIComponent(fid)}`,
  };
}

type HoldingsBundle = {
  holdings: EtfHoldingRow[];
  asOf: string | null;
  source: string;
  sourceKind: "issuer-pdf" | "issuer-file" | "wisereport-cu" | "naver-table" | "none";
  officialCount: number;
  issuerUrl: string | null;
  issuerProductUrl: string | null;
};

async function buildEtfHoldings(code: string): Promise<HoldingsBundle> {
  const c = normalizeEtfCode(code);
  const snapshot = findUploadedIssuerHoldingsSnapshot(c);
  const wiseP = withEtfDeadline((signal) => fetchWiseReportCu(c, signal), { rows: [] as CuRow[], asOf: null as string | null });
  const naverP = withEtfDeadline((signal) => fetchNaverEtfAssetTable(c, signal), [] as CuRow[]);
  const identity = snapshot ? { name: snapshot.fundName, issuer: snapshot.issuerName }
    : await withEtfDeadline((signal) => fetchEtfIdentity(c, signal), { name: "", issuer: "" });
  const family = issuerHoldingsFamily(identity.name, identity.issuer);
  const fallbackProduct = { ...etfIssuerIdentity(identity.name, identity.issuer), issuerUrl: null,
    status: "unresolved" as const, reason: "Official issuer lookup unavailable" };
  const [wisePack, naverRows, plusPack, ibkPack, kodexPack, hanaroPack, solPack, issuerProduct] = await Promise.all([
    wiseP, naverP,
    family === "plus" ? withEtfDeadline((signal) => fetchPlusOfficialHoldings(c, signal), null, 10_000) : null,
    family === "ibk" ? withEtfDeadline((signal) => fetchIbkOfficialHoldings(identity.name, signal), null, 10_000) : null,
    family === "kodex" ? withEtfDeadline((signal) => fetchKodexOfficialHoldings(c, signal), null, 10_000) : null,
    family === "hanaro" ? withEtfDeadline((signal) => fetchHanaroOfficialHoldings(c, signal), null, 10_000) : null,
    family === "sol" ? withEtfDeadline((signal) => fetchSolOfficialHoldings(c, { signal }), null, 10_000) : null,
    withEtfDeadline((signal) => resolveEtfIssuer(c, identity.name, identity.issuer, { signal }), fallbackProduct, 10_000),
  ]);

  const pagePack = family === "other" && issuerProduct.issuerUrl
    ? await withEtfDeadline((signal) => fetchIssuerPageHoldings(c, identity.name, issuerProduct, { signal }), null, 10_000) : null;
  const chosen = chooseOfficialBasket([
    ...(pagePack ? [{ rows: pagePack.rows,
      source: `${issuerProduct.issuerName} 공식 구성종목 (${pagePack.asOf})`,
      sourceKind: "issuer-pdf" as const, priority: 100,
      issuerUrl: pagePack.issuerUrl, asOf: pagePack.asOf }] : []),
    ...(solPack ? [{ rows: solPack.rows, source: solPack.source,
      sourceKind: "issuer-pdf" as const, priority: 100,
      issuerUrl: solPack.issuerUrl, asOf: solPack.asOf }] : []),
    ...(snapshot ? [{ rows: snapshot.rows, source: snapshot.source,
      sourceKind: "issuer-file" as const, priority: 80,
      issuerUrl: snapshot.issuerUrl, asOf: snapshot.asOf }] : []),
    ...(kodexPack
      ? [
          {
            rows: kodexPack.rows,
            source: `삼성자산운용 KODEX 일별 PDF (${kodexPack.asOf ?? "기준일 확인"})`,
            sourceKind: "issuer-pdf" as const,
            priority: 100,
            issuerUrl: kodexPack.issuerUrl,
            asOf: kodexPack.asOf,
          },
        ]
      : []),
    ...(hanaroPack
      ? [
          {
            rows: hanaroPack.rows,
            source: `NH-Amundi HANARO 일별 PDF (${hanaroPack.asOf ?? "기준일 확인"})`,
            sourceKind: "issuer-pdf" as const,
            priority: 100,
            issuerUrl: hanaroPack.issuerUrl,
            asOf: hanaroPack.asOf,
          },
        ]
      : []),
    ...(ibkPack
      ? [
          {
            rows: ibkPack.rows,
            source: `IBK자산운용 일별 PDF (${ibkPack.asOf ?? "기준일 확인"})`,
            sourceKind: "issuer-pdf" as const,
            priority: 100,
            issuerUrl: ibkPack.issuerUrl,
            asOf: ibkPack.asOf,
          },
        ]
      : []),
    ...(plusPack
      ? [
          {
            rows: plusPack.rows,
            source: `한화자산운용 PLUS 일별 구성종목 PDF (${plusPack.asOf ?? "기준일 확인"})`,
            sourceKind: "issuer-pdf" as const,
            priority: 90,
            issuerUrl: `https://www.plusetf.co.kr/product/detail?n=${encodeURIComponent(plusPack.productId)}`,
            asOf: plusPack.asOf,
          },
        ]
      : []),
    {
      rows: wisePack.rows,
      source: `WiseReport CU 공시 (KRX/운용사, ${wisePack.asOf ?? "기준일 확인"})`,
      sourceKind: "wisereport-cu" as const,
      priority: 50,
      asOf: wisePack.asOf,
    },
    {
      rows: naverRows,
      source: "Naver Finance 구성종목 테이블",
      sourceKind: "naver-table" as const,
      priority: 10,
      asOf: naverRows.find((r) => r.asOf)?.asOf ?? null,
    },
  ]);

  const asOf = chosen.asOf;
  const rankedIdx = chosen.rows
    .map((row, idx) => ({
      idx,
      w: row.weight ?? -1,
      qty: Math.abs(row.quantity ?? 0),
      needs:
        !row.code &&
        !isCashLike(row.nameKo) &&
        !isBondLike(row.nameKo, row.isin) &&
        !isFutureLike(row.nameKo, row.isin),
    }))
    .sort((a, b) => b.w - a.w || b.qty - a.qty);
  const resolveIdx = new Set(
    rankedIdx.filter((r) => r.needs).slice(0, HOLDING_RESOLVE_CAP).map((r) => r.idx),
  );

  const holdings: EtfHoldingRow[] = [];
  const resolutionDeadline = Date.now() + 1_500;
  for (let i = 0; i < chosen.rows.length; i += 8) {
    const batch = chosen.rows.slice(i, i + 8);
    const resolved = await Promise.all(
      batch.map(async (row, j) => {
        const idx = i + j;
        let hit: NameHit | null = null;
        if (resolveIdx.has(idx) && Date.now() < resolutionDeadline) {
          hit = await withEtfDeadline((signal) => resolveHoldingName(row.nameKo, signal), null, Math.max(1, resolutionDeadline - Date.now()));
        } else if (row.code && looksKoreanEtfName(row.nameKo)) {
          hit = {
            code: row.code,
            market: "KOSPI",
            name: row.nameKo,
            reutersCode: null,
            nation: "KOR",
            isEtf: true,
          };
        }
        return finalizeHolding(row.nameKo, {
          weight: chosen.weightsPublished ? row.weight : null,
          quantity: row.quantity,
          asOf: row.asOf ?? asOf,
          code: row.code,
          isin: row.isin,
          hit,
        });
      }),
    );
    holdings.push(...resolved);
  }

  holdings.sort(compareHoldingsByWeight);

  return {
    holdings,
    asOf,
    source: chosen.source,
    sourceKind: chosen.sourceKind,
    officialCount: holdings.filter((h) => h.weightSource === "official").length,
    issuerUrl: chosen.issuerUrl,
    issuerProductUrl: chosen.issuerUrl ?? issuerProduct.issuerUrl,
  };
}

export async function fetchEtfHoldings(code: string): Promise<HoldingsBundle> {
  const c = normalizeEtfCode(code);
  const now = Date.now();
  const hit = holdingsCache.get(c);
  if (hit && now - hit.at < HOLDINGS_TTL_MS) return hit.data;
  const data = await buildEtfHoldings(c);
  holdingsCache.set(c, { at: now, data });
  return data;
}

async function getJsonUtf8AsText(url: string, signal?: AbortSignal): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Referer: "https://finance.naver.com/",
        Accept: "text/html,*/*",
      },
      signal: signal ? AbortSignal.any([ctrl.signal, signal]) : ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } finally {
    clearTimeout(t);
  }
}
