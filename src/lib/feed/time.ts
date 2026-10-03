/**
 * Time kernel (B0.2). Parses every timestamp shape the sources emit into
 * `{ iso, precision }` and formats item times for the UI.
 *
 * Date-only values are normalized to 12:00 UTC of that calendar date. Noon UTC
 * falls on the same calendar date in both KST (UTC+9) and ET (UTC−4/−5), so a
 * date never shifts when shown in either zone, and no fake time is implied —
 * `precision: "day"` tells every consumer not to print a clock time.
 *
 * Pure module: no aliases, no JSX — runs under `node --experimental-strip-types`.
 */
import type { FeedItem, TimePrecision } from "./types.ts";

export type SourceZone = "Asia/Seoul" | "America/New_York" | "UTC";

export interface ParsedTime {
  iso: string | null;
  precision: TimePrecision;
}

export interface ParseTimeOptions {
  zone?: SourceZone;
  now?: number | Date;
}

const UNKNOWN: ParsedTime = { iso: null, precision: "unknown" };
const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;

function nowMs(now?: number | Date): number {
  if (now instanceof Date) return now.getTime();
  return typeof now === "number" && Number.isFinite(now) ? now : Date.now();
}

function validYmd(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1970 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= last;
}

function validHms(h: number, mi: number, s: number): boolean {
  return h >= 0 && h <= 23 && mi >= 0 && mi <= 59 && s >= 0 && s <= 60;
}

const zoneFormatters = new Map<string, Intl.DateTimeFormat>();
function zoneFormatter(zone: string): Intl.DateTimeFormat {
  let fmt = zoneFormatters.get(zone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    zoneFormatters.set(zone, fmt);
  }
  return fmt;
}

/** Wall-clock fields of `ms` in `zone`. */
export function zonedParts(
  ms: number,
  zone: SourceZone,
): { y: number; m: number; d: number; h: number; mi: number; s: number } {
  if (zone === "UTC") {
    const dt = new Date(ms);
    return {
      y: dt.getUTCFullYear(),
      m: dt.getUTCMonth() + 1,
      d: dt.getUTCDate(),
      h: dt.getUTCHours(),
      mi: dt.getUTCMinutes(),
      s: dt.getUTCSeconds(),
    };
  }
  if (zone === "Asia/Seoul") {
    const dt = new Date(ms + KST_OFFSET_MS);
    return {
      y: dt.getUTCFullYear(),
      m: dt.getUTCMonth() + 1,
      d: dt.getUTCDate(),
      h: dt.getUTCHours(),
      mi: dt.getUTCMinutes(),
      s: dt.getUTCSeconds(),
    };
  }
  const parts = zoneFormatter(zone).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const h = get("hour");
  return { y: get("year"), m: get("month"), d: get("day"), h: h === 24 ? 0 : h, mi: get("minute"), s: get("second") };
}

/** Wall time in `zone` → UTC epoch ms (DST-aware for America/New_York). */
export function zonedWallToUtcMs(
  y: number,
  m: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  zone: SourceZone,
): number {
  const wall = Date.UTC(y, m - 1, d, h, mi, s);
  if (zone === "UTC") return wall;
  if (zone === "Asia/Seoul") return wall - KST_OFFSET_MS;
  let utc = wall;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(utc, zone);
    const asWall = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
    const delta = wall - asWall;
    if (delta === 0) break;
    utc += delta;
  }
  return utc;
}

function dayIso(y: number, m: number, d: number): ParsedTime {
  if (!validYmd(y, m, d)) return UNKNOWN;
  return { iso: new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString(), precision: "day" };
}

function wallIso(
  y: number,
  m: number,
  d: number,
  h: number,
  mi: number,
  s: number | null,
  zone: SourceZone,
): ParsedTime {
  if (!validYmd(y, m, d) || !validHms(h, mi, s ?? 0)) return UNKNOWN;
  const ms = zonedWallToUtcMs(y, m, d, h, mi, s ?? 0, zone);
  return { iso: new Date(ms).toISOString(), precision: s == null ? "minute" : "second" };
}

function fromEpochMs(ms: number, precision: TimePrecision): ParsedTime {
  if (!Number.isFinite(ms)) return UNKNOWN;
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  if (Number.isNaN(dt.getTime()) || y < 1970 || y > 2200) return UNKNOWN;
  return { iso: dt.toISOString(), precision };
}

function epochPrecision(ms: number): TimePrecision {
  return ms % 1000 === 0 && Math.floor(ms / 1000) % 60 === 0 ? "minute" : "second";
}

/**
 * Parse a source timestamp.
 *
 * Handles `2026.09.25`, `26.09.25`, `2026-09-25`, `20260925`, `202609251403`
 * (Naver `YYYYMMDDHHmm`), `20260925140305`, `2026.09.25 14:03`, `09.25 14:03`
 * (year inferred; > 1 day after `now` → previous year), ISO with offset, ISO
 * without offset (wall time in `zone`), RFC-822, Unix seconds and milliseconds.
 * Invalid input → `{ iso: null, precision: "unknown" }`.
 */
export function parseSourceTime(raw: unknown, opts: ParseTimeOptions = {}): ParsedTime {
  const zone: SourceZone = opts.zone ?? "Asia/Seoul";
  if (raw == null) return UNKNOWN;
  if (raw instanceof Date) return fromEpochMs(raw.getTime(), "second");
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return UNKNOWN;
    const ms = raw >= 1e11 ? raw : raw * 1000;
    return fromEpochMs(ms, epochPrecision(ms));
  }
  if (typeof raw !== "string") return UNKNOWN;
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return UNKNOWN;

  let m: RegExpMatchArray | null;

  // Pure digit forms.
  if (/^\d+$/.test(s)) {
    if (s.length === 8) return dayIso(Number(s.slice(0, 4)), Number(s.slice(4, 6)), Number(s.slice(6, 8)));
    if (s.length === 12 || s.length === 14) {
      return wallIso(
        Number(s.slice(0, 4)),
        Number(s.slice(4, 6)),
        Number(s.slice(6, 8)),
        Number(s.slice(8, 10)),
        Number(s.slice(10, 12)),
        s.length === 14 ? Number(s.slice(12, 14)) : null,
        zone,
      );
    }
    if (s.length === 10) return fromEpochMs(Number(s) * 1000, epochPrecision(Number(s) * 1000));
    if (s.length === 13) return fromEpochMs(Number(s), epochPrecision(Number(s)));
    return UNKNOWN;
  }

  // YYYY.MM.DD / YYYY-MM-DD / YYYY/MM/DD with optional wall time.
  m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (m[4] == null) return dayIso(y, mo, d);
    return wallIso(y, mo, d, Number(m[4]), Number(m[5]), m[6] != null ? Number(m[6]) : null, zone);
  }

  // YY.MM.DD (two-digit year) with optional time.
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{2})(?: (\d{1,2}):(\d{2}))?$/);
  if (m) {
    const y = 2000 + Number(m[1]);
    if (m[4] == null) return dayIso(y, Number(m[2]), Number(m[3]));
    return wallIso(y, Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), null, zone);
  }

  // MM.DD HH:mm (year inferred from `now` in the source zone).
  m = s.match(/^(\d{1,2})[.\-/](\d{1,2}) (\d{1,2}):(\d{2})$/);
  if (m) {
    const n = nowMs(opts.now);
    const cur = zonedParts(n, zone);
    const [mo, d, h, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    let parsed = wallIso(cur.y, mo, d, h, mi, null, zone);
    if (parsed.iso && Date.parse(parsed.iso) - n > DAY_MS) {
      parsed = wallIso(cur.y - 1, mo, d, h, mi, null, zone);
    }
    return parsed;
  }

  // ISO-8601 with explicit offset or Z.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const ms = Date.parse(s);
    const hasSeconds = /T\d{2}:\d{2}:\d{2}/.test(s);
    return fromEpochMs(ms, hasSeconds ? "second" : "minute");
  }

  // RFC-822 / RFC-2822 (e.g. `Fri, 25 Sep 2026 12:18:36 +0000`, `... GMT`).
  if (/^(?:[A-Za-z]{3},? )?\d{1,2} [A-Za-z]{3} \d{2,4} \d{1,2}:\d{2}(?::\d{2})? ?(?:[+-]\d{4}|[A-Z]{1,4})?$/.test(s)) {
    const ms = Date.parse(s);
    if (Number.isNaN(ms)) return UNKNOWN;
    const hasSeconds = /\d{1,2}:\d{2}:\d{2}/.test(s);
    return fromEpochMs(ms, hasSeconds ? "second" : "minute");
  }

  return UNKNOWN;
}

/** KST calendar day `YYYY-MM-DD` of an ISO instant. */
export function kstDayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's KST day key. */
export function kstToday(now?: number | Date): string {
  return new Date(nowMs(now) + KST_OFFSET_MS).toISOString().slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, "0");

export type DisplayZone = "KST" | "ET";

function displayZone(tz: DisplayZone): SourceZone {
  return tz === "ET" ? "America/New_York" : "Asia/Seoul";
}

export interface FormatTimeOptions {
  tz?: DisplayZone;
  now?: number | Date;
}

type TimedLike = Pick<FeedItem, "publishedAt" | "precision">;

/**
 * List label: `방금` / `N분 전` / `N시간 전` (< 12 h), else `MM.DD HH:mm`,
 * date-only `MM.DD` (never a fake 00:00), `YYYY.MM.DD` when > 180 days old,
 * `날짜 미상` when unknown.
 */
export function formatItemTime(item: TimedLike, opts: FormatTimeOptions = {}): string {
  if (!item.publishedAt || item.precision === "unknown") return "날짜 미상";
  const ms = Date.parse(item.publishedAt);
  if (Number.isNaN(ms)) return "날짜 미상";
  const n = nowMs(opts.now);
  const zone = displayZone(opts.tz ?? "KST");
  const age = n - ms;
  const p = zonedParts(ms, zone);
  if (age > 180 * DAY_MS) {
    return item.precision === "day"
      ? `${p.y}.${pad(p.m)}.${pad(p.d)}`
      : `${p.y}.${pad(p.m)}.${pad(p.d)}`;
  }
  if (item.precision === "day") {
    // Date-only: show the calendar date from the UTC-noon anchor.
    const dt = new Date(ms);
    return `${pad(dt.getUTCMonth() + 1)}.${pad(dt.getUTCDate())}`;
  }
  if (age >= -5 * 60_000 && age < 12 * 3_600_000) {
    const mins = Math.max(0, Math.floor(age / 60_000));
    if (mins < 1) return "방금";
    if (mins < 60) return `${mins}분 전`;
    return `${Math.floor(mins / 60)}시간 전`;
  }
  return `${pad(p.m)}.${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}`;
}

/** Absolute timestamp for tooltips: KST always, plus ET when `withEt`. */
export function formatAbsoluteTime(item: TimedLike, opts: { withEt?: boolean } = {}): string {
  if (!item.publishedAt || item.precision === "unknown") return "날짜 미상 (원문에 시각 없음)";
  const ms = Date.parse(item.publishedAt);
  if (Number.isNaN(ms)) return "날짜 미상";
  if (item.precision === "day") {
    const dt = new Date(ms);
    return `${dt.getUTCFullYear()}.${pad(dt.getUTCMonth() + 1)}.${pad(dt.getUTCDate())} (날짜만 제공)`;
  }
  const withSec = item.precision === "second";
  const fmt = (zone: SourceZone, label: string) => {
    const p = zonedParts(ms, zone);
    return `${p.y}.${pad(p.m)}.${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}${withSec ? `:${pad(p.s)}` : ""} ${label}`;
  };
  const kst = fmt("Asia/Seoul", "KST");
  return opts.withEt ? `${kst} · ${fmt("America/New_York", "ET")}` : kst;
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** Date group header label for a KST day key: 오늘 / 어제 / `MM.DD (요일)` / `YYYY.MM.DD`. */
export function dateGroupLabel(dayKey: string | null, now?: number | Date): string {
  if (!dayKey) return "날짜 미상";
  const today = kstToday(now);
  if (dayKey === today) return "오늘";
  const y = new Date(Date.parse(`${today}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
  if (dayKey === y) return "어제";
  const dt = new Date(`${dayKey}T00:00:00Z`);
  const label = `${dayKey.slice(5, 7)}.${dayKey.slice(8, 10)} (${WEEKDAY_KO[dt.getUTCDay()]})`;
  return dayKey.slice(0, 4) === today.slice(0, 4) ? label : `${dayKey.replace(/-/g, ".")}`;
}

/** Hours between an ISO instant and now (Infinity when unknown). */
export function ageHours(iso: string | null | undefined, now?: number | Date): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return Number.POSITIVE_INFINITY;
  return (nowMs(now) - ms) / 3_600_000;
}

/** `YYYYMMDD` for a KST day (Naver `date=` params). */
export function kstCompactDate(now?: number | Date): string {
  return kstToday(now).replace(/-/g, "");
}
