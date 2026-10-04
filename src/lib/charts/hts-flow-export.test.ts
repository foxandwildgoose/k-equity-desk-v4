import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alignChartFlow,
  emptyChartFlow,
  type FlowObservation,
  type FlowRequest,
} from "./hts-flow.ts";
import { chartReplayInstant, flowToCsv } from "./hts-flow-export.ts";

const request: FlowRequest = {
  code: "069500",
  market: "KR",
  instrument: "etf",
  exchange: "KOSPI",
  currency: "KRW",
  quantityUnit: "주",
  from: "2026-09-01",
  to: "2026-09-03",
  interval: "day",
};
const fixture = (availableAt: string | null, value: number | null = 10): FlowObservation => ({
  date: "2026-09-01",
  value,
  unit: "%",
  source: 'fixture, "provider"',
  sourceField: "foreignerHoldRatio",
  asOf: "2026-09-01",
  dateBasis: "trade-date",
  fetchedAt: "2026-09-03T01:00:00Z",
  availableAt,
  final: null,
  derived: false,
});
function prepare(observation: FlowObservation) {
  const flow = emptyChartFlow(request);
  flow.foreign = {
    ...flow.foreign,
    capability: "partial",
    reason: "원천 일부 제공",
    observations: [observation],
    providedFrom: observation.date,
    providedTo: observation.date,
  };
  flow.credit = { ...flow.credit, capability: "not-configured", reason: "KIS 인증 미설정" };
  flow.investmentTrust = {
    ...flow.investmentTrust,
    capability: "not-configured",
    reason: "KIS 인증 미설정",
  };
  const align = (replayAt?: string) =>
    alignChartFlow(flow, {
      dates: ["2026-09-01", "2026-09-02"],
      interval: "day",
      cumulativeStart: "2026-09-01",
      investmentTrustMode: "cumulative",
      replayAt,
    });
  return { flow, align };
}
function rows(csv: string) {
  const [head, ...lines] = csv.split("\r\n");
  const keys = head!.split(",");
  return lines.map((line) => {
    const values = [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((match) =>
      match[1]!.replaceAll('""', '"'),
    );
    return Object.fromEntries(keys.map((key, index) => [key, values[index]]));
  });
}

test("CSV publication guard compares numeric instants across timezone offsets", () => {
  const { flow, align } = prepare(fixture("2026-09-01T20:00:00Z"));
  const replayAt = "2026-09-01T23:59:59+09:00";
  const result = rows(flowToCsv(flow, align(replayAt), replayAt));
  assert.equal(
    result.some((row) => row.kind === "raw"),
    false,
  );
  assert.ok(result.some((row) => row.kind === "status" && row.metric === "foreign"));
  assert.ok(result.filter((row) => row.kind === "aligned").every((row) => row.value === ""));
});
test("CSV allows a known pre-cutoff publication and escapes provider text", () => {
  const { flow, align } = prepare(fixture("2026-09-01T12:00:00Z", 0));
  const replayAt = "2026-09-01T23:59:59+09:00";
  const result = rows(flowToCsv(flow, align(replayAt), replayAt));
  const raw = result.find((row) => row.kind === "raw")!;
  assert.equal(raw.value, "0");
  assert.equal(raw.source, 'fixture, "provider"');
  assert.equal(raw.unit, "%");
  assert.equal(raw.asOf, "2026-09-01");
  assert.equal(raw.availableAt, "2026-09-01T12:00:00Z");
  assert.equal(
    result.find(
      (row) => row.kind === "aligned" && row.metric === "foreign" && row.date === "2026-09-02",
    )?.value,
    "",
  );
});
test("unknown publication retains status rows for each unavailable panel", () => {
  const { flow, align } = prepare(fixture(null));
  const replayAt = "2026-09-03T23:59:59+09:00";
  const result = rows(flowToCsv(flow, align(replayAt), replayAt));
  assert.deepEqual(
    result.filter((row) => row.kind === "status").map((row) => row.metric),
    ["credit", "foreign", "investmentTrust"],
  );
  assert.match(
    result.find((row) => row.kind === "status" && row.metric === "foreign")!.reason!,
    /공표/,
  );
  assert.match(
    result.find((row) => row.kind === "status" && row.metric === "credit")!.reason!,
    /인증/,
  );
});
test("CSV exports raw calculation metadata and aligned partial provenance", () => {
  const { flow, align } = prepare({
    ...fixture(null),
    derived: true,
    formula: "same-date numerator / denominator * 100",
    denominator: 100,
    buy: 12,
    sell: 2,
  });
  flow.stale = true;
  const result = rows(flowToCsv(flow, align()));
  const raw = result.find((row) => row.kind === "raw")!;
  assert.equal(raw.denominator, "100");
  assert.equal(raw.buy, "12");
  assert.equal(raw.sell, "2");
  assert.equal(raw.stale, "true");
  assert.equal(raw.final, "");
  assert.equal(raw.requestedFrom, request.from);
  assert.equal(
    result.find((row) => row.kind === "aligned" && row.metric === "foreign")?.capability,
    "partial",
  );
});
test("CSV cannot leak unguarded aligned values if a caller forgets replay alignment", () => {
  const { flow, align } = prepare(fixture(null, 99));
  const result = rows(flowToCsv(flow, align(), "2026-09-03T23:59:59+09:00"));
  assert.equal(
    result.some((row) => row.value === "99"),
    false,
  );
  assert.ok(result.some((row) => row.kind === "aligned" && row.capability === "unknown"));
});
test("invalid replay cutoff fails closed rather than exporting future observations", () => {
  const { flow, align } = prepare(fixture("2026-09-01T12:00:00Z"));
  const result = rows(flowToCsv(flow, align(), "invalid"));
  assert.equal(
    result.some((row) => row.kind === "raw"),
    false,
  );
  assert.equal(
    result.some((row) => row.value === "10"),
    false,
  );
});
test("exchange-local replay cutoff observes Korean timezone and US winter/summer DST", () => {
  assert.equal(chartReplayInstant("2026-09-01", "KR"), "2026-09-01T23:59:59.999+09:00");
  assert.equal(chartReplayInstant("2026-01-15", "US"), "2026-01-15T23:59:59.999-05:00");
  assert.equal(chartReplayInstant("2026-07-15", "US"), "2026-07-15T23:59:59.999-04:00");
  assert.equal(chartReplayInstant("2026-03-08", "US"), "2026-03-08T23:59:59.999-04:00");
  assert.throws(() => chartReplayInstant("2026-02-30", "KR"));
});
test("CSV carries instrument/fixed-origin metadata and escapes text formulas without changing negative quantities", () => {
  const { flow, align } = prepare({ ...fixture(null, -40), source: "=UNTRUSTED()" });
  const result = rows(
    flowToCsv(flow, align(), undefined, { trustMode: "cumulative", cumulativeStart: "2026-09-01" }),
  );
  const raw = result.find((row) => row.kind === "raw")!;
  assert.equal(raw.source, "'=UNTRUSTED()");
  assert.equal(raw.value, "-40");
  assert.equal(raw.code, "069500");
  assert.equal(raw.market, "KR");
  assert.equal(raw.instrument, "etf");
  assert.equal(raw.trustMode, "cumulative");
  assert.equal(raw.cumulativeStart, "2026-09-01");
});

test("cumulative export checks every contributing publication and preserves provisional flags", () => {
  const { flow } = prepare(fixture(null));
  flow.investmentTrust = {
    ...flow.investmentTrust,
    capability: "available",
    observations: [
      { ...fixture("2026-09-03T12:00:00Z", 100), unit: "주" },
      {
        ...fixture("2026-09-02T12:00:00Z", -40),
        date: "2026-09-02",
        asOf: "2026-09-02",
        unit: "주",
        final: false,
      },
    ],
  };
  const unguarded = alignChartFlow(flow, {
    dates: ["2026-09-01", "2026-09-02"],
    interval: "day",
    cumulativeStart: "2026-09-01",
    investmentTrustMode: "cumulative",
  });
  const result = rows(
    flowToCsv(flow, unguarded, "2026-09-02T23:59:59+09:00", {
      trustMode: "cumulative",
      cumulativeStart: "2026-09-01",
    }),
  );
  assert.equal(
    result.find(
      (row) =>
        row.kind === "aligned" && row.metric === "investmentTrust" && row.date === "2026-09-02",
    )?.value,
    "",
  );
  assert.equal(
    result.find((row) => row.kind === "raw" && row.metric === "investmentTrust")?.final,
    "false",
  );
});
