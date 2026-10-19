# ETF holdings integrity — 2026-10-19

The issuer button and the displayed holdings previously used separate paths.
A working product link did not prove that the server had downloaded and
validated that product's holdings. ETF holdings are retrieved from issuers and
cached in process memory; they are not read from the shared Neon database.

## Database identification

The connected service is **Neon PostgreSQL**, https://console.neon.tech/.
This is supported by operator verification in
`KIWOOM_FLOW_VERIFICATION.md` (shared Neon → Vercel architecture and actual
table/persistence checks) and `BOLLINGER_SCREENER_2.md` (operator-confirmed Neon
tables and the production/neondb connection used by Vercel). `src/lib/db.ts`
uses `DATABASE_URL` with PostgreSQL. No secret values were inspected or printed.
The current session has no Vercel environment-variable credentials, so the
specific Neon project ID and today's configured connection were not directly
queried. No database settings, tables, or migrations were changed.

## Confirmed failure and repair

KODEX 미국S&P500 (379800) returned a full official 2026-10-19 PDF block:
505 original rows, including the CU notional, 503 stocks with explicit
percentages, and one cash row with no percentage. Its published stock ratios
sum to **100.11%**. The old all-or-nothing validator discarded every ratio
because that cash row's ratio was null.

The validator now has a narrowly scoped opt-in for the full KODEX response.
Only an actual KRD01 cash/deposit security may retain a missing ratio; missing
stock/bond ratios, inconsistent dates, duplicate securities, partial responses,
and invalid totals are still rejected. Each published stock ratio is copied
unchanged; the cash percentage remains unknown. The displayed sum is the sum
of available published percentages, with a 503/504 coverage label. It is never
rescaled to 100%, and a missing cash ratio is never assigned zero.

The real-response regression fixture is
`src/server/fixtures/kodex-sp500-20261019.json`. It records source URL, receipt
time and original-response SHA-256 and retains all 505 original PDF rows' relevant
fields. NVIDIA 7.88%, Apple 7.49%, and Microsoft 6.01% are examples from this
specific disclosure, not permanent weights.

## US holdings and source safeguards

- Preserve issuer identifiers such as `GOOGL US Equity`, `GOOG US Equity`, and
  `BRK/B US Equity`. All 503 stocks in the captured KODEX response have a
  demonstrated US listing independently of optional quote lookup.
- Use exact published ticker/share class or full normalized company identity
  to enrich quotes. Do not attach the first autocomplete result. A foreign ISIN
  cannot become a domestic stock ticker; an ISIN's domicile alone does not
  establish its trading venue. Reuters exchange suffixes are never guessed.
- KR1 bonds and KR4 derivatives no longer produce bogus domestic equity codes.
  Modern alphanumeric KR7 equity/ETF codes remain supported.
  Encoded preferred-share classes are not treated as trading tickers: for
  example KR7005931001 must not become 005931 when Samsung preferred trades as
  005935. Explicit issuer trading codes remain intact; otherwise exact name
  resolution is required.
- Reuse the central exact code-to-product mapping for SOL, KODEX, HANARO and
  IBK holdings requests instead of repeating whole-catalog discovery. Quotes,
  FX and share quantities do not participate in official-weight calculations.
- SOL checks returned ETF/product IDs and raw record counts when supplied,
  including the CU row. TIGER checks returned dates and pagination and rejects
  unexplained capped responses even when their percentages nearly sum to 100.
- Concurrent retrievals share one request. Successful recent disclosures use
  the existing 90-second cache; unavailable/historical results retry after five
  seconds. A Korea calendar-day change invalidates cached disclosures.
- A slow foreign quote no longer discards other completed foreign quotes at
  the two-second quote deadline. Published ratios remain independent of both
  completed and unavailable quotes.

## Actual source comparison before the repair

These checks used actual official responses and the actual deployed application,
with TLS verification enabled and no holdings mocks, on 2026-10-19.

| ETF | Result |
| --- | --- |
| SOL 글로벌DRAM반도체플러스 0246X0 | All 11 disclosed ratios already matched the official 10/19 response; sum 99.98%. Micron 26.92%, Samsung 25.17%, SK hynix 22.51%, Kioxia 3.30%. No hardcoded replacement was needed. |
| KODEX 미국S&P500 379800 | Official 503 stock ratios discarded because cash ratio was absent; repaired as described above. |
| ACE 미국S&P500 360200 | All 499 disclosed ratios matched, including published zero weights; sum 99.45%. |
| TIGER 미국S&P500 360750 | Official page and API returned upstream CloudFront HTTP 403. App fell back to a 10/16 third-party name list and showed no ratios. |
| RISE 미국S&P500 379780 | Official discovery returned HTTP 503; no exact product link was verified. App showed reference names without ratios. |

TIGER's current `chart/prdct-item-list.ajax` adapter replaces the obsolete
HTML-only assumption and no longer requires the marketing page to load first.
Its field/date contract is documented by the two commit-pinned public
integrations named in its source. Those integrations supply schema evidence,
not portfolio values. Its regression cases use explicitly synthetic responses.
The actual issuer's HTTP 403 remains unresolved; the new adapter is not proof
of live receipt. RISE's upstream failure also remains unresolved. Neither case
is filled with guessed percentages or presented as a successful live feed.

## Display and verification

Every ETF page distinguishes the issuer link, disclosure date, receipt time,
published-weight coverage and current/historical/unavailable retrieval status.
Uploaded disclosures and every official source older than seven Korea calendar
days carry a historical warning. A recent dated disclosure is not described as
real-time holdings. Missing ratios remain `—`.
When no official ratios are available the API sum is `null`, not a fabricated
0% produced by reducing an empty array.

All 149 focused parser/source/identity/status/quote tests pass. The actual server pipeline
with controlled upstream responses, TypeScript checking, production build and
deployment checks are run for this change. The pipeline regression proves the
503/504 case, direct product selection, unavailable FX/quotes, and shared
concurrent retrieval without altering any issuer percentage. Browser checks
cover desktop and mobile and compare current source data with the returned
application holdings. Unrelated external font/branding failures are kept
separate from application failures in feature verification.

The unmodified browser smoke checks rendered both desktop and mobile, with no
page exceptions, overflow or dev/build divergence. Each reported three external
font/branding certificate failures in the cloud browser; these are not claimed
as clean network passes. The focused feature checks isolate only those external
resources and retain actual application RPCs. Initial cold development checks
also exposed a fixture-server optimizer cache collision: the pipeline test now
uses its own temporary cache, and stable checks run after restarting the dev
server. These failed attempts remain in the local verification evidence.
