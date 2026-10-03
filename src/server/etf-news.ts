/**
 * KR ETF news (F5).
 *
 * - `/news/etf` and the `/etfs` "ETF 뉴스" tab read `GET /api/feed?group=etf`:
 *   registry sources `ETF_NEWS_SOURCE_IDS` (GN topic + issuer-brand queries,
 *   Hankyung finance filtered by ETF keywords, Naver news search `query=ETF`),
 *   post-processed by `enrichEtfStory` (stage/theme/brand + live-list match).
 * - `fetchEtfListingNews` (listing / listing-scheduled only) is kept for the
 *   existing `getEtfListingNews` server fn; its stage and matching rules now
 *   live in `src/lib/etf-news.ts` so both paths share one implementation.
 */
import { fetchGoogleNewsRss } from "@/server/us-link-feed";
import { fetchAllEtfs, type LiveEtfRow } from "@/server/etf-market";
import { etfStageOf, matchEtf } from "@/lib/etf-news";
import { compareNewestFirst } from "@/lib/feed/sort";
import { parseSourceTime } from "@/lib/feed/time";

export const ETF_NEWS_SOURCE_IDS = ["gn-etf-kr", "gn-etf-brands", "hankyung-finance", "naver-news-search-etf"] as const;

export type EtfListingNewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  datetime: string;
  summary?: string;
  matchedCode?: string;
  matchedName?: string;
  stage: "listed" | "scheduled" | "other";
};

const QUERIES = [
  "ETF 신규 상장",
  "ETF 상장예정",
  "한국거래소 ETF 상장",
  "ACE OR TIGER OR KODEX OR PLUS ETF 신규 상장",
];

function stageOf(title: string): EtfListingNewsItem["stage"] {
  const st = etfStageOf(title);
  return st === "listed" || st === "scheduled" ? st : "other";
}

function isListingStory(title: string): boolean {
  const t = title.replace(/\s+/g, " ");
  if (!/ETF|상장지수/.test(t)) return false;
  if (/상장폐지|상장 폐지/.test(t) && !/신규|예정/.test(t)) return false;
  return /상장|출시|신규상장|상장예정|상장 예고/.test(t);
}

export async function fetchEtfListingNews(limit = 40): Promise<{
  items: EtfListingNewsItem[];
  fetchedAt: string;
  queries: string[];
}> {
  const rssPromise = Promise.all(
    QUERIES.map((q) => fetchGoogleNewsRss(q, 18, "ko", "gn-etf-kr").catch(() => [])),
  );
  const etfPromise = fetchAllEtfs().catch(() => [] as LiveEtfRow[]);
  const rssLists = await rssPromise;
  const etfs = await Promise.race([
    etfPromise,
    new Promise<LiveEtfRow[]>((resolve) => setTimeout(() => resolve([]), 5_000)),
  ]);

  const seen = new Set<string>();
  const items: EtfListingNewsItem[] = [];
  for (const list of rssLists) {
    for (const raw of list) {
      if (!isListingStory(raw.title)) continue;
      const key = raw.title.replace(/\s+/g, "").slice(0, 80);
      if (seen.has(key) || seen.has(raw.url)) continue;
      seen.add(key);
      seen.add(raw.url);
      const hit = matchEtf(raw.title, etfs);
      items.push({
        id: raw.id,
        title: raw.title,
        url: raw.url,
        source: raw.source,
        datetime: raw.datetime,
        matchedCode: hit?.code,
        matchedName: hit?.nameKo,
        stage: stageOf(raw.title),
      });
    }
  }

  const ranked = items
    .map((it) => {
      const t = parseSourceTime(it.datetime, { zone: "UTC" });
      return { it, key: { id: it.id, publishedAt: t.iso, precision: t.precision, sourceTier: 3 as const } };
    })
    .sort((a, b) => compareNewestFirst(a.key, b.key));

  return {
    items: ranked.map((r) => r.it).slice(0, limit),
    fetchedAt: new Date().toISOString(),
    queries: QUERIES,
  };
}
