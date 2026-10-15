import { normalizeNaverChange, parseQuoteNumber, parseQuoteTime } from "./quote-normalization.ts";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** ETF-list risefall has the same directional contract as stock polling rf. */
export function normalizeEtfListQuote(value: unknown) {
  const row = record(value);
  const price = parseQuoteNumber(row.nowVal);
  if (price == null || price <= 0) return null;
  const change = normalizeNaverChange({ price, change: row.changeVal, changePct: row.changeRate, direction: row.risefall });
  if (!change) return null;
  const nav = parseQuoteNumber(row.nav);
  const volume = parseQuoteNumber(row.quant);
  const marketCap = parseQuoteNumber(row.marketSum);
  return {
    price, ...change, nav: nav != null && nav > 0 ? nav : 0,
    navAvailable: nav != null && nav > 0,
    volume: volume != null && volume >= 0 ? volume : 0,
    volumeValid: volume != null && volume >= 0,
    marketSum: marketCap != null && marketCap > 0 ? marketCap : 0,
    marketCapValid: marketCap != null && marketCap > 0,
    // This list endpoint has no provider trading time. Its receipt time is not
    // evidence that an ETF traded today; do not stamp Date.now() as tradedAt.
    tradedAt: parseQuoteTime(row.localTradedAt),
    quoteAvailable: true,
    changeValid: true,
  };
}

/** A foreign holding retains the provider's signed return and actual zone. */
export function normalizeWorldHoldingQuote(value: unknown, reutersCode: string) {
  const row = record(value);
  if (typeof row.reutersCode !== "string" || row.reutersCode.toUpperCase() !== reutersCode.toUpperCase()) return null;
  const price = parseQuoteNumber(row.closePriceRaw ?? row.closePrice);
  if (price == null || price <= 0) return null;
  const change = normalizeNaverChange({
    price, change: row.compareToPreviousClosePriceRaw ?? row.compareToPreviousClosePrice,
    changePct: row.fluctuationsRatioRaw ?? row.fluctuationsRatio,
    direction: row.compareToPreviousPrice,
  });
  if (!change) return null;
  const infos = new Map<string, unknown>();
  for (const info of Array.isArray(row.stockItemTotalInfos) ? row.stockItemTotalInfos : []) {
    const item = record(info);
    if (typeof item.code === "string") infos.set(item.code, item.value);
  }
  const volume = parseQuoteNumber(row.accumulatedTradingVolumeRaw ?? infos.get("accumulatedTradingVolume"));
  const rawTime = row.localTradedAt;
  // A zone-less US/Japan time must not silently inherit Korea's +09:00.
  const tradedAt = typeof rawTime === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(rawTime)
    ? parseQuoteTime(rawTime) : undefined;
  return {
    price, change: change.change, changePct: change.changePct,
    changeValid: true,
    volume: volume != null && volume >= 0 ? volume : 0,
    volumeValid: volume != null && volume >= 0,
    tradedAt,
    name: typeof row.stockName === "string" ? row.stockName : undefined,
  };
}
