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
    row.verificationStatus !== "UNVERIFIED_SEED" &&
    Number.isFinite(row.exposureWeight) &&
    row.exposureWeight > 0 &&
    row.exposureWeight <= 1 &&
    row.evidenceSource.some((source) => /^https?:\/\//i.test(source))
  );
}

export function isActiveOn(row: CompanyExportExposure, date: string): boolean {
  if (row.active === false) return false;
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
  let list = rows.filter((r) => {
    if (!isActiveOn(r, opts.asOf)) return false;
    if (!opts.top100Tickers.has(r.ticker)) return false;
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
    for (const r of rows.filter(
      (x) => isActiveOn(x, opts.asOf) && opts.top100Tickers.has(x.ticker),
    )) {
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
  const total = segments.reduce((s, x) => s + Math.max(0, x.revenue), 0);
  if (!(total > 0)) return [];
  return segments.map((s) => ({
    categoryId: s.categoryId,
    exposureWeight: Math.max(0, s.revenue) / total,
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
  const map = new Map<string, string>();
  for (const c of crosswalk) {
    if (c.version === version) map.set(c.hsk, c.mti);
  }
  const acc = new Map<string, number>();
  for (const r of hskRows) {
    const mti = map.get(r.hsk);
    if (!mti) continue;
    const key = `${mti}|${r.period}`;
    acc.set(key, (acc.get(key) ?? 0) + r.value);
  }
  return [...acc.entries()].map(([key, value]) => {
    const [mti, period] = key.split("|");
    return { mti: mti!, period: period!, value, derivation: "AGGREGATED_FROM_HSK" as const };
  });
}

export function validateTradeTotals(
  parts: number[],
  officialTotal: number,
  tolPct = 2,
): { gap: number; gapPct: number; pass: boolean } {
  const sum = parts.reduce((a, b) => a + b, 0);
  const gap = sum - officialTotal;
  const gapPct = officialTotal === 0 ? (sum === 0 ? 0 : 100) : (gap / officialTotal) * 100;
  return { gap, gapPct, pass: Math.abs(gapPct) <= tolPct };
}

export function applyCorporateActionAdjustment(price: number, splitRatio: number): number | null {
  if (!(splitRatio > 0) || !Number.isFinite(price)) return null;
  return price / splitRatio;
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
