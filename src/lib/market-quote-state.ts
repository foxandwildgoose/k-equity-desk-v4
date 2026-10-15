import {
  MAX_KIS_CLOCK_SKEW_MS,
  MAX_KIS_TRADE_AGE_MS,
  kisTradeTimestamp,
  type KisRealtimeTrade,
} from "./kis-trade.ts";

interface QuoteRow {
  code: string;
  price: number;
  change: number;
  changePct: number;
  source?: string;
  tradedAt?: string;
  fetchedAt?: string;
  volume?: number;
}

function timestamp(value: unknown): number | null {
  if (typeof value !== "string" || !/T\d{2}:\d{2}:\d{2}/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isFreshKisQuote(
  quote: { source?: string; tradedAt?: string } | null | undefined,
  now = Date.now(),
): boolean {
  const at = timestamp(quote?.tradedAt);
  return (
    quote?.source === "kis-krx-websocket" &&
    at !== null &&
    now - at >= -MAX_KIS_CLOCK_SKEW_MS &&
    now - at <= MAX_KIS_TRADE_AGE_MS
  );
}

/** EventSource JSON is untrusted at runtime, even when its TypeScript type matches. */
export function isValidKisTrade(value: unknown, now = Date.now()): value is KisRealtimeTrade {
  if (!value || typeof value !== "object") return false;
  const t = value as KisRealtimeTrade;
  if (t.source !== "kis-krx-websocket" || !/^\d{6}$/.test(t.code ?? "")) return false;
  const at = kisTradeTimestamp(t.businessDate, t.tradeTime);
  if (!at || t.tradedAt !== at || !isFreshKisQuote(t, now)) return false;
  const receipt = timestamp(t.receivedAt);
  if (
    receipt === null ||
    receipt < Date.parse(at) - MAX_KIS_CLOCK_SKEW_MS ||
    Math.abs(now - receipt) > MAX_KIS_TRADE_AGE_MS
  )
    return false;
  if (
    ![t.price, t.change, t.changePct, t.open, t.high, t.low, t.accumulatedVolume].every(
      Number.isFinite,
    )
  )
    return false;
  const previous = t.price - t.change;
  if (
    t.price <= 0 ||
    previous <= 0 ||
    t.open < 0 ||
    t.high < 0 ||
    t.low < 0 ||
    t.accumulatedVolume < 0
  )
    return false;
  return Math.abs((t.change / previous) * 100 - t.changePct) <= 0.025;
}

export function applyTradeToQuote<T extends QuoteRow>(
  quote: T,
  trade: KisRealtimeTrade,
  now = Date.now(),
): T {
  if (quote.code !== trade.code || !isValidKisTrade(trade, now)) return quote;
  const oldAt = timestamp(quote.tradedAt);
  const tradeAt = Date.parse(trade.tradedAt);
  if (oldAt !== null && oldAt > tradeAt) return quote;
  if (oldAt === tradeAt && quote.source === "kis-krx-websocket") {
    const receipt = timestamp(quote.fetchedAt);
    if (
      (receipt !== null && receipt > Date.parse(trade.receivedAt)) ||
      (typeof quote.volume === "number" && quote.volume > trade.accumulatedVolume)
    )
      return quote;
  }
  return {
    ...quote,
    price: trade.price,
    change: trade.change,
    changePct: trade.changePct,
    changeValid: true,
    previousCloseValid: true,
    volumeValid: true,
    prevClose: trade.price - trade.change,
    open: trade.open,
    high: trade.high,
    low: trade.low,
    volume: trade.accumulatedVolume,
    tradedAt: trade.tradedAt,
    fetchedAt: trade.receivedAt,
    source: "kis-krx-websocket",
  };
}

function retainedTick(oldRow: QuoteRow, newRow: QuoteRow): QuoteRow {
  const fields = [
    "price",
    "change",
    "changePct",
    "changeValid",
    "previousCloseValid",
    "volumeValid",
    "prevClose",
    "open",
    "high",
    "low",
    "volume",
    "tradedAt",
    "fetchedAt",
    "source",
  ];
  const tickFields = Object.fromEntries(
    fields.filter((key) => key in oldRow).map((key) => [key, Reflect.get(oldRow, key)]),
  );
  return { ...newRow, ...tickFields };
}

function preserveNewerTick(oldRow: QuoteRow | undefined, newRow: QuoteRow): QuoteRow {
  if (!oldRow || oldRow.code !== newRow.code || oldRow.source !== "kis-krx-websocket")
    return newRow;
  const oldAt = timestamp(oldRow.tradedAt);
  const newAt = timestamp(newRow.tradedAt);
  if (oldAt !== null && newAt !== null) {
    if (oldAt > newAt || (oldAt === newAt && newRow.source !== "kis-krx-websocket"))
      return retainedTick(oldRow, newRow);
    if (oldAt === newAt && newRow.source === "kis-krx-websocket") {
      const oldReceipt = timestamp(oldRow.fetchedAt);
      const newReceipt = timestamp(newRow.fetchedAt);
      if (
        (oldReceipt !== null && newReceipt !== null && oldReceipt > newReceipt) ||
        (typeof oldRow.volume === "number" &&
          typeof newRow.volume === "number" &&
          oldRow.volume > newRow.volume)
      )
        return retainedTick(oldRow, newRow);
    }
  }
  if (newAt === null && isFreshKisQuote(oldRow)) return retainedTick(oldRow, newRow);
  return newRow;
}

/** Keep later provider observations when a slower REST request resolves after a tick. */
export function mergeQuoteSnapshots<T>(oldData: unknown, newData: T): T {
  if (!oldData || !newData || typeof oldData !== "object" || typeof newData !== "object")
    return newData;
  const old = oldData as { quotes?: QuoteRow[]; quote?: QuoteRow | null; etf?: QuoteRow };
  const next = newData as { quotes?: QuoteRow[]; quote?: QuoteRow | null; etf?: QuoteRow };
  if (Array.isArray(next.quotes) && Array.isArray(old.quotes)) {
    const map = new Map(old.quotes.map((row) => [row.code, row]));
    return {
      ...newData,
      quotes: next.quotes.map((row) => preserveNewerTick(map.get(row.code), row)),
    } as T;
  }
  if (next.quote)
    return { ...newData, quote: preserveNewerTick(old.quote ?? undefined, next.quote) } as T;
  if (next.etf) return { ...newData, etf: preserveNewerTick(old.etf, next.etf) } as T;
  return newData;
}
