/**
 * Drawing model (F7.7): time/price anchors (bar-time keyed so drawings survive
 * reloads), geometry helpers, fib/position/measure maths, magnet + KRX tick
 * snapping, and an undo/redo history reducer. Pure module.
 */
import { snapToKrxTick, type KrxInstrument } from "../chart-format.ts";

export type DrawingType =
  | "trend"
  | "ray"
  | "extended"
  | "hline"
  | "hray"
  | "vline"
  | "channel"
  | "rect"
  | "fib"
  | "fibext"
  | "measure"
  | "long"
  | "short"
  | "text"
  | "arrow";

/** Bar time key: "YYYY-MM-DD" (daily+) or unix seconds (intraday). */
export type BarTime = string | number;

export interface Anchor {
  t: BarTime;
  p: number;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  anchors: Anchor[];
  color: string;
  width: number;
  locked: boolean;
  hidden: boolean;
  text?: string;
  /** Linked price alert id (hline alerts). */
  alertId?: string;
}

export const DRAWING_TOOLS: { type: DrawingType; label: string; key: string; anchors: number }[] = [
  { type: "trend", label: "추세선", key: "t", anchors: 2 },
  { type: "ray", label: "레이", key: "r", anchors: 2 },
  { type: "extended", label: "연장선", key: "e", anchors: 2 },
  { type: "hline", label: "수평선", key: "h", anchors: 1 },
  { type: "hray", label: "수평 레이", key: "j", anchors: 1 },
  { type: "vline", label: "수직선", key: "v", anchors: 1 },
  { type: "channel", label: "평행 채널", key: "c", anchors: 3 },
  { type: "rect", label: "사각형", key: "b", anchors: 2 },
  { type: "fib", label: "피보나치 되돌림", key: "f", anchors: 2 },
  { type: "fibext", label: "피보나치 확장", key: "x", anchors: 3 },
  { type: "measure", label: "측정", key: "m", anchors: 2 },
  { type: "long", label: "롱 포지션", key: "l", anchors: 2 },
  { type: "short", label: "숏 포지션", key: "s", anchors: 2 },
  { type: "text", label: "텍스트", key: "n", anchors: 1 },
  { type: "arrow", label: "화살표", key: "a", anchors: 2 },
];

export function anchorsFor(type: DrawingType): number {
  return DRAWING_TOOLS.find((t) => t.type === type)?.anchors ?? 2;
}

export const DEFAULT_DRAWING_COLOR = "#f59e0b";

export function newDrawing(type: DrawingType, anchors: Anchor[], id: string, opts: Partial<Pick<Drawing, "color" | "width" | "text">> = {}): Drawing {
  let a = anchors;
  if ((type === "long" || type === "short") && anchors.length === 2) {
    // entry, target → stop at half the target distance on the other side (R:R 2).
    const [entry, target] = anchors as [Anchor, Anchor];
    a = [entry, target, { t: target.t, p: entry.p - (target.p - entry.p) / 2 }];
  }
  const d: Drawing = {
    id,
    type,
    anchors: a,
    color: opts.color ?? (type === "long" ? "#22c55e" : type === "short" ? "#ef4444" : DEFAULT_DRAWING_COLOR),
    width: opts.width ?? 2,
    locked: false,
    hidden: false,
  };
  const text = opts.text ?? (type === "text" ? "메모" : undefined);
  if (text !== undefined) d.text = text;
  return d;
}

// ── Maths ────────────────────────────────────────────────────────────
export const FIB_RETRACEMENT = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
export const FIB_EXTENSION = [0.618, 1, 1.272, 1.618, 2.618];

/** Retracement from `from` (level 1) to `to` (level 0). */
export function fibRetracementLevels(from: number, to: number): { level: number; price: number }[] {
  return FIB_RETRACEMENT.map((level) => ({ level, price: to - (to - from) * level }));
}

/** Extension of the A→B move projected from C. */
export function fibExtensionLevels(a: number, b: number, c: number): { level: number; price: number }[] {
  return FIB_EXTENSION.map((level) => ({ level, price: c + (b - a) * level }));
}

export interface PositionStats {
  side: "long" | "short";
  entry: number;
  stop: number;
  target: number;
  risk: number;
  reward: number;
  rr: number | null;
  stopPct: number;
  targetPct: number;
}

export function positionStats(side: "long" | "short", entry: number, target: number, stop: number): PositionStats {
  const risk = side === "long" ? entry - stop : stop - entry;
  const reward = side === "long" ? target - entry : entry - target;
  return {
    side,
    entry,
    stop,
    target,
    risk,
    reward,
    rr: risk > 0 ? reward / risk : null,
    stopPct: entry ? ((stop - entry) / entry) * 100 : 0,
    targetPct: entry ? ((target - entry) / entry) * 100 : 0,
  };
}

export function measureStats(p1: number, p2: number, bars: number): { change: number; pct: number | null; bars: number } {
  return { change: p2 - p1, pct: p1 ? ((p2 - p1) / p1) * 100 : null, bars };
}

// ── Geometry (pixel space) ───────────────────────────────────────────
export interface Pt {
  x: number;
  y: number;
}

export function distToSegment(p: Pt, a: Pt, b: Pt, mode: "segment" | "ray" | "line" = "segment"): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  if (mode === "segment") t = Math.max(0, Math.min(1, t));
  else if (mode === "ray") t = Math.max(0, t);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Extend a→b to the given x bounds (for rays / extended lines). */
export function extendLine(a: Pt, b: Pt, minX: number, maxX: number, mode: "ray" | "line"): [Pt, Pt] {
  if (a.x === b.x) return [a, b];
  const slope = (b.y - a.y) / (b.x - a.x);
  const at = (x: number): Pt => ({ x, y: a.y + slope * (x - a.x) });
  const dir = b.x > a.x ? 1 : -1;
  const end = at(dir > 0 ? maxX : minX);
  return mode === "ray" ? [a, end] : [at(minX), at(maxX)];
}

// ── Snapping ─────────────────────────────────────────────────────────
export interface BarLike {
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Magnet: nearest of O/H/L/C. */
export function magnetPrice(price: number, bar: BarLike | undefined): number {
  if (!bar) return price;
  let best = bar.close;
  for (const v of [bar.open, bar.high, bar.low, bar.close]) if (Math.abs(v - price) < Math.abs(best - price)) best = v;
  return best;
}

export function snapPrice(price: number, opts: { market: "KR" | "US"; instrument?: KrxInstrument; magnet?: boolean; bar?: BarLike }): number {
  const p = opts.magnet ? magnetPrice(price, opts.bar) : price;
  if (opts.market === "KR") return snapToKrxTick(p, opts.instrument ?? "stock");
  return Math.round(p * 100) / 100;
}

// ── History (undo / redo) ────────────────────────────────────────────
export interface DrawingHistory {
  items: Drawing[];
  past: Drawing[][];
  future: Drawing[][];
}

export const HISTORY_CAP = 100;

export type DrawingAction =
  | { type: "add"; drawing: Drawing }
  | { type: "update"; id: string; patch: Partial<Drawing> }
  | { type: "remove"; id: string }
  | { type: "clear" }
  | { type: "reset"; items: Drawing[] }
  | { type: "undo" }
  | { type: "redo" };

export function initHistory(items: Drawing[] = []): DrawingHistory {
  return { items, past: [], future: [] };
}

function commit(h: DrawingHistory, items: Drawing[]): DrawingHistory {
  return { items, past: [...h.past, h.items].slice(-HISTORY_CAP), future: [] };
}

/** Locked drawings cannot be moved/edited (only unlocked, hidden/shown or removed via the manager). */
export function drawingReducer(h: DrawingHistory, a: DrawingAction): DrawingHistory {
  switch (a.type) {
    case "add":
      return commit(h, [...h.items, a.drawing]);
    case "update": {
      const cur = h.items.find((d) => d.id === a.id);
      if (!cur) return h;
      const editsGeometry = a.patch.anchors !== undefined || a.patch.color !== undefined || a.patch.width !== undefined || a.patch.text !== undefined;
      if (cur.locked && editsGeometry) return h;
      return commit(h, h.items.map((d) => (d.id === a.id ? { ...d, ...a.patch } : d)));
    }
    case "remove":
      return h.items.some((d) => d.id === a.id) ? commit(h, h.items.filter((d) => d.id !== a.id)) : h;
    case "clear":
      return h.items.length ? commit(h, []) : h;
    case "reset":
      return initHistory(a.items);
    case "undo": {
      if (!h.past.length) return h;
      const prev = h.past[h.past.length - 1]!;
      return { items: prev, past: h.past.slice(0, -1), future: [h.items, ...h.future].slice(0, HISTORY_CAP) };
    }
    case "redo": {
      if (!h.future.length) return h;
      const [next, ...rest] = h.future;
      return { items: next!, past: [...h.past, h.items].slice(-HISTORY_CAP), future: rest };
    }
  }
}

/** Move every anchor by a price delta and a bar-index delta (times re-keyed by the caller). */
export function translateAnchors(anchors: Anchor[], dp: number, retime: (t: BarTime) => BarTime): Anchor[] {
  return anchors.map((a) => ({ t: retime(a.t), p: a.p + dp }));
}
