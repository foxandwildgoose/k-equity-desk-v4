import { Search, SlidersHorizontal, X } from "lucide-react";
import type { FeedFilterState } from "@/lib/feed/filters";
import { topicLabel } from "@/lib/feed/filters";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-9 items-center rounded-md border px-2 text-[11px] font-medium sm:min-h-7",
        active ? "border-foreground/30 bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Feed filters (B0.7): source, topic, minimum importance, watchlist-only, search. */
export function FilterBar({
  value,
  onChange,
  sources = [],
  topics = [],
  kinds,
  className,
}: {
  value: FeedFilterState;
  onChange: (next: FeedFilterState) => void;
  sources?: { id: string; name: string; count: number }[];
  topics?: { id: string; count: number }[];
  kinds?: { id: string; label: string }[];
  className?: string;
}) {
  const dirty =
    value.sources.length > 0 || value.topics.length > 0 || value.minImportance > 0 || value.watchOnly || value.q.trim() || (value.kinds?.length ?? 0) > 0;
  return (
    <div className={cn("space-y-2 rounded-lg border border-border bg-muted/15 p-2.5", className)} data-testid="feed-filter-bar">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
          <SlidersHorizontal className="size-3" /> 필터
        </span>
        <div className="relative min-w-0 flex-1 basis-48">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={value.q}
            onChange={(e) => onChange({ ...value, q: e.target.value })}
            placeholder="제목·종목·출처 검색"
            className="h-9 pl-8 text-xs"
            aria-label="피드 검색"
          />
        </div>
        <select
          value={String(value.minImportance)}
          onChange={(e) => onChange({ ...value, minImportance: Number(e.target.value) })}
          className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          aria-label="최소 중요도"
        >
          <option value="0">중요도 전체</option>
          <option value="60">HIGH 이상 (60+)</option>
          <option value="80">FLASH (80+)</option>
        </select>
        <Chip active={value.watchOnly} onClick={() => onChange({ ...value, watchOnly: !value.watchOnly })} title="관심종목·키워드 매칭만">
          관심종목만
        </Chip>
        {dirty && (
          <button
            type="button"
            onClick={() => onChange({ sources: [], topics: [], minImportance: 0, watchOnly: false, q: "", kinds: [] })}
            className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground hover:text-foreground sm:min-h-7"
          >
            <X className="size-3" /> 초기화
          </button>
        )}
      </div>
      {kinds && kinds.length > 1 && (
        <div className="flex flex-wrap gap-1" aria-label="종류">
          {kinds.map((k) => (
            <Chip key={k.id} active={value.kinds?.includes(k.id) ?? false} onClick={() => onChange({ ...value, kinds: toggle(value.kinds ?? [], k.id) })}>
              {k.label}
            </Chip>
          ))}
        </div>
      )}
      {sources.length > 1 && (
        <div className="flex max-w-full flex-wrap gap-1" aria-label="출처">
          {sources.slice(0, 16).map((s) => (
            <Chip key={s.id} active={value.sources.includes(s.id)} onClick={() => onChange({ ...value, sources: toggle(value.sources, s.id) })}>
              {s.name}
              <span className="ml-1 tabular opacity-60">{s.count}</span>
            </Chip>
          ))}
        </div>
      )}
      {topics.length > 1 && (
        <div className="flex flex-wrap gap-1" aria-label="주제">
          {topics.slice(0, 12).map((t) => (
            <Chip key={t.id} active={value.topics.includes(t.id)} onClick={() => onChange({ ...value, topics: toggle(value.topics, t.id) })}>
              #{topicLabel(t.id)}
              <span className="ml-1 tabular opacity-60">{t.count}</span>
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
