import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import type { FeedSourceResult } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

/** Compact `소스 n/m 정상` chip linking to /status/sources (B0.5). */
export function SourceHealthChip({
  sources,
  className,
}: {
  sources: FeedSourceResult[] | undefined;
  className?: string;
}) {
  const list = (sources ?? []).filter((s) => s.state !== "disabled");
  const ok = list.filter((s) => s.ok).length;
  const total = list.length;
  const unverified = list.every((s) => !s.ok) && total > 0;
  const tone = total === 0 ? "muted" : ok === total ? "ok" : ok === 0 ? "bad" : "warn";
  return (
    <Link
      to="/status/sources"
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold",
        tone === "ok" && "border-emerald-500/40 text-emerald-500",
        tone === "warn" && "border-amber-500/40 text-amber-500",
        tone === "bad" && "border-price-up/40 text-price-up",
        tone === "muted" && "border-border text-muted-foreground",
        className,
      )}
      title="소스별 상태 · 재시도"
      data-testid="source-health-chip"
    >
      <Activity className="size-3" aria-hidden />
      {total === 0 ? "소스 확인 중" : `소스 ${ok}/${total} 정상`}
      {unverified && <span className="font-normal opacity-80">· 소스 미검증</span>}
    </Link>
  );
}
