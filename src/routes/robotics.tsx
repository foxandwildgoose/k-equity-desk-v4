import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageDisclaimer } from "@/components/feed/PageDisclaimer";
import { SourceHealthChip } from "@/components/feed/SourceHealthChip";
import { NewsDesk } from "@/components/feed/NewsDesk";
import { TimeStamp, useNow } from "@/components/feed/TimeStamp";
import { SourceBadge } from "@/components/feed/FeedRow";
import { ThemeChips } from "@/components/feed/ThemeChips";
import { EmptyState } from "@/components/feed/EmptyState";
import { ResearchCard, reportTime } from "@/components/research/ResearchCard";
import { ResearchDetailSheet } from "@/components/research/ResearchDetailSheet";
import { PublicResearchNote, StreetMovesTable } from "@/components/research/UsResearchKit";
import { CompanyOfficial } from "@/components/research/CompanyOfficial";
import {
  CompanyNewsSheet,
  CompanyTable,
  EtfTable,
  KpiTile,
  MoverList,
  SectionCard,
  UniverseEditor,
} from "@/components/robotics/RoboticsParts";
import { useFeed } from "@/lib/use-feed";
import { useRoboticsCompanyMeta, useRoboticsEtfs, useRoboticsResearch, useRoboticsUniverse } from "@/lib/use-themes";
import { countWithin, equalWeightChange, topMovers } from "@/lib/robotics/classify";
import { compareNewestFirst } from "@/lib/feed/sort";
import type { FeedItem, FeedSourceResult, TimePrecision } from "@/lib/feed/types";
import type { ResearchReport } from "@/server/naver-market";
import type { RoboticsQuoteRow } from "@/server/robotics";
import { cn } from "@/lib/utils";
import { AiBriefingPanel, feedToAiItems } from "@/components/ai/AiBriefingPanel";
import type { AiInputItem } from "@/lib/ai/briefing";

const TABS = [
  { id: "overview", label: "개요" },
  { id: "market", label: "시장 동향" },
  { id: "policy", label: "정책" },
  { id: "companies", label: "기업" },
  { id: "research", label: "리서치" },
  { id: "etf", label: "ETF" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export const Route = createFileRoute("/robotics")({
  component: RoboticsPage,
  validateSearch: (s: Record<string, unknown>): { tab?: TabId } => ({
    tab: TABS.some((t) => t.id === s.tab) ? (s.tab as TabId) : undefined,
  }),
  head: () => ({ meta: [{ title: "로봇 섹션 · Korea Equity Command Center" }] }),
});

interface ResearchRow {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string | null;
  precision: TimePrecision;
  sourceTier: 1 | 2 | 3;
}

function reportRow(r: ResearchReport): ResearchRow {
  const t = reportTime(r);
  return { id: `kr:${r.v2Type ?? r.category}:${r.researchId}`, title: r.nameKo ? `[${r.nameKo}] ${r.title}` : r.title, source: r.broker, url: r.pdfUrl || r.pageUrl, publishedAt: t.publishedAt, precision: t.precision, sourceTier: 3 };
}

/** The overview's on-screen previews (market 5 + policy 5 + research 5) → optional AI input, newest first. */
function overviewAiItems(market: FeedItem[], policy: FeedItem[], research: ResearchRow[]): AiInputItem[] {
  const feed = feedToAiItems([...market.slice(0, 5), ...policy.slice(0, 5)]);
  const byId = new Map<string, AiInputItem>(feed.map((i) => [i.id, i]));
  for (const r of research.slice(0, 5)) byId.set(r.id, { id: r.id, title: r.title, source: r.source, time: r.publishedAt ?? "날짜 미상", url: r.url });
  const sortable = [...market.slice(0, 5), ...policy.slice(0, 5), ...research.slice(0, 5)].map((x) => ({ id: x.id, publishedAt: x.publishedAt, precision: x.precision, sourceTier: x.sourceTier }));
  return sortable.sort(compareNewestFirst).map((x) => byId.get(x.id)).filter((x): x is AiInputItem => x != null);
}

function FeedPreview({ items, empty }: { items: FeedItem[]; empty: string }) {
  if (!items.length) return <p className="text-[10.5px] text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.id} className="min-w-0 text-[11.5px]">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
            <TimeStamp publishedAt={it.publishedAt} precision={it.precision} />
            <SourceBadge item={it} />
            <ThemeChips item={it} max={2} />
          </div>
          <a href={it.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 font-medium hover:underline" lang={it.lang}>
            {it.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

function feedEmptyReason(sources: FeedSourceResult[], loading: boolean): string {
  if (loading) return "수신 중…";
  const active = sources.filter((s) => s.state !== "disabled");
  if (active.length && active.every((s) => !s.ok)) return `소스 ${active.length}곳 모두 응답 없음(소스 미검증·네트워크 차단 등) — 채워 넣지 않습니다.`;
  return "해당 기간 항목 없음";
}

function RoboticsPage() {
  const { tab = "overview" } = Route.useSearch();
  const now = useNow(60_000);
  const market = useFeed({ region: "GLOBAL", group: "robotics-market", limit: 80 });
  const policy = useFeed({ region: "GLOBAL", group: "robotics-policy", limit: 60 });
  const universe = useRoboticsUniverse();
  const needEtf = tab === "overview" || tab === "etf";
  const etfs = useRoboticsEtfs({ enabled: needEtf });
  const krCodes = useMemo(() => universe.kr.map((r) => r.code), [universe.kr]);
  const usSymbols = useMemo(() => universe.us.map((r) => r.code), [universe.us]);
  const research = useRoboticsResearch(krCodes, usSymbols, { enabled: tab === "overview" || tab === "research" });
  const meta = useRoboticsCompanyMeta(krCodes, usSymbols, { enabled: tab === "companies" });
  const [drawer, setDrawer] = useState<RoboticsQuoteRow | null>(null);
  const [detail, setDetail] = useState<ResearchReport | null>(null);
  const [officialSymbol, setOfficialSymbol] = useState<string | null>(null);

  const krReports = useMemo(() => {
    const d = research.data?.kr;
    if (!d) return [] as ResearchReport[];
    const seen = new Set<string>();
    const rows = [...d.company, ...d.industry].filter((r) => {
      const k = `${r.v2Type ?? r.category}:${r.researchId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return rows
      .map((r) => ({ r, row: reportRow(r) }))
      .sort((a, b) => compareNewestFirst(a.row, b.row))
      .map((x) => x.r);
  }, [research.data?.kr]);

  const researchRows = useMemo<ResearchRow[]>(() => {
    const kr = krReports.map(reportRow);
    const us = (research.data?.street.notes ?? []).map((n) => ({
      id: `us:${n.id}`,
      title: `${n.symbol} · ${n.broker} ${n.actionKo || n.action}${n.rating ? ` → ${n.rating}` : ""}`,
      source: n.sourceLabel,
      url: n.pageUrl,
      publishedAt: n.publishedAt,
      precision: n.precision,
      sourceTier: 3 as const,
    }));
    return [...kr, ...us].sort(compareNewestFirst);
  }, [krReports, research.data?.street.notes]);

  const basketKr = universe.kr.filter((r) => r.exposure !== "indirect");
  const basketUs = universe.us.filter((r) => r.exposure !== "indirect");
  const krEw = equalWeightChange(basketKr.map((r) => r.changePct));
  const usEw = equalWeightChange(basketUs.map((r) => r.changePct));
  const moversKr = topMovers(universe.kr);
  const moversUs = topMovers(universe.us);
  const allSources = [...market.sources, ...policy.sources];
  const uniReason = universe.isLoading ? "수신 중" : universe.isError ? "유니버스 조회 실패" : "확인된 종목 시세 없음";

  return (
    <div className="page-stack">
      <PageHeader
        kicker="Robotics · 로봇·자동화·피지컬 AI"
        title={
          <span className="inline-flex items-center gap-2">
            <Bot className="size-7 text-desk-teal" /> 로봇 섹션
          </span>
        }
        lead="국내·미국 로봇 기업 시세, 시장 동향, 정책(Federal Register·국내 보도), 리서치와 로봇 ETF를 한 곳에서 최신순으로 봅니다. 기업 목록은 실행 시점에 시세로 확인된 종목만 표시합니다."
        aside={
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <span className="text-[11px] text-muted-foreground">
              기준 {market.generatedAt ? <TimeStamp publishedAt={market.generatedAt} precision="second" /> : "—"}
            </span>
            <SourceHealthChip sources={allSources} />
          </div>
        }
      />
      <PageDisclaimer />
      <nav className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="로봇 섹션 탭">
        {TABS.map((t) => (
          <Link
            key={t.id}
            to="/robotics"
            search={{ tab: t.id }}
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              "flex min-h-10 flex-1 basis-[30%] items-center justify-center rounded-md px-2 text-[12px] font-semibold sm:basis-0",
              tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="space-y-3" data-testid="robotics-overview">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <KpiTile testId="kr-basket" label="KR 바스켓 1D (동일가중)" pct={krEw} source={`네이버 시세 · ${basketKr.length}종목 · 간접 노출 제외`} reason={uniReason} />
            <KpiTile testId="us-basket" label="US 바스켓 1D (동일가중)" pct={usEw} source={`Yahoo Finance(지연) · ${basketUs.length}종목 · 간접 노출 제외`} reason={uniReason} />
            <KpiTile
              testId="policy-7d"
              label="정책 항목 (7일)"
              value={now != null && policy.sources.some((s) => s.ok) ? `${countWithin(policy.items, now, 168)}건` : null}
              source="Federal Register · Google 뉴스 · 로봇신문"
              reason={feedEmptyReason(policy.sources, policy.isLoading)}
            />
            <KpiTile
              testId="research-7d"
              label="리서치 (7일)"
              value={now != null && research.data ? `${countWithin(researchRows, now, 168)}건` : null}
              source="네이버 리서치 v2 · Finviz 공개 등급"
              reason={research.isLoading ? "수신 중" : "리서치 미수신"}
            />
            <KpiTile
              testId="news-24h"
              label="뉴스 (24시간)"
              value={now != null && market.sources.some((s) => s.ok) ? `${countWithin(market.items, now, 24)}건` : null}
              source="Robot Report · 로봇신문 · Google 뉴스"
              reason={feedEmptyReason(market.sources, market.isLoading)}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SectionCard title="상승·하락 상위 (KR)" note="네이버 시세 · 약 30초 캐시">
              <div className="grid grid-cols-2 gap-2">
                <MoverList rows={moversKr.up} market="KR" />
                <MoverList rows={moversKr.down} market="KR" />
              </div>
            </SectionCard>
            <SectionCard title="상승·하락 상위 (US)" note="Yahoo Finance · 지연 시세">
              <div className="grid grid-cols-2 gap-2">
                <MoverList rows={moversUs.up} market="US" />
                <MoverList rows={moversUs.down} market="US" />
              </div>
            </SectionCard>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <SectionCard title="최신 시장 동향 5" action={<Link to="/robotics" search={{ tab: "market" }} className="text-[11px] font-semibold text-primary hover:underline">전체 →</Link>}>
              <FeedPreview items={market.items.slice(0, 5)} empty={feedEmptyReason(market.sources, market.isLoading)} />
            </SectionCard>
            <SectionCard title="최신 정책 5 (KR·US)" action={<Link to="/robotics" search={{ tab: "policy" }} className="text-[11px] font-semibold text-primary hover:underline">전체 →</Link>}>
              <FeedPreview items={policy.items.slice(0, 5)} empty={feedEmptyReason(policy.sources, policy.isLoading)} />
            </SectionCard>
            <SectionCard title="최신 리서치 5" action={<Link to="/robotics" search={{ tab: "research" }} className="text-[11px] font-semibold text-primary hover:underline">전체 →</Link>}>
              {researchRows.length === 0 ? (
                <p className="text-[10.5px] text-muted-foreground">{research.isLoading ? "수신 중…" : "리서치 미수신 또는 해당 없음"}</p>
              ) : (
                <ul className="space-y-1.5">
                  {researchRows.slice(0, 5).map((r) => (
                    <li key={r.id} className="min-w-0 text-[11.5px]">
                      <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground">
                        <TimeStamp publishedAt={r.publishedAt} precision={r.precision} />
                        <span>{r.source}</span>
                      </div>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 font-medium hover:underline">
                        {r.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
          <AiBriefingPanel items={overviewAiItems(market.items, policy.items, researchRows)} context="로봇 산업 동향" />
          <SectionCard title="로봇 ETF 스냅샷" note="국내: 네이버 ETF 목록에서 이름(로봇·휴머노이드·로보틱스) 기준 · 미국: 지정 목록을 Yahoo로 확인" action={<Link to="/robotics" search={{ tab: "etf" }} className="text-[11px] font-semibold text-primary hover:underline">전체 →</Link>}>
            {(etfs.data?.kr.length ?? 0) + (etfs.data?.us.length ?? 0) === 0 ? (
              <p className="text-[10.5px] text-muted-foreground">{etfs.isLoading ? "수신 중…" : `ETF 시세 미수신${etfs.data?.krError ? ` (${etfs.data.krError})` : ""}`}</p>
            ) : (
              <EtfTable rows={[...(etfs.data?.kr ?? []).slice(0, 5), ...(etfs.data?.us ?? []).slice(0, 3)]} market="KR" />
            )}
          </SectionCard>
        </div>
      )}

      {tab === "market" && (
        <SectionCard title="시장 동향" note="The Robot Report · 로봇신문 · Google 뉴스(KR·EN) · 한국경제 IT(로봇 키워드). 주제 칩은 기사 제목·요약의 로봇 용어로 분류합니다." testId="robotics-market">
          <NewsDesk items={market.items} sources={market.sources} loading={market.isLoading} hasMore={Boolean(market.hasNextPage)} loadingMore={market.isFetchingNextPage} onLoadMore={() => void market.fetchNextPage()} />
        </SectionCard>
      )}

      {tab === "policy" && (
        <SectionCard
          title="정책"
          note="미국: Federal Register(로봇 용어가 제목·초록에 있는 문서만, 합병 사전신고·조기종료 공고 제외) · Google News. 국내: Google 뉴스 · 로봇신문(정책 기사). 상태 칩(발표·입법예고·시행·조사/검토·기타)은 원문에 있는 표현으로만 표시하며 현재 정책 상태를 단정하지 않습니다."
          testId="robotics-policy"
        >
          <NewsDesk items={policy.items} sources={policy.sources} loading={policy.isLoading} hasMore={Boolean(policy.hasNextPage)} loadingMore={policy.isFetchingNextPage} onLoadMore={() => void policy.fetchNextPage()} />
        </SectionCard>
      )}

      {tab === "companies" && (
        <div className="space-y-3">
          <UniverseEditor hidden={universe.hidden} unresolved={universe.data?.unresolved ?? []} />
          <SectionCard title={`한국 (${universe.kr.length})`} note="시세: 네이버 · 약 30초 캐시. 최근 뉴스: 네이버 종목 뉴스 · 최근 리서치: 네이버 리서치 v2(기업). 행을 누르면 종목 뉴스가 열립니다.">
            {universe.kr.length ? (
              <CompanyTable rows={universe.kr} market="KR" latestNews={meta.data?.latestNews} latestResearch={meta.data?.latestResearch} metaLoading={meta.isLoading} onOpen={setDrawer} />
            ) : (
              <EmptyState reason={universe.isLoading ? "수신 중…" : "시세로 확인된 한국 로봇 종목이 없습니다(소스 응답 없음). 코드를 추정해 채우지 않습니다."} />
            )}
          </SectionCard>
          <SectionCard title={`미국 (${universe.us.length})`} note="시세: Yahoo Finance(지연). 시가총액은 Yahoo 차트 응답에 없어 표시하지 않습니다. 최근 뉴스·등급 변경: Finviz 공개 페이지. 행을 누르면 영문 Google News가 열립니다.">
            {universe.us.length ? (
              <CompanyTable rows={universe.us} market="US" latestNews={meta.data?.latestNews} latestResearch={meta.data?.latestResearch} metaLoading={meta.isLoading} onOpen={setDrawer} />
            ) : (
              <EmptyState reason={universe.isLoading ? "수신 중…" : "Yahoo로 확인된 미국 로봇 종목이 없습니다(소스 응답 없음)."} />
            )}
          </SectionCard>
          <p className="text-[10.5px] text-muted-foreground">
            비상장 관심 기업(뉴스만): Figure AI · Agility Robotics · Apptronik · 1X · Boston Dynamics(현대차그룹) — 시장 동향 탭 기사로만 다룹니다.{" "}
            <Link to="/industry/$sectorId" params={{ sectorId: "robotics" }} className="font-semibold text-primary hover:underline">
              기존 섹터 종목표 →
            </Link>
          </p>
        </div>
      )}

      {tab === "research" && (
        <div className="space-y-3" data-testid="robotics-research">
          <SectionCard
            title={`한국 리서치 (${krReports.length})`}
            note={`네이버 리서치 v2 — 산업 리포트 중 로봇 키워드 포함 + 로봇 종목 기업 리포트(요청당 10종목). 요약은 원문 발췌 · 최신순.${research.data?.kr.paths.length ? ` 경로: ${research.data.kr.paths.join(", ")}` : ""}`}
          >
            {krReports.length === 0 ? (
              <EmptyState reason={research.isLoading ? "수신 중…" : research.data?.kr.errors.length ? `리서치를 받지 못했습니다 (${research.data.kr.errors[0]}).` : "로봇 관련 리포트가 없습니다."} />
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {krReports.slice(0, 40).map((r) => (
                  <ResearchCard key={`${r.v2Type ?? r.category}:${r.researchId}`} report={r} onDetail={setDetail} />
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title="미국 — 공개 등급·목표가 변경 (STREET)" note="Finviz 공개 페이지의 로봇 종목 등급 변경. 공개된 정보만이며 원문 리포트가 아닙니다.">
            <StreetMovesTable pack={research.data ? { notes: research.data.street.notes, headlines: research.data.street.headlines, consensus: [], note: research.data.street.note, fetchedAt: research.data.street.fetchedAt } : undefined} />
          </SectionCard>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
            <SectionCard title="미국 — OFFICIAL 공시 (요청 시 조회)" note="종목을 고르면 SEC EDGAR 원문 목록을 불러옵니다.">
              <div className="flex flex-wrap gap-1">
                {universe.us.map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => setOfficialSymbol(r.code)}
                    aria-pressed={officialSymbol === r.code}
                    className={cn("inline-flex min-h-9 items-center rounded-md border px-2 text-[11px] font-semibold", officialSymbol === r.code ? "border-foreground/30 bg-foreground text-background" : "border-border hover:bg-muted/50")}
                  >
                    {r.code}
                  </button>
                ))}
                {universe.us.length === 0 && <p className="text-[10.5px] text-muted-foreground">확인된 미국 종목이 없습니다.</p>}
              </div>
              {officialSymbol && <CompanyOfficial symbol={officialSymbol} />}
            </SectionCard>
            <PublicResearchNote />
          </div>
          <ResearchDetailSheet report={detail} onClose={() => setDetail(null)} onOpenReport={setDetail} />
        </div>
      )}

      {tab === "etf" && (
        <div className="space-y-3" data-testid="robotics-etf">
          <SectionCard title={`국내 로봇 ETF (${etfs.data?.kr.length ?? 0})`} note="네이버 ETF 목록에서 이름에 로봇·휴머노이드·로보틱스·robot·humanoid가 들어간 ETF를 실행 시점에 찾습니다 · 시총 큰 순.">
            {(etfs.data?.kr.length ?? 0) > 0 ? (
              <EtfTable rows={etfs.data!.kr} market="KR" />
            ) : (
              <EmptyState reason={etfs.isLoading ? "수신 중…" : `ETF 목록을 받지 못했습니다${etfs.data?.krError ? ` (${etfs.data.krError})` : ""}.`} />
            )}
          </SectionCard>
          <SectionCard title={`미국 로봇 ETF (${etfs.data?.us.length ?? 0})`} note="지정 목록(BOTZ·ROBO·ARKQ·KOID·HUMN·BOTT)을 Yahoo 차트로 확인한 것만 표시합니다. 확인되지 않은 심볼은 숨기고 소스 상태에 적습니다.">
            {(etfs.data?.us.length ?? 0) > 0 ? (
              <EtfTable rows={etfs.data!.us} market="US" />
            ) : (
              <EmptyState reason={etfs.isLoading ? "수신 중…" : "Yahoo로 확인된 미국 로봇 ETF가 없습니다(소스 응답 없음)."} />
            )}
          </SectionCard>
          <Link to="/news/etf" className="inline-flex min-h-9 items-center text-[11px] font-semibold text-primary hover:underline">
            ETF 뉴스 브리핑 →
          </Link>
        </div>
      )}

      <CompanyNewsSheet target={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
