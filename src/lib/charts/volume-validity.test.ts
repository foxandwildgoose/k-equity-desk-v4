import assert from "node:assert/strict";
import { test } from "node:test";
import { chartVolume } from "./volume-validity.ts";

test("provider volume zero remains valid and missing values retain an invalid marker", () => {
  for (const value of [0, "0", "0.0"])
    assert.deepEqual(chartVolume(value), { volume: 0, volumeValid: true });
  for (const value of [
    null,
    undefined,
    "",
    " ",
    "null",
    "—",
    "NaN",
    Infinity,
    -1,
    NaN,
    {},
    false,
  ]) {
    assert.deepEqual(chartVolume(value), { volume: 0, volumeValid: false });
  }
});

test("provider share counts preserve raw units and serializable validity", () => {
  assert.deepEqual(chartVolume("1,234,567"), { volume: 1234567, volumeValid: true });
  assert.deepEqual(JSON.parse(JSON.stringify(chartVolume(null))), {
    volume: 0,
    volumeValid: false,
  });
});
