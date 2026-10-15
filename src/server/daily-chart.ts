import { dailyMarketClock, parseNaverDailySnapshot } from "../lib/charts/daily-reconciliation.ts";
import type { OhlcBar } from "./naver-market";

export type DailyChartSnapshot = {
  bars: OhlcBar[];
  source: string;
  /** Provider response receipt time; never substituted for its trading date. */
  fetchedAt: string | undefined;
};

type DailyChartFetcherOptions = {
  fetcher?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  successTtlMs?: number;
  maxEntries?: number;
};

const unavailable = (source = "naver-mobile-daily-unavailable"): DailyChartSnapshot => ({ bars: [], source, fetchedAt: undefined });

/** Share detail/indicator requests and briefly cache only real observations. */
export function createDailyChartFetcher(options: DailyChartFetcherOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const successTtlMs = options.successTtlMs ?? 20_000;
  const maxEntries = Math.max(1, options.maxEntries ?? 256);
  const cache = new Map<string, { at: number; snapshot: DailyChartSnapshot }>();
  const inFlight = new Map<string, Promise<DailyChartSnapshot>>();

  async function request(code: string): Promise<DailyChartSnapshot> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetcher(`https://m.stock.naver.com/api/stock/${code}/price?page=1&pageSize=5`, {
          headers: { Accept: "application/json", Referer: "https://m.stock.naver.com/", "User-Agent": "Mozilla/5.0" },
          signal: controller.signal,
        });
        if (!response.ok) {
          const transient = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
          if (!transient) return unavailable();
          continue;
        }
        const receivedAt = now();
        const clock = dailyMarketClock("KOSPI", new Date(receivedAt));
        const bars = parseNaverDailySnapshot(await response.json()).filter(bar =>
          bar.date <= clock.date && !(bar.date === clock.date && (clock.weekend || clock.minute < clock.openMinute)),
        );
        if (!bars.length) continue;
        return { bars, source: "naver-mobile-daily", fetchedAt: new Date(receivedAt).toISOString() };
      } catch {
        // Network, abort and malformed-body failures receive exactly one retry.
      } finally {
        clearTimeout(timeout);
      }
    }
    return unavailable();
  }

  return function fetchDailyChartSnapshot(code: string): Promise<DailyChartSnapshot> {
    if (!/^[0-9A-Z]{6}$/.test(code)) return Promise.resolve(unavailable("naver-mobile-daily-invalid"));
    const current = now();
    for (const [key, entry] of cache) {
      if (current < entry.at || current - entry.at >= successTtlMs) cache.delete(key);
    }
    const cached = cache.get(code);
    if (cached) {
      // LRU ordering never resets receipt time or extends the cache lifetime.
      cache.delete(code);
      cache.set(code, cached);
      return Promise.resolve(cached.snapshot);
    }
    const pending = inFlight.get(code);
    if (pending) return pending;
    if (inFlight.size >= maxEntries) return Promise.resolve(unavailable());
    const work = request(code).then(snapshot => {
      if (snapshot.bars.length) {
        if (cache.size >= maxEntries) cache.delete(cache.keys().next().value!);
        cache.set(code, { at: now(), snapshot });
      }
      return snapshot;
    }).finally(() => inFlight.delete(code));
    inFlight.set(code, work);
    return work;
  };
}

/** Small, dated regular-session daily feed used even when Yahoo history is nonempty. */
export const fetchDailyChartSnapshot = createDailyChartFetcher();
