/**
 * Project invariants (C1): platform contracts (A2), chart attribution (F7.3),
 * env hygiene, and the newest-first kernel rule (B0.2).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

test("vite.config.ts keeps grokPwaPlugin() and the nitro vercel preset with serverDir ./server", () => {
  const vite = read("vite.config.ts");
  assert.match(vite, /grokPwaPlugin\(\)/);
  assert.match(vite, /nitro\(\{[\s\S]*?preset:\s*"vercel"[\s\S]*?serverDir:\s*"\.\/server"/);
  assert.match(vite, /appEnvPlugin\(\)/);
  assert.match(vite, /authPopupPlugin\(\)/);
  assert.match(vite, /pgliteBootstrapPlugin\(\)/);
  assert.match(vite, /port:\s*8080,\s*\n\s*strictPort:\s*true/);
  assert.match(vite, /host:\s*"127\.0\.0\.1",\s*\n\s*port:\s*8081/);
});

test("__root.tsx renders PreviewHostBridge and CreatedWithGrokBanner, no og/twitter meta", () => {
  const rootTsx = read("src/routes/__root.tsx");
  assert.match(rootTsx, /<PreviewHostBridge\s*\/>/);
  assert.match(rootTsx, /<CreatedWithGrokBanner\s*\/>/);
  assert.doesNotMatch(rootTsx, /["'](og:|twitter:)/);
  assert.doesNotMatch(rootTsx, /Content-Security-Policy/i);
});

test("no VITE_-prefixed env name carries a secret; no .env files committed", () => {
  const files = [...walk(join(root, "src")), ...walk(join(root, "server")), join(root, "vite.config.ts"), join(root, "docs/upgrade/ENVIRONMENT.md"), join(root, "README.md")];
  const secretish = /VITE_[A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL)[A-Z0-9_]*/;
  for (const f of files) {
    if (!/\.(ts|tsx|mjs|js|md)$/.test(f)) continue;
    const text = readFileSync(f, "utf8");
    const m = text.match(secretish);
    assert.equal(m, null, `${relative(root, f)} exposes ${m?.[0]}`);
  }
  for (const name of readdirSync(root)) {
    assert.ok(!/^\.env(\..*)?$/.test(name) || name === ".env.example", `unexpected env file ${name}`);
  }
});

test("TradingView Lightweight Charts attribution link exists (attributionLogo:false is only allowed with it)", () => {
  const attr = read("src/components/charts/core/attribution.ts");
  assert.match(attr, /CHART_ATTRIBUTION_URL = "https:\/\/www\.tradingview\.com\/"/);
  assert.match(attr, /Charts: TradingView Lightweight Charts™/);
  assert.match(attr, /TradingView Lightweight Charts™\\nCopyright/);
  const shell = read("src/components/layout/AppShell.tsx");
  assert.match(shell, /href=\{CHART_ATTRIBUTION_URL\}/);
  assert.match(shell, /\{CHART_ATTRIBUTION_LABEL\}/);
  // Every chart that hides the logo lives under the AppShell footer.
  const chartFiles = walk(join(root, "src")).filter((f) => /\.(ts|tsx)$/.test(f) && readFileSync(f, "utf8").includes("attributionLogo: false"));
  assert.ok(chartFiles.length > 0);
});

const FORBIDDEN = [".date.localeCompare(", ".datetime.localeCompare(", "a.date < b.date", "a.datetime < b.datetime"];
const MARKER = "// ked-allow-string-date-sort: single-format time series";

test("no unmarked raw string-date comparisons under src/ (B0.2 kernel rule)", () => {
  const offenders = [];
  for (const f of walk(join(root, "src"))) {
    if (!/\.(ts|tsx)$/.test(f) || /\.test\.ts$/.test(f)) continue;
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (FORBIDDEN.some((p) => line.includes(p)) && !line.includes(MARKER)) {
        offenders.push(`${relative(root, f)}:${i + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(offenders, []);
});

test("source registry keeps dead korea.kr disabled and candidates off unless verified", async () => {
  const reg = read("src/server/feeds/registry.ts");
  assert.match(reg, /id: "korea-kr-policy"[^\n]*enabled: false[^\n]*status: "disabled"/);
  assert.ok(existsSync(join(root, "docs/upgrade/SOURCES_STATUS.md")));
});
