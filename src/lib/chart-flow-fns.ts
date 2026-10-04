import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { fetchChartFlow } from "@/server/chart-flow";

export const getChartFlow = createServerFn({ method: "GET" })
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
    }),
  )
  .handler(async ({ data }) => fetchChartFlow(data, getRequest().signal));
