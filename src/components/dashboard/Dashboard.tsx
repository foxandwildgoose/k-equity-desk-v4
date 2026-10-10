import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SECTORS, FOCUS_SECTOR_IDS } from "@/data/sectors";
import {
  marketMoversFromQuotes,
  sectorStatsFromQuotes,
  mergeQuote,
  getUniverseItem,
} from "@/data/stocks";
import { useAppStore, usePriceColors } from "@/lib/store";
import { useMarketQuotes, useResearchDesk, useEtfMarket, useQuotesByCodes } from "@/lib/use-market";
import { useMarketStream } from "@/lib/use-market-stream";
import { formatPct } from "@/lib/format";
import { PriceChange, PriceValue } from "@/components/stocks/PriceChange";
import { StockMiniRow } from "@/components/stocks/StockTable";
import { ResearchDeskPanel } from "@/components/stocks/ResearchDesk";
import { DecisionSnapshot } from "@/components/dashboard/DecisionSnapshot";
import { DashboardBriefCards } from "@/components/dashboard/BriefCards";
import { Panel } from "@/components/layout/DeskLayout";
import { Badge } from "@/components/ui/badge";
import type { LiveQuote } from "@/server/naver-market";
import { inferSectorId } from "@/lib/infer-sector";
import { DATA_LABEL, DATA_DELAY_NOTE } from "@/data/market";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Star,
  Loader2,
  FileText,
  Factory,
  LineChart,
  Globe2,
  Layers,
  Flag,
} from "lucide-react";

function SectorTile({
  id,
  nameKo,
  nameEn,
  quotes,
}: {
  id: string;
  nameKo: string;
  nameEn: string;
  quotes: import("@/server/naver-market").LiveQuote[];
}) {
  const stats = sectorStatsFromQuotes(id, quotes);
  const colors = usePriceColors();
  const up = stats.avgChangePct > 0;
  const color =
    stats.avgChangePct === 0
      ? "text-muted-foreground"
      : up
        ? colors.up
        : colors.down;

  return (
    <Link
      to="/industry/$sectorId"
      params={{ sectorId: id }}
      className="group flex flex-col gap-1 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40 hover:border-border"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight group-hover:underline">
          {nameKo}
        </span>
        <span className={cn("text-xs font-semibold tabular shrink-0", color)}>
          {stats.count ? formatPct(stats.avgChangePct) : "—"}
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground line-clamp-1">
        {nameEn}
      </span>
      {(stats.topGainer || stats.topLoser) && (
        <div className="mt-1 flex flex-col gap-0.5 text-[11px]">
          {stats.topGainer && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground truncate">
                {stats.topGainer.nameKo}
              </span>
              <span className={cn("tabular", colors.up)}>
                {formatPct(stats.topGainer.changePct)}
              </span>
            </div>
          )}
          {stats.topLoser &&
            stats.topLoser.code !== stats.topGainer?.code && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground truncate">
                  {stats.topLoser.nameKo}
                </span>
                <span className={cn("tabular", colors.down)}>
                  {formatPct(stats.topLoser.changePct)}
                </span>
              </div>
            )}
        </div>
      )}
    </Link>
  );
}

export function Dashboard() {
  const watchlist = useAppStore((s) => s.watchlist);
  const focusMode = useAppStore((s) => s.focusMode);
  const colors = usePriceColors();
  const { data, isLoading, isError, dataUpdatedAt } = useMarketQuotes();
  // Secondary desks load after first paint so quote tape wins the race
  const [deferSecondary, setDeferSecondary] = useState(false);
  // The route chunk hydrates after the shell, whose queries may already have
  // settled; keep the SSR text until mounted to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const id = window.setTimeout(() => setDeferSecondary(true), 150);
    return () => window.clearTimeout(id);
  }, []);
  const showLoading = isLoading || !mounted;
  const researchQ = useResearchDesk({ enabled: deferSecondary });
  const etfQ = useEtfMarket({
    bucket: "retirement",
    limit: 12,
    enabled: deferSecondary,
  });
  const liveStatus = useMarketStream([
    ...watchlist,
    "005930",
    "000660",
    "005380",
    "000270",
    "373220",
    "034020",
    "009540",
    "207940",
    "035420",
    "105560",
  ]);
  const extra = useQuotesByCodes(watchlist);
  const quotes = useMemo(() => {
    if (!mounted) return [];
    const map = new Map<string, LiveQuote>();
    for (const q of data?.quotes ?? []) map.set(q.code, q);
    for (const q of extra.data?.quotes ?? []) {
      if (!map.has(q.code)) map.set(q.code, q);
    }
    return [...map.values()];
  }, [mounted, data?.quotes, extra.data?.quotes]);
  const { gainers, losers } = marketMoversFromQuotes(quotes, 6);

  const watched = watchlist
    .map((c) => {
      const q = quotes.find((x) => x.code === c);
      const meta = getUniverseItem(c) ??
        (q
          ? {
              code: q.code,
              nameKo: q.nameKo,
              nameEn: q.nameEn,
              sectorId: q.sectorId,
              market: q.market,
            }
          : {
              code: c,
              nameKo: c,
              nameEn: c,
              sectorId: inferSectorId(c),
              market: "KOSPI" as const,
            });
      return mergeQuote(meta, q);
    })
    .slice(0, 8);

  const sectorList = focusMode
    ? SECTORS.filter((s) => FOCUS_SECTOR_IDS.includes(s.id) || s.focus)
    : SECTORS;

  // Only evaluate session status after mount to avoid SSR/client quote race.
  const marketOpen =
    mounted &&
    quotes.some(
      (q) => q.marketStatus === "OPEN" || q.marketStatus === "PREOPEN",
    );
  const sessionLabel = !mounted
    ? "세션 확인 중"
    : marketOpen
      ? "정규장 개장"
      : "장 마감 / 휴장";

  return (
    <div className="dash-layout">
      <div className="area-head page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="desk-kicker mb-1.5">Institutional Equity Desk</p>
          <h1 className="page-title">Korea Equity Command Center</h1>
          <p className="page-lead">
            시세 → 시장 폭 → 산업 리서치 → 공시 순으로 판단하는 데스크
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                marketOpen
                  ? "bg-price-up/15 text-price-up"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  marketOpen
                    ? "bg-price-up animate-pulse"
                    : "bg-muted-foreground",
                )}
              />
              {sessionLabel}
            </span>
            {mounted && isLoading && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> 시세
              </span>
            )}
          </div>
          {mounted && isError && (
            <span className="text-[11px] text-price-down">
              시세 조회 실패 — 자동 재시도
            </span>
          )}
          {mounted && dataUpdatedAt > 0 && (
            <span className="text-[10px] text-muted-foreground tabular">
              시세 갱신 {new Date(dataUpdatedAt).toLocaleTimeString("ko-KR")}
            </span>
          )}
          <Badge variant="outline" className="text-[10px] font-normal">
            {DATA_LABEL}
          </Badge>
          <p className="text-xs text-muted-foreground max-w-xs">{DATA_DELAY_NOTE}</p>
        </div>
      </div>

      <div className="area-snap">
      <DecisionSnapshot
        quotes={quotes}
        research={researchQ.data?.industry ?? []}
        liveConnected={liveStatus.connected}
        liveReconnecting={Boolean(liveStatus.enabled && liveStatus.reconnecting)}
        snapshotAgeMs={
          mounted && dataUpdatedAt > 0 ? Date.now() - dataUpdatedAt : null
        }
      />
      </div>

      <div className="area-brief">
        <DashboardBriefCards enabled={deferSecondary} />
      </div>

      <Panel
        className="area-etf"
        tone="gold"
        title={
          <>
            <Layers className="size-4 text-desk-gold" /> ETF · 퇴직연금
          </>
        }
        hint="실시간 목록 · 레버리지·인버스 제외"
        href="/etfs"
      >
        <div className="grid gap-1.5">
          {(etfQ.data?.etfs ?? []).slice(0, 6).map((e: { code: string; nameKo: string; changePct?: number; price?: number; isNewCandidate?: boolean }) => {
            const pct = e.changePct ?? 0;
            const price = e.price;
            return (
              <Link
                key={e.code}
                to="/etfs/$code"
                params={{ code: e.code }}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5 hover:bg-muted/40 min-h-12"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{e.nameKo}</div>
                  <div className="text-xs text-muted-foreground tabular">
                    {e.code}{e.isNewCandidate ? " · NEW" : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular">
                    {price ? Number(price).toLocaleString("ko-KR") : "—"}
                  </div>
                  <div
                    className={
                      pct > 0
                        ? colors.up + " text-xs tabular font-medium"
                        : pct < 0
                          ? colors.down + " text-xs tabular font-medium"
                          : "text-xs text-muted-foreground tabular"
                    }
                  >
                    {formatPct(pct)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Panel>

      <Panel
        className="area-us"
        tone="teal"
        title={
          <>
            <Flag className="size-4 text-desk-teal" /> 미국 연계 산업
          </>
        }
        hint="AI·IRA·방산·원전 공급망"
        href="/us-link"
        hrefLabel="열기"
      >
        <Link
          to="/industry/$sectorId"
          params={{ sectorId: "us-linked" }}
          className="block rounded-lg border border-desk-gold/30 bg-desk-gold/5 px-3 py-3 hover:bg-desk-gold/10"
        >
          <div className="text-sm font-semibold text-desk-gold">미국 연계 섹터 보드</div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            AI 메모리·배터리·방산·전력 밸류체인 종목 등락
          </p>
        </Link>
        <div className="desk-grid desk-grid-2">
          {[
            { to: "/us-link", label: "미·중 AI 패권", sub: "HBM · CHIPS" },
            { to: "/us-link", label: "미국 정책", sub: "IRA · 관세" },
          ].map((x) => (
            <Link
              key={x.label}
              to={x.to}
              className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 hover:bg-muted/40"
            >
              <div className="text-sm font-semibold">{x.label}</div>
              <div className="text-xs text-muted-foreground">{x.sub}</div>
            </Link>
          ))}
        </div>
      </Panel>

      <Panel
        className="area-research"
        tone="indigo"
        title={
          <>
            <FileText className="size-4" /> 리서치 데스크
          </>
        }
        hint="한국 리포트와 미국 월가 의견을 나눠 바로 선택"
        href="/research"
        hrefLabel="전체 열기"
      >

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            to="/research"
            search={{ tab: "industry" }}
            className="group flex items-start gap-2.5 rounded-lg border border-border bg-muted/15 px-3 py-2.5 hover:bg-muted/35 transition-colors"
          >
            <Factory className="size-4 mt-0.5 text-muted-foreground group-hover:text-foreground" />
            <div className="min-w-0">
              <div className="text-xs font-semibold">산업 리포트</div>
              <div className="text-[11px] text-muted-foreground tabular">
                {researchQ.data?.industry.length ?? "—"}건 · 섹터 분석
              </div>
              {researchQ.data?.industry[0] && (
                <div className="mt-1 text-[11px] line-clamp-2 text-foreground/80">
                  {researchQ.data.industry[0].summary ||
                    researchQ.data.industry[0].title}
                </div>
              )}
            </div>
          </Link>
          <Link
            to="/research"
            search={{ tab: "invest" }}
            className="group flex items-start gap-2.5 rounded-lg border border-border bg-muted/15 px-3 py-2.5 hover:bg-muted/35 transition-colors"
          >
            <LineChart className="size-4 mt-0.5 text-muted-foreground group-hover:text-foreground" />
            <div className="min-w-0">
              <div className="text-xs font-semibold">시황 · 전략</div>
              <div className="text-[11px] text-muted-foreground tabular">
                {researchQ.data?.market.length ?? "—"}건 · 마켓레이더
              </div>
              {researchQ.data?.market[0] && (
                <div className="mt-1 text-[11px] line-clamp-2 text-foreground/80">
                  {researchQ.data.market[0].summary ||
                    researchQ.data.market[0].title}
                </div>
              )}
            </div>
          </Link>
          <Link
            to="/research"
            search={{ tab: "economy" }}
            className="group flex items-start gap-2.5 rounded-lg border border-border bg-muted/15 px-3 py-2.5 hover:bg-muted/35 transition-colors"
          >
            <Globe2 className="size-4 mt-0.5 text-muted-foreground group-hover:text-foreground" />
            <div className="min-w-0">
              <div className="text-xs font-semibold">경제 · 매크로</div>
              <div className="text-[11px] text-muted-foreground tabular">
                {researchQ.data?.economy.length ?? "—"}건 · FX·정책
              </div>
              {researchQ.data?.economy[0] && (
                <div className="mt-1 text-[11px] line-clamp-2 text-foreground/80">
                  {researchQ.data.economy[0].summary ||
                    researchQ.data.economy[0].title}
                </div>
              )}
            </div>
          </Link>
          <Link
            to="/research"
            search={{ market: "us" }}
            className="group flex items-start gap-2.5 rounded-lg border border-border bg-muted/15 px-3 py-2.5 hover:bg-muted/35 transition-colors"
          >
            <Flag className="size-4 mt-0.5 text-desk-teal group-hover:text-foreground" />
            <div className="min-w-0">
              <div className="text-xs font-semibold">미국 · 월가</div>
              <div className="text-[11px] text-muted-foreground">
                투자은행 등급 · 목표가 · 기사 원문
              </div>
              <div className="mt-1 text-[11px] line-clamp-2 text-foreground/80">
                공개된 의견만 요약하고, 카드를 누르면 원문 페이지로 갑니다.
              </div>
            </div>
          </Link>
        </div>

        <ResearchDeskPanel
          pack={
            researchQ.data
              ? {
                  industry: researchQ.data.industry,
                  market: researchQ.data.market,
                  economy: researchQ.data.economy,
                  featured: researchQ.data.featured,
                }
              : null
          }
          loading={researchQ.isLoading}
          defaultTab="industry"
          compact
          showHeader={false}
        />
      </Panel>

      <section className="area-watch">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="desk-section-title">
            <Star className="size-4 text-amber-400" /> 관심종목
          </h2>
          <Link
            to="/watchlist"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 min-h-9"
          >
            전체 <ArrowRight className="size-3" />
          </Link>
        </div>
        {watched.length === 0 ? (
          <div className="empty-state rounded-lg border border-dashed border-border">
            관심종목을 추가하면 여기에 실시간 시세가 표시됩니다.
          </div>
        ) : (
          <div className="desk-grid desk-grid-4">
            {watched.map((st) => (
              <Link
                key={st.code}
                to="/stock/$ticker"
                params={{ ticker: st.code }}
                className="rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {st.nameKo}
                    </div>
                    <div className="text-xs text-muted-foreground tabular">
                      {st.code}
                    </div>
                  </div>
                  <div className="text-right">
                    {st.price > 0 ? (
                      <>
                        <PriceValue
                          value={st.price}
                          changePct={st.changePct}
                          size="sm"
                        />
                        <PriceChange
                          change={st.change}
                          changePct={st.changePct}
                          size="sm"
                        />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="area-sectors">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="desk-section-title">산업 커버리지</h2>
          <span className="text-xs text-muted-foreground">유니버스 평균 등락</span>
        </div>
        <div className="desk-grid desk-grid-6">
          {sectorList.map((s) => (
            <SectorTile
              key={s.id}
              id={s.id}
              nameKo={s.nameKo}
              nameEn={s.nameEn}
              quotes={quotes}
            />
          ))}
        </div>
      </section>

      <section className="area-up desk-card p-4">
        <h2 className={cn("mb-2 text-sm font-semibold", colors.up)}>
          상승 상위
        </h2>
        <div className="flex flex-col gap-0.5">
          {gainers.length === 0 ? (
            <p className="empty-state">{showLoading ? "로딩 중…" : "데이터 없음"}</p>
          ) : (
            gainers.map((st) => <StockMiniRow key={st.code} stock={st} />)
          )}
        </div>
      </section>
      <section className="area-down desk-card p-4">
        <h2 className={cn("mb-2 text-sm font-semibold", colors.down)}>
          하락 상위
        </h2>
        <div className="flex flex-col gap-0.5">
          {losers.length === 0 ? (
            <p className="empty-state">{showLoading ? "로딩 중…" : "데이터 없음"}</p>
          ) : (
            losers.map((st) => <StockMiniRow key={st.code} stock={st} />)
          )}
        </div>
      </section>
    </div>
  );
}
