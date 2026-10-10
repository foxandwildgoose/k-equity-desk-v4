/** Preserve the quote provider's actual currency; overseas does not mean USD. */
export function holdingQuoteCurrency(raw: unknown, reutersCode: string): string | null {
  const currency = String(raw ?? "").trim().toUpperCase();
  const names: Record<string, string> = {
    원: "KRW", 달러: "USD", 엔: "JPY", 엔화: "JPY", 홍콩달러: "HKD",
    위안: "CNY", 유로: "EUR", 파운드: "GBP",
  };
  if (names[currency]) return names[currency];
  if (/^[A-Z]{3}$/.test(currency)) return currency;
  if (/\.T$/i.test(reutersCode)) return "JPY";
  if (/\.HK$/i.test(reutersCode)) return "HKD";
  if (/\.(O|N|A|P|K)$/i.test(reutersCode)) return "USD";
  return null;
}
