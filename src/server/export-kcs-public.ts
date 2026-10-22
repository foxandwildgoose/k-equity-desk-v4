/** Server-only, fixed Korea Customs public-site HS4 query. No login or API key. */
import { createHash } from "node:crypto";
import { CORE20_HS_PROXY } from "../lib/export-desk/hs-map.ts";
import type { TradeObservation } from "../lib/export-desk/parse-import.ts";
import type { ExportProviderStatus } from "../lib/export-desk/provider-status.ts";

export interface KcsPublicTradeOptions {
  categoryId: string;
  months?: number;
}
export interface KcsPublicTradeResult {
  observations: TradeObservation[];
  providers: ExportProviderStatus[];
  source: string;
}
interface Dependencies {
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  timeoutMs?: number;
  budgetMs?: number;
  maxRequests?: number;
  maxPages?: number;
}
interface Block {
  start: string;
  end: string;
}
interface Point {
  period: string;
  valueUsd: number;
}
interface Context {
  abort: AbortController;
  requests: number;
  failure?: KcsFailure;
}
type Row = Record<string, unknown>;
type State = ExportProviderStatus["state"];

const HOME = "https://tradedata.go.kr/cts/index.do";
const ENDPOINT = "https://tradedata.go.kr/cts/hmpg/retrieveTrade.do";
const SOURCE_URL = "https://tradedata.go.kr/cts/hmpg/openETS0100019Q.do?menuId=ETS_MNK_10200000";
const SOURCE =
  "관세청 수출입무역통계 공식 웹사이트 · 전국 HS4 · 월별 · 천 USD → USD · 수출 FOB · 비계절조정";
const BODY_LIMIT = 2_000_000;
const PAGE_SIZE = 15;
const CACHE_LIMIT = 128;
const RESULT_LIMIT = 32;
// The action, exact HS4 filters, monthly fields, paging and USD-thousand scale
// are corroborated by independent public consumers. This is the site's public
// AJAX action, not the authenticated data.go.kr expDlr (raw USD) protocol.
// hongvincent explicitly documents ttwgTpcd=1000 as "톤(TON), 천 달러":
// https://github.com/hongvincent/TradeData_Automation/blob/da1bc9e6bc673c14eb616b6af43c2ca982228837/py/tradedata_crawler.py#L28
// Henrywzh explicitly corrects the previous 1000x USD understatement:
// https://github.com/Henrywzh/alternative-data/blob/b256612362636e3e12d3d112dd9811dfaa7a5ee6/src/semiconductor_proxy_data/sources/korea_customs.py#L165
// HS4/paging identity; the published grouping function excludes HS2:
// https://github.com/Henrywzh/market-recap/blob/97bd3bd5dc4cc86fe728be38671195aba2b2d9bd/src/market_recap/sources/korea_customs.py#L46
class KcsFailure extends Error {
  readonly reason: string;
  readonly state: State;
  constructor(reason: string, state: State = "unverified") {
    super("관세청 공개 통계 응답을 검증하지 못했습니다.");
    this.reason = reason;
    this.state = state;
  }
}
const object = (value: unknown): Row | null =>
  value != null && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null;
const text = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
const subtotal = (value: unknown) =>
  /^(?:총계|합계|소계|누계|계|total|subtotal|grand\s*total)$/i.test(text(value));
function dollars(raw: unknown): number | null {
  const value = text(raw);
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value)) return null;
  const amount = Number(value.replace(/,/g, "")) * 1000;
  return Number.isFinite(amount) && amount >= 0 && amount <= Number.MAX_SAFE_INTEGER
    ? amount
    : null;
}
function periods(now: Date, months: number): string[] {
  const kst = new Date(now.getTime() + 9 * 60 * 60_000);
  return Array.from({ length: months }, (_, index) =>
    new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - months + index, 1))
      .toISOString()
      .slice(0, 7),
  );
}
function blocks(months: string[]): Block[] {
  const years = new Map<string, string[]>();
  for (const month of months)
    years.set(month.slice(0, 4), [...(years.get(month.slice(0, 4)) ?? []), month]);
  return [...years.values()]
    .map((months) => ({ start: months[0]!, end: months.at(-1)! }))
    .reverse();
}
function parseRows(rows: Row[], code: string, block: Block): Point[] {
  const points = new Map<string, { exports: number; imports: number }>();
  for (const item of rows) {
    if (subtotal(item.hsSgn) || subtotal(item.priodTitle) || /^\d{4}$/.test(text(item.priodTitle)))
      continue;
    const hs = text(item.hsSgn);
    if (hs !== code) {
      if (/^\d{6}(?:\d{4})?$/.test(hs) && hs.startsWith(code)) continue; // Descendants never substitute for an exact aggregate.
      throw new KcsFailure("HS_IDENTITY_MISMATCH");
    }
    for (const name of ["cntyCd", "cntyNm", "cntyEnglNm", "statCd", "statCdCntnKor1"]) {
      const country = text(item[name]);
      if (country && !/^(?:0|00|W|WLD|WORLD|ALL|전세계|전체|총계)$/i.test(country))
        throw new KcsFailure("NATIONAL_SCOPE_MISMATCH");
    }
    const match = text(item.priodTitle).match(/^(\d{4})[.-](0[1-9]|1[0-2])$/);
    const period = match ? `${match[1]}-${match[2]}` : "";
    if (!period || period < block.start || period > block.end)
      throw new KcsFailure("MONTH_IDENTITY_MISMATCH");
    const exports = dollars(item.expUsdAmt),
      imports = dollars(item.impUsdAmt);
    if (exports == null || imports == null) throw new KcsFailure("USD_THOUSAND_VALUE_INVALID");
    const previous = points.get(period);
    if (previous && (previous.exports !== exports || previous.imports !== imports))
      throw new KcsFailure("CONFLICTING_DUPLICATE");
    points.set(period, { exports, imports });
  }
  return [...points].map(([period, value]) => ({ period, valueUsd: value.exports }));
}
function cookieHeader(headers: Headers): string {
  // Only anonymous cookies supplied by the fixed official homepage are reused.
  // No browser cookies, user credentials or externally supplied cookies enter here.
  const extended = headers as Headers & { getSetCookie?: () => string[] };
  const cookies =
    extended.getSetCookie?.() ?? (headers.get("set-cookie") ? [headers.get("set-cookie")!] : []);
  if (cookies.length > 16) throw new KcsFailure("SESSION_COOKIE_LIMIT");
  return cookies
    .map((cookie) => {
      const pair = cookie.split(";", 1)[0]!;
      if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+=[\x21-\x2B\x2D-\x3A\x3C-\x7E]{0,4096}$/.test(pair))
        throw new KcsFailure("SESSION_COOKIE_INVALID");
      return pair;
    })
    .join("; ");
}
function prune<T>(map: Map<string, T>, limit: number) {
  while (map.size > limit) map.delete(map.keys().next().value!);
}

export function createKcsPublicTradeClient(dependencies: Dependencies = {}) {
  const fetcher = dependencies.fetch ?? globalThis.fetch,
    now = dependencies.now ?? (() => new Date());
  const timeoutMs = Math.max(10, Math.min(10_000, dependencies.timeoutMs ?? 6_000));
  const budgetMs = Math.max(10, Math.min(18_000, dependencies.budgetMs ?? 12_000));
  const maxRequests = Math.max(1, Math.min(48, dependencies.maxRequests ?? 32));
  const maxPages = Math.max(1, Math.min(8, dependencies.maxPages ?? 8));
  const cache = new Map<string, { until: number; points: Point[]; checkedAt: string }>();
  const results = new Map<string, { until: number; value: KcsPublicTradeResult }>();
  const pending = new Map<string, Promise<KcsPublicTradeResult>>();
  let session: { cookie: string; until: number } | null = null;
  let sessionPending: Promise<string> | null = null;
  let active = 0;
  const queue: { wake: () => void; cancel: () => void }[] = [];
  async function acquire(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) throw new KcsFailure("SERIES_TIMEOUT", "unavailable");
    if (active >= 2)
      await new Promise<void>((resolve, reject) => {
        if (queue.length >= 64) {
          reject(new KcsFailure("CONCURRENT_REQUEST_LIMIT", "unavailable"));
          return;
        }
        const item = {
          wake: () => {
            signal.removeEventListener("abort", cancel);
            resolve();
          },
          cancel: () => {},
        };
        const cancel = () => {
          const index = queue.indexOf(item);
          if (index >= 0) queue.splice(index, 1);
          reject(new KcsFailure("SERIES_TIMEOUT", "unavailable"));
        };
        item.cancel = cancel;
        queue.push(item);
        signal.addEventListener("abort", cancel, { once: true });
      });
    else active++;
    return () => {
      const item = queue.shift();
      if (item) item.wake();
      else active--;
    };
  }
  async function request(
    context: Context,
    url: string,
    init: RequestInit = {},
    read = true,
  ): Promise<{ body: string; headers: Headers }> {
    if (context.abort.signal.aborted)
      throw context.failure ?? new KcsFailure("SERIES_TIMEOUT", "unavailable");
    if (context.requests >= maxRequests) throw new KcsFailure("REQUEST_BUDGET", "unavailable");
    context.requests++;
    const release = await acquire(context.abort.signal),
      controller = new AbortController();
    if (context.abort.signal.aborted) {
      release();
      throw context.failure ?? new KcsFailure("SERIES_TIMEOUT", "unavailable");
    }
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectGroup: (error: KcsFailure) => void = () => {};
    const abort = () => {
      controller.abort();
      void reader?.cancel().catch(() => {});
      rejectGroup(context.failure ?? new KcsFailure("SERIES_TIMEOUT", "unavailable"));
    };
    context.abort.signal.addEventListener("abort", abort, { once: true });
    const work = (async () => {
      const response = await fetcher(url, {
        ...init,
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
      });
      if (controller.signal.aborted || context.abort.signal.aborted) {
        void response.body?.cancel().catch(() => {});
        throw context.failure ?? new KcsFailure("REQUEST_TIMEOUT", "unavailable");
      }
      if (response.url && response.url !== url) throw new KcsFailure("UNEXPECTED_REDIRECT");
      if (!response.ok) {
        const error = new KcsFailure(
          `${url === HOME ? "BOOTSTRAP" : "DATA"}_HTTP_${response.status}`,
          response.status === 429 ? "rate-limited" : "unavailable",
        );
        context.failure = error;
        context.abort.abort();
        throw error;
      }
      const length = response.headers.get("content-length");
      if (length && (!/^\d+$/.test(length) || Number(length) > BODY_LIMIT))
        throw new KcsFailure("BODY_LIMIT");
      if (!read) {
        void response.body?.cancel().catch(() => {});
        return { body: "", headers: response.headers };
      }
      if (!response.body) throw new KcsFailure("EMPTY_BODY");
      reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: true });
      let body = "",
        bytes = 0;
      for (;;) {
        const chunk = await reader.read();
        if (controller.signal.aborted)
          throw context.failure ?? new KcsFailure("SERIES_TIMEOUT", "unavailable");
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > BODY_LIMIT) throw new KcsFailure("BODY_LIMIT");
        body += decoder.decode(chunk.value, { stream: true });
      }
      return { body: body + decoder.decode(), headers: response.headers };
    })();
    const deadline = new Promise<never>((_, reject) => {
      rejectGroup = reject;
      timer = setTimeout(() => {
        controller.abort();
        void reader?.cancel().catch(() => {});
        reject(new KcsFailure("REQUEST_TIMEOUT", "unavailable"));
      }, timeoutMs);
    });
    try {
      return await Promise.race([work, deadline]);
    } catch (error) {
      throw error instanceof KcsFailure
        ? error
        : new KcsFailure("TRANSPORT_OR_JSON_ERROR", "unavailable");
    } finally {
      if (timer) clearTimeout(timer);
      controller.abort();
      context.abort.signal.removeEventListener("abort", abort);
      void reader?.cancel().catch(() => {});
      release();
    }
  }
  async function bootstrap(context: Context): Promise<string> {
    if (session && session.until > now().getTime()) return session.cookie;
    if (sessionPending) return sessionPending;
    const work = (async () => {
      const response = await request(context, HOME, { headers: { Accept: "text/html" } }, false);
      const cookie = cookieHeader(response.headers);
      if (!context.abort.signal.aborted) session = { cookie, until: now().getTime() + 10 * 60_000 };
      return cookie;
    })();
    sessionPending = work;
    try {
      return await work;
    } finally {
      sessionPending = null;
    }
  }
  async function load(
    context: Context,
    code: string,
    block: Block,
  ): Promise<{ points: Point[]; checkedAt: string }> {
    const key = `${code}:${block.start}:${block.end}`,
      cached = cache.get(key);
    if (cached && cached.until > now().getTime()) return cached;
    const cookie = await bootstrap(context);
    const rows: Row[] = [],
      pages = new Set<string>();
    for (let page = 1; page <= maxPages; page++) {
      const form = new URLSearchParams({
        tradeKind: "ETS_MNK_1020000A",
        priodKind: "MON",
        priodFr: block.start.replace("-", ""),
        priodTo: block.end.replace("-", ""),
        statsBase: "acptDd",
        ttwgTpcd: "1000",
        showPagingLine: String(PAGE_SIZE),
        sortColumn: "",
        sortOrder: "",
        hsSgnGrpCol: "HS4_SGN",
        hsSgnWhrCol: "HS4_SGN",
        hsSgn: code,
        selectPaging: String(page),
      });
      const response = await request(context, ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          Referer: HOME,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: form.toString(),
      });
      let payload: Row | null;
      try {
        payload = object(JSON.parse(response.body));
      } catch {
        context.failure ??= new KcsFailure("RESPONSE_SCHEMA");
        context.abort.abort();
        throw context.failure;
      }
      if (
        !Array.isArray(payload?.items) ||
        payload.items.length > PAGE_SIZE ||
        payload.items.some((item) => !object(item))
      ) {
        context.failure ??= new KcsFailure("RESPONSE_SCHEMA");
        context.abort.abort();
        throw context.failure;
      }
      const items = payload.items as Row[];
      if (items.length) {
        const hash = createHash("sha256").update(JSON.stringify(items)).digest("hex");
        if (pages.has(hash)) throw new KcsFailure("REPEATED_PAGE");
        pages.add(hash);
        rows.push(...items);
      }
      if (items.length < PAGE_SIZE) {
        const points = parseRows(rows, code, block),
          checkedAt = now().toISOString();
        if (context.abort.signal.aborted)
          throw context.failure ?? new KcsFailure("SERIES_TIMEOUT", "unavailable");
        cache.set(key, {
          points,
          checkedAt,
          until: now().getTime() + (points.length ? 30 * 60_000 : 60_000),
        });
        prune(cache, CACHE_LIMIT);
        return { points, checkedAt };
      }
    }
    throw new KcsFailure("PAGE_LIMIT");
  }
  function output(
    state: State,
    reason: string,
    observations: TradeObservation[] = [],
    checkedAt = now().toISOString(),
  ): KcsPublicTradeResult {
    const messages: Partial<Record<State, string>> = {
      ok: "관세청 공식 웹사이트의 전국 HS4 월별 자료를 확인했습니다. 천 USD를 USD로 변환했습니다.",
      partial:
        "검증된 HS4 구성코드가 모두 있는 월만 표시합니다. 일부 월은 미공표 또는 조회 제한으로 누락되었습니다.",
      unverified:
        "공개 웹사이트 조회의 품목·기간·단위 또는 지원 HS 단위를 검증할 수 없어 해당 수치를 사용하지 않습니다.",
      unavailable: "관세청 공개 통계 연결 또는 제한 시간 내 조회에 실패했습니다.",
      "rate-limited": "관세청 공개 사이트의 요청 한도에 도달했습니다. 자동 재시도하지 않습니다.",
      empty: "완료된 월에 모든 구성코드가 확인되는 HS4 자료가 없습니다.",
    };
    return {
      observations,
      source: SOURCE,
      providers: [
        {
          id: "customs.public-item",
          name: "관세청 공개 웹통계 HS4",
          configured: true,
          state,
          reasonCode: reason,
          message: messages[state] ?? messages.unavailable!,
          checkedAt,
          asOf: observations.at(-1)?.period ?? null,
          recordCount: observations.length,
          sourceUrl: SOURCE_URL,
        },
      ],
    };
  }
  async function fetchTrade(options: KcsPublicTradeOptions): Promise<KcsPublicTradeResult> {
    const direct = options.categoryId.match(/^hs4:(\d{4})$/);
    const proxy =
      CORE20_HS_PROXY.find((item) => item.key === options.categoryId) ??
      (direct
        ? { key: options.categoryId, codes: [direct[1]!], label: `HS ${direct[1]}` }
        : undefined);
    if (!proxy) return output("unverified", "UNKNOWN_CATEGORY");
    if (proxy.codes.some((code) => !/^\d{4}$/.test(code)))
      return output("unverified", "HS_LEVEL_UNVERIFIED");
    const codes = [...new Set(proxy.codes)];
    const months = Math.max(
      1,
      Math.min(120, Math.trunc(Number.isFinite(options.months) ? options.months! : 36)),
    );
    const window = periods(now(), months),
      key = `${proxy.key}:${months}:${window.at(-1)}`;
    const cached = results.get(key);
    if (cached && cached.until > now().getTime()) return structuredClone(cached.value);
    if (pending.has(key)) return structuredClone(await pending.get(key)!);
    if (pending.size >= RESULT_LIMIT) return output("unavailable", "CONCURRENT_REQUEST_LIMIT");
    const context: Context = { abort: new AbortController(), requests: 0 };
    const timer = setTimeout(() => {
      context.failure ??= new KcsFailure("SERIES_TIMEOUT", "unavailable");
      context.abort.abort();
    }, budgetMs);
    const work = (async () => {
      try {
        const tasks = blocks(window).flatMap((block) => codes.map((code) => ({ code, block })));
        const errors: KcsFailure[] = [],
          checked: string[] = [];
        const byPeriod = new Map<string, Map<string, number>>();
        let next = 0;
        await Promise.all(
          Array.from({ length: Math.min(2, tasks.length) }, async () => {
            for (;;) {
              const task = tasks[next++];
              if (!task) return;
              try {
                const value = await load(context, task.code, task.block);
                checked.push(value.checkedAt);
                for (const point of value.points) {
                  const month = byPeriod.get(point.period) ?? new Map<string, number>();
                  month.set(task.code, point.valueUsd);
                  byPeriod.set(point.period, month);
                }
              } catch (error) {
                errors.push(
                  error instanceof KcsFailure
                    ? error
                    : new KcsFailure("TRANSPORT_OR_JSON_ERROR", "unavailable"),
                );
              }
            }
          }),
        );
        const observations: TradeObservation[] = [];
        for (const period of window) {
          const values = byPeriod.get(period);
          if (!values || codes.some((code) => !values.has(code))) continue;
          const valueUsd = codes.reduce((sum, code) => sum + values.get(code)!, 0);
          if (!Number.isFinite(valueUsd) || valueUsd > Number.MAX_SAFE_INTEGER) continue;
          observations.push({
            period,
            categoryId: proxy.key,
            categoryName: proxy.label,
            classification: "HS",
            geo: "KR",
            valueUsd,
            sourceFile: `${SOURCE} · ${proxy.label}`,
          });
        }
        const error = context.failure ?? errors[0];
        return output(
          observations.length
            ? errors.length || observations.length < months
              ? "partial"
              : "ok"
            : (error?.state ?? "empty"),
          error?.reason ?? (observations.length < months ? "INCOMPLETE_MONTHS" : "API_OK"),
          observations,
          checked.sort().at(-1),
        );
      } catch (error) {
        const failure =
          error instanceof KcsFailure
            ? error
            : new KcsFailure("TRANSPORT_OR_JSON_ERROR", "unavailable");
        return output(failure.state, failure.reason);
      }
    })();
    pending.set(key, work);
    try {
      const value = await work;
      results.set(key, { value, until: now().getTime() + 60_000 });
      prune(results, RESULT_LIMIT);
      return structuredClone(value);
    } finally {
      clearTimeout(timer);
      context.abort.abort();
      pending.delete(key);
    }
  }
  return { fetchKcsPublicTrade: fetchTrade };
}
export const fetchKcsPublicTrade = createKcsPublicTradeClient().fetchKcsPublicTrade;
