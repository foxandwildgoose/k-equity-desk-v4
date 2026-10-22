-- Public, verified trade statistics and cross-worker refresh admission only.
-- No credentials, user identifiers, provider error bodies or auth state belong here.
create table if not exists export_trade_snapshots (
  cache_key text primary key,
  schema_version integer not null check (schema_version = 1),
  as_of text not null,
  payload jsonb not null,
  verified_at timestamptz not null,
  fresh_until timestamptz not null,
  valid_until timestamptz not null,
  check (fresh_until >= verified_at and valid_until >= fresh_until)
);

create table if not exists export_trade_refresh_state (
  scope text primary key,
  owner text,
  lease_until timestamptz,
  cooldown_until timestamptz
);
