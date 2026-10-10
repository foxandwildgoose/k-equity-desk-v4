# Official issuer holdings button

Every ETF detail route now presents one **운용사 공식 구성내역** action beside
the holdings table. A verified destination opens in a new tab with
`rel="noopener noreferrer"`. When lookup is pending or no exact destination is
verified, the same button is disabled and accompanied by an accessible explanation.
The previous header product action and duplicate issuer source actions were removed.

`src/server/etf-issuer.ts` owns issuer metadata, official catalog discovery,
product matching, destination validation, and verified section anchors.
`officialHoldingsDestination` selects only URLs supplied by the verified issuer
adapters; it is not a mechanism for certifying arbitrary URLs. It validates
issuer hosts and product routes, rejects incompatible product identifiers, and
removes unverified fragments. `getEtfBundle` exposes its result as
`issuerHoldingsUrl`; the UI does not build issuer URLs itself.

SOL 0246X0 retains the explicitly requested product URL in the central verified
mapping, supported by its official page's exact ticker and name. It remains
available when a cold catalog lookup exceeds the deadline. HANARO uses `#etfPDF`,
verified in two actual product pages as both a holdings navigation link and a DOM
element. Additional anchors must be supported by equivalent official-page evidence.
Issuer homepages, search results, API endpoints, and guessed section anchors are
never substituted for a holdings destination.

KoAct discovery now reads the official `{ totalCnt, etfs }` catalog and its
pagination. Paginated catalog discovery stops when the requested ticker is found.
Verified entries are reused for six hours; later requests can continue a partial
catalog, retry failed pages, and share an in-flight page request without losing
earlier matches. Caller deadlines still apply.

## Live issuer checks — 2026-10-10

These checks used actual issuer responses through the environment proxy with
normal TLS verification. Catalog records paired each ticker with its official
product identifier; accessible product pages confirmed the corresponding product.

| Issuer | ETF | Verified destination | Result |
| --- | --- | --- | --- |
| SOL | 0246X0 | https://www.soletf.com/ko/fund/etf/211124 | HTTP 200; exact ticker and product name |
| KODEX | 069500 | https://www.samsungfund.com/etf/product/view.do?id=2ETF01 | HTTP 200; KODEX 200 |
| ACE | 360200 | https://www.aceetf.co.kr/fund/K55101D78195 | HTTP 200; ACE 미국S&P500 |
| PLUS | 161510 | https://www.plusetf.co.kr/product/detail?n=006273 | HTTP 200; PLUS 고배당주 |
| KoAct | 462900 | https://www.samsungactive.co.kr/etf/view.do?id=2ETFJ9 | HTTP 200; 바이오헬스케어액티브 |
| HANARO | 0123S0 | https://www.hanaroetf.com/fund/BB6BC368BE7143F3#etfPDF | HTTP 200; exact ticker and holdings anchor |
| HANARO | 0111J0 | https://www.hanaroetf.com/fund/8B788EE0BB4342A9#etfPDF | HTTP 200; exact ticker and holdings anchor |

The RISE product `/products/44L0`, KIWOOM 200 product, and IBK catalog returned
HTTP 503 during these checks. TIGER 미국S&P500's product page returned HTTP 403.
These responses limit live verification; they do not justify inventing another
link. Any product without a verified mapping retains the disabled action.
Other issuer families continue to use the existing exact-product discovery;
unrecognized or unmatched products also remain disabled. This is a representative
issuer audit, not a claim that every product URL was fetched successfully.

## Validation

- `npm run test:etf`: issuer destination, catalog pagination/cache/deadline,
  existing holdings parsing, and actual server pipeline tests.
- `npm run typecheck` and `npm run build`.
- `npm run qa:etf-issuer` against dev and built output: controlled fixtures cover
  resolved holdings, product-only fallback, unavailable links, desktop/mobile,
  light/dark themes, accessible explanation, 44 px button height, separate-tab
  navigation, and no duplicate issuer action. Fixtures are explicitly marked and
  are not evidence of issuer availability.
- Production verification uses actual application data without response
  interception. Chromium's isolated profile trusts the provided environment CA
  only for the canonical application host; TLS verification remains enabled.
  Third-party font/branding requests can remain blocked by the environment.

Interactive checks use Playwright because `agent-browser` is unavailable in this
environment. Screenshots and detailed local verification artifacts are stored
under `/workspace/screenshots/etf-holdings-button/`.

The final source passes 101 ETF tests plus the server pipeline, type checking,
and the production build. In the dev fixture matrix, one check encountered a
temporary route remount while dev assets reloaded; its isolated rerun passed.
Unmocked smoke checks rendered both viewports without page exceptions or
horizontal overflow, and built output matched the dev baseline. Their console
still records existing third-party font/branding connection failures. The feature
fixture checks separately require clean application console and page-error results.
