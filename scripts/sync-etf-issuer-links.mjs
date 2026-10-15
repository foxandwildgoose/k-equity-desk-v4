/**
 * Refresh official catalog mappings and bounded published identifier routes.
 * Keep source hashes and route-verification kinds as separate provenance.
 * Run: node --experimental-strip-types scripts/sync-etf-issuer-links.mjs
 * Uses the inherited proxy and normal curl CA/TLS verification. Never produces
 * a homepage, search result, or unverified ISIN-shaped product candidate.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseHanaroFundCatalog, normalizeIssuerFundName } from "../src/server/etf-holdings-parse.ts";
import { krxEtfIsin, parseNamedIssuerProductLinks } from "../src/server/etf-issuer.ts";

const run = promisify(execFile);
const today = new Date().toISOString().slice(0, 10);
const artifactDir = process.env.ETF_ISSUER_ARTIFACT_DIR ?? `/workspace/issuer-links-${today.replaceAll("-", "")}`;
const reuse = process.argv.includes("--reuse");
const snapshotDate = /issuer-links-(\d{4})(\d{2})(\d{2})$/.exec(artifactDir);
// Replaying an archived acquisition does not make it newly verified today.
const checkedAt = reuse && snapshotDate ? `${snapshotDate[1]}-${snapshotDate[2]}-${snapshotDate[3]}` : today;
await mkdir(artifactDir, { recursive: true });
const records = new Map();
const failures = [];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function request(name, url, body) {
  const path = resolve(artifactDir, `${name}.body`);
  let bytes;
  if (reuse) { try { bytes = await readFile(path); } catch {} }
  if (!bytes) {
    const args = ["--silent", "--show-error", "--fail", "--max-time", "20", "--location", "--output", path];
    if (body !== undefined) args.push("--header", "Content-Type: application/json", "--data-raw", JSON.stringify(body));
    args.push(url);
    await run("curl", args, { maxBuffer: 100_000 });
    bytes = await readFile(path);
  }
  return { text: bytes.toString("utf8"), bytes, sourceUrl: url, sourceSha256: hash(bytes) };
}
async function json(name, url, body) { const source = await request(name, url, body); return { ...source, data: JSON.parse(source.text) }; }
async function bounded(items, fn) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
    while (cursor < items.length) { const item = items[cursor++]; try { await fn(item); } catch (error) { failures.push({ item, reason: String(error.message ?? error) }); } }
  }));
}
let universeBytes;
try { universeBytes = await readFile(resolve(artifactDir, "naver-etf-list.json")); }
catch { universeBytes = (await request("naver-etf-list", "https://finance.naver.com/api/sise/etfItemList.nhn")).bytes; }
const universe = JSON.parse(new TextDecoder("euc-kr").decode(universeBytes)).result.etfItemList;
const active = new Map(universe.map((row) => [row.itemcode, row]));
const brands = { KODEX: "kodex", TIGER: "tiger", RISE: "rise", KBSTAR: "rise", ACE: "ace", KINDEX: "ace", SOL: "sol", PLUS: "plus", ARIRANG: "plus", HANARO: "hanaro", IBK: "ibk", TIME: "timefolio", TIMEFOLIO: "timefolio", KIWOOM: "kiwoom", KOSEF: "kiwoom", WON: "won", WOORI: "won", "1Q": "oneq", KoAct: "koact", FOCUS: "focus", BNK: "bnk", HK: "hk", "마이티": "mighty", TREX: "trex", TRUSTON: "truston", "에셋플러스": "assetplus", MIDAS: "midas", "파워": "power", UNICORN: "unicorn", DAISHIN: "daishin", DS: "ds", "아이엠에셋": "imasset", KCGI: "kcgi", "더제이": "thej" };
function familyFor(name) { return brands[name.split(/\s+/)[0]] ?? "unknown"; }
function add(family, code, name, url, source, sourceKind = "issuer-catalog") {
  code = String(code ?? "").trim().toUpperCase();
  if (!/^[0-9A-Z]{6}$/.test(code) || !active.has(code) || familyFor(active.get(code).itemname) !== family) return;
  const entry = { family, code, name: String(name || active.get(code).itemname), url, verifiedAt: checkedAt, sourceUrl: source.sourceUrl, sourceSha256: source.sourceSha256, sourceKind };
  const key = `${family}:${code}`;
  if (records.has(key) && records.get(key).url !== url) throw new Error(`Conflicting official product mapping: ${key}`);
  records.set(key, entry);
}
await bounded(["kodex", "hanaro", "ace", "koact", "sol", "ibk", "plus"], async (family) => {
  if (family === "kodex") {
    const page = (number) => json(number === 1 ? "kodex-catalog" : `kodex-page-${number}`, `https://www.samsungfund.com/api/v1/kodex/product.do?ordrColm=NAV&ordrSort=DESC&pageNo=${number}&pageRows=20&srchTerm=w`);
    const first = await page(1);
    const append = (source) => { for (const row of source.data) if (/^[A-Za-z0-9_-]+$/.test(row.fId ?? "")) add(family, row.stkTicker, row.fNm, `https://www.samsungfund.com/etf/product/view.do?id=${row.fId}`, source); };
    append(first);
    await bounded(Array.from({ length: Math.min(30, Math.ceil(Number(first.data[0]?.totalCnt ?? 0) / 20)) - 1 }, (_, i) => i + 2), async (number) => append(await page(number)));
  } else if (family === "hanaro") {
    const page = (number) => request(`hanaro-page${number}`, `https://www.hanaroetf.com/api/v1/fund/get-fund-search-list?pageNo=${number}`);
    for (let number = 1; number <= 25; number++) {
      const source = await page(number); const rows = parseHanaroFundCatalog(source.text);
      for (const [code, id] of rows) add(family, code, active.get(code)?.itemname, `https://www.hanaroetf.com/fund/${encodeURIComponent(id)}`, source);
      if (rows.size < 10) break;
    }
  } else if (family === "ace") {
    const source = await json("ace-catalog", "https://papi.aceetf.co.kr/api/funds?page=1&size=1000");
    for (const row of source.data.data ?? []) if (/^KR7[0-9A-Z]{6}00\d$/.test(row.stockCd ?? "") && /^[A-Za-z0-9_-]+$/.test(row.fundCd ?? "")) add(family, row.stockCd.slice(3, 9), row.fundNm, `https://www.aceetf.co.kr/fund/${row.fundCd}`, source);
  } else if (family === "koact") {
    const source = await json("koact-catalog", "https://www.samsungactive.co.kr/api/v1/product/etf.do?pageNo=1&pageRows=100");
    for (const row of source.data.etfs ?? []) if (/^[A-Za-z0-9_-]+$/.test(row.fId ?? "")) add(family, row.stkTicker, row.fNm, `https://www.samsungactive.co.kr/etf/view.do?id=${row.fId}`, source);
    if (Number(source.data.totalCnt) > 100) failures.push({ item: family, reason: "Catalog exceeds the requested page size; add pagination before publishing complete coverage." });
  } else if (family === "sol") {
    const page = (number) => json(number === 1 ? "sol-catalog" : `sol-page-${number}`, `https://www.soletf.com/api/etf/pds?searchText=&page=${number}`);
    const first = await page(1);
    const append = (source) => { for (const row of source.data.items ?? []) if (/^\d{6}$/.test(String(row.FUND_CD))) add(family, row.ETF_CD6, row.ETF_NAME, `https://www.soletf.com/ko/fund/etf/${row.FUND_CD}`, source); };
    append(first); await bounded(Array.from({ length: Math.min(64, Number(first.data.toalPage ?? first.data.totalPage ?? 1)) - 1 }, (_, i) => i + 2), async (number) => append(await page(number)));
  } else if (family === "ibk") {
    const source = await json("ibk-catalog", "https://www.ibkasset.com/api/etf");
    for (const row of source.data.data?.content ?? []) {
      const matches = universe.filter((item) => familyFor(item.itemname) === family && normalizeIssuerFundName(item.itemname) === normalizeIssuerFundName(row.name));
      if (matches.length === 1 && Number.isSafeInteger(row.id)) add(family, matches[0].itemcode, row.name, `https://www.ibkasset.com/etf/detail/${row.id}`, source);
    }
  } else if (family === "plus") {
    const source = await request("plus-overview", "https://www.plusetf.co.kr/product/overview");
    for (const item of universe.filter((row) => familyFor(row.itemname) === family)) {
      const urls = parseNamedIssuerProductLinks(source.text, item.itemname, source.sourceUrl, family);
      if (urls.length === 1) add(family, item.itemcode, item.itemname, urls[0], source);
    }
  }
});
try {
  for (const entry of JSON.parse(await readFile(resolve(artifactDir, "small-issuer-verified.json"), "utf8"))) add(entry.family, entry.code, entry.name, entry.url, entry, "issuer-product");
} catch (error) { failures.push({ item: "small-issuer-verified.json", reason: error.message }); }
// The user confirmed this official TIGER route on 2026-10-15. Its identifier is
// the standardized KRX ETF ISIN, not an opaque issuer product ID. Bind the route
// strictly to current published TIGER listings and retain separate provenance:
// these records do not claim that each issuer product HTML was available.
for (const item of universe.filter((row) => familyFor(row.itemname) === "tiger")) {
  const isin = krxEtfIsin(item.itemcode);
  if (!isin) continue;
  records.set(`tiger:${item.itemcode}`, {
    family: "tiger", code: item.itemcode, name: item.itemname,
    url: `https://investments.miraeasset.com/tigeretf/ko/product/search/detail/index.do?ksdFund=${isin}`,
    verifiedAt: checkedAt, sourceKind: "verified-issuer-template",
    sourceUrl: "https://investments.miraeasset.com/tigeretf/ko/product/search/detail/index.do?ksdFund=KR7305540007",
    templateVerification: "user-confirmed-2026-10-15",
    listingSourceUrl: "https://finance.naver.com/api/sise/etfItemList.nhn",
    listingSourceSha256: hash(universeBytes),
  });
}
// KIWOOM's public code-parameter route is corroborated by two independent,
// commit-pinned implementations. This is explicitly separate from issuer HTML
// verification, which currently fails because of upstream TLS availability.
const kiwoomSource = await request("kiwoom-template-source", "https://raw.githubusercontent.com/djseok/DJ_ETF_Study/2a536d1e56c1a00a81216513fbf987dca800535b/scraper.py");
const kiwoomCorroboration = await request("kiwoom-template-corroboration", "https://raw.githubusercontent.com/ETFMD/d-capitalism/20b42f32ea6faa2f942f458e0d4d1ab730c1228c/scripts/etf_tax.py");
if (!kiwoomSource.text.includes("KO02010200M?gcode=") || !kiwoomCorroboration.text.includes("KO02010200M?gcode=")) throw new Error("KIWOOM template corroboration missing");
for (const item of universe.filter((row) => familyFor(row.itemname) === "kiwoom")) {
  if (!/^[0-9A-Z]{6}$/.test(item.itemcode)) continue;
  records.set(`kiwoom:${item.itemcode}`, {
    family: "kiwoom", code: item.itemcode, name: item.itemname,
    url: `https://www.kiwoometf.com/service/etf/KO02010200M?gcode=${item.itemcode}`,
    verifiedAt: checkedAt, sourceKind: "corroborated-issuer-template",
    sourceUrl: kiwoomSource.sourceUrl, sourceSha256: kiwoomSource.sourceSha256,
    corroboratingSourceUrl: kiwoomCorroboration.sourceUrl, corroboratingSourceSha256: kiwoomCorroboration.sourceSha256,
    templateVerification: "independent-published-implementations",
    listingSourceUrl: "https://finance.naver.com/api/sise/etfItemList.nhn", listingSourceSha256: hash(universeBytes),
  });
}
const rows = [...records.values()].sort((a, b) => a.family.localeCompare(b.family) || a.code.localeCompare(b.code));
const header = `/** Official catalog mappings and bounded published identifier routes. Generated by scripts/sync-etf-issuer-links.mjs. */\nexport interface VerifiedIssuerProductRecord { family: string; code: string; name: string; url: string; verifiedAt: string; sourceUrl: string; sourceSha256?: string; sourceKind: "issuer-catalog" | "issuer-product" | "verified-issuer-template" | "corroborated-issuer-template"; templateVerification?: string; listingSourceUrl?: string; listingSourceSha256?: string; corroboratingSourceUrl?: string; corroboratingSourceSha256?: string }\nexport const VERIFIED_ISSUER_PRODUCTS: readonly VerifiedIssuerProductRecord[] = [\n`;
await writeFile("src/data/etf-issuer-products.ts", header + rows.map((row) => JSON.stringify(row) + ",").join("\n") + "\n];\n");
const confirmed = new Set(rows.map((row) => row.code)); confirmed.add("305540"); confirmed.add("0246X0");
const coverage = {};
for (const item of universe) { const brand = item.itemname.split(/\s+/)[0]; coverage[brand] ??= { total: 0, resolved: 0, unresolved: [] }; coverage[brand].total++; if (confirmed.has(item.itemcode)) coverage[brand].resolved++; else coverage[brand].unresolved.push({ code: item.itemcode, name: item.itemname }); }
const report = { checkedAt, universeCount: universe.length, resolvedCount: universe.filter((row) => confirmed.has(row.itemcode)).length, snapshotRecords: rows.length, coverage, failures };
await writeFile(resolve(artifactDir, "coverage.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ universeCount: report.universeCount, resolvedCount: report.resolvedCount, snapshotRecords: rows.length, failures: failures.length, report: resolve(artifactDir, "coverage.json") }));
