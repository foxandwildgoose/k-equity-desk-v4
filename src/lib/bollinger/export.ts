import type { BollingerPoint, BollingerSystemSettings } from "./types.ts";
const cell = (value: unknown) => {
  const text = String(value ?? "");
  const safe = typeof value === "string" && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};
/** A separate typed CSV section preserves textual regimes and explicit nulls. */
export function bollingerToCsv(points: readonly BollingerPoint[], settings: BollingerSystemSettings, source: string): string {
  const columns = ["date", "completed", "BB_upper", "BB_middle", "BB_lower", "percentB", "BBW_percent", "BBW_percentile", "BBW_valid_samples",
    "trend", "volatility", "breakout", "failed_breakout", "band_walk", "RVOL", "RVOL_method", "RSI", "setup", "setup_quality", "coverage",
    "foreign_ownership_change_pp", "investment_trust_net_quantity", "flow_availability", "source", "BB_period", "BB_multiplier", "BB_source", "system_enabled"];
  return [columns.map(cell).join(","), ...points.map(p => [p.date, p.completed, p.upper, p.middle, p.lower, p.percentB, p.bbw, p.bbwPercentile, p.bbwSamples,
    p.trend, p.volatility, p.breakout, p.failedBreakout, p.bandWalk, p.rvol, p.rvolMethod, p.rsi, p.setup, p.quality.normalizedScore, p.quality.coverage,
    p.flow.foreignOwnershipChange, p.flow.investmentTrustNet, p.flow.availability, source, settings.period, settings.mult, settings.source, settings.enabled].map(cell).join(","))].join("\r\n");
}
