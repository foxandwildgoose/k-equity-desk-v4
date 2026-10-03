/**
 * Source-row → FeedItem mappers for RSS/Atom, Google News, KIS news titles,
 * Finnhub, SEC Atom and Finviz rating notes, plus Yahoo chart snapshot tiles.
 * Pure module.
 */
import type { FeedEntry } from "../rss-parse.ts";
import { parseSourceTime, type SourceZone } from "../time.ts";
import { canonicalizeUrl, clampSnippet, stableItemId, stripHtml } from "../text.ts";
import { outletTier, topicsFromText } from "../importance.ts";
import type { FeedItem, ItemKind, Region, SourceTier } from "../types.ts";

export interface EntryContext {
  sourceId: string;
  sourceName: string;
  tier: SourceTier;
  fetchedAt: string;
  region: Region;
  lang: "ko" | "en";
  kind?: ItemKind;
  topics?: string[];
  paywalled?: boolean;
  zone?: SourceZone;
  /** Headlines only (Bloomberg): never keep a snippet. */
  headlineOnly?: boolean;
}

/** Generic RSS/Atom entry → FeedItem. */
export function rssEntryToItem(e: FeedEntry, ctx: EntryContext): FeedItem | null {
  const url = canonicalizeUrl(e.link) ?? canonicalizeUrl(e.guid);
  const title = stripHtml(e.title);
  if (!url || !title) return null;
  const t = parseSourceTime(e.pubDate, { zone: ctx.zone ?? "UTC" });
  return {
    id: stableItemId(ctx.sourceId, e.guid && e.guid !== e.link ? e.guid : null, url),
    kind: ctx.kind ?? "news",
    region: ctx.region,
    sourceId: ctx.sourceId,
    sourceName: ctx.sourceName,
    sourceTier: ctx.tier,
    title,
    snippet: ctx.headlineOnly ? undefined : clampSnippet(e.description),
    url,
    publishedAt: t.iso,
    precision: t.precision,
    fetchedAt: ctx.fetchedAt,
    tickers: [],
    sectors: [],
    topics: [...new Set([...(ctx.topics ?? []), ...topicsFromText(`${title} ${e.categories.join(" ")}`)])],
    lang: ctx.lang,
    paywalled: ctx.paywalled,
  };
}

/** Strip Google News' trailing ` - Publisher` when it matches the <source>. */
export function stripPublisherSuffix(title: string, publisher?: string): string {
  if (!publisher) return title;
  const suffix = ` - ${publisher}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

/** Google News RSS entry → FeedItem (redirect link kept, outlet from <source>). */
export function googleNewsEntryToItem(e: FeedEntry, ctx: EntryContext & { query: string }): FeedItem | null {
  const url = canonicalizeUrl(e.link);
  const outlet = e.source?.trim() || undefined;
  const title = stripPublisherSuffix(stripHtml(e.title), outlet);
  if (!url || !title || /Google (뉴스|News)$/.test(title)) return null;
  const t = parseSourceTime(e.pubDate, { zone: "UTC" });
  const paywalled = ctx.paywalled || /bloomberg/i.test(outlet ?? "") || /bloomberg/i.test(e.sourceUrl ?? "");
  return {
    id: stableItemId(ctx.sourceId, e.guid || null, url),
    kind: ctx.kind ?? "news",
    region: ctx.region,
    sourceId: ctx.sourceId,
    sourceName: ctx.sourceName,
    sourceTier: outletTier(outlet, ctx.tier),
    outlet,
    title,
    // GN descriptions are link lists, not source prose — never shown.
    snippet: undefined,
    url,
    publishedAt: t.iso,
    precision: t.precision,
    fetchedAt: ctx.fetchedAt,
    tickers: [],
    sectors: [],
    topics: [...new Set([...(ctx.topics ?? []), ...topicsFromText(title)])],
    lang: ctx.lang,
    paywalled: paywalled || undefined,
  };
}

/** KIS `FHKST01011800` output row → FeedItem. KIS gives titles only (no link). */
export function kisNewsRowToItem(row: Record<string, unknown>, ctx: Omit<EntryContext, "region" | "lang">): FeedItem | null {
  const title = stripHtml(row.hts_pbnt_titl_cntt);
  if (!title) return null;
  const day = String(row.data_dt ?? "").trim();
  const tm = String(row.data_tm ?? "").trim().padStart(6, "0");
  const raw = /^\d{8}$/.test(day) ? (/^\d{6}$/.test(tm) ? `${day}${tm}` : day) : "";
  const t = parseSourceTime(raw, { zone: "Asia/Seoul" });
  const serial = String(row.cntt_usiq_srno ?? "").trim();
  const codes = ["iscd1", "iscd2", "iscd3", "iscd4", "iscd5"]
    .map((k) => String(row[k] ?? "").trim().toUpperCase())
    .filter((c) => /^[0-9A-Z]{6}$/.test(c));
  const outlet = stripHtml(row.dorg) || undefined;
  // No public original page exists for KIS titles: link to a news search for the title.
  const url = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(title)}`;
  return {
    id: stableItemId(ctx.sourceId, serial || null, url),
    kind: "news",
    region: "KR",
    sourceId: ctx.sourceId,
    sourceName: ctx.sourceName,
    sourceTier: outletTier(outlet, ctx.tier),
    outlet,
    title,
    snippet: "KIS 제목 전용 피드 — 원문 링크가 제공되지 않아 기사 검색으로 연결합니다.",
    url,
    publishedAt: t.iso,
    precision: t.precision,
    fetchedAt: ctx.fetchedAt,
    seq: /^\d+$/.test(serial) ? Number(serial) : undefined,
    tickers: [...new Set(codes)].map((code) => ({ market: "KR" as const, code })),
    sectors: [],
    topics: [...new Set([...(ctx.topics ?? []), ...topicsFromText(title)])],
    lang: "ko",
  };
}

/** Finnhub `/news` row → FeedItem. */
export function finnhubRowToItem(row: Record<string, unknown>, ctx: EntryContext): FeedItem | null {
  const url = canonicalizeUrl(row.url);
  const title = stripHtml(row.headline);
  if (!url || !title) return null;
  const t = parseSourceTime(typeof row.datetime === "number" ? row.datetime : null, { zone: "UTC" });
  const outlet = stripHtml(row.source) || undefined;
  const related = String(row.related ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z][A-Z0-9.]{0,9}$/.test(s));
  return {
    id: stableItemId(ctx.sourceId, row.id ?? null, url),
    kind: "news",
    region: "US",
    sourceId: ctx.sourceId,
    sourceName: ctx.sourceName,
    sourceTier: outletTier(outlet, ctx.tier),
    outlet,
    title,
    snippet: clampSnippet(row.summary),
    url,
    publishedAt: t.iso,
    precision: t.precision,
    fetchedAt: ctx.fetchedAt,
    tickers: related.map((code) => ({ market: "US" as const, code })),
    sectors: [],
    topics: [...new Set([...(ctx.topics ?? []), ...topicsFromText(title)])],
    lang: "en",
  };
}

/** SEC `getcurrent` Atom entry title → CIK (e.g. `8-K - NVIDIA CORP (0001045810) (Filer)`). */
export function secAtomCik(title: string): string | null {
  const m = title.match(/\((\d{7,10})\)\s*\((?:Filer|Subject|Reporting)\)/i) ?? title.match(/\((\d{7,10})\)/);
  return m ? String(Number(m[1])) : null;
}

/** Yahoo `v8/finance/chart` payload → snapshot numbers from `meta` (no invention). */
/**
 * Previous session close from daily bars: when the last bar is the session of
 * `regularMarketTime`, the prior finite close; otherwise the last bar's close.
 */
function prevCloseFromBars(result: { timestamp?: unknown; indicators?: { quote?: { close?: unknown }[] } } | undefined, marketTimeSec: number | null, gmtOffsetSec: number): number | null {
  const ts = Array.isArray(result?.timestamp) ? (result!.timestamp as unknown[]) : null;
  const closes = Array.isArray(result?.indicators?.quote?.[0]?.close) ? (result!.indicators!.quote![0]!.close as unknown[]) : null;
  if (!ts || !closes || !ts.length || marketTimeSec == null) return null;
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  let last = -1;
  for (let i = Math.min(ts.length, closes.length) - 1; i >= 0; i--) {
    if (finite(closes[i]) && finite(ts[i])) {
      last = i;
      break;
    }
  }
  if (last < 0) return null;
  const day = (sec: number) => Math.floor((sec + gmtOffsetSec) / 86_400);
  if (day(ts[last] as number) !== day(marketTimeSec)) return closes[last] as number;
  for (let i = last - 1; i >= 0; i--) if (finite(closes[i])) return closes[i] as number;
  return null;
}

export function yahooChartSnapshot(payload: unknown): {
  symbol: string;
  name: string | null;
  price: number | null;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
  currency: string | null;
  asOf: string | null;
  delayMinutes: number | null;
  exchange: string | null;
  high52: number | null;
  low52: number | null;
  volume: number | null;
  instrumentType: string | null;
} | null {
  const p = payload as { chart?: { result?: { meta?: Record<string, unknown>; timestamp?: unknown; indicators?: { quote?: { close?: unknown }[] } }[] } } | null;
  const result = p?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const price = num(meta.regularMarketPrice);
  const tsec = num(meta.regularMarketTime);
  // 1D basis: explicit previous close → daily bars → chartPreviousClose only
  // when it is the prior session (range=1d or no bars/range given).
  const hasBars = Array.isArray(result?.timestamp) && (result!.timestamp as unknown[]).length > 0;
  const range = str(meta.range);
  const prev =
    num(meta.previousClose) ??
    num(meta.regularMarketPreviousClose) ??
    prevCloseFromBars(result, tsec, num(meta.gmtoffset) ?? 0) ??
    (!hasBars && (range == null || range === "1d") ? num(meta.chartPreviousClose) : null);
  const change = price != null && prev != null ? price - prev : null;
  const changePct = change != null && prev ? (change / prev) * 100 : null;
  return {
    symbol: String(meta.symbol ?? ""),
    name: str(meta.longName) ?? str(meta.shortName),
    price,
    prevClose: prev,
    change,
    changePct,
    currency: str(meta.currency),
    asOf: tsec ? new Date(tsec * 1000).toISOString() : null,
    delayMinutes: num(meta.exchangeDataDelayedBy),
    exchange: str(meta.exchangeName),
    high52: num(meta.fiftyTwoWeekHigh),
    low52: num(meta.fiftyTwoWeekLow),
    volume: num(meta.regularMarketVolume),
    instrumentType: str(meta.instrumentType),
  };
}
