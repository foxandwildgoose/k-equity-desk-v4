import assert from "node:assert/strict";
import { test } from "node:test";
import { createCustomsTradeClient } from "./customs-trade.ts";

const KEY = "deliberateCustomsFixture+/==";
const NOW = Date.parse("2026-10-21T00:00:00Z");
type Fields = Record<string, string | number>;
function escape(value: string | number) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function xml(rows: Fields[], options: { code?: string; count?: number; page?: number; size?: number } = {}) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><response><header><resultCode>${options.code ?? "00"}</resultCode><resultMsg>NORMAL SERVICE</resultMsg></header><body><items>${rows.map((row) => `<item>${Object.entries(row).map(([key, value]) => `<${key}>${escape(value)}</${key}>`).join("")}</item>`).join("")}</items><numOfRows>${options.size ?? 1000}</numOfRows><pageNo>${options.page ?? 1}</pageNo><totalCount>${options.count ?? rows.length}</totalCount></body></response>`, { headers: { "content-type": "application/xml" } });
}
const total = (year = "2026.09", expDlr = "1000000", impDlr = "500000") => ({ year, expDlr, impDlr });
const country = (statCd: string, expDlr: string, statCdCntnKor1 = statCd) => ({ ...total("2026.09", expDlr, "100"), statCd, statCdCntnKor1 });
function months(url: URL): string[] {
  const start = url.searchParams.get("strtYymm")!;
  const end = url.searchParams.get("endYymm")!;
  const result: string[] = [];
  for (let month = Number(start.slice(4)); month <= Number(end.slice(4)); month++) result.push(`${start.slice(0, 4)}.${String(month).padStart(2, "0")}`);
  return result;
}
function fixture(handle: (url: URL, init?: RequestInit) => Response | Promise<Response>, options: { key?: () => string | undefined; now?: () => number; timeoutMs?: number; budgetMs?: number; maxPages?: number; maxRequests?: number } = {}) {
  const urls: URL[] = [];
  const client = createCustomsTradeClient({ ...options, getKey: options.key ?? (() => KEY), now: options.now ?? (() => NOW), fetch: (async (input, init) => {
    const url = new URL(String(input));
    urls.push(url);
    assert.equal(url.origin, "https://apis.data.go.kr");
    assert.equal(url.searchParams.get("serviceKey"), options.key?.()?.includes("%") ? decodeURIComponent(options.key()!) : options.key?.() ?? KEY);
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.method, undefined);
    return handle(url, init);
  }) as typeof fetch });
  return { ...client, urls };
}
const isTotal = (url: URL) => url.pathname === "/1220000/Newtrade/getNewtradeList";
const isCountry = (url: URL) => url.pathname === "/1220000/nationtrade/getNationtradeList";

test("no key is an immediate missing-key response with no network; invalid format is safe", async () => {
  for (const key of [undefined, "", "bad fixture secret"] ) {
    const client = fixture(() => { throw new Error("must not request"); }, { key: () => key });
    const result = await client.fetchCustomsTrade();
    assert.equal(client.urls.length, 0);
    assert.equal(result.providers[0].state, key ? "invalid-key" : "missing-key");
    assert.deepEqual(result.exports, []);
    assert.equal(result.providers.every((p) => p.configured === !!key), true);
    assert.equal(JSON.stringify(result).includes("bad fixture secret"), false);
  }
});

test("exact total/country protocols preserve raw USD and exclude grand totals", async () => {
  const client = fixture((url) => isTotal(url)
    ? xml([total("2026.09", "1,000,000"), total("총계", "999999999"), total("2026", "999999999")], { code: "0000" })
    : xml([country("US", "600000", "미국"), country("CN", "400000", "중국"), country("총계", "1000000", "총계")]));
  const result = await client.fetchCustomsTrade({ months: 1 });
  assert.deepEqual(result.exports, [{ period: "2026-09", valueUsd: 1000000 }]);
  assert.deepEqual(result.imports, [{ period: "2026-09", valueUsd: 500000 }]);
  assert.deepEqual(result.destinations.rows.map((r) => [r.partnerCode, r.name, r.valueUsd, r.share]), [["US", "미국", 600000, 0.6], ["CN", "중국", 400000, 0.4]]);
  assert.equal(result.destinations.period, "2026-09");
  assert.equal(result.providers.every((p) => p.state === "ok" && p.asOf === "2026-09"), true);
  assert.equal(client.urls[0].searchParams.get("strtYymm"), "202609");
  assert.equal(client.urls[0].searchParams.get("endYymm"), "202609");
  assert.equal(client.urls[1].searchParams.has("cntyCd"), false);
  assert.equal(JSON.stringify(result).includes(KEY), false);
  assert.equal(JSON.stringify(result).includes("serviceKey"), false);
});

test("120 monthly observations use completed KST months in <=12-month calendar blocks", async () => {
  const client = fixture((url) => isTotal(url) ? xml(months(url).map((p) => total(p))) : xml([]), { now: () => Date.parse("2026-09-30T15:01:00Z") });
  const result = await client.fetchCustomsTrade({ months: 120 });
  assert.equal(result.exports.length, 120);
  assert.equal(result.exports[0].period, "2016-10");
  assert.equal(result.exports.at(-1)?.period, "2026-09");
  for (const url of client.urls.filter(isTotal)) {
    assert.equal(url.searchParams.get("strtYymm")!.slice(0, 4), url.searchParams.get("endYymm")!.slice(0, 4));
    assert.ok(months(url).length <= 12);
  }
  assert.equal(client.urls.filter(isTotal).length, 11);
  assert.equal(client.urls.some((url) => url.pathname.includes("Itemtrade")), false);
});

test("category requests only exact constituent national HS codes; child rows are never summed", async () => {
  const client = fixture((url) => {
    assert.equal(url.pathname, "/1220000/Itemtrade/getItemtradeList");
    const hs = url.searchParams.get("hsSgn")!;
    return xml([{ ...total("2026.09", hs === "8541" ? "100" : "200"), hsCd: hs }, { ...total("2026.09", "9999"), hsCd: `${hs}10` }]);
  });
  const result = await client.fetchCustomsTrade({ months: 1, categoryId: "semiconductors" });
  assert.deepEqual(client.urls.map((u) => u.searchParams.get("hsSgn")).sort(), ["8541", "8542"]);
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].valueUsd, 300);
  assert.equal(result.observations[0].classification, "HS");
  assert.equal(result.providers[0].state, "ok");
  assert.deepEqual(result.exports, []);
});

test("missing constituent is never zero and never creates a partial category total", async () => {
  const client = fixture((url) => url.searchParams.get("hsSgn") === "8541" ? xml([{ ...total("2026.09", "100"), hsCd: "8541" }]) : xml([]));
  const result = await client.fetchCustomsTrade({ months: 1, categoryId: "semiconductors" });
  assert.deepEqual(result.observations, []);
  assert.equal(result.providers[0].state, "empty");
  const unknown = await client.fetchCustomsTrade({ categoryId: "invented-category" });
  assert.equal(unknown.providers[0].state, "unverified");
  assert.equal(client.urls.length, 2);
});

test("direct HS2 and HS4 category IDs query their exact codes and preserve the selected ID", async () => {
  for (const [categoryId, code] of [["hs2:85", "85"], ["hs4:8542", "8542"]]) {
    const client = fixture((url) => {
      assert.equal(url.pathname, "/1220000/Itemtrade/getItemtradeList");
      assert.equal(url.searchParams.get("hsSgn"), code);
      return xml([{ ...total("2026.09", "12345"), hsCd: code }]);
    });
    const result = await client.fetchCustomsTrade({ months: 1, categoryId });
    assert.equal(client.urls.length, 1);
    assert.equal(result.observations[0].categoryId, categoryId);
    assert.equal(result.observations[0].valueUsd, 12345);
    assert.equal(result.providers[0].state, "ok");
  }
  const invalid = fixture(() => { throw new Error("must not request an invalid direct HS code"); });
  for (const categoryId of ["hs2:8542", "hs4:85", "hs4:abcd", "hs2:85/../"]) {
    const result = await invalid.fetchCustomsTrade({ months: 1, categoryId });
    assert.equal(result.providers[0].state, "unverified");
  }
  assert.equal(invalid.urls.length, 0);
});

test("HS, country, period and duplicate identities fail closed", async () => {
  const cases: Fields[][] = [
    [{ ...total(), hsCd: "8708" }],
    [{ ...total(), hsCd: "8507", statCd: "US" }],
    [{ ...total("2026.10"), hsCd: "8507" }],
    [{ ...total("2026.09", "100"), hsCd: "8507" }, { ...total("2026.09", "200"), hsCd: "8507" }],
  ];
  for (const rows of cases) {
    const result = await fixture(() => xml(rows)).fetchCustomsTrade({ months: 1, categoryId: "secondary_batteries" });
    assert.equal(result.observations.length, 0);
    assert.equal(result.providers[0].state, "unavailable");
  }
});

test("pagination consumes every page before publishing and deduplicates identical records within a page", async () => {
  const client = fixture((url) => {
    if (isCountry(url)) return xml([]);
    const page = Number(url.searchParams.get("pageNo"));
    return xml([total(page === 1 ? "2026.08" : "2026.09")], { page, size: 1, count: 2 });
  });
  const result = await client.fetchCustomsTrade({ months: 2 });
  assert.equal(client.urls.filter(isTotal).length, 2);
  assert.equal(result.exports.length, 2);
  assert.equal(result.exports[0].valueUsd, 1000000);
  const duplicate = await fixture((url) => isTotal(url) ? xml([total(), total()]) : xml([])).fetchCustomsTrade({ months: 1 });
  assert.equal(duplicate.exports.length, 1);
});

test("truncated pagination, page limits and changing counts never publish a partial block", async () => {
  for (const mode of ["short", "limit", "changed", "repeated"] as const) {
    const client = fixture((url) => {
      if (isCountry(url)) return xml([]);
      const page = Number(url.searchParams.get("pageNo"));
      return xml([total()], { page, count: mode === "changed" && page === 2 ? 3 : 2, size: mode === "short" ? 1000 : 1 });
    }, { maxPages: mode === "limit" ? 1 : 8 });
    const result = await client.fetchCustomsTrade({ months: 1 });
    assert.equal(result.exports.length, 0);
    assert.equal(result.providers[0].state, "unavailable");
    assert.equal(result.providers[0].reasonCode, mode === "short" ? "TRUNCATED_RESPONSE" : mode === "limit" ? "PAGE_LIMIT" : mode === "changed" ? "PAGINATION_CHANGED" : "REPEATED_PAGE");
  }
});

test("country percentages require a verified same-month world denominator", async () => {
  for (const conflict of [false, true]) {
    const client = fixture((url) => isTotal(url) ? xml([total()]) : xml(conflict ? [country("US", "600000"), country("US", "700000")] : [country("US", "2000000")]));
    const result = await client.fetchCustomsTrade({ months: 1 });
    assert.equal(result.exports.length, 1);
    if (conflict) {
      assert.equal(result.destinations.rows.length, 0);
      assert.equal(result.providers[1].reasonCode, "CONFLICTING_DUPLICATE");
    } else {
      assert.equal(result.destinations.rows[0].share, null);
      assert.equal(result.providers[1].state, "partial");
      assert.equal(result.providers[1].reasonCode, "WORLD_DENOMINATOR_UNVERIFIED");
    }
  }
  const incomplete = await fixture((url) => isTotal(url) ? xml([total()]) : xml([country("US", "600000")])).fetchCustomsTrade({ months: 1 });
  assert.equal(incomplete.destinations.rows[0].share, null);
  assert.equal(incomplete.providers[1].reasonCode, "WORLD_DENOMINATOR_UNVERIFIED");
});

test("Encoding-form keys are encoded once; failures never echo credentials, URLs or gateway messages", async () => {
  const client = fixture(() => { throw new Error(`transport failed for https://apis.data.go.kr/?serviceKey=${KEY}`); }, { key: () => encodeURIComponent(KEY) });
  const result = await client.fetchCustomsTrade({ months: 1 });
  assert.equal(client.urls[0].searchParams.get("serviceKey"), KEY);
  assert.equal(client.urls[0].href.includes("%252B"), false);
  assert.equal(JSON.stringify(result).includes(KEY), false);
  assert.equal(JSON.stringify(result).includes(encodeURIComponent(KEY)), false);
  assert.equal(JSON.stringify(result).includes("transport failed"), false);
  for (const [code, state, reason] of [["20", "invalid-key", "SERVICE_NOT_APPROVED"], ["22", "rate-limited", "API_QUOTA"], ["30", "invalid-key", "KEY_NOT_REGISTERED"], ["32", "invalid-key", "IP_NOT_APPROVED"]]) {
    const bad = fixture(() => new Response(`<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>${code}</returnReasonCode><errMsg>${escape(KEY)}</errMsg></cmmMsgHeader></OpenAPI_ServiceResponse>`));
    const error = await bad.fetchCustomsTrade({ months: 1 });
    assert.equal(error.providers[0].state, state);
    assert.equal(error.providers[0].reasonCode, reason);
    assert.equal(JSON.stringify(error).includes(KEY), false);
  }
});

test("DOCTYPE/entities, malformed XML, invalid count, malformed dollar values and oversized responses are rejected", async () => {
  const cases = [
    () => new Response('<!DOCTYPE response [<!ENTITY x SYSTEM "file:///etc/passwd">]><response>&x;</response>'),
    () => new Response("<response><broken></response>"),
    () => xml([total()], { count: 100000 }),
    () => xml([total("2026.09", "1abc234")]),
    () => new Response("never read", { headers: { "content-length": "999999999" } }),
  ];
  for (const create of cases) {
    const result = await fixture(() => create()).fetchCustomsTrade({ months: 1 });
    assert.equal(result.exports.length, 0);
    assert.equal(result.providers[0].state, "unavailable");
  }
});

test("request timeouts abort and finish even if a transport ignores the signal", { timeout: 10_000 }, async () => {
  const signals: AbortSignal[] = [];
  const client = fixture((_url, init) => { signals.push(init!.signal!); return new Promise<Response>(() => {}); }, { timeoutMs: 10, budgetMs: 25 });
  const result = await client.fetchCustomsTrade({ months: 1 });
  assert.equal(result.providers[0].reasonCode, "REQUEST_TIMEOUT");
  assert.equal(signals.every((signal) => signal.aborted), true);
});

test("per-request count is bounded; only complete observed constituent months are returned", async () => {
  const client = fixture((url) => xml(months(url).map((p) => ({ ...total(p, "100"), hsCd: url.searchParams.get("hsSgn")! }))), { maxRequests: 2 });
  const result = await client.fetchCustomsTrade({ months: 36, categoryId: "semiconductors" });
  assert.equal(client.urls.length, 2);
  assert.equal(result.observations.length, 9);
  assert.equal(result.observations[0].period, "2026-01");
  assert.equal(result.observations[0].valueUsd, 200);
  assert.equal(result.providers[0].state, "partial");
  assert.equal(result.providers[0].reasonCode, "REQUEST_BUDGET");
});

test("bounded caches and single flight reuse results, return copies and segregate rotated keys", async () => {
  let key = KEY;
  let current = NOW;
  const client = fixture((url) => isTotal(url) ? xml([total()]) : xml([]), { key: () => key, now: () => current });
  const [one, two] = await Promise.all([client.fetchCustomsTrade({ months: 1 }), client.fetchCustomsTrade({ months: 1 })]);
  assert.equal(client.urls.length, 2);
  one.exports[0].valueUsd = 77;
  assert.equal(two.exports[0].valueUsd, 1000000);
  assert.equal((await client.fetchCustomsTrade({ months: 1 })).exports[0].valueUsd, 1000000);
  assert.equal(client.urls.length, 2);
  current += 61_000;
  await client.fetchCustomsTrade({ months: 1 });
  assert.equal(client.urls.filter(isTotal).length, 1); // Nonempty blocks are cached; empty publication is rechecked.
  assert.equal(client.urls.filter(isCountry).length, 2);
  key = "rotatedFixtureCustoms==";
  await client.fetchCustomsTrade({ months: 1 });
  assert.equal(client.urls.filter(isTotal).length, 2);
});
