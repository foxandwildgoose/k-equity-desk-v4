import { useQuery } from "@tanstack/react-query";
import { CORE20_HS_PROXY } from "./hs-map";
import {
  getExportTradeNews,
  getLiveTradeBundle,
  getTradeCategorySeries,
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
