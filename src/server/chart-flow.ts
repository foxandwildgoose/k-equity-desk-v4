/** The three active chart metrics use Kiwoom exclusively; legacy providers have no fallback path. */
import {
  emptyChartFlow,
  FLOW_METRICS,
  kiwoomHealthFor,
  type FlowMetricId,
  type FlowRequest,
  type FlowResponse,
} from "../lib/charts/hts-flow.ts";
import { validateFlowRequest } from "./chart-flow-request.ts";
import {
  assertKiwoomOwner,
  checkKiwoomEgress,
  credentialsStatus,
  KiwoomError,
  readKiwoomConfig,
  safeKiwoomError,
  type KiwoomConfig,
} from "./kiwoom-config.ts";
import { createKiwoomClient, detachedWait, KIWOOM_APIS } from "./kiwoom-client.ts";
import { collectKiwoomMetric, type KiwoomClient } from "./kiwoom-flow.ts";
import { createKiwoomStore, type FlowIdentity, type KiwoomFlowStore } from "./kiwoom-store.ts";

export { validateFlowRequest } from "./chart-flow-request.ts";
export function unavailableKiwoomFlow(request: FlowRequest, error: KiwoomError): FlowResponse {
  const response = emptyChartFlow(request, error.message);
  for (const id of FLOW_METRICS)
    response[id] = {
      ...response[id],
      source: "키움증권",
      status: error.status,
      health: error.health,
      capability:
        error.status === "configuration" ||
        error.status === "disabled" ||
        error.status === "storage"
          ? "not-configured"
          : "error",
    };
  return response;
}
export function createChartFlowService(
  options: {
    config?: () => KiwoomConfig;
    store?: () => Promise<KiwoomFlowStore>;
    client?: (config: KiwoomConfig, store: KiwoomFlowStore) => KiwoomClient;
    checkEgress?: typeof checkKiwoomEgress;
    now?: () => number;
  } = {},
) {
  const now = options.now ?? Date.now;
  const clients = new Map<string, KiwoomClient>();
  const inflight = new Map<string, Promise<FlowResponse>>();
  async function run(
    request: FlowRequest,
    config: KiwoomConfig,
    userId: string,
  ): Promise<FlowResponse> {
    const store = await (options.store
      ? options.store()
      : import("../lib/db.ts").then(async ({ getSql }) => createKiwoomStore(await getSql())));
    if (!(await store.schema()).ready)
      throw new KiwoomError(
        "storage",
        "키움 DB 스키마 적용 필요 · 관리자 마이그레이션 확인",
        null,
        0,
        "DATABASE_SCHEMA_MISSING",
      );
    const identity: FlowIdentity = { scopeId: userId, environment: config.environment, request };
    let client: KiwoomClient | null = null;
    let directError: KiwoomError | null = null;
    if (config.mode === "direct") {
      if (credentialsStatus(config) !== "CREDENTIALS_CONFIGURED")
        directError = new KiwoomError(
          "configuration",
          `${credentialsStatus(config)} · 현재 실행환경 설정 확인 필요`,
          null,
          0,
          "CREDENTIALS_MISSING",
        );
      else {
        // A prior process-local match does not establish the outbound IP
        // of a later serverless request.
        const ip = await (options.checkEgress ?? checkKiwoomEgress)(config.expectedEgressIp);
        if (ip.status !== "IP_MATCH")
          directError = new KiwoomError(
            "ip-check",
            `${ip.status} · API 호출 서버의 외부 IP 확인 필요`,
            null,
            0,
            ip.status,
          );
        if (!directError) {
          const key = JSON.stringify([
            config.environment,
            userId,
            config.expectedEgressIp,
            config.requestsPerSecond,
            config.appKey,
            config.appSecret,
          ]);
          client = clients.get(key) ?? (options.client ?? createKiwoomClient)(config, store);
          if (clients.size > 2) clients.clear();
          clients.set(key, client);
        }
      }
    }
    const response = { ...emptyChartFlow(request), fetchedAt: new Date(now()).toISOString() };
    await Promise.all(
      FLOW_METRICS.map(async (metric: FlowMetricId) => {
        try {
          let job = await store.job(identity, metric);
          let error = directError;
          if (
            client &&
            (!job ||
              (job.requestedFrom ?? request.from) > request.from ||
              (job.requestedTo ?? "") < request.to ||
              now() - Date.parse(job.updatedAt) > 300_000)
          ) {
            try {
              job = await collectKiwoomMetric(store, client, identity, metric, {
                maxPages: 2,
                budgetMs: 12_000,
                resume: true,
              });
            } catch (raw) {
              error = safeKiwoomError(raw);
            }
          }
          const observations = await store.read(identity, metric);
          const valid = observations.filter((row) => row.value !== null);
          const validDates = new Set(valid.map((row) => row.date));
          const missingDates =
            request.expectedDailyDates?.filter(
              (date) => date >= request.from && date <= request.to && !validDates.has(date),
            ) ?? null;
          const stale = Boolean(
            error ||
            job?.invalidRows ||
            (job && !["requested-start-reached", "provider-end"].includes(job.stopReason)) ||
            !job?.lastSuccessAt ||
            now() - Date.parse(job.lastSuccessAt) > 86_400_000 ||
            (job.status !== "ready" && job.status !== "history"),
          );
          const api = KIWOOM_APIS[metric];
          const stopLabels: Record<string, string> = {
            "requested-start-reached": "요청 시작일까지 확보",
            "provider-end": "공급자 제공 이력 끝 · 요청 구간 부족분 확인 필요",
            "page-budget": "일부 이력 저장됨 · 수집 재개 필요",
            "time-budget": "수집 시간 예산 소진 · 재개 필요",
            "empty-page": "빈 응답 · 상품 지원/제공 이력 미확인",
            "no-valid-dates": "유효한 공급자 날짜 없음",
            "no-older-progress": "이전 구간으로 진행되지 않아 조회 중단",
            "missing-next-key": "필수 연속조회 키 누락",
            "repeated-cursor": "동일 연속조회 키 반복 · 조회 중단",
            collecting: "수집 중",
          };
          const reason =
            error?.message ??
            (job
              ? (stopLabels[job.stopReason] ?? job.stopReason)
              : config.mode === "collector"
                ? "수집 대기 · 허용 IP의 수집기가 저장한 자료를 읽습니다"
                : "수집 중");
          response[metric] = {
            source: config.environment === "mock" ? "키움증권 · 모의" : "키움증권",
            unit: metric === "investmentTrust" ? "주" : "%",
            observations,
            providedFrom: valid[0]?.date ?? null,
            providedTo: valid.at(-1)?.date ?? null,
            status: error?.status ?? job?.status ?? "collecting",
            health:
              error?.health ??
              (valid.length && job && ["ready", "history"].includes(job.status)
                ? stale ||
                  !job.complete ||
                  job.stopReason !== "requested-start-reached" ||
                  missingDates?.length
                  ? "PARTIAL"
                  : "READY"
                : kiwoomHealthFor(job?.status ?? "collecting", valid.length)),
            stale,
            lastSuccessAt: job?.lastSuccessAt ?? null,
            capability: valid.length
              ? stale ||
                !job?.complete ||
                job.stopReason !== "requested-start-reached" ||
                job.invalidRows > 0 ||
                missingDates?.length
                ? "partial"
                : "available"
              : error
                ? "error"
                : "partial",
            reason: `${config.environment === "mock" ? "모의 응답 · 실수급 검증 아님 · " : ""}${reason} · ${request.flowScope ?? "KRX"} 시장 · 공급자 기준일/공표시각/확정 여부 미확인${request.instrument !== "stock" ? " · ETF/ETN 지표 지원·주/좌 단위 실응답 확인 필요" : ""}`,
            diagnostics: {
              apiId: api.id,
              pages: job?.pages ?? 0,
              rows: job?.rows ?? 0,
              validValues: valid.length,
              invalidRows: job?.invalidRows ?? 0,
              stopReason: job?.stopReason ?? reason,
              missingDates,
              calendarBasis: request.expectedDailyDates?.length
                ? "가격의 일별 관측 날짜와 대조 · 휴장/정지/신규상장 미추정"
                : "일별 가격 달력 미확보 · 누락 거래일 수 미확인",
              stored: observations.length > 0,
              errorCode: error?.code ?? job?.errorCode ?? null,
              environment: config.environment,
              mode: config.mode,
              marketScope: request.flowScope ?? "KRX",
            },
          };
        } catch (raw) {
          response[metric] = unavailableKiwoomFlow(request, safeKiwoomError(raw))[metric];
        }
      }),
    );
    response.stale = FLOW_METRICS.some((id) => response[id].stale);
    return response;
  }
  return async (
    input: FlowRequest,
    signal?: AbortSignal,
    verifiedUserId?: string | null,
  ): Promise<FlowResponse> => {
    const request = validateFlowRequest(input);
    if (signal?.aborted) throw new DOMException("요청 취소", "AbortError");
    if (request.market !== "KR")
      return emptyChartFlow(request, "국내 전용 키움 지표 · 미국 종목 미적용");
    try {
      const config = (options.config ?? readKiwoomConfig)();
      if (!config.enabled) throw new KiwoomError("disabled", "키움 수집 비활성 · 서버 설정 필요");
      const userId = assertKiwoomOwner(config, verifiedUserId);
      if (!config.databaseConfigured)
        throw new KiwoomError(
          "storage",
          "공유 영속 PostgreSQL 미설정 · 메모리 DB로 운영 이력 대체 안 함",
          null,
          0,
          "DATABASE_MISSING",
        );
      const key = JSON.stringify([
        "kiwoom-only-v1",
        config.environment,
        config.mode,
        userId,
        request,
      ]);
      let promise = inflight.get(key);
      if (!promise) {
        promise = run(request, config, userId).finally(() => {
          inflight.delete(key);
        });
        inflight.set(key, promise);
      }
      return await detachedWait(promise, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      return unavailableKiwoomFlow(request, safeKiwoomError(error));
    }
  };
}
export const fetchChartFlow = createChartFlowService();
