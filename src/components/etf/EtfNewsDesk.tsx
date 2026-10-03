import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, ShieldCheck } from "lucide-react";
import { BriefingDigest, type SnapshotTile } from "@/components/feed/BriefingDigest";
import { NewsDesk } from "@/components/feed/NewsDesk";
import { SourceHealthChip } from "@/components/feed/SourceHealthChip";
import { TimeStamp, useNow } from "@/components/feed/TimeStamp";
import { SourceBadge } from "@/components/feed/FeedRow";
import { AiBriefingPanel, feedToAiItems } from "@/components/ai/AiBriefingPanel";
import { useFeed } from "@/lib/use-feed";
import { useEtfNewsSnapshot } from "@/lib/use-themes";
import { themeMomentum, topStories } from "@/lib/feed/briefing";
import {
  applyEtfNewsFilter,
  buildEtfBriefing,
  EMPTY_ETF_FILTER,
  ETF_ISSUER_BRANDS,
  ETF_STAGE_LABEL,
  ETF_THEMES,
  type EtfNewsFilter,
  type EtfStage,
} from "@/lib/etf-news";
import type { FeedItem } from "@/lib/feed/types";
import { formatPct, formatPrice } from "@/lib/format";
import { usePriceColors } from "@/lib/store";
import { cn } from "@/lib/utils";

const STAGES: EtfStage[] = ["listed", "scheduled", "delisting", "flow", "retirement", "other"];

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center rounded-md border px-2 text-[11px] font-medium sm:min-h-7",
        on ? "border-foreground/30 bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function BriefList({ title, items, window, empty }: { title: string; items: FeedItem[]; window: string; empty: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border p-2" data-etf-brief={title}>
      <div className="mb-1 text-[11px] font-semibold">
        {title} <span className="font-normal text-muted-foreground">({window})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[10.5px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.id} className="min-w-0 text-[11px]">
              <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground">
                <TimeStamp publishedAt={it.publishedAt} precision={it.precision} />
                <SourceBadge item={it} />
              </div>
              <a href={it.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 font-medium hover:underline">
                {it.title}
              </a>
              {it.etf && (
                <Link to="/etfs/$code" params={{ code: it.etf.code }} className="text-[10px] text-primary hover:underline">
                  {it.etf.name} →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * KR ETF News Briefing (F5): ETF-only stories from GN topic + issuer queries,
 * Hankyung finance (ETF keyword filter) and Naver search, matched to the live
 * ETF list. Used by `/news/etf` and the `/etfs` "ETF 뉴스" tab.
 */
export function EtfNewsDesk({ embedded = false }: { embedded?: boolean }) {
  const feed = useFeed({ region: "KR", group: "etf", limit: 80 });
  const snap = useEtfNewsSnapshot();
  const now = useNow(60_000);
  const colors = usePriceColors();
  const [ef, setEf] = useState<EtfNewsFilter>(EMPTY_ETF_FILTER);

  const brief = useMemo(() => (now ? buildEtfBriefing(feed.items, [], now) : null), [feed.items, now]);
  const stories = useMemo(() => (now ? topStories(feed.items, { now }) : []), [feed.items, now]);
  const themes = useMemo(() => (now ? themeMomentum(feed.items, { now }) : []), [feed.items, now]);
  const visible = useMemo(() => applyEtfNewsFilter(feed.items, ef), [feed.items, ef]);
  const brandsPresent = useMemo(() => {
    const set = new Set(feed.items.flatMap((it) => it.topics.filter((t) => t.startsWith("brand:")).map((t) => t.slice(6))));
    return ETF_ISSUER_BRANDS.filter((b) => set.has(b.brand));
  }, [feed.items]);
  const themesPresent = useMemo(() => {
    const set = new Set(feed.items.flatMap((it) => it.topics.filter((t) => t.startsWith("theme:")).map((t) => t.slice(6))));
    return ETF_THEMES.filter((t) => set.has(t.id));
  }, [feed.items]);

  const tiles = useMemo<SnapshotTile[]>(
    () =>
      (snap.data?.topTrading ?? []).slice(0, 4).map((e, i) => ({
        id: e.code,
        label: `거래대금 ${i + 1}위 · ${e.name}`,
        value: e.price != null ? `${formatPrice(e.price)}원` : null,
        change: "",
        changePct: e.changePct,
        source: "네이버 ETF 목록",
        delay: "약 60초 캐시",
        reason: "시세 미수신",
      })),
    [snap.data?.topTrading],
  );

  const snapshotNote = snap.isLoading ? "ETF 목록 수신 중…" : snap.data?.error ? `ETF 목록 미수신 (${snap.data.error})` : null;

  return (
    <div className="space-y-3" data-testid="etf-news-desk">
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            ETF 뉴스 브리핑 · 기준 {feed.generatedAt ? <TimeStamp publishedAt={feed.generatedAt} precision="second" /> : "—"} ·{" "}
            <Link to="/news/etf" className="font-semibold text-primary hover:underline">
              전체 화면 →
            </Link>
          </span>
          <SourceHealthChip sources={feed.sources} />
        </div>
      )}
      <BriefingDigest
        asOf={feed.generatedAt}
        tiles={tiles}
        topStories={stories}
        themes={themes}
        extra={
          <div className="space-y-2">
            {snapshotNote && <p className="text-[10.5px] text-muted-foreground">{snapshotNote}</p>}
            {(snap.data?.robotAi.length ?? 0) > 0 && (
              <div>
                <h3 className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold">
                  <Bot className="size-3.5 text-desk-teal" /> 로봇·AI ETF <span className="font-normal text-muted-foreground">(이름 기준 · 네이버 ETF 목록)</span>
                </h3>
                <div className="flex flex-wrap gap-1" data-testid="etf-robot-chips">
                  {snap.data!.robotAi.map((e) => (
                    <Link
                      key={e.code}
                      to="/etfs/$code"
                      params={{ code: e.code }}
                      className="inline-flex min-h-8 items-center gap-1 rounded-md border border-border px-1.5 text-[10.5px] hover:bg-muted/50"
                    >
                      <span className="max-w-[11rem] truncate">{e.name}</span>
                      <span className={cn("tabular", (e.changePct ?? 0) > 0 && colors.up, (e.changePct ?? 0) < 0 && colors.down)}>
                        {e.changePct != null ? formatPct(e.changePct) : "—"}
                      </span>
                    </Link>
                  ))}
                </div>
                <Link to="/robotics" search={{ tab: "etf" }} className="mt-1 inline-flex min-h-8 items-center text-[10.5px] font-semibold text-primary hover:underline">
                  로봇 섹션 ETF 탭 →
                </Link>
              </div>
            )}
          </div>
        }
        aiSlot={<AiBriefingPanel items={feedToAiItems(feed.items)} context="국내 ETF 뉴스" />}
      />
      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="ETF 브리핑 목록">
        <BriefList title="신규 상장 · 상장 예정" window="최근 14일 보도" items={brief?.listing ?? []} empty="해당 기사 없음 또는 미수신" />
        <BriefList title="상장폐지 예정" window="최근 30일 보도" items={brief?.delisting ?? []} empty="해당 기사 없음 또는 미수신" />
        <BriefList title="자금 흐름" window="최근 7일" items={brief?.flow ?? []} empty="해당 기사 없음 또는 미수신" />
        <BriefList title="퇴직연금 제도" window="최근 14일" items={brief?.retirement ?? []} empty="해당 기사 없음 또는 미수신" />
      </section>
      <div className="space-y-1.5 rounded-lg border border-border bg-muted/15 p-2.5" data-testid="etf-filter-row">
        <div className="flex flex-wrap items-center gap-1" aria-label="단계">
          <span className="mr-1 text-[10px] font-semibold text-muted-foreground">단계</span>
          {STAGES.map((s) => (
            <Chip key={s} on={ef.stages.includes(s)} onClick={() => setEf({ ...ef, stages: toggle(ef.stages, s) })}>
              {ETF_STAGE_LABEL[s]}
            </Chip>
          ))}
          <Chip on={ef.retirementOnly} onClick={() => setEf({ ...ef, retirementOnly: !ef.retirementOnly })}>
            <ShieldCheck className="mr-0.5 size-3" /> 퇴직연금 가능만
          </Chip>
        </div>
        {brandsPresent.length > 0 && (
          <div className="flex flex-wrap items-center gap-1" aria-label="운용사">
            <span className="mr-1 text-[10px] font-semibold text-muted-foreground">운용사</span>
            {brandsPresent.map((b) => (
              <Chip key={b.brand} on={ef.issuers.includes(b.brand)} onClick={() => setEf({ ...ef, issuers: toggle(ef.issuers, b.brand) })}>
                {b.brand}
              </Chip>
            ))}
          </div>
        )}
        {themesPresent.length > 0 && (
          <div className="flex flex-wrap items-center gap-1" aria-label="테마">
            <span className="mr-1 text-[10px] font-semibold text-muted-foreground">테마</span>
            {themesPresent.map((t) => (
              <Chip key={t.id} on={ef.themes.includes(t.id)} onClick={() => setEf({ ...ef, themes: toggle(ef.themes, t.id) })}>
                {t.label}
              </Chip>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">퇴직연금 가능 = 레버리지·인버스 제외(기존 휴리스틱)이며 운용사 DC/IRP 허용 목록과 다를 수 있습니다.</p>
      </div>
      <NewsDesk
        items={visible}
        sources={feed.sources}
        loading={feed.isLoading}
        hasMore={Boolean(feed.hasNextPage)}
        loadingMore={feed.isFetchingNextPage}
        onLoadMore={() => void feed.fetchNextPage()}
      />
    </div>
  );
}
