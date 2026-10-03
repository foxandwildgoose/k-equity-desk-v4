import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Empty list: always states the reason and links to source health (B0.7). */
export function EmptyState({ reason, className }: { reason: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground", className)}>
      <p className="inline-flex items-start gap-1.5 text-left leading-relaxed">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{reason}</span>
      </p>
      <p className="mt-2">
        <Link to="/status/sources" className="inline-flex min-h-8 items-center font-semibold text-primary hover:underline">
          소스 상태 확인 →
        </Link>
      </p>
    </div>
  );
}
