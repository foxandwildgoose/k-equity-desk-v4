import { ExternalLink, Sparkles } from "lucide-react";
import { useNaverAiBriefing } from "@/lib/use-feed";
import { TimeStamp } from "@/components/feed/TimeStamp";

/**
 * F1.5: Naver Pay's own AI market briefing, attributed and linked. This is a
 * third-party AI text shown as provided — clearly labeled, never mixed with
 * the app's deterministic digest.
 */
export function NaverAiBriefingCard() {
  const q = useNaverAiBriefing();
  const cur = q.data?.current;
  const list = (q.data?.list ?? []).filter((b) => b.id !== cur?.id).slice(0, 4);
  return (
    <section className="rounded-lg border border-border bg-muted/15 p-3" aria-label="네이버페이 증권 AI 시장 브리핑">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1 text-[11px] font-semibold">
          <Sparkles className="size-3.5 text-desk-indigo" /> 네이버페이 증권 AI 시장 브리핑
        </h3>
        <a
          href="https://stock.naver.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-8 items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
        >
          원문 <ExternalLink className="size-3" />
        </a>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">제3자(네이버) AI 생성 요약 · 원문 확인 필요 · 이 앱이 작성하지 않았습니다</p>
      {q.isLoading ? (
        <p className="mt-2 text-[11px] text-muted-foreground">불러오는 중…</p>
      ) : !cur && !list.length ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          브리핑을 받지 못했습니다{q.data?.error ? ` (${q.data.error})` : ""}. 소스 미검증 상태일 수 있습니다.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {cur && (
            <div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                <TimeStamp publishedAt={cur.publishedAt} precision={cur.precision} />
              </div>
              <div className="text-[12px] font-semibold leading-snug">{cur.title}</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-foreground/90">
                {cur.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          {list.length > 0 && (
            <ul className="space-y-1 border-t border-border pt-2">
              {list.map((b) => (
                <li key={b.id} className="flex gap-2 text-[11px]">
                  <TimeStamp publishedAt={b.publishedAt} precision={b.precision} className="text-[10px] text-muted-foreground" />
                  <span className="min-w-0 truncate">{b.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
