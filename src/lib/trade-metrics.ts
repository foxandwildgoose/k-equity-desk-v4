import type { OhlcBar, LiveQuote } from "../server/naver-market.ts";
import { expectedKrSessionDate, providerQuoteTime, quoteFreshness } from "./market-freshness.ts";
import { isFreshKisQuote } from "./market-quote-state.ts";

/** A transport connection alone says nothing about this security's price. */
export function stockQuotePresentation(
  quote: LiveQuote | null | undefined,
  connected = false,
  now = Date.now(),
) {
  const freshness = quote ? quoteFreshness(quote, now) : null;
  return {
    freshness,
    canDisplay:
      quote != null &&
      freshness?.status !== "unavailable" &&
      freshness?.reason !== "future-provider-time",
    isLive: connected && isFreshKisQuote(quote, now) && freshness?.status === "fresh",
  };
}

/** Numeric carrier zeroes must never become observed prices or derived returns. */
export function positiveObservation(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function isAvailableStockQuote(stock: {
  quoteAvailable?: boolean;
  price: number;
  change: number;
  changePct: number;
}): boolean {
  return (
    stock.quoteAvailable !== false &&
    positiveObservation(stock.price) !== null &&
    Number.isFinite(stock.change) &&
    Number.isFinite(stock.changePct)
  );
}

/** A flat or incomplete range has no defensible position percentage. */
export function observedRangePosition(price: unknown, high: unknown, low: unknown): number | null {
  const p = positiveObservation(price);
  const h = positiveObservation(high);
  const l = positiveObservation(low);
  return p !== null && h !== null && l !== null && h > l && p >= l && p <= h
    ? ((p - l) / (h - l)) * 100
    : null;
}

function quoteSessionDate(quote: Pick<LiveQuote, "tradedAt">): string | null {
  const time = providerQuoteTime(quote.tradedAt);
  return time == null ? null : new Date(time + 9 * 60 * 60_000).toISOString().slice(0, 10);
}

function orderedDailyBars(bars: readonly OhlcBar[], sessionDate: string | null): OhlcBar[] | null {
  if (!sessionDate) return null;
  const dates = new Set<string>();
  const result: OhlcBar[] = [];
  for (const bar of bars) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bar.date)) return null;
    const dateMs = Date.parse(`${bar.date}T00:00:00Z`);
    if (!Number.isFinite(dateMs) || new Date(dateMs).toISOString().slice(0, 10) !== bar.date)
      return null;
    if (bar.date > sessionDate) continue;
    if (dates.has(bar.date)) return null;
    dates.add(bar.date);
    result.push(bar);
  }
  return result.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

/** Derived values are absent until every required provider observation exists. */
export function tradeMetrics(quote: LiveQuote, dayBars: readonly OhlcBar[] = []) {
  const price = positiveObservation(quote.price);
  const open = positiveObservation(quote.open);
  const high = positiveObservation(quote.high);
  const low = positiveObservation(quote.low);
  const previous = quote.previousCloseValid === false ? null : positiveObservation(quote.prevClose);
  const inferredPrevious =
    quote.previousCloseValid !== false &&
    quote.changeValid !== false &&
    price !== null &&
    Number.isFinite(quote.change)
      ? positiveObservation(price - quote.change)
      : null;
  const prev = previous ?? inferredPrevious;
  const gapPct = prev !== null && open !== null ? ((open - prev) / prev) * 100 : null;
  const dayRange = observedRangePosition(price, high, low);
  const dayRangePct =
    high !== null && low !== null && high >= low ? ((high - low) / low) * 100 : null;
  const high52 = positiveObservation(quote.high52);
  const low52 = positiveObservation(quote.low52);
  const fromHigh52 = price !== null && high52 !== null ? ((price - high52) / high52) * 100 : null;
  const fromLow52 = price !== null && low52 !== null ? ((price - low52) / low52) * 100 : null;
  const volume =
    quote.volumeValid !== false && Number.isFinite(quote.volume) && quote.volume >= 0
      ? quote.volume
      : null;
  const sessionDate = quoteSessionDate(quote);
  const bars = orderedDailyBars(dayBars, sessionDate);
  const previousBars = bars?.filter((bar) => bar.date < sessionDate!) ?? [];
  const volumeBars = previousBars.slice(-20);
  // Without an exchange holiday calendar, a gap cannot establish that this is
  // the most recent 20-session window. Leave RVOL unavailable rather than use
  // an old chart response as today's denominator.
  const expectedPreviousDate = sessionDate
    ? expectedKrSessionDate(Date.parse(`${sessionDate}T00:00:00+09:00`))
    : null;
  // An after-hours/listing volume is not the regular-session volume measured
  // by historical daily bars. Use a known regular quote or its dated daily bar.
  const observationTime = providerQuoteTime(quote.tradedAt);
  const localMinute = observationTime == null ? -1
    : new Date(observationTime + 9 * 60 * 60_000).getUTCHours() * 60
      + new Date(observationTime + 9 * 60 * 60_000).getUTCMinutes();
  const regularQuote = (quote.marketSessionType === "regularMarket" || quote.source === "kis-krx-websocket")
    && localMinute >= 9 * 60 && localMinute <= 15 * 60 + 30;
  const currentDaily = bars?.find((bar) => bar.date === sessionDate);
  const dailyVolume = currentDaily?.volumeValid !== false && currentDaily != null
    && Number.isFinite(currentDaily.volume) && currentDaily.volume >= 0 ? currentDaily.volume : null;
  const regularVolume = regularQuote ? volume : dailyVolume;
  let rvol: number | null = null;
  if (
    regularVolume !== null &&
    volumeBars.length === 20 &&
    volumeBars.at(-1)?.date === expectedPreviousDate &&
    volumeBars.every(
      (bar) => bar.volumeValid !== false && Number.isFinite(bar.volume) && bar.volume >= 0,
    )
  ) {
    const average = volumeBars.reduce((sum, bar) => sum + bar.volume, 0) / 20;
    if (average > 0) rvol = regularVolume / average;
  }

  // Fourteen true ranges require fifteen observed OHLC rows (the first supplies
  // the preceding close). Do not skip holes and silently bridge invalid days.
  const atrBars = bars?.slice(-15) ?? [];
  const validAtr =
    atrBars.length === 15 &&
    atrBars.every(
      (bar) =>
        positiveObservation(bar.high) !== null &&
        positiveObservation(bar.low) !== null &&
        positiveObservation(bar.close) !== null &&
        bar.high >= bar.low &&
        bar.close >= bar.low &&
        bar.close <= bar.high,
    );
  let atr14: number | null = null;
  if (validAtr) {
    let total = 0;
    for (let i = 1; i < atrBars.length; i++) {
      const bar = atrBars[i]!;
      const previousClose = atrBars[i - 1]!.close;
      total += Math.max(
        bar.high - bar.low,
        Math.abs(bar.high - previousClose),
        Math.abs(bar.low - previousClose),
      );
    }
    atr14 = total / 14;
  }
  const atrPct = atr14 !== null && price !== null ? (atr14 / price) * 100 : null;
  const last = bars?.at(-1);
  const maBias =
    last && positiveObservation(last.close) !== null
      ? {
          aboveMa20: positiveObservation(last.ma20) !== null ? last.close >= last.ma20! : null,
          ma20Above60:
            positiveObservation(last.ma20) !== null && positiveObservation(last.ma60) !== null
              ? last.ma20! >= last.ma60!
              : null,
        }
      : null;
  return {
    price,
    open,
    high,
    low,
    prev,
    gapPct,
    dayRange,
    dayRangePct,
    fromHigh52,
    fromLow52,
    volume,
    rvol,
    atr14,
    atrPct,
    maBias,
    chartAsOf: last?.date ?? null,
  };
}
