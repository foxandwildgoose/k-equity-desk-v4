/** Pure statistical utilities for the Export × KOSPI desk. No I/O. */

export const MIN_SAMPLE = 24;

const positiveInteger = (n: number) => Number.isInteger(n) && n > 0;

function calendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith("0000")) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function normalizeToBase100(values: number[]): number[] {
  const base = values.find((v) => Number.isFinite(v) && v > 0);
  if (base == null) return values.map(() => NaN);
  return values.map((v) => (Number.isFinite(v) ? (v / base) * 100 : NaN));
}

export function resampleDailyToMonthEnd(
  rows: { date: string; value: number }[],
): { period: string; value: number }[] {
  const by: Record<string, { date: string; value: number }> = {};
  for (const r of rows) {
    if (!calendarDate(r.date) || !Number.isFinite(r.value) || r.value <= 0) continue;
    const p = r.date.slice(0, 7);
    if (!by[p] || r.date > by[p]!.date) by[p] = r;
  }
  return Object.keys(by)
    .sort()
    .map((period) => ({ period, value: by[period]!.value }));
}

export function calculateLogReturns(values: number[]): number[] {
  if (!values.length) return [];
  const out: number[] = [NaN];
  for (let i = 1; i < values.length; i++) {
    const a = values[i - 1]!;
    const b = values[i]!;
    out.push(
      Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 ? Math.log(b) - Math.log(a) : NaN,
    );
  }
  return out;
}

export function calculateYoYGrowth(values: number[], periods = 12): number[] {
  if (!positiveInteger(periods)) return values.map(() => NaN);
  return values.map((v, i) => {
    const prev = values[i - periods];
    if (prev == null || prev === 0 || !Number.isFinite(prev) || !Number.isFinite(v)) return NaN;
    return (v / prev - 1) * 100;
  });
}

export function calculateRolling12MSum(values: number[], window = 12): number[] {
  if (!positiveInteger(window)) return values.map(() => NaN);
  return values.map((_, i) => {
    if (i < window - 1) return NaN;
    let s = 0;
    for (let j = i - window + 1; j <= i; j++) {
      const v = values[j]!;
      if (!Number.isFinite(v)) return NaN;
      s += v;
    }
    return Number.isFinite(s) ? s : NaN;
  });
}

export function calculateWorkingDayAdjusted(value: number, workingDays: number): number | null {
  if (!(workingDays > 0) || !Number.isFinite(workingDays) || !Number.isFinite(value)) return null;
  return value / workingDays;
}

export function calculateMomentum(values: number[], lookback = 3): number[] {
  if (!positiveInteger(lookback)) return values.map(() => NaN);
  return values.map((v, i) => {
    const prev = values[i - lookback];
    if (prev == null || prev === 0 || !Number.isFinite(prev) || !Number.isFinite(v)) return NaN;
    const ratio = v / prev;
    if (!(ratio > 0)) return NaN;
    const result = (Math.pow(ratio, 12 / lookback) - 1) * 100;
    return Number.isFinite(result) ? result : NaN;
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

/** Population standardization; rescaling first avoids overflow in level data. */
function standardized(values: number[]): number[] | null {
  const scale = values.reduce((largest, v) => Math.max(largest, Math.abs(v)), 0);
  if (!(scale > 0) || !Number.isFinite(scale)) return null;
  const scaled = values.map((v) => v / scale);
  const mean = scaled.reduce((sum, v) => sum + v, 0) / scaled.length;
  const centered = scaled.map((v) => v - mean);
  const sd = Math.sqrt(centered.reduce((sum, v) => sum + v * v, 0) / centered.length);
  return sd > 0 && Number.isFinite(sd) ? centered.map((v) => v / sd) : null;
}

export function calculatePearson(x: number[], y: number[]): number | null {
  const p = paired(x, y);
  if (p.length < 3) return null;
  const u = standardized(p.map(([a]) => a));
  const v = standardized(p.map(([, b]) => b));
  if (!u || !v) return null;
  const r = u.reduce((sum, a, i) => sum + a * v[i]!, 0) / p.length;
  return Number.isFinite(r) ? Math.max(-1, Math.min(1, r)) : null;
}

export function calculateSpearman(x: number[], y: number[]): number | null {
  const p = paired(x, y);
  if (p.length < 3) return null;
  const rank = (arr: number[]) => {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const r = new Array<number>(arr.length);
    for (let i = 0; i < sorted.length;) {
      let j = i;
      while (j < sorted.length && sorted[j]!.v === sorted[i]!.v) j++;
      const avg = (i + j - 1) / 2 + 1;
      for (let k = i; k < j; k++) r[sorted[k]!.i] = avg;
      i = j;
    }
    return r;
  };
  return calculatePearson(rank(p.map((v) => v[0])), rank(p.map((v) => v[1])));
}

export function calculatePartialCorrelation(x: number[], y: number[], z: number[]): number | null {
  const triples: [number, number, number][] = [];
  for (let i = 0; i < Math.min(x.length, y.length, z.length); i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i]) && Number.isFinite(z[i])) {
      triples.push([x[i]!, y[i]!, z[i]!]);
    }
  }
  if (triples.length < 3) return null;
  const a = triples.map((row) => row[0]);
  const b = triples.map((row) => row[1]);
  const c = triples.map((row) => row[2]);
  const rxy = calculatePearson(a, b);
  const rxz = calculatePearson(a, c);
  const ryz = calculatePearson(b, c);
  if (rxy == null || rxz == null || ryz == null) return null;
  const residualX = 1 - rxz * rxz,
    residualY = 1 - ryz * ryz;
  if (residualX <= Number.EPSILON * 16 || residualY <= Number.EPSILON * 16) return null;
  const den = Math.sqrt(residualX * residualY);
  const r = (rxy - rxz * ryz) / den;
  return Number.isFinite(r) ? Math.max(-1, Math.min(1, r)) : null;
}

export function calculateRollingCorrelation(
  x: number[],
  y: number[],
  window = 24,
): (number | null)[] {
  if (!positiveInteger(window) || window < 3) return x.map(() => null);
  return x.map((_, i) => {
    if (i < window - 1) return null;
    const a = x.slice(i - window + 1, i + 1);
    const b = y.slice(i - window + 1, i + 1);
    return paired(a, b).length === window ? calculatePearson(a, b) : null;
  });
}

export function calculateCrossCorrelation(
  x: number[],
  y: number[],
  maxLag = 6,
): { lag: number; corr: number | null }[] {
  if (!Number.isInteger(maxLag) || maxLag < 0) return [];
  const out: { lag: number; corr: number | null }[] = [];
  const sufficientCorrelation = (a: number[], b: number[]) =>
    paired(a, b).length >= MIN_SAMPLE ? calculatePearson(a, b) : null;
  const n = Math.min(x.length, y.length);
  const a = x.slice(0, n),
    b = y.slice(0, n);
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    if (lag < 0) {
      out.push({
        lag,
        corr: sufficientCorrelation(a.slice(-lag), b.slice(0, Math.max(0, n + lag))),
      });
    } else if (lag > 0) {
      out.push({
        lag,
        corr: sufficientCorrelation(a.slice(0, Math.max(0, n - lag)), b.slice(lag)),
      });
    } else {
      out.push({ lag, corr: sufficientCorrelation(a, b) });
    }
  }
  return out;
}

export function calculateForwardReturn(prices: number[], horizon: number): number[] {
  if (!positiveInteger(horizon)) return prices.map(() => NaN);
  return prices.map((p, i) => {
    const fut = prices[i + horizon];
    if (!(p > 0) || !Number.isFinite(p) || fut == null || !(fut > 0) || !Number.isFinite(fut))
      return NaN;
    return Math.log(fut) - Math.log(p);
  });
}

/** Newey–West HAC variance for mean of series (Bartlett kernel). */
export function neweyWestStandardError(series: number[], lags = 3): number | null {
  if (!Number.isInteger(lags) || lags < 0) return null;
  const n = series.filter(Number.isFinite).length;
  if (n < lags + 3) return null;
  const mean = series.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0) / n;
  // Missing calendar positions have no score contribution. Do not turn observations
  // separated by a missing month into adjacent observations for the lag covariance.
  const u = series.map((v) => (Number.isFinite(v) ? v - mean : 0));
  let gamma0 = 0;
  for (const v of u) gamma0 += v * v;
  gamma0 /= n;
  let hac = gamma0;
  for (let j = 1; j <= lags; j++) {
    let g = 0;
    for (let t = j; t < u.length; t++) g += u[t]! * u[t - j]!;
    g /= n;
    const w = 1 - j / (lags + 1);
    hac += 2 * w * g;
  }
  if (!Number.isFinite(hac) || hac < -Number.EPSILON * Math.max(1, gamma0) * 16) return null;
  return Math.sqrt(Math.max(0, hac) / n);
}

export function benjaminiHochbergFDR(pValues: number[], q = 0.1): boolean[] {
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

/** Descriptive variance-ratio heuristic, not a statistical unit-root test. */
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
      ? "Variance-ratio screen passed; this does not establish stationarity"
      : "Variance-ratio screen failed; use YoY / log-return instead of raw level",
  };
}

function variance(x: number[]): number {
  if (x.length < 2) return 0;
  const m = x.reduce((a, b) => a + b, 0) / x.length;
  return x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1);
}

export function calculateExportSurprise(actual: number, consensus: number | null): number | null {
  if (consensus == null || !Number.isFinite(actual) || !Number.isFinite(consensus)) {
    return null;
  }
  if (consensus === 0) return null;
  return ((actual - consensus) / Math.abs(consensus)) * 100;
}

export function convertUsdKrw(usd: number, fx: number): number | null {
  if (!(usd >= 0) || !(fx > 0) || !Number.isFinite(usd) || !Number.isFinite(fx)) return null;
  const result = usd * fx;
  return Number.isFinite(result) ? result : null;
}

/** Require the same month's observed FX. Missing history remains unknown. */
export function fxRateForPeriod(
  period: string,
  series: { date: string; value: number }[],
  _spot?: number,
): number | null {
  const ym = period.slice(0, 7);
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(ym)) return null;
  const sorted = [...series]
    .filter((r) => Number.isFinite(r.value) && r.value > 0 && calendarDate(r.date))
    .sort((a, b) => a.date.localeCompare(b.date)); // ked-allow-string-date-sort: single-format time series
  return sorted.filter((r) => r.date.slice(0, 7) === ym).at(-1)?.value ?? null;
}

export function alignByReleaseDate<T extends { period: string; releasedAt?: string }>(
  rows: T[],
  _mode: "OBSERVATION" | "RELEASE",
): T[] {
  // Publication-aware analysis needs explicit as-of joins, not a release-date
  // sort. Reordering calendar months would corrupt YoY, rolling windows and HAC.
  return [...rows].sort((a, b) => a.period.localeCompare(b.period)); // ked-allow-string-date-sort: single-format time series
}

export function sufficiencyGate(n: number): { ok: boolean; reason?: string } {
  if (!Number.isInteger(n) || n < MIN_SAMPLE) return { ok: false, reason: "Insufficient data" };
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
  const sample = paired(x, y);
  const n = sample.length;
  if (n < MIN_SAMPLE) {
    return { r: null, n, se: null, usedHac: false, insufficient: true };
  }
  const r = calculatePearson(x, y);
  const u = standardized(sample.map(([a]) => a));
  const v = standardized(sample.map(([, b]) => b));
  if (r == null || !u || !v) {
    return { r: null, n, se: null, usedHac: false, insufficient: true };
  }
  // Influence of the Pearson estimator, including its estimated variances.
  // HAC of raw x*y has different units and is not a correlation standard error.
  let k = 0;
  const influence = Array.from({ length: Math.min(x.length, y.length) }, (_, i) => {
    if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) return NaN;
    const a = u[k]!,
      b = v[k++]!;
    return a * b - (r / 2) * (a * a + b * b);
  });
  // Monthly YoY windows overlap through lag 11; a lag-3 kernel misses that
  // mechanical dependence. Non-overlapping monthly log returns use lag 3.
  const se = neweyWestStandardError(influence, transform === "yoy" ? 11 : 3);
  return { r, n, se, usedHac: se != null, insufficient: se == null };
}
