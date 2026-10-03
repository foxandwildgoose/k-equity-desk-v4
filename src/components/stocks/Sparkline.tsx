import { useMemo } from "react";
import { usePriceColors } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Sparkline({
  data,
  changePct,
  width = 72,
  height = 28,
  className,
  label,
}: {
  data: number[];
  changePct?: number;
  width?: number;
  height?: number;
  className?: string;
  /** Accessible description (name, period, source). */
  label?: string;
}) {
  const colors = usePriceColors();
  const up = (changePct ?? (data[data.length - 1]! - data[0]!)) >= 0;

  const path = useMemo(() => {
    if (data.length < 2) return "";
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pad = 2;
    const w = width - pad * 2;
    const h = height - pad * 2;
    return data
      .map((v, i) => {
        const x = pad + (i / (data.length - 1)) * w;
        const y = pad + h - ((v - min) / range) * h;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data, width, height]);

  const stroke = up ? "var(--price-up)" : "var(--price-down)";
  // Use CSS variables based on convention — force via class on parent isn't available in SVG stroke easily
  // so we use currentColor and set color on the svg

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0", up ? colors.up : colors.down, className)}
      role="img"
      aria-label={label ?? `가격 추이 ${data.length}개 점${changePct != null ? `, 등락 ${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` : ""}`}
    >
      <title>{label ?? `가격 추이 (${data.length}개 점)`}</title>
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke }}
      />
    </svg>
  );
}
