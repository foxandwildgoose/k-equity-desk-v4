/** Provider quote parsing. Missing values are never evidence of a flat market. */
export function parseQuoteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.includes(",") && !/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?$/.test(text)) return null;
  const raw = text.replace(/,/g, "");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A close-only sample cannot establish a candle's open, high or low. */
export function normalizeQuoteOhlc(values: { open: unknown; high: unknown; low: unknown; close: unknown }): { open: number; high: number; low: number; close: number } | null {
  const open = parseQuoteNumber(values.open), high = parseQuoteNumber(values.high);
  const low = parseQuoteNumber(values.low), close = parseQuoteNumber(values.close);
  if (open == null || high == null || low == null || close == null) return null;
  if (Math.min(open, high, low, close) <= 0 || high < Math.max(open, close) || low > Math.min(open, close) || high < low) return null;
  return { open, high, low, close };
}

function record(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const sessionFormatters = new Map<string, Intl.DateTimeFormat>();

/** Venue calendar, including US daylight saving time and Korea's UTC+9. */
export function formatQuoteSessionTime(epochSeconds: number, timeZone: string, withTime = false): string | undefined {
  if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) return undefined;
  const date = new Date(epochSeconds * 1000);
  if (!Number.isFinite(date.getTime())) return undefined;
  try {
    const key = `${timeZone}:${withTime}`;
    let formatter = sessionFormatters.get(key);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
      sessionFormatters.set(key, formatter);
    }
    const parts = formatter.formatToParts(date);
    const part = (name: string) => parts.find(p => p.type === name)?.value ?? "";
    const ymd = `${part("year")}-${part("month")}-${part("day")}`;
    return withTime ? `${ymd} ${part("hour")}:${part("minute")}` : ymd;
  } catch { return undefined; }
}

/** KRX/Naver direction: 1=upper limit, 2=rise, 3=flat, 4=lower limit, 5=fall. */
function naverDirection(value: unknown): -1 | 0 | 1 | null {
  const obj = record(value);
  const code = String(obj.code ?? value ?? "").trim().toUpperCase();
  if (code === "1" || code === "2") return 1;
  if (code === "4" || code === "5") return -1;
  if (code === "3") return 0;
  const label = String(obj.name ?? obj.text ?? code).trim().toUpperCase();
  if (/^(RISING|UPPER_LIMIT|상승|상한가)$/.test(label)) return 1;
  if (/^(FALLING|LOWER_LIMIT|하락|하한가)$/.test(label)) return -1;
  if (/^(UNCHANGED|STEADY|FLAT|보합)$/.test(label)) return 0;
  return null;
}

export type NormalizedNaverChange = {
  change: number;
  changePct: number;
  prevClose: number;
};

/**
 * Polling cv/cr are magnitudes; rf carries their sign. Mobile basic normally
 * supplies signed strings plus compareToPreviousPrice. Apply the same rule to
 * both, then check the result against an independently supplied previous close.
 */
export function normalizeNaverChange(input: {
  price: unknown;
  change?: unknown;
  changePct?: unknown;
  direction?: unknown;
  previousClose?: unknown;
}): NormalizedNaverChange | null {
  const price = parseQuoteNumber(input.price);
  if (price == null || price <= 0) return null;
  const rawChange = parseQuoteNumber(input.change);
  const rawPct = parseQuoteNumber(input.changePct);
  const previous = parseQuoteNumber(input.previousClose);
  const explicitPrevious = previous != null && previous > 0 ? previous : null;
  const fromPrevious = explicitPrevious != null ? price - explicitPrevious : null;
  const direction = naverDirection(input.direction);
  if (input.direction != null && input.direction !== "" && direction == null && explicitPrevious == null) return null;
  const sign = direction ?? (fromPrevious != null ? Math.sign(fromPrevious) : null);
  if (rawChange == null && fromPrevious == null) return null;
  let change = rawChange ?? fromPrevious!;
  if (sign != null) {
    // A negative amount cannot describe a provider-declared rising quote.
    if (sign > 0 && (change < 0 || (rawPct != null && rawPct < 0))) return null;
    if (sign === 0 && (change !== 0 || (rawPct != null && rawPct !== 0))) return null;
    change = sign * Math.abs(change);
  }
  if (Object.is(change, -0)) change = 0;
  if (direction != null && direction !== 0 && change === 0) return null;
  if (fromPrevious != null && Math.abs(change - fromPrevious) > Math.max(0.011, price * 1e-8)) return null;
  const prevClose = explicitPrevious ?? price - change;
  if (!Number.isFinite(prevClose) || prevClose <= 0) return null;
  const computedPct = change / prevClose * 100;
  let changePct = rawPct ?? computedPct;
  if (sign != null) changePct = sign * Math.abs(changePct);
  if (Object.is(changePct, -0)) changePct = 0;
  // Provider percentages are rounded to two decimals. Larger mismatches mean a
  // mixed session, wrong unit, or invalid row and must not reach sector returns.
  if (Math.abs(changePct - computedPct) > 0.025) return null;
  return { change, changePct, prevClose };
}

/** Parse only provider timestamps with a known date/time zone, never Date.now(). */
export function parseQuoteTime(value: unknown, localOffset = "+09:00"): string | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const millis = value < 100_000_000_000 ? value * 1000 : value;
    const date = new Date(millis);
    return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
  }
  if (typeof value !== "string") return undefined;
  let raw = value.trim();
  if (/^\d{14}$/.test(raw)) {
    raw = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}${localOffset}`;
  } else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)) {
    raw = raw.replace(" ", "T") + localOffset;
  }
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!parts) return undefined;
  const [, year, month, day, hour, minute, second] = parts;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() + 1 !== Number(month) || calendar.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return undefined;
  return Number.isFinite(Date.parse(raw)) ? raw : undefined;
}

function positive(value: unknown): number | null {
  const number = parseQuoteNumber(value);
  return number != null && number > 0 ? number : null;
}

function nonnegative(value: unknown): number | null {
  const number = parseQuoteNumber(value);
  return number != null && number >= 0 ? number : null;
}

export type NormalizedNaverSnapshot = NormalizedNaverChange & {
  code: string;
  market?: "KOSPI" | "KOSDAQ";
  name?: string;
  price: number;
  volume: number | null;
  marketCap: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  high52: number | null;
  low52: number | null;
  marketStatus?: string;
  marketSessionType?: string;
  tradedAt?: string;
  afterHoursPrice?: number;
  afterHoursChange?: number;
  afterHoursChangePct?: number;
};

function afterHours(value: unknown): Pick<NormalizedNaverSnapshot, "afterHoursPrice" | "afterHoursChange" | "afterHoursChangePct"> {
  const row = record(value);
  const price = positive(row.overPrice);
  if (price == null) return {};
  const change = normalizeNaverChange({
    price,
    change: row.compareToPreviousClosePrice,
    changePct: row.fluctuationsRatio,
    direction: row.compareToPreviousPrice,
  });
  return change ? { afterHoursPrice: price, afterHoursChange: change.change, afterHoursChangePct: change.changePct } : {};
}

/** The primary SERVICE_ITEM / SERVICE_INDEX payload. Index levels use ×100. */
export function normalizeNaverPollingQuote(value: unknown, index = false): NormalizedNaverSnapshot | null {
  const row = record(value);
  const code = typeof row.cd === "string" ? row.cd.trim().toUpperCase() : "";
  const rawPrice = positive(row.nv);
  if (!code || rawPrice == null) return null;
  const scale = index ? 100 : 1;
  const price = rawPrice / scale;
  const rawChange = parseQuoteNumber(row.cv);
  const previous = positive(row.pcv);
  // The polling service's unsigned magnitudes cannot establish direction alone.
  if (naverDirection(row.rf) == null && previous == null) return null;
  const change = normalizeNaverChange({
    price,
    change: rawChange != null ? rawChange / scale : undefined,
    changePct: row.cr,
    previousClose: previous != null ? previous / scale : undefined,
    direction: row.rf,
  });
  if (!change) return null;
  const listed = positive(row.countOfListedStock);
  const level = (v: unknown) => { const p = positive(v); return p == null ? null : p / scale; };
  return {
    code,
    name: typeof row.nm === "string" ? row.nm : undefined,
    price,
    ...change,
    volume: nonnegative(row.aq),
    // aa is accumulated turnover, not market capitalisation.
    marketCap: listed != null ? Math.round(listed * price / 1e8) : null,
    open: level(row.ov), high: level(row.hv), low: level(row.lv),
    high52: positive(row.highPriceOf52Weeks), low52: positive(row.lowPriceOf52Weeks),
    marketStatus: typeof row.ms === "string" ? row.ms : undefined,
    marketSessionType: typeof row.marketSessionType === "string" ? row.marketSessionType : undefined,
    // result.time is request/server time, not the row's trading timestamp.
    tradedAt: parseQuoteTime(row.localTradedAt),
    ...afterHours(row.nxtOverMarketPriceInfo),
  };
}

/** The fallback mobile /basic endpoint preserves signed values and trade time. */
export function normalizeNaverBasicQuote(value: unknown, code: string): NormalizedNaverSnapshot | null {
  const row = record(value);
  const actualCode = row.itemCode ?? row.reutersCode ?? row.symbolCode;
  if (actualCode != null && String(actualCode).trim().toUpperCase() !== code.toUpperCase()) return null;
  const price = positive(row.closePrice);
  if (price == null) return null;
  const infos = new Map<string, unknown>();
  if (Array.isArray(row.stockItemTotalInfos)) {
    for (const info of row.stockItemTotalInfos) {
      const item = record(info);
      if (typeof item.code === "string") infos.set(item.code, item.value);
    }
  }
  const change = normalizeNaverChange({
    price,
    change: row.compareToPreviousClosePrice,
    changePct: row.fluctuationsRatio,
    direction: row.compareToPreviousPrice,
    previousClose: row.previousClosePrice ?? row.basePrice ?? infos.get("basePrice"),
  });
  if (!change) return null;
  const listed = positive(row.countOfListedStock);
  const exchange = record(row.stockExchangeType);
  const marketLabel = String(row.stockExchangeName ?? exchange.name ?? exchange.code ?? "").toUpperCase();
  const market = marketLabel === "KOSPI" || marketLabel === "KS" ? "KOSPI" : marketLabel === "KOSDAQ" || marketLabel === "KQ" ? "KOSDAQ" : undefined;
  return {
    code, price, market, ...change,
    name: typeof row.stockName === "string" ? row.stockName : undefined,
    volume: nonnegative(row.accumulatedTradingVolume ?? row.accumulatedTradingVolumeRaw ?? infos.get("accumulatedTradingVolume")),
    marketCap: listed != null ? Math.round(listed * price / 1e8) : null,
    open: positive(row.openPrice ?? row.openPriceRaw ?? infos.get("openPrice")),
    high: positive(row.highPrice ?? row.highPriceRaw ?? infos.get("highPrice")),
    low: positive(row.lowPrice ?? row.lowPriceRaw ?? infos.get("lowPrice")),
    high52: positive(row.highPriceOf52Weeks ?? infos.get("highPriceOf52Weeks")),
    low52: positive(row.lowPriceOf52Weeks ?? infos.get("lowPriceOf52Weeks")),
    marketStatus: typeof row.marketStatus === "string" ? row.marketStatus : undefined,
    marketSessionType: typeof row.marketSessionType === "string" ? row.marketSessionType : undefined,
    tradedAt: parseQuoteTime(row.localTradedAt),
    ...afterHours(row.overMarketPriceInfo),
  };
}

/** A market-value listing row publishes price, volume, cap and date together. */
export function normalizeNaverListingQuote(value: unknown): NormalizedNaverSnapshot | null {
  const row = record(value);
  const code = typeof row.itemCode === "string" ? row.itemCode.trim().toUpperCase() : "";
  if (!/^[0-9A-Z]{6}$/.test(code) || !["stock", "etf"].includes(String(row.stockEndType))) return null;
  const quote = normalizeNaverBasicQuote(row, code);
  if (!quote?.tradedAt) return null;
  // The domestic listing's marketValue is 억 KRW; its Raw field is full KRW.
  // Neither accumulatedTradingValue nor an undated integration value is a cap.
  const rawCap = positive(row.marketValueRaw);
  const capEok = positive(row.marketValue);
  const marketCap = rawCap != null ? rawCap / 1e8 : capEok;
  if (rawCap != null && capEok != null && Math.abs(rawCap / 1e8 - capEok) > 1) return null;
  return { ...quote, marketCap };
}
