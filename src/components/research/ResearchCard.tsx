import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import type { ResearchReport } from "@/server/naver-market";
import { formatPrice } from "@/lib/format";
import { parseSourceTime } from "@/lib/feed/time";
import { targetDeltaPct } from "@/lib/research/naver-v2";
import { resolveResearchOriginal } from "@/lib/market-fns";
import { openOriginal } from "@/components/feed/original-link";
import { TimeStamp } from "@/components/feed/TimeStamp";
import { cn } from "@/lib/utils";
import { usePriceColors } from "@/lib/store";

export function RatingBadge({ rating }: { rating?: string }) {
  if (!rating) return null;
  const buy = /매수|비중확대|BUY|OUTPERFORM|OVERWEIGHT/i.test(rating);
  const sell = /매도|비중축소|SELL|UNDERPERFORM|UNDERWEIGHT/i.test(rating);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
        buy && "bg-price-up/15 text-price-up",
        sell && "bg-price-down/15 text-price-down",
        !buy && !sell && "bg-amber-500/15 text-amber-400",
      )}
    >
      {rating}
    </span>
  );
}

const SUMMARY_LABEL: Record<string, string> = {
  preview: "요약 출처: 증권사 미리보기 발췌",
  detail: "요약 출처: 리서치 본문 발췌",
  "pdf-text": "요약 출처: PDF 텍스트 발췌",
  none: "요약 없음 — 제목만 제공",
};

export function reportTime(r: Pick<ResearchReport, "date">) {
  const t = parseSourceTime(r.date, { zone: "Asia/Seoul" });
  return { publishedAt: t.iso, precision: t.precision };
}

/** F2.5 report card: category, broker, date (day), ticker, rating, TP, Δ% (fetched prior only), summary + source, 3 actions. */
export function ResearchCard({
  report: r,
  resolvedPdf,
  onDetail,
  observeRef,
}: {
  report: ResearchReport;
  resolvedPdf?: string | null;
  onDetail: (r: ResearchReport) => void;
  observeRef?: (el: HTMLElement | null) => void;
}) {
  const colors = usePriceColors();
  const [opening, setOpening] = useState(false);
  const t = reportTime(r);
  const pdf = r.pdfUrl && /\.pdf($|\?)/i.test(r.pdfUrl) ? r.pdfUrl : resolvedPdf ?? null;
  const delta = targetDeltaPct(r);
  const openPdf = () => {
    setOpening(true);
    void openOriginal({
      knownUrl: null,
      fallbackUrl: r.pageUrl || "https://finance.naver.com/research/",
      resolve: async () => {
        if (!r.v2Type) return r.pdfUrl || r.pageUrl;
        const res = await resolveResearchOriginal({ data: { type: r.v2Type, nid: r.researchId } });
        return res.pdfUrl ?? res.pageUrl;
      },
    }).finally(() => setOpening(false));
  };
  return (
    <li ref={observeRef} className="overflow-hidden rounded-lg border border-border bg-card" data-research-id={r.researchId} data-published={t.publishedAt ?? ""}>
      <button type="button" onClick={() => onDetail(r)} className="w-full px-3 py-2.5 text-left hover:bg-muted/35">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="rounded border border-border px-1.5 py-0.5 font-medium text-muted-foreground">{r.categoryLabel}</span>
          <span className="text-xs font-semibold">{r.broker}</span>
          {r.nameKo && r.code && (
            <Link to="/stock/$ticker" params={{ ticker: r.code }} onClick={(e) => e.stopPropagation()} className="font-medium text-primary hover:underline">
              {r.nameKo}
            </Link>
          )}
          <RatingBadge rating={r.rating} />
          {r.targetPrice != null && r.targetPrice > 0 && <span className="font-semibold tabular">TP {formatPrice(r.targetPrice)}</span>}
          {delta != null && (
            <span className={cn("font-semibold tabular", delta > 0 ? colors.up : delta < 0 ? colors.down : "text-muted-foreground")} title={`같은 증권사 직전 리포트 TP ${formatPrice(r.prevTargetPrice!)}`}>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "―"} {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          <span className="ml-auto text-muted-foreground">
            <TimeStamp publishedAt={t.publishedAt} precision={t.precision === "unknown" ? "unknown" : "day"} />
          </span>
        </div>
        <div className="mt-1 text-[13px] font-semibold leading-snug">{r.title}</div>
        {(r.summary || r.preview) && (
          <div className="mt-1.5 border-l-2 border-foreground/20 pl-2.5">
            <p className="line-clamp-3 text-[12px] leading-relaxed text-foreground/90">{r.summary || r.preview}</p>
          </div>
        )}
        <div className="mt-1 text-[9.5px] text-muted-foreground">{SUMMARY_LABEL[r.summarySource ?? (r.preview ? "preview" : "none")]}</div>
      </button>
      <div className="flex flex-wrap items-center gap-1 border-t border-border bg-muted/20 px-2 py-1">
        {pdf ? (
          <a href={pdf} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-xs font-semibold text-primary hover:underline" data-action="pdf">
            <FileText className="size-3.5" /> PDF 원문
          </a>
        ) : (
          <button type="button" onClick={openPdf} className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-xs font-semibold text-primary hover:underline" data-action="pdf">
            {opening ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />} PDF 원문
          </button>
        )}
        <a href={r.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-xs text-muted-foreground hover:text-foreground" data-action="page">
          리서치 페이지 <ExternalLink className="size-3" />
        </a>
        <button type="button" onClick={() => onDetail(r)} className="ml-auto inline-flex min-h-9 items-center rounded px-2 text-xs text-muted-foreground hover:text-foreground">
          상세
        </button>
      </div>
    </li>
  );
}
