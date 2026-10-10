import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { getChartFlow } from "@/lib/chart-flow-fns";
import { FLOW_METRICS, flowClientQueryKey, type FlowRequest } from "@/lib/charts/hts-flow";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { flowRefreshInterval } from "@/lib/charts/flow-query-policy";

/** Daily fundamentals refresh independently of price ticks. Never retain another instrument's response. */
export function useChartFlow(request: FlowRequest, enabled = true) {
  const { user } = useCurrentUserState();
  const scopeId = user && !user.isDevFallback ? user.id : null;
  const queryKey = flowClientQueryKey(request, scopeId);
  const identity = JSON.stringify(queryKey);
  const polling = useRef({ identity, startedAt: Date.now() });
  if (polling.current.identity !== identity) polling.current = { identity, startedAt: Date.now() };
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => getChartFlow({ data: request, signal }),
    select: (data) => ({
      ...data,
      stale: data.stale || Date.now() - Date.parse(data.fetchedAt) > 300_000,
    }),
    enabled: enabled && Boolean(request.from && request.to),
    staleTime: 300_000,
    gcTime: 1_800_000,
    retry: 0, // The server owns the single bounded retry.
    refetchOnWindowFocus: query => query.state.data && FLOW_METRICS.every(id => query.state.data![id].diagnostics?.mode === "collector") ? "always" : true,
    refetchInterval: query => flowRefreshInterval(query.state.data, Date.now() - polling.current.startedAt),
  });
}
