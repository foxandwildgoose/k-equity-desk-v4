import { useEffect, useState } from "react";
import { formatAbsoluteTime, formatItemTime, type DisplayZone } from "@/lib/feed/time";
import type { TimePrecision } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

/**
 * `now` that is null during SSR/hydration (so markup matches) and then ticks
 * every 30 s on the client, keeping relative labels fresh.
 */
export function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Item time (B0.2): relative under 12 h, `MM.DD HH:mm` after, date-only `MM.DD`
 * (never a fake 00:00), `날짜 미상` when unknown. Tooltip: absolute KST (+ET).
 */
export function TimeStamp({
  publishedAt,
  precision,
  tz = "KST",
  withEt = false,
  className,
}: {
  publishedAt: string | null;
  precision: TimePrecision;
  tz?: DisplayZone;
  withEt?: boolean;
  className?: string;
}) {
  const now = useNow();
  const item = { publishedAt, precision };
  // Before mount, render a deterministic absolute label (no Date.now()).
  const label =
    now == null
      ? formatItemTime(item, { tz, now: publishedAt ? Date.parse(publishedAt) + 13 * 3_600_000 : 0 })
      : formatItemTime(item, { tz, now });
  const title = formatAbsoluteTime(item, { withEt: withEt || tz === "ET" });
  return (
    <time
      dateTime={publishedAt ?? undefined}
      title={title}
      aria-label={title}
      className={cn("tabular whitespace-nowrap", !publishedAt && "text-muted-foreground/70 italic", className)}
    >
      {label}
    </time>
  );
}
