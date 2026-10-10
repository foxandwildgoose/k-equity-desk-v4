/** Official issuer JSON baskets. Published percentages are preserved verbatim. */
import { isCuNotionalName, krCodeFromIsin, type ParsedCuRow } from "./etf-holdings-parse.ts";
import { etfIssuerIdentity, fetchOfficialIssuerText, isOfficialIssuerUrl, type EtfIssuerProduct, type IssuerRequestOptions } from "./etf-issuer.ts";

type JsonRecord = Record<string, unknown>;
export type StructuredIssuerBasket = { rows: ParsedCuRow[]; asOf: string; issuerUrl: string };
type ParsedBasket = Omit<StructuredIssuerBasket, "issuerUrl">;
type RowFields = { name: string[]; security: string[]; weight: string[]; quantity: string[]; date: string[] };

function record(value: unknown): JsonRecord | null {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}
function valueFor(row: JsonRecord, fields: string[]): unknown {
  return fields.map((key) => row[key]).find((value) => value != null && String(value).trim() !== "");
}
function numeric(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim().replace(/,/g, "").replace(/%$/, "").trim();
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}
function fullDate(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!/^\d{8}$|^\d{4}([.\-/])\d{2}\1\d{2}$/.test(raw)) return null;
  const digits = raw.replace(/[.\-/]/g, "");
  const date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}
function rowDate(row: JsonRecord, fields: string[]): { date: string | null; conflict: boolean } {
  const values = fields.map((key) => row[key]).filter((value) => value != null);
  if (!values.length) return { date: null, conflict: false };
  const dates = values.map(fullDate);
  return { date: dates[0] ?? null, conflict: dates.some((date) => !date || date !== dates[0]) };
}
function collection(value: unknown, keys: string[]): unknown[] | null {
  const pack = record(value);
  if (!pack) return null;
  for (const key of keys) {
    if (pack[key] != null) return Array.isArray(pack[key]) ? pack[key] as unknown[] : null;
  }
  return null;
}
function parseRows(items: unknown[] | null, fields: RowFields, basketDate?: string): ParsedBasket | null {
  if (!items?.length || items.length > 1000) return null;
  let asOf = basketDate ?? null;
  const rows: ParsedCuRow[] = [];
  for (const item of items) {
    const row = record(item);
    if (!row) return null;
    const nameKo = String(valueFor(row, fields.name) ?? "").trim();
    const security = String(valueFor(row, fields.security) ?? "").trim().toUpperCase();
    // CASH00000001 describes the CU notional. KRD cash and bank deposits are holdings.
    if (isCuNotionalName(nameKo) || /^(?:합계|총계|전체합계|TOTAL|GRAND TOTAL)$/i.test(nameKo.replace(/\s+/g, " ")) || security === "CASH00000001") continue;
    if (!nameKo) return null;
    const publishedDate = rowDate(row, fields.date);
    if (publishedDate.conflict || (!publishedDate.date && !basketDate)) return null;
    if (publishedDate.date && asOf && publishedDate.date !== asOf) return null;
    asOf ??= publishedDate.date;
    const weight = numeric(valueFor(row, fields.weight));
    if (weight == null || Math.abs(weight) > 100) return null;
    const isin = /^[A-Z]{2}[A-Z0-9]{10}$/.test(security) ? security : null;
    rows.push({ nameKo, weight, quantity: numeric(valueFor(row, fields.quantity)), asOf,
      code: /^[0-9A-Z]{6}$/.test(security) ? security : isin && /^KR7[0-9][A-Z0-9]{5}00\d$/.test(isin) ? isin.slice(3, 9) : krCodeFromIsin(isin), isin });
  }
  const sum = rows.reduce((total, row) => total + (row.weight ?? 0), 0);
  const identities = rows.map((row) => row.isin ?? row.code ?? row.nameKo);
  return asOf && rows.length && new Set(identities).size === rows.length && sum >= 99 && sum <= 101 ? { rows, asOf } : null;
}

/** ACE's current full PDF: explicit row dates, including actual cash/deposits. */
export function parseAceIssuerHoldings(value: unknown): ParsedBasket | null {
  return parseRows(collection(value, ["pdfList", "content"]), {
    name: ["sec_NM", "secNm"], security: ["jm_KSC_CD", "jmKscCd"], weight: ["wg"],
    quantity: ["cu_ITEM_CNT", "cuItemCnt"], date: ["std_DT", "stdDt"],
  });
}
/** KIWOOM's full PDF response; a requested day never substitutes for businessDate. */
export function parseKiwoomIssuerHoldings(value: unknown): ParsedBasket | null {
  return parseRows(collection(value, ["pdfList"]), {
    name: ["itemTitle"], security: ["gcode", "itemCode"], weight: ["ratio"],
    quantity: ["volume"], date: ["businessDate"],
  });
}
/** KoAct's PDF envelope has the authoritative publication date for all its rows. */
export function parseKoActIssuerHoldings(value: unknown): ParsedBasket | null {
  const pdf = record(record(value)?.pdf);
  const date = fullDate(pdf?.gijunYMD);
  if (!pdf || !date) return null;
  return parseRows(collection(pdf, ["list"]), {
    name: ["secNm"], security: ["itmNo"], weight: ["ratio"],
    quantity: ["applyQ"], date: ["gijunYMD", "EVAL_D"],
  }, date);
}
/** Issuer-confirmed NAV dates are query candidates; returned PDF dates remain authoritative. */
export function koActIssuerReferenceDate(value: unknown): string | null {
  const suik = record(record(value)?.suik);
  if (!Array.isArray(suik?.standardList)) return null;
  const dates = suik.standardList.map((item) => fullDate(record(item)?.EVAL_D)).filter((date): date is string => date != null);
  return dates.sort().at(-1) ?? null;
}
function koreanToday(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "");
}
function safeId(value: string | null | undefined): value is string { return Boolean(value && /^[A-Za-z0-9_-]{1,80}$/.test(value)); }
function metadataMatches(value: unknown, ticker: string, id: string): boolean {
  const pack = record(value);
  const product = record(record(pack?.info)?.product);
  for (const row of [pack, product]) {
    if (!row) continue;
    for (const key of ["stkTicker", "stk_ticker"]) {
      if (row[key] != null && String(row[key]).trim().toUpperCase() !== ticker) return false;
    }
    if (row.fId != null && String(row.fId).trim() !== id) return false;
  }
  return true;
}

/** Only a previously resolved exact product can select an official endpoint. */
export async function fetchStructuredIssuerHoldings(code: string, name: string, product: EtfIssuerProduct, options: IssuerRequestOptions = {}): Promise<StructuredIssuerBasket | null> {
  const ticker = code.trim().toUpperCase();
  if (!/^[0-9A-Z]{6}$/.test(ticker) || product.status !== "resolved" || !product.issuerUrl ||
    !isOfficialIssuerUrl(product.issuerUrl, product.family) || etfIssuerIdentity(name, product.issuerName).family !== product.family || options.signal?.aborted) return null;
  const url = new URL(product.issuerUrl);
  let basket: ParsedBasket | null = null;
  try {
    if (product.family === "ace") {
      const match = /^\/fund\/([^/]+)\/?$/.exec(url.pathname);
      const id = match ? decodeURIComponent(match[1]!) : null;
      if (!safeId(id) || (product.productId && product.productId !== id)) return null;
      const data = JSON.parse(await fetchOfficialIssuerText(`https://papi.aceetf.co.kr/api/funds/${encodeURIComponent(id)}/pdf?page=1&size=1000`, "ace", options)) as unknown;
      basket = parseAceIssuerHoldings(data);
    } else if (product.family === "kiwoom") {
      if (url.pathname !== "/service/etf/KO02010200M" || url.searchParams.getAll("gcode").length !== 1 || url.searchParams.get("gcode")?.toUpperCase() !== ticker || (product.productId && product.productId.toUpperCase() !== ticker)) return null;
      const data = JSON.parse(await fetchOfficialIssuerText("https://www.kiwoometf.com/service/etf/KO02010200MAjax4", "kiwoom", options, {
        method: "POST", headers: { "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: new URLSearchParams({ schGubun1: ticker, startDate: koreanToday() }).toString(),
      })) as unknown;
      basket = parseKiwoomIssuerHoldings(data);
    } else if (product.family === "koact") {
      const id = url.searchParams.get("id");
      if (url.pathname !== "/etf/view.do" || url.searchParams.getAll("id").length !== 1 || !safeId(id) || (product.productId && product.productId !== id)) return null;
      const metadata = JSON.parse(await fetchOfficialIssuerText(`https://www.samsungactive.co.kr/api/v1/product/etf/${encodeURIComponent(id)}.do`, "koact", options)) as unknown;
      if (!metadataMatches(metadata, ticker, id)) return null;
      const referenceDate = koActIssuerReferenceDate(metadata);
      if (!referenceDate) return null;
      const data = JSON.parse(await fetchOfficialIssuerText(`https://www.samsungactive.co.kr/api/v1/product/etf-pdf/${encodeURIComponent(id)}.do?gijunYMD=${referenceDate.replace(/-/g, ".")}`, "koact", options)) as unknown;
      if (!metadataMatches(data, ticker, id)) return null;
      basket = parseKoActIssuerHoldings(data);
    }
    return basket ? { ...basket, issuerUrl: product.issuerUrl } : null;
  } catch { return null; }
}
