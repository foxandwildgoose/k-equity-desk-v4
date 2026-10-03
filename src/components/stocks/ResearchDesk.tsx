import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ResearchReport, ResearchCategory } from "@/server/naver-market";
import type { SectorId } from "@/data/types";
import { RESEARCH_SECTOR_RULES } from "@/data/research-taxonomy";
import { useIndustryResearch } from "@/lib/use-market";
import { fetchResearchDeepDetail, mergeResearchDeep } from "@/lib/research-deep";
import { openOriginal } from "@/components/feed/original-link";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { matchesSearchQuery } from "@/lib/search-match";
import { reportDay, sortReportsNewestFirst } from "@/lib/feed/mappers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UsResearchDesk } from "@/components/stocks/UsResearchDesk";
import { ExternalLink, Loader2, Factory, LineChart, Globe2, Search, SlidersHorizontal } from "lucide-react";

export type DeskPack = {
  industry: ResearchReport[];
  market: ResearchReport[];
  economy: ResearchReport[];
  featured?: ResearchReport[];
};

type DeskTab = ResearchCategory | "featured";
type RangeKey = "7d" | "30d" | "90d" | "all";

const TABS: { id: DeskTab; label: string; icon: typeof Factory; blurb: string }[] = [
  { id: "industry", label: "산업", icon: Factory, blurb: "섹터별 리포트를 바로 골라 읽는 산업 리서치 터미널" },
  { id: "market", label: "시황·전략", icon: LineChart, blurb: "마켓 레이더 · 투자전략 · 수급/스타일 변화" },
  { id: "economy", label: "경제", icon: Globe2, blurb: "환율 · 금리 · 정책 · 거시경제 리서치" },
];

function RatingBadge({ rating }: { rating?: string }) {
  if (!rating) return null;
  const buy = /매수|비중확대|BUY|OUTPERFORM|OVERWEIGHT/i.test(rating);
  const sell = /매도|비중축소|SELL|UNDERPERFORM|UNDERWEIGHT/i.test(rating);
  return <span className={cn(
    "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
    buy && "bg-price-up/15 text-price-up",
    sell && "bg-price-down/15 text-price-down",
    !buy && !sell && "bg-amber-500/15 text-amber-400",
  )}>{rating}</span>;
}

function listFor(pack: DeskPack, tab: DeskTab): ResearchReport[] {
  if (tab === "industry") return pack.industry;
  if (tab === "market") return pack.market;
  if (tab === "economy") return pack.economy;
  return pack.featured ?? [];
}

function withinRange(dateText: string, range: RangeKey) {
  if (range === "all") return true;
  const day = reportDay({ date: dateText });
  if (!day) return true;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return Date.now() - Date.parse(`${day}T12:00:00Z`) <= days * 86_400_000;
}

export function ResearchDeskPanel({
  pack,
  loading,
  defaultTab = "industry",
  defaultSector,
  defaultMarket = "KR",
  onMarketChange,
  compact = false,
  showHeader = true,
}: {
  pack?: DeskPack | null;
  loading?: boolean;
  defaultTab?: DeskTab;
  defaultSector?: SectorId;
  defaultMarket?: "KR" | "US";
  onMarketChange?: (market: "KR" | "US") => void;
  compact?: boolean;
  showHeader?: boolean;
}) {
  const data: DeskPack = pack ?? { industry: [], market: [], economy: [], featured: [] };
  const [tab, setTab] = useState<DeskTab>(defaultTab);
  const [market, setMarket] = useState<"KR" | "US">(defaultMarket);
  const [sector, setSector] = useState<SectorId | "all">(defaultSector ?? "all");
  const [range, setRange] = useState<RangeKey>("30d");
  const [query, setQuery] = useState("");
  const [broker, setBroker] = useState("all");
  const [active, setActive] = useState<ResearchReport | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);

  useEffect(() => setTab(defaultTab), [defaultTab]);
  useEffect(() => setSector(defaultSector ?? "all"), [defaultSector]);
  useEffect(() => setMarket(defaultMarket), [defaultMarket]);

  function pickMarket(next: "KR" | "US") {
    setMarket(next);
    onMarketChange?.(next);
  }

  const extraQ = useIndustryResearch(
    market === "KR" && tab === "industry" && sector !== "all" ? sector : undefined,
  );

  const mergedIndustry = useMemo(() => {
    if (sector === "all" || tab !== "industry") return data.industry;
    const extra = extraQ.data?.reports ?? [];
    if (!extra.length) return data.industry;
    const seen = new Set(extra.map((r) => `${r.sourceKind}:${r.researchId}`));
    const rest = data.industry.filter((r) => !seen.has(`${r.sourceKind ?? "naver"}:${r.researchId}`));
    return [...extra, ...rest];
  }, [data.industry, extraQ.data?.reports, sector, tab]);

  const viewPack: DeskPack = {
    ...data,
    industry: mergedIndustry,
  };

  const brokers = useMemo(() => {
    return [...new Set(listFor(viewPack, tab).map((r) => r.broker).filter(Boolean))].sort();
  }, [viewPack, tab]);

  const list = useMemo(() => {
    const q = query.trim();
    const targeted = tab === "industry" && sector !== "all" && (extraQ.data?.reports?.length ?? 0) > 0;
    const filtered = sortReportsNewestFirst(listFor(viewPack, tab))
      .filter((r) => tab !== "industry" || sector === "all" || targeted || r.sectorIds.includes(sector))
      .filter((r) => broker === "all" || r.broker === broker)
      .filter((r) => withinRange(r.date, range))
      .filter((r) =>
        !q ||
        matchesSearchQuery(q, [
          r.title,
          r.summary,
          r.preview,
          r.broker,
          r.nameKo,
          r.code,
          r.categoryLabel,
          r.sourceLabel,
        ]),
      );
    return compact ? filtered.slice(0, 5) : filtered.slice(0, 80);
  }, [viewPack, tab, sector, broker, range, query, compact, extraQ.data?.reports]);

  async function openDetail(report: ResearchReport) {
    setActive(report);
    if (report.sourceKind === "hankyung" && report.pdfUrl) return;
    setDeepLoading(true);
    try {
      const deep = await fetchResearchDeepDetail(report);
      setActive((prev) =>
        prev && prev.researchId === report.researchId
          ? mergeResearchDeep(prev, deep)
          : prev,
      );
    } catch {
      /* keep shallow */
    } finally {
      setDeepLoading(false);
    }
  }

  // D2: synchronous in the click handler — opens about:blank first, then navigates.
  function openPdf(report: ResearchReport) {
    const known =
      report.sourceKind === "hankyung" ? report.pdfUrl || report.pageUrl : report.pdfUrl && /\.pdf($|\?)/i.test(report.pdfUrl) ? report.pdfUrl : null;
    setPdfLoading(!known);
    void openOriginal({
      knownUrl: known,
      fallbackUrl: report.pageUrl || "https://finance.naver.com/research/",
      resolve: async () => {
        const deep = await fetchResearchDeepDetail(report);
        const merged = mergeResearchDeep(report, deep);
        setActive((prev) => (prev && prev.researchId === report.researchId ? merged : prev));
        return merged.pdfUrl || merged.pageUrl;
      },
    }).finally(() => setPdfLoading(false));
  }

  const tabMeta = TABS.find((t) => t.id === tab);

  return (
    <section className={cn("space-y-3", showHeader && "rounded-xl border border-border bg-card p-3 md:p-4")}>
      {showHeader && <div className="flex items-start justify-between gap-2"><div><h2 className="text-sm font-semibold">리서치 데스크</h2><p className="mt-0.5 text-[11px] text-muted-foreground">한국 증권사 리포트와 미국 월가 공개 의견을 나눠 봅니다</p></div>{loading && market === "KR" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}</div>}

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {([
          ["KR", "한국 주식"],
          ["US", "미국 주식"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => pickMarket(id)}
            className={cn(
              "min-h-8 rounded-md px-2.5 py-1.5 text-[12px] font-semibold",
              market === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {market === "US" ? (
        <UsResearchDesk compact={compact} />
      ) : (
      <>

      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const count = listFor(viewPack, t.id).length;
          return <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium",
            tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}><Icon className="size-3" />{t.label}<span className="tabular opacity-70">{count}</span></button>;
        })}
      </div>

      {tabMeta && <p className="text-[11px] text-muted-foreground">{tabMeta.blurb}</p>}

      {!compact && <div className="rounded-lg border border-border bg-muted/15 p-2.5 space-y-2">
        <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><SlidersHorizontal className="size-3" /> 리서치 필터</div>
        {tab === "industry" && <div className="flex flex-wrap gap-1">
          <FilterButton active={sector === "all"} onClick={() => setSector("all")}>전체 산업</FilterButton>
          {RESEARCH_SECTOR_RULES.map((rule) => <FilterButton key={rule.sectorId} active={sector === rule.sectorId} onClick={() => setSector(rule.sectorId)}>{rule.label}</FilterButton>)}
        </div>}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목·요약·종목 검색" className="h-8 pl-8 text-xs" /></div>
          <select value={broker} onChange={(e) => setBroker(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs"><option value="all">전체 증권사</option>{brokers.map((b) => <option key={b} value={b}>{b}</option>)}</select>
          <div className="flex gap-1">{([['7d','7일'],['30d','30일'],['90d','90일'],['all','전체']] as const).map(([id,label]) => <FilterButton key={id} active={range === id} onClick={() => setRange(id)}>{label}</FilterButton>)}</div>
        </div>
      </div>}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>
          표시 {list.length}건
          {extraQ.isFetching && " · 업종 검색 중"}
          {extraQ.data && sector !== "all" && (
            <> · 네이버 업종 {extraQ.data.naverCount} · 한경 {extraQ.data.hankyungCount}</>
          )}
        </span>
        {tab === "industry" && sector !== "all" && extraQ.data && (
          <span className="flex flex-wrap gap-2">
            <a href={extraQ.data.naverUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              네이버 {extraQ.data.upjongs.join("·")} 원문
            </a>
            <a href={extraQ.data.hankyungUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              한경 컨센서스
            </a>
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {list.length === 0 ? <li className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">{loading ? "리포트 수신 중…" : "현재 필터에 맞는 리포트가 없습니다."}</li> : list.map((r) => (
          <li key={`${r.category}-${r.researchId}`} className="rounded-lg border border-border bg-card overflow-hidden">
            <button type="button" onClick={() => void openDetail(r)} className="w-full px-3 py-3 text-left hover:bg-muted/35">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">{r.categoryLabel}</Badge>
                {r.sourceLabel && (
                  <Badge className="chip-indigo border-0 text-[10px]">{r.sourceLabel}</Badge>
                )}
                <span className="text-xs font-medium">{r.broker}</span>
                <RatingBadge rating={r.rating} />
                {r.targetPrice != null && r.targetPrice > 0 && <span className="text-[10px] font-semibold tabular">TP {formatPrice(r.targetPrice)}</span>}
                {r.nameKo && r.code && <Link to="/stock/$ticker" params={{ ticker: r.code }} onClick={(e) => e.stopPropagation()} className="text-[10px] text-primary hover:underline">{r.nameKo}</Link>}
                <span className="ml-auto text-[10px] tabular text-muted-foreground">{r.date}</span>
              </div>
              <div className="mt-1 text-sm font-medium leading-snug">{r.title}</div>
              <div className="mt-2 border-l-2 border-foreground/20 pl-2.5"><div className="text-[10px] font-semibold text-muted-foreground">핵심요약</div><p className="mt-0.5 line-clamp-3 text-[12px] leading-relaxed text-foreground/95">{r.summary || r.preview || r.title}</p></div>
            </button>
            <div className="flex flex-wrap gap-2 border-t border-border bg-muted/20 px-3 py-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline min-h-8"
                onClick={() => openPdf(r)}
              >
                원문 보기 <ExternalLink className="size-3" />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground min-h-8"
                onClick={() => openPdf(r)}
              >
                PDF 열기
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground min-h-8 ml-auto"
                onClick={() => void openDetail(r)}
              >
                상세
              </button>
            </div>
          </li>
        ))}
      </ul>

      {compact && <div className="flex flex-wrap gap-1.5">{RESEARCH_SECTOR_RULES.filter((r) => ["semiconductors","battery","bio","energy","robotics"].includes(r.sectorId)).map((r) => <Link key={r.sectorId} to="/research" search={{ tab: "industry", sector: r.sectorId }} className="rounded-md border border-border px-2 py-1 text-[10px] hover:bg-muted/40">{r.label} 리포트</Link>)}</div>}

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto scroll-thin p-0">
          {active && <>
            <SheetHeader className="sticky top-0 z-10 border-b border-border bg-card">
              <SheetTitle className="pr-6 text-base leading-snug">{active.title}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-foreground">{active.broker}</span>
                  <span>{active.date}</span>
                  <RatingBadge rating={active.rating} />
                  {deepLoading && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> 원문 상세 조회
                    </span>
                  )}
                </div>
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 py-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={pdfLoading || deepLoading} onClick={() => openPdf(active)} className="gap-1.5">
                  {pdfLoading ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />} PDF / 원문
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={active.pageUrl || "https://finance.naver.com/research/"} target="_blank" rel="noopener noreferrer">
                    리서치 페이지 원문
                  </a>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-muted/25 p-3">
                  <div className="text-[10px] text-muted-foreground">투자의견</div>
                  <div className="mt-1 min-h-6">
                    {active.rating ? <RatingBadge rating={active.rating} /> : (
                      <span className="text-xs text-muted-foreground">{deepLoading ? "조회 중…" : "원문에 의견 없음/미추출"}</span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/25 p-3">
                  <div className="text-[10px] text-muted-foreground">목표주가</div>
                  <div className="mt-1 text-base font-semibold tabular min-h-7">
                    {active.targetPrice ? formatPrice(active.targetPrice) : (
                      <span className="text-xs font-normal text-muted-foreground">{deepLoading ? "조회 중…" : "—"}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <h3 className="text-[11px] font-semibold">핵심요약</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{active.summary || active.preview || active.title}</p>
              </div>
              <p className="text-[10px] text-muted-foreground">
                목록은 경량 표시, 상세·PDF·원문 클릭 시 리서치 API와 원문 페이지를 깊게 조회해 목표가·의견·PDF를 채웁니다. 투자 전 원문·공시를 교차 확인하세요.
              </p>
            </div>
          </>}
        </SheetContent>
      </Sheet>
      </>
      )}
    </section>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("rounded-md border px-2 py-1 text-[10px] font-medium", active ? "border-foreground/30 bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:text-foreground")}>{children}</button>;
}
