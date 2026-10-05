# Current-main audit — 2026-10-05

Baseline: `2266d0f` (remote main at checkout). Existing chart implementation is preserved.

| Classification | Evidence | Action |
| --- | --- | --- |
| CONFIRMED CODE BLOCKER | `chart-flow.ts` and diagnostics persist/read with verified user ID; CLI uses owner ID. Collector reads call `assertKiwoomOwner` even with auth off. | Separate server market-data scope and read authorization. |
| CONFIRMED CODE BLOCKER | No collection-target table/poller; arbitrary chart requests cannot request backfill. | Add a bounded, deduplicated persistent queue and sequential collector. |
| CONFIRMED CODE BLOCKER | CLI bypasses app-env wrapper; default mode is direct; build executes migration; summaries require an exact last-price date. | Unify configuration, default collector, explicit migration, dated summary fallback. |
| CONFIRMED CODE BLOCKER | Metadata failure disables flow via `Boolean(props.instrument)` with no terminal unknown state; one IP echo service. | Retain validated route product identity, explicit unknown/retry, independent IP checks. |
| CONFIRMED RUNTIME BLOCKER | Recorded runtime artifact has enabled/keys/DB/owner false; production artifact has no deployment/DB rows/API requests. Workspace app-env disables auth. | Report historical evidence separately; run safe doctor against this session. |
| EXTERNAL CONFIGURATION REQUIRED | Real keys, registered egress (operator currently specifies `<REGISTERED_KIWOOM_IPV4>`), same persistent PostgreSQL, deployed URL/revision. No secrets supplied in this request. | Prepare secure Windows command and ordered real gates; do not infer access. |
| UNVERIFIED | Current deployment, real OAuth/API rows, operational DB, stored-provider values in existing panes. | All remain NOT_TESTED/NOT_VERIFIED until actual evidence exists. |
| ALREADY FIXED / DO NOT REWRITE | ka10013/remn_rt, ka10008/wght, ka10059/invtrt and quantity body; negative quantities, percentage points, date extents, continuation/repeated-cursor protection. | Keep contracts and parsers; ka10015 remains diagnostic-only. |

Previous fixture/PGlite/browser artifacts are CODE evidence only. No real-data success is established by them.
