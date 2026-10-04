import { useMemo } from "react";
import { usePriceColors } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useStandardSma } from "@/components/charts/core/use-standard-sma";
import { SmaControls } from "@/components/charts/core/SmaControls";
import { latestSmaPoint, layoutSmaLabels, resolveSmaStyle, STANDARD_SMA_PERIODS } from "@/lib/charts/standard-sma";
import { formatChartPrice } from "@/lib/chart-format";

export function Sparkline({
  data,
  code = "preview",
  changePct,
  width = 72,
  height = 28,
  className,
  label,
}: {
  data: number[];
  code?: string;
  changePct?: number;
  width?: number;
  height?: number;
  className?: string;
  /** Accessible description (name, period, source). */
  label?: string;
}) {
  const colors = usePriceColors();
  const up = (changePct ?? (data[data.length - 1]! - data[0]!)) >= 0;

  // These previews contain only 20 session closes. Long SMAs stay unavailable;
  // do not fetch every table row or manufacture a 200-session average.
  const points = useMemo(() => data.map((value, time) => ({ time, value })), [data]);
  const averages = useStandardSma({ chart: null, source: null, points, scope: `sparkline:${code}:day`, formatValue: n => formatChartPrice(n, "KR") });
  const plotWidth = Math.max(width, 280);
  const plotHeight = Math.max(height, 80);
  const minimum = Math.min(...data.filter(Number.isFinite));
  const maximum = Math.max(...data.filter(Number.isFinite));
  const range = maximum - minimum || 1;
  const x = (i: number) => 2 + i / Math.max(1, data.length - 1) * (plotWidth - 102);
  const y = (value: number) => 6 + (maximum - value) / range * (plotHeight - 12);
  const pathFor = (values: readonly (number | null)[]) => {
    let connected = false;
    return values.map((value, i) => {
      if (value == null || !Number.isFinite(value)) { connected = false; return ""; }
      const command = `${connected ? "L" : "M"}${x(i).toFixed(1)},${y(value).toFixed(1)}`;
      connected = true;
      return command;
    }).join(" ");
  };
  const active = STANDARD_SMA_PERIODS.flatMap(period => {
    const instance = averages.instances.find(i => i.id === "sma" && Number(i.params.period) === period);
    const point = latestSmaPoint(points, averages.values[period], Boolean(instance?.visible));
    return point?.value == null || !instance ? [] : [{ period, value: point.value, color: resolveSmaStyle(instance, averages.mode)!.color }];
  });
  const labels = layoutSmaLabels(active.map(row => ({ period: row.period, y: y(row.value), targetY: y(row.value) })), plotHeight, 8, 8);

  const stroke = up ? "var(--price-up)" : "var(--price-down)";
  // Use CSS variables based on convention — force via class on parent isn't available in SVG stroke easily
  // so we use currentColor and set color on the svg

  return (
    <div className="flex flex-col gap-1" data-testid="sma-sparkline">
    <SmaControls instances={averages.instances} unavailable={averages.unavailable} mode={averages.mode} onToggle={averages.toggle} disabled={!averages.ready} />
    <svg
      width={plotWidth}
      height={plotHeight}
      viewBox={`0 0 ${plotWidth} ${plotHeight}`}
      className={cn("shrink-0", up ? colors.up : colors.down, className)}
      role="img"
      aria-label={label ?? `가격 추이 ${data.length}개 점${changePct != null ? `, 등락 ${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` : ""}`}
    >
      <title>{label ?? `가격 추이 (${data.length}개 점)`}</title>
      <path
        d={pathFor(data)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke }}
      />
      {active.map(row => <path key={row.period} d={pathFor(averages.values[row.period])} fill="none" stroke={row.color} strokeWidth={resolveSmaStyle(averages.instances.find(i => Number(i.params.period) === row.period)!, averages.mode)!.visualWidth} />)}
      {labels.map(position => {
        const row = active.find(r => r.period === position.period)!;
        return <text key={row.period} x={plotWidth - 98} y={position.y} fill={row.color} fontSize={10} dominantBaseline="middle" aria-label={`SMA ${row.period} ${formatChartPrice(row.value, "KR")}`}>SMA{row.period} {formatChartPrice(row.value, "KR")}</text>;
      })}
    </svg>
    <span className="text-xs text-muted-foreground">{data.length}봉 · 실제 관측값 기준</span>
    </div>
  );
}
