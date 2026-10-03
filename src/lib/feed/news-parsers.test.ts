import assert from "node:assert/strict";
import { test } from "node:test";
import { mapNaverArticle, mapNaverWorldNews, naverList, mapNaverAiBriefing } from "./parsers/naver.ts";
import { googleNewsEntryToItem, kisNewsRowToItem, rssEntryToItem, secAtomCik, stripPublisherSuffix, yahooChartSnapshot, finnhubRowToItem } from "./parsers/generic.ts";
import { parseFeed } from "./rss-parse.ts";
import { krSessionEstimate, usSessionEstimate } from "./session.ts";
import { mergeFeedPages } from "./merge.ts";
import { applyFeedFilters, EMPTY_FILTERS, sourceFacets } from "./filters.ts";
import { clusterItems } from "./cluster.ts";
import type { FeedItem } from "./types.ts";

const CTX = { sourceId: "naver-flash", sourceName: "네이버 증권 속보", tier: 3 as const, fetchedAt: "2026-09-26T03:00:00.000Z" };

test("Naver news list (`articles`) maps title/outlet/time/link; YYYYMMDDHHmm is KST", () => {
  // synthetic fixture (format sample), not market data
  const payload = { articles: [
    { officeId: "001", articleId: "0014567890", officeName: "연합뉴스", titleFull: "[속보] 코스피 2% 급락", body: "<b>본문</b> 요약", datetime: "202609251403" },
    { officeId: "015", articleId: "0005555555", officeName: "한국경제", title: "제목만", datetime: "202609251500" },
    { title: "" },
  ] };
  const rows = naverList(payload);
  assert.equal(rows.length, 3);
  const items = rows.map((r) => mapNaverArticle(r, CTX)).filter(Boolean) as FeedItem[];
  assert.equal(items.length, 2);
  assert.equal(items[0]!.url, "https://n.news.naver.com/mnews/article/001/0014567890");
  assert.equal(items[0]!.publishedAt, "2026-09-25T05:03:00.000Z");
  assert.equal(items[0]!.outlet, "연합뉴스");
  assert.equal(items[0]!.sourceTier, 1, "Yonhap relayed by Naver keeps wire tier");
  assert.equal(items[0]!.snippet, "본문 요약");
  assert.equal(items[1]!.sourceTier, 2);
});

test("Naver search (`items`) and worldNews (top-level array keyed by aid)", () => {
  // synthetic fixture (format sample), not market data
  assert.equal(naverList({ status: { code: 0 }, items: [{ title: "a" }] }).length, 1);
  // synthetic fixture (format sample), not market data
  const world = [{ aid: "2732728", tit: "Fed signals patience", ohnm: "Reuters", dt: "202609250130" }];
  const it = mapNaverWorldNews(naverList(world)[0]!, { ...CTX, sourceId: "naver-worldnews", sourceName: "네이버 해외뉴스", tier: 2 });
  assert.ok(it);
  assert.equal(it!.url, "https://stock.naver.com/news/worldnews/2732728");
  assert.equal(it!.region, "US");
  assert.equal(it!.seq, 2732728);
});

test("Naver AI briefing v2 list item (id/title/summary/briefingDate/briefingHour)", () => {
  // synthetic fixture (format sample), not market data
  const b = mapNaverAiBriefing({ id: 4535, title: "장 초반 브리핑", summary: "요약 문장", detail: "상세", briefingDate: "2026-09-07", briefingHour: "09" });
  assert.ok(b);
  assert.equal(b!.publishedAt, "2026-09-07T00:00:00.000Z");
  assert.deepEqual(b!.bullets, ["요약 문장"]);
  assert.equal(b!.url, "https://stock.naver.com/");
});

test("Google News: strip ` - Publisher`, outlet tier, no snippet, Bloomberg → 유료", () => {
  // synthetic fixture (format sample), not market data
  const xml = `<rss><channel><item><title>Fed holds rates - Bloomberg.com</title><link>https://news.google.com/rss/articles/CBMi1?oc=5</link><pubDate>Fri, 25 Sep 2026 12:00:00 GMT</pubDate><description>&lt;a href="x"&gt;link&lt;/a&gt;</description><source url="https://www.bloomberg.com">Bloomberg.com</source></item></channel></rss>`;
  const e = parseFeed(xml)[0]!;
  assert.equal(stripPublisherSuffix(e.title, e.source), "Fed holds rates");
  const it = googleNewsEntryToItem(e, { sourceId: "gn-bloomberg", sourceName: "Google 뉴스 · Bloomberg", tier: 3, fetchedAt: CTX.fetchedAt, region: "US", lang: "en", query: "site:bloomberg.com" });
  assert.ok(it);
  assert.equal(it!.title, "Fed holds rates");
  assert.equal(it!.url, "https://news.google.com/rss/articles/CBMi1?oc=5");
  assert.equal(it!.snippet, undefined);
  assert.equal(it!.paywalled, true);
  assert.equal(it!.sourceTier, 1);
});

test("AT-12: Bloomberg RSS items are headline-only (no snippet) and 유료", () => {
  // synthetic fixture (format sample), not market data
  const e = parseFeed(`<rss><channel><item><title>Stocks rally</title><link>https://www.bloomberg.com/news/articles/x</link><pubDate>Fri, 25 Sep 2026 12:00:00 GMT</pubDate><description>Long body text that must never be shown</description></item></channel></rss>`)[0]!;
  const it = rssEntryToItem(e, { sourceId: "bloomberg-markets", sourceName: "Bloomberg Markets", tier: 1, fetchedAt: CTX.fetchedAt, region: "US", lang: "en", paywalled: true, headlineOnly: true });
  assert.equal(it!.snippet, undefined);
  assert.equal(it!.paywalled, true);
});

test("KIS news-title rows: KST date+time, tickers from iscd1..5, search link (no original)", () => {
  // synthetic fixture (format sample), not market data
  const it = kisNewsRowToItem({ cntt_usiq_srno: "2026092500123", data_dt: "20260925", data_tm: "140305", hts_pbnt_titl_cntt: "삼성전자, 공시", dorg: "한국거래소", iscd1: "005930", iscd2: "" }, { sourceId: "kis-news-title", sourceName: "KIS", tier: 1, fetchedAt: CTX.fetchedAt });
  assert.ok(it);
  assert.equal(it!.publishedAt, "2026-09-25T05:03:05.000Z");
  assert.deepEqual(it!.tickers, [{ market: "KR", code: "005930" }]);
  assert.match(it!.url, /^https:\/\/search\.naver\.com\//);
});

test("Finnhub rows, SEC atom CIK and Yahoo meta snapshot", () => {
  // synthetic fixture (format sample), not market data
  const f = finnhubRowToItem({ id: 7, headline: "Nvidia beats", url: "https://example.com/n", datetime: 1790000000, source: "Reuters", related: "NVDA" }, { sourceId: "finnhub-news", sourceName: "Finnhub", tier: 3, fetchedAt: CTX.fetchedAt, region: "US", lang: "en" });
  assert.deepEqual(f!.tickers, [{ market: "US", code: "NVDA" }]);
  assert.equal(f!.sourceTier, 1);
  assert.equal(secAtomCik("8-K - NVIDIA CORP (0001045810) (Filer)"), "1045810");
  // synthetic fixture (format sample), not market data
  const snap = yahooChartSnapshot({ chart: { result: [{ meta: { symbol: "^GSPC", regularMarketPrice: 110, chartPreviousClose: 100, regularMarketTime: 1790000000, exchangeDataDelayedBy: 15, currency: "USD" } }] } });
  assert.equal(snap!.change, 10);
  assert.equal(snap!.changePct, 10);
  assert.equal(snap!.delayMinutes, 15);
  assert.equal(yahooChartSnapshot({}), null);
});

test("Yahoo 1D change uses the prior session close, never the 5-day chartPreviousClose", () => {
  const day = 86_400;
  const t0 = 1_790_000_000 - (1_790_000_000 % day) + 48_600; // 13:30 UTC session open
  const meta = { symbol: "ISRG", regularMarketPrice: 105, chartPreviousClose: 80, range: "5d", gmtoffset: -14_400, fiftyTwoWeekHigh: 120, fiftyTwoWeekLow: 60, longName: "Sample Corp" };
  const bars = { timestamp: [t0 - 4 * day, t0 - 3 * day, t0 - 2 * day, t0 - day, t0], indicators: { quote: [{ close: [90, 95, null, 100, 104] }] } };
  // synthetic fixture (format sample), not market data
  const live = yahooChartSnapshot({ chart: { result: [{ meta: { ...meta, regularMarketTime: t0 + 3_600 }, ...bars }] } });
  assert.equal(live!.prevClose, 100);
  assert.equal(live!.change, 5);
  assert.equal(live!.high52, 120);
  assert.equal(live!.low52, 60);
  assert.equal(live!.name, "Sample Corp");
  // synthetic fixture (format sample), not market data — latest bar is an earlier session
  const next = yahooChartSnapshot({ chart: { result: [{ meta: { ...meta, regularMarketTime: t0 + day + 3_600 }, ...bars }] } });
  assert.equal(next!.prevClose, 104);
  // synthetic fixture (format sample), not market data — 5d window without bars: no 1D basis
  const bare = yahooChartSnapshot({ chart: { result: [{ meta: { ...meta, regularMarketTime: t0 } }] } });
  assert.equal(bare!.change, null);
});

test("session estimates: US by NY clock, KRX/NXT by KST clock, weekends closed", () => {
  assert.equal(usSessionEstimate(Date.parse("2026-09-25T13:00:00Z")).session, "pre"); // 09:00 ET Fri
  assert.equal(usSessionEstimate(Date.parse("2026-09-25T14:00:00Z")).session, "regular");
  assert.equal(usSessionEstimate(Date.parse("2026-09-25T21:00:00Z")).session, "after");
  assert.equal(usSessionEstimate(Date.parse("2026-09-26T14:00:00Z")).session, "closed"); // Sat
  assert.equal(krSessionEstimate(Date.parse("2026-09-25T01:00:00Z")).session, "regular"); // 10:00 KST
  assert.equal(krSessionEstimate(Date.parse("2026-09-24T23:10:00Z")).session, "nxt-pre"); // 08:10 KST
  assert.equal(krSessionEstimate(Date.parse("2026-09-25T07:00:00Z")).session, "after-hours"); // 16:00 KST
  assert.equal(krSessionEstimate(Date.parse("2026-09-25T10:00:00Z")).session, "nxt-after"); // 19:00 KST
  assert.equal(krSessionEstimate(Date.parse("2026-09-26T01:00:00Z")).session, "closed"); // Sat
});

function fi(id: string, iso: string, extra: Partial<FeedItem> = {}): FeedItem {
  return { id, kind: "news", region: "KR", sourceId: "s1", sourceName: "S1", sourceTier: 3, title: id, url: `https://e.com/${id}`, publishedAt: iso, precision: "minute", fetchedAt: iso, tickers: [], sectors: [], topics: [], lang: "ko", ...extra };
}

test("AT-10: filters (source/topic/watchlist/importance) and 더 보기 merge produce no duplicates", () => {
  const p1 = { items: [fi("a", "2026-09-25T05:00:00.000Z", { topics: ["fx"], tickers: [{ market: "KR", code: "005930" }] }), fi("b", "2026-09-25T04:00:00.000Z", { sourceId: "s2", sourceName: "S2", importance: { score: 70, tier: "high", reasons: ["x"] } })] };
  const p2 = { items: [fi("b", "2026-09-25T04:00:00.000Z"), fi("c", "2026-09-25T03:00:00.000Z", { title: "현대차 실적 발표" })] };
  const merged = mergeFeedPages([p1, p2]);
  assert.deepEqual(merged.map((x) => x.id), ["a", "b", "c"]);
  const watch = { tickers: ["005930"], keywords: [] };
  assert.deepEqual(applyFeedFilters(merged, { ...EMPTY_FILTERS, sources: ["s2"] }).map((x) => x.id), ["b"]);
  assert.deepEqual(applyFeedFilters(merged, { ...EMPTY_FILTERS, topics: ["fx"] }).map((x) => x.id), ["a"]);
  assert.deepEqual(applyFeedFilters(merged, { ...EMPTY_FILTERS, watchOnly: true }, watch).map((x) => x.id), ["a"]);
  assert.deepEqual(applyFeedFilters(merged, { ...EMPTY_FILTERS, minImportance: 60 }).map((x) => x.id), ["b"]);
  assert.deepEqual(applyFeedFilters(merged, { ...EMPTY_FILTERS, q: "현대차" }).map((x) => x.id), ["c"]);
  assert.deepEqual(sourceFacets(merged).map((f) => f.id), ["s1", "s2"]);
});

test("merge drops a later-page row already shown inside an earlier cluster", () => {
  const [rep] = clusterItems([
    fi("x1", "2026-09-25T05:00:00.000Z", { title: "코스피 2% 급락 마감", sourceTier: 1 }),
    fi("x2", "2026-09-25T05:10:00.000Z", { title: "코스피, 2% 급락 마감 - 한국경제" }),
  ]);
  assert.equal(rep!.cluster!.size, 2);
  const merged = mergeFeedPages([{ items: [rep!] }, { items: [fi("x2", "2026-09-25T05:10:00.000Z")] }]);
  assert.deepEqual(merged.map((x) => x.id), ["x1"]);
});
