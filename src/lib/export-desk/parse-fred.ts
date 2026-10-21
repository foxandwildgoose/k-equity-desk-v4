import { parseCsv } from "./parse-import.ts";

export interface FredPoint {
  period: string;
  valueUsd: number;
}

export interface FredUnitMetadata {
  units: string;
  frequency?: string;
}

function usdFactor(metadata?: FredUnitMetadata): number | null {
  // Existing callers use a raw-USD series. Alternative scales require explicit
  // FRED metadata; a series identifier or the magnitude alone is not evidence.
  if (!metadata) return 1;
  if (metadata.frequency && !/^monthly$/i.test(metadata.frequency.trim())) return null;
  const units = metadata.units.toLowerCase().replace(/[.\s]/g, "");
  if (/^(?:us|unitedstates)?dollars$|^usd$/.test(units)) return 1;
  if (/^thousandsof(?:us|unitedstates)?dollars$/.test(units)) return 1_000;
  if (/^millionsof(?:us|unitedstates)?dollars$/.test(units)) return 1_000_000;
  if (/^billionsof(?:us|unitedstates)?dollars$/.test(units)) return 1_000_000_000;
  return null;
}

export function parseFredCsv(
  csv: string,
  seriesId?: string,
  metadata?: FredUnitMetadata,
): FredPoint[] {
  const factor = usdFactor(metadata);
  if (factor == null) return [];
  let table: string[][];
  try {
    table = parseCsv(csv);
  } catch {
    return [];
  }
  const header = table[0];
  if (!header || !/^(?:date|observation_date)$/i.test(header[0] ?? "")) return [];
  const valueColumn = seriesId
    ? header.findIndex((h) => h === seriesId)
    : header.length === 2
      ? 1
      : -1;
  if (valueColumn < 1) return [];
  const byMonth = new Map<string, number>();
  const conflicts = new Set<string>();
  for (const row of table.slice(1)) {
    const date = row[0] ?? "",
      raw = row[valueColumn] ?? "";
    if (
      !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)
    )
      continue;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) continue;
    const valueUsd = Number(raw) * factor;
    if (!Number.isFinite(valueUsd) || valueUsd < 0) continue;
    const period = date.slice(0, 7);
    const previous = byMonth.get(period);
    if (previous != null && previous !== valueUsd) conflicts.add(period);
    else byMonth.set(period, valueUsd);
  }
  return [...byMonth.entries()]
    .filter(([period]) => !conflicts.has(period))
    .sort(([a], [b]) => a.localeCompare(b)) // ked-allow-string-date-sort: validated monthly ISO periods
    .map(([period, valueUsd]) => ({ period, valueUsd }));
}
