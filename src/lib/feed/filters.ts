/**
 * Client-side feed filters (B0.7 FilterBar): source, topic, minimum importance,
 * watchlist-only, text search via `matchesSearchQuery`. Pure module.
 */
import { matchesSearchQuery } from "../search-match.ts";
import { containsTerm } from "./importance.ts";
import type { FeedItem } from "./types.ts";
import { ETF_ISSUER_BRANDS, ETF_STAGE_LABEL, ETF_THEMES } from "../etf-news.ts";
import { POLICY_STATUS_LABEL, ROBOT_TOPICS } from "../robotics/classify.ts";

export interface FeedFilterState {
  /** Selected registry ids; empty = all. */
  sources: string[];
  /** Selected topics; empty = all. */
  topics: string[];
  minImportance: number;
  watchOnly: boolean;
  q: string;
  /** Selected kinds; empty = all. */
  kinds?: string[];
}

export const EMPTY_FILTERS: FeedFilterState = { sources: [], topics: [], minImportance: 0, watchOnly: false, q: "", kinds: [] };

export interface WatchContext {
  tickers: Iterable<string>;
  keywords: Iterable<string>;
  /** Extra searchable names per ticker code (e.g. 삼성전자 for 005930). */
  names?: ReadonlyMap<string, string>;
}

export function isWatchMatch(item: FeedItem, watch: WatchContext): boolean {
  const tickers = new Set([...watch.tickers].map((t) => t.toUpperCase()));
  if (item.tickers.some((t) => tickers.has(t.code.toUpperCase()) || tickers.has(`${t.market}:${t.code}`.toUpperCase()))) return true;
  const text = `${item.title} ${item.snippet ?? ""}`;
  for (const k of watch.keywords) if (k.trim().length >= 2 && containsTerm(text, k.trim())) return true;
  return false;
}

export function applyFeedFilters<T extends FeedItem>(items: readonly T[], f: FeedFilterState, watch?: WatchContext): T[] {
  const sources = new Set(f.sources);
  const topics = new Set(f.topics);
  const kinds = new Set(f.kinds ?? []);
  const q = f.q.trim();
  return items.filter((it) => {
    if (sources.size) {
      const inCluster = it.cluster?.members?.some((m) => sources.has(m.sourceId)) ?? false;
      if (!sources.has(it.sourceId) && !inCluster) return false;
    }
    if (topics.size && !it.topics.some((t) => topics.has(t))) return false;
    if (kinds.size && !kinds.has(it.kind)) return false;
    if (f.minImportance > 0 && (it.importance?.score ?? 0) < f.minImportance) return false;
    if (f.watchOnly && (!watch || !isWatchMatch(it, watch))) return false;
    if (q) {
      const names = it.tickers.map((t) => watch?.names?.get(t.code) ?? "").filter(Boolean);
      const hay = [it.title, it.snippet, it.sourceName, it.outlet, ...it.tickers.map((t) => t.code), ...names, ...it.topics];
      if (!matchesSearchQuery(q, hay)) return false;
    }
    return true;
  });
}

/** Distinct sources present (rep + cluster members) with counts, for filter chips. */
export function sourceFacets(items: readonly FeedItem[]): { id: string; name: string; count: number }[] {
  const map = new Map<string, { id: string; name: string; count: number }>();
  for (const it of items) {
    const ids = new Map<string, string>([[it.sourceId, it.sourceName]]);
    for (const m of it.cluster?.members ?? []) if (!ids.has(m.sourceId)) ids.set(m.sourceId, m.sourceName.split(" · ")[0]!);
    for (const [id, name] of ids) {
      const row = map.get(id) ?? { id, name, count: 0 };
      row.count += 1;
      map.set(id, row);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1));
}

export function topicFacets(items: readonly FeedItem[]): { id: string; count: number }[] {
  const map = new Map<string, number>();
  for (const it of items) for (const t of new Set(it.topics)) map.set(t, (map.get(t) ?? 0) + 1);
  return [...map.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || (a.id < b.id ? -1 : 1));
}

export const TOPIC_LABELS: Record<string, string> = {
  market: "시황",
  macro: "거시·정책",
  earnings: "실적·기업",
  "market-structure": "시장구조",
  rating: "등급·목표가",
  rates: "금리·채권",
  fx: "환율",
  disclosure: "공시",
  company: "기업분석",
  global: "해외",
  policy: "정책",
  tech: "테크",
  etf: "ETF",
  "etf-listing": "ETF 상장",
  robotics: "로봇",
  research: "리서치",
  statistics: "통계",
};

for (const [id, label] of Object.entries(ETF_STAGE_LABEL)) TOPIC_LABELS[`stage:${id}`] = label;
for (const t of ETF_THEMES) TOPIC_LABELS[`theme:${t.id}`] = t.label;
for (const b of ETF_ISSUER_BRANDS) TOPIC_LABELS[`brand:${b.brand}`] = b.brand;
for (const t of ROBOT_TOPICS) TOPIC_LABELS[`robot:${t.id}`] = t.label;
for (const [id, label] of Object.entries(POLICY_STATUS_LABEL)) TOPIC_LABELS[`status:${id}`] = label;

export function topicLabel(id: string): string {
  return TOPIC_LABELS[id] ?? id;
}
