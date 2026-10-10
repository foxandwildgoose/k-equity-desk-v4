/** Dated provider observations. Percentages are always 0..100, never fractions. */
export type FlowCapability =
  | "available"
  | "partial"
  | "not-configured"
  | "not-supported"
  | "not-applicable"
  | "error"
  | "unknown";
export type FlowStatus = "disabled" | "configuration" | "authentication" | "access" | "ip-check" | "rate-limit" | "timeout" | "network" | "parsing" | "history" | "collecting" | "ready" | "unsupported" | "storage";
/** Safe operational state; independent from value availability and partial coverage. */
export type KiwoomHealthStatus = "DISABLED" | "CREDENTIALS_MISSING" | "OWNER_AUTH_FAILED" | "DATABASE_MISSING" | "DATABASE_SCHEMA_MISSING" | "DATABASE_FAILED" | "EXPECTED_IP_MISSING" | "IP_MISMATCH" | "IP_UNVERIFIED" | "TOKEN_FAILED" | "API_FAILED" | "PARSING_FAILED" | "NO_HISTORY" | "READY" | "PARTIAL" | "COLLECTING" | "RATE_LIMIT" | "CONFIGURATION_FAILED" | "DATA_SCOPE_MISMATCH" | "COLLECTION_QUEUED" | "DEPLOYMENT_REVISION_MISMATCH" | "PRODUCT_TYPE_UNKNOWN" | "TARGET_LIMIT_REACHED";
export const KIWOOM_HEALTH_LABELS: Record<KiwoomHealthStatus, string> = {
  DISABLED: "키움 수집 비활성", CREDENTIALS_MISSING: "키움 인증정보 미설정",
  OWNER_AUTH_FAILED: "소유자 인증 필요", DATABASE_MISSING: "DB 미설정",
  DATABASE_SCHEMA_MISSING: "키움 DB 스키마 적용 필요", DATABASE_FAILED: "키움 DB 연결/조회 실패",
  EXPECTED_IP_MISSING: "키움 허용 IP 설정 필요", IP_MISMATCH: "키움 호출 서버 IP 불일치",
  IP_UNVERIFIED: "키움 호출 서버 IP 확인 불가", TOKEN_FAILED: "키움 API 인증 실패",
  API_FAILED: "키움 API 조회 실패", PARSING_FAILED: "키움 응답 파싱 실패",
  NO_HISTORY: "제공 이력 없음 · 상품 지원 미확인", READY: "키움 데이터 수신·저장됨",
  PARTIAL: "키움 이력 일부 확보", COLLECTING: "키움 수집 중/대기",
  RATE_LIMIT: "키움 호출 제한", CONFIGURATION_FAILED: "키움 서버 설정 확인 필요",
  DATA_SCOPE_MISMATCH: "다른 저장 범위에 이력 존재", COLLECTION_QUEUED: "키움 수집 예약됨",
  DEPLOYMENT_REVISION_MISMATCH: "배포 버전 불일치", PRODUCT_TYPE_UNKNOWN: "상품 유형 미확인", TARGET_LIMIT_REACHED: "키움 수집 대기열이 가득 참",
};
export const KIWOOM_NEXT_STEPS: Record<KiwoomHealthStatus, string> = {
  DISABLED: "실행 서버에 KIWOOM_FLOW_ENABLED=true를 설정하세요.",
  DATABASE_MISSING: "수집기와 웹앱에 동일한 영속 PostgreSQL을 설정하세요.",
  DATABASE_SCHEMA_MISSING: "공유 DB에 npm run db:migrate를 명시적으로 실행하세요.",
  DATABASE_FAILED: "공유 PostgreSQL 연결과 서버 접근 권한을 확인하세요.",
  DATA_SCOPE_MISMATCH: "두 프로세스의 KIWOOM_DATA_SCOPE_ID를 맞추거나 기존 범위를 이관하세요.",
  OWNER_AUTH_FAILED: "실제 소유자로 로그인하고 서버의 소유자 설정을 확인하세요.",
  CREDENTIALS_MISSING: "등록 IP 수집기에 App Key와 App Secret을 비공개로 주입하세요.",
  EXPECTED_IP_MISSING: "수집기에 KIWOOM_EXPECTED_EGRESS_IP를 설정하세요.",
  IP_MISMATCH: "키움에 등록된 공인 IP에서 수집기를 실행하거나 허용 IP를 갱신하세요.",
  IP_UNVERIFIED: "수집기의 IP 확인 서비스 연결을 복구한 뒤 재검사하세요.",
  TOKEN_FAILED: "실전 환경과 인증정보를 확인하고 등록 IP에서 토큰 검증을 실행하세요.",
  API_FAILED: "수집기의 안전한 API 오류코드와 조회 권한을 확인하세요.",
  PARSING_FAILED: "수집기의 실제 응답 유효 필드·날짜 검사 결과를 확인하세요.",
  NO_HISTORY: "등록 IP 수집기를 실행하세요. 대기열이 가득 차면 운영자가 대상 목록을 점검하세요.",
  COLLECTION_QUEUED: "고정 IP 수집기의 다음 대기열 처리 주기를 기다리세요. 계속 지연되면 운영자가 자동 실행 상태를 확인해야 합니다.",
  COLLECTING: "수집기가 저장 중입니다. 완료 후 상태를 새로고침하세요.",
  PARTIAL: "수집기를 다시 실행하여 부족한 구간을 재개하세요.",
  READY: "표시 기준일을 저장된 실제 관측일과 대조하세요.",
  RATE_LIMIT: "다른 키움 소비 프로세스를 확인하고 제한 해제 후 재개하세요.",
  CONFIGURATION_FAILED: "서버의 환경·모드·범위 설정을 확인하세요.",
  DEPLOYMENT_REVISION_MISMATCH: "현재 main 버전을 배포하고 표시된 짧은 SHA를 대조하세요.",
  PRODUCT_TYPE_UNKNOWN: "상품 메타데이터를 재조회하거나 검증된 종목/ETF 경로에서 여세요.",
  TARGET_LIMIT_REACHED: "진행 중인 종목 수집이 끝나면 자동으로 다시 예약합니다. 계속 지연되면 운영자가 대기열을 확인하세요.",
};
export function kiwoomHealthFor(status: FlowStatus, validValues = 0): KiwoomHealthStatus {
  const states: Partial<Record<FlowStatus, KiwoomHealthStatus>> = {
    disabled: "DISABLED", configuration: "CONFIGURATION_FAILED", access: "API_FAILED",
    authentication: "TOKEN_FAILED", "ip-check": "IP_UNVERIFIED", parsing: "PARSING_FAILED",
    storage: "DATABASE_FAILED", "rate-limit": "RATE_LIMIT", collecting: "COLLECTING",
    network: "API_FAILED", timeout: "API_FAILED", unsupported: "NO_HISTORY",
  };
  return states[status] ?? (validValues ? status === "ready" ? "READY" : "PARTIAL" : "NO_HISTORY");
}
export const FLOW_STATUS_LABELS: Record<FlowStatus, string> = {
  disabled: "수집 비활성", configuration: "서버 설정 미완료", authentication: "인증 오류", access: "로그인/권한 확인 필요",
  "ip-check": "호출 서버 IP 확인 필요", "rate-limit": "호출 제한", timeout: "응답 시간 초과", network: "통신 오류",
  parsing: "응답 필드 검증 오류", history: "이력 부족/제공 범위 확인", collecting: "수집 중/대기", ready: "갱신됨",
  unsupported: "확인된 미지원", storage: "영속 저장소 설정/연결 확인 필요",
};
export type FlowMetricId = "credit" | "foreign" | "investmentTrust";
export type FlowInterval = "day" | "week" | "month" | "year" | "minute";
export type FlowQuantityUnit = "주" | "좌" | "shares";
export interface FlowRequest {
  code: string;
  market: "KR" | "US";
  instrument: "stock" | "etf" | "etn";
  exchange: string;
  currency: "KRW" | "USD";
  quantityUnit: FlowQuantityUnit;
  from: string;
  to: string;
  interval: FlowInterval;
  /** Explicit provider market; listing exchanges KOSPI/KOSDAQ both map to KRX. */
  flowScope?: "KRX" | "NXT" | "SOR";
  expectedDailyDates?: string[];
}
export interface FlowObservation {
  date: string;
  value: number | null;
  unit: "%" | FlowQuantityUnit;
  source: string;
  sourceField: string;
  asOf: string;
  dateBasis: "trade-date" | "settlement-date" | "publication-date" | "unknown";
  fetchedAt: string;
  availableAt: string | null;
  final: boolean | null;
  derived: boolean;
  formula?: string;
  denominator?: number;
  buy?: number | null;
  sell?: number | null;
  provider?: "kiwoom";
  environment?: "real" | "mock";
  marketScope?: "KRX" | "NXT" | "SOR";
  sourceApiId?: string;
  parsingStatus?: "valid" | "missing" | "invalid";
  referenceValue?: number | null;
  referenceUnit?: string;
}
export interface FlowMetric {
  capability: FlowCapability;
  reason: string;
  unit: "%" | FlowQuantityUnit;
  source: string;
  observations: FlowObservation[];
  providedFrom: string | null;
  providedTo: string | null;
  status?: FlowStatus;
  health?: KiwoomHealthStatus;
  stale?: boolean;
  lastSuccessAt?: string | null;
  diagnostics?: {
    apiId: string; pages: number; rows: number; validValues: number; invalidRows: number;
    stopReason: string; missingDates: string[] | null; calendarBasis: string;
    stored: boolean; errorCode: number | null; environment: "real" | "mock";
    mode: "direct" | "collector"; marketScope: string;
    collectionState?: "COLLECTION_QUEUED" | "COLLECTING" | "TARGET_LIMIT_REACHED";
  };
}
export interface FlowResponse {
  request: FlowRequest;
  credit: FlowMetric;
  foreign: FlowMetric;
  investmentTrust: FlowMetric;
  fetchedAt: string;
  stale: boolean;
}
export const FLOW_METRICS: readonly FlowMetricId[] = ["credit", "foreign", "investmentTrust"];

export function emptyChartFlow(request: FlowRequest, reason = "데이터 확인 중"): FlowResponse {
  const metric = (unit: FlowMetric["unit"]): FlowMetric => ({
    capability: "unknown",
    reason,
    unit,
    source: "미확인",
    observations: [],
    providedFrom: null,
    providedTo: null,
  });
  return {
    request,
    credit: metric("%"),
    foreign: metric("%"),
    investmentTrust: metric(request.quantityUnit),
    fetchedAt: "",
    stale: false,
  };
}

export function isFlowDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function flowRequestKey(request: FlowRequest): string {
  return JSON.stringify([
    "hts-flow-kiwoom-v2",
    request.market,
    request.code,
    request.instrument,
    request.exchange,
    request.currency,
    request.quantityUnit,
    request.from,
    request.to,
    request.interval,
    request.flowScope ?? "KRX",
    request.expectedDailyDates ?? [],
  ]);
}

/** Browser memory caches follow the current session; server authorization remains authoritative. */
export function flowClientQueryKey(request: FlowRequest, userId: string | null) {
  return ["chart-flow-kiwoom-v2", userId ?? "unverified-session", flowRequestKey(request)] as const;
}

/** Empty strings, provider dashes, invalid strings and infinity are missing, not zero. */
export function nullableFlowNumber(raw: unknown, scale = 1): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const text = String(raw).trim().replaceAll(",", "").replace(/%$/, "");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const value = Number(text) * scale;
  return Number.isFinite(value) ? value : null;
}

/** Caller must supply the denominator from the SAME date and quantity unit. */
export function datedRatio(
  numerator: { date: string; value: number | null; unit: FlowQuantityUnit },
  denominator: { date: string; value: number | null; unit: FlowQuantityUnit },
): number | null {
  if (
    numerator.date !== denominator.date ||
    numerator.unit !== denominator.unit ||
    numerator.value == null ||
    denominator.value == null ||
    !Number.isFinite(numerator.value) ||
    !Number.isFinite(denominator.value) ||
    numerator.value < 0 ||
    denominator.value <= 0
  )
    return null;
  const value = (numerator.value / denominator.value) * 100;
  return value <= 100 ? value : null;
}

export interface AlignedFlowPoint {
  date: string;
  value: number | null;
  asOf: string | null;
  partial: boolean;
  reason: string;
  observations: FlowObservation[];
}
export interface AlignedFlowMetric {
  capability: FlowCapability;
  reason: string;
  points: AlignedFlowPoint[];
}
export interface AlignChartFlowOptions {
  /** Price-bar dates; daily dates remain Seoul exchange dates (ETF underlying region is irrelevant). */
  dates: string[];
  interval: FlowInterval;
  cumulativeStart: string;
  investmentTrustMode: "cumulative" | "daily" | "available-cumulative";
  /** Daily price sessions, when available even while rendering weekly/monthly bars. */
  expectedDailyDates?: string[];
  /** ISO instant. Unknown publication instants are NEVER allowed in replay. */
  replayAt?: string;
}

/** Opt-in only: find the last available continuous run against observed price sessions. */
export function availableFlowStart(response: FlowResponse, expectedDates: string[], requestedStart: string): string | null {
  const values = new Map(response.investmentTrust.observations.map((row) => [row.date, row.value]));
  const dates = [...new Set(expectedDates.filter((d) => isFlowDate(d) && d >= requestedStart))].sort();
  let start: string | null = null;
  const lastValid = dates.filter((date) => values.get(date) != null).at(-1);
  for (const date of dates) {
    if (lastValid && date > lastValid) break;
    if (values.get(date) == null) start = null;
    else start ??= date;
  }
  return start;
}

function periodKey(date: string, interval: FlowInterval): string {
  if (interval === "year") return date.slice(0, 4);
  if (interval === "month") return date.slice(0, 7);
  if (interval !== "week") return date;
  const instant = new Date(`${date}T00:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() - ((instant.getUTCDay() + 6) % 7));
  return instant.toISOString().slice(0, 10);
}

/** Sort/deduplicate by date; later acquired versions replace earlier versions. */
export function dedupeFlowObservations(observations: FlowObservation[]): FlowObservation[] {
  const rows = new Map<string, FlowObservation>();
  for (const observation of observations) {
    if (!isFlowDate(observation.date)) continue;
    const old = rows.get(observation.date);
    if (!old || old.fetchedAt <= observation.fetchedAt) rows.set(observation.date, observation);
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date)); // ked-allow-string-date-sort: single-format time series
}

/** Pure alignment: ratios take the last valid observation; net quantities sum.
 * A missing net quantity poisons every later cumulative value from a fixed start.
 * No forward fill; no daily observations impersonate intraday updates.
 */
export function alignChartFlow(
  response: FlowResponse,
  options: AlignChartFlowOptions,
): Record<FlowMetricId, AlignedFlowMetric> {
  const dates = [...new Set(options.dates.filter(isFlowDate))].sort();
  const expected = [
    ...new Set(
      (options.expectedDailyDates ?? (options.interval === "day" ? dates : [])).filter(isFlowDate),
    ),
  ].sort();
  const replayMs = options.replayAt ? Date.parse(options.replayAt) : null;
  const cumulativeStart = options.investmentTrustMode === "available-cumulative"
    ? availableFlowStart(response, expected, options.cumulativeStart) ?? options.cumulativeStart
    : options.cumulativeStart;
  return Object.fromEntries(
    FLOW_METRICS.map((id) => {
      const metric = response[id];
      const disabledReason =
        options.interval === "minute"
          ? "일별 원천 데이터: 분봉 곡선 비활성"
          : replayMs !== null &&
              (!Number.isFinite(replayMs) || metric.observations.some((row) => !row.availableAt))
            ? "공표 시각 미확인: 시점 검증 리플레이 비활성"
            : "";
      if (disabledReason)
        return [
          id,
          {
            capability: "unknown",
            reason: disabledReason,
            points: dates.map((date) => ({
              date,
              value: null,
              asOf: null,
              partial: true,
              reason: disabledReason,
              observations: [],
            })),
          },
        ];
      const rows = dedupeFlowObservations(metric.observations).filter(
        (row) =>
          replayMs === null ||
          (row.availableAt !== null && Date.parse(row.availableAt) <= replayMs),
      );
      const rowByDate = new Map(rows.map((row) => [row.date, row]));
      const allDates = [...new Set([...expected, ...rows.map((row) => row.date)])].sort();
      const cumulative = new Map<string, number | null>();
      let sum = 0;
      // Coverage cannot begin after the fixed start unless the known price calendar proves no intervening session.
      const firstKnown = rows.find((row) => row.date >= cumulativeStart)?.date;
      const firstSession = expected.find((date) => date >= cumulativeStart);
      const startDay = new Date(`${cumulativeStart}T00:00:00Z`).getUTCDay();
      const nextWeekday = new Date(`${cumulativeStart}T00:00:00Z`);
      if (startDay === 6) nextWeekday.setUTCDate(nextWeekday.getUTCDate() + 2);
      if (startDay === 0) nextWeekday.setUTCDate(nextWeekday.getUTCDate() + 1);
      const weekendProven = (startDay === 0 || startDay === 6) && firstKnown === firstSession && firstKnown === nextWeekday.toISOString().slice(0, 10);
      let broken =
        !firstKnown ||
        (firstKnown > cumulativeStart && !weekendProven &&
          !(expected[0] && expected[0] <= cumulativeStart && firstSession === firstKnown));
      for (const date of allDates) {
        if (date < cumulativeStart) continue;
        const value = rowByDate.get(date)?.value;
        if (value == null || !Number.isFinite(value)) broken = true;
        if (!broken && value != null) sum += value;
        cumulative.set(date, broken ? null : sum);
      }
      const points = dates.map((date): AlignedFlowPoint => {
        const key = periodKey(date, options.interval);
        const periodRows = rows.filter((row) => periodKey(row.date, options.interval) === key);
        const expectedInPeriod = expected.filter((day) => periodKey(day, options.interval) === key);
        const valid = periodRows.filter((row) => row.value !== null && Number.isFinite(row.value));
        let partial =
          valid.length !== periodRows.length ||
          expectedInPeriod.some((day) => rowByDate.get(day)?.value == null);
        if (options.interval !== "day" && metric.capability === "partial" && !expectedInPeriod.length) partial = true;
        const last = valid.at(-1);
        let value: number | null = last?.value ?? null;
        let asOf = last?.asOf ?? null;
        let reason = partial ? "일부 거래일 누락" : "";
        if (id === "investmentTrust") {
          if (options.investmentTrustMode !== "daily") {
            const lastDate = [
              ...new Set([...expectedInPeriod, ...periodRows.map((row) => row.date)]),
            ]
              .sort()
              .at(-1);
            value = lastDate ? (cumulative.get(lastDate) ?? null) : null;
            asOf = lastDate ?? null;
            if (value === null) {
              partial = true;
              reason = "기준일 이후 누락: 누적순매수 미확정";
            }
          } else {
            value = valid.length ? valid.reduce((total, row) => total + row.value!, 0) : null;
            if (partial) value = null;
          }
        }
        if (value === null && !reason) reason = "해당 날짜 관측값 없음";
        return { date, value, asOf, partial, reason, observations: periodRows };
      });
      const hasValue = points.some((point) => point.value !== null);
      const partial = points.some((point) => point.partial || point.value === null);
      return [
        id,
        {
          capability: hasValue && partial ? "partial" : metric.capability,
          reason: metric.reason,
          points,
        },
      ];
    }),
  ) as Record<FlowMetricId, AlignedFlowMetric>;
}
