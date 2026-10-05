import type { IChartApi, ISeriesApi, ISeriesPrimitive, IPrimitivePaneView, IPrimitivePaneRenderer, SeriesAttachedParameter, SeriesType, Time } from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import { bollingerFillPolygons, type BollingerFillRow } from "@/lib/bollinger/rendering";

/** Native series background: shared price/time transforms, no pointer handlers,
 * autoscale contribution or second canvas. Included by native PNG capture. */
export class BollingerFillPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private rows: readonly BollingerFillRow[] = [];
  private color = "";
  private opacity = 0;
  private readonly renderer: IPrimitivePaneRenderer = { draw: () => undefined, drawBackground: target => this.paint(target) };
  private readonly view: IPrimitivePaneView = { zOrder: () => "bottom", renderer: () => this.renderer };

  attached(parameter: SeriesAttachedParameter<Time>) {
    this.chart = parameter.chart;
    this.series = parameter.series;
    this.requestUpdate = parameter.requestUpdate;
  }
  detached() { this.chart = null; this.series = null; this.requestUpdate = null; }
  paneViews() { return [this.view]; }
  updateAllViews() { /* Native repaint reads current time/price coordinates. */ }
  set(rows: readonly BollingerFillRow[], color: string, opacity: number) {
    this.rows = rows; this.color = color;
    this.opacity = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 0;
    this.requestUpdate?.();
  }
  private paint(target: CanvasRenderingTarget2D) {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series || !this.rows.length || !this.opacity) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    // Rows share the displayed price timestamps. One neighbor prevents a seam
    // at either viewport edge; clipping keeps price/time axes untouched.
    const from = range ? Math.max(0, Math.floor(range.from) - 1) : 0;
    const to = range ? Math.min(this.rows.length - 1, Math.ceil(range.to) + 1) : this.rows.length - 1;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize: size }) => {
      const polygons = bollingerFillPolygons(this.rows, row => {
        const x = chart.timeScale().timeToCoordinate(row.time as Time);
        const upperY = series.priceToCoordinate(row.upper!);
        const lowerY = series.priceToCoordinate(row.lower!);
        return x == null || upperY == null || lowerY == null ? null : { x, upperY, lowerY };
      }, from, to);
      if (!polygons.length) return;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, size.width, size.height); ctx.clip();
      ctx.fillStyle = this.color; ctx.globalAlpha = this.opacity;
      for (const polygon of polygons) {
        ctx.beginPath(); ctx.moveTo(polygon[0]!.x, polygon[0]!.upperY);
        for (let i = 1; i < polygon.length; i++) ctx.lineTo(polygon[i]!.x, polygon[i]!.upperY);
        for (let i = polygon.length - 1; i >= 0; i--) ctx.lineTo(polygon[i]!.x, polygon[i]!.lowerY);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });
  }
}
