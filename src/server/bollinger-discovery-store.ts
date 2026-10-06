import type { Sql } from "../lib/db.ts";
import type { Candidate, Context, DiscoveryEvent, Strategy } from "../lib/bollinger/discovery.ts";
import { selectUniverse, type UniverseSelection, type UniverseSnapshot, type SecurityMember } from "../lib/bollinger/discovery-universe.ts";
import type { BollingerBar } from "../lib/bollinger/types.ts";
import type { eventStudy } from "../lib/bollinger/discovery-backtest.ts";
import { isDiscoveryDay } from "../lib/bollinger/discovery-dates.ts";

export type StoredCandidate = Candidate & { market: "KR" | "US"; symbol: string; name: string; sector: string; source: string; priceBasis: string; computedAt: string; universeId:string; configVersion:string };
export type DiscoveryQuery = { universeId: string; configVersion: string; strategy: Strategy; selection: UniverseSelection; page: number; pageSize: 25 | 50 | 100; minScore: number; minCoverage: number; asOf: string; symbols?: string[]; sort?: "score" | "distance" | "rs" };
export function createDiscoveryStore(sql: Pick<Sql, "query">) {
  return {
    async schemaReady() { const rows = await sql.query<{ ready: boolean }>("SELECT bool_and(to_regclass(t) IS NOT NULL) AS ready FROM unnest(ARRAY['bollinger_universes','bollinger_members','bollinger_daily_bars','bollinger_context','bollinger_features','bollinger_signal_events','bollinger_jobs','bollinger_job_leases','bollinger_backtests']) t"); return rows[0]?.ready === true; },
    async saveUniverse(snapshot: UniverseSnapshot) {
      const old = await this.universe(snapshot.id);
      if (old && !(await sql.query<{same:boolean}>("SELECT payload=$2::jsonb AS same FROM bollinger_universes WHERE id=$1",[snapshot.id,JSON.stringify(snapshot)]))[0]?.same) throw new Error("IMMUTABLE_UNIVERSE_ID_CONFLICT");
      // One SQL statement: metadata + members commit together even on pooled connections.
      await sql.query(`WITH inserted AS (
        INSERT INTO bollinger_universes(id,kind,as_of,known_at,source,payload) VALUES($1,$2,$3,$4,$5,$6::jsonb)
        ON CONFLICT(id) DO NOTHING RETURNING id
      ) INSERT INTO bollinger_members(universe_id,market,symbol,name,sector,market_cap,index_weight,holding_weight,asset_type,verified,payload)
      SELECT $1,r->>'market',r->>'symbol',r->>'name',r->>'sector',(r->>'marketCap')::float8,(r->>'indexWeight')::float8,(r->>'weight')::float8,r->>'assetType',(r->>'identityVerified')::boolean,r
      FROM jsonb_array_elements($6::jsonb->'members') r WHERE EXISTS(SELECT 1 FROM inserted) ON CONFLICT DO NOTHING`, [snapshot.id, snapshot.kind, snapshot.asOf, snapshot.knownAt, snapshot.source, JSON.stringify(snapshot)]);
    },
    async universes() { return (await sql.query<{ payload: UniverseSnapshot }>("SELECT DISTINCT ON (kind,payload->>'label') payload FROM bollinger_universes ORDER BY kind,payload->>'label',as_of DESC,known_at DESC")).map(r => r.payload); },
    async universe(id: string): Promise<UniverseSnapshot | null> { return (await sql.query<{ payload: UniverseSnapshot }>("SELECT payload FROM bollinger_universes WHERE id=$1", [id]))[0]?.payload ?? null; },
    async universeHistory(kind: string, label: string) { return (await sql.query<{ payload: UniverseSnapshot }>("SELECT payload FROM bollinger_universes WHERE kind=$1 AND payload->>'label'=$2 ORDER BY as_of,known_at", [kind, label])).map(r => r.payload); },
    async configurations() { return (await sql.query<{config_version:string}>("SELECT DISTINCT config_version FROM bollinger_features ORDER BY config_version LIMIT 100")).map(r=>r.config_version); },
    async saveBars(member: Pick<SecurityMember, "market" | "symbol">, bars: readonly BollingerBar[], source: string, basis: string, knownAt: string) {
      const valid = [...new Map(bars.filter(b => b.completed === true && isDiscoveryDay(b.date) && [b.open,b.high,b.low,b.close].every(n => Number.isFinite(n) && n > 0) && b.high >= Math.max(b.open,b.close) && b.low <= Math.min(b.open,b.close)).map(b=>[b.date,b])).values()];
      if (!valid.length) return 0;
      await sql.query(`INSERT INTO bollinger_daily_bars(market,symbol,price_basis,day,source,known_at,payload)
      SELECT $1,$2,$3,(r->>'date')::date,$4,$5,r FROM jsonb_array_elements($6::jsonb) r
      ON CONFLICT(market,symbol,price_basis,day) DO UPDATE SET payload=EXCLUDED.payload,source=EXCLUDED.source,known_at=EXCLUDED.known_at,fetched_at=now()`, [member.market, member.symbol, basis, source, knownAt, JSON.stringify(valid)]);
      return valid.length;
    },
    async bars(market: string, symbol: string, basis: string, end = "9999-12-31") { return (await sql.query<{ payload: BollingerBar }>("SELECT payload FROM (SELECT day,payload FROM bollinger_daily_bars WHERE market=$1 AND symbol=$2 AND price_basis=$3 AND day<=$4 ORDER BY day DESC LIMIT 5000) b ORDER BY day", [market, symbol, basis, end])).map(r => r.payload); },
    async saveContext(universeId: string, scope: string, contexts: Context[]) {
      if (!contexts.length) return;
      await sql.query(`INSERT INTO bollinger_context(universe_id,day,scope,source,payload) SELECT $1,(r->>'asOf')::date,$2,r->>'source',r FROM jsonb_array_elements($3::jsonb) r ON CONFLICT(universe_id,day,scope) DO UPDATE SET payload=EXCLUDED.payload,source=EXCLUDED.source`, [universeId,scope,JSON.stringify(contexts)]);
    },
    async contexts(universeId: string) { return sql.query<{ scope: string; payload: Context }>("SELECT scope,payload FROM bollinger_context WHERE universe_id=$1 ORDER BY day", [universeId]); },
    async contextScope(universeId:string,scope:string) { return (await sql.query<{payload:Context}>("SELECT payload FROM bollinger_context WHERE universe_id=$1 AND scope=$2 ORDER BY day",[universeId,scope])).map(r=>r.payload); },
    async barMetadata(member:SecurityMember) { return sql.query<{price_basis:string;source:string;day:string;fetched_at:string}>("SELECT DISTINCT ON(price_basis) price_basis,source,day::text,fetched_at::text FROM bollinger_daily_bars WHERE market=$1 AND symbol=$2 ORDER BY price_basis,day DESC,fetched_at DESC",[member.market,member.symbol]); },
    /** Server aggregation over stored observations; no full-market history in process memory. */
    async aggregateContexts(universeId:string,usBenchmark:string) {
      await sql.query(`INSERT INTO bollinger_context(universe_id,day,scope,source,payload)
      SELECT $1,c.day,'sector:'||m.market||':'||m.sector,'median stored constituent returns',jsonb_build_object(
        'asOf',c.day::text,'source',CASE WHEN (u.payload->>'historical')::boolean THEN 'PIT eligible median constituents' ELSE 'current membership median / RESEARCH ONLY' END,
        'return20',percentile_cont(0.5) WITHIN GROUP(ORDER BY (c.payload->>'return20')::float8),
        'return63',percentile_cont(0.5) WITHIN GROUP(ORDER BY (c.payload->>'return63')::float8),
        'aboveSma200',CASE WHEN count(c.payload->>'aboveSma200')>=3 THEN avg((c.payload->>'aboveSma200')::boolean::int)>.5 ELSE NULL END,
        'slope200',CASE WHEN count(c.payload->>'slope200')>=3 THEN percentile_cont(0.5) WITHIN GROUP(ORDER BY (c.payload->>'slope200')::float8) ELSE NULL END)
      FROM bollinger_context c JOIN bollinger_members m ON m.universe_id=c.universe_id AND c.scope='security:'||m.market||':'||m.symbol
      JOIN bollinger_universes u ON u.id=c.universe_id
      WHERE c.universe_id=$1 AND m.sector<>'Unknown' AND m.verified AND m.asset_type='equity'
      AND (NOT (u.payload->>'historical')::boolean OR (u.as_of<=c.day AND u.known_at<=c.day::timestamp AT TIME ZONE 'UTC'))
      GROUP BY c.day,m.market,m.sector,u.payload
      HAVING count(c.payload->>'return20')>=3 AND count(c.payload->>'return63')>=3
      ON CONFLICT(universe_id,day,scope) DO UPDATE SET payload=EXCLUDED.payload,source=EXCLUDED.source`,[universeId]);
      await sql.query(`WITH strengths AS (
        SELECT scope,day,split_part(scope,':',2) AS market,(payload->>'return63')::float8 AS strength
        FROM bollinger_context WHERE universe_id=$1 AND scope LIKE 'sector:%' AND payload->>'return63' IS NOT NULL
      ), ranks AS (SELECT scope,day,(rank() OVER(PARTITION BY market,day ORDER BY strength)-1+.5*count(*) OVER(PARTITION BY market,day,strength))/count(*) OVER(PARTITION BY market,day)*100 AS percentile,count(*) OVER(PARTITION BY market,day) AS samples FROM strengths)
      UPDATE bollinger_context c SET payload=c.payload||jsonb_build_object('rsPercentile',CASE WHEN r.samples>=3 THEN r.percentile ELSE NULL END)
      FROM ranks r WHERE c.universe_id=$1 AND c.scope=r.scope AND c.day=r.day`,[universeId]);
      await sql.query(`WITH strengths AS (
        SELECT c.scope,c.day,m.market,(c.payload->>'return63')::float8-(b.payload->>'return63')::float8 AS rs
        FROM bollinger_context c JOIN bollinger_members m ON m.universe_id=c.universe_id AND c.scope='security:'||m.market||':'||m.symbol
        JOIN bollinger_context b ON b.universe_id=c.universe_id AND b.day=c.day AND b.scope='market:'||CASE WHEN m.market='US' THEN $2 WHEN m.payload->>'exchange'='KOSDAQ' THEN 'KOSDAQ' ELSE 'KOSPI' END
        WHERE c.universe_id=$1 AND m.asset_type='equity' AND m.verified AND c.payload->>'return63' IS NOT NULL AND b.payload->>'return63' IS NOT NULL
      ), ranks AS (SELECT scope,day,(rank() OVER(PARTITION BY market,day ORDER BY rs)-1+.5*count(*) OVER(PARTITION BY market,day,rs))/count(*) OVER(PARTITION BY market,day)*100 AS percentile,count(*) OVER(PARTITION BY market,day) AS samples FROM strengths)
      UPDATE bollinger_context c SET payload=c.payload||jsonb_build_object('rsPercentile',CASE WHEN r.samples>=5 THEN r.percentile ELSE NULL END)
      FROM ranks r WHERE c.universe_id=$1 AND c.scope=r.scope AND c.day=r.day`,[universeId,usBenchmark]);
    },
    async saveFeatures(universeId: string, member: SecurityMember, version: string, candidates: Candidate[], source: string, basis: string) {
      if (!candidates.length) return;
      await sql.query(`INSERT INTO bollinger_features(universe_id,config_version,market,symbol,day,state,score,coverage,views,valid,source,price_basis,payload)
      SELECT $1,$2,$3,$4,(r->>'date')::date,r->>'state',(r->'score'->>'value')::float8,(r->'score'->>'coverage')::float8,r->'views',(r->>'valid')::boolean,$5,$6,r
      FROM jsonb_array_elements($7::jsonb) r ON CONFLICT(universe_id,config_version,market,symbol,day) DO UPDATE SET
      state=EXCLUDED.state,score=EXCLUDED.score,coverage=EXCLUDED.coverage,views=EXCLUDED.views,valid=EXCLUDED.valid,source=EXCLUDED.source,price_basis=EXCLUDED.price_basis,payload=EXCLUDED.payload,computed_at=now()`, [universeId,version,member.market,member.symbol,source,basis,JSON.stringify(candidates)]);
    },
    async featureHistory(universeId:string,member:SecurityMember,version:string) { return sql.query<{payload:Candidate;price_basis:string}>("SELECT payload,price_basis FROM bollinger_features WHERE universe_id=$1 AND market=$2 AND symbol=$3 AND config_version=$4 ORDER BY day",[universeId,member.market,member.symbol,version]); },
    async saveEvents(universeId: string, member: SecurityMember, version: string, events: DiscoveryEvent[]) {
      if (!events.length) return;
      await sql.query(`INSERT INTO bollinger_signal_events(id,universe_id,market,symbol,day,config_version,signal,payload)
      SELECT r->>'id',$1,$2,$3,(r->>'date')::date,$4,r->>'type',r FROM jsonb_array_elements($5::jsonb) r ON CONFLICT(id) DO NOTHING`, [universeId,member.market,member.symbol,version,JSON.stringify(events)]);
    },
    async events(universeId: string,version?:string) { return sql.query<{ market: string; symbol: string; payload: DiscoveryEvent; delivery_status: string }>("SELECT e.market,e.symbol,e.payload,e.delivery_status FROM bollinger_signal_events e JOIN bollinger_members m ON m.universe_id=$1 AND m.market=e.market AND m.symbol=e.symbol WHERE ($2::text IS NULL OR e.config_version=$2) ORDER BY e.day DESC,e.detected_at DESC LIMIT 100", [universeId,version??null]); },
    async query(q: DiscoveryQuery) {
      const universe = await this.universe(q.universeId);
      if (!universe) throw new Error("UNIVERSE_MISSING");
      const selection = selectUniverse(universe, q.selection);
      const selectedKeys = selection.selected.map(m => `${m.market}:${m.symbol}`).filter(k => q.symbols === undefined || q.symbols.includes(k));
      const params: unknown[] = [q.universeId,q.configVersion,q.asOf,selectedKeys];
      const latest = `WITH latest AS (SELECT DISTINCT ON (market,symbol) * FROM bollinger_features WHERE universe_id=$1 AND config_version=$2 AND day<=$3 AND market||':'||symbol=ANY($4::text[]) ORDER BY market,symbol,day DESC)`;
      const counts = await sql.query<{ state: string; count: number }>(`${latest} SELECT state,count(*)::int AS count FROM latest GROUP BY state`,params);
      const pipeline=(await sql.query<{investible:number;bullish:number;compressed:number;preBreakout:number}>(`${latest} SELECT count(*) FILTER(WHERE valid)::int AS investible,count(*) FILTER(WHERE valid AND (payload->'gates'->>'bullish')::boolean)::int AS bullish,count(*) FILTER(WHERE valid AND (payload->'gates'->>'bullish')::boolean AND (payload->'gates'->>'compressed')::boolean)::int AS compressed,count(*) FILTER(WHERE valid AND (payload->'gates'->>'compressed')::boolean AND (payload->'gates'->>'preBreakout')::boolean)::int AS "preBreakout" FROM latest`,params))[0];
      const sourceDates = await sql.query<{ first: string | null; last: string | null; stored: number }>(`${latest} SELECT min(day)::text AS first,max(day)::text AS last,count(*)::int AS stored FROM latest`,params);
      params.push(q.strategy,q.minScore,q.minCoverage);
      // A four-calendar-day freshness display is conservative; no fabricated holiday calendar.
      const filter = `WHERE f.views ? $5 AND f.score >= $6 AND f.coverage >= $7 AND f.valid AND f.day >= $3::date - INTERVAL '4 days'`;
      const total = (await sql.query<{ count: number }>(`${latest} SELECT count(*)::int AS count FROM latest f ${filter}`,params))[0]?.count ?? 0;
      const sort = q.sort === "distance" ? "(f.payload->>'distance')::float8 ASC NULLS LAST" : q.sort === "rs" ? "(f.payload->>'rsPercentile')::float8 DESC NULLS LAST" : "f.score DESC NULLS LAST";
      const rows = await sql.query<{ payload: Candidate; market: "KR" | "US"; symbol: string; name: string; sector: string; source: string; price_basis: string; computed_at: string }>(`${latest} SELECT f.payload,f.market,f.symbol,m.name,m.sector,f.source,f.price_basis,f.computed_at FROM latest f JOIN bollinger_members m ON m.universe_id=f.universe_id AND m.market=f.market AND m.symbol=f.symbol ${filter} ORDER BY ${sort},f.market,f.symbol LIMIT $8 OFFSET $9`, [...params,q.pageSize,(q.page-1)*q.pageSize]);
      return { rows: rows.map(r => ({ ...r.payload, market:r.market,symbol:r.symbol,name:r.name,sector:r.sector,source:r.source,priceBasis:r.price_basis,computedAt:r.computed_at,universeId:q.universeId,configVersion:q.configVersion } as StoredCandidate)), total, counts, pipeline, selection: { ...selection, selected: undefined, excluded: selection.excluded.slice(0,50).map(m => ({ name:m.name,reason:m.assetType === "equity" ? "identity-unverified" : m.assetType })) }, universe: { ...universe, members: undefined, excludedHoldings: undefined }, dates:sourceDates[0], requestedCount:selectedKeys.length };
    },
    async lease(scope: string, token: string, seconds = 900) { const rows = await sql.query("INSERT INTO bollinger_job_leases(scope,token,expires_at) VALUES($1,$2,now()+$3*interval '1 second') ON CONFLICT(scope) DO UPDATE SET token=EXCLUDED.token,expires_at=EXCLUDED.expires_at WHERE bollinger_job_leases.expires_at < now() RETURNING token",[scope,token,seconds]); return rows.length === 1; },
    async renew(scope: string, token: string, seconds = 900) { return (await sql.query("UPDATE bollinger_job_leases SET expires_at=now()+$3*interval '1 second' WHERE scope=$1 AND token=$2 AND expires_at>now() RETURNING token",[scope,token,seconds])).length === 1; },
    async release(scope: string, token: string) { await sql.query("DELETE FROM bollinger_job_leases WHERE scope=$1 AND token=$2",[scope,token]); },
    async startJob(id: string, scope: string) { await sql.query("INSERT INTO bollinger_jobs(id,scope,status) VALUES($1,$2,'running') ON CONFLICT(id) DO UPDATE SET status='running',finished_at=NULL WHERE bollinger_jobs.scope=EXCLUDED.scope",[id,scope]); },
    async endJob(id: string, status: string, summary: unknown) { await sql.query("UPDATE bollinger_jobs SET status=$2,summary=$3::jsonb,finished_at=CASE WHEN $2='running' THEN NULL ELSE now() END WHERE id=$1",[id,status,JSON.stringify(summary)]); },
    async jobs(universeId: string) { return sql.query<{status:string;started_at:string;finished_at:string|null}>("SELECT status,started_at::text,finished_at::text FROM bollinger_jobs WHERE scope=$1 ORDER BY started_at DESC LIMIT 10",[universeId]); },
    async job(id:string) { return (await sql.query<{id:string;scope:string;status:string;summary:{nextOffset?:number;errors?:{symbol:string;code:string}[]}}>("SELECT id,scope,status,summary FROM bollinger_jobs WHERE id=$1",[id]))[0]??null; },
    async latestJob(scope:string) { return (await sql.query<{id:string;status:string;summary:Record<string,unknown>}>("SELECT id,status,summary FROM bollinger_jobs WHERE scope=$1 ORDER BY started_at DESC,id DESC LIMIT 1",[scope]))[0]??null; },
    async checkpoints(universeId:string) { return sql.query<{id:string;status:string;summary:{nextOffset?:number;errors?:{symbol:string;code:string}[]}}>("SELECT id,status,summary FROM bollinger_jobs WHERE scope=$1 ORDER BY started_at DESC LIMIT 10",[universeId]); },
    async saveBacktest(id: string, universeId: string, version: string, start: string, end: string, biased: boolean, report: unknown) { await sql.query("INSERT INTO bollinger_backtests(id,universe_id,config_version,start_day,end_day,research_only,payload) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT(id) DO NOTHING",[id,universeId,version,start,end,biased,JSON.stringify(report)]); },
    async evidence(universeId: string, version: string) { return (await sql.query<{ payload: ReturnType<typeof eventStudy> }>("SELECT payload FROM bollinger_backtests WHERE universe_id=$1 AND config_version=$2 ORDER BY created_at DESC LIMIT 1",[universeId,version]))[0]?.payload ?? null; },
  };
}
export type DiscoveryStore = ReturnType<typeof createDiscoveryStore>;
/** Explicit persistent backend requirement. Never silently use preview memory for operational snapshots. */
export async function getDiscoveryStore(): Promise<DiscoveryStore> {
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_MISSING");
  const { getSql } = await import("../lib/db.ts");
  const store = createDiscoveryStore(await getSql());
  if (!await store.schemaReady()) throw new Error("MIGRATION_0005_REQUIRED");
  return store;
}
