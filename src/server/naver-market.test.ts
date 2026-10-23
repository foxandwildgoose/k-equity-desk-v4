import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Resolve the application's @/ aliases for Node's TypeScript test runner. The
// actual adapter functions and all parsing modules remain unchanged in tests.
const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  const candidate = specifier.startsWith("@/") ? pathToFileURL(`${sourceRoot}${specifier.slice(2)}`) : specifier.startsWith(".") && context.parentURL ? new URL(specifier, context.parentURL) : null;
  if (candidate?.protocol === "file:") {
    for (const extension of ["", ".ts", "/index.ts"]) {
      const url = `${candidate.href}${extension}`;
      if (existsSync(fileURLToPath(url))) return nextResolve(url, context);
    }
  }
  return nextResolve(specifier, context);
} });
const { fetchRealtimeQuotes, fetchDatedNaverMarketListing, fetchIndices, fetchOhlc } = await import("./naver-market.ts");
hooks.deregister();

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const stamp = "2026-10-15T15:30:00+09:00";
const polling = { cd: "005930", nm: "삼성전자", nv: 207500, cv: 24500, cr: 10.56, rf: "5", pcv: 232000, aq: 1234, aa: 950000000000, ms: "CLOSE" };
const basic = (code = "005930") => ({ itemCode: code, stockName: code, closePrice: "207,500", compareToPreviousClosePrice: "-24,500", compareToPreviousPrice: { code: "5" }, fluctuationsRatio: "-10.56", localTradedAt: stamp, marketStatus: "CLOSE", marketSessionType: "regularMarket" });

async function withFetch<T>(fetcher: (url: URL, init?: RequestInit) => Response | Promise<Response>, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input, init) => fetcher(new URL(String(input)), init)) as typeof fetch;
  try { return await run(); } finally { globalThis.fetch = original; }
}

test("dated falling polling quotes are negative at the public adapter boundary", async () => {
  const calls: string[] = [];
  await withFetch(url => { calls.push(url.href); return json({ result: { areas: [{ datas: [{ ...polling, localTradedAt: stamp }] }] } }); }, async () => {
    const [quote] = await fetchRealtimeQuotes(["005930"]);
    assert.ok(quote);
    assert.deepEqual([quote.price, quote.change, quote.changePct], [207500, -24500, -10.56]);
    assert.equal(quote.tradedAt, stamp);
    assert.equal(quote.changeValid, true);
    assert.equal(quote.prevClose, 232000);
    assert.equal(quote.marketCap, 0);
    assert.equal(quote.marketCapValid, false);
    assert.equal(calls.length, 1);
  });
});

test("partial and undated polling rows use complete independent basic snapshots", async () => {
  const calls: string[] = [];
  await withFetch(url => {
    calls.push(url.href);
    if (url.hostname === "polling.finance.naver.com") return json({ result: { time: Date.now(), areas: [{ datas: [polling] }] } });
    const code = url.pathname.split("/")[3]!;
    return json(basic(code));
  }, async () => {
    const quotes = await fetchRealtimeQuotes(["005930", "000660"]);
    assert.equal(quotes.length, 2);
    for (const quote of quotes) {
      assert.equal(quote.tradedAt, stamp);
      assert.equal(quote.changePct, -10.56);
      assert.equal(quote.volumeValid, false);
      assert.equal(quote.marketCapValid, false);
      assert.equal(quote.marketSessionType, "regularMarket");
      assert.ok(quote.fetchedAt);
      assert.notEqual(quote.fetchedAt, quote.tradedAt);
    }
    assert.equal(calls.filter(url => url.includes("/basic")).length, 2);
  });
});

test("empty and malformed polling responses fall back instead of masquerading as success", async () => {
  for (const payload of [{}, { result: { areas: [] } }, { result: { areas: [{ datas: [] }] } }]) {
    await withFetch(url => url.hostname === "polling.finance.naver.com" ? json(payload) : json(basic()), async () => {
      const quotes = await fetchRealtimeQuotes(["005930"]);
      assert.equal(quotes.length, 1);
      assert.equal(quotes[0]!.changePct, -10.56);
      assert.equal(quotes[0]!.tradedAt, stamp);
    });
  }
});

test("provider failures and missing observations cannot create zero-valued flat quotes", async () => {
  for (const response of [json({}, 503), json({ itemCode: "005930", closePrice: "", fluctuationsRatio: "" }), json({ ...basic(), itemCode: "000660" })]) {
    await withFetch(url => url.hostname === "polling.finance.naver.com" ? json({ result: { areas: [{ datas: [{ ...polling, nv: "N/A" }] }] } }) : response.clone(), async () => {
      assert.deepEqual(await fetchRealtimeQuotes(["005930"]), []);
    });
  }
});

test("a valid undated polling quote remains undated when basic is unavailable", async () => {
  await withFetch(url => url.hostname === "polling.finance.naver.com" ? json({ result: { time: Date.now(), areas: [{ datas: [polling] }] } }) : json({}, 503), async () => {
    const [quote] = await fetchRealtimeQuotes(["005930"]);
    assert.ok(quote);
    assert.equal(quote.changePct, -10.56);
    assert.equal(quote.tradedAt, undefined);
    assert.ok(quote.fetchedAt);
  });
});

test("unexpected provider securities are excluded even if valid", async () => {
  await withFetch(url => url.hostname === "polling.finance.naver.com" ? json({ result: { areas: [{ datas: [{ ...polling, cd: "000660", localTradedAt: stamp }] }] } }) : json({}, 503), async () => {
    assert.deepEqual(await fetchRealtimeQuotes(["005930"]), []);
  });
});

test("indices repair signs and fill only missing rows; failed indices are absent", async () => {
  const calls: string[] = [];
  await withFetch(url => {
    calls.push(url.href);
    if (url.hostname === "polling.finance.naver.com") return json({ result: { areas: [{ datas: [{ cd: "KOSPI", nv: 555422, cv: 45459, cr: 7.57, rf: "5", pcv: 600881, ms: "CLOSE", localTradedAt: stamp }] }] } });
    if (url.pathname.includes("KOSDAQ")) return json({ ...basic("KOSDAQ"), closePrice: "900", compareToPreviousClosePrice: "-100", fluctuationsRatio: "-10" });
    return json({}, 503);
  }, async () => {
    const indices = await fetchIndices();
    assert.deepEqual(indices.map(row => [row.id, row.value, row.changePct]), [["kospi", 5554.22, -7.57], ["kosdaq", 900, -10]]);
    assert.ok(indices.every(row => row.tradedAt === stamp));
    assert.equal(calls.filter(url => url.includes("/index/KOSPI/basic")).length, 0);
    assert.equal(calls.filter(url => url.includes("/basic")).length, 2);
  });
});

test("fchart close-only minute samples do not become invented candles", async () => {
  await withFetch(url => url.hostname.includes("yahoo") ? json({ chart: { result: [] } }) : new Response('<chart><item data="20261015153000|null|null|null|207500|0"/><item data="20261015153100|207000|208000|206500|207500|100"/></chart>'), async () => {
    const result = await fetchOhlc({ code: "005930", market: "KOSPI", interval: "minute", minuteSize: 1, range: "1d" });
    assert.equal(result.bars.length, 1);
    assert.deepEqual([result.bars[0]!.date, result.bars[0]!.open, result.bars[0]!.high, result.bars[0]!.low, result.bars[0]!.close], ["2026-10-15 15:31", 207000, 208000, 206500, 207500]);
  });
});

test("fchart missing daily open/high/low is discarded rather than copied from close", async () => {
  await withFetch(url => url.hostname.includes("yahoo") ? json({ chart: { result: [] } }) : new Response('<chart><item data="20261014|0|0|0|232000|100"/><item data="20261015|230000|231000|205000|207500|100"/></chart>'), async () => {
    const result = await fetchOhlc({ code: "005930", market: "KOSPI", interval: "day" });
    assert.equal(result.bars.length, 1);
    assert.deepEqual([result.bars[0]!.date, result.bars[0]!.open, result.bars[0]!.close], ["2026-10-15", 230000, 207500]);
  });
});

test("Yahoo daily bars use the Korean venue date across the UTC day boundary", async () => {
  await withFetch(() => json({ chart: { result: [{ timestamp: [Date.parse("2026-10-14T23:59:00Z") / 1000], indicators: { quote: [{ open: [230000], high: [231000], low: [205000], close: [207500], volume: [100] }] } }] } }), async () => {
    const result = await fetchOhlc({ code: "005930", market: "KOSPI", interval: "day" });
    assert.equal(result.bars[0]!.date, "2026-10-15");
    assert.equal(result.bars[0]!.close, 207500);
  });
});

test("bulk dated listing restores volume and cap without mixing polling/basic snapshots", async () => {
  const codes = Array.from({ length: 8 }, (_, i) => String(900000 + i));
  const meta = Object.fromEntries(codes.map(code => [code, { nameKo: code, nameEn: code, sectorId: "semiconductors" as const, market: "KOSPI" as const }]));
  const calls: string[] = [];
  await withFetch(url => {
    calls.push(url.href);
    if (url.pathname.includes("/stocks/marketValue/KOSPI")) {
      const page = Number(url.searchParams.get("page"));
      return json({ page, totalCount: 8, stocks: page === 1 ? codes.map(code => ({ ...basic(code), stockEndType: "stock", accumulatedTradingVolume: "33,002,824", marketValueRaw: "1213102811160000", marketValue: "12,131,028" })) : [] });
    }
    throw new Error("unexpected source: listed quotes must not borrow another endpoint's values");
  }, async () => {
    const rows = await fetchRealtimeQuotes(codes, meta);
    assert.equal(rows.length, 8);
    for (const row of rows) {
      assert.equal(row.changePct, -10.56);
      assert.equal(row.volume, 33002824);
      assert.equal(row.volumeValid, true);
      assert.equal(row.marketCap, 12131028.1116);
      assert.equal(row.marketCapValid, true);
      assert.equal(row.tradedAt, stamp);
      assert.match(row.sourceUrl!, /marketValue\/KOSPI/);
    }
    assert.equal(calls.length, 2, "only the bounded first page window is fetched");
    const receipt = rows[0]!.fetchedAt;
    const again = await fetchRealtimeQuotes([codes[0]!]);
    assert.equal(again[0]!.fetchedAt, receipt, "cache hits retain original receipt and provider dates");
    assert.equal(calls.length, 2);
  });
});

test("partial listings exclude unexpected securities and use basic only for missing codes", async () => {
  const codes = Array.from({ length: 8 }, (_, i) => String(910000 + i));
  const meta = Object.fromEntries(codes.map(code => [code, { nameKo: code, nameEn: code, sectorId: "semiconductors" as const, market: "KOSDAQ" as const }]));
  const basics: string[] = [];
  await withFetch(url => {
    if (url.pathname.includes("/stocks/marketValue/KOSDAQ")) {
      const page = Number(url.searchParams.get("page"));
      return json({ page, totalCount: 2, stocks: page === 1 ? [codes[0]!, "999998"].map(code => ({ ...basic(code), stockEndType: "stock", accumulatedTradingVolume: 123, marketValue: 1000 })) : [] });
    }
    if (url.hostname === "polling.finance.naver.com") return json({});
    const code = url.pathname.split("/")[3]!; basics.push(code); return json(basic(code));
  }, async () => {
    const rows = await fetchRealtimeQuotes(codes, meta);
    assert.equal(rows.length, 8);
    assert.ok(rows.every(row => codes.includes(row.code)));
    assert.equal(rows.find(row => row.code === codes[0])!.volumeValid, true);
    assert.equal(rows.filter(row => row.marketCapValid).length, 1);
    assert.equal(basics.length, 7);
    const listing = await fetchDatedNaverMarketListing("KOSDAQ", 1);
    assert.equal(listing.length, 2, "the explicit listing helper exposes published page rows for ranking");
    assert.ok(listing.every(row => row.tradedAt === stamp));
  });
});

test("provider exchange identity overrides a stale curated market hint", async () => {
  await withFetch(url => url.hostname === "polling.finance.naver.com" ? json({}) : json({ ...basic("930000"), stockExchangeName: "KOSPI" }), async () => {
    const [quote] = await fetchRealtimeQuotes(["930000"], { "930000": { nameKo: "930000", nameEn: "930000", sectorId: "semiconductors", market: "KOSDAQ" } });
    assert.equal(quote!.market, "KOSPI");
  });
});

test("concurrent listing callers share page windows and keep the newer provider row", async t => {
  const now = Date.now() + 120_000;
  t.mock.method(Date, "now", () => now);
  const pages: number[] = [];
  const latest = "2026-10-15T15:30:00+09:00", older = "2026-10-14T15:30:00+09:00";
  await withFetch(async url => {
    const page = Number(url.searchParams.get("page")); pages.push(page);
    await new Promise(resolve => setTimeout(resolve, page === 1 ? 10 : 1));
    const stocks = Array.from({ length: 100 }, (_, i) => ({ ...basic(String(940000 + (page - 1) * 100 + i)), stockEndType: "stock", accumulatedTradingVolume: 123, marketValue: 1000 }));
    if (page === 1) stocks[0] = { ...stocks[0]!, itemCode: "940000", localTradedAt: latest };
    if (page === 3) stocks[0] = { ...stocks[0]!, itemCode: "940000", localTradedAt: older };
    return json({ page, totalCount: 400, stocks });
  }, async () => {
    const rows = await Promise.all([fetchDatedNaverMarketListing("KOSPI", 2), fetchDatedNaverMarketListing("KOSPI", 4), fetchDatedNaverMarketListing("KOSPI", 3)]);
    assert.deepEqual([...pages].sort(), [1, 2, 3, 4]);
    for (const result of rows) assert.equal(result.find(row => row.code === "940000")!.tradedAt, latest);
    assert.ok(rows[0]!.length <= 200);
    assert.ok(rows[2]!.length <= 300);
  });
});

function blockedUntilAbort(signal: AbortSignal | null | undefined, active: { count: number; aborted: number }): Promise<Response> {
  assert.ok(signal, "every bounded origin fetch receives its acquisition signal");
  active.count++;
  return new Promise((_, reject) => {
    const abort = () => { active.count--; active.aborted++; reject(new Error("fixture transport aborted")); };
    if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
  });
}

test("a slow listing window is aborted, verified partial rows survive, and polling fills missing codes", async t => {
  const now = Date.now() + 240_000;
  t.mock.method(Date, "now", () => now);
  const codes = Array.from({ length: 8 }, (_, i) => String(950000 + i));
  const meta = Object.fromEntries(codes.map(code => [code, { nameKo: code, nameEn: code, sectorId: "semiconductors" as const, market: "KOSPI" as const }]));
  const active = { count: 0, aborted: 0 };
  await withFetch((url, init) => {
    if (url.pathname.includes("/stocks/marketValue/")) {
      if (url.searchParams.get("page") === "2") return blockedUntilAbort(init?.signal, active);
      return json({ page: 1, totalCount: 500, stocks: [{ ...basic(codes[0]), stockEndType: "stock", accumulatedTradingVolume: 321, marketValue: 1000 }] });
    }
    if (url.hostname === "polling.finance.naver.com") return json({ result: { areas: [{ datas: codes.slice(1).map(code => ({ ...polling, cd: code, localTradedAt: stamp })) }] } });
    throw new Error("dated polling rows do not require independent basic calls");
  }, async () => {
    const rows = await fetchRealtimeQuotes(codes, meta, { phaseTimeoutMs: 20, timeoutMs: 100 });
    assert.equal(rows.length, 8);
    assert.equal(rows.find(row => row.code === codes[0])!.volume, 321);
    assert.ok(rows.every(row => row.tradedAt === stamp));
    assert.equal(active.aborted, 1);
    assert.equal(active.count, 0, "no listing request is abandoned after returning partial data");
  });
});

test("polling and basic deadlines abort actual origin requests without manufacturing missing quotes", async () => {
  const active = { count: 0, aborted: 0 };
  const started = performance.now();
  await withFetch((url, init) => {
    if (url.pathname.includes("/stock/960000/basic")) return json(basic("960000"));
    return blockedUntilAbort(init?.signal, active);
  }, async () => {
    const rows = await fetchRealtimeQuotes(["960000", "960001"], undefined, { phaseTimeoutMs: 15, timeoutMs: 100 });
    assert.deepEqual(rows.map(row => row.code), ["960000"]);
    assert.equal(rows[0]!.tradedAt, stamp);
    assert.equal(rows[0]!.changePct, -10.56);
    assert.equal(active.aborted, 2);
    assert.equal(active.count, 0, "the public response waits for aborted work to settle");
    assert.ok(performance.now() - started < 1000, "phase budgets replace the former repeated ten-second waits");
  });
});

test("the whole acquisition deadline prevents starting later fallback phases", async () => {
  const active = { count: 0, aborted: 0 };
  const paths: string[] = [];
  await withFetch((url, init) => {
    paths.push(url.pathname);
    return blockedUntilAbort(init?.signal, active);
  }, async () => {
    const rows = await fetchRealtimeQuotes(["970000"], undefined, { timeoutMs: 15, phaseTimeoutMs: 100 });
    assert.deepEqual(rows, []);
    assert.equal(paths.length, 1);
    assert.equal(active.aborted, 1);
    assert.equal(active.count, 0);
  });
});

test("a short-budget listing waiter does not cancel or wait indefinitely for another caller's owner", async t => {
  const now = Date.now() + 360_000;
  t.mock.method(Date, "now", () => now);
  const codes = Array.from({ length: 8 }, (_, i) => String(980000 + i));
  const meta = Object.fromEntries(codes.map(code => [code, { nameKo: code, nameEn: code, sectorId: "semiconductors" as const, market: "KOSPI" as const }]));
  let release!: () => void;
  let ownerAborted = false;
  const held = new Promise<void>(resolve => { release = resolve; });
  await withFetch(async (url, init) => {
    if (url.pathname.includes("/stocks/marketValue/")) {
      init?.signal?.addEventListener("abort", () => { ownerAborted = true; }, { once: true });
      await held;
      return json({ page: Number(url.searchParams.get("page")), totalCount: 0, stocks: [] });
    }
    return json({ result: { areas: [{ datas: codes.map(code => ({ ...polling, cd: code, localTradedAt: stamp })) }] } });
  }, async () => {
    const owner = fetchDatedNaverMarketListing("KOSPI", 2);
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    try {
      const follower = fetchRealtimeQuotes(codes, meta, { timeoutMs: 100, phaseTimeoutMs: 15 });
      const rows = await Promise.race([follower, new Promise<never>((_, reject) => {
        watchdog = setTimeout(() => { release(); reject(new Error("the waiter ignored its own acquisition budget")); }, 500);
      })]);
      assert.equal(rows.length, 8);
      assert.equal(ownerAborted, false, "follower deadlines do not abort the independent listing owner");
    } finally {
      if (watchdog) clearTimeout(watchdog);
      release();
      await owner;
    }
  });
});
