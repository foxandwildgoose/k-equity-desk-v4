# Export × KOSPI repair and data audit — 2026-10-21

## Observed production failure

The pre-change production page rendered and all nine tabs could be opened. A repeat desktop/mobile check had no application JavaScript or HTTP errors. The failure was in provider retrieval, series selection and display logic, rather than a missing route.

The actual pre-change response had **zero FRED exports and imports**: both requests aborted. KOSPI returned **120 monthly bars**, including the unfinished October 2026 bar. FX returned 121 bars and dated capitalization quotes returned 264 securities. Despite the available KOSPI history, the total panel rendered no chart because it required exports first. Comtrade initially exposed only one cached month (2025-07, 115 observations); a later request warmed four months. No destination table was available. The industry composite had no eligible evidence-backed exposure rows, but the page did not offer useful individual price charts separately.

An initial request encountered transient chunk 502s; a clean repeat loaded the application. That was not treated as evidence of a reproducible repository defect.

## Findings and changes

| Finding | Resulting behavior |
| --- | --- |
| Browser Customs key inputs were saved locally but never used by the server | Inputs removed; legacy credential fields scrubbed during persistence migration; server-only `CUSTOMS_API_KEY` client added |
| Fixed source labels reported configuration rather than request results | Public provider metadata records authentication, limits, failure, partial/stale data, observation month and checked time |
| FRED request timeout ended after headers, and CSV values had no verified units | Full body deadline and size limit; exact official series metadata, USD scale, monthly frequency and seasonal basis required |
| Exports were mandatory for the entire comparison chart | Union of observed periods; available KOSPI can render independently of exports |
| Unfinished monthly market bars were described as month-end data | Only completed Korean calendar months enter monthly analysis; provider bar dates retained |
| Unused fallback requests could hold up healthy market data | Naver primary with fallback only when necessary; KOSPI, FX and individual security caches isolated |
| Comtrade cache sampled sparse months, never refreshed some empty periods and could outlive a response | Bounded requests/body/deadline/cache and single flight; empty publications expire; explicit dimensions and truncation checks; latest tables prioritized and category history requested lazily |
| Available publications could lag beyond the initial summary probes | HS and country summaries use the newest actually observed publication found in backfill |
| Partial HS baskets and mixed aggregates could appear as complete sectors | Every distinct constituent required; parent/child overlap and conflicting records rejected; HS proxies remain distinct from MTI |
| Regional imports and file vintages could be stitched into national totals | National-only selection; one whole category dataset/file/classification/vintage selected; imports retain explicit priority |
| Historical KRW trailing totals applied the ending month's FX to all USD months | Convert each observed month using its corresponding FX, then aggregate the complete calendar window; spot FX never backfills history |
| Pearson/partial-correlation masks, HAC influence and minimum lag/window samples were inconsistent | Common complete cases, correlation influence function, calendar-preserving HAC, YoY bandwidth 11 and per-lag/window minimum 24 |
| Descriptive exposure seeds could be mistaken for verified financial weights | Seeds remain excluded from verified composites; actual candidate stock price lines are displayed separately; valid composites use a common base and fixed member coverage |
| Unsupported import categories could trigger unsupported live API requests | HS6/HSK10 and other imported categories remain local data; only supported live categories invoke the category endpoint |
| Mobile implicit grid sizing clipped the page despite zero document overflow | Explicit flexible tracks, wrapping controls/tabs; document and inner main containers checked |

No production export or stock-price simulator was found in the audited paths. Descriptive seed exposure tiers remain explicitly unverified and cannot establish numerical company export exposures. Test fixtures are separate from production observations.

## Customs integration boundary

The total, national HS and country operation paths and legacy XML fields were corroborated against independently published clients. The adapter validates pagination, exact identities, completed periods, numeric values and duplicate consistency. Raw `expDlr`/`impDlr` USD values are not multiplied by 1,000. Country shares need the same month's reconciled world denominator. A key alone does not prove approval for each service.

The user has **not issued a Customs service key**. Missing-key behavior makes no Customs requests. Authenticated production payloads therefore remain unverified. If the official item service returns descendants instead of the requested aggregate, the client fails closed rather than summing incomplete data. Activation instructions and service-specific application links are in [export-desk-data.md](../export-desk-data.md).

## Verification and remaining prerequisites

- Export provider/analysis/persistence/pipeline suite: **98 passed**.
- Full repository `npm test`: **236 script tests passed, 21 optional tests skipped; 1,030 native tests passed**, followed by passing OpenDART pipeline fixtures. Latest export changes also passed the focused export suite.
- Latest build and TypeScript checks passed.
- Desktop/mobile development and built-output checks rendered the page with no application exceptions or horizontal overflow. Nine tabs and main controls were exercised with real application requests; no app/data responses were replaced in that pass.
- The standard browser smoke check reports external certificate failures for Pretendard, Google Fonts and the Grok extension. A supplemental pass identified those exact origins. The application itself had no HTTP/page errors; a separate interactive pass neutralized only those external presentation resources. Built output did not diverge from the development baseline.
- This managed cloud environment denies the trade/history upstream origins. Local missing histories are therefore not proof of production availability. Production checks below used real application responses, separately from browser test fixtures.
- GitHub `main` was updated and verified via the GitHub API. A first Vercel production deployment of **5c85bd0** completed at 15:26 UTC after a delay. Both GitHub deployment status and the actual running revision confirmed it. Actual desktop/mobile checks verified 119 completed KOSPI months, 119 FX months and 119 monthly bars for each of four candidate stocks. Total and candidate-stock charts rendered independently despite absent trade data, with no application errors or page overflow. Additional publication-lag, quota-backoff and responsive-layout fixes are on `main`; deployment of that latest version still needs confirmation. The session has no connected Vercel deployment authority; GitHub integration also refused Actions-secret metadata with HTTP 403. No credentials were read or copied.
- Official MTI bulletins, the regional trade cube, historical release/revision vintages, point-in-time capitalization membership and verified company export weights are not inferred from HS totals. Their absent evidence remains visible rather than simulated.

Production trade providers remained unavailable: Customs has no key, FRED export/import requests timed out, and UN Comtrade returned **HTTP 429**. These states were visible, without invented totals. UN refreshes now respect Retry-After and use a conservative cooldown when the header is absent. The data gap requires approved official API access or provider recovery; a successful market chart is not proof that export observations exist.

Do not describe full trade analysis, the newest follow-up deployment, or authenticated Customs integration as verified until their remaining checks succeed.
