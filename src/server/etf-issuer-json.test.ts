import assert from "node:assert/strict";
import { test } from "node:test";
import type { EtfIssuerProduct } from "./etf-issuer.ts";
import { fetchStructuredIssuerHoldings, koActIssuerReferenceDate, parseAceIssuerHoldings, parseKiwoomIssuerHoldings, parseKoActIssuerHoldings } from "./etf-issuer-json.ts";

// Synthetic official response shapes, not snapshots of actual ETF portfolios.
const ACE = { pdfList: [
  { sec_NM: "삼성전자", jm_KSC_CD: "KR7005930003", wg: "98.75", cu_ITEM_CNT: "1,200", std_DT: "20261008" },
  { secNm: "원화예금", jmKscCd: "KRD010010001", wg: "1.20", cuItemCnt: "1", stdDt: "20261008" },
  { secNm: "설정현금액", jmKscCd: "CASH00000001", wg: "100", stdDt: "20261008" },
  { secNm: "합계", wg: "100", stdDt: "20261008" },
] };
const KIWOOM = { pdfList: [
  { itemTitle: "삼성전자", gcode: "005930", ratio: "98.75%", businessDate: "2026.10.08", volume: "1,200" },
  { itemTitle: "원화현금", itemCode: "KRD010010001", ratio: "1.20", businessDate: "2026.10.08", volume: "1" },
  { itemTitle: "설정현금액", gcode: "CASH00000001", ratio: "100" },
] };
const KOACT = { pdf: { gijunYMD: "20261008", list: [
  { secNm: "삼성전자", itmNo: "005930", ratio: "98.75", applyQ: "1,200" },
  { secNm: "원화예금", itmNo: "KRD010010001", ratio: "1.20", applyQ: "1" },
  { secNm: "설정현금액", itmNo: "CASH00000001", applyQ: "10000000" },
] } };
const META = { info: { product: { fId: "TESTFID", stkTicker: "999999" } }, suik: { standardList: [{ EVAL_D: "20261008", F_P: "10000" }] } };
function product(family: "ace" | "kiwoom" | "koact"): EtfIssuerProduct {
  const issuerUrl = family === "ace" ? "https://www.aceetf.co.kr/fund/TESTFUND" : family === "kiwoom" ? "https://www.kiwoometf.com/service/etf/KO02010200M?gcode=999999" : "https://www.samsungactive.co.kr/etf/view.do?id=TESTFID";
  return { family, issuerName: "", issuerUrl, websiteUrl: null, status: "resolved", productId: family === "ace" ? "TESTFUND" : family === "kiwoom" ? "999999" : "TESTFID" };
}
function fixtureFetch(payloads: unknown[], calls: { url: string; init?: RequestInit }[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const payload = payloads.shift();
    return new Response(JSON.stringify(payload ?? {}), { status: 200 });
  }) as typeof fetch;
}

test("ACE full PDF preserves published percentages, ISIN and actual cash; omits CU and totals", () => {
  const result = parseAceIssuerHoldings(ACE);
  assert.ok(result);
  assert.equal(result.asOf, "2026-10-08");
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map((row) => row.weight), [98.75, 1.2]);
  assert.equal(result.rows[0]!.code, "005930");
  assert.equal(result.rows[0]!.isin, "KR7005930003");
  assert.equal(result.rows[0]!.quantity, 1200);
  assert.equal(result.rows[1]!.isin, "KRD010010001");
  assert.equal(result.rows.reduce((sum, row) => sum + row.weight!, 0), 99.95);
  assert.deepEqual(parseAceIssuerHoldings({ content: ACE.pdfList }), result);
});

test("ACE rejects partial baskets, missing weights and absent/conflicting/invalid dates", () => {
  assert.equal(parseAceIssuerHoldings({ pdfList: [ACE.pdfList[0]] }), null);
  for (const change of [{ wg: null }, { std_DT: null }, { std_DT: "20260230" }, { std_DT: "20261007" }, { stdDt: "20261007" }]) {
    const rows = structuredClone(ACE.pdfList);
    Object.assign(rows[0]!, change);
    assert.equal(parseAceIssuerHoldings({ pdfList: rows }), null, JSON.stringify(change));
  }
  assert.equal(parseAceIssuerHoldings({ pdfList: [] }), null);
  assert.equal(parseAceIssuerHoldings({ pdfList: [{ wg: 100, std_DT: "20261008" }] }), null);
});

test("JSON completeness rejects duplicate securities/names and oversized weights", () => {
  assert.equal(parseAceIssuerHoldings({ pdfList: [{ ...ACE.pdfList[0], wg: "50" }, { ...ACE.pdfList[0], wg: "50" }] }), null);
  assert.equal(parseKiwoomIssuerHoldings({ pdfList: [
    { itemTitle: "중복 종목", ratio: "50", businessDate: "20261008" },
    { itemTitle: "중복 종목", ratio: "50", businessDate: "20261008" },
  ] }), null);
  assert.equal(parseAceIssuerHoldings({ pdfList: [{ ...ACE.pdfList[0], wg: "110" }, { ...ACE.pdfList[1], wg: "-10" }] }), null);
});

test("official Korean ISINs preserve modern alphanumeric KRX security codes", () => {
  const result = parseAceIssuerHoldings({ pdfList: [{ ...ACE.pdfList[0], jm_KSC_CD: "KR70177R0000", wg: "100" }] });
  assert.ok(result);
  assert.equal(result.rows[0]!.code, "0177R0");
  assert.equal(result.rows[0]!.isin, "KR70177R0000");
});

test("KIWOOM preserves actual cash and each businessDate without requested-date inference", () => {
  const result = parseKiwoomIssuerHoldings(KIWOOM);
  assert.ok(result);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[1]!.weight, 1.2);
  assert.equal(result.rows[1]!.isin, "KRD010010001");
  assert.equal(result.asOf, "2026-10-08");
  for (const change of [{ businessDate: null }, { businessDate: "2026.10.07" }, { businessDate: "10.08" }, { ratio: "-" }]) {
    const rows = structuredClone(KIWOOM.pdfList);
    Object.assign(rows[1]!, change);
    assert.equal(parseKiwoomIssuerHoldings({ pdfList: rows }), null);
  }
});

test("KoAct PDF date labels the entire complete basket and keeps actual deposits", () => {
  const result = parseKoActIssuerHoldings(KOACT);
  assert.ok(result);
  assert.equal(result.asOf, "2026-10-08");
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map((row) => row.asOf), ["2026-10-08", "2026-10-08"]);
  assert.equal(result.rows[1]!.weight, 1.2);
  assert.equal(parseKoActIssuerHoldings({ pdf: { list: KOACT.pdf.list } }), null);
  assert.equal(parseKoActIssuerHoldings({ pdf: { gijunYMD: "20261008", list: [{ ...KOACT.pdf.list[0], gijunYMD: "20261007" }, KOACT.pdf.list[1]] } }), null);
  assert.equal(parseKoActIssuerHoldings({ pdf: { gijunYMD: "20261008", list: [{ ...KOACT.pdf.list[0], ratio: null }, KOACT.pdf.list[1]] } }), null);
});

test("KoAct reference date uses issuer-confirmed dates rather than the current day", () => {
  assert.equal(koActIssuerReferenceDate(META), "2026-10-08");
  assert.equal(koActIssuerReferenceDate({ suik: { standardList: [{ EVAL_D: "20261007" }, { EVAL_D: "20261008" }] } }), "2026-10-08");
  assert.equal(koActIssuerReferenceDate({ suik: { standardList: [{ EVAL_D: "20260230" }] } }), null);
  assert.equal(koActIssuerReferenceDate({}), null);
});

test("ACE adapter selects only the resolved fund's verified official API", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const official = product("ace");
  const result = await fetchStructuredIssuerHoldings("999999", "ACE 테스트", official, { fetcher: fixtureFetch([ACE], calls) });
  assert.ok(result);
  assert.equal(result.issuerUrl, official.issuerUrl);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, "https://papi.aceetf.co.kr/api/funds/TESTFUND/pdf?page=1&size=1000");
  assert.equal(calls[0]!.init?.redirect, "manual");
});

test("KIWOOM adapter posts the exact ticker and Korean current query date, retaining returned date", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const result = await fetchStructuredIssuerHoldings("999999", "KIWOOM 테스트", product("kiwoom"), { fetcher: fixtureFetch([KIWOOM], calls) });
  assert.ok(result);
  assert.equal(result.asOf, "2026-10-08");
  assert.equal(calls[0]!.url, "https://www.kiwoometf.com/service/etf/KO02010200MAjax4");
  assert.equal(calls[0]!.init?.method, "POST");
  const form = new URLSearchParams(String(calls[0]!.init?.body));
  assert.equal(form.get("schGubun1"), "999999");
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "");
  assert.equal(form.get("startDate"), day);
});

test("KoAct adapter queries a verified metadata day and labels returned actual PDF day", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const result = await fetchStructuredIssuerHoldings("999999", "KoAct 테스트", product("koact"), { fetcher: fixtureFetch([META, KOACT], calls) });
  assert.ok(result);
  assert.equal(result.asOf, "2026-10-08");
  assert.deepEqual(calls.map((call) => call.url), [
    "https://www.samsungactive.co.kr/api/v1/product/etf/TESTFID.do",
    "https://www.samsungactive.co.kr/api/v1/product/etf-pdf/TESTFID.do?gijunYMD=2026.10.08",
  ]);
});

test("KoAct fails closed when metadata ticker/id/date or the returned PDF date conflicts/is absent", async () => {
  for (const meta of [{ ...META, info: { product: { stkTicker: "888888" } } }, { ...META, info: { product: { fId: "OTHERFID" } } }, { info: META.info }]) {
    const calls: { url: string; init?: RequestInit }[] = [];
    assert.equal(await fetchStructuredIssuerHoldings("999999", "KoAct 테스트", product("koact"), { fetcher: fixtureFetch([meta, KOACT], calls) }), null);
    assert.equal(calls.length, 1);
  }
  assert.equal(await fetchStructuredIssuerHoldings("999999", "KoAct 테스트", product("koact"), { fetcher: fixtureFetch([META, { pdf: { list: KOACT.pdf.list } }]) }), null);
  assert.equal(await fetchStructuredIssuerHoldings("999999", "KoAct 테스트", product("koact"), { fetcher: fixtureFetch([META, { ...KOACT, fId: "OTHERFID" }]) }), null);
});

test("adapters reject unresolved, cross-family, unsafe, ambiguous and mismatched products before fetching", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = fixtureFetch([ACE], calls);
  for (const official of [
    { ...product("ace"), status: "unresolved" as const },
    { ...product("ace"), issuerUrl: "https://attacker.example/fund/TESTFUND" },
    { ...product("ace"), issuerUrl: "https://www.aceetf.co.kr/fund/%2Fetc" },
    { ...product("ace"), productId: "OTHER" },
    { ...product("kiwoom"), issuerUrl: "https://www.kiwoometf.com/service/etf/KO02010200M?gcode=888888" },
    { ...product("kiwoom"), issuerUrl: "https://www.kiwoometf.com/service/etf/KO02010200M?gcode=999999&gcode=888888" },
    { ...product("koact"), issuerUrl: "https://www.samsungactive.co.kr/etf/view.do?id=TESTFID&id=OTHER" },
  ]) {
    assert.equal(await fetchStructuredIssuerHoldings("999999", `${official.family === "koact" ? "KoAct" : official.family.toUpperCase()} 테스트`, official, { fetcher }), null);
  }
  assert.equal(await fetchStructuredIssuerHoldings("999999", "KIWOOM 테스트", product("ace"), { fetcher }), null);
  assert.equal(await fetchStructuredIssuerHoldings("BAD", "ACE 테스트", product("ace"), { fetcher }), null);
  assert.equal(calls.length, 0);
});

test("network errors, malformed JSON and non-official redirects cannot produce a basket", async () => {
  const offline = (async () => { throw new Error("network denied"); }) as typeof fetch;
  const invalid = (async () => new Response("{bad", { status: 200 })) as typeof fetch;
  const redirect = (async () => new Response(null, { status: 302, headers: { Location: "https://attacker.example/pdf" } })) as typeof fetch;
  for (const fetcher of [offline, invalid, redirect]) assert.equal(await fetchStructuredIssuerHoldings("999999", "ACE 테스트", product("ace"), { fetcher }), null);
});

test("an already-aborted shared issuer deadline prevents network work", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const controller = new AbortController();
  controller.abort();
  assert.equal(await fetchStructuredIssuerHoldings("999999", "ACE 테스트", product("ace"), { fetcher: fixtureFetch([ACE], calls), signal: controller.signal }), null);
  assert.equal(calls.length, 0);
});
