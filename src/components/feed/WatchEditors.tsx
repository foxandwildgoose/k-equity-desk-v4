import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** F3.5: user US watchlist (persisted), used for tagging, scoring and alerts. */
export function UsWatchEditor() {
  const list = useAppStore((s) => s.usWatchlist);
  const add = useAppStore((s) => s.addUsWatch);
  const remove = useAppStore((s) => s.removeUsWatch);
  const [v, setV] = useState("");
  return (
    <section className="rounded-xl border border-border bg-card p-3" aria-label="미국 관심종목">
      <h2 className="text-sm font-semibold">미국 관심종목</h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">뉴스 태깅($TICKER·회사명), 중요도 점수, 알림 필터에 쓰입니다. 브라우저에 저장.</p>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(v);
          setV("");
        }}
      >
        <Input value={v} onChange={(e) => setV(e.target.value.toUpperCase())} placeholder="예: ISRG" className="h-9 max-w-40 text-xs" aria-label="미국 티커 추가" />
        <Button type="submit" size="sm" variant="outline" className="min-h-9">
          추가
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {list.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold">
            <Link to="/us/$symbol" params={{ symbol: s }} className="hover:underline">
              {s}
            </Link>
            <button type="button" onClick={() => remove(s)} aria-label={`${s} 삭제`} className="inline-flex min-h-6 min-w-6 items-center justify-center text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}

/** B0.6c: user keyword watch (persisted) — feeds the importance score and alert filters. */
export function KeywordWatchEditor() {
  const list = useAppStore((s) => s.keywordWatch);
  const add = useAppStore((s) => s.addKeyword);
  const remove = useAppStore((s) => s.removeKeyword);
  const [v, setV] = useState("");
  return (
    <section className="rounded-xl border border-border bg-card p-3" aria-label="키워드 감시">
      <h2 className="text-sm font-semibold">키워드 감시</h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">제목·요약에 키워드가 있으면 중요도 +20, 알림 필터(관심종목·키워드 일치)에 포함됩니다. 2자 이상.</p>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(v);
          setV("");
        }}
      >
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="예: HBM, 휴머노이드, FOMC" className="h-9 max-w-56 text-xs" aria-label="키워드 추가" />
        <Button type="submit" size="sm" variant="outline" className="min-h-9">
          추가
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {list.length === 0 && <span className="text-[11px] text-muted-foreground">등록된 키워드가 없습니다.</span>}
        {list.map((k) => (
          <span key={k} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px]">
            {k}
            <button type="button" onClick={() => remove(k)} aria-label={`${k} 삭제`} className="inline-flex min-h-6 min-w-6 items-center justify-center text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
