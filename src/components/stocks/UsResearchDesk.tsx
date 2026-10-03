import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useStreetUniverse, useUsStreet } from "@/lib/use-market";
import { OriginTierBadge } from "@/components/research/UsResearchKit";
import { TimeStamp } from "@/components/feed/TimeStamp";
import {
  originalUrlForNote,
  safeExternalUrl,
  type UsConsensus,
  type UsHeadline,
  type UsStreetNote,
} from "@/lib/us-street";
import { matchesSearchQuery } from "@/lib/search-match";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ExternalLink, Loader2, Search } from "lucide-react";

type Active =
  | { kind: "note"; note: UsStreetNote }
  | { kind: "headline"; item: UsHeadline }
  | { kind: "consensus"; row: UsConsensus };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "원문";
  }
}

function plain(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\u0026amp;/g, "\u0026")
    .replace(/\u0026quot;/g, '"')
    .replace(/\u0026#39;|\u0026apos;/g, "'")
    .replace(/\u0026nbsp;/g, " ");
}

function Tone({ text }: { text: string }) {
  const buy = /buy|outperform|overweight|상향|매수/i.test(text);
  const sell = /sell|underperform|underweight|하향|매도/i.test(text);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
        buy && "bg-price-up/15 text-price-up",
        sell && "bg-price-down/15 text-price-down",
        !buy && !sell && "bg-amber-500/15 text-amber-400",
      )}
    >
      {text}
    </span>
  );
}

export function UsResearchDesk({
  symbol,
  compact = false,
}: {
  symbol?: string;
  compact?: boolean;
}) {
  const locked = symbol?.trim().toUpperCase() || "";
  const universe = useStreetUniverse();
  const query = useUsStreet(locked || undefined, { symbols: universe });
  const pack = query.data;
  const [ticker, setTicker] = useState(locked || "all");
  const [broker, setBroker] = useState("all");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Active | null>(null);

  const notes = pack?.notes ?? [];
  const headlines = pack?.headlines ?? [];
  const consensus = pack?.consensus ?? [];

  const brokers = useMemo(
    () => [...new Set(notes.map((note) => note.broker).filter(Boolean))].sort(),
    [notes],
  );

  const visibleNotes = useMemo(() => {
    const needle = q.trim();
    return notes
      .filter((note) => (locked ? note.symbol === locked : ticker === "all" || note.symbol === ticker))
      .filter((note) => broker === "all" || note.broker === broker)
      .filter((note) =>
        !needle ||
        matchesSearchQuery(needle, [note.symbol, note.broker, note.action, note.rating, note.summary, note.target ?? ""]),
      );
  }, [notes, locked, ticker, broker, q]);

  const visibleHeads = useMemo(() => {
    const needle = q.trim();
    return headlines.filter((item) => {
      if (locked && item.symbol !== locked) return false;
      if (!locked && ticker !== "all" && item.symbol !== ticker) return false;
      if (!needle) return true;
      return matchesSearchQuery(needle, [item.symbol, item.title, item.source, item.when]);
    });
  }, [headlines, locked, ticker, q]);

  const visibleConsensus = useMemo(() => {
    return consensus.filter((row) => {
      if (locked) return row.symbol === locked;
      return ticker === "all" || row.symbol === ticker;
    });
  }, [consensus, locked, ticker]);

  const noteLimit = compact ? 4 : 40;
  const headLimit = compact ? 3 : 16;

  const activeOriginal =
    active?.kind === "note" ? originalUrlForNote(active.note, headlines) : null;
  const activeHref =
    active?.kind === "note"
      ? safeExternalUrl(activeOriginal?.url)
      : active?.kind === "headline"
        ? safeExternalUrl(active.item.url)
        : active?.kind === "consensus"
          ? safeExternalUrl(active.row.pageUrl)
          : null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {pack?.note ??
          "미국 투자은행 PDF는 고객에게만 배포됩니다. 공개된 등급·목표가·기사만 요약하고, 없는 보고서는 만들지 않습니다."}
      </p>

      {!compact && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/15 p-2.5">
          <div className="flex flex-wrap gap-1">
            {!locked && (
              <FilterChip active={ticker === "all"} onClick={() => setTicker("all")}>
                전체
              </FilterChip>
            )}
            {(locked ? [locked] : universe).map((item) => (
              <FilterChip key={item} active={ticker === item || locked === item} onClick={() => setTicker(item)}>
                {item}
              </FilterChip>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="증권사·등급·종목 검색"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <select
              value={broker}
              onChange={(event) => setBroker(event.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="all">전체 증권사</option>
              {brokers.map((name) => (
                <option key={name} value={name}>
                  {plain(name)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>
          등급 {visibleNotes.length} · 컨센서스 {visibleConsensus.length} · 기사 {visibleHeads.length}
          {query.isFetching && " · 수신 중"}
        </span>
        {compact && (
          <Link to="/research" search={{ market: "us" }} className="font-medium text-primary hover:underline">
            미국 리서치 전체
          </Link>
        )}
      </div>

      {query.isLoading && !pack ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-8 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> 월가 공개 피드 수신 중
        </div>
      ) : query.isError && !pack ? (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-price-down">
          월가 피드를 받지 못했습니다. 등급을 채워 넣지 않습니다.
        </p>
      ) : (
        <div className="space-y-4">
          {visibleConsensus.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold">컨센서스 요약</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {(compact ? visibleConsensus.slice(0, 2) : visibleConsensus).map((row) => (
                  <div key={row.symbol} className="overflow-hidden rounded-lg border border-border bg-card">
                    <button
                      type="button"
                      onClick={() => setActive({ kind: "consensus", row })}
                      className="w-full px-3 py-2.5 text-left hover:bg-muted/35"
                    >
                      <div className="flex items-center gap-1.5">
                        <OriginTierBadge tier="STREET" />
                        <span className="text-xs font-semibold">{row.symbol}</span>
                        <Badge variant="outline" className="text-[10px]">
                          Nasdaq
                        </Badge>
                        {row.mean != null && (
                          <span className="ml-auto text-[11px] font-semibold tabular">${row.mean.toFixed(2)}</span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-foreground/90">{plain(row.summary)}</p>
                    </button>
                    {safeExternalUrl(row.pageUrl) && (
                      <div className="border-t border-border bg-muted/20 px-3 py-1.5">
                        <a
                          href={safeExternalUrl(row.pageUrl)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          Nasdaq 원문 <ExternalLink className="size-3" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold">투자은행 · 월가 등급</h3>
            <ul className="flex flex-col gap-2">
              {visibleNotes.length === 0 ? (
                <li className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                  이 필터에 공개된 등급 변경이 없습니다.
                </li>
              ) : (
                visibleNotes.slice(0, noteLimit).map((note) => {
                  const original = originalUrlForNote(note, headlines);
                  return (
                    <li key={note.id} className="overflow-hidden rounded-lg border border-border bg-card">
                      <button
                        type="button"
                        onClick={() => setActive({ kind: "note", note })}
                        className="w-full px-3 py-3 text-left hover:bg-muted/35"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <OriginTierBadge tier="STREET" />
                          <Badge variant="outline" className="text-[10px]">
                            {note.symbol}
                          </Badge>
                          <span className="text-xs font-medium">{plain(note.broker)}</span>
                          <Tone text={plain(note.actionKo)} />
                          {note.rating && note.rating !== "—" && <Tone text={plain(note.rating)} />}
                          {note.target && (
                            <span className="text-[10px] font-semibold tabular">TP {note.target}</span>
                          )}
                          <Link
                            to="/us/$symbol"
                            params={{ symbol: note.symbol }}
                            onClick={(event) => event.stopPropagation()}
                            className="text-[10px] text-primary hover:underline"
                          >
                            차트
                          </Link>
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            <TimeStamp publishedAt={note.publishedAt} precision={note.precision} tz="ET" withEt />
                          </span>
                        </div>
                        <div className="mt-2 border-l-2 border-foreground/20 pl-2.5">
                          <div className="text-[10px] font-semibold text-muted-foreground">핵심요약</div>
                          <p className="mt-0.5 line-clamp-3 text-[12px] leading-relaxed">{plain(note.summary)}</p>
                        </div>
                      </button>
                      <div className="flex flex-wrap gap-2 border-t border-border bg-muted/20 px-3 py-2">
                        {original.articleUrl && safeExternalUrl(original.articleUrl) ? (
                          <a
                            href={safeExternalUrl(original.articleUrl)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            기사 원문 · {hostOf(original.articleUrl)} <ExternalLink className="size-3" />
                          </a>
                        ) : null}
                        {safeExternalUrl(original.tableUrl) ? (
                          <a
                            href={safeExternalUrl(original.tableUrl)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            등급 원문 · Finviz <ExternalLink className="size-3" />
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setActive({ kind: "note", note })}
                          className="ml-auto inline-flex min-h-8 items-center text-xs text-muted-foreground hover:text-foreground"
                        >
                          상세
                        </button>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          {visibleHeads.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold">기사 원문</h3>
              <ul className="flex flex-col gap-1.5">
                {visibleHeads.slice(0, headLimit).map((item) => {
                  const href = safeExternalUrl(item.url);
                  return (
                    <li key={item.id} className="rounded-lg border border-border bg-card">
                      <button
                        type="button"
                        onClick={() => setActive({ kind: "headline", item })}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/35"
                      >
                        <span className="mt-0.5 flex shrink-0 flex-col items-start gap-1">
                          <OriginTierBadge tier="NEWS" />
                          <Badge variant="outline" className="text-[10px]">
                            {item.symbol}
                          </Badge>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] leading-snug">{plain(item.title)}</span>
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">
                            {href ? hostOf(href) : "원문"} ·{" "}
                            {item.publishedAt ? <TimeStamp publishedAt={item.publishedAt} precision={item.precision} tz="ET" withEt /> : item.when}
                          </span>
                        </span>
                      </button>
                      {href ? (
                        <div className="border-t border-border bg-muted/20 px-3 py-1.5">
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            원문 링크 · {hostOf(href)} <ExternalLink className="size-3" />
                          </a>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      <Sheet open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto p-0">
          {active?.kind === "note" && (
            <>
              <SheetHeader className="sticky top-0 z-10 border-b border-border bg-card">
                <SheetTitle className="pr-6 text-base leading-snug">
                  {active.note.symbol} · {plain(active.note.broker)}
                </SheetTitle>
                <SheetDescription asChild>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span>{active.note.date}</span>
                    <Tone text={plain(active.note.actionKo)} />
                    {active.note.rating !== "—" && <Tone text={plain(active.note.rating)} />}
                  </div>
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  {activeOriginal?.articleUrl && safeExternalUrl(activeOriginal.articleUrl) && (
                    <Button asChild size="sm" className="gap-1.5">
                      <a href={safeExternalUrl(activeOriginal.articleUrl)!} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-3.5" /> 기사 원문 · {hostOf(activeOriginal.articleUrl)}
                      </a>
                    </Button>
                  )}
                  {safeExternalUrl(active.note.pageUrl) && (
                    <Button asChild size="sm" variant={activeOriginal?.articleUrl ? "outline" : "default"} className="gap-1.5">
                      <a href={safeExternalUrl(active.note.pageUrl)!} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-3.5" /> 등급 원문 · Finviz
                      </a>
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border bg-muted/25 p-3">
                    <div className="text-[10px] text-muted-foreground">표시 등급</div>
                    <div className="mt-1 text-sm font-semibold">{plain(active.note.rating)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/25 p-3">
                    <div className="text-[10px] text-muted-foreground">목표가</div>
                    <div className="mt-1 text-sm font-semibold tabular">{active.note.target ?? "이 행에 없음"}</div>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <h3 className="text-[11px] font-semibold">핵심요약</h3>
                  <p className="mt-2 text-sm leading-relaxed">{plain(active.note.summary)}</p>
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  증권사 PDF 원문은 공개되어 있지 않습니다. 위 링크는 등급이 게시된 공개 페이지이거나, 제목에 해당
                  증권사가 들어간 기사입니다.
                </p>
              </div>
            </>
          )}
          {active?.kind === "headline" && (
            <>
              <SheetHeader className="sticky top-0 z-10 border-b border-border bg-card">
                <SheetTitle className="pr-6 text-base leading-snug">{plain(active.item.title)}</SheetTitle>
                <SheetDescription>
                  {active.item.symbol} · {active.item.when}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-3 px-4 py-4">
                {activeHref && (
                  <Button asChild size="sm" className="gap-1.5">
                    <a href={activeHref} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3.5" /> {hostOf(activeHref)} 원문
                    </a>
                  </Button>
                )}
                <p className="text-sm leading-relaxed text-muted-foreground">
                  제목에 등급 변경·목표가·증권사 이름이 들어간 기사만 모았습니다. 본문은 원문 페이지에 있습니다.
                </p>
              </div>
            </>
          )}
          {active?.kind === "consensus" && (
            <>
              <SheetHeader className="sticky top-0 z-10 border-b border-border bg-card">
                <SheetTitle className="pr-6 text-base">{active.row.symbol} 컨센서스</SheetTitle>
                <SheetDescription>Nasdaq 공개 추정치</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 py-4">
                {activeHref && (
                  <Button asChild size="sm" className="gap-1.5">
                    <a href={activeHref} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3.5" /> Nasdaq 애널리스트 원문
                    </a>
                  </Button>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="평균" value={active.row.mean == null ? "—" : `$${active.row.mean.toFixed(2)}`} />
                  <Stat label="하단" value={active.row.low == null ? "—" : `$${active.row.low.toFixed(2)}`} />
                  <Stat label="상단" value={active.row.high == null ? "—" : `$${active.row.high.toFixed(2)}`} />
                </div>
                <p className="text-sm leading-relaxed">{plain(active.row.summary)}</p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/25 p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular">{value}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-8 rounded-md border px-2 py-1 text-[10px] font-medium",
        active
          ? "border-foreground/30 bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
