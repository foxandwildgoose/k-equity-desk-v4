# Retained Bollinger verification evidence — 2026-10-05

These are actual execution artifacts. Financial/chart screenshots named `synthetic-*` use isolated browser fixtures against the compiled production app; their prices and flows are **not real market observations**. No fixture was added as an application fallback.

| Artifact | Meaning |
|---|---|
| `bb-typecheck-final.log`, `bb-lint-final.log`, `bb-auth-final.log`, `bb-build-final.log` | TypeScript, lint, auth invariant and production build output |
| `bb-target-final.log`, `bb-all-tests-final.log` | 55 targeted and 660 full-suite test results |
| [changed-files.txt](./changed-files.txt) | Exact source/document manifest; purposes in the parent verification document |
| [initial-matrix.json](./initial-matrix.json) | Earlier 40/48 run with real native-rendering/persistence defects; retained failures |
| [final-matrix.json](./final-matrix.json) | Original 47/48 records plus one synchronized successful retest; all 48 distinct scenarios verified |
| [legacy.json](./legacy.json), [screener.json](./screener.json) | 2 legacy and 6 screener cases |
| [sma.json](./sma.json), [hts.json](./hts.json) | Existing chart regressions; final source-build provenance in the parent document |
| [export-before-range-fix.json](./export-before-range-fix.json), [export-before-canonical-window.json](./export-before-canonical-window.json) | Preserved failed OFF-export/window pilots; exact assertions were kept |
| [final-export.json](./final-export.json), [final-etf-mobile.json](./final-etf-mobile.json), [final-workspace.json](./final-workspace.json) | Final-source 4+1+1 strict passing cases, including actual OFF exports and fullscreen |
| [run-provenance.json](./run-provenance.json) | Final compiled server hash, base commit and explicit live/deployment limits |
| [real-attempts.json](./real-attempts.json), [real-005930-90s.json](./real-005930-90s.json), [real-005930-decoded.json](./real-005930-decoded.json) | Unmocked attempts; no real price/broker pipeline success is claimed |
| [smoke-dev.json](./smoke-dev.json), [smoke-production.json](./smoke-production.json) | Final visible dashboards, differing dynamic index-header baseline and external certificate errors; earlier matching records also retained |

Representative synthetic captures: [Light stock](./synthetic-stock-light.png), [Dark stock](./synthetic-stock-dark.png), [Dark mobile](./synthetic-stock-dark-mobile.png), [Dark workspace](./synthetic-workspace-dark.png), [ETF mobile retest](./synthetic-etf-dark-mobile.png). Unmocked dashboard captures: [desktop](./real-dashboard-production.png), [mobile](./real-dashboard-production-mobile.png).

Actual synthetic ON/OFF downloads from the final build: [PNG ON](./synthetic-export-on.png), [PNG OFF](./synthetic-export-off.png), [CSV ON](./synthetic-export-on.csv), [CSV OFF](./synthetic-export-off.csv). The CSV raw Bollinger rows remain identical; only `system_enabled` metadata changes. None of their prices or flows should be treated as investment data.

JSON screenshot/download paths refer to the original execution workspace. Representative files are copied here for repository review; the full original outputs remain under `/workspace/screenshots/bollinger-production/`. Absolute paths are evidence locations, not hosted preview URLs.

Repository JSON copies are compacted losslessly. Text log/CSV review copies normalize line endings and trailing whitespace; original runtime files remain unchanged. Financial cell values, failure records and all test counts are preserved.

The original matrix failure is not removed or reclassified: its follow-up is recorded separately. The isolated modal synchronization fix changed a 150-ms helper sleep to waiting for the existing 200-ms exit transition to finish, under the same timeout and financial assertions. Later export/range checks are separately retained and described in the parent verification record.
