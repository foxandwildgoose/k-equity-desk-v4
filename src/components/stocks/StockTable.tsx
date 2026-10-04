import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { SortDir, SortKey, Stock } from "@/data/types";
import { formatPrice, formatVolume, formatMarketCap } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isEtfTicker } from "@/lib/infer-sector";
import { PriceChange, PriceValue } from "./PriceChange";
import { Sparkline } from "./Sparkline";
import { WatchButton } from "./WatchButton";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="size-3 opacity-40" />;
  return dir === "asc" ? (
    <ArrowUp className="size-3" />
  ) : (
    <ArrowDown className="size-3" />
  );
}

export function StockTable({
  stocks,
  compact = false,
}: {
  stocks: Stock[];
  compact?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("changePct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const list = [...stocks];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.nameKo.localeCompare(b.nameKo, "ko");
          break;
        case "price":
          cmp = a.price - b.price;
          break;
        case "changePct":
          cmp = a.changePct - b.changePct;
          break;
        case "volume":
          cmp = a.volume - b.volume;
          break;
        case "marketCap":
          cmp = a.marketCap - b.marketCap;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [stocks, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const th =
    "px-2 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

  return (
    <div className="desk-card overflow-x-auto scroll-thin">
      <table className="desk-table min-w-[640px]">
        <thead className="bg-muted/40">
          <tr className="border-b border-border">
            <th className={cn(th, "w-8 pl-2")} />
            <th className={th}>
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-foreground"
                onClick={() => toggleSort("name")}
              >
                종목 <SortIcon active={sortKey === "name"} dir={sortDir} />
              </button>
            </th>
            <th className={cn(th, "text-right")}>
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-foreground"
                onClick={() => toggleSort("price")}
              >
                현재가 <SortIcon active={sortKey === "price"} dir={sortDir} />
              </button>
            </th>
            <th className={cn(th, "text-right")}>
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-foreground"
                onClick={() => toggleSort("changePct")}
              >
                등락 <SortIcon active={sortKey === "changePct"} dir={sortDir} />
              </button>
            </th>
            {!compact && (
              <>
                <th className={cn(th, "hidden md:table-cell text-center")}>
                  추이
                </th>
                <th className={cn(th, "text-right hidden lg:table-cell")}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("volume")}
                  >
                    거래량{" "}
                    <SortIcon active={sortKey === "volume"} dir={sortDir} />
                  </button>
                </th>
                <th className={cn(th, "text-right hidden lg:table-cell")}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("marketCap")}
                  >
                    시총{" "}
                    <SortIcon active={sortKey === "marketCap"} dir={sortDir} />
                  </button>
                </th>
              </>
            )}
            <th className={cn(th, "text-right pr-3")}>시장</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((st) => (
            <tr
              key={st.code}
              className="border-b border-border/70 last:border-0 hover:bg-muted/30 transition-colors"
            >
              <td className="pl-1 py-1.5">
                <WatchButton code={st.code} />
              </td>
              <td className="px-2 py-1.5">
                <SecurityLink code={st.code} nameKo={st.nameKo} className="group flex flex-col min-w-0">
                  <span className="font-medium text-foreground group-hover:underline truncate">
                    {st.nameKo}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular">
                    {st.code} · {st.nameEn}
                  </span>
                </SecurityLink>
              </td>
              <td className="px-2 py-1.5 text-right">
                {st.price > 0 ? (
                  <PriceValue
                    value={st.price}
                    changePct={st.changePct}
                    size="sm"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right">
                {st.price > 0 ? (
                  <PriceChange change={st.change} changePct={st.changePct} />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              {!compact && (
                <>
                  <td className="px-2 py-1.5 hidden md:table-cell">
                    <div className="flex justify-center">
                      {st.sparkline.length > 1 ? (
                        <Sparkline
                          code={st.code}
                          data={st.sparkline}
                          changePct={st.changePct}
                          label={`${st.nameKo} 최근 ${st.sparkline.length}개 시세 추이 (네이버 시세)`}
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          —
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs tabular text-muted-foreground hidden lg:table-cell">
                    {st.volume ? formatVolume(st.volume) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs tabular text-muted-foreground hidden lg:table-cell">
                    {st.marketCap ? formatMarketCap(st.marketCap) : "—"}
                  </td>
                </>
              )}
              <td className="px-2 py-1.5 pr-3 text-right">
                <Badge variant="market">{st.market}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SecurityLink({
  code,
  nameKo,
  className,
  children,
}: {
  code: string;
  nameKo?: string;
  className?: string;
  children: ReactNode;
}) {
  if (isEtfTicker(code, nameKo)) {
    return (
      <Link to="/etfs/$code" params={{ code }} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link to="/stock/$ticker" params={{ ticker: code }} className={className}>
      {children}
    </Link>
  );
}

export function StockMiniRow({ stock }: { stock: Stock }) {
  return (
    <SecurityLink
      code={stock.code}
      nameKo={stock.nameKo}
      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{stock.nameKo}</div>
        <div className="text-[11px] text-muted-foreground tabular">
          {stock.code}
        </div>
      </div>
      <div className="text-right shrink-0">
        <PriceValue
          value={stock.price}
          changePct={stock.changePct}
          size="sm"
        />
        <PriceChange
          change={stock.change}
          changePct={stock.changePct}
          size="sm"
        />
      </div>
    </SecurityLink>
  );
}
