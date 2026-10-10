#!/usr/bin/env node
/** Production-browser global security search regression. The browser alone
 * receives deterministic RPC fixtures; these are NOT live securities/quotes. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { fromJSON, toCrossJSONAsync } from 'seroval';

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const base = option('--base', 'http://127.0.0.1:8081');
const out = resolve(option('--out', '.qa/security-search'));
let entry = option('--server-entry');
if (!entry) {
  const config = await readFile('.nitrorc', 'utf8').catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return '';
  });
  const outputDirectory = config.match(/^\s*output\.dir\s*=\s*(.*?)\s*$/m)?.[1] || '.vercel/output';
  entry = resolve(outputDirectory, 'functions/__server.func/index.mjs');
}
const baseline = args.includes('--baseline');
await mkdir(out, { recursive: true });
const compiled = await readFile(entry, 'utf8');
const names = Object.fromEntries([...compiled.matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName: "([^"]+)"/g)]
  .map(match => [match[1], match[2].replace(/_createServerFn_handler$/, '')]));
const stamp = '2026-10-09T06:00:00Z';
const source = 'QA SYNTHETIC SEARCH/CHART FIXTURE — NOT MARKET DATA';
const kr = (code, nameKo, isEtf = false, market = 'KOSPI') => ({ code, nameKo, nameEn: nameKo,
  market, region: 'KR', sectorId: 'semiconductors', isEtf, source: isEtf ? 'naver-etf' : 'naver-listing' });
const us = (code, nameKo, market = 'NASDAQ', isEtf = false) => ({ code, nameKo, nameEn: nameKo,
  market, region: 'US', sectorId: 'us-linked', isEtf, source: 'nasdaq-directory' });
const samsung = [kr('005930', '삼성전자'), kr('032830', '삼성생명'), kr('009150', '삼성전기'),
  kr('028260', '삼성물산'), kr('0226A0', '삼성 QA SYNTHETIC ETF', true),
  kr('131970', '삼성 QA SYNTHETIC 코스닥', false, 'KOSDAQ'),
  kr('018260', '삼성에스디에스'), kr('006400', '삼성SDI'), kr('207940', '삼성바이오로직스'),
  kr('000810', '삼성화재'), kr('010140', '삼성중공업'),
  ...Array.from({ length: 37 }, (_, index) => kr(String(790000 + index), `QA SYNTHETIC 삼성 검색 ${index + 1}`))];
const apple = us('AAPL', 'Apple Inc.');
const ford = us('F', 'Ford Motor Company', 'NYSE');
const berkshire = us('BRK-B', 'Berkshire Hathaway Class B', 'NYSE');
const etf = kr('0226A0', 'QA SYNTHETIC ETF 0226A0', true);
const hitsFor = query => {
  const q = query.trim().toUpperCase();
  if (q === '삼성' || q === '삼') return samsung;
  if (q === '005930') return [samsung[0]];
  if (q === '032830') return [samsung[1]];
  if (q === '131970') return [samsung[5]];
  if (q === '0226A0') return [etf];
  if (q === '1032A0') return [kr('1032A0', 'QA SYNTHETIC 영숫자 주식')];
  if (q === 'APPLE' || q === 'AAPL') return [apple];
  if (q === 'BRK.B' || q === 'BRK-B') return [berkshire];
  if (q === 'F') return [ford];
  return [];
};
function barsFor(code, market) {
  const scale = market === 'US' ? 0.01 : 1;
  const offset = [...code].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const rows = [];
  for (let day = 0; rows.length < 260; day++) {
    const date = new Date(Date.UTC(2025, 0, 2) + day * 86400000);
    if ([0, 6].includes(date.getUTCDay())) continue;
    const i = rows.length;
    const close = (10000 + offset + i * 12 + Math.sin(i / 7) * 400) * scale;
    const open = close + Math.cos(i / 5) * 100 * scale;
    rows.push({ date: date.toISOString().slice(0, 10), open, high: Math.max(close, open) + 130 * scale,
      low: Math.min(close, open) - 140 * scale, close, volume: 10000 + i * 37 });
  }
  return rows;
}
function functionName(url) {
  const encoded = new URL(url).pathname.split('/_serverFn/')[1] ?? '';
  if (names[encoded]) return names[encoded];
  try { return JSON.parse(Buffer.from(decodeURIComponent(encoded), 'base64url').toString()).export?.replace(/_createServerFn_handler$/, ''); }
  catch { return ''; }
}
const deferred = () => { let finish; const promise = new Promise(done => { finish = done; }); return { promise, finish }; };
const viewports = [{ id: 'desktop', width: 1440, height: 900 }, { id: 'mobile', width: 390, height: 844 }]
  .filter(viewport => !args.includes('--viewport') || viewport.id === option('--viewport'));
const themes = ['light', 'dark'].filter(theme => !args.includes('--theme') || theme === option('--theme'));
const results = [];
let kiwoomFixtureOpened = false;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const theme of themes) for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const run = { theme, viewport: viewport.id, synthetic: true, baseline, success: false, checks: [] };
    const calls = [], errors = [];
    let searchMode = 'normal', staleGate = null, gateEntered = null, staleCompleted = null;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(mode => {
      localStorage.setItem('korea-equity-cc', JSON.stringify({ state: { theme: mode, watchlist: [], usWatchlist: [] }, version: 4 }));
    }, theme);
    await page.route('**/_serverFn/**', async route => {
      const name = functionName(route.request().url());
      assert(name, 'Unknown compiled server RPC');
      const raw = route.request().method() === 'POST' ? route.request().postData() : new URL(route.request().url()).searchParams.get('payload');
      const payload = raw ? fromJSON(JSON.parse(raw)) : {};
      const data = payload.data ?? payload;
      calls.push({ name, q: data.q, offset: data.offset, limit: data.limit, code: data.code, market: data.market });
      let value = null, held = false;
      if (name === 'getSecuritySearch') {
        if (data.q === '삼' && staleGate) {
          held = true; gateEntered.finish(); await staleGate.promise;
        }
        const all = searchMode === 'unavailable' || searchMode === 'empty' ? [] : hitsFor(data.q);
        const offset = data.offset ?? 0, limit = data.limit ?? 40;
        const hits = all.slice(offset, offset + limit);
        const status = searchMode === 'unavailable' ? 'unavailable' : searchMode === 'partial' ? 'partial' : 'ready';
        value = { q: data.q, hits, total: all.length, offset, limit, nextOffset: offset + limit < all.length ? offset + limit : null,
          hasMore: offset + limit < all.length, status, providers: [{ id: 'kr-listing', status, count: hits.length }], fetchedAt: stamp, source };
      } else if (name === 'getChartData') {
        value = { bars: barsFor(data.code, data.market), source };
      } else if (name === 'getChartSecurity' || name === 'getUsChartSecurity') {
        const region = name === 'getUsChartSecurity' ? 'US' : 'KR';
        value = { code: data.code, market: region,
          exchange: region === 'US' ? data.code === 'F' || data.code === 'BRK-B' ? 'NYSE' : 'NASDAQ' : samsung.find(hit => hit.code === data.code)?.market ?? 'KOSPI',
          instrument: data.code === '0226A0' ? 'etf' : 'stock', currency: region === 'US' ? 'USD' : 'KRW', quantityUnit: data.code === '0226A0' ? '좌' : '주', source };
      } else if (name === 'getChartFlow') {
        const { kiwoomBrowserFixture } = await import('./qa-kiwoom-fixture.mjs');
        kiwoomFixtureOpened = true;
        value = await kiwoomBrowserFixture(data, barsFor(data.code, data.market));
      } else if (name === 'getStockBundle') {
        const hit = samsung.find(item => item.code === data.code) ?? kr(data.code, `QA SYNTHETIC ${data.code}`);
        value = { meta: hit, quote: null, basic: null, flow: { days: [], source }, research: [],
          researchPack: { company: [], industry: [], market: [], economy: [] }, news: [], disclosures: [],
          disclosureMeta: { kind: { available: false, message: source }, dartCount: 0, koscomCount: 0 }, fetchedAt: stamp };
      } else if (name === 'getEtfBundle') {
        value = { etf: { code: data.code, nameKo: etf.nameKo, price: 12000, change: 0, changePct: 0, volume: 10000,
          nav: 12000, retirementEligible: false, tabLabel: 'QA SYNTHETIC' }, holdings: [], themeStocks: [], peerEtfs: [], allocation: [],
          descriptionFormatted: { paragraphs: [], summary: '', bullets: [], plain: '' }, themeLabels: [], fetchedAt: stamp, holdingsSource: source };
      } else if (name === 'getMarketQuotes' || name === 'getQuotesByCodes') value = { quotes: [], fetchedAt: stamp, source };
      else if (name === 'getMarketIndices') value = { indices: [], fetchedAt: stamp, source };
      else if (name === 'getMarketSnapshot') value = { rows: [], fetchedAt: stamp, errors: [] };
      else if (name === 'getUsStreet') value = { notes: [], headlines: [], consensus: [], fetchedAt: stamp, errors: [] };
      else if (name === 'getUsOfficialCompany') value = { symbol: data.symbol, name: data.symbol, errors: [], filings: [], earnings: [], form4: [], holdings: [], fetchedAt: stamp };
      else if (name === 'getUsOfficialPolicy') value = { macro: [], policy: [], errors: [], fetchedAt: stamp };
      else if (name === 'getEtfMarket') value = { etfs: [], fetchedAt: stamp, source, hasMore: false, total: 0 };
      else if (name === 'getValuationSeries') value = { rows: [], source, errors: [] };
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'x-tss-serialized': 'true' },
        body: JSON.stringify(await toCrossJSONAsync({ result: value, error: undefined, context: {} }, { refs: new Map() })) }).catch(() => {});
      if (held) staleCompleted.finish();
    });
    await page.route('**/api/market-stream?*', route => route.fulfill({ status: 200, contentType: 'text/event-stream',
      body: 'event: status\ndata: {"enabled":false,"connected":false,"provider":"kis","source":"QA SYNTHETIC"}\n\n' }));
    await page.route('**/api/wire?*', route => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ items: [], sources: [], nextCursor: null, generatedAt: stamp, fetchedAt: stamp, errors: [] }) }));
    const input = () => page.getByRole(baseline ? 'textbox' : 'combobox', { name: '종목 검색', exact: true });
    const options = () => page.getByTestId('security-search-results').getByRole('option');
    const keys = () => options().evaluateAll(items => items.map(item => item.dataset.securityKey));
    const queryCalls = () => calls.filter(call => call.name === 'getSecuritySearch');
    const fill = async (query, expectedKeys) => {
      await input().fill(query);
      if (expectedKeys) await page.waitForFunction(expected => {
        const actual = [...document.querySelectorAll('[role="option"][data-security-key]')].map(item => item.dataset.securityKey);
        return JSON.stringify(actual.sort()) === JSON.stringify([...expected].sort());
      }, expectedKeys);
    };
    const check = async (name, action) => { const detail = await action(); run.checks.push({ name, success: true, detail }); };
    const canvas = () => page.getByTestId('chart-canvas').first();
    async function actualCanvas(code) {
      await page.waitForFunction(expected => [...document.querySelectorAll('[data-testid="trading-chart"], [data-testid="workspace-pane-0"]')]
        .filter(root => !expected || root.getAttribute('aria-label')?.includes(expected))
        .some(root => [...root.querySelectorAll('[data-testid="chart-canvas"] canvas')].some(canvas => {
        const ctx = canvas.getContext('2d');
        if (!ctx || canvas.width < 100 || canvas.height < 80) return false;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data, colors = new Set();
        for (let index = 0; index < data.length; index += 148) colors.add(`${data[index]},${data[index + 1]},${data[index + 2]}`);
        return colors.size > 10;
      })), code);
      // Route metadata may replace the old native node while a Playwright
      // scroll command waits for stability; resolve the current node atomically.
      await page.evaluate(() => document.querySelector('[data-testid="chart-canvas"]')?.scrollIntoView({ block: 'center' }));
      return { nativeCanvas: true, count: await canvas().locator('canvas').count() };
    }
    async function select(key, path, method = 'click') {
      const option = page.locator(`[role="option"][data-security-key="${key}"]`);
      if (method === 'click') await option.click();
      else await input().press('Enter');
      await page.waitForURL(url => url.pathname === path);
      assert.equal(await page.getByTestId('security-search-panel').count(), 0, 'Selection left old results visible');
      assert.equal(await input().inputValue(), '', 'Selection retained the old query');
      const expected = path.split('/').at(-1);
      const state = await actualCanvas(expected);
      const market = path.startsWith('/us/') ? 'US' : expected === '131970' ? 'KOSDAQ' : 'KOSPI';
      assert(queryCalls().length > 0);
      assert(calls.some(call => call.name === 'getChartData' && call.code === expected && call.market === market), `No actual ${market} chart data request for ${expected}`);
      await canvas().screenshot({ path: `${out}/chart-${expected}-${theme}-${viewport.id}.png` });
      return { path, market, ...state };
    }
    try {
      await page.goto(`${base}/stock/005930`, { waitUntil: 'domcontentloaded' });
      await input().waitFor();
      // SSR inputs exist before React attaches handlers; the native chart only
      // mounts after hydration and the intercepted price request has completed.
      await actualCanvas('005930');
      await page.waitForFunction(mode => document.documentElement.classList.contains('dark') === (mode === 'dark'), theme);
      await page.evaluate(() => {
        const badge = document.createElement('div'); badge.textContent = 'QA SYNTHETIC — NOT MARKET DATA';
        Object.assign(badge.style, { position: 'fixed', right: '8px', bottom: '8px', zIndex: '2147483647', font: '10px sans-serif',
          background: '#ffeeba', color: '#312300', padding: '3px 6px', pointerEvents: 'none' }); document.body.append(badge);
      });
      if (baseline) {
        await input().fill('삼성');
        await page.waitForTimeout(1000);
        const clip = await page.evaluate(() => {
          const buttons = [...document.querySelectorAll('header button')].filter(button => button.textContent.includes('삼성'));
          return buttons.map(button => { const rect = button.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return { text: button.textContent.trim().slice(0, 80), clipped: !hit || !button.contains(hit), height: rect.height, top: rect.top }; });
        });
        assert(clip.length > 1, 'Baseline fixture did not populate multiple search rows');
        assert(clip.some(row => row.clipped), 'Original header clipping did not reproduce');
        run.baselineClip = clip; run.success = true;
        await page.screenshot({ path: `${out}/baseline-clipped-${theme}-${viewport.id}.png` });
      } else {
        await check('Multiple Korean results are visible above the page and scroll to ETF', async () => {
          await fill('삼성', samsung.slice(0, 40).map(hit => `${hit.region}:${hit.code}`));
          const panel = page.getByTestId('security-search-panel');
          const geometry = await panel.evaluate(panel => {
            const rect = panel.getBoundingClientRect(), input = document.querySelector('[data-testid="security-search-input"]').getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, inputBottom: input.bottom,
              parentHeader: Boolean(panel.closest('header')), width: innerWidth, height: innerHeight };
          });
          assert.equal(geometry.parentHeader, false, 'Dropdown stayed inside the clipping header');
          assert(geometry.left >= -1 && geometry.right <= geometry.width + 1 && geometry.bottom <= geometry.height + 1);
          const second = page.locator('[role="option"][data-security-key="KR:032830"]');
          await second.scrollIntoViewIfNeeded();
          assert.equal(await second.evaluate(option => { const rect = option.getBoundingClientRect(); const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2); return Boolean(hit && option.contains(hit)); }), true,
            'The second row is covered by the page/header');
          await page.locator('[role="option"][data-security-key="KR:790020"]').scrollIntoViewIfNeeded();
          assert.equal(await page.locator('[role="option"][data-security-key="KR:790020"]').isVisible(), true);
          await page.locator('[role="option"][data-security-key="KR:0226A0"]').scrollIntoViewIfNeeded();
          assert.match(await page.locator('[role="option"][data-security-key="KR:0226A0"]').innerText(), /ETF/);
          await panel.screenshot({ path: `${out}/search-samsung-${theme}-${viewport.id}.png` });
          return geometry;
        });
        await check('Load more appends real distinct result identities', async () => {
          const before = queryCalls().length;
          await page.getByTestId('security-search-more').click();
          await page.waitForFunction(() => document.querySelectorAll('[role="option"][data-security-key]').length === 48);
          assert.equal(new Set(await keys()).size, 48);
          assert(queryCalls().slice(before).some(call => call.offset === 40), 'Pagination did not request the next offset');
          assert.equal(await page.getByTestId('security-search-more').count(), 0);
          return { total: 48, unique: 48, nextOffsetRequested: 40 };
        });
        await check('Keyboard selection and Enter open Korean stock with a rendered native chart', async () => {
          await input().press('ArrowDown');
          await input().press('ArrowUp');
          const active = await input().getAttribute('aria-activedescendant');
          assert(active && await page.locator(`[id="${active}"]`).getAttribute('aria-selected') === 'true');
          await fill('005930', ['KR:005930']);
          return select('KR:005930', '/stock/005930', 'keyboard');
        });
        await check('Non-seed Korean result navigates correctly', async () => { await fill('032830', ['KR:032830']); return select('KR:032830', '/stock/032830'); });
        await check('KOSDAQ result preserves its exchange and opens its stock chart', async () => {
          await fill('131970', ['KR:131970']); assert.match(await options().first().innerText(), /코스닥/);
          return select('KR:131970', '/stock/131970');
        });
        await check('Alphanumeric ETF code stays unchanged and opens ETF chart', async () => { await fill('0226A0', ['KR:0226A0']); return select('KR:0226A0', '/etfs/0226A0'); });
        await check('An explicit alphanumeric Korean stock remains a stock', async () => { await fill('1032A0', ['KR:1032A0']); return select('KR:1032A0', '/stock/1032A0'); });
        await check('Apple name and ticker open US chart', async () => {
          await fill('Apple', ['US:AAPL']); assert.match(await options().first().innerText(), /미국|NASDAQ/);
          const chart = await select('US:AAPL', '/us/AAPL'); await fill('AAPL', ['US:AAPL']);
          await input().press('Escape'); assert.equal(await page.getByTestId('security-search-panel').count(), 0);
          return chart;
        });
        await check('US class share and single-letter ticker keep US identity', async () => {
          await fill('BRK.B', ['US:BRK-B']); const classShare = await select('US:BRK-B', '/us/BRK-B');
          await fill('F', ['US:F']); const oneLetter = await select('US:F', '/us/F'); return { classShare, oneLetter };
        });
        await check('A slow old-query result cannot overwrite the new query', async () => {
          staleGate = deferred(); gateEntered = deferred(); staleCompleted = deferred();
          await fill('삼'); await gateEntered.promise; await fill('AAPL', ['US:AAPL']);
          staleGate.finish(); await staleCompleted.promise; await page.waitForTimeout(250);
          assert.deepEqual(await keys(), ['US:AAPL']); staleGate = null; await input().press('Escape');
          return { oldResponseActuallyCompleted: true, currentKeys: ['US:AAPL'] };
        });
        await check('Korean IME composition never selects a result or searches unfinished text', async () => {
          await input().fill(''); const before = queryCalls().length, path = new URL(page.url()).pathname;
          await input().dispatchEvent('compositionstart'); await input().fill('삼성'); await page.waitForTimeout(230);
          assert.equal(queryCalls().length, before, 'Unfinished IME text started a request');
          await input().press('Enter'); assert.equal(new URL(page.url()).pathname, path);
          await input().dispatchEvent('compositionend', { data: '삼성' });
          await page.waitForFunction(() => document.querySelectorAll('[role="option"][data-security-key]').length >= 40);
          await input().press('Escape'); return { unfinishedQueryBlocked: true, EnterDidNotNavigate: true };
        });
        await check('Provider failure, partial coverage and a valid empty response remain distinct', async () => {
          searchMode = 'unavailable'; await fill('QA_OUTAGE');
          await page.getByTestId('security-search-retry').waitFor();
          assert.match(await page.getByTestId('security-search-panel').innerText(), /실패/);
          assert.doesNotMatch(await page.getByTestId('security-search-panel').innerText(), /검색 결과 없음/);
          searchMode = 'empty'; await page.getByTestId('security-search-retry').click();
          await page.getByText(/^검색 결과 없음/).waitFor();
          assert.equal(await page.getByTestId('security-search-retry').count(), 0);
          searchMode = 'partial'; await fill('apple', ['US:AAPL']);
          assert.match(await page.getByTestId('security-search-panel').innerText(), /일부.*실패/);
          searchMode = 'normal'; await input().press('Escape'); return { failed: true, partial: true, genuineEmpty: true };
        });
        await check('Blocked browser storage does not prevent result navigation', async () => {
          await page.evaluate(() => { window.__qaStorageSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('QA storage blocked', 'SecurityError'); }; });
          await fill('AAPL', ['US:AAPL']); const result = await select('US:AAPL', '/us/AAPL');
          await page.evaluate(() => { Storage.prototype.setItem = window.__qaStorageSet; delete window.__qaStorageSet; });
          return result;
        });
        await check('Shortcut, clear and outside click close the same search state', async () => {
          await input().blur(); await page.keyboard.press('Control+k'); assert.equal(await input().evaluate(input => document.activeElement === input), true);
          await fill('삼성'); await page.getByTestId('security-search-panel').waitFor();
          await page.getByRole('button', { name: '검색 지우기', exact: true }).click(); assert.equal(await input().inputValue(), '');
          await input().fill('AAPL'); await page.getByTestId('security-search-panel').waitFor();
          await page.locator('main h1').first().click(); assert.equal(await page.getByTestId('security-search-panel').count(), 0);
          return { shortcutFocus: true, cleared: true, outsideClosed: true };
        });
        await check('Workspace security selection binds a US result to the US chart', async () => {
          await page.goto(`${base}/chart?symbols=KR%3A005930&layout=1`, { waitUntil: 'domcontentloaded' });
          await actualCanvas('005930');
          const picker = page.getByRole('textbox', { name: '종목 검색 (코드·심볼·이름)', exact: true });
          const before = queryCalls().length;
          await picker.fill('Apple'); assert.equal(await picker.inputValue(), 'Apple');
          const submitted = page.waitForRequest(request => {
            if (functionName(request.url()) !== 'getSecuritySearch') return false;
            const raw = request.method() === 'POST' ? request.postData() : new URL(request.url()).searchParams.get('payload');
            const payload = raw ? fromJSON(JSON.parse(raw)) : {};
            return (payload.data ?? payload).q === 'Apple';
          });
          await picker.press('Enter'); await submitted;
          await page.getByRole('button', { name: /Apple Inc\.\s*AAPL/, exact: true }).click();
          await page.waitForURL(url => url.pathname === '/chart' && url.searchParams.get('symbols') === 'US:AAPL');
          const native = await actualCanvas('AAPL'); assert(calls.some(call => call.name === 'getChartData' && call.code === 'AAPL' && call.market === 'US'));
          assert(queryCalls().slice(before).some(call => call.q === 'Apple'), 'Workspace never submitted its own name lookup');
          return { region: 'US', code: 'AAPL', ...native };
        });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Global search caused horizontal page overflow');
        assert.deepEqual(errors, [], 'Uncaught runtime error');
        run.success = true;
      }
    } catch (error) {
      run.error = String(error).slice(0, 1800); await page.screenshot({ path: `${out}/FAILED-${theme}-${viewport.id}.png`, fullPage: true });
    }
    run.calls = calls; run.errors = errors; results.push(run);
    await writeFile(`${out}/verification.json`, JSON.stringify({ scope: 'synthetic RPC fixtures + existing production chart stack; no live provider or operational DB', base, results }, null, 2));
    console.log(JSON.stringify({ theme, viewport: viewport.id, success: run.success, error: run.error }));
    await context.close();
  }
} finally {
  await browser.close();
  if (kiwoomFixtureOpened) await (await import('./qa-kiwoom-fixture.mjs')).closeKiwoomBrowserFixture();
}
if (results.some(run => !run.success)) process.exitCode = 1;
