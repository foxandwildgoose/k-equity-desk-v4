import type { TradeObservation } from "./parse-import.ts";

/** Calendar gaps stay missing; 12 observed rows must not masquerade as 12 months. */
export function completeMonthlyObservations(rows: readonly TradeObservation[]): TradeObservation[] {
  const byPeriod = new Map(
    rows
      .filter((row) => /^\d{4}-(?:0[1-9]|1[0-2])$/.test(row.period))
      .map((row) => [row.period, row]),
  );
  const periods = [...byPeriod.keys()].sort();
  const first = periods[0],
    last = periods.at(-1);
  if (!first || !last) return [];
  const template = byPeriod.get(first)!;
  const ordinal = (period: string) =>
    Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1;
  const out: TradeObservation[] = [];
  for (let month = ordinal(first); month <= ordinal(last); month++) {
    const period = `${String(Math.floor(month / 12)).padStart(4, "0")}-${String((month % 12) + 1).padStart(2, "0")}`;
    out.push(
      byPeriod.get(period) ?? {
        period,
        categoryId: template.categoryId,
        categoryName: template.categoryName,
        classification: template.classification,
        valueUsd: Number.NaN,
        sourceFile: "관측 미확보",
        vintage: "missing",
      },
    );
  }
  return out;
}
