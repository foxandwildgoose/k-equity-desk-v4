/** Dated provider observations. Percentages are always 0..100, never fractions. */
export type FlowCapability =
  | "available"
  | "partial"
  | "not-configured"
  | "not-supported"
  | "not-applicable"
  | "error"
  | "unknown";
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
}
export interface FlowMetric {
  capability: FlowCapability;
  reason: string;
  unit: "%" | FlowQuantityUnit;
  source: string;
  observations: FlowObservation[];
  providedFrom: string | null;
  providedTo: string | null;
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
    "hts-flow-v1",
    request.market,
    request.code,
    request.instrument,
    request.exchange,
    request.currency,
    request.quantityUnit,
    request.from,
    request.to,
    request.interval,
  ]);
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
  investmentTrustMode: "cumulative" | "daily";
  /** Daily price sessions, when available even while rendering weekly/monthly bars. */
  expectedDailyDates?: string[];
  /** ISO instant. Unknown publication instants are NEVER allowed in replay. */
  replayAt?: string;
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
      const firstKnown = rows.find((row) => row.date >= options.cumulativeStart)?.date;
      const firstSession = expected.find((date) => date >= options.cumulativeStart);
      let broken =
        !firstKnown ||
        (firstKnown > options.cumulativeStart &&
          !(expected[0] && expected[0] <= options.cumulativeStart && firstSession === firstKnown));
      for (const date of allDates) {
        if (date < options.cumulativeStart) continue;
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
        if (options.interval !== "day" && metric.capability === "partial") partial = true;
        const last = valid.at(-1);
        let value: number | null = last?.value ?? null;
        let asOf = last?.asOf ?? null;
        let reason = partial ? "일부 거래일 누락" : "";
        if (id === "investmentTrust") {
          if (options.investmentTrustMode === "cumulative") {
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
            if (partial && options.interval === "day") value = null;
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
