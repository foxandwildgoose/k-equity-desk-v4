import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchIssuerPageHoldings, parseIssuerHoldingsPage, parseTigerIssuerHoldings, parseTigerIssuerJson } from "./etf-issuer-holdings.ts";
import { krxEtfIsin, type EtfIssuerProduct } from "./etf-issuer.ts";

const NAME = "TIME 테스트채권혼합액티브";
const CODE = "123450";
const HEAD = `<h1>${NAME}</h1><p>종목코드: ${CODE}</p>`;
const TABLE = `<table><caption>구성종목</caption><thead><tr><th>종목코드</th><th>종목명</th><th>수량(주)</th><th>비중(%)</th></tr></thead><tbody>
<tr><td>005930</td><td>삼성전자</td><td>15.5</td><td>40.25%</td></tr>
<tr><td>KR319000GA77</td><td>국고채권</td><td>3</td><td>58.50</td></tr>
<tr><td>KRD010010001</td><td>원화예금</td><td>25,000</td><td>1.25</td></tr>
<tr><td>CASH00000001</td><td>설정현금액</td><td>200,000</td><td>100</td></tr>
<tr><td></td><td>합계</td><td></td><td>100</td></tr></tbody></table>`;
const PAGE = `${HEAD}<section><h2>편입 종목</h2><p>기준일: 2026.10.08</p>${TABLE}</section>`;
const PRODUCT: EtfIssuerProduct = { family: "timefolio", issuerName: "타임폴리오자산운용", issuerUrl: "https://timeetf.co.kr/m11_view.php?idx=24", websiteUrl: "https://timeetf.co.kr/", status: "resolved" };

test("full issuer table preserves published percentages, fractional quantities, bonds, and cash", () => {
  const parsed = parseIssuerHoldingsPage(PAGE, CODE, NAME)!;
  assert.equal(parsed.asOf, "2026-10-08");
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.rows[0]!.weight, 40.25);
  assert.equal(parsed.rows[0]!.quantity, 15.5);
  assert.equal(parsed.rows[0]!.code, "005930");
  assert.equal(parsed.rows[1]!.isin, "KR319000GA77");
  assert.equal(parsed.rows[2]!.weight, 1.25);
  assert.equal(parsed.rows[2]!.nameKo, "원화예금");
});

test("official HTML never converts a preferred-share ISIN to its encoded six-character substring", () => {
  const byIsin = parseIssuerHoldingsPage(PAGE.replace("005930", "KR7005931001").replace("삼성전자", "삼성전자우"), CODE, NAME);
  assert.equal(byIsin?.rows[0]!.code, null);
  assert.equal(byIsin?.rows[0]!.isin, "KR7005931001");
  const explicit = parseIssuerHoldingsPage(PAGE.replace("005930", "005935").replace("삼성전자", "삼성전자우"), CODE, NAME);
  assert.equal(explicit?.rows[0]!.code, "005935");
});

test("ticker/name identity must be outside the holdings and exact", () => {
  assert.equal(parseIssuerHoldingsPage(PAGE.replace(CODE, "654320"), CODE, NAME), null);
  assert.equal(parseIssuerHoldingsPage(PAGE.replace(`<h1>${NAME}</h1>`, "<h1>TIME 다른ETF액티브</h1>"), CODE, NAME), null);
  assert.equal(parseIssuerHoldingsPage(PAGE.replace(`<h1>${NAME}</h1>`, `<h1>${NAME}2</h1>`), CODE, NAME), null);
  assert.equal(parseIssuerHoldingsPage(PAGE.replace(`<p>종목코드: ${CODE}</p>`, "").replace("005930", CODE), CODE, NAME), null);
  const related = PAGE.replace(HEAD, `<h1>TIME 다른 ETF</h1><p>종목코드: 654320</p><aside><h2>${NAME}</h2><p>종목코드: ${CODE}</p></aside>`);
  assert.equal(parseIssuerHoldingsPage(related, CODE, NAME), null);
});

test("a missing row weight invalidates the whole basket, even if other rows total 100", () => {
  const missing = PAGE.replace("40.25%", "41.50").replace("1.25</td>", "-</td>");
  assert.equal(parseIssuerHoldingsPage(missing, CODE, NAME), null);
  assert.equal(parseIssuerHoldingsPage(PAGE.replace("40.25%", "NaN"), CODE, NAME), null);
  assert.equal(parseIssuerHoldingsPage(PAGE.replace("</tbody>", "<tr><td>000660</td><td></td><td>1</td><td>1</td></tr></tbody>"), CODE, NAME), null);
});

test("partial/Top10 tables are rejected even when their weights total 100", () => {
  assert.equal(parseIssuerHoldingsPage(PAGE.replace("<caption>구성종목", "<caption>TOP10 구성종목"), CODE, NAME), null);
  assert.equal(parseIssuerHoldingsPage(PAGE.replace("<h2>편입 종목", "<h2>상위 10 편입 종목"), CODE, NAME), null);
  assert.equal(parseIssuerHoldingsPage(PAGE.replace("58.50", "28.50"), CODE, NAME), null);
});

test("unrelated page-update/footer dates cannot become the portfolio date", () => {
  assert.equal(parseIssuerHoldingsPage(PAGE.replace("<p>기준일: 2026.10.08</p>", "") + "<footer>기준일: 2026.10.08</footer>", CODE, NAME), null);
  assert.equal(parseIssuerHoldingsPage(PAGE.replace("<p>기준일: 2026.10.08</p>", "업데이트: 2026.10.08"), CODE, NAME), null);
  assert.equal(parseIssuerHoldingsPage(PAGE.replace("2026.10.08", "2026.02.30"), CODE, NAME), null);
  assert.equal(parseIssuerHoldingsPage(PAGE.replace("기준일: 2026.10.08", "기준일: 2026.10.08 기준일: 2026.10.09"), CODE, NAME), null);
});

test("recognized holdings-date input stays scoped to the portfolio", () => {
  const page = PAGE.replace("<p>기준일: 2026.10.08</p>", `<input type="hidden" id="portfolio-date-input" name="pdfDate" value="20261008">`);
  assert.equal(parseIssuerHoldingsPage(page, CODE, NAME)?.asOf, "2026-10-08");
});

test("English percent columns and absent optional fields are accepted", () => {
  const page = `${HEAD}<h2>Portfolio holdings</h2><p>As of 2026/10/08</p><table><tr><th>Security name</th><th>Weight (%)</th></tr><tr><td>Bond &amp; cash</td><td>100</td></tr></table>`;
  assert.deepEqual(parseIssuerHoldingsPage(page, CODE, NAME)?.rows[0], { nameKo: "Bond & cash", weight: 100, quantity: null, code: null, isin: null, asOf: "2026-10-08" });
  assert.equal(parseIssuerHoldingsPage(page.replace("Weight (%)", "Weight"), CODE, NAME), null);
});

test("duplicate securities, ambiguous columns, and conflicting full tables are rejected", () => {
  assert.equal(parseIssuerHoldingsPage(PAGE.replace("KR319000GA77", "005930"), CODE, NAME), null);
  assert.equal(parseIssuerHoldingsPage(PAGE.replace("<th>종목명", '<th colspan="2">종목명'), CODE, NAME), null);
  assert.equal(parseIssuerHoldingsPage(`${PAGE}<h2>편입 종목</h2><p>기준일: 2026.10.07</p>${TABLE}`, CODE, NAME), null);
});

test("scripts and unrelated Top10 sections do not supply holdings or dates", () => {
  const page = `${HEAD}<h2>TOP10 구성종목</h2><p>기준일: 2026.10.07</p><script>${TABLE}</script><h2>전체 편입 종목</h2><p>기준일: 2026.10.08</p>${TABLE}`;
  assert.equal(parseIssuerHoldingsPage(page, CODE, NAME)?.asOf, "2026-10-08");
});

test("only a resolved official issuer URL is fetched", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return new Response(PAGE); };
  assert.equal(await fetchIssuerPageHoldings(CODE, NAME, { ...PRODUCT, issuerUrl: "https://example.com/holdings" }, { fetcher }), null);
  assert.equal(await fetchIssuerPageHoldings(CODE, NAME, { ...PRODUCT, status: "unresolved" }, { fetcher }), null);
  assert.equal(await fetchIssuerPageHoldings(CODE, "TIGER 다른상품", PRODUCT, { fetcher }), null);
  assert.equal(calls, 0);
  const result = await fetchIssuerPageHoldings(CODE, NAME, PRODUCT, { fetcher });
  assert.equal(result?.issuerUrl, PRODUCT.issuerUrl);
  assert.equal(result?.rows[0]!.weight, 40.25);
  assert.equal(calls, 1);
});

test("issuer redirects outside the official allowlist and network failures return null", async () => {
  const redirected = await fetchIssuerPageHoldings(CODE, NAME, PRODUCT, { fetcher: async () => new Response(null, { status: 302, headers: { Location: "https://example.com/basket" } }) });
  assert.equal(redirected, null);
  assert.equal(await fetchIssuerPageHoldings(CODE, NAME, PRODUCT, { fetcher: async () => { throw new Error("offline"); } }), null);
});

test("shared abort prevents requests and the overall deadline stops page requests", async () => {
  const controller = new AbortController();
  controller.abort();
  assert.equal(await fetchIssuerPageHoldings(CODE, NAME, PRODUCT, { signal: controller.signal, fetcher: async () => { throw new Error("should not request"); } }), null);
  let aborted = false;
  const result = await fetchIssuerPageHoldings(CODE, NAME, PRODUCT, { timeoutMs: 5, fetcher: async (_url, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }, { once: true });
  }) });
  assert.equal(result, null);
  assert.equal(aborted, true);
});

const TIGER_ROWS = `<tbody><tr><td>KR7005930003</td><td>삼성전자</td><td>10</td><td>250,000</td><td>25</td></tr><tr><td>KRD010010001</td><td>원화예금</td><td>750,000</td><td>750,000</td><td>75</td></tr></tbody>`;

test("TIGER adapter preserves complete published weights and cash", () => {
  assert.equal(parseTigerIssuerHoldings(TIGER_ROWS, "2026-10-08")?.rows[0]!.code, "005930");
  assert.equal(parseTigerIssuerHoldings(TIGER_ROWS, "2026-10-08")?.rows[1]!.weight, 75);
  assert.equal(parseTigerIssuerHoldings(TIGER_ROWS.replace("<td>75</td>", "<td>-</td>"), "2026-10-08"), null);
  assert.equal(parseTigerIssuerHoldings(`<h3>TOP10</h3>${TIGER_ROWS}`, "2026-10-08"), null);
  assert.equal(parseTigerIssuerHoldings(`<p>기준일: 2026.10.07</p>${TIGER_ROWS}`, "2026-10-08"), null);
  assert.equal(parseTigerIssuerHoldings(`<p>기준일: 2026.10.08</p>${TIGER_ROWS}`, "2026-10-08")?.asOf, "2026-10-08");
});

test("TIGER uses exact ISIN, actual issuer PDF date, and full table request", async () => {
  const ticker = "360750", name = "TIGER 미국S&P500", isin = krxEtfIsin(ticker)!;
  const product: EtfIssuerProduct = { family: "tiger", issuerName: "미래에셋자산운용", issuerUrl: `https://investments.miraeasset.com/tigeretf/ko/product/search/detail/index.do?ksdFund=${isin}`, websiteUrl: "https://investments.miraeasset.com/", status: "resolved" };
  const requests: { url: string; body: string; headers: Headers }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), body: String(init?.body ?? ""), headers: new Headers(init?.headers) });
    if (String(url).includes("index.do")) return new Response(`<h1>${name}</h1><p>종목코드: ${ticker}</p>`);
    if (String(url).endsWith("/pdf.ajax")) return new Response('<input name="fixDate" value="2026.10.08">');
    return new Response(TIGER_ROWS);
  };
  const result = await fetchIssuerPageHoldings(ticker, name, product, { fetcher });
  assert.equal(result?.asOf, "2026-10-08");
  assert.equal(requests.length, 3);
  assert.match(requests[0]!.url, /\/chart\/prdct-item-list\.ajax\?/);
  assert.equal(new URLSearchParams(requests[2]!.body).get("fixDate"), "2026.10.08");
  assert.equal(new URLSearchParams(requests[2]!.body).get("listCnt"), "1000");
  assert.equal(new URLSearchParams(requests[2]!.body).get("ksdFund"), isin);
  assert.equal(requests[1]!.headers.get("X-Requested-With"), "XMLHttpRequest");
  assert.equal(requests[2]!.headers.get("Referer"), product.issuerUrl);
});

// Synthetic schema fixtures based on the two pinned public integrations above;
// actual issuer requests are separately recorded as HTTP 403 in the live audit.
const TIGER_JSON = { rtnData: [
  { memItemname: "NVIDIA CORP", code: "US67066G1040", stockQty: "12.5", stockRate: "98.75", wkdate: "20261016" },
  { memItemname: "원화현금", code: "KRD010010001", stockQty: "1,250", stockRate: "1.25", wkdate: "20261016" },
] };

test("TIGER JSON preserves issuer percentages and its actual publication date", () => {
  const basket = parseTigerIssuerJson(TIGER_JSON)!;
  assert.equal(basket.asOf, "2026-10-16");
  assert.equal(basket.rows[0]!.weight, 98.75);
  assert.equal(basket.rows[0]!.quantity, 12.5);
  assert.equal(basket.rows[0]!.isin, "US67066G1040");
  assert.equal(basket.rows[1]!.weight, 1.25);
  assert.equal(basket.rows[1]!.quantity, 1250);
});

test("TIGER JSON rejects missing, conflicting, invalid dates and incomplete baskets", () => {
  const edit = (changes: Record<string, unknown>) => ({ rtnData: [TIGER_JSON.rtnData[0], { ...TIGER_JSON.rtnData[1], ...changes }] });
  for (const changes of [{ wkdate: undefined }, { wkdate: "20261019" }, { wkdate: "20260230" }, { stockRate: undefined }, { stockRate: "0.01" }, { stockRate: "NaN" }, { memItemname: "NVIDIA CORP", code: "US67066G1040" }]) {
    assert.equal(parseTigerIssuerJson(edit(changes)), null, JSON.stringify(changes));
  }
  assert.equal(parseTigerIssuerJson({ rtnData: [] }), null);
  assert.equal(parseTigerIssuerJson({ rtnData: TIGER_JSON.rtnData.slice(0, 1) }), null);
});

test("TIGER JSON rejects explicit pagination gaps even when the received weights nearly total 100", () => {
  for (const metadata of [
    { totalCount: 3 }, { totalCnt: "3" }, { totalElements: 3 }, { recordsTotal: 3 },
    { last: false }, { hasNext: true }, { pagination: { last: false } }, { page: { totalElements: 3 } },
    { totalCount: "unknown" }, { totalCount: 1 }, { last: "false" }, { hasNext: "true" },
  ]) {
    assert.equal(parseTigerIssuerJson({ ...TIGER_JSON, ...metadata }), null, JSON.stringify(metadata));
  }
  assert.ok(parseTigerIssuerJson({ ...TIGER_JSON, totalCount: 2, last: true, hasNext: false }));
});

test("TIGER JSON requires a confirmed count or end at known 500/1000-row caps", () => {
  for (const count of [500, 1000]) {
    const rtnData = Array.from({ length: count }, (_, index) => ({
      memItemname: `Synthetic security ${index}`, code: `US${String(index).padStart(10, "0")}`,
      stockQty: 1, stockRate: 99.95 / count, wkdate: "20261016",
    }));
    assert.equal(parseTigerIssuerJson({ rtnData }), null, "a request size is not completeness evidence");
    assert.equal(parseTigerIssuerJson({ rtnData, listCnt: count }), null);
    assert.equal(parseTigerIssuerJson({ rtnData, totalCount: count + 1 }), null);
    assert.equal(parseTigerIssuerJson({ rtnData, totalCount: count, hasNext: true }), null);
    assert.equal(parseTigerIssuerJson({ rtnData, totalCount: count })?.rows.length, count);
    assert.equal(parseTigerIssuerJson({ rtnData, pagination: { last: true } })?.rows.length, count);
    assert.equal(parseTigerIssuerJson({ rtnData, hasNext: false })?.rows.length, count);
  }
});

test("TIGER JSON fetch uses exact resolved ISIN without a marketing-page prerequisite", async () => {
  const ticker = "360750", name = "TIGER 미국S&P500", isin = krxEtfIsin(ticker)!;
  const product: EtfIssuerProduct = { family: "tiger", issuerName: "미래에셋자산운용", issuerUrl: `https://investments.miraeasset.com/tigeretf/ko/product/search/detail/index.do?ksdFund=${isin}`, websiteUrl: "https://investments.miraeasset.com/", status: "resolved" };
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); calls.push(url.href);
    assert.equal(url.pathname, "/tigeretf/ko/product/chart/prdct-item-list.ajax");
    assert.equal(url.searchParams.get("ksdFund"), isin);
    assert.equal(url.searchParams.get("listCnt"), "1000");
    assert.equal(url.searchParams.has("fixDate"), false);
    assert.equal(init?.method, "POST");
    return Response.json(TIGER_JSON);
  };
  assert.equal((await fetchIssuerPageHoldings(ticker, name, product, { fetcher }))?.asOf, "2026-10-16");
  assert.equal(calls.length, 1);
  assert.equal(await fetchIssuerPageHoldings(ticker, name, { ...product, issuerUrl: product.issuerUrl!.replace(isin, krxEtfIsin("133690")!) }, { fetcher }), null);
  assert.equal(calls.length, 1);
});
