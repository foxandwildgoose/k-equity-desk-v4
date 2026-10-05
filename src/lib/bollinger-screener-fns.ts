import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BOLLINGER_SCREENER_LIMITS } from "./bollinger/screener";

// Public price analysis shares the existing price-query access model. Optional
// stored Kiwoom confirmations still use verified owner/read authorization.
const screenerMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("./auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("./auth/isolation.server");
    assertSameSiteRequest();
    let userId: string | null = null;
    try {
      const { readKiwoomConfig } = await import("@/server/kiwoom-config");
      const config = readKiwoomConfig();
      if (config.enabled && config.authEnabled !== false && (config.mode === "direct" || config.readAuthRequired)) {
        const { getSessionUser } = await import("./auth/verify.server");
        userId = (await getSessionUser(context.bearerToken))?.id ?? null;
      }
    } catch { /* Optional flow fails closed without blocking ordinary prices. */ }
    return next({ context: { screenerUserId: userId } });
  });
export const getBollingerScreener = createServerFn({ method: "POST" })
  .middleware([screenerMiddleware])
  .validator(z.object({ symbols: z.array(z.object({
    market: z.enum(["KR", "US"]), symbol: z.string().trim().toUpperCase().min(1).max(12),
  }).refine(row => row.market === "KR" ? /^[0-9A-Z]{6}$/.test(row.symbol) : /^[A-Z][A-Z0-9.-]{0,11}$/.test(row.symbol), "유효하지 않은 종목"))
    .min(1).max(BOLLINGER_SCREENER_LIMITS.maxSymbols).transform(rows => rows.filter((row, index) => rows.findIndex(other => other.market === row.market && other.symbol === row.symbol) === index)) }))
  .handler(async ({ data, context }) => {
    const { fetchBollingerScreener } = await import("@/server/bollinger-screener");
    return fetchBollingerScreener(data.symbols, context.screenerUserId);
  });
