import { r as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { a as stripHtml } from "./text-2P-t067w.mjs";
import { n as SOURCE_REGISTRY } from "./registry-BWVqhaYN.mjs";
import { i as recordAttempt, n as isCircuitOpen, r as openCircuit } from "./health-z1OjkYee.mjs";
import { t as XMLParser } from "../_libs/fast-xml-parser+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/http-CCgilygj.js
var http_CCgilygj_exports = /* @__PURE__ */ __exportAll({
	a: () => sourceRunnable,
	i: () => http_exports,
	n: () => fetchJsonWithPolicy,
	o: () => parseFeed,
	r: () => fetchWithPolicy,
	t: () => FetchPolicyError
});
/**
* RSS 2.0 / Atom 1.0 / RDF (RSS 1.0) → flat entries (B0.4). Pure module.
* Charset detection: Content-Type → XML prolog → <meta charset> → UTF-8.
*/
var parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	textNodeName: "#text",
	removeNSPrefix: true,
	parseTagValue: false,
	parseAttributeValue: false,
	trimValues: true,
	processEntities: true,
	htmlEntities: true,
	stopNodes: [
		"*.description",
		"*.encoded",
		"*.summary",
		"*.content"
	]
});
function arr(v) {
	if (v == null) return [];
	return Array.isArray(v) ? v : [v];
}
function text(v) {
	if (v == null) return "";
	if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
	if (Array.isArray(v)) return text(v[0]);
	if (typeof v === "object") {
		const o = v;
		if (o["#text"] != null) return String(o["#text"]);
	}
	return "";
}
function clean(v) {
	return stripHtml(text(v));
}
function obj(v) {
	return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
function atomLink(v) {
	const links = arr(v);
	let first = "";
	for (const l of links) {
		if (typeof l === "string") {
			if (!first) first = l;
			continue;
		}
		const o = obj(l);
		const href = typeof o["@_href"] === "string" ? o["@_href"] : "";
		const rel = typeof o["@_rel"] === "string" ? o["@_rel"] : "alternate";
		if (href && rel === "alternate") return href.trim();
		if (href && !first) first = href;
	}
	return first.trim();
}
function categoriesOf(v) {
	const out = [];
	for (const c of arr(v)) {
		const o = obj(c);
		const t = typeof c === "string" ? c : typeof o["@_term"] === "string" ? String(o["@_term"]) : text(c);
		const s = stripHtml(t);
		if (s) out.push(s);
	}
	return out;
}
function authorOf(item) {
	const a = item.author ?? item.creator;
	if (a == null) return "";
	const first = arr(a)[0];
	const o = obj(first);
	if (o.name != null) return clean(o.name);
	return clean(first);
}
function rssEntry(raw) {
	const it = obj(raw);
	const title = clean(it.title);
	const link = clean(it.link) || atomLink(it.link);
	const guid = clean(it.guid) || link;
	if (!title && !link) return null;
	const src = obj(it.source);
	const source = clean(it.source) || void 0;
	return {
		title,
		link,
		guid,
		pubDate: clean(it.pubDate ?? it.date ?? it.published ?? it.updated),
		description: clean(it.description ?? it.encoded),
		categories: categoriesOf(it.category ?? it.subject),
		author: authorOf(it),
		source,
		sourceUrl: typeof src["@_url"] === "string" ? src["@_url"] : void 0
	};
}
function atomEntry(raw) {
	const it = obj(raw);
	const title = clean(it.title);
	const link = atomLink(it.link);
	const guid = clean(it.id) || link;
	if (!title && !link) return null;
	return {
		title,
		link,
		guid,
		pubDate: clean(it.published ?? it.updated ?? it.date),
		description: clean(it.summary ?? it.content),
		categories: categoriesOf(it.category),
		author: authorOf(it)
	};
}
/** Parse RSS 2.0, Atom 1.0 or RDF text into flat entries. Never throws. */
function parseFeed(xml) {
	if (!xml || typeof xml !== "string") return [];
	let doc;
	try {
		doc = obj(parser.parse(xml.replace(/^\uFEFF/, "")));
	} catch {
		return [];
	}
	const rss = obj(doc.rss);
	if (Object.keys(rss).length) return arr(obj(arr(rss.channel)[0]).item).map(rssEntry).filter((e) => e != null);
	const feed = obj(doc.feed);
	if (Object.keys(feed).length) return arr(feed.entry).map(atomEntry).filter((e) => e != null);
	const rdf = obj(doc.RDF);
	if (Object.keys(rdf).length) return (arr(rdf.item).length ? arr(rdf.item) : arr(obj(arr(rdf.channel)[0]).item)).map(rssEntry).filter((e) => e != null);
	return [];
}
function normalizeCharset(label) {
	if (!label) return null;
	const l = label.trim().toLowerCase().replace(/^["']|["']$/g, "");
	if (!l) return null;
	if (l === "ks_c_5601-1987" || l === "ksc5601" || l === "cp949" || l === "x-windows-949" || l === "ms949") return "euc-kr";
	return l;
}
/** Charset from a `Content-Type` header value. */
function charsetFromContentType(ct) {
	const m = ct?.match(/charset\s*=\s*["']?([\w.:-]+)/i);
	return normalizeCharset(m?.[1]);
}
/** Charset from an XML prolog or HTML meta tag in the first bytes. */
function charsetFromMarkup(head) {
	const prolog = head.match(/<\?xml[^>]*encoding\s*=\s*["']([\w.:-]+)["']/i);
	if (prolog) return normalizeCharset(prolog[1]);
	const meta = head.match(/<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i);
	if (meta) return normalizeCharset(meta[1]);
	return null;
}
/**
* Decode response bytes: `Content-Type` charset, then XML prolog, then
* `<meta charset>`, then UTF-8. EUC-KR via `TextDecoder("euc-kr")`.
*/
function decodeFeedBytes(bytes, contentType) {
	const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
	const label = charsetFromContentType(contentType) ?? charsetFromMarkup(head) ?? "utf-8";
	try {
		return new TextDecoder(label).decode(bytes).replace(/^\uFEFF/, "");
	} catch {
		return new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
	}
}
/**
* `fetchWithPolicy` (B0.4): the only way feed adapters touch the network.
*
* - https only; host must be on the registry allowlist (SSRF guard)
* - manual redirects: ≤ 3 hops, each re-checked against the allowlist
* - ≤ 2 concurrent requests per host + a minimum interval between starts
* - 5 MiB response cap; per-request timeout (≤ 8 s, ≤ 10 s for HTML/PDF)
* - URL cache (TTL, LRU ≤ 500) + in-flight de-duplication
* - one retry with jitter on timeout / 5xx
* - 403/429 opens the source circuit (15 min, 30 min on repeat) → health
*/
var http_exports = /* @__PURE__ */ __exportAll$1({
	ALLOWED_HOSTS: () => ALLOWED_HOSTS,
	FetchPolicyError: () => FetchPolicyError,
	MAX_BYTES: () => MAX_BYTES,
	__setFetchImpl: () => __setFetchImpl,
	cacheSize: () => cacheSize,
	fetchJsonWithPolicy: () => fetchJsonWithPolicy,
	fetchWithPolicy: () => fetchWithPolicy,
	isAllowedUrl: () => isAllowedUrl,
	secUserAgent: () => secUserAgent,
	sourceRunnable: () => sourceRunnable
});
var MAX_BYTES = 5242880;
var MAX_REDIRECTS = 3;
var MAX_PER_HOST = 2;
var CACHE_MAX = 500;
var FetchPolicyError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "FetchPolicyError";
	}
};
var REGISTRY_BY_ID = new Map(SOURCE_REGISTRY.map((s) => [s.id, s]));
function hostsOf(s) {
	const out = [];
	for (const u of [s.url, s.probeUrl]) {
		if (!u) continue;
		try {
			out.push(new URL(u.replaceAll("{today}", "20260101").replaceAll("{startDate7}", "2026-01-01")).hostname);
		} catch {}
	}
	return [...out, ...s.hosts ?? []];
}
/** SSRF allowlist derived from the registry (all sources, enabled or not). */
var ALLOWED_HOSTS = new Set(SOURCE_REGISTRY.flatMap(hostsOf));
function isAllowedUrl(raw) {
	let u;
	try {
		u = new URL(raw);
	} catch {
		return {
			ok: false,
			code: "bad-url"
		};
	}
	if (u.protocol !== "https:") return {
		ok: false,
		code: "non-https"
	};
	if (!ALLOWED_HOSTS.has(u.hostname)) return {
		ok: false,
		code: "host-not-allowed"
	};
	if (u.username || u.password) return {
		ok: false,
		code: "bad-url"
	};
	return {
		ok: true,
		url: u
	};
}
/** Env kill switches + required env for a source. */
function sourceRunnable(id) {
	const s = REGISTRY_BY_ID.get(id);
	if (!s) return {
		ok: false,
		reason: "레지스트리에 없음"
	};
	if (!s.enabled) return {
		ok: false,
		reason: s.status === "disabled" ? "비활성(폐지)" : "비활성(검증 전 후보)"
	};
	if (s.envFlag && String(process.env[s.envFlag] ?? "true").trim().toLowerCase() === "false") return {
		ok: false,
		reason: `${s.envFlag}=false`
	};
	if ((process.env.FEED_SOURCES_DISABLED ?? "").split(",").map((x) => x.trim()).filter(Boolean).includes(id)) return {
		ok: false,
		reason: "FEED_SOURCES_DISABLED"
	};
	const missing = (s.requiresEnv ?? []).filter((k) => !process.env[k]);
	if (missing.length) return {
		ok: false,
		reason: `환경변수 미설정: ${missing.join(", ")}`
	};
	return { ok: true };
}
function secUserAgent() {
	return process.env.SEC_USER_AGENT?.trim() || "KoreaEquityDesk research@example.com";
}
var BROWSER_UA = "Mozilla/5.0 (compatible; KoreaEquityDesk/1.0) AppleWebKit/537.36";
function defaultHeaders(u, accept) {
	const host = u.hostname;
	if (host.endsWith("sec.gov")) return {
		"User-Agent": secUserAgent(),
		Accept: accept ?? "application/json,application/atom+xml,text/html;q=0.8"
	};
	const h = {
		"User-Agent": BROWSER_UA,
		Accept: accept ?? "application/json,application/rss+xml,application/atom+xml,application/xml,text/xml,text/html;q=0.8,*/*;q=0.5",
		"Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8"
	};
	if (host === "stock.naver.com") h.Referer = "https://stock.naver.com/";
	else if (host.endsWith("naver.com")) h.Referer = "https://m.stock.naver.com/";
	return h;
}
var MIN_INTERVAL_MS = {
	"www.sec.gov": 130,
	"data.sec.gov": 130,
	"stock.naver.com": 300,
	"m.stock.naver.com": 250,
	"news.google.com": 200
};
var hostState = /* @__PURE__ */ new Map();
async function acquire(host) {
	let st = hostState.get(host);
	if (!st) {
		st = {
			active: 0,
			lastStart: 0,
			queue: []
		};
		hostState.set(host, st);
	}
	const s = st;
	if (s.active >= MAX_PER_HOST) await new Promise((resolve) => s.queue.push(resolve));
	s.active += 1;
	const gap = (MIN_INTERVAL_MS[host] ?? 150) - (Date.now() - s.lastStart);
	if (gap > 0) await new Promise((r) => setTimeout(r, gap));
	s.lastStart = Date.now();
	return () => {
		s.active -= 1;
		const next = s.queue.shift();
		if (next) next();
	};
}
var cache = /* @__PURE__ */ new Map();
var inflight = /* @__PURE__ */ new Map();
function cacheGet(key) {
	const hit = cache.get(key);
	if (!hit) return null;
	if (Date.now() - hit.at > hit.ttl) {
		cache.delete(key);
		return null;
	}
	cache.delete(key);
	cache.set(key, hit);
	return {
		...hit.res,
		fromCache: true
	};
}
function cacheSet(key, ttl, res) {
	if (ttl <= 0) return;
	cache.set(key, {
		at: Date.now(),
		ttl,
		res
	});
	while (cache.size > CACHE_MAX) {
		const first = cache.keys().next().value;
		if (first === void 0) break;
		cache.delete(first);
	}
}
function cacheSize() {
	return cache.size;
}
async function readCapped(res) {
	const len = Number(res.headers.get("content-length") ?? "0");
	if (len > 5242880) throw new FetchPolicyError("too-large", `response ${len} bytes > 5 MiB`);
	if (!res.body) return new Uint8Array(await res.arrayBuffer());
	const reader = res.body.getReader();
	const chunks = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > 5242880) {
			await reader.cancel().catch(() => void 0);
			throw new FetchPolicyError("too-large", "response exceeded 5 MiB");
		}
		chunks.push(value);
	}
	const out = new Uint8Array(total);
	let off = 0;
	for (const c of chunks) {
		out.set(c, off);
		off += c.byteLength;
	}
	return out;
}
var fetchImpl = (input, init) => fetch(input, init);
/** Test hook: swap the network layer. */
function __setFetchImpl(fn) {
	fetchImpl = fn ?? ((input, init) => fetch(input, init));
}
async function attempt(startUrl, opts, timeoutMs) {
	let current = startUrl;
	const started = Date.now();
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const check = isAllowedUrl(current);
		if (!check.ok) throw new FetchPolicyError(check.code, `${check.code}: ${current}`);
		const release = await acquire(check.url.hostname);
		let res;
		try {
			res = await fetchImpl(current, {
				method: opts.method ?? "GET",
				body: opts.body,
				headers: {
					...defaultHeaders(check.url, opts.accept),
					...opts.headers ?? {}
				},
				redirect: "manual",
				signal: AbortSignal.timeout(timeoutMs)
			});
		} finally {
			release();
		}
		if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
			current = new URL(res.headers.get("location"), current).toString();
			await res.body?.cancel().catch(() => void 0);
			continue;
		}
		const bytes = await readCapped(res);
		const contentType = res.headers.get("content-type");
		const text = opts.charset ? new TextDecoder(opts.charset).decode(bytes) : decodeFeedBytes(bytes, contentType);
		return {
			ok: res.ok,
			status: res.status,
			url: current,
			contentType,
			text,
			latencyMs: Date.now() - started,
			fromCache: false
		};
	}
	throw new FetchPolicyError("too-many-redirects", `more than ${MAX_REDIRECTS} redirects: ${startUrl}`);
}
function isTimeout(err) {
	const e = err;
	return e?.name === "TimeoutError" || e?.name === "AbortError" || e?.cause?.name === "TimeoutError";
}
/**
* Fetch `url` for registry source `sourceId` under the A4/B0.4 policy.
* Throws `FetchPolicyError` for policy violations; returns non-2xx responses
* with `ok: false` (after opening the circuit on 403/429).
*/
async function fetchWithPolicy(url, opts) {
	const run = sourceRunnable(opts.sourceId);
	if (!run.ok) throw new FetchPolicyError("source-disabled", run.reason ?? "disabled");
	if (isCircuitOpen(opts.sourceId)) throw new FetchPolicyError("circuit-open", `circuit open for ${opts.sourceId}`);
	const check = isAllowedUrl(url);
	if (!check.ok) throw new FetchPolicyError(check.code, `${check.code}: ${url}`);
	const def = REGISTRY_BY_ID.get(opts.sourceId);
	const ttl = opts.ttlMs ?? (def ? def.pollSec * 1e3 : 6e4);
	const key = `${opts.method ?? "GET"} ${url} ${opts.body ?? ""}`;
	if (!opts.bypassCache) {
		const hit = cacheGet(key);
		if (hit) return hit;
		const pending = inflight.get(key);
		if (pending) return pending;
	}
	const timeoutMs = Math.min(opts.timeoutMs ?? 8e3, 1e4);
	const task = (async () => {
		let res = null;
		let lastErr = null;
		for (let i = 0; i < 2; i++) try {
			res = await attempt(url, opts, timeoutMs);
			if (res.status >= 500 && i === 0) {
				recordAttempt(opts.sourceId, {
					ok: false,
					status: res.status,
					latencyMs: res.latencyMs
				});
				await new Promise((r) => setTimeout(r, 200 + Math.floor(Math.random() * 400)));
				continue;
			}
			break;
		} catch (err) {
			lastErr = err;
			if (err instanceof FetchPolicyError) throw err;
			if (i === 0 && isTimeout(err)) {
				await new Promise((r) => setTimeout(r, 200 + Math.floor(Math.random() * 400)));
				continue;
			}
			break;
		}
		if (!res) {
			const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
			recordAttempt(opts.sourceId, {
				ok: false,
				status: null,
				latencyMs: timeoutMs,
				error: isTimeout(lastErr) ? "timeout" : msg
			});
			throw lastErr instanceof Error ? lastErr : new Error(msg);
		}
		recordAttempt(opts.sourceId, {
			ok: res.ok,
			status: res.status,
			latencyMs: res.latencyMs
		});
		if (res.status === 403 || res.status === 429) openCircuit(opts.sourceId, res.status);
		if (res.ok) cacheSet(key, ttl, res);
		return res;
	})();
	inflight.set(key, task);
	try {
		return await task;
	} finally {
		inflight.delete(key);
	}
}
/** JSON convenience wrapper: throws on non-2xx / invalid JSON. */
async function fetchJsonWithPolicy(url, opts) {
	const res = await fetchWithPolicy(url, {
		accept: "application/json",
		...opts
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return JSON.parse(res.text);
}
//#endregion
export { parseFeed as a, http_CCgilygj_exports as i, fetchJsonWithPolicy as n, sourceRunnable as o, fetchWithPolicy as r, FetchPolicyError as t };
