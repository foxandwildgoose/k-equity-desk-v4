/**
 * Tolerant mappers for stock.naver.com JSON (unofficial, undocumented API).
 *
 * The dd3ok/naverstock-api-skill catalog (47a4274) documents list keys
 * (`articles`, `items`, `researchSets`, `content`, top-level `aid` arrays),
 * id fields (`nid`, `aid`, `researchId`) and `datetime` = `YYYYMMDDHHmm`, but
 * not every per-item field. Each mapper therefore accepts several candidate
 * field names and drops rows without a title or link. Status: unverified.
 * Pure module.
 */
import { parseSourceTime } from "../time.ts";
import { canonicalizeUrl, clampSnippet, stableItemId, stripHtml } from "../text.ts";
import { outletTier, topicsFromText } from "../importance.ts";
import type { FeedItem, SourceTier } from "../types.ts";

type Row = Record<string, unknown>;

function isObj(v: unknown): v is Row {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

export function pick(row: Row, keys: string[]): unknown {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v !== "") return v;
  }
  return undefined;
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

/** First array under the documented list keys (or the payload itself). */
export function naverList(payload: unknown, keys = ["articles", "items", "content", "list", "newsList", "result", "data"]): Row[] {
  if (Array.isArray(payload)) return payload.filter(isObj);
  if (!isObj(payload)) return [];
  for (const k of keys) {
    const v = payload[k];
    if (Array.isArray(v)) return v.filter(isObj);
    if (isObj(v)) {
      const inner = naverList(v, keys);
      if (inner.length) return inner;
    }
  }
  return [];
}

export interface NaverMapContext {
  sourceId: string;
  sourceName: string;
  tier: SourceTier;
  fetchedAt: string;
  region?: FeedItem["region"];
  topics?: string[];
}

const TITLE_KEYS = ["titleFull", "title", "articleTitle", "tit", "subject", "headline"];
const BODY_KEYS = ["body", "subcontent", "summary", "content", "articleSummary", "subContent", "description"];
const OFFICE_KEYS = ["officeName", "office", "press", "pressName", "ohnm", "source", "provider", "dorg"];
const TIME_KEYS = ["datetime", "dateTime", "articleDateTime", "dt", "date", "publishDateTime", "publishDate", "createdAt", "registeredAt", "serviceDateTime"];
const URL_KEYS = ["mobileNewsUrl", "linkUrl", "url", "newsUrl", "originalUrl", "link"];

/** Domestic news list / focus / search article → FeedItem. */
export function mapNaverArticle(row: Row, ctx: NaverMapContext): FeedItem | null {
  const title = stripHtml(pick(row, TITLE_KEYS));
  if (!title) return null;
  const officeId = str(pick(row, ["officeId", "oid", "pressId"]));
  const articleId = str(pick(row, ["articleId", "aid", "articleNo"]));
  const direct = canonicalizeUrl(str(pick(row, URL_KEYS)));
  const url = direct ?? (officeId && articleId ? `https://n.news.naver.com/mnews/article/${officeId}/${articleId}` : null);
  if (!url) return null;
  const t = parseSourceTime(pick(row, TIME_KEYS), { zone: "Asia/Seoul" });
  const outlet = stripHtml(pick(row, OFFICE_KEYS)) || undefined;
  const native = str(pick(row, ["id"])) || (officeId && articleId ? `${officeId}-${articleId}` : "");
  const seq = /^\d{1,15}$/.test(articleId) ? Number(articleId) : undefined;
  return {
    id: stableItemId(ctx.sourceId, native, url),
    kind: "news",
    region: ctx.region ?? "KR",
    sourceId: ctx.sourceId,
    sourceName: ctx.sourceName,
    sourceTier: outletTier(outlet, ctx.tier),
    outlet,
    title,
    snippet: clampSnippet(pick(row, BODY_KEYS)),
    url,
    publishedAt: t.iso,
    precision: t.precision,
    fetchedAt: ctx.fetchedAt,
    seq,
    tickers: [],
    sectors: [],
    topics: [...new Set([...(ctx.topics ?? []), ...topicsFromText(title)])],
    lang: "ko",
  };
}

/** `/api/foreign/news/worldNews` row (keyed by `aid`) → FeedItem. */
export function mapNaverWorldNews(row: Row, ctx: NaverMapContext): FeedItem | null {
  const title = stripHtml(pick(row, TITLE_KEYS));
  const aid = str(pick(row, ["aid", "articleId", "id"]));
  if (!title || !aid) return null;
  const url = `https://stock.naver.com/news/worldnews/${encodeURIComponent(aid)}`;
  const t = parseSourceTime(pick(row, TIME_KEYS), { zone: "Asia/Seoul" });
  const outlet = stripHtml(pick(row, OFFICE_KEYS)) || "Reuters";
  return {
    id: `${ctx.sourceId}:${aid}`,
    kind: "news",
    region: ctx.region ?? "US",
    sourceId: ctx.sourceId,
    sourceName: ctx.sourceName,
    sourceTier: outletTier(outlet, ctx.tier),
    outlet,
    title,
    snippet: clampSnippet(pick(row, BODY_KEYS)),
    url,
    publishedAt: t.iso,
    precision: t.precision,
    fetchedAt: ctx.fetchedAt,
    seq: /^\d+$/.test(aid) ? Number(aid) : undefined,
    tickers: [],
    sectors: [],
    topics: [...new Set([...(ctx.topics ?? ["global"]), ...topicsFromText(title)])],
    lang: "ko",
  };
}

export interface NaverAiBriefing {
  id: string;
  title: string;
  bullets: string[];
  publishedAt: string | null;
  precision: FeedItem["precision"];
  url: string;
}

/**
 * Naver Pay AI market briefing (current / v2 list item). Catalog-documented v2
 * list fields: `id` (int), `title`, `summary`, `detail`, `briefingDate`,
 * `briefingHour` (strings; KST). Text is shown as provided, attributed, and
 * linked to stock.naver.com (no public per-briefing page route is documented).
 */
export function mapNaverAiBriefing(row: unknown): NaverAiBriefing | null {
  if (!isObj(row)) return null;
  const inner = isObj(row.marketBriefing) ? (row.marketBriefing as Row) : isObj(row.briefing) ? (row.briefing as Row) : row;
  const id = str(pick(inner, ["id", "briefingId", "marketBriefingId"]));
  const title = stripHtml(pick(inner, ["title", "headline", "summaryTitle"]));
  const bullets: string[] = [];
  const rawBullets = pick(inner, ["contents", "summaries", "items", "bullets", "summaryList"]);
  if (Array.isArray(rawBullets)) {
    for (const b of rawBullets) {
      const t = isObj(b) ? stripHtml(pick(b, ["content", "text", "summary", "title"])) : stripHtml(b);
      if (t) bullets.push(t.slice(0, 240));
    }
  }
  if (!bullets.length) {
    const text = stripHtml(pick(inner, ["summary", "content", "body"]));
    if (text) bullets.push(text.slice(0, 240));
  }
  if (!title && !bullets.length) return null;
  const day = str(pick(inner, ["briefingDate", "date", "baseDate"]));
  const hourRaw = str(pick(inner, ["briefingHour", "hour"]));
  const hour = /^\d{1,2}$/.test(hourRaw) ? `${hourRaw.padStart(2, "0")}:00` : /^\d{1,2}:\d{2}/.test(hourRaw) ? hourRaw.slice(0, 5) : "";
  const t = day
    ? parseSourceTime(hour ? `${day} ${hour}` : day, { zone: "Asia/Seoul" })
    : parseSourceTime(pick(inner, ["createdAt", "publishedAt", "datetime", "updatedAt"]), { zone: "Asia/Seoul" });
  return {
    id: id || "current",
    title: title || "AI 시장 브리핑",
    bullets: bullets.slice(0, 6),
    publishedAt: t.iso,
    precision: t.precision,
    url: "https://stock.naver.com/",
  };
}

/** Market-status payload → session label (unverified shape; best effort). */
export function mapNaverMarketStatus(payload: unknown): { label: string; detail: string } | null {
  const rows = isObj(payload) && Array.isArray(payload.statuses) ? (payload.statuses as unknown[]) : Array.isArray(payload) ? payload : [];
  const parts: string[] = [];
  for (const r of rows) {
    if (!isObj(r)) continue;
    const ex = str(pick(r, ["exchange", "exchangeType", "marketType", "code"])).toUpperCase();
    const session = str(pick(r, ["currentSession", "session", "status", "marketStatus", "sessionType"]));
    if (ex && session) parts.push(`${ex} ${session}`);
  }
  if (!parts.length) return null;
  return { label: parts.join(" · "), detail: "네이버 증권 장 상태" };
}
