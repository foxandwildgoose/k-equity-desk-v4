import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { kiwoomAccessMiddleware } from "@/lib/auth/kiwoom-middleware";
import { diagnoseKiwoom } from "@/server/kiwoom-diagnostics";
import { readKiwoomConfig } from "@/server/kiwoom-config";

export const getKiwoomDiagnostics = createServerFn({ method: "POST" })
  .middleware([kiwoomAccessMiddleware])
  .validator(
    z.object({
      code: z.string().regex(/^[0-9A-Z]{6}$/),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data, context }) =>
    diagnoseKiwoom(
      readKiwoomConfig(),
      {
        ...data,
        market: "KR",
        instrument: "stock",
        exchange: "KRX",
        currency: "KRW",
        quantityUnit: "주",
        interval: "day",
        flowScope: "KRX",
      },
      context.kiwoomUserId,
    ),
  );
