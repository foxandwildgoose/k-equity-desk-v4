import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Filter, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { getBollingerScreener } from "@/lib/bollinger-screener-fns";
import { BOLLINGER_SCREENER_LIMITS, DEFAULT_SCREENER_FILTERS, parseScreenerSymbols, rankScreener, type BollingerSnapshot, type ScreenerFilters } from "@/lib/bollinger/screener";

const STATUS_LABELS: Record<BollingerSnapshot["status"], string> = {
  recent: "최근 완료봉", stale: "오래된 이력", missing: "이력 미확보", warmup: "워밍업 부족", error: "조회 실패", deferred: "조회 대기",
};
const TREND_LABELS: Record<string, string> = { "strong-bullish": "강한 상승", bullish: "상승", neutral: "중립", bearish: "하락", "strong-bearish": "강한 하락" };
const FILTER_OPTIONS: { key: "lowBandwidth" | "aboveSma200" | "highRvol" | "upperBreakout" | "foreignPositive" | "trustPositive"; label: string }[] = [
  { key: "lowBandwidth", label: "BBW 분위수 ≤ 10%" }, { key: "aboveSma200", label: "가격 > SMA200" },
  { key: "highRvol", label: "RVOL ≥ 1.5" }, { key: "upperBreakout", label: "%B ≥ 1" },
  { key: "foreignPositive", label: "외국인 보유비율 5거래일 변화 > 0" }, { key: "trustPositive", label: "투신 순매수 수량 > 0" },
];
const number = (value: number | null, digits = 2) => value == null || !Number.isFinite(value) ? "N/A" : value.toFixed(digits);
const EMPTY_ROWS: BollingerSnapshot[] = [];
function ChartLink({ row }: { row: BollingerSnapshot }) {
  return <Link className="font-medium text-desk-teal hover:underline" to="/chart" search={{ symbols: `${row.market}:${row.symbol}`, layout: "1", interval: "day", range: "2y" }} aria-label={`${row.name} ${row.symbol} 일봉 차트 열기`}>{row.name}</Link>;
}
function SnapshotTable({ rows }: { rows: BollingerSnapshot[] }) {
  return <>
    <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
      <table className="w-full text-xs" aria-label="Bollinger 일봉 스냅샷">
        <thead className="bg-muted text-muted-foreground"><tr>{["종목 / 시장", "주기", "BBW %", "BBW 분위수", "%B", "RVOL", "추세", "Setup", "Setup Quality", "Coverage", "기준일 / 출처", "상태"].map(title => <th className="whitespace-nowrap px-3 py-3 text-left font-medium" key={title}>{title}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr className="border-t border-border align-top" key={`${row.market}:${row.symbol}`}>
          <td className="px-3 py-3"><ChartLink row={row} /><p className="mt-1 text-muted-foreground">{row.market}:{row.symbol}</p></td>
          <td className="px-3 py-3">일봉</td><td className="tabular-nums px-3 py-3">{number(row.bbw)}</td><td className="tabular-nums px-3 py-3">{number(row.bbwPercentile)}%</td>
          <td className="tabular-nums px-3 py-3">{number(row.percentB)}</td><td className="tabular-nums px-3 py-3">{number(row.rvol)}x</td><td className="whitespace-nowrap px-3 py-3">{TREND_LABELS[row.trend ?? ""] ?? "N/A"}</td>
          <td className="px-3 py-3">{row.setup ?? "N/A"}</td><td className="tabular-nums px-3 py-3">{number(row.score, 0)}</td><td className="tabular-nums px-3 py-3">{row.coverage == null ? "N/A" : `${Math.round(row.coverage * 100)}%`}</td>
          <td className="max-w-48 px-3 py-3"><p className="whitespace-nowrap">{row.asOf ?? "—"}</p><p className="mt-1 break-words text-muted-foreground">{row.source}</p></td>
          <td className="max-w-56 px-3 py-3"><span>{STATUS_LABELS[row.status]}</span><p className="mt-1 text-muted-foreground">{row.reason}</p><p className="mt-1 text-muted-foreground" title={row.flow.reason}>수급: {row.flow.availability} · 보유 변화 {number(row.flow.foreignOwnershipChange)}pp · 투신 {number(row.flow.investmentTrustNet, 0)}</p></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="grid gap-3 md:hidden">{rows.map(row => <article className="rounded-lg border border-border p-3 text-sm" key={`${row.market}:${row.symbol}`}>
      <div className="flex flex-wrap justify-between gap-2"><ChartLink row={row} /><span className="text-xs text-muted-foreground">{row.market}:{row.symbol} · 일봉</span></div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">{[
        ["BBW", number(row.bbw) + "%"], ["BBW 분위수", number(row.bbwPercentile) + "%"], ["%B", number(row.percentB)], ["RVOL", number(row.rvol) + "x"],
        ["추세", TREND_LABELS[row.trend ?? ""] ?? "N/A"], ["Setup", row.setup ?? "N/A"], ["Setup Quality", number(row.score, 0)], ["Coverage", row.coverage == null ? "N/A" : `${Math.round(row.coverage * 100)}%`],
        ["외국인 보유 변화", number(row.flow.foreignOwnershipChange) + "pp"], ["투신 순매수 수량", number(row.flow.investmentTrustNet, 0)],
      ].map(([title, value]) => <div className="min-w-0" key={title}><dt className="text-muted-foreground">{title}</dt><dd className="mt-0.5 break-words tabular-nums">{value}</dd></div>)}</dl>
      <p className="mt-3 text-xs">{row.asOf ?? "—"} · {STATUS_LABELS[row.status]}</p><p className="mt-1 break-words text-xs text-muted-foreground">{row.source} · {row.reason}</p>
      <p className="mt-1 text-xs text-muted-foreground">수급 {row.flow.availability}: {row.flow.reason}</p>
    </article>)}</div>
  </>;
}
export function BollingerManualDiagnostic() {
  const watchlist = useAppStore(state => state.watchlist);
  const usWatchlist = useAppStore(state => state.usWatchlist);
  const [symbols, setSymbols] = useState("KR:005930");
  const [inputError, setInputError] = useState("");
  const [filters, setFilters] = useState<ScreenerFilters>({ ...DEFAULT_SCREENER_FILTERS });
  const query = useMutation({ mutationFn: (raw: string) => getBollingerScreener({ data: { symbols: parseScreenerSymbols(raw) } }) });
  const rows = query.data?.rows ?? EMPTY_ROWS;
  const ranked = useMemo(() => rankScreener(rows, filters), [rows, filters]);
  const unavailable = rows.filter(row => row.status !== "recent");
  const submit = () => {
    try { parseScreenerSymbols(symbols); setInputError(""); query.mutate(symbols); }
    catch (error) { setInputError(error instanceof Error ? error.message : "종목 입력을 확인하세요."); }
  };
  return <div className="flex min-w-0 flex-col gap-5" data-testid="bollinger-manual-diagnostic">
    <PageHeader kicker="선택 종목 · 완료 일봉" title="선택 종목 진단" lead="가격 분포가 아닌 실제 BBW 분위수로 변동성 압축과 확장을 비교합니다." />
    <section className="rounded-lg border border-border bg-card p-4" aria-label="조회 종목 선택">
      <label htmlFor="bollinger-symbols" className="text-sm font-medium">종목 코드 · 최대 {BOLLINGER_SCREENER_LIMITS.maxSymbols}개</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input id="bollinger-symbols" value={symbols} onChange={event => setSymbols(event.target.value)} placeholder="KR:005930, KR:069500, US:NVDA" className="min-h-11 flex-1" disabled={query.isPending} aria-describedby="bollinger-scope" />
        <Button type="button" onClick={submit} disabled={query.isPending} className="min-h-11 gap-2"><RefreshCw className={query.isPending ? "size-4 animate-spin" : "size-4"} />{query.isPending ? "스냅샷 조회 중…" : "선택 종목 조회"}</Button></div>
      <div className="mt-2 flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={!watchlist.length || query.isPending} onClick={() => setSymbols(watchlist.slice(0, 10).map(code => `KR:${code}`).join(", "))}>한국 관심종목 처음 10개</Button><Button type="button" variant="outline" className="min-h-11" disabled={!usWatchlist.length || query.isPending} onClick={() => setSymbols(usWatchlist.slice(0, 10).map(code => `US:${code}`).join(", "))}>미국 관심종목 처음 10개</Button></div>
      <p id="bollinger-scope" className="mt-3 text-xs leading-relaxed text-muted-foreground">Phase 1: 일봉·선택 종목 전용. BB(20, 2), BBW 분위수 125봉, SMA200 기준. 조회 버튼을 누를 때만 서버에서 계산하며 같은 서버의 스냅샷은 10분간 재사용합니다. 각 차트의 사용자 지정 Bollinger 설정과는 별도 기본 분석입니다.</p>
      {inputError && <p role="alert" className="mt-2 text-sm text-destructive">{inputError}</p>}{query.isError && <p role="alert" className="mt-2 text-sm text-destructive">서버 스냅샷 조회 실패 · 연결을 확인하고 다시 조회하세요.</p>}
    </section>
    <section className="rounded-lg border border-border bg-card p-4" aria-label="Bollinger 스크리너 필터">
      <h2 className="flex items-center gap-2 text-sm font-medium"><Filter className="size-4" />스냅샷 필터</h2>
      <div className="mt-2 grid gap-x-4 sm:grid-cols-2 xl:grid-cols-3">{FILTER_OPTIONS.map(option => <label key={option.key} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={filters[option.key]} onChange={event => setFilters(prev => ({ ...prev, [option.key]: event.target.checked }))} />{option.label}</label>)}</div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm"><label className="flex min-h-11 items-center gap-2">추세<select className="min-h-11 rounded border border-input bg-card px-2" value={filters.trend} onChange={event => setFilters(prev => ({ ...prev, trend: event.target.value as ScreenerFilters["trend"] }))}><option value="any">전체</option><option value="bullish">상승 / 강한 상승</option><option value="bearish">하락 / 강한 하락</option></select></label><label htmlFor="bollinger-min-score">Setup Quality ≥</label><Input id="bollinger-min-score" type="number" min={0} max={100} step={1} value={filters.minScore} className="min-h-11 w-20" onChange={event => setFilters(prev => ({ ...prev, minScore: Math.max(0, Math.min(100, Number(event.target.value) || 0)) }))} /><Button variant="outline" className="min-h-11" onClick={() => setFilters({ ...DEFAULT_SCREENER_FILTERS })}>필터 초기화</Button></div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">결측은 0이 아닙니다. 수급 필터는 공표시각·거래일·단위가 확인된 키움 저장 자료에만 적용하며 미국 종목과 미확보 자료는 일치하지 않습니다. Setup Quality는 휴리스틱 점수이며 상승 확률이 아닙니다.</p>
    </section>
    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground" aria-live="polite"><span>조건 일치 {ranked.length} / 요청 {rows.length} · 최신 순위 제외 {unavailable.length}</span><span>{query.data?.fetchedAt ? `조회 ${new Date(query.data.fetchedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}` : "아직 조회하지 않았습니다"}</span></div>
    {ranked.length ? <SnapshotTable rows={ranked} /> : <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{rows.length ? "최근 완료봉 중 선택한 필터에 맞는 종목이 없습니다." : "종목을 선택한 후 조회하면 완료 일봉의 스냅샷이 표시됩니다."}</div>}
    {unavailable.length > 0 && <section aria-label="순위에서 제외된 조회 결과"><h2 className="mb-3 text-sm font-medium">순위에서 제외된 결과 · 사유 확인</h2><SnapshotTable rows={unavailable} /></section>}
    <details className="rounded-lg border border-border p-4 text-xs leading-relaxed text-muted-foreground"><summary className="min-h-11 cursor-pointer text-sm font-medium text-foreground">방법·가용 범위</summary><p>오늘 진행 중인 일봉은 제외합니다. 최근 기준은 마지막 완료봉이 4달력일 이내라는 보수적 표시이며 거래소 휴장/공표 확정 보장은 아닙니다. 오래된 자료·미확보·SMA200/BBW 분위수 워밍업 부족은 최신 점수 순위에서 제외됩니다.</p><p className="mt-2">선택한 종목의 기존 가격 수신 경로와 공유 Bollinger 엔진을 사용합니다. 수급은 기존 접근통제를 통과한 영속 DB 읽기만 수행하며 키움 인증·수집을 발생시키지 않습니다. 캐시와 직렬 실행은 서버 인스턴스별이며 전체 시장/분봉 일괄 스캔과 분산 수집기는 이번 범위가 아닙니다.</p></details>
  </div>;
}
