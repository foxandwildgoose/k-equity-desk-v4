#!/usr/bin/env node
/**
 * Browser regression with test-only RPC interception. Uploaded 2026-10-08 SOL
 * weights are real historical document values; quotes, charts and resolved
 * product URLs are explicitly QA fixtures. This does not verify live APIs.
 *
 * node --experimental-strip-types scripts/qa-etf-issuer.mjs
 *   --base http://127.0.0.1:8080 --out /workspace/screenshots/etf-issuer/dev
 *   --server-entry .vercel/output/functions/__server.func/index.mjs
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { fromJSON, toCrossJSONAsync } from 'seroval';
import { SOL_DRAM_20261008_SNAPSHOT as snapshot } from '../src/data/etf-official-snapshots.ts';
import { emptyChartFlow } from '../src/lib/charts/hts-flow.ts';
import { emptyValuationPack } from '../src/lib/valuation-series.ts';
import { checkedUrl, checkedOutputPath } from './browser-guard.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const list = (name, fallback) => option(name, fallback).split(',').filter(Boolean);
const base = checkedUrl(option('--base', process.env.QA_BASE ?? 'http://127.0.0.1:8080'));
const origin = new URL(base).origin;
const output = checkedOutputPath(resolve(option('--out', '/workspace/screenshots/etf-issuer/dev')), ['/workspace/screenshots']);
const entry = resolve(option('--server-entry', '.vercel/output/functions/__server.func/index.mjs'));
const names = existsSync(entry)
  ? Object.fromEntries([...readFileSync(entry, 'utf8').matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName: "([^"]+)"/g)]
    .map(match => [match[1], match[2].replace(/_createServerFn_handler$/, '')]))
  : {};
const fixtureLabel = 'QA 픽스처 · 실시간 API 검증 아님';
// This official-domain URL is a browser transport fixture, never a discovered
// product URL. Its navigation is intercepted without requesting the issuer.
const fixtureProductUrl = 'https://www.soletf.com/ko/fund/etf/qa-fixture-0246X0?qa_fixture=1';
const fixedTime = '2026-10-10T00:00:00.000Z';
const expectedWeights = {
  삼성전자: 25.23,
  'Micron Technology Inc': 24.51,
  SK하이닉스: 24.45,
  'Sandisk Corp/DE': 4.80,
  'APPLIED MATERIALS INC': 4.20,
  'LAM RESEARCH CORP': 4.17,
  'Kioxia Holdings Corp': 3.89,
  'Seagate Technology Holdings': 2.76,
  'KLA-TENCOR CORP': 2.57,
  WESTERN_DIGITAL: 2.22,
  현금성자산: 1.20,
};
assert.deepEqual(Object.fromEntries(snapshot.rows.map(row => [row.nameKo, row.weight])), expectedWeights,
  'Snapshot differs from independently transcribed uploaded document');
assert.equal(snapshot.asOf, '2026-10-08');
assert.equal(snapshot.provenance.sha256, '8181d3c7bf15076729cf0293acc7bb0fc7b447e02dd5fbb12a60610e58a9b730');
assert.equal(Math.round(snapshot.rows.reduce((sum, row) => sum + row.weight, 0) * 100), 10000);

const cases = [
  { id: 'official-resolved', code: snapshot.code, resolved: true, official: true, quoteAvailable: true },
  { id: 'official-unavailable', code: snapshot.code, resolved: false, official: true, quoteAvailable: false },
  { id: 'product-only', code: '999998', resolved: true, official: false, quoteAvailable: true },
  { id: 'unsupported', code: '999999', resolved: false, official: false, quoteAvailable: true },
].filter(item => list('--cases', 'official-resolved,official-unavailable,product-only,unsupported').includes(item.id));
const viewports = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
].filter(item => list('--viewports', 'desktop,mobile').includes(item.id));
const themes = list('--themes', 'light,dark');
const timeout = Number(option('--timeout', '60000'));
assert(Number.isFinite(timeout) && timeout > 0 && timeout <= 60000, 'QA timeout must be 1..60000ms');
assert(cases.length && viewports.length && themes.length && themes.every(theme => ['light', 'dark'].includes(theme)), 'Invalid QA matrix');
mkdirSync(output, { recursive: true });

function rowsFor(item) {
  const rows = item.official ? snapshot.rows : snapshot.rows.slice(0, 2);
  return rows.map((row, index) => {
    const isCash = row.nameKo === '현금성자산';
    const isJapan = row.isin?.startsWith('JP') ?? false;
    const isKoreanEquity = Boolean(row.code);
    const isOverseas = !isCash && !isKoreanEquity;
    return {
      ...row,
      weight: item.official ? row.weight : null,
      weightSource: item.official ? 'official' : 'none',
      asOf: item.official ? snapshot.asOf : null,
      reutersCode: isJapan ? '285A.T' : row.nameKo.startsWith('Micron') ? 'MU.O' : null,
      nation: isJapan ? 'JPN' : isKoreanEquity ? 'KOR' : 'USA',
      market: isKoreanEquity ? 'KOSPI' : null,
      isCash, isBond: false, isFuture: false, isKoreanEquity,
      isKoreanEtf: false, isOverseas,
      assetClass: isCash ? 'cash' : isKoreanEquity ? 'kr-equity' : isJapan ? 'overseas-equity' : 'us-equity',
      // Deliberately extreme JPY price must never alter the issuer percentage.
      quote: isCash ? null : { price: isJapan ? 9999999 : 1200 + index * 100,
        change: 3, changePct: 0.25, volume: 1000000,
        currency: isJapan ? 'JPY' : isKoreanEquity ? 'KRW' : 'USD' },
    };
  });
}

function bundleFor(item) {
  const holdings = rowsFor(item);
  const sums = new Map();
  if (item.official) for (const row of holdings) sums.set(row.assetClass, (sums.get(row.assetClass) ?? 0) + row.weight);
  const labels = { 'kr-equity': '국내주식', 'us-equity': '미국주식', 'overseas-equity': '해외주식', cash: '현금' };
  return {
    etf: { code: item.code, nameKo: item.official ? 'SOL 글로벌DRAM반도체플러스' : 'QA 미지원 ETF',
      issuer: item.official ? snapshot.issuerName : 'QA 미지원 운용사', tabLabel: '해외 주식',
      price: item.quoteAvailable ? 9610 : 0, change: 0, changePct: 0, volume: item.quoteAvailable ? 100000 : 0,
      nav: item.quoteAvailable ? 9697 : 0, retirementEligible: true, isNewCandidate: false,
      quoteAvailable: item.quoteAvailable, source: item.quoteAvailable ? fixtureLabel : 'issuer-file' },
    issuer: item.official ? snapshot.issuerName : 'QA 미지원 운용사',
    description: fixtureLabel,
    descriptionFormatted: { paragraphs: [fixtureLabel], summary: fixtureLabel, bullets: [], plain: fixtureLabel },
    themes: [], themeLabels: [], fee: null, nav: null, marketValue: null,
    holdings, holdingsAsOf: item.official ? snapshot.asOf : null,
    holdingsSource: item.official ? `${snapshot.source} · ${fixtureLabel}` : `네이버 구성내역 참고 · ${fixtureLabel}`,
    holdingsSourceKind: item.official ? 'issuer-file' : 'naver-table',
    holdingsIssuerUrl: item.resolved ? `${fixtureProductUrl}#portfolio` : null,
    issuerProductUrl: item.resolved ? fixtureProductUrl : null,
    issuerHoldingsUrl: item.resolved ? `${fixtureProductUrl}${item.official ? '#portfolio' : ''}` : null,
    issuerLinkStatus: item.resolved ? 'resolved' : 'unavailable',
    holdingsCount: holdings.length, officialCount: item.official ? holdings.length : 0,
    weightBasis: item.official ? 'official' : 'none', officialWeightSum: item.official ? 100 : 0,
    quotedCount: holdings.filter(row => row.quote).length,
    krEquityCount: holdings.filter(row => row.isKoreanEquity).length,
    allocation: [...sums.entries()].map(([id, weight]) => ({ id, label: labels[id], weight })),
    themeStocks: [], peerEtfs: [], peerNote: fixtureLabel, themeNote: fixtureLabel, fetchedAt: fixedTime,
  };
}

function chartBars() {
  return Array.from({ length: 160 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, 2) + index * 86400000).toISOString().slice(0, 10);
    const close = 9600 + index + Math.sin(index / 8) * 100;
    return { date, open: close - 10, high: close + 30, low: close - 30, close, volume: 1000000 };
  });
}

function serverName(url) {
  const id = new URL(url).pathname.split('/_serverFn/')[1] ?? '';
  try {
    return JSON.parse(Buffer.from(decodeURIComponent(id), 'base64url').toString('utf8')).export
      ?.replace(/_createServerFn_handler$/, '') ?? names[id] ?? '';
  } catch { return names[id] ?? ''; }
}

async function fixtures(context, item, result) {
  // Neutralize third-party CSS/scripts only in this browser fixture. Requests
  // to local application assets continue normally; issuer navigation is mocked.
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    result.externalFixtures.push(`${url.origin}${url.pathname}`);
    if (url.href === fixtureProductUrl || url.href === `${fixtureProductUrl}#portfolio`) {
      return route.fulfill({ status: 200, contentType: 'text/html',
        body: '<!doctype html><html lang="ko"><head><title>QA issuer product navigation fixture</title></head><body>QA 픽스처: 운용사 상품 상세 링크 이동 검증. 실제 운용사 페이지를 조회하지 않았습니다.</body></html>' });
    }
    return route.fulfill({ status: 200,
      contentType: request.resourceType() === 'stylesheet' ? 'text/css' : request.resourceType() === 'script' ? 'application/javascript' : 'text/plain',
      body: '' });
  });
  await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/market-stream') return route.fulfill({ status: 200, contentType: 'text/event-stream',
      body: 'event: status\ndata: {"enabled":false,"connected":false,"provider":"QA fixture"}\n\n' });
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ items: [], sources: [], partial: false, nextCursor: null, generatedAt: fixedTime }) });
  });
  await context.route('**/_serverFn/**', async route => {
    const request = route.request();
    const name = serverName(request.url());
    assert(request.method() === 'GET' || (name === 'getChartFlow' && request.method() === 'POST'),
      `Unexpected RPC method ${name}: ${request.method()}`);
    // Chart-flow is a read-only query exposed with POST for its larger payload.
    const raw = request.method() === 'POST' ? request.postData() : new URL(request.url()).searchParams.get('payload');
    let payload;
    try { payload = raw ? fromJSON(JSON.parse(raw)) : {}; }
    catch (error) {
      result.unhandledRpcs.push(`${name} payload decode: ${error.message}`);
      console.error(`Fixture RPC decoding failed: ${name}: ${error.message}`);
      return route.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
    }
    const data = payload.data ?? payload;
    let response;
    if (name === 'getEtfBundle') {
      assert.equal(data.code, item.code);
      response = bundleFor(item);
    } else if (name === 'getChartSecurity') response = {
      code: data.code ?? item.code, market: 'KR', exchange: 'KOSPI', instrument: 'etf',
      currency: 'KRW', quantityUnit: '좌', source: fixtureLabel,
    };
    else if (name === 'getChartData') response = { bars: chartBars(), source: fixtureLabel, events: { dividends: [], splits: [] } };
    else if (name === 'getChartFlow') {
      response = emptyChartFlow(data, fixtureLabel);
      for (const metric of ['credit', 'foreign', 'investmentTrust']) Object.assign(response[metric], {
        capability: 'not-configured', status: 'disabled', health: 'DISABLED', source: fixtureLabel,
      });
    } else if (name === 'getValuationSeries') response = emptyValuationPack(data.code, fixtureLabel);
    else if (name === 'getMarketIndices') response = { indices: [], source: fixtureLabel, fetchedAt: fixedTime };
    else if (name === 'getMarketQuotes') response = { quotes: [], fetchedAt: fixedTime, source: fixtureLabel };
    else if (name === 'getMarketSnapshot') response = { rows: [], fetchedAt: fixedTime, source: fixtureLabel };
    else if (['getStockNews', 'getStockDisclosures'].includes(name)) response = [];
    else {
      result.unhandledRpcs.push(name || 'unmapped RPC');
      response = null;
    }
    result.fixtureCalls.push({ name, method: request.method(), code: data.code ?? null });
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'x-tss-serialized': 'true' },
      body: JSON.stringify(await toCrossJSONAsync({ result: response, error: undefined, context: {} }, { refs: new Map() })) });
  });
}

async function acceptance(page, context, item, result) {
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: '편입 종목 · 운용사 공식 비중' }) });
  await section.locator('tbody tr').first().waitFor();
  const body = await page.locator('body').innerText();
  assert(!body.includes('86.12%'), 'Old currency-derived Kioxia weight still visible');
  assert(!body.includes('시가 비중') && !body.includes('수량×현재가'), 'Live-derived weight labels still visible');
  const actual = await section.locator('tbody tr').evaluateAll(rows => rows.map(row => ({
    name: row.cells[2].querySelector('a, span.font-semibold')?.textContent.trim(),
    weight: row.cells[0].innerText.trim(), price: row.cells[3].innerText.trim(),
  })));
  assert.equal(actual.length, item.official ? snapshot.rows.length : 2);
  assert(actual.every(row => row.price !== '—' || row.name === '현금성자산'), 'Synthetic separate quotes not visible');
  if (item.official) {
    for (const [name, weight] of Object.entries(expectedWeights)) {
      assert.equal(actual.find(row => row.name === name)?.weight, `${weight.toFixed(2)}%`, `${name} uploaded percentage differs`);
    }
    assert.equal(Math.round(actual.reduce((sum, row) => sum + parseFloat(row.weight), 0) * 100), 10000);
    const sourceText = await section.innerText();
    assert(sourceText.includes(snapshot.source), 'Uploaded document provenance absent');
    assert(sourceText.includes(`공시 기준일: ${snapshot.asOf}`), 'Official disclosure date absent');
    assert(sourceText.includes('과거 자료') && sourceText.includes('실시간으로 확인하지 못해'), 'Historical fallback presented as live');
    assert(await page.getByText('100.00%', { exact: true }).count() > 0, 'Official total is not 100%');
  } else {
    assert(actual.every(row => row.weight === '—'), 'Unsupported source manufactured weights from quotes');
    assert(body.includes('운용사 공식 비중을 확인하지 못했습니다.'), 'No-data explanation absent');
    assert.equal(await page.getByRole('heading', { name: '자산군 공식 비중' }).count(), 0);
  }
  const header = page.locator('header.page-header');
  if (!item.quoteAvailable) {
    assert((await header.innerText()).includes('시세 확인 불가'), 'Missing aggregate quote shown as zero');
    assert(!(await header.innerText()).includes('0.00%'), 'Unavailable quote shown as unchanged market');
  }
  if (item.resolved) {
    const destination = `${fixtureProductUrl}${item.official ? '#portfolio' : ''}`;
    const direct = section.getByRole('link', { name: '운용사 공식 구성내역', exact: true });
    assert.equal(await page.getByRole('link', { name: '운용사 공식 구성내역', exact: true }).count(), 1, 'Duplicate issuer action');
    assert.equal(await page.getByRole('link', { name: '운용사 상품 페이지', exact: true }).count(), 0, 'Old issuer action remains');
    assert.equal(await direct.getAttribute('href'), destination);
    assert.equal(await direct.getAttribute('target'), '_blank');
    assert.equal(await direct.getAttribute('rel'), 'noopener noreferrer');
    assert((await direct.boundingBox()).height >= 44, 'Holdings button touch target too small');
    const popupPromise = context.waitForEvent('page');
    await direct.click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    assert.equal(popup.url(), destination);
    assert.equal(await popup.title(), 'QA issuer product navigation fixture');
    await popup.close();
    result.checks.push('One holdings button opens exact test-only destination in a separate tab');
  } else {
    const disabled = section.getByRole('button', { name: '운용사 공식 구성내역', exact: true });
    assert(await disabled.isDisabled(), 'Unavailable direct link enabled');
    assert.equal(await disabled.getAttribute('aria-describedby'), 'issuer-holdings-link-status');
    assert((await section.innerText()).includes('이 ETF의 운용사 공식 구성내역 링크를 확인하지 못했습니다.'));
    assert.equal(await page.getByRole('link', { name: '운용사 공식 구성내역', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '운용사 공식 구성내역', exact: true }).count(), 1);
  }
  assert.equal(result.unhandledRpcs.length, 0, `Unknown RPCs: ${result.unhandledRpcs.join(', ')}`);
  assert(result.fixtureCalls.some(call => call.name === 'getEtfBundle'), 'ETF RPC not intercepted');
  result.weights = actual.map(({ name, weight }) => ({ name, weight }));
  result.checks.push(item.official ? 'Exact uploaded weights, total 100%, dated historical provenance' : 'No official weights despite available quotes');
  return section;
}

const browser = await chromium.launch({ executablePath: option('--browser-executable', '/usr/bin/chromium'),
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const results = [];
try {
  for (const item of cases) for (const viewport of viewports) for (const theme of themes) {
    const id = `${item.id}-${viewport.id}-${theme}`;
    const result = { id, mode: fixtureLabel, status: 'failed', checks: [], pageErrors: [], consoleErrors: [],
      unhandledRpcs: [], fixtureCalls: [], externalFixtures: [], overflow: null };
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile, hasTouch: viewport.hasTouch, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    page.on('pageerror', error => result.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
    try {
      await context.addInitScript(({ theme }) => {
        localStorage.setItem('korea-equity-cc', JSON.stringify({ state: { theme, alertSettings: { paused: true } }, version: 2 }));
      }, { theme });
      await fixtures(context, item, result);
      const response = await page.goto(`${base}/etfs/${item.code}`, { waitUntil: 'domcontentloaded' });
      assert.equal(response?.status(), 200);
      const section = await acceptance(page, context, item, result);
      await page.waitForFunction(theme => document.documentElement.classList.contains('dark') === (theme === 'dark'), theme);
      result.overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(result.overflow <= 1, `Horizontal page overflow ${result.overflow}px`);
      assert.equal(result.pageErrors.length, 0, result.pageErrors.join('; '));
      assert.equal(result.consoleErrors.length, 0, result.consoleErrors.join('; '));
      await page.evaluate(label => {
        const note = document.createElement('div'); note.textContent = label;
        Object.assign(note.style, { position: 'fixed', bottom: '0', right: '0', zIndex: '2147483647',
          background: '#fff4c2', color: '#1d232d', fontSize: '12px', padding: '6px 10px', maxWidth: '100%' });
        document.body.append(note);
      }, fixtureLabel);
      await page.locator('header.page-header').scrollIntoViewIfNeeded();
      result.headerScreenshot = join(output, `${id}-header.png`);
      await page.screenshot({ path: result.headerScreenshot, fullPage: false });
      await section.locator('h2').scrollIntoViewIfNeeded();
      result.holdingsScreenshot = join(output, `${id}-holdings.png`);
      await page.screenshot({ path: result.holdingsScreenshot, fullPage: false });
      result.status = 'passed';
      console.log(`PASS ${id}: ${result.checks.join('; ')}`);
    } catch (error) {
      result.error = error.message;
      await page.screenshot({ path: join(output, `${id}-failed.png`), fullPage: false }).catch(() => {});
      console.error(`FAIL ${id}: ${error.message}`);
    } finally {
      results.push(result);
      await context.close();
      writeFileSync(join(output, 'verdict.json'), JSON.stringify({ mode: fixtureLabel,
        liveApisVerified: false, uploadedDocument: snapshot.provenance, snapshotAsOf: snapshot.asOf,
        productLink: { url: fixtureProductUrl, testOnly: true, issuerPageFetched: false }, results }, null, 2));
    }
  }
} finally { await browser.close(); }
assert(results.every(result => result.status === 'passed'), `${results.filter(result => result.status !== 'passed').length} ETF fixture checks failed`);
