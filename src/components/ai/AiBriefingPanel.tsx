import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Languages, Loader2, Sparkles } from "lucide-react";
import { generateAiBriefing, getAiStatus, translateAiHeadlines } from "@/lib/ai-fns";
import { AI_LABEL, MT_LABEL, type AiInputItem } from "@/lib/ai/briefing";
import type { FeedItem } from "@/lib/feed/types";
import { TimeStamp } from "@/components/feed/TimeStamp";

export function useAiStatus() {
  return useQuery({ queryKey: ["ai-status"], queryFn: () => getAiStatus(), staleTime: 5 * 60_000, refetchOnWindowFocus: false });
}

/** On-screen feed items → AI input (title, source snippet unless paywalled, source, time, url, id). */
export function feedToAiItems(items: readonly FeedItem[]): AiInputItem[] {
  return items.slice(0, 30).map((it) => ({
    id: it.id,
    title: it.title,
    snippet: it.paywalled ? undefined : it.snippet,
    source: it.outlet ?? it.sourceName,
    time: it.publishedAt ?? "날짜 미상",
    url: it.url,
  }));
}

/**
 * F9.2 "AI 브리핑 생성": rendered only when the server has the AI layer
 * configured; runs only on click; every bullet links to its cited items.
 */
export function AiBriefingPanel({ items, context }: { items: AiInputItem[]; context: string }) {
  const status = useAiStatus();
  const run = useMutation({ mutationFn: () => generateAiBriefing({ data: { items: items.slice(0, 30), context } }) });
  if (!status.data?.enabled) return null;
  const res = run.data;
  return (
    <section className="space-y-1.5 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2.5 text-[12px]" data-testid="ai-briefing">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-400">
          <Sparkles className="size-3.5" /> AI 브리핑 (선택)
        </span>
        <button
          type="button"
          onClick={() => run.mutate()}
          disabled={run.isPending || items.length < 2}
          className="inline-flex min-h-9 items-center gap-1 rounded-md border border-violet-500/40 px-2 text-[11px] font-semibold hover:bg-violet-500/10 disabled:opacity-50"
          data-testid="ai-briefing-button"
        >
          {run.isPending ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />} AI 브리핑 생성
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        화면의 항목 {Math.min(items.length, 30)}건(제목·출처 발췌·시각·링크)만 보냅니다. 원문·PDF는 보내지 않습니다.
        {"usedToday" in status.data ? ` · 오늘 ${status.data.usedToday}/${status.data.dailyCap}회` : ""}
      </p>
      {run.isError && <p className="text-[11px] text-price-down">AI 요청 실패</p>}
      {res && !res.ok && <p className="text-[11px] text-price-down">{res.error}</p>}
      {res && res.ok && (
        <div className="space-y-1">
          <span className="inline-block rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-400" data-testid="ai-label">
            {AI_LABEL}
          </span>
          <ul className="list-disc space-y-1 pl-4">
            {res.bullets.map((b, i) => (
              <li key={i}>
                {b.text.replace(/\[\d{1,2}\]/g, "").trim()}{" "}
                {b.cites.map((n) => {
                  const it = res.items[n - 1];
                  if (!it) return null;
                  return it.url ? (
                    <a key={n} href={it.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold text-primary hover:underline" title={`${it.source} · ${it.title}`}>
                      [{n}]
                    </a>
                  ) : (
                    <span key={n} className="text-[10px] font-semibold text-muted-foreground" title={`${it.source} · ${it.title}`}>
                      [{n}]
                    </span>
                  );
                })}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground">
            {res.cached ? "캐시(15분) · " : ""}
            생성 <TimeStamp publishedAt={res.generatedAt} precision="second" />
            {res.inputTokens != null ? ` · 토큰 입력 ${res.inputTokens.toLocaleString("ko-KR")} / 출력 ${res.outputTokens?.toLocaleString("ko-KR") ?? "—"}` : ""}
            {res.rejected ? ` · 근거 없는 문장 ${res.rejected}개 제외` : ""}
          </p>
        </div>
      )}
    </section>
  );
}

/** F9.4 optional EN→KO headline translation (labelled 기계 번역). */
export function AiTranslateButton({ items, onResult }: { items: readonly FeedItem[]; onResult: (map: Record<string, string>) => void }) {
  const status = useAiStatus();
  const en = items.filter((i) => i.lang === "en").slice(0, 30);
  const [err, setErr] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: () => translateAiHeadlines({ data: { items: en.map((i) => ({ id: i.id, title: i.title })) } }),
    onSuccess: (r) => (r.ok ? (onResult(r.translations), setErr(null)) : setErr(r.error)),
  });
  if (!status.data?.enabled || !en.length) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={() => run.mutate()} disabled={run.isPending} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-semibold hover:bg-muted disabled:opacity-50" data-testid="ai-translate-button">
        {run.isPending ? <Loader2 className="size-3 animate-spin" /> : <Languages className="size-3" />} 영문 제목 번역 ({MT_LABEL})
      </button>
      {err && <span className="text-[10px] text-price-down">{err}</span>}
    </span>
  );
}
