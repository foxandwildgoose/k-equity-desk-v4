import type { ReactNode } from "react";
import { CalendarClock, Flame, TrendingUp } from "lucide-react";
import type { FeedItem } from "@/lib/feed/types";
import type { ThemeTerm } from "@/lib/feed/briefing";
import type { DisplayZone } from "@/lib/feed/time";
import { TimeStamp } from "@/components/feed/TimeStamp";
import { ImportanceChip, SourceBadge } from "@/components/feed/FeedRow";
import { usePriceColors } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface SnapshotTile {
  id: string;
  label: string;
  value: string | null;
  change?: string | null;
  changePct?: number | null;
  /** e.g. "네이버 스냅샷", "Yahoo" */
  source: string;
  /** e.g. "실시간", "지연 ~15분", "종가" */
  delay: string;
  asOf?: string | null;
  reason?: string;
}

export interface BriefingEvent {
  id: string;
  when: string;
  title: string;
  source: string;
  url: string | null;
}

/**
 * Deterministic briefing digest (B0.7): as-of + session, snapshot tiles (each
 * with source + delay), top stories (≤ 7 clusters / 12 h by importance, with
 * reasons and every source link), theme momentum (6 h vs prior 24 h counts),
 * upcoming events, optional AI slot. Never generated prose.
 */
export function BriefingDigest({
  asOf,
  session,
  tiles = [],
  topStories = [],
  themes = [],
  events,
  eventsNote,
  aiSlot,
  tz = "KST",
  extra,
}: {
  asOf: string | null;
  session?: { label: string; estimated?: boolean; detail?: string } | null;
  tiles?: SnapshotTile[];
  topStories?: FeedItem[];
  themes?: ThemeTerm[];
  events?: BriefingEvent[];
  eventsNote?: string;
  aiSlot?: ReactNode;
  tz?: DisplayZone;
  extra?: ReactNode;
}) {
  const colors = usePriceColors();
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-3 md:p-4" aria-label="브리핑" data-testid="briefing-digest">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          기준 시각{" "}
          <span className="font-semibold text-foreground">
            {asOf ? <TimeStamp publishedAt={asOf} precision="second" tz={tz} withEt={tz === "ET"} /> : "—"}
          </span>
        </span>
        {session && (
          <span className="rounded-md border border-border px-2 py-0.5 font-semibold text-foreground" title={session.detail}>
            {session.label}
            {session.estimated && <span className="ml-1 font-normal text-muted-foreground">(추정)</span>}
          </span>
        )}
      </div>

      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {tiles.map((t) => {
            const up = (t.changePct ?? 0) > 0;
            const down = (t.changePct ?? 0) < 0;
            return (
              <div key={t.id} className="min-w-0 rounded-lg border border-border bg-muted/20 p-2" data-tile={t.id}>
                <div className="truncate text-[10px] font-semibold text-muted-foreground">{t.label}</div>
                <div className="mt-0.5 truncate text-sm font-semibold tabular">{t.value ?? "—"}</div>
                <div className={cn("truncate text-[11px] tabular", up && colors.up, down && colors.down, !up && !down && "text-muted-foreground")}>
                  {t.value == null ? (t.reason ?? "데이터 없음") : `${t.change ?? ""}${t.changePct != null ? ` (${t.changePct > 0 ? "+" : ""}${t.changePct.toFixed(2)}%)` : ""}`}
                </div>
                <div className="mt-0.5 truncate text-[9px] text-muted-foreground" title={`${t.source} · ${t.delay}`}>
                  {t.source} · {t.delay}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h3 className="mb-1.5 inline-flex items-center gap-1 text-[11px] font-semibold">
            <Flame className="size-3.5 text-price-up" /> 주요 뉴스 (최근 12시간 · 중요도순)
          </h3>
          {topStories.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-[11px] text-muted-foreground">
              최근 12시간에 시각이 확인된 기사가 없습니다. 소스가 응답하지 않았거나(소스 상태 참조) 아직 수집 전입니다.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {topStories.map((s, i) => (
                <li key={s.id} className="rounded-md border border-border bg-background/40 px-2.5 py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                    <span className="font-bold text-foreground/70">{i + 1}</span>
                    <TimeStamp publishedAt={s.publishedAt} precision={s.precision} tz={tz} />
                    <SourceBadge item={s} />
                    <ImportanceChip item={s} />
                  </div>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-[12.5px] font-semibold leading-snug hover:underline">
                    {s.title}
                  </a>
                  {(s.importance?.reasons.length ?? 0) > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.importance!.reasons.slice(0, 4).map((r) => (
                        <span key={r} className="rounded bg-muted/70 px-1.5 py-0.5 text-[9.5px] text-muted-foreground">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                  {(s.cluster?.members?.length ?? 0) > 0 && (
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]">
                      {s.cluster!.members!.map((m) => (
                        <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {m.sourceName}
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          <div>
            <h3 className="mb-1.5 inline-flex items-center gap-1 text-[11px] font-semibold">
              <TrendingUp className="size-3.5 text-desk-teal" /> 테마 모멘텀 (최근 6시간 vs 이전 24시간)
            </h3>
            {themes.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">6시간 내 2건 이상 반복된 용어가 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {themes.map((t) => (
                  <li key={t.term} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate font-medium">{t.term}</span>
                    <span className="shrink-0 tabular text-muted-foreground">
                      6h {t.recent}건 · 이전 24h {t.prior}건
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {events !== undefined && (
            <div>
              <h3 className="mb-1.5 inline-flex items-center gap-1 text-[11px] font-semibold">
                <CalendarClock className="size-3.5 text-desk-gold" /> 예정 일정
              </h3>
              {events.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">{eventsNote ?? "확인된 일정 소스가 없습니다."}</p>
              ) : (
                <ul className="space-y-1">
                  {events.map((e) => (
                    <li key={e.id} className="text-[11px]">
                      <span className="tabular text-muted-foreground">{e.when}</span>{" "}
                      {e.url ? (
                        <a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {e.title}
                        </a>
                      ) : (
                        e.title
                      )}
                      <span className="text-[10px] text-muted-foreground"> · {e.source}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {extra}
          {aiSlot}
        </div>
      </div>
    </section>
  );
}
