import { isValidMarketQuote, providerQuoteTime, type TimedMarketQuote } from "../lib/market-freshness.ts";

/** Retain prior observations through partial origin failures, without renewing any row's dates. */
export function retainMarketQuoteCoverage<T extends TimedMarketQuote>(
  previous: readonly T[],
  incoming: readonly T[],
  expectedCodes?: Iterable<string>,
): { data: T[]; stale: boolean; accepted: boolean } {
  const expected = expectedCodes ? new Set(expectedCodes) : undefined;
  const rows = new Map(previous.filter(row => !expected || expected.has(row.code)).map(row => [row.code, row]));
  const refreshed = new Set<string>();
  let accepted = false;
  for (const row of incoming) {
    if (!isValidMarketQuote(row) || expected && !expected.has(row.code)) continue;
    const before = rows.get(row.code);
    const beforeTime = before ? providerQuoteTime(before.tradedAt) : null;
    const incomingTime = providerQuoteTime(row.tradedAt);
    if (before && beforeTime != null && (incomingTime == null || incomingTime < beforeTime)) continue;
    rows.set(row.code, row);
    accepted = true;
    if (incomingTime != null) refreshed.add(row.code);
  }
  const required = expected ?? new Set(rows.keys());
  return {
    data: [...rows.values()],
    stale: [...required].some(code => !refreshed.has(code)),
    accepted,
  };
}
