import assert from "node:assert/strict";
import { test } from "node:test";
import { createKcsPublicTradeClient } from "./export-kcs-public.ts";

const NOW = new Date("2026-10-22T00:00:00Z");
const HOME = "https://tradedata.go.kr/cts/index.do";
const ENDPOINT = "https://tradedata.go.kr/cts/hmpg/retrieveTrade.do";
const fixtureCookie = "anonymous-fixture-session";
type Row = Record<string, unknown>;
const point = (
  hsSgn = "8507",
  priodTitle = "2026.09",
  expUsdAmt: unknown = "1,234.5",
  impUsdAmt: unknown = "500",
) => ({ hsSgn, priodTitle, expUsdAmt, impUsdAmt, korePrlstNm: "fixture product" });
const json = (items: Row[]) =>
  new Response(JSON.stringify({ items }), { headers: { "content-type": "application/json" } });
function range(form: URLSearchParams): Row[] {
  const first = form.get("priodFr")!,
    last = form.get("priodTo")!;
  const rows: Row[] = [];
  for (let month = Number(first.slice(4)); month <= Number(last.slice(4)); month++)
    rows.push(
      point(
        form.get("hsSgn")!,
        `${first.slice(0, 4)}.${String(month).padStart(2, "0")}`,
        form.get("hsSgn") === "8541" ? "1" : "2",
      ),
    );
  return rows;
}
interface FixtureOptions {
  now?: () => Date;
  timeoutMs?: number;
  budgetMs?: number;
  maxRequests?: number;
  maxPages?: number;
  home?: () => Response | Promise<Response>;
}
function fixture(
  handle: (form: URLSearchParams, init: RequestInit) => Response | Promise<Response>,
  config: FixtureOptions = {},
) {
  const calls: { url: string; form: URLSearchParams | null; signal: AbortSignal }[] = [];
  const client = createKcsPublicTradeClient({
    ...config,
    now: config.now ?? (() => NOW),
    fetch: (async (input, init) => {
      const url = String(input);
      assert.ok(url === HOME || url === ENDPOINT);
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      assert.equal(new Headers(init?.headers).has("authorization"), false);
      const form = url === ENDPOINT ? new URLSearchParams(String(init?.body)) : null;
      calls.push({ url, form, signal: init!.signal! });
      if (!form)
        return (
          config.home?.() ??
          new Response("official homepage fixture", {
            headers: { "set-cookie": `JSESSIONID=${fixtureCookie}; Path=/; HttpOnly; Secure` },
          })
        );
      assert.equal(init?.method, "POST");
      assert.equal(new Headers(init?.headers).get("referer"), HOME);
      assert.equal(new Headers(init?.headers).get("cookie"), `JSESSIONID=${fixtureCookie}`);
      assert.equal(form.get("tradeKind"), "ETS_MNK_1020000A");
      assert.equal(form.get("priodKind"), "MON");
      assert.equal(form.get("statsBase"), "acptDd");
      assert.equal(form.get("ttwgTpcd"), "1000");
      assert.equal(form.get("hsSgnGrpCol"), "HS4_SGN");
      assert.equal(form.get("hsSgnWhrCol"), "HS4_SGN");
      assert.equal(form.get("showPagingLine"), "15");
      assert.match(form.get("hsSgn")!, /^\d{4}$/);
      return handle(form, init!);
    }) as typeof fetch,
  });
  return { ...client, calls };
}

test("unsupported HS2 and unknown categories perform zero origin requests", async () => {
  const client = fixture(() => {
    throw new Error("must not query unsupported HS");
  });
  for (const categoryId of [
    "automobiles",
    "agri_fishery_food",
    "hs2:85",
    "hs4:85",
    "hs4:8542/../",
    "invented",
  ]) {
    const result = await client.fetchKcsPublicTrade({ categoryId });
    assert.equal(result.providers[0].state, "unverified");
    assert.deepEqual(result.observations, []);
  }
  assert.equal(client.calls.length, 0);
});

test("fixed public HS4 query validates echoed identity and converts explicit thousand USD exactly once", async () => {
  const client = fixture(() =>
    json([point(), point("總計", "총계", "999999999"), point("8507", "2026", "999999999")]),
  );
  const result = await client.fetchKcsPublicTrade({ categoryId: "hs4:8507", months: 1 });
  assert.equal(result.observations[0].valueUsd, 1_234_500);
  assert.equal(result.observations[0].categoryId, "hs4:8507");
  assert.equal(result.observations[0].classification, "HS");
  assert.equal(result.observations[0].period, "2026-09");
  assert.equal(result.providers[0].id, "customs.public-item");
  assert.equal(result.providers[0].state, "ok");
  assert.equal(result.providers[0].asOf, "2026-09");
  assert.equal(client.calls.length, 2);
  assert.equal(JSON.stringify(result).includes(fixtureCookie), false);
});

test("KST completed months and <=12-month calendar blocks bound 120-month histories", async () => {
  const client = fixture((form) => json(range(form)), {
    now: () => new Date("2026-09-30T15:01:00Z"),
  });
  const result = await client.fetchKcsPublicTrade({ categoryId: "hs4:8507", months: 120 });
  assert.equal(result.observations.length, 120);
  assert.equal(result.observations[0].period, "2016-10");
  assert.equal(result.observations.at(-1)?.period, "2026-09");
  for (const { form } of client.calls)
    if (form) {
      assert.equal(form.get("priodFr")!.slice(0, 4), form.get("priodTo")!.slice(0, 4));
      assert.ok(Number(form.get("priodTo")!.slice(4)) - Number(form.get("priodFr")!.slice(4)) < 12);
    }
  assert.equal(client.calls.length, 12);
});

test("basket totals require every exact constituent for each month; descendants never fill a missing aggregate", async () => {
  const complete = fixture((form) =>
    json([
      point(form.get("hsSgn")!, "2026.09", form.get("hsSgn") === "8541" ? "10" : "20"),
      point(`${form.get("hsSgn")}10`, "2026.09", "99999"),
    ]),
  );
  const result = await complete.fetchKcsPublicTrade({ categoryId: "semiconductors", months: 1 });
  assert.equal(result.observations[0].valueUsd, 30_000);
  assert.equal(result.observations[0].categoryId, "semiconductors");
  const missing = fixture((form) =>
    json(form.get("hsSgn") === "8541" ? [] : [point("8542", "2026.09", "20")]),
  );
  const partial = await missing.fetchKcsPublicTrade({ categoryId: "semiconductors", months: 1 });
  assert.deepEqual(partial.observations, []);
  assert.equal(partial.providers[0].state, "empty");
  const childOnly = await fixture(() =>
    json([point("850710", "2026.09", "20")]),
  ).fetchKcsPublicTrade({ categoryId: "hs4:8507", months: 1 });
  assert.deepEqual(childOnly.observations, []);
});

test("wrong HS/month/country, invalid units and conflicting revisions fail closed", async () => {
  for (const items of [
    [point("8542")],
    [point("8507", "2026.10")],
    [point("8507", "2026.13")],
    [{ ...point(), cntyCd: "US" }],
    [point("8507", "2026.09", null)],
    [point("8507", "2026.09", "1abc234")],
    [point("8507", "2026.09", "-1")],
    [point("8507", "2026.09", "9999999999999999")],
    [point(), point("8507", "2026.09", "777")],
  ]) {
    const result = await fixture(() => json(items)).fetchKcsPublicTrade({
      categoryId: "hs4:8507",
      months: 1,
    });
    assert.deepEqual(result.observations, []);
    assert.equal(result.providers[0].state, "unverified");
  }
});

test("full pages are completed before publishing; duplicates never add and repeated pages/limits fail", async () => {
  for (const mode of ["complete", "repeated", "limit"] as const) {
    const client = fixture(
      (form) =>
        json(
          form.get("selectPaging") === "1" || mode === "repeated"
            ? Array.from({ length: 15 }, () => point())
            : [{ hsSgn: "총계" }],
        ),
      { maxPages: mode === "limit" ? 1 : 8 },
    );
    const result = await client.fetchKcsPublicTrade({ categoryId: "hs4:8507", months: 1 });
    assert.equal(result.observations.length, mode === "complete" ? 1 : 0);
    if (mode === "complete") assert.equal(result.observations[0].valueUsd, 1_234_500);
    else
      assert.equal(
        result.providers[0].reasonCode,
        mode === "repeated" ? "REPEATED_PAGE" : "PAGE_LIMIT",
      );
    assert.equal(client.calls.filter((c) => c.form).length, mode === "limit" ? 1 : 2);
  }
});

test("HTTP denials/429 stop further origin requests and errors expose no session/provider body", async () => {
  for (const status of [403, 429, 503]) {
    const client = fixture(() => new Response("sensitive arbitrary provider text", { status }));
    const result = await client.fetchKcsPublicTrade({ categoryId: "semiconductors", months: 36 });
    assert.equal(result.providers[0].state, status === 429 ? "rate-limited" : "unavailable");
    assert.equal(result.providers[0].reasonCode, `DATA_HTTP_${status}`);
    assert.ok(client.calls.length <= 3); // Homepage and at most two already-started workers.
    assert.equal(JSON.stringify(result).includes("sensitive"), false);
    assert.equal(JSON.stringify(result).includes(fixtureCookie), false);
  }
  const error = await fixture(() => {
    throw Error("https://bad.invalid/?secret=not-returned");
  }).fetchKcsPublicTrade({ categoryId: "hs4:8507", months: 1 });
  assert.equal(JSON.stringify(error).includes("not-returned"), false);
});

test("bootstrap HTTP failures identify the safe stage and stop before data requests", async () => {
  const client = fixture(
    () => {
      throw new Error("must not post after homepage failure");
    },
    {
      home: () => new Response("private bootstrap text", { status: 503 }),
    },
  );
  const result = await client.fetchKcsPublicTrade({ categoryId: "semiconductors", months: 36 });
  assert.equal(result.providers[0].reasonCode, "BOOTSTRAP_HTTP_503");
  assert.equal(result.providers[0].state, "unavailable");
  assert.equal(client.calls.length, 1);
  assert.equal(JSON.stringify(result).includes("private bootstrap"), false);
});

test(
  "request/body/whole-series deadlines abort even transports and streams that ignore abort",
  { timeout: 10_000 },
  async () => {
    const transport = fixture(() => new Promise<Response>(() => {}), {
      timeoutMs: 10,
      budgetMs: 30,
    });
    const timed = await transport.fetchKcsPublicTrade({ categoryId: "hs4:8507", months: 1 });
    assert.equal(timed.providers[0].reasonCode, "REQUEST_TIMEOUT");
    assert.equal(
      transport.calls.every((call) => call.signal.aborted),
      true,
    );
    let cancelled = false;
    const stream = fixture(
      () =>
        new Response(
          new ReadableStream({
            cancel() {
              cancelled = true;
            },
          }),
        ),
      { timeoutMs: 100, budgetMs: 15 },
    );
    const stopped = await stream.fetchKcsPublicTrade({ categoryId: "hs4:8507", months: 1 });
    assert.equal(stopped.providers[0].reasonCode, "SERIES_TIMEOUT");
    assert.equal(cancelled, true);
  },
);

test(
  "a late transport response cannot begin body reads after cancellation",
  { timeout: 10_000 },
  async () => {
    let complete: (value: Response) => void = () => {};
    const client = fixture(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
      { timeoutMs: 10 },
    );
    const result = await client.fetchKcsPublicTrade({ categoryId: "hs4:8507", months: 1 });
    assert.equal(result.providers[0].reasonCode, "REQUEST_TIMEOUT");
    let reads = 0,
      cancelled = false;
    const response = new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
    );
    const original = response.body!.getReader.bind(response.body!);
    Object.defineProperty(response.body, "getReader", {
      value: (...args: unknown[]) => {
        reads++;
        return original(...(args as []));
      },
    });
    complete(response);
    await new Promise((resolve) => setTimeout(resolve, 1));
    assert.equal(reads, 0);
    assert.equal(cancelled, true);
  },
);

test("HTTP200 challenge/invalid schema stops remaining year and HS operations", async () => {
  const client = fixture(() => new Response("<html>challenge fixture</html>"));
  const result = await client.fetchKcsPublicTrade({ categoryId: "home_appliances", months: 120 });
  assert.equal(result.providers[0].reasonCode, "RESPONSE_SCHEMA");
  assert.deepEqual(result.observations, []);
  assert.ok(client.calls.length <= 3);
});

test("malformed JSON, excessive bodies and unsafe anonymous cookie values never become trade data", async () => {
  for (const response of [
    () => new Response("<html>not JSON</html>"),
    () => new Response("x", { headers: { "content-length": "2000001" } }),
    () => new Response(new Uint8Array(2_000_001)),
    () => new Response(JSON.stringify({ items: [null] })),
  ]) {
    const result = await fixture(() => response()).fetchKcsPublicTrade({
      categoryId: "hs4:8507",
      months: 1,
    });
    assert.deepEqual(result.observations, []);
    assert.equal(result.providers[0].state, "unverified");
  }
  const invalidCookie = fixture(
    () => {
      throw Error("must not post");
    },
    { home: () => new Response("", { headers: { "set-cookie": "JSESSIONID=one,two; Path=/" } }) },
  );
  const rejected = await invalidCookie.fetchKcsPublicTrade({ categoryId: "hs4:8507", months: 1 });
  assert.equal(rejected.providers[0].reasonCode, "SESSION_COOKIE_INVALID");
  assert.equal(invalidCookie.calls.length, 1);
});

test("request budgets preserve only complete observed constituent months", async () => {
  const client = fixture((form) => json(range(form)), { maxRequests: 3 });
  const result = await client.fetchKcsPublicTrade({ categoryId: "semiconductors", months: 36 });
  assert.equal(client.calls.length, 3);
  assert.equal(result.observations.length, 9);
  assert.equal(result.observations[0].period, "2026-01");
  assert.equal(result.observations[0].valueUsd, 3000);
  assert.equal(result.providers[0].state, "partial");
  assert.equal(result.providers[0].reasonCode, "REQUEST_BUDGET");
});

test("global origin concurrency stays <=2 across different category requests", async () => {
  let active = 0,
    peak = 0;
  const client = fixture(async (form) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return json(range(form));
  });
  const results = await Promise.all(
    ["semiconductors", "home_appliances", "auto_parts", "displays"].map((categoryId) =>
      client.fetchKcsPublicTrade({ categoryId, months: 1 }),
    ),
  );
  assert.ok(peak <= 2);
  assert.equal(
    results.every((r) => r.observations.length === 1),
    true,
  );
});

test("single flight/cache return copies and cached blocks do not depend on a new homepage session", async () => {
  let clock = new Date(NOW);
  const client = fixture(() => json([point()]), { now: () => clock });
  const [first, second] = await Promise.all([
    client.fetchKcsPublicTrade({ categoryId: "hs4:8507", months: 1 }),
    client.fetchKcsPublicTrade({ categoryId: "hs4:8507", months: 1 }),
  ]);
  assert.equal(client.calls.length, 2);
  first.observations[0].valueUsd = 0;
  assert.equal(second.observations[0].valueUsd, 1_234_500);
  assert.equal(
    (await client.fetchKcsPublicTrade({ categoryId: "hs4:8507", months: 1 })).observations[0]
      .valueUsd,
    1_234_500,
  );
  clock = new Date(clock.getTime() + 11 * 60_000);
  assert.equal(
    (await client.fetchKcsPublicTrade({ categoryId: "hs4:8507", months: 1 })).observations[0]
      .valueUsd,
    1_234_500,
  );
  assert.equal(client.calls.length, 2);
});
