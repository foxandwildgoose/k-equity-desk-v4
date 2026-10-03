import { Link } from "@tanstack/react-router";
import { Bot, FileText, Flag, Radio } from "lucide-react";
import { useWireStore } from "@/lib/wire/use-live-wire";
import { useResearchBriefing } from "@/lib/use-research";
import { useMarketSnapshot } from "@/lib/use-feed";
import { useRoboticsUniverse } from "@/lib/use-themes";
import { equalWeightChange, topMovers } from "@/lib/robotics/classify";
import { formatPct } from "@/lib/format";
import { usePriceColors } from "@/lib/store";
import { TimeStamp } from "@/components/feed/TimeStamp";
import { SourceBadge } from "@/components/feed/FeedRow";
import { reportTime } from "@/components/research/ResearchCard";
import { cn } from "@/lib/utils";

function Card({ title, icon, href, action, children, testId }: { title: string; icon: React.ReactNode; href?: "/research" | "/news/us" | "/robotics"; action?: React.ReactNode; children: React.ReactNode; testId: string }) {
  return (
    <section className="desk-card flex min-w-0 flex-col gap-2 p-3" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex min-w-0 items-center gap-1.5 truncate text-[12.5px] font-semibold">
          {icon} {title}
        </h2>
        {action ??
          (href && (
            <Link to={href} className="inline-flex min-h-8 shrink-0 items-center whitespace-nowrap text-[11px] font-semibold text-primary hover:underline">
              열기 →
            </Link>
          ))}
      </div>
      {children}
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-[10.5px] text-muted-foreground">{children}</p>;
}

function Pct({ v }: { v: number | null }) {
  const colors = usePriceColors();
  if (v == null) return <span className="text-muted-foreground">—</span>;
  return <span className={cn("tabular font-semibold", v > 0 && colors.up, v < 0 && colors.down)}>{formatPct(v)}</span>;
}

/** Live Wire top 5 from the shared engine (polled by the shell; no extra request). */
function WireCard() {
  const items = useWireStore((s) => s.items);
  const role = useWireStore((s) => s.role);
  const lastError = useWireStore((s) => s.lastError);
  const setDrawerOpen = useWireStore((s) => s.setDrawerOpen);
  const top = items.slice(0, 5);
  return (
    <Card
      title="Live Wire 최신 5"
      icon={<Radio className="size-3.5 text-price-up" />}
      testId="dash-wire"
      action={
        <button type="button" onClick={() => setDrawerOpen(true)} className="inline-flex min-h-8 shrink-0 items-center whitespace-nowrap text-[11px] font-semibold text-primary hover:underline">
          전체 →
        </button>
      }
    >
      {top.length === 0 ? (
        <Muted>{lastError ? `와이어 미수신 (${lastError})` : role === "starting" ? "와이어 연결 중…" : "새 항목 대기 중"}</Muted>
      ) : (
        <ul className="space-y-1.5">
          {top.map((it) => (
            <li key={it.id} className="min-w-0 text-[11.5px]">
              <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground">
                <TimeStamp publishedAt={it.publishedAt} precision={it.precision} />
                <SourceBadge item={it} />
              </div>
              <a href={it.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 font-medium hover:underline">
                {it.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** 오늘의 리서치: today's counts per v2 category + the 3 newest reports. */
function ResearchCard3({ enabled }: { enabled: boolean }) {
  const q = useResearchBriefing({ enabled });
  const b = q.data;
  return (
    <Card title="오늘의 리서치" icon={<FileText className="size-3.5 text-desk-indigo" />} href="/research" testId="dash-research">
      <div className="flex flex-wrap gap-1 text-[10.5px]">
        {(b?.todayCounts ?? []).map((c) => (
          <span key={c.type} className="rounded border border-border px-1.5 py-0.5 tabular">
            {c.label} {c.count ?? "—"}
          </span>
        ))}
        {!b && <Muted>{q.isError ? "리서치 집계 미수신" : "수신 중…"}</Muted>}
      </div>
      {b && b.latest.length === 0 ? (
        <Muted>최신 리포트를 받지 못했습니다 (소스 미검증일 수 있음).</Muted>
      ) : (
        <ul className="space-y-1.5">
          {(b?.latest ?? []).map((r) => {
            const t = reportTime(r);
            return (
              <li key={`${r.v2Type ?? r.category}:${r.researchId}`} className="min-w-0 text-[11.5px]">
                <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground">
                  <TimeStamp publishedAt={t.publishedAt} precision={t.precision} />
                  <span>{r.broker}</span>
                  <span>{r.categoryLabel}</span>
                </div>
                <a href={r.pageUrl} target="_blank" rel="noopener noreferrer" className="line-clamp-2 font-medium hover:underline">
                  {r.nameKo ? `[${r.nameKo}] ` : ""}
                  {r.title}
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {b && <p className="mt-auto text-[10px] text-muted-foreground">네이버 리서치 v2 · 집계 <TimeStamp publishedAt={b.fetchedAt} precision="minute" /></p>}
    </Card>
  );
}

/** US snapshot: same ids/key as the MarketBar, so the query is shared. */
function UsCard({ enabled }: { enabled: boolean }) {
  const q = useMarketSnapshot(["spx", "ndx", "vix", "tnx", "usdkrw"], { enabled, refetchMs: 180_000 });
  const rows = q.data?.rows ?? [];
  return (
    <Card title="미국 스냅샷" icon={<Flag className="size-3.5 text-desk-teal" />} href="/news/us" testId="dash-us">
      {rows.length === 0 ? (
        <Muted>{q.isError ? "미국 시세 미수신" : "수신 중…"}</Muted>
      ) : (
        <ul className="space-y-1 text-[11.5px]">
          {rows.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-2">
              <span className="truncate">{r.label}</span>
              <span className="shrink-0 tabular">
                {r.price != null ? r.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"} <Pct v={r.changePct} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto text-[10px] text-muted-foreground">Yahoo Finance · 지연 시세{q.data ? " · 갱신 " : ""}{q.data && <TimeStamp publishedAt={q.data.fetchedAt} precision="minute" />}</p>
    </Card>
  );
}

/** Robotics snapshot: equal-weight 1D baskets (direct/partial exposure) and the top mover per market. */
function RoboticsCard({ enabled }: { enabled: boolean }) {
  const u = useRoboticsUniverse({ enabled });
  const kr = u.kr.filter((r) => r.exposure !== "indirect");
  const us = u.us.filter((r) => r.exposure !== "indirect");
  const rows = [
    { id: "KR", label: `KR 바스켓 (${kr.length})`, ew: equalWeightChange(kr.map((r) => r.changePct)), movers: topMovers(kr, 1) },
    { id: "US", label: `US 바스켓 (${us.length})`, ew: equalWeightChange(us.map((r) => r.changePct)), movers: topMovers(us, 1) },
  ];
  return (
    <Card title="로봇 스냅샷" icon={<Bot className="size-3.5 text-desk-teal" />} href="/robotics" testId="dash-robotics">
      {!u.data ? (
        <Muted>{u.isError ? "로봇 유니버스 미수신" : "수신 중…"}</Muted>
      ) : (
        <ul className="space-y-1.5 text-[11.5px]">
          {rows.map((r) => (
            <li key={r.id} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{r.label} 1D</span>
                <Pct v={r.ew} />
              </div>
              <div className="flex flex-wrap gap-x-2 text-[10.5px] text-muted-foreground">
                {r.movers.up[0] && (
                  <span>
                    ▲ {r.movers.up[0].name} <Pct v={r.movers.up[0].changePct} />
                  </span>
                )}
                {r.movers.down[0] && (
                  <span>
                    ▼ {r.movers.down[0].name} <Pct v={r.movers.down[0].changePct} />
                  </span>
                )}
                {!r.movers.up[0] && !r.movers.down[0] && <span>확인된 등락 없음</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto text-[10px] text-muted-foreground">동일가중 · 간접 노출 제외 · 네이버 시세 / Yahoo(지연)</p>
    </Card>
  );
}

/**
 * F10.3 dashboard cards. Mounted only after first paint (`deferSecondary`) so
 * the quote tape keeps priority; every row keeps its source, time and link.
 */
export function DashboardBriefCards({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
        {["Live Wire", "오늘의 리서치", "미국 스냅샷", "로봇 스냅샷"].map((t) => (
          <div key={t} className="desk-card min-h-32 p-3 text-[11px] text-muted-foreground">
            {t} 불러오는 중…
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="dash-brief-cards">
      <WireCard />
      <ResearchCard3 enabled={enabled} />
      <UsCard enabled={enabled} />
      <RoboticsCard enabled={enabled} />
    </div>
  );
}
