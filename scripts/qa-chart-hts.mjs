#!/usr/bin/env node
/**
 * HTS chart acceptance: real market responses by default. Explicit fixture mode
 * intercepts only browser QA requests and labels every artifact as synthetic.
 * Never changes TLS trust, ignores certificate errors, or injects app fallbacks.
 *
 * node scripts/qa-chart-hts.mjs --mode real --base http://127.0.0.1:8080
 * node scripts/qa-chart-hts.mjs --mode fixture --cases stock-001820,etf-069500
 * Options: --viewports desktop,tablet,mobile --interactions --timeout 65000
 *          --function-map <compiled-server-RPC-id-to-name.json> (production hashed IDs)
 *          --checks "Local price alert" (run only matching interaction checks)
 *          --cases stock-001820,stock-403870,stock-036540,stock-011790,
 *                  etf-069500,etf-379800,etf-0005A0,retirement,watchlist,
 *                  workspace-single,workspace-multi,workspace-four,workspace-us-etf,us-NVDA,us-BOTZ
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const arg = (key, fallback) => { const i = argv.indexOf(key); return i < 0 ? fallback : argv[i + 1]; };
const mode = arg('--mode', 'real');
assert(['real', 'fixture'].includes(mode), '--mode must be real or fixture');
const base = arg('--base', process.env.QA_BASE ?? 'http://127.0.0.1:8080');
const timeout = Number(arg('--timeout', '65000'));
const output = resolve(arg('--out', `/workspace/screenshots/chart-upgrade/${mode}`));
const interactions = argv.includes('--interactions');
const selectedChecks = arg('--checks', '').split(',').filter(Boolean);
const functionMapPath = arg('--function-map', '');
const functionNames = functionMapPath ? JSON.parse(readFileSync(functionMapPath, 'utf8')) : {};
const wantedCases = arg('--cases', '').split(',').filter(Boolean);
const wantedViewports = arg('--viewports', 'desktop,tablet,mobile').split(',');
const paneOrder = ['rsi', 'price', 'credit', 'foreign', 'investmentTrust', 'volume'];
const cases = [
  ...['001820', '403870', '036540', '011790'].map(code => ({ id: `stock-${code}`, path: `/stock/${code}`, code, panes: 6 })),
  ...['069500', '379800', '0005A0'].map(code => ({ id: `etf-${code}`, path: `/etfs/${code}`, code, panes: 6 })),
  { id: 'watchlist', path: '/stock/001820', code: '001820', panes: 6, viaWatchlist: true },
  { id: 'retirement', path: '/etfs', code: '069500', panes: 6, viaRetirement: true },
  { id: 'workspace-single', path: '/chart?symbols=KR%3A069500&layout=1', code: '069500', panes: 6 },
  { id: 'workspace-multi', path: '/chart?symbols=KR%3A001820%2CKR%3A069500&layout=2', code: '001820', panes: 6, charts: 2 },
  { id: 'workspace-four', path: '/chart?symbols=KR%3A001820%2CKR%3A069500%2CKR%3A379800%2CKR%3A0005A0&layout=4', code: '001820', panes: 6, charts: 4 },
  { id: 'workspace-us-etf', path: '/chart?symbols=US%3ASPY&layout=1', code: 'SPY', panes: 6 },
  { id: 'us-NVDA', path: '/us/NVDA', code: 'NVDA', panes: 0 },
  { id: 'us-BOTZ', path: '/us/BOTZ', code: 'BOTZ', panes: 6 },
].filter(item => !wantedCases.length || wantedCases.includes(item.id));
const viewports = [
  { name: 'desktop', width: 1440, height: 1100 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
].filter(item => wantedViewports.includes(item.name));
assert(cases.length && viewports.length, 'No cases/viewports selected');
mkdirSync(output, { recursive: true });

// Deterministic format samples, not historical/live securities data. Weekend
// dates are excluded; unequal volumes exercise short/long/large-quantity labels.
function fixtureBars(code) {
  const start = Date.UTC(2025, 0, 2);
  const offset = [...code].reduce((n, c) => n + c.charCodeAt(0), 0) * 10;
  const rows = [];
  for (let day = 0; rows.length < 180; day++) {
    const date = new Date(start + day * 86_400_000);
    if ([0, 6].includes(date.getUTCDay())) continue;
    const i = rows.length;
    const close = 10000 + offset + Math.sin(i / 9) * 1100 + i * 12;
    const open = close + Math.cos(i / 5) * 160;
    rows.push({ date: date.toISOString().slice(0, 10), open, high: Math.max(open, close) + 100,
      low: Math.min(open, close) - 120, close, volume: i % 13 === 0 ? 987654321 : 10000 + i * 1403 });
  }
  return rows;
}
function serverFunctionName(url) {
  try {
    const encoded = new URL(url).pathname.split('/_serverFn/')[1] ?? '';
    if (functionNames[encoded]) return functionNames[encoded];
    return JSON.parse(Buffer.from(decodeURIComponent(encoded), 'base64url').toString()).export?.replace(/_createServerFn_handler$/, '') ?? '';
  } catch { return ''; }
}
async function fixtures(page, fixtureCalls) {
  const { fromJSON, toCrossJSONAsync } = await import('seroval');
  await page.route('**/_serverFn/**', async route => {
    const name = serverFunctionName(route.request().url());
    if (!['getChartData', 'getChartFlow', 'getChartSecurity', 'getUsChartSecurity'].includes(name)) return route.continue();
    let data = {};
    try {
      const raw = route.request().method() === 'POST' ? route.request().postData() : new URL(route.request().url()).searchParams.get('payload');
      const payload = raw ? fromJSON(JSON.parse(raw)) : {};
      data = payload.data ?? payload;
    } catch { /* Invalid transport will fail normal assertions rather than forge data. */ }
    const rows = fixtureBars(data.code ?? 'QA');
    let result = { bars: rows, source: 'QA SYNTHETIC OHLCV FIXTURE — NOT MARKET DATA' };
    if (name === 'getChartSecurity' || name === 'getUsChartSecurity') {
      const us = name === 'getUsChartSecurity';
      const etf = ['069500', '379800', '0005A0', 'SPY', 'BOTZ'].includes(data.code);
      result = { code: data.code, market: us ? 'US' : 'KR', exchange: us ? 'US' : 'KRX', instrument: etf ? 'etf' : 'stock', currency: us ? 'USD' : 'KRW', quantityUnit: etf && !us ? '좌' : '주', source: 'QA SYNTHETIC SECURITY — NOT MARKET DATA' };
    }
    if (name === 'getChartFlow') {
      const { kiwoomBrowserFixture } = await import('./qa-kiwoom-fixture.mjs');
      result = await kiwoomBrowserFixture(data, rows);
    }
    if (name === 'getChartFlow') assert.equal(route.request().method(), 'POST', 'daily calendar must travel in a POST body');
    fixtureCalls.push({ name, code: data.code, method: route.request().method(), urlBytes: route.request().url().length, calendarDates: data.expectedDailyDates?.length ?? null });
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'x-tss-serialized': 'true' },
      body: JSON.stringify(await toCrossJSONAsync({ result, error: undefined, context: {} }, { refs: new Map() })) });
  });
}
function safeUrl(raw) { const url = new URL(raw); return `${url.origin}${url.pathname.split('/_serverFn/')[0]}`; }
async function state(page) {
  return page.evaluate(() => ({
    textLength: document.querySelector('main')?.textContent?.trim().length ?? 0,
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector('h1')?.textContent?.trim(),
    statuses: [...document.querySelectorAll('[data-testid="chart-status"]')].map(el => el.textContent),
    panes: [...document.querySelectorAll('[data-hts-pane]')].map(el => {
      const r = el.getBoundingClientRect();
      const canvases = [...el.querySelectorAll('canvas')].filter(canvas => canvas.width > 10 && canvas.height > 10);
      let colors = 0;
      for (const canvas of canvases) {
        try {
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const sample = new Set();
          for (let i = 0; i < pixels.length; i += Math.max(4, Math.floor(pixels.length / 3000 / 4) * 4)) {
            sample.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`);
          }
          colors = Math.max(colors, sample.size);
        } catch { /* Tainted canvases are recorded as zero, never assumed rendered. */ }
      }
      return { id: el.getAttribute('data-hts-pane'), top: r.top, left: r.left, height: r.height, width: r.width, canvases: canvases.length, colors };
    }),
    canvasCount: document.querySelectorAll('[data-testid="chart-canvas"] canvas').length,
    empty: [...document.querySelectorAll('[data-testid="chart-empty"]')].map(el => el.textContent),
    summaries: [...document.querySelectorAll('[data-testid="profile-details"], [data-testid="hts-data-details"], [data-testid="hts-summary"], [data-testid="hts-panel-status"]')].map(el => el.textContent?.slice(0, 6000)),
    profileRows: [...document.querySelectorAll('[data-testid="profile-details"]')].map(el => el.querySelectorAll('tbody tr').length),
    settings: Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('ked:hts:'))),
  }));
}
async function closeOverlays(page) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  // Wait for Radix exit/focus restoration before reopening another sheet.
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].every(el => !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden'), undefined, { timeout: 5000 });
}
async function openTools(page, chart) {
  const control = chart.getByTestId('chart-tools-mobile');
  if (await control.isVisible()) await control.click();
}
async function openSettings(page, shell) {
  const trigger = shell.getByTestId('open-hts-settings');
  if (!await trigger.isVisible()) await openTools(page, shell);
  await trigger.click();
  await page.getByTestId('hts-settings').waitFor();
  return page.getByTestId('hts-settings');
}
async function drawingState(page, code) {
  return page.evaluate(code => Object.entries(localStorage)
    .filter(([key]) => key.startsWith('ked:chart:v2:') && key.includes(`:${code}:`))
    .flatMap(([, value]) => JSON.parse(value).drawings ?? []), code);
}
async function interact(page, item, result) {
  const checks = result.interactions = [];
  const check = async (name, run) => {
    if (selectedChecks.length && !selectedChecks.some(part => name.includes(part))) return;
    const previousErrors = result.errors.length;
    try { const detail = await run(); assert.equal(result.errors.length, previousErrors, `runtime error during ${name}: ${result.errors.slice(previousErrors).join('; ')}`); checks.push({ name, status: 'passed', detail }); console.log(`  PASS ${item.id}: ${name}`); }
    catch (error) { checks.push({ name, status: 'failed', error: String(error).slice(0, 500) }); console.log(`  FAIL ${item.id}: ${name}: ${String(error).slice(0, 350)}`); await closeOverlays(page); }
  };
  const chart = page.locator('[data-testid="pro-chart"], [data-testid="trading-chart"], [data-testid="workspace-pane-0"], [data-testid="chart-shell"]').filter({ has: page.getByTestId('chart-canvas') }).first();
  // Fall back to the actual ancestor shell when a caller supplies a different id.
  const shell = await chart.count() ? chart : page.getByTestId('chart-canvas').first().locator('xpath=../..');
  if (item.panes) await check('HTS defaults, height and scoped settings restoration', async () => {
    const settings = await openSettings(page, shell);
    assert.equal(await settings.getByLabel('가격 구간 수', { exact: true }).inputValue(), '10');
    assert.equal(await settings.getByLabel(/최대 폭/).inputValue(), '85');
    assert.equal(await settings.getByLabel('RSI 기간', { exact: true }).inputValue(), '14');
    assert.equal(await settings.getByLabel('시그널 기간', { exact: true }).inputValue(), '9');
    assert.equal(await settings.getByLabel(/RSI 출력값의 시그널 방식/).inputValue(), 'sma');
    const initialHeight = await page.locator('[data-hts-pane="price"]').first().evaluate(el => el.getBoundingClientRect().height);
    await settings.getByLabel('가격 구간 수', { exact: true }).fill('16');
    await settings.getByLabel('가격·매물대 높이 (px)', { exact: true }).fill('460');
    await settings.getByLabel(/RSI 출력값의 시그널 방식/).selectOption('ema');
    await closeOverlays(page);
    await page.waitForTimeout(300);
    const resizedHeight = await page.locator('[data-hts-pane="price"]').first().evaluate(el => el.getBoundingClientRect().height);
    assert(resizedHeight > initialHeight, `pane did not grow: ${initialHeight} -> ${resizedHeight}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-hts-pane="volume"]').first().waitFor();
    const reopened = await openSettings(page, shell);
    assert.equal(await reopened.getByLabel('가격 구간 수', { exact: true }).inputValue(), '16');
    assert.equal(await reopened.getByLabel(/RSI 출력값의 시그널 방식/).inputValue(), 'ema');
    await closeOverlays(page);
    const otherCode = item.code === '069500' ? '379800' : '069500';
    await page.goto(`${base}/etfs/${otherCode}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-hts-pane="volume"]').first().waitFor();
    const otherShell = page.getByTestId('chart-canvas').first().locator('xpath=../..');
    const otherSettings = await openSettings(page, otherShell);
    assert.equal(await otherSettings.getByLabel('가격 구간 수', { exact: true }).inputValue(), '10', 'settings leaked into another security');
    await closeOverlays(page);
    await page.goto(`${base}${item.path}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-hts-pane="volume"]').first().waitFor();
    const originalSettings = await openSettings(page, shell);
    assert.equal(await originalSettings.getByLabel('가격 구간 수', { exact: true }).inputValue(), '16');
    await originalSettings.getByRole('button', { name: '국내주식·ETF HTS 기본 배치 복원', exact: true }).click();
    assert.equal(await originalSettings.getByLabel('가격 구간 수', { exact: true }).inputValue(), '10');
    assert.equal(await originalSettings.getByLabel(/최대 폭/).inputValue(), '85');
    await closeOverlays(page);
    await shell.getByTestId('profile-details').locator('tbody tr').first().waitFor({ state: 'attached' });
    return { initialHeight, resizedHeight, persistedRows: 16, otherCode, otherRows: 10, restoredRows: 10 };
  });
  if (mode === 'fixture' && item.panes) await check('Kiwoom daily values, gap handling and explicit available cumulative origin', async () => {
    // Fixed-origin gap assertions are independent of the fresh-layout default.
    const fixedOriginSettings = await openSettings(page, shell);
    await fixedOriginSettings.getByLabel(/투신 표시 방식/).selectOption('cumulative');
    await closeOverlays(page);
    await page.waitForFunction(() => document.querySelector('[data-testid="hts-data-details"]')?.textContent.includes('기준일 이후 누락: 누적순매수 미확정'), undefined, { timeout });
    const settings = await openSettings(page, shell);
    const requestedStart = await settings.getByLabel('투신 누적 기준일', { exact: true }).inputValue();
    await settings.getByLabel(/투신 표시 방식/).selectOption('daily');
    await closeOverlays(page);
    await page.waitForFunction(() => /투신 일별 순매수-1,000 주/.test(document.querySelector('[data-testid="hts-data-details"]')?.textContent ?? ''), undefined, { timeout });
    const availableSettings = await openSettings(page, shell);
    await availableSettings.getByLabel(/투신 표시 방식/).selectOption('available-cumulative');
    await closeOverlays(page);
    await page.waitForFunction(() => document.querySelector('[data-testid="hts-data-details"] summary')?.textContent.includes('가용 시작 '), undefined, { timeout });
    const summary = await shell.getByTestId('hts-data-details').locator('summary').textContent();
    const actualStart = summary.match(/가용 시작 (\d{4}-\d{2}-\d{2})부터/)?.[1];
    assert(actualStart && actualStart > requestedStart, 'actual available origin must be visible after the synthetic gap');
    const restore = await openSettings(page, shell);
    assert.equal(await restore.getByLabel('투신 누적 기준일', { exact: true }).inputValue(), requestedStart, 'opt-in changed the fixed requested origin');
    await restore.getByLabel(/투신 표시 방식/).selectOption('cumulative');
    await closeOverlays(page);
    return { requestedStart, actualStart, rawDailyNet: -1000, synthetic: true };
  });
  await check('Accessible profile table and total percentages', async () => {
    const details = shell.getByTestId('profile-details');
    await details.locator('summary').click();
    const rows = details.locator('tbody tr');
    assert.equal(await rows.count(), 10, 'default profile must expose 10 bins');
    const percentages = await rows.locator('td:nth-child(3)').allTextContents();
    const sum = percentages.reduce((total, text) => total + Number.parseFloat(text), 0);
    assert(Math.abs(sum - 100) <= 0.6, `rounded bin shares total ${sum}`);
    assert.match(await details.textContent(), /OHLCV|겹침/);
    assert.match(await details.textContent(), /출처|source/);
    assert.match(await details.textContent(), /약 /);
    await page.screenshot({ path: join(output, `${item.id}-profile-details.png`), fullPage: false });
    await details.locator('summary').click();
    return { bins: await rows.count(), roundedPercentTotal: sum };
  });
  await check('PNG includes whole chart', async () => {
    const promise = page.waitForEvent('download', { timeout: 10000 });
    await shell.getByTestId('chart-export-png').click();
    const download = await promise;
    const path = join(output, `${item.id}-export.png`);
    await download.saveAs(path);
    const bytes = readFileSync(path);
    assert(bytes.subarray(1, 4).toString() === 'PNG', 'not PNG');
    const dimensions = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length };
    assert(dimensions.height > 400 && bytes.length > 10000, 'empty/short PNG');
    return { ...dimensions, path, note: 'Review image for DOM status/legend coverage.' };
  });
  await check('CSV profile/source/flow metadata', async () => {
    const promise = page.waitForEvent('download', { timeout: 10000 });
    await shell.getByTestId('chart-export-csv').click();
    const download = await promise;
    const path = join(output, `${item.id}-export.csv`);
    await download.saveAs(path);
    const csv = readFileSync(path, 'utf8');
    assert(/price_low,price_high|profile|매물대/i.test(csv), 'missing profile rows');
    assert(/source|출처/i.test(csv), 'missing source');
    assert(/percent|비율|%/i.test(csv), 'missing percentages');
    if (item.panes) assert(/credit|신용|investmentTrust|투신/.test(csv), 'missing flow data/status');
    return { path, bytes: Buffer.byteLength(csv), lines: csv.split('\n').length };
  });
  if (item.panes) await check('Outside-price drawing rejection and price drawing persistence', async () => {
    const changes = [];
    for (const type of ['hline', 'trend', 'fib']) {
      await openTools(page, shell);
      const tools = page.getByTestId('drawing-tool').filter({ visible: true });
      await tools.first().selectOption(type);
      if (await page.getByTestId('chart-tools-sheet').isVisible()) await page.keyboard.press('Escape');
      const before = await drawingState(page, item.code);
      await page.locator('[data-hts-pane="rsi"]').first().click({ position: { x: 100, y: 35 } });
      await page.waitForTimeout(200);
      assert.equal((await drawingState(page, item.code)).length, before.length, `${type}: RSI click created price drawing`);
      const price = page.locator('[data-hts-pane="price"]').first();
      const size = await price.boundingBox();
      await price.click({ position: { x: Math.min(180, size.width / 3), y: size.height / 2 } });
      if (type !== 'hline') await price.click({ position: { x: Math.min(300, size.width * 2 / 3), y: size.height * 0.65 } });
      await page.waitForTimeout(350);
      const after = await drawingState(page, item.code);
      assert.equal(after.length, before.length + 1, `${type}: price click did not save drawing`);
      const drawing = after.at(-1);
      assert.equal(drawing.type, type);
      assert(drawing.anchors.every(anchor => Number.isFinite(anchor.p)), 'invalid price anchors');
      changes.push({ type, before: before.length, after: after.length, anchors: drawing.anchors });
      await page.keyboard.press('Escape');
    }
    await page.screenshot({ path: join(output, `${item.id}-drawings.png`), fullPage: false });
    return changes;
  });
  if (item.panes) await check('Local price alert and event overlays stay in price pane', async () => {
    const canvasImages = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-hts-pane]')].map(el =>
      [el.getAttribute('data-hts-pane'), [...el.querySelectorAll('canvas')].map(canvas => canvas.toDataURL()).join('|')])));
    // New readability defaults keep annotations OFF; make the tested state
    // explicit and use the common category controls rather than the old menu.
    const annotationCategories = ['disclosures', 'research', 'targets', 'signals'];
    for (const category of annotationCategories) {
      const toggle = shell.getByTestId(`overlay-toggle-${category}`);
      if (await toggle.getAttribute('aria-pressed') !== 'true') await toggle.click();
    }
    await page.mouse.move(15, 15);
    await page.waitForTimeout(250);
    const before = await canvasImages();
    await openTools(page, shell);
    await page.getByTestId('drawing-tool').filter({ visible: true }).first().selectOption('hline');
    if (await page.getByTestId('chart-tools-sheet').isVisible()) await page.keyboard.press('Escape');
    const price = page.locator('[data-hts-pane="price"]').first();
    const box = await price.boundingBox();
    await price.click({ position: { x: box.width * 0.65, y: box.height * 0.55 } });
    await page.keyboard.press('Escape');
    await page.getByTestId('open-objects').filter({ visible: true }).first().click();
    const manager = page.getByTestId('object-manager');
    await manager.getByRole('button', { name: '가격 알림 만들기', exact: true }).last().click();
    await page.keyboard.press('Escape');
    await page.mouse.move(15, 15);
    await page.waitForTimeout(400);
    const drawings = await drawingState(page, item.code);
    const linked = drawings.findLast(drawing => drawing.type === 'hline' && drawing.alertId);
    assert(linked, 'horizontal drawing not linked to price alert');
    const afterAlert = await canvasImages();
    assert.notEqual(afterAlert.price, before.price, 'alert/hline not drawn in price pane');
    const otherPanes = paneOrder.filter(id => id !== 'price');
    assert(otherPanes.every(id => afterAlert[id] === before[id]), 'alert changed another pane canvas');
    await page.getByTestId('open-alerts').filter({ visible: true }).first().click();
    const alerts = page.getByTestId('alerts-panel');
    assert.match(await alerts.textContent(), new RegExp(`가격 ${linked.anchors[0].p.toLocaleString('ko-KR').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    await page.keyboard.press('Escape');
    for (const category of annotationCategories) {
      const toggle = shell.getByTestId(`overlay-toggle-${category}`);
      if (await toggle.getAttribute('aria-pressed') === 'true') await toggle.click();
    }
    await page.mouse.move(15, 15);
    await page.waitForTimeout(400);
    const afterMarkers = await canvasImages();
    assert.notEqual(afterMarkers.price, afterAlert.price, 'event/signal marker toggles did not change price pane');
    assert(otherPanes.every(id => afterMarkers[id] === afterAlert[id]), 'event marker toggle changed another pane canvas');
    await shell.screenshot({ path: join(output, `${item.id}-price-alert-markers.png`) });
    return { drawingType: linked.type, level: linked.anchors[0].p, alertLinked: true, unaffectedPanes: otherPanes, markerToggleChangedOnlyPrice: true };
  });
  await check('Time zoom/pan preserves native pane structure', async () => {
    const pane = page.locator(item.panes ? '[data-hts-pane="price"]' : '[data-testid="chart-canvas"]').first();
    await pane.scrollIntoViewIfNeeded();
    const box = await pane.boundingBox();
    const before = await pane.screenshot();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -240);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(350);
    const after = await pane.screenshot();
    assert(!before.equals(after), 'zoom/pan produced no visible change');
    const snap = await state(page);
    if (item.panes) assert.deepEqual(snap.panes.slice(0, 6).map(p => p.id), paneOrder);
    return { visuallyChanged: true, panes: snap.panes.length };
  });
  if (item.panes) await check('Day/week/month/minute switching and replay data boundaries', async () => {
    const intervals = [];
    for (const [id, label] of [['week', '주'], ['month', '월'], ['minute', '분'], ['day', '일']]) {
      await shell.getByRole('group', { name: '봉 주기', exact: true }).getByRole('button', { name: label, exact: true }).click();
      await page.waitForFunction(({ code, id }) => Object.keys(localStorage).some(key => key.startsWith('ked:hts:') && key.includes(`:${code}:${id === 'minute' ? 'minute-5' : id}:`)), { code: item.code, id }, { timeout });
      await page.waitForFunction(() => document.querySelector('[data-testid="profile-details"] tbody tr') && !document.querySelector('[data-testid="chart-empty"]'), undefined, { timeout });
      await page.locator('[data-hts-pane="volume"]').first().waitFor();
      await page.waitForTimeout(450);
      const snap = await state(page);
      assert.deepEqual(snap.panes.slice(0, 6).map(p => p.id), paneOrder, `native panes after interval ${id}`);
      const details = await shell.getByTestId('hts-data-details').textContent();
      if (id === 'minute') assert.match(details, /일별 원천 데이터: 분봉 곡선 비활성/);
      intervals.push({ id, source: snap.statuses[0], summary: details.slice(0, 1800) });
    }
    await openTools(page, shell);
    await page.getByTestId('replay-toggle').filter({ visible: true }).first().click();
    if (await page.getByTestId('chart-tools-sheet').isVisible()) await page.keyboard.press('Escape');
    const price = page.locator('[data-hts-pane="price"]').first();
    const box = await price.boundingBox();
    await price.click({ position: { x: box.width * 0.45, y: box.height / 2 } });
    await shell.getByTestId('replay-bar').waitFor();
    await page.waitForTimeout(350);
    const before = await shell.getByTestId('hts-data-details').textContent();
    assert.match(before, /공표 시각 미확인|시점 검증 리플레이 비활성/);
    await shell.getByTestId('replay-step').click();
    await page.waitForTimeout(250);
    const after = await shell.getByTestId('hts-data-details').textContent();
    assert.notEqual(after, before, 'replay step did not advance pane values/date');
    await page.screenshot({ path: join(output, `${item.id}-replay.png`), fullPage: false });
    await shell.getByTestId('replay-bar').getByRole('button', { name: '리플레이 종료', exact: true }).click();
    return { intervals, replayStepChanged: true, replayMissingPublicationRestricted: true };
  });
  await check('Theme toggle', async () => {
    const before = await page.locator('html').getAttribute('class');
    await page.getByRole('button', { name: '테마 전환', exact: true }).click();
    assert.notEqual(await page.locator('html').getAttribute('class'), before);
    await page.screenshot({ path: join(output, `${item.id}-theme.png`), fullPage: false });
    return 'Theme class and rendered chart changed';
  });
  await check('Fullscreen/workspace entry', async () => {
    await shell.getByTestId('chart-fullscreen').click();
    await page.waitForTimeout(500);
    const full = await page.evaluate(() => Boolean(document.fullscreenElement));
    assert(full || new URL(page.url()).pathname === '/chart', 'neither fullscreen nor workspace opened');
    if (full) await page.evaluate(() => document.exitFullscreen());
    return { fullscreen: full, path: new URL(page.url()).pathname };
  });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) });
const results = [];
try {
  for (const viewport of viewports) for (const item of cases) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile, hasTouch: viewport.hasTouch, locale: 'ko-KR', timezoneId: 'Asia/Seoul', acceptDownloads: true });
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    const result = { id: item.id, mode, viewport: viewport.name, path: item.path, status: 'failed', errors: [], externalFailures: [], cancelledRequests: [], fixtureCalls: [], marketResponses: [] };
    page.on('pageerror', error => { result.errors.push(error.stack ?? error.message); console.log(`  ERROR ${item.id}: ${error.stack ?? error.message}`); });
    page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource|net::ERR_/i.test(message.text())) result.errors.push(message.text()); });
    page.on('requestfailed', request => {
      const entry = { url: safeUrl(request.url()), error: request.failure()?.errorText, function: serverFunctionName(request.url()) };
      if (/ERR_ABORTED|NS_BINDING_ABORTED/.test(entry.error ?? '')) result.cancelledRequests.push(entry);
      else if (new URL(request.url()).origin !== new URL(base).origin) result.externalFailures.push(entry);
      else result.errors.push(`requestfailed: ${JSON.stringify(entry)}`);
    });
    page.on('response', response => { const fn = serverFunctionName(response.url()); if (['getChartData', 'getChartFlow', 'getEtfBundle'].includes(fn)) result.marketResponses.push({ function: fn, status: response.status() }); });
    try {
      if (mode === 'fixture') await fixtures(page, result.fixtureCalls);
      const response = await page.goto(`${base}${item.path}`, { waitUntil: 'domcontentloaded' });
      result.httpStatus = response?.status();
      if (item.viaWatchlist) {
        await page.locator('[data-hts-pane="volume"]').first().waitFor();
        const add = page.getByRole('button', { name: '관심종목 추가', exact: true }).first();
        if (await add.isVisible()) await add.click();
        const menu = page.getByRole('button', { name: '메뉴 열기', exact: true });
        if (await menu.isVisible()) await menu.click();
        await page.locator('a[href="/watchlist"]').filter({ visible: true }).first().click();
        const link = page.locator(`a[href="/stock/${item.code}"]`).first();
        await link.waitFor();
        await link.click();
        result.viaWatchlist = true;
      }
      if (item.viaRetirement) {
        const link = page.locator(`a[href="/etfs/${item.code}"]`).first();
        await link.waitFor();
        await link.click();
        result.viaRetirement = true;
      }
      await page.getByTestId('chart-canvas').first().waitFor();
      if (item.panes) await page.locator('[data-hts-pane="volume"]').first().waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="profile-details"]')].some(el => el.querySelectorAll('tbody tr').length > 0), undefined, { timeout }).catch(() => undefined);
      if (mode === 'fixture' && item.panes && /^[0-9A-Z]{6}$/.test(item.code)) {
        await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="hts-data-details"]')].some(el => (el.textContent.match(/키움증권 · QA SYNTHETIC \(실데이터 아님\)/g) ?? []).length >= 3), undefined, { timeout });
        // This case deliberately exercises strict fixed-origin missingness.
        // Do not rely on (or replace) the available-cumulative default.
        const shell = page.getByTestId('chart-canvas').first().locator('xpath=../..');
        const settings = await openSettings(page, shell);
        await settings.getByLabel(/투신 표시 방식/).selectOption('cumulative');
        await closeOverlays(page);
        await page.waitForFunction(() => document.querySelector('[data-testid="hts-data-details"]')?.textContent.includes('기준일 이후 누락: 누적순매수 미확정'), undefined, { timeout });
        const details = await page.getByTestId('hts-data-details').first().textContent();
        assert.match(details, /신용잔고율[\d.]+ %/, 'credit response has not reached the chart');
        assert.match(details, /외국인보유비율[\d.]+ %/, 'foreign response has not reached the chart');
        assert.match(details, /기준일 이후 누락: 누적순매수 미확정/, 'synthetic daily gap must block cumulative values');
      }
      await page.waitForTimeout(500);
      result.snapshot = await state(page);
      assert.equal(result.httpStatus, 200, 'route HTTP status');
      assert(result.snapshot.textLength > 40, 'main content absent');
      assert(result.snapshot.scrollWidth <= result.snapshot.width + 1, `horizontal overflow ${result.snapshot.scrollWidth}/${result.snapshot.width}`);
      assert(result.snapshot.canvasCount >= 2, 'native chart canvas absent');
      assert(result.snapshot.profileRows.some(count => count === 10), 'default 10-bin profile missing (price data may be unavailable)');
      assert(!result.marketResponses.some(response => response.function === 'getChartFlow' && response.status >= 400), 'chart flow transport failed');
      if (item.panes) {
        const expectedCharts = item.charts ?? 1;
        assert.equal(result.snapshot.panes.length, 6 * expectedCharts, 'native pane count');
        for (let i = 0; i < expectedCharts; i++) {
          const panes = result.snapshot.panes.slice(i * 6, (i + 1) * 6);
          assert.deepEqual(panes.map(p => p.id), paneOrder, 'pane semantic order');
          assert(panes.every(p => p.height > 20 && p.width > 20), 'collapsed/missing default pane');
          assert(panes.every((p, index) => index === 0 || p.top > panes[index - 1].top), 'pane visual order');
          assert(panes.find(p => p.id === 'price').colors > 4, 'price canvas appears blank');
        }
      } else assert.equal(result.snapshot.panes.length, 0, 'US stock unexpectedly forced into six-pane mode');
      if (mode === 'fixture') assert(result.fixtureCalls.some(call => call.name === 'getChartData'), 'fixture transport did not intercept chart request');
      const chart = page.getByTestId('chart-canvas').first();
      await chart.scrollIntoViewIfNeeded();
      result.screenshot = join(output, `${item.id}-${viewport.name}.png`);
      await page.screenshot({ path: result.screenshot, fullPage: true });
      result.chartScreenshot = join(output, `${item.id}-${viewport.name}-chart.png`);
      await chart.screenshot({ path: result.chartScreenshot });
      // Interactions once per representative stock/ETF, with real and fixture
      // results kept distinct; the matrix itself covers every requested viewport.
      if (interactions && viewport.name === 'desktop' && ['stock-001820', 'stock-403870', 'etf-069500'].includes(item.id)) await interact(page, item, result);
      assert.equal(result.errors.length, 0, 'application console/runtime errors');
      assert(!(result.interactions ?? []).some(check => check.status === 'failed'), 'interaction failures');
      result.status = 'passed';
    } catch (error) {
      result.failure = String(error).slice(0, 1000);
      result.snapshot ??= await state(page).catch(() => null);
      result.screenshot ??= join(output, `${item.id}-${viewport.name}-failed.png`);
      await page.screenshot({ path: result.screenshot, fullPage: false }).catch(() => undefined);
    } finally {
      results.push(result);
      writeFileSync(join(output, 'verdict.json'), JSON.stringify({ base, mode, at: new Date().toISOString(), results }, null, 2));
      console.log(`${result.status.toUpperCase()} ${mode} ${item.id} ${viewport.name}${result.failure ? `: ${result.failure}` : ''}`);
      await context.close();
    }
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ mode, passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length, verdict: join(output, 'verdict.json') }));
process.exitCode = results.some(result => result.status !== 'passed') ? 1 : 0;

if (mode === "fixture") { const { closeKiwoomBrowserFixture } = await import("./qa-kiwoom-fixture.mjs"); await closeKiwoomBrowserFixture(); }
