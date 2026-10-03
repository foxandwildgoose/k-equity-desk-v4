/**
 * Canonical feed item model (B0.1). Every news, research, disclosure, filing,
 * policy, rating and briefing row the app renders is mapped into these shapes
 * so ordering, clustering, scoring and provenance share one implementation.
 *
 * Pure types only — safe for `node --experimental-strip-types` tests.
 */

export type Region = "KR" | "US" | "GLOBAL";
export type ItemKind =
  | "news"
  | "research"
  | "disclosure"
  | "filing"
  | "policy"
  | "rating"
  | "briefing";
export type TimePrecision = "second" | "minute" | "day" | "unknown";
/** 1 = wire/primary (Bloomberg, Yonhap, Fed, SEC, exchange); 2 = major outlet; 3 = aggregator/other */
export type SourceTier = 1 | 2 | 3;

export interface FeedTicker {
  market: "KR" | "US";
  code: string;
}

export interface FeedImportance {
  score: number;
  tier: "flash" | "high" | "normal";
  reasons: string[];
}

export interface FeedClusterMember {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  publishedAt: string | null;
  precision: TimePrecision;
  paywalled?: boolean;
}

export interface FeedCluster {
  id: string;
  /** Total members including the representative. */
  size: number;
  /** Distinct source names across members. */
  sources: string[];
  /** The other members (representative excluded), newest first. */
  members?: FeedClusterMember[];
}

/** ETF enrichment (F5.2) from the live ETF list; null = not provided by the source. */
export interface FeedEtfMatch {
  code: string;
  name: string;
  price: number | null;
  changePct: number | null;
  volume: number | null;
  /** 시가총액 (억) */
  marketSum: number | null;
  issuer: string | null;
  retirementEligible: boolean | null;
}

export interface FeedItem {
  /** stable: sourceId + native id, else hash of canonical URL */
  id: string;
  kind: ItemKind;
  region: Region;
  /** registry id */
  sourceId: string;
  sourceName: string;
  sourceTier: SourceTier;
  title: string;
  /** source-provided text only, HTML-stripped, ≤ 240 chars */
  snippet?: string;
  /** https original */
  url: string;
  pdfUrl?: string;
  /** ISO-8601 UTC */
  publishedAt: string | null;
  precision: TimePrecision;
  /** ISO-8601 UTC */
  fetchedAt: string;
  /** native monotonic id (e.g. Naver nid) for tie-breaks */
  seq?: number;
  tickers: FeedTicker[];
  /** SectorId values */
  sectors: string[];
  /** e.g. "rates","fx","earnings","ma","policy","etf-listing","robotics" */
  topics: string[];
  lang: "ko" | "en";
  paywalled?: boolean;
  importance?: FeedImportance;
  cluster?: FeedCluster;
  /** Publisher when the registry source is an aggregator (e.g. Naver → 연합뉴스). */
  outlet?: string;
  /** Matched ETF (ETF news only). */
  etf?: FeedEtfMatch;
}

export type ResearchCategoryV2 =
  | "company"
  | "industry"
  | "invest"
  | "market"
  | "economy"
  | "debenture"
  | "official"
  | "public"
  | "street";

export type OriginTier = "OFFICIAL" | "PUBLIC_RESEARCH" | "STREET" | "BROKER_KR" | "NEWS";

export interface ResearchItem extends FeedItem {
  kind: "research";
  broker: string;
  category: ResearchCategoryV2;
  rating?: string;
  targetPrice?: number;
  currency?: "KRW" | "USD";
  /** only when a prior same-broker/same-ticker report was actually fetched */
  prevRating?: string;
  /** same rule as prevRating */
  prevTargetPrice?: number;
  /** extractive */
  summary: string;
  summarySource: "preview" | "detail" | "pdf-text" | "none";
  originTier: OriginTier;
}

/** Per-source result summary returned by aggregate endpoints. */
export interface FeedSourceResult {
  id: string;
  ok: boolean;
  count: number;
  /** "ok" | "timeout" | "circuit-open" | "disabled" | "error" | "unverified" | "empty" */
  state?: string;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
  partial: boolean;
  sources: FeedSourceResult[];
  generatedAt: string;
}
