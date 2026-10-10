/** Exercise the actual server pipeline with controlled external responses. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const originalFetch = globalThis.fetch;
const server = await createServer({ configFile: false, resolve: { alias: { '@': resolve('src') } }, server: { middlewareMode: true }, logLevel: 'error' });
try {
  const module = await server.ssrLoadModule('/src/server/etf-market.ts');
  const snapshotModule = await server.ssrLoadModule('/src/data/etf-official-snapshots.ts');
  const snapshot = snapshotModule.SOL_DRAM_20261008_SNAPSHOT;
  const original = readFileSync('docs/upgrade/artifacts/etf-issuer/sol-dram-0246X0-20261008.xls');
  assert.equal(createHash('sha256').update(original).digest('hex'), snapshot.provenance.sha256);
  // Real outages can hang instead of rejecting immediately. The dated document
  // must still render within the source/enrichment budget, with requests aborted.
  globalThis.fetch = async (_input, init) => new Promise((_resolve, reject) => {
    const abort = () => reject(new Error('Test fixture: stalled upstream aborted'));
    if (init?.signal?.aborted) abort();
    else init?.signal?.addEventListener('abort', abort, { once: true });
  });
  const started = Date.now();
  const detailP = module.fetchEtfDetail('0246X0');
  const holdings = await module.fetchEtfHoldings('0246X0');
  assert.ok(Date.now() - started < 18_000, 'stalled sources must not block the historical issuer basket');
  assert.equal(holdings.sourceKind, 'issuer-file');
  assert.equal(holdings.asOf, '2026-10-08');
  assert.equal(holdings.holdings.length, 11);
  assert.equal(holdings.officialCount, 11);
  assert.equal(holdings.issuerProductUrl, null);
  assert.match(holdings.source, /過去|과거/);
  for (const expected of snapshot.rows) {
    const actual = holdings.holdings.find(row => row.nameKo === expected.nameKo);
    assert.ok(actual, expected.nameKo);
    assert.equal(actual.weight, expected.weight);
    assert.equal(actual.weightSource, 'official');
  }
  const kioxia = holdings.holdings.find(row => row.isin === 'JP3236330001');
  assert.equal(kioxia.nation, 'JPN');
  assert.equal(kioxia.currency, 'JPY');
  const unresolvedForeign = holdings.holdings.find(row => row.isin === 'IE00BKVD2N49');
  assert.equal(unresolvedForeign.nation, null);
  assert.equal(unresolvedForeign.currency, null);
  const detail = await detailP;
  assert.equal(detail.etf.quoteAvailable, false);

  const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes('/api/stock/111111/integration')) return json({ stockName: '검증 불가 ETF', etfKeyIndicator: { issuerName: 'Unknown' } });
    if (url.includes('wisereport.co.kr')) return new Response('var CU_data = ' + JSON.stringify({ grid_data: [
      { TRD_DT: '20261008', STK_NM_KOR: 'Kioxia', ETF_WEIGHT: 86.12, AGMT_STK_CNT: 119.18 },
      { TRD_DT: '20261008', STK_NM_KOR: '삼성전자', ETF_WEIGHT: 13.88, AGMT_STK_CNT: 457 },
    ] }) + '; var chartDraw');
    if (url.includes('/stock/285A.T/basic')) return json({ closePrice: '5000', currencyType: { name: 'JPY' } });
    throw new Error('Test fixture: unspecified request ' + url);
  };
  const thirdParty = await module.fetchEtfHoldings('111111');
  assert.equal(thirdParty.officialCount, 0);
  assert.equal(thirdParty.holdings.length, 2);
  assert.ok(thirdParty.holdings.every(row => row.weight === null));
  const quotes = await module.fetchWorldQuotes(['285A.T']);
  assert.equal(quotes['285A.T'].currency, 'JPY');
  assert.equal(quotes['285A.T'].price, 5000);
  console.log('ETF pipeline: attached XLS hash, 11 official weights, dated unavailable-quote fallback, rejected third-party weights, and JPY quote passed. All external calls were fixtures.');
} finally {
  globalThis.fetch = originalFetch;
  await server.close();
}
