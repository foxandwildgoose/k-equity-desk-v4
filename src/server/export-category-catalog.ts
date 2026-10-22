import { CORE20_HS_PROXY } from "../lib/export-desk/hs-map.ts";
import type { CategoryCatalog, CategoryCatalogItem } from "../lib/export-desk/category-catalog.ts";
import type { ExportProviderStatus } from "../lib/export-desk/provider-status.ts";
import type { TradeObservation } from "../lib/export-desk/parse-import.ts";
import { fetchTradeCategorySnapshot } from "./export-trade-pipeline.ts";
import {
  getExportTradeStore,
  isVerifiedTradeCategory,
  staleTradeCategory,
  type CachedTrade,
  type ExportTradeStore,
  type TradeCategorySnapshot,
} from "./export-trade-store.ts";

interface CatalogCategory {
  id: string;
  label: string;
}
interface Dependencies {
  store?: ExportTradeStore | (() => Promise<ExportTradeStore>);
  loadCategory?: (id: string) => Promise<TradeCategorySnapshot>;
  categories?: CatalogCategory[];
  now?: () => Date;
}

// The bound applies to category loaders. Each loader may validate several HS
// constituents, with its own bounded HTTP budget and shared provider admission.
const MAX_WARM = 2;
const FAILED_RETRY_MS = 5 * 60_000;
const STALE_RETRY_MS = 60_000;
const WORKER_SCOPE = "trade:catalog:worker";
const categoryScope = (id: string) => `trade:catalog:category:${id}`;
const defaults = CORE20_HS_PROXY.map((proxy) => ({ id: proxy.key, label: proxy.label }));

function candidateProviders(value: TradeCategorySnapshot | undefined): ExportProviderStatus[] {
  return Array.isArray(value?.providers)
    ? value.providers.filter(
        (provider) =>
          provider &&
          typeof provider.id === "string" &&
          typeof provider.message === "string" &&
          typeof provider.state === "string" &&
          typeof provider.checkedAt === "string" &&
          typeof provider.recordCount === "number" &&
          typeof provider.sourceUrl === "string",
      )
    : [];
}
function failureRetry(providers: ExportProviderStatus[], now: Date): number {
  return Math.min(
    86_400_000,
    Math.max(
      FAILED_RETRY_MS,
      ...providers.map((provider) => {
        const delay = provider.retryAt ? Date.parse(provider.retryAt) - now.getTime() : 0;
        return Number.isFinite(delay) ? delay : 0;
      }),
    ),
  );
}

function nationalSnapshot(id: string, value: TradeCategorySnapshot, now: Date): boolean {
  return (
    isVerifiedTradeCategory(id, value, now, { allowStale: true }) &&
    value.observations.every(
      (row) =>
        row.classification !== "TOTAL" &&
        (!row.geo?.trim() ||
          /^(?:national|kr|kor|korea|republic of korea|대한민국|한국|전국|전체|총계)$/i.test(
            row.geo.trim(),
          )),
    )
  );
}

function priorYear(period: string): string {
  return `${String(Number(period.slice(0, 4)) - 1).padStart(4, "0")}${period.slice(4)}`;
}
function sameDataset(a: TradeObservation, b: TradeObservation): boolean {
  return (
    a.categoryId === b.categoryId &&
    a.classification === b.classification &&
    (a.geo ?? "") === (b.geo ?? "") &&
    a.sourceFile === b.sourceFile &&
    (a.vintage ?? "") === (b.vintage ?? "")
  );
}
function summary(
  category: CatalogCategory,
  snapshot: TradeCategorySnapshot,
  metadata: { stale: boolean; verifiedAt: string | null; freshUntil: string | null },
  retryAt: string | null,
): CategoryCatalogItem {
  const current = snapshot.observations.at(-1)!;
  const rows = snapshot.observations.filter((row) => sameDataset(row, current));
  const previous = rows.find((row) => row.period === priorYear(current.period));
  const ratio =
    previous && previous.valueUsd > 0 ? (current.valueUsd / previous.valueUsd - 1) * 100 : null;
  return {
    id: category.id,
    label: category.label,
    current: { period: current.period, valueUsd: current.valueUsd },
    previousYoY: previous ? { period: previous.period, valueUsd: previous.valueUsd } : null,
    yoyPct: ratio != null && Number.isFinite(ratio) ? ratio : null,
    state:
      metadata.stale ||
      snapshot.providers.some((provider) => provider.recordCount > 0 && provider.state === "stale")
        ? "stale"
        : "ok",
    count: rows.length,
    source: current.sourceFile,
    classification: current.classification === "TOTAL" ? null : current.classification,
    providers: snapshot.providers,
    verifiedAt: metadata.verifiedAt,
    freshUntil: metadata.freshUntil,
    retryAt,
  };
}
function savedSummary(
  category: CatalogCategory,
  entry: CachedTrade<TradeCategorySnapshot>,
  retryAt: string | null,
): CategoryCatalogItem {
  return summary(category, entry.stale ? staleTradeCategory(entry) : entry.value, entry, retryAt);
}
function controlProvider(now: Date, retryAt: string | null, failed = false): ExportProviderStatus {
  return {
    id: "trade.catalog",
    name: "품목 자동 조회",
    configured: true,
    state: failed ? "unavailable" : "partial",
    checkedAt: now.toISOString(),
    asOf: null,
    recordCount: 0,
    sourceUrl: "https://k-equity-desk-v4.vercel.app/export-desk",
    reasonCode: failed ? "RECENT_REFRESH_UNAVAILABLE" : "CATALOG_QUEUED",
    ...(retryAt ? { retryAt } : {}),
    message: failed
      ? "최근 자동 조회에서 검증된 품목 자료를 확보하지 못했습니다. 재시도 시각까지 중복 요청을 제한하며, 품목을 선택하면 해당 제공처의 상세 상태를 확인할 수 있습니다."
      : "공식 품목 자료의 자동 조회 순서를 기다리고 있습니다. 미조회 자료를 0으로 표시하지 않습니다.",
  };
}
function emptySummary(
  category: CatalogCategory,
  now: Date,
  retryAt: string | null,
): CategoryCatalogItem {
  return {
    id: category.id,
    label: category.label,
    current: null,
    previousYoY: null,
    yoyPct: null,
    state: retryAt ? "unavailable" : "pending",
    count: 0,
    source: null,
    classification: null,
    providers: [controlProvider(now, retryAt, Boolean(retryAt))],
    verifiedAt: null,
    freshUntil: null,
    retryAt,
  };
}

/** Shared cache summaries never enter the analytical monthly history query. */
export function createTradeCategoryCatalog(dependencies: Dependencies = {}) {
  const now = dependencies.now ?? (() => new Date());
  const load = dependencies.loadCategory ?? fetchTradeCategorySnapshot;
  const getStore =
    typeof dependencies.store === "function"
      ? dependencies.store
      : dependencies.store
        ? async () => dependencies.store as ExportTradeStore
        : getExportTradeStore;
  const categories = [
    ...new Map(
      (dependencies.categories ?? defaults).map((category) => [category.id, category]),
    ).values(),
  ];
  if (
    categories.length > 20 ||
    categories.some((category) => !CORE20_HS_PROXY.some((proxy) => proxy.key === category.id))
  )
    throw new Error("Only the bounded reference category catalog is supported.");

  return async function catalog(options: { refresh?: boolean } = {}): Promise<CategoryCatalog> {
    const store = await getStore();
    const ids = categories.map((category) => category.id);
    const saved = await store.readCategories(ids);
    for (const id of ids)
      if (saved[id] && !nationalSnapshot(id, saved[id]!.value, now())) delete saved[id];
    const cooldowns = await store.retryAts(ids.map(categoryScope), true);
    const items = new Map(
      categories.map((category) => {
        const retryAt = cooldowns[categoryScope(category.id)] ?? null;
        const entry = saved[category.id];
        return [
          category.id,
          entry ? savedSummary(category, entry, retryAt) : emptySummary(category, now(), retryAt),
        ];
      }),
    );
    const attempted: string[] = [],
      refreshed: string[] = [];
    let candidates = categories.filter(
      (category) =>
        (!saved[category.id] || saved[category.id]!.stale) &&
        !cooldowns[categoryScope(category.id)],
    );
    // Established public HS4 retrievals get an early slot when the cache is
    // completely cold. All other categories advance as failures cool down.
    candidates = candidates.sort((a, b) => {
      const supported = (id: string) =>
        CORE20_HS_PROXY.find((proxy) => proxy.key === id)?.codes.every((code) => code.length === 4)
          ? 1
          : 0;
      return supported(b.id) - supported(a.id);
    });
    const pending = new Set(candidates.map((category) => category.id));
    if (options.refresh && candidates.length) {
      const owner = await store.acquireRefresh(WORKER_SCOPE, 60_000);
      if (owner) {
        try {
          const selected = candidates.slice(0, MAX_WARM);
          await Promise.all(
            selected.map(async (category) => {
              attempted.push(category.id);
              pending.delete(category.id);
              let candidate: TradeCategorySnapshot | undefined;
              try {
                candidate = await load(category.id);
              } catch {
                /* Never expose exception/credential text. */
              }
              const providers = candidateProviders(candidate);
              const previous = saved[category.id];
              if (candidate && nationalSnapshot(category.id, candidate, now())) {
                const regresses =
                  previous &&
                  candidate.observations.at(-1)!.period <
                    previous.value.observations.at(-1)!.period;
                if (regresses) {
                  await store.setCooldown(
                    categoryScope(category.id),
                    failureRetry(providers, now()),
                  );
                  const retryAt = await store.retryAt(categoryScope(category.id), true);
                  items.set(
                    category.id,
                    savedSummary(category, { ...previous, stale: true }, retryAt),
                  );
                } else {
                  const stale = candidate.providers.some(
                    (provider) => provider.recordCount > 0 && provider.state === "stale",
                  );
                  if (stale) await store.setCooldown(categoryScope(category.id), STALE_RETRY_MS);
                  const retryAt = stale
                    ? await store.retryAt(categoryScope(category.id), true)
                    : null;
                  const source = candidate.providers.find(
                    (provider) =>
                      [
                        "customs.item",
                        "customs-hs",
                        "customs.public-item",
                        `comtrade.hs.${category.id}`,
                      ].includes(provider.id) &&
                      provider.recordCount > 0 &&
                      provider.asOf === candidate!.observations.at(-1)!.period,
                  );
                  items.set(
                    category.id,
                    summary(
                      category,
                      candidate,
                      {
                        stale,
                        verifiedAt: stale
                          ? (previous?.verifiedAt ?? null)
                          : (source?.checkedAt ?? null),
                        freshUntil: null,
                      },
                      retryAt,
                    ),
                  );
                  refreshed.push(category.id);
                }
              } else if (
                providers.some((provider) => provider.reasonCode === "REFRESH_IN_PROGRESS")
              ) {
                pending.add(category.id);
                if (!previous)
                  items.set(category.id, { ...emptySummary(category, now(), null), providers });
              } else {
                await store.setCooldown(categoryScope(category.id), failureRetry(providers, now()));
                const retryAt = await store.retryAt(categoryScope(category.id), true);
                if (previous)
                  items.set(category.id, {
                    ...savedSummary(category, { ...previous, stale: true }, retryAt),
                    providers: [...staleTradeCategory(previous).providers, ...providers],
                  });
                else
                  items.set(category.id, {
                    ...emptySummary(category, now(), retryAt),
                    state: "unavailable",
                    providers: providers.length
                      ? providers
                      : [controlProvider(now(), retryAt, true)],
                  });
              }
            }),
          );
          const stored = await store.readCategories(selected.map((category) => category.id));
          for (const category of selected) {
            const entry = stored[category.id],
              current = items.get(category.id)!;
            if (
              entry &&
              current.current &&
              entry.value.observations.at(-1)!.period >= current.current.period &&
              current.state !== "stale"
            )
              items.set(category.id, savedSummary(category, entry, current.retryAt));
          }
        } finally {
          await store.releaseRefresh(WORKER_SCOPE, owner);
        }
      }
    }
    const rows = categories.map((category) => items.get(category.id)!);
    return {
      items: rows,
      pending: rows.filter((row) => pending.has(row.id)).map((row) => row.id),
      attempted,
      refreshed,
      storage: store.storage,
      fetchedAt: now().toISOString(),
    };
  };
}

export const fetchTradeCategoryCatalog = createTradeCategoryCatalog();
