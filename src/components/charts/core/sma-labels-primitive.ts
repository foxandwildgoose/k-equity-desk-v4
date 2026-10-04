import type { ISeriesApi, ISeriesPrimitive, IPrimitivePaneView, IPrimitivePaneRenderer, SeriesAttachedParameter, SeriesType, Time } from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import { layoutSmaLabels, type StandardSmaPeriod } from "@/lib/charts/standard-sma";

export interface SmaEndpoint { period: StandardSmaPeriod; time: string | number; value: number; color: string; text: string; coordinateSeries?: ISeriesApi<SeriesType> }

/** Native pane-local canvas overlay, so PNG capture includes labels. No price lines,
 * autoscale contribution, DOM mouse handlers or crosshair-triggered React renders. */
export class SmaLabelsPrimitive implements ISeriesPrimitive<Time> {
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private rows: readonly SmaEndpoint[] = [];
  private background = "";
  private reservedTop = 16;
  private readonly renderer: IPrimitivePaneRenderer = { draw: target => this.paint(target) };
  private readonly view: IPrimitivePaneView = { zOrder: () => "top", renderer: () => this.renderer };

  attached(parameter: SeriesAttachedParameter<Time>) { this.series = parameter.series; this.requestUpdate = parameter.requestUpdate; }
  detached() { this.series = null; this.requestUpdate = null; }
  paneViews() { return [this.view]; }
  updateAllViews() { /* Coordinates are read at native paint time, including price zoom. */ }
  set(rows: readonly SmaEndpoint[], background: string, reservedTop = 16) {
    this.rows = rows; this.background = background; this.reservedTop = reservedTop; this.requestUpdate?.();
  }
  private paint(target: CanvasRenderingTarget2D) {
    if (!this.series || !this.rows.length) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize: size }) => {
      const projected = this.rows.flatMap(row => {
        const y = (row.coordinateSeries ?? this.series!).priceToCoordinate(row.value);
        return y == null ? [] : [{ period: row.period, y, targetY: y }];
      });
      const labels = layoutSmaLabels(projected, size.height, this.reservedTop, 18);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, size.width, size.height); ctx.clip();
      ctx.font = "11px sans-serif"; ctx.textBaseline = "middle";
      for (const label of labels) {
        const row = this.rows.find(r => r.period === label.period)!;
        const text = size.width < 420 ? row.text.replace(/^SMA/, "") : row.text;
        const width = Math.min(size.width - 8, ctx.measureText(text).width + 8);
        const x = size.width - width - 4;
        ctx.fillStyle = this.background;
        ctx.globalAlpha = 0.9; ctx.fillRect(x, label.y - 9, width, 18); ctx.globalAlpha = 1;
        ctx.strokeStyle = row.color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 8, Math.max(1, Math.min(size.height - 1, label.targetY))); ctx.lineTo(x - 3, label.y); ctx.lineTo(x, label.y); ctx.stroke();
        ctx.fillStyle = row.color; ctx.fillText(text, x + 4, label.y, width - 8);
      }
      ctx.restore();
    });
  }
}
