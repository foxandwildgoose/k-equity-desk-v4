import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeExportDeskSnapshot } from "./demo-guard.ts";

test("retired browser API credentials are removed without losing real imported data", () => {
  const observations = [{ period: "2025-01", sourceFile: "official-customs.csv", valueUsd: 123 }];
  const clean = sanitizeExportDeskSnapshot({
    sourceKeys: { "customs.total": "retired-test-value" },
    setSourceKey: "retired-method",
    observations,
    fxImported: [{ date: "2025-01-31", close: 1400, sourceFile: "official-fx.csv" }],
  });
  assert.equal("sourceKeys" in clean, false);
  assert.equal("setSourceKey" in clean, false);
  assert.deepEqual(clean.observations, observations);
  assert.equal((clean.fxImported as unknown[]).length, 1);
  assert.equal(JSON.stringify(clean).includes("retired-test-value"), false);
});

test("FX imports follow the same no-synthetic-data rule as trade and index imports", () => {
  const clean = sanitizeExportDeskSnapshot({
    fxImported: [
      { date: "2025-01-31", close: 1400, sourceFile: "official-fx.csv" },
      { date: "2025-02-28", close: 9999, sourceFile: "mock-fx.csv" },
    ],
  });
  assert.equal((clean.fxImported as unknown[]).length, 1);
});
