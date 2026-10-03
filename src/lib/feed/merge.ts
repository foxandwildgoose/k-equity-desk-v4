/**
 * Merge paged feed responses without duplicates (AT-10): rows are deduped by
 * id, and a later-page row that is already a member of an earlier cluster is
 * dropped. Output is newest first. Pure module.
 */
import { dedupeById, sortNewestFirst } from "./sort.ts";
import type { FeedItem } from "./types.ts";

export function mergeFeedPages(pages: readonly { items: FeedItem[] }[]): FeedItem[] {
  const merged = dedupeById(pages.flatMap((p) => p.items));
  const memberIds = new Set<string>();
  for (const it of merged) for (const m of it.cluster?.members ?? []) memberIds.add(m.id);
  const out: FeedItem[] = [];
  const reps = new Set<string>();
  for (const it of merged) {
    if (memberIds.has(it.id) && !reps.has(it.id)) {
      // Already shown inside another row's cluster.
      const ownsCluster = (it.cluster?.members?.length ?? 0) > 0;
      if (!ownsCluster) continue;
    }
    reps.add(it.id);
    out.push(it);
  }
  return sortNewestFirst(out);
}
