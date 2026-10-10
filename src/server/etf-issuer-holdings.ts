/** Whole-fund holdings from verified issuer pages. Never revalue or normalize weights. */
import {
  isCompleteOfficialWeightSum,
  isCuNotionalName,
  normalizeIssuerFundName,
  sumNavWeights,
  type ParsedCuRow,
} from "./etf-holdings-parse.ts";
import {
  etfIssuerIdentity,
  fetchOfficialIssuerText,
  hasIssuerProductIdentity,
  isOfficialIssuerUrl,
  krxEtfIsin,
  type EtfIssuerProduct,
  type IssuerRequestOptions,
} from "./etf-issuer.ts";
import { fetchStructuredIssuerHoldings } from "./etf-issuer-json.ts";
import { fetchRiseSpreadsheetHoldings } from "./etf-issuer-spreadsheet.ts";

export type IssuerPageHoldings = { rows: ParsedCuRow[]; asOf: string; issuerUrl: string };
export type ParsedIssuerHoldingsPage = Omit<IssuerPageHoldings, "issuerUrl">;

function textOnly(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, value: string) => {
      const n = value[0]?.toLowerCase() === "x" ? Number.parseInt(value.slice(1), 16) : Number(value);
      return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : " ";
    })
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'")
    .replace(/\s+/g, " ").trim();
}

function number(value: string): number | null {
  const clean = value.replace(/,/g, "").replace(/\s*%\s*$/, "").trim();
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(clean)) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function date(value: string): string | null {
  const match = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(value.trim()) ?? /^(\d{4})(\d{2})(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (year < 2000 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function attribute(tag: string, name: string): string | null {
  return new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1] ?? null;
}

function portfolioDate(scope: string): string | null {
  const dates = new Set<string>();
  for (const match of textOnly(scope).matchAll(/(?:기준\s*일(?:자)?|기준\s*날짜|as\s+of|holdings\s+date)\s*[:：]?\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{8})/gi)) {
    const parsed = date(match[1]!);
    if (!parsed) return null;
    dates.add(parsed);
  }
  for (const match of scope.matchAll(/<input\b[^>]*>/gi)) {
    const names = [attribute(match[0], "id"), attribute(match[0], "name")];
    if (!names.some((id) => /^(pdfDate|fixDate|holdingsDate|portfolioDate)$/i.test(id ?? ""))) continue;
    const parsed = date(attribute(match[0], "value") ?? "");
    if (!parsed) return null;
    dates.add(parsed);
  }
  return dates.size === 1 ? [...dates][0]! : null;
}

const HOLDINGS_LABEL = /구성\s*종목|편입\s*종목|보유\s*종목|구성\s*내역|포트폴리오|(?:portfolio\s+)?holdings|constituents/i;
const PARTIAL_LABEL = /\btop\s*\d+\b|상위\s*\d+|주요\s*(?:편입\s*)?종목|일부\s*종목|top\s+holdings|partial\s+(?:portfolio|holdings)/i;
const TOTAL_NAME = /^(?:합계|총계|총합|비중합계|total|grand\s*total)(?:\s*\([^)]*\))?$/i;

function rowFromCells(cells: string[], indexes: { name: number; weight: number; quantity: number; code: number; isin: number }, asOf: string): ParsedCuRow | null | false {
  const nameKo = cells[indexes.name]?.trim() ?? "";
  if (!nameKo) return cells.every((cell) => !cell.trim()) ? null : false;
  if (isCuNotionalName(nameKo) || TOTAL_NAME.test(nameKo)) return null;
  const weight = number(cells[indexes.weight] ?? "");
  if (weight == null || Math.abs(weight) > 100) return false;
  const rawCode = (cells[indexes.isin] ?? cells[indexes.code] ?? "").trim().toUpperCase();
  const isin = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(rawCode) ? rawCode : null;
  const code = isin && /^KR7[0-9][A-Z0-9]{5}00\d$/.test(isin) ? isin.slice(3, 9) : /^[0-9][A-Z0-9]{5}$/.test(rawCode) ? rawCode : null;
  return { nameKo, weight, quantity: indexes.quantity >= 0 ? number(cells[indexes.quantity] ?? "") : null, code, isin, asOf };
}

function complete(rows: ParsedCuRow[]): boolean {
  if (!rows.length || !isCompleteOfficialWeightSum(sumNavWeights(rows))) return false;
  if (rows.some((row) => row.weight == null || !Number.isFinite(row.weight))) return false;
  const identities = rows.map((row) => row.isin ?? row.code ?? row.nameKo);
  return new Set(identities).size === identities.length;
}

function exactNameInHeadings(html: string, name: string): boolean {
  const key = normalizeIssuerFundName(name);
  if (key.length < 4) return false;
  const productArea = html.replace(/<table\b[\s\S]*?<\/table>/gi, " ");
  return [...productArea.matchAll(/<(title|h1|h2)\b[^>]*>([\s\S]*?)<\/\1>/gi)].some((match) =>
    textOnly(match[2]!).split(/\s*[|·–]\s*/).some((part) => {
      const normalized = normalizeIssuerFundName(part);
      return normalized === key || normalized === `${key}ETF`;
    }),
  );
}

/** Explicit columns, portfolio-scoped date, exact product identity, and a complete NAV basket. */
export function parseIssuerHoldingsPage(html: string, code: string, name: string): ParsedIssuerHoldingsPage | null {
  if (!/^[0-9A-Z]{6}$/.test(code) || html.length > 3_000_000) return null;
  const clean = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ");
  if (!hasIssuerProductIdentity(clean, code, name) || !exactNameInHeadings(clean, name)) return null;
  const candidates: ParsedIssuerHoldingsPage[] = [];
  let previousEnd = 0;
  for (const tableMatch of clean.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    const table = tableMatch[0], start = tableMatch.index!;
    let prefix = clean.slice(Math.max(previousEnd, start - 3_000), start);
    previousEnd = start + table.length;
    const headings = [...prefix.matchAll(/<h[2-6]\b[^>]*>[\s\S]*?<\/h[2-6]>/gi)];
    if (headings.length) prefix = prefix.slice(headings[headings.length - 1]!.index!);
    const caption = /<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(table)?.[1] ?? "";
    const context = `${prefix} ${caption}`;
    if (!HOLDINGS_LABEL.test(textOnly(context)) || PARTIAL_LABEL.test(textOnly(context))) continue;
    const asOf = portfolioDate(context);
    if (!asOf || /<table\b/i.test(table.slice(table.indexOf(">") + 1))) continue;
    const trs = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    let indexes: { name: number; weight: number; quantity: number; code: number; isin: number } | null = null;
    const rows: ParsedCuRow[] = [];
    let invalid = false;
    for (const tr of trs) {
      const tags = [...tr[1]!.matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)];
      const cells = tags.map((cell) => textOnly(cell[2]!));
      if (!indexes) {
        const headers = cells.map((cell) => cell.toLowerCase().replace(/\s+/g, ""));
        const nameIndex = headers.findIndex((cell) => /^(?:종목명|보유종목|편입종목|주식명|name|securityname|holdingname)$/.test(cell));
        const weightIndex = headers.findIndex((cell) => /^(?:비중|구성비율|구성비|편입비율)(?:\(%\)|%)?$/.test(cell) || /^(?:portfolio)?(?:weight|ratio)\(?%\)?$/.test(cell));
        if (nameIndex < 0 || weightIndex < 0) continue;
        if (tags.some((cell) => /(?:colspan|rowspan)\s*=\s*["']?(?:[2-9]|\d{2})/i.test(cell[1]!))) { invalid = true; break; }
        indexes = {
          name: nameIndex, weight: weightIndex,
          quantity: headers.findIndex((cell) => /^(?:수량|보유수량|quantity|shares)(?:\([^)]*\))?$/.test(cell)),
          code: headers.findIndex((cell) => /^(?:종목코드|단축코드|ticker|code|securitycode)$/.test(cell)),
          isin: headers.findIndex((cell) => /^(?:isin|표준코드|국제증권식별번호)$/.test(cell)),
        };
        continue;
      }
      if (!cells.length) continue;
      const row = rowFromCells(cells, indexes, asOf);
      if (row === false) { invalid = true; break; }
      if (row) rows.push(row);
    }
    if (!invalid && complete(rows)) candidates.push({ rows, asOf });
  }
  if (!candidates.length) return null;
  // Conflicting complete tables need a dedicated adapter; never guess which one is official.
  const first = candidates[0]!;
  return candidates.every((candidate) => JSON.stringify(candidate) === JSON.stringify(first)) ? first : null;
}

/** TIGER's published full PDF table has a documented fixed column order. */
export function parseTigerIssuerHoldings(html: string, asOf: string): ParsedIssuerHoldingsPage | null {
  if (!date(asOf) || PARTIAL_LABEL.test(textOnly(html.replace(/<tbody\b[\s\S]*?<\/tbody>/gi, " ")))) return null;
  // If the returned table names a day, it must agree with the issuer's PDF metadata.
  if (/(?:기준\s*일(?:자)?|as\s+of|holdings\s+date)|(?:id|name)\s*=\s*["'](?:pdfDate|fixDate|holdingsDate|portfolioDate)["']/i.test(html) && portfolioDate(html) !== asOf) return null;
  const rows: ParsedCuRow[] = [];
  for (const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => textOnly(cell[1]!));
    if (!cells.length) continue;
    if (cells.length < 5) return null;
    const row = rowFromCells(cells, { code: 0, isin: 0, name: 1, quantity: 2, weight: 4 }, asOf);
    if (row === false) return null;
    if (row) rows.push(row);
  }
  return complete(rows) ? { rows, asOf } : null;
}

async function fetchTigerHoldings(code: string, product: EtfIssuerProduct, options: IssuerRequestOptions): Promise<IssuerPageHoldings | null> {
  if (product.family !== "tiger" || !product.issuerUrl) return null;
  const isin = new URL(product.issuerUrl).searchParams.get("ksdFund");
  if (!isin || isin !== krxEtfIsin(code)) return null;
  const base = "https://investments.miraeasset.com/tigeretf/ko/product/search/detail";
  const init = (data: Record<string, string>): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest", Referer: product.issuerUrl! }, body: new URLSearchParams(data).toString() });
  const metadata = await fetchOfficialIssuerText(`${base}/pdf.ajax`, "tiger", options, init({ ksdFund: isin }));
  const asOf = portfolioDate(metadata);
  if (!asOf) return null;
  const html = await fetchOfficialIssuerText(`${base}/pdfListAjax.ajax`, "tiger", options, init({ ksdFund: isin, fixDate: asOf.replace(/-/g, "."), listCnt: "1000", pageIndex: "1", firstIndex: "0" }));
  const parsed = parseTigerIssuerHoldings(html, asOf);
  return parsed ? { ...parsed, issuerUrl: product.issuerUrl } : null;
}

/** Only a verified product URL and allowlisted issuer endpoints may supply publishable weights. */
export async function fetchIssuerPageHoldings(code: string, name: string, product: EtfIssuerProduct, options: IssuerRequestOptions = {}): Promise<IssuerPageHoldings | null> {
  if (!/^[0-9A-Z]{6}$/.test(code) || product.status !== "resolved" || !product.issuerUrl || !isOfficialIssuerUrl(product.issuerUrl, product.family)) return null;
  if (etfIssuerIdentity(name, product.issuerName).family !== product.family || options.signal?.aborted) return null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, Math.min(options.timeoutMs ?? 10_000, 10_000));
  const requestOptions = { ...options, signal: controller.signal };
  try {
    const spreadsheet = await fetchRiseSpreadsheetHoldings(code, name, product, requestOptions);
    if (spreadsheet) return spreadsheet;
    if (controller.signal.aborted) return null;
    const structured = await fetchStructuredIssuerHoldings(code, name, product, requestOptions);
    if (structured) return structured;
    if (controller.signal.aborted) return null;
    const page = await fetchOfficialIssuerText(product.issuerUrl, product.family, requestOptions);
    const parsed = parseIssuerHoldingsPage(page, code, name);
    if (parsed) return { ...parsed, issuerUrl: product.issuerUrl };
    if (!hasIssuerProductIdentity(page, code, name) || !exactNameInHeadings(page, name)) return null;
    return await fetchTigerHoldings(code, product, requestOptions);
  } catch { return null; }
  finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
