/**
 * Headline clustering (B0.6). Two items join a cluster when their title token
 * sets have Jaccard ≥ 0.6 and they are ≤ 12 h apart. The representative is the
 * best-tier member, then the earliest. Pure module.
 */
import { CLUSTER_STOPWORDS } from "../../data/news-keywords.ts";
import { compareNewestFirst } from "./sort.ts";
import { hashString } from "./text.ts";
import type { FeedClusterMember, FeedItem } from "./types.ts";

export const CLUSTER_JACCARD = 0.6;
export const CLUSTER_WINDOW_MS = 12 * 3_600_000;

const PREFIX_TAGS =
  /\[(?:속보|단독|종합|특징주|마감시황|포토|영상|사진|1보|2보|3보|종합\d*보)\]|\((?:종합|\d보|종합\d보|상보|속보|단독)\)|【[^】]*】/g;

/** NFKC, lowercase, strip tags like `[속보]`/`(종합)`/`(2보)`, trailing ` - Source`, punctuation. */
export function normalizeClusterTitle(title: string): string {
  let s = (title ?? "").normalize("NFKC");
  s = s.replace(PREFIX_TAGS, " ");
  // Trailing " - Publisher" / " | Publisher" (Google News style).
  s = s.replace(/\s+[-–—|]\s+([^-–—|]{1,30})$/u, (full, tail: string) =>
    tail.trim().split(/\s+/).length <= 4 ? "" : full,
  );
  s = s.toLowerCase();
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " ");
  return s.replace(/\s+/g, " ").trim();
}

const HANGUL_RUN = /[가-힣]+/g;
const LATIN_WORD = /[a-z0-9]+/g;

/** Hangul character bigrams + Latin/number words, stopwords removed. */
export function clusterTokens(title: string): Set<string> {
  const norm = normalizeClusterTitle(title);
  const out = new Set<string>();
  for (const m of norm.matchAll(HANGUL_RUN)) {
    const run = m[0];
    if (run.length === 1) {
      if (!CLUSTER_STOPWORDS.has(run)) out.add(run);
      continue;
    }
    if (CLUSTER_STOPWORDS.has(run)) continue;
    for (let i = 0; i < run.length - 1; i++) {
      const bg = run.slice(i, i + 2);
      if (!CLUSTER_STOPWORDS.has(bg)) out.add(bg);
    }
  }
  for (const m of norm.matchAll(LATIN_WORD)) {
    const w = m[0];
    if (!CLUSTER_STOPWORDS.has(w)) out.add(w);
  }
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (big.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function timeMs(it: Pick<FeedItem, "publishedAt">): number | null {
  if (!it.publishedAt) return null;
  const ms = Date.parse(it.publishedAt);
  return Number.isNaN(ms) ? null : ms;
}

/** Same story? Jaccard ≥ 0.6 and ≤ 12 h apart (unknown times never merge). */
export function sameStory(
  a: Pick<FeedItem, "title" | "publishedAt">,
  b: Pick<FeedItem, "title" | "publishedAt">,
  tokens?: { a?: Set<string>; b?: Set<string> },
): boolean {
  const ta = timeMs(a);
  const tb = timeMs(b);
  if (ta == null || tb == null) return false;
  if (Math.abs(ta - tb) > CLUSTER_WINDOW_MS) return false;
  return jaccard(tokens?.a ?? clusterTokens(a.title), tokens?.b ?? clusterTokens(b.title)) >= CLUSTER_JACCARD;
}

function pickRepresentative<T extends FeedItem>(members: T[]): T {
  return [...members].sort((x, y) => {
    if (x.sourceTier !== y.sourceTier) return x.sourceTier - y.sourceTier;
    const tx = timeMs(x) ?? Number.POSITIVE_INFINITY;
    const ty = timeMs(y) ?? Number.POSITIVE_INFINITY;
    if (tx !== ty) return tx - ty;
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
  })[0]!;
}

function toMember(it: FeedItem): FeedClusterMember {
  return {
    id: it.id,
    sourceId: it.sourceId,
    sourceName: it.outlet ? `${it.sourceName} · ${it.outlet}` : it.sourceName,
    title: it.title,
    url: it.url,
    publishedAt: it.publishedAt,
    precision: it.precision,
    paywalled: it.paywalled,
  };
}

/**
 * Collapse near-duplicate headlines. Returns one representative per cluster
 * with `cluster` populated (singletons get `size: 1`), sorted newest first.
 * Only `news`, `policy`, `filing` and `rating` kinds cluster; research and
 * disclosures pass through as singletons.
 */
export function clusterItems<T extends FeedItem>(items: readonly T[]): T[] {
  const sorted = [...items].sort(compareNewestFirst);
  const groups: { members: T[]; tokens: Set<string>[]; clusterable: boolean }[] = [];
  for (const it of sorted) {
    const clusterable = it.kind === "news" || it.kind === "policy" || it.kind === "filing" || it.kind === "rating";
    const tok = clusterTokens(it.title);
    let placed = false;
    if (clusterable && tok.size >= 2 && timeMs(it) != null) {
      for (const g of groups) {
        if (!g.clusterable) continue;
        if (g.members.some((m, i) => sameStory(m, it, { a: g.tokens[i], b: tok }))) {
          g.members.push(it);
          g.tokens.push(tok);
          placed = true;
          break;
        }
      }
    }
    if (!placed) groups.push({ members: [it], tokens: [tok], clusterable });
  }
  const out: T[] = groups.map((g) => {
    const rep = pickRepresentative(g.members);
    const others = g.members.filter((m) => m.id !== rep.id).sort(compareNewestFirst);
    const sources = [...new Set(g.members.map((m) => m.sourceName))];
    return {
      ...rep,
      cluster: {
        id: `c${hashString(g.members.map((m) => m.id).sort().join("|"))}`,
        size: g.members.length,
        sources,
        members: others.map(toMember),
      },
    };
  });
  return out.sort(compareNewestFirst);
}

/**
 * Remove items from disabled sources. When a cluster representative is removed
 * but other members survive, the newest surviving member is promoted.
 */
export function filterDisabledSources<T extends FeedItem>(items: readonly T[], disabled: ReadonlySet<string>): T[] {
  if (!disabled.size) return [...items];
  const out: T[] = [];
  for (const it of items) {
    const members = (it.cluster?.members ?? []).filter((m) => !disabled.has(m.sourceId));
    if (!disabled.has(it.sourceId)) {
      out.push(
        it.cluster
          ? {
              ...it,
              cluster: {
                ...it.cluster,
                members,
                size: members.length + 1,
                sources: [...new Set([it.sourceName, ...members.map((m) => m.sourceName)])],
              },
            }
          : it,
      );
      continue;
    }
    const [head, ...rest] = members;
    if (!head) continue;
    out.push({
      ...it,
      id: head.id,
      sourceId: head.sourceId,
      sourceName: head.sourceName,
      title: head.title,
      url: head.url,
      publishedAt: head.publishedAt,
      precision: head.precision,
      paywalled: head.paywalled,
      snippet: undefined,
      outlet: undefined,
      cluster: {
        ...it.cluster!,
        members: rest,
        size: rest.length + 1,
        sources: [...new Set([head.sourceName, ...rest.map((m) => m.sourceName)])],
      },
    });
  }
  return out.sort(compareNewestFirst);
}
