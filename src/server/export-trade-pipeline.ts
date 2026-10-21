import { fetchCustomsTrade } from "./customs-trade.ts";
import { fetchFredTrade } from "./export-fred.ts";
import { fetchComtradeTrade } from "./export-comtrade.ts";
import type { FredPoint } from "../lib/export-desk/parse-fred.ts";
import type { TradeObservation } from "../lib/export-desk/parse-import.ts";
import type { DestinationRow } from "../lib/export-desk/destinations.ts";
import type { ExportProviderStatus } from "../lib/export-desk/provider-status.ts";

export interface LiveTradeBundle {
  exports: FredPoint[];
  imports: FredPoint[];
  observations: TradeObservation[];
  destinations: { period: string; rows: DestinationRow[]; source: string };
  news: { title: string; url: string; publishedAt?: string; source?: string }[];
  comtradeLatestPeriod: string | null;
  comtradeMonthsCached: number;
  source: { totals: string; items: string; fetchedAt: string };
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
interface Dependencies {
  customs?: typeof fetchCustomsTrade;
  fred?: typeof fetchFredTrade;
  comtrade?: typeof fetchComtradeTrade;
  hasCustomsKey?: () => boolean;
  now?: () => Date;
}
/** Select whole provider datasets: SA, NSA, customs and preview rows are never stitched by month. */
export function createTradePipeline(dependencies: Dependencies = {}) {
  const customs = dependencies.customs ?? fetchCustomsTrade;
  const fred = dependencies.fred ?? fetchFredTrade;
  const comtrade = dependencies.comtrade ?? fetchComtradeTrade;
  const now = dependencies.now ?? (() => new Date());
  const hasCustomsKey =
    dependencies.hasCustomsKey ??
    (() =>
      Boolean(
        process.env.CUSTOMS_API_KEY?.trim() ||
        process.env.KCS_API_KEY?.trim() ||
        process.env.DATA_GO_KR_SERVICE_KEY?.trim(),
      ));
  async function snapshot(): Promise<LiveTradeBundle> {
    // Key-free providers run independently, so a failed FRED request cannot
    // suppress available UN records or the separate KOSPI macro request.
    const fallback = hasCustomsKey() ? null : comtrade({ months: 36 });
    const [official, historical] = await Promise.all([customs({ months: 120 }), fred()]);
    const un = fallback
      ? await fallback
      : official.exports.length
        ? null
        : await comtrade({ months: 36 });
    let exports: FredPoint[], imports: FredPoint[], totalsSource: string;
    if (official.exports.length) {
      exports = official.exports;
      imports = official.imports;
      totalsSource = "관세청 공식 OpenAPI · 수출 FOB / 수입 CIF · 월별 명목 USD · 비계절조정";
    } else if (historical.exports.length) {
      exports = historical.exports;
      imports = historical.imports;
      totalsSource = historical.source;
    } else {
      exports = un?.exports ?? [];
      imports = un?.imports ?? [];
      totalsSource = exports.length
        ? "UN Comtrade · 한국/전세계 · HS TOTAL · 월별 명목 USD · 비계절조정"
        : "공식 총수출 원자료 미확보";
    }
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
      },
      providers: normalizeProviders([
        ...official.providers,
        ...historical.providers,
        ...(un?.providers ?? []),
      ]),
      notes: [
        "조회 시각과 통계 기준월은 다릅니다. 한국 시간으로 완료된 월만 표시하며 미공표 월·조회 실패를 0으로 채우지 않습니다.",
        "관세청을 우선 적용하며 총계는 한 제공처의 일관된 시계열을 사용합니다. 계절조정 여부와 단위가 다른 자료를 월별로 섞지 않습니다.",
        "HS 품목은 산업부 MTI 속보와 정의가 다릅니다. 모든 구성 HS 코드가 확보된 월만 품목 묶음을 집계하며, 중첩된 품목 묶음을 전체 수출로 합산하지 않습니다.",
        "품목 이력은 선택할 때 조회합니다. UN 공개 API의 공표 시차·요청 제한·부분 응답은 연결 상태에 표시합니다.",
        "기업 수출 노출도와 과거 시가총액 구성은 공시 근거가 있어야 검증됩니다. 단순 품목 통계로 기업별 선적이나 과거 구성원을 추정하지 않습니다.",
      ],
    };
  }
  async function category(
    categoryId: string,
  ): Promise<{ observations: TradeObservation[]; providers: ExportProviderStatus[] }> {
    const official = await customs({ months: 36, categoryId });
    if (official.observations.length)
      return {
        observations: official.observations,
        providers: normalizeProviders(official.providers),
      };
    const un = await comtrade({ months: 36, categoryId });
    return {
      observations: un.observations,
      providers: normalizeProviders([...official.providers, ...un.providers]),
    };
  }
  return { fetchLiveTradeSnapshot: snapshot, fetchTradeCategorySnapshot: category };
}
const pipeline = createTradePipeline();
export const fetchLiveTradeSnapshot = pipeline.fetchLiveTradeSnapshot;
export const fetchTradeCategorySnapshot = pipeline.fetchTradeCategorySnapshot;
