/**
 * Canvas primitives for the pro chart (F7.6 volume profile, F7.7 drawings,
 * F7.13 session shading). Media-coordinate drawing; geometry is pure
 * (`src/lib/charts/drawings.ts`).
 */
import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import {
  distToSegment,
  extendLine,
  fibExtensionLevels,
  fibRetracementLevels,
  positionStats,
  type Anchor,
  type Drawing,
  type Pt,
} from "@/lib/charts/drawings";
import type { VolumeProfile } from "@/lib/chart-indicators";

export type VolumeProfileStyle = {
  /** Fraction of the pane width. Reference preset is about 0.10. */
  widthRatio: number;
  /** Base fill alpha. Value area is a bit stronger; POC a bit more. */
  opacity: number;
  showVa: boolean;
  showPoc: boolean;
  /** Price under the crosshair — that bin is drawn slightly stronger. */
  hoverPrice: number | null;
};

const VP_STYLE: VolumeProfileStyle = {
  widthRatio: 0.1,
  opacity: 0.22,
  showVa: true,
  showPoc: true,
  hoverPrice: null,
};

/** Left-edge volume profile and high/low markers are declared after BasePrimitive. */

type Ctx = CanvasRenderingContext2D;

abstract class BasePrimitive implements ISeriesPrimitive<Time> {
  protected chart: IChartApi | null = null;
  protected series: ISeriesApi<SeriesType> | null = null;
  protected requestUpdate: (() => void) | null = null;
  private readonly view: IPrimitivePaneView;

  constructor(z: PrimitivePaneViewZOrder, background = false) {
    const renderer: IPrimitivePaneRenderer = background
      ? { draw: () => undefined, drawBackground: (t) => this.render(t) }
      : { draw: (t) => this.render(t) };
    this.view = { zOrder: () => z, renderer: () => renderer };
  }

  attached(p: SeriesAttachedParameter<Time>) {
    this.chart = p.chart as IChartApi;
    this.series = p.series as ISeriesApi<SeriesType>;
    this.requestUpdate = p.requestUpdate;
  }

  detached() {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  paneViews() {
    return [this.view];
  }

  update() {
    this.requestUpdate?.();
  }

  protected x(t: Anchor["t"]): number | null {
    const c = this.chart?.timeScale().timeToCoordinate(t as Time);
    return c == null ? null : (c as number);
  }

  protected y(p: number): number | null {
    const c = this.series?.priceToCoordinate(p);
    return c == null ? null : (c as number);
  }

  protected pt(a: Anchor): Pt | null {
    const x = this.x(a.t);
    const y = this.y(a.p);
    return x == null || y == null ? null : { x, y };
  }

  private render(target: CanvasRenderingTarget2D) {
    target.useMediaCoordinateSpace(({ context, mediaSize }) => this.paint(context, mediaSize.width, mediaSize.height));
  }

  protected abstract paint(ctx: Ctx, w: number, h: number): void;
}

function label(ctx: Ctx, text: string, x: number, y: number, color: string, align: CanvasTextAlign = "left") {
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + 8;
  const bx = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  ctx.fillStyle = "rgba(15,23,42,0.78)";
  ctx.fillRect(bx, y - 8, w, 16);
  ctx.fillStyle = color;
  ctx.fillText(text, align === "right" ? x - 4 : align === "center" ? x : x + 4, y);
}

function line(ctx: Ctx, a: Pt, b: Pt) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function alpha(color: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export interface DrawingHit {
  id: string;
  /** Anchor index when a handle was hit; null = body. */
  handle: number | null;
}

/** All drawings + selection handles + in-progress preview. */
export class DrawingPrimitive extends BasePrimitive {
  drawings: Drawing[] = [];
  selectedId: string | null = null;
  preview: Drawing | null = null;
  formatPrice: (p: number) => string = (p) => String(p);
  barsBetween: (a: Anchor["t"], b: Anchor["t"]) => number | null = () => null;

  constructor() {
    super("top");
  }

  set(drawings: Drawing[], selectedId: string | null, preview: Drawing | null) {
    this.drawings = drawings;
    this.selectedId = selectedId;
    this.preview = preview;
    this.update();
  }

  /** Pixel hit test (handles first, then bodies). */
  hit(x: number, y: number, tol = 6): DrawingHit | null {
    const w = this.chartWidth();
    const p = { x, y };
    for (const d of [...this.drawings].reverse()) {
      if (d.hidden) continue;
      if (d.id === this.selectedId) {
        const idx = d.anchors.findIndex((a) => {
          const q = this.anchorPoint(d, a);
          return q != null && Math.abs(q.x - x) <= tol + 2 && Math.abs(q.y - y) <= tol + 2;
        });
        if (idx >= 0) return { id: d.id, handle: idx };
      }
      if (this.distance(d, p, w) <= tol) return { id: d.id, handle: null };
    }
    return null;
  }

  private chartWidth(): number {
    return (this.chart?.timeScale().width() as number | undefined) ?? 2000;
  }

  private anchorPoint(d: Drawing, a: Anchor): Pt | null {
    if (d.type === "hline") {
      const y = this.y(a.p);
      return y == null ? null : { x: this.chartWidth() - 30, y };
    }
    return this.pt(a);
  }

  private distance(d: Drawing, p: Pt, w: number): number {
    const pts = d.anchors.map((a) => this.pt(a));
    const [a, b, c] = pts;
    switch (d.type) {
      case "hline": {
        const y = this.y(d.anchors[0]!.p);
        return y == null ? Infinity : Math.abs(p.y - y);
      }
      case "hray": {
        if (!a) return Infinity;
        return p.x >= a.x - 4 ? Math.abs(p.y - a.y) : Infinity;
      }
      case "vline":
        return a ? Math.abs(p.x - a.x) : Infinity;
      case "text":
        return a ? Math.hypot(p.x - a.x - 20, p.y - a.y) - 18 : Infinity;
      case "trend":
      case "arrow":
      case "measure":
        return a && b ? distToSegment(p, a, b) : Infinity;
      case "ray":
        return a && b ? distToSegment(p, a, b, "ray") : Infinity;
      case "extended":
        return a && b ? distToSegment(p, a, b, "line") : Infinity;
      case "channel": {
        if (!a || !b) return Infinity;
        const d1 = distToSegment(p, a, b);
        if (!c) return d1;
        const off = this.channelOffset(a, b, c);
        return Math.min(d1, distToSegment(p, { x: a.x, y: a.y + off }, { x: b.x, y: b.y + off }));
      }
      case "rect":
      case "fib":
      case "fibext":
      case "long":
      case "short": {
        if (!a || !b) return Infinity;
        const xs = [a.x, b.x, c?.x ?? a.x];
        const ys = [a.y, b.y, c?.y ?? a.y];
        const x0 = Math.min(...xs);
        const x1 = d.type === "fib" || d.type === "fibext" ? w : Math.max(...xs);
        const y0 = Math.min(...ys);
        const y1 = Math.max(...ys);
        const inside = p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
        return inside ? 0 : Infinity;
      }
    }
  }

  private channelOffset(a: Pt, b: Pt, c: Pt): number {
    if (b.x === a.x) return c.y - a.y;
    return c.y - (a.y + ((b.y - a.y) * (c.x - a.x)) / (b.x - a.x));
  }

  protected paint(ctx: Ctx, w: number) {
    const all = this.preview ? [...this.drawings, this.preview] : this.drawings;
    for (const d of all) {
      if (d.hidden) continue;
      ctx.save();
      ctx.strokeStyle = d.color;
      ctx.fillStyle = d.color;
      ctx.lineWidth = d.width;
      ctx.setLineDash(d === this.preview ? [5, 4] : []);
      this.paintOne(ctx, d, w);
      ctx.restore();
      if (d.id === this.selectedId) this.paintHandles(ctx, d);
    }
  }

  private paintHandles(ctx: Ctx, d: Drawing) {
    ctx.save();
    for (const a of d.anchors) {
      const q = this.anchorPoint(d, a);
      if (!q) continue;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 1.5;
      ctx.fillRect(q.x - 4, q.y - 4, 8, 8);
      ctx.strokeRect(q.x - 4, q.y - 4, 8, 8);
    }
    if (d.locked) {
      const q = d.anchors[0] ? this.anchorPoint(d, d.anchors[0]) : null;
      if (q) label(ctx, "잠금", q.x + 8, q.y - 14, "#fbbf24");
    }
    ctx.restore();
  }

  private paintOne(ctx: Ctx, d: Drawing, w: number) {
    const pts = d.anchors.map((a) => this.pt(a));
    const [a, b, c] = pts;
    switch (d.type) {
      case "hline": {
        const y = this.y(d.anchors[0]!.p);
        if (y == null) return;
        line(ctx, { x: 0, y }, { x: w, y });
        label(ctx, `${d.text ? `${d.text} ` : ""}${this.formatPrice(d.anchors[0]!.p)}${d.alertId ? " 🔔" : ""}`, w - 4, y - 10, d.color, "right");
        return;
      }
      case "hray":
        if (!a) return;
        line(ctx, a, { x: w, y: a.y });
        label(ctx, this.formatPrice(d.anchors[0]!.p), w - 4, a.y - 10, d.color, "right");
        return;
      case "vline": {
        const x = this.x(d.anchors[0]!.t);
        if (x == null) return;
        line(ctx, { x, y: 0 }, { x, y: 4000 });
        return;
      }
      case "text":
        if (!a) return;
        label(ctx, d.text ?? "메모", a.x, a.y, d.color);
        return;
      case "trend":
        if (a && b) line(ctx, a, b);
        return;
      case "arrow": {
        if (!a || !b) return;
        line(ctx, a, b);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - 10 * Math.cos(ang - 0.4), b.y - 10 * Math.sin(ang - 0.4));
        ctx.lineTo(b.x - 10 * Math.cos(ang + 0.4), b.y - 10 * Math.sin(ang + 0.4));
        ctx.closePath();
        ctx.fill();
        return;
      }
      case "ray":
      case "extended": {
        if (!a || !b) return;
        const [p, q] = extendLine(a, b, 0, w, d.type === "ray" ? "ray" : "line");
        line(ctx, p, q);
        return;
      }
      case "channel": {
        if (!a || !b) return;
        line(ctx, a, b);
        if (!c) return;
        const off = this.channelOffset(a, b, c);
        line(ctx, { x: a.x, y: a.y + off }, { x: b.x, y: b.y + off });
        ctx.fillStyle = alpha(d.color, 0.08);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(b.x, b.y + off);
        ctx.lineTo(a.x, a.y + off);
        ctx.closePath();
        ctx.fill();
        return;
      }
      case "rect": {
        if (!a || !b) return;
        ctx.fillStyle = alpha(d.color, 0.12);
        ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        return;
      }
      case "fib":
      case "fibext": {
        if (!a || !b) return;
        const levels =
          d.type === "fib"
            ? fibRetracementLevels(d.anchors[0]!.p, d.anchors[1]!.p)
            : d.anchors[2]
              ? fibExtensionLevels(d.anchors[0]!.p, d.anchors[1]!.p, d.anchors[2]!.p)
              : [];
        if (d.type === "fibext") line(ctx, a, b);
        if (d.type === "fibext" && c) line(ctx, b, c);
        const x0 = Math.min(a.x, b.x, c?.x ?? a.x);
        ctx.lineWidth = 1;
        for (const l of levels) {
          const y = this.y(l.price);
          if (y == null) continue;
          line(ctx, { x: x0, y }, { x: w, y });
          label(ctx, `${l.level} (${this.formatPrice(l.price)})`, x0 + 2, y - 8, d.color);
        }
        return;
      }
      case "measure": {
        if (!a || !b) return;
        ctx.fillStyle = alpha(d.color, 0.1);
        ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        line(ctx, a, b);
        const p1 = d.anchors[0]!.p;
        const p2 = d.anchors[1]!.p;
        const bars = this.barsBetween(d.anchors[0]!.t, d.anchors[1]!.t);
        const pct = p1 ? ((p2 - p1) / p1) * 100 : 0;
        label(ctx, `${p2 - p1 >= 0 ? "+" : ""}${this.formatPrice(p2 - p1)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)${bars != null ? ` · ${bars}봉` : ""}`, (a.x + b.x) / 2, Math.min(a.y, b.y) - 12, "#e2e8f0", "center");
        return;
      }
      case "long":
      case "short": {
        if (!a || !b) return;
        const entry = d.anchors[0]!.p;
        const target = d.anchors[1]!.p;
        const stop = d.anchors[2]?.p ?? entry;
        const x0 = Math.min(a.x, b.x);
        const x1 = Math.max(a.x, b.x, x0 + 40);
        const ye = this.y(entry);
        const yt = this.y(target);
        const ys = this.y(stop);
        if (ye == null || yt == null || ys == null) return;
        ctx.fillStyle = "rgba(34,197,94,0.16)";
        ctx.fillRect(x0, Math.min(ye, yt), x1 - x0, Math.abs(yt - ye));
        ctx.fillStyle = "rgba(239,68,68,0.16)";
        ctx.fillRect(x0, Math.min(ye, ys), x1 - x0, Math.abs(ys - ye));
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        line(ctx, { x: x0, y: ye }, { x: x1, y: ye });
        const st = positionStats(d.type, entry, target, stop);
        label(ctx, `목표 ${this.formatPrice(target)} (${st.targetPct >= 0 ? "+" : ""}${st.targetPct.toFixed(2)}%)`, x0 + 2, yt, "#86efac");
        label(ctx, `손절 ${this.formatPrice(stop)} (${st.stopPct >= 0 ? "+" : ""}${st.stopPct.toFixed(2)}%)`, x0 + 2, ys, "#fca5a5");
        label(ctx, `${d.type === "long" ? "롱" : "숏"} ${this.formatPrice(entry)} · R:R ${st.rr != null ? st.rr.toFixed(2) : "—"}`, x0 + 2, ye, "#e2e8f0");
        return;
      }
    }
  }
}

/** Extended-hours shading + session break lines (background; F7.13). */
export class SessionPrimitive extends BasePrimitive {
  runs: { from: number; to: number }[] = [];
  breaks: number[] = [];
  constructor() {
    super("bottom", true);
  }
  set(runs: { from: number; to: number }[], breaks: number[]) {
    this.runs = runs;
    this.breaks = breaks;
    this.update();
  }
  protected paint(ctx: Ctx, _w: number, h: number) {
    const spacing = (this.chart?.timeScale().options().barSpacing ?? 6) / 2;
    ctx.fillStyle = "rgba(148,163,184,0.10)";
    for (const r of this.runs) {
      const x0 = this.x(r.from);
      const x1 = this.x(r.to);
      if (x0 == null || x1 == null) continue;
      ctx.fillRect(x0 - spacing, 0, x1 - x0 + spacing * 2, h);
    }
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    for (const t of this.breaks) {
      const x = this.x(t);
      if (x == null) continue;
      line(ctx, { x: x - spacing, y: 0 }, { x: x - spacing, y: h });
    }
  }
}

/** Left-edge volume profile. Behind candles; fades before it covers the price path. */
export class VolumeProfilePrimitive extends BasePrimitive {
  profile: VolumeProfile | null = null;
  style: VolumeProfileStyle = { ...VP_STYLE };
  constructor() {
    super("bottom", true);
  }
  set(profile: VolumeProfile | null) {
    this.profile = profile;
    this.update();
  }
  setStyle(style: Partial<VolumeProfileStyle>) {
    this.style = { ...this.style, ...style };
    this.update();
  }
  protected paint(ctx: Ctx, w: number) {
    const vp = this.profile;
    if (!vp || !vp.rows.length) return;
    const max = Math.max(...vp.rows.map((r) => r.volume));
    if (!(max > 0)) return;
    const widthRatio = Math.min(0.18, Math.max(0.06, this.style.widthRatio));
    const width = Math.max(8, w * widthRatio);
    const base = Math.min(0.4, Math.max(0.08, this.style.opacity));
    for (const r of vp.rows) {
      const y0 = this.y(r.high);
      const y1 = this.y(r.low);
      if (y0 == null || y1 == null) continue;
      const top = Math.min(y0, y1);
      const bh = Math.abs(y1 - y0);
      const gap = bh > 3 ? 1 : 0;
      const inVa =
        this.style.showVa &&
        vp.val != null &&
        vp.vah != null &&
        r.low >= vp.val - 1e-9 &&
        r.high <= vp.vah + 1e-9;
      const isPoc = vp.poc != null && r.low <= vp.poc && vp.poc <= r.high;
      const hovered =
        this.style.hoverPrice != null &&
        r.low <= this.style.hoverPrice &&
        this.style.hoverPrice <= r.high;
      let alpha = inVa ? base + 0.08 : base * 0.72;
      if (isPoc) alpha = Math.min(0.5, base + 0.16);
      if (hovered) alpha = Math.min(0.55, alpha + 0.16);
      const bw = Math.max(1, (r.volume / max) * width);
      const grad = ctx.createLinearGradient(0, 0, bw, 0);
      grad.addColorStop(0, `rgba(148,163,184,${alpha.toFixed(3)})`);
      grad.addColorStop(0.72, `rgba(148,163,184,${(alpha * 0.45).toFixed(3)})`);
      grad.addColorStop(1, "rgba(148,163,184,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, top + gap / 2, bw, Math.max(1, bh - gap));
    }
    if (this.style.showPoc && vp.poc != null) {
      const y = this.y(vp.poc);
      if (y != null) {
        ctx.save();
        ctx.strokeStyle = "rgba(148,163,184,0.22)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        line(ctx, { x: 0, y }, { x: w, y });
        ctx.restore();
      }
    }
  }
}

export type RangeMark = {
  time: string | number;
  price: number;
  role: "high" | "low";
  /** Recent-only labels sit by the last price; period labels sit on the extreme. */
  place: "extreme" | "last";
  title: string;
  pctText: string;
  color: string;
};

/** High/low triangles and dashed links. Foreground, above candles and the profile. */
export class RangeMarkerPrimitive extends BasePrimitive {
  marks: RangeMark[] = [];
  lastTime: string | number | null = null;
  lastPrice: number | null = null;
  constructor() {
    super("top");
  }
  set(marks: RangeMark[], lastTime: string | number | null, lastPrice: number | null) {
    this.marks = marks;
    this.lastTime = lastTime;
    this.lastPrice = lastPrice;
    this.update();
  }
  protected paint(ctx: Ctx, w: number, h: number) {
    const lx = this.lastTime != null ? this.x(this.lastTime) : null;
    const ly = this.lastPrice != null ? this.y(this.lastPrice) : null;
    const clear = w * 0.13;
    for (let i = 0; i < this.marks.length; i++) {
      const m = this.marks[i]!;
      const x = this.x(m.time);
      const y = this.y(m.price);
      if (x == null || y == null) continue;
      const up = m.role === "high";
      if (lx != null && ly != null) {
        ctx.save();
        ctx.strokeStyle = m.color;
        ctx.globalAlpha = 0.4;
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(lx, m.place === "last" ? y : ly);
        ctx.stroke();
        ctx.restore();
      }
      triangle(ctx, x, up ? y - 8 : y + 8, up, m.color);
      const anchorX = m.place === "last" && lx != null ? lx : x;
      const text = m.place === "last" ? `${m.title} · ${m.pctText}` : m.title;
      ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      const tw = ctx.measureText(text).width + 10;
      let tx = Math.max(clear, anchorX + 8);
      let align: CanvasTextAlign = "left";
      if (tx + tw > w - 4) {
        tx = Math.max(4, anchorX - 8);
        align = "right";
      }
      const stack = (i % 2) * 14;
      const ty = Math.min(h - 12, Math.max(12, (up ? y - 16 : y + 16) + (up ? -stack : stack)));
      label(ctx, text, tx, ty, m.color, align);
      if (m.place === "extreme" && lx != null && ly != null && m.pctText) {
        const py = Math.min(h - 12, Math.max(12, ly + (up ? -14 - stack : 14 + stack)));
        label(ctx, m.pctText, Math.min(w - 8, Math.max(clear, lx - 6)), py, m.color, "right");
      }
    }
  }
}

function triangle(ctx: Ctx, x: number, y: number, up: boolean, color: string) {
  ctx.beginPath();
  if (up) {
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 5, y + 4);
    ctx.lineTo(x - 5, y + 4);
  } else {
    ctx.moveTo(x, y + 5);
    ctx.lineTo(x + 5, y - 4);
    ctx.lineTo(x - 5, y - 4);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(15,23,42,0.8)";
  ctx.stroke();
}
