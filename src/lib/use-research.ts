import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getResearchBriefing, getResearchV2, getResearchV2Detail, resolveResearchOriginal } from "@/lib/market-fns";
import type { ResearchReport } from "@/server/naver-market";
import type { ResearchV2Type } from "@/lib/research/naver-v2";
import { annotatePrevTargets } from "@/lib/research/naver-v2";
import { sortReportsNewestFirst } from "@/lib/feed/mappers";

export type ResearchTab = "all" | ResearchV2Type;
export const TAB_TYPES: ResearchV2Type[] = ["company", "industry", "invest", "economy", "debenture", "market"];

type PageResult = Awaited<ReturnType<typeof getResearchV2>>;
type MultiPage = { index: number; pages: PageResult[] };

function dedupeReports(list: ResearchReport[]): ResearchReport[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const k = `${r.v2Type ?? r.category}:${r.researchId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Paged KR research (F2.2/F2.3): one v2 category, or 전체 = every category at
 * the same `index`. Newest first via the kernel; Δ% annotated only from
 * fetched same-broker/same-ticker reports.
 */
export function useResearchList(tab: ResearchTab, opts: { itemCodes?: string[]; size?: number } = {}) {
  const codes = opts.itemCodes?.slice(0, 10);
  const q = useInfiniteQuery({
    queryKey: ["research-v2", tab, codes?.join(",") ?? "", opts.size ?? 20],
    queryFn: async ({ pageParam }): Promise<MultiPage> => {
      const types = tab === "all" ? TAB_TYPES : [tab];
      const pages = await Promise.all(
        types.map((type) => getResearchV2({ data: { type, index: pageParam, size: opts.size ?? 20, itemCodes: type === "company" ? codes : undefined } })),
      );
      return { index: pageParam, pages };
    },
    initialPageParam: 0,
    getNextPageParam: (last) => (last.pages.some((p) => p.hasNext) ? last.index + 1 : undefined),
    staleTime: 3 * 60_000,
    refetchOnWindowFocus: false,
  });
  const all = q.data?.pages ?? [];
  const reports = useMemo(
    () => annotatePrevTargets(sortReportsNewestFirst(dedupeReports(all.flatMap((m) => m.pages.flatMap((p) => p.reports))))),
    [all],
  );
  const first = all[0]?.pages ?? [];
  const totals = first.map((p) => p.totalCount);
  const totalCount = totals.length && totals.every((t) => t != null) ? totals.reduce<number>((s, t) => s + (t ?? 0), 0) : null;
  const paths = [...new Set(first.map((p) => p.path))];
  const errors = first.map((p) => p.error).filter((e): e is string => Boolean(e));
  return { ...q, reports, totalCount, paths, errors };
}

export function useResearchBriefing(opts?: { enabled?: boolean }) {
  return useQuery({ queryKey: ["research-briefing"], queryFn: () => getResearchBriefing(), staleTime: 10 * 60_000, refetchOnWindowFocus: false, enabled: opts?.enabled ?? true });
}

export function useResearchDetail(r: ResearchReport | null) {
  const type = (r?.v2Type ?? (r?.category === "market" ? "invest" : r?.category)) as ResearchV2Type | undefined;
  return useQuery({
    queryKey: ["research-v2-detail", type, r?.researchId, r?.code],
    queryFn: () => getResearchV2Detail({ data: { type: type!, nid: r!.researchId, itemCode: r?.code && /^[0-9A-Z]{6}$/.test(r.code) ? r.code : undefined } }),
    enabled: Boolean(r && type && r.sourceKind !== "hankyung"),
    staleTime: 10 * 60_000,
  });
}

/**
 * F2.6 pre-resolve: for rows that scroll into view (first 12 only), resolve
 * the PDF URL in the background with at most 3 concurrent requests.
 */
export function usePdfPreResolver(limit = 12, concurrency = 3) {
  const [resolved, setResolved] = useState<Map<string, string | null>>(() => new Map());
  const queue = useRef<{ key: string; type: ResearchV2Type; nid: number }[]>([]);
  const active = useRef(0);
  const seen = useRef(new Set<string>());
  const observed = useRef(0);

  const pump = useCallback(() => {
    while (active.current < concurrency && queue.current.length) {
      const job = queue.current.shift()!;
      active.current += 1;
      resolveResearchOriginal({ data: { type: job.type, nid: job.nid } })
        .then((r) => setResolved((m) => new Map(m).set(job.key, r.pdfUrl)))
        .catch(() => setResolved((m) => new Map(m).set(job.key, null)))
        .finally(() => {
          active.current -= 1;
          pump();
        });
    }
  }, [concurrency]);

  const observe = useCallback(
    (el: Element | null, r: ResearchReport) => {
      if (!el || typeof IntersectionObserver === "undefined") return;
      const key = `${r.v2Type ?? r.category}:${r.researchId}`;
      if (r.pdfUrl || seen.current.has(key) || observed.current >= limit || r.sourceKind === "hankyung" || !r.v2Type) return;
      observed.current += 1;
      seen.current.add(key);
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          queue.current.push({ key, type: r.v2Type!, nid: r.researchId });
          pump();
        }
      });
      io.observe(el);
    },
    [limit, pump],
  );

  useEffect(() => () => void (queue.current = []), []);
  return { resolved, observe };
}
