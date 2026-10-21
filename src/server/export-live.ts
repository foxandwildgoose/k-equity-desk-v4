import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CORE20_HS_PROXY } from "@/lib/export-desk/hs-map";
import { fetchLiveTradeSnapshot, fetchTradeCategorySnapshot } from "./export-trade-pipeline";
import { fetchGoogleNewsRss } from "./us-link-feed";

export type { FredPoint } from "@/lib/export-desk/parse-fred";
export type { DestinationRow } from "@/lib/export-desk/destinations";
export type { LiveTradeBundle } from "./export-trade-pipeline";

export const getLiveTradeBundle = createServerFn({ method: "GET" }).handler(async () =>
  fetchLiveTradeSnapshot(),
);

// Headlines have their own query: an optional RSS failure cannot delay statistics.
export const getExportTradeNews = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await fetchGoogleNewsRss("한국 월별 수출입동향 반도체 수출", 8, "ko").catch(
    () => [],
  );
  return rows.map((row) => ({
    title: row.title,
    url: row.url,
    publishedAt: row.datetime,
    source: row.source,
  }));
});

export const getTradeCategorySeries = createServerFn({ method: "GET" })
  .validator(
    z.object({
      categoryId: z
        .string()
        .max(60)
        .refine(
          (id) => CORE20_HS_PROXY.some((p) => p.key === id) || /^hs2:\d{2}$|^hs4:\d{4}$/.test(id),
          "지원하지 않는 HS 품목입니다.",
        ),
    }),
  )
  .handler(async ({ data }) => fetchTradeCategorySnapshot(data.categoryId));
