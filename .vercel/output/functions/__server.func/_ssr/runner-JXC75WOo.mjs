import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { a as recordFailure, o as recordResult } from "./health-z1OjkYee.mjs";
import { o as sourceRunnable, t as FetchPolicyError } from "./http-CCgilygj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/runner-JXC75WOo.js
/**
* Source runner: maps registry ids → adapter functions, runs them with health
* bookkeeping, and powers `/status/sources` retries. Adapters register
* themselves via `registerAdapter` (see `src/server/feeds/adapters/index.ts`).
*/
var runner_exports = /* @__PURE__ */ __exportAll({
	hasAdapter: () => hasAdapter,
	registerAdapter: () => registerAdapter,
	runSource: () => runSource,
	runSources: () => runSources
});
var adapters = /* @__PURE__ */ new Map();
function registerAdapter(id, fn) {
	adapters.set(id, fn);
}
function hasAdapter(id) {
	return adapters.has(id);
}
function newest(items) {
	let best = null;
	for (const it of items) if (it.publishedAt && (!best || it.publishedAt > best)) best = it.publishedAt;
	return best;
}
/** Run one source with a hard per-source timeout. Never throws. */
async function runSource(id, opts = {}) {
	const started = Date.now();
	const run = sourceRunnable(id);
	if (!run.ok) return {
		id,
		state: "disabled",
		items: [],
		error: run.reason,
		ms: 0
	};
	const fn = adapters.get(id);
	if (!fn) return {
		id,
		state: "no-adapter",
		items: [],
		ms: 0
	};
	const timeoutMs = opts.timeoutMs ?? 7500;
	let timer;
	try {
		const out = await Promise.race([fn(opts), new Promise((_, reject) => {
			timer = setTimeout(() => reject(/* @__PURE__ */ new Error("source timeout")), timeoutMs);
		})]);
		recordResult(id, {
			count: out.items.length,
			newestPublishedAt: newest(out.items),
			adapterPath: out.adapterPath ?? null
		});
		return {
			id,
			state: out.items.length ? "ok" : "empty",
			items: out.items,
			ms: Date.now() - started
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (err instanceof FetchPolicyError) {
			if (err.code === "circuit-open") return {
				id,
				state: "circuit-open",
				items: [],
				error: msg,
				ms: Date.now() - started
			};
			if (err.code === "source-disabled") return {
				id,
				state: "disabled",
				items: [],
				error: msg,
				ms: 0
			};
		}
		const timeout = /timeout/i.test(msg);
		recordFailure(id, timeout ? "timeout" : msg.slice(0, 200));
		return {
			id,
			state: timeout ? "timeout" : "error",
			items: [],
			error: msg,
			ms: Date.now() - started
		};
	} finally {
		if (timer) clearTimeout(timer);
	}
}
/**
* Fan out to many sources under a global budget. Returns whatever arrived by
* the deadline; sources still running are reported as `timeout` (partial).
*/
async function runSources(ids, opts = {}) {
	const budget = opts.budgetMs ?? 8e3;
	const settled = /* @__PURE__ */ new Map();
	const tasks = ids.map((id) => runSource(id, {
		...opts,
		timeoutMs: Math.min(opts.perSourceMs ?? 7e3, budget - 250)
	}).then((r) => {
		settled.set(id, r);
	}));
	let timer;
	await Promise.race([Promise.all(tasks), new Promise((resolve) => {
		timer = setTimeout(resolve, budget);
	})]);
	if (timer) clearTimeout(timer);
	const results = ids.map((id) => settled.get(id) ?? {
		id,
		state: "timeout",
		items: [],
		error: "budget exceeded",
		ms: budget
	});
	return {
		results,
		partial: results.some((r) => r.state === "timeout" || r.state === "error" || r.state === "circuit-open")
	};
}
//#endregion
export { runner_exports as a, runSources as i, registerAdapter as n, runSource as r, hasAdapter as t };
