#!/usr/bin/env node
/**
 * Test-only market regression fixtures. This checks rendered data contracts,
 * never asserts that synthetic test observations are real exchange prices.
 * Run separately against dev and the newly built preview.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { fromJSON, toCrossJSONAsync } from "seroval";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const base = checkedUrl(option("--base", "http://127.0.0.1:8080")).replace(/\/$/, "");
const origin = new URL(base).origin;
const output = checkedOutputPath(resolve(option("--out", "/workspace/screenshots/market-integrity/dev")), ["/workspace/screenshots"]);
const entry = resolve(option("--server-entry", ".vercel/output/functions/__server.func/index.mjs"));
const names = existsSync(entry) ? Object.fromEntries([...readFileSync(entry, "utf8").matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName: "([^"]+)"/g)].map((match) => [match[1], match[2].replace(/_createServerFn_handler$/, "")])) : {};
const universe = [...readFileSync(new URL("../src/data/universe.ts", import.meta.url), "utf8").matchAll(/\{ code: "([^"]+)", nameKo: "([^"]+)", nameEn: "([^"]+)", sectorId: "([^"]+)", market: "([^"]+)" \}/g)].map(([, code, nameKo, nameEn, sectorId, market]) => ({ code, nameKo, nameEn, sectorId, market }));
assert(universe.length >= 120, "Could not read the actual metadata universe");
const fixtureLabel = "QA 픽스처 · 실제 거래소 시세 검증 아님";
const fixedTime = "2026-10-16T01:30:00.000Z";
const currentTrade = "2026-10-16 10:29:00";
const previousTrade = "2026-10-15 15:30:00";
const quote = (meta, index, pct) => ({ ...meta, price: 10000 + pct * 100, change: pct * 100, changePct: pct,
  changeValid: true, volume: 100000 + index, volumeValid: true, marketCap: 100000, marketCapValid: true,
  high52: 15000, low52: 8000, open: 10000, high: Math.max(10000, 10000 + pct * 100), low: Math.min(10000, 10000 + pct * 100), prevClose: 10000,
  marketStatus: "OPEN", tradedAt: currentTrade, source: "naver-finance-snapshot", fetchedAt: fixedTime });
const fullDeclining = universe.map((meta, index) => quote(meta, index, -(1 + (index % 7) / 10)));
const semis = universe.filter((row) => row.sectorId === "semiconductors");
const cases = [
  { id: "declining", rows: fullDeclining, avg: fullDeclining.filter((row) => row.sectorId === "semiconductors").reduce((sum, row) => sum + row.changePct, 0) / semis.length },
  { id: "mixed", rows: [quote(semis[0], 0, -4), quote(semis[1], 1, 2), quote(semis[2], 2, 0)], avg: -2 / 3 },
  { id: "empty", rows: [], avg: null },
  { id: "partial", rows: [quote(semis[0], 0, -5), { ...quote(semis[1], 1, 13.84), tradedAt: previousTrade }, { ...quote(semis[2], 2, 0), changeValid: false }, { ...quote(semis[3], 3, 8), tradedAt: undefined }], avg: -5 },
  { id: "stale", rows: fullDeclining.map((row, index) => ({ ...quote(row, index, Math.abs(row.changePct)), tradedAt: previousTrade })), avg: null },
].filter((item) => option("--cases", "declining,mixed,empty,partial,stale").split(",").includes(item.id));
const viewports = [{ id: "desktop", width: 1440, height: 900 }, { id: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true }]
  .filter((item) => option("--viewports", "desktop,mobile").split(",").includes(item.id));
assert(cases.length && viewports.length);
mkdirSync(output, { recursive: true });

function serverName(url) {
  const id = new URL(url).pathname.split("/_serverFn/")[1] ?? "";
  try { return JSON.parse(Buffer.from(decodeURIComponent(id), "base64url").toString("utf8")).export?.replace(/_createServerFn_handler$/, "") ?? names[id] ?? ""; }
  catch { return names[id] ?? ""; }
}

async function fixtures(context, item, result) {
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (new URL(request.url()).origin === origin) return route.continue();
    result.externalFixtureCount++;
    return route.fulfill({ status: 200, contentType: request.resourceType() === "stylesheet" ? "text/css" : request.resourceType() === "script" ? "application/javascript" : "text/plain", body: "" });
  });
  await context.route("**/api/**", (route) => {
    if (new URL(route.request().url()).pathname === "/api/market-stream") return route.fulfill({ status: 200, contentType: "text/event-stream", body: 'event: status\ndata: {"enabled":false,"connected":false,"provider":"QA fixture"}\n\n' });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], sources: [], partial: false, nextCursor: null, generatedAt: fixedTime }) });
  });
  await context.route("**/_serverFn/**", async (route) => {
    const request = route.request();
    const name = serverName(request.url());
    assert.equal(request.method(), "GET", `Unexpected mutating RPC: ${name}`);
    const raw = new URL(request.url()).searchParams.get("payload");
    const payload = raw ? fromJSON(JSON.parse(raw)) : {};
    const data = payload.data ?? payload;
    let response;
    if (name === "getMarketQuotes") response = { quotes: item.rows, fetchedAt: fixedTime, source: "naver-finance-snapshot", live: false, cached: false };
    else if (name === "getQuotesByCodes") response = { quotes: item.rows.filter((row) => (data.codes ?? []).includes(row.code)), fetchedAt: fixedTime };
    else if (name === "getMarketIndices") response = { indices: [{ id: "KOSPI", nameKo: "코스피", nameEn: "KOSPI", value: 2500, change: -75, changePct: -3, marketStatus: "OPEN", tradedAt: currentTrade, source: "naver-finance-snapshot" }], fetchedAt: fixedTime, source: "naver-finance-snapshot" };
    else if (name === "getMarketSnapshot") response = { rows: [], fetchedAt: fixedTime, source: fixtureLabel };
    else if (name === "getEtfMarket") response = { etfs: [], total: 0, fetchedAt: fixedTime, source: fixtureLabel };
    else if (name === "getResearchDesk") response = { industry: [], company: [], market: [], economy: [], fetchedAt: fixedTime };
    else if (name === "getResearchBriefing") response = { todayCounts: [], latest: [], fetchedAt: fixedTime };
    else if (name === "getRoboticsUniverse") response = { kr: [], us: [], unresolved: [], sources: [], fetchedAt: fixedTime };
    else { result.unhandledRpcs.push(name || "unmapped RPC"); response = null; }
    result.fixtureCalls.push(name);
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "x-tss-serialized": "true" }, body: JSON.stringify(await toCrossJSONAsync({ result: response, error: undefined, context: {} }, { refs: new Map() })) });
  });
}

const formatPct = (value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
const results = [];
const browser = await chromium.launch({ ...(process.env.QA_CHROMIUM_PATH ? { executablePath: process.env.QA_CHROMIUM_PATH } : {}), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  for (const item of cases) for (const viewport of viewports) {
    const result = { id: `${item.id}-${viewport.id}`, mode: fixtureLabel, status: "failed", fixtureCalls: [], unhandledRpcs: [], externalFixtureCount: 0, pageErrors: [], consoleErrors: [], consoleErrorStacks: [], httpFailures: [], checks: [] };
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch, locale: "ko-KR", timezoneId: "Asia/Seoul" });
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    const pendingModules = new Map();
    page.on("request", (request) => { if (request.resourceType() === "script") pendingModules.set(request, new URL(request.url()).pathname); });
    page.on("requestfinished", (request) => pendingModules.delete(request));
    page.on("requestfailed", (request) => pendingModules.delete(request));
    page.on("pageerror", (error) => result.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
    // Capture the browser's original call frames without wrapping/filtering
    // console.error or changing how application code executes.
    const diagnostics = await context.newCDPSession(page);
    diagnostics.on("Runtime.consoleAPICalled", (event) => {
      if (event.type === "error") result.consoleErrorStacks.push(event.stackTrace ?? null);
    });
    await diagnostics.send("Runtime.enable");
    page.on("response", (response) => { if (response.status() >= 400) {
      const url = new URL(response.url());
      result.httpFailures.push({ status: response.status(), path: url.pathname, ...(response.request().resourceType() === "script" ? { search: url.search } : {}) });
      console.error(`HTTP ${result.id}: ${response.status()} ${url.pathname}`);
    } });
    try {
      console.log(`BEGIN ${result.id}: install fixture clock and transport`);
      // Freeze Date only. React hydration and screenshot rendering keep native
      // timers/requestAnimationFrame rather than an unnecessary fake scheduler.
      await page.clock.setFixedTime(new Date(fixedTime));
      await context.addInitScript(() => localStorage.setItem("korea-equity-cc", JSON.stringify({ state: { theme: "dark", focusMode: false, watchlist: [], alertSettings: { paused: true } }, version: 2 })));
      await fixtures(context, item, result);
      console.log(`LOAD ${result.id}`);
      const snapshotResponse = page.waitForResponse((response) => response.url().includes("/_serverFn/") && serverName(response.url()) === "getMarketQuotes" && response.status() === 200)
        .then((response) => response.finished()).catch((error) => error);
      const response = await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200);
      console.log(`DOM ${result.id}`);
      const snapshotError = await snapshotResponse;
      if (snapshotError) throw snapshotError;
      await page.waitForFunction(() => document.querySelector(".area-sectors") && !document.body.textContent.includes("세션 확인 중"));
      await page.waitForFunction(() => document.querySelectorAll(".area-sectors a").length >= 15);
      await page.waitForFunction(() => !document.querySelector(".area-up")?.textContent.includes("로딩 중"));
      const tile = page.locator('.area-sectors a[href="/industry/semiconductors"]');
      if (item.avg == null) await tile.getByText("—", { exact: true }).waitFor();
      else await tile.getByText(formatPct(item.avg), { exact: true }).first().waitFor();
      result.checks.push(`Semiconductor mean ${item.avg == null ? "unavailable" : formatPct(item.avg)}`);
      if (viewport.id === "desktop") {
        const sidebar = page.locator('.shell-sidebar [data-sector-id="semiconductors"]').first();
        assert((await sidebar.innerText()).includes(item.avg == null ? "—" : formatPct(item.avg)), "Sidebar disagrees with dashboard sector mean");
        assert.equal(await sidebar.getAttribute("data-valid-count"), String(item.id === "declining" ? semis.length : item.id === "mixed" ? 3 : item.id === "partial" ? 1 : 0), "Sidebar coverage count is incorrect");
        if (item.id === "declining") {
          const changes = await page.locator('.shell-sidebar [data-sector-id]').evaluateAll((links) => links.map((link) => link.lastElementChild.textContent.trim()));
          assert(changes.length >= 15 && changes.every((value) => /^-\d+\.\d{2}%$/.test(value)), `A declining sector changed sign: ${changes.join(", ")}`);
          result.checks.push("Every sidebar sector remains negative");
        }
        result.checks.push("Sidebar and dashboard agree");
      }
      const gainerText = await page.locator(".area-up").innerText();
      const loserText = await page.locator(".area-down").innerText();
      if (["declining", "empty", "partial", "stale"].includes(item.id)) assert(!/[+-]?\d+\.\d{2}%/.test(gainerText), "Non-positive or unavailable quote rendered as a gainer");
      if (["empty", "stale"].includes(item.id)) assert(!/[+-]?\d+\.\d{2}%/.test(loserText), "Unavailable quote rendered as a loser");
      if (item.id === "mixed") { assert(gainerText.includes("+2.00%")); assert(!gainerText.includes("-4.00%")); assert(loserText.includes("-4.00%")); assert(!loserText.includes("+2.00%")); }
      if (item.id === "partial") assert(!(await tile.innerText()).includes("13.84%"), "Prior-session positive quote contaminated current sector");
      const body = await page.locator("body").innerText();
      assert(!body.includes("NaN") && !body.includes("Infinity"));
      assert(!body.includes("20초 스냅샷 백업"), "Incorrect polling-frequency claim remains");
      if (["empty", "stale"].includes(item.id)) assert(!body.includes("0↑ / 0↓ / 0→"), "Unknown breadth presented as a flat market");
      result.checks.push("Rankings preserve signs and unavailable observations");
      await page.evaluate((label) => {
        const note = document.createElement("div");
        note.textContent = label;
        Object.assign(note.style, { position: "fixed", bottom: "0", right: "0", zIndex: "2147483647", background: "#fff4c2", color: "#1d232d", fontSize: "12px", padding: "6px 10px", maxWidth: "100%" });
        document.body.append(note);
      }, fixtureLabel);
      await page.screenshot({ path: join(output, `${result.id}-home.png`), fullPage: false, caret: "initial" });
      await tile.scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(output, `${result.id}-sectors.png`), fullPage: false, caret: "initial" });
      // A separate rendered route must use the same central selection contract.
      const industrySnapshotResponse = page.waitForResponse((response) => response.url().includes("/_serverFn/") && serverName(response.url()) === "getMarketQuotes" && response.status() === 200)
        .then((response) => response.finished()).catch((error) => error);
      await page.goto(`${base}/industry/semiconductors`, { waitUntil: "domcontentloaded" });
      const industrySnapshotError = await industrySnapshotResponse;
      if (industrySnapshotError) throw industrySnapshotError;
      await page.waitForFunction(() => !document.querySelector("main")?.innerText.includes("시세 수신"));
      const industrySummary = page.locator("main").getByText("커버리지 종목 단순평균", { exact: true }).locator("..");
      await industrySummary.getByText(item.avg == null ? "—" : formatPct(item.avg), { exact: true }).waitFor();
      assert.equal(await page.locator("main").count(), 1);
      result.checks.push("Industry detail renders the same aggregate");
      result.overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(result.overflow <= 1, `Horizontal page overflow: ${result.overflow}px`);
      assert.deepEqual(result.pageErrors, []);
      assert.deepEqual(result.consoleErrors, []);
      assert.deepEqual(result.unhandledRpcs, []);
      assert.deepEqual(result.httpFailures, []);
      result.status = "passed";
      console.log(`PASS ${result.id}: ${result.checks.join("; ")}`);
    } catch (error) {
      result.error = error.message;
      result.pendingModules = [...pendingModules.values()];
      result.bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 10000);
      await page.screenshot({ path: join(output, `${result.id}-failed.png`), fullPage: false, caret: "initial", timeout: 10000 }).catch(() => {});
      console.error(`FAIL ${result.id}: ${error.message}`);
    } finally {
      results.push(result);
      await context.close();
      writeFileSync(join(output, "verdict.json"), JSON.stringify({ mode: fixtureLabel, liveApisVerified: false, results }, null, 2));
    }
  }
} finally { await browser.close(); }
assert(results.every((result) => result.status === "passed"), `${results.filter((result) => result.status !== "passed").length} market-integrity fixture checks failed`);
