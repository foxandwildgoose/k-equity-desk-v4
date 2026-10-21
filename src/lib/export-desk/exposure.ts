export type ValueChainRole =
  "MATERIALS" | "EQUIPMENT" | "COMPONENTS" | "DEVICE_MAKER" | "DOWNSTREAM" | "LOGISTICS";

export type ProvisionalTier = "PRIMARY" | "MATERIAL" | "MINOR";

export type VerificationStatus = "VERIFIED_DART" | "VERIFIED_MANUAL" | "UNVERIFIED_SEED";

export interface CompanyExportExposure {
  ticker: string;
  companyName: string;
  exportCategoryId: string;
  exportCategoryName: string;
  valueChainRole: ValueChainRole;
  exposureWeight: number;
  mappingConfidence: number;
  mappingType: "PRIMARY" | "SECONDARY" | "MULTI_SEGMENT";
  verificationStatus: VerificationStatus;
  evidenceSummary: string;
  evidenceSource: string[];
  effectiveFrom: string;
  effectiveTo?: string;
  lastReviewedAt: string;
  active?: boolean;
  inactiveReason?: string;
}

export const TIER_WEIGHT: Record<ProvisionalTier, number> = {
  PRIMARY: 0.6,
  MATERIAL: 0.3,
  MINOR: 0.1,
};

export const DEFAULT_WEIGHT_THRESHOLD = 0.2;
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

const unitInterval = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1;

function validDate(date: string): boolean {
  if (typeof date !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function validHttpSource(source: unknown): boolean {
  if (typeof source !== "string") return false;
  try {
    const url = new URL(source);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function seedWeight(tier: ProvisionalTier): number {
  return TIER_WEIGHT[tier];
}

export function validateWeightConservation(
  rows: { ticker: string; exposureWeight: number; active?: boolean }[],
): { ok: boolean; ticker?: string; sum?: number; error?: string } {
  const sums = new Map<string, number>();
  for (const r of rows) {
    if (r.active === false) continue;
    if (!Number.isFinite(r.exposureWeight) || r.exposureWeight < 0 || r.exposureWeight > 1) {
      return {
        ok: false,
        ticker: r.ticker,
        error: "노출 가중치는 0~1 사이의 유효한 숫자여야 합니다.",
      };
    }
    sums.set(r.ticker, (sums.get(r.ticker) ?? 0) + r.exposureWeight);
  }
  for (const [ticker, sum] of sums) {
    if (sum > 1 + 1e-9) {
      return {
        ok: false,
        ticker,
        sum,
        error: `exposure weights for ${ticker} sum to ${sum.toFixed(3)} > 1.00`,
      };
    }
  }
  return { ok: true };
}

/** Descriptive seed tiers cannot become numeric financial exposure evidence. */
export function isEvidenceBackedExposure(row: CompanyExportExposure): boolean {
  return (
    row != null &&
    ["VERIFIED_DART", "VERIFIED_MANUAL"].includes(row.verificationStatus) &&
    unitInterval(row.exposureWeight) &&
    row.exposureWeight > 0 &&
    unitInterval(row.mappingConfidence) &&
    validDate(row.effectiveFrom) &&
    (!row.effectiveTo || (validDate(row.effectiveTo) && row.effectiveTo >= row.effectiveFrom)) &&
    Array.isArray(row.evidenceSource) &&
    row.evidenceSource.some(validHttpSource)
  );
}

export function isActiveOn(row: CompanyExportExposure, date: string): boolean {
  if (!row || row.active === false || !validDate(date)) return false;
  if (row.effectiveFrom && !validDate(row.effectiveFrom)) return false;
  if (
    row.effectiveTo &&
    (!validDate(row.effectiveTo) || (row.effectiveFrom && row.effectiveTo < row.effectiveFrom))
  )
    return false;
  if (row.effectiveFrom && date < row.effectiveFrom) return false;
  if (row.effectiveTo && date > row.effectiveTo) return false;
  return true;
}

export function resolveCompanySectorExposure(
  rows: CompanyExportExposure[],
  opts: {
    categoryId: string;
    asOf: string;
    top100Tickers: Set<string>;
    minWeight?: number;
    minConfidence?: number;
    primaryOnly?: boolean;
    includeInheritedFrom?: string;
  },
): CompanyExportExposure[] {
  const minW = opts.minWeight ?? DEFAULT_WEIGHT_THRESHOLD;
  const minC = opts.minConfidence ?? DEFAULT_CONFIDENCE_THRESHOLD;
  if (!unitInterval(minW) || !unitInterval(minC)) return [];
  const eligible = (r: CompanyExportExposure) =>
    isActiveOn(r, opts.asOf) &&
    opts.top100Tickers.has(r.ticker) &&
    unitInterval(r.exposureWeight) &&
    unitInterval(r.mappingConfidence);
  let list = rows.filter((r) => {
    if (!eligible(r)) return false;
    const catOk =
      r.exportCategoryId === opts.categoryId ||
      (opts.includeInheritedFrom != null && r.exportCategoryId === opts.includeInheritedFrom);
    if (!catOk) return false;
    if (r.exposureWeight < minW) return false;
    if (r.mappingConfidence < minC) return false;
    return true;
  });
  if (opts.primaryOnly) {
    const best = new Map<string, CompanyExportExposure>();
    for (const r of rows.filter(eligible)) {
      const prev = best.get(r.ticker);
      if (!prev || r.exposureWeight > prev.exposureWeight) best.set(r.ticker, r);
    }
    list = list.filter((r) => best.get(r.ticker)?.exportCategoryId === r.exportCategoryId);
  }
  return list.sort((a, b) => b.exposureWeight - a.exposureWeight);
}

export function deriveExposureFromSegments(
  segments: { categoryId: string; revenue: number }[],
): { categoryId: string; exposureWeight: number }[] {
  if (segments.some((s) => !s.categoryId?.trim() || !Number.isFinite(s.revenue) || s.revenue < 0))
    return [];
  const byCategory = new Map<string, number>();
  for (const s of segments)
    byCategory.set(s.categoryId, (byCategory.get(s.categoryId) ?? 0) + s.revenue);
  const total = [...byCategory.values()].reduce((sum, value) => sum + value, 0);
  if (!(total > 0) || !Number.isFinite(total)) return [];
  return [...byCategory].map(([categoryId, revenue]) => ({
    categoryId,
    exposureWeight: revenue / total,
  }));
}

export function aggregateHskToMti(
  hskRows: { hsk: string; value: number; period: string }[],
  crosswalk: { hsk: string; mti: string; version: string }[],
  version: string,
): {
  mti: string;
  period: string;
  value: number;
  derivation: "AGGREGATED_FROM_HSK";
}[] {
  if (!version) return [];
  const map = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const c of crosswalk) {
    if (c.version !== version) continue;
    if (!/^\d{10}$/.test(c.hsk) || !/^\d{1,6}$/.test(c.mti)) {
      ambiguous.add(c.hsk);
      continue;
    }
    const previous = map.get(c.hsk);
    if (previous != null && previous !== c.mti) ambiguous.add(c.hsk);
    else map.set(c.hsk, c.mti);
  }
  const acc = new Map<string, number>();
  const invalidPeriods = new Set<string>();
  const observed = new Map<string, number>();
  for (const r of hskRows) {
    const mti = map.get(r.hsk);
    if (
      !/^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/.test(r.period) ||
      !mti ||
      ambiguous.has(r.hsk) ||
      !Number.isFinite(r.value) ||
      r.value < 0
    ) {
      invalidPeriods.add(r.period);
      continue;
    }
    const observationKey = `${r.hsk}|${r.period}`;
    const previous = observed.get(observationKey);
    if (previous != null) {
      if (previous !== r.value) invalidPeriods.add(r.period);
      continue;
    }
    observed.set(observationKey, r.value);
    const key = `${mti}|${r.period}`;
    const sum = (acc.get(key) ?? 0) + r.value;
    if (!Number.isFinite(sum)) invalidPeriods.add(r.period);
    else acc.set(key, sum);
  }
  return [...acc.entries()].flatMap(([key, value]) => {
    const [mti, period] = key.split("|");
    if (invalidPeriods.has(period!)) return [];
    return [{ mti: mti!, period: period!, value, derivation: "AGGREGATED_FROM_HSK" as const }];
  });
}

export function validateTradeTotals(
  parts: number[],
  officialTotal: number,
  tolPct = 2,
): { gap: number; gapPct: number; pass: boolean } {
  if (
    !parts.length ||
    parts.some((v) => !Number.isFinite(v) || v < 0) ||
    !Number.isFinite(officialTotal) ||
    officialTotal < 0 ||
    !Number.isFinite(tolPct) ||
    tolPct < 0
  ) {
    return { gap: Number.NaN, gapPct: Number.NaN, pass: false };
  }
  const sum = parts.reduce((a, b) => a + b, 0);
  const gap = sum - officialTotal;
  const gapPct = officialTotal === 0 ? (sum === 0 ? 0 : 100) : (gap / officialTotal) * 100;
  return { gap, gapPct, pass: Math.abs(gapPct) <= tolPct };
}

export function applyCorporateActionAdjustment(price: number, splitRatio: number): number | null {
  if (!(splitRatio > 0) || !Number.isFinite(splitRatio) || !Number.isFinite(price) || price <= 0)
    return null;
  const adjusted = price / splitRatio;
  return Number.isFinite(adjusted) && adjusted > 0 ? adjusted : null;
}

export function assertNoMtiInHsParams(params: Record<string, string>): void {
  for (const [k, v] of Object.entries(params)) {
    const key = k.toLowerCase();
    if ((key.includes("hs") || key.includes("hsk")) && /^mti/i.test(v)) {
      throw new Error(`MTI code passed to HS/HSK parameter ${k}`);
    }
    if (key.includes("hs") && /^\d{6}$/.test(v) && key.includes("mti")) {
      throw new Error(`MTI-looking value in HS param ${k}`);
    }
  }
}
