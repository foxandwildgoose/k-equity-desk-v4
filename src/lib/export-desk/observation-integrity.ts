import type { TradeObservation } from "./parse-import.ts";

/** Calendar gaps stay missing; 12 observed rows must not masquerade as 12 months. */
export function completeMonthlyObservations(rows: readonly TradeObservation[]): TradeObservation[] {
  const valid = rows.filter((row) => /^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/.test(row.period));
  if (!valid.length) return [];
  const identity = (row: TradeObservation) =>
    JSON.stringify([row.categoryId, row.classification, row.geo ?? ""]);
  // Calendar completion is for one series, never a reduction across geographies
  // or classifications. Callers must select their intended series first.
  if (valid.some((row) => identity(row) !== identity(valid[0]!))) return [];
  const byPeriod = new Map<string, TradeObservation>();
  for (const row of valid) {
    const normalized =
      Number.isFinite(row.valueUsd) && row.valueUsd >= 0 ? row : { ...row, valueUsd: Number.NaN };
    const existing = byPeriod.get(row.period);
    if (!existing) byPeriod.set(row.period, normalized);
    else if (!Object.is(existing.valueUsd, normalized.valueUsd)) {
      // Without an explicit revision decision, neither conflicting value wins.
      byPeriod.set(row.period, {
        ...existing,
        valueUsd: Number.NaN,
        sourceFile: "상충 관측: 원자료 확인 필요",
        vintage: "conflict",
      });
    }
  }
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
        geo: template.geo,
        valueUsd: Number.NaN,
        sourceFile: "관측 미확보",
        vintage: "missing",
      },
    );
  }
  return out;
}
