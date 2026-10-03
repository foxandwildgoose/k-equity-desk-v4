import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  fetchAllUniverseQuotes,
  fetchRealtimeQuotes,
  fetchOhlc,
  fetchInvestorFlow,
  fetchResearchPack,
  fetchResearchDesk,
  fetchResearchPdf,
  fetchNews,
  fetchDisclosures,
  fetchDisclosureDetail,
  fetchIndices,
  fetchStockBasic,
  type ChartInterval,
  type MinuteSize,
  type LiveQuote,
  type NewsItem,
  type ResearchReport,
} from "@/server/naver-market";
import {
  fetchAllEtfs,
  fetchNewEtfs,
  fetchEtfDetail,
  fetchEtfHoldings,
  fetchWorldQuotes,
  fetchUsdKrw,
  filterEtfBucket,
  searchEtfsInList,
  normalizeEtfCode,
  ETF_CODE_RE,
  ETF_ASSET_CLASS_LABEL,
  type EtfMarketBucket,
  type LiveEtfRow,
  type EtfAssetClass,
} from "@/server/etf-market";
import { UNIVERSE } from "@/data/universe";
import { fillLiveMarketWeights } from "@/server/etf-holdings-parse";
import { sortDisclosuresNewestFirst, sortTimedNewestFirst } from "@/lib/feed/mappers";
import { inferSectorId, detectKrMarket, normalizeKrTicker, isKrTicker } from "@/lib/infer-sector";
import { US_LINKED_CODES, US_POLICY_BRIEFS } from "@/data/us-link";
import { fetchUsLinkLiveFeeds } from "@/server/us-link-feed";
import { fetchIndustryResearchBySector } from "@/server/industry-research";
import { fetchEtfListingNews } from "@/server/etf-news";
import {
  fetchKrxDisclosureDesk,
  fetchStockDisclosureBundle,
  fetchDartByCompany,
  type KrxDisclosureItem,
} from "@/server/krx-disclosures";

const quoteCache: { at: number; data: LiveQuote[] | null } = {
  at: 0,
  data: null,
};
const QUOTE_TTL_MS = 30_000;

const indexCache: {
  at: number;
  data: Awaited<ReturnType<typeof fetchIndices>> | null;
} = { at: 0, data: null };
const INDEX_TTL_MS = 25_000;

const deskCache: {
  at: number;
  data: Awaited<ReturnType<typeof fetchResearchDesk>> | null;
} = { at: 0, data: null };
const DESK_TTL_MS = 180_000;

const etfCache: { at: number; rows: LiveEtfRow[] | null } = {
  at: 0,
  rows: null,
};
const ETF_TTL = 60_000;
const newEtfCache: { at: number; rows: LiveEtfRow[] | null } = {
  at: 0,
  rows: null,
};
const NEW_ETF_TTL = 10 * 60_000;

const stockBundleCache = new Map<
  string,
  { at: number; data: unknown }
>();
const STOCK_BUNDLE_TTL_MS = 25_000;

export { getSecuritySearch } from "@/server/security-search";

export const getQuotesByCodes = createServerFn({ method: "GET" })
  .validator(z.object({ codes: z.array(z.string()).max(80) }))
  .handler(async ({ data }) => {
    const codes = [
      ...new Set(
        data.codes
          .map((c) => normalizeKrTicker(c))
          .filter((c) => isKrTicker(c)),
      ),
    ];
    if (!codes.length) return { quotes: [] as LiveQuote[], fetchedAt: new Date().toISOString() };
    const quotes = await fetchRealtimeQuotes(
      codes,
      Object.fromEntries(
        codes.map((c) => {
          const u = UNIVERSE.find((x) => x.code === c);
          return [
            c,
            {
              nameKo: u?.nameKo ?? c,
              nameEn: u?.nameEn ?? u?.nameKo ?? c,
              sectorId: u?.sectorId ?? inferSectorId(u?.nameKo ?? c),
              market: u?.market ?? "KOSPI",
            },
          ];
        }),
      ),
    );
    return { quotes, fetchedAt: new Date().toISOString() };
  });

export const getMarketQuotes = createServerFn({ method: "GET" }).handler(
  async () => {
    const now = Date.now();
    if (quoteCache.data && now - quoteCache.at < QUOTE_TTL_MS) {
      return {
        quotes: quoteCache.data,
        fetchedAt: new Date(quoteCache.at).toISOString(),
        source: "naver-finance-snapshot" as const,
        cached: true,
        live: false,
      };
    }
    const quotes = await fetchAllUniverseQuotes();
    quoteCache.data = quotes;
    quoteCache.at = now;
    return {
      quotes,
      fetchedAt: new Date(now).toISOString(),
      source: "naver-finance-snapshot" as const,
      cached: false,
      live: false,
    };
  },
);

export const getStockBundle = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string().regex(/^\d{6}$/) }))
  .handler(async ({ data }) => {
    const code = normalizeKrTicker(data.code);
    const now = Date.now();
    const hit = stockBundleCache.get(code);
    if (hit && now - hit.at < STOCK_BUNDLE_TTL_MS) {
      return hit.data as Awaited<ReturnType<typeof buildFresh>>;
    }

    async function buildFresh() {
    const uni = UNIVERSE.find((u) => u.code === code);
    // Seed meta from universe so quote/news/disc can start without waiting basic
    const seedMeta = {
      code,
      nameKo: uni?.nameKo ?? code,
      nameEn: uni?.nameEn ?? uni?.nameKo ?? code,
      sectorId: (uni?.sectorId ?? "electronics") as import("@/data/types").SectorId,
      market: (uni?.market ?? "KOSPI") as "KOSPI" | "KOSDAQ",
    };

    const v2CompanyP = import("@/server/research-v2")
      .then((m) => m.fetchResearchV2List({ type: "company", itemCodes: [code], size: 30 }))
      .catch(() => null);
    const [basic, quotes, flow, researchPack, news, discBundle] =
      await Promise.all([
        fetchStockBasic(code).catch(() => null),
        fetchRealtimeQuotes([code], {
          [code]: {
            nameKo: seedMeta.nameKo,
            nameEn: seedMeta.nameEn,
            sectorId: seedMeta.sectorId,
            market: seedMeta.market,
          },
        }),
        fetchInvestorFlow(code).catch(() => ({
          days: [] as Awaited<ReturnType<typeof fetchInvestorFlow>>["days"],
          source: "naver",
        })),
        fetchResearchPack(code).catch(() => ({
          company: [],
          industry: [],
          market: [],
          economy: [],
        })),
        fetchNews(code).catch(() => []),
        fetchStockDisclosureBundle(code, seedMeta.nameKo).catch(() => ({
          items: [],
          dart: [],
          koscom: [],
          kindStatus: {
            available: false,
            message: "",
            url: "https://kind.krx.co.kr/disclosure/todaydisclosure.do",
          },
        })),
      ]);

    const nameKo = uni?.nameKo ?? basic?.stockName ?? seedMeta.nameKo;
    const market = detectKrMarket(
      uni?.market,
      basic?.stockExchangeName,
      seedMeta.market,
    );
    const meta = uni ?? {
      code,
      nameKo,
      nameEn: nameKo,
      sectorId: inferSectorId(nameKo),
      market,
    };
    const disclosures = discBundle.items.map((d) => ({
      id: d.id,
      title: d.title,
      datetime: d.datetime,
      author: d.author,
      code: d.code ?? code,
      nameKo: d.nameKo ?? meta.nameKo,
      dartUrl: d.dartUrl,
      dartSearchUrl: d.dartSearchUrl,
      canLoadBody: d.canLoadBody,
      source: d.source,
      sourceLabel: d.sourceLabel,
      rcpNo: d.rcpNo,
    }));

    const quote = quotes[0] ?? null;
    if (quote && basic) {
      if (basic.high52) quote.high52 = basic.high52;
      if (basic.low52) quote.low52 = basic.low52;
      if (basic.tradedAt) quote.tradedAt = basic.tradedAt;
      if (basic.marketStatus) quote.marketStatus = basic.marketStatus;
    }

    // F2.1: v2 company list first (full, paged source); legacy list as fallback.
    const v2Company = await v2CompanyP;
    if (v2Company && v2Company.path === "v2" && v2Company.reports.length) {
      researchPack.company = v2Company.reports;
    }
    const payload = {
      meta,
      quote,
      basic,
      flow,
      research: researchPack.company,
      researchPack,
      news: sortTimedNewestFirst(news),
      disclosures,
      disclosureMeta: {
        kind: discBundle.kindStatus,
        dartCount: discBundle.dart.length,
        koscomCount: discBundle.koscom.length,
      },
      fetchedAt: new Date().toISOString(),
    };
    stockBundleCache.set(code, { at: Date.now(), data: payload });
    // bound cache size
    if (stockBundleCache.size > 80) {
      const first = stockBundleCache.keys().next().value;
      if (first) stockBundleCache.delete(first);
    }
    return payload;
    }

    return buildFresh();
  });

export const getChartData = createServerFn({ method: "GET" })
  .validator(
    z.object({
      code: z.string().trim().min(1).max(12),
      market: z.enum(["KOSPI", "KOSDAQ", "US"]),
      interval: z.enum(["minute", "day", "week", "month", "year"]),
      minuteSize: z
        .union([
          z.literal(1),
          z.literal(3),
          z.literal(5),
          z.literal(10),
          z.literal(15),
          z.literal(30),
          z.literal(60),
        ])
        .optional(),
      range: z.string().max(12).optional(),
      /** US intraday: include pre/post-market bars (F7.13). */
      prePost: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (data.market === "US") {
      return fetchOhlc({
        code: data.code.trim().toUpperCase(),
        market: "US",
        interval: data.interval,
        minuteSize: data.minuteSize,
        range: data.range,
        prePost: data.prePost,
      });
    }
    const code = normalizeKrTicker(data.code);
    return fetchOhlc({
      code,
      market: data.market,
      interval: data.interval,
      minuteSize: data.minuteSize,
      range: data.range,
    });
  });

export const getValuationSeries = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string().trim().min(1).max(12) }))
  .handler(async ({ data }) => {
    const { fetchValuationSeries } = await import("@/server/valuation-series");
    return fetchValuationSeries(data.code);
  });

export const getUsStreet = createServerFn({ method: "GET" })
  .validator(
    z.object({
      symbol: z.string().trim().max(12).optional(),
      symbols: z.array(z.string().trim().regex(/^[A-Za-z][A-Za-z0-9.]{0,9}$/)).max(12).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { emptyUsStreetPack, fetchUsStreetPack, fetchUsStreetSymbol } = await import("@/lib/us-street");
    const symbol = data.symbol?.trim();
    try {
      if (symbol) return await fetchUsStreetSymbol(symbol);
      return await fetchUsStreetPack(data.symbols?.length ? data.symbols : undefined);
    } catch {
      return emptyUsStreetPack("월가 공개 피드를 받지 못했습니다. 등급을 추정해 채우지 않습니다.");
    }
  });

export const getResearchPdf = createServerFn({ method: "GET" })
  .validator(
    z.object({
      researchId: z.number().int().positive(),
      category: z
        .enum(["company", "industry", "market", "economy"])
        .optional(),
    }),
  )
  .handler(async ({ data }) =>
    fetchResearchPdf(data.researchId, data.category ?? "company"),
  );

export const getResearchDesk = createServerFn({ method: "GET" }).handler(
  async () => {
    const now = Date.now();
    if (deskCache.data && now - deskCache.at < DESK_TTL_MS) {
      return {
        ...deskCache.data,
        fetchedAt: new Date(deskCache.at).toISOString(),
        cached: true,
      };
    }
    const desk = await fetchResearchDesk();
    deskCache.data = desk;
    deskCache.at = now;
    return {
      ...desk,
      fetchedAt: new Date(now).toISOString(),
      cached: false,
    };
  },
);

const industryCache = new Map<
  string,
  { at: number; data: Awaited<ReturnType<typeof fetchIndustryResearchBySector>> }
>();
const INDUSTRY_TTL_MS = 180_000;

export const getIndustryResearch = createServerFn({ method: "GET" })
  .validator(z.object({ sectorId: z.string().min(2).max(40) }))
  .handler(async ({ data }) => {
    const sectorId = data.sectorId as import("@/data/types").SectorId;
    const now = Date.now();
    const hit = industryCache.get(sectorId);
    if (hit && now - hit.at < INDUSTRY_TTL_MS) return { ...hit.data, cached: true };
    const pack = await fetchIndustryResearchBySector(sectorId);
    industryCache.set(sectorId, { at: now, data: pack });
    return { ...pack, cached: false };
  });

export const getDisclosureDetail = createServerFn({ method: "GET" })
  .validator(
    z.object({
      code: z.string().regex(/^[0-9A-Za-z]{6}$/),
      disclosureId: z.string().min(1).max(80),
    }),
  )
  .handler(async ({ data }) =>
    fetchDisclosureDetail(normalizeKrTicker(data.code), data.disclosureId),
  );

/** F1.4: per-stock Naver news page N (newest first via the kernel), for 더 보기. */
export const getStockNews = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string().regex(/^[0-9A-Z]{6}$/), page: z.number().int().min(1).max(20) }))
  .handler(async ({ data }) => {
    const code = normalizeKrTicker(data.code);
    try {
      const items = await fetchNews(code, data.page);
      return { items: sortTimedNewestFirst(items), page: data.page, hasMore: items.length >= 20, error: null as string | null, fetchedAt: new Date().toISOString() };
    } catch (err) {
      return { items: [] as NewsItem[], page: data.page, hasMore: false, error: err instanceof Error ? err.message.slice(0, 120) : "error", fetchedAt: new Date().toISOString() };
    }
  });

export const getMarketIndices = createServerFn({ method: "GET" }).handler(
  async () => {
    const now = Date.now();
    if (indexCache.data && now - indexCache.at < INDEX_TTL_MS) {
      return {
        indices: indexCache.data,
        fetchedAt: new Date(indexCache.at).toISOString(),
        source: "naver-finance-snapshot" as const,
        cached: true,
      };
    }
    const indices = await fetchIndices();
    indexCache.data = indices;
    indexCache.at = now;
    return {
      indices,
      fetchedAt: new Date(now).toISOString(),
      source: "naver-finance-snapshot" as const,
      cached: false,
    };
  },
);

export const getScanDisclosures = createServerFn({ method: "GET" }).handler(
  async () => {
    const desk = await fetchKrxDisclosureDesk();
    const merged = sortDisclosuresNewestFirst([...desk.koscom, ...desk.dart]).slice(0, 100);
    return merged.map((d) => ({
      id: d.id,
      title: d.title,
      datetime: d.datetime,
      author: d.author,
      code: d.code,
      nameKo: d.nameKo,
      dartUrl: d.dartUrl,
      dartSearchUrl: d.dartSearchUrl,
      canLoadBody: d.canLoadBody,
      source: d.source,
      sourceLabel: d.sourceLabel,
      rcpNo: d.rcpNo,
      market: d.market,
    }));
  },
);

export const getKrxDisclosureDesk = createServerFn({ method: "GET" }).handler(
  async () => fetchKrxDisclosureDesk(),
);

export const getStockDisclosures = createServerFn({ method: "GET" })
  .validator(
    z.object({
      code: z.string().min(4).max(8),
      nameKo: z.string().max(40).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const code = data.code.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    return fetchStockDisclosureBundle(code, data.nameKo);
  });

export const getEtfMarket = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        bucket: z
          .enum(["retirement", "all", "new", "theme", "us", "bond"])
          .optional(),
        q: z.string().max(80).optional(),
        limit: z.number().int().min(1).max(300).optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    const bucket = (data?.bucket ?? "retirement") as EtfMarketBucket;
    const q = data?.q?.trim() ?? "";
    const limit = data?.limit ?? 120;

    const now = Date.now();
    let rows = etfCache.rows;
    if (!rows || now - etfCache.at >= ETF_TTL) {
      rows = await fetchAllEtfs();
      etfCache.rows = rows;
      etfCache.at = now;
    }

    let newRows: LiveEtfRow[] | null = newEtfCache.rows;
    if (bucket === "new") {
      if (!newRows || now - newEtfCache.at >= NEW_ETF_TTL) {
        newRows = await fetchNewEtfs(48);
        newEtfCache.rows = newRows;
        newEtfCache.at = now;
      }
    }

    const base =
      bucket === "new"
        ? (newRows ?? filterEtfBucket(rows, "new"))
        : filterEtfBucket(rows, bucket);

    const filtered = q
      ? searchEtfsInList(base, q, {
          retirementOnly: bucket !== "all",
        })
      : base;

    const sorted = [...filtered].sort((a, b) => b.volume - a.volume);

    const stats = {
      total: rows.length,
      retirementEligible: rows.filter((e) => e.retirementEligible).length,
      leverageExcluded: rows.filter((e) => e.isLeverageOrInverse).length,
      newCandidates: rows.filter(
        (e) => e.isNewCandidate && e.retirementEligible,
      ).length,
    };

    return {
      etfs: sorted.slice(0, limit),
      stats,
      bucket,
      q,
      fetchedAt: new Date(etfCache.at).toISOString(),
      source: "naver-etf-list" as const,
      note:
        bucket === "retirement"
          ? "레버리지·인버스·파생(2X) ETF 제외. 운영사 DC 허용 목록과 다를 수 있습니다."
          : bucket === "new"
            ? "상장일은 일봉 이력 최초일로 추정. 최근 1년 이내 우선 표시."
            : "한국거래소 상장 ETF · 네이버 금융 시세.",
    };
  });

const etfNewsCache: { at: number; data: Awaited<ReturnType<typeof fetchEtfListingNews>> | null } = {
  at: 0,
  data: null,
};
const ETF_NEWS_TTL = 180_000;

export const getEtfListingNews = createServerFn({ method: "GET" }).handler(
  async () => {
    const now = Date.now();
    if (etfNewsCache.data && now - etfNewsCache.at < ETF_NEWS_TTL) {
      return { ...etfNewsCache.data, cached: true };
    }
    const pack = await fetchEtfListingNews(48);
    etfNewsCache.data = pack;
    etfNewsCache.at = now;
    return { ...pack, cached: false };
  },
);

export const getEtfBundle = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string().min(4).max(8) }))
  .handler(async ({ data }) => {
    const code = normalizeEtfCode(data.code);
    if (!ETF_CODE_RE.test(code)) return { error: "not_found" as const };

    const [detail, holdingPack] = await Promise.all([
      fetchEtfDetail(code),
      fetchEtfHoldings(code).catch(() => ({
        holdings: [] as Awaited<
          ReturnType<typeof fetchEtfHoldings>
        >["holdings"],
        asOf: null as string | null,
        source: "공식 편입내역 없음",
        sourceKind: "none" as const,
        officialCount: 0,
        issuerUrl: null as string | null,
      })),
    ]);
    if (!detail.etf) return { error: "not_found" as const };

    const krCodes = [
      ...new Set(
        holdingPack.holdings
          .map((h) => h.code)
          .filter((c): c is string => Boolean(c)),
      ),
    ];
    const usCodes = [
      ...new Set(
        holdingPack.holdings
          .map((h) => h.reutersCode)
          .filter((c): c is string => Boolean(c) && !krCodes.includes(c!)),
      ),
    ];

    const metaByCode = Object.fromEntries(
      holdingPack.holdings
        .filter((h) => h.code)
        .map((h) => [
          h.code!,
          {
            nameKo: h.nameKo,
            nameEn: h.nameKo,
            sectorId: "electronics" as const,
            market: (h.market ?? "KOSPI") as "KOSPI" | "KOSDAQ",
          },
        ]),
    );

    const [stockQuotes, worldQuotes, usdKrw] = await Promise.all([
      krCodes.length > 0
        ? fetchRealtimeQuotes(krCodes, metaByCode).catch(() => [])
        : Promise.resolve([]),
      usCodes.length > 0
        ? fetchWorldQuotes(usCodes).catch(() => ({}))
        : Promise.resolve({} as Awaited<ReturnType<typeof fetchWorldQuotes>>),
      usCodes.length > 0 ? fetchUsdKrw().catch(() => 0) : Promise.resolve(0),
    ]);
    const qmap: Record<
      string,
      {
        price: number;
        change: number;
        changePct: number;
        volume: number;
        currency: "KRW" | "USD";
      }
    > = {};
    for (const q of stockQuotes) {
      qmap[q.code] = {
        price: q.price,
        change: q.change,
        changePct: q.changePct,
        volume: q.volume,
        currency: "KRW",
      };
    }
    for (const [rc, q] of Object.entries(worldQuotes)) {
      qmap[rc] = q;
    }

    const holdingsWithQuotes = holdingPack.holdings.map((h) => {
      const q =
        (h.code && qmap[h.code]) ||
        (h.reutersCode && qmap[h.reutersCode]) ||
        undefined;
      return {
        nameKo: h.nameKo,
        code: h.code,
        reutersCode: h.reutersCode,
        nation: h.nation,
        market: h.market,
        isin: h.isin,
        weight: h.weight,
        weightSource: h.weightSource,
        quantity: h.quantity,
        asOf: h.asOf,
        isCash: h.isCash,
        isBond: h.isBond,
        isFuture: h.isFuture,
        isOverseas: h.isOverseas,
        isKoreanEquity: h.isKoreanEquity,
        isKoreanEtf: h.isKoreanEtf,
        assetClass: h.assetClass,
        quote: q
          ? {
              price: q.price,
              change: q.change,
              changePct: q.changePct,
              volume: q.volume,
              currency: q.currency,
            }
          : null,
      };
    });
    const live = fillLiveMarketWeights(holdingsWithQuotes, usdKrw);
    const holdings = live.rows;

    const sleeveMap = new Map<EtfAssetClass, number>();
    for (const h of holdings) {
      if (h.weight == null) continue;
      if (h.weightSource !== "official" && h.weightSource !== "live") continue;
      sleeveMap.set(h.assetClass, (sleeveMap.get(h.assetClass) ?? 0) + h.weight);
    }
    const allocation = [...sleeveMap.entries()]
      .map(([id, weight]) => ({
        id,
        label: ETF_ASSET_CLASS_LABEL[id],
        weight,
      }))
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    const officialWeightSum = allocation.reduce((s, a) => s + a.weight, 0);
    const officialCount = holdings.filter((h) => h.weightSource === "official").length;
    const liveCount = holdings.filter((h) => h.weightSource === "live").length;
    const weightBasis: "official" | "live" | "none" =
      officialCount > 0 ? "official" : liveCount > 0 ? "live" : "none";
    const quotedCount = holdings.filter((h) => h.quote && h.quote.price > 0).length;

    const hasOfficialBasket = holdings.length > 0;
    const themeStocks = hasOfficialBasket
      ? []
      : detail.relatedCodes.map((c) => {
          const meta = UNIVERSE.find((u) => u.code === c);
          return {
            code: c,
            nameKo: meta?.nameKo ?? c,
            nameEn: meta?.nameEn ?? c,
            sectorId: meta?.sectorId,
            quote: null as null,
          };
        });

    const missingOfficial = holdings.filter((h) => h.weight == null).length;
    const themeNote = hasOfficialBasket
      ? weightBasis === "official"
        ? `비중은 운용사·KRX 공식 공시만 사용합니다(추정 없음). 출처: ${holdingPack.source}. 국내 시세는 KRX(네이버 중계), 해외 시세는 네이버 해외주식입니다. 채권·선물·현금은 지분 시세가 없어 ISIN·수량을 표시합니다.${
            missingOfficial
              ? ` 공식 비중이 없는 ${missingOfficial}개 종목은 — 로 둡니다.`
              : ""
          }`
        : weightBasis === "live"
          ? `공식 NAV 비중이 없어, 편입 수량 × 조회된 실시간 시세(달러는 원/달러)로 시가 비중을 냈습니다. 가격이 비거나 채권·선물이 있으면 일부만 100%로 늘리지 않습니다. 출처: ${holdingPack.source}.`
          : `출처: ${holdingPack.source}. 공식 NAV 비중도, 전 종목을 시세로 나눌 수도 없어 비중은 — 입니다. 국내 시세는 KRX(네이버 중계), 해외 시세는 네이버 해외주식입니다.`
      : "공식 편입내역을 받지 못해 테마 매핑으로 대체합니다. 비중은 표시하지 않습니다.";

    return {
      etf: detail.etf,
      issuer: detail.issuer,
      description: detail.description,
      descriptionFormatted: detail.descriptionFormatted,
      themes: detail.themes,
      themeLabels: detail.themeLabels,
      fee: detail.fee,
      nav: detail.nav,
      marketValue: detail.marketValue,
      holdings,
      holdingsAsOf: holdingPack.asOf,
      holdingsSource: holdingPack.source,
      holdingsSourceKind: holdingPack.sourceKind,
      holdingsIssuerUrl: holdingPack.issuerUrl ?? null,
      holdingsCount: holdings.length,
      officialCount,
      liveCount,
      weightBasis,
      officialWeightSum,
      quotedCount,
      krEquityCount: holdings.filter((h) => h.isKoreanEquity).length,
      allocation,
      themeStocks,
      peerEtfs: detail.relatedEtfs,
      peerNote:
        "동일 테마·밸류체인 ETF입니다. (지수 메가캡 비교 목록이 아닙니다.)",
      themeNote,
      usdKrw,
      fetchedAt: new Date().toISOString(),
    };
  });

export const getUsLinkDesk = createServerFn({ method: "GET" }).handler(
  async () => {
    const codes = US_LINKED_CODES.slice(0, 28);
    const [quotes, live] = await Promise.all([
      fetchRealtimeQuotes(codes),
      fetchUsLinkLiveFeeds(),
    ]);

    return {
      quotes,
      briefs: US_POLICY_BRIEFS,
      feeds: {
        aiRace: live.aiRace,
        policy: live.policy,
        industry: live.industry,
      },
      news: live.stockNews,
      research: live.research,
      fetchedAt: live.fetchedAt,
    };
  },
);

export const getUsOfficialPolicy = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchUsOfficialPolicy } = await import("@/server/us-official-research");
  return fetchUsOfficialPolicy();
});

export const getUsOfficialUniverse = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchUsOfficialUniverse } = await import("@/server/us-official-research");
  return fetchUsOfficialUniverse();
});

export const getUsOfficialCompany = createServerFn({ method: "GET" })
  .validator(z.object({ symbol: z.string().trim().min(1).max(12) }))
  .handler(async ({ data }) => {
    const { fetchUsOfficialCompany } = await import("@/server/us-official-research");
    return fetchUsOfficialCompany(data.symbol);
  });

export const getUsOfficialReport = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().trim().min(3).max(180) }))
  .handler(async ({ data }) => {
    const { fetchUsOfficialReport } = await import("@/server/us-official-research");
    return fetchUsOfficialReport(data.id);
  });


// ── KR research v2 (F2) ────────────────────────────────────────────────
const V2_TYPES = ["market", "company", "industry", "invest", "economy", "debenture"] as const;

export const getResearchV2 = createServerFn({ method: "GET" })
  .validator(
    z.object({
      type: z.enum(V2_TYPES),
      index: z.number().int().min(0).max(200).default(0),
      size: z.number().int().min(1).max(50).default(20),
      itemCodes: z.array(z.string().regex(/^[0-9A-Z]{6}$/)).max(10).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { fetchResearchV2List } = await import("@/server/research-v2");
    return fetchResearchV2List({ type: data.type, index: data.index, size: data.size, itemCodes: data.itemCodes });
  });

export const getResearchV2Detail = createServerFn({ method: "GET" })
  .validator(
    z.object({
      type: z.enum(V2_TYPES),
      nid: z.number().int().positive(),
      itemCode: z.string().regex(/^[0-9A-Z]{6}$/).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { fetchResearchV2Detail } = await import("@/server/research-v2");
    return fetchResearchV2Detail(data.type, data.nid, data.itemCode);
  });

export const resolveResearchOriginal = createServerFn({ method: "GET" })
  .validator(z.object({ type: z.enum(V2_TYPES), nid: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const { resolveResearchOriginal: resolve } = await import("@/server/research-v2");
    return resolve(data.type, data.nid);
  });

export const getResearchBriefing = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchResearchBriefing } = await import("@/server/research-v2");
  return fetchResearchBriefing();
});
