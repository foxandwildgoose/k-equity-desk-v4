import assert from "node:assert/strict";
import { test } from "node:test";
import { createSnapshotCache } from "./snapshot-cache.ts";

test("concurrent cold visitors share one actual snapshot acquisition", async () => {
  let calls = 0;
  let release!: (value: number[]) => void;
  const cache = createSnapshotCache({ load: () => { calls++; return new Promise<number[]>(resolve => { release = resolve; }); }, usable: rows => rows.length > 0, ttlMs: 30_000, now: () => 100_000 });
  const first = cache(), second = cache(), third = cache();
  assert.equal(calls, 1);
  release([1]);
  const results = await Promise.all([first, second, third]);
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[1], results[2]);
  assert.equal(results[0]!.cached, false);
  assert.equal((await cache()).cached, true);
  assert.equal(calls, 1);
});

test("empty and failed refreshes retain the actual snapshot and its original receipt time", async () => {
  let at = 100_000, next: number[] | Error = [1];
  const cache = createSnapshotCache({ load: async () => { if (next instanceof Error) throw next; return next; }, usable: rows => rows.length > 0, ttlMs: 10, now: () => at });
  const original = await cache();
  for (const failed of [[], new Error("upstream unavailable")]) {
    at += 100;
    next = failed;
    const fallback = await cache();
    assert.deepEqual(fallback.data, [1]);
    assert.equal(fallback.fetchedAt, original.fetchedAt);
    assert.equal(fallback.cached, true);
    assert.equal(fallback.stale, true);
  }
  at += 100; next = [2];
  const fresh = await cache();
  assert.deepEqual(fresh.data, [2]);
  assert.notEqual(fresh.fetchedAt, original.fetchedAt);
  assert.equal(fresh.stale, false);
});

test("a failed cold acquisition releases the slot and cannot become a successful cached observation", async () => {
  let calls = 0;
  const cache = createSnapshotCache({ load: async () => { if (++calls === 1) throw new Error("failed"); return []; }, usable: (rows: number[]) => rows.length > 0, ttlMs: 30_000 });
  await assert.rejects(cache(), /failed/);
  assert.equal((await cache()).stale, true);
  assert.equal((await cache()).cached, false);
  assert.equal(calls, 3);
});
