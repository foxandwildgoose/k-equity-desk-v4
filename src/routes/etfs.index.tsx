import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useEtfMarket } from "@/lib/use-market";
import { EtfNewsDesk } from "@/components/etf/EtfNewsDesk";
import { ETF_BUCKET_HINT, ETF_BUCKET_LABEL, type EtfMarketBucket } from "@/data/etfs";
import { formatIsoDate, formatPct, formatPrice } from "@/lib/format";
import { usePriceColors } from "@/lib/store";
import { cn } from "@/lib/utils";
import { matchesSearchQuery, rankByQuery } from "@/lib/search-match";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Toolbar } from "@/components/layout/DeskLayout";
import {
  Loader2,
  Layers,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Search,
  AlertTriangle,
  Newspaper,
} from "lucide-react";

export const Route = createFileRoute("/etfs/")({
  component: EtfIndexPage,
  head: () => ({
    meta: [{ title: "ETF 데스크 · Korea Equity Command Center" }],
  }),
});

const BUCKETS: EtfMarketBucket[] = [
  "retirement",
  "new",
  "all",
  "theme",
  "us",
  "bond",
];

type DeskTab = EtfMarketBucket | "etf-news";
type SortKey = "default" | "listed-new" | "price-low" | "volume-high" | "market-sum-high";

function EtfIndexPage() {
  const [tab, setTab] = useState<DeskTab>("retirement");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [sort, setSort] = useState<SortKey>("default");
  const colors = usePriceColors();
  const isNews = tab === "etf-news";
  const bucket: EtfMarketBucket = isNews ? "new" : tab;
  const isNew = tab === "new";

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (tab !== "new" && sort === "listed-new") setSort("default");
    if (tab === "new" && sort === "default") setSort("listed-new");
  }, [tab, sort]);

  const { data, isLoading, isError, isFetching } = useEtfMarket({
    bucket,
    q: isNews ? "" : qDebounced,
    limit: bucket === "all" ? 200 : 150,
    enabled: !isNews,
  });

  const etfs = useMemo(() => {
    const raw = data?.etfs ?? [];
    const needle = q.trim();
    let rows = raw;
    if (needle) {
      const hits = raw.filter((e) =>
        matchesSearchQuery(needle, [e.nameKo, e.code, e.tabLabel, e.issuer]),
      );
      rows = rankByQuery(hits, needle, (e) => ({ name: e.nameKo, code: e.code }));
    }
    if (sort === "listed-new") {
      return [...rows].sort((a, b) => {
        const da = a.listedAt ? formatIsoDate(a.listedAt) : "";
        const db = b.listedAt ? formatIsoDate(b.listedAt) : "";
        if (da && db && da !== db) return db.localeCompare(da);
        if (da && !db) return -1;
        if (!da && db) return 1;
        const xa = a.daysListed ?? 9999;
        const xb = b.daysListed ?? 9999;
        return xa - xb;
      });
    }
    if (sort === "price-low") {
      return [...rows].sort((a, b) => {
        const pa = a.price > 0 ? a.price : Number.POSITIVE_INFINITY;
        const pb = b.price > 0 ? b.price : Number.POSITIVE_INFINITY;
        if (pa !== pb) return pa - pb;
        return a.nameKo.localeCompare(b.nameKo, "ko");
      });
    }
    if (sort === "volume-high") {
      return [...rows].sort((a, b) => {
        const va = a.volume > 0 ? a.volume : Number.NEGATIVE_INFINITY;
        const vb = b.volume > 0 ? b.volume : Number.NEGATIVE_INFINITY;
        if (va !== vb) return vb - va;
        return a.nameKo.localeCompare(b.nameKo, "ko");
      });
    }
    if (sort === "market-sum-high") {
      return [...rows].sort((a, b) => {
        const ma = a.marketSum > 0 ? a.marketSum : Number.NEGATIVE_INFINITY;
        const mb = b.marketSum > 0 ? b.marketSum : Number.NEGATIVE_INFINITY;
        if (ma !== mb) return mb - ma;
        return a.nameKo.localeCompare(b.nameKo, "ko");
      });
    }
    return rows;
  }, [data?.etfs, q, sort]);

  const stats = data?.stats;

  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="desk-kicker mb-1.5">Retirement & listed ETF</p>
        <h1 className="page-title flex items-center gap-2">
          <Layers className="size-7 text-desk-gold" />
          ETF 데스크
        </h1>
        <p className="page-lead">
          한국거래소 상장 ETF. ETF 뉴스 탭은 신규 상장·상장 예정·상장폐지·자금 흐름·퇴직연금
          기사를 최신순으로 모으고, 기사 속 ETF를 실시간 목록과 맞춰 보여줍니다.
        </p>
        {stats && !isNews && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip-gold px-2 py-1">
              전체 {stats.total.toLocaleString()}
            </span>
            <span className="chip-teal px-2 py-1">
              퇴직연금 후보 {stats.retirementEligible.toLocaleString()}
            </span>
            <span className="chip-copper px-2 py-1">
              파생 제외 {stats.leverageExcluded.toLocaleString()}
            </span>
            <span className="chip-indigo px-2 py-1">
              신규 후보 {stats.newCandidates.toLocaleString()}
            </span>
          </div>
        )}
      </header>

      <Toolbar>
        <div className="seg-tabs">
          <button
            type="button"
            onClick={() => setTab("retirement")}
            className={cn("seg-tab", tab === "retirement" ? "seg-tab-on" : "")}
          >
            <ShieldCheck className="size-3 text-desk-teal" />
            퇴직연금 가능
          </button>
          <button
            type="button"
            onClick={() => setTab("new")}
            className={cn("seg-tab", tab === "new" ? "seg-tab-on" : "")}
          >
            <Sparkles className="size-3 text-desk-gold" />
            신규 상장
          </button>
          <button
            type="button"
            onClick={() => setTab("etf-news")}
            className={cn("seg-tab", isNews ? "seg-tab-on" : "")}
            data-testid="etf-news-tab"
          >
            <Newspaper className="size-3 text-desk-gold" />
            ETF 뉴스
          </button>
          {(["all", "theme", "us", "bond"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setTab(b)}
              className={cn("seg-tab", tab === b ? "seg-tab-on" : "")}
            >
              {ETF_BUCKET_LABEL[b]}
            </button>
          ))}
        </div>
        {!isNews && (
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="방산소부장 · AI데이터센터 · 바이오…"
            className="h-10 pl-9 text-sm"
          />
          {q.trim() && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              “{q.trim()}” 검색 {etfs.length}건
            </p>
          )}
        </div>
        )}
        {!isNews && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground mr-1">정렬</span>
            {isNew ? (
              <button
                type="button"
                onClick={() => setSort("listed-new")}
                className={cn("seg-tab text-[11px]", sort === "listed-new" && "seg-tab-on")}
              >
                상장일 최신순
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSort("default")}
                className={cn("seg-tab text-[11px]", sort === "default" && "seg-tab-on")}
              >
                기본
              </button>
            )}
            <button
              type="button"
              onClick={() => setSort("price-low")}
              className={cn("seg-tab text-[11px]", sort === "price-low" && "seg-tab-on")}
            >
              현재가 낮은순
            </button>
            <button
              type="button"
              onClick={() => setSort("volume-high")}
              className={cn("seg-tab text-[11px]", sort === "volume-high" && "seg-tab-on")}
            >
              거래량 많은순
            </button>
            <button
              type="button"
              onClick={() => setSort("market-sum-high")}
              className={cn("seg-tab text-[11px]", sort === "market-sum-high" && "seg-tab-on")}
            >
              시총(억) 높은순
            </button>
          </div>
        )}
      </Toolbar>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-desk-copper" />
        {isNews
          ? "국내 언론의 ETF 기사입니다. 제목을 누르면 원문이 새 창에서 열립니다."
          : (data?.note ?? ETF_BUCKET_HINT[bucket])}
      </p>

      {isNews ? (
        <EtfNewsDesk embedded />
      ) : (
        <>
          {(isLoading || isFetching) && etfs.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> ETF 목록 로딩…
            </div>
          )}
          {isError && (
            <p className="text-sm text-price-down">ETF 목록 조회 실패</p>
          )}

          <div className="desk-card desk-card-navy overflow-hidden">
            <div className="overflow-x-auto scroll-thin">
              <table className="desk-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>ETF</th>
                    <th>유형</th>
                    {isNew && <th className="text-right">상장일</th>}
                    <th className="text-right">현재가</th>
                    <th className="text-right">등락률</th>
                    {!isNew && <th className="text-right">3M</th>}
                    <th className="text-right">거래량</th>
                    <th className="text-right">시총(억)</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {etfs.length === 0 && q.trim() && !isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        “{q.trim()}”에 해당하는 ETF가 없습니다. 종목명·코드·테마 키워드로 다시 검색하세요.
                      </td>
                    </tr>
                  ) : null}
                  {etfs.map((e) => {
                    const up = e.changePct > 0;
                    const down = e.changePct < 0;
                    return (
                      <tr key={e.code} className="hover:bg-muted/25">
                        <td className="px-3 py-2.5">
                          <Link
                            to="/etfs/$code"
                            params={{ code: e.code }}
                            className="font-medium hover:underline"
                          >
                            {e.nameKo}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="tabular">{e.code}</span>
                            {e.isNewCandidate && (
                              <Badge className="chip-gold border-0 text-[9px] h-4">
                                NEW
                              </Badge>
                            )}
                            {!e.retirementEligible && (
                              <Badge variant="outline" className="text-[9px] h-4 text-desk-rose">
                                파생
                              </Badge>
                            )}
                            {e.daysListed != null && e.daysListed <= 90 && (
                              <span className="text-desk-teal">
                                상장 {e.daysListed}일
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-muted-foreground">
                          {e.tabLabel}
                        </td>
                        {isNew && (
                          <td className="px-3 py-2.5 text-right tabular text-xs font-semibold">
                            {formatIsoDate(e.listedAt)}
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-right tabular font-semibold">
                          {e.price ? formatPrice(e.price) : "—"}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2.5 text-right tabular text-xs font-semibold",
                            up ? colors.up : down ? colors.down : "text-muted-foreground",
                          )}
                        >
                          {formatPct(e.changePct)}
                        </td>
                        {!isNew && (
                          <td className="px-3 py-2.5 text-right tabular text-xs text-muted-foreground">
                            {e.threeMonthEarnRate == null
                              ? "—"
                              : formatPct(e.threeMonthEarnRate)}
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-right tabular text-xs text-muted-foreground">
                          {e.volume ? e.volume.toLocaleString("ko-KR") : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular text-xs text-muted-foreground">
                          {e.marketSum ? e.marketSum.toLocaleString("ko-KR") : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Link
                            to="/etfs/$code"
                            params={{ code: e.code }}
                            className="inline-flex items-center text-[11px] text-primary hover:underline"
                          >
                            상세 <ChevronRight className="size-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {etfs.length === 0 && !isLoading && (
              <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                조건에 맞는 ETF가 없습니다. 검색어나 탭을 바꿔 보세요.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
