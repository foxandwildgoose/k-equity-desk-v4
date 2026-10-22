import {
  getExportTradeStore,
  isVerifiedTradeBundle,
  isVerifiedTradeCategory,
  staleTradeBundle,
  staleTradeCategory,
  verifiedTradeSupplements,
  type CachedTrade,
  type ExportTradeStore,
  type TradeCategorySnapshot,
} from "./export-trade-store.ts";
import type { LiveTradeBundle } from "./export-trade-pipeline.ts";
import type { ExportProviderStatus } from "../lib/export-desk/provider-status.ts";

interface Dependencies {
  revision?: string;
  loadBundle: () => Promise<LiveTradeBundle>;
  loadCategory: (id: string) => Promise<TradeCategorySnapshot>;
  store?: ExportTradeStore | (() => Promise<ExportTradeStore>);
  now?: () => Date;
}
const failures = new Set([
  "empty",
  "missing-key",
  "invalid-key",
  "rate-limited",
  "unavailable",
  "unverified",
]);

function cacheProvider(
  store: ExportTradeStore,
  now: Date,
  state: ExportProviderStatus["state"],
  asOf: string | null,
  count: number,
  reasonCode: string,
  detail: string,
): ExportProviderStatus {
  return {
    id: "trade.cache",
    name: "공식 수출통계 저장본",
    configured: true,
    state,
    asOf,
    recordCount: count,
    checkedAt: now.toISOString(),
    reasonCode,
    sourceUrl: "https://k-equity-desk-v4.vercel.app/export-desk",
    message: `저장소: ${store.storage}. ${store.storage === "postgres" ? "서버 간 영속 저장·중복 조회 조정을 적용합니다." : "현재 서버 메모리만 사용하며 서버 재시작 후 보존은 보장되지 않습니다."} ${detail}`,
  };
}
function withProvider<T extends { providers: ExportProviderStatus[] }>(
  value: T,
  provider: ExportProviderStatus,
): T {
  return {
    ...value,
    providers: [...value.providers.filter((p) => p.id !== "trade.cache"), provider],
  };
}
function mergeFailures(
  cached: ExportProviderStatus[],
  current: ExportProviderStatus[] = [],
): ExportProviderStatus[] {
  const result = [...cached];
  for (const provider of current.filter((p) => p.id !== "trade.cache")) {
    const index = result.findIndex((p) => p.id === provider.id);
    if (index < 0) result.push(provider);
    else if (failures.has(provider.state) && result[index]!.recordCount > 0) {
      // Retain the selected dataset's original provider identity/reference month,
      // while exposing today's failed recheck as a separate diagnostic record.
      result.push({ ...provider, id: `${provider.id}.refresh`, name: `${provider.name} 재조회` });
    } else if (result[index]!.recordCount === 0) result[index] = provider;
  }
  return result;
}
function emptyBundle(provider: ExportProviderStatus): LiveTradeBundle {
  return {
    exports: [],
    imports: [],
    observations: [],
    destinations: { period: "", rows: [], source: "자료 미확보" },
    news: [],
    comtradeLatestPeriod: null,
    comtradeMonthsCached: 0,
    providers: [provider],
    notes: [provider.message],
    source: {
      totals: "공식 총수출 원자료 미확보",
      items: "품목 자료 미확보",
      fetchedAt: provider.checkedAt,
    },
  };
}

/** Cached public statistics are separate from origin fetches and private credentials. */
export function createCachedTradePipeline(dependencies: Dependencies) {
  const now = dependencies.now ?? (() => new Date());
  const getStore =
    typeof dependencies.store === "function"
      ? dependencies.store
      : dependencies.store
        ? async () => dependencies.store as ExportTradeStore
        : getExportTradeStore;
  let bundleFlight: Promise<LiveTradeBundle> | null = null;
  const categoryFlights = new Map<string, Promise<TradeCategorySnapshot>>();

  function storedBundle(
    entry: CachedTrade<LiveTradeBundle>,
    store: ExportTradeStore,
    current?: LiveTradeBundle,
  ): LiveTradeBundle {
    const value = staleTradeBundle(entry);
    value.providers = mergeFailures(value.providers, current?.providers);
    return withProvider(
      value,
      cacheProvider(
        store,
        now(),
        "stale",
        value.exports.at(-1)?.period ?? null,
        value.exports.length,
        "VERIFIED_CACHE",
        `${entry.verifiedAt} 검증본을 표시합니다. 현재 조회 실패나 불완전한 응답으로 저장본을 지우지 않습니다.`,
      ),
    );
  }
  function storedCategory(
    entry: CachedTrade<TradeCategorySnapshot>,
    store: ExportTradeStore,
    current?: TradeCategorySnapshot,
  ): TradeCategorySnapshot {
    const value = staleTradeCategory(entry);
    value.providers = mergeFailures(value.providers, current?.providers);
    return withProvider(
      value,
      cacheProvider(
        store,
        now(),
        "stale",
        value.observations.at(-1)?.period ?? null,
        value.observations.length,
        "VERIFIED_CACHE",
        `${entry.verifiedAt} 품목 검증본을 표시합니다. 통계 기준월은 유지합니다.`,
      ),
    );
  }
  async function bundle(): Promise<LiveTradeBundle> {
    const store = await getStore();
    const saved = await store.readBundle();
    if (
      saved &&
      !saved.stale &&
      (!dependencies.revision || saved.value.source.pipelineRevision === dependencies.revision)
    )
      return withProvider(
        saved.value,
        cacheProvider(
          store,
          now(),
          "ok",
          saved.value.exports.at(-1)?.period ?? null,
          saved.value.exports.length,
          "CACHE_HIT",
          `${saved.verifiedAt} 저장 검증본을 재사용합니다.`,
        ),
      );
    const owner = await store.acquireRefresh("trade:bundle", 45_000);
    if (!owner)
      return saved
        ? storedBundle(saved, store)
        : emptyBundle(
            cacheProvider(
              store,
              now(),
              "partial",
              null,
              0,
              "REFRESH_IN_PROGRESS",
              "다른 요청이 공식 자료를 수집하고 있습니다. 완료 후 다시 확인하며 빈 값을 0으로 만들지 않습니다.",
            ),
          );
    try {
      let candidate: LiveTradeBundle | undefined;
      try {
        candidate = await dependencies.loadBundle();
      } catch {
        /* Safe diagnostics below; never expose upstream exception text. */
      }
      if (candidate && isVerifiedTradeBundle(candidate, now(), { allowStale: true })) {
        const latest = candidate.exports.at(-1)!.period;
        const previous = saved?.value.exports.at(-1)?.period;
        if (previous && latest < previous) return storedBundle(saved!, store, candidate);
        const canSave = isVerifiedTradeBundle(candidate, now());
        if (saved && !canSave && latest <= previous!) return storedBundle(saved, store, candidate);
        const accepted =
          canSave &&
          (await store.saveBundle({
            ...candidate,
            providers: candidate.providers.filter((p) => p.id !== "trade.cache"),
          }));
        return withProvider(
          candidate,
          cacheProvider(
            store,
            now(),
            canSave ? "ok" : "stale",
            latest,
            candidate.exports.length,
            !canSave
              ? "VERIFIED_SOURCE_STALE"
              : accepted
                ? "CACHE_UPDATED"
                : "CACHE_WRITE_UNAVAILABLE",
            !canSave
              ? "제공처의 기존 공식 검증본을 표시합니다. 재조회 실패를 새 검증 성공으로 저장하지 않습니다."
              : accepted
                ? "공식 원자료를 검증해 저장했습니다."
                : "공식 조회값을 표시하지만 저장 성공은 확인하지 못했습니다.",
          ),
        );
      }
      if (saved) return storedBundle(saved, store, candidate);
      const status = cacheProvider(
        store,
        now(),
        "unavailable",
        null,
        0,
        "NO_VERIFIED_DATA",
        "검증된 저장본과 새 공식 자료를 확보하지 못했습니다. 제공처 상태를 확인하고 다시 시도합니다.",
      );
      if (candidate)
        return {
          ...emptyBundle(status),
          ...verifiedTradeSupplements(candidate, now()),
          providers: [...(Array.isArray(candidate.providers) ? candidate.providers : []), status],
          notes: [...(Array.isArray(candidate.notes) ? candidate.notes : []), status.message],
        };
      return emptyBundle(status);
    } finally {
      await store.releaseRefresh("trade:bundle", owner);
    }
  }
  async function category(id: string): Promise<TradeCategorySnapshot> {
    const store = await getStore();
    const saved = await store.readCategory(id);
    if (
      saved &&
      !saved.stale &&
      (!dependencies.revision || saved.value.cacheRevision === dependencies.revision)
    )
      return withProvider(
        saved.value,
        cacheProvider(
          store,
          now(),
          "ok",
          saved.value.observations.at(-1)?.period ?? null,
          saved.value.observations.length,
          "CACHE_HIT",
          `${saved.verifiedAt} 품목 저장 검증본을 재사용합니다.`,
        ),
      );
    const scope = `trade:category:${id}`;
    const owner = await store.acquireRefresh(scope, 45_000);
    if (!owner)
      return saved
        ? storedCategory(saved, store)
        : {
            observations: [],
            providers: [
              cacheProvider(
                store,
                now(),
                "partial",
                null,
                0,
                "REFRESH_IN_PROGRESS",
                "다른 요청이 이 품목의 공식 자료를 수집하고 있습니다.",
              ),
            ],
          };
    try {
      let candidate: TradeCategorySnapshot | undefined;
      try {
        candidate = await dependencies.loadCategory(id);
        if (dependencies.revision)
          candidate = { ...candidate, cacheRevision: dependencies.revision };
      } catch {
        /* Preserve a previous verified dataset. */
      }
      if (candidate && isVerifiedTradeCategory(id, candidate, now(), { allowStale: true })) {
        const latest = candidate.observations.at(-1)!.period;
        const previous = saved?.value.observations.at(-1)?.period;
        if (previous && latest < previous) return storedCategory(saved!, store, candidate);
        const canSave = isVerifiedTradeCategory(id, candidate, now());
        if (saved && !canSave && latest <= previous!)
          return storedCategory(saved, store, candidate);
        const accepted =
          canSave &&
          (await store.saveCategory(id, {
            ...candidate,
            providers: candidate.providers.filter((p) => p.id !== "trade.cache"),
          }));
        return withProvider(
          candidate,
          cacheProvider(
            store,
            now(),
            canSave ? "ok" : "stale",
            latest,
            candidate.observations.length,
            !canSave
              ? "VERIFIED_SOURCE_STALE"
              : accepted
                ? "CACHE_UPDATED"
                : "CACHE_WRITE_UNAVAILABLE",
            !canSave
              ? "제공처의 기존 품목 검증본을 표시하며 재조회 실패를 새 검증 성공으로 저장하지 않습니다."
              : accepted
                ? "품목별 공식 원자료를 검증해 저장했습니다."
                : "공식 조회값을 표시하지만 저장 성공은 확인하지 못했습니다.",
          ),
        );
      }
      if (saved) return storedCategory(saved, store, candidate);
      return {
        observations: [],
        providers: [
          ...(Array.isArray(candidate?.providers) ? candidate.providers : []),
          cacheProvider(
            store,
            now(),
            "unavailable",
            null,
            0,
            "NO_VERIFIED_DATA",
            "검증된 품목 저장본과 새 공식 원자료를 확보하지 못했습니다.",
          ),
        ],
      };
    } finally {
      await store.releaseRefresh(scope, owner);
    }
  }
  return {
    fetchLiveTradeSnapshot(): Promise<LiveTradeBundle> {
      if (bundleFlight) return bundleFlight;
      bundleFlight = bundle().finally(() => {
        bundleFlight = null;
      });
      return bundleFlight;
    },
    fetchTradeCategorySnapshot(id: string): Promise<TradeCategorySnapshot> {
      const existing = categoryFlights.get(id);
      if (existing) return existing;
      const task = category(id).finally(() => {
        categoryFlights.delete(id);
      });
      categoryFlights.set(id, task);
      return task;
    },
  };
}
