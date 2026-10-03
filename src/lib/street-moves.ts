/**
 * US Street Moves (F4.4): normalize Finviz rating rows into
 * action / rating from→to / PT from→to (+ Δ% only when both are in the row),
 * and export visible rows as CSV (AT-20). Pure module.
 */
import type { UsStreetNote } from "./us-street.ts";

export type StreetAction = "Upgrade" | "Downgrade" | "Initiate" | "Reiterate" | "PT change" | "Other";

export interface StreetMove {
  id: string;
  date: string;
  publishedAt: string | null;
  precision: UsStreetNote["precision"];
  ticker: string;
  broker: string;
  action: StreetAction;
  ratingFrom: string | null;
  ratingTo: string | null;
  ptFrom: number | null;
  ptTo: number | null;
  /** Only when both PT values are in the source row. */
  ptDeltaPct: number | null;
  tableUrl: string;
  articleUrl: string | null;
}

const ARROW = /\s*(?:→|->|⇒)\s*/;

function splitFromTo(raw: string | null | undefined): [string | null, string | null] {
  const s = (raw ?? "").trim();
  if (!s || s === "—") return [null, null];
  const parts = s.split(ARROW).map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 2) return [parts[0]!, parts[parts.length - 1]!];
  return [null, parts[0] ?? null];
}

function money(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function classifyAction(action: string, ptFrom: number | null, ptTo: number | null): StreetAction {
  const a = action.toLowerCase();
  if (a.includes("upgrade")) return "Upgrade";
  if (a.includes("downgrade")) return "Downgrade";
  if (a.includes("initiat") || a.includes("resumed")) return "Initiate";
  if (a.includes("target") || a.includes("price target")) return "PT change";
  if (a.includes("reiterat") || a.includes("maintain")) {
    return ptFrom != null && ptTo != null && ptFrom !== ptTo ? "PT change" : "Reiterate";
  }
  return "Other";
}

export function toStreetMove(note: UsStreetNote, articleUrl: string | null = null): StreetMove {
  const [rFrom, rTo] = splitFromTo(note.rating);
  const [pFrom, pTo] = splitFromTo(note.target);
  const ptFrom = money(pFrom);
  const ptTo = money(pTo);
  return {
    id: note.id,
    date: note.date,
    publishedAt: note.publishedAt,
    precision: note.precision,
    ticker: note.symbol,
    broker: note.broker,
    action: classifyAction(note.action, ptFrom, ptTo),
    ratingFrom: rFrom,
    ratingTo: rTo,
    ptFrom,
    ptTo,
    ptDeltaPct: ptFrom != null && ptTo != null ? Math.round(((ptTo - ptFrom) / ptFrom) * 1000) / 10 : null,
    tableUrl: note.pageUrl,
    articleUrl,
  };
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const STREET_CSV_HEADER = ["date", "ticker", "broker", "action", "rating_from", "rating_to", "pt_from", "pt_to", "pt_delta_pct", "source_table", "source_article"];

/** CSV of exactly the rows given (the visible, filtered rows). */
export function streetMovesCsv(rows: readonly StreetMove[]): string {
  const lines = [STREET_CSV_HEADER.join(",")];
  for (const r of rows) {
    lines.push(
      [r.date, r.ticker, r.broker, r.action, r.ratingFrom, r.ratingTo, r.ptFrom, r.ptTo, r.ptDeltaPct, r.tableUrl, r.articleUrl].map(csvCell).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** `ked-street-moves-YYYYMMDD-HHmm.csv` style names (symbol/timestamp in name). */
export function exportFileName(prefix: string, now = new Date(), ext = "csv"): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const kst = new Date(now.getTime() + 9 * 3_600_000);
  return `${prefix}-${kst.getUTCFullYear()}${p(kst.getUTCMonth() + 1)}${p(kst.getUTCDate())}-${p(kst.getUTCHours())}${p(kst.getUTCMinutes())}.${ext}`;
}
