import assert from "node:assert/strict";
import test from "node:test";
import { emptyChartFlow, type FlowRequest, type FlowResponse, type KiwoomHealthStatus } from "./hts-flow.ts";
import { flowRefreshInterval, koreaMarketDay, makeChartFlowRequest } from "./flow-query-policy.ts";

const identity = { code: "018260", market: "KR", instrument: "stock", exchange: "KOSPI", currency: "KRW", quantityUnit: "주", interval: "day" } as const;
const request: FlowRequest = { ...identity, from: "2026-09-01", to: "2026-10-08" };
function response(health: KiwoomHealthStatus, mode: "collector" | "direct" = "collector"): FlowResponse {
  const result = emptyChartFlow(request);
  for (const id of ["credit", "foreign", "investmentTrust"] as const) result[id] = {
    ...result[id], health,
    diagnostics: { apiId: "test", pages: 0, rows: 0, validValues: 0, invalidRows: 0, stopReason: "test", missingDates: [], calendarBasis: "fixture", stored: false, errorCode: null, environment: "real", mode, marketScope: "KRX" },
  };
  return result;
}
test("pending collector reads run every 15 seconds for two minutes then slow down", () => {
  for (const health of ["COLLECTION_QUEUED", "COLLECTING", "PARTIAL"] as const) {
    const data = response(health);
    assert.equal(flowRefreshInterval(data, 0), 15_000);
    assert.equal(flowRefreshInterval(data, 119_999), 15_000);
    assert.equal(flowRefreshInterval(data, 120_000), 60_000);
    assert.equal(flowRefreshInterval(data, Infinity), 60_000);
  }
});
test("direct or unknown mode never uses collector fast reads", () => {
  assert.equal(flowRefreshInterval(response("COLLECTION_QUEUED", "direct"), 0), 300_000);
  const mixed = response("COLLECTING");
  mixed.foreign.diagnostics = undefined;
  assert.equal(flowRefreshInterval(mixed, 0), 300_000);
  assert.equal(flowRefreshInterval(undefined, 0), 300_000);
});
test("blocking configuration and API errors do not enter a fast poll loop", () => {
  for (const health of ["DISABLED", "OWNER_AUTH_FAILED", "DATABASE_MISSING", "DATABASE_FAILED", "TOKEN_FAILED", "IP_MISMATCH", "API_FAILED", "PARSING_FAILED", "NO_HISTORY", "READY"] as const)
    assert.equal(flowRefreshInterval(response(health), 0), 300_000, health);
  assert.equal(flowRefreshInterval(response("TARGET_LIMIT_REACHED"), 0), 60_000);
});
test("a scheduled recoverable API failure can refresh, without speeding up blocked authentication or IP failures", () => {
  for (const health of ["API_FAILED", "PARSING_FAILED", "TOKEN_FAILED", "IP_MISMATCH", "DATABASE_SCHEMA_MISSING"] as const) {
    const data = response(health);
    for (const id of ["credit", "foreign", "investmentTrust"] as const) data[id].diagnostics!.collectionState = "COLLECTION_QUEUED";
    assert.equal(flowRefreshInterval(data, 0), health === "API_FAILED" || health === "PARSING_FAILED" ? 15_000 : 300_000, health);
  }
  const limited = response("API_FAILED");
  limited.credit.diagnostics!.collectionState = "TARGET_LIMIT_REACHED";
  assert.equal(flowRefreshInterval(limited, 0), 60_000);
});
test("Korean dates use KST independently of host timezone", () => {
  assert.equal(koreaMarketDay(Date.parse("2026-10-08T15:01:00Z")), "2026-10-09");
});
test("daily ranges retain fixed cumulative origin and real observed calendar", () => {
  const result = makeChartFlowRequest(identity, { priceDates: ["2026-10-08", "2026-10-07"], dailyPriceDates: ["2026-09-01", "2026-10-07", "2026-10-08", "2026-10-09"], trustStartDate: "2026-09-01", currentDay: "2026-10-08" });
  assert.equal(result.from, "2026-09-01");
  assert.equal(result.to, "2026-10-08");
  assert.deepEqual(result.expectedDailyDates, ["2026-09-01", "2026-10-07", "2026-10-08"]);
  assert.equal(result.flowScope, "KRX");
});
test("long real month history preserves its requested origin without moving the cumulative baseline", () => {
  const result = makeChartFlowRequest({ ...identity, interval: "month" }, { priceDates: ["1996-01-02", "2026-10-01"], dailyPriceDates: ["1996-01-02", "2026-10-08"], trustStartDate: "1995-12-01", currentDay: "2026-10-10" });
  assert.equal(result.from, "1995-12-01");
  assert.equal(result.to, "2026-10-08");
  assert.deepEqual(result.expectedDailyDates, ["1996-01-02", "2026-10-08"]);
});
test("aggregated ranges end at actual daily price observations, never future period ends", () => {
  for (const interval of ["week", "month", "year"] as const) {
    const result = makeChartFlowRequest({ ...identity, interval }, { priceDates: ["2026-10-05"], dailyPriceDates: ["2026-10-05", "2026-10-06", "2026-10-08", "2026-10-12"], trustStartDate: "2026-10-05", currentDay: "2026-10-10" });
    assert.equal(result.to, "2026-10-08", interval);
    assert.deepEqual(result.expectedDailyDates, ["2026-10-05", "2026-10-06", "2026-10-08"]);
  }
  assert.equal(makeChartFlowRequest({ ...identity, interval: "month" }, { priceDates: ["2026-10-01"], trustStartDate: "", currentDay: "2026-10-09" }).to, "2026-10-09");
});
test("NXT/SOR requests keep explicit market identity, while intraday does not invent a daily calendar", () => {
  for (const exchange of ["NXT", "SOR"] as const) {
    const result = makeChartFlowRequest({ ...identity, exchange, interval: "minute" }, { priceDates: ["2026-10-08T09:00:00", "2026-10-08T15:30:00"], trustStartDate: "", currentDay: "2026-10-08" });
    assert.equal(result.flowScope, exchange);
    assert.deepEqual(result.expectedDailyDates, []);
    assert.equal(result.to, "2026-10-08");
  }
  const empty = makeChartFlowRequest(identity, { priceDates: [], trustStartDate: "2026-10-01", currentDay: "2026-10-09" });
  assert.equal(empty.from, "");
  assert.equal(empty.to, "");
  const future = makeChartFlowRequest(identity, { priceDates: ["2026-10-12"], trustStartDate: "", currentDay: "2026-10-09" });
  assert.equal(future.from, "");
  assert.equal(future.to, "", "future-only prices cannot create an inverted provider request");
});
