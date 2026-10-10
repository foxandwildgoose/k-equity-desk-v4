import { createFileRoute, Link, Navigate, notFound } from "@tanstack/react-router";
import { useEtfBundle } from "@/lib/use-market";
import { TradingChart } from "@/components/stocks/TradingChart";
import { normalizeKrTicker, isKrTicker } from "@/lib/infer-sector";
import { useChartSecurity } from "@/lib/charts/use-chart-security";
import { yahooUsSymbol } from "@/lib/valuation-series";
import {
  formatHoldingPrice,
  formatPct,
  formatPrice,
  formatQty,
  formatVolume,
  formatWeight,
} from "@/lib/format";
import { usePriceColors } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReadableProse } from "@/components/ui/ReadableProse";
import { SourceLinks } from "@/components/ui/SourceLinks";
import {
  ChevronRight,
  Loader2,
  Layers,
  ArrowUpRight,
  Info,
  ShieldCheck,
  Sparkles,
  Globe2,
  Link2,
  Landmark,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/etfs/$code")({
  component: EtfDetailPage,
  head: ({ params }) => ({
    meta: [{ title: `${params.code} · ETF · Korea Equity` }],
  }),
});

const SLEEVE_TONE: Record<string, string> = {
  "kr-equity": "bg-desk-teal",
  "us-equity": "bg-desk-indigo",
  "overseas-equity": "bg-desk-indigo/70",
  "kr-etf": "bg-desk-navy",
  bond: "bg-desk-gold",
  future: "bg-desk-copper",
  cash: "bg-muted-foreground/50",
  other: "bg-desk-slate",
};

const CLASS_CHIP: Record<string, string> = {
  "kr-equity": "chip-teal",
  "us-equity": "chip-indigo",
  "overseas-equity": "chip-indigo",
  "kr-etf": "chip-blue",
  bond: "chip-gold",
  future: "chip-copper",
  cash: "bg-muted text-muted-foreground",
  other: "bg-muted text-muted-foreground",
};

function EtfDetailPage() {
  const { code } = Route.useParams();
  const normalized = normalizeKrTicker(code);
  const security = useChartSecurity(normalized, "KR");
  const { data, isLoading, isError } = useEtfBundle(code);
  const colors = usePriceColors();

  if (!isKrTicker(normalized)) throw notFound();
  if (security.data?.instrument === "stock") {
    return <Navigate to="/stock/$ticker" params={{ ticker: normalized }} replace />;
  }
  if (data && "error" in data) throw notFound();

  const etf = data && "etf" in data ? data.etf : null;
  const quoteAvailable = etf?.quoteAvailable !== false;
  const holdingsRaw = data && "holdings" in data ? data.holdings : [];
  const holdings = [...holdingsRaw].sort((a, b) => {
    const aw = a.weightSource === "official" ? a.weight : null;
    const bw = b.weightSource === "official" ? b.weight : null;
    if (aw == null && bw == null) return Math.abs(b.quantity ?? 0) - Math.abs(a.quantity ?? 0);
    if (aw == null) return 1;
    if (bw == null) return -1;
    if (bw !== aw) return bw - aw;
    return Math.abs(b.quantity ?? 0) - Math.abs(a.quantity ?? 0);
  });
  const themeStocks = data && "themeStocks" in data ? data.themeStocks : [];
  const peers = data && "peerEtfs" in data ? data.peerEtfs : [];
  const asOf = data && "holdingsAsOf" in data ? data.holdingsAsOf : null;
  const krCount = data && "krEquityCount" in data ? data.krEquityCount : 0;
  const allocation =
    data && "allocation" in data ? data.allocation : [];
  const officialWeightSum =
    data && "officialWeightSum" in data ? data.officialWeightSum : null;
  const officialCount =
    data && "officialCount" in data ? data.officialCount : 0;
  const weightBasis =
    data && "weightBasis" in data ? data.weightBasis : officialCount > 0 ? "official" : "none";
  const hasOfficialWeights = weightBasis === "official" && officialCount > 0;
  const holdingsSource =
    data && "holdingsSource" in data ? data.holdingsSource : null;
  const isUploadedSnapshot =
    data && "holdingsSourceKind" in data && data.holdingsSourceKind === "issuer-file";
  const quotedCount =
    data && "quotedCount" in data ? data.quotedCount : 0;
  const fmt =
    data && "descriptionFormatted" in data
      ? data.descriptionFormatted
      : {
          paragraphs: [] as string[],
          summary: "",
          bullets: [] as string[],
          plain: "",
        };
  const themeLabels =
    data && "themeLabels" in data ? data.themeLabels : [];

  const quoted = holdings.filter((h) => h.quote && h.quote.price > 0);
  const adv = quoted.filter((h) => (h.quote?.changePct ?? 0) > 0).length;
  const dec = quoted.filter((h) => (h.quote?.changePct ?? 0) < 0).length;
  const barBase = allocation
    .filter((s) => s.weight > 0)
    .reduce((s, a) => s + a.weight, 0);
  const maxOfficialWeight = Math.max(
    1,
    ...holdings.map((h) => h.weightSource === "official" ? h.weight ?? 0 : 0),
  );
  const naverItemUrl = `https://finance.naver.com/item/main.naver?code=${(etf?.code ?? code).toUpperCase()}`;
  const issuerProductUrl =
    data && "issuerProductUrl" in data && typeof data.issuerProductUrl === "string"
      ? data.issuerProductUrl
      : null;
  const issuerUrl =
    data && "holdingsIssuerUrl" in data && typeof data.holdingsIssuerUrl === "string"
      ? data.holdingsIssuerUrl
      : null;
  const officialSourceUrl = issuerUrl ?? issuerProductUrl;

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/etfs" className="hover:text-foreground">
          ETF
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground font-medium">
          {etf?.nameKo ?? code.toUpperCase()}
        </span>
      </nav>

      <header className="page-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="desk-kicker">Exchange Traded Fund</p>
            <div className="flex flex-wrap items-center gap-2">
              <Layers className="size-6 text-desk-gold" />
              <h1 className="page-title">
                {isLoading && !etf ? "로딩…" : etf?.nameKo ?? code}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="tabular text-muted-foreground font-medium">
                {etf?.code ?? code.toUpperCase()}
              </span>
              {etf?.retirementEligible ? (
                <Badge className="chip-teal border-0 gap-1 text-xs">
                  <ShieldCheck className="size-3.5" /> 퇴직연금 후보(추정·미확정)
                </Badge>
              ) : etf ? (
                <Badge
                  variant="outline"
                  className="text-desk-rose border-desk-rose/40 text-xs"
                >
                  파생·제외 가능
                </Badge>
              ) : null}
              {etf?.isNewCandidate && (
                <Badge className="chip-gold border-0 gap-1 text-xs">
                  <Sparkles className="size-3.5" /> 신규
                </Badge>
              )}
              {officialCount > 0 && (
                <Badge className="chip-teal border-0 gap-1 text-xs">
                  <Landmark className="size-3.5" /> 공식 비중 {officialCount}종
                </Badge>
              )}
              {themeLabels.map((label) => (
                <Badge key={label} className="chip-indigo border-0 text-xs">
                  {label}
                </Badge>
              ))}
            </div>
            <p className="text-base text-muted-foreground leading-relaxed">
              {data && "issuer" in data && data.issuer
                ? data.issuer
                : etf?.issuer ?? "운용사 확인 중"}
              {etf?.tabLabel ? ` · ${etf.tabLabel}` : ""}
              {data && "fee" in data && data.fee != null
                ? ` · 총보수 ${data.fee}%`
                : ""}
              {data && "marketValue" in data && data.marketValue
                ? ` · 시총 ${data.marketValue}`
                : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {issuerProductUrl ? (
                <Button asChild size="lg" className="gap-2">
                  <a href={issuerProductUrl} target="_blank" rel="noopener noreferrer">
                    <Landmark className="size-4" />
                    운용사 상품 페이지
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              ) : (
                <>
                  <Button size="lg" variant="outline" disabled>
                    <Landmark className="size-4" />
                    운용사 상품 페이지
                  </Button>
                  <span className="text-sm text-muted-foreground" role="status">
                    {isLoading ? "상품 상세 링크 확인 중" : "상품 상세 링크 확인 불가"}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="shrink-0 rounded-xl border border-border bg-card/70 px-5 py-4 lg:min-w-[200px] lg:text-right">
            {isLoading && !etf ? (
              <span className="inline-flex items-center gap-1.5 text-base text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> 시세
              </span>
            ) : etf && !quoteAvailable ? (
              <>
                <div className="text-3xl font-semibold tabular tracking-tight">—</div>
                <div className="mt-1 text-base text-muted-foreground">시세 확인 불가</div>
                <div className="mt-2 text-sm text-muted-foreground">시장가 · 등락률 · 거래량 미확인</div>
              </>
            ) : etf ? (
              <>
                <div className="text-3xl font-semibold tabular tracking-tight">
                  {formatPrice(etf.price)}
                </div>
                <div
                  className={cn(
                    "mt-1 text-base font-semibold tabular",
                    etf.changePct > 0
                      ? colors.up
                      : etf.changePct < 0
                        ? colors.down
                        : "text-muted-foreground",
                  )}
                >
                  {etf.changePct > 0 ? "+" : ""}
                  {formatPrice(etf.change)} ({formatPct(etf.changePct)})
                </div>
                <div className="mt-2 text-sm text-muted-foreground tabular">
                  거래량 {etf.volume.toLocaleString("ko-KR")}
                  {etf.nav ? ` · NAV ${formatPrice(etf.nav)}` : ""}
                </div>
              </>
            ) : isError ? (
              <span className="text-base text-price-down">시세 실패</span>
            ) : (
              <span className="text-base text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </header>

      {isKrTicker(etf?.code ?? code) ? (
        <section className="flex flex-col gap-2">
          {etf && quoteAvailable && etf.nav > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                시장가{" "}
                <span className="font-semibold tabular text-foreground">
                  {formatPrice(etf.price)}
                </span>
              </span>
              <span>
                NAV{" "}
                <span className="font-semibold tabular text-foreground">
                  {formatPrice(etf.nav)}
                </span>
              </span>
              {etf.nav > 0 && (
                <span>
                  괴리율{" "}
                  <span
                    className={cn(
                      "font-semibold tabular",
                      ((etf.price - etf.nav) / etf.nav) * 100 > 0
                        ? colors.up
                        : ((etf.price - etf.nav) / etf.nav) * 100 < 0
                          ? colors.down
                          : "text-foreground",
                    )}
                  >
                    {formatPct(((etf.price - etf.nav) / etf.nav) * 100)}
                  </span>
                </span>
              )}
              <span className="text-xs">
                주식 차트와 동일 · 고점 대비 하락 · 저점 대비 상승 · 52주 · 백분위 밴드 · 이격도 · 스토캐스틱
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              주식 차트와 동일 · 고점 대비 하락 · 저점 대비 상승 · 52주 · 백분위 밴드 · 이격도 · 스토캐스틱
            </p>
          )}
          <TradingChart
            code={normalizeKrTicker(etf?.code ?? code)}
            market={security.data?.exchange === "KOSDAQ" ? "KOSDAQ" : "KOSPI"}
            instrument="etf"
            name={etf?.nameKo}
          />
        </section>
      ) : null}

      {(fmt.paragraphs.length > 0 || fmt.bullets.length > 0) && (
        <ReadableProse
          doc={fmt}
          title="상품 설명"
          className="desk-card desk-card-navy border-0 shadow-none ring-1 ring-border"
          collapsedParagraphs={2}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="desk-card desk-card-teal p-4">
          <div className="text-sm text-muted-foreground">편입 종목</div>
          <div className="mt-1 text-xl font-semibold tabular">
            {holdings.length || "—"}
          </div>
          <div className="text-sm text-muted-foreground">
            국내주식 {krCount}
            {allocation.find((s) => s.id === "us-equity")
              ? ` · 미국 ${allocation.find((s) => s.id === "us-equity")!.weight.toFixed(1)}%`
              : ""}
            {allocation.find((s) => s.id === "bond")
              ? ` · 채권 ${allocation.find((s) => s.id === "bond")!.weight.toFixed(1)}%`
              : ""}
            {" · "}
            기준 {asOf ?? "—"}
          </div>
        </div>
        <div className="desk-card desk-card-gold p-4">
          <div className="text-sm text-muted-foreground">
            운용사 공식 비중 합계
          </div>
          <div className="mt-1 text-xl font-semibold tabular">
            {officialWeightSum != null && hasOfficialWeights
              ? formatWeight(officialWeightSum)
              : "—"}
          </div>
          <div className="text-sm text-muted-foreground">
            {!data
              ? "비중 확인 중"
              : hasOfficialWeights
                ? `공식 NAV 비중 ${officialCount}/${holdings.length || 0}종 · 공시 비중 순`
                : "운용사 공식 비중 확인 불가 · 비중 미표시"}
          </div>
        </div>
        <div className="desk-card desk-card-indigo p-4">
          <div className="text-sm text-muted-foreground">실시간 시세</div>
          <div className="mt-1 text-xl font-semibold tabular">
            {quotedCount ? `${adv}↑ / ${dec}↓` : "—"}
          </div>
          <div className="text-sm text-muted-foreground">
            시세 반영 {quotedCount}종 · 테마 {themeLabels.length ? themeLabels.join(" · ") : "일반"}
          </div>
        </div>
      </div>

      {hasOfficialWeights && allocation.length > 0 && (
        <section className="desk-card desk-card-navy p-4 md:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
            <h2 className="text-base font-semibold">자산군 공식 비중</h2>
            <p className="text-xs text-muted-foreground">
              NAV 대비 운용사 공시 비중을 자산군별로 합산
            </p>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {allocation
              .filter((s) => s.weight > 0)
              .map((s) => (
                <div
                  key={s.id}
                  className={cn(SLEEVE_TONE[s.id] ?? "bg-muted-foreground", "h-full")}
                  style={{ width: `${barBase > 0 ? (s.weight / barBase) * 100 : 0}%` }}
                  title={`${s.label} ${s.weight.toFixed(2)}%`}
                />
              ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {allocation.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2 py-1 text-xs"
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    SLEEVE_TONE[s.id] ?? "bg-muted-foreground",
                  )}
                />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="tabular font-semibold">{formatWeight(s.weight)}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="desk-card desk-card-teal overflow-hidden">
        <div className="border-b border-border px-4 py-3.5">
          <h2 className="text-lg font-semibold">편입 종목 · 운용사 공식 비중</h2>
          <p className="text-sm text-muted-foreground flex items-start gap-1.5 mt-1">
            <Info className="size-4 shrink-0 mt-0.5" />
            {hasOfficialWeights
              ? "비중은 운용사가 공시한 기준일의 NAV 대비 비중입니다. 현재가는 별도 시세이며 비중 계산에 사용하지 않습니다."
              : isLoading
                ? "운용사 공식 구성내역과 비중을 확인하고 있습니다."
                : "운용사 공식 비중을 확인하지 못했습니다. 비중은 — 로 표시하며 현재가나 편입 수량으로 추정하지 않습니다."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            편입내역 출처: {holdingsSource ?? (isLoading ? "확인 중" : "확인 불가")}
            {" · "}공시 기준일: {asOf ?? (isLoading ? "확인 중" : "미확인")}
          </p>
          {isUploadedSnapshot && (
            <p className="mt-2 text-sm text-desk-gold">
              첨부 자료의 {asOf ?? "미확인 기준일"} 공시 비중입니다. 운용사의 최신 구성내역을 실시간으로 확인하지 못해 과거 자료를 표시합니다.
            </p>
          )}
          <SourceLinks
            className="mt-2"
            size="sm"
            primaryUrl={officialSourceUrl}
            primaryLabel={issuerUrl ? "운용사 공식 구성내역" : "운용사 상품 페이지"}
            more={[
              ...(issuerProductUrl && issuerUrl && issuerProductUrl !== issuerUrl
                ? [{ label: "운용사 상품 페이지", url: issuerProductUrl }]
                : []),
              { label: "네이버 구성종목 참고", url: naverItemUrl },
            ]}
          />
        </div>

        {isLoading && holdings.length === 0 ? (
          <div className="px-4 py-12 text-center text-base text-muted-foreground">
            <Loader2 className="size-5 animate-spin inline mr-2" />
            공식 편입·시세 로딩…
          </div>
        ) : holdings.length === 0 && themeStocks.length === 0 ? (
          <div className="px-4 py-12 text-center text-base text-muted-foreground">
            운용사 공식 편입 내역을 확인하지 못했습니다.
          </div>
        ) : holdings.length > 0 ? (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[820px] text-base">
              <thead className="bg-muted/40 text-sm text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">공식 NAV 비중</th>
                  <th className="px-4 py-3 font-medium">구분</th>
                  <th className="px-4 py-3 font-medium">종목</th>
                  <th className="px-4 py-3 font-medium text-right">현재가</th>
                  <th className="px-4 py-3 font-medium text-right">등락률</th>
                  <th className="px-4 py-3 font-medium text-right">수량</th>
                  <th className="px-4 py-3 font-medium text-right">거래량</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {holdings.map((row, idx) => {
                  const q = row.quote;
                  const pct = q?.changePct ?? 0;
                  const krStock = Boolean(row.code && row.isKoreanEquity);
                  const krEtf = Boolean(row.code && row.isKoreanEtf);
                  const usSymbol =
                    row.isOverseas && row.reutersCode ? yahooUsSymbol(row.reutersCode) : null;
                  const usLink =
                    !usSymbol && row.isOverseas && row.reutersCode
                      ? `https://m.stock.naver.com/worldstock/stock/${row.reutersCode}/total`
                      : null;
                  const cls =
                    "assetClass" in row && row.assetClass
                      ? String(row.assetClass)
                      : row.isCash
                        ? "cash"
                        : row.isOverseas
                          ? "us-equity"
                          : "other";
                  const clsLabel =
                    cls === "kr-equity"
                      ? "국내주식"
                      : cls === "kr-etf"
                        ? "국내ETF"
                        : cls === "us-equity"
                          ? "미국주식"
                          : cls === "overseas-equity"
                            ? "해외주식"
                            : cls === "bond"
                              ? "채권"
                              : cls === "future"
                                ? "선물"
                                : cls === "cash"
                                  ? "현금"
                                  : "기타";
                  const w = hasOfficialWeights && row.weightSource === "official" ? row.weight : null;
                  return (
                    <tr
                      key={`${row.nameKo}-${idx}`}
                      className="hover:bg-muted/25"
                    >
                      <td className="px-4 py-3 tabular">
                        {w != null ? (
                          <div className="min-w-[88px]">
                            <div
                              className={cn(
                                "font-semibold",
                                w < 0 ? "text-desk-rose" : "text-foreground",
                              )}
                            >
                              {formatWeight(w)}
                            </div>
                            {w > 0 && barBase > 0 && (
                              <div className="mt-1 h-1 w-full rounded bg-muted">
                                <div
                                  className="h-1 rounded bg-desk-teal/80"
                                  style={{
                                    width: `${Math.min(100, (w / maxOfficialWeight) * 100)}%`,
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground" title="운용사 공식 비중 미확인">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium border-0",
                            CLASS_CHIP[cls] ?? "bg-muted",
                          )}
                        >
                          {clsLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {krStock ? (
                          <Link
                            to="/stock/$ticker"
                            params={{ ticker: row.code! }}
                            className="font-semibold hover:underline"
                          >
                            {row.nameKo}
                          </Link>
                        ) : krEtf ? (
                          <Link
                            to="/etfs/$code"
                            params={{ code: row.code! }}
                            className="font-semibold hover:underline"
                          >
                            {row.nameKo}
                          </Link>
                        ) : usSymbol ? (
                          <Link
                            to="/us/$symbol"
                            params={{ symbol: usSymbol }}
                            className="font-semibold hover:underline"
                          >
                            {row.nameKo}
                          </Link>
                        ) : usLink ? (
                          <a
                            href={usLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold hover:underline"
                          >
                            {row.nameKo}
                          </a>
                        ) : (
                          <span className="font-semibold">{row.nameKo}</span>
                        )}
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {row.code && (
                            <span className="tabular">{row.code}</span>
                          )}
                          {row.reutersCode && !row.code && (
                            <span className="tabular">{row.reutersCode}</span>
                          )}
                          {"isin" in row && row.isin && !row.code && (
                            <span className="tabular">{row.isin}</span>
                          )}
                          {row.isOverseas && (
                            <span className="inline-flex items-center gap-0.5 text-desk-indigo">
                              <Globe2 className="size-3" /> 해외
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular font-semibold">
                        {q?.price
                          ? formatHoldingPrice(q.price, q.currency)
                          : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular text-sm font-semibold",
                          q
                            ? pct > 0
                              ? colors.up
                              : pct < 0
                                ? colors.down
                                : "text-muted-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {q ? formatPct(pct) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular text-sm text-muted-foreground">
                        {formatQty(row.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right tabular text-sm text-muted-foreground">
                        {q && q.volume > 0 ? formatVolume(q.volume) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {krStock ? (
                          <Link
                            to="/stock/$ticker"
                            params={{ ticker: row.code! }}
                            className="inline-flex items-center gap-0.5 text-sm text-primary hover:underline"
                          >
                            차트 <ArrowUpRight className="size-3.5" />
                          </Link>
                        ) : krEtf ? (
                          <Link
                            to="/etfs/$code"
                            params={{ code: row.code! }}
                            className="inline-flex items-center gap-0.5 text-sm text-primary hover:underline"
                          >
                            ETF <ArrowUpRight className="size-3.5" />
                          </Link>
                        ) : usSymbol ? (
                          <Link
                            to="/us/$symbol"
                            params={{ symbol: usSymbol }}
                            className="inline-flex items-center gap-0.5 text-sm text-primary hover:underline"
                          >
                            차트 <ArrowUpRight className="size-3.5" />
                          </Link>
                        ) : usLink ? (
                          <a
                            href={usLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-sm text-primary hover:underline"
                          >
                            시세 <ArrowUpRight className="size-3.5" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[560px] text-base">
              <thead className="bg-muted/40 text-sm text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3">종목 (테마 매핑 · 비중 없음)</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {themeStocks.map((row) => (
                  <tr key={row.code}>
                    <td className="px-4 py-3">
                      <Link
                        to="/stock/$ticker"
                        params={{ ticker: row.code }}
                        className="font-semibold hover:underline"
                      >
                        {row.nameKo}
                      </Link>
                      <div className="text-xs text-muted-foreground tabular">
                        {row.code}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/stock/$ticker"
                        params={{ ticker: row.code }}
                        className="text-sm text-primary hover:underline"
                      >
                        차트
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="desk-card desk-card-indigo p-5 md:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="size-4 text-desk-indigo" />
            테마·밸류체인 관련 ETF
          </h2>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {data && "peerNote" in data
              ? data.peerNote
              : "같은 산업 테마와 전·후방 밸류체인 ETF입니다."}
          </p>
        </div>
        {peers.length === 0 ? (
          <p className="text-base text-muted-foreground py-6 text-center">
            매칭된 관련 ETF가 없습니다.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {peers.map((p) => (
              <Link
                key={p.code}
                to="/etfs/$code"
                params={{ code: p.code }}
                className="rounded-xl border border-border bg-card/50 px-3.5 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="text-[15px] font-semibold leading-snug line-clamp-2">
                  {p.nameKo}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="tabular">{p.code}</span>
                  {"relation" in p && p.relation && (
                    <span className="rounded bg-desk-indigo/15 text-desk-indigo px-1.5 py-0.5">
                      {p.relation}
                    </span>
                  )}
                  {"isLeverageOrInverse" in p && p.isLeverageOrInverse && (
                    <span className="text-desk-rose">파생</span>
                  )}
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <span className="text-base font-semibold tabular">
                    {p.price ? formatPrice(p.price) : "—"}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular",
                      p.changePct > 0
                        ? colors.up
                        : p.changePct < 0
                          ? colors.down
                          : "text-muted-foreground",
                    )}
                  >
                    {formatPct(p.changePct)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
