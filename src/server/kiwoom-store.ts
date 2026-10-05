import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "../lib/db.ts";
import type {
  FlowMetricId,
  FlowObservation,
  FlowRequest,
  FlowStatus,
} from "../lib/charts/hts-flow.ts";
import { KiwoomError } from "./kiwoom-config.ts";
import { waitKiwoom, type KiwoomCoordination } from "./kiwoom-client.ts";
import { createKiwoomTargets } from "./kiwoom-targets.ts";
import { createKiwoomCollectorRuntime } from "./kiwoom-collector-runtime.ts";

export interface FlowIdentity {
  scopeId: string;
  environment: "real" | "mock";
  request: FlowRequest;
}
export interface KiwoomJob {
  status: FlowStatus;
  stopReason: string;
  pages: number;
  rows: number;
  invalidRows: number;
  oldestDate: string | null;
  newestDate: string | null;
  nextKey: string | null;
  complete: boolean;
  updatedAt: string;
  lastSuccessAt: string | null;
  errorCode: number | null;
  missingDates?: string[] | null;
  calendarBasis?: string;
  requestedFrom?: string;
  requestedTo?: string;
}
export interface KiwoomFlowStore extends KiwoomCoordination {
  schema(): Promise<KiwoomSchemaStatus>;
  read(identity: FlowIdentity, metric: FlowMetricId): Promise<FlowObservation[]>;
  upsert(
    identity: FlowIdentity,
    metric: FlowMetricId,
    observations: FlowObservation[],
  ): Promise<void>;
  job(identity: FlowIdentity, metric: FlowMetricId, exact?: boolean): Promise<KiwoomJob | null>;
  saveJob(identity: FlowIdentity, metric: FlowMetricId, job: KiwoomJob): Promise<void>;
  targets: ReturnType<typeof createKiwoomTargets>;
  /** Optional telemetry migration never changes the four-table market-data readiness contract. */
  collectorRuntime?: ReturnType<typeof createKiwoomCollectorRuntime>;
  hasOtherScope(identity: FlowIdentity, metric: FlowMetricId): Promise<boolean>;
  copyLegacyScope(from: string, to: string, environment: string): Promise<number>;
}
export interface KiwoomSchemaStatus {
  observations: boolean;
  jobs: boolean;
  coordination: boolean;
  targets: boolean;
  ready: boolean;
  migrationRecorded: boolean | null;
}
/** Read-only: do not make a diagnostic request an implicit schema migration. */
export async function inspectKiwoomSchema(sql: Sql): Promise<KiwoomSchemaStatus> {
  const [row] = await sql.query<{
    observations: boolean;
    jobs: boolean;
    coordination: boolean;
    targets: boolean;
    migrations: boolean;
  }>(
    `select to_regclass('kiwoom_flow_observations') is not null as observations,
      to_regclass('kiwoom_flow_jobs') is not null as jobs,
      to_regclass('kiwoom_flow_coordination') is not null as coordination,
      to_regclass('kiwoom_collection_targets') is not null as targets,
      to_regclass('_migrations') is not null as migrations`,
  );
  const migrationRecorded = row?.migrations
    ? ((
        await sql.query<{ recorded: boolean }>(
          "select exists(select 1 from _migrations where name=$1) as recorded",
          ["0002_kiwoom_flow.sql"],
        )
      )[0]?.recorded ?? false)
    : null;
  return {
    observations: Boolean(row?.observations),
    jobs: Boolean(row?.jobs),
    coordination: Boolean(row?.coordination),
    targets: Boolean(row?.targets),
    ready: Boolean(row?.observations && row.jobs && row.coordination && row.targets),
    migrationRecorded,
  };
}
export function kiwoomJobKey(identity: FlowIdentity, metric: FlowMetricId): string {
  const { request: r } = identity;
  return createHash("sha256")
    .update(
      JSON.stringify([
        "kiwoom-job-v1",
        identity.scopeId,
        identity.environment,
        r.code,
        r.instrument,
        r.flowScope ?? "KRX",
        metric,
        r.from,
        r.to,
      ]),
    )
    .digest("hex");
}
/** Uses the existing Sql interface on PostgreSQL/PGlite; no second ORM or production memory fallback. */
export function createKiwoomStore(sql: Sql): KiwoomFlowStore {
  const params = (identity: FlowIdentity, metric: FlowMetricId) => [
    identity.scopeId,
    identity.environment,
    identity.request.code,
    identity.request.instrument,
    identity.request.flowScope ?? "KRX",
    metric,
  ];
  const store = {
    schema: () => inspectKiwoomSchema(sql),
    async hasOtherScope(identity, metric) {
      const [row] = await sql.query<{ found: boolean }>(`select exists(select 1 from kiwoom_flow_observations
        where scope_id<>$1 and provider='kiwoom' and environment=$2 and code=$3 and instrument=$4 and market_scope=$5 and metric=$6
        and date >= $7::date and date <= $8::date and value is not null) as found`,
        [...params(identity, metric), identity.request.from, identity.request.to]);
      return Boolean(row?.found);
    },
    async copyLegacyScope(from, to, environment) {
      if (from === to) return 0;
      const rows = await sql.query(`insert into kiwoom_flow_observations
        (scope_id,provider,environment,code,instrument,market_scope,metric,unit,date,value,observation,fetched_at,parsing_status)
        select $2,provider,environment,code,instrument,market_scope,metric,unit,date,value,observation,fetched_at,parsing_status
        from kiwoom_flow_observations where scope_id=$1 and environment=$3
        on conflict(scope_id,provider,environment,code,instrument,market_scope,metric,unit,date)
        do update set value=excluded.value,observation=excluded.observation,fetched_at=excluded.fetched_at,parsing_status=excluded.parsing_status
        where excluded.fetched_at>=kiwoom_flow_observations.fetched_at and (excluded.value is not null or kiwoom_flow_observations.value is null)
        returning date`, [from, to, environment]);
      return rows.length;
    },
    async read(identity, metric) {
      const rows = await sql.query<{ observation: FlowObservation }>(
        `select observation from kiwoom_flow_observations
        where scope_id=$1 and provider='kiwoom' and environment=$2 and code=$3 and instrument=$4 and market_scope=$5 and metric=$6
        and date >= $7::date and date <= $8::date order by date`,
        [...params(identity, metric), identity.request.from, identity.request.to],
      );
      return rows.map((row) => row.observation);
    },
    async upsert(identity, metric, observations) {
      if (!observations.length) return;
      // One atomic batch. A transient malformed value never erases the last valid observation.
      await sql.query(
        `insert into kiwoom_flow_observations
        (scope_id,provider,environment,code,instrument,market_scope,metric,unit,date,value,observation,fetched_at,parsing_status)
        select $1,'kiwoom',$2,$3,$4,$5,$6,x->>'unit',(x->>'date')::date,(x->>'value')::double precision,x,(x->>'fetchedAt')::timestamptz,x->>'parsingStatus'
        from jsonb_array_elements($7::jsonb) x
        on conflict (scope_id,provider,environment,code,instrument,market_scope,metric,unit,date)
        do update set value=excluded.value, observation=excluded.observation, fetched_at=excluded.fetched_at,parsing_status=excluded.parsing_status
        where excluded.fetched_at >= kiwoom_flow_observations.fetched_at
          and (excluded.value is not null or kiwoom_flow_observations.value is null)`,
        [...params(identity, metric), JSON.stringify(observations)],
      );
    },
    async job(identity, metric, exact = false) {
      const rows = await sql.query<{
        state: KiwoomJob;
        requested_from: string;
        requested_to: string;
      }>(
        `select state,to_char(requested_from,'YYYY-MM-DD') as requested_from,to_char(requested_to,'YYYY-MM-DD') as requested_to from kiwoom_flow_jobs where scope_id=$2 and environment=$3
          and code=$4 and instrument=$5 and market_scope=$6 and metric=$7
          and (not $8::boolean or job_key=$1) order by updated_at desc limit 1`,
        [kiwoomJobKey(identity, metric), ...params(identity, metric), exact],
      );
      const row = rows[0];
      // SQL DATE stays a date label, never pg's local-midnight JavaScript Date.
      return row
        ? {
            ...row.state,
            requestedFrom: row.requested_from,
            requestedTo: row.requested_to,
          }
        : null;
    },
    async saveJob(identity, metric, job) {
      await sql.query(
        `insert into kiwoom_flow_jobs(job_key,scope_id,environment,code,instrument,market_scope,metric,requested_from,requested_to,state)
        values($1,$2,$3,$4,$5,$6,$7,$8::date,$9::date,$10::jsonb)
        on conflict(job_key) do update set state=excluded.state,updated_at=clock_timestamp()`,
        [
          kiwoomJobKey(identity, metric),
          ...params(identity, metric),
          identity.request.from,
          identity.request.to,
          JSON.stringify(job),
        ],
      );
    },
    async exclusive(key, run, signal) {
      const owner = randomUUID();
      const started = Date.now();
      while (true) {
        signal.throwIfAborted();
        const acquired = await sql.query<{ owner: string }>(
          `insert into kiwoom_flow_coordination(key,owner,lease_until)
          values($1,$2,clock_timestamp()+interval '60 seconds') on conflict(key) do update set owner=$2,lease_until=clock_timestamp()+interval '60 seconds'
          where kiwoom_flow_coordination.lease_until is null or kiwoom_flow_coordination.lease_until < clock_timestamp() returning owner`,
          [key, owner],
        );
        if (acquired[0]?.owner === owner) break;
        if (Date.now() - started > 25_000)
          throw new KiwoomError("collecting", "다른 키움 수집 작업 실행 중");
        await waitKiwoom(100, signal);
      }
      const lost = new AbortController();
      let renewing = false;
      const heartbeat = setInterval(() => {
        if (renewing) return;
        renewing = true;
        void sql
          .query(
            `update kiwoom_flow_coordination set lease_until=clock_timestamp()+interval '60 seconds'
          where key=$1 and owner=$2 and lease_until > clock_timestamp() returning owner`,
            [key, owner],
          )
          .then(
            (rows) => {
              if (!rows.length) lost.abort();
            },
            () => lost.abort(),
          )
          .finally(() => {
            renewing = false;
          });
      }, 10_000);
      try {
        return await run(AbortSignal.any([signal, lost.signal]));
      } finally {
        clearInterval(heartbeat);
        await sql.query(
          "update kiwoom_flow_coordination set owner=null,lease_until=null where key=$1 and owner=$2",
          [key, owner],
        );
      }
    },
    async admit(key, spacingMs, signal) {
      // Claim a slot only when it is due. No delayed reserved-slot burst after process pauses.
      while (true) {
        signal.throwIfAborted();
        const claimed = await sql.query(
          `insert into kiwoom_flow_coordination(key,next_at)
          values($1,clock_timestamp()+$2*interval '1 millisecond')
          on conflict(key) do update set next_at=clock_timestamp()+$2*interval '1 millisecond'
          where kiwoom_flow_coordination.next_at is null or kiwoom_flow_coordination.next_at<=clock_timestamp() returning key`,
          [`rate:${key}`, spacingMs],
        );
        if (claimed.length) return;
        await waitKiwoom(Math.min(spacingMs, 50), signal);
      }
    },
    async readToken(key) {
      const rows = await sql.query<{
        encrypted_token: string | null;
        token_expires: number | null;
      }>("select encrypted_token,token_expires from kiwoom_flow_coordination where key=$1", [
        `cached-token:${key}`,
      ]);
      return rows[0]?.encrypted_token && rows[0].token_expires
        ? { encrypted: rows[0].encrypted_token, expires: rows[0].token_expires }
        : null;
    },
    async writeToken(key, value) {
      await sql.query(
        `insert into kiwoom_flow_coordination(key,encrypted_token,token_expires) values($1,$2,$3)
        on conflict(key) do update set encrypted_token=$2,token_expires=$3`,
        [`cached-token:${key}`, value?.encrypted ?? null, value?.expires ?? null],
      );
    },
  } as KiwoomFlowStore;
  store.targets = createKiwoomTargets(sql, store.exclusive);
  store.collectorRuntime = createKiwoomCollectorRuntime(sql);
  return store;
}
