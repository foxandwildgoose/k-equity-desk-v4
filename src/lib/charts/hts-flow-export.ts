import {
  FLOW_METRICS,
  isFlowDate,
  type AlignedFlowMetric,
  type FlowMetricId,
  type FlowObservation,
  type FlowResponse,
} from "./hts-flow.ts";

const HEADERS = [
  "kind",
  "market",
  "instrument",
  "code",
  "interval",
  "currency",
  "metric",
  "date",
  "value",
  "unit",
  "source",
  "sourceField",
  "asOf",
  "dateBasis",
  "fetchedAt",
  "availableAt",
  "final",
  "derived",
  "formula",
  "denominator",
  "buy",
  "sell",
  "capability",
  "reason",
  "partial",
  "stale",
  "requestedFrom",
  "requestedTo",
  "providedFrom",
  "providedTo",
  "trustMode",
  "cumulativeStart",
  "provider", "environment", "marketScope", "sourceApiId", "parsingStatus", "status", "lastSuccessAt",
];
type CsvRow = Record<string, unknown>;
const cell = (value: unknown) => {
  const text = String(value ?? "");
  // Keep genuine numeric negatives numeric, but prevent provider text becoming a spreadsheet formula.
  const safe = typeof value === "string" && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

/** Exchange-local end of the day. US exchange DST is resolved for that date, never hardcoded. */
export function chartReplayInstant(day: string, market: "KR" | "US"): string {
  if (!isFlowDate(day)) throw new RangeError("리플레이 거래일 형식 오류");
  if (market === "KR") return `${day}T23:59:59.999+09:00`;
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(`${day}T23:59:59.999Z`))
    .find((part) => part.type === "timeZoneName")
    ?.value.replace("GMT", "");
  if (!offset || !/^[+-]\d{2}:\d{2}$/.test(offset)) throw new RangeError("거래소 시간대 확인 실패");
  return `${day}T23:59:59.999${offset}`;
}

/** Export the same publication boundary used by rendering, using instants rather than ISO-string order.
 * Raw, aligned and unavailable-status rows share an explicit schema; null stays an empty cell.
 */
export function flowToCsv(
  flow: FlowResponse,
  aligned: Record<FlowMetricId, AlignedFlowMetric>,
  replayAt?: string,
  settings: { trustMode?: "cumulative" | "daily" | "available-cumulative"; cumulativeStart?: string } = {},
): string {
  const replayMs = replayAt === undefined ? null : Date.parse(replayAt);
  const permitted = (row: FlowObservation) =>
    replayMs === null ||
    (Number.isFinite(replayMs) &&
      row.availableAt !== null &&
      Number.isFinite(Date.parse(row.availableAt)) &&
      Date.parse(row.availableAt) <= replayMs);
  const rows: CsvRow[] = [];
  for (const id of FLOW_METRICS) {
    const metric = flow[id];
    const output = aligned[id];
    const common: CsvRow = {
      market: flow.request.market,
      instrument: flow.request.instrument,
      code: flow.request.code,
      interval: flow.request.interval,
      currency: flow.request.currency,
      trustMode: settings.trustMode,
      cumulativeStart: settings.cumulativeStart,
      metric: id,
      unit: metric.unit,
      source: metric.source,
      stale: metric.stale ?? flow.stale,
      provider: metric.observations[0]?.provider,
      environment: metric.diagnostics?.environment,
      marketScope: metric.diagnostics?.marketScope,
      sourceApiId: metric.diagnostics?.apiId,
      status: metric.status,
      lastSuccessAt: metric.lastSuccessAt,
      requestedFrom: flow.request.from,
      requestedTo: flow.request.to,
      providedFrom: metric.providedFrom,
      providedTo: metric.providedTo,
    };
    const availableRows = metric.observations.filter(permitted);
    for (const observation of availableRows)
      rows.push({
        ...common,
        kind: "raw",
        ...observation,
        capability: metric.capability,
        reason: metric.reason,
        partial: metric.capability === "partial",
      });
    if (!availableRows.length)
      rows.push({
        ...common,
        kind: "status",
        fetchedAt: flow.fetchedAt,
        capability: output.capability,
        reason:
          replayMs !== null && metric.observations.length
            ? output.reason || "공표 시각 미확인 또는 재생 시점 이후: 원천 값 내보내기 비활성"
            : output.reason || metric.reason,
      });
    for (const point of output.points) {
      // Defend the export boundary even if a caller supplied non-replay-aligned points.
      const contributing =
        id === "investmentTrust" && settings.trustMode !== "daily"
          ? metric.observations.filter(
              (observation) =>
                observation.date >= (settings.cumulativeStart ?? flow.request.from) &&
                observation.date <= (point.asOf ?? point.date),
            )
          : point.observations;
      const verified =
        replayMs === null || (contributing.length > 0 && contributing.every(permitted));
      const observations = point.observations.filter(permitted);
      const valid = observations.filter((observation) => observation.value !== null);
      const last = valid.at(-1);
      const instants = observations
        .map((observation) => observation.availableAt)
        .filter((instant): instant is string => Boolean(instant));
      const availableAt =
        instants.length === observations.length && instants.length
          ? instants.reduce((latest, next) =>
              Date.parse(next) > Date.parse(latest) ? next : latest,
            )
          : null;
      rows.push({
        ...common,
        kind: "aligned",
        date: point.date,
        value: verified ? point.value : null,
        source:
          [...new Set(observations.map((observation) => observation.source))].join("; ") ||
          metric.source,
        sourceField: [...new Set(observations.map((observation) => observation.sourceField))].join(
          "; ",
        ),
        asOf: verified ? point.asOf : null,
        dateBasis: [...new Set(observations.map((observation) => observation.dateBasis))].join(
          "; ",
        ),
        fetchedAt: last?.fetchedAt ?? flow.fetchedAt,
        availableAt,
        final: observations.some((observation) => observation.final === false)
          ? false
          : observations.length && observations.every((observation) => observation.final === true)
            ? true
            : null,
        derived: true,
        formula:
          id === "investmentTrust"
            ? settings.trustMode === "cumulative" || settings.trustMode === "available-cumulative"
              ? `Σ dailyNet[${settings.cumulativeStart ?? "기준일 미제공"}..asOf]`
              : settings.trustMode === "daily"
                ? "Σ dailyNet[봉 기간]"
                : "표시 방식 및 누적 기준일은 trustMode/cumulativeStart 참조"
            : "봉 기간의 마지막 유효 관측값",
        capability: verified ? output.capability : "unknown",
        reason: !verified
          ? "공표 시각 미확인 또는 재생 시점 이후: 내보내기 값 비활성"
          : point.reason || output.reason,
        partial: point.partial || !verified,
      });
    }
  }
  return [
    HEADERS.join(","),
    ...rows.map((row) => HEADERS.map((key) => cell(row[key])).join(",")),
  ].join("\r\n");
}
