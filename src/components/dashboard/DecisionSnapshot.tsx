import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { LiveQuote, ResearchReport } from "@/server/naver-market";
import { SECTORS } from "@/data/sectors";
import { sectorStatsFromQuotes } from "@/data/stocks";
import { formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePriceColors } from "@/lib/store";
import { Activity, FileSearch, Gauge, Radio } from "lucide-react";

export function DecisionSnapshot({
  quotes,
  research,
  liveConnected,
  liveReconnecting = false,
  snapshotAgeMs,
}: {
  quotes: LiveQuote[];
  research: ResearchReport[];
  liveConnected: boolean;
  /** EventSource is re-opening (server closes streams after ≤ 240 s). */
  liveReconnecting?: boolean;
  snapshotAgeMs: number | null;
}) {
  const colors = usePriceColors();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  const liveQuotes = ready ? quotes : [];
  const valid = liveQuotes.filter((q) => q.price > 0);
  const adv = valid.filter((q) => q.changePct > 0).length;
  const dec = valid.filter((q) => q.changePct < 0).length;
  const unchanged = valid.length - adv - dec;
  const breadth = valid.length ? ((adv - dec) / valid.length) * 100 : 0;
  const sectorRanks = SECTORS.map((s) => ({ sector: s, stats: sectorStatsFromQuotes(s.id, liveQuotes) }))
    .filter((x) => x.stats.count > 0)
    .sort((a, b) => b.stats.avgChangePct - a.stats.avgChangePct);
  const leader = sectorRanks[0];
  const laggard = sectorRanks[sectorRanks.length - 1];

  return (
    <section className="desk-card desk-card-gold p-3.5 md:p-5">
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <div>
          <p className="desk-kicker mb-1">Morning Brief</p>
          <h2 className="desk-section-title text-base">Decision Snapshot</h2>
          <p className="mt-1 text-xs text-muted-foreground">가격 → 시장 폭 → 주도 산업 → 새 리서치 순으로 판단</p>
        </div>
        <span className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold",
          liveConnected ? "bg-price-up/15 text-price-up" : "bg-muted text-muted-foreground",
        )}>
          <Radio className="size-3" /> {liveConnected ? "KIS·KRX LIVE" : ready && liveReconnecting ? "재연결 중" : "스냅샷 모드"}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Gauge} label="시장 폭 (커버리지 기준)" value={`${adv}↑ / ${dec}↓ / ${unchanged}→`} sub={`${valid.length}종목 · Breadth ${breadth >= 0 ? "+" : ""}${breadth.toFixed(0)}`} className={breadth >= 0 ? colors.up : colors.down} />
        <Metric icon={Activity} label="주도 / 부진 산업" value={leader ? `${leader.sector.nameKo} ${formatPct(leader.stats.avgChangePct)}` : "—"} sub={laggard ? `${laggard.sector.nameKo} ${formatPct(laggard.stats.avgChangePct)}` : "—"} />
        <Metric icon={FileSearch} label="신규 산업 리서치" value={`${research.length}건`} sub={research[0]?.summary || research[0]?.title || "최근 리포트 대기"} />
        <Metric icon={Radio} label="데이터 상태" value={liveConnected ? "실시간 체결 스트림" : "20초 스냅샷 백업"} sub={snapshotAgeMs == null ? "갱신 확인 중" : `스냅샷 ${Math.max(0, Math.round(snapshotAgeMs / 1000))}초 전`} />
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground border-t border-border pt-2">
        <b className="text-foreground">Red Team:</b> 시장 폭·주도 산업은 <b>앱 커버리지 종목 샘플</b> 기준이며
        전체 코스피/코스닥이 아닙니다. 로테이션 판단 시 왜곡될 수 있습니다. 투자 권유가 아닙니다.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-3">
        <span className="text-[10px] font-medium text-muted-foreground mr-1">산업 리서치 바로가기</span>
        {SECTORS.filter((s) => s.focus).map((s) => (
          <Link key={s.id} to="/research" search={{ tab: "industry", sector: s.id }} className="rounded-md border border-border px-2 py-1 text-[10px] hover:bg-muted/50">
            {s.nameKo}
          </Link>
        ))}
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value, sub, className }: { icon: typeof Gauge; label: string; value: string; sub: string; className?: string }) {
  return (
    <div className="desk-stat">
      <div className="flex items-center gap-1 desk-stat-label"><Icon className="size-3" /> {label}</div>
      <div className={cn("desk-stat-value", className)}>{value}</div>
      <div className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{sub}</div>
    </div>
  );
}
