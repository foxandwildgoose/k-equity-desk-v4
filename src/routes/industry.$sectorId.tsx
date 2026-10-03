import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SECTOR_BY_ID } from "@/data/sectors";
import {
  getStocksBySector,
  sectorStatsFromQuotes,
  mergeQuote,
} from "@/data/stocks";
import { StockTable } from "@/components/stocks/StockTable";
import { formatPct } from "@/lib/format";
import { usePriceColors } from "@/lib/store";
import { useMarketQuotes } from "@/lib/use-market";
import { cn } from "@/lib/utils";
import { ChevronRight, Loader2 } from "lucide-react";
import type { SectorId } from "@/data/types";
import { DATA_LABEL } from "@/data/market";
import { SourceLinks } from "@/components/ui/SourceLinks";

export const Route = createFileRoute("/industry/$sectorId")({
  component: IndustryPage,
  head: ({ params }) => {
    const s = SECTOR_BY_ID[params.sectorId];
    return {
      meta: [
        {
          title: s
            ? `${s.nameKo} · Korea Equity Command Center`
            : "산업 · Korea Equity",
        },
      ],
    };
  },
});

function IndustryPage() {
  const { sectorId } = Route.useParams();
  const sector = SECTOR_BY_ID[sectorId];
  const { data, isLoading: queryLoading } = useMarketQuotes();
  const colors = usePriceColors();
  // The route chunk can hydrate after the shell's quote query settled; render
  // the SSR state until mounted so server and first client render match.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!sector) throw notFound();
  const isLoading = queryLoading || !mounted;
  const quotes = mounted ? (data?.quotes ?? []) : [];
  const universe = getStocksBySector(sectorId as SectorId);
  const stocks = universe.map((u) => {
    const q = quotes.find((x) => x.code === u.code);
    return mergeQuote(u, q);
  });
  const stats = sectorStatsFromQuotes(sectorId, quotes);
  const up = stats.avgChangePct > 0;
  const avgColor =
    stats.avgChangePct === 0
      ? "text-muted-foreground"
      : up
        ? colors.up
        : colors.down;

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          대시보드
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground font-medium">{sector.nameKo}</span>
      </nav>

      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            {sector.nameKo}{" "}
            <span className="text-muted-foreground font-normal text-base md:text-lg">
              ({sector.nameEn})
            </span>
          </h1>
          <div className="mt-3 rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="text-sm font-semibold">산업 핵심 관점</div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {sector.thesis}
            </p>
            <SourceLinks
              primaryUrl={sector.sourceUrl}
              primaryLabel="원문 보기"
              more={sector.moreSources ?? []}
              searchQuery={`${sector.nameKo} 산업 리포트`}
            />
            <Link
              to="/research"
              search={{ tab: "industry", sector: sector.id }}
              className="inline-flex text-sm text-primary hover:underline"
            >
              앱 내 산업 리포트 더 보기 →
            </Link>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">{DATA_LABEL}</p>
        </div>
        {isLoading && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> 시세 수신
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <div className="text-[11px] text-muted-foreground">섹터 평균 등락</div>
          <div className={cn("mt-0.5 text-lg font-semibold tabular", avgColor)}>
            {stats.count ? formatPct(stats.avgChangePct) : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <div className="text-[11px] text-muted-foreground">상승 1위</div>
          {stats.topGainer ? (
            <div className="mt-0.5">
              <div className="text-sm font-medium">{stats.topGainer.nameKo}</div>
              <div className={cn("text-xs tabular", colors.up)}>
                {formatPct(stats.topGainer.changePct)}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mt-0.5">—</div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <div className="text-[11px] text-muted-foreground">하락 1위</div>
          {stats.topLoser ? (
            <div className="mt-0.5">
              <div className="text-sm font-medium">{stats.topLoser.nameKo}</div>
              <div className={cn("text-xs tabular", colors.down)}>
                {formatPct(stats.topLoser.changePct)}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mt-0.5">—</div>
          )}
        </div>
      </div>

      {sectorId === "us-linked" && (
        <div className="desk-card desk-card-gold p-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground max-w-xl">
            미국 AI·안보·에너지 수요와 연결된 한국 공급망 종목입니다. 정책 브리프·뉴스·리서치는 미국 연계 데스크에서 모읍니다.
          </p>
          <Link to="/us-link" className="text-xs font-medium text-primary hover:underline shrink-0">
            미국 연계 데스크 →
          </Link>
        </div>
      )}
      {sectorId === "robotics" && (
        <div className="desk-card desk-card-gold p-3 flex flex-wrap items-center justify-between gap-2" data-testid="robotics-crosslink">
          <p className="text-sm text-muted-foreground max-w-xl">
            로봇 기업 시세·시장 동향·정책·리서치·로봇 ETF는 로봇 섹션에서 한 번에 봅니다.
          </p>
          <Link to="/robotics" className="inline-flex min-h-9 items-center text-xs font-medium text-primary hover:underline shrink-0">
            로봇 섹션 열기 →
          </Link>
        </div>
      )}
      <StockTable stocks={stocks} />
    </div>
  );
}
