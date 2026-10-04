import type { RecentSpan, VolumeProfile } from "../chart-indicators.ts";
import type { StorageLike } from "./persistence.ts";

export const HTS_PANEL_ORDER = ["rsi", "price", "credit", "foreign", "investmentTrust", "volume"] as const;
export type HtsPanel = (typeof HTS_PANEL_ORDER)[number];
export type HtsInstrument = "stock" | "etf" | "etn";
export type HtsProfilePreset = "hts" | "ref" | "emph" | "hide";
export interface HtsScope {
  market: "KR" | "US";
  instrument: HtsInstrument;
  code: string;
  interval: string;
  layout?: string;
}
export interface HtsProfileSettings {
  enabled: boolean;
  preset: HtsProfilePreset;
  rows: number;
  widthRatio: number;
  /** Auto follows the chart theme; custom retains the user's saved style. */
  colorMode: "auto" | "custom";
  color: string;
  opacity: number;
  showLabels: boolean;
  showVa: boolean;
  showPoc: boolean;
  basis: "volume" | "turnover";
  rangeMode: "visible" | "fixed" | "all";
  startDate: string;
  endDate: string;
  rangeOn: boolean;
  recentSpan: RecentSpan;
}
export interface HtsSettings {
  v: 1;
  enabled: boolean;
  panelHeights: Record<HtsPanel, number>;
  collapsed: Record<HtsPanel, boolean>;
  rsiPeriod: number;
  signalPeriod: number;
  signalMethod: "sma" | "ema";
  rsiZones: boolean;
  volumeMa: Record<5 | 20 | 60, boolean>;
  trustMode: "cumulative" | "daily" | "available-cumulative";
  /** Empty only until the first analysis window is loaded; then fix and persist. */
  trustStartDate: string;
  profile: HtsProfileSettings;
}

export const HTS_PANEL_LABELS: Record<HtsPanel, string> = {
  rsi: "RSI",
  price: "가격·매물대",
  credit: "신용잔고율 (%)",
  foreign: "외국인보유비율 (%)",
  investmentTrust: "투신 수량",
  volume: "거래량",
};

export function defaultHtsSettings(market: "KR" | "US", instrument: HtsInstrument = "stock"): HtsSettings {
  return {
    v: 1,
    enabled: market === "KR" || instrument === "etf" || instrument === "etn",
    panelHeights: { rsi: 100, price: 400, credit: 90, foreign: 90, investmentTrust: 110, volume: 120 },
    collapsed: { rsi: false, price: false, credit: false, foreign: false, investmentTrust: false, volume: false },
    rsiPeriod: 14,
    signalPeriod: 9,
    signalMethod: "sma",
    rsiZones: false,
    volumeMa: { 5: true, 20: true, 60: true },
    trustMode: "cumulative",
    trustStartDate: "",
    profile: {
      enabled: true,
      preset: "hts",
      rows: 10,
      widthRatio: 0.85,
      colorMode: "auto",
      color: "#E6B77C",
      opacity: 0.32,
      showLabels: true,
      showVa: false,
      showPoc: false,
      basis: "volume",
      rangeMode: "visible",
      startDate: "",
      endDate: "",
      rangeOn: false,
      recentSpan: "52W",
    },
  };
}

/** Each key component is escaped, including user-defined workspace/layout ids. */
export function htsSettingsKey(scope: HtsScope): string {
  return `ked:hts:v1:${[scope.market, scope.instrument, scope.code.trim().toUpperCase(), scope.interval, scope.layout ?? "detail"].map(encodeURIComponent).join(":")}`;
}

const record = (value: unknown): Record<string, unknown> => value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const bool = (value: unknown, fallback: boolean): boolean => typeof value === "boolean" ? value : fallback;
const bounded = (value: unknown, fallback: number, min: number, max: number, integer = false): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const clamped = Math.max(min, Math.min(max, value));
  return integer ? Math.round(clamped) : clamped;
};
const choice = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;

/** Calendar validation prevents roll-over dates such as 2026-02-31. */
export function validHtsDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
const date = (value: unknown, fallback: string): string => value === "" || validHtsDate(value) ? value : fallback;

function validateProfile(raw: unknown, defaults: HtsProfileSettings): HtsProfileSettings {
  const p = record(raw);
  const validColor = typeof p.color === "string" && /^#[0-9a-f]{6}$/i.test(p.color);
  // Older versions cannot tell a prior default from an intentional style.
  // Preserve valid saved styles instead of silently replacing them on theme changes.
  const legacyStyle = validColor || (typeof p.opacity === "number" && Number.isFinite(p.opacity));
  return {
    enabled: bool(p.enabled, defaults.enabled),
    preset: choice(p.preset, ["hts", "ref", "emph", "hide"], defaults.preset),
    rows: bounded(p.rows, defaults.rows, 1, 200, true),
    widthRatio: bounded(p.widthRatio, defaults.widthRatio, 0.1, 0.9),
    colorMode: choice(p.colorMode, ["auto", "custom"], legacyStyle ? "custom" : defaults.colorMode),
    color: validColor ? p.color as string : defaults.color,
    opacity: bounded(p.opacity, defaults.opacity, 0.05, 0.6),
    showLabels: bool(p.showLabels, defaults.showLabels),
    showVa: bool(p.showVa, defaults.showVa),
    showPoc: bool(p.showPoc, defaults.showPoc),
    basis: choice(p.basis, ["volume", "turnover"], defaults.basis),
    rangeMode: choice(p.rangeMode, ["visible", "fixed", "all"], defaults.rangeMode),
    startDate: date(p.startDate, defaults.startDate),
    endDate: date(p.endDate, defaults.endDate),
    rangeOn: bool(p.rangeOn, defaults.rangeOn),
    recentSpan: choice(p.recentSpan, ["3M", "6M", "52W", "all", "swing"], defaults.recentSpan),
  };
}

/** Tolerant of invalid fields, strict about schema version and value types. */
export function parseHtsSettings(raw: string | null, defaults = defaultHtsSettings("KR")): HtsSettings | null {
  if (!raw) return null;
  try {
    const data = record(JSON.parse(raw));
    if (data.v !== 1) return null;
    const heights = record(data.panelHeights);
    const collapsed = record(data.collapsed);
    const volumeMa = record(data.volumeMa);
    return {
      v: 1,
      enabled: bool(data.enabled, defaults.enabled),
      panelHeights: Object.fromEntries(HTS_PANEL_ORDER.map((id) => [id, bounded(heights[id], defaults.panelHeights[id], id === "price" ? 180 : 48, 1200, true)])) as Record<HtsPanel, number>,
      collapsed: Object.fromEntries(HTS_PANEL_ORDER.map((id) => [id, bool(collapsed[id], defaults.collapsed[id])])) as Record<HtsPanel, boolean>,
      rsiPeriod: bounded(data.rsiPeriod, defaults.rsiPeriod, 2, 200, true),
      signalPeriod: bounded(data.signalPeriod, defaults.signalPeriod, 1, 200, true),
      signalMethod: choice(data.signalMethod, ["sma", "ema"], defaults.signalMethod),
      rsiZones: bool(data.rsiZones, defaults.rsiZones),
      volumeMa: { 5: bool(volumeMa[5], defaults.volumeMa[5]), 20: bool(volumeMa[20], defaults.volumeMa[20]), 60: bool(volumeMa[60], defaults.volumeMa[60]) },
      trustMode: choice(data.trustMode, ["cumulative", "daily", "available-cumulative"], defaults.trustMode),
      trustStartDate: date(data.trustStartDate, defaults.trustStartDate),
      profile: validateProfile(data.profile, defaults.profile),
    };
  } catch {
    return null;
  }
}

export const LEGACY_VP_KEY = "ked:vp:v1";

/** Preserve every explicit legacy setting, including hidden/compact settings.
 * Old mobile auto-hide was saved indistinguishably from user choice. Do not
 * guess intent; the restore action lets users select the new defaults safely.
 */
export function migrateLegacyHtsSettings(raw: string | null, defaults: HtsSettings): HtsSettings | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const old = record(parsed);
    const widths = { thin: 0.1, mid: 0.14, wide: 0.18 };
    const width = choice(old.width, ["thin", "mid", "wide"], "thin");
    const converted: Record<string, unknown> = { ...old };
    if (typeof old.width === "string" && Object.hasOwn(widths, old.width)) converted.widthRatio = widths[width];
    if (typeof old.visibleOnly === "boolean") converted.rangeMode = old.visibleOnly ? "visible" : "all";
    if (old.preset === "hide" && typeof old.enabled !== "boolean") converted.enabled = false;
    return { ...defaults, profile: validateProfile(converted, defaults.profile) };
  } catch {
    return null;
  }
}

export function hasSavedHtsSettings(store: Pick<StorageLike, "getItem">, scope: HtsScope): boolean {
  try {
    return parseHtsSettings(store.getItem(htsSettingsKey(scope)), defaultHtsSettings(scope.market, scope.instrument)) !== null;
  } catch {
    return false;
  }
}

export function loadHtsSettings(store: Pick<StorageLike, "getItem" | "setItem">, scope: HtsScope): HtsSettings {
  const defaults = defaultHtsSettings(scope.market, scope.instrument);
  try {
    const current = parseHtsSettings(store.getItem(htsSettingsKey(scope)), defaults);
    if (current) return current;
    const migrated = migrateLegacyHtsSettings(store.getItem(LEGACY_VP_KEY), defaults);
    if (migrated) {
      saveHtsSettings(store, scope, migrated);
      return migrated;
    }
  } catch {
    // Private browsing or denied storage still supports the full chart.
  }
  return defaults;
}

export function saveHtsSettings(store: Pick<StorageLike, "setItem">, scope: HtsScope, settings: HtsSettings): void {
  try {
    const validated = parseHtsSettings(JSON.stringify(settings), defaultHtsSettings(scope.market, scope.instrument));
    if (validated) store.setItem(htsSettingsKey(scope), JSON.stringify(validated));
  } catch {
    // Storage full/blocked must not break chart interactions.
  }
}

export function applyHtsProfilePreset(preset: HtsProfilePreset, previous: HtsProfileSettings): HtsProfileSettings {
  if (preset === "hide") return { ...previous, preset, enabled: false };
  if (preset === "ref") return { ...previous, preset, enabled: true, widthRatio: 0.1, opacity: 0.22, colorMode: "custom" };
  if (preset === "emph") return { ...previous, preset, enabled: true, widthRatio: 0.18, opacity: 0.32, colorMode: "custom" };
  return { ...previous, preset, enabled: true, rows: 10, widthRatio: 0.85, colorMode: "auto", color: "#E6B77C", opacity: 0.32, showLabels: true, showVa: false, showPoc: false, rangeOn: false, rangeMode: "visible", basis: "volume" };
}

/** Only profile readability changes: pane layout, RSI and trust origins survive. */
export function applyChartReadabilityPreset(settings: HtsSettings): HtsSettings {
  return { ...settings, profile: applyHtsProfilePreset("hts", settings.profile) };
}

export interface ProfileMetadata {
  market: "KR" | "US";
  instrument: HtsInstrument;
  code: string;
  name?: string;
  quantityUnit: string;
  currency: string;
  source: string;
  asOf: string | null;
  fetchedAt?: string | null;
  sourceResolution: string;
  rangeMode: HtsProfileSettings["rangeMode"];
  actualFrom: string | null;
  actualTo: string | null;
  requestedFrom?: string | null;
  requestedTo?: string | null;
  adjustment: string;
  adjustmentWarning?: string;
  estimated?: boolean;
}

export const PROFILE_METHOD_LABEL = "OHLCV 추정 · 봉 고저 범위와 가격 구간의 겹침 길이로 거래량 배분";

/** CSV uses full-precision values; rounding is a display concern only. */
export function profileToCsv(profile: VolumeProfile, metadata: ProfileMetadata): string {
  const headers = ["market", "instrument", "code", "name", "price_low", "price_high", "quantity_or_turnover", "percent", "basis", "value_unit", "total_quantity", "total_value", "quantity_unit", "currency", "method", "estimated", "range_mode", "requested_from", "requested_to", "actual_from", "actual_to", "source_resolution", "source", "as_of", "fetched_at", "price_volume_adjustment", "adjustment_warning", "valid_bars", "excluded_bars", "poc", "val", "vah"];
  // Protect spreadsheet consumers without changing numeric values or signed quantities.
  const escape = (value: string | number | boolean | null | undefined): string => {
    const raw = value == null ? "" : String(value);
    const safe = typeof value === "string" && /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = profile.rows.length ? profile.rows : [null];
  return [headers, ...rows.map((row) => [
    metadata.market, metadata.instrument, metadata.code, metadata.name, row?.low, row?.high, row?.volume, row?.percent,
    profile.basis, profile.basis === "volume" ? metadata.quantityUnit : metadata.currency, profile.totalVolume, profile.totalValue,
    metadata.quantityUnit, metadata.currency, profile.method, metadata.estimated ?? true, metadata.rangeMode,
    metadata.requestedFrom, metadata.requestedTo, metadata.actualFrom, metadata.actualTo,
    metadata.sourceResolution, metadata.source, metadata.asOf, metadata.fetchedAt, metadata.adjustment, metadata.adjustmentWarning,
    profile.validBars, profile.excludedBars, profile.poc, profile.val, profile.vah,
  ])].map((row) => row.map(escape).join(",")).join("\r\n");
}
