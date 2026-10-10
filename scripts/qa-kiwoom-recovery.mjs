#!/usr/bin/env node
/** Isolated production-browser recovery: synthetic broker -> shared fixture DB
 * -> collector service -> real React Query polling -> actual chart canvases.
 * Never broker network, operational database, runtime fixture flags or secrets. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { chromium } from 'playwright';
import { fromJSON, toCrossJSONAsync } from 'seroval';
import { readKiwoomConfig } from '../src/server/kiwoom-config.ts';
import { createKiwoomStore } from '../src/server/kiwoom-store.ts';
import { createKiwoomClient } from '../src/server/kiwoom-client.ts';
import { collectKiwoomMetric } from '../src/server/kiwoom-flow.ts';
import { createChartFlowService } from '../src/server/chart-flow.ts';
import { FLOW_METRICS, alignChartFlow } from '../src/lib/charts/hts-flow.ts';

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const base = option('--base', 'http://127.0.0.1:8081');
const output = resolve(option('--out', '.qa/kiwoom-recovery'));
let entry = option('--server-entry');
if (!entry) {
  const config = await readFile('.nitrorc', 'utf8').catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return '';
  });
  entry = resolve(config.match(/^\s*output\.dir\s*=\s*(.*?)\s*$/m)?.[1] || '.vercel/output', 'functions/__server.func/index.mjs');
}
const compiled = await readFile(entry, 'utf8');
const names = Object.fromEntries([...compiled.matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName: "([^"]+)"/g)]
  .map(match => [match[1], match[2].replace(/_createServerFn_handler$/, '')]));
assert(Object.values(names).includes('getChartFlow'), 'Production flow RPC map missing');
function functionName(url) {
  const id = new URL(url).pathname.split('/_serverFn/')[1] ?? '';
  if (names[id]) return names[id];
  try {
    return JSON.parse(Buffer.from(decodeURIComponent(id), 'base64url').toString()).export?.replace(/_createServerFn_handler$/, '') ?? '';
  } catch { return ''; }
}
await mkdir(output, { recursive: true });
const source = 'QA SYNTHETIC — NOT MARKET DATA · 실데이터 아님';
const symbols = {
  '018260': { nameKo: 'QA SYNTHETIC 삼성에스디에스', market: 'KOSPI', credit: 3.42, foreign: 51.72, trust: -85000 },
  '131970': { nameKo: 'QA SYNTHETIC KOSDAQ 비편입 종목', market: 'KOSDAQ', credit: 7.25, foreign: 15.6, trust: -12000 },
};
const bars = [];
for (let day = 0; bars.length < 260; day++) {
  const date = new Date(Date.UTC(2025, 0, 2) + day * 86400000);
  if ([0, 6].includes(date.getUTCDay())) continue;
  const index = bars.length, close = 100000 + index * 80 + Math.sin(index / 9) * 1800;
  bars.push({ date: date.toISOString().slice(0, 10), open: close - Math.cos(index / 5) * 180,
    high: close + 350, low: close - 400, close, volume: 100000 + index * 2300 });
}
const views = [{ id: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
  { id: 'mobile', width: 390, height: 844, deviceScaleFactor: 2 }]
  .filter(view => !args.includes('--viewport') || view.id === option('--viewport'));
const themes = ['light', 'dark'].filter(theme => !args.includes('--theme') || theme === option('--theme'));
assert(views.length && themes.length, 'Choose a supported viewport and theme');
const format = value => value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
const results = [];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const theme of themes) for (const view of views) {
    const pg = new PGlite();
    await pg.waitReady;
    for (const migration of ['0002_kiwoom_flow.sql', '0003_kiwoom_collection_targets.sql', '0004_kiwoom_collector_runtime.sql'])
      await pg.exec(await readFile(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
    const store = createKiwoomStore({ query: async (sql, params) => (await pg.query(sql, params)).rows });
    const webConfig = readKiwoomConfig({ KIWOOM_FLOW_ENABLED: 'true', KIWOOM_FLOW_MODE: 'collector',
      KIWOOM_ENV: 'real', VITE_AUTH_ENABLED: 'false', DATABASE_URL: 'postgresql://qa.invalid/synthetic',
      KIWOOM_DATA_SCOPE_ID: `qa-isolated-recovery-${theme}-${view.id}` });
    assert(!webConfig.appKey && !webConfig.appSecret, 'Collector web fixture unexpectedly has broker credentials');
    const counters = { webBrokerConstructions: 0, webEgressChecks: 0, syntheticBrokerPages: 0, brokerNetworkCalls: 0 };
    const service = createChartFlowService({ config: () => webConfig, store: async () => store,
      authorizeTarget: async request => Object.hasOwn(symbols, request.code) && request.market === 'KR' && request.instrument === 'stock',
      client: () => { counters.webBrokerConstructions++; throw Error('Collector constructed broker client'); },
      checkEgress: async () => { counters.webEgressChecks++; throw Error('Collector attempted egress check'); } });
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height },
      deviceScaleFactor: view.deviceScaleFactor, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const item = { theme, viewport: view.id, dpr: view.deviceScaleFactor, synthetic: true,
      success: false, checks: [], screenshots: [], counters };
    results.push(item);
    const errors = [], unexpected = [], staticFixtures = [], calls = [], flowResponses = [], latestRequests = new Map(), securityResults = new Map();
    let activeCheck = '';
    let documents = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) documents++; });
    await page.addInitScript(mode => {
      localStorage.setItem('korea-equity-cc', JSON.stringify({ state: { theme: mode, watchlist: [], usWatchlist: [] }, version: 4 }));
      window.__qaCanvasText = [];
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function(text, ...rest) {
        window.__qaCanvasText.push({ text: String(text), detached: !this.canvas.isConnected });
        if (window.__qaCanvasText.length > 30000) window.__qaCanvasText.splice(0, 10000);
        return original.call(this, text, ...rest);
      };
    }, theme);
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) {
        // Existing shell fonts/extensions are deterministic empty assets here.
        // Exact paths only: other external requests, especially APIs, still fail.
        const stylesheet = (url.hostname === 'cdn.jsdelivr.net' && url.pathname === '/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css')
          || (url.hostname === 'fonts.googleapis.com' && url.pathname === '/css2');
        const extension = url.hostname === 'grok.com' && url.pathname === '/grok-app-builder/extensions.js';
        if (route.request().method() === 'GET' && ((stylesheet && route.request().resourceType() === 'stylesheet')
          || (extension && route.request().resourceType() === 'script'))) {
          staticFixtures.push(`${url.hostname}${url.pathname}`);
          return route.fulfill({ status: 200, contentType: stylesheet ? 'text/css' : 'application/javascript', body: '/* isolated QA static fixture */' });
        }
        unexpected.push(`external:${url.hostname}${url.pathname}`); return route.abort();
      }
      if (!url.pathname.startsWith('/_serverFn/') && !url.pathname.startsWith('/api/')) return route.continue();
      if (url.pathname.startsWith('/api/market-stream')) return route.fulfill({ status: 200, contentType: 'text/event-stream',
        body: 'event: status\ndata: {"enabled":false,"connected":false,"provider":"QA SYNTHETIC"}\n\n' });
      if (url.pathname.startsWith('/api/wire') || url.pathname.startsWith('/api/feed')) return route.fulfill({ status: 200,
        contentType: 'application/json', body: JSON.stringify({ items: [], sources: [], nextCursor: null,
          generatedAt: new Date().toISOString(), fetchedAt: new Date().toISOString(), errors: [], partial: false }) });
      if (!url.pathname.startsWith('/_serverFn/')) { unexpected.push(`REST:${url.pathname}`); return route.abort(); }
      const name = functionName(url);
      if (!name) { unexpected.push('unknown compiled RPC'); return route.abort(); }
      const raw = route.request().method() === 'POST' ? route.request().postData() : url.searchParams.get('payload');
      const payload = raw ? fromJSON(JSON.parse(raw)) : {};
      const data = payload.data ?? payload;
      calls.push({ name, code: data.code, market: data.market });
      const stamp = new Date().toISOString();
      let value;
      if (name === 'getChartFlow') {
        assert(Object.hasOwn(symbols, data.code), 'Unexpected flow symbol');
        assert.equal(data.market, 'KR');
        latestRequests.set(data.code, data);
        value = await service(data, undefined, null);
        for (const metric of FLOW_METRICS) value[metric].source = `키움증권 · ${source}`;
        flowResponses.push(value);
      } else if (name === 'getChartData') value = { bars, source: `QA SYNTHETIC OHLCV · ${source}` };
      else if (name === 'getChartSecurity') {
        value = { code: data.code, market: 'KR', exchange: symbols[data.code]?.market ?? 'KOSPI',
          instrument: 'stock', currency: 'KRW', quantityUnit: '주', source };
        securityResults.set(data.code, value);
      }
      else if (name === 'getStockBundle') value = { meta: { code: data.code, ...symbols[data.code], sectorId: 'semiconductors' },
        quote: null, basic: null, flow: { days: [], source }, research: [], researchPack: { company: [], industry: [], market: [], economy: [] },
        news: [], disclosures: [], disclosureMeta: { kind: { available: false, message: source }, dartCount: 0, koscomCount: 0 }, fetchedAt: stamp };
      else if (name === 'getMarketQuotes' || name === 'getQuotesByCodes') value = { quotes: [], source, fetchedAt: stamp };
      else if (name === 'getMarketIndices') value = { indices: [], source, fetchedAt: stamp };
      else if (name === 'getMarketSnapshot') value = { rows: [], errors: [], fetchedAt: stamp };
      else if (name === 'getValuationSeries') value = { rows: [], errors: [], source };
      else if (name === 'getSecuritySearch') {
        const code = data.q.trim();
        const hits = Object.hasOwn(symbols, code) ? [{ code, ...symbols[code], region: 'KR', isEtf: false,
          sectorId: 'semiconductors', source }] : [];
        value = { q: data.q, hits, status: 'ready', total: hits.length, offset: 0,
          limit: 40, nextOffset: null, hasMore: false, providers: [], fetchedAt: stamp, source };
      }
      else { unexpected.push(`RPC:${name}`); return route.abort(); }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'x-tss-serialized': 'true' },
        body: JSON.stringify(await toCrossJSONAsync({ result: value, error: undefined, context: {} }, { refs: new Map() })) });
    });
    const details = () => page.getByTestId('hts-data-details').first();
    const metricRow = id => details().locator('tbody tr').nth({ credit: 2, foreign: 3, investmentTrust: 4 }[id]);
    const check = async (name, action) => { activeCheck = name; const detail = await action(); item.checks.push({ name, success: true, detail }); };
    const snapshot = async name => {
      await page.evaluate(() => {
        document.getElementById('qa-fixture-banner')?.remove();
        const banner = document.createElement('div'); banner.id = 'qa-fixture-banner';
        banner.textContent = 'QA SYNTHETIC · 테스트 데이터 · 실데이터 검증 아님';
        Object.assign(banner.style, { position: 'fixed', bottom: '0', left: '0', right: '0', zIndex: '99999',
          background: '#553500', color: '#fff', fontSize: '12px', padding: '5px', pointerEvents: 'none' });
        document.body.append(banner);
      });
      const path = join(output, `${name}-${theme}-${view.id}.png`);
      await page.screenshot({ path, fullPage: true });
      item.screenshots.push(path);
      if (name.endsWith('-queued') || name.endsWith('-recovered')) {
        // Native captions already identify the synthetic source. Do not let
        // the full-page QA banner cover a compact pane's caption or real curve.
        await page.evaluate(() => document.getElementById('qa-fixture-banner')?.remove());
        const chartPath = join(output, `${name}-chart-${theme}-${view.id}.png`);
        await page.getByTestId('trading-chart').first().screenshot({ path: chartPath });
        item.screenshots.push(chartPath);
        if (name.endsWith('-recovered')) for (const metric of FLOW_METRICS) {
          const panePath = join(output, `${name}-${metric}-${theme}-${view.id}.png`);
          await page.locator(`[data-hts-pane="${metric}"]`).first().screenshot({ path: panePath });
          item.screenshots.push(panePath);
        }
      }
    };
    const coloredPixels = async (includeReserved = false) => page.evaluate(full => {
      const colors = { credit: [231, 177, 87], foreign: [56, 189, 248], investmentTrust: [167, 139, 250] };
      return Object.fromEntries(Object.entries(colors).map(([id, rgb]) => {
        let count = 0;
        for (const canvas of document.querySelector(`[data-hts-pane="${id}"]`)?.querySelectorAll('canvas') ?? []) {
          const rect = canvas.getBoundingClientRect();
          if (rect.width < 120 || rect.height < 45) continue;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          const ratio = canvas.width / rect.width, pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          // Exclude legends, axes and boundaries; grid/text alone cannot satisfy a colored curve.
          for (let y = Math.ceil((full ? 2 : 35) * ratio); y < canvas.height - Math.ceil((full ? 2 : 7) * ratio); y++)
            for (let x = Math.ceil(12 * ratio); x < canvas.width - Math.ceil((full ? 4 : 80) * ratio); x++) {
              const index = (y * canvas.width + x) * 4;
              if (pixels[index + 3] > 200 && rgb.every((value, component) => Math.abs(value - pixels[index + component]) <= 10)) count++;
            }
        }
        return [id, count];
      }));
    }, includeReserved);
    const openSettings = async () => {
      const trigger = page.getByTestId('open-hts-settings').first();
      if (!await trigger.isVisible()) await page.getByTestId('chart-tools-mobile').first().click();
      await trigger.click();
      return page.getByTestId('hts-settings');
    };
    const closeSettings = async () => {
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].every(element => !element.getClientRects().length));
      await page.mouse.move(4, 4);
    };
    async function collectFixture(code) {
      const request = latestRequests.get(code);
      assert(request, 'Chart has not requested flow');
      const identity = { scopeId: webConfig.dataScopeId, environment: 'real', request };
      const client = createKiwoomClient({ ...webConfig, mode: 'direct', appKey: 'QA_SYNTHETIC_KEY',
        appSecret: 'QA_SYNTHETIC_SECRET' }, { ...store, admit: async () => {} }, {
        fetch: async (url, init) => {
          const headers = new Headers(init?.headers);
          if (String(url).endsWith('/oauth2/token')) return new Response(JSON.stringify({ return_code: 0,
            token: 'QA_SYNTHETIC_TOKEN', token_type: 'bearer', expires_dt: '20300101090000' }));
          const api = headers.get('api-id');
          assert(['ka10013', 'ka10008', 'ka10059'].includes(api));
          const body = JSON.parse(init.body);
          assert.equal(body.stk_cd, code);
          counters.syntheticBrokerPages++;
          const continued = Boolean(headers.get('next-key'));
          if (continued) assert.equal(headers.get('next-key'), `QA_CURSOR_${api}`);
          const selected = continued ? bars.slice(0, 90) : bars.slice(90);
          const rows = selected.map(bar => {
            const index = bars.findIndex(item => item.date === bar.date);
            // Oscillate around each symbol's own ratio. An artificial 45%→15%
            // last-bar jump squeezed the valid historical curve above the
            // caption-excluding pixel probe; exact endpoint values stay fixed.
            return { dt: bar.date.replaceAll('-', ''), remn_rt: String(index === 259 ? symbols[code].credit : symbols[code].credit - .5 + index % 11 / 10),
              remn: '123,456', wght: String(index === 259 ? symbols[code].foreign : symbols[code].foreign - 1.8 + index % 37 / 10), poss_stkcnt: '1,234,567',
              invtrt: index === 60 ? '' : index === 61 || index === 258 ? '0' : index === 259 ? String(symbols[code].trust)
                : index % 2 ? '-85,000' : '+120,000' };
          }).reverse();
          return new Response(JSON.stringify({ return_code: 0,
            [api === 'ka10013' ? 'crd_trde_trend' : api === 'ka10008' ? 'stk_frgnr' : 'stk_invsr_orgn']: rows }),
          { headers: continued ? { 'cont-yn': 'N' } : { 'cont-yn': 'Y', 'next-key': `QA_CURSOR_${api}` } });
        },
      });
      for (const metric of FLOW_METRICS) {
        const job = await collectKiwoomMetric(store, client, identity, metric, { maxPages: 3, budgetMs: 30000, resume: true });
        assert.equal(job.pages, 2, 'Fixture must exercise official continuation');
        const rows = await store.read(identity, metric);
        assert.equal(rows.length, bars.length);
        if (metric === 'investmentTrust') {
          assert.equal(rows[60].value, null); assert.equal(rows[61].value, 0);
          assert.equal(rows.at(-1).value, symbols[code].trust);
        }
      }
      return request;
    }
    async function recover(code, viaSearch = false) {
      if (viaSearch) {
        await page.getByTestId('security-search-input').fill(code);
        await page.locator(`[role="option"][data-security-key="KR:${code}"]`).click();
        await page.waitForURL(url => url.pathname === `/stock/${code}`);
      } else await page.goto(`${base}/stock/${code}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('[data-testid="hts-data-details"]')?.textContent.includes('키움 수집 예약됨'));
      assert(latestRequests.has(code));
      assert.equal(latestRequests.get(code).market, 'KR');
      assert.equal(latestRequests.get(code).flowScope, 'KRX');
      // A validated non-seed stock uses the shared KRX exchange descriptor.
      // Its listing market is separate and must still reach the price request.
      assert.equal(latestRequests.get(code).exchange, code === '131970' ? 'KRX' : symbols[code].market);
      assert(calls.some(call => call.name === 'getChartData' && call.code === code && call.market === symbols[code].market), 'Price chart lost the listing market');
      if (viaSearch) {
        assert.equal(securityResults.get(code)?.exchange, symbols[code].market, 'Non-seed listing metadata was not resolved');
        assert(calls.some(call => call.name === 'getChartSecurity' && call.code === code));
      }
      const targets = (await pg.query(`select code,instrument,market_scope from kiwoom_collection_targets
        where scope_id=$1 and environment='real' and code=$2`, [webConfig.dataScopeId, code])).rows;
      assert.deepEqual(targets, [{ code, instrument: 'stock', market_scope: 'KRX' }], 'The current stock must have exactly its own deduplicated collection target');
      for (const metric of FLOW_METRICS) assert.equal((await metricRow(metric).locator('td').first().textContent()).trim().startsWith('—'), true);
      const queuedPixels = await coloredPixels();
      assert(Object.values(queuedPixels).every(value => value === 0), 'Queued chart fabricated flow curves');
      const beforeQueries = calls.filter(call => call.name === 'getChartFlow' && call.code === code).length;
      const beforeDocuments = documents;
      await snapshot(`${code}-queued`);
      const collectedAt = Date.now();
      const request = await collectFixture(code);
      await page.waitForFunction(expected => {
        const rows = document.querySelector('[data-testid="hts-data-details"]')?.querySelectorAll('tbody tr');
        return rows?.[2]?.querySelector('td')?.textContent.includes(expected.credit) && rows?.[3]?.querySelector('td')?.textContent.includes(expected.foreign);
      }, { credit: format(symbols[code].credit), foreign: format(symbols[code].foreign) }, { timeout: 23000 });
      assert.equal(documents, beforeDocuments, 'Recovery reloaded/navigated the document');
      const afterQueries = calls.filter(call => call.name === 'getChartFlow' && call.code === code).length;
      assert(afterQueries > beforeQueries, 'Stored data appeared without a real flow re-read');
      const recovered = flowResponses.filter(response => response.request.code === code).at(-1);
      for (const metric of FLOW_METRICS) assert(recovered[metric].observations.some(row => row.value !== null));
      const beforePaint = await coloredPixels();
      // React's DOM commit precedes Lightweight Charts' scheduled canvas paint.
      // Wait for actual paint frames and probe at most three seconds, not a sleep.
      const paintStarted = Date.now();
      let curves = beforePaint;
      do {
        await page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
        curves = await coloredPixels();
      } while (Object.values(curves).some(value => value <= 8) && Date.now() - paintStarted < 3000);
      const fullAreaCounts = await coloredPixels(true);
      item.renderProbes ??= [];
      item.renderProbes.push({ code, beforePaint, curves, fullAreaCounts, paintWaitMs: Date.now() - paintStarted });
      assert(Object.values(curves).every(value => value > 8), 'A recovered pane is missing its plotted flow curve');
      await snapshot(`${code}-recovered`);
      return { code, request, listingMarket: symbols[code].market, exchangeDescriptor: request.exchange,
        scope: request.flowScope, targets, elapsedMs: Date.now() - collectedAt, beforeQueries, afterQueries, queuedPixels, curves };
    }
    try {
      await check('018260 automatically recovers queued collector data without keys, broker call or document reload', () => recover('018260'));
      await check('Daily net selling and genuine zero survive provider parsing, storage and displayed quantity', async () => {
        const settings = await openSettings();
        await settings.getByLabel(/투신 표시 방식/).selectOption('daily');
        await closeSettings();
        await page.waitForFunction(() => document.querySelector('[data-testid="hts-data-details"]')?.textContent.includes('-85,000 주'));
        assert.match(await metricRow('investmentTrust').locator('td').first().textContent(), /-85,000/);
        const request = latestRequests.get('018260');
        const rows = await store.read({ scopeId: webConfig.dataScopeId, environment: 'real', request }, 'investmentTrust');
        assert.equal(rows[61].value, 0); assert.equal(rows.at(-2).value, 0); assert.equal(rows.at(-1).value, -85000);
        await snapshot('018260-daily-signed');
        return { negative: -85000, zero: rows.at(-2).value, unit: '주' };
      });
      await check('PNG export includes all actual flow captions and signed quantity', async () => {
        const trigger = page.getByTestId('chart-export-png').first();
        if (!await trigger.isVisible()) await page.getByTestId('chart-tools-mobile').first().click();
        await page.evaluate(() => { window.__qaCanvasText = []; });
        const download = page.waitForEvent('download');
        await trigger.click();
        const image = await download;
        const path = join(output, `018260-export-${theme}-${view.id}.png`);
        await image.saveAs(path);
        const bytes = await readFile(path);
        assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
        const texts = await page.evaluate(() => window.__qaCanvasText.filter(item => item.detached).map(item => item.text));
        for (const phrase of ['신용잔고율', '외국인보유비율', '투신 일별 순매수', '3.42', '51.72', '-85,000', 'QA SYNTHETIC'])
          assert(texts.some(text => text.includes(phrase)), `Export omitted caption ${phrase}`);
        item.screenshots.push(path);
        return { path, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), signedCaption: true };
      });
      await check('Fixed cumulative leaves post-gap quantities null and available cumulative exposes its true origin', async () => {
        let settings = await openSettings();
        await settings.getByLabel(/투신 표시 방식/).selectOption('cumulative');
        await settings.getByLabel('투신 누적 기준일', { exact: true }).fill(bars[0].date);
        await closeSettings();
        await page.waitForFunction(() => {
          const row = document.querySelector('[data-testid="hts-data-details"]')?.querySelectorAll('tbody tr')[4];
          return row?.querySelector('th')?.textContent.includes('누적순매수') && row?.querySelector('td')?.textContent.trim().startsWith('—');
        });
        const response = flowResponses.filter(value => value.request.code === '018260').at(-1);
        const fixed = alignChartFlow(response, { dates: bars.map(bar => bar.date), expectedDailyDates: bars.map(bar => bar.date),
          interval: 'day', cumulativeStart: bars[0].date, investmentTrustMode: 'cumulative' });
        assert.equal(fixed.investmentTrust.points.at(-1).value, null);
        await snapshot('018260-fixed-gap');
        settings = await openSettings();
        await settings.getByLabel(/투신 표시 방식/).selectOption('available-cumulative');
        await closeSettings();
        const available = alignChartFlow(response, { dates: bars.map(bar => bar.date), expectedDailyDates: bars.map(bar => bar.date),
          interval: 'day', cumulativeStart: bars[0].date, investmentTrustMode: 'available-cumulative' });
        const latest = available.investmentTrust.points.at(-1).value;
        assert.notEqual(latest, null);
        await page.waitForFunction(expected => document.querySelector('[data-testid="hts-data-details"]')?.textContent.includes(expected), format(latest));
        assert.match(await details().locator('summary').textContent(), new RegExp(`가용 시작 ${bars[61].date}부터 누적`));
        return { fixedLatest: null, availableLatest: latest, trueOrigin: bars[61].date };
      });
      await check('SPA selection of a non-seed KOSDAQ stock has an independent queued target and its own recovered percentages', () => recover('131970', true));
      await check('Bounded explicit flow refresh re-reads the existing collector database without broker access', async () => {
        const before = calls.filter(call => call.name === 'getChartFlow' && call.code === '131970').length;
        const response = page.waitForResponse(value => functionName(value.url()) === 'getChartFlow');
        await page.getByTestId('hts-flow-refresh').click();
        await response;
        await page.waitForFunction(() => document.querySelector('[data-testid="hts-flow-controls"]')?.getAttribute('aria-busy') === 'false');
        assert(calls.filter(call => call.name === 'getChartFlow' && call.code === '131970').length > before);
        const identity = { scopeId: webConfig.dataScopeId, environment: 'real', request: latestRequests.get('131970') };
        assert.equal((await store.read({ ...identity, environment: 'mock' }, 'credit')).length, 0);
        assert.equal((await store.read({ ...identity, request: { ...identity.request, flowScope: 'NXT' } }, 'credit')).length, 0);
        assert.equal((await store.read({ ...identity, scopeId: 'qa-unrelated-scope' }, 'credit')).length, 0);
        return { refresh: true, mockIsolated: true, marketScopeIsolated: true, dataScopeIsolated: true };
      });
      assert.deepEqual(unexpected, [], 'A background request escaped the explicit fixture contract');
      assert.deepEqual(errors, [], 'Production application runtime errors');
      assert.equal(counters.webBrokerConstructions, 0); assert.equal(counters.webEgressChecks, 0);
      assert.equal(counters.brokerNetworkCalls, 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Page has horizontal overflow');
      item.success = true;
      console.log(JSON.stringify({ theme, viewport: view.id, success: true, checks: item.checks.length }));
    } catch (error) {
      item.error = String(error).slice(0, 1500);
      item.failedCheck = activeCheck;
      item.errors = errors; item.unexpectedRequests = unexpected;
      item.tableAtFailure = await details().textContent().catch(() => 'No chart detail table');
      await snapshot('failed').catch(() => {});
      console.log(JSON.stringify({ theme, viewport: view.id, success: false, error: item.error, unexpected }));
    } finally {
      item.calls = calls;
      item.staticFixtures = staticFixtures;
      await context.close();
      await pg.close();
      await writeFile(join(output, 'verification.json'), JSON.stringify({ base, synthetic: true,
        operationalDatabaseTouched: false, brokerNetworkCalls: 0, scope: 'isolated shared PGlite + synthetic official API + actual production UI',
        fixtureCalibration: 'Historical percentage fixtures oscillate around each symbol’s exact independent endpoint, keeping real colored curves inside the caption/axis-excluding probe. Threshold remains >8 pixels; full-plot diagnostics retain counts outside the probe.',
        exchangeContract: 'Validated non-seed stocks use KRX flow descriptor; resolved KOSDAQ listing must independently reach the price request and metadata. Collection partitions remain code + real/mock + stock + KRX/NXT/SOR + data scope.', results }, null, 2));
    }
  }
} finally { await browser.close(); }
process.exitCode = results.every(result => result.success) ? 0 : 1;
