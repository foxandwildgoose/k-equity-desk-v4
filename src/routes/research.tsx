import { createFileRoute, Link } from "@tanstack/react-router";
import type { SectorId } from "@/data/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageDisclaimer } from "@/components/feed/PageDisclaimer";
import { KrResearchDesk } from "@/components/research/KrResearchDesk";
import { UsResearchDesk } from "@/components/stocks/UsResearchDesk";
import { PublicResearchNote, StreetMovesTable, UsScopeBanner } from "@/components/research/UsResearchKit";
import { UsResearchBriefing } from "@/components/research/UsResearchBriefing";
import { useStreetUniverse, useUsOfficialUniverse, useUsStreet } from "@/lib/use-market";
import type { ResearchTab } from "@/lib/use-research";
import { cn } from "@/lib/utils";

type ResearchSearch = {
  tab?: ResearchTab;
  sector?: SectorId;
  market?: "kr" | "us";
};

const TABS: ResearchTab[] = ["all", "company", "industry", "invest", "economy", "debenture", "market"];

export const Route = createFileRoute("/research")({
  component: ResearchPage,
  validateSearch: (s: Record<string, unknown>): ResearchSearch => {
    const market = s.market === "us" || s.market === "kr" ? s.market : undefined;
    const sector = typeof s.sector === "string" ? (s.sector as SectorId) : undefined;
    // Back-compat: old `featured` → company, old `market` (시황·전략) → invest.
    const raw = s.tab === "featured" ? "company" : s.tab;
    const tab = TABS.includes(raw as ResearchTab) ? (raw as ResearchTab) : undefined;
    return { tab, sector, market };
  },
  head: () => ({ meta: [{ title: "리서치 데스크 · Korea Equity Command Center" }] }),
});

function MarketSwitch({ market }: { market: "kr" | "us" }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="시장">
      {(
        [
          ["kr", "한국 주식"],
          ["us", "미국 주식"],
        ] as const
      ).map(([id, label]) => (
        <Link
          key={id}
          to="/research"
          search={{ market: id }}
          role="tab"
          aria-selected={market === id}
          className={cn(
            "flex min-h-9 items-center justify-center rounded-md px-2.5 text-[12px] font-semibold",
            market === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function UsResearchMode() {
  const universe = useStreetUniverse();
  const street = useUsStreet(undefined, { symbols: universe });
  const official = useUsOfficialUniverse();
  return (
    <div className="space-y-3">
      <UsScopeBanner />
      <UsResearchBriefing street={street.data} official={official.data} />
      <StreetMovesTable pack={street.data} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <UsResearchDesk />
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3 text-[11px]">
            <div className="mb-1 font-semibold">OFFICIAL 공식 원문</div>
            <p className="text-muted-foreground">SEC 공시·연준·BEA·BLS 원문 카드는 공식 원문 페이지에 있습니다.</p>
            <Link to="/us-research" className="mt-1 inline-flex min-h-8 items-center font-semibold text-primary hover:underline">
              공식 원문 열기 →
            </Link>
          </div>
          <PublicResearchNote />
        </div>
      </div>
    </div>
  );
}

function ResearchPage() {
  const { tab, sector, market } = Route.useSearch();
  const m = market === "us" ? "us" : "kr";
  return (
    <div className="page-stack">
      <PageHeader
        kicker={m === "us" ? "US Research Briefing · 미국 리서치" : "KR Research Briefing · 한국 리서치"}
        title="리서치 데스크"
        lead={
          m === "us"
            ? "공식 문서, 공개 리서치, 공개된 등급·목표가 변경과 관련 기사만 원문으로 연결합니다. 모든 목록은 최신순입니다."
            : "네이버 리서치 v2(실패 시 레거시)의 기업·산업·시황/전략·경제·채권·데일리 리포트를 최신순으로 보여줍니다. 요약은 원문 발췌이며 PDF·리서치 페이지로 바로 연결됩니다."
        }
      />
      <PageDisclaimer />
      <MarketSwitch market={m} />
      {m === "us" ? <UsResearchMode /> : <KrResearchDesk defaultTab={tab ?? "all"} defaultSector={sector} />}
    </div>
  );
}
