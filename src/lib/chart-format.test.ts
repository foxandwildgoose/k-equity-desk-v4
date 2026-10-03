import assert from "node:assert/strict";
import { test } from "node:test";
import { priceFormatFor, formatChartVolume, krxTickSize, snapToKrxTick, formatChartPrice } from "./chart-format.ts";

test("AT-06: KRW price scales are integers with separators; USD shows 2 decimals", () => {
  const kr = priceFormatFor("KR");
  assert.equal(kr.precision, 0);
  assert.equal(kr.minMove, 1);
  assert.equal(kr.formatter!(400000), "400,000");
  assert.equal(kr.formatter!(400000.4), "400,000");
  assert.equal(formatChartPrice(1234567, "KR"), "1,234,567");
  const us = priceFormatFor("US", 182.3);
  assert.equal(us.precision, 2);
  assert.equal(us.minMove, 0.01);
  assert.equal(formatChartPrice(182.3, "US"), "182.30");
  const penny = priceFormatFor("US", 0.45);
  assert.equal(penny.precision, 4);
  assert.equal(formatChartPrice(0.45, "US"), "0.4500");
});

test("volume units: 만/억 for KR, K/M/B for US", () => {
  assert.equal(formatChartVolume(35_000, "KR"), "3.5만");
  assert.equal(formatChartVolume(250_000_000, "KR"), "2.5억");
  assert.equal(formatChartVolume(1_500, "US"), "1.5K");
  assert.equal(formatChartVolume(12_340_000, "US"), "12.34M");
  assert.equal(formatChartVolume(2_000_000_000, "US"), "2.00B");
});

test("KRX tick table (stocks unified 2023) and ETF flat 5 KRW", () => {
  const cases: [number, number][] = [
    [1_999, 1], [2_000, 5], [4_995, 5], [5_000, 10], [19_990, 10], [20_000, 50], [49_950, 50],
    [50_000, 100], [199_900, 100], [200_000, 500], [499_500, 500], [500_000, 1_000], [1_234_000, 1_000],
  ];
  for (const [p, t] of cases) assert.equal(krxTickSize(p, "stock"), t, String(p));
  assert.equal(krxTickSize(12_345, "etf"), 5);
  assert.equal(krxTickSize(900, "etn"), 5);
  assert.equal(snapToKrxTick(71_234), 71_200);
  assert.equal(snapToKrxTick(12_347, "etf"), 12_345);
});
