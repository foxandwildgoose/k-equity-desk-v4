/** Server-only Korea Customs OpenAPI adapter. Never import this module into a route component. */
import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { CORE20_HS_PROXY } from "../lib/export-desk/hs-map.ts";
import type { DestinationRow } from "../lib/export-desk/destinations.ts";
import type { FredPoint } from "../lib/export-desk/parse-fred.ts";
import type { TradeObservation } from "../lib/export-desk/parse-import.ts";
import type { ExportProviderStatus } from "../lib/export-desk/provider-status.ts";

export interface CustomsTradeResult {
  exports: FredPoint[];
  imports: FredPoint[];
  observations: TradeObservation[];
  destinations: { period: string; rows: DestinationRow[]; source: string };
  providers: ExportProviderStatus[];
}
export interface CustomsTradeOptions { months?: number; categoryId?: string }
interface ClientDependencies {
  fetch?: typeof globalThis.fetch;
  getKey?: () => string | undefined;
  now?: () => number;
  timeoutMs?: number;
  budgetMs?: number;
  maxRequests?: number;
  maxPages?: number;
}
type Service = "total" | "hs" | "destinations";
type Row = Record<string, unknown>;
interface MonthlyRow { period: string; exports: number; imports: number; code: string; name: string }
interface Block { start: string; end: string }
interface BlockResult { rows: MonthlyRow[]; checkedAt: string }
interface Context { key: string; fingerprint: string; deadline: number; requests: number }
type FailureState = "invalid-key" | "rate-limited" | "unavailable" | "unverified";

// Exact, case-sensitive service paths are corroborated by independent published
// clients. Application IDs are service-specific: a common key alone is not approval.
// https://github.com/jaepil-choi/dbgaps2024/blob/b50680dd094a43245d41caf6827f1e2b7960cc8f/common/get_data.py
// https://github.com/jroh7115-arch/macro-dashboard/blob/c2a8d3f2fe97b5f37b552eeef17e877372481e16/fetch_macro_data_github.py
// https://github.com/DongsooJung/dongsoojung.github.io/blob/457a5fe3794eda0d90f354781649d85a812dc086/trade/fetch_data.py
// https://github.com/seokhoonj/pydatagokr/blob/cc2597d21f86d4ad82f3b7b00408fcda1cb5484a/src/pydatagokr/services/customs.py
export const CUSTOMS_SERVICES = {
  total: { id: "customs-total", name: "관세청 수출입총괄", path: "Newtrade/getNewtradeList", sourceUrl: "https://www.data.go.kr/data/15102108/openapi.do" },
  hs: { id: "customs-hs", name: "관세청 품목별 수출입실적", path: "Itemtrade/getItemtradeList", sourceUrl: "https://www.data.go.kr/data/15101609/openapi.do" },
  destinations: { id: "customs-destinations", name: "관세청 국가별 수출입실적", path: "nationtrade/getNationtradeList", sourceUrl: "https://www.data.go.kr/data/15101612/openapi.do" },
} as const;
const ORIGIN = "https://apis.data.go.kr/1220000/";
const SOURCE = "관세청 공식 OpenAPI · 수출 FOB / 수입 CIF · USD 원값";
const BODY_LIMIT = 2 * 1024 * 1024;
const PAGE_SIZE = 1000;
const CACHE_LIMIT = 256;
const RESULT_LIMIT = 64;
const TOTAL_LABEL = /^(?:총계|합계|소계|누계|계|total|subtotal|grand\s*total)$/i;
const xmlParser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true, processEntities: false });

class CustomsError extends Error {
  readonly state: FailureState;
  readonly reasonCode: string;
  constructor(state: FailureState, reasonCode: string) {
    super("관세청 API 응답을 확인할 수 없습니다.");
    this.state = state;
    this.reasonCode = reasonCode;
  }
}
const failure = (reason: string) => new CustomsError("unavailable", reason);
const text = (value: unknown): string => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
const record = (value: unknown): Row | null => value != null && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
const iso = (value: number) => new Date(value).toISOString();

function keyValue(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  let value = raw.trim();
  try { if (/%[0-9a-f]{2}/i.test(value)) value = decodeURIComponent(value); }
  catch { throw new CustomsError("invalid-key", "KEY_FORMAT"); }
  // Both data.go.kr Decoding and Encoding forms are accepted, encoded exactly once.
  if (!/^[A-Za-z0-9+/_=-]{8,512}$/.test(value)) throw new CustomsError("invalid-key", "KEY_FORMAT");
  return value;
}
function period(value: unknown): string | null {
  const match = text(value).match(/^(\d{4})[.-]?(0[1-9]|1[0-2])$/);
  return match && Number(match[1]) >= 2000 ? `${match[1]}-${match[2]}` : null;
}
function dollars(value: unknown): number | null {
  const raw = text(value);
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw)) return null;
  const number = Number(raw.replace(/,/g, ""));
  return Number.isFinite(number) && number >= 0 && number <= Number.MAX_SAFE_INTEGER ? number : null;
}
function integer(value: unknown): number | null {
  const raw = text(value);
  return /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null;
}
function completedPeriods(now: number, months: number): string[] {
  // Korean publication dates use KST. Never request a not-yet-completed month.
  const local = new Date(now + 9 * 60 * 60 * 1000);
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - months + index, 1));
    return date.toISOString().slice(0, 7);
  });
}
function blocks(periods: string[]): Block[] {
  const byYear = new Map<string, string[]>();
  for (const p of periods) byYear.set(p.slice(0, 4), [...byYear.get(p.slice(0, 4)) ?? [], p]);
  return [...byYear.values()].map((p) => ({ start: p[0]!, end: p[p.length - 1]! })).reverse();
}
function gatewayFailure(code: string): CustomsError {
  if (["20", "21", "30", "31", "32", "33"].includes(code)) return new CustomsError("invalid-key", code === "30" ? "KEY_NOT_REGISTERED" : code === "20" ? "SERVICE_NOT_APPROVED" : code === "32" ? "IP_NOT_APPROVED" : "KEY_OR_SERVICE_PERMISSION");
  if (code === "22") return new CustomsError("rate-limited", "API_QUOTA");
  return failure("API_RESPONSE_CODE");
}
function parseEnvelope(xml: string): { rows: Row[]; count: number; page: number | null; size: number | null } {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw failure("INVALID_XML");
  const parsed = record(xmlParser.parse(xml));
  const auth = record(record(parsed?.OpenAPI_ServiceResponse)?.cmmMsgHeader);
  if (auth) throw gatewayFailure(text(auth.returnReasonCode));
  const response = record(parsed?.response);
  const header = record(response?.header);
  const code = text(header?.resultCode);
  if (!/^(?:0|00|000|0000)$/.test(code)) throw code ? gatewayFailure(code) : failure("UNVERIFIED_SCHEMA");
  const body = record(response?.body);
  const count = integer(body?.totalCount);
  if (count == null || count > PAGE_SIZE * 8) throw failure("INVALID_COUNT");
  const items = record(body?.items);
  const rawRows = items?.item == null ? [] : Array.isArray(items.item) ? items.item : [items.item];
  if (rawRows.length > PAGE_SIZE || rawRows.some((r) => !record(r))) throw failure("INVALID_ROWS");
  return { rows: rawRows as Row[], count, page: integer(body?.pageNo), size: integer(body?.numOfRows) };
}
function normalizeRows(rows: Row[], service: Service, block: Block, hs?: string): MonthlyRow[] {
  const values = new Map<string, MonthlyRow>();
  for (const row of rows) {
    const rawPeriod = text(row.year);
    if ([rawPeriod, text(row.hsCd), text(row.statCd), text(row.statCdCntnKor1)].some((v) => TOTAL_LABEL.test(v)) || /^\d{4}$/.test(rawPeriod)) continue;
    const p = period(rawPeriod);
    if (!p || p < block.start || p > block.end) throw failure("PERIOD_MISMATCH");
    const exports = dollars(row.expDlr);
    const imports = dollars(row.impDlr);
    if (exports == null || imports == null) throw failure("INVALID_USD_VALUE");
    let code = "TOTAL";
    let name = "대한민국 전체";
    if (service === "hs") {
      code = text(row.hsCd);
      if (!hs || !/^(?:\d{2}|\d{4}|\d{6}|\d{10})$/.test(code)) throw failure("HS_IDENTITY_MISSING");
      // A response can contain children: use only the exact requested aggregate.
      if (code !== hs) { if (code.startsWith(hs)) continue; throw failure("HS_IDENTITY_MISMATCH"); }
      if (text(row.statCd) && !/^(?:00|0|ALL|WORLD)$/i.test(text(row.statCd))) throw failure("COUNTRY_DIMENSION_MISMATCH");
      name = text(row.statKor) || `HS ${code}`;
    } else if (service === "destinations") {
      code = text(row.statCd).toUpperCase();
      name = text(row.statCdCntnKor1);
      if (!/^[A-Z]{2}$/.test(code) || !name || text(row.hsCd)) throw failure("COUNTRY_IDENTITY_MISMATCH");
    } else if (text(row.hsCd) || (text(row.statCd) && !/^(?:00|0|ALL|WORLD)$/i.test(text(row.statCd)))) {
      throw failure("TOTAL_DIMENSION_MISMATCH");
    }
    const key = `${p}:${code}`;
    const previous = values.get(key);
    if (previous && (previous.exports !== exports || previous.imports !== imports)) throw failure("CONFLICTING_DUPLICATE");
    if (!previous) values.set(key, { period: p, exports, imports, code, name });
  }
  return [...values.values()];
}
async function bodyText(response: Response): Promise<string> {
  const declared = response.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > BODY_LIMIT)) throw failure("BODY_TOO_LARGE");
  if (!response.body) throw failure("EMPTY_BODY");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > BODY_LIMIT) throw failure("BODY_TOO_LARGE");
      chunks.push(item.value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
async function pooled<T>(tasks: (() => Promise<T>)[]): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, tasks.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= tasks.length) return;
      try { results[index] = { status: "fulfilled", value: await tasks[index]!() }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  }));
  return results;
}
function prune<T>(cache: Map<string, T>, limit: number) { while (cache.size > limit) cache.delete(cache.keys().next().value!); }
function empty(providers: ExportProviderStatus[]): CustomsTradeResult {
  return { exports: [], imports: [], observations: [], destinations: { period: "", rows: [], source: SOURCE }, providers };
}

export function createCustomsTradeClient(dependencies: ClientDependencies = {}) {
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  const now = dependencies.now ?? Date.now;
  const getKey = dependencies.getKey ?? (() => [process.env.CUSTOMS_API_KEY, process.env.KCS_API_KEY, process.env.DATA_GO_KR_SERVICE_KEY].find((value) => value?.trim()));
  const timeout = Math.max(10, Math.min(10_000, dependencies.timeoutMs ?? 4_000));
  const budget = Math.max(10, Math.min(30_000, dependencies.budgetMs ?? 12_000));
  const requestLimit = Math.max(1, Math.min(100, dependencies.maxRequests ?? 48));
  const pageLimit = Math.max(1, Math.min(8, dependencies.maxPages ?? 8));
  const cache = new Map<string, { expires: number; value: BlockResult }>();
  const inFlight = new Map<string, Promise<BlockResult>>();
  const results = new Map<string, { expires: number; value: CustomsTradeResult }>();
  const resultFlights = new Map<string, Promise<CustomsTradeResult>>();

  const status = (service: Service, state: ExportProviderStatus["state"], opts: { configured?: boolean; checkedAt?: string; asOf?: string | null; count?: number; reason?: string } = {}): ExportProviderStatus => {
    const messages: Partial<Record<ExportProviderStatus["state"], string>> = {
      "missing-key": "서버에 CUSTOMS_API_KEY를 등록하고 이 관세청 서비스의 활용신청을 승인받아야 합니다.",
      "invalid-key": "관세청 인증키, 해당 서비스 활용승인 또는 허용 IP를 확인해 주세요.",
      "rate-limited": "관세청 API 요청 한도에 도달했습니다. 잠시 후 다시 조회합니다.",
      unavailable: "관세청 공식 API에 연결하지 못했거나 응답을 검증하지 못했습니다.",
      unverified: "해당 조회 조건의 관세청 자료를 검증할 수 없습니다.",
      empty: "완료된 월의 해당 관세청 자료가 아직 없거나 공표되지 않았습니다.",
      partial: "검증된 월만 표시합니다. 일부 월·HS 구성코드는 미공표 또는 조회 제한으로 누락되었습니다.",
      ok: "관세청 공식 월별 자료를 조회했습니다. USD 원값이며 실시간 수출 통계가 아닙니다.",
    };
    const { id, name, sourceUrl } = CUSTOMS_SERVICES[service];
    return { id, name, sourceUrl, configured: opts.configured ?? true, state, message: messages[state] ?? messages.unavailable!, checkedAt: opts.checkedAt ?? iso(now()), asOf: opts.asOf ?? null, recordCount: opts.count ?? 0, reasonCode: opts.reason };
  };
  async function request(context: Context, service: Service, block: Block, page: number, hs?: string) {
    if (context.requests >= requestLimit) throw failure("REQUEST_BUDGET");
    if (Date.now() >= context.deadline) throw failure("TIME_BUDGET");
    context.requests++;
    const controller = new AbortController();
    const url = new URL(CUSTOMS_SERVICES[service].path, ORIGIN);
    url.search = new URLSearchParams({ serviceKey: context.key, strtYymm: block.start.replace("-", ""), endYymm: block.end.replace("-", ""), pageNo: String(page), numOfRows: String(PAGE_SIZE), ...(hs ? { hsSgn: hs } : {}) }).toString();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetcher(url, { signal: controller.signal, redirect: "error", cache: "no-store", headers: { accept: "application/xml, text/xml" } });
          if (!response.ok) {
            if (response.status === 429) throw new CustomsError("rate-limited", "HTTP_429");
            if (response.status === 401 || response.status === 403) throw new CustomsError("invalid-key", "HTTP_PERMISSION_DENIED");
            throw failure("HTTP_UNAVAILABLE");
          }
          return parseEnvelope(await bodyText(response));
        })(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(failure("REQUEST_TIMEOUT")); }, Math.max(1, Math.min(timeout, context.deadline - Date.now()))); }),
      ]);
    } catch (error) { throw error instanceof CustomsError ? error : failure("NETWORK_OR_BODY_ERROR"); }
    finally { if (timer) clearTimeout(timer); }
  }
  async function loadBlock(context: Context, service: Service, block: Block, hs?: string): Promise<BlockResult> {
    const key = `${context.fingerprint}:${service}:${hs ?? ""}:${block.start}:${block.end}`;
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return cached.value;
    if (inFlight.has(key)) return inFlight.get(key)!;
    if (inFlight.size >= CACHE_LIMIT) throw failure("CONCURRENT_REQUEST_LIMIT");
    const promise = (async () => {
      const rawRows: Row[] = [];
      let total: number | null = null;
      let seen = 0;
      let pageSize: number | null = null;
      const pageHashes = new Set<string>();
      for (let page = 1; page <= pageLimit; page++) {
        const result = await request(context, service, block, page, hs);
        if ((result.page != null && result.page !== page) || (result.size != null && (result.size < 1 || result.size > PAGE_SIZE))) throw failure("PAGINATION_MISMATCH");
        if (total != null && result.count !== total) throw failure("PAGINATION_CHANGED");
        total = result.count;
        pageSize ??= result.size ?? PAGE_SIZE;
        if ((result.size ?? PAGE_SIZE) !== pageSize || result.rows.length > pageSize) throw failure("PAGINATION_MISMATCH");
        if (result.rows.length) {
          const pageHash = createHash("sha256").update(JSON.stringify(result.rows)).digest("hex");
          if (pageHashes.has(pageHash)) throw failure("REPEATED_PAGE");
          pageHashes.add(pageHash);
        }
        seen += result.rows.length;
        rawRows.push(...result.rows);
        if (seen > total) throw failure("COUNT_MISMATCH");
        if (seen === total) {
          const value = { rows: normalizeRows(rawRows, service, block, hs), checkedAt: iso(now()) };
          cache.set(key, { value, expires: now() + (value.rows.length ? 30 * 60_000 : 60_000) });
          prune(cache, CACHE_LIMIT);
          return value;
        }
        if (!result.rows.length || result.rows.length < pageSize) throw failure("TRUNCATED_RESPONSE");
      }
      throw failure("PAGE_LIMIT");
    })();
    inFlight.set(key, promise);
    try { return await promise; } finally { inFlight.delete(key); }
  }
  function summarize(service: Service, settled: PromiseSettledResult<BlockResult>[], count: number, expected: number, asOf: string | null): ExportProviderStatus {
    const errors = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    const error = errors.find((r) => r.reason instanceof CustomsError)?.reason as CustomsError | undefined;
    const checked = settled.flatMap((r) => r.status === "fulfilled" ? [r.value.checkedAt] : []).sort().at(-1);
    return status(service, count ? errors.length || count < expected ? "partial" : "ok" : error?.state ?? "empty", { checkedAt: checked, asOf, count, reason: errors.length ? error?.reasonCode ?? "INCOMPLETE_RESPONSE" : count < expected ? "INCOMPLETE_MONTHS" : "API_OK" });
  }
  async function fetchTrade(options: CustomsTradeOptions = {}): Promise<CustomsTradeResult> {
    const selected: Service[] = options.categoryId ? ["hs"] : ["total", "destinations"];
    let key: string | null;
    try { key = keyValue(getKey()); }
    catch (error) { return empty(selected.map((service) => status(service, "invalid-key", { reason: error instanceof CustomsError ? error.reasonCode : "KEY_FORMAT" }))); }
    if (!key) return empty(selected.map((service) => status(service, "missing-key", { configured: false, reason: "KEY_MISSING" })));
    const months = Math.max(1, Math.min(120, Math.trunc(Number.isFinite(options.months) ? options.months! : 36)));
    const periods = completedPeriods(now(), months);
    const directHs = options.categoryId?.match(/^(hs2):(\d{2})$|^(hs4):(\d{4})$/);
    const directCode = directHs?.[2] ?? directHs?.[4];
    const proxy = options.categoryId ? CORE20_HS_PROXY.find((p) => p.key === options.categoryId) ?? (directCode ? { key: options.categoryId, codes: [directCode], label: `HS ${directCode}` } : undefined) : undefined;
    if (options.categoryId && (!proxy || proxy.codes.some((code) => proxy.codes.some((other) => code !== other && code.startsWith(other))))) return empty([status("hs", "unverified", { reason: "UNKNOWN_OR_OVERLAPPING_HS_BASKET" })]);
    const fingerprint = createHash("sha256").update(key).digest("hex");
    const resultKey = `${fingerprint}:${months}:${options.categoryId ?? "TOTAL"}:${periods.at(-1)}`;
    const cached = results.get(resultKey);
    if (cached && cached.expires > now()) return structuredClone(cached.value);
    if (resultFlights.has(resultKey)) return structuredClone(await resultFlights.get(resultKey)!);
    if (resultFlights.size >= RESULT_LIMIT) return empty(selected.map((service) => status(service, "unavailable", { reason: "CONCURRENT_REQUEST_LIMIT" })));
    const context: Context = { key, fingerprint, deadline: Date.now() + budget, requests: 0 };
    const work = (async () => {
      const result = empty([]);
      if (proxy) {
        const tasks = blocks(periods).flatMap((block) => [...new Set(proxy.codes)].map((code) => () => loadBlock(context, "hs", block, code)));
        const settled = await pooled(tasks);
        const byPeriod = new Map<string, Map<string, number>>();
        for (const item of settled) if (item.status === "fulfilled") for (const row of item.value.rows) {
          const values = byPeriod.get(row.period) ?? new Map<string, number>();
          values.set(row.code, row.exports);
          byPeriod.set(row.period, values);
        }
        for (const p of periods) {
          const values = byPeriod.get(p);
          if (!values || proxy.codes.some((code) => !values.has(code))) continue;
          const valueUsd = [...new Set(proxy.codes)].reduce((sum, code) => sum + values.get(code)!, 0);
          if (!Number.isFinite(valueUsd) || valueUsd > Number.MAX_SAFE_INTEGER) continue;
          result.observations.push({ period: p, categoryId: proxy.key, categoryName: proxy.label, valueUsd, classification: "HS", geo: "KR", sourceFile: `${SOURCE} · ${proxy.label}` });
        }
        result.providers.push(summarize("hs", settled, result.observations.length, months, result.observations.at(-1)?.period ?? null));
        return result;
      }
      const settled = await pooled(blocks(periods).map((block) => () => loadBlock(context, "total", block)));
      const monthly = settled.flatMap((item) => item.status === "fulfilled" ? item.value.rows : []).sort((a, b) => a.period.localeCompare(b.period));
      result.exports = monthly.map((row) => ({ period: row.period, valueUsd: row.exports }));
      result.imports = monthly.map((row) => ({ period: row.period, valueUsd: row.imports }));
      result.providers.push(summarize("total", settled, monthly.length, months, monthly.at(-1)?.period ?? null));
      // Query the newest validated world-total month, or the latest completed month.
      // Country shares need the same month's world denominator, never country sums.
      const countryPeriod = monthly.at(-1)?.period ?? periods.at(-1)!;
      const countries = await pooled([() => loadBlock(context, "destinations", { start: countryPeriod, end: countryPeriod })]);
      const rows = countries.flatMap((item) => item.status === "fulfilled" ? item.value.rows : []);
      const world = monthly.find((row) => row.period === countryPeriod)?.exports;
      const sum = rows.reduce((value, row) => value + row.exports, 0);
      // This endpoint requests every country, so a material shortfall is also a
      // mismatch (publication/revision differences or incomplete coverage).
      const coherent = world != null && world > 0 && Number.isFinite(sum) && Math.abs(sum - world) <= Math.max(1, rows.length, world * 1e-8);
      result.destinations = { period: rows.length ? countryPeriod : "", source: SOURCE, rows: rows.map((row) => ({ partnerCode: row.code, name: row.name, valueUsd: row.exports, share: coherent ? row.exports / world! : null })).sort((a, b) => b.valueUsd - a.valueUsd).slice(0, 18) };
      const destinationStatus = summarize("destinations", countries, rows.length, 1, rows.length ? countryPeriod : null);
      if (rows.length && !coherent) { destinationStatus.state = "partial"; destinationStatus.reasonCode = "WORLD_DENOMINATOR_UNVERIFIED"; destinationStatus.message = "국가별 금액은 확인했지만 같은 월의 전체 수출액과 일치 여부를 확인할 수 없어 비중을 표시하지 않습니다."; }
      result.providers.push(destinationStatus);
      return result;
    })();
    resultFlights.set(resultKey, work);
    try {
      const result = await work;
      results.set(resultKey, { value: result, expires: now() + (result.providers.some((p) => ["invalid-key", "rate-limited", "unavailable"].includes(p.state)) ? 15_000 : 60_000) });
      prune(results, RESULT_LIMIT);
      return structuredClone(result);
    } finally { resultFlights.delete(resultKey); }
  }
  return { fetchCustomsTrade: fetchTrade };
}

const client = createCustomsTradeClient();
export const fetchCustomsTrade = client.fetchCustomsTrade;
