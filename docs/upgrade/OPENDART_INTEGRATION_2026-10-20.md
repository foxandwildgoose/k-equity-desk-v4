# OpenDART disclosure integration

`OPENDART_API_KEY` is a server-only Vercel environment variable. Registering it
does not activate an integration unless the application calls OpenDART; the
previous application only scraped public DART HTML. Redeploy after adding or
changing the Production variable. Never add a `VITE_` prefix, commit the value,
or enter it in browser settings.

The disclosure desk, individual stock disclosures, scan disclosures and
aggregated disclosure feed now prefer `https://opendart.fss.or.kr/api/list.json`.
Company lookups search official DART using the exact six-character exchange
ticker, then verify both `stock_code` and `corp_code` through OpenDART
`api/company.json` before accepting a candidate. The full `api/corpCode.xml`
archive remains a fallback. It does not guess by company name or substitute a
common share code for a preferred share. This avoids blocking normal company
pages on a large archive download that exceeded 30 seconds in Production.

- Market lookup: latest page (up to 100 records per market) for KOSPI and KOSDAQ
  within seven calendar days. This is a recent-disclosures view, not a complete
  historical archive.
- Company lookup: latest page, up to 100 records within 120 calendar days.
- Published `rcept_dt` stays date-only. Receipt number orders records within a
  day, including after conversion into the combined feed. Original-document
  links use validated receipt numbers on `dart.fss.or.kr`.
- Normal API status `013` means authenticated, empty results. It does not
  trigger a name search or replacement with older filings.
- Configuration, authentication/access, quota, company identity and network
  failures are distinguished. Safe public status and actual check time appear
  on the desk and stock page; credentials and raw upstream errors never do.
- If the API is unavailable, public DART HTML may supply an explicitly labeled
  fallback. Company fallback rows must independently match the known company
  name and ticker. Unmapped official company identities never use name guessing.
  Ambiguous historical ticker mappings are quarantined individually so they
  cannot invalidate unrelated companies. Fixed diagnostic codes distinguish
  archive, XML, network and response-validation failures without exposing keys.
- Requests have response-size limits. Code discovery allows 5 seconds and API
  JSON requests allow 12 seconds; the first
  full corporate-archive download has a separate 30-second budget. The archive
  and JSON results use bounded in-memory caches and concurrent-request deduplication;
  secret rotation invalidates old state. No database or filesystem writes are
  required in Vercel. Caches are per server instance, not a global quota store.
- Combined-feed polling bounds optional source waits to five seconds so slow
  KIND or Naver responses cannot discard an already available official result.

Financial valuation calculations continue using their separately documented
CompanyGuide/Yahoo/SEC sources. This change connects official disclosures; it
does not reinterpret the key as a stock-price or ETF-holdings API.

Validation:

```sh
npm run test:opendart
node --experimental-strip-types --test src/lib/feed/feed-kernel.test.ts
npm run typecheck
npm run build
npm run check:deploy
```

Automated fixtures exercise official mapping, API failures, malformed payloads,
cache rotation, receipt precision/order and the complete disclosure pipeline.
They use explicit fixture keys and intercept all external calls. A local server
without the key should show the unconfigured state. After deployment, verify
the real production desk and representative company results show authenticated
OpenDART status and official original-document links; never retrieve the
Production secret to run that verification.
