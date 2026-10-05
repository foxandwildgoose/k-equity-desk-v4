-- Market-data partition is configured server-side. Existing owner rows are retained.
create table if not exists kiwoom_collection_targets (
  scope_id text not null, environment text not null check(environment in ('real','mock')),
  code text not null check(code ~ '^[0-9A-Z]{6}$'),
  instrument text not null check(instrument in ('stock','etf','etn')),
  market_scope text not null check(market_scope in ('KRX','NXT','SOR')),
  requested_from date not null, requested_to date not null,
  requested_at timestamptz not null default clock_timestamp(),
  next_due_at timestamptz not null default clock_timestamp(),
  state text not null default 'queued' check(state in ('queued','collecting','partial','ready','failed')),
  attempt_count integer not null default 0,
  last_success_at timestamptz, updated_at timestamptz not null default clock_timestamp(),
  primary key(scope_id,environment,code,instrument,market_scope),
  check(requested_from <= requested_to),
  check(requested_to - requested_from <= 1830)
);
create index if not exists kiwoom_target_due on kiwoom_collection_targets(scope_id,environment,next_due_at);
