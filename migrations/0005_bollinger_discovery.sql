-- Additive daily screener storage; existing auth/Kiwoom tables remain untouched.
CREATE TABLE IF NOT EXISTS bollinger_universes (
 id text PRIMARY KEY, kind text NOT NULL, as_of date NOT NULL, known_at timestamptz NOT NULL,
 source text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bollinger_universes_pit ON bollinger_universes(kind, as_of DESC, known_at DESC);
CREATE TABLE IF NOT EXISTS bollinger_members (
 universe_id text NOT NULL REFERENCES bollinger_universes(id), market text NOT NULL, symbol text NOT NULL,
 name text NOT NULL, sector text NOT NULL, market_cap double precision, index_weight double precision,
 holding_weight double precision, asset_type text NOT NULL, verified boolean NOT NULL, payload jsonb NOT NULL,
 PRIMARY KEY(universe_id,market,symbol)
);
CREATE TABLE IF NOT EXISTS bollinger_daily_bars (
 market text NOT NULL, symbol text NOT NULL, price_basis text NOT NULL, day date NOT NULL,
 source text NOT NULL, known_at timestamptz NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now(), payload jsonb NOT NULL,
 PRIMARY KEY(market,symbol,price_basis,day)
);
CREATE TABLE IF NOT EXISTS bollinger_context (
 universe_id text NOT NULL REFERENCES bollinger_universes(id), day date NOT NULL, scope text NOT NULL,
 source text NOT NULL, payload jsonb NOT NULL, PRIMARY KEY(universe_id,day,scope)
);
CREATE TABLE IF NOT EXISTS bollinger_features (
 universe_id text NOT NULL REFERENCES bollinger_universes(id), config_version text NOT NULL, market text NOT NULL,
 symbol text NOT NULL, day date NOT NULL, state text NOT NULL, score double precision, coverage double precision NOT NULL,
 views jsonb NOT NULL, valid boolean NOT NULL, source text NOT NULL, price_basis text NOT NULL,
 payload jsonb NOT NULL, computed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(universe_id,config_version,market,symbol,day)
);
CREATE INDEX IF NOT EXISTS bollinger_features_query ON bollinger_features(universe_id,config_version,day DESC,score DESC);
CREATE INDEX IF NOT EXISTS bollinger_features_latest ON bollinger_features(universe_id,config_version,market,symbol,day DESC);
CREATE TABLE IF NOT EXISTS bollinger_signal_events (
 id text PRIMARY KEY, universe_id text NOT NULL REFERENCES bollinger_universes(id), market text NOT NULL, symbol text NOT NULL,
 day date NOT NULL, config_version text NOT NULL, signal text NOT NULL, payload jsonb NOT NULL,
 detected_at timestamptz NOT NULL DEFAULT now(), delivery_status text NOT NULL DEFAULT 'detected'
);
CREATE TABLE IF NOT EXISTS bollinger_jobs (
 id text PRIMARY KEY, scope text NOT NULL, status text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz, summary jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS bollinger_job_leases (
 scope text PRIMARY KEY, token text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS bollinger_backtests (
 id text PRIMARY KEY, universe_id text NOT NULL REFERENCES bollinger_universes(id), config_version text NOT NULL,
 start_day date NOT NULL, end_day date NOT NULL, research_only boolean NOT NULL, payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
