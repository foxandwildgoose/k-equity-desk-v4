#!/usr/bin/env node
/**
 * Browser acceptance checks (C2) that need a real page. External data is
 * replaced with Playwright route mocks — synthetic fixture (format sample),
 * not market data — which exist only in this QA harness and never ship in
 * the app. Screenshots → .qa/at-*.png, verdict → .qa/acceptance.json.
 *
 * Usage: npm run qa:acceptance [-- --only AT-09,AT-12]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".qa");
mkdirSync(outDir, { recursive: true });
const BASE = process.env.QA_BASE ?? "http://127.0.0.1:8080";
const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg > 0 ? new Set(process.argv[onlyArg + 1].split(",")) : null;

async function chromium() {
  const { chromium } = await import("playwright");
  try {
    return await chromium.launch();
  } catch {
    const exe = "/opt/pw-browsers/chromium";
    if (existsSync(exe)) return chromium.launch({ executablePath: exe });
    throw new Error("no chromium");
  }
}

const NOW = Date.now();
const iso = (minsAgo) => new Date(NOW - minsAgo * 60_000).toISOString();

// synthetic fixture (format sample), not market data
function item(p) {
  return {
    kind: "news",
    region: "KR",
    sourceTier: 3,
    precision: "minute",
    fetchedAt: iso(0),
    tickers: [],
    sectors: [],
    topics: [],
    lang: "ko",
    ...p,
  };
}

// synthetic fixture (format sample), not market data
const KR_PAGE = {
  items: [
    item({ id: "qa:kr1", sourceId: "naver-flash", sourceName: "네이버 증권 속보", outlet: "연합뉴스", sourceTier: 1, title: "[QA 샘플] LG에너지솔루션 북미 공장 증설 검토", url: "https://example.com/qa/kr1", publishedAt: iso(5), tickers: [{ market: "KR", code: "373220" }], importance: { score: 72, tier: "high", reasons: ["1차 출처 +25", "기업 이벤트: 인수 +20"] } }),
    item({ id: "qa:kr2", sourceId: "hankyung-finance", sourceName: "한국경제 증권", sourceTier: 2, title: "[QA 샘플] 코스피 마감 시황", url: "https://example.com/qa/kr2", publishedAt: iso(40), snippet: "QA 샘플 요약" }),
    item({ id: "qa:kr3", sourceId: "krx-disclosures", sourceName: "KRX·DART 주요 공시", kind: "disclosure", sourceTier: 1, title: "[QA 샘플] 주요사항보고서", url: "https://example.com/qa/kr3", publishedAt: iso(300) }),
    item({ id: "qa:kr4", sourceId: "gn-kr-market", sourceName: "Google 뉴스", title: "[QA 샘플] 날짜만 있는 항목", url: "https://example.com/qa/kr4", publishedAt: new Date(NOW - 3 * 86_400_000).toISOString().slice(0, 10) + "T12:00:00.000Z", precision: "day" }),
  ],
  nextCursor: null,
  partial: false,
  sources: [
    { id: "naver-flash", ok: true, count: 1, state: "ok" },
    { id: "hankyung-finance", ok: true, count: 1, state: "ok" },
  ],
  generatedAt: iso(0),
};

// synthetic fixture (format sample), not market data
const US_PAGE = {
  items: [
    item({ id: "qa:us1", region: "US", lang: "en", sourceId: "bloomberg-markets", sourceName: "Bloomberg Markets", sourceTier: 1, paywalled: true, title: "[QA sample] Stocks rally as yields ease", url: "https://example.com/qa/us1", publishedAt: iso(10) }),
    item({ id: "qa:us2", region: "US", lang: "en", sourceId: "gn-us-market", sourceName: "Google News (US market)", outlet: "Reuters", sourceTier: 1, title: "[QA sample] Treasury yields fall", url: "https://example.com/qa/us2", publishedAt: iso(20), tickers: [{ market: "US", code: "NVDA" }] }),
  ],
  nextCursor: null,
  partial: true,
  sources: [
    { id: "bloomberg-markets", ok: true, count: 1, state: "ok" },
    { id: "gn-us-market", ok: true, count: 1, state: "ok" },
    { id: "fed-press", ok: false, count: 0, state: "error" },
  ],
  generatedAt: iso(0),
};

const results = [];
function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

async function mockFeed(page, byRegion) {
  await page.route("**/api/feed?**", async (route) => {
    const u = new URL(route.request().url());
    const key = u.searchParams.get("group") ?? u.searchParams.get("region") ?? "KR";
    const body = byRegion[key] ?? { items: [], nextCursor: null, partial: false, sources: [], generatedAt: iso(0) };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function run(browser, id, fn) {
  if (ONLY && !ONLY.has(id)) return;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await ctx.newPage();
  try {
    await fn(page, ctx);
  } catch (err) {
    record(id, false, String(err).slice(0, 300));
  } finally {
    await page.screenshot({ path: join(outDir, `at-${id.toLowerCase()}.png`) }).catch(() => undefined);
    await ctx.close();
  }
}

/**
 * Mock TanStack server functions by export name. Responses use seroval's
 * cross-JSON format — the same wire format the Start runtime emits.
 */
async function mockServerFns(page, handlers) {
  const { toCrossJSONAsync } = await import("seroval");
  await page.route("**/_serverFn/**", async (route) => {
    const url = new URL(route.request().url());
    const seg = url.pathname.split("/_serverFn/")[1] ?? "";
    let exp = "";
    try {
      exp = JSON.parse(Buffer.from(seg.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")).export ?? "";
    } catch {
      /* not decodable */
    }
    const name = exp.replace(/_createServerFn_handler$/, "");
    const h = handlers[name];
    if (!h) return route.continue();
    let payload = null;
    try {
      const raw = url.searchParams.get("payload");
      if (raw) {
        const { fromJSON } = await import("seroval");
        payload = fromJSON(JSON.parse(raw));
      }
    } catch {
      /* ignore */
    }
    const out = await h(payload?.data ?? payload);
    if (out && out.__status) return route.fulfill({ status: out.__status, body: "error" });
    const body = JSON.stringify(await toCrossJSONAsync({ result: out, error: undefined, context: {} }, { refs: new Map() }));
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "x-tss-serialized": "true" }, body });
  });
}

// synthetic fixture (format sample), not market data
function report(i, extra = {}) {
  const day = new Date(NOW - Math.floor(i / 4) * 86_400_000 + 9 * 3_600_000).toISOString().slice(0, 10);
  return {
    researchId: 900000 - i,
    code: "005930",
    nameKo: "삼성전자",
    title: `[QA 샘플] 리포트 ${i}`,
    broker: i % 2 ? "가증권" : "나증권",
    date: day,
    preview: "QA 샘플 미리보기 문장입니다. 목표주가를 유지한다.",
    rating: "매수",
    targetPrice: 100000 + i * 100,
    category: "company",
    categoryLabel: "기업",
    pageUrl: `${BASE}/status/sources?page=${900000 - i}`,
    summary: "QA 샘플 요약",
    sectorIds: [],
    tags: [],
    hasInvestmentView: true,
    sourceKind: "naver",
    sourceLabel: "네이버 리서치 v2",
    v2Type: "company",
    summarySource: "preview",
    ...extra,
  };
}

function researchPage(type, index, n, total) {
  return {
    type,
    index,
    reports: type === "company" ? Array.from({ length: n }, (_, k) => report(index * n + k)) : [],
    totalCount: type === "company" ? total : 0,
    hasNext: type === "company" && index < 1,
    path: "v2",
    error: null,
    fetchedAt: iso(0),
  };
}

const EMPTY_BRIEFING = { todayCounts: [], up: [], down: [], weeklyHot: [], newCoverage: [], latest: [], errors: [], fetchedAt: iso(0) };

const browser = await chromium();

await run(browser, "AT-09", async (page) => {
  await mockFeed(page, { KR: KR_PAGE });
  await page.goto(`${BASE}/news/kr`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-feed-id]", { timeout: 20_000 });
  const rows = await page.$$eval("[data-feed-list] [data-feed-id]", (els) => els.map((e) => ({ id: e.getAttribute("data-feed-id"), t: e.getAttribute("data-published") })));
  const times = rows.map((r) => Date.parse(r.t));
  const sorted = times.every((t, i) => i === 0 || times[i - 1] >= t);
  const anchors = await page.$$eval("[data-feed-list] article a[target]", (as) => as.map((a) => ({ target: a.getAttribute("target"), rel: a.getAttribute("rel") })));
  const relOk = anchors.length > 0 && anchors.every((a) => a.target === "_blank" && a.rel === "noopener noreferrer");
  const digest = await page.isVisible('[data-testid="briefing-digest"]');
  const sources = await page.$$eval("[data-feed-list] article", (as) => as.every((a) => a.textContent && a.textContent.length > 0));
  const dateOnly = await page.textContent('[data-feed-id="qa:kr4"] time');
  record("AT-09", sorted && relOk && digest && sources && !/:/.test(dateOnly ?? ""), `rows=${rows.length} newestFirst=${sorted} rel=${relOk} digest=${digest} dateOnlyLabel="${dateOnly}"`);
});

await run(browser, "AT-11", async (page) => {
  await mockFeed(page, { KR: KR_PAGE });
  await page.goto(`${BASE}/news/kr`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-feed-id="qa:kr1"]', { timeout: 20_000 });
  const hrefs = await page.$$eval('[data-feed-id="qa:kr1"] a[data-ticker]', (as) => as.map((a) => a.getAttribute("href")));
  const ok = hrefs.includes("/stock/373220") && !hrefs.includes("/stock/003550");
  record("AT-11", ok, `ticker chips ${JSON.stringify(hrefs)}`);
});

await run(browser, "AT-12", async (page) => {
  await mockFeed(page, { US: US_PAGE });
  await page.goto(`${BASE}/news/us`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-feed-id="qa:us1"]', { timeout: 20_000 });
  const bb = await page.textContent('[data-feed-id="qa:us1"]');
  const hasPaid = /유료/.test(bb ?? "");
  const hasSnippet = await page.$('[data-feed-id="qa:us1"] p');
  const tiles = await page.textContent('[data-testid="briefing-digest"]');
  const delayLabel = /지연/.test(tiles ?? "");
  const before = await page.textContent('[data-feed-id="qa:us2"] time');
  await page.click('button[aria-pressed]:has-text("ET")');
  await page.waitForTimeout(300);
  const title = await page.getAttribute('[data-feed-id="qa:us2"] time', "title");
  const toggled = /ET/.test(title ?? "");
  record("AT-12", hasPaid && !hasSnippet && delayLabel && toggled, `유료=${hasPaid} snippetHidden=${!hasSnippet} delayLabels=${delayLabel} tzToggle=${toggled} (${before})`);
});

await run(browser, "AT-13", async (page, ctx) => {
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "korea-equity-cc",
      JSON.stringify({ state: { newsPrefs: { tz: "KST", disabledSources: [], bloombergEnabled: false, minImportance: 0, watchOnly: false } }, version: 2 }),
    );
  });
  await mockFeed(page, { US: US_PAGE });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/news/us`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-feed-id="qa:us2"]', { timeout: 20_000 });
  const bloomberg = await page.$('[data-feed-id="qa:us1"]');
  record("AT-13", !bloomberg && errors.length === 0, `bloomberg row hidden=${!bloomberg} pageErrors=${errors.length}`);
});

async function researchMocks(page, resolveDelay = 1_200, resolveFails = false) {
  await mockServerFns(page, {
    getResearchV2: (d) => researchPage(d?.type ?? "company", d?.index ?? 0, 16, 1234),
    getResearchBriefing: () => EMPTY_BRIEFING,
    getResearchV2Detail: () => ({ report: null, bulletsText: "", prev: null, next: null, pdfUrl: null, pageUrl: `${BASE}/status/sources`, summarySource: "none", path: "v2", error: null }),
    resolveResearchOriginal: async (d) => {
      await new Promise((r) => setTimeout(r, resolveDelay));
      if (resolveFails) return { __status: 500 };
      return { pdfUrl: `${BASE}/status/sources?pdf=${d?.nid}`, pageUrl: `${BASE}/status/sources?page=${d?.nid}` };
    },
  });
}

await run(browser, "AT-15", async (page) => {
  await researchMocks(page);
  await page.goto(`${BASE}/research?tab=company`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-research-list] [data-research-id]", { timeout: 20_000 });
  const read = () => page.$$eval("[data-research-list] [data-research-id]", (els) => els.map((e) => ({ id: Number(e.getAttribute("data-research-id")), t: e.getAttribute("data-published") })));
  const first = await read();
  const headers = await page.$$eval("[data-research-list] [data-date-header]", (els) => els.length);
  const counts = await page.textContent('[data-testid="research-counts"]');
  await page.click("text=더 보기");
  await page.waitForFunction((n) => document.querySelectorAll("[data-research-list] [data-research-id]").length > n, first.length, { timeout: 15_000 });
  const second = await read();
  const ordered = second.every((r, i) => i === 0 || second[i - 1].t > r.t || (second[i - 1].t === r.t && second[i - 1].id > r.id));
  const noDup = new Set(second.map((r) => r.id)).size === second.length;
  record("AT-15", ordered && noDup && headers > 1 && /1,234/.test(counts ?? ""), `rows ${first.length}→${second.length} ordered=${ordered} noDup=${noDup} dateHeaders=${headers} counts="${counts?.trim()}"`);
});

for (const vp of [
  { id: "AT-16", w: 1280, h: 900, mobile: false },
  { id: "AT-16-mobile", w: 390, h: 844, mobile: true },
]) {
  await run(browser, vp.id, async (page, ctx) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await researchMocks(page);
    await page.goto(`${BASE}/research?tab=company`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-research-list] [data-research-id]", { timeout: 20_000 });
    // Row 14+ is never pre-resolved (only the first 12 are), so the click takes the async path.
    const target = page.locator("[data-research-list] [data-research-id]").nth(14);
    await target.scrollIntoViewIfNeeded();
    const nid = await target.getAttribute("data-research-id");
    const [popup] = await Promise.all([ctx.waitForEvent("page", { timeout: 10_000 }), target.locator('[data-action="pdf"]').click()]);
    await popup.waitForURL(/pdf=/, { timeout: 10_000 });
    const okUrl = popup.url().includes(`pdf=${nid}`);
    const opener = await popup.evaluate(() => window.opener === null);
    record(vp.id, okUrl && opener, `async-resolved popup ${popup.url().replace(BASE, "")} opener=null:${opener}`);
    await popup.close();
  });
}

await run(browser, "AT-16-fallback", async (page, ctx) => {
  await researchMocks(page, 300, true);
  await page.goto(`${BASE}/research?tab=company`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-research-list] [data-research-id]", { timeout: 20_000 });
  const target = page.locator("[data-research-list] [data-research-id]").nth(13);
  await target.scrollIntoViewIfNeeded();
  const nid = await target.getAttribute("data-research-id");
  const [popup] = await Promise.all([ctx.waitForEvent("page", { timeout: 10_000 }), target.locator('[data-action="pdf"]').click()]);
  await popup.waitForURL(/page=/, { timeout: 10_000 });
  record("AT-16-fallback", popup.url().includes(`page=${nid}`), `resolution failed → research page ${popup.url().replace(BASE, "")}`);
});

await run(browser, "AT-18", async (page) => {
  await researchMocks(page);
  await page.goto(`${BASE}/research?tab=company`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-research-list] [data-research-id]", { timeout: 20_000 });
  const body = await page.textContent("main");
  const oldFeatured = /주요 종목 최신 기업 리포트/.test(body ?? "");
  const hasMore = await page.isVisible("text=더 보기");
  record("AT-18", !oldFeatured && hasMore, `old 7-stock list text present=${oldFeatured}; company tab paginates (더 보기 visible=${hasMore})`);
});

// synthetic fixture (format sample), not market data
const STREET_PACK = {
  notes: [
    { id: "n1", symbol: "NVDA", broker: "QA Broker A", action: "Upgrade", actionKo: "상향", rating: "Hold → Buy", target: "$150 → $180", date: "2026-09-25", publishedAt: "2026-09-25T12:00:00.000Z", precision: "day", seq: 2, summary: "QA", pageUrl: "https://finviz.com/quote.ashx?t=NVDA", sourceLabel: "Finviz" },
    { id: "n2", symbol: "TSLA", broker: "QA Broker B", action: "Downgrade", actionKo: "하향", rating: "Buy → Hold", target: "$300", date: "2026-09-24", publishedAt: "2026-09-24T12:00:00.000Z", precision: "day", seq: 1, summary: "QA", pageUrl: "https://finviz.com/quote.ashx?t=TSLA", sourceLabel: "Finviz" },
    { id: "n3", symbol: "NVDA", broker: "QA Broker C", action: "Reiterated", actionKo: "유지", rating: "Buy", target: "$170 → $190", date: "2026-09-20", publishedAt: "2026-09-20T12:00:00.000Z", precision: "day", seq: 1, summary: "QA", pageUrl: "https://finviz.com/quote.ashx?t=NVDA", sourceLabel: "Finviz" },
  ].map((n) => ({ ...n, publishedAt: new Date(NOW - (n.id === "n1" ? 1 : n.id === "n2" ? 2 : 6) * 86_400_000).toISOString() })),
  headlines: [
    { id: "h1", symbol: "NVDA", title: "[QA sample] QA Broker A upgrades Nvidia", source: "기사", url: "https://example.com/qa/h1", when: "Today 09:00AM", publishedAt: iso(60), precision: "minute" },
    { id: "h2", symbol: "TSLA", title: "[QA sample] QA Broker B downgrades Tesla", source: "기사", url: "https://example.com/qa/h2", when: "Yesterday 09:00AM", publishedAt: iso(1500), precision: "minute" },
  ],
  consensus: [],
  note: "QA",
  fetchedAt: iso(0),
};

await run(browser, "AT-19", async (page) => {
  await mockServerFns(page, { getUsStreet: () => STREET_PACK });
  await page.goto(`${BASE}/research?market=us`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="street-moves"] [data-street-rows] tr', { timeout: 20_000 });
  const banner = await page.isVisible('[data-testid="us-scope-banner"]');
  const bannerText = await page.textContent('[data-testid="us-scope-banner"]');
  const exact = (bannerText ?? "").includes("미국 투자은행 리포트 PDF는 고객 전용으로 공개되지 않습니다.");
  const links = await page.$$eval("main a[target=_blank]", (as) => as.length);
  record("AT-19", banner && exact && links > 3, `scope banner=${banner} exactText=${exact} original links=${links}`);
});

await run(browser, "AT-20", async (page) => {
  await mockServerFns(page, { getUsStreet: () => STREET_PACK });
  await page.goto(`${BASE}/research?market=us`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="street-moves"] [data-street-rows] tr', { timeout: 20_000 });
  const stamps = await page.$$eval('[data-testid="street-moves"] [data-street-rows] tr', (trs) => trs.map((t) => t.getAttribute("data-published")));
  const sorted = stamps.every((t, i) => i === 0 || stamps[i - 1] >= t);
  await page.selectOption('[data-testid="street-moves"] select[aria-label="티커"]', "NVDA");
  const visibleRows = await page.$$eval('[data-testid="street-moves"] [data-street-rows] tr', (trs) => trs.length);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click('[data-testid="street-csv"]')]);
  const path = await dl.path();
  const { readFileSync } = await import("node:fs");
  const csv = readFileSync(path, "utf8").replace(/^\uFEFF/, "").trim().split("\n");
  record("AT-20", sorted && csv.length - 1 === visibleRows && /street-moves-\d{8}-\d{4}\.csv$/.test(dl.suggestedFilename()), `dateDesc=${sorted} visible=${visibleRows} csvRows=${csv.length - 1} file=${dl.suggestedFilename()}`);
});


// ── P4: ETF news + robotics ─────────────────────────────────────────────
// synthetic fixture (format sample), not market data
const ETF_PAGE = {
  items: [
    item({ id: "qa:etf1", sourceId: "gn-etf-kr", sourceName: "Google 뉴스 (ETF)", outlet: "QA 경제", title: "[QA 샘플] TIGER QA로봇액티브 ETF 신규 상장", url: "https://example.com/qa/etf1", publishedAt: iso(30), topics: ["etf", "stage:listed", "theme:robot-ai", "brand:TIGER"], etf: { code: "0QA000", name: "TIGER QA로봇액티브", price: 10250, changePct: 1.25, volume: 123456, marketSum: 321, issuer: "미래에셋자산운용", retirementEligible: true } }),
    item({ id: "qa:etf2", sourceId: "hankyung-finance", sourceName: "한국경제 증권", sourceTier: 2, title: "[QA 샘플] ETF 5종 상장폐지", url: "https://example.com/qa/etf2", publishedAt: iso(600), topics: ["etf", "stage:delisting"] }),
  ],
  nextCursor: null,
  partial: false,
  sources: [
    { id: "gn-etf-kr", ok: true, count: 1, state: "ok" },
    { id: "hankyung-finance", ok: true, count: 1, state: "ok" },
  ],
  generatedAt: iso(0),
};

// synthetic fixture (format sample), not market data
const ETF_SNAPSHOT = {
  topTrading: [{ code: "0QA001", name: "KODEX QA200", price: 35000, changePct: 0.5, volume: 1000, amount: 10, marketSum: 999, issuer: "삼성자산운용" }],
  robotAi: [{ code: "0QA000", name: "TIGER QA로봇액티브", price: 10250, changePct: 1.25, volume: 123456, amount: 5, marketSum: 321, issuer: "미래에셋자산운용" }],
  total: 2,
  error: null,
  fetchedAt: iso(0),
};

await run(browser, "AT-22", async (page) => {
  await mockFeed(page, { etf: ETF_PAGE });
  await mockServerFns(page, { getEtfNewsSnapshot: () => ETF_SNAPSHOT });
  await page.goto(`${BASE}/news/etf`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-feed-id="qa:etf1"]', { timeout: 20_000 });
  const strip = await page.textContent('[data-feed-id="qa:etf1"] [data-etf-match]');
  const href = await page.getAttribute('[data-feed-id="qa:etf1"] [data-etf-match]', "href");
  const stage = await page.isVisible('[data-feed-id="qa:etf1"] [data-chip="stage:listed"]');
  const delist = await page.isVisible('[data-feed-id="qa:etf2"] [data-chip="stage:delisting"]');
  const ok = /0QA000/.test(strip ?? "") && /10,250/.test(strip ?? "") && /123,456/.test(strip ?? "") && href === "/etfs/0QA000" && stage && delist;
  // /etfs "ETF 뉴스" tab renders the same desk.
  await page.goto(`${BASE}/etfs`, { waitUntil: "domcontentloaded" });
  let tabOk = false;
  for (let i = 0; i < 6 && !tabOk; i++) {
    await page.click('[data-testid="etf-news-tab"]');
    tabOk = await page.waitForSelector('[data-testid="etf-news-desk"] [data-feed-id="qa:etf1"]', { timeout: 4_000 }).then(() => true).catch(() => false);
  }
  if (!tabOk) throw new Error("/etfs ETF 뉴스 tab did not render the desk");
  record("AT-22", ok, `strip="${(strip ?? "").replace(/\s+/g, " ").trim()}" href=${href} stageChip=${stage} delistChip=${delist} etfsTab=ok`);
});

// synthetic fixture (format sample), not market data
const UNIVERSE_MOCK = {
  kr: [
    { key: "KR:277810", market: "KR", code: "277810", name: "레인보우로보틱스", nameEn: "Rainbow Robotics", segment: "humanoid", exposure: "pure-play", kind: "seed", price: 100000, changePct: 2, pos52w: 40, marketCap: 10000, volume: 1000, currency: "KRW", asOf: null, source: "네이버 시세", delay: "약 30초 캐시" },
    { key: "KR:466100", market: "KR", code: "466100", name: "클로봇", nameEn: "CLOBOT", segment: "software-ai", exposure: "pure-play", kind: "seed", price: 20000, changePct: -1, pos52w: 10, marketCap: 2000, volume: 500, currency: "KRW", asOf: null, source: "네이버 시세", delay: "약 30초 캐시" },
  ],
  us: [{ key: "US:ISRG", market: "US", code: "ISRG", name: "Intuitive Surgical", nameEn: "Sample", segment: "medical", exposure: "pure-play", kind: "seed", price: 500, changePct: 1, pos52w: 70, marketCap: null, volume: 1000, currency: "USD", asOf: iso(20), source: "Yahoo Finance", delay: "지연 15분" }],
  unresolved: [{ market: "KR", name: "QA미확인로봇", reason: "종목 검색에서 정확히 같은 이름이 없음" }],
  fetchedAt: iso(0),
};

// synthetic fixture (format sample), not market data
const ROBOT_MARKET = {
  items: [item({ id: "qa:rb1", sourceId: "robot-report", sourceName: "The Robot Report", sourceTier: 2, lang: "en", region: "US", title: "[QA sample] Humanoid maker raises Series B", url: "https://example.com/qa/rb1", publishedAt: iso(90), topics: ["robotics", "robot:humanoid", "robot:funding-ma"] })],
  nextCursor: null,
  partial: false,
  sources: [{ id: "robot-report", ok: true, count: 1, state: "ok" }],
  generatedAt: iso(0),
};
const ROBOT_POLICY_DOWN = { items: [], nextCursor: null, partial: true, sources: [{ id: "federal-register", ok: false, count: 0, state: "error" }, { id: "gn-robot-policy-kr", ok: false, count: 0, state: "timeout" }], generatedAt: iso(0) };

await run(browser, "AT-23", async (page) => {
  await mockFeed(page, { "robotics-market": ROBOT_MARKET, "robotics-policy": ROBOT_POLICY_DOWN });
  await mockServerFns(page, {
    getRoboticsUniverse: () => UNIVERSE_MOCK,
    getRoboticsEtfs: () => ({ kr: [], us: [], unresolved: [], krError: null, fetchedAt: iso(0) }),
    getRoboticsResearch: () => ({ kr: { industry: [], company: [], paths: ["v2"], errors: [], fetchedAt: iso(0) }, street: { notes: [], headlines: [], note: "QA", fetchedAt: iso(0) } }),
  });
  await page.goto(`${BASE}/robotics`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-kpi="kr-basket"]', { timeout: 20_000 });
  await page.waitForFunction(() => document.querySelector('[data-kpi="news-24h"]')?.textContent?.includes("1건"), null, { timeout: 20_000 });
  const tiles = await page.$$eval("[data-kpi]", (els) => els.map((e) => ({ id: e.getAttribute("data-kpi"), text: e.textContent ?? "", source: e.lastElementChild?.textContent ?? "" })));
  const allSourced = tiles.length === 5 && tiles.every((t) => t.source.trim().length > 3);
  const kr = tiles.find((t) => t.id === "kr-basket")?.text ?? "";
  const policy = tiles.find((t) => t.id === "policy-7d")?.text ?? "";
  const ok = allSourced && /\+0\.50%/.test(kr) && /—/.test(policy) && /응답 없음/.test(policy);
  record("AT-23", ok, `tiles=${tiles.length} sourced=${allSourced} kr="${kr.slice(0, 40)}" policy="${policy.slice(0, 60)}"`);
});

await run(browser, "AT-25", async (page) => {
  await mockFeed(page, {});
  await mockServerFns(page, {
    getRoboticsUniverse: () => UNIVERSE_MOCK,
    getRoboticsCompanyMeta: () => ({ latestNews: { "KR:277810": iso(30) }, latestResearch: {}, fetchedAt: iso(0) }),
  });
  await page.goto(`${BASE}/robotics?tab=companies`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="robotics-companies-kr"] tr[data-row]', { timeout: 20_000 });
  const rows = await page.$$eval("tr[data-row]", (trs) => trs.map((t) => t.getAttribute("data-row")));
  const hiddenOk = !(await page.content()).includes("QA미확인로봇</td>") && rows.length === 3;
  const note = await page.textContent('[data-testid="robotics-unresolved-note"]');
  const noteLink = await page.getAttribute('[data-testid="robotics-unresolved-note"] a', "href");
  // Row click → news drawer.
  await page.click('tr[data-row="KR:466100"] td:nth-child(2)');
  const drawer = await page.waitForSelector("text=네이버 종목 뉴스 · 최신순", { timeout: 10_000 }).then(() => true).catch(() => false);
  // Unmocked server: the real resolver runs (offline → unresolved) and lists names in Source Health.
  const real = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p2 = await real.newPage();
  await p2.goto(`${BASE}/robotics?tab=companies`, { waitUntil: "domcontentloaded" });
  await p2.waitForFunction(() => !document.body.textContent?.includes("수신 중…") || document.querySelector('[data-testid="robotics-unresolved-note"]'), null, { timeout: 60_000 }).catch(() => undefined);
  await p2.waitForTimeout(1_000);
  await p2.goto(`${BASE}/status/sources`, { waitUntil: "domcontentloaded" });
  await p2.waitForSelector("text=로봇 유니버스 검증", { timeout: 20_000 });
  const healthText = await p2.evaluate(() => {
    const li = [...document.querySelectorAll("li")].find((el) => el.textContent?.includes("로봇 유니버스 검증"));
    return li?.textContent ?? "";
  });
  await real.close();
  const listed = /미확인|유니버스 종목을 하나도/.test(healthText);
  record("AT-25", hiddenOk && /1개/.test(note ?? "") && noteLink === "/status/sources" && drawer && listed, `rows=${rows.join(",")} hidden=${hiddenOk} note="${(note ?? "").slice(0, 40)}" drawer=${drawer} healthListed=${listed}`);
});

await run(browser, "AT-28", async (page) => {
  await page.goto(`${BASE}/industry/robotics`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="robotics-crosslink"]', { timeout: 20_000 });
  const cross = await page.getAttribute('[data-testid="robotics-crosslink"] a', "href");
  const side = await page.getAttribute('[data-sector-link="robotics"]', "href");
  const nav = await page.$$eval('a[href="/robotics"]', (as) => as.length);
  record("AT-28", cross === "/robotics" && side === "/robotics" && nav >= 3, `crosslink=${cross} sidebarSector=${side} links=${nav} (CLOBOT nameEn covered by unit test)`);
});

// ── P5: Live Wire ───────────────────────────────────────────────────────
// synthetic fixture (format sample), not market data
const WIRE_A = item({ id: "qa:w1", sourceId: "naver-flash", sourceName: "네이버 증권 속보", sourceTier: 1, title: "[QA 샘플] 첫 속보", url: "https://example.com/qa/w1", publishedAt: iso(3), importance: { score: 66, tier: "high", reasons: ["1차 출처 +25"] } });
// Scores FLASH under the real client re-score: tier 1 + 속보 + 인수 + default watchlist 005930.
const WIRE_B = item({ id: "qa:w2", sourceId: "naver-flash", sourceName: "네이버 증권 속보", sourceTier: 1, title: "[속보] [QA 샘플] 삼성전자 인수 발표 새 FLASH", url: "https://example.com/qa/w2", publishedAt: iso(1), tickers: [{ market: "KR", code: "005930" }], importance: { score: 80, tier: "flash", reasons: ["1차 출처 +25"] } });
function wirePage(items) {
  return { items, nextCursor: null, partial: false, sources: [{ id: "naver-flash", ok: true, count: items.length, state: "ok" }], generatedAt: new Date().toISOString(), regions: "KR,US" };
}

await run(browser, "AT-29", async (page, ctx) => {
  const counts = new Map();
  await ctx.route("**/api/wire?**", async (route) => {
    const who = route.request().frame()?.page() === page ? "A" : "B";
    counts.set(who, (counts.get(who) ?? 0) + 1);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wirePage([WIRE_A])) });
  });
  await page.goto(`${BASE}/settings/alerts`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2_500);
  const second = await ctx.newPage();
  await second.goto(`${BASE}/settings/alerts`, { waitUntil: "domcontentloaded" });
  await second.waitForTimeout(6_000);
  const a = counts.get("A") ?? 0;
  const b = counts.get("B") ?? 0;
  // The follower still gets the page over BroadcastChannel.
  await second.click('[data-testid="live-wire-button"]');
  const shared = await second.waitForSelector('[data-testid="live-wire-drawer"] [data-feed-id="qa:w1"]', { timeout: 10_000 }).then(() => true).catch(() => false);
  record("AT-29", a >= 1 && b === 0 && shared, `wire requests leader=${a} follower=${b} followerSharedPage=${shared}`);
});

await run(browser, "AT-30", async (page, ctx) => {
  await ctx.grantPermissions(["notifications"], { origin: BASE });
  await ctx.addInitScript(() => {
    window.__permCalls = 0;
    if (typeof Notification !== "undefined") {
      const orig = Notification.requestPermission.bind(Notification);
      Notification.requestPermission = (...args) => {
        window.__permCalls += 1;
        return orig(...args);
      };
    }
  });
  await mockFeed(page, {});
  await page.route("**/api/wire?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wirePage([WIRE_A])) }));
  let onLoad = 0;
  for (const path of ["/", "/news/kr", "/settings/alerts"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1_500);
    onLoad += await page.evaluate(() => window.__permCalls);
  }
  await page.click('[data-testid="alerts-os"] [data-testid="enable-desktop-alerts"]');
  await page.waitForSelector('[data-testid="alerts-os"] >> text=데스크톱 알림 켜짐', { timeout: 5_000 });
  const afterClick = await page.evaluate(() => window.__permCalls);
  record("AT-30", onLoad === 0 && afterClick === 1, `requestPermission calls on load=${onLoad}, after button click=${afterClick}`);
});

await run(browser, "AT-32", async (page) => {
  let n = 0;
  await page.route("**/api/wire?**", async (route) => {
    n += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wirePage(n === 1 ? [WIRE_A] : [WIRE_B, WIRE_A])) });
  });
  // Weekday 11:00 KST so the visible-tab cadence (20 s) applies regardless of the real date.
  await page.clock.install({ time: new Date("2026-09-24T02:00:00Z") });
  await page.goto(`${BASE}/settings/alerts`, { waitUntil: "domcontentloaded" });
  // Quiet hours all day so any OS notification would be suppressed; the badge must still count.
  await page.waitForSelector('[data-testid="alerts-quiet"] input[aria-label="시작"]');
  await page.fill('[data-testid="alerts-quiet"] input[aria-label="시작"]', "00:00");
  await page.fill('[data-testid="alerts-quiet"] input[aria-label="종료"]', "23:59");
  for (let i = 0; i < 40 && n < 1; i++) await page.waitForTimeout(250);
  await page.clock.fastForward(25_000);
  const badge = await page.waitForSelector('[data-testid="live-wire-badge"]', { timeout: 15_000 }).then((el) => el.textContent()).catch(() => null);
  const toastShown = await page.waitForSelector('[data-sonner-toast]:has-text("삼성전자 인수 발표")', { timeout: 3_000 }).then(() => true).catch(() => false);
  await page.screenshot({ path: join(outDir, "at-at-32-toast.png") });
  await page.click('[data-testid="live-wire-button"]');
  const flashRow = await page.waitForSelector('[data-testid="live-wire-drawer"] [data-feed-id="qa:w2"]', { timeout: 5_000 }).then(() => true).catch(() => false);
  const cleared = !(await page.isVisible('[data-testid="live-wire-badge"]'));
  record("AT-32", badge === "1" && flashRow && cleared && toastShown, `badge="${badge}" inAppToast=${toastShown} drawerRow=${flashRow} badgeClearedOnOpen=${cleared} polls=${n}`);
});

await run(browser, "AT-34", async (page) => {
  await page.goto(`${BASE}/settings/alerts`, { waitUntil: "domcontentloaded" });
  const out = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const started = Date.now();
        const es = new EventSource("/api/market-stream?codes=005930&maxMs=5000");
        let opens = 0;
        let reconnectEvents = 0;
        let firstCloseMs = null;
        es.onopen = () => {
          opens += 1;
          if (opens >= 2) {
            es.close();
            resolve({ opens, reconnectEvents, firstCloseMs, totalMs: Date.now() - started });
          }
        };
        es.addEventListener("reconnect", () => {
          reconnectEvents += 1;
          if (firstCloseMs == null) firstCloseMs = Date.now() - started;
        });
        setTimeout(() => {
          es.close();
          resolve({ opens, reconnectEvents, firstCloseMs, totalMs: Date.now() - started });
        }, 15_000);
      }),
  );
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(join(root, "src/routes/api.market-stream.ts"), "utf8");
  const defaults = /MAX_STREAM_MS = 240_000/.test(src) && /RETRY_MS = 3_000/.test(src) && /retry: \$\{RETRY_MS\}/.test(src);
  record("AT-34", out.opens >= 2 && out.reconnectEvents >= 1 && defaults, `opens=${out.opens} reconnectEvents=${out.reconnectEvents} firstClose≈${out.firstCloseMs}ms (maxMs=5000 in QA; default 240 s, retry 3 s)=${defaults}`);
});

// ── P6: pro charts ──────────────────────────────────────────────────────
// synthetic fixture (format sample), not market data
function chartBars(n, seed = 1) {
  const bars = [];
  let c = 70000 * seed;
  let d = Date.parse("2008-01-02T00:00:00Z");
  while (bars.length < n) {
    const day = new Date(d);
    d += 86_400_000;
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    const i = bars.length;
    const o = c;
    c = Math.max(100, Math.round(c * (1 + Math.sin(i / (9 * seed)) * 0.012 + ((i % 7) - 3) * 0.002)));
    bars.push({ date: day.toISOString().slice(0, 10), label: "", open: o, high: Math.max(o, c) * 1.01, low: Math.min(o, c) * 0.99, close: c, volume: 1_000_000 + i * 1000, bullish: c >= o });
  }
  return bars;
}

async function mockCharts(page, n = 300, empty = false) {
  await mockServerFns(page, {
    getChartData: (d) => (empty ? { bars: [], source: "qa-empty" } : { bars: chartBars(n, String(d?.code ?? "").includes("000660") ? 2 : 1), source: "qa-fixture" }),
  });
}

await run(browser, "AT-36", async (page) => {
  await mockCharts(page);
  await page.goto(`${BASE}/stock/005930`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="trading-chart"] [data-testid="chart-ohlc"]', { timeout: 30_000 });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("ked:chart:v2:KR:005930")) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="trading-chart"] [data-testid="chart-ohlc"]', { timeout: 30_000 });
  const canvas = await page.$('[data-testid="trading-chart"] [data-testid="chart-canvas"]');
  const box = await canvas.boundingBox();
  await page.click('[data-testid="trading-chart"]', { position: { x: 5, y: 5 } });
  await page.keyboard.press("h");
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.2);
  await page.keyboard.press("t");
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.25);
  const count = async () => Number(((await page.textContent('[data-testid="trading-chart"] [data-testid="open-objects"]')) ?? "").replace(/\D+/g, "") || 0);
  const afterAdd = await count();
  await page.keyboard.press("Control+z");
  const afterUndo = await count();
  await page.keyboard.press("Control+Shift+z");
  const afterRedo = await count();
  await page.click('[data-testid="trading-chart"] [data-testid="open-objects"]');
  await page.waitForSelector('[data-testid="object-manager"] [data-drawing]');
  const first = await page.$('[data-testid="object-manager"] [data-drawing]');
  await first.$('button[aria-label="잠금"]').then((b) => b?.click());
  await first.$('button[aria-label="숨기기"]').then((b) => b?.click());
  const lockedHidden = (await first.$('button[aria-label="잠금 해제"]')) != null && (await first.$('button[aria-label="표시"]')) != null;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const stored = await page.evaluate(() => localStorage.getItem("ked:chart:v2:KR:005930:day"));
  const saved = stored ? JSON.parse(stored) : null;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="trading-chart"] [data-testid="chart-ohlc"]', { timeout: 30_000 });
  const afterReload = await count();
  const ok = afterAdd === 2 && afterUndo === 1 && afterRedo === 2 && lockedHidden && saved?.drawings?.length === 2 && saved.drawings.some((d) => d.locked && d.hidden) && afterReload === 2;
  record("AT-36", ok, `add=${afterAdd} undo=${afterUndo} redo=${afterRedo} lock+hide=${lockedHidden} persisted=${saved?.drawings?.length} afterReload=${afterReload} key=ked:chart:v2:KR:005930:day`);
});

await run(browser, "AT-38", async (page) => {
  await mockCharts(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${BASE}/chart?symbols=KR:005930,KR:000660,KR:005380,KR:035420&layout=4`, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 4; i++) await page.waitForSelector(`[data-testid="workspace-pane-${i}"] [data-testid="chart-ohlc"]`, { timeout: 30_000 });
  await page.waitForTimeout(800);
  const c0 = await (await page.$('[data-testid="workspace-pane-0"] [data-testid="chart-canvas"]')).boundingBox();
  const lastDate = ((await page.textContent('[data-testid="workspace-pane-3"] [data-testid="chart-ohlc"]')) ?? "").slice(0, 10);
  await page.mouse.move(c0.x + c0.width * 0.35, c0.y + c0.height * 0.4);
  await page.waitForTimeout(400);
  const dates = [];
  for (let i = 0; i < 4; i++) dates.push(((await page.textContent(`[data-testid="workspace-pane-${i}"] [data-testid="chart-ohlc"]`)) ?? "").slice(0, 10));
  const synced = dates.every((d) => d === dates[0]) && dates[0] !== lastDate;
  record("AT-38", synced, `hovered pane 0 → HUD dates ${dates.join(" / ")} (last bar ${lastDate})`);
});

await run(browser, "AT-41", async (page) => {
  await mockCharts(page);
  await page.goto(`${BASE}/stock/005930`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="trading-chart"] [data-testid="chart-ohlc"]', { timeout: 30_000 });
  const [png] = await Promise.all([page.waitForEvent("download"), page.click('[data-testid="trading-chart"] [data-testid="chart-export-png"]')]);
  const [csv] = await Promise.all([page.waitForEvent("download"), page.click('[data-testid="trading-chart"] [data-testid="chart-export-csv"]')]);
  const { readFileSync } = await import("node:fs");
  const text = readFileSync(await csv.path(), "utf8").replace(/^\uFEFF/, "").trim().split("\n");
  const re = (ext) => new RegExp(`^ked-chart-KR-005930-day-\\d{8}-\\d{4}\\.${ext}$`);
  const pngSize = readFileSync(await png.path()).length;
  const ok = re("png").test(png.suggestedFilename()) && re("csv").test(csv.suggestedFilename()) && text[0].startsWith("time,open,high,low,close,volume") && text.length > 20 && pngSize > 1000;
  record("AT-41", ok, `png=${png.suggestedFilename()} (${pngSize}B) csv=${csv.suggestedFilename()} rows=${text.length - 1} header="${text[0].slice(0, 60)}"`);
});

await run(browser, "AT-42", async (page) => {
  await mockCharts(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/stock/005930`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="trading-chart"] [data-testid="chart-ohlc"]', { timeout: 30_000 });
  const inlineHidden = !(await page.isVisible('[data-testid="trading-chart"] [data-testid="chart-type"]'));
  await page.click('[data-testid="trading-chart"] [data-testid="chart-tools-mobile"]');
  await page.waitForSelector('[data-testid="chart-tools-sheet"] [data-testid="chart-type"]', { timeout: 5_000 });
  const btn = await (await page.$('[data-testid="trading-chart"] [data-testid="chart-tools-mobile"]')).boundingBox();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  record("AT-42", inlineHidden && !overflow && btn.width >= 44 && btn.height >= 44, `inline toolbar hidden=${inlineHidden} sheet=ok toolsButton=${btn.width}×${btn.height} pageOverflow=${overflow}`);
});

await run(browser, "AT-43", async (page) => {
  await mockCharts(page);
  await page.goto(`${BASE}/stock/005930`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="valuation-band-chart"] [data-testid="chart-status"]', { timeout: 30_000 });
  const shell = '[data-testid="valuation-band-chart"]';
  await page.waitForFunction((sel) => /출처 /.test(document.querySelector(sel)?.textContent ?? ""), `${shell} [data-testid="chart-status"]`, { timeout: 20_000 }).catch(() => undefined);
  const status = (await page.textContent(`${shell} [data-testid="chart-status"]`)) ?? "";
  const hasFull = await page.isVisible(`${shell} [data-testid="chart-fullscreen"]`);
  const hasHud = await page.isVisible(`${shell} [data-testid="chart-hud"]`);
  const [png] = await Promise.all([page.waitForEvent("download"), page.click(`${shell} [data-testid="chart-export-png"]`)]);
  const ok = /출처 /.test(status) && !/확인 전/.test(status) && /기준/.test(status) && hasFull && hasHud && /^ked-chart-KR-005930-band-per-\d{8}-\d{4}\.png$/.test(png.suggestedFilename());
  record("AT-43", ok, `status="${status.trim().slice(0, 70)}" fullscreen=${hasFull} hud=${hasHud} png=${png.suggestedFilename()}`);
});

await run(browser, "AT-44", async (page) => {
  await mockCharts(page, 0, true);
  await page.goto(`${BASE}/stock/005930`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="trading-chart"] [data-testid="chart-status"]', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  const status = (await page.textContent('[data-testid="trading-chart"] [data-testid="chart-status"]')) ?? "";
  const msg = /표시할 봉이 없습니다/.test((await page.textContent('[data-testid="trading-chart"] [data-testid="chart-empty"]').catch(() => "")) ?? "") && (await page.isVisible('[data-testid="trading-chart"] [data-testid="chart-empty"]'));
  const noExport = !(await page.isVisible('[data-testid="trading-chart"] [data-testid="chart-export-png"]'));
  record("AT-44", /데이터가 없으면 차트를 그리지 않습니다/.test(status) && msg && noExport, `empty data → status="${status.trim().slice(0, 50)}" message=${msg} exportHidden=${noExport}`);
});

await run(browser, "F7.15-perf", async (page) => {
  await mockCharts(page, 5000);
  await page.addInitScript(() => {
    window.__long = [];
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ entryTypes: ["longtask"] });
    } catch {
      /* unsupported */
    }
  });
  await page.goto(`${BASE}/chart?symbols=KR:005930&layout=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="workspace-pane-0"] [data-testid="chart-ohlc"]', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window.__long = []));
  const b = await (await page.$('[data-testid="workspace-pane-0"] [data-testid="chart-canvas"]')).boundingBox();
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.4);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
  await page.mouse.down();
  for (let i = 0; i < 20; i++) await page.mouse.move(b.x + b.width * (0.6 - i * 0.02), b.y + b.height * 0.4);
  await page.mouse.up();
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -400);
  await page.waitForTimeout(500);
  const longs = await page.evaluate(() => window.__long);
  const max = longs.length ? Math.max(...longs) : 0;
  const bars = ((await page.textContent('[data-testid="workspace-pane-0"] [data-testid="chart-status"]')) ?? "").match(/([\d,]+)봉/)?.[1];
  record("F7.15-perf", max <= 200, `5,000 daily bars (${bars}) pan/zoom: long tasks=${longs.length} max=${Math.round(max)}ms`);
});

// synthetic fixture (format sample), not market data
const AI_ON = { enabled: true, provider: "anthropic", dailyCap: 50, usedToday: 0 };
const AI_RESULT = {
  ok: true,
  bullets: [
    { text: "[QA 샘플] 배터리 증설 검토 보도 [1]", cites: [1] },
    { text: "[QA 샘플] 지수 마감 시황과 공장 증설 [1][2]", cites: [1, 2] },
  ],
  rejected: 1,
  items: [
    { id: "qa:kr1", title: "[QA 샘플] LG에너지솔루션 북미 공장 증설 검토", source: "연합뉴스", time: iso(5), url: "https://example.com/qa/kr1" },
    { id: "qa:kr2", title: "[QA 샘플] 코스피 마감 시황", source: "한국경제 증권", time: iso(40), url: "https://example.com/qa/kr2" },
  ],
  cached: false,
  inputTokens: 1234,
  outputTokens: 210,
  provider: "anthropic",
  generatedAt: iso(0),
};

await run(browser, "AT-46", async (page, ctx) => {
  // 1) Server env unset (this dev server has no AI_* vars) → no AI UI at all.
  await mockFeed(page, { KR: KR_PAGE, US: US_PAGE });
  await page.goto(`${BASE}/news/kr`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-feed-id="qa:kr1"]', { timeout: 30_000 });
  await page.waitForTimeout(1_500);
  const offKr = await page.locator('[data-testid="ai-briefing"], [data-testid="ai-briefing-button"]').count();
  await page.goto(`${BASE}/news/us`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-feed-id="qa:us1"]', { timeout: 30_000 });
  await page.waitForTimeout(1_500);
  const offUs = await page.locator('[data-testid="ai-briefing"], [data-testid="ai-translate-button"]').count();

  // 2) Enabled (mocked status + provider result): user click → label + cited links.
  const on = await ctx.newPage();
  await mockFeed(on, { KR: KR_PAGE, US: US_PAGE });
  let calls = 0;
  await mockServerFns(on, {
    getAiStatus: () => AI_ON,
    generateAiBriefing: () => {
      calls += 1;
      return AI_RESULT;
    },
    translateAiHeadlines: () => ({ ok: true, translations: { "qa:us2": "[QA 샘플] 미 국채 금리 하락" }, cached: false }),
  });
  await on.goto(`${BASE}/news/kr`, { waitUntil: "domcontentloaded" });
  await on.waitForSelector('[data-testid="ai-briefing-button"]', { timeout: 30_000 });
  const before = calls;
  for (let i = 0; i < 6 && !(await on.$('[data-testid="ai-label"]')); i++) {
    await on.click('[data-testid="ai-briefing-button"]');
    await on.waitForSelector('[data-testid="ai-label"]', { timeout: 2_000 }).catch(() => undefined);
  }
  const label = ((await on.textContent('[data-testid="ai-label"]')) ?? "").trim();
  const links = await on.$$eval('[data-testid="ai-briefing"] li a', (as) => as.map((a) => a.getAttribute("href")));
  const foot = (await on.textContent('[data-testid="ai-briefing"]')) ?? "";
  await on.goto(`${BASE}/news/us`, { waitUntil: "domcontentloaded" });
  await on.waitForSelector('[data-testid="ai-translate-button"]', { timeout: 30_000 });
  for (let i = 0; i < 6 && !(await on.$('[data-feed-id="qa:us2"] [data-translation]')); i++) {
    await on.click('[data-testid="ai-translate-button"]');
    await on.waitForSelector('[data-feed-id="qa:us2"] [data-translation]', { timeout: 2_000 }).catch(() => undefined);
  }
  const mt = ((await on.textContent('[data-feed-id="qa:us2"]').catch(() => "")) ?? "").includes("기계 번역");
  await on.screenshot({ path: join(outDir, "at-at-46-on.png") }).catch(() => undefined);
  await on.close();
  const ok =
    offKr === 0 &&
    offUs === 0 &&
    before === 0 &&
    calls >= 1 &&
    label === "AI 요약 · 원문 확인 필요" &&
    links.length === 3 &&
    links.every((h) => h === "https://example.com/qa/kr1" || h === "https://example.com/qa/kr2") &&
    /근거 없는 문장 1개 제외/.test(foot) &&
    /토큰 입력 1,234/.test(foot) &&
    mt;
  record("AT-46", ok, `off: kr=${offKr} us=${offUs} · on: noCallBeforeClick=${before === 0} calls=${calls} label="${label}" citeLinks=${links.length} rejectedNote=${/근거 없는/.test(foot)} tokens=${/토큰/.test(foot)} 기계번역=${mt}`);
});

await run(browser, "F10.3", async (page) => {
  await page.route("**/api/wire?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wirePage([WIRE_B, WIRE_A])) }));
  await mockServerFns(page, {
    getResearchBriefing: () => ({ ...EMPTY_BRIEFING, todayCounts: [{ type: "company", label: "기업", count: 12 }, { type: "industry", label: "산업", count: 3 }], latest: [report(0), report(1), report(2)] }),
    getMarketSnapshot: () => ({
      rows: [
        { id: "spx", symbol: "^GSPC", label: "S&P 500", price: 5000.5, change: 10, changePct: 0.2, currency: "USD", asOf: iso(30), delayMinutes: 15, source: "Yahoo Finance" },
        { id: "usdkrw", symbol: "KRW=X", label: "USD/KRW", price: 1350.1, change: -2, changePct: -0.15, currency: "KRW", asOf: iso(30), delayMinutes: 15, source: "Yahoo Finance" },
      ],
      fetchedAt: iso(0),
    }),
    getRoboticsUniverse: () => UNIVERSE_MOCK,
  });
  const t0 = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="dash-brief-cards"]', { timeout: 30_000 });
  const wire = await page.waitForSelector('[data-testid="dash-wire"] a[href="https://example.com/qa/w2"]', { timeout: 15_000 }).then(() => true).catch(() => false);
  await page.waitForSelector('[data-testid="dash-research"] li', { timeout: 15_000 }).catch(() => undefined);
  const research = await page.$$eval('[data-testid="dash-research"] li', (els) => els.length);
  const counts = ((await page.textContent('[data-testid="dash-research"]')) ?? "").includes("기업 12");
  const us = ((await page.textContent('[data-testid="dash-us"]')) ?? "").includes("S&P 500");
  await page.waitForFunction(() => document.querySelector('[data-testid="dash-robotics"]')?.textContent?.includes("레인보우로보틱스"), null, { timeout: 15_000 }).catch(() => undefined);
  const robo = (await page.textContent('[data-testid="dash-robotics"]')) ?? "";
  const ms = Date.now() - t0;
  record("F10.3", wire && research === 3 && counts && us && /KR 바스켓 \(2\) 1D/.test(robo) && robo.includes("+0.50%"), `wireTop=${wire} research3=${research} counts=${counts} usSnapshot=${us} robotics="${robo.replace(/\s+/g, " ").slice(0, 80)}" (${ms}ms)`);
});

await browser.close();
writeFileSync(join(outDir, "acceptance.json"), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
process.exit(results.every((r) => r.ok) ? 0 : 1);
