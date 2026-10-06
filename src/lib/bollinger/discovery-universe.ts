import { isDiscoveryDay } from "./discovery-dates.ts";
export const UNIVERSE_KINDS = ["KOSPI", "KOSDAQ", "SP500", "NASDAQ100", "NASDAQ_LISTED", "ETF", "WATCHLIST", "MANUAL"] as const;
export type UniverseKind = typeof UNIVERSE_KINDS[number];
export type SecurityMember = {
  market: "KR" | "US"; symbol: string; name: string; exchange: "KOSPI" | "KOSDAQ" | "NASDAQ" | "NYSE" | "OTHER";
  sector: string; sectorSource: string | null; marketCap: number | null; indexWeight: number | null;
  assetType: "equity" | "etf" | "cash" | "bond" | "future" | "option" | "fund" | "unknown";
  weight: number | null; identityVerified: boolean;
};
export type UniverseSnapshot = {
  id: string; kind: UniverseKind; label: string; asOf: string; knownAt: string; fetchedAt: string;
  source: string; sourceUrl: string | null; authoritative: boolean; historical: boolean;
  members: SecurityMember[];
  excludedHoldings?: { name: string; reason: string; weight: number | null }[];
  rankAsOf?: string | null;
};
export type TopChoice = 10 | 20 | 50 | 100 | 200 | "ALL";
export type UniverseSelection = { top: TopChoice; minWeight: number; sectors: string[] };
export const DEFAULT_UNIVERSE_SELECTION: UniverseSelection = { top: "ALL", minWeight: 0, sectors: [] };
const numberOrNull = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
const text = (v: unknown, max = 240) => typeof v === "string" ? v.trim().slice(0, max) : "";
const EXCHANGES = new Set(["KOSPI", "KOSDAQ", "NASDAQ", "NYSE", "OTHER"]);
const ASSETS = new Set(["equity", "etf", "cash", "bond", "future", "option", "fund", "unknown"]);
export function securityKey(s: Pick<SecurityMember, "market" | "symbol">) { return `${s.market}:${s.symbol}`; }
/** Preserve the existing desk taxonomy; explicit provider mapping only, never name guessing. */
export function canonicalSector(raw: string | null, source: string | null): string {
  if (!raw || !source) return "Unknown";
  if (["Semiconductors","Automobiles","Batteries","Consumer","Unknown","Real Estate","Utilities"].includes(raw)) return raw;
  const map: Record<string, string> = { semiconductors: "Semiconductors", electronics: "Technology", auto: "Automobiles", battery: "Batteries", bio: "Healthcare", finance: "Financials", shipbuilding: "Industrials", chemicals: "Materials", energy: "Energy", telecom: "Communication Services", consumer: "Consumer", construction: "Industrials", steel: "Materials", robotics: "Industrials", defense: "Industrials", "us-linked": "Unknown", Technology: "Technology", Healthcare: "Healthcare", Financials: "Financials", Energy: "Energy", Industrials: "Industrials", Materials: "Materials", "Communication Services": "Communication Services", "Consumer Cyclical": "Consumer", "Consumer Defensive": "Consumer", "Real Estate": "Real Estate", Utilities: "Utilities" };
  return Object.hasOwn(map,raw) ? map[raw]! : "Unknown";
}
export function validateUniverseSnapshot(raw: unknown): UniverseSnapshot {
  if (!raw || typeof raw !== "object") throw new Error("INVALID_UNIVERSE");
  const v = raw as Record<string, unknown>;
  if (!UNIVERSE_KINDS.includes(v.kind as UniverseKind) || !isDiscoveryDay(v.asOf) || !text(v.source) || !text(v.id) || !text(v.label) || !Array.isArray(v.members) || v.members.length > 15000) throw new Error("INVALID_UNIVERSE_METADATA");
  for (const key of ["knownAt", "fetchedAt"]) if (typeof v[key] !== "string" || !Number.isFinite(Date.parse(v[key])) || !/Z$|[+-]\d\d:\d\d$/.test(v[key])) throw new Error("INVALID_KNOWLEDGE_TIME");
  if (v.authoritative !== true && ["SP500", "NASDAQ100"].includes(String(v.kind))) throw new Error("INDEX_MEMBERSHIP_MUST_BE_VERIFIED");
  if (["SP500","NASDAQ100"].includes(String(v.kind))) {
    let host="";try{host=new URL(String(v.sourceUrl)).hostname;}catch{throw new Error("OFFICIAL_INDEX_SOURCE_REQUIRED");}
    if (!/^(.*\.)?(spglobal\.com|nasdaq\.com|nasdaqtrader\.com)$/.test(host)) throw new Error("OFFICIAL_INDEX_SOURCE_REQUIRED");
  }
  const members: SecurityMember[] = [];
  const seen = new Set<string>();
  for (const row of v.members) {
    if (!row || typeof row !== "object") throw new Error("INVALID_MEMBER");
    const r = row as Record<string, unknown>;
    const symbol = text(r.symbol, 16).toUpperCase(), name = text(r.name);
    if (!["KR", "US"].includes(String(r.market)) || !(r.market === "KR" ? /^[0-9A-Z]{6}$/.test(symbol) : /^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) || !name || !EXCHANGES.has(String(r.exchange)) || !ASSETS.has(String(r.assetType))) throw new Error("INVALID_MEMBER_IDENTITY");
    if (v.kind === "KOSPI" && r.exchange !== "KOSPI" || v.kind === "KOSDAQ" && r.exchange !== "KOSDAQ" || v.kind === "NASDAQ_LISTED" && r.exchange !== "NASDAQ") throw new Error("MEMBERSHIP_EXCHANGE_MISMATCH");
    if (["KOSPI", "KOSDAQ"].includes(String(v.kind)) && r.market !== "KR" || ["SP500", "NASDAQ100", "NASDAQ_LISTED"].includes(String(v.kind)) && r.market !== "US") throw new Error("MEMBERSHIP_MARKET_MISMATCH");
    const sectorSource = text(r.sectorSource) || null;
    const member: SecurityMember = { market: r.market as SecurityMember["market"], symbol, name, exchange: r.exchange as SecurityMember["exchange"], sector: canonicalSector(text(r.sector), sectorSource), sectorSource,
      marketCap: numberOrNull(r.marketCap), indexWeight: numberOrNull(r.indexWeight), assetType: r.assetType as SecurityMember["assetType"], weight: numberOrNull(r.weight), identityVerified: r.identityVerified === true };
    if (member.weight !== null && member.weight > 100 || member.indexWeight !== null && member.indexWeight > 100) throw new Error("INVALID_WEIGHT");
    const key = securityKey(member); if (!seen.has(key)) { members.push(member); seen.add(key); }
  }
  const excludedHoldings = Array.isArray(v.excludedHoldings) ? v.excludedHoldings.slice(0,15000).flatMap((r:unknown)=>{
    if (!r || typeof r !== "object") return [];const row=r as Record<string,unknown>;
    return text(row.name)&&text(row.reason)?[{name:text(row.name),reason:text(row.reason),weight:numberOrNull(row.weight)}]:[];
  }) : undefined;
  return { id: text(v.id, 120), kind: v.kind as UniverseKind, label: text(v.label), asOf: String(v.asOf), knownAt: String(v.knownAt), fetchedAt: String(v.fetchedAt), source: text(v.source), sourceUrl: typeof v.sourceUrl === "string" && /^https:\/\//.test(v.sourceUrl) ? v.sourceUrl : null, authoritative: v.authoritative === true, historical: v.historical === true, members, ...(excludedHoldings ? {excludedHoldings} : {}), ...(Object.hasOwn(v,"rankAsOf")?{rankAsOf:typeof v.rankAsOf==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v.rankAsOf)?v.rankAsOf:null}:{}) };
}
/** Observed official Nasdaq exchange=nasdaq response, not index membership.
 * The tested 'index' query parameter is ignored by that endpoint and is never used. */
export function parseNasdaqListedUniverse(raw:unknown,now:string):UniverseSnapshot {
  const value=raw as {status?:{rCode?:number};data?:{totalrecords?:number;asof?:string;table?:{rows?:{symbol?:string;name?:string;marketCap?:string}[]}}};
  const rows=value?.data?.table?.rows;
  if(value?.status?.rCode!==200||!Array.isArray(rows)||!rows.length||value.data?.totalrecords!==rows.length)throw new Error("NASDAQ_LISTING_PARTIAL_OR_SCHEMA_FAILED");
  const match=/^Last price as of ([A-Za-z]{3}) (\d{1,2}), (\d{4})$/.exec(value.data.asof??"");
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const rankAsOf=match&&months.includes(match[1]!)?`${match[3]}-${String(months.indexOf(match[1]!)+1).padStart(2,"0")}-${match[2]!.padStart(2,"0")}`:null;
  const members:SecurityMember[]=[],excludedHoldings:{name:string;reason:string;weight:null}[]=[];
  for(const row of rows) {
    const symbol=row.symbol?.trim().toUpperCase()??"",name=row.name?.trim()??"";
    if(!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)||!name){excludedHoldings.push({name:name||"Unresolved Nasdaq row",reason:"security identity unsupported",weight:null});continue;}
    const equity=/Common Stock|Ordinary Shares|Common Shares|American Depositary|Depositary Shares|ADS/.test(name)&&!/Preferred|Warrant|Notes|Bond|Units|Rights/.test(name);
    const cap=typeof row.marketCap==="string"&&/^\d[\d,]*(\.\d+)?$/.test(row.marketCap)?Number(row.marketCap.replaceAll(",","")):null;
    members.push({market:"US",symbol,name,exchange:"NASDAQ",sector:"Unknown",sectorSource:null,marketCap:cap,indexWeight:null,weight:null,identityVerified:true,assetType:equity?"equity":"unknown"});
  }
  const asOf=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));
  return validateUniverseSnapshot({id:`NASDAQ_LISTED:${now}`,kind:"NASDAQ_LISTED",label:"Nasdaq Listed",asOf,rankAsOf,knownAt:now,fetchedAt:now,source:"Nasdaq official listed stock screener; observed current membership, marketCap USD",sourceUrl:"https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&exchange=nasdaq",authoritative:true,historical:false,members,excludedHoldings});
}
export function validTopOptions(kind: UniverseKind): TopChoice[] {
  return kind === "NASDAQ100" ? [10, 20, 50, "ALL"] : kind === "ETF" ? [10, 20, 50, "ALL"] : [10, 20, 50, 100, 200, "ALL"];
}
export function selectUniverse(snapshot: UniverseSnapshot, selection: UniverseSelection) {
  if (!validTopOptions(snapshot.kind).includes(selection.top)) throw new Error("INVALID_TOP_N");
  const supported = snapshot.members.filter(s => s.assetType === "equity" && s.identityVerified);
  const excluded = snapshot.members.filter(s => s.assetType !== "equity" || !s.identityVerified);
  const indexWeights = ["SP500", "NASDAQ100"].includes(snapshot.kind) && supported.length > 0 && supported.every(s => s.indexWeight !== null);
  const rankingBasis = snapshot.kind === "ETF" ? "official-holding-weight" : indexWeights ? "index-weight" : "market-cap";
  let selected = supported.filter(s => (!selection.sectors.length || selection.sectors.includes(s.sector)) && (snapshot.kind !== "ETF" || selection.minWeight === 0 || s.weight !== null && s.weight >= selection.minWeight));
  const rank = (s: SecurityMember) => rankingBasis === "official-holding-weight" ? s.weight : rankingBasis === "index-weight" ? s.indexWeight : s.marketCap;
  const missingRanks = selected.filter(s => rank(s) === null).length;
  // Top-N is meaningful only with observed ranks. ALL may retain unknown caps.
  if (selection.top !== "ALL") selected = selected.filter(s => rank(s) !== null);
  selected.sort((a, b) => (rank(b) ?? -1) - (rank(a) ?? -1) || securityKey(a).localeCompare(securityKey(b)));
  if (selection.top !== "ALL") selected = selected.slice(0, selection.top);
  const knownWeight = supported.reduce((n, s) => n + (s.weight ?? 0), 0);
  const selectedWeight = selected.reduce((n, s) => n + (s.weight ?? 0), 0);
  return { selected, excluded, rankingBasis, missingRanks, supportedCount: supported.length, excludedCount: excluded.length+(snapshot.excludedHoldings?.length??0),
    knownWeight, selectedWeight, weightCoverageKnown: supported.every(s => s.weight !== null),
    // No normalization of partial disclosed holdings to 100%.
    researchOnly: !snapshot.historical, warnings: [!snapshot.historical ? "SURVIVORSHIP-BIASED / RESEARCH ONLY: 현재 편입 스냅샷" : "", missingRanks ? `${missingRanks}개 순위 기준 미확보` : "", snapshot.kind === "ETF" && knownWeight < 100 ? "보유비중은 원자료 기준이며 100%로 재정규화하지 않음" : ""].filter(Boolean) };
}
/** Knowledge time and effective date both bound historical selection. Never use future membership. */
export function universeAt(snapshots: readonly UniverseSnapshot[], date: string, knownAt: string, allowCurrentResearch = false): { snapshot: UniverseSnapshot | null; biased: boolean } {
  const available = snapshots.filter(s => s.asOf <= date && s.knownAt <= knownAt && s.historical).sort((a, b) => b.asOf.localeCompare(a.asOf) || b.knownAt.localeCompare(a.knownAt));
  if (available[0]) return { snapshot: available[0], biased: false };
  return { snapshot: allowCurrentResearch ? [...snapshots].sort((a, b) => b.asOf.localeCompare(a.asOf))[0] ?? null : null, biased: allowCurrentResearch };
}
