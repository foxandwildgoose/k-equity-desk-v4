import { fetchCustomsTrade } from "./customs-trade.ts";
import { fetchFredTrade } from "./export-fred.ts";
import { fetchSharedComtradeTrade as fetchComtradeTrade } from "./export-comtrade-shared.ts";
import { fetchOecdTrade } from "./export-oecd.ts";
import { fetchWorldBankTrade } from "./export-worldbank.ts";
import { fetchKcsPublicTrade } from "./export-kcs-public.ts";
import { createCachedTradePipeline } from "./export-trade-cache.ts";
import type { FredPoint } from "../lib/export-desk/parse-fred.ts";
import type { TradeObservation } from "../lib/export-desk/parse-import.ts";
import type { DestinationRow } from "../lib/export-desk/destinations.ts";
import type { ExportProviderStatus } from "../lib/export-desk/provider-status.ts";

// Advance when acquisition/validation semantics change: a durable cache must
// not keep a repaired adapter's old failure status fresh after deployment.
const TRADE_PIPELINE_REVISION = `2026-10-22.6:${process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || "local"}`;

export interface LiveTradeBundle {
  exports: FredPoint[];
  imports: FredPoint[];
  observations: TradeObservation[];
  destinations: { period: string; rows: DestinationRow[]; source: string };
  news: { title: string; url: string; publishedAt?: string; source?: string }[];
  comtradeLatestPeriod: string | null;
  comtradeMonthsCached: number;
  source: {
    totals: string;
    items: string;
    fetchedAt: string;
    totalsProviderId?: string;
    pipelineRevision?: string;
  };
  notes: string[];
  providers: ExportProviderStatus[];
}
const CUSTOMS_IDS: Record<string, string> = {
  "customs-total": "customs.total",
  "customs-hs": "customs.item",
  "customs-destinations": "customs.country",
};
function normalizeProviders(providers: ExportProviderStatus[]) {
  return providers.map((p) => ({ ...p, id: CUSTOMS_IDS[p.id] ?? p.id }));
}
function consecutiveHistory(points: FredPoint[]): number {
  let count = points.length ? 1 : 0;
  const monthNumber = (period: string) => Number(period.slice(0, 4)) * 12 + Number(period.slice(5));
  for (let i = points.length - 1; i > 0; i--) {
    if (monthNumber(points[i]!.period) - monthNumber(points[i - 1]!.period) !== 1) break;
    count++;
  }
  return count;
}
interface Dependencies {
  customs?: typeof fetchCustomsTrade;
  fred?: typeof fetchFredTrade;
  comtrade?: typeof fetchComtradeTrade;
  oecd?: typeof fetchOecdTrade;
  worldbank?: typeof fetchWorldBankTrade;
  publicCustoms?: typeof fetchKcsPublicTrade;
  now?: () => Date;
}
/** Select whole provider datasets: SA, NSA, customs and preview rows are never stitched by month. */
export function createTradePipeline(dependencies: Dependencies = {}) {
  const customs = dependencies.customs ?? fetchCustomsTrade;
  const fred = dependencies.fred ?? fetchFredTrade;
  const comtrade = dependencies.comtrade ?? fetchComtradeTrade;
  const oecd = dependencies.oecd ?? fetchOecdTrade;
  const worldbank = dependencies.worldbank ?? fetchWorldBankTrade;
  const publicCustoms = dependencies.publicCustoms ?? fetchKcsPublicTrade;
  const now = dependencies.now ?? (() => new Date());
  const failed = (id: string, name: string, sourceUrl: string): ExportProviderStatus => ({
    id,
    name,
    sourceUrl,
    configured: true,
    state: "unavailable",
    checkedAt: now().toISOString(),
    asOf: null,
    recordCount: 0,
    reasonCode: "PROVIDER_REQUEST_FAILED",
    message: "공식 자료 요청을 완료하지 못했습니다. 다른 정상 제공처는 계속 사용합니다.",
  });
  const empty = {
    exports: [],
    imports: [],
    observations: [],
    destinations: { period: "", rows: [], source: "" },
  };
  const safe = async <T>(load: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await load();
    } catch {
      return fallback;
    }
  };
  async function snapshot(): Promise<LiveTradeBundle> {
    // Key-free providers run independently, so a failed FRED request cannot
    // suppress available UN records or the separate KOSPI macro request.
    // A page visit no longer makes 36 individual UN monthly requests. Direct
    // statistical datasets supply history in bulk; UN supplies recent HS tables.
    // All providers have their own deadlines and fail-closed response validation.
    const [official, direct, global, historical, un] = await Promise.all([
      safe(() => customs({ months: 120 }), {
        ...empty,
        providers: [
          failed("customs.total", "관세청", "https://www.data.go.kr/data/15102108/openapi.do"),
        ],
      }),
      safe(() => oecd(), {
        ...empty,
        source: "OECD",
        providers: [failed("oecd.exports", "OECD", "https://data-explorer.oecd.org/")],
      }),
      safe(() => worldbank(), {
        ...empty,
        source: "World Bank GEM",
        providers: [
          failed(
            "worldbank-exports",
            "World Bank GEM",
            "https://databank.worldbank.org/source/global-economic-monitor-(gem)",
          ),
        ],
      }),
      safe(() => fred(), {
        ...empty,
        source: "FRED/OECD",
        providers: [failed("fred.exports", "FRED/OECD", "https://fred.stlouisfed.org/")],
      }),
      safe(() => comtrade({ months: 4 }), {
        ...empty,
        latestPeriod: null,
        monthsCached: 0,
        providers: [failed("comtrade.total", "UN Comtrade", "https://comtradeplus.un.org/")],
      }),
    ]);
    const candidates = [
      {
        ...official,
        providerId: "customs.total",
        source: "관세청 공식 OpenAPI · 수출 FOB / 수입 CIF · 월별 명목 USD · 비계절조정",
      },
      { ...direct, providerId: "oecd.exports" },
      { ...global, providerId: "worldbank-exports" },
      { ...historical, providerId: "fred.exports" },
      {
        ...un,
        providerId: "comtrade.total",
        source: "UN Comtrade · 한국/전세계 · HS TOTAL · 월별 명목 USD · 비계절조정",
      },
    ].filter((candidate) => candidate.exports.length);
    // A discontinued older FRED series must never hide newer verified official
    // publications. Select one complete dataset, newest as-of first, preserving
    // issuer priority for ties; never stitch definitions, scales, SA/NSA or flows.
    candidates.sort(
      (a, b) =>
        b.exports.at(-1)!.period.localeCompare(a.exports.at(-1)!.period) ||
        Number(consecutiveHistory(b.exports) >= 24) - Number(consecutiveHistory(a.exports) >= 24),
    );
    const selected = candidates[0];
    const exports = selected?.exports ?? [],
      imports = selected?.imports ?? [];
    const totalsSource = selected?.source ?? "공식 총수출 원자료 미확보";
    const totalRows: TradeObservation[] = exports.map((p) => ({
      ...p,
      categoryId: "TOTAL",
      categoryName: "대한민국 총수출",
      classification: "TOTAL",
      geo: "KR",
      vintage: totalsSource,
      sourceFile: totalsSource,
    }));
    const items = official.observations.length ? official.observations : (un?.observations ?? []);
    const destinations = official.destinations.rows.length
      ? official.destinations
      : (un?.destinations ?? official.destinations);
    return {
      exports,
      imports,
      observations: [...totalRows, ...items],
      destinations,
      news: [],
      comtradeLatestPeriod: un?.latestPeriod ?? null,
      comtradeMonthsCached: un?.monthsCached ?? 0,
      source: {
        totals: totalsSource,
        items: official.observations.length
          ? "관세청 품목별 공식 HS 수출"
          : un?.observations.length
            ? "UN Comtrade · 한국/전세계 · HS · 명목 USD"
            : "품목 선택 시 공식 HS 이력 조회",
        fetchedAt: now().toISOString(),
        pipelineRevision: TRADE_PIPELINE_REVISION,
        ...(selected ? { totalsProviderId: selected.providerId } : {}),
      },
      providers: normalizeProviders([
        ...official.providers,
        ...direct.providers,
        ...global.providers,
        ...historical.providers,
        ...(un?.providers ?? []),
      ]),
      notes: [
        "조회 시각과 통계 기준월은 다릅니다. 한국 시간으로 완료된 월만 표시하며 미공표 월·조회 실패를 0으로 채우지 않습니다.",
        "검증된 제공처 중 최신 공표 월의 시계열 하나를 선택합니다. 같은 기준월에는 분석에 필요한 연속 24개월 확보 여부를 확인한 뒤 관세청·OECD·World Bank 순으로 우선합니다. 계절조정 여부와 단위가 다른 자료를 월별로 섞지 않습니다.",
        "HS 품목은 산업부 MTI 속보와 정의가 다릅니다. 모든 구성 HS 코드가 확보된 월만 품목 묶음을 집계하며, 중첩된 품목 묶음을 전체 수출로 합산하지 않습니다.",
        "품목 이력은 선택할 때 조회합니다. UN 공개 API의 공표 시차·요청 제한·부분 응답은 연결 상태에 표시합니다.",
        "기업 수출 노출도와 과거 시가총액 구성은 공시 근거가 있어야 검증됩니다. 단순 품목 통계로 기업별 선적이나 과거 구성원을 추정하지 않습니다.",
      ],
    };
  }
  async function category(
    categoryId: string,
  ): Promise<{ observations: TradeObservation[]; providers: ExportProviderStatus[] }> {
    const official = await safe(() => customs({ months: 36, categoryId }), {
      ...empty,
      providers: [
        failed(
          "customs.item",
          "관세청 품목별 수출",
          "https://www.data.go.kr/data/15101609/openapi.do",
        ),
      ],
    });
    if (official.observations.length)
      return {
        observations: official.observations,
        providers: normalizeProviders(official.providers),
      };
    const publicResult = await safe(() => publicCustoms({ months: 36, categoryId }), {
      observations: [],
      source: "관세청 공개 웹통계",
      providers: [
        failed(
          "customs.public-item",
          "관세청 공개 웹통계 HS4",
          "https://tradedata.go.kr/cts/index.do",
        ),
      ],
    });
    if (publicResult.observations.length)
      return {
        observations: publicResult.observations,
        providers: normalizeProviders([...official.providers, ...publicResult.providers]),
      };
    const un = await safe(() => comtrade({ months: 36, categoryId }), {
      ...empty,
      latestPeriod: null,
      monthsCached: 0,
      providers: [
        failed(
          `comtrade.hs.${categoryId}`,
          "UN Comtrade 품목별 수출",
          "https://comtradeplus.un.org/",
        ),
      ],
    });
    return {
      observations: un.observations,
      providers: normalizeProviders([
        ...official.providers,
        ...publicResult.providers,
        ...un.providers,
      ]),
    };
  }
  return { fetchLiveTradeSnapshot: snapshot, fetchTradeCategorySnapshot: category };
}
const origin = createTradePipeline();
const pipeline = createCachedTradePipeline({
  revision: TRADE_PIPELINE_REVISION,
  loadBundle: origin.fetchLiveTradeSnapshot,
  loadCategory: origin.fetchTradeCategorySnapshot,
});
export const fetchLiveTradeSnapshot = pipeline.fetchLiveTradeSnapshot;
export const fetchTradeCategorySnapshot = pipeline.fetchTradeCategorySnapshot;
