import { useQuery } from "@tanstack/react-query";
import { getChartSecurity, getUsChartSecurity } from "@/server/chart-security";
import { getUniverseItem } from "@/data/universe";
import { ROBOTICS_US_ETFS } from "@/data/robotics";
import { existingUsChartSecurity, type ChartSecurity } from "./security";

/** Query keys include the listing; previous security responses are never placeholders. */
export function useChartSecurity(code: string, market: "KR" | "US", validatedProduct?: ChartSecurity["instrument"]) {
  const normalized = code.trim().toUpperCase();
  const known = market === "KR" ? getUniverseItem(normalized) : null;
  const declared: ChartSecurity | undefined = validatedProduct
    ? { code: normalized, market, instrument: validatedProduct, exchange: known?.market ?? (market === "KR" ? "KRX" : "US"),
        currency: market === "KR" ? "KRW" : "USD", quantityUnit: "주", source: "validated-route-product" }
    : known
    ? {
        code: normalized,
        market: "KR",
        exchange: known.market,
        instrument: "stock",
        currency: "KRW",
        quantityUnit: "주",
        name: known.nameKo,
        source: "desk-stock-universe",
      }
    : market === "US"
      ? existingUsChartSecurity(normalized, ROBOTICS_US_ETFS)
      : undefined;
  const query = useQuery({
    queryKey: ["chart-security", market, normalized],
    queryFn: async () => {
      const resolved = await (market === "US"
        ? getUsChartSecurity({ data: { code: normalized } })
        : getChartSecurity({ data: { code: normalized } }));
      // The remote resolver returns null on failure; turn it into a bounded retry.
      if (!resolved) throw new Error("PRODUCT_TYPE_UNKNOWN");
      return resolved;
    },
    enabled:
      market === "US"
        ? /^[A-Z][A-Z0-9.-]{0,14}$/.test(normalized)
        : !declared && /^[0-9A-Z]{6}$/.test(normalized),
    staleTime: (query) => (query.state.data ? 60 * 60_000 : 30_000),
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
  });
  return { ...query, data: declared ?? query.data ?? null };
}
