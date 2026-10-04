import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alignChartFlow,
  datedRatio,
  emptyChartFlow,
  flowRequestKey,
  flowClientQueryKey,
  nullableFlowNumber,
  type FlowObservation,
  type FlowRequest,
  type FlowResponse,
} from "./hts-flow.ts";

const request: FlowRequest = {
  code: "069500",
  market: "KR",
  instrument: "etf",
  exchange: "KOSPI",
  currency: "KRW",
  quantityUnit: "주",
  from: "2026-09-01",
  to: "2026-10-02",
  interval: "day",
};
function sample(date: string, value: number | null): FlowObservation {
  return {
    date,
    value,
    unit: "주",
    source: "test fixture",
    sourceField: "ivtr_ntby_qty",
    asOf: date,
    dateBasis: "trade-date",
    fetchedAt: "2026-10-03T01:00:00Z",
    availableAt: null,
    final: null,
    derived: false,
  };
}
function response(values: Array<[string, number | null]>): FlowResponse {
  const result = emptyChartFlow(request);
  for (const id of ["credit", "foreign", "investmentTrust"] as const)
    result[id] = {
      ...result[id],
      capability: "available",
      observations: values.map(([date, value]) => sample(date, value)),
      providedFrom: values[0]?.[0] ?? null,
      providedTo: values.at(-1)?.[0] ?? null,
    };
  return result;
}
const daily = {
  dates: ["2026-09-01", "2026-09-02", "2026-09-03"],
  interval: "day" as const,
  cumulativeStart: "2026-09-01",
  investmentTrustMode: "cumulative" as const,
};

test("flow nullable parsing preserves zero, percentages and explicit thousands scaling", () => {
  for (const value of ["", " ", "-", "N/A", null, undefined, NaN, Infinity, "3원"])
    assert.equal(nullableFlowNumber(value), null);
  assert.equal(nullableFlowNumber("0%"), 0);
  assert.equal(nullableFlowNumber("12.6%"), 12.6);
  assert.equal(nullableFlowNumber("-1,234"), -1234);
  assert.equal(nullableFlowNumber("1.25", 1000), 1250);
});
test("ratios use equal dates and units, never the current denominator for historical observations", () => {
  const n = { date: "2026-09-01", value: 10, unit: "주" as const };
  assert.equal(datedRatio(n, { ...n, value: 100 }), 10);
  assert.equal(datedRatio(n, { ...n, date: "2026-09-02", value: 100 }), null);
  assert.equal(datedRatio(n, { ...n, unit: "좌", value: 100 }), null);
  assert.equal(datedRatio(n, { ...n, value: 0 }), null);
});
test("fixed cumulative start yields 100,60,120 and scrolling does not reset it", () => {
  const r = response([
    ["2026-09-03", 60],
    ["2026-09-01", 100],
    ["2026-09-02", -40],
  ]);
  assert.deepEqual(
    alignChartFlow(r, daily).investmentTrust.points.map((p) => p.value),
    [100, 60, 120],
  );
  assert.equal(
    alignChartFlow(r, { ...daily, dates: ["2026-09-03"] }).investmentTrust.points[0]?.value,
    120,
  );
});
test("missing daily net value poisons every later cumulative total, while zero stays valid", () => {
  const r = response([
    ["2026-09-01", 100],
    ["2026-09-03", 60],
  ]);
  assert.deepEqual(
    alignChartFlow(r, daily).investmentTrust.points.map((p) => p.value),
    [100, null, null],
  );
  const zero = response([
    ["2026-09-01", 100],
    ["2026-09-02", 0],
    ["2026-09-03", 60],
  ]);
  assert.deepEqual(
    alignChartFlow(zero, daily).investmentTrust.points.map((p) => p.value),
    [100, 100, 160],
  );
});
test("loading a later partial window does not silently restart the fixed cumulative origin", () => {
  const r = response([
    ["2026-09-02", 100],
    ["2026-09-03", 60],
  ]);
  assert.deepEqual(
    alignChartFlow(r, { ...daily, dates: ["2026-09-02", "2026-09-03"] }).investmentTrust.points.map(
      (p) => p.value,
    ),
    [null, null],
  );
});
test("ratios take last valid observation, weekly/monthly/yearly net quantities sum", () => {
  const r = response([
    ["2026-09-01", 10],
    ["2026-09-02", -4],
    ["2026-09-03", 6],
  ]);
  for (const interval of ["week", "month", "year"] as const) {
    const a = alignChartFlow(r, {
      ...daily,
      interval,
      dates: ["2026-09-01"],
      investmentTrustMode: "daily",
    });
    assert.equal(a.foreign.points[0]?.value, 6);
    assert.equal(a.investmentTrust.points[0]?.value, 12);
    assert.equal(
      alignChartFlow(r, { ...daily, interval, dates: ["2026-09-01"] }).investmentTrust.points[0]
        ?.value,
      12,
    );
  }
});
test("partial aggregate keeps the valid last ratio with missing-session metadata", () => {
  const r = response([
    ["2026-09-01", 10],
    ["2026-09-03", null],
  ]);
  const a = alignChartFlow(r, {
    ...daily,
    dates: ["2026-09-01"],
    interval: "week",
    expectedDailyDates: daily.dates,
  });
  assert.equal(a.foreign.points[0]?.value, 10);
  assert.equal(a.foreign.points[0]?.partial, true);
  assert.equal(a.investmentTrust.points[0]?.value, null);
});
test("no forward fill and no value before fixed cumulative start", () => {
  const r = response([
    ["2026-09-01", 10],
    ["2026-09-03", 6],
  ]);
  const a = alignChartFlow(r, { ...daily, cumulativeStart: "2026-09-03" });
  assert.equal(a.foreign.points[1]?.value, null);
  assert.equal(a.investmentTrust.points[0]?.value, null);
  assert.equal(a.investmentTrust.points[2]?.value, 6);
});
test("minute curve disabled; replay requires known publication time and excludes later releases", () => {
  const r = response([["2026-09-01", 10]]);
  assert.equal(alignChartFlow(r, { ...daily, interval: "minute" }).foreign.points[0]?.value, null);
  assert.match(
    alignChartFlow(r, { ...daily, replayAt: "2026-09-02T00:00:00Z" }).foreign.reason,
    /공표/,
  );
  r.foreign.observations[0]!.availableAt = "2026-09-02T08:00:00Z";
  assert.equal(
    alignChartFlow(r, { ...daily, replayAt: "2026-09-02T00:00:00Z" }).foreign.points[0]?.value,
    null,
  );
  assert.equal(
    alignChartFlow(r, { ...daily, replayAt: "2026-09-02T09:00:00Z" }).foreign.points[0]?.value,
    10,
  );
});
test("duplicate versions replace by fetchedAt, and response identities never collide", () => {
  const r = response([
    ["2026-09-01", 10],
    ["2026-09-01", 11],
  ]);
  assert.equal(alignChartFlow(r, daily).foreign.points[0]?.value, 11);
  for (const patch of [
    { code: "379800" },
    { instrument: "stock" as const },
    { market: "US" as const },
    { from: "2026-08-01" },
    { interval: "week" as const },
    { quantityUnit: "좌" as const },
    { exchange: "KOSDAQ" },
  ])
    assert.notEqual(flowRequestKey(request), flowRequestKey({ ...request, ...patch }));
});

test("an owner's browser response cannot be selected from another session or signed-out query", () => {
  const cache = new Map<string, FlowResponse>();
  cache.set(JSON.stringify(flowClientQueryKey(request, "owner-session")), response([["2026-09-01", 10]]));
  assert.equal(cache.get(JSON.stringify(flowClientQueryKey(request, "another-session"))), undefined);
  assert.equal(cache.get(JSON.stringify(flowClientQueryKey(request, null))), undefined);
  assert.equal(cache.get(JSON.stringify(flowClientQueryKey({ ...request, code: "403870" }, "owner-session"))), undefined);
});

test("weekend origin with Monday observed session does not poison cumulative; latest missing stays null", () => {
  const r = response([["2026-09-07", 10], ["2026-09-08", -4]]);
  const a = alignChartFlow(r, {dates:["2026-09-07","2026-09-08","2026-09-09"],expectedDailyDates:["2026-09-07","2026-09-08","2026-09-09"],interval:"day",cumulativeStart:"2026-09-05",investmentTrustMode:"cumulative"});
  assert.deepEqual(a.investmentTrust.points.map(p=>p.value),[10,6,null]);
});
test("partial weekly net sum is null while raw daily values and last valid ratio remain", () => {
  const r=response([["2026-09-01",10],["2026-09-03",6]]);
  const a=alignChartFlow(r,{...daily,dates:["2026-09-01"],expectedDailyDates:daily.dates,interval:"week",investmentTrustMode:"daily"});
  assert.equal(a.investmentTrust.points[0]?.value,null);assert.equal(a.foreign.points[0]?.value,6);assert.equal(r.investmentTrust.observations.length,2);
});
test("available continuous segment is opt-in and exposes a different actual origin", () => {
  const r=response([["2026-09-01",100],["2026-09-03",6]]);
  assert.deepEqual(alignChartFlow(r,{...daily,investmentTrustMode:"cumulative"}).investmentTrust.points.map(p=>p.value),[100,null,null]);
  assert.deepEqual(alignChartFlow(r,{...daily,investmentTrustMode:"available-cumulative"}).investmentTrust.points.map(p=>p.value),[null,null,6]);
  r.investmentTrust.observations[1]!.value=12;
  assert.equal(alignChartFlow(r,{...daily,investmentTrustMode:"available-cumulative"}).investmentTrust.points[2]?.value,12);
});
test("a gap in an earlier month does not hide a complete daily-net sum in the next month", () => {
  const r = response([["2026-09-01", 10], ["2026-09-03", 6], ["2026-10-01", 12], ["2026-10-02", -4]]);
  for (const id of ["credit", "foreign", "investmentTrust"] as const) r[id].capability = "partial";
  const options = { ...daily, dates: ["2026-09-01", "2026-10-01"], expectedDailyDates: ["2026-09-01", "2026-09-02", "2026-09-03", "2026-10-01", "2026-10-02"], interval: "month" as const };
  const net = alignChartFlow(r, { ...options, investmentTrustMode: "daily" });
  assert.deepEqual(net.investmentTrust.points.map(point => point.value), [null, 8]);
  assert.deepEqual(net.foreign.points.map(point => point.partial), [true, false]);
  assert.equal(alignChartFlow(r, options).investmentTrust.points[1]?.value, null);
});
