/**
 * Delayed market snapshot tiles from the Yahoo chart endpoint (F3.2 / F3.6).
 * Fixed symbol allowlist — NOT routed through `yahooUsSymbol` (which rejects
 * `^`, `=`, `-`). Values come only from the response `meta`; missing → null.
 */
import { fetchJsonWithPolicy } from "@/server/feeds/http";
import { yahooChartSnapshot } from "@/lib/feed/parsers/generic";

export const SNAPSHOT_SYMBOLS = [
  { id: "spx", symbol: "^GSPC", label: "S&P 500" },
  { id: "ndx", symbol: "^NDX", label: "나스닥100" },
  { id: "dji", symbol: "^DJI", label: "다우" },
  { id: "rut", symbol: "^RUT", label: "러셀2000" },
  { id: "vix", symbol: "^VIX", label: "VIX" },
  { id: "tnx", symbol: "^TNX", label: "미 10년물 (^TNX)" },
  { id: "dxy", symbol: "DX-Y.NYB", label: "달러인덱스" },
  { id: "wti", symbol: "CL=F", label: "WTI" },
  { id: "gold", symbol: "GC=F", label: "금" },
  { id: "btc", symbol: "BTC-USD", label: "비트코인" },
  { id: "usdkrw", symbol: "KRW=X", label: "원/달러" },
] as const;

export type SnapshotId = (typeof SNAPSHOT_SYMBOLS)[number]["id"];

export interface SnapshotRow {
  id: SnapshotId;
  symbol: string;
  label: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  currency: string | null;
  asOf: string | null;
  delayMinutes: number | null;
  source: "Yahoo Finance";
  error?: string;
}

export async function fetchSnapshot(ids?: SnapshotId[]): Promise<{ rows: SnapshotRow[]; fetchedAt: string }> {
  const list = SNAPSHOT_SYMBOLS.filter((s) => !ids || ids.includes(s.id));
  const rows = await Promise.all(
    list.map(async (s): Promise<SnapshotRow> => {
      try {
        const json = await fetchJsonWithPolicy<unknown>(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.symbol)}?range=5d&interval=1d`,
          { sourceId: "yahoo-chart" },
        );
        const snap = yahooChartSnapshot(json);
        if (!snap) throw new Error("no meta");
        return {
          id: s.id,
          symbol: s.symbol,
          label: s.label,
          price: snap.price,
          change: snap.change,
          changePct: snap.changePct,
          currency: snap.currency,
          asOf: snap.asOf,
          delayMinutes: snap.delayMinutes,
          source: "Yahoo Finance",
        };
      } catch (err) {
        return {
          id: s.id,
          symbol: s.symbol,
          label: s.label,
          price: null,
          change: null,
          changePct: null,
          currency: null,
          asOf: null,
          delayMinutes: null,
          source: "Yahoo Finance",
          error: err instanceof Error ? err.message.slice(0, 120) : "error",
        };
      }
    }),
  );
  return { rows, fetchedAt: new Date().toISOString() };
}
