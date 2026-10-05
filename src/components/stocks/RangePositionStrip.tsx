import { formatPct, formatPrice } from "@/lib/format";
import type { BandCompare, MacdCross, QuantSnapshot, RangePositionStats, RsiDivergence, StreetTape } from "@/lib/chart-indicators";
import { usePriceColors } from "@/lib/store";
import { cn } from "@/lib/utils";

const CELLS: {
  key: keyof Pick<
    RangePositionStats,
    | "fromPeriodLowPct"
    | "fromPeriodHighPct"
    | "fromRecentHighPct"
    | "fromRecentLowPct"
  >;
  label: string;
  sub: "periodLow" | "periodHigh" | "recentHigh" | "recentLow";
  date: "periodLowDate" | "periodHighDate" | "recentHighDate" | "recentLowDate";
  hint: string;
}[] = [
  {
    key: "fromPeriodLowPct",
    label: "저점 대비 상승",
    sub: "periodLow",
    date: "periodLowDate",
    hint: "표시 구간 최저점 대비 현재가 상승률",
  },
  {
    key: "fromPeriodHighPct",
    label: "고점 대비 하락",
    sub: "periodHigh",
    date: "periodHighDate",
    hint: "표시 구간 최고점 대비 현재가 하락률",
  },
  {
    key: "fromRecentHighPct",
    label: "최근 고점 대비 하락",
    sub: "recentHigh",
    date: "recentHighDate",
    hint: "최근 고저 창의 고점 대비 현재가. 가격 차트 기본은 52주, 툴바에서 스윙으로 바꿀 수 있음",
  },
  {
    key: "fromRecentLowPct",
    label: "최근 저점 대비 상승",
    sub: "recentLow",
    date: "recentLowDate",
    hint: "최근 고저 창의 저점 대비 현재가. 가격 차트 기본은 52주",
  },
];

export function RangePositionStrip({
  stats,
  caption,
  compact = false,
  className,
  formatValue,
}: {
  stats: RangePositionStats | null;
  caption?: string;
  compact?: boolean;
  className?: string;
  formatValue?: (n: number) => string;
}) {
  const colors = usePriceColors();
  if (!stats) return null;
  const fmt = formatValue ?? formatPrice;

  return (
    <div className={cn("border-b border-border", className)}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
        {CELLS.map((c) => {
          const pct = stats[c.key];
          const px = stats[c.sub];
          const dt = stats[c.date];
          const label =
            c.key === "fromRecentHighPct" && pct > 0.005
              ? "최근 고점 돌파"
              : c.key === "fromPeriodHighPct" && pct > 0.005
                ? "구간 고점 돌파"
                : c.key === "fromRecentLowPct" && pct < -0.005
                  ? "최근 저점 이탈"
                  : c.key === "fromPeriodLowPct" && pct < -0.005
                    ? "구간 저점 이탈"
                    : c.label;
          const tone =
            pct > 0.005 ? colors.up : pct < -0.005 ? colors.down : "text-muted-foreground";
          return (
            <div
              key={c.key}
              title={c.hint}
              className={cn("bg-card min-w-0", compact ? "px-2.5 py-1.5" : "px-3 py-2")}
            >
              <div className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                {label}
              </div>
              <div
                className={cn(
                  "mt-0.5 font-semibold tabular leading-tight",
                  compact ? "text-sm" : "text-lg",
                  tone,
                )}
              >
                {Number.isFinite(pct) ? formatPct(pct) : "—"}
              </div>
              <div className="mt-0.5 truncate text-[10px] tabular text-muted-foreground">
                {fmt(px)}
                {dt ? ` · ${dt.slice(0, 10)}` : ""}
              </div>
            </div>
          );
        })}
      </div>
      {caption ? (
        <p className="px-3 py-1 text-[10px] text-muted-foreground leading-relaxed">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export function StreetTapeRow({
  tape,
  formatValue,
  fastLabel,
  slowLabel,
  showVolume = false,
  className,
}: {
  tape: StreetTape | null;
  formatValue?: (n: number) => string;
  fastLabel: string;
  slowLabel: string;
  showVolume?: boolean;
  className?: string;
}) {
  const colors = usePriceColors();
  if (!tape) return null;
  const fmt = formatValue ?? formatPrice;
  const cells: { label: string; tone: string; value: string; sub: string }[] = [
    {
      label: "52주 고점 대비 하락",
      tone: tape.offHighPct < -0.005 ? colors.down : "text-muted-foreground",
      value: formatPct(tape.offHighPct),
      sub: `${fmt(tape.high)}${tape.highDate ? ` · ${tape.highDate}` : ""}`,
    },
    {
      label: "52주 저점 대비 상승",
      tone: tape.offLowPct > 0.005 ? colors.up : "text-muted-foreground",
      value: formatPct(tape.offLowPct),
      sub: `${fmt(tape.low)}${tape.lowDate ? ` · ${tape.lowDate}` : ""}`,
    },
    {
      label: "52주 레인지 위치",
      tone: "text-foreground",
      value: `${tape.rangeLocation.toFixed(0)}%`,
      sub: "0 저점 · 100 고점",
    },
    {
      label: `${fastLabel} 이격`,
      tone:
        tape.vsSma50Pct == null
          ? "text-muted-foreground"
          : tape.vsSma50Pct > 0.005
            ? colors.up
            : tape.vsSma50Pct < -0.005
              ? colors.down
              : "text-muted-foreground",
      value: tape.vsSma50Pct == null ? "—" : formatPct(tape.vsSma50Pct),
      sub: tape.sma50 != null ? fmt(tape.sma50) : "50개 미만",
    },
    {
      label: `${slowLabel} 이격`,
      tone:
        tape.vsSma200Pct == null
          ? "text-muted-foreground"
          : tape.vsSma200Pct > 0.005
            ? colors.up
            : tape.vsSma200Pct < -0.005
              ? colors.down
              : "text-muted-foreground",
      value: tape.vsSma200Pct == null ? "—" : formatPct(tape.vsSma200Pct),
      sub: tape.sma200 != null ? fmt(tape.sma200) : "200개 미만",
    },
  ];
  if (showVolume) {
    cells.push({
      label: "상대거래량",
      tone: "text-foreground",
      value: tape.relVolume != null ? `${tape.relVolume.toFixed(2)}×` : "—",
      sub: "직전 20봉 평균 대비",
    });
  }

  return (
    <div className={cn("border-b border-border", className)}>
      <div className={cn("grid grid-cols-2 gap-px bg-border", showVolume ? "lg:grid-cols-6" : "lg:grid-cols-5")}>
        {cells.map((cell) => (
          <div key={cell.label} className="bg-card px-2.5 py-1.5 min-w-0">
            <div className="text-[10px] font-semibold tracking-wide text-muted-foreground">{cell.label}</div>
            <div className={cn("mt-0.5 text-sm font-semibold tabular leading-tight", cell.tone)}>{cell.value}</div>
            <div className="mt-0.5 truncate text-[10px] tabular text-muted-foreground">{cell.sub}</div>
          </div>
        ))}
      </div>
      <p className="px-3 py-1 text-[10px] text-muted-foreground">
        줌과 무관한 고정 창({tape.barsUsed}봉 / 요청 {tape.lookback}). 52주 고점은 월가 데스크의 % off highs.
      </p>
    </div>
  );
}

function numText(n: number | null | undefined, digits = 1, suffix = ""): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}${suffix}`;
}

/** Return, drawdown, and Korean technical readings for the loaded bars. */
export function ChartAnalyticsStrip({
  snap,
  className,
}: {
  snap: QuantSnapshot | null;
  className?: string;
}) {
  const colors = usePriceColors();
  if (!snap) return null;
  const tone = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n)
      ? "text-muted-foreground"
      : n > 0.005
        ? colors.up
        : n < -0.005
          ? colors.down
          : "text-muted-foreground";
  const cells: { label: string; value: string; sub: string; tone: string }[] = [
    {
      label: "구간 수익률",
      value: formatPct(snap.totalReturnPct),
      sub: `${snap.bars}봉`,
      tone: tone(snap.totalReturnPct),
    },
    {
      label: snap.volAnnualized ? "연환산 변동성" : "봉 변동성",
      value: snap.volPct == null ? "—" : `${snap.volPct.toFixed(1)}%`,
      sub: snap.volAnnualized ? "로그수익 표본표준편차" : "분봉은 연환산하지 않음",
      tone: "text-foreground",
    },
    {
      label: "최대 낙폭",
      value: formatPct(snap.maxDrawdownPct),
      sub: "구간 고점 대비 최저",
      tone: colors.down,
    },
    {
      label: "고점 대비 하락",
      value: formatPct(snap.currentDrawdownPct),
      sub: "지금 낙폭",
      tone: tone(snap.currentDrawdownPct),
    },
    {
      label: "저점 대비 상승",
      value: Number.isFinite(snap.fromLowPct) ? formatPct(snap.fromLowPct) : "—",
      sub: "구간 저점 기준",
      tone: tone(snap.fromLowPct),
    },
    {
      label: "종가 백분위",
      value: snap.closePercentile == null ? "—" : `${snap.closePercentile.toFixed(0)}%ile`,
      sub: "이 구간 종가 중 현재 이하",
      tone: "text-foreground",
    },
    {
      label: "이격도 20",
      value: numText(snap.disparity20, 1),
      sub: "100 = 20이평",
      tone: "text-foreground",
    },
    {
      label: "스토캐스틱",
      value:
        snap.stochasticK == null
          ? "—"
          : `${snap.stochasticK.toFixed(0)} / ${snap.stochasticD == null ? "—" : snap.stochasticD.toFixed(0)}`,
      sub: "%K / %D · 14, 3",
      tone: "text-foreground",
    },
    {
      label: "투자심리선",
      value: numText(snap.psych12, 0, "%"),
      sub: "12봉 중 상승 비율",
      tone: "text-foreground",
    },
  ];
  return (
    <div className={cn("border-b border-border", className)}>
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-5">
        {cells.map((cell) => (
          <div key={cell.label} className="bg-card px-2.5 py-1.5 min-w-0">
            <div className="text-[10px] font-semibold tracking-wide text-muted-foreground">{cell.label}</div>
            <div className={cn("mt-0.5 text-sm font-semibold tabular leading-tight", cell.tone)}>{cell.value}</div>
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{cell.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function bbZone(percentB: number | null): string {
  if (percentB == null) return "폭이 0";
  if (percentB > 1) return "상단 밖";
  if (percentB < 0) return "하단 밖";
  if (percentB >= 0.8) return "상단 근접";
  if (percentB <= 0.2) return "하단 근접";
  return "밴드 안";
}

function pctZone(rank: number | null, close: number, p10: number | null, p90: number | null): string {
  if (p90 != null && close > p90) return "P90 위";
  if (p10 != null && close < p10) return "P10 아래";
  if (rank == null) return "표본 부족";
  if (rank >= 90) return "상위 10%";
  if (rank <= 10) return "하위 10%";
  return "중간 분포";
}

/** Bollinger (20, 2σ) against the empirical percentile channel. */
export function BandCompareStrip({
  compare,
  formatValue,
}: {
  compare: BandCompare | null;
  formatValue?: (n: number) => string;
}) {
  if (!compare) return null;
  const fmt = formatValue ?? formatPrice;
  const pctGap =
    compare.p50 != null && compare.p50 > 0 ? (compare.close / compare.p50 - 1) * 100 : null;
  const bbGap =
    compare.bbMid != null && compare.bbMid > 0 ? (compare.close / compare.bbMid - 1) * 100 : null;
  const cells: { label: string; value: string; sub: string }[] = [
    {
      label: "볼린저 %b",
      value: compare.percentB == null ? "—" : compare.percentB.toFixed(2),
      sub: `20봉 · 2σ · ${bbZone(compare.percentB)}`,
    },
    {
      label: "볼린저 폭",
      value: compare.bbWidthPct == null ? "—" : `${compare.bbWidthPct.toFixed(1)}%`,
      sub:
        compare.bbUpper != null && compare.bbLower != null
          ? `${fmt(compare.bbLower)} – ${fmt(compare.bbUpper)}`
          : "상·하단",
    },
    {
      label: "이평 이격",
      value: bbGap == null ? "—" : formatPct(bbGap),
      sub: compare.bbMid != null ? `중심 ${fmt(compare.bbMid)}` : "SMA20",
    },
    {
      label: "종가 백분위 순위",
      value: compare.pctRank == null ? "—" : `${compare.pctRank.toFixed(0)}%ile`,
      sub: `${compare.window}봉 · ${pctZone(compare.pctRank, compare.close, compare.p10, compare.p90)}`,
    },
    {
      label: "P10 · P90",
      value: compare.p10 != null && compare.p90 != null ? `${fmt(compare.p10)} · ${fmt(compare.p90)}` : "—",
      sub: compare.p50 != null ? `중앙 ${fmt(compare.p50)}` : "경험 분포",
    },
    {
      label: "중앙 이격",
      value: pctGap == null ? "—" : formatPct(pctGap),
      sub: "종가 / P50 − 1",
    },
  ];
  return (
    <div className="border-b border-border">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 pt-1.5">
        <div className="text-[10px] font-semibold tracking-wide text-muted-foreground">참고 BB(20,2) × 종가 백분위</div>
        <div className="text-[10px] text-muted-foreground">종가의 가격 분포 순위 · BBW 백분위와 별개</div>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0 bg-card px-2.5 py-1.5">
            <div className="text-[10px] font-semibold tracking-wide text-muted-foreground">{cell.label}</div>
            <div className="mt-0.5 truncate text-sm font-semibold tabular leading-tight">{cell.value}</div>
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{cell.sub}</div>
          </div>
        ))}
      </div>
      <p className="px-3 py-1.5 text-[11px] leading-relaxed text-muted-foreground">{compare.note}</p>
    </div>
  );
}

const DIVERGENCE_TONE: Record<RsiDivergence["kind"], string> = {
  "regular-bullish": "text-desk-teal",
  "hidden-bullish": "text-desk-teal",
  "regular-bearish": "text-desk-rose",
  "hidden-bearish": "text-desk-rose",
};

function divergenceRead(kind: RsiDivergence["kind"]): string {
  if (kind === "hidden-bullish") return "히든 · 가격 저점↑ RSI 저점↓ · 상승 지속";
  if (kind === "hidden-bearish") return "히든 · 가격 고점↓ RSI 고점↑ · 하락 지속";
  if (kind === "regular-bullish") return "정규 · 가격 저점↓ RSI 저점↑ · 반등 후보";
  return "정규 · 가격 고점↑ RSI 고점↓ · 조정 후보";
}

/** Confirmed-pivot RSI divergence, including hidden continuation pairs. */
export function RsiDivergenceStrip({
  items,
  barCount,
  formatValue,
}: {
  items: RsiDivergence[];
  barCount: number;
  formatValue?: (n: number) => string;
}) {
  const fmt = formatValue ?? formatPrice;
  const hidden = items.filter((item) => item.kind.startsWith("hidden"));
  const regular = items.filter((item) => !item.kind.startsWith("hidden"));
  return (
    <div className="border-b border-border px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <div className="text-[10px] font-semibold tracking-wide text-muted-foreground">RSI 다이버전스 · 히든</div>
        <div className="text-[10px] text-muted-foreground">확정 스윙 최근 6쌍 · RSI 14</div>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        히든 상승은 저점이 높아지는데 RSI는 더 낮아진 눌림이고, 히든 하락은 고점이 낮아지는데 RSI는 더 높아진 반등입니다. 정규는 추세가 꺾이는 쪽입니다.
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          최근 확정 스윙에서 정규·히든 다이버전스가 없습니다. 오른쪽 5봉이 지나지 않은 고점·저점은 빼 둡니다.
        </p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {[...hidden, ...regular].map((item) => {
            const ago = Math.max(0, barCount - 1 - item.i2);
            return (
              <li key={`${item.kind}-${item.i1}-${item.i2}`} className="text-[11px] leading-relaxed">
                <span className={cn("font-semibold", DIVERGENCE_TONE[item.kind])}>{item.label}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {divergenceRead(item.kind)} · 가격 {fmt(item.price1)} → {fmt(item.price2)} · RSI{" "}
                  {item.rsi1.toFixed(1)} → {item.rsi2.toFixed(1)} · {ago === 0 ? "마지막 확정 봉" : `${ago}봉 전`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Latest MACD/signal cross inside the lookback. */
export function MacdCrossStrip({
  items,
  barCount,
}: {
  items: MacdCross[];
  barCount: number;
}) {
  const golden = items.find((item) => item.kind === "golden");
  const dead = items.find((item) => item.kind === "dead");
  return (
    <div className="border-b border-border px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <div className="text-[10px] font-semibold tracking-wide text-muted-foreground">MACD 골든크로스</div>
        <div className="text-[10px] text-muted-foreground">12 · 26 · 시그널 9</div>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        MACD선이 시그널을 아래에서 위로 돌파하면 골든크로스, 위에서 아래로 깨면 데드크로스입니다. 0선 아래 골든은 반등, 0선 위 골든은 상승 지속으로 읽습니다.
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">최근 40봉 안에 MACD 크로스가 없습니다.</p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-1">
          {[golden, dead].filter((item): item is MacdCross => item != null).map((item) => {
            const ago = Math.max(0, barCount - 1 - item.index);
            const tone = item.kind === "golden" ? "text-desk-teal" : "text-desk-rose";
            return (
              <li key={item.kind} className="text-[11px] leading-relaxed">
                <span className={cn("font-semibold", tone)}>{item.label}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · MACD {item.macd.toFixed(2)} · 시그널 {item.signal.toFixed(2)} ·{" "}
                  {ago === 0 ? "이번 봉" : `${ago}봉 전`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
