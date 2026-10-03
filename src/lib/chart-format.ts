/**
 * Market-aware chart formatters (F7.1, fixes D3) + KRX tick size. Pure module.
 *
 * KRW: integer prices with thousands separators (precision 0, minMove 1).
 * USD: 2 decimals, 4 below $1. Volume: 만/억 (KR), K/M/B (US).
 */

export type ChartMarket = "KR" | "US";
export type KrxInstrument = "stock" | "etf" | "etn";

export interface PriceFormatSpec {
  type: "price" | "custom";
  precision: number;
  minMove: number;
  formatter?: (price: number) => string;
}

const KRW_FMT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatKrwPrice(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return KRW_FMT.format(Math.round(value));
}

export function usdPrecision(sample: number | null | undefined): 2 | 4 {
  return sample != null && Number.isFinite(sample) && Math.abs(sample) > 0 && Math.abs(sample) < 1 ? 4 : 2;
}

export function formatUsdPrice(value: number, precision: 2 | 4 = usdPrecision(value)): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: precision, maximumFractionDigits: precision });
}

/** Series `priceFormat` for a market. KRW uses a custom formatter so axis labels get separators. */
export function priceFormatFor(market: ChartMarket, sampleClose?: number | null): PriceFormatSpec {
  if (market === "KR") {
    return { type: "custom", precision: 0, minMove: 1, formatter: formatKrwPrice };
  }
  const p = usdPrecision(sampleClose);
  return { type: "price", precision: p, minMove: p === 4 ? 0.0001 : 0.01 };
}

/** Axis/crosshair label for a price in the given market. */
export function formatChartPrice(value: number, market: ChartMarket, sampleClose?: number | null): string {
  return market === "KR" ? formatKrwPrice(value) : formatUsdPrice(value, usdPrecision(sampleClose ?? value));
}

export function formatChartPercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

/** Volume: KR → 만/억 units, US → K/M/B. */
export function formatChartVolume(value: number, market: ChartMarket): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (market === "KR") {
    if (abs >= 1e8) return `${(value / 1e8).toFixed(abs >= 1e9 ? 0 : 1)}억`;
    if (abs >= 1e4) return `${(value / 1e4).toFixed(abs >= 1e5 ? 0 : 1)}만`;
    return KRW_FMT.format(Math.round(value));
  }
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(Math.round(value));
}

/**
 * KRX tick size (호가가격단위). Stocks: unified KOSPI/KOSDAQ table effective
 * 2023-01-25. ETF/ETN: flat 5 KRW. Status: NOT re-verified in this session
 * (OFFLINE-BUILD) — used only for snapping drawings, never for orders.
 */
export function krxTickSize(price: number, instrument: KrxInstrument = "stock"): number {
  if (!Number.isFinite(price) || price <= 0) return 1;
  if (instrument === "etf" || instrument === "etn") return 5;
  if (price < 2_000) return 1;
  if (price < 5_000) return 5;
  if (price < 20_000) return 10;
  if (price < 50_000) return 50;
  if (price < 200_000) return 100;
  if (price < 500_000) return 500;
  return 1_000;
}

/** Snap a price to the nearest valid KRX tick. */
export function snapToKrxTick(price: number, instrument: KrxInstrument = "stock"): number {
  const tick = krxTickSize(price, instrument);
  return Math.round(price / tick) * tick;
}
