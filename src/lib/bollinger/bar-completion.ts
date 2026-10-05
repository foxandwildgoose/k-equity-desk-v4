import { barTimeOf, dayOfTime } from "../charts/bar-time.ts";
import { periodEndDay } from "../charts/hts-layout.ts";
import type { BollingerBar } from "./types.ts";

/** Provider timestamps in this app identify the START of an intraday bar.
 * Without an exchange publication/finality flag, today's daily bar and the
 * current weekly/monthly period remain previews until the next local day/period.
 * This deliberately does not guess holidays, early closes or session finality. */
export function completedPriceBars<T extends BollingerBar>(bars: readonly T[], options: {
  market: "KR" | "US"; interval: string; minuteSize?: number; nowMs?: number;
}): (T & { completed: boolean })[] {
  const now = options.nowMs ?? Date.now();
  const today = dayOfTime(Math.floor(now / 1000), options.market);
  return bars.map(bar => {
    let completed = false;
    if (options.interval === "minute") {
      const start = barTimeOf(bar.date, options.market);
      completed = typeof start === "number" && start > 0 && Number.isFinite(start)
        && (start + (options.minuteSize ?? 5) * 60) * 1000 <= now;
    } else {
      completed = /^\d{4}-\d{2}-\d{2}$/.test(bar.date) && periodEndDay(bar.date, options.interval) < today;
    }
    // Explicit unfinished data can only reduce certainty; it cannot bypass time.
    return { ...bar, completed: completed && bar.completed !== false };
  });
}
