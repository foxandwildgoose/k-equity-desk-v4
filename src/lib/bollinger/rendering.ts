import type { BollingerSystemSettings } from "./types.ts";

/** Theme-aware, subordinate to candle/SMA styling. Explicit overrides are retained. */
export function getBollingerRenderingStyle(mode: "light" | "dark", override?: string) {
  const palette = mode === "light"
    ? { upper: "#607D96", lower: "#80738C", middle: "#718096", percentB: "#347EAA", bandwidth: "#927538", guide: "#9BA8B5", fillOpacity: 0.065 }
    : { upper: "#8DA7BC", lower: "#AA9BB5", middle: "#91A0AE", percentB: "#79BCE4", bandwidth: "#C8A86E", guide: "#61758B", fillOpacity: 0.055 };
  return { ...palette, upper: override ?? palette.upper, lower: override ?? palette.lower,
    middle: override ?? palette.middle, fill: override ?? palette.upper };
}

export const BOLLINGER_PERCENT_B_GUIDES = [1, 0.8, 0.5, 0.2, 0] as const;

/** %B reference range is included, never imposed as a clamp on real observations. */
export function percentBAutoscaleRange(minValue: number, maxValue: number) {
  return { minValue: Math.min(0, minValue), maxValue: Math.max(1, maxValue) };
}

export function bollingerMiddleVisible(settings: Pick<BollingerSystemSettings, "middle" | "period" | "source" | "basis">, sma20Visible: boolean) {
  if (settings.middle === "off") return false;
  if (settings.middle === "on") return true;
  return !(sma20Visible && settings.period === 20 && settings.source === "close" && settings.basis === "sma");
}

export function bollingerPanePlan(settings: Pick<BollingerSystemSettings, "enabled" | "percentB" | "bandwidth">, expanded: boolean, start: number) {
  let pane = start;
  const percentB = settings.enabled && expanded && settings.percentB ? pane++ : null;
  const bandwidth = settings.enabled && expanded && settings.bandwidth ? pane++ : null;
  return { percentB, bandwidth, paneCount: pane - start };
}

export function bollingerPaneCount(settings: Pick<BollingerSystemSettings, "enabled" | "percentB" | "bandwidth">, expanded: boolean) {
  return bollingerPanePlan(settings, expanded, 0).paneCount;
}

export interface BollingerFillRow { time: string | number; upper: number | null; lower: number | null }
export interface BollingerFillVertex { x: number; upperY: number; lowerY: number }

/** Null/invalid bands split polygons, so no shaded evidence is invented across gaps. */
export function bollingerFillPolygons(rows: readonly BollingerFillRow[], project: (row: BollingerFillRow) => BollingerFillVertex | null,
  from = 0, to = rows.length - 1): BollingerFillVertex[][] {
  const polygons: BollingerFillVertex[][] = [];
  let run: BollingerFillVertex[] = [];
  const flush = () => { if (run.length >= 2) polygons.push(run); run = []; };
  for (let i = Math.max(0, from); i <= Math.min(rows.length - 1, to); i++) {
    const row = rows[i]!;
    const vertex = row.upper != null && row.lower != null && Number.isFinite(row.upper) && Number.isFinite(row.lower) && row.upper >= row.lower
      ? project(row) : null;
    if (!vertex || ![vertex.x, vertex.upperY, vertex.lowerY].every(Number.isFinite)) flush();
    else run.push(vertex);
  }
  flush();
  return polygons;
}
