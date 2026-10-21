# Export × KOSPI data integration

The desk uses observed monthly data. It is not a real-time shipment feed. A retrieval timestamp is never a substitute for the observation month or a provider publication timestamp.

## Korea Customs activation

Apply for each required service on data.go.kr. An OpenDART key does not authorize Customs services, and a common data.go.kr key still needs the service-specific utilization approvals.

| Service | Application | Case-sensitive operation |
| --- | --- | --- |
| 수출입총괄 | https://www.data.go.kr/data/15102108/openapi.do | `https://apis.data.go.kr/1220000/Newtrade/getNewtradeList` |
| 품목별 수출입실적 | https://www.data.go.kr/data/15101609/openapi.do | `https://apis.data.go.kr/1220000/Itemtrade/getItemtradeList` |
| 국가별 수출입실적 | https://www.data.go.kr/data/15101612/openapi.do | `https://apis.data.go.kr/1220000/nationtrade/getNationtradeList` |

In Vercel, select **k-equity-desk-v4 → Settings → Environment Variables** (or Production → Environment Variables in the Environments interface). Add `CUSTOMS_API_KEY`, select Production, save, and redeploy. The adapter accepts either Encoding or Decoding form and encodes the key once. Existing server aliases `KCS_API_KEY` and `DATA_GO_KR_SERVICE_KEY` are accepted. Do not expose the key with a `VITE_` prefix or enter it into browser storage, repository files, screenshots, or chat. Existing `OPENDART_API_KEY` remains separate and unchanged.

After deployment, open `/export-desk` → 데이터 품질 / 출처 or 소스. Check each Customs service independently. A registered key is not described as a verified connection until a successful, validated request returns. Authentication/permission errors, limits, empty publications, partial histories, and connection failures are distinct states. An optional IP restriction must match the deployment's egress configuration.

The adapter checks XML structure, result codes, page count/size/identity, duplicates, calendar periods, HS identity, country identity and USD values. Summary rows are excluded. Requests cover completed Korean calendar months in blocks of at most one calendar year. Monetary fields `expDlr`/`impDlr` are raw USD; they are not multiplied by 1,000. HS baskets require every constituent code in a month. Country shares require reconciliation against the same month's published world total. If a service returns descendant HS records instead of the requested national aggregate, the adapter refuses to silently sum an incomplete set.

The operation paths and legacy XML fields were corroborated against independent published clients (permalinks in `src/server/customs-trade.ts`). Authenticated production responses still require the user's approved key; fixture tests alone do not certify those responses. Large HS baskets can be explicitly partial within the request budget. No key means no Customs network requests.

## Key-free sources and failover

- FRED/OECD: exact series identity, monthly frequency, known USD scale and seasonal-adjustment metadata must be verified alongside the CSV. Unknown units are rejected. Export/import series are `XTEXVA01KRM667S` and `XTIMVA01KRM667S`. Verified cached data has an explicit stale state after a refresh failure.
- UN Comtrade: the official public monthly HS preview is queried with Korea reporter 410, explicit commodity codes, exports/imports, World partner 0, partner2 0, all transport modes 0 and customs C00. Exact response dimensions and duplicate records are validated. Truncated previews are rejected. Latest HS tables/destinations receive priority before historical backfill. Rate limits and missing months stay visible; an empty month is retried after cache expiry rather than permanently excluded. Selection loads only that category's history.
- KOSPI: Naver monthly bars, with Yahoo fallback only when necessary. Historical KRW/USD uses actual monthly FX observations; today's spot quote never fills historical gaps. Only completed Korean calendar months enter monthly analysis. Provider date labels are preserved.
- Individual company charts: actual Naver monthly security prices. Unverified exposure seeds can identify research candidates but cannot enter a verified weighted composite. A composite needs evidence-backed weights, a common base and fixed coverage.
- Headlines use an independent RSS query and cannot hold up trade statistics or provide numeric chart observations.

Customs totals have priority. Each selected total history is one coherent provider dataset. Customs, seasonally adjusted FRED and UN values are not stitched by month. Imported national data overrides an entire category dataset, not individual months from different files, geographies or vintages. The newest imported file/classification/vintage wins visibly. User imports are browser-local.

## Analysis integrity

Calendar gaps remain missing, not zero or a compressed sequence. A 12-month sum requires 12 complete calendar observations; YoY requires both observed periods. Historical KRW trailing sums convert each monthly USD observation with that month's FX first. Correlations require at least 24 complete paired observations, including each tested lag/window. Partial correlations use the same complete-case mask for all variables. Pearson HAC standard errors use the correlation influence function and preserve calendar positions. A common finite base is required for indexed comparisons.

Release-date alignment is not an as-of backtest. Historical publication/revision vintages, point-in-time index membership, verified company export exposures, and an official regional trade cube are not inferred. Unsupported regional classifications are unavailable rather than simulated. HS proxies are explicitly distinct from MOTIE MTI definitions; overlapping baskets must not be added together as national exports.

## Validation

Run `npm run test:export`, `npm test`, `npm run typecheck`, and `npm run build`. Export fixtures include provider identity, units, missing/zero values, pagination, timing, key redaction, incomplete HS baskets, conflicting revisions, statistical invariance, persistence migration and pipeline selection. They never use real credentials. Run desktop/mobile browser checks on dev, built output and production; blocked upstreams in the cloud environment are not evidence that the same sources are reachable from Vercel.
