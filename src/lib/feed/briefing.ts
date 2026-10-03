/**
 * Deterministic briefing digest helpers (B0.7 "Briefing" definition). Pure.
 * No generated text: every entry is a real item or a counted term.
 */
import { CLUSTER_STOPWORDS } from "../../data/news-keywords.ts";
import { compareNewestFirst } from "./sort.ts";
import { normalizeClusterTitle } from "./cluster.ts";
import type { FeedItem } from "./types.ts";

const HOUR = 3_600_000;

function ms(it: Pick<FeedItem, "publishedAt">): number | null {
  if (!it.publishedAt) return null;
  const t = Date.parse(it.publishedAt);
  return Number.isNaN(t) ? null : t;
}

/**
 * Top stories: up to `max` clusters from the last `windowHours`, ranked by
 * importance score (desc), then newest first.
 */
export function topStories<T extends FeedItem>(items: readonly T[], opts: { now?: number; windowHours?: number; max?: number } = {}): T[] {
  const now = opts.now ?? Date.now();
  const cutoff = now - (opts.windowHours ?? 12) * HOUR;
  return items
    .filter((it) => {
      const t = ms(it);
      return t != null && t >= cutoff && it.precision !== "day" && it.kind !== "research";
    })
    .sort((a, b) => (b.importance?.score ?? 0) - (a.importance?.score ?? 0) || compareNewestFirst(a, b))
    .slice(0, opts.max ?? 7);
}

const KO_PARTICLE = /(으로|에서|에게|까지|부터|보다|처럼|이며|이고|했다|한다|하는|되는|된다|은|는|이|가|을|를|의|에|로|와|과|도|만)$/u;

/** Candidate theme terms from a headline (words ≥ 2 chars, particles trimmed). */
export function headlineTerms(title: string): string[] {
  const norm = normalizeClusterTitle(title);
  const out = new Set<string>();
  for (const raw of norm.split(" ")) {
    let w = raw.trim();
    if (!w) continue;
    if (/^[가-힣]+$/.test(w) && w.length > 2) w = w.replace(KO_PARTICLE, "");
    if (w.length < 2 || /^\d+$/.test(w)) continue;
    if (CLUSTER_STOPWORDS.has(w)) continue;
    out.add(w);
  }
  return [...out];
}

export interface ThemeTerm {
  term: string;
  /** Items mentioning the term in the recent window. */
  recent: number;
  /** Items mentioning the term in the prior window. */
  prior: number;
  /** recent − prior × (recentHours / priorHours): excess over the prior rate. */
  momentum: number;
}

/**
 * Theme momentum: top terms of the last `recentHours` (default 6) vs the prior
 * `priorHours` (default 24), with raw counts shown. Terms need ≥ 2 recent hits.
 */
export function themeMomentum(
  items: readonly Pick<FeedItem, "title" | "publishedAt" | "precision">[],
  opts: { now?: number; recentHours?: number; priorHours?: number; max?: number } = {},
): ThemeTerm[] {
  const now = opts.now ?? Date.now();
  const rh = opts.recentHours ?? 6;
  const ph = opts.priorHours ?? 24;
  const recentStart = now - rh * HOUR;
  const priorStart = recentStart - ph * HOUR;
  const recent = new Map<string, number>();
  const prior = new Map<string, number>();
  for (const it of items) {
    if (it.precision === "day" || it.precision === "unknown") continue;
    const t = ms(it);
    if (t == null || t > now + 5 * 60_000 || t < priorStart) continue;
    const bucket = t >= recentStart ? recent : prior;
    for (const term of headlineTerms(it.title)) bucket.set(term, (bucket.get(term) ?? 0) + 1);
  }
  const rows: ThemeTerm[] = [];
  for (const [term, r] of recent) {
    if (r < 2) continue;
    const p = prior.get(term) ?? 0;
    rows.push({ term, recent: r, prior: p, momentum: Math.round((r - (p * rh) / ph) * 100) / 100 });
  }
  return rows
    .sort((a, b) => b.momentum - a.momentum || b.recent - a.recent || (a.term < b.term ? -1 : 1))
    .slice(0, opts.max ?? 8);
}

/** Counts per KST day bucket for "오늘 n건 · 이번 주 m건" strips. */
export function countTodayAndWeek(
  items: readonly Pick<FeedItem, "publishedAt">[],
  now = Date.now(),
): { today: number; week: number } {
  const kst = (t: number) => new Date(t + 9 * HOUR).toISOString().slice(0, 10);
  const today = kst(now);
  const weekStart = now - 7 * 24 * HOUR;
  let t = 0;
  let w = 0;
  for (const it of items) {
    const x = ms(it);
    if (x == null) continue;
    if (kst(x) === today) t++;
    if (x >= weekStart) w++;
  }
  return { today: t, week: w };
}
