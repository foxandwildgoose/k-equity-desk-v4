import assert from "node:assert/strict";
import { test } from "node:test";
import { profileBarWidth, resolveProfileStyle } from "./profile-style.ts";

test("automatic profile colors and a single fill opacity follow the current theme", () => {
  const auto = { colorMode: "auto" as const, color: "#123456", opacity: 0.09 };
  assert.deepEqual(resolveProfileStyle(auto, "light"), {
    color: "#E6B77C", opacity: 0.32, labelColor: "#76552F",
  });
  assert.deepEqual(resolveProfileStyle(auto, "dark"), {
    color: "#D9A15A", opacity: 0.28, labelColor: "#E5D2B8",
  });
  assert.deepEqual(auto, { colorMode: "auto", color: "#123456", opacity: 0.09 });
});

test("custom fill color and opacity survive a theme change while text stays legible", () => {
  const custom = { colorMode: "custom" as const, color: "#aB23EF", opacity: 0.41 };
  for (const theme of ["light", "dark"] as const) {
    const resolved = resolveProfileStyle(custom, theme);
    assert.equal(resolved.color, custom.color);
    assert.equal(resolved.opacity, custom.opacity);
    assert.equal(resolved.labelColor, theme === "light" ? "#76552F" : "#E5D2B8");
  }
});

test("profile width uses the actual plot width and maximum bin, rather than total-volume percentage", () => {
  assert.equal(profileBarWidth(1000, 0.85, 100, 100), 850);
  assert.equal(profileBarWidth(1000, 0.85, 50, 100), 425);
  // An offscreen maximum remains in the denominator when price-axis zoom hides it.
  assert.equal(profileBarWidth(1000, 0.85, 40, 100), 340);
  assert.equal(profileBarWidth(390, 0.85, 100, 100), 331.5);
  assert.equal(profileBarWidth(1000, 0.1, 100, 100), 100);
});

test("zero, missing and malformed profile values never create visible bars", () => {
  const inputs: [number, number, number, number][] = [
    [1000, 0.85, 0, 100], [1000, 0.85, -1, 100], [1000, 0.85, NaN, 100],
    [1000, 0.85, 100, 0], [1000, 0.85, 100, Infinity], [0, 0.85, 100, 100],
    [NaN, 0.85, 100, 100], [1000, NaN, 100, 100], [1000, 1.1, 100, 100],
    [1000, 0.85, 101, 100],
  ];
  for (const values of inputs) assert.equal(profileBarWidth(...values), 0);
});
