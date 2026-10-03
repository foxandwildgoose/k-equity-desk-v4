/**
 * Text + URL helpers for feed items (B0.4). Pure module.
 */
import { decodeHtmlEntities } from "../readable-text.ts";

export const SNIPPET_MAX = 240;

/** Strip tags + CDATA, decode entities, collapse whitespace. */
export function stripHtml(input: unknown): string {
  if (input == null) return "";
  const s = String(input)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  // Entities can be double-encoded in feeds (`&amp;lt;b&amp;gt;`): decode twice, strip again.
  const once = decodeHtmlEntities(s);
  const twice = /&[a-z#0-9]+;/i.test(once) ? decodeHtmlEntities(once) : once;
  return twice
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u00a0\u200b\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Source snippet capped at 240 chars (never more — A4). */
export function clampSnippet(input: unknown, max = SNIPPET_MAX): string | undefined {
  const s = stripHtml(input);
  if (!s) return undefined;
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

const TRACKING_PARAM = /^(utm_[a-z0-9_]+|fbclid|gclid|mc_cid|mc_eid)$/i;

/**
 * Canonical https URL: forces https, drops `utm_*` (and common click ids) and
 * the fragment. Google News redirect URLs are returned untouched. Returns null
 * for anything that is not an http(s) URL.
 */
export function canonicalizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (/(^|\.)news\.google\.com$/i.test(u.hostname)) {
    return u.protocol === "http:" ? t.replace(/^http:/i, "https:") : t;
  }
  u.protocol = "https:";
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
  }
  return u.toString();
}

/** FNV-1a 32-bit → base36; stable across runtimes. */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Stable item id: `sourceId:nativeId`, else `sourceId:h<hash(canonical url)>`. */
export function stableItemId(sourceId: string, nativeId: unknown, url: string | null): string {
  const native = nativeId == null ? "" : String(nativeId).trim();
  if (native) return `${sourceId}:${native}`;
  return `${sourceId}:h${hashString(url ?? "")}`;
}

/** Host without `www.` for compact source badges. */
export function hostLabel(url: string | null | undefined): string {
  if (!url) return "원문";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "원문";
  }
}
