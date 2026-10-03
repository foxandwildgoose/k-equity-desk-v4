import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { UsResearchDesk } from "@/components/stocks/UsResearchDesk";
import { CompanyOfficial } from "@/components/research/CompanyOfficial";
import { OfficialReportCard } from "@/components/research/OfficialReportCard";
import { useSavedReports } from "@/components/research/saved-reports";
import { Input } from "@/components/ui/input";
import { useUsOfficialPolicy, useUsOfficialUniverse } from "@/lib/use-market";
import {
  formatDay,
  RESEARCH_DISCLAIMER,
  RESEARCH_DISCLAIMER_KO,
  type OfficialReport,
} from "@/lib/us-official-parse";
import { cn } from "@/lib/utils";
import { sortOfficialNewestFirst } from "@/lib/feed/mappers";
import { OriginTierBadge, PublicResearchNote, UsScopeBanner } from "@/components/research/UsResearchKit";
import { PageDisclaimer } from "@/components/feed/PageDisclaimer";

type Period = "7" | "30" | "90" | "all";
const PERIODS: { id: Period; label: string }[] = [
  { id: "7", label: "최근 7일" },
  { id: "30", label: "최근 30일" },
  { id: "90", label: "최근 90일" },
  { id: "all", label: "전체" },
];

/** Period filter (F4.3, default 최근 30일). Undated cards stay (sorted last). */
function inPeriod(r: OfficialReport, period: Period): boolean {
  if (period === "all" || !r.publishedAt) return true;
  const t = Date.parse(r.publishedAt.length === 10 ? `${r.publishedAt}T12:00:00Z` : r.publishedAt);
  return Number.isNaN(t) || t >= Date.now() - Number(period) * 86_400_000;
}

type Chip = "all" | "filings" | "earnings" | "macro" | "industry" | "analyst" | "saved";

const CHIPS: { id: Chip; label: string; ko: string }[] = [
  { id: "all", label: "All", ko: "전체" },
  { id: "filings", label: "Filings", ko: "공시" },
  { id: "earnings", label: "Earnings", ko: "실적" },
  { id: "macro", label: "Policy", ko: "정책" },
  { id: "industry", label: "Industry", ko: "산업" },
  { id: "analyst", label: "Analyst opinion", ko: "의견" },
  { id: "saved", label: "Saved", ko: "저장" },
];

export function ResearchHome({ initialTicker }: { initialTicker?: string }) {
  const policy = useUsOfficialPolicy();
  const universe = useUsOfficialUniverse();
  const saved = useSavedReports();
  const [q, setQ] = useState(initialTicker ?? "");
  const [chip, setChip] = useState<Chip>("all");
  const [lookup, setLookup] = useState(initialTicker?.trim().toUpperCase() ?? "");
  const [period, setPeriod] = useState<Period>("30");
  const within = (list: OfficialReport[]) => sortOfficialNewestFirst(list.filter((r) => inPeriod(r, period)));

  const featured = useMemo(() => {
    const rows: OfficialReport[] = [];
    const push = (r: OfficialReport | null | undefined) => {
      if (!r || rows.some((x) => x.id === r.id)) return;
      rows.push(r);
    };
    for (const r of policy.data?.featured ?? []) push(r);
    push(universe.data?.featuredFiling);
    const earn = (universe.data?.earnings ?? []).find((r) => r.summaryStatus === "document-extract");
    push(earn);
    return sortOfficialNewestFirst(rows).slice(0, 8);
  }, [policy.data, universe.data]);

  const pool = useMemo(() => {
    const rows = [
      ...(policy.data?.macro ?? []),
      ...(policy.data?.industry ?? []),
      ...(universe.data?.filings ?? []),
      ...(universe.data?.earnings ?? []),
    ];
    const seen = new Set<string>();
    return sortOfficialNewestFirst(
      rows.filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      }),
    );
  }, [policy.data, universe.data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pool.filter((r) => {
      if (chip === "filings" && !["10-K", "10-Q", "8-K", "DEF 14A", "4", "13F-HR"].includes(r.kind)) return false;
      if (chip === "earnings" && r.kind !== "earnings-release" && r.badge !== "Earnings 8-K") return false;
      if (chip === "macro" && !["fomc-statement", "fomc-minutes", "fomc-sep", "fomc-press", "fomc-implementation", "beige-book", "bea-release", "bls-series"].includes(r.kind)) {
        return false;
      }
      if (chip === "industry" && r.kind !== "industry") return false;
      if (!needle) return true;
      const blob = [r.title, r.titleKo, r.sourceName, ...r.tickers, ...r.sectors, ...r.bullets].join(" ").toLowerCase();
      return blob.includes(needle);
    });
  }, [pool, q, chip]);

  const showEditorial = chip === "all" && !q.trim();

  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="desk-kicker mb-1.5">US official sources · 공식 원문</p>
        <h1 className="page-title">Research</h1>
        <p className="page-lead">
          Primary filings and policy releases, then the original page in one click. Analyst notes stay in a separate opinion layer.
          원문 제목은 영어입니다.
        </p>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">{RESEARCH_DISCLAIMER}</p>
        <p className="max-w-3xl text-xs text-muted-foreground">{RESEARCH_DISCLAIMER_KO}</p>
        <PageDisclaimer className="mt-1" />
        <p className="mt-2 text-xs tabular text-muted-foreground">
          {policy.data ? `Policy updated ${new Date(policy.data.fetchedAt).toLocaleString("en-US")}` : "Policy not loaded yet"}
          {universe.data ? ` · Filings updated ${new Date(universe.data.fetchedAt).toLocaleString("en-US")}` : ""}
        </p>
      </header>

      <UsScopeBanner />

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          const t = q.trim().toUpperCase();
          if (/^[A-Z][A-Z0-9.]{0,9}$/.test(t)) setLookup(t);
        }}
      >
        <label className="sr-only" htmlFor="research-q">
          Search ticker, company, or keyword
        </label>
        <Input
          id="research-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ticker, company, or keyword (FOMC, revenue)"
          className="sm:max-w-md"
        />
        <button type="submit" className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground">
          Load ticker filings
        </button>
      </form>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report type">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={chip === c.id}
            onClick={() => setChip(c.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              chip === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
            )}
          >
            {c.label}
            <span className="ml-1 text-xs opacity-80">{c.ko}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="기간">
        <span className="text-xs text-muted-foreground">기간</span>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={period === p.id}
            onClick={() => setPeriod(p.id)}
            className={cn("min-h-9 rounded-md border px-2.5 text-xs", period === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-1 text-[11px] text-muted-foreground">모든 목록 최신순 · 날짜 없는 카드는 맨 뒤</span>
      </div>

      {(policy.isLoading || universe.isLoading) && (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Retrieving Federal Reserve, BEA, BLS, and SEC records. Cards appear only after a source responds.
        </p>
      )}
      {[...(policy.data?.errors ?? []), ...(universe.data?.errors ?? [])].map((e) => (
        <p key={e} className="text-sm text-muted-foreground">
          {e}
        </p>
      ))}

      {lookup ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Company lookup · {lookup}</h2>
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setLookup("")}>
              Clear
            </button>
          </div>
          <CompanyOfficial symbol={lookup} />
        </div>
      ) : null}

      {chip === "saved" ? (
        <Section title="Saved reports" ko="이 브라우저에만 저장됩니다. 계정은 없습니다.">
          {saved.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing saved yet. Save a card to keep it in this browser.</p>
          ) : (
            <Grid reports={saved.items} saved={saved} />
          )}
        </Section>
      ) : null}

      {showEditorial ? (
        <>
          <Section title="Featured this week" ko="이번 주 문서. 받아 온 것만 표시합니다.">
            <Grid reports={within(featured)} saved={saved} />
          </Section>
          <Calendar events={policy.data?.calendar ?? []} />
          <Section title="Company filings" ko="NVDA, AAPL, MSFT, AMZN, GOOGL, META의 최근 SEC 제출.">
            <Grid reports={within((universe.data?.filings ?? []).filter((r) => r.kind === "10-Q" || r.kind === "10-K"))} saved={saved} />
          </Section>
          <Section title="Earnings" ko="실적 8-K와, 받아 온 경우 Exhibit 99.">
            <Grid reports={within(universe.data?.earnings ?? [])} saved={saved} />
          </Section>
          <Section title="Macro and policy" ko="연준, BEA, BLS.">
            <Grid reports={within(policy.data?.macro ?? [])} saved={saved} />
          </Section>
          <Section title="Industry" ko="공식 페이지에서 산업이 제목에 있는 자료만.">
            <Grid reports={within(policy.data?.industry ?? [])} saved={saved} />
          </Section>
          <Hubs hubs={policy.data?.hubs ?? []} paid={policy.data?.paidNote} />
          <PublicResearchNote />
        </>
      ) : null}

      {chip === "analyst" || showEditorial ? (
        <section className="rounded-xl border border-desk-slate/40 bg-muted/40 p-3 md:p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-desk-slate">OPINION · Analyst</p>
          <h2 className="mt-1 text-lg font-semibold">Analyst opinion</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Public ratings and headlines only. Sell-side ratings are opinions and have historically skewed toward Buy.
            Bulge-bracket PDFs are not hosted here. 월가 의견이며 공식 공시가 아닙니다.
          </p>
          <div className="mt-3">
            <UsResearchDesk />
          </div>
        </section>
      ) : null}

      {chip !== "all" && chip !== "saved" && chip !== "analyst" ? (
        <Section title="Filtered reports" ko="필터 결과">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No retrieved report matches this filter.</p>
          ) : (
            <Grid reports={within(filtered)} saved={saved} />
          )}
        </Section>
      ) : null}

      {chip === "all" && q.trim() ? (
        <Section title="Search results" ko="불러온 카드 안에서만 찾습니다.">
          <Grid reports={filtered} saved={saved} />
          <p className="text-xs text-muted-foreground">
            For a full filing list, submit the ticker. Or open{" "}
            <Link to="/us/$symbol" params={{ symbol: q.trim().toUpperCase() }} className="underline">
              {q.trim().toUpperCase()}
            </Link>
            .
          </p>
        </Section>
      ) : null}
    </div>
  );
}

function Section({ title, ko, children }: { title: string; ko: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <OriginTierBadge tier="OFFICIAL" /> {title}
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">{ko}</p>
      {children}
    </section>
  );
}

function Grid({
  reports,
  saved,
}: {
  reports: OfficialReport[];
  saved: ReturnType<typeof useSavedReports>;
}) {
  if (!reports.length) {
    return <p className="text-sm text-muted-foreground">Nothing retrieved for this section.</p>;
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {sortOfficialNewestFirst(reports).map((r) => (
        <OfficialReportCard key={r.id} report={r} compact saved={saved.has(r.id)} onToggleSave={saved.toggle} />
      ))}
    </div>
  );
}

function Calendar({ events }: { events: { id: string; iso: string | null; dateLabel: string; timeLabel: string | null; title: string; sourceName: string; url: string | null; kind: "released" | "scheduled" }[] }) {
  const upcoming = events.filter((e) => e.kind === "scheduled");
  const released = events.filter((e) => e.kind === "released").slice(0, 8);
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Economic calendar</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Dates are copied from the Fed and BEA pages that were retrieved. No consensus column — a surprise versus economists is not shown unless that figure was in the source, and it was not.
        예상치는 출처에 없어서 비워 둡니다.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">When</th>
              <th className="py-2 pr-3 font-medium">Event</th>
              <th className="py-2 pr-3 font-medium">Source</th>
              <th className="py-2 font-medium">Original</th>
            </tr>
          </thead>
          <tbody>
            {[...upcoming, ...released].map((e, i) => (
              <tr key={`${e.id}-${i}`} className="border-b border-border/70 align-top">
                <td className="py-2 pr-3 tabular">
                  {e.iso ? formatDay(e.iso) : e.dateLabel}
                  {e.timeLabel ? <span className="block text-xs text-muted-foreground">{e.timeLabel}</span> : null}
                  <span className="block text-xs text-muted-foreground">{e.kind === "scheduled" ? "Scheduled" : "Released"}</span>
                </td>
                <td className="py-2 pr-3">{e.title}</td>
                <td className="py-2 pr-3 text-muted-foreground">{e.sourceName}</td>
                <td className="py-2">
                  {e.url ? (
                    <a className="underline" href={e.url} target="_blank" rel="noopener noreferrer">
                      Open
                    </a>
                  ) : (
                    "Original link unavailable"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Hubs({
  hubs,
  paid,
}: {
  hubs: { id: string; label: string; labelKo: string; url: string | null; note: string }[];
  paid?: string;
}) {
  if (!hubs.length && !paid) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold">Official hubs</h2>
      <p className="mb-3 text-xs text-muted-foreground">링크는 이번 조회에서 확인된 페이지만 엽니다.</p>
      <ul className="grid gap-2 md:grid-cols-2">
        {hubs.map((h) => (
          <li key={h.id} className="rounded-lg border border-border bg-card p-3 text-sm">
            <p className="font-medium">
              {h.label} <span className="font-normal text-muted-foreground">{h.labelKo}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{h.note}</p>
            {h.url ? (
              <a className="mt-2 inline-block text-sm underline" href={h.url} target="_blank" rel="noopener noreferrer">
                View original
              </a>
            ) : (
              <p className="mt-2 text-xs">Original link unavailable</p>
            )}
          </li>
        ))}
      </ul>
      {paid ? <p className="mt-3 text-xs text-muted-foreground">{paid}</p> : null}
    </section>
  );
}
