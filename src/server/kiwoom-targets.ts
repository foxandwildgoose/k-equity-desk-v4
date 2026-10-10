import type { Sql } from "../lib/db.ts";
import type { FlowRequest } from "../lib/charts/hts-flow.ts";
import type { FlowIdentity } from "./kiwoom-store.ts";
import type { KiwoomCoordination } from "./kiwoom-client.ts";
import { validateFlowRequest } from "./chart-flow-request.ts";
import { KiwoomError } from "./kiwoom-config.ts";

export const KIWOOM_TARGET_LIMIT = 100; // Bound new unfinished work; completed symbols do not permanently exhaust it.
export const KIWOOM_TARGET_SUBSCRIPTION_LIMIT = 6000; // Absolute bound, including ready/failed refresh subscriptions.
export const KIWOOM_TARGET_HISTORY_DAYS = 1830;
export const KIWOOM_TARGET_REFRESH_MS = 3_600_000;
export type KiwoomTargetEnqueueStatus = "COLLECTION_QUEUED" | "COLLECTING" | "TARGET_LIMIT_REACHED";
export interface KiwoomTarget {
  code: string;
  instrument: FlowRequest["instrument"];
  marketScope: "KRX" | "NXT" | "SOR";
  requestedFrom: string;
  requestedTo: string;
  state: "queued" | "collecting" | "partial" | "ready" | "failed";
  attemptCount: number;
}
export function boundKiwoomTarget(request: FlowRequest, now = Date.now()): FlowRequest {
  const valid = validateFlowRequest(request);
  if (valid.market !== "KR") throw new KiwoomError("configuration", "국내 상품만 수집 가능");
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(now));
  const to = valid.to > today ? today : valid.to;
  const floor = new Date(Date.parse(to) - KIWOOM_TARGET_HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
  const from = valid.from < floor ? floor : valid.from;
  if (from > to) throw new KiwoomError("configuration", "미래 수집 구간은 허용되지 않음");
  return { ...valid, from, to, expectedDailyDates: undefined };
}
export function createKiwoomTargets(sql: Sql, exclusive: KiwoomCoordination["exclusive"]) {
  const identityParams = (id: FlowIdentity) => [id.scopeId, id.environment, id.request.code, id.request.instrument, id.request.flowScope ?? "KRX"];
  return {
    async state(identity: FlowIdentity): Promise<KiwoomTarget["state"] | null> {
      const [row] = await sql.query<{ state: KiwoomTarget["state"] }>(
        "select state from kiwoom_collection_targets where scope_id=$1 and environment=$2 and code=$3 and instrument=$4 and market_scope=$5", identityParams(identity));
      return row?.state ?? null;
    },
    async enqueue(identity: FlowIdentity): Promise<KiwoomTargetEnqueueStatus> {
      const request = boundKiwoomTarget(identity.request);
      return exclusive(`target-enqueue:${identity.scopeId}`, async () => {
        const [existing] = await sql.query<{ state: string; from: string; to: string }>(
          `select state,to_char(requested_from,'YYYY-MM-DD') as "from",to_char(requested_to,'YYYY-MM-DD') as "to"
           from kiwoom_collection_targets where scope_id=$1 and environment=$2 and code=$3 and instrument=$4 and market_scope=$5`, identityParams(identity));
        const expands = existing && (request.from < existing.from || request.to > existing.to);
        const reactivates = expands && (existing.state === "ready" || existing.state === "failed");
        if (!existing || reactivates) {
          const [count] = await sql.query<{ total: number; active: number }>(
            `select count(*)::int as total,
              count(*) filter (where state in ('queued','collecting','partial'))::int as active
              from kiwoom_collection_targets where scope_id=$1`, [identity.scopeId]);
          if ((count?.active ?? 0) >= KIWOOM_TARGET_LIMIT || (!existing && (count?.total ?? 0) >= KIWOOM_TARGET_SUBSCRIPTION_LIMIT))
            return "TARGET_LIMIT_REACHED";
        }
        // Never move a refresh sooner than next_due_at. Expansion is remembered,
        // but cannot turn repeated anonymous reads into immediate broker work.
        await sql.query(
          `insert into kiwoom_collection_targets(scope_id,environment,code,instrument,market_scope,requested_from,requested_to)
           values($1,$2,$3,$4,$5,$6::date,$7::date)
           on conflict(scope_id,environment,code,instrument,market_scope) do update set
             requested_from=greatest(least(kiwoom_collection_targets.requested_from,excluded.requested_from),greatest(kiwoom_collection_targets.requested_to,excluded.requested_to)-1830),
             requested_to=greatest(kiwoom_collection_targets.requested_to,excluded.requested_to),
             state=case when kiwoom_collection_targets.state in ('ready','failed') then 'partial' else kiwoom_collection_targets.state end,
             requested_at=clock_timestamp(), updated_at=clock_timestamp()
           where excluded.requested_from < kiwoom_collection_targets.requested_from
              or excluded.requested_to > kiwoom_collection_targets.requested_to`,
          [...identityParams(identity), request.from, request.to]);
        return existing?.state === "collecting" ? "COLLECTING" : "COLLECTION_QUEUED";
      }, AbortSignal.timeout(5_000));
    },
    async pending(scopeId: string, environment: string, limit = 10, now = Date.now()): Promise<KiwoomTarget[]> {
      // A registered symbol is a bounded refresh subscription. A long-running
      // collector must not keep asking for the date on which its PC started.
      // Only due rows advance; public reads cannot shorten their refresh delay.
      const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(now));
      return sql.query<KiwoomTarget>(
        `with due as (
          select scope_id,environment,code,instrument,market_scope
          from kiwoom_collection_targets where scope_id=$1 and environment=$2 and next_due_at<=clock_timestamp()
          order by next_due_at,requested_at limit $3
        ), refreshed as (
          update kiwoom_collection_targets t set
            requested_to=greatest(t.requested_to,$4::date),
            requested_from=greatest(t.requested_from,greatest(t.requested_to,$4::date)-1830),
            state=case when t.requested_to<$4::date and t.state='ready' then 'queued' else t.state end,
            updated_at=case when t.requested_to<$4::date then clock_timestamp() else t.updated_at end
          from due d where t.scope_id=d.scope_id and t.environment=d.environment
            and t.code=d.code and t.instrument=d.instrument and t.market_scope=d.market_scope
          returning t.*
        ) select code,instrument,market_scope as "marketScope",to_char(requested_from,'YYYY-MM-DD') as "requestedFrom",
          to_char(requested_to,'YYYY-MM-DD') as "requestedTo",state,attempt_count as "attemptCount"
          from refreshed order by next_due_at,requested_at`,
        [scopeId, environment, Math.max(1, Math.min(10, limit)), today]);
    },
    async start(identity: FlowIdentity): Promise<void> {
      await sql.query(`update kiwoom_collection_targets set state='collecting',attempt_count=attempt_count+1,
        next_due_at=clock_timestamp()+interval '15 minutes',updated_at=clock_timestamp()
        where scope_id=$1 and environment=$2 and code=$3 and instrument=$4 and market_scope=$5`, identityParams(identity));
    },
    async finish(identity: FlowIdentity, complete: boolean, valid: boolean): Promise<void> {
      // If a web request widened the range while collection ran, do not mark that wider work complete.
      await sql.query(`update kiwoom_collection_targets set
        state=case when $6 and requested_from >= $8::date and requested_to <= $9::date then 'ready'
          when attempt_count>=8 then 'failed' when $7 then 'partial' else 'failed' end,
        last_success_at=case when $7 then clock_timestamp() else last_success_at end,
        attempt_count=case when $6 and requested_from >= $8::date and requested_to <= $9::date then 0 else attempt_count end,
        next_due_at=clock_timestamp()+case when $6 and requested_from >= $8::date and requested_to <= $9::date then interval '1 hour'
          when attempt_count>=8 then interval '1 day' else interval '15 minutes' end,
        updated_at=clock_timestamp()
        where scope_id=$1 and environment=$2 and code=$3 and instrument=$4 and market_scope=$5`,
        [...identityParams(identity), complete, valid, identity.request.from, identity.request.to]);
    },
  };
}
