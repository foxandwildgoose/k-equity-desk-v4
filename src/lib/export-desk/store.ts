import { create } from "zustand";
import { persist } from "zustand/middleware";
import { assertNoSyntheticLeak } from "./demo-guard";
import type { CompanyExportExposure, VerificationStatus } from "./exposure";
import {
  seedWeight,
  validateWeightConservation,
  type ProvisionalTier,
  type ValueChainRole,
} from "./exposure";
import type { ImporterId, TradeObservation, IndexDailyRow } from "./parse-import";
import type { TopNMember } from "./ranking";
import seed from "@/data/export-desk/exposureSeed.config.json";
import core20 from "@/data/export-desk/core20.config.json";
import { kstYmd } from "@/lib/format";

const TIER_CONF = 0.5;

function today(): string {
  return kstYmd();
}

function loadSeedExposures(): CompanyExportExposure[] {
  const links = (seed.links as {
    ticker: string;
    name: string;
    category: string;
    role: ValueChainRole;
    tier: ProvisionalTier;
  }[]).map((l) => ({
    ticker: l.ticker,
    companyName: l.name,
    exportCategoryId: l.category,
    exportCategoryName: l.category,
    valueChainRole: l.role,
    exposureWeight: seedWeight(l.tier),
    mappingConfidence: TIER_CONF,
    mappingType: (l.tier === "PRIMARY" ? "PRIMARY" : "SECONDARY") as
      | "PRIMARY"
      | "SECONDARY",
    verificationStatus: "UNVERIFIED_SEED" as VerificationStatus,
    evidenceSummary: "Publicly-known line of business (seed). Not a revenue split.",
    evidenceSource: [],
    effectiveFrom: "2022-01-01",
    lastReviewedAt: today(),
    active: true,
  }));
  const excluded = (
    seed.excludedByDefault as { ticker: string; name: string; reason: string }[]
  ).map((e) => ({
    ticker: e.ticker,
    companyName: e.name,
    exportCategoryId: "holding",
    exportCategoryName: "holding",
    valueChainRole: "DOWNSTREAM" as ValueChainRole,
    exposureWeight: 0,
    mappingConfidence: 0,
    mappingType: "MULTI_SEGMENT" as const,
    verificationStatus: "UNVERIFIED_SEED" as VerificationStatus,
    evidenceSummary: e.reason,
    evidenceSource: [],
    effectiveFrom: "2022-01-01",
    lastReviewedAt: today(),
    active: false,
    inactiveReason: e.reason,
  }));
  const all = [...links, ...excluded];
  const check = validateWeightConservation(all);
  if (!check.ok) {
    throw new Error(check.error ?? "export-desk seed weights exceed 1.00");
  }
  return all;
}

export interface IngestionLog {
  id: string;
  filename: string;
  importer: ImporterId | string;
  rowCount: number;
  importedAt: string;
  ok: boolean;
}

export interface DeskSettings {
  minWeight: number;
  minConfidence: number;
  universeN: 100 | 200;
  primaryOnly: boolean;
  chartMode: "indexed" | "absolute" | "growth" | "krw";
  levelSeries: "roll12" | "wad" | "raw";
  currency: "USD" | "KRW";
  alignment: "OBSERVATION" | "RELEASE";
  range: "1Y" | "3Y" | "5Y" | "10Y" | "MAX";
}

interface ExportDeskState {
  demoMode: boolean;
  lang: "ko" | "en";
  settings: DeskSettings;
  observations: TradeObservation[];
  indexImported: IndexDailyRow[];
  exposures: CompanyExportExposure[];
  snapshots: { date: string; members: TopNMember[] }[];
  logs: IngestionLog[];
  sourceKeys: Record<string, string>;
  setDemoMode: (v: boolean) => void;
  setLang: (v: "ko" | "en") => void;
  patchSettings: (p: Partial<DeskSettings>) => void;
  upsertObservations: (rows: TradeObservation[], log: IngestionLog) => void;
  upsertIndex: (rows: IndexDailyRow[], log: IngestionLog) => void;
  upsertExposure: (row: CompanyExportExposure) => { ok: boolean; error?: string };
  removeExposure: (ticker: string, category: string) => void;
  setSourceKey: (id: string, key: string) => void;
  exportStoreJson: () => string;
  importStoreJson: (raw: string) => { ok: boolean; error?: string };
  resetStore: () => void;
}

const defaultSettings: DeskSettings = {
  minWeight: 0.2,
  minConfidence: 0.7,
  universeN: 100,
  primaryOnly: false,
  chartMode: "indexed",
  levelSeries: "roll12",
  currency: "USD",
  alignment: "OBSERVATION",
  range: "5Y",
};

export const useExportDeskStore = create<ExportDeskState>()(
  persist(
    (set, get) => ({
      demoMode: false,
      lang: "ko",
      settings: defaultSettings,
      observations: [],
      indexImported: [],
      exposures: loadSeedExposures(),
      snapshots: [],
      logs: [],
      sourceKeys: {},
      setDemoMode: (v) => set({ demoMode: v }),
      setLang: (v) => set({ lang: v }),
      patchSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      upsertObservations: (rows, log) => {
        const prev = get().observations.filter(
          (o) =>
            !rows.some(
              (r) =>
                r.period === o.period &&
                r.categoryId === o.categoryId &&
                (r.geo ?? "") === (o.geo ?? "") &&
                (r.vintage ?? "") === (o.vintage ?? ""),
            ),
        );
        set({ observations: [...prev, ...rows], logs: [log, ...get().logs].slice(0, 80) });
      },
      upsertIndex: (rows, log) => {
        const map = new Map(get().indexImported.map((r) => [r.date, r]));
        for (const r of rows) map.set(r.date, r);
        set({
          indexImported: [...map.values()].sort((a, b) => a.date.localeCompare(b.date)), // ked-allow-string-date-sort: single-format time series
          logs: [log, ...get().logs].slice(0, 80),
        });
      },
      upsertExposure: (row) => {
        const next = get()
          .exposures.filter(
            (e) => !(e.ticker === row.ticker && e.exportCategoryId === row.exportCategoryId),
          )
          .concat(row);
        const v = validateWeightConservation(next);
        if (!v.ok) return { ok: false, error: v.error };
        set({ exposures: next });
        return { ok: true };
      },
      removeExposure: (ticker, category) =>
        set({
          exposures: get().exposures.filter(
            (e) => !(e.ticker === ticker && e.exportCategoryId === category),
          ),
        }),
      setSourceKey: (id, key) =>
        set({ sourceKeys: { ...get().sourceKeys, [id]: key } }),
      exportStoreJson: () =>
        JSON.stringify(
          {
            observations: get().observations,
            indexImported: get().indexImported,
            exposures: get().exposures,
            snapshots: get().snapshots,
            logs: get().logs,
            settings: get().settings,
            demoMode: get().demoMode,
          },
          null,
          2,
        ),
      importStoreJson: (raw) => {
        try {
          const j = JSON.parse(raw) as Partial<ExportDeskState>;
          set({
            observations: j.observations ?? get().observations,
            indexImported: j.indexImported ?? get().indexImported,
            exposures: j.exposures ?? get().exposures,
            snapshots: j.snapshots ?? get().snapshots,
            logs: j.logs ?? get().logs,
          });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      },
      resetStore: () =>
        set({
          observations: [],
          indexImported: [],
          exposures: loadSeedExposures(),
          snapshots: [],
          logs: [],
          demoMode: false,
          settings: defaultSettings,
        }),
    }),
    { name: "kx-export-desk-v2" },
  ),
);

export function getCore20() {
  return core20;
}

export { assertNoSyntheticLeak };

export function getDemoExportSeries(demoMode: boolean): TradeObservation[] {
  if (!demoMode) return [];
  const start = new Date("2018-01-01");
  const items = (core20.items as { key: string; ko: string }[]);
  const rows: TradeObservation[] = [];
  for (let i = 0; i < 96; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const seasonal = 1 + 0.08 * Math.sin((2 * Math.PI * (d.getMonth() + 1)) / 12);
    const trend = 48e9 + i * 2.1e8;
    rows.push({
      period,
      categoryId: "TOTAL",
      categoryName: "TOTAL (DEMO)",
      valueUsd: trend * seasonal,
      classification: "TOTAL",
      sourceFile: "DEMO",
      vintage: "DEMO",
    });
    items.forEach((it, idx) => {
      const share = 0.18 / (1 + idx * 0.12);
      const cycle = 1 + 0.12 * Math.sin((2 * Math.PI * (i + idx * 3)) / 18);
      rows.push({
        period,
        categoryId: it.key,
        categoryName: `${it.ko} (DEMO)`,
        valueUsd: trend * share * cycle * seasonal,
        classification: "MTI",
        sourceFile: "DEMO",
        vintage: "DEMO",
      });
    });
  }
  return rows;
}
