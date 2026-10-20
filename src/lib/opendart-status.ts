/** Public connection metadata only. API credentials never belong in this shape. */
export interface OpenDartStatus {
  configured: boolean;
  state:
    | "ok"
    | "empty"
    | "missing-key"
    | "invalid-key"
    | "rate-limited"
    | "unavailable"
    | "company-not-found"
    | "invalid-request";
  message: string;
  checkedAt: string;
  fallbackUsed: boolean;
}

export function isOpenDartConnected(status: OpenDartStatus): boolean {
  return status.state === "ok" || status.state === "empty";
}
