import assert from "node:assert/strict";
import { test } from "node:test";
import { createOecdTradeClient, parseOecdTradeCsv, parseOecdTradeMetadata, parseOecdTradeAvailability } from "./export-oecd.ts";

// Synthetic protocol records for parser isolation. Never used by the product.
const HEADER = [
  "STRUCTURE",
  "STRUCTURE_ID",
  "REF_AREA",
  "COUNTERPART_AREA",
  "TRADE_FLOW",
  "Trade flow",
  "COMMODITY",
  "FREQ",
  "UNIT_MEASURE",
  "Unit of measure",
  "ADJUSTMENT",
  "Adjustment",
  "TRANSFORMATION",
  "Transformation",
  "UNIT_MULT",
  "TIME_PERIOD",
  "OBS_VALUE",
  "OBS_STATUS",
];
const RECORD: Record<string, string> = {
  STRUCTURE: "dataflow",
  STRUCTURE_ID: "OECD.SDD.TPS:DSD_IMTS@DF_IMTS(1.0)",
  REF_AREA: "KOR",
  COUNTERPART_AREA: "W",
  TRADE_FLOW: "X",
  "Trade flow": "Exports",
  COMMODITY: "_T",
  FREQ: "M",
  UNIT_MEASURE: "USD_EXC",
  "Unit of measure": "US dollars, exchange rate converted",
  ADJUSTMENT: "N",
  Adjustment: "Neither seasonally adjusted nor calendar adjusted",
  TRANSFORMATION: "_Z",
  Transformation: "Not applicable",
  UNIT_MULT: "9",
  TIME_PERIOD: "2026-09",
  OBS_VALUE: "60",
  OBS_STATUS: "A",
};
const encode = (value: string) => `"${value.replace(/"/g, '""')}"`;
function csv(records: Record<string, string>[] = [RECORD], header = HEADER): string {
  return [header, ...records.map((record) => header.map((key) => record[key] ?? ""))]
    .map((row) => row.map(encode).join(","))
    .join("\n");
}
const now = () => new Date("2026-09-30T15:01:00Z");
function metadataXml(omit: string[] = []): string {
  const lists: Record<string, Record<string, string>> = {
    REF_AREA: { KOR: "Korea", USA: "United States" },
    COUNTERPART_AREA: { W: "World", USA: "United States", _Z: "Not applicable" },
    TRADE_FLOW: { X: "Exports", M: "Imports", TB: "Trade balance" },
    COMMODITY: { _T: "Total", "01": "Live animals" },
    FREQ: { M: "Monthly", A: "Annual" },
    UNIT_MEASURE: { USD_EXC: "US dollars, exchange rate converted", PC: "Percentage" },
    ADJUSTMENT: {
      N: "Neither seasonally adjusted nor calendar adjusted",
      Y: "Calendar and seasonally adjusted",
    },
    TRANSFORMATION: { _Z: "Not applicable", GY: "Growth rate, over 1 year" },
  };
  for (const id of omit) delete lists[id];
  const dimensions = Object.keys(lists)
    .map(
      (id, index) =>
        `<Dimension id="${id}" position="${index + 1}"><LocalRepresentation><Enumeration><Ref id="CL_${id}" agencyID="OECD" version="1.0"/></Enumeration></LocalRepresentation></Dimension>`,
    )
    .join("");
  const codelists = Object.entries(lists)
    .map(
      ([id, codes]) =>
        `<Codelist id="CL_${id}" agencyID="OECD" version="1.0">${Object.entries(codes)
          .map(([code, label]) => `<Code id="${code}"><Name xml:lang="en">${label}</Name></Code>`)
          .join("")}</Codelist>`,
    )
    .join("");
  return `<Structure><Structures><Dataflows><Dataflow id="DSD_IMTS@DF_IMTS" agencyID="OECD.SDD.TPS" version="1.0"><Structure><Ref id="DSD_IMTS" agencyID="OECD.SDD.TPS" version="2.0"/></Structure></Dataflow></Dataflows><DataStructures><DataStructure id="DSD_IMTS" agencyID="OECD.SDD.TPS" version="2.0"><DataStructureComponents><DimensionList>${dimensions}<TimeDimension id="TIME_PERIOD" position="${Object.keys(lists).length + 1}"/></DimensionList></DataStructureComponents></DataStructure></DataStructures><Codelists>${codelists}</Codelists></Structures></Structure>`;
}
function availabilityXml(patch: Record<string, string[]> = {}): string {
  const values = { ...parseOecdTradeMetadata(metadataXml()).selected, ...patch };
  const keys = Object.entries(values).map(([id, codes]) => `<KeyValue id="${id}">${codes.map(code => `<Value>${code}</Value>`).join("")}</KeyValue>`).join("");
  return `<Structure><Structures><Constraints><ContentConstraint id="ACTUAL" type="Actual"><ConstraintAttachment><Dataflow><Ref id="DSD_IMTS@DF_IMTS" agencyID="OECD.SDD.TPS" version="1.0"/></Dataflow></ConstraintAttachment><CubeRegion include="true">${keys}</CubeRegion></ContentConstraint></Constraints></Structures></Structure>`;
}
const withMetadata =
  (dataFetch: typeof fetch): typeof fetch =>
  async (input, init) =>
    new URL(String(input)).pathname.includes("/dataflow/")
      ? new Response(metadataXml())
      : new URL(String(input)).pathname.includes("/availableconstraint/")
      ? new Response(availabilityXml())
      : dataFetch(input, init);

test("OECD uses actual Korea availability instead of globally valid World codes", () => {
  const domain = parseOecdTradeMetadata(metadataXml());
  const actual = parseOecdTradeAvailability(availabilityXml({ COUNTERPART_AREA: ["_Z"] }), domain);
  assert.equal(actual.key, "KOR._Z.X+M._T.M.USD_EXC.N._Z");
  assert.equal(parseOecdTradeCsv(csv([{ ...RECORD, COUNTERPART_AREA: "_Z" }]), now(), actual).exports[0]?.valueUsd, 60_000_000_000);
  assert.throws(() => parseOecdTradeAvailability(availabilityXml({ REF_AREA: ["USA"] }), domain));
  assert.throws(() => parseOecdTradeAvailability(availabilityXml({ COUNTERPART_AREA: ["USA"] }), domain));
  assert.throws(() => parseOecdTradeAvailability(availabilityXml({ COUNTERPART_AREA: ["W", "_Z"] }), domain));
  assert.throws(() => parseOecdTradeAvailability(availabilityXml().replace('id="DSD_IMTS@DF_IMTS"', 'id="OTHER"'), domain));
  assert.throws(() => parseOecdTradeAvailability(availabilityXml().replace('include="true"', 'include="false"'), domain));
});

test("OECD resolves the observed Non transformed data level from availability and verifies its CSV label", () => {
  const metadata = metadataXml().replace('<Code id="GY">', '<Code id="N"><Name xml:lang="en">Non transformed data</Name></Code><Code id="GY">');
  const domain = parseOecdTradeMetadata(metadata);
  assert.deepEqual(domain.selected.TRANSFORMATION, ["_Z", "N"], "global level alternatives remain unresolved until actual availability");
  const actual = parseOecdTradeAvailability(availabilityXml({ TRANSFORMATION: ["N"] }), domain);
  assert.deepEqual(actual.selected.TRANSFORMATION, ["N"]);
  const data = csv([{ ...RECORD, TRANSFORMATION: "N", Transformation: "Non transformed data" }]);
  assert.equal(parseOecdTradeCsv(data, now(), actual).exports[0]?.valueUsd, 60_000_000_000);
});

test("OECD availability request produces two exact independently validated labelled CSV flow queries", async () => {
  const paths: string[] = [];
  const result = await createOecdTradeClient({ now, fetch: async (input, init) => {
    const url = new URL(String(input)); paths.push(url.pathname);
    if (url.pathname.includes("/dataflow/")) return new Response(metadataXml());
    if (url.pathname.includes("/availableconstraint/")) {
      assert.ok(url.pathname.endsWith("/KOR..X+M._T.M.USD_EXC.N."));
      assert.equal(url.searchParams.get("mode"), "exact");
      return new Response(availabilityXml({ COUNTERPART_AREA: ["_Z"] }));
    }
    assert.match(url.pathname, /\/KOR\._Z\.[XM]\._T\.M\.USD_EXC\.N\._Z$/);
    assert.equal(new Headers(init?.headers).get("accept"), "text/csv");
    assert.equal(url.searchParams.get("format"), "csvfilewithlabels");
    const imports = url.pathname.includes("/KOR._Z.M.");
    return new Response(csv([{ ...RECORD, COUNTERPART_AREA: "_Z", TRADE_FLOW: imports ? "M" : "X", "Trade flow": imports ? "Imports" : "Exports", OBS_VALUE: imports ? "50" : "60" }]));
  } }).fetchOecdTrade();
  assert.equal(paths.length, 4);
  assert.equal(result.exports[0]?.valueUsd, 60_000_000_000);
  assert.equal(result.imports[0]?.valueUsd, 50_000_000_000);
  assert.match(result.providers[0]!.message, /선택 통계키: KOR\._Z/);
});

test("OECD derives a fully pinned query from exact official dataflow references and labelled codelists", () => {
  const profile = parseOecdTradeMetadata(metadataXml());
  assert.equal(profile.key, "KOR.W.X+M._T.M.USD_EXC.N._Z");
  assert.equal(profile.dimensions.length, 8);
  assert.throws(() =>
    parseOecdTradeMetadata(metadataXml().replace('id="DSD_IMTS@DF_IMTS"', 'id="OTHER"')),
  );
  assert.throws(() =>
    parseOecdTradeMetadata(
      metadataXml().replace(
        'agencyID="OECD.SDD.TPS" version="2.0"/>',
        'agencyID="OTHER" version="2.0"/>',
      ),
    ),
  );
  assert.throws(() =>
    parseOecdTradeMetadata(
      metadataXml().replace("Neither seasonally adjusted nor calendar adjusted", "Unknown basis"),
    ),
  );
  const noPartner = parseOecdTradeMetadata(metadataXml(["COUNTERPART_AREA"]));
  assert.equal(noPartner.roles.partner, undefined);
  assert.ok(!noPartner.key.includes(".."));
  const changedCodes = parseOecdTradeMetadata(
    metadataXml()
      .replace('<Code id="W">', '<Code id="ALL_WORLD">')
      .replace('<Code id="_T">', '<Code id="ALL_GOODS">'),
  );
  assert.equal(changedCodes.key, "KOR.ALL_WORLD.X+M.ALL_GOODS.M.USD_EXC.N._Z");
  for (const label of ["Goods", "Total goods"]) {
    const productProfile = parseOecdTradeMetadata(
      metadataXml().replaceAll("COMMODITY", "PRODUCT_TYPE").replace(">Total<", `>${label}<`),
    );
    assert.equal(productProfile.roles.commodity, "PRODUCT_TYPE");
    const productCsv = csv(
      [{ ...RECORD, PRODUCT_TYPE: "_T" }],
      HEADER.map((column) => (column === "COMMODITY" ? "PRODUCT_TYPE" : column)),
    );
    assert.equal(
      parseOecdTradeCsv(productCsv, now(), productProfile).exports[0]?.valueUsd,
      60_000_000_000,
    );
  }
  const goodsAndTotal = parseOecdTradeMetadata(
    metadataXml().replaceAll("COMMODITY", "PRODUCT_TYPE").replace(">Live animals<", ">Goods<"),
  );
  assert.deepEqual(goodsAndTotal.selected.PRODUCT_TYPE, ["01"], "a broad goods/services Total is not merchandise goods");
  assert.throws(
    () => parseOecdTradeMetadata(metadataXml().replaceAll("COMMODITY", "PRODUCT_TYPE")),
    /METADATA_AMBIGUOUS_PRODUCT_TYPE_MATCHES_0/,
  );
});

test("OECD selects the observed IMTS Commodities product label and excludes services/all-products totals", () => {
  const productCodes = Object.entries({ C: "Commodities", S: "Services", _T: "Total - all products", _Z: "Not applicable" }).map(([code, label]) => `<Code id="${code}"><Name xml:lang="en">${label}</Name></Code>`).join("");
  const observed = metadataXml().replaceAll("COMMODITY", "PRODUCT_TYPE").replace(/(<Codelist id="CL_PRODUCT_TYPE" agencyID="OECD" version="1.0">)[\s\S]*?(<\/Codelist>)/, `$1${productCodes}$2`);
  const profile = parseOecdTradeMetadata(observed);
  assert.deepEqual(profile.selected.PRODUCT_TYPE, ["C"]);
  const header = HEADER.map(column => column === "COMMODITY" ? "PRODUCT_TYPE" : column);
  assert.equal(parseOecdTradeCsv(csv([{ ...RECORD, PRODUCT_TYPE: "C" }], header), now(), profile).exports[0]?.valueUsd, 60_000_000_000);
  for (const excluded of ["S", "_T", "_Z"]) assert.deepEqual(parseOecdTradeCsv(csv([{ ...RECORD, PRODUCT_TYPE: excluded }], header), now(), profile).exports, []);
});

test("OECD never fetches trade observations when official metadata cannot identify its exact series", async () => {
  const paths: string[] = [];
  const result = await createOecdTradeClient({
    now,
    fetch: async (input) => {
      paths.push(new URL(String(input)).pathname);
      return new Response(metadataXml().replace('id="DSD_IMTS@DF_IMTS"', 'id="OTHER"'));
    },
  }).fetchOecdTrade();
  assert.equal(paths.length, 1);
  assert.ok(paths[0]?.includes("/dataflow/"));
  assert.equal(result.providers[0]?.reasonCode, "METADATA_DATAFLOW_IDENTITY");
  assert.deepEqual(result.exports, []);
});

test("OECD exposes only bounded PRODUCT_TYPE label hints when no goods label is recognized", async () => {
  const extraCodes = Array.from({ length: 8 }, (_, index) => `<Code id="LONG${index}"><Name xml:lang="en">Unrecognized\n public label ${"x".repeat(200)}</Name></Code>`).join("");
  const metadata = metadataXml().replaceAll("COMMODITY", "PRODUCT_TYPE").replace('<Codelist id="CL_PRODUCT_TYPE" agencyID="OECD" version="1.0">', `<Codelist id="CL_PRODUCT_TYPE" agencyID="OECD" version="1.0">${extraCodes}`);
  const result = await createOecdTradeClient({ now, fetch: async () => new Response(metadata) }).fetchOecdTrade();
  assert.equal(result.providers[0]?.reasonCode, "METADATA_AMBIGUOUS_PRODUCT_TYPE_MATCHES_0");
  const hints = result.providers[0]!.message.split("공식 PRODUCT_TYPE 코드 설명: ")[1]!.split(" / ");
  assert.equal(hints.length, 5);
  assert.ok(hints.every(hint => hint.length <= 120 && !/[\u0000-\u001f\u007f<>]/.test(hint)));
  assert.ok(!result.providers[0]!.message.includes("LONG5"));
  const unrelated = await createOecdTradeClient({ now, fetch: async () => new Response(metadataXml().replace("Neither seasonally adjusted nor calendar adjusted", "Unknown basis")) }).fetchOecdTrade();
  assert.ok(!unrelated.providers[0]!.message.includes("공식 PRODUCT_TYPE 코드 설명"));
});

test("OECD converts only explicit USD multipliers and uses completed Korean months", () => {
  const parsed = parseOecdTradeCsv(
    csv([
      RECORD,
      { ...RECORD, TRADE_FLOW: "M", "Trade flow": "Imports", OBS_VALUE: "50", OBS_STATUS: "P" },
      { ...RECORD, TIME_PERIOD: "2026-10", OBS_VALUE: "99" },
    ]),
    now(),
  );
  assert.deepEqual(parsed.exports, [{ period: "2026-09", valueUsd: 60_000_000_000 }]);
  assert.deepEqual(parsed.imports, [{ period: "2026-09", valueUsd: 50_000_000_000 }]);
  assert.equal(parsed.provisional, true);
  for (const [multiplier, expected] of [
    ["0", 60],
    ["3", 60_000],
    ["6", 60_000_000],
  ] as const) {
    assert.equal(
      parseOecdTradeCsv(csv([{ ...RECORD, UNIT_MULT: multiplier }]), now()).exports[0]?.valueUsd,
      expected,
    );
  }
});

test("OECD validates exact identity, USD labels, scale, dimensions and adjustment", () => {
  const wrongRecords: Record<string, string>[] = [
    { STRUCTURE_ID: "OECD.SDD.TPS:OTHER(1.0)" },
    { "Unit of measure": "Korean won" },
    { UNIT_MULT: "" },
    { UNIT_MULT: "2" },
    { "Unit of measure": "Billions of US dollars", UNIT_MULT: "6" },
    { Adjustment: "Seasonally adjusted" },
    { "Trade flow": "Balance" },
  ];
  for (const wrong of wrongRecords) {
    assert.throws(() => parseOecdTradeCsv(csv([{ ...RECORD, ...wrong }]), now()));
  }
  const excludedRecords: Record<string, string>[] = [
    { REF_AREA: "PRK" },
    { COUNTERPART_AREA: "USA" },
    { COMMODITY: "01" },
    { FREQ: "A" },
    { ADJUSTMENT: "Y" },
    { UNIT_MEASURE: "PC" },
    { TRANSFORMATION: "GY", Transformation: "Growth rate, over 1 year" },
  ];
  for (const excluded of excludedRecords) {
    assert.equal(parseOecdTradeCsv(csv([{ ...RECORD, ...excluded }]), now()).exports.length, 0);
  }
  assert.throws(() =>
    parseOecdTradeCsv(
      csv(
        [RECORD],
        HEADER.filter((key) => key !== "UNIT_MULT"),
      ),
      now(),
    ),
  );
  assert.throws(() =>
    parseOecdTradeCsv(
      csv([{ ...RECORD, UNKNOWN_DIMENSION: "A" }], [...HEADER, "UNKNOWN_DIMENSION"]),
      now(),
    ),
  );
});

test("OECD missing observations and conflicting duplicate months never become zero or sums", () => {
  const parsed = parseOecdTradeCsv(
    csv([
      RECORD,
      { ...RECORD, OBS_VALUE: "61" },
      { ...RECORD, TIME_PERIOD: "2026-08", OBS_VALUE: "" },
      { ...RECORD, TIME_PERIOD: "2026-07", OBS_VALUE: " " },
      { ...RECORD, TIME_PERIOD: "2026-06", OBS_VALUE: "0" },
    ]),
    now(),
  );
  assert.deepEqual(parsed.exports, [{ period: "2026-06", valueUsd: 0 }]);
});

test("OECD verifies metadata before its pinned official query and shares inflight/cache work", async () => {
  let calls = 0;
  const client = createOecdTradeClient({
    now,
    fetch: withMetadata(async (input) => {
      calls++;
      const url = new URL(String(input));
      assert.equal(url.origin, "https://sdmx.oecd.org");
      assert.match(decodeURIComponent(url.pathname), /\/KOR\.W\.[XM]\._T\.M\.USD_EXC\.N\._Z$/);
      assert.equal(url.searchParams.get("format"), "csvfilewithlabels");
      assert.equal(url.searchParams.get("endPeriod"), "2026-09");
      return new Response(csv());
    }),
  });
  const [a, b] = await Promise.all([client.fetchOecdTrade(), client.fetchOecdTrade()]);
  assert.deepEqual(a, b);
  assert.equal(calls, 2);
  assert.equal(a.providers[0]?.state, "partial");
  assert.equal(a.providers[1]?.state, "empty");
  await client.fetchOecdTrade();
  assert.equal(calls, 2);
});

test("OECD keeps a validated flow when the other exact series fails or exceeds the shared deadline", async () => {
  for (const stall of [false, true]) {
    let cancelled = false;
    const client = createOecdTradeClient({ now, timeoutMs: 50, fetch: withMetadata(async input => {
      if (new URL(String(input)).pathname.includes("/KOR.W.M.")) return stall
        ? new Response(new ReadableStream({ cancel() { cancelled = true; } }))
        : new Response("untrusted upstream detail", { status: 500 });
      return new Response(csv());
    }) });
    const result = await client.fetchOecdTrade();
    assert.equal(result.exports[0]?.valueUsd, 60_000_000_000);
    assert.deepEqual(result.imports, []);
    assert.equal(result.providers[0]?.state, "partial");
    assert.equal(result.providers[1]?.state, "unavailable");
    assert.equal(result.providers[1]?.reasonCode, stall ? "REQUEST_TIMEOUT" : "HTTP_500");
    if (stall) assert.equal(cancelled, true);
    assert.ok(!JSON.stringify(result).includes("untrusted upstream"));
  }
});

test("OECD forecasts, missing values and unknown observation status never become actual trade", async () => {
  for (const status of ["F", "M", "UNKNOWN", ""]) {
    const records = csv([
      { ...RECORD, OBS_STATUS: status, OBS_VALUE: status === "M" ? "0" : "60" },
    ]);
    const parsed = parseOecdTradeCsv(records, now());
    assert.deepEqual(parsed.exports, []);
    const result = await createOecdTradeClient({
      now,
      fetch: withMetadata(async () => new Response(records)),
    }).fetchOecdTrade();
    assert.equal(result.providers[0]?.state, "unverified");
    assert.equal(result.providers[0]?.reasonCode, "OBS_STATUS_UNVERIFIED");
  }
});

test("OECD discloses short, gapped and conflict-filtered histories; verified cache cannot be mutated by callers", async () => {
  const records = Array.from({ length: 25 }, (_, index) => ({
    ...RECORD,
    TIME_PERIOD: new Date(Date.UTC(2024, 8 + index, 1)).toISOString().slice(0, 7),
  }));
  const healthy = await createOecdTradeClient({
    now,
    fetch: withMetadata(async () => new Response(csv(records))),
  }).fetchOecdTrade();
  assert.equal(healthy.providers[0]?.state, "ok");
  const gapped = await createOecdTradeClient({
    now,
    fetch: withMetadata(
      async () => new Response(csv(records.filter((_record, index) => index !== 10))),
    ),
  }).fetchOecdTrade();
  assert.equal(gapped.providers[0]?.state, "partial");
  assert.equal(gapped.providers[0]?.reasonCode, "INSUFFICIENT_OR_GAPPED_HISTORY");
  const conflicts = await createOecdTradeClient({
    now,
    fetch: withMetadata(
      async () => new Response(csv([...records, { ...records[10]!, OBS_VALUE: "61" }])),
    ),
  }).fetchOecdTrade();
  assert.equal(conflicts.providers[0]?.state, "partial");
  assert.equal(conflicts.providers[0]?.reasonCode, "CONFLICTING_OBSERVATIONS");
  const client = createOecdTradeClient({
    now,
    fetch: withMetadata(async () => new Response(csv())),
  });
  const first = await client.fetchOecdTrade();
  first.exports[0]!.valueUsd = 1;
  first.providers[0]!.state = "ok";
  const again = await client.fetchOecdTrade();
  assert.equal(again.exports[0]?.valueUsd, 60_000_000_000);
  assert.equal(again.providers[0]?.state, "partial");
});

test("OECD no-response body deadline cancels transport and never retries429", async () => {
  let cancelled = false;
  const timeout = createOecdTradeClient({
    now,
    timeoutMs: 20,
    fetch: async () =>
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
      ),
  });
  const failed = await timeout.fetchOecdTrade();
  assert.equal(failed.providers[0]?.reasonCode, "REQUEST_TIMEOUT");
  assert.equal(cancelled, true);
  let calls = 0;
  const throttled = createOecdTradeClient({
    now,
    fetch: async () => {
      calls++;
      return new Response("sensitive provider detail", { status: 429 });
    },
  });
  const result = await throttled.fetchOecdTrade();
  await throttled.fetchOecdTrade();
  assert.equal(calls, 1);
  assert.ok(result.providers.every((provider) => provider.state === "rate-limited"));
  assert.ok(!JSON.stringify(result).includes("sensitive"));
});

test("OECD stale cache is explicit and expires; schema diagnostics reveal only bounded column names", async () => {
  let clock = now(),
    fail = false;
  const client = createOecdTradeClient({
    now: () => clock,
    fetch: withMetadata(async () =>
      fail ? new Response("", { status: 503 }) : new Response(csv()),
    ),
  });
  await client.fetchOecdTrade();
  clock = new Date(clock.getTime() + 5 * 60 * 60_000);
  fail = true;
  const stale = await client.fetchOecdTrade();
  assert.equal(stale.providers[0]?.state, "stale");
  assert.equal(stale.exports.length, 1);
  clock = new Date(clock.getTime() + 8 * 86_400_000);
  assert.equal((await client.fetchOecdTrade()).exports.length, 0);
  const schema = createOecdTradeClient({
    now,
    fetch: withMetadata(async () => new Response("UNKNOWN_CODE,secret value\nanything,anything")),
  });
  const invalid = await schema.fetchOecdTrade();
  assert.equal(invalid.providers[0]?.state, "unverified");
  assert.match(invalid.providers[0]!.message, /UNKNOWN_CODE/);
  assert.ok(!JSON.stringify(invalid).includes("secret value"));
});
