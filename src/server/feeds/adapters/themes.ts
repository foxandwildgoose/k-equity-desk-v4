/**
 * Theme-page adapters: KR ETF news (F5.1) and robotics market/policy (F6.3 /
 * F6.4). Google News groups reuse `runGoogleNews`; the Federal Register uses
 * its public JSON API. Every request goes through `fetchWithPolicy`.
 */
import { fetchJsonWithPolicy } from "@/server/feeds/http";
import { registerAdapter, type AdapterOutput, type AdapterRunOptions } from "@/server/feeds/runner";
import { runGoogleNews } from "@/server/feeds/adapters/news";
import { setHealthNote } from "@/server/feeds/health";
import { tagItem } from "@/server/feeds/tagging";
import { ETF_BRAND_QUERIES, ETF_TOPIC_QUERIES } from "@/lib/etf-news";
import {
  federalRegisterToItem,
  federalRegisterUrl,
  ROBOT_GN_EN_MARKET,
  ROBOT_GN_EN_POLICY,
  ROBOT_GN_KR_MARKET,
  ROBOT_GN_KR_POLICY,
  type FederalRegisterDoc,
} from "@/lib/robotics/classify";
import type { FeedItem } from "@/lib/feed/types";

type Q = { q: string; locale: "ko" | "en" };
const ko = (list: string[], when: string): Q[] => list.map((q) => ({ q: `${q} when:${when}`, locale: "ko" }));
const en = (list: string[], when: string): Q[] => list.map((q) => ({ q: `${q} when:${when}`, locale: "en" }));

/** Theme GN groups. `when:` windows keep relevance-ranked GN results recent. */
export const THEME_GN_QUERIES: Record<string, Q[]> = {
  "gn-etf-kr": ko(ETF_TOPIC_QUERIES, "14d"),
  "gn-etf-brands": ko(ETF_BRAND_QUERIES, "7d"),
  "gn-robotics-kr": ko(ROBOT_GN_KR_MARKET, "7d"),
  "gn-robotics-en": en(ROBOT_GN_EN_MARKET, "7d"),
  "gn-robot-policy-kr": ko(ROBOT_GN_KR_POLICY, "30d"),
  "gn-robot-policy-en": en(ROBOT_GN_EN_POLICY, "30d"),
};

async function runFederalRegister(opts: AdapterRunOptions): Promise<AdapterOutput> {
  const json = await fetchJsonWithPolicy<{ results?: FederalRegisterDoc[]; count?: number }>(federalRegisterUrl(40), {
    sourceId: "federal-register",
    bypassCache: opts.bypassCache,
  });
  const fetchedAt = new Date(opts.now ?? Date.now()).toISOString();
  const docs = Array.isArray(json?.results) ? json.results : [];
  if (!Array.isArray(json?.results)) throw new Error("parse-fail");
  const items = docs.map((d) => federalRegisterToItem(d, fetchedAt)).filter((x): x is FeedItem => x != null);
  setHealthNote(
    "federal-register",
    "filter",
    docs.length ? `관련성 필터: ${docs.length}건 중 ${items.length}건 표시 (제목·초록에 로봇 용어 · premerger/조기종료 제외)` : null,
  );
  return { items: items.map(tagItem), adapterPath: "json" };
}

for (const [id, queries] of Object.entries(THEME_GN_QUERIES)) registerAdapter(id, (o) => runGoogleNews(id, queries, o));
registerAdapter("federal-register", runFederalRegister);
