/**
 * Resolve quote enrichment without changing an issuer's published portfolio.
 * Autocomplete ranking and a company-name fragment are not security identity.
 */
export type HoldingSearchItem = {
  code?: string;
  name?: string;
  nationCode?: string;
  reutersCode?: string;
  isEtf?: boolean;
  /** Used only when an upstream source actually supplies an ISIN. */
  isin?: string;
};

export type HoldingIdentityHint = {
  isin?: string | null;
  code?: string | null;
  /** Published US trading symbol, not a ticker guessed from the company name. */
  foreignTicker?: string | null;
  nation?: string | null;
  isEtf?: boolean;
};

function validIsin(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(normalized) ? normalized : null;
}

function nationCode(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;
  return ({ KR: "KOR", US: "USA", JP: "JPN", UK: "GBR", HK: "HKG", CN: "CHN" })[
    normalized as "KR" | "US" | "JP" | "UK" | "HK" | "CN"
  ] ?? normalized;
}

/**
 * Only formatting, explicit share-class notation and legal suffixes vary here.
 * Holdings/Technology/Bank, preferred/ADR wording and company-name words remain.
 * Translating or transliterating a company name requires separate evidence.
 */
function nameIdentity(value: string | undefined): string | null {
  if (!value) return null;
  let name = value
    .normalize("NFKC")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, " and ")
    .replace(/&/g, " and ")
    .replace(/\s*\/(?:DE|CA)\s*$/i, "")
    .toLowerCase();
  const classes = new Set<string>();
  name = name.replace(/\b(?:class|cl)[.\s-]+([a-z])\b/g, (_match, shareClass: string) => {
    classes.add(shareClass);
    return " ";
  });
  name = name.replace(/클래스\s*([a-z])\b/g, (_match, shareClass: string) => {
    classes.add(shareClass);
    return " ";
  });
  if (classes.size > 1) return null;
  name = name
    .replace(/\b(?:common|ordinary)\s+(?:stocks?|shares?)\s*[.,]*$/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const words = name.split(/\s+/);
  const legalSuffixes = new Set([
    "inc", "incorporated", "corp", "corporation", "co", "company",
    "ltd", "limited", "plc", "llc", "llp", "nv", "ag", "se",
  ]);
  while (words.length > 1 && legalSuffixes.has(words.at(-1)!)) words.pop();
  const company = words.join("");
  if (!company) return null;
  return `${company}|${[...classes][0] ?? ""}`;
}

function itemSecurityKey(item: HoldingSearchItem): string | null {
  const nation = nationCode(item.nationCode);
  if (!nation) return null;
  const code = item.code?.trim().toUpperCase();
  const reutersCode = item.reutersCode?.trim().toUpperCase();
  if (nation === "KOR") {
    if (!code || !/^[0-9A-Z]{6}$/.test(code)) return null;
    return `${nation}:${code}:${Boolean(item.isEtf)}`;
  }
  const foreignCode = reutersCode || code;
  if (!foreignCode || !/^[A-Z0-9][A-Z0-9.^=-]{0,31}$/.test(foreignCode)) return null;
  return `${nation}:${foreignCode}:${Boolean(item.isEtf)}`;
}

function usSymbol(value: string | null | undefined): string | null {
  const symbol = value?.trim().toUpperCase();
  if (!symbol || !/^[A-Z][A-Z0-9./-]{0,15}$/.test(symbol)) return null;
  return symbol.replace(/[./-]/g, "");
}

function hasPublishedUsSymbol(item: HoldingSearchItem, symbol: string): boolean {
  if (nationCode(item.nationCode) !== "USA") return false;
  // Reuters is the actual quote key when supplied. Never override a conflicting
  // Reuters symbol merely because a separate display code happens to match.
  if (item.reutersCode?.trim()) {
    const bare = item.reutersCode.trim().toUpperCase().replace(/\.(?:OQ|O|N|A|P|K)$/, "");
    return usSymbol(bare) === symbol;
  }
  const code = item.code?.trim().toUpperCase();
  return usSymbol(code) === symbol || usSymbol(code?.replace(/\.(?:OQ|O|N)$/, "")) === symbol;
}

/**
 * Select exactly one demonstrated security. A missing quote is safer than a
 * different company's price; official weights never depend on this result.
 * ISIN domicile is not generally a listing-country hint (e.g. Irish US stocks).
 */
export function pickHoldingSearchItem<T extends HoldingSearchItem>(
  publishedName: string,
  items: readonly T[],
  hint: HoldingIdentityHint = {},
): T | null {
  const identity = nameIdentity(publishedName);
  const isin = validIsin(hint.isin);
  if (!identity || (hint.isin?.trim() && !isin)) return null;
  const publishedSymbol = usSymbol(hint.foreignTicker);
  if (hint.foreignTicker?.trim() && !publishedSymbol) return null;
  const requiredNation = nationCode(hint.nation);
  const requiredCode = hint.code?.trim().toUpperCase();
  const matches = new Map<string, T>();
  for (const item of items) {
    const securityKey = itemSecurityKey(item);
    if (!securityKey) continue;
    const nation = nationCode(item.nationCode);
    if (requiredNation && nation !== requiredNation) continue;
    // A foreign security must never become a domestic six-character ticker.
    if (isin && (isin.startsWith("KR") ? nation !== "KOR" : nation === "KOR")) continue;
    if (hint.isEtf != null && Boolean(item.isEtf) !== hint.isEtf) continue;
    if (
      requiredCode &&
      item.code?.trim().toUpperCase() !== requiredCode &&
      item.reutersCode?.trim().toUpperCase() !== requiredCode
    )
      continue;
    const itemIsin = validIsin(item.isin);
    if (isin && itemIsin && itemIsin !== isin) continue;
    if (publishedSymbol) {
      if (!hasPublishedUsSymbol(item, publishedSymbol)) continue;
    } else if (!(isin && itemIsin === isin) && nameIdentity(item.name) !== identity) continue;
    matches.set(securityKey, item);
  }
  return matches.size === 1 ? matches.values().next().value ?? null : null;
}
