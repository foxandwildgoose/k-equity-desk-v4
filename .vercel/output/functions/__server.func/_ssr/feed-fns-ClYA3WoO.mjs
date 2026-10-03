import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
import { c as string, n as _enum, r as array, s as object } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/feed-fns-ClYA3WoO.js
/**
* Server functions for source health (B0.5).
*/
async function buildRows() {
	const [{ SOURCE_REGISTRY }, { healthOf }, { sourceRunnable }, { hasAdapter }] = await Promise.all([
		import("./registry-BWVqhaYN.mjs").then((n) => n.r).then((n) => n.r),
		import("./health-z1OjkYee.mjs").then((n) => n.t).then((n) => n.t),
		import("./http-CCgilygj.mjs").then((n) => n.i).then((n) => n.i),
		import("./adapters-fBNtatCf.mjs").then((n) => n.t)
	]);
	const secUa = Boolean(process.env.SEC_USER_AGENT?.trim());
	return {
		rows: SOURCE_REGISTRY.map((s) => {
			const h = healthOf(s.id);
			const run = sourceRunnable(s.id);
			const notes = { ...h.notes };
			if ((s.id === "sec-edgar" || s.id === "sec-8k-atom") && !secUa) notes["sec-ua"] = "SEC UA 미설정 (SEC_USER_AGENT)";
			return {
				id: s.id,
				name: s.name,
				region: s.region,
				kind: s.kind,
				tier: s.tier,
				group: s.group,
				format: s.format,
				registryStatus: s.status,
				enabled: s.enabled,
				runnable: run.ok,
				runnableReason: run.reason ?? null,
				paywalled: Boolean(s.paywalled),
				url: s.url ?? s.probeUrl ?? null,
				notes: s.notes,
				hasAdapter: hasAdapter(s.id),
				health: {
					lastAttemptAt: h.lastAttemptAt,
					lastSuccessAt: h.lastSuccessAt,
					httpStatus: h.httpStatus,
					latencyMs: h.latencyMs,
					itemCount: h.itemCount,
					newestPublishedAt: h.newestPublishedAt,
					consecutiveFailures: h.consecutiveFailures,
					circuit: h.circuit,
					circuitUntil: h.circuitUntil,
					adapterPath: h.adapterPath,
					lastError: h.lastError,
					notes
				}
			};
		}),
		env: {
			secUserAgent: secUa,
			kis: Boolean(process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET),
			finnhub: Boolean(process.env.FINNHUB_API_KEY),
			bloomberg: String(process.env.NEWS_BLOOMBERG_ENABLED ?? "true").toLowerCase() !== "false"
		}
	};
}
var getSourceHealth_createServerFn_handler = createServerRpc({
	id: "372a9c4aa7135b43b167eccfb4cc43657a1fa434bb90c327753d1a483fd51c6a",
	name: "getSourceHealth",
	filename: "src/lib/feed-fns.ts"
}, (opts) => getSourceHealth.__executeServer(opts));
var getSourceHealth = createServerFn({ method: "GET" }).handler(getSourceHealth_createServerFn_handler, async () => {
	const { rows, env } = await buildRows();
	return {
		generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
		rows,
		env
	};
});
var retrySource_createServerFn_handler = createServerRpc({
	id: "f0b11c3d735f678e4ca21290cfdf80fd6fb452c06b5c8696cf77abcf690de7b3",
	name: "retrySource",
	filename: "src/lib/feed-fns.ts"
}, (opts) => retrySource.__executeServer(opts));
var retrySource = createServerFn({ method: "POST" }).validator(object({ id: string().min(2).max(60).regex(/^[a-z0-9-]+$/) })).handler(retrySource_createServerFn_handler, async ({ data }) => {
	const { runSource } = await import("./runner-JXC75WOo.mjs").then((n) => n.a);
	await import("./adapters-fBNtatCf.mjs").then((n) => n.t);
	const r = await runSource(data.id, { bypassCache: true });
	return {
		id: r.id,
		state: r.state,
		count: r.items.length,
		error: r.error ?? null,
		ms: r.ms
	};
});
var SNAPSHOT_IDS = [
	"spx",
	"ndx",
	"dji",
	"rut",
	"vix",
	"tnx",
	"dxy",
	"wti",
	"gold",
	"btc",
	"usdkrw"
];
/** Delayed US/FX/commodity snapshot tiles (F3.2 / F3.6). */
var getMarketSnapshot_createServerFn_handler = createServerRpc({
	id: "10674e5ecfabc75bfa277b5ead779d52583998735e4b64ccaa7b7c106d3606fc",
	name: "getMarketSnapshot",
	filename: "src/lib/feed-fns.ts"
}, (opts) => getMarketSnapshot.__executeServer(opts));
var getMarketSnapshot = createServerFn({ method: "GET" }).validator(object({ ids: array(_enum(SNAPSHOT_IDS)).max(11).optional() })).handler(getMarketSnapshot_createServerFn_handler, async ({ data }) => {
	const { fetchSnapshot } = await import("./snapshot-CrMhPXx3.mjs");
	return fetchSnapshot(data.ids ? [...data.ids] : void 0);
});
var getUsCalendar_createServerFn_handler = createServerRpc({
	id: "2a6c66b1e8f49b3adc9f553bcd5cbe8aa8983c5a797be053198765d534386db3",
	name: "getUsCalendar",
	filename: "src/lib/feed-fns.ts"
}, (opts) => getUsCalendar.__executeServer(opts));
var getUsCalendar = createServerFn({ method: "GET" }).handler(getUsCalendar_createServerFn_handler, async () => {
	const { fetchUsOfficialPolicy } = await import("./us-official-research-B2JCCI2h.mjs");
	try {
		const pack = await fetchUsOfficialPolicy();
		const now = Date.now();
		const horizon = now + 6048e5;
		return {
			events: pack.calendar.filter((e) => {
				if (!e.iso) return false;
				const t = Date.parse(`${e.iso.slice(0, 10)}T23:59:59Z`);
				return t >= now - 864e5 && t <= horizon;
			}).sort((a, b) => (a.iso ?? "").localeCompare(b.iso ?? "")).slice(0, 12),
			fetchedAt: pack.fetchedAt,
			errors: pack.errors
		};
	} catch (err) {
		return {
			events: [],
			fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
			errors: [err instanceof Error ? err.message : "calendar unavailable"]
		};
	}
});
var getNaverAiBriefing_createServerFn_handler = createServerRpc({
	id: "ef7893deb0d09616ff11a2f0c583627ae5407606842650ddb706e1e326c4e67c",
	name: "getNaverAiBriefing",
	filename: "src/lib/feed-fns.ts"
}, (opts) => getNaverAiBriefing.__executeServer(opts));
var getNaverAiBriefing = createServerFn({ method: "GET" }).handler(getNaverAiBriefing_createServerFn_handler, async () => {
	const { fetchJsonWithPolicy } = await import("./http-CCgilygj.mjs").then((n) => n.i).then((n) => n.i);
	const { mapNaverAiBriefing, naverList } = await import("./naver-C7W4a0B0.mjs").then((n) => n.i).then((n) => n.i);
	const { kstToday } = await import("./time-By5ScNNo.mjs").then((n) => n.c).then((n) => n.c);
	const out = {
		current: null,
		list: [],
		error: null,
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	try {
		out.current = mapNaverAiBriefing(await fetchJsonWithPolicy("https://stock.naver.com/api/securityAi/marketBriefing/current?marketBriefing=domain", { sourceId: "naver-ai-briefing" }));
		out.list = naverList(await fetchJsonWithPolicy(`https://stock.naver.com/api/securityAi/v2/marketBriefing?date=${kstToday()}&size=20`, { sourceId: "naver-ai-briefing" }), ["items"]).map((r) => mapNaverAiBriefing(r)).filter((x) => x != null);
	} catch (err) {
		out.error = err instanceof Error ? err.message.slice(0, 160) : "unavailable";
	}
	return out;
});
//#endregion
export { getMarketSnapshot_createServerFn_handler, getNaverAiBriefing_createServerFn_handler, getSourceHealth_createServerFn_handler, getUsCalendar_createServerFn_handler, retrySource_createServerFn_handler };
