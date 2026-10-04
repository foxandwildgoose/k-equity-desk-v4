import {
  dedupeFlowObservations,
  FLOW_METRICS,
  isFlowDate,
  nullableFlowNumber,
  type FlowMetricId,
  type FlowObservation,
  type FlowRequest,
} from "../lib/charts/hts-flow.ts";
import { KIWOOM_APIS, type createKiwoomClient } from "./kiwoom-client.ts";
import { KiwoomError, safeKiwoomError } from "./kiwoom-config.ts";
import {
  kiwoomJobKey,
  type FlowIdentity,
  type KiwoomFlowStore,
  type KiwoomJob,
} from "./kiwoom-store.ts";

export type KiwoomClient = ReturnType<typeof createKiwoomClient>;
/** Provider order is not a contract, even if today's parser returns sorted rows. */
export function kiwoomDateExtent(rows: readonly Pick<FlowObservation, "date">[]) {
  let oldestDate: string | null = null;
  let newestDate: string | null = null;
  for (const { date } of rows) {
    if (!isFlowDate(date)) continue;
    if (oldestDate === null || date < oldestDate) oldestDate = date;
    if (newestDate === null || date > newestDate) newestDate = date;
  }
  return { oldestDate, newestDate };
}
export function kiwoomConditions(
  request: FlowRequest,
  metric: FlowMetricId,
): Record<string, string> {
  if (request.market !== "KR" || !/^[0-9A-Z]{6}$/.test(request.code))
    throw new KiwoomError("configuration", "국내 종목 식별자 확인 필요");
  const scope = request.flowScope ?? "KRX";
  if (!["KRX", "NXT", "SOR"].includes(scope))
    throw new KiwoomError("configuration", "키움 시장 범위 확인 필요");
  // Official suffixes used only for an explicitly selected market, never inferred from product type.
  const stk_cd = request.code + (scope === "NXT" ? "_NX" : scope === "SOR" ? "_AL" : "");
  if (metric === "foreign") return { stk_cd };
  const dt = request.to.replaceAll("-", "");
  return metric === "credit"
    ? { stk_cd, dt, qry_tp: "1" }
    : { stk_cd, dt, amt_qty_tp: "2", trde_tp: "0", unit_tp: "1" };
}
export function parseKiwoomRows(
  rows: unknown[],
  metric: FlowMetricId,
  fetchedAt: string,
  environment: "real" | "mock",
  marketScope: "KRX" | "NXT" | "SOR",
) {
  const api = KIWOOM_APIS[metric];
  const observations: FlowObservation[] = [];
  let invalidRows = 0;
  for (const raw of rows) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      invalidRows++;
      continue;
    }
    const row = raw as Record<string, unknown>;
    const digits = typeof row.dt === "string" ? row.dt.trim() : "";
    const date = /^\d{8}$/.test(digits)
      ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
      : "";
    if (!isFlowDate(date)) {
      invalidRows++;
      continue;
    }
    const numericText = String(row[api.field] ?? "").trim();
    const badGrouping =
      numericText.includes(",") && !/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?%?$/.test(numericText);
    let value =
      badGrouping || (metric === "investmentTrust" && numericText.endsWith("%"))
        ? null
        : nullableFlowNumber(row[api.field]);
    const missing =
      row[api.field] === undefined ||
      row[api.field] === null ||
      ["", "-"].includes(String(row[api.field]).trim());
    if (
      value !== null &&
      ((metric !== "investmentTrust" && (value < 0 || value > 100)) ||
        (metric === "investmentTrust" && !Number.isSafeInteger(value)))
    )
      value = null;
    const parsingStatus = value !== null ? "valid" : missing ? "missing" : "invalid";
    if (value === null) invalidRows++;
    observations.push({
      date,
      value,
      unit: metric === "investmentTrust" ? "주" : "%",
      source: environment === "mock" ? "키움증권 · 모의" : "키움증권",
      sourceField: api.field,
      sourceApiId: api.id,
      asOf: date,
      dateBasis: "unknown",
      fetchedAt,
      availableAt: null,
      final: null,
      derived: false,
      provider: "kiwoom",
      environment,
      marketScope,
      parsingStatus,
      ...(metric === "credit"
        ? { referenceValue: nullableFlowNumber(row.remn), referenceUnit: "백만원 (융자)" }
        : metric === "foreign"
          ? { referenceValue: nullableFlowNumber(row.poss_stkcnt), referenceUnit: "주" }
          : {}),
    });
  }
  const bestRows = new Map<string, FlowObservation>();
  for (const row of observations) {
    if (row.value !== null || bestRows.get(row.date)?.value == null) bestRows.set(row.date, row);
  }
  return { observations: dedupeFlowObservations([...bestRows.values()]), invalidRows };
}
export interface CollectOptions {
  maxPages?: number;
  budgetMs?: number;
  resume?: boolean;
  signal?: AbortSignal;
}
/** Bounded resumable work; all persisted values are raw daily observations, never cumulative quantities. */
export async function collectKiwoomMetric(
  store: KiwoomFlowStore,
  client: KiwoomClient,
  identity: FlowIdentity,
  metric: FlowMetricId,
  options: CollectOptions = {},
): Promise<KiwoomJob> {
  const outer = options.signal ?? new AbortController().signal;
  return store.exclusive(
    `job:${kiwoomJobKey(identity, metric)}`,
    async (leaseSignal) => {
      const started = Date.now();
      const budgetMs = Math.max(50, Math.min(options.budgetMs ?? 45_000, 240_000));
      const signal = AbortSignal.any([leaseSignal, AbortSignal.timeout(budgetMs)]);
      const previous = await store.job(identity, metric, true);
      const canResume =
        options.resume &&
        previous?.nextKey &&
        !previous.complete &&
        previous.requestedFrom === identity.request.from &&
        previous.requestedTo === identity.request.to;
      let nextKey = canResume ? previous!.nextKey : null;
      let oldest = canResume ? previous!.oldestDate : null;
      const job: KiwoomJob = {
        status: "collecting",
        stopReason: "collecting",
        pages: canResume ? previous!.pages : 0,
        rows: canResume ? previous!.rows : 0,
        invalidRows: canResume ? previous!.invalidRows : 0,
        oldestDate: oldest,
        newestDate: canResume ? previous!.newestDate : null,
        nextKey,
        complete: false,
        updatedAt: new Date().toISOString(),
        lastSuccessAt: previous?.lastSuccessAt ?? null,
        errorCode: null,
      };
      await store.saveJob(identity, metric, job);
      const seenCursors = new Set<string>();
      const signatures = new Set<string>();
      let restarted = false;
      const maxPages = Math.max(1, Math.min(options.maxPages ?? 25, 200));
      for (let page = 0; page < maxPages; page++) {
        if (Date.now() - started >= budgetMs) {
          job.stopReason = "time-budget";
          break;
        }
        try {
          const response = await client.page(
            KIWOOM_APIS[metric].id,
            kiwoomConditions(identity.request, metric),
            signal,
            nextKey ? { nextKey } : undefined,
          );
          const rawRows = response.body[KIWOOM_APIS[metric].array];
          if (!Array.isArray(rawRows)) throw new KiwoomError("parsing", "키움 필수 응답 배열 누락");
          const { observations, invalidRows } = parseKiwoomRows(
            rawRows,
            metric,
            new Date().toISOString(),
            identity.environment,
            identity.request.flowScope ?? "KRX",
          );
          job.pages++;
          job.rows += rawRows.length;
          job.invalidRows += invalidRows;
          // Official response headers are optional on the terminal page. Only Y
          // promises continuation; an invalid supplied value is still an error.
          const continuation = response.headers.get("cont-yn")?.trim() || "N";
          if (!["Y", "N"].includes(continuation))
            throw new KiwoomError("parsing", "키움 연속조회 헤더 오류");
          if (!rawRows.length || !observations.length) {
            job.stopReason = rawRows.length ? "no-valid-dates" : "empty-page";
            job.status = rawRows.length ? "parsing" : "history";
            break;
          }
          const signature = observations.map((row) => row.date).join(",");
          const extent = kiwoomDateExtent(observations);
          const pageOldest = extent.oldestDate!;
          if (signatures.has(signature) || (oldest !== null && pageOldest >= oldest)) {
            job.stopReason = "no-older-progress";
            job.status = "history";
            break;
          }
          signatures.add(signature);
          await store.upsert(
            identity,
            metric,
            observations.filter(
              (row) => row.date >= identity.request.from && row.date <= identity.request.to,
            ),
          );
          oldest = pageOldest;
          job.oldestDate = pageOldest;
          job.newestDate =
            job.newestDate && job.newestDate > extent.newestDate!
              ? job.newestDate
              : extent.newestDate;
          if (observations.some((row) => row.value !== null))
            job.lastSuccessAt = new Date().toISOString();
          if (pageOldest <= identity.request.from) {
            job.complete = true;
            job.stopReason = "requested-start-reached";
            job.nextKey = null;
            job.status = job.invalidRows && !job.lastSuccessAt ? "parsing" : "ready";
            break;
          }
          if (continuation === "N") {
            job.complete = true;
            job.stopReason = "provider-end";
            job.nextKey = null;
            job.status = job.invalidRows && !job.lastSuccessAt ? "parsing" : "history";
            break;
          }
          const returnedKey = response.headers.get("next-key");
          if (!returnedKey) {
            job.stopReason = "missing-next-key";
            job.status = "parsing";
            job.nextKey = null;
            break;
          }
          if (seenCursors.has(returnedKey) || returnedKey === nextKey) {
            job.stopReason = "repeated-cursor";
            job.status = "history";
            job.nextKey = null;
            break;
          }
          seenCursors.add(returnedKey);
          nextKey = returnedKey;
          job.nextKey = nextKey;
          job.stopReason = "page-budget";
          job.status = "collecting";
          job.updatedAt = new Date().toISOString();
          await store.saveJob(identity, metric, job);
        } catch (error) {
          if (outer.aborted) throw new DOMException("요청 취소", "AbortError");
          const safe = safeKiwoomError(error);
          // Official invalid-input response on a resumed opaque key: one restart using the original supported body.
          if (nextKey && safe.code === 1517 && !restarted) {
            restarted = true;
            nextKey = null;
            oldest = null;
            job.nextKey = null;
            signatures.clear();
            seenCursors.clear();
            job.stopReason = "cursor-rejected-restart";
            continue;
          }
          job.status = signal.aborted ? "collecting" : safe.status;
          job.errorCode = safe.code;
          job.stopReason = signal.aborted ? "time-budget" : safe.message;
          break;
        }
      }
      if (!job.complete && job.status === "collecting" && job.stopReason === "collecting")
        job.stopReason = "page-budget";
      const saved = await store.read(identity, metric);
      const validDates = new Set(saved.filter((row) => row.value !== null).map((row) => row.date));
      job.missingDates =
        identity.request.expectedDailyDates?.filter(
          (date) =>
            date >= identity.request.from && date <= identity.request.to && !validDates.has(date),
        ) ?? null;
      job.calendarBasis = identity.request.expectedDailyDates?.length
        ? "observed-price-sessions"
        : "unknown";
      job.updatedAt = new Date().toISOString();
      await store.saveJob(identity, metric, job);
      return job;
    },
    outer,
  );
}
export async function syncKiwoomFlow(
  store: KiwoomFlowStore,
  client: KiwoomClient,
  identity: FlowIdentity,
  options: CollectOptions = {},
) {
  const jobs = {} as Record<FlowMetricId, KiwoomJob>;
  // One metric's failure does not stop the other two.
  for (const metric of FLOW_METRICS)
    jobs[metric] = await collectKiwoomMetric(store, client, identity, metric, options);
  return jobs;
}
