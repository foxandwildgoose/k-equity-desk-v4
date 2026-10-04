#!/usr/bin/env node
/** Actual ETF geometry QA. No response fixtures or TLS-verification bypasses. */
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.QA_BASE ?? "http://127.0.0.1:8080";
const output = "artifacts/chart-upgrade/geometry-verdict.json";
const shots = "/workspace/screenshots/chart-upgrade/geometry";
mkdirSync("artifacts/chart-upgrade", { recursive: true });
mkdirSync(shots, { recursive: true });
const result = { mode: "real", code: "069500", base, at: new Date().toISOString(), checks: [], errors: [], externalFailures: [], navigations: [], screenshots: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) {
    result.navigations.push({ at: new Date().toISOString(), url: frame.url() });
    console.log(`NAV ${frame.url()}`);
  }
});
page.on("pageerror", (error) => result.errors.push(error.message));
page.on("requestfailed", (request) => {
  const url = new URL(request.url());
  if (url.origin !== new URL(base).origin) result.externalFailures.push({ origin: url.origin, error: request.failure()?.errorText });
});
const save = () => writeFileSync(output, JSON.stringify(result, null, 2));
const run = async (name, task) => {
  try {
    const detail = await task();
    result.checks.push({ name, status: "passed", detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    result.checks.push({ name, status: "failed", error: String(error) });
    await page.screenshot({ path: `${shots}/${name}-failed.png`, fullPage: false }).catch(() => undefined);
    console.log(`FAIL ${name}: ${String(error)}`);
    await page.keyboard.press("Escape");
  }
  // Store progress outside the watched checkout; report artifacts are written
  // only after the browser closes, so QA cannot trigger application reloads.
  writeFileSync(`${shots}/progress.json`, JSON.stringify(result, null, 2));
};
const paneHeights = () => page.locator("[data-hts-pane]").evaluateAll((nodes) => Object.fromEntries(nodes.map((el) => [el.dataset.htsPane, el.getBoundingClientRect().height])));
const settings = () => page.evaluate(() => {
  const entry = Object.entries(localStorage).find(([key]) => key.startsWith("ked:hts:") && key.includes(":069500:day:detail"));
  return entry ? { key: entry[0], ...JSON.parse(entry[1]) } : null;
});
const profileRows = () => page.getByTestId("profile-details").locator("tbody tr").evaluateAll((rows) => rows.map((row) => ({
  range: row.querySelector("th")?.textContent,
  quantity: row.querySelector("td:nth-child(2)")?.getAttribute("title"),
  percentage: row.querySelector("td:nth-child(3)")?.getAttribute("title"),
})));
const plotRect = async (pane = "price") => {
  const element = page.locator(`[data-hts-pane="${pane}"]`);
  await element.scrollIntoViewIfNeeded();
  return element.locator("canvas").first().boundingBox();
};
const priceSnapshot = () => page.locator('[data-hts-pane="price"] canvas').first().evaluate((canvas) => canvas.toDataURL());

try {
  await page.goto(`${base}/etfs/069500`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  await page.locator('[data-hts-pane="volume"]').waitFor({ state: "attached", timeout: 40000 });
  await page.getByTestId("profile-details").locator("tbody tr").first().waitFor({ state: "attached", timeout: 40000 });
  await page.waitForFunction(() => document.querySelector("h1")?.textContent?.includes("KODEX"));
  await run("keyboard-settings-and-fixed-range", async () => {
    const trigger = page.getByTestId("open-hts-settings").filter({ visible: true });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const panel = page.getByTestId("hts-settings");
    await panel.waitFor();
    assert(await panel.getByLabel("가격 구간 수", { exact: true }).isVisible());
    await panel.getByLabel(/^매물대 집계 범위/).selectOption("fixed");
    await panel.getByLabel("매물대 시작일", { exact: true }).fill("2026-01-08");
    await panel.getByLabel("매물대 종료일", { exact: true }).fill("2026-10-02");
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "hidden" });
    await page.waitForTimeout(250);
    assert(await trigger.evaluate((el) => document.activeElement === el), "dialog did not return keyboard focus");
    await page.waitForTimeout(500);
    const saved = await settings();
    assert.equal(saved.profile.rangeMode, "fixed");
    assert.equal((await profileRows()).length, 10);
    return { focusReturned: true, rangeMode: saved.profile.rangeMode, from: saved.profile.startDate, to: saved.profile.endDate };
  });

  await run("native-separator-persists-after-reload", async () => {
    await plotRect("rsi");
    const before = await paneHeights();
    const storedBefore = await settings();
    const separator = page.locator('[style*="row-resize"]').filter({ visible: true }).first();
    await separator.scrollIntoViewIfNeeded();
    const rect = await separator.boundingBox();
    assert(rect && rect.width > 100, "native separator not found");
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 35, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(350);
    const after = await paneHeights();
    const storedAfter = await settings();
    assert(Math.abs(after.rsi - before.rsi) > 20, `native separator did not resize: ${before.rsi} -> ${after.rsi}`);
    assert.notDeepEqual(storedAfter.panelHeights, storedBefore.panelHeights, "drag did not persist native pane sizes");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    await page.locator('[data-hts-pane="volume"]').waitFor({ state: "attached", timeout: 40000 });
    await page.getByTestId("profile-details").locator("tbody tr").first().waitFor({ state: "attached", timeout: 40000 });
    await page.waitForTimeout(250);
    const restored = await paneHeights();
    assert.deepEqual((await settings()).panelHeights, storedAfter.panelHeights);
    assert(Math.abs(restored.rsi - after.rsi) <= 3, "RSI size changed after reload");
    assert(Math.abs(restored.price - after.price) <= 3, "price size changed after reload");
    return { before, after, restored, stored: storedAfter.panelHeights };
  });

  await run("fixed-profile-is-invariant-under-time-pan", async () => {
    const initial = await profileRows();
    assert.equal(initial.length, 10, "fixed profile must be loaded before interaction");
    const rect = await plotRect();
    assert(rect);
    const before = await priceSnapshot();
    const y = rect.y + rect.height * 0.7;
    await page.mouse.move(rect.x + rect.width * 0.6, y);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * 0.83, y, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(10, 100);
    await page.waitForTimeout(400);
    assert.notEqual(await priceSnapshot(), before, "time pan did not change plotted price geometry");
    assert.deepEqual(await profileRows(), initial, "fixed-range bin quantities or denominator changed on time pan");
    return { bins: initial.length, exactQuantityAndPercentTitlesUnchanged: true };
  });

  await run("fixed-profile-is-invariant-under-price-axis-zoom", async () => {
    const initial = await profileRows();
    assert.equal(initial.length, 10, "fixed profile must be loaded before interaction");
    const pane = page.locator('[data-hts-pane="price"]');
    await pane.scrollIntoViewIfNeeded();
    const axes = await pane.locator("canvas").evaluateAll((canvases) => canvases.map((canvas) => {
      const r = canvas.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }));
    const axis = axes.find((r) => r.width > 10 && r.width < 150 && r.height > 100);
    assert(axis, "price axis canvas not found");
    const before = await priceSnapshot();
    await page.mouse.move(axis.x + axis.width / 2, axis.y + axis.height / 2);
    await page.mouse.down();
    await page.mouse.move(axis.x + axis.width / 2, axis.y + axis.height / 2 + 65, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(10, 100);
    await page.waitForTimeout(300);
    assert.notEqual(await priceSnapshot(), before, "price-axis drag did not zoom the native scale");
    assert.deepEqual(await profileRows(), initial, "price-axis zoom changed fixed-range rows or percentages");
    await page.screenshot({ path: `${shots}/etf-fixed-profile-price-zoom.png`, fullPage: false });
    return { bins: initial.length, exactQuantityAndPercentTitlesUnchanged: true, axis };
  });

  await run("crosshair-date-aligns-accessible-pane-values", async () => {
    const captures = [];
    for (const fraction of [0.48, 0.76]) {
      const rect = await plotRect();
      await page.mouse.move(rect.x + rect.width * fraction, rect.y + rect.height * 0.4);
      await page.waitForTimeout(150);
      const state = await page.evaluate(() => ({
        ohlc: document.querySelector('[data-testid="chart-ohlc"]')?.textContent,
        rows: [...document.querySelectorAll('[data-testid="hts-data-details"] tbody tr')].map((row) => [...row.querySelectorAll("th,td")].map((cell) => cell.textContent?.trim())),
      }));
      const date = state.ohlc?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      assert(date, "crosshair did not expose the hovered trading date");
      assert.equal(state.rows.length, 6);
      for (const index of [0, 1, 5]) assert.equal(state.rows[index][3], date, `${state.rows[index][0]} date differs from hovered OHLC date`);
      captures.push({ hoveredDate: date, rows: state.rows });
    }
    assert.notEqual(captures[0].hoveredDate, captures[1].hoveredDate, "crosshair did not move across trading dates");
    await page.screenshot({ path: `${shots}/etf-shared-crosshair.png`, fullPage: false });
    return { captures, note: "RSI, price and volume match the hover date; flow rows retain original source as-of and missing-value reasons." };
  });
} catch (error) {
  result.checks.push({ name: "bootstrap", status: "failed", error: String(error) });
} finally {
  await browser.close();
  mkdirSync("artifacts/chart-upgrade/geometry", { recursive: true });
  for (const [check, filename] of [
    ["fixed-profile-is-invariant-under-price-axis-zoom", "etf-fixed-profile-price-zoom.png"],
    ["crosshair-date-aligns-accessible-pane-values", "etf-shared-crosshair.png"],
  ]) {
    if (result.checks.some((item) => item.name === check && item.status === "passed")) {
      const destination = `artifacts/chart-upgrade/geometry/${filename}`;
      copyFileSync(`${shots}/${filename}`, destination);
      result.screenshots.push(destination);
    }
  }
  save();
}
console.log(output);
process.exitCode = result.checks.some((check) => check.status !== "passed") || result.errors.length ? 1 : 0;
