import assert from "node:assert/strict";
import { test } from "node:test";
import { holdingQuoteCurrency } from "./etf-currency.ts";

test("Kioxia Tokyo prices remain JPY instead of being treated as dollars", () => {
  assert.equal(holdingQuoteCurrency("JPY", "285A.T"), "JPY");
  assert.equal(holdingQuoteCurrency("엔", "285A.T"), "JPY");
  assert.equal(holdingQuoteCurrency(undefined, "285A.T"), "JPY");
});
test("unknown overseas currencies stay unknown and provider currency wins", () => {
  assert.equal(holdingQuoteCurrency(undefined, "UNKNOWN"), null);
  assert.equal(holdingQuoteCurrency("EUR", "UNKNOWN"), "EUR");
  assert.equal(holdingQuoteCurrency("USD", "MU.O"), "USD");
});
