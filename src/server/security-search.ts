import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { inferSectorId } from "@/lib/infer-sector";
import { UNIVERSE } from "@/data/universe";
import { US_COMPANY_NAMES } from "@/data/us-names";
import { createSecuritySearchEngine } from "./security-search-engine.ts";
import type { ListedSearchHit } from "../lib/security-search.ts";

export type { ListedSearchHit } from "../lib/security-search.ts";

const localRows: ListedSearchHit[] = [
  ...UNIVERSE.map(row => ({ code: row.code, nameKo: row.nameKo, nameEn: row.nameEn, market: row.market, region: "KR" as const, sectorId: row.sectorId, isEtf: false, source: "universe" as const })),
  ...US_COMPANY_NAMES.map(row => ({ code: row.symbol, nameKo: row.names[0]!, nameEn: row.names.join(" · "), market: "US" as const, region: "US" as const, sectorId: inferSectorId(row.names[0]!), isEtf: false, source: "us-universe" as const })),
];
const searchSecurities = createSecuritySearchEngine({ localRows });

/** Robotics name resolution remains domestic-only; global search uses the paged response. */
export async function searchListedSecurities(query: string): Promise<Array<ListedSearchHit & { market: "KOSPI" | "KOSDAQ"; region: "KR" }>> {
  const result = await searchSecurities(query, 0, 100);
  return result.hits.filter((hit): hit is ListedSearchHit & { market: "KOSPI" | "KOSDAQ"; region: "KR" } => hit.region === "KR" && (hit.market === "KOSPI" || hit.market === "KOSDAQ"));
}

export const getSecuritySearch = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string().trim().min(1).max(80), offset: z.number().int().min(0).max(50000).optional(), limit: z.number().int().min(1).max(100).optional() }))
  .handler(async ({ data }) => searchSecurities(data.q, data.offset, data.limit));
