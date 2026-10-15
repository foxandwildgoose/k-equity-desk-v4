export type Market = "KOSPI" | "KOSDAQ";

export type CapBand = "대형" | "중형" | "소형";

export type SectorId =
  | "semiconductors"
  | "electronics"
  | "auto"
  | "battery"
  | "bio"
  | "finance"
  | "shipbuilding"
  | "chemicals"
  | "energy"
  | "telecom"
  | "consumer"
  | "construction"
  | "steel"
  | "robotics"
  | "defense"
  | "us-linked";

export interface Sector {
  id: SectorId;
  nameKo: string;
  nameEn: string;
  /** Plain-language industry view (formerly "thesis") */
  thesis: string;
  /** Focus-mode default sectors */
  focus?: boolean;
  /** Accent token for desk UI */
  accent?: "navy" | "gold" | "teal" | "copper" | "indigo" | "rose";
  /** Primary original reading for this industry view */
  sourceUrl?: string;
  moreSources?: { label: string; url: string }[];
}

export interface Stock {
  code: string;
  nameKo: string;
  nameEn: string;
  sectorId: SectorId;
  market: Market;
  /** False when a numeric quote carrier does not contain a verified price/change. */
  quoteAvailable?: boolean;
  quoteAsOf?: string | null;
  quoteStatus?: "fresh" | "closed" | "stale" | "unavailable";
  price: number;
  change: number;
  changePct: number;
  volume: number;
  volumeValid?: boolean;
  /** Market cap in 억 KRW */
  marketCap: number;
  marketCapValid?: boolean;
  capBand: CapBand;
  high52: number;
  low52: number;
  /** Last 20 session closes for sparkline */
  sparkline: number[];
}

export type SignalType = "news" | "disclosure" | "social";

export type DisclosureCategory =
  | "Earnings"
  | "Guidance"
  | "Contracts"
  | "M&A"
  | "Capital"
  | "Governance"
  | "Regulatory";

export interface Signal {
  id: string;
  type: SignalType;
  title: string;
  summary: string;
  whyItMatters?: string;
  timestamp: string;
  tickers: string[];
  sectorIds: SectorId[];
  source: string;
  important: boolean;
  disclosureCategory?: DisclosureCategory;
  /** Social engagement proxy */
  engagement?: number;
}

export interface MarketIndex {
  id: string;
  nameKo: string;
  nameEn: string;
  value: number;
  change: number;
  changePct: number;
}

export type SortKey = "name" | "changePct" | "price" | "volume" | "marketCap";
export type SortDir = "asc" | "desc";

export type EtfCategory =
  | "domestic-index"
  | "theme"
  | "us-equity"
  | "income"
  | "sector";

export type UsLinkPillar =
  | "ai-semiconductor"
  | "battery-ira"
  | "defense-ship"
  | "nuclear-power"
  | "bio-cdmo"
  | "auto-export";
