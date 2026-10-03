/**
 * Ticker tagging (F1.3 / F3.5). Pure: dictionaries are passed in, never imported
 * through `@/` aliases.
 *
 * KR: exact 6-char code or company name; the longest name wins and consumes its
 * span, so "LG" never matches inside "LG에너지솔루션". Names < 2 chars ignored.
 * US: cashtags (`$NVDA`), exchange notation (`NASDAQ: NVDA`), exact company names.
 */
import type { FeedTicker } from "./types.ts";

export interface KrNameEntry {
  code: string;
  nameKo: string;
  nameEn?: string;
}

export interface KrTickerIndex {
  codes: Set<string>;
  /** Longest first. */
  names: { name: string; code: string; ascii: boolean }[];
}

const ASCII_NAME = /^[A-Za-z0-9&.\- ]+$/;

export function buildKrTickerIndex(entries: readonly KrNameEntry[]): KrTickerIndex {
  const codes = new Set<string>();
  const names: { name: string; code: string; ascii: boolean }[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const code = e.code.trim().toUpperCase();
    if (!/^[0-9A-Z]{6}$/.test(code)) continue;
    codes.add(code);
    for (const raw of [e.nameKo]) {
      const name = (raw ?? "").trim();
      if (name.length < 2) continue;
      const key = `${name}|${code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      names.push({ name, code, ascii: ASCII_NAME.test(name) });
    }
  }
  names.sort((a, b) => b.name.length - a.name.length || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { codes, names };
}

function isAsciiWordChar(ch: string | undefined): boolean {
  return ch != null && /[A-Za-z0-9]/.test(ch);
}

/** KR tickers mentioned in `text`, in order of first appearance. */
export function tagKrTickers(text: string, index: KrTickerIndex): FeedTicker[] {
  if (!text) return [];
  const hits: { pos: number; code: string }[] = [];
  const masked = new Array<boolean>(text.length).fill(false);

  for (const m of text.matchAll(/(?<![0-9A-Za-z])([0-9][0-9A-Z]{5})(?![0-9A-Za-z])/g)) {
    const code = m[1]!;
    if (!index.codes.has(code)) continue;
    const start = m.index!;
    for (let i = start; i < start + 6; i++) masked[i] = true;
    hits.push({ pos: start, code });
  }

  for (const { name, code, ascii } of index.names) {
    let from = 0;
    while (from <= text.length - name.length) {
      const pos = text.indexOf(name, from);
      if (pos < 0) break;
      from = pos + 1;
      let free = true;
      for (let i = pos; i < pos + name.length; i++) {
        if (masked[i]) {
          free = false;
          break;
        }
      }
      if (!free) continue;
      if (ascii && (isAsciiWordChar(text[pos - 1]) || isAsciiWordChar(text[pos + name.length]))) continue;
      for (let i = pos; i < pos + name.length; i++) masked[i] = true;
      hits.push({ pos, code });
    }
  }

  hits.sort((a, b) => a.pos - b.pos);
  const out: FeedTicker[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (seen.has(h.code)) continue;
    seen.add(h.code);
    out.push({ market: "KR", code: h.code });
  }
  return out;
}

export interface UsTickerIndex {
  symbols: Set<string>;
  /** Exact company names (case-sensitive), longest first. */
  names: { name: string; symbol: string }[];
}

export function buildUsTickerIndex(entries: readonly { symbol: string; names: string[] }[]): UsTickerIndex {
  const symbols = new Set<string>();
  const names: { name: string; symbol: string }[] = [];
  for (const e of entries) {
    const sym = e.symbol.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(sym)) continue;
    symbols.add(sym);
    for (const n of e.names) if (n.trim().length >= 3) names.push({ name: n.trim(), symbol: sym });
  }
  names.sort((a, b) => b.name.length - a.name.length);
  return { symbols, names };
}

/** US tickers from cashtags, exchange notation and exact company names. */
export function tagUsTickers(text: string, index: UsTickerIndex): FeedTicker[] {
  if (!text) return [];
  const hits: { pos: number; code: string }[] = [];
  for (const m of text.matchAll(/(?<![A-Za-z0-9])\$([A-Z]{1,5}(?:\.[A-Z])?)(?![A-Za-z0-9])/g)) {
    hits.push({ pos: m.index!, code: m[1]! });
  }
  for (const m of text.matchAll(/\b(?:NASDAQ|NYSE|NYSEARCA|AMEX|Nasdaq|Nyse)\s*:\s*([A-Z]{1,5}(?:\.[A-Z])?)\b/g)) {
    hits.push({ pos: m.index!, code: m[1]! });
  }
  const masked = new Array<boolean>(text.length).fill(false);
  for (const { name, symbol } of index.names) {
    let from = 0;
    while (from <= text.length - name.length) {
      const pos = text.indexOf(name, from);
      if (pos < 0) break;
      from = pos + 1;
      if (isAsciiWordChar(text[pos - 1]) || isAsciiWordChar(text[pos + name.length])) continue;
      let free = true;
      for (let i = pos; i < pos + name.length; i++) if (masked[i]) free = false;
      if (!free) continue;
      for (let i = pos; i < pos + name.length; i++) masked[i] = true;
      hits.push({ pos, code: symbol });
    }
  }
  hits.sort((a, b) => a.pos - b.pos);
  const out: FeedTicker[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (seen.has(h.code)) continue;
    seen.add(h.code);
    out.push({ market: "US", code: h.code });
  }
  return out;
}
