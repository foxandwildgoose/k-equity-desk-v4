import { normalizeQuoteOhlc, parseQuoteNumber, parseQuoteTime } from "../quote-normalization.ts";
import type { LiveQuote, OhlcBar } from "../../server/naver-market";

export type DailyChartFreshness = {
  status: "current-session" | "awaiting-session" | "not-current" | "unavailable";
  marketDate: string;
  lastActualTradingDate: string | null;
  tradedAt?: string;
  note: string;
};

/** A venue date is not the UTC date or the viewer's calendar date. */
export function dailyMarketClock(market: "KOSPI" | "KOSDAQ" | "US", now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: market === "US" ? "America/New_York" : "Asia/Seoul",
    hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit",
  }).formatToParts(now);
  const value = (key: string) => parts.find(p => p.type === key)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minute: Number(value("hour")) * 60 + Number(value("minute")),
    weekend: value("weekday") === "Sat" || value("weekday") === "Sun",
    openMinute: market === "US" ? 570 : 540,
  };
}

function dailyDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

/** Independently dated mobile /price rows carry a complete actual daily bar. */
export function parseNaverDailySnapshot(value: unknown): OhlcBar[] {
  if (!Array.isArray(value)) return [];
  const byDate = new Map<string, OhlcBar>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const date = dailyDate(row.localTradedAt);
    const candle = normalizeQuoteOhlc({ open: row.openPrice, high: row.highPrice, low: row.lowPrice, close: row.closePrice });
    if (!date || !candle) continue;
    const volume = parseQuoteNumber(row.accumulatedTradingVolume);
    byDate.set(date, {
      date, label: `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`,
      ...candle, volume: volume != null && volume >= 0 ? volume : 0,
      volumeValid: volume != null && volume >= 0,
      bullish: candle.close >= candle.open,
    });
  }
  return [...byDate.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

function withMovingAverages(bars: OhlcBar[], round: boolean): OhlcBar[] {
  const periods = [5, 20, 60, 120] as const;
  return bars.map((bar, index) => {
    const next = { ...bar };
    for (const period of periods) {
      const average = index + 1 < period ? undefined
        : bars.slice(index + 1 - period, index + 1).reduce((sum, row) => sum + row.close, 0) / period;
      next[`ma${period}`] = average == null ? undefined : round ? Math.round(average) : average;
    }
    return next;
  });
}

/**
 * Reconcile only real daily observations. No quote is copied into a new calendar
 * day. KR /price snapshots and historical KR OHLC share raw KRW prices; US
 * adjusted histories are never mixed with unadjusted quote prices.
 */
export function reconcileDailyChart(input: {
  code: string;
  market: "KOSPI" | "KOSDAQ" | "US";
  bars: OhlcBar[];
  latestBars?: OhlcBar[];
  quote?: LiveQuote | null;
  now?: Date;
}): { bars: OhlcBar[]; freshness: DailyChartFreshness; reconciled: boolean } {
  const now = input.now ?? new Date();
  const clock = dailyMarketClock(input.market, now);
  const beforeOpen = clock.weekend || clock.minute < clock.openMinute;
  const valid = (bar: OhlcBar) => {
    const date = dailyDate(bar.date);
    return date != null && date <= clock.date
      && !(date === clock.date && beforeOpen)
      && normalizeQuoteOhlc(bar) != null;
  };
  const byDate = new Map(input.bars.filter(valid).map(bar => [bar.date, bar]));
  let reconciled = byDate.size !== input.bars.length;
  if (input.market !== "US") {
    for (const bar of input.latestBars ?? []) {
      if (!valid(bar)) continue;
      const existing = byDate.get(bar.date);
      // An older intraday snapshot must not reduce an observed cumulative range
      // or volume. Completed past-session daily rows are authoritative corrections.
      if (existing && bar.date === clock.date && (
        bar.high < existing.high || bar.low > existing.low
        || (existing.volumeValid !== false && bar.volumeValid === false)
        || (bar.volumeValid !== false && existing.volumeValid !== false && bar.volume < existing.volume)
      )) continue;
      byDate.set(bar.date, bar);
      reconciled = true;
    }
  }
  const quote = input.quote;
  let tradedAt: string | undefined;
  const providerTime = parseQuoteTime(quote?.tradedAt);
  if (input.market !== "US" && quote && quote.code === input.code && providerTime
    && Date.parse(providerTime) <= now.getTime() + 60_000) {
    const quoteClock = dailyMarketClock(input.market, new Date(providerTime));
    const quoteDate = quoteClock.date;
    const candle = normalizeQuoteOhlc({ open: quote.open, high: quote.high, low: quote.low, close: quote.price });
    const regular = quote.marketSessionType === "regularMarket" || quote.source === "kis-krx-websocket";
    const existing = byDate.get(quoteDate);
    const volume = parseQuoteNumber(quote.volume);
    if (regular && candle && quoteDate === clock.date && !beforeOpen
      && quoteClock.minute >= quoteClock.openMinute && quoteClock.minute <= 15 * 60 + 30
      && (!existing || (
        candle.open === existing.open && candle.high >= existing.high && candle.low <= existing.low
        && !(existing.volumeValid !== false && quote.volumeValid === false)
        && (quote.volumeValid === false || existing.volumeValid === false || (volume != null && volume >= existing.volume))
      ))) {
      byDate.set(quoteDate, {
        date: quoteDate, label: `${Number(quoteDate.slice(5, 7))}/${Number(quoteDate.slice(8, 10))}`,
        ...candle, volume: volume != null && volume >= 0 ? volume : 0,
        volumeValid: quote.volumeValid !== false && volume != null && volume >= 0,
        bullish: candle.close >= candle.open,
      });
      reconciled = true;
      tradedAt = providerTime;
    } else if (regular && quoteClock.minute >= quoteClock.openMinute && quoteClock.minute <= 15 * 60 + 30
      && existing && candle?.close === existing.close) {
      // Preserve a matching source time for display, never assign receipt time.
      tradedAt = providerTime;
    }
  }
  const bars = withMovingAverages([...byDate.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date)), input.market !== "US");
  const lastActualTradingDate = bars.at(-1)?.date ?? null;
  const current = lastActualTradingDate === clock.date;
  const status = !lastActualTradingDate ? "unavailable" : current ? "current-session" : beforeOpen ? "awaiting-session" : "not-current";
  const venue = input.market === "US" ? "뉴욕" : "한국";
  const note = !lastActualTradingDate ? "실제 일봉 자료를 확인하지 못했습니다."
    : current ? `${venue} ${lastActualTradingDate} 실제 일봉 · 장중에는 잠정값`
    : `최근 실제 거래일 ${lastActualTradingDate} · ${beforeOpen ? "다음 정규장 거래 자료 대기" : "오늘 거래 자료 미수신"}`;
  return { bars, freshness: { status, marketDate: clock.date, lastActualTradingDate, tradedAt, note }, reconciled };
}
