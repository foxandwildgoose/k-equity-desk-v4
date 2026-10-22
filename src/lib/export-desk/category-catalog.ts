import type { ExportProviderStatus } from "./provider-status";

/** Card summaries are intentionally separate from analytical monthly histories. */
export interface CategoryCatalogItem {
  id: string;
  label: string;
  current: { period: string; valueUsd: number } | null;
  previousYoY: { period: string; valueUsd: number } | null;
  yoyPct: number | null;
  state: "ok" | "stale" | "pending" | "unavailable";
  count: number;
  source: string | null;
  classification: "HS" | "HSK" | "MTI" | "OFFICIAL_ITEM" | null;
  providers: ExportProviderStatus[];
  verifiedAt: string | null;
  freshUntil: string | null;
  retryAt: string | null;
}

export interface CategoryCatalog {
  items: CategoryCatalogItem[];
  pending: string[];
  attempted: string[];
  refreshed: string[];
  storage: "postgres" | "memory";
  fetchedAt: string;
}
