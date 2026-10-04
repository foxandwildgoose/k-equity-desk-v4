import test from "node:test";
import assert from "node:assert/strict";
import { alignChartEvents, buildChartEvents, CHART_EVENT_LABELS, filterChartEvents, formatChartEventTime, groupScreenEvents, researchChartEvents, type ChartEventCategory, type ChartEventInput } from "./chart-events.ts";
import { barTimeOf } from "./bar-time.ts";

const categories = Object.keys(CHART_EVENT_LABELS) as ChartEventCategory[];
const enabled = Object.fromEntries(categories.map((category) => [category, true]));
const event = (category: ChartEventCategory, extra: Partial<ChartEventInput> = {}): ChartEventInput => ({ time: "2026-10-01", category, title: `${category} actual source title`, id: category, ...extra });

test("event detail times retain day precision and show Unix/ISO instants in the exchange zone", () => {
  assert.equal(formatChartEventTime("2026-10-01", "KR"), "2026-10-01");
  assert.equal(formatChartEventTime("2026-10-01", "US"), "2026-10-01");
  assert.equal(formatChartEventTime(barTimeOf("2026-10-01 09:00", "KR"), "KR"), "2026-10-01 09:00 KST");
  assert.equal(formatChartEventTime(barTimeOf("2026-10-01 09:30", "US"), "US"), "2026-10-01 09:30 ET");
  assert.equal(formatChartEventTime("2026-10-01T13:30:25Z", "US"), "2026-10-01 09:30:25 ET");
  assert.equal(formatChartEventTime("2026-10-01T13:30:25Z", "KR"), "2026-10-01 22:30:25 KST");
  assert.equal(formatChartEventTime("2026-12-01T14:30:00Z", "US"), "2026-12-01 09:30:00 ET", "US winter offset is resolved, not hardcoded");
  assert.equal(formatChartEventTime("2026-10-01 09:30", "US"), "2026-10-01 09:30 ET", "unoffset provider wall-clock uses the explicit exchange zone");
  assert.equal(formatChartEventTime(Number.NaN, "KR"), "시각 미상");
  assert.equal(formatChartEventTime("10.01 09:00", "KR"), "시각 미상", "never invent the year of a partial source date");
});

test("all annotation toggles off produce no event markers; categories are independent", () => {
  const events = buildChartEvents(categories.map((category) => event(category)), "research");
  assert.deepEqual(filterChartEvents(events, {}), []);
  assert.deepEqual(filterChartEvents(events, Object.fromEntries(categories.map((category) => [category, false]))), []);
  for (const category of categories) {
    assert.deepEqual(filterChartEvents(events, { [category]: true }).map((item) => item.category), [category]);
  }
  const legacy = buildChartEvents([{ time: "2026-10-01", text: "TP↑ and 히든 are source text, not a schema" }], "research");
  assert.equal(legacy[0]?.category, "research");
  assert.deepEqual(filterChartEvents(legacy, { targets: true, signals: true }), []);
});

test("source IDs deduplicate one category but keep report publication and TP change from the same document", () => {
  const report = { researchId: 77, date: "2026-10-01", title: "Actual long report title", broker: "Fetched Broker", pageUrl: "https://example.com/report/77", targetPrice: 120000, prevTargetPrice: 100000 };
  const events = researchChartEvents([report, report, { ...report, researchId: 78, targetPrice: 100000 }]);
  assert.equal(events.length, 3);
  assert.equal(events.filter((item) => item.category === "research").length, 2);
  assert.equal(events.filter((item) => item.category === "targets").length, 1);
  assert.equal(events.find((item) => item.category === "targets")?.subtype, "target-up");
  assert.equal(events[0]?.title, report.title);
  assert.equal(events[0]?.publishedAt, report.date);
  assert.equal(events[0]?.publicationPrecision, "day");
  assert.equal(events[0]?.url, report.pageUrl);
  assert.equal(events[0]?.text, "리포트");
  assert.equal(filterChartEvents(events, { research: true }).length, 2);
  assert.equal(filterChartEvents(events, { targets: true }).length, 1);
  const unknown = researchChartEvents([{ ...report, prevTargetPrice: undefined }]);
  assert.equal(unknown.length, 1);
  const unsafe = buildChartEvents([event("disclosures", { url: "javascript:alert(1)" }), event("disclosures", { id: "second", time: "not a date" })], "disclosures");
  assert.equal(unsafe.length, 1);
  assert.equal(unsafe[0]?.url, undefined);
});

test("same-candle dozens of events and screen neighbors compress without losing items or category/date counts", () => {
  const inputs = Array.from({ length: 60 }, (_, i) => event(i < 30 ? "disclosures" : "research", { id: String(i), time: i % 2 ? "2026-10-02" : "2026-10-01", position: "aboveBar", title: `Source item ${i} with a long title` }));
  const events = buildChartEvents(inputs, "disclosures");
  const coord = (time: string | number) => time === "2026-10-01" ? 10 : 24;
  const groups = groupScreenEvents(events, coord, { gapPx: 110, plotWidth: 500 });
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.items.length, 60);
  assert.deepEqual(groups[0]?.categoryCounts, { disclosures: 30, research: 30 });
  assert.equal(groups[0]?.text, "공시 30 · 리포트 30");
  assert.equal(groups[0]?.from, "2026-10-01");
  assert.equal(groups[0]?.to, "2026-10-02");
  assert.equal(groupScreenEvents([...events].reverse(), coord)[0]?.id, groups[0]?.id);
  assert.equal(groupScreenEvents([...events, ...events], coord)[0]?.items.length, 60);
  assert.equal(groupScreenEvents(filterChartEvents(events, {}), coord).length, 0);
  assert.equal(groupScreenEvents(filterChartEvents(events, enabled), coord)[0]?.items.length, 60);
  const sides = buildChartEvents([...inputs, event("signals", { id: "s", position: "belowBar" })], "disclosures");
  assert.equal(groupScreenEvents(sides, coord).length, 2);
  const mixed = buildChartEvents([event("disclosures"), event("news"), event("signals")], "disclosures");
  assert.equal(groupScreenEvents(mixed, coord)[0]?.text, "주석 3 · 3종");
  assert.deepEqual(groupScreenEvents(events, () => null), []);
  assert.deepEqual(groupScreenEvents(events, () => -1), []);
  assert.deepEqual(groupScreenEvents(events, () => 500, { plotWidth: 500 }), []);
});

test("calendar alignment preserves original days for day/week/month and uses actual minute candles only", () => {
  const events = buildChartEvents([event("disclosures", { time: "2026-09-29", id: "tuesday" }), event("research", { time: "2026-10-01", id: "thursday" })], "research");
  const weekly = alignChartEvents(events, { times: ["2026-09-28"], market: "KR", interval: "week" });
  assert.deepEqual(weekly.map((item) => item.time), ["2026-09-28", "2026-09-28"]);
  assert.deepEqual(new Set(weekly.map((item) => item.originalTime)), new Set(["2026-09-29", "2026-10-01"]));
  assert.equal(alignChartEvents(events, { times: ["2026-09-01"], market: "KR", interval: "month" }).length, 1);
  assert.equal(alignChartEvents(events, { times: ["2026-10-01"], market: "KR", interval: "day" }).length, 1);
  assert.equal(alignChartEvents(events, { times: ["2026-01-01"], market: "KR", interval: "year" }).length, 2);
  const times = [barTimeOf("2026-10-01 09:00", "KR"), barTimeOf("2026-10-01 09:05", "KR")];
  assert.equal(alignChartEvents(events, { times, market: "KR", interval: "minute" }).length, 0);
  const intraday = buildChartEvents([event("signals", { time: times[0]! }), event("news", { time: "2026-10-01T09:07:00+09:00" }), event("news", { id: "another-day", time: "2026-10-02T09:01:00+09:00" })], "signals");
  const aligned = alignChartEvents(intraday, { times, market: "KR", interval: "minute", intervalSeconds: 300 });
  assert.deepEqual(aligned.map((item) => item.time), times);
  assert.equal(aligned[1]?.originalTime, "2026-10-01T09:07:00+09:00");
  assert.equal(alignChartEvents(intraday, { times, market: "KR", interval: "minute" }).length, 1, "unknown interval duration requires exact candle timestamps");
  const unknownPrecision = buildChartEvents([event("news", { time: times[0]!, publishedAt: "2026-10-01T12:00:00Z", publicationPrecision: "day" })], "news");
  assert.equal(alignChartEvents(unknownPrecision, { times, market: "KR", interval: "minute", intervalSeconds: 300 }).length, 0, "date-only publication is not promoted to an intraday value");
  assert.equal(alignChartEvents([], { times: [], market: "US", interval: "day" }).length, 0);
});

test("replay excludes unknown/day-only publication and RSI signals until their actual confirmation candles", () => {
  const events = buildChartEvents([
    event("disclosures", { id: "known", publishedAt: "2026-10-01T09:30:00+09:00" }),
    event("disclosures", { id: "later", publishedAt: "2026-10-01T16:30:00+09:00" }),
    event("research", { id: "day-only", publishedAt: "2026-10-01" }),
    event("news", { id: "normalized-day", publishedAt: "2026-10-01T12:00:00Z", publicationPrecision: "day" }),
    event("news", { id: "unknown" }),
    event("signals", { id: "confirmed-later", confirmedAt: "2026-10-06" }),
    event("signals", { id: "confirmed", confirmedAt: "2026-10-01" }),
    event("signals", { id: "legacy" }),
  ], "disclosures");
  const morning = filterChartEvents(events, enabled, "2026-10-01T10:00:00+09:00");
  assert.deepEqual(morning.map((item) => item.id), ["disclosures:known"]);
  const daily = filterChartEvents(events, enabled, "2026-10-01");
  assert.deepEqual(daily.map((item) => item.id), ["disclosures:known", "disclosures:later", "signals:confirmed"]);
  assert.equal(filterChartEvents(events, enabled).length, 8);
  assert.deepEqual(filterChartEvents(events, enabled, "invalid"), []);
  const futureOccurrence = buildChartEvents([event("disclosures", { time: "2026-10-05", publishedAt: "2026-10-01T09:30:00+09:00" })], "disclosures");
  assert.deepEqual(filterChartEvents(futureOccurrence, enabled, "2026-10-01"), []);
});
