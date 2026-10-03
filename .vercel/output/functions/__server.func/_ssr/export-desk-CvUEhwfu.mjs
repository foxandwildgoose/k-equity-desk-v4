import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
import { c as string, r as array, s as object } from "../_libs/zod.mjs";
import { t as UNIVERSE } from "./universe-BLkYDatc.mjs";
import { fetchUsdKrw } from "./etf-market-S8CEBu8d.mjs";
import { o as fetchOhlc, s as fetchRealtimeQuotes } from "./naver-market-C1ZunDb_.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/export-desk-CvUEhwfu.js
async function yahooMonthly(symbol) {
	const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=10y`;
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 1e4);
	try {
		const res = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0 KoreaExportDesk/1.0" },
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const r = (await res.json()).chart?.result?.[0];
		const ts = r?.timestamp ?? [];
		const cl = r?.indicators?.quote?.[0]?.close ?? [];
		const out = [];
		for (let i = 0; i < ts.length; i++) {
			const c = cl[i];
			if (c == null || !Number.isFinite(c)) continue;
			const d = /* @__PURE__ */ new Date(ts[i] * 1e3 + 324e5);
			const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
			out.push({
				date,
				value: c
			});
		}
		return out;
	} finally {
		clearTimeout(t);
	}
}
async function naverIndexMonthly(symbol) {
	const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${encodeURIComponent(symbol)}&timeframe=month&count=180&requestType=0`;
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 1e4);
	try {
		const res = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0 KoreaExportDesk/1.0" },
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const xml = await res.text();
		const out = [];
		for (const m of xml.matchAll(/<item data="([^"]+)"/g)) {
			const parts = m[1].split("|");
			const ymd = parts[0] ?? "";
			const close = Number(parts[4]);
			if (ymd.length < 8 || !Number.isFinite(close) || close <= 0) continue;
			const date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
			out.push({
				date,
				value: close
			});
		}
		return out;
	} finally {
		clearTimeout(t);
	}
}
var getExportMacro_createServerFn_handler = createServerRpc({
	id: "802cd5e425d9403328a1ed61e59ab15c981ad90ac5f900cb4fd2f1c9312299e9",
	name: "getExportMacro",
	filename: "src/server/export-desk.ts"
}, (opts) => getExportMacro.__executeServer(opts));
var getExportMacro = createServerFn({ method: "GET" }).handler(getExportMacro_createServerFn_handler, async () => {
	const [kospiNaver, kospiYahoo, fxSeries, spotFx] = await Promise.all([
		naverIndexMonthly("KOSPI").catch(() => []),
		yahooMonthly("^KS11").catch(() => []),
		yahooMonthly("USDKRW=X").catch(() => []),
		fetchUsdKrw().catch(() => 0)
	]);
	return {
		kospi: kospiNaver.length >= 12 ? kospiNaver : kospiYahoo,
		fx: fxSeries,
		spotUsdKrw: spotFx,
		source: kospiNaver.length >= 12 ? "Naver fchart KOSPI monthly" : "Yahoo Finance ^KS11",
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
});
function isPreferredName(name) {
	return /우$|우B$|우C$|우선|1우|2우|3우/.test(name.replace(/\s/g, ""));
}
async function fetchKospiMarketSum(pages = 4) {
	const rows = [];
	const seen = /* @__PURE__ */ new Set();
	for (let page = 1; page <= pages; page++) {
		const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=0&page=${page}`;
		const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 KoreaExportDesk/1.0" } });
		if (!res.ok) break;
		const buf = await res.arrayBuffer();
		let html;
		try {
			html = new TextDecoder("euc-kr").decode(buf);
		} catch {
			html = new TextDecoder("utf-8").decode(buf);
		}
		const trs = (html.match(/<table[^>]*class="type_2"[\s\S]*?<\/table>/i)?.[0] ?? "").match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
		for (const tr of trs) {
			const code = tr.match(/code=(\d{6})/)?.[1];
			const name = tr.match(/class="tltle">([^<]+)/)?.[1]?.trim();
			if (!code || !name || seen.has(code)) continue;
			const nums = [...tr.matchAll(/<td class="number">([\s\S]*?)<\/td>/gi)].map((m) => Number(m[1].replace(/<[^>]+>/g, "").replace(/,/g, "").replace(/[^\d.+-]/g, "").trim()));
			const price = nums[0] ?? 0;
			const changePct = nums[2] ?? 0;
			const marketCap = nums[4] ?? 0;
			if (!(marketCap > 0)) continue;
			seen.add(code);
			rows.push({
				ticker: code,
				name,
				marketCap,
				price,
				changePct,
				isPreferred: isPreferredName(name)
			});
		}
	}
	return rows;
}
var getKospiCapQuotes_createServerFn_handler = createServerRpc({
	id: "17f63d91d396ca6ee11ba0a10df4a4f009fc0642e7b8cb95c41fffb596bcb555",
	name: "getKospiCapQuotes",
	filename: "src/server/export-desk.ts"
}, (opts) => getKospiCapQuotes.__executeServer(opts));
var getKospiCapQuotes = createServerFn({ method: "GET" }).handler(getKospiCapQuotes_createServerFn_handler, async () => {
	const ranked = await fetchKospiMarketSum(4).catch(() => []);
	if (ranked.length > 0) return {
		quotes: ranked.map((q) => ({
			ticker: q.ticker,
			name: q.name,
			price: q.price,
			changePct: q.changePct,
			marketCap: q.marketCap,
			market: "KOSPI",
			isPreferred: q.isPreferred
		})),
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
		source: "Naver 시가총액 (KOSPI)"
	};
	const kospi = UNIVERSE.filter((u) => u.market === "KOSPI").map((u) => u.code);
	return {
		quotes: (await fetchRealtimeQuotes(kospi)).map((q) => ({
			ticker: q.code,
			name: q.nameKo,
			price: q.price,
			changePct: q.changePct,
			marketCap: q.marketCap ?? 0,
			market: q.market,
			isPreferred: false
		})),
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
		source: "Naver realtime fallback"
	};
});
var getIndustryMonthlyPrices_createServerFn_handler = createServerRpc({
	id: "8c045cd3627c9fc5450292feee0cc4b9e0e260d881148e395524e48ff487291d",
	name: "getIndustryMonthlyPrices",
	filename: "src/server/export-desk.ts"
}, (opts) => getIndustryMonthlyPrices.__executeServer(opts));
var getIndustryMonthlyPrices = createServerFn({ method: "GET" }).validator(object({ tickers: array(string().min(4).max(8)).max(12) })).handler(getIndustryMonthlyPrices_createServerFn_handler, async ({ data }) => {
	const series = {};
	await Promise.all(data.tickers.map(async (code) => {
		const pack = await fetchOhlc({
			code,
			market: "KOSPI",
			interval: "month",
			range: "10y"
		}).catch(() => ({ bars: [] }));
		series[code] = pack.bars.map((b) => ({
			date: b.date,
			value: b.close
		}));
	}));
	return {
		series,
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
		source: "Yahoo/Naver monthly close"
	};
});
//#endregion
export { getExportMacro_createServerFn_handler, getIndustryMonthlyPrices_createServerFn_handler, getKospiCapQuotes_createServerFn_handler };
