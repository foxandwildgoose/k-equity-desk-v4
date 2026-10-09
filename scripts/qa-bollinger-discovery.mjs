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
// Keep the synthetic series at the freshness boundary on every test date.
// Numeric inputs remain deterministic; no market holiday or provider is inferred.
const testDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const lastTime=Date.parse(`${testDay}T00:00:00Z`)-4*86400000,storedDay=new Date(lastTime).toISOString().slice(0,10);
const bars=discoveryBars(303).map((b,i)=>({...b,date:new Date(lastTime-(302-i)*86400000).toISOString().slice(0,10)}));
const result=analyzeDiscovery(bars,undefined,discoveryContexts(bars));assert.equal(result.candidates.at(-1).state,'ARMED');
const krMembers=Array.from({length:101},(_,i)=>({...member(String(500000+i)),name:`QA SYNTHETIC 종목 ${i+1}`,marketCap:(100-i)*1e12}));
krMembers[0]={...member(),name:'QA SYNTHETIC 삼성전자'};
const kr={...universe(krMembers),asOf:storedDay,label:'QA SYNTHETIC KOSPI — NOT MARKET DATA'};
const usMembers=[{...member('NVDA'),market:'US',exchange:'NASDAQ',name:'QA SYNTHETIC NVIDIA'},{...member('AAPL'),market:'US',exchange:'NASDAQ',name:'QA SYNTHETIC Apple'}];
const us={...kr,id:'QA-SYNTHETIC-NASDAQ100',kind:'NASDAQ100',label:'QA SYNTHETIC Nasdaq100',members:usMembers,authoritative:true};
const etf={...kr,id:'QA-SYNTHETIC-ETF',kind:'ETF',label:'QA SYNTHETIC ETF (069500)',members:[{...krMembers[0],weight:30},{...krMembers[1],weight:20},{...member('444444'),assetType:'cash',weight:50}]};
const kosdaqMembers=Array.from({length:101},(_,i)=>({...member(String(600000+i)),exchange:'KOSDAQ',name:`QA SYNTHETIC KOSDAQ 종목 ${i+1}`,marketCap:(101-i)*1e12}));
const kosdaq={...kr,id:'QA-SYNTHETIC-KOSDAQ',kind:'KOSDAQ',label:'QA SYNTHETIC KOSDAQ — NOT MARKET DATA',members:kosdaqMembers};
for(const u of [kr,us,etf]){await store.saveUniverse(u);for(const m of u.members.filter(m=>m.assetType==='equity'))await store.saveFeatures(u.id,m,DISCOVERY_DEFAULTS.version,result.candidates,'QA SYNTHETIC — NOT MARKET DATA',m.market==='US'?'yahoo-us-adjusted-ohlcv':'yahoo-kr-raw-ohlcv');}
const custom=sanitizeDiscoveryConfig({squeeze:20});
await store.saveFeatures(kr.id,krMembers[0],custom.version,result.candidates,'QA SYNTHETIC — NOT MARKET DATA','yahoo-kr-raw-ohlcv');
const historical=eventStudy([{market:'KR',symbol:'005930',bars,candidates:result.candidates,priceBasis:'yahoo-kr-raw-ohlcv'}],[kr],{start:'2025-01-01',end:storedDay,developmentEnd:'2025-09-01',validationEnd:'2026-03-01',minimumSamples:30,allowCurrentResearch:true,commissionBps:5,slippageBps:10,configVersion:DISCOVERY_DEFAULTS.version});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const results=[];
try {
  for(const theme of ['light','dark'])for(const viewport of [{id:'desktop',width:1440,height:900},{id:'tablet',width:768,height:1024},{id:'mobile',width:390,height:844}]) {
    // Reset only this isolated fixture's KOSDAQ rows between browser contexts.
    for(const table of ['bollinger_features','bollinger_members'])await pg.query(`DELETE FROM ${table} WHERE universe_id=$1`,[kosdaq.id]);
    await pg.query('DELETE FROM bollinger_universes WHERE id=$1',[kosdaq.id]);
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}}),page=await context.newPage(),calls=[],errors=[];
    let cloudPhase='complete',operatorAuthorized=false,manualPhase='not-started',bootstrapPhase='not-started',kosdaqSaved=false,hideIndexSnapshot=false,hideEtfSnapshot=false;
    const catalogue=()=>[kr,...(kosdaqSaved?[kosdaq]:[]),...(hideIndexSnapshot?[]:[us]),...(hideEtfSnapshot?[]:[etf])].map(u=>({id:u.id,kind:u.kind,label:u.label,asOf:u.asOf,knownAt:u.knownAt,fetchedAt:u.fetchedAt,source:u.source,historical:false,members:u.members.length,sectors:['Technology','Unknown']}));
    const selectedJob=data=>{
      if(manualPhase==='not-started')return null;
      const selected=[kr,kosdaq,us,etf].find(u=>u.id===data.universeId),keys=selectUniverse(selected,data.selection).selected.map(m=>`${m.market}:${m.symbol}`);
      return safeCloudJob({schema:2,universeId:data.universeId,configVersion:data.configVersion,phase:manualPhase,execution:manualPhase==='complete'?'COMPLETE':'PAUSED',top:data.selection.top,requested:keys.length,successfulKeys:manualPhase==='complete'?keys:keys.slice(0,20),computedKeys:manualPhase==='complete'?keys:[],budgetStopped:manualPhase==='collect'},selected.kind);
    };
    const bootstrapJob=data=>{
      if(bootstrapPhase==='not-started')return null;
      const completed=bootstrapPhase==='complete',membershipReady=bootstrapPhase!=='membership',keys=selectUniverse(kosdaq,data.selection).selected.map(m=>`${m.market}:${m.symbol}`),finalized=completed?keys:membershipReady?keys.slice(0,5):[];
      return safeCloudJob({schema:2,universeId:membershipReady?kosdaq.id:null,configVersion:data.configVersion,phase:bootstrapPhase,execution:completed?'COMPLETE':'PAUSED',top:data.selection.top,requested:membershipReady?keys.length:0,membershipRows:membershipReady?101:40,membershipTotal:101,successfulKeys:membershipReady?keys:[],provisionalKeys:membershipReady?keys:[],computedKeys:finalized,pendingCompute:membershipReady&&!completed?keys.slice(5):[],budgetStopped:!completed},'KOSDAQ');
    };
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
      if(name==='getDiscoveryCatalog')value={status:'READY',cloud:{...cloudConfig,enabled:cloudPhase!=='disabled',jobs:[safeCloudJob({schema:2,execution:cloudPhase==='collect'?'PAUSED':'COMPLETE',phase:cloudPhase==='disabled'?'not-started':cloudPhase,top:'ALL',requested:101,supported:101,membershipRows:101,membershipTotal:101,successfulKeys:krMembers.map(m=>`KR:${m.symbol}`),computedKeys:cloudPhase==='complete'?krMembers.map(m=>`KR:${m.symbol}`):[],budgetStopped:cloudPhase==='collect',lastRunAt:'2026-10-06T09:30:00Z'},'KOSPI')]},version:DISCOVERY_DEFAULTS.version,versions:[DISCOVERY_DEFAULTS.version,custom.version],universes:catalogue()};
      else if(name==='getDiscoveryRunProgress'){const job=data.bootstrapTarget?bootstrapJob(data):selectedJob(data);value={status:'READY',jobs:job?[job]:[]};}
      else if(name==='getDiscoveryCandidates')value={status:'READY',...await store.query(data)};
      else if(name==='getDiscoveryUniversePreview'){
        const u=await store.universe(data.universeId),p=selectUniverse(u,data.selection);value={status:'READY',asOf:u.asOf,source:u.source,rankingBasis:p.rankingBasis,total:p.selected.length,supportedCount:p.supportedCount,excludedCount:p.excludedCount,selectedWeight:p.selectedWeight,knownWeight:p.knownWeight,warnings:p.warnings,rows:p.selected.slice(0,50),excluded:p.excluded};
      }else if(name==='getDiscoveryEvidence')value={status:'READY',events:[],jobs:[],evidence:historical};
      else if(name==='getLiveWire')value={items:[],fetchedAt:new Date().toISOString(),status:'disabled'};
      await route.fulfill({status:200,contentType:'application/json',headers:{'x-tss-serialized':'true'},body:JSON.stringify(await toCrossJSONAsync({result:value,error:undefined,context:{}},{refs:new Map()}))});
    });
    await page.route('**/api/bollinger/operator',async route=>{
      const method=route.request().method();
      if(method==='POST'){const input=JSON.parse(route.request().postData()??'{}');operatorAuthorized=input.secret==='QA_OPERATOR_PASSWORD_ONLY_1234567890';if(!operatorAuthorized){await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({authorized:false,status:'OPERATOR_AUTH_REQUIRED'})});return;}}
      if(method==='DELETE')operatorAuthorized=false;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({authorized:operatorAuthorized,status:operatorAuthorized?'OPERATOR_AUTHORIZED':'OPERATOR_AUTH_REQUIRED'})});
    });
    await page.route('**/api/bollinger/collect',async route=>{
      assert.equal(operatorAuthorized,true,'anonymous collector command');
      const data=JSON.parse(route.request().postData()??'{}');calls.push({name:'collectSelected',data});
      assert.equal('budgetSeconds' in data,false);
      if(data.bootstrapTarget){
        assert.equal(data.bootstrapTarget,'KOSDAQ');assert.equal('universeId' in data,false);
        assert.equal(data.configVersion,custom.version);assert.equal(data.selection.top,20);
        bootstrapPhase=bootstrapPhase==='membership'?'refresh':bootstrapPhase==='refresh'?'complete':'membership';
        if(bootstrapPhase!=='membership'){
          await store.saveUniverse(kosdaq);kosdaqSaved=true;
          const selectedMembers=selectUniverse(kosdaq,data.selection).selected;
          for(const m of bootstrapPhase==='complete'?selectedMembers:selectedMembers.slice(0,5))await store.saveFeatures(kosdaq.id,m,data.configVersion,result.candidates,'QA SYNTHETIC — NOT MARKET DATA','yahoo-kr-raw-ohlcv');
        }
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:bootstrapPhase==='complete'?'COMPLETE':'PARTIAL_BUDGET',jobs:[bootstrapJob(data)]})});return;
      }
      assert.equal(data.universeId,kr.id);
      manualPhase=manualPhase==='collect'?'complete':'collect';
      if(manualPhase==='complete')for(const m of selectUniverse(kr,data.selection).selected)await store.saveFeatures(kr.id,m,data.configVersion,result.candidates,'QA SYNTHETIC — NOT MARKET DATA','yahoo-kr-raw-ohlcv');
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:manualPhase==='complete'?'COMPLETE':'PARTIAL_BUDGET',jobs:[selectedJob(data)]})});
    });
    const execute=()=>page.getByRole('button',{name:'실행',exact:true}).click();
    const run={theme,viewport:viewport.id,mode:'isolated-synthetic-DB-and-browser',success:false};
    try {
      await page.goto(`${base}/bollinger`,{waitUntil:'domcontentloaded'});
      const root=page.getByTestId('bollinger-screener');await root.waitFor();await page.getByRole('button',{name:'실행',exact:true}).waitFor();await page.getByLabel('편입 스냅샷').locator('option').nth(1).waitFor({state:'attached'});await page.waitForTimeout(300);assert.equal(calls.some(c=>c.name==='getDiscoveryCandidates'),false,'search ran before Execute');await execute();await page.getByRole('button',{name:'근거',exact:true}).or(page.getByRole('button',{name:'선정 근거',exact:true})).first().waitFor();
      // Unrelated scheduled KOSPI history must not appear as the user's current execution.
      assert.equal(await root.getByText('KOSPI · 실행 완료',{exact:true}).count(),0,'unrelated completed cron history shown');
      assert.equal(await root.getByTestId('bollinger-run-progress').count(),0,'old cron progress rendered before a manual collection');
      cloudPhase='collect';await page.getByRole('button',{name:'저장 자료 새로고침',exact:true}).click();await page.waitForTimeout(150);
      assert.equal(await root.getByText('KOSPI · 일시 중단',{exact:true}).count(),0,'unrelated cron history shown');
      cloudPhase='disabled';await page.getByRole('button',{name:'저장 자료 새로고침',exact:true}).click();await page.waitForTimeout(150);assert.match(await root.innerText(),/클라우드 수집 비활성|BOLLINGER_CLOUD_ENABLED/);
      cloudPhase='complete';await page.getByRole('button',{name:'저장 자료 새로고침',exact:true}).click();await page.waitForTimeout(150);
      assert.equal((await root.innerText()).includes('QA_SYNTHETIC_NOT_A_REAL_CRON_SECRET'),false,'operator secret exposed');
      assert.equal(await page.getByRole('button',{name:'Long Pre-Breakout',exact:true}).getAttribute('aria-pressed'),'true');
      assert.equal(await root.getByRole('row').count()>1||await root.locator('article').count()>0,true);
      await page.getByRole('button',{name:'근거',exact:true}).or(page.getByRole('button',{name:'선정 근거',exact:true})).first().click();
      await page.getByRole('dialog').waitFor();assert.match(await page.getByRole('dialog').innerText(),/RSI|Wilder/);await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
      await page.getByRole('button',{name:'다음',exact:true}).click();await page.waitForTimeout(150);assert.ok(calls.some(c=>c.name==='getDiscoveryCandidates'&&c.data.page===2));
      for(const strategy of ['Triggered','Follow-Through','Failed Breakout','Pullback','Mean Reversion','Bear / Breakdown','Squeeze Watch','Long Pre-Breakout']){await page.getByRole('button',{name:strategy,exact:true}).click();await execute();await page.waitForTimeout(100);assert.equal(await page.getByRole('button',{name:strategy,exact:true}).getAttribute('aria-pressed'),'true');}
      const selector=page.getByLabel('시장 / 편입 기준'),beforeDraft=calls.filter(c=>c.name==='getDiscoveryCandidates').length;await selector.selectOption('NASDAQ100');await page.waitForTimeout(250);assert.equal(await page.getByLabel('구성 범위').locator('option[value="200"]').count(),0);
      await selector.selectOption('ETF');await page.getByLabel('ETF 검색').fill('069500');await page.waitForTimeout(250);assert.match(await root.innerText(),/재정규화 없음/);
      await selector.selectOption('KOSPI');await page.waitForTimeout(250);assert.equal(calls.filter(c=>c.name==='getDiscoveryCandidates').length,beforeDraft,'draft edits dispatched candidate queries');await execute();
      await page.getByLabel('저장된 계산 버전').selectOption(custom.version);await execute();await page.waitForTimeout(250);
      assert.ok(calls.some(c=>c.name==='getDiscoveryCandidates'&&c.data.configVersion===custom.version),'configuration version did not change query');
      await page.getByLabel('저장된 계산 버전').selectOption(DISCOVERY_DEFAULTS.version);await execute();await page.waitForTimeout(250);
      await page.getByRole('button',{name:'고급 기준',exact:true}).click();
      await page.getByLabel('BBW 최대 분위수').fill('15');await page.getByLabel('시장 상승 추세 필수').check();
      const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'설정 JSON 다운로드',exact:true}).click();
      const download=await downloaded,stream=await download.createReadStream();let body='';for await(const chunk of stream)body+=chunk.toString();
      const exported=JSON.parse(body);assert.equal(exported.squeeze,15);assert.equal(exported.requireMarket,1);assert.match(exported.version,/squeeze=15/);
      await page.getByRole('button',{name:'권장 계산 기본값',exact:true}).click();assert.equal(await page.getByLabel('BBW 최대 분위수').inputValue(),'10');
      await page.getByRole('button',{name:'고급 기준',exact:true}).click();
      // Reproduce selected100 / stored20 without mutating any operational DB.
      await pg.query("DELETE FROM bollinger_features WHERE universe_id=$1 AND NOT(symbol=ANY($2::text[]))",[kr.id,krMembers.slice(0,20).map(m=>m.symbol)]);
      await page.getByLabel('구성 범위').selectOption('100');await execute();
      await page.getByText('미확보 80개',{exact:false}).first().waitFor();
      run.partialScreenshot=`${out}/partial-${theme}-${viewport.id}.png`;await page.getByTestId('bollinger-execute').scrollIntoViewIfNeeded();await page.screenshot({path:run.partialScreenshot});
      await page.getByTestId('bollinger-collect').click();await page.getByRole('dialog').waitFor();
      await page.getByLabel('수집 실행 비밀값').fill('QA_OPERATOR_PASSWORD_ONLY_1234567890');await page.getByRole('button',{name:'권한 확인',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
      assert.equal(await page.getByLabel('수집 실행 비밀값').count(),0);
      assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>/operator|secret|password/i.test(k))),false,'operator secret persisted');
      await page.getByTestId('bollinger-collect').click();await page.getByText('시간 예산이 끝났습니다.',{exact:false}).first().waitFor();
      assert.ok(calls.some(c=>c.name==='collectSelected'&&c.data.selection.top===100));
      await page.getByTestId('bollinger-collect').click();await page.getByText('선택 범위 수집·계산이 완료되었습니다.',{exact:false}).first().waitFor();
      await page.getByText('미확보 0개',{exact:false}).first().waitFor();
      // The latest stored date is an explicit historical query, never secretly a new current baseline.
      await page.getByRole('button',{name:'저장 최신일로 조회',exact:true}).click();await page.getByText('과거 기준 조회',{exact:false}).first().waitFor();
      assert.ok(calls.some(c=>c.name==='getDiscoveryCandidates'&&c.data.asOf===storedDay));
      await page.getByRole('button',{name:'실행 권한 해제',exact:true}).click();
      for(const m of kr.members)await store.saveFeatures(kr.id,m,DISCOVERY_DEFAULTS.version,result.candidates,'QA SYNTHETIC — NOT MARKET DATA','yahoo-kr-raw-ohlcv');
      // No KOSDAQ snapshot exists in this browser's catalog. Bootstrap must be possible
      // without pressing a Vercel-only cron command or inventing a universe identifier.
      const beforeBootstrapDraft=calls.filter(c=>['getDiscoveryCandidates','collectSelected'].includes(c.name)).length;
      await selector.selectOption('KOSDAQ');await page.getByLabel('구성 범위').selectOption('20');await page.getByLabel('저장된 계산 버전').selectOption(custom.version);await page.getByLabel('조회 기준일').fill(testDay);await page.waitForTimeout(250);
      assert.equal(await store.universe(kosdaq.id),null,'missing-market test had preexisting persisted universe');
      assert.equal(await page.getByLabel('편입 스냅샷').locator('option').count(),1,'KOSDAQ fixture was not empty');
      assert.equal(calls.filter(c=>['getDiscoveryCandidates','collectSelected'].includes(c.name)).length,beforeBootstrapDraft,'missing-market draft edits performed work');
      assert.equal(await page.getByTestId('bollinger-execute').isEnabled(),true,'Execute deadlocked without snapshot');
      run.missingUniverseScreenshot=`${out}/missing-kosdaq-${theme}-${viewport.id}.png`;await page.getByTestId('bollinger-execute').scrollIntoViewIfNeeded();await page.screenshot({path:run.missingUniverseScreenshot});
      const beforePermission=calls.filter(c=>c.name==='collectSelected').length;
      await execute();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'권한 확인 후 실행',exact:true}).waitFor();await page.getByLabel('수집 실행 비밀값').fill('QA_NOT_SUBMITTED_CANCELLED');await page.getByRole('button',{name:'취소',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
      assert.equal(calls.filter(c=>c.name==='collectSelected').length,beforePermission,'cancelled bootstrap called collector');
      assert.equal(await page.getByLabel('수집 실행 비밀값').count(),0,'cancelled password field retained');
      await execute();await page.getByRole('dialog').waitFor();await page.getByLabel('수집 실행 비밀값').fill('QA_WRONG_OPERATOR_PASSWORD');await page.getByRole('button',{name:'권한 확인 후 실행',exact:true}).click();await page.getByRole('dialog').getByRole('alert').waitFor();
      assert.equal(calls.filter(c=>c.name==='collectSelected').length,beforePermission,'failed owner authorization called collector');assert.equal(await page.getByLabel('수집 실행 비밀값').inputValue(),'');await page.getByRole('button',{name:'취소',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
      await execute();await page.getByRole('dialog').waitFor();await page.getByLabel('수집 실행 비밀값').fill('QA_OPERATOR_PASSWORD_ONLY_1234567890');await page.getByRole('button',{name:'권한 확인 후 실행',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByText('시간 예산이 끝났습니다.',{exact:false}).first().waitFor();
      const firstBootstrap=calls.find(c=>c.name==='collectSelected'&&c.data.bootstrapTarget==='KOSDAQ');assert.ok(firstBootstrap,'permission confirmation did not dispatch bootstrap');assert.equal(await page.getByLabel('편입 스냅샷').locator('option').count(),1,'partial membership became complete snapshot');
      assert.equal(await store.universe(kosdaq.id),null,'partial membership was persisted as a completed universe');
      run.pausedBootstrapScreenshot=`${out}/paused-kosdaq-${theme}-${viewport.id}.png`;await page.getByTestId('bollinger-collect').scrollIntoViewIfNeeded();await page.screenshot({path:run.pausedBootstrapScreenshot});
      // Draft changes do not auto-resume or query. Resume freezes the original exact intent.
      const bootstrapBeforeEdit=calls.filter(c=>['getDiscoveryCandidates','collectSelected'].includes(c.name)).length;
      await page.getByLabel('구성 범위').selectOption('50');await page.waitForTimeout(150);assert.equal(calls.filter(c=>['getDiscoveryCandidates','collectSelected'].includes(c.name)).length,bootstrapBeforeEdit);await page.getByLabel('구성 범위').selectOption('20');
      await page.getByTestId('bollinger-collect').click();
      await page.getByLabel('편입 스냅샷').locator(`option[value="${kosdaq.id}"]`).waitFor({state:'attached'});
      await page.waitForFunction(id=>document.querySelector('[aria-label="편입 스냅샷"]')?.value===id,kosdaq.id);
      await page.waitForTimeout(250);
      const persistedQuery={universeId:kosdaq.id,configVersion:custom.version,strategy:'long-pre-breakout',selection:firstBootstrap.data.selection,minScore:0,minCoverage:.8,sort:'score',asOf:storedDay,page:1,pageSize:50};
      assert.equal((await store.query(persistedQuery)).availability.stored,5,'paused collection did not expose only its genuinely stored fixture rows');
      run.persistedPausedScreenshot=`${out}/persisted-paused-kosdaq-${theme}-${viewport.id}.png`;await page.getByTestId('bollinger-collect').scrollIntoViewIfNeeded();await page.screenshot({path:run.persistedPausedScreenshot});
      const beforeReload=calls.filter(c=>c.name==='collectSelected').length;
      await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('bollinger-screener').waitFor();await page.getByLabel('편입 스냅샷').locator(`option[value="${kosdaq.id}"]`).waitFor({state:'attached'});await page.getByLabel('시장 / 편입 기준').locator('option:checked').filter({hasText:'KOSDAQ'}).waitFor({state:'attached'});
      assert.equal(calls.filter(c=>c.name==='collectSelected').length,beforeReload,'reload automatically resumed provider collection');
      assert.equal(await page.getByLabel('시장 / 편입 기준').inputValue(),'KOSDAQ','reload lost selected market');assert.equal(await page.getByLabel('구성 범위').inputValue(),'20','reload lost frozen Top20');assert.equal(await page.getByLabel('저장된 계산 버전').inputValue(),custom.version,'reload lost frozen custom calculation');
      const publicIntent=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ked:bollinger:bootstrap-intent:v1')));
      assert.equal(publicIntent.search.bootstrapTarget,'KOSDAQ');assert.equal(publicIntent.search.universeId,kosdaq.id);
      assert.equal(Object.keys(publicIntent.search).some(key=>/secret|token|authorized|cookie/i.test(key)),false,'public resume intent stored authorization fields');
      assert.match(await page.getByTestId('bollinger-collect').innerText(),/수집 이어받기/,'reload lost paused bootstrap scope');
      await page.getByTestId('bollinger-collect').click();await page.getByText('선택 범위 수집·계산이 완료되었습니다.',{exact:false}).first().waitFor();await page.waitForTimeout(250);
      const bootstrapRequests=calls.filter(c=>c.name==='collectSelected'&&c.data.bootstrapTarget==='KOSDAQ');assert.equal(bootstrapRequests.length,3);for(const resumed of bootstrapRequests.slice(1))assert.deepEqual(resumed.data,firstBootstrap.data,'resume changed bootstrap selection/version');
      const completedQuery=await store.query(persistedQuery);assert.equal(completedQuery.availability.stored,20);assert.equal(completedQuery.availability.missingStored,0);
      run.bootstrapEvidence={initialUniverseMissing:true,membershipPartialNotPublished:true,storedBeforeReload:5,storedAfterCompletion:completedQuery.availability.stored,resumeAfterReload:true,identicalRequests:bootstrapRequests.length,configurationVersion:custom.version,top:20};
      assert.ok(calls.some(c=>c.name==='getDiscoveryCandidates'&&c.data.universeId===kosdaq.id&&c.data.configVersion===custom.version&&c.data.selection.top===20),'persisted bootstrap universe did not reach candidate query');
      assert.ok(calls.some(c=>c.name==='getDiscoveryRunProgress'&&c.data.bootstrapTarget==='KOSDAQ'),'bootstrap progress scope was not queried');
      assert.equal(await root.getByText(/1차 계산 .*상대 강도 최종 계산 전/).count(),0,'completed job falsely marked provisional');
      assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>/operator|secret|password/i.test(k))),false,'bootstrap password persisted');
      assert.equal(await page.evaluate(()=>[...Object.values(localStorage),...Object.values(sessionStorage)].some(value=>/QA_OPERATOR_PASSWORD_ONLY_|QA_WRONG_OPERATOR_PASSWORD|QA_NOT_SUBMITTED_CANCELLED/.test(value))),false,'operator fixture secret leaked into browser storage');
      run.completedBootstrapScreenshot=`${out}/completed-kosdaq-${theme}-${viewport.id}.png`;await page.getByTestId('bollinger-execute').scrollIntoViewIfNeeded();await page.screenshot({path:run.completedBootstrapScreenshot});
      // Unsupported bootstrap targets and incomplete ETF identifiers have an explicit reason.
      hideIndexSnapshot=true;hideEtfSnapshot=true;await page.getByRole('button',{name:'저장 자료 새로고침',exact:true}).click();await selector.selectOption('NASDAQ100');await page.waitForTimeout(250);assert.equal(await page.getByTestId('bollinger-execute').isDisabled(),true);assert.match(await root.innerText(),/NASDAQ100|Nasdaq.?100/);assert.match(await root.innerText(),/지원|편입|스냅샷/);
      await selector.selectOption('SP500');await page.waitForTimeout(150);assert.equal(await page.getByTestId('bollinger-execute').isDisabled(),true);assert.match(await root.innerText(),/SP500/);
      await selector.selectOption('ETF');await page.getByLabel('ETF 수집 코드').fill('123');await page.waitForTimeout(250);assert.equal(await page.getByTestId('bollinger-execute').isDisabled(),true);assert.match(await root.innerText(),/6자리|6글자|6자/);
      const beforeUnsupported=calls.filter(c=>c.name==='collectSelected').length;await page.getByLabel('ETF 수집 코드').fill('INVALID');await page.waitForTimeout(150);assert.equal(calls.filter(c=>c.name==='collectSelected').length,beforeUnsupported,'invalid ETF draft fetched a provider');
      await page.getByLabel('ETF 수집 코드').fill('0233A0');await page.waitForTimeout(150);assert.equal(await page.getByTestId('bollinger-execute').isEnabled(),true,'eligible alphanumeric domestic ETF code rejected');assert.equal(calls.filter(c=>c.name==='collectSelected').length,beforeUnsupported,'valid ETF draft fetched without Execute');
      await selector.selectOption('KOSDAQ');await page.getByLabel('구성 범위').selectOption('20');await page.waitForTimeout(150);await execute();await page.waitForTimeout(250);
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
await writeFile(`${out}/verification.json`,JSON.stringify({scope:'Synthetic tests only; not real trading/backtest performance',productionEntry:entry,base,testDay,storedDay,results},null,2));
if(results.some(r=>!r.success))process.exitCode=1;
