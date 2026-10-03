import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { aggregateFeed, FEED_GROUPS } from "@/server/feeds/aggregate";
import type { ItemKind, Region } from "@/lib/feed/types";

const KINDS = ["news", "research", "disclosure", "filing", "policy", "rating", "briefing"] as const;

const QuerySchema = z.object({
  region: z.enum(["KR", "US", "GLOBAL"]).default("KR"),
  group: z.enum(FEED_GROUPS).optional(),
  kinds: z
    .string()
    .max(120)
    .optional()
    .transform((v) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean) : []))
    .pipe(z.array(z.enum(KINDS)).max(7)),
  topics: z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12) : [])),
  tickers: z
    .string()
    .max(300)
    .optional()
    .transform((v) => (v ? v.split(",").map((x) => x.trim().toUpperCase()).filter((x) => /^(KR:|US:)?[0-9A-Z.]{1,10}$/.test(x)).slice(0, 40) : [])),
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/**
 * GET /api/feed — aggregated, clustered, scored, newest-first feed (B0.7).
 * CDN-cacheable; 8 s budget with `partial: true` when a source is missing.
 */
export const Route = createFileRoute("/api/feed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) {
          return Response.json({ error: "bad_request", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
        }
        const q = parsed.data;
        const page = await aggregateFeed({
          regions: [q.region as Region],
          group: q.group,
          kinds: q.kinds as ItemKind[],
          topics: q.topics,
          tickers: q.tickers,
          cursor: q.cursor ?? null,
          limit: q.limit,
        });
        return Response.json(page, {
          headers: {
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
          },
        });
      },
    },
  },
});
