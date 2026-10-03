/**
 * KR ETF news classification (F5): listing stage, theme, issuer, story filter,
 * and longest-name ETF matching. Pure module (ETF list passed in).
 */
import type { FeedEtfMatch } from "./feed/types.ts";

export type EtfStage = "listed" | "scheduled" | "delisting" | "flow" | "retirement" | "other";

export const ETF_STAGE_LABEL: Record<EtfStage, string> = {
  listed: "신규상장",
  scheduled: "상장예정",
  delisting: "상장폐지",
  flow: "자금흐름",
  retirement: "퇴직연금",
  other: "기타",
};

/** Listing stage from the headline (keeps the original listed/scheduled rules). */
export function etfStageOf(title: string): EtfStage {
  const t = title.replace(/\s+/g, " ");
  if (/상장\s*폐지|상장폐지|청산|해지\s*예정/.test(t)) return "delisting";
  if (/상장\s*예정|상장예고|예고|다음주 상장|금주 상장|\d+일 상장|일 상장 예정/.test(t)) return "scheduled";
  if (/신규\s*상장|상장했|상장한|유가증권시장 상장|신규상장|상장\s*첫날/.test(t)) return "listed";
  if (/퇴직연금|IRP|DC형|DB형|연금저축|디폴트옵션/.test(t)) return "retirement";
  if (/순자산|자금\s*(유입|유출)|순유입|순유출|몰렸|개인\s*순매수|설정액/.test(t)) return "flow";
  return "other";
}

export const ETF_THEMES: { id: string; label: string; re: RegExp }[] = [
  { id: "covered-call", label: "커버드콜", re: /커버드\s*콜|covered\s*call/i },
  { id: "monthly-dividend", label: "월배당", re: /월\s*배당|월분배/ },
  { id: "robot-ai", label: "로봇·AI", re: /로봇|휴머노이드|로보틱스|AI|인공지능|robot/i },
  { id: "semis", label: "반도체", re: /반도체|HBM|필라델피아/ },
  { id: "us", label: "미국", re: /미국|S&P|나스닥|NASDAQ|다우/i },
  { id: "bond", label: "채권·금리", re: /채권|국채|회사채|금리|CD|KOFR|머니마켓/ },
  { id: "dividend", label: "배당", re: /고배당|배당성장|배당주/ },
  { id: "battery", label: "2차전지", re: /2차전지|이차전지|배터리/ },
  { id: "defense-ship", label: "방산·조선", re: /방산|조선|K-방산/ },
  { id: "gold", label: "금·원자재", re: /금현물|골드|원자재|은\s*ETF/ },
];

export function etfThemesOf(title: string): string[] {
  return ETF_THEMES.filter((t) => t.re.test(title)).map((t) => t.id);
}

export const ETF_ISSUER_BRANDS: { brand: string; issuer: string }[] = [
  { brand: "KODEX", issuer: "삼성자산운용" },
  { brand: "TIGER", issuer: "미래에셋자산운용" },
  { brand: "ACE", issuer: "한국투자신탁운용" },
  { brand: "RISE", issuer: "KB자산운용" },
  { brand: "SOL", issuer: "신한자산운용" },
  { brand: "PLUS", issuer: "한화자산운용" },
  { brand: "KIWOOM", issuer: "키움투자자산운용" },
  { brand: "HANARO", issuer: "NH-Amundi자산운용" },
  { brand: "KoAct", issuer: "삼성액티브자산운용" },
  { brand: "TIME", issuer: "타임폴리오자산운용" },
];

/** Brand mentioned in the headline (word-boundary, case-sensitive brand tokens). */
export function etfBrandOf(title: string): string | null {
  for (const b of ETF_ISSUER_BRANDS) {
    const re = new RegExp(`(^|[^A-Za-z])${b.brand}([^A-Za-z]|$)`);
    if (re.test(title)) return b.brand;
  }
  return null;
}

/** ETF-related headline? (stricter than a bare brand mention.) */
export function isEtfStory(title: string): boolean {
  const t = title.replace(/\s+/g, " ");
  if (/ETF|상장지수|ETN/i.test(t)) return true;
  return etfBrandOf(t) != null && /상장|순자산|분배|수익률|운용/.test(t);
}

export interface EtfLike {
  code: string;
  nameKo: string;
}

/** Longest ETF name contained in the headline (spaces ignored; names < 4 chars skipped). */
export function matchEtf<T extends EtfLike>(title: string, etfs: readonly T[]): T | undefined {
  const compact = title.replace(/\s+/g, "");
  let best: T | undefined;
  let bestLen = 0;
  for (const e of etfs) {
    const name = e.nameKo.replace(/\s+/g, "");
    if (name.length < 4) continue;
    if (compact.includes(name) && name.length > bestLen) {
      best = e;
      bestLen = name.length;
    }
  }
  return best;
}

/** GN queries (F5.1): topic queries + one per issuer brand. */
export const ETF_TOPIC_QUERIES = ["ETF 신규 상장", "ETF 상장예정", "ETF 상장폐지", "ETF 순자산", "ETF 자금 유입", "월배당 ETF", "커버드콜 ETF", "퇴직연금 ETF"];
export const ETF_BRAND_QUERIES = ETF_ISSUER_BRANDS.map((b) => `${b.brand} ETF`);

/** Issuer from the ETF name's brand prefix (e.g. "TIGER 미국S&P500" → 미래에셋자산운용). */
export function issuerOfEtfName(name: string): string | null {
  const head = name.trim().split(/\s+/)[0] ?? "";
  const hit = ETF_ISSUER_BRANDS.find((b) => head.toUpperCase() === b.brand.toUpperCase());
  return hit ? hit.issuer : null;
}

export function brandOfEtfName(name: string): string | null {
  const head = name.trim().split(/\s+/)[0] ?? "";
  const hit = ETF_ISSUER_BRANDS.find((b) => head.toUpperCase() === b.brand.toUpperCase());
  return hit ? hit.brand : null;
}

/** Topic ids stamped on an ETF story: `etf`, `stage:*`, `theme:*`, `brand:*`. */
export function etfTopicsOf(title: string, matchedName?: string | null): string[] {
  const out = ["etf", `stage:${etfStageOf(title)}`];
  for (const t of etfThemesOf(`${title} ${matchedName ?? ""}`)) out.push(`theme:${t}`);
  const brand = etfBrandOf(title) ?? (matchedName ? brandOfEtfName(matchedName) : null);
  if (brand) out.push(`brand:${brand}`);
  return out;
}

export interface EtfRowLike extends EtfLike {
  price: number;
  changePct: number;
  volume: number;
  /** trading value (KRW, as provided by the list) */
  amount?: number;
  /** 시가총액 (억) */
  marketSum: number;
  issuer?: string;
  retirementEligible?: boolean;
}

export type EtfMatchInfo = FeedEtfMatch;

const pos = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

export function etfMatchInfo(row: EtfRowLike): EtfMatchInfo {
  return {
    code: row.code,
    name: row.nameKo,
    price: pos(row.price),
    changePct: typeof row.changePct === "number" && Number.isFinite(row.changePct) ? row.changePct : null,
    volume: pos(row.volume),
    marketSum: pos(row.marketSum),
    issuer: row.issuer ?? issuerOfEtfName(row.nameKo),
    retirementEligible: typeof row.retirementEligible === "boolean" ? row.retirementEligible : null,
  };
}

interface EtfStoryLike {
  title: string;
  topics: string[];
  etf?: EtfMatchInfo;
}

/**
 * Keep ETF stories only, stamp stage/theme/brand topics and attach the
 * longest-name ETF match (F5.1/F5.2). Returns null for non-ETF headlines.
 */
export function enrichEtfStory<T extends EtfStoryLike>(item: T, etfs: readonly EtfRowLike[]): T | null {
  if (!isEtfStory(item.title)) return null;
  const hit = matchEtf(item.title, etfs);
  const topics = new Set(item.topics.filter((t) => t !== "etf" && !t.startsWith("stage:") && !t.startsWith("theme:") && !t.startsWith("brand:")));
  for (const t of etfTopicsOf(item.title, hit?.nameKo)) topics.add(t);
  return { ...item, topics: [...topics], etf: hit ? etfMatchInfo(hit) : undefined };
}

export interface EtfNewsFilter {
  issuers: string[];
  stages: EtfStage[];
  themes: string[];
  retirementOnly: boolean;
}

export const EMPTY_ETF_FILTER: EtfNewsFilter = { issuers: [], stages: [], themes: [], retirementOnly: false };

/** Issuer (brand), stage, theme and retirement-eligible filters (F5.4). Order preserved. */
export function applyEtfNewsFilter<T extends EtfStoryLike>(items: readonly T[], f: EtfNewsFilter): T[] {
  const brands = new Set(f.issuers);
  const stages = new Set(f.stages);
  const themes = new Set(f.themes);
  return items.filter((it) => {
    if (brands.size) {
      const b = it.topics.find((t) => t.startsWith("brand:"))?.slice(6) ?? (it.etf ? brandOfEtfName(it.etf.name) : null);
      if (!b || !brands.has(b)) return false;
    }
    if (stages.size) {
      const s = (it.topics.find((t) => t.startsWith("stage:"))?.slice(6) ?? "other") as EtfStage;
      if (!stages.has(s)) return false;
    }
    if (themes.size && !it.topics.some((t) => t.startsWith("theme:") && themes.has(t.slice(6)))) return false;
    if (f.retirementOnly && it.etf?.retirementEligible !== true) return false;
    return true;
  });
}

interface TimedStory extends EtfStoryLike {
  id: string;
  publishedAt: string | null;
}

export interface EtfBriefing<T> {
  listing: T[];
  delisting: T[];
  flow: T[];
  retirement: T[];
  topTrading: EtfRowLike[];
  robotAi: EtfRowLike[];
}

const DAY = 86_400_000;

function stageOfItem(it: EtfStoryLike): EtfStage {
  return (it.topics.find((t) => t.startsWith("stage:"))?.slice(6) ?? "other") as EtfStage;
}

/**
 * F5.3 briefing sections from items already sorted newest first. Windows are
 * by publish time: listing/scheduled 14 d, delisting 30 d, flow 7 d,
 * retirement 14 d. Undated items are excluded (no fake recency).
 */
export function buildEtfBriefing<T extends TimedStory>(items: readonly T[], etfs: readonly EtfRowLike[], now: number, per = 5): EtfBriefing<T> {
  const within = (it: T, days: number) => {
    const t = it.publishedAt ? Date.parse(it.publishedAt) : NaN;
    return Number.isFinite(t) && now - t <= days * DAY && t - now <= DAY;
  };
  const pick = (pred: (it: T) => boolean) => items.filter(pred).slice(0, per);
  const robotAiRe = /로봇|휴머노이드|로보틱스|robot|humanoid|AI|인공지능/i;
  return {
    listing: pick((it) => (stageOfItem(it) === "listed" || stageOfItem(it) === "scheduled") && within(it, 14)),
    delisting: pick((it) => stageOfItem(it) === "delisting" && within(it, 30)),
    flow: pick((it) => stageOfItem(it) === "flow" && within(it, 7)),
    retirement: pick((it) => stageOfItem(it) === "retirement" && within(it, 14)),
    topTrading: [...etfs].filter((e) => (e.amount ?? 0) > 0).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).slice(0, 8),
    robotAi: etfs.filter((e) => robotAiRe.test(e.nameKo)).sort((a, b) => b.marketSum - a.marketSum).slice(0, 10),
  };
}
