import assert from "node:assert/strict";
import { test } from "node:test";
import { createFredTradeClient, parseFredSeriesMetadata } from "./export-fred.ts";

const EXP = "XTEXVA01KRM667S";
const IMP = "XTIMVA01KRM667S";
function metadata(id: string, units = "Millions of U.S. Dollars", frequency = "Monthly", seasonal = "Not Seasonally Adjusted"): string {
  return `<html><head><title>Official series (${id}) | FRED</title><link rel="canonical" href="https://fred.stlouisfed.org/series/${id}"></head><body>
    <div class="series-meta"><span class="series-meta-value"><span class="series-meta-value-units">${units},</span>, <span class="series-meta-value-seasonal">${seasonal}</span></span>
    <span class="series-meta-value-frequency">${frequency}</span></div></body></html>`;
}
function csv(id: string): string {
  return `observation_date,${id}\n2026-08-01,100\n2026-09-01,110\n2026-10-01,999\n`;
}
function makeFetch(options: { fail?: () => boolean; inspect?: (url: URL) => void; html?: (id: string) => string } = {}): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    options.inspect?.(url);
    if (options.fail?.()) return new Response("not available", { status: 503 });
    const id = url.pathname.startsWith("/series/") ? url.pathname.split("/").at(-1)! : url.searchParams.get("id")!;
    return new Response(url.pathname.startsWith("/series/") ? (options.html?.(id) ?? metadata(id)) : csv(id));
  }) as typeof fetch;
}

test("FRED metadata requires exact identity, monthly USD units and known seasonal adjustment", () => {
  assert.deepEqual(parseFredSeriesMetadata(metadata(EXP), EXP), { units: "Millions of U.S. Dollars", frequency: "Monthly", seasonalAdjustment: "Not Seasonally Adjusted" });
  assert.equal(parseFredSeriesMetadata(metadata(IMP), EXP), null);
  assert.equal(parseFredSeriesMetadata(metadata(EXP, "Index 2015=100"), EXP), null);
  assert.equal(parseFredSeriesMetadata(metadata(EXP, "Korean Won"), EXP), null);
  assert.equal(parseFredSeriesMetadata(metadata(EXP, "U.S. Dollars", "Annual"), EXP), null);
  assert.equal(parseFredSeriesMetadata(metadata(EXP, "U.S. Dollars", "Monthly", "Seasonally Adjusted Annual Rate"), EXP), null);
  assert.equal(parseFredSeriesMetadata(metadata(EXP).replace(`/series/${EXP}`, `/series/${IMP}`), EXP), null);
  assert.equal(parseFredSeriesMetadata(metadata(EXP).replace("series-meta-value-units", "unrelated-units"), EXP), null);
});

test("FRED client scales verified values and excludes the current Korean month", async () => {
  const urls: URL[] = [];
  const client = createFredTradeClient({ fetch: makeFetch({ inspect: url => urls.push(url) }), now: () => new Date("2026-09-30T15:01:00Z") });
  const result = await client.fetchFredTrade();
  assert.deepEqual(result.exports, [{ period: "2026-08", valueUsd: 100_000_000 }, { period: "2026-09", valueUsd: 110_000_000 }]);
  assert.deepEqual(result.imports, result.exports);
  assert.equal(result.providers[0]?.asOf, "2026-09");
  assert.equal(result.providers[0]?.recordCount, 2);
  assert.equal(result.providers[0]?.state, "ok");
  assert.match(result.source, /Not Seasonally Adjusted/);
  assert.equal(urls.length, 4);
  assert.ok(urls.every(url => url.origin === "https://fred.stlouisfed.org"));
});

test("FRED requests share inflight work and positive cache; failures return explicitly dated verified cache", async () => {
  let clock = new Date("2026-10-21T00:00:00Z");
  let failure = false, calls = 0;
  const client = createFredTradeClient({ fetch: makeFetch({ fail: () => failure, inspect: () => calls++ }), now: () => clock });
  const [first, same] = await Promise.all([client.fetchFredTrade(), client.fetchFredTrade()]);
  assert.deepEqual(first, same);
  assert.equal(calls, 4);
  await client.fetchFredTrade();
  assert.equal(calls, 4);
  clock = new Date(clock.getTime() + 4 * 60 * 60_000 + 1);
  failure = true;
  const stale = await client.fetchFredTrade();
  assert.equal(stale.providers[0]?.state, "stale");
  assert.equal(stale.providers[0]?.asOf, "2026-09");
  assert.equal(stale.providers[0]?.reasonCode, "HTTP_503");
  assert.match(stale.providers[0]!.message, /2026-10-21T00:00:00.000Z/);
  assert.deepEqual(stale.exports, first.exports);
  clock = new Date(clock.getTime() + 8 * 24 * 60 * 60_000);
  const expired = await client.fetchFredTrade();
  assert.deepEqual(expired.exports, []);
  assert.equal(expired.providers[0]?.state, "unavailable");
});

test("FRED never accepts CSV without verified official unit metadata", async () => {
  const client = createFredTradeClient({ fetch: makeFetch({ html: id => metadata(id, "Index") }), now: () => new Date("2026-10-21T00:00:00Z") });
  const result = await client.fetchFredTrade();
  assert.deepEqual(result.exports, []);
  assert.ok(result.providers.every(provider => provider.state === "unverified" && provider.reasonCode === "METADATA_UNVERIFIED"));
});

test("FRED withholds imports when their seasonal basis differs from exports", async () => {
  const client = createFredTradeClient({
    fetch: makeFetch({ html: id => metadata(id, "U.S. Dollars", "Monthly", id === IMP ? "Seasonally Adjusted" : "Not Seasonally Adjusted") }),
    now: () => new Date("2026-10-21T00:00:00Z"),
  });
  const result = await client.fetchFredTrade();
  assert.equal(result.exports.length, 2);
  assert.deepEqual(result.imports, []);
  assert.equal(result.providers[0]?.state, "ok");
  assert.equal(result.providers[1]?.state, "unverified");
  assert.equal(result.providers[1]?.reasonCode, "SEASONAL_BASIS_MISMATCH");
  assert.equal(result.providers[1]?.recordCount, 0);
  assert.equal(result.providers[1]?.asOf, null);
  assert.ok(!result.source.includes(IMP));
});

test("FRED deadline covers a stalled response body, not just response headers", async () => {
  let cancellations = 0;
  const stalled = (async () => new Response(new ReadableStream<Uint8Array>({ cancel() { cancellations++; } }))) as typeof fetch;
  const client = createFredTradeClient({ fetch: stalled, timeoutMs: 25, now: () => new Date("2026-10-21T00:00:00Z") });
  const started = Date.now();
  const result = await client.fetchFredTrade();
  assert.ok(Date.now() - started < 1_000);
  assert.equal(result.exports.length, 0);
  assert.ok(result.providers.every(provider => provider.reasonCode === "REQUEST_TIMEOUT"));
  assert.equal(cancellations, 4);
});

test("FRED rejects oversized bodies and unexpected provider redirects", async () => {
  const huge = (async () => new Response("x", { headers: { "content-length": "9999999" } })) as typeof fetch;
  const oversize = await createFredTradeClient({ fetch: huge }).fetchFredTrade();
  assert.ok(oversize.providers.every(provider => provider.reasonCode === "BODY_LIMIT"));
  const redirected = (async () => {
    const response = new Response("untrusted");
    Object.defineProperty(response, "url", { value: "https://unrelated.invalid/series/XTEXVA01KRM667S" });
    return response;
  }) as typeof fetch;
  const wrong = await createFredTradeClient({ fetch: redirected }).fetchFredTrade();
  assert.ok(wrong.providers.every(provider => provider.state === "unverified" && provider.reasonCode === "UNEXPECTED_REDIRECT"));
});
