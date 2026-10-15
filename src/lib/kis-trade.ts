/** Pure parser for the documented, plaintext H0STCNT0 46-field records. */
export type KisRealtimeTrade = {
  code: string;
  tradeTime: string;
  price: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  ask: number;
  bid: number;
  tradeVolume: number;
  accumulatedVolume: number;
  accumulatedValue: number;
  tradeStrength: number;
  businessDate: string;
  marketControlCode: string;
  tradedAt: string;
  source: "kis-krx-websocket";
  receivedAt: string;
};

export const MAX_KIS_TRADE_AGE_MS = 120_000;
export const MAX_KIS_CLOCK_SKEW_MS = 10_000;
const FIELD_COUNT = 46;

function numeric(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim() || !/^-?\d+(?:\.\d+)?$/.test(value.trim()))
    return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function kisTradeTimestamp(businessDate: string, tradeTime: string): string | null {
  if (!/^\d{8}$/.test(businessDate) || !/^\d{6}$/.test(tradeTime)) return null;
  const day = `${businessDate.slice(0, 4)}-${businessDate.slice(4, 6)}-${businessDate.slice(6, 8)}`;
  const time = `${tradeTime.slice(0, 2)}:${tradeTime.slice(2, 4)}:${tradeTime.slice(4, 6)}`;
  const timestamp = Date.parse(`${day}T${time}+09:00`);
  if (!Number.isFinite(timestamp)) return null;
  // Date.parse normalizes impossible dates (e.g. February 30), so round-trip.
  if (new Date(timestamp + 9 * 3_600_000).toISOString().slice(0, 19) !== `${day}T${time}`)
    return null;
  return new Date(timestamp).toISOString();
}

export function parseKisTradePayload(payload: string, now = Date.now()): KisRealtimeTrade | null {
  const f = payload.split("^");
  if (f.length !== FIELD_COUNT || !/^\d{6}$/.test(f[0] ?? "") || !/^[1-5]$/.test(f[3] ?? ""))
    return null;
  const tradedAt = kisTradeTimestamp(f[33]!, f[1]!);
  if (!tradedAt || !Number.isFinite(now)) return null;
  const age = now - Date.parse(tradedAt);
  if (age < -MAX_KIS_CLOCK_SKEW_MS || age > MAX_KIS_TRADE_AGE_MS) return null;
  const positions = [2, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 18] as const;
  const values = positions.map((index) => numeric(f[index]));
  if (values.some((value) => value === null)) return null;
  const [
    price,
    magnitude,
    pctMagnitude,
    open,
    high,
    low,
    ask,
    bid,
    tradeVolume,
    accumulatedVolume,
    accumulatedValue,
    tradeStrength,
  ] = values as number[];
  if (price! <= 0 || values.some((value, index) => index !== 1 && index !== 2 && value! < 0))
    return null;
  const direction = f[3] === "4" || f[3] === "5" ? -1 : f[3] === "3" ? 0 : 1;
  if (!direction && (magnitude !== 0 || pctMagnitude !== 0)) return null;
  const change = direction * Math.abs(magnitude!);
  const changePct = direction * Math.abs(pctMagnitude!);
  const prevClose = price! - change;
  if (prevClose <= 0 || Math.abs((change / prevClose) * 100 - changePct) > 0.025) return null;
  return {
    code: f[0]!,
    tradeTime: f[1]!,
    price: price!,
    change,
    changePct,
    open: open!,
    high: high!,
    low: low!,
    ask: ask!,
    bid: bid!,
    tradeVolume: tradeVolume!,
    accumulatedVolume: accumulatedVolume!,
    accumulatedValue: accumulatedValue!,
    tradeStrength: tradeStrength!,
    businessDate: f[33]!,
    marketControlCode: f[44]!,
    tradedAt,
    source: "kis-krx-websocket",
    receivedAt: new Date(now).toISOString(),
  };
}

export function parseKisTradeFrame(raw: string, now = Date.now()): KisRealtimeTrade[] {
  const parts = raw.split("|");
  // Encrypted messages require decryption; never interpret their bytes as prices.
  if (parts.length !== 4 || parts[0] !== "0" || parts[1] !== "H0STCNT0" || !/^\d+$/.test(parts[2]!))
    return [];
  const count = Number(parts[2]);
  const fields = parts[3]!.split("^");
  if (count < 1 || count > 100 || fields.length !== count * FIELD_COUNT) return [];
  const trades: KisRealtimeTrade[] = [];
  for (let i = 0; i < count; i++) {
    const trade = parseKisTradePayload(
      fields.slice(i * FIELD_COUNT, (i + 1) * FIELD_COUNT).join("^"),
      now,
    );
    if (trade) trades.push(trade);
  }
  return trades;
}
