/**
 * Persisted store schema v2 + migration from the unversioned v1 snapshot
 * (F10.2). Pure module — imported by `store.ts` and unit-tested under
 * `node --experimental-strip-types`.
 */
import { US_STREET_SYMBOLS } from "./us-street.ts";
import type { BollingerSystemSettings } from "./bollinger/types.ts";
import { sanitizeBollingerSettings } from "./bollinger/config.ts";

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
  templates: Record<string, { indicators: unknown[]; chartType?: string; scale?: string; savedAt: string; smaBundleVersion?: 1; bollinger?: BollingerSystemSettings }>;
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

const object = (value: unknown): Record<string, unknown> => isObj(value) ? value : {};
const boolean = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const timestamp = (value: unknown): value is string => nonempty(value) && Number.isFinite(Date.parse(value));
function choice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}
const CHART_TYPES: readonly ChartPrefs["chartType"][] = ["candles", "hollow", "bars", "heikin-ashi", "line", "area", "baseline"];
const CHART_SCALES: readonly ChartPrefs["scale"][] = ["normal", "log", "percent", "indexed"];
const TIERS: readonly ImportanceTierPref[] = ["flash", "high", "normal"];

function booleanMap<T extends Record<string, boolean>>(raw: unknown, base: T): T {
  const value = object(raw);
  return Object.fromEntries(Object.entries(base).map(([key, fallback]) => [key, boolean(value[key], fallback)])) as T;
}

function priceAlerts(raw: unknown, fallback: PriceAlert[]): PriceAlert[] {
  if (!Array.isArray(raw)) return fallback.map((alert) => ({ ...alert }));
  return raw.flatMap((entry): PriceAlert[] => {
    const value = object(entry);
    if (!nonempty(value.id) || !nonempty(value.code) || !timestamp(value.createdAt) ||
      (value.market !== "KR" && value.market !== "US") ||
      !["price-cross", "rsi-cross", "ma-cross"].includes(String(value.kind)) ||
      !["up", "down", "any"].includes(String(value.direction)) ||
      !["once", "every"].includes(String(value.repeat)) || typeof value.active !== "boolean") return [];
    if (value.kind === "ma-cross"
      ? !finite(value.fast) || !Number.isInteger(value.fast) || value.fast <= 0 ||
        !finite(value.slow) || !Number.isInteger(value.slow) || value.slow <= 0
      : !finite(value.level) || value.level < 0 || (value.kind === "price-cross" && value.level === 0) ||
        (value.kind === "rsi-cross" && value.level > 100)) return [];
    const alert: PriceAlert = {
      id: value.id, market: value.market, code: value.code,
      kind: value.kind as PriceAlert["kind"], direction: value.direction as PriceAlert["direction"],
      repeat: value.repeat as PriceAlert["repeat"], active: value.active, createdAt: value.createdAt,
      ...(typeof value.name === "string" ? { name: value.name } : {}),
      ...(finite(value.level) ? { level: value.level } : {}),
      ...(finite(value.fast) ? { fast: value.fast } : {}),
      ...(finite(value.slow) ? { slow: value.slow } : {}),
      ...(timestamp(value.lastFiredAt) ? { lastFiredAt: value.lastFiredAt } : {}),
      ...(value.lastSide === "above" || value.lastSide === "below" ? { lastSide: value.lastSide } : {}),
    };
    // Chart alerts use this persisted key to avoid firing twice for one bar.
    if (nonempty(value.lastBarKey)) Object.assign(alert, { lastBarKey: value.lastBarKey });
    return [alert];
  });
}

function alertSettings(raw: unknown, base: AlertSettings): AlertSettings {
  const value = object(raw), quiet = object(value.quietHours);
  const time = (raw: unknown, fallback: string) => typeof raw === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : fallback;
  return {
    ...booleanMap(value, {
      inAppEnabled: base.inAppEnabled, osEnabled: base.osEnabled, osWatchMatches: base.osWatchMatches,
      sound: base.sound, tickerTape: base.tickerTape, paused: base.paused,
    }),
    inAppMinTier: choice(value.inAppMinTier, TIERS, base.inAppMinTier),
    osMinTier: choice(value.osMinTier, TIERS, base.osMinTier),
    quietHours: { enabled: boolean(quiet.enabled, base.quietHours.enabled), start: time(quiet.start, base.quietHours.start), end: time(quiet.end, base.quietHours.end) },
    regions: booleanMap(value.regions, base.regions),
    categories: booleanMap(value.categories, base.categories),
    priceAlerts: priceAlerts(value.priceAlerts, base.priceAlerts),
  };
}

function templates(raw: unknown, fallback: ChartPrefs["templates"]): ChartPrefs["templates"] {
  if (!isObj(raw)) return fallback;
  return Object.fromEntries(Object.entries(raw).flatMap(([name, entry]) => {
    if (!nonempty(name) || !isObj(entry) || !Array.isArray(entry.indicators)) return [];
    const indicators = entry.indicators.flatMap((raw) => {
      const indicator = object(raw);
      if (!nonempty(indicator.id) || !nonempty(indicator.uid) || !isObj(indicator.params)) return [];
      return [{
        id: indicator.id, uid: indicator.uid,
        params: Object.fromEntries(Object.entries(indicator.params).filter(([, value]) => typeof value === "string" || finite(value))),
        visible: boolean(indicator.visible, true),
        ...(typeof indicator.color === "string" ? { color: indicator.color } : {}),
        ...(indicator.colorMode === "theme" || indicator.colorMode === "custom" ? { colorMode: indicator.colorMode } : {}),
        ...(typeof indicator.anchorTime === "string" || finite(indicator.anchorTime) || indicator.anchorTime === null ? { anchorTime: indicator.anchorTime } : {}),
      }];
    });
    const template: ChartPrefs["templates"][string] = {
      indicators,
      savedAt: typeof entry.savedAt === "string" ? entry.savedAt : fallback[name]?.savedAt ?? "",
      ...(typeof entry.chartType === "string" && CHART_TYPES.includes(entry.chartType as ChartPrefs["chartType"]) ? { chartType: entry.chartType } : {}),
      ...(typeof entry.scale === "string" && CHART_SCALES.includes(entry.scale as ChartPrefs["scale"]) ? { scale: entry.scale } : {}),
      ...(entry.smaBundleVersion === 1 ? { smaBundleVersion: 1 as const } : {}),
      ...(isObj(entry.bollinger) ? { bollinger: sanitizeBollingerSettings(entry.bollinger) } : {}),
    };
    return [[name, template]];
  }));
}

function robotics(raw: unknown, base: RoboticsCustom): RoboticsCustom {
  const value = object(raw);
  return {
    added: !Array.isArray(value.added) ? base.added.map((item) => ({ ...item })) : value.added.flatMap((raw): RoboticsCustomEntry[] => {
      const item = object(raw);
      if ((item.market !== "KR" && item.market !== "US") || !nonempty(item.code) || !nonempty(item.name)) return [];
      return [{ market: item.market, code: item.code.toUpperCase(), name: item.name,
        ...(typeof item.segment === "string" ? { segment: item.segment } : {}),
        ...(item.exposure === "pure-play" || item.exposure === "significant" || item.exposure === "indirect" ? { exposure: item.exposure } : {}),
      }];
    }),
    removed: strArray(value.removed, base.removed),
  };
}

/** Validate every saved field, including snapshots that already have the current version. */
function sanitizePersisted(raw: unknown, base: PersistedV2): PersistedV2 {
  const value = object(raw), news = object(value.newsPrefs), chart = object(value.chartPrefs);
  return {
    watchlist: strArray(value.watchlist, base.watchlist),
    theme: choice(value.theme, ["light", "dark"], base.theme),
    colorConvention: choice(value.colorConvention, ["global", "korea"], base.colorConvention),
    focusMode: boolean(value.focusMode, base.focusMode),
    preferredSectors: strArray(value.preferredSectors, base.preferredSectors),
    usWatchlist: strArray(value.usWatchlist, base.usWatchlist).map((s) => s.toUpperCase()),
    keywordWatch: strArray(value.keywordWatch, base.keywordWatch),
    alertSettings: alertSettings(value.alertSettings, base.alertSettings),
    newsPrefs: {
      tz: choice(news.tz, ["KST", "ET"], base.newsPrefs.tz),
      disabledSources: strArray(news.disabledSources, base.newsPrefs.disabledSources),
      bloombergEnabled: boolean(news.bloombergEnabled, base.newsPrefs.bloombergEnabled),
      minImportance: finite(news.minImportance) && news.minImportance >= 0 && news.minImportance <= 100 ? news.minImportance : base.newsPrefs.minImportance,
      watchOnly: boolean(news.watchOnly, base.newsPrefs.watchOnly),
    },
    chartPrefs: {
      chartType: choice(chart.chartType, CHART_TYPES, base.chartPrefs.chartType),
      scale: choice(chart.scale, CHART_SCALES, base.chartPrefs.scale),
      syncInterval: boolean(chart.syncInterval, base.chartPrefs.syncInterval),
      templates: templates(chart.templates, base.chartPrefs.templates),
    },
    roboticsCustom: robotics(value.roboticsCustom, base.roboticsCustom),
  };
}

/** Migrate older snapshots without replacing valid individual preferences. */
export function migratePersisted(persisted: unknown, _fromVersion: number, preferredDefaults: string[] = []): PersistedV2 {
  return sanitizePersisted(persisted, defaultPersisted(preferredDefaults));
}

/** Rehydrate only persisted preferences; runtime state and action functions stay intact. */
export function mergePersisted<S extends object>(persisted: unknown, current: S): S {
  if (!isObj(persisted)) return current;
  const base = sanitizePersisted(current, defaultPersisted());
  const saved = sanitizePersisted(persisted, base);
  const out = { ...current } as Record<string, unknown>;
  for (const key of Object.keys(saved) as (keyof PersistedV2)[]) {
    if (Object.prototype.hasOwnProperty.call(current, key) && typeof out[key] !== "function") out[key] = saved[key];
  }
  return out as S;
}
