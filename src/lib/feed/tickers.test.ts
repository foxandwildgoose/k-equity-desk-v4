import assert from "node:assert/strict";
import { test } from "node:test";
import { buildKrTickerIndex, tagKrTickers, buildUsTickerIndex, tagUsTickers } from "./tickers.ts";

// synthetic fixture (format sample), not market data
const KR = buildKrTickerIndex([
  { code: "003550", nameKo: "LG" },
  { code: "373220", nameKo: "LG에너지솔루션" },
  { code: "066570", nameKo: "LG전자" },
  { code: "005930", nameKo: "삼성전자" },
  { code: "000660", nameKo: "SK하이닉스" },
  { code: "000000", nameKo: "가" },
]);

test("AT-11: longest name wins — LG is never tagged inside LG에너지솔루션", () => {
  assert.deepEqual(tagKrTickers("LG에너지솔루션, 북미 공장 증설", KR), [{ market: "KR", code: "373220" }]);
  assert.deepEqual(
    tagKrTickers("LG전자·LG에너지솔루션 동반 강세, LG 지주도", KR).map((t) => t.code),
    ["066570", "373220", "003550"],
  );
  assert.deepEqual(tagKrTickers("LGD 신고가", KR), []);
});

test("exact 6-char codes tag only known tickers; names < 2 chars ignored", () => {
  assert.deepEqual(tagKrTickers("(005930) 외국인 순매수", KR), [{ market: "KR", code: "005930" }]);
  assert.deepEqual(tagKrTickers("거래대금 100000원 돌파", KR), []);
  assert.deepEqual(tagKrTickers("가나다", KR), []);
});

test("US tagging: cashtags, exchange notation, exact company names", () => {
  const US = buildUsTickerIndex([
    { symbol: "NVDA", names: ["Nvidia", "NVIDIA"] },
    { symbol: "ISRG", names: ["Intuitive Surgical"] },
    { symbol: "TSLA", names: ["Tesla"] },
  ]);
  assert.deepEqual(tagUsTickers("$NVDA rallies as Tesla (NASDAQ: TSLA) slips", US).map((t) => t.code), ["NVDA", "TSLA"]);
  assert.deepEqual(tagUsTickers("Intuitive Surgical beats estimates", US).map((t) => t.code), ["ISRG"]);
  assert.deepEqual(tagUsTickers("Teslas everywhere", US), []);
});
