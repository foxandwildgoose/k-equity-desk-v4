import test from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import {
  applyTradeToQuote,
  isFreshKisQuote,
  isValidKisTrade,
  mergeQuoteSnapshots,
} from "./market-quote-state.ts";
import { kisTradeTimestamp, parseKisTradeFrame, parseKisTradePayload } from "./kis-trade.ts";
import { createStreamCleanup } from "./stream-cleanup.ts";

const now = Date.parse("2026-10-16T01:00:00Z");
function payload(overrides: Record<number, string> = {}) {
  const fields = Array(46).fill("0");
  Object.assign(fields, {
    0: "005930",
    1: "100000",
    2: "90000",
    3: "5",
    4: "10000",
    5: "10",
    7: "95000",
    8: "95000",
    9: "89000",
    10: "90100",
    11: "90000",
    12: "1",
    13: "1000",
    14: "90000000",
    18: "85",
    33: "20261016",
    44: "0",
    ...overrides,
  });
  return fields.join("^");
}
const trade = () => parseKisTradePayload(payload(), now)!;
const snapshot = () => ({
  code: "005930",
  price: 95000,
  change: -5000,
  changePct: -5,
  prevClose: 100000,
  marketCap: 123,
  source: "naver-finance-snapshot",
  tradedAt: "2026-10-16T00:59:00.000Z",
});

test("KIS bearish sign and ISO exchange timestamp come from actual fields", () => {
  const row = trade();
  assert.equal(row.change, -10000);
  assert.equal(row.changePct, -10);
  assert.equal(row.tradedAt, "2026-10-16T01:00:00.000Z");
  assert.equal(parseKisTradePayload(payload({ 4: "-10000", 5: "-10" }), now)?.changePct, -10);
  assert.equal(parseKisTradePayload(payload({ 2: "110000", 3: "2" }), now)?.changePct, 10);
});

test("KIS rejects malformed numbers/signs, impossible dates, old/future trades and inconsistent changes", () => {
  const invalid: Record<number, string>[] = [
    { 2: "" },
    { 5: "NaN" },
    { 3: "X" },
    { 3: "3" },
    { 2: "0" },
    { 5: "4" },
    { 33: "20260230" },
    { 1: "250000" },
    { 1: "095700" },
    { 1: "100100" },
    { 33: "20261015" },
  ];
  for (const overrides of invalid) {
    assert.equal(parseKisTradePayload(payload(overrides), now), null, JSON.stringify(overrides));
  }
  assert.equal(kisTradeTimestamp("20260230", "100000"), null);
});

test("KIS emits every record in a plaintext multi-trade frame, rejects bad framing/encryption", () => {
  const two = `0|H0STCNT0|002|${payload()}^${payload({ 0: "000660" })}`;
  assert.deepEqual(
    parseKisTradeFrame(two, now).map((row) => row.code),
    ["005930", "000660"],
  );
  assert.equal(parseKisTradeFrame(two.replace("|002|", "|003|"), now).length, 0);
  assert.equal(parseKisTradeFrame(two.replace("0|", "1|"), now).length, 0);
});

test("client rejects altered EventSource data and does not regress quote ordering", () => {
  assert.equal(isValidKisTrade(trade(), now), true);
  assert.equal(isValidKisTrade({ ...trade(), changePct: 10 }, now), false);
  assert.equal(isValidKisTrade({ ...trade(), accumulatedVolume: null }, now), false);
  assert.equal(isValidKisTrade({ ...trade(), tradedAt: "2026-10-15T01:00:00Z" }, now), false);
  assert.equal(isValidKisTrade(trade(), now + 180000), false);
  const next = applyTradeToQuote(snapshot(), trade(), now);
  assert.equal(next.price, 90000);
  assert.equal(next.prevClose, 100000);
  assert.equal(next.marketCap, 123);
  const laterReceipt = { ...next, fetchedAt: "2026-10-16T01:00:01Z" };
  assert.equal(applyTradeToQuote(laterReceipt, trade(), now), laterReceipt);
  assert.equal(isFreshKisQuote(next, now + 121000), false);
  assert.equal(
    applyTradeToQuote({ ...next, tradedAt: "2026-10-16T01:00:01Z" }, trade(), now).tradedAt,
    "2026-10-16T01:00:01Z",
  );
});

test("REST cache merge keeps a newer tick but leaves bundle provenance and snapshot time intact", () => {
  const tick = applyTradeToQuote(snapshot(), trade(), now);
  const old = {
    quotes: [tick],
    source: "naver-finance-snapshot",
    fetchedAt: "2026-10-16T00:59:00Z",
    live: false,
  };
  const response = { ...old, quotes: [snapshot()], fetchedAt: "2026-10-16T01:00:01Z" };
  const merged = mergeQuoteSnapshots(old, response);
  assert.equal(merged.quotes[0]?.price, 90000);
  assert.equal(merged.fetchedAt, response.fetchedAt);
  assert.equal(merged.source, "naver-finance-snapshot");
  assert.equal(merged.live, false);
  const sameSecond = mergeQuoteSnapshots(old, {
    ...response,
    quotes: [{ ...snapshot(), price: 91000, marketCap: 456, tradedAt: tick.tradedAt }],
  });
  assert.equal(sameSecond.quotes[0]?.price, 90000);
  assert.equal(sameSecond.quotes[0]?.marketCap, 456);
  assert.equal(
    mergeQuoteSnapshots(old, {
      ...response,
      quotes: [{ ...snapshot(), price: 91000, tradedAt: "2026-10-16T01:00:01Z" }],
    }).quotes[0]?.price,
    91000,
  );
  assert.equal(mergeQuoteSnapshots({ quote: tick }, { quote: snapshot() }).quote.price, 90000);
});

test("cleanup handles cancellation before asynchronous subscription completion exactly once", async () => {
  const cleanup = createStreamCleanup();
  let removed = 0;
  let complete!: (callback: () => void) => void;
  const pending = new Promise<() => void>((resolve) => {
    complete = resolve;
  }).then((off) => cleanup.add(off));
  cleanup.close();
  complete(() => {
    removed++;
  });
  await pending;
  cleanup.close();
  assert.equal(removed, 1);
  assert.equal(cleanup.closed, true);
});

test("query cache accepts later trades within the same provider second, preserving monotonicity", () => {
  const client = new QueryClient({
    defaultOptions: { queries: { structuralSharing: mergeQuoteSnapshots } },
  });
  client.setQueryData(["market-quotes"], { quotes: [snapshot()] });
  const first = applyTradeToQuote(snapshot(), trade(), now);
  client.setQueryData(["market-quotes"], { quotes: [first] });
  const later = parseKisTradePayload(
    payload({ 2: "89000", 4: "11000", 5: "11", 13: "1001" }),
    now + 1000,
  )!;
  const second = applyTradeToQuote(first, later, now + 1000);
  client.setQueryData(["market-quotes"], { quotes: [second] });
  const result = client.getQueryData<{ quotes: ReturnType<typeof snapshot>[] }>(["market-quotes"])!;
  assert.equal(result.quotes[0]?.price, 89000);
  client.setQueryData(["market-quotes"], { quotes: [first] });
  assert.equal(client.getQueryData<typeof result>(["market-quotes"])?.quotes[0]?.price, 89000);
  client.clear();
});
