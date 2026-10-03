import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, BellRing, Pause, Play, Settings2, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FeedList } from "@/components/feed/FeedList";
import { FeedRow } from "@/components/feed/FeedRow";
import { SourceHealthChip } from "@/components/feed/SourceHealthChip";
import { TimeStamp } from "@/components/feed/TimeStamp";
import { krTickerLabel } from "@/components/feed/NewsDesk";
import { useAppStore } from "@/lib/store";
import { useWatchContext } from "@/lib/use-feed";
import { sourceFacets } from "@/lib/feed/filters";
import { matchesWireTab, meetsTier, WIRE_TABS, type WireTab } from "@/lib/wire/live-wire";
import { enableDesktopAlerts, notificationPermission, useLiveWire, useLiveWireEngine, useWireStore } from "@/lib/wire/use-live-wire";
import type { ImportanceTierPref } from "@/lib/store-migrate";
import { cn } from "@/lib/utils";

/** Mount once: runs the Live Wire engine (leader election + polling + notifications). */
export function LiveWireRunner() {
  useLiveWireEngine();
  return null;
}

/** Header button with unread badge (F8.3). */
export function LiveWireButton() {
  const unread = useWireStore((s) => s.unread);
  const setOpen = useWireStore((s) => s.setDrawerOpen);
  const label = unread > 0 ? `Live Wire — 새 항목 ${unread}건` : "Live Wire";
  return (
    <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label={label} title={label} className="relative" data-testid="live-wire-button">
      {unread > 0 ? <BellRing className="size-3.5" /> : <Bell className="size-3.5" />}
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-price-up px-1 text-center text-[9px] font-bold leading-4 text-white tabular" data-testid="live-wire-badge">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Button>
  );
}

function DesktopAlertsButton({ className }: { className?: string }) {
  const osEnabled = useAppStore((s) => s.alertSettings.osEnabled);
  // Read the permission after mount (SSR has no Notification API).
  const [perm, setPerm] = useState<ReturnType<typeof notificationPermission> | null>(null);
  useEffect(() => setPerm(notificationPermission()), []);
  if (perm == null) return null;
  if (perm === "unsupported") return <span className={cn("text-[10.5px] text-muted-foreground", className)}>이 브라우저는 데스크톱 알림을 지원하지 않습니다.</span>;
  if (osEnabled && perm === "granted") return <span className={cn("text-[10.5px] text-emerald-500", className)}>데스크톱 알림 켜짐</span>;
  return (
    <button
      type="button"
      onClick={async () => setPerm(await enableDesktopAlerts())}
      className={cn("inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-semibold hover:bg-muted/50", className)}
      data-testid="enable-desktop-alerts"
    >
      <BellRing className="size-3" /> 데스크톱 알림 켜기
    </button>
  );
}

export { DesktopAlertsButton };

/** Right drawer: tabs, min tier + source filters, pause, FeedRow items (F8.3). */
export function LiveWireDrawer() {
  const wire = useLiveWire();
  const paused = useAppStore((s) => s.alertSettings.paused);
  const setAlertSettings = useAppStore((s) => s.setAlertSettings);
  const watch = useWatchContext();
  const [tab, setTab] = useState<WireTab>("all");
  const [minTier, setMinTier] = useState<ImportanceTierPref>("normal");
  const [sources, setSources] = useState<string[]>([]);
  const facets = useMemo(() => sourceFacets(wire.items), [wire.items]);
  const visible = useMemo(
    () =>
      wire.items.filter(
        (it) =>
          matchesWireTab(it, tab, watch) &&
          meetsTier(it, minTier) &&
          (!sources.length || sources.includes(it.sourceId) || (it.cluster?.members?.some((m) => sources.includes(m.sourceId)) ?? false)),
      ),
    [wire.items, tab, watch, minTier, sources],
  );
  const reason =
    wire.role === "starting"
      ? "연결 중…"
      : wire.errorCount > 0 && !wire.items.length
        ? `Live Wire 응답 실패 (${wire.lastError ?? "오류"}) — 재시도 대기 중입니다.`
        : wire.items.length && visible.length === 0
          ? "현재 탭·필터에 맞는 항목이 없습니다."
          : wire.sources.length && wire.sources.every((s) => !s.ok)
            ? `소스 ${wire.sources.length}곳 모두 응답 없음(소스 미검증·네트워크 차단 등) — 채워 넣지 않습니다.`
            : "아직 수신한 항목이 없습니다.";
  return (
    <Sheet open={wire.drawerOpen} onOpenChange={wire.setDrawerOpen}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col gap-0 overflow-hidden p-0" data-testid="live-wire-drawer">
        <SheetHeader className="border-b border-border bg-card">
          <SheetTitle className="flex items-center gap-2 pr-6 text-base">
            <BellRing className="size-4 text-price-up" /> Live Wire
          </SheetTitle>
          <SheetDescription asChild>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  기준 {wire.generatedAt ? <TimeStamp publishedAt={wire.generatedAt} precision="second" /> : "—"}
                </span>
                <span className="rounded border border-border px-1.5 py-0.5">
                  {wire.role === "leader" ? "이 탭이 수신 담당" : wire.role === "follower" ? "다른 탭에서 수신 공유" : "연결 중"}
                </span>
                {paused && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-500">일시정지</span>}
                <SourceHealthChip sources={wire.sources} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAlertSettings({ paused: !paused })}
                  aria-pressed={paused}
                  className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 font-semibold text-foreground hover:bg-muted/50"
                  data-testid="live-wire-pause"
                >
                  {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
                  {paused ? "재개" : "일시정지"}
                </button>
                <DesktopAlertsButton />
                <Link
                  to="/settings/alerts"
                  onClick={() => wire.setDrawerOpen(false)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-semibold text-primary hover:underline"
                >
                  <Settings2 className="size-3" /> 알림 설정
                </Link>
              </div>
            </div>
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2 border-b border-border p-2.5">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-6" role="tablist" aria-label="Live Wire 탭">
            {WIRE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn("min-h-9 rounded-md text-[11px] font-semibold", tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <select
              value={minTier}
              onChange={(e) => setMinTier(e.target.value as ImportanceTierPref)}
              className="h-9 rounded-md border border-border bg-background px-2 text-xs"
              aria-label="최소 중요도"
            >
              <option value="normal">중요도 전체</option>
              <option value="high">HIGH 이상</option>
              <option value="flash">FLASH만</option>
            </select>
            {facets.slice(0, 8).map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={sources.includes(f.id)}
                onClick={() => setSources((xs) => (xs.includes(f.id) ? xs.filter((x) => x !== f.id) : [...xs, f.id]))}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-md border px-2 text-[10.5px]",
                  sources.includes(f.id) ? "border-foreground/30 bg-foreground text-background" : "border-border text-muted-foreground",
                )}
              >
                {f.name} <span className="ml-1 opacity-60">{f.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-2.5">
          <ChartAlertsSection />
          <FeedList
            items={visible}
            emptyReason={reason}
            loading={wire.role === "starting"}
            renderRow={(it) => (
              <FeedRow item={it} tierBar labelFor={krTickerLabel} className={cn(wire.highlightId === it.id && "bg-amber-500/10 ring-1 ring-inset ring-amber-500/50")} />
            )}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Optional desktop bottom ticker tape (F8.3; off by default). */
export function TickerTape() {
  const on = useAppStore((s) => s.alertSettings.tickerTape);
  const items = useWireStore((s) => s.items);
  const top = useMemo(() => items.filter((it) => meetsTier(it, "high")).slice(0, 12), [items]);
  const openItem = useWireStore((s) => s.openItem);
  if (!on) return null;
  return (
    <div className="hidden h-8 overflow-hidden border-t border-border bg-panel/95 text-[11px] backdrop-blur md:block" data-testid="ticker-tape" aria-label="Live Wire 티커">
      <style>{`@keyframes ked-tape{from{transform:translateX(0)}to{transform:translateX(-50%)}}@media (prefers-reduced-motion: reduce){.ked-tape{animation:none!important}}`}</style>
      {top.length === 0 ? (
        <div className="flex h-8 items-center px-3 text-muted-foreground">Live Wire: HIGH 이상 항목 없음 또는 수신 전</div>
      ) : (
        <div className="ked-tape flex h-8 w-max items-center gap-6 whitespace-nowrap px-3" style={{ animation: `ked-tape ${Math.max(30, top.length * 8)}s linear infinite` }}>
          {[...top, ...top].map((it, i) => (
            <button key={`${it.id}-${i}`} type="button" onClick={() => openItem(it.id)} className="inline-flex items-center gap-1.5 hover:underline">
              <span className={cn("size-1.5 rounded-full", it.importance?.tier === "flash" ? "bg-price-up" : "bg-amber-500")} />
              <TimeStamp publishedAt={it.publishedAt} precision={it.precision} className="text-muted-foreground" />
              <span className="font-medium">{it.title}</span>
              <span className="text-muted-foreground">{it.outlet ?? it.sourceName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Chart alerts (F7.11) listed and managed in the Live Wire drawer. */
function ChartAlertsSection() {
  const alerts = useAppStore((s) => s.alertSettings.priceAlerts);
  const remove = useAppStore((s) => s.removePriceAlert);
  if (!alerts.length) return null;
  return (
    <details className="mb-2 rounded-lg border border-border bg-muted/15 p-2 text-[11px]" data-testid="wire-chart-alerts">
      <summary className="cursor-pointer font-semibold">
        차트 알림 {alerts.filter((a) => a.active).length}/{alerts.length}
      </summary>
      <ul className="mt-1.5 space-y-1">
        {alerts.map((a) => (
          <li key={a.id} className="flex items-center gap-2">
            <Link
              to={a.market === "KR" ? "/stock/$ticker" : "/us/$symbol"}
              params={a.market === "KR" ? { ticker: a.code } : { symbol: a.code }}
              className="min-w-0 flex-1 truncate hover:underline"
            >
              {a.name ?? a.code} · {a.kind === "price-cross" ? `가격 ${a.level?.toLocaleString("ko-KR")}` : a.kind === "rsi-cross" ? `RSI ${a.level}` : `이평 ${a.fast}/${a.slow}`} · {a.active ? "대기" : "완료"}
            </Link>
            {a.lastFiredAt && <TimeStamp publishedAt={a.lastFiredAt} precision="second" className="text-muted-foreground" />}
            <button type="button" onClick={() => remove(a.id)} className="inline-flex size-9 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="알림 삭제">
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
