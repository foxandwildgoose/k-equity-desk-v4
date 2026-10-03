/**
 * Server-side ticker tagging with the static dictionaries (F1.3 / F3.5).
 */
import { UNIVERSE } from "@/data/universe";
import { US_COMPANY_NAMES } from "@/data/us-names";
import { buildKrTickerIndex, buildUsTickerIndex, tagKrTickers, tagUsTickers, type KrTickerIndex, type UsTickerIndex } from "@/lib/feed/tickers";
import type { FeedItem } from "@/lib/feed/types";

let krIndex: KrTickerIndex | null = null;
let usIndex: UsTickerIndex | null = null;

export function krTickerIndex(): KrTickerIndex {
  if (!krIndex) krIndex = buildKrTickerIndex(UNIVERSE.map((u) => ({ code: u.code, nameKo: u.nameKo })));
  return krIndex;
}

export function usTickerIndex(): UsTickerIndex {
  if (!usIndex) usIndex = buildUsTickerIndex(US_COMPANY_NAMES);
  return usIndex;
}

/** Add KR/US tickers found in title (+ snippet) without dropping source-provided ones. */
export function tagItem<T extends FeedItem>(it: T): T {
  const text = `${it.title} ${it.snippet ?? ""}`;
  const found = it.lang === "en" ? tagUsTickers(text, usTickerIndex()) : [...tagKrTickers(text, krTickerIndex()), ...tagUsTickers(text, usTickerIndex())];
  if (!found.length) return it;
  const seen = new Set(it.tickers.map((t) => `${t.market}:${t.code}`));
  const tickers = [...it.tickers];
  for (const t of found) {
    const key = `${t.market}:${t.code}`;
    if (!seen.has(key)) {
      seen.add(key);
      tickers.push(t);
    }
  }
  return { ...it, tickers };
}
