import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { FeedItem } from "@/lib/feed/types";
import type { DisplayZone } from "@/lib/feed/time";
import { TimeStamp } from "@/components/feed/TimeStamp";
import { EtfMatchStrip, ThemeChips } from "@/components/feed/ThemeChips";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<FeedItem["kind"], string> = {
  news: "뉴스",
  research: "리서치",
  disclosure: "공시",
  filing: "SEC 공시",
  policy: "정책",
  rating: "등급",
  briefing: "브리핑",
};

export function tierDotClass(tier: 1 | 2 | 3): string {
  return tier === 1 ? "bg-desk-gold" : tier === 2 ? "bg-desk-teal" : "bg-muted-foreground/50";
}

export const TIER_LABEL: Record<1 | 2 | 3, string> = { 1: "1차 출처", 2: "주요 매체", 3: "기타·집계" };

export function SourceBadge({ item }: { item: Pick<FeedItem, "sourceName" | "sourceTier" | "outlet" | "paywalled"> }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        className={cn("size-1.5 shrink-0 rounded-full", tierDotClass(item.sourceTier))}
        title={TIER_LABEL[item.sourceTier]}
        aria-label={TIER_LABEL[item.sourceTier]}
      />
      <span className="truncate font-medium text-foreground/85">{item.outlet ? `${item.outlet}` : item.sourceName}</span>
      {item.outlet && <span className="hidden truncate text-muted-foreground sm:inline">via {item.sourceName}</span>}
      {item.paywalled && (
        <span className="shrink-0 rounded border border-desk-gold/40 px-1 text-[9px] font-semibold text-desk-gold">유료</span>
      )}
    </span>
  );
}

export function ImportanceChip({ item }: { item: Pick<FeedItem, "importance"> }) {
  const imp = item.importance;
  if (!imp || imp.tier === "normal") return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
        imp.tier === "flash" ? "bg-price-up/15 text-price-up" : "bg-amber-500/15 text-amber-500",
      )}
      title={`중요도 ${imp.score}: ${imp.reasons.join(" · ")}`}
    >
      {imp.tier === "flash" ? "FLASH" : "HIGH"} {imp.score}
    </span>
  );
}

export function TickerChips({
  tickers,
  labelFor,
  max = 4,
}: {
  tickers: FeedItem["tickers"];
  labelFor?: (t: FeedItem["tickers"][number]) => string | undefined;
  max?: number;
}) {
  if (!tickers.length) return null;
  return (
    <>
      {tickers.slice(0, max).map((t) =>
        t.market === "KR" ? (
          <Link
            key={`KR:${t.code}`}
            to="/stock/$ticker"
            params={{ ticker: t.code }}
            className="inline-flex min-h-8 items-center rounded border border-border px-1.5 text-[10px] font-medium text-primary hover:bg-muted/50 sm:min-h-0 sm:py-0.5"
            data-ticker={t.code}
          >
            {labelFor?.(t) ?? t.code}
          </Link>
        ) : (
          <Link
            key={`US:${t.code}`}
            to="/us/$symbol"
            params={{ symbol: t.code }}
            className="inline-flex min-h-8 items-center rounded border border-border px-1.5 text-[10px] font-medium text-primary hover:bg-muted/50 sm:min-h-0 sm:py-0.5"
            data-ticker={t.code}
          >
            ${t.code}
          </Link>
        ),
      )}
    </>
  );
}

/**
 * One feed row (B0.7): time, source badge (tier dot, 유료), headline linking to
 * the original in a new tab, 2-line source snippet, ticker chips, importance
 * reason chips and a cluster `+N` expander with every member's link.
 */
export function FeedRow({
  item,
  tz = "KST",
  withEt = false,
  showReasons = true,
  showKind = true,
  tierBar = false,
  labelFor,
  className,
  translation,
}: {
  item: FeedItem;
  tz?: DisplayZone;
  withEt?: boolean;
  showReasons?: boolean;
  showKind?: boolean;
  tierBar?: boolean;
  labelFor?: (t: FeedItem["tickers"][number]) => string | undefined;
  className?: string;
  /** F9.4 machine translation of an English headline. */
  translation?: string;
}) {
  const [open, setOpen] = useState(false);
  const members = item.cluster?.members ?? [];
  const reasons = item.importance?.reasons ?? [];
  const hasThemeChips = item.topics.some((t) => (t.startsWith("stage:") && t !== "stage:other") || t.startsWith("status:") || t.startsWith("robot:"));
  const tierColor =
    item.importance?.tier === "flash" ? "bg-price-up" : item.importance?.tier === "high" ? "bg-amber-500" : "bg-transparent";
  return (
    <article
      className={cn("relative flex gap-2 px-3 py-2.5", className)}
      data-feed-id={item.id}
      data-published={item.publishedAt ?? ""}
    >
      {tierBar && <span className={cn("absolute inset-y-1 left-0 w-1 rounded-r", tierColor)} aria-hidden />}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
          <TimeStamp publishedAt={item.publishedAt} precision={item.precision} tz={tz} withEt={withEt} className="font-medium text-foreground/80" />
          <SourceBadge item={item} />
          {showKind && item.kind !== "news" && (
            <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground">
              {KIND_LABEL[item.kind]}
            </span>
          )}
          <ImportanceChip item={item} />
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-1 flex min-h-8 items-start gap-1 text-[13px] font-semibold leading-snug text-foreground hover:underline sm:min-h-0"
          lang={item.lang}
        >
          <span className="min-w-0 break-words">{item.title}</span>
          <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-40 group-hover:opacity-80" aria-hidden />
          <span className="sr-only">원문 (새 창)</span>
        </a>
        {translation && (
          <p className="mt-0.5 text-[12px] leading-snug text-foreground/85" lang="ko" data-translation>
            <span className="mr-1 rounded bg-muted px-1 text-[9px] font-semibold text-muted-foreground">기계 번역</span>
            {translation}
          </p>
        )}
        {item.snippet && !item.paywalled && (
          <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">{item.snippet}</p>
        )}
        {item.etf && <EtfMatchStrip etf={item.etf} />}
        {(item.tickers.length > 0 || (showReasons && reasons.length > 0) || members.length > 0 || hasThemeChips) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <ThemeChips item={item} />
            <TickerChips tickers={item.tickers} labelFor={labelFor} />
            {showReasons &&
              item.importance &&
              item.importance.tier !== "normal" &&
              reasons.slice(0, 4).map((r) => (
                <span key={r} className="rounded bg-muted/70 px-1.5 py-0.5 text-[9.5px] text-muted-foreground">
                  {r}
                </span>
              ))}
            {members.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="inline-flex min-h-8 items-center gap-0.5 rounded border border-border px-1.5 text-[10px] font-semibold text-foreground/80 hover:bg-muted/50 sm:min-h-0 sm:py-0.5"
                title={item.cluster?.sources.join(" · ")}
              >
                +{members.length} 매체
                <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
              </button>
            )}
          </div>
        )}
        {open && members.length > 0 && (
          <ul className="mt-1.5 space-y-1 border-l-2 border-border pl-2">
            {members.map((m) => (
              <li key={m.id} className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[11px]">
                <TimeStamp publishedAt={m.publishedAt} precision={m.precision} tz={tz} className="text-[10px] text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{m.sourceName}</span>
                {m.paywalled && <span className="text-[9px] font-semibold text-desk-gold">유료</span>}
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words text-foreground/90 hover:underline">
                  {m.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
