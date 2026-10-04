#!/usr/bin/env node
/** Browser-only synthetic transport; never shipped service data or a production fallback.
 * npm run qa:sma -- --base <local production preview> --out /workspace/screenshots/sma
 * --server-entry <compiled Nitro entry> --cases stock,etf,us,export --viewports desktop,mobile
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { emptyValuationPack, statsOf } from '../src/lib/valuation-series.ts';

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const list = (key, fallback) => option(key, fallback).split(',');
const base = option('--base', 'http://127.0.0.1:8183');
const out = resolve(option('--out', '/workspace/screenshots/standard-sma'));
const entry = option('--server-entry', resolve(process.env.NITRO_OUTPUT_DIR ?? '.vercel/output', 'functions/__server.func/index.mjs'));
const compiled = readFileSync(entry, 'utf8');
const names = Object.fromEntries([...compiled.matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName: "([^"]+)"/g)].map(match => [match[1], match[2].replace(/_createServerFn_handler$/, '')]));
mkdirSync(out, { recursive: true });
const periods = [5, 20, 60, 120, 200];
const colors = { light: ['#B8860B', '#A23B8F', '#00796B', '#1565C0', '#C62828'], dark: ['#FFD54F', '#E07BCB', '#35D0A0', '#42A5F5', '#FF5C5C'] };
const cases = [
  { id: 'stock', path: '/stock/005930', code: '005930', shell: 'trading-chart' },
  { id: 'etf', path: '/etfs/069500', code: '069500', shell: 'trading-chart' },
  { id: 'us', path: '/us/NVDA', code: 'NVDA', shell: 'trading-chart' },
  { id: 'workspace', path: '/chart?symbols=KR%3A005930%2CKR%3A069500&layout=2', code: '005930', shell: 'workspace-pane-0' },
  { id: 'export', path: '/export-desk', code: 'EXPORT', shell: 'export-dual-chart' },
].filter(item => list('--cases', 'stock,etf,us,workspace,export').includes(item.id));
const viewports = [ { id: 'desktop', width: 1440, height: 900 }, { id: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true } ].filter(v => list('--viewports', 'desktop,mobile').includes(v.id));
function bars(code, interval = 'day', size = 5) {
  const us = code === 'NVDA';
  return Array.from({ length: 500 }, (_, i) => {
    const date = interval === 'minute' ? new Date(Date.UTC(2026, 8, 1, 1) + i * size * 60000).toISOString().slice(0, 16).replace('T', ' ')
      : interval === 'month' ? new Date(Date.UTC(1984, i, 1)).toISOString().slice(0, 10)
      : new Date(Date.UTC(interval === 'week' ? 2016 : 2025, 0, 1) + i * (interval === 'week' ? 7 : 1) * 86400000).toISOString().slice(0, 10);
    const close = (us ? 80 : 30000) + i * (us ? 0.12 : 24) + Math.sin(i / 13) * (us ? 2 : 200);
    return { date, label: date, close, open: close - (us ? 0.1 : 24), high: close + (us ? 0.2 : 48), low: close - (us ? 0.2 : 48), volume: 100000 + i * 10, bullish: true };
  });
}
const months = Array.from({ length: 300 }, (_, i) => new Date(Date.UTC(2001, i, 1)).toISOString().slice(0, 7));
function valuation(code) {
  const pack = emptyValuationPack(code, 'QA SYNTHETIC — NOT LIVE MARKET DATA');
  const prices = bars(code, 'week');
  pack.name = 'QA SYNTHETIC'; pack.currency = code === 'NVDA' ? 'USD' : 'KRW';
  pack.source = 'QA SYNTHETIC'; pack.window = { from: prices[0].date, to: prices.at(-1).date };
  pack.drivers = prices.map((p, i) => ({ date: p.date, price: p.close, eps: p.close / (15 + i / 50), shares: 1e8, netDebtEok: 10000, ebitdaEok: 1000, salesEok: 5000 }));
  for (const key of ['per', 'forwardPer', 'evEbitda', 'evSales']) {
    const points = prices.map((p, i) => ({ date: p.date, value: 15 + i / 50, percentile: 50 }));
    pack[key].points = points; pack[key].stats = statsOf(points.map(p => p.value));
  }
  return pack;
}
async function fixtures(page, calls) {
  const { fromJSON, toCrossJSONAsync } = await import('seroval');
  await page.route('**/_serverFn/**', async route => {
    const id = new URL(route.request().url()).pathname.split('/_serverFn/')[1];
    const name = names[id];
    let payload = {};
    const raw = route.request().method() === 'POST' ? route.request().postData() : new URL(route.request().url()).searchParams.get('payload');
    if (raw) { try { payload = fromJSON(JSON.parse(raw)); } catch { /* malformed calls fail normal UI checks */ } }
    const data = payload.data ?? payload;
    const code = data.code ?? '005930';
    let result;
    if (name === 'getChartData') {
      const all = bars(code, data.interval, data.minuteSize);
      const long = ['5y', '10y', 'max', '60d', '7d'].includes(data.range) || (data.interval === 'minute' && data.range === '2y');
      result = { bars: long ? all : all.slice(-60), source: `yahoo-QA-SYNTHETIC-${code}`, events: { dividends: [], splits: [] } };
    } else if (name === 'getChartFlow') {
      const metric = { status: 'not-configured', health: 'DISABLED', source: '키움증권', points: [], observations: [], message: 'QA SYNTHETIC — live API not invoked' };
      result = { code, provider: 'kiwoom', environment: 'mock', credit: { ...metric }, foreign: { ...metric }, investmentTrust: { ...metric }, fetchedAt: null };
    } else if (['getChartSecurity', 'getUsChartSecurity'].includes(name)) {
      result = { code, market: name === 'getUsChartSecurity' ? 'US' : 'KR', exchange: name === 'getUsChartSecurity' ? 'NASDAQ' : 'KOSPI', instrument: code === '069500' ? 'etf' : 'stock', currency: name === 'getUsChartSecurity' ? 'USD' : 'KRW', quantityUnit: '주', source: 'QA SYNTHETIC' };
    } else if (name === 'getStockBundle') {
      result = { meta: { code, nameKo: 'QA SYNTHETIC', market: 'KOSPI', sectorId: 'electronics' }, quote: null, basic: null, flow: { days: bars(code).map((row, i) => ({ date: row.date, close: row.close, foreign: i - 100, institution: 100 - i / 2, individual: -i / 2 })), source: 'QA SYNTHETIC' }, research: [], researchPack: { company: [], industry: [], market: [], economy: [] }, news: [], disclosures: [], disclosureMeta: { dartCount: 0, koscomCount: 0 }, fetchedAt: '2026-10-04T00:00:00Z' };
    } else if (name === 'getEtfBundle') {
      result = { etf: { code, nameKo: 'QA SYNTHETIC ETF', price: 40000, changePct: 0, volume: 100000 }, holdings: [], peerEtfs: [], allocation: [], themeStocks: [], themeLabels: [], descriptionFormatted: { paragraphs: [], bullets: [], plain: '', summary: '' }, issuer: 'QA SYNTHETIC', holdingsAsOf: null, officialCount: 0, weightBasis: 'none', source: 'QA SYNTHETIC' };
    } else if (name === 'getValuationSeries') result = valuation(code);
    else if (name === 'getExportMacro') result = { kospi: months.map((month, i) => ({ date: `${month}-01`, value: 1000 + i * 5 })), fx: months.map(month => ({ date: `${month}-01`, value: 1300 })), spotUsdKrw: 1300, source: 'QA SYNTHETIC', fetchedAt: '2026-10-04T00:00:00Z' };
    else if (name === 'getLiveTradeBundle') result = { exports: [], imports: [], observations: ['TOTAL', 'semiconductors', 'automobiles', 'ships', 'petroleum_products'].flatMap((categoryId, c) => months.map((period, i) => ({ period, categoryId, classification: categoryId === 'TOTAL' ? 'TOTAL' : 'HS', valueUsd: (20 + i / 10) * 1e9 / (c + 1), workingDays: 20, sourceFile: 'QA SYNTHETIC TRANSPORT — NOT LIVE', vintage: 'QA TEST' }))), destinations: { period: '', rows: [], source: 'QA SYNTHETIC' }, news: [], comtradeLatestPeriod: months.at(-1), comtradeMonthsCached: 300, source: { totals: 'QA SYNTHETIC', items: 'QA SYNTHETIC', fetchedAt: '2026-10-04T00:00:00Z' }, notes: ['QA SYNTHETIC — NOT LIVE'] };
    else if (['getStockNews', 'getStockDisclosures'].includes(name)) result = [];
    else return route.continue();
    calls.push({ name, interval: data.interval ?? null, range: data.range ?? null, code });
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'x-tss-serialized': 'true' }, body: JSON.stringify(await toCrossJSONAsync({ result, error: undefined, context: {} }, { refs: new Map() })) });
  });
  await page.route('**/api/feed?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], sources: [], partial: false, nextCursor: null, generatedAt: '2026-10-04T00:00:00Z' }) }));
  await page.route('**/api/market-stream?**', route => route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'event: status\ndata: {"enabled":false,"connected":false,"provider":"QA SYNTHETIC"}\n\n' }));
}
function probe() {
  window.__smaTexts = []; window.__smaStrokes = [];
  let canvasSeq = 0;
  const canvasIds = new WeakMap();
  const idFor = canvas => { if (!canvasIds.has(canvas)) canvasIds.set(canvas, ++canvasSeq); return canvasIds.get(canvas); };
  for (const method of ['clearRect', 'fillRect']) {
    const original = CanvasRenderingContext2D.prototype[method];
    CanvasRenderingContext2D.prototype[method] = function(x, y, width, height) {
      const transform = this.getTransform();
      if (x === 0 && y === 0 && width * transform.a >= this.canvas.width - 1 && height * transform.d >= this.canvas.height - 1) {
        const canvasId = idFor(this.canvas);
        window.__smaTexts = window.__smaTexts.filter(row => row.canvasId !== canvasId);
      }
      return original.apply(this, arguments);
    };
  }
  const text = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function(value, x, y) {
    if (/^(SMA)?(5|20|60|120|200)\s+[-\d$]/.test(String(value))) {
      const r = this.canvas.getBoundingClientRect(); const transform = this.getTransform(); const dpr = this.canvas.width / r.width;
      const shell = (this.canvas.closest('[data-testid="chart-canvas"]')?.parentElement?.closest('[data-testid]') ?? this.canvas.closest('[data-testid]'))?.getAttribute('data-testid');
      const color = String(this.fillStyle);
      window.__smaTexts.push({ canvasId: idFor(this.canvas), text: String(value), x: (x * transform.a + transform.e) / dpr, y: (y * transform.d + transform.f) / dpr, color, width: r.width, height: r.height, shell });
      if (window.__smaTexts.length > 2000) window.__smaTexts.splice(0, 1000);
    }
    return text.apply(this, arguments);
  };
  const stroke = CanvasRenderingContext2D.prototype.stroke;
  CanvasRenderingContext2D.prototype.stroke = function() {
    const r = this.canvas.getBoundingClientRect(); const t = this.getTransform();
    window.__smaStrokes.push({ color: String(this.strokeStyle), width: this.lineWidth * t.a / (this.canvas.width / r.width), shell: this.canvas.closest('[data-testid]')?.getAttribute('data-testid') });
    if (window.__smaStrokes.length > 1500) window.__smaStrokes.splice(0, 750);
    return stroke.apply(this, arguments);
  };
}
async function clear(page) { await page.evaluate(() => { window.__smaTexts = []; window.__smaStrokes = []; }); }
async function labels(page, colorSet, shell) {
  return page.evaluate(({ colorSet, shell }) => {
    const rows = window.__smaTexts.filter(row => (!shell || row.shell === shell) && colorSet.map(c => c.toLowerCase()).includes(row.color.toLowerCase()));
    const latest = new Map(rows.map(row => [Number(row.text.match(/^(?:SMA)?(\d+)/)[1]), row]));
    return [...latest.entries()].map(([period, row]) => ({ period, ...row }));
  }, { colorSet, shell });
}
async function checkChart(page, shell, theme, result, screenshot) {
  const root = page.getByTestId(shell).first();
  await root.getByTestId('sma-toggle-200').waitFor({ timeout: 35000 });
  await root.scrollIntoViewIfNeeded();
  await page.waitForFunction(({ colorSet, shell }) => window.__smaTexts?.some(row => row.shell === shell && /^(SMA)?200\s/.test(row.text) && colorSet.map(c => c.toLowerCase()).includes(row.color.toLowerCase())), { colorSet: colors[theme], shell }, { timeout: 35000 });
  for (const period of periods) assert.equal(await root.getByTestId(`sma-toggle-${period}`).getAttribute('aria-pressed'), 'true');
  const coloredLabels = await labels(page, colors[theme], shell);
  assert.deepEqual(coloredLabels.map(row => row.period).sort((a, b) => a - b), periods, 'all five native direct labels, including pre-roll SMA200');
  const sorted = coloredLabels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) assert(sorted[i].y - sorted[i - 1].y >= 21.5, 'right-edge labels collide');
  assert(coloredLabels.every(row => row.x >= 0 && row.x < row.width && row.y >= 0 && row.y <= row.height));
  const beforeCalls = result.calls.filter(c => c.name === 'getChartData').length;
  const before = await root.getByTestId('chart-canvas').count() ? await root.getByTestId('chart-canvas').evaluate(el => ({ from: el.dataset.visibleFrom, to: el.dataset.visibleTo, canvases: el.querySelectorAll('canvas').length })) : null;
  for (const period of periods) {
    await clear(page); await root.getByTestId(`sma-toggle-${period}`).click(); await page.waitForTimeout(120);
    assert.equal(await root.getByTestId(`sma-toggle-${period}`).getAttribute('aria-pressed'), 'false');
    const remaining = await labels(page, colors[theme], shell);
    assert(!remaining.some(row => row.period === period), `SMA${period} label survives OFF`);
    for (const other of periods.filter(p => p !== period)) assert.equal(await root.getByTestId(`sma-toggle-${other}`).getAttribute('aria-pressed'), 'true');
    await root.getByTestId(`sma-toggle-${period}`).click(); await page.waitForTimeout(120);
  }
  assert.equal(result.calls.filter(c => c.name === 'getChartData').length, beforeCalls, 'visibility refetched prices');
  if (before) assert.deepEqual(await root.getByTestId('chart-canvas').evaluate(el => ({ from: el.dataset.visibleFrom, to: el.dataset.visibleTo, canvases: el.querySelectorAll('canvas').length })), before, 'toggle changed zoom or pane canvas count');
  result.labels = coloredLabels;
  await root.scrollIntoViewIfNeeded(); await root.screenshot({ path: screenshot });
  result.screenshot = screenshot;
  result.nativeStrokeWidths = await page.evaluate(colorSet => window.__smaStrokes.filter(row => colorSet.map(c => c.toLowerCase()).includes(row.color.toLowerCase())), colors[theme]);
  colors[theme].forEach((color, i) => assert(result.nativeStrokeWidths.some(row => row.color.toLowerCase() === color.toLowerCase() && Math.abs(row.width - [1,2,2,2,3][i]) < 0.03), `SMA${periods[i]} native line width is incorrect`));
  return root;
}
async function checkRestoreAndTheme(page, item, theme, result) {
  let root = page.getByTestId(item.shell).first();
  await root.getByTestId('sma-toggle-120').click();
  await page.waitForTimeout(350); // existing layout save debounce
  await page.reload({ waitUntil: 'domcontentloaded' });
  root = page.getByTestId(item.shell).first();
  await page.waitForFunction(shell => document.querySelector(`[data-testid="${shell}"] [data-testid="sma-toggle-120"]`)?.getAttribute('aria-pressed') === 'false', item.shell);
  assert.equal(await root.getByTestId('sma-toggle-200').getAttribute('aria-pressed'), 'true', 'reload corrupted other SMA state');
  await root.getByTestId('sma-toggle-120').click();
  const otherTheme = theme === 'light' ? 'dark' : 'light';
  await root.scrollIntoViewIfNeeded();
  const beforeCalls = result.calls.filter(c => c.name === 'getChartData').length;
  await clear(page);
  await page.getByRole('button', { name: '테마 전환', exact: true }).click();
  await root.scrollIntoViewIfNeeded();
  await page.waitForFunction(({ shell, color }) => window.__smaTexts?.some(row => row.shell === shell && /^(SMA)?200\s/.test(row.text) && row.color.toLowerCase() === color.toLowerCase()), { shell: item.shell, color: colors[otherTheme][4] });
  assert.deepEqual((await labels(page, colors[otherTheme], item.shell)).map(row => row.period).sort((a,b) => a-b), periods, 'theme change left stale SMA colors');
  assert.equal(result.calls.filter(c => c.name === 'getChartData').length, beforeCalls, 'theme change refetched history');
  await page.getByRole('button', { name: '테마 전환', exact: true }).click();
  await root.scrollIntoViewIfNeeded();
  await page.waitForFunction(({ shell, color }) => window.__smaTexts?.some(row => row.shell === shell && /^(SMA)?200\s/.test(row.text) && row.color.toLowerCase() === color.toLowerCase()), { shell: item.shell, color: colors[theme][4] });
  result.persistenceRestored = true; result.liveThemeChanged = true;
  return root;
}
async function checkPng(page, root, theme, result, filename) {
  const promise = page.waitForEvent('download');
  await root.getByTestId('chart-export-png').click();
  const download = await promise;
  await download.saveAs(filename);
  const bytes = readFileSync(filename);
  assert.equal(bytes.subarray(1,4).toString(), 'PNG');
  const counts = await page.evaluate(async ({ data, colors }) => {
    const img = new Image(); img.src = data; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
    return colors.map(color => {
      const rgb = color.slice(1).match(/../g).map(channel => parseInt(channel,16));
      let count = 0;
      for (let i=0; i<pixels.length; i+=4) if (rgb.every((channel,j) => pixels[i+j] === channel)) count++;
      return count;
    });
  }, { data: `data:image/png;base64,${bytes.toString('base64')}`, colors: colors[theme] });
  assert(counts.every(count => count > 0), 'PNG lost standard SMA colors');
  result.png = { filename, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorPixels: counts };
}
async function checkReplay(page, root, item, theme, result) {
  const tools = root.getByTestId('chart-tools-mobile');
  if (await tools.isVisible()) await tools.click();
  await page.getByTestId('replay-toggle').filter({ visible: true }).first().click();
  if (await page.getByTestId('chart-tools-sheet').isVisible()) await page.keyboard.press('Escape');
  const pane = root.locator('[data-hts-pane="price"]').first();
  await pane.scrollIntoViewIfNeeded();
  const box = await pane.boundingBox();
  await clear(page); await pane.click({ position: { x: box.width * 0.45, y: box.height / 2 } });
  await root.getByTestId('replay-bar').waitFor();
  await page.waitForTimeout(200);
  const text = await root.getByTestId('chart-ohlc').textContent();
  const [cursor,total] = text.match(/리플레이 (\d+)\/(\d+)/).slice(1).map(Number);
  const all = bars(item.code); const end = all.length - total + cursor - 1;
  const expected = all.slice(end - 199, end + 1).reduce((sum,b) => sum + b.close, 0) / 200;
  const label = (await labels(page, colors[theme], item.shell)).find(row => row.period === 200);
  assert(label, 'replay lost valid SMA200 pre-roll');
  const displayed = Number(label.text.replace(/^(?:SMA)?200\s*/, '').replace(/[^\d.-]/g,''));
  assert(Math.abs(displayed - expected) <= 0.51, 'SMA200 included future replay bars');
  assert(cursor < total, 'replay did not select an earlier bar');
  await root.getByTestId('replay-bar').getByRole('button', { name: '리플레이 종료', exact: true }).click();
  result.replayVerified = { cursor, total, expectedSma200: expected, displayedSma200: displayed };
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) });
const results = [];
try {
  for (const item of cases) for (const theme of list('--themes', 'light,dark')) for (const viewport of viewports) {
    const result = { case: item.id, theme, viewport: viewport.id, synthetic: true, productionBundle: true, calls: [], errors: [], success: false };
    results.push(result);
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile ?? false, hasTouch: viewport.hasTouch ?? false, deviceScaleFactor: viewport.id === 'mobile' ? 2 : 1 });
    const page = await context.newPage();
    page.on('pageerror', error => result.errors.push(error.stack ?? error.message));
    await page.addInitScript(({ theme }) => {
      localStorage.setItem('korea-equity-cc', JSON.stringify({ state: { theme }, version: 4 }));
      localStorage.setItem('kx-export-desk-v2', JSON.stringify({ state: { demoMode: false, settings: { range: '1Y', chartMode: 'absolute', levelSeries: 'raw', alignment: 'OBSERVATION' } }, version: 0 }));
    }, { theme });
    await page.addInitScript(probe);
    await fixtures(page, result.calls);
    try {
      await page.goto(`${base}${item.path}`, { waitUntil: 'domcontentloaded' });
      assert.equal(await page.evaluate(() => innerWidth), viewport.width, 'browser did not use the requested viewport');
      result.viewportPx = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
      let root = await checkChart(page, item.shell, theme, result, `${out}/${item.id}-${theme}-${viewport.id}.png`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'page horizontal overflow');
      root = await checkRestoreAndTheme(page, item, theme, result);
      if (viewport.id === 'desktop') await checkPng(page, root, theme, result, `${out}/${item.id}-${theme}-export.png`);
      if (item.id === 'stock') {
        await checkChart(page, 'valuation-band-chart', theme, { calls: result.calls }, `${out}/valuation-band-${theme}-${viewport.id}.png`);
        const flowRoot = await checkChart(page, 'investor-flow-chart', theme, { calls: result.calls }, `${out}/investor-flow-${theme}-${viewport.id}.png`);
        await clear(page); await flowRoot.getByLabel('SMA 대상 시계열').selectOption('foreign');
        await page.waitForFunction(({ shell, color }) => window.__smaTexts?.some(row => row.shell === shell && /^(SMA)?200\s/.test(row.text) && row.color.toLowerCase() === color.toLowerCase()), { shell: 'investor-flow-chart', color: colors[theme][4] });
        result.additionalCharts = ['valuation-band', 'investor-flow'];
        if (viewport.id === 'desktop') await checkReplay(page, root, item, theme, result);
      }
      if (item.id !== 'export' && item.id !== 'workspace') {
        result.intervals = [];
        for (const label of ['분', '주', '월']) {
          await clear(page);
          await root.getByRole('group', { name: '봉 주기' }).getByRole('button', { name: label, exact: true }).click();
          await page.waitForFunction(({ colorSet, shell }) => window.__smaTexts?.some(row => row.shell === shell && /^(SMA)?200\s/.test(row.text) && colorSet.map(c => c.toLowerCase()).includes(row.color.toLowerCase())), { colorSet: colors[theme], shell: item.shell }, { timeout: 35000 });
          assert.deepEqual((await labels(page, colors[theme], item.shell)).map(row => row.period).sort((a, b) => a - b), periods, `${label} chart loses a standard SMA`);
          result.intervals.push(label);
        }
      }
      if (item.id === 'export') {
        const aLabels = (await labels(page, colors[theme], item.shell)).map(row => row.text);
        await clear(page); await root.getByLabel('SMA 대상 시계열').selectOption('b'); await page.waitForTimeout(400);
        const bLabels = await labels(page, colors[theme], item.shell);
        assert.equal(bLabels.length, 5); assert.notDeepEqual(bLabels.map(row => row.text), aLabels, 'active-series switch failed');
        result.focusRebound = true;
        const tabs = page.getByRole('tab');
        const tabNames = await tabs.allTextContents();
        const coreIndex = tabNames.findIndex(name => /주력|Core|20/.test(name));
        if (coreIndex >= 0) {
          await clear(page); await tabs.nth(coreIndex).click(); await page.waitForTimeout(500);
          if (await page.getByTestId('export-amount-chart').count()) {
            await checkChart(page, 'export-amount-chart', theme, { calls: result.calls }, `${out}/export-amount-${theme}-${viewport.id}.png`);
            result.amountVerified = true;
          }
        }
      }
      if (item.id === 'stock') {
        await page.getByRole('button', { name: 'PER', exact: true }).filter({ visible: true }).first().click();
        await checkChart(page, 'valuation-history-chart', theme, { calls: result.calls }, `${out}/valuation-history-${theme}-${viewport.id}.png`);
        result.additionalCharts.push('valuation-history');
      }
      assert.deepEqual(result.errors, [], 'browser runtime errors');
      result.success = true;
    } catch (error) {
      result.failure = error.message;
      result.probe = await page.evaluate(() => ({ texts: window.__smaTexts.slice(-80), panes: [...document.querySelectorAll('[data-hts-pane]')].map(el => ({ pane: el.dataset.htsPane, height: el.getBoundingClientRect().height })), legend: [...document.querySelectorAll('[data-testid="chart-hud"]')].map(el => el.textContent) }));
      await page.screenshot({ path: `${out}/${item.id}-${theme}-${viewport.id}-FAILED.png`, fullPage: false });
    }
    writeFileSync(`${out}/result.json`, JSON.stringify({ synthetic: true, productionBundle: true, results }, null, 2));
    console.log(JSON.stringify({ case: item.id, theme, viewport: viewport.id, success: result.success, failure: result.failure }));
    await context.close();
  }
} finally { await browser.close(); }
assert(results.length && results.every(result => result.success), 'SMA browser acceptance failed; see result.json');
