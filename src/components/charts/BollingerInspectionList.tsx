import { Button } from "@/components/ui/button";
import { formatChartPrice } from "@/lib/chart-format";
import { discoverySituation, type DiscoveryInspectionRow } from "@/lib/bollinger/discovery-inspection";

const metric=(value:number|null|undefined,digits=1)=>value==null||!Number.isFinite(value)?"미확보":value.toLocaleString("ko-KR",{maximumFractionDigits:digits});
export const discoveryStockKey=(stock:Pick<DiscoveryInspectionRow,"market"|"symbol">)=>`${stock.market}:${stock.symbol}`;

/** Non-matching and not-yet-computed members remain visible and can open their saved price chart. */
export function BollingerInspectionList({rows,focused,onFocus,onExplain,pendingSymbols}:{
  rows:DiscoveryInspectionRow[];focused:string|null;onFocus:(row:DiscoveryInspectionRow)=>void;
  onExplain:(row:DiscoveryInspectionRow)=>void;pendingSymbols:Set<string>;
}) {
  const describe=(row:DiscoveryInspectionRow)=>{
    const pending=pendingSymbols.has(discoveryStockKey(row));
    const situation=discoverySituation(row.candidate);
    return {pending,situation,badge:pending?"최종 갱신 대기":row.matched?"현재 전략 일치":"현재 전략 미일치",
      price:row.candidate?`${formatChartPrice(row.candidate.close,row.market)}${row.market==="KR"?"원":" USD"}`:"가격 확인은 차트에서"};
  };
  return <div data-testid="bollinger-inspection-list">
    <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
      <table className="w-full text-sm"><thead className="bg-card text-xs text-muted-foreground"><tr>{["종목 · 차트 선택","현재 상황","완료봉 종가","변동성 폭 분위수","밴드 위치 · RSI","전략 판정 · 이유","분석일"].map(title=><th key={title} className="p-3 text-left font-medium whitespace-nowrap">{title}</th>)}</tr></thead>
        <tbody>{rows.map(row=>{const {pending,situation,badge,price}=describe(row),key=discoveryStockKey(row);return <tr key={key} className="border-t border-border" data-testid="bollinger-inspection-row" data-symbol={key} data-assessment={row.assessment}>
          <td className="p-3"><Button variant={focused===key?"secondary":"ghost"} className="min-h-11 justify-start text-left" aria-pressed={focused===key} onClick={()=>onFocus(row)} aria-label={`${row.name} 볼린저 차트 보기`}><span className="font-semibold">{row.name}</span></Button><p className="mt-1 text-xs text-muted-foreground">{row.symbol} · {row.exchange} · {row.sector}</p></td>
          <td className="p-3"><p className="font-medium">{situation.label}</p><p className="mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">{situation.summary}</p></td>
          <td className="p-3 whitespace-nowrap tabular-nums">{price}</td>
          <td className="p-3 tabular-nums">{metric(row.candidate?.bbwPercentile)}{row.candidate?.bbwPercentile!=null?"%":""}</td>
          <td className="p-3 tabular-nums">{metric(row.candidate?.percentB,2)} / {metric(row.candidate?.rsi)}</td>
          <td className="p-3"><p className={row.matched&&!pending?"font-medium text-desk-teal":"font-medium"}>{badge}</p><p className="mt-1 max-w-72 text-xs leading-relaxed text-muted-foreground">{pending?"기존 저장 분석입니다. 이번 갱신이 끝나면 판정이 달라질 수 있습니다.":row.reasons.join(" · ")}</p>{row.candidate&&<Button variant="ghost" className="mt-1 min-h-11 px-0 text-xs" onClick={()=>onExplain(row)}>분석 근거</Button>}</td>
          <td className="p-3 whitespace-nowrap text-xs">{row.candidate?.date??"계산 자료 없음"}</td>
        </tr>;})}</tbody></table>
    </div>
    <div className="grid gap-3 md:hidden">{rows.map(row=>{const {pending,situation,badge,price}=describe(row),key=discoveryStockKey(row);return <article key={key} className="rounded-lg border border-border bg-card p-4" data-testid="bollinger-inspection-card" data-symbol={key}>
      <Button variant={focused===key?"secondary":"ghost"} className="min-h-11 w-full justify-between" aria-pressed={focused===key} onClick={()=>onFocus(row)} aria-label={`${row.name} 볼린저 차트 보기`}><span className="truncate font-semibold">{row.name}</span><span className="ml-2 text-xs">차트 보기</span></Button>
      <p className="mt-2 text-xs text-muted-foreground">{row.symbol} · {row.exchange} · {row.sector}</p><p className="mt-3 text-sm font-medium">{situation.label} · {price}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{situation.summary}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><dt className="text-muted-foreground">폭 분위수</dt><dd className="mt-1 tabular-nums">{metric(row.candidate?.bbwPercentile)}{row.candidate?.bbwPercentile!=null?"%":""}</dd></div><div><dt className="text-muted-foreground">밴드 위치 %B</dt><dd className="mt-1 tabular-nums">{metric(row.candidate?.percentB,2)}</dd></div><div><dt className="text-muted-foreground">RSI</dt><dd className="mt-1 tabular-nums">{metric(row.candidate?.rsi)}</dd></div></dl>
      <p className="mt-3 text-xs font-medium">{badge}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{pending?"기존 저장 분석 · 최종 갱신 후 판정 확인":row.reasons.join(" · ")}</p><div className="mt-2 flex items-center justify-between gap-2 text-xs"><span>{row.candidate?.date??"계산 자료 없음"}</span>{row.candidate&&<Button variant="outline" className="min-h-11" onClick={()=>onExplain(row)}>분석 근거</Button>}</div>
    </article>;})}</div>
  </div>;
}
