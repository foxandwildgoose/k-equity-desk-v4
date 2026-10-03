/**
 * Explainable importance score 0–100 (B0.6). Every contribution adds a Korean
 * reason chip. Weights live in `src/data/news-keywords.ts`. Pure module.
 */
import {
  CLUSTER_MIN_SIZE,
  CLUSTER_POINTS,
  DECAY_GRACE_HOURS,
  DECAY_PER_HOUR,
  FLASH_MARKERS,
  FLASH_POINTS,
  FLASH_TIER_MIN,
  HIGH_TIER_MIN,
  KEYWORD_CAP,
  KEYWORD_CLASSES,
  OUTLET_TIERS,
  TIER_POINTS,
  WATCH_POINTS,
} from "../../data/news-keywords.ts";
import type { FeedImportance, FeedItem, SourceTier } from "./types.ts";

export interface ImportanceContext {
  now?: number;
  /** Watchlist tickers (`KR:005930`, `US:NVDA` or bare codes). */
  watchTickers?: Iterable<string>;
  /** User keyword watch (case-insensitive substrings). */
  watchKeywords?: Iterable<string>;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const termCache = new Map<string, RegExp>();
function termRe(term: string): RegExp {
  let re = termCache.get(term);
  if (!re) {
    const latin = /^[A-Za-z0-9 .&'-]+$/.test(term);
    re = latin ? new RegExp(`(^|[^A-Za-z0-9])${escapeRe(term)}($|[^A-Za-z0-9])`, "i") : new RegExp(escapeRe(term), "i");
    termCache.set(term, re);
  }
  return re;
}

/** True when `text` contains `term` (Latin terms on word boundaries). */
export function containsTerm(text: string, term: string): boolean {
  return termRe(term).test(text);
}

/** Tier for an aggregator-relayed outlet name (e.g. `연합뉴스` → 1). */
export function outletTier(outlet: string | null | undefined, fallback: SourceTier): SourceTier {
  if (!outlet) return fallback;
  const name = outlet.trim();
  for (const row of OUTLET_TIERS) if (row.match.test(name)) return Math.min(row.tier, fallback) as SourceTier;
  return fallback;
}

/** Keyword classes present in the text (for topics + reasons). */
export function matchKeywordClasses(text: string): { id: string; label: string; points: number; topic: string; term: string }[] {
  const out: { id: string; label: string; points: number; topic: string; term: string }[] = [];
  for (const cls of KEYWORD_CLASSES) {
    const term = cls.terms.find((t) => containsTerm(text, t));
    if (term) out.push({ id: cls.id, label: cls.label, points: cls.points, topic: cls.topic, term });
  }
  return out;
}

export function isFlashTitle(title: string): boolean {
  const t = title.trim();
  return FLASH_MARKERS.some((m) => (m.startsWith("[") ? t.includes(m) : containsTerm(t, m)));
}

export function tierFor(score: number): FeedImportance["tier"] {
  if (score >= FLASH_TIER_MIN) return "flash";
  if (score >= HIGH_TIER_MIN) return "high";
  return "normal";
}

type Scorable = Pick<FeedItem, "title" | "snippet" | "sourceTier" | "publishedAt" | "precision" | "tickers" | "cluster">;

export function scoreImportance(item: Scorable, ctx: ImportanceContext = {}): FeedImportance {
  const reasons: string[] = [];
  let score = 0;

  const tier = TIER_POINTS[item.sourceTier] ?? TIER_POINTS[3];
  score += tier.points;
  reasons.push(`${tier.label} +${tier.points}`);

  if (isFlashTitle(item.title)) {
    score += FLASH_POINTS;
    reasons.push(`속보 +${FLASH_POINTS}`);
  }

  const text = `${item.title} ${item.snippet ?? ""}`;
  let kw = 0;
  for (const m of matchKeywordClasses(text)) {
    const add = Math.min(m.points, KEYWORD_CAP - kw);
    if (add <= 0) break;
    kw += add;
    reasons.push(`${m.label}: ${m.term} +${add}`);
  }
  score += kw;

  const watchTickers = new Set([...(ctx.watchTickers ?? [])].map((t) => t.toUpperCase()));
  const tickerHit = item.tickers.find(
    (t) => watchTickers.has(`${t.market}:${t.code}`.toUpperCase()) || watchTickers.has(t.code.toUpperCase()),
  );
  const keywordHit = tickerHit ? undefined : [...(ctx.watchKeywords ?? [])].find((k) => k.trim().length >= 2 && containsTerm(text, k.trim()));
  if (tickerHit) {
    score += WATCH_POINTS;
    reasons.push(`관심종목 ${tickerHit.code} +${WATCH_POINTS}`);
  } else if (keywordHit) {
    score += WATCH_POINTS;
    reasons.push(`키워드 "${keywordHit.trim()}" +${WATCH_POINTS}`);
  }

  const size = item.cluster?.size ?? 1;
  if (size >= CLUSTER_MIN_SIZE) {
    score += CLUSTER_POINTS;
    reasons.push(`${size}개 매체 보도 +${CLUSTER_POINTS}`);
  }

  const now = ctx.now ?? Date.now();
  const ms = item.publishedAt ? Date.parse(item.publishedAt) : Number.NaN;
  if (Number.isNaN(ms) || item.precision === "unknown") {
    const cut = score;
    score = 0;
    reasons.push(`시각 미상 −${cut}`);
  } else {
    const hours = Math.max(0, (now - ms) / 3_600_000);
    const decay = Math.floor(Math.max(0, hours - DECAY_GRACE_HOURS)) * DECAY_PER_HOUR;
    if (decay > 0) {
      const applied = Math.min(decay, score);
      score -= applied;
      reasons.push(`경과 ${Math.floor(hours)}시간 −${applied}`);
    }
  }

  score = Math.max(0, Math.min(100, score));
  return { score, tier: tierFor(score), reasons };
}

/** Topics implied by keyword classes (merged with source defaults by adapters). */
export function topicsFromText(text: string): string[] {
  return [...new Set(matchKeywordClasses(text).map((m) => m.topic))];
}
