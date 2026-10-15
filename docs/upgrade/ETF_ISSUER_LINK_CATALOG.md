# ETF issuer product destinations

The holdings button resolves a centrally verified issuer product URL before any
runtime HTTP lookup. An issuer returning 403, a catalog timeout, or an empty
holdings table does not invalidate a product identity already verified in the
registry. This fixes TIGER 2차전지테마 (305540), whose confirmed destination is:

`https://investments.miraeasset.com/tigeretf/ko/product/search/detail/index.do?ksdFund=KR7305540007`

The old resolver required the issuer product HTML to load and contain a matching
name/code. TIGER returned 403 and a generic redirect message, causing the valid
product URL to become unavailable. That transport outcome is separate from
whether the product URL identifies the correct ETF.

`src/data/etf-issuer-products.ts` stores exact ticker, issuer family, product name,
URL, verification date and provenance. The official catalogs supply 641 records.
TIGER supplies 233 additional records through its confirmed official URL template:
the user confirmed the route, its parameter is the standardized KRX ETF ISIN, and
the current published ETF listing binds each included ticker to TIGER. The ISIN
checksum matches all 113 independently fetched ACE issuer ISIN records. These
233 entries have a separate `verified-issuer-template` provenance kind and the
market-listing hash; they do not claim individual product HTML verification.
Unknown tickers and mismatched issuer families receive no template mapping.

KIWOOM has 68 additional `corroborated-issuer-template` records. Two independent,
commit-pinned public implementations document and use its official product
route's `gcode` parameter as the listed ETF code. Each record retains both source
hashes and the published-listing hash. This verifies route semantics separately
from individual issuer HTML availability; no opaque product identifier is guessed.

The 2026-10-15 snapshot covers 942 of 1,176 listed ETFs:

| Brand | Verified destinations / listed ETFs |
| --- | ---: |
| KODEX | 243 / 243 |
| TIGER | 233 / 233 |
| ACE | 113 / 113 |
| PLUS | 86 / 86 |
| SOL | 78 / 78 |
| KIWOOM | 68 / 68 |
| HANARO | 51 / 51 |
| KoAct | 25 / 25 |
| TIME | 18 / 18 |
| WON | 17 / 17 |
| IBK | 8 / 8 |
| TRUSTON | 2 / 2 |
| Other brands | 0 / 234 |

The unresolved set is recorded by ticker and brand in the proof archive manifest.
RISE requests currently fail with upstream connection timeouts; KIWOOM requests
fail upstream TLS verification. Several smaller issuer hosts and Google search
return explicit destination-policy denials. The registry does not substitute
issuer homepages, search pages, or fabricated opaque product identifiers.

| Unresolved brand | ETF count | Current evidence gap |
| --- | ---: | --- |
| RISE | 144 | Issuer API connection timeout; product identifiers are opaque. |
| 1Q | 27 | Official redirect points to hanaam.com; destination policy denies access. |
| 에셋플러스 | 9 | Exact issuer product mappings not yet verified. |
| BNK | 7 | Official host access denied by destination policy. |
| 마이티 | 7 | Official host access denied by destination policy. |
| MIDAS | 6 | Exact issuer product mappings not yet verified. |
| HK | 6 | Official host access denied by destination policy. |
| 파워 | 6 | Exact issuer product mappings not yet verified. |
| FOCUS | 6 | Official host access denied by destination policy. |
| UNICORN | 5 | Exact issuer product mappings not yet verified. |
| DAISHIN | 4 | Exact issuer product mappings not yet verified. |
| DS | 2 | Exact issuer product mappings not yet verified. |
| TREX | 2 | Official host access denied by destination policy. |
| 아이엠에셋 | 1 | Exact issuer product mapping not yet verified. |
| KCGI | 1 | Exact issuer product mapping not yet verified. |
| 더제이 | 1 | Exact issuer product mapping not yet verified. |

The full 234-ticker gap list is also available separately in
`artifacts/etf-issuer-link-coverage-20261015.json`.

Issuer identity now recognizes all 28 current listing brands, including the
eight additional source-backed issuer domains. DS is recognized as an issuer
without assigning an unverified domain. The verified 1Q redirect adds
`www.hanaam.com`, and DB's corroborated `www.db-asset.co.kr` domain is supported
alongside the previous hostname. Domain research and its public source hashes
are preserved in `artifacts/etf-issuer-domain-provenance-20261015.json`. These
root-domain associations enable subsequent official catalog discovery; they
never substitute a homepage for an ETF product destination.

The public PLUS overview HTML supplies all 86 exact product names and product
IDs even when its separate search API returns an empty list. WON uses an
`/investment/etf-view/{id}` route and TRUSTON uses `?ta_fund=...`; both are now
accepted as official product formats. TIME's primary title verifies the ticker
and the TIMEFOLIO-to-TIME rename. Verified holdings anchors are `#etfPDF` for
HANARO, `#constituentItems` for TIME, and `#asset` for WON. SOL retains the exact
bare product URL requested by the user.

Refresh with:

```sh
node --experimental-strip-types scripts/sync-etf-issuer-links.mjs
```

The collector uses the inherited proxy and normal TLS verification. It retains
source bodies and an all-universe coverage report. `--reuse` replays acquired
artifacts and preserves the acquisition date. The committed proof archive
`artifacts/etf-issuer-links-20261015.tar.gz` includes source bodies keyed by SHA-256
and a manifest of the 942 records and full coverage report.
