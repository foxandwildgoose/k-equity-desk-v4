import { validateFlowRequest } from "./chart-flow-request.ts";
/** Server-only dated market observations; no credentials or raw provider errors leave this module. */
import {
  dedupeFlowObservations,
  emptyChartFlow,
  flowRequestKey,
  isFlowDate,
  nullableFlowNumber,
  type FlowMetric,
  type FlowMetricId,
  type FlowObservation,
  type FlowRequest,
  type FlowResponse,
} from "../lib/charts/hts-flow.ts";

const NAVER = "https://m.stock.naver.com";
const KIS = "https://openapi.koreainvestment.com:9443";
const CREDIT_PATH = "/uapi/domestic-stock/v1/quotations/daily-credit-balance";
const TRUST_PATH = "/uapi/domestic-stock/v1/quotations/investor-trade-by-stock-daily";
const SOURCES = {
  foreign: "네이버 금융 · 종목 투자자 동향",
  credit: "한국투자증권 · 신용잔고 일별추이 [0476]",
  investmentTrust: "한국투자증권 · 종목별 투자자매매동향(일별)",
};
type Row = Record<string, unknown>;

export { validateFlowRequest } from "./chart-flow-request.ts";

function isoDate(raw: unknown): string | null {
  const digits = String(raw ?? "").replaceAll("-", "");
  if (!/^\d{8}$/.test(digits)) return null;
  const date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return isFlowDate(date) ? date : null;
}
function percentage(raw: unknown): number | null {
  const n = nullableFlowNumber(raw);
  return n !== null && n >= 0 && n <= 100 ? n : null;
}
function observation(
  date: string,
  value: number | null,
  id: FlowMetricId,
  field: string,
  fetchedAt: string,
): FlowObservation {
  return {
    date,
    value,
    unit: id === "investmentTrust" ? "주" : "%",
    source: SOURCES[id],
    sourceField: field,
    asOf: date,
    dateBasis: id === "credit" ? "settlement-date" : "trade-date",
    fetchedAt,
    availableAt: null,
    final: null,
    derived: false,
  };
}

export function parseNaverForeign(rows: Row[], code: string, fetchedAt: string): FlowObservation[] {
  return dedupeFlowObservations(
    rows.flatMap((row) => {
      if (row.itemCode && row.itemCode !== code) throw new Error("공급자 종목 불일치");
      const date = isoDate(row.bizdate ?? row.localBizDate);
      return date
        ? [
            observation(
              date,
              percentage(row.foreignerHoldRatio),
              "foreign",
              "foreignerHoldRatio",
              fetchedAt,
            ),
          ]
        : [];
    }),
  );
}

/** Official KIS examples at 277ec0eb7a9b7f63b6807829286c80f36649dad2.
 * credit: whole LOAN ratio, settlement date; never whole STOCK LENDING ratio.
 * trust: ivtr_* only, never orgn_* institutional totals or fund_* pension funds.
 */
export function parseKisFlow(
  rows: Row[],
  id: "credit" | "investmentTrust",
  fetchedAt: string,
): FlowObservation[] {
  return dedupeFlowObservations(
    rows.flatMap((row) => {
      const date = isoDate(id === "credit" ? row.stlm_date : row.stck_bsop_date);
      if (!date) return [];
      if (id === "credit")
        return [
          observation(
            date,
            percentage(row.whol_loan_rmnd_rate),
            id,
            "whol_loan_rmnd_rate",
            fetchedAt,
          ),
        ];
      const result = observation(
        date,
        nullableFlowNumber(row.ivtr_ntby_qty),
        id,
        "ivtr_ntby_qty",
        fetchedAt,
      );
      result.buy = nullableFlowNumber(row.ivtr_shnu_vol);
      result.sell = nullableFlowNumber(row.ivtr_seln_vol);
      if (result.buy !== null && result.buy < 0) result.buy = null;
      if (result.sell !== null && result.sell < 0) result.sell = null;
      if (result.value === null && result.buy !== null && result.sell !== null) {
        result.value = result.buy - result.sell;
        result.derived = true;
        result.formula = "ivtr_shnu_vol − ivtr_seln_vol";
        result.sourceField = "ivtr_shnu_vol,ivtr_seln_vol";
      }
      return [result];
    }),
  );
}

class FlowHttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`공급자 HTTP ${status}`);
    this.status = status;
  }
}
function abortError(): DOMException {
  return new DOMException("요청 취소", "AbortError");
}
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const aborted = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", aborted);
      resolve();
    }, ms);
    signal.addEventListener("abort", aborted, { once: true });
  });
}
export interface FlowServiceOptions {
  fetch?: typeof fetch;
  credentials?: () => { appKey?: string; appSecret?: string };
  now?: () => number;
  timeoutMs?: number;
  retryDelayMs?: number;
  cacheTtlMs?: number;
  maxPages?: number;
}

/** Factory permits fixture injection in tests; the production singleton always uses real providers. */
export function createLegacyChartFlowService(options: FlowServiceOptions = {}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const credentials =
    options.credentials ??
    (() => ({ appKey: process.env.KIS_APP_KEY, appSecret: process.env.KIS_APP_SECRET }));
  const cache = new Map<string, { until: number; result: FlowResponse }>();
  const inflight = new Map<
    string,
    { controller: AbortController; promise: Promise<FlowResponse>; users: number }
  >();
  let token: { value: string; expires: number } | null = null;
  let tokenRequest: Promise<string> | null = null;
  let lastTokenRequest = -Infinity;
  let kisQueue: Promise<unknown> = Promise.resolve();

  async function json(
    url: string,
    signal: AbortSignal,
    init: RequestInit = {},
    retries = 1,
  ): Promise<{ body: unknown; headers: Headers }> {
    const parsed = new URL(url);
    if (![NAVER, KIS].includes(parsed.origin) || parsed.username || parsed.password)
      throw new Error("허용되지 않은 공급자 URL");
    for (let attempt = 0; ; attempt++) {
      signal.throwIfAborted();
      const timeout = AbortSignal.timeout(options.timeoutMs ?? 7_000);
      try {
        const response = await fetcher(url, {
          ...init,
          redirect: "error",
          signal: AbortSignal.any([signal, timeout]),
          headers: {
            Accept: "application/json",
            "User-Agent": "KoreaEquityDesk/1.0",
            Referer: `${NAVER}/`,
            ...init.headers,
          },
        });
        if (!response.ok) throw new FlowHttpError(response.status);
        const text = await response.text();
        if (text.length > 2_000_000) throw new Error("공급자 응답 크기 초과");
        return { body: JSON.parse(text), headers: response.headers };
      } catch (error) {
        if (signal.aborted) throw abortError();
        const retryable =
          error instanceof FlowHttpError
            ? error.status === 429 || error.status >= 500
            : timeout.aborted;
        if (!retryable || attempt >= retries) throw error;
        await delay((options.retryDelayMs ?? 400) * (attempt + 1), signal);
      }
    }
  }

  async function accessToken(signal: AbortSignal): Promise<string> {
    if (token && token.expires > now() + 60_000) return token.value;
    if (tokenRequest) return tokenRequest;
    if (now() - lastTokenRequest < 60_000) throw new Error("공급자 인증 재시도 대기");
    const { appKey, appSecret } = credentials();
    lastTokenRequest = now();
    tokenRequest = (async () => {
      const { body } = await json(
        `${KIS}/oauth2/tokenP`,
        signal,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            grant_type: "client_credentials",
            appkey: appKey,
            appsecret: appSecret,
          }),
        },
        0,
      );
      const value = body as { access_token?: unknown; expires_in?: unknown };
      if (typeof value.access_token !== "string" || !value.access_token)
        throw new Error("공급자 인증 응답 오류");
      token = {
        value: value.access_token,
        expires: now() + Math.max(60, Number(value.expires_in) || 3600) * 1000,
      };
      return token.value;
    })().finally(() => {
      tokenRequest = null;
    });
    return tokenRequest;
  }

  function metric(
    request: FlowRequest,
    id: FlowMetricId,
    rows: FlowObservation[],
    reason = "",
  ): FlowMetric {
    const observations = dedupeFlowObservations(rows).filter(
      (row) => row.date >= request.from && row.date <= request.to,
    );
    const providedFrom = observations[0]?.date ?? null;
    const providedTo = observations.at(-1)?.date ?? null;
    const valid = observations.filter((row) => row.value !== null);
    const partial =
      providedFrom !== request.from ||
      providedTo !== request.to ||
      valid.length !== observations.length ||
      Boolean(reason);
    return {
      capability: valid.length
        ? partial
          ? "partial"
          : "available"
        : observations.length
          ? "unknown"
          : "partial",
      reason:
        reason ||
        (valid.length
          ? partial
            ? "요청 범위 중 일부 날짜만 제공 · 공표 시각/확정 여부 미확인"
            : "공표 시각/확정 여부 미확인"
          : "해당 기간의 유효한 원천 필드 없음 · 종목 지원 여부 미확인"),
      unit: id === "investmentTrust" ? "주" : "%",
      source: SOURCES[id],
      observations,
      providedFrom,
      providedTo,
    };
  }

  async function naver(
    request: FlowRequest,
    signal: AbortSignal,
    fetchedAt: string,
  ): Promise<FlowMetric> {
    const basic = await json(`${NAVER}/api/stock/${request.code}/basic`, signal);
    const identity = basic.body as {
      itemCode?: unknown;
      stockEndType?: unknown;
      stockExchangeType?: { nationType?: unknown };
    };
    if (identity.itemCode !== request.code || identity.stockExchangeType?.nationType !== "KOR")
      throw new Error("공급자 종목 메타데이터 불일치");
    if (
      ((identity.stockEndType === "etf" || identity.stockEndType === "etn") &&
        identity.stockEndType !== request.instrument) ||
      (request.instrument === "etf" && identity.stockEndType !== "etf")
    )
      throw new Error("공급자 상품 유형 불일치");
    const { body } = await json(`${NAVER}/api/stock/${request.code}/trend`, signal);
    const rows = Array.isArray(body) ? body : (body as { result?: unknown }).result;
    if (!Array.isArray(rows)) throw new Error("공급자 동향 응답 형식 오류");
    // This existing endpoint returns a recent 10-row window. No invented pagination parameters.
    return metric(request, "foreign", parseNaverForeign(rows as Row[], request.code, fetchedAt));
  }

  async function kis(
    request: FlowRequest,
    id: "credit" | "investmentTrust",
    signal: AbortSignal,
    fetchedAt: string,
  ): Promise<FlowMetric> {
    const { appKey, appSecret } = credentials();
    if (!appKey || !appSecret)
      return {
        ...metric(request, id, []),
        capability: "not-configured",
        reason: "KIS_APP_KEY / KIS_APP_SECRET 인증 미설정 · 해당 종목 실응답 미검증",
      };
    const bearer = await accessToken(signal);
    const isCredit = id === "credit";
    let cursor = request.to.replaceAll("-", "");
    let continuation = "";
    const observations: FlowObservation[] = [];
    const seen = new Set<string>();
    let stopReason = "";
    const maxPages = Math.max(1, Math.min(options.maxPages ?? 4, 8));
    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({
        FID_COND_MRKT_DIV_CODE: "J",
        FID_INPUT_ISCD: request.code,
        FID_INPUT_DATE_1: cursor,
        ...(isCredit
          ? { FID_COND_SCR_DIV_CODE: "20476" }
          : { FID_ORG_ADJ_PRC: "", FID_ETC_CLS_CODE: "" }),
      });
      try {
        // A bounded per-instance queue prevents chart grids from bursting the broker quota.
        const operation = kisQueue
          .catch(() => undefined)
          .then(async () => {
            await delay(options.retryDelayMs ?? 150, signal);
            return json(`${KIS}${isCredit ? CREDIT_PATH : TRUST_PATH}?${params}`, signal, {
              headers: {
                authorization: `Bearer ${bearer}`,
                appkey: appKey,
                appsecret: appSecret,
                custtype: "P",
                tr_id: isCredit ? "FHPST04760000" : "FHPTJ04160001",
                tr_cont: continuation,
              },
            });
          });
        kisQueue = operation;
        const { body, headers } = await operation;
        const payload = body as { rt_cd?: unknown; output?: unknown; output2?: unknown };
        if (String(payload.rt_cd) !== "0")
          throw new Error("공급자 조회 거절: 인증·권한 또는 종목 지원 확인 필요");
        const rawRows = isCredit ? payload.output : payload.output2;
        if (!Array.isArray(rawRows)) throw new Error("공급자 필수 응답 필드 누락");
        const rows = parseKisFlow(rawRows as Row[], id, fetchedAt);
        if (!rows.length) {
          stopReason = "원천 날짜·필드 없음 · 해당 종목 지원 여부 미확인";
          break;
        }
        const signature = rows.map((row) => row.date).join(",");
        if (seen.has(signature)) {
          stopReason = "중복 페이지 감지: 추가 조회 중단";
          break;
        }
        seen.add(signature);
        observations.push(...rows);
        if (rows[0]!.date <= request.from) break;
        const more = headers.get("tr_cont");
        if (more === "M" || more === "F") continuation = "N";
        else if (isCredit && rawRows.length >= 30) {
          const previous = new Date(`${rows[0]!.date}T00:00:00Z`);
          previous.setUTCDate(previous.getUTCDate() - 1);
          cursor = previous.toISOString().slice(0, 10).replaceAll("-", "");
          continuation = "";
        } else break;
        if (page === maxPages - 1) stopReason = "조회 페이지 상한 도달: 일부 기간만 제공";
      } catch (error) {
        if (signal.aborted) throw abortError();
        if (!observations.length) throw error;
        stopReason = "후속 페이지 호출 오류: 앞서 확보한 기간만 제공";
        break;
      }
    }
    return metric(request, id, observations, stopReason);
  }

  async function run(request: FlowRequest, signal: AbortSignal): Promise<FlowResponse> {
    const fetchedAt = new Date(now()).toISOString();
    const result = { ...emptyChartFlow(request), fetchedAt };
    if (request.market !== "KR") {
      for (const id of ["credit", "foreign", "investmentTrust"] as const)
        result[id].reason = "해당 상장 시장의 지표 정의·공급자 미확인";
      return result;
    }
    const ids = ["credit", "foreign", "investmentTrust"] as const;
    const settled = await Promise.allSettled(
      ids.map((id) =>
        id === "foreign" ? naver(request, signal, fetchedAt) : kis(request, id, signal, fetchedAt),
      ),
    );
    signal.throwIfAborted();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const item = settled[i]!;
      if (item.status === "fulfilled") result[id] = item.value;
      else
        result[id] = {
          ...metric(request, id, []),
          capability: "error",
          reason:
            item.reason instanceof FlowHttpError
              ? item.reason.status === 403 || item.reason.status === 401
                ? "공급자 인증·접근 권한 오류"
                : `공급자 HTTP ${item.reason.status}`
              : item.reason instanceof DOMException && item.reason.name === "TimeoutError"
                ? "공급자 요청 시간 초과"
                : "공급자 호출·응답 검증 오류",
        };
    }
    return result;
  }

  return function fetchChartFlow(input: FlowRequest, signal?: AbortSignal): Promise<FlowResponse> {
    const request = validateFlowRequest(input);
    if (signal?.aborted) return Promise.reject(abortError());
    const key = flowRequestKey(request);
    const cached = cache.get(key);
    if (cached && cached.until > now()) return Promise.resolve(cached.result);
    if (cached) cache.delete(key);
    let entry = inflight.get(key);
    if (entry?.controller.signal.aborted) {
      inflight.delete(key);
      entry = undefined;
    }
    if (!entry) {
      const controller = new AbortController();
      const promise = run(request, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            if (cache.size >= 64) cache.delete(cache.keys().next().value!);
            const failed = [result.credit, result.foreign, result.investmentTrust].some(
              (value) => value.capability === "error",
            );
            cache.set(key, {
              until: now() + (failed ? 15_000 : (options.cacheTtlMs ?? 300_000)),
              result,
            });
          }
          return result;
        })
        .finally(() => {
          if (inflight.get(key)?.promise === promise) inflight.delete(key);
        });
      entry = { controller, promise, users: 0 };
      inflight.set(key, entry);
    }
    const shared = entry;
    shared.users++;
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (aborted: boolean) => {
        if (done) return false;
        done = true;
        signal?.removeEventListener("abort", onAbort);
        shared.users--;
        if (aborted && shared.users === 0) shared.controller.abort();
        return true;
      };
      const onAbort = () => {
        if (finish(true)) reject(abortError());
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      shared.promise.then(
        (value) => {
          if (finish(false)) resolve(value);
        },
        (error) => {
          if (finish(false)) reject(error);
        },
      );
    });
  };
}
