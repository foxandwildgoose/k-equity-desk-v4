import { useQuery } from "@tanstack/react-query";
import { getExportMacro, getKospiCapQuotes, getIndustryMonthlyPrices } from "@/server/export-desk";

export function useExportMacro() {
  return useQuery({
    queryKey: ["export-macro"],
    queryFn: () => getExportMacro(),
    staleTime: 30 * 60_000,
    retry: 1,
    retryDelay: 1500,
    refetchOnWindowFocus: false,
  });
}

export function useKospiCapQuotes() {
  return useQuery({
    queryKey: ["export-kospi-caps"],
    queryFn: () => getKospiCapQuotes(),
    staleTime: 60_000,
    retry: 1,
    retryDelay: 1500,
    refetchOnWindowFocus: false,
  });
}

export function useIndustryMonthlyPrices(tickers: string[]) {
  const key = [...tickers].sort().join(",");
  return useQuery({
    queryKey: ["export-industry-px", key],
    queryFn: () => getIndustryMonthlyPrices({ data: { tickers } }),
    staleTime: 30 * 60_000,
    retry: 1,
    retryDelay: 1500,
    refetchOnWindowFocus: false,
    enabled: tickers.length > 0,
  });
}
