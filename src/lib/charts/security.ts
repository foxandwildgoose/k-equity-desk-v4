import type { KrxInstrument } from "../chart-format.ts";

/** Listing identity, never inferred from an issuer name or underlying assets. */
export interface ChartSecurity {
  code: string;
  market: "KR" | "US";
  exchange: string;
  instrument: KrxInstrument;
  currency: "KRW" | "USD";
  quantityUnit: "주" | "좌";
  name?: string;
  source: string;
}

export function parseChartSymbols(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter((v) => /^(KR:[0-9A-Z]{6}|US:[A-Z][A-Z0-9.]{0,9})$/.test(v))
    .slice(0, 4);
}

/** Reuse the products already supported by the overseas service. */
export function existingUsChartSecurity(code: string, etfCodes: readonly string[]): ChartSecurity {
  const instrument = etfCodes.includes(code) ? "etf" : "stock";
  return {
    code,
    market: "US",
    exchange: "US",
    currency: "USD",
    quantityUnit: "주",
    instrument,
    source: instrument === "etf" ? "existing-robotics-etf-universe" : "existing-us-stock-route",
  };
}

export function parseYahooChartSecurity(code: string, value: unknown): ChartSecurity | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.symbol !== code || row.currency !== "USD") return null;
  if (row.instrumentType !== "ETF" && row.instrumentType !== "EQUITY") return null;
  if (typeof row.exchangeName !== "string" || !row.exchangeName) return null;
  return {
    code,
    market: "US",
    exchange: row.exchangeName,
    instrument: row.instrumentType === "ETF" ? "etf" : "stock",
    currency: "USD",
    quantityUnit: "주",
    name:
      typeof row.longName === "string"
        ? row.longName
        : typeof row.shortName === "string"
          ? row.shortName
          : undefined,
    source: "yahoo-chart-meta:instrumentType/exchangeName/currency",
  };
}

/** The provider's explicit product/exchange fields take precedence over any text. */
export function parseNaverChartSecurity(code: string, value: unknown): ChartSecurity | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.itemCode !== code || !/^[0-9A-Z]{6}$/.test(code)) return null;
  const type = row.stockEndType;
  if (type !== "stock" && type !== "etf" && type !== "etn") return null;
  const ex = row.stockExchangeType as Record<string, unknown> | null;
  if (!ex || (ex.nationCode !== "KOR" && ex.nationType !== "KOR")) return null;
  const exchange =
    ex.nameEng === "KOSDAQ" || ex.name === "KOSDAQ"
      ? "KOSDAQ"
      : ex.nameEng === "KOSPI" || ex.name === "KOSPI"
        ? "KOSPI"
        : null;
  if (!exchange) return null;
  return {
    code,
    market: "KR",
    exchange,
    instrument: type,
    currency: "KRW",
    // Naver's chart volume is the instrument's traded shares, not ETF creation units.
    quantityUnit: "주",
    name: typeof row.stockName === "string" ? row.stockName : undefined,
    source: "naver-stock-basic:stockEndType/stockExchangeType",
  };
}

export function chartLayoutScope(kind: "detail"): "detail";
export function chartLayoutScope(kind: "workspace", cell?: number): string;
export function chartLayoutScope(kind: "detail" | "workspace", cell = 0): string {
  return kind === "detail" ? "detail" : `workspace-${Math.max(0, Math.min(3, Math.floor(cell)))}`;
}

export function chartPriceBasisNote(source: string, market: "KR" | "US"): string {
  if (market === "US" && source.startsWith("yahoo-us-")) {
    return "Yahoo 조정종가/종가 계수를 전체 OHLC에 적용 · 거래량은 공급자 원수량 · 분할·분배금 및 수량 조정 일치 미확인 · 실제 체결가격 분포와 다를 수 있음";
  }
  if (source.startsWith("yahoo-"))
    return "Yahoo 제공 OHLC · 거래량은 공급자 원수량 · 분할·분배금 조정 및 수량 기준 일치 미확인";
  return "공급자 제공 OHLC·거래량 · 수정가격·분할·분배금 및 수량 조정 기준 미확인";
}

/** Do not combine histories after provider fallback changes the price basis. */
export function sameChartPriceBasis(first: string, second: string): boolean {
  if (!first || !second || /empty|invalid/.test(first + second)) return false;
  if (first.startsWith("yahoo-us-") && second.startsWith("yahoo-us-")) {
    return first.replace(/-(1d|1wk|1mo|3mo)$/, "") === second.replace(/-(1d|1wk|1mo|3mo)$/, "");
  }
  // Same symbol and same endpoint quote fields for Korean Yahoo bars.
  return (first.startsWith("yahoo-") || first.startsWith("naver-")) && first === second;
}
