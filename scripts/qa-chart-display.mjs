#!/usr/bin/env node
/** Deterministic browser acceptance for display controls. QA transport only:
 * synthetic prices/events never enter a service fallback or a production cache.
 * node --experimental-strip-types scripts/qa-chart-display.mjs
 * --base <internal QA URL> --out /workspace/screenshots/chart-display/dev
 * --cases stock,etf,us --viewports desktop,mobile --themes light,dark --dprs 1,2
 * --function-map <built RPC-id map> --interactions --legacy
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { defaultHtsSettings } from '../src/lib/charts/hts-settings.ts';
import { defaultIndicators } from '../src/lib/charts/catalog.ts';

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const list = (name, fallback) => arg(name, fallback).split(',').filter(Boolean);
const base = arg('--base', process.env.QA_BASE ?? 'http://127.0.0.1:8080');
const output = resolve(arg('--out', '/workspace/screenshots/chart-display/dev'));
const functionMap = arg('--function-map', '');
const names = functionMap ? JSON.parse(readFileSync(functionMap, 'utf8')) : {};
const timeout = Number(arg('--timeout', '30000'));
const themes = list('--themes', 'light,dark');
const dprs = list('--dprs', '1,2').map(Number);
const interactive = args.includes('--interactions');
const legacy = args.includes('--legacy');
const selectedChecks = list('--checks', '');
const cases = [
  { id: 'stock', code: '005930', path: '/stock/005930', instrument: 'stock', market: 'KR' },
  { id: 'etf', code: '069500', path: '/etfs/069500', instrument: 'etf', market: 'KR' },
  { id: 'us', code: 'NVDA', path: '/us/NVDA', instrument: 'stock', market: 'US' },
  { id: 'workspace-split', code: '005930', path: '/chart?symbols=KR%3A005930%2CKR%3A069500&layout=2', instrument: 'stock', market: 'KR', workspace: true },
].filter(x => list('--cases', 'stock,etf,us').includes(x.id));
const viewports = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
].filter(x => list('--viewports', 'desktop,mobile').includes(x.id));
assert(cases.length && viewports.length && themes.length && dprs.length, 'empty QA matrix');
mkdirSync(output, { recursive: true });

function fixtureBars(code) {
  const rows = [];
  const isUs = /^[A-Z]/.test(code);
  const center = isUs ? 100 : 10000;
  const step = isUs ? 1 : 100;
  for (let day = 0; rows.length < 180; day++) {
    const date = new Date(Date.UTC(2026, 0, 2) + day * 86400000);
    if ([0, 6].includes(date.getUTCDay())) continue;
    const i = rows.length;
    const close = center + Math.sin(i / 6) * step * 3 + Math.sin(i / 15) * step;
    const open = close + Math.cos(i / 5) * step * 0.8;
    rows.push({ date: date.toISOString().slice(0, 10), open,
      high: Math.max(open, close) + step * 0.7, low: Math.min(open, close) - step * 0.7,
      close, volume: 1000000 + (i % 7) * 120000 });
  }
  return rows;
}
function fixtureEvents(code) {
  const bars = fixtureBars(code);
  const date = bars.at(-25).date;
  const earlier = bars.at(-40).date;
  const research = Array.from({ length: 32 }, (_, i) => ({
    id: `qa-report-${i}`, researchId: 90000 + i, nid: 90000 + i, code,
    date, publishedAt: `${date}T00:00:00Z`, broker: `QA 증권 ${i}`,
    title: `QA SYNTHETIC 리포트 ${i} — 실데이터 아님, 긴 원문 제목`,
    rating: '매수', targetPrice: 12000 + i * 10,
    prevTargetPrice: i < 12 ? 11000 : undefined,
    url: i % 2 ? undefined : `https://example.invalid/qa/report/${i}`,
    pageUrl: i % 2 ? undefined : `https://example.invalid/qa/report/${i}`,
    source: 'QA SYNTHETIC (실데이터 아님)', category: 'company',
  }));
  research.push(...Array.from({ length: 6 }, (_, i) => ({
    id: `qa-report-old-${i}`, researchId: 89000 + i, nid: 89000 + i, code,
    date: earlier, publishedAt: `${earlier}T00:00:00Z`, broker: `QA 증권 ${i}`,
    title: `QA SYNTHETIC 이전 리포트 ${i} — 실데이터 아님`,
    rating: '매수', targetPrice: 11000,
    source: 'QA SYNTHETIC (실데이터 아님)', category: 'company',
  })));
  const disclosures = Array.from({ length: 30 }, (_, i) => ({
    id: `qa-disclosure-${i}`, code, title: `QA SYNTHETIC 공시 ${i} — 실데이터 아님, 긴 제목`,
    datetime: `${date} 09:${String(i).padStart(2, '0')}:00`, author: 'QA SYNTHETIC',
    source: 'qa-fixture', sourceLabel: 'QA SYNTHETIC (실데이터 아님)',
    dartUrl: i % 2 ? undefined : `https://example.invalid/qa/disclosure/${i}`,
  }));
  return { bars, date, earlier, research, disclosures };
}
function aggregateFixtureBars(rows, interval) {
  if (!['week', 'month', 'year'].includes(interval)) return rows;
  const groups = new Map();
  for (const row of rows) {
    let date = row.date;
    if (interval === 'month') date = `${date.slice(0, 7)}-01`;
    if (interval === 'year') date = `${date.slice(0, 4)}-01-01`;
    if (interval === 'week') {
      const day = new Date(`${date}T00:00:00Z`);
      day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
      date = day.toISOString().slice(0, 10);
    }
    const prior = groups.get(date);
    if (!prior) groups.set(date, { ...row, date });
    else groups.set(date, { ...prior, high: Math.max(prior.high, row.high), low: Math.min(prior.low, row.low), close: row.close, volume: prior.volume + row.volume });
  }
  return [...groups.values()];
}
function serverName(url) {
  try {
    const encoded = new URL(url).pathname.split('/_serverFn/')[1] ?? '';
    return names[encoded] ?? JSON.parse(Buffer.from(decodeURIComponent(encoded), 'base64url').toString()).export?.replace(/_createServerFn_handler$/, '') ?? '';
  } catch { return ''; }
}
async function fixtures(page, result) {
  const { fromJSON, toCrossJSONAsync } = await import('seroval');
  await page.route('**/_serverFn/**', async route => {
    const name = serverName(route.request().url());
    const handled = ['getChartData', 'getChartFlow', 'getStockBundle', 'getEtfBundle', 'getChartSecurity', 'getUsChartSecurity', 'getStockNews', 'getStockDisclosures'];
    if (!handled.includes(name)) return route.continue();
    let data = {};
    try {
      const raw = route.request().method() === 'POST' ? route.request().postData() : new URL(route.request().url()).searchParams.get('payload');
      const payload = raw ? fromJSON(JSON.parse(raw)) : {};
      data = payload.data ?? payload;
    } catch { /* Invalid RPC requests fail normal assertions. */ }
    const code = data.code ?? result.code;
    const item = fixtureEvents(code);
    const etf = code === '069500' || code === '379800';
    let response;
    if (name === 'getChartData') response = { bars: aggregateFixtureBars(item.bars, data.interval), source: 'QA SYNTHETIC (실데이터 아님) OHLCV',
      events: { dividends: [{ date: item.date, amount: 1 }], splits: [{ date: item.earlier, ratio: '2:1' }] } };
    if (name === 'getStockBundle') response = {
      meta: { code, nameKo: 'QA SYNTHETIC (실데이터 아님)', nameEn: 'QA SYNTHETIC', market: 'KOSPI', sectorId: 'electronics' },
      quote: null, basic: null, flow: { days: [], source: 'QA SYNTHETIC' }, research: item.research,
      researchPack: { company: item.research, industry: [], market: [], economy: [] }, news: [], disclosures: item.disclosures,
      disclosureMeta: { kind: { available: false, message: 'QA SYNTHETIC', url: 'https://example.invalid' }, dartCount: 0, koscomCount: 0 },
      fetchedAt: '2026-10-04T00:00:00Z',
    };
    if (name === 'getEtfBundle') response = { etf: { code, nameKo: 'QA SYNTHETIC ETF (실데이터 아님)', price: 10000, changePct: 0, volume: 1000000 },
      holdings: [], peerEtfs: [], allocation: [], themeStocks: [], themeLabels: [], descriptionFormatted: { paragraphs: [], bullets: [], plain: '', summary: '' },
      issuer: 'QA SYNTHETIC', holdingsAsOf: null, officialCount: 0, weightBasis: 'none', source: 'QA SYNTHETIC' };
    if (['getChartSecurity', 'getUsChartSecurity'].includes(name)) response = { code, market: name === 'getUsChartSecurity' ? 'US' : 'KR',
      exchange: name === 'getUsChartSecurity' ? 'NASDAQ' : 'KOSPI', instrument: etf ? 'etf' : 'stock',
      currency: name === 'getUsChartSecurity' ? 'USD' : 'KRW', quantityUnit: etf ? '좌' : '주', source: 'QA SYNTHETIC (실데이터 아님)' };
    if (name === 'getChartFlow') {
      const { kiwoomBrowserFixture } = await import('./qa-kiwoom-fixture.mjs');
      response = await kiwoomBrowserFixture(data, item.bars);
    }
    if (['getStockNews', 'getStockDisclosures'].includes(name)) response = [];
    result.fixtureCalls.push({ name, code, method: route.request().method() });
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'x-tss-serialized': 'true' },
      body: JSON.stringify(await toCrossJSONAsync({ result: response, error: undefined, context: {} }, { refs: new Map() })) });
  });
  await page.route('**/api/feed?**', async route => {
    const url = new URL(route.request().url());
    const code = url.searchParams.get('tickers')?.split(',')[0] ?? result.code;
    const day = fixtureEvents(code).date;
    const items = Array.from({ length: 12 }, (_, i) => ({ id: `qa-news-${i}`, kind: 'news', region: 'KR', sourceId: 'qa-fixture',
      sourceName: 'QA SYNTHETIC (실데이터 아님)', sourceTier: 3, title: `QA SYNTHETIC 뉴스 ${i} — 실데이터 아님`,
      url: `https://example.invalid/qa/news/${i}`, publishedAt: `${day}T00:00:00Z`, precision: 'second',
      fetchedAt: '2026-10-04T00:00:00Z', tickers: [{ market: 'KR', code }], sectors: [], topics: [], lang: 'ko' }));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items, nextCursor: null, sources: [], partial: false, generatedAt: '2026-10-04T00:00:00Z' }) });
  });
  await page.route('**/api/market-stream?**', route => route.fulfill({ status: 200, contentType: 'text/event-stream',
    body: 'event: status\ndata: {"enabled":false,"connected":false,"provider":"QA SYNTHETIC"}\n\n' }));
}

// Observe actual Canvas API calls, without adding a product test hook. Media
// coordinates, CSS plot bounds, canvas DPR and native transform are recorded.
function canvasProbe() {
  window.__chartQa = { rects: [], texts: [], arcs: [], candles: [], axisTexts: [], paints: 0 };
  window.__chartQaEventSources = [];
  const NativeEventSource = window.EventSource;
  window.EventSource = class extends NativeEventSource {
    constructor(...args) { super(...args); window.__chartQaEventSources.push(this); }
  };
  const originalRect = CanvasRenderingContext2D.prototype.fillRect;
  const originalText = CanvasRenderingContext2D.prototype.fillText;
  const originalArc = CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc = function (x, y, radius) {
    const pane = this.canvas.closest('[data-hts-pane]')?.getAttribute('data-hts-pane') ?? null;
    if (pane === 'price') {
      const rect = this.canvas.getBoundingClientRect(); const t = this.getTransform(); const dpr = this.canvas.width / rect.width;
      window.__chartQa.arcs.push({ localX: (x * t.a + y * t.c + t.e) / dpr,
        localY: (x * t.b + y * t.d + t.f) / dpr, radius: radius * t.a / dpr, color: String(this.fillStyle) });
      if (window.__chartQa.arcs.length > 1000) window.__chartQa.arcs.splice(0, 500);
    }
    return originalArc.apply(this, arguments);
  };
  CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
    const color = String(this.fillStyle).toLowerCase();
    const pane = this.canvas.closest('[data-hts-pane]')?.getAttribute('data-hts-pane') ?? null;
    if (pane === 'price' && ['#ef4444', '#3b82f6', '#ef4444ff', '#3b82f6ff'].includes(color)) {
      const rect = this.canvas.getBoundingClientRect(); const t = this.getTransform(); const dpr = this.canvas.width / rect.width;
      window.__chartQa.candles.push({ x: (x * t.a + t.e) / dpr, y: (y * t.d + t.f) / dpr,
        width: width * t.a / dpr, height: height * t.d / dpr, color });
      if (window.__chartQa.candles.length > 5000) window.__chartQa.candles.splice(0, 2000);
    }
    if (['#e6b77c', '#d9a15a', '#e7b157', '#123456'].includes(color)) {
      const rect = this.canvas.getBoundingClientRect();
      const transform = this.getTransform();
      window.__chartQa.rects.push({ x, y, width, height, color, alpha: this.globalAlpha,
        cssWidth: rect.width, cssHeight: rect.height, dpr: this.canvas.width / rect.width,
        scaleX: transform.a, scaleY: transform.d, pane: this.canvas.closest('[data-hts-pane]')?.getAttribute('data-hts-pane') ?? null });
      if (window.__chartQa.rects.length > 3000) window.__chartQa.rects.splice(0, 1000);
    }
    return originalRect.apply(this, arguments);
  };
  CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
    const rect = this.canvas.getBoundingClientRect(); const t = this.getTransform(); const dpr = this.canvas.width / rect.width;
    const pane = this.canvas.closest('[data-hts-pane]')?.getAttribute('data-hts-pane') ?? null;
    if (pane === 'price' && rect.width < 150 && /^[\d,.]+$/.test(String(text))) {
      window.__chartQa.axisTexts.push({ text: String(text), y: (y * t.d + t.f) / dpr });
      if (window.__chartQa.axisTexts.length > 1000) window.__chartQa.axisTexts.splice(0, 500);
    }
    if (/공시|리포트|TP|신호|배당|분할|뉴스|QA SYNTHETIC|약 [\d,]+/.test(String(text))) {
      window.__chartQa.texts.push({ text: String(text), x, y, color: String(this.fillStyle), alpha: this.globalAlpha,
        screenX: rect.left + (x * t.a + y * t.c + t.e) / dpr,
        screenY: rect.top + (x * t.b + y * t.d + t.f) / dpr,
        localX: (x * t.a + y * t.c + t.e) / dpr, localY: (x * t.b + y * t.d + t.f) / dpr,
        textWidth: this.measureText(String(text)).width * t.a / dpr, textAlign: this.textAlign, pane });
      if (window.__chartQa.texts.length > 3000) window.__chartQa.texts.splice(0, 1000);
    }
    return originalText.apply(this, arguments);
  };
}
async function closePanels(page) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].every(el => !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden'));
}
async function toggle(page, name, target) {
  let button = page.getByTestId(`overlay-toggle-${name}`).filter({ visible: true }).first();
  if (!await button.count()) {
    await page.getByTestId('chart-display-menu').first().click();
    button = page.getByTestId(name === 'range' ? 'overlay-toggle-range' : `overlay-menu-${name}`).filter({ visible: true }).first();
  }
  const current = (await button.getAttribute('aria-pressed') ?? await button.getAttribute('aria-checked')) === 'true';
  if (target !== current) await button.click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
}
async function snapshot(page, item) {
  return page.evaluate(({ code, market, instrument }) => {
    const scope = `:${code}:day:${instrument}:detail`;
    const layoutEntry = Object.entries(localStorage).find(([k]) => k.startsWith(`ked:chart:v2:${market}:${code}:`) && k.endsWith(scope.slice(scope.indexOf(':day:') + 1)));
    const htsEntry = Object.entries(localStorage).find(([k]) => k.startsWith(`ked:hts:v1:${market}:${instrument}:${code}:day:detail`));
    const chart = document.querySelector('[data-testid="chart-canvas"]');
    return {
      layoutKey: layoutEntry?.[0], layout: layoutEntry ? JSON.parse(layoutEntry[1]) : null,
      htsKey: htsEntry?.[0], hts: htsEntry ? JSON.parse(htsEntry[1]) : null,
      visible: [chart?.getAttribute('data-visible-from'), chart?.getAttribute('data-visible-to')],
      markerCount: Number(chart?.getAttribute('data-marker-count') ?? 0), eventItems: Number(chart?.getAttribute('data-event-items') ?? 0),
      eventGroups: Number(chart?.getAttribute('data-event-groups') ?? 0), categories: JSON.parse(chart?.getAttribute('data-event-categories') ?? '{}'),
      rangeEnabled: chart?.getAttribute('data-range-enabled'),
      paneHeights: Object.fromEntries([...document.querySelectorAll('[data-hts-pane]')].map(el => [el.getAttribute('data-hts-pane'), el.getBoundingClientRect().height])),
      overflow: document.documentElement.scrollWidth - innerWidth,
      devicePixelRatio: window.devicePixelRatio,
      rects: window.__chartQa?.rects ?? [], texts: window.__chartQa?.texts ?? [],
      candles: window.__chartQa?.candles ?? [], axisTexts: window.__chartQa?.axisTexts ?? [],
      arcs: window.__chartQa?.arcs ?? [],
    };
  }, item);
}
async function clearProbe(page) { await page.evaluate(() => { window.__chartQa.rects = []; window.__chartQa.texts = []; window.__chartQa.arcs = []; window.__chartQa.candles = []; window.__chartQa.axisTexts = []; }); }
const candleGeometry = state => [...new Set(state.candles.map(r => [r.x, r.y, r.width, r.height].map(n => Math.round(n * 1000) / 1000).join('|') + '|' + r.color))].sort();
const axisGeometry = state => [...new Set(state.axisTexts.map(r => `${r.text}|${Math.round(r.y * 1000) / 1000}`))].sort();
async function geometry(page, item, ratio) {
  await clearProbe(page);
  const button = page.getByTestId('profile-toggle').filter({ visible: true }).first();
  await button.click(); await page.waitForTimeout(80); await button.click();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(220);
  const state = await snapshot(page, item);
  const rects = state.rects.filter(r => r.pane === 'price' || item.market === 'US' && r.pane == null);
  assert(rects.length, 'profile fillRect was never drawn');
  assert(rects.every(r => r.x === 0), 'profile does not start at plot left 0');
  assert(rects.every(r => item.market === 'US' || r.pane === 'price'), 'profile leaked into another pane');
  const max = rects.reduce((a, b) => a.width > b.width ? a : b);
  assert(Math.abs(max.width - max.cssWidth * ratio) <= 2, `actual profile width ${max.width} / ${max.cssWidth}; expected ratio ${ratio}`);
  assert(Math.abs(max.scaleX - max.dpr) < 0.05, `DPR/media scaling mismatch ${max.scaleX}/${max.dpr}`);
  return { measuredWidth: max.width, plotWidth: max.cssWidth, expectedWidth: max.cssWidth * ratio,
    dpr: max.dpr, actualTransformScale: max.scaleX, color: max.color, fillAlpha: max.alpha, pricePaneOnly: true };
}
async function png(page, name) {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('chart-export-png').filter({ visible: true }).first().click(),
  ]);
  const path = join(output, `${name}-export.png`);
  await file.saveAs(path);
  const bytes = readFileSync(path);
  assert.equal(bytes.toString('hex', 0, 8), '89504e470d0a1a0a', 'download is not PNG');
  const width = bytes.readUInt32BE(16); const height = bytes.readUInt32BE(20);
  assert(width > 100 && height > 100 && bytes.length > 2000, 'PNG export is blank/undersized');
  const pixels = await page.evaluate(async (dataUrl) => {
    const image = new Image(); image.src = dataUrl; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const bounds = document.querySelector('[data-testid="chart-canvas"]').getBoundingClientRect();
    // The provenance footer can be long on mobile. Check rendered native chart
    // pixels separately so footer wrapping does not dilute the theme evidence.
    const nativeHeight = Math.min(canvas.height, Math.floor(bounds.height * canvas.width / bounds.width));
    const data = ctx.getImageData(0, 0, canvas.width, nativeHeight).data;
    const palette = document.createElement('canvas').getContext('2d');
    palette.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card').trim();
    palette.fillRect(0, 0, 1, 1);
    const expected = [...palette.getImageData(0, 0, 1, 1).data];
    let samples = 0; let background = 0; let transparent = 0; const colors = new Set();
    const stride = Math.max(4, Math.floor(data.length / 16000 / 4) * 4);
    for (let i = 0; i < data.length; i += stride) {
      samples++; if (data[i + 3] < 255) transparent++;
      if (expected.every((n, offset) => Math.abs(n - data[i + offset]) <= 1)) background++;
      colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    }
    return { expectedBackground: expected, nativeHeight, backgroundFraction: background / samples,
      transparentFraction: transparent / samples, sampledColors: colors.size };
  }, `data:image/png;base64,${bytes.toString('base64')}`);
  assert(pixels.backgroundFraction > 0.2, `PNG background does not match actual theme (${pixels.backgroundFraction})`);
  assert(pixels.transparentFraction < 0.01, 'PNG chart background remained transparent');
  assert(pixels.sampledColors > 20, 'PNG price/indicator canvas appears blank');
  await closePanels(page);
  return { path, width, height, bytes: bytes.length, pixels };
}
async function readiness(page) {
  await page.getByTestId('chart-readability').first().waitFor();
  await page.getByTestId('profile-details').locator('tbody tr').first().waitFor({ state: 'attached' });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="chart-canvas"]');
    return canvas?.getAttribute('data-visible-from') != null && canvas?.getAttribute('data-visible-to') != null;
  });
  await page.waitForTimeout(350);
}
async function workspaceAcceptance(page, result, viewport) {
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="chart-readability"]').length === 2 &&
    [...document.querySelectorAll('[data-testid="profile-details"]')].every(el => el.querySelectorAll('tbody tr').length > 0));
  const before = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    controls: [...document.querySelectorAll('[data-testid="chart-readability"]')].map(el => ({ disabled: el.disabled, text: el.textContent })) }));
  assert.equal(before.controls.length, 2); assert(before.controls.every(x => !x.disabled));
  assert(before.scrollWidth <= before.width + 1, 'split workspace created horizontal overflow');
  const first = page.getByTestId('workspace-pane-0'); const second = page.getByTestId('workspace-pane-1');
  await first.getByTestId('overlay-toggle-research').click();
  assert.equal(await first.getByTestId('overlay-toggle-research').getAttribute('aria-pressed'), 'true');
  assert.equal(await second.getByTestId('overlay-toggle-research').getAttribute('aria-pressed'), 'false', 'split chart toggle leaked');
  await first.getByTestId('chart-readability').click();
  result.checks.push({ name: 'split chart controls, independent toggles and overflow', status: 'passed', detail: before });
  if (viewport.id === 'desktop') {
    await first.getByTestId('chart-fullscreen').click();
    await page.waitForFunction(() => Boolean(document.fullscreenElement));
    const inFull = async testId => {
      const popup = page.getByTestId(testId); await popup.waitFor();
      assert(await popup.evaluate(el => document.fullscreenElement?.contains(el)), `${testId} is outside native fullscreen element`);
      assert(await popup.isVisible(), `${testId} is not visible in native fullscreen`);
    };
    await first.getByTestId('chart-display-menu').click();
    const menu = page.getByRole('menu'); await menu.waitFor();
    assert(await menu.evaluate(el => document.fullscreenElement.contains(el)), 'display menu portal escaped fullscreen');
    await page.keyboard.press('Escape');
    if (!await page.evaluate(() => Boolean(document.fullscreenElement))) { await first.getByTestId('chart-fullscreen').click(); await page.waitForFunction(() => Boolean(document.fullscreenElement)); }
    await first.getByTestId('open-hts-settings').click(); await inFull('hts-settings');
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByTestId('hts-settings').waitFor({ state: 'hidden' });
    for (const [label, id] of [['기술지표 표시 설정', 'indicator-panel'], ['수동 그리기 객체 관리', 'object-manager']]) {
      await first.getByTestId('chart-display-menu').click(); await page.getByRole('menuitem', { name: label, exact: true }).click();
      await inFull(id);
      await page.getByTestId(id).getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByTestId(id).waitFor({ state: 'hidden' });
    }
    await first.getByTestId('chart-display-menu').click(); await page.getByTestId('annotations-show-all').click();
    await first.getByTestId('chart-event-list').waitFor(); await first.getByTestId('chart-event-list').click(); await inFull('chart-event-details');
    assert(await page.getByTestId('chart-event-details').getByTestId('chart-event-item').count() >= 2, 'workspace event detail omitted dividend/split fixture');
    await page.getByTestId('chart-event-details').getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByTestId('chart-event-details').waitFor({ state: 'hidden' });
    result.fullscreenScreenshot = join(output, `${result.id}-fullscreen-menu.png`);
    await first.getByTestId('chart-display-menu').click(); await page.screenshot({ path: result.fullscreenScreenshot, fullPage: false });
    await page.keyboard.press('Escape');
    if (await page.evaluate(() => Boolean(document.fullscreenElement))) await page.evaluate(() => document.exitFullscreen());
    result.checks.push({ name: 'native fullscreen menu, settings, indicators, objects and event detail', status: 'passed', detail: { allPortalsInsideFullscreen: true } });
  } else {
    await first.getByTestId('chart-display-menu').click(); await page.getByTestId('overlay-menu-news').waitFor(); await page.keyboard.press('Escape');
    await first.getByTestId('open-hts-settings').click(); await page.getByTestId('hts-settings').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByTestId('hts-settings').waitFor({ state: 'hidden' });
    await second.getByTestId('chart-readability').scrollIntoViewIfNeeded(); await second.getByTestId('chart-readability').click();
    result.checks.push({ name: 'mobile compact split display controls and settings reachable', status: 'passed', detail: { bothChartsReachable: true } });
  }
  result.screenshot = join(output, `${result.id}-split.png`); await page.screenshot({ path: result.screenshot, fullPage: false });
}

async function interactions(page, item, result) {
  const check = async (name, fn) => {
    if (selectedChecks.length && !selectedChecks.some(s => name.includes(s))) return;
    try { const detail = await fn(); result.checks.push({ name, status: 'passed', detail }); console.log(`  PASS ${result.id}: ${name}`); }
    catch (error) { result.checks.push({ name, status: 'failed', error: String(error).slice(0, 1200) }); console.log(`  FAIL ${result.id}: ${name}: ${String(error).slice(0, 500)}`); await page.screenshot({ path: join(output, `${result.id}-${name.replaceAll(/[^a-z0-9]/g, '-')}-failed.png`), fullPage: false }).catch(() => {}); await closePanels(page).catch(() => {}); }
  };
  await check('independent categories and dense event details', async () => {
    await page.getByTestId('chart-readability').first().click(); await page.waitForTimeout(350);
    await geometry(page, item, 0.85);
    const before = await snapshot(page, item);
    const baselineCandles = candleGeometry(before); const baselineAxis = axisGeometry(before);
    assert(baselineCandles.length > 100, 'baseline did not observe actual candle rectangles');
    assert(baselineAxis.length > 2, 'baseline did not observe actual native price-axis labels');
    assert.equal(before.markerCount, 0); assert.equal(before.eventItems, 0); assert.equal(before.rangeEnabled, 'false');
    const captures = {};
    for (const category of ['disclosures', 'research', 'targets', 'signals']) {
      await clearProbe(page); await toggle(page, category, true);
      const state = await snapshot(page, item);
      assert(state.eventItems > 0, `${category} did not produce any events`);
      assert.equal(state.visible.join('|'), before.visible.join('|'), 'toggle reset zoom');
      assert.deepEqual(state.paneHeights, before.paneHeights, 'toggle changed pane geometry');
      assert.deepEqual(candleGeometry(state), baselineCandles, 'automatic markers changed actual candle geometry');
      assert.deepEqual(axisGeometry(state), baselineAxis, 'automatic markers changed actual native price scale');
      assert(state.eventGroups < state.eventItems || category === 'signals', 'dense events were not compacted');
      assert(!state.texts.some(x => /QA SYNTHETIC.*긴.*제목/.test(x.text)), 'full titles are painted over candles');
      captures[category] = { items: state.eventItems, groups: state.eventGroups, markers: state.markerCount, categories: state.categories,
        candleRectangles: baselineCandles.length, priceAxisLabels: baselineAxis.length,
        canvasLabels: [...new Set(state.texts.map(x => x.text))].filter(x => !x.startsWith('약 ')) };
      if (category === 'disclosures') {
        const marker = state.texts.find(x => /^공시/.test(x.text) && x.pane === 'price' && Number.isFinite(x.screenX));
        assert(marker, 'actual native disclosure marker text was not drawn');
        const textCenter = marker.localX + (marker.textAlign === 'left' || marker.textAlign === 'start' ? marker.textWidth / 2 : 0);
        const arc = state.arcs.filter(x => x.radius > 0 && x.radius < 20)
          .sort((a, b) => Math.abs(a.localX - textCenter) + Math.abs(a.localY - marker.localY) - Math.abs(b.localX - textCenter) - Math.abs(b.localY - marker.localY))[0];
        assert(arc && Math.abs(arc.localX - textCenter) < 20 && Math.abs(arc.localY - marker.localY) < 30, 'native marker circle was not observed');
        const pane = page.locator('[data-hts-pane="price"]').first(); await pane.scrollIntoViewIfNeeded();
        const bounds = await pane.locator('canvas').first().boundingBox();
        const hit = { x: bounds.x + arc.localX, y: bounds.y + arc.localY };
        await page.mouse.move(hit.x, hit.y); await page.waitForTimeout(150);
        await page.getByTestId('chart-event-tooltip').waitFor();
        await page.mouse.click(hit.x, hit.y);
        await page.getByTestId('chart-event-details').waitFor();
        assert(await page.getByTestId('chart-event-details').getByTestId('chart-event-item').count() >= 30, 'canvas hit target did not open group originals');
        await closePanels(page); await page.mouse.move(5, 5);
        captures[category].canvasHoverAndClick = true;
        captures[category].hitLocal = { x: arc.localX, y: arc.localY };
      }
      await page.getByTestId('chart-event-list').first().click();
      const sheet = page.getByTestId('chart-event-details'); await sheet.waitFor();
      const originalCount = await sheet.getByTestId('chart-event-item').count();
      assert.equal(originalCount, state.eventItems, 'detail lost original items');
      if (category === 'disclosures') assert(originalCount >= 30, 'dense disclosure originals were lost');
      if (category === 'research') assert(originalCount >= 32, 'dense report originals were lost');
      if (category === 'research') {
        // An identical SSE status still rerenders StockPage, whose producer
        // arrays get new identities. Details must survive unchanged event data.
        const sources = await page.evaluate(() => {
          for (const source of window.__chartQaEventSources) source.dispatchEvent(new MessageEvent('status', {
            data: JSON.stringify({ enabled: false, connected: false, provider: 'QA SYNTHETIC' }),
          }));
          return window.__chartQaEventSources.length;
        });
        assert(sources > 0, 'stock SSE status transport was not present for refresh regression');
        await page.waitForTimeout(250);
        assert.equal(await sheet.getByTestId('chart-event-item').count(), originalCount, 'unchanged source refresh cleared open detail');
        captures[category].identicalSourceRefreshPreservedDetail = true;
      }
      await closePanels(page);
      const groupDetails = page.getByTestId('chart-event-groups');
      await groupDetails.locator('summary').click();
      const group = groupDetails.getByTestId('chart-event-group').first();
      const groupCount = Number(await group.getAttribute('data-event-count'));
      await group.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.getByTestId('chart-event-details').getByTestId('chart-event-item').count(), groupCount, 'focused group lost original items');
      await closePanels(page);
      await page.waitForFunction(el => document.activeElement === el, await group.elementHandle(), { timeout: 2000 });
      await groupDetails.locator('summary').click();
      await toggle(page, category, false);
      const off = await snapshot(page, item); assert.equal(off.eventItems, 0); assert.equal(off.markerCount, 0);
      assert.equal(await page.getByTestId('chart-event-details').count(), 0, 'closed/off detail retained stale items');
      assert.equal(await page.getByTestId('chart-event-tooltip').count(), 0, 'OFF retained an automatic marker tooltip');
      if (category === 'disclosures') {
        const pane = page.locator('[data-hts-pane="price"]').first(); await pane.scrollIntoViewIfNeeded();
        const bounds = await pane.locator('canvas').first().boundingBox();
        const hit = captures[category].hitLocal;
        await page.mouse.move(bounds.x + hit.x, bounds.y + hit.y);
        await page.mouse.click(bounds.x + hit.x, bounds.y + hit.y); await page.waitForTimeout(120);
        assert.equal(await page.getByTestId('chart-event-tooltip').count(), 0, 'OFF retained the native marker hover hit target');
        assert.equal(await page.getByTestId('chart-event-details').count(), 0, 'OFF retained the native marker click hit target');
        await page.mouse.move(5, 5);
      }
    }
    await toggle(page, 'disclosures', true); await toggle(page, 'research', true); await toggle(page, 'targets', true);
    await page.screenshot({ path: join(output, `${result.id}-annotations-on.png`), fullPage: false });
    result.annotationsOnUi = join(output, `${result.id}-annotations-on-ui.png`);
    await page.getByTestId('trading-chart').screenshot({ path: result.annotationsOnUi });
    result.exports ??= []; result.exports.push(await png(page, `${result.id}-annotations-on`));
    await page.getByTestId('chart-readability').first().click(); await page.waitForTimeout(350);
    await page.screenshot({ path: join(output, `${result.id}-annotations-off.png`), fullPage: false });
    result.annotationsOffUi = join(output, `${result.id}-annotations-off-ui.png`);
    await page.getByTestId('trading-chart').screenshot({ path: result.annotationsOffUi });
    result.exports.push(await png(page, `${result.id}-annotations-off`));
    return captures;
  });
  await check('theme auto and explicit custom color', async () => {
    const currentTheme = await page.locator('html').evaluate(el => el.classList.contains('dark') ? 'dark' : 'light');
    const before = await snapshot(page, item);
    await clearProbe(page);
    await page.getByRole('button', { name: '테마 전환', exact: true }).click(); await page.waitForTimeout(350);
    const changed = await snapshot(page, item);
    const newColor = currentTheme === 'light' ? '#d9a15a' : '#e6b77c';
    assert(changed.rects.some(x => x.color === newColor), 'automatic profile color did not follow theme');
    assert.equal(changed.visible.join('|'), before.visible.join('|'), 'theme reset time range');
    await page.getByTestId('open-hts-settings').filter({ visible: true }).first().click();
    const settings = page.getByTestId('hts-settings'); await settings.waitFor();
    await settings.getByLabel(/색상 방식/).selectOption('custom');
    await settings.getByLabel('막대 색상', { exact: true }).fill('#123456');
    await closePanels(page); await page.waitForTimeout(350); await clearProbe(page);
    await page.getByRole('button', { name: '테마 전환', exact: true }).click(); await page.waitForTimeout(350);
    const custom = await snapshot(page, item);
    assert(custom.rects.some(x => x.color === '#123456'), 'theme overwrote explicit custom color');
    await page.getByTestId('chart-readability').first().click(); await page.waitForTimeout(350);
    return { themeWas: currentTheme, automaticColor: newColor, customPreserved: '#123456' };
  });
  await check('menu categories and annotation show-hide all', async () => {
    await page.getByTestId('chart-readability').first().click(); await page.waitForTimeout(350);
    await geometry(page, item, 0.85); const before = await snapshot(page, item);
    const menu = page.getByTestId('chart-display-menu').first();
    await menu.focus(); await page.keyboard.press('Enter');
    await page.getByTestId('overlay-menu-news').waitFor(); await page.keyboard.press('Escape');
    assert(await menu.evaluate(el => document.activeElement === el), 'Escape did not return menu focus');
    const counts = {};
    for (const category of ['news', 'dividends', 'splits']) {
      await toggle(page, category, true);
      await page.waitForFunction(category => JSON.parse(document.querySelector('[data-testid="chart-canvas"]').getAttribute('data-event-categories') ?? '{}')[category] > 0, category);
      const state = await snapshot(page, item);
      assert.deepEqual(Object.keys(state.categories), [category], `${category} menu toggle enabled another category`);
      counts[category] = state.eventItems;
      await toggle(page, category, false);
      assert.equal((await snapshot(page, item)).eventItems, 0);
    }
    await menu.click(); await page.getByTestId('annotations-show-all').click(); await page.waitForTimeout(350);
    const on = await snapshot(page, item);
    assert(Object.values(on.layout.overlays).every(x => x === true)); assert.equal(on.rangeEnabled, 'true');
    assert.equal(on.hts.profile.enabled, true); assert.deepEqual(on.layout.drawings, before.layout.drawings);
    assert.deepEqual(on.layout.indicators, before.layout.indicators); assert.deepEqual(on.visible, before.visible);
    assert.deepEqual(on.paneHeights, before.paneHeights);
    await clearProbe(page); await menu.click(); await page.getByTestId('annotations-hide-all').click(); await page.waitForTimeout(350);
    const off = await snapshot(page, item);
    assert(Object.values(off.layout.overlays).every(x => x === false)); assert.equal(off.rangeEnabled, 'false');
    assert.equal(off.markerCount, 0); assert.equal(off.eventItems, 0); assert.equal(off.hts.profile.enabled, true);
    assert.deepEqual(off.layout.drawings, before.layout.drawings); assert.deepEqual(off.layout.indicators, before.layout.indicators);
    assert.deepEqual(off.visible, before.visible); assert.deepEqual(off.paneHeights, before.paneHeights);
    assert.deepEqual(candleGeometry(off), candleGeometry(before), 'hide/show all changed candles');
    return { counts, rangeShownThenHidden: true, profilePreserved: true, manualDrawingsPreserved: true, indicatorPanesPreserved: true, keyboardEscapeFocusRestored: true };
  });
  await check('resize fullscreen and native price-axis zoom', async () => {
    const originalSize = page.viewportSize();
    await page.setViewportSize({ width: 1000, height: 900 }); await page.waitForTimeout(350);
    const resized = await geometry(page, item, 0.85);
    await page.setViewportSize(originalSize); await page.waitForTimeout(350);
    await page.getByTestId('chart-fullscreen').first().click(); await page.waitForTimeout(350);
    const full = await page.evaluate(() => Boolean(document.fullscreenElement));
    const fullPath = new URL(page.url()).pathname;
    assert(full || fullPath === '/chart', 'neither native fullscreen nor chart workspace opened');
    if (!full) await readiness(page);
    const fullscreen = await geometry(page, item, 0.85);
    if (full) await page.evaluate(() => document.exitFullscreen());
    else { await page.goto(`${base}${item.path}`, { waitUntil: 'domcontentloaded' }); await readiness(page); }
    await page.waitForTimeout(350);
    const rowsBefore = await page.getByTestId('profile-details').locator('tbody tr').allTextContents();
    const pane = page.locator('[data-hts-pane="price"]').first(); await pane.scrollIntoViewIfNeeded();
    const axes = await pane.locator('canvas').evaluateAll(nodes => nodes.map(canvas => { const b = canvas.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; }));
    const axis = axes.find(x => x.width > 10 && x.width < 150 && x.height > 100);
    assert(axis, 'native price axis not found');
    await page.mouse.move(axis.x + axis.width / 2, axis.y + axis.height / 2); await page.mouse.down();
    await page.mouse.move(axis.x + axis.width / 2, axis.y + axis.height / 2 + 45, { steps: 10 }); await page.mouse.up();
    await page.mouse.move(5, 5); await page.waitForTimeout(300);
    assert.deepEqual(await page.getByTestId('profile-details').locator('tbody tr').allTextContents(), rowsBefore, 'price zoom changed bin totals');
    return { resized, fullscreen, usedNativeFullscreen: full, fullscreenPath: fullPath, priceAxisChangedProfileTotals: false };
  });
  await check('scoped reload and symbol round trip', async () => {
    await toggle(page, 'research', true); await page.waitForTimeout(350);
    const original = await snapshot(page, item);
    await page.reload({ waitUntil: 'domcontentloaded' }); await readiness(page);
    const restored = await snapshot(page, item);
    assert.equal(restored.layout.overlays.research, true); assert.deepEqual(restored.hts.profile, original.hts.profile);
    assert.deepEqual(restored.layout.drawings, original.layout.drawings); assert.equal(restored.hts.trustStartDate, original.hts.trustStartDate);
    await page.goto(`${base}/stock/403870`, { waitUntil: 'domcontentloaded' }); await readiness(page);
    const other = await snapshot(page, { ...item, code: '403870' });
    assert.equal(other.layout.overlays.research, false, 'saved toggle leaked into another symbol');
    assert.equal(await page.getByTestId('chart-event-details').count(), 0, 'previous symbol detail remained open');
    await page.goto(`${base}${item.path}`, { waitUntil: 'domcontentloaded' }); await readiness(page);
    const returned = await snapshot(page, item); assert.equal(returned.layout.overlays.research, true);
    await page.getByTestId('chart-readability').first().click(); await page.waitForTimeout(350);
    return { scope: restored.layoutKey, toggleRestored: true, otherScopeDefault: true, originalDrawings: restored.layout.drawings.length };
  });
  await check('time pan visible aggregation and fixed-range invariance', async () => {
    await page.getByTestId('chart-readability').first().click(); await page.waitForTimeout(300);
    const pane = page.locator('[data-hts-pane="price"]').first(); await pane.scrollIntoViewIfNeeded();
    const pan = async () => {
      const plot = await pane.locator('canvas').first().boundingBox(); assert(plot);
      await page.mouse.move(plot.x + plot.width * 0.65, plot.y + plot.height * 0.65); await page.mouse.down();
      await page.mouse.move(plot.x + plot.width * 0.85, plot.y + plot.height * 0.65, { steps: 12 }); await page.mouse.up();
      await page.mouse.move(5, 5); await page.waitForTimeout(350);
    };
    const initial = await snapshot(page, item);
    const initialRows = await page.getByTestId('profile-details').locator('tbody tr').allTextContents();
    await pan(); const panned = await snapshot(page, item);
    assert.notDeepEqual(panned.visible, initial.visible, 'time drag did not move chart');
    assert.notDeepEqual(await page.getByTestId('profile-details').locator('tbody tr').allTextContents(), initialRows, 'visible profile did not follow time range');
    assert.equal(panned.hts.trustStartDate, initial.hts.trustStartDate, 'time pan changed trust cumulative origin');
    await page.getByTestId('open-hts-settings').filter({ visible: true }).first().click();
    const settings = page.getByTestId('hts-settings');
    await settings.getByLabel(/^매물대 집계 범위/).selectOption('fixed');
    await settings.getByLabel('매물대 시작일', { exact: true }).fill('2026-03-02');
    await settings.getByLabel('매물대 종료일', { exact: true }).fill('2026-08-31');
    await closePanels(page); await page.waitForTimeout(350);
    const fixedRows = await page.getByTestId('profile-details').locator('tbody tr').allTextContents();
    await pane.scrollIntoViewIfNeeded(); const beforeFixedPan = await snapshot(page, item);
    await pan(); const afterFixedPan = await snapshot(page, item);
    assert.notDeepEqual(afterFixedPan.visible, beforeFixedPan.visible, 'fixed-range time drag did not move chart');
    assert.deepEqual(await page.getByTestId('profile-details').locator('tbody tr').allTextContents(), fixedRows, 'fixed profile changed on time pan');
    await page.getByTestId('chart-readability').first().click(); await page.waitForTimeout(300);
    return { visibleBefore: initial.visible, visibleAfter: panned.visible, visibleTotalsChanged: true, fixedTotalsPreserved: true };
  });
  await check('week-month scope restoration and replay future boundaries', async () => {
    const periods = page.getByRole('group', { name: '봉 주기', exact: true }).first();
    const change = async (interval, label) => {
      await periods.getByRole('button', { name: label, exact: true }).click();
      await page.waitForFunction(({ code, interval }) => Object.keys(localStorage).some(key => key.startsWith('ked:hts:') && key.includes(`:${code}:${interval}:`)), { code: item.code, interval });
      await readiness(page);
    };
    await change('week', '주');
    assert.equal(await page.getByTestId('overlay-toggle-research').getAttribute('aria-pressed'), 'false', 'daily toggle leaked into week');
    await toggle(page, 'research', true);
    await page.waitForFunction(() => Number(document.querySelector('[data-testid="chart-canvas"]').getAttribute('data-event-items')) >= 38);
    await page.getByTestId('chart-event-list').click();
    const sheet = page.getByTestId('chart-event-details'); await sheet.waitFor();
    assert.equal(await sheet.getByTestId('chart-event-item').count(), 38);
    assert((await sheet.textContent()).includes(fixtureEvents(item.code).date), 'weekly detail lost original report day');
    await closePanels(page);
    await change('month', '월');
    assert.equal(await page.getByTestId('overlay-toggle-research').getAttribute('aria-pressed'), 'false', 'weekly toggle leaked into month');
    await change('week', '주');
    assert.equal(await page.getByTestId('overlay-toggle-research').getAttribute('aria-pressed'), 'true', 'weekly toggle was not restored');
    await change('day', '일');
    await page.getByTestId('chart-readability').click(); await page.waitForTimeout(300); await toggle(page, 'disclosures', true);
    assert.equal((await snapshot(page, item)).eventItems, 30);
    await page.getByTestId('replay-toggle').filter({ visible: true }).click();
    const pane = page.locator('[data-hts-pane="price"]').first(); await pane.scrollIntoViewIfNeeded();
    const plot = await pane.locator('canvas').first().boundingBox(); assert(plot);
    await page.mouse.click(plot.x + plot.width * 0.25, plot.y + plot.height * 0.55);
    await page.getByTestId('replay-bar').waitFor(); await page.waitForTimeout(350);
    const replay = await snapshot(page, item);
    assert.equal(replay.eventItems, 0, 'future disclosure data leaked before replay cursor');
    assert.equal(replay.markerCount, 0, 'future native disclosure markers leaked into replay');
    assert.equal(await page.getByTestId('chart-event-details').count(), 0);
    await page.getByTestId('replay-bar').getByRole('button', { name: '리플레이 종료', exact: true }).click();
    await page.waitForFunction(() => Number(document.querySelector('[data-testid="chart-canvas"]').getAttribute('data-event-items')) === 30);
    await page.getByTestId('chart-readability').click(); await page.waitForTimeout(300);
    return { weeklyReportOriginals: 38, weeklyToggleRestored: true, monthlyDefaultIndependent: true, futureDisclosuresHidden: 30, restoredAfterReplay: 30 };
  });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) });
const results = [];
try {
  for (const item of cases) for (const viewport of viewports) for (const theme of themes) for (const dpr of dprs) {
    const id = `${item.id}-${viewport.id}-${theme}-dpr${dpr}${legacy ? '-legacy' : ''}`;
    const result = { id, code: item.code, mode: 'QA SYNTHETIC (실데이터 아님)', viewport: viewport.id, theme, dpr, legacy,
      status: 'failed', checks: [], errors: [], externalFailures: [], fixtureCalls: [] };
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: dpr, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch, locale: 'ko-KR', timezoneId: 'Asia/Seoul', acceptDownloads: true });
    const page = await context.newPage(); page.setDefaultTimeout(timeout);
    page.on('pageerror', error => result.errors.push(error.message));
    page.on('requestfailed', request => { const url = new URL(request.url()); if (url.origin !== new URL(base).origin) result.externalFailures.push({ origin: url.origin, error: request.failure()?.errorText }); });
    try {
      const seed = defaultHtsSettings(item.market, item.instrument);
      seed.trustStartDate = '2026-01-05';
      seed.panelHeights.price = 400;
      if (legacy) seed.profile = { ...seed.profile, widthRatio: 0.10, rows: 50, rangeMode: 'all',
        colorMode: 'custom', color: '#e7b157', opacity: 0.22, rangeOn: true, showPoc: true, showVa: true };
      const drawings = [{ id: 'qa-kept-hline', type: 'hline', anchors: [{ t: '2026-03-02', p: item.market === 'US' ? 100 : 10000 }], color: '#f59e0b', width: 2, locked: false, hidden: false }];
      const layout = { v: 2, chartType: 'candles', scale: 'normal', drawings,
        indicators: defaultIndicators(item.market).filter(x => item.market === 'US' || x.id !== 'macd'),
        overlays: Object.fromEntries(['disclosures', 'research', 'targets', 'signals', 'news', 'dividends', 'splits'].map(x => [x, legacy])) };
      await context.addInitScript(({ theme, item, seed, layout, legacy }) => {
        if (sessionStorage.getItem('qa-chart-display-seeded')) return;
        localStorage.setItem('korea-equity-cc', JSON.stringify({ state: { theme }, version: 2 }));
        if (legacy) {
          localStorage.setItem(`ked:hts:v1:${item.market}:${item.instrument}:${item.code}:day:detail`, JSON.stringify(seed));
          localStorage.setItem(`ked:chart:v2:${item.market}:${item.code}:day:${item.instrument}:detail`, JSON.stringify(layout));
        }
        sessionStorage.setItem('qa-chart-display-seeded', 'true');
      }, { theme, item, seed, layout, legacy });
      await context.addInitScript(canvasProbe);
      await fixtures(page, result);
      const response = await page.goto(`${base}${item.path}`, { waitUntil: 'domcontentloaded' });
      assert.equal(response?.status(), 200);
      await readiness(page);
      if (item.workspace) {
        await workspaceAcceptance(page, result, viewport);
        assert.equal(result.errors.length, 0, `runtime errors: ${result.errors.join('; ')}`);
        result.status = 'passed'; continue;
      }
      const initial = await snapshot(page, item); result.initial = { ...initial, rects: undefined, texts: undefined, candles: undefined, axisTexts: undefined, arcs: undefined };
      assert.equal(initial.devicePixelRatio, dpr, 'browser did not apply requested DPR');
      assert(initial.overflow <= 1, `horizontal overflow ${initial.overflow}px`);
      if (legacy) {
        assert.equal(initial.hts.profile.widthRatio, 0.10); assert.equal(initial.hts.profile.rows, 50); assert.equal(initial.hts.profile.rangeMode, 'all');
        assert(initial.eventItems >= 60, `legacy enabled events absent: ${initial.eventItems}`);
        result.beforeScreenshot = join(output, `${id}-before.png`); await page.screenshot({ path: result.beforeScreenshot, fullPage: false });
        await page.getByTestId('chart-readability').first().click(); await page.waitForTimeout(350);
      }
      const cleaned = await snapshot(page, item);
      assert.equal(cleaned.hts.profile.widthRatio, 0.85); assert.equal(cleaned.hts.profile.rows, 10);
      assert.equal(cleaned.hts.profile.rangeMode, 'visible'); assert.equal(cleaned.hts.profile.basis, 'volume');
      assert.equal(cleaned.hts.profile.showVa, false); assert.equal(cleaned.hts.profile.showPoc, false);
      assert.equal(cleaned.hts.profile.rangeOn, false); assert.equal(cleaned.hts.profile.colorMode, 'auto');
      assert.equal(cleaned.eventItems, 0); assert.equal(cleaned.markerCount, 0);
      if (legacy) {
        assert.deepEqual(cleaned.layout.drawings, initial.layout.drawings); assert.deepEqual(cleaned.layout.indicators, initial.layout.indicators);
        assert.deepEqual(cleaned.paneHeights, initial.paneHeights); assert.deepEqual(cleaned.visible, initial.visible);
        assert.equal(cleaned.hts.trustStartDate, initial.hts.trustStartDate); assert.equal(cleaned.layout.chartType, initial.layout.chartType); assert.equal(cleaned.layout.scale, initial.layout.scale);
      }
      result.geometry = await geometry(page, item, 0.85);
      assert.equal(result.geometry.color, theme === 'light' ? '#e6b77c' : '#d9a15a');
      assert(Math.abs(result.geometry.fillAlpha - (theme === 'light' ? 0.32 : 0.28)) < 0.001, 'theme alpha was multiplied unexpectedly');
      const chart = page.getByTestId('chart-canvas').first(); await chart.scrollIntoViewIfNeeded();
      result.screenshot = join(output, `${id}-annotations-off.png`); await page.screenshot({ path: result.screenshot, fullPage: false });
      result.chartScreenshot = join(output, `${id}-chart.png`); await chart.screenshot({ path: result.chartScreenshot });
      result.exports = [await png(page, `${id}-annotations-off`)];
      if (interactive && item.id === 'stock' && viewport.id === 'desktop' && dpr === 1) await interactions(page, item, result);
      assert.equal(result.errors.length, 0, `runtime errors: ${result.errors.join('; ')}`);
      assert(!result.checks.some(c => c.status === 'failed'), 'interaction failures');
      result.status = 'passed';
    } catch (error) {
      result.failure = String(error).slice(0, 2000);
      result.snapshot = await snapshot(page, item).catch(() => null);
      result.failedScreenshot = join(output, `${id}-failed.png`);
      await page.screenshot({ path: result.failedScreenshot, fullPage: false }).catch(() => {});
    } finally {
      results.push(result);
      writeFileSync(join(output, 'verdict.json'), JSON.stringify({ mode: 'QA SYNTHETIC (실데이터 아님)', at: new Date().toISOString(), results }, null, 2));
      console.log(`${result.status.toUpperCase()} ${id}${result.failure ? `: ${result.failure}` : ''}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  if (results.some(r => r.fixtureCalls.some(x => x.name === 'getChartFlow'))) { const { closeKiwoomBrowserFixture } = await import('./qa-kiwoom-fixture.mjs'); await closeKiwoomBrowserFixture(); }
}
console.log(JSON.stringify({ passed: results.filter(x => x.status === 'passed').length, failed: results.filter(x => x.status !== 'passed').length, verdict: join(output, 'verdict.json') }));
process.exitCode = results.some(x => x.status !== 'passed') ? 1 : 0;
