import { validateUniverseSnapshot, type SecurityMember, type UniverseSnapshot } from "../lib/bollinger/discovery-universe.ts";

export type KrMembershipProgress = { members: SecurityMember[]; total: number | null; asOf: string; nextPage: number; collectionDay: string; startedAt: string };
export const koreaDay = (now: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
/** Partial listing pages are checkpoints, never published as a complete universe. */
export async function fetchKrMembershipBatch(kind: "KOSPI" | "KOSDAQ", previous: KrMembershipProgress | null, options: {
  fetcher?: typeof fetch; now?: () => string; maxPages?: number; spacingMs?: number;
  sector?: (symbol: string) => { sector: string; source: string } | null;
  checkpoint?: () => Promise<void>; onPage?: (progress: KrMembershipProgress) => Promise<void>;
} = {}): Promise<{ progress: KrMembershipProgress; snapshot: UniverseSnapshot | null }> {
  const now = options.now ?? (() => new Date().toISOString()), timestamp = now(), day = koreaDay(timestamp);
  // Current membership pages observed on different dates cannot form one snapshot.
  const progress: KrMembershipProgress = previous?.collectionDay === day ? structuredClone(previous) : { members: [], total: null, asOf: "", nextPage: 1, collectionDay: day, startedAt: timestamp };
  const seen = new Set(progress.members.map(m => m.symbol));
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 4, 100));
  for (let n = 0; n < maxPages && (progress.total === null || seen.size < progress.total); n++) {
    if (progress.nextPage > 100) throw new Error("KR_MEMBERSHIP_INCOMPLETE");
    await options.checkpoint?.();
    if (n > 0 && (options.spacingMs ?? 500) > 0) await new Promise(resolve => setTimeout(resolve, options.spacingMs ?? 500));
    const response = await (options.fetcher ?? fetch)(`https://m.stock.naver.com/api/stocks/marketValue/${kind}?page=${progress.nextPage}&pageSize=100`, { headers: { "User-Agent": "Mozilla/5.0 KoreaEquityCommand/1.0" }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error("KR_MEMBERSHIP_FETCH_FAILED");
    const data = await response.json() as { totalCount?: number; stocks?: { itemCode?: string; stockName?: string; stockEndType?: string; marketValue?: string; localTradedAt?: string }[] };
    if (!Number.isInteger(data.totalCount) || data.totalCount! < 1 || data.totalCount! > 10000 || !Array.isArray(data.stocks)) throw new Error("KR_MEMBERSHIP_SCHEMA_FAILED");
    if (progress.total !== null && progress.total !== data.totalCount) throw new Error("KR_MEMBERSHIP_CHANGED_RESTART_REQUIRED");
    progress.total = data.totalCount!;
    let advanced = 0;
    for (const row of data.stocks) {
      if (!row.itemCode || !/^[0-9A-Z]{6}$/.test(row.itemCode) || !row.stockName) throw new Error("KR_MEMBERSHIP_SCHEMA_FAILED");
      if (seen.has(row.itemCode)) continue;
      seen.add(row.itemCode); advanced++;
      const meta = options.sector?.(row.itemCode), cap = typeof row.marketValue === "string" && /^\d[\d,]*(\.\d+)?$/.test(row.marketValue) ? Number(row.marketValue.replaceAll(",", "")) : null;
      progress.asOf = [progress.asOf, row.localTradedAt?.slice(0, 10) ?? ""].sort().at(-1)!;
      progress.members.push({ market: "KR", symbol: row.itemCode, name: row.stockName, exchange: kind, sector: meta?.sector ?? "Unknown", sectorSource: meta?.source ?? null, marketCap: cap === null ? null : cap * 1e8, indexWeight: null, weight: null, identityVerified: true,
        assetType: row.stockEndType === "stock" && !/우$|우B$|우C$|우선|[123]우/.test(row.stockName.replaceAll(" ", "")) ? "equity" : row.stockEndType === "etf" ? "etf" : "unknown" });
    }
    if (!advanced || seen.size > progress.total) throw new Error("KR_MEMBERSHIP_PARTIAL_OR_REPEATED_PAGE");
    progress.nextPage++;
    await options.onPage?.(structuredClone(progress));
  }
  if (progress.total === null || seen.size < progress.total) return { progress, snapshot: null };
  const completedAt = now();
  const snapshot = validateUniverseSnapshot({ id: `${kind}:${progress.startedAt}`, kind, label: kind, asOf: progress.asOf, knownAt: completedAt, fetchedAt: completedAt, source: "Naver market-value listing; cap in KRW (억 × 10^8)", sourceUrl: `https://m.stock.naver.com/api/stocks/marketValue/${kind}`, authoritative: false, historical: false, members: progress.members });
  return { progress, snapshot };
}
