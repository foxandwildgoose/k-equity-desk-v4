import { fetchComtradeTrade, type ComtradeOptions, type ComtradeTrade } from "./export-comtrade.ts";
import type { ExportTradeStore } from "./export-trade-store.ts";

const SCOPE = "comtrade-origin";
interface Dependencies {
  load?: typeof fetchComtradeTrade;
  store?: () => Promise<ExportTradeStore>;
  now?: () => Date;
}

/** One public-origin budget across categories, visitors and serverless workers. */
export function createSharedComtradeClient(dependencies: Dependencies = {}) {
  const load = dependencies.load ?? fetchComtradeTrade;
  const getStore =
    dependencies.store ??
    (async () => (await import("./export-trade-store.ts")).getExportTradeStore());
  const now = dependencies.now ?? (() => new Date());
  const pending = new Map<string, Promise<ComtradeTrade>>();

  function waiting(request: ComtradeOptions, retryAt?: string): ComtradeTrade {
    const provider = {
      id: request.categoryId ? `comtrade.hs.${request.categoryId}` : "comtrade.total",
      name: "UN Comtrade",
      configured: true,
      state: retryAt ? ("rate-limited" as const) : ("unavailable" as const),
      checkedAt: now().toISOString(),
      asOf: null,
      recordCount: 0,
      sourceUrl: "https://comtradeplus.un.org/",
      reasonCode: retryAt ? "SHARED_PROVIDER_COOLDOWN" : "REFRESH_IN_PROGRESS",
      message: retryAt
        ? "공급원의 재시도 대기 시간을 적용 중입니다. 검증된 저장본이 있으면 계속 표시합니다."
        : "다른 요청이 공식 자료를 수집하고 있습니다. 중복 요청을 보내지 않습니다.",
      ...(retryAt ? { retryAt } : {}),
    };
    return {
      exports: [],
      imports: [],
      observations: [],
      destinations: { period: "", rows: [], source: "UN Comtrade" },
      providers: request.categoryId
        ? [provider]
        : [provider, { ...provider, id: "comtrade.destinations" }],
      latestPeriod: null,
      monthsCached: 0,
    };
  }

  async function run(request: ComtradeOptions): Promise<ComtradeTrade> {
    const store = await getStore();
    const retryAt = await store.retryAt(SCOPE, true);
    if (retryAt && Date.parse(retryAt) > now().getTime()) return waiting(request, retryAt);
    const token = await store.acquireRefresh(SCOPE, 45_000);
    if (!token) return waiting(request);
    try {
      const result = await load(request);
      const until = Math.max(0, ...result.providers.map((p) => Date.parse(p.retryAt ?? "") || 0));
      if (until > now().getTime()) await store.setCooldown(SCOPE, until - now().getTime());
      return result;
    } finally {
      await store.releaseRefresh(SCOPE, token);
    }
  }
  return {
    fetchSharedComtradeTrade(request: ComtradeOptions = {}): Promise<ComtradeTrade> {
      const key = JSON.stringify([request.categoryId ?? "TOTAL", request.months ?? 36]);
      const existing = pending.get(key);
      if (existing) return existing;
      const task = run(request).finally(() => pending.delete(key));
      pending.set(key, task);
      return task;
    },
  };
}
export const fetchSharedComtradeTrade = createSharedComtradeClient().fetchSharedComtradeTrade;
