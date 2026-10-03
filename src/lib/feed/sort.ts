/**
 * One shared newest-first comparator (B0.2) + opaque cursor paging.
 * Pure module — relative `.ts` imports only.
 */
import { kstDayKey } from "./time.ts";
import type { FeedItem } from "./types.ts";

export type SortableItem = Pick<FeedItem, "id" | "publishedAt" | "precision" | "seq" | "sourceTier">;

function timed(item: SortableItem): boolean {
  return item.precision === "second" || item.precision === "minute";
}

function ts(item: SortableItem): number {
  const ms = item.publishedAt ? Date.parse(item.publishedAt) : Number.NaN;
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

/**
 * Total, deterministic newest-first order:
 * 1. items with `publishedAt` before items without;
 * 2. KST calendar day, newest first;
 * 3. same day: timed items by time (newest first), then date-only items;
 * 4. `seq` descending (missing seq last);
 * 5. `sourceTier` ascending;
 * 6. `id` ascending.
 */
export function compareNewestFirst(a: SortableItem, b: SortableItem): number {
  const aHas = a.publishedAt != null && a.precision !== "unknown" && Number.isFinite(ts(a));
  const bHas = b.publishedAt != null && b.precision !== "unknown" && Number.isFinite(ts(b));
  if (aHas !== bHas) return aHas ? -1 : 1;
  if (aHas && bHas) {
    const ad = kstDayKey(a.publishedAt) ?? "";
    const bd = kstDayKey(b.publishedAt) ?? "";
    if (ad !== bd) return ad < bd ? 1 : -1;
    const at = timed(a);
    const bt = timed(b);
    if (at !== bt) return at ? -1 : 1;
    if (at && bt) {
      const diff = ts(b) - ts(a);
      if (diff !== 0) return diff;
    }
  }
  const as = typeof a.seq === "number" && Number.isFinite(a.seq) ? a.seq : Number.NEGATIVE_INFINITY;
  const bs = typeof b.seq === "number" && Number.isFinite(b.seq) ? b.seq : Number.NEGATIVE_INFINITY;
  if (as !== bs) return as > bs ? -1 : 1;
  if (a.sourceTier !== b.sourceTier) return a.sourceTier - b.sourceTier;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** New array sorted newest first. */
export function sortNewestFirst<T extends SortableItem>(items: readonly T[]): T[] {
  return [...items].sort(compareNewestFirst);
}

/** Drop later duplicates by id (keeps the first occurrence). */
export function dedupeById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string | null {
  try {
    const norm = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(norm + "===".slice((norm.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Opaque cursor from `publishedAt|id` of the last item on a page. */
export function encodeCursor(item: Pick<FeedItem, "publishedAt" | "id">): string {
  return b64urlEncode(`${item.publishedAt ?? ""}|${item.id}`);
}

export function decodeCursor(cursor: string | null | undefined): { publishedAt: string | null; id: string } | null {
  if (!cursor) return null;
  const raw = b64urlDecode(cursor);
  if (!raw) return null;
  const i = raw.indexOf("|");
  if (i < 0) return null;
  const publishedAt = raw.slice(0, i) || null;
  const id = raw.slice(i + 1);
  if (!id) return null;
  return { publishedAt, id };
}

/**
 * Page a newest-first list after `cursor`. When the cursor item is still in the
 * list, the page starts right after it; otherwise it starts at the first item
 * strictly older than the cursor time (so a refreshed list never repeats rows).
 */
export function pageAfterCursor<T extends SortableItem>(
  sorted: readonly T[],
  cursor: string | null | undefined,
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const c = decodeCursor(cursor);
  let start = 0;
  if (c) {
    const idx = sorted.findIndex((it) => it.id === c.id);
    if (idx >= 0) start = idx + 1;
    else {
      const cms = c.publishedAt ? Date.parse(c.publishedAt) : Number.NaN;
      start = sorted.findIndex((it) => {
        if (Number.isNaN(cms)) return !it.publishedAt && it.id > c.id;
        const ms = it.publishedAt ? Date.parse(it.publishedAt) : Number.NaN;
        return Number.isNaN(ms) || ms < cms;
      });
      if (start < 0) start = sorted.length;
    }
  }
  const items = sorted.slice(start, start + Math.max(0, limit));
  const last = items[items.length - 1];
  const nextCursor = last && start + items.length < sorted.length ? encodeCursor(last) : null;
  return { items, nextCursor };
}
