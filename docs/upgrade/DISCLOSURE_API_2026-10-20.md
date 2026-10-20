# Read-only official disclosure API

GET `/api/disclosures?code=373220&begin=2026-10-17&end=2026-10-20&page=1&pageSize=100`

Uses the existing server-only `OPENDART_API_KEY`. No credential is accepted from
callers, returned, copied, or logged. Existing deployment protection is unchanged.
Like the existing public feed route, this route introduces no application login.
It does not use HTML fallback or fetch Naver/KIND. Existing screen behavior stays
on its original functions.

Inputs: exact six-character uppercase exchange code; inclusive `YYYY-MM-DD` KST
receipt dates; start <= end <= today; maximum date difference 120 days; page
1–1000 (default 1); pageSize 1–100 (default 100). Unknown and duplicate parameters
are rejected. Empty results are not errors. An out-of-range page returning 013
is not treated as successful completion unless it is page 1.

Response:
- `source: "OpenDART"`, `query` with normalized input and `timezone: "Asia/Seoul"`.
- `status`: configured, state, safe message, checkedAt, fallbackUsed=false,
  diagnostic reasonCode when available.
- `items`: receiptNo (deduplication identity), receiptDate (date only), corpCode,
  stockCode, corpName, reportName, submitter, market, dartUrl.
- `pagination`: page, pageSize, totalCount, totalPages, nextPage, complete;
  null on error. Top-level `complete` is false on error.

`complete` means this is the terminal page, not that the caller has fetched all
preceding pages. Start at page 1 and follow nextPage. Accumulate unique receiptNo
values, compare accumulated count to totalCount, and check totals remain stable
across pages. Lists are live, not snapshot-isolated: new filings/corrections can
move page boundaries. If totals change, repeat the bounded date window and merge
by receiptNo. Retain corrections separately; `last_reprt_at=N` is explicit.
No intraday timestamp or original/correction relationship is invented.

HTTP 200: official ok/empty. HTTP 400: invalid request. HTTP 429: local budget or
upstream quota, Retry-After 60. HTTP 503: missing/invalid key, company resolution,
network or malformed upstream payload. Errors carry fixed diagnostics, never raw
upstream errors. No partial page or HTML result is reported as API success.

Protection: one upstream list page per request; existing bounded result cache
(90 seconds), failure cache and in-flight deduplication; shared company identity
cache (12 hours), credential/quota cooldowns, timeouts and response-size limits.
New uncached paged requests are limited to two concurrent and 60 per minute per
server instance. Success responses permit 60 seconds CDN caching. These limits
are per instance, not a global distributed quota. Callers should run sequentially
and honor 429. Global rate enforcement would need an independently approved
shared limiter or platform configuration; no new infrastructure is introduced.

Validation uses synthetic fixture keys only. Never pull production environment
variables to run local verification. Production verification must call this API,
record execution time and requested dates, and distinguish unavailable requests
from zero filings. No investment report or schedule is enabled by this API.
