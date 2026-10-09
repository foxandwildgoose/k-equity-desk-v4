/** Server-only operator settings. Never resolve or serialize the secret value for the UI. */
export type CloudTarget = "KOSPI" | "KOSDAQ" | "NASDAQ_LISTED" | `ETF:${string}`;
export function readBollingerCloudConfig(env:Record<string,string|undefined>=process.env) {
  const raw=(env.BOLLINGER_CLOUD_TARGETS??"KOSPI").split(",").map(s=>s.trim()).filter(Boolean);
  const targets=[...new Set(raw)].slice(0,4);
  const validTargets=raw.length>0&&raw.length<=4&&targets.every(s=>["KOSPI","KOSDAQ","NASDAQ_LISTED"].includes(s)||/^ETF:[0-9A-Z]{6}$/.test(s));
  const rawTop=env.BOLLINGER_CLOUD_TOP??"20",top=rawTop==="ALL"?"ALL":Number(rawTop);
  const validTop=(top==="ALL"||[10,20,50,100,200].includes(top))&&(!targets.some(t=>t.startsWith("ETF:"))||top==="ALL"||[10,20,50].includes(top));
  const budget=Number(env.BOLLINGER_CLOUD_BUDGET_SECONDS??180);
  const validBudget=Number.isInteger(budget)&&budget>=20&&budget<=240;
  const secretConfigured=!!env.CRON_SECRET?.trim();
  const secretValid=secretConfigured&&env.CRON_SECRET!.length>=32&&env.CRON_SECRET!.length<=256&&!/[\s\r\n]/.test(env.CRON_SECRET!);
  return {enabled:env.BOLLINGER_CLOUD_ENABLED==="true",secretConfigured,secretValid,configurationValid:validTargets&&validTop&&validBudget,
    targets:(validTargets?targets:[]) as CloudTarget[],top:(validTop?top:20) as 10|20|50|100|200|"ALL",budgetSeconds:validBudget?budget:180,
    mode:"vercel-bounded" as const,recentStoredDays:25};
}
export type BollingerCloudConfig = ReturnType<typeof readBollingerCloudConfig>;
export const cloudJobScope = (target:CloudTarget,top:BollingerCloudConfig["top"]) => `bollinger:cloud:v1:${target}:${top}`;
/** Allowlisted public status, never the raw job summary or runtime environment. */
export function safeCloudJob(summary:Record<string,unknown>|null,target:CloudTarget,leaseActive=false) {
  const count=(name:string)=>typeof summary?.[name]==="number"&&Number.isFinite(summary[name])?Math.max(0,summary[name] as number):0;
  const phases=["membership","benchmarks","collect","refresh","complete","complete-with-errors"];
  const failures=["MEMBERSHIP_FAILED","KR_MEMBERSHIP_CHANGED_RESTART_REQUIRED","BENCHMARK_FAILED","PRICE_FETCH_FAILED","NO_HISTORY","COMPUTE_FAILED","DATABASE_QUERY_FAILED","LEASE_LOST","NO_SELECTION","SELECTION_INVALID","UNIVERSE_UNSUPPORTED"];
  const phase=phases.includes(String(summary?.phase))?String(summary?.phase):"not-started";
  const terminal=phase==="complete"||phase==="complete-with-errors";
  const execution=phase==="not-started"?"NOT_STARTED":leaseActive?"RUNNING":terminal?"COMPLETE":summary?.execution==="FAILED"||summary?.lastError?"FAILED":summary?.budgetStopped===true||summary?.execution==="PAUSED"?"PAUSED":"INTERRUPTED";
  return {target,phase,execution,requested:count("requested"),supported:count("supported"),nextOffset:count("nextOffset"),collected:Array.isArray(summary?.successfulKeys)?summary.successfulKeys.length:0,
    computedSymbols:summary?.schema===2&&Array.isArray(summary?.computedKeys)?[...new Set(summary.computedKeys.filter((value):value is string=>typeof value==="string"&&/^(KR:[0-9A-Z]{6}|US:[A-Z][A-Z0-9.-]{0,14})$/.test(value)))].slice(0,15000):null,
    computed:summary?.schema===1&&!terminal?0:Array.isArray(summary?.computedKeys)?summary.computedKeys.length:0,errors:Array.isArray(summary?.errors)?summary.errors.length:0,
    stockErrors:Array.isArray(summary?.errors)?summary.errors.flatMap(value=>{if(!value||typeof value!=="object")return [];const error=value as Record<string,unknown>;return typeof error.symbol==="string"&&/^(KR:[0-9A-Z]{6}|US:[A-Z][A-Z0-9.-]{0,14})$/.test(error.symbol)&&["PRICE_FETCH_FAILED","NO_HISTORY","COMPUTE_FAILED"].includes(String(error.code))?[{symbol:error.symbol,code:String(error.code)}]:[];}).slice(0,15000):[],
    provisional:Array.isArray(summary?.provisionalKeys)?summary.provisionalKeys.length:summary?.schema===1&&Array.isArray(summary?.computedKeys)?summary.computedKeys.length:0,pendingCompute:summary?.schema===1&&phase==="refresh"&&Array.isArray(summary?.successfulKeys)?summary.successfulKeys.length:Array.isArray(summary?.pendingCompute)?summary.pendingCompute.length:0,
    universeId:typeof summary?.universeId==="string"?summary.universeId:null,configVersion:typeof summary?.configVersion==="string"?summary.configVersion:null,
    benchmarkFailures:summary?.benchmarkStatus&&typeof summary.benchmarkStatus==="object"?Object.values(summary.benchmarkStatus).filter(s=>s!=="received").length:0,
    membershipRows:count("membershipRows"),membershipTotal:count("membershipTotal"),
    lastRunAt:typeof summary?.lastRunAt==="string"&&Number.isFinite(Date.parse(summary.lastRunAt))?summary.lastRunAt:null,
    lastError:failures.includes(String(summary?.lastError))?String(summary?.lastError):null,
    budgetStopped:summary?.budgetStopped===true,top:summary?.top==="ALL"?"ALL":typeof summary?.top==="number"?summary.top:null};
}
