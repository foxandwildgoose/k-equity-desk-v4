import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ResearchReport, ResearchCategory } from "@/server/naver-market";
import { latestReportPerBroker, median, reportHasInvestmentView } from "@/lib/research-utils";
import { reportDay, sortReportsNewestFirst } from "@/lib/feed/mappers";
import { annotatePrevTargets } from "@/lib/research/naver-v2";
import { ResearchCard } from "@/components/research/ResearchCard";
import { ResearchDetailSheet } from "@/components/research/ResearchDetailSheet";

const CONSENSUS_MAX_AGE_DAYS = 180;
import { formatPrice } from "@/lib/format";
import { usePriceColors } from "@/lib/store";
import { cn } from "@/lib/utils";
import { FileText, Loader2, Factory, LineChart, Globe2, Building2 } from "lucide-react";

type Pack = {
  company: ResearchReport[];
  industry: ResearchReport[];
  market: ResearchReport[];
  economy: ResearchReport[];
};

const TABS: { id: ResearchCategory; label: string; icon: typeof Building2 }[] = [
  { id: "company", label: "기업", icon: Building2 },
  { id: "industry", label: "산업", icon: Factory },
  { id: "market", label: "전략", icon: LineChart },
  { id: "economy", label: "매크로", icon: Globe2 },
];

function RatingBadge({ rating }: { rating?: string }) {
  if (!rating) return null;
  const buy = /매수|비중확대|BUY|OUTPERFORM|OVERWEIGHT/i.test(rating);
  const sell = /매도|비중축소|SELL|UNDERPERFORM|UNDERWEIGHT/i.test(rating);
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
      buy && "bg-price-up/15 text-price-up",
      sell && "bg-price-down/15 text-price-down",
      !buy && !sell && "bg-amber-500/15 text-amber-400",
    )}>
      {rating}
    </span>
  );
}

function reportList(pack: Pack, tab: ResearchCategory) {
  const raw = pack[tab];
  // Kernel order + Δ% only from fetched same-broker/same-ticker priors (F2.5).
  const sorted = annotatePrevTargets(sortReportsNewestFirst(raw));
  // Company view is intentionally signal-only. Unrated notes no longer dilute the decision panel.
  return tab === "company" ? sorted.filter(reportHasInvestmentView) : sorted;
}

export function BrokerReports({
  pack,
  companyReports,
  currentPrice,
  loading,
}: {
  pack?: Pack;
  companyReports?: ResearchReport[];
  currentPrice: number;
  loading?: boolean;
}) {
  const data: Pack = pack ?? { company: companyReports ?? [], industry: [], market: [], economy: [] };
  const [tab, setTab] = useState<ResearchCategory>("company");
  const [active, setActive] = useState<ResearchReport | null>(null);
  const colors = usePriceColors();

  const list = useMemo(() => reportList(data, tab).slice(0, 30), [data, tab]);

  const consensus = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - CONSENSUS_MAX_AGE_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const latestAll = latestReportPerBroker(data.company);
    const latest = latestAll.filter((r) => {
      const day = reportDay(r);
      return !day || day >= cutoffStr;
    });
    const staleDropped = latestAll.length - latest.length;
    const views = latest.filter(reportHasInvestmentView);
    const rated = views.filter((r) => r.rating);
    const targets = views
      .map((r) => r.targetPrice)
      .filter((x): x is number => x != null && x > 0)
      .sort((a, b) => a - b);

    let buy = 0, hold = 0, sell = 0;
    for (const r of rated) {
      if (/매수|비중확대|BUY|OUTPERFORM|OVERWEIGHT/i.test(r.rating!)) buy++;
      else if (/매도|비중축소|SELL|UNDERPERFORM|UNDERWEIGHT/i.test(r.rating!)) sell++;
      else hold++;
    }

    const med = median(targets);
    const average = targets.length
      ? Math.round(targets.reduce((sum, x) => sum + x, 0) / targets.length)
      : null;
    const upside = med && currentPrice > 0 ? ((med / currentPrice) - 1) * 100 : null;
    const asOf = sortReportsNewestFirst(views)[0]?.date ?? null;

    return {
      brokerCount: latest.length,
      viewCount: views.length,
      buy,
      hold,
      sell,
      med,
      average,
      low: targets[0] ?? null,
      high: targets[targets.length - 1] ?? null,
      upside,
      rows: sortReportsNewestFirst(views),
      staleDropped,
      maxAgeDays: CONSENSUS_MAX_AGE_DAYS,
      asOf,
    };
  }, [data.company, currentPrice]);

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-3 py-3 md:px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <FileText className="size-3.5" /> 리서치 & 컨센서스
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              최신 증권사별 1건만 집계 · 기업 탭은 의견/목표가 확인 가능한 리포트만 표시
            </p>
          </div>
          {loading && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Loader2 className="size-3 animate-spin" /> 수신 중</span>}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ConsensusMetric label="커버리지" value={`${consensus.viewCount} / ${consensus.brokerCount}사`} sub="투자의견 또는 목표가 확인" />
          <ConsensusMetric label="의견 분포" value={`${consensus.buy} 매수 · ${consensus.hold} 중립 · ${consensus.sell} 매도`} sub={`증권사별 최신 · ${consensus.maxAgeDays}일 이내${consensus.staleDropped ? ` · 제외 ${consensus.staleDropped}` : ""}${consensus.asOf ? ` · as-of ${consensus.asOf}` : ""}`} />
          <ConsensusMetric
            label="목표가 중앙값"
            value={consensus.med ? formatPrice(consensus.med) : "—"}
            sub={consensus.upside == null ? "현재가 대비 계산 대기" : `현재가 대비 ${consensus.upside >= 0 ? "+" : ""}${consensus.upside.toFixed(1)}%`}
            className={consensus.upside == null ? undefined : consensus.upside >= 0 ? colors.up : colors.down}
          />
          <ConsensusMetric
            label="목표가 범위"
            value={consensus.low && consensus.high ? `${formatPrice(consensus.low)} ~ ${formatPrice(consensus.high)}` : "—"}
            sub={consensus.average ? `평균 ${formatPrice(consensus.average)}` : "표본 부족"}
          />
        </div>
      </div>

      <div className="px-3 py-3 md:px-4 space-y-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const count = reportList(data, t.id).length;
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium",
                tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}>
                <Icon className="size-3" /> {t.label} <span className="tabular opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {tab !== "company" && (
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{tab === "industry" ? "해당 종목 산업 키워드와 매칭된 리포트" : "전 시장 공통 리서치 피드"}</span>
            <Link to="/research" search={{ tab: tab === "market" ? "invest" : tab }} className="text-primary hover:underline">리서치 데스크 →</Link>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {list.length === 0 ? (
            <li className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
              {loading ? "리포트 수신 중…" : "현재 조건에서 표시할 리포트가 없습니다."}
            </li>
          ) : list.map((r) => (
            <ResearchCard key={`${r.v2Type ?? r.category}-${r.researchId}`} report={r} onDetail={setActive} />
          ))}
        </ul>

        {tab === "company" && consensus.rows.length > 1 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/35 text-muted-foreground"><tr><th className="px-2 py-1.5 text-left">증권사</th><th className="px-2 py-1.5 text-left">의견</th><th className="px-2 py-1.5 text-right">목표가</th><th className="px-2 py-1.5 text-right">일자</th></tr></thead>
              <tbody className="divide-y divide-border">
                {consensus.rows.map((r) => <tr key={`cons-${r.broker}`}><td className="px-2 py-1.5 font-medium">{r.broker}</td><td className="px-2 py-1.5"><RatingBadge rating={r.rating} /></td><td className="px-2 py-1.5 text-right tabular">{r.targetPrice ? formatPrice(r.targetPrice) : "—"}</td><td className="px-2 py-1.5 text-right tabular text-muted-foreground">{r.date}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ResearchDetailSheet report={active} onClose={() => setActive(null)} onOpenReport={setActive} />
    </section>
  );
}

function ConsensusMetric({ label, value, sub, className }: { label: string; value: string; sub: string; className?: string }) {
  return <div className="rounded-lg border border-border bg-muted/20 p-2.5"><div className="text-[10px] text-muted-foreground">{label}</div><div className={cn("mt-0.5 text-sm font-semibold tabular", className)}>{value}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div></div>;
}
