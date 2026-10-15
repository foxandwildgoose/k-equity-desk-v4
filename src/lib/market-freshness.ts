/**
 * Provider-time based Korean quote selection. A successful HTTP refresh is not
 * evidence that the underlying market observation is current.
 */
export interface TimedMarketQuote {
  code: string;
  price: number;
  changePct: number;
  change?: number;
  changeValid?: boolean;
  tradedAt?: string;
  marketStatus?: string;
  fetchedAt?: string;
}

export type QuoteFreshnessStatus = "fresh" | "closed" | "stale" | "unavailable";
export type MarketCoverageStatus = QuoteFreshnessStatus | "partial";
export const MARKET_QUOTE_MAX_AGE_MS = 15 * 60_000;
const KST_OFFSET_MS = 9 * 60 * 60_000;
const FUTURE_TOLERANCE_MS = 60_000;

export interface QuoteFreshness {
  status: QuoteFreshnessStatus;
  asOf: string | null;
  asOfMs: number | null;
  sessionDate: string | null;
  reason: string;
}

function kstParts(ms: number) {
  const date = new Date(ms + KST_OFFSET_MS);
  return { date: date.toISOString().slice(0, 10), day: date.getUTCDay(), minute: date.getUTCHours() * 60 + date.getUTCMinutes() };
}

/** Provider-local timestamps are KST; date-only values lack observation time. */
export function providerQuoteTime(raw: string | undefined | null): number | null {
  if (typeof raw !== "string") return null;
  let value = raw.trim();
  if (/^\d{8}\s+\d{6}$/.test(value)) value = value.replace(/^(\d{4})(\d{2})(\d{2})\s+(\d{2})(\d{2})(\d{2})$/, "$1-$2-$3T$4:$5:$6+09:00");
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(value)) return null;
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) value = `${value.replace(" ", "T")}+09:00`;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  // Date.parse normalizes February 30 and 24:00 instead of rejecting them.
  const components = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value)!;
  const [, year, month, day, hour, minute, second = "0"] = components;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() + 1 !== Number(month) || calendar.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  return ms;
}

/** Weekday/time guard only; it does not invent an exchange holiday calendar. */
export function expectedKrSessionDate(now = Date.now()): string {
  const parts = kstParts(now);
  let day = Date.parse(`${parts.date}T00:00:00+09:00`);
  if (parts.day === 0 || parts.day === 6 || parts.minute < 9 * 60) day -= 24 * 60 * 60_000;
  while ([0, 6].includes(kstParts(day).day)) day -= 24 * 60 * 60_000;
  return kstParts(day).date;
}

export function isValidMarketQuote(quote: TimedMarketQuote): boolean {
  return typeof quote.code === "string" && quote.code.trim().length > 0 &&
    Number.isFinite(quote.price) && quote.price > 0 &&
    Number.isFinite(quote.changePct) && quote.changeValid !== false &&
    (quote.change === undefined || Number.isFinite(quote.change));
}

export function quoteFreshness(quote: TimedMarketQuote, now = Date.now()): QuoteFreshness {
  const ms = providerQuoteTime(quote.tradedAt);
  const base = { asOf: ms == null ? null : new Date(ms).toISOString(), asOfMs: ms, sessionDate: ms == null ? null : kstParts(ms).date };
  if (!isValidMarketQuote(quote)) return { ...base, status: "unavailable", reason: "invalid-price-or-change" };
  if (ms == null) return { ...base, status: "unavailable", reason: "missing-provider-time" };
  if (ms > now + FUTURE_TOLERANCE_MS) return { ...base, status: "stale", reason: "future-provider-time" };
  if (base.sessionDate !== expectedKrSessionDate(now)) return { ...base, status: "stale", reason: "different-session" };
  const parts = kstParts(now);
  const sessionOpen = parts.day !== 0 && parts.day !== 6 && parts.minute >= 9 * 60 && parts.minute < 15 * 60 + 30;
  if (sessionOpen) {
    if (now - ms > MARKET_QUOTE_MAX_AGE_MS) return { ...base, status: "stale", reason: "old-intraday-observation" };
    return { ...base, status: "fresh", reason: "current-session-observation" };
  }
  // A quote stamped OPEN during the current regular session is not evidence of
  // a closing price. Keep it explicitly stale until a closing observation lands.
  if (!["CLOSE", "CLOSED", "AFTER", "AFTERHOURS"].includes((quote.marketStatus ?? "").toUpperCase()) && kstParts(ms).minute < 15 * 60 + 30) {
    return { ...base, status: "stale", reason: "closing-observation-unconfirmed" };
  }
  return { ...base, status: "closed", reason: "dated-closed-session-observation" };
}

export function selectMarketQuotes<T extends TimedMarketQuote>(input: readonly T[], now = Date.now()) {
  const byCode = new Map<string, T>();
  let duplicateCount = 0;
  for (const quote of input) {
    if (typeof quote.code !== "string" || !quote.code.trim()) continue;
    const key = quote.code.trim().toUpperCase();
    const existing = byCode.get(key);
    if (!existing) { byCode.set(key, quote); continue; }
    duplicateCount++;
    const oldTime = providerQuoteTime(existing.tradedAt) ?? -Infinity;
    const newTime = providerQuoteTime(quote.tradedAt) ?? -Infinity;
    if (newTime > oldTime || (newTime === oldTime && !isValidMarketQuote(existing) && isValidMarketQuote(quote))) byCode.set(key, quote);
  }
  const all = [...byCode.values()];
  const quotes: T[] = [];
  let staleCount = 0;
  let invalidCount = 0;
  let missingTimeCount = 0;
  let freshCount = 0;
  let closedCount = 0;
  const times: number[] = [];
  const observedTimes: number[] = [];
  for (const quote of all) {
    const state = quoteFreshness(quote, now);
    if (state.asOfMs != null) observedTimes.push(state.asOfMs);
    if (!isValidMarketQuote(quote)) invalidCount++;
    else if (state.asOfMs == null) missingTimeCount++;
    else if (state.status === "stale") staleCount++;
    else if (state.status === "fresh" || state.status === "closed") {
      quotes.push(quote);
      times.push(state.asOfMs);
      if (state.status === "fresh") freshCount++; else closedCount++;
    }
  }
  const dateOf = (value: number | undefined) => value == null ? null : new Date(value).toISOString();
  const oldestAsOf = times.length ? dateOf(Math.min(...times)) : null;
  const newestAsOf = times.length ? dateOf(Math.max(...times)) : null;
  const status: MarketCoverageStatus = !quotes.length ? (staleCount ? "stale" : "unavailable") : staleCount || invalidCount || missingTimeCount ? "partial" : freshCount ? "fresh" : "closed";
  return {
    quotes, all, count: quotes.length, staleCount, invalidCount, missingTimeCount, duplicateCount, freshCount, closedCount,
    status, asOf: newestAsOf, oldestAsOf, newestAsOf,
    oldestObservedAsOf: observedTimes.length ? dateOf(Math.min(...observedTimes)) : null,
    newestObservedAsOf: observedTimes.length ? dateOf(Math.max(...observedTimes)) : null,
    sessionDate: expectedKrSessionDate(now),
  };
}

export function quoteCoverage<T extends TimedMarketQuote>(input: readonly T[], expectedCodes: Iterable<string>, now = Date.now()) {
  const codes = new Set([...expectedCodes].map((code) => code.trim().toUpperCase()));
  const selected = selectMarketQuotes(input.filter((quote) => typeof quote.code === "string" && codes.has(quote.code.trim().toUpperCase())), now);
  const missingCount = Math.max(0, codes.size - selected.all.length);
  return {
    ...selected,
    expectedCount: codes.size,
    missingCount,
    status: selected.count && missingCount ? "partial" as const : selected.status,
    avgChangePct: selected.count ? selected.quotes.reduce((sum, quote) => sum + quote.changePct / selected.count, 0) : null,
    basis: "equal-weight-coverage" as const,
  };
}

/** A negative observation can never be a gainer; a positive one is not a loser. */
export function marketQuoteMovers<T extends TimedMarketQuote>(input: readonly T[], n = 6, now = Date.now()) {
  const selected = selectMarketQuotes(input, now).quotes;
  const limit = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  return {
    gainers: selected.filter((quote) => quote.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, limit),
    losers: selected.filter((quote) => quote.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, limit),
  };
}
