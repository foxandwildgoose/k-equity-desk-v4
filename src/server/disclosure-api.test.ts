import assert from "node:assert/strict";
import { test } from "node:test";
import { disclosureResponse } from "./disclosure-api.ts";

test("invalid API parameters never invoke upstream", async () => {
  for (const query of [
    "",
    "code=005930&begin=2026-02-30&end=2026-03-01",
    "code=005930&begin=2026-10-17&end=2026-10-20&pageSize=101",
    "code=005930&code=006400&begin=2026-10-17&end=2026-10-20",
    "code=005930&begin=2026-10-20&end=2026-10-17",
  ]) {
    const response = await disclosureResponse(
      new Request(`https://example.test/api/disclosures?${query}`),
      async () => {
        throw Error("unexpected upstream");
      },
    );
    assert.equal(response.status, 400);
  }
});

test("API returns official empty, errors and retry policy distinctly", async () => {
  for (const state of ["empty", "invalid-key", "rate-limited", "unavailable"] as const) {
    const response = await disclosureResponse(
      new Request(
        "https://example.test/api/disclosures?code=005930&begin=2026-10-17&end=2026-10-20",
      ),
      async (options) => {
        assert.equal(options?.range?.begin, "20261017");
        assert.equal(options?.range?.pageSize, 100);
        return {
          items: [],
          status: {
            state,
            configured: true,
            message: "fixture",
            checkedAt: "2026-10-20T00:30:00Z",
            fallbackUsed: false,
          },
          ...(state === "empty"
            ? {
                pagination: {
                  page: 1,
                  pageSize: 100,
                  totalCount: 0,
                  totalPages: 0,
                  nextPage: null,
                  complete: true,
                },
              }
            : {}),
        };
      },
    );
    assert.equal(response.status, state === "empty" ? 200 : state === "rate-limited" ? 429 : 503);
    const body = await response.json();
    assert.equal(body.complete, state === "empty");
    assert.equal(body.status.fallbackUsed, false);
    if (state === "rate-limited") assert.equal(response.headers.get("retry-after"), "60");
  }
});
