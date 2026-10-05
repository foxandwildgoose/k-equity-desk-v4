/** Client-side technical indicators used by the pro trading chart. */

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (!Number.isSafeInteger(period) || period < 1) return out;
  let sum = 0;
  let missing = 0;
  for (let i = 0; i < values.length; i++) {
    const value = values[i]!;
    if (Number.isFinite(value)) sum += value;
    else missing++;
    if (i >= period) {
      const old = values[i - period]!;
      if (Number.isFinite(old)) sum -= old;
      else missing--;
    }
    if (i >= period - 1 && missing === 0) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev == null) {
      let s = 0;
      for (let j = i - period + 1; j <= i; j++) s += values[j]!;
      prev = s / period;
    } else {
      prev = v * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

export function bollinger(
  closes: number[],
  period = 20,
  mult = 2,
): { mid: (number | null)[]; upper: (number | null)[]; lower: (number | null)[] } {
  if (!Number.isSafeInteger(period) || period < 1 || !Number.isFinite(mult) || mult <= 0) {
    const missing = new Array<number | null>(closes.length).fill(null);
    return { mid: [...missing], upper: [...missing], lower: [...missing] };
  }
  const mid = sma(closes, period);
  const deviations = rollingPopulationStdDev(closes, period);
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    const center = mid[i];
    const deviation = deviations[i];
    if (center == null || deviation == null) continue;
    const hi = center + mult * deviation;
    const lo = center - mult * deviation;
    if (Number.isFinite(hi) && Number.isFinite(lo)) {
      upper[i] = hi;
      lower[i] = lo;
    }
  }
  return { mid, upper, lower };
}

/**
 * Population deviation using add/remove Welford updates, not E[x²] - E[x]².
 * Rebase once per window to limit sliding roundoff: O(N) total work. Invalid
 * values leave the whole affected window unavailable; no zero substitution.
 */
export function rollingPopulationStdDev(values: number[], period: number): (number | null)[] {
  const out = new Array<number | null>(values.length).fill(null);
  if (!Number.isSafeInteger(period) || period < 1) return out;
  let count = 0;
  let mean = 0;
  let m2 = 0;
  const add = (value: number) => {
    if (!Number.isFinite(value)) return;
    count++;
    const delta = value - mean;
    mean += delta / count;
    m2 += delta * (value - mean);
  };
  for (let i = 0; i < values.length; i++) {
    if (i >= period) {
      const old = values[i - period]!;
      if (Number.isFinite(old)) {
        if (count <= 1) { count = 0; mean = 0; m2 = 0; }
        else {
          const nextMean = mean + (mean - old) / (count - 1);
          m2 -= (old - mean) * (old - nextMean);
          mean = nextMean;
          count--;
        }
      }
    }
    add(values[i]!);
    if (i >= period - 1 && (i - period + 1) % period === 0) {
      count = 0; mean = 0; m2 = 0;
      for (let j = i - period + 1; j <= i; j++) add(values[j]!);
    }
    if (count === period && Number.isFinite(m2)) out[i] = Math.sqrt(Math.max(0, m2) / period);
  }
  return out;
}

/**
 * Wilder RSI, seeded with `period` consecutive close-to-close changes.
 * Missing/non-finite/non-positive closes break the series and restart warmup;
 * they are never treated as zero or bridged. A completely flat window is 50.
 * Invalid periods produce only nulls. Compute over the loaded history before
 * slicing for display so scrolling cannot change a date's RSI.
 */
export function rsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (!Number.isSafeInteger(period) || period < 1) return out;
  let avgGain = 0;
  let avgLoss = 0;
  let changes = 0;
  let previous: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    const close = closes[i]!;
    if (!Number.isFinite(close) || close <= 0) {
      previous = null;
      changes = 0;
      avgGain = 0;
      avgLoss = 0;
      continue;
    }
    if (previous == null) {
      previous = close;
      continue;
    }
    const ch = close - previous;
    previous = close;
    const gain = Math.max(ch, 0);
    const loss = Math.max(-ch, 0);
    if (changes < period) {
      // Sum the divided terms to avoid overflowing on large finite prices.
      avgGain += gain / period;
      avgLoss += loss / period;
      changes++;
      if (changes < period) continue;
    } else {
      avgGain += (gain - avgGain) / period;
      avgLoss += (loss - avgLoss) / period;
    }
    if (avgGain === 0 && avgLoss === 0) out[i] = 50;
    else if (avgLoss === 0) out[i] = 100;
    else {
      const rs = avgGain / avgLoss;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

/** SMA/EMA of the RSI output, not a second RSI or a moving average of price. */
export function rsiWithSignal(
  closes: number[],
  period = 14,
  signalPeriod = 9,
  method: "sma" | "ema" = "sma",
): { rsi: (number | null)[]; signal: (number | null)[] } {
  const values = rsi(closes, period);
  const signal: (number | null)[] = new Array(values.length).fill(null);
  if (!Number.isSafeInteger(signalPeriod) || signalPeriod < 1) return { rsi: values, signal };
  const window: number[] = [];
  let count = 0;
  let sum = 0;
  let previous: number | null = null;
  const alpha = 2 / (signalPeriod + 1);
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value == null) {
      window.length = 0;
      count = 0;
      sum = 0;
      previous = null;
      continue;
    }
    if (method === "ema" && previous != null) {
      previous += alpha * (value - previous);
      signal[i] = previous;
      continue;
    }
    const slot = count % signalPeriod;
    sum -= window[slot] ?? 0;
    sum += value;
    window[slot] = value;
    count++;
    if (count >= signalPeriod) {
      previous = sum / signalPeriod;
      signal[i] = previous;
    }
  }
  return { rsi: values, signal };
}

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): {
  macd: (number | null)[];
  signal: (number | null)[];
  hist: (number | null)[];
} {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine: (number | null)[] = closes.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? emaFast[i]! - emaSlow[i]! : null,
  );
  // signal on non-null macd
  const compact: number[] = [];
  const idxMap: number[] = [];
  macdLine.forEach((v, i) => {
    if (v != null) {
      compact.push(v);
      idxMap.push(i);
    }
  });
  const sigCompact = ema(compact, signal);
  const signalLine: (number | null)[] = closes.map(() => null);
  const hist: (number | null)[] = closes.map(() => null);
  idxMap.forEach((orig, j) => {
    signalLine[orig] = sigCompact[j];
    if (macdLine[orig] != null && sigCompact[j] != null) {
      hist[orig] = macdLine[orig]! - sigCompact[j]!;
    }
  });
  return { macd: macdLine, signal: signalLine, hist };
}

export type MacdCrossKind = "golden" | "dead";

export type MacdCross = {
  kind: MacdCrossKind;
  label: string;
  index: number;
  macd: number;
  signal: number;
  /** MACD 값이 0 아래면 반등형, 위면 추세 지속형으로 읽습니다. */
  belowZero: boolean;
};

/**
 * MACD(12,26,9) line crossing the signal line.
 * Golden: previous bar MACD ≤ signal and this bar MACD > signal.
 * Dead: the opposite cross. Ties on the previous bar still count as a cross
 * when the current bar separates. The latest golden and latest dead inside
 * `maxAge` are kept. An unfinished bar is included because the cross is on
 * the close, not a future pivot.
 */
export function detectMacdCrosses(
  closes: number[],
  opts?: { fast?: number; slow?: number; signal?: number; maxAge?: number },
): MacdCross[] {
  const fast = opts?.fast ?? 12;
  const slow = opts?.slow ?? 26;
  const signalPeriod = opts?.signal ?? 9;
  const maxAge = opts?.maxAge ?? 40;
  if (closes.length < slow + signalPeriod) return [];
  const series = macd(closes, fast, slow, signalPeriod);
  let golden: MacdCross | null = null;
  let dead: MacdCross | null = null;
  for (let i = 1; i < closes.length; i++) {
    const prevMacd = series.macd[i - 1];
    const macdNow = series.macd[i];
    const prevSignal = series.signal[i - 1];
    const signalNow = series.signal[i];
    if (prevMacd == null || macdNow == null || prevSignal == null || signalNow == null) continue;
    const prevDiff = prevMacd - prevSignal;
    const nowDiff = macdNow - signalNow;
    if (prevDiff <= 0 && nowDiff > 0) {
      golden = {
        kind: "golden",
        label: macdNow < 0 ? "MACD 골든크로스 · 0선 아래" : "MACD 골든크로스 · 0선 위",
        index: i,
        macd: macdNow,
        signal: signalNow,
        belowZero: macdNow < 0,
      };
    } else if (prevDiff >= 0 && nowDiff < 0) {
      dead = {
        kind: "dead",
        label: macdNow > 0 ? "MACD 데드크로스 · 0선 위" : "MACD 데드크로스 · 0선 아래",
        index: i,
        macd: macdNow,
        signal: signalNow,
        belowZero: macdNow < 0,
      };
    }
  }
  const last = closes.length - 1;
  const out: MacdCross[] = [];
  if (golden && last - golden.index <= maxAge) out.push(golden);
  if (dead && last - dead.index <= maxAge) out.push(dead);
  out.sort((a, b) => b.index - a.index);
  return out;
}

/**
 * VWAP. For intraday, pass sessionKeys (e.g. YYYY-MM-DD) to reset each KRX session.
 * Without keys, computes one cumulative series (daily “anchored” style — label accordingly).
 */
export function vwap(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  sessionKeys?: string[],
): (number | null)[] {
  const out: (number | null)[] = [];
  let cumPV = 0;
  let cumV = 0;
  let prevKey: string | undefined;
  for (let i = 0; i < closes.length; i++) {
    const key = sessionKeys?.[i];
    if (key != null && prevKey != null && key !== prevKey) {
      cumPV = 0;
      cumV = 0;
    }
    if (key != null) prevKey = key;
    const tp = (highs[i]! + lows[i]! + closes[i]!) / 3;
    const v = Math.max(volumes[i]!, 0);
    cumPV += tp * v;
    cumV += v;
    out.push(cumV > 0 ? cumPV / cumV : null);
  }
  return out;
}

/** Last non-null ATR value helper */
export function lastNumber(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i]!;
  }
  return null;
}

/** Pivot highs/lows for auto support & resistance. */
export function findPivots(
  highs: number[],
  lows: number[],
  left = 3,
  right = 3,
): { highIdx: number[]; lowIdx: number[] } {
  const highIdx: number[] = [];
  const lowIdx: number[] = [];
  for (let i = left; i < highs.length - right; i++) {
    let isH = true;
    let isL = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (highs[j]! > highs[i]!) isH = false;
      if (lows[j]! < lows[i]!) isL = false;
    }
    if (isH) highIdx.push(i);
    if (isL) lowIdx.push(i);
  }
  return { highIdx, lowIdx };
}

export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): (number | null)[] {
  const tr: number[] = [];
  for (let i = 0; i < highs.length; i++) {
    if (i === 0) tr.push(highs[i]! - lows[i]!);
    else {
      tr.push(
        Math.max(
          highs[i]! - lows[i]!,
          Math.abs(highs[i]! - closes[i - 1]!),
          Math.abs(lows[i]! - closes[i - 1]!),
        ),
      );
    }
  }
  return sma(tr, period);
}

export type RangeBar = {
  high: number;
  low: number;
  close: number;
  date?: string;
};

export type RangePositionStats = {
  close: number;
  periodHigh: number;
  periodLow: number;
  periodHighDate: string | null;
  periodLowDate: string | null;
  periodHighIdx: number;
  periodLowIdx: number;
  recentHigh: number;
  recentLow: number;
  recentHighDate: string | null;
  recentLowDate: string | null;
  recentHighIdx: number;
  recentLowIdx: number;
  /** (close − 기간저) / 기간저 × 100 */
  fromPeriodLowPct: number;
  /** (close − 기간고) / 기간고 × 100 — typically ≤ 0 */
  fromPeriodHighPct: number;
  fromRecentHighPct: number;
  fromRecentLowPct: number;
};

function pctChange(now: number, ref: number): number {
  if (!(ref > 0) || !Number.isFinite(now)) return Number.NaN;
  return ((now - ref) / ref) * 100;
}

export type RecentSpan = "3M" | "6M" | "52W" | "all" | "swing";

function recentWindowStart(bars: RangeBar[], from: number, to: number, span: Exclude<RecentSpan, "swing">): number {
  if (span === "all") return from;
  const last = bars[to]?.date;
  const days = span === "3M" ? 92 : span === "6M" ? 183 : 366;
  const endMs = last ? Date.parse(last.slice(0, 10)) : Number.NaN;
  if (!Number.isFinite(endMs)) {
    const n = span === "3M" ? 63 : span === "6M" ? 126 : 252;
    return Math.max(from, to - n + 1);
  }
  const cut = endMs - days * 86_400_000;
  for (let i = from; i <= to; i++) {
    const d = Date.parse((bars[i]?.date ?? "").slice(0, 10));
    if (Number.isFinite(d) && d >= cut) return i;
  }
  return from;
}

/**
 * Desk-style range position vs current price.
 * Period high/low = extrema of [from, to].
 * Recent high/low default to the last confirmed swing. Pass `recentSpan`
 * (`3M`/`6M`/`52W`/`all`) to use a trailing calendar window instead.
 */
export function computeRangePosition(
  bars: RangeBar[],
  opts?: {
    from?: number;
    to?: number;
    close?: number;
    pivotLeft?: number;
    pivotRight?: number;
    recentSpan?: RecentSpan;
  },
): RangePositionStats | null {
  if (!bars.length) return null;
  const from = Math.max(0, Math.floor(opts?.from ?? 0));
  const to = Math.min(bars.length - 1, Math.floor(opts?.to ?? bars.length - 1));
  if (to < from) return null;

  const close = opts?.close ?? bars[bars.length - 1]!.close;
  if (!(close > 0) || !Number.isFinite(close)) return null;

  let periodHigh = -Infinity;
  let periodLow = Infinity;
  let periodHighIdx = from;
  let periodLowIdx = from;
  for (let i = from; i <= to; i++) {
    const b = bars[i]!;
    if (b.high >= periodHigh) {
      periodHigh = b.high;
      periodHighIdx = i;
    }
    if (b.low <= periodLow) {
      periodLow = b.low;
      periodLowIdx = i;
    }
  }
  if (!(periodHigh > 0) || !(periodLow > 0) || !Number.isFinite(periodHigh)) {
    return null;
  }

  const span = opts?.recentSpan ?? "swing";
  let recentHighIdx = periodHighIdx;
  let recentLowIdx = periodLowIdx;
  if (span === "swing") {
    const n = to - from + 1;
    const left = opts?.pivotLeft ?? Math.max(3, Math.min(8, Math.floor(n / 40) || 3));
    const right = opts?.pivotRight ?? left;
    const highs: number[] = [];
    const lows: number[] = [];
    for (let i = from; i <= to; i++) {
      highs.push(bars[i]!.high);
      lows.push(bars[i]!.low);
    }
    const piv = findPivots(highs, lows, left, right);
    recentHighIdx = piv.highIdx.length > 0 ? from + piv.highIdx[piv.highIdx.length - 1]! : periodHighIdx;
    recentLowIdx = piv.lowIdx.length > 0 ? from + piv.lowIdx[piv.lowIdx.length - 1]! : periodLowIdx;
    const winStart = from + Math.max(0, n - Math.max(8, Math.floor(n * 0.2)));
    if (piv.highIdx.length === 0) {
      let h = -Infinity;
      let hi = winStart;
      for (let i = winStart; i <= to; i++) {
        if (bars[i]!.high >= h) {
          h = bars[i]!.high;
          hi = i;
        }
      }
      recentHighIdx = hi;
    }
    if (piv.lowIdx.length === 0) {
      let l = Infinity;
      let li = winStart;
      for (let i = winStart; i <= to; i++) {
        if (bars[i]!.low <= l) {
          l = bars[i]!.low;
          li = i;
        }
      }
      recentLowIdx = li;
    }
  } else {
    const start = recentWindowStart(bars, from, to, span);
    let h = -Infinity;
    let l = Infinity;
    for (let i = start; i <= to; i++) {
      const b = bars[i]!;
      if (b.high >= h) {
        h = b.high;
        recentHighIdx = i;
      }
      if (b.low <= l) {
        l = b.low;
        recentLowIdx = i;
      }
    }
  }

  const recentHigh = bars[recentHighIdx]!.high;
  const recentLow = bars[recentLowIdx]!.low;
  const dateOf = (i: number) => bars[i]?.date?.slice(0, 16) ?? null;

  return {
    close,
    periodHigh,
    periodLow,
    periodHighDate: dateOf(periodHighIdx),
    periodLowDate: dateOf(periodLowIdx),
    periodHighIdx,
    periodLowIdx,
    recentHigh,
    recentLow,
    recentHighDate: dateOf(recentHighIdx),
    recentLowDate: dateOf(recentLowIdx),
    recentHighIdx,
    recentLowIdx,
    fromPeriodLowPct: pctChange(close, periodLow),
    fromPeriodHighPct: pctChange(close, periodHigh),
    fromRecentHighPct: pctChange(close, recentHigh),
    fromRecentLowPct: pctChange(close, recentLow),
  };
}

export type RangeMarkerPlan = {
  role: "high" | "low";
  /** both = period extreme is the same bar as the recent swing. */
  scope: "period" | "recent" | "both";
  idx: number;
  price: number;
  date: string | null;
  /** Signed percent from this level to the current close. */
  pct: number;
};

/** One marker per distinct high and low. Recent labels sit near the last price when they differ. */
export function planRangeMarkers(stats: RangePositionStats): RangeMarkerPlan[] {
  const highSame = stats.periodHighIdx === stats.recentHighIdx;
  const lowSame = stats.periodLowIdx === stats.recentLowIdx;
  const out: RangeMarkerPlan[] = [
    {
      role: "high",
      scope: highSame ? "both" : "period",
      idx: stats.periodHighIdx,
      price: stats.periodHigh,
      date: stats.periodHighDate,
      pct: stats.fromPeriodHighPct,
    },
    {
      role: "low",
      scope: lowSame ? "both" : "period",
      idx: stats.periodLowIdx,
      price: stats.periodLow,
      date: stats.periodLowDate,
      pct: stats.fromPeriodLowPct,
    },
  ];
  if (!highSame) {
    out.push({
      role: "high",
      scope: "recent",
      idx: stats.recentHighIdx,
      price: stats.recentHigh,
      date: stats.recentHighDate,
      pct: stats.fromRecentHighPct,
    });
  }
  if (!lowSame) {
    out.push({
      role: "low",
      scope: "recent",
      idx: stats.recentLowIdx,
      price: stats.recentLow,
      date: stats.recentLowDate,
      pct: stats.fromRecentLowPct,
    });
  }
  return out;
}

/** Canvas copy shared by the price chart and the export chart so the wording cannot drift. */
export function rangeMarkerText(
  plan: RangeMarkerPlan,
  priceText: string,
  pctText: string,
): { place: "extreme" | "last"; title: string; pctText: string } {
  const date = plan.date?.slice(0, 10) ?? "";
  const place = plan.scope === "recent" ? "last" : "extreme";
  const head =
    plan.role === "high"
      ? plan.scope === "both"
        ? "기간=최근 고점"
        : plan.scope === "period"
          ? "기간고점"
          : "최근고점"
      : plan.scope === "both"
        ? "기간=최근 저점"
        : plan.scope === "period"
          ? "기간저점"
          : "최근저점";
  const rel =
    plan.role === "high"
      ? plan.pct > 0.005
        ? `돌파 ${pctText}`
        : plan.scope === "recent"
          ? `최근고점 대비 ${pctText}`
          : `최고점대비 ${pctText}`
      : plan.scope === "recent"
        ? `최근저점 대비 ${pctText}`
        : `최저점대비 ${pctText}`;
  return { place, title: [head, date, priceText].filter(Boolean).join(" "), pctText: rel };
}

/** Line-series variant (export desk, flow). High = low = close = value. */
export function computeSeriesRangePosition(
  points: { value: number; date?: string }[],
  close?: number,
  opts?: { recentSpan?: RecentSpan },
): RangePositionStats | null {
  const bars: RangeBar[] = points
    .filter((p) => Number.isFinite(p.value) && p.value !== 0)
    .map((p) => ({
      high: p.value,
      low: p.value,
      close: p.value,
      date: p.date,
    }));
  return computeRangePosition(bars, {
    ...(close != null ? { close } : {}),
    ...(opts?.recentSpan ? { recentSpan: opts.recentSpan } : {}),
  });
}

export type StreetTape = {
  lookback: number;
  barsUsed: number;
  high: number;
  low: number;
  highDate: string | null;
  lowDate: string | null;
  /** (close − 52w high) / high × 100. Typically ≤ 0. */
  offHighPct: number;
  /** (close − 52w low) / low × 100. Typically ≥ 0. */
  offLowPct: number;
  /** 0 = at the low, 100 = at the high. */
  rangeLocation: number;
  sma50: number | null;
  sma200: number | null;
  vsSma50Pct: number | null;
  vsSma200Pct: number | null;
  /** Last volume ÷ prior 20-bar average. Null when volume is absent. */
  relVolume: number | null;
};

/**
 * Fixed-window desk tape. Daily charts pass 252 bars (52 weeks).
 * Weekly valuation series pass 52. This does not move when the user zooms.
 */
export function streetTape(
  bars: (RangeBar & { volume?: number })[],
  opts?: { lookback?: number },
): StreetTape | null {
  if (bars.length < 2) return null;
  const close = bars[bars.length - 1]!.close;
  if (!(close > 0) || !Number.isFinite(close)) return null;
  const lookback = Math.max(2, Math.floor(opts?.lookback ?? Math.min(252, bars.length)));
  const start = Math.max(0, bars.length - lookback);
  const window = bars.slice(start);
  let high = -Infinity;
  let low = Infinity;
  let highDate: string | null = null;
  let lowDate: string | null = null;
  for (const bar of window) {
    if (bar.high >= high) {
      high = bar.high;
      highDate = bar.date?.slice(0, 10) ?? null;
    }
    if (bar.low > 0 && bar.low <= low) {
      low = bar.low;
      lowDate = bar.date?.slice(0, 10) ?? null;
    }
  }
  if (!(high > 0) || !(low > 0) || !Number.isFinite(high) || !Number.isFinite(low)) return null;
  const closes = bars.map((bar) => bar.close);
  const s50 = sma(closes, 50);
  const s200 = sma(closes, 200);
  const sma50 = s50[s50.length - 1] ?? null;
  const sma200 = s200[s200.length - 1] ?? null;
  let relVolume: number | null = null;
  const vols = bars.map((bar) => bar.volume ?? 0);
  const lastVol = vols[vols.length - 1] ?? 0;
  if (vols.length >= 21 && lastVol > 0) {
    let sum = 0;
    let n = 0;
    for (let i = vols.length - 21; i < vols.length - 1; i++) {
      if (vols[i]! > 0) {
        sum += vols[i]!;
        n += 1;
      }
    }
    if (n >= 10 && sum > 0) relVolume = lastVol / (sum / n);
  }
  const span = high - low;
  return {
    lookback,
    barsUsed: window.length,
    high,
    low,
    highDate,
    lowDate,
    offHighPct: pctChange(close, high),
    offLowPct: pctChange(close, low),
    rangeLocation: span > 0 ? ((close - low) / span) * 100 : 100,
    sma50: sma50 != null && sma50 > 0 ? sma50 : null,
    sma200: sma200 != null && sma200 > 0 ? sma200 : null,
    vsSma50Pct: sma50 != null && sma50 > 0 ? pctChange(close, sma50) : null,
    vsSma200Pct: sma200 != null && sma200 > 0 ? pctChange(close, sma200) : null,
    relVolume,
  };
}

/** Linear interpolation percentile. `q` is 0–1. `sorted` must be ascending. */
export function linearPercentile(sorted: number[], q: number): number {
  if (!sorted.length) return Number.NaN;
  const clamped = Math.min(1, Math.max(0, q));
  const pos = (sorted.length - 1) * clamped;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  const w = pos - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

/**
 * Rolling close percentile channel. Each point uses only the past `window`
 * closes (no look-ahead). Needs 20 positive prints before a band is drawn.
 */
export function rollingPercentileBands(
  values: number[],
  window = 120,
): { p10: (number | null)[]; p50: (number | null)[]; p90: (number | null)[] } {
  const p10: (number | null)[] = [];
  const p50: (number | null)[] = [];
  const p90: (number | null)[] = [];
  const span = Math.max(20, Math.floor(window));
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - span + 1);
    const slice = values.slice(start, i + 1).filter((v) => Number.isFinite(v) && v > 0);
    if (slice.length < 20) {
      p10.push(null);
      p50.push(null);
      p90.push(null);
      continue;
    }
    slice.sort((a, b) => a - b);
    p10.push(linearPercentile(slice, 0.1));
    p50.push(linearPercentile(slice, 0.5));
    p90.push(linearPercentile(slice, 0.9));
  }
  return { p10, p50, p90 };
}

/** Share of positive values at or below the last one, 0–100. Null until 8 prints. */
export function closePercentile(values: number[]): number | null {
  const xs = values.filter((v) => Number.isFinite(v) && v > 0);
  if (xs.length < 8) return null;
  const last = xs[xs.length - 1]!;
  let le = 0;
  for (const v of xs) if (v <= last) le += 1;
  return (le / xs.length) * 100;
}

/** 이격도 = 종가 / 이평 × 100. 100이면 이평과 같다. */
export function disparity(closes: number[], period: number): (number | null)[] {
  const ma = sma(closes, period);
  return closes.map((c, i) => (ma[i] != null && ma[i]! > 0 ? (c / ma[i]!) * 100 : null));
}

/** Fast stochastic. %K uses the high-low range; %D is an SMA of %K. */
export function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod = 14,
  dPeriod = 3,
): { k: (number | null)[]; d: (number | null)[] } {
  const k: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i + 1 < kPeriod) {
      k.push(null);
      continue;
    }
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (highs[j]! > hh) hh = highs[j]!;
      if (lows[j]! < ll) ll = lows[j]!;
    }
    const span = hh - ll;
    k.push(span > 0 ? ((closes[i]! - ll) / span) * 100 : null);
  }
  const d: (number | null)[] = [];
  for (let i = 0; i < k.length; i++) {
    if (i + 1 < dPeriod) {
      d.push(null);
      continue;
    }
    let sum = 0;
    let n = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      if (k[j] == null) continue;
      sum += k[j]!;
      n += 1;
    }
    d.push(n === dPeriod ? sum / dPeriod : null);
  }
  return { k, d };
}

/** 투자심리선: 최근 N봉 중 상승 봉 비율 × 100. */
export function psychologicalLine(closes: number[], period = 12): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      out.push(null);
      continue;
    }
    let up = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (closes[j]! > closes[j - 1]!) up += 1;
    }
    out.push((up / period) * 100);
  }
  return out;
}

export type QuantSnapshot = {
  bars: number;
  totalReturnPct: number;
  /** Annualized if periodsPerYear is set, otherwise the per-bar stdev × 100. */
  volPct: number | null;
  volAnnualized: boolean;
  /** Most negative peak-to-trough in the loaded window, ≤ 0. */
  maxDrawdownPct: number;
  /** Last close vs its running peak, ≤ 0. */
  currentDrawdownPct: number;
  fromLowPct: number;
  closePercentile: number | null;
  disparity20: number | null;
  stochasticK: number | null;
  stochasticD: number | null;
  psych12: number | null;
};

function sampleStdev(xs: number[]): number | null {
  if (xs.length < 2) return null;
  let mean = 0;
  for (const x of xs) mean += x;
  mean /= xs.length;
  let acc = 0;
  for (const x of xs) {
    const d = x - mean;
    acc += d * d;
  }
  return Math.sqrt(acc / (xs.length - 1));
}

/**
 * Window statistics used on stock and ETF charts.
 * Volatility is the sample stdev of log returns. It is annualized only when
 * `periodsPerYear` is the bar frequency (252 daily, 52 weekly, 12 monthly).
 */
export function quantSnapshot(
  bars: { high: number; low: number; close: number }[],
  periodsPerYear: number | null,
): QuantSnapshot | null {
  if (bars.length < 8) return null;
  const closes = bars.map((b) => b.close);
  const first = closes[0]!;
  const last = closes[closes.length - 1]!;
  if (!(first > 0) || !(last > 0)) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]!;
    const cur = closes[i]!;
    if (prev > 0 && cur > 0) rets.push(Math.log(cur / prev));
  }
  const sd = sampleStdev(rets);
  const volPct =
    sd == null ? null : periodsPerYear != null && periodsPerYear > 0 ? sd * Math.sqrt(periodsPerYear) * 100 : sd * 100;
  let peak = closes[0]!;
  let trough = closes[0]!;
  let maxDd = 0;
  let currentDd = 0;
  for (const c of closes) {
    if (!(c > 0)) continue;
    if (c > peak) peak = c;
    if (c < trough) trough = c;
    const dd = (c / peak - 1) * 100;
    if (dd < maxDd) maxDd = dd;
    currentDd = dd;
  }
  const disp = disparity(closes, 20);
  const st = stochastic(
    bars.map((b) => b.high),
    bars.map((b) => b.low),
    closes,
  );
  const psych = psychologicalLine(closes, 12);
  return {
    bars: bars.length,
    totalReturnPct: ((last - first) / first) * 100,
    volPct,
    volAnnualized: periodsPerYear != null && periodsPerYear > 0,
    maxDrawdownPct: maxDd,
    currentDrawdownPct: currentDd,
    fromLowPct: trough > 0 ? ((last - trough) / trough) * 100 : Number.NaN,
    closePercentile: closePercentile(closes),
    disparity20: disp[disp.length - 1] ?? null,
    stochasticK: st.k[st.k.length - 1] ?? null,
    stochasticD: st.d[st.d.length - 1] ?? null,
    psych12: psych[psych.length - 1] ?? null,
  };
}

export type BandCompare = {
  close: number;
  bbMid: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  /** (종가 − 하단) / (상단 − 하단). 1보다 크면 볼린저 상단 밖. */
  percentB: number | null;
  bbWidthPct: number | null;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  /** 백분위 창 안에서 현재 종가의 순위, 0–100. */
  pctRank: number | null;
  window: number;
  note: string;
};

/**
 * Bollinger is a 20-bar mean ± 2 sample-style σ (population σ of that window).
 * Percentile bands are the empirical 10/50/90 of the longer window.
 * They diverge when the short window is skewed or the longer window has fat tails.
 */
export function compareBollingerAndPercentile(
  closes: number[],
  bbPeriod = 20,
  bbMult = 2,
  pctWindow = 120,
): BandCompare | null {
  if (closes.length < bbPeriod) return null;
  const close = closes[closes.length - 1]!;
  if (!(close > 0)) return null;
  const bb = bollinger(closes, bbPeriod, bbMult);
  const upper = bb.upper[bb.upper.length - 1] ?? null;
  const lower = bb.lower[bb.lower.length - 1] ?? null;
  const mid = bb.mid[bb.mid.length - 1] ?? null;
  const span = upper != null && lower != null ? upper - lower : null;
  const percentB = span != null && span > 0 ? (close - lower!) / span : null;
  const bbWidthPct = span != null && mid != null && mid > 0 ? (span / mid) * 100 : null;
  const bands = rollingPercentileBands(closes, pctWindow);
  const p10 = bands.p10[bands.p10.length - 1] ?? null;
  const p50 = bands.p50[bands.p50.length - 1] ?? null;
  const p90 = bands.p90[bands.p90.length - 1] ?? null;
  const start = Math.max(0, closes.length - Math.max(20, pctWindow));
  const pctRank = closePercentile(closes.slice(start));
  let note =
    "볼린저는 최근 20봉 평균±2σ입니다. 백분위는 더 긴 구간의 종가 10·50·90%로, 분포를 정규라고 가정하지 않습니다.";
  const aboveBb = percentB != null && percentB > 1;
  const belowBb = percentB != null && percentB < 0;
  const highPct = pctRank != null && pctRank >= 90;
  const lowPct = pctRank != null && pctRank <= 10;
  if (aboveBb && !highPct) {
    note = "단기 볼린저 상단 밖이지만, 긴 구간 백분위는 아직 상위 10%가 아닙니다. σ 밴드와 경험적 분포가 어긋난 상태입니다.";
  } else if (belowBb && !lowPct) {
    note = "단기 볼린저 하단 밖이지만, 긴 구간 백분위는 하위 10%가 아닙니다. 단기 변동성만 크게 벗어난 상태입니다.";
  } else if (aboveBb && highPct) {
    note = "볼린저 상단과 백분위 상단이 같이 위에 있습니다. 단기 σ와 중기 분포가 모두 비싼 쪽입니다.";
  } else if (belowBb && lowPct) {
    note = "볼린저 하단과 백분위 하단이 같이 아래에 있습니다. 단기 σ와 중기 분포가 모두 싼 쪽입니다.";
  } else if (percentB != null && percentB > 0.8 && pctRank != null && pctRank < 60) {
    note = "볼린저 %b는 상단에 가깝고 백분위 순위는 중간입니다. 최근 20봉 변동성이 줄며 밴드가 좁아진 경우입니다.";
  }
  return {
    close,
    bbMid: mid,
    bbUpper: upper,
    bbLower: lower,
    percentB,
    bbWidthPct,
    p10,
    p50,
    p90,
    pctRank,
    window: Math.min(pctWindow, closes.length),
    note,
  };
}

export type DivergenceKind = "regular-bullish" | "regular-bearish" | "hidden-bullish" | "hidden-bearish";

export type RsiDivergence = {
  kind: DivergenceKind;
  label: string;
  i1: number;
  i2: number;
  price1: number;
  price2: number;
  rsi1: number;
  rsi2: number;
};

const DIVERGENCE_LABEL: Record<DivergenceKind, string> = {
  "regular-bullish": "정규 상승 다이버전스",
  "regular-bearish": "정규 하락 다이버전스",
  "hidden-bullish": "히든 상승 다이버전스",
  "hidden-bearish": "히든 하락 다이버전스",
};

/**
 * Compare two confirmed swings.
 * Lows: later price lower + RSI higher = regular bullish. Later price higher + RSI lower = hidden bullish.
 * Highs: later price higher + RSI lower = regular bearish. Later price lower + RSI higher = hidden bearish.
 * Equal prices or equal RSI are not a divergence.
 */
export function classifySwingDivergence(
  side: "low" | "high",
  earlierPrice: number,
  laterPrice: number,
  earlierRsi: number,
  laterRsi: number,
): DivergenceKind | null {
  if (![earlierPrice, laterPrice, earlierRsi, laterRsi].every((n) => Number.isFinite(n))) return null;
  if (side === "low") {
    if (laterPrice < earlierPrice && laterRsi > earlierRsi) return "regular-bullish";
    if (laterPrice > earlierPrice && laterRsi < earlierRsi) return "hidden-bullish";
    return null;
  }
  if (laterPrice > earlierPrice && laterRsi < earlierRsi) return "regular-bearish";
  if (laterPrice < earlierPrice && laterRsi > earlierRsi) return "hidden-bearish";
  return null;
}

/**
 * RSI divergence from confirmed pivots only.
 * A pivot needs `right` bars after it, so the signal does not use an unfinished swing.
 * On each side the latest regular pair and the latest hidden pair are kept,
 * scanning the last six adjacent swings, and only if the later pivot is inside `maxAge`.
 * Hidden bullish: higher price low, lower RSI low (uptrend continuation).
 * Hidden bearish: lower price high, higher RSI high (downtrend continuation).
 */
export function detectRsiDivergences(
  highs: number[],
  lows: number[],
  closes: number[],
  opts?: { rsiPeriod?: number; left?: number; right?: number; maxAge?: number },
): RsiDivergence[] {
  const rsiPeriod = opts?.rsiPeriod ?? 14;
  const left = opts?.left ?? 5;
  const right = opts?.right ?? 5;
  const maxAge = opts?.maxAge ?? 40;
  if (closes.length < rsiPeriod + left + right + 2) return [];
  const rsi = rsiOf(closes, rsiPeriod);
  const pivots = findPivots(highs, lows, left, right);
  const out: RsiDivergence[] = [];
  const consider = (idxs: number[], side: "low" | "high", priceOf: number[]) => {
    const usable = idxs.filter((i) => rsi[i] != null && Number.isFinite(priceOf[i]!));
    if (usable.length < 2) return;
    let latestRegular: RsiDivergence | null = null;
    let latestHidden: RsiDivergence | null = null;
    const start = Math.max(1, usable.length - 6);
    for (let k = usable.length - 1; k >= start; k--) {
      const i2 = usable[k]!;
      const i1 = usable[k - 1]!;
      if (closes.length - 1 - i2 > maxAge) continue;
      if (i2 - i1 < left) continue;
      const kind = classifySwingDivergence(side, priceOf[i1]!, priceOf[i2]!, rsi[i1]!, rsi[i2]!);
      if (!kind) continue;
      const item: RsiDivergence = {
        kind,
        label: DIVERGENCE_LABEL[kind],
        i1,
        i2,
        price1: priceOf[i1]!,
        price2: priceOf[i2]!,
        rsi1: rsi[i1]!,
        rsi2: rsi[i2]!,
      };
      if (kind.startsWith("hidden")) {
        if (!latestHidden) latestHidden = item;
      } else if (!latestRegular) {
        latestRegular = item;
      }
      if (latestHidden && latestRegular) break;
    }
    if (latestHidden) out.push(latestHidden);
    if (latestRegular) out.push(latestRegular);
  };
  consider(pivots.lowIdx, "low", lows);
  consider(pivots.highIdx, "high", highs);
  return out;
}

function rsiOf(closes: number[], period: number): (number | null)[] {
  return rsi(closes, period);
}

// ── F7.6 extended indicator set (pure; known-value tests in chart-indicators.test.ts) ──

type Series = (number | null)[];

/** Weighted moving average (weights 1..period, newest heaviest). */
export function wma(values: number[], period: number): Series {
  const out: Series = [];
  const denom = (period * (period + 1)) / 2;
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      out.push(null);
      continue;
    }
    let s = 0;
    for (let j = 0; j < period; j++) s += values[i - period + 1 + j]! * (j + 1);
    out.push(s / denom);
  }
  return out;
}

function wmaSparse(values: Series, period: number): Series {
  const out: Series = [];
  const denom = (period * (period + 1)) / 2;
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      out.push(null);
      continue;
    }
    let s = 0;
    let ok = true;
    for (let j = 0; j < period; j++) {
      const v = values[i - period + 1 + j];
      if (v == null) {
        ok = false;
        break;
      }
      s += v * (j + 1);
    }
    out.push(ok ? s / denom : null);
  }
  return out;
}

/** Hull moving average: WMA(2·WMA(n/2) − WMA(n), √n). */
export function hma(values: number[], period: number): Series {
  const half = wma(values, Math.max(1, Math.floor(period / 2)));
  const full = wma(values, period);
  const diff: Series = values.map((_, i) => (half[i] != null && full[i] != null ? 2 * half[i]! - full[i]! : null));
  return wmaSparse(diff, Math.max(1, Math.floor(Math.sqrt(period))));
}

/** True range (first bar: high − low). */
export function trueRange(highs: number[], lows: number[], closes: number[]): number[] {
  return highs.map((h, i) =>
    i === 0 ? h - lows[i]! : Math.max(h - lows[i]!, Math.abs(h - closes[i - 1]!), Math.abs(lows[i]! - closes[i - 1]!)),
  );
}

/** Wilder smoothing (RMA): first value = SMA of the first `period`, then (prev·(n−1)+x)/n. */
export function rma(values: number[], period: number): Series {
  const out: Series = [];
  let prev: number | null = null;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (prev == null) {
      sum += values[i]!;
      if (i + 1 === period) {
        prev = sum / period;
        out.push(prev);
      } else out.push(null);
      continue;
    }
    prev = (prev * (period - 1) + values[i]!) / period;
    out.push(prev);
  }
  return out;
}

/** Keltner channel: EMA(close) ± mult · ATR (Wilder). */
export function keltner(highs: number[], lows: number[], closes: number[], emaPeriod = 20, atrPeriod = 10, mult = 2): { mid: Series; upper: Series; lower: Series } {
  const mid = ema(closes, emaPeriod);
  const a = rma(trueRange(highs, lows, closes), atrPeriod);
  return {
    mid,
    upper: mid.map((m, i) => (m != null && a[i] != null ? m + mult * a[i]! : null)),
    lower: mid.map((m, i) => (m != null && a[i] != null ? m - mult * a[i]! : null)),
  };
}

function rollingMax(values: number[], period: number): Series {
  return values.map((_, i) => (i + 1 < period ? null : Math.max(...values.slice(i - period + 1, i + 1))));
}

function rollingMin(values: number[], period: number): Series {
  return values.map((_, i) => (i + 1 < period ? null : Math.min(...values.slice(i - period + 1, i + 1))));
}

/** Donchian channel: highest high / lowest low over `period`, mid = average. */
export function donchian(highs: number[], lows: number[], period = 20): { upper: Series; lower: Series; mid: Series } {
  const upper = rollingMax(highs, period);
  const lower = rollingMin(lows, period);
  return { upper, lower, mid: upper.map((u, i) => (u != null && lower[i] != null ? (u + lower[i]!) / 2 : null)) };
}

/**
 * Ichimoku. `spanA`/`spanB` are plotted `displacement` bars ahead: index i
 * holds the value computed at i − displacement (no bars are projected past
 * the last real bar). `chikou` at i is close[i + displacement].
 */
export function ichimoku(highs: number[], lows: number[], closes: number[], tenkanP = 9, kijunP = 26, spanBP = 52, displacement = 26) {
  const mid = (p: number) => {
    const hi = rollingMax(highs, p);
    const lo = rollingMin(lows, p);
    return hi.map((h, i) => (h != null && lo[i] != null ? (h + lo[i]!) / 2 : null));
  };
  const tenkan = mid(tenkanP);
  const kijun = mid(kijunP);
  const rawB = mid(spanBP);
  const rawA: Series = tenkan.map((t, i) => (t != null && kijun[i] != null ? (t + kijun[i]!) / 2 : null));
  const shift = (s: Series): Series => s.map((_, i) => (i - displacement >= 0 ? s[i - displacement]! : null));
  const chikou: Series = closes.map((_, i) => (i + displacement < closes.length ? closes[i + displacement]! : null));
  return { tenkan, kijun, spanA: shift(rawA), spanB: shift(rawB), chikou };
}

/** Parabolic SAR (Wilder): step/max acceleration. First value at index 1. */
export function parabolicSar(highs: number[], lows: number[], step = 0.02, maxStep = 0.2): Series {
  const n = highs.length;
  const out: Series = new Array(n).fill(null);
  if (n < 2) return out;
  let up = highs[1]! + lows[1]! >= highs[0]! + lows[0]!;
  let sar = up ? lows[0]! : highs[0]!;
  let ep = up ? highs[1]! : lows[1]!;
  let af = step;
  out[1] = sar;
  for (let i = 2; i < n; i++) {
    sar = sar + af * (ep - sar);
    if (up) {
      sar = Math.min(sar, lows[i - 1]!, lows[i - 2]!);
      if (lows[i]! < sar) {
        up = false;
        sar = ep;
        ep = lows[i]!;
        af = step;
      } else if (highs[i]! > ep) {
        ep = highs[i]!;
        af = Math.min(af + step, maxStep);
      }
    } else {
      sar = Math.max(sar, highs[i - 1]!, highs[i - 2]!);
      if (highs[i]! > sar) {
        up = true;
        sar = ep;
        ep = highs[i]!;
        af = step;
      } else if (lows[i]! < ep) {
        ep = lows[i]!;
        af = Math.min(af + step, maxStep);
      }
    }
    out[i] = sar;
  }
  return out;
}

/** Supertrend (ATR Wilder). direction 1 = up (line below price), −1 = down. */
export function supertrend(highs: number[], lows: number[], closes: number[], period = 10, mult = 3): { value: Series; direction: (1 | -1 | null)[] } {
  const a = rma(trueRange(highs, lows, closes), period);
  const value: Series = [];
  const direction: (1 | -1 | null)[] = [];
  let fu = 0;
  let fl = 0;
  let dir: 1 | -1 = 1;
  let started = false;
  for (let i = 0; i < closes.length; i++) {
    if (a[i] == null) {
      value.push(null);
      direction.push(null);
      continue;
    }
    const hl2 = (highs[i]! + lows[i]!) / 2;
    const bu = hl2 + mult * a[i]!;
    const bl = hl2 - mult * a[i]!;
    if (!started) {
      fu = bu;
      fl = bl;
      dir = closes[i]! >= hl2 ? 1 : -1;
      started = true;
    } else {
      const pc = closes[i - 1]!;
      fu = bu < fu || pc > fu ? bu : fu;
      fl = bl > fl || pc < fl ? bl : fl;
      if (dir === -1 && closes[i]! > fu) dir = 1;
      else if (dir === 1 && closes[i]! < fl) dir = -1;
    }
    value.push(dir === 1 ? fl : fu);
    direction.push(dir);
  }
  return { value, direction };
}

/** Anchored VWAP from `anchor` (inclusive); null before the anchor. */
export function anchoredVwap(highs: number[], lows: number[], closes: number[], volumes: number[], anchor: number): Series {
  const out: Series = [];
  let pv = 0;
  let v = 0;
  for (let i = 0; i < closes.length; i++) {
    if (i < anchor) {
      out.push(null);
      continue;
    }
    const vol = Math.max(volumes[i]!, 0);
    pv += ((highs[i]! + lows[i]! + closes[i]!) / 3) * vol;
    v += vol;
    out.push(v > 0 ? pv / v : null);
  }
  return out;
}

/** On-balance volume (starts at 0). */
export function obv(closes: number[], volumes: number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < closes.length; i++) {
    if (i > 0) {
      if (closes[i]! > closes[i - 1]!) acc += volumes[i]!;
      else if (closes[i]! < closes[i - 1]!) acc -= volumes[i]!;
    }
    out.push(acc);
  }
  return out;
}

export interface VolumeProfile {
  /** `volume` uses the selected basis for compatibility with existing callers. */
  rows: { low: number; high: number; volume: number; percent: number }[];
  poc: number | null;
  vah: number | null;
  val: number | null;
  /** Valid input volume, in the input's own quantity unit, even for turnover. */
  totalVolume: number;
  /** Sum of all bins in the selected basis; the denominator for every percent. */
  totalValue: number;
  excludedBars: number;
  validBars: number;
  method: "ohlcv-overlap";
  basis: "volume" | "turnover";
}

/**
 * OHLCV estimate over exactly the bars supplied, using linear price bins.
 * For H > L, allocate V * overlap([L,H], bin) / (H-L), with no early rounding.
 * A point bar belongs to [low,high), except the top bin also includes its high.
 * A wholly single-price sample has one degenerate inclusive bin at that price.
 * POC is the midpoint of the largest bin. Both POC ties and adjacent value-area
 * ties prefer the lower price. VAL/VAH are the final included bin boundaries.
 *
 * Validation: high/low must be finite positive prices with high >= low; any
 * supplied open/close must lie within that range. Volume must be finite and
 * nonnegative. Invalid bars (including arithmetic overflow) are excluded and
 * counted, never replaced with zero. Valid zero-volume bars are counted; a
 * sample with no positive volume has no profile/POC/value area. One bar suffices.
 * Turnover retains the existing close * volume (midpoint when close omitted)
 * estimate. `totalVolume` still reports raw volume, `totalValue` that basis.
 *
 * Row count is bounded to 1..1000 (non-finite => 24); valueArea to 0..1.
 * Adjustment/source/quantity-unit metadata belongs to the caller: this pure
 * calculation cannot verify price or volume adjustment consistency. Supply one
 * consistent source and period; neither viewport nor price zoom is an input.
 */
export function volumeProfile(
  bars: { high: number; low: number; volume: number; volumeValid?: boolean; open?: number; close?: number }[],
  rowCount = 24,
  valueArea = 0.7,
  basis: "volume" | "turnover" = "volume",
): VolumeProfile {
  const result: VolumeProfile = {
    rows: [], poc: null, vah: null, val: null,
    totalVolume: 0, totalValue: 0, excludedBars: 0, validBars: 0,
    method: "ohlcv-overlap", basis,
  };
  const valid: { low: number; high: number; value: number }[] = [];
  let lo = Infinity;
  let hi = -Infinity;
  let inputValue = 0;
  for (const bar of bars) {
    const validPrice = (value: number | undefined) => value === undefined ||
      (Number.isFinite(value) && value >= bar.low && value <= bar.high);
    if (bar.volumeValid === false || !Number.isFinite(bar.low) || !Number.isFinite(bar.high) || bar.low <= 0 || bar.high < bar.low ||
      !Number.isFinite(bar.volume) || bar.volume < 0 || !validPrice(bar.open) || !validPrice(bar.close)) {
      result.excludedBars++;
      continue;
    }
    const price = bar.close ?? bar.low + (bar.high - bar.low) / 2;
    const value = basis === "turnover" ? bar.volume * price : bar.volume;
    if (!Number.isFinite(value) || !Number.isFinite(inputValue + value) ||
      !Number.isFinite(result.totalVolume + bar.volume)) {
      result.excludedBars++;
      continue;
    }
    valid.push({ low: bar.low, high: bar.high, value });
    result.validBars++;
    result.totalVolume += bar.volume;
    inputValue += value;
    lo = Math.min(lo, bar.low);
    hi = Math.max(hi, bar.high);
  }
  if (inputValue === 0) return result;
  const span = hi - lo;
  const n = span > 0 ? (Number.isFinite(rowCount) ? Math.max(1, Math.min(1000, Math.floor(rowCount))) : 24) : 1;
  // Shared boundaries avoid small gaps/overlap from separately rounded edges.
  const edges = Array.from({ length: n + 1 }, (_, i) => i === n ? hi : lo + span * (i / n));
  const rows = Array.from({ length: n }, (_, i) => ({ low: edges[i]!, high: edges[i + 1]!, volume: 0, percent: 0 }));
  for (const bar of valid) {
    if (bar.value === 0) continue;
    if (bar.high === bar.low) {
      // Search actual edges (rather than dividing rounded prices by bin width).
      // Exact interior edges belong only to the upper bin, the top edge to last.
      let left = 0;
      let right = n - 1;
      while (left < right) {
        const middle = Math.floor((left + right) / 2);
        if (bar.low < rows[middle]!.high) right = middle;
        else left = middle + 1;
      }
      rows[left]!.volume += bar.value;
    } else {
      const range = bar.high - bar.low;
      for (const row of rows) {
        const overlap = Math.max(0, Math.min(bar.high, row.high) - Math.max(bar.low, row.low));
        if (overlap > 0) row.volume += bar.value * (overlap / range);
      }
    }
  }
  let pocIdx = 0;
  for (let i = 1; i < n; i++) if (rows[i]!.volume > rows[pocIdx]!.volume) pocIdx = i;
  const total = rows.reduce((s, r) => s + r.volume, 0);
  for (const row of rows) row.percent = (row.volume / total) * 100;
  let lowI = pocIdx;
  let highI = pocIdx;
  let acc = rows[pocIdx]!.volume;
  const target = Number.isFinite(valueArea) ? Math.max(0, Math.min(1, valueArea)) : 0.7;
  while (acc / total < target && (lowI > 0 || highI < n - 1)) {
    const below = lowI > 0 ? rows[lowI - 1]!.volume : -1;
    const above = highI < n - 1 ? rows[highI + 1]!.volume : -1;
    if (below >= above) acc += rows[--lowI]!.volume;
    else acc += rows[++highI]!.volume;
  }
  return {
    ...result, rows, totalValue: total,
    poc: rows[pocIdx]!.low + (rows[pocIdx]!.high - rows[pocIdx]!.low) / 2,
    vah: rows[highI]!.high, val: rows[lowI]!.low,
  };
}

/** Stochastic RSI: %K = SMA(k) of the stochastic of RSI, %D = SMA(d) of %K. */
export function stochRsi(closes: number[], rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3): { k: Series; d: Series } {
  const r = rsi(closes, rsiPeriod);
  const raw: Series = r.map((v, i) => {
    if (v == null || i + 1 < stochPeriod) return null;
    const win = r.slice(i - stochPeriod + 1, i + 1);
    if (win.some((x) => x == null)) return null;
    const hh = Math.max(...(win as number[]));
    const ll = Math.min(...(win as number[]));
    return hh - ll > 0 ? ((v - ll) / (hh - ll)) * 100 : null;
  });
  const smooth = (s: Series, p: number): Series =>
    s.map((_, i) => {
      if (i + 1 < p) return null;
      const win = s.slice(i - p + 1, i + 1);
      return win.some((x) => x == null) ? null : (win as number[]).reduce((a, b) => a + b, 0) / p;
    });
  const k = smooth(raw, kSmooth);
  return { k, d: smooth(k, dSmooth) };
}

/** ADX / +DI / −DI (Wilder). */
export function adx(highs: number[], lows: number[], closes: number[], period = 14): { adx: Series; plusDi: Series; minusDi: Series } {
  const n = highs.length;
  const pdm: number[] = [0];
  const mdm: number[] = [0];
  for (let i = 1; i < n; i++) {
    const up = highs[i]! - highs[i - 1]!;
    const dn = lows[i - 1]! - lows[i]!;
    pdm.push(up > dn && up > 0 ? up : 0);
    mdm.push(dn > up && dn > 0 ? dn : 0);
  }
  const tr = trueRange(highs, lows, closes);
  // Wilder sums start at bar 1 (bar 0 has no directional movement).
  const sm = (xs: number[]) => {
    const s = rma(xs.slice(1), period);
    return [null, ...s] as Series;
  };
  const atrS = sm(tr);
  const pS = sm(pdm);
  const mS = sm(mdm);
  const plusDi: Series = atrS.map((a, i) => (a != null && a > 0 && pS[i] != null ? (100 * pS[i]!) / a : null));
  const minusDi: Series = atrS.map((a, i) => (a != null && a > 0 && mS[i] != null ? (100 * mS[i]!) / a : null));
  const dx: Series = plusDi.map((p, i) => {
    const m = minusDi[i];
    if (p == null || m == null) return null;
    return p + m > 0 ? (100 * Math.abs(p - m)) / (p + m) : 0;
  });
  const firstDx = dx.findIndex((v) => v != null);
  const adxOut: Series = new Array(n).fill(null);
  if (firstDx >= 0) {
    const tail = rma(dx.slice(firstDx) as number[], period);
    tail.forEach((v, j) => (adxOut[firstDx + j] = v));
  }
  return { adx: adxOut, plusDi, minusDi };
}

/** Commodity channel index (mean deviation, 0.015 constant). */
export function cci(highs: number[], lows: number[], closes: number[], period = 20): Series {
  const tp = closes.map((c, i) => (highs[i]! + lows[i]! + c) / 3);
  const m = sma(tp, period);
  return tp.map((v, i) => {
    if (m[i] == null) return null;
    let md = 0;
    for (let j = i - period + 1; j <= i; j++) md += Math.abs(tp[j]! - m[i]!);
    md /= period;
    return md > 0 ? (v - m[i]!) / (0.015 * md) : 0;
  });
}

/** Money flow index. */
export function mfi(highs: number[], lows: number[], closes: number[], volumes: number[], period = 14): Series {
  const tp = closes.map((c, i) => (highs[i]! + lows[i]! + c) / 3);
  return tp.map((_, i) => {
    if (i < period) return null;
    let pos = 0;
    let neg = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const flow = tp[j]! * volumes[j]!;
      if (tp[j]! > tp[j - 1]!) pos += flow;
      else if (tp[j]! < tp[j - 1]!) neg += flow;
    }
    if (neg === 0) return pos === 0 ? 50 : 100;
    return 100 - 100 / (1 + pos / neg);
  });
}

/** Williams %R (−100…0). */
export function williamsR(highs: number[], lows: number[], closes: number[], period = 14): Series {
  const hh = rollingMax(highs, period);
  const ll = rollingMin(lows, period);
  return closes.map((c, i) => (hh[i] != null && ll[i] != null && hh[i]! - ll[i]! > 0 ? ((hh[i]! - c) / (hh[i]! - ll[i]!)) * -100 : null));
}

export type PivotKind = "classic" | "fibonacci" | "camarilla";
export interface PivotLevels {
  p: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

/** Pivot points from the previous period's high/low/close. */
export function pivotPoints(high: number, low: number, close: number, kind: PivotKind = "classic"): PivotLevels {
  const p = (high + low + close) / 3;
  const r = high - low;
  if (kind === "fibonacci") {
    return { p, r1: p + 0.382 * r, r2: p + 0.618 * r, r3: p + r, s1: p - 0.382 * r, s2: p - 0.618 * r, s3: p - r };
  }
  if (kind === "camarilla") {
    return { p, r1: close + (r * 1.1) / 12, r2: close + (r * 1.1) / 6, r3: close + (r * 1.1) / 4, s1: close - (r * 1.1) / 12, s2: close - (r * 1.1) / 6, s3: close - (r * 1.1) / 4 };
  }
  return { p, r1: 2 * p - low, r2: p + r, r3: high + 2 * (p - low), s1: 2 * p - high, s2: p - r, s3: low - 2 * (high - p) };
}

/** Rolling N-bar high/low (default 252 = 52 weeks of daily bars), using bars available so far. */
export function highLowN(highs: number[], lows: number[], lookback = 252): { high: Series; low: Series } {
  return {
    high: highs.map((_, i) => Math.max(...highs.slice(Math.max(0, i - lookback + 1), i + 1))),
    low: lows.map((_, i) => Math.min(...lows.slice(Math.max(0, i - lookback + 1), i + 1))),
  };
}

export interface OhlcLike {
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Heikin-Ashi transform (pure). */
export function heikinAshi<T extends OhlcLike>(bars: readonly T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]!;
    const close = (b.open + b.high + b.low + b.close) / 4;
    const open = i === 0 ? (b.open + b.close) / 2 : (out[i - 1]!.open + out[i - 1]!.close) / 2;
    out.push({ ...b, open, close, high: Math.max(b.high, open, close), low: Math.min(b.low, open, close) });
  }
  return out;
}
