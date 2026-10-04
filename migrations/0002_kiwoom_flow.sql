-- Additive market-data schema. No existing rows/tables are modified.
create table if not exists kiwoom_flow_observations (
  scope_id text not null, provider text not null check (provider = 'kiwoom'),
  environment text not null check (environment in ('real','mock')),
  code text not null, instrument text not null, market_scope text not null,
  metric text not null, unit text not null, date date not null,
  value double precision, observation jsonb not null,
  fetched_at timestamptz not null, parsing_status text not null,
  primary key (scope_id,provider,environment,code,instrument,market_scope,metric,unit,date)
);
create table if not exists kiwoom_flow_jobs (
  job_key text primary key, scope_id text not null, environment text not null,
  code text not null, instrument text not null, market_scope text not null, metric text not null,
  requested_from date not null, requested_to date not null,
  state jsonb not null, updated_at timestamptz not null default clock_timestamp()
);
create index if not exists kiwoom_flow_job_scope on kiwoom_flow_jobs(scope_id,environment,code,instrument,market_scope,metric);
-- Admission and token issuance are coordinated by credential fingerprint across processes.
-- Token payload is AES-256-GCM encrypted; only the process with the credential pair can decrypt.
create table if not exists kiwoom_flow_coordination (
  key text primary key, owner text, lease_until timestamptz,
  next_at timestamptz, encrypted_token text, token_expires double precision
);
