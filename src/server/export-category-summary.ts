import { aggregateProxy, CORE20_HS_PROXY } from "../lib/export-desk/hs-map.ts";
import type { ExportProviderStatus } from "../lib/export-desk/provider-status.ts";
import { parseComtradeResponse } from "./export-comtrade.ts";
import type { LiveTradeBundle } from "./export-trade-pipeline.ts";
import type {
  CachedTrade,
  ExportTradeStore,
  TradeCategorySummarySnapshot,
} from "./export-trade-store.ts";

const ENDPOINT = "https://comtradeapi.un.org/public/v1/preview/C/M/HS";
const SOURCE = "https://comtradeplus.un.org/";
const ORIGIN_SCOPE = "comtrade-origin";
export const HS2_SUMMARY_CATEGORIES = CORE20_HS_PROXY.filter((p) =>
  p.codes.every((code) => /^\d{2}$/.test(code)),
);
type PeriodEvidence = TradeCategorySummarySnapshot["summaryBasis"]["periods"][number];
export interface CategorySummaryBatch {
  summaries: Record<string, TradeCategorySummarySnapshot>;
  providers: ExportProviderStatus[];
}
export interface CategorySummaryRequest {
  categoryIds: string[];
  /** Query selection only: the actual response must identify this exact month. */
  referencePeriod: string;
}
const priorYear = (month: string) => `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;
const completedMonth = (period: string, now: Date) =>
  /^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/.test(period) &&
  period < new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 7);

function status(
  now: Date,
  state: ExportProviderStatus["state"],
  reasonCode: string,
  retryAt?: string,
): ExportProviderStatus {
  return {
    id: "comtrade.summary",
    name: "UN Comtrade HS2 품목 요약",
    configured: true,
    state,
    reasonCode,
    message:
      reasonCode === "REFRESH_IN_PROGRESS"
        ? "다른 조회에서 UN 공식 자료를 확인하고 있습니다. 완료 후 다시 확인합니다."
        : state === "rate-limited"
          ? "UN 공식 API가 요청을 제한했습니다. 제공처의 재시도 시각을 공유하며 검증된 저장 자료는 유지합니다."
          : "선택한 기준월의 정확한 HS2 구성 항목과 전년 동월을 확인하지 못했습니다. 미확보 값을 0으로 표시하지 않습니다.",
    checkedAt: now.toISOString(),
    asOf: null,
    recordCount: 0,
    sourceUrl: SOURCE,
    ...(retryAt ? { retryAt } : {}),
  };
}

/** Every basket is complete within each month; two-point inference also requires the same edition. */
export function assembleHs2CategorySummaries(
  categoryIds: string[],
  evidence: PeriodEvidence[],
  now: Date,
  providerState: "ok" | "stale" = "ok",
): Record<string, TradeCategorySummarySnapshot> {
  const result: Record<string, TradeCategorySummarySnapshot> = {};
  const latest = evidence.at(-1);
  if (!latest || !completedMonth(latest.period, now)) return result;
  for (const proxy of HS2_SUMMARY_CATEGORIES.filter((p) => categoryIds.includes(p.key))) {
    const points = evidence.flatMap((period) => {
      if (period.period !== latest.period && period.period !== priorYear(latest.period)) return [];
      const components = period.components.filter((row) => proxy.codes.includes(row.code));
      if (
        components.length !== proxy.codes.length ||
        new Set(components.map((row) => row.code)).size !== proxy.codes.length ||
        components.some((row) => !Number.isFinite(row.valueUsd) || row.valueUsd < 0)
      )
        return [];
      // Use the same canonical code order on acquisition and cache validation.
      // Decimal USD values can otherwise differ by one floating-point rounding
      // step when the official API returns constituents in a different order.
      const valueUsd = aggregateProxy(
        Object.fromEntries(components.map((row) => [row.code, row.valueUsd])),
        proxy.codes,
      );
      return valueUsd != null && Number.isFinite(valueUsd)
        ? [{ evidence: { ...period, components }, valueUsd }]
        : [];
    });
    const current = points.find((point) => point.evidence.period === latest.period);
    if (!current) continue;
    const previous = points.find((point) => point.evidence.period === priorYear(latest.period));
    const comparable =
      previous &&
      current.evidence.source === "public-preview" &&
      previous.evidence.source === "public-preview" &&
      /^H[0-6]$/.test(current.evidence.classificationCode ?? "") &&
      previous.evidence.classificationCode === current.evidence.classificationCode;
    const selected = comparable ? [previous, current] : [current];
    const sourceFile = `UN Comtrade · 대한민국/전세계 · ${proxy.label} 완전 구성 요약`;
    const vintage = `UN Comtrade ${current.evidence.classificationCode ?? "HS as reported (edition unrecorded)"}`;
    result[proxy.key] = {
      observations: selected.map(({ evidence: period, valueUsd }) => ({
        period: period.period,
        categoryId: proxy.key,
        categoryName: proxy.label,
        valueUsd,
        classification: "HS",
        geo: "KR",
        sourceFile,
        vintage,
      })),
      summaryBasis: { kind: "UN_COMTRADE_HS2_BASKET", periods: selected.map((p) => p.evidence) },
      providers: [
        {
          id: `comtrade.summary.${proxy.key}`,
          name: "UN Comtrade HS2 품목 요약",
          configured: true,
          state: providerState,
          checkedAt: current.evidence.originCheckedAt,
          asOf: current.evidence.period,
          recordCount: selected.length,
          sourceUrl: SOURCE,
          ...(providerState === "stale" ? { reasonCode: "VERIFIED_CACHE" } : {}),
          message: `${proxy.label}의 전체 구성 항목을 USD로 합산했습니다. ${comparable ? "동일 HS 개정판의 정확한 전년 동월을 비교합니다." : "동일 개정판의 전년 동월 검증본이 없어 YoY는 표시하지 않습니다."} 상세 분석용 월별 이력과 별도의 요약입니다.`,
        },
      ],
    };
  }
  return result;
}

/** Old main bundles did not retain the actual HS edition, so reuse current values only. */
export function hs2SummariesFromBundle(
  entry: CachedTrade<LiveTradeBundle> | null,
  categoryIds: string[],
  now: Date,
): Record<string, TradeCategorySummarySnapshot> {
  if (!entry) return {};
  const bundle = entry.value;
  const provider = bundle.providers.find(
    (p) =>
      p.id === "comtrade.total" &&
      p.configured &&
      p.recordCount > 0 &&
      ["ok", "partial", "stale"].includes(p.state) &&
      completedMonth(p.asOf ?? "", now),
  );
  if (!provider?.asOf) return {};
  const rows = bundle.observations.filter(
    (row) =>
      row.period === provider.asOf &&
      /^hs2:\d{2}$/.test(row.categoryId) &&
      row.classification === "HS" &&
      row.geo === "KR" &&
      row.vintage === "UN Comtrade HS as reported" &&
      row.sourceFile === "UN Comtrade · 대한민국/전세계 · HS 2단위",
  );
  if (new Set(rows.map((row) => row.categoryId)).size !== rows.length) return {};
  return assembleHs2CategorySummaries(
    categoryIds,
    [
      {
        period: provider.asOf,
        classificationCode: null,
        reporterCode: "410",
        partnerCode: "0",
        partner2Code: "0",
        flowCode: "X",
        customsCode: "C00",
        motCode: "0",
        unit: "USD",
        originCheckedAt: provider.checkedAt,
        source: "main-bundle",
        components: rows.map((row) => ({ code: row.categoryId.slice(4), valueUsd: row.valueUsd })),
      },
    ],
    now,
    entry.stale || provider.state === "stale" ? "stale" : "ok",
  );
}

async function readBoundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body) throw new Error("EMPTY_BODY");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let abort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    abort = () => reject(new Error("TIMEOUT"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
  try {
    while (true) {
      const part = await Promise.race([reader.read(), aborted]);
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 2_000_000) throw new Error("RESPONSE_TOO_LARGE");
      chunks.push(part.value);
    }
    const all = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      all.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(all));
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
    void reader.cancel().catch(() => undefined);
  }
}

export function createHs2CategorySummaryClient(options: {
  store: ExportTradeStore;
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}) {
  const fetcher = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  return async function fetchSummaries(
    request: CategorySummaryRequest,
  ): Promise<CategorySummaryBatch> {
    const at = now();
    const categories = HS2_SUMMARY_CATEGORIES.filter((p) => request.categoryIds.includes(p.key));
    if (!categories.length || !completedMonth(request.referencePeriod, at))
      return { summaries: {}, providers: [status(at, "unavailable", "INVALID_REFERENCE_PERIOD")] };
    const retryAt = await options.store.retryAt(ORIGIN_SCOPE, true);
    if (retryAt)
      return {
        summaries: {},
        providers: [status(at, "rate-limited", "SHARED_PROVIDER_COOLDOWN", retryAt)],
      };
    const owner = await options.store.acquireRefresh(ORIGIN_SCOPE, 45_000);
    if (!owner) return { summaries: {}, providers: [status(at, "partial", "REFRESH_IN_PROGRESS")] };
    const codes = [...new Set(categories.flatMap((p) => p.codes))].sort();
    const evidence: PeriodEvidence[] = [];
    const providers: ExportProviderStatus[] = [];
    try {
      // The current month comes first: an empty/limited response cannot trigger
      // a full-history scan. At most two real origin requests are ever awaited.
      for (const period of [request.referencePeriod, priorYear(request.referencePeriod)]) {
        const signal = AbortSignal.timeout(options.timeoutMs ?? 5_000);
        const params = new URLSearchParams({
          reporterCode: "410",
          period: period.replace("-", ""),
          cmdCode: codes.join(","),
          flowCode: "X",
          partnerCode: "0",
          partner2Code: "0",
          customsCode: "C00",
          motCode: "0",
          maxRecords: "500",
          format: "JSON",
          includeDesc: "true",
        });
        try {
          const response = await fetcher(`${ENDPOINT}?${params}`, {
            signal,
            headers: { Accept: "application/json" },
          });
          if (response.status === 429) {
            const raw = response.headers.get("retry-after")?.trim() ?? "";
            const delay = /^\d+$/.test(raw)
              ? Number(raw) * 1000
              : Date.parse(raw) - now().getTime();
            const bounded =
              Number.isFinite(delay) && delay > 0
                ? Math.min(86_400_000, Math.max(60_000, delay))
                : 15 * 60_000;
            await options.store.setCooldown(ORIGIN_SCOPE, bounded);
            providers.push(
              status(
                now(),
                "rate-limited",
                "HTTP_429",
                (await options.store.retryAt(ORIGIN_SCOPE, true)) ?? undefined,
              ),
            );
            break;
          }
          if (!response.ok) throw new Error("PROVIDER_HTTP_ERROR");
          const body = await readBoundedJson(response, signal);
          // Inspect raw duplicates before the existing parser deduplicates values:
          // two rows can share a value while carrying conflicting HS editions.
          const rawRows = (body as { data?: unknown[] })?.data;
          if (!Array.isArray(rawRows)) throw new Error("INVALID_RESPONSE");
          const identities = new Set<string>();
          const editions = new Set<string>();
          for (const raw of rawRows) {
            if (!raw || typeof raw !== "object") throw new Error("INVALID_RESPONSE");
            const row = raw as Record<string, unknown>;
            const identity = `${row.flowCode}|${row.cmdCode}`;
            if (
              identities.has(identity) ||
              !/^H[0-6]$/.test(String(row.classificationCode ?? "")) ||
              row.flowCode !== "X" ||
              String(row.partner2Code) !== "0" ||
              String(row.motCode) !== "0" ||
              row.customsCode !== "C00" ||
              (row.unit != null && row.unit !== "USD")
            )
              throw new Error("INVALID_DIMENSIONS");
            identities.add(identity);
            editions.add(String(row.classificationCode));
          }
          if (editions.size > 1) throw new Error("MIXED_HS_EDITION");
          const rows = parseComtradeResponse(body, { period, codes });
          if (!rows.length) {
            providers.push(status(now(), "empty", "REFERENCE_MONTH_UNPUBLISHED"));
            if (period === request.referencePeriod) break;
            continue;
          }
          evidence.push({
            period,
            classificationCode: [...editions][0]!,
            reporterCode: "410",
            partnerCode: "0",
            partner2Code: "0",
            flowCode: "X",
            customsCode: "C00",
            motCode: "0",
            unit: "USD",
            source: "public-preview",
            originCheckedAt: now().toISOString(),
            components: rows.map((row) => ({
              code: String(row.cmdCode),
              valueUsd: Number(row.primaryValue),
            })),
          });
        } catch {
          providers.push(status(now(), "unavailable", "SUMMARY_RESPONSE_UNVERIFIED"));
          if (period === request.referencePeriod) break;
        }
      }
      evidence.sort((a, b) => a.period.localeCompare(b.period));
      const summaries = evidence.some((row) => row.period === request.referencePeriod)
        ? assembleHs2CategorySummaries(request.categoryIds, evidence, now())
        : {};
      if (!Object.keys(summaries).length && !providers.length)
        providers.push(status(now(), "unavailable", "INCOMPLETE_HS_BASKET"));
      return { summaries, providers };
    } finally {
      await options.store.releaseRefresh(ORIGIN_SCOPE, owner);
    }
  };
}
