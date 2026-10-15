import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { KisStreamStatus } from "@/server/kis-realtime";
import { isDigitTicker, normalizeKrTicker } from "@/lib/infer-sector";
import { applyTradeToQuote, isValidKisTrade } from "@/lib/market-quote-state";

function uniqueCodes(codes: string[]) {
  // KIS websocket is cash-equity only. Never strip letters — 0226A0 → 002260.
  return [...new Set(codes.map((c) => normalizeKrTicker(c)))]
    .filter((c) => isDigitTicker(c))
    .slice(0, 40);
}

/** Connection health is distinct from receiving a verified, current trade. */
export type MarketStreamStatus = KisStreamStatus & {
  reconnecting?: boolean;
  lastTradeAt: string | null;
};
const INITIAL_STATUS: MarketStreamStatus = {
  enabled: false,
  connected: false,
  provider: "kis",
  source: "kis-krx-websocket",
  lastTradeAt: null,
};

export function useMarketStream(codes: string[]) {
  const queryClient = useQueryClient();
  const normalized = useMemo(() => uniqueCodes(codes), [codes.join(",")]);
  const [status, setStatus] = useState<MarketStreamStatus>(INITIAL_STATUS);

  useEffect(() => {
    setStatus(INITIAL_STATUS);
    if (!normalized.length || typeof EventSource === "undefined") return;
    const requested = new Set(normalized);
    const es = new EventSource(
      `/api/market-stream?codes=${encodeURIComponent(normalized.join(","))}`,
    );
    const onStatus = (event: MessageEvent<string>) => {
      try {
        const next = JSON.parse(event.data) as KisStreamStatus;
        if (typeof next.enabled !== "boolean" || typeof next.connected !== "boolean") return;
        setStatus((old) => ({ ...old, ...next, reconnecting: false }));
      } catch {
        /* ignore invalid control data */
      }
    };
    const onReconnect = () =>
      setStatus((s) => ({ ...s, connected: false, reconnecting: true, message: "재연결 중" }));
    const onTrade = (event: MessageEvent<string>) => {
      let value: unknown;
      try {
        value = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!isValidKisTrade(value) || !requested.has(value.code)) return;
      const trade = value;
      setStatus((s) => ({
        ...s,
        lastTradeAt:
          !s.lastTradeAt || trade.tradedAt > s.lastTradeAt ? trade.tradedAt : s.lastTradeAt,
      }));
      // A tick changes only its row. Snapshot fetch time / universe provenance stay intact.
      const updateRows = (old: any) =>
        !old?.quotes
          ? old
          : {
              ...old,
              quotes: old.quotes.map((q: any) => applyTradeToQuote(q, trade)),
            };
      queryClient.setQueryData(["market-quotes"], updateRows);
      queryClient.setQueriesData({ queryKey: ["quotes-by-codes"] }, updateRows);
      queryClient.setQueryData(["stock-bundle", trade.code], (old: any) =>
        !old?.quote
          ? old
          : {
              ...old,
              quote: applyTradeToQuote(old.quote, trade),
            },
      );
      queryClient.setQueryData(["etf-bundle", trade.code], (old: any) =>
        !old?.etf
          ? old
          : {
              ...old,
              etf: applyTradeToQuote(old.etf, trade),
            },
      );
    };

    es.addEventListener("status", onStatus as EventListener);
    es.addEventListener("trade", onTrade as EventListener);
    es.addEventListener("reconnect", onReconnect);
    es.onopen = () => setStatus((s) => ({ ...s, reconnecting: false }));
    es.onerror = onReconnect;
    // Re-render after quiet periods so live badges can expire without a new event.
    const freshness = setInterval(() => setStatus((s) => ({ ...s })), 10_000);
    return () => {
      clearInterval(freshness);
      es.close();
    };
  }, [normalized.join(","), queryClient]);

  return status;
}
