import type { IChartApi, ISeriesApi, MouseEventParams, SeriesType, Time } from "lightweight-charts";

/**
 * Crosshair + visible-time-range sync across charts in one workspace (F7.4).
 * Time-range sync uses times (not logical indexes) so panes with different
 * symbols stay aligned; a guard prevents feedback loops.
 */
export interface ChartSync {
  /** `onTime` lets a pane update its own HUD when another pane moves the crosshair. */
  register(id: string, chart: IChartApi, series: ISeriesApi<SeriesType>, onTime?: (t: Time | null) => void): () => void;
  setTimeSync(on: boolean): void;
}

export function createChartSync(): ChartSync {
  const members = new Map<string, { chart: IChartApi; series: ISeriesApi<SeriesType>; onTime?: (t: Time | null) => void }>();
  let syncing = false;
  let timeSync = true;
  return {
    setTimeSync(on) {
      timeSync = on;
    },
    register(id, chart, series, onTime) {
      members.set(id, { chart, series, onTime });
      const onMove = (p: MouseEventParams<Time>) => {
        if (syncing) return;
        syncing = true;
        for (const [otherId, m] of members) {
          if (otherId === id) continue;
          if (p.time == null || !p.point) {
            m.chart.clearCrosshairPosition();
            m.onTime?.(null);
          } else {
            const price = m.series.coordinateToPrice(p.point.y);
            try {
              m.chart.setCrosshairPosition(price ?? 0, p.time, m.series);
            } catch {
              /* time not in this pane's data */
            }
            m.onTime?.(p.time);
          }
        }
        syncing = false;
      };
      const onRange = () => {
        if (syncing || !timeSync) return;
        const r = chart.timeScale().getVisibleRange();
        if (!r) return;
        syncing = true;
        for (const [otherId, m] of members) {
          if (otherId === id) continue;
          try {
            m.chart.timeScale().setVisibleRange(r);
          } catch {
            /* other pane has no data for that range yet */
          }
        }
        syncing = false;
      };
      chart.subscribeCrosshairMove(onMove);
      chart.timeScale().subscribeVisibleTimeRangeChange(onRange);
      return () => {
        chart.unsubscribeCrosshairMove(onMove);
        chart.timeScale().unsubscribeVisibleTimeRangeChange(onRange);
        members.delete(id);
      };
    },
  };
}
