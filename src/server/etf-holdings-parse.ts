/** Pure ETF basket parsers — no network. */

export type ParsedCuRow = {
  nameKo: string;
  weight: number | null;
  quantity: number | null;
  asOf: string | null;
  code: string | null;
  isin: string | null;
};

function asKrCode(v: unknown): string | null {
  const s = String(v ?? "").trim().toUpperCase();
  return /^[0-9A-Z]{6}$/.test(s) ? s : null;
}

/** KRX equity ISIN KR7 + 6-digit ticker (e.g. KR7005930003 → 005930). */
export function krCodeFromIsin(isin: string | null | undefined): string | null {
  const s = String(isin ?? "").toUpperCase();
  const m = /^KR[0-9](\d{6})/.exec(s);
  return m ? asKrCode(m[1]) : null;
}

/** NH-Amundi HANARO fund list: ticker → product uid. */
export function parseHanaroFundCatalog(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const re =
    /href="\/fund\/([A-F0-9]+)"[^>]*class="baseInfo"([\s\S]{0,2500}?)종목코드<\/dt>\s*<dd>([0-9A-Z]{6})<\/dd>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const uid = m[1]!;
    const ticker = m[3]!.toUpperCase();
    if (uid && ticker) map.set(ticker, uid);
  }
  return map;
}

/** Default PDF date on a HANARO product page (`2026.09.23` → `2026-09-23`). */
export function parseHanaroPdfDate(html: string): string | null {
  const m = /id="pdfDate"[\s\S]{0,800}?value="(\d{4})\.(\d{2})\.(\d{2})"/.exec(html);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * HANARO `/api/v1/fund/{uid}/get-fund-holdings-list` HTML rows.
 * Column order: index, ISIN/code, name, quantity, eval KRW, weight %.
 * `설정현금액` is the CU total (always 100%), not a holding.
 */
export function parseHanaroHoldingsHtml(html: string, asOf: string | null): ParsedCuRow[] {
  const rows: ParsedCuRow[] = [];
  const re = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const cells = [...m[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((x) =>
      stripHtml(x[1] ?? ""),
    );
    if (cells.length < 6) continue;
    const codeRaw = (cells[1] ?? "").toUpperCase();
    const nameKo = cells[2] ?? "";
    if (!nameKo || isCuNotionalName(nameKo)) continue;
    const isin = /^[A-Z]{2}[A-Z0-9]{10}$/.test(codeRaw) ? codeRaw : null;
    rows.push({
      nameKo,
      weight: officialNum(cells[5] ?? ""),
      quantity: officialNum(cells[3] ?? ""),
      asOf,
      code: krCodeFromIsin(isin),
      isin,
    });
  }
  return rows;
}

export type LiveWeightRow = {
  nameKo: string;
  weight: number | null;
  weightSource: "official" | "live" | null;
  quantity: number | null;
  isCash: boolean;
  isBond: boolean;
  isFuture: boolean;
  quote: { price: number; currency: "KRW" | "USD" } | null;
};

/**
 * Quantity × retrieved price, only when every holding can be valued.
 * Does not run if any official NAV weight is already present.
 * A bond, future, or unquoted name blocks the whole basket so an equity
 * sleeve is never stretched to 100% (IBK 0238C0).
 */
export function fillLiveMarketWeights<T extends LiveWeightRow>(
  rows: T[],
  usdKrw: number,
): { rows: T[]; published: boolean } {
  if (rows.some((row) => row.weightSource === "official" && row.weight != null)) {
    return { rows, published: false };
  }
  if (!rows.length) return { rows, published: false };

  const values: number[] = [];
  for (const row of rows) {
    const value = liveHoldingValueKrw(row, usdKrw);
    if (value == null) return { rows, published: false };
    values.push(value);
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!(Math.abs(total) > 0)) return { rows, published: false };
  return {
    published: true,
    rows: rows.map((row, i) => ({
      ...row,
      weight: (values[i]! / total) * 100,
      weightSource: "live" as const,
    })),
  };
}

function liveHoldingValueKrw(row: LiveWeightRow, usdKrw: number): number | null {
  if (isCuNotionalName(row.nameKo)) return null;
  if (row.isCash) {
    if (row.quantity == null || !Number.isFinite(row.quantity)) return null;
    if (/달러|USD|외화/i.test(row.nameKo)) {
      if (!(usdKrw > 0)) return null;
      return row.quantity * usdKrw;
    }
    return row.quantity;
  }
  if (row.isBond || row.isFuture) return null;
  const price = row.quote?.price;
  if (price == null || !(price > 0) || row.quantity == null || !Number.isFinite(row.quantity)) {
    return null;
  }
  const fx = row.quote?.currency === "USD" ? usdKrw : 1;
  if (!(fx > 0)) return null;
  return row.quantity * price * fx;
}

/** CU notional / NAV header row — not a portfolio holding. */
export function isCuNotionalName(name: string): boolean {
  return /설정현금액|설정단위/.test(name);
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/&/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function officialNum(raw: string): number | null {
  const t = raw.replace(/,/g, "").replace(/%/g, "").trim();
  if (!t || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** `/prod/finderDetail/44L0" ... (0233N0)` */
export function parseRiseFundCdFromFinder(html: string, ticker: string): string | null {
  const t = ticker.toUpperCase();
  const re = new RegExp(
    `/prod/finderDetail/([0-9A-Za-z]+)["'][\\s\\S]{0,500}?\\(\\s*${t}\\s*\\)`,
    "i",
  );
  return re.exec(html)?.[1] ?? null;
}

export function parseRisePdfHoldingsHtml(
  html: string,
  asOf: string | null,
): ParsedCuRow[] {
  const rows: ParsedCuRow[] = [];
  const re =
    /<tr>\s*<th[^>]*>[\s\S]*?<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const nameKo = stripHtml(m[1] ?? "");
    const isin = stripHtml(m[2] ?? "") || null;
    const quantity = officialNum(stripHtml(m[3] ?? ""));
    const weight = officialNum(stripHtml(m[4] ?? ""));
    if (!nameKo || isCuNotionalName(nameKo)) continue;
    rows.push({
      nameKo,
      isin,
      code: krCodeFromIsin(isin),
      quantity,
      weight,
      asOf,
    });
  }
  return rows;
}

export function parseRiseTop10Html(html: string, asOf: string | null): ParsedCuRow[] {
  const cap = html.search(/TOP10 구성 종목/);
  if (cap < 0) return [];
  const slice = html.slice(cap, cap + 12_000);
  const tbody = slice.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? slice;
  const rows: ParsedCuRow[] = [];
  const re =
    /<tr>\s*<td[^>]*>[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tbody))) {
    const nameKo = stripHtml(m[1] ?? "");
    const weight = officialNum(stripHtml(m[2] ?? ""));
    if (!nameKo || isCuNotionalName(nameKo) || weight == null) continue;
    rows.push({
      nameKo,
      weight,
      quantity: null,
      asOf,
      code: null,
      isin: null,
    });
  }
  return rows;
}

/** Never derive NAV weights from quantity × live price.
 *
 * Rescaling the priced subset to 100% dropped bonds and cash and inflated
 * the rest. IBK 한미대표기업TOP2+채권혼합50액티브 (0238C0) was shown as
 * 삼성전자 35.11% / NVIDIA 33.48% while the issuer PDF is 24.51% / 23.65%.
 * Official percent-of-NAV is the only publishable weight.
 */
export function applyCuValueWeights<T>(rows: T[], _usdKrw?: number, _cuNavKrw?: number | null): T[] {
  return rows;
}

/** NAV weights are publishable only when they cover the whole fund. */
export const OFFICIAL_WEIGHT_SUM_MIN = 90;
export const OFFICIAL_WEIGHT_SUM_MAX = 110;

export function sumNavWeights(
  rows: { nameKo: string; weight: number | null }[],
): number {
  let sum = 0;
  for (const row of rows) {
    if (!row.nameKo || isCuNotionalName(row.nameKo)) continue;
    if (row.weight == null || !Number.isFinite(row.weight)) continue;
    sum += row.weight;
  }
  return sum;
}

export function isCompleteOfficialWeightSum(sum: number): boolean {
  return (
    Number.isFinite(sum) &&
    sum >= OFFICIAL_WEIGHT_SUM_MIN &&
    sum <= OFFICIAL_WEIGHT_SUM_MAX
  );
}

export function prepareOfficialRows<
  T extends { nameKo: string; weight: number | null; quantity?: number | null },
>(rows: T[]): T[] {
  return rows
    .filter((row) => {
      const name = String(row.nameKo ?? "").trim();
      return Boolean(name) && !isCuNotionalName(name);
    })
    .map((row) => ({ ...row, nameKo: String(row.nameKo).trim() }))
    .sort(compareHoldingsByWeight);
}

export type HoldingsSourceKind =
  | "issuer-pdf"
  | "wisereport-cu"
  | "naver-table"
  | "none";

export type BasketCandidate<
  T extends { nameKo: string; weight: number | null; quantity?: number | null },
> = {
  rows: T[];
  source: string;
  sourceKind: Exclude<HoldingsSourceKind, "none">;
  /** Higher wins. Issuer PDF outranks exchange CU tables. */
  priority: number;
  issuerUrl?: string | null;
  asOf?: string | null;
};

export type OfficialBasketChoice<
  T extends { nameKo: string; weight: number | null; quantity?: number | null },
> = {
  rows: T[];
  source: string;
  sourceKind: HoldingsSourceKind;
  issuerUrl: string | null;
  asOf: string | null;
  /** False → weights were stripped. A partial sleeve must not be shown as NAV %. */
  weightsPublished: boolean;
};

/**
 * Publish one basket. A candidate is usable only when its official weights
 * sum to about 100% of NAV. Otherwise keep the names and drop every weight
 * so a priced subset cannot be mistaken for the fund.
 */
export function chooseOfficialBasket<
  T extends { nameKo: string; weight: number | null; quantity?: number | null },
>(candidates: BasketCandidate<T>[]): OfficialBasketChoice<T> {
  const ranked = [...candidates].sort(
    (a, b) => b.priority - a.priority || b.rows.length - a.rows.length,
  );
  for (const candidate of ranked) {
    const rows = prepareOfficialRows(candidate.rows);
    if (!rows.length) continue;
    if (!isCompleteOfficialWeightSum(sumNavWeights(rows))) continue;
    return {
      rows,
      source: candidate.source,
      sourceKind: candidate.sourceKind,
      issuerUrl: candidate.issuerUrl ?? null,
      asOf: candidate.asOf ?? null,
      weightsPublished: true,
    };
  }
  for (const candidate of ranked) {
    const rows = prepareOfficialRows(candidate.rows).map((row) =>
      row.weight == null ? row : { ...row, weight: null },
    );
    if (!rows.length) continue;
    return {
      rows,
      source: `${candidate.source} · 공식 NAV 비중 없음 (추정 비중은 표시하지 않음)`,
      sourceKind: candidate.sourceKind,
      issuerUrl: candidate.issuerUrl ?? null,
      asOf: candidate.asOf ?? null,
      weightsPublished: false,
    };
  }
  return {
    rows: [],
    source: "공식 편입내역 없음",
    sourceKind: "none",
    issuerUrl: null,
    asOf: null,
    weightsPublished: false,
  };
}

export type IssuerHoldingsFamily = "kodex" | "ibk" | "plus" | "hanaro" | "other";

/** Which issuer PDF to request. Never guesses a family from a holding name. */
export function issuerHoldingsFamily(
  etfName: string,
  issuer: string,
): IssuerHoldingsFamily {
  const name = etfName.trim();
  const house = issuer.trim();
  if (/^KODEX\b/i.test(name) || (/삼성자산운용/.test(house) && /KODEX/i.test(name))) {
    return "kodex";
  }
  if (/^IBK\b/i.test(name) || /IBK자산운용|아이비케이/.test(house)) return "ibk";
  if (/^PLUS\b/i.test(name) || (/한화/.test(house) && /PLUS/i.test(name))) return "plus";
  if (/^HANARO\b/i.test(name) || /NH-?\s*Amundi|NH아문디|엔에이치아문디/i.test(house)) {
    return "hanaro";
  }
  return "other";
}

/** Higher official/derived weight first. Missing weight goes last. */
export function compareHoldingsByWeight(
  a: { weight: number | null; quantity?: number | null },
  b: { weight: number | null; quantity?: number | null },
): number {
  const aw = a.weight;
  const bw = b.weight;
  if (aw == null && bw == null) {
    return Math.abs(b.quantity ?? 0) - Math.abs(a.quantity ?? 0);
  }
  if (aw == null) return 1;
  if (bw == null) return -1;
  if (bw !== aw) return bw - aw;
  return Math.abs(b.quantity ?? 0) - Math.abs(a.quantity ?? 0);
}

/** Strip legal wrappers so "IBK …액티브" matches the issuer catalog name. */
export function normalizeIssuerFundName(name: string): string {
  return name
    .toUpperCase()
    .replace(/증권상장지수투자신탁|상장지수투자신탁|투자신탁|증권/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^A-Z0-9가-힣+]/g, "");
}

export function matchIbkProductId(
  etfName: string,
  catalog: { id: number; name: string }[],
): number | null {
  const key = normalizeIssuerFundName(etfName);
  if (key.length < 4) return null;
  const scored: { id: number; rank: number; delta: number }[] = [];
  for (const item of catalog) {
    const k = normalizeIssuerFundName(item.name);
    if (!k) continue;
    if (k === key) scored.push({ id: item.id, rank: 0, delta: 0 });
    else if (k.startsWith(key) || key.startsWith(k)) {
      scored.push({
        id: item.id,
        rank: 1,
        delta: Math.abs(k.length - key.length),
      });
    }
  }
  scored.sort((a, b) => a.rank - b.rank || a.delta - b.delta);
  return scored[0]?.id ?? null;
}

export type IbkPdfItem = {
  name?: string;
  pdfCode?: string | null;
  quantity?: number | null;
  weight?: number | null;
};

/** IBK자산운용 /api/etf/{id}/pdf — 설정현금액(100%) is the CU total, not a holding. */
export function parseIbkPdfRows(
  content: IbkPdfItem[],
  asOf: string | null,
): ParsedCuRow[] {
  const rows: ParsedCuRow[] = [];
  for (const item of content) {
    const nameKo = String(item.name ?? "").trim();
    if (!nameKo || isCuNotionalName(nameKo)) continue;
    const codeRaw = String(item.pdfCode ?? "").trim().toUpperCase();
    const isin = /^[A-Z]{2}[A-Z0-9]{10}$/.test(codeRaw) ? codeRaw : null;
    const weight =
      item.weight == null || !Number.isFinite(Number(item.weight))
        ? null
        : Number(item.weight);
    const quantity =
      item.quantity == null || !Number.isFinite(Number(item.quantity))
        ? null
        : Number(item.quantity);
    rows.push({
      nameKo,
      weight,
      quantity,
      asOf,
      code: krCodeFromIsin(isin),
      isin,
    });
  }
  rows.sort(compareHoldingsByWeight);
  return rows;
}

export type KodexPdfItem = {
  secNm?: string;
  evalA?: string | number | null;
  applyQ?: string | number | null;
  itmNo?: string | null;
  ratio?: string | number | null;
};

/** Samsung KODEX `/api/v1/kodex/product/{fId}.do` → pdf.list.
 * `ratio` is the issuer NAV weight. 설정현금액 is the CU total, not a holding.
 * Null ratios are left null — never filled from evalA / sum(evalA).
 */
export function parseKodexPdfRows(
  content: KodexPdfItem[],
  asOf: string | null,
): ParsedCuRow[] {
  const rows: ParsedCuRow[] = [];
  for (const item of content) {
    const nameKo = String(item.secNm ?? "").trim();
    if (!nameKo || isCuNotionalName(nameKo)) continue;
    const weight =
      item.ratio == null || item.ratio === "" || !Number.isFinite(Number(item.ratio))
        ? null
        : Number(item.ratio);
    const quantity =
      item.applyQ == null || item.applyQ === "" || !Number.isFinite(Number(item.applyQ))
        ? null
        : Number(item.applyQ);
    const itm = String(item.itmNo ?? "").trim().toUpperCase();
    const isin = /^[A-Z]{2}[A-Z0-9]{10}$/.test(itm) ? itm : null;
    const code = isin ? krCodeFromIsin(isin) : asKrCode(itm.split(/\s+/)[0] ?? "");
    rows.push({
      nameKo,
      weight,
      quantity,
      asOf,
      code,
      isin,
    });
  }
  rows.sort(compareHoldingsByWeight);
  return rows;
}
