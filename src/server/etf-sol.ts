/**
 * SOL issuer catalog/PDF APIs. Server-only: import from server handlers, never UI.
 * API schema independently documented by the public scraper at:
 * https://github.com/minguisstockgoat/passive-etf-dashboard/blob/main/scripts/fetchers.py
 * Use runtime official ETF_CD6/FUND_CD identity; never copy its cached weights,
 * product IDs or its disabled TLS verification. HTML discovery is a fallback.
 * The managed environment currently blocks this issuer, so live access remains
 * independently verifiable after the official host is allowed. A blocked fetch,
 * JS-only table, missing date or unmatched code yields null, never guessed data.
 */
import { krCodeFromIsin, type ParsedCuRow } from "./etf-holdings-parse.ts";

export const SOL_WEBSITE_URL = "https://www.soletf.com";

export type SolProduct = {
  code: string;
  productId: string | null;
  name: string;
  issuerUrl: string;
};

export type SolOfficialHoldings = SolProduct & {
  rows: ParsedCuRow[];
  asOf: string;
  source: string;
};

export type SolFetchOptions = {
  fetcher?: typeof fetch;
  /** Bounded catalog traversal, not a whole-site crawl. */
  maxPages?: number;
  maxCatalogPages?: number;
  timeoutMs?: number;
  /** One deadline across catalog, detail and fallback requests. */
  deadlineMs?: number;
  signal?: AbortSignal;
  /** Custom fetchers bypass the shared cache unless explicitly requested. */
  catalogCache?: boolean;
};

function timedRequest(options: SolFetchOptions): {
  controller: AbortController;
  dispose: () => void;
} {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, options.timeoutMs ?? 10_000);
  return {
    controller,
    dispose: () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    },
  };
}

async function withinDeadline<T>(
  options: SolFetchOptions,
  action: (bounded: SolFetchOptions) => Promise<T | null>,
): Promise<T | null> {
  if (options.signal?.aborted) return null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, options.deadlineMs ?? 10_000);
  let removeAbort = () => {};
  const aborted = new Promise<null>((resolve) => {
    const onAbort = () => resolve(null);
    controller.signal.addEventListener("abort", onAbort, { once: true });
    removeAbort = () => controller.signal.removeEventListener("abort", onAbort);
  });
  try {
    return await Promise.race([action({ ...options, signal: controller.signal }), aborted]);
  } finally {
    clearTimeout(timer);
    removeAbort();
    options.signal?.removeEventListener("abort", abort);
  }
}

function stripHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTicker(code: string): string | null {
  const ticker = code.trim().toUpperCase();
  return /^[0-9A-Z]{6}$/.test(ticker) ? ticker : null;
}

function sameIssuerUrl(raw: string, base: string): string | null {
  try {
    const url = new URL(raw.replace(/&amp;/g, "&"), base);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!["www.soletf.com", "soletf.com"].includes(url.hostname)) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function links(html: string, pageUrl: string): { url: string; text: string }[] {
  const out: { url: string; text: string }[] = [];
  for (const match of html.matchAll(
    /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const url = sameIssuerUrl(match[1]!, pageUrl);
    if (url) out.push({ url, text: stripHtml(match[2]!) });
  }
  return out;
}

function productId(url: string): string | null {
  return /\/fund\/etf\/([0-9]+)\/?(?:[?#]|$)/i.exec(url)?.[1] ?? null;
}

function isProductUrl(url: string): boolean {
  return productId(url) != null;
}

/** Catalog matches only nominate a URL; the detail page must verify the ticker. */
export function parseSolCatalog(html: string, ticker: string, pageUrl = SOL_WEBSITE_URL): string[] {
  const code = normalizeTicker(ticker);
  if (!code) return [];
  const exact = new RegExp(`(?:^|[^0-9A-Z])${code}(?:$|[^0-9A-Z])`, "i");
  const found = new Set<string>();
  for (const match of html.matchAll(
    /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const url = sameIssuerUrl(match[1]!, pageUrl);
    if (!url || !isProductUrl(url)) continue;
    // Some catalog cards put the code immediately after their title link.
    const after = html
      .slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 300)
      .split(/<a\b/i)[0]!;
    if (exact.test(stripHtml(`${match[0]} ${after}`))) found.add(url);
  }
  return [...found];
}

/** An exact code on the product page is mandatory; name similarity is insufficient. */
export function parseSolProductPage(
  html: string,
  ticker: string,
  pageUrl: string,
): SolProduct | null {
  const code = normalizeTicker(ticker);
  const issuerUrl = sameIssuerUrl(pageUrl, SOL_WEBSITE_URL);
  if (!code || !issuerUrl || !isProductUrl(issuerUrl)) return null;
  const text = stripHtml(html);
  const labeledCodes = [
    ...text.matchAll(/(?:종목|단축|거래소)\s*코드\s*[:：]?\s*([0-9A-Z]{6})(?![0-9A-Z])/gi),
  ].map((match) => match[1]!.toUpperCase());
  // A holdings table contains many security codes; it cannot establish ETF identity.
  if (labeledCodes[0] !== code) return null;
  const heading = [...html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => stripHtml(match[1]!))
    .find((value) => /SOL/i.test(value));
  const title = stripHtml(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  return { code, productId: productId(issuerUrl), name: heading ?? title, issuerUrl };
}

function numberCell(value: string): number | null {
  const text = value.replace(/,/g, "").replace(/%/g, "").trim();
  if (!text || !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return null;
  const valueNumber = Number(text);
  return Number.isFinite(valueNumber) ? valueNumber : null;
}

function normalizeDate(value: unknown): string | null {
  const text = String(value ?? "")
    .trim()
    .replace(/[.\-/]/g, "");
  if (!/^\d{8}$/.test(text)) return null;
  const date = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

export type SolPdfItem = {
  STOCK_CODE?: unknown;
  SEC_NM?: unknown;
  QTY?: unknown;
  /** Official evaluation in KRW; never used to reconstruct a percent. */
  PRICE?: unknown;
  WT_DISP?: unknown;
  WORK_DT?: unknown;
};

/** Current official PDF response. All dates must describe the same basket. */
export function parseSolPdfRows(
  items: SolPdfItem[],
  workDt: unknown,
): { rows: ParsedCuRow[]; asOf: string } | null {
  const asOf =
    workDt == null || String(workDt).trim() === ""
      ? normalizeDate(items[0]?.WORK_DT)
      : normalizeDate(workDt);
  if (!asOf) return null;
  const rows: ParsedCuRow[] = [];
  for (const item of items) {
    if (item == null || typeof item !== "object") return null;
    const nameKo = String(item.SEC_NM ?? "").trim();
    const security = String(item.STOCK_CODE ?? "")
      .trim()
      .toUpperCase();
    if (
      !nameKo ||
      /설정현금액|현금설정액|설정단위|^합계$|^총계$/.test(nameKo) ||
      security === "CASH00000001"
    )
      continue;
    if (item.WORK_DT != null && normalizeDate(item.WORK_DT) !== asOf) return null;
    const isin = /^[A-Z]{2}[A-Z0-9]{10}$/.test(security) ? security : null;
    rows.push({
      nameKo,
      weight: numberCell(String(item.WT_DISP ?? "")),
      quantity: numberCell(String(item.QTY ?? "")),
      code: /^[0-9A-Z]{6}$/.test(security) ? security : krCodeFromIsin(isin),
      isin,
      asOf,
    });
  }
  const sum = rows.reduce((total, row) => total + (row.weight ?? 0), 0);
  return rows.length && rows.every((row) => row.weight != null) && sum >= 99 && sum <= 101
    ? { rows, asOf }
    : null;
}

function dateNearTable(html: string, index: number, table: string): string | null {
  const nearby = `${html.slice(Math.max(0, index - 1800), index)} ${table}`;
  const text = stripHtml(nearby);
  const matches = [
    ...text.matchAll(
      /(?:기준일|기준\s*일자|구성\s*기준|PDF\s*기준일)\s*[:：]?\s*(\d{4})[.\-/]?(\d{2})[.\-/]?(\d{2})/gi,
    ),
  ];
  const hit = matches.at(-1);
  if (!hit) return null;
  const date = `${hit[1]}-${hit[2]}-${hit[3]}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

/** Published percent column only. Quantities/valuations never become weights. */
export function parseSolHoldingsHtml(html: string): { rows: ParsedCuRow[]; asOf: string } | null {
  for (const table of html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    const tableHtml = table[0];
    const allRows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...row[1]!.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
        stripHtml(cell[1]!),
      ),
    );
    const headerIndex = allRows.findIndex(
      (cells) =>
        cells.some((cell) => /종목명|보유종목|자산명/.test(cell)) &&
        cells.some((cell) => /비중|구성비율/.test(cell)),
    );
    if (headerIndex < 0) continue;
    const header = allRows[headerIndex]!;
    const nameIndex = header.findIndex((cell) => /종목명|보유종목|자산명/.test(cell));
    const weightIndex = header.findIndex((cell) => /비중|구성비율/.test(cell));
    const quantityIndex = header.findIndex((cell) => /수량|보유주식수/.test(cell));
    const codeIndex = header.findIndex((cell) => /종목코드|ISIN|표준코드/i.test(cell));
    const asOf = dateNearTable(html, table.index ?? 0, tableHtml);
    if (!asOf) continue;
    const rows: ParsedCuRow[] = [];
    for (const cells of allRows.slice(headerIndex + 1)) {
      const nameKo = cells[nameIndex] ?? "";
      const security = (codeIndex >= 0 ? (cells[codeIndex] ?? "") : "").toUpperCase();
      if (
        !nameKo ||
        /설정현금액|현금설정액|설정단위|^합계$|^총계$/.test(nameKo) ||
        security === "CASH00000001"
      )
        continue;
      const isin = /^[A-Z]{2}[A-Z0-9]{10}$/.test(security) ? security : null;
      rows.push({
        nameKo,
        weight: numberCell(cells[weightIndex] ?? ""),
        quantity: quantityIndex >= 0 ? numberCell(cells[quantityIndex] ?? "") : null,
        code: /^[0-9A-Z]{6}$/.test(security) ? security : krCodeFromIsin(isin),
        isin,
        asOf,
      });
    }
    // A partial or TOP10 table must not be presented as a full portfolio.
    const sum = rows.reduce((total, row) => total + (row.weight ?? 0), 0);
    if (rows.length && rows.every((row) => row.weight != null) && sum >= 99 && sum <= 101)
      return { rows, asOf };
  }
  return null;
}

async function getHtml(
  url: string,
  options: SolFetchOptions,
): Promise<{ html: string; url: string } | null> {
  if (options.signal?.aborted) return null;
  const { controller, dispose } = timedRequest(options);
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "User-Agent": "Mozilla/5.0 (compatible; KoreaEquityDesk/1.0)",
      },
    });
    if (!response.ok) return null;
    const finalUrl = sameIssuerUrl(response.url || url, url);
    if (!finalUrl) return null;
    return { html: await response.text(), url: finalUrl };
  } catch {
    return null;
  } finally {
    dispose();
  }
}

async function getJson<T>(url: string, options: SolFetchOptions): Promise<T | null> {
  if (options.signal?.aborted) return null;
  const { controller, dispose } = timedRequest(options);
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${SOL_WEBSITE_URL}/ko/fund/etf/pds`,
        "User-Agent": "Mozilla/5.0 (compatible; KoreaEquityDesk/1.0)",
      },
    });
    if (!response.ok || !sameIssuerUrl(response.url || url, url)) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    dispose();
  }
}

type SolCatalogPage = {
  items?: { ETF_CD6?: unknown; FUND_CD?: unknown; ETF_NAME?: unknown }[];
  /** The issuer's endpoint historically spells this field `toalPage`. */
  toalPage?: unknown;
  totalPage?: unknown;
};

const SOL_CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
// Product metadata can be reused; PDF baskets are always retrieved separately.
const catalogCache = new Map<number, { at: number; data: SolCatalogPage }>();
const catalogRequests = new Map<number, Promise<SolCatalogPage | null>>();

async function readCatalogPage(
  page: number,
  options: SolFetchOptions,
): Promise<SolCatalogPage | null> {
  if (options.signal?.aborted) return null;
  const url = `${SOL_WEBSITE_URL}/api/etf/pds?searchText=&page=${page}`;
  const useCache = options.catalogCache ?? !options.fetcher;
  if (!useCache) return getJson<SolCatalogPage>(url, options);
  const cached = catalogCache.get(page);
  if (cached && Date.now() - cached.at < SOL_CATALOG_TTL_MS) return cached.data;
  const pending = catalogRequests.get(page);
  if (pending) return pending;
  // A caller's cancellation must not cancel a shared catalog request used by
  // another ETF. Each waiter still has its own overall deadline.
  const promise = getJson<SolCatalogPage>(url, { ...options, signal: undefined })
    .then((data) => {
      if (data && Array.isArray(data.items) && data.items.length)
        catalogCache.set(page, { at: Date.now(), data });
      return data;
    })
    .finally(() => {
      catalogRequests.delete(page);
    });
  catalogRequests.set(page, promise);
  return promise;
}

async function findApiProduct(
  ticker: string,
  options: SolFetchOptions,
): Promise<SolProduct | null> {
  const code = normalizeTicker(ticker);
  if (!code) return null;
  const limit = Math.max(1, Math.min(options.maxCatalogPages ?? 32, 64));
  for (let page = 1; page <= limit; page++) {
    if (options.signal?.aborted) return null;
    const pack = await readCatalogPage(page, options);
    if (!pack || !Array.isArray(pack.items)) return null;
    const hits = pack.items.filter(
      (item) =>
        item != null &&
        typeof item === "object" &&
        String(item.ETF_CD6 ?? "")
          .trim()
          .toUpperCase() === code,
    );
    if (hits.length > 1) return null;
    if (hits.length === 1) {
      const fundCd = String(hits[0]!.FUND_CD ?? "").trim();
      const name = String(hits[0]!.ETF_NAME ?? "").trim();
      if (!/^\d{6}$/.test(fundCd) || !/SOL/i.test(name)) return null;
      return {
        code,
        productId: fundCd,
        name,
        issuerUrl: `${SOL_WEBSITE_URL}/ko/fund/etf/${fundCd}`,
      };
    }
    const totalPages = Number(pack.toalPage ?? pack.totalPage ?? 1);
    if (!pack.items.length || !Number.isFinite(totalPages) || page >= totalPages) return null;
  }
  return null;
}

async function verifyApiProductPage(
  product: SolProduct,
  options: SolFetchOptions,
): Promise<boolean> {
  const page = await getHtml(product.issuerUrl, options);
  if (!page || productId(page.url) !== product.productId) return false;
  const parsed = parseSolProductPage(page.html, product.code, page.url);
  if (parsed) return true;
  const text = stripHtml(page.html);
  const declaredCode = /(?:종목|단축|거래소)\s*코드\s*[:：]?\s*([0-9A-Z]{6})(?![0-9A-Z])/i
    .exec(text)?.[1]
    ?.toUpperCase();
  if (declaredCode && declaredCode !== product.code) return false;
  // The authoritative catalog proves identity; the page must still contain
  // that product rather than a generic 200-error page or a redirected homepage.
  return text.replace(/\s/g, "").includes(product.name.replace(/\s/g, ""));
}

async function discoverSolProduct(
  ticker: string,
  options: SolFetchOptions,
): Promise<{ product: SolProduct; html: string } | null> {
  const code = normalizeTicker(ticker);
  if (!code) return null;
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 4, 8));
  const queue = [`${SOL_WEBSITE_URL}/`];
  const visited = new Set<string>();
  const attemptedProducts = new Set<string>();
  while (queue.length && visited.size < maxPages) {
    if (options.signal?.aborted) return null;
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    const page = await getHtml(url, options);
    if (!page) continue;
    for (const detailUrl of parseSolCatalog(page.html, code, page.url)) {
      if (attemptedProducts.has(detailUrl) || attemptedProducts.size >= 4) continue;
      attemptedProducts.add(detailUrl);
      const detail = await getHtml(detailUrl, options);
      if (!detail) continue;
      const product = parseSolProductPage(detail.html, code, detail.url);
      if (product) return { product, html: detail.html };
    }
    const catalogLinks = links(page.html, page.url).filter(
      (link) =>
        !isProductUrl(link.url) &&
        /\/fund\//i.test(link.url) &&
        /ETF|상품|펀드|전체|목록/i.test(link.text),
    );
    for (const link of catalogLinks) if (!visited.has(link.url)) queue.push(link.url);
  }
  return null;
}

/** Returns only a verified exact product URL. No homepage/search URL fallback. */
export async function resolveSolProduct(
  ticker: string,
  options: SolFetchOptions = {},
): Promise<SolProduct | null> {
  return withinDeadline(options, async (bounded) => {
    const catalogProduct = await findApiProduct(ticker, bounded);
    if (catalogProduct && (await verifyApiProductPage(catalogProduct, bounded)))
      return catalogProduct;
    return (await discoverSolProduct(ticker, bounded))?.product ?? null;
  });
}

export async function fetchSolOfficialHoldings(
  ticker: string,
  options: SolFetchOptions = {},
): Promise<SolOfficialHoldings | null> {
  return withinDeadline(options, async (bounded) => {
    const catalogProduct = await findApiProduct(ticker, bounded);
    if (catalogProduct) {
      const pack = await getJson<{ workDt?: unknown; items?: SolPdfItem[] }>(
        `${SOL_WEBSITE_URL}/api/etf/pds/pdf/${catalogProduct.productId}`,
        bounded,
      );
      const basket =
        pack && Array.isArray(pack.items) ? parseSolPdfRows(pack.items, pack.workDt) : null;
      if (basket)
        return {
          ...catalogProduct,
          ...basket,
          source: `신한자산운용 SOL 일별 공식 구성종목 PDF (${basket.asOf})`,
        };
    }
    const found = await discoverSolProduct(ticker, bounded);
    if (!found) return null;
    const basket = parseSolHoldingsHtml(found.html);
    if (!basket) return null;
    return {
      ...found.product,
      ...basket,
      source: `신한자산운용 SOL 공식 구성종목 (${basket.asOf})`,
    };
  });
}
