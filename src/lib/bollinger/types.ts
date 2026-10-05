/** Cross-market security-price Bollinger contracts. Dates are provider bar keys. */
export type Availability = "available" | "partial" | "not-configured" | "not-supported" | "not-applicable" | "error" | "unknown";
export type VolatilityRegime = "extreme-squeeze" | "squeeze" | "compression" | "normal" | "expansion";
export type TrendRegime = "strong-bullish" | "bullish" | "neutral" | "bearish" | "strong-bearish";
export type BollingerSetup = "squeeze" | "pre-breakout" | "bull-breakout" | "bear-breakdown" | "upper-band-walk" | "lower-band-walk" | "pullback" | "failed-breakout" | "mean-reversion-watch" | "mixed";
export type BollingerSignal = "squeeze" | "upper-breakout" | "lower-breakdown" | "failed-upper" | "failed-lower" | "upper-walk" | "lower-walk" | "bullish-divergence" | "bearish-divergence" | "w-setup" | "w-confirmed" | "m-setup" | "m-confirmed" | "expansion" | "volume-confirmed";
export interface BollingerSystemSettings {
  version: 1; enabled: boolean;
  overlay: boolean; percentB: boolean; bandwidth: boolean; status: boolean; badges: boolean; score: boolean; alerts: boolean;
  /** null = responsive default; explicit selection persists. */
  panesExpanded: boolean | null;
  /** Native relative pane stretch ×100; recorded separately from HTS pane heights. */
  paneHeights?: { percentB: number; bandwidth: number };
  mode: "trading" | "investment";
  period: number; mult: number; source: "close" | "hlc3" | "ohlc4"; basis: "sma";
  bbwLookback: number; extremeThreshold: number; squeezeThreshold: number; compressionThreshold: number; expansionRatio: number;
  slopeLookback: number; trendTolerance: number;
  rvolPeriod: number; rvolThreshold: number; rsiPeriod: number;
  failedWindow: number; walkWindow: number; walkCount: number; walkThreshold: number;
  pivotLeft: number; pivotRight: number; patternMaxBars: number; patternTolerance: number;
  /** Adopted generic BB remains in indicator management; no second overlay. */
  adoptedIndicatorUid?: string;
  overlayColor?: string;
  middle: "auto" | "on" | "off";
  alertSignals: BollingerSignal[];
}
export interface BollingerBar {
  date: string; open: number; high: number; low: number; close: number; volume: number;
  volumeValid?: boolean; completed?: boolean;
}
export interface BollingerEvent {
  type: BollingerSignal; index: number; date: string; direction: "bullish" | "bearish" | "neutral";
  /** Stable within market/symbol/timeframe/config identity supplied by consumer. */
  id: string; pivotIndex?: number; pivotDate?: string; stage?: 1 | 2 | 3;
}
export interface FlowConfirmation {
  availability: Availability; foreignOwnershipChange: number | null; investmentTrustNet: number | null;
  reason: string; asOf?: string; source?: string;
}
export interface ScoreComponent {
  score: number | null; max: number; reason: string; availability: Availability;
  inputs: Record<string, number | string | boolean | null>;
}
export interface SetupQuality {
  normalizedScore: number | null; earnedScore: number; availableScore: number; coverage: number;
  components: Record<"trend" | "volatility" | "momentum" | "volume" | "flow" | "riskReward", ScoreComponent>;
}
export interface BollingerPoint {
  date: string; index: number; completed: boolean;
  upper: number | null; middle: number | null; lower: number | null; percentB: number | null; bbw: number | null;
  bbwPercentile: number | null; bbwMin: number | null; bbwMax: number | null; bbwSamples: number;
  volatility: VolatilityRegime | null; trend: TrendRegime | null;
  sma20: number | null; sma60: number | null; sma120: number | null; sma200: number | null;
  rsi: number | null; rsiSlope: number | null; rvol: number | null;
  rvolMethod: "rolling" | "same-slot" | "rolling-approximate";
  breakout: "upper" | "lower" | null; failedBreakout: "upper" | "lower" | null; bandWalk: "upper" | "lower" | null;
  setup: BollingerSetup; flow: FlowConfirmation; quality: SetupQuality;
  riskReward: number | null; events: BollingerEvent[];
}
export interface BollingerAnalysis { points: BollingerPoint[]; events: BollingerEvent[]; warmupRequired: number; }
