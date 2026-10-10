import { useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDiscoveryChartContext } from "@/lib/bollinger-discovery-fns";
import { LayoutGrid, Link2, Search, Square, Columns2 } from "lucide-react";
import { PageDisclaimer } from "@/components/feed/PageDisclaimer";
import { Input } from "@/components/ui/input";
import { ProChart } from "@/components/charts/pro/ProChart";
import { createChartSync } from "@/components/charts/core/sync";
import { useAnalysisChartData } from "@/lib/charts/use-analysis-chart-data";
import { useChartSecurity } from "@/lib/charts/use-chart-security";
import { chartLayoutScope, parseChartSymbols } from "@/lib/charts/security";
import { useAppStore } from "@/lib/store";
import { getSecuritySearch } from "@/lib/market-fns";
import { normalizeSearchUsSymbol, searchSecurityKey, type ListedSearchHit } from "@/lib/security-search";
import type { ChartInterval, MinuteSize } from "@/server/naver-market";
import { cn } from "@/lib/utils";

type Layout = "1" | "2" | "4";
type Search = { symbols?: string; layout?: Layout; scope?: "detail"; interval?: ChartInterval; minuteSize?: MinuteSize; range?: string; discoveryUniverse?:string; discoveryVersion?:string };

export const Route = createFileRoute("/chart")({
  component: ChartWorkspace,
  validateSearch: (s: Record<string, unknown>): Search => ({
    discoveryUniverse:typeof s.discoveryUniverse==="string"?s.discoveryUniverse.slice(0,160):undefined,
    discoveryVersion:typeof s.discoveryVersion==="string"?s.discoveryVersion.slice(0,1500):undefined,
    symbols: typeof s.symbols === "string" ? s.symbols.slice(0, 80) : undefined,
    layout: s.layout === "2" || s.layout === "4" || s.layout === "1" ? s.layout : s.layout === 2 || s.layout === 4 || s.layout === 1 ? (String(s.layout) as Layout) : undefined,
    scope: s.scope === "detail" ? "detail" : undefined,
    interval: ["minute", "day", "week", "month", "year"].includes(String(s.interval)) ? s.interval as ChartInterval : undefined,
    minuteSize: [1, 3, 5, 10, 15, 30, 60].includes(Number(s.minuteSize)) ? Number(s.minuteSize) as MinuteSize : undefined,
    range: typeof s.range === "string" && /^(1d|5d|7d|60d|1mo|3mo|6mo|1y|2y|5y|max)$/.test(s.range) ? s.range : undefined,
  }),
  head: () => ({ meta: [{ title: "차트 워크스페이스 · Korea Equity Command Center" }] }),
});

const DEFAULT_SYMBOLS = ["KR:005930", "KR:000660", "US:NVDA", "US:TSLA"];
const INTERVALS: { id: ChartInterval; label: string; range: string }[] = [
  { id: "minute", label: "5분", range: "5d" },
  { id: "day", label: "일", range: "2y" },
  { id: "week", label: "주", range: "5y" },
  { id: "month", label: "월", range: "max" },
  { id: "year", label: "년", range: "max" },
];

function SymbolPicker({ value, onPick }: { value: string; onPick: (sym: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ListedSearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const submit = async () => {
    const raw = q.trim().toUpperCase();
    if (!raw) return;
    const ticket = ++sequence.current;
    if (/^KR:[0-9A-Z]{6}$/.test(raw)) return void (onPick(raw), setQ(""), setHits([]));
    if (raw.startsWith("US:")) {
      const symbol = normalizeSearchUsSymbol(raw.slice(3));
      if (symbol) return void (onPick(`US:${symbol}`), setQ(""), setHits([]));
    }
    if (/^[0-9A-Z]{6}$/.test(raw) && /[0-9]/.test(raw)) return void (onPick(`KR:${raw}`), setQ(""), setHits([]));
    setBusy(true);
    try {
      const r = await getSecuritySearch({ data: { q: q.trim() } });
      if (ticket === sequence.current) setHits(r.hits.slice(0, 6));
    } catch {
      if (ticket === sequence.current) setHits([]);
    } finally {
      if (ticket === sequence.current) setBusy(false);
    }
  };
  return (
    <div className="relative">
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Search className="size-3.5 text-muted-foreground" />
        <Input value={q} onChange={(e) => { sequence.current++; setQ(e.target.value); setHits([]); setBusy(false); }} placeholder={value.split(":")[1] ?? "종목"} className="h-8 w-28 text-[11px]" aria-label="종목 검색 (코드·심볼·이름)" />
      </form>
      {(hits.length > 0 || busy) && (
        <ul className="absolute left-0 top-9 z-30 w-56 rounded-md border border-border bg-card p-1 text-[11px] shadow-lg">
          {busy && <li className="px-2 py-1 text-muted-foreground">검색 중…</li>}
          {hits.map((h) => (
            <li key={searchSecurityKey(h)}>
              <button
                type="button"
                className="flex min-h-9 w-full items-center justify-between rounded px-2 hover:bg-muted"
                onClick={() => {
                  sequence.current++;
                  onPick(`${h.region}:${h.code}`);
                  setHits([]);
                  setQ("");
                }}
              >
                <span className="truncate">{h.nameKo}</span>
                <span className="tabular text-muted-foreground">{h.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Pane({
  sym,
  idx,
  interval,
  onInterval,
  onSymbol,
  sync,
  height,
  compact,
  layoutScope,
  minuteSize = 5,
  selectedRange,
  discoveryUniverse,
  discoveryVersion,
}: {
  sym: string;
  idx: number;
  interval: ChartInterval;
  onInterval: (i: ChartInterval, minuteSize?: MinuteSize) => void;
  onSymbol: (s: string) => void;
  sync: ReturnType<typeof createChartSync>;
  height: number | string;
  compact: boolean;
  layoutScope: string;
  minuteSize?: MinuteSize;
  selectedRange?: string;
  discoveryUniverse?:string;
  discoveryVersion?:string;
}) {
  const [m, code] = sym.split(":") as ["KR" | "US", string];
  const discovery=useQuery({queryKey:["bollinger-chart-context",discoveryUniverse,discoveryVersion,m,code],enabled:!!discoveryUniverse&&!!discoveryVersion,queryFn:()=>getDiscoveryChartContext({data:{universeId:discoveryUniverse!,version:discoveryVersion!,market:m,symbol:code}}),staleTime:60000});
  const conf = INTERVALS.find((x) => x.id === interval) ?? INTERVALS[1]!;
  const security = useChartSecurity(code, m);
  const range = selectedRange ?? conf.range;
  const q = useAnalysisChartData({ code, market: m === "US" ? "US" : security.data?.exchange === "KOSDAQ" ? "KOSDAQ" : "KOSPI", interval, minuteSize, range });
  const bars = q.data?.bars ?? [];
  const controls = (
    <div className="flex flex-wrap items-center gap-1">
      <SymbolPicker value={sym} onPick={onSymbol} />
      <div className="flex gap-0.5 rounded-md bg-muted p-0.5" role="group" aria-label="봉 주기">
        {INTERVALS.map((x) => (
          <button key={x.id} type="button" onClick={() => onInterval(x.id)} className={cn("min-h-8 rounded px-2 text-[11px] font-medium", interval === x.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
            {x.id === "minute" ? `${minuteSize}분` : x.label}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <ProChart
      discovery={discovery.data?.data??undefined}
      code={code}
      market={m}
      name={security.data?.name}
      instrument={security.data?.instrument}
      exchange={security.data?.exchange ?? (m === "KR" ? "KRX" : "US")}
      currency={security.data?.currency ?? (m === "KR" ? "KRW" : "USD")}
      quantityUnit={security.data?.quantityUnit ?? "주"}
      layoutScope={layoutScope}
      bars={bars}
      profileBars={q.profileBars}
      profileSource={q.profileSource}
      indicatorBars={q.indicatorBars}
      priceBasisNote={q.priceBasisNote}
      onTimeframe={onInterval}
      interval={interval}
      minuteSize={minuteSize}
      range={range}
      intervalKey={interval === "minute" ? `minute-${minuteSize}` : interval}
      source={q.data?.source ?? ""}
      modeLabel={m === "US" ? "Yahoo 지연 시세" : "비공식 경로 · 당일 봉 지연 가능"}
      updatedAt={q.dataUpdatedAt || null}
      loading={q.isLoading}
      error={q.isError}
      events={q.data && "events" in q.data ? q.data.events : undefined}
      toolbarExtra={controls}
      height={m === "KR" || security.data?.instrument === "etf" ? `max(${compact ? 680 : 800}px, ${typeof height === "number" ? `${height}px` : height})` : height}
      sync={sync}
      syncId={`pane-${idx}`}
      testId={`workspace-pane-${idx}`}
      compact={compact}
    />
  );
}

/** `/chart` workspace (F7.9): 1-, 2- or 4-chart layout, synced crosshair, optional synced interval. */
function ChartWorkspace() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/chart" });
  const layout: Layout = search.layout ?? "1";
  const count = Number(layout);
  const parsed = parseChartSymbols(search.symbols);
  const symbols = useMemo(() => {
    const out = [...parsed];
    for (const d of DEFAULT_SYMBOLS) if (out.length < count && !out.includes(d)) out.push(d);
    return out.slice(0, count);
  }, [parsed.join(","), count]); // eslint-disable-line react-hooks/exhaustive-deps
  const syncInterval = useAppStore((s) => s.chartPrefs.syncInterval);
  const setChartPrefs = useAppStore((s) => s.setChartPrefs);
  const [shared, setShared] = useState<ChartInterval>(search.interval ?? "day");
  const [own, setOwn] = useState<ChartInterval[]>(Array(4).fill(search.interval ?? "day"));
  const sync = useMemo(() => createChartSync(), []);

  const setSymbols = (next: string[], nextLayout: Layout = layout) => void navigate({ search: { symbols: next.join(","), layout: nextLayout }, replace: true });
  const height = count === 1 ? "max(420px, calc(100dvh - 22rem))" : count === 2 ? "max(380px, calc(100dvh - 20rem))" : "max(300px, calc((100dvh - 24rem) / 2))";

  return (
    <div className="flex flex-col gap-2" data-testid="chart-workspace">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="desk-kicker">Chart workspace</p>
          <h1 className="text-lg font-semibold">차트 워크스페이스</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              ["1", Square, "1개"],
              ["2", Columns2, "2개"],
              ["4", LayoutGrid, "4개"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSymbols(symbols, id)}
              aria-pressed={layout === id}
              className={cn("inline-flex min-h-9 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold", layout === id ? "border-foreground/30 bg-foreground text-background" : "border-border hover:bg-muted")}
              data-testid={`layout-${id}`}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setChartPrefs({ syncInterval: !syncInterval })}
            aria-pressed={syncInterval}
            className={cn("inline-flex min-h-9 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold", syncInterval ? "border-desk-teal/50 text-desk-teal" : "border-border text-muted-foreground")}
            title="모든 창의 봉 주기를 함께 바꿉니다"
          >
            <Link2 className="size-3.5" /> 주기 동기화
          </button>
        </div>
      </div>
      <PageDisclaimer extra="크로스헤어와 표시 기간은 창끼리 동기화됩니다." />
      <div className={cn("grid gap-2", count === 2 && "md:grid-cols-2", count === 4 && "md:grid-cols-2")}>
        {symbols.map((sym, i) => (
          <Pane
            key={`${i}-${sym}`}
            sym={sym}
            idx={i}
            interval={syncInterval ? shared : own[i]!}
            onInterval={(iv, minutes) => {
              if (syncInterval) setShared(iv); else setOwn(o => o.map((x, j) => j === i ? iv : x));
              if (minutes) void navigate({ search: { ...search, interval: iv, minuteSize: minutes, range: "5d" }, replace: true });
            }}
            onSymbol={(s) => setSymbols(symbols.map((x, j) => (j === i ? s : x)))}
            sync={sync}
            height={height}
            compact={count > 1}
            layoutScope={count === 1 && search.scope === "detail" ? chartLayoutScope("detail") : chartLayoutScope("workspace", i)}
            minuteSize={search.minuteSize}
            selectedRange={(syncInterval ? shared : own[i]) === search.interval ? search.range : undefined}
            discoveryUniverse={search.discoveryUniverse}
            discoveryVersion={search.discoveryVersion}
          />
        ))}
      </div>
    </div>
  );
}
