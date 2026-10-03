import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getKrxDisclosureDesk } from "@/lib/market-fns";
import { DisclosureList } from "@/components/stocks/DisclosureViewer";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Building2,
  Landmark,
  Radio,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/disclosures")({
  component: DisclosuresPage,
  head: () => ({
    meta: [{ title: "KRX 공시 데스크 · Korea Equity Command Center" }],
  }),
});

type Tab = "all" | "koscom" | "dart" | "kind";

function DisclosuresPage() {
  const [tab, setTab] = useState<Tab>("all");
  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } =
    useQuery({
      queryKey: ["krx-disclosure-desk"],
      queryFn: () => getKrxDisclosureDesk(),
      staleTime: 60_000,
      refetchInterval: 120_000,
    });

  const kind = data?.kind;
  const dart = data?.dart ?? [];
  const koscom = data?.koscom ?? [];

  // Server merges and sorts with the shared kernel (D1e).
  const all = data?.all ?? [];

  const list =
    tab === "koscom"
      ? koscom
      : tab === "dart"
        ? dart
        : tab === "kind"
          ? (kind?.items ?? [])
          : all;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "all", label: "통합", count: all.length },
    { id: "koscom", label: "KRX·KOSCOM", count: koscom.length },
    { id: "dart", label: "DART", count: dart.length },
    { id: "kind", label: "KIND", count: kind?.items?.length ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="desk-card desk-card-indigo p-4 md:p-5 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 size-36 rounded-full bg-desk-indigo/20 blur-2xl" />
        <div className="relative">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl flex items-center gap-2">
            <Landmark className="size-5 text-desk-indigo" />
            KRX 공시 데스크
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            한국 상장사 공시는 크게 세 갈래입니다. 증권사 단말도 동일 계통을
            사용합니다.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 text-[11px]">
            <div className="rounded-lg border border-border bg-card/60 p-2.5">
              <div className="font-semibold flex items-center gap-1">
                <Radio className="size-3 text-desk-teal" /> KRX · KOSCOM
              </div>
              <p className="text-muted-foreground mt-0.5">
                시세·시장조치 공시 (가격제한폭, 투자주의 등). 네이버 공시 API가
                KOSCOM 피드를 재배포.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-2.5">
              <div className="font-semibold flex items-center gap-1">
                <Building2 className="size-3 text-desk-indigo" /> DART (금감원)
              </div>
              <p className="text-muted-foreground mt-0.5">
                사업보고서·주요사항 등 전자공시. 원문 뷰어 직결.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-2.5">
              <div className="font-semibold flex items-center gap-1">
                <Landmark className="size-3 text-desk-gold" /> KIND (거래소)
              </div>
              <p className="text-muted-foreground mt-0.5">
                한국거래소 상장공시 포털. 금일공시·공정공시 허브.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[11px] font-medium",
                tab === t.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="ml-1 tabular text-muted-foreground">
                {t.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {dataUpdatedAt > 0 && (
            <span>
              갱신 {new Date(dataUpdatedAt).toLocaleTimeString("ko-KR")}
            </span>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted"
          >
            <RefreshCw
              className={cn("size-3", isFetching && "animate-spin")}
            />
            새로고침
          </button>
        </div>
      </div>

      {kind && (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-[12px] flex items-start gap-2",
            kind.available
              ? "border-desk-teal/40 bg-desk-teal/10"
              : "border-desk-copper/40 bg-desk-copper/10",
          )}
        >
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">
              KIND 상태: {kind.available ? "연결됨" : "대체 모드"}
            </div>
            <p className="text-muted-foreground mt-0.5">{kind.message}</p>
          </div>
          <a
            href={kind.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 text-primary hover:underline"
          >
            KIND 열기 <ExternalLink className="size-3" />
          </a>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-[11px]">
        <Badge className="chip-teal border-0">
          KRX·KOSCOM {koscom.length}
        </Badge>
        <Badge className="chip-indigo border-0">DART {dart.length}</Badge>
        <Badge className="chip-gold border-0">
          KIND {kind?.items?.length ?? 0}
        </Badge>
        <a
          href="https://dart.fss.or.kr/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-0.5"
        >
          DART 포털 <ExternalLink className="size-3" />
        </a>
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← 대시보드
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> KRX·DART 공시 수집 중…
        </div>
      )}
      {isError && (
        <p className="text-sm text-price-down">공시 데스크 조회 실패</p>
      )}

      <DisclosureList
        items={list.map((d) => ({
          id: d.id,
          title: d.title,
          datetime: d.datetime,
          author: d.author,
          code: d.code ?? "",
          nameKo: d.nameKo,
          dartUrl: d.dartUrl,
          dartSearchUrl: d.dartSearchUrl,
          canLoadBody: d.canLoadBody,
          source: d.source,
          sourceLabel: d.sourceLabel,
          rcpNo: d.rcpNo,
          market: d.market,
        }))}
        title={
          tab === "koscom"
            ? "KRX·KOSCOM 시장 공시"
            : tab === "dart"
              ? "DART 최근 전자공시"
              : tab === "kind"
                ? "KIND 금일 공시"
                : "통합 공시 피드"
        }
        subtitle={
          tab === "koscom"
            ? "커버리지 종목 기준 KRX/KOSCOM 시세·시장조치 공시"
            : tab === "dart"
              ? "금융감독원 DART 메인 최근공시 (유가·코스닥 포함)"
              : tab === "kind"
                ? "한국거래소 KIND 금일공시 (가용 시)"
                : "KOSCOM + DART + KIND 병합 · 최신순"
        }
        showStockLink
      />
    </div>
  );
}
