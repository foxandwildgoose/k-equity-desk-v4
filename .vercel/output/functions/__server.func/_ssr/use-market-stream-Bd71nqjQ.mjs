import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { d as normalizeKrTicker, s as isDigitTicker } from "./universe-BLkYDatc.mjs";
import { a as useQueryClient } from "../_libs/tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-market-stream-Bd71nqjQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function uniqueCodes(codes) {
	return [...new Set(codes.map((c) => normalizeKrTicker(c)))].filter((c) => isDigitTicker(c)).slice(0, 40);
}
function useMarketStream(codes) {
	const queryClient = useQueryClient();
	const normalized = (0, import_react.useMemo)(() => uniqueCodes(codes), [codes.join(",")]);
	const [status, setStatus] = (0, import_react.useState)({
		enabled: false,
		connected: false,
		provider: "kis",
		source: "kis-krx-websocket"
	});
	(0, import_react.useEffect)(() => {
		if (!normalized.length || typeof EventSource === "undefined") return;
		const es = new EventSource(`/api/market-stream?codes=${encodeURIComponent(normalized.join(","))}`);
		const onStatus = (event) => {
			try {
				setStatus({
					...JSON.parse(event.data),
					reconnecting: false
				});
			} catch {}
		};
		const onReconnect = () => setStatus((s) => ({
			...s,
			connected: false,
			reconnecting: true,
			message: "재연결 중"
		}));
		const onTrade = (event) => {
			let trade;
			try {
				trade = JSON.parse(event.data);
			} catch {
				return;
			}
			queryClient.setQueryData(["market-quotes"], (old) => {
				if (!old?.quotes) return old;
				return {
					...old,
					source: "kis-krx-websocket",
					live: true,
					fetchedAt: trade.receivedAt,
					quotes: old.quotes.map((q) => q.code === trade.code ? {
						...q,
						price: trade.price,
						change: trade.change,
						changePct: trade.changePct,
						open: trade.open,
						high: trade.high,
						low: trade.low,
						volume: trade.accumulatedVolume,
						tradedAt: `${trade.businessDate} ${trade.tradeTime}`,
						source: "kis-krx-websocket"
					} : q)
				};
			});
			queryClient.setQueryData(["stock-bundle", trade.code], (old) => {
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
						source: "kis-krx-websocket"
					}
				};
			});
			queryClient.setQueriesData({ queryKey: ["quotes-by-codes"] }, (old) => {
				if (!old?.quotes) return old;
				return {
					...old,
					quotes: old.quotes.map((q) => q.code === trade.code ? {
						...q,
						price: trade.price,
						change: trade.change,
						changePct: trade.changePct,
						open: trade.open,
						high: trade.high,
						low: trade.low,
						volume: trade.accumulatedVolume,
						tradedAt: `${trade.businessDate} ${trade.tradeTime}`,
						source: "kis-krx-websocket"
					} : q)
				};
			});
			queryClient.setQueryData(["etf-bundle", trade.code], (old) => {
				if (!old?.etf) return old;
				return {
					...old,
					etf: {
						...old.etf,
						price: trade.price,
						change: trade.change,
						changePct: trade.changePct,
						volume: trade.accumulatedVolume
					}
				};
			});
		};
		es.addEventListener("status", onStatus);
		es.addEventListener("trade", onTrade);
		es.addEventListener("reconnect", onReconnect);
		es.onopen = () => setStatus((s) => ({
			...s,
			reconnecting: false
		}));
		es.onerror = () => setStatus((s) => ({
			...s,
			connected: false,
			reconnecting: true,
			message: "재연결 중"
		}));
		return () => es.close();
	}, [normalized.join(","), queryClient]);
	return status;
}
//#endregion
export { useMarketStream as t };
