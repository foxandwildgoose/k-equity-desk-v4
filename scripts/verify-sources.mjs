#!/usr/bin/env node
/**
 * Environment probe (A9). Sends ONE small GET to each enabled or candidate
 * registry source (A4 etiquette: sequential per host, short timeouts, no
 * cookies, no view-recording endpoints) and writes
 * docs/upgrade/SOURCES_STATUS.md.
 *
 * Usage: npm run verify:sources [-- --json]
 * Needs Node 22 type stripping (the npm script passes --experimental-strip-types).
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { SOURCE_REGISTRY, PUBLIC_RESEARCH_CANDIDATES } = await import(
  join(root, "src/server/feeds/registry.ts")
);
const { parseFeed, decodeFeedBytes } = await import(join(root, "src/lib/feed/rss-parse.ts"));
const { parseSourceTime } = await import(join(root, "src/lib/feed/time.ts"));

const UA_BROWSER =
  "Mozilla/5.0 (compatible; KoreaEquityDesk/1.0; +verify-sources) AppleWebKit/537.36";
const SEC_UA = process.env.SEC_USER_AGENT?.trim() || "KoreaEquityDesk research@example.com";

function kstDate(offsetDays = 0) {
  const d = new Date(Date.now() + 9 * 3600_000 - offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function fill(url) {
  return url.replaceAll("{today}", kstDate().replace(/-/g, "")).replaceAll("{startDate7}", kstDate(7));
}

function headersFor(url) {
  const host = new URL(url).hostname;
  if (host.endsWith("sec.gov")) return { "User-Agent": SEC_UA, Accept: "application/json,application/atom+xml,text/html;q=0.8" };
  const h = { "User-Agent": UA_BROWSER, Accept: "application/json,application/rss+xml,application/xml,text/xml,text/html;q=0.8,*/*;q=0.5", "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8" };
  if (host.endsWith("naver.com")) h.Referer = host.startsWith("m.") ? "https://m.stock.naver.com/" : "https://stock.naver.com/";
  return h;
}

const LIST_KEYS = ["articles", "items", "researchSets", "content", "results", "list", "data", "result"];
const DATE_KEYS = ["datetime", "dateTime", "writeDate", "publishDate", "publication_date", "publishedAt", "pubDate", "date", "createdAt", "registeredAt", "dateTimestamp", "datetimeStr"];

function findList(json) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== "object") return null;
  for (const k of LIST_KEYS) {
    const v = json[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      const inner = findList(v);
      if (inner) return inner;
    }
  }
  return null;
}

function newestOf(list) {
  let best = null;
  for (const row of list.slice(0, 200)) {
    if (!row || typeof row !== "object") continue;
    let raw = null;
    for (const k of DATE_KEYS) {
      if (row[k] != null && row[k] !== "") {
        raw = row[k];
        break;
      }
    }
    if (raw == null) continue;
    const p = parseSourceTime(raw, { zone: "Asia/Seoul" });
    if (p.iso && (!best || p.iso > best)) best = p.iso;
  }
  return best;
}

function parseBody(format, bytes, contentType) {
  const text = decodeFeedBytes(bytes, contentType);
  if (format === "rss" || format === "atom") {
    const entries = parseFeed(text);
    if (!entries.length) return { count: 0, newest: null, recognized: /<(rss|feed|rdf:RDF)[\s>]/i.test(text) };
    let newest = null;
    for (const e of entries) {
      const p = parseSourceTime(e.pubDate, { zone: "UTC" });
      if (p.iso && (!newest || p.iso > newest)) newest = p.iso;
    }
    return { count: entries.length, newest, recognized: true };
  }
  if (format === "json") {
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return { count: 0, newest: null, recognized: false };
    }
    const list = findList(json);
    if (list) return { count: list.length, newest: newestOf(list), recognized: true };
    if (json && typeof json === "object") {
      const keys = Object.keys(json);
      return { count: keys.length, newest: null, recognized: keys.length > 0 };
    }
    return { count: 0, newest: null, recognized: false };
  }
  // html
  const links = (text.match(/<a\s[^>]*href=/gi) ?? []).length;
  return { count: links, newest: null, recognized: /<html|<!doctype html/i.test(text) };
}

async function probe(src) {
  const rawUrl = src.probeUrl ?? src.url;
  const base = { id: src.id, name: src.name, url: rawUrl ?? "(builder)", registryStatus: src.status, enabled: src.enabled };
  if (!rawUrl) return { ...base, http: "—", latencyMs: null, count: null, newest: null, verdict: "skipped", note: "builder-only source without probe URL" };
  const missing = (src.requiresEnv ?? []).filter((k) => !process.env[k]);
  if (missing.length) return { ...base, http: "—", latencyMs: null, count: null, newest: null, verdict: "skipped", note: `env missing: ${missing.join(", ")}` };
  const url = fill(rawUrl);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: headersFor(url),
      redirect: "manual",
      signal: AbortSignal.timeout(src.format === "html" ? 10_000 : 8_000),
    });
    const latencyMs = Date.now() - started;
    const deny = res.headers.get("x-deny-reason");
    if (deny) return { ...base, http: res.status, latencyMs, count: null, newest: null, verdict: "blocked", note: `egress proxy: ${deny}` };
    if (res.status >= 300 && res.status < 400) {
      return { ...base, http: res.status, latencyMs, count: null, newest: null, verdict: "error", note: `redirect → ${res.headers.get("location") ?? "?"} (not followed)` };
    }
    if (res.status === 403 || res.status === 429) return { ...base, http: res.status, latencyMs, count: null, newest: null, verdict: "blocked", note: "origin refused (circuit would open)" };
    if (!res.ok) return { ...base, http: res.status, latencyMs, count: null, newest: null, verdict: "error", note: "" };
    const buf = new Uint8Array(await res.arrayBuffer());
    const parsed = parseBody(src.format, buf.subarray(0, 5 * 1024 * 1024), res.headers.get("content-type"));
    const verdict = !parsed.recognized ? "parse-fail" : parsed.count === 0 ? "empty" : "ok";
    return { ...base, http: res.status, latencyMs, count: parsed.count, newest: parsed.newest, verdict, note: "" };
  } catch (err) {
    const cause = err?.cause?.code || err?.cause?.message || err?.message || String(err);
    return { ...base, http: "—", latencyMs: Date.now() - started, count: null, newest: null, verdict: "blocked", note: `network: ${cause}` };
  }
}

async function runAll(list) {
  const byHost = new Map();
  for (const src of list) {
    let host = "(none)";
    try {
      host = new URL(fill(src.probeUrl ?? src.url ?? "https://none.invalid")).hostname;
    } catch {
      /* keep */
    }
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(src);
  }
  const results = [];
  const queues = [...byHost.values()];
  const workers = Array.from({ length: 4 }, async () => {
    while (queues.length) {
      const q = queues.shift();
      for (const src of q) {
        results.push(await probe(src));
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  });
  await Promise.all(workers);
  const order = new Map(list.map((s, i) => [s.id, i]));
  return results.sort((a, b) => order.get(a.id) - order.get(b.id));
}

const targets = [
  ...SOURCE_REGISTRY.filter((s) => s.enabled || s.status === "candidate"),
  ...PUBLIC_RESEARCH_CANDIDATES.map((c) => ({ ...c, kind: "research", format: "html", enabled: false, status: "candidate", region: "GLOBAL" })),
];
const results = await runAll(targets);
const counts = results.reduce((acc, r) => ((acc[r.verdict] = (acc[r.verdict] ?? 0) + 1), acc), {});
const attempted = results.filter((r) => r.verdict !== "skipped");
const blocked = attempted.filter((r) => r.verdict === "blocked" && /egress proxy|network/.test(r.note)).length;
const mode = attempted.length && blocked / attempted.length > 0.5 ? "OFFLINE-BUILD" : "LIVE-VERIFIED";
const at = new Date().toISOString();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ at, mode, counts, results }, null, 2));
}

const esc = (v) => String(v ?? "—").replace(/\|/g, "\\|");
const lines = [
  "# SOURCES_STATUS — environment probe",
  "",
  `Generated by \`npm run verify:sources\` at ${at}. One small GET per enabled or candidate source.`,
  "",
  `**Mode: ${mode}** — ${attempted.length} probed, ${blocked} blocked by network/egress policy. Verdicts: ${Object.entries(counts)
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ")}.`,
  "",
  mode === "OFFLINE-BUILD"
    ? "Every source stays `unverified` in the registry; the UI shows `소스 미검증`. Re-run this script on a machine with normal internet (or after switching the environment's network access to \"Full\"), then flip `enabled`/`status` in `src/server/feeds/registry.ts` for candidates that return `ok`."
    : "Enable candidates that return `ok`; fix or disable every enabled source in `error` or `parse-fail` (C1.6).",
  "",
  "| id | name | registry | enabled | HTTP | latency ms | items | newest publishedAt | verdict | note | URL |",
  "|---|---|---|---|---|---|---|---|---|---|---|",
  ...results.map(
    (r) =>
      `| ${esc(r.id)} | ${esc(r.name)} | ${esc(r.registryStatus)} | ${r.enabled ? "yes" : "no"} | ${esc(r.http)} | ${esc(r.latencyMs)} | ${esc(r.count)} | ${esc(r.newest)} | **${esc(r.verdict)}** | ${esc(r.note)} | ${esc(r.url)} |`,
  ),
  "",
  "Verdicts: `ok` parsed ≥ 1 item · `empty` valid format, 0 items · `blocked` network/egress deny or origin 403/429 · `error` other HTTP status/redirect · `parse-fail` unexpected body · `skipped` no probe URL or required env missing.",
  "",
];
writeFileSync(join(root, "docs/upgrade/SOURCES_STATUS.md"), lines.join("\n"));
console.log(`verify:sources → ${mode}; ${JSON.stringify(counts)}; wrote docs/upgrade/SOURCES_STATUS.md`);
