#!/usr/bin/env node
/** Test-only transport against the built app. No broker or operational DB calls.
 * node --experimental-strip-types scripts/qa-kiwoom-production.mjs
 *   --base <local production preview> --server-entry <compiled Nitro entry>
 * Legacy flow data uses the existing synthetic collector -> isolated PGlite fixture.
 * Collector diagnostics/queue states use a separate isolated PGlite fixture;
 * owner identity is synthetic and passed through the actual authorization guard.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
import { fromJSON, toCrossJSONAsync } from 'seroval';
import { PGlite } from '@electric-sql/pglite';
import { readKiwoomConfig } from '../src/server/kiwoom-config.ts';
import { diagnoseKiwoom } from '../src/server/kiwoom-diagnostics.ts';
import { createKiwoomStore } from '../src/server/kiwoom-store.ts';
import { createChartFlowService } from '../src/server/chart-flow.ts';
import { FLOW_METRICS } from '../src/lib/charts/hts-flow.ts';
import { kiwoomBrowserFixture, closeKiwoomBrowserFixture } from './qa-kiwoom-fixture.mjs';

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const base = option('--base', process.env.QA_BASE ?? 'http://127.0.0.1:8081');
const output = resolve(option('--out', '/workspace/screenshots/kiwoom-production-hardening'));
const entry = option('--server-entry', resolve(process.env.NITRO_OUTPUT_DIR ?? '.vercel/output', 'functions/__server.func/index.mjs'));
const compiled = readFileSync(entry, 'utf8');
const names = Object.fromEntries([...compiled.matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName: "([^"]+)"/g)]
  .map(match => [match[1], match[2].replace(/_createServerFn_handler$/, '')]));
assert(Object.values(names).includes('getKiwoomDiagnostics'), 'Built diagnostic RPC map missing');
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'function-map.json'), JSON.stringify(names));

const bars = [];
for (let day = 0; bars.length < 180; day++) {
  const date = new Date(Date.UTC(2025, 0, 2 + day));
  if ([0, 6].includes(date.getUTCDay())) continue;
  const i = bars.length, close = 30000 + i * 20 + Math.sin(i / 9) * 700;
  bars.push({ date: date.toISOString().slice(0, 10), open: close - 45, high: close + 90,
    low: close - 100, close, volume: 100000 + i * 1300 });
}
const request = { code: '005930', market: 'KR', instrument: 'stock', exchange: 'KRX',
  flowScope: 'KRX', currency: 'KRW', quantityUnit: '주', interval: 'day',
  from: bars[0].date, to: bars.at(-1).date };
const counters = { databaseOpens: 0, ipChecks: 0 };
const rejectOperationalStore = async () => { counters.databaseOpens++; throw new Error('QA must not open operational storage'); };
const rejectEgress = async () => { counters.ipChecks++; throw new Error('QA must not discover real egress'); };
const collectorPg = new PGlite();
await collectorPg.waitReady;
for (const migration of ['0002_kiwoom_flow.sql', '0003_kiwoom_collection_targets.sql', '0004_kiwoom_collector_runtime.sql']) {
  await collectorPg.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
}
const collectorStatements = [];
const collectorStore = createKiwoomStore({ query: async (sql, params) => {
  collectorStatements.push(sql);
  return (await collectorPg.query(sql, params)).rows;
} });
const collectorConfig = {
  ...readKiwoomConfig({ KIWOOM_FLOW_ENABLED: 'true', KIWOOM_FLOW_MODE: 'collector', KIWOOM_ENV: 'mock',
    DATABASE_URL: 'postgresql://qa.invalid/synthetic', KIWOOM_DATA_SCOPE_ID: 'qa-browser-collector' }),
  // This fixture represents a verified owner session without changing app auth or issuing credentials.
  authEnabled: true, authenticationReady: true, ownerUserId: 'qa-synthetic-collector-owner',
};
const collectorIdentity = { scopeId: collectorConfig.dataScopeId, environment: collectorConfig.environment };
const collectorInstance = '11111111-1111-4111-8111-111111111111';
const fixtureCounters = { diagnosticDatabaseOpens: 0, readOnlyDiagnosticQueries: 0, clientConstructions: 0 };
let lastDiagnostic;
async function resetCollectorFixture() {
  await collectorPg.exec('delete from kiwoom_collection_targets; delete from kiwoom_collector_runtime');
  for (const code of ['005930', '000660']) {
    assert.equal(await collectorStore.targets.enqueue({ ...collectorIdentity, request: { ...request, code } }), 'COLLECTION_QUEUED');
  }
}
async function collectorState(state) {
  await collectorPg.query('delete from kiwoom_collector_runtime where scope_id=$1 and environment=$2',
    [collectorIdentity.scopeId, collectorIdentity.environment]);
  if (state === 'UNKNOWN') return;
  await collectorStore.collectorRuntime.start(collectorIdentity, collectorInstance);
  await collectorStore.collectorRuntime.update(collectorIdentity, collectorInstance, { event: 'success' });
  const age = { RUNNING: 60_000, STALE: 15 * 60_000, OFFLINE: 45 * 60_000 }[state];
  assert(Number.isFinite(age), 'unknown QA collector state');
  const heartbeat = new Date(Date.now() - age).toISOString();
  await collectorPg.query(`update kiwoom_collector_runtime set started_at=$3::timestamptz-interval '1 hour',
    last_heartbeat_at=$3::timestamptz,last_success_at=$3::timestamptz-interval '1 minute',
    last_error_code=$4 where scope_id=$1 and environment=$2`,
  [collectorIdentity.scopeId, collectorIdentity.environment, heartbeat, state === 'OFFLINE' ? 'QUEUE_CYCLE_FAILED' : null]);
}
const queueService = createChartFlowService({ config: () => collectorConfig, store: async () => collectorStore,
  checkEgress: rejectEgress, client: () => { fixtureCounters.clientConstructions++; throw new Error('Collector QA must not construct a broker client'); } });
async function queueFixture(data, owner) {
  const result = await queueService(data, undefined, owner ? collectorConfig.ownerUserId : null);
  for (const metric of FLOW_METRICS) {
    assert.equal(result[metric].health, 'COLLECTION_QUEUED');
    assert.deepEqual(result[metric].observations, [], 'queue waiting must not fabricate observations');
    assert.match(result[metric].reason, owner ? /수집기 OFFLINE/ : /고정 IP 수집기 대기/);
    if (!owner) assert(!result[metric].reason.includes('OFFLINE'), 'public queue response leaked collector telemetry');
    result[metric].source = '키움증권 · QA SYNTHETIC (실데이터 아님)';
  }
  return result;
}
const diagnostics = async (policy) => {
  if (['owner', 'collector-public'].includes(policy)) {
    const start = collectorStatements.length;
    lastDiagnostic = await diagnoseKiwoom(collectorConfig, request,
      policy === 'owner' ? collectorConfig.ownerUserId : null, {
        store: policy === 'owner' ? async () => { fixtureCounters.diagnosticDatabaseOpens++; return collectorStore; } : rejectOperationalStore,
        checkEgress: rejectEgress,
      });
    const statements = collectorStatements.slice(start);
    assert(statements.every(sql => /^\s*select\b/i.test(sql)), 'owner diagnostics must remain read-only');
    fixtureCounters.readOnlyDiagnosticQueries += statements.length;
    if (policy === 'collector-public') {
      assert.equal(statements.length, 0);
      assert.equal(lastDiagnostic.collector, null);
      assert.deepEqual(lastDiagnostic.metrics, {});
    }
    for (const privateValue of [collectorConfig.ownerUserId, collectorConfig.dataScopeId, collectorInstance]) {
      assert(!JSON.stringify(lastDiagnostic).includes(privateValue), 'diagnostic response leaked private fixture identity');
    }
    return lastDiagnostic;
  }
  return diagnoseKiwoom(readKiwoomConfig({
  KIWOOM_FLOW_ENABLED: 'true', KIWOOM_FLOW_MODE: policy === 'direct' ? 'direct' : 'collector',
  KIWOOM_ENV: 'real', DATABASE_URL: 'postgresql://qa.invalid/synthetic',
  VITE_AUTH_ENABLED: 'false', KIWOOM_READ_AUTH_REQUIRED: policy === 'private' ? 'true' : 'false',
}), request, null, {
  store: rejectOperationalStore,
  checkEgress: rejectEgress,
});
};
const results = [];
const flowResults = [];
let policy = 'public';
let flowFixture = 'legacy';

async function transport(page) {
  await page.route('**/_serverFn/**', async route => {
    const id = new URL(route.request().url()).pathname.split('/_serverFn/')[1];
    const name = names[id];
    let data = {};
    const raw = route.request().method() === 'POST' ? route.request().postData()
      : new URL(route.request().url()).searchParams.get('payload');
    if (raw) { const payload = fromJSON(JSON.parse(raw)); data = payload.data ?? payload; }
    let result;
    if (name === 'getKiwoomDiagnostics') result = await diagnostics(policy);
    else if (name === 'getChartData') result = { bars, source: 'QA SYNTHETIC OHLCV — NOT MARKET DATA' };
    else if (name === 'getChartSecurity') result = { code: data.code, market: 'KR', exchange: 'KRX',
      instrument: 'stock', currency: 'KRW', quantityUnit: '주', source: 'QA SYNTHETIC SECURITY' };
    else if (name === 'getChartFlow') {
      result = flowFixture === 'legacy' ? await kiwoomBrowserFixture(data, bars)
        : await queueFixture(data, flowFixture === 'queue-owner');
      flowResults.push(result);
    } else if (name === 'getStockBundle') result = { meta: { code: data.code, nameKo: 'QA SYNTHETIC (실데이터 아님)',
      market: 'KOSPI', sectorId: 'electronics' }, quote: null, basic: null,
      flow: { days: [], source: 'QA SYNTHETIC' }, research: [], researchPack: { company: [], industry: [], market: [], economy: [] },
      news: [], disclosures: [], disclosureMeta: { dartCount: 0, koscomCount: 0 }, fetchedAt: '2026-10-05T00:00:00Z' };
    else if (['getStockNews', 'getStockDisclosures'].includes(name)) result = [];
    else return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'x-tss-serialized': 'true' },
      body: JSON.stringify(await toCrossJSONAsync({ result, error: undefined, context: {} }, { refs: new Map() })) });
  });
  await page.route('**/api/feed?**', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [], sources: [], partial: false, nextCursor: null, generatedAt: '2026-10-05T00:00:00Z' }) }));
  await page.route('**/api/market-stream?**', route => route.fulfill({ status: 200, contentType: 'text/event-stream',
    body: 'event: status\ndata: {"enabled":false,"connected":false,"provider":"QA SYNTHETIC"}\n\n' }));
}
async function closeSettings(page) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].every(el => !el.getClientRects().length));
}
async function openSettings(page) {
  const trigger = page.getByTestId('open-hts-settings').first();
  if (!await trigger.isVisible()) await page.getByTestId('chart-tools-mobile').first().click();
  await trigger.click();
  return page.getByTestId('hts-settings');
}
async function chartReady(page) {
  await page.locator('[data-hts-pane="volume"]').first().waitFor();
  await page.waitForFunction(() => (document.querySelector('[data-testid="hts-data-details"]')?.textContent.match(/QA SYNTHETIC/g) ?? []).length >= 3);
}
async function screenshot(page, name) {
  await page.evaluate(() => {
    document.getElementById('qa-fixture-banner')?.remove();
    const banner = document.createElement('div'); banner.id = 'qa-fixture-banner';
    banner.textContent = 'QA SYNTHETIC · 테스트 데이터 · 실데이터 검증 아님';
    Object.assign(banner.style, { position: 'fixed', bottom: '0', left: '0', right: '0',
      background: '#553500', color: '#fff', fontSize: '12px', padding: '5px', zIndex: '99999', pointerEvents: 'none' });
    document.body.append(banner);
  });
  const path = join(output, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) });
try {
  for (const viewport of [{ id: 'desktop', width: 1440, height: 900 }, { id: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile, hasTouch: viewport.hasTouch, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await context.newPage(); page.setDefaultTimeout(35000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const item = { viewport: viewport.id, synthetic: true, status: 'failed', screenshots: [], errors };
    results.push(item);
    try {
      await transport(page);
      await resetCollectorFixture();
      for (const authPolicy of ['public', 'private', 'direct']) {
        policy = authPolicy;
        assert.equal((await page.goto(`${base}/status/kiwoom`, { waitUntil: 'domcontentloaded' })).status(), 200);
        await page.getByTestId('kiwoom-health').waitFor();
        const health = await page.getByTestId('kiwoom-health').textContent();
        const read = await page.getByTestId('kiwoom-market-read-access').textContent();
        assert.match(await page.getByTestId('kiwoom-operator-access').textContent(), /소유자 로그인 필요/);
        assert.equal(await page.getByTestId('kiwoom-database-inspection').textContent(), '미점검');
        assert.equal(await page.getByRole('columnheader', { name: '최종 관측일', exact: true }).count(), 0);
        assert.equal(await page.getByTestId('kiwoom-collector-runtime').count(), 0, 'visitor sees operational collector section');
        if (authPolicy === 'public') {
          assert.match(health, /공개 시장자료 읽기 설정됨/);
          assert.match(read, /공개 읽기 허용 · 로그인 불필요/);
          assert(!await page.getByText(/\(OWNER_AUTH_FAILED\)/).count(), 'public read falsely reported owner failure');
          assert(!/준비됨|정상|NO_HISTORY/.test(health), 'uninspected DB falsely verified');
          item.screenshots.push(await screenshot(page, `public-status-${viewport.id}`));
        } else assert.match(read, /소유자 로그인 필요/);
      }
      item.collectorStates = [];
      for (const state of ['RUNNING', 'STALE', 'OFFLINE', 'UNKNOWN']) {
        await collectorState(state);
        policy = 'owner';
        await page.goto(`${base}/status/kiwoom`, { waitUntil: 'domcontentloaded' });
        const runtime = page.getByTestId('kiwoom-collector-runtime');
        await runtime.waitFor();
        assert.equal(lastDiagnostic.ownerAuthorized, true);
        assert.equal(lastDiagnostic.collector.state, state);
        assert.equal(lastDiagnostic.collector.pendingTargets, 2);
        assert.match(await page.getByTestId('kiwoom-operator-access').textContent(), /소유자 확인됨/);
        assert.equal(await page.getByTestId('kiwoom-database-inspection').textContent(), '연결됨');
        assert.equal(await page.getByRole('columnheader', { name: '최종 관측일', exact: true }).count(), 1);
        assert.equal(await runtime.getByRole('heading').textContent(), `고정 IP 수집기 · ${state}`);
        const expectedTime = value => value ? `${new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))} KST` : '없음';
        assert.equal(await page.getByTestId('kiwoom-collector-heartbeat').textContent(), expectedTime(lastDiagnostic.collector.lastHeartbeatAt));
        const field = label => runtime.locator('div').filter({ has: page.locator('dt', { hasText: label }) }).locator('dd');
        assert.equal(await field('마지막 정상 주기').textContent(), expectedTime(lastDiagnostic.collector.lastSuccessAt));
        assert.equal(await field('처리 가능한 대기 대상').textContent(), '2');
        assert.equal(await field('마지막 안전한 오류 코드').textContent(), state === 'OFFLINE' ? 'QUEUE_CYCLE_FAILED' : '없음');
        item.collectorStates.push({ state, heartbeat: lastDiagnostic.collector.lastHeartbeatAt,
          lastSuccessAt: lastDiagnostic.collector.lastSuccessAt, pendingTargets: lastDiagnostic.collector.pendingTargets });
        item.screenshots.push(await screenshot(page, `collector-${state.toLowerCase()}-${viewport.id}`));
      }
      policy = 'collector-public';
      await page.goto(`${base}/status/kiwoom`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('kiwoom-health').waitFor();
      assert.equal(await page.getByTestId('kiwoom-collector-runtime').count(), 0);
      assert.equal(await page.getByRole('columnheader', { name: '최종 관측일', exact: true }).count(), 0);
      assert.equal(await page.getByTestId('kiwoom-database-inspection').textContent(), '미점검');
      assert.match(await page.getByTestId('kiwoom-health').textContent(), /공개 시장자료 읽기 설정됨/);
      item.screenshots.push(await screenshot(page, `collector-public-${viewport.id}`));
      policy = 'public';
      flowFixture = 'legacy';
      await page.goto(`${base}/stock/005930`, { waitUntil: 'domcontentloaded' });
      await chartReady(page);
      let settings = await openSettings(page);
      assert.equal(await settings.getByLabel(/투신 표시 방식/).inputValue(), 'available-cumulative');
      const requestedStart = await settings.getByLabel('투신 누적 기준일', { exact: true }).inputValue();
      await closeSettings(page);
      await page.waitForFunction(date => document.querySelector('[data-testid="hts-data-details"] summary')?.textContent.includes(`가용 시작 ${date}부터 누적`), bars[61].date);
      const details = await page.getByTestId('hts-data-details').textContent();
      assert.match(details, /29,500 주/, 'continuous run cumulative must preserve zero and signed net selling');
      const source = flowResults.at(-1).investmentTrust.observations;
      assert.equal(source.find(row => row.date === bars[60].date).value, null);
      assert.equal(source.find(row => row.date === bars[61].date).value, 0);
      assert.equal(source.find(row => row.date === bars[63].date).value, -1000);
      assert(requestedStart < bars[61].date, 'effective start must be explicit after earlier gap');
      await page.getByTestId('chart-canvas').first().scrollIntoViewIfNeeded();
      item.screenshots.push(await screenshot(page, `available-default-${viewport.id}`));
      item.requestedStart = requestedStart; item.effectiveStart = bars[61].date;
      const panes = await page.locator('[data-hts-pane]').evaluateAll(nodes => nodes.map(el => ({ id: el.dataset.htsPane,
        height: el.getBoundingClientRect().height, canvases: el.querySelectorAll('canvas').length })));
      assert.deepEqual(panes.map(p => p.id), ['rsi', 'price', 'credit', 'foreign', 'investmentTrust', 'volume']);
      assert(panes.every(p => p.height > 20 && p.canvases > 0));
      for (const savedMode of ['daily', 'cumulative']) {
        settings = await openSettings(page);
        await settings.getByLabel(/투신 표시 방식/).selectOption(savedMode);
        await closeSettings(page);
        if (savedMode === 'daily') await page.waitForFunction(() => /투신 일별 순매수-1,000 주/.test(document.querySelector('[data-testid="hts-data-details"]')?.textContent ?? ''));
        else await page.waitForFunction(() => document.querySelector('[data-testid="hts-data-details"]')?.textContent.includes('기준일 이후 누락: 누적순매수 미확정'));
        await page.reload({ waitUntil: 'domcontentloaded' }); await chartReady(page);
        settings = await openSettings(page);
        assert.equal(await settings.getByLabel(/투신 표시 방식/).inputValue(), savedMode);
        assert.equal(await settings.getByLabel('투신 누적 기준일', { exact: true }).inputValue(), requestedStart);
        await closeSettings(page);
      }
      await page.goto(`${base}/stock/403870`, { waitUntil: 'domcontentloaded' }); await chartReady(page);
      settings = await openSettings(page);
      assert.equal(await settings.getByLabel(/투신 표시 방식/).inputValue(), 'available-cumulative', 'saved mode leaked to another symbol');
      await closeSettings(page);
      await page.goto(`${base}/stock/005930`, { waitUntil: 'domcontentloaded' }); await chartReady(page);
      settings = await openSettings(page);
      assert.equal(await settings.getByLabel(/투신 표시 방식/).inputValue(), 'cumulative', 'saved fixed mode lost on symbol round trip');
      await settings.getByRole('button', { name: '국내주식·ETF HTS 기본 배치 복원', exact: true }).click();
      assert.equal(await settings.getByLabel(/투신 표시 방식/).inputValue(), 'available-cumulative');
      assert.equal(await settings.getByLabel('투신 누적 기준일', { exact: true }).inputValue(), requestedStart);
      await closeSettings(page);
      await page.reload({ waitUntil: 'domcontentloaded' }); await chartReady(page);
      settings = await openSettings(page);
      assert.equal(await settings.getByLabel(/투신 표시 방식/).inputValue(), 'available-cumulative');
      await closeSettings(page);
      await collectorState('OFFLINE');
      item.queueStates = [];
      for (const mode of ['queue-public', 'queue-owner']) {
        flowFixture = mode;
        await page.goto(`${base}/stock/035420?qa-fixture=${mode}`, { waitUntil: 'domcontentloaded' });
        await chartReady(page);
        const queueReason = mode === 'queue-owner' ? '수집기 OFFLINE' : '고정 IP 수집기 대기';
        await page.waitForFunction(reason => {
          const text = document.querySelector('[data-testid="hts-data-details"]')?.textContent ?? '';
          return text.includes('키움 수집 예약됨') && text.includes(reason);
        }, queueReason);
        const details = page.getByTestId('hts-data-details');
        assert.equal(flowResults.at(-1).request.code, '035420');
        assert.match(await details.textContent(), /키움 수집 예약됨/);
        assert.match(await details.textContent(), mode === 'queue-owner' ? /수집기 OFFLINE/ : /고정 IP 수집기 대기/);
        if (mode === 'queue-public') assert(!/OFFLINE|NO_HISTORY/.test(await details.textContent()));
        await details.locator('summary').click();
        await details.scrollIntoViewIfNeeded();
        item.queueStates.push({ mode, health: flowResults.at(-1).credit.health, observations: flowResults.at(-1).credit.observations.length });
        item.screenshots.push(await screenshot(page, `${mode}-${viewport.id}`));
      }
      flowFixture = 'legacy';
      assert.equal(errors.length, 0, 'production application runtime errors');
      item.status = 'passed';
      console.log(`PASS production synthetic Kiwoom ${viewport.id}`);
    } catch (error) {
      item.error = String(error).slice(0, 1000);
      item.screenshots.push(await screenshot(page, `failed-${viewport.id}`).catch(() => null));
      console.log(`FAIL production synthetic Kiwoom ${viewport.id}: ${item.error}`);
    } finally {
      await context.close();
      writeFileSync(join(output, 'verdict.json'), JSON.stringify({ synthetic: true, base,
        at: new Date().toISOString(), operationalDatabaseInspected: false, brokerCalled: false,
        ownerAuthentication: 'synthetic verified identity through diagnoseKiwoom; no production session', counters, fixtureCounters, results }, null, 2));
    }
  }
  assert.deepEqual(counters, { databaseOpens: 0, ipChecks: 0 });
  assert.equal(fixtureCounters.clientConstructions, 0);
} finally { await browser.close(); await closeKiwoomBrowserFixture(); await collectorPg.close(); }
process.exitCode = results.some(item => item.status !== 'passed') ? 1 : 0;
