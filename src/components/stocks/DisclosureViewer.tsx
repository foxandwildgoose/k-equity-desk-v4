import { formatAbsoluteTime, parseSourceTime } from "@/lib/feed/time";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DisclosureItem } from "@/server/naver-market";
import { getDisclosureDetail } from "@/lib/market-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FileText, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { isDigitTicker, isEtfTicker, normalizeKrTicker } from "@/lib/infer-sector";

function fmtTime(raw: string): string {
  const t = parseSourceTime(raw, { zone: "Asia/Seoul" });
  return formatAbsoluteTime({ publishedAt: t.iso, precision: t.precision });
}

function sourceBadgeClass(source?: string): string {
  switch (source) {
    case "kind-krx":
      return "chip-gold border-0";
    case "dart-fss":
      return "chip-indigo border-0";
    case "krx-koscom":
      return "chip-teal border-0";
    default:
      return "";
  }
}

export function DisclosureList({
  items,
  title = "공시",
  subtitle,
  showStockLink = false,
}: {
  items: Array<
    DisclosureItem & {
      source?: string;
      sourceLabel?: string;
      rcpNo?: string;
      market?: string;
    }
  >;
  title?: string;
  subtitle?: string;
  showStockLink?: boolean;
}) {
  const [active, setActive] = useState<(typeof items)[number] | null>(null);

  const canBody = Boolean(active?.canLoadBody && active?.code && /^\d+$/.test(String(active.id)));

  const detailQ = useQuery({
    queryKey: ["disclosure-detail", active?.code, active?.id],
    queryFn: () =>
      getDisclosureDetail({
        data: {
          code: normalizeKrTicker(String(active!.code)),
          disclosureId: String(active!.id),
        },
      }),
    enabled: !!active && canBody && isDigitTicker(String(active?.code ?? "")),
    staleTime: 5 * 60_000,
  });

  const dartOriginal =
    detailQ.data?.dartUrl || active?.dartUrl || undefined;
  const dartSearch =
    detailQ.data?.dartSearchUrl ||
    active?.dartSearchUrl ||
    "https://dart.fss.or.kr/";

  return (
    <>
      <section className="desk-card desk-card-navy overflow-hidden">
        <div className="border-b border-border px-3 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-[11px] text-muted-foreground">
            {subtitle ??
              "KRX·KOSCOM 시세공시 / DART 전자공시 · 클릭 시 본문 또는 원문 뷰어"}
          </p>
        </div>
        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            최근 공시 없음
          </div>
        ) : (
          <ul className="divide-y divide-border max-h-[560px] overflow-y-auto scroll-thin">
            {items.map((d, i) => (
              <li key={`${d.source ?? "x"}-${d.code ?? ""}-${d.id}-${i}`}>
                <button
                  type="button"
                  onClick={() => setActive(d)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                >
                  <Badge
                    variant={d.source ? "secondary" : "disclosure"}
                    className={`mt-0.5 gap-1 shrink-0 text-[10px] ${sourceBadgeClass(d.source)}`}
                  >
                    <FileText className="size-3" />
                    {d.sourceLabel ?? "공시"}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-snug">
                      {d.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      {showStockLink && d.nameKo && d.code && (
                        isEtfTicker(d.code, d.nameKo) ? (
                          <Link
                            to="/etfs/$code"
                            params={{ code: normalizeKrTicker(d.code) }}
                            className="font-medium text-foreground hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {d.nameKo}
                          </Link>
                        ) : (
                          <Link
                            to="/stock/$ticker"
                            params={{ ticker: normalizeKrTicker(d.code) }}
                            className="font-medium text-foreground hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {d.nameKo}
                          </Link>
                        )
                      )}
                      {d.market && <span>{d.market}</span>}
                      <span>{d.author}</span>
                      <span className="tabular">{fmtTime(d.datetime)}</span>
                      {d.rcpNo && (
                        <span className="tabular text-desk-indigo">
                          rcp {d.rcpNo}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent
          side="right"
          className="w-full max-w-2xl overflow-y-auto scroll-thin p-0"
        >
          {active && (
            <>
              <SheetHeader className="sticky top-0 z-10 bg-card border-b border-border p-4">
                <SheetTitle className="pr-6 text-base leading-snug">
                  {detailQ.data?.title || active.title}
                </SheetTitle>
                <SheetDescription asChild>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-foreground">
                      {active.nameKo || active.code}
                    </span>
                    {active.sourceLabel && (
                      <Badge className={sourceBadgeClass(active.source)}>
                        {active.sourceLabel}
                      </Badge>
                    )}
                    <span className="tabular">{fmtTime(active.datetime)}</span>
                    <span>{active.author}</span>
                  </div>
                </SheetDescription>
                <div className="flex flex-wrap gap-2 pt-2">
                  {(dartOriginal || active.rcpNo) && (
                    <Button asChild size="sm" variant="default">
                      <a
                        href={
                          dartOriginal ||
                          `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${active.rcpNo}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="size-3.5" />
                        DART 원문
                      </a>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={dartSearch}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3.5" />
                      DART 검색
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a
                      href="https://kind.krx.co.kr/disclosure/todaydisclosure.do"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3.5" />
                      KIND(KRX)
                    </a>
                  </Button>
                </div>
              </SheetHeader>

              <div className="p-4 space-y-3">
                {canBody && detailQ.isLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> 본문 로딩…
                  </div>
                )}
                {canBody && detailQ.data?.text && (
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/90">
                    {detailQ.data.text}
                  </pre>
                )}
                {(!canBody || (!detailQ.isLoading && !detailQ.data?.text)) && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
                    <p>
                      {active.source === "dart-fss"
                        ? "DART 전자공시 원문은 금융감독원 뷰어에서 확인하세요."
                        : active.source === "kind-krx"
                          ? "KIND 원문은 한국거래소 KIND 포털에서 확인하세요."
                          : "본문을 인앱으로 불러올 수 없는 항목입니다. 원문 링크를 이용하세요."}
                    </p>
                    {(dartOriginal || active.rcpNo) && (
                      <a
                        className="text-primary underline"
                        href={
                          dartOriginal ||
                          `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${active.rcpNo}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        DART 뷰어 열기 →
                      </a>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
