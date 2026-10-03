# SPEC — KED v2 → v3 requirement checklist

Condensed from `docs/upgrade/MASTER_PROMPT.md` (authoritative). No requirement dropped.
Legend: [ ] open · [x] done · [~] partial/degraded (see PROGRESS.md) · (M)=MUST (S)=SHOULD (C)=COULD.

## Defects (A1)
- [x] D1a (M) research sorts (`ResearchDesk`, `BrokerReports`, `industry-research`, `research-utils.latestReportPerBroker`) → kernel
- [x] D1b (M) `naver-market.ts` research merges `a.date < b.date` → kernel
- [x] D1c (M) `us-street.ts` notes intraday order; headlines chronological (no per-symbol concat+slice)
- [x] D1d (M) `ResearchHome.tsx` merges sorted newest-first
- [x] D1e (M) disclosure merges (`krx-disclosures.ts`, `getScanDisclosures`, `routes/disclosures.tsx`) → kernel (formats verified)
- [x] D2 (M) popup-safe original opening (sync `window.open("about:blank")` in click)
- [x] D3 (M) KRW price scales integer + separators
- [x] D4 (M) Lightweight Charts NOTICE + visible TradingView link
- [x] D5 (M) robotics classifier: bare AI/인공지능 only with robot term; 클로봇 nameEn "CLOBOT"
- [x] D6 (M) no hard caps passed off as "latest" (research 80/50/40, 7-stock 기업 tab, US 6/10 universes)
- [x] D7 (M) SEC UA from `SEC_USER_AGENT`; `SEC UA 미설정` in health when unset
- [x] D8 (M) README env section → `docs/upgrade/ENVIRONMENT.md`
- [x] D9 (M) `ExportDesk.tsx` hook hoisted (Rules of Hooks)

## B0 Foundations (P1, all M)
- [x] B0.1 `src/lib/feed/types.ts` FeedItem/ResearchItem + mappers from ResearchReport/NewsItem (no consumer breakage)
- [x] B0.2a `parseSourceTime(raw,{zone,now})` all listed formats; invalid → `{iso:null,precision:"unknown"}`
- [x] B0.2b `compareNewestFirst` 6-rule total order
- [x] B0.2c `formatItemTime` (방금/N분 전/N시간 전 <12h; `MM.DD HH:mm`; date-only `MM.DD`; >180d `YYYY.MM.DD`) + tooltip KST (+ET on US)
- [x] B0.2d every ad-hoc date sort replaced; single-format series marked `// ked-allow-string-date-sort: single-format time series`
- [x] B0.3 `src/server/feeds/registry.ts` data-only registry (fields per spec) seeded with all listed sources; korea.kr dead
- [x] B0.4a `fetchWithPolicy` https-only, registry host allowlist (SSRF), ≤3 manual allowlisted redirects, ≤2 concurrent/host + min interval, 5 MiB cap, URL cache TTL + LRU 500, in-flight dedupe, 1 retry w/ jitter on timeout/5xx, 403/429 circuit 15 min (30 on repeat) → health
- [x] B0.4b charset: Content-Type → XML prolog → meta → UTF-8; EUC-KR via TextDecoder
- [x] B0.4c `parseFeed(xml)` RSS2/Atom/RDF → `{title,link,guid,pubDate,description,categories,author}`; strip HTML, decode entities, collapse ws
- [x] B0.4d `canonicalizeUrl` https, drop utm_*/fragment, keep Google News redirect URLs
- [x] B0.4e tests: RSS2, Atom, EUC-KR bytes, CDATA, missing dates
- [x] B0.5a `src/server/feeds/health.ts` per-source: last attempt/success, status, latency, count, newest publishedAt, consecutive failures, circuit, adapter path (v2/legacy/html)
- [x] B0.5b `/status/sources` page, Korean labels, chips, `지금 재시도` (bypass TTL once, respect circuit)
- [x] B0.5c every feed panel `소스 n/m 정상` chip → `/status/sources`
- [x] B0.6a cluster: NFKC, lowercase, strip `[속보]`,`[단독]`,`(종합)`,`(2보)`, trailing ` - Source`, punctuation; Hangul bigrams + Latin words − stopwords; Jaccard ≥ 0.6 & ≤ 12 h; rep = best tier then earliest
- [x] B0.6b importance 0–100 w/ Korean reason chips; weights in `src/data/news-keywords.ts` (tier 25/15/5, flash 15, keyword classes 10–30 cap 40, watch 20, cluster≥3 10, decay −5/h after 2h); flash ≥80, high ≥60
- [x] B0.6c user keyword watch persisted; feeds score + alert filters
- [x] B0.7a `GET /api/feed` params region/kinds/topics/tickers/cursor/limit; merge→cluster→score→sort; opaque cursor `publishedAt|id`; response shape; Cache-Control `public, s-maxage=30, stale-while-revalidate=60`; 8 s budget, partial
- [x] B0.7b `src/components/feed/`: FeedList (virtualized >200, date headers 오늘/어제/날짜, 더 보기), FeedRow (time, source badge + tier dot, 유료, headline `<a target=_blank rel="noopener noreferrer">`, 2-line snippet, ticker chips, reason chips, cluster +N), BriefingDigest, SourceHealthChip, TimeStamp, FilterBar (source/topic/min importance/watchlist-only + `matchesSearchQuery`), EmptyState (reason + health link); mobile 390 px no h-scroll, 44 px targets
- [x] B0.7c Briefing definition: as-of + session; snapshot tiles (source+delay); top stories ≤7 clusters/12 h by importance w/ reasons + all links; theme momentum 6 h vs prior 24 h w/ counts; upcoming events (if calendar source); optional F9 button

## F1 KR News `/news/kr` (P2)
- [x] F1.1 (M) sources: stock.naver FLASHNEWS/MAINNEWS + focus 401/402/403/404/406/429; Hankyung finance+economy; Yonhap/Maeil if verified; Google News `코스피`,`코스닥`,`외국인 순매수`,`증시 마감` (`when:1d`); disclosures via `getScanDisclosures` (kind disclosure); optional KIS news-title (FHKST01011800, token cache ≤1/min)
- [x] F1.2 (M) header (as-of, KRX/NXT session, health chip) → BriefingDigest (KOSPI/KOSDAQ/KOSPI200 + USD/KRW) → FeedList + filters + 더 보기
- [x] F1.3 (M) ticker tagging: exact 6-char code or UNIVERSE name, longest wins, names < 2 chars ignored
- [x] F1.4 (M) `LiveNews` newest-first via kernel, 더 보기 (page 2+), source badges
- [x] F1.5 (S) Naver AI market briefing card (attributed, linked; current + list)
- [~] F1.6 (S) KR calendar strip only with verifiable source, else omitted — omitted: no verifiable KR calendar source (documented)

## F2 KR Research `/research` KR + BrokerReports (P3)
- [x] F2.1 (M) research v2 six categories w/ index paging + totalCount; legacy fallback; adapter path in health; Hankyung consensus only if verified (login → disable)
- [x] F2.2 (M) tabs `전체 · 기업 · 산업 · 시황/전략 · 경제 · 채권 · 데일리`; full company category; `관심종목` filter
- [x] F2.3 (M) compareNewestFirst (date then nid desc); date headers; `오늘 n건 · 이번 주 m건 · 전체 totalCount`; 더 보기 next index
- [x] F2.4 (M) briefing strip: today count per category; 목표주가 상향/하향 TOP (goal-price-changed); 주간 인기 (weekly-hot); 신규 커버리지 (heuristic label)
- [x] F2.5 (M) card: category, broker, date; ticker link, rating, TP; Δ% only with fetched prior same-broker report; extractive summary + summarySource label; buttons `PDF 원문` · `리서치 페이지` · `상세`
- [x] F2.6 (M) open originals: anchor if pdfUrl known; else sync `window.open("about:blank")` → resolve → `opener=null; location.replace`; fallback research page; null → toast w/ link; pre-resolve first 12 visible (IntersectionObserver, concurrency 3, server cache 10 min)
- [x] F2.7 (M) detail sheet: extractive bullets, rating/TP, prev/next same ticker (detail-page), PDF + page links, broker filter
- [x] F2.8 (S) KR Street Moves for watchlist (latest per broker, date/broker/rating/TP/Δ)
- [~] F2.9 (S) industry filter via v2 industryTypes if verified, else fixed taxonomy — v2 industryTypes unverified offline → fixed taxonomy chips used

## F3 US News `/news/us` (P2)
- [x] F3.1 (M) Bloomberg RSS (A4) + GN `site:bloomberg.com when:1d`; naver worldNews + focus 403; Fed press RSS; SEC 8-K Atom (tier 1, ticker via CIK map) if verified; Finviz/Nasdaq ratings as kind rating; CNBC/MarketWatch/Yahoo if verified; GN EN `stock market today`,`S&P 500`,`Nasdaq`,`Treasury yields` (`when:1d`); optional Finnhub
- [x] F3.2 (M) snapshot tiles ^GSPC ^NDX ^DJI ^RUT ^VIX ^TNX DX-Y.NYB CL=F GC=F BTC-USD KRW=X via Yahoo chart, fixed allowlist, not via `yahooUsSymbol`; source + delay labels
- [x] F3.3 (M) session badge (pre/regular/after/closed from NY clock, `추정`); KST/ET toggle
- [x] F3.4 (M) economic calendar next 7 days from `fetchUsOfficialPolicy().calendar`
- [x] F3.5 (M) `usWatchlist` in store (default US_STREET_SYMBOLS); tag `$TICKER`, cashtags, exact company-name map (watchlist + robotics US)
- [x] F3.6 (S) MarketBar US segment (SPX, NDX, VIX, US10Y, USD/KRW) labeled delayed
- [~] F3.7 (C) US earnings-today (Nasdaq calendar JSON) if verified — not built: Nasdaq calendar JSON unverified offline

## F4 US Research `/research?market=us` + `/us-research` (P3)
- [x] F4.1 (M) Korean scope banner (exact text)
- [x] F4.2 (M) origin tiers w/ badges: OFFICIAL, PUBLIC_RESEARCH (verified-public registry only), STREET, NEWS
- [x] F4.3 (M) newest first: UsResearchDesk notes by Finviz timestamp, headlines by parsed time; ResearchHome featured/pool/grids by publishedAt; period default `최근 30일`
- [x] F4.4 (M) Street Moves table: date, ticker, broker, action (Upgrade/Downgrade/Initiate/Reiterate/PT change), rating from→to, PT from→to + Δ% (only both in row), links; filters ticker/broker/action/기간; sticky header; CSV export
- [x] F4.5 (M) Street universe first 12 of usWatchlist ∪ US_STREET_SYMBOLS ∪ robotics US, eager, cached 20 min; others lazy, concurrency 3; official eager OFFICIAL_UNIVERSE(6), others on demand via getUsOfficialCompany
- [x] F4.6 (M) every card `원문` + `PDF`/`Exhibit 99` where applicable; lazy URLs use F2.6 pattern
- [x] F4.7 (S) "US 리서치 브리핑" strip: tier counts today/week, top up/downgrades, day's filings, next macro releases

## F5 KR ETF News `/news/etf` + `/etfs` "ETF 뉴스" tab (P4)
- [x] F5.1 (M) extend `etf-news.ts` (keep stage logic): GN queries (8) + issuer brands (10); Hankyung finance filtered; naver news search `query=ETF` if verified
- [x] F5.2 (M) enrichment via `fetchAllEtfs` + longest-name `matchEtf`: code, price, 1D%, volume, market value, issuer, link `/etfs/$code`
- [x] F5.3 (M) briefing: 신규 상장 + 상장 예정 (14 d), 상장폐지 예정, fund-flow, 퇴직연금 제도, top trading-value snapshot, robot/AI ETF link chips
- [x] F5.4 (M) newest first; filters issuer, stage, theme, retirement-eligible only

## F6 Robotics `/robotics` tabs overview·market·policy·companies·research·etf (P4)
- [x] F6.1 (M) `src/data/robotics.ts`: KR seed (6 codes, runtime-verified), KR candidates resolved by name via security search, exposure names (indirect), US seed (15, Yahoo-verified), private cos (news only); tags segment + exposure; user add/remove persisted
- [x] F6.2 (M) overview: KPI tiles (KR/US basket EW 1D%, policy 7d, research 7d, news 24h), top movers KR/US, latest 5 market/5 policy/5 research, robot ETF snapshot; sources + newest first
- [x] F6.3 (M) market trends: Robot Report, 로봇신문, IEEE Spectrum (if verified), GN KR ×4, GN EN ×4; robot topic classifier
- [x] F6.4 (M) policy: Federal Register (terms, order=newest, relevance filter title/abstract, drop premerger/early-termination, show type+agencies), GN EN ×3; KR GN ×5 + 로봇신문 policy; status chips only from source keywords
- [~] F6.5 (M) companies: KR table (name, code, segment, exposure, price, 1D%, 52w pos, mcap, latest news time, latest research date → /stock), US table (Yahoo → /us), row → news drawer newest first — US market cap `—` (not in the Yahoo chart response; stated in UI)
- [x] F6.6 (M) ETF: KR via name regex from live list (code, name, price, 1D%, volume, mcap → /etfs), US seed BOTZ/ROBO/ARKQ/KOID/HUMN/BOTT verified
- [~] F6.7 (M) research: KR v2 industry (robot kw) + v2 company for robot tickers (≤10 itemCodes/call) + Hankyung if verified; US PUBLIC_RESEARCH robotics, Street Moves, OFFICIAL filings; extractive, 원문, newest first — Hankyung robotics not separately verified (hankyung-it feeds the market tab via keyword filter); PUBLIC_RESEARCH empty (registry note shown); OFFICIAL on demand per symbol
- [x] F6.8 (M) taxonomy keywords list; bare AI/인공지능 only with robot term; tests updated
- [x] F6.9 (M) `/industry/robotics` → `/robotics` link; sidebar sector row links `/robotics`; dashboard card (P7) — links P4, dashboard 로봇 스냅샷 card P7

## F7 Pro charts (P6)
- [x] F7.1 (M) `createProChart`/`useProChart` in `src/components/charts/core/`; CSS-var theme, `usePriceColors`; `formatters.ts` (KRW p0/minMove1/separators; USD 2dp, 4 < $1; %, volume 만/억 KR, K/M/B US); `krxTickSize(price, instrument)` w/ tests (verified table; ETF/ETN separate)
- [x] F7.2 (M) `ChartShell`: toolbar slot, HUD, legend w/ visibility toggles, status line (source, delayed/realtime, last update), fullscreen, PNG (`takeScreenshot`) + CSV of visible bars, `?` shortcut help + one-key tools
- [x] F7.3 (M) `attribution.ts` NOTICE + visible footer link; invariant test
- [x] F7.4 (M) crosshair + time-range sync helper
- [x] F7.5 (M) types candles/hollow/OHLC bars/Heikin-Ashi (pure + test)/line/area/baseline; scales normal/log/percent/indexed-100
- [x] F7.6 (M) indicators pure + known-value tests; param dialog; searchable catalog add/remove; saved per layout: SMA/EMA/WMA/HMA multi; Bollinger/Keltner/Donchian/Ichimoku; PSAR/Supertrend; session VWAP + Anchored VWAP; Volume+MA, OBV, Volume Profile (visible range, right histogram, POC/VAH/VAL); RSI, Stoch, StochRSI, MACD, ADX/DMI, CCI, MFI, Williams %R; ATR; Pivots (Classic/Fib/Camarilla), 52w hi/lo
- [x] F7.7 (M) drawing tools (trend, ray, extended, h-line/ray, vertical, parallel channel, rectangle, fib retr/ext, measure, long/short position, text, arrow) as primitives; magnet/snap; select/move/handles; color/width; lock/hide; object manager; undo/redo Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z
- [x] F7.8 (M) compare overlay ≤3 symbols KR/US, percent-from-start, legend last values
- [x] F7.9 (M) `/chart?symbols=…&layout=1|2|4` workspace, synced crosshair, optional synced interval, per-pane symbol search; fullscreen opens it; persistence `ked:chart:v2:{market}:{code}:{interval}` + named templates; migrate `ke-chart-draw:{code}` once w/ test
- [x] F7.10 (M) event overlays w/ toggles: disclosures, news clusters (count marker/bar → list), research TP changes, US div/splits
- [~] F7.11 (M) alerts: h-line crossing up/down once/every; RSI 70/30 + MA cross; client-evaluated; fired via Live Wire; managed in drawer — evaluated on each chart data refresh (the KIS stream updates quote caches, not chart bars); listed in the Live Wire drawer + /settings/alerts
- [x] F7.12 (M) bar replay (daily/weekly): start bar, play/pause/step, 1–10×; indicators only on replayed data
- [x] F7.13 (M) extended hours shading only when bars exist (US includePrePost; KR NXT if present); session-break lines; never synthesize bars
- [x] F7.14 (M) mobile: toolbar → bottom sheet, long-press crosshair, 44 px targets, no h-overflow 390 px
- [x] F7.15 (M) lazy memoized indicators, 10k bar cap, no long task > 200 ms @5k daily bars
- [x] F7.16 (M) Tier B (ValuationBand, ValuationHistory, InvestorFlow, ExportDual) onto core: formatters, HUD, legend, fullscreen, PNG/CSV, range presets, log/percent where sensible, status line, pane crosshair sync; tests green
- [x] F7.17 (M) Tier C (ExportDesk BarChart, Sparkline): title, units, source/as-of, accessible tooltips/aria, PNG/CSV where sensible (+ D9)
- [ ] F7.18 (C) optional TradingView widget tab on `/us/$symbol` only, lazy, attribution kept, labeled `지연 시세 · TradingView 제공` — not built (COULD; left out to keep the chart surface on lightweight-charts only)

## F8 Live Wire (P5)
- [x] F8.1 (M) `GET /api/wire?regions=KR,US` newest 100, canonical sorted regions, TTL table, cluster+score, Cache-Control `public, s-maxage=20, stale-while-revalidate=40`, 8 s budget, partial
- [x] F8.2 (M) `useLiveWire()`: Web Locks leader (fallback BroadcastChannel + localStorage heartbeat); 20 s visible/60 s hidden/180 s both markets closed; exp backoff ≤ 5 min; dedupe id + cluster; persist last-seen + unread
- [x] F8.3 (M) header button + unread badge; right drawer tabs 전체·한국·미국·ETF·로봇·관심종목; min tier + source filters; pause; FeedRow; optional desktop ticker tape (off)
- [x] F8.4 (M) sonner toasts for high+ (configurable); OS notifications only after "데스크톱 알림 켜기" click (permission requested in click); default flash + watchlist/keyword; ≤5/10 min then one digest toast; quiet hours 23–07 KST editable; region/category toggles; optional WebAudio beep (off); click focuses tab + opens item
- [x] F8.5 (M) "알림 설정" page/sheet persisted via store
- [x] F8.6 (M) KIS SSE: `retry: 3000`, close after 240 s, client `재연결 중` state, Naver snapshot fallback kept
- [x] F8.x document Web Push as future work (settings page note + PROGRESS/FINAL_REPORT)

## F9 Optional AI layer (P7, C)
- [x] F9.1 enabled only with `AI_BRIEFING_ENABLED=true` + provider key + `AI_MODEL`; else no UI
- [x] F9.2 user-clicked "AI 브리핑 생성" on F1–F6; ≤30 on-screen items (title, snippet, source, time, url, id); Korean bullets w/ `[n]` citations; server strips/rejects uncited bullets + unknown URLs
- [x] F9.3 cache by input hash 15 min; `AI_DAILY_CAP` (50); token estimate (no price table: cost not shown); label `AI 요약 · 원문 확인 필요`; provider interface anthropic + xai; model from `AI_MODEL`
- [x] F9.4 optional EN→KO headline translation labeled `기계 번역`

## F10 Navigation / state / dashboard
- [x] F10.1 (M) grouped sidebar 한국/미국/테마/도구 (exact items); `/news` → `/news/kr`; sectors below; mobile Sheet
- [x] F10.2 (M) store `version: 2` + `migrate`; fields usWatchlist, keywordWatch, alertSettings, newsPrefs, chartPrefs, roboticsCustom; migration test from unversioned
- [x] F10.3 (M) dashboard cards after first paint (`deferSecondary`): Live Wire top 5, 오늘의 리서치 (counts + 3 newest), US snapshot, Robotics snapshot

## Platform / process
- [x] A7 `.qa/` in `.gitignore`; restore `.vercel` before commits; per-phase commits
- [x] A8 `docs/upgrade/ENVIRONMENT.md`
- [x] A9 `scripts/verify-sources.mjs` + `npm run verify:sources` → `SOURCES_STATUS.md`
- [x] C1.5 `scripts/qa-smoke.mjs` + `npm run qa:smoke`
- [x] C1 invariant test `scripts/project-invariants.test.mjs`
- [x] C3 `docs/upgrade/FINAL_REPORT.md` (Korean)

## Acceptance tests
- Foundations: AT-01 mixed dates newest-first + seq tie · AT-02 date-only no time, unknown sinks `날짜 미상` · AT-03 RSS/Atom/EUC-KR identical normalized · AT-04 cluster `[속보] 코스피 2% 급락` ≈ `코스피, 2% 급락 마감 - 한국경제`; high+ has ≥1 reason · AT-05 fetch policy rejects non-allowlisted/non-https; 429 opens circuit · AT-06 KRW integer w/ separators, USD 2dp · AT-07 attribution link on every chart page · AT-08 unversioned store migration keeps watchlist/theme/colorConvention
- News: AT-09 `/news/kr` digest + list newest-first, sources, `rel="noopener noreferrer"` · AT-10 filters + 더 보기 no duplicates · AT-11 ticker chips → `/stock/$ticker`, no "LG" inside "LG에너지솔루션" · AT-12 `/news/us` tiles w/ delay labels + KST/ET; Bloomberg `유료` headline+link only · AT-13 Bloomberg off (env or toggle) removes it everywhere · AT-14 `/api/feed` Cache-Control s-maxage, ≤ 8 s w/ `partial`
- Research: AT-15 KR tabs newest-first, date headers, totalCount, 더 보기 · AT-16 `PDF 원문` popup-safe (Playwright popup, mobile too) · AT-17 TP strip up/down; Δ% only both sourced · AT-18 7-stock list gone; company tab paginates · AT-19 US notes/headlines/official newest-first; banner; original links · AT-20 Street Moves date-desc; CSV = visible rows · AT-21 "AI 반도체" not robotics
- ETF/Robotics: AT-22 ETF matches show code/price/volume → `/etfs/$code`; stage chips on fixtures · AT-23 robotics overview tiles w/ sources, empty w/ reason · AT-24 robot ETF regex matcher fixture · AT-25 unresolved symbols hidden + listed in health · AT-26 Federal Register filter drops premerger/early-termination; keeps robotics/Section 232 · AT-27 policy chips only on keyword presence · AT-28 `/industry/robotics` → `/robotics`; CLOBOT — P4: AT-22/23/25/28 pass in `qa:acceptance` (mocked fixtures in the harness only); AT-24/26/27 unit tests (`src/lib/robotics/robotics.test.ts`, `src/lib/etf-news.test.ts`)
- Live Wire: AT-29 single leader polls · AT-30 no permission prompt on load · AT-31 12 items/10 min → ≤5 + 1 digest · AT-32 quiet hours suppress OS, badge still updates · AT-33 price alert fires once on cross · AT-34 SSE closes by 240 s, client reconnects — P5: AT-29/30/32/34 pass in `qa:acceptance`; AT-31/32/33 unit tests (`src/lib/wire/live-wire.test.ts`)
- Charts: AT-35 indicator known values · AT-36 drawings CRUD/lock/hide/undo/redo/persist · AT-37 compare % from first visible bar · AT-38 2×2 crosshair sync · AT-39 key format + migration · AT-40 replay hides future, no lookahead · AT-41 PNG/CSV names w/ symbol + timestamp · AT-42 mobile toolbar sheet, no h-scroll · AT-43 Tier B HUD/fullscreen/export/status; tests pass · AT-44 no chart without source/as-of — P6: AT-36/38/41/42/43/44 + F7.15 perf (5,000 bars, 0 long tasks) pass in `qa:acceptance`; AT-35/37/39/40 unit tests (`chart-indicators.test.ts`, `src/lib/charts/charts.test.ts`); AT-33 in `live-wire.test.ts`
- Final: AT-45 RISK_DISCLAIMER + per-item sources on new pages · AT-46 AI UI absent when unset; uncited bullets rejected · AT-47 existing routes render; KIS/ETF holdings/export desk/disclosures unchanged except fixes · AT-48 Vercel rules (no FS writes, no fn > 10 s normal)
