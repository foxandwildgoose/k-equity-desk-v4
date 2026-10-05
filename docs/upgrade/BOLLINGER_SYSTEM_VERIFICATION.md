# Bollinger System verification — 2026-10-05

Base: `9d4269d6365f796e7b33d4efb42eea31670b59fe` (latest remote main fetched before changes). Existing SMA, chart display/profile, Kiwoom authentication and persistence work were retained. No deployment, operational database migration, credential change or TLS bypass was performed.

## Automated checks

| Actual command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run test:bollinger` | PASS — 55 tests, 0 failures/skips |
| `npm test` | PASS — 207 script tests + 453 TypeScript tests = 660, 0 failures/skips |
| `npm run lint` | PASS — 0 errors; 56 existing warnings |
| `npm run check:auth` | PASS — dev/build agree, sign-in off |
| `npm run build` | PASS — production client/server bundle |
| `git diff --check` | PASS |

Node 22.23.3 and the existing npm environment wrapper were used. PowerShell tests used the isolated `KIWOOM_TEST_PWSH` test runtime/cache. The current `build` script has **no database migration hook**; `db:migrate` was not run. Kiwoom browser fixtures use isolated in-memory PGlite and existing migrations 0002/0003, never an operational DB.

[Captured logs](artifacts/bollinger-2026-10-05/) preserve the commands and actual counts. The shared financial tests cover population variance, outliers and gaps, empirical midrank ties and warm-up, selected-frame preroll, prefix invariance, completed-bar events, causal W/M/divergence confirmation, independent OFF states, migrations, score coverage, explicit publication time zones and market scopes, negative trust flows, alerts, and screener filters/cache/normalization.

## Production browser checks

Browser QA uses the production bundle served by the repository's `npm run preview`, system Chromium and the compiled TanStack server-function map. `--mode fixture` intercepts browser test transport only; every synthetic capture/result is labeled. Fixtures are not installed in application runtime and cannot become a production fallback.

The initial pilot found a real formatting bug: a global KR price formatter rounded %B guides and removed BBW units. Series-owned formatting fixed it. A first 48-case run passed 40 and failed 8; its original evidence is retained. Failures included missing native price/fill output and master-OFF restoration after reload. The price owner now initializes its OHLCV immediately and owns BB fill attachment/removal. Bollinger controls wait for verified product/scope loading, and explicit changes immediately save through existing scoped persistence. The final browser probe additionally requires candle-body canvas output so SMA/BB boundary lines cannot mask a missing price series.

Existing SMA QA's old malformed FlowResponse fixture was updated to the actual server contract; financial assertions remain intact. Out-of-range monthly flow requests are serialized as genuine validation errors by the test transport, preserving the price chart. No numerical/native assertion or timeout was relaxed to pass the final run.

| Production browser check | Actual result |
|---|---|
| Bollinger matrix: 8 surfaces × 2 themes × 3 viewports | PASS after retest — 47/48 first run; the remaining case passed an isolated retest after fixing QA modal-close synchronization |
| Legacy settings | PASS — 2/2, including master OFF, custom BB30/SMA50 and drawings |
| Screener UI | PASS — 6/6, manual requests, filters, stale/unavailable exclusions and U.S. flow handling |
| Existing SMA regression | PASS — 20/20 on native resize-lock build; actual candle bodies additionally confirmed in all 16 price-chart cases |
| Existing HTS interactions | PASS — 8/8 on native resize-lock build, drawing/profile/alerts/panes/flow/timeline/replay/fullscreen/export checks |
| Final-build master-OFF PNG/CSV pilot | PASS — 4/4; exact native logical/calendar window, raw CSV equality, BB/pane OFF pixels absent and all five SMA colors retained |
| Final-build focused ETF/workspace | PASS — 2/2; 069500 Dark/mobile and workspace-1 Light/desktop fullscreen, native rendering, exact restored window and OFF exports |
| Dev and production dashboard smoke | PARTIAL — visible content, HTTP 200, no JS page errors, no overflow; earlier baseline matched, latest dynamic index header differs; external certificate errors remain |
| Unmocked real-price charts | BLOCKED / not verified — no real price observations or Bollinger output confirmed |

Exact matrix symbols: **005930, 403870, 069500, NVDA, BOTZ**, workspace 1/2/4. Each used Light and Dark at **1440×900**, **768×1024**, and **390×844** (desktop/tablet DPR 1, mobile DPR 2). Workspace 2 uses 005930/BOTZ; workspace 4 uses 005930/069500/NVDA/BOTZ. The 005930 desktop cases additionally verify 5-minute, daily, weekly, monthly and replay numerical behavior, same-frame warm-up, prefix invariance, live theme changes, native %B guides/units, and actual PNG/CSV output. Other cases verify their selected daily chart and responsive/native controls. HTS regression used desktop 1440×1100 and mobile 390×844; dashboard smoke used desktop 1280×800 and mobile 390×844.

The 47/48 matrix's remaining 069500 Dark/mobile failure was reproduced in isolation: the QA helper reopened the settings sheet after 150 ms, while its existing exit transition takes 200 ms. It now waits for actual portal removal under the unchanged deadline. The original failed result remains in `final-matrix.json` alongside the successful follow-up. The earlier 40/48 application-failure matrix also remains available; it is not counted as passing.

The full matrix ran after the native-price/fill/persistence fixes. A subsequent strict OFF-export pilot found one more mobile display bug: removing %B/BBW axes widened the shared plot and changed the visible-window CSV from 156 to 160 rows. Every common-date financial value matched, but this still changed the chosen window. A one-frame restoration attempt passed only 3/4 cases: a later native axis layout could still change the window by one bar. Inspection of the installed library identified its `lockVisibleTimeRangeOnResize` option, which scales bar spacing on **every** drawable-width change, including shared auxiliary-axis width. The final source uses this native mechanism, not a timed workaround. Native arithmetic can still produce 2.84e-14 instead of integer index 0; the shared logical-window helper canonicalizes only integer-boundary noise within 1e-9 bars. Real fractional pans remain unchanged, and ceil/floor cannot accidentally discard the first candle. A dedicated regression covers positive/negative roundoff and genuine fractional windows. Browser exact logical/calendar and CSV assertions remain unchanged. Failed pilot records are retained; exact logical/calendar range and whole-CSV equality assertions were not relaxed. The final production build includes this native range correction and the nonpositive-price/stop/target risk guard. Its full suite, strict four-case 005930 Light/Dark × desktop/mobile OFF-export pilot and existing SMA/HTS regressions are checked separately. The original full matrix is not presented as having been rerun after these last changes.

### Commands and retained evidence

QA ran with the existing verified system Chromium through `NODE_OPTIONS=--import /workspace/.onboarding/tools/use-system-chromium.mjs`. No certificate verification bypass or arbitrary response substitution was used in `--mode real`.

```sh
# Compiled entry used by the existing preview in this execution environment:
bb_entry=/workspace/.onboarding/builds/k-equity-desk-v4/functions/__server.func/index.mjs

# Run separately for desktop, tablet and mobile; aggregate their original results.
npm run qa:bollinger -- --mode fixture --base http://127.0.0.1:8183 \
  --server-entry "$bb_entry" --themes light,dark --viewports desktop \
  --out /workspace/screenshots/bollinger-production/final-desktop
# Same command with --viewports tablet / mobile and their respective output directories.

npm run qa:bollinger -- --mode fixture --base http://127.0.0.1:8183 \
  --server-entry "$bb_entry" --cases etf-069500 --themes dark --viewports mobile \
  --out /workspace/screenshots/bollinger-production/repeat-etf-modal-synchronized
npm run qa:bollinger -- --mode fixture --base http://127.0.0.1:8183 \
  --server-entry "$bb_entry" --cases stock-005930 --themes light,dark \
  --viewports desktop --legacy --out /workspace/screenshots/bollinger-production/final-legacy
npm run qa:bollinger -- --mode fixture --base http://127.0.0.1:8183 \
  --server-entry "$bb_entry" --screener-only --themes light,dark \
  --out /workspace/screenshots/bollinger-production/final-screener
npm run qa:sma -- --base http://127.0.0.1:8183 --server-entry "$bb_entry" \
  --out /workspace/screenshots/bollinger-production/sma-regression-final-2
# Repeated on the native resize-lock build with --out .../sma-regression-native-range-final.
npm run qa:chart-hts -- --mode fixture --base http://127.0.0.1:8183 \
  --function-map /tmp/bb-function-map.json --interactions \
  --cases stock-403870,etf-069500,us-NVDA,workspace-multi --viewports desktop,mobile \
  --out /workspace/screenshots/bollinger-production/hts-regression-final
# Repeated on the native resize-lock build with --out .../hts-regression-native-range-final.
npm run qa:bollinger -- --mode fixture --base http://127.0.0.1:8183 \
  --server-entry "$bb_entry" --cases stock-005930 --themes light,dark \
  --viewports desktop,mobile --export-off \
  --out /workspace/screenshots/bollinger-production/final-canonical-export
# Same final source additionally checked etf-069500 Dark/mobile and
# workspace-1 Light/desktop with --export-off in separate final-canonical output folders.

# Real mode: no market-response fixture. Initial five symbols used --timeout 15000.
npm run qa:bollinger -- --mode real --base http://127.0.0.1:8183 \
  --server-entry "$bb_entry" --cases stock-005930,stock-403870,etf-069500,us-NVDA,us-BOTZ \
  --themes light --viewports desktop --timeout 15000 \
  --out /workspace/screenshots/bollinger-production/real
# 005930 additionally attempted with --timeout 90000; after correcting diagnostic
# CrossJSON decoding, with --timeout 30000. These were not successful data checks.
```

Internal loopback addresses above are reproducibility details, not user-accessible site links. [Evidence index](artifacts/bollinger-2026-10-05/README.md) links retained logs, original browser verdicts and representative synthetic Light/Dark captures. [Changed file manifest](artifacts/bollinger-2026-10-05/changed-files.txt) lists every source/document file; purposes are recorded below and in the implementation document.

### Unmocked observations and smoke limits

The five real-mode attempts did not confirm real-price candle output. The 005930 90-second diagnostic observed completed HTTP-200 chart RPC bodies, but its original diagnostic decoder could not decode the CrossJSON payload, so bar counts and source are **unknown**. Corrected decoding was applied for a subsequent 30-second attempt; price RPCs remained pending at its deadline. No real price count, source, full-history claim or broker-authentication result is inferred from HTTP 200 alone. This does not prove a particular provider/IP/authentication failure; the exact data-path blocker remains unconfirmed. `KIWOOM_APP_KEY` and `KIWOOM_APP_SECRET` presence in this task process was checked as booleans only: both false. The user has received both credentials; this process is unconfigured, not evidence that the Secret was unissued. No uploaded credential file was read or copied during this task.

Dashboard dev/build screenshots were visually inspected, including the final canonical-window build. Both have visible content, with no first-party asset 404, uncaught JS error or horizontal overflow. The earlier snapshot matched (`divergesFromBaseline=false`); the final unmocked comparison differs because the dev snapshot contains a changed index/session header and populated U.S. index text while production remains in its initial loading state. Its actual `divergesFromBaseline=true` verdict is retained, not presented as a matching baseline. Production and mobile dev report three external `ERR_CERT_AUTHORITY_INVALID` resource failures; desktop dev reports six repeated failures. These come from Pretendard/jsDelivr, Google Fonts and Grok branding. The smoke wrapper therefore does not qualify as a clean-console or matching-baseline PASS. Existing branding/OG warnings are retained. TLS verification was not disabled. External font/branding failures are not asserted to be the cause of unverified price responses.

## Exact changed source/document files and purposes

| File | Purpose |
|---|---|
| `src/lib/bollinger/types.ts` | Shared settings, analysis, events, score and flow contracts |
| `src/lib/bollinger/config.ts` | Defaults, thresholds, presets, safe validation, legacy managed-BB adoption |
| `src/lib/bollinger/config.test.ts` | Config, child toggles, custom/default migration regression |
| `src/lib/bollinger/engine.ts` | Band/%B/BBW/rank, regimes, trend, confirmations, score and causal risk/reward |
| `src/lib/bollinger/engine.test.ts` | Formula, warm-up, prefix, replay/event, score and nonpositive-risk regressions |
| `src/lib/bollinger/patterns.ts` | Causal confirmed W/M setup/structure and %B divergence |
| `src/lib/bollinger/patterns.test.ts` | Pattern timing, gaps, confirmation and no-future tests |
| `src/lib/bollinger/bar-completion.ts` | Seoul/New York selected-frame completion/preview rules |
| `src/lib/bollinger/flow-confirmation.ts` | Publication, unit, date and market-scoped stored-flow confirmation |
| `src/lib/bollinger/rendering.ts` | Theme style, gapped fill geometry, %B bounds and middle-line policy |
| `src/lib/bollinger/rendering.test.ts` | Exact styles, middle suppression, gaps and scaling |
| `src/lib/bollinger/alerts.ts` | Fifteen local signal names, baseline, financial identity and shared dedup ledger |
| `src/lib/bollinger/export.ts` | Typed CSV metadata/raw numbers and safe text cells |
| `src/lib/bollinger/integration.test.ts` | Timeframes, strict flows, causal exports and local alert integration |
| `src/lib/bollinger/screener.ts` | Bounded cache, symbols, daily normalization/freshness and filters |
| `src/lib/bollinger/screener.test.ts` | Bounds, cache, stale/missing, flow and normalization regressions |
| `src/lib/chart-indicators.ts` | Reuse stable rolling population Bollinger calculation |
| `src/lib/charts/use-analysis-chart-data.ts` | Extend existing same-frame warm-up allowance |
| `src/lib/charts/catalog.ts` | Theme-aware generic/default BB style identity |
| `src/lib/charts/tools.ts` | Canonicalize integer-boundary native roundoff without changing fractional pan/zoom |
| `src/lib/charts/charts.test.ts` | Regression for range normalization and unchanged candle selection |
| `src/lib/charts/persistence.ts` | Validate/migrate scoped Bollinger settings without resetting layout |
| `src/lib/store-migrate.ts` | Preserve Bollinger settings in saved templates |
| `src/components/charts/core/bollinger-fill-primitive.ts` | Native clipped background fill with gap and export support |
| `src/components/charts/core/create-pro-chart.ts` | Series-owned precision/units and native range preservation on plot/axis resize |
| `src/components/charts/pro/useBollingerSystem.ts` | Shared native band, %B/BBW series, pane lifecycle and heights |
| `src/components/charts/pro/BollingerControls.tsx` | Accessible master/settings/modes/children/status and score explanation |
| `src/components/charts/pro/ProChart.tsx` | Connect warm-up, engine, native fill/panes, signals, persistence, alerts and export |
| `src/components/charts/pro/useHtsPanes.ts` | Reserve new native panes while preserving existing HTS heights |
| `src/components/stocks/TradingChart.tsx` | Quick timeframe callbacks and managed-system master connection |
| `src/components/stocks/RangePositionStrip.tsx` | Identify legacy closing-price percentile as distinct from BBW percentile |
| `src/routes/chart.tsx` | Workspace/fullscreen quick-timeframe navigation |
| `src/server/chart-security.ts` | Reuse existing security metadata helpers in screener |
| `src/server/bollinger-screener.ts` | Daily selected-universe analysis and authorized read-only stored Kiwoom confirmations |
| `src/lib/bollinger-screener-fns.ts` | Bounded same-site server function and verified optional flow identity |
| `src/routes/bollinger.tsx` | Manual screener UI, filters, ranking and separate unavailable rows |
| `src/components/layout/Sidebar.tsx` | Existing tools navigation entry |
| `src/routeTree.gen.ts` | Generated route registration |
| `scripts/qa-bollinger-system.mjs` | Strict production native/numeric/migration/export/screener QA; isolated fixture/real modes |
| `scripts/qa-kiwoom-fixture.mjs` | Existing contract with isolated migrations 0002/0003/schema checks |
| `scripts/qa-standard-sma.mjs` | Correct existing fixture contract and actual candle-body regression assertions |
| `package.json` | Add Bollinger test/QA commands and include financial regressions in full tests |
| `docs/upgrade/BOLLINGER_SYSTEM.md` | Implemented formulas, operations, scope and limits |
| `docs/upgrade/BOLLINGER_SYSTEM_VERIFICATION.md` | Actual execution results, preserved failures and honest limitations |

## Final verdict by major requirement

| Requirement | Verdict | Evidence / limit |
|---|---|---|
| Financial formulas, empirical BBW, selected-frame warm-up, causal patterns/no look-ahead | PASS | 55 financial tests; production synthetic numerical/replay checks |
| Native bands/fill/%B/BBW, controls, persistence, themes and responsive price/workspace charts | PASS | All 48 distinct matrix scenarios verified, including the preserved synchronized retest; six focused cases on final source |
| Existing chart functionality, legacy custom indicators, exports | PASS | SMA 20/20, HTS 8/8, legacy 2/2; final strict export/range pilot 4/4 |
| Fifteen local alerts and three-stage workflow | PASS | Pure integration tests and active-session wiring; no server/background claim |
| Daily selected-universe screener | PASS | Bounded server helper tests and 6/6 UI cases; process-local phase 1 scope |
| Strict Korean flow confirmation / U.S. not-applicable | PASS for code and fixtures | Unknown publication/date basis remains unavailable, not zero |
| Real-price/broker data and deployed operational flow | BLOCKED / unverified | No confirmed real-price pipeline or live Kiwoom/operational DB verification in this task |
| Clean dev/production external-resource smoke | PARTIAL | Rendering passed; final dynamic-header baseline differs, external certificate failures and existing branding warnings remain |

GitHub publication is verified separately against remote `main` when this task finishes. The final response identifies the actual published commit. No operational deployment command was executed.

## Operational limitations

- The fixed-IP collector/real Kiwoom connection is not part of this task. Unknown publication times/date basis cannot enter historical Bollinger flow confirmation even when a flow panel displays provider observations.
- Full SMA/HTS browser regressions ran on the native resize-lock build before the last pure integer-boundary canonicalization. The final source's targeted financial/window tests and strict four-case export/range pilot are recorded separately; the full 48-case matrix was not rerun after that correction.
- Current daily and aggregate bars remain previews until the conservative market-date completion rule confirms them. Exchange holiday/early-close finalization is not invented.
- Providers can supply fewer than 200 selected-timeframe bars or 125 valid BBW observations. Missing values stay null; preview mode cannot manufacture history.
- Alerts evaluate new completed events in an active browser session. No background server scheduler, email delivery or 24/7 monitoring is claimed.
- Screener phase 1 is at most ten selected symbols, daily observations, bounded process-local cache/provider worker. It is not a whole-market or distributed scheduler. Its four-calendar-day freshness cutoff is an explicit heuristic, not a verified exchange holiday calendar.
- Existing custom generic Bollinger indicators retain their independent catalog controls. The new master controls the managed Bollinger system; it does not erase custom indicators, drawings or SMA state.
- Public explanation links document common formulas; no proprietary institutional/Fidelity scoring formula is claimed.
