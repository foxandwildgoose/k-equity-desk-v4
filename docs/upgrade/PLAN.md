# PLAN — phases, files, risks

Base commit `7c154f5`. Order is fixed by A10: P0 → P7. Data features before charts.

## P0 — Reconnaissance (docs only)
- Read spec files, Naver catalog (`dd3ok/naverstock-api-skill@47a4274`), KIS
  `examples_llm/domestic_stock/news_title` (+ `kis_auth.py`).
- Create `CLAUDE.md`, `docs/upgrade/{MASTER_PROMPT,SPEC,PLAN,PROGRESS,ENVIRONMENT}.md`.
- Registry (data-only) + `scripts/verify-sources.mjs` → `SOURCES_STATUS.md`; record mode.
- Baseline gates; `.qa/` in `.gitignore`.

## P1 — Foundations
New pure modules (strip-types safe, relative `.ts` imports):
- `src/lib/feed/types.ts`, `time.ts`, `sort.ts`, `text.ts`, `rss-parse.ts`,
  `cluster.ts`, `importance.ts`, `tickers.ts`, `mappers.ts`, `briefing.ts`
- `src/data/news-keywords.ts` (weights; data only)
- `src/lib/store-migrate.ts` (pure v1→v2 migrate) + `store.ts` (version 2)
- `src/lib/open-original.ts` (popup-safe click pattern, D2)
- `src/components/charts/core/attribution.ts` + `formatters.ts` (D3/D4, reused in P6)
Server:
- `src/server/feeds/registry.ts` (data), `http.ts` (fetchWithPolicy), `health.ts`
- `src/lib/feed-fns.ts` server fns (`getSourceHealth`, `retrySource`)
UI:
- `src/components/feed/*` (FeedList, FeedRow, BriefingDigest, SourceHealthChip,
  TimeStamp, FilterBar, EmptyState), `src/routes/status.sources.tsx`
- Chart attribution footer in AppShell + per chart.
Fixes: D1 (all call sites), D2, D3, D4, D5 name, D7, D8. Tests + invariant test.
Risk: kernel replacement changes visible orders → intended (D1).

## P2 — News
- `src/server/feeds/adapters/{naver-news,rss,google-news,disclosures,kis-news,yahoo-snapshot,finviz-ratings}.ts`
- `src/server/feeds/aggregate.ts` (budgeted fan-out → merge/cluster/score/sort/page)
- `src/routes/api.feed.ts`, `src/lib/use-feed.ts`, `src/routes/news.kr.tsx`,
  `news.us.tsx`, `news.index.tsx` (redirect) , US snapshot server fn.
- F1.4 LiveNews via kernel + 더 보기 (paged per-stock news server fn).
- Sidebar grouped (F10.1).
Risk: Naver v2 news JSON field names are not documented beyond list keys →
tolerant mappers (multiple candidate fields), status `unverified`.

## P3 — Research
- `src/server/research-v2.ts` (v2 list/detail/detail-page/goal-price/weekly-hot,
  legacy fallback) + server fns; ResearchDesk rewrite (tabs, strip, cards,
  pre-resolve, detail sheet); BrokerReports kernel + Δ% rule.
- US: `us-street.ts` timestamps + chronological headlines; Street Moves table
  (CSV); scope banner; tiers; ResearchHome sorting; lazy universe.
Risk: popup behaviour on iOS — covered by sync-open pattern and a Playwright popup test.

## P4 — ETF news + Robotics
- Extend `etf-news.ts`; `/news/etf`; ETF 뉴스 tab on `/etfs`.
- `src/data/robotics.ts`; `src/server/robotics.ts`; `src/lib/robotics/*` pure
  (topic classifier, Federal Register filter, policy status chips, ETF matcher);
  `/robotics` route with 6 tabs; cross-links; taxonomy fix (D5).

## P5 — Live Wire
- `src/routes/api.wire.ts`; `src/lib/live-wire/*` pure (diff, rate limit,
  quiet hours, leader election helpers); `use-live-wire.ts`; drawer + header
  button; sonner `<Toaster>`; settings page `/settings/alerts`; SSE hardening.

## P6 — Pro charts
- `src/components/charts/core/*` (createProChart, ChartShell, sync, formatters,
  tick size); `src/lib/chart-indicators.ts` new indicators + tests;
  `src/lib/chart-drawings/*` pure geometry/undo; primitives; TradingChart
  refactor onto core; `/chart` workspace; Tier B/C chrome; D9.
Risk: TradingChart is 2k lines — refactor incrementally, keep behaviours.

## P7 — AI layer, dashboard, final
- `src/server/ai/*` provider interface (anthropic/xai), validator (pure, tested),
  `src/routes/api.ai-briefing.ts`; dashboard cards; qa-smoke; FINAL_REPORT.md; push.

## Cross-cutting risks
- OFFLINE-BUILD (egress proxy denies every data host): every source stays
  `unverified`; UI shows `소스 미검증`; parsers tested on synthetic fixtures only.
- Build rewrites `.vercel/output` — always restore before commit.
- Context length: phase-boundary commits + PROGRESS.md next steps.
