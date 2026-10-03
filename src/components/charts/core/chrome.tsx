import { useEffect, useMemo, useState } from "react";
import { PriceScaleMode, type IChartApi, type ISeriesApi, type MouseEventParams, type SeriesType, type Time } from "lightweight-charts";
import type { LegendItem } from "@/components/charts/core/ChartShell";
import { downloadCanvasPng, downloadCsv } from "@/components/charts/core/export";
import { chartExportName } from "@/lib/charts/tools";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for the Tier B charts (F7.16): legend with visibility
 * toggles, crosshair HUD, range presets, scale switch and PNG/CSV export,
 * wired to an existing `IChartApi` without touching the chart's domain logic.
 */
export interface ChromeSeries {
  id: string;
  label: string;
  color: string;
  api: ISeriesApi<SeriesType> | null;
  format?: (v: number) => string;
}

function timeLabel(t: Time | undefined): string {
  if (t == null) return "";
  if (typeof t === "string") return t;
  if (typeof t === "number") return new Date(t * 1000).toISOString().slice(0, 16).replace("T", " ");
  return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
}

export function useChartChrome(chart: IChartApi | null, series: ChromeSeries[]) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [hover, setHover] = useState<{ time: string; values: Record<string, number | null> } | null>(null);
  const key = series.map((s) => s.id).join(",");

  useEffect(() => {
    for (const s of series) s.api?.applyOptions({ visible: !hidden.has(s.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, key, chart]);

  useEffect(() => {
    if (!chart) return;
    const onMove = (p: MouseEventParams<Time>) => {
      if (p.time == null) return setHover(null);
      const values: Record<string, number | null> = {};
      for (const s of series) {
        const d = s.api ? (p.seriesData.get(s.api) as { value?: number; close?: number } | undefined) : undefined;
        values[s.id] = d?.value ?? d?.close ?? null;
      }
      setHover({ time: timeLabel(p.time), values });
    };
    chart.subscribeCrosshairMove(onMove);
    return () => chart.unsubscribeCrosshairMove(onMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, key]);

  const legend: LegendItem[] = series.map((s) => {
    const v = hover?.values[s.id];
    return {
      id: s.id,
      label: s.label,
      color: s.color,
      value: v != null ? (s.format ? s.format(v) : v.toLocaleString("ko-KR", { maximumFractionDigits: 2 })) : null,
      visible: !hidden.has(s.id),
      onToggle: () =>
        setHidden((h) => {
          const n = new Set(h);
          if (n.has(s.id)) n.delete(s.id);
          else n.add(s.id);
          return n;
        }),
    };
  });
  const hud = hover ? <span className="tabular text-muted-foreground">{hover.time}</span> : null;
  return { legend, hud };
}

const PRESETS: { id: string; label: string; days: number | null }[] = [
  { id: "1m", label: "1M", days: 31 },
  { id: "3m", label: "3M", days: 92 },
  { id: "6m", label: "6M", days: 183 },
  { id: "1y", label: "1Y", days: 366 },
  { id: "3y", label: "3Y", days: 1096 },
  { id: "5y", label: "5Y", days: 1827 },
  { id: "all", label: "전체", days: null },
];

function toDate(t: string | number): Date {
  return typeof t === "number" ? new Date(t * 1000) : new Date(`${t.slice(0, 10)}T00:00:00Z`);
}

/** Range presets relative to the last data point (daily/weekly/monthly series). */
export function RangePresets({ chart, first, last, compact = false }: { chart: IChartApi | null; first?: string | number | null; last?: string | number | null; compact?: boolean }) {
  const [active, setActive] = useState("all");
  const usable = useMemo(() => {
    if (first == null || last == null) return [];
    const spanDays = (toDate(last).getTime() - toDate(first).getTime()) / 86_400_000;
    return PRESETS.filter((p) => p.days == null || p.days < spanDays);
  }, [first, last]);
  if (!usable.length || last == null) return null;
  const apply = (p: (typeof PRESETS)[number]) => {
    setActive(p.id);
    if (!chart) return;
    if (p.days == null) return chart.timeScale().fitContent();
    const end = toDate(last);
    const start = new Date(end.getTime() - p.days * 86_400_000);
    const fmt = (d: Date) => (typeof last === "number" ? Math.floor(d.getTime() / 1000) : d.toISOString().slice(0, 10));
    try {
      chart.timeScale().setVisibleRange({ from: fmt(start) as Time, to: fmt(end) as Time });
    } catch {
      chart.timeScale().fitContent();
    }
  };
  return (
    <div className="flex flex-wrap gap-0.5 rounded-md bg-muted p-0.5" role="group" aria-label="기간">
      {usable.map((p) => (
        <button key={p.id} type="button" onClick={() => apply(p)} className={cn("rounded px-1.5 text-[11px] font-medium", compact ? "min-h-8" : "min-h-8", active === p.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

const SCALE_LABEL = { normal: "일반", log: "로그", percent: "%" } as const;
const SCALE_MODE = { normal: PriceScaleMode.Normal, log: PriceScaleMode.Logarithmic, percent: PriceScaleMode.Percentage } as const;

export function ScaleToggle({ chart, allowed = ["normal", "log", "percent"], priceScaleIds = ["right"] }: { chart: IChartApi | null; allowed?: (keyof typeof SCALE_LABEL)[]; priceScaleIds?: string[] }) {
  const [mode, setMode] = useState<keyof typeof SCALE_LABEL>("normal");
  const ids = priceScaleIds.join(",");
  useEffect(() => {
    for (const id of ids.split(",")) {
      try {
        chart?.priceScale(id).applyOptions({ mode: SCALE_MODE[mode] });
      } catch {
        /* scale not present */
      }
    }
  }, [chart, mode, ids]);
  return (
    <select value={mode} onChange={(e) => setMode(e.target.value as keyof typeof SCALE_LABEL)} className="h-8 rounded-md border border-border bg-background px-1 text-[11px]" aria-label="스케일">
      {allowed.map((m) => (
        <option key={m} value={m}>
          {SCALE_LABEL[m]}
        </option>
      ))}
    </select>
  );
}

export function exportChartPng(chart: IChartApi | null, market: "KR" | "US", code: string, kind: string) {
  if (!chart) return;
  downloadCanvasPng(chart.takeScreenshot(true, false), chartExportName(market, code || "chart", kind, "png", Date.now()));
}

/** CSV of rows inside the chart's visible time range (all rows when unknown). */
export function exportRowsCsv<T extends { time: string | number }>(chart: IChartApi | null, rows: readonly T[], columns: { name: string; get: (r: T) => number | string | null | undefined }[], market: "KR" | "US", code: string, kind: string) {
  const r = chart?.timeScale().getVisibleRange();
  const inRange = (t: string | number) => {
    if (!r) return true;
    const from = r.from as unknown as string | number;
    const to = r.to as unknown as string | number;
    return typeof t === "number" && typeof from === "number" ? t >= from && t <= (to as number) : String(t) >= String(from) && String(t) <= String(to); // ked-allow-string-date-sort: single-format time series
  };
  const lines = [["time", ...columns.map((c) => c.name)].join(",")];
  for (const row of rows) if (inRange(row.time)) lines.push([row.time, ...columns.map((c) => c.get(row) ?? "")].join(","));
  downloadCsv(lines.join("\n"), chartExportName(market, code || "chart", kind, "csv", Date.now()));
}
