/**
 * Robotics classification helpers (F6): topic classifier, policy status chips
 * (only from keywords present in the source text), Federal Register relevance
 * filter and mapper, robot ETF discovery, basket statistics. Pure module.
 */
import { parseSourceTime } from "../feed/time.ts";
import { canonicalizeUrl, clampSnippet, stripHtml } from "../feed/text.ts";
import type { FeedItem } from "../feed/types.ts";

export const ROBOT_TOPICS: { id: string; label: string; re: RegExp }[] = [
  { id: "humanoid", label: "휴머노이드", re: /휴머노이드|humanoid|옵티머스|optimus|figure ai|agility|apptronik|boston dynamics|\b1x\b/i },
  { id: "industrial", label: "산업용", re: /산업용\s*로봇|industrial robot|용접\s*로봇|스마트\s*팩토리|factory automation|robot orders/i },
  { id: "cobot", label: "협동로봇", re: /협동\s*로봇|cobot|collaborative robot|universal robots/i },
  { id: "logistics", label: "물류·AMR", re: /물류\s*로봇|AMR|AGV|자율주행\s*로봇|warehouse robot|logistics robot|mobile robot/i },
  { id: "surgical", label: "의료·수술", re: /수술\s*로봇|surgical|의료\s*로봇|웨어러블\s*로봇|exoskeleton|da vinci/i },
  { id: "components", label: "부품", re: /감속기|액추에이터|서보|모션\s*제어|reducer|actuator|servo|gripper|그리퍼|센서/i },
  { id: "funding-ma", label: "투자·M&A", re: /투자\s*유치|시리즈\s*[A-F]|펀딩|인수|합병|funding|raises|series [a-f]|acquir|merger|valuation|IPO|상장/i },
  { id: "statistics", label: "통계", re: /통계|출하|판매량|설치\s*대수|IFR|World Robotics|shipments|installations|orders rose|orders fell/i },
];

export function robotTopicsOf(text: string): string[] {
  return ROBOT_TOPICS.filter((t) => t.re.test(text)).map((t) => t.id);
}

export type PolicyStatus = "announced" | "proposed" | "effective" | "review" | "other";

export const POLICY_STATUS_LABEL: Record<PolicyStatus, string> = {
  announced: "발표",
  proposed: "입법예고",
  effective: "시행",
  review: "조사/검토",
  other: "기타",
};

const STATUS_RULES: { status: PolicyStatus; re: RegExp }[] = [
  { status: "effective", re: /시행|발효|effective (date|on|immediately)|takes effect|went into effect|final rule/i },
  { status: "proposed", re: /입법\s*예고|법안\s*발의|개정안\s*(발의|예고)|proposed rule|notice of proposed|NPRM|bill introduced|introduces bill/i },
  { status: "review", re: /조사|검토|의견\s*수렴|investigation|Section 232|request for (comment|information)|RFI|inquiry|review/i },
  { status: "announced", re: /발표|공개|추진|계획|전략|announce|unveil|executive order|strategy|plan\b/i },
];

/**
 * Status chips set ONLY from keywords present in the source text (AT-27).
 * Returns every status whose keyword appears; `other` when none does.
 */
export function policyStatusesOf(text: string): PolicyStatus[] {
  const hits = STATUS_RULES.filter((r) => r.re.test(text)).map((r) => r.status);
  return hits.length ? hits : ["other"];
}

export const FEDERAL_REGISTER_TERMS = ["robot", "robotic", "robotics", "humanoid", "industrial machinery"];
const FR_RELEVANT = /\brobot(s|ic|ics)?\b|\bhumanoid\b|industrial machinery|section 232/i;
const FR_EXCLUDE = /premerger|early termination|hart-scott-rodino|\bHSR\b/i;

export interface FederalRegisterDoc {
  document_number?: string;
  title?: string;
  abstract?: string | null;
  html_url?: string;
  pdf_url?: string;
  publication_date?: string;
  type?: string;
  agencies?: { name?: string; raw_name?: string }[];
}

/** Relevance filter (AT-26): term in title/abstract; premerger / early termination dropped. */
export function federalRegisterRelevant(doc: FederalRegisterDoc): boolean {
  const text = `${doc.title ?? ""} ${doc.abstract ?? ""}`;
  if (FR_EXCLUDE.test(text)) return false;
  return FR_RELEVANT.test(text);
}

export function federalRegisterToItem(doc: FederalRegisterDoc, fetchedAt: string): FeedItem | null {
  const url = canonicalizeUrl(doc.html_url);
  const title = stripHtml(doc.title);
  if (!url || !title || !federalRegisterRelevant(doc)) return null;
  const t = parseSourceTime(doc.publication_date, { zone: "America/New_York" });
  const agencies = (doc.agencies ?? []).map((a) => a.name ?? a.raw_name ?? "").filter(Boolean);
  const type = doc.type ? stripHtml(doc.type) : "Document";
  return {
    id: `federal-register:${doc.document_number ?? url}`,
    kind: "policy",
    region: "US",
    sourceId: "federal-register",
    sourceName: "Federal Register",
    sourceTier: 1,
    outlet: [type, ...agencies.slice(0, 2)].join(" · "),
    title,
    snippet: clampSnippet(doc.abstract),
    url,
    pdfUrl: canonicalizeUrl(doc.pdf_url) ?? undefined,
    publishedAt: t.iso,
    precision: t.precision,
    fetchedAt,
    tickers: [],
    sectors: ["robotics"],
    topics: ["policy", "robotics", ...policyStatusesOf(`${title} ${doc.abstract ?? ""} ${type}`).map((s) => `status:${s}`)],
    lang: "en",
  };
}

export function federalRegisterUrl(perPage = 20): string {
  const params = new URLSearchParams({ per_page: String(perPage), order: "newest" });
  for (const term of FEDERAL_REGISTER_TERMS) params.append("conditions[term]", term);
  return `https://www.federalregister.gov/api/v1/documents.json?${params}`;
}

/** Robot ETF discovery over the live ETF list (AT-24). */
export function discoverRobotEtfs<T extends { nameKo: string }>(etfs: readonly T[], re: RegExp): T[] {
  return etfs.filter((e) => re.test(e.nameKo));
}

/** Equal-weight average of 1D % over quotes that exist (null when none). */
export function equalWeightChange(values: readonly (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!xs.length) return null;
  return Math.round((xs.reduce((s, v) => s + v, 0) / xs.length) * 100) / 100;
}

/** Position of price inside the 52-week range, 0–100 (null when any input is missing). */
export function position52w(price: number | null | undefined, low: number | null | undefined, high: number | null | undefined): number | null {
  if (price == null || low == null || high == null || !(high > low) || price <= 0) return null;
  return Math.max(0, Math.min(100, Math.round(((price - low) / (high - low)) * 100)));
}

/** KR policy queries (F6.4) and robot trend queries (F6.3). */
export const ROBOT_GN_KR_MARKET = ["로봇 산업", "휴머노이드", "협동로봇", "물류로봇"];
export const ROBOT_GN_EN_MARKET = ["humanoid robot", "robotics industry", "industrial robot orders", "robot startup funding"];
export const ROBOT_GN_KR_POLICY = ["로봇 정책", "휴머노이드 정부", "지능형 로봇법", "로봇 규제 샌드박스", "산업통상부 로봇"];
export const ROBOT_GN_EN_POLICY = ["robotics executive order", "Section 232 robotics", "national robotics strategy"];

const KR_POLICY_RE = /정책|정부|법안|개정안|입법|규제|샌드박스|지원\s*사업|예산|산업통상|산업부|과기정통부|과학기술정보통신부|국회|시행령|고시|국가\s*전략|로드맵|특별법|로봇법/;
const EN_POLICY_RE = /executive order|legislation|\bbill\b|congress|senate|federal register|regulation|regulatory|tariff|section 232|national (robotics )?strategy|department of commerce|white house|policy/i;

/** Policy-relevant robot story (used to pull 로봇신문 items into the policy tab). */
export function isRobotPolicyText(text: string): boolean {
  return KR_POLICY_RE.test(text) || EN_POLICY_RE.test(text);
}

/** `robot:*` topic ids for an item (F6.3 classifier). */
export function robotTopicIds(text: string): string[] {
  return robotTopicsOf(text).map((id) => `robot:${id}`);
}

/** `status:*` topic ids (F6.4 chips) — keyword presence only. */
export function policyStatusTopicIds(text: string): string[] {
  return policyStatusesOf(text).map((s) => `status:${s}`);
}

/** Company name normalization for exact name resolution (spaces, (주)/㈜ removed, upper-case). */
export function normalizeCompanyName(name: string): string {
  return name.replace(/\(주\)|㈜|주식회사/g, "").replace(/\s+/g, "").toUpperCase();
}

/**
 * Exact-name listing pick from security-search hits (F6.1 candidates):
 * same normalized name, not an ETF, 6-char KR code. Never guesses.
 */
export function pickExactListing<T extends { code: string; nameKo: string; isEtf?: boolean }>(name: string, hits: readonly T[]): T | null {
  const want = normalizeCompanyName(name);
  return hits.find((h) => !h.isEtf && /^[0-9][0-9A-Z]{5}$/.test(h.code) && normalizeCompanyName(h.nameKo) === want) ?? null;
}

export function roboticsKey(market: "KR" | "US", code: string): string {
  return `${market}:${code.toUpperCase()}`;
}

/** Top gainers / losers among rows with a finite 1D %. */
export function topMovers<T extends { changePct: number | null }>(rows: readonly T[], n = 3): { up: T[]; down: T[] } {
  const xs = rows.filter((r) => typeof r.changePct === "number" && Number.isFinite(r.changePct));
  const up = xs.filter((r) => (r.changePct as number) > 0).sort((a, b) => (b.changePct as number) - (a.changePct as number)).slice(0, n);
  const down = xs.filter((r) => (r.changePct as number) < 0).sort((a, b) => (a.changePct as number) - (b.changePct as number)).slice(0, n);
  return { up, down };
}

/** Count items whose publish time falls within the last `hours` (undated excluded). */
export function countWithin(items: readonly { publishedAt: string | null }[], now: number, hours: number): number {
  const from = now - hours * 3_600_000;
  return items.filter((it) => {
    const t = it.publishedAt ? Date.parse(it.publishedAt) : NaN;
    return Number.isFinite(t) && t >= from && t <= now + 3_600_000;
  }).length;
}
