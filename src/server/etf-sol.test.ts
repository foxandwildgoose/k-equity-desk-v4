import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findUploadedIssuerHoldingsSnapshot,
  SOL_DRAM_20261008_SNAPSHOT,
} from "../data/etf-official-snapshots.ts";
import {
  fetchSolOfficialHoldings,
  parseSolCatalog,
  parseSolHoldingsHtml,
  parseSolPdfRows,
  parseSolProductPage,
  resolveSolProduct,
  SOL_WEBSITE_URL,
} from "./etf-sol.ts";

// Synthetic HTML exercises discovery/parser behavior. The product ID here is
// test-only and is never an application URL or a claim about the live issuer.
const PRODUCT_URL = `${SOL_WEBSITE_URL}/ko/fund/etf/999999`;
const CATALOG_URL = `${SOL_WEBSITE_URL}/ko/fund/etf/list`;
const SNAPSHOT = SOL_DRAM_20261008_SNAPSHOT;
const TABLE = `<p>기준일 : 2026.10.08</p><table>
<tr><th>No.</th><th>종목코드</th><th>종목명</th><th>수량(주)</th><th>평가금액(원)</th><th>비중(%)</th></tr>
${SNAPSHOT.rows.map((row, index) => `<tr><td>${index + 1}</td><td>${row.code ?? row.isin}</td><td>${row.nameKo}</td><td>${row.quantity}</td><td>${row.valuationKrw}</td><td>${row.weight}%</td></tr>`).join("\n")}
<tr><td>12</td><td>CASH00000001</td><td>100%현금설정액</td><td>486297518</td><td>486297518</td><td> </td></tr>
</table>`;
const PRODUCT_PAGE = `<title>SOL 글로벌DRAM반도체플러스 | SOL ETF</title><h1>SOL 글로벌DRAM반도체플러스</h1><dl><dt>종목코드</dt><dd>0246X0</dd></dl>${TABLE}`;

function fixtureFetch(pages: Record<string, string>, calls: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return new Response(pages[url] ?? "Not found", { status: pages[url] == null ? 404 : 200 });
  }) as typeof fetch;
}

test("SOL issuer upload preserves every published 2026-10-08 weight including cash", () => {
  const snapshot = findUploadedIssuerHoldingsSnapshot("0246x0");
  assert.ok(snapshot);
  assert.equal(snapshot.asOf, "2026-10-08");
  assert.equal(snapshot.rows.length, 11);
  assert.equal(snapshot.rows.find((row) => row.nameKo === "삼성전자")?.weight, 25.23);
  assert.equal(snapshot.rows.find((row) => row.isin === "US5951121038")?.weight, 24.51);
  assert.equal(snapshot.rows.find((row) => row.nameKo === "SK하이닉스")?.weight, 24.45);
  assert.equal(snapshot.rows.find((row) => row.isin === "JP3236330001")?.weight, 3.89);
  assert.equal(snapshot.rows.find((row) => row.isin === "KRD010010001")?.weight, 1.2);
  assert.ok(Math.abs(snapshot.rows.reduce((sum, row) => sum + row.weight, 0) - 100) < 0.000001);
  assert.equal(
    snapshot.rows.reduce((sum, row) => sum + row.valuationKrw, 0),
    486297518,
  );
  assert.equal(
    snapshot.rows.some((row) => row.isin === "CASH00000001"),
    false,
  );
  assert.equal(snapshot.issuerUrl, null);
  assert.match(snapshot.source, /과거 자료/);
});

test("historical upload provenance identifies the exact file and only its exact ETF", () => {
  assert.equal(
    SNAPSHOT.provenance.sha256,
    "8181d3c7bf15076729cf0293acc7bb0fc7b447e02dd5fbb12a60610e58a9b730",
  );
  assert.equal(SNAPSHOT.provenance.byteLength, 6144);
  assert.match(SNAPSHOT.provenance.filename, /신한SOL글로벌DRAM반도체플러스/);
  assert.equal(findUploadedIssuerHoldingsSnapshot("069500"), null);
  assert.equal(findUploadedIssuerHoldingsSnapshot("0246X"), null);
  const a = findUploadedIssuerHoldingsSnapshot("0246X0")!;
  a.rows[0]!.weight = 0;
  a.provenance.sha256 = "changed";
  const b = findUploadedIssuerHoldingsSnapshot("0246X0")!;
  assert.equal(b.rows[0]!.weight, 25.23);
  assert.equal(b.provenance.sha256, SNAPSHOT.provenance.sha256);
});

test("SOL catalog finds issuer-published exact-code links and rejects external links", () => {
  const html = `<a href="/ko/fund/etf/999998">SOL 다른상품 (0246X1)</a>
    <a href="/ko/fund/etf/999999">SOL 글로벌DRAM반도체플러스</a><span>종목코드 0246X0</span>
    <a href="https://attacker.example/ko/fund/etf/999999">0246X0</a>`;
  assert.deepEqual(parseSolCatalog(html, "0246X0"), [PRODUCT_URL]);
  assert.deepEqual(parseSolCatalog(html, "INVALID"), []);
});

test("SOL product identity rejects similar names and a ticker present only in holdings", () => {
  assert.equal(parseSolProductPage(PRODUCT_PAGE, "0246X0", PRODUCT_URL)?.issuerUrl, PRODUCT_URL);
  const other = PRODUCT_PAGE.replace("<dd>0246X0</dd>", "<dd>999999</dd>");
  assert.equal(parseSolProductPage(other, "0246X0", PRODUCT_URL), null);
  assert.equal(parseSolProductPage(PRODUCT_PAGE, "005930", PRODUCT_URL), null);
  assert.equal(
    parseSolProductPage(PRODUCT_PAGE, "0246X0", "https://attacker.example/ko/fund/etf/999999"),
    null,
  );
});

test("SOL published table weights retain decimals, JPY holding and cash without renormalizing", () => {
  const basket = parseSolHoldingsHtml(PRODUCT_PAGE);
  assert.ok(basket);
  assert.equal(basket.asOf, "2026-10-08");
  assert.equal(basket.rows.length, 11);
  assert.equal(basket.rows.find((row) => row.isin === "JP3236330001")?.weight, 3.89);
  assert.equal(basket.rows.find((row) => row.isin === "JP3236330001")?.quantity, 119.18);
  assert.equal(basket.rows.find((row) => row.isin === "KRD010010001")?.weight, 1.2);
  assert.equal(basket.rows.find((row) => row.code === "005930")?.weight, 25.23);
});

test("missing dates, invalid dates, quantity-only and incomplete tables fail closed", () => {
  assert.equal(parseSolHoldingsHtml(TABLE.replace("기준일 : 2026.10.08", "")), null);
  assert.equal(parseSolHoldingsHtml(TABLE.replace("2026.10.08", "2026.13.45")), null);
  assert.equal(parseSolHoldingsHtml(TABLE.replace("비중(%)", "평가비율없음")), null);
  assert.equal(parseSolHoldingsHtml(TABLE.replace("25.23%", "-")), null);
  assert.equal(parseSolHoldingsHtml(TABLE.replace("25.23%", "20.23%")), null);
});

test("SOL live adapter follows published catalog, validates identity and returns exact product URL", async () => {
  const calls: string[] = [];
  const fetcher = fixtureFetch(
    {
      [`${SOL_WEBSITE_URL}/`]: `<a href="/ko/fund/etf/list">전체 ETF 상품</a>`,
      [CATALOG_URL]: `<a href="/ko/fund/etf/999999">SOL 글로벌DRAM반도체플러스 (0246X0)</a>`,
      [PRODUCT_URL]: PRODUCT_PAGE,
    },
    calls,
  );
  const result = await fetchSolOfficialHoldings("0246X0", { fetcher });
  assert.ok(result);
  assert.equal(result.productId, "999999");
  assert.equal(result.issuerUrl, PRODUCT_URL);
  assert.equal(result.asOf, "2026-10-08");
  assert.equal(result.rows.find((row) => row.isin === "JP3236330001")?.weight, 3.89);
  assert.deepEqual(calls, [
    `${SOL_WEBSITE_URL}/api/etf/pds?searchText=&page=1`,
    `${SOL_WEBSITE_URL}/`,
    CATALOG_URL,
    PRODUCT_URL,
  ]);
});

test("SOL product resolver remains usable independently of a JS-only holdings table", async () => {
  const fetcher = fixtureFetch({
    [`${SOL_WEBSITE_URL}/`]: `<a href="/ko/fund/etf/999999">SOL 글로벌DRAM반도체플러스 (0246X0)</a>`,
    [PRODUCT_URL]: PRODUCT_PAGE.replace(TABLE, '<div id="holdings"></div>'),
  });
  assert.equal((await resolveSolProduct("0246X0", { fetcher }))?.issuerUrl, PRODUCT_URL);
  assert.equal(await fetchSolOfficialHoldings("0246X0", { fetcher }), null);
});

test("inaccessible SOL site does not use an uploaded snapshot as live data or guess a URL", async () => {
  const fetcher = (async () => {
    throw new Error("CONNECT tunnel failed, response 403");
  }) as typeof fetch;
  assert.equal(await fetchSolOfficialHoldings("0246X0", { fetcher }), null);
  assert.equal(await resolveSolProduct("0246X0", { fetcher }), null);
});

test("SOL discovery rejects a wrong product even when a catalog mislabels it", async () => {
  const fetcher = fixtureFetch({
    [`${SOL_WEBSITE_URL}/`]: `<a href="/ko/fund/etf/999999">SOL 글로벌DRAM반도체플러스 (0246X0)</a>`,
    [PRODUCT_URL]: PRODUCT_PAGE.replace("<dd>0246X0</dd>", "<dd>999999</dd>"),
  });
  assert.equal(await fetchSolOfficialHoldings("0246X0", { fetcher }), null);
});

const PDF_ITEMS = SNAPSHOT.rows.map((row) => ({
  STOCK_CODE: row.code ?? row.isin,
  SEC_NM: row.nameKo,
  QTY: String(row.quantity),
  PRICE: String(row.valuationKrw),
  WT_DISP: `${row.weight}%`,
  WORK_DT: "20261008",
}));

test("SOL JSON PDF parser takes WT_DISP only and excludes CU notional", () => {
  const items = [
    ...PDF_ITEMS.map((row) => ({ ...row, QTY: "99999999", PRICE: "1" })),
    {
      STOCK_CODE: "CASH00000001",
      SEC_NM: "100%현금설정액",
      QTY: "486297518",
      PRICE: "486297518",
      WT_DISP: "",
      WORK_DT: "20261008",
    },
  ];
  const basket = parseSolPdfRows(items, "20261008");
  assert.ok(basket);
  assert.equal(basket.rows.length, 11);
  assert.equal(basket.rows.find((row) => row.isin === "JP3236330001")?.weight, 3.89);
  assert.equal(basket.rows.find((row) => row.isin === "KRD010010001")?.weight, 1.2);
  assert.equal(basket.rows.find((row) => row.code === "005930")?.weight, 25.23);
  assert.equal(basket.asOf, "2026-10-08");
});

test("SOL JSON PDF rejects missing/invalid dates, mixed dates and incomplete percent columns", () => {
  assert.equal(parseSolPdfRows(PDF_ITEMS, "20261301"), null);
  assert.equal(parseSolPdfRows(PDF_ITEMS, "wrong"), null);
  assert.equal(parseSolPdfRows(PDF_ITEMS, "20261007"), null);
  assert.equal(
    parseSolPdfRows(
      PDF_ITEMS.map((row) => ({ ...row, WORK_DT: "" })),
      null,
    ),
    null,
  );
  assert.equal(parseSolPdfRows(PDF_ITEMS.slice(0, 3), "20261008"), null);
  assert.equal(
    parseSolPdfRows(
      PDF_ITEMS.map((row, index) => (index ? row : { ...row, WT_DISP: "" })),
      "20261008",
    ),
    null,
  );
});

test("SOL current PDF API links exact ETF_CD6 to FUND_CD across catalog pages", async () => {
  const calls: string[] = [];
  const fetcher = fixtureFetch(
    {
      [`${SOL_WEBSITE_URL}/api/etf/pds?searchText=&page=1`]: JSON.stringify({
        items: [{ ETF_CD6: "999998", FUND_CD: "999998", ETF_NAME: "SOL 글로벌DRAM반도체플러스" }],
        toalPage: 2,
      }),
      [`${SOL_WEBSITE_URL}/api/etf/pds?searchText=&page=2`]: JSON.stringify({
        items: [{ ETF_CD6: "0246X0", FUND_CD: "999999", ETF_NAME: "SOL 글로벌DRAM반도체플러스" }],
        toalPage: 2,
      }),
      [`${SOL_WEBSITE_URL}/api/etf/pds/pdf/999999`]: JSON.stringify({
        workDt: "20261008",
        items: PDF_ITEMS,
      }),
    },
    calls,
  );
  const result = await fetchSolOfficialHoldings("0246X0", { fetcher });
  assert.ok(result);
  assert.equal(result.issuerUrl, PRODUCT_URL);
  assert.equal(result.rows.find((row) => row.isin === "JP3236330001")?.weight, 3.89);
  assert.deepEqual(calls, [
    `${SOL_WEBSITE_URL}/api/etf/pds?searchText=&page=1`,
    `${SOL_WEBSITE_URL}/api/etf/pds?searchText=&page=2`,
    `${SOL_WEBSITE_URL}/api/etf/pds/pdf/999999`,
  ]);
});

test("SOL API product resolver verifies a reachable product page and rejects generic 200 pages", async () => {
  const api = `${SOL_WEBSITE_URL}/api/etf/pds?searchText=&page=1`;
  const catalog = JSON.stringify({
    items: [{ ETF_CD6: "0246X0", FUND_CD: "999999", ETF_NAME: "SOL 글로벌DRAM반도체플러스" }],
  });
  const good = fixtureFetch({ [api]: catalog, [PRODUCT_URL]: PRODUCT_PAGE });
  assert.equal((await resolveSolProduct("0246X0", { fetcher: good }))?.issuerUrl, PRODUCT_URL);
  const generic = fixtureFetch({
    [api]: catalog,
    [PRODUCT_URL]: "<title>SOL ETF</title><h1>메인</h1>",
  });
  assert.equal(await resolveSolProduct("0246X0", { fetcher: generic }), null);
});

test("SOL overall deadline aborts requests and prevents an additional fallback crawl", async () => {
  const calls: string[] = [];
  let aborted = false;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => {
          aborted = true;
          reject(new Error("aborted"));
        },
        { once: true },
      );
    });
  }) as typeof fetch;
  assert.equal(await fetchSolOfficialHoldings("0246X0", { fetcher, deadlineMs: 25 }), null);
  assert.equal(aborted, true);
  assert.equal(calls.length, 1);
  const alreadyAborted = new AbortController();
  alreadyAborted.abort();
  assert.equal(await resolveSolProduct("0246X0", { fetcher, signal: alreadyAborted.signal }), null);
  assert.equal(calls.length, 1);
});

test("SOL concurrent products share successful catalog pages while fetching their own PDF baskets", async () => {
  const calls: string[] = [];
  const api = `${SOL_WEBSITE_URL}/api/etf/pds?searchText=&page=1`;
  const fetcher = fixtureFetch(
    {
      [api]: JSON.stringify({
        items: [
          { ETF_CD6: "0246X2", FUND_CD: "999992", ETF_NAME: "SOL 테스트 상품 2" },
          { ETF_CD6: "0246X3", FUND_CD: "999993", ETF_NAME: "SOL 테스트 상품 3" },
        ],
      }),
      [`${SOL_WEBSITE_URL}/api/etf/pds/pdf/999992`]: JSON.stringify({
        workDt: "20261008",
        items: PDF_ITEMS,
      }),
      [`${SOL_WEBSITE_URL}/api/etf/pds/pdf/999993`]: JSON.stringify({
        workDt: "20261008",
        items: PDF_ITEMS,
      }),
    },
    calls,
  );
  const results = await Promise.all([
    fetchSolOfficialHoldings("0246X2", { fetcher, catalogCache: true }),
    fetchSolOfficialHoldings("0246X3", { fetcher, catalogCache: true }),
  ]);
  assert.ok(results.every((result) => result != null));
  assert.equal(calls.filter((url) => url === api).length, 1);
  assert.equal(calls.filter((url) => url.includes("/pdf/")).length, 2);
  await fetchSolOfficialHoldings("0246X2", { fetcher, catalogCache: true });
  assert.equal(calls.filter((url) => url === api).length, 1);
  assert.equal(calls.filter((url) => url.includes("/pdf/")).length, 3);
});
