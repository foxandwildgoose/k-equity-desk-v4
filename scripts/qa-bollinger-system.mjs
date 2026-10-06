#!/usr/bin/env node
/**
 * Isolated browser transport fixtures against the compiled production application.
 * --mode real never intercepts market responses. Synthetic values are test-only.
 * node --experimental-strip-types scripts/qa-bollinger-system.mjs --mode fixture
 *   --base http://127.0.0.1:8183 --server-entry <compiled Nitro index.mjs>
 *   --cases stock-005930,us-NVDA --themes light,dark --viewports desktop,mobile
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { fromJSON, fromCrossJSON } from 'seroval';
import { analyzeDiscovery } from '../src/lib/bollinger/discovery.ts';

const argv = process.argv.slice(2);
const valueOptions = new Set(['--mode', '--base', '--out', '--server-entry', '--timeout', '--cases', '--themes', '--viewports']);
const switches = new Set(['--legacy', '--screener-only', '--screener', '--export-off', '--discovery']);
for (let index = 0; index < argv.length; index++) {
  assert(valueOptions.has(argv[index]) || switches.has(argv[index]), `Unknown QA option: ${argv[index]}`);
  if (valueOptions.has(argv[index])) { assert(argv[index + 1] && !argv[index + 1].startsWith('--'), `Missing QA option value: ${argv[index]}`); index++; }
}
const option = (key, fallback) => argv.includes(key) ? argv[argv.indexOf(key) + 1] : fallback;
const list = (key, fallback) => option(key, fallback).split(',').filter(Boolean);
const mode = option('--mode', 'real');
assert(['real', 'fixture'].includes(mode), '--mode must be real or fixture');
const base = option('--base', 'http://127.0.0.1:8183');
const out = resolve(option('--out', `/workspace/screenshots/bollinger-production/${mode}`));
const entry = option('--server-entry', resolve(process.env.NITRO_OUTPUT_DIR ?? '.vercel/output', 'functions/__server.func/index.mjs'));
const compiled = readFileSync(entry, 'utf8');
const names = Object.fromEntries([...compiled.matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName: "([^"]+)"/g)].map(match => [match[1], match[2].replace(/_createServerFn_handler$/, '')]));
const timeout = Number(option('--timeout', '35000'));
const legacy = argv.includes('--legacy');
const screenerOnly = argv.includes('--screener-only');
const withScreener = argv.includes('--screener') || screenerOnly;
const exportOff = argv.includes('--export-off');
const discovery = argv.includes('--discovery');
mkdirSync(out, { recursive: true });
const allCases = [
  { id: 'stock-005930', path: '/stock/005930', code: '005930', shell: 'trading-chart', market: 'KR', instrument: 'stock' },
  { id: 'stock-403870', path: '/stock/403870', code: '403870', shell: 'trading-chart', market: 'KR', instrument: 'stock' },
  { id: 'etf-069500', path: '/etfs/069500', code: '069500', shell: 'trading-chart', market: 'KR', instrument: 'etf' },
  { id: 'us-NVDA', path: '/us/NVDA', code: 'NVDA', shell: 'trading-chart', market: 'US', instrument: 'stock' },
  { id: 'us-BOTZ', path: '/us/BOTZ', code: 'BOTZ', shell: 'trading-chart', market: 'US', instrument: 'etf' },
  { id: 'workspace-1', path: '/chart?symbols=KR%3A005930&layout=1', code: '005930', shell: 'workspace-pane-0', charts: 1, market: 'KR', instrument: 'stock' },
  { id: 'workspace-2', path: '/chart?symbols=KR%3A005930%2CUS%3ABOTZ&layout=2', code: '005930', shell: 'workspace-pane-0', charts: 2, market: 'KR', instrument: 'stock' },
  { id: 'workspace-4', path: '/chart?symbols=KR%3A005930%2CKR%3A069500%2CUS%3ANVDA%2CUS%3ABOTZ&layout=4', code: '005930', shell: 'workspace-pane-0', charts: 4, market: 'KR', instrument: 'stock' },
];
const cases = allCases.filter(item => list('--cases', allCases.map(c => c.id).join(',')).includes(item.id));
if(discovery)for(const item of cases)if(item.id==='workspace-1')item.path+='&discoveryUniverse=QA-DISCOVERY&discoveryVersion=long-daily-2.0.0';
const viewports = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'tablet', width: 768, height: 1024 },
  { id: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
].filter(v => list('--viewports', 'desktop,tablet,mobile').includes(v.id));
const styles = {
  light: { upper: '#607D96', lower: '#80738C', middle: '#718096', percentB: '#347EAA', bandwidth: '#927538', fillAlpha: 0.065 },
  dark: { upper: '#8DA7BC', lower: '#AA9BB5', middle: '#91A0AE', percentB: '#79BCE4', bandwidth: '#C8A86E', fillAlpha: 0.055 },
};
const smaColors = { light: ['#B8860B', '#A23B8F', '#00796B', '#1565C0', '#C62828'], dark: ['#FFD54F', '#E07BCB', '#35D0A0', '#42A5F5', '#FF5C5C'] };

function fixtureBars(code, interval = 'day', size = 5) {
  const us = /^[A-Z]/.test(code);
  const basePrice = us ? 100 : 30000;
  const scale = us ? 1 : 300;
  const dates = [];
  for (let day = 0; dates.length < 500; day++) {
    const dt = new Date(Date.UTC(2024, 0, 2) + day * 86400000);
    if (![0, 6].includes(dt.getUTCDay())) dates.push(dt.toISOString().slice(0, 10));
  }
  return Array.from({ length: 500 }, (_, i) => {
    const date = interval === 'minute' ? new Date(Date.UTC(2026, 8, 1, 1) + i * size * 60000).toISOString().slice(0, 16).replace('T', ' ')
      : interval === 'week' ? new Date(Date.UTC(2015, 0, 5) + i * 7 * 86400000).toISOString().slice(0, 10)
      : interval === 'month' ? new Date(Date.UTC(1982, i, 1)).toISOString().slice(0, 10) : dates[i];
    const phase = i >= 450 && i < 475 ? 0.04 : 1;
    const close = basePrice + i * scale / 35 + Math.sin(i / 4) * scale * phase + (i >= 475 ? (i - 475) * scale / 5 : 0) + (i === 480 ? scale * 5 : 0);
    const open = close + Math.cos(i / 3) * scale / 8;
    return { date, label: date, open, high: Math.max(open, close) + scale / 5, low: Math.min(open, close) - scale / 5, close, volume: 100000 + i * 40 + (i === 480 ? 800000 : 0), volumeValid: true, bullish: close >= open };
  });
}
async function fixtures(page, calls) {
  const { fromJSON, toCrossJSONAsync } = await import('seroval');
  await page.route('**/_serverFn/**', async route => {
    const id = new URL(route.request().url()).pathname.split('/_serverFn/')[1];
    const name = names[id];
    let data = {};
    const raw = route.request().method() === 'POST' ? route.request().postData() : new URL(route.request().url()).searchParams.get('payload');
    if (raw) { try { const payload = fromJSON(JSON.parse(raw)); data = payload.data ?? payload; } catch { /* transport errors fail UI checks */ } }
    const code = data.code ?? '005930';
    let result;
    if (name === 'getChartData') {
      const all = fixtureBars(code, data.interval, data.minuteSize);
      const long = ['5y', '10y', 'max', '60d', '7d'].includes(data.range) || (data.interval === 'minute' && data.range === '2y');
      result = { bars: long ? all : all.slice(-160), source: `yahoo-QA-SYNTHETIC-${code}`, events: { dividends: [], splits: [] } };
    } else if (name === 'getDiscoveryChartContext') {
      const rows=fixtureBars(data.symbol).map(b=>({...b,completed:true})),analysis=analyzeDiscovery(rows);
      result={status:'READY',data:{candidate:analysis.candidates.at(-1),market:data.market,symbol:data.symbol,source:'QA SYNTHETIC',priceBasis:data.market==='US'?'yahoo-us-adjusted-ohlcv':'yahoo-kr-raw-ohlcv',history:analysis.candidates.map(c=>({date:c.date,resistance:c.trigger?.resistance??c.resistance}))}};
    } else if (name === 'getChartFlow') {
      const { kiwoomBrowserFixture } = await import('./qa-kiwoom-fixture.mjs');
      try { result = await kiwoomBrowserFixture(data, fixtureBars(code)); }
      catch (error) {
        if (error.message !== '유효하지 않은 조회 기간') throw error;
        // The real flow service rejects >20-year requests. A 500-bar monthly
        // price fixture intentionally exceeds that bound; preserve its actual
        // error semantics while the independent security-price chart continues.
        calls.push({ name, code, interval: data.interval ?? null, range: null, error: 'FLOW_RANGE_LIMIT' });
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'x-tss-serialized': 'true' }, body: JSON.stringify(await toCrossJSONAsync({ result: undefined, error: new Error('유효하지 않은 조회 기간'), context: {} }, { refs: new Map() })) });
        return;
      }
    } else if (['getChartSecurity', 'getUsChartSecurity'].includes(name)) {
      const us = name === 'getUsChartSecurity'; const etf = ['069500', 'BOTZ'].includes(code);
      result = { code, market: us ? 'US' : 'KR', exchange: us ? 'NASDAQ' : 'KOSPI', instrument: etf ? 'etf' : 'stock', currency: us ? 'USD' : 'KRW', quantityUnit: etf && !us ? '좌' : '주', source: 'QA SYNTHETIC SECURITY — NOT MARKET DATA' };
    } else if (name === 'getStockBundle') {
      result = { meta: { code, nameKo: 'QA SYNTHETIC', market: 'KOSPI', sectorId: 'electronics' }, quote: null, basic: null, flow: { days: [], source: 'QA SYNTHETIC' }, research: [], researchPack: { company: [], industry: [], market: [], economy: [] }, news: [], disclosures: [], disclosureMeta: { dartCount: 0, koscomCount: 0 }, fetchedAt: '2026-10-04T00:00:00Z' };
    } else if (name === 'getEtfBundle') {
      result = { etf: { code, nameKo: 'QA SYNTHETIC ETF', price: 40000, changePct: 0, volume: 100000 }, holdings: [], peerEtfs: [], allocation: [], themeStocks: [], themeLabels: [], descriptionFormatted: { paragraphs: [], bullets: [], plain: '', summary: '' }, issuer: 'QA SYNTHETIC', holdingsAsOf: null, officialCount: 0, weightBasis: 'none', source: 'QA SYNTHETIC' };
    } else if (name === 'getBollingerScreener') {
      result = { rows: [
        { symbol: '005930', market: 'KR', name: 'QA SYNTHETIC 005930', status: 'recent', score: 84, bbwPercentile: 5, percentB: 1.07, rvol: 1.8, flow: { availability: 'available', foreignOwnershipChange: 0.15, investmentTrustNet: 125000, reason: 'QA SYNTHETIC confirmed observations' } },
        { symbol: 'NVDA', market: 'US', name: 'QA SYNTHETIC NVDA', status: 'recent', score: 90, bbwPercentile: 45, percentB: 0.6, rvol: 0.8, flow: { availability: 'not-applicable', foreignOwnershipChange: null, investmentTrustNet: null, reason: 'Domestic definitions not applicable' } },
        { symbol: '403870', market: 'KR', name: 'QA SYNTHETIC 403870', status: 'stale', score: 99, bbwPercentile: 2, percentB: 1.2, rvol: 2.5 },
        { symbol: 'BOTZ', market: 'US', name: 'QA SYNTHETIC BOTZ', status: 'warmup', score: null, bbwPercentile: null, percentB: null, rvol: null },
        { symbol: '000660', market: 'KR', name: 'QA SYNTHETIC 000660', status: 'error', score: null, bbwPercentile: null, percentB: null, rvol: null },
      ].map(row => ({ timeframe: 'day', asOf: row.status === 'stale' ? '2025-01-02' : '2026-10-02', source: 'QA SYNTHETIC SNAPSHOT — NOT MARKET DATA', fetchedAt: '2026-10-04T00:00:00Z', reason: `QA SYNTHETIC ${row.status}`, close: 110, sma200: 100, bbw: 5.2, trend: 'bullish', setup: 'bull-breakout', coverage: 0.8,
        flow: { availability: 'unknown', foreignOwnershipChange: null, investmentTrustNet: null, reason: 'QA SYNTHETIC missing observation' }, ...row })), fetchedAt: '2026-10-04T00:00:00Z', timeframe: 'day', scope: 'selected-universe', cacheTtlSeconds: 600, note: 'QA SYNTHETIC' };
    } else if (['getStockNews', 'getStockDisclosures'].includes(name)) result = [];
    else return route.continue();
    calls.push({ name, code, interval: data.interval ?? null, range: data.range ?? null });
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'x-tss-serialized': 'true' }, body: JSON.stringify(await toCrossJSONAsync({ result, error: undefined, context: {} }, { refs: new Map() })) });
  });
  await page.route('**/api/feed?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], sources: [], partial: false, nextCursor: null, generatedAt: '2026-10-04T00:00:00Z' }) }));
  await page.route('**/api/market-stream?**', route => route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'event: status\ndata: {"enabled":false,"connected":false,"provider":"QA SYNTHETIC"}\n\n' }));
}
function probe() {
  window.__bbDraws = []; window.__bbTexts = [];
  const ids = new WeakMap(); let sequence = 0;
  const id = canvas => { if (!ids.has(canvas)) ids.set(canvas, ++sequence); return ids.get(canvas); };
  const metadata = context => ({ canvasId: id(context.canvas), pane: context.canvas.closest('[data-bollinger-pane]')?.dataset.bollingerPane ?? null,
    htsPane: context.canvas.closest('[data-hts-pane]')?.dataset.htsPane ?? null,
    shell: context.canvas.closest('[data-testid="chart-canvas"]')?.parentElement?.closest('[data-testid]')?.dataset.testid ?? context.canvas.closest('[data-testid]')?.dataset.testid,
    alpha: context.globalAlpha, color: String(context.fillStyle), strokeColor: String(context.strokeStyle),
    dash:context.getLineDash(),lineWidth: context.lineWidth * context.getTransform().a / (context.canvas.width / context.canvas.getBoundingClientRect().width) });
  for (const method of ['clearRect', 'fillRect']) {
    const original = CanvasRenderingContext2D.prototype[method];
    CanvasRenderingContext2D.prototype[method] = function(x, y, width, height) {
      const transform = this.getTransform();
      if (x === 0 && y === 0 && width * transform.a >= this.canvas.width - 1 && height * transform.d >= this.canvas.height - 1) {
        const canvasId = id(this.canvas);
        window.__bbDraws = window.__bbDraws.filter(row => row.canvasId !== canvasId);
        window.__bbTexts = window.__bbTexts.filter(row => row.canvasId !== canvasId);
      }
      if (method === 'fillRect' && this.globalAlpha === 1 && ['#ef4444', '#3b82f6', '#22c55e'].includes(String(this.fillStyle).toLowerCase())) {
        const dpr = this.canvas.width / this.canvas.getBoundingClientRect().width;
        const cssWidth = width * transform.a / dpr;
        if (cssWidth > 0 && cssWidth <= 32 && height > 0) window.__bbDraws.push({ method: 'candleRect', cssWidth, ...metadata(this) });
      }
      return original.apply(this, arguments);
    };
  }
  for (const method of ['fill', 'stroke']) {
    const original = CanvasRenderingContext2D.prototype[method];
    CanvasRenderingContext2D.prototype[method] = function() {
      window.__bbDraws.push({ method, ...metadata(this) });
      if (window.__bbDraws.length > 12000) window.__bbDraws.splice(0, 6000);
      return original.apply(this, arguments);
    };
  }
  const original = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function(value, x, y) {
    const rect = this.canvas.getBoundingClientRect(); const transform = this.getTransform(); const dpr = this.canvas.width / rect.width;
    window.__bbTexts.push({ text: String(value), x: (x * transform.a + transform.e) / dpr, y: (y * transform.d + transform.f) / dpr, ...metadata(this) });
    if (window.__bbTexts.length > 6000) window.__bbTexts.splice(0, 3000);
    return original.apply(this, arguments);
  };
}
async function clearProbe(page) { await page.evaluate(() => { window.__bbDraws = []; window.__bbTexts = []; }); }
async function paneState(root) {
  return root.locator('[data-bollinger-pane]').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { id: node.dataset.bollingerPane, width: rect.width, height: rect.height, top: rect.top, canvasCount: node.querySelectorAll('canvas').length };
  }));
}
async function visibleState(root) {
  return root.getByTestId('chart-canvas').evaluate(el => ({ from: el.dataset.visibleFrom, to: el.dataset.visibleTo }));
}
async function nativeRangeState(root) {
  return root.getByTestId('chart-canvas').evaluate(el => {
    // Read-only QA access to the existing chart API in its owning React hook.
    // Never serialize other hook state or add an application debug endpoint.
    const key = Object.keys(el).find(name => name.startsWith('__reactFiber$'));
    let fiber = key ? el[key] : null;
    for (let depth = 0; fiber && depth < 40; depth++, fiber = fiber.return) {
      for (let hook = fiber.memoizedState, index = 0; hook && index < 120; index++, hook = hook.next) {
        const value = hook.memoizedState;
        if (typeof value?.timeScale !== 'function' || typeof value?.panes !== 'function') continue;
        const scale = value.timeScale();
        return { logical: scale.getVisibleLogicalRange(), time: scale.getVisibleRange(), width: scale.width(), barSpacing: scale.options().barSpacing };
      }
    }
    return { unavailable: true };
  });
}
async function latestStatus(root) {
  return root.getByTestId('bollinger-status').evaluate(el => ({ asOf: el.dataset.asOf, historical: el.dataset.historical, percentB: Number(el.dataset.percentB), bbw: Number(el.dataset.bbw), percentile: Number(el.dataset.percentile), score: Number(el.dataset.score), coverage: Number(el.dataset.coverage), text: el.textContent }));
}
function expectedBollinger(rows, period = 20, mult = 2) {
  const values = rows.slice(-period).map(bar => bar.close);
  if (values.length < period) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const deviation = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  return { bbw: 2 * mult * deviation / mean * 100, percentB: (values.at(-1) - mean + mult * deviation) / (2 * mult * deviation) };
}
async function closeSettings(page) {
  await page.keyboard.press('Escape');
  // Sheet has a 200ms exit animation. Synchronize with its actual removal so
  // a later click cannot hit a closing overlay or toggle the prior portal.
  await page.getByTestId('bollinger-settings-panel').waitFor({ state: 'hidden', timeout });
}
async function expandPanes(page, root) {
  await root.getByTestId('bollinger-settings').click();
  await page.getByTestId('bollinger-panes').selectOption('open');
  await closeSettings(page);
}
async function nativeCheck(page, root, item, theme, result) {
  const style = styles[theme];
  await page.waitForFunction(({ shell, color }) => window.__bbDraws.some(row => row.shell === shell && row.method === 'fill' && row.color.toLowerCase() === color.toLowerCase() && row.alpha > 0 && row.alpha < 0.1), { shell: item.shell, color: style.upper }, { timeout });
  const native = await page.evaluate(({ shell, style }) => ({
    fills: window.__bbDraws.filter(row => row.shell === shell && row.method === 'fill' && row.color.toLowerCase() === style.upper.toLowerCase() && row.alpha < 0.1),
    boundaries: window.__bbDraws.filter(row => row.shell === shell && row.method === 'stroke' && [style.upper, style.lower].map(c => c.toLowerCase()).includes(row.strokeColor.toLowerCase())),
    guides: window.__bbTexts.filter(row => row.shell === shell && row.pane === 'percentB' && ['1.00', '0.80', '0.50', '0.20', '0.00', '1.0', '0.8', '0.5', '0.2', '0.0'].includes(row.text)),
    percentB: window.__bbDraws.some(row => row.shell === shell && row.pane === 'percentB' && row.strokeColor.toLowerCase() === style.percentB.toLowerCase()),
    bandwidth: window.__bbDraws.some(row => row.shell === shell && row.pane === 'bandwidth' && row.strokeColor.toLowerCase() === style.bandwidth.toLowerCase()),
    candles: window.__bbDraws.filter(row => row.shell === shell && row.method === 'candleRect' && (row.htsPane === 'price' || (row.htsPane == null && row.pane == null))).length,
  }), { shell: item.shell, style });
  assert(native.fills.length, 'native BB fill missing');
  assert(native.fills.every(row => Math.abs(row.alpha - style.fillAlpha) < 0.001), 'BB fill alpha is not subtle/theme aware');
  for (const color of [style.upper, style.lower]) assert(native.boundaries.some(row => row.strokeColor.toLowerCase() === color.toLowerCase()), 'native BB boundary missing');
  assert(native.percentB && native.bandwidth, 'native Bollinger panel lines missing');
  assert(native.candles > 0, 'price candles missing while Bollinger/indicator series render');
  assert.deepEqual([...new Set(native.guides.map(row => Number(row.text)))].sort((a,b) => a-b), [0, 0.2, 0.5, 0.8, 1], 'native %B reference labels missing');
  result.native = native;
  const panes = await paneState(root);
  assert.deepEqual(panes.map(pane => pane.id), ['percentB', 'bandwidth']);
  assert(panes.every(pane => pane.height >= 50 && pane.canvasCount > 0), 'Bollinger pane is not drawable');
  result.panes = panes;
}
async function checkExports(page, root, item, theme, result, enabled = true) {
  for (const [kind, id] of [['png', 'chart-export-png'], ['csv', 'chart-export-csv']]) {
    const downloading = page.waitForEvent('download');
    await root.getByTestId(id).click();
    const download = await downloading;
    const path = `${out}/${item.id}-${theme}-${result.viewport}-export${enabled ? '' : '-off'}.${kind}`;
    await download.saveAs(path);
    const bytes = readFileSync(path);
    if (kind === 'png') {
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      assert(bytes.readUInt32BE(16) > 100 && bytes.readUInt32BE(20) > 100);
      const colors = [styles[theme].upper, styles[theme].lower, styles[theme].percentB, styles[theme].bandwidth, ...smaColors[theme]];
      const pixels = await page.evaluate(async ({ data, colors }) => {
        const image = new Image(); image.src = data; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const values = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const targets = colors.map(color => color.slice(1).match(/../g).map(channel => parseInt(channel, 16)));
        const counts = targets.map(() => 0);
        for (let i = 0; i < values.length; i += 4) for (let j = 0; j < targets.length; j++) {
          if (targets[j].every((channel, k) => values[i + k] === channel)) counts[j]++;
        }
        return counts;
      }, { data: `data:image/png;base64,${bytes.toString('base64')}`, colors });
      if (enabled) assert(pixels.every(count => count > 0), 'PNG lost Bollinger boundary/pane or SMA pixels');
      else {
        assert(pixels.slice(0, 4).every(count => count === 0), 'master OFF PNG retained Bollinger boundary/pane pixels');
        assert(pixels.slice(4).every(count => count > 0), 'master OFF PNG lost an enabled SMA');
      }
      result[enabled ? 'png' : 'pngOff'] = { path, bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colors, colorPixels: pixels };
    } else {
      const text = bytes.toString('utf8');
      const normalized = text.toLowerCase().replaceAll('_', '');
      for (const field of ['bbwPercentile', 'percentB', 'coverage', 'rvol', 'trend', 'volatility', 'BB_upper', 'BB_middle', 'BB_lower']) assert(normalized.includes(field.toLowerCase().replaceAll('_', '')), `CSV lacks ${field}`);
      assert(!/NaN|Infinity|undefined/.test(text), 'CSV exported invalid numeric tokens');
      const lines = text.split(/\r?\n/);
      const headerIndex = lines.findIndex(line => line.includes('"BB_upper"') && line.includes('"percentB"'));
      assert(headerIndex >= 0, 'typed Bollinger CSV section missing');
      const percentBValues = lines.slice(headerIndex + 1).map(line => /^"[^"]*","[^"]*","[^"]*","[^"]*","[^"]*","([^"]*)"/.exec(line)?.[1]).filter(value => value != null && value !== '').map(Number);
      if (mode === 'fixture') {
        assert(percentBValues.some(value => value > 1), 'CSV lost valid %B observation above upper band');
        assert(percentBValues.some(value => value < 0), 'CSV lost valid %B observation below lower band');
      }
      // The visibility flag is metadata. Every raw computed observation and
      // numerical input must survive a display-only master toggle unchanged.
      const rows = lines.slice(headerIndex + 1).filter(line => line.startsWith('"')).map(line => line.replace(/,"(?:true|false)"$/, ''));
      const numericalRowsHash = createHash('sha256').update(rows.join('\n')).digest('hex');
      if (!enabled) assert.equal(numericalRowsHash, result.csv.numericalRowsHash, 'master OFF changed raw Bollinger CSV observations');
      result[enabled ? 'csv' : 'csvOff'] = { path, bytes: bytes.length, hasBollingerFields: true, percentBAboveOne: percentBValues.some(value => value > 1), percentBBelowZero: percentBValues.some(value => value < 0), numericalRowsHash, observations: rows.length };
    }
  }
}
async function interactions(page, root, item, theme, viewport, result) {
  result.phase = 'independent-sma-controls';
  if (exportOff) await checkExports(page, root, item, theme, result);
  const dataCalls = () => result.calls.filter(call => call.name === 'getChartData').length;
  const beforeCalls = dataCalls(); const beforeRange = await visibleState(root);
  for (const period of [5, 20, 60, 120, 200]) {
    const toggle = root.getByTestId(`sma-toggle-${period}`);
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    await clearProbe(page);
    await toggle.click(); assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    if (period === 20) await page.waitForFunction(({ shell, color }) => window.__bbDraws.some(row => row.shell === shell && row.method === 'stroke' && row.strokeColor.toLowerCase() === color.toLowerCase()), { shell: item.shell, color: styles[theme].middle }, { timeout });
    await clearProbe(page);
    await toggle.click(); assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    if (period === 20) {
      await page.waitForTimeout(120);
      assert.equal(await page.evaluate(({ shell, color }) => window.__bbDraws.some(row => row.shell === shell && row.method === 'stroke' && row.strokeColor.toLowerCase() === color.toLowerCase()), { shell: item.shell, color: styles[theme].middle }), false, 'default BB middle duplicates visible SMA20');
    }
  }
  await clearProbe(page);
  result.phase = 'master-and-child-controls';
  if (exportOff) {
    result.masterOffRanges = { before: await nativeRangeState(root) };
    assert(result.masterOffRanges.before.logical && result.masterOffRanges.before.time, 'native range QA readout unavailable');
  }
  await root.getByTestId('bollinger-master').click();
  assert.equal(await root.getByTestId('bollinger-master').getAttribute('aria-pressed'), 'false');
  await page.waitForTimeout(200);
  assert.equal(await root.getByTestId('bollinger-status').count(), 0, 'master OFF left status visible');
  assert.equal((await paneState(root)).length, 0, 'master OFF left native %B/BBW panes');
  assert.equal(await page.evaluate(({ shell, color }) => window.__bbDraws.some(row => row.shell === shell && row.method === 'fill' && row.color.toLowerCase() === color.toLowerCase() && row.alpha > 0 && row.alpha < 0.1), { shell: item.shell, color: styles[theme].upper }), false, 'master OFF left native BB fill');
  for (const period of [5, 20, 60, 120, 200]) assert.equal(await root.getByTestId(`sma-toggle-${period}`).getAttribute('aria-pressed'), 'true', 'master changed an SMA');
  let exportOffError;
  if (exportOff) {
    result.masterOffRanges.off = await nativeRangeState(root);
    assert.deepEqual(result.masterOffRanges.off.logical, result.masterOffRanges.before.logical, 'master OFF changed native logical time range');
    assert.deepEqual(result.masterOffRanges.off.time, result.masterOffRanges.before.time, 'master OFF changed selected calendar window');
    try { await checkExports(page, root, item, theme, result, false); } catch (error) { exportOffError = error; }
  }
  await root.getByTestId('bollinger-master').click();
  await root.getByTestId('bollinger-status').waitFor();
  if (exportOff) {
    await page.waitForTimeout(200);
    result.masterOffRanges.restored = await nativeRangeState(root);
    if (exportOffError) throw exportOffError;
  }
  await root.getByTestId('bollinger-settings').click();
  await page.getByTestId('bollinger-preset').selectOption('fidelity-short');
  const initial = await latestStatus(root);
  await closeSettings(page);
  await page.waitForTimeout(250);
  await root.getByTestId('bollinger-settings').click();
  assert.equal(await page.getByTestId('bollinger-preset').inputValue(), 'fidelity-short');
  for (const child of ['overlay', 'percentB', 'bandwidth', 'status', 'badges', 'score', 'alerts']) {
    const control = page.getByTestId(`bollinger-child-${child}`);
    const checked = await control.isChecked();
    await clearProbe(page); await control.click();
    assert.equal(await control.isChecked(), !checked);
    await page.waitForTimeout(100);
    if (child === 'percentB' || child === 'bandwidth') assert.equal(await root.locator(`[data-bollinger-pane="${child}"]`).count(), 0, `${child} child OFF retained native pane`);
    if (child === 'status') assert.equal(await root.getByTestId('bollinger-status').count(), 0, 'status child OFF retained summary');
    if (child === 'score') assert.equal(await root.getByTestId('bollinger-score-details').count(), 0, 'score child OFF retained score UI');
    if (child === 'overlay') assert.equal(await page.evaluate(({ shell, color }) => window.__bbDraws.some(row => row.shell === shell && row.method === 'fill' && row.color.toLowerCase() === color.toLowerCase() && row.alpha > 0 && row.alpha < 0.1), { shell: item.shell, color: styles[theme].upper }), false, 'overlay child OFF retained native fill');
    await control.click(); assert.equal(await control.isChecked(), checked);
  }
  await page.getByTestId('bollinger-preset').selectOption('standard');
  await closeSettings(page); await page.waitForTimeout(200);
  await root.getByTestId('overlay-toggle-signals').click();
  await page.waitForFunction(shell => Number(document.querySelector(`[data-testid="${shell}"] [data-testid="chart-canvas"]`)?.dataset.bollingerEvents) > 0, item.shell, { timeout });
  const canvas = root.getByTestId('chart-canvas');
  result.enabledBadgeCount = Number(await canvas.getAttribute('data-bollinger-events'));
  assert(Number(await canvas.getAttribute('data-marker-count')) > 0, 'signals ON did not render actual grouped markers');
  await root.getByTestId('bollinger-settings').click(); await page.getByTestId('bollinger-child-badges').uncheck(); await closeSettings(page);
  assert.equal(Number(await canvas.getAttribute('data-bollinger-events')), 0, 'badges child OFF retained Bollinger markers/hit targets');
  await root.getByTestId('bollinger-settings').click(); await page.getByTestId('bollinger-child-badges').check(); await closeSettings(page);
  assert(Number(await canvas.getAttribute('data-bollinger-events')) > 0);
  await root.getByTestId('overlay-toggle-signals').click();
  assert.equal(Number(await canvas.getAttribute('data-bollinger-events')), 0, 'existing analysis signal OFF did not hide Bollinger badges');
  const standard = await latestStatus(root);
  assert.notEqual(initial.bbw, standard.bbw, 'preset did not recalculate BBW');
  assert.equal(dataCalls(), beforeCalls, 'toggles/presets refetched market history');
  assert.deepEqual(await visibleState(root), beforeRange, 'toggles/presets reset zoom');
  result.independentSmas = true; result.masterAndChildren = true; result.presets = true;
  if (viewport.id === 'desktop') {
    const canvas = root.locator('[data-hts-pane="price"]').first();
    const target = await canvas.count() ? canvas : root.getByTestId('chart-canvas');
    await target.scrollIntoViewIfNeeded(); const rect = await target.boundingBox();
    await page.mouse.move(rect.x + rect.width * 0.30, rect.y + rect.height * 0.55);
    await page.waitForTimeout(150);
    const historical = await latestStatus(root);
    assert.equal(historical.historical, 'true', 'old crosshair not labeled historical');
    assert(historical.asOf < standard.asOf, 'old crosshair displays current as-of');
    await page.mouse.move(5, 5); await page.waitForTimeout(100);
    result.historical = { current: standard, hovered: historical };
    await checkExports(page, root, item, theme, result);
  }
  result.phase = 'persist-master-off-before-reload';
  await root.getByTestId('bollinger-master').click();
  await page.waitForTimeout(400);
  result.phase = 'restore-master-off-after-reload';
  await page.reload({ waitUntil: 'domcontentloaded' });
  root = page.getByTestId(item.shell).first();
  await page.waitForFunction(shell => document.querySelector(`[data-testid="${shell}"] [data-testid="bollinger-master"]`)?.getAttribute('aria-pressed') === 'false', item.shell, { timeout });
  assert.equal(await root.getByTestId('bollinger-master').getAttribute('aria-pressed'), 'false', 'master OFF was lost on reload');
  assert.equal(await root.getByTestId('bollinger-status').count(), 0);
  await root.getByTestId('bollinger-master').click();
  await root.getByTestId('bollinger-status').waitFor();
  result.persistence = true;
  return root;
}
async function checkReplay(page, root, item, result) {
  const latest = await latestStatus(root);
  const tools = root.getByTestId('chart-tools-mobile');
  if (await tools.isVisible()) await tools.click();
  await page.getByTestId('replay-toggle').filter({ visible: true }).first().click();
  if (await page.getByTestId('chart-tools-sheet').isVisible()) await page.keyboard.press('Escape');
  const price = root.locator('[data-hts-pane="price"]').first();
  await price.scrollIntoViewIfNeeded(); const box = await price.boundingBox();
  await price.click({ position: { x: box.width * 0.45, y: box.height * 0.55 } });
  await root.getByTestId('replay-bar').waitFor(); await page.mouse.move(5, 5); await page.waitForTimeout(200);
  const replayed = await latestStatus(root);
  assert(replayed.asOf < latest.asOf, 'replay did not select an earlier bar');
  if (mode === 'fixture') {
    const known = fixtureBars(item.code).filter(bar => bar.date <= replayed.asOf);
    const expected = expectedBollinger(known);
    assert(Math.abs(replayed.bbw - expected.bbw) < 0.001, 'replay BBW leaked future data');
    assert(Math.abs(replayed.percentB - expected.percentB) < 0.001, 'replay %B leaked future data');
    result.replay = { asOf: replayed.asOf, expected, actual: { bbw: replayed.bbw, percentB: replayed.percentB } };
  }
  await root.getByTestId('replay-bar').getByRole('button', { name: '리플레이 종료', exact: true }).click();
}
async function checkIntervals(page, root, item, result) {
  result.intervals = [];
  for (const [label, interval] of [['분', 'minute'], ['주', 'week'], ['월', 'month'], ['일', 'day']]) {
    await root.getByRole('group', { name: '봉 주기' }).getByRole('button', { name: label, exact: true }).click();
    const expected = mode === 'fixture' ? expectedBollinger(fixtureBars(item.code, interval)) : null;
    await page.waitForFunction(({ shell, date }) => {
      const node = document.querySelector(`[data-testid="${shell}"] [data-testid="bollinger-status"]`);
      return node && (!date || node.dataset.asOf === date);
    }, { shell: item.shell, date: mode === 'fixture' ? fixtureBars(item.code, interval).at(-1).date : null }, { timeout });
    const status = await latestStatus(root);
    if (expected) {
      assert(Math.abs(status.bbw - expected.bbw) < 0.001, `${interval} BBW differs from same-frequency bars`);
      assert(Math.abs(status.percentB - expected.percentB) < 0.001, `${interval} %B differs from same-frequency bars`);
    }
    result.intervals.push({ interval, asOf: status.asOf, bbw: status.bbw, percentB: status.percentB });
  }
}
async function checkLegacy(page, item, result) {
  const state = await page.evaluate(({ code, market, instrument, workspace }) => {
    const key = `ked:chart:v2:${market}:${code}:day:${instrument}:${workspace ? 'workspace-0' : 'detail'}`;
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  }, { code: item.code, market: item.market, instrument: item.instrument, workspace: Boolean(item.charts) });
  assert(state?.bollinger?.version === 1, 'legacy Bollinger settings were not versioned');
  assert.equal(state.bollinger.adoptedIndicatorUid, 'qa-default-bb');
  const custom = state.indicators.find(indicator => indicator.uid === 'qa-custom-bb');
  assert(custom && custom.params.period === 30 && custom.params.mult === 2.3 && custom.color === '#CC00CC', 'custom BB lost during migration');
  assert.equal(state.indicators.filter(indicator => indicator.id === 'bb').length, 2, 'legacy BB migration duplicated or removed indicators');
  assert(state.indicators.some(indicator => indicator.id === 'sma' && indicator.params.period === 50), 'custom SMA50 lost during BB migration');
  assert.equal(state.drawings[0]?.id, 'qa-legacy-line', 'legacy drawing was lost');
  result.legacyMigration = { defaultAdopted: true, customBbPreserved: true, customSmaPreserved: true, drawingPreserved: true };
}
async function checkFullscreen(page, root, item, theme, result) {
  const before = await visibleState(root);
  await root.getByTestId('chart-fullscreen').click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement), undefined, { timeout });
  await root.getByTestId('bollinger-settings').click();
  assert.equal(await page.getByTestId('bollinger-settings-panel').evaluate(el => document.fullscreenElement.contains(el)), true, 'Bollinger settings portal escaped fullscreen');
  await page.getByTestId('bollinger-preset').selectOption('standard');
  await closeSettings(page);
  await nativeCheck(page, root, item, theme, {});
  const screenshot = `${out}/${item.id}-${theme}-fullscreen.png`;
  await root.screenshot({ path: screenshot });
  await root.getByTestId('chart-fullscreen').click();
  await page.waitForFunction(() => !document.fullscreenElement, undefined, { timeout });
  assert.deepEqual(await visibleState(root), before, 'fullscreen reset the time range');
  result.fullscreen = { portal: true, nativeBollingerRetained: true, screenshot };
}
async function checkScreener(page, theme, viewport, result) {
  await page.goto(`${base}/bollinger`, { waitUntil: 'domcontentloaded' });
  const root = page.getByTestId('bollinger-screener');
  await root.waitFor();
  await page.getByText('선택 종목 수동 진단 · 기존 최대 10개 경로', {exact:true}).click();
  // The route has server-rendered controls before React attaches their events.
  // Wait for the controlled input to be hydrated before filling/submitting it.
  await page.waitForFunction(() => {
    const input = document.getElementById('bollinger-symbols');
    return input && Object.keys(input).some(key => key.startsWith('__reactProps$'));
  }, undefined, { timeout });
  const queries = () => result.calls.filter(call => call.name === 'getBollingerScreener').length;
  assert.equal(queries(), 0, 'screener queried histories without an explicit action');
  await page.getByLabel(/종목 코드/).fill('KR:005930, US:NVDA, KR:403870, US:BOTZ, KR:000660');
  await page.getByRole('button', { name: '선택 종목 조회', exact: true }).click();
  await page.getByRole('region', { name: '순위에서 제외된 조회 결과' }).waitFor();
  assert.equal(queries(), 1, 'manual screener action did not use one snapshot request');
  const excluded = page.getByRole('region', { name: '순위에서 제외된 조회 결과' });
  assert((await excluded.textContent()).includes('403870') && (await excluded.textContent()).includes('BOTZ') && (await excluded.textContent()).includes('000660'), 'stale/warmup/error rows were lost');
  const visibleLinks = code => page.getByRole('link', { name: new RegExp(`QA SYNTHETIC ${code} ${code} 일봉`) }).filter({ visible: true });
  assert.equal(await visibleLinks('005930').count(), 1); assert.equal(await visibleLinks('NVDA').count(), 1);
  await page.getByRole('checkbox', { name: 'BBW 분위수 ≤ 10%', exact: true }).check();
  assert.equal(await visibleLinks('005930').count(), 1); assert.equal(await visibleLinks('NVDA').count(), 0, 'BBW filter failed');
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click();
  await page.getByRole('checkbox', { name: '외국인 보유비율 5거래일 변화 > 0', exact: true }).check();
  assert.equal(await visibleLinks('NVDA').count(), 0, 'missing U.S. flow was treated as positive');
  assert.equal(await visibleLinks('005930').count(), 1);
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click();
  await page.getByLabel('Setup Quality ≥', { exact: true }).fill('95');
  assert.equal(await visibleLinks('005930').count(), 0);
  assert.equal(await visibleLinks('NVDA').count(), 0);
  assert.equal(await visibleLinks('403870').count(), 1, 'stale result should remain in the excluded group');
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click();
  assert.equal(queries(), 1, 'filtering refetched full histories');
  assert.equal(result.calls.filter(call => call.name === 'getChartData').length, 0, 'screener browser fetched full price histories');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'screener page overflow');
  result.screenshot = `${out}/screener-${theme}-${viewport.id}.png`;
  await root.screenshot({ path: result.screenshot });
  result.screener = { explicitRequest: true, clientHistoryFetches: 0, filtersLocal: true, missingFlowExcluded: true, unavailableGroupRetained: true };
}
function recordBrowserErrors(page, result) {
  result.consoleErrors = []; result.resourceFailures = []; result.rpcResponses = [];
  page.on('pageerror', error => result.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    result.resourceFailures.push({ origin: url.origin, path: url.pathname, error: request.failure()?.errorText ?? 'unknown' });
  });
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === new URL(base).origin && url.pathname.startsWith('/assets/') && response.status() >= 400)
      result.errors.push(`Built asset HTTP ${response.status()}: ${url.pathname}`);
    if (mode === 'real') {
      const name = names[url.pathname.split('/_serverFn/')[1]];
      if (name) {
        const rpc = { name, status: response.status(), bodyCompleted: false };
        rpc.contentType = response.headers()['content-type']?.split(';')[0] ?? null;
        result.rpcResponses.push(rpc);
        void response.finished().then(async transferError => {
          rpc.bodyCompleted = !transferError;
          rpc.transferFailed = Boolean(transferError);
          if (transferError || name !== 'getChartData') return;
          try {
            const raw = await response.json();
            const payload = response.headers()['x-tss-serialized'] ? fromCrossJSON(raw, { refs: new Map() }) : raw;
            const data = payload?.result ?? payload;
            if (Array.isArray(data?.bars)) rpc.barCount = data.bars.length;
            const error = payload instanceof Error ? payload : payload?.error;
            rpc.applicationError = Boolean(error);
            if (error) {
              // Classify a small set of known conditions; never retain the raw
              // application/provider error message, response or headers.
              const message = String(error.message ?? '').toLowerCase();
              rpc.applicationErrorCode = /timeout|timed out|etimedout/.test(message) ? 'TIMEOUT'
                : /enotfound|eai_again|getaddrinfo/.test(message) ? 'UPSTREAM_DNS_ERROR'
                : /fetch failed|network|econnreset/.test(message) ? 'UPSTREAM_NETWORK_ERROR'
                : /429|rate limit|too many requests/.test(message) ? 'RATE_LIMIT'
                : /401|403|unauthorized|forbidden/.test(message) ? 'AUTHORIZATION_ERROR'
                : /abort/.test(message) ? 'ABORTED'
                : 'UNCLASSIFIED_APPLICATION_ERROR';
            }
          } catch { rpc.payloadDecoded = false; }
        }).catch(() => { rpc.transferFailed = true; });
      }
    }
  });
  page.on('request', request => {
    if (mode !== 'real') return;
    const url = new URL(request.url()); const id = url.pathname.split('/_serverFn/')[1];
    const name = names[id]; if (!name) return;
    let data = {};
    try { const raw = request.method() === 'POST' ? request.postData() : url.searchParams.get('payload'); const payload = raw ? fromJSON(JSON.parse(raw)) : {}; data = payload.data ?? payload; } catch { /* Safe metadata remains unknown. */ }
    result.calls.push({ name, code: data.code ?? null, interval: data.interval ?? null, range: data.range ?? null });
  });
}

assert(cases.length && viewports.length, 'No cases/viewports selected');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) });
const results = [];
try {
  for (const item of screenerOnly ? [] : cases) for (const theme of list('--themes', 'light,dark')) for (const viewport of viewports) {
    const result = { case: item.id, code: item.code, theme, viewport: viewport.id, mode, productionBundle: true, calls: [], errors: [], success: false };
    results.push(result);
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile ?? false, hasTouch: viewport.hasTouch ?? false, deviceScaleFactor: viewport.id === 'mobile' ? 2 : 1 });
    const page = await context.newPage();
    recordBrowserErrors(page, result);
    await page.addInitScript(({ theme, legacy, item }) => {
      if (!localStorage.getItem('korea-equity-cc')) localStorage.setItem('korea-equity-cc', JSON.stringify({ state: { theme }, version: 4 }));
      if (!legacy) return;
      const key = `ked:chart:v2:${item.market}:${item.code}:day:${item.instrument}:${item.charts ? 'workspace-0' : 'detail'}`;
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
        v: 2, chartType: 'candles', scale: 'normal', overlays: {},
        indicators: [5, 20, 60, 50].map(period => ({ uid: `qa-sma-${period}`, id: 'sma', params: { period }, visible: true, colorMode: 'theme' })).concat([
          { uid: 'qa-default-bb', id: 'bb', params: { period: 20, mult: 2 }, visible: true },
          { uid: 'qa-custom-bb', id: 'bb', params: { period: 30, mult: 2.3 }, visible: true, color: '#CC00CC' },
        ]), drawings: [{ id: 'qa-legacy-line', type: 'hline', anchors: [{ t: '2025-01-02', p: item.market === 'US' ? 100 : 30000 }], color: '#339977', width: 1 }],
      }));
    }, { theme, legacy, item });
    await page.addInitScript(probe);
    if (mode === 'fixture') await fixtures(page, result.calls);
    try {
      await page.goto(`${base}${item.path}`, { waitUntil: 'domcontentloaded' });
      let root = page.getByTestId(item.shell).first();
      await root.getByTestId('bollinger-master').waitFor({ timeout });
      await root.getByTestId('bollinger-status').waitFor({ timeout });
      result.viewportPx = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
      assert.equal(result.viewportPx.width, viewport.width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'page horizontal overflow');
      if (item.charts) assert.equal(await page.getByTestId('bollinger-master').count(), item.charts, 'workspace chart count incorrect');
      const collapsed = (await paneState(root)).length === 0;
      result.responsiveDefaultCollapsed = collapsed;
      if (viewport.id === 'mobile' || (item.charts ?? 1) > 1) assert(collapsed, 'compact chart did not default to collapsed Bollinger panes');
      if (collapsed) await expandPanes(page, root);
      await page.waitForTimeout(250);
      await root.scrollIntoViewIfNeeded();
      await page.mouse.move(5, 5);
      result.phase = 'initial-native-render';
      await nativeCheck(page, root, item, theme, result);
      if(discovery&&item.id==='workspace-1'){
        await root.getByTestId('discovery-chart-context').waitFor();
        assert.match(await root.getByTestId('discovery-chart-context').innerText(),/Long Readiness/);
        await page.waitForFunction(shell=>{
          const color=getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim().toLowerCase();
          return window.__bbDraws.some(r=>r.shell===shell&&r.method==='stroke'&&r.strokeColor.toLowerCase()===color&&r.dash?.length===2&&Math.abs(r.lineWidth-1)<.1&&r.htsPane==='price');
        },item.shell,{timeout});
        result.discovery={storedContext:true,nativeDashedResistance:true};
      }
      const status = await latestStatus(root);
      assert(Number.isFinite(status.bbw) && Number.isFinite(status.percentB), 'Bollinger status has no numeric observations');
      if (mode === 'fixture') {
        const expected = expectedBollinger(fixtureBars(item.code));
        assert(Math.abs(status.bbw - expected.bbw) < 0.001, 'BBW status calculation differs from population BB20/2');
        assert(Math.abs(status.percentB - expected.percentB) < 0.001, '%B status does not use current chart history');
        assert(Number.isFinite(status.percentile), 'true BBW percentile missing despite sufficient history');
      }
      result.status = status;
      root = await interactions(page, root, item, theme, viewport, result);
      if ((await paneState(root)).length === 0) await expandPanes(page, root);
      await root.scrollIntoViewIfNeeded();
      await root.screenshot({ path: `${out}/${item.id}-${theme}-${viewport.id}.png` });
      result.screenshot = `${out}/${item.id}-${theme}-${viewport.id}.png`;
      await clearProbe(page);
      const other = theme === 'light' ? 'dark' : 'light';
      result.phase = 'live-theme-native-render';
      await page.getByRole('button', { name: '테마 전환', exact: true }).click();
      await nativeCheck(page, root, item, other, { });
      await page.getByRole('button', { name: '테마 전환', exact: true }).click();
      result.liveTheme = true;
      if (legacy) await checkLegacy(page, item, result);
      if (viewport.id === 'desktop' && item.id === 'workspace-1') await checkFullscreen(page, root, item, theme, result);
      if (viewport.id === 'desktop' && item.id === 'stock-005930') {
        await checkReplay(page, root, item, result);
        await checkIntervals(page, root, item, result);
      }
      assert.deepEqual(result.errors, [], 'browser runtime error');
      result.phase = 'complete';
      result.success = true;
    } catch (error) {
      result.failure = error.message;
      result.failureStack = error.stack;
      result.diagnostic = await page.evaluate(() => ({ text: document.body.textContent?.slice(-3500), htmlClass: document.documentElement.className,
        masterStates: [...document.querySelectorAll('[data-testid="bollinger-master"]')].map(el => ({ state: el.getAttribute('aria-pressed'), text: el.textContent })),
        savedBollinger: Object.keys(localStorage).filter(key => key.startsWith('ked:chart:v2:')).map(key => {
          try { const layout = JSON.parse(localStorage.getItem(key)); return { key, bollinger: layout?.bollinger ?? null }; } catch { return { key, invalidJson: true }; }
        }),
        statuses: [...document.querySelectorAll('[data-testid="bollinger-status"]')].map(el => ({ ...el.dataset, text: el.textContent })), panes: [...document.querySelectorAll('[data-bollinger-pane]')].map(el => ({ ...el.dataset, height: el.getBoundingClientRect().height })), draws: window.__bbDraws.slice(-70), texts: window.__bbTexts.slice(-70) }));
      await page.screenshot({ path: `${out}/${item.id}-${theme}-${viewport.id}-FAILED.png` });
    }
    writeFileSync(`${out}/result.json`, JSON.stringify({ mode, synthetic: mode === 'fixture', productionBundle: true, results }, null, 2));
    console.log(JSON.stringify({ case: item.id, theme, viewport: viewport.id, success: result.success, failure: result.failure }));
    await context.close();
  }
  if (withScreener && mode === 'fixture') for (const theme of list('--themes', 'light,dark')) for (const viewport of viewports) {
    const result = { case: 'screener', theme, viewport: viewport.id, mode, productionBundle: true, calls: [], errors: [], success: false };
    results.push(result);
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.id === 'mobile' ? 2 : 1 });
    const page = await context.newPage(); recordBrowserErrors(page, result);
    await page.addInitScript(theme => localStorage.setItem('korea-equity-cc', JSON.stringify({ state: { theme }, version: 4 })), theme);
    await fixtures(page, result.calls);
    try { await checkScreener(page, theme, viewport, result); assert.deepEqual(result.errors, []); result.success = true; }
    catch (error) { result.failure = error.message; await page.screenshot({ path: `${out}/screener-${theme}-${viewport.id}-FAILED.png` }); }
    writeFileSync(`${out}/result.json`, JSON.stringify({ mode, synthetic: mode === 'fixture', productionBundle: true, results }, null, 2));
    console.log(JSON.stringify({ case: 'screener', theme, viewport: viewport.id, success: result.success, failure: result.failure }));
    await context.close();
  }
} finally {
  await browser.close();
  if (mode === 'fixture') { const { closeKiwoomBrowserFixture } = await import('./qa-kiwoom-fixture.mjs'); await closeKiwoomBrowserFixture(); }
}
assert(results.length && results.every(result => result.success), 'Bollinger production browser acceptance failed; see result.json');
