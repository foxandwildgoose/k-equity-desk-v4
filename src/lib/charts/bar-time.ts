/**
 * OHLC bar date → chart time. Daily+ bars keep "YYYY-MM-DD" (business day);
 * intraday "YYYY-MM-DD HH:mm" wall-clock (KST for KR, New York for US) →
 * unix seconds. Pure (Intl only).
 */
export function zonedWallToUnix(ymdHm: string, timeZone: string): number {
  const [date, hm] = ymdHm.split(" ");
  const [year, month, day] = (date ?? "").split("-").map(Number);
  const [hour, minute] = (hm ?? "00:00").split(":").map(Number);
  if (!year || !month || !day) return 0;
  const want = Date.UTC(year, month - 1, day, hour || 0, minute || 0);
  let utc = want;
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  for (let i = 0; i < 3; i++) {
    const parts = fmt.formatToParts(new Date(utc));
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asWall = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") === 24 ? 0 : g("hour"), g("minute"));
    const delta = want - asWall;
    if (delta === 0) break;
    utc += delta;
  }
  return Math.floor(utc / 1000);
}

export function barTimeOf(date: string, market: "KR" | "US"): string | number {
  if (date.includes(" ")) return zonedWallToUnix(date, market === "US" ? "America/New_York" : "Asia/Seoul");
  return date.slice(0, 10);
}

/** Calendar day ("YYYY-MM-DD") of a chart time in the market's zone. */
export function dayOfTime(t: string | number, market: "KR" | "US"): string {
  if (typeof t === "string") return t.slice(0, 10);
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: market === "US" ? "America/New_York" : "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(new Date(t * 1000));
}
