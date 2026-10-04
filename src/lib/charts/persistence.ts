/**
 * Chart layout persistence (F7.9): `ked:chart:v2:{market}:{code}:{interval}`
 * holds indicators, drawings, chart type and scale. One-time migration of the
 * legacy `ke-chart-draw:{code}` drawings (bar-index anchors) into the daily
 * layout. Pure — the caller passes a Storage-like object.
 */
import type { BarTime, Drawing } from "./drawings.ts";
import type { IndicatorInstance } from "./catalog.ts";
import { migrateStandardSmas } from "./standard-sma.ts";

export type ChartType = "candles" | "hollow" | "bars" | "heikin-ashi" | "line" | "area" | "baseline";
export type ChartScale = "normal" | "log" | "percent" | "indexed";

export const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: "candles", label: "캔들" },
  { id: "hollow", label: "할로우 캔들" },
  { id: "bars", label: "OHLC 바" },
  { id: "heikin-ashi", label: "하이킨아시" },
  { id: "line", label: "라인" },
  { id: "area", label: "영역" },
  { id: "baseline", label: "베이스라인" },
];

export const CHART_SCALES: { id: ChartScale; label: string }[] = [
  { id: "normal", label: "일반" },
  { id: "log", label: "로그" },
  { id: "percent", label: "%" },
  { id: "indexed", label: "100 기준" },
];

export interface ChartLayoutState {
  v: 2;
  smaBundleVersion?: 1;
  indicators: IndicatorInstance[];
  drawings: Drawing[];
  chartType: ChartType;
  scale: ChartScale;
  overlays: { disclosures: boolean; news: boolean; research: boolean; targets: boolean; dividends: boolean; splits: boolean; signals: boolean };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function safeChartStorage(): StorageLike | null {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}

export function chartStateKey(market: "KR" | "US", code: string, interval: string): string {
  return `ked:chart:v2:${market}:${code.trim().toUpperCase()}:${interval}`;
}

export const LEGACY_DRAW_KEY = (code: string) => `ke-chart-draw:${code}`;

const TYPES = new Set(CHART_TYPES.map((t) => t.id));
const SCALES = new Set(CHART_SCALES.map((s) => s.id));

export const DEFAULT_OVERLAYS: ChartLayoutState["overlays"] = { disclosures: false, news: false, research: false, targets: false, dividends: false, splits: false, signals: false };

function validateOverlays(raw: unknown): ChartLayoutState["overlays"] {
  const value = raw != null && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const validated = Object.fromEntries(Object.entries(DEFAULT_OVERLAYS).map(([key, fallback]) => [key, typeof value[key] === "boolean" ? value[key] : fallback])) as ChartLayoutState["overlays"];
  // Reports/target changes and dividends/splits were previously single toggles.
  // Retain an explicit old boolean for both newly separated meanings.
  if (!Object.hasOwn(value, "targets") && typeof value.research === "boolean") validated.targets = value.research;
  if (!Object.hasOwn(value, "splits") && typeof value.dividends === "boolean") validated.splits = value.dividends;
  return validated;
}

export function defaultLayout(indicators: IndicatorInstance[], chartType: ChartType = "candles", scale: ChartScale = "normal"): ChartLayoutState {
  return { v: 2, smaBundleVersion: 1, indicators, drawings: [], chartType, scale, overlays: { ...DEFAULT_OVERLAYS } };
}

function isAnchor(a: unknown): boolean {
  const x = a as { t?: unknown; p?: unknown };
  return !!x && (typeof x.t === "string" || typeof x.t === "number") && typeof x.p === "number" && Number.isFinite(x.p);
}

function validDrawing(d: unknown): d is Drawing {
  const x = d as Partial<Drawing>;
  return !!x && typeof x.id === "string" && typeof x.type === "string" && Array.isArray(x.anchors) && x.anchors.every(isAnchor);
}

/** Parse + validate a stored layout; null when absent or invalid. */
export function parseChartState(raw: string | null): ChartLayoutState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ChartLayoutState>;
    if (v?.v !== 2) return null;
    return {
      v: 2,
      smaBundleVersion: 1,
      indicators: (() => {
        const indicators = Array.isArray(v.indicators) ? v.indicators.filter(i => i && typeof i.id === "string" && typeof i.uid === "string" && i.params && typeof i.params === "object").map(i => ({ ...i, visible: typeof i.visible === "boolean" ? i.visible : true })) : [];
        return v.smaBundleVersion === 1 ? indicators : migrateStandardSmas(indicators);
      })(),
      drawings: Array.isArray(v.drawings)
        ? v.drawings.filter(validDrawing).map((d) => ({ ...d, color: d.color ?? "#f59e0b", width: d.width ?? 2, locked: Boolean(d.locked), hidden: Boolean(d.hidden) }))
        : [],
      chartType: TYPES.has(v.chartType as ChartType) ? (v.chartType as ChartType) : "candles",
      scale: SCALES.has(v.scale as ChartScale) ? (v.scale as ChartScale) : "normal",
      overlays: validateOverlays(v.overlays),
    };
  } catch {
    return null;
  }
}

export function loadChartState(store: StorageLike, market: "KR" | "US", code: string, interval: string): ChartLayoutState | null {
  try {
    return parseChartState(store.getItem(chartStateKey(market, code, interval)));
  } catch {
    return null;
  }
}

export function saveChartState(store: StorageLike, market: "KR" | "US", code: string, interval: string, state: ChartLayoutState): void {
  try {
    store.setItem(chartStateKey(market, code, interval), JSON.stringify(state));
  } catch {
    /* storage full / blocked */
  }
}

// ── Legacy migration ─────────────────────────────────────────────────
interface LegacyHLine {
  id: string;
  type: "hline";
  price: number;
  color?: string;
  label?: string;
}
interface LegacySeg {
  id: string;
  type: "trend" | "ray" | "fib" | "measure";
  t1: number;
  p1: number;
  t2: number;
  p2: number;
  color?: string;
}

/**
 * Convert legacy `ke-chart-draw:{code}` drawings. Segment anchors were bar
 * indices into the daily bars; they are mapped through `barTimes` and dropped
 * when out of range (never guessed). Horizontal lines keep their price.
 */
export function migrateLegacyDrawings(raw: string | null, barTimes: readonly BarTime[]): { drawings: Drawing[]; dropped: number } {
  if (!raw) return { drawings: [], dropped: 0 };
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return { drawings: [], dropped: 0 };
  }
  if (!Array.isArray(list)) return { drawings: [], dropped: 0 };
  const out: Drawing[] = [];
  let dropped = 0;
  const lastT = barTimes[barTimes.length - 1];
  for (const item of list as (LegacyHLine | LegacySeg)[]) {
    if (!item || typeof item !== "object" || typeof item.id !== "string") {
      dropped += 1;
      continue;
    }
    if (item.type === "hline" && Number.isFinite(item.price)) {
      out.push({ id: `legacy-${item.id}`, type: "hline", anchors: [{ t: lastT ?? 0, p: item.price }], color: item.color ?? "#f59e0b", width: 2, locked: false, hidden: false, text: item.label });
      continue;
    }
    const seg = item as LegacySeg;
    const t1 = barTimes[Math.round(seg.t1)];
    const t2 = barTimes[Math.round(seg.t2)];
    if (t1 === undefined || t2 === undefined || !Number.isFinite(seg.p1) || !Number.isFinite(seg.p2)) {
      dropped += 1;
      continue;
    }
    out.push({ id: `legacy-${seg.id}`, type: seg.type, anchors: [{ t: t1, p: seg.p1 }, { t: t2, p: seg.p2 }], color: seg.color ?? "#f59e0b", width: 2, locked: false, hidden: false });
  }
  return { drawings: out, dropped };
}

/**
 * One-time migration into the daily layout: merges legacy drawings into
 * `ked:chart:v2:KR:{code}:day` and removes the legacy key. Returns the
 * number migrated (0 when nothing to do).
 */
export function migrateLegacyOnce(store: StorageLike, code: string, barTimes: readonly BarTime[], defaults: ChartLayoutState): number {
  const legacyKey = LEGACY_DRAW_KEY(code);
  const raw = store.getItem(legacyKey);
  if (raw == null || !barTimes.length) return 0;
  const { drawings } = migrateLegacyDrawings(raw, barTimes);
  const cur = loadChartState(store, "KR", code, "day") ?? defaults;
  const ids = new Set(cur.drawings.map((d) => d.id));
  const merged = { ...cur, drawings: [...cur.drawings, ...drawings.filter((d) => !ids.has(d.id))] };
  saveChartState(store, "KR", code, "day", merged);
  store.removeItem(legacyKey);
  return drawings.length;
}
