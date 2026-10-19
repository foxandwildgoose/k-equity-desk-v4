import assert from "node:assert/strict";
import { test } from "node:test";
import { holdingsDisclosureStatus, koreaDisclosureDay } from "./etf-holdings-status.ts";

const NOW = new Date("2026-10-18T15:17:00Z"); // Oct 19 in Korea, before the next session.
const current = { asOf: "2026-10-16", sourceKind: "issuer-pdf", officialCount: 503, rowCount: 504 };
test("Korea's disclosure day changes at midnight Korea time, not UTC", () => {
  assert.equal(koreaDisclosureDay(NOW), "2026-10-19");
  assert.equal(koreaDisclosureDay(new Date("2026-10-18T14:59:59Z")), "2026-10-18");
});
test("a recent Friday disclosure remains dated and usable on Monday without calling it real time", () => {
  const status = holdingsDisclosureStatus(current, NOW);
  assert.equal(status.status, "current");
  assert.match(status.reason, /2026-10-16/);
  assert.match(status.reason, /503|1개 현금/);
  assert.match(status.reason, /합계는 공표 비중이 있는 항목만/);
});
test("old official PDFs and uploaded documents both carry historical warnings", () => {
  for (const input of [{ ...current, asOf: "2026-10-08" }, { ...current, sourceKind: "issuer-file" }]) {
    const status = holdingsDisclosureStatus(input, NOW);
    assert.equal(status.status, "historical");
    assert.match(status.reason, /최신 공시를 확보하지 못/);
  }
});
test("a functioning product link never turns missing or reference-only percentages into official data", () => {
  assert.equal(holdingsDisclosureStatus({ ...current, officialCount: 0, sourceKind: "wisereport-cu" }, NOW).status, "unavailable");
  assert.equal(holdingsDisclosureStatus({ ...current, asOf: null }, NOW).status, "unavailable");
});
test("an advance issuer disclosure is identified as advance publication rather than today's live basket", () => {
  assert.match(holdingsDisclosureStatus({ ...current, asOf: "2026-10-20" }, NOW).reason, /미리 게시한 다음 기준일/);
});
