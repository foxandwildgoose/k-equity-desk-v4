# Export desk acquisition recovery — 2026-10-22

## Observed production failure

A fresh production browser session at revision `5c2ec9c` returned zero export/import/HS observations. Customs reported `KEY_MISSING`, both FRED series reported `REQUEST_TIMEOUT`, and UN Comtrade reported `HTTP_429`. KOSPI and FX each returned 119 actual completed monthly observations through September 2026. Both viewports rendered without application JavaScript/HTTP errors or horizontal overflow. This established an acquisition failure rather than a stale deployment or a broken price-chart renderer.

## Changes

- Add direct OECD IMTS and World Bank GEM monthly goods statistics, with official runtime identity/units/basis verification. Neither needs the user's Customs key. Failure of any one provider cannot suppress successful independent sources.
- Select one coherent, newest-publication total dataset; use consecutive history coverage and source priority for equal reference months. Keep exports/imports together, without per-month stitching or synthetic gaps.
- Reduce a normal page visit from 36 UN monthly queries to four recent months. Share UN admission leases and provider-directed retry times across totals and categories. Selecting another category does not evade a quota cooldown.
- Add a verified public-statistics cache backed by the existing PostgreSQL connection when available. Preserve original statistical months and verification times, serve explicit stale history during failures, and reject empty/older replacements. Missing/unavailable PostgreSQL falls back to explicitly labelled bounded memory.
- Distinguish an ongoing peer refresh from unavailable data and briefly poll empty in-progress responses, so a second visitor can receive the first worker's completed collection.
- Add the corroborated anonymous Customs HS4 website query as an independent category fallback. Unverified HS2 operations are excluded. Current normal development access returned HTTP 503; no HS observation was claimed from this failure.

## Acceptance evidence

Adapter, pipeline and cache fixtures contain test-only values. They validate identity, conversions, forecast rejection, calendar gaps, timing, pagination, concurrent admission and failure handling; they are not evidence of live source connectivity. Initial direct OECD/World Bank diagnostics were denied by the managed environment's network policy. Subsequent normal application requests successfully received World Bank metadata and revealed omitted ISO3 fields in valid GEM observations. Official country metadata now supplies the independently verified identity mapping.

The normal development and built application received 118 actual monthly World Bank export/import observations from October 2016 through July 2026. Both built desktop/mobile passes rendered seven chart canvases, exercised all nine tabs and header controls, and had no application JavaScript/HTTP errors or horizontal overflow. The unavailable August/September observations were not fabricated. The expanded full regression suite passed 236 script tests (21 environment skips), 1,104 native tests and OpenDART pipeline checks; later focused checks cover deployment-aware cache revalidation.

Production revision `750e65e` was verified after the successful Vercel Git deployment on October 22. Actual desktop/mobile responses contained the same 118 export/import observations, 119 completed KOSPI and FX months through September 2026, and live company monthly price histories. PostgreSQL reported `CACHE_UPDATED` on the first visit and `CACHE_HIT` reuse on the next, confirming shared persistence rather than only local memory. All nine tabs and header controls passed without application JavaScript/HTTP errors or horizontal overflow.

Production also successfully received 36 monthly observations each through September 2026 for all seven supported public HS4 baskets: semiconductors, home appliances, secondary batteries, auto parts, computers, wireless devices and displays (`customs.public-item`, `API_OK`). This differs from the development environment's HTTP 503: a local failure did not establish production unavailability. Exact HS4 constituents and thousand-USD conversion were validated before aggregation. A representative unsupported HS2 automobile request correctly returned no observations, identifying the missing Customs key, unverified public HS level and UN HTTP 429 separately. These checks do not certify the 13 HS2 baskets, country operations or MOTIE classifications. Totals retain their own World Bank July reference month; September item observations do not fabricate September national totals.

The production browser also exposed a display issue after a successful category response: the item caption still read the UN-only global metadata, showing `N/A` and a checking state. The follow-up presentation fix uses existing merged observations and the selected category's provider status, explicitly naming the selected category, latest month, month count and observed-category coverage. It does not issue additional provider requests or imply that every reference category has observations.

Customs HS/country services still require separately approved Customs utilization credentials. OpenDART authorization cannot substitute for them. Detailed source contracts and setup are in [export-desk-data.md](../export-desk-data.md).
