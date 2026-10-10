import assert from "node:assert/strict";
import { test } from "node:test";
import { etfIssuerIdentity, fetchOfficialIssuerText, hasIssuerProductIdentity, isOfficialIssuerUrl, krxEtfIsin, parseIssuerProductLinks, resolveEtfIssuer } from "./etf-issuer.ts";

function fixtureFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => handler(String(input), init)) as typeof fetch;
}
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });

test("issuer brands include renamed families and distinguish Samsung active", () => {
  for (const [name, family] of [["KBSTAR 200", "rise"], ["KINDEX 미국S&P500", "ace"], ["ARIRANG 200", "plus"], ["KOSEF 200", "kiwoom"], ["TIME 글로벌AI인공지능액티브", "timefolio"], ["WON 반도체", "won"], ["1Q 미국나스닥100", "oneq"], ["KoAct 바이오헬스케어액티브", "koact"], ["SOL 글로벌DRAM반도체플러스", "sol"]]) assert.equal(etfIssuerIdentity(name!).family, family);
  assert.equal(etfIssuerIdentity("알 수 없는 상품", "삼성액티브자산운용").family, "koact");
  assert.equal(etfIssuerIdentity("알 수 없는 상품", "알 수 없는 운용사").websiteUrl, null);
});

test("official fetch allowlist rejects ports, credentials, other issuer hosts and redirects", async () => {
  for (const url of ["http://www.soletf.com/", "https://www.soletf.com.evil.test/", "https://user@www.soletf.com/", "https://www.soletf.com:444/", "https://www.samsungfund.com/"]) assert.equal(isOfficialIssuerUrl(url, "sol"), false);
  let calls = 0;
  await assert.rejects(fetchOfficialIssuerText("https://127.0.0.1/", "sol", { fetcher: fixtureFetch(() => { calls++; return new Response(); }) }));
  assert.equal(calls, 0);
  await assert.rejects(fetchOfficialIssuerText("https://www.soletf.com/", "sol", { fetcher: fixtureFetch(() => new Response(null, { status: 302, headers: { Location: "https://evil.test/private" } })) }), /redirect/);
});

test("product cards cannot borrow the next product's ticker or a homepage", () => {
  const html = `<li><a href="/prod/finderDetail/AAAA">RISE A</a><span>(111111)</span></li><li><a href="/prod/finderDetail/BBBB">RISE B</a><span>(0233N0)</span></li><a href="/">0233N0</a><a href="/product/overview">0233N0</a><li><a href="https://evil.test/view?id=1">0233N0</a></li>`;
  assert.deepEqual(parseIssuerProductLinks(html, "0233N0", "https://www.riseetf.co.kr/prod/finder", "rise"), ["https://www.riseetf.co.kr/prod/finderDetail/BBBB"]);
  assert.deepEqual(parseIssuerProductLinks(`<article><a href="/prod/finderDetail/AAAA">111111</a><a href="/prod/finderDetail/BBBB">B</a><span>0233N0</span></article>`, "0233N0", "https://www.riseetf.co.kr/", "rise"), []);
});

test("product identity accepts metadata tables but cannot come from another ETF's holdings", () => {
  assert.equal(hasIssuerProductIdentity(`<h1>RISE 글로벌AI낸드메모리반도체</h1><table><tr><th>종목코드</th><td>0233N0</td></tr></table>`, "0233N0", "RISE 글로벌AI낸드메모리반도체"), true);
  assert.equal(hasIssuerProductIdentity(`<h1>다른 ETF</h1><table><th>종목명</th><th>비중</th><td>0233N0</td></table>`, "0233N0", "다른 ETF"), false);
  assert.equal(hasIssuerProductIdentity(`<h1>RISE 상품</h1><p>123456</p>`, "0233N0", "RISE 상품"), false);
  assert.equal(hasIssuerProductIdentity(`<h1>RISE 다른 ETF</h1><p>종목코드 111111</p><aside><h2>RISE 대상 ETF</h2><p>종목코드 123456</p></aside>`, "123456", "RISE 대상 ETF"), false);
  assert.equal(hasIssuerProductIdentity(`<h1>RISE 다른 ETF</h1><p>종목코드 111111</p><div><h2>RISE 대상 ETF</h2><p>종목코드 123456</p></div>`, "123456", "RISE 대상 ETF"), false);
  assert.equal(hasIssuerProductIdentity(`<h1>RISE 다른 ETF</h1><p>111111</p><h2>RISE 대상 ETF</h2><p>123456</p>`, "123456", "RISE 대상 ETF"), false);
});

test("KRX ISIN candidate checksum supports six-character alphanumeric ETF tickers", () => {
  assert.equal(krxEtfIsin("139260"), "KR7139260004");
  assert.equal(krxEtfIsin("0177R0"), "KR70177R0000");
  assert.equal(krxEtfIsin("360750"), "KR7360750004");
  assert.equal(krxEtfIsin("../../"), null);
});

test("KODEX/PLUS/HANARO official catalogs resolve exact product identifiers", async () => {
  const kodex = await resolveEtfIssuer("069500", "KODEX 200", "", { fetcher: fixtureFetch(() => json([{ stkTicker: "069500", fId: "2ETF01", totalCnt: "1" }])) });
  assert.equal(kodex.issuerUrl, "https://www.samsungfund.com/etf/product/view.do?id=2ETF01");
  assert.equal(kodex.productId, "2ETF01");
  const plus = await resolveEtfIssuer("111111", "PLUS 테스트", "", { fetcher: fixtureFetch((_url, init) => { assert.equal(init?.method, "POST"); return json({ content: [{ id: "other", nameCode: "111112" }, { id: "exact", nameCode: "111111" }] }); }) });
  assert.equal(plus.issuerUrl, "https://www.plusetf.co.kr/product/detail?n=exact");
  const hanaro = await resolveEtfIssuer("123456", "HANARO 테스트", "", { fetcher: fixtureFetch(() => new Response(`<a href="/fund/F123A" class="baseInfo"><dt>종목코드</dt><dd>123456</dd></a>`)) });
  assert.equal(hanaro.issuerUrl, "https://www.hanaroetf.com/fund/F123A");
});

test("IBK direct links do not accept an ambiguous name prefix", async () => {
  const fetcher = fixtureFetch(() => json({ data: { content: [{ id: 1, name: "IBK 미국채권(H)" }, { id: 2, name: "IBK 미국채권" }] } }));
  const exact = await resolveEtfIssuer("111111", "IBK 미국채권", "", { fetcher });
  assert.equal(exact.issuerUrl, "https://www.ibkasset.com/etf/detail/2");
  const ambiguous = await resolveEtfIssuer("111111", "IBK 미국", "", { fetcher });
  assert.equal(ambiguous.issuerUrl, null);
});

test("current RISE catalog uses paginated kbam identifiers instead of an old search link", async () => {
  const product = await resolveEtfIssuer("0233N0", "RISE 글로벌AI낸드메모리반도체", "", { fetcher: fixtureFetch((url) => url.endsWith("page=1") ? json({ page_items: [{ krx_cd: "111111", fund_cd: "other" }], page_info: { next_page: 2, total_page: 2 } }) : json({ page_items: [{ krx_cd: "0233N0", fund_cd: "44L0" }], page_info: { next_page: null, total_page: 2 } })) });
  assert.equal(product.issuerUrl, "https://kbam.co.kr/products/44L0");
  assert.equal(product.productId, "44L0");
});

test("ACE and KoAct codes map through their own official JSON catalog", async () => {
  const ace = await resolveEtfIssuer("360750", "ACE 미국S&P500", "", { fetcher: fixtureFetch(() => json({ data: [{ stockCd: "KR7360750004", fundCd: "ace-fund" }] })) });
  assert.equal(ace.issuerUrl, "https://www.aceetf.co.kr/fund/ace-fund");
  const koact = await resolveEtfIssuer("462900", "KoAct 바이오헬스케어액티브", "", { fetcher: fixtureFetch(() => json([{ stkTicker: "462900", fId: "2ETFJ9" }])) });
  assert.equal(koact.issuerUrl, "https://www.samsungactive.co.kr/etf/view.do?id=2ETFJ9");
});

test("TIGER and KIWOOM code-shaped candidate URLs require official page identity", async () => {
  const fetcher = fixtureFetch((url) => new Response(url.includes("ksdFund=") ? `<h1>TIGER 미국S&P500</h1><p>종목코드 360750</p>` : "홈페이지"));
  const tiger = await resolveEtfIssuer("360750", "TIGER 미국S&P500", "", { fetcher });
  assert.equal(tiger.issuerUrl, "https://investments.miraeasset.com/tigeretf/ko/product/search/detail/index.do?ksdFund=KR7360750004");
  const unresolved = await resolveEtfIssuer("360750", "KIWOOM 미국S&P500", "", { fetcher });
  assert.equal(unresolved.issuerUrl, null);
  assert.equal(unresolved.status, "unresolved");
});

test("blocked catalogs and unknown issuers return honest unavailable status", async () => {
  const blocked = await resolveEtfIssuer("069500", "KODEX 200", "", { fetcher: fixtureFetch(() => new Response("Blocked", { status: 403 })) });
  assert.equal(blocked.issuerUrl, null);
  assert.equal(blocked.status, "unresolved");
  assert.ok(blocked.websiteUrl);
  let calls = 0;
  const unknown = await resolveEtfIssuer("123456", "새로운발행사 ETF", "", { fetcher: fixtureFetch(() => { calls++; return new Response(); }) });
  assert.equal(unknown.status, "unsupported");
  assert.equal(calls, 0);
});
