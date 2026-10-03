import { formatItemTime, parseSourceTime } from "@/lib/feed/time";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useUsLinkDesk, useQuoteMap } from "@/lib/use-market";
import {
  US_LINK_PILLARS,
  US_LINKED_NAMES,
  US_LINK_CATEGORY_LABEL,
} from "@/data/us-link";
import { getUniverseItem } from "@/data/stocks";
import { formatPct, formatPrice } from "@/lib/format";
import { usePriceColors } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ReadableProse } from "@/components/ui/ReadableProse";
import {
  Loader2,
  Flag,
  Newspaper,
  Factory,
  ExternalLink,
  Crosshair,
  Landmark,
  RefreshCw,
  Radio,
} from "lucide-react";
import type { UsLiveArticle } from "@/server/us-link-feed";
import { SourceLinks } from "@/components/ui/SourceLinks";

export const Route = createFileRoute("/us-link")({
  component: UsLinkPage,
  head: () => ({
    meta: [{ title: "미국 연계 · 미중 AI 패권 전쟁 · Korea Equity" }],
  }),
});

type Tab =
  | "overview"
  | "ai-race"
  | "policy"
  | "industry"
  | "names"
  | "news";

function fmtTime(raw: string): string {
  const t = parseSourceTime(raw, { zone: "Asia/Seoul" });
  if (!t.iso) return raw ? "날짜 미상" : "상시 링크";
  return formatItemTime({ publishedAt: t.iso, precision: t.precision });
}

function kindLabel(kind: UsLiveArticle["kind"]): string {
  if (kind === "official") return "공식";
  if (kind === "report") return "리포트";
  return "기사";
}

function kindClass(kind: UsLiveArticle["kind"]): string {
  if (kind === "official") return "chip-gold border-0";
  if (kind === "report") return "chip-rose border-0";
  return "chip-teal border-0";
}

function LiveFeedList({
  items,
  empty,
}: {
  items: UsLiveArticle[];
  empty: string;
}) {
  if (!items.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
    );
  }
  return (
    <ul className="divide-y divide-border max-h-[640px] overflow-y-auto scroll-thin">
      {items.map((a) => (
        <li key={a.id} className="py-3.5 first:pt-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Badge className={cn("text-[10px]", kindClass(a.kind))}>
              {kindLabel(a.kind)}
            </Badge>
            <span className="text-xs text-muted-foreground">{a.source}</span>
            <span className="text-xs text-muted-foreground tabular">
              {fmtTime(a.datetime)}
            </span>
          </div>
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-start gap-1.5 text-base font-semibold leading-snug text-pretty hover:underline"
          >
            <span>{a.title}</span>
            <ExternalLink className="size-3.5 shrink-0 mt-1 opacity-50 group-hover:opacity-100" />
          </a>
          {a.summary && (
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/90 line-clamp-3 text-pretty">
              {a.summary}
            </p>
          )}
          {a.deskNote && (
            <p className="mt-2 text-sm leading-relaxed text-desk-gold/95">
              <span className="font-semibold">Desk · </span>
              {a.deskNote}
            </p>
          )}
          {a.relatedCodes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {a.relatedCodes.map((code) => {
                const meta = getUniverseItem(code);
                return (
                  <Link
                    key={code}
                    to="/stock/$ticker"
                    params={{ ticker: code }}
                    className="rounded-md bg-muted px-2 py-1 text-xs font-medium hover:bg-muted/80"
                  >
                    {meta?.nameKo ?? code}
                  </Link>
                );
              })}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              원문 보기 <ExternalLink className="size-3.5" />
            </a>
            {a.pdfUrl && (
              <a
                href={a.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                PDF <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function UsLinkPage() {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } =
    useUsLinkDesk();
  const { map } = useQuoteMap();
  const colors = usePriceColors();
  const [tab, setTab] = useState<Tab>("ai-race");
  const [pillar, setPillar] = useState<string | "all">("all");
  const [activeBrief, setActiveBrief] = useState<string | null>(null);

  const quoteByCode = useMemo(() => {
    const m = new Map(map);
    for (const q of data?.quotes ?? []) m.set(q.code, q);
    return m;
  }, [map, data?.quotes]);

  const names = useMemo(() => {
    const list =
      pillar === "all"
        ? US_LINKED_NAMES
        : US_LINKED_NAMES.filter((n) => n.pillar === pillar);
    return list
      .map((n) => {
        const meta = getUniverseItem(n.code);
        const q = quoteByCode.get(n.code);
        return { ...n, meta, q };
      })
      .sort((a, b) => (b.q?.changePct ?? -999) - (a.q?.changePct ?? -999));
  }, [pillar, quoteByCode]);

  const briefs = data?.briefs ?? [];
  const feeds = data?.feeds;
  const stockNews = data?.news ?? [];

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "개요" },
    {
      id: "ai-race",
      label: "미중 AI 패권 전쟁",
      count: feeds?.aiRace?.length,
    },
    { id: "policy", label: "미국 정책", count: feeds?.policy?.length },
    {
      id: "industry",
      label: "산업 리포트",
      count: feeds?.industry?.length,
    },
    { id: "names", label: "연계 종목" },
    { id: "news", label: "종목 뉴스" },
  ];

  const filteredBriefs = briefs.filter((b) => {
    if (tab === "overview") return true;
    if (tab === "ai-race") return b.category === "ai-race";
    if (tab === "policy") return b.category === "policy";
    if (tab === "industry")
      return b.category === "industry" || b.category === "risk";
    return false;
  });

  const liveItems: UsLiveArticle[] =
    tab === "ai-race"
      ? (feeds?.aiRace ?? [])
      : tab === "policy"
        ? (feeds?.policy ?? [])
        : tab === "industry"
          ? (feeds?.industry ?? [])
          : tab === "overview"
            ? [
                ...(feeds?.aiRace ?? []).slice(0, 6),
                ...(feeds?.policy ?? []).slice(0, 5),
                ...(feeds?.industry ?? []).slice(0, 5),
              ]
            : [];

  const openBrief = briefs.find((b) => b.id === activeBrief);

  return (
    <div className="flex flex-col gap-5">
      <header className="desk-card desk-card-gold p-5 md:p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 size-44 rounded-full bg-desk-gold/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl flex items-center gap-2 text-balance">
              <Flag className="size-6 text-desk-gold" />
              미국 연계 인텔리전스 데스크
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed text-pretty">
              Wall Street 관점: 미국 정책·미중 AI 패권·산업 수요가 한국 공급망
              실적과 멀티플을 결정합니다. 실시간 기사·공식 문서·증권사 리포트를
              클릭해 원문을 확인하고, 연계 종목으로 바로 이동하세요.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className="chip-gold border-0 gap-1">
              <Radio className="size-3" /> Live feeds
            </Badge>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
            >
              <RefreshCw
                className={cn("size-3.5", isFetching && "animate-spin")}
              />
              새로고침
              {dataUpdatedAt > 0 && (
                <span className="text-muted-foreground tabular">
                  {new Date(dataUpdatedAt).toLocaleTimeString("ko-KR")}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium min-h-11",
              tab === t.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count != null && (
              <span className="ml-1 tabular text-muted-foreground text-xs">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Category thesis + live for AI / policy / industry / overview */}
      {(tab === "overview" ||
        tab === "ai-race" ||
        tab === "policy" ||
        tab === "industry") && (
        <div className="grid gap-5 lg:grid-cols-5">
          <section className="lg:col-span-2 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Crosshair className="size-4 text-desk-indigo" />
              {tab === "ai-race"
                ? "패권 전쟁 핵심 관점"
                : tab === "policy"
                  ? "정책 핵심 관점"
                  : tab === "industry"
                    ? "산업 핵심 관점"
                    : "데스크 핵심 관점"}
            </h2>
            <div className="space-y-2.5">
              {filteredBriefs.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() =>
                    setActiveBrief((id) => (id === b.id ? null : b.id))
                  }
                  className={cn(
                    "w-full text-left rounded-xl border border-border p-4 transition-colors hover:bg-muted/30",
                    activeBrief === b.id && "ring-1 ring-primary/40 bg-muted/20",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <Badge variant="outline" className="text-[10px]">
                      {US_LINK_CATEGORY_LABEL[b.category]}
                    </Badge>
                  </div>
                  <h3 className="text-base font-semibold leading-snug text-balance">
                    {b.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/90 line-clamp-3 text-pretty">
                    {b.summary}
                  </p>
                  <p className="mt-2 text-xs text-primary">
                    클릭 → 시장 영향·체크리스트·원문 보기
                  </p>
                </button>
              ))}
            </div>

            {openBrief && (
              <div className="rounded-xl border border-desk-gold/30 bg-card p-4 space-y-3">
                <h3 className="text-base font-semibold leading-snug">
                  {openBrief.title}
                </h3>
                <ReadableProse
                  raw={[
                    openBrief.summary,
                    `Why it matters: ${openBrief.whyItMatters}`,
                    `Market impact: ${openBrief.marketImpact}`,
                  ].join("\n\n")}
                  title="전문가 브리프"
                  className="border-0 p-0 shadow-none ring-0 bg-transparent"
                  collapsedParagraphs={4}
                  showBullets={false}
                  density="compact"
                />
                {"watchItems" in openBrief && openBrief.watchItems?.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold mb-1.5">
                      Watch list
                    </div>
                    <ul className="space-y-1 text-sm text-foreground/90">
                      {openBrief.watchItems.map((w) => (
                        <li key={w} className="flex gap-2">
                          <span className="text-desk-gold">•</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {openBrief.relatedCodes?.map((code) => {
                    const meta = getUniverseItem(code);
                    const q = quoteByCode.get(code);
                    return (
                      <Link
                        key={code}
                        to="/stock/$ticker"
                        params={{ ticker: code }}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-muted/40"
                      >
                        <span className="font-medium">
                          {meta?.nameKo ?? code}
                        </span>
                        {q && (
                          <span
                            className={cn(
                              "ml-1.5 tabular text-xs font-semibold",
                              q.changePct > 0
                                ? colors.up
                                : q.changePct < 0
                                  ? colors.down
                                  : "text-muted-foreground",
                            )}
                          >
                            {formatPct(q.changePct)}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="text-sm font-semibold">원문 · 1차 자료</div>
                  <SourceLinks
                    primaryUrl={openBrief.sourceUrl}
                    primaryLabel="원문 보기 (1차 소스)"
                    more={openBrief.moreSources ?? []}
                    searchQuery={`${openBrief.title} ${openBrief.tags?.join(" ") ?? ""}`}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    출처 표기: {openBrief.source}. 본 관점은 데스크 요약이며 투자 권유가 아닙니다.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="lg:col-span-3 desk-card desk-card-indigo p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Newspaper className="size-4 text-desk-indigo" />
                실시간 기사 · 리포트 · 공식
                {isLoading && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                Google News + 증권사 리서치 + 미국 공식 기관
              </p>
            </div>
            <LiveFeedList
              items={liveItems}
              empty={
                isLoading
                  ? "실시간 피드 수집 중…"
                  : "피드를 불러오지 못했습니다. 새로고침 해 보세요."
              }
            />
          </section>
        </div>
      )}

      {/* Pillars overview */}
      {(tab === "overview" || tab === "names") && (
        <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {US_LINK_PILLARS.map((p) => {
            const codes = US_LINKED_NAMES.filter((n) => n.pillar === p.id);
            const qs = codes
              .map((c) => quoteByCode.get(c.code))
              .filter(Boolean);
            const avg = qs.length
              ? qs.reduce((s, q) => s + (q?.changePct ?? 0), 0) / qs.length
              : 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPillar(p.id);
                  setTab("names");
                }}
                className={cn(
                  "desk-card p-4 text-left transition-colors hover:bg-muted/30",
                  `desk-card-${p.accent}`,
                  pillar === p.id && tab === "names" && "ring-1 ring-primary/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold">{p.nameKo}</span>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular",
                      avg > 0
                        ? colors.up
                        : avg < 0
                          ? colors.down
                          : "text-muted-foreground",
                    )}
                  >
                    {qs.length ? formatPct(avg) : "—"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {p.thesis}
                </p>
                <div
                  className="mt-2"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <SourceLinks
                    primaryUrl={p.sourceUrl}
                    primaryLabel="원문 보기"
                    more={p.moreSources ?? []}
                    searchQuery={p.nameKo + " " + p.nameEn}
                    size="sm"
                  />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {codes.length}종목 · 카드 클릭 시 종목 목록
                </div>
              </button>
            );
          })}
        </section>
      )}

      {(tab === "overview" || tab === "names") && (
        <section className="desk-card desk-card-teal overflow-hidden">
          <div className="border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-1.5">
              <Factory className="size-4 text-desk-teal" />
              미국 연계 종목 시세
            </h2>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setPillar("all")}
                className={cn(
                  "rounded px-2.5 py-1.5 text-xs",
                  pillar === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                전체
              </button>
              {US_LINK_PILLARS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPillar(p.id)}
                  className={cn(
                    "rounded px-2.5 py-1.5 text-xs",
                    pillar === p.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {p.nameKo}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[720px] text-base">
              <thead className="bg-muted/40 text-sm text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3">종목</th>
                  <th className="px-4 py-3">필러</th>
                  <th className="px-4 py-3 text-right">현재가</th>
                  <th className="px-4 py-3 text-right">등락률</th>
                  <th className="px-4 py-3">미국 앵글</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {names.map((n) => {
                  const pct = n.q?.changePct ?? 0;
                  const pillarMeta = US_LINK_PILLARS.find(
                    (p) => p.id === n.pillar,
                  );
                  return (
                    <tr key={n.code} className="hover:bg-muted/25">
                      <td className="px-4 py-3">
                        <Link
                          to="/stock/$ticker"
                          params={{ ticker: n.code }}
                          className="font-semibold hover:underline"
                        >
                          {n.meta?.nameKo ?? n.code}
                        </Link>
                        <div className="text-xs text-muted-foreground tabular">
                          {n.code}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {pillarMeta?.nameKo}
                      </td>
                      <td className="px-4 py-3 text-right tabular font-semibold">
                        {n.q?.price ? formatPrice(n.q.price) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular text-sm font-semibold",
                          pct > 0
                            ? colors.up
                            : pct < 0
                              ? colors.down
                              : "text-muted-foreground",
                        )}
                      >
                        {n.q ? formatPct(pct) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-md leading-relaxed">
                        {n.usAngle}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "news" && (
        <section className="desk-card desk-card-copper p-4 md:p-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Newspaper className="size-4 text-desk-copper" />
            연계 종목 실시간 뉴스
          </h2>
          <ul className="divide-y divide-border max-h-[640px] overflow-y-auto scroll-thin">
            {stockNews.length === 0 && (
              <li className="py-10 text-center text-sm text-muted-foreground">
                {isLoading ? "로딩…" : "뉴스 없음"}
              </li>
            )}
            {stockNews.map((n) => {
              const meta = getUniverseItem(n.code);
              return (
                <li key={`${n.id}-${n.code}`} className="py-3">
                  <a
                    href={n.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-semibold leading-snug hover:underline"
                  >
                    {n.title}
                  </a>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {meta && (
                      <Link
                        to="/stock/$ticker"
                        params={{ ticker: n.code }}
                        className="text-foreground font-medium hover:underline"
                      >
                        {meta.nameKo}
                      </Link>
                    )}
                    <span>{n.source}</span>
                    <span className="tabular">{fmtTime(n.datetime)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <footer className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
        <Landmark className="size-3.5 inline mr-1" />
        공식 소스(BIS, NIST/CHIPS, IRS, Fed, DOE, DoD)와 Google News 검색,
        네이버 금융 증권사 리서치를 병합합니다. 편집 관점(요약)은 투자 권유가
        아니며, 포지션은 원문·공시로 재확인하세요.
        <Link to="/research" className="ml-2 text-primary hover:underline">
          리서치 데스크 →
        </Link>
      </footer>
    </div>
  );
}
