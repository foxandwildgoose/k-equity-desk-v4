#!/usr/bin/env node
/**
 * Runtime smoke test (C1.5). Attaches to `npm run dev` on :8080 (starting it if
 * needed), visits every route at 1440×900 and 390×844, and asserts:
 *   - visible content inside <main>
 *   - zero uncaught page errors / app console errors (external resource loads
 *     blocked by the sandbox network are reported as warnings, not failures)
 *   - no page-level horizontal overflow on mobile
 * Screenshots + a JSON verdict go to `.qa/`.
 *
 * Usage: npm run qa:smoke [-- --routes /,/news/kr] [--base http://127.0.0.1:8080]
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".qa");
mkdirSync(outDir, { recursive: true });

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const BASE = arg("--base") ?? "http://127.0.0.1:8080";

export const DEFAULT_ROUTES = [
  "/",
  "/news/kr",
  "/news/us",
  "/news/etf",
  "/research",
  "/research?market=us",
  "/us-research",
  "/us-link",
  "/robotics",
  "/etfs",
  "/etfs/069500",
  "/stock/005930",
  "/us/NVDA",
  "/industry/robotics",
  "/export-desk",
  "/disclosures",
  "/watchlist",
  "/chart",
  "/settings/alerts",
  "/status/sources",
];

const routes = (arg("--routes")?.split(",") ?? DEFAULT_ROUTES).map((r) => r.trim()).filter(Boolean);

async function up(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    return res.status > 0;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await up(`${BASE}/`)) return null;
  const child = spawn("npm", ["run", "dev"], { cwd: root, stdio: "ignore", detached: true });
  child.unref();
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1_000));
    if (await up(`${BASE}/`)) return child;
  }
  throw new Error("dev server did not start on :8080");
}

async function loadChromium() {
  const { chromium } = await import("playwright");
  try {
    return await chromium.launch();
  } catch {
    const exe = "/opt/pw-browsers/chromium";
    if (existsSync(exe)) return chromium.launch({ executablePath: exe });
    throw new Error("no chromium");
  }
}

function slug(route) {
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "");
}

const EXTERNAL_LOAD = /Failed to load resource|net::ERR_|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|status of 403/i;

async function main() {
  await ensureServer();
  let browser;
  try {
    browser = await loadChromium();
  } catch (err) {
    // Fallback (C1.5): SSR HTML checks only.
    const results = [];
    for (const r of routes) {
      let status = 0;
      let ok = false;
      try {
        const res = await fetch(`${BASE}${r}`);
        status = res.status;
        const html = await res.text();
        ok = res.status === 200 && /<main/.test(html) && /Korea Equity/.test(html);
      } catch {
        /* keep */
      }
      results.push({ route: r, status, ok });
    }
    writeFileSync(join(outDir, "smoke.json"), JSON.stringify({ mode: "ssr-only", note: "visual QA not performed", error: String(err), results }, null, 2));
    console.log(JSON.stringify({ mode: "ssr-only", failures: results.filter((x) => !x.ok) }, null, 2));
    process.exit(results.every((x) => x.ok) ? 0 : 1);
  }

  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
  ];
  const results = [];
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, locale: "ko-KR", timezoneId: "Asia/Seoul" });
    for (const route of routes) {
      const page = await context.newPage();
      const errors = [];
      const warnings = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (EXTERNAL_LOAD.test(text)) warnings.push(text.slice(0, 200));
        else errors.push(`console: ${text.slice(0, 300)}`);
      });
      let status = 0;
      try {
        const res = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
        status = res?.status() ?? 0;
        await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => undefined);
        await page.waitForTimeout(800);
      } catch (e) {
        errors.push(`navigation: ${String(e).slice(0, 200)}`);
      }
      const metrics = await page
        .evaluate(() => {
          const main = document.querySelector("main");
          const text = (main?.innerText ?? document.body.innerText ?? "").trim();
          return {
            textLength: text.length,
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            attribution: Boolean(document.querySelector('[data-testid="chart-attribution"]')),
            disclaimer: Boolean(document.querySelector('[data-testid="risk-disclaimer"]')) || /투자 권유가 아닙니다|투자 자문/.test(document.body.innerText),
          };
        })
        .catch(() => ({ textLength: 0, scrollWidth: 0, innerWidth: 0, attribution: false, disclaimer: false }));
      const shot = join(outDir, `${slug(route)}-${vp.name}.png`);
      await page.screenshot({ path: shot, fullPage: false }).catch(() => undefined);
      const overflow = vp.name === "mobile" && metrics.scrollWidth > metrics.innerWidth + 1;
      const ok = status === 200 && metrics.textLength > 40 && errors.length === 0 && !overflow;
      results.push({ route, viewport: vp.name, status, ok, textLength: metrics.textLength, overflow, scrollWidth: metrics.scrollWidth, attribution: metrics.attribution, disclaimer: metrics.disclaimer, errors, warnings: warnings.slice(0, 5), screenshot: shot.replace(root + "/", "") });
      await page.close();
    }
    await context.close();
  }
  await browser.close();
  const failures = results.filter((r) => !r.ok);
  writeFileSync(join(outDir, "smoke.json"), JSON.stringify({ at: new Date().toISOString(), base: BASE, results }, null, 2));
  console.log(
    JSON.stringify(
      {
        checked: results.length,
        failures: failures.map((f) => ({ route: f.route, viewport: f.viewport, status: f.status, overflow: f.overflow, textLength: f.textLength, errors: f.errors.slice(0, 3) })),
      },
      null,
      2,
    ),
  );
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
