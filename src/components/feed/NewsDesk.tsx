import { useMemo, useState, type ReactNode } from "react";
import type { FeedItem, FeedSourceResult } from "@/lib/feed/types";
import type { DisplayZone } from "@/lib/feed/time";
import { applyFeedFilters, EMPTY_FILTERS, sourceFacets, topicFacets, type FeedFilterState } from "@/lib/feed/filters";
import { FilterBar } from "@/components/feed/FilterBar";
import { FeedList } from "@/components/feed/FeedList";
import { useWatchContext } from "@/lib/use-feed";
import { UNIVERSE } from "@/data/universe";

const NAME_BY_CODE = new Map(UNIVERSE.map((u) => [u.code, u.nameKo]));

export function krTickerLabel(t: FeedItem["tickers"][number]): string | undefined {
  return t.market === "KR" ? NAME_BY_CODE.get(t.code) ?? t.code : undefined;
}

/** Explain an empty list honestly (A3.1): which sources failed and why. */
export function emptyReasonFor(sources: FeedSourceResult[], loading: boolean, filtered: boolean): string {
  if (loading) return "수신 중…";
  if (filtered) return "현재 필터에 맞는 항목이 없습니다. 필터를 줄여 보세요.";
  const active = sources.filter((s) => s.state !== "disabled");
  if (!active.length) return "이 화면에 연결된 소스가 모두 비활성 상태입니다.";
  const failed = active.filter((s) => !s.ok);
  if (failed.length === active.length) {
    return `소스 ${active.length}곳 모두 응답하지 않았습니다(소스 미검증·네트워크 차단·서킷 등). 데이터를 채워 넣지 않습니다.`;
  }
  return "응답한 소스에 표시할 기사가 없습니다.";
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
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          표시 {visible.length}건{filtered ? ` / 전체 ${items.length}건` : ""} · 최신순
        </span>
      </div>
      <FeedList
        items={visible}
        tz={tz}
        withEt={withEt}
        loading={loading}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
        emptyReason={emptyReasonFor(sources, loading, filtered)}
        labelFor={krTickerLabel}
        translations={translations}
      />
    </section>
  );
}
