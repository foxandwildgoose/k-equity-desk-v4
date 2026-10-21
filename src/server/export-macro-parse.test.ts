import assert from "node:assert/strict";
import { test } from "node:test";
import {
  completedMonthlyPoints,
  koreaMonth,
  parseNaverMonthly,
  parseNaverSpotUsdKrw,
  parseYahooMonthly,
  previousCompletedMonth,
} from "./export-macro-parse.ts";

const NOW = new Date("2026-10-21T02:00:00Z");

function naverXml(symbol: string, rows: string[]): string {
  return `<?xml version="1.0" encoding="euc-kr"?><protocol><chartdata symbol="${symbol}" name="test">${rows.map((row) => `<item data="${row}" />`).join("")}</chartdata></protocol>`;
}

function yahooPayload(
  symbol: string,
  rows: { date: string; close: number | null }[],
  timeZone = "Asia/Seoul",
) {
  return {
    chart: {
      result: [
        {
          meta: { symbol, currency: "KRW", exchangeTimezoneName: timeZone },
          timestamp: rows.map((row) => new Date(row.date).getTime() / 1_000),
          indicators: { quote: [{ close: rows.map((row) => row.close) }] },
        },
      ],
      error: null,
    },
  };
}

test("Korean month cutoff handles UTC month boundaries and previous year", () => {
  const koreanOctober = new Date("2026-09-30T15:01:00Z");
  assert.equal(koreaMonth(koreanOctober), "2026-10");
  assert.equal(previousCompletedMonth(koreanOctober), "2026-09");
  assert.equal(previousCompletedMonth(new Date("2026-01-01T00:00:00Z")), "2025-12");
});

test("monthly history excludes unfinished and future months without inventing month-end dates", () => {
  const rows = completedMonthlyPoints(
    [
      { date: "2026-10-01", value: 2700 },
      { date: "2026-08-03", value: 2400 },
      { date: "2026-09-01", value: 2500 },
      { date: "2026-11-01", value: 2800 },
    ],
    NOW,
  );
  assert.deepEqual(rows, [
    { date: "2026-08-03", value: 2400 },
    { date: "2026-09-01", value: 2500 },
  ]);
});

test("invalid dates, missing/nonpositive values and conflicting revisions are quarantined", () => {
  assert.deepEqual(
    completedMonthlyPoints(
      [
        { date: "2026-02-30", value: 1 },
        { date: "2026-03-01", value: Number.NaN },
        { date: "2026-04-01", value: 0 },
        { date: "2026-05-01", value: -1 },
        { date: "2026-06-01", value: 2500 },
        { date: "2026-06-01", value: 2550 },
        { date: "2026-06-30", value: 2560 },
        { date: "2026-08-03", value: 2600 },
        { date: "2026-08-03", value: 2600 },
        { date: "2026-08-31", value: 2650 },
      ],
      NOW,
    ),
    [{ date: "2026-08-31", value: 2650 }],
  );
});

test("Naver XML verifies instrument and keeps the provider's completed-month labels", () => {
  const xml = naverXml("KOSPI", [
    "20261001|1|2|1|2800|100",
    "20260901|1|2|1|2600.25|100",
    "20260803|1|2|1|2500.50|100",
    "20260230|1|2|1|9000|100",
    "20260701|1|2|1||100",
  ]);
  assert.deepEqual(parseNaverMonthly(xml, "KOSPI", NOW), [
    { date: "2026-08-03", value: 2500.5 },
    { date: "2026-09-01", value: 2600.25 },
  ]);
  assert.deepEqual(parseNaverMonthly(xml, "KOSDAQ", NOW), []);
  assert.deepEqual(parseNaverMonthly("<html><p>temporarily blocked</p></html>", "KOSPI", NOW), []);
  assert.deepEqual(parseNaverMonthly(xml.slice(0, -10), "KOSPI", NOW), []);
  assert.deepEqual(parseNaverMonthly(`<!DOCTYPE x [<!ENTITY a "123">]>${xml}`, "KOSPI", NOW), []);
});

test("Yahoo uses exchange timezone, validates symbol and rejects current partial month", () => {
  const payload = yahooPayload("^KS11", [
    { date: "2026-08-31T15:00:00Z", close: 2600 },
    { date: "2026-09-30T15:00:00Z", close: 2800 },
    { date: "2026-07-31T15:00:00Z", close: null },
  ]);
  assert.deepEqual(parseYahooMonthly(payload, "^KS11", NOW), [{ date: "2026-09-01", value: 2600 }]);
  assert.deepEqual(parseYahooMonthly(payload, "USDKRW=X", NOW), []);
  payload.chart.result[0]!.meta.currency = "USD";
  assert.deepEqual(parseYahooMonthly(payload, "^KS11", NOW), []);
});

test("FX monthly label follows Yahoo's exchange timezone rather than UTC or server timezone", () => {
  const payload = yahooPayload(
    "USDKRW=X",
    [
      { date: "2026-08-31T23:00:00Z", close: 1350 },
      { date: "2026-09-30T23:00:00Z", close: 1360 },
    ],
    "Europe/London",
  );
  assert.deepEqual(parseYahooMonthly(payload, "USDKRW=X", NOW), [
    { date: "2026-09-01", value: 1350 },
  ]);
  payload.chart.result[0]!.meta.exchangeTimezoneName = "unverified/timezone";
  assert.deepEqual(parseYahooMonthly(payload, "USDKRW=X", NOW), []);
});

test("provider errors, missing instrument metadata and malformed prices never become observations", () => {
  assert.deepEqual(
    parseYahooMonthly({ chart: { error: { code: "Too Many Requests" } } }, "USDKRW=X", NOW),
    [],
  );
  assert.deepEqual(
    parseYahooMonthly(
      {
        chart: {
          result: [{ timestamp: [1_725_142_800], indicators: { quote: [{ close: [1350] }] } }],
        },
      },
      "USDKRW=X",
      NOW,
    ),
    [],
  );
  const payload = yahooPayload("USDKRW=X", [
    { date: "2026-06-01T00:00:00Z", close: null },
    { date: "2026-07-01T00:00:00Z", close: 0 },
    { date: "2026-08-01T00:00:00Z", close: Number.POSITIVE_INFINITY },
    { date: "2026-09-01T00:00:00Z", close: 1350 },
  ]);
  assert.deepEqual(parseYahooMonthly(payload, "USDKRW=X", NOW), [
    { date: "2026-09-01", value: 1350 },
  ]);
});

test("spot FX parsing is separate; missing historical periods stay missing", () => {
  assert.equal(parseNaverSpotUsdKrw({ exchangeInfo: { closePrice: "1,357.80" } }), 1357.8);
  for (const closePrice of [null, "", "unavailable", "13,57.8", 0, 1, Number.NaN]) {
    assert.equal(parseNaverSpotUsdKrw({ exchangeInfo: { closePrice } }), 0);
  }
  const sparseHistory = completedMonthlyPoints(
    [
      { date: "2026-06-01", value: 1340 },
      { date: "2026-09-01", value: 1360 },
    ],
    NOW,
  );
  assert.equal(sparseHistory.length, 2);
  assert.deepEqual(
    sparseHistory.map((point) => point.date.slice(0, 7)),
    ["2026-06", "2026-09"],
  );
});
