import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { originalUrlForNote, type UsStreetPack } from "@/lib/us-street";
import type { UsOfficialUniverse } from "@/lib/us-official-parse";
import { toStreetMove } from "@/lib/street-moves";
import { parseSourceTime, zonedParts } from "@/lib/feed/time";
import { useUsCalendar } from "@/lib/use-feed";
import { useNow } from "@/components/feed/TimeStamp";
import { OriginTierBadge } from "@/components/research/UsResearchKit";
import { usePriceColors } from "@/lib/store";
import { cn } from "@/lib/utils";
import { compareNewestFirst } from "@/lib/feed/sort";
import { AiBriefingPanel } from "@/components/ai/AiBriefingPanel";
import type { AiInputItem } from "@/lib/ai/briefing";

function etDay(ms: number): string {
  const p = zonedParts(ms, "America/New_York");
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Street notes + headlines on screen → optional AI briefing input (F9.2), newest first, ≤ 30. */
function usResearchAiItems(street: UsStreetPack | undefined): AiInputItem[] {
  if (!street) return [];
  const rows = [
    ...street.notes.map((n) => ({
      id: `note:${n.id}`,
      publishedAt: n.publishedAt,
      precision: n.precision,
      sourceTier: 2 as const,
      ai: {
        id: `note:${n.id}`,
        title: `${n.symbol} · ${n.broker} ${n.action}${n.rating ? ` ${n.rating}` : ""}${n.target ? ` (목표 ${n.target})` : ""}`,
        snippet: n.summary || undefined,
        source: n.sourceLabel,
        time: n.publishedAt ?? "날짜 미상",
        url: originalUrlForNote(n, street.headlines).url,
      },
    })),
    ...street.headlines.map((h) => ({
      id: `head:${h.id}`,
      publishedAt: h.publishedAt,
      precision: h.precision,
      sourceTier: 3 as const,
      ai: { id: `head:${h.id}`, title: `${h.symbol} · ${h.title}`, source: h.source, time: h.publishedAt ?? "날짜 미상", url: h.url },
    })),
  ];
  return rows.sort(compareNewestFirst).slice(0, 30).map((r) => r.ai);
}

/**
 * F4.7 "US 리서치 브리핑": tier counts (today / 7 days), today's top up/down
 * grades, the day's filings for the universe, and the next macro releases.
 * Counts only what was actually fetched.
 */
export function UsResearchBriefing({ street, official }: { street?: UsStreetPack; official?: UsOfficialUniverse }) {
  const now = useNow(60_000);
  const cal = useUsCalendar();
  const colors = usePriceColors();
  const stats = useMemo(() => {
    if (now == null) return null;
    const today = etDay(now);
    const weekAgo = now - 7 * 86_400_000;
    const inDay = (iso: string | null) => (iso ? etDay(Date.parse(iso)) === today : false);
    const inWeek = (iso: string | null) => (iso ? Date.parse(iso) >= weekAgo : false);
    const notes = street?.notes ?? [];
    const heads = street?.headlines ?? [];
    const filings = [...(official?.filings ?? []), ...(official?.earnings ?? [])].map((f) => ({ ...f, iso: parseSourceTime(f.publishedAt, { zone: "America/New_York" }).iso }));
    const moves = notes.map((n) => toStreetMove(n));
    return {
      tiers: [
        { tier: "OFFICIAL" as const, today: filings.filter((f) => inDay(f.iso)).length, week: filings.filter((f) => inWeek(f.iso)).length },
        { tier: "PUBLIC_RESEARCH" as const, today: 0, week: 0 },
        { tier: "STREET" as const, today: notes.filter((n) => inDay(n.publishedAt)).length, week: notes.filter((n) => inWeek(n.publishedAt)).length },
        { tier: "NEWS" as const, today: heads.filter((h) => inDay(h.publishedAt)).length, week: heads.filter((h) => inWeek(h.publishedAt)).length },
      ],
      up: moves.filter((m) => m.action === "Upgrade" && inDay(m.publishedAt)).slice(0, 5),
      down: moves.filter((m) => m.action === "Downgrade" && inDay(m.publishedAt)).slice(0, 5),
      filingsToday: filings.filter((f) => inDay(f.iso)).slice(0, 6),
    };
  }, [now, street, official]);
  const nextMacro = (cal.data?.events ?? []).filter((e) => e.kind === "scheduled").slice(0, 4);
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-3" aria-label="US 리서치 브리핑" data-testid="us-research-briefing">
      <h3 className="text-[12px] font-semibold">US 리서치 브리핑 <span className="font-normal text-muted-foreground">(뉴욕 날짜 기준)</span></h3>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {(stats?.tiers ?? []).map((t) => (
          <span key={t.tier} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5">
            <OriginTierBadge tier={t.tier} /> 오늘 {t.today} · 7일 {t.week}
          </span>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        {(["up", "down"] as const).map((dir) => {
          const rows = dir === "up" ? stats?.up ?? [] : stats?.down ?? [];
          return (
            <div key={dir} className="rounded-lg border border-border p-2 text-[11px]">
              <div className={cn("mb-1 font-semibold", dir === "up" ? colors.up : colors.down)}>오늘 {dir === "up" ? "상향" : "하향"}</div>
              {rows.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">없음 또는 미수신</p>
              ) : (
                <ul className="space-y-0.5">
                  {rows.map((m) => (
                    <li key={m.id} className="truncate">
                      <Link to="/us/$symbol" params={{ symbol: m.ticker }} className="font-semibold hover:underline">
                        {m.ticker}
                      </Link>{" "}
                      {m.broker} {m.ratingTo ? `→ ${m.ratingTo}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        <div className="rounded-lg border border-border p-2 text-[11px]">
          <div className="mb-1 font-semibold">오늘 공시 (유니버스)</div>
          {(stats?.filingsToday ?? []).length === 0 ? (
            <p className="text-[10px] text-muted-foreground">없음 또는 미수신</p>
          ) : (
            <ul className="space-y-0.5">
              {stats!.filingsToday.map((f) => (
                <li key={f.id} className="truncate">
                  {f.url ? (
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {f.tickers[0] ?? ""} {f.badge}
                    </a>
                  ) : (
                    `${f.tickers[0] ?? ""} ${f.badge}`
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border p-2 text-[11px]">
          <div className="mb-1 font-semibold">다음 매크로 발표</div>
          {nextMacro.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">{cal.isLoading ? "…" : "일정 미수신"}</p>
          ) : (
            <ul className="space-y-0.5">
              {nextMacro.map((e) => (
                <li key={e.id} className="truncate">
                  <span className="tabular text-muted-foreground">{e.dateLabel}</span> {e.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <AiBriefingPanel items={usResearchAiItems(street)} context="미국 리서치·월가 등급" />
    </section>
  );
}
