import { RISK_DISCLAIMER } from "@/data/market";
import { cn } from "@/lib/utils";

/** A3.6: every new page repeats the not-investment-advice notice. */
export function PageDisclaimer({ className, extra }: { className?: string; extra?: string }) {
  return (
    <p className={cn("text-[11px] leading-relaxed text-muted-foreground", className)} data-testid="risk-disclaimer">
      {RISK_DISCLAIMER}
      {extra ? ` ${extra}` : ""}
    </p>
  );
}
