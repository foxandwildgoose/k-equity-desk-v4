import { useMemo, useState, type ReactNode } from "react";
import type { FeedItem, FeedSourceResult } from "@/lib/feed/types";
import type { DisplayZone } from "@/lib/feed/time";
import { applyFeedFilters, EMPTY_FILTERS, sourceFacets, topicFacets, type FeedFilterState } from "@/lib/feed/filters";
import { FilterBar } from "@/components/feed/FilterBar";
import { FeedList } from "@/components/feed/FeedList";
import { useWatchContext } from "@/lib/use-feed";
import { UNIVERSE } from "@/data/universe";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { feedEmptyReason, FeedRequestError } from "@/lib/feed-client";

const NAME_BY_CODE = new Map(UNIVERSE.map((u) => [u.code, u.nameKo]));

export function krTickerLabel(t: FeedItem["tickers"][number]): string | undefined {
  return t.market === "KR" ? NAME_BY_CODE.get(t.code) ?? t.code : undefined;
}

/** Explain an empty list honestly (A3.1): which sources failed and why. */
export function emptyReasonFor(sources: FeedSourceResult[], loading: boolean, filtered: boolean): string {
  return feedEmptyReason(sources, loading, filtered);
}

/** Filterable newest-first feed with 더 보기 (B0.7). */
export function NewsDesk({
  items,
  sources,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  tz = "KST",
  withEt = false,
  kinds,
  header,
  translations,
  error,
  retrying = false,
  paused = false,
  onRetry,
}: {
  items: FeedItem[];
  sources: FeedSourceResult[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  tz?: DisplayZone;
  withEt?: boolean;
  kinds?: { id: string; label: string }[];
  header?: ReactNode;
  translations?: Record<string, string>;
  error?: unknown;
  retrying?: boolean;
  paused?: boolean;
  onRetry?: () => void;
}) {
  const [filters, setFilters] = useState<FeedFilterState>(EMPTY_FILTERS);
  const watch = useWatchContext();
  const visible = useMemo(() => applyFeedFilters(items, filters, watch), [items, filters, watch]);
  const facetsS = useMemo(() => sourceFacets(items), [items]);
  const facetsT = useMemo(() => topicFacets(items), [items]);
  const filtered = visible.length !== items.length;
  return (
    <section className="space-y-2" aria-label="뉴스 목록">
      {header}
      <FilterBar value={filters} onChange={setFilters} sources={facetsS} topics={facetsT} kinds={kinds} />
      {Boolean(error || paused) && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-desk-gold/40 bg-desk-gold/5 p-3 text-sm text-foreground" data-testid="news-request-error">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-desk-gold" aria-hidden="true" />
          <span>{paused ? "인터넷 연결을 기다리고 있습니다. 연결 상태를 확인해 주세요." : error instanceof FeedRequestError ? error.message : "뉴스를 불러오지 못했습니다. 다시 불러오기를 눌러 주세요."}{items.length > 0 ? " 이전에 받은 뉴스는 계속 표시합니다." : ""}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>
          표시 {visible.length}건{filtered ? ` / 전체 ${items.length}건` : ""} · 최신순
        </span>
        {onRetry && (
          <Button type="button" variant="outline" size="lg" className="text-xs" onClick={onRetry} disabled={retrying} data-testid="news-retry">
            <RefreshCw className={retrying ? "animate-spin" : ""} aria-hidden="true" />
            {retrying ? "뉴스 불러오는 중…" : "뉴스 다시 불러오기"}
          </Button>
        )}
      </div>
      <FeedList
        items={visible}
        tz={tz}
        withEt={withEt}
        loading={loading && !error && !paused}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
        emptyReason={feedEmptyReason(sources, loading, filtered, { failed: !!error, paused })}
        labelFor={krTickerLabel}
        translations={translations}
      />
    </section>
  );
}
