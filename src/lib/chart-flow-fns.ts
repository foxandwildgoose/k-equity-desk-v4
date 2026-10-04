import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { fetchChartFlow } from "@/server/chart-flow";
import { kiwoomAccessMiddleware } from "@/lib/auth/kiwoom-middleware";

// Daily calendar dates belong in the body; a long GET URL exceeds production header limits.
export const getChartFlow = createServerFn({ method: "POST" })
  .middleware([kiwoomAccessMiddleware])
  .validator(
    z.object({
      code: z.string().trim().min(1).max(15),
      market: z.enum(["KR", "US"]),
      instrument: z.enum(["stock", "etf", "etn"]),
      exchange: z.string().min(1).max(24),
      currency: z.enum(["KRW", "USD"]),
      quantityUnit: z.enum(["주", "좌", "shares"]),
      from: z.string().length(10),
      to: z.string().length(10),
      interval: z.enum(["day", "week", "month", "year", "minute"]),
      flowScope: z.enum(["KRX", "NXT", "SOR"]).optional(),
      expectedDailyDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(8000).optional(),
    }),
  )
  .handler(async ({ data, context }) => fetchChartFlow(data, getRequest().signal, context.kiwoomUserId));
