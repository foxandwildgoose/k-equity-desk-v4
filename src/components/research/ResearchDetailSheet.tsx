import { ExternalLink, FileText, Loader2 } from "lucide-react";
import type { ResearchReport } from "@/server/naver-market";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { buildResearchBullets } from "@/lib/research-utils";
import { targetDeltaPct } from "@/lib/research/naver-v2";
import { useResearchDetail } from "@/lib/use-research";
import { openOriginal } from "@/components/feed/original-link";
import { TimeStamp } from "@/components/feed/TimeStamp";
import { RatingBadge, reportTime } from "@/components/research/ResearchCard";

/**
 * F2.7 detail sheet: extractive bullets from the source text, rating/TP (Δ only
 * from a fetched prior same-broker report), previous/next report for the same
 * ticker (detail-page), PDF + research-page links, broker filter.
 */
export function ResearchDetailSheet({
  report,
  onClose,
  onBrokerFilter,
  onOpenReport,
}: {
  report: ResearchReport | null;
  onClose: () => void;
  onBrokerFilter?: (broker: string) => void;
  onOpenReport?: (r: ResearchReport) => void;
}) {
  const detail = useResearchDetail(report);
  const d = detail.data;
  const merged = report
    ? {
        ...report,
        rating: report.rating ?? d?.report?.rating,
        targetPrice: report.targetPrice ?? d?.report?.targetPrice,
      }
    : null;
  const bullets = merged ? buildResearchBullets(d?.bulletsText || merged.preview || merged.summary || "", merged.title) : [];
  const source = d?.summarySource ?? (merged?.preview ? "preview" : "none");
  const pdf = merged?.pdfUrl ?? d?.pdfUrl ?? null;
  const delta = merged ? targetDeltaPct(merged) : null;
  const t = merged ? reportTime(merged) : null;
  return (
    <Sheet open={!!report} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto scroll-thin p-0">
        {merged && (
          <>
            <SheetHeader className="sticky top-0 z-10 border-b border-border bg-card">
              <SheetTitle className="pr-6 text-base leading-snug">{merged.title}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-foreground">{merged.broker}</span>
                  {t && <TimeStamp publishedAt={t.publishedAt} precision={t.precision === "unknown" ? "unknown" : "day"} />}
                  <span className="text-muted-foreground">{merged.categoryLabel}</span>
                  <RatingBadge rating={merged.rating} />
                  {detail.isFetching && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> 상세 조회
                    </span>
                  )}
                </div>
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 py-4">
              <div className="flex flex-wrap gap-2">
                {pdf ? (
                  <Button asChild size="sm" className="gap-1.5">
                    <a href={pdf} target="_blank" rel="noopener noreferrer">
                      <FileText className="size-3.5" /> PDF 원문
                    </a>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      void openOriginal({
                        fallbackUrl: d?.pageUrl || merged.pageUrl,
                        resolve: async () => (await detail.refetch()).data?.pdfUrl ?? d?.pageUrl ?? merged.pageUrl,
                      })
                    }
                  >
                    <FileText className="size-3.5" /> PDF 원문
                  </Button>
                )}
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={d?.pageUrl || merged.pageUrl} target="_blank" rel="noopener noreferrer">
                    리서치 페이지 <ExternalLink className="size-3.5" />
                  </a>
                </Button>
                {onBrokerFilter && (
                  <Button size="sm" variant="ghost" onClick={() => onBrokerFilter(merged.broker)}>
                    {merged.broker}만 보기
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-muted/25 p-3">
                  <div className="text-[10px] text-muted-foreground">투자의견</div>
                  <div className="mt-1 min-h-6">{merged.rating ? <RatingBadge rating={merged.rating} /> : <span className="text-xs text-muted-foreground">— (원문에 의견 없음/미추출)</span>}</div>
                  {merged.prevRating && <div className="mt-1 text-[10px] text-muted-foreground">직전 {merged.prevRating}</div>}
                </div>
                <div className="rounded-lg border border-border bg-muted/25 p-3">
                  <div className="text-[10px] text-muted-foreground">목표주가</div>
                  <div className="mt-1 text-base font-semibold tabular">{merged.targetPrice ? formatPrice(merged.targetPrice) : "—"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {delta != null ? `직전 ${formatPrice(merged.prevTargetPrice!)} 대비 ${delta > 0 ? "+" : ""}${delta.toFixed(1)}%` : "직전 동일 증권사 리포트 미확인 → Δ 미표시"}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <h3 className="text-[11px] font-semibold">핵심 문장 (원문 발췌)</h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed">
                  {bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {source === "detail" ? "리서치 본문에서 발췌" : source === "preview" ? "증권사 미리보기에서 발췌" : "본문을 받지 못해 제목만 표시"} · 전문은 원문에서 확인하세요.
                </p>
              </div>
              {(d?.prev || d?.next) && (
                <div className="rounded-lg border border-border p-3">
                  <h3 className="text-[11px] font-semibold">같은 종목의 이전·다음 리포트</h3>
                  <ul className="mt-2 space-y-1.5 text-xs">
                    {[
                      ["이전", d?.prev],
                      ["다음", d?.next],
                    ].map(([label, r]) =>
                      r && typeof r === "object" ? (
                        <li key={String(label)} className="flex gap-2">
                          <span className="shrink-0 text-muted-foreground">{String(label)}</span>
                          <button type="button" className="min-w-0 text-left hover:underline" onClick={() => onOpenReport?.(r as ResearchReport)}>
                            {(r as ResearchReport).broker} · {(r as ResearchReport).title}
                          </button>
                        </li>
                      ) : null,
                    )}
                  </ul>
                </div>
              )}
              {d?.error && <p className="text-[11px] text-price-down">상세를 받지 못했습니다: {d.error}</p>}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
