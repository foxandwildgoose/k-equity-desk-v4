import { Link } from "@tanstack/react-router";
import type { FeedItem } from "@/lib/feed/types";
import { topicLabel } from "@/lib/feed/filters";
import { formatPct, formatPrice } from "@/lib/format";
import { usePriceColors } from "@/lib/store";
import { cn } from "@/lib/utils";

const CHIP_PREFIXES = ["stage:", "status:", "robot:"] as const;

/**
 * Theme chips derived from the item's own text (ETF stage, policy status,
 * robot topic). `stage:other` / `status:other` render as 기타 only for policy.
 */
export function ThemeChips({ item, max = 4 }: { item: Pick<FeedItem, "topics">; max?: number }) {
  const chips = item.topics.filter((t) => CHIP_PREFIXES.some((p) => t.startsWith(p)) && t !== "stage:other").slice(0, max);
  if (!chips.length) return null;
  return (
    <>
      {chips.map((t) => (
        <span
          key={t}
          className={cn(
            "rounded px-1.5 py-0.5 text-[9.5px] font-semibold",
            t.startsWith("stage:") && "bg-desk-gold/15 text-desk-gold",
            t.startsWith("status:") && "bg-desk-teal/15 text-desk-teal",
            t.startsWith("robot:") && "bg-muted text-muted-foreground",
          )}
          data-chip={t}
          title={t.startsWith("status:") ? "원문에 나온 표현으로만 표시합니다" : undefined}
        >
          {topicLabel(t)}
        </span>
      ))}
    </>
  );
}

/** Matched ETF (F5.2): code, price, 1D %, volume, market value, issuer → /etfs/$code. */
export function EtfMatchStrip({ etf }: { etf: NonNullable<FeedItem["etf"]> }) {
  const colors = usePriceColors();
  const pct = etf.changePct;
  return (
    <Link
      to="/etfs/$code"
      params={{ code: etf.code }}
      className="mt-1.5 flex min-h-8 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-border bg-muted/20 px-2 py-1 text-[10.5px] hover:bg-muted/40"
      data-etf-match={etf.code}
    >
      <span className="font-semibold text-foreground">{etf.name}</span>
      <span className="tabular text-muted-foreground">{etf.code}</span>
      <span className="tabular font-semibold">{etf.price != null ? `${formatPrice(etf.price)}원` : "—"}</span>
      <span className={cn("tabular font-semibold", pct != null && pct > 0 && colors.up, pct != null && pct < 0 && colors.down)}>
        {pct != null ? formatPct(pct) : "—"}
      </span>
      <span className="tabular text-muted-foreground">거래량 {etf.volume != null ? etf.volume.toLocaleString("ko-KR") : "—"}</span>
      <span className="tabular text-muted-foreground">시총 {etf.marketSum != null ? `${etf.marketSum.toLocaleString("ko-KR")}억` : "—"}</span>
      <span className="text-muted-foreground">{etf.issuer ?? "운용사 —"}</span>
      {etf.retirementEligible === false && <span className="rounded border border-desk-rose/40 px-1 text-[9px] text-desk-rose">파생</span>}
    </Link>
  );
}
