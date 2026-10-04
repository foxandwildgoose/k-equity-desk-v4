import {
  isFlowDate,
  nullableFlowNumber,
  type FlowObservation,
  type FlowRequest,
} from "../lib/charts/hts-flow.ts";
import { KIWOOM_CROSS_CHECK_API } from "./kiwoom-client.ts";
import { KiwoomError } from "./kiwoom-config.ts";
import { kiwoomConditions, kiwoomDateExtent, type KiwoomClient } from "./kiwoom-flow.ts";

/** Diagnostic only. Never upserts or returns ka10015 rows as primary chart observations. */
export async function crossCheckKiwoom(
  client: KiwoomClient,
  request: FlowRequest,
  primary: { credit: readonly FlowObservation[]; foreign: readonly FlowObservation[] },
  options: {
    maxPages?: number;
    budgetMs?: number;
    tolerancePercentagePoints?: number;
    signal?: AbortSignal;
  } = {},
) {
  const tolerance = options.tolerancePercentagePoints ?? 0.05;
  if (!Number.isFinite(tolerance) || tolerance < 0)
    throw new KiwoomError("configuration", "진단 비교 허용차 오류");
  const signal = AbortSignal.any([
    options.signal ?? new AbortController().signal,
    AbortSignal.timeout(options.budgetMs ?? 12000),
  ]);
  const rows = new Map<string, { credit: number | null; foreign: number | null }>();
  const seen = new Set<string>();
  let nextKey: string | undefined;
  let oldest: string | null = null;
  let pages = 0;
  let stopReason = "page-budget";
  for (let i = 0; i < Math.max(1, Math.min(options.maxPages ?? 2, 25)); i++) {
    const response = await client.page(
      KIWOOM_CROSS_CHECK_API.id,
      {
        stk_cd: kiwoomConditions(request, "foreign").stk_cd,
        strt_dt: request.to.replaceAll("-", ""),
      },
      signal,
      nextKey ? { nextKey } : undefined,
    );
    pages++;
    const raw = response.body[KIWOOM_CROSS_CHECK_API.array];
    if (!Array.isArray(raw)) throw new KiwoomError("parsing", "ka10015 필수 진단 배열 누락");
    const dates: { date: string }[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const digits = String(item.dt ?? "").trim();
      const date = /^\d{8}$/.test(digits)
        ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
        : "";
      if (!isFlowDate(date)) continue;
      dates.push({ date });
      const percent = (value: unknown) => {
        const text = String(value ?? "").trim();
        if (text.includes(",") && !/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?%?$/.test(text)) return null;
        const n = nullableFlowNumber(value);
        return n !== null && n >= 0 && n <= 100 ? n : null;
      };
      const value = { credit: percent(item.crd_remn_rt), foreign: percent(item.for_wght) };
      const previous = rows.get(date);
      rows.set(date, {
        credit: value.credit ?? previous?.credit ?? null,
        foreign: value.foreign ?? previous?.foreign ?? null,
      });
    }
    const { oldestDate: pageOldest } = kiwoomDateExtent(dates);
    const continuation = response.headers.get("cont-yn") || "N";
    if (!["Y", "N"].includes(continuation))
      throw new KiwoomError("parsing", "ka10015 연속조회 헤더 오류");
    if (!raw.length) {
      stopReason = "empty-page";
      break;
    }
    if (pageOldest && pageOldest <= request.from) {
      stopReason = "requested-start-reached";
      break;
    }
    if (continuation === "N") {
      stopReason = "provider-end";
      break;
    }
    const cursor = response.headers.get("next-key")?.trim();
    if (!cursor) {
      stopReason = "missing-next-key";
      break;
    }
    if (seen.has(cursor)) {
      stopReason = "repeated-cursor";
      break;
    }
    if (oldest && (!pageOldest || pageOldest >= oldest)) {
      stopReason = "no-older-progress";
      break;
    }
    oldest = pageOldest;
    seen.add(cursor);
    nextKey = cursor;
  }
  const comparisons = [];
  for (const metric of ["credit", "foreign"] as const) {
    for (const observation of primary[metric]) {
      const value = rows.get(observation.date)?.[metric];
      if (
        observation.date < request.from ||
        observation.date > request.to ||
        observation.value === null ||
        value == null
      )
        continue;
      const difference = Math.abs(observation.value - value);
      comparisons.push({
        metric,
        date: observation.date,
        primary: observation.value,
        crossCheck: value,
        difference,
        materiallyDifferent: difference > tolerance + 1e-9,
      });
    }
  }
  return {
    apiId: "ka10015",
    pages,
    stopReason,
    comparedValues: comparisons.length,
    tolerancePercentagePoints: tolerance,
    discrepancies: comparisons.filter((row) => row.materiallyDifferent),
    warning: comparisons.some((row) => row.materiallyDifferent)
      ? "동일 공급자 날짜의 비율 불일치 · 날짜 기준/정정 여부 확인 필요 · 원자료 변경 안 함"
      : comparisons.length
        ? null
        : "겹치는 유효 관측일 없음 · 일치 검증 미실시",
    dateBasis: "unknown",
    persisted: false,
  };
}
