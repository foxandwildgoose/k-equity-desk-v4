import type { IndicatorInstance } from "../charts/catalog.ts";
import type { BollingerSignal, BollingerSystemSettings } from "./types.ts";

/** Market conventions (20/2, Wilder RSI14) and explicitly configurable application heuristics. */
export const DEFAULT_BOLLINGER_SYSTEM_CONFIG: Readonly<BollingerSystemSettings> = {
  version: 1, enabled: true, overlay: true, percentB: true, bandwidth: true,
  status: true, badges: true, score: true, alerts: false, panesExpanded: null,
  paneHeights: { percentB: 100, bandwidth: 100 },
  mode: "trading", period: 20, mult: 2, source: "close", basis: "sma",
  bbwLookback: 125, extremeThreshold: 5, squeezeThreshold: 10, compressionThreshold: 20, expansionRatio: 1.5,
  slopeLookback: 5, trendTolerance: 0.001, rvolPeriod: 20, rvolThreshold: 1.5, rsiPeriod: 14,
  failedWindow: 2, walkWindow: 5, walkCount: 3, walkThreshold: 0.8,
  pivotLeft: 3, pivotRight: 3, patternMaxBars: 60, patternTolerance: 0.03,
  middle: "auto", alertSignals: ["squeeze", "upper-breakout", "lower-breakdown", "failed-upper", "failed-lower", "upper-walk", "lower-walk", "bullish-divergence", "bearish-divergence", "w-confirmed", "m-confirmed", "expansion", "volume-confirmed"],
};

export const BOLLINGER_PRESETS = [
  { id: "standard", label: "Standard · 20 / 2.0", period: 20, mult: 2 },
  { id: "fidelity-short", label: "Fidelity 단기 · 10 / 1.5", period: 10, mult: 1.5 },
  { id: "fidelity-medium", label: "Fidelity 중기 · 20 / 2.0", period: 20, mult: 2 },
  { id: "fidelity-long", label: "Fidelity 장기 · 50 / 2.5", period: 50, mult: 2.5 },
  { id: "adjusted-short", label: "Containment · 10 / 1.9", period: 10, mult: 1.9 },
  { id: "adjusted-long", label: "Containment · 50 / 2.1", period: 50, mult: 2.1 },
] as const;

/** Starting point for an explicit override; automatic themes are resolved by the chart. */
export const BOLLINGER_CUSTOM_COLOR_DEFAULT = "#64748B";

const SIGNALS = new Set<BollingerSignal>(["squeeze", "upper-breakout", "lower-breakdown", "failed-upper", "failed-lower", "upper-walk", "lower-walk", "bullish-divergence", "bearish-divergence", "w-setup", "w-confirmed", "m-setup", "m-confirmed", "expansion", "volume-confirmed"]);
const object = (value: unknown): Record<string, unknown> => value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const BOOLEAN_KEYS = ["enabled", "overlay", "percentB", "bandwidth", "status", "badges", "score", "alerts"] as const;
const NUMBER_BOUNDS = {
  // Match the generic BB catalog so adopting an existing instance cannot
  // silently narrow the user's supported multiplier range.
  period: [2, 500, true], mult: [0.001, 100, false], bbwLookback: [10, 1000, true],
  extremeThreshold: [0, 100, false], squeezeThreshold: [0, 100, false], compressionThreshold: [0, 100, false], expansionRatio: [1.01, 10, false],
  slopeLookback: [1, 100, true], trendTolerance: [0, 0.1, false], rvolPeriod: [2, 500, true], rvolThreshold: [0.1, 10, false], rsiPeriod: [2, 200, true],
  failedWindow: [1, 10, true], walkWindow: [2, 50, true], walkCount: [1, 50, true], walkThreshold: [0.5, 1, false],
  pivotLeft: [1, 20, true], pivotRight: [1, 20, true], patternMaxBars: [5, 500, true], patternTolerance: [0, 0.25, false],
} as const;

/** Reject wrong types/non-finite values; clamp numeric ranges and dependent thresholds safely. */
export function sanitizeBollingerSettings(raw: unknown): BollingerSystemSettings {
  const value = object(raw);
  const out: BollingerSystemSettings = { ...DEFAULT_BOLLINGER_SYSTEM_CONFIG, paneHeights: { percentB: 100, bandwidth: 100 }, alertSignals: [...DEFAULT_BOLLINGER_SYSTEM_CONFIG.alertSignals] };
  for (const key of BOOLEAN_KEYS) if (typeof value[key] === "boolean") out[key] = value[key];
  for (const key of Object.keys(NUMBER_BOUNDS) as (keyof typeof NUMBER_BOUNDS)[]) {
    const n = value[key];
    if (typeof n !== "number" || !Number.isFinite(n)) continue;
    const [min, max, integral] = NUMBER_BOUNDS[key];
    out[key] = Math.min(max, Math.max(min, integral ? Math.round(n) : n));
  }
  out.squeezeThreshold = Math.max(out.extremeThreshold, out.squeezeThreshold);
  out.compressionThreshold = Math.max(out.squeezeThreshold, out.compressionThreshold);
  out.walkCount = Math.min(out.walkCount, out.walkWindow);
  out.patternMaxBars = Math.max(out.patternMaxBars, out.pivotLeft + out.pivotRight + 1);
  if (value.mode === "trading" || value.mode === "investment") out.mode = value.mode;
  if (value.source === "close" || value.source === "hlc3" || value.source === "ohlc4") out.source = value.source;
  if (value.middle === "auto" || value.middle === "on" || value.middle === "off") out.middle = value.middle;
  if (typeof value.panesExpanded === "boolean") out.panesExpanded = value.panesExpanded;
  const paneHeights = object(value.paneHeights);
  for (const key of ["percentB", "bandwidth"] as const) {
    const height = paneHeights[key];
    if (typeof height === "number" && Number.isFinite(height)) out.paneHeights![key] = Math.min(600, Math.max(34, height));
  }
  if (typeof value.adoptedIndicatorUid === "string" && value.adoptedIndicatorUid.length > 0 && value.adoptedIndicatorUid.length <= 200) out.adoptedIndicatorUid = value.adoptedIndicatorUid;
  if (typeof value.overlayColor === "string" && /^#[0-9a-fA-F]{6}$/.test(value.overlayColor)) out.overlayColor = value.overlayColor;
  if (Array.isArray(value.alertSignals)) out.alertSignals = [...new Set(value.alertSignals.filter((signal): signal is BollingerSignal => typeof signal === "string" && SIGNALS.has(signal as BollingerSignal)))];
  return out;
}

export function applyBollingerPreset(settings: BollingerSystemSettings, presetId: string): BollingerSystemSettings {
  const preset = BOLLINGER_PRESETS.find(item => item.id === presetId);
  return preset ? sanitizeBollingerSettings({ ...settings, period: preset.period, mult: preset.mult }) : settings;
}

/**
 * One BB(20,2) is adopted as a management reference, never removed. Ambiguous
 * duplicate/default-looking instances remain intact, as do all custom periods.
 * Versioned settings win on reload; legacy visibility/color are preserved.
 */
export function migrateBollingerSystem(indicators: readonly IndicatorInstance[], existing?: unknown): { indicators: IndicatorInstance[]; settings: BollingerSystemSettings } {
  const settings = sanitizeBollingerSettings(existing);
  const versioned = object(existing).version === 1;
  const adopted = indicators.find(item => item.id === "bb" && item.uid === settings.adoptedIndicatorUid)
    ?? (!versioned ? indicators.find(item => item.id === "bb" && Number(item.params.period) === 20 && Number(item.params.mult) === 2) : undefined);
  if (adopted) {
    settings.adoptedIndicatorUid = adopted.uid;
    if (!versioned) {
      settings.overlay = adopted.visible;
      if (adopted.color && /^#[0-9a-fA-F]{6}$/.test(adopted.color)) settings.overlayColor = adopted.color;
    }
  } else {
    delete settings.adoptedIndicatorUid;
  }
  return { indicators: [...indicators], settings };
}
