import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeEtfListQuote, normalizeWorldHoldingQuote } from "./etf-quote-normalization.ts";

test("ETF list keeps actual SOL fall and normalizes an unsigned falling magnitude", () => {
  for (const amount of [-680, 680]) {
    const quote = normalizeEtfListQuote({ nowVal: 7770, changeVal: amount, changeRate: 8.05, risefall: "5", quant: 705272, nav: 7882 });
    assert.equal(quote?.change, -680);
    assert.equal(quote?.changePct, -8.05);
    assert.equal(quote?.tradedAt, undefined);
  }
});

test("missing/invalid ETF prices or change are not invented as zero", () => {
  assert.equal(normalizeEtfListQuote({ nowVal: null, changeVal: 0, changeRate: 0 }), null);
  assert.equal(normalizeEtfListQuote({ nowVal: 100, changeRate: 0 }), null);
  assert.equal(normalizeEtfListQuote({ nowVal: 100, changeVal: 0, changeRate: 0 })?.change, 0);
  assert.equal(normalizeEtfListQuote({ nowVal: 100, changeVal: 0, changeRate: 0 })?.navAvailable, false);
  assert.equal(normalizeEtfListQuote({ nowVal: 100, changeVal: 0, changeRate: 0 })?.volumeValid, false);
});

test("foreign quote sign comes from provider direction and preserves its New York time", () => {
  const quote = normalizeWorldHoldingQuote({ reutersCode: "MU.O", closePrice: "912.00", compareToPreviousClosePrice: "2.13", fluctuationsRatio: "0.23", compareToPreviousPrice: { code: "5" }, localTradedAt: "2026-10-15T11:22:52-04:00" }, "MU.O");
  assert.equal(quote?.change, -2.13);
  assert.equal(quote?.changePct, -0.23);
  assert.equal(quote?.tradedAt, "2026-10-15T11:22:52-04:00");
  assert.equal(quote?.volumeValid, false);
});

test("foreign missing change, another symbol and zone-less source time fail safely", () => {
  assert.equal(normalizeWorldHoldingQuote({ reutersCode: "MU.O", closePrice: 912 }, "MU.O"), null);
  assert.equal(normalizeWorldHoldingQuote({ reutersCode: "AMAT.O", closePrice: 912, compareToPreviousClosePrice: 0 }, "MU.O"), null);
  assert.equal(normalizeWorldHoldingQuote({ reutersCode: "MU.O", closePrice: 912, compareToPreviousClosePrice: 0, localTradedAt: "2026-10-15T11:22:52" }, "MU.O")?.tradedAt, undefined);
});
