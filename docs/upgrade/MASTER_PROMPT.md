===== PROMPT START =====

# K-Equity Desk v2 → v3 Upgrade — Claude Code Master Prompt (final)

News · Research · ETF · Robotics · Pro Charts · Live Wire
Prepared 2026-09-26 against `foxandwildgoose/k-equity-desk-v2` commit `7c154f5`.

You are working in the repository `foxandwildgoose/k-equity-desk-v2` (the app is called "Korea Equity Command Center"). Work as a senior full-stack engineer who has shipped buy-side market terminals. Hold yourself to three standards at once: a markets product lead's (information density, speed, newest-first, provenance on every item), a quant's (every number traceable and tested), and a compliance officer's (licensing, source terms, nothing fabricated).

Your job is to understand the repository first, then extend it with the eight capabilities below without breaking anything that already works:

1. **KR News Briefing**: a briefing of the latest Korean stock-market news.
2. **KR Research Briefing**: a briefing of Korean broker research. Clicking a report opens the original (PDF or page). Newest first everywhere.
3. **US News Briefing**: a briefing of the latest US stock-market news.
4. **US Research Briefing**: a US research briefing. Clicking an item opens the original document. Newest first everywhere.
5. **KR ETF News Briefing**: a briefing of the latest Korean ETF market news.
6. **Robotics section (new)**: Korean and US robot market trends, policy trends, and robot company trends, plus research summaries with links to the originals.
7. **Pro charts**: upgrade every chart in the app to professional, TradingView-class functionality that a Wall Street professional would use.
8. **Live Wire**: real-time alerts for important market news from Bloomberg and other major sources. In-app alerts always; OS alerts only when the user opts in.

Part A contains verified facts, constraints, and decisions, and these override your defaults. Read all of Part A before you change any code. Part B is the feature specification. Part C says how to prove the work is done and how to report it.
Write chat status updates and the final report in Korean. Write code, comments, and commit messages in English.

---

# PART A — CONTEXT, RULES, WORKING METHOD

## A1. Ground truth (verified 2026-09-26 at commit `7c154f5`, Node 22.22)

If `git rev-parse --short HEAD` is not `7c154f5`, re-verify every statement in this section. Record any differences in `docs/upgrade/PROGRESS.md` before you rely on them.

**Stack**
- The app is TanStack Start (React 19) on Vite 8, with TanStack Router file routes in `src/routes/`. The router plugin generates `src/routeTree.gen.ts` during `vite dev` and `vite build`. Never edit that file by hand. Regenerate it by running dev or build, then commit it.
- TanStack Query hooks live in `src/lib/use-market.ts`. Server functions live in `src/lib/market-fns.ts` and follow the pattern `createServerFn({ method: "GET" }).validator(zodSchema)`. Use `.validator`, not `.inputValidator`.
- The server-only adapters live in `src/server/`:
  - `naver-market.ts`: quotes, OHLC (Yahoo and Naver), research, per-stock news, disclosures, and indices.
  - `industry-research.ts`: the Naver industry-list HTML and Hankyung Consensus.
  - `us-link-feed.ts`: exports `fetchGoogleNewsRss`.
  - `etf-news.ts`: ETF listing news from Google News RSS.
  - `etf-market.ts` and `krx-disclosures.ts`.
  - `us-official-research.ts`: SEC, Fed, BEA, and BLS, with a host allowlist and an SEC throttle.
  - `kis-realtime.ts`: the KIS KRX WebSocket hub (TR `H0STCNT0`).
  - `src/lib/us-street.ts` sits outside this folder and handles Finviz ratings and Nasdaq consensus.
- The SSE route pattern is `src/routes/api.market-stream.ts`, which uses `createFileRoute(...)({ server: { handlers: { GET } } })`. Its client is `src/lib/use-market-stream.ts`.
- State lives in a zustand `persist` store, `src/lib/store.ts`, under the key `korea-equity-cc`. The store has no `version` yet and holds only a KR watchlist.
- The UI uses Tailwind v4, Radix primitives in `src/components/ui/`, and `lucide-react`. `sonner` is installed but not used anywhere.
- Layout components:
  - `src/components/layout/AppShell.tsx`.
  - `Sidebar.tsx`, with a flat `NAV` array of 8 items.
  - `MarketBar.tsx`, which shows only KOSPI, KOSDAQ, and KOSPI200.
- Charts use `lightweight-charts@^5.2.1` in these components:
  - `src/components/stocks/TradingChart.tsx`, about 2,040 lines. It already has:
    - candles and volume;
    - moving averages: MA5/20/60/120 and MA50/200;
    - Bollinger Bands, VWAP, and ATR;
    - RSI and MACD panes, plus percentile bands;
    - drawings: trend, ray, fib, measure, and horizontal line, with a magnet;
    - log scale and auto support/resistance;
    - markers for RSI divergences, MACD crosses, and disclosures.
  - `ValuationBandChart.tsx`, `ValuationHistoryChart.tsx`, and `InvestorFlow.tsx`.
  - `src/components/export-desk/ExportDualChart.tsx`.

  There is also one `recharts` `BarChart` in `ExportDesk.tsx`, plus `Sparkline.tsx`. Indicator math is in `src/lib/chart-indicators.ts`, which has tests.
- Research UI:
  - `src/components/stocks/ResearchDesk.tsx`: a KR/US switch, with KR tabs industry, market, economy, and featured.
  - `UsResearchDesk.tsx`: Finviz notes, Nasdaq consensus, and headlines.
  - `src/components/research/ResearchHome.tsx`: the `/us-research` page of official SEC, Fed, BEA, and BLS documents.
  - `BrokerReports.tsx`: research on each stock page.

  Per-stock news is rendered by `src/components/stocks/LiveNews.tsx`.
- Data files:
  - `src/data/universe.ts`: 144 KR names.
  - `sectors.ts`: 16 sectors, including `robotics`.
  - `research-taxonomy.ts`, `us-link.ts`, and `etfs.ts`.
- Current routes: `/`, `/etfs`, `/etfs/$code`, `/us-link`, `/us-research`, `/us-research/$reportId`, `/us/$symbol`, `/export-desk`, `/research`, `/disclosures`, `/watchlist`, `/industry/$sectorId`, `/stock/$ticker`, `/api/market-stream`.

**Baseline gates at `7c154f5`**
- `npm run typecheck` passes.
- `npm test` passes: 195 script tests and 113 app tests.
- `npm run build` passes, but it rewrites about 109 **tracked** files under `.vercel/output/`.
- `npx eslint .` fails with 20 errors and 49 warnings that were already there. Do not fix lint across the whole repo. The 20 errors are:

  | File | Errors |
  |---|---|
  | `src/server/krx-disclosures.ts` | 13 × `no-useless-escape` |
  | `src/components/stocks/TradingChart.tsx` | 2 × `prefer-const` |
  | `src/server/naver-market.ts` | 2 × `prefer-const` |
  | `src/routes/api.market-stream.ts` | 1 × `prefer-const` |
  | `src/components/export-desk/ExportDesk.tsx` | 1 × `react-hooks/rules-of-hooks` (a real bug, see D9) |
  | `src/lib/app-data/client.server.ts` | 1 × `no-empty` (Grok-owned; never touch) |

  Because the lint gate (C1.3) covers changed files, fix a file's errors when you touch it.

**Known defects you must fix**
- **D1 — newest-first is not guaranteed.** The call sites:
  - (a) `ResearchDesk.tsx`, `BrokerReports.tsx`, `industry-research.ts`, and `research-utils.ts` (`latestReportPerBroker`) sort with `b.date.localeCompare(a.date)`. The date strings come in mixed formats: `industry-research.ts` emits `YYYY.MM.DD`, while other paths pass the raw `writeDate` through. Because `'-' < '.'`, mixed formats sort in the wrong order, and ties on the same day come out in arbitrary order.
  - (b) The research merges in `naver-market.ts` compare those same mixed strings with `a.date < b.date`.
  - (c) `us-street.ts` orders notes by day, then by ticker symbol, so there is no intraday order. Headlines are concatenated symbol by symbol and then cut with `slice(0, 40)`. The list is therefore not chronological, and newer headlines for later symbols get dropped.
  - (d) `ResearchHome.tsx` merges its lists without sorting them.
  - (e) The disclosure merges (`krx-disclosures.ts`, `getScanDisclosures` in `market-fns.ts`, `routes/disclosures.tsx`) compare raw `datetime` strings coming from different sources. Verify their formats and move them onto the kernel (B0.2).
- **D2 — "원문 보기" can be popup-blocked.** `openPdf()` waits for a server call and only then calls `window.open` (in `src/lib/research-deep.ts`). By then the browser has dropped the user's click activation, so the new tab can be blocked, notably on iOS Safari.
- **D3 — KRW price scales show two decimals**, for example `400000.00` in `screenshots/trading-chart-hud.png`. `TradingChart.tsx` sets `priceFormat` only for US symbols.
- **D4 — license gap.** Every chart sets `attributionLogo: false`, and the app has no link to https://www.tradingview.com/. Lightweight Charts requires the NOTICE attribution plus a link. The logo may be turned off only if that link is provided somewhere else.
- **D5 — robotics taxonomy.** The robotics classifier in `research-taxonomy.ts` matches bare `AI` and `인공지능`, so generic AI reports get filed as robotics. Separately, `universe.ts` gives `클로봇` the nameEn `"CLOi Bot"`; it should be `"CLOBOT"`.
- **D6 — hard caps pass for "latest".**
  - The research desk fetches only 80, 50, and 40 rows.
  - The "기업" tab is 7 hard-coded stocks with 2 reports each.
  - The US universes are 6 tickers (official) and 10 tickers (street).
- **D7 — SEC User-Agent is a placeholder**: `KoreaEquityDesk research@example.com` in `us-official-research.ts`.
- **D8 — missing env example.** The README says `cp .env.example .env`, but there is no `.env.example`, and `.gitignore` ignores `.env.*` anyway.
- **D9 — conditional hook call.** `ExportDesk.tsx` (around line 483) calls the hook `useAllObservations()` inside JSX behind `demo && …`. That is a Rules of Hooks violation, and it can crash the page when `demo` toggles. When you touch this file for F7.17, hoist the hook call to the top of the component.

## A2. Platform contracts (binding)

The app must stay re-importable into Grok Build and deployable to Vercel.

`AGENTS.md` was written for the Grok Build sandbox ("You are Grok Build", `/workspace`, live preview on :8080). The following parts of it are **binding**:
- Do not recreate or restructure `vite.config.ts` or `tsconfig.json`. Keep:
  - the ports: dev on `0.0.0.0:8080` with a strict port, and preview on `127.0.0.1:8081`;
  - the build/preview-gated `nitro({ preset: "vercel", serverDir: "./server" })`;
  - `grokPwaPlugin()`, `appEnvPlugin()`, `authPopupPlugin()`, and `pgliteBootstrapPlugin()`.
- Never delete or modify:
  - `public/__grok/`, `server/`, `scripts/grok-pwa-*`, `startup.sh`, `.grok/`, `AGENTS.md`, `AGENTS.project.md`, `attachments/`, `artifacts/`;
  - the pre-wired `src/lib/auth/*`, `src/lib/app-data/*`, and `src/lib/db.ts`.
- Keep `<PreviewHostBridge />` and `<CreatedWithGrokBanner />` in `src/routes/__root.tsx`. Do not put `og:*` or `twitter:*` meta tags there. Do not add a CSP that blocks `https://grok.com`.
- Auth stays OFF and there is no database. That means no migrations, no `@/lib/db` imports, and no `authMiddleware`. All per-user state lives in the browser, in zustand persist or localStorage.
- Server-only secrets never get a `VITE_` prefix. Never create `.env` files in the repo.
- The build must work on Vercel:
  - no runtime filesystem writes;
  - no server-only Node APIs running at import time in client code;
  - no hard-coded hosts or ports for the app itself (external source URLs in the registry are fine);
  - no secrets in code.

These Grok-only workflow steps do **not** apply, so do not run or emulate them:
- running `startup.sh`, or anything under `/workspace` paths;
- `scripts/browser-smoke.mjs`, which is hard-wired to `/workspace`;
- preview-proxy workflows;
- the `og` brand-pass subagent;
- `imagine_*` tools;
- `.grok/skills/*` game and art skills.

## A3. Non-negotiable product rules

1. **Never fabricate data.** Every number, headline, rating, target price, date, and link must come from a fetched source. If a value is unknown, show `—` and the reason. Synthetic fixtures are allowed only inside `*.test.ts` files, marked `// synthetic fixture (format sample), not market data`, and never reach the UI.
2. **Every item carries its provenance**: source name, `publishedAt` (or `날짜 미상` when unknown), `fetchedAt`, and a `원문` link to the original. Paywalled sources get a `유료` badge.
3. **Newest first everywhere.** Every news, research, policy, and filing list defaults to newest first, using one shared comparator (B0.2). The server returns lists already sorted. The client never re-sorts by raw date strings.
4. **Summaries are deterministic and extractive by default.** Reuse or extend `buildResearchExecutiveSummary`. AI-written text exists only in the optional F9 layer. It must be user-initiated, carry citations, and be labeled `AI 요약 · 원문 확인 필요`.
5. **Korean first.** Use the existing Korean UI tone and KST by default. US pages offer a KST/ET toggle. English source titles stay in English unless the user explicitly runs F9 translation, which is labeled `기계 번역`.
6. **Not investment advice.** Reuse `RISK_DISCLAIMER` from `src/data/market.ts` on every new page.

## A4. Licensing and source etiquette (mandatory)

- **Chart engine.** Keep the open-source `lightweight-charts`, which is Apache-2.0 and allows personal and commercial use. **Do not** integrate TradingView's "Advanced Charts" or "Trading Platform" libraries. TradingView licenses those only to companies for public web projects, which excludes personal and hobby use, and they require your own datafeed. Fix D4.
- **TradingView widgets** (the free embeddable ones) are allowed only as an optional secondary view (F7.18). Their data is delayed, some symbols cannot be shown in widgets, and their attribution must stay intact.
- **Bloomberg.** No Bloomberg data API is available to an individual; the Terminal, B-PIPE, and event feeds are all enterprise products. So:
  - Use only the public RSS headline feeds: headline, link, and time.
  - Poll no more often than every 5 minutes, and never fetch article bodies.
  - On a 403 or 429, stop (circuit breaker).
  - Honor the `NEWS_BLOOMBERG_ENABLED` switch (env default `true`, per A8) and also give the user an in-app toggle.
  - As a fallback, use Google News RSS with `site:bloomberg.com`.
- **Naver and stock.naver.com.** These endpoints are unofficial and undocumented, and the public site's robots.txt disallows crawling. Use them only as a personal, low-volume, cached, read-only client:
  - no bulk crawling;
  - no bypassing rate limits or anti-bot measures;
  - no cookies or credentials;
  - never call endpoints that record views, such as `/api/stockSecurity/researches/v2/{type}/{id}/view`.
- **Paywalls and republishing.** Never bypass paywalls or logins, and never republish the full text of an article or report. Show only:
  - the headline;
  - a source-provided snippet of at most 240 characters;
  - our extractive summary.

  Link out to the original for everything else.
- **Kill switch and health.** Every source in the registry has an on/off switch, and source health is visible to the user.

## A5. How you work

1. **Phase 0 is reading only; write no feature code.** Read:
   - `README.md`, `AGENTS.md`, `package.json`, `vite.config.ts`, `src/routes/__root.tsx`, `src/lib/market-fns.ts`, and `src/lib/use-market.ts`;
   - every file named in A1;
   - the Naver catalog index at `artifacts/browsed_files/58063a8bbb92052c.text`.

   Also clone two public repos, read-only, into a temporary directory outside this repo:
   - `github.com/dd3ok/naverstock-api-skill`. Read `references/api-content.md`, `references/api-home-market-fund.md`, `references/safety-rules.md`, and `references/known-limitations.md`.
   - `github.com/koreainvestment/open-trading-api`. It is large, so use `git clone --depth 1 --filter=blob:none --sparse` and check out only what you need: `examples_llm/domestic_stock/news_title/` and `examples_llm/kis_auth.py`.

   You may use parallel read-only subagents for discovery, but never run parallel agents that edit the same files.
2. **Create these files and keep them current.** They are your memory across context compaction; after any compaction, re-read SPEC and PROGRESS before you continue. If this prompt has also been saved in the repo (for example as `docs/upgrade/MASTER_PROMPT.md`), that file is the authoritative spec.
   - `CLAUDE.md`, at most 120 lines, covering:
     - the commands and the A2 invariants;
     - the A3 and A4 rules;
     - the code conventions (A6) and git policy (A7);
     - the list of Grok-only steps to ignore.
   - `docs/upgrade/SPEC.md`: this prompt condensed into a checklist of requirement IDs (F1.x … F10.x, AT-xx). No requirement may be dropped.
   - `docs/upgrade/PLAN.md`: phases, files to touch, and risks.
   - `docs/upgrade/PROGRESS.md`:
     - the base commit and the baseline gate results;
     - the mode (A9) and per-phase status;
     - decisions, deviations, blockers, and next steps.
   - `docs/upgrade/ENVIRONMENT.md`: the environment-variable table from A8.
3. **Run the environment probe (A9)** and record the mode.
4. **Execute P1 through P7 in order (A10).** Keep a todo list that mirrors PLAN.md. At the end of every phase:
   - run the gates (C1);
   - commit;
   - write a five-line status in PROGRESS.md.
5. **Do not stop for approval between phases.** Ask me only in these cases:
   - you need a credential or a paid service;
   - an action is destructive or irreversible (rewriting history, or deleting tracked files outside this spec);
   - a MUST requirement is impossible. In that case, build the closest honest alternative and document it.
6. **Near your context or time limit,** stop only at a phase boundary where all gates are green, and write the exact next steps into PROGRESS.md.

## A6. Code conventions

- **Pure logic goes in `src/lib/**`.** That covers parsing, time, sorting, clustering, scoring, formatting, and indicators.
  - These modules import runtime values only through relative paths with the `.ts` extension, for example `import { x } from "./time.ts"`. The `@/…` aliases are allowed only as `import type`.
  - They must not use enums, namespaces, parameter properties, decorators, or JSX, because the tests run with `node --experimental-strip-types`.
- **Register every new test.** The `"test"` script in `package.json` lists test files explicitly, so every new `*.test.ts` must be appended to it or it will never run. Files named `scripts/*.test.mjs` are picked up automatically by the existing glob.
- **Where code goes:**
  - server adapters in `src/server/**`;
  - server functions in `src/lib/market-fns.ts` or a sibling `src/lib/*-fns.ts`;
  - hooks in `src/lib/use-*.ts`;
  - new HTTP endpoints in `src/routes/api.*.ts`, following the pattern of `api.market-stream.ts`, never in `server/`.
- **Validate and time out.** Validate every server-function and API input with zod. Every outbound fetch has a timeout: 8 s or less, or 10 s or less for PDFs and HTML pages.
- **Reuse existing helpers** before writing new ones:
  - `fetchGoogleNewsRss`;
  - `decodeHtmlEntities` and `htmlToReadableText` (in `src/lib/readable-text.ts`);
  - `safeExternalUrl` (in `src/lib/us-street.ts`);
  - `matchesSearchQuery`, `formatPrice`, `formatPct`, `normalizeKrTicker`, and `usePriceColors`.
- **Dependencies:**
  - Allowed: `fast-xml-parser`, for RSS and Atom.
  - Optional: `@tradingview/lwc-plugin-vertical-line`, which has a peer dependency on `lightweight-charts ^5`.
  - Anything else must be justified in PROGRESS.md. Prefer code with no new dependencies.

## A7. Git policy

- Create the branch `feat/v3-briefings-robotics-procharts` from the current HEAD, and record the base commit.
- Never commit regenerated build output. Before every commit, run:
  `git restore --staged --worktree -- .vercel && git clean -fdq -- .vercel/output`
- Put QA artifacts in `.qa/` and add `.qa/` to `.gitignore`. Do not add files to `screenshots/`.
- Make one or more commits per phase, using Conventional Commits (`feat(news): …`, `fix(research): …`).
- At the end, push the branch and open a PR if you have permission. If not, leave the commits local and say so.

## A8. Environment variables

Document these in `docs/upgrade/ENVIRONMENT.md`. All of them are server-only, and every feature must degrade gracefully when they are unset.

| Variable | Purpose | If missing |
|---|---|---|
| `KIS_APP_KEY`, `KIS_APP_SECRET` | Existing KIS realtime ticks, plus optional KIS news titles (F1.1). | Naver snapshots are used, and the KIS news source is disabled. |
| `SEC_USER_AGENT` | The SEC fair-access User-Agent with a real contact, e.g. `KEDesk you@your-domain`. | Keep the current UA and show `SEC UA 미설정` in Source Health. |
| `FINNHUB_API_KEY` | Optional extra US company news. | The source is disabled. |
| `NEWS_BLOOMBERG_ENABLED` | Bloomberg kill switch. Default `true`. | Treated as `true`. |
| `AI_BRIEFING_ENABLED`, `AI_PROVIDER` (`anthropic` or `xai`), `AI_MODEL`, `ANTHROPIC_API_KEY` or `XAI_API_KEY`, `AI_DAILY_CAP` | Optional F9 AI layer. | F9 is hidden. |

Fix D8 by rewriting the README's environment section so that it points to `docs/upgrade/ENVIRONMENT.md`. Keep the README in Korean.

## A9. Environment probe (Phase 0)

Write `scripts/verify-sources.mjs` and add it to `package.json` as `"verify:sources"`. The script:
- reads the source registry (B0.3);
- sends **one** small GET to each enabled source, following A4;
- writes `docs/upgrade/SOURCES_STATUS.md` with, for each source: the id, URL, HTTP status, latency, number of parsed items, newest `publishedAt`, and a verdict of `ok`, `empty`, `blocked`, `error`, or `parse-fail`.

Which mode you are in decides what you do next:

- **`OFFLINE-BUILD` mode.** You are in this mode if most external hosts fail with network or proxy errors, such as `CONNECT tunnel failed … 403` or DNS failures. This is typical of Claude Code on the web with "Trusted" network access.
  - Build the adapters against the documented formats, and test the parsers with small synthetic fixtures.
  - Keep every source's status `unverified`.
  - Make the UI show an honest `소스 미검증` state rather than panels that just look empty.
  - At the end, tell me to rerun `npm run verify:sources` on a machine with normal internet, or after switching the environment's network access to "Full".
- **`LIVE-VERIFIED` mode.** Fix or disable every failing source before you close the phase that owns it.

## A10. Phases, priorities, exit criteria

Priorities use MoSCoW: MUST ships; SHOULD ships unless blocked (document the block); COULD is a stretch goal.

| Phase | Scope | Exit criteria |
|---|---|---|
| P0 | Reconnaissance; `CLAUDE.md` and `docs/upgrade/*`; baseline gates; environment probe; branch. | Docs exist, and the baseline and mode are recorded. |
| P1 | Foundations B0: time/sort kernel, feed kit, registry, health, UI kit. The store v2 migration (F10.2). Quick fixes D1, D2, D3, D4, the D5 name fix, D7, and D8. | AT-01 to AT-08 pass, and the gates are green. |
| P2 | F1 KR news, F3 US news, `/api/feed`, and the grouped sidebar skeleton (F10.1). | AT-09 to AT-14. |
| P3 | F2 KR research and F4 US research. | AT-15 to AT-21. |
| P4 | F5 ETF news and F6 Robotics. | AT-22 to AT-28. |
| P5 | F8 Live Wire and alert settings. | AT-29 to AT-34. |
| P6 | F7 Pro charts, in the order: core, Tier A, Tier B, Tier C. | AT-35 to AT-44. |
| P7 | F9 optional AI layer; F10 dashboard integration; final QA, docs, and PR. | AT-45 to AT-48, and the final report. |

The data features ship before charts. If you are clearly running long, finish P6's core and its Tier A MUST items before starting any SHOULD or COULD item elsewhere.

---

# PART B — SPECIFICATION

## B0. Shared foundations (P1; everything is MUST unless marked otherwise)

### B0.1 Canonical item model: `src/lib/feed/types.ts`
```ts
export type Region = "KR" | "US" | "GLOBAL";
export type ItemKind = "news" | "research" | "disclosure" | "filing" | "policy" | "rating" | "briefing";
export type TimePrecision = "second" | "minute" | "day" | "unknown";
export type SourceTier = 1 | 2 | 3; // 1 = wire/primary (Bloomberg, Yonhap, Fed, SEC, exchange); 2 = major outlet; 3 = aggregator/other
export interface FeedItem {
  id: string;                 // stable: sourceId + native id, else hash of canonical URL
  kind: ItemKind;
  region: Region;
  sourceId: string;           // registry id
  sourceName: string;
  sourceTier: SourceTier;
  title: string;
  snippet?: string;           // source-provided text only, HTML-stripped, ≤ 240 chars
  url: string;                // https original
  pdfUrl?: string;
  publishedAt: string | null; // ISO-8601 UTC
  precision: TimePrecision;
  fetchedAt: string;          // ISO-8601 UTC
  seq?: number;               // native monotonic id (e.g., Naver nid) for tie-breaks
  tickers: { market: "KR" | "US"; code: string }[];
  sectors: string[];          // SectorId values
  topics: string[];           // e.g. "rates","fx","earnings","ma","policy","etf-listing","robotics"
  lang: "ko" | "en";
  paywalled?: boolean;
  importance?: { score: number; tier: "flash" | "high" | "normal"; reasons: string[] };
  cluster?: { id: string; size: number; sources: string[] };
}
export interface ResearchItem extends FeedItem {
  kind: "research";
  broker: string;
  category: "company" | "industry" | "invest" | "market" | "economy" | "debenture" | "official" | "public" | "street";
  rating?: string;
  targetPrice?: number;
  currency?: "KRW" | "USD";
  prevRating?: string;        // only when a prior same-broker/same-ticker report was actually fetched
  prevTargetPrice?: number;   // same rule
  summary: string;            // extractive
  summarySource: "preview" | "detail" | "pdf-text" | "none";
  originTier: "OFFICIAL" | "PUBLIC_RESEARCH" | "STREET" | "BROKER_KR" | "NEWS";
}
```
Adapt the existing `ResearchReport` and `NewsItem` types through mapper functions, without breaking any current consumer.

### B0.2 Time and ordering kernel: `src/lib/feed/time.ts` and `src/lib/feed/sort.ts`, with tests
- **`parseSourceTime(raw, { zone, now })`**, where `zone` is `"Asia/Seoul" | "America/New_York" | "UTC"`, returns `{ iso, precision }`. It must handle:
  - `2026.09.25`, `26.09.25`, `2026-09-25`, and `20260925`;
  - `202609251403` (Naver's `YYYYMMDDHHmm`, in KST) and `2026.09.25 14:03`;
  - `09.25 14:03`, inferring the year; if the result is more than a day after `now`, use the previous year;
  - ISO strings with an offset;
  - RFC-822, e.g. `Fri, 25 Sep 2026 12:18:36 +0000`;
  - Unix seconds and milliseconds.

  Invalid input returns `{ iso: null, precision: "unknown" }`.
- **`compareNewestFirst(a, b)`** applies these rules in order:
  1. Items that have `publishedAt` come before items that don't.
  2. KST calendar day, newest first.
  3. Within the same day, timed items by time (newest first), then items with only a date.
  4. `seq`, descending.
  5. `sourceTier`, ascending.
  6. `id`, ascending, so the order is total and deterministic.
- **`formatItemTime(item, { tz: "KST" | "ET", now })`** shows:
  - `방금`, `N분 전`, or `N시간 전` when the item is less than 12 hours old;
  - otherwise `MM.DD HH:mm`, or just `MM.DD` for date-only items, so a fake `00:00` is never printed;
  - `YYYY.MM.DD` when the item is more than 180 days old.

  A tooltip shows the full absolute KST time, plus ET on US pages.
- **Replace every ad-hoc date sort** in news, research, disclosure, filing, policy, and rating code with this kernel; the call sites are listed in D1.
- **Leave single-format time-series sorts alone**, but mark each one with the trailing comment `// ked-allow-string-date-sort: single-format time series`. They are:
  - the investor-flow days in `naver-market.ts`;
  - `src/lib/export-desk/*`;
  - `valuation-series.ts`;
  - chart bars.
- The invariant test in C1 fails on any unmarked string-date comparison under `src/`.

### B0.3 Source registry: `src/server/feeds/registry.ts`
This file is a data-only list. Each entry has these fields:
```ts
{ id, name, region, kind, tier,
  url | builder,
  format: "rss" | "atom" | "json" | "html",
  pollSec, enabled,
  status: "verified" | "candidate" | "unverified" | "disabled",
  verifiedAt?, paywalled?, notes }
```
Seed it with the sources below. Verify the candidates with A9, and never assume a source works.

- **Verified by the author of this prompt on 2026-09-24/25.** Re-verify them anyway.
  - `hankyung-finance`: https://www.hankyung.com/feed/finance (RSS, KR, 증권). The same page also lists `/feed/economy`, `/feed/international`, and `/feed/it`.
  - `fed-press`: https://www.federalreserve.gov/feeds/press_all.xml
  - `federal-register`: https://www.federalregister.gov/api/v1/documents.json (JSON; no key).
  - `robot-report`: https://www.therobotreport.com/feed/
  - `irobotnews`: https://www.irobotnews.com/rss/allArticle.xml (로봇신문).
- **Documented by the unofficial catalog `github.com/dd3ok/naverstock-api-skill`** (commit 47a4274, 2026-09-22). All paths are on host `https://stock.naver.com`.
  - **News**
    - List: `/api/domestic/news/list?category={MAINNEWS|FLASHNEWS|RANKNEWS}&page=1&pageSize=15`. The list key is `articles`.
    - Focus: `/api/domestic/news/focus?sid={sid}&page=1&pageSize=15&date=yyyyMMdd&enableFallback=true`, where `sid` is one of:
      - 401 시황·전망, 402 기업·종목분석, 403 해외증시;
      - 404 채권·선물, 406 공시·메모, 429 환율.
    - Search: `/api/domestic/news/search?query=…&page=1&pageSize=20`. Keys are `status` and `items`; `datetime` is `YYYYMMDDHHmm`.
    - World (Reuters-sourced): `/api/foreign/news/worldNews?page=1&pageSize=15&date=yyyyMMdd`. It returns a top-level array keyed by `aid`.
    - Market notices: `/api/domestic/news/noticeList?...`, with key `content`.
  - **Research v2**
    - List: `/api/stockSecurity/researches/v2/{market|company|industry|invest|economy|debenture}?index=0&size=15`.
      - Optional filters: `startDate`, `endDate`, repeated `itemCodes`, `brokerCodes`, `industryTypes`, and `query`.
      - The response is `{ hasNext, totalCount, items[] }`, with id field `nid`; `index` is 0-based.
    - Detail: `/{type}/{id}`, and `/{type}/{id}/detail-page?itemCode=…&size=1` for the previous and next report.
    - Target-price changes: `/company/goal-price-changed?direction={up|down}&size=10`, which returns `researchSets`.
    - Weekly popular: `/weekly-hot?startDate=yyyy-MM-dd&size=10`.
    - Also: `/latestResearch?size=3`, `/company/by-items?itemCodes=…&size=3`, and `/brokers`.
    - Research v1 and the old `/api/domestic/research/*` routes now return 404. Do not use them.
  - **Naver's own AI market briefing**
    - Current: `/api/securityAi/marketBriefing/current?marketBriefing=domain`.
    - List: `/api/securityAi/v2/marketBriefing?date=YYYY-MM-DD&size=20&pageToken=…`, returning `items`, `hasMore`, and `nextPageToken`.
    - Detail: `/api/securityAi/v2/marketBriefing/{id}`.
    - If you use it, attribute it as "네이버페이 증권 AI 시장 브리핑" and link to the original.
  - **Session state**: `/api/stockSecurity/market-status/current?exchanges=krx&exchanges=nxt`.
  - Treat the catalog as observations, not guarantees.
- **Existing sources** (these worked at export time; re-verify):
  - the legacy mobile endpoints in `naver-market.ts`: `m.stock.naver.com/api/research/*`, `/api/news/stock/{code}`, and the polling endpoints;
  - `m.stock.naver.com/front-api/search/autoComplete`;
  - Google News RSS (`news.google.com/rss/search?q=…&hl=ko&gl=KR&ceid=KR:ko`, or `hl=en-US&gl=US&ceid=US:en`), which supports `when:1d` and `site:`;
  - Finviz and Nasdaq, through `us-street`;
  - SEC, Fed, BEA, and BLS, through `us-official-research`.
- **Candidates** (verify them; enable only if they pass):
  - Yonhap RSS, e.g. `https://www.yna.co.kr/rss/market.xml` or `/economy.xml`.
  - The Maeil Business RSS index, `https://www.mk.co.kr/rss/`.
  - Bloomberg: `https://feeds.bloomberg.com/{markets|economics|technology|politics|wealth}/news.rss`.
  - CNBC, MarketWatch, and Yahoo Finance RSS.
  - The SEC latest-filings Atom feed, `/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom`. Use the SEC fair-access UA and stay at or below 8 requests per second.
  - IEEE Spectrum robotics RSS.
  - The IFR and A3 press pages.
  - `markets.hankyung.com/consensus`, the new Hankyung Consensus, which renders in JavaScript. The legacy `consensus.hankyung.com` may be retired.
- **Dead; do not use:** the `korea.kr` 정책브리핑 RSS. That service was discontinued.

### B0.4 Fetch policy and parsers: `src/server/feeds/http.ts`, `src/lib/feed/rss-parse.ts`, `src/lib/feed/text.ts`
- **`fetchWithPolicy(url, { sourceId, timeoutMs, accept, charset })`**:
  - Allows https only.
  - Requires the host to be on the registry allowlist; this is the SSRF guard, and anything else is rejected.
  - Handles redirects by hand: at most 3, and only to allowlisted hosts.
  - Allows at most 2 concurrent requests per host, with a minimum interval between them, and caps responses at 5 MiB.
  - Caches by URL (TTL, LRU with at most 500 entries) and de-duplicates in-flight requests.
  - Retries once with jitter on a timeout or 5xx.
  - On a 403 or 429, opens a circuit for 15 minutes (30 minutes on a repeat) and records it in health.
- **Charset** comes from `Content-Type`, then the XML prolog, then `<meta charset>`, then UTF-8. Decode EUC-KR with `TextDecoder("euc-kr")`, as `naver-market.ts` already does.
- **`parseFeed(xml)`** is pure and uses `fast-xml-parser`. It reads RSS 2.0, Atom 1.0, and RDF into `{ title, link, guid, pubDate, description, categories, author }[]`, strips HTML, decodes entities, and collapses whitespace.
- **`canonicalizeUrl`** forces https and drops `utm_*` parameters and fragments. Leave Google News redirect URLs as they are.
- Tests use synthetic fixtures covering RSS 2.0, Atom, EUC-KR bytes, CDATA, and missing dates.

### B0.5 Source health: `src/server/feeds/health.ts` and the page `/status/sources`
- **Recorded for each source:**
  - the last attempt and last success;
  - HTTP status, latency, and item count;
  - the newest `publishedAt`;
  - consecutive failures and circuit state;
  - which adapter path served the data (`v2`, `legacy`, or `html`).
- **The page `/status/sources`** lists every source with Korean labels and status chips, plus a `지금 재시도` button. That button bypasses the TTL once but still respects the circuit.
- **Every feed panel** shows a compact `소스 n/m 정상` chip that links to that page.

### B0.6 Clustering and importance: `src/lib/feed/cluster.ts` and `src/lib/feed/importance.ts`, with tests
- **Clustering.**
  - Normalize titles: apply NFKC and lowercase; strip `[속보]`, `[단독]`, `(종합)`, `(2보)`, a trailing ` - Source`, and punctuation.
  - Tokens are Hangul character bigrams plus Latin words, with stopwords dropped.
  - Two items belong to the same cluster when their Jaccard similarity is at least 0.6 and they are no more than 12 hours apart. The representative item is the best-tier one, then the earliest.
- **Importance** is a score from 0 to 100. It is explainable: every part of the score adds a Korean reason chip. The weights live in `src/data/news-keywords.ts`.
  - Source tier: tier 1 adds 25, tier 2 adds 15, tier 3 adds 5.
  - Flash markers (`[속보]`, `BREAKING`, `FLASH`, `긴급`) add 15.
  - Keyword classes add 10 to 30 each, capped at 40 in total:
    - macro and policy: FOMC, 기준금리, CPI, PCE, 고용, 관세, 수출통제, 환율 급등 …;
    - corporate events: 실적, 어닝, 가이던스, 유상증자, 무상증자, 자사주, 공개매수, 인수, 합병, 분할, 상장폐지, 거래정지, 감사의견, 횡령;
    - market structure: 서킷브레이커, 사이드카, 상한가, 하한가, VI;
    - ratings: 목표가 상향/하향, upgrade, downgrade, initiate.
  - A match with a watchlist ticker or keyword adds 20.
  - A cluster of 3 or more items adds 10.
  - Age decay subtracts 5 per hour after the first 2 hours, with a floor of 0.
  - Tiers: `flash` at 80 or more, `high` at 60 or more, otherwise `normal`.
- **User keyword watch.** Keywords and tickers the user defines are persisted, and they feed both the watchlist part of the score and the alert filters.

### B0.7 Feed API and UI kit
- **`GET /api/feed`**, in `src/routes/api.feed.ts`.
  - Query parameters: `region=KR|US|GLOBAL`, `kinds=news,disclosure,...`, `topics`, `tickers`, `cursor`, and `limit`.
  - It aggregates the registry sources for the request, then merges, clusters, scores, and sorts them newest first.
  - It pages with an opaque cursor built from `publishedAt|id`.
  - It returns `{ items, nextCursor, partial, sources: [{ id, ok, count }], generatedAt }`.
  - It sends the header `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`.
  - The handler has an 8-second budget. It fires sources in parallel with per-source timeouts and returns whatever has arrived, with `partial: true` if anything is missing.
- **Components**, in `src/components/feed/`:
  - `FeedList`: virtualized above 200 rows, with date group headers (오늘/어제/날짜) and "더 보기".
  - `FeedRow` shows:
    - the time;
    - a source badge with a tier dot, and the `유료` badge when relevant;
    - the headline, as `<a href target="_blank" rel="noopener noreferrer">`;
    - a two-line snippet;
    - ticker chips that link to `/stock/$ticker` or `/us/$symbol`;
    - importance reason chips and a cluster `+N` marker.
  - `BriefingDigest`, `SourceHealthChip`, and `TimeStamp`.
  - `FilterBar`: filters for source, topic, minimum importance, and watchlist-only, plus text search through `matchesSearchQuery`.
  - `EmptyState`: always shows the reason and a link to health.

  Everything is mobile-first: no horizontal scroll at 390 px, and touch targets of at least 44 px.
- **Definition of "Briefing"**, used by F1, F2, F3, F4, F5, and F6. A briefing is a deterministic digest at the top of a page, and every entry in it links to its source. It contains, in order:
  1. The as-of time and the session state.
  2. Snapshot tiles from live adapters, each labeled with its source and delay.
  3. Top stories: up to 7 clusters from the last 12 hours, ranked by importance, each with its reasons and all of its source links.
  4. Theme momentum: the top terms of the last 6 hours compared with the prior 24 hours, with term counts shown.
  5. Upcoming events, when a calendar source exists.
  6. The optional F9 AI button.

## F1. KR News Briefing: route `/news/kr` (P2)

**MUST**
- **F1.1 Sources.**
  - stock.naver.com news: FLASHNEWS, MAINNEWS, and focus sids 401, 402, 403, 404, 406, and 429.
  - Hankyung RSS (finance and economy), and Yonhap and Maeil Business if they verify.
  - Google News RSS fallback queries, each with `when:1d`: `코스피`, `코스닥`, `외국인 순매수`, `증시 마감`.
  - Important disclosures from the existing KRX/DART adapters (`getScanDisclosures`), as `kind: "disclosure"`.
  - Optionally, when KIS keys exist, the KIS "종합 시황/공시 제목" REST endpoint:
    - endpoint `/uapi/domestic-stock/v1/quotations/news-title` with tr_id `FHKST01011800`;
    - authentication: an OAuth token from `/oauth2/tokenP`, sent as a bearer token together with the appkey, the appsecret, and `custtype: P`;
    - cache the access token, and never request more than one token per minute;
    - check it against `github.com/koreainvestment/open-trading-api`, in `examples_llm/domestic_stock/news_title`.
- **F1.2 Page layout.**
  1. A header with the as-of time, the KRX/NXT session state (from market-status or the index `marketStatus`), and the source-health chip.
  2. A `BriefingDigest`. Its snapshot shows KOSPI, KOSDAQ, and KOSPI200 from the existing indices, plus USD/KRW if available.
  3. A `FeedList` with filters and "더 보기".
- **F1.3 Ticker tagging.** Tag a headline with a ticker when it contains an exact 6-character code or a company name from `UNIVERSE`. The longest name wins, so "LG" never matches inside "LG에너지솔루션". Ignore names shorter than 2 characters.
- **F1.4 Per-stock news.** `LiveNews` on each stock page sorts newest first through the kernel and gets "더 보기" (page 2 and beyond) and source badges.

**SHOULD**
- **F1.5** An attributed, linked card for Naver's AI market briefing, showing the current briefing and the list.
- **F1.6** A KR calendar strip (한국은행 금통위, 옵션만기, 휴장일), but only if a verifiable source exists. Otherwise leave it out.

## F2. KR Research Briefing: upgrade `/research` (KR mode) and `BrokerReports` (P3)

**MUST**
- **F2.1 Adapter.**
  - Prefer stock.naver.com research v2 for all six categories (`market`=데일리, `company`, `industry`, `invest`, `economy`, `debenture`), with `index` paging and `totalCount`.
  - Fall back to the legacy `m.stock.naver.com/api/research/*` adapter, and record which path served the data in health.
  - Keep Hankyung Consensus as an extra industry source only if it verifies (try the `markets.hankyung.com/consensus` API, then the legacy list). If it requires login, disable it.
- **F2.2 Tabs.** `전체 · 기업 · 산업 · 시황/전략 · 경제 · 채권 · 데일리`. The full company category replaces the "7 hard-coded stocks" 기업 tab. Add a "관심종목" filter covering the watchlist plus the featured names.
- **F2.3 Ordering.**
  - Sort with `compareNewestFirst`: date first (newest first), then `nid` descending.
  - Show date group headers and the counts `오늘 n건 · 이번 주 m건 · 전체 totalCount`.
  - "더 보기" loads the next `index`.
- **F2.4 Research briefing strip** at the top of the page:
  - today's count for each category;
  - `목표주가 상향 TOP` and `하향 TOP`, from `goal-price-changed` (up and down);
  - `주간 인기`, from `weekly-hot`;
  - `신규 커버리지`, found by a keyword rule and labeled as a heuristic.
- **F2.5 Report card.**
  - category, broker, and date (day precision);
  - the linked ticker, the rating badge, and the TP;
  - Δ% for the TP, shown only when a prior report from the same broker was actually fetched (through `detail-page` prev/next or the per-ticker company list);
  - the extractive summary, with a `summarySource` label;
  - buttons: `PDF 원문` · `리서치 페이지` · `상세`.
- **F2.6 Opening originals (fixes D2).**
  - If `pdfUrl` is already known, render a real anchor.
  - Otherwise, inside the click handler, synchronously run `const w = window.open("about:blank", "_blank")`, then resolve the URL, then run `w.opener = null; w.location.replace(url)`.
  - If resolution fails, send `w` to the research page URL. If `w` is null because the popup was blocked, show the resolved link in a toast.
  - Pre-resolve the PDF URLs for the first 12 visible rows in the background: use IntersectionObserver with a concurrency of 3, and cache results for 10 minutes on the server.
- **F2.7 Detail sheet.**
  - longer preview or detail text, as extractive bullets;
  - rating and TP;
  - the previous and next report for the same ticker (`detail-page`);
  - links to the PDF and the research page;
  - a broker filter.

**SHOULD**
- **F2.8 KR Street Moves.** For watchlist tickers, a table of the latest report from each broker: date, broker, rating, TP, and Δ, newest first.
- **F2.9 Industry filter.** Use v2 `industryTypes` if it verifies; otherwise use the fixed taxonomy (F6.8).

## F3. US News Briefing: route `/news/us` (P2)

**MUST**
- **F3.1 Sources.**
  - Bloomberg RSS sections, under the A4 rules, with the fallback Google News query `site:bloomberg.com when:1d`.
  - stock.naver.com `worldNews` (Korean-language, Reuters-sourced) and focus `sid=403` (해외증시).
  - Fed press RSS.
  - The SEC latest 8-K Atom feed, if it verifies. It is tier 1. Map tickers through the ticker→CIK directory in `us-official-research.ts`.
  - The existing Finviz and Nasdaq rating notes, as `kind: "rating"`.
  - CNBC, MarketWatch, and Yahoo RSS, if they verify.
  - Google News EN queries, each with `when:1d`: `stock market today`, `S&P 500`, `Nasdaq`, `Treasury yields`.
  - Optionally, Finnhub.
- **F3.2 Snapshot tiles.** These are delayed; label each with its source and delay.
  - Tiles: S&P 500 `^GSPC`, Nasdaq-100 `^NDX`, Dow `^DJI`, Russell 2000 `^RUT`, VIX `^VIX`, US 10Y `^TNX`, DXY `DX-Y.NYB`, WTI `CL=F`, Gold `GC=F`, BTC `BTC-USD`, and USD/KRW `KRW=X`.
  - Fetch them with the existing Yahoo chart pattern, `query1.finance.yahoo.com/v8/finance/chart/{symbol}`, restricted to a fixed allowlist of symbols.
  - Do **not** route these through `yahooUsSymbol`, which rejects `^`, `=`, and `-` symbols.
- **F3.3 Session badge.** Show pre-market, regular, after-hours, or closed, computed from the America/New_York clock and labeled `추정`, because holidays are not modeled unless a verified calendar source exists. Add a KST/ET time toggle.
- **F3.4 Economic calendar.** Reuse `fetchUsOfficialPolicy().calendar` (Fed and BEA) for the next 7 days.
- **F3.5 US watchlist.** Add `usWatchlist` to the store, defaulting to the current `US_STREET_SYMBOLS`. Tag tickers by `$TICKER`, by cashtags, and by an exact company-name map covering the watchlist plus the robotics US names.

**SHOULD**
- **F3.6** Add a compact US segment to `MarketBar` (SPX, NDX, VIX, US10Y, USD/KRW), labeled as delayed.

**COULD**
- **F3.7** A US earnings-today list, from the Nasdaq calendar JSON, if it verifies.

## F4. US Research Briefing: upgrade `/research?market=us` and `/us-research` (P3)

**MUST**
- **F4.1 Scope banner**, in Korean: "미국 투자은행 리포트 PDF는 고객 전용으로 공개되지 않습니다. 이 화면은 공식 문서(SEC·연준·BEA·BLS), 공개 리서치, 공개된 등급 변경과 관련 기사만 원문으로 연결합니다."
- **F4.2 Origin tiers, each with a badge.**
  - OFFICIAL: the existing SEC, Fed, BEA, and BLS cards.
  - PUBLIC_RESEARCH: a registry of free institutional research pages and PDFs, such as asset managers' market outlooks. Add an entry only after verifying that it is public without login.
  - STREET: Finviz and Nasdaq rows, plus the matched article.
  - NEWS: articles about rating changes.
- **F4.3 Newest first everywhere.**
  - In `UsResearchDesk`, sort notes by their Finviz timestamps and headlines by their parsed times.
  - In `ResearchHome`, sort the featured list, the pool, and every section grid by `publishedAt`, newest first.
  - Default the period filter to `최근 30일`.
- **F4.4 Street Moves table.**
  - Columns:
    - date, ticker, broker;
    - action: Upgrade, Downgrade, Initiate, Reiterate, or PT change;
    - rating from→to;
    - PT from→to with Δ%, shown only when both values are in the source row;
    - source links.
  - Filters for ticker, broker, action, and 기간; a sticky header; and CSV export.
- **F4.5 Universe and load control.**
  - The Street layer covers the first 12 names of `usWatchlist` ∪ `US_STREET_SYMBOLS` ∪ the robotics US names (F6.1), fetched eagerly and cached for 20 minutes. Every other ticker loads lazily when opened, with a concurrency limit of 3.
  - The official layer keeps its eager `OFFICIAL_UNIVERSE` of 6 names. Other tickers load on demand per ticker through `getUsOfficialCompany`, which respects the SEC throttle and function time limits.
- **F4.6 Opening originals.** Every card has `원문` (the document page), plus `PDF` or `Exhibit 99` where they apply. Wherever URLs resolve lazily, use the click pattern from F2.6.

**SHOULD**
- **F4.7 "US 리서치 브리핑" strip:**
  - counts per tier for today and this week;
  - today's top upgrades and downgrades;
  - the day's filings for the universe;
  - the next macro releases.

## F5. KR ETF News Briefing: route `/news/etf`, plus an "ETF 뉴스" tab on `/etfs` (P4)

**MUST**
- **F5.1 Sources.** Extend `src/server/etf-news.ts` and keep its listing/scheduled `stage` logic. Add:
  - Google News KR queries: `ETF 신규 상장`, `ETF 상장예정`, `ETF 상장폐지`, `ETF 순자산`, `ETF 자금 유입`, `월배당 ETF`, `커버드콜 ETF`, and `퇴직연금 ETF`.
  - One query per issuer brand: `KODEX`, `TIGER`, `ACE`, `RISE`, `SOL`, `PLUS`, `KIWOOM`, `HANARO`, `KoAct`, and `TIME`.
  - Hankyung finance RSS, filtered by ETF keywords.
  - stock.naver.com news search with `query=ETF`, if it verifies.
- **F5.2 Enrichment.** Match headlines to the live ETF list using `fetchAllEtfs` and the existing longest-name `matchEtf`. Attach the code, price, 1D %, volume, market value, and issuer, and link to `/etfs/$code`.
- **F5.3 Briefing contents:**
  - 신규 상장 and 상장 예정 in the next 14 days;
  - 상장폐지 예정;
  - fund-flow headlines;
  - 퇴직연금 제도 news;
  - a snapshot of the ETFs with the highest trading value, from the live ETF list;
  - link chips to the robot and AI ETFs (F6.6).
- **F5.4 Ordering and filters.** Newest first. Filters for issuer, stage, theme, and retirement-eligible only (the existing `retirementEligible`).

## F6. Robotics section: route `/robotics` with tabs `overview · market · policy · companies · research · etf` (P4)

**MUST**
- **F6.1 Universe config: `src/data/robotics.ts`** (data only).
  - **KR seed with codes.** Verify them at runtime and hide any row that does not resolve:
    - 레인보우로보틱스 277810, 두산로보틱스 454910, 로보티즈 108490;
    - 로보스타 090360, 클로봇 466100 (fix its nameEn to "CLOBOT"), 에스피지 058610.
  - **KR candidates.** Resolve these **by name** at runtime through the existing security search, and never hard-code codes you have not verified:
    - 유일로보틱스, 뉴로메카, 티로보틱스, 에브리봇;
    - 엔젤로보틱스, 휴림로봇, 하이젠알앤엠, 알에스오토메이션;
    - 삼익THK, 에스비비테크, 현대무벡스, 브이원텍.
  - **Exposure names** (not pure-plays), tagged `exposure: "indirect"`: 삼성전자, LG전자, 현대차, 현대모비스, 두산, 한화.
  - **US seed.** Verify through the Yahoo chart endpoint and hide anything that does not resolve:
    - TSLA, NVDA, ISRG, SYM, TER, ROK;
    - ZBRA, CGNX, PRCT, SERV, RR, KSCP;
    - the ADRs FANUY, YASKY, and ABBNY.
  - **Private companies (news only):** Figure AI, Agility Robotics, Apptronik, 1X, and Boston Dynamics (Hyundai group).
  - **Tags on every entry:**
    - `segment` is one of:
      - humanoid, cobot, industrial, logistics-amr, service, medical;
      - components-actuator-reducer, sensors-vision, software-ai.
    - `exposure` is pure-play, significant, or indirect.
  - Users can add and remove names, and their changes persist.
- **F6.2 Overview.** Everything here shows its source and is newest first.
  - KPI tiles:
    - the KR basket's equal-weight 1D %, and the US basket's 1D %;
    - the number of policy items in the last 7 days, and of research items in the last 7 days;
    - the number of news items in the last 24 hours.
  - Top movers for KR and US.
  - The latest 5 market-trend items, 5 policy items (KR and US), and 5 research items.
  - A robot ETF snapshot.
- **F6.3 Market trends.**
  - Sources:
    - The Robot Report RSS, 로봇신문 RSS, and IEEE Spectrum robotics (if it verifies);
    - Google News KR: `로봇 산업`, `휴머노이드`, `협동로봇`, `물류로봇`;
    - Google News EN: `humanoid robot`, `robotics industry`, `industrial robot orders`, `robot startup funding`.
  - A topic classifier with robot-specific keyword lists, covering humanoid, industrial, cobot, logistics, surgical, components, funding and M&A, and statistics.
- **F6.4 Policy.**
  - **US.**
    - Federal Register API: `conditions[term]` of robot, robotic, robotics, humanoid, or "industrial machinery", with `order=newest`.
    - Apply a relevance filter: the term must appear in the title or abstract. Drop unrelated notices such as premerger and early-termination notices, and show each item's document type and agencies.
    - Google News EN: `robotics executive order`, `Section 232 robotics`, `national robotics strategy`.
  - **KR.**
    - Google News KR: `로봇 정책`, `휴머노이드 정부`, `지능형 로봇법`, `로봇 규제 샌드박스`, `산업통상부 로봇`.
    - 로봇신문 items classified as policy.
  - **Status chips** (발표 · 입법예고 · 시행 · 조사/검토 · 기타) are set only from keywords present in the source text. Never assert a status the source does not state, and do not hard-code any current policy status in code or UI copy.
- **F6.5 Companies.**
  - The KR table shows:
    - name, code, segment, and exposure;
    - price, 1D %, 52-week position, and market cap;
    - the latest news time and latest research date, linking to `/stock/$ticker`.
  - The US table shows the same fields from Yahoo, linking to `/us/$symbol`.
  - Clicking a row opens a news drawer: Naver per-stock news for KR, and Google News EN by company name for US. Newest first.
- **F6.6 ETF.**
  - KR robot ETFs are discovered from the live ETF list by the name regex `/로봇|휴머노이드|로보틱스|robot|humanoid/i`, showing code, name, price, 1D %, volume, and market value, and linking to `/etfs/$code`.
  - US robot ETFs come from a seed list that must be verified: BOTZ, ROBO, ARKQ, KOID, HUMN, BOTT.
- **F6.7 Research.** Summaries are extractive, every item has a `원문` link, and everything is newest first.
  - **KR:**
    - research v2 `industry`, filtered by robotics keywords;
    - research v2 `company` for the KR robot tickers (repeated `itemCodes`, at most 10 per call);
    - Hankyung robotics, if it verifies.
  - **US:**
    - PUBLIC_RESEARCH registry items tagged robotics;
    - Street Moves for the US robot tickers;
    - OFFICIAL filings for the US robot tickers.
- **F6.8 Taxonomy fix (D5).**
  - The robotics keywords are:
    - 로봇, 로보틱스, 휴머노이드, 협동로봇, 산업용 로봇, 물류로봇, AMR, 서비스로봇;
    - 감속기, 액추에이터, 서보, 모션제어;
    - 피지컬 AI, physical AI, embodied, robot, robotics, humanoid, cobot.
  - Bare `AI` or `인공지능` counts only when a robot term also appears. Update the tests.
- **F6.9 Cross-links.**
  - `/industry/robotics` links to `/robotics`.
  - The sidebar sector row "로봇·자동화·AI" links to `/robotics`.
  - A dashboard card is added in P7.

## F7. Pro charts: every chart (P6)

**Engine decision (fixed):** `lightweight-charts` v5 plus custom primitives and plugins. Never add TradingView Advanced Charts or Trading Platform.

**MUST: Core**, in `src/components/charts/core/`
- **F7.1 `createProChart` / `useProChart`.**
  - Theme comes from CSS variables (dark and light), and the Korean/global up-down colors come from `usePriceColors`.
  - Formatters are market-aware (`formatters.ts`):
    - KRW: `precision 0`, `minMove 1`, and thousands separators;
    - USD: 2 decimals, or 4 below $1;
    - percentages, plus volume in 만/억 for KR and K/M/B for US.
  - `krxTickSize(price, instrument)` snaps drawings to the tick size, with tests. Verify the current KRX tick table before relying on it; ETFs and ETNs use a different table.
- **F7.2 `ChartShell`** provides:
  - a toolbar slot, an HUD for OHLC and indicator values, and a legend with visibility toggles;
  - a status line showing the source, delayed or realtime, and the last update;
  - fullscreen;
  - PNG export through `chart.takeScreenshot()`, and CSV export of the visible bars;
  - keyboard-shortcut help on `?`, including one-key tool shortcuts.
- **F7.3 Attribution (fixes D4).**
  - Put the Lightweight Charts NOTICE text in `src/components/charts/core/attribution.ts`.
  - Add a visible footer credit link, "Charts: TradingView Lightweight Charts™", pointing to https://www.tradingview.com/. `attributionLogo: false` may stay only because this link exists.
  - Cover it with the invariant test.
- **F7.4** A helper that syncs the crosshair and time range across charts in the same workspace.

**MUST: Tier A**, the price charts: `TradingChart` on `/stock/$ticker`, `/etfs/$code`, and `/us/$symbol`, plus the `/chart` workspace.
- **F7.5 Chart types and scales.**
  - Types: candles, hollow candles, OHLC bars, Heikin-Ashi (a pure transform with a test), line, area, and baseline.
  - Scales: normal, log, percent, and indexed-to-100.
- **F7.6 Indicators.** Each is a pure function in `src/lib/chart-indicators.ts` with known-value tests. Parameters are editable in a dialog, indicators are added and removed from a searchable catalog, and the choices are saved per layout. The set:
  - Moving averages: SMA, EMA, WMA, and HMA, each with multiple instances.
  - Bands and channels: Bollinger, Keltner, Donchian, and Ichimoku.
  - Trend and stops: Parabolic SAR and Supertrend.
  - VWAP: session VWAP (existing) and Anchored VWAP (click to set the anchor).
  - Volume: Volume with its moving average, OBV, and Volume Profile.
    - Volume Profile covers the visible range, drawn as a right-edge histogram primitive with POC, VAH, and VAL.
  - Oscillators: RSI (existing), Stochastic, Stoch RSI, MACD (existing), ADX/DMI, CCI, MFI, and Williams %R.
  - Volatility: ATR (existing).
  - Levels: Pivot Points (Classic, Fibonacci, and Camarilla) and the 52-week high and low.
- **F7.7 Drawing tools.**
  - Tools:
    - trend line, ray, extended line, horizontal line or ray;
    - vertical line (the official `@tradingview/lwc-plugin-vertical-line`, or our own primitive);
    - parallel channel, rectangle, Fibonacci retracement and extension;
    - a measure tool for price, date, and %;
    - long/short position with entry, stop, target, R:R, and distances in % and price;
    - text note and arrow.
  - All tools are primitives and support:
    - magnet and snap;
    - selecting, moving, and editing with handles;
    - color and line width;
    - lock and hide;
    - an object manager list;
    - undo and redo with `Ctrl/Cmd+Z` and `Shift+Ctrl/Cmd+Z`.
- **F7.8 Compare overlay.** Up to 3 symbols, KR or US, in percent-from-start mode, with a legend showing the last values.
- **F7.9 Workspace and layouts.**
  - A `/chart` route (`?symbols=…&layout=1|2|4`) holds a 1-, 2-, or 4-chart workspace with a synced crosshair, an optional synced interval, and a symbol search in each pane. Fullscreen on any `TradingChart` opens this workspace.
  - Persistence: localStorage under `ked:chart:v2:{market}:{code}:{interval}`, holding indicators, drawings, chart type, and scale, plus named templates.
  - Migrate the existing `ke-chart-draw:{code}` drawings once, with a test.
- **F7.10 Event overlays**, each with a toggle:
  - disclosures (existing);
  - news clusters from the feed store: one marker per bar showing a count, which opens a list on click;
  - research TP changes;
  - US dividends and splits (Yahoo `events=div,splits`), when present.
- **F7.11 Alerts.** Evaluated on the client on each data refresh or stream tick, fired through the Live Wire notifier (F8), and listed and managed in its drawer.
  - Horizontal-line price alerts: crossing up or down, once or every time.
  - Basic indicator alerts: an RSI crossing of 70 or 30, and moving-average crosses.
- **F7.12 Bar replay** for daily and weekly charts.
  - Pick a start bar, then play, pause, or step, at 1× to 10× speed.
  - Indicators recompute only on the replayed data that is visible.
- **F7.13 Extended hours.**
  - Shade extended hours only when the fetched intraday data actually contains those bars: US pre- and post-market when requested with `includePrePost=true`, and KR NXT only if present.
  - Draw session-break lines on intraday charts.
  - Never synthesize bars.
- **F7.14 Mobile.**
  - The toolbar collapses into a bottom sheet, and a long-press brings up the crosshair.
  - Touch targets are at least 44 px, and there is no page-level horizontal overflow at 390 px.
- **F7.15 Performance.**
  - Compute indicators lazily and memoize them by data version and parameters.
  - Cap each series at 10,000 bars.
  - Panning and zooming with 5,000 daily bars on a mid-range laptop must produce no long tasks over 200 ms.

**MUST: Tier B**, which is `ValuationBandChart`, `ValuationHistoryChart`, `InvestorFlow`, and `ExportDualChart`
- **F7.16 Move them onto the core.** Each gets:
  - the shared formatters, HUD, and legend;
  - fullscreen, PNG and CSV export, and range presets;
  - log and percent scales where they make sense;
  - the source/as-of status line;
  - crosshair sync between its panes.

  Keep their domain logic and keep their existing tests green.

**MUST: Tier C**, which is the `ExportDesk` recharts `BarChart` and `Sparkline`
- **F7.17 Uniform chart chrome, with no engine change:**
  - title, units, and source/as-of;
  - accessible tooltips and aria-labels;
  - PNG and CSV export where it makes sense.

**COULD**
- **F7.18** An optional "TradingView 위젯" tab, on `/us/$symbol` only.
  - Load the official Advanced Real-Time Chart embed snippet, copied from tradingview.com/widget-docs when you implement it. Load it lazily when the user clicks, and keep its attribution element.
  - Label the tab `지연 시세 · TradingView 제공`.
  - If the symbol cannot be displayed, show an "Open on TradingView" link instead.
  - Never show it for KR symbols by default.

## F8. Live Wire: real-time alerts for important news (P5)

**Architecture (fixed by the deployment platform).** Vercel Hobby functions run for at most 300 s, Hobby cron runs at most once a day, and there is no persistent server process. So the design is client-driven polling of a CDN-cached aggregate endpoint. There is no server cron, no WebSocket server, and no database.

**MUST**
- **F8.1 The endpoint: `GET /api/wire?regions=KR,US`**, in `src/routes/api.wire.ts`.
  - It has no cursor, so it stays cacheable: it returns the newest 100 items for a canonicalized, sorted `regions` set. The client works out what is new since it last looked.
  - It aggregates the high-frequency subset of the registry. Server TTL per source:

    | Source | TTL |
    |---|---|
    | KR flash/main | 30 s |
    | Hankyung | 60 s |
    | Fed and SEC | 120 s |
    | Google News | 120 s |
    | Bloomberg | 300 s |

  - It clusters and scores the items.
  - It sends `Cache-Control: public, s-maxage=20, stale-while-revalidate=40`.
  - It has an 8-second budget, and partial results are allowed.
- **F8.2 The client hook: `useLiveWire()`.**
  - Only one tab polls. Elect it with the Web Locks API (`navigator.locks.request`). The fallback is BroadcastChannel plus a localStorage heartbeat.
  - Polling interval: 20 s while the page is visible, 60 s while it is hidden, and 180 s when both markets are closed.
  - On errors, back off exponentially up to 5 minutes.
  - De-duplicate by id and by cluster.
  - Persist the last-seen marker and the unread count.
- **F8.3 The UI.**
  - A header button with an unread badge, in AppShell.
  - A drawer on the right with:
    - tabs: 전체 · 한국 · 미국 · ETF · 로봇 · 관심종목;
    - filters for minimum tier and sources;
    - a pause control.
  - Items render with `FeedRow`, including a tier color bar, reasons, and the original link.
  - On desktop, an optional bottom ticker tape, off by default.
- **F8.4 Notifications.**
  - In-app `sonner` toasts for `high` and above. This is configurable.
  - OS notifications only after the user clicks "데스크톱 알림 켜기". Call `Notification.requestPermission()` inside that click, never on page load. By default, OS notifications go out only for the `flash` tier and for watchlist or keyword matches.
  - A rate limit of at most 5 notifications per 10 minutes, then one digest toast.
  - Quiet hours, 23:00–07:00 KST by default and editable.
  - Toggles per region and per category.
  - Optional sound, off by default: a short WebAudio beep with no external asset.
  - Clicking a notification focuses the tab and opens the item.
- **F8.5 Settings.** An "알림 설정" page or sheet, persisted through the store (F10.2).
- **F8.6 Serverless-safe KIS stream.** Make the existing KIS SSE route (`api.market-stream.ts`) safe on serverless:
  - send `retry: 3000`;
  - close the stream proactively after 240 s, so `EventSource` reconnects within Vercel's limit;
  - have the client show a `재연결 중` state;
  - keep the Naver snapshot fallback.

**Out of scope.** Document background Web Push as future work: it needs VAPID, subscription storage, and a scheduler.

## F9. Optional AI briefing layer (P7; COULD; off by default)

- **F9.1** The layer is enabled only when `AI_BRIEFING_ENABLED=true` and a provider key plus `AI_MODEL` are set on the server. Otherwise no UI for it appears.
- **F9.2** An "AI 브리핑 생성" button, which the user must click, on the F1–F6 briefings.
  - **Input:** at most 30 items that are already on screen, each with title, snippet, source, time, url, and id. Never send PDFs or full articles.
  - **Output:** Korean bullets. Each bullet ends with citations such as `[3]` that point to input ids. The server rejects or strips bullets without valid citations, and strips any URL that was not in the input.
- **F9.3 Controls.**
  - Cache results by input hash for 15 minutes.
  - Enforce the daily cap `AI_DAILY_CAP` (default 50), and show a token or cost estimate when available.
  - Label the output `AI 요약 · 원문 확인 필요`.
  - Use one provider interface with `anthropic` and `xai` adapters. Read each provider's current official docs for the request format, and never hard-code model IDs; use `AI_MODEL`.
- **F9.4** Optional EN→KO headline translation uses the same layer and is labeled `기계 번역`.

## F10. Navigation, state, dashboard (spread across phases)

- **F10.1 The sidebar is grouped**, with Korean labels, and every existing URL keeps working.
  - **한국:**
    - 대시보드 `/`, 한국 뉴스 `/news/kr`, 리서치 데스크 `/research`;
    - 퇴직연금 ETF `/etfs`, ETF 뉴스 `/news/etf`;
    - 주요 공시 `/disclosures`, 수출 × KOSPI `/export-desk`.
  - **미국:** 미국 뉴스 `/news/us`, 미국 리서치 `/research?market=us`, 공식 원문 `/us-research`, 미국 연계 `/us-link`.
  - **테마:** 로봇 `/robotics`.
  - **도구:** 차트 워크스페이스 `/chart`, 관심종목 `/watchlist`, 알림 설정, 소스 상태 `/status/sources`.

  `/news` redirects to `/news/kr`. The sector list stays below the groups. On mobile, everything goes in the existing Sheet.
- **F10.2 Store.** Add `version: 2` and a `migrate` function to the persist config, so existing users keep their data. The new fields are `usWatchlist`, `keywordWatch`, `alertSettings`, `newsPrefs` (timezone and filters), `chartPrefs`, and `roboticsCustom`. Unit-test the migration from an unversioned snapshot.
- **F10.3 Dashboard** (P7). Add compact cards, loaded after first paint with the existing `deferSecondary` pattern:
  - Live Wire top 5;
  - 오늘의 리서치: the counts plus the 3 newest;
  - a US snapshot;
  - a Robotics snapshot.

---

# PART C — VERIFICATION, ACCEPTANCE, REPORTING

## C1. Gates (run at the end of every phase; all must pass)

1. `npm run typecheck` reports 0 errors. If routes changed, start dev or run `npm run build` first so that `routeTree.gen.ts` is regenerated.
2. `npm test` passes, including every new test file (registered as described in A6).
3. ESLint reports 0 errors in the changed and new files. Pre-existing errors elsewhere are out of scope. Run it only on the files changed since the base commit (BASE, recorded in PROGRESS.md):
   `FILES=$(git diff --name-only --diff-filter=ACMR BASE -- '*.ts' '*.tsx' '*.mjs'); [ -z "$FILES" ] || npx eslint --no-warn-ignored $FILES`

   Do not run bare `npx eslint` with an empty list: it lints the whole repo and reports the pre-existing errors.
4. `npm run build` succeeds. Then restore `.vercel/output` as described in A7.
5. **Runtime smoke test.** Add `scripts/qa-smoke.mjs` as the npm script `"qa:smoke"`. It:
   - attaches to `npm run dev` on :8080, starting it if needed;
   - visits every route at 1440×900 and at 390×844;
   - asserts visible content, zero uncaught console errors, and no horizontal overflow on mobile;
   - saves screenshots to `.qa/`.

   If Playwright's Chromium is missing, try `npx playwright install chromium` once. If that fails too, fall back to fetching each route's SSR HTML and asserting a 200 plus key markers, and write "visual QA not performed" in PROGRESS.md.
6. **In LIVE-VERIFIED mode**, `npm run verify:sources` shows no enabled source in `error` or `parse-fail`, and every disabled source is documented.

**Invariant test.** Add `scripts/project-invariants.test.mjs`; the existing `scripts/**/*.test.mjs` glob runs it automatically. It asserts that:
- `vite.config.ts` still contains `grokPwaPlugin()`, and the nitro vercel preset with `serverDir: "./server"`;
- `__root.tsx` still renders `PreviewHostBridge` and `CreatedWithGrokBanner`;
- no env name with a `VITE_` prefix holds a secret;
- the TradingView attribution link exists;
- no line in `src/` (test files excluded) contains `.date.localeCompare(`, `.datetime.localeCompare(`, `a.date < b.date`, or `a.datetime < b.datetime` unless it carries the marker comment from B0.2.

## C2. Acceptance tests

Automate these where feasible. Otherwise document manual checks, with screenshots in `.qa/`.

**Foundations**
- **AT-01** Mixed-format dates (`2026.09.25`, `26.09.24`, `2026-09-26`, `20260923`, `202609251403`) sort strictly newest first, with ties broken by `seq` descending.
- **AT-02** Date-only items never show a time. Items with `precision: "unknown"` sink to the bottom, labeled `날짜 미상`.
- **AT-03** The RSS 2.0, Atom, and EUC-KR fixtures parse to identical normalized items.
- **AT-04** Clustering merges `[속보] 코스피 2% 급락` with `코스피, 2% 급락 마감 - 한국경제`, and every `high` or higher item has at least one importance reason.
- **AT-05** The fetch policy rejects hosts that are not allowlisted and URLs that are not https, and a 429 opens the circuit.
- **AT-06** KRW price scales show integers with separators, and USD scales show 2 decimals.
- **AT-07** The attribution link is present on every page that has a chart.
- **AT-08** Migrating an unversioned store snapshot keeps `watchlist`, `theme`, and `colorConvention`.

**News**
- **AT-09** `/news/kr` shows a digest and a list, newest first, with sources. Every headline opens its original in a new tab with `rel="noopener noreferrer"`.
- **AT-10** The filters (source, topic, watchlist-only, importance) and "더 보기" work without producing duplicates.
- **AT-11** Ticker chips route to `/stock/$ticker`, and "LG" is never tagged inside an "LG에너지솔루션" headline.
- **AT-12** `/news/us` shows snapshot tiles with delay labels and the KST/ET toggle. Bloomberg items are marked `유료` and show only the headline and link.
- **AT-13** Turning Bloomberg off (`NEWS_BLOOMBERG_ENABLED=false` or the in-app toggle) removes it everywhere, without errors.
- **AT-14** `/api/feed` sends `Cache-Control` with `s-maxage`, and finishes within 8 s, with `partial` set, when a source times out.

**Research**
- **AT-15** The KR research tabs (전체/기업/산업/시황/경제/채권/데일리) are newest first, with date headers and `totalCount`. "더 보기" loads older pages.
- **AT-16** `PDF 원문` opens the PDF, or falls back to the research page, in a new tab even when the URL resolves asynchronously. Check this with Playwright's `popup` event, including at a mobile viewport.
- **AT-17** The TP-change strip lists the up and down items from `goal-price-changed`. Δ% appears only when both values come from a source.
- **AT-18** The old 7-stock featured list is gone, and the company tab paginates the full category.
- **AT-19** US research notes, headlines, and official grids are newest first. The scope banner is visible, and every card has an original link.
- **AT-20** The Street Moves table sorts by date, newest first, and its CSV export matches the visible rows.
- **AT-21** The robotics classifier no longer tags a generic "AI 반도체" report as robotics (unit test).

**ETF and Robotics**
- **AT-22** `/news/etf` items that match an ETF show its code, price, and volume and link to `/etfs/$code`. The stage chips are correct on the fixtures.
- **AT-23** The `/robotics` overview renders every tile with its sources, and empty sources show a reason instead of blank space.
- **AT-24** Robot ETF discovery returns every live ETF whose name matches the regex (fixture test on the matcher).
- **AT-25** The KR and US company tables hide unresolved symbols and list them in Source Health.
- **AT-26** The Federal Register relevance filter drops premerger and early-termination notices (fixture) and keeps robotics and Section 232 items.
- **AT-27** Policy status chips appear only when their keyword is present in the source text.
- **AT-28** `/industry/robotics` links to `/robotics`, and `클로봇`'s English name is "CLOBOT".

**Live Wire**
- **AT-29** With two tabs open, only one tab (the leader) polls.
- **AT-30** No permission prompt appears on load. Desktop alerts can be turned on only through the button.
- **AT-31** Twelve qualifying items within 10 minutes produce at most 5 notifications plus 1 digest.
- **AT-32** Quiet hours suppress OS notifications but still update the drawer badge.
- **AT-33** A chart price alert fires once when the price crosses the line (unit test on the evaluator).
- **AT-34** The SSE market stream closes by 240 s, and the client reconnects.

**Charts**
- **AT-35** Each new indicator matches known-value fixtures: published reference values, or hand-computed small series documented in the test. That covers:
  - Heikin-Ashi, Stochastic, Stoch RSI, ADX/DMI, CCI, MFI, Williams %R;
  - Ichimoku, Supertrend, PSAR, Keltner, Donchian;
  - OBV, pivots, and Volume Profile.
- **AT-36** Every drawing tool can be created, moved, edited, locked, hidden, deleted, undone, and redone, and it persists across a reload.
- **AT-37** The compare overlay with 3 symbols in percent mode shows the correct returns relative to the first visible bar.
- **AT-38** The 2×2 `/chart` layout syncs crosshair time across its charts.
- **AT-39** The layout persistence key format and the migration from `ke-chart-draw:{code}` are verified.
- **AT-40** Replay mode hides future bars, and indicators never use data that has not been replayed yet.
- **AT-41** PNG and CSV exports produce files with the symbol and a timestamp in the name.
- **AT-42** On mobile, the toolbar sheet is usable at 390 px, and there is no page-level horizontal scroll.
- **AT-43** Tier B charts show the HUD, fullscreen, export, and status line, and their existing tests pass.
- **AT-44** No chart shows data without a source/as-of line.

**Final**
- **AT-45** Every new page shows `RISK_DISCLAIMER` and per-item sources.
- **AT-46** With `AI_BRIEFING_ENABLED` unset, no AI UI renders. When it is enabled with a key, bullets without valid citations are rejected (unit test on the validator).
- **AT-47** Every existing route still renders. The KIS stream, ETF holdings, export desk, and disclosures behave as before, except for the D1 ordering fixes, the D9 hook fix, and the F8.6 stream hardening.
- **AT-48** The build output respects Vercel's rules: no runtime filesystem writes, and no function that needs more than 10 s under normal conditions.

## C3. Final report

Post it in chat, in Korean, and save it as `docs/upgrade/FINAL_REPORT.md`.
1. A summary table for F1–F10: status (done, partial, or blocked), key files, and notes.
2. The source table from `SOURCES_STATUS.md`: verified, unverified, or disabled, with the reason.
3. The gate results with numbers: typecheck, test count, ESLint on changed files, build, and the QA smoke test.
4. Deviations from this spec and why, known limitations, and licensing notes (A4).
5. What I need to do next:
   - which env vars to set;
   - running `npm run verify:sources` if you worked offline;
   - how to deploy;
   - how to toggle sources and alerts.
6. The branch name, the list of commits, and the PR link, or the reason there is none.

===== PROMPT END =====
