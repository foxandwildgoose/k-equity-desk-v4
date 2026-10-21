import { useQuery } from "@tanstack/react-query";
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
    enabled: Boolean(categoryId && categoryId !== "TOTAL"),
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
