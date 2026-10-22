# Export category hydration and official monthly bulletins

## Observed gap

Production deployment `3fb80f6` is the deployment-specific URL `https://k-equity-desk-v4-q41nkdauf-foxandwildgoose.vercel.app` (confirmed through the GitHub deployment status). Its Core20 panel fetched only the focused category. The browser merged previously selected categories but did not read other verified categories already present in PostgreSQL. A fresh visitor therefore saw missing cards even when seven public HS4 histories had already been verified on the server. The previous caption fix did not implement whole-panel hydration.

The MOTIE label was static: there was no monthly bulletin acquisition adapter. Customs HS proxies are not interchangeable with the ministry's MTI definitions; in particular, HS87 includes vehicle parts and cannot stand in for the official automobile item.

## Changes

- One bounded catalog reads verified summaries for all reference categories from the shared store. Batched category and retry-state queries replace individual cache lookups. This first response makes no origin requests.
- Subsequent catalog polls await at most two category loaders under a shared lease. Existing per-category leases and public-provider cooldowns still apply. Persistent failure cooldowns advance the queue rather than repeatedly loading one unsupported category. No background promise depends on a Vercel request remaining alive after its response.
- Card summaries remain separate from monthly analytical histories. Exact prior-year months, source/classification/vintage identity, observed zeros and national scope are validated. Imported whole-category datasets keep priority; missing imported observations are not silently filled from another source.
- Cards and the all-industry table show values, statistical months, actual provenance and pending/unavailable/stale states. Shares require the same month's compatible source; reference categories are not normalised to national exports.
- The official ministry adapter resolves actual monthly articles from the corroborated MOTIR/MOTIE board and discovers actual attachment links. It validates national monthly scope, exact bulletin identity, export amounts and USD units. Verified bulletin figures use `OFFICIAL_ITEM` rather than assuming an MTI classification. A reachable article without validated figures is explicitly partial. See [source evidence](../export-motie-evidence.md).
- Static MOTIE disconnection text is replaced by actual provider state and an exact official article link when found. Official one-month bulletin figures can feed cards; they are never appended to HS chart histories.

## Verification and limits

Catalog/store tests cover cross-visitor cache visibility, exact prior-year identity, zeros, failures, concurrent leases, bounded warming, cooldowns and batch storage. Ministry fixtures cover source identity, dates, article-body scoping, units, ambiguity and actual decoding of a generated PDF. These test values never enter production.

Actual production responses, automatic card counts, source identity, reference month, cache backend and desktop/mobile interactions remain the release acceptance gate. Parser fixtures alone do not establish a live ministry connection or coverage of all 20 reference categories.

Production revision `dbe07e8` passed desktop/mobile interaction checks on all nine tabs with no application HTTP/JavaScript errors or horizontal overflow. Seven previously verified HS4 categories appeared automatically from PostgreSQL without clicking each card. National exports/imports contained 118 observations and KOSPI/FX contained 119. These are provider-specific monthly observations, not same-day statistics.

The production ministry response identified the actual September 2026 bulletin, its October 1 publication date and its official PDF download link. Numeric coverage remained zero because the attachment path failed. That response established an official article connection only. A subsequent isolated Korean CID-font PDF reproduced a missing local CMap defect even though the ASCII PDF fixture passed; deployment must include and verify these non-JavaScript resources before claiming Korean PDF extraction works.

Revision `95fbba1` packaged local CMaps/fonts in every actual Vercel function and passed isolated Korean decoding with all network fetches prohibited. The normal production feature then identified `ATTACHMENT_BODY_TIMEOUT`: the PDF body exceeded the shared seven-second HTML/download limit. HTML and attachments now have separate bounded defaults (7/25 seconds inside a 35-second acquisition deadline), including bounded stream cancellation. Actual numeric recovery still depends on the production PDF and parser result.

Revision `ba7df7e` successfully downloaded and decoded the production bulletin. Bounded diagnostics identified the correct month, an export section, 20 known item labels and 110 explicit currency amounts, but no literal MTI definition. The factory now passes a verified official-bulletin context only after validating the article/document identity; its figures are explicitly `OFFICIAL_ITEM`, not assumed MTI. Untrusted standalone parser calls retain the MTI requirement. National monthly scope, exact period, explicit units, ambiguity and duplicate checks remain mandatory. Recognising labels or amounts alone is not proof of numeric coverage.

The 13 HS2 reference baskets now use a separate two-month summary path. Their union contains 51 codes; one current-month and one exact prior-year request replace per-category 36-month history scans. Verified main-bundle chapter rows are reused before origin acquisition. Summary records have dedicated `category-summary:<id>` keys and revalidate every component, national dimensions, USD units and actual HS edition; they cannot enter analytical history keys. Unknown or mismatched editions allow a current amount only. Provider leases and persisted cooldowns also cover these requests. A published response, a complete basket and a matching prior-year edition are separate requirements: missing evidence is never converted to zero, a partial sum or a fabricated YoY.

A normal production read also observed a temporary memory backend during database reconnection. The catalog's existing bounded polling now continues for memory results even when the origin queue has settled, allowing saved PostgreSQL values to appear after the store's 30-second reconnect cooldown. Those settled-queue polls are cache-only and keep the 12-response limit; they do not restart full origin acquisition.

The current ministry host `www.motir.go.kr`, separate official reference host `www.korea.kr`, and the user-supplied deployment host were added to the existing cloud network draft without removing prior domains. Saving the draft does not apply it: environment-settings review/save and publication are still required. The development executor's direct MOTIR request was denied by network policy. The public Customs site returned HTTP 503 locally; no unverified HS2 parameter was introduced to hide that problem.

Future releases are checked at the stable production alias `https://k-equity-desk-v4.vercel.app/export-desk`. Generated deployment URLs remain tied to their own revision and do not automatically receive later commits.
