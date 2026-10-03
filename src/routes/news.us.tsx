import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageDisclaimer } from "@/components/feed/PageDisclaimer";
import { BriefingDigest, type BriefingEvent, type SnapshotTile } from "@/components/feed/BriefingDigest";
import { SourceHealthChip } from "@/components/feed/SourceHealthChip";
import { NewsDesk } from "@/components/feed/NewsDesk";
import { TimeStamp, useNow } from "@/components/feed/TimeStamp";
import { useFeed, useMarketSnapshot, useUsCalendar } from "@/lib/use-feed";
import { themeMomentum, topStories } from "@/lib/feed/briefing";
import { usSessionEstimate } from "@/lib/feed/session";
import { parseSourceTime, formatAbsoluteTime } from "@/lib/feed/time";
import { useAppStore } from "@/lib/store";
import { TzToggle } from "@/components/feed/TzToggle";
import { AiBriefingPanel, AiTranslateButton, feedToAiItems } from "@/components/ai/AiBriefingPanel";

export const Route = createFileRoute("/news/us")({
  component: UsNewsPage,
  head: () => ({ meta: [{ title: "미국 뉴스 브리핑 · Korea Equity Command Center" }] }),
});

const KINDS = [
  { id: "news", label: "뉴스" },
  { id: "policy", label: "정책" },
  { id: "rating", label: "등급" },
  { id: "filing", label: "SEC 공시" },
];

function fmt(n: number, digits = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function UsNewsPage() {
  const feed = useFeed({ region: "US", limit: 60 });
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const snap = useMarketSnapshot();
  const cal = useUsCalendar();
  const tz = useAppStore((s) => s.newsPrefs.tz);
  const now = useNow(60_000);

  // Shell queries (MarketBar) can settle before this lazy route hydrates:
  // render query-dependent parts only after mount (`now` is null in SSR).
  const mounted = now != null;
  const tiles = useMemo<SnapshotTile[]>(
    () =>
      (mounted ? (snap.data?.rows ?? []) : []).map((r) => ({
        id: r.id,
        label: r.label,
        value: r.price != null ? fmt(r.price, r.id === "btc" ? 0 : 2) : null,
        change: r.change != null ? `${r.change > 0 ? "+" : ""}${fmt(r.change, r.id === "btc" ? 0 : 2)}` : null,
        changePct: r.changePct,
        source: r.source,
        delay: r.delayMinutes ? `지연 ${r.delayMinutes}분` : "지연 시세",
        asOf: r.asOf,
        reason: r.error ? "미수신" : undefined,
      })),
    [snap.data, mounted],
  );

  const events = useMemo<BriefingEvent[] | undefined>(() => {
    if (!cal.data || !mounted) return undefined;
    return cal.data.events.map((e) => {
      const t = parseSourceTime(e.iso, { zone: "America/New_York" });
      return {
        id: e.id,
        when: `${formatAbsoluteTime({ publishedAt: t.iso, precision: t.precision }).replace(" (날짜만 제공)", "")}${e.timeLabel ? ` ${e.timeLabel} ET` : ""}`,
        title: e.title,
        source: e.sourceName,
        url: e.url,
      };
    });
  }, [cal.data]);

  const session = now != null ? usSessionEstimate(now) : null;
  const stories = useMemo(() => (now ? topStories(feed.items, { now }) : []), [feed.items, now]);
  const themes = useMemo(() => (now ? themeMomentum(feed.items, { now }) : []), [feed.items, now]);

  return (
    <div className="page-stack">
      <PageHeader
        kicker="US News Briefing · 미국 증시"
        title="미국 뉴스 브리핑"
        lead="Bloomberg 공개 RSS 헤드라인, 네이버 해외뉴스(Reuters), 연준 보도자료, 월가 공개 등급, Google News를 최신순으로 모았습니다. 유료 매체는 제목과 링크만 표시합니다."
        aside={
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <div className="flex items-center gap-2">
              {session && (
                <span className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold" title="뉴욕 시계 기준 추정 · 휴장일 미반영" data-testid="us-session">
                  {session.label} <span className="font-normal text-muted-foreground">(추정)</span>
                </span>
              )}
              <TzToggle />
            </div>
            <span className="text-[11px] text-muted-foreground">
              기준 {feed.generatedAt ? <TimeStamp publishedAt={feed.generatedAt} precision="second" tz={tz} withEt /> : "—"}
            </span>
            <SourceHealthChip sources={feed.sources} />
          </div>
        }
      />
      <PageDisclaimer extra="미국 시세 타일은 Yahoo Finance 지연 시세입니다." />
      <BriefingDigest
        asOf={feed.generatedAt}
        session={session ? { label: session.label, estimated: true, detail: "뉴욕 시계 기준 · 휴장일 미반영" } : null}
        tiles={tiles.length ? tiles : undefined}
        topStories={stories}
        themes={themes}
        events={events ?? []}
        eventsNote={!mounted || cal.isLoading ? "일정 불러오는 중…" : "향후 7일 내 연준·BEA 일정을 받지 못했습니다(소스 미검증일 수 있음)."}
        tz={tz}
        aiSlot={
          <>
            <AiBriefingPanel items={feedToAiItems(feed.items)} context="미국 증시 뉴스" />
            <AiTranslateButton items={feed.items} onResult={setTranslations} />
          </>
        }
      />
      <NewsDesk
        items={feed.items}
        sources={feed.sources}
        loading={feed.isLoading}
        hasMore={Boolean(feed.hasNextPage)}
        loadingMore={feed.isFetchingNextPage}
        onLoadMore={() => void feed.fetchNextPage()}
        tz={tz}
        withEt
        kinds={KINDS}
        translations={translations}
      />
    </div>
  );
}
