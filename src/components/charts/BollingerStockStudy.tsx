import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProChart } from "@/components/charts/pro/ProChart";
import { formatChartPrice } from "@/components/charts/core/formatters";
import { getDiscoveryStockChart } from "@/lib/bollinger-discovery-fns";
import { discoverySituation } from "@/lib/bollinger/discovery-inspection";
import type { StoredCandidate } from "@/server/bollinger-discovery-store";
import type { OhlcBar } from "@/server/naver-market";

type StudyStock = { market: "KR" | "US"; symbol: string; name: string; exchange: string; sector: string };
const STATUS: Record<string, string> = {
  NO_HISTORY: "선택한 기준일까지 저장된 가격 이력이 없습니다. 분석 실행으로 가격 자료를 확보하세요.",
  MEMBER_MISSING: "이 종목은 선택한 편입 목록에 없습니다. 분석 범위와 종목을 다시 확인하세요.",
  UNIVERSE_MISSING: "선택한 편입 목록이 저장되어 있지 않습니다. 분석을 실행해 목록을 확보하세요.",
  INVALID_AS_OF: "조회 기준일을 확인하세요.",
  DATABASE_MISSING: "서버의 저장 DB 연결이 설정되지 않았습니다.",
  MIGRATION_0005_REQUIRED: "서버의 분석 자료 저장 구조를 확인해야 합니다.",
  DATABASE_QUERY_FAILED: "저장된 종목 자료를 읽지 못했습니다. 다시 조회하세요.",
};
const PRICE_BASIS: Record<string, string> = {
  "yahoo-kr-raw-ohlcv": "Yahoo 한국 주식 OHLCV",
  "naver-raw-ohlcv": "네이버 제공 OHLCV",
  "yahoo-us-adjusted-ohlcv": "Yahoo 미국 주식 조정 OHLCV",
};
const value = (number: number | null | undefined, digits = 1) =>
  number == null || !Number.isFinite(number) ? "미확보" : number.toFixed(digits);

/** Reads the same persisted price basis used by the selected stock's assessment.
 * No market-provider lookup or broker collection is started by opening a chart. */
export function BollingerStockStudy({ universeId, configVersion, asOf, stock, onExplain }: {
  universeId: string;
  configVersion: string;
  asOf: string;
  stock: StudyStock;
  onExplain?: (candidate: StoredCandidate) => void;
}) {
  const [windowBars, setWindowBars] = useState<120 | 250>(120);
  const query = useQuery({
    queryKey: ["bollinger-stock-chart", universeId, configVersion, stock.market, stock.symbol, asOf],
    queryFn: () => getDiscoveryStockChart({ data: { universeId, configVersion, market: stock.market, symbol: stock.symbol, asOf } }),
    enabled: Boolean(universeId && configVersion && stock.symbol && asOf),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const data = query.data?.status === "READY" && query.data.data?.member.market === stock.market && query.data.data.member.symbol === stock.symbol
    ? query.data.data : null;
  const history = useMemo<OhlcBar[]>(() => (data?.bars ?? []).map(bar => ({
    date: bar.date, label: bar.date.slice(5), open: bar.open, high: bar.high, low: bar.low, close: bar.close,
    volume: bar.volume, volumeValid: bar.volumeValid, bullish: bar.close >= bar.open,
  })), [data?.bars]);
  const displayed = useMemo(() => history.slice(-windowBars), [history, windowBars]);
  const last = history.at(-1);
  const candidate = data?.candidate ?? null;
  const situation = discoverySituation(candidate);
  const fetchedAt = data?.fetchedAt ? Date.parse(data.fetchedAt) : Number.NaN;
  const name = data?.member.name ?? stock.name;

  return <section className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-4" aria-label={`${name} 볼린저 가격 차트`} data-testid="bollinger-stock-study" data-symbol={`${stock.market}:${stock.symbol}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="break-words text-lg font-semibold">{name} <span className="text-sm font-normal text-muted-foreground">{stock.symbol} · {data?.member.exchange ?? stock.exchange}</span></h2>
        <p className="mt-1 text-sm text-muted-foreground">볼린저 밴드와 가격을 함께 보고 종목의 현재 위치를 확인합니다.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="저장 가격 표시 범위">
          {([120, 250] as const).map(count => <Button key={count} type="button" variant={windowBars === count ? "default" : "outline"} className="min-h-11" aria-pressed={windowBars === count} onClick={() => setWindowBars(count)}>최근 {count}봉</Button>)}
        </div>
        <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={query.isFetching} onClick={() => void query.refetch()} aria-label={`${name} 저장 가격 다시 조회`}>
          <RefreshCw className={query.isFetching ? "size-4 animate-spin" : "size-4"}/>다시 조회
        </Button>
      </div>
    </div>
    {query.isPending ? <p className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle className="size-4 animate-spin"/>선택 종목의 저장 가격을 읽고 있습니다…</p>
      : query.isError || !data || !last ? <div className="rounded-md border border-dashed border-border p-6 text-sm" role="status"><p className="font-medium">{name} 가격 차트를 표시할 자료가 없습니다.</p><p className="mt-2 text-muted-foreground">{query.isError ? "저장 자료 조회에 실패했습니다. 다시 조회하세요." : STATUS[query.data?.status ?? ""] ?? STATUS.NO_HISTORY}</p></div>
      : <>
        <div className="space-y-3" aria-label="선택 종목 분석 요약" data-testid="bollinger-stock-summary">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm"><strong>{situation.label}</strong> · 마지막 종가 <span className="font-semibold tabular-nums">{formatChartPrice(last.close, stock.market, last.close)}</span> · {last.date}</p>
            {candidate && onExplain && <Button type="button" variant="outline" className="min-h-11" onClick={() => onExplain(candidate)}>판정 근거</Button>}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{situation.summary}</p>
          {candidate ? <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <div><dt className="inline text-muted-foreground">밴드 폭 분위수 </dt><dd className="inline tabular-nums">{value(candidate.bbwPercentile)}{candidate.bbwPercentile == null ? "" : "%"}</dd></div>
            <div><dt className="inline text-muted-foreground">밴드 내 위치 %B </dt><dd className="inline tabular-nums">{value(candidate.percentB, 2)}</dd></div>
            <div><dt className="inline text-muted-foreground">거래량 배율 </dt><dd className="inline tabular-nums">{value(candidate.rvol, 2)}{candidate.rvol == null ? "" : "×"}</dd></div>
            <div><dt className="inline text-muted-foreground">저항까지 거리 </dt><dd className="inline tabular-nums">{value(candidate.distance)}{candidate.distance == null ? "" : "%"}</dd></div>
            <div><dt className="inline text-muted-foreground">전략 평가일 </dt><dd className="inline">{candidate.date}</dd></div>
          </dl> : <p className="text-xs text-muted-foreground">저장 가격으로 밴드는 표시할 수 있습니다. 최종 전략 평가는 아직 저장되지 않았습니다.</p>}
        </div>
        <ProChart
          key={`${universeId}:${configVersion}:${stock.market}:${stock.symbol}`}
          analysisOnly
          code={stock.symbol}
          market={stock.market}
          instrument="stock"
          name={name}
          exchange={data.member.exchange}
          currency={stock.market === "KR" ? "KRW" : "USD"}
          quantityUnit="주"
          layoutScope={`bollinger-study:${universeId}:${configVersion}`}
          bars={displayed}
          indicatorBars={history}
          profileBars={history}
          profileSource={data.source}
          priceBasisNote={PRICE_BASIS[data.priceBasis] ?? data.priceBasis}
          priceBasis={data.priceBasis}
          discovery={data.discovery ?? undefined}
          interval="day"
          intervalKey="day"
          source={data.source}
          modeLabel={`저장 완료 일봉 · ${last.date}`}
          updatedAt={Number.isFinite(fetchedAt) ? fetchedAt : null}
          height={500}
          testId="bollinger-study-price-chart"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">기본 BB(20, 2) · %B는 하단 0·상단 1 기준의 가격 위치, 밴드 폭 분위수는 과거 대비 압축 정도입니다. 압축만으로 상승을 확정하지 않습니다. 차트 설정은 이 분석 화면에 따로 저장됩니다.</p>
        <p className="break-words text-xs text-muted-foreground">가격 관측 {data.observation.first ?? "—"} ~ {data.observation.last ?? "—"} · {data.observation.count.toLocaleString("ko-KR")}개 완료 일봉 · 조회 기준 {asOf} · 출처 {data.source} · {PRICE_BASIS[data.priceBasis] ?? data.priceBasis}</p>
        {history.length < 200 && <p className="text-xs text-desk-orange" role="status">저장 이력이 {history.length}봉이므로 SMA200은 충분한 실제 이력이 생길 때까지 표시하지 않습니다.</p>}
      </>}
  </section>;
}
