import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Info } from "lucide-react";
import type { UsStreetPack } from "@/lib/us-street";
import { originalUrlForNote } from "@/lib/us-street";
import { exportFileName, streetMovesCsv, toStreetMove, type StreetAction, type StreetMove } from "@/lib/street-moves";
import { TimeStamp } from "@/components/feed/TimeStamp";
import { usePriceColors } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PUBLIC_RESEARCH } from "@/server/feeds/registry";

/** F4.1 scope banner — exact Korean text. */
export const US_RESEARCH_SCOPE_TEXT =
  "미국 투자은행 리포트 PDF는 고객 전용으로 공개되지 않습니다. 이 화면은 공식 문서(SEC·연준·BEA·BLS), 공개 리서치, 공개된 등급 변경과 관련 기사만 원문으로 연결합니다.";

export function UsScopeBanner() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-desk-gold/40 bg-desk-gold/10 px-3 py-2 text-[12px] leading-relaxed" data-testid="us-scope-banner">
      <Info className="mt-0.5 size-4 shrink-0 text-desk-gold" aria-hidden />
      <p>{US_RESEARCH_SCOPE_TEXT}</p>
    </div>
  );
}

export type OriginTier = "OFFICIAL" | "PUBLIC_RESEARCH" | "STREET" | "NEWS";
const TIER_STYLE: Record<OriginTier, { label: string; cls: string; title: string }> = {
  OFFICIAL: { label: "OFFICIAL", cls: "chip-teal", title: "공식 문서: SEC·연준·BEA·BLS" },
  PUBLIC_RESEARCH: { label: "PUBLIC", cls: "chip-indigo", title: "로그인 없이 공개된 기관 리서치" },
  STREET: { label: "STREET", cls: "chip-gold", title: "공개된 등급·목표가 (Finviz·Nasdaq)" },
  NEWS: { label: "NEWS", cls: "chip-blue", title: "등급 변경 관련 기사" },
};

export function OriginTierBadge({ tier }: { tier: OriginTier }) {
  const t = TIER_STYLE[tier];
  return (
    <span className={cn(t.cls, "text-[9px] tracking-wide")} title={t.title}>
      {t.label}
    </span>
  );
}

/** PUBLIC_RESEARCH tier: shows only entries verified public without login (none yet). */
export function PublicResearchNote() {
  return (
    <div className="rounded-lg border border-dashed border-border p-3 text-[11px] text-muted-foreground">
      <div className="mb-1 flex items-center gap-1.5">
        <OriginTierBadge tier="PUBLIC_RESEARCH" /> 공개 리서치
      </div>
      {PUBLIC_RESEARCH.length === 0
        ? "로그인 없이 공개됨을 검증한 기관 리서치 소스가 아직 없습니다(오프라인 빌드). 검증 후 레지스트리에 추가됩니다."
        : PUBLIC_RESEARCH.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="mr-3 text-primary hover:underline">
              {p.name}
            </a>
          ))}
    </div>
  );
}

const ACTIONS: StreetAction[] = ["Upgrade", "Downgrade", "Initiate", "Reiterate", "PT change", "Other"];
const PERIODS = [
  { id: "7", label: "7일" },
  { id: "30", label: "30일" },
  { id: "90", label: "90일" },
  { id: "all", label: "전체" },
] as const;

export function downloadText(name: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["\uFEFF", text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

/**
 * F4.4 Street Moves: date, ticker, broker, action, rating from→to, PT from→to
 * (+Δ% only when both are in the row), source links; filters for ticker,
 * broker, action, 기간; sticky header; CSV of the visible rows.
 */
export function StreetMovesTable({ pack, lockedTicker }: { pack: UsStreetPack | undefined; lockedTicker?: string }) {
  const colors = usePriceColors();
  const [ticker, setTicker] = useState(lockedTicker ?? "all");
  const [broker, setBroker] = useState("all");
  const [action, setAction] = useState<StreetAction | "all">("all");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("30");
  const moves = useMemo<StreetMove[]>(
    () => (pack?.notes ?? []).map((n) => toStreetMove(n, originalUrlForNote(n, pack?.headlines ?? []).articleUrl)),
    [pack],
  );
  const tickers = useMemo(() => [...new Set(moves.map((m) => m.ticker))].sort(), [moves]);
  const brokers = useMemo(() => [...new Set(moves.map((m) => m.broker))].sort(), [moves]);
  const visible = useMemo(() => {
    const cutoff = period === "all" ? null : Date.now() - Number(period) * 86_400_000;
    return moves.filter((m) => {
      if (ticker !== "all" && m.ticker !== ticker) return false;
      if (broker !== "all" && m.broker !== broker) return false;
      if (action !== "all" && m.action !== action) return false;
      if (cutoff != null) {
        const t = m.publishedAt ? Date.parse(m.publishedAt) : Number.NaN;
        if (Number.isNaN(t) || t < cutoff) return false;
      }
      return true;
    });
  }, [moves, ticker, broker, action, period]);

  return (
    <section className="rounded-xl border border-border bg-card" aria-label="Street Moves" data-testid="street-moves">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h3 className="mr-auto inline-flex items-center gap-1.5 text-[12px] font-semibold">
          <OriginTierBadge tier="STREET" /> Street Moves · 공개 등급·목표가 변경 (최신순)
        </h3>
        {!lockedTicker && (
          <select value={ticker} onChange={(e) => setTicker(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-xs" aria-label="티커">
            <option value="all">전체 티커</option>
            {tickers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <select value={broker} onChange={(e) => setBroker(e.target.value)} className="h-9 max-w-40 rounded-md border border-border bg-background px-2 text-xs" aria-label="증권사">
          <option value="all">전체 증권사</option>
          {brokers.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value as StreetAction | "all")} className="h-9 rounded-md border border-border bg-background px-2 text-xs" aria-label="액션">
          <option value="all">전체 액션</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className="h-9 rounded-md border border-border bg-background px-2 text-xs" aria-label="기간">
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => downloadText(exportFileName(`ked-street-moves${lockedTicker ? `-${lockedTicker}` : ""}`), streetMovesCsv(visible))}
          disabled={!visible.length}
          className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-semibold hover:bg-muted/50 disabled:opacity-40"
          data-testid="street-csv"
        >
          <Download className="size-3.5" /> CSV
        </button>
      </div>
      {visible.length === 0 ? (
        <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
          {moves.length ? "필터에 맞는 등급 변경이 없습니다." : "공개 등급 변경을 받지 못했습니다(소스 미검증일 수 있음). 채워 넣지 않습니다."}
        </p>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[640px] text-[11px]">
            <thead className="sticky top-0 z-[1] bg-muted/95 text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-2 py-1.5 text-left">일자</th>
                <th className="px-2 py-1.5 text-left">티커</th>
                <th className="px-2 py-1.5 text-left">증권사</th>
                <th className="px-2 py-1.5 text-left">액션</th>
                <th className="px-2 py-1.5 text-left">등급</th>
                <th className="px-2 py-1.5 text-right">목표가</th>
                <th className="px-2 py-1.5 text-right">Δ%</th>
                <th className="px-2 py-1.5 text-left">원문</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border" data-street-rows>
              {visible.map((m) => (
                <tr key={m.id} data-published={m.publishedAt ?? ""}>
                  <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                    <TimeStamp publishedAt={m.publishedAt} precision={m.precision} tz="ET" withEt />
                  </td>
                  <td className="px-2 py-1.5 font-semibold">
                    <Link to="/us/$symbol" params={{ symbol: m.ticker }} className="hover:underline">
                      {m.ticker}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5">{m.broker}</td>
                  <td className="px-2 py-1.5">{m.action}</td>
                  <td className="px-2 py-1.5">{m.ratingFrom ? `${m.ratingFrom} → ${m.ratingTo ?? "—"}` : m.ratingTo ?? "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular">
                    {m.ptFrom != null && m.ptTo != null ? `$${m.ptFrom} → $${m.ptTo}` : m.ptTo != null ? `$${m.ptTo}` : "—"}
                  </td>
                  <td className={cn("px-2 py-1.5 text-right tabular", m.ptDeltaPct == null ? "text-muted-foreground" : m.ptDeltaPct > 0 ? colors.up : colors.down)}>
                    {m.ptDeltaPct == null ? "—" : `${m.ptDeltaPct > 0 ? "+" : ""}${m.ptDeltaPct.toFixed(1)}%`}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5">
                    <a href={m.tableUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      Finviz
                    </a>
                    {m.articleUrl && (
                      <a href={m.articleUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary hover:underline">
                        기사
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
