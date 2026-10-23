import assert from "node:assert/strict";
import { test } from "node:test";
import { retainMarketQuoteCoverage } from "./market-snapshot-cache.ts";
import { createSnapshotCache } from "./snapshot-cache.ts";

const quote = (code: string, minute: string, price = 100) => ({ code, price, changePct: -1, tradedAt: `2026-10-23T09:${minute}:00+09:00`, fetchedAt: `2026-10-23T00:${minute}:01Z` });

test("a 145-row snapshot survives a one-row refresh with original per-row dates and explicit stale coverage", async () => {
  let at = 100_000;
  const original = Array.from({ length: 145 }, (_, index) => quote(String(900000 + index), "00"));
  const codes = original.map(row => row.code);
  let response = original;
  const cache = createSnapshotCache({ load: async () => response, usable: rows => rows.length > 0, ttlMs: 10, now: () => at, reconcile: (before, next) => retainMarketQuoteCoverage(before ?? [], next, codes) });
  assert.equal((await cache()).stale, false);
  at += 100;
  const actualUpdate = quote(codes[0]!, "01", 99);
  response = [actualUpdate];
  const partial = await cache();
  assert.equal(partial.data.length, 145);
  assert.equal(partial.data[0], actualUpdate);
  for (let index = 1; index < original.length; index++) {
    assert.equal(partial.data[index], original[index], "retained rows keep their actual price and both original dates");
  }
  assert.equal(partial.stale, true);
  const cachedPartial = await cache();
  assert.equal(cachedPartial.cached, true);
  assert.equal(cachedPartial.stale, true, "a TTL cache hit cannot promote partial coverage to fresh");
  assert.equal(cachedPartial.fetchedAt, partial.fetchedAt);
  at += 100;
  response = codes.map(code => quote(code, "02", 98));
  const recovered = await cache();
  assert.equal(recovered.data.length, 145);
  assert.equal(recovered.stale, false);
  assert.ok(recovered.data.every(row => row.tradedAt === "2026-10-23T09:02:00+09:00"));
});

test("older, undated and invalid incoming rows cannot downgrade a verified newer observation", () => {
  const previous = quote("005930", "05", 100);
  for (const incoming of [quote("005930", "04", 90), { ...quote("005930", "06", 90), tradedAt: "invalid" }, quote("005930", "06", Number.NaN)]) {
    const merged = retainMarketQuoteCoverage([previous], [incoming]);
    assert.equal(merged.data[0], previous);
    assert.equal(merged.stale, true);
  }
  const newest = quote("005930", "06", 99);
  assert.deepEqual(retainMarketQuoteCoverage([previous], [newest]), { data: [newest], stale: false, accepted: true });
});

test("cold partial responses are explicit and unrelated securities do not satisfy the requested universe", () => {
  const row = quote("005930", "05");
  const unexpected = quote("999999", "05");
  assert.deepEqual(retainMarketQuoteCoverage([], [row, unexpected], ["005930", "000660"]), { data: [row], stale: true, accepted: true });
});

test("an older-only origin response cannot renew the saved snapshot receipt time", async () => {
  let at = 100_000, calls = 0;
  const original = quote("005930", "05");
  let response = [original];
  const cache = createSnapshotCache({ load: async () => { calls++; return response; }, usable: rows => rows.length > 0, ttlMs: 10, now: () => at, reconcile: (before, next) => retainMarketQuoteCoverage(before ?? [], next) });
  const saved = await cache();
  at += 100; response = [quote("005930", "04")];
  const fallback = await cache();
  assert.equal(fallback.data[0], original);
  assert.equal(fallback.fetchedAt, saved.fetchedAt);
  assert.equal(fallback.stale, true);
  assert.equal(fallback.cached, true);
  await cache();
  assert.equal(calls, 3, "rejected refreshes do not renew the successful-refresh TTL");
});
