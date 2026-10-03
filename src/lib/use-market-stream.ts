import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { KisRealtimeTrade, KisStreamStatus } from "@/server/kis-realtime";
import { isDigitTicker, normalizeKrTicker } from "@/lib/infer-sector";

function uniqueCodes(codes: string[]) {
  // KIS websocket is cash-equity only. Never strip letters — 0226A0 → 002260.
  return [...new Set(codes.map((c) => normalizeKrTicker(c)))]
    .filter((c) => isDigitTicker(c))
    .slice(0, 40);
}

/** Stream status + `reconnecting` while EventSource re-opens (F8.6). */
export type MarketStreamStatus = KisStreamStatus & { reconnecting?: boolean };

export function useMarketStream(codes: string[]) {
  const queryClient = useQueryClient();
  const normalized = useMemo(() => uniqueCodes(codes), [codes.join(",")]);
  const [status, setStatus] = useState<MarketStreamStatus>({
    enabled: false,
    connected: false,
    provider: "kis",
    source: "kis-krx-websocket",
  });

  useEffect(() => {
    if (!normalized.length || typeof EventSource === "undefined") return;
    const es = new EventSource(`/api/market-stream?codes=${encodeURIComponent(normalized.join(","))}`);

    const onStatus = (event: MessageEvent<string>) => {
      try { setStatus({ ...(JSON.parse(event.data) as KisStreamStatus), reconnecting: false }); } catch { /* ignore */ }
    };
    // Server closes after ≤ 240 s with `retry: 3000`; the browser reconnects.
    const onReconnect = () => setStatus((s) => ({ ...s, connected: false, reconnecting: true, message: "재연결 중" }));
    const onTrade = (event: MessageEvent<string>) => {
      let trade: KisRealtimeTrade;
      try { trade = JSON.parse(event.data) as KisRealtimeTrade; } catch { return; }

      queryClient.setQueryData(["market-quotes"], (old: any) => {
        if (!old?.quotes) return old;
        return {
          ...old,
          source: "kis-krx-websocket",
          live: true,
          fetchedAt: trade.receivedAt,
          quotes: old.quotes.map((q: any) =>
            q.code === trade.code
              ? {
                  ...q,
                  price: trade.price,
                  change: trade.change,
                  changePct: trade.changePct,
                  open: trade.open,
                  high: trade.high,
                  low: trade.low,
                  volume: trade.accumulatedVolume,
                  tradedAt: `${trade.businessDate} ${trade.tradeTime}`,
                  source: "kis-krx-websocket",
                }
              : q,
          ),
        };
      });

      queryClient.setQueryData(["stock-bundle", trade.code], (old: any) => {
        if (!old?.quote) return old;
        return {
          ...old,
          fetchedAt: trade.receivedAt,
          quote: {
            ...old.quote,
            price: trade.price,
            change: trade.change,
            changePct: trade.changePct,
            open: trade.open,
            high: trade.high,
            low: trade.low,
            volume: trade.accumulatedVolume,
            tradedAt: `${trade.businessDate} ${trade.tradeTime}`,
            source: "kis-krx-websocket",
          },
        };
      });

      queryClient.setQueriesData({ queryKey: ["quotes-by-codes"] }, (old: any) => {
        if (!old?.quotes) return old;
        return {
          ...old,
          quotes: old.quotes.map((q: any) =>
            q.code === trade.code
              ? {
                  ...q,
                  price: trade.price,
                  change: trade.change,
                  changePct: trade.changePct,
                  open: trade.open,
                  high: trade.high,
                  low: trade.low,
                  volume: trade.accumulatedVolume,
                  tradedAt: `${trade.businessDate} ${trade.tradeTime}`,
                  source: "kis-krx-websocket",
                }
              : q,
          ),
        };
      });

      queryClient.setQueryData(["etf-bundle", trade.code], (old: any) => {
        if (!old?.etf) return old;
        return {
          ...old,
          etf: {
            ...old.etf,
            price: trade.price,
            change: trade.change,
            changePct: trade.changePct,
            volume: trade.accumulatedVolume,
          },
        };
      });
    };

    es.addEventListener("status", onStatus as EventListener);
    es.addEventListener("trade", onTrade as EventListener);
    es.addEventListener("reconnect", onReconnect);
    es.onopen = () => setStatus((s) => ({ ...s, reconnecting: false }));
    es.onerror = () => setStatus((s) => ({ ...s, connected: false, reconnecting: true, message: "재연결 중" }));

    return () => es.close();
  }, [normalized.join(","), queryClient]);

  return status;
}
