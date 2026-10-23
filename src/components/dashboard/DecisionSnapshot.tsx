import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { LiveQuote, ResearchReport } from "@/server/naver-market";
import { SECTORS } from "@/data/sectors";
import { sectorStatsFromQuotes } from "@/data/stocks";
import { formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePriceColors } from "@/lib/store";
import { Activity, FileSearch, Gauge, Radio } from "lucide-react";
import { selectMarketQuotes } from "@/lib/market-freshness";
import { isFreshKisQuote } from "@/lib/market-quote-state";
import { coverageLabel, preopenMarketSnapshot } from "@/lib/market-presentation";
import { UNIVERSE_BY_CODE } from "@/data/universe";

export function DecisionSnapshot({
  quotes,
  research,
  liveConnected,
  liveReconnecting = false,
  snapshotAgeMs,
  now,
}: {
  quotes: LiveQuote[];
  research: ResearchReport[];
  liveConnected: boolean;
  /** EventSource is re-opening (server closes streams after ≤ 240 s). */
  liveReconnecting?: boolean;
  snapshotAgeMs: number | null;
  now: number;
}) {
  const colors = usePriceColors();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  const liveQuotes = ready ? quotes : [];
  const selected = selectMarketQuotes(liveQuotes.filter((q) => Boolean(UNIVERSE_BY_CODE[q.code])), now);
  const valid = selected.quotes;
  const preopen = valid.length === 0 ? preopenMarketSnapshot(selected.all, now) : null;
  const liveCount = liveConnected ? valid.filter((q) => isFreshKisQuote(q, now)).length : 0;
  const adv = valid.filter((q) => q.changePct > 0).length;
  const dec = valid.filter((q) => q.changePct < 0).length;
  const unchanged = valid.length - adv - dec;
  const breadth = valid.length ? ((adv - dec) / valid.length) * 100 : 0;
  const sectorRanks = SECTORS.map((s) => ({ sector: s, stats: sectorStatsFromQuotes(s.id, liveQuotes, now) }))
    .filter((x) => x.stats.count > 0)
    .sort((a, b) => (b.stats.avgChangePct ?? 0) - (a.stats.avgChangePct ?? 0));
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
          liveCount ? "bg-price-up/15 text-price-up" : "bg-muted text-muted-foreground",
        )}>
          <Radio className="size-3" /> {liveCount ? `KIS 체결 ${liveCount}종목` : liveConnected ? "스트림 연결 · 체결 대기" : ready && liveReconnecting ? "재연결 중" : "스냅샷 모드"}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Gauge} label="시장 폭 (커버리지 기준)" value={valid.length ? `${adv}↑ / ${dec}↓ / ${unchanged}→` : "—"} sub={valid.length ? `${valid.length}종목 · Breadth ${breadth >= 0 ? "+" : ""}${breadth.toFixed(0)}` : preopen ? "장전 · 정규장 시세 확인 후 집계" : "유효한 동일 거래일 시세 없음"} className={!valid.length || breadth === 0 ? "text-muted-foreground" : breadth > 0 ? colors.up : colors.down} />
        <Metric icon={Activity} label="주도 / 부진 산업" value={leader?.stats.avgChangePct != null ? `${leader.sector.nameKo} ${formatPct(leader.stats.avgChangePct)}` : "—"} sub={laggard?.stats.avgChangePct != null ? `${laggard.sector.nameKo} ${formatPct(laggard.stats.avgChangePct)}` : preopen ? "장전 집계 대기" : "—"} />
        <Metric icon={FileSearch} label="신규 산업 리서치" value={`${research.length}건`} sub={research[0]?.summary || research[0]?.title || "최근 리포트 대기"} />
        <Metric icon={Radio} label="데이터 상태" value={liveCount ? `최근 KIS 체결 ${liveCount}종목` : preopen ? "장전 스냅샷 수신" : "45초 간격 스냅샷 조회"} sub={coverageLabel(selected, now)} />
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground border-t border-border pt-2">
        <b className="text-foreground">Red Team:</b> 시장 폭·주도 산업은 <b>앱 커버리지 종목 샘플</b> 기준이며
        전체 코스피/코스닥 업종지수가 아닙니다. 시각 미확인·오래된 자료는 통계에서 제외합니다.
        {snapshotAgeMs != null && Number.isFinite(snapshotAgeMs) && ` 스냅샷 수집 ${Math.max(0, Math.round(snapshotAgeMs / 1000))}초 전.`}
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
