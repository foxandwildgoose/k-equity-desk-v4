import { Fragment, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { FeedItem } from "@/lib/feed/types";
import { dateGroupLabel, kstDayKey, type DisplayZone } from "@/lib/feed/time";
import { FeedRow } from "@/components/feed/FeedRow";
import { EmptyState } from "@/components/feed/EmptyState";
import { useNow } from "@/components/feed/TimeStamp";
import { cn } from "@/lib/utils";

/** Above this many rows, rows use `content-visibility: auto` (native windowing). */
export const VIRTUALIZE_AFTER = 200;

/**
 * Newest-first list with date group headers (오늘/어제/날짜) and "더 보기".
 * Items must arrive already sorted by the server (compareNewestFirst).
 */
export function FeedList({
  items,
  tz = "KST",
  withEt = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  emptyReason,
  loading = false,
  renderRow,
  tierBar = false,
  labelFor,
  className,
  translations,
}: {
  items: FeedItem[];
  tz?: DisplayZone;
  withEt?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  emptyReason?: ReactNode;
  loading?: boolean;
  renderRow?: (item: FeedItem) => ReactNode;
  tierBar?: boolean;
  labelFor?: (t: FeedItem["tickers"][number]) => string | undefined;
  className?: string;
  translations?: Record<string, string>;
}) {
  const now = useNow(60_000);
  if (!items.length) {
    return loading ? (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-10 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> 수신 중…
      </div>
    ) : (
      <EmptyState reason={emptyReason ?? "표시할 항목이 없습니다."} />
    );
  }
  const virtual = items.length > VIRTUALIZE_AFTER;
  let lastDay: string | null | undefined;
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <ul className="divide-y divide-border" data-feed-list>
        {items.map((it) => {
          const day = it.publishedAt ? kstDayKey(it.publishedAt) : null;
          const header = day !== lastDay;
          lastDay = day;
          return (
            <Fragment key={it.id}>
              {header && (
                <li
                  className="sticky top-0 z-[1] bg-muted/80 px-3 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground backdrop-blur"
                  data-date-header={day ?? "unknown"}
                >
                  {now == null && day ? day.replace(/-/g, ".") : dateGroupLabel(day, now ?? undefined)}
                </li>
              )}
              <li style={virtual ? { contentVisibility: "auto", containIntrinsicSize: "auto 92px" } : undefined}>
                {renderRow ? renderRow(it) : <FeedRow item={it} tz={tz} withEt={withEt} tierBar={tierBar} labelFor={labelFor} translation={translations?.[it.id]} />}
              </li>
            </Fragment>
          );
        })}
      </ul>
      {(hasMore || loadingMore) && onLoadMore && (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md text-xs font-semibold text-primary hover:bg-muted/50 disabled:opacity-60"
          >
            {loadingMore ? <Loader2 className="size-3.5 animate-spin" /> : null}더 보기
          </button>
        </div>
      )}
    </div>
  );
}
