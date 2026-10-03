/**
 * Server functions for the optional AI layer (F9). Everything is off unless
 * AI_BRIEFING_ENABLED=true + AI_MODEL + a provider key are set on the server.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Item = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(400),
  snippet: z.string().max(400).optional(),
  source: z.string().max(120),
  time: z.string().max(60),
  url: z.string().max(600),
});

export const getAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { aiStatus } = await import("@/server/ai/service");
  return aiStatus();
});

/** User-clicked briefing over ≤ 30 on-screen items (F9.2). */
export const generateAiBriefing = createServerFn({ method: "POST" })
  .validator(z.object({ items: z.array(Item).min(1).max(30), context: z.string().min(1).max(60) }))
  .handler(async ({ data }) => {
    const { generateBriefing } = await import("@/server/ai/service");
    return generateBriefing(data.items, data.context);
  });

/** Optional EN→KO headline translation (F9.4), labelled 기계 번역. */
export const translateAiHeadlines = createServerFn({ method: "POST" })
  .validator(z.object({ items: z.array(z.object({ id: z.string().min(1).max(200), title: z.string().min(1).max(400) })).min(1).max(30) }))
  .handler(async ({ data }) => {
    const { translateTitles } = await import("@/server/ai/service");
    return translateTitles(data.items);
  });
