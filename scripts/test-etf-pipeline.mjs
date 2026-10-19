/** Exercise the actual server pipeline with controlled external responses. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'vite';

const originalFetch = globalThis.fetch;
// This fixture server must not invalidate a running app's optimizer metadata.
const cacheDir = mkdtempSync(join(tmpdir(), 'k-equity-etf-pipeline-'));
const server = await createServer({ configFile: false, cacheDir, resolve: { alias: { '@': resolve('src') } }, server: { middlewareMode: true }, logLevel: 'error' });
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
  assert.equal(holdings.issuerProductUrl, 'https://www.soletf.com/ko/fund/etf/211124');
  assert.equal(holdings.status, 'historical');
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
    if (url.includes('/stock/285A.T/basic')) return json({ reutersCode:'285A.T', closePrice:'5000', compareToPreviousClosePrice:'100', fluctuationsRatio:'2.04', compareToPreviousPrice:{code:'2'}, currencyType:{name:'JPY'} });
    throw new Error('Test fixture: unspecified request ' + url);
  };
  const thirdParty = await module.fetchEtfHoldings('111111');
  assert.equal(thirdParty.officialCount, 0);
  assert.equal(thirdParty.holdings.length, 2);
  assert.ok(thirdParty.holdings.every(row => row.weight === null));
  const quotes = await module.fetchWorldQuotes(['285A.T']);
  assert.equal(quotes['285A.T'].currency, 'JPY');
  assert.equal(quotes['285A.T'].price, 5000);
  // Real issuer response regression, served by fixtures to isolate failure in
  // unrelated catalogs/quotes. Published US stock weights survive unavailable FX.
  const kodexFixture = JSON.parse(readFileSync('src/server/fixtures/kodex-sp500-20261019.json', 'utf8'));
  const kodexPayload = { info:{product:kodexFixture.product}, pdf:kodexFixture.pdf };
  let directRequests = 0;
  let catalogRequests = 0;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes('/api/stock/379800/integration')) return json({ stockName:'KODEX 미국S&P500', etfKeyIndicator:{issuerName:'삼성자산운용'} });
    if (url.includes('/kodex/product/2ETFE4.do')) { directRequests++; return json(kodexPayload); }
    if (url.includes('/kodex/product.do?')) catalogRequests++;
    throw new Error('Test fixture: quote/catalog unavailable '+url);
  };
  const [a, b] = await Promise.all([module.fetchEtfHoldings('379800'), module.fetchEtfHoldings('379800')]);
  assert.equal(directRequests, 1, 'concurrent requests share one official basket retrieval');
  assert.equal(catalogRequests, 0, 'known product does not rediscover the full catalog');
  assert.equal(a, b);
  assert.equal(a.officialCount, 503);
  assert.equal(a.holdings.length, 504);
  assert.equal(a.asOf, '2026-10-19');
  assert.ok(Math.abs(a.holdings.reduce((sum,row)=>sum+(row.weight??0),0)-100.11)<1e-8);
  assert.equal(a.holdings.find(row=>row.nameKo==='원화현금').weight, null);
  assert.equal(a.holdings.find(row=>row.foreignTicker==='GOOGL').assetClass, 'us-equity');
  assert.equal(a.holdings.find(row=>row.foreignTicker==='GOOG').assetClass, 'us-equity');
  assert.equal(a.holdings.filter(row=>row.assetClass==='us-equity').length, 503);
  assert.equal(a.holdings.find(row=>row.nameKo==='NVIDIA Corp').weight, 7.88);
  const requestModule = await server.ssrLoadModule('/src/server/etf-request.ts');
  globalThis.fetch = async (input, init) => {
    const rc = decodeURIComponent(new URL(String(input)).pathname.split('/')[2]);
    if (rc === 'SLOW.O') return new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('Test fixture: delayed quote aborted')), {once:true});
    });
    return json({reutersCode:rc, closePrice:'101', compareToPreviousClosePrice:'1', fluctuationsRatio:'1', compareToPreviousPrice:{code:'2'}, currencyType:{name:'USD'}});
  };
  const partial = {};
  const retained = await requestModule.withEtfDeadline(signal=>module.fetchWorldQuotes(['A.O','B.O','C.O','D.O','E.O','F.O','SLOW.O'], signal, partial), partial, 50);
  assert.equal(Object.keys(retained).length, 6, 'one delayed quote must not discard six successful US quotes');
  assert.equal(retained['A.O'].price,101);
  assert.equal(retained['A.O'].currency,'USD');
  assert.equal(a.holdings.find(row=>row.nameKo==='NVIDIA Corp').weight,7.88);
  // Synthetic one-security PDF verifies classification without a quote. The
  // encoded preferred class is not its actual exchange trading code.
  globalThis.fetch = async input => {
    const url=String(input);
    if(url.includes('/api/stock/069500/integration')) return json({stockName:'KODEX 200',etfKeyIndicator:{issuerName:'삼성자산운용'}});
    if(url.includes('/kodex/product/2ETF01.do')) return json({info:{product:{stkTicker:'069500',fId:'2ETF01'}},pdf:{gijunYMD:'20261019',list:[{secNm:'삼성전자우',itmNo:'KR7005931001',ratio:'100',applyQ:'1'}]}});
    throw new Error('Test fixture: no preferred quote available');
  };
  const preferred=await module.fetchEtfHoldings('069500');
  assert.equal(preferred.holdings[0].code,null);
  assert.equal(preferred.holdings[0].assetClass,'kr-equity');
  assert.equal(preferred.holdings[0].nation,'KOR');
  assert.equal(preferred.holdings[0].weight,100);
  console.log('ETF pipeline: attached XLS hash, 11 official weights, dated unavailable-quote fallback, rejected third-party weights, JPY quote, and 503 actual KODEX ratios with null cash, preserved US share classes, direct product selection and concurrent deduplication passed. All external calls were fixtures.');
} finally {
  globalThis.fetch = originalFetch;
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
