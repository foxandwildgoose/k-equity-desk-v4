/** Public provider metadata. Credentials and credential-bearing URLs never belong here. */
export interface ExportProviderStatus {
  id: string;
  name: string;
  configured: boolean;
  state:
    | "ok"
    | "partial"
    | "stale"
    | "empty"
    | "missing-key"
    | "invalid-key"
    | "rate-limited"
    | "unavailable"
    | "unverified";
  message: string;
  checkedAt: string;
  asOf: string | null;
  recordCount: number;
  sourceUrl: string;
  provisional?: boolean;
  reasonCode?: string;
  /** Provider-directed retry time, shared across serverless workers. */
  retryAt?: string;
}
