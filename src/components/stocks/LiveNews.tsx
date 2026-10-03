import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { NewsItem, DisclosureItem } from "@/server/naver-market";
import { DisclosureList } from "@/components/stocks/DisclosureViewer";
import { getStockNews } from "@/lib/market-fns";
import { newsItemToFeed } from "@/lib/feed/mappers";
import { dedupeById, sortNewestFirst } from "@/lib/feed/sort";
import type { FeedItem } from "@/lib/feed/types";
import { FeedList } from "@/components/feed/FeedList";

function toFeed(list: NewsItem[], fetchedAt: string): FeedItem[] {
  return list
    .map((n) =>
      newsItemToFeed(n, {
        sourceId: "naver-stock-news",
        sourceName: "네이버 종목뉴스",
        tier: 3,
        fetchedAt,
      }),
    )
    .filter((x): x is FeedItem => x != null);
}

/**
 * Per-stock news (F1.4): newest first via the shared kernel, publisher badges
 * (tier dot), original links, and 더 보기 for page 2+.
 */
export function LiveNews({
  news,
  disclosures,
  title = "뉴스 · 공시",
  code,
}: {
  news: NewsItem[];
  disclosures: DisclosureItem[];
  title?: string;
  code?: string;
}) {
  const more = useInfiniteQuery({
    queryKey: ["stock-news-more", code],
    queryFn: ({ pageParam }) => getStockNews({ data: { code: code!, page: pageParam } }),
    initialPageParam: 2,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: false,
  });
  const items = useMemo(() => {
    const base = toFeed(news, new Date(0).toISOString());
    const extra = (more.data?.pages ?? []).flatMap((p) => toFeed(p.items, p.fetchedAt));
    return sortNewestFirst(dedupeById([...base, ...extra]));
  }, [news, more.data]);
  const loaded = more.data?.pages.length ?? 0;
  const hasMore = code != null && (loaded === 0 ? news.length >= 20 : Boolean(more.hasNextPage));
  const lastError = more.data?.pages.at(-1)?.error;

  return (
    <div className="flex flex-col gap-4">
      <DisclosureList items={disclosures} title={`${title.split("·")[0]?.trim() || "공시"} · 공시`} />

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-3 py-2.5">
          <h2 className="text-sm font-semibold">뉴스</h2>
          <p className="text-[11px] text-muted-foreground">네이버 증권 종목뉴스 · 최신순 · 발행 매체와 원문 링크 표시</p>
        </div>
        <div className="max-h-[520px] overflow-y-auto scroll-thin p-2">
          <FeedList
            items={items}
            emptyReason={lastError ? `뉴스를 받지 못했습니다 (${lastError}).` : "최근 뉴스 없음 — 소스가 응답하지 않았거나 기사가 없습니다."}
            hasMore={hasMore}
            loadingMore={more.isFetching}
            onLoadMore={() => void (loaded === 0 ? more.refetch() : more.fetchNextPage())}
          />
        </div>
      </section>
    </div>
  );
}
