import { CORE20_HS_PROXY, HS2_KO, aggregateProxy, hsName } from "../lib/export-desk/hs-map.ts";
import { destinationRows, type DestinationRow } from "../lib/export-desk/destinations.ts";
import type { FredPoint } from "../lib/export-desk/parse-fred.ts";
import type { TradeObservation } from "../lib/export-desk/parse-import.ts";
import type { ExportProviderStatus } from "../lib/export-desk/provider-status.ts";

// Endpoint and dimensions match the UN's own comtradeapicall/PreviewGet.py.
const ENDPOINT = "https://comtradeapi.un.org/public/v1/preview/C/M/HS";
const SOURCE = "https://comtradeplus.un.org/";
const MAX_RECORDS = 500;
type Row = Record<string, unknown>;
interface Snapshot {
  rows: Row[];
  at: number;
}
export interface ComtradeTrade {
  exports: FredPoint[];
  imports: FredPoint[];
  observations: TradeObservation[];
  destinations: { period: string; rows: DestinationRow[]; source: string };
  providers: ExportProviderStatus[];
  latestPeriod: string | null;
  monthsCached: number;
}
export interface ComtradeOptions {
  categoryId?: string;
  months?: number;
}
interface ClientOptions {
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  budgetMs?: number;
}
class ProviderFailure extends Error {
  readonly reason: "rate-limited" | "unavailable" | "invalid-response";
  readonly code: string;
  constructor(reason: "rate-limited" | "unavailable" | "invalid-response", code: string = reason) {
    super(reason);
    this.reason = reason;
    this.code = code;
  }
}

function value(raw: unknown): number | null {
  if (
    typeof raw !== "number" &&
    (typeof raw !== "string" || !/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw))
  )
    return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function completedMonths(now: Date, count: number): string[] {
  const kst = new Date(now.getTime() + 9 * 60 * 60_000);
  const end = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(end);
    d.setUTCMonth(d.getUTCMonth() - i - 1);
    return d.toISOString().slice(0, 7);
  });
}

/** Refuse truncated previews, mixed dimensions and conflicting duplicate records. */
export function parseComtradeResponse(
  body: unknown,
  query: { period: string; codes: readonly string[]; countries?: boolean },
): Row[] {
  if (!body || typeof body !== "object") throw new ProviderFailure("invalid-response");
  const payload = body as {
    data?: unknown;
    count?: unknown;
    error?: unknown;
    errorMessage?: unknown;
  };
  if (
    !Array.isArray(payload.data) ||
    payload.data.length >= MAX_RECORDS ||
    payload.error ||
    payload.errorMessage
  ) {
    throw new ProviderFailure("invalid-response");
  }
  if (
    payload.count != null &&
    (value(payload.count) == null || Number(payload.count) > payload.data.length)
  ) {
    throw new ProviderFailure("invalid-response");
  }
  const byIdentity = new Map<string, Row>();
  for (const raw of payload.data) {
    if (!raw || typeof raw !== "object") throw new ProviderFailure("invalid-response");
    const row = raw as Row;
    const period = String(row.period ?? "");
    const code = String(row.cmdCode ?? "");
    const partner = String(row.partnerCode ?? "");
    const flow = String(row.flowCode ?? "");
    if (
      period !== query.period.replace("-", "") ||
      Number(row.reporterCode) !== 410 ||
      !query.codes.includes(code) ||
      !["X", "M"].includes(flow) ||
      (!query.countries && partner !== "0") ||
      !/^\d{1,3}$/.test(partner) ||
      (row.partner2Code != null && Number(row.partner2Code) !== 0) ||
      (row.motCode != null && Number(row.motCode) !== 0) ||
      (row.customsCode != null && String(row.customsCode) !== "C00") ||
      value(row.primaryValue) == null
    )
      throw new ProviderFailure("invalid-response");
    const key = `${flow}|${code}|${Number(partner)}`;
    const prior = byIdentity.get(key);
    if (prior && Number(prior.primaryValue) !== Number(row.primaryValue))
      throw new ProviderFailure("invalid-response");
    byIdentity.set(key, row);
  }
  return [...byIdentity.values()];
}

async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body) throw new ProviderFailure("invalid-response");
  const reader = response.body.getReader();
  let abortListener: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    abortListener = () => reject(new ProviderFailure("unavailable"));
    signal.addEventListener("abort", abortListener, { once: true });
    if (signal.aborted) abortListener();
  });
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await Promise.race([reader.read(), aborted]);
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 2_000_000) throw new ProviderFailure("invalid-response");
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
    if (abortListener) signal.removeEventListener("abort", abortListener);
    void reader.cancel().catch(() => {});
  }
}

export function createComtradeClient(options: ClientOptions = {}) {
  const fetcher = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  const cache = new Map<string, Snapshot>();
  const pending = new Map<string, Promise<ComtradeTrade>>();
  let cooldownUntil = 0;

  async function load(request: ComtradeOptions): Promise<ComtradeTrade> {
    const at = now();
    const months = completedMonths(at, Math.max(1, Math.min(60, request.months ?? 36)));
    const proxy = CORE20_HS_PROXY.find((p) => p.key === request.categoryId);
    const direct = /^hs[24]:\d{2}(?:\d{2})?$/.test(request.categoryId ?? "")
      ? request.categoryId!.split(":")[1]
      : null;
    const codes = proxy?.codes ?? (direct ? [direct] : request.categoryId ? [] : ["TOTAL"]);
    if (!codes.length) throw new Error("지원하지 않는 HS 품목입니다.");
    const controller = new AbortController();
    const budget = setTimeout(() => controller.abort(), options.budgetMs ?? 22_000);
    const failures: string[] = [];
    const reasonCodes: string[] = [];
    const snapshots = new Map<string, Snapshot>();
    let stopped = false;
    const cacheKey = (period: string, selected: readonly string[], countries = false) =>
      `${period}|${selected.join(",")}|${countries ? "countries" : "world"}`;

    async function query(period: string, selected: readonly string[], countries = false) {
      const key = cacheKey(period, selected, countries);
      const cached = cache.get(key);
      // An empty publication is retried after one hour, never blacklisted forever.
      const ttl = cached?.rows.length ? 6 * 60 * 60_000 : 60 * 60_000;
      if (cached && at.getTime() - cached.at < ttl) {
        snapshots.set(key, cached);
        return;
      }
      if (stopped || controller.signal.aborted || at.getTime() < cooldownUntil) {
        if (cached && at.getTime() - cached.at < 7 * 86_400_000) snapshots.set(key, cached);
        return;
      }
      const signal = AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(options.timeoutMs ?? 4_500),
      ]);
      const params = new URLSearchParams({
        reporterCode: "410",
        period: period.replace("-", ""),
        cmdCode: selected.join(","),
        flowCode: countries || request.categoryId ? "X" : "X,M",
        partner2Code: "0",
        customsCode: "C00",
        motCode: "0",
        maxRecords: String(MAX_RECORDS),
        format: "JSON",
        includeDesc: "true",
      });
      if (!countries) params.set("partnerCode", "0");
      try {
        const response = await fetcher(`${ENDPOINT}?${params}`, {
          signal,
          headers: { Accept: "application/json", "User-Agent": "KoreaExportDesk/2.0" },
        });
        if (response.status === 429) throw new ProviderFailure("rate-limited", "HTTP_429");
        if (!response.ok) throw new ProviderFailure("unavailable", `HTTP_${response.status}`);
        const rows = parseComtradeResponse(await readJson(response, signal), {
          period,
          codes: selected,
          countries,
        });
        if (countries && rows.some((r) => r.flowCode !== "X"))
          throw new ProviderFailure("invalid-response");
        const snapshot = { rows, at: now().getTime() };
        cache.set(key, snapshot);
        snapshots.set(key, snapshot);
        // Bound warm-worker memory, independently of serverless filesystem lifetime.
        if (cache.size > 512) cache.delete(cache.keys().next().value!);
      } catch (error) {
        const reason = error instanceof ProviderFailure ? error.reason : "unavailable";
        failures.push(reason);
        reasonCodes.push(
          error instanceof ProviderFailure
            ? error.code
            : signal.aborted
              ? "TIMEOUT"
              : "NETWORK_ERROR",
        );
        if (reason === "rate-limited") {
          cooldownUntil = now().getTime() + 60_000;
          stopped = true;
        }
        // Stop a failed origin quickly instead of making dozens of doomed calls.
        if (failures.filter((r) => r === "unavailable").length >= 2) stopped = true;
        if (cached && at.getTime() - cached.at < 7 * 86_400_000) snapshots.set(key, cached);
      }
    }

    async function pool(periods: string[]) {
      let cursor = 0;
      async function worker() {
        while (cursor < periods.length && !controller.signal.aborted)
          await query(periods[cursor++]!, codes);
      }
      await Promise.all([worker(), worker()]);
    }
    try {
      // Reserve time for useful current tables before backfilling history.
      const initial = request.categoryId ? months : months.slice(0, 4);
      await pool(initial);
      const published = initial.find((p) =>
        snapshots.get(cacheKey(p, codes))?.rows.some((r) => r.flowCode === "X"),
      );
      if (!request.categoryId && published && !stopped && !controller.signal.aborted) {
        await Promise.all([
          query(published, Object.keys(HS2_KO)),
          query(published, ["TOTAL"], true),
        ]);
      }
      if (!request.categoryId) await pool(months.slice(initial.length));
      const exports: FredPoint[] = [],
        imports: FredPoint[] = [],
        observations: TradeObservation[] = [];
      for (const period of [...months].reverse()) {
        const rows = snapshots.get(cacheKey(period, codes))?.rows ?? [];
        if (!request.categoryId) {
          for (const flow of ["X", "M"]) {
            const row = rows.find((r) => r.flowCode === flow && r.cmdCode === "TOTAL");
            if (row)
              (flow === "X" ? exports : imports).push({
                period,
                valueUsd: Number(row.primaryValue),
              });
          }
        } else {
          const byCode = Object.fromEntries(
            rows
              .filter((r) => r.flowCode === "X")
              .map((r) => [String(r.cmdCode), Number(r.primaryValue)]),
          );
          const sum = aggregateProxy(byCode, codes);
          if (sum != null)
            observations.push({
              period,
              categoryId: request.categoryId,
              categoryName: proxy?.label ?? hsName(direct!),
              valueUsd: sum,
              classification: "HS",
              geo: "KR",
              vintage: "UN Comtrade HS as reported",
              sourceFile: `UN Comtrade · 대한민국/전세계 · ${proxy?.label ?? `HS ${direct}`}`,
            });
        }
      }
      const latestPeriod = (request.categoryId ? observations : exports).at(-1)?.period ?? null;
      // Publication lags can exceed the first four probes. Use the newest
      // actually published period found during backfill for summary panels.
      if (
        !request.categoryId &&
        latestPeriod &&
        !published &&
        !stopped &&
        !controller.signal.aborted
      ) {
        await Promise.all([
          query(latestPeriod, Object.keys(HS2_KO)),
          query(latestPeriod, ["TOTAL"], true),
        ]);
      }
      let destinations: ComtradeTrade["destinations"] = {
        period: "",
        rows: [],
        source: "자료 미확보",
      };
      if (!request.categoryId && latestPeriod) {
        const chapters = Object.keys(HS2_KO);
        const chapterRows = snapshots.get(cacheKey(latestPeriod, chapters))?.rows ?? [];
        const byCode = Object.fromEntries(
          chapterRows
            .filter((r) => r.flowCode === "X")
            .map((r) => [String(r.cmdCode), Number(r.primaryValue)]),
        );
        for (const [code, valueUsd] of Object.entries(byCode))
          observations.push({
            period: latestPeriod,
            categoryId: `hs2:${code}`,
            categoryName: hsName(code),
            valueUsd,
            classification: "HS",
            geo: "KR",
            vintage: "UN Comtrade HS as reported",
            sourceFile: "UN Comtrade · 대한민국/전세계 · HS 2단위",
          });
        for (const item of CORE20_HS_PROXY) {
          const valueUsd = aggregateProxy(byCode, item.codes);
          if (valueUsd != null)
            observations.push({
              period: latestPeriod,
              categoryId: item.key,
              categoryName: item.label,
              valueUsd,
              classification: "HS",
              geo: "KR",
              vintage: "UN Comtrade HS as reported",
              sourceFile: `UN Comtrade · 대한민국/전세계 · ${item.label}`,
            });
        }
        const rows = snapshots.get(cacheKey(latestPeriod, ["TOTAL"], true))?.rows;
        if (rows?.length)
          destinations = {
            period: latestPeriod,
            rows: destinationRows(rows),
            source: "UN Comtrade · HS TOTAL · 수출 상대국",
          };
      }
      const count = request.categoryId ? observations.length : exports.length;
      const complete =
        count === months.length && (request.categoryId || imports.length === months.length);
      const stale = [...snapshots.values()].some((s) => at.getTime() - s.at >= 6 * 60 * 60_000);
      const reason =
        failures.includes("rate-limited") || at.getTime() < cooldownUntil
          ? "rate-limited"
          : failures.length
            ? "unavailable"
            : undefined;
      const state: ExportProviderStatus["state"] = count
        ? stale
          ? "stale"
          : complete
            ? "ok"
            : "partial"
        : (reason ?? "empty");
      const provider: ExportProviderStatus = {
        id: request.categoryId ? `comtrade.hs.${request.categoryId}` : "comtrade.total",
        name: request.categoryId ? "UN Comtrade 품목별 수출" : "UN Comtrade 대한민국 수출입",
        configured: true,
        state,
        checkedAt: now().toISOString(),
        asOf: latestPeriod,
        recordCount: count,
        sourceUrl: SOURCE,
        reasonCode: reasonCodes[0] ?? reason,
        message: `${count}/${months.length}개월 원자료 확보. ${request.categoryId ? "모든 HS 구성코드가 확인된 월만 집계합니다." : "보고국 한국·상대국 전세계·HS TOTAL·미 달러 명목금액입니다."} ${reason ? "조회 제한 또는 연결 실패가 있으며 누락 월은 0으로 채우지 않습니다." : "미공표 월은 제외합니다."}`,
      };
      const providers = [provider];
      const destinationSnapshot = latestPeriod
        ? snapshots.get(cacheKey(latestPeriod, ["TOTAL"], true))
        : undefined;
      const destinationStale =
        destinationSnapshot && at.getTime() - destinationSnapshot.at >= 6 * 60 * 60_000;
      if (!request.categoryId)
        providers.push({
          ...provider,
          id: "comtrade.destinations",
          name: "UN Comtrade 수출 대상국",
          state: destinations.rows.length
            ? destinationStale
              ? "stale"
              : "ok"
            : (reason ?? "empty"),
          asOf: destinations.period || null,
          recordCount: destinations.rows.length,
          message: destinations.rows.length
            ? "동일 월·HS TOTAL·수출·전체 운송/통관 기준 국가별 금액입니다."
            : "국가별 원자료를 확보하지 못했습니다.",
        });
      return {
        exports,
        imports,
        observations,
        destinations,
        providers,
        latestPeriod,
        monthsCached: count,
      };
    } finally {
      clearTimeout(budget);
      controller.abort();
    }
  }

  return {
    fetchComtradeTrade(request: ComtradeOptions = {}): Promise<ComtradeTrade> {
      const key = JSON.stringify([request.categoryId ?? "TOTAL", request.months ?? 36]);
      const existing = pending.get(key);
      if (existing) return existing;
      const job = load(request).finally(() => pending.delete(key));
      pending.set(key, job);
      return job;
    },
  };
}
export const fetchComtradeTrade = createComtradeClient().fetchComtradeTrade;
