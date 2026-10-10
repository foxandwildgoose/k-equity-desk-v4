import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as Popover from "@radix-ui/react-popover";
import { Search, X, Layers, Loader2 } from "lucide-react";
import { searchUniverse } from "@/data/stocks";
import { formatPrice } from "@/lib/format";
import { PriceChange } from "@/components/stocks/PriceChange";
import { useQuoteMap, useSecuritySearch } from "@/lib/use-market";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { ListedSearchHit } from "@/lib/security-search";
import {
  currentSearchPages,
  loadRecentSecurities,
  mergeSecuritySearchHits,
  saveRecentSecurity,
  securityIdentity,
  securityMarketLabel,
  securitySearchDestination,
} from "@/lib/security-search-ui";

export function SearchCommand({ className }: { className?: string }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const composingRef = useRef(false);
  const [hi, setHi] = useState(0);
  const [recent, setRecent] = useState<ListedSearchHit[]>([]);
  const nextHighlightRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const navigate = useNavigate();
  const { map } = useQuoteMap();
  const needle = q.trim();

  useEffect(() => {
    if (composing) return;
    const id = window.setTimeout(() => setDebounced(q.trim()), 180);
    return () => window.clearTimeout(id);
  }, [q, composing]);

  const live = useSecuritySearch(debounced, open && !composing);
  const pages = useMemo(() => currentSearchPages(live.data?.pages, needle), [live.data?.pages, needle]);
  const remoteHits = useMemo(() => pages.flatMap((page) => page.hits), [pages]);
  const localHits = useMemo(() => searchUniverse(q).map((stock): ListedSearchHit => ({
    code: stock.code,
    nameKo: stock.nameKo,
    nameEn: stock.nameEn,
    market: stock.market,
    region: "KR",
    sectorId: stock.sectorId,
    isEtf: false,
    source: "universe",
  })), [q]);
  const rows = useMemo(() => needle ? mergeSecuritySearchHits(needle, localHits, remoteHits) : recent, [needle, localHits, remoteHits, recent]);
  const currentQuery = debounced === needle;
  const fetching = Boolean(needle) && (!currentQuery || live.isFetching || live.isPending || composing);
  const response = pages[0];
  const unavailable = Boolean(needle) && currentQuery && !fetching
    && (live.isError || response?.status === "unavailable");
  const partial = Boolean(needle) && response?.status === "partial";
  const total = Math.max(response?.total ?? 0, rows.length);
  const hasMore = currentQuery && pages.length > 0 && live.hasNextPage;

  useEffect(() => { setHi(0); nextHighlightRef.current = null; }, [q]);
  useEffect(() => {
    if (nextHighlightRef.current != null && rows.length > nextHighlightRef.current) {
      setHi(nextHighlightRef.current);
      nextHighlightRef.current = null;
      return;
    }
    setHi((index) => Math.min(index, Math.max(rows.length - 1, 0)));
  }, [rows.length]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-option-index="${hi}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  useEffect(() => {
    if (!open) return;
    try { setRecent(loadRecentSecurities(window.localStorage)); }
    catch { setRecent([]); }
  }, [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !event.isComposing) {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(hit: ListedSearchHit) {
    const destination = securitySearchDestination(hit);
    try { saveRecentSecurity(destination.hit, window.localStorage); }
    catch { /* Browsers may deny even access to the storage object. */ }
    try { window.sessionStorage.setItem("kx-last-security", JSON.stringify(destination.hit)); }
    catch { /* Navigation works independently of recent-search persistence. */ }
    setOpen(false);
    setQ("");
    setDebounced("");
    if (destination.to === "/us/$symbol") void navigate({ to: destination.to, params: destination.params });
    else if (destination.to === "/etfs/$code") void navigate({ to: destination.to, params: destination.params });
    else void navigate({ to: destination.to, params: destination.params });
  }

  const activeId = open && rows[hi] ? `${listId}-${securityIdentity(rows[hi]!).replace(/[^a-z0-9]/gi, "-")}` : undefined;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div ref={wrapRef} className={cn("relative w-full max-w-md", className)}>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(event) => { setQ(event.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onCompositionStart={() => { composingRef.current = true; setComposing(true); }}
            onCompositionEnd={() => { composingRef.current = false; setComposing(false); }}
            onKeyDown={(event) => {
              if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
              if (event.key === "Escape") { setOpen(false); return; }
              if (event.key === "Tab") { setOpen(false); return; }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
                if (open && hi === rows.length - 1 && hasMore && !live.isFetching) {
                  nextHighlightRef.current = rows.length;
                  void live.fetchNextPage();
                } else if (open) setHi((index) => Math.min(index + 1, Math.max(rows.length - 1, 0)));
              } else if (event.key === "ArrowUp" && open) {
                event.preventDefault();
                setHi((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter" && open && rows[hi]) {
                event.preventDefault();
                go(rows[hi]!);
              }
            }}
            placeholder="국내 주식 · ETF · 미국 주식 · 이름/코드 (⌘K)"
            className="h-10 pl-9 pr-9 bg-muted/40 border-border text-sm"
            role="combobox"
            aria-label="종목 검색"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={activeId}
            data-testid="security-search-input"
            autoComplete="off"
            maxLength={80}
          />
          {q && (
            <button
              type="button"
              className="absolute right-0 top-0 flex h-10 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={() => { setQ(""); setDebounced(""); setHi(0); inputRef.current?.focus(); setOpen(true); }}
              aria-label="검색 지우기"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </Popover.Anchor>

      {/* Portal escapes the shell header's overflow clipping; Radix tracks resize/scroll collisions. */}
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="center"
          sideOffset={4}
          collisionPadding={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={() => inputRef.current?.focus()}
          onInteractOutside={(event) => {
            if (wrapRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
          className="z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
          style={{
            width: "var(--radix-popover-trigger-width)",
            minWidth: "min(22rem, calc(100vw - 16px))",
            maxWidth: "calc(100vw - 16px)",
            maxHeight: "min(24rem, var(--radix-popover-content-available-height))",
          }}
          data-testid="security-search-panel"
        >
          <div className="shrink-0 border-b border-border px-3 py-2 text-xs text-muted-foreground" role="status" aria-live="polite">
            {!needle ? "최근 검색" : fetching && rows.length === 0 ? "전체 종목 검색 중" : `${total}건${hasMore ? ` · ${rows.length}건 표시` : ""}`}
            {fetching && rows.length > 0 && <span className="ml-2 inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> 검색 중</span>}
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain scroll-thin py-1">
            <ul ref={listRef} id={listId} role="listbox" aria-label={needle ? "종목 검색 결과" : "최근 검색 종목"} data-testid="security-search-results">
              {rows.map((hit, index) => {
                // The quote map is a domestic snapshot. US tickers never inherit a KRW price.
                const quote = hit.region === "KR" ? map.get(hit.code) : undefined;
                return (
                  <li key={securityIdentity(hit)} role="presentation">
                    <button
                      id={`${listId}-${securityIdentity(hit).replace(/[^a-z0-9]/gi, "-")}`}
                      type="button"
                      role="option"
                      aria-selected={index === hi}
                      tabIndex={-1}
                      data-option-index={index}
                      data-security-key={securityIdentity(hit)}
                      className={cn("flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50", index === hi && "bg-muted/60")}
                      onMouseEnter={() => setHi(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => go(hit)}
                    >
                      {hit.isEtf && <Layers className="size-3.5 shrink-0 text-desk-gold" aria-hidden="true" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{hit.nameKo}</div>
                        <div className="truncate text-xs text-muted-foreground">{hit.code} · {securityMarketLabel(hit)}{hit.isEtf ? " · ETF" : ""}</div>
                      </div>
                      {quote && <div className="shrink-0 text-right"><div className="tabular text-xs font-semibold">{formatPrice(quote.price)}</div><PriceChange change={quote.change} changePct={quote.changePct} size="sm" /></div>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {!rows.length && !fetching && !unavailable && (
              <p className="px-3 py-5 text-center text-xs text-muted-foreground">
                {needle ? "검색 결과 없음 · 종목명 또는 코드를 확인해 주세요." : "국내 주식·ETF·미국 주식의 이름 또는 코드를 입력하세요."}
              </p>
            )}
            {(unavailable || partial) && (
              <div className="border-t border-border px-3 py-3 text-xs text-muted-foreground" role="status">
                <p>{unavailable ? "검색 공급자 연결 실패 · 검색 다시 시도해 주세요." : "일부 검색 공급자 조회 실패 · 현재 확보한 결과입니다."}</p>
                <button type="button" className="mt-2 min-h-9 rounded-md border border-border px-3 text-foreground hover:bg-muted/50" data-testid="security-search-retry" onClick={() => void live.refetch()}>검색 다시 시도</button>
              </div>
            )}
            {hasMore && (
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-border px-3 py-2 text-xs text-primary hover:bg-muted/50"
                disabled={live.isFetching}
                onClick={() => void live.fetchNextPage()}
                data-testid="security-search-more"
                aria-label="검색 결과 더 보기 · 마지막 결과에서 아래 방향키로도 불러올 수 있습니다"
              >
                {live.isFetchingNextPage && <Loader2 className="size-3 animate-spin" />}
                검색 결과 더 보기
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
