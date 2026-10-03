import { useRef, type ReactNode } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { downloadCsv, downloadSvgAsPng } from "@/components/charts/core/export";

/**
 * Uniform chrome for non-lightweight charts (F7.17 Tier C): title, units,
 * source / as-of line, accessible label, PNG (SVG rasterized) + CSV export.
 */
export function ChartFrame({
  title,
  unit,
  source,
  asOf,
  ariaLabel,
  csv,
  pngName,
  children,
  testId,
}: {
  title: string;
  unit?: string;
  source: string;
  asOf?: string | null;
  ariaLabel: string;
  /** Returns { text, filename } for CSV export. */
  csv?: () => { text: string; filename: string };
  pngName?: string;
  children: ReactNode;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const exportPng = () => {
    const svg = ref.current?.querySelector("svg");
    if (svg && pngName) downloadSvgAsPng(svg as SVGSVGElement, pngName);
  };
  return (
    <figure className="min-w-0 rounded-lg border border-border" data-testid={testId}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-2.5 py-1.5">
        <span className="text-[12px] font-semibold">
          {title}
          {unit && <span className="ml-1 font-normal text-muted-foreground">({unit})</span>}
        </span>
        <span className="flex items-center gap-0.5">
          {pngName && (
            <button type="button" onClick={exportPng} className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted" aria-label="PNG로 저장" title="PNG로 저장">
              <Download className="size-3.5" />
            </button>
          )}
          {csv && (
            <button
              type="button"
              onClick={() => {
                const c = csv();
                downloadCsv(c.text, c.filename);
              }}
              className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
              aria-label="CSV로 저장"
              title="CSV로 저장"
            >
              <FileSpreadsheet className="size-3.5" />
            </button>
          )}
        </span>
      </figcaption>
      <div ref={ref} role="img" aria-label={ariaLabel}>
        {children}
      </div>
      <p className="border-t border-border px-2.5 py-1 text-[10px] text-muted-foreground">
        출처 {source}
        {asOf ? ` · 기준 ${asOf}` : ""}
      </p>
    </figure>
  );
}
