import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { FeedItem, FeedPage, ItemKind, Region } from "@/lib/feed/types";
import { filterDisabledSources } from "@/lib/feed/cluster";
import { scoreImportance } from "@/lib/feed/importance";
import { sortNewestFirst } from "@/lib/feed/sort";
import { mergeFeedPages } from "@/lib/feed/merge";
import { buildUsTickerIndex, tagUsTickers } from "@/lib/feed/tickers";
import { useAppStore, useDisabledSources } from "@/lib/store";
import { getMarketSnapshot, getNaverAiBriefing, getUsCalendar } from "@/lib/feed-fns";
import { UNIVERSE } from "@/data/universe";

export type FeedGroupId = "etf" | "robotics-market" | "robotics-policy";

export interface UseFeedOptions {
  region: Region;
  /** Theme group (`/api/feed?group=`): ETF news, robotics market/policy. */
  group?: FeedGroupId;
  kinds?: ItemKind[];
  topics?: string[];
  tickers?: string[];
  limit?: number;
  enabled?: boolean;
  refetchMs?: number;
  /** Override the endpoint (e.g. `/api/wire`). */
  endpoint?: string;
}

async function fetchFeedPage(opts: UseFeedOptions, cursor: string | null): Promise<FeedPage> {
  const params = new URLSearchParams({ region: opts.region, limit: String(opts.limit ?? 50) });
  if (opts.group) params.set("group", opts.group);
  if (opts.kinds?.length) params.set("kinds", opts.kinds.join(","));
  if (opts.topics?.length) params.set("topics", opts.topics.join(","));
  if (opts.tickers?.length) params.set("tickers", opts.tickers.join(","));
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`${opts.endpoint ?? "/api/feed"}?${params}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
  return (await res.json()) as FeedPage;
}

/** User watch context (KR + US watchlists and keywords) for scoring/filters. */
export function useWatchContext() {
  const watchlist = useAppStore((s) => s.watchlist);
  const usWatchlist = useAppStore((s) => s.usWatchlist);
  const keywords = useAppStore((s) => s.keywordWatch);
  return useMemo(() => {
    const names = new Map<string, string>();
    for (const u of UNIVERSE) names.set(u.code, u.nameKo);
    return {
      tickers: [...watchlist, ...usWatchlist],
      keywords,
      names,
      usIndex: buildUsTickerIndex(usWatchlist.map((s) => ({ symbol: s, names: [] }))),
    };
  }, [watchlist, usWatchlist, keywords]);
}

/** Re-score with the user's watch context and add cashtag tags for the US watchlist. */
export function personalize(items: FeedItem[], watch: ReturnType<typeof useWatchContext>, now = Date.now()): FeedItem[] {
  return items.map((it) => {
    let tickers = it.tickers;
    if (it.lang === "en") {
      const extra = tagUsTickers(it.title, watch.usIndex).filter((t) => !tickers.some((x) => x.code === t.code));
      if (extra.length) tickers = [...tickers, ...extra];
    }
    const next = tickers === it.tickers ? it : { ...it, tickers };
    return { ...next, importance: scoreImportance(next, { now, watchTickers: watch.tickers, watchKeywords: watch.keywords }) };
  });
}

/**
 * Paged newest-first feed from `/api/feed`. Pages are merged without
 * duplicates (by id); disabled sources (user toggles, Bloomberg switch) are
 * removed client-side, promoting surviving cluster members.
 */
export function useFeed(opts: UseFeedOptions) {
  const disabled = useDisabledSources();
  const watch = useWatchContext();
  const q = useInfiniteQuery({
    queryKey: ["feed", opts.endpoint ?? "/api/feed", opts.region, opts.group ?? "", opts.kinds?.join(",") ?? "", opts.topics?.join(",") ?? "", opts.tickers?.join(",") ?? "", opts.limit ?? 50],
    queryFn: ({ pageParam }) => fetchFeedPage(opts, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: opts.enabled ?? true,
    staleTime: 25_000,
    refetchInterval: opts.refetchMs ?? 90_000,
    refetchOnWindowFocus: false,
  });
  const pages = q.data?.pages ?? [];
  const items = useMemo(
    () => sortNewestFirst(personalize(filterDisabledSources(mergeFeedPages(pages), disabled), watch)),
    [pages, disabled, watch],
  );
  const first = pages[0];
  return {
    ...q,
    items,
    sources: first?.sources ?? [],
    partial: pages.some((p) => p.partial),
    generatedAt: first?.generatedAt ?? null,
  };
}

export function useMarketSnapshot(ids?: Parameters<typeof getMarketSnapshot>[0]["data"]["ids"], opts?: { enabled?: boolean; refetchMs?: number }) {
  return useQuery({
    queryKey: ["market-snapshot", ids?.join(",") ?? "all"],
    queryFn: () => getMarketSnapshot({ data: { ids } }),
    staleTime: 50_000,
    refetchInterval: opts?.refetchMs ?? 120_000,
    refetchOnWindowFocus: false,
    enabled: opts?.enabled ?? true,
  });
}

export function useUsCalendar(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["us-calendar"],
    queryFn: () => getUsCalendar(),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    enabled: opts?.enabled ?? true,
  });
}

export function useNaverAiBriefing(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["naver-ai-briefing"],
    queryFn: () => getNaverAiBriefing(),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    enabled: opts?.enabled ?? true,
  });
}
