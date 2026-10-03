/** Pure statistical utilities for the Export × KOSPI desk. No I/O. */

export const MIN_SAMPLE = 24;

export function normalizeToBase100(values: number[]): number[] {
  const base = values.find((v) => v > 0);
  if (base == null) return values.map(() => NaN);
  return values.map((v) => (v / base) * 100);
}

export function resampleDailyToMonthEnd(
  rows: { date: string; value: number }[],
): { period: string; value: number }[] {
  const by: Record<string, { date: string; value: number }> = {};
  for (const r of rows) {
    const p = r.date.slice(0, 7);
    if (!by[p] || r.date > by[p]!.date) by[p] = r;
  }
  return Object.keys(by)
    .sort()
    .map((period) => ({ period, value: by[period]!.value }));
}

export function calculateLogReturns(values: number[]): number[] {
  const out: number[] = [NaN];
  for (let i = 1; i < values.length; i++) {
    const a = values[i - 1]!;
    const b = values[i]!;
    out.push(a > 0 && b > 0 ? Math.log(b / a) : NaN);
  }
  return out;
}

export function calculateYoYGrowth(values: number[], periods = 12): number[] {
  return values.map((v, i) => {
    const prev = values[i - periods];
    if (prev == null || prev === 0 || !Number.isFinite(v)) return NaN;
    return (v / prev - 1) * 100;
  });
}

export function calculateRolling12MSum(values: number[], window = 12): number[] {
  return values.map((_, i) => {
    if (i < window - 1) return NaN;
    let s = 0;
    for (let j = i - window + 1; j <= i; j++) {
      const v = values[j]!;
      if (!Number.isFinite(v)) return NaN;
      s += v;
    }
    return s;
  });
}

export function calculateWorkingDayAdjusted(
  value: number,
  workingDays: number,
): number | null {
  if (!(workingDays > 0) || !Number.isFinite(value)) return null;
  return value / workingDays;
}

export function calculateMomentum(values: number[], lookback = 3): number[] {
  return values.map((v, i) => {
    const prev = values[i - lookback];
    if (prev == null || prev === 0) return NaN;
    const ratio = v / prev;
    if (!(ratio > 0)) return NaN;
    return (Math.pow(ratio, 12 / lookback) - 1) * 100;
  });
}

export function calculateZScore(values: number[]): number[] {
  const xs = values.filter(Number.isFinite);
  if (xs.length < 2) return values.map(() => NaN);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1));
  if (sd === 0) return values.map(() => NaN);
  return values.map((v) => (Number.isFinite(v) ? (v - mean) / sd : NaN));
}

function paired(x: number[], y: number[]): [number, number][] {
  const n = Math.min(x.length, y.length);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) out.push([x[i]!, y[i]!]);
  }
  return out;
}

export function calculatePearson(x: number[], y: number[]): number | null {
  const p = paired(x, y);
  if (p.length < 3) return null;
  const n = p.length;
  const mx = p.reduce((s, v) => s + v[0], 0) / n;
  const my = p.reduce((s, v) => s + v[1], 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const [a, b] of p) {
    num += (a - mx) * (b - my);
    dx += (a - mx) ** 2;
    dy += (b - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return null;
  return num / den;
}

export function calculateSpearman(x: number[], y: number[]): number | null {
  const p = paired(x, y);
  if (p.length < 3) return null;
  const rank = (arr: number[]) => {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const r = new Array<number>(arr.length);
    for (let i = 0; i < sorted.length; ) {
      let j = i;
      while (j < sorted.length && sorted[j]!.v === sorted[i]!.v) j++;
      const avg = (i + j - 1) / 2 + 1;
      for (let k = i; k < j; k++) r[sorted[k]!.i] = avg;
      i = j;
    }
    return r;
  };
  return calculatePearson(
    rank(p.map((v) => v[0])),
    rank(p.map((v) => v[1])),
  );
}

export function calculatePartialCorrelation(
  x: number[],
  y: number[],
  z: number[],
): number | null {
  const rxy = calculatePearson(x, y);
  const rxz = calculatePearson(x, z);
  const ryz = calculatePearson(y, z);
  if (rxy == null || rxz == null || ryz == null) return null;
  const den = Math.sqrt((1 - rxz * rxz) * (1 - ryz * ryz));
  if (den === 0) return null;
  return (rxy - rxz * ryz) / den;
}

export function calculateRollingCorrelation(
  x: number[],
  y: number[],
  window = 24,
): (number | null)[] {
  return x.map((_, i) => {
    if (i < window - 1) return null;
    return calculatePearson(x.slice(i - window + 1, i + 1), y.slice(i - window + 1, i + 1));
  });
}

export function calculateCrossCorrelation(
  x: number[],
  y: number[],
  maxLag = 6,
): { lag: number; corr: number | null }[] {
  const out: { lag: number; corr: number | null }[] = [];
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    if (lag < 0) {
      out.push({ lag, corr: calculatePearson(x.slice(-lag), y.slice(0, y.length + lag)) });
    } else if (lag > 0) {
      out.push({ lag, corr: calculatePearson(x.slice(0, x.length - lag), y.slice(lag)) });
    } else {
      out.push({ lag, corr: calculatePearson(x, y) });
    }
  }
  return out;
}

export function calculateForwardReturn(prices: number[], horizon: number): number[] {
  return prices.map((p, i) => {
    const fut = prices[i + horizon];
    if (!(p > 0) || fut == null || !(fut > 0)) return NaN;
    return Math.log(fut / p);
  });
}

/** Newey–West HAC variance for mean of series (Bartlett kernel). */
export function neweyWestStandardError(series: number[], lags = 3): number | null {
  const x = series.filter(Number.isFinite);
  const n = x.length;
  if (n < lags + 3) return null;
  const mean = x.reduce((a, b) => a + b, 0) / n;
  const u = x.map((v) => v - mean);
  let gamma0 = 0;
  for (const v of u) gamma0 += v * v;
  gamma0 /= n;
  let hac = gamma0;
  for (let j = 1; j <= lags; j++) {
    let g = 0;
    for (let t = j; t < n; t++) g += u[t]! * u[t - j]!;
    g /= n;
    const w = 1 - j / (lags + 1);
    hac += 2 * w * g;
  }
  if (hac < 0) return null;
  return Math.sqrt(hac / n);
}

export function benjaminiHochbergFDR(
  pValues: number[],
  q = 0.1,
): boolean[] {
  const idx = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const keep = new Array<boolean>(pValues.length).fill(false);
  const m = pValues.length;
  let max = -1;
  for (let k = 0; k < m; k++) {
    if (idx[k]!.p <= ((k + 1) / m) * q) max = k;
  }
  for (let k = 0; k <= max; k++) keep[idx[k]!.i] = true;
  return keep;
}

/** ADF-lite: reject non-stationarity if |Δ series| mean is large vs level (heuristic + variance ratio). */
export function testStationarity(values: number[]): {
  stationary: boolean;
  method: string;
  note: string;
} {
  const x = values.filter(Number.isFinite);
  if (x.length < MIN_SAMPLE) {
    return { stationary: false, method: "insufficient", note: "N < 24" };
  }
  const d = [];
  for (let i = 1; i < x.length; i++) d.push(x[i]! - x[i - 1]!);
  const varLevel = variance(x);
  const varDiff = variance(d);
  const ratio = varLevel === 0 ? 0 : varDiff / varLevel;
  const stationary = ratio > 0.15;
  return {
    stationary,
    method: "variance-ratio-diff",
    note: stationary
      ? "Differenced series dominates — treat as I(0) after transform"
      : "Level looks I(1) — use YoY / log-return, not raw level",
  };
}

function variance(x: number[]): number {
  if (x.length < 2) return 0;
  const m = x.reduce((a, b) => a + b, 0) / x.length;
  return x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1);
}

export function calculateExportSurprise(
  actual: number,
  consensus: number | null,
): number | null {
  if (consensus == null || !Number.isFinite(actual) || !Number.isFinite(consensus)) {
    return null;
  }
  if (consensus === 0) return null;
  return ((actual - consensus) / Math.abs(consensus)) * 100;
}

export function convertUsdKrw(usd: number, fx: number): number | null {
  if (!(usd >= 0) || !(fx > 0)) return null;
  return usd * fx;
}

/** Pick the FX rate valid for a YYYY-MM period. Never reuse today's spot for history. */
export function fxRateForPeriod(
  period: string,
  series: { date: string; value: number }[],
  spot?: number,
): number | null {
  const ym = period.slice(0, 7);
  if (!ym) return null;
  const sorted = [...series]
    .filter((r) => r.value > 0 && r.date)
    .sort((a, b) => a.date.localeCompare(b.date)); // ked-allow-string-date-sort: single-format time series
  if (!sorted.length) return spot && spot > 0 ? spot : null;
  const exact = sorted.find((r) => r.date.slice(0, 7) === ym);
  if (exact) return exact.value;
  const prior = sorted.filter((r) => r.date.slice(0, 7) <= ym).at(-1);
  if (prior) return prior.value;
  return null;
}

export function alignByReleaseDate<T extends { period: string; releasedAt?: string }>(
  rows: T[],
  mode: "OBSERVATION" | "RELEASE",
): T[] {
  if (mode === "OBSERVATION") return [...rows].sort((a, b) => a.period.localeCompare(b.period)); // ked-allow-string-date-sort: single-format time series
  return [...rows].sort((a, b) =>
    (a.releasedAt ?? a.period).localeCompare(b.releasedAt ?? b.period), // ked-allow-string-date-sort: single-format time series
  );
}

export function sufficiencyGate(n: number): { ok: boolean; reason?: string } {
  if (n < MIN_SAMPLE) return { ok: false, reason: "Insufficient data" };
  return { ok: true };
}

export function pearsonWithInference(
  x: number[],
  y: number[],
  opts?: { transform: "yoy" | "logret" | "level" },
): {
  r: number | null;
  n: number;
  se: number | null;
  usedHac: boolean;
  insufficient: boolean;
} {
  const transform = opts?.transform ?? "yoy";
  if (transform === "level") {
    const st = testStationarity(x);
    if (!st.stationary) {
      return { r: null, n: 0, se: null, usedHac: false, insufficient: true };
    }
  }
  const r = calculatePearson(x, y);
  const n = paired(x, y).length;
  if (n < MIN_SAMPLE) {
    return { r: null, n, se: null, usedHac: false, insufficient: true };
  }
  const prod = paired(x, y).map(([a, b]) => a * b);
  const se = neweyWestStandardError(prod, 3);
  return { r, n, se, usedHac: true, insufficient: false };
}
