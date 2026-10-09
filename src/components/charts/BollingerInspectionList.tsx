import { Button } from "@/components/ui/button";
import { formatChartPrice } from "@/lib/chart-format";
import { discoverySituation, type DiscoveryInspectionRow } from "@/lib/bollinger/discovery-inspection";

const metric=(value:number|null|undefined,digits=1)=>value==null||!Number.isFinite(value)?"미확보":value.toLocaleString("ko-KR",{maximumFractionDigits:digits});
export const discoveryStockKey=(stock:Pick<DiscoveryInspectionRow,"market"|"symbol">)=>`${stock.market}:${stock.symbol}`;

/** Non-matching and not-yet-computed members remain visible and can open their saved price chart. */
export function BollingerInspectionList({rows,focused,onFocus,onExplain,pendingSymbols,stockErrors}:{
  rows:DiscoveryInspectionRow[];focused:string|null;onFocus:(row:DiscoveryInspectionRow)=>void;
  onExplain:(row:DiscoveryInspectionRow)=>void;pendingSymbols:Set<string>;
  stockErrors?:Map<string,string>;
}) {
  const describe=(row:DiscoveryInspectionRow)=>{
    const pending=pendingSymbols.has(discoveryStockKey(row));
    const failure=stockErrors?.get(discoveryStockKey(row));
    const failureMessage=failure==="NO_HISTORY"?"공급자가 유효한 완료 일봉을 반환하지 않았습니다.":failure==="PRICE_FETCH_FAILED"?"가격 수신이 실패했습니다. 수집 이어받기로 이 종목을 재시도할 수 있습니다.":failure==="COMPUTE_FAILED"?"가격은 확보했지만 최종 분석을 계산하지 못했습니다. 수집 이어받기로 재시도할 수 있습니다.":null;
    const shortage=row.dataStatus?.reason;
    const situation=shortage==="NO_PRICE_HISTORY"?{label:"가격 이력 미확보",summary:failureMessage??"선택 기준일 이전의 저장 가격이 없습니다. 실행으로 해당 범위의 가격을 확보합니다."}:shortage==="FINAL_COMPUTE_OUTDATED"?{label:"가격 갱신 · 재분석 대기",summary:`${row.dataStatus!.lastPriceDate??"저장 가격"} 기준 ${row.dataStatus!.priceCount}봉의 가격이 분석 후 갱신되었습니다. 표시된 분석은 이전 계산이며 실행으로 다시 계산합니다.`}:shortage==="CONFIGURATION_NOT_COMPUTED"?{label:"선택 버전 분석 대기",summary:`가격 ${row.dataStatus!.priceCount}봉은 저장되어 있지만 선택한 계산 버전의 분석은 없습니다.`}:shortage==="FINAL_COMPUTE_MISSING"?{label:"최종 분석 대기",summary:`가격 ${row.dataStatus!.priceCount}봉은 저장되어 있습니다. 선택 편입 목록에 대한 최종 계산을 이어갑니다.`}:discoverySituation(row.candidate);
    const labels:Record<DiscoveryInspectionRow["assessment"],string>={MATCH:"현재 전략 일치",NO_COMPUTED_HISTORY:"분석 판정 대기",DATA_UNAVAILABLE:"전략 평가 자료 부족",WARMUP:"분석 이력 부족",STALE:"분석일 갱신 필요",LOW_COVERAGE:"자료 커버리지 부족",STRATEGY_MISMATCH:"현재 전략 미일치",LOW_SCORE:"점수 조건 미달"};
    const reasons=failureMessage??(pending?"기존 저장 분석입니다. 이번 갱신이 끝나면 판정이 달라질 수 있습니다.":shortage?situation.summary:row.reasons.join(" · "));
    return {pending,situation,reasons,badge:failureMessage?"종목별 수집 오류":shortage?"가격·분석 확보 필요":pending?"최종 갱신 대기":labels[row.assessment],
      price:row.candidate?`${formatChartPrice(row.candidate.close,row.market)}${row.market==="KR"?"원":" USD"}`:"가격 확인은 차트에서"};
  };
  return <div data-testid="bollinger-inspection-list">
    <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
      <table className="w-full text-sm"><thead className="bg-card text-xs text-muted-foreground"><tr>{["종목 · 차트 선택","현재 상황","완료봉 종가","변동성 폭 분위수","밴드 위치 · RSI","전략 판정 · 이유","분석일"].map(title=><th key={title} className="p-3 text-left font-medium whitespace-nowrap">{title}</th>)}</tr></thead>
        <tbody>{rows.map(row=>{const {pending,situation,reasons,badge,price}=describe(row),key=discoveryStockKey(row);return <tr key={key} className="border-t border-border" data-testid="bollinger-inspection-row" data-symbol={key} data-assessment={row.assessment}>
          <td className="p-3"><Button variant={focused===key?"secondary":"ghost"} className="min-h-11 justify-start text-left" aria-pressed={focused===key} onClick={()=>onFocus(row)} aria-label={`${row.name} 볼린저 차트 보기`}><span className="font-semibold">{row.name}</span></Button><p className="mt-1 text-xs text-muted-foreground">{row.symbol} · {row.exchange==="OTHER"?row.market:row.exchange} · {row.sector}</p></td>
          <td className="p-3"><p className="font-medium">{situation.label}</p><p className="mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">{situation.summary}</p></td>
          <td className="p-3 whitespace-nowrap tabular-nums">{price}</td>
          <td className="p-3 tabular-nums">{metric(row.candidate?.bbwPercentile)}{row.candidate?.bbwPercentile!=null?"%":""}</td>
          <td className="p-3 tabular-nums">{metric(row.candidate?.percentB,2)} / {metric(row.candidate?.rsi)}</td>
          <td className="p-3"><p className={row.matched&&!pending?"font-medium text-desk-teal":"font-medium"}>{badge}</p><p className="mt-1 max-w-72 text-xs leading-relaxed text-muted-foreground">{reasons}</p>{row.candidate&&<Button variant="ghost" className="mt-1 min-h-11 px-0 text-xs" onClick={()=>onExplain(row)}>분석 근거</Button>}</td>
          <td className="p-3 whitespace-nowrap text-xs">{row.candidate?.date??"계산 자료 없음"}</td>
        </tr>;})}</tbody></table>
    </div>
    <div className="grid gap-3 md:hidden">{rows.map(row=>{const {situation,reasons,badge,price}=describe(row),key=discoveryStockKey(row);return <article key={key} className="rounded-lg border border-border bg-card p-4" data-testid="bollinger-inspection-card" data-symbol={key} data-assessment={row.assessment}>
      <Button variant={focused===key?"secondary":"ghost"} className="min-h-11 w-full justify-between" aria-pressed={focused===key} onClick={()=>onFocus(row)} aria-label={`${row.name} 볼린저 차트 보기`}><span className="truncate font-semibold">{row.name}</span><span className="ml-2 text-xs">차트 보기</span></Button>
      <p className="mt-2 text-xs text-muted-foreground">{row.symbol} · {row.exchange==="OTHER"?row.market:row.exchange} · {row.sector}</p><p className="mt-3 text-sm font-medium">{situation.label} · {price}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{situation.summary}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><dt className="text-muted-foreground">폭 분위수</dt><dd className="mt-1 tabular-nums">{metric(row.candidate?.bbwPercentile)}{row.candidate?.bbwPercentile!=null?"%":""}</dd></div><div><dt className="text-muted-foreground">밴드 위치 %B</dt><dd className="mt-1 tabular-nums">{metric(row.candidate?.percentB,2)}</dd></div><div><dt className="text-muted-foreground">RSI</dt><dd className="mt-1 tabular-nums">{metric(row.candidate?.rsi)}</dd></div></dl>
      <p className="mt-3 text-xs font-medium">{badge}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{reasons}</p><div className="mt-2 flex items-center justify-between gap-2 text-xs"><span>{row.candidate?.date??"계산 자료 없음"}</span>{row.candidate&&<Button variant="outline" className="min-h-11" onClick={()=>onExplain(row)}>분석 근거</Button>}</div>
    </article>;})}</div>
  </div>;
}
