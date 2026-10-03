/**
 * Feed aggregation (B0.7 / F8.1): fan out to registry sources under an 8 s
 * budget, then merge → cluster → score → sort newest first → page.
 */
import { SOURCE_REGISTRY } from "@/server/feeds/registry";
import { runSources, type RunResult } from "@/server/feeds/adapters";
import { clusterItems } from "@/lib/feed/cluster";
import { scoreImportance } from "@/lib/feed/importance";
import { pageAfterCursor, sortNewestFirst } from "@/lib/feed/sort";
import type { FeedItem, FeedPage, FeedSourceResult, ItemKind, Region } from "@/lib/feed/types";
import { enrichEtfStory, isEtfStory, type EtfRowLike } from "@/lib/etf-news";
import { isRobotPolicyText, policyStatusTopicIds, robotTopicIds } from "@/lib/robotics/classify";
import { isRoboticsText } from "@/data/research-taxonomy";

export const FEED_SOURCES: Record<Region, string[]> = {
  KR: [
    "naver-flash",
    "naver-main",
    "naver-focus-401",
    "naver-focus-402",
    "naver-focus-404",
    "naver-focus-406",
    "naver-focus-429",
    "hankyung-finance",
    "hankyung-economy",
    "yonhap-market",
    "yonhap-economy",
    "mk-rss",
    "gn-kr-market",
    "krx-disclosures",
    "kis-news-title",
  ],
  US: [
    "bloomberg-markets",
    "bloomberg-economics",
    "bloomberg-technology",
    "bloomberg-politics",
    "bloomberg-wealth",
    "gn-bloomberg",
    "naver-worldnews",
    "naver-focus-403",
    "fed-press",
    "sec-8k-atom",
    "finviz-ratings",
    "cnbc-rss",
    "marketwatch-rss",
    "yahoo-finance-rss",
    "gn-us-market",
    "finnhub-news",
  ],
  GLOBAL: [],
};
FEED_SOURCES.GLOBAL = [...FEED_SOURCES.KR, ...FEED_SOURCES.US, "hankyung-international"];

/** Theme pages (F5 / F6.3 / F6.4): fixed source sets + server-side post-processing. */
export const FEED_GROUPS = ["etf", "robotics-market", "robotics-policy"] as const;
export type FeedGroup = (typeof FEED_GROUPS)[number];

export const GROUP_SOURCES: Record<FeedGroup, string[]> = {
  etf: ["gn-etf-kr", "gn-etf-brands", "hankyung-finance", "naver-news-search-etf"],
  "robotics-market": ["robot-report", "irobotnews", "ieee-spectrum-robotics", "gn-robotics-kr", "gn-robotics-en", "hankyung-it"],
  "robotics-policy": ["federal-register", "gn-robot-policy-kr", "gn-robot-policy-en", "irobotnews"],
};

/** Sources whose every item is on-theme (others are keyword-filtered). */
const ROBOT_NATIVE = new Set(["robot-report", "irobotnews", "ieee-spectrum-robotics", "gn-robotics-kr", "gn-robotics-en"]);

async function liveEtfList(): Promise<EtfRowLike[]> {
  try {
    const { fetchAllEtfs } = await import("@/server/etf-market");
    return await Promise.race([fetchAllEtfs(), new Promise<EtfRowLike[]>((resolve) => setTimeout(() => resolve([]), 4_000))]);
  } catch {
    return [];
  }
}

function addTopics(it: FeedItem, extra: string[]): FeedItem {
  if (!extra.length) return it;
  return { ...it, topics: [...new Set([...it.topics, ...extra])] };
}

/** Keep on-theme items and stamp theme topics (ETF match / robot topics / status chips). */
export async function postProcessGroup(group: FeedGroup, items: FeedItem[]): Promise<FeedItem[]> {
  if (group === "etf") {
    const etfs = await liveEtfList();
    return items.map((it) => enrichEtfStory(it, etfs)).filter((x): x is FeedItem => x != null);
  }
  const text = (it: FeedItem) => `${it.title} ${it.snippet ?? ""}`;
  if (group === "robotics-market") {
    return items
      .filter((it) => ROBOT_NATIVE.has(it.sourceId) || isRoboticsText(text(it)))
      .map((it) => addTopics(it, ["robotics", ...robotTopicIds(text(it)), ...(isRobotPolicyText(text(it)) ? ["policy"] : [])]));
  }
  return items
    .filter((it) => it.sourceId !== "irobotnews" || isRobotPolicyText(text(it)))
    .map((it) => addTopics(it, ["policy", "robotics", ...(it.topics.some((t) => t.startsWith("status:")) ? [] : policyStatusTopicIds(`${text(it)} ${it.outlet ?? ""}`))]));
}

/**
 * Live Wire (F8.1): the high-frequency subset. Fetch-cache TTL = registry
 * pollSec (flash/main 30 s, Hankyung 60 s, Fed/SEC 120 s, GN 120 s,
 * Bloomberg 300 s).
 */
export const WIRE_SOURCES: Record<"KR" | "US", string[]> = {
  KR: ["naver-flash", "naver-main", "hankyung-finance", "hankyung-economy", "gn-kr-market"],
  US: [
    "bloomberg-markets",
    "bloomberg-economics",
    "bloomberg-technology",
    "bloomberg-politics",
    "bloomberg-wealth",
    "gn-bloomberg",
    "fed-press",
    "sec-8k-atom",
    "gn-us-market",
  ],
};

/** Wire items carry `etf` / `robotics` topics so the drawer tabs can filter them. */
export function tagWireThemes(items: FeedItem[]): FeedItem[] {
  return items.map((it) => {
    const text = `${it.title} ${it.snippet ?? ""}`;
    const extra: string[] = [];
    if (isEtfStory(it.title)) extra.push("etf");
    if (isRoboticsText(text)) extra.push("robotics");
    return addTopics(it, extra);
  });
}

const KIND_BY_ID = new Map(SOURCE_REGISTRY.map((s) => [s.id, s.kind]));

export interface FeedQuery {
  regions: Region[];
  kinds?: ItemKind[];
  topics?: string[];
  tickers?: string[];
  cursor?: string | null;
  limit?: number;
  /** Extra source ids (e.g. robotics/etf groups). */
  sourceIds?: string[];
  /** Theme group: replaces region sources and post-processes items. */
  group?: FeedGroup;
  /** Live Wire subset (replaces region sources; tags etf/robotics topics). */
  wire?: boolean;
  budgetMs?: number;
  now?: number;
}

function sourceIdsFor(q: FeedQuery): string[] {
  if (q.wire) return [...new Set(q.regions.flatMap((r) => (r === "GLOBAL" ? [...WIRE_SOURCES.KR, ...WIRE_SOURCES.US] : WIRE_SOURCES[r])))];
  const ids = new Set<string>(q.group ? GROUP_SOURCES[q.group] : (q.sourceIds ?? []));
  if (!q.group && !q.sourceIds?.length) for (const r of q.regions) for (const id of FEED_SOURCES[r]) ids.add(id);
  const kinds = new Set(q.kinds ?? []);
  return [...ids].filter((id) => !kinds.size || kinds.has(KIND_BY_ID.get(id) ?? "news"));
}

export function sourceResults(results: RunResult[]): FeedSourceResult[] {
  return results.map((r) => ({
    id: r.id,
    ok: r.state === "ok" || r.state === "empty",
    count: r.items.length,
    state: r.state === "no-adapter" ? "error" : r.state,
  }));
}

const aggCache = new Map<string, { at: number; items: FeedItem[]; sources: FeedSourceResult[]; partial: boolean; generatedAt: string }>();
const AGG_TTL_MS = 15_000;

/** Merge + cluster + score + sort (full list, newest first). */
export async function collectFeed(q: FeedQuery): Promise<{ items: FeedItem[]; sources: FeedSourceResult[]; partial: boolean; generatedAt: string }> {
  const ids = sourceIdsFor(q).sort();
  const key = `${q.wire ? "wire" : (q.group ?? "")}|${ids.join(",")}`;
  const hit = aggCache.get(key);
  const now = q.now ?? Date.now();
  if (hit && now - hit.at < AGG_TTL_MS) return hit;
  const { results, partial } = await runSources(ids, { budgetMs: q.budgetMs ?? 7_500, perSourceMs: 7_000, now });
  const raw = results.flatMap((r) => r.items);
  const merged = q.group ? await postProcessGroup(q.group, raw) : q.wire ? tagWireThemes(raw) : raw;
  const clustered = clusterItems(merged).map((it) => ({ ...it, importance: scoreImportance(it, { now }) }));
  const out = {
    at: now,
    items: sortNewestFirst(clustered),
    sources: sourceResults(results),
    partial,
    generatedAt: new Date(now).toISOString(),
  };
  aggCache.set(key, out);
  if (aggCache.size > 40) aggCache.delete(aggCache.keys().next().value!);
  return out;
}

export async function aggregateFeed(q: FeedQuery): Promise<FeedPage> {
  const all = await collectFeed(q);
  const topics = new Set(q.topics ?? []);
  const tickers = new Set((q.tickers ?? []).map((t) => t.toUpperCase()));
  const filtered = all.items.filter((it) => {
    if (topics.size && !it.topics.some((t) => topics.has(t))) return false;
    if (tickers.size && !it.tickers.some((t) => tickers.has(t.code.toUpperCase()) || tickers.has(`${t.market}:${t.code}`.toUpperCase()))) return false;
    return true;
  });
  const page = pageAfterCursor(filtered, q.cursor ?? null, Math.min(Math.max(q.limit ?? 50, 1), 200));
  return { items: page.items, nextCursor: page.nextCursor, partial: all.partial, sources: all.sources, generatedAt: all.generatedAt };
}
