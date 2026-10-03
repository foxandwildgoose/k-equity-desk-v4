# PROGRESS

## Base
- Base commit: `7c154f5` ("Export from Grok"), verified with `git rev-parse --short HEAD` — matches A1, no re-verification differences.
- Node `v22.22.2`, npm `10.9.7`.
- Branch: `claude/new-session-mz0027` (harness-designated session branch; the spec's
  `feat/v3-briefings-robotics-procharts` is **not** created — the harness forbids
  pushing to other branches without explicit permission). Deviation recorded here.

## Baseline gates @ 7c154f5
| Gate | Result |
|---|---|
| `npm run typecheck` | pass (0 errors) |
| `npm test` | pass — 195 script tests + 113 app tests |
| `npm run build` | pass; rewrote 109 tracked files under `.vercel/output/` (restored) |
| `npx eslint .` | 20 errors / 49 warnings (pre-existing; matches A1 table) |

## Mode (A9): **OFFLINE-BUILD**
`npm run verify:sources` (2026-09-26): 61 probed → 61 `blocked` (`x-deny-reason: host_not_allowed`
from the session egress proxy), 3 skipped (env-gated: KIS, Finnhub; builder-only). Hosts denied
include stock.naver.com, m.stock.naver.com, www.hankyung.com, feeds.bloomberg.com,
www.federalreserve.gov, news.google.com, query1.finance.yahoo.com, www.therobotreport.com,
www.sec.gov. Consequences: every source stays `unverified` (candidates `candidate`,
disabled); parsers are built against documented formats and tested with synthetic
fixtures; the UI shows an honest `소스 미검증` state. **Next step for the owner:** rerun
`npm run verify:sources` with normal internet or after switching the environment network
access to "Full".

GitHub (git over the proxy) works: read-only clones of `dd3ok/naverstock-api-skill@47a4274`
and `koreainvestment/open-trading-api` (sparse: `examples_llm/domestic_stock/news_title`,
`examples_llm/kis_auth.py`) were read in P0. The catalog documents list keys
(`articles`, `items`, `researchSets`, `content`, top-level `aid` array) and id fields
(`nid`, `aid`, `researchId`) but **not** per-item field names beyond those, so Naver v2
mappers accept several candidate field names and stay `unverified`.

## Phase status
| Phase | Status | Notes |
|---|---|---|
| P0 | done | docs, registry, probe, baseline |
| P1 | done | kernel, registry, fetch policy, health, UI kit, store v2, D1–D5(name)/D7/D8 |
| P2 | done | /api/feed, news adapters, /news/kr, /news/us, grouped sidebar, LiveNews paging, US MarketBar |
| P3 | done | research v2 adapter + desk, detail sheet, Δ% rule, pre-resolve; US tiers, Street Moves + CSV, briefing |
| P4 | done | ETF news (/news/etf + /etfs tab), robotics section (6 tabs), Federal Register, cross-links |
| P5 | done | /api/wire, Live Wire engine (Web Locks leader), drawer/badge/toasts/OS opt-in, /settings/alerts, SSE hardening |
| P6 | done | ProChart core + Tier A (/stock, /etfs, /us, /chart), Tier B/C chrome, D9 |
| P7 | done | F9 AI layer (off by default), F10.3 dashboard cards, final gates, FINAL_REPORT |

## Decisions
- Dependency: `fast-xml-parser@^5.11.1` (allowed by A6) for RSS/Atom/RDF.
- Date-only timestamps normalize to 12:00 UTC of the calendar date (same date in KST and ET);
  `precision: "day"` prevents any fake clock time.
- Candidates stay `enabled: false` until verified, except Bloomberg (F3.1 MUST) which is
  enabled with status `candidate`, env kill switch, circuit breaker and GN fallback.
- `PUBLIC_RESEARCH` registry is empty: nothing could be verified as public-without-login offline.
- Pure `src/lib/**` modules receive data that lives behind `@/` imports (e.g. `UNIVERSE`)
  as parameters, so tests run under `node --experimental-strip-types`.

- ETF / robotics feeds reuse `/api/feed` with `group=etf|robotics-market|robotics-policy` (fixed registry source sets + server post-processing) instead of new endpoints; one cache, one budget, one health path.
- Google News theme queries carry a recency window (`when:14d` ETF topics, `when:7d` issuer brands and robot market, `when:30d` robot policy) because GN search is relevance-ranked.
- ETF issuer = brand prefix of the ETF name (KODEX → 삼성자산운용 …); the live list carries no issuer field.
- Robotics KR/US basket 1D % = equal weight over resolved rows excluding `indirect` exposure names (stated on the tile).

- Live Wire notifications: OS notifications fire from the elected leader tab only; in-app toasts fire in the visible tab(s). Quiet hours suppress OS notifications and sound; in-app toasts and the badge keep working.
- Wire items are re-scored on the client with the viewer's watchlist/keywords (same kernel as `/api/feed`), so tiers can rise for watch matches.
- `/api/market-stream` accepts an optional `maxMs` (clamped 5–240 s) used by the QA harness to verify reconnects quickly; the default lifetime stays 240 s.

- Pro chart = one `ProChart` component on lightweight-charts v5 (series primitives for drawings, volume profile and session shading); `TradingChart` keeps its data controls and analytics strips around it. Drawing clicks come from DOM pointer events (LWC swallows a second click inside its double-click window).
- Drawing anchors are bar-time keyed (`{t, p}`), so drawings survive reloads and interval-agnostic migration; legacy `ke-chart-draw:{code}` segments (bar-index anchors) are mapped through the daily bar times once and dropped when out of range.
- Chart layout (indicators, drawings, type, scale, overlays) persists per `ked:chart:v2:{market}:{code}:{interval}`; templates live in the store (`chartPrefs.templates`).
- Compare overlay forces the price scale to percent-from-first-visible-bar (native LWC percentage mode) while active.
- Pivot points use the previous bar's H/L/C (labelled P/R1–3/S1–3); 52-week high/low uses a configurable bar lookback (252 daily).

- Dependency: `@anthropic-ai/sdk@^0.128.0` (P7, F9) — the official Anthropic TypeScript SDK for the `anthropic` adapter (typed request/usage/refusal handling, `maxRetries: 0`, 8 s timeout). Server-only (dynamic import from the server fn; not in any client bundle — checked in `.vercel/output/static`). The `xai` adapter uses `fetch` against the documented REST shape (no extra dependency).
- F9 prompts carry numbered items (title, ≤ 240-char source snippet, source, time) but no URLs; bullets are mapped back to on-screen items by `[n]`, so every citation link comes from the input list. Cache (15 min) and the daily cap are in-memory per server instance (stated in ENVIRONMENT.md).
- F10.3 cards reuse existing data paths: Live Wire top 5 reads the shell's wire engine store (no extra request); US snapshot uses the MarketBar's query key (shared cache); 오늘의 리서치 adds `latest` (3 newest) to the cached research briefing (today's rows first, else the same first-page URLs as the research desk); robotics uses the universe query with an `enabled` gate.

## Deviations
- Branch name (see Base).
- FeedList "virtualization" uses native `content-visibility: auto` on rows above 200 (no new dependency).
- `retrySource`, `generateAiBriefing` and `translateAiHeadlines` are POST server functions (user-initiated mutations; zod-validated like the GET ones); everything else is GET.
- Extra optional env `FEED_SOURCES_DISABLED` (comma list of registry ids) as a server-side kill switch alongside the registry `enabled` flag.
- Source health is in-memory per server instance (serverless instances keep separate views; stated on the page).
- KRX tick table (unified 2023 stock table, ETF/ETN flat 5 KRW) could not be re-verified offline; used only for drawing snap.
- F1.6 KR calendar strip omitted (spec: only with a verifiable source). F3.7 US earnings-today not built (Nasdaq calendar JSON unverified).
- KIS news titles have no public original page; rows link to a Naver news search for the title and say so in the snippet.
- Naver AI briefing links to https://stock.naver.com/ (no per-briefing page route is documented).
- 관심종목 research filter covers the first 10 of watchlist ∪ former featured names (v2 accepts ≤ 10 itemCodes per call).
- Research "페이지" links use finance.naver.com `*_read.naver?nid=` routes (existing app pattern; v2 page routes are undocumented).
- Client re-scores importance with the viewer's watchlist/keywords (server score is watch-agnostic because `/api/feed` is CDN-cached).

- F5.3 "상장 예정 in the next 14 days": headlines carry no machine-readable listing date, so the briefing shows listed/scheduled stories published in the last 14 days (labelled `최근 14일 보도`).
- F6.5 US market cap shows `—`: the Yahoo chart response has no market cap and no other verified keyless source exists; KR market cap comes from the Naver quote.
- F6.7 OFFICIAL filings for US robot tickers load on demand per symbol (reuses `CompanyOfficial`); PUBLIC_RESEARCH registry is empty so the PUBLIC column shows the registry note.
- `robotics-universe` is a registry pseudo-source (no URL) whose health row lists unresolved names; it has no adapter, so `/status/sources` shows 「기존 모듈 경로」 and retry is disabled for it.
- Yahoo 1D change basis fixed kernel-wide: `previousClose` → prior session close from daily bars → `chartPreviousClose` only when it is the prior session (the P2 5-day tiles would otherwise show a 5-day change).

- Price alerts: the evaluator (AT-33) and the settings list ship in P5; creating horizontal-line alerts from charts lands with the P6 chart workspace.
- Web Push (background notifications with the browser closed) is out of scope — needs VAPID keys, subscription storage and a scheduler; stated on `/settings/alerts`.

- F7.18 TradingView widget tab (COULD) not built.
- F7.11 alerts evaluate on chart data refresh; KIS stream ticks update quote caches only (no intrabar chart updates).
- Tier B: InvestorFlow and the valuation multiple chart keep their own domain HUD/window controls; they gained the shared theme/formatters, status line, fullscreen, PNG/CSV (and log where sensible). Their existing tests stay green.

- F9 cost: only token counts are shown (no provider price table is hard-coded; prices change). `AI_EFFORT` is an extra optional env for Anthropic `output_config.effort`.
- F9 xAI adapter follows the documented chat-completions REST shape but could not be exercised offline (egress blocked, no key).

## Blockers
- Network egress denies every market-data host (not a credential issue). No paid service needed.

## Phase log
### P1 — foundations (done)
1. Kernel: `src/lib/feed/{types,time,sort,text,rss-parse,cluster,importance,tickers,filters,briefing,mappers}.ts` + tests (AT-01..05).
2. Server: `src/server/feeds/{registry,http,health,runner}.ts`, `src/lib/feed-fns.ts`, `/status/sources` page with toggles + 지금 재시도.
3. Store v2 (`store-migrate.ts`, AT-08), chart formatters + KRX tick (AT-06), attribution footer (AT-07), popup-safe opener (D2).
4. D1 call sites moved onto the kernel (research, disclosures, us-street, us-link, official); fabricated `00:00`/"now" timestamps removed.
5. Gates: typecheck 0 · tests 201 + 150 pass · ESLint changed files 0 errors · build ok · qa:smoke ok (dashboard hydration race fixed).

### P2 — news (done)
1. Adapters (`src/server/feeds/adapters/news.ts`): Naver list/focus/world/search, generic RSS/Atom (Hankyung, Fed, Bloomberg headline-only), Google News groups (via the reused `fetchGoogleNewsRss` path now on `fetchWithPolicy`), KRX/DART disclosures, KIS news-title (token ≤ 1/min), Finnhub, SEC 8-K (candidate), Finviz ratings.
2. `GET /api/feed` (budget 7.5 s, partial, cursor, `s-maxage=30, swr=60`), `useFeed` (merge without dups, client re-score with watchlist/keywords, source toggles).
3. `/news/kr` (indices + USD/KRW tiles, KRX session, digest, Naver AI briefing card), `/news/us` (11 delayed Yahoo tiles, NY session estimate, KST/ET toggle, 7-day Fed/BEA calendar), `/news` → `/news/kr`.
4. Grouped sidebar; LiveNews paging via kernel; MarketBar US segment (delayed); US watchlist + keyword-watch editors on /watchlist.
5. Gates: typecheck 0 · tests 201 + 161 · ESLint changed 0 errors · build ok · qa:smoke 34/34 · qa:acceptance AT-09/11/12/13 pass (mocked data in the QA harness only).

### P3 — research (done)
1. `src/lib/research/naver-v2.ts` (tolerant v2 mappers, goal-price sets, Δ% rule, new-coverage heuristic), `src/server/research-v2.ts` (v2 → legacy fallback with path in health, detail + detail-page, briefing strip data, pre-resolve cache 10 min), server fns in market-fns.
2. `/research` KR: `KrResearchDesk` (7 tabs + 관심종목, date headers, `오늘 · 이번 주 · 전체 totalCount`, 더 보기 by index, industry taxonomy chips, broker filter, briefing strip, KR Street Moves), shared `ResearchCard` (PDF 원문 anchor or popup-safe resolve, 리서치 페이지, 상세) + `ResearchDetailSheet` (extractive bullets, prev/next, broker filter). BrokerReports uses them; stock bundle prefers v2 company list. Fixed 7-stock list removed.
3. `/research?market=us`: exact scope banner, US research briefing, Street Moves table (filters, sticky header, CSV of visible rows), tier badges (OFFICIAL/PUBLIC/STREET/NEWS), universe = first 12 of usWatchlist ∪ US_STREET_SYMBOLS ∪ robotics US (20-min cache, 3 concurrent). `/us-research`: banner, 기간 filter default 최근 30일, newest-first grids, Exhibit 99 labels.
4. Robotics classifier (D5/F6.8) + `src/data/robotics.ts` universe data.
5. Gates: typecheck 0 · tests 201 + 170 · ESLint changed 0 errors · build ok · qa:smoke 32/32 · qa:acceptance AT-15/16(+mobile, fallback)/18/19/20 pass.

### P4 — ETF news + robotics (done)
1. Pure modules: `src/lib/etf-news.ts` (stage/theme/brand, `isEtfStory`, longest-name `matchEtf`, `enrichEtfStory`, filters, `buildEtfBriefing`), `src/lib/robotics/classify.ts` (robot topics, policy status chips from keywords only, Federal Register relevance filter/mapper/URL, robot ETF discovery, exact-name resolution, basket stats) + tests (AT-22/24/26/27).
2. Feed: registry `gn-etf-brands`, `gn-robot-policy-kr/en`, `robotics-universe`; adapters `adapters/themes.ts` (GN theme groups, Federal Register JSON); `/api/feed?group=` with ETF enrichment from the live ETF list and robot topic/status stamping; `FeedItem.etf`; theme chips + ETF match strip in `FeedRow`.
3. `/news/etf` (+ `/etfs` 「ETF 뉴스」 tab): briefing digest (trading-value tiles, robot/AI ETF chips, listing/delisting/flow/retirement lists), issuer/stage/theme/retirement filters, newest first.
4. `/robotics` (overview · market · policy · companies · research · etf): `src/server/robotics.ts` runtime universe verification (unresolved hidden + listed in Source Health), KPI tiles with sources, movers, latest 5s, company tables + news drawer + add/hide/restore, research (v2 industry robot filter + company ≤ 10 codes/call, Street moves, OFFICIAL on demand), KR regex ETFs + verified US ETFs. Cross-links: `/industry/robotics` card, sidebar sector row → `/robotics`, sidebar 테마 group + ETF 뉴스 item.
5. Fixes: Yahoo 1D basis (prior session), `/industry/$sectorId` hydration race (mounted guard).
6. Gates: typecheck 0 · tests 201 + 182 · ESLint changed 0 errors · build ok · qa:smoke 46/46 (23 routes × 2) · qa:acceptance AT-22/23/25/28 pass · verify:sources OFFLINE (64 blocked, 4 skipped).

### P5 — Live Wire (done)
1. `GET /api/wire?regions=` (canonical sorted regions, newest 100, high-frequency registry subset whose fetch TTL = registry pollSec per the F8.1 table, cluster + score, etf/robotics topic tags, `s-maxage=20, swr=40`, 7.5 s budget, partial).
2. `src/lib/wire/live-wire.ts` (pure): cadence 20/60/180 s + backoff ≤ 5 min, id + cluster dedupe with first-load seeding, region/category toggles, KST quiet hours, notification planner (≤ 5 / 10 min + one digest; OS only with permission, leader, flash or watch match). `src/lib/alerts/price-alert.ts` crossing evaluator. Tests: AT-31/32/33.
3. `useLiveWireEngine` / `useLiveWire`: Web Locks leader (fallback localStorage heartbeat), BroadcastChannel page sharing, persisted seen markers + unread, sonner toasts, OS notifications (click focuses tab and opens the drawer on the item), WebAudio beep.
4. UI: header bell + unread badge, right drawer (전체·한국·미국·ETF·로봇·관심종목, min tier, sources, pause, 데스크톱 알림 켜기), optional desktop ticker tape; `/settings/alerts` (in-app, OS, quiet hours, regions, categories, sound, ticker, price-alert list); sidebar 도구 → 알림 설정.
5. SSE: `retry: 3000`, proactive close at 240 s with a `reconnect` event, client `재연결 중` state, Naver snapshot fallback unchanged.
6. Fixes: `/news/kr` and `/news/us` hydration races (shell queries settling before the lazy route hydrates) → mounted guards.
7. Gates: typecheck 0 · tests 201 + 188 · ESLint changed 0 errors · build ok · qa:smoke 40/40 (20 routes × 2) · qa:acceptance 19/19 (AT-09…AT-34 browser set).

### P6 — pro charts (done)
1. Pure: 18 new indicators in `chart-indicators.ts` (WMA, HMA, Keltner, Donchian, Ichimoku, PSAR, Supertrend, Anchored VWAP, OBV, Volume Profile, Stoch RSI, ADX/DMI, CCI, MFI, Williams %R, pivots, N-bar high/low, Heikin-Ashi) with known values from an independent reference; `src/lib/charts/{catalog,drawings,persistence,tools,bar-time}.ts` (catalog + memo keys, drawing model + undo/redo + fib/position/measure maths + KRX tick/magnet snap, layout persistence + legacy migration, replay/sessions/compare/export helpers); indicator alerts in `price-alert.ts`. Fixed `rsi([])` returning a phantom point.
2. Core: `charts/core/{theme,create-pro-chart,sync,export,ChartShell,chrome,ChartFrame}` — CSS-var theme, shared options (attribution link rule kept), crosshair/time sync with HUD propagation, PNG/CSV, status line, fullscreen, `?` help, mobile bottom sheet.
3. `ProChart`: 7 chart types, 4 scales, catalog dialog + templates, 15 drawing tools with handles/lock/hide/object manager/undo-redo, compare ≤ 3, overlays (disclosures, news counts → list, research TP, US dividends/splits, RSI/MACD signals), chart alerts via the Live Wire notifier, replay (1–10×), US pre/post toggle + session shading, 10k bar cap, memoized indicators. `TradingChart` rebuilt around it; fullscreen opens `/chart` (1/2/4 panes, synced crosshair, optional synced interval, per-pane search).
4. Tier B: ValuationBand, ValuationHistory (weekly + multiples), InvestorFlow, ExportDual on the shared theme/formatters + ChartShell (status, fullscreen, PNG/CSV; presets/log/% where sensible; ExportDual now dual-axis). Tier C: ExportDesk bar chart in `ChartFrame` (title, unit, source/as-of, aria, PNG/CSV); Sparkline role=img + label. D9 hook hoisted.
5. Gates: typecheck 0 · tests 201 + 207 · ESLint changed 0 errors · build ok · qa:smoke 40/40 (20 routes × 2) · qa:acceptance 26/26 (incl. AT-36/38/41/42/43/44, 5,000-bar perf: 0 long tasks).

### P7 — AI layer, dashboard, final QA (done)
1. F9: `src/lib/ai/{briefing,config}.ts` (input normalization ≤ 30, FNV-1a input hash, prompts, cited-bullet validator, translation parser, env gate) + `briefing.test.ts` (AT-46 unit); `src/server/ai/{provider,service}.ts` (anthropic SDK + xai adapters, 8 s timeout, no retries, refusal handling, 15-min cache, daily cap); `src/lib/ai-fns.ts` (zod-validated server fns); `AiBriefingPanel` + `AiTranslateButton` rendered only when the server reports the layer enabled. Wired into `/news/kr`, `/news/us` (+ 기계 번역), `/news/etf` and the `/etfs` tab, KR research desk, US research briefing, robotics overview.
2. F10.3: `src/components/dashboard/BriefCards.tsx` (Live Wire 최신 5 · 오늘의 리서치 · 미국 스냅샷 · 로봇 스냅샷) behind `deferSecondary`; `latest` in the research briefing payload.
3. QA: browser AT-46 (off → no AI UI on /news/kr and /news/us; mocked-on → no call before click, label, 3 citation links to input URLs, rejected-count and token footer, 기계 번역 row) and F10.3 card checks added to `qa:acceptance`; AT-45 via qa:smoke (disclaimer + attribution on all 20 routes × 2 viewports); AT-48 build audit (no FS writes in server output; SDK only in the server function).
4. Gates: see FINAL_REPORT.md.

## Next steps
- Owner: set env vars (ENVIRONMENT.md), rerun `npm run verify:sources` with normal internet, flip verified candidates in the registry, deploy.
