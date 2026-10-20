import assert from "node:assert/strict";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { createOpenDartClient } from "./opendart.ts";

const KEY = "a".repeat(40); // Deliberate fixture; never read a real credential in tests.
const SECOND_KEY = "b".repeat(40);
const NOW = Date.parse("2026-10-20T00:30:00Z");
const stockRow = {
  corp_code: "00126380", corp_name: "삼성전자", stock_code: "005930", corp_cls: "Y",
  report_nm: "주요사항보고서", rcept_no: "20261020000001", rcept_dt: "20261020", flr_nm: "삼성전자",
};

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
}

function archive(xml = "<result><list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><stock_code>005930</stock_code><modify_date>20261020</modify_date></list><list><corp_code>00164779</corp_code><stock_code>000660</stock_code></list><list><corp_code>00000001</corp_code><stock_code> </stock_code></list></result>") {
  return new Response(zipSync({ "CORPCODE.xml": strToU8(xml) }));
}

function fixture(handle: (url: URL, init?: RequestInit) => Response | Promise<Response>, opts: { key?: () => string | undefined; now?: () => number; timeoutMs?: number; discovery?: (url: URL, init?: RequestInit) => Response | Promise<Response> } = {}) {
  const urls: URL[] = [];
  const discoveryUrls: URL[] = [];
  const client = createOpenDartClient({
    fetch: (async (input, init) => {
      const url = new URL(String(input));
      if (url.origin === "https://dart.fss.or.kr") {
        assert.equal(url.pathname, "/dsab001/search.ax");
        assert.equal(init?.method, "POST");
        assert.equal(url.searchParams.has("crtfc_key"), false);
        assert.equal(String(init?.body).includes(KEY), false);
        discoveryUrls.push(url);
        // Existing archive fixtures deliberately exercise the bulk fallback branch.
        return opts.discovery?.(url, init) ?? new Response("fixture discovery unavailable", { status: 503 });
      }
      urls.push(url);
      assert.equal(url.origin, "https://opendart.fss.or.kr");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      return handle(url, init);
    }) as typeof fetch,
    getApiKey: opts.key ?? (() => KEY), now: opts.now ?? (() => NOW), timeoutMs: opts.timeoutMs,
  });
  return { ...client, urls, discoveryUrls };
}

test("missing/invalid keys never make a request or expose a secret", async () => {
  for (const key of [undefined, "", "short-fixture-secret"]) {
    const client = fixture(() => { throw new Error("must not fetch"); }, { key: () => key });
    const result = await client.fetchDisclosures();
    assert.equal(result.status.state, key ? "invalid-key" : "missing-key");
    assert.equal(result.status.reasonCode, key ? "KEY_INVALID_FORMAT" : "KEY_MISSING");
    assert.equal(result.status.configured, !!key);
    assert.equal(client.urls.length, 0);
    assert.equal(JSON.stringify(result).includes("short-fixture-secret"), false);
  }
});

test("market requests official KOSPI/KOSDAQ lists and preserves date-only metadata", async () => {
  const client = fixture((url) => {
    assert.equal(url.pathname, "/api/list.json");
    assert.equal(url.searchParams.get("page_count"), "100");
    assert.equal(url.searchParams.get("sort_mth"), "desc");
    return url.searchParams.get("corp_cls") === "Y"
      ? json({ status: "000", list: [stockRow] })
      : json({ status: "013", message: "조회된 데이터가 없습니다." });
  });
  const result = await client.fetchDisclosures();
  assert.equal(result.status.state, "ok");
  assert.equal(result.status.reasonCode, "API_OK");
  assert.equal(result.status.fallbackUsed, false);
  assert.equal(result.status.checkedAt, "2026-10-20T00:30:00.000Z");
  assert.equal(result.items[0].receiptDate, "2026-10-20");
  assert.equal(result.items[0].stockCode, "005930");
  assert.equal(result.items[0].corpCode, "00126380");
  assert.deepEqual(client.urls.map((url) => url.searchParams.get("corp_cls")).sort(), ["K", "Y"]);
  assert.equal(JSON.stringify(result).includes(KEY), false);
  assert.equal(JSON.stringify(result).includes("crtfc_key"), false);
});

test("company lookups use the exact leading-zero stock/corporation identifiers from official ZIP", async () => {
  const client = fixture((url) => {
    if (url.pathname === "/api/corpCode.xml") return archive();
    assert.equal(url.searchParams.get("corp_code"), "00126380");
    assert.equal(url.searchParams.has("corp_cls"), false);
    return json({ status: "000", list: [stockRow] });
  });
  const result = await client.fetchDisclosures({ stockCode: "005930" });
  assert.equal(result.status.state, "ok");
  assert.equal(client.urls.length, 2);
  assert.equal(client.urls[1].searchParams.get("bgn_de"), "20260622");
});

const discoveryHtml = (codes = ["00126380"]) => new Response(`<table>${codes.map((code) => `<tr><td><a href="javascript:openCorpInfoNew('${code}', '');">삼성전자</a></td></tr>`).join("")}</table>`);

test("code-only official discovery requires exact OpenDART company metadata and avoids the bulk archive", async () => {
  const client = fixture((url) => {
    if (url.pathname === "/api/company.json") {
      assert.equal(url.searchParams.get("corp_code"), "00126380");
      assert.equal(url.searchParams.get("crtfc_key"), KEY);
      return json({ status: "000", corp_code: "00126380", stock_code: "005930", corp_name: "삼성전자" });
    }
    assert.equal(url.pathname, "/api/list.json");
    return json({ status: "000", list: [stockRow] });
  }, { discovery: (_url, init) => {
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get("textCrpNm"), "005930");
    assert.equal(body.get("maxResults"), "30");
    assert.equal(body.get("startDate"), "2026-06-22");
    assert.equal(body.get("endDate"), "2026-10-20");
    return discoveryHtml(["00126380", "00126380"]);
  } });
  assert.equal((await client.fetchDisclosures({ stockCode: "005930" })).status.state, "ok");
  assert.equal(client.discoveryUrls.length, 1);
  assert.equal(client.urls.filter((url) => url.pathname === "/api/company.json").length, 1);
  assert.equal(client.urls.some((url) => url.pathname === "/api/corpCode.xml"), false);
});

test("discovery candidates with mismatched ticker or corporation metadata cannot authorize disclosure requests", async () => {
  for (const metadata of [{ status: "000", corp_code: "00126380", stock_code: "005935" }, { status: "000", corp_code: "99999999", stock_code: "005930" }]) {
    const client = fixture((url) => url.pathname === "/api/company.json" ? json(metadata) : new Response("bulk fallback unavailable", { status: 503 }), { discovery: () => discoveryHtml() });
    const result = await client.fetchDisclosures({ stockCode: "005930" });
    assert.equal(result.status.state, "unavailable");
    assert.equal(result.status.reasonCode, "CORP_REQUEST_HTTP");
    assert.equal(result.status.resolutionReasonCode, "COMPANY_IDENTITY_INVALID");
    assert.equal(client.urls.some((url) => url.pathname === "/api/list.json"), false);
  }
});

test("multiple officially verified company matches remain ambiguous without first-match guessing", async () => {
  const client = fixture((url) => json({ status: "000", corp_code: url.searchParams.get("corp_code"), stock_code: "005930" }), { discovery: () => discoveryHtml(["00126380", "99999999"]) });
  const result = await client.fetchDisclosures({ stockCode: "005930" });
  assert.equal(result.status.state, "company-not-found");
  assert.equal(result.status.reasonCode, "COMPANY_MAPPING_AMBIGUOUS");
  assert.equal(client.urls.length, 2);
  assert.equal(client.urls.every((url) => url.pathname === "/api/company.json"), true);
});

test("lightweight company mapping is singleflight across different list windows and cached for twelve hours", async () => {
  let time = NOW;
  const client = fixture(async (url) => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    return url.pathname === "/api/company.json" ? json({ status: "000", corp_code: "00126380", stock_code: "005930" }) : json({ status: "000", list: [stockRow] });
  }, { discovery: () => discoveryHtml(), now: () => time });
  await Promise.all([client.fetchDisclosures({ stockCode: "005930", days: 120 }), client.fetchDisclosures({ stockCode: "005930", days: 30 })]);
  assert.equal(client.discoveryUrls.length, 1);
  assert.equal(client.urls.filter((url) => url.pathname === "/api/company.json").length, 1);
  time += 90_001;
  await client.fetchDisclosures({ stockCode: "005930" });
  assert.equal(client.discoveryUrls.length, 1);
  time += 12 * 60 * 60 * 1_000;
  await client.fetchDisclosures({ stockCode: "005930" });
  assert.equal(client.discoveryUrls.length, 2);
});

test("an authentication failure in company metadata preserves its safe status and never downloads the archive", async () => {
  const client = fixture(() => json({ status: "010", message: KEY }), { discovery: () => discoveryHtml() });
  const result = await client.fetchDisclosures({ stockCode: "005930" });
  assert.equal(result.status.state, "invalid-key");
  assert.equal(result.status.reasonCode, "API_INVALID_KEY");
  assert.equal(client.urls.length, 1);
  assert.equal(JSON.stringify(result).includes(KEY), false);
});

test("official alphanumeric KRX stock codes use the same exact corporation mapping", async () => {
  const row = { ...stockRow, stock_code: "0246X0" };
  const client = fixture((url) => url.pathname === "/api/corpCode.xml"
    ? archive("<result><list><corp_code>00126380</corp_code><stock_code>0246X0</stock_code></list></result>")
    : json({ status: "000", list: [row] }));
  assert.equal((await client.fetchDisclosures({ stockCode: "0246X0" })).items[0].stockCode, "0246X0");
  const market = fixture(() => json({ status: "000", list: [row] }));
  assert.equal((await market.fetchDisclosures()).status.state, "ok");
});

test("an unmapped or preferred stock does not guess a company by name or ticker prefix", async () => {
  const client = fixture(() => archive());
  const result = await client.fetchDisclosures({ stockCode: "005935" });
  assert.equal(result.status.state, "company-not-found");
  assert.equal(client.urls.length, 1);
});

test("status 013 is an authenticated empty result, not a provider failure", async () => {
  const client = fixture(() => json({ status: "013" }));
  const result = await client.fetchDisclosures();
  assert.equal(result.status.state, "empty");
  assert.equal(result.status.reasonCode, "API_EMPTY");
  assert.equal(result.status.configured, true);
  assert.deepEqual(result.items, []);
});

test("provider error statuses produce fixed, safe messages", async () => {
  const statuses: [string, string][] = [["010", "invalid-key"], ["011", "invalid-key"], ["012", "invalid-key"], ["901", "invalid-key"], ["020", "rate-limited"], ["021", "invalid-request"], ["100", "invalid-request"], ["101", "invalid-request"], ["800", "unavailable"], ["900", "unavailable"], ["999", "unavailable"]];
  for (const [provider, expected] of statuses) {
    const client = fixture(() => json({ status: provider, message: `secret=${KEY}` }));
    const result = await client.fetchDisclosures();
    assert.equal(result.status.state, expected);
    assert.equal(JSON.stringify(result).includes(KEY), false);
  }
});

test("XML errors returned in place of a corporation ZIP preserve authentication/limit states", async () => {
  for (const [code, state] of [["010", "invalid-key"], ["020", "rate-limited"]]) {
    const client = fixture(() => new Response(`<result><status>${code}</status><message>${KEY}</message></result>`));
    const result = await client.fetchDisclosures({ stockCode: "005930" });
    assert.equal(result.status.state, state);
    assert.equal(JSON.stringify(result).includes(KEY), false);
  }
});

test("malformed dates, future receipts, and mismatched identities are rejected", async () => {
  const corrupt = [
    { rcept_dt: "20260230", rcept_no: "20260230000001" },
    { rcept_dt: "20261021", rcept_no: "20261021000001" },
    { rcept_dt: "20261020", rcept_no: "20261019000001" },
    { corp_code: "126380" }, { stock_code: "5930" }, { corp_cls: "BAD" },
    { report_nm: "" }, { flr_nm: "" }, { corp_code: "00164779" }, { stock_code: "000660" },
  ];
  for (const changes of corrupt) {
    const client = fixture((url) => url.pathname === "/api/corpCode.xml" ? archive() : json({ status: "000", list: [{ ...stockRow, ...changes }] }));
    const result = await client.fetchDisclosures({ stockCode: "005930" });
    assert.equal(result.status.state, "unavailable", JSON.stringify(changes));
    assert.deepEqual(result.items, []);
  }
});

test("malformed provider payloads cannot look like successfully empty responses", async () => {
  const corrupt = [null, [], { status: "000" }, { status: "000", list: [] }, { status: "000", list: [null] }, { status: "000", list: Array(101).fill(stockRow) }];
  for (const body of corrupt) {
    const client = fixture(() => json(body));
    assert.equal((await client.fetchDisclosures()).status.state, "unavailable");
  }
});

test("strict corporation archive validation rejects malformed XML, nested identities, and wrong files", async () => {
  const responses = [
    () => archive("<result><list><corp_code>00126380</corp_code><stock_code>005930</stock_code></result>"),
    () => archive("<!DOCTYPE result [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><result><list><corp_code>00126380</corp_code><stock_code>005930</stock_code></list></result>"),
    () => archive("<result><list><corp_code>99999999</corp_code><stock_code></stock_code><list><corp_code>00126380</corp_code><stock_code>005930</stock_code></list></list></result>"),
    () => archive("<result><!-- <list><corp_code>99999999</corp_code><stock_code>005930</stock_code></list> --></result>"),
    () => archive("<result><list><corp_code>00126380</corp_code><corp_code>99999999</corp_code><stock_code>005930</stock_code></list></result>"),
    () => new Response(zipSync({ "arbitrary.xml": strToU8("<result/>") })),
    () => new Response(new Uint8Array([0x50, 0x4b, 0, 0])),
  ];
  for (const response of responses) {
    const client = fixture(response);
    assert.equal((await client.fetchDisclosures({ stockCode: "005930" })).status.state, "unavailable");
  }
});

test("ambiguous historical ticker mappings are quarantined without poisoning unrelated unique companies", async () => {
  const xml = "<result><list><corp_code>00126380</corp_code><stock_code>005930</stock_code></list><list><corp_code>00000001</corp_code><stock_code>123456</stock_code></list><list><corp_code>00000002</corp_code><stock_code>123456</stock_code></list><list><corp_code>00000001</corp_code><stock_code>123456</stock_code></list></result>";
  const client = fixture((url) => url.pathname === "/api/corpCode.xml" ? archive(xml) : json({ status: "000", list: [stockRow] }));
  assert.equal((await client.fetchDisclosures({ stockCode: "005930" })).status.state, "ok");
  const queries = client.urls.length;
  const ambiguous = await client.fetchDisclosures({ stockCode: "123456" });
  assert.equal(ambiguous.status.state, "company-not-found");
  assert.equal(ambiguous.status.reasonCode, "COMPANY_MAPPING_AMBIGUOUS");
  assert.equal(client.urls.length, queries);
});

test("fixed diagnostics distinguish corporate fetch, ZIP, UTF-8, XML, and JSON/list stages", async () => {
  const cases: [() => Response | Promise<Response>, string][] = [
    [() => new Response("not forwarded", { status: 503 }), "CORP_REQUEST_HTTP"],
    [() => { throw new Error(`request=${KEY}`); }, "CORP_REQUEST_NETWORK"],
    [() => new Response("{}", { headers: { "content-length": String(17 * 1024 * 1024) } }), "CORP_RESPONSE_SIZE"],
    [() => new Response("not a ZIP"), "CORP_ZIP_FORMAT"],
    [() => new Response(new Uint8Array([0x50, 0x4b, 0, 0])), "CORP_ZIP_DIRECTORY"],
    [() => new Response(zipSync({ "wrong.xml": strToU8("<result/>") })), "CORP_ZIP_ENTRY"],
    [() => new Response(zipSync({ "CORPCODE.xml": new Uint8Array([0xff]) })), "CORP_XML_DECODE"],
    [() => archive("<result><list></result>"), "CORP_XML_SYNTAX"],
    [() => archive("<result><!-- only a comment --></result>"), "CORP_XML_ROOT"],
    [() => archive("<result><list><corp_code>00126380</corp_code><stock_code>005930</stock_code><list>bad</list></list></result>"), "CORP_XML_RECORD"],
  ];
  for (const [response, expected] of cases) {
    const client = fixture(response);
    const result = await client.fetchDisclosures({ stockCode: "005930" });
    assert.equal(result.status.state, "unavailable", expected);
    assert.equal(result.status.reasonCode, expected);
    assert.equal(JSON.stringify(result).includes(KEY), false);
  }
  const invalidJson = fixture(() => new Response("broken JSON"));
  assert.equal((await invalidJson.fetchDisclosures()).status.reasonCode, "LIST_JSON_INVALID");
  const invalidPayload = fixture(() => json({ status: "000" }));
  assert.equal((await invalidPayload.fetchDisclosures()).status.reasonCode, "LIST_PAYLOAD_INVALID");
  const invalidIdentity = fixture(() => json({ status: "000", list: [{ ...stockRow, corp_code: "invalid" }] }));
  assert.equal((await invalidIdentity.fetchDisclosures()).status.reasonCode, "LIST_IDENTITY_INVALID");
});

test("corporate timeout diagnostics survive shared failure-cache and list diagnostics remain separate", async () => {
  const client = fixture(() => new Promise<Response>(() => {}), { timeoutMs: 5 });
  assert.equal((await client.fetchDisclosures({ stockCode: "005930" })).status.reasonCode, "CORP_REQUEST_TIMEOUT");
  assert.equal((await client.fetchDisclosures({ stockCode: "005930" })).status.resolutionReasonCode, "DISCOVERY_REQUEST_HTTP");
  assert.equal((await client.fetchDisclosures({ stockCode: "000660" })).status.reasonCode, "CORP_REQUEST_TIMEOUT");
  const listTimeout = fixture(() => new Promise<Response>(() => {}), { timeoutMs: 5 });
  assert.equal((await listTimeout.fetchDisclosures()).status.reasonCode, "LIST_REQUEST_TIMEOUT");
  const listHttp = fixture(() => new Response("broken", { status: 500 }));
  assert.equal((await listHttp.fetchDisclosures()).status.reasonCode, "LIST_REQUEST_HTTP");
});

test("lightweight timeout and archive timeout remain separately diagnosed without raw errors", async () => {
  const client = fixture(() => new Promise<Response>(() => {}), {
    timeoutMs: 5,
    discovery: () => new Promise<Response>(() => {}),
  });
  const result = await client.fetchDisclosures({ stockCode: "005930" });
  assert.equal(result.status.reasonCode, "CORP_REQUEST_TIMEOUT");
  assert.equal(result.status.resolutionReasonCode, "DISCOVERY_REQUEST_TIMEOUT");
  assert.equal(JSON.stringify(result).includes(KEY), false);
  assert.equal((await client.fetchDisclosures({ stockCode: "005930" })).status.resolutionReasonCode, "DISCOVERY_REQUEST_TIMEOUT");
});

test("forged ZIP sizes cannot truncate or inflate beyond the actual XML size limit", async () => {
  const prefix = "<result><list><corp_code>00126380</corp_code><stock_code>005930</stock_code></list></result>";
  const oversized = zipSync({ "CORPCODE.xml": strToU8(prefix + "A".repeat(65 * 1024 * 1024)) });
  const view = new DataView(oversized.buffer, oversized.byteOffset);
  view.setUint32(22, prefix.length, true);
  for (let index = 0; index < oversized.length - 4; index++) {
    if (view.getUint32(index, true) === 0x02014b50) { view.setUint32(index + 24, prefix.length, true); break; }
  }
  const client = fixture(() => new Response(oversized));
  const result = await client.fetchDisclosures({ stockCode: "005930" });
  assert.equal(result.status.state, "unavailable");
  assert.equal(client.urls.length, 1);
});

test("a corrupted corporation XML ZIP cannot pass its CRC validation", async () => {
  const zip = zipSync({ "CORPCODE.xml": strToU8("<result><list><corp_code>00126380</corp_code><stock_code>005930</stock_code></list></result>") });
  const view = new DataView(zip.buffer, zip.byteOffset);
  const invalidChecksum = view.getUint32(14, true) ^ 1;
  view.setUint32(14, invalidChecksum, true);
  for (let index = 0; index < zip.length - 4; index++) {
    if (view.getUint32(index, true) === 0x02014b50) { view.setUint32(index + 16, invalidChecksum, true); break; }
  }
  const client = fixture(() => new Response(zip));
  assert.equal((await client.fetchDisclosures({ stockCode: "005930" })).status.state, "unavailable");
});

test("ZIP metadata is bounded before XML inflation and duplicate/extra entries are rejected", async () => {
  const bomb = zipSync({ "CORPCODE.xml": strToU8("<result/>") });
  for (let index = 0; index < bomb.length - 4; index++) {
    if (bomb[index] === 0x50 && bomb[index + 1] === 0x4b && bomb[index + 2] === 0x01 && bomb[index + 3] === 0x02) {
      new DataView(bomb.buffer, bomb.byteOffset).setUint32(index + 24, 65 * 1024 * 1024, true);
      break;
    }
  }
  const many = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`junk-${index}.txt`, strToU8("x")]));
  const responses = [
    () => new Response(bomb),
    () => new Response(zipSync({ ...many, "CORPCODE.xml": strToU8("<result/>") })),
    () => new Response(zipSync({ "CORPCODE.xml": strToU8("<result/>"), "CORPCODE.XML": strToU8("<result/>") })),
  ];
  for (const response of responses) {
    const client = fixture(response);
    assert.equal((await client.fetchDisclosures({ stockCode: "005930" })).status.state, "unavailable");
  }
});

test("KST calendar date and three-month market request limit are applied", async () => {
  const client = fixture(() => json({ status: "013" }), { now: () => Date.parse("2026-10-19T15:17:00Z") });
  await client.fetchDisclosures({ days: 120 });
  assert.equal(client.urls[0].searchParams.get("end_de"), "20261020");
  assert.equal(client.urls[0].searchParams.get("bgn_de"), "20260720");
});

test("invalid request parameters never consume API quota", async () => {
  const client = fixture(() => { throw new Error("must not request"); });
  for (const options of [{ stockCode: "invalid" }, { stockCode: "005930&crtfc_key=evil" }, { days: -1 }, { days: 121 }, { days: 1.5 }, { stockCode: 123456 }]) {
    const result = await client.fetchDisclosures(options as Parameters<typeof client.fetchDisclosures>[0]);
    assert.equal(result.status.state, "invalid-request");
  }
  assert.equal(client.urls.length, 0);
});

test("simultaneous company requests share one archive and identical queries share one list request", async () => {
  const client = fixture(async (url) => {
    await new Promise((resolve) => setTimeout(resolve, 2));
    return url.pathname === "/api/corpCode.xml" ? archive() : json({ status: "013" });
  });
  const results = await Promise.all([client.fetchDisclosures({ stockCode: "005930" }), client.fetchDisclosures({ stockCode: "005930" }), client.fetchDisclosures({ stockCode: "000660" })]);
  assert.equal(results.every((result) => result.status.state === "empty"), true);
  assert.equal(client.urls.filter((url) => url.pathname === "/api/corpCode.xml").length, 1);
  assert.equal(client.urls.filter((url) => url.pathname === "/api/list.json").length, 2);
});

test("result caching is bounded in time and immune to caller mutation", async () => {
  let time = NOW;
  const client = fixture(() => json({ status: "000", list: [stockRow] }), { now: () => time });
  const first = await client.fetchDisclosures();
  first.items[0].corpName = "mutated";
  assert.equal((await client.fetchDisclosures()).items[0].corpName, "삼성전자");
  assert.equal(client.urls.length, 2);
  time += 90_001;
  await client.fetchDisclosures();
  assert.equal(client.urls.length, 4);
});

test("the corporate mapping cache expires after twelve hours", async () => {
  let time = NOW;
  const client = fixture((url) => url.pathname === "/api/corpCode.xml" ? archive() : json({ status: "013" }), { now: () => time });
  await client.fetchDisclosures({ stockCode: "005930" });
  time += 90_001;
  await client.fetchDisclosures({ stockCode: "005930" });
  assert.equal(client.urls.filter((url) => url.pathname === "/api/corpCode.xml").length, 1);
  time += 12 * 60 * 60 * 1_000;
  await client.fetchDisclosures({ stockCode: "005930" });
  assert.equal(client.urls.filter((url) => url.pathname === "/api/corpCode.xml").length, 2);
});

test("key rotation discards cached results, corporate mapping, and provider cooldown", async () => {
  let key = KEY;
  const client = fixture((url) => {
    if (url.searchParams.get("crtfc_key") === KEY) return json({ status: "010" });
    return url.pathname === "/api/corpCode.xml" ? archive() : json({ status: "013" });
  }, { key: () => key });
  assert.equal((await client.fetchDisclosures()).status.state, "invalid-key");
  const before = client.urls.length;
  assert.equal((await client.fetchDisclosures({ stockCode: "005930" })).status.state, "invalid-key");
  assert.equal(client.urls.length, before);
  key = SECOND_KEY;
  assert.equal((await client.fetchDisclosures({ stockCode: "005930" })).status.state, "empty");
  assert.equal(client.urls.filter((url) => url.pathname === "/api/corpCode.xml").length, 1);
});

test("rate limits cool down requests across company queries until expiry", async () => {
  let time = NOW;
  const client = fixture(() => json({ status: "020" }), { now: () => time });
  assert.equal((await client.fetchDisclosures()).status.state, "rate-limited");
  await client.fetchDisclosures({ stockCode: "005930" });
  assert.equal(client.urls.length, 2);
  time += 60_001;
  await client.fetchDisclosures();
  assert.equal(client.urls.length, 4);
});

test("removing and re-adding a key discards its earlier cached result", async () => {
  let key: string | undefined = KEY;
  const client = fixture(() => json({ status: "013" }), { key: () => key });
  await client.fetchDisclosures();
  key = undefined;
  assert.equal((await client.fetchDisclosures()).status.state, "missing-key");
  key = KEY;
  await client.fetchDisclosures();
  assert.equal(client.urls.length, 4);
});

test("a late response from an earlier key generation cannot poison a re-added key", async () => {
  let key: string | undefined = KEY;
  let resolveOld!: (response: Response) => void;
  const client = fixture((url) => {
    if (url.searchParams.get("crtfc_key") === KEY && client.urls.length <= 2) {
      if (url.searchParams.get("corp_cls") === "Y") return new Promise((resolve) => { resolveOld = resolve; });
      return json({ status: "013" });
    }
    return json({ status: "013" });
  }, { key: () => key });
  const earlier = client.fetchDisclosures();
  key = undefined;
  await client.fetchDisclosures();
  key = KEY;
  assert.equal((await client.fetchDisclosures()).status.state, "empty");
  resolveOld(json({ status: "010" }));
  assert.equal((await earlier).status.state, "invalid-key");
  assert.equal((await client.fetchDisclosures()).status.state, "empty");
  assert.equal(client.urls.length, 4);
});

test("body-size limits apply with or without Content-Length", async () => {
  for (const response of [
    () => new Response("{}", { headers: { "content-length": String(3 * 1024 * 1024) } }),
    () => new Response("x".repeat(2 * 1024 * 1024 + 1)),
  ]) {
    const client = fixture(response);
    assert.equal((await client.fetchDisclosures()).status.state, "unavailable");
  }
});

test("timeouts remain bounded even when a fetch adapter ignores AbortSignal", async () => {
  const client = fixture(() => new Promise<Response>(() => {}), { timeoutMs: 10 });
  const started = performance.now();
  const result = await client.fetchDisclosures();
  assert.equal(result.status.state, "unavailable");
  assert.ok(performance.now() - started < 500);
});

test("HTTP limits and credential-bearing network errors return no raw exception details", async () => {
  for (const handler of [
    () => new Response("do not forward", { status: 429 }),
    () => { throw new Error(`fetch failed https://opendart.fss.or.kr/api/list.json?crtfc_key=${KEY}`); },
    () => new Response("broken JSON " + KEY),
  ]) {
    const client = fixture(handler);
    const result = await client.fetchDisclosures();
    assert.equal(JSON.stringify(result).includes(KEY), false);
    assert.equal(JSON.stringify(result).includes("crtfc_key"), false);
    assert.equal(["rate-limited", "unavailable"].includes(result.status.state), true);
  }
});

test("market results are deduplicated and sorted by actual official receipt identifiers", async () => {
  const older = { ...stockRow, rcept_no: "20261019000002", rcept_dt: "20261019" };
  const client = fixture(() => json({ status: "000", list: [older, stockRow] }));
  const result = await client.fetchDisclosures();
  assert.deepEqual(result.items.map((item) => item.receiptNo), ["20261020000001", "20261019000002"]);
});

test("paged official queries preserve corrections, totals, cache and final-page state", async () => {
  const client = fixture(url => {
    if (url.pathname.endsWith("corpCode.xml")) return archive();
    assert.equal(url.searchParams.get("last_reprt_at"), "N");
    const page = Number(url.searchParams.get("page_no"));
    return json({ status: "000", page_no: page, page_count: 1, total_count: 2, total_page: 2,
      list: [{ ...stockRow, report_nm: page === 2 ? "[기재정정]주요사항보고서" : "주요사항보고서", rcept_no: page === 2 ? "20261020000002" : stockRow.rcept_no }] });
  });
  const query = { stockCode: "005930", range: { begin: "20261017", end: "20261020", page: 1, pageSize: 1 } };
  const first = await client.fetchDisclosures(query);
  assert.equal(first.pagination?.nextPage, 2);
  assert.equal(first.pagination?.complete, false);
  const calls = client.urls.length;
  assert.deepEqual(await client.fetchDisclosures(query), first);
  assert.equal(client.urls.length, calls);
  const last = await client.fetchDisclosures({ ...query, range: { ...query.range, page: 2 } });
  assert.equal(last.pagination?.complete, true);
  assert.equal(last.pagination?.nextPage, null);
  assert.notEqual(last.items[0].receiptNo, first.items[0].receiptNo);
  assert.match(last.items[0].reportName, /정정/);
});

test("paged empty and upstream failures never claim false completeness", async () => {
  for (const upstream of ["013", "010", "020", "999"]) {
    const client = fixture(url => url.pathname.endsWith("corpCode.xml") ? archive() : json({ status: upstream }));
    const result = await client.fetchDisclosures({ stockCode: "005930", range: { begin: "20261017", end: "20261020", page: 1, pageSize: 100 } });
    assert.equal(result.status.state, ({ "013": "empty", "010": "invalid-key", "020": "rate-limited", "999": "unavailable" })[upstream]);
    assert.equal(result.status.fallbackUsed, false);
    assert.equal(result.pagination?.complete, upstream === "013" ? true : undefined);
  }
});

test("paged mismatched totals and invalid range fail closed", async () => {
  const client = fixture(url => url.pathname.endsWith("corpCode.xml") ? archive() : json({ status: "000", list: [stockRow], page_no: 1, page_count: 100, total_count: 200, total_page: 1 }));
  const range = { begin: "20261017", end: "20261020", page: 1, pageSize: 100 };
  assert.equal((await client.fetchDisclosures({ stockCode: "005930", range })).status.state, "unavailable");
  assert.equal((await client.fetchDisclosures({ stockCode: "005930", range: { ...range, begin: "20260230" } })).status.state, "invalid-request");
});

test("paged network errors expose only fixed diagnostics", async () => {
  const client = fixture(url => {
    if (url.pathname.endsWith("corpCode.xml")) return archive();
    throw Error(`network ${url}`);
  });
  const result = await client.fetchDisclosures({ stockCode: "005930", range: { begin: "20261017", end: "20261020", page: 1, pageSize: 100 } });
  assert.equal(result.status.state, "unavailable");
  assert.equal(result.status.reasonCode, "LIST_REQUEST_NETWORK");
  assert.equal(JSON.stringify(result).includes(KEY), false);
  assert.equal(result.pagination, undefined);
});

test("paged calls have a bounded per-instance request budget", async () => {
  const client = fixture(url => url.pathname.endsWith("corpCode.xml") ? archive() : json({ status: "013" }));
  for (let pageSize = 1; pageSize <= 60; pageSize++) {
    assert.equal((await client.fetchDisclosures({ stockCode: "005930", range: { begin: "20261017", end: "20261020", page: 1, pageSize } })).status.state, "empty");
  }
  const calls = client.urls.length;
  assert.equal((await client.fetchDisclosures({ stockCode: "005930", range: { begin: "20261017", end: "20261020", page: 1, pageSize: 61 } })).status.state, "rate-limited");
  assert.equal(client.urls.length, calls);
});
