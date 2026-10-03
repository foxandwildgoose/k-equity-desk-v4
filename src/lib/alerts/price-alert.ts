/**
 * Chart price-alert evaluator (F7 alerts / AT-33). Pure: given the alert and
 * the latest price, decide whether the line was crossed since the last
 * evaluation. The first observation only records the side (no fire).
 */
import type { PriceAlert } from "../store-migrate.ts";

export type Side = "above" | "below";

export function sideOf(price: number, level: number): Side {
  return price >= level ? "above" : "below";
}

export function evaluatePriceAlert(alert: PriceAlert, price: number, nowIso: string): { fired: boolean; direction: "up" | "down" | null; next: PriceAlert } {
  if (!alert.active || alert.kind !== "price-cross" || alert.level == null || !Number.isFinite(price) || price <= 0) {
    return { fired: false, direction: null, next: alert };
  }
  const side = sideOf(price, alert.level);
  const prev = alert.lastSide;
  if (!prev) return { fired: false, direction: null, next: { ...alert, lastSide: side } };
  const dir = prev === "below" && side === "above" ? "up" : prev === "above" && side === "below" ? "down" : null;
  const fired = dir != null && (alert.direction === "any" || alert.direction === dir);
  const next: PriceAlert = { ...alert, lastSide: side };
  if (fired) {
    next.lastFiredAt = nowIso;
    if (alert.repeat === "once") next.active = false;
  }
  return { fired, direction: fired ? dir : null, next };
}

/** Evaluate every active price alert for one instrument; returns fired ids + updated list. */
export function evaluateAlertsFor(alerts: readonly PriceAlert[], market: "KR" | "US", code: string, price: number, nowIso: string): { fired: PriceAlert[]; alerts: PriceAlert[] } {
  const fired: PriceAlert[] = [];
  const out = alerts.map((a) => {
    if (a.market !== market || a.code.toUpperCase() !== code.toUpperCase()) return a;
    const r = evaluatePriceAlert(a, price, nowIso);
    if (r.fired) fired.push(r.next);
    return r.next;
  });
  return { fired, alerts: out };
}

/**
 * Indicator alerts (F7.11): RSI crossing 70/30 and moving-average crosses,
 * detected between the last two finite values. Returns the direction or null.
 */
export function crossOfLevel(prev: number | null | undefined, cur: number | null | undefined, level: number): "up" | "down" | null {
  if (prev == null || cur == null || !Number.isFinite(prev) || !Number.isFinite(cur)) return null;
  if (prev < level && cur >= level) return "up";
  if (prev > level && cur <= level) return "down";
  return null;
}

export function crossOfLines(fastPrev: number | null | undefined, slowPrev: number | null | undefined, fastCur: number | null | undefined, slowCur: number | null | undefined): "up" | "down" | null {
  if ([fastPrev, slowPrev, fastCur, slowCur].some((v) => v == null || !Number.isFinite(v as number))) return null;
  const before = (fastPrev as number) - (slowPrev as number);
  const after = (fastCur as number) - (slowCur as number);
  if (before < 0 && after >= 0) return "up";
  if (before > 0 && after <= 0) return "down";
  return null;
}

/** Evaluate an indicator alert on the latest bars; `seenBarKey` prevents re-firing on the same bar. */
export function evaluateIndicatorAlert(
  alert: PriceAlert,
  input: { rsi?: readonly (number | null)[]; fast?: readonly (number | null)[]; slow?: readonly (number | null)[]; barKey: string },
  nowIso: string,
): { fired: boolean; direction: "up" | "down" | null; next: PriceAlert } {
  if (!alert.active) return { fired: false, direction: null, next: alert };
  const lastTwo = (s?: readonly (number | null)[]) => (s && s.length >= 2 ? [s[s.length - 2], s[s.length - 1]] : [null, null]);
  let dir: "up" | "down" | null = null;
  if (alert.kind === "rsi-cross" && alert.level != null) {
    const [a, b] = lastTwo(input.rsi);
    dir = crossOfLevel(a, b, alert.level);
  } else if (alert.kind === "ma-cross") {
    const [fa, fb] = lastTwo(input.fast);
    const [sa, sb] = lastTwo(input.slow);
    dir = crossOfLines(fa, sa, fb, sb);
  }
  const already = alert.lastFiredAt != null && (alert as PriceAlert & { lastBarKey?: string }).lastBarKey === input.barKey;
  const fired = dir != null && !already && (alert.direction === "any" || alert.direction === dir);
  if (!fired) return { fired: false, direction: null, next: alert };
  const next = { ...alert, lastFiredAt: nowIso, active: alert.repeat === "once" ? false : true, lastBarKey: input.barKey } as PriceAlert;
  return { fired: true, direction: dir, next };
}
