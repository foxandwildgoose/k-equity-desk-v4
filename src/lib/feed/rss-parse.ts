/**
 * RSS 2.0 / Atom 1.0 / RDF (RSS 1.0) → flat entries (B0.4). Pure module.
 * Charset detection: Content-Type → XML prolog → <meta charset> → UTF-8.
 */
import { XMLParser } from "fast-xml-parser";
import { stripHtml } from "./text.ts";

export interface FeedEntry {
  title: string;
  link: string;
  guid: string;
  /** Raw source date string (parse with `parseSourceTime`). Empty when missing. */
  pubDate: string;
  /** HTML-stripped, entity-decoded, whitespace-collapsed. */
  description: string;
  categories: string[];
  author: string;
  /** Google News `<source>` publisher name, when present. */
  source?: string;
  sourceUrl?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  // Descriptions frequently carry raw (invalid-XML) HTML: keep them as text.
  stopNodes: ["*.description", "*.encoded", "*.summary", "*.content"],
});

type Node = unknown;

function arr(v: Node): Node[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function text(v: Node): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o["#text"] != null) return String(o["#text"]);
  }
  return "";
}

function clean(v: Node): string {
  return stripHtml(text(v));
}

function obj(v: Node): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function atomLink(v: Node): string {
  const links = arr(v);
  let first = "";
  for (const l of links) {
    if (typeof l === "string") {
      if (!first) first = l;
      continue;
    }
    const o = obj(l);
    const href = typeof o["@_href"] === "string" ? (o["@_href"] as string) : "";
    const rel = typeof o["@_rel"] === "string" ? (o["@_rel"] as string) : "alternate";
    if (href && rel === "alternate") return href.trim();
    if (href && !first) first = href;
  }
  return first.trim();
}

function categoriesOf(v: Node): string[] {
  const out: string[] = [];
  for (const c of arr(v)) {
    const o = obj(c);
    const t = typeof c === "string" ? c : typeof o["@_term"] === "string" ? String(o["@_term"]) : text(c);
    const s = stripHtml(t);
    if (s) out.push(s);
  }
  return out;
}

function authorOf(item: Record<string, unknown>): string {
  const a = item.author ?? item.creator;
  if (a == null) return "";
  const first = arr(a)[0];
  const o = obj(first);
  if (o.name != null) return clean(o.name);
  return clean(first);
}

function rssEntry(raw: Node): FeedEntry | null {
  const it = obj(raw);
  const title = clean(it.title);
  const link = clean(it.link) || atomLink(it.link);
  const guid = clean(it.guid) || link;
  if (!title && !link) return null;
  const src = obj(it.source);
  const source = clean(it.source) || undefined;
  return {
    title,
    link,
    guid,
    pubDate: clean(it.pubDate ?? it.date ?? it.published ?? it.updated),
    description: clean(it.description ?? it.encoded),
    categories: categoriesOf(it.category ?? it.subject),
    author: authorOf(it),
    source,
    sourceUrl: typeof src["@_url"] === "string" ? (src["@_url"] as string) : undefined,
  };
}

function atomEntry(raw: Node): FeedEntry | null {
  const it = obj(raw);
  const title = clean(it.title);
  const link = atomLink(it.link);
  const guid = clean(it.id) || link;
  if (!title && !link) return null;
  return {
    title,
    link,
    guid,
    pubDate: clean(it.published ?? it.updated ?? it.date),
    description: clean(it.summary ?? it.content),
    categories: categoriesOf(it.category),
    author: authorOf(it),
  };
}

/** Parse RSS 2.0, Atom 1.0 or RDF text into flat entries. Never throws. */
export function parseFeed(xml: string): FeedEntry[] {
  if (!xml || typeof xml !== "string") return [];
  let doc: Record<string, unknown>;
  try {
    doc = obj(parser.parse(xml.replace(/^\uFEFF/, "")));
  } catch {
    return [];
  }
  const rss = obj(doc.rss);
  if (Object.keys(rss).length) {
    const channel = obj(arr(rss.channel)[0]);
    return arr(channel.item).map(rssEntry).filter((e): e is FeedEntry => e != null);
  }
  const feed = obj(doc.feed);
  if (Object.keys(feed).length) {
    return arr(feed.entry).map(atomEntry).filter((e): e is FeedEntry => e != null);
  }
  const rdf = obj(doc.RDF);
  if (Object.keys(rdf).length) {
    const items = arr(rdf.item).length ? arr(rdf.item) : arr(obj(arr(rdf.channel)[0]).item);
    return items.map(rssEntry).filter((e): e is FeedEntry => e != null);
  }
  return [];
}

function normalizeCharset(label: string | null | undefined): string | null {
  if (!label) return null;
  const l = label.trim().toLowerCase().replace(/^["']|["']$/g, "");
  if (!l) return null;
  if (l === "ks_c_5601-1987" || l === "ksc5601" || l === "cp949" || l === "x-windows-949" || l === "ms949") return "euc-kr";
  return l;
}

/** Charset from a `Content-Type` header value. */
export function charsetFromContentType(ct: string | null | undefined): string | null {
  const m = ct?.match(/charset\s*=\s*["']?([\w.:-]+)/i);
  return normalizeCharset(m?.[1]);
}

/** Charset from an XML prolog or HTML meta tag in the first bytes. */
export function charsetFromMarkup(head: string): string | null {
  const prolog = head.match(/<\?xml[^>]*encoding\s*=\s*["']([\w.:-]+)["']/i);
  if (prolog) return normalizeCharset(prolog[1]);
  const meta = head.match(/<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i);
  if (meta) return normalizeCharset(meta[1]);
  return null;
}

/**
 * Decode response bytes: `Content-Type` charset, then XML prolog, then
 * `<meta charset>`, then UTF-8. EUC-KR via `TextDecoder("euc-kr")`.
 */
export function decodeFeedBytes(bytes: Uint8Array, contentType?: string | null): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const label = charsetFromContentType(contentType) ?? charsetFromMarkup(head) ?? "utf-8";
  try {
    return new TextDecoder(label).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  }
}
