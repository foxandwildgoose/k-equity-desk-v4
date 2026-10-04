import { Link, useRouterState } from "@tanstack/react-router";
import { SECTORS, FOCUS_SECTOR_IDS } from "@/data/sectors";
import { sectorStatsFromQuotes } from "@/data/stocks";
import { useAppStore, usePriceColors } from "@/lib/store";
import { useMarketQuotes } from "@/lib/use-market";
import { formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Star,
  Crosshair,
  Library,
  Layers,
  Flag,
  Ship,
  Landmark,
  Newspaper,
  Globe2,
  LineChart,
  Activity,
  Bot,
  PieChart,
  BellRing,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  tone?: string;
  search?: Record<string, string>;
};

/** Grouped navigation (F10.1). Every pre-existing URL keeps working. */
export const NAV_GROUPS: { id: string; label: string; items: NavItem[] }[] = [
  {
    id: "kr",
    label: "한국",
    items: [
      { to: "/", label: "대시보드", icon: LayoutDashboard, exact: true },
      { to: "/news/kr", label: "한국 뉴스", icon: Newspaper },
      { to: "/research", label: "리서치 데스크", icon: Library, search: { market: "kr" } },
      { to: "/etfs", label: "퇴직연금 ETF", icon: Layers, tone: "text-desk-gold" },
      { to: "/news/etf", label: "ETF 뉴스", icon: PieChart },
      { to: "/disclosures", label: "주요 공시", icon: FileText },
      { to: "/export-desk", label: "수출 × KOSPI", icon: Ship, tone: "text-desk-gold" },
    ],
  },
  {
    id: "us",
    label: "미국",
    items: [
      { to: "/news/us", label: "미국 뉴스", icon: Globe2 },
      { to: "/research", label: "미국 리서치", icon: LineChart, search: { market: "us" } },
      { to: "/us-research", label: "공식 원문", icon: Landmark, tone: "text-desk-gold" },
      { to: "/us-link", label: "미국 연계", icon: Flag, tone: "text-desk-teal" },
    ],
  },
  {
    id: "themes",
    label: "테마",
    items: [{ to: "/robotics", label: "로봇", icon: Bot, tone: "text-desk-teal" }],
  },
  {
    id: "tools",
    label: "도구",
    items: [
      { to: "/watchlist", label: "관심종목", icon: Star },
      { to: "/settings/alerts", label: "알림 설정", icon: BellRing },
      { to: "/status/sources", label: "소스 상태", icon: Activity },
      { to: "/status/kiwoom", label: "키움 연결 상태", icon: Activity },
    ],
  },
];

function isActive(item: NavItem, pathname: string, search: Record<string, unknown>): boolean {
  const pathHit = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
  if (!pathHit) return false;
  if (item.to === "/research") {
    const market = search.market === "us" ? "us" : "kr";
    return (item.search?.market ?? "kr") === market;
  }
  return true;
}

export function Sidebar({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const focusMode = useAppStore((s) => s.focusMode);
  const setFocusMode = useAppStore((s) => s.setFocusMode);
  const colors = usePriceColors();
  const { data } = useMarketQuotes();
  const quotes = data?.quotes ?? [];

  const sectors = focusMode
    ? SECTORS.filter((s) => FOCUS_SECTOR_IDS.includes(s.id) || s.focus)
    : SECTORS;

  return (
    <aside
      className={cn(
        "shell-sidebar flex h-full w-60 flex-col text-white",
        className,
      )}
    >
      <div className="px-3.5 py-3.5 border-b border-white/[0.08]">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5"
        >
          <span className="flex size-8 items-center justify-center rounded-md bg-gradient-to-br from-desk-gold to-amber-700 text-xs font-bold text-black shadow">
            KX
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight text-white">
              Korea Equity
            </span>
            <span className="block text-[9px] font-medium uppercase tracking-[0.14em] text-white/45">
              Command Center
            </span>
          </span>
        </Link>
      </div>

      <nav className="px-2 py-2 space-y-2" aria-label="주 메뉴">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="space-y-0.5">
            <div className="px-2.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
              {group.label}
            </div>
            {group.items.map((item) => {
              const active = isActive(item, pathname, search);
              const Icon = item.icon;
              return (
                <Link
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  search={item.search as never}
                  onClick={onNavigate}
                  className={cn("nav-item", active ? "nav-item-active" : "nav-item-idle")}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={cn("size-3.5 shrink-0", item.tone || "opacity-80")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mx-2.5 my-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-2">
        <label className="flex items-center justify-between gap-2 text-xs text-white/90">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Crosshair className="size-3 text-desk-gold" />
            Focus 모드
          </span>
          <Switch
            checked={focusMode}
            onCheckedChange={setFocusMode}
            aria-label="Focus 모드"
          />
        </label>
        <p className="mt-1 text-[10px] text-white/50 leading-snug">
          미국 연계 · 반도체 · 전지 · 바이오 · 로봇
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-2 pb-3">
        <div className="px-2.5 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
          Sectors · 산업
        </div>
        <div className="space-y-0.5">
          {sectors.map((s) => {
            const stats = sectorStatsFromQuotes(s.id, quotes);
            // F6.9: the robotics sector row opens the robotics section.
            const robotics = s.id === "robotics";
            const to = robotics ? "/robotics" : `/industry/${s.id}`;
            const active = pathname === to || pathname.startsWith(`${to}/`) || (robotics && pathname.startsWith("/industry/robotics"));
            const up = stats.avgChangePct > 0;
            const color =
              !stats.count || stats.avgChangePct === 0
                ? "text-white/40"
                : up
                  ? colors.up
                  : colors.down;
            const cls = cn(
              "nav-item justify-between",
              active ? "nav-item-active" : "nav-item-idle",
              s.id === "us-linked" && !active && "ring-1 ring-desk-gold/35",
            );
            const body = (
              <>
                <span className="truncate text-[13px]">
                  {s.id === "us-linked" ? (
                    <span className="text-desk-gold mr-1">★</span>
                  ) : null}
                  {s.nameKo}
                </span>
                <span className={cn("text-[11px] tabular shrink-0 font-medium font-mono", color)}>
                  {stats.count ? formatPct(stats.avgChangePct) : "—"}
                </span>
              </>
            );
            return robotics ? (
              <Link key={s.id} to="/robotics" onClick={onNavigate} className={cls} data-sector-link="robotics">
                {body}
              </Link>
            ) : (
              <Link key={s.id} to="/industry/$sectorId" params={{ sectorId: s.id }} onClick={onNavigate} className={cls}>
                {body}
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
