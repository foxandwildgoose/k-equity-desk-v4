import { createHash } from "node:crypto";
import { crc32, inflateRawSync } from "node:zlib";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { OpenDartStatus } from "../lib/opendart-status.ts";

/** OpenDART publishes receipt dates, not intraday receipt timestamps. */
export interface OpenDartDisclosure {
  receiptNo: string;
  receiptDate: string;
  corpCode: string;
  stockCode: string;
  corpName: string;
  reportName: string;
  submitter: string;
  market: "Y" | "K" | "N" | "E";
}

export interface OpenDartResult {
  items: OpenDartDisclosure[];
  status: OpenDartStatus;
}

interface DisclosureOptions {
  stockCode?: string;
  days?: number;
}

interface ClientDependencies {
  fetch?: typeof globalThis.fetch;
  getApiKey?: () => string | undefined;
  now?: () => number;
  timeoutMs?: number;
}

type FailureState = Exclude<OpenDartStatus["state"], "ok" | "empty" | "missing-key">;

const API_ORIGIN = "https://opendart.fss.or.kr";
const DAY_MS = 86_400_000;
const JSON_LIMIT = 2 * 1_024 * 1_024;
const ZIP_LIMIT = 16 * 1_024 * 1_024;
const XML_LIMIT = 64 * 1_024 * 1_024;
const RESULT_TTL = 90_000;
const FAILURE_TTL = 15_000;
const CORP_TTL = 12 * 60 * 60 * 1_000;
const MAX_CACHE = 128;

const messages: Record<OpenDartStatus["state"], string> = {
  ok: "OpenDART 공식 API에서 전자공시를 조회했습니다.",
  empty: "OpenDART 공식 API에 해당 기간의 전자공시가 없습니다.",
  "missing-key": "서버에 OPENDART_API_KEY가 등록되지 않았습니다.",
  "invalid-key": "OpenDART 인증키 또는 접근 권한을 확인해 주세요.",
  "rate-limited": "OpenDART 요청 한도에 도달했습니다. 잠시 후 다시 조회합니다.",
  unavailable: "OpenDART 공식 API 응답을 확인할 수 없습니다. 잠시 후 다시 조회합니다.",
  "company-not-found": "공식 기업 고유번호 목록에서 해당 종목코드를 찾을 수 없습니다.",
  "invalid-request": "OpenDART 조회 조건을 확인해 주세요.",
};

class OpenDartError extends Error {
  state: FailureState;
  constructor(state: FailureState = "unavailable") {
    super(messages[state]);
    this.name = "OpenDartError";
    this.state = state;
  }
}

function kstDate(now: number): string {
  return new Date(now + 9 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

function validCompactDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{8}$/.test(value)) return false;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso;
}

function dateRange(today: string, days: number, company: boolean) {
  const end = new Date(`${today}T00:00:00Z`);
  let start = new Date(end.getTime() - days * DAY_MS);
  if (!company) {
    // Omitting corp_code is limited to three calendar months by OpenDART.
    const earliest = new Date(end);
    earliest.setUTCMonth(earliest.getUTCMonth() - 3);
    if (start < earliest) start = earliest;
  }
  return { begin: start.toISOString().slice(0, 10).replaceAll("-", ""), end: today.replaceAll("-", "") };
}

function plainText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value)) return;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function responseState(status: unknown): "ok" | "empty" {
  if (status === "000") return "ok";
  if (status === "013") return "empty";
  if (["010", "011", "012", "901"].includes(String(status))) throw new OpenDartError("invalid-key");
  if (status === "020") throw new OpenDartError("rate-limited");
  if (["021", "100", "101"].includes(String(status))) throw new OpenDartError("invalid-request");
  throw new OpenDartError();
}

function parseList(payload: unknown, range: { begin: string; end: string }, stockCode?: string, corpCode?: string): OpenDartDisclosure[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new OpenDartError();
  const body = payload as Record<string, unknown>;
  if (responseState(body.status) === "empty") return [];
  if (!Array.isArray(body.list) || body.list.length === 0 || body.list.length > 100) throw new OpenDartError();
  const items: OpenDartDisclosure[] = [];
  for (const candidate of body.list) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new OpenDartError();
    const row = candidate as Record<string, unknown>;
    const receiptNo = row.rcept_no;
    const receiptDate = row.rcept_dt;
    const company = row.corp_code;
    const stock = row.stock_code;
    const market = row.corp_cls;
    const corpName = plainText(row.corp_name, 200);
    const reportName = plainText(row.report_nm, 500);
    const submitter = plainText(row.flr_nm, 200);
    if (
      typeof receiptNo !== "string" || !/^\d{14}$/.test(receiptNo) ||
      !validCompactDate(receiptDate) || receiptNo.slice(0, 8) !== receiptDate ||
      receiptDate < range.begin || receiptDate > range.end ||
      typeof company !== "string" || !/^\d{8}$/.test(company) ||
      typeof stock !== "string" || !/^[0-9A-Z]{6}$/.test(stock) ||
      !["Y", "K", "N", "E"].includes(String(market)) ||
      !corpName || !reportName || !submitter ||
      (stockCode !== undefined && stock !== stockCode) ||
      (corpCode !== undefined && company !== corpCode)
    ) throw new OpenDartError();
    // Market-wide requests intentionally display listed KOSPI/KOSDAQ companies.
    if (!stockCode && market !== "Y" && market !== "K") continue;
    items.push({
      receiptNo,
      receiptDate: `${receiptDate.slice(0, 4)}-${receiptDate.slice(4, 6)}-${receiptDate.slice(6, 8)}`,
      corpCode: company,
      stockCode: stock,
      corpName,
      reportName,
      submitter,
      market: market as OpenDartDisclosure["market"],
    });
  }
  return items;
}

function extractCorporationXml(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ensure = (offset: number, length: number) => {
    if (offset < 0 || length < 0 || offset + length > bytes.length) throw new OpenDartError();
  };
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0 || view.getUint16(endOffset + 4, true) !== 0 || view.getUint16(endOffset + 6, true) !== 0) throw new OpenDartError();
  const entries = view.getUint16(endOffset + 10, true);
  const directorySize = view.getUint32(endOffset + 12, true);
  const directoryOffset = view.getUint32(endOffset + 16, true);
  if (!entries || entries > 8 || view.getUint16(endOffset + 8, true) !== entries || directoryOffset + directorySize !== endOffset) throw new OpenDartError();
  ensure(directoryOffset, directorySize);
  let cursor = directoryOffset;
  let selected: { local: number; compressed: number; expanded: number; method: number; flags: number; checksum: number; name: string } | undefined;
  for (let index = 0; index < entries; index++) {
    ensure(cursor, 46);
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new OpenDartError();
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const expanded = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const recordLength = 46 + nameLength + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
    ensure(cursor, recordLength);
    if (cursor + recordLength > endOffset || view.getUint16(cursor + 34, true) !== 0) throw new OpenDartError();
    const name = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (name.toUpperCase() === "CORPCODE.XML") {
      if (selected || (flags & 1) || ![0, 8].includes(method) || !expanded || expanded > XML_LIMIT || compressed > ZIP_LIMIT) throw new OpenDartError();
      selected = { local: view.getUint32(cursor + 42, true), compressed, expanded, method, flags, checksum: view.getUint32(cursor + 16, true), name };
    }
    cursor += recordLength;
  }
  if (!selected || cursor !== endOffset) throw new OpenDartError();
  const { local, compressed, expanded, method, flags, checksum, name } = selected;
  ensure(local, 30);
  if (view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method) throw new OpenDartError();
  const nameLength = view.getUint16(local + 26, true);
  const dataOffset = local + 30 + nameLength + view.getUint16(local + 28, true);
  ensure(local + 30, nameLength);
  ensure(dataOffset, compressed);
  if (dataOffset + compressed > directoryOffset || new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(local + 30, local + 30 + nameLength)) !== name) throw new OpenDartError();
  if (!(flags & 8) && (view.getUint32(local + 14, true) !== checksum || view.getUint32(local + 18, true) !== compressed || view.getUint32(local + 22, true) !== expanded)) throw new OpenDartError();
  if (flags & 8) {
    let descriptor = dataOffset + compressed;
    ensure(descriptor, 12);
    if (view.getUint32(descriptor, true) === 0x08074b50) descriptor += 4;
    ensure(descriptor, 12);
    if (descriptor + 12 > directoryOffset || view.getUint32(descriptor, true) !== checksum || view.getUint32(descriptor + 4, true) !== compressed || view.getUint32(descriptor + 8, true) !== expanded) throw new OpenDartError();
  }
  const encoded = bytes.subarray(dataOffset, dataOffset + compressed);
  // The inflater enforces the actual output bound, independently of ZIP size metadata.
  const output = method === 0 ? encoded : inflateRawSync(encoded, { maxOutputLength: XML_LIMIT });
  if (output.length !== expanded || output.length > XML_LIMIT || crc32(output) !== checksum) throw new OpenDartError();
  return output;
}

function parseCorporationArchive(bytes: Uint8Array): Map<string, string> {
  // XML error responses (e.g. an invalid key) replace the ZIP on this endpoint.
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    const response = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const status = response.match(/<status>\s*(\d{3})\s*<\/status>/)?.[1];
    responseState(status);
    throw new OpenDartError();
  }
  const xmlBytes = extractCorporationXml(bytes);
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(xmlBytes);
  if (!/^\s*(?:<\?xml[^>]*\?>\s*)?<result>/.test(xml) || !/<\/result>\s*$/.test(xml) || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new OpenDartError();
  const parsed = new XMLParser({ parseTagValue: false, parseAttributeValue: false, processEntities: false, ignoreAttributes: false, ignoreDeclaration: true, trimValues: true }).parse(xml) as Record<string, unknown>;
  if (Object.keys(parsed).length !== 1 || !parsed.result || typeof parsed.result !== "object" || Array.isArray(parsed.result)) throw new OpenDartError();
  const root = parsed.result as Record<string, unknown>;
  if (Object.keys(root).some((key) => key !== "list") || !root.list) throw new OpenDartError();
  const records = Array.isArray(root.list) ? root.list : [root.list];
  if (records.length > 500_000) throw new OpenDartError();
  const mapping = new Map<string, string>();
  for (const record of records) {
    if (!record || typeof record !== "object" || Array.isArray(record)) throw new OpenDartError();
    const row = record as Record<string, unknown>;
    // Only direct scalar records are meaningful; nested/commented lookalikes are never mappings.
    if (Object.entries(row).some(([key, value]) => !["corp_code", "corp_name", "corp_eng_name", "stock_code", "modify_date"].includes(key) || typeof value !== "string" || value.length > 1_000)) throw new OpenDartError();
    const company = row.corp_code;
    const stock = row.stock_code;
    if (typeof company !== "string" || !/^\d{8}$/.test(company) || typeof stock !== "string") throw new OpenDartError();
    if (!stock) continue; // Unlisted corporations have an empty stock_code.
    if (!/^[0-9A-Z]{6}$/.test(stock) || (mapping.has(stock) && mapping.get(stock) !== company)) throw new OpenDartError();
    mapping.set(stock, company);
  }
  if (!mapping.size) throw new OpenDartError();
  return mapping;
}

/** Isolated dependency seam for fixture tests; production always reads its server environment. */
export function createOpenDartClient(dependencies: ClientDependencies = {}) {
  const request = dependencies.fetch ?? globalThis.fetch;
  const getApiKey = dependencies.getApiKey ?? (() => process.env.OPENDART_API_KEY);
  const now = dependencies.now ?? Date.now;
  const timeoutMs = Math.max(1, Math.min(dependencies.timeoutMs ?? 12_000, 20_000));
  let activeKey = "";
  let keyGeneration = 0;
  let corporationMap: { key: string; expires: number; map: Map<string, string> } | undefined;
  let corporationPending: { key: string; promise: Promise<Map<string, string>> } | undefined;
  let corporationFailure: { key: string; expires: number; state: FailureState } | undefined;
  let cooldown: { key: string; expires: number; state: FailureState } | undefined;
  const cache = new Map<string, { expires: number; result: OpenDartResult }>();
  const pending = new Map<string, Promise<OpenDartResult>>();

  function result(state: OpenDartStatus["state"], configured: boolean, items: OpenDartDisclosure[] = []): OpenDartResult {
    return { items, status: { configured, state, message: messages[state], checkedAt: new Date(now()).toISOString(), fallbackUsed: false } };
  }

  async function bytes(path: string, apiKey: string, params: Record<string, string>, maxBytes: number): Promise<Uint8Array> {
    const url = new URL(path, API_ORIGIN);
    url.search = new URLSearchParams({ crtfc_key: apiKey, ...params }).toString();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const operation = async () => {
      const response = await request(url, {
        method: "GET", signal: controller.signal, redirect: "error", cache: "no-store",
        headers: { Accept: path.endsWith(".json") ? "application/json" : "application/zip, application/xml" },
      });
      if (response.status === 429) throw new OpenDartError("rate-limited");
      if (!response.ok || !response.body) throw new OpenDartError();
      const length = response.headers.get("content-length");
      if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new OpenDartError();
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let lengthRead = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          lengthRead += chunk.value.byteLength;
          if (lengthRead > maxBytes) throw new OpenDartError();
          chunks.push(chunk.value);
        }
      } finally {
        reader.releaseLock();
      }
      const output = new Uint8Array(lengthRead);
      let offset = 0;
      for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
      return output;
    };
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new OpenDartError()); }, timeoutMs);
        }),
      ]);
    } catch (error) {
      controller.abort();
      // fetch errors can include the credential-bearing URL. Never forward them.
      throw error instanceof OpenDartError ? error : new OpenDartError();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function corporations(apiKey: string, fingerprint: string, generation: number): Promise<Map<string, string>> {
    if (corporationMap?.key === fingerprint && corporationMap.expires > now()) return corporationMap.map;
    if (corporationFailure?.key === fingerprint && corporationFailure.expires > now()) throw new OpenDartError(corporationFailure.state);
    if (corporationPending?.key === fingerprint) return corporationPending.promise;
    const promise = (async () => {
      try {
        const map = parseCorporationArchive(await bytes("/api/corpCode.xml", apiKey, {}, ZIP_LIMIT));
        if (activeKey === fingerprint && keyGeneration === generation) corporationMap = { key: fingerprint, expires: now() + CORP_TTL, map };
        return map;
      } catch (error) {
        const safe = error instanceof OpenDartError ? error : new OpenDartError();
        if (activeKey === fingerprint && keyGeneration === generation) corporationFailure = { key: fingerprint, expires: now() + FAILURE_TTL, state: safe.state };
        throw safe;
      } finally {
        if (activeKey === fingerprint && keyGeneration === generation) corporationPending = undefined;
      }
    })();
    corporationPending = { key: fingerprint, promise };
    return promise;
  }

  async function fetchDisclosures(options: DisclosureOptions = {}): Promise<OpenDartResult> {
    const apiKey = getApiKey()?.trim();
    if (!apiKey || !/^[a-fA-F0-9]{40}$/.test(apiKey)) {
      keyGeneration++;
      activeKey = "";
      corporationMap = undefined; corporationPending = undefined; corporationFailure = undefined; cooldown = undefined;
      cache.clear(); pending.clear();
    }
    if (!apiKey) return result("missing-key", false);
    if (!/^[a-fA-F0-9]{40}$/.test(apiKey)) return result("invalid-key", true);
    const fingerprint = createHash("sha256").update(apiKey).digest("hex");
    if (activeKey !== fingerprint) {
      keyGeneration++;
      activeKey = fingerprint;
      corporationMap = undefined; corporationPending = undefined; corporationFailure = undefined; cooldown = undefined;
      cache.clear(); pending.clear();
    }
    const generation = keyGeneration;
    const stockCode = options.stockCode;
    const days = options.days ?? (stockCode ? 120 : 7);
    if ((stockCode !== undefined && (typeof stockCode !== "string" || !/^[0-9A-Z]{6}$/.test(stockCode))) || !Number.isInteger(days) || days < 1 || days > 120) return result("invalid-request", true);
    const range = dateRange(kstDate(now()), days, !!stockCode);
    const cacheKey = `${fingerprint}:${stockCode ?? "market"}:${range.begin}:${range.end}`;
    const existing = cache.get(cacheKey);
    if (existing && existing.expires > now()) return structuredClone(existing.result);
    if (cooldown?.key === fingerprint && cooldown.expires > now()) return result(cooldown.state, true);
    const inFlight = pending.get(cacheKey);
    if (inFlight) return structuredClone(await inFlight);
    if (pending.size >= MAX_CACHE) return result("unavailable", true);
    const operation = (async () => {
      let response: OpenDartResult;
      try {
        let company: string | undefined;
        if (stockCode) {
          company = (await corporations(apiKey, fingerprint, generation)).get(stockCode);
          if (!company) throw new OpenDartError("company-not-found");
        }
        const list = async (market?: "Y" | "K") => {
          const body = await bytes("/api/list.json", apiKey, {
            bgn_de: range.begin, end_de: range.end, page_no: "1", page_count: "100", sort: "date", sort_mth: "desc",
            ...(company ? { corp_code: company } : { corp_cls: market! }),
          }, JSON_LIMIT);
          return parseList(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)), range, stockCode, company);
        };
        const rows = company ? await list() : (await Promise.all([list("Y"), list("K")])).flat();
        const unique = new Map(rows.map((row) => [row.receiptNo, row]));
        const items = [...unique.values()].sort((a, b) => b.receiptNo.localeCompare(a.receiptNo));
        response = result(items.length ? "ok" : "empty", true, items);
      } catch (error) {
        const state = error instanceof OpenDartError ? error.state : "unavailable";
        response = result(state, true);
        if (activeKey === fingerprint && keyGeneration === generation && (state === "invalid-key" || state === "rate-limited")) {
          cooldown = { key: fingerprint, expires: now() + (state === "invalid-key" ? 90_000 : 60_000), state };
        }
      }
      if (activeKey === fingerprint && keyGeneration === generation) {
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
        cache.set(cacheKey, { expires: now() + (["ok", "empty"].includes(response.status.state) ? RESULT_TTL : FAILURE_TTL), result: response });
      }
      return response;
    })();
    pending.set(cacheKey, operation);
    try { return structuredClone(await operation); }
    finally { if (pending.get(cacheKey) === operation) pending.delete(cacheKey); }
  }

  return { fetchDisclosures };
}

const client = createOpenDartClient();

/** Server-only: the key is resolved at request time and is never returned to callers. */
export function fetchOpenDartDisclosures(options?: DisclosureOptions): Promise<OpenDartResult> {
  return client.fetchDisclosures(options);
}
