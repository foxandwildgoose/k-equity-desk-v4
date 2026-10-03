/**
 * Adapters from the existing domain types (ResearchReport, NewsItem,
 * DisclosureItem …) to the canonical FeedItem model, plus kernel-backed
 * sorters for lists that keep their original shape (D1). Pure module:
 * `@/` imports are type-only.
 */
import type { DisclosureItem, NewsItem, ResearchReport } from "@/server/naver-market";
import { parseSourceTime, type SourceZone } from "./time.ts";
import { compareNewestFirst, type SortableItem } from "./sort.ts";
import { canonicalizeUrl, clampSnippet, stableItemId, stripHtml } from "./text.ts";
import { outletTier, topicsFromText } from "./importance.ts";
import type { FeedItem, ResearchItem, SourceTier } from "./types.ts";

/** Sort any list by a derived sortable key, newest first (kernel order). */
export function sortByKernel<T>(list: readonly T[], key: (item: T) => SortableItem): T[] {
  const decorated = list.map((item, index) => ({ item, key: key(item), index }));
  decorated.sort((a, b) => compareNewestFirst(a.key, b.key) || a.index - b.index);
  return decorated.map((d) => d.item);
}

type ReportLike = Pick<ResearchReport, "researchId" | "date" | "category" | "sourceKind">;

/** Kernel key for a research report (date-only precision, nid tie-break). */
export function researchSortKey(r: ReportLike): SortableItem {
  const t = parseSourceTime(r.date, { zone: "Asia/Seoul" });
  const naver = (r.sourceKind ?? "naver") === "naver";
  return {
    id: `${r.sourceKind ?? "naver"}:${r.category}:${r.researchId}`,
    publishedAt: t.iso,
    precision: t.precision,
    seq: naver ? r.researchId : undefined,
    sourceTier: 3,
  };
}

/** D1a/b: research lists newest first (mixed `YYYY.MM.DD`/`YY.MM.DD`/ISO safe). */
export function sortReportsNewestFirst<T extends ReportLike>(list: readonly T[]): T[] {
  return sortByKernel(list, researchSortKey);
}

/** Latest report per broker (newest first by the kernel). */
export function latestPerBrokerByKernel<T extends ReportLike & { broker: string }>(list: readonly T[]): T[] {
  const byBroker = new Map<string, T>();
  for (const r of sortReportsNewestFirst(list)) if (!byBroker.has(r.broker)) byBroker.set(r.broker, r);
  return [...byBroker.values()];
}

/** KST day key of a report date (`YYYY-MM-DD`) or null. */
export function reportDay(r: Pick<ResearchReport, "date">): string | null {
  const t = parseSourceTime(r.date, { zone: "Asia/Seoul" });
  return t.iso ? t.iso.slice(0, 10) : null;
}

type DisclosureLike = { id: string; datetime: string };

export function disclosureSortKey(d: DisclosureLike): SortableItem {
  const t = parseSourceTime(d.datetime, { zone: "Asia/Seoul" });
  return { id: d.id, publishedAt: t.iso, precision: t.precision, sourceTier: 1 };
}

/** D1e: disclosure merges newest first across KIND/DART/Naver formats. */
export function sortDisclosuresNewestFirst<T extends DisclosureLike>(list: readonly T[]): T[] {
  return sortByKernel(list, disclosureSortKey);
}

/** Generic `{ id, datetime }` news-like sorter (ISO / RFC-822 / Naver compact). */
export function sortTimedNewestFirst<T extends { id: string; datetime: string }>(
  list: readonly T[],
  zone: SourceZone = "Asia/Seoul",
): T[] {
  return sortByKernel(list, (n) => {
    const t = parseSourceTime(n.datetime, { zone });
    return { id: n.id, publishedAt: t.iso, precision: t.precision, sourceTier: 3 };
  });
}

export interface MapContext {
  sourceId: string;
  sourceName: string;
  tier: SourceTier;
  fetchedAt: string;
  region?: FeedItem["region"];
  lang?: FeedItem["lang"];
  zone?: SourceZone;
  topics?: string[];
  paywalled?: boolean;
}

/** Naver per-stock `NewsItem` → FeedItem (outlet tier from publisher name). */
export function newsItemToFeed(n: NewsItem, ctx: MapContext, extra?: Partial<FeedItem>): FeedItem | null {
  const url = canonicalizeUrl(n.url);
  const title = stripHtml(n.title);
  if (!url || !title) return null;
  const t = parseSourceTime(n.datetime, { zone: ctx.zone ?? "Asia/Seoul" });
  const outlet = n.source && n.source !== "언론" ? n.source : undefined;
  return {
    id: stableItemId(ctx.sourceId, n.id, url),
    kind: "news",
    region: ctx.region ?? "KR",
    sourceId: ctx.sourceId,
    sourceName: ctx.sourceName,
    sourceTier: outletTier(outlet, ctx.tier),
    outlet,
    title,
    snippet: clampSnippet(n.body),
    url,
    publishedAt: t.iso,
    precision: t.precision,
    fetchedAt: ctx.fetchedAt,
    tickers: [],
    sectors: [],
    topics: [...new Set([...(ctx.topics ?? []), ...topicsFromText(title)])],
    lang: ctx.lang ?? "ko",
    paywalled: ctx.paywalled,
    ...extra,
  };
}

/** Existing `DisclosureItem` → FeedItem (`kind: "disclosure"`, tier 1). */
export function disclosureToFeed(d: DisclosureItem, ctx: MapContext): FeedItem | null {
  const url = canonicalizeUrl(d.dartUrl) ?? canonicalizeUrl(d.dartSearchUrl);
  const title = stripHtml(d.title);
  if (!url || !title) return null;
  const t = parseSourceTime(d.datetime, { zone: "Asia/Seoul" });
  return {
    id: stableItemId(ctx.sourceId, d.id, url),
    kind: "disclosure",
    region: "KR",
    sourceId: ctx.sourceId,
    sourceName: d.sourceLabel ? `${ctx.sourceName} · ${d.sourceLabel}` : ctx.sourceName,
    sourceTier: 1,
    title: d.nameKo ? `[${d.nameKo}] ${title}` : title,
    url,
    publishedAt: t.iso,
    precision: t.precision,
    fetchedAt: ctx.fetchedAt,
    tickers: d.code && /^[0-9A-Z]{6}$/.test(d.code) ? [{ market: "KR", code: d.code }] : [],
    sectors: [],
    topics: ["disclosure", ...topicsFromText(title)],
    lang: "ko",
  };
}

/** Existing `ResearchReport` → ResearchItem (BROKER_KR origin). */
export function researchReportToItem(
  r: ResearchReport,
  ctx: Pick<MapContext, "sourceId" | "sourceName" | "fetchedAt">,
): ResearchItem | null {
  const url = canonicalizeUrl(r.pageUrl) ?? canonicalizeUrl(r.pdfUrl);
  if (!url) return null;
  const t = parseSourceTime(r.date, { zone: "Asia/Seoul" });
  const pdf = canonicalizeUrl(r.pdfUrl);
  const category =
    r.category === "market" ? "invest" : (r.category as ResearchItem["category"]);
  return {
    id: `${ctx.sourceId}:${r.category}:${r.researchId}`,
    kind: "research",
    region: "KR",
    sourceId: ctx.sourceId,
    sourceName: r.sourceLabel ?? ctx.sourceName,
    sourceTier: 3,
    title: stripHtml(r.title),
    snippet: clampSnippet(r.preview),
    url,
    pdfUrl: pdf && /\.pdf($|\?)/i.test(pdf) ? pdf : undefined,
    publishedAt: t.iso,
    precision: t.precision,
    fetchedAt: ctx.fetchedAt,
    seq: (r.sourceKind ?? "naver") === "naver" ? r.researchId : undefined,
    tickers: r.code && /^[0-9A-Z]{6}$/.test(r.code) ? [{ market: "KR", code: r.code }] : [],
    sectors: [...r.sectorIds],
    topics: ["research"],
    lang: "ko",
    broker: r.broker,
    category,
    rating: r.rating,
    targetPrice: r.targetPrice,
    currency: r.targetPrice != null ? "KRW" : undefined,
    summary: r.summary,
    summarySource: r.preview ? "preview" : "none",
    originTier: "BROKER_KR",
  };
}

/** Official US documents (`publishedAt` YYYY-MM-DD or ISO) newest first (D1d). */
export function sortOfficialNewestFirst<T extends { id: string; publishedAt: string | null }>(list: readonly T[]): T[] {
  return sortByKernel(list, (r) => {
    const t = parseSourceTime(r.publishedAt, { zone: "America/New_York" });
    return { id: r.id, publishedAt: t.iso, precision: t.precision, sourceTier: 1 };
  });
}
