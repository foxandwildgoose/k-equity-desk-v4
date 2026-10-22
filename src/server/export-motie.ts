/** Official MOTIR/MOTIE monthly bulletins. A reachable directory is not numeric evidence. */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseKoreanNumber } from "../lib/export-desk/parse-import.ts";
import type { TradeObservation } from "../lib/export-desk/parse-import.ts";
import type { ExportProviderStatus } from "../lib/export-desk/provider-status.ts";

export interface MotieItem {
  categoryId: string;
  label: string;
  valueUsd: number;
  yoyPct?: number;
}
export interface MotieRelease {
  title: string;
  url: string;
  period: string;
  publishedAt: string | null;
  attachmentUrl: string | null;
  classification: "MTI";
  provisional: boolean;
  items: MotieItem[];
}
export interface MotieSnapshot {
  release: MotieRelease | null;
  observations: TradeObservation[];
  provider: ExportProviderStatus;
  diagnostics?: MotieDiagnostics;
}
export interface MotieDiagnostics {
  stage: "list" | "detail" | "attachment-request" | "pdf-decode" | "numeric-parse" | "complete";
  pdf?: {
    matchingPeriod: boolean;
    mtiDefinition: boolean;
    exportSection: boolean;
    knownCategoryCount: number;
    explicitCurrencyAmountCount: number;
    usdScales: ("USD" | "USD_THOUSAND" | "USD_MILLION" | "USD_100M")[];
  };
}
interface Dependencies {
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  budgetMs?: number;
  /** Explicit legacy override applies to every HTML and attachment request. */
  timeoutMs?: number;
  htmlTimeoutMs?: number;
  attachmentTimeoutMs?: number;
  /** Production PDF decoder; tests inject bounded text fixtures, never remote URLs. */
  extractPdfText?: (bytes: Uint8Array, signal: AbortSignal) => Promise<string>;
}
interface Article {
  title: string;
  url: string;
  period: string;
}

const BOARD = "/kor/article/ATCL3f49a5a8c";
const ORIGINS = ["https://www.motir.go.kr", "https://www.motie.go.kr"];
export const MOTIE_RELEASE_LIST_URL =
  ORIGINS[0] + BOARD + "?searchCondition=1&searchKeyword=" + encodeURIComponent("수출입 동향");
const FRESH_MS = 4 * 60 * 60_000;
const FAILURE_MS = 60_000;
const RETAIN_MS = 90 * 86_400_000;
const LABELS: Record<string, string> = {
  반도체: "semiconductors",
  자동차: "automobiles",
  자동차부품: "auto_parts",
  일반기계: "general_machinery",
  석유화학: "petrochemicals",
  석유제품: "petroleum_products",
  철강: "steel",
  철강제품: "steel",
  선박: "ships",
  디스플레이: "displays",
  무선통신기기: "wireless_devices",
  컴퓨터: "computers",
  바이오헬스: "bio_health",
  이차전지: "secondary_batteries",
  섬유: "textiles",
  섬유류: "textiles",
  가전: "home_appliances",
  전기기기: "electrical_equipment",
  비철금속: "non_ferrous_metals",
  농수산식품: "agri_fishery_food",
  화장품: "cosmetics",
  생활용품: "household_goods",
};
// Contract corroboration, not live connectivity certification:
// https://github.com/cystine13/koreastatlinker/blob/638b8e4520f39184ee67f77389963098bff97c92/github_html_onclick_20250219.py
// https://github.com/kyungsooNa/Investment/blob/df01914e39cd86450ff36be487bdd2ac0948959a/services/trade_trend_service.py
// The latter confirms current MOTIR origin, exact article title/ID resolution and
// discovering PDF download links from the real detail page. No article ID is guessed.

class MotieFailure extends Error {
  readonly reason: string;
  readonly state: ExportProviderStatus["state"];
  constructor(reason: string, state: ExportProviderStatus["state"] = "unverified") {
    super("산업부 공식 수출입동향 자료를 검증하지 못했습니다.");
    this.reason = reason;
    this.state = state;
  }
}
function entities(value: string): string {
  return value
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_all, hex, dec) => {
      const code = parseInt(hex ?? dec, hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
function plain(value: string): string {
  return entities(
    value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]*>/g, " "),
  )
    .replace(/[\t ]+/g, " ")
    .trim();
}
const compact = (s: string) => plain(s).replace(/\s+/g, "");
function attribute(tag: string, name: string): string {
  const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*([\"'])([\\s\\S]*?)\\1", "i"));
  return match ? entities(match[2]!) : "";
}
function officialUrl(raw: string, base?: string): string | null {
  try {
    const u = new URL(raw, base);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      !ORIGINS.includes(u.origin) ||
      u.port
    )
      return null;
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}
function koreanMonth(now: Date): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 7);
}
function titlePeriod(title: string): string | null {
  const m = compact(title).match(/^(\d{4})년(0?[1-9]|1[0-2])월수출입동향(?:\((?:잠정|잠정치)\))?$/);
  return m && Number(m[1]) > 0 ? m[1] + "-" + m[2]!.padStart(2, "0") : null;
}

export function parseMotieArticles(html: string, sourceUrl: string, now: Date): Article[] {
  if (!officialUrl(sourceUrl)) throw new MotieFailure("SOURCE_IDENTITY");
  const out = new Map<string, Article>();
  for (const m of html.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)) {
    const title = plain(m[2]!) || attribute(m[1]!, "title");
    const period = titlePeriod(title);
    if (!period || period >= koreanMonth(now)) continue;
    let href = attribute(m[1]!, "href");
    const action = href + " " + attribute(m[1]!, "onclick");
    const id = action.match(/\barticle\.view\(\s*['"]?(\d+)['"]?\s*\)/)?.[1];
    if (id) href = BOARD + "/" + id + "/view";
    const url = officialUrl(href, sourceUrl);
    if (!url || !new URL(url).pathname.match(/^\/kor\/article\/ATCL3f49a5a8c\/\d+\/view$/))
      continue;
    out.set(url, { title, period, url });
  }
  return [...out.values()].sort(
    (a, b) => b.period.localeCompare(a.period) || b.url.localeCompare(a.url),
  );
}

function tableUnit(value: string): string | null {
  const matches = [
    ...plain(value).matchAll(/단위\s*[:：]\s*(백만|천|억)?\s*(?:미\s*)?(?:달러|불|USD)/gi),
  ];
  const units = new Set(matches.map((m) => (m[1] ?? "") + "달러"));
  return units.size === 1 ? [...units][0]! : null;
}
function numeric(value: string, unit: string): number | null {
  // Growth in parentheses is not part of an amount cell.
  const raw = plain(value).replace(/\s*\([+-△▲]?\s*\d+(?:\.\d+)?\s*%?\)\s*$/, "");
  const amount = parseKoreanNumber(raw, unit);
  return amount != null && amount >= 0 ? amount : null;
}
function rowLabel(value: string): { id: string; label: string } | null {
  const name = compact(value)
    .replace(/^[○□ㅇ·*]+/, "")
    .replace(/\((?:MTI)?\d+\)$/, "");
  return LABELS[name] ? { id: LABELS[name]!, label: name } : null;
}
function mergeItem(items: Map<string, MotieItem>, item: MotieItem, rejected: Set<string>) {
  if (rejected.has(item.categoryId)) return;
  const prior = items.get(item.categoryId);
  // Rounded narrative and more precise tables may legitimately differ. Never
  // silently pick one; publish neither until a single exact observation validates.
  if (prior && prior.valueUsd !== item.valueUsd) {
    items.delete(item.categoryId);
    rejected.add(item.categoryId);
  } else if (!prior) items.set(item.categoryId, item);
}
function outsideNationalMonthlyScope(value: string): boolean {
  const normalized = compact(value);
  return /수입|누계|누적|전망|예상|목표|분기|상반기|하반기|연간|연도별|일평균|월평균|일일|조업일당|하루평균|\d{1,2}[~〜∼–-]\d{1,2}월|지역별|국가별|권역별|대상국|주요시장|미국|중국|일본|아세안|베트남|유럽연합|중동|중남미|대미|대중|대일|대EU|대인도|인도(?:시장|향|주요품목|수출)|\b(?:EU|CIS|YTD)\b/i.test(
    normalized,
  );
}

/** Parse an explicitly labelled monthly export table; column position is never guessed. */
export function parseMotieHtmlItems(html: string, period: string): MotieItem[] {
  if (!/\bMTI\b|MTI\s*기준/i.test(plain(html))) return [];
  const items = new Map<string, MotieItem>();
  const rejected = new Set<string>();
  for (const table of html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    const before = html.slice(Math.max(0, table.index! - 350), table.index);
    const context = before + " " + table[0];
    const unit = tableUnit(context);
    if (!unit || !/수출/.test(plain(context)) || outsideNationalMonthlyScope(context)) continue;
    const rows = [...table[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...row[1]!.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => plain(c[1]!)),
    );
    let amountIndex = -1;
    let yoyIndex = -1;
    for (const cells of rows) {
      const headers = cells.map(compact);
      const exact = headers
        .map((h, i) => {
          const full = h.match(/^(?:(\d{4})년?[-./]?)?(0?[1-9]|1[0-2])월?(?:수출액|수출금액)?$/);
          return full &&
            full[1] === period.slice(0, 4) &&
            full[2]!.padStart(2, "0") === period.slice(5)
            ? i
            : -1;
        })
        .filter((i) => i >= 0);
      if (exact.length === 1) amountIndex = exact[0]!;
      else if (headers.some((h) => /^(?:품목|품목명|구분)$/.test(h))) {
        const candidates = headers
          .map((h, i) => (/^(?:수출액|수출금액)(?:\([^)]*\))?$/.test(h) ? i : -1))
          .filter((i) => i >= 0);
        // A single amount column is accepted only if this table explicitly
        // names the bulletin's complete year/month.
        const tableText = compact(table[0]);
        const y = period.slice(0, 4),
          m = String(Number(period.slice(5)));
        if (
          candidates.length === 1 &&
          (tableText.includes(y + "년" + m + "월") ||
            tableText.includes(period) ||
            tableText.includes(y + "." + m))
        )
          amountIndex = candidates[0]!;
      }
      const yoys = headers
        .map((h, i) => (/^(?:전년동월비|전년동월대비|증감률)(?:\(%\))?$/.test(h) ? i : -1))
        .filter((i) => i >= 0);
      if (yoys.length === 1) yoyIndex = yoys[0]!;
      const label = rowLabel(cells[0] ?? "");
      if (!label || amountIndex <= 0 || amountIndex >= cells.length) continue;
      const valueUsd = numeric(cells[amountIndex]!, unit);
      if (valueUsd == null) continue;
      let yoyPct: number | undefined;
      if (yoyIndex > 0 && yoyIndex !== amountIndex) {
        const s = plain(cells[yoyIndex] ?? "")
          .replace(/%/g, "")
          .replace(/^△/, "-");
        if (/^[+-]?\d+(?:\.\d+)?$/.test(s)) yoyPct = Number(s);
      }
      mergeItem(
        items,
        {
          categoryId: label.id,
          label: label.label,
          valueUsd,
          ...(yoyPct == null ? {} : { yoyPct }),
        },
        rejected,
      );
    }
  }
  return [...items.values()];
}

/** Conservative inline form found in monthly official bulletin summaries/PDF text. */
export function parseMotieTextItems(text: string, period: string): MotieItem[] {
  const items = new Map<string, MotieItem>();
  const rejected = new Set<string>();
  const names = Object.keys(LABELS).sort((a, b) => b.length - a.length);
  const identity = period.slice(0, 4) + "년" + Number(period.slice(5)) + "월수출입동향";
  if (!compact(text).includes(identity) || !/\bMTI\b|MTI\s*기준/i.test(text)) return [];
  let current = false;
  let exportSection = false;
  for (const line of text.split(/[\r\n]+/)) {
    const normalized = compact(line);
    if (normalized.includes(identity)) current = true;
    const dates = [
      ...line.matchAll(/(\d{4})년\s*(0?[1-9]|1[0-2])월|(\d{4})[./-](0?[1-9]|1[0-2])(?=\s|월|$)/g),
    ].map((m) => (m[1] ?? m[3]) + "-" + (m[2] ?? m[4])!.padStart(2, "0"));
    if (dates.some((date) => date !== period)) {
      current = false;
      continue;
    }
    if (dates.length && dates.every((date) => date === period)) current = true;
    // Never inherit national monthly scope through later country/quarterly,
    // cumulative, forecast or import sections. A new unambiguous major-item
    // export heading is required before any further figures can be accepted.
    if (outsideNationalMonthlyScope(line)) {
      exportSection = false;
      continue;
    }
    if (/(?:품목별|주요품목|대품목).*수출|수출.*(?:품목별|주요품목|대품목)/.test(normalized))
      exportSection = true;
    const withoutGrowth = line.replace(/전년\s*(?:동월\s*)?대비/g, "");
    if (
      !current ||
      !exportSection ||
      /수입|누적|누계|전망|예상|목표|작년|지난해|전년|전월/.test(withoutGrowth)
    )
      continue;
    const paragraph = line.match(
      new RegExp("^\\s*[○□ㅇ·]?\\s*\\((" + names.join("|") + ")\\)\\s*(.*)$"),
    );
    if (paragraph && /^수출/.test(paragraph[2]!.trim())) {
      const amounts = [
        ...paragraph[2]!.matchAll(/([\d,]+(?:\.\d+)?)\s*(백만|천|억)\s*(?:미\s*)?달러/g),
      ];
      if (amounts.length === 1) {
        const amount = amounts[0]!;
        const valueUsd = numeric(amount[1]!, amount[2]! + "달러");
        if (valueUsd != null)
          mergeItem(
            items,
            { categoryId: LABELS[paragraph[1]!]!, label: paragraph[1]!, valueUsd },
            rejected,
          );
      }
    }
    const matches = [
      ...line.matchAll(
        /([가-힣]+)\s*[(:：]\s*(?:수출\s*)?([\d,]+(?:\.\d+)?)\s*(백만|천|억)\s*(?:미\s*)?달러/g,
      ),
    ];
    for (const m of matches) {
      const name = names.find((candidate) => candidate === m[1]);
      if (!name) continue;
      // Do not accept a previous-year amount from the same named segment.
      const rest = line.slice(m.index! + m[0].length, m.index! + m[0].length + 70);
      if (/전년\s*(?:실적|금액)|전월\s*(?:실적|금액)/.test(rest)) continue;
      const valueUsd = numeric(m[2]!, m[3]! + "달러");
      if (valueUsd == null) continue;
      mergeItem(items, { categoryId: LABELS[name]!, label: name, valueUsd }, rejected);
    }
  }
  return [...items.values()];
}

function publishedDate(html: string): string | null {
  const text = plain(html);
  const raw = text.match(/등록일\s*[:|]?\s*(\d{4})[.-](\d{2})[.-](\d{2})/)?.slice(1);
  if (!raw) return null;
  const date = raw.join("-");
  return Number.isFinite(Date.parse(date)) && new Date(date).toISOString().startsWith(date)
    ? date
    : null;
}
function articleBody(html: string, title: string): string | null {
  const stripped = html.replace(/<(script|style|nav|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  for (const match of stripped.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)) {
    const heading = match[1]!.match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1];
    if (heading && compact(heading) === compact(title)) return match[1]!;
  }
  for (const match of stripped.matchAll(/<(div|section)\b[^>]*>/gi)) {
    const tag = match[0];
    const semantic =
      attribute(tag, "itemprop") === "articleBody" ||
      /^(?:articleBody|article_content|article_body)$/.test(attribute(tag, "id")) ||
      /(?:^|\s)(?:view_cont(?:ent|ents)?|article_(?:body|content)|board_view_content|bbs_view_content|board-contents|view-contents)(?:\s|$)/.test(
        attribute(tag, "class"),
      );
    if (!semantic) continue;
    const element = match[1]!;
    const start = match.index! + tag.length;
    const nested = new RegExp("<\\/?" + element + "\\b[^>]*>", "gi");
    nested.lastIndex = start;
    let depth = 1;
    for (let next = nested.exec(stripped); next; next = nested.exec(stripped)) {
      depth += next[0].startsWith("</") ? -1 : 1;
      if (depth === 0) return stripped.slice(start, next.index);
    }
  }
  return null;
}
function attachment(html: string, url: string): string | null {
  for (const m of html.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)) {
    let href = attribute(m[1]!, "href");
    const label = plain(m[2]!);
    if (!/\.pdf(?:\b|$)/i.test(href + " " + label)) continue;
    const js = href.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
    if (js) href = js[1]!;
    const found = officialUrl(href, url);
    if (found && found !== url) return found;
  }
  return null;
}
function observations(release: MotieRelease): TradeObservation[] {
  return release.items.map((item) => ({
    period: release.period,
    categoryId: item.categoryId,
    categoryName: item.label,
    classification: "MTI",
    geo: "KR",
    valueUsd: item.valueUsd,
    sourceFile: "산업부 공식 월간 수출입동향 · MTI 주요품목 · 명목 USD · " + release.url,
    ...(release.publishedAt ? { releasedAt: release.publishedAt } : {}),
    vintage: release.url,
  }));
}
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(signal.reason);
    signal.addEventListener("abort", stop, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}
type PdfStage = "IMPORT" | "WORKER_IMPORT" | "DOCUMENT_LOAD" | "PAGE_LOAD" | "TEXT";
/** Bounded public categories only; upstream exception messages are never returned. */
export function motiePdfFailureReason(error: unknown, stage: PdfStage): string {
  const candidate =
    error != null && typeof error === "object"
      ? (error as { name?: unknown; message?: unknown })
      : {};
  const name = typeof candidate.name === "string" ? candidate.name.slice(0, 80) : "";
  const message = typeof candidate.message === "string" ? candidate.message.slice(0, 2000) : "";
  if (
    /DOMMatrix|ImageData|Path2D/.test(message) &&
    /not defined|not a constructor|polyfill/i.test(message)
  )
    return "PDF_DOM_POLYFILL_MISSING";
  if (/Cannot find (?:module|package)|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/i.test(message))
    return "PDF_RUNTIME_DEPENDENCY_MISSING";
  if (/API version.*(?:does not match|Worker version)/i.test(message))
    return "PDF_WORKER_VERSION_MISMATCH";
  if (/fake worker|WorkerMessageHandler|pdf\.worker/i.test(message))
    return "PDF_WORKER_INIT_FAILED";
  if (/standardFontDataUrl|cMapUrl|CMap|font data|ToUnicode/i.test(message))
    return "PDF_FONT_RESOURCE_UNAVAILABLE";
  if (/wasm|WebAssembly/i.test(message)) return "PDF_WASM_RESOURCE_UNAVAILABLE";
  if (/Promise\.withResolvers|process\.getBuiltinModule/i.test(message))
    return "PDF_NODE_API_UNAVAILABLE";
  if (name === "PasswordException") return "PDF_PASSWORD_PROTECTED";
  if (name === "InvalidPDFException") return "PDF_INVALID_DOCUMENT";
  if (name === "MissingPDFException") return "PDF_MISSING_DOCUMENT";
  if (name === "UnexpectedResponseException") return "PDF_UNEXPECTED_RESPONSE";
  if (name === "TimeoutError" || name === "AbortError") return "PDF_DECODE_TIMEOUT";
  return "PDF_" + stage + "_FAILED";
}
export function motieTextDiagnostics(
  text: string,
  period: string,
): NonNullable<MotieDiagnostics["pdf"]> {
  const normalized = compact(text);
  const identity = period.slice(0, 4) + "년" + Number(period.slice(5)) + "월수출입동향";
  const categoryNames = new RegExp(
    Object.keys(LABELS)
      .sort((a, b) => b.length - a.length)
      .join("|"),
    "g",
  );
  const scales = [
    ["USD", /(?:단위[:：]?)달러/],
    ["USD_THOUSAND", /천(?:미)?(?:달러|불|USD)/i],
    ["USD_MILLION", /백만(?:미)?(?:달러|불|USD)/i],
    ["USD_100M", /억(?:미)?(?:달러|불|USD)/i],
  ] as const;
  return {
    matchingPeriod: normalized.includes(identity),
    mtiDefinition: /\bMTI\b|MTI\s*기준/i.test(text),
    exportSection: /(?:품목별|주요품목|대품목).*수출|수출.*(?:품목별|주요품목|대품목)/.test(
      normalized,
    ),
    knownCategoryCount: new Set(
      [...normalized.matchAll(categoryNames)].map((match) => LABELS[match[0]]),
    ).size,
    explicitCurrencyAmountCount: Math.min(
      5000,
      [...text.matchAll(/[\d,]+(?:\.\d+)?\s*(?:백만|천|억)\s*(?:미\s*)?(?:달러|불|USD)/gi)].length,
    ),
    usdScales: scales.filter(([, pattern]) => pattern.test(normalized)).map(([label]) => label),
  };
}
/** Fixed local, trusted package resources. No path or resource URL comes from a PDF. */
export function resolveMotiePdfAssets(): { cMapUrl: string; standardFontDataUrl: string } {
  const roots = [fileURLToPath(new URL("./pdfjs-assets/", import.meta.url))];
  try {
    roots.push(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")));
  } catch {
    // Vercel uses the explicitly copied resources rather than an installed package.
  }
  for (const root of roots) {
    if (
      existsSync(join(root, "cmaps", "UniKS-UCS2-H.bcmap")) &&
      existsSync(join(root, "cmaps", "Adobe-Korea1-UCS2.bcmap")) &&
      existsSync(join(root, "standard_fonts", "LiberationSans-Regular.ttf"))
    )
      return {
        cMapUrl: join(root, "cmaps") + sep,
        standardFontDataUrl: join(root, "standard_fonts") + sep,
      };
  }
  throw new MotieFailure("PDF_LOCAL_RESOURCES_MISSING", "unavailable");
}

/** Text only: no document scripts, network resources, rendering or arbitrary URL input. */
export async function extractMotiePdfText(bytes: Uint8Array, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  if (bytes.length > 8_000_000) throw new MotieFailure("ATTACHMENT_BODY_LIMIT");
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    throw new MotieFailure("ATTACHMENT_FORMAT");
  let stage: PdfStage = "IMPORT";
  let task:
    ReturnType<(typeof import("pdfjs-dist/legacy/build/pdf.mjs"))["getDocument"]> | undefined;
  try {
    const pdfjs = await abortable(import("pdfjs-dist/legacy/build/pdf.mjs"), signal);
    stage = "WORKER_IMPORT";
    // PDF.js exposes this supported fake-worker hook in its Node implementation.
    // A literal import keeps Nitro's dependency tracer from losing the worker.
    // @ts-expect-error PDF.js does not ship declarations for its worker-only entry.
    const worker = await abortable(import("pdfjs-dist/legacy/build/pdf.worker.mjs"), signal);
    (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker = worker;
    stage = "DOCUMENT_LOAD";
    const resources = resolveMotiePdfAssets();
    task = pdfjs.getDocument({
      data: bytes.slice(),
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      useWorkerFetch: false,
      disableAutoFetch: true,
      disableStream: true,
      stopAtErrors: true,
      cMapUrl: resources.cMapUrl,
      cMapPacked: true,
      standardFontDataUrl: resources.standardFontDataUrl,
    });
    const document = await abortable(task.promise, signal);
    if (document.numPages < 1 || document.numPages > 64)
      throw new MotieFailure("ATTACHMENT_PAGE_LIMIT");
    const lines: string[] = [];
    let size = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      signal.throwIfAborted();
      stage = "PAGE_LOAD";
      const page = await abortable(document.getPage(pageNumber), signal);
      stage = "TEXT";
      const content = await abortable(page.getTextContent(), signal);
      if (content.items.length > 50_000) throw new MotieFailure("ATTACHMENT_TEXT_LIMIT");
      let previousY: number | undefined;
      let line = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = item.transform[5] as number;
        if (previousY != null && Math.abs(previousY - y) > 3 && line) {
          lines.push(line);
          line = "";
        }
        line += (line ? " " : "") + item.str;
        size += item.str.length + 1;
        if (size > 2_000_000) throw new MotieFailure("ATTACHMENT_TEXT_LIMIT");
        previousY = y;
        if (item.hasEOL && line) {
          lines.push(line);
          line = "";
          previousY = undefined;
        }
      }
      if (line) lines.push(line);
      page.cleanup();
    }
    return lines.join("\n");
  } catch (error) {
    if (error instanceof MotieFailure) throw error;
    throw new MotieFailure(motiePdfFailureReason(error, stage), "unavailable");
  } finally {
    if (task) await abortable(task.destroy(), AbortSignal.timeout(1000)).catch(() => {});
  }
}
export function createMotieReleaseClient(deps: Dependencies = {}) {
  const request = deps.fetch ?? globalThis.fetch;
  const now = deps.now ?? (() => new Date());
  let cached: MotieSnapshot | null = null;
  let cachedAt = 0;
  let last: MotieSnapshot | null = null;
  let lastAt = 0;
  let flight: Promise<MotieSnapshot> | null = null;

  async function load(): Promise<MotieSnapshot> {
    const started = now();
    const budget = AbortSignal.timeout(deps.budgetMs ?? 35_000);
    let identifiedRelease: MotieRelease | null = null;
    const diagnostics: MotieDiagnostics = { stage: "list" };
    const status = (
      state: ExportProviderStatus["state"],
      reasonCode: string,
      message: string,
      release: MotieRelease | null = null,
    ): ExportProviderStatus => ({
      id: "motie.release",
      name: "산업부 공식 수출입동향",
      configured: true,
      state,
      reasonCode,
      message,
      checkedAt: started.toISOString(),
      asOf: release?.period ?? null,
      recordCount: release?.items.length ?? 0,
      sourceUrl: release?.url ?? MOTIE_RELEASE_LIST_URL,
      provisional: release?.provisional,
    });
    async function read(url: string, binary = false): Promise<Uint8Array> {
      let current = officialUrl(url);
      if (!current) throw new MotieFailure("SOURCE_IDENTITY");
      for (let redirect = 0; redirect < 3; redirect++) {
        const timeoutMs =
          deps.timeoutMs ??
          (binary ? (deps.attachmentTimeoutMs ?? 25_000) : (deps.htmlTimeoutMs ?? 7_000));
        const signal = AbortSignal.any([budget, AbortSignal.timeout(timeoutMs)]);
        let response: Response;
        try {
          response = await request(current, {
            method: "GET",
            redirect: "manual",
            cache: "no-store",
            headers: {
              accept: binary ? "application/pdf" : "text/html",
              "user-agent": "KoreaEquityDesk/1.0 (official public statistics)",
            },
            signal,
          });
        } catch (error) {
          const timeout =
            signal.aborted ||
            (error instanceof Error && /^(?:Abort|Timeout)Error$/.test(error.name));
          throw new MotieFailure(
            (binary ? "ATTACHMENT_" : "HTML_") + (timeout ? "REQUEST_TIMEOUT" : "FETCH_FAILED"),
            "unavailable",
          );
        }
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const target = officialUrl(response.headers.get("location") ?? "", current);
          if (!target) throw new MotieFailure("REDIRECT_SOURCE_IDENTITY");
          current = target;
          continue;
        }
        if (!response.ok)
          throw new MotieFailure(
            "HTTP_" + response.status,
            response.status === 429 ? "rate-limited" : "unavailable",
          );
        const limit = binary ? 8_000_000 : 2_000_000;
        const reader = response.body?.getReader();
        if (!reader) throw new MotieFailure("EMPTY_BODY", "empty");
        const chunks: Uint8Array[] = [];
        let total = 0;
        try {
          while (true) {
            let part: ReadableStreamReadResult<Uint8Array>;
            try {
              part = await abortable(reader.read(), signal);
            } catch {
              throw new MotieFailure(
                (binary ? "ATTACHMENT_" : "HTML_") +
                  (signal.aborted ? "BODY_TIMEOUT" : "BODY_READ_FAILED"),
                "unavailable",
              );
            }
            signal.throwIfAborted();
            if (part.done) break;
            total += part.value.length;
            if (total > limit) throw new MotieFailure("BODY_LIMIT");
            chunks.push(part.value);
          }
        } finally {
          await abortable(
            Promise.resolve().then(() => reader.cancel()),
            AbortSignal.timeout(1000),
          ).catch(() => {});
        }
        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        return bytes;
      }
      throw new MotieFailure("REDIRECT_LIMIT");
    }
    try {
      let links: Article[] = [];
      let lastError: unknown;
      for (const origin of ORIGINS) {
        try {
          const listUrl =
            origin +
            BOARD +
            "?searchCondition=1&searchKeyword=" +
            encodeURIComponent("수출입 동향");
          const html = new TextDecoder().decode(await read(listUrl));
          links = parseMotieArticles(html, listUrl, started);
          if (links.length) break;
          lastError = new MotieFailure("MONTHLY_RELEASE_NOT_FOUND", "empty");
        } catch (error) {
          lastError = error;
        }
        if (budget.aborted) break;
      }
      if (!links.length) throw lastError ?? new MotieFailure("MONTHLY_RELEASE_NOT_FOUND", "empty");
      const article = links[0]!;
      diagnostics.stage = "detail";
      identifiedRelease = {
        ...article,
        publishedAt: null,
        attachmentUrl: null,
        classification: "MTI",
        provisional: false,
        items: [],
      };
      const html = new TextDecoder().decode(await read(article.url));
      if (!compact(html).includes(compact(article.title)))
        throw new MotieFailure("DETAIL_IDENTITY");
      const publishedAt = publishedDate(html);
      if (
        publishedAt &&
        publishedAt > new Date(started.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
      )
        throw new MotieFailure("FUTURE_PUBLICATION");
      const firstPublicationMonth = new Date(
        Date.UTC(Number(article.period.slice(0, 4)), Number(article.period.slice(5)), 1),
      )
        .toISOString()
        .slice(0, 10);
      if (publishedAt && publishedAt < firstPublicationMonth)
        throw new MotieFailure("PUBLICATION_BEFORE_REFERENCE_PERIOD_END");
      const attachmentUrl = attachment(html, article.url);
      const content = articleBody(html, article.title);
      let items = content ? parseMotieHtmlItems(content, article.period) : [];
      if (!items.length && content)
        items = parseMotieTextItems(
          article.title + "\n" + plain(content.replace(/<\/(?:p|div|li|tr)>|<br\s*\/?>/gi, "\n")),
          article.period,
        );
      let attachmentReason = "";
      if (!items.length && attachmentUrl) {
        try {
          diagnostics.stage = "attachment-request";
          const bytes = await read(attachmentUrl, true);
          if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
            throw new MotieFailure("ATTACHMENT_FORMAT");
          diagnostics.stage = "pdf-decode";
          const decoded = await abortable(
            (deps.extractPdfText ?? extractMotiePdfText)(bytes, budget),
            budget,
          );
          budget.throwIfAborted();
          if (decoded.length > 2_000_000) throw new MotieFailure("DECODED_BODY_LIMIT");
          diagnostics.pdf = motieTextDiagnostics(decoded, article.period);
          if (!compact(decoded).includes(compact(article.title)))
            throw new MotieFailure("ATTACHMENT_PERIOD_IDENTITY");
          diagnostics.stage = "numeric-parse";
          items = parseMotieTextItems(decoded, article.period);
        } catch (error) {
          attachmentReason =
            error instanceof MotieFailure
              ? error.reason
              : budget.aborted
                ? "REQUEST_TIMEOUT"
                : "ATTACHMENT_UNAVAILABLE";
        }
      }
      const release: MotieRelease = {
        ...article,
        publishedAt,
        attachmentUrl,
        classification: "MTI",
        provisional: /잠정/.test(plain(html)),
        items,
      };
      if (
        cached &&
        started.getTime() - cachedAt <= RETAIN_MS &&
        (!items.length || release.period < cached.release!.period)
      )
        return {
          ...structuredClone(cached),
          provider: {
            ...cached.provider,
            state: "stale",
            reasonCode: !items.length
              ? attachmentReason || "OFFICIAL_RELEASE_NUMBERS_UNVERIFIED"
              : "OLDER_PUBLICATION",
            message:
              "공식 발표를 재확인했지만 새 품목 수치가 검증되지 않아 이전 검증본을 유지합니다. 원래 통계 기준월과 검증 시각을 바꾸지 않습니다.",
          },
        };
      const output: MotieSnapshot = {
        release,
        observations: observations(release),
        diagnostics: { ...diagnostics, stage: attachmentReason ? diagnostics.stage : "complete" },
        provider: status(
          items.length ? "ok" : "partial",
          items.length
            ? "OFFICIAL_RELEASE_VERIFIED"
            : attachmentReason || "OFFICIAL_RELEASE_NUMBERS_UNVERIFIED",
          items.length
            ? article.period +
                " 공식 월간 발표의 품목 " +
                items.length +
                "개 금액·단위를 확인했습니다. 모든 참고 품목 확보를 의미하지 않습니다."
            : article.period +
                " 공식 발표 원문을 확인했습니다. 품목별 금액·단위는 아직 검증되지 않아 수치를 만들지 않습니다.",
          release,
        ),
      };
      if (items.length) {
        cached = structuredClone(output);
        cachedAt = started.getTime();
      }
      return output;
    } catch (error) {
      const state = error instanceof MotieFailure ? error.state : "unavailable";
      const reason =
        error instanceof MotieFailure
          ? error.reason
          : budget.aborted
            ? "REQUEST_TIMEOUT"
            : "CONNECTION_FAILED";
      if (cached && started.getTime() - cachedAt <= RETAIN_MS)
        return {
          ...structuredClone(cached),
          provider: {
            ...cached.provider,
            state: "stale",
            reasonCode: reason,
            message: "이전 공식 발표 검증본을 유지합니다. 현재 공식 사이트 재조회에 실패했습니다.",
          },
        };
      return {
        release: identifiedRelease,
        observations: [],
        diagnostics,
        provider: status(
          state,
          reason,
          "산업부 공식 월간 발표를 확인하지 못했습니다. 다른 제공처 자료를 산업부 자료로 표시하지 않습니다.",
          identifiedRelease,
        ),
      };
    }
  }
  return async (): Promise<MotieSnapshot> => {
    const time = now().getTime();
    if (cached && time - cachedAt < FRESH_MS) return structuredClone(cached);
    if (last && time - lastAt < FAILURE_MS) return structuredClone(last);
    if (!flight)
      flight = load()
        .then((value) => {
          last = structuredClone(value);
          lastAt = now().getTime();
          return value;
        })
        .finally(() => {
          flight = null;
        });
    return structuredClone(await flight);
  };
}

export const fetchMotieRelease = createMotieReleaseClient();
