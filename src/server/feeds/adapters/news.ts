/**
 * News-family adapters (F1.1 / F3.1). Every request goes through
 * `fetchWithPolicy`; every item is tagged with tickers. Registering happens at
 * import time (see `adapters/index.ts`).
 */
import { SOURCE_REGISTRY, type SourceDef } from "@/server/feeds/registry";
import { fetchJsonWithPolicy, fetchWithPolicy } from "@/server/feeds/http";
import { registerAdapter, type AdapterOutput, type AdapterRunOptions } from "@/server/feeds/runner";
import { setHealthNote } from "@/server/feeds/health";
import { tagItem } from "@/server/feeds/tagging";
import { parseFeed } from "@/lib/feed/rss-parse";
import { kstCompactDate } from "@/lib/feed/time";
import { mapNaverArticle, mapNaverWorldNews, naverList } from "@/lib/feed/parsers/naver";
import {
  finnhubRowToItem,
  googleNewsEntryToItem,
  kisNewsRowToItem,
  rssEntryToItem,
  secAtomCik,
} from "@/lib/feed/parsers/generic";
import { disclosureToFeed } from "@/lib/feed/mappers";
import type { FeedItem } from "@/lib/feed/types";

const DEF = new Map<string, SourceDef>(SOURCE_REGISTRY.map((s) => [s.id, s]));

function def(id: string): SourceDef {
  const d = DEF.get(id);
  if (!d) throw new Error(`unknown source ${id}`);
  return d;
}

function nowIso(opts: AdapterRunOptions): string {
  return new Date(opts.now ?? Date.now()).toISOString();
}

function dedupe(items: (FeedItem | null)[]): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const it of items) {
    if (!it || seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(tagItem(it));
  }
  return out;
}

// ── Static RSS / Atom sources ─────────────────────────────────────────
export async function runRss(id: string, opts: AdapterRunOptions): Promise<AdapterOutput> {
  const d = def(id);
  if (!d.url) return { items: [] };
  const res = await fetchWithPolicy(d.url, { sourceId: id, bypassCache: opts.bypassCache, accept: "application/rss+xml,application/atom+xml,application/xml,text/xml" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const entries = parseFeed(res.text);
  if (!entries.length && !/<(rss|feed|rdf:RDF)[\s>]/i.test(res.text)) throw new Error("parse-fail");
  const fetchedAt = nowIso(opts);
  const bloomberg = id.startsWith("bloomberg-");
  const items = entries.slice(0, 60).map((e) =>
    rssEntryToItem(e, {
      sourceId: id,
      sourceName: d.name,
      tier: d.tier,
      fetchedAt,
      region: d.region,
      lang: d.lang,
      kind: d.kind,
      topics: d.topics,
      paywalled: d.paywalled,
      zone: d.lang === "ko" ? "Asia/Seoul" : "UTC",
      // A4: Bloomberg — headline, link and time only.
      headlineOnly: bloomberg,
    }),
  );
  return { items: dedupe(items), adapterPath: d.format === "atom" ? "rss" : "rss" };
}

// ── stock.naver.com news ──────────────────────────────────────────────
const NAVER = "https://stock.naver.com";

async function runNaverList(id: string, url: string, opts: AdapterRunOptions, world = false): Promise<AdapterOutput> {
  const d = def(id);
  const json = await fetchJsonWithPolicy<unknown>(url, { sourceId: id, bypassCache: opts.bypassCache });
  const rows = naverList(json);
  const fetchedAt = nowIso(opts);
  const ctx = { sourceId: id, sourceName: d.name, tier: d.tier, fetchedAt, region: d.region, topics: d.topics };
  const items = rows.slice(0, 40).map((r) => (world ? mapNaverWorldNews(r, ctx) : mapNaverArticle(r, ctx)));
  if (rows.length && !items.some(Boolean)) {
    setHealthNote(id, "shape", "응답 구조가 예상과 다릅니다(필드 매핑 실패) — 소스 재검증 필요");
  } else setHealthNote(id, "shape", null);
  return { items: dedupe(items), adapterPath: "v2" };
}

export function naverFocusUrl(sid: string, page = 1, date = kstCompactDate()): string {
  return `${NAVER}/api/domestic/news/focus?sid=${sid}&page=${page}&pageSize=15&date=${date}&enableFallback=true`;
}

// ── Google News query groups ──────────────────────────────────────────
export const GN_QUERIES: Record<string, { q: string; locale: "ko" | "en" }[]> = {
  "gn-kr-market": ["코스피", "코스닥", "외국인 순매수", "증시 마감"].map((q) => ({ q: `${q} when:1d`, locale: "ko" as const })),
  "gn-us-market": ["stock market today", "S&P 500", "Nasdaq", "Treasury yields"].map((q) => ({ q: `${q} when:1d`, locale: "en" as const })),
  "gn-bloomberg": [{ q: "site:bloomberg.com when:1d", locale: "en" }],
};

export function googleNewsUrl(q: string, locale: "ko" | "en"): string {
  return locale === "ko"
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`
    : `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
}

export async function runGoogleNews(id: string, queries: { q: string; locale: "ko" | "en" }[], opts: AdapterRunOptions, extra?: { topics?: string[] }): Promise<AdapterOutput> {
  const d = def(id);
  const fetchedAt = nowIso(opts);
  const settled = await Promise.allSettled(
    queries.map(async ({ q, locale }) => {
      const res = await fetchWithPolicy(googleNewsUrl(q, locale), { sourceId: id, bypassCache: opts.bypassCache });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseFeed(res.text)
        .slice(0, 25)
        .map((e) =>
          googleNewsEntryToItem(e, {
            sourceId: id,
            sourceName: d.name,
            tier: d.tier,
            fetchedAt,
            region: d.region,
            lang: locale,
            kind: d.kind,
            topics: [...(d.topics ?? []), ...(extra?.topics ?? [])],
            paywalled: d.paywalled,
            query: q,
          }),
        );
    }),
  );
  const ok = settled.filter((s): s is PromiseFulfilledResult<(FeedItem | null)[]> => s.status === "fulfilled");
  if (!ok.length) {
    const first = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
    throw first?.reason instanceof Error ? first.reason : new Error("all queries failed");
  }
  return { items: dedupe(ok.flatMap((s) => s.value)), adapterPath: "rss" };
}

// ── KRX/DART disclosures (existing adapters) ──────────────────────────
async function runDisclosures(opts: AdapterRunOptions): Promise<AdapterOutput> {
  const { fetchKrxDisclosureDesk } = await import("@/server/krx-disclosures");
  const desk = await fetchKrxDisclosureDesk();
  // The legacy desk swallows per-source errors; nothing at all + KIND down = failure, not "0 items".
  if (!desk.all.length && !desk.kind.available) throw new Error(desk.kind.message || "KRX·DART 공시 응답 없음");
  const fetchedAt = nowIso(opts);
  const d = def("krx-disclosures");
  const items = desk.all.slice(0, 80).map((x) =>
    disclosureToFeed(
      {
        id: x.id,
        title: x.title,
        datetime: x.datetime,
        author: x.author,
        code: x.code ?? "",
        nameKo: x.nameKo,
        dartUrl: x.dartUrl ?? x.kindUrl,
        dartSearchUrl: x.dartSearchUrl ?? "https://dart.fss.or.kr/dsab007/main.do",
        canLoadBody: false,
        sourceLabel: x.sourceLabel,
      },
      { sourceId: d.id, sourceName: d.name, tier: 1, fetchedAt },
    ),
  );
  return { items: dedupe(items), adapterPath: "legacy" };
}

// ── KIS 종합 시황/공시 제목 (FHKST01011800) ─────────────────────────────
const KIS_BASE = "https://openapi.koreainvestment.com:9443";
let kisToken: { token: string; expiresAt: number } | null = null;
let kisLastTokenRequest = 0;

async function kisAccessToken(): Promise<string> {
  if (kisToken && Date.now() < kisToken.expiresAt - 60_000) return kisToken.token;
  // Never request more than one token per minute.
  if (Date.now() - kisLastTokenRequest < 60_000) throw new Error("KIS token rate limit (1/min)");
  kisLastTokenRequest = Date.now();
  const res = await fetchWithPolicy(`${KIS_BASE}/oauth2/tokenP`, {
    sourceId: "kis-news-title",
    method: "POST",
    ttlMs: 0,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ grant_type: "client_credentials", appkey: process.env.KIS_APP_KEY, appsecret: process.env.KIS_APP_SECRET }),
  });
  if (!res.ok) throw new Error(`KIS token HTTP ${res.status}`);
  const j = JSON.parse(res.text) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error("KIS token missing");
  kisToken = { token: j.access_token, expiresAt: Date.now() + Math.max(600, j.expires_in ?? 3600) * 1000 };
  return kisToken.token;
}

async function runKisNews(opts: AdapterRunOptions): Promise<AdapterOutput> {
  const d = def("kis-news-title");
  const token = await kisAccessToken();
  const params = new URLSearchParams({
    FID_NEWS_OFER_ENTP_CODE: "",
    FID_COND_MRKT_CLS_CODE: "",
    FID_INPUT_ISCD: "",
    FID_TITL_CNTT: "",
    FID_INPUT_DATE_1: "",
    FID_INPUT_HOUR_1: "",
    FID_RANK_SORT_CLS_CODE: "",
    FID_INPUT_SRNO: "",
  });
  const res = await fetchWithPolicy(`${KIS_BASE}/uapi/domestic-stock/v1/quotations/news-title?${params}`, {
    sourceId: d.id,
    bypassCache: opts.bypassCache,
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${token}`,
      appkey: process.env.KIS_APP_KEY ?? "",
      appsecret: process.env.KIS_APP_SECRET ?? "",
      tr_id: "FHKST01011800",
      custtype: "P",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = JSON.parse(res.text) as { rt_cd?: string; msg1?: string; output?: unknown };
  if (j.rt_cd && j.rt_cd !== "0") throw new Error(`KIS ${j.rt_cd} ${j.msg1 ?? ""}`.trim());
  const rows = Array.isArray(j.output) ? (j.output as Record<string, unknown>[]) : [];
  const fetchedAt = nowIso(opts);
  return {
    items: dedupe(rows.slice(0, 60).map((r) => kisNewsRowToItem(r, { sourceId: d.id, sourceName: d.name, tier: d.tier, fetchedAt }))),
    adapterPath: "json",
  };
}

// ── Finnhub (optional) ────────────────────────────────────────────────
async function runFinnhub(opts: AdapterRunOptions): Promise<AdapterOutput> {
  const d = def("finnhub-news");
  const key = process.env.FINNHUB_API_KEY ?? "";
  const rows = await fetchJsonWithPolicy<Record<string, unknown>[]>(
    `https://finnhub.io/api/v1/news?category=general&token=${encodeURIComponent(key)}`,
    { sourceId: d.id, bypassCache: opts.bypassCache },
  );
  const fetchedAt = nowIso(opts);
  return {
    items: dedupe((Array.isArray(rows) ? rows : []).slice(0, 60).map((r) => finnhubRowToItem(r, { sourceId: d.id, sourceName: d.name, tier: d.tier, fetchedAt, region: "US", lang: "en" }))),
    adapterPath: "json",
  };
}

// ── SEC latest 8-K Atom (candidate) ───────────────────────────────────
async function runSec8k(opts: AdapterRunOptions): Promise<AdapterOutput> {
  const d = def("sec-8k-atom");
  const res = await fetchWithPolicy(d.url!, { sourceId: d.id, bypassCache: opts.bypassCache, accept: "application/atom+xml" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { cikTickerMap } = await import("@/server/us-official-research");
  const byCik = await cikTickerMap().catch(() => new Map<string, string>());
  const fetchedAt = nowIso(opts);
  const items = parseFeed(res.text)
    .slice(0, 60)
    .map((e) => {
      const it = rssEntryToItem(e, { sourceId: d.id, sourceName: d.name, tier: 1, fetchedAt, region: "US", lang: "en", kind: "filing", topics: ["filing"] });
      if (!it) return null;
      const cik = secAtomCik(e.title);
      const ticker = cik ? byCik.get(cik) : undefined;
      return ticker ? { ...it, tickers: [{ market: "US" as const, code: ticker }] } : it;
    });
  return { items: dedupe(items), adapterPath: "rss" };
}

// ── Finviz / Nasdaq rating notes as kind "rating" ─────────────────────
async function runStreetRatings(opts: AdapterRunOptions): Promise<AdapterOutput> {
  const { fetchUsStreetPack, originalUrlForNote } = await import("@/lib/us-street");
  const pack = await fetchUsStreetPack();
  // us-street returns an empty pack on network failure; report it as an error.
  if (!pack.notes.length && !pack.headlines.length && !pack.consensus.length) throw new Error(pack.note.slice(0, 120));
  const d = def("finviz-ratings");
  const fetchedAt = nowIso(opts);
  const items: (FeedItem | null)[] = pack.notes.slice(0, 60).map((n) => {
    const orig = originalUrlForNote(n, pack.headlines);
    const title = `${n.symbol}: ${n.broker} ${n.action}${n.rating && n.rating !== "—" ? ` · ${n.rating}` : ""}${n.target ? ` · PT ${n.target}` : ""}`;
    return {
      id: `finviz-ratings:${n.id}`,
      kind: "rating",
      region: "US",
      sourceId: d.id,
      sourceName: d.name,
      sourceTier: 3,
      title,
      snippet: n.summary.slice(0, 240),
      url: orig.url,
      publishedAt: n.publishedAt,
      precision: n.precision,
      fetchedAt,
      seq: n.seq,
      tickers: [{ market: "US", code: n.symbol }],
      sectors: [],
      topics: ["rating"],
      lang: "en",
    };
  });
  return { items: dedupe(items), adapterPath: "html" };
}

// ── Registration ──────────────────────────────────────────────────────
for (const s of SOURCE_REGISTRY) {
  if ((s.format === "rss" || s.format === "atom") && s.url && !s.builder && s.id !== "sec-8k-atom") {
    registerAdapter(s.id, (o) => runRss(s.id, o));
  }
}
registerAdapter("naver-flash", (o) => runNaverList("naver-flash", `${NAVER}/api/domestic/news/list?category=FLASHNEWS&page=1&pageSize=15`, o));
registerAdapter("naver-main", (o) => runNaverList("naver-main", `${NAVER}/api/domestic/news/list?category=MAINNEWS&page=1&pageSize=15`, o));
for (const sid of ["401", "402", "403", "404", "406", "429"]) {
  registerAdapter(`naver-focus-${sid}`, (o) => runNaverList(`naver-focus-${sid}`, naverFocusUrl(sid, 1, kstCompactDate(o.now)), o));
}
registerAdapter("naver-worldnews", (o) =>
  runNaverList("naver-worldnews", `${NAVER}/api/foreign/news/worldNews?page=1&pageSize=15&date=${kstCompactDate(o.now)}`, o, true),
);
registerAdapter("naver-news-search-etf", (o) => runNaverList("naver-news-search-etf", `${NAVER}/api/domestic/news/search?query=ETF&page=1&pageSize=20`, o));
for (const [id, queries] of Object.entries(GN_QUERIES)) registerAdapter(id, (o) => runGoogleNews(id, queries, o));
registerAdapter("krx-disclosures", runDisclosures);
registerAdapter("kis-news-title", runKisNews);
registerAdapter("finnhub-news", runFinnhub);
registerAdapter("sec-8k-atom", runSec8k);
registerAdapter("finviz-ratings", runStreetRatings);
