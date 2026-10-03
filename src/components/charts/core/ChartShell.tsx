import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Eye, EyeOff, FileSpreadsheet, HelpCircle, Maximize2, Minimize2, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TimeStamp } from "@/components/feed/TimeStamp";
import { cn } from "@/lib/utils";

export interface LegendItem {
  id: string;
  label: string;
  color?: string;
  value?: string | null;
  visible: boolean;
  onToggle?: () => void;
}

export interface ChartStatus {
  /** Data source label, e.g. "Yahoo Finance", "네이버". */
  source: string;
  /** e.g. "실시간", "지연 15분", "종가 기준". */
  mode: string;
  /** Last update (ISO or epoch ms). */
  updatedAt?: string | number | null;
  /** Date-only as-of label (e.g. "2026-09-25") when the source gives no clock time. */
  asOfLabel?: string | null;
  note?: string;
}

export interface Shortcut {
  keys: string;
  label: string;
}

/**
 * Shared chart chrome (F7.2): toolbar slot (bottom sheet on mobile), HUD,
 * legend with visibility toggles, source/as-of status line, fullscreen,
 * PNG + CSV export, and `?` keyboard help. The chart itself is `children`.
 */
export function ChartShell({
  title,
  toolbar,
  toolbarExtra,
  hud,
  legend = [],
  status,
  onExportPng,
  onExportCsv,
  onFullscreen,
  shortcuts = [],
  onKeyDown,
  children,
  footer,
  className,
  testId,
  height,
  collapseToolbar = false,
}: {
  title?: ReactNode;
  toolbar?: ReactNode;
  /** Always-visible controls (e.g. interval) that stay inline on mobile. */
  toolbarExtra?: ReactNode;
  hud?: ReactNode;
  legend?: LegendItem[];
  status: ChartStatus | null;
  onExportPng?: () => void;
  onExportCsv?: () => void;
  /** Override fullscreen (e.g. open the /chart workspace). Default: Fullscreen API. */
  onFullscreen?: () => void;
  shortcuts?: Shortcut[];
  onKeyDown?: (e: React.KeyboardEvent) => void;
  children: ReactNode;
  /** Sits under the plot and inside fullscreen (range stats, notes). */
  footer?: ReactNode;
  className?: string;
  testId?: string;
  height?: number | string;
  /** Always put the toolbar in the bottom sheet (dense multi-chart layouts). */
  collapseToolbar?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFull, setIsFull] = useState(false);
  const [help, setHelp] = useState(false);
  const [tools, setTools] = useState(false);

  useEffect(() => {
    const on = () => setIsFull(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const toggleFull = useCallback(() => {
    if (onFullscreen) return onFullscreen();
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void el.requestFullscreen?.().catch(() => undefined);
  }, [onFullscreen]);

  const handleKey = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (e.key === "?") {
      e.preventDefault();
      setHelp(true);
      return;
    }
    onKeyDown?.(e);
  };

  const allShortcuts: Shortcut[] = [{ keys: "?", label: "단축키 도움말" }, ...shortcuts];

  return (
    <div
      ref={rootRef}
      className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card outline-none", isFull && "h-full rounded-none", className)}
      tabIndex={0}
      onKeyDown={handleKey}
      data-testid={testId ?? "chart-shell"}
      aria-label={typeof title === "string" ? title : "차트"}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 border-b border-border px-2 py-1.5">
        {title && <div className="mr-1 min-w-0 truncate text-[12px] font-semibold">{title}</div>}
        {toolbarExtra}
        {toolbar && !collapseToolbar && <div className="hidden min-w-0 flex-wrap items-center gap-1 md:flex">{toolbar}</div>}
        <div className="ml-auto flex items-center gap-0.5">
          {toolbar && (
            <button type="button" onClick={() => setTools(true)} className={cn("inline-flex size-11 items-center justify-center rounded-md hover:bg-muted", collapseToolbar ? "md:size-8" : "md:hidden")} aria-label="차트 도구" data-testid="chart-tools-mobile">
              <SlidersHorizontal className="size-4" />
            </button>
          )}
          {onExportPng && (
            <button type="button" onClick={onExportPng} className="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted md:size-8" aria-label="PNG로 저장" title="PNG로 저장" data-testid="chart-export-png">
              <Download className="size-3.5" />
            </button>
          )}
          {onExportCsv && (
            <button type="button" onClick={onExportCsv} className="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted md:size-8" aria-label="보이는 구간 CSV" title="보이는 구간 CSV" data-testid="chart-export-csv">
              <FileSpreadsheet className="size-3.5" />
            </button>
          )}
          <button type="button" onClick={() => setHelp(true)} className="hidden size-8 items-center justify-center rounded-md hover:bg-muted md:inline-flex" aria-label="단축키 도움말 (?)" title="단축키 (?)">
            <HelpCircle className="size-3.5" />
          </button>
          <button type="button" onClick={toggleFull} className="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted md:size-8" aria-label={isFull ? "전체 화면 종료" : "전체 화면"} title={isFull ? "전체 화면 종료" : "전체 화면"} data-testid="chart-fullscreen">
            {isFull ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        </div>
      </div>
      {(hud || legend.length > 0) && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-2 py-1 text-[11px]" data-testid="chart-hud">
          {hud}
          {legend.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1" aria-label="범례">
              {legend.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={l.onToggle}
                  disabled={!l.onToggle}
                  aria-pressed={l.visible}
                  className={cn("inline-flex min-h-8 items-center gap-1 rounded px-1.5 text-[10.5px] hover:bg-muted", !l.visible && "opacity-50")}
                  title={l.onToggle ? (l.visible ? "숨기기" : "표시") : undefined}
                >
                  {l.onToggle ? l.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" /> : null}
                  <span style={{ color: l.color }}>{l.label}</span>
                  {l.value != null && <span className="tabular text-muted-foreground">{l.value}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className={cn("relative", isFull && "min-h-0 flex-1")} style={isFull ? undefined : { height }}>
        {children}
      </div>
      {footer}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-border px-2 py-1 text-[10px] text-muted-foreground" data-testid="chart-status">
        {status ? (
          <>
            <span>
              출처 <b className="font-semibold text-foreground/80">{status.source || "—"}</b>
            </span>
            <span>· {status.mode}</span>
            <span>
              · 기준 {status.asOfLabel ? <span className="tabular">{status.asOfLabel}</span> : status.updatedAt != null ? <TimeStamp publishedAt={typeof status.updatedAt === "number" ? new Date(status.updatedAt).toISOString() : status.updatedAt} precision="second" /> : "—"}
            </span>
            {status.note && <span>· {status.note}</span>}
          </>
        ) : (
          <span>출처·기준 시각 확인 전 — 데이터가 없으면 차트를 그리지 않습니다.</span>
        )}
      </div>

      <Sheet open={tools} onOpenChange={setTools}>
        <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto" data-testid="chart-tools-sheet">
          <SheetHeader>
            <SheetTitle>차트 도구</SheetTitle>
            <SheetDescription>차트 종류·스케일·지표·그리기·비교·리플레이</SheetDescription>
          </SheetHeader>
          <div className="flex flex-wrap items-center gap-1.5 px-4 pb-6 [&_button]:min-h-11 [&_select]:min-h-11">{toolbar}</div>
        </SheetContent>
      </Sheet>
      <Sheet open={help} onOpenChange={setHelp}>
        <SheetContent side="right" className="w-full max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle>단축키</SheetTitle>
            <SheetDescription>차트를 한 번 클릭한 뒤 사용하세요.</SheetDescription>
          </SheetHeader>
          <ul className="space-y-1 px-4 pb-6 text-[12px]">
            {allShortcuts.map((s) => (
              <li key={s.keys} className="flex items-center justify-between gap-2">
                <span>{s.label}</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{s.keys}</kbd>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}
