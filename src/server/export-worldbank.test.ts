import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorldBankTradeClient, WORLD_BANK_TRADE_SERIES } from "./export-worldbank.ts";

type Kind = "exports" | "imports";
type Fields = Record<string, unknown>;
const NOW = new Date("2026-10-22T00:00:00Z");
const META = (kind: Kind): Fields => ({
  id: WORLD_BANK_TRADE_SERIES[kind],
  name: `${kind === "exports" ? "Exports" : "Imports"} Merchandise, Customs, current US$, millions`,
  unit: "",
  source: { id: "15", value: "Global Economic Monitor" },
  sourceNote: `Merchandise (goods) ${kind}, ${kind === "exports" ? "free on board (f.o.b.)" : "cost, insurance and freight basis (c.i.f.)"}, in current US$ millions, not seasonally adjusted.`,
  sourceOrganization:
    "World Bank staff calculations based on Datastream and IMF International Finance Statistics data.",
});
const observation = (kind: Kind, date = "2026M09", value: unknown = 123.5): Fields => ({
  indicator: { id: WORLD_BANK_TRADE_SERIES[kind], value: META(kind).name },
  country: { id: "KR", value: "Korea, Rep." },
  countryiso3code: "KOR",
  date,
  value,
  unit: "",
  obs_status: "",
  decimal: 1,
});
function json(
  rows: Fields[],
  options: { page?: number; pages?: number; size?: number; total?: number; sourceid?: string } = {},
) {
  const size = options.size ?? 1000,
    total = options.total ?? rows.length;
  return new Response(
    JSON.stringify([
      {
        page: options.page ?? 1,
        pages: options.pages ?? Math.max(1, Math.ceil(total / size)),
        per_page: String(size),
        total,
        sourceid: options.sourceid ?? "15",
        lastupdated: "2026-10-01",
      },
      rows,
    ]),
    { headers: { "content-type": "application/json" } },
  );
}
function kindOf(url: URL): Kind {
  return url.pathname.includes(WORLD_BANK_TRADE_SERIES.exports) ? "exports" : "imports";
}
const isCountryMetadata = (url: URL) => url.pathname === "/v2/country/KOR";
const isMetadata = (url: URL) => !url.pathname.includes("/country/") || isCountryMetadata(url);
const COUNTRY = { id: "KOR", iso2Code: "KR", name: "Korea, Rep." };
function fixture(
  handler?: (url: URL, kind: Kind) => Response | Promise<Response>,
  config: {
    now?: () => Date;
    timeoutMs?: number;
    budgetMs?: number;
    countryResponse?: () => Response | Promise<Response>;
  } = {},
) {
  const urls: URL[] = [];
  const signals: AbortSignal[] = [];
  const client = createWorldBankTradeClient({
    ...config,
    now: config.now ?? (() => NOW),
    fetch: (async (input, init) => {
      const url = new URL(String(input));
      urls.push(url);
      signals.push(init!.signal!);
      assert.equal(url.origin, "https://api.worldbank.org");
      if (!isCountryMetadata(url)) assert.equal(url.searchParams.get("source"), "15");
      assert.equal(url.searchParams.get("format"), "json");
      assert.equal(url.searchParams.get("per_page"), "1000");
      assert.equal(url.searchParams.has("frequency"), false);
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      assert.equal(new Headers(init?.headers).has("authorization"), false);
      if (isCountryMetadata(url))
        return config.countryResponse ? config.countryResponse() : json([COUNTRY]);
      const kind = kindOf(url);
      return handler
        ? handler(url, kind)
        : json(isMetadata(url) ? [META(kind)] : [observation(kind)]);
    }) as typeof fetch,
  });
  return { ...client, urls, signals };
}
function rangeRows(url: URL, kind: Kind): Fields[] {
  const [start, end] = url.searchParams.get("date")!.split(":");
  let year = Number(start!.slice(0, 4)),
    month = Number(start!.slice(5));
  const result: Fields[] = [];
  while (`${year}M${String(month).padStart(2, "0")}` <= end!) {
    result.push(observation(kind, `${year}M${String(month).padStart(2, "0")}`));
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return result;
}

test("official source-15 metadata validates raw monthly USD-million exports/imports and converts exactly once", async () => {
  const client = fixture();
  const result = await client.fetchWorldBankTrade({ months: 1 });
  assert.deepEqual(result.exports, [{ period: "2026-09", valueUsd: 123_500_000 }]);
  assert.deepEqual(result.imports, result.exports);
  assert.equal(client.urls.length, 5);
  assert.equal(client.urls.filter(isCountryMetadata).length, 1);
  assert.deepEqual(
    result.providers.map((p) => [p.id, p.state, p.asOf]),
    [
      ["worldbank-exports", "ok", "2026-09"],
      ["worldbank-imports", "ok", "2026-09"],
    ],
  );
  assert.equal(
    result.providers.every((p) => p.configured && p.recordCount === 1),
    true,
  );
  assert.ok(result.source.includes("계절조정 전"));
  for (const url of client.urls.filter((url) => !isMetadata(url)))
    assert.equal(url.searchParams.get("date"), "2026M09:2026M09");
});

test("completed KST-month date syntax controls real monthly frequency and bounds history to 120 months", async () => {
  const client = fixture(
    (url, kind) => json(isMetadata(url) ? [META(kind)] : rangeRows(url, kind)),
    { now: () => new Date("2026-09-30T15:01:00Z") },
  );
  const result = await client.fetchWorldBankTrade({ months: 999 });
  assert.equal(result.exports.length, 120);
  assert.equal(result.exports[0].period, "2016-10");
  assert.equal(result.exports.at(-1)?.period, "2026-09");
  assert.equal(
    client.urls.find((url) => !isMetadata(url))?.searchParams.get("date"),
    "2016M10:2026M09",
  );
  assert.equal(result.providers[0].state, "ok");
});

test("unknown metadata units, source, identity, seasonal adjustment or valuation basis block data requests", async () => {
  const changes: Fields[] = [
    { id: "DXGSRMRCHSACD" },
    { source: { id: "2", value: "World Development Indicators" } },
    { unit: "Won" },
    { name: "Exports Merchandise, Customs, constant US$, millions" },
    {
      sourceNote:
        "Merchandise exports, free on board, in current US$ millions, seasonally adjusted.",
    },
    {
      sourceNote:
        "Merchandise exports, free on board, in current US$ billions, not seasonally adjusted.",
    },
    {
      sourceNote:
        "Merchandise exports, cost, insurance and freight, in current US$ millions, not seasonally adjusted.",
    },
  ];
  for (const change of changes) {
    const client = fixture((url, kind) =>
      json(
        isMetadata(url)
          ? [{ ...META(kind), ...(kind === "exports" ? change : {}) }]
          : [observation(kind)],
      ),
    );
    const result = await client.fetchWorldBankTrade({ months: 1 });
    assert.deepEqual(result.exports, []);
    assert.equal(result.providers[0].state, "unverified");
    assert.equal(result.imports.length, 1);
    assert.equal(
      client.urls.filter((url) => !isMetadata(url) && kindOf(url) === "exports").length,
      0,
    );
  }
});

test("equivalent USD-million wording remains verified without weakening NSA or valuation checks", async () => {
  for (const currency of [
    "current U.S. dollars, millions",
    "millions of current US dollars",
    "current USD, millions",
  ]) {
    const client = fixture((url, kind) =>
      json(
        isMetadata(url)
          ? [
              {
                ...META(kind),
                name: `${kind === "exports" ? "Exports" : "Imports"} Merchandise, Customs, ${currency}`,
                sourceNote: `Merchandise ${kind}, ${kind === "exports" ? "free on board" : "cost, insurance and freight"}, in ${currency}, not seasonally adjusted.`,
              },
            ]
          : [observation(kind)],
      ),
    );
    const result = await client.fetchWorldBankTrade({ months: 1 });
    assert.equal(result.exports[0].valueUsd, 123_500_000);
    assert.equal(
      result.providers.every((p) => p.state === "ok"),
      true,
    );
  }
  const reasons: [Fields, string][] = [
    [{ unit: "Won" }, "USD_MILLION_UNITS_UNVERIFIED"],
    [
      {
        sourceNote:
          "Merchandise exports, free on board, in current US$ millions, seasonally adjusted.",
      },
      "SEASONAL_BASIS_UNVERIFIED",
    ],
    [
      {
        sourceNote:
          "Merchandise exports, cost, insurance and freight, in current US$ millions, not seasonally adjusted.",
      },
      "VALUATION_BASIS_UNVERIFIED",
    ],
  ];
  for (const [change, reason] of reasons) {
    const result = await fixture((url, kind) =>
      json(isMetadata(url) ? [{ ...META(kind), ...change }] : [observation(kind)]),
    ).fetchWorldBankTrade({ months: 1 });
    assert.equal(result.providers[0].reasonCode, reason);
  }
});

test("annual, foreign-country, wrong-series, forecast, unknown-unit and invalid monetary rows fail closed", async () => {
  const changes: Fields[] = [
    { date: "2026" },
    { date: "2026M13" },
    { date: "2026M10" },
    { countryiso3code: "USA" },
    { country: { id: "US", value: "United States" } },
    { indicator: { id: WORLD_BANK_TRADE_SERIES.imports } },
    { obs_status: "F" },
    { unit: "Billions of U.S. Dollars" },
    { value: "123" },
    { value: -1 },
    { value: 1e20 },
  ];
  for (const change of changes) {
    const result = await fixture((url, kind) =>
      json(
        isMetadata(url)
          ? [META(kind)]
          : [{ ...observation(kind), ...(kind === "exports" ? change : {}) }],
      ),
    ).fetchWorldBankTrade({ months: 1 });
    assert.deepEqual(result.exports, []);
    assert.equal(result.providers[0].state, "unverified");
    assert.equal(result.imports.length, 1);
  }
  const wrongSource = await fixture((url, kind) =>
    json(isMetadata(url) ? [META(kind)] : [observation(kind)], {
      sourceid: isMetadata(url) ? "15" : "2",
    }),
  ).fetchWorldBankTrade({ months: 1 });
  assert.equal(wrongSource.providers[0].reasonCode, "SOURCE_MISMATCH");
});

test("identity failures identify the rejected field using safe constant reason codes", async () => {
  for (const [change, reason] of [
    [{ indicator: { id: "different-series" } }, "DATA_INDICATOR_IDENTITY"],
    [{ countryiso3code: "wrong-iso" }, "DATA_COUNTRY_ISO3"],
    [{ countryiso3code: "USA" }, "DATA_COUNTRY_ISO3"],
    [
      { country: { id: "unknown-country-id", value: "never-echo-provider-value" } },
      "DATA_COUNTRY_IDENTITY",
    ],
  ] as [Fields, string][]) {
    const result = await fixture((url, kind) =>
      json(isMetadata(url) ? [META(kind)] : [{ ...observation(kind), ...change }]),
    ).fetchWorldBankTrade({ months: 1 });
    assert.equal(
      result.providers.every((p) => p.reasonCode === reason),
      true,
    );
    assert.equal(result.exports.length, 0);
    assert.equal(JSON.stringify(result).includes("never-echo-provider-value"), false);
    assert.equal(JSON.stringify(result).includes("different-series"), false);
  }
});

test("missing GEM ISO3 fields require runtime-verified country aliases and the verified country label", async () => {
  for (const id of ["KR", "KOR"])
    for (const countryiso3code of [undefined, null, ""]) {
      const client = fixture((url, kind) =>
        json(
          isMetadata(url)
            ? [META(kind)]
            : [{ ...observation(kind), countryiso3code, country: { id, value: "Korea, Rep." } }],
        ),
      );
      const result = await client.fetchWorldBankTrade({ months: 1 });
      assert.equal(result.exports.length, 1);
      assert.equal(
        result.providers.every((p) => p.state === "ok"),
        true,
      );
      assert.equal(client.urls.filter(isCountryMetadata).length, 1);
    }
  for (const change of [
    { countryiso3code: "USA", country: { id: "KR", value: "Korea, Rep." } },
    { countryiso3code: "", country: { id: "US", value: "Korea, Rep." } },
    { countryiso3code: "", country: { id: "KR", value: "United States" } },
  ]) {
    const result = await fixture((url, kind) =>
      json(isMetadata(url) ? [META(kind)] : [{ ...observation(kind), ...change }]),
    ).fetchWorldBankTrade({ months: 1 });
    assert.equal(result.exports.length, 0);
    assert.equal(result.providers[0].state, "unverified");
  }
});

test("foreign, mismatched or failed official country metadata blocks data and country cache is shared for four hours", async () => {
  for (const country of [
    { ...COUNTRY, id: "USA" },
    { ...COUNTRY, iso2Code: "US" },
    { ...COUNTRY, name: "United States" },
  ]) {
    const client = fixture(undefined, { countryResponse: () => json([country]) });
    const result = await client.fetchWorldBankTrade({ months: 1 });
    assert.equal(
      result.providers.every((p) => p.reasonCode === "COUNTRY_METADATA_IDENTITY"),
      true,
    );
    assert.equal(client.urls.filter((url) => !isMetadata(url)).length, 0);
    assert.equal(client.urls.filter(isCountryMetadata).length, 1);
  }
  const unavailable = await fixture(undefined, {
    countryResponse: () => new Response("unavailable", { status: 503 }),
  }).fetchWorldBankTrade({ months: 1 });
  assert.equal(
    unavailable.providers.every((p) => p.reasonCode === "HTTP_503"),
    true,
  );
  let current = new Date(NOW);
  const client = fixture(undefined, { now: () => current });
  await client.fetchWorldBankTrade({ months: 1 });
  await client.fetchWorldBankTrade({ months: 2 });
  assert.equal(client.urls.filter(isCountryMetadata).length, 1);
  current = new Date(current.getTime() + 4 * 60 * 60_000 + 1);
  await client.fetchWorldBankTrade({ months: 1 });
  assert.equal(client.urls.filter(isCountryMetadata).length, 2);
});

test("null observations remain missing and never become zero; publication lag is explicit", async () => {
  const client = fixture((url, kind) =>
    json(isMetadata(url) ? [META(kind)] : [observation(kind), observation(kind, "2026M08", null)]),
  );
  const result = await client.fetchWorldBankTrade({ months: 2 });
  assert.equal(result.exports.length, 1);
  assert.equal(result.providers[0].state, "partial");
  assert.equal(result.providers[0].reasonCode, "INCOMPLETE_MONTHS");
  const stale = await fixture((url, kind) =>
    json(isMetadata(url) ? [META(kind)] : [observation(kind, "2026M01")]),
  ).fetchWorldBankTrade({ months: 12 });
  assert.equal(stale.providers[0].state, "stale");
  assert.equal(stale.providers[0].asOf, "2026-01");
});

test("all pages are required; repeated records, changing totals and short pages never publish partial history", async () => {
  for (const mode of ["valid", "duplicate", "changed", "short"] as const) {
    const client = fixture((url, kind) => {
      if (isMetadata(url)) return json([META(kind)]);
      const page = Number(url.searchParams.get("page"));
      return json([observation(kind, page === 1 || mode === "duplicate" ? "2026M09" : "2026M08")], {
        page,
        total: mode === "changed" && page === 2 ? 1 : 2,
        size: mode === "short" ? 2 : 1,
      });
    });
    const result = await client.fetchWorldBankTrade({ months: 2 });
    assert.equal(result.exports.length, mode === "valid" ? 2 : 0);
    assert.equal(result.providers[0].state, mode === "valid" ? "ok" : "unverified");
    if (mode === "duplicate") assert.equal(result.providers[0].reasonCode, "DUPLICATE_OBSERVATION");
  }
});

test("malformed or oversized responses and excessive pagination are bounded", async () => {
  for (const response of [
    () => new Response("<html>not JSON</html>"),
    () => new Response("x", { headers: { "content-length": "3000001" } }),
    () => new Response(new Uint8Array(3_000_001)),
    () => json([META("exports")], { total: 5000, pages: 5 }),
    () => json([META("exports")], { total: 2, pages: 1 }),
  ]) {
    const client = fixture(() => response());
    const result = await client.fetchWorldBankTrade({ months: 1 });
    assert.deepEqual(result.exports, []);
    assert.notEqual(result.providers[0].state, "ok");
    assert.equal(client.urls.length, 2);
  }
});

test("HTTP errors and transport messages never expose raw URLs or secrets", async () => {
  for (const status of [429, 403, 503]) {
    const result = await fixture(
      () => new Response("private provider response", { status }),
    ).fetchWorldBankTrade({ months: 1 });
    assert.equal(result.providers[0].state, status === 429 ? "rate-limited" : "unavailable");
    assert.equal(JSON.stringify(result).includes("private provider response"), false);
  }
  const result = await fixture(() => {
    throw new Error("https://private.invalid/?secret=never-return-this");
  }).fetchWorldBankTrade({ months: 1 });
  assert.equal(JSON.stringify(result).includes("never-return-this"), false);
  assert.equal(result.providers[0].reasonCode, "TRANSPORT_OR_JSON_ERROR");
});

test(
  "timeouts finish even if fetch ignores abort and abort every request",
  { timeout: 10_000 },
  async () => {
    const client = fixture(() => new Promise<Response>(() => {}), { timeoutMs: 10 });
    const result = await client.fetchWorldBankTrade({ months: 1 });
    assert.equal(
      result.providers.every((p) => p.reasonCode === "REQUEST_TIMEOUT"),
      true,
    );
    assert.equal(
      client.signals.every((signal) => signal.aborted),
      true,
    );
  },
);

test(
  "one series deadline bounds metadata plus all pages and aborts hanging transports",
  { timeout: 10_000 },
  async (t) => {
    for (const stage of ["metadata", "country", "first-page", "second-page"] as const) {
      const client = fixture(
        async (url, kind) => {
          if (stage === "metadata") return new Promise<Response>(() => {});
          if (isMetadata(url)) {
            // The data phase must inherit time already spent on metadata.
            await new Promise((resolve) => setTimeout(resolve, 15));
            return json([META(kind)]);
          }
          if (stage === "second-page" && url.searchParams.get("page") === "1")
            return json([observation(kind)], { size: 1, total: 2 });
          return new Promise<Response>(() => {});
        },
        {
          timeoutMs: 1000,
          budgetMs: 40,
          ...(stage === "country"
            ? { countryResponse: () => new Promise<Response>(() => {}) }
            : {}),
        },
      );
      const start = Date.now();
      const result = await client.fetchWorldBankTrade({ months: 2 });
      const elapsed = Date.now() - start;
      t.diagnostic(`${stage}: whole-load deadline completed after ${elapsed}ms`);
      assert.equal(
        result.providers.every((p) => p.reasonCode === "SERIES_TIMEOUT"),
        true,
      );
      assert.equal(
        client.signals.every((signal) => signal.aborted),
        true,
      );
      assert.equal(result.exports.length, 0);
      assert.equal(
        client.urls.filter((url) => !isMetadata(url)).length,
        stage === "metadata" || stage === "country" ? 0 : stage === "first-page" ? 2 : 4,
      );
    }
  },
);

test("single flight and fresh caches return independent copies; failed refresh uses only a recent verified snapshot", async () => {
  let date = new Date(NOW),
    fail = false;
  const client = fixture(
    (url, kind) =>
      fail
        ? new Response("unavailable", { status: 503 })
        : json(isMetadata(url) ? [META(kind)] : [observation(kind)]),
    { now: () => date },
  );
  const [first, second] = await Promise.all([
    client.fetchWorldBankTrade({ months: 1 }),
    client.fetchWorldBankTrade({ months: 1 }),
  ]);
  assert.equal(client.urls.length, 5);
  first.exports[0].valueUsd = 0;
  assert.equal(second.exports[0].valueUsd, 123_500_000);
  assert.equal((await client.fetchWorldBankTrade({ months: 1 })).exports[0].valueUsd, 123_500_000);
  assert.equal(client.urls.length, 5);
  fail = true;
  date = new Date(date.getTime() + 4 * 60 * 60_000 + 1);
  const stale = await client.fetchWorldBankTrade({ months: 1 });
  assert.equal(stale.exports.length, 1);
  assert.equal(stale.providers[0].state, "stale");
  assert.equal(stale.providers[0].reasonCode, "HTTP_503");
  const previous = client.urls.length;
  date = new Date(date.getTime() + 61_000);
  await client.fetchWorldBankTrade({ months: 1 });
  assert.equal(client.urls.length, previous + 2);
  date = new Date(NOW.getTime() + 8 * 24 * 60 * 60_000);
  const expired = await client.fetchWorldBankTrade({ months: 1 });
  assert.equal(expired.exports.length, 0);
  assert.equal(expired.providers[0].state, "unavailable");
});
