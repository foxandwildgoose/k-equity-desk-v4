import { n as fetchJsonWithPolicy } from "./http-CCgilygj.mjs";
import { s as yahooChartSnapshot } from "./generic-CkkW1ZKu.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/snapshot-CrMhPXx3.js
/**
* Delayed market snapshot tiles from the Yahoo chart endpoint (F3.2 / F3.6).
* Fixed symbol allowlist — NOT routed through `yahooUsSymbol` (which rejects
* `^`, `=`, `-`). Values come only from the response `meta`; missing → null.
*/
var SNAPSHOT_SYMBOLS = [
	{
		id: "spx",
		symbol: "^GSPC",
		label: "S&P 500"
	},
	{
		id: "ndx",
		symbol: "^NDX",
		label: "나스닥100"
	},
	{
		id: "dji",
		symbol: "^DJI",
		label: "다우"
	},
	{
		id: "rut",
		symbol: "^RUT",
		label: "러셀2000"
	},
	{
		id: "vix",
		symbol: "^VIX",
		label: "VIX"
	},
	{
		id: "tnx",
		symbol: "^TNX",
		label: "미 10년물 (^TNX)"
	},
	{
		id: "dxy",
		symbol: "DX-Y.NYB",
		label: "달러인덱스"
	},
	{
		id: "wti",
		symbol: "CL=F",
		label: "WTI"
	},
	{
		id: "gold",
		symbol: "GC=F",
		label: "금"
	},
	{
		id: "btc",
		symbol: "BTC-USD",
		label: "비트코인"
	},
	{
		id: "usdkrw",
		symbol: "KRW=X",
		label: "원/달러"
	}
];
async function fetchSnapshot(ids) {
	const list = SNAPSHOT_SYMBOLS.filter((s) => !ids || ids.includes(s.id));
	return {
		rows: await Promise.all(list.map(async (s) => {
			try {
				const json = await fetchJsonWithPolicy(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.symbol)}?range=5d&interval=1d`, { sourceId: "yahoo-chart" });
				const snap = yahooChartSnapshot(json);
				if (!snap) throw new Error("no meta");
				return {
					id: s.id,
					symbol: s.symbol,
					label: s.label,
					price: snap.price,
					change: snap.change,
					changePct: snap.changePct,
					currency: snap.currency,
					asOf: snap.asOf,
					delayMinutes: snap.delayMinutes,
					source: "Yahoo Finance"
				};
			} catch (err) {
				return {
					id: s.id,
					symbol: s.symbol,
					label: s.label,
					price: null,
					change: null,
					changePct: null,
					currency: null,
					asOf: null,
					delayMinutes: null,
					source: "Yahoo Finance",
					error: err instanceof Error ? err.message.slice(0, 120) : "error"
				};
			}
		})),
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
//#endregion
export { fetchSnapshot };
