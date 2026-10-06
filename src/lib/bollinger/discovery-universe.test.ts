import test from "node:test";import assert from "node:assert/strict";
import { canonicalSector, parseNasdaqListedUniverse, selectUniverse, universeAt, validateUniverseSnapshot, validTopOptions } from "./discovery-universe.ts";
import { member, universe } from "./discovery-fixture.test-data.ts";
test("valid exchange membership, name, leading zero, dedup and explicit taxonomy",()=>{
  const u=validateUniverseSnapshot(universe([member(),member()]));assert.equal(u.members.length,1);assert.equal(u.members[0]!.symbol,"005930");assert.equal(u.members[0]!.name,"QA SYNTHETIC 005930");
  assert.equal(canonicalSector("semiconductors","desk-curated"),"Semiconductors");assert.equal(canonicalSector("finance",null),"Unknown");
  assert.throws(()=>validateUniverseSnapshot({...universe(),kind:"KOSDAQ"}),/EXCHANGE/);
});
test("Nasdaq100 membership is verified, valid choices never arbitrary Nasdaq200",()=>{
  assert.deepEqual(validTopOptions("NASDAQ100"),[10,20,50,"ALL"]);
  assert.throws(()=>validateUniverseSnapshot({...universe(),kind:"NASDAQ100"}),/VERIFIED/);
});
test("index weight preferred only when complete; fallback labeled cap; missing cap not invented",()=>{
  const a={...member("AAPL"),market:"US" as const,exchange:"NASDAQ" as const,indexWeight:3},b={...a,symbol:"NVDA",indexWeight:5,marketCap:null};
  const u={...universe([a,b]),kind:"NASDAQ100" as const,authoritative:true};
  assert.equal(selectUniverse(u,{top:10,minWeight:0,sectors:[]}).rankingBasis,"index-weight");
  u.members[1]!.indexWeight=null;const result=selectUniverse(u,{top:10,minWeight:0,sectors:[]});assert.equal(result.rankingBasis,"market-cap");assert.equal(result.selected.length,1);assert.equal(result.missingRanks,1);
});
test("ETF one-level equities only, verified mapping, no invented weights / renormalization",()=>{
  const a={...member(),weight:30},b={...member("000660"),weight:20},cash={...member("111111"),assetType:"cash" as const,weight:30},fund={...member("222222"),assetType:"etf" as const,weight:10},bad={...member("333333"),identityVerified:false,weight:10};
  const u={...universe([a,b,cash,fund,bad]),kind:"ETF" as const};const p=selectUniverse(u,{top:"ALL",minWeight:25,sectors:[]});
  assert.equal(p.supportedCount,2);assert.equal(p.excludedCount,3);assert.equal(p.knownWeight,50);assert.equal(p.selectedWeight,30);assert.equal(p.selected.length,1);
});
test("PIT membership gates effective and known dates; explicit current fallback marked biased",()=>{
  const now={...universe(),asOf:"2026-10-06",knownAt:"2026-10-06T00:00:00Z",historical:false};
  assert.equal(universeAt([now],"2025-01-01","2025-01-01T00:00:00Z").snapshot,null);
  assert.equal(universeAt([now],"2025-01-01","2025-01-01T00:00:00Z",true).biased,true);
  const old={...universe(),knownAt:"2024-03-01T00:00:00Z"};assert.equal(universeAt([old],"2024-02-01","2024-02-01T00:00:00Z").snapshot,null);
  assert.equal(universeAt([old],"2024-03-02","2024-03-02T00:00:00Z").biased,false);
});
test("official Nasdaq Listed response is distinct from Nasdaq100 and stores observed cap units/date",()=>{
  const raw={status:{rCode:200},data:{totalrecords:3,asof:"Last price as of Oct 5, 2026",table:{rows:[{symbol:"NVDA",name:"NVIDIA Common Stock",marketCap:"5,000,000"},{symbol:"BADW",name:"Company Warrant",marketCap:""},{symbol:"AAPL",name:"Apple Common Stock",marketCap:"1,000,000"}]}}};
  const u=parseNasdaqListedUniverse(raw,"2026-10-06T00:00:00Z");assert.equal(u.kind,"NASDAQ_LISTED");assert.equal(u.rankAsOf,"2026-10-05");assert.equal(u.members[0]!.marketCap,5000000);
  const selected=selectUniverse(u,{top:10,minWeight:0,sectors:[]});assert.equal(selected.supportedCount,2);assert.equal(selected.excludedCount,1);assert.equal(selected.selected[0]!.symbol,"NVDA");
  assert.throws(()=>parseNasdaqListedUniverse({...raw,data:{...raw.data,totalrecords:4}},"2026-10-06T00:00:00Z"),/PARTIAL/);
  assert.throws(()=>validateUniverseSnapshot({...u,kind:"NASDAQ100",sourceUrl:"https://example.org/not-official"}),/OFFICIAL/);
});
