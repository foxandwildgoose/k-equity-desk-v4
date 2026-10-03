/**
 * Clock-based session estimates (F1.2 / F3.3). Holidays are NOT modeled, so
 * every label is marked `추정` unless a verified calendar source says
 * otherwise. Pure module.
 */
import { zonedParts } from "./time.ts";

export type UsSession = "pre" | "regular" | "after" | "closed";

export const US_SESSION_LABEL: Record<UsSession, string> = {
  pre: "프리마켓",
  regular: "정규장",
  after: "애프터마켓",
  closed: "휴장",
};

function weekday(ms: number, zone: "America/New_York" | "Asia/Seoul"): number {
  const p = zonedParts(ms, zone);
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

/** US equities by the New York clock: pre 04:00–09:30, regular 09:30–16:00, after 16:00–20:00. */
export function usSessionEstimate(now = Date.now()): { session: UsSession; label: string; estimated: true } {
  const p = zonedParts(now, "America/New_York");
  const wd = weekday(now, "America/New_York");
  const mins = p.h * 60 + p.mi;
  let session: UsSession = "closed";
  if (wd >= 1 && wd <= 5) {
    if (mins >= 4 * 60 && mins < 9 * 60 + 30) session = "pre";
    else if (mins >= 9 * 60 + 30 && mins < 16 * 60) session = "regular";
    else if (mins >= 16 * 60 && mins < 20 * 60) session = "after";
  }
  return { session, label: US_SESSION_LABEL[session], estimated: true };
}

export type KrSession = "nxt-pre" | "pre-auction" | "regular" | "close-auction" | "after-hours" | "nxt-after" | "closed";

export const KR_SESSION_LABEL: Record<KrSession, string> = {
  "nxt-pre": "NXT 프리마켓",
  "pre-auction": "장전 동시호가",
  regular: "KRX 정규장",
  "close-auction": "장마감 동시호가",
  "after-hours": "KRX 시간외 · NXT 애프터",
  "nxt-after": "NXT 애프터마켓",
  closed: "장 마감",
};

/**
 * KRX/NXT by the KST clock: NXT pre 08:00–08:50, KRX pre-auction 08:30–09:00,
 * regular 09:00–15:20, closing auction 15:20–15:30, KRX after-hours 15:40–18:00
 * (NXT after 15:30–20:00). Weekends closed; holidays not modeled.
 */
export function krSessionEstimate(now = Date.now()): { session: KrSession; label: string; estimated: true } {
  const p = zonedParts(now, "Asia/Seoul");
  const wd = weekday(now, "Asia/Seoul");
  const mins = p.h * 60 + p.mi;
  let session: KrSession = "closed";
  if (wd >= 1 && wd <= 5) {
    if (mins >= 8 * 60 && mins < 8 * 60 + 30) session = "nxt-pre";
    else if (mins >= 8 * 60 + 30 && mins < 9 * 60) session = "pre-auction";
    else if (mins >= 9 * 60 && mins < 15 * 60 + 20) session = "regular";
    else if (mins >= 15 * 60 + 20 && mins < 15 * 60 + 30) session = "close-auction";
    else if (mins >= 15 * 60 + 40 && mins < 18 * 60) session = "after-hours";
    else if (mins >= 15 * 60 + 30 && mins < 20 * 60) session = "nxt-after";
  }
  return { session, label: KR_SESSION_LABEL[session], estimated: true };
}

/** Naver index `marketStatus` codes → Korean label (source-provided, not estimated). */
export function krIndexStatusLabel(ms: string | null | undefined): string | null {
  if (!ms) return null;
  const u = ms.toUpperCase();
  if (u === "OPEN") return "KRX 개장";
  if (u === "CLOSE" || u === "CLOSED") return "KRX 마감";
  if (u === "PREOPEN" || u === "PRE") return "KRX 장전";
  if (u === "AFTER" || u === "AFTERHOURS") return "KRX 시간외";
  return ms;
}
