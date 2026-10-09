#!/usr/bin/env node
/** Production-browser action regressions. All provider responses and prices are
 * explicitly synthetic, stored only in an isolated PGlite fixture. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {chromium} from 'playwright';
import {fromJSON,toCrossJSONAsync} from 'seroval';
import {createDiscoveryStore} from '../src/server/bollinger-discovery-store.ts';
import {readDiscoveryStockChart} from '../src/server/bollinger-discovery.ts';
import {analyzeDiscovery,DISCOVERY_DEFAULTS} from '../src/lib/bollinger/discovery.ts';
import {selectUniverse} from '../src/lib/bollinger/discovery-universe.ts';
import {discoveryBars,discoveryContexts,member,universe} from '../src/lib/bollinger/discovery-fixture.test-data.ts';
import {readBollingerCloudConfig,safeCloudJob} from '../src/server/bollinger-cloud-config.ts';
import {getBollingerRenderingStyle} from '../src/lib/bollinger/rendering.ts';
import {sma} from '../src/lib/chart-indicators.ts';
import {formatChartPrice} from '../src/lib/chart-format.ts';

const args=process.argv.slice(2),option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const base=option('--base','http://127.0.0.1:8191'),out=resolve(option('--out','/workspace/screenshots/bollinger-actions'));
const entry=option('--server-entry','/workspace/.onboarding/builds/k-equity-desk-v4/functions/__server.func/index.mjs');
const testCase=option('--case','all');
await mkdir(out,{recursive:true});
const compiled=await readFile(entry,'utf8');
const names=Object.fromEntries([...compiled.matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName: "([^"]+)"/g)].map(m=>[m[1],m[2].replace(/_createServerFn_handler$/,'')]));
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const stamp=Date.parse(`${day}T00:00:00Z`),storedDay=new Date(stamp-86400000).toISOString().slice(0,10);
const bars=discoveryBars(303).map((bar,index)=>({...bar,date:new Date(stamp-(303-index)*86400000).toISOString().slice(0,10)}));
const members=Array.from({length:101},(_,index)=>({...member(String(700000+index)),name:`QA ACTION SYNTHETIC 기업 ${index+1}`,marketCap:(101-index)*1e12}));
const snapshot={...universe(members),id:'QA-ACTION-KOSPI',asOf:storedDay,label:'QA ACTION SYNTHETIC — NOT MARKET DATA'};
const fixtureViews=[['squeeze-watch'],['squeeze-watch'],['squeeze-watch'],['triggered'],['follow-through'],['failed-breakout'],['pullback'],[],['bear-breakdown'],['long-pre-breakout']];
const fixtureStates=['WATCH','WATCH','WATCH','TRIGGERED','FOLLOW_THROUGH','FAILED','NEUTRAL','NEUTRAL','NEUTRAL','ARMED'];
const stockBars=index=>bars.map(bar=>({...bar,open:bar.open*(1+index/10),high:bar.high*(1+index/10),low:bar.low*(1+index/10),close:bar.close*(1+index/10)}));
const stockFeatures=index=>{
  const input=stockBars(index),calculated=analyzeDiscovery(input,undefined,discoveryContexts(input)).candidates;
  // Stage fixtures are deliberately different so identical all-stock rows cannot
  // pass a strategy-filter test. Calculation mathematics has separate unit tests.
  return calculated.map((candidate,i)=>i===calculated.length-1?{...candidate,state:fixtureStates[index%10],views:fixtureViews[index%10],reasons:[`QA synthetic stage ${index%10}`]}:candidate);
};
const source='QA ACTION SYNTHETIC — NOT MARKET DATA',basis='yahoo-kr-raw-ohlcv';
const cloud=readBollingerCloudConfig({BOLLINGER_CLOUD_ENABLED:'true',CRON_SECRET:'QA_ACTION_PASSWORD_ONLY_1234567890'});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),results=[];

async function chartEvidence(chart,theme){
  const style=getBollingerRenderingStyle(theme);
  return chart.getByTestId('chart-canvas').evaluate((root,palette)=>{
    const from=Number(root.dataset.visibleFrom),to=Number(root.dataset.visibleTo);
    const canvas=[...root.querySelectorAll('canvas')].find(c=>c.getBoundingClientRect().width>100&&c.getBoundingClientRect().height>100);
    if(!canvas)return {from,to,span:to-from,hash:null,upper:0,lower:0};
    const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const colors=palette.map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))),counts=[0,0];
    let hash=2166136261;
    for(let i=0;i<data.length;i+=4){if(data[i+3]>=200)for(let c=0;c<2;c++)if(colors[c].every((v,j)=>Math.abs(v-data[i+j])<=3))counts[c]++;}
    for(let i=0;i<data.length;i+=37)hash=Math.imul(hash^data[i],16777619);
    return {from,to,span:to-from,hash:hash>>>0,upper:counts[0],lower:counts[1]};
  },[style.upper,style.lower]);
}
try{
  for(const theme of ['light','dark'].filter(value=>!args.includes('--theme')||value===option('--theme')))
  for(const viewport of [{id:'desktop',width:1440,height:900},{id:'tablet',width:768,height:1024},{id:'mobile',width:390,height:844}].filter(value=>!args.includes('--viewport')||value.id===option('--viewport'))){
    if(args.includes('--variants')&&!option('--variants','').split(',').includes(`${theme}:${viewport.id}`))continue;
    const pg=new PGlite();await pg.exec(await readFile(new URL('../migrations/0005_bollinger_discovery.sql',import.meta.url),'utf8'));
    const store=createDiscoveryStore({query:async(text,values)=>(await pg.query(text,values)).rows});await store.saveUniverse(snapshot);
    const save=async(index,features=true)=>{await store.saveBars(members[index],stockBars(index),source,basis,`${day}T00:00:00Z`);if(features)await store.saveFeatures(snapshot.id,members[index],DISCOVERY_DEFAULTS.version,stockFeatures(index),source,basis);};
    // A partially prepared selected scope is the actual Execute acceptance fixture.
    const initiallyComplete=testCase!=='all'&&testCase!=='execute';
    for(let index=0;index<20;index++)if(initiallyComplete||index<3)await save(index);
    let authorized=false,collected=initiallyComplete?20:3,phase=collected===20?'complete':'not-started',collectMode='normal',collectGate=null,chartGate=null,delayedSymbol=null,queryGate=null,delayedStrategy=null,chartFailure=null;
    const calls=[],errors=[],context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage();
    await page.clock.setFixedTime(new Date(`${day}T03:00:00Z`));
    const run={theme,viewport:viewport.id,testCase,mode:'isolated-synthetic-DB-and-production-browser',success:false};
    const selected=data=>selectUniverse(snapshot,data.selection).selected.filter(m=>data.symbols===undefined||data.symbols.includes(`${m.market}:${m.symbol}`));
    const job=data=>safeCloudJob({schema:2,universeId:snapshot.id,configVersion:DISCOVERY_DEFAULTS.version,phase,execution:phase==='complete'?'COMPLETE':phase==='failed'?'FAILED':'PAUSED',top:data.selection.top,requested:selected(data).length,successfulKeys:selected(data).slice(0,collected).map(m=>`KR:${m.symbol}`),computedKeys:selected(data).slice(0,collected).map(m=>`KR:${m.symbol}`),pendingCompute:selected(data).slice(collected).map(m=>`KR:${m.symbol}`),budgetStopped:phase!=='complete',lastRunAt:new Date().toISOString()},'KOSPI');
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(mode=>localStorage.setItem('korea-equity-cc',JSON.stringify({state:{theme:mode,watchlist:['700000'],usWatchlist:[]},version:4})),theme);
    await page.route('**/_serverFn/**',async route=>{
      const request=route.request(),encoded=new URL(request.url()).pathname.split('/_serverFn/')[1];let name=names[encoded];
      if(!name){try{name=JSON.parse(Buffer.from(decodeURIComponent(encoded),'base64url').toString()).export?.replace(/_createServerFn_handler$/,'');}catch{/* unknown below */}}
      assert(name,'unknown server transport');const raw=request.method()==='POST'?request.postData():new URL(request.url()).searchParams.get('payload');const payload=raw?fromJSON(JSON.parse(raw)):{};const data=payload.data??payload;calls.push({name,data});let value=null,replyGate=null;
      if(name==='getDiscoveryCatalog')value={status:'READY',cloud:{...cloud,jobs:[]},version:DISCOVERY_DEFAULTS.version,versions:[DISCOVERY_DEFAULTS.version],universes:[{id:snapshot.id,kind:'KOSPI',label:snapshot.label,asOf:snapshot.asOf,knownAt:snapshot.knownAt,fetchedAt:snapshot.fetchedAt,source,members:members.length,sectors:['Technology'],historical:false}]};
      else if(name==='getDiscoveryCandidates'){if(queryGate&&data.strategy===delayedStrategy){const gate=queryGate;queryGate=null;replyGate=gate;await gate.promise;}value={status:'READY',...await store.query(data)};}
      else if(name==='getDiscoveryStockChart'){if(chartGate&&data.symbol===delayedSymbol){const gate=chartGate;chartGate=null;replyGate=gate;await gate.promise;}if(chartFailure===data.symbol)value={status:'DATABASE_QUERY_FAILED',data:null};else{const chart=await readDiscoveryStockChart(store,data);value={status:chart?'READY':'NO_HISTORY',data:chart};}}
      else if(name==='getDiscoveryRunProgress')value={status:'READY',jobs:phase==='not-started'?[]:[job(data)]};
      else if(name==='getDiscoveryUniversePreview'){const choice=selectUniverse(snapshot,data.selection);value={status:'READY',asOf:storedDay,source,rankingBasis:choice.rankingBasis,total:choice.selected.length,supportedCount:choice.supportedCount,excludedCount:choice.excludedCount,selectedWeight:choice.selectedWeight,knownWeight:choice.knownWeight,warnings:choice.warnings,rows:choice.selected.slice(0,50),excluded:choice.excluded};}
      else if(name==='getDiscoveryEvidence')value={status:'READY',events:[],jobs:[],evidence:null};
      else if(name==='getLiveWire')value={items:[],fetchedAt:new Date().toISOString(),status:'disabled'};
      await route.fulfill({status:200,contentType:'application/json',headers:{'x-tss-serialized':'true'},body:JSON.stringify(await toCrossJSONAsync({result:value,error:undefined,context:{}},{refs:new Map()}))}).catch(()=>{});replyGate?.finished?.resolve();
    });
    await page.route('**/api/bollinger/operator',async route=>{
      if(route.request().method()==='POST'){const input=JSON.parse(route.request().postData()??'{}');authorized=input.secret==='QA_ACTION_PASSWORD_ONLY_1234567890';}
      if(route.request().method()==='DELETE')authorized=false;
      await route.fulfill({status:route.request().method()==='POST'&&!authorized?401:200,contentType:'application/json',body:JSON.stringify({authorized,status:authorized?'OPERATOR_AUTHORIZED':'OPERATOR_AUTH_REQUIRED'})});
    });
    await page.route('**/api/bollinger/collect',async route=>{
      assert.equal(authorized,true,'collection before owner authorization');const data=JSON.parse(route.request().postData()??'{}');calls.push({name:'collectSelected',data});assert.equal(data.universeId,snapshot.id);assert.equal('budgetSeconds'in data,false);
      if(collectMode==='network'){phase='failed';await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({status:'NETWORK_FAILED',jobs:[job(data)]})});return;}
      if(collectMode==='stalled'){phase='refresh';await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'PARTIAL_BUDGET',jobs:[job(data)]})});return;}
      let replyGate=null;if(collectMode==='hold'&&collectGate){const gate=collectGate;collectGate=null;replyGate=gate;await gate.promise;}
      const choice=selected(data),before=collected;collected=Math.min(choice.length,collected+7);for(let index=before;index<collected;index++)await save(members.indexOf(choice[index]));phase=collected===choice.length?'complete':'refresh';
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:phase==='complete'?'COMPLETE':'PARTIAL_BUDGET',jobs:[job(data)]})}).catch(()=>{});replyGate?.finished?.resolve();
    });
    const execute=()=>page.getByTestId('bollinger-execute').click();
    const rowLocator=()=>page.getByTestId(viewport.width>=768?'bollinger-inspection-row':'bollinger-inspection-card');
    const rowKeys=()=>rowLocator().evaluateAll(rows=>rows.map(row=>row.dataset.symbol));
    const waitRows=async(count,keys=null,same=false)=>page.waitForFunction(({count,keys,same,testId})=>{const actual=[...document.querySelectorAll(`[data-testid="${testId}"]`)].map(row=>row.dataset.symbol);return actual.length===count&&(!keys||(JSON.stringify(actual)===JSON.stringify(keys))===same);},{count,keys,same,testId:viewport.width>=768?'bollinger-inspection-row':'bollinger-inspection-card'});
    const collectCalls=()=>calls.filter(call=>call.name==='collectSelected');
    const queryCalls=()=>calls.filter(call=>call.name==='getDiscoveryCandidates');
    const chartCalls=()=>calls.filter(call=>call.name==='getDiscoveryStockChart');
    const waitFixture=async(predicate,message)=>{for(let attempt=0;attempt<120&&!predicate();attempt++)await page.waitForTimeout(25);assert.ok(predicate(),message);};
    const waitCollect=async(count)=>{for(let attempt=0;attempt<120&&collectCalls().length<count;attempt++)await page.waitForTimeout(25);assert.equal(collectCalls().length,count,'collector request did not start');};
    const waitStored=async(count)=>{await page.waitForFunction(n=>document.querySelector('[data-testid="bollinger-availability"]')?.textContent?.includes(`계산 저장 ${n}개`),count);};
    const openAll=async()=>{await page.getByRole('button',{name:/^전체 선택 \d+$/,exact:true}).click();await page.getByTestId('bollinger-inspection-list').waitFor();};
    try{
      await page.goto(`${base}/bollinger`,{waitUntil:'domcontentloaded'});await page.getByLabel('편입 스냅샷').locator('option').nth(1).waitFor({state:'attached'});await page.getByLabel('구성 범위').selectOption('20');
      assert.equal(queryCalls().length,0,'draft caused execution');
      if(!initiallyComplete){
        await execute();await page.getByRole('dialog').waitFor();assert.equal(collectCalls().length,0);await page.getByRole('button',{name:'취소',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(collectCalls().length,0);
        await execute();await page.getByRole('dialog').waitFor();await page.getByLabel('수집 실행 비밀값').fill('QA_WRONG_ACTION_PASSWORD');await page.getByRole('button',{name:'권한 확인 후 실행',exact:true}).click();await page.getByRole('dialog').getByRole('alert').waitFor();assert.equal(collectCalls().length,0);assert.equal(await page.getByLabel('수집 실행 비밀값').inputValue(),'');await page.getByRole('button',{name:'취소',exact:true}).click();
        await execute();await page.getByRole('dialog').waitFor();await page.getByLabel('수집 실행 비밀값').fill('QA_ACTION_PASSWORD_ONLY_1234567890');await page.getByRole('button',{name:'권한 확인 후 실행',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await waitStored(20);
        assert.equal(collectCalls().length,3,'one Execute did not automatically finish bounded collection');for(const call of collectCalls())assert.deepEqual(call.data,collectCalls()[0].data,'continuation changed selected scope');
        run.execute={initiallyStored:3,selected:20,automaticallyStored:20,requests:collectCalls().length,ownerRequired:true,cancelBeforeAuthorization:true,badSecretBlocked:true};
      }else{await execute();await waitStored(20);}
      await openAll();assert.equal((await rowKeys()).length,20);
      const study=page.getByTestId('bollinger-stock-study'),chart=page.getByTestId('bollinger-study-price-chart');await chart.getByTestId('chart-canvas').waitFor();await chart.scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.waitForTimeout(250);
      if(testCase==='all'||testCase==='range'){
        const fetches=chartCalls().length,posts=collectCalls().length,summary=await page.getByTestId('bollinger-stock-summary').innerText();
        const sma200=chart.getByTestId('chart-hud').getByRole('button',{name:/^SMA200 /});const expected200=sma(stockBars(0).map(bar=>bar.close),200).at(-1);assert.ok(expected200!=null);const legend200=await sma200.innerText();assert.ok(legend200.includes(formatChartPrice(expected200,'KR',stockBars(0).at(-1).close)),'SMA200 did not use full real pre-roll');
        await study.getByRole('button',{name:'최근 120봉',exact:true}).click();await page.waitForTimeout(250);const recent120=await chartEvidence(chart,theme);assert.ok(Math.abs(recent120.span-120)<2,`native 120 viewport span is ${recent120.span}`);
        await study.getByRole('button',{name:'최근 250봉',exact:true}).click();await page.waitForTimeout(250);const recent250=await chartEvidence(chart,theme);assert.ok(Math.abs(recent250.span-250)<2,`native 250 viewport span is ${recent250.span}`);assert.notEqual(recent120.hash,recent250.hash,'range buttons left native price canvas unchanged');assert.equal(await study.getByRole('button',{name:'최근 250봉',exact:true}).getAttribute('aria-pressed'),'true');
        assert.equal(await page.getByTestId('bollinger-stock-summary').innerText(),summary,'range changed latest assessment');assert.equal(await sma200.innerText(),legend200,'250 viewport changed historical SMA200');assert.equal(chartCalls().length,fetches,'range fetched prices');assert.equal(collectCalls().length,posts,'range started collector');await study.screenshot({path:`${out}/native-250-${theme}-${viewport.id}.png`});
        await study.getByRole('button',{name:'전체 저장 이력',exact:true}).click();await page.waitForTimeout(250);const entire=await chartEvidence(chart,theme);assert.ok(Math.abs(entire.span-303)<2,`native full-history viewport span is ${entire.span}`);assert.notEqual(entire.hash,recent250.hash,'full history left the native viewport unchanged');assert.equal(await study.getByRole('button',{name:'전체 저장 이력',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await sma200.innerText(),legend200,'full viewport changed historical SMA200');assert.equal(chartCalls().length,fetches);assert.equal(collectCalls().length,posts);await study.screenshot({path:`${out}/native-full-${theme}-${viewport.id}.png`});
        await study.getByRole('button',{name:'최근 120봉',exact:true}).click();await page.waitForTimeout(250);const returned120=await chartEvidence(chart,theme);assert.ok(Math.abs(returned120.span-120)<2);assert.equal(returned120.hash,recent120.hash,'returning 120 did not restore the native range');assert.ok(recent120.upper>5&&recent120.lower>5&&recent250.upper>5&&recent250.lower>5,'range has no native Bollinger boundaries');
        run.range={recent120,recent250,entire,returned120,fullHistory:303,sma200:expected200,sma200Stable:true,noRefetch:true,noCollection:true};await study.screenshot({path:`${out}/native-range-${theme}-${viewport.id}.png`});
      }
      if(testCase==='all'||testCase==='strategies'){
        const expected=[['Squeeze Watch','squeeze-watch',[0,1,2,10,11,12]],['Triggered','triggered',[3,13]],['Follow-Through','follow-through',[4,14]],['Failed Breakout','failed-breakout',[5,15]],['Pullback','pullback',[6,16]],['Bear / Breakdown','bear-breakdown',[8,18]],['Long Pre-Breakout','long-pre-breakout',[9,19]]];
        const posts=collectCalls().length;
        for(const [label,key,indices]of expected){const before=queryCalls().length;await page.getByRole('button',{name:label,exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="bollinger-screener"]')?.textContent?.includes('검색 완료'));await page.waitForTimeout(200);assert.equal(await page.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');assert.deepEqual((await rowKeys()).sort(),indices.map(i=>`KR:${members[i].symbol}`).sort(),`${label} retained identical all-stock rows`);assert.ok(queryCalls().slice(before).some(c=>c.data.strategy===key));if(key==='squeeze-watch'||key==='triggered')await page.getByTestId('bollinger-inspection-list').screenshot({path:`${out}/strategy-${key}-${theme}-${viewport.id}.png`});}
        await page.getByRole('button',{name:'Mean Reversion',exact:true}).click();await page.waitForTimeout(200);assert.equal((await rowKeys()).length,0,'empty strategy silently displayed all stocks');await page.getByTestId('bollinger-result-status').waitFor();assert.match(await page.getByTestId('bollinger-result-status').innerText(),/조건|후보|일치/);await openAll();assert.equal((await rowKeys()).length,20);assert.equal(collectCalls().length,posts,'view tabs collected prices');
        await page.getByRole('button',{name:'Mean Reversion',exact:true}).click();await page.waitForTimeout(200);assert.equal((await rowKeys()).length,0);await page.getByLabel('구성 범위').selectOption('10');await execute();await waitStored(10);assert.equal((await rowKeys()).length,10,'new Execute retained empty matched-only view');await chart.getByTestId('chart-canvas').waitFor();assert.equal(await page.getByRole('button',{name:'전체 선택 10',exact:true}).getAttribute('aria-pressed'),'true');await page.getByLabel('구성 범위').selectOption('20');await execute();await waitStored(20);assert.equal((await rowKeys()).length,20);assert.equal(collectCalls().length,posts,'healthy new scope started collection');
        run.strategies={distinctIdentities:true,emptyStrategyHonest:true,allSelectedRecoverable:true,executeRestoresAllSelected:true,noCollection:true};await page.getByTestId('bollinger-inspection-list').screenshot({path:`${out}/strategies-${theme}-${viewport.id}.png`});
      }
      if(testCase==='all'){
        const posts=collectCalls().length;
        await chart.getByTestId('bollinger-master').click();await page.waitForTimeout(200);assert.equal(await chart.getByTestId('chart-canvas').getAttribute('data-bollinger-enabled'),'false');const hiddenBands=await chartEvidence(chart,theme);assert.equal(hiddenBands.upper+hiddenBands.lower,0,'Bollinger OFF left native boundaries');await chart.getByTestId('bollinger-master').click();await page.waitForTimeout(200);assert.equal(await chart.getByTestId('chart-canvas').getAttribute('data-bollinger-enabled'),'true');
        const pngDownload=page.waitForEvent('download');await chart.getByTestId('chart-export-png').click();const png=await pngDownload,pngStream=await png.createReadStream();const chunks=[];for await(const chunk of pngStream)chunks.push(chunk);const pngBytes=Buffer.concat(chunks);assert.equal(pngBytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','chart PNG export invalid');await png.saveAs(`${out}/chart-export-${theme}-${viewport.id}.png`);
        const csvDownload=page.waitForEvent('download');await chart.getByTestId('chart-export-csv').click();const csv=await csvDownload,csvStream=await csv.createReadStream();let csvText='';for await(const chunk of csvStream)csvText+=chunk.toString();const [csvHead,...csvRows]=csvText.split(/\r?\n\r?\n/)[0].trim().split(/\r?\n/).map(line=>line.split(','));assert.ok(csvRows.length>=120&&csvRows.length<=122,'CSV did not export the native visible range');assert.equal(csvRows.at(-1)[0],storedDay,'CSV omitted latest visible date');const smaIndex=csvHead.indexOf('SMA200');assert.ok(smaIndex>0);assert.ok(Math.abs(Number(csvRows.at(-1)[smaIndex])-sma(stockBars(0).map(bar=>bar.close),200).at(-1))<1e-9,'CSV SMA200 lost calculation pre-roll');
        chartFailure=members[0].symbol;await study.getByRole('button',{name:`${members[0].name} 저장 가격 다시 조회`,exact:true}).click();await study.getByText('가격 차트를 표시할 자료가 없습니다.',{exact:false}).waitFor();assert.equal(await study.getByTestId('chart-canvas').count(),0);chartFailure=null;await study.getByRole('button',{name:`${members[0].name} 저장 가격 다시 조회`,exact:true}).click();await chart.getByTestId('chart-canvas').waitFor();assert.equal(collectCalls().length,posts,'retry started collector');
        delayedSymbol=members[7].symbol;const staleChart=deferred();staleChart.finished=deferred();chartGate=staleChart;await page.getByRole('button',{name:`${members[7].name} 볼린저 차트 보기`,exact:true}).click();await waitFixture(()=>chartGate===null&&chartCalls().some(call=>call.data.symbol===members[7].symbol),'stale stock request never reached server transport');await page.getByRole('button',{name:`${members[2].name} 볼린저 차트 보기`,exact:true}).click();await page.waitForFunction(key=>document.querySelector('[data-testid="bollinger-stock-study"]')?.dataset.symbol===key,`KR:${members[2].symbol}`);await chart.getByTestId('chart-canvas').waitFor();const current=await page.getByTestId('bollinger-stock-summary').innerText();staleChart.resolve();await staleChart.finished.promise;await page.waitForTimeout(200);assert.equal(await study.getAttribute('data-symbol'),`KR:${members[2].symbol}`);assert.equal(await page.getByTestId('bollinger-stock-summary').innerText(),current,'late old-stock response overwrote current prices');
        delayedStrategy='triggered';const staleQuery=deferred();staleQuery.finished=deferred();queryGate=staleQuery;await page.getByRole('button',{name:'Triggered',exact:true}).click();await waitFixture(()=>queryGate===null,'stale strategy request never reached server transport');await page.getByRole('button',{name:'Follow-Through',exact:true}).click();await page.waitForTimeout(250);assert.deepEqual((await rowKeys()).sort(),[4,14].map(i=>`KR:${members[i].symbol}`).sort());staleQuery.resolve();await staleQuery.finished.promise;await page.waitForTimeout(200);assert.deepEqual((await rowKeys()).sort(),[4,14].map(i=>`KR:${members[i].symbol}`).sort(),'late strategy result replaced current rows');await openAll();
        const date=page.getByLabel('조회 기준일');await date.fill(new Date(stamp+86400000).toISOString().slice(0,10));assert.equal(await page.getByTestId('bollinger-execute').isDisabled(),true);await date.fill(storedDay);const beforeDate=chartCalls().length;await execute();await waitStored(20);await chart.getByTestId('chart-canvas').waitFor();assert.ok(chartCalls().slice(beforeDate).some(call=>call.data.asOf===storedDay),'asOf did not rebind stored chart');
        await page.getByText('편입 미리보기 · 수동 코드 필터',{exact:true}).click();const manual=page.getByLabel('저장 자료 수동 종목 필터');await manual.fill('INVALID');assert.equal(await page.getByTestId('bollinger-execute').isDisabled(),true);const beforeManual=queryCalls().length;await manual.fill(`KR:${members[0].symbol}, KR:${members[1].symbol}`);await page.waitForTimeout(100);assert.equal(queryCalls().length,beforeManual,'manual draft auto executed');await execute();await waitStored(2);await openAll();assert.deepEqual((await rowKeys()).sort(),[0,1].map(i=>`KR:${members[i].symbol}`).sort());await manual.fill('');await date.fill(day);
        // Pagination must change actual identities and recover page one, not merely dispatch a request.
        for(let i=20;i<100;i++)await save(i);collected=100;phase='complete';await page.getByLabel('구성 범위').selectOption('100');await execute();await waitStored(100);await openAll();await page.getByLabel('페이지 크기').selectOption('25');await waitRows(25);const firstPage=await rowKeys();assert.equal(firstPage.length,25);await page.getByRole('button',{name:'다음',exact:true}).click();await waitRows(25,firstPage);const secondPage=await rowKeys();assert.equal(secondPage.length,25);assert.equal(secondPage.some(key=>firstPage.includes(key)),false);await page.getByRole('button',{name:'이전',exact:true}).click();await waitRows(25,firstPage,true);assert.deepEqual(await rowKeys(),firstPage);await page.getByRole('button',{name:'다음',exact:true}).click();await waitRows(25,firstPage);await page.getByLabel('페이지 크기').selectOption('50');await waitRows(50);assert.equal((await rowKeys()).length,50);assert.equal(await page.getByRole('button',{name:'이전',exact:true}).isDisabled(),true);
        assert.equal(collectCalls().length,posts,'date/manual/pagination view operations collected healthy history');run.actions={priceRetry:true,lateStockIgnored:true,lateStrategyIgnored:true,futureDateBlocked:true,manualDraftAndScope:true,paginationIdentities:true,pageSizeResets:true,noCollection:true};
        // Cancellation stops browser continuation, while a request already sent
        // may finish safely on the server. Explicit resume must complete that job.
        await page.getByLabel('구성 범위').selectOption('20');await execute();await waitStored(20);
        await pg.query('DELETE FROM bollinger_features WHERE universe_id=$1 AND symbol=ANY($2::text[])',[snapshot.id,members.slice(3,20).map(m=>m.symbol)]);collected=3;phase='refresh';collectMode='hold';const held=deferred();held.finished=deferred();collectGate=held;
        const beforeCancel=collectCalls().length;await execute();await page.getByTestId('bollinger-cancel').waitFor();await page.waitForTimeout(100);assert.equal(collectCalls().length,beforeCancel+1);await page.getByTestId('bollinger-cancel').click();await page.getByText('자동 이어받기를 중지했습니다.',{exact:false}).waitFor();held.resolve();await held.finished.promise;await page.waitForTimeout(750);assert.equal(collectCalls().length,beforeCancel+1,'cancel sent another collection chunk');assert.equal(await page.getByTestId('bollinger-cancel').count(),0);collectMode='normal';await page.getByTestId('bollinger-collect').click();await waitStored(20);assert.ok(collectCalls().length>beforeCancel+1,'resume did not restart stopped job');
        // Failed transport is terminal for automatic execution and can be retried explicitly.
        await pg.query('DELETE FROM bollinger_features WHERE universe_id=$1 AND symbol=ANY($2::text[])',[snapshot.id,members.slice(3,20).map(m=>m.symbol)]);collected=3;phase='refresh';collectMode='network';const beforeError=collectCalls().length;await execute();await page.getByTestId('bollinger-collection-status').getByText('서버 실행 응답을 확인하지 못했습니다.',{exact:false}).waitFor();await page.waitForTimeout(700);assert.equal(collectCalls().length,beforeError+1,'network failure automatically retried');collectMode='normal';await execute();await waitStored(20);
        // An unchanged progress reply must terminate, never spend all twenty rounds.
        await pg.query('DELETE FROM bollinger_features WHERE universe_id=$1 AND symbol=ANY($2::text[])',[snapshot.id,members.slice(3,20).map(m=>m.symbol)]);collected=3;phase='refresh';collectMode='stalled';const beforeStalled=collectCalls().length;await execute();await page.getByText('저장 진행이 연속해서 늘지 않아',{exact:false}).waitFor();assert.equal(collectCalls().length,beforeStalled+4,'unchanged progress was not bounded');collectMode='normal';await page.getByTestId('bollinger-collect').click();await waitStored(20);
        await pg.query('DELETE FROM bollinger_features WHERE universe_id=$1 AND symbol=ANY($2::text[])',[snapshot.id,members.slice(3,20).map(m=>m.symbol)]);collected=3;phase='refresh';collectMode='hold';const hidden=deferred();hidden.finished=deferred();collectGate=hidden;const beforeHidden=collectCalls().length;await execute();await page.getByTestId('bollinger-cancel').waitFor();await waitCollect(beforeHidden+1);await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});await page.getByText('자동 이어받기를 중지했습니다.',{exact:false}).waitFor();hidden.resolve();await hidden.finished.promise;await page.waitForTimeout(750);assert.equal(collectCalls().length,beforeHidden+1,'hidden tab continued collection');assert.equal(await page.getByTestId('bollinger-cancel').count(),0);await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});collectMode='normal';await page.getByTestId('bollinger-collect').click();await waitStored(20);
        const beforeReset=queryCalls().length,postsBeforeReset=collectCalls().length;await page.getByRole('button',{name:'기본값 복원',exact:true}).click();assert.equal(await page.getByLabel('구성 범위').inputValue(),'20','reset enlarged the fresh20-stock default');await page.waitForTimeout(100);assert.equal(queryCalls().length,beforeReset,'reset auto executed');assert.equal(collectCalls().length,postsBeforeReset,'reset auto collected');
        run.collectionControls={cancelStopsFurtherRequests:true,explicitResumeCompletes:true,networkFailureStops:true,executeRetries:true,unchangedProgressStopsAfter4:true,hiddenTabStopsContinuation:true};run.actions.bandToggleNative=true;run.actions.pngExport=true;run.actions.csvVisibleRangeAndWarmup=true;run.actions.resetDraftOnly=true;
      }
      assert.equal(calls.some(call=>['getChartData','getChartFlow','getBollingerScreener'].includes(call.name)),false,'analysis implicitly used provider/broker path');assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'horizontal overflow');assert.equal(await page.evaluate(()=>[...Object.values(localStorage),...Object.values(sessionStorage)].some(value=>/QA_ACTION_PASSWORD|QA_WRONG_ACTION_PASSWORD/.test(value))),false,'password persisted');
      run.success=true;
    }catch(error){run.error=error.message.slice(0,1800);await page.screenshot({path:`${out}/FAILED-${theme}-${viewport.id}.png`,fullPage:true});}
    run.calls=calls.map(call=>({name:call.name,strategy:call.data.strategy??null,symbol:call.data.symbol??null,asOf:call.data.asOf??null,page:call.data.page??null}));results.push(run);console.log(JSON.stringify({theme,viewport:viewport.id,success:run.success,error:run.error}));await context.close();await pg.close();
  }
}finally{await browser.close();}
await writeFile(`${out}/verification.json`,JSON.stringify({scope:'synthetic isolated production-browser actions; no live provider or operational DB',base,testCase,day,storedDay,results},null,2));
if(results.some(result=>!result.success))process.exitCode=1;
