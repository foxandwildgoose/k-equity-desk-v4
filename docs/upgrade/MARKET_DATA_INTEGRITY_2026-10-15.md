# Market data integrity audit — 2026-10-15 session

## Reproduced production defect

At 2026-10-15 15:32 UTC (October 16, 00:32 KST), the pre-change production `getMarketQuotes` response contained 140 positive returns, no negative returns, and no provider trading timestamps. Naver polling exposes unsigned `cv`/`cr` magnitudes and a separate `rf` direction (1/2 up, 3 unchanged, 4/5 down). The adapter ignored `rf`. It therefore displayed Samsung Electronics +10.56%, SK hynix +12.76%, Hyundai Motor +7.66% and LG Energy Solution +6.87% when independent dated Naver `/basic` observations reported -10.56%, -12.76%, -7.66% and -6.87%. Some securities really rose; the fix preserves those positive observations. It does not force sectors negative.

The sector figures are equal-weight means of the app's covered securities, not official KRX sector index returns. The UI now states this basis and shows valid/expected coverage and provider time. Missing, invalid, future-dated, undated and different-session rows do not enter sector averages, breadth or rankings. Unavailable aggregates render an em dash instead of an invented zero. Gainers must be positive and losers must be negative.

## Provider and streaming repairs

- Shared numeric/sign normalization validates provider direction, signed amount, percentage and previous close together. Missing observations do not become zero-change quotes.
- Bulk requests use published Naver market-value listing rows carrying price, signed return, volume, capitalization and trading time together. Missing or undated polling rows fall back to complete independently dated `/basic` snapshots; a timestamp from one observation is never attached to a different price. Receipt time remains separate from trade time. Turnover is not market capitalization.
- KIS messages validate all records, timestamps, amounts and session identity. Older REST responses cannot overwrite newer ticks. One tick changes only its security and never turns an entire snapshot bundle into live KIS data. LIVE requires an actual recent per-security trade and a connected transport.
- The SSE listener registration/disconnection race is closed. Quiet streams lose live badges as their observed trade ages.
- Stock tables, headers and trade metrics distinguish absent quotes from zero. OHLC gaps, ranges and volume ratios require valid source inputs.

## Daily chart repair

Historical daily feeds can lag the completed exchange session. Korean daily charts independently fetch Naver's dated `/price` rows containing complete real open/high/low/close/volume and reconcile them with history. Current-session ticks may update only a compatible cumulative candle. Moving averages are recalculated. Close-only samples cannot manufacture OHLC values.

Exchange dates use Asia/Seoul for Korean listings and America/New_York for US listings, including US daylight-saving time. At October 16 before the Korean session opens, the last actual October 15 candle is retained; no October 16 candle is fabricated. The chart exposes its last actual trading date and reports missing current-session data. US adjusted histories are not combined with unadjusted quote prices. Korean quote overlays are confined to the actual 09:00–15:30 regular session; later observations cannot change a completed regular daily candle or attach an after-hours time to it. The quote header shows the provider observation separately from the daily bar; a closed-market quote is labelled a recent observation rather than assuming it is the regular-session closing price.

## Independent runtime audit and additional fixes

Separate reviewers traced provider adapters, cache/stream ordering, aggregate presentation, daily chart reconciliation, export statistics, valuation and issuer links. Concrete additional defects fixed:

- Runtime export demo generation and persisted synthetic rows are removed; real imported observations remain usable.
- An unavailable trade denominator no longer becomes 1. Missing historical monthly FX never falls back to today's spot quote. Calendar holes remain missing before rolling/year-on-year calculations.
- Unverified seed allocation weights no longer produce a financial composite; evidence-backed mappings are required. Unverified taxonomy dates and classifications are labelled as reference material.
- AI-generated numeric claims require cited source support; this is not a proof of all natural-language semantics. Paid model calls were not used for validation.
- Nasdaq next-twelve-month EPS uses the actual next four quarters, including losses and zero earnings, rather than skipping ahead to later positive quarters.

## ETF issuer destinations

See [ETF_ISSUER_LINK_CATALOG.md](ETF_ISSUER_LINK_CATALOG.md) for the central registry, exact issuer routes, provenance, holdings anchors, coverage and unresolved destinations. A temporary issuer HTTP failure does not invalidate an already-established product identity. Unknown destinations remain explicitly unavailable; issuer homepages, search pages and guessed opaque product IDs are never substituted.

## Validation contract and limits

Provider fixture tests exercise real adapters and state transitions. Browser fixture scenarios cover declining, mixed, empty, partial and stale data on desktop and mobile; fixtures are explicitly test-only and are not live exchange verification. Separate real-provider chart/API checks establish the actual October 15 values. Full tests, type checking, the production build, built-output rendering and production verification are recorded in the task report after execution.

Weekday/time guards do not claim an authoritative Korean exchange holiday calendar. On an unconfirmed holiday, missing current-session observations are conservatively labelled unavailable/stale rather than treated as current. No claim is made that an HTTP polling snapshot is exchange real-time data. No production database migration or paid AI request was performed.

## Executed validation evidence

- Final production build: PASS; the packaged server includes the independent daily-history failure fallback.
- Packaging/deployment invariant: PASS with no issues.
- Actual built-server quote RPC: 140 securities, 120 falling and 20 rising, all 140 carrying provider trade times, valid volume and valid capitalization. Eight independently fetched `/basic` records match price, signed change and signed percentage exactly; their independently fetched listing rows also match volume and capitalization with the correct unit. Evidence: `artifacts/market-built-provider-comparison-20261015.json`.
- Actual built-server daily RPC: SOL 0246X0, TIGER 305540 and Samsung Electronics 005930 match independently fetched October 15 OHLC and volume exactly. No October 16 pre-open candle exists. Evidence: `artifacts/daily-chart-built-provider-comparison-20261015.json`. The cloud history provider is inaccessible, so this also exercises the real daily-snapshot fallback rather than a synthetic fixture.
- Central issuer registry: 942 exact destinations, all 1,176 listed ETFs classified into 28 brands, 234 explicitly unresolved. Independent audit checks all 942 mappings, source hashes, code/family binding, cold resolution without HTTP and rejection of unrelated upstream destinations.

The local Node 22.23.3 runtime required its supported `--use-env-proxy` flag for native fetch to honor the managed proxy. Without it a native provider request timed out; with it the same official provider returned HTTP 200. This is saved in cloud startup instructions and does not change production application code or TLS verification.

The final audit also removed historical positive valuation backfill: if the newest valuation observation is missing, non-positive or non-finite, current multiple, percentile and current Z-score remain unavailable while historical statistics remain usable. Independent regression tests cover the actual positive-EPS to loss transition and range reslicing.

## Final same-row volume and capitalization repair

Independent live verification caught an integration regression: `/basic` has price and time but lacks volume and market-cap fields. Replacing an undated polling row with `/basic` correctly protected price provenance but left all auxiliary values unavailable. The final bulk adapter uses the published `m.stock.naver.com/api/stocks/marketValue/{KOSPI|KOSDAQ}` response instead. Each security row carries its own trading time, signed price/return, accumulated volume and capitalization. Full-KRW `marketValueRaw` is divided by 100,000,000 exactly once for the app's 억원 unit. Data from the undated `/integration` response is never silently attached to the dated row.

The final actual-provider probe confirms 140 observed securities: 120 falling, 20 rising, all 140 with dated valid volume and capitalization. Bounded paged retrieval shares in-flight scans, preserves provider/receipt times during caching, and refuses to replace a newer duplicate observation with an older one. Provider exchange membership also exposed and corrected the static KOSDAQ classification of L&F (066970) and EcoPro Materials (450080); both are KOSPI in the actual published listing.

Export market-cap rankings reuse these same dated records and exclude ETFs, preferred shares, invalid caps and stale/undated observations. An October 15 observation received before the October 16 open remains an October 15 ranking. The UI separately displays observation date and collection time.

After-hours quote volume and regular-session daily volume can legitimately differ. RVOL therefore uses only an explicitly regular-session quote volume or the matching dated regular daily bar; it never compares an after-hours numerator with regular daily history. Source evidence is retained in `artifacts/market-same-row-provider-verification-20261015.json`.

The full suite passed 236 script tests and 855 application tests, with 21 platform-specific script tests skipped. Later bounded fixes additionally pass focused regression suites; the final combined focused run passes 173 tests with no failures. Full raw provider results are retained in the adjacent deterministic gzip archive, with a readable summary and SHA-256. Windows Scheduled Task tests are skipped on this Linux environment.

## Browser validation and environment limits

All five fixture scenarios (declining, mixed, empty, partial and stale) pass on desktop and mobile against development and built output, with zero application console errors, page errors, HTTP failures or overflow. The stale scenario also waits for the industry page's completed quote request, preventing an SSR placeholder from satisfying a missing-value assertion. Consolidated evidence: `artifacts/market-browser-regression-20261015.json`. Early cold dependency-transform and development HMR attempts are retained separately as failed attempts and are not counted as clean passes.

Separate actual-provider browser checks pass for three instruments on both viewport sizes (six checks). SOL and TIGER mobile buttons each appear exactly once, have the exact requested href, open a new tab with `noopener noreferrer`, and provide at least a 44-pixel target. The existing alternative issuer-product button is absent. These are real application RPC checks, not market data fixtures.

The unmodified standard browser smoke confirms visible desktop/mobile content, HTTP 200 and no page overflow or uncaught page exceptions, but reports environment-blocked external font/branding loads (tunnel denial and certificate trust errors). Feature-specific checks neutralize only those documented external resources, retain real application traffic where marked, and require clean application consoles. TLS verification is preserved. `agent-browser` is unavailable in this environment; Playwright with the installed system Chromium is the documented fallback.

Final publication-build spot checks pass for the actual stock chart on desktop/mobile and all three daily RPCs. Final export desktop/mobile checks confirm 264 dated non-ETF capitalization observations, a 100-security ranking universe, observation date October 15 and a separately displayed October 16 collection time, with no runtime/console/HTTP errors or overflow. FRED/Comtrade observations remain unavailable in this cloud environment and are explicitly N/A; no replacement export values are generated.
