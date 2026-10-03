import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SectorId } from "@/data/types";
import { FOCUS_SECTOR_IDS } from "@/data/sectors";
import {
  STORE_VERSION,
  DEFAULT_WATCHLIST,
  defaultAlertSettings,
  defaultChartPrefs,
  defaultNewsPrefs,
  defaultRoboticsCustom,
  mergePersisted,
  migratePersisted,
  type AlertSettings,
  type ChartPrefs,
  type NewsPrefs,
  type PriceAlert,
  type RoboticsCustom,
  type RoboticsCustomEntry,
} from "@/lib/store-migrate";
import { US_STREET_SYMBOLS } from "@/lib/us-street";

export type ColorConvention = "korea" | "global";
export type ThemeMode = "dark" | "light";
export type { AlertSettings, ChartPrefs, NewsPrefs, PriceAlert, RoboticsCustom, RoboticsCustomEntry };

interface AppState {
  watchlist: string[];
  theme: ThemeMode;
  colorConvention: ColorConvention;
  focusMode: boolean;
  preferredSectors: SectorId[];
  sidebarOpen: boolean;
  usWatchlist: string[];
  keywordWatch: string[];
  alertSettings: AlertSettings;
  newsPrefs: NewsPrefs;
  chartPrefs: ChartPrefs;
  roboticsCustom: RoboticsCustom;
  addToWatchlist: (code: string) => void;
  removeFromWatchlist: (code: string) => void;
  toggleWatchlist: (code: string) => void;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  setColorConvention: (c: ColorConvention) => void;
  setFocusMode: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  isWatched: (code: string) => boolean;
  addUsWatch: (symbol: string) => void;
  removeUsWatch: (symbol: string) => void;
  addKeyword: (kw: string) => void;
  removeKeyword: (kw: string) => void;
  setAlertSettings: (patch: Partial<AlertSettings>) => void;
  upsertPriceAlert: (alert: PriceAlert) => void;
  removePriceAlert: (id: string) => void;
  setNewsPrefs: (patch: Partial<NewsPrefs>) => void;
  toggleSource: (sourceId: string, on: boolean) => void;
  setChartPrefs: (patch: Partial<ChartPrefs>) => void;
  addRoboticsName: (entry: RoboticsCustomEntry) => void;
  hideRoboticsName: (key: string) => void;
  restoreRoboticsName: (key: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      watchlist: DEFAULT_WATCHLIST,
      theme: "dark",
      colorConvention: "korea",
      focusMode: false,
      preferredSectors: FOCUS_SECTOR_IDS as SectorId[],
      sidebarOpen: false,
      usWatchlist: [...US_STREET_SYMBOLS],
      keywordWatch: [],
      alertSettings: defaultAlertSettings(),
      newsPrefs: defaultNewsPrefs(),
      chartPrefs: defaultChartPrefs(),
      roboticsCustom: defaultRoboticsCustom(),
      addToWatchlist: (code) =>
        set((s) =>
          s.watchlist.includes(code)
            ? s
            : { watchlist: [...s.watchlist, code] },
        ),
      removeFromWatchlist: (code) =>
        set((s) => ({
          watchlist: s.watchlist.filter((c) => c !== code),
        })),
      toggleWatchlist: (code) => {
        const { watchlist } = get();
        if (watchlist.includes(code)) {
          get().removeFromWatchlist(code);
        } else {
          get().addToWatchlist(code);
        }
      },
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setColorConvention: (colorConvention) => set({ colorConvention }),
      setFocusMode: (focusMode) => set({ focusMode }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      isWatched: (code) => get().watchlist.includes(code),
      addUsWatch: (symbol) =>
        set((s) => {
          const sym = symbol.trim().toUpperCase();
          if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(sym) || s.usWatchlist.includes(sym)) return s;
          return { usWatchlist: [...s.usWatchlist, sym] };
        }),
      removeUsWatch: (symbol) =>
        set((s) => ({ usWatchlist: s.usWatchlist.filter((x) => x !== symbol.toUpperCase()) })),
      addKeyword: (kw) =>
        set((s) => {
          const k = kw.trim();
          if (k.length < 2 || s.keywordWatch.includes(k)) return s;
          return { keywordWatch: [...s.keywordWatch, k].slice(-50) };
        }),
      removeKeyword: (kw) => set((s) => ({ keywordWatch: s.keywordWatch.filter((x) => x !== kw) })),
      setAlertSettings: (patch) => set((s) => ({ alertSettings: { ...s.alertSettings, ...patch } })),
      upsertPriceAlert: (alert) =>
        set((s) => {
          const rest = s.alertSettings.priceAlerts.filter((a) => a.id !== alert.id);
          return { alertSettings: { ...s.alertSettings, priceAlerts: [...rest, alert].slice(-100) } };
        }),
      removePriceAlert: (id) =>
        set((s) => ({
          alertSettings: { ...s.alertSettings, priceAlerts: s.alertSettings.priceAlerts.filter((a) => a.id !== id) },
        })),
      setNewsPrefs: (patch) => set((s) => ({ newsPrefs: { ...s.newsPrefs, ...patch } })),
      toggleSource: (sourceId, on) =>
        set((s) => {
          const cur = new Set(s.newsPrefs.disabledSources);
          if (on) cur.delete(sourceId);
          else cur.add(sourceId);
          return { newsPrefs: { ...s.newsPrefs, disabledSources: [...cur] } };
        }),
      setChartPrefs: (patch) => set((s) => ({ chartPrefs: { ...s.chartPrefs, ...patch } })),
      addRoboticsName: (entry) =>
        set((s) => {
          const key = `${entry.market}:${entry.code.toUpperCase()}`;
          const added = s.roboticsCustom.added.filter((e) => `${e.market}:${e.code.toUpperCase()}` !== key);
          return {
            roboticsCustom: {
              added: [...added, { ...entry, code: entry.code.toUpperCase() }],
              removed: s.roboticsCustom.removed.filter((k) => k !== key),
            },
          };
        }),
      hideRoboticsName: (key) =>
        set((s) => ({
          roboticsCustom: {
            added: s.roboticsCustom.added.filter((e) => `${e.market}:${e.code}` !== key),
            removed: s.roboticsCustom.removed.includes(key) ? s.roboticsCustom.removed : [...s.roboticsCustom.removed, key],
          },
        })),
      restoreRoboticsName: (key) =>
        set((s) => ({ roboticsCustom: { ...s.roboticsCustom, removed: s.roboticsCustom.removed.filter((k) => k !== key) } })),
    }),
    {
      name: "korea-equity-cc",
      version: STORE_VERSION,
      migrate: (persisted, version) =>
        migratePersisted(persisted, version, FOCUS_SECTOR_IDS as string[]) as unknown as AppState,
      merge: (persisted, current) => mergePersisted(persisted, current),
      partialize: (s) => ({
        watchlist: s.watchlist,
        theme: s.theme,
        colorConvention: s.colorConvention,
        focusMode: s.focusMode,
        preferredSectors: s.preferredSectors,
        usWatchlist: s.usWatchlist,
        keywordWatch: s.keywordWatch,
        alertSettings: s.alertSettings,
        newsPrefs: s.newsPrefs,
        chartPrefs: s.chartPrefs,
        roboticsCustom: s.roboticsCustom,
      }),
    },
  ),
);

/** Korea: red up / blue down. Global: green up / red down. */
export function usePriceColors() {
  const convention = useAppStore((s) => s.colorConvention);
  if (convention === "korea") {
    return {
      up: "text-price-up",
      down: "text-price-down",
      upBg: "bg-price-up/10",
      downBg: "bg-price-down/10",
      upSolid: "bg-price-up",
      downSolid: "bg-price-down",
      label: "상승 빨강 · 하락 파랑 (한국)",
    };
  }
  return {
    up: "text-price-up-global",
    down: "text-price-down-global",
    upBg: "bg-price-up-global/10",
    downBg: "bg-price-down-global/10",
    upSolid: "bg-price-up-global",
    downSolid: "bg-price-down-global",
    label: "상승 초록 · 하락 빨강 (글로벌)",
  };
}

/** Registry ids hidden by the user (Bloomberg toggle folds in here). */
export function useDisabledSources(): Set<string> {
  const disabled = useAppStore((s) => s.newsPrefs.disabledSources);
  const bloomberg = useAppStore((s) => s.newsPrefs.bloombergEnabled);
  return useMemo(() => {
    const ids = new Set(disabled);
    if (!bloomberg) for (const id of BLOOMBERG_SOURCE_IDS) ids.add(id);
    return ids;
  }, [disabled, bloomberg]);
}

export const BLOOMBERG_SOURCE_IDS = [
  "bloomberg-markets",
  "bloomberg-economics",
  "bloomberg-technology",
  "bloomberg-politics",
  "bloomberg-wealth",
  "gn-bloomberg",
];
