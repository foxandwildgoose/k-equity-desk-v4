import assert from "node:assert/strict";
import { test } from "node:test";
import { withEtfDeadline } from "./etf-request.ts";

test("an unresponsive upstream cannot delay a dated issuer fallback indefinitely", async () => {
  const published = { asOf: "2026-10-08", weight: 3.89 };
  let signal: AbortSignal | undefined;
  const start = Date.now();
  const result = await withEtfDeadline((requestSignal) => {
    signal = requestSignal;
    return new Promise<typeof published>(() => {});
  }, published, 20);
  assert.equal(result, published);
  assert.ok(signal?.aborted);
  assert.ok(Date.now() - start < 500);
});

test("successful upstream data and failure fallback preserve their original values", async () => {
  assert.equal(await withEtfDeadline(async () => 24.51, 0, 20), 24.51);
  assert.equal(await withEtfDeadline(async () => { throw new Error("offline"); }, 3.89, 20), 3.89);
});
