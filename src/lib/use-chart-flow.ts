import { useQuery } from "@tanstack/react-query";
import { getChartFlow } from "@/lib/chart-flow-fns";
import { flowRequestKey, type FlowRequest } from "@/lib/charts/hts-flow";

/** Daily fundamentals refresh independently of price ticks. Never retain another instrument's response. */
export function useChartFlow(request: FlowRequest, enabled = true) {
  return useQuery({
    queryKey: ["chart-flow", flowRequestKey(request)],
    queryFn: ({ signal }) => getChartFlow({ data: request, signal }),
    select: (data) => ({
      ...data,
      stale: data.stale || Date.now() - Date.parse(data.fetchedAt) > 300_000,
    }),
    enabled: enabled && Boolean(request.from && request.to),
    staleTime: 300_000,
    gcTime: 1_800_000,
    retry: 0, // The server owns the single bounded retry.
    refetchOnWindowFocus: false,
    refetchInterval: 300_000,
  });
}
