import { useQuery } from "@tanstack/react-query";
import { getChartFlow } from "@/lib/chart-flow-fns";
import { flowClientQueryKey, type FlowRequest } from "@/lib/charts/hts-flow";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

/** Daily fundamentals refresh independently of price ticks. Never retain another instrument's response. */
export function useChartFlow(request: FlowRequest, enabled = true) {
  const { user } = useCurrentUserState();
  const scopeId = user && !user.isDevFallback ? user.id : null;
  return useQuery({
    queryKey: flowClientQueryKey(request, scopeId),
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
