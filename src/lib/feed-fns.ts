/**
 * Server functions for source health (B0.5).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface SourceStatusRow {
  id: string;
  name: string;
  region: string;
  kind: string;
  tier: number;
  group: string;
  format: string;
  registryStatus: string;
  enabled: boolean;
  runnable: boolean;
  runnableReason: string | null;
  paywalled: boolean;
  url: string | null;
  notes: string;
  hasAdapter: boolean;
  health: {
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    httpStatus: number | null;
    latencyMs: number | null;
    itemCount: number | null;
    newestPublishedAt: string | null;
    consecutiveFailures: number;
    circuit: "closed" | "open";
    circuitUntil: string | null;
    adapterPath: string | null;
    lastError: string | null;
    notes: Record<string, string>;
  };
}

async function buildRows(): Promise<{ rows: SourceStatusRow[]; env: Record<string, boolean | string> }> {
  const [{ SOURCE_REGISTRY }, { healthOf }, { sourceRunnable }, { hasAdapter }] = await Promise.all([
    import("@/server/feeds/registry"),
    import("@/server/feeds/health"),
    import("@/server/feeds/http"),
    import("@/server/feeds/adapters"),
  ]);
  const secUa = Boolean(process.env.SEC_USER_AGENT?.trim());
  const rows = SOURCE_REGISTRY.map((s) => {
    const h = healthOf(s.id);
    const run = sourceRunnable(s.id);
    const notes = { ...h.notes };
    if ((s.id === "sec-edgar" || s.id === "sec-8k-atom") && !secUa) notes["sec-ua"] = "SEC UA 미설정 (SEC_USER_AGENT)";
    return {
      id: s.id,
      name: s.name,
      region: s.region,
      kind: s.kind,
      tier: s.tier,
      group: s.group,
      format: s.format,
      registryStatus: s.status,
      enabled: s.enabled,
      runnable: run.ok,
      runnableReason: run.reason ?? null,
      paywalled: Boolean(s.paywalled),
      url: s.url ?? s.probeUrl ?? null,
      notes: s.notes,
      hasAdapter: hasAdapter(s.id),
      health: {
        lastAttemptAt: h.lastAttemptAt,
        lastSuccessAt: h.lastSuccessAt,
        httpStatus: h.httpStatus,
        latencyMs: h.latencyMs,
        itemCount: h.itemCount,
        newestPublishedAt: h.newestPublishedAt,
        consecutiveFailures: h.consecutiveFailures,
        circuit: h.circuit,
        circuitUntil: h.circuitUntil,
        adapterPath: h.adapterPath,
        lastError: h.lastError,
        notes,
      },
    };
  });
  return {
    rows,
    env: {
      secUserAgent: secUa,
      kis: Boolean(process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET),
      finnhub: Boolean(process.env.FINNHUB_API_KEY),
      bloomberg: String(process.env.NEWS_BLOOMBERG_ENABLED ?? "true").toLowerCase() !== "false",
    },
  };
}

export const getSourceHealth = createServerFn({ method: "GET" }).handler(async () => {
  const { rows, env } = await buildRows();
  return { generatedAt: new Date().toISOString(), rows, env };
});

/** `지금 재시도`: bypass the TTL once, still respect the circuit. */
export const retrySource = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/) }))
  .handler(async ({ data }) => {
    const { runSource } = await import("@/server/feeds/runner");
    await import("@/server/feeds/adapters");
    const r = await runSource(data.id, { bypassCache: true });
    return { id: r.id, state: r.state, count: r.items.length, error: r.error ?? null, ms: r.ms };
  });

const SNAPSHOT_IDS = ["spx", "ndx", "dji", "rut", "vix", "tnx", "dxy", "wti", "gold", "btc", "usdkrw"] as const;

/** Delayed US/FX/commodity snapshot tiles (F3.2 / F3.6). */
export const getMarketSnapshot = createServerFn({ method: "GET" })
  .validator(z.object({ ids: z.array(z.enum(SNAPSHOT_IDS)).max(11).optional() }))
  .handler(async ({ data }) => {
    const { fetchSnapshot } = await import("@/server/feeds/snapshot");
    return fetchSnapshot(data.ids ? [...data.ids] : undefined);
  });

/** US economic calendar for the next 7 days from the official policy pack (F3.4). */
export const getUsCalendar = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchUsOfficialPolicy } = await import("@/server/us-official-research");
  try {
    const pack = await fetchUsOfficialPolicy();
    const now = Date.now();
    const horizon = now + 7 * 86_400_000;
    const events = pack.calendar
      .filter((e) => {
        if (!e.iso) return false;
        const t = Date.parse(`${e.iso.slice(0, 10)}T23:59:59Z`);
        return t >= now - 86_400_000 && t <= horizon;
      })
      .sort((a, b) => (a.iso ?? "").localeCompare(b.iso ?? "")) // ked-allow-string-date-sort: single-format time series
      .slice(0, 12);
    return { events, fetchedAt: pack.fetchedAt, errors: pack.errors };
  } catch (err) {
    return { events: [], fetchedAt: new Date().toISOString(), errors: [err instanceof Error ? err.message : "calendar unavailable"] };
  }
});

/** Naver AI market briefing (F1.5) — current + today's v2 list, attributed. */
export const getNaverAiBriefing = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchJsonWithPolicy } = await import("@/server/feeds/http");
  const { mapNaverAiBriefing, naverList } = await import("@/lib/feed/parsers/naver");
  const { kstToday } = await import("@/lib/feed/time");
  const out: { current: ReturnType<typeof mapNaverAiBriefing>; list: NonNullable<ReturnType<typeof mapNaverAiBriefing>>[]; error: string | null; fetchedAt: string } = {
    current: null,
    list: [],
    error: null,
    fetchedAt: new Date().toISOString(),
  };
  try {
    const cur = await fetchJsonWithPolicy<unknown>("https://stock.naver.com/api/securityAi/marketBriefing/current?marketBriefing=domain", { sourceId: "naver-ai-briefing" });
    out.current = mapNaverAiBriefing(cur);
    const list = await fetchJsonWithPolicy<unknown>(`https://stock.naver.com/api/securityAi/v2/marketBriefing?date=${kstToday()}&size=20`, { sourceId: "naver-ai-briefing" });
    out.list = naverList(list, ["items"]).map((r) => mapNaverAiBriefing(r)).filter((x): x is NonNullable<typeof x> => x != null);
  } catch (err) {
    out.error = err instanceof Error ? err.message.slice(0, 160) : "unavailable";
  }
  return out;
});
