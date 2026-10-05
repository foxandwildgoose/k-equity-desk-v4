-- Additive collector telemetry only. Existing observations/jobs/targets are untouched.
-- One current worker per data scope/environment; worker IDs are random UUIDs, never credentials.
create table if not exists kiwoom_collector_runtime (
  scope_id text not null,
  environment text not null check(environment in ('real','mock')),
  instance_id uuid not null,
  started_at timestamptz not null default clock_timestamp(),
  last_heartbeat_at timestamptz not null default clock_timestamp(),
  last_success_at timestamptz,
  last_error_code text,
  last_queue_count integer check(last_queue_count between 0 and 100),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(scope_id,environment)
);
