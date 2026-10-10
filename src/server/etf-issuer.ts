/** Official issuer product discovery. A homepage/search result is never a product link. */
import { matchIbkProductId, normalizeIssuerFundName, parseHanaroFundCatalog, parseRiseFundCdFromFinder } from "./etf-holdings-parse.ts";

export type EtfIssuerFamily = "kodex" | "tiger" | "rise" | "ace" | "sol" | "plus" | "hanaro" | "ibk" | "timefolio" | "kiwoom" | "won" | "oneq" | "koact" | "focus" | "bnk" | "hk" | "mighty" | "trex" | "truston" | "unknown";
export interface EtfIssuerProduct {
  family: EtfIssuerFamily;
  issuerName: string;
  issuerUrl: string | null;
  websiteUrl: string | null;
  status: "resolved" | "unresolved" | "unsupported";
  /** Issuer's own product identifier, extracted only from a verified product link. */
  productId?: string;
  reason?: string;
}
export interface IssuerRequestOptions { fetcher?: typeof fetch; timeoutMs?: number; signal?: AbortSignal }

type IssuerConfig = { family: EtfIssuerFamily; name: string; website: string; hosts: string[]; brand: RegExp; house: RegExp; catalogs?: string[] };
const ISSUERS: IssuerConfig[] = [
  { family: "koact", name: "삼성액티브자산운용", website: "https://www.samsungactive.co.kr/", hosts: ["www.samsungactive.co.kr", "samsungactive.co.kr"], brand: /^KoAct\b/i, house: /삼성액티브/ },
  { family: "kodex", name: "삼성자산운용", website: "https://www.samsungfund.com/etf/main.do", hosts: ["www.samsungfund.com"], brand: /^KODEX\b/i, house: /삼성자산운용/ },
  { family: "tiger", name: "미래에셋자산운용", website: "https://investments.miraeasset.com/tigeretf/ko/main/index.do", hosts: ["investments.miraeasset.com", "www.tigeretf.com", "tigeretf.com"], brand: /^TIGER\b/i, house: /미래에셋/ },
  { family: "rise", name: "KB자산운용", website: "https://kbam.co.kr/", hosts: ["kbam.co.kr", "www.kbam.co.kr", "www.riseetf.co.kr", "riseetf.co.kr"], brand: /^(RISE|KBSTAR|KBRISE)\b/i, house: /KB자산|케이비자산/, catalogs: ["https://www.riseetf.co.kr/prod/finder"] },
  { family: "ace", name: "한국투자신탁운용", website: "https://www.aceetf.co.kr/", hosts: ["www.aceetf.co.kr", "aceetf.co.kr", "papi.aceetf.co.kr"], brand: /^(ACE|KINDEX)\b/i, house: /한국투자신탁/ },
  { family: "sol", name: "신한자산운용", website: "https://www.soletf.com/", hosts: ["www.soletf.com", "soletf.com"], brand: /^SOL\b/i, house: /신한자산/ },
  { family: "plus", name: "한화자산운용", website: "https://www.plusetf.co.kr/", hosts: ["www.plusetf.co.kr", "plusetf.co.kr"], brand: /^(PLUS|ARIRANG)\b/i, house: /한화자산/ },
  { family: "hanaro", name: "NH-Amundi자산운용", website: "https://www.hanaroetf.com/", hosts: ["www.hanaroetf.com", "hanaroetf.com"], brand: /^HANARO\b/i, house: /NH-?\s*Amundi|NH아문디|엔에이치아문디/i },
  { family: "ibk", name: "IBK자산운용", website: "https://www.ibkasset.com/", hosts: ["www.ibkasset.com", "ibkasset.com"], brand: /^IBK\b/i, house: /IBK자산|아이비케이/ },
  { family: "timefolio", name: "타임폴리오자산운용", website: "https://timeetf.co.kr/", hosts: ["timeetf.co.kr", "www.timeetf.co.kr"], brand: /^(TIMEFOLIO|TIME)\b/i, house: /타임폴리오/, catalogs: ["https://timeetf.co.kr/m11.php"] },
  { family: "kiwoom", name: "키움투자자산운용", website: "https://www.kiwoometf.com/", hosts: ["www.kiwoometf.com", "kiwoometf.com"], brand: /^(KIWOOM|KOSEF)\b/i, house: /키움/ },
  { family: "won", name: "우리자산운용", website: "https://www.wooriam.kr/", hosts: ["www.wooriam.kr", "wooriam.kr"], brand: /^(WON|WOORI)\b/i, house: /우리자산/ },
  { family: "oneq", name: "하나자산운용", website: "https://www.1qetf.com/", hosts: ["www.1qetf.com", "1qetf.com"], brand: /^1Q\b/i, house: /하나자산/ },
  { family: "focus", name: "브이아이자산운용", website: "https://www.viamc.kr/", hosts: ["www.viamc.kr", "viamc.kr"], brand: /^FOCUS\b/i, house: /브이아이|VI자산/i },
  { family: "bnk", name: "BNK자산운용", website: "https://www.bnkasset.co.kr/", hosts: ["www.bnkasset.co.kr", "bnkasset.co.kr"], brand: /^BNK\b/i, house: /BNK자산|비엔케이/i },
  { family: "hk", name: "흥국자산운용", website: "https://www.hkfund.co.kr/", hosts: ["www.hkfund.co.kr", "hkfund.co.kr"], brand: /^HK\b/i, house: /흥국자산/ },
  { family: "mighty", name: "DB자산운용", website: "https://www.dbasset.co.kr/", hosts: ["www.dbasset.co.kr", "dbasset.co.kr"], brand: /^마이티/, house: /DB자산|디비자산/ },
  { family: "trex", name: "유리자산운용", website: "https://www.yurieasset.co.kr/", hosts: ["www.yurieasset.co.kr", "yurieasset.co.kr"], brand: /^TREX\b/i, house: /유리자산/ },
  { family: "truston", name: "트러스톤자산운용", website: "https://www.trustonasset.com/", hosts: ["www.trustonasset.com", "trustonasset.com"], brand: /^TRUSTON\b/i, house: /트러스톤/ },
];

function configFor(family: EtfIssuerFamily): IssuerConfig | undefined { return ISSUERS.find((x) => x.family === family); }
export function etfIssuerIdentity(name: string, issuer = ""): Omit<EtfIssuerProduct, "issuerUrl" | "status" | "reason"> {
  const config = ISSUERS.find((x) => x.brand.test(name.trim())) ?? ISSUERS.find((x) => x.house.test(issuer.trim()));
  return { family: config?.family ?? "unknown", issuerName: config?.name ?? issuer.trim(), websiteUrl: config?.website ?? null };
}

/** No caller-supplied destinations: discovery, redirects, and holdings share the same allowlist. */
export function isOfficialIssuerUrl(value: string, family: EtfIssuerFamily): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.port && !url.username && !url.password && Boolean(configFor(family)?.hosts.includes(url.hostname));
  } catch { return false; }
}

type OfficialProductReference = { url: URL; id: string };
// Explicit user-provided destination, independently verified against the issuer
// product HTML on 2026-10-10: exact code 0246X0 and SOL 글로벌DRAM반도체플러스.
// Keeps the official action available if a cold catalog lookup exceeds its deadline.
const VERIFIED_PRODUCT_DESTINATIONS: Partial<Record<EtfIssuerFamily, Record<string, string>>> = {
  sol: { "0246X0": "https://www.soletf.com/ko/fund/etf/211124" },
};
function officialProductReference(value: string | null | undefined, family: EtfIssuerFamily, ticker: string): OfficialProductReference | null {
  if (!value || !isOfficialIssuerUrl(value, family)) return null;
  const url = new URL(value);
  const path = url.pathname.replace(/\/$/, "");
  const parameter = (key: string): string | null => {
    const values = url.searchParams.getAll(key);
    return values.length === 1 && /^[A-Za-z0-9_-]{1,80}$/.test(values[0]!) ? values[0]! : null;
  };
  let id: string | null = null;
  if (family === "kodex") id = path === "/etf/product/view.do" ? parameter("id") : null;
  else if (family === "koact") id = path === "/etf/view.do" ? parameter("id") : null;
  else if (family === "sol") id = /^\/ko\/fund\/etf\/(\d+)$/.exec(path)?.[1] ?? null;
  else if (family === "plus") id = path === "/product/detail" ? parameter("n") : null;
  else if (family === "ace" || family === "hanaro") id = /^\/fund\/([A-Za-z0-9_-]{1,80})$/.exec(path)?.[1] ?? null;
  else if (family === "ibk") id = /^\/etf\/detail\/(\d+)$/.exec(path)?.[1] ?? null;
  else if (family === "rise") {
    id = ["kbam.co.kr", "www.kbam.co.kr"].includes(url.hostname)
      ? /^\/products\/([A-Za-z0-9_-]{1,80})$/.exec(path)?.[1] ?? null
      : /^\/prod\/finderDetail\/([A-Za-z0-9_-]{1,80})$/.exec(path)?.[1] ?? null;
  } else if (family === "tiger") {
    id = path === "/tigeretf/ko/product/search/detail/index.do" ? parameter("ksdFund") : null;
    if (id !== krxEtfIsin(ticker)) return null;
  } else if (family === "kiwoom") {
    id = path === "/service/etf/KO02010200M" ? parameter("gcode") : null;
    if (id?.toUpperCase() !== ticker) return null;
  } else {
    // The generic resolver already verifies the ticker on the official detail page.
    // Its route must still identify a product rather than an API, search or download.
    if (/\/(?:api|search|download)(?:\/|$)|\.(?:pdf|xlsx?|csv)$/i.test(path) || !detailUrl(value, value, family)) return null;
    id = ["id", "n", "idx", "fundCd", "fundCode"].map(parameter).find(Boolean) ?? null;
    if (!id) {
      const segment = path.split("/").at(-1);
      id = segment && /^[A-Za-z0-9_-]{1,80}$/.test(segment) && !/^(?:detail|view|overview|index)$/i.test(segment) ? segment : null;
    }
  }
  if (!id) return null;
  // Fragments from upstream URLs are not evidence that a holdings section exists.
  url.hash = "";
  return { url, id };
}

/**
 * Select one holdings action from URLs verified by the official issuer adapters.
 * This does not discover or certify arbitrary caller-supplied URLs: the ticker-to-
 * product pairing must already come from resolveEtfIssuer or an issuer basket.
 */
export function officialHoldingsDestination(code: string, name: string, issuer = "", productUrl?: string | null, holdingsUrl?: string | null): string | null {
  const ticker = code.trim().toUpperCase();
  if (!/^[0-9A-Z]{6}$/.test(ticker)) return null;
  const { family } = etfIssuerIdentity(name, issuer);
  if (family === "unknown") return null;
  const product = officialProductReference(productUrl, family, ticker);
  const holdings = officialProductReference(holdingsUrl, family, ticker);
  const destination = (holdings && (!product || holdings.id === product.id) ? holdings : product)
    ?? officialProductReference(VERIFIED_PRODUCT_DESTINATIONS[family]?.[ticker], family, ticker);
  if (!destination) return null;
  // Verified 2026-10-10 on official HANARO product HTML: the investment PDF link
  // points to #etfPDF and the same page contains <div id="etfPDF">.
  if (family === "hanaro") destination.url.hash = "etfPDF";
  return destination.url.href;
}

export async function fetchOfficialIssuerBytes(url: string, family: EtfIssuerFamily, options: IssuerRequestOptions = {}, init: RequestInit = {}): Promise<Uint8Array> {
  if (!isOfficialIssuerUrl(url, family)) throw new Error("Unsupported official issuer destination");
  if (options.signal?.aborted) throw new Error("Issuer lookup deadline exceeded");
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  try {
    let current = url;
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await (options.fetcher ?? fetch)(current, { ...init, redirect: "manual", signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; KoreaEquityCommand/1.0)", Accept: "application/json,text/html,*/*", Referer: configFor(family)!.website, ...init.headers } });
      if (response.status >= 300 && response.status < 400) {
        const next = new URL(response.headers.get("Location") ?? "", current).href;
        if (!isOfficialIssuerUrl(next, family)) throw new Error("Unsupported issuer redirect");
        current = next;
        continue;
      }
      if (!response.ok) throw new Error(`Official issuer HTTP ${response.status}`);
      if (Number(response.headers.get("Content-Length")) > 3_000_000) throw new Error("Issuer response exceeds limit");
      const body = new Uint8Array(await response.arrayBuffer());
      if (body.byteLength > 3_000_000) throw new Error("Issuer response exceeds limit");
      return body;
    }
    throw new Error("Issuer redirect limit exceeded");
  } finally { clearTimeout(timer); }
}
export async function fetchOfficialIssuerText(url: string, family: EtfIssuerFamily, options: IssuerRequestOptions = {}, init: RequestInit = {}): Promise<string> {
  return new TextDecoder().decode(await fetchOfficialIssuerBytes(url, family, options, init));
}

function textOnly(value: string): string { return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim(); }
function containsCode(html: string, code: string): boolean { return new RegExp(`(?:^|[^A-Z0-9])${code}(?:$|[^A-Z0-9])`, "i").test(html); }
function detailUrl(value: string, base: string, family: EtfIssuerFamily): string | null {
  try {
    const url = new URL(value.replace(/&amp;/g, "&"), base);
    if (!isOfficialIssuerUrl(url.href, family)) return null;
    if (!/(?:\/(?:detail|finderDetail|view|[A-Z0-9]+_view)(?:[./]|$)|\/fund\/[A-Z0-9]+(?:\/|$)|\/etf\/\d+|\/products\/[A-Z0-9]+$)/i.test(url.pathname)) return null;
    if (/view\.do$|view\.php$|detail\.do$/i.test(url.pathname) && ![...url.searchParams].length) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}

/** Match a ticker and its link in the same row/card; never the nearest unrelated link. */
export function parseIssuerProductLinks(html: string, code: string, baseUrl: string, family: EtfIssuerFamily): string[] {
  if (!/^[A-Z0-9]{6}$/.test(code) || !isOfficialIssuerUrl(baseUrl, family)) return [];
  const links = new Set<string>();
  const anchors = (block: string) => [...block.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const anchor of anchors(html)) {
    if (!containsCode(textOnly(anchor[2]!), code)) continue;
    const href = detailUrl(anchor[1]!, baseUrl, family);
    if (href) links.add(href);
  }
  for (const row of html.matchAll(/<(tr|li|article)\b[^>]*>[\s\S]*?<\/\1>/gi)) {
    if (!containsCode(textOnly(row[0]), code)) continue;
    // Multiple product codes in a nested collection do not establish a pairing.
    const codes = new Set(textOnly(row[0]).match(/\b[0-9][A-Z0-9]{5}\b/gi) ?? []);
    if (codes.size > 1) continue;
    const rowLinks = [...new Set(anchors(row[0]).map((x) => detailUrl(x[1]!, baseUrl, family)).filter((x): x is string => Boolean(x)))];
    if (rowLinks.length === 1) links.add(rowLinks[0]!);
  }
  return [...links];
}

/** Verify product identity outside portfolio tables, where another ETF's ticker may occur. */
export function hasIssuerProductIdentity(html: string, code: string, name: string): boolean {
  if (!/^[0-9A-Z]{6}$/.test(code)) return false;
  const productArea = html.replace(/<(nav|aside|footer|script|style)\b[\s\S]*?<\/\1>/gi, " ").replace(/<table\b[\s\S]*?<\/table>/gi, (table) => /(?:종목명|편입종목|구성종목|보유종목|security\s*name)/i.test(textOnly(table)) && /(?:비중|수량|weight|quantity)/i.test(textOnly(table)) ? " " : table);
  if (!containsCode(textOnly(productArea), code)) return false;
  const labeledCodes = [...textOnly(productArea).matchAll(/(?:종목코드|거래소코드|상장코드|단축코드|ticker)\s*[:：]?\s*([A-Z0-9]{6})(?![A-Z0-9])/gi)].map((x) => x[1]!.toUpperCase());
  // The first product metadata code outranks later related-product widgets.
  if (labeledCodes.length) return labeledCodes[0] === code;
  const key = normalizeIssuerFundName(name);
  if (key.length < 4) return false;
  const headings = [...productArea.matchAll(/<(h1|h2)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((x) => textOnly(x[2]!));
  const fundHeadings = headings.filter((heading) => ISSUERS.some((issuer) => issuer.brand.test(heading)) && !/^(?:KODEX|TIGER|RISE|KBSTAR|ACE|KINDEX|SOL|PLUS|ARIRANG|HANARO|IBK|TIMEFOLIO|TIME|KIWOOM|KOSEF|WON|WOORI|1Q|KOACT)(?:ETF|ETFS|전체ETF|전체상품|ETF상품|상품안내)?$/i.test(normalizeIssuerFundName(heading)));
  const primary = fundHeadings[0] ?? textOnly(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(productArea)?.[1] ?? "");
  return primary.split(/\s*[|·–]\s*/).some((segment) => {
    const normalized = normalizeIssuerFundName(segment);
    return normalized === key || normalized === `${key}ETF`;
  });
}

// Standard Korean ETF ISIN form, used only as a candidate before official page identity validation.
export function krxEtfIsin(code: string): string | null {
  if (!/^[0-9A-Z]{6}$/.test(code)) return null;
  const prefix = `KR7${code}00`;
  const digits = [...prefix].map((x) => /[A-Z]/.test(x) ? String(x.charCodeAt(0) - 55) : x).join("") + "0";
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2) digit *= 2;
    sum += digit > 9 ? digit - 9 : digit;
  }
  return `${prefix}${(10 - sum % 10) % 10}`;
}

type Catalog = Map<string, string>;
type CatalogState = { at: number; map: Catalog; nextPage: number; complete: boolean; pending?: Promise<void> };
const catalogCache = new Map<EtfIssuerFamily, CatalogState>();
async function readCatalogPage(family: EtfIssuerFamily, state: CatalogState, options: IssuerRequestOptions): Promise<void> {
    const map = state.map;
    const page = state.nextPage;
    if (family === "kodex") {
        const rows = JSON.parse(await fetchOfficialIssuerText(`https://www.samsungfund.com/api/v1/kodex/product.do?ordrColm=NAV&ordrSort=DESC&pageNo=${page}&pageRows=20&srchTerm=w`, family, options)) as { stkTicker?: string; fId?: string; totalCnt?: string }[];
        for (const row of rows) if (row.stkTicker && row.fId) map.set(row.stkTicker.toUpperCase(), `https://www.samsungfund.com/etf/product/view.do?id=${encodeURIComponent(row.fId)}`);
        state.complete = !rows.length || page * 20 >= Number(rows[0]?.totalCnt ?? rows.length) || page >= 30;
    } else if (family === "hanaro") {
        const chunk = parseHanaroFundCatalog(await fetchOfficialIssuerText(`https://www.hanaroetf.com/api/v1/fund/get-fund-search-list?pageNo=${page}`, family, options));
        for (const [code, id] of chunk) map.set(code, `https://www.hanaroetf.com/fund/${encodeURIComponent(id)}`);
        state.complete = chunk.size < 10 || page >= 25;
    } else if (family === "rise") {
        const pack = JSON.parse(await fetchOfficialIssuerText(`https://kbam.co.kr/api/products/etfs?page=${page}`, family, options)) as { page_items?: { krx_cd?: string; fund_cd?: string }[]; page_info?: { next_page?: number; total_page?: number } };
        for (const row of pack.page_items ?? []) if (row.krx_cd && row.fund_cd) map.set(row.krx_cd.toUpperCase(), `https://kbam.co.kr/products/${encodeURIComponent(row.fund_cd)}`);
        state.complete = !pack.page_info?.next_page || page >= Number(pack.page_info?.total_page ?? 1) || page >= 50;
    } else if (family === "koact") {
      // The live endpoint returns { totalCnt, etfs }, and defaults to only 20 rows.
        const pack = JSON.parse(await fetchOfficialIssuerText(`https://www.samsungactive.co.kr/api/v1/product/etf.do?pageNo=${page}&pageRows=100`, family, options)) as { totalCnt?: string; etfs?: unknown[] };
        const rows = catalogRecords(pack);
        for (const row of rows) {
          const code = String(row.stkTicker ?? "").trim().toUpperCase();
          const id = String(row.fId ?? "").trim();
          if (/^[0-9A-Z]{6}$/.test(code) && /^[A-Za-z0-9_-]{1,80}$/.test(id)) map.set(code, `https://www.samsungactive.co.kr/etf/view.do?id=${encodeURIComponent(id)}`);
        }
        state.complete = !rows.length || page * 100 >= Number(pack.totalCnt ?? rows.length) || page >= 30;
    } else if (family === "ace") {
      const endpoint = "https://papi.aceetf.co.kr/api/funds?page=1&size=1000";
      const pack = JSON.parse(await fetchOfficialIssuerText(endpoint, family, options)) as unknown;
      for (const row of catalogRecords(pack)) {
        const rawCode = String(row.stockCd ?? row.isin ?? row.stkTicker ?? row.stk_ticker ?? row.ticker ?? "").trim().toUpperCase();
        const code = /^KR7[0-9A-Z]{6}00\d$/.test(rawCode) ? rawCode.slice(3, 9) : rawCode;
        const id = String(row.fundCd ?? row.fund_cd ?? row.fId ?? "").trim();
        if (!/^[0-9A-Z]{6}$/.test(code) || !id) continue;
        map.set(code, `https://www.aceetf.co.kr/fund/${encodeURIComponent(id)}`);
      }
      state.complete = true;
    } else {
      state.complete = true;
    }
    // Advance only after a successful page; interrupted lookups retry this page.
    state.nextPage = page + 1;
}
async function officialCatalog(family: EtfIssuerFamily, wantedCode: string, options: IssuerRequestOptions): Promise<Catalog> {
  const previous = !options.fetcher ? catalogCache.get(family) : null;
  const state = previous && Date.now() - previous.at < 6 * 60 * 60_000
    ? previous
    : { at: Date.now(), map: new Map<string, string>(), nextPage: 1, complete: false } as CatalogState;
  if (!options.fetcher) catalogCache.set(family, state);
  // A partial catalog is reusable for known tickers, and continues for a missing
  // ticker. Requests share one page fetch rather than replacing in-flight state.
  while (!state.map.has(wantedCode) && !state.complete) {
    if (options.signal?.aborted) throw new Error("Issuer lookup deadline exceeded");
    if (!state.pending) {
      const pending = readCatalogPage(family, state, options).finally(() => {
        if (state.pending === pending) state.pending = undefined;
      });
      state.pending = pending;
    }
    await waitForCatalogPage(state.pending, options.signal);
  }
  return state.map;
}
async function waitForCatalogPage(pending: Promise<void>, signal?: AbortSignal): Promise<void> {
  if (!signal) return pending;
  if (signal.aborted) throw new Error("Issuer lookup deadline exceeded");
  let stopWaiting = () => {};
  const interrupted = new Promise<never>((_resolve, reject) => {
    stopWaiting = () => reject(new Error("Issuer lookup deadline exceeded"));
    signal.addEventListener("abort", stopWaiting, { once: true });
  });
  try { await Promise.race([pending, interrupted]); }
  finally { signal.removeEventListener("abort", stopWaiting); }
}
function catalogRecords(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 6 || value == null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((x) => catalogRecords(x, depth + 1));
  const record = value as Record<string, unknown>;
  if (["stockCd", "isin", "stkTicker", "stk_ticker", "ticker"].some((x) => x in record)) return [record];
  return ["data", "funds", "etfs", "content", "list", "items"].flatMap((key) => catalogRecords(record[key], depth + 1));
}

async function resolveStructured(code: string, name: string, family: EtfIssuerFamily, options: IssuerRequestOptions): Promise<string | null> {
  if (["kodex", "hanaro", "rise", "ace", "koact"].includes(family)) return (await officialCatalog(family, code, options)).get(code) ?? null;
  if (family === "plus") {
    const data = JSON.parse(await fetchOfficialIssuerText("https://www.plusetf.co.kr/api/v1/product/find/list", family, options, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ searchSortTy: "", searchSort: "DESC", page: 0, searchAnnuityOptionTy: null, searchWord: code }) })) as { content?: { id?: string; nameCode?: string }[] };
    const row = data.content?.find((x) => x.nameCode?.toUpperCase() === code);
    return row?.id ? `https://www.plusetf.co.kr/product/detail?n=${encodeURIComponent(row.id)}` : null;
  }
  if (family === "ibk") {
    const data = JSON.parse(await fetchOfficialIssuerText("https://www.ibkasset.com/api/etf", family, options)) as { data?: { content?: { id: number; name: string; code?: string; ticker?: string }[] } };
    const rows = data.data?.content ?? [];
    const codeHit = rows.find((x) => (x.code ?? x.ticker)?.toUpperCase() === code);
    const nameId = matchIbkProductId(name, rows);
    const nameHit = rows.find((x) => x.id === nameId);
    // Prefix similarity is insufficient for a direct link (e.g. two hedged share classes).
    const id = codeHit?.id ?? (nameHit && normalizeIssuerFundName(nameHit.name) === normalizeIssuerFundName(name) ? nameHit.id : null);
    return id != null ? `https://www.ibkasset.com/etf/detail/${id}` : null;
  }
  if (family === "sol") {
    const { resolveSolProduct } = await import("./etf-sol.ts");
    return (await resolveSolProduct(code, options))?.issuerUrl ?? null;
  }
  return null;
}

async function discoverProduct(code: string, name: string, family: EtfIssuerFamily, options: IssuerRequestOptions): Promise<string | null> {
  const config = configFor(family)!;
  const pages = new Set(config.catalogs ?? [config.website]);
  if (family === "rise") pages.add(`https://www.riseetf.co.kr/prod/finder?searchText=${code}`);
  const candidates = new Set<string>();
  if (family === "tiger") candidates.add(`https://investments.miraeasset.com/tigeretf/ko/product/search/detail/index.do?ksdFund=${krxEtfIsin(code)}`);
  if (family === "kiwoom") candidates.add(`https://www.kiwoometf.com/service/etf/KO02010200M?gcode=${code}`);
  for (const candidate of candidates) {
    const html = await fetchOfficialIssuerText(candidate, family, options).catch(() => "");
    if (html && hasIssuerProductIdentity(html, code, name)) return candidate;
  }
  let scanned = 0;
  for (const page of pages) {
    if (options.signal?.aborted) break;
    if (++scanned > 5) break;
    const html = await fetchOfficialIssuerText(page, family, options).catch(() => "");
    if (!html) continue;
    for (const link of parseIssuerProductLinks(html, code, page, family)) candidates.add(link);
    if (family === "rise") {
      const id = parseRiseFundCdFromFinder(html, code);
      if (id) candidates.add(`https://www.riseetf.co.kr/prod/finderDetail/${encodeURIComponent(id)}`);
    }
    // Discover an issuer's own product catalog from its navigation, without guessing product IDs.
    for (const anchor of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const label = textOnly(anchor[2]!);
      const cardTitle = /<[^>]+class=["'][^"']*\btit\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i.exec(anchor[2]!)?.[1];
      const normalized = normalizeIssuerFundName(cardTitle ? textOnly(cardTitle) : label);
      const nameKey = normalizeIssuerFundName(name);
      const namedLink = detailUrl(anchor[1]!, page, family);
      if (nameKey.length >= 4 && namedLink && (normalized === nameKey || (family === "timefolio" && (`TIME${normalized}` === nameKey || `TIMEFOLIO${normalized}` === nameKey)))) candidates.add(namedLink);
      if (!/ETF\s*상품|전체\s*상품|상품\s*찾기|ETF\s*목록|ETF\s*검색|상품\s*검색|ETF\s*한눈에|ETF\s*리스트/i.test(label)) continue;
      try { const href = new URL(anchor[1]!.replace(/&amp;/g, "&"), page).href; if (isOfficialIssuerUrl(href, family) && pages.size < 8) pages.add(href); } catch { /* Not a navigable link. */ }
    }
  }
  for (const candidate of [...candidates].slice(0, 5)) {
    if (options.signal?.aborted) break;
    const html = await fetchOfficialIssuerText(candidate, family, options).catch(() => "");
    if (html && hasIssuerProductIdentity(html, code, name)) return candidate;
  }
  return null;
}

const productCache = new Map<string, { at: number; value: EtfIssuerProduct }>();
function productIdentifier(url: string): string | undefined {
  const parsed = new URL(url);
  for (const key of ["id", "n", "ksdFund", "gcode", "idx"]) { const value = parsed.searchParams.get(key); if (value) return value; }
  return parsed.pathname.split("/").filter(Boolean).at(-1);
}
export async function resolveEtfIssuer(code: string, name: string, issuer = "", options: IssuerRequestOptions = {}): Promise<EtfIssuerProduct> {
  const identity = etfIssuerIdentity(name, issuer);
  const ticker = code.trim().toUpperCase();
  const base: EtfIssuerProduct = { ...identity, issuerUrl: null, status: identity.family === "unknown" ? "unsupported" : "unresolved" };
  if (!/^[0-9A-Z]{6}$/.test(ticker)) return { ...base, reason: "유효하지 않은 ETF 종목코드입니다." };
  if (identity.family === "unknown") return { ...base, reason: "발행사별 상품 주소 연결을 아직 지원하지 않습니다." };
  const key = `${identity.family}:${ticker}:${name}`;
  const cached = !options.fetcher ? productCache.get(key) : null;
  if (cached && Date.now() - cached.at < (cached.value.status === "resolved" ? 6 * 60 * 60_000 : 60_000)) return cached.value;
  const deadline = AbortSignal.timeout(10_000);
  options = { ...options, signal: options.signal ? AbortSignal.any([options.signal, deadline]) : deadline };
  let issuerUrl: string | null = null;
  try { issuerUrl = await resolveStructured(ticker, name, identity.family, options); } catch { /* A blocked/changed catalog is unresolved, never a fabricated URL. */ }
  if (!issuerUrl && !["kodex", "hanaro", "plus", "ibk", "sol", "ace", "koact"].includes(identity.family)) issuerUrl = await discoverProduct(ticker, name, identity.family, options).catch(() => null);
  const result: EtfIssuerProduct = issuerUrl && isOfficialIssuerUrl(issuerUrl, identity.family) ? { ...base, issuerUrl, productId: productIdentifier(issuerUrl), status: "resolved" } : { ...base, reason: "발행사 공식 상품 주소를 확인하지 못했습니다. 네트워크 접근 또는 발행사 페이지 구조를 확인해야 합니다." };
  if (!options.fetcher) productCache.set(key, { at: Date.now(), value: result });
  return result;
}
