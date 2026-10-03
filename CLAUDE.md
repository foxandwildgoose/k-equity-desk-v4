# CLAUDE.md — Korea Equity Command Center (KED v3 upgrade)

Authoritative spec: `docs/upgrade/MASTER_PROMPT.md`. Memory across compaction:
`docs/upgrade/SPEC.md` (requirement checklist), `PLAN.md`, `PROGRESS.md`
(base commit, mode, phase status, next steps). Re-read SPEC + PROGRESS after
any context compaction before continuing.

## Commands
- `npm run dev` — dev server on 0.0.0.0:8080 (regenerates `src/routeTree.gen.ts`).
- `npm run typecheck` — `tsc --noEmit`, must be 0 errors.
- `npm test` — script tests (`scripts/**/*.test.mjs`) + app tests (explicit list
  in `package.json` "test"; **append every new `*.test.ts` there**).
- `npm run build` — Vite + nitro (vercel preset). Rewrites tracked `.vercel/output/`.
- `npm run verify:sources` — one GET per enabled registry source → `docs/upgrade/SOURCES_STATUS.md`.
- `npm run qa:smoke` — Playwright route smoke (desktop 1440×900 + mobile 390×844) → `.qa/`.
- Lint only changed files (never bare `npx eslint` — pre-existing errors elsewhere):
  `FILES=$(git diff --name-only --diff-filter=ACMR 7c154f5 -- '*.ts' '*.tsx' '*.mjs'); [ -z "$FILES" ] || npx eslint --no-warn-ignored $FILES`

## Platform invariants (A2, binding)
- Do not recreate/restructure `vite.config.ts` / `tsconfig.json`. Keep dev
  `0.0.0.0:8080` strictPort, preview `127.0.0.1:8081`, build/preview-gated
  `nitro({ preset: "vercel", serverDir: "./server" })`, `grokPwaPlugin()`,
  `appEnvPlugin()`, `authPopupPlugin()`, `pgliteBootstrapPlugin()`.
- Never delete/modify: `public/__grok/`, `server/`, `scripts/grok-pwa-*`,
  `startup.sh`, `.grok/`, `AGENTS.md`, `AGENTS.project.md`, `attachments/`,
  `artifacts/`, `src/lib/auth/*`, `src/lib/app-data/*`, `src/lib/db.ts`.
- `src/routes/__root.tsx` keeps `<PreviewHostBridge />` + `<CreatedWithGrokBanner />`;
  no `og:*`/`twitter:*` meta there; no CSP blocking `https://grok.com`.
- Auth OFF, no DB: no migrations, no `@/lib/db`, no `authMiddleware`. Per-user
  state = zustand persist (`korea-equity-cc`, version 2) or localStorage.
- Secrets are server-only (never `VITE_`), never create `.env*` files.
- Vercel-safe: no runtime FS writes, no server-only Node APIs at import time in
  client code, no hard-coded app hosts/ports, no secrets in code.
- Never edit `src/routeTree.gen.ts` by hand — regenerate via dev/build, then commit.

## Product rules (A3)
1. Never fabricate data. Unknown → `—` + reason. Synthetic fixtures only in
   `*.test.ts`, marked `// synthetic fixture (format sample), not market data`.
2. Every item: source name, `publishedAt` (or `날짜 미상`), `fetchedAt`, `원문` link; paywalled → `유료` badge.
3. Newest first everywhere via `compareNewestFirst` (`src/lib/feed/sort.ts`).
   Server returns sorted lists; client never re-sorts raw date strings.
4. Summaries deterministic + extractive (`buildResearchExecutiveSummary`). AI text
   only in optional F9: user-initiated, cited, labeled `AI 요약 · 원문 확인 필요`.
5. Korean first, KST default; US pages have KST/ET toggle. English titles stay
   English unless F9 translation (`기계 번역`).
6. Not investment advice: show `RISK_DISCLAIMER` (`src/data/market.ts`) on every new page.

## Licensing & source etiquette (A4)
- Charts: open-source `lightweight-charts` only (Apache-2.0). Never TradingView
  Advanced Charts / Trading Platform. Visible credit link
  "Charts: TradingView Lightweight Charts™" → https://www.tradingview.com/ is
  what allows `attributionLogo: false`.
- TradingView free widgets: optional secondary view only (F7.18), attribution intact.
- Bloomberg: public RSS headlines only (headline, link, time), poll ≥ 5 min,
  never bodies, circuit-break on 403/429, `NEWS_BLOOMBERG_ENABLED` + in-app toggle,
  fallback Google News `site:bloomberg.com`.
- Naver (`stock.naver.com`, `m.stock.naver.com`): unofficial; personal, low-volume,
  cached, read-only. No bulk crawl, no rate-limit/anti-bot bypass, no cookies,
  never call view-recording endpoints (`/researches/v2/{type}/{id}/view`).
- Never bypass paywalls/logins; never republish full text. Show headline,
  source snippet ≤ 240 chars, our extractive summary; link out.
- Every registry source has an on/off switch; health is visible at `/status/sources`.

## Code conventions (A6)
- Pure logic in `src/lib/**` (parsing, time, sort, cluster, scoring, format,
  indicators): runtime imports via relative `./x.ts` paths only; `@/…` only as
  `import type`. No enums/namespaces/parameter properties/decorators/JSX
  (tests run with `node --experimental-strip-types`). Data that lives behind `@/`
  imports (e.g. `UNIVERSE`) is passed in as a parameter.
- Server adapters `src/server/**`; server fns `src/lib/market-fns.ts` or
  `src/lib/*-fns.ts` with `createServerFn({ method: "GET" }).validator(zod)`
  (`.validator`, not `.inputValidator`); hooks `src/lib/use-*.ts`; HTTP endpoints
  `src/routes/api.*.ts` (pattern of `api.market-stream.ts`), never in `server/`.
- zod-validate every server fn / API input. Every outbound fetch has a timeout
  (≤ 8 s; ≤ 10 s for PDF/HTML pages). Feed fetches go through `fetchWithPolicy`.
- Reuse: `fetchGoogleNewsRss`, `decodeHtmlEntities`, `htmlToReadableText`,
  `safeExternalUrl`, `matchesSearchQuery`, `formatPrice`, `formatPct`,
  `normalizeKrTicker`, `usePriceColors`.
- Deps: `fast-xml-parser` allowed; `@tradingview/lwc-plugin-vertical-line`
  optional; anything else justified in PROGRESS.md.
- Single-format time-series string sorts keep the trailing marker
  `// ked-allow-string-date-sort: single-format time series`.

## Git policy (A7)
- Session branch: `claude/new-session-mz0027` (harness-mandated; spec name
  `feat/v3-briefings-robotics-procharts` recorded as deviation). Base `7c154f5`.
- Before every commit (never commit build output):
  `git restore --staged --worktree -- .vercel && git clean -fdq -- .vercel/output`
- QA artifacts in `.qa/` (gitignored). Never add files to `screenshots/`.
- Conventional Commits (`feat(news): …`, `fix(research): …`), ≥ 1 commit per phase.

## Grok-only steps to ignore (A2)
`startup.sh` execution or `/workspace` paths, `scripts/browser-smoke.mjs`,
preview-proxy workflows, the `og` brand-pass subagent, `imagine_*` tools,
`.grok/skills/*` game/art skills. (AGENTS.md is otherwise read for its binding parts.)

## Chat language
Status updates and the final report in Korean; code, comments, commits in English.
