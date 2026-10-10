/**
 * RISE full issuer XLSX. Its JSON holdings endpoint is capped at Top30.
 * Endpoint/date/header evidence: https://github.com/minguisstockgoat/passive-etf-dashboard/blob/main/scripts/fetchers.py
 * An explicit issuer available date prevents silent fallback to another day's file.
 */
import { readSheet } from "read-excel-file/node";
import { isCuNotionalName, krCodeFromIsin, type ParsedCuRow } from "./etf-holdings-parse.ts";
import { etfIssuerIdentity, fetchOfficialIssuerBytes, fetchOfficialIssuerText, isOfficialIssuerUrl, type EtfIssuerProduct, type IssuerRequestOptions } from "./etf-issuer.ts";

export type IssuerSpreadsheetHoldings = { rows: ParsedCuRow[]; asOf: string; issuerUrl: string };
// The reader's published CellValue type also includes DateConstructor.
type Cell = string | number | boolean | Date | typeof Date | null;
type RiseMetadata = { base_dt?: unknown; available_dates?: unknown; krx_cd?: unknown; fund_cd?: unknown };

function date(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!/^\d{8}$|^\d{4}([.\-/])\d{2}\1\d{2}$/.test(raw)) return null;
  const digits = raw.replace(/[.\-/]/g, "");
  const result = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const parsed = new Date(`${result}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === result ? result : null;
}
function numeric(value: Cell | undefined): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const text = String(value).replace(/,/g, "").replace(/%$/, "").trim();
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}
function heading(value: Cell | undefined): string { return String(value ?? "").trim().replace(/\s+/g, ""); }

/** Named percentage cells are copied exactly; evaluation/quantities never infer weights. */
export function parseRiseSpreadsheetRows(data: Cell[][], asOf: string): Omit<IssuerSpreadsheetHoldings, "issuerUrl"> | null {
  if (!date(asOf) || data.length > 2002) return null;
  let start = -1;
  let indexes: { code: number; name: number; weight: number; quantity: number } | null = null;
  for (let rowIndex = 0; rowIndex < Math.min(data.length, 10); rowIndex++) {
    const headers = data[rowIndex]!.map(heading);
    for (let column = 0; column < headers.length; column++) {
      if (/^(?:기준일|기준일자)$/.test(headers[column]!)) {
        const found = date(data[rowIndex]![column + 1]);
        if (!found || found !== asOf) return null;
      }
    }
    const matches = {
      code: headers.flatMap((x, i) => /^(?:종목코드|표준코드|ISIN)$/i.test(x) ? [i] : []),
      name: headers.flatMap((x, i) => /^(?:종목명|보유종목명)$/.test(x) ? [i] : []),
      quantity: headers.flatMap((x, i) => /^(?:수량|보유수량)(?:\(주\))?$/.test(x) ? [i] : []),
      weight: headers.flatMap((x, i) => /^(?:보유비중|편입비중|비중|구성비율)\(%\)$/.test(x) ? [i] : []),
    };
    if (!matches.name.length || !matches.weight.length) continue;
    if (Object.values(matches).some((x) => x.length !== 1)) return null;
    indexes = { code: matches.code[0]!, name: matches.name[0]!, quantity: matches.quantity[0]!, weight: matches.weight[0]! };
    start = rowIndex + 1;
    break;
  }
  if (!indexes) return null;
  const rows: ParsedCuRow[] = [];
  for (const cells of data.slice(start)) {
    if (cells.every((x) => x == null || String(x).trim() === "")) continue;
    if (typeof cells[indexes.name] !== "string") return null;
    const nameKo = String(cells[indexes.name]).trim();
    const security = String(cells[indexes.code] ?? "").trim().toUpperCase();
    if (isCuNotionalName(nameKo) || /^(?:합계|총계|총합|TOTAL)$/i.test(nameKo) || security === "CASH00000001") continue;
    const weight = numeric(cells[indexes.weight]);
    const quantity = numeric(cells[indexes.quantity]);
    if (!nameKo || weight == null || Math.abs(weight) > 100 || quantity == null) return null;
    const isin = /^[A-Z]{2}[A-Z0-9]{10}$/.test(security) ? security : null;
    rows.push({ nameKo, weight, quantity, asOf,
      code: /^[0-9A-Z]{6}$/.test(security) ? security : isin && /^KR7[0-9A-Z]{6}00\d$/.test(isin) ? isin.slice(3, 9) : krCodeFromIsin(isin), isin });
  }
  const identities = rows.map((x) => x.isin ?? x.code ?? x.nameKo);
  const sum = rows.reduce((total, row) => total + row.weight!, 0);
  return rows.length && new Set(identities).size === rows.length && sum >= 99 && sum <= 101 ? { rows, asOf } : null;
}

/** Binary XLSX parsing is confined to official downloads; arbitrary uploads are not fetched. */
export async function parseRiseSpreadsheet(bytes: Uint8Array, asOf: string): Promise<Omit<IssuerSpreadsheetHoldings, "issuerUrl"> | null> {
  if (bytes.byteLength > 3_000_000 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return null;
  try {
    const data = await readSheet(Buffer.from(bytes));
    return parseRiseSpreadsheetRows(data, asOf);
  } catch { return null; }
}

/** The latest date comes from issuer metadata, never the request time or Top30 JSON. */
export async function fetchRiseSpreadsheetHoldings(code: string, name: string, product: EtfIssuerProduct, options: IssuerRequestOptions = {}): Promise<IssuerSpreadsheetHoldings | null> {
  const ticker = code.trim().toUpperCase();
  if (!/^[0-9A-Z]{6}$/.test(ticker) || product.family !== "rise" || etfIssuerIdentity(name, product.issuerName).family !== "rise" || product.status !== "resolved" || !product.issuerUrl || !isOfficialIssuerUrl(product.issuerUrl, "rise") || options.signal?.aborted) return null;
  const url = new URL(product.issuerUrl);
  if (!["kbam.co.kr", "www.kbam.co.kr"].includes(url.hostname)) return null;
  const id = /^\/products\/([A-Za-z0-9_-]{1,80})\/?$/.exec(url.pathname)?.[1];
  if (!id || (product.productId && product.productId !== id)) return null;
  const deadline = AbortSignal.timeout(10_000);
  options = { ...options, signal: options.signal ? AbortSignal.any([deadline, options.signal]) : deadline };
  const endpoint = `https://kbam.co.kr/api/products/etfs/${encodeURIComponent(id)}/holdings`;
  try {
    const metadata = JSON.parse(await fetchOfficialIssuerText(endpoint, "rise", options)) as RiseMetadata;
    if ((metadata.krx_cd != null && String(metadata.krx_cd).toUpperCase() !== ticker) || (metadata.fund_cd != null && String(metadata.fund_cd) !== id)) return null;
    const asOf = date(metadata.base_dt);
    if (!asOf || !Array.isArray(metadata.available_dates) || !metadata.available_dates.some((value) => date(value) === asOf)) return null;
    const bytes = await fetchOfficialIssuerBytes(`${endpoint}?download=xlsx&base_dt=${asOf.replace(/-/g, "")}`, "rise", options);
    if (options.signal?.aborted) return null;
    const parsed = await parseRiseSpreadsheet(bytes, asOf);
    return parsed ? { ...parsed, issuerUrl: product.issuerUrl } : null;
  } catch { return null; }
}
