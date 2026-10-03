import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageDisclaimer } from "@/components/feed/PageDisclaimer";
import { BriefingDigest, type SnapshotTile } from "@/components/feed/BriefingDigest";
import { SourceHealthChip } from "@/components/feed/SourceHealthChip";
import { NewsDesk } from "@/components/feed/NewsDesk";
import { NaverAiBriefingCard } from "@/components/feed/NaverAiBriefingCard";
import { AiBriefingPanel, feedToAiItems } from "@/components/ai/AiBriefingPanel";
import { TimeStamp, useNow } from "@/components/feed/TimeStamp";
import { useFeed, useMarketSnapshot } from "@/lib/use-feed";
import { useMarketIndices } from "@/lib/use-market";
import { themeMomentum, topStories } from "@/lib/feed/briefing";
import { krIndexStatusLabel, krSessionEstimate } from "@/lib/feed/session";

export const Route = createFileRoute("/news/kr")({
  component: KrNewsPage,
  head: () => ({ meta: [{ title: "한국 뉴스 브리핑 · Korea Equity Command Center" }] }),
});

const KINDS = [
  { id: "news", label: "뉴스" },
  { id: "disclosure", label: "공시" },
];

function fmt(n: number, digits = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function KrNewsPage() {
  const feed = useFeed({ region: "KR", limit: 60 });
  const indices = useMarketIndices();
  const fx = useMarketSnapshot(["usdkrw"]);
  const now = useNow(60_000);

  // Shell queries (MarketBar) can settle before this lazy route hydrates:
  // keep the SSR state until mounted (`now` is null during SSR).
  const mounted = now != null;
  const tiles = useMemo<SnapshotTile[]>(() => {
    const out: SnapshotTile[] = [];
    const byId = new Map((mounted ? (indices.data?.indices ?? []) : []).map((i) => [i.id, i]));
    for (const [id, label] of [
      ["kospi", "코스피"],
      ["kosdaq", "코스닥"],
      ["kpi200", "코스피200"],
    ] as const) {
      const i = byId.get(id);
      out.push({
        id,
        label,
        value: i ? fmt(i.value) : null,
        change: i ? `${i.change > 0 ? "+" : ""}${fmt(i.change)}` : null,
        changePct: i ? i.changePct : null,
        source: "네이버 스냅샷",
        delay: "약 30초 갱신",
        reason: !mounted || indices.isLoading ? "수신 중" : "지수 미수신",
      });
    }
    const usd = mounted ? fx.data?.rows.find((r) => r.id === "usdkrw") : undefined;
    out.push({
      id: "usdkrw",
      label: "원/달러",
      value: usd?.price != null ? fmt(usd.price) : null,
      change: usd?.change != null ? `${usd.change > 0 ? "+" : ""}${fmt(usd.change)}` : null,
      changePct: usd?.changePct ?? null,
      source: "Yahoo Finance",
      delay: usd?.delayMinutes ? `지연 ${usd.delayMinutes}분` : "지연 시세",
      reason: !mounted || fx.isLoading ? "수신 중" : "환율 미수신",
    });
    return out;
  }, [indices.data, indices.isLoading, fx.data, fx.isLoading, mounted]);

  const sourceSession = mounted ? krIndexStatusLabel(indices.data?.indices?.[0]?.marketStatus) : null;
  const session = sourceSession
    ? { label: sourceSession, detail: "네이버 지수 marketStatus" }
    : now != null
      ? { ...krSessionEstimate(now), detail: "KST 시계 기준 추정 · 휴장일 미반영" }
      : null;

  const stories = useMemo(() => (now ? topStories(feed.items, { now }) : []), [feed.items, now]);
  const themes = useMemo(() => (now ? themeMomentum(feed.items, { now }) : []), [feed.items, now]);

  return (
    <div className="page-stack">
      <PageHeader
        kicker="KR News Briefing · 한국 증시"
        title="한국 뉴스 브리핑"
        lead="네이버 증권 속보·주요뉴스·포커스, 한국경제 RSS, Google 뉴스, KRX·DART 공시를 모아 최신순으로 보여줍니다. 모든 항목은 출처와 원문 링크를 가집니다."
        aside={
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <span className="text-[11px] text-muted-foreground">
              기준 {feed.generatedAt ? <TimeStamp publishedAt={feed.generatedAt} precision="second" /> : "—"}
              {session ? ` · ${session.label}${"estimated" in session ? " (추정)" : ""}` : ""}
            </span>
            <SourceHealthChip sources={feed.sources} />
          </div>
        }
      />
      <PageDisclaimer />
      <BriefingDigest
        asOf={feed.generatedAt}
        session={session ? { label: session.label, estimated: "estimated" in session, detail: session.detail } : null}
        tiles={tiles}
        topStories={stories}
        themes={themes}
        extra={<NaverAiBriefingCard />}
        aiSlot={<AiBriefingPanel items={feedToAiItems(feed.items)} context="한국 증시 뉴스" />}
      />
      <NewsDesk
        items={feed.items}
        sources={feed.sources}
        loading={feed.isLoading}
        hasMore={Boolean(feed.hasNextPage)}
        loadingMore={feed.isFetchingNextPage}
        onLoadMore={() => void feed.fetchNextPage()}
        kinds={KINDS}
      />
    </div>
  );
}
