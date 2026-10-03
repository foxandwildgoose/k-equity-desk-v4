/**
 * Persisted store schema v2 + migration from the unversioned v1 snapshot
 * (F10.2). Pure module — imported by `store.ts` and unit-tested under
 * `node --experimental-strip-types`.
 */
import { US_STREET_SYMBOLS } from "./us-street.ts";

export const STORE_VERSION = 2;

export type ImportanceTierPref = "flash" | "high" | "normal";
export type DisplayTz = "KST" | "ET";

export interface PriceAlert {
  id: string;
  market: "KR" | "US";
  code: string;
  name?: string;
  kind: "price-cross" | "rsi-cross" | "ma-cross";
  /** price-cross: level; rsi-cross: 70 or 30. */
  level?: number;
  /** ma-cross: fast/slow periods. */
  fast?: number;
  slow?: number;
  direction: "up" | "down" | "any";
  repeat: "once" | "every";
  active: boolean;
  createdAt: string;
  lastFiredAt?: string;
  /** Last evaluated side, used to detect crossings between refreshes. */
  lastSide?: "above" | "below";
}

export interface AlertSettings {
  inAppEnabled: boolean;
  inAppMinTier: ImportanceTierPref;
  /** OS notifications stay off until the user clicks "데스크톱 알림 켜기". */
  osEnabled: boolean;
  osMinTier: ImportanceTierPref;
  osWatchMatches: boolean;
  quietHours: { enabled: boolean; start: string; end: string };
  regions: { KR: boolean; US: boolean };
  categories: Record<"news" | "disclosure" | "research" | "policy" | "filing" | "rating" | "etf" | "robotics", boolean>;
  sound: boolean;
  tickerTape: boolean;
  paused: boolean;
  priceAlerts: PriceAlert[];
}

export interface NewsPrefs {
  tz: DisplayTz;
  /** Registry ids the user switched off (applies everywhere, client-side). */
  disabledSources: string[];
  bloombergEnabled: boolean;
  minImportance: number;
  watchOnly: boolean;
}

export interface ChartPrefs {
  chartType: "candles" | "hollow" | "bars" | "heikin-ashi" | "line" | "area" | "baseline";
  scale: "normal" | "log" | "percent" | "indexed";
  syncInterval: boolean;
  templates: Record<string, { indicators: unknown[]; chartType?: string; scale?: string; savedAt: string }>;
}

export interface RoboticsCustomEntry {
  market: "KR" | "US";
  code: string;
  name: string;
  segment?: string;
  exposure?: "pure-play" | "significant" | "indirect";
}

export interface RoboticsCustom {
  added: RoboticsCustomEntry[];
  /** `KR:277810` / `US:ISRG` keys hidden by the user. */
  removed: string[];
}

export interface PersistedV2 {
  watchlist: string[];
  theme: "dark" | "light";
  colorConvention: "korea" | "global";
  focusMode: boolean;
  preferredSectors: string[];
  usWatchlist: string[];
  keywordWatch: string[];
  alertSettings: AlertSettings;
  newsPrefs: NewsPrefs;
  chartPrefs: ChartPrefs;
  roboticsCustom: RoboticsCustom;
}

export const DEFAULT_WATCHLIST = ["005930", "000660", "373220", "207940", "277810", "012450"];

export function defaultAlertSettings(): AlertSettings {
  return {
    inAppEnabled: true,
    inAppMinTier: "high",
    osEnabled: false,
    osMinTier: "flash",
    osWatchMatches: true,
    quietHours: { enabled: true, start: "23:00", end: "07:00" },
    regions: { KR: true, US: true },
    categories: { news: true, disclosure: true, research: true, policy: true, filing: true, rating: true, etf: true, robotics: true },
    sound: false,
    tickerTape: false,
    paused: false,
    priceAlerts: [],
  };
}

export function defaultNewsPrefs(): NewsPrefs {
  return { tz: "KST", disabledSources: [], bloombergEnabled: true, minImportance: 0, watchOnly: false };
}

export function defaultChartPrefs(): ChartPrefs {
  return { chartType: "candles", scale: "normal", syncInterval: false, templates: {} };
}

export function defaultRoboticsCustom(): RoboticsCustom {
  return { added: [], removed: [] };
}

export function defaultPersisted(preferredSectors: string[] = []): PersistedV2 {
  return {
    watchlist: [...DEFAULT_WATCHLIST],
    theme: "dark",
    colorConvention: "korea",
    focusMode: false,
    preferredSectors: [...preferredSectors],
    usWatchlist: [...US_STREET_SYMBOLS],
    keywordWatch: [],
    alertSettings: defaultAlertSettings(),
    newsPrefs: defaultNewsPrefs(),
    chartPrefs: defaultChartPrefs(),
    roboticsCustom: defaultRoboticsCustom(),
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function strArray(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return [...fallback];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function deepFill<T>(defaults: T, value: unknown): T {
  if (!isObj(defaults) || !isObj(value)) {
    if (Array.isArray(defaults)) return (Array.isArray(value) ? value : defaults) as T;
    if (value === undefined || value === null) return defaults;
    return (typeof value === typeof defaults ? value : defaults) as T;
  }
  const out: Record<string, unknown> = { ...defaults };
  for (const [k, dv] of Object.entries(defaults)) {
    out[k] = deepFill(dv, (value as Record<string, unknown>)[k]);
  }
  // Keep open-ended maps (e.g. chart templates) that have no default keys.
  for (const [k, v] of Object.entries(value)) if (!(k in out)) out[k] = v;
  return out as T;
}

/**
 * Migrate any older persisted snapshot (unversioned = v0/v1) to v2. Existing
 * user data (watchlist, theme, colorConvention, focusMode, preferredSectors)
 * is preserved; new fields get defaults. Garbage input yields defaults.
 */
export function migratePersisted(persisted: unknown, _fromVersion: number, preferredDefaults: string[] = []): PersistedV2 {
  const base = defaultPersisted(preferredDefaults);
  if (!isObj(persisted)) return base;
  const p = persisted;
  return {
    watchlist: strArray(p.watchlist, base.watchlist),
    theme: p.theme === "light" || p.theme === "dark" ? p.theme : base.theme,
    colorConvention: p.colorConvention === "global" || p.colorConvention === "korea" ? p.colorConvention : base.colorConvention,
    focusMode: typeof p.focusMode === "boolean" ? p.focusMode : base.focusMode,
    preferredSectors: strArray(p.preferredSectors, base.preferredSectors),
    usWatchlist: strArray(p.usWatchlist, base.usWatchlist).map((s) => s.toUpperCase()),
    keywordWatch: strArray(p.keywordWatch, base.keywordWatch),
    alertSettings: deepFill(base.alertSettings, p.alertSettings),
    newsPrefs: deepFill(base.newsPrefs, p.newsPrefs),
    chartPrefs: deepFill(base.chartPrefs, p.chartPrefs),
    roboticsCustom: deepFill(base.roboticsCustom, p.roboticsCustom),
  };
}

/** Rehydrate merge: persisted values win, nested settings keep new default keys. */
export function mergePersisted<S extends object>(persisted: unknown, current: S): S {
  if (!isObj(persisted)) return current;
  const out: Record<string, unknown> = { ...(current as Record<string, unknown>) };
  for (const [k, v] of Object.entries(persisted)) {
    const cur = (current as Record<string, unknown>)[k];
    if (typeof cur === "function") continue;
    out[k] = isObj(cur) && isObj(v) ? deepFill(cur, v) : v;
  }
  return out as S;
}
