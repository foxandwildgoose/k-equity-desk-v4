#!/usr/bin/env node
/** Optional local operator CLI; cloud operations use the separate protected Cron route. Never emits environment values. */
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createServer } from 'vite';
import { resolve } from 'node:path';

const args=process.argv.slice(2),command=args.shift()??'help';
const flags=new Set(['--live','--write','--research-only']);
const values=new Set(['--file','--universe-id','--kind','--etf-code','--market','--symbol','--exchange','--offset','--limit','--budget-seconds','--resume','--config','--start','--end','--development-end','--validation-end','--minimum-samples','--commission-bps','--slippage-bps','--out']);
const options={};
for(let i=0;i<args.length;i++){if(flags.has(args[i])) options[args[i]]=true;else if(values.has(args[i])&&args[i+1]&&!args[i+1].startsWith('--')) options[args[i]]=args[++i];else{console.error('INVALID_OPTION');process.exit(1);}}
const value=(key,fallback)=>options[key]??fallback;
const integer=(key,fallback,min=0,max=15000)=>{const n=Number(value(key,fallback));if(!Number.isInteger(n)||n<min||n>max)throw new Error('INVALID_OPTION');return n;};
const print=value=>console.log(JSON.stringify(value,null,2));
const requireWrite=()=>{if(!options['--write'])throw new Error('EXPLICIT_WRITE_REQUIRED');};
const json=async key=>JSON.parse(await readFile(resolve(String(value(key,''))),'utf8'));
let vite;
try {
  if(command==='help') {
    print({commands:['config','validate --file <public-universe.json>','import --file <public-universe.json> --write','universe --kind KOSPI|KOSDAQ|NASDAQ_LISTED --live [--write] [--out <public-snapshot.json>]','universe --etf-code <verified-ETF-code> --live [--write]','inspect --market KR --symbol 005930 --live','list','jobs --universe-id <id>','collect --universe-id <id> --live --write [--offset N --limit N --resume <job-id>]','precompute --universe-id <id> --write [--config <thresholds.json>]','backtest --universe-id <id> --start YYYY-MM-DD --end YYYY-MM-DD --development-end YYYY-MM-DD --validation-end YYYY-MM-DD --write [--research-only]'],safety:'No API call without --live. No persistent write without --write. No secrets in files/output.'});
  } else if(command==='config') {
    print({databaseConfigured:Boolean(process.env.DATABASE_URL?.trim()),collectionMode:'local-operator',priceProvider:'existing-Naver/Yahoo',timeframe:'daily',schedulerConfigured:false,kiwoomRequired:false});
  } else {
    if(!['validate','import','universe','inspect','list','jobs','collect','precompute','backtest'].includes(command))throw new Error('INVALID_COMMAND');
    if(['universe','collect','inspect'].includes(command)){if(!options['--live'])throw new Error('EXPLICIT_LIVE_REQUIRED');}
    if(['import','collect','precompute','backtest'].includes(command))requireWrite();
    if(!['validate','universe','inspect'].includes(command)||options['--write']){if(!process.env.DATABASE_URL?.trim())throw new Error('DATABASE_MISSING');}
    // Vite's existing alias/module loader is reused; no second server/framework or app migration.
    vite=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'error'});
    const universeModule=await vite.ssrLoadModule('/src/lib/bollinger/discovery-universe.ts');
    const {sanitizeDiscoveryConfig}=await vite.ssrLoadModule('/src/lib/bollinger/discovery.ts');
    const config=options['--config']?sanitizeDiscoveryConfig(await json('--config')):sanitizeDiscoveryConfig();
    let store;
    const getStore=async()=>{store??=await (await vite.ssrLoadModule('/src/server/bollinger-discovery-store.ts')).getDiscoveryStore();return store;};
    if(command==='inspect') {
      const market=String(value('--market','KR')),symbol=String(value('--symbol','005930')).toUpperCase(),exchange=String(value('--exchange',market==='KR'?'KOSPI':'NASDAQ'));
      if(!['KR','US'].includes(market)||!(market==='KR'?/^[0-9A-Z]{6}$/.test(symbol):/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol))||!['KOSPI','KOSDAQ','NASDAQ','NYSE'].includes(exchange))throw new Error('INVALID_OPTION');
      const providers=await vite.ssrLoadModule('/src/server/bollinger-discovery-providers.ts'),jobs=await vite.ssrLoadModule('/src/server/bollinger-discovery-jobs.ts');
      const member={market,symbol,exchange,name:symbol,sector:'Unknown',sectorSource:null,marketCap:null,indexWeight:null,weight:null,assetType:'unknown',identityVerified:false};
      const response=await providers.fetchDiscoveryPrices(member,true);
      const benchmark=market==='KR'?exchange==='KOSDAQ'?'^KQ11':'^KS11':'^GSPC';
      const {fetchDiscoveryBenchmark}=await vite.ssrLoadModule('/src/server/naver-market.ts');
      const {completedPriceBars}=await vite.ssrLoadModule('/src/lib/bollinger/bar-completion.ts');
      const benchmarkResponse=await fetchDiscoveryBenchmark(benchmark),benchmarkBars=completedPriceBars(benchmarkResponse.bars,{market,interval:'day'}).filter(b=>b.completed);
      const contexts=Object.fromEntries(jobs.contextHistory(benchmarkBars,benchmarkResponse.source).map(c=>[c.asOf,{market:c}]));
      const {analyzeDiscovery}=await vite.ssrLoadModule('/src/lib/bollinger/discovery.ts');
      const latest=analyzeDiscovery(response.bars,config,contexts,`${market}:${symbol}`).candidates.at(-1);
      print({status:response.bars.length?'RECEIVED_NOT_STORED':'NO_HISTORY',market,symbol,rows:response.bars.length,first:response.bars[0]?.date??null,last:response.bars.at(-1)?.date??null,source:response.source,priceBasis:response.basis,benchmarkRows:benchmarkBars.length,latest:latest?{date:latest.date,state:latest.state,score:latest.score.value,coverage:latest.score.coverage,resistance:latest.resistance,rs20:latest.rs20,rs63:latest.rs63,warnings:latest.warnings}:null,persistence:'not-requested',browser:'not-verified'});
    } else if(command==='validate'||command==='import') {
      const snapshot=universeModule.validateUniverseSnapshot(await json('--file'));
      if(command==='import')await (await getStore()).saveUniverse(snapshot);
      print({status:command==='import'?'IMPORTED':'VALID',id:snapshot.id,kind:snapshot.kind,members:snapshot.members.length,asOf:snapshot.asOf,historical:snapshot.historical});
    } else if(command==='universe') {
      const providers=await vite.ssrLoadModule('/src/server/bollinger-discovery-providers.ts');
      const kind=value('--kind','');
      const snapshot=options['--etf-code']?await providers.fetchEtfDiscoveryUniverse(String(options['--etf-code'])):['KOSPI','KOSDAQ'].includes(kind)?await providers.fetchKrDiscoveryUniverse(kind):kind==='NASDAQ_LISTED'?await providers.fetchNasdaqListedDiscoveryUniverse():null;
      if(!snapshot)throw new Error('OFFICIAL_MEMBERSHIP_IMPORT_REQUIRED');
      if(options['--write'])await (await getStore()).saveUniverse(snapshot);
      if(options['--out'])await writeFile(resolve(String(options['--out'])),JSON.stringify(snapshot,null,2)+'\n');
      const preview=universeModule.selectUniverse(snapshot,{top:'ALL',minWeight:0,sectors:[]});
      print({status:options['--write']?'IMPORTED':'RECEIVED_NOT_STORED',id:snapshot.id,kind:snapshot.kind,asOf:snapshot.asOf,supported:preview.supportedCount,excluded:preview.excludedCount,source:snapshot.source,researchOnly:preview.researchOnly});
    } else if(command==='list') {
      print({universes:(await (await getStore()).universes()).map(u=>({id:u.id,kind:u.kind,label:u.label,asOf:u.asOf,members:u.members.length}))});
    } else {
      const universeId=String(value('--universe-id',''));if(!universeId)throw new Error('UNIVERSE_ID_REQUIRED');
      const database=await getStore();
      const jobs=await vite.ssrLoadModule('/src/server/bollinger-discovery-jobs.ts');
      if(command==='jobs')print({checkpoints:await database.checkpoints(universeId)});
      else if(command==='collect') {
        const {fetchDiscoveryPrices}=await vite.ssrLoadModule('/src/server/bollinger-discovery-providers.ts');
        const {fetchDiscoveryBenchmark}=await vite.ssrLoadModule('/src/server/naver-market.ts');
        const resume=options['--resume']?await database.job(String(options['--resume'])):null;
        if(options['--resume']&&(!resume||resume.scope!==universeId))throw new Error('RESUME_JOB_MISMATCH');
        print(await jobs.collectDiscovery(database,universeId,fetchDiscoveryPrices,{offset:resume?.summary.nextOffset??integer('--offset',0),retrySymbols:resume?.summary.errors?.map(e=>e.symbol),limit:integer('--limit',15000,1),budgetMs:integer('--budget-seconds',1800,30,3600)*1000,config,fetchBenchmarks:fetchDiscoveryBenchmark}));
      } else if(command==='precompute') print(await jobs.runDiscoveryPrecompute(database,universeId,config,integer('--budget-seconds',1800,30,3600)*1000));
      else {
        const u=await database.universe(universeId);if(!u)throw new Error('UNIVERSE_MISSING');
        const inputs=[],history=await database.universeHistory(u.kind,u.label),allowCurrentResearch=options['--research-only']===true;
        const {eventStudy,studyFeatureHistory}=await vite.ssrLoadModule('/src/lib/bollinger/discovery-backtest.ts');
        const members=[...new Map((allowCurrentResearch?[u]:history.filter(s=>s.historical)).flatMap(s=>universeModule.selectUniverse(s,{top:'ALL',minWeight:0,sectors:[]}).selected).map(m=>[universeModule.securityKey(m),m])).values()];
        for(const member of members) {
          const histories=[];
          for(const snapshot of history)if(snapshot.members.some(m=>universeModule.securityKey(m)===universeModule.securityKey(member)))histories.push({snapshot,features:await database.featureHistory(snapshot.id,member,config.version)});
          const features=studyFeatureHistory(histories,member.market,allowCurrentResearch),basis=features.at(-1)?.price_basis;if(!basis)continue;
          if(features.some(f=>f.price_basis!==basis))throw new Error('MIXED_PRICE_BASIS');
          const benchmark=member.market==='KR'?member.exchange==='KOSDAQ'?'^KQ11':'^KS11':u.kind==='NASDAQ100'?'^NDX':u.kind==='NASDAQ_LISTED'?'^IXIC':'^GSPC';
          inputs.push({market:member.market,symbol:member.symbol,bars:await database.bars(member.market,member.symbol,basis),candidates:features.map(f=>f.payload),priceBasis:basis,benchmarkBars:await database.bars(member.market,benchmark,'price-index')});
        }
        const report=eventStudy(inputs,history,{start:String(value('--start','')),end:String(value('--end','')),developmentEnd:String(value('--development-end','')),validationEnd:String(value('--validation-end','')),minimumSamples:integer('--minimum-samples',30,1,10000),allowCurrentResearch,commissionBps:integer('--commission-bps',0,0,500),slippageBps:integer('--slippage-bps',0,0,500),configVersion:config.version});
        const id=randomUUID();await database.saveBacktest(id,universeId,config.version,report.options.start,report.options.end,report.researchOnly,report);
        if(options['--out'])await writeFile(resolve(String(options['--out'])),JSON.stringify(report,null,2)+'\n');
        print({id,status:'STORED_EVENT_STUDY',researchOnly:report.researchOnly,observations:report.observations.length,excludedMembership:report.membershipExcluded,warnings:report.warnings});
      }
    }
  }
} catch(error) {
  const allowed=['INVALID_OPTION','INVALID_COMMAND','EXPLICIT_WRITE_REQUIRED','EXPLICIT_LIVE_REQUIRED','DATABASE_MISSING','MIGRATION_0005_REQUIRED','UNIVERSE_MISSING','UNIVERSE_ID_REQUIRED','COLLECTOR_ALREADY_RUNNING','OFFICIAL_MEMBERSHIP_IMPORT_REQUIRED','INVALID_STUDY_OPTIONS','MIXED_PRICE_BASIS','RESUME_JOB_MISMATCH'];
  print({status:allowed.includes(error?.message)?error.message:'OPERATION_FAILED',detail:'No provider body, database connection string or credential is emitted.'});process.exitCode=1;
} finally {
  await vite?.close();
  // The shared pg pool otherwise keeps a one-shot operator CLI alive.
  if(command!=='help'&&command!=='config')process.exit(process.exitCode??0);
}
