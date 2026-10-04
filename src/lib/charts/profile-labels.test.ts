import assert from "node:assert/strict";
import { test } from "node:test";
import {
  layoutProfileLabels,
  profileQuantityLabel,
  type ProfileLabelRow,
} from "./profile-labels.ts";

const measure = (text: string) => text.length * 6;
const row = (patch: Partial<ProfileLabelRow> = {}): ProfileLabelRow => ({
  index: 0,
  y: 30,
  barWidth: 400,
  value: 14_693_301.4,
  percent: 12.6,
  ...patch,
});

test("profile quantities preserve the source unit, round only display and identify estimation", () => {
  assert.equal(profileQuantityLabel(14_693_301.4, "주"), "약 14,693,301주");
  assert.equal(profileQuantityLabel(14_693_301.6, "좌", false), "14,693,302좌");
  assert.equal(profileQuantityLabel(14_693_301.4, "USD"), "약 14,693,301 USD");
  assert.equal(profileQuantityLabel(14_693_301.4, "KRW", true, true), "약 1,469.3만 KRW");
  assert.equal(profileQuantityLabel(Number.NaN, "주"), "—");
  assert.equal(profileQuantityLabel(-1, "주"), "—");
});

test("ten visible HTS bins retain all labels with complete quantity and total share", () => {
  const rows = Array.from({ length: 10 }, (_, index) =>
    row({ index, y: 20 + index * 28, percent: 10 }),
  );
  const labels = layoutProfileLabels(rows, { width: 600, height: 300, measure, unit: "주" });
  assert.equal(labels.length, 10);
  for (const label of labels) {
    assert.equal(label.text, "약 14,693,301주 (10.0%)");
    assert.equal(label.align, "right");
    assert.equal(label.anchorX, 395);
    assert.equal(label.priceY, rows[label.index]!.y);
  }
});

test("short bars place the complete quantity outside the bar without changing price height", () => {
  const [label] = layoutProfileLabels([row({ barWidth: 18 })], {
    width: 390,
    height: 100,
    measure,
    unit: "좌",
  });
  assert.ok(label);
  assert.equal(label.align, "left");
  assert.equal(label.anchorX, 23);
  assert.equal(label.priceY, 30);
  assert.equal(label.text, "약 14,693,301좌 (12.6%)");
});

test("narrow multi-chart labels compact quantities but retain units and original percentage", () => {
  const [label] = layoutProfileLabels([row({ barWidth: 5, value: 14_693_301_123 })], {
    width: 140,
    height: 100,
    measure,
    unit: "주",
  });
  assert.ok(label);
  assert.equal(label.text, "약 146.9억주 (12.6%)");
  assert.equal(label.compact, true);
  assert.ok(label.x >= 2 && label.x + label.width <= 138);
});

test("overlapping dense labels use priority while preserving every chosen price coordinate", () => {
  const rows = [
    row({ index: 0, y: 30 }),
    row({ index: 1, y: 36, priority: 2 }),
    row({ index: 2, y: 42, priority: 3 }),
  ];
  const labels = layoutProfileLabels(rows, { width: 430, height: 100, measure, unit: "주" });
  assert.equal(labels.length, 1);
  assert.equal(labels[0]!.index, 2);
  assert.equal(labels[0]!.priceY, 42);
});

test("offscreen price bins are clipped without renormalizing remaining labels", () => {
  const rows = [
    row({ index: 0, y: -5, percent: 20 }),
    row({ index: 1, y: 30, percent: 30 }),
    row({ index: 2, y: 120, percent: 50 }),
  ];
  const labels = layoutProfileLabels(rows, { width: 600, height: 100, measure, unit: "주" });
  assert.equal(labels.length, 1);
  assert.equal(labels[0]!.index, 1);
  assert.match(labels[0]!.text, /\(30\.0%\)$/);
});

test("current-price reserved space is respected and never causes a vertical shift", () => {
  const labels = layoutProfileLabels([row({ barWidth: 390 })], {
    width: 500,
    height: 100,
    measure,
    unit: "주",
    reserved: [{ x: 300, y: 21, width: 200, height: 18 }],
  });
  assert.equal(labels.length, 1);
  assert.equal(labels[0]!.priceY, 30);
  assert.ok(labels[0]!.x + labels[0]!.width < 300);
});

test("unusable coordinates and physically too-small plots omit labels safely", () => {
  const options = { width: 600, height: 100, measure, unit: "주" as const };
  assert.deepEqual(
    layoutProfileLabels([row({ y: Number.NaN }), row({ barWidth: Infinity })], options),
    [],
  );
  assert.deepEqual(layoutProfileLabels([row()], { ...options, height: 10 }), []);
  assert.deepEqual(layoutProfileLabels([row()], { ...options, width: 60 }), []);
});

test("zero bins and malformed percentages do not masquerade as traded profile labels", () => {
  const options = { width: 600, height: 100, measure, unit: "주" as const };
  assert.deepEqual(layoutProfileLabels([
    row({ value: 0, barWidth: 0 }), row({ value: 0 }), row({ barWidth: 0 }),
    row({ percent: -1 }), row({ percent: 101 }),
  ], options), []);
  assert.deepEqual(layoutProfileLabels([row()], { ...options, measure: () => NaN }), []);
  assert.deepEqual(layoutProfileLabels([row()], { ...options, lineHeight: -1 }), []);
});

test("native price captions and provenance reserve their actual top and bottom areas", () => {
  const rows = [row({ index: 0, y: 20 }), row({ index: 1, y: 65 }), row({ index: 2, y: 105 })];
  const labels = layoutProfileLabels(rows, {
    width: 600, height: 130, measure, unit: "주", lineHeight: 16,
    reserved: [{ x: 0, y: 0, width: 600, height: 38 }, { x: 0, y: 92, width: 600, height: 38 }],
  });
  assert.deepEqual(labels.map((label) => label.index), [1]);
  assert.equal(labels[0]!.priceY, 65);
});
