/**
 * Historical valuation multiples.
 *
 * Trailing PER / EV ratios use the latest reported (non-estimate) annual
 * fundamentals with period end on or before the price date. They are not
 * rescaled, and a non-positive EPS or EBITDA makes that multiple undefined.
 * Forward PER is price / the latest consensus EPS only — not a look-ahead
 * label on realized future earnings.
 */

export type AnnualFundamental = {
  year: number;
  /** Fiscal period end YYYY-MM-DD. */
  periodEnd: string;
  estimate: boolean;
  eps: number | null;
  per: number | null;
  ebitdaEok: number | null;
  salesEok: number | null;
  evEok: number | null;
  /** Year-end adjusted common price (KRW). */
  price: number | null;
  /** Common shares outstanding (count, not 천주). */
  shares: number | null;
  debtEok: number | null;
  evEbitda: number | null;
  /**
   * When set, EV uses this net debt (억원 or USD/1e8) instead of
   * reconstructing it from reported EV and a year-end price.
   */
  netDebtEok?: number | null;
};

export type ConsensusEps = {
  year: number;
  eps: number;
  per: number | null;
  /** ntm = next four quarterly consensus prints. fy1 = next fiscal year. */
  horizon?: "ntm" | "fy1";
};

export type MonthPrice = { date: string; price: number };

export type MultipleStats = {
  n: number;
  mean: number | null;
  sigma: number | null;
  current: number | null;
  /** Full-sample share of positive observations at or below current, 0–100. */
  percentile: number | null;
  /** Historical percentile of the positive multiple sample (not a sigma band). */
  p10: number | null;
  p50: number | null;
  p90: number | null;
  p1: number | null;
  m1: number | null;
  p2: number | null;
  m2: number | null;
};

export type MultiplePoint = {
  date: string;
  value: number | null;
  /** Expanding (past-only) percentile. Null until 8 positive observations. */
  percentile: number | null;
};

export type PriceBandPoint = {
  date: string;
  price: number | null;
  mean: number | null;
  p1: number | null;
  m1: number | null;
  p2: number | null;
  m2: number | null;
};

export type MultipleSeries = {
  points: MultiplePoint[];
  priceBands: PriceBandPoint[];
  stats: MultipleStats;
  unit: "배";
  basis: string;
};

export type ValuationBand = {
  basis: "per" | "evSales" | "none";
  basisLabel: string;
  points: PriceBandPoint[];
  percentilePoints: MultiplePoint[];
  stats: MultipleStats;
  note: string;
};

export type ValuationDriver = {
  date: string;
  price: number;
  eps: number | null;
  ebitdaEok: number | null;
  salesEok: number | null;
  netDebtEok: number | null;
  shares: number | null;
};

export type ValuationPack = {
  code: string;
  source: string;
  sourceUrl: string;
  note: string;
  name: string | null;
  currency: "KRW" | "USD";
  /** Point-in-time inputs. Range buttons recompute bands from these. */
  drivers: ValuationDriver[];
  window: { from: string | null; to: string | null };
  consensus: ConsensusEps | null;
  per: MultipleSeries;
  forwardPer: MultipleSeries;
  evEbitda: MultipleSeries;
  evSales: MultipleSeries;
  valuationBand: ValuationBand;
};

const MIN_EXPANDING = 8;

export function sampleMean(xs: number[]): number | null {
  if (!xs.length) return null;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Sample standard deviation (n − 1). Null when n < 2. */
export function sampleSigma(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const mean = sampleMean(xs);
  if (mean == null) return null;
  let acc = 0;
  for (const x of xs) {
    const d = x - mean;
    acc += d * d;
  }
  return Math.sqrt(acc / (xs.length - 1));
}

/** Percent of positive sample values that are <= current. */
export function percentileRank(sample: number[], current: number): number | null {
  if (!(current > 0) || !Number.isFinite(current)) return null;
  const xs = sample.filter((v) => Number.isFinite(v) && v > 0);
  if (!xs.length) return null;
  let le = 0;
  for (const v of xs) if (v <= current) le += 1;
  return (le / xs.length) * 100;
}

export function expandingPercentile(values: (number | null)[]): (number | null)[] {
  const hist: number[] = [];
  return values.map((v) => {
    if (v == null || !(v > 0) || !Number.isFinite(v)) return null;
    hist.push(v);
    if (hist.length < MIN_EXPANDING) return null;
    return percentileRank(hist, v);
  });
}

export function sigmaBands(mean: number | null, sigma: number | null) {
  if (mean == null || sigma == null || !Number.isFinite(mean) || !Number.isFinite(sigma)) {
    return { p1: null, m1: null, p2: null, m2: null };
  }
  return {
    p1: mean + sigma,
    m1: mean - sigma,
    p2: mean + 2 * sigma,
    m2: mean - 2 * sigma,
  };
}

function sampleQuantile(xs: number[], q: number): number | null {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  const w = pos - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

export function statsOf(values: (number | null)[]): MultipleStats {
  const pos = values.filter((v): v is number => v != null && v > 0 && Number.isFinite(v));
  let current: number | null = null;
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v != null && v > 0 && Number.isFinite(v)) {
      current = v;
      break;
    }
  }
  const mean = sampleMean(pos);
  const sigma = sampleSigma(pos);
  return {
    n: pos.length,
    mean,
    sigma,
    current,
    percentile: current == null ? null : percentileRank(pos, current),
    p10: sampleQuantile(pos, 0.1),
    p50: sampleQuantile(pos, 0.5),
    p90: sampleQuantile(pos, 0.9),
    ...sigmaBands(mean, sigma),
  };
}

export function emptyStats(): MultipleStats {
  return {
    n: 0,
    mean: null,
    sigma: null,
    current: null,
    percentile: null,
    p10: null,
    p50: null,
    p90: null,
    p1: null,
    m1: null,
    p2: null,
    m2: null,
  };
}

/** Net debt (억원) = reported EV − year-end common market cap. */
export function netDebtEok(
  evEok: number | null,
  price: number | null,
  shares: number | null,
): number | null {
  if (evEok == null || price == null || shares == null) return null;
  if (!(price > 0) || !(shares > 0) || !Number.isFinite(evEok)) return null;
  return evEok - (price * shares) / 1e8;
}

export function trailingMultiple(price: number | null, fundamental: number | null): number | null {
  if (price == null || fundamental == null) return null;
  if (!(price > 0) || !(fundamental > 0) || !Number.isFinite(price) || !Number.isFinite(fundamental)) {
    return null;
  }
  return price / fundamental;
}

/** EV / fundamental. Undefined when fundamental is not strictly positive. */
export function evMultiple(evEok: number | null, fundamentalEok: number | null): number | null {
  if (evEok == null || fundamentalEok == null) return null;
  if (!(fundamentalEok > 0) || !Number.isFinite(evEok) || !Number.isFinite(fundamentalEok)) return null;
  return evEok / fundamentalEok;
}

export function fairPriceFromPer(eps: number | null, multiple: number | null): number | null {
  if (eps == null || multiple == null) return null;
  if (!(eps > 0) || !(multiple > 0)) return null;
  return eps * multiple;
}

/**
 * Equity value = fundamental × multiple − net debt.
 * fundamental and net debt are 억원; shares are a count; price is KRW.
 */
export function fairPriceFromEvMultiple(
  fundamentalEok: number | null,
  multiple: number | null,
  netDebt: number | null,
  shares: number | null,
): number | null {
  if (fundamentalEok == null || multiple == null || netDebt == null || shares == null) return null;
  if (!(fundamentalEok > 0) || !(multiple > 0) || !(shares > 0) || !Number.isFinite(netDebt)) {
    return null;
  }
  const equityEok = fundamentalEok * multiple - netDebt;
  if (!(equityEok > 0)) return null;
  return (equityEok * 1e8) / shares;
}

export function extractEncparam(html: string): string | null {
  const quoted = html.match(/encparam\s*:\s*'([^']+)'/);
  if (quoted?.[1]) return quoted[1];
  const query = html.match(/encparam=([A-Za-z0-9+/=_-]+)/);
  return query?.[1] ?? null;
}

export type RatioColumn = {
  index: number;
  year: number;
  month: number;
  estimate: boolean;
  periodEnd: string;
};

function lastDayIso(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

export function parseRatioColumns(yymm: unknown): RatioColumn[] {
  if (!Array.isArray(yymm)) return [];
  const out: RatioColumn[] = [];
  yymm.forEach((raw, i) => {
    const s = String(raw);
    const m = s.match(/(\d{4})\/(\d{2})/);
    if (!m) return;
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (!(month >= 1 && month <= 12)) return;
    out.push({
      index: i + 1,
      year,
      month,
      estimate: /\(E\)/.test(s),
      periodEnd: lastDayIso(year, month),
    });
  });
  return out;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function findAccount(rows: unknown, names: string[]): Record<string, unknown> | null {
  if (!Array.isArray(rows)) return null;
  for (const name of names) {
    for (const row of rows) {
      const rec = asRecord(row);
      if (rec && String(rec.ACC_NM ?? "") === name) return rec;
    }
  }
  return null;
}

function colValue(row: Record<string, unknown> | null, index: number): number | null {
  if (!row) return null;
  return num(row[`DATA${index}`]);
}

export function parseAnnualFundamentals(
  rpt5: unknown,
  rpt0: unknown,
): { annuals: AnnualFundamental[]; consensus: ConsensusEps | null } {
  const a = asRecord(rpt5);
  const b = asRecord(rpt0);
  const cols = parseRatioColumns(a?.YYMM ?? b?.YYMM);
  const rows5 = a?.DATA;
  const rows0 = b?.DATA;
  const eps = findAccount(rows5, ["EPS"]);
  const per = findAccount(rows5, ["PER"]);
  const ebitda = findAccount(rows5, ["EBITDA＜당기＞", "EBITDA<당기>"]);
  const ev = findAccount(rows5, ["EV＜당기＞", "EV<당기>"]);
  const sales = findAccount(rows5, ["매출액＜당기＞", "매출액<당기>"]);
  const px = findAccount(rows5, [
    "보통주.수정주가(기말)＜당기＞",
    "보통주.수정주가(기말)<당기>",
  ]);
  const evEb = findAccount(rows5, ["EV/EBITDA"]);
  const shares = findAccount(rows0, ["발행주식수(보통주)"]);
  const debt = findAccount(rows0, ["이자발생부채"]);

  const annuals: AnnualFundamental[] = [];
  let consensus: ConsensusEps | null = null;
  for (const c of cols) {
    const row: AnnualFundamental = {
      year: c.year,
      periodEnd: c.periodEnd,
      estimate: c.estimate,
      eps: colValue(eps, c.index),
      per: colValue(per, c.index),
      ebitdaEok: colValue(ebitda, c.index),
      salesEok: colValue(sales, c.index),
      evEok: colValue(ev, c.index),
      price: colValue(px, c.index),
      shares: colValue(shares, c.index),
      debtEok: colValue(debt, c.index),
      evEbitda: colValue(evEb, c.index),
    };
    if (c.estimate) {
      if (!consensus && row.eps != null && row.eps > 0) {
        consensus = {
          year: c.year,
          eps: row.eps,
          per: row.per != null && row.per > 0 ? row.per : null,
        };
      }
      continue;
    }
    annuals.push(row);
  }
  annuals.sort((x, y) => (x.periodEnd < y.periodEnd ? -1 : x.periodEnd > y.periodEnd ? 1 : 0));
  return { annuals, consensus };
}

export function parseBandMonthPrices(json: unknown): MonthPrice[] {
  const root = asRecord(json);
  const chart = asRecord(root?.bandChart1);
  const price = chart?.price;
  if (!Array.isArray(price)) return [];
  const out: MonthPrice[] = [];
  const seen = new Set<string>();
  for (const row of price) {
    const rec = asRecord(row);
    if (!rec) continue;
    const x = rec.x;
    const y = num(rec.y);
    if (typeof x !== "number" || y == null || !(y > 0)) continue;
    const date = new Date(x).toISOString().slice(0, 10);
    if (seen.has(date)) continue;
    seen.add(date);
    out.push({ date, price: y });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); // ked-allow-string-date-sort: single-format time series
  return out;
}

/** Yahoo symbol for a Naver Reuters code (NVDA.O) or a bare US ticker. KR codes return null. */
export function yahooUsSymbol(raw: string): string | null {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!t || /^[0-9A-Z]{6}$/.test(t)) return null;
  const stripped = t.replace(/\.(O|N|A|K|Q)$/, "");
  if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(stripped)) return null;
  if (stripped.endsWith(".") || stripped.startsWith(".")) return null;
  return stripped;
}

function fiscalYearOf(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = v.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

/**
 * Nasdaq earnings-forecast: next-twelve-month EPS is the sum of the next four
 * quarterly consensus prints. That is a current snapshot, not a history of
 * what the Street thought in the past.
 */
export function parseNasdaqEarningsForecast(json: unknown): ConsensusEps | null {
  const data = asRecord(asRecord(json)?.data);
  if (!data) return null;
  const qWrap = asRecord(data.quarterlyForecast);
  const qRows = Array.isArray(qWrap?.rows) ? qWrap.rows : [];
  const quarters: { year: number; eps: number }[] = [];
  for (const row of qRows) {
    const rec = asRecord(row);
    if (!rec) continue;
    const eps = num(rec.consensusEPSForecast);
    const year = fiscalYearOf(rec.fiscalEnd);
    if (eps == null || !(eps > 0) || year == null) continue;
    quarters.push({ year, eps });
  }
  if (quarters.length >= 4) {
    const ntm = quarters.slice(0, 4);
    const eps = ntm.reduce((sum, row) => sum + row.eps, 0);
    if (eps > 0) return { year: ntm[3]!.year, eps, per: null, horizon: "ntm" };
  }
  const yWrap = asRecord(data.yearlyForecast);
  const yRows = Array.isArray(yWrap?.rows) ? yWrap.rows : [];
  for (const row of yRows) {
    const rec = asRecord(row);
    if (!rec) continue;
    const eps = num(rec.consensusEPSForecast);
    const year = fiscalYearOf(rec.fiscalEnd);
    const estimates = num(rec.noOfEstimates);
    if (eps == null || !(eps > 0) || year == null) continue;
    if (estimates != null && estimates < 3) continue;
    return { year, eps, per: null, horizon: "fy1" };
  }
  return null;
}

export type SplitEvent = { date: string; factor: number };

/** Put reported shares onto the same basis as a split-adjusted price. */
export function sharesOnPriceBasis(
  shares: number | null,
  asOf: string,
  splits: SplitEvent[],
): number | null {
  if (shares == null || !(shares > 0) || !Number.isFinite(shares)) return shares;
  let factor = 1;
  for (const split of splits) {
    if (split.date > asOf && split.factor > 0 && Number.isFinite(split.factor)) factor *= split.factor;
  }
  return shares * factor;
}

export function parseYahooSplits(json: unknown): SplitEvent[] {
  const root = asRecord(json);
  const chart = asRecord(root?.chart);
  const result = Array.isArray(chart?.result) ? asRecord(chart.result[0]) : null;
  const events = asRecord(result?.events);
  const splits = asRecord(events?.splits);
  if (!splits) return [];
  const out: SplitEvent[] = [];
  for (const row of Object.values(splits)) {
    const rec = asRecord(row);
    if (!rec) continue;
    const numerator = num(rec.numerator);
    const denominator = num(rec.denominator);
    const stamp = num(rec.date);
    if (numerator == null || denominator == null || !(denominator > 0) || stamp == null) continue;
    out.push({
      date: new Date(stamp * 1000).toISOString().slice(0, 10),
      factor: numerator / denominator,
    });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); // ked-allow-string-date-sort: single-format time series
  return out;
}

export function parseYahooAdjCloses(json: unknown): MonthPrice[] {
  const root = asRecord(json);
  const chart = asRecord(root?.chart);
  const result = Array.isArray(chart?.result) ? asRecord(chart.result[0]) : null;
  const ts = result?.timestamp;
  if (!result || !Array.isArray(ts)) return [];
  const indicators = asRecord(result.indicators);
  const adjWrap = Array.isArray(indicators?.adjclose) ? asRecord(indicators.adjclose[0]) : null;
  const quoteWrap = Array.isArray(indicators?.quote) ? asRecord(indicators.quote[0]) : null;
  const series = Array.isArray(adjWrap?.adjclose) ? adjWrap.adjclose : quoteWrap?.close;
  if (!Array.isArray(series)) return [];
  const out: MonthPrice[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    const px = num(series[i]);
    if (typeof t !== "number" || px == null || !(px > 0)) continue;
    const date = new Date(t * 1000).toISOString().slice(0, 10);
    if (seen.has(date)) continue;
    seen.add(date);
    out.push({ date, price: px });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); // ked-allow-string-date-sort: single-format time series
  return out;
}

export function isoDays(a: string, b: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : null;
}

type DurationFact = { end: string; start: string; filed: string; val: number };
type InstantFact = { end: string; filed: string; val: number };

function secRows(json: unknown, ns: "us-gaap" | "dei", tag: string): Record<string, unknown>[] {
  const root = asRecord(json);
  const facts = asRecord(root?.facts);
  const scope = asRecord(facts?.[ns]);
  const node = asRecord(scope?.[tag]);
  const units = asRecord(node?.units);
  if (!units) return [];
  const rows: Record<string, unknown>[] = [];
  for (const list of Object.values(units)) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const rec = asRecord(row);
      if (rec) rows.push(rec);
    }
  }
  return rows;
}

function isFilingForm(form: unknown): boolean {
  return form === "10-K" || form === "10-Q" || form === "10-K/A" || form === "10-Q/A";
}

/** Keep one value per period end: latest figure, earliest filing date (first time the market saw the period). */
export function collectDurationFacts(
  rows: Record<string, unknown>[],
  minDays: number,
  maxDays: number,
): DurationFact[] {
  const best = new Map<string, DurationFact & { latest: string }>();
  for (const row of rows) {
    if (!isFilingForm(row.form)) continue;
    const start = typeof row.start === "string" ? row.start.slice(0, 10) : "";
    const end = typeof row.end === "string" ? row.end.slice(0, 10) : "";
    const filed = typeof row.filed === "string" ? row.filed.slice(0, 10) : "";
    const val = num(row.val);
    if (!start || !end || !filed || val == null) continue;
    const span = isoDays(start, end);
    if (span == null || span < minDays || span > maxDays) continue;
    const prev = best.get(end);
    if (!prev) {
      best.set(end, { end, start, filed, val, latest: filed });
      continue;
    }
    if (filed < prev.filed) prev.filed = filed;
    if (filed >= prev.latest) {
      prev.val = val;
      prev.start = start;
      prev.latest = filed;
    }
  }
  return [...best.values()]
    .map(({ end, start, filed, val }) => ({ end, start, filed, val }))
    .sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
}

export function collectInstantFacts(rows: Record<string, unknown>[]): InstantFact[] {
  const best = new Map<string, InstantFact & { latest: string }>();
  for (const row of rows) {
    if (!isFilingForm(row.form)) continue;
    const end = typeof row.end === "string" ? row.end.slice(0, 10) : "";
    const filed = typeof row.filed === "string" ? row.filed.slice(0, 10) : "";
    const val = num(row.val);
    const start = typeof row.start === "string" ? row.start.slice(0, 10) : "";
    if (!end || !filed || val == null) continue;
    if (start && start !== end) {
      const span = isoDays(start, end);
      if (span != null && span > 5) continue;
    }
    const prev = best.get(end);
    if (!prev) {
      best.set(end, { end, filed, val, latest: filed });
      continue;
    }
    if (filed < prev.filed) prev.filed = filed;
    if (filed >= prev.latest) {
      prev.val = val;
      prev.latest = filed;
    }
  }
  return [...best.values()]
    .map(({ end, filed, val }) => ({ end, filed, val }))
    .sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
}

function dropNearDuplicates(facts: DurationFact[]): DurationFact[] {
  const out: DurationFact[] = [];
  for (const fact of facts) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push(fact);
      continue;
    }
    const gap = isoDays(prev.end, fact.end);
    if (gap != null && gap < 60) {
      if (fact.filed >= prev.filed) out[out.length - 1] = fact;
      continue;
    }
    out.push(fact);
  }
  return out;
}

/** Turn year-to-date flows (Q1, 6-month, 9-month, FY sharing one start) into single-quarter amounts. */
export function quartersFromCumulative(facts: DurationFact[]): DurationFact[] {
  const groups = new Map<string, DurationFact[]>();
  for (const fact of facts) {
    const list = groups.get(fact.start) ?? [];
    list.push(fact);
    groups.set(fact.start, list);
  }
  const out: DurationFact[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
    let prev = 0;
    let prevEnd = list[0]?.start ?? "";
    for (const fact of list) {
      const quarter = fact.val - prev;
      if (Number.isFinite(quarter)) {
        out.push({ end: fact.end, start: prevEnd, filed: fact.filed, val: quarter });
      }
      prev = fact.val;
      prevEnd = fact.end;
    }
  }
  return dropNearDuplicates(out.sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0)));
}

/**
 * 10-K often has the full year but not a standalone Q4. Q4 = FY − Q1 − Q2 − Q3
 * when those three quarters sit inside the fiscal year.
 */
export function synthesizeFourthQuarter(quarters: DurationFact[], fiscalYears: DurationFact[]): DurationFact[] {
  const q = dropNearDuplicates(quarters);
  const have = new Set(q.map((row) => row.end));
  const extra: DurationFact[] = [];
  for (const fy of fiscalYears) {
    if ([...have].some((end) => {
      const gap = isoDays(end, fy.end);
      return gap != null && Math.abs(gap) < 40;
    })) {
      continue;
    }
    const inside = q.filter((row) => row.end > fy.start && row.end < fy.end);
    if (inside.length !== 3) continue;
    let sequential = true;
    for (let i = 1; i < inside.length; i++) {
      const gap = isoDays(inside[i - 1]!.end, inside[i]!.end);
      if (gap == null || gap < 70 || gap > 130) sequential = false;
    }
    if (!sequential) continue;
    const q4 = fy.val - inside.reduce((sum, row) => sum + row.val, 0);
    if (!Number.isFinite(q4)) continue;
    extra.push({ end: fy.end, start: inside[2]!.end, filed: fy.filed, val: q4 });
    have.add(fy.end);
  }
  return dropNearDuplicates([...q, ...extra].sort((a, b) => (a.end < b.end ? -1 : 1)));
}

export type TtmPoint = { periodEnd: string; availableOn: string; value: number };

export function trailingFourQuarter(quarters: DurationFact[]): TtmPoint[] {
  const rows = dropNearDuplicates(quarters);
  const out: TtmPoint[] = [];
  for (let i = 3; i < rows.length; i++) {
    const slice = rows.slice(i - 3, i + 1);
    let ok = true;
    for (let k = 1; k < slice.length; k++) {
      const gap = isoDays(slice[k - 1]!.end, slice[k]!.end);
      if (gap == null || gap < 70 || gap > 140) ok = false;
    }
    if (!ok) continue;
    const value = slice.reduce((sum, row) => sum + row.val, 0);
    if (!Number.isFinite(value)) continue;
    out.push({
      periodEnd: slice[3]!.end,
      availableOn: slice[3]!.filed,
      value,
    });
  }
  return out;
}

function instantAsOf(rows: InstantFact[], date: string): number | null {
  let hit: number | null = null;
  for (const row of rows) {
    if (row.end <= date) hit = row.val;
    else break;
  }
  return hit;
}

function ttmAsOf(rows: TtmPoint[], periodEnd: string): number | null {
  let best: number | null = null;
  let bestGap = 22;
  for (const row of rows) {
    const gap = isoDays(periodEnd, row.periodEnd);
    if (gap == null) continue;
    const abs = Math.abs(gap);
    if (abs < bestGap) {
      bestGap = abs;
      best = row.value;
    }
  }
  return bestGap <= 21 ? best : null;
}

function synthesizeTagged(json: unknown, tags: string[]): DurationFact[] {
  let bestQ: DurationFact[] = [];
  let bestFy: DurationFact[] = [];
  let bestEnd = "";
  let bestScore = -1;
  for (const tag of tags) {
    const q = collectDurationFacts(secRows(json, "us-gaap", tag), 70, 120);
    const fy = collectDurationFacts(secRows(json, "us-gaap", tag), 300, 380);
    const score = q.length + fy.length;
    const end = [...q, ...fy].reduce((max, row) => (row.end > max ? row.end : max), "");
    if (score === 0) continue;
    if (end > bestEnd || (end === bestEnd && score > bestScore)) {
      bestEnd = end;
      bestScore = score;
      bestQ = q;
      bestFy = fy;
    }
  }
  return synthesizeFourthQuarter(bestQ, bestFy);
}

function longestInstant(json: unknown, ns: "us-gaap" | "dei", tags: string[]): InstantFact[] {
  let best: InstantFact[] = [];
  for (const tag of tags) {
    const rows = collectInstantFacts(secRows(json, ns, tag));
    if (rows.length > best.length) best = rows;
  }
  return best;
}

/** SEC companyfacts → PIT rows the KR annual builder already understands. */
export function annualsFromCompanyFacts(json: unknown): { annuals: AnnualFundamental[]; name: string | null } {
  const name = typeof asRecord(json)?.entityName === "string" ? String(asRecord(json)?.entityName) : null;
  const epsQ = synthesizeTagged(json, ["EarningsPerShareDiluted", "EarningsPerShareBasic"]);
  const salesQ = synthesizeTagged(json, [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "SalesRevenueNet",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
  ]);
  const oiQ = synthesizeTagged(json, ["OperatingIncomeLoss"]);
  let daFacts: DurationFact[] = [];
  let daEnd = "";
  for (const tag of [
    "DepreciationDepletionAndAmortization",
    "DepreciationAndAmortization",
    "Depreciation",
  ]) {
    const facts = [
      ...collectDurationFacts(secRows(json, "us-gaap", tag), 70, 120),
      ...collectDurationFacts(secRows(json, "us-gaap", tag), 150, 200),
      ...collectDurationFacts(secRows(json, "us-gaap", tag), 240, 300),
      ...collectDurationFacts(secRows(json, "us-gaap", tag), 300, 380),
    ];
    const end = facts.reduce((max, row) => (row.end > max ? row.end : max), "");
    if (!facts.length) continue;
    if (end > daEnd || (end === daEnd && facts.length > daFacts.length)) {
      daFacts = facts;
      daEnd = end;
    }
  }
  const daQ = quartersFromCumulative(daFacts);
  const epsTtm = trailingFourQuarter(epsQ);
  const salesTtm = trailingFourQuarter(salesQ);
  const oiTtm = trailingFourQuarter(oiQ);
  const daTtm = trailingFourQuarter(daQ);
  const shares = collectInstantFacts([
    ...secRows(json, "dei", "EntityCommonStockSharesOutstanding"),
    ...secRows(json, "us-gaap", "CommonStockSharesOutstanding"),
  ]);
  let debtIsTotal = false;
  let debtLong = collectInstantFacts(secRows(json, "us-gaap", "LongTermDebtNoncurrent"));
  if (!debtLong.length) {
    debtLong = longestInstant(json, "us-gaap", [
      "LongTermDebtAndCapitalLeaseObligations",
      "LongTermDebt",
    ]);
    debtIsTotal = debtLong.length > 0;
  }
  const debtCurrent = debtIsTotal
    ? []
    : (() => {
        const primary = collectInstantFacts(secRows(json, "us-gaap", "LongTermDebtCurrent"));
        return primary.length
          ? primary
          : longestInstant(json, "us-gaap", ["DebtCurrent", "ShortTermBorrowings", "CommercialPaper"]);
      })();
  const cashPrimary = collectInstantFacts(secRows(json, "us-gaap", "CashAndCashEquivalentsAtCarryingValue"));
  const cash = cashPrimary.length
    ? cashPrimary
    : longestInstant(json, "us-gaap", [
        "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
        "Cash",
      ]);

  const annuals: AnnualFundamental[] = [];
  for (const row of epsTtm) {
    const sales = ttmAsOf(salesTtm, row.periodEnd);
    const oi = ttmAsOf(oiTtm, row.periodEnd);
    const da = ttmAsOf(daTtm, row.periodEnd);
    const ebitda = oi != null && da != null ? oi + da : null;
    const available = row.availableOn >= row.periodEnd ? row.availableOn : row.periodEnd;
    const sh = instantAsOf(shares, available);
    const debt = sumOrNull(instantAsOf(debtLong, available), instantAsOf(debtCurrent, available));
    const cashVal = instantAsOf(cash, available);
    const netDebt = debt != null && cashVal != null ? debt - cashVal : null;
    annuals.push({
      year: Number(available.slice(0, 4)),
      periodEnd: available,
      estimate: false,
      eps: row.value,
      per: null,
      ebitdaEok: ebitda == null ? null : ebitda / 1e8,
      salesEok: sales == null ? null : sales / 1e8,
      evEok: null,
      price: null,
      shares: sh,
      debtEok: debt == null ? null : debt / 1e8,
      evEbitda: null,
      netDebtEok: netDebt == null ? null : netDebt / 1e8,
    });
  }
  annuals.sort((a, b) => (a.periodEnd < b.periodEnd ? -1 : a.periodEnd > b.periodEnd ? 1 : 0));
  return { annuals, name };
}

function sumOrNull(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

function yearMonth(date: string): string {
  return date.slice(0, 7);
}

function pitAnnual(annuals: AnnualFundamental[], date: string): AnnualFundamental | null {
  const key = yearMonth(date);
  let hit: AnnualFundamental | null = null;
  for (const a of annuals) {
    if (a.estimate) continue;
    const end = a.periodEnd;
    const month = Number(end.slice(5, 7));
    const year = Number(end.slice(0, 4));
    const closesMonth = Number.isFinite(year) && month >= 1 && month <= 12 && lastDayIso(year, month) === end;
    // Fiscal month-ends (Korea annual) apply for the whole closing month.
    // Filing dates (US 10-Q/10-K) apply only on or after that day.
    const ok = closesMonth ? yearMonth(end) <= key : end <= date;
    if (ok) hit = a;
    else break;
  }
  return hit;
}

function posMult(m: number | null): number | null {
  return m != null && m > 0 && Number.isFinite(m) ? m : null;
}

function seriesFrom(
  dates: string[],
  prices: (number | null)[],
  values: (number | null)[],
  bands: PriceBandPoint[],
  basis: string,
): MultipleSeries {
  const pct = expandingPercentile(values);
  return {
    points: dates.map((date, i) => ({
      date,
      value: values[i] ?? null,
      percentile: pct[i] ?? null,
    })),
    priceBands: bands,
    stats: statsOf(values),
    unit: "배",
    basis,
  };
}

const NOTE =
  "네이버 컴퍼니가이드 IFRS 연결. 후행 PER·EV 배수는 직전 결산 실적을 결산일부터 적용한다(공시 시차 미반영). 선행 PER은 최신 연간 컨센서스 EPS로 나눈 값이며 과거 시점의 당시 컨센서스가 아니다. EV = 보통주 시가총액 + 결산기말 순차입금(공시 EV − 당시 보통주 시가총액). EPS≤0이면 PER 없음, EBITDA≤0이면 EV/EBITDA 없음.";

export function emptyValuationPack(code: string, note: string): ValuationPack {
  const basis = "데이터 없음";
  const empty = (): MultipleSeries => ({
    points: [],
    priceBands: [],
    stats: emptyStats(),
    unit: "배",
    basis,
  });
  return {
    code,
    source: "none",
    sourceUrl: "",
    note,
    name: null,
    currency: "KRW",
    drivers: [],
    window: { from: null, to: null },
    consensus: null,
    per: empty(),
    forwardPer: empty(),
    evEbitda: empty(),
    evSales: empty(),
    valuationBand: {
      basis: "none",
      basisLabel: "밸류에이션 밴드 없음",
      points: [],
      percentilePoints: [],
      stats: emptyStats(),
      note,
    },
  };
}

export function buildValuationPack(input: {
  code: string;
  annuals: AnnualFundamental[];
  consensus: ConsensusEps | null;
  months: MonthPrice[];
  source?: string;
  sourceUrl?: string;
  note?: string;
  name?: string | null;
  currency?: "KRW" | "USD";
}): ValuationPack {
  const annuals = [...input.annuals]
    .filter((a) => !a.estimate)
    .sort((x, y) => (x.periodEnd < y.periodEnd ? -1 : x.periodEnd > y.periodEnd ? 1 : 0));
  let months = [...input.months].filter((m) => m.price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(m.date));
  if (!months.length) {
    months = annuals
      .filter((a) => a.price != null && a.price > 0)
      .map((a) => ({ date: a.periodEnd, price: a.price! }));
  }
  const seen = new Set<string>();
  months = months
    .filter((m) => {
      if (seen.has(m.date)) return false;
      seen.add(m.date);
      return true;
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); // ked-allow-string-date-sort: single-format time series

  if (!annuals.length || !months.length) {
    return emptyValuationPack(
      input.code,
      "이 종목의 연간 투자지표 또는 월별 주가를 확인하지 못했습니다. ETF·재무 미수록 종목은 배수를 만들지 않습니다.",
    );
  }

  const dates: string[] = [];
  const prices: number[] = [];
  const perV: (number | null)[] = [];
  const fwdV: (number | null)[] = [];
  const evEbV: (number | null)[] = [];
  const evSaV: (number | null)[] = [];
  const epsAt: (number | null)[] = [];
  const ebitdaAt: (number | null)[] = [];
  const salesAt: (number | null)[] = [];
  const ndAt: (number | null)[] = [];
  const shAt: (number | null)[] = [];
  const drivers: ValuationDriver[] = [];

  const cns = input.consensus && input.consensus.eps > 0 ? input.consensus.eps : null;

  for (const m of months) {
    const a = pitAnnual(annuals, m.date);
    const nd = a
      ? a.netDebtEok != null && Number.isFinite(a.netDebtEok)
        ? a.netDebtEok
        : netDebtEok(a.evEok, a.price, a.shares)
      : null;
    const shares = a?.shares ?? null;
    let ev: number | null = null;
    if (shares != null && shares > 0 && nd != null) {
      ev = (m.price * shares) / 1e8 + nd;
    }
    dates.push(m.date);
    prices.push(m.price);
    epsAt.push(a?.eps ?? null);
    ebitdaAt.push(a?.ebitdaEok ?? null);
    salesAt.push(a?.salesEok ?? null);
    ndAt.push(nd);
    shAt.push(shares);
    drivers.push({
      date: m.date,
      price: m.price,
      eps: a?.eps ?? null,
      ebitdaEok: a?.ebitdaEok ?? null,
      salesEok: a?.salesEok ?? null,
      netDebtEok: nd,
      shares,
    });
    perV.push(trailingMultiple(m.price, a?.eps ?? null));
    fwdV.push(trailingMultiple(m.price, cns));
    evEbV.push(evMultiple(ev, a?.ebitdaEok ?? null));
    evSaV.push(evMultiple(ev, a?.salesEok ?? null));
  }

  const perStats = statsOf(perV);
  const fwdStats = statsOf(fwdV);
  const evEbStats = statsOf(evEbV);
  const evSaStats = statsOf(evSaV);

  const perBands: PriceBandPoint[] = dates.map((date, i) => ({
    date,
    price: prices[i] ?? null,
    mean: fairPriceFromPer(epsAt[i] ?? null, posMult(perStats.mean)),
    p1: fairPriceFromPer(epsAt[i] ?? null, posMult(perStats.p1)),
    m1: fairPriceFromPer(epsAt[i] ?? null, posMult(perStats.m1)),
    p2: fairPriceFromPer(epsAt[i] ?? null, posMult(perStats.p2)),
    m2: fairPriceFromPer(epsAt[i] ?? null, posMult(perStats.m2)),
  }));
  const fwdBands: PriceBandPoint[] = dates.map((date, i) => ({
    date,
    price: prices[i] ?? null,
    mean: fairPriceFromPer(cns, posMult(fwdStats.mean)),
    p1: fairPriceFromPer(cns, posMult(fwdStats.p1)),
    m1: fairPriceFromPer(cns, posMult(fwdStats.m1)),
    p2: fairPriceFromPer(cns, posMult(fwdStats.p2)),
    m2: fairPriceFromPer(cns, posMult(fwdStats.m2)),
  }));
  const evEbBands: PriceBandPoint[] = dates.map((date, i) => ({
    date,
    price: prices[i] ?? null,
    mean: fairPriceFromEvMultiple(ebitdaAt[i] ?? null, posMult(evEbStats.mean), ndAt[i] ?? null, shAt[i] ?? null),
    p1: fairPriceFromEvMultiple(ebitdaAt[i] ?? null, posMult(evEbStats.p1), ndAt[i] ?? null, shAt[i] ?? null),
    m1: fairPriceFromEvMultiple(ebitdaAt[i] ?? null, posMult(evEbStats.m1), ndAt[i] ?? null, shAt[i] ?? null),
    p2: fairPriceFromEvMultiple(ebitdaAt[i] ?? null, posMult(evEbStats.p2), ndAt[i] ?? null, shAt[i] ?? null),
    m2: fairPriceFromEvMultiple(ebitdaAt[i] ?? null, posMult(evEbStats.m2), ndAt[i] ?? null, shAt[i] ?? null),
  }));
  const evSaBands: PriceBandPoint[] = dates.map((date, i) => ({
    date,
    price: prices[i] ?? null,
    mean: fairPriceFromEvMultiple(salesAt[i] ?? null, posMult(evSaStats.mean), ndAt[i] ?? null, shAt[i] ?? null),
    p1: fairPriceFromEvMultiple(salesAt[i] ?? null, posMult(evSaStats.p1), ndAt[i] ?? null, shAt[i] ?? null),
    m1: fairPriceFromEvMultiple(salesAt[i] ?? null, posMult(evSaStats.m1), ndAt[i] ?? null, shAt[i] ?? null),
    p2: fairPriceFromEvMultiple(salesAt[i] ?? null, posMult(evSaStats.p2), ndAt[i] ?? null, shAt[i] ?? null),
    m2: fairPriceFromEvMultiple(salesAt[i] ?? null, posMult(evSaStats.m2), ndAt[i] ?? null, shAt[i] ?? null),
  }));

  const perBasis =
    "후행 PER = 수정주가 ÷ 직전 결산(또는 TTM) EPS. EPS가 0 이하이면 그 구간은 표시하지 않음.";
  const money = input.currency === "USD" ? "달러" : "원";
  const digits = input.currency === "USD" ? 2 : 0;
  const cnsText = cns == null
    ? ""
    : input.consensus?.horizon === "ntm"
      ? `NTM ${cns.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${money}`
      : `${input.consensus!.year}E ${cns.toLocaleString(input.currency === "USD" ? "en-US" : "ko-KR", { maximumFractionDigits: digits })}${money}`;
  const fwdBasis = cns
    ? `선행 PER = 수정주가 ÷ 최신 컨센서스 EPS (${cnsText}). 과거 시점의 당시 컨센서스가 아니다. 시계열은 동일 EPS로 나눈 경로다.`
    : "컨센서스 EPS가 없어 선행 PER을 계산하지 않음.";
  const evEbBasis =
    "EV/EBITDA. EV = 당시 보통주 시가총액 + 직전 결산 순차입금. EBITDA≤0이면 미표시.";
  const evSaBasis =
    "EV/Sales. 매출은 적자 구간에도 양수이면 사용. 밴드는 관측 EV/Sales의 평균 ±1σ ±2σ를 당시 매출·순차입금에 투영한 가격.";

  const per = seriesFrom(dates, prices, perV, perBands, perBasis);
  const forwardPer = seriesFrom(dates, prices, fwdV, fwdBands, fwdBasis);
  const evEbitda = seriesFrom(dates, prices, evEbV, evEbBands, evEbBasis);
  const evSales = seriesFrom(dates, prices, evSaV, evSaBands, evSaBasis);

  const perCurrent = per.stats.current != null;
  let basis: ValuationBand["basis"] = "none";
  if (perCurrent && per.stats.n >= 8) basis = "per";
  else if (evSales.stats.n >= 8) basis = "evSales";
  else if (perCurrent && per.stats.n >= 2) basis = "per";
  else if (evSales.stats.n >= 2) basis = "evSales";

  const chosen = basis === "per" ? per : basis === "evSales" ? evSales : null;
  const valuationBand: ValuationBand = {
    basis,
    basisLabel:
      basis === "per"
        ? "후행 PER 평균 ±1σ ±2σ를 당시 EPS에 곱해 주가에 투영"
        : basis === "evSales"
          ? "EV/Sales 평균 ±1σ ±2σ를 당시 매출·순차입금에 투영 (PER 표본 부족 또는 EPS≤0)"
          : "밴드를 그릴 양의 배수 표본이 부족함",
    points: chosen?.priceBands ?? [],
    percentilePoints: chosen?.points ?? [],
    stats: chosen?.stats ?? emptyStats(),
    note:
      "가격 밴드의 배수는 전체 관측 구간의 평균·표준편차(사후)다. 백분위 선은 그 달까지의 과거만 사용한다. 현재 백분위는 전체 양의 배수 중 현재 이하 비율.",
  };

  return {
    code: input.code,
    source: input.source ?? "naver-companyguide",
    sourceUrl:
      input.sourceUrl ??
      `https://navercomp.wisereport.co.kr/v2/company/c1040001.aspx?cmp_cd=${input.code}`,
    note: input.note ?? NOTE,
    name: input.name ?? null,
    currency: input.currency ?? "KRW",
    drivers,
    window: { from: dates[0] ?? null, to: dates[dates.length - 1] ?? null },
    consensus: input.consensus,
    per,
    forwardPer,
    evEbitda,
    evSales,
    valuationBand,
  };
}

/** Recompute mean, σ, bands, and percentiles on points inside the window. */
export function resliceValuation(pack: ValuationPack, from: string | null): ValuationPack {
  if (!from || pack.drivers.length < 2) return pack;
  const drivers = pack.drivers.filter((row) => row.date >= from);
  if (drivers.length < 2 || drivers.length === pack.drivers.length) return pack;
  const cns = pack.consensus && pack.consensus.eps > 0 ? pack.consensus.eps : null;

  const perV = drivers.map((row) => trailingMultiple(row.price, row.eps));
  const fwdV = drivers.map((row) => trailingMultiple(row.price, cns));
  const evEbV = drivers.map((row) => {
    if (row.shares == null || !(row.shares > 0) || row.netDebtEok == null) return null;
    const ev = (row.price * row.shares) / 1e8 + row.netDebtEok;
    return evMultiple(ev, row.ebitdaEok);
  });
  const evSaV = drivers.map((row) => {
    if (row.shares == null || !(row.shares > 0) || row.netDebtEok == null) return null;
    const ev = (row.price * row.shares) / 1e8 + row.netDebtEok;
    return evMultiple(ev, row.salesEok);
  });
  const dates = drivers.map((row) => row.date);
  const prices = drivers.map((row) => row.price);

  const perStats = statsOf(perV);
  const fwdStats = statsOf(fwdV);
  const evEbStats = statsOf(evEbV);
  const evSaStats = statsOf(evSaV);
  const perBands = dates.map((date, i) => ({
    date,
    price: prices[i] ?? null,
    mean: fairPriceFromPer(drivers[i]?.eps ?? null, posMult(perStats.mean)),
    p1: fairPriceFromPer(drivers[i]?.eps ?? null, posMult(perStats.p1)),
    m1: fairPriceFromPer(drivers[i]?.eps ?? null, posMult(perStats.m1)),
    p2: fairPriceFromPer(drivers[i]?.eps ?? null, posMult(perStats.p2)),
    m2: fairPriceFromPer(drivers[i]?.eps ?? null, posMult(perStats.m2)),
  }));
  const evSaBands = dates.map((date, i) => ({
    date,
    price: prices[i] ?? null,
    mean: fairPriceFromEvMultiple(drivers[i]?.salesEok ?? null, posMult(evSaStats.mean), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
    p1: fairPriceFromEvMultiple(drivers[i]?.salesEok ?? null, posMult(evSaStats.p1), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
    m1: fairPriceFromEvMultiple(drivers[i]?.salesEok ?? null, posMult(evSaStats.m1), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
    p2: fairPriceFromEvMultiple(drivers[i]?.salesEok ?? null, posMult(evSaStats.p2), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
    m2: fairPriceFromEvMultiple(drivers[i]?.salesEok ?? null, posMult(evSaStats.m2), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
  }));
  const evEbBands = dates.map((date, i) => ({
    date,
    price: prices[i] ?? null,
    mean: fairPriceFromEvMultiple(drivers[i]?.ebitdaEok ?? null, posMult(evEbStats.mean), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
    p1: fairPriceFromEvMultiple(drivers[i]?.ebitdaEok ?? null, posMult(evEbStats.p1), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
    m1: fairPriceFromEvMultiple(drivers[i]?.ebitdaEok ?? null, posMult(evEbStats.m1), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
    p2: fairPriceFromEvMultiple(drivers[i]?.ebitdaEok ?? null, posMult(evEbStats.p2), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
    m2: fairPriceFromEvMultiple(drivers[i]?.ebitdaEok ?? null, posMult(evEbStats.m2), drivers[i]?.netDebtEok ?? null, drivers[i]?.shares ?? null),
  }));
  const fwdBands = dates.map((date, i) => ({
    date,
    price: prices[i] ?? null,
    mean: fairPriceFromPer(cns, posMult(fwdStats.mean)),
    p1: fairPriceFromPer(cns, posMult(fwdStats.p1)),
    m1: fairPriceFromPer(cns, posMult(fwdStats.m1)),
    p2: fairPriceFromPer(cns, posMult(fwdStats.p2)),
    m2: fairPriceFromPer(cns, posMult(fwdStats.m2)),
  }));

  const per = seriesFrom(dates, prices, perV, perBands, pack.per.basis);
  const forwardPer = seriesFrom(dates, prices, fwdV, fwdBands, pack.forwardPer.basis);
  const evEbitda = seriesFrom(dates, prices, evEbV, evEbBands, pack.evEbitda.basis);
  const evSales = seriesFrom(dates, prices, evSaV, evSaBands, pack.evSales.basis);
  const perCurrent = per.stats.current != null;
  let basis: ValuationBand["basis"] = "none";
  if (perCurrent && per.stats.n >= 8) basis = "per";
  else if (evSales.stats.n >= 8) basis = "evSales";
  else if (perCurrent && per.stats.n >= 2) basis = "per";
  else if (evSales.stats.n >= 2) basis = "evSales";
  const chosen = basis === "per" ? per : basis === "evSales" ? evSales : null;
  return {
    ...pack,
    drivers,
    window: { from: dates[0] ?? null, to: dates[dates.length - 1] ?? null },
    per,
    forwardPer,
    evEbitda,
    evSales,
    valuationBand: {
      basis,
      basisLabel: pack.valuationBand.basisLabel,
      points: chosen?.priceBands ?? [],
      percentilePoints: chosen?.points ?? [],
      stats: chosen?.stats ?? emptyStats(),
      note: "평균·표준편차·밴드는 선택한 구간만 사용한다. 백분위 선도 그 구간 안에서만 과거를 본다.",
    },
  };
}
