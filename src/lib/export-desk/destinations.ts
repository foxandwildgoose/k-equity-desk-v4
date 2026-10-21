import { partnerName } from "./hs-map.ts";

export interface DestinationRow {
  partnerCode: string;
  name: string;
  valueUsd: number;
  /** Unknown when the world denominator or country coverage is inconsistent. */
  share: number | null;
}

function nonnegativeValue(raw: unknown): number | null {
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  if (typeof raw === "string" && !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim()))
    return null;
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function destinationRows(rows: readonly Record<string, unknown>[]): DestinationRow[] {
  const byPartner = new Map<string, { partnerCode: string; valueUsd: number }>();
  const conflicts = new Set<string>();
  for (const row of rows) {
    const partnerCode = String(row.partnerCode ?? "").trim();
    const valueUsd = nonnegativeValue(row.primaryValue);
    if (!/^\d{1,3}$/.test(partnerCode) || valueUsd == null) continue;
    // Canonicalize leading zeros and the two US codes so a mixed response
    // cannot count one destination twice. Distinct dimension rows are not sums.
    const key = Number(partnerCode) === 842 ? "840" : String(Number(partnerCode));
    const existing = byPartner.get(key);
    if (existing && existing.valueUsd !== valueUsd) conflicts.add(key);
    else if (!existing) byPartner.set(key, { partnerCode, valueUsd });
  }
  const world = conflicts.has("0") ? null : byPartner.get("0")?.valueUsd;
  const countries = [...byPartner.entries()].filter(([key]) => key !== "0" && !conflicts.has(key));
  const sum = countries.reduce((s, [, row]) => s + row.valueUsd, 0);
  const coherent =
    !conflicts.size &&
    world != null &&
    world > 0 &&
    Number.isFinite(sum) &&
    sum <= world * (1 + 1e-10);
  return countries
    .map(([, { partnerCode, valueUsd }]): DestinationRow => ({
      partnerCode,
      name: partnerName(partnerCode),
      valueUsd,
      share: coherent && valueUsd <= world! ? valueUsd / world! : null,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, 18);
}
