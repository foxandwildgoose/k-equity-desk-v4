import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CORE20_HS_PROXY } from "./hs-map";
import type { CategoryCatalog } from "./category-catalog";
import {
  getExportTradeNews,
  getLiveTradeBundle,
  getTradeCategorySeries,
  getTradeCategoryCatalog,
  getMotieRelease,
} from "@/server/export-live";

export function useLiveTrade() {
  return useQuery({
    queryKey: ["export-live-trade"],
    queryFn: () => getLiveTradeBundle(),
    staleTime: 30 * 60_000,
    retry: 1,
    retryDelay: 1500,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // A cold worker that lost the shared refresh lease waits for its peer's
    // result instead of caching an empty in-progress response for 30 minutes.
    refetchInterval: (query) =>
      query.state.data?.exports.length === 0 &&
      query.state.data.providers.some((p) => p.reasonCode === "REFRESH_IN_PROGRESS")
        ? 5_000
        : false,
  });
}

/** Fetch history only for the actively selected category, never twenty parallel series. */
export function useTradeCategory(categoryId?: string) {
  return useQuery({
    queryKey: ["export-category", categoryId ?? ""],
    queryFn: () => getTradeCategorySeries({ data: { categoryId: categoryId! } }),
    enabled: Boolean(
      categoryId &&
      (CORE20_HS_PROXY.some((p) => p.key === categoryId) ||
        /^hs2:\d{2}$|^hs4:\d{4}$/.test(categoryId)),
    ),
    staleTime: 30 * 60_000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      query.state.data?.observations.length === 0 &&
      query.state.data.providers.some((p) => p.reasonCode === "REFRESH_IN_PROGRESS")
        ? 5_000
        : false,
  });
}

/** One shared catalog request hydrates every card without per-card origin queries. */
export function useTradeCategoryCatalog() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["export-category-catalog"],
    queryFn: () => {
      const refresh = Boolean(
        client.getQueryData<CategoryCatalog>(["export-category-catalog"])?.pending.length,
      );
      return getTradeCategoryCatalog({
        data: {
          // Show shared saved summaries first; only subsequent polls warm the
          // bounded server queue. Summaries never populate history query keys.
          refresh,
        },
      });
    },
    staleTime: 60_000,
    retry: 1,
    retryDelay: 1500,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Ten two-category rounds cover the reference list. The extra rounds allow
    // for a peer's active refresh and the store's bounded PostgreSQL reconnect.
    // A cold database can temporarily return memory-only results; settling the
    // origin queue must not hide durable saved values after it reconnects.
    refetchInterval: (query) =>
      (query.state.data?.pending.length || query.state.data?.storage === "memory") &&
      !query.state.error && query.state.dataUpdateCount < 12
        ? 5_000
        : false,
  });
  return {
    ...query,
    warmingPaused: Boolean(
      query.data?.pending.length &&
      (client.getQueryState(["export-category-catalog"])?.dataUpdateCount ?? 0) >= 12,
    ),
  };
}

/** Official monthly release acquisition has its own state and cannot delay HS cards. */
export function useMotieRelease() {
  return useQuery({
    queryKey: ["export-motie-release"],
    queryFn: () => getMotieRelease(),
    staleTime: 30 * 60_000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useTradeNews() {
  return useQuery({
    queryKey: ["export-trade-news"],
    queryFn: () => getExportTradeNews(),
    staleTime: 30 * 60_000,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}
