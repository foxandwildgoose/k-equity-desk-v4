import assert from "node:assert/strict";
import { test } from "node:test";
import { createComtradeClient, parseComtradeResponse } from "./export-comtrade.ts";

const now = () => new Date("2026-10-20T16:00:00Z");
const row = (extra: Record<string, unknown> = {}) => ({
  period: 202609,
  reporterCode: 410,
  partnerCode: 0,
  partner2Code: 0,
  motCode: 0,
  customsCode: "C00",
  cmdCode: "TOTAL",
  flowCode: "X",
  primaryValue: 100,
  ...extra,
});
const json = (rows: unknown[]) => new Response(JSON.stringify({ count: rows.length, data: rows }));

test("Comtrade validates exact period, reporter, world, flow and aggregation dimensions", () => {
  const query = { period: "2026-09", codes: ["TOTAL"] };
  assert.equal(parseComtradeResponse({ data: [row()] }, query).length, 1);
  for (const invalid of [
    { period: 202608 },
    { reporterCode: 392 },
    { partnerCode: 842 },
    { partner2Code: 842 },
    { motCode: 1 },
    { customsCode: "C01" },
    { cmdCode: "85" },
    { flowCode: "RX" },
    { primaryValue: "" },
    { primaryValue: " " },
    { primaryValue: [] },
    { primaryValue: "0x100" },
    { primaryValue: -1 },
  ]) {
    assert.throws(() => parseComtradeResponse({ data: [row(invalid)] }, query));
  }
  assert.throws(() => parseComtradeResponse({ count: 2, data: [row()] }, query));
  assert.throws(() =>
    parseComtradeResponse({ data: Array.from({ length: 500 }, () => row()) }, query),
  );
  assert.equal(parseComtradeResponse({ data: [row(), row()] }, query).length, 1);
  assert.throws(() => parseComtradeResponse({ data: [row(), row({ primaryValue: 101 })] }, query));
});

test("Comtrade requests completed months and exact HS baskets; missing constituents are not zero", async () => {
  const requests: URL[] = [];
  const client = createComtradeClient({
    now,
    fetch: async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      assert.equal(url.hostname, "comtradeapi.un.org");
      assert.equal(url.searchParams.get("cmdCode"), "8542,8541");
      assert.equal(url.searchParams.get("partnerCode"), "0");
      const period = Number(url.searchParams.get("period"));
      return json([
        row({ period, cmdCode: "8542", primaryValue: 70 }),
        ...(period === 202609 ? [row({ period, cmdCode: "8541", primaryValue: 30 })] : []),
      ]);
    },
  });
  const result = await client.fetchComtradeTrade({ categoryId: "semiconductors", months: 3 });
  assert.equal(requests.length, 3);
  assert.ok(requests.every((url) => Number(url.searchParams.get("period")) < 202610));
  assert.deepEqual(
    result.observations.map((p) => [p.period, p.valueUsd]),
    [["2026-09", 100]],
  );
  assert.equal(result.providers[0]!.state, "partial");
  await client.fetchComtradeTrade({ categoryId: "semiconductors", months: 3 });
  assert.equal(requests.length, 3, "fresh publications are reused");
});

test("empty months are retried after expiry; concurrent calls deduplicate", async () => {
  let time = now(),
    count = 0;
  const client = createComtradeClient({
    now: () => time,
    fetch: async () => {
      count++;
      return json([]);
    },
  });
  const [a, b] = await Promise.all([
    client.fetchComtradeTrade({ categoryId: "automobiles", months: 1 }),
    client.fetchComtradeTrade({ categoryId: "automobiles", months: 1 }),
  ]);
  assert.deepEqual(a, b);
  assert.equal(count, 1);
  time = new Date(time.getTime() + 61 * 60_000);
  await client.fetchComtradeTrade({ categoryId: "automobiles", months: 1 });
  assert.equal(count, 2);
});

test("rate limits stop further requests without invented observations or provider error leaks", async () => {
  let count = 0;
  const client = createComtradeClient({
    now,
    fetch: async () => {
      count++;
      return new Response("untrusted sensitive provider detail", { status: 429 });
    },
  });
  const result = await client.fetchComtradeTrade({ categoryId: "automobiles", months: 36 });
  assert.equal(result.observations.length, 0);
  assert.equal(result.providers[0]!.state, "rate-limited");
  assert.ok(count <= 2);
  assert.ok(!JSON.stringify(result).includes("sensitive"));
});

test("deadline covers stalled response body and aborts work before returning a snapshot", async () => {
  let cancelled = false;
  const client = createComtradeClient({
    now,
    timeoutMs: 20,
    budgetMs: 100,
    fetch: async () =>
      new Response(
        new ReadableStream({
          start() {},
          cancel() {
            cancelled = true;
          },
        }),
      ),
  });
  const start = performance.now();
  const result = await client.fetchComtradeTrade({ categoryId: "automobiles", months: 2 });
  assert.ok(performance.now() - start < 500);
  assert.equal(result.observations.length, 0);
  assert.equal(result.providers[0]!.state, "unavailable");
  assert.ok(cancelled);
});

test("total exports/imports are raw USD; all-HS and countries retain exact matching dimensions", async () => {
  const client = createComtradeClient({
    now,
    fetch: async (input) => {
      const url = new URL(String(input)),
        codes = url.searchParams.get("cmdCode")!.split(",");
      const period = Number(url.searchParams.get("period"));
      if (!url.searchParams.has("partnerCode"))
        return json([
          row({ period, partnerCode: 0, primaryValue: 100 }),
          row({ period, partnerCode: 842, primaryValue: 20 }),
        ]);
      if (codes.length > 1)
        return json(codes.map((cmdCode) => row({ period, cmdCode, primaryValue: 1 })));
      return json([
        row({ period, primaryValue: 100 }),
        row({ period, flowCode: "M", primaryValue: 80 }),
      ]);
    },
  });
  const result = await client.fetchComtradeTrade({ months: 2 });
  assert.deepEqual(
    result.exports.map((r) => r.valueUsd),
    [100, 100],
  );
  assert.deepEqual(
    result.imports.map((r) => r.valueUsd),
    [80, 80],
  );
  assert.equal(result.destinations.rows[0]!.share, 0.2);
  assert.ok(result.observations.some((r) => r.categoryId === "hs2:85"));
  assert.ok(!result.observations.some((r) => r.categoryId === "semiconductors"));
});

test("publication lag beyond initial probes still supplies dated HS and country summaries", async () => {
  const client = createComtradeClient({
    now,
    fetch: async (input) => {
      const url = new URL(String(input)),
        codes = url.searchParams.get("cmdCode")!.split(",");
      const period = Number(url.searchParams.get("period"));
      if (period > 202605) return json([]);
      if (!url.searchParams.has("partnerCode"))
        return json([
          row({ period, primaryValue: 100 }),
          row({ period, partnerCode: 842, primaryValue: 20 }),
        ]);
      if (codes.length > 1)
        return json(codes.map((cmdCode) => row({ period, cmdCode, primaryValue: 1 })));
      return json([
        row({ period, primaryValue: 100 }),
        row({ period, flowCode: "M", primaryValue: 80 }),
      ]);
    },
  });
  const result = await client.fetchComtradeTrade({ months: 6 });
  assert.equal(result.latestPeriod, "2026-05");
  assert.ok(result.observations.some((r) => r.period === "2026-05" && r.categoryId === "hs2:85"));
  assert.equal(result.destinations.period, "2026-05");
  assert.equal(result.destinations.rows[0]!.share, 0.2);
});

test("429 Retry-After is honored across category queries instead of repeatedly spending quota", async () => {
  let time = now(),
    count = 0;
  const client = createComtradeClient({
    now: () => time,
    fetch: async () => {
      count++;
      return new Response("", { status: 429, headers: { "Retry-After": "600" } });
    },
  });
  await client.fetchComtradeTrade({ categoryId: "automobiles", months: 1 });
  assert.equal(count, 1);
  time = new Date(time.getTime() + 90_000);
  const result = await client.fetchComtradeTrade({ categoryId: "semiconductors", months: 1 });
  assert.equal(count, 1);
  assert.equal(result.providers[0]!.state, "rate-limited");
  time = new Date(time.getTime() + 511_000);
  await client.fetchComtradeTrade({ categoryId: "automobiles", months: 1 });
  assert.equal(count, 2);
});
