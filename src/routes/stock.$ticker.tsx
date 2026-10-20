import { createFileRoute, Link, Navigate, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getUniverseItem } from "@/data/stocks";
import { SECTOR_BY_ID } from "@/data/sectors";
import { PriceChange, PriceValue } from "@/components/stocks/PriceChange";
import { TradingChart } from "@/components/stocks/TradingChart";
import { annotatePrevTargets } from "@/lib/research/naver-v2";
import { BrokerReports } from "@/components/stocks/BrokerReports";
import { InvestorFlow } from "@/components/stocks/InvestorFlow";
import { LiveNews } from "@/components/stocks/LiveNews";
import { OpenDartConnectionStatus } from "@/components/stocks/OpenDartStatus";
import { WatchButton } from "@/components/stocks/WatchButton";
import { TradeDeskStrip } from "@/components/stocks/TradeDeskStrip";
import { ValuationBandChart } from "@/components/stocks/ValuationBandChart";
import { Badge } from "@/components/ui/badge";
import { formatMarketCap, formatPrice, formatVolume } from "@/lib/format";
import { useStockBundle, useChartData } from "@/lib/use-market";
import { useMarketStream } from "@/lib/use-market-stream";
import {
  observedRangePosition,
  positiveObservation,
  stockQuotePresentation,
} from "@/lib/trade-metrics";
import { inferSectorId, detectKrMarket, normalizeKrTicker, isKrTicker } from "@/lib/infer-sector";
import { useChartSecurity } from "@/lib/charts/use-chart-security";
import { DATA_LABEL } from "@/data/market";
import { ChevronRight, Loader2 } from "lucide-react";
import type { ChartMarkerInput } from "@/components/charts/pro/ProChart";
import type { ResearchReport } from "@/server/naver-market";
import { researchChartEvents } from "@/lib/charts/chart-events";

export const Route = createFileRoute("/stock/$ticker")({
  component: StockPage,
  head: ({ params }) => {
    const st = getUniverseItem(params.ticker);
    return {
      meta: [
        {
          title: st ? `${st.nameKo} ${st.code} · Korea Equity` : "종목 · Korea Equity",
        },
      ],
    };
  },
});

function StockPage() {
  const { ticker } = Route.useParams();
  const code = normalizeKrTicker(ticker);
  const validStock = isKrTicker(code);
  const uni = getUniverseItem(code);
  const security = useChartSecurity(code, "KR");
  const [lastHit, setLastHit] = useState<{
    nameKo?: string;
    market?: string;
    sectorId?: string;
    isEtf?: boolean;
  } | null>(null);
  useEffect(() => {
    setLastHit(null);
    try {
      const raw = JSON.parse(sessionStorage.getItem("kx-last-security") ?? "null");
      if (raw && raw.code === code) setLastHit(raw);
    } catch {
      setLastHit(null);
    }
  }, [code]);
  const { data, isLoading, isError } = useStockBundle(code);
  const liveStatus = useMarketStream(validStock ? [code] : []);
  const quote = data && "quote" in data ? data.quote : null;
  const basic = data && "basic" in data ? data.basic : null;
  const flow = data && "flow" in data ? data.flow : null;
  const research = data && "research" in data ? data.research : [];
  const researchPack = data && "researchPack" in data ? data.researchPack : undefined;
  const news = data && "news" in data ? data.news : [];
  const disclosures = data && "disclosures" in data ? data.disclosures : [];
  const openDart = data && "disclosureMeta" in data ? data.disclosureMeta?.openDart : undefined;

  // Prefer server meta (works for tickers outside app universe)
  const serverMeta = data && "meta" in data ? data.meta : null;
  const liveName =
    serverMeta?.nameKo ??
    uni?.nameKo ??
    quote?.nameKo ??
    lastHit?.nameKo ??
    basic?.stockName ??
    code;
  const meta = {
    code,
    nameKo: liveName,
    nameEn: serverMeta?.nameEn ?? uni?.nameEn ?? quote?.nameEn ?? lastHit?.nameKo ?? code,
    sectorId: (serverMeta?.sectorId ??
      uni?.sectorId ??
      lastHit?.sectorId ??
      inferSectorId(liveName)) as import("@/data/types").SectorId,
    market: detectKrMarket(
      serverMeta?.market,
      uni?.market,
      quote?.market,
      lastHit?.market,
      basic?.stockExchangeName,
    ),
  };

  const dayChart = useChartData({
    code,
    market: meta.market,
    interval: "day",
    range: "2y",
    enabled: validStock,
  });

  if (security.data?.instrument === "etf") {
    return <Navigate to="/etfs/$code" params={{ code }} replace />;
  }
  if (!validStock && security.isLoading)
    return <p className="p-6 text-sm text-muted-foreground">종목 메타데이터 확인 중…</p>;
  if (!validStock) throw notFound();
  const sector = SECTOR_BY_ID[meta.sectorId];
  const { freshness, isLive, canDisplay } = stockQuotePresentation(quote, liveStatus.connected);
  const displayQuote = canDisplay ? quote : null;
  const price = positiveObservation(displayQuote?.price) ?? 0;
  const high52 = positiveObservation(quote?.high52) ?? positiveObservation(basic?.high52) ?? 0;
  const low52 = positiveObservation(quote?.low52) ?? positiveObservation(basic?.low52) ?? 0;
  const rangePos = observedRangePosition(price, high52, low52);
  const quoteAsOf = freshness?.asOf
    ? new Date(freshness.asOf).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    : null;

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          대시보드
        </Link>
        <ChevronRight className="size-3" />
        {sector && (
          <>
            <Link
              to="/industry/$sectorId"
              params={{ sectorId: sector.id }}
              className="hover:text-foreground"
            >
              {sector.nameKo}
            </Link>
            <ChevronRight className="size-3" />
          </>
        )}
        <span className="text-foreground font-medium">{meta.nameKo}</span>
      </nav>

      <header className="identity-grid page-header">
        <div className="flex items-start gap-2.5 min-w-0">
          <WatchButton code={meta.code} size="icon" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl lg:text-4xl leading-tight">
                {meta.nameKo}
              </h1>
              <span className="text-sm text-muted-foreground tabular font-medium">{meta.code}</span>
              {isLoading && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" /> 시세
                </span>
              )}
            </div>
            {/* 종목명 아래: 시장 · 산업 · PER */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <Badge variant="market" className="text-xs font-semibold">
                {meta.market === "KOSDAQ" ? "코스닥" : "코스피"}
              </Badge>
              {sector ? (
                <Link
                  to="/industry/$sectorId"
                  params={{ sectorId: sector.id }}
                  className="font-medium text-foreground/90 hover:underline"
                >
                  {sector.nameKo}
                </Link>
              ) : (
                <span className="text-muted-foreground">산업 —</span>
              )}
              <span className="text-muted-foreground">·</span>
              <span className="tabular font-semibold">
                PER{" "}
                <span className="text-desk-gold">
                  {basic?.per
                    ? `${basic.per}${/배$/.test(basic.per) ? "" : "배"}`
                    : basic?.perNum
                      ? `${basic.perNum.toFixed(2)}배`
                      : "—"}
                </span>
              </span>
              {basic?.pbr && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="tabular text-muted-foreground text-xs">
                    PBR {basic.pbr}
                    {/배$/.test(basic.pbr) ? "" : "배"}
                  </span>
                </>
              )}
            </div>
            {meta.nameEn && meta.nameEn !== meta.nameKo && (
              <p className="mt-1 text-xs text-muted-foreground">{meta.nameEn}</p>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">{DATA_LABEL}</p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          {displayQuote ? (
            <>
              <PriceValue value={displayQuote.price} changePct={displayQuote.changePct} size="lg" />
              <div className="mt-0.5 flex sm:justify-end">
                <PriceChange
                  change={displayQuote.change}
                  changePct={displayQuote.changePct}
                  size="md"
                />
              </div>
              {positiveObservation(displayQuote.afterHoursPrice) !== null && (
                <p className="mt-1 text-[11px] text-muted-foreground tabular">
                  시간외 {formatPrice(displayQuote.afterHoursPrice!)}
                  {displayQuote.afterHoursChangePct != null &&
                    Number.isFinite(displayQuote.afterHoursChangePct) && (
                      <>
                        {" "}
                        ({displayQuote.afterHoursChangePct >= 0 ? "+" : ""}
                        {displayQuote.afterHoursChangePct.toFixed(2)}%)
                      </>
                    )}
                </p>
              )}
              <p className="mt-1 text-[10px] text-muted-foreground">
                {freshness?.status === "stale"
                  ? "과거 관측 · 현재 시세 아님"
                  : freshness?.status === "closed"
                    ? "최근 시세"
                    : displayQuote.marketStatus || "시세"}
                {" · "}
                {isLive
                  ? "KIS·KRX 실시간"
                  : displayQuote.source === "kis-krx-websocket"
                    ? "KIS·KRX 체결 스냅샷"
                    : liveStatus.enabled && liveStatus.reconnecting
                      ? "재연결 중 · 네이버 스냅샷"
                      : "네이버 스냅샷"}
                {quoteAsOf ? ` · 기준 ${quoteAsOf} KST` : " · 관측 시각 미확인"}
              </p>
            </>
          ) : quote ? (
            <p className="text-sm text-muted-foreground">
              시세 확인 불가 · 공급자 관측 시각 또는 수치 미확인
            </p>
          ) : isError ? (
            <p className="text-sm text-price-down">시세 조회 실패</p>
          ) : (
            <p className="text-sm text-muted-foreground">시세 로딩…</p>
          )}
        </div>
      </header>

      <TradeDeskStrip
        quote={quote}
        basic={basic}
        dayBars={dayChart.data?.bars}
        liveConnected={liveStatus.connected}
        chartSource={dayChart.data?.source}
      />

      <TradingChart
        code={meta.code}
        market={meta.market}
        instrument={uni ? "stock" : security.data?.instrument}
        name={meta.nameKo}
        eventMarkers={(disclosures ?? []).map((d) => ({
          time: d.datetime?.slice(0, 10) ?? "",
          category: "disclosures" as const,
          id: d.id,
          title: d.title,
          source: d.sourceLabel ?? d.source,
          url: d.dartUrl ?? d.dartSearchUrl,
          publishedAt: d.datetime,
        }))}
        researchMarkers={researchTpMarkers(research ?? [])}
      />

      <ValuationBandChart
        code={meta.code}
        market={meta.market}
        bars={dayChart.data?.bars ?? []}
        basic={basic}
        loading={isLoading || dayChart.isLoading}
      />

      <InvestorFlow
        code={meta.code}
        days={flow?.days ?? []}
        source={flow?.source}
        loading={isLoading}
      />

      <BrokerReports
        pack={researchPack}
        companyReports={research ?? []}
        currentPrice={price}
        loading={isLoading}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 flex flex-col gap-4">
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat
              label="거래량"
              value={
                displayQuote &&
                displayQuote.volumeValid !== false &&
                Number.isFinite(displayQuote.volume) &&
                (displayQuote.volume > 0 ||
                  (displayQuote.volume === 0 && displayQuote.volumeValid === true))
                  ? formatVolume(displayQuote.volume)
                  : "—"
              }
            />
            <Stat
              label="시가총액"
              value={
                basic?.marketCapLabel ||
                (displayQuote &&
                displayQuote.marketCapValid !== false &&
                positiveObservation(displayQuote.marketCap) !== null
                  ? formatMarketCap(displayQuote.marketCap)
                  : "—")
              }
            />
            <Stat label="52주 최고" value={high52 ? formatPrice(high52) : "—"} />
            <Stat label="52주 최저" value={low52 ? formatPrice(low52) : "—"} />
          </section>

          {basic && (basic.per || basic.pbr || basic.psr || basic.foreignRate) && (
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {basic.per && (
                <Stat label="PER" value={/배$/.test(basic.per) ? basic.per : `${basic.per}배`} />
              )}
              {basic.pbr && (
                <Stat label="PBR" value={/배$/.test(basic.pbr) ? basic.pbr : `${basic.pbr}배`} />
              )}
              {basic.psr && (
                <Stat label="PSR" value={/배$/.test(basic.psr) ? basic.psr : `${basic.psr}배`} />
              )}
              {basic.foreignRate && <Stat label="외인소진율" value={basic.foreignRate} />}
            </section>
          )}

          {high52 > low52 && low52 > 0 && (
            <section className="rounded-xl border border-border bg-card p-3 md:p-4">
              <h2 className="mb-3 text-sm font-semibold">52주 범위</h2>
              <div className="flex items-center gap-3 text-xs tabular">
                <span className="text-muted-foreground w-16 shrink-0">{formatPrice(low52)}</span>
                <div className="relative h-1.5 flex-1 rounded-full bg-muted">
                  {rangePos !== null && (
                    <div
                      className="absolute top-1/2 size-3 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-background bg-foreground"
                      style={{
                        left: `${Math.min(100, Math.max(0, rangePos))}%`,
                      }}
                    />
                  )}
                </div>
                <span className="text-muted-foreground w-16 shrink-0 text-right">
                  {formatPrice(high52)}
                </span>
              </div>
              {rangePos === null && (
                <p className="mt-2 text-xs text-muted-foreground">
                  현재가 또는 범위 내 위치 미확인 — 위치 표시는 생략합니다.
                </p>
              )}
            </section>
          )}
        </div>

        <div className="lg:col-span-4">
          <OpenDartConnectionStatus status={openDart} className="mb-3" />
          <LiveNews
            news={news ?? []}
            disclosures={disclosures ?? []}
            title={`${meta.nameKo}`}
            code={meta.code}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular">{value}</div>
    </div>
  );
}

/**
 * One publication event per fetched document, plus a distinct target-change
 * event only when an older same-broker target was actually fetched.
 */
function researchTpMarkers(reports: ResearchReport[]): ChartMarkerInput[] {
  return researchChartEvents(annotatePrevTargets(reports));
}
