/** Fixed diagnostic identifiers only; never include a provider message, URL, or key. */
export type OpenDartReasonCode =
  | "API_OK" | "API_EMPTY" | "KEY_MISSING" | "KEY_INVALID_FORMAT"
  | "API_INVALID_KEY" | "API_RATE_LIMIT" | "API_INVALID_REQUEST" | "API_UNAVAILABLE"
  | "REQUEST_INVALID" | "REQUEST_CAPACITY" | "CORP_NOT_FOUND" | "COMPANY_MAPPING_AMBIGUOUS"
  | "CORP_REQUEST_HTTP" | "CORP_REQUEST_NETWORK" | "CORP_REQUEST_TIMEOUT" | "CORP_RESPONSE_SIZE"
  | "LIST_REQUEST_HTTP" | "LIST_REQUEST_NETWORK" | "LIST_REQUEST_TIMEOUT" | "LIST_RESPONSE_SIZE"
  | "DISCOVERY_REQUEST_HTTP" | "DISCOVERY_REQUEST_NETWORK" | "DISCOVERY_REQUEST_TIMEOUT" | "DISCOVERY_RESPONSE_SIZE"
  | "DISCOVERY_NO_CANDIDATES" | "DISCOVERY_TOO_MANY_CANDIDATES" | "DISCOVERY_INVALID_HTML"
  | "COMPANY_REQUEST_HTTP" | "COMPANY_REQUEST_NETWORK" | "COMPANY_REQUEST_TIMEOUT" | "COMPANY_RESPONSE_SIZE"
  | "COMPANY_JSON_INVALID" | "COMPANY_IDENTITY_INVALID"
  | "CORP_ZIP_FORMAT" | "CORP_ZIP_DIRECTORY" | "CORP_ZIP_ENTRY" | "CORP_ZIP_LOCAL"
  | "CORP_ZIP_DESCRIPTOR" | "CORP_ZIP_INFLATE" | "CORP_ZIP_SIZE" | "CORP_ZIP_CRC"
  | "CORP_XML_DECODE" | "CORP_XML_SYNTAX" | "CORP_XML_ROOT" | "CORP_XML_RECORD" | "CORP_XML_DUPLICATE"
  | "LIST_JSON_INVALID" | "LIST_PAYLOAD_INVALID" | "LIST_IDENTITY_INVALID";

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
  reasonCode?: OpenDartReasonCode;
  /** Lightweight lookup failure when a subsequent archive fallback also fails. */
  resolutionReasonCode?: OpenDartReasonCode;
}

export function isOpenDartConnected(status: OpenDartStatus): boolean {
  return status.state === "ok" || status.state === "empty";
}
