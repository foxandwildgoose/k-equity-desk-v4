# Official monthly industry-ministry bulletin

The adapter in src/server/export-motie.ts resolves real articles from the official board. It never constructs a guessed article ID, treats a reachable homepage as a verified data connection, or relabels Customs HS observations as ministry MTI data.

## Corroborated discovery contract

- [Published client at immutable revision](https://github.com/cystine13/koreastatlinker/blob/638b8e4520f39184ee67f77389963098bff97c92/github_html_onclick_20250219.py): the board is /kor/article/ATCL3f49a5a8c, list rows use article.view(id), and details are /kor/article/ATCL3f49a5a8c/{id}/view.
- [Independent monthly-trade client at immutable revision](https://github.com/kyungsooNa/Investment/blob/df01914e39cd86450ff36be487bdd2ac0948959a/services/trade_trend_service.py): the current origin is https://www.motir.go.kr; legacy www.motie.go.kr is also recognised. Its national-release client filters exact YYYY년 M월 수출입 동향 titles and discovers PDF download links from the real detail page.

Only those official HTTPS origins are accepted, including redirects and attachment URLs. Articles about 1–10/20-day figures, future/incomplete months, missing IDs and external-host links are rejected. Actual known publication dates must follow the completed reference month and cannot lie in the future in Korea.

## Numeric interpretation

An official article link can be verified while numeric extraction remains partial. HTML amounts need a scoped article body, explicit MTI definition, export scope, unit, exact current-month column and exact known item label. Unknown units, import/cumulative/forecast scopes, conflicting duplicate figures and ambiguous columns are excluded.

PDF extraction uses the pinned pdfjs-dist dependency and an explicitly imported trusted worker. It reads text only, with evaluation disabled, no rendering, no URL input/external resource configuration, and bounded bytes/pages/text/deadline. The PDF must name the same monthly bulletin. Inline figures require the same current-month context, an MTI definition, a major-item export section and an unambiguous explicit USD scale. Prior-year/month, cumulative, imports and forecast amounts remain unavailable. Generic “20-item 2026 revision” seed configuration is not evidence of an official classification revision.

The source link, source statistical month, publication date when present, provisional marker and original provider verification time stay separate. A failed or unverified refresh retains the older verified snapshot with a stale state; it does not renew its verification time or fabricate missing item amounts.

## Evidence limits

On October 22, 2026, direct local requests to the old official MOTIE root and corroborated board returned HTTP 503 connection timeouts. The current official MOTIR origin and the separate Korea Policy Briefing RSS origin were denied at CONNECT by this cloud environment's runtime network policy. No attempt bypassed the proxy or TLS validation. These are local reachability observations, not proof of production availability or nonavailability.

Parser fixtures and the generated-PDF extractor test validate code behaviour only. They are not live ministry figures. Production acceptance requires the normal deployed getMotieRelease feature to return the actual official article and validated observations. Until that happens, the UI must show the actual partial/unavailable status and must not claim that all ministry items have been connected.
