import { partnerName } from "./hs-map.ts";

export interface DestinationRow {
  partnerCode: string;
  name: string;
  valueUsd: number;
  /** World denominator absent/invalid, or partner > world → unknown. */
  share: number | null;
}

function positiveValue(raw: unknown): number | null {
  if (raw == null || raw === "" || typeof raw === "boolean") return null;
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function destinationRows(rows: readonly Record<string, unknown>[]): DestinationRow[] {
  const world = rows.find((row) => String(row.partnerCode) === "0");
  const total = positiveValue(world?.primaryValue);
  return rows
    .flatMap((row): DestinationRow[] => {
      const partnerCode = String(row.partnerCode ?? "");
      const valueUsd = positiveValue(row.primaryValue);
      if (!/^\d+$/.test(partnerCode) || partnerCode === "0" || valueUsd == null) return [];
      return [
        {
          partnerCode,
          name: partnerName(partnerCode),
          valueUsd,
          share: total != null && valueUsd <= total ? valueUsd / total : null,
        },
      ];
    })
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, 18);
}
