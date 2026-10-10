import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  parseNaverChartSecurity,
  parseYahooChartSecurity,
  type ChartSecurity,
} from "@/lib/charts/security";

const cache = new Map<string, { at: number; value: ChartSecurity }>();
const pending = new Map<string, Promise<ChartSecurity | null>>();

export async function fetchChartSecurity(code: string): Promise<ChartSecurity | null> {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < 60 * 60_000) return hit.value;
  const existing = pending.get(code);
  if (existing) return existing;
  const task = (async () => {
    const response = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
      headers: {
        "User-Agent": "Mozilla/5.0 KoreaEquityCommand/1.0",
        Accept: "application/json",
        Referer: "https://m.stock.naver.com/",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const value = parseNaverChartSecurity(code, await response.json());
    if (value) {
      if (cache.size > 500) cache.delete(cache.keys().next().value!);
      cache.set(code, { at: Date.now(), value });
    }
    return value;
  })()
    .catch(() => null)
    .finally(() => pending.delete(code));
  pending.set(code, task);
  return task;
}

export const getChartSecurity = createServerFn({ method: "GET" })
  .validator(
    z.object({
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[0-9A-Z]{6}$/),
    }),
  )
  .handler(async ({ data }) => fetchChartSecurity(data.code));

export async function fetchUsChartSecurity(code: string): Promise<ChartSecurity | null> {
  const key = `US:${code}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60 * 60_000) return hit.value;
  const existing = pending.get(key);
  if (existing) return existing;
  const task = (async () => {
    for (const host of ["query1", "query2"]) {
      try {
        const response = await fetch(
          `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code)}?interval=1d&range=1d`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 KoreaEquityCommand/1.0",
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(8_000),
          },
        );
        if (!response.ok) continue;
        const payload = (await response.json()) as { chart?: { result?: { meta?: unknown }[] } };
        const value = parseYahooChartSecurity(code, payload.chart?.result?.[0]?.meta);
        if (value) {
          if (cache.size > 500) cache.delete(cache.keys().next().value!);
          cache.set(key, { at: Date.now(), value });
          return value;
        }
      } catch {
        /* The existing alternate Yahoo endpoint can still work. */
      }
    }
    return null;
  })().finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}

export const getUsChartSecurity = createServerFn({ method: "GET" })
  .validator(
    z.object({
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z][A-Z0-9.-]{0,14}$/),
    }),
  )
  .handler(async ({ data }) => fetchUsChartSecurity(data.code));
