/** Integration fixtures only: no real credential or external request is used. */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { strToU8, zipSync } from "fflate";
import { createServer } from "vite";

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENDART_API_KEY;
const cacheDir = mkdtempSync(join(tmpdir(), "k-equity-opendart-pipeline-"));
const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const date = today.replaceAll("-", "");
const stocks = {
  "005930": "00126380",
  "000660": "00164779",
  "000270": "00106641",
  "0001A0": "00999999",
};
const names = {
  "005930": "삼성전자",
  "000660": "SK하이닉스",
  "000270": "기아",
  "0001A0": "테스트 기업",
};
const archive = zipSync({
  "CORPCODE.xml": strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><result>${Object.entries(stocks)
      .map(
        ([stock, corp]) =>
          `<list><corp_code>${corp}</corp_code><corp_name>${names[stock]}</corp_name><stock_code>${stock}</stock_code><modify_date>${date}</modify_date></list>`,
      )
      .join("")}</result>`,
  ),
});
let phase = "success";
let archiveCalls = 0;
let legacyCalls = 0;
let slowOptionalSources = false;
const json = (data) =>
  new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
const receipt = (stock, sequence, market = "Y") => ({
  corp_cls: market,
  corp_name: names[stock],
  corp_code: stocks[stock],
  stock_code: stock,
  report_nm: "TEST FIXTURE 공식 공시",
  rcept_no: date + sequence,
  rcept_dt: date,
  flr_nm: names[stock],
});
const htmlRow = (stock, sequence) =>
  `<tr><td><a href="javascript:openCorpInfoNew('${stocks[stock]}');">${names[stock]}</a></td><td><a href="/dsaf001/main.do?rcpNo=${date + sequence}">TEST FIXTURE 웹 대체 공시</a></td><td><span class="webOnly">${today.replaceAll("-", ".")}</span> 14:30</td></tr>`;

// Install before SSR import: the production client captures its transport once.
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  if (slowOptionalSources && ["kind.krx.co.kr", "m.stock.naver.com"].includes(url.hostname)) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (url.hostname === "opendart.fss.or.kr") {
    assert.equal(
      url.searchParams.get("crtfc_key"),
      phase === "success" ? "a".repeat(40) : "b".repeat(40),
    );
    if (url.pathname === "/api/corpCode.xml") {
      archiveCalls++;
      if (phase === "invalid-key")
        return new Response(
          `<result><status>010</status><message>TEST FIXTURE untrusted provider text</message></result>`,
        );
      return new Response(archive);
    }
    assert.equal(url.pathname, "/api/list.json");
    assert.equal(url.searchParams.get("page_count"), "100");
    const company = url.searchParams.get("corp_code");
    if (company === stocks["000270"])
      return json({ status: "013", message: "조회된 데이타가 없습니다." });
    if (company) {
      const stock = Object.keys(stocks).find((code) => stocks[code] === company);
      assert.ok(stock, "the request uses the exact official corporation code");
      return json({ status: "000", list: [receipt(stock, "000001"), receipt(stock, "000002")] });
    }
    const market = url.searchParams.get("corp_cls");
    assert.ok(market === "Y" || market === "K");
    return json({
      status: "000",
      list: [
        receipt(market === "Y" ? "005930" : "000660", market === "Y" ? "000004" : "000003", market),
      ],
    });
  }
  if (url.hostname === "dart.fss.or.kr") {
    legacyCalls++;
    return new Response(
      `<table>${htmlRow("005930", "000005")}${htmlRow("000660", "000006")}</table>`,
    );
  }
  if (url.hostname === "kind.krx.co.kr")
    return new Response("<html>TEST FIXTURE no KIND records</html>");
  if (url.hostname === "m.stock.naver.com") return json([]);
  throw new Error("TEST FIXTURE: unexpected destination");
};
process.env.OPENDART_API_KEY = "a".repeat(40);
const server = await createServer({
  configFile: false,
  cacheDir,
  resolve: { alias: { "@": resolve("src") } },
  server: { middlewareMode: true },
  logLevel: "error",
});
try {
  const module = await server.ssrLoadModule("/src/server/krx-disclosures.ts");
  const [samsung, hynix, alphanumeric] = await Promise.all([
    module.fetchStockDisclosureBundle("005930", "삼성전자"),
    module.fetchStockDisclosureBundle("000660", "SK하이닉스"),
    module.fetchStockDisclosureBundle("0001A0", "테스트 기업"),
  ]);
  assert.equal(archiveCalls, 1, "parallel company requests share the official corporation archive");
  for (const [stock, pack] of [
    ["005930", samsung],
    ["000660", hynix],
    ["0001A0", alphanumeric],
  ]) {
    assert.equal(pack.openDart.state, "ok");
    assert.equal(pack.openDart.configured, true);
    assert.equal(pack.openDart.fallbackUsed, false);
    assert.equal(pack.dart.length, 2);
    assert.equal(pack.items[0].rcpNo, date + "000002");
    for (const item of pack.dart) {
      assert.equal(item.code, stock);
      assert.equal(item.corpCode, stocks[stock]);
      assert.equal(item.datetime, today);
      assert.equal(item.sourceLabel, "OpenDART(금감원)");
      assert.equal(item.canLoadBody, false);
      assert.equal(item.dartUrl, `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcpNo}`);
    }
  }
  const empty = await module.fetchStockDisclosureBundle("000270", "기아");
  assert.equal(empty.openDart.state, "empty");
  assert.equal(empty.dart.length, 0);
  const unknown = await module.fetchStockDisclosureBundle("999999", "삼성전자");
  assert.equal(unknown.openDart.state, "company-not-found");
  assert.equal(unknown.dart.length, 0);
  assert.equal(
    legacyCalls,
    0,
    "empty responses and unknown identities must not use a name-search fallback",
  );
  const market = await module.fetchKrxDisclosureDesk({ scanCodes: [] });
  assert.equal(market.openDart.state, "ok");
  assert.deepEqual(
    market.dart.map((row) => row.code),
    ["005930", "000660"],
  );
  assert.equal(market.all.length, 2);

  phase = "invalid-key";
  process.env.OPENDART_API_KEY = "b".repeat(40);
  const fallback = await module.fetchStockDisclosureBundle("005930", "삼성전자");
  assert.equal(fallback.openDart.state, "invalid-key");
  assert.equal(fallback.openDart.fallbackUsed, true);
  assert.equal(fallback.dart.length, 1, "legacy results for another company must be rejected");
  assert.equal(fallback.dart[0].code, "005930");
  assert.equal(fallback.dart[0].sourceLabel, "DART 웹페이지(대체)");
  assert.ok(
    !JSON.stringify(fallback).includes("b".repeat(40)),
    "public status does not contain the credential",
  );
  assert.ok(!JSON.stringify(fallback).includes("untrusted provider text"));
  phase = "success";
  process.env.OPENDART_API_KEY = "a".repeat(40);
  slowOptionalSources = true;
  const started = Date.now();
  const boundedFeed = await module.fetchKrxDisclosureDesk({
    scanCodes: ["005930"],
    sourceBudgetMs: 25,
  });
  assert.ok(
    Date.now() - started < 180,
    "slow optional providers must not exceed the feed polling budget",
  );
  assert.equal(boundedFeed.openDart.state, "ok");
  assert.equal(boundedFeed.dart.length, 2);
  assert.equal(boundedFeed.kind.available, false);
  assert.match(boundedFeed.kind.message, /조회 시간/);
  console.log(
    "OpenDART pipeline fixtures passed: official code mapping (including alphanumeric), parallel archive reuse, date-only receipt ordering, official viewer links, authoritative empty results, unknown-company rejection, market aggregation, key rotation, explicit safe web fallback and retention of official data despite slow optional providers. No live API or real credential used.",
  );
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENDART_API_KEY;
  else process.env.OPENDART_API_KEY = originalKey;
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
