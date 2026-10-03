import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "etf-market.ts"),
  "utf8",
);

test("normalizeEtfCode delegates to normalizeKrTicker (keeps 0226A0)", () => {
  assert.match(src, /export function normalizeEtfCode[\s\S]*return normalizeKrTicker\(code\)/);
});

test("battery theme stocks do not include POSCO Holdings 005490", () => {
  const m = src.match(/if \(\/2차전지\|배터리\|양극\/\.test\(n\)\) \{\s*add\(([^)]+)\)/);
  assert.ok(m, "battery add() block missing");
  assert.ok(!m[1]!.includes("005490"), m[1]);
  assert.ok(m[1]!.includes("003670"));
});

test("airline ETFs are excluded from defense theme stocks", () => {
  assert.match(src, /항공운송/);
  assert.match(src, /방산\|우주항공\|항공우주/);
  assert.doesNotMatch(src, /if \(\/방산\|우주\|항공\/\.test/);
});

test("US equity names are not lumped into Korean AI theme stocks", () => {
  assert.match(src, /!\/미국\|S&P\|나스닥\|필라델피아\|해외\/\.test\(n\)/);
});

test("numeric 200 theme keyword is name-only (not years in descriptions)", () => {
  assert.match(src, /keyword === "200"/);
  assert.match(src, /themeKeywordHits/);
});

test("issuer PDF weights are not replaced by a qty×price rescale", () => {
  assert.match(src, /chooseOfficialBasket/);
  assert.match(src, /fetchIbkOfficialHoldings/);
  assert.match(src, /fetchKodexOfficialHoldings/);
  assert.match(src, /issuerHoldingsFamily/);
  assert.match(src, /family === "plus" \? fetchPlusOfficialHoldings/);
  assert.match(src, /fetchHanaroOfficialHoldings/);
  assert.match(src, /family === "hanaro"/);
  assert.doesNotMatch(src, /krw \/ sum/);
  assert.doesNotMatch(src, /cu-value/);
});

test("bundle does not rescale holdings to 100%", () => {
  const bundle = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../lib/market-fns.ts"),
    "utf8",
  );
  assert.doesNotMatch(bundle, /applyCuValueWeights/);
});
