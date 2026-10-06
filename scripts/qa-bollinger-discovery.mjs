#!/usr/bin/env node
/** Isolated DB → real response contract → browser transport fixtures.
 * Synthetic values never enter runtime application modules or an operational DB. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {chromium} from 'playwright';
import {fromJSON,toCrossJSONAsync} from 'seroval';
import {createDiscoveryStore} from '../src/server/bollinger-discovery-store.ts';
import {analyzeDiscovery,DISCOVERY_DEFAULTS,sanitizeDiscoveryConfig} from '../src/lib/bollinger/discovery.ts';
import {selectUniverse} from '../src/lib/bollinger/discovery-universe.ts';
import {discoveryBars,discoveryContexts,member,universe} from '../src/lib/bollinger/discovery-fixture.test-data.ts';
import {eventStudy} from '../src/lib/bollinger/discovery-backtest.ts';
import {readBollingerCloudConfig,safeCloudJob} from '../src/server/bollinger-cloud-config.ts';

const args=process.argv.slice(2),option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const base=option('--base','http://127.0.0.1:8189'),entry=option('--server-entry','/workspace/.onboarding/builds/k-equity-desk-v4/functions/__server.func/index.mjs');
const out=resolve(option('--out','docs/upgrade/artifacts/bollinger-screener-2/production'));
await mkdir(out,{recursive:true});
const compiled=await readFile(entry,'utf8'),names=Object.fromEntries([...compiled.matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName: "([^"]+)"/g)].map(m=>[m[1],m[2].replace(/_createServerFn_handler$/,'')]));
const pg=new PGlite();await pg.exec(await readFile(new URL('../migrations/0005_bollinger_discovery.sql',import.meta.url),'utf8'));
const store=createDiscoveryStore({query:async(t,p)=>(await pg.query(t,p)).rows});
const bars=discoveryBars(303).map((b,i)=>({...b,date:new Date(Date.UTC(2026,9,5)-(302-i)*86400000).toISOString().slice(0,10)}));
const result=analyzeDiscovery(bars,undefined,discoveryContexts(bars));assert.equal(result.candidates.at(-1).state,'ARMED');
const krMembers=Array.from({length:61},(_,i)=>({...member(String(500000+i)),name:`QA SYNTHETIC 종목 ${i+1}`,marketCap:(100-i)*1e12}));
krMembers[0]={...member(),name:'QA SYNTHETIC 삼성전자'};
const kr={...universe(krMembers),asOf:'2026-10-05',label:'QA SYNTHETIC KOSPI — NOT MARKET DATA'};
const usMembers=[{...member('NVDA'),market:'US',exchange:'NASDAQ',name:'QA SYNTHETIC NVIDIA'},{...member('AAPL'),market:'US',exchange:'NASDAQ',name:'QA SYNTHETIC Apple'}];
const us={...kr,id:'QA-SYNTHETIC-NASDAQ100',kind:'NASDAQ100',label:'QA SYNTHETIC Nasdaq100',members:usMembers,authoritative:true};
const etf={...kr,id:'QA-SYNTHETIC-ETF',kind:'ETF',label:'QA SYNTHETIC ETF (069500)',members:[{...krMembers[0],weight:30},{...krMembers[1],weight:20},{...member('444444'),assetType:'cash',weight:50}]};
for(const u of [kr,us,etf]){await store.saveUniverse(u);for(const m of u.members.filter(m=>m.assetType==='equity'))await store.saveFeatures(u.id,m,DISCOVERY_DEFAULTS.version,result.candidates,'QA SYNTHETIC — NOT MARKET DATA',m.market==='US'?'yahoo-us-adjusted-ohlcv':'yahoo-kr-raw-ohlcv');}
const custom=sanitizeDiscoveryConfig({squeeze:20});
await store.saveFeatures(kr.id,krMembers[0],custom.version,result.candidates,'QA SYNTHETIC — NOT MARKET DATA','yahoo-kr-raw-ohlcv');
const historical=eventStudy([{market:'KR',symbol:'005930',bars,candidates:result.candidates,priceBasis:'yahoo-kr-raw-ohlcv'}],[kr],{start:'2025-01-01',end:'2026-10-05',developmentEnd:'2025-09-01',validationEnd:'2026-03-01',minimumSamples:30,allowCurrentResearch:true,commissionBps:5,slippageBps:10,configVersion:DISCOVERY_DEFAULTS.version});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const results=[];
try {
  for(const theme of ['light','dark'])for(const viewport of [{id:'desktop',width:1440,height:900},{id:'tablet',width:768,height:1024},{id:'mobile',width:390,height:844}]) {
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}}),page=await context.newPage(),calls=[],errors=[];
    let cloudPhase='complete';
    const cloudConfig=readBollingerCloudConfig({BOLLINGER_CLOUD_ENABLED:'true',BOLLINGER_CLOUD_TOP:'ALL',CRON_SECRET:'QA_SYNTHETIC_NOT_A_REAL_CRON_SECRET_12345'});
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(theme=>localStorage.setItem('korea-equity-cc',JSON.stringify({state:{theme,watchlist:['005930'],usWatchlist:['NVDA']},version:4})),theme);
    await page.route('**/_serverFn/**',async route=>{
      const encoded=new URL(route.request().url()).pathname.split('/_serverFn/')[1];
      let name=names[encoded];
      if(!name){try{name=JSON.parse(Buffer.from(decodeURIComponent(encoded),'base64url').toString()).export?.replace(/_createServerFn_handler$/,'');}catch{/* Unknown transport fails below. */}}
      assert(name,`Unmapped server function ${route.request().url().split('/_serverFn/')[1]}`);
      const raw=route.request().method()==='POST'?route.request().postData():new URL(route.request().url()).searchParams.get('payload');
      const payload=raw?fromJSON(JSON.parse(raw)):{};const data=payload.data??payload;calls.push({name,data});let value=null;
      if(name==='getDiscoveryCatalog')value={status:'READY',cloud:{...cloudConfig,enabled:cloudPhase!=='disabled',jobs:[safeCloudJob({phase:cloudPhase==='disabled'?'not-started':cloudPhase,top:'ALL',requested:61,supported:61,membershipRows:61,membershipTotal:61,successfulKeys:krMembers.map(m=>`KR:${m.symbol}`),computedKeys:cloudPhase==='complete'?krMembers.map(m=>`KR:${m.symbol}`):[],budgetStopped:cloudPhase==='collect',lastRunAt:'2026-10-06T09:30:00Z'},'KOSPI')]},version:DISCOVERY_DEFAULTS.version,versions:[DISCOVERY_DEFAULTS.version,custom.version],universes:[kr,us,etf].map(u=>({id:u.id,kind:u.kind,label:u.label,asOf:u.asOf,knownAt:u.knownAt,fetchedAt:u.fetchedAt,source:u.source,historical:false,members:u.members.length,sectors:['Technology','Unknown']}))};
      else if(name==='getDiscoveryCandidates')value={status:'READY',...await store.query(data)};
      else if(name==='getDiscoveryUniversePreview'){
        const u=await store.universe(data.universeId),p=selectUniverse(u,data.selection);value={status:'READY',asOf:u.asOf,source:u.source,rankingBasis:p.rankingBasis,total:p.selected.length,supportedCount:p.supportedCount,excludedCount:p.excludedCount,selectedWeight:p.selectedWeight,knownWeight:p.knownWeight,warnings:p.warnings,rows:p.selected.slice(0,50),excluded:p.excluded};
      }else if(name==='getDiscoveryEvidence')value={status:'READY',events:[],jobs:[],evidence:historical};
      else if(name==='getLiveWire')value={items:[],fetchedAt:new Date().toISOString(),status:'disabled'};
      await route.fulfill({status:200,contentType:'application/json',headers:{'x-tss-serialized':'true'},body:JSON.stringify(await toCrossJSONAsync({result:value,error:undefined,context:{}},{refs:new Map()}))});
    });
    const run={theme,viewport:viewport.id,mode:'isolated-synthetic-DB-and-browser',success:false};
    try {
      await page.goto(`${base}/bollinger`,{waitUntil:'domcontentloaded'});
      const root=page.getByTestId('bollinger-screener');await root.waitFor();await page.getByRole('button',{name:'근거',exact:true}).or(page.getByRole('button',{name:'선정 근거',exact:true})).first().waitFor();
      const cloud=page.getByRole('region',{name:'클라우드 수집 상태'});await cloud.waitFor();assert.match(await cloud.innerText(),/선택 범위 계산 완료/);
      cloudPhase='collect';await page.getByRole('button',{name:'저장 자료 새로고침',exact:true}).click();await page.getByText('시간 예산으로 일시 중단했습니다.',{exact:false}).waitFor();assert.match(await cloud.innerText(),/가격 수집·계산 중/);
      cloudPhase='disabled';await page.getByRole('button',{name:'저장 자료 새로고침',exact:true}).click();await page.getByText('Vercel 환경변수 BOLLINGER_CLOUD_ENABLED=true',{exact:false}).waitFor();
      cloudPhase='complete';await page.getByRole('button',{name:'저장 자료 새로고침',exact:true}).click();await page.getByText('선택 범위 계산 완료',{exact:false}).waitFor();
      assert.equal((await cloud.innerText()).includes('QA_SYNTHETIC_NOT_A_REAL_CRON_SECRET'),false,'operator secret exposed');
      assert.equal(await page.getByRole('button',{name:'Long Pre-Breakout',exact:true}).getAttribute('aria-pressed'),'true');
      assert.equal(await root.getByRole('row').count()>1||await root.locator('article').count()>0,true);
      await page.getByRole('button',{name:'근거',exact:true}).or(page.getByRole('button',{name:'선정 근거',exact:true})).first().click();
      await page.getByRole('dialog').waitFor();assert.match(await page.getByRole('dialog').innerText(),/RSI|Wilder/);await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
      await page.getByRole('button',{name:'다음',exact:true}).click();await page.waitForTimeout(150);assert.ok(calls.some(c=>c.name==='getDiscoveryCandidates'&&c.data.page===2));
      for(const strategy of ['Triggered','Follow-Through','Failed Breakout','Pullback','Mean Reversion','Bear / Breakdown','Squeeze Watch','Long Pre-Breakout']){await page.getByRole('button',{name:strategy,exact:true}).click();await page.waitForTimeout(100);assert.equal(await page.getByRole('button',{name:strategy,exact:true}).getAttribute('aria-pressed'),'true');}
      const selector=page.getByLabel('시장 / 편입 기준');await selector.selectOption('NASDAQ100');await page.waitForTimeout(250);assert.equal(await page.getByLabel('구성 범위').locator('option[value="200"]').count(),0);
      await selector.selectOption('ETF');await page.getByLabel('ETF 검색').fill('069500');await page.waitForTimeout(250);assert.match(await root.innerText(),/재정규화 없음/);
      await selector.selectOption('KOSPI');await page.waitForTimeout(250);
      await page.getByLabel('저장된 계산 버전').selectOption(custom.version);await page.waitForTimeout(250);
      assert.ok(calls.some(c=>c.name==='getDiscoveryCandidates'&&c.data.configVersion===custom.version),'configuration version did not change query');
      await page.getByLabel('저장된 계산 버전').selectOption(DISCOVERY_DEFAULTS.version);await page.waitForTimeout(250);
      await page.getByRole('button',{name:'고급 기준',exact:true}).click();
      await page.getByLabel('BBW 최대 분위수').fill('15');await page.getByLabel('시장 상승 추세 필수').check();
      const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'설정 JSON 다운로드',exact:true}).click();
      const download=await downloaded,stream=await download.createReadStream();let body='';for await(const chunk of stream)body+=chunk.toString();
      const exported=JSON.parse(body);assert.equal(exported.squeeze,15);assert.equal(exported.requireMarket,1);assert.match(exported.version,/squeeze=15/);
      await page.getByRole('button',{name:'권장 계산 기본값',exact:true}).click();assert.equal(await page.getByLabel('BBW 최대 분위수').inputValue(),'10');
      await page.getByRole('button',{name:'고급 기준',exact:true}).click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'horizontal page overflow');
      assert.equal(calls.some(c=>['getChartData','getBollingerScreener','getChartFlow'].includes(c.name)),false,'implicit provider fetch');
      assert.deepEqual(errors,[]);
      run.calls=calls.map(c=>({name:c.name,page:c.data.page??null,strategy:c.data.strategy??null}));run.success=true;
      run.screenshot=`${out}/screener-${theme}-${viewport.id}.png`;await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:run.screenshot});
      await page.getByRole('button',{name:'근거',exact:true}).or(page.getByRole('button',{name:'선정 근거',exact:true})).first().scrollIntoViewIfNeeded();
      await page.screenshot({path:`${out}/candidates-${theme}-${viewport.id}.png`});
    }catch(error){run.error=error.message;run.pageErrors=errors;await page.screenshot({path:`${out}/FAILED-${theme}-${viewport.id}.png`,fullPage:true});}
    results.push(run);console.log(JSON.stringify({theme,viewport:viewport.id,success:run.success,error:run.error}));await context.close();
  }
}finally{await browser.close();await pg.close();}
await writeFile(`${out}/verification.json`,JSON.stringify({scope:'Synthetic tests only; not real trading/backtest performance',productionEntry:entry,base,results},null,2));
if(results.some(r=>!r.success))process.exitCode=1;
