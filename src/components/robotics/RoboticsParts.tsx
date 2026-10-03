import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { EyeOff, Plus, RotateCcw } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { FeedList } from "@/components/feed/FeedList";
import { TimeStamp } from "@/components/feed/TimeStamp";
import { useRoboticsCompanyNews } from "@/lib/use-themes";
import { useAppStore } from "@/lib/store";
import { usePriceColors } from "@/lib/store";
import { formatPct, formatPrice } from "@/lib/format";
import { EXPOSURE_LABEL, SEGMENT_LABEL, type RoboticsExposure, type RoboticsSegment } from "@/data/robotics";
import type { RoboticsEtfRow, RoboticsQuoteRow, RoboticsUnresolved } from "@/server/robotics";
import { cn } from "@/lib/utils";

export function KpiTile({ label, value, pct, source, reason, testId }: { label: string; value?: string | null; pct?: number | null; source: string; reason: string; testId?: string }) {
  const colors = usePriceColors();
  const shown = value ?? (pct != null ? formatPct(pct) : null);
  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted/20 p-2" data-kpi={testId}>
      <div className="truncate text-[10px] font-semibold text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 truncate text-base font-semibold tabular", pct != null && pct > 0 && colors.up, pct != null && pct < 0 && colors.down)}>
        {shown ?? "—"}
      </div>
      {shown == null && <div className="truncate text-[10px] text-muted-foreground">{reason}</div>}
      <div className="mt-0.5 truncate text-[9px] text-muted-foreground" title={source}>
        {source}
      </div>
    </div>
  );
}

export function SectionCard({ title, note, children, action, testId }: { title: ReactNode; note?: ReactNode; children: ReactNode; action?: ReactNode; testId?: string }) {
  return (
    <section className="min-w-0 space-y-2 rounded-xl border border-border bg-card p-3" data-testid={testId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[12px] font-semibold">{title}</h3>
        {action}
      </div>
      {note && <p className="text-[10.5px] leading-relaxed text-muted-foreground">{note}</p>}
      {children}
    </section>
  );
}

function priceText(r: { price: number | null; currency?: "KRW" | "USD" }) {
  if (r.price == null) return "—";
  return r.currency === "USD" ? `$${r.price.toFixed(2)}` : `${formatPrice(r.price)}원`;
}

export function MoverList({ rows, market }: { rows: RoboticsQuoteRow[]; market: "KR" | "US" }) {
  const colors = usePriceColors();
  if (!rows.length) return <p className="text-[10.5px] text-muted-foreground">해당 없음 또는 시세 미수신</p>;
  return (
    <ul className="space-y-0.5 text-[11px]">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center justify-between gap-2">
          {market === "KR" ? (
            <Link to="/stock/$ticker" params={{ ticker: r.code }} className="min-w-0 truncate font-medium hover:underline">
              {r.name}
            </Link>
          ) : (
            <Link to="/us/$symbol" params={{ symbol: r.code }} className="min-w-0 truncate font-medium hover:underline">
              {r.code} <span className="font-normal text-muted-foreground">{r.name}</span>
            </Link>
          )}
          <span className={cn("shrink-0 tabular font-semibold", (r.changePct ?? 0) > 0 && colors.up, (r.changePct ?? 0) < 0 && colors.down)}>
            {r.changePct != null ? formatPct(r.changePct) : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** F6.5 company table; row click opens the news drawer (newest first). */
export function CompanyTable({
  rows,
  market,
  latestNews,
  latestResearch,
  metaLoading,
  onOpen,
}: {
  rows: RoboticsQuoteRow[];
  market: "KR" | "US";
  latestNews?: Record<string, string | null>;
  latestResearch?: Record<string, string | null>;
  metaLoading?: boolean;
  onOpen: (r: RoboticsQuoteRow) => void;
}) {
  const colors = usePriceColors();
  const hide = useAppStore((s) => s.hideRoboticsName);
  return (
    <div className="overflow-x-auto scroll-thin rounded-lg border border-border" data-testid={`robotics-companies-${market.toLowerCase()}`}>
      <table className="w-full min-w-[860px] text-[11.5px]">
        <thead className="bg-muted/40 text-[10px] text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 text-left font-semibold">종목</th>
            <th className="px-2 py-1.5 text-left font-semibold">코드</th>
            <th className="px-2 py-1.5 text-left font-semibold">세그먼트</th>
            <th className="px-2 py-1.5 text-left font-semibold">노출</th>
            <th className="px-2 py-1.5 text-right font-semibold">현재가</th>
            <th className="px-2 py-1.5 text-right font-semibold">1D</th>
            <th className="px-2 py-1.5 text-right font-semibold">52주 위치</th>
            <th className="px-2 py-1.5 text-right font-semibold">{market === "KR" ? "시총(억)" : "시총"}</th>
            <th className="px-2 py-1.5 text-left font-semibold">최근 뉴스</th>
            <th className="px-2 py-1.5 text-left font-semibold">{market === "KR" ? "최근 리서치" : "최근 등급 변경"}</th>
            <th className="px-2 py-1.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const news = latestNews?.[r.key];
            const res = latestResearch?.[r.key];
            return (
              <tr
                key={r.key}
                className="cursor-pointer hover:bg-muted/25"
                tabIndex={0}
                onClick={() => onOpen(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpen(r);
                }}
                data-row={r.key}
              >
                <td className="px-2 py-1.5">
                  {market === "KR" ? (
                    <Link to="/stock/$ticker" params={{ ticker: r.code }} onClick={(e) => e.stopPropagation()} className="font-semibold hover:underline">
                      {r.name}
                    </Link>
                  ) : (
                    <Link to="/us/$symbol" params={{ symbol: r.code }} onClick={(e) => e.stopPropagation()} className="font-semibold hover:underline">
                      {r.name}
                    </Link>
                  )}
                  {r.kind === "custom" && <span className="ml-1 rounded bg-muted px-1 text-[9px] text-muted-foreground">추가</span>}
                </td>
                <td className="px-2 py-1.5 tabular text-muted-foreground">{r.code}</td>
                <td className="px-2 py-1.5">{r.segment ? (SEGMENT_LABEL[r.segment as RoboticsSegment] ?? r.segment) : "—"}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{r.exposure ? EXPOSURE_LABEL[r.exposure] : "—"}</td>
                <td className="px-2 py-1.5 text-right tabular font-semibold">{priceText(r)}</td>
                <td className={cn("px-2 py-1.5 text-right tabular font-semibold", (r.changePct ?? 0) > 0 && colors.up, (r.changePct ?? 0) < 0 && colors.down)}>
                  {r.changePct != null ? formatPct(r.changePct) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right tabular" title="52주 저가=0, 고가=100">
                  {r.pos52w != null ? r.pos52w : "—"}
                </td>
                <td className="px-2 py-1.5 text-right tabular text-muted-foreground" title={market === "US" ? "Yahoo 차트 응답에 시가총액이 없어 표시하지 않습니다" : undefined}>
                  {r.marketCap != null ? r.marketCap.toLocaleString("ko-KR") : "—"}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {news ? <TimeStamp publishedAt={news} precision="minute" /> : metaLoading ? "…" : "—"}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {res ? <TimeStamp publishedAt={res} precision="day" /> : metaLoading ? "…" : "—"}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      hide(r.key);
                    }}
                    className="inline-flex min-h-8 items-center gap-0.5 rounded px-1 text-[10px] text-muted-foreground hover:text-foreground"
                    title="이 종목 숨기기 (복원 가능)"
                  >
                    <EyeOff className="size-3" /> 숨김
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CompanyNewsSheet({ target, onClose }: { target: RoboticsQuoteRow | null; onClose: () => void }) {
  const q = useRoboticsCompanyNews(target ? { market: target.market, code: target.code, name: target.market === "US" ? (target.nameEn ?? target.name) : target.name } : null);
  return (
    <Sheet open={target != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto scroll-thin p-0">
        {target && (
          <>
            <SheetHeader className="sticky top-0 z-10 border-b border-border bg-card">
              <SheetTitle className="pr-6 text-base">
                {target.name} <span className="text-sm font-normal text-muted-foreground">{target.code}</span>
              </SheetTitle>
              <SheetDescription>
                {target.market === "KR" ? "네이버 종목 뉴스" : "Google News (영문, 회사명 검색 · 최근 30일)"} · 최신순
              </SheetDescription>
            </SheetHeader>
            <div className="p-3">
              <FeedList
                items={q.data?.items ?? []}
                loading={q.isLoading}
                emptyReason={q.data?.error ? `뉴스를 받지 못했습니다 (${q.data.error}). 데이터를 채워 넣지 않습니다.` : "표시할 기사가 없습니다."}
              />
              <div className="mt-2 text-[11px]">
                {target.market === "KR" ? (
                  <Link to="/stock/$ticker" params={{ ticker: target.code }} className="font-semibold text-primary hover:underline">
                    종목 페이지 →
                  </Link>
                ) : (
                  <Link to="/us/$symbol" params={{ symbol: target.code }} className="font-semibold text-primary hover:underline">
                    미국 종목 페이지 →
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const SEGMENTS = Object.keys(SEGMENT_LABEL) as RoboticsSegment[];

/** User add / restore (F6.1: additions and removals persist in the store). */
export function UniverseEditor({ hidden, unresolved }: { hidden: RoboticsQuoteRow[]; unresolved: RoboticsUnresolved[] }) {
  const add = useAppStore((s) => s.addRoboticsName);
  const restore = useAppStore((s) => s.restoreRoboticsName);
  const removed = useAppStore((s) => s.roboticsCustom.removed);
  const [market, setMarket] = useState<"KR" | "US">("KR");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [segment, setSegment] = useState<RoboticsSegment>("industrial");
  const [exposure, setExposure] = useState<RoboticsExposure>("significant");
  const normalized = market === "KR" ? code.trim().toUpperCase() : code.trim().toUpperCase();
  const valid = market === "KR" ? /^[0-9][0-9A-Z]{5}$/.test(normalized) : /^[A-Z][A-Z0-9.]{0,9}$/.test(normalized);
  const hiddenOrphans = useMemo(() => removed.filter((k) => !hidden.some((h) => h.key === k)), [removed, hidden]);
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/15 p-2.5 text-[11px]" data-testid="robotics-universe-editor">
      <form
        className="flex flex-wrap items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          add({ market, code: normalized, name: name.trim() || normalized, segment, exposure });
          setCode("");
          setName("");
        }}
      >
        <span className="font-semibold text-muted-foreground">종목 추가</span>
        <select value={market} onChange={(e) => setMarket(e.target.value as "KR" | "US")} className="h-9 rounded-md border border-border bg-background px-2" aria-label="시장">
          <option value="KR">한국</option>
          <option value="US">미국</option>
        </select>
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={market === "KR" ? "종목코드 6자리" : "심볼 (예: ABB)"} className="h-9 w-32 text-xs" aria-label="코드" />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 (선택)" className="h-9 w-32 text-xs" aria-label="이름" />
        <select value={segment} onChange={(e) => setSegment(e.target.value as RoboticsSegment)} className="h-9 rounded-md border border-border bg-background px-2" aria-label="세그먼트">
          {SEGMENTS.map((s) => (
            <option key={s} value={s}>
              {SEGMENT_LABEL[s]}
            </option>
          ))}
        </select>
        <select value={exposure} onChange={(e) => setExposure(e.target.value as RoboticsExposure)} className="h-9 rounded-md border border-border bg-background px-2" aria-label="노출">
          {(Object.keys(EXPOSURE_LABEL) as RoboticsExposure[]).map((x) => (
            <option key={x} value={x}>
              {EXPOSURE_LABEL[x]}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!valid} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 font-semibold hover:bg-muted/50 disabled:opacity-40">
          <Plus className="size-3" /> 추가
        </button>
        <span className="text-[10px] text-muted-foreground">추가한 종목도 시세로 확인되지 않으면 숨겨집니다.</span>
      </form>
      {(hidden.length > 0 || hiddenOrphans.length > 0) && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-semibold text-muted-foreground">숨긴 종목</span>
          {hidden.map((h) => (
            <button key={h.key} type="button" onClick={() => restore(h.key)} className="inline-flex min-h-8 items-center gap-1 rounded border border-border px-1.5 hover:bg-muted/50">
              <RotateCcw className="size-3" /> {h.name}
            </button>
          ))}
          {hiddenOrphans.map((k) => (
            <button key={k} type="button" onClick={() => restore(k)} className="inline-flex min-h-8 items-center gap-1 rounded border border-border px-1.5 hover:bg-muted/50">
              <RotateCcw className="size-3" /> {k}
            </button>
          ))}
        </div>
      )}
      {unresolved.length > 0 && (
        <p className="text-[10.5px] text-muted-foreground" data-testid="robotics-unresolved-note">
          확인되지 않은 종목 {unresolved.length}개는 표에서 숨겼습니다(코드·이름을 추정하지 않음).{" "}
          <Link to="/status/sources" className="font-semibold text-primary hover:underline">
            소스 상태에서 목록 보기 →
          </Link>
        </p>
      )}
    </div>
  );
}

export function EtfTable({ rows, market }: { rows: RoboticsEtfRow[]; market: "KR" | "US" }) {
  const colors = usePriceColors();
  return (
    <div className="overflow-x-auto scroll-thin rounded-lg border border-border" data-testid={`robotics-etf-${market.toLowerCase()}`}>
      <table className="w-full min-w-[560px] text-[11.5px]">
        <thead className="bg-muted/40 text-[10px] text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 text-left font-semibold">ETF</th>
            <th className="px-2 py-1.5 text-left font-semibold">코드</th>
            <th className="px-2 py-1.5 text-right font-semibold">현재가</th>
            <th className="px-2 py-1.5 text-right font-semibold">1D</th>
            <th className="px-2 py-1.5 text-right font-semibold">거래량</th>
            <th className="px-2 py-1.5 text-right font-semibold">{market === "KR" ? "시총(억)" : "시총"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((e) => (
            <tr key={e.code} className="hover:bg-muted/25">
              <td className="px-2 py-1.5">
                {e.market === "KR" ? (
                  <Link to="/etfs/$code" params={{ code: e.code }} className="font-semibold hover:underline">
                    {e.name}
                  </Link>
                ) : (
                  <Link to="/us/$symbol" params={{ symbol: e.code }} className="font-semibold hover:underline">
                    {e.name}
                  </Link>
                )}
                {e.issuer && <span className="ml-1 text-[10px] text-muted-foreground">{e.issuer}</span>}
              </td>
              <td className="px-2 py-1.5 tabular text-muted-foreground">{e.code}</td>
              <td className="px-2 py-1.5 text-right tabular font-semibold">{priceText({ price: e.price, currency: e.market === "US" ? "USD" : "KRW" })}</td>
              <td className={cn("px-2 py-1.5 text-right tabular font-semibold", (e.changePct ?? 0) > 0 && colors.up, (e.changePct ?? 0) < 0 && colors.down)}>
                {e.changePct != null ? formatPct(e.changePct) : "—"}
              </td>
              <td className="px-2 py-1.5 text-right tabular text-muted-foreground">{e.volume != null ? e.volume.toLocaleString("ko-KR") : "—"}</td>
              <td className="px-2 py-1.5 text-right tabular text-muted-foreground">{e.marketSum != null ? e.marketSum.toLocaleString("ko-KR") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
