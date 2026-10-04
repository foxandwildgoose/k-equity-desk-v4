/** Pure, pane-local geometry: labels never move vertically from their price bin. */
export type ProfileUnit = "주" | "좌" | "KRW" | "USD";

export interface ProfileLabelRow {
  index: number;
  y: number;
  barWidth: number;
  value: number;
  percent: number;
  /** Hovered and POC rows win only when density makes all labels impossible. */
  priority?: number;
}

export interface LabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProfileLabel extends LabelRect {
  index: number;
  text: string;
  /** Exact native price-coordinate centre, never a collision-adjusted height. */
  priceY: number;
  align: "left" | "right";
  anchorX: number;
  compact: boolean;
}

const quantities = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const compactQuantities = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

export function profileQuantityLabel(
  value: number,
  unit: ProfileUnit,
  estimated = true,
  compact = false,
): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  let amount = quantities.format(value);
  if (compact && value >= 1e8) amount = `${compactQuantities.format(value / 1e8)}억`;
  else if (compact && value >= 1e4) amount = `${compactQuantities.format(value / 1e4)}만`;
  return `${estimated ? "약 " : ""}${amount}${unit === "KRW" || unit === "USD" ? " " : ""}${unit}`;
}

function overlaps(a: LabelRect, b: LabelRect, gap = 2): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

/**
 * Prefer complete quantities inside each bar's right edge, then outside short
 * bars. Compact quantities retain both the real unit and the original percent.
 * Insufficient space omits lower-priority text; the accessible table has every
 * row. Clipping here does not alter the percentages supplied by the calculator.
 */
export function layoutProfileLabels(
  rows: readonly ProfileLabelRow[],
  options: {
    width: number;
    height: number;
    measure: (text: string) => number;
    unit: ProfileUnit;
    estimated?: boolean;
    lineHeight?: number;
    reserved?: readonly LabelRect[];
  },
): ProfileLabel[] {
  const {
    width,
    height,
    measure,
    unit,
    estimated = true,
    lineHeight = 14,
    reserved = [],
  } = options;
  if (!(width > 12 && height >= lineHeight)) return [];
  const labels: ProfileLabel[] = [];
  const ordered = [...rows].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || b.value - a.value || a.index - b.index,
  );
  for (const row of ordered) {
    if (
      ![row.y, row.barWidth, row.value, row.percent].every(Number.isFinite) ||
      row.value < 0 ||
      row.barWidth < 0
    )
      continue;
    const top = row.y - lineHeight / 2;
    if (top < 0 || top + lineHeight > height) continue;
    const end = Math.min(width, row.barWidth);
    const suffix = ` (${row.percent.toFixed(1)}%)`;
    const texts = [
      profileQuantityLabel(row.value, unit, estimated),
      profileQuantityLabel(row.value, unit, estimated, true),
    ];
    let placed = false;
    for (const [variant, quantity] of texts.entries()) {
      const text = quantity + suffix;
      const textWidth = measure(text);
      const candidates = [
        { x: end - 5 - textWidth, align: "right" as const, anchorX: end - 5 },
        { x: end + 5, align: "left" as const, anchorX: end + 5 },
        // The current-price label can occupy the plot's right edge. Keep this
        // row at its actual height and tuck its text immediately to the left
        // of that occupied fragment if there is enough room inside the bar.
        ...reserved
          .filter(
            (area) =>
              area.y < top + lineHeight && area.y + area.height > top && area.x > 0 && area.x < end,
          )
          .map((area) => ({
            x: area.x - 5 - textWidth,
            align: "right" as const,
            anchorX: area.x - 5,
          })),
      ];
      for (const candidate of candidates) {
        const rect = { x: candidate.x - 3, y: top, width: textWidth + 6, height: lineHeight };
        if (rect.x < 2 || rect.x + rect.width > width - 2) continue;
        if ([...reserved, ...labels].some((other) => overlaps(rect, other))) continue;
        labels.push({
          ...rect,
          ...candidate,
          x: rect.x,
          index: row.index,
          text,
          priceY: row.y,
          compact: variant > 0,
        });
        placed = true;
        break;
      }
      if (placed) break;
    }
  }
  return labels.sort((a, b) => a.index - b.index);
}
