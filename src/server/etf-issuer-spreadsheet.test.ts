import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { fetchIssuerPageHoldings } from "./etf-issuer-holdings.ts";
import type { EtfIssuerProduct } from "./etf-issuer.ts";
import { fetchRiseSpreadsheetHoldings, parseRiseSpreadsheet, parseRiseSpreadsheetRows } from "./etf-issuer-spreadsheet.ts";

// Synthetic source-schema fixture made with Python's standard zipfile, independent of the reader.
const XLSX = fs.readFileSync(new URL("./fixtures/etf-issuer-rise-schema.xlsx", import.meta.url));
const AS_OF = "2026-10-08";
const HEADERS = ["종목코드", "종목명", "수량(주)", "보유비중(%)", "평가금액(원)"];
const product: EtfIssuerProduct = { family: "rise", issuerName: "KB자산운용", issuerUrl: "https://kbam.co.kr/products/44L0", productId: "44L0", websiteUrl: "https://kbam.co.kr/", status: "resolved" };
function fixtureFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => handler(String(input), init)) as typeof fetch;
}
function metadata(extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ base_dt: "20261008", available_dates: ["20261008", "20261007"], krx_cd: "0233N0", fund_cd: "44L0", ...extra }));
}

test("real XLSX preserves exact published percentages, fractional quantities, bonds and cash", async () => {
  const basket = await parseRiseSpreadsheet(XLSX, AS_OF);
  assert.ok(basket);
  assert.equal(basket.asOf, AS_OF);
  assert.deepEqual(basket.rows.map((row) => row.weight), [25.23, 24.51, 24.45, 4.16, 20.15, 1.5]);
  assert.equal(basket.rows[1]!.quantity, 85.06);
  assert.equal(basket.rows[3]!.quantity, 145.91);
  assert.equal(basket.rows[5]!.nameKo, "원화예금");
  assert.equal(basket.rows[5]!.isin, "KRD010010001");
  assert.equal(basket.rows[4]!.nameKo, "국고채권");
  assert.equal(basket.rows.reduce((sum, row) => sum + row.weight!, 0), 100);
  assert.equal(basket.rows.some((row) => row.nameKo === "설정현금액" || row.nameKo === "합계"), false);
});

test("RISE named headers may reorder columns but valuation never supplies a weight", () => {
  const result = parseRiseSpreadsheetRows([["종목명", "보유비중(%)", "평가금액(원)", "수량(주)", "종목코드"], ["삼성전자", 100, 1, 0.25, "005930"]], AS_OF);
  assert.ok(result);
  assert.equal(result.rows[0]!.weight, 100);
  assert.equal(result.rows[0]!.quantity, 0.25);
  assert.equal(parseRiseSpreadsheetRows([["종목코드", "종목명", "수량(주)", "평가금액(원)"], ["005930", "삼성전자", 1, 100]], AS_OF), null);
  assert.equal(parseRiseSpreadsheetRows([HEADERS, ["005930", "삼성전자", 1, null, 100]], AS_OF), null);
});

test("full forty-position file is accepted while its Top30 subset is incomplete", () => {
  const rows = Array.from({ length: 40 }, (_, i) => [String(100000 + i), `종목 ${i}`, 1.25, 2.5, 1]);
  assert.equal(parseRiseSpreadsheetRows([HEADERS, ...rows], AS_OF)?.rows.length, 40);
  assert.equal(parseRiseSpreadsheetRows([HEADERS, ...rows.slice(0, 30)], AS_OF), null);
});

test("duplicate securities, ambiguous headers and conflicting file dates fail closed", async () => {
  assert.equal(parseRiseSpreadsheetRows([HEADERS, ["005930", "삼성전자", 1, 50, 1], ["005930", "삼성전자", 1, 50, 1]], AS_OF), null);
  assert.equal(parseRiseSpreadsheetRows([[...HEADERS, "보유비중(%)"], ["005930", "삼성전자", 1, 100, 1, 100]], AS_OF), null);
  assert.equal(await parseRiseSpreadsheet(XLSX, "2026-10-07"), null);
  assert.equal(await parseRiseSpreadsheet(XLSX, "2026-02-30"), null);
  assert.equal(await parseRiseSpreadsheet(Buffer.from("<html>xls</html>"), AS_OF), null);
  assert.equal(await parseRiseSpreadsheet(XLSX.subarray(0, 40), AS_OF), null);
});

test("RISE requests the full XLSX for the issuer's actual available date, ignoring Top30 JSON", async () => {
  const calls: string[] = [];
  const result = await fetchRiseSpreadsheetHoldings("0233N0", "RISE 글로벌AI낸드메모리반도체", product, { fetcher: fixtureFetch((url) => {
    calls.push(url);
    return url.includes("download=xlsx") ? new Response(XLSX, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } }) : metadata({ holdings: [{ name: "wrong Top30", weight: 100 }] });
  }) });
  assert.ok(result);
  assert.equal(result.asOf, AS_OF);
  assert.equal(result.rows.length, 6);
  assert.deepEqual(calls, ["https://kbam.co.kr/api/products/etfs/44L0/holdings", "https://kbam.co.kr/api/products/etfs/44L0/holdings?download=xlsx&base_dt=20261008"]);
});

test("unavailable dates or contradictory issuer identity prevent the XLSX request", async () => {
  for (const invalid of [{ available_dates: ["20261007"] }, { base_dt: "20260230" }, { available_dates: null }, { krx_cd: "999999" }, { fund_cd: "other-fund" }]) {
    let calls = 0;
    const result = await fetchRiseSpreadsheetHoldings("0233N0", "RISE 글로벌AI낸드메모리반도체", product, { fetcher: fixtureFetch(() => { calls++; return metadata(invalid); }) });
    assert.equal(result, null, JSON.stringify(invalid));
    assert.equal(calls, 1);
  }
});

test("unresolved products, legacy URLs and product-ID mismatch never select a file", async () => {
  for (const invalid of [{ status: "unresolved" as const }, { issuerUrl: "https://www.riseetf.co.kr/prod/finderDetail/44L0" }, { productId: "other" }, { issuerUrl: "https://evil.test/products/44L0" }]) {
    let calls = 0;
    assert.equal(await fetchRiseSpreadsheetHoldings("0233N0", "RISE 글로벌AI낸드메모리반도체", { ...product, ...invalid }, { fetcher: fixtureFetch(() => { calls++; return metadata(); }) }), null);
    assert.equal(calls, 0);
  }
});

test("network failures and forbidden file redirects cannot become official baskets", async () => {
  assert.equal(await fetchRiseSpreadsheetHoldings("0233N0", "RISE 글로벌AI낸드메모리반도체", product, { fetcher: fixtureFetch(() => new Response("blocked", { status: 403 })) }), null);
  const calls: string[] = [];
  const result = await fetchRiseSpreadsheetHoldings("0233N0", "RISE 글로벌AI낸드메모리반도체", product, { fetcher: fixtureFetch((url) => { calls.push(url); return url.includes("download=xlsx") ? new Response(null, { status: 302, headers: { Location: "https://evil.test/file.xlsx" } }) : metadata(); }) });
  assert.equal(result, null);
  assert.equal(calls.length, 2);
  assert.equal(calls.some((url) => url.includes("evil.test")), false);
});

test("shared wrapper selects RISE full file before HTML fallback and respects cancellation", async () => {
  const result = await fetchIssuerPageHoldings("0233N0", "RISE 글로벌AI낸드메모리반도체", product, { fetcher: fixtureFetch((url) => url.includes("download=xlsx") ? new Response(XLSX) : metadata()) });
  assert.equal(result?.rows.length, 6);
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  assert.equal(await fetchRiseSpreadsheetHoldings("0233N0", "RISE 글로벌AI낸드메모리반도체", product, { signal: controller.signal, fetcher: fixtureFetch(() => { calls++; return metadata(); }) }), null);
  assert.equal(calls, 0);
});
