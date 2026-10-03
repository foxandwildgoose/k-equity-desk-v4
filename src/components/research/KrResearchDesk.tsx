import { Fragment, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Flame, Loader2, Search, Sparkles } from "lucide-react";
import type { ResearchReport } from "@/server/naver-market";
import type { SectorId } from "@/data/types";
import { RESEARCH_SECTOR_RULES } from "@/data/research-taxonomy";
import { useResearchBriefing, useResearchList, usePdfPreResolver, type ResearchTab } from "@/lib/use-research";
import { V2_LABEL, targetDeltaPct } from "@/lib/research/naver-v2";
import { dateGroupLabel, kstToday } from "@/lib/feed/time";
import { matchesSearchQuery } from "@/lib/search-match";
import { formatPrice } from "@/lib/format";
import { useAppStore, usePriceColors } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { ResearchCard, reportTime, RatingBadge } from "@/components/research/ResearchCard";
import { ResearchDetailSheet } from "@/components/research/ResearchDetailSheet";
import { EmptyState } from "@/components/feed/EmptyState";
import { useNow } from "@/components/feed/TimeStamp";
import { cn } from "@/lib/utils";
import { AiBriefingPanel } from "@/components/ai/AiBriefingPanel";
import type { AiInputItem } from "@/lib/ai/briefing";

const TABS: { id: ResearchTab; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "company", label: V2_LABEL.company },
  { id: "industry", label: V2_LABEL.industry },
  { id: "invest", label: V2_LABEL.invest },
  { id: "economy", label: V2_LABEL.economy },
  { id: "debenture", label: V2_LABEL.debenture },
  { id: "market", label: V2_LABEL.market },
];

/** On-screen reports → optional AI briefing input (F9.2): title, extractive summary, broker, time, page link — never PDFs. */
function researchAiItems(reports: readonly ResearchReport[]): AiInputItem[] {
  return reports.slice(0, 30).map((r) => ({
    id: String(r.researchId),
    title: `${r.nameKo ? `${r.nameKo} · ` : ""}${r.title}`,
    snippet: r.summary || undefined,
    source: r.broker,
    time: reportTime(r).publishedAt ?? "날짜 미상",
    url: r.pageUrl,
  }));
}

/** Former fixed coverage names, kept only as part of the 관심종목 filter (F2.2). */
export const FEATURED_CODES = ["005930", "000660", "373220", "034020", "005380", "207940", "009540"];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
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

export function ResearchBriefingStrip() {
  const q = useResearchBriefing();
  const colors = usePriceColors();
  const b = q.data;
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-3" aria-label="리서치 브리핑" data-testid="research-briefing">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="font-semibold">오늘 발간</span>
        {(b?.todayCounts ?? []).map((c) => (
          <span key={c.type} className="rounded-md border border-border px-2 py-0.5 tabular">
            {c.label} {c.count ?? "—"}
          </span>
        ))}
        {q.isLoading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
        {b && b.todayCounts.every((c) => c.count == null) && <span className="text-muted-foreground">집계를 받지 못했습니다 (소스 미검증일 수 있음)</span>}
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        {(["up", "down"] as const).map((dir) => {
          const rows = dir === "up" ? b?.up ?? [] : b?.down ?? [];
          return (
            <div key={dir} className="rounded-lg border border-border p-2">
              <div className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold">
                {dir === "up" ? <ArrowUpRight className={cn("size-3.5", colors.up)} /> : <ArrowDownRight className={cn("size-3.5", colors.down)} />}
                목표주가 {dir === "up" ? "상향" : "하향"} TOP
              </div>
              {rows.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">{q.isLoading ? "…" : "데이터 없음"}</p>
              ) : (
                <ul className="space-y-0.5 text-[11px]">
                  {rows.map((m, i) => (
                    <li key={`${m.nid}-${i}`} className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {m.itemCode ? (
                          <Link to="/stock/$ticker" params={{ ticker: m.itemCode }} className="hover:underline">
                            {m.itemName ?? m.itemCode}
                          </Link>
                        ) : (
                          m.itemName ?? "—"
                        )}{" "}
                        <span className="text-[10px] text-muted-foreground">{m.broker}</span>
                      </span>
                      <span className="shrink-0 tabular">
                        {m.targetPrice != null ? formatPrice(m.targetPrice) : "—"}
                        {m.deltaPct != null && (
                          <span className={cn("ml-1", m.deltaPct > 0 ? colors.up : colors.down)}>
                            {m.deltaPct > 0 ? "+" : ""}
                            {m.deltaPct.toFixed(1)}%
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        <div className="rounded-lg border border-border p-2">
          <div className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold">
            <Flame className="size-3.5 text-price-up" /> 주간 인기
          </div>
          {(b?.weeklyHot ?? []).length === 0 ? (
            <p className="text-[10px] text-muted-foreground">{q.isLoading ? "…" : "데이터 없음"}</p>
          ) : (
            <ul className="space-y-0.5 text-[11px]">
              {b!.weeklyHot.map((r) => (
                <li key={r.researchId} className="truncate">
                  <a href={r.pageUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {r.title}
                  </a>
                  <span className="text-[10px] text-muted-foreground"> · {r.broker}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border p-2">
          <div className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold">
            <Sparkles className="size-3.5 text-desk-indigo" /> 신규 커버리지 <span className="font-normal text-muted-foreground">(제목 키워드 추정)</span>
          </div>
          {(b?.newCoverage ?? []).length === 0 ? (
            <p className="text-[10px] text-muted-foreground">{q.isLoading ? "…" : "오늘 해당 없음"}</p>
          ) : (
            <ul className="space-y-0.5 text-[11px]">
              {b!.newCoverage.map((r) => (
                <li key={r.researchId} className="truncate">
                  <a href={r.pageUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {r.nameKo ? `${r.nameKo} · ` : ""}
                    {r.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/** F2.8 KR Street Moves: latest report per (ticker, broker) for watchlist names. */
export function KrStreetMoves({ reports }: { reports: ResearchReport[] }) {
  const colors = usePriceColors();
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: ResearchReport[] = [];
    for (const r of reports) {
      if (!r.code || (!r.rating && !r.targetPrice)) continue;
      const k = `${r.code}|${r.broker}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
    return out.slice(0, 40);
  }, [reports]);
  if (!rows.length) return null;
  return (
    <section className="rounded-xl border border-border bg-card" aria-label="KR Street Moves">
      <h3 className="border-b border-border px-3 py-2 text-[12px] font-semibold">KR Street Moves · 관심종목 증권사별 최신</h3>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-muted/90 text-muted-foreground backdrop-blur">
            <tr>
              <th className="px-2 py-1.5 text-left">일자</th>
              <th className="px-2 py-1.5 text-left">종목</th>
              <th className="px-2 py-1.5 text-left">증권사</th>
              <th className="px-2 py-1.5 text-left">의견</th>
              <th className="px-2 py-1.5 text-right">TP</th>
              <th className="px-2 py-1.5 text-right">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const d = targetDeltaPct(r);
              const t = reportTime(r);
              return (
                <tr key={`${r.code}-${r.broker}-${r.researchId}`}>
                  <td className="px-2 py-1.5 tabular text-muted-foreground">{t.publishedAt ? t.publishedAt.slice(5, 10).replace("-", ".") : "—"}</td>
                  <td className="px-2 py-1.5">
                    <Link to="/stock/$ticker" params={{ ticker: r.code! }} className="hover:underline">
                      {r.nameKo ?? r.code}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5">{r.broker}</td>
                  <td className="px-2 py-1.5">
                    <RatingBadge rating={r.rating} />
                  </td>
                  <td className="px-2 py-1.5 text-right tabular">{r.targetPrice ? formatPrice(r.targetPrice) : "—"}</td>
                  <td className={cn("px-2 py-1.5 text-right tabular", d == null ? "text-muted-foreground" : d > 0 ? colors.up : d < 0 ? colors.down : "")}>
                    {d == null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-1.5 text-[10px] text-muted-foreground">Δ는 같은 증권사의 직전 리포트를 실제로 받아온 경우에만 표시합니다.</p>
    </section>
  );
}

/**
 * KR research desk (F2): tabs 전체·기업·산업·시황/전략·경제·채권·데일리,
 * newest first with date headers, counts, 더 보기 (next index), 관심종목 and
 * industry filters, briefing strip, detail sheet.
 */
export function KrResearchDesk({ defaultTab = "all", defaultSector }: { defaultTab?: ResearchTab; defaultSector?: SectorId }) {
  const [tab, setTab] = useState<ResearchTab>(defaultTab);
  const [watchOnly, setWatchOnly] = useState(false);
  const [sector, setSector] = useState<SectorId | "all">(defaultSector ?? "all");
  const [broker, setBroker] = useState("all");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<ResearchReport | null>(null);
  const watchlist = useAppStore((s) => s.watchlist);
  const watchCodes = useMemo(() => [...new Set([...watchlist, ...FEATURED_CODES])].filter((c) => /^\d{6}$/.test(c)).slice(0, 10), [watchlist]);
  const effectiveTab: ResearchTab = watchOnly ? "company" : tab;
  const list = useResearchList(effectiveTab, { itemCodes: watchOnly ? watchCodes : undefined });
  const watchList = useResearchList("company", { itemCodes: watchCodes });
  const pre = usePdfPreResolver();
  const now = useNow(60_000);

  const brokers = useMemo(() => [...new Set(list.reports.map((r) => r.broker))].sort(), [list.reports]);
  const visible = useMemo(() => {
    const needle = q.trim();
    return list.reports.filter((r) => {
      if (sector !== "all" && !r.sectorIds.includes(sector)) return false;
      if (broker !== "all" && r.broker !== broker) return false;
      if (needle && !matchesSearchQuery(needle, [r.title, r.summary, r.preview, r.broker, r.nameKo, r.code, r.categoryLabel])) return false;
      return true;
    });
  }, [list.reports, sector, broker, q]);

  const today = now ? kstToday(now) : null;
  const todayCount = today ? visible.filter((r) => reportTime(r).publishedAt?.slice(0, 10) === today).length : 0;
  const weekCount = now ? visible.filter((r) => {
    const t = reportTime(r).publishedAt;
    return t != null && Date.parse(t) >= now - 7 * 86_400_000;
  }).length : 0;

  let lastDay: string | null | undefined;
  return (
    <div className="space-y-3">
      <ResearchBriefingStrip />
      <KrStreetMoves reports={watchList.reports} />

      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="리서치 분류">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={!watchOnly && tab === t.id}
            onClick={() => {
              setWatchOnly(false);
              setTab(t.id);
            }}
            className={cn(
              "min-h-9 rounded-md px-2.5 text-[12px] font-medium",
              !watchOnly && tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={watchOnly}
          onClick={() => setWatchOnly(true)}
          className={cn("min-h-9 rounded-md px-2.5 text-[12px] font-medium", watchOnly ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          title="관심종목 + 주요 종목(앞 10개) 기업 리포트"
        >
          관심종목
        </button>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-muted/15 p-2.5">
        <div className="flex flex-wrap gap-1" aria-label="산업(고정 분류)">
          <Chip active={sector === "all"} onClick={() => setSector("all")}>
            전체 산업
          </Chip>
          {RESEARCH_SECTOR_RULES.map((rule) => (
            <Chip key={rule.sectorId} active={sector === rule.sectorId} onClick={() => setSector(rule.sectorId)}>
              {rule.label}
            </Chip>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·요약·종목·증권사 검색" className="h-9 pl-8 text-xs" aria-label="리서치 검색" />
          </div>
          <select value={broker} onChange={(e) => setBroker(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-xs" aria-label="증권사">
            <option value="all">전체 증권사</option>
            {brokers.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground" data-testid="research-counts">
        <span>
          오늘 {todayCount}건 · 이번 주 {weekCount}건 · 전체 {list.totalCount != null ? list.totalCount.toLocaleString("ko-KR") : "—"}
          {list.totalCount == null && list.paths.includes("legacy") ? " (레거시 경로: 총건수 미제공)" : ""}
        </span>
        <span>
          경로 {list.paths.join("·") || "—"} {watchOnly ? `· 관심종목 ${watchCodes.length}개 기준` : ""}
        </span>
      </div>
      <AiBriefingPanel items={researchAiItems(visible)} context="국내 증권사 리서치" />

      {visible.length === 0 ? (
        list.isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-10 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> 리서치 수신 중
          </div>
        ) : (
          <EmptyState
            reason={
              list.reports.length
                ? "현재 필터에 맞는 리포트가 없습니다."
                : `리서치를 받지 못했습니다${list.errors[0] ? ` (${list.errors[0]})` : ""}. 목록을 채워 넣지 않습니다.`
            }
          />
        )
      ) : (
        <ul className="flex flex-col gap-2" data-research-list>
          {visible.map((r) => {
            const t = reportTime(r);
            const day = t.publishedAt ? t.publishedAt.slice(0, 10) : null;
            const header = day !== lastDay;
            lastDay = day;
            const key = `${r.v2Type ?? r.category}:${r.researchId}`;
            return (
              <Fragment key={key}>
                {header && (
                  <li className="px-1 pt-1 text-[10px] font-semibold text-muted-foreground" data-date-header={day ?? "unknown"}>
                    {now == null && day ? day.replace(/-/g, ".") : dateGroupLabel(day, now ?? undefined)}
                  </li>
                )}
                <ResearchCard report={r} resolvedPdf={pre.resolved.get(key)} onDetail={setActive} observeRef={(el) => pre.observe(el, r)} />
              </Fragment>
            );
          })}
        </ul>
      )}
      {list.hasNextPage && (
        <button
          type="button"
          onClick={() => void list.fetchNextPage()}
          disabled={list.isFetchingNextPage}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md border border-border text-xs font-semibold text-primary hover:bg-muted/50 disabled:opacity-60"
        >
          {list.isFetchingNextPage && <Loader2 className="size-3.5 animate-spin" />} 더 보기
        </button>
      )}

      <ResearchDetailSheet report={active} onClose={() => setActive(null)} onBrokerFilter={(b) => { setBroker(b); setActive(null); }} onOpenReport={setActive} />
    </div>
  );
}
