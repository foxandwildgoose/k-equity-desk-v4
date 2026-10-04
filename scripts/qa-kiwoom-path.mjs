#!/usr/bin/env node
/** Explicit isolated QA only: real Better Auth session + mocked broker -> actual DB/RPC/query/canvas.
 * No product fixture flag, operational DB, real credentials or Kiwoom network calls.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { request as httpRequest } from "node:http";
import { createServer } from "vite";
import { chromium } from "playwright";
import { toCrossJSONAsync } from "seroval";

assert(
  !process.env.DATABASE_URL && !process.env.KIWOOM_APP_KEY && !process.env.KIWOOM_APP_SECRET,
  "Run QA without operational DB/broker credentials",
);
const output = resolve(process.argv[2] ?? "artifacts/kiwoom-production-path/browser");
await mkdir(output, { recursive: true });
Object.assign(process.env, {
  VITE_AUTH_ENABLED: "true",
  KIWOOM_FLOW_ENABLED: "true",
  KIWOOM_FLOW_MODE: "collector",
  KIWOOM_ENV: "mock",
  BETTER_AUTH_URL: "http://localhost:8280",
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
});
// Dependency injection belongs ONLY to this QA runner. The real application still requires PostgreSQL.
const server = await createServer({
  root: process.cwd(),
  server: { host: "127.0.0.1", port: 8280, strictPort: true },
  plugins: [
    {
      name: "qa-isolated-kiwoom-storage",
      enforce: "pre",
      transform(code, id) {
        if (!id.endsWith("/src/server/kiwoom-config.ts")) return;
        const needle = 'databaseConfigured: Boolean(value("DATABASE_URL"))';
        assert(code.includes(needle));
        return code.replace(
          needle,
          "databaseConfigured: true /* QA isolated PGlite, NOT persistence evidence */",
        );
      },
    },
  ],
});
let browser;
const result = {
  synthetic: true,
  operationalDatabase: false,
  kiwoomNetworkRequests: 0,
  brokerPages: 0,
  checks: [],
  screenshots: [],
};
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  await page.goto("http://localhost:8280/login");
  await page.getByRole("button", { name: "새 계정 만들기", exact: true }).click();
  await page.getByLabel("이름", { exact: true }).fill("QA isolated owner");
  await page.getByLabel("이메일", { exact: true }).fill("kiwoom-qa@example.test");
  await page.getByLabel("비밀번호", { exact: true }).fill(randomBytes(24).toString("hex"));
  await page.getByRole("button", { name: "계정 만들기", exact: true }).click();
  await page.waitForURL("**/status/kiwoom");
  const owner = await page.evaluate(
    async () => (await (await fetch("/api/auth/get-session")).json())?.user?.id,
  );
  assert(owner && owner !== "dev-user");
  await page.waitForFunction(() =>
    document
      .querySelector('[data-testid="kiwoom-health"]')
      ?.textContent.includes("소유자 인증 필요"),
  );
  result.checks.push("Real Better Auth signup/session; unconfigured owner denied");
  process.env.KIWOOM_OWNER_USER_ID = owner;

  const { getSql } = await server.ssrLoadModule("/src/lib/db.ts");
  const { createKiwoomStore } = await server.ssrLoadModule("/src/server/kiwoom-store.ts");
  const { createKiwoomClient } = await server.ssrLoadModule("/src/server/kiwoom-client.ts");
  const { collectKiwoomMetric } = await server.ssrLoadModule("/src/server/kiwoom-flow.ts");
  const store = createKiwoomStore(await getSql());
  assert((await store.schema()).ready);
  const bars = [];
  for (let day = 0; bars.length < 180; day++) {
    const date = new Date(Date.UTC(2025, 0, 2) + day * 86400000);
    if ([0, 6].includes(date.getUTCDay())) continue;
    const close = 60000 + bars.length * 50 + Math.sin(bars.length / 10) * 2000;
    bars.push({
      date: date.toISOString().slice(0, 10),
      open: close - 100,
      high: close + 250,
      low: close - 250,
      close,
      volume: 1000000 + bars.length * 1000,
    });
  }
  const request = {
    code: "005930",
    market: "KR",
    instrument: "stock",
    exchange: "KRX",
    currency: "KRW",
    quantityUnit: "주",
    interval: "day",
    from: bars[0].date,
    to: bars.at(-1).date,
    expectedDailyDates: bars.map((bar) => bar.date),
  };
  const client = createKiwoomClient(
    {
      appKey: "QA_SYNTHETIC_KEY",
      appSecret: "QA_SYNTHETIC_SECRET",
      environment: "mock",
      enabled: true,
      mode: "direct",
      requestsPerSecond: 2,
      databaseConfigured: true,
    },
    { ...store, admit: async () => {} },
    {
      fetch: async (url, init) => {
        const headers = new Headers(init?.headers);
        const response = (body, continuation = {}) =>
          new Response(JSON.stringify(body), { headers: continuation });
        if (String(url).endsWith("/token"))
          return response({
            return_code: 0,
            token: "QA_SYNTHETIC_TOKEN",
            token_type: "bearer",
            expires_dt: "20300101090000",
          });
        result.brokerPages++;
        const api = headers.get("api-id");
        assert(["ka10013", "ka10008", "ka10059"].includes(api));
        const selected = headers.get("next-key") ? bars.slice(0, 90) : bars.slice(90);
        const rows = selected
          .map((bar, i) => ({
            dt: bar.date.replaceAll("-", ""),
            remn_rt: String(3.42 + i / 100),
            remn: "123",
            wght: String(51.72 + i / 100),
            poss_stkcnt: "123456",
            invtrt: i % 2 ? "-85000" : "+120000",
          }))
          .reverse();
        return response(
          {
            return_code: 0,
            [api === "ka10013"
              ? "crd_trde_trend"
              : api === "ka10008"
                ? "stk_frgnr"
                : "stk_invsr_orgn"]: rows,
          },
          headers.get("next-key") ? {} : { "cont-yn": "Y", "next-key": "QA_CURSOR" },
        );
      },
    },
  );
  for (const metric of ["credit", "foreign", "investmentTrust"]) {
    const job = await collectKiwoomMetric(
      store,
      client,
      { scopeId: owner, environment: "mock", request },
      metric,
    );
    assert.equal(job.pages, 2);
    assert.equal(job.complete, true);
    assert.equal(
      (await store.read({ scopeId: owner, environment: "mock", request }, metric)).length,
      180,
    );
  }
  result.checks.push(
    "Synthetic OAuth and six continuation pages parsed/upserted into same isolated web DB",
  );
  await page.getByRole("button", { name: "상태 새로고침", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="kiwoom-health"]')?.textContent.includes("수신·저장됨"),
  );
  assert((await page.locator("table").textContent()).includes("180"));
  result.checks.push("Authorized diagnostic RPC reads stored rows without broker keys");
  await page.screenshot({ path: resolve(output, "owner-diagnostic.png"), fullPage: true });
  result.screenshots.push("owner-diagnostic.png");

  let flowRequest;
  page.on("request", (req) => {
    try {
      const encoded = new URL(req.url()).pathname.split("/_serverFn/")[1];
      const name = JSON.parse(
        Buffer.from(decodeURIComponent(encoded), "base64url").toString(),
      ).export;
      if (name?.startsWith("getChartFlow")) flowRequest = { url: req.url(), body: req.postData() };
    } catch {
      /* unrelated request */
    }
  });
  await page.route("**/_serverFn/**", async (route) => {
    const encoded = new URL(route.request().url()).pathname.split("/_serverFn/")[1];
    let name;
    try {
      name = JSON.parse(Buffer.from(decodeURIComponent(encoded), "base64url").toString()).export;
    } catch {
      return route.continue();
    }
    if (!name?.startsWith("getChartData")) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "x-tss-serialized": "true" },
      body: JSON.stringify(
        await toCrossJSONAsync(
          {
            result: { bars, source: "QA SYNTHETIC PRICE — NOT MARKET DATA" },
            error: undefined,
            context: {},
          },
          { refs: new Map() },
        ),
      ),
    });
  });
  await page.goto("http://localhost:8280/stock/005930");
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="hts-data-details"]')
        ?.textContent.includes("키움증권 · 모의"),
    undefined,
    { timeout: 60000 },
  );
  const data = await page.evaluate(async (req) => {
    const { getChartFlow } = await import("/src/lib/chart-flow-fns.ts");
    const response = await getChartFlow({ data: req });
    return Object.fromEntries(
      ["credit", "foreign", "investmentTrust"].map((id) => [
        id,
        {
          rows: response[id].observations.length,
          last: response[id].observations.at(-1)?.value,
          health: response[id].health,
        },
      ]),
    );
  }, request);
  assert.equal(data.credit.rows, 180);
  assert.equal(data.foreign.rows, 180);
  assert.equal(data.investmentTrust.last, -85000);
  const settingsButton = page.getByTestId("open-hts-settings");
  await settingsButton.click();
  await page.getByLabel(/투신 표시 방식/).selectOption("daily");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="hts-data-details"]')?.textContent.includes("-85,000"),
  );
  for (const theme of ["light", "dark"]) {
    if (
      (await page.locator("html").evaluate((el) => el.classList.contains("dark"))) !==
      (theme === "dark")
    )
      await page.getByRole("button", { name: "테마 전환", exact: true }).click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: resolve(output, `005930-${theme}-mock-authenticated.png`),
      fullPage: true,
    });
    result.screenshots.push(`005930-${theme}-mock-authenticated.png`);
  }
  result.frontend = data;
  result.canvas = await page.evaluate(() =>
    ["credit", "foreign", "investmentTrust"].map((id) => {
      const pane = document.querySelector(`[data-hts-pane="${id}"]`);
      const pixels = [...pane.querySelectorAll("canvas")]
        .filter((c) => c.width > 10 && c.height > 10)
        .map((c) => c.getContext("2d").getImageData(0, 0, c.width, c.height).data);
      const colors = new Set();
      for (const data of pixels)
        for (let i = 0; i < data.length; i += 40)
          colors.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
      return { id, canvases: pixels.length, colors: colors.size };
    }),
  );
  assert(result.canvas.every((pane) => pane.canvases && pane.colors > 10));
  result.checks.push(
    "Real session -> collector DB -> server RPC -> React Query -> signed daily values and actual pane canvas",
  );
  assert(flowRequest);
  const sibling = await new Promise((done, reject) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port: 8280,
        path: new URL(flowRequest.url).pathname,
        method: "POST",
        headers: {
          host: "localhost:8280",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(flowRequest.body),
          "sec-fetch-site": "same-site",
          "sec-fetch-mode": "cors",
          "sec-fetch-dest": "empty",
        },
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => done({ status: response.statusCode, body }));
      },
    );
    req.setTimeout(5000, () => req.destroy(new Error("Sibling request timed out")));
    req.on("error", reject);
    req.end(flowRequest.body);
  });
  assert(sibling.status >= 400 || sibling.body.includes("cross-site request blocked"));
  assert.equal(sibling.body.includes("observations"), false);
  result.siblingRequestStatus = sibling.status;
  result.checks.push("Sibling scripted request blocked by existing same-site protection");
  const fresh = await browser.newContext();
  const visitor = await fresh.newPage();
  await visitor.goto("http://localhost:8280/status/kiwoom");
  await visitor.waitForFunction(() =>
    document
      .querySelector('[data-testid="kiwoom-health"]')
      ?.textContent.includes("소유자 인증 필요"),
  );
  assert.equal(await visitor.locator("table").count(), 0);
  result.checks.push("Signed-out visitor cannot read stored observations");
  await fresh.close();
  await context.close();
  result.success = true;
} catch (error) {
  result.success = false;
  // QA errors only. Never record auth request/response bodies or environment variables.
  result.failure = `${error.name}: isolated QA check failed (request headers/bodies excluded)`;
  process.exitCode = 1;
} finally {
  await writeFile(resolve(output, "result.json"), JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  await browser?.close();
  server.httpServer?.closeAllConnections();
  await Promise.race([server.close(), new Promise((done) => setTimeout(done, 3000))]);
  process.exit(process.exitCode ?? 0);
}
