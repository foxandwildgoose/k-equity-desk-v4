import { createFileRoute, Link } from "@tanstack/react-router";
import { useAppStore } from "@/lib/store";
import { getUniverseItem, UNIVERSE, mergeQuote } from "@/data/stocks";
import { StockTable } from "@/components/stocks/StockTable";
import { useMarketQuotes, useQuotesByCodes } from "@/lib/use-market";
import { inferSectorId } from "@/lib/infer-sector";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { KeywordWatchEditor, UsWatchEditor } from "@/components/feed/WatchEditors";

export const Route = createFileRoute("/watchlist")({
  component: WatchlistPage,
  head: () => ({
    meta: [{ title: "관심종목 · Korea Equity Command Center" }],
  }),
});

function WatchlistPage() {
  const watchlist = useAppStore((s) => s.watchlist);
  const add = useAppStore((s) => s.addToWatchlist);
  const { data } = useMarketQuotes();
  const extra = useQuotesByCodes(watchlist);
  const quotes = [...(data?.quotes ?? []), ...(extra.data?.quotes ?? [])];

  const stocks = watchlist
    .map((c) => {
      const q = quotes.find((x) => x.code === c);
      const meta = getUniverseItem(c) ??
        (q
          ? {
              code: q.code,
              nameKo: q.nameKo,
              nameEn: q.nameEn,
              sectorId: q.sectorId,
              market: q.market,
            }
          : {
              code: c,
              nameKo: c,
              nameEn: c,
              sectorId: inferSectorId(c),
              market: "KOSPI" as const,
            });
      return mergeQuote(meta, q);
    })
    .filter(Boolean);

  const suggestions = UNIVERSE.filter((s) => !watchlist.includes(s.code)).slice(
    0,
    6,
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight md:text-2xl">
          <Star className="size-5 text-amber-400 fill-amber-400" />
          관심종목
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          코스피·코스닥 전 종목을 검색해 추가할 수 있습니다. 로컬 저장.
        </p>
      </header>

      {stocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            아직 관심종목이 없습니다. 상단 검색에서 종목을 찾아 별을 누르세요.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((s) => (
              <Button
                key={s.code}
                variant="outline"
                size="sm"
                onClick={() => add(s.code)}
              >
                + {s.nameKo}
              </Button>
            ))}
          </div>
          <div className="mt-4">
            <Link to="/" className="text-xs text-muted-foreground hover:underline">
              대시보드로 돌아가기
            </Link>
          </div>
        </div>
      ) : (
        <StockTable stocks={stocks} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <UsWatchEditor />
        <KeywordWatchEditor />
      </div>
    </div>
  );
}
