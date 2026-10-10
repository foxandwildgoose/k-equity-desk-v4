import test from "node:test";
import assert from "node:assert/strict";
import { changedHtsPanelHeights, contiguousHtsLineRuns, htsFlowPointDetails, htsFlowSummaryPoint, htsPaneIndices, htsVolumeAverage, periodEndDay, prepareHtsIndicatorHistory, pricePanePoint, profileRangeBars } from "./hts-layout.ts";
import { defaultHtsSettings, parseHtsSettings } from "./hts-settings.ts";
import { rsiWithSignal } from "../chart-indicators.ts";
import { alignChartFlow, emptyChartFlow, type AlignedFlowMetric, type AlignedFlowPoint, type FlowMetric, type FlowObservation } from "./hts-flow.ts";

test("stock/ETF shared pane plan keeps price second and volume last with extras", () => {
  assert.deepEqual(htsPaneIndices(), { rsi: 0, price: 1, credit: 2, foreign: 3, investmentTrust: 4, volume: 5 });
  assert.equal(htsPaneIndices(3).volume, 8);
  assert.equal(htsPaneIndices(3).price, 1);
});
test("drawing hit testing rejects RSI, flow, time-axis and price-axis coordinates", () => {
  const bounds = { left: 0, top: 101, width: 600, height: 400 };
  assert.equal(pricePanePoint(50, 50, bounds), null);
  assert.equal(pricePanePoint(50, 501, bounds), null);
  assert.equal(pricePanePoint(600, 200, bounds), null);
  assert.deepEqual(pricePanePoint(50, 151, bounds), { x: 50, y: 50 });
});
test("fixed range and all range ignore viewport scrolling; replay always caps input", () => {
  const bars = ["2026-01-01", "2026-01-02", "2026-01-03"].map((date) => ({ date }));
  const fixed = { mode: "fixed" as const, fixedFrom: "2026-01-01", fixedTo: "2026-01-02" };
  assert.deepEqual(profileRangeBars(bars, { ...fixed, visibleFrom: "2026-01-03" }), bars.slice(0, 2));
  assert.deepEqual(profileRangeBars(bars, { mode: "all", visibleFrom: "2026-01-03", replayTo: "2026-01-02" }), bars.slice(0, 2));
  assert.deepEqual(profileRangeBars(bars, { mode: "visible", visibleFrom: "2026-01-02", visibleTo: "2026-01-02" }), [bars[1]]);
  assert.deepEqual(profileRangeBars(bars, { mode: "fixed", fixedFrom: "2026-01-03", fixedTo: "2026-01-01" }), []);
});
test("calendar period end is deterministic across months, leap years and weeks", () => {
  assert.equal(periodEndDay("2024-02-05", "month"), "2024-02-29");
  assert.equal(periodEndDay("2026-09-28", "week"), "2026-10-04");
  assert.equal(periodEndDay("2026-09-28", "year"), "2026-12-31");
  assert.equal(periodEndDay("2026-10-01 09:01:02", "minute"), "2026-10-01 09:01:02");
});

test("intraday visible and replay ranges preserve the exact minute boundary", () => {
  const bars = ["2026-10-01 09:00", "2026-10-01 09:01", "2026-10-01 09:02", "2026-10-01 15:30", "2026-10-02 09:00"].map((date) => ({ date }));
  assert.deepEqual(profileRangeBars(bars, { mode: "visible", visibleFrom: bars[1]!.date, visibleTo: bars[2]!.date }), bars.slice(1, 3));
  assert.deepEqual(profileRangeBars(bars, { mode: "all", replayTo: bars[1]!.date }), bars.slice(0, 2));
  assert.deepEqual(profileRangeBars(bars, { mode: "fixed", fixedFrom: "2026-10-01", fixedTo: "2026-10-01", replayTo: bars[2]!.date }), bars.slice(0, 3));
  assert.deepEqual(profileRangeBars(bars, { mode: "fixed", fixedFrom: "2026-10-01", fixedTo: "2026-10-01" }), bars.slice(0, 4), "date inputs include the entire requested day");
});

test("intraday ranges compare full seconds, milliseconds, timestamp separators and explicit offsets", () => {
  const bars = ["2026-10-01 09:00:00.001", "2026-10-01T09:00:00.002", "2026-10-01T09:00:00.003"].map((date) => ({ date }));
  assert.deepEqual(profileRangeBars(bars, { mode: "visible", visibleFrom: bars[1]!.date, visibleTo: bars[1]!.date }), [bars[1]]);
  assert.deepEqual(profileRangeBars(bars, { mode: "all", replayTo: bars[1]!.date }), bars.slice(0, 2));
  const zoned = ["2026-10-01T09:00:00+09:00", "2026-10-01T00:01:00Z", "2026-10-01T09:02:00+09:00"].map((date) => ({ date }));
  assert.deepEqual(profileRangeBars(zoned, { mode: "visible", visibleFrom: "2026-10-01T00:01:00Z", visibleTo: "2026-10-01T09:01:00+09:00" }), [zoned[1]]);
});

test("invalid range bounds and invalid bar dates never broaden a requested range", () => {
  const bars = ["2026-10-01", "2026-02-31", "not a date", "2026-10-01 25:00"].map((date) => ({ date }));
  assert.deepEqual(profileRangeBars(bars, { mode: "all" }), [bars[0]]);
  for (const bad of ["2026-02-31", "bad", "2026-10-01T09:90", "2026-10-01T09:00:60"]) {
    assert.deepEqual(profileRangeBars(bars, { mode: "visible", visibleFrom: bad }), []);
    assert.deepEqual(profileRangeBars(bars, { mode: "all", replayTo: bad }), []);
  }
  assert.deepEqual(profileRangeBars(bars, { mode: "fixed", fixedFrom: "2026-10-01 09:02", fixedTo: "2026-10-01 09:01" }), []);
  assert.deepEqual(profileRangeBars(bars, { mode: "fixed", fixedTo: "2026-10-01" }), []);
});

test("indicator history sorts, deduplicates, normalizes timestamps and caps intraday replay", () => {
  const history = [
    { date: "2026-10-01 09:03", close: 999 },
    { date: "2026-10-01 09:00", close: 100 },
    { date: "2026-10-01 09:01", close: 102 },
    { date: "2026-10-01 09:01", close: 101 },
    { date: "2026-10-01 09:02", close: 999 },
  ];
  const visible = [{ date: "2026-10-01T09:02", close: 102 }];
  const prepared = prepareHtsIndicatorHistory(visible, history);
  assert.deepEqual(prepared.history.map((bar) => bar.close), [100, 101, 102]);
  assert.deepEqual(prepared.visibleIndices, [2]);
  assert.equal(prepared.history[2], visible[0], "current/replay candle wins over history with its final future close");
  assert.deepEqual(prepareHtsIndicatorHistory([], history), { history: [], visibleIndices: [] });
  assert.deepEqual(prepareHtsIndicatorHistory([{ date: "bad", close: 1 }], history), { history: [], visibleIndices: [null] });
});

test("RSI retains loaded warmup across viewport changes and contains no future replay candle values", () => {
  const history = Array.from({ length: 90 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10),
    close: 100 + index / 2 + Math.sin(index) * 5,
  }));
  const calculate = (bars: typeof history) => {
    const prepared = prepareHtsIndicatorHistory(bars, history);
    const calculated = rsiWithSignal(prepared.history.map((bar) => bar.close));
    return {
      rsi: prepared.visibleIndices.map((i) => i == null ? null : calculated.rsi[i]),
      signal: prepared.visibleIndices.map((i) => i == null ? null : calculated.signal[i]),
    };
  };
  const left = calculate(history.slice(30, 70));
  const right = calculate(history.slice(50, 80));
  assert.deepEqual(left.rsi.slice(20), right.rsi.slice(0, 20));
  assert.deepEqual(left.signal.slice(20), right.signal.slice(0, 20));
  assert.ok(left.signal.every((value) => value != null), "warmup before the displayed interval is retained");
  const replay = [...history.slice(30, 59), { ...history[59]!, close: 80 }];
  const replayResult = calculate(replay);
  const independent = rsiWithSignal([...history.slice(0, 59).map((bar) => bar.close), 80]);
  assert.equal(replayResult.rsi.at(-1), independent.rsi.at(-1));
  assert.equal(replayResult.signal.at(-1), independent.signal.at(-1));
  assert.notEqual(replayResult.rsi.at(-1), rsiWithSignal(history.map((bar) => bar.close)).rsi[59]);
});

test("volume average distinguishes genuine zero from missing quantity and recovers after warmup", () => {
  const bars = [
    { volume: 10 }, { volume: 20 }, { volume: 0, volumeValid: true },
    { volume: 0, volumeValid: false }, { volume: 40 }, { volume: 50 }, { volume: 60 }, { volume: 70 },
  ];
  const values = htsVolumeAverage(bars, 3);
  [null, null, 10, null, null, null, 50, 60].forEach((value, index) => {
    if (value === null) assert.equal(values[index], null);
    else assert.ok(values[index] != null && Math.abs(values[index]! - value) < 1e-12);
  });
  for (const volume of [-1, NaN, Infinity]) {
    assert.deepEqual(htsVolumeAverage([{ volume: 10 }, { volume }, { volume: 30 }, { volume: 40 }], 2), [null, null, null, 35]);
  }
  assert.deepEqual(htsVolumeAverage(bars, 0), bars.map(() => null));
});

test("pane persistence stores stretch factors with no drift from viewport pixel resizing", () => {
  const settings = defaultHtsSettings("KR");
  const factors = settings.panelHeights;
  // A resized viewport changes pixel heights but preserves native stretch factors.
  assert.equal(changedHtsPanelHeights(factors, settings.collapsed, factors, { ...factors }), null);
  const after = { ...factors, rsi: 120.2, price: 379.8 };
  const changed = changedHtsPanelHeights(factors, settings.collapsed, factors, after);
  assert.ok(changed);
  assert.deepEqual(changed, { ...factors, rsi: 120, price: 380 });
  const persisted = parseHtsSettings(JSON.stringify({ ...settings, panelHeights: changed }));
  assert.deepEqual(persisted?.panelHeights, changed, "a save/reload preserves the same factors");
  for (let click = 0; click < 20; click++) {
    assert.equal(changedHtsPanelHeights(changed, settings.collapsed, changed, { ...changed }), null);
  }
});

test("pane persistence preserves remembered collapsed heights and bounds valid user drags", () => {
  const settings = defaultHtsSettings("KR");
  const collapsed = { ...settings.collapsed, credit: true };
  const before = { ...settings.panelHeights, credit: 34 };
  const after = { ...before, credit: 90, foreign: 80.6, price: 50, rsi: 2000, volume: NaN };
  const changed = changedHtsPanelHeights(settings.panelHeights, collapsed, before, after);
  assert.ok(changed);
  assert.equal(changed.credit, settings.panelHeights.credit);
  assert.equal(changed.foreign, 81);
  assert.equal(changed.price, 180);
  assert.equal(changed.rsi, 1200);
  assert.equal(changed.volume, settings.panelHeights.volume);
  assert.equal(changedHtsPanelHeights(settings.panelHeights, collapsed, {}, after), null, "missing gesture snapshot cannot overwrite settings");
});

test("partial flow captions keep queue/owner status alongside missing-date reasons", () => {
  const point: AlignedFlowPoint = { date: "2026-01-01", value: null, asOf: null, partial: true,
    reason: "기준일 이후 누락: 누적순매수 미확정", observations: [] };
  for (const reason of ["키움 수집 예약됨 · 고정 IP 수집기 대기", "키움 수집 예약됨 · 수집기 OFFLINE · 자동 실행 상태 확인 필요"]) {
    const metric: FlowMetric = { capability: "partial", health: "COLLECTION_QUEUED", reason, unit: "주", source: "키움증권",
      observations: [], providedFrom: null, providedTo: null };
    const aligned: AlignedFlowMetric = { capability: "partial", reason, points: [point] };
    const details = htsFlowPointDetails(metric, aligned, point, "", true);
    assert.ok(details.detailStatus.includes(reason));
    assert.ok(details.detailStatus.includes(point.reason));
    assert.equal(details.detailStatus.split(reason).length - 1, 1, "aligned/provider reason is not repeated");
    assert.match(details.status, /키움 수집 예약됨/);
    assert.match(details.status, /기준일 이후 누락/);
    assert.equal(details.asOf, "미확인");
    assert.equal(point.value, null);
  }
});

test("flow captions preserve actionable provider reasons and never borrow a future as-of", () => {
  const metric: FlowMetric = { capability: "not-configured", reason: "KIS 인증 미설정", unit: "%", source: "KIS", observations: [], providedFrom: null, providedTo: "2026-10-03" };
  const point: AlignedFlowPoint = { date: "2026-01-01", value: null, asOf: null, partial: false, reason: "해당 날짜 관측값 없음", observations: [] };
  const aligned: AlignedFlowMetric = { capability: "not-configured", reason: "KIS 인증 미설정", points: [point] };
  const details = htsFlowPointDetails(metric, aligned, point, "2026-10-03T01:00:00Z", true);
  assert.match(details.status, /설정 필요 · KIS 인증 미설정/);
  assert.equal(details.capability, "not-configured", "raw capability remains available for structured details/exports");
  assert.match(details.detailStatus, /오래된 데이터/);
  assert.match(details.detailStatus, /조회 2026-10-03T01:00:00Z/);
  assert.doesNotMatch(details.status, /조회|확보|확정 여부/);
  assert.equal(details.asOf, "미확인");
  assert.equal(details.dateBasis, "미확인");
  assert.equal(details.final, "확정 여부 미확인");
  const present: AlignedFlowPoint = { ...point, value: 10, asOf: "2026-01-01", reason: "", observations: [{
    date: "2026-01-01", asOf: "2026-01-01", value: 10, unit: "%", source: "KIS", sourceField: "ratio", dateBasis: "settlement-date",
    fetchedAt: "2026-01-02T01:00:00Z", availableAt: "2026-01-02T00:00:00Z", final: false, derived: false,
  }] };
  const available = htsFlowPointDetails({ ...metric, capability: "available", reason: "" }, { capability: "available", reason: "", points: [present] }, present, "2026-10-03T01:00:00Z", false);
  assert.equal(available.asOf, "2026-01-01");
  assert.equal(available.fetchedAt, "2026-01-02T01:00:00Z");
  assert.equal(available.dateBasis, "결제일");
  assert.equal(available.final, "잠정");
});

test("short pane captions retain the actionable cause while complete metadata remains in details", () => {
  const reason = "DB 연결 실패 · 운영자 확인 필요 · 공급자 기준일/공표시각/확정 여부 미확인";
  const metric: FlowMetric = { capability: "error", health: "DATABASE_FAILED", reason, unit: "%", source: "키움증권", observations: [], providedFrom: null, providedTo: null };
  const aligned: AlignedFlowMetric = { capability: "error", reason, points: [] };
  const details = htsFlowPointDetails(metric, aligned, undefined, "2026-10-10T00:00:00Z", true);
  assert.match(details.status, /키움 DB 연결\/조회 실패 · DB 연결 실패/);
  assert.ok(details.status.length < 110);
  assert.doesNotMatch(details.status, /공표시각|T00:00|오래된 데이터/);
  assert.ok(details.detailStatus.includes(reason));
  assert.match(details.detailStatus, /조회 2026-10-10T00:00:00Z/);
});

test("queued collection never replaces the last provider failure in pane captions", () => {
  const reason = "안전한 API 조회 실패 · 재수집 대기";
  const metric: FlowMetric = { capability: "error", health: "API_FAILED", reason, unit: "%", source: "키움증권", observations: [], providedFrom: null, providedTo: null,
    diagnostics: { apiId: "ka10008", pages: 0, rows: 0, validValues: 0, invalidRows: 0, stopReason: "api-failed", missingDates: null, calendarBasis: "미확인", stored: false, errorCode: null, environment: "real", mode: "collector", marketScope: "KRX", collectionState: "COLLECTION_QUEUED" } };
  const details = htsFlowPointDetails(metric, { capability: "error", reason, points: [] }, undefined, "", true);
  assert.match(details.status, /^키움 API 조회 실패/);
  assert.match(details.status, /키움 수집 예약됨/);
  assert.match(details.detailStatus, /키움 API 조회 실패 · 키움 수집 예약됨/);
  assert.ok(details.detailStatus.includes(reason));
});

function summaryFixture(values: Array<[string, number]>) {
  const request = { code: "018260", market: "KR", instrument: "stock", exchange: "KRX", currency: "KRW", quantityUnit: "주", from: "2026-09-01", to: "2026-09-07", interval: "day" } as const;
  const response = emptyChartFlow(request);
  const observations: FlowObservation[] = values.map(([date, value]) => ({ date, value, unit: "주", source: "isolated test fixture", sourceField: "invtrt", asOf: date, dateBasis: "trade-date", fetchedAt: "2026-09-08T00:00:00Z", availableAt: null, final: null, derived: false, provider: "kiwoom", environment: "real" }));
  response.investmentTrust = { ...response.investmentTrust, capability: "partial", health: "PARTIAL", observations };
  return response;
}

test("fixed cumulative latest caption remains unconfirmed after a middle gap instead of reusing an earlier total", () => {
  const response = summaryFixture([["2026-09-01", 1_100_000], ["2026-09-02", -50_000], ["2026-09-04", 120_000]]);
  const dates = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"];
  const aligned = alignChartFlow(response, { dates, expectedDailyDates: dates, interval: "day", cumulativeStart: dates[0]!, investmentTrustMode: "cumulative" }).investmentTrust;
  assert.deepEqual(aligned.points.map(point => point.value), [1_100_000, 1_050_000, null, null]);
  const latest = htsFlowSummaryPoint(response.investmentTrust, aligned, dates.at(-1)!, false, false);
  assert.equal(latest, aligned.points.at(-1));
  assert.equal(latest?.value, null);
  assert.match(latest?.reason ?? "", /누적순매수 미확정/);
  assert.equal(htsFlowSummaryPoint(response.investmentTrust, aligned, "2026-09-07", false, false), undefined, "an absent latest date cannot borrow a past cumulative total either");
});

test("available cumulative latest caption remains null when the latest continuous segment ends before the price date", () => {
  const response = summaryFixture([["2026-09-01", 1_100_000], ["2026-09-02", -50_000], ["2026-09-04", 0]]);
  const dates = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-07"];
  const aligned = alignChartFlow(response, { dates, expectedDailyDates: dates, interval: "day", cumulativeStart: dates[0]!, investmentTrustMode: "available-cumulative" }).investmentTrust;
  assert.equal(aligned.points.at(-2)?.value, 0, "genuine zero on the available segment remains valid");
  const latest = htsFlowSummaryPoint(response.investmentTrust, aligned, dates.at(-1)!, false, false);
  assert.equal(latest, aligned.points.at(-1));
  assert.equal(latest?.value, null);
  assert.match(latest?.reason ?? "", /누적순매수 미확정/);
});

test("daily summaries retain a clearly dated real observation but never bypass hover, replay, or mock restrictions", () => {
  const response = summaryFixture([["2026-09-01", 120_000], ["2026-09-02", -85_000]]);
  const dates = ["2026-09-01", "2026-09-02", "2026-09-03"];
  const aligned = alignChartFlow(response, { dates, expectedDailyDates: dates, interval: "day", cumulativeStart: dates[0]!, investmentTrustMode: "daily" }).investmentTrust;
  const previous = htsFlowSummaryPoint(response.investmentTrust, aligned, dates.at(-1)!, false, true);
  assert.equal(previous?.date, "2026-09-02");
  assert.equal(previous?.value, -85_000);
  assert.match(previous?.reason ?? "", /최신 가격일 2026-09-03.*최근 실제 관측값/);
  assert.equal(htsFlowSummaryPoint(response.investmentTrust, aligned, dates.at(-1)!, true, true)?.value, null);
  const replay = alignChartFlow(response, { dates, expectedDailyDates: dates, interval: "day", cumulativeStart: dates[0]!, investmentTrustMode: "daily", replayAt: "2026-09-03T06:30:00Z" }).investmentTrust;
  assert.equal(replay.capability, "unknown");
  assert.equal(htsFlowSummaryPoint(response.investmentTrust, replay, dates.at(-1)!, false, true)?.value, null);
  const mock = { ...response.investmentTrust, observations: response.investmentTrust.observations.map(row => ({ ...row, environment: "mock" as const })) };
  const mockAligned = alignChartFlow({ ...response, investmentTrust: mock }, { dates, expectedDailyDates: dates, interval: "day", cumulativeStart: dates[0]!, investmentTrustMode: "daily" }).investmentTrust;
  assert.equal(htsFlowSummaryPoint(mock, mockAligned, dates.at(-1)!, false, true)?.value, null);
});

test("native line segments split missing observations without turning genuine zero or negative quantities into gaps", () => {
  assert.deepEqual(contiguousHtsLineRuns([null, 10, 20, null, 30, 40, null]), [{ from: 1, to: 2 }, { from: 4, to: 5 }]);
  assert.deepEqual(contiguousHtsLineRuns([0, -40, 60]), [{ from: 0, to: 2 }]);
  assert.deepEqual(contiguousHtsLineRuns([10, NaN, 20, Infinity, 30, undefined, 40]), [
    { from: 0, to: 0 }, { from: 2, to: 2 }, { from: 4, to: 4 }, { from: 6, to: 6 },
  ]);
  assert.deepEqual(contiguousHtsLineRuns([null, undefined, NaN]), []);
  assert.deepEqual(contiguousHtsLineRuns([]), []);
});

test("RSI and volume moving-average rewarmup becomes separate native line runs", () => {
  const rsi = rsiWithSignal([10, 11, 12, 13, NaN, 15, 16, 17, 18], 2, 1);
  assert.deepEqual(contiguousHtsLineRuns(rsi.rsi), [{ from: 2, to: 3 }, { from: 7, to: 8 }]);
  assert.deepEqual(contiguousHtsLineRuns(rsi.signal), [{ from: 2, to: 3 }, { from: 7, to: 8 }]);
  const volume = htsVolumeAverage([10, 20, 30, NaN, 40, 50, 60].map((value) => ({ volume: value })), 2);
  assert.deepEqual(contiguousHtsLineRuns(volume), [{ from: 1, to: 2 }, { from: 5, to: 6 }]);
});
