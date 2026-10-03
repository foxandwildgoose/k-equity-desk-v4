import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSourceTime, formatItemTime, formatAbsoluteTime, kstDayKey, dateGroupLabel } from "./time.ts";
import { compareNewestFirst, sortNewestFirst, pageAfterCursor, encodeCursor, decodeCursor } from "./sort.ts";
import { parseFeed, decodeFeedBytes } from "./rss-parse.ts";
import { canonicalizeUrl, clampSnippet, stripHtml } from "./text.ts";
import { clusterItems, clusterTokens, jaccard, normalizeClusterTitle, filterDisabledSources } from "./cluster.ts";
import { scoreImportance } from "./importance.ts";
import { themeMomentum, topStories } from "./briefing.ts";
import { sortReportsNewestFirst, sortDisclosuresNewestFirst } from "./mappers.ts";
import type { FeedItem } from "./types.ts";

const NOW = Date.parse("2026-09-26T03:00:00Z"); // 12:00 KST

function item(p: Partial<FeedItem> & { id: string }): FeedItem {
  return {
    kind: "news",
    region: "KR",
    sourceId: "test",
    sourceName: "테스트",
    sourceTier: 3,
    title: p.id,
    url: `https://example.com/${p.id}`,
    publishedAt: null,
    precision: "unknown",
    fetchedAt: "2026-09-26T03:00:00.000Z",
    tickers: [],
    sectors: [],
    topics: [],
    lang: "ko",
    ...p,
  };
}

function timed(id: string, raw: string, extra: Partial<FeedItem> = {}): FeedItem {
  const t = parseSourceTime(raw, { zone: "Asia/Seoul", now: NOW });
  return item({ id, publishedAt: t.iso, precision: t.precision, ...extra });
}

// ── B0.2 parseSourceTime ────────────────────────────────────────────────
test("parseSourceTime handles every documented format", () => {
  const cases: [unknown, string | null, string][] = [
    ["2026.09.25", "2026-09-25T12:00:00.000Z", "day"],
    ["26.09.25", "2026-09-25T12:00:00.000Z", "day"],
    ["2026-09-25", "2026-09-25T12:00:00.000Z", "day"],
    ["20260925", "2026-09-25T12:00:00.000Z", "day"],
    ["202609251403", "2026-09-25T05:03:00.000Z", "minute"],
    ["2026.09.25 14:03", "2026-09-25T05:03:00.000Z", "minute"],
    ["09.25 14:03", "2026-09-25T05:03:00.000Z", "minute"],
    ["2026-09-25T14:03:00+09:00", "2026-09-25T05:03:00.000Z", "second"],
    ["2026-09-25T05:03:00Z", "2026-09-25T05:03:00.000Z", "second"],
    ["Fri, 25 Sep 2026 12:18:36 +0000", "2026-09-25T12:18:36.000Z", "second"],
    [1790000000, "2026-09-21T14:13:20.000Z", "second"],
    [1790000000000, "2026-09-21T14:13:20.000Z", "second"],
  ];
  for (const [raw, iso, precision] of cases) {
    assert.deepEqual(parseSourceTime(raw, { zone: "Asia/Seoul", now: NOW }), { iso, precision }, String(raw));
  }
});

test("parseSourceTime: invalid input → unknown", () => {
  for (const raw of ["", "garbage", "2026.13.40", "99:99", null, undefined, {}, Number.NaN, "2026-02-30"]) {
    assert.deepEqual(parseSourceTime(raw, { now: NOW }), { iso: null, precision: "unknown" }, String(raw));
  }
});

test("parseSourceTime: MM.DD HH:mm more than a day in the future rolls back a year", () => {
  const jan2 = Date.parse("2026-01-02T03:00:00Z");
  assert.equal(parseSourceTime("12.31 23:00", { zone: "Asia/Seoul", now: jan2 }).iso, "2025-12-31T14:00:00.000Z");
  assert.equal(parseSourceTime("01.02 09:00", { zone: "Asia/Seoul", now: jan2 }).iso, "2026-01-02T00:00:00.000Z");
});

test("parseSourceTime: New York wall time respects DST", () => {
  assert.equal(parseSourceTime("2026-09-25 10:00", { zone: "America/New_York" }).iso, "2026-09-25T14:00:00.000Z");
  assert.equal(parseSourceTime("2026-12-01 10:00", { zone: "America/New_York" }).iso, "2026-12-01T15:00:00.000Z");
});

// ── AT-01 mixed formats newest first, seq tie-break ─────────────────────
test("AT-01: mixed-format dates sort strictly newest first; same-day ties by seq desc", () => {
  const list = [
    timed("a", "2026.09.25", { seq: 10 }),
    timed("b", "26.09.24", { seq: 99 }),
    timed("c", "2026-09-26", { seq: 1 }),
    timed("d", "20260923", { seq: 5 }),
    timed("e", "202609251403", { seq: 7 }),
    timed("f", "2026.09.25", { seq: 11 }),
  ];
  assert.deepEqual(
    sortNewestFirst(list).map((x) => x.id),
    ["c", "e", "f", "a", "b", "d"],
  );
});

test("AT-01: comparator is total and deterministic (tier, then id)", () => {
  const a = timed("x2", "2026.09.25", { sourceTier: 2 });
  const b = timed("x1", "2026.09.25", { sourceTier: 2 });
  const c = timed("x0", "2026.09.25", { sourceTier: 1 });
  assert.deepEqual(sortNewestFirst([a, b, c]).map((x) => x.id), ["x0", "x1", "x2"]);
  assert.equal(compareNewestFirst(a, a), 0);
});

// ── AT-02 date-only never shows a time; unknown sinks ───────────────────
test("AT-02: date-only items never print a clock time; unknown sinks with 날짜 미상", () => {
  const d = timed("d", "2026.09.25");
  assert.equal(formatItemTime(d, { now: NOW }), "09.25");
  assert.doesNotMatch(formatItemTime(d, { now: NOW }), /:/);
  assert.equal(formatItemTime(d, { now: NOW, tz: "ET" }), "09.25");
  assert.match(formatAbsoluteTime(d), /날짜만 제공/);
  const u = item({ id: "u" });
  assert.equal(formatItemTime(u, { now: NOW }), "날짜 미상");
  const sorted = sortNewestFirst([u, timed("old", "20200101"), d]);
  assert.equal(sorted.at(-1)!.id, "u");
});

test("formatItemTime: relative under 12h, absolute after, YYYY.MM.DD after 180 days", () => {
  assert.equal(formatItemTime(timed("a", "2026-09-26T11:59:40+09:00"), { now: NOW }), "방금");
  assert.equal(formatItemTime(timed("a", "2026-09-26T11:15:00+09:00"), { now: NOW }), "45분 전");
  assert.equal(formatItemTime(timed("a", "2026-09-26T02:00:00+09:00"), { now: NOW }), "10시간 전");
  assert.equal(formatItemTime(timed("a", "2026-09-25T14:03:00+09:00"), { now: NOW }), "09.25 14:03");
  assert.equal(formatItemTime(timed("a", "2026-09-25T14:03:00+09:00"), { now: NOW, tz: "ET" }), "09.25 01:03");
  assert.equal(formatItemTime(timed("a", "2025-12-01T10:00:00+09:00"), { now: NOW }), "2025.12.01");
  assert.match(formatAbsoluteTime(timed("a", "2026-09-25T14:03:00+09:00"), { withEt: true }), /KST · .*ET$/);
});

test("same KST day: timed items before date-only items", () => {
  const list = sortNewestFirst([timed("dateonly", "2026.09.25", { seq: 999 }), timed("timed", "2026-09-25T08:00:00+09:00")]);
  assert.deepEqual(list.map((x) => x.id), ["timed", "dateonly"]);
  assert.equal(kstDayKey("2026-09-25T15:30:00Z"), "2026-09-26");
  assert.equal(dateGroupLabel("2026-09-26", NOW), "오늘");
  assert.equal(dateGroupLabel("2026-09-25", NOW), "어제");
});

test("cursor paging never repeats rows", () => {
  const list = sortNewestFirst(Array.from({ length: 25 }, (_, i) => timed(`n${String(i).padStart(2, "0")}`, `2026-09-2${i % 5}T0${i % 9}:00:00+09:00`)));
  const seen = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page: { items: FeedItem[]; nextCursor: string | null } = pageAfterCursor(list, cursor, 10);
    for (const it of page.items) {
      assert.ok(!seen.has(it.id), `duplicate ${it.id}`);
      seen.add(it.id);
    }
    cursor = page.nextCursor;
    pages++;
  } while (cursor && pages < 10);
  assert.equal(seen.size, 25);
  assert.deepEqual(decodeCursor(encodeCursor({ publishedAt: "2026-09-25T00:00:00.000Z", id: "a|b" })), {
    publishedAt: "2026-09-25T00:00:00.000Z",
    id: "a|b",
  });
});

// ── AT-03 RSS 2.0 / Atom / EUC-KR parse to identical normalized items ──
// synthetic fixture (format sample), not market data
const EUC_TITLE_HEX = "c4dabdbac7c720322520b1deb6f420b8b6b0a8"; // "코스피 2% 급락 마감"
function hexBytes(hex: string): number[] {
  return hex.match(/../g)!.map((h) => parseInt(h, 16));
}

test("AT-03: RSS 2.0, Atom and EUC-KR fixtures normalize identically", () => {
  // synthetic fixture (format sample), not market data
  const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>t</title>
    <item><title><![CDATA[코스피 2% 급락 마감]]></title><link>https://news.example.com/a1?utm_source=rss#top</link>
    <guid>a1</guid><pubDate>Fri, 25 Sep 2026 06:30:00 +0000</pubDate>
    <description><![CDATA[<p>코스피가 <b>2%</b> 내렸다 &amp; 마감</p>]]></description></item></channel></rss>`;
  // synthetic fixture (format sample), not market data
  const atom = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>t</title>
    <entry><title>코스피 2% 급락 마감</title><link rel="alternate" href="https://news.example.com/a1"/>
    <id>a1</id><published>2026-09-25T15:30:00+09:00</published>
    <summary type="html">&lt;p&gt;코스피가 &lt;b&gt;2%&lt;/b&gt; 내렸다 &amp;amp; 마감&lt;/p&gt;</summary></entry></feed>`;
  // synthetic fixture (format sample), not market data
  const head = new TextEncoder().encode(
    '<?xml version="1.0" encoding="EUC-KR"?><rss version="2.0"><channel><title>t</title><item><title>',
  );
  const mid = new TextEncoder().encode(
    "</title><link>http://news.example.com/a1</link><guid>a1</guid><pubDate>Fri, 25 Sep 2026 06:30:00 GMT</pubDate><description>&lt;p&gt;",
  );
  const tail = new TextEncoder().encode("&lt;/p&gt;</description></item></channel></rss>");
  const descHex = "c4dabdbac7c7b0a120322520b3bbb7c8b4d92026616d703b20b8b6b0a8"; // "코스피가 2% 내렸다 &amp; 마감" (entity-escaped as in real XML)
  const bytes = new Uint8Array([...head, ...hexBytes(EUC_TITLE_HEX), ...mid, ...hexBytes(descHex), ...tail]);
  const eucText = decodeFeedBytes(bytes, "text/xml");

  const norm = (xml: string) =>
    parseFeed(xml).map((e) => ({
      title: e.title,
      link: canonicalizeUrl(e.link),
      guid: e.guid,
      publishedAt: parseSourceTime(e.pubDate, { zone: "UTC" }).iso,
      snippet: clampSnippet(e.description),
    }));
  const a = norm(rss);
  const b = norm(atom);
  const c = norm(eucText);
  assert.equal(a.length, 1);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
  assert.equal(a[0]!.title, "코스피 2% 급락 마감");
  assert.equal(a[0]!.link, "https://news.example.com/a1");
  assert.equal(a[0]!.snippet, "코스피가 2% 내렸다 & 마감");
});

test("parseFeed: missing dates and CDATA; RDF; never throws", () => {
  // synthetic fixture (format sample), not market data
  const rdf = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
    <channel><title>c</title></channel><item><title><![CDATA[R & D]]></title><link>https://r.example.com/1</link></item></rdf:RDF>`;
  const out = parseFeed(rdf);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.title, "R & D");
  assert.equal(out[0]!.pubDate, "");
  assert.deepEqual(parseSourceTime(out[0]!.pubDate), { iso: null, precision: "unknown" });
  assert.deepEqual(parseFeed("<html>not a feed"), []);
  assert.deepEqual(parseFeed(""), []);
});

test("text helpers: snippet ≤ 240, canonical URL drops utm/fragment, keeps Google News", () => {
  const long = "가".repeat(500);
  assert.equal(clampSnippet(long)!.length, 240);
  assert.equal(stripHtml("<p>A&amp;B</p>"), "A&B");
  assert.equal(canonicalizeUrl("http://x.example.com/a?utm_medium=x&id=3#f"), "https://x.example.com/a?id=3");
  const gn = "https://news.google.com/rss/articles/CBMi123?oc=5&utm_source=x";
  assert.equal(canonicalizeUrl(gn), gn);
  assert.equal(canonicalizeUrl("javascript:alert(1)"), null);
});

// ── AT-04 clustering + importance reasons ───────────────────────────────
test("AT-04: [속보] 코스피 2% 급락 clusters with 코스피, 2% 급락 마감 - 한국경제", () => {
  assert.equal(normalizeClusterTitle("[속보] 코스피 2% 급락"), "코스피 2 급락");
  assert.equal(normalizeClusterTitle("코스피, 2% 급락 마감 - 한국경제"), "코스피 2 급락 마감");
  const a = timed("yna", "2026-09-26T11:00:00+09:00", { title: "[속보] 코스피 2% 급락", sourceTier: 1, sourceName: "연합뉴스" });
  const b = timed("hk", "2026-09-26T11:20:00+09:00", { title: "코스피, 2% 급락 마감 - 한국경제", sourceTier: 2, sourceName: "한국경제" });
  const c = timed("other", "2026-09-26T11:10:00+09:00", { title: "원·달러 환율 1400원 돌파" });
  assert.ok(jaccard(clusterTokens(a.title), clusterTokens(b.title)) >= 0.6);
  const out = clusterItems([a, b, c]);
  assert.equal(out.length, 2);
  const rep = out.find((x) => x.cluster!.size === 2)!;
  assert.equal(rep.id, "yna", "best tier wins");
  assert.deepEqual(rep.cluster!.members!.map((m) => m.id), ["hk"]);
});

test("AT-04: clusters never merge beyond 12 h", () => {
  const a = timed("a", "2026-09-25T08:00:00+09:00", { title: "삼성전자 3분기 실적 발표" });
  const b = timed("b", "2026-09-26T11:00:00+09:00", { title: "삼성전자 3분기 실적 발표" });
  assert.equal(clusterItems([a, b]).length, 2);
});

test("AT-04: every high-or-higher item carries ≥ 1 reason; weights explained", () => {
  const flash = timed("f", "2026-09-26T11:50:00+09:00", {
    title: "[속보] 한은 기준금리 인하… 서킷브레이커 발동",
    sourceTier: 1,
    tickers: [{ market: "KR", code: "005930" }],
    cluster: { id: "c", size: 3, sources: ["a", "b", "c"] },
  });
  const s = scoreImportance(flash, { now: NOW, watchTickers: ["005930"] });
  assert.equal(s.tier, "flash");
  assert.ok(s.score >= 80);
  assert.ok(s.reasons.some((r) => r.startsWith("1차 출처")));
  assert.ok(s.reasons.some((r) => r.startsWith("속보")));
  assert.ok(s.reasons.some((r) => r.includes("관심종목")));
  for (let i = 0; i < 50; i++) {
    const x = timed(`r${i}`, "2026-09-26T09:00:00+09:00", { title: `실적 가이던스 FOMC ${i}`, sourceTier: ((i % 3) + 1) as 1 | 2 | 3 });
    const sc = scoreImportance(x, { now: NOW });
    if (sc.tier !== "normal") assert.ok(sc.reasons.length >= 1);
  }
  const old = scoreImportance(timed("o", "2026-09-25T09:00:00+09:00", { title: "[속보] FOMC", sourceTier: 1 }), { now: NOW });
  assert.equal(old.tier, "normal");
  assert.ok(old.reasons.some((r) => r.startsWith("경과")));
  const unknown = scoreImportance(item({ id: "u", title: "[속보] FOMC", sourceTier: 1 }), { now: NOW });
  assert.equal(unknown.score, 0);
});

test("filterDisabledSources promotes a surviving cluster member", () => {
  const a = timed("bb", "2026-09-26T11:00:00+09:00", { title: "Fed holds rates steady amid inflation", sourceId: "bloomberg-markets", sourceTier: 1, paywalled: true });
  const b = timed("gn", "2026-09-26T11:05:00+09:00", { title: "Fed holds rates steady amid inflation - Reuters", sourceId: "gn-us-market" });
  const clustered = clusterItems([a, b]);
  assert.equal(clustered.length, 1);
  const off = filterDisabledSources(clustered, new Set(["bloomberg-markets"]));
  assert.equal(off.length, 1);
  assert.equal(off[0]!.sourceId, "gn-us-market");
  assert.equal(off[0]!.cluster!.size, 1);
  assert.equal(filterDisabledSources(clustered, new Set(["bloomberg-markets", "gn-us-market"])).length, 0);
});

test("briefing: top stories ranked by importance within 12 h; theme momentum counts", () => {
  const items = [
    timed("a", "2026-09-26T11:00:00+09:00", { title: "HBM 수요 급증 SK하이닉스", importance: { score: 70, tier: "high", reasons: ["x"] } }),
    timed("b", "2026-09-26T10:00:00+09:00", { title: "HBM 공급 부족 지속", importance: { score: 40, tier: "normal", reasons: ["x"] } }),
    timed("c", "2026-09-25T10:00:00+09:00", { title: "HBM 가격 전망", importance: { score: 99, tier: "flash", reasons: ["x"] } }),
  ];
  assert.deepEqual(topStories(items, { now: NOW }).map((x) => x.id), ["a", "b"]);
  const m = themeMomentum(items, { now: NOW });
  const hbm = m.find((t) => t.term === "hbm");
  assert.ok(hbm);
  assert.equal(hbm!.recent, 2);
  assert.equal(hbm!.prior, 1);
});

// ── D1 call-site sorters ────────────────────────────────────────────────
test("D1: research reports with mixed date formats sort newest first, nid tie-break", () => {
  const reports = [
    { researchId: 100, date: "2026.09.24", category: "industry" as const },
    { researchId: 101, date: "2026-09-25", category: "industry" as const },
    { researchId: 102, date: "26.09.25", category: "company" as const },
    { researchId: 99, date: "2026.09.26", category: "company" as const },
  ];
  assert.deepEqual(sortReportsNewestFirst(reports).map((r) => r.researchId), [99, 102, 101, 100]);
});

test("D1: disclosures across ISO / compact / date-only formats sort newest first", () => {
  const rows = [
    { id: "dart", datetime: "2026-09-25T15:30:00+09:00" },
    { id: "naver", datetime: "202609251600" },
    { id: "dateonly", datetime: "2026-09-25" },
    { id: "kind", datetime: "2026-09-26T08:00:00+09:00" },
    { id: "blank", datetime: "" },
  ];
  assert.deepEqual(sortDisclosuresNewestFirst(rows).map((r) => r.id), ["kind", "naver", "dart", "dateonly", "blank"]);
});
