/**
 * Server functions for the theme pages: ETF news snapshot (F5.3) and the
 * robotics section (F6). Heavy modules are imported lazily inside handlers.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const KR_CODE = z.string().regex(/^[0-9][0-9A-Z]{5}$/);
const US_SYMBOL = z.string().regex(/^[A-Z][A-Z0-9.]{0,9}$/);
const EXPOSURE = z.enum(["pure-play", "significant", "indirect"]);
const CUSTOM = z.object({ code: z.string().max(12), name: z.string().max(60), segment: z.string().max(40).optional(), exposure: EXPOSURE.optional() });

/** Live ETF list snapshot for the ETF news briefing: top trading value + robot/AI ETFs. */
export const getEtfNewsSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const fetchedAt = new Date().toISOString();
  try {
    const [{ fetchAllEtfs }, { buildEtfBriefing, issuerOfEtfName }] = await Promise.all([import("@/server/etf-market"), import("@/lib/etf-news")]);
    const list = await fetchAllEtfs();
    const b = buildEtfBriefing([], list, Date.now());
    const pick = (e: (typeof list)[number]) => ({
      code: e.code,
      name: e.nameKo,
      price: e.price > 0 ? e.price : null,
      changePct: Number.isFinite(e.changePct) ? e.changePct : null,
      volume: e.volume > 0 ? e.volume : null,
      amount: e.amount > 0 ? e.amount : null,
      marketSum: e.marketSum > 0 ? e.marketSum : null,
      issuer: e.issuer ?? issuerOfEtfName(e.nameKo),
    });
    return {
      topTrading: (b.topTrading as typeof list).map(pick),
      robotAi: (b.robotAi as typeof list).map(pick),
      total: list.length,
      error: null as string | null,
      fetchedAt,
    };
  } catch (err) {
    return { topTrading: [], robotAi: [], total: 0, error: err instanceof Error ? err.message.slice(0, 120) : "error", fetchedAt };
  }
});

export const getRoboticsUniverse = createServerFn({ method: "GET" })
  .validator(z.object({ addedKr: z.array(CUSTOM).max(30).optional(), addedUs: z.array(CUSTOM).max(30).optional() }))
  .handler(async ({ data }) => {
    const { resolveRoboticsUniverse } = await import("@/server/robotics");
    return resolveRoboticsUniverse({
      addedKr: data.addedKr?.filter((c) => KR_CODE.safeParse(c.code).success),
      addedUs: data.addedUs?.filter((c) => US_SYMBOL.safeParse(c.code.toUpperCase()).success),
    });
  });

export const getRoboticsEtfs = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchRoboticsEtfs } = await import("@/server/robotics");
  return fetchRoboticsEtfs();
});

export const getRoboticsResearch = createServerFn({ method: "GET" })
  .validator(z.object({ krCodes: z.array(KR_CODE).max(40), usSymbols: z.array(US_SYMBOL).max(24) }))
  .handler(async ({ data }) => {
    const { fetchRoboticsResearch, fetchRoboticsStreet } = await import("@/server/robotics");
    const [kr, street] = await Promise.all([
      fetchRoboticsResearch(data.krCodes),
      fetchRoboticsStreet(data.usSymbols).catch(() => ({ notes: [], headlines: [], note: "월가 공개 피드를 받지 못했습니다.", fetchedAt: new Date().toISOString() })),
    ]);
    return { kr, street };
  });

export const getRoboticsCompanyMeta = createServerFn({ method: "GET" })
  .validator(z.object({ krCodes: z.array(KR_CODE).max(40), usSymbols: z.array(US_SYMBOL).max(24) }))
  .handler(async ({ data }) => {
    const { fetchRoboticsCompanyMeta } = await import("@/server/robotics");
    return fetchRoboticsCompanyMeta(data.krCodes, data.usSymbols);
  });

export const getRoboticsCompanyNews = createServerFn({ method: "GET" })
  .validator(z.object({ market: z.enum(["KR", "US"]), code: z.string().min(1).max(12), name: z.string().min(1).max(60) }))
  .handler(async ({ data }) => {
    const ok = data.market === "KR" ? KR_CODE.safeParse(data.code).success : US_SYMBOL.safeParse(data.code).success;
    if (!ok) return { items: [], source: "", error: "invalid code", fetchedAt: new Date().toISOString() };
    const { fetchRoboticsCompanyNews } = await import("@/server/robotics");
    return fetchRoboticsCompanyNews(data.market, data.code, data.name);
  });
