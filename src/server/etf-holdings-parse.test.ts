import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  applyCuValueWeights,
  chooseOfficialBasket,
  compareHoldingsByWeight,
  isCuNotionalName,
  issuerHoldingsFamily,
  krCodeFromIsin,
  matchIbkProductId,
  parseHanaroFundCatalog,
  parseHanaroHoldingsHtml,
  parseHanaroPdfDate,
  parseIbkPdfRows,
  parseKodexPdfRows,
  parseRiseFundCdFromFinder,
  parseRisePdfHoldingsHtml,
  parseRiseTop10Html,
} from "./etf-holdings-parse.ts";

const RISE_PDF = `
<tr>
<th scope="row" class="center">1</th>
<td class="align_right">설정현금액</td>
<td class="align_right">CASH00000001</td>
<td class="align_right">511,940,695</td>
<td class="align_right">100</td>
<td class="align_right">511,940,695</td>
</tr>
<tr>
<th scope="row" class="center">2</th>
<td class="align_right">삼성전자</td>
<td class="align_right">KR7005930003</td>
<td class="align_right">383.5</td>
<td class="align_right">19.55</td>
<td class="align_right">100,093,500</td>
</tr>
<tr>
<th scope="row" class="center">3</th>
<td class="align_right">SK하이닉스</td>
<td class="align_right">KR7000660001</td>
<td class="align_right">56.5</td>
<td class="align_right">18.68</td>
<td class="align_right">95,654,500</td>
</tr>
<tr>
<th scope="row" class="center">4</th>
<td class="align_right">Sandisk Corp</td>
<td class="align_right">US80004C2008</td>
<td class="align_right">40.6</td>
<td class="align_right">17.03</td>
<td class="align_right">87,168,430</td>
</tr>
<tr>
<th scope="row" class="center">12</th>
<td class="align_right">원화예금</td>
<td class="align_right">KRD010010001</td>
<td class="align_right">6,047,043</td>
<td class="align_right">1.18</td>
<td class="align_right">6,047,043</td>
</tr>
`;

const FINDER = `
<p><a href="/prod/finderDetail/44L0">RISE 글로벌AI낸드메모리반도체</a></p>
<span class="code">(0233N0)</span>
`;

const TOP10 = `
<h3 class="heading03">TOP10 구성 종목</h3>
<table>
<caption>TOP10 구성 종목 : 순위, 보유종목, 비중(%) 표</caption>
<tbody>
<tr><td>1</td><td>삼성전자</td><td>19.55</td></tr>
<tr><td>2</td><td>SK하이닉스</td><td>18.68</td></tr>
<tr><td>3</td><td>Sandisk Corp</td><td>17.03</td></tr>
</tbody>
</table>
`;

test("krCodeFromIsin extracts KRX ticker and ignores cash ISIN", () => {
  assert.equal(krCodeFromIsin("KR7005930003"), "005930");
  assert.equal(krCodeFromIsin("KR7000660001"), "000660");
  assert.equal(krCodeFromIsin("KRD010010001"), null);
  assert.equal(krCodeFromIsin("US80004C2008"), null);
});

test("KR7 alphanumeric equity codes remain exact while bonds and derivatives never become stocks", () => {
  assert.equal(krCodeFromIsin("KR70177R0000"), "0177R0");
  assert.equal(krCodeFromIsin(" kr70177r0000 "), "0177R0");
  assert.equal(krCodeFromIsin("KR1035017901"), null);
  assert.equal(krCodeFromIsin("KR4101000000"), null);
  assert.equal(krCodeFromIsin("KR7005930003EXTRA"), null);
  assert.equal(krCodeFromIsin("KR7005930"), null);
  const rows = parseIbkPdfRows([
    { name: "국고채권", pdfCode: "KR1035017901", weight: 25 },
    { name: "현대적 코드 ETF", pdfCode: "KR70177R0000", weight: 75 },
  ], "2026-10-08");
  assert.equal(rows.find((row) => row.isin === "KR1035017901")!.code, null);
  assert.equal(rows.find((row) => row.isin === "KR70177R0000")!.code, "0177R0");
});

test("preferred-share ISIN class encodings are never mistaken for trading codes", () => {
  assert.equal(krCodeFromIsin("KR7005931001"), null, "Samsung preferred is 005935, never encoded substring 005931");
  assert.equal(krCodeFromIsin("KR7051911006"), null, "LG Chem preferred is 051915, never encoded substring 051911");
  const byIsin = parseIbkPdfRows([{ name: "삼성전자우", pdfCode: "KR7005931001", weight: 100 }], "2026-10-19");
  assert.equal(byIsin[0]!.code, null);
  assert.equal(byIsin[0]!.isin, "KR7005931001");
  assert.equal(byIsin[0]!.weight, 100);
  const explicit = parseKodexPdfRows([{ secNm: "삼성전자우", itmNo: "005935", ratio: "100" }], "2026-10-19");
  assert.equal(explicit[0]!.code, "005935", "an explicit issuer trading code remains authoritative");
});

test("duplicate securities and oversized percentages cannot establish an official basket", () => {
  for (const rows of [
    [{ nameKo: "삼성전자", weight: 50 }, { nameKo: "삼성전자", weight: 50 }],
    [{ nameKo: "삼성전자", weight: 101 }, { nameKo: "현금", weight: -1 }],
  ]) {
    const choice = chooseOfficialBasket([{ rows, source: "issuer", sourceKind: "issuer-pdf", priority: 100, asOf: "2026-10-08" }]);
    assert.equal(choice.weightsPublished, false);
    assert.ok(choice.rows.every((row) => row.weight == null));
  }
});

test("설정현금액 is a CU notional row, 원화예금 is not", () => {
  assert.equal(isCuNotionalName("설정현금액"), true);
  assert.equal(isCuNotionalName("원화예금"), false);
  assert.equal(isCuNotionalName("삼성전자"), false);
});

test("parseRiseFundCdFromFinder maps 0233N0 to 44L0", () => {
  assert.equal(parseRiseFundCdFromFinder(FINDER, "0233N0"), "44L0");
  assert.equal(parseRiseFundCdFromFinder(FINDER, "069500"), null);
});

test("parseRisePdfHoldingsHtml skips 설정현금액 and keeps official weights", () => {
  const rows = parseRisePdfHoldingsHtml(RISE_PDF, "2026-09-02");
  assert.equal(rows.some((r) => r.nameKo === "설정현금액"), false);
  const samsung = rows.find((r) => r.nameKo === "삼성전자");
  assert.ok(samsung);
  assert.equal(samsung!.weight, 19.55);
  assert.equal(samsung!.quantity, 383.5);
  assert.equal(samsung!.code, "005930");
  const sandisk = rows.find((r) => r.nameKo === "Sandisk Corp");
  assert.ok(sandisk);
  assert.equal(sandisk!.weight, 17.03);
  assert.equal(sandisk!.isin, "US80004C2008");
  const cash = rows.find((r) => r.nameKo === "원화예금");
  assert.ok(cash);
  assert.equal(cash!.weight, 1.18);
});

test("parseRiseTop10Html reads issuer TOP10 weights", () => {
  const rows = parseRiseTop10Html(TOP10, "2026-09-02");
  assert.equal(rows.length, 3);
  assert.equal(rows[0]!.nameKo, "삼성전자");
  assert.equal(rows[0]!.weight, 19.55);
});

test("applyCuValueWeights never invents or rescales NAV weights", () => {
  const rows = applyCuValueWeights(
    [
      {
        nameKo: "삼성전자",
        weight: null,
        quantity: 440,
        quote: { price: 285500, currency: "KRW" as const },
      },
      {
        nameKo: "NVIDIA CORP",
        weight: null,
        quantity: 390,
        quote: { price: 180, currency: "USD" as const },
      },
      {
        nameKo: "국고03875-2612(23-10)",
        weight: null,
        quantity: 0,
        quote: null,
      },
    ],
    1400,
    512_578_176,
  );
  assert.equal(rows[0]!.weight, null);
  assert.equal(rows[1]!.weight, null);
  assert.equal(rows[2]!.weight, null);
});

const IBK_PDF = [
  { name: "설정현금액", pdfCode: "CASH00000001", quantity: 512578176, weight: 100 },
  { name: "국고03875-2612(23-10)", pdfCode: "KR103501GDC8", quantity: 125000000, weight: 24.6966 },
  { name: "삼성전자", pdfCode: "KR7005930003", quantity: 440, weight: 24.5075 },
  { name: "NVIDIA CORP", pdfCode: "US67066G1040", quantity: 390, weight: 23.6549 },
  { name: "한국투자 ACE 단기자금 증권 상장지수투자신탁(채권)", pdfCode: "KR7190620005", quantity: 222, weight: 4.4233 },
  { name: "KB KBRISE 단기통안ETF", pdfCode: "KR7196230007", quantity: 193, weight: 4.4082 },
  { name: "신한 SOL KIS단기통안채증권상장지수투자신탁[채권]", pdfCode: "KR7363510009", quantity: 201, weight: 4.4033 },
  { name: "TIGER 단기통안채증권상장지수", pdfCode: "KR7157450008", quantity: 200, weight: 4.3976 },
  { name: "키움 KIWOOM 통안채상장지수증권투자신탁[채권]", pdfCode: "KR7122260003", quantity: 215, weight: 4.3723 },
  { name: "삼성 KODEX 머니마켓액티브증권상장지수투자신탁[채권]", pdfCode: "KR7488770009", quantity: 196, weight: 4.0397 },
  { name: "원화현금", pdfCode: "KRD010010001", quantity: 5621448, weight: 1.0967 },
];

test("IBK PDF keeps issuer NAV weights and sorts by weight desc", () => {
  const rows = parseIbkPdfRows(IBK_PDF, "2026-09-23");
  assert.equal(rows.some((r) => r.nameKo === "설정현금액"), false);
  assert.equal(rows[0]!.nameKo, "국고03875-2612(23-10)");
  assert.equal(rows[1]!.nameKo, "삼성전자");
  assert.equal(rows[2]!.nameKo, "NVIDIA CORP");
  assert.equal(rows.at(-1)!.nameKo, "원화현금");
  assert.equal(rows.find((r) => r.nameKo === "삼성전자")!.weight, 24.5075);
  assert.equal(rows.find((r) => r.nameKo === "NVIDIA CORP")!.weight, 23.6549);
  assert.equal(rows.find((r) => r.nameKo === "삼성전자")!.code, "005930");
  const sum = rows.reduce((s, r) => s + (r.weight ?? 0), 0);
  assert.ok(Math.abs(sum - 100) < 0.01, String(sum));
});

test("holdings sort is strictly by weight, not input order", () => {
  const rows = [
    { nameKo: "A", weight: 20, quantity: 9 },
    { nameKo: "B", weight: 50, quantity: 1 },
    { nameKo: "C", weight: 30, quantity: 3 },
  ].sort(compareHoldingsByWeight);
  assert.deepEqual(rows.map((r) => r.nameKo), ["B", "C", "A"]);
});

test("chooseOfficialBasket prefers complete issuer PDF over a renormalized sleeve", () => {
  const chosen = chooseOfficialBasket([
    {
      rows: [
        { nameKo: "삼성전자", weight: 35.11, quantity: 440, asOf: null, code: "005930", isin: null },
        { nameKo: "NVIDIA CORP", weight: 33.48, quantity: 390, asOf: null, code: null, isin: "US67066G1040" },
        { nameKo: "ACE 단기통안채", weight: 31.41, quantity: 222, asOf: null, code: null, isin: null },
      ],
      source: "수량×시세 100% 환산",
      sourceKind: "wisereport-cu",
      priority: 10,
    },
    {
      rows: parseIbkPdfRows(IBK_PDF, "2026-09-23"),
      source: "IBK PDF",
      sourceKind: "issuer-pdf",
      priority: 100,
    },
  ]);
  assert.equal(chosen.weightsPublished, true);
  assert.equal(chosen.source, "IBK PDF");
  assert.equal(chosen.rows[1]!.nameKo, "삼성전자");
  assert.equal(chosen.rows[1]!.weight, 24.5075);
  assert.equal(chosen.rows[2]!.weight, 23.6549);
});

test("incomplete CU weights are stripped instead of shown as NAV %", () => {
  const chosen = chooseOfficialBasket([
    {
      rows: [
        { nameKo: "삼성전자", weight: null, quantity: 440 },
        { nameKo: "NVIDIA CORP", weight: null, quantity: 390 },
      ],
      source: "WiseReport",
      sourceKind: "wisereport-cu",
      priority: 50,
    },
  ]);
  assert.equal(chosen.weightsPublished, false);
  assert.equal(chosen.rows.every((r) => r.weight == null), true);
  assert.equal(chosen.rows[0]!.nameKo, "삼성전자");
});

test("parseKodexPdfRows reads ratio and skips 설정현금액", () => {
  const rows = parseKodexPdfRows(
    [
      { secNm: "설정현금액", applyQ: "616610892", itmNo: "CASH00000001", ratio: null },
      { secNm: "삼성전자", applyQ: "6930", itmNo: "005930", ratio: "34.24" },
      { secNm: "INTEL Corp", applyQ: "991.37", itmNo: "INTC US Equity", ratio: "26.75" },
    ],
    "2026-09-23",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.nameKo, "삼성전자");
  assert.equal(rows[0]!.weight, 34.24);
  assert.equal(rows[0]!.code, "005930");
  assert.equal(rows[1]!.weight, 26.75);
  assert.equal(rows[1]!.code, null);
  assert.equal(rows[1]!.foreignTicker, "INTC");
  assert.equal(rows[1]!.tradingCountry, "USA");
});

test("official US ticker/venue survives parsing without guessing a Reuters exchange suffix", () => {
  const rows = parseKodexPdfRows([
    { secNm: "ALPHABET INC-CL A", itmNo: "GOOGL US Equity", ratio: "25" },
    { secNm: "ALPHABET INC-CL C", itmNo: "GOOG US Equity", ratio: "25" },
    { secNm: "BERKSHIRE HATHAWAY CL B ORD.", itmNo: "BRK/B US Equity", ratio: "25" },
    { secNm: "Six-letter US security", itmNo: "ABCDEF US Equity", ratio: "25" },
  ], "2026-10-19");
  assert.deepEqual(rows.map((row) => row.foreignTicker), ["GOOGL", "GOOG", "BRK/B", "ABCDEF"]);
  assert.ok(rows.every((row) => row.tradingCountry === "USA" && row.code == null));
  assert.ok(rows.every((row) => !String(row.foreignTicker).endsWith(".O") && !String(row.foreignTicker).endsWith(".N")));
});

test("issuer family and IBK name match the legal catalog title", () => {
  assert.equal(
    issuerHoldingsFamily("IBK 한미대표기업TOP2+채권혼합50액티브", "IBK자산운용"),
    "ibk",
  );
  assert.equal(issuerHoldingsFamily("KODEX 200", "삼성자산운용"), "kodex");
  assert.equal(issuerHoldingsFamily("HANARO 미국에이전틱AI TOP2+", "NH-Amundi자산운용"), "hanaro");
  assert.equal(issuerHoldingsFamily("TIGER 미국나스닥100", "미래에셋자산운용"), "other");
  assert.equal(
    matchIbkProductId("IBK 한미대표기업TOP2+채권혼합50액티브", [
      { id: 1, name: "IBK 200 증권상장지수투자신탁[주식]" },
      { id: 14, name: "IBK 한미대표기업TOP2+채권혼합50액티브상장지수투자신탁[채권혼합]" },
    ]),
    14,
  );
});

test("HANARO PDF drops the CU notional row and keeps US NAV weights", () => {
  const html = `
    <tr><td>1</td><td>CASH00000001</td><th>설정현금액</th><td>527,001,759</td><td>527,001,759</td><td>100.0</td></tr>
    <tr><td>2</td><td>US5949181045</td><th>Microsoft Corp</th><td>179</td><td>121,293,437</td><td>23.02</td></tr>
    <tr><td>3</td><td>KR7005930003</td><th>삼성전자</th><td>10</td><td>1,000</td><td>73.84</td></tr>
    <tr><td>4</td><td>KRD010010001</td><th>원화예금</th><td>1,000</td><td>1,000</td><td>3.14</td></tr>
  `;
  const rows = parseHanaroHoldingsHtml(html, "2026-09-23");
  assert.equal(rows.some((r) => r.nameKo === "설정현금액"), false);
  assert.equal(rows.find((r) => r.nameKo === "Microsoft Corp")!.weight, 23.02);
  assert.equal(rows.find((r) => r.nameKo === "Microsoft Corp")!.isin, "US5949181045");
  assert.equal(rows.find((r) => r.nameKo === "Microsoft Corp")!.code, null);
  assert.equal(rows.find((r) => r.nameKo === "삼성전자")!.code, "005930");
  const chosen = chooseOfficialBasket([
    { rows, source: "HANARO", sourceKind: "issuer-pdf", priority: 100, asOf: "2026-09-23" },
  ]);
  assert.equal(chosen.weightsPublished, true);
  assert.equal(chosen.rows.find((r) => r.nameKo === "Microsoft Corp")!.weight, 23.02);
});

test("HANARO catalog and PDF date", () => {
  const html = `<a href="/fund/E5B1094831A64EB6" class="baseInfo"><dt>종목코드</dt><dd>0227L0</dd></a>
    <input id="pdfDate" value="2026.09.23" />`;
  assert.equal(parseHanaroFundCatalog(html).get("0227L0"), "E5B1094831A64EB6");
  assert.equal(parseHanaroPdfDate(html), "2026-09-23");
});

test("third-party 100% weights are never published as issuer weights", () => {
  const chosen = chooseOfficialBasket([{rows:[{nameKo:"Kioxia",weight:86.12},{nameKo:"삼성전자",weight:13.88}],source:"third-party",sourceKind:"wisereport-cu",priority:1000}]);
  assert.equal(chosen.weightsPublished,false);
  assert.ok(chosen.rows.every(row=>row.weight===null));
});

test("issuer cash notional is excluded but actual cash stays", () => {
  assert.equal(isCuNotionalName("100%현금설정액"),true);
  assert.equal(isCuNotionalName("현금성자산"),false);
});

test("partially missing issuer weights do not publish a partial basket", () => {
  const chosen=chooseOfficialBasket([{rows:[{nameKo:"삼성전자",weight:100},{nameKo:"채권",weight:null}],source:"issuer",sourceKind:"issuer-pdf",priority:100}]);
  assert.equal(chosen.weightsPublished,false);
});

test("SOL routes to Shinhan official source",()=>{
  assert.equal(issuerHoldingsFamily("SOL 글로벌DRAM반도체플러스","신한자산운용"),"sol");
});

test("newer dated issuer publication wins and quoted data cannot change weights", () => {
  const chosen = chooseOfficialBasket([
    { rows: [{ nameKo: "Kioxia", weight: 3.89 }, { nameKo: "other", weight: 96.11 }], source: "uploaded issuer XLS", sourceKind: "issuer-file", priority: 80, asOf: "2026-10-08" },
    { rows: [{ nameKo: "Kioxia", weight: 4 }, { nameKo: "other", weight: 96 }], source: "older live issuer", sourceKind: "issuer-pdf", priority: 100, asOf: "2026-10-07" },
    { rows: [{ nameKo: "Kioxia", weight: 86.12 }, { nameKo: "other", weight: 13.88 }], source: "secondary quote table", sourceKind: "wisereport-cu", priority: 1000, asOf: "2026-10-09" },
  ]);
  assert.equal(chosen.source, "uploaded issuer XLS");
  assert.equal(chosen.rows.find(row => row.nameKo === "Kioxia")!.weight, 3.89);
});

test("a 90% issuer subset is not expanded or published as the full fund", () => {
  const chosen = chooseOfficialBasket([{ rows: [{ nameKo: "stock", weight: 90 }], source: "partial", sourceKind: "issuer-pdf", priority: 100 }]);
  assert.equal(chosen.weightsPublished, false);
  assert.equal(chosen.rows[0]!.weight, null);
});

test("newer row-dated issuer data outranks an older high-priority envelope date", () => {
  const newer = { rows: [{ nameKo: "NVIDIA CORP", weight: 99, asOf: "2026-10-09" }, { nameKo: "현금", weight: 1, asOf: "2026-10-09" }], source: "newer rows", sourceKind: "issuer-pdf" as const, priority: 80 };
  const older = { rows: [{ nameKo: "NVIDIA CORP", weight: 98, asOf: "2026-10-08" }, { nameKo: "현금", weight: 2, asOf: "2026-10-08" }], source: "older envelope", sourceKind: "issuer-pdf" as const, priority: 100, asOf: "2026-10-08" };
  for (const candidates of [[newer, older], [older, newer]]) {
    const chosen = chooseOfficialBasket(candidates);
    assert.equal(chosen.source, "newer rows");
    assert.equal(chosen.asOf, "2026-10-09");
    assert.equal(chosen.rows[0]!.weight, 99);
  }
});

test("invalid or mixed dates cannot become the displayed reference-basket date", () => {
  for (const rows of [
    [{ nameKo: "A", weight: 50, asOf: "2026-10-08" }, { nameKo: "B", weight: 50, asOf: "2026-10-09" }],
    [{ nameKo: "A", weight: 100, asOf: "2026-02-30" }],
  ]) {
    const chosen = chooseOfficialBasket([{ rows, source: "conflicting issuer", sourceKind: "issuer-pdf", priority: 100 }]);
    assert.equal(chosen.weightsPublished, false);
    assert.equal(chosen.asOf, null);
  }
});

test("verified full KODEX-shaped basket retains 503 explicit ratios when only actual cash is unweighted", () => {
  // Actual issuer response: 503 security percentages, one unweighted cash row,
  // and a CU notional. Source URL and raw-response hash live in the fixture.
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/kodex-sp500-20261019.json", import.meta.url), "utf8"));
  assert.equal(fixture.product.stkTicker, "379800");
  assert.equal(fixture.pdf.totalCnt, fixture.pdf.list.length);
  assert.equal(fixture.pdf.gijunYMD, "20261019");
  const rows = parseKodexPdfRows(fixture.pdf.list, "2026-10-19");
  assert.equal(rows.length, 504);
  assert.equal(rows.filter((row) => row.tradingCountry === "USA").length, 503);
  assert.equal(rows.find((row) => row.nameKo === "ALPHABET INC-CL A")!.foreignTicker, "GOOGL");
  assert.equal(rows.find((row) => row.nameKo === "ALPHABET INC-CL C")!.foreignTicker, "GOOG");
  assert.equal(rows.find((row) => row.nameKo === "BERKSHIRE HATHAWAY CL B ORD.")!.foreignTicker, "BRK/B");
  const candidate = { rows, source: "verified full KODEX PDF", sourceKind: "issuer-pdf" as const, priority: 100, asOf: "2026-10-19" };
  assert.equal(chooseOfficialBasket([candidate]).weightsPublished, false, "default policy stays strict");
  const chosen = chooseOfficialBasket([{ ...candidate, allowUnweightedCash: true }]);
  assert.equal(chosen.weightsPublished, true);
  assert.equal(chosen.rows.filter((row) => row.weight != null).length, 503);
  assert.ok(Math.abs(chosen.rows.reduce((sum, row) => sum + (row.weight ?? 0), 0) - 100.11) < 1e-9);
  assert.equal(chosen.rows.find((row) => row.isin === "KRD010010001")!.weight, null);
  for (const item of fixture.pdf.list) {
    if (item.ratio != null) assert.equal(chosen.rows.find((row) => row.nameKo === item.secNm)!.weight, Number(item.ratio));
  }
});

test("unweighted-cash exception rejects missing stock/bond weights, unconfirmed cash and incomplete sleeves", () => {
  const published = { nameKo: "NVIDIA CORP", weight: 100 as number | null, isin: "US67066G1040" };
  for (const missing of [
    { nameKo: "Apple Inc", weight: null, isin: "US0378331005" },
    { nameKo: "국고채권", weight: null, isin: "KR1035017901" },
    { nameKo: "원화현금", weight: null, isin: null },
    { nameKo: "확인되지 않은 종목", weight: null, isin: "KRD010010001" },
  ]) {
    const chosen = chooseOfficialBasket([{ rows: [published, missing], source: "issuer", sourceKind: "issuer-pdf", priority: 100, asOf: "2026-10-19", allowUnweightedCash: true }]);
    assert.equal(chosen.weightsPublished, false);
    assert.ok(chosen.rows.every((row) => row.weight == null));
  }
  const cash = { nameKo: "원화현금", weight: null, isin: "KRD010010001" };
  const incomplete = chooseOfficialBasket([{ rows: [{ ...published, weight: 90 }, cash], source: "issuer", sourceKind: "issuer-pdf", priority: 100, asOf: "2026-10-19", allowUnweightedCash: true }]);
  assert.equal(incomplete.weightsPublished, false);
  const thirdParty = chooseOfficialBasket([{ rows: [published, cash], source: "secondary table", sourceKind: "wisereport-cu", priority: 100, asOf: "2026-10-19", allowUnweightedCash: true }]);
  assert.equal(thirdParty.weightsPublished, false);
});
