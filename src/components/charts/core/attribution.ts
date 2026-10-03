/**
 * Lightweight Charts attribution (F7.3 / D4).
 *
 * Apache-2.0 requires the NOTICE attribution plus a link to
 * https://www.tradingview.com/ on a page users can see. The chart option
 * `attributionLogo: false` is allowed ONLY because the app renders
 * `CHART_ATTRIBUTION_LABEL` → `CHART_ATTRIBUTION_URL` in the global footer
 * (AppShell) and in every chart status line. Covered by
 * scripts/project-invariants.test.mjs.
 */

/** Verbatim NOTICE of tradingview/lightweight-charts v5.2.1. */
export const LIGHTWEIGHT_CHARTS_NOTICE =
  "TradingView Lightweight Charts™\nCopyright (с) 2025 TradingView, Inc. https://www.tradingview.com/";

export const CHART_ATTRIBUTION_URL = "https://www.tradingview.com/";
export const CHART_ATTRIBUTION_LABEL = "Charts: TradingView Lightweight Charts™";
