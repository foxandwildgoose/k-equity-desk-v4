import { Link } from "@tanstack/react-router";
import { ExternalLink, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  badgeTone,
  formatDay,
  type OfficialReport,
} from "@/lib/us-official-parse";
import { cn } from "@/lib/utils";

export function OriginalLink({
  url,
  label = "View original report",
  className,
}: {
  url: string | null;
  label?: string;
  className?: string;
}) {
  if (!url) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Original link unavailable</p>;
  }
  return (
    <Button asChild variant="default" size="sm" className={className}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        {label}
        <ExternalLink />
        <span className="sr-only">opens in a new tab</span>
      </a>
    </Button>
  );
}

export function OfficialReportCard({
  report,
  saved,
  onToggleSave,
  compact = false,
}: {
  report: OfficialReport;
  saved?: boolean;
  onToggleSave?: (report: OfficialReport) => void;
  compact?: boolean;
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", badgeTone(report.kind))}>
          {report.badge}
          <span className="ml-1 font-normal opacity-80">{report.badgeKo}</span>
        </span>
        <span className="text-xs text-muted-foreground">{report.sourceClass === "official" ? "FACT" : report.sourceClass}</span>
        <time className="text-xs tabular text-muted-foreground" dateTime={report.publishedAt ?? undefined}>
          {formatDay(report.publishedAt)}
        </time>
      </div>
      <h3 className="mt-2 text-base font-semibold leading-snug tracking-tight">
        <Link
          to="/us-research/$reportId"
          params={{ reportId: report.id }}
          className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {report.title}
        </Link>
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{report.titleKo}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {report.sourceName}
        {report.tickers.length ? ` · ${report.tickers.join(", ")}` : ""}
        {report.sectors.length ? ` · ${report.sectors.join(", ")}` : ""}
      </p>
      {report.summaryLabel ? (
        <p className="mt-3 text-xs text-desk-gold">{report.summaryLabel}</p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Summary not retrieved.</p>
      )}
      {report.bottomLine ? <p className="mt-2 text-sm leading-relaxed">{report.bottomLine}</p> : null}
      {report.bullets.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-foreground/90">
          {(compact ? report.bullets.slice(0, 4) : report.bullets).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No extract is shown. Open the original document rather than relying on a generated summary.
        </p>
      )}
      {!compact && report.keyFigures.length > 0 ? <KeyFigureTable figures={report.keyFigures} /> : null}
      {!compact && report.whatChanged ? (
        <p className="mt-3 text-sm leading-relaxed">
          <span className="font-medium">What changed. </span>
          {report.whatChanged}
        </p>
      ) : null}
      {!compact && report.risks.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Risks in the extract</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
            {report.risks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {!compact && report.implications ? (
        <p className="mt-3 text-sm text-muted-foreground">{report.implications}</p>
      ) : null}
      {!compact && report.nextWatch ? (
        <p className="mt-2 text-sm">
          <span className="font-medium">Next watch. </span>
          {report.nextWatch}
        </p>
      ) : null}
      {!compact && report.notes.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {report.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <OriginalLink url={report.url} label={report.badge === "Earnings release" ? "Exhibit 99 원문" : "원문"} />
        {report.pdfUrl ? <OriginalLink url={report.pdfUrl} label="PDF" /> : null}
        {report.indexUrl ? <OriginalLink url={report.indexUrl} label="Filing index" /> : null}
        {onToggleSave ? (
          <Button
            type="button"
            variant={saved ? "secondary" : "outline"}
            size="sm"
            onClick={() => onToggleSave(report)}
            aria-pressed={saved}
          >
            <Star className={saved ? "fill-current" : undefined} />
            {saved ? "Saved" : "Save"}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function KeyFigureTable({ figures }: { figures: OfficialReport["keyFigures"] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
        <caption className="sr-only">Key figures from the retrieved source</caption>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-1.5 pr-3 font-medium">Metric</th>
            <th className="py-1.5 pr-3 font-medium">Period</th>
            <th className="py-1.5 pr-3 font-medium tabular">Actual</th>
            <th className="py-1.5 pr-3 font-medium">Prior</th>
            <th className="py-1.5 font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {figures.map((f) => (
            <tr key={`${f.metric}-${f.period}`} className="border-b border-border/70 align-top">
              <td className="py-1.5 pr-3">{f.metric}</td>
              <td className="py-1.5 pr-3">{f.period}</td>
              <td className="py-1.5 pr-3 tabular">{f.actual}</td>
              <td className="py-1.5 pr-3">{f.prior ?? "—"}</td>
              <td className="py-1.5">{f.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
