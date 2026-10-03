import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { collectFeed } from "@/server/feeds/aggregate";
import type { FeedPage } from "@/lib/feed/types";

const QuerySchema = z.object({
  regions: z
    .string()
    .max(20)
    .optional()
    .transform((v) => {
      const list = [...new Set((v ?? "KR,US").split(",").map((x) => x.trim().toUpperCase()))].filter((x): x is "KR" | "US" => x === "KR" || x === "US");
      return (list.length ? list : (["KR", "US"] as ("KR" | "US")[])).sort();
    }),
});

/**
 * GET /api/wire?regions=KR,US — Live Wire (F8.1). No cursor so the response
 * stays CDN-cacheable: the newest 100 clustered + scored items for the
 * canonical (sorted) region set. Clients diff against what they have seen.
 */
export const Route = createFileRoute("/api/wire")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) {
          return Response.json({ error: "bad_request", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
        }
        const regions = parsed.data.regions;
        const all = await collectFeed({ regions, wire: true, budgetMs: 7_500 });
        const body: FeedPage & { regions: string } = {
          items: all.items.slice(0, 100),
          nextCursor: null,
          partial: all.partial,
          sources: all.sources,
          generatedAt: all.generatedAt,
          regions: regions.join(","),
        };
        return Response.json(body, {
          headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" },
        });
      },
    },
  },
});
