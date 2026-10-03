export type ExclusionRuleId =
  | "PREFERRED"
  | "ETF"
  | "ETN"
  | "REIT"
  | "SPAC"
  | "NON_OPERATING";

export const DEFAULT_EXCLUSIONS: Record<ExclusionRuleId, boolean> = {
  PREFERRED: true,
  ETF: true,
  ETN: true,
  REIT: true,
  SPAC: true,
  NON_OPERATING: true,
};

export interface RankableSecurity {
  ticker: string;
  name: string;
  marketCap: number;
  date: string;
  isPreferred?: boolean;
  isEtf?: boolean;
  isEtn?: boolean;
  isReit?: boolean;
  isSpac?: boolean;
  isNonOperating?: boolean;
  commonTicker?: string;
}

export interface TopNMember {
  rank: number;
  ticker: string;
  name: string;
  marketCap: number;
  asOf: string;
}

export function applyExclusionRules(
  row: RankableSecurity,
  rules: Record<ExclusionRuleId, boolean>,
): boolean {
  if (rules.PREFERRED && row.isPreferred) return false;
  if (rules.ETF && row.isEtf) return false;
  if (rules.ETN && row.isEtn) return false;
  if (rules.REIT && row.isReit) return false;
  if (rules.SPAC && row.isSpac) return false;
  if (rules.NON_OPERATING && row.isNonOperating) return false;
  return true;
}

/** Rank KOSPI common issuers by market cap on a single date. */
export function rankKospiByMarketCap(
  rows: RankableSecurity[],
  opts?: { n?: number; rules?: Record<ExclusionRuleId, boolean>; date?: string },
): TopNMember[] {
  const n = opts?.n ?? 100;
  const rules = opts?.rules ?? DEFAULT_EXCLUSIONS;
  const date = opts?.date;
  const filtered = rows.filter((r) => {
    if (date && r.date !== date) return false;
    return applyExclusionRules(r, rules);
  });
  const byIssuer = new Map<string, RankableSecurity>();
  for (const r of filtered) {
    const key = r.commonTicker ?? r.ticker;
    const prev = byIssuer.get(key);
    if (!prev || r.marketCap > prev.marketCap) byIssuer.set(key, { ...r, ticker: key });
  }
  return [...byIssuer.values()]
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, n)
    .map((r, i) => ({
      rank: i + 1,
      ticker: r.ticker,
      name: r.name,
      marketCap: r.marketCap,
      asOf: r.date,
    }));
}

export function resolvePointInTimeTop100(
  snapshots: { date: string; members: TopNMember[] }[],
  asOf: string,
): TopNMember[] {
  const eligible = snapshots
    .filter((s) => s.date <= asOf)
    .sort((a, b) => b.date.localeCompare(a.date)); // ked-allow-string-date-sort: single-format time series
  return eligible[0]?.members ?? [];
}

export function isInUniverseOnDate(
  ticker: string,
  asOf: string,
  snapshots: { date: string; members: TopNMember[] }[],
): boolean {
  return resolvePointInTimeTop100(snapshots, asOf).some((m) => m.ticker === ticker);
}
