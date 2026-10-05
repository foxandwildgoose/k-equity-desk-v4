import { useState, type ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { applyBollingerPreset, BOLLINGER_CUSTOM_COLOR_DEFAULT, BOLLINGER_PRESETS, sanitizeBollingerSettings } from "@/lib/bollinger/config";
import { BOLLINGER_SIGNAL_LABELS } from "@/lib/bollinger/alerts";
import type { BollingerPoint, BollingerSignal, BollingerSystemSettings, BollingerSetup, TrendRegime, VolatilityRegime } from "@/lib/bollinger/types";
import type { ChartInterval, MinuteSize } from "@/server/naver-market";

const fieldClass = "min-h-11 w-full min-w-0 rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelClass = "flex min-w-0 flex-col gap-1 text-xs text-muted-foreground";

const trendLabels: Record<TrendRegime, string> = { "strong-bullish": "강한 상승", bullish: "상승", neutral: "중립·혼조", bearish: "하락", "strong-bearish": "강한 하락" };
const volatilityLabels: Record<VolatilityRegime, string> = { "extreme-squeeze": "극단 스퀴즈 · 방향 중립", squeeze: "스퀴즈 · 방향 중립", compression: "변동성 압축", normal: "일반 변동성", expansion: "변동성 확장" };
const setupLabels: Record<BollingerSetup, string> = {
  squeeze: "스퀴즈 · 돌파 대기", "pre-breakout": "돌파 준비", "bull-breakout": "상승 종가 돌파", "bear-breakdown": "하락 종가 이탈",
  "upper-band-walk": "상단 밴드 워크", "lower-band-walk": "하단 밴드 워크", pullback: "추세 내 되돌림", "failed-breakout": "돌파 실패", "mean-reversion-watch": "평균 회귀 관찰", mixed: "혼조 · 뚜렷한 우위 없음",
};
const number = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);

function Toggle({ checked, onChange, children, testId, disabled = false }: { checked: boolean; onChange: (next: boolean) => void; children: ReactNode; testId?: string; disabled?: boolean }) {
  return <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-foreground"><input type="checkbox" className="size-4 shrink-0 accent-primary" checked={checked} disabled={disabled} data-testid={testId} onChange={event => onChange(event.target.checked)} />{children}</label>;
}

function Methodology() {
  return <details className="rounded-md border border-border p-3 text-xs leading-relaxed text-muted-foreground">
    <summary className="cursor-pointer font-medium text-foreground">계산 방법과 해석</summary>
    <div className="mt-2 space-y-2">
      <p>볼린저 밴드는 상대적인 가격 위치와 변동성을 나타냅니다. 밴드 접촉은 자동 매수·매도 신호가 아니며, 스퀴즈는 방향을 정하지 않는 변동성 압축입니다.</p>
      <p>밴드 중심은 선택한 가격 소스의 SMA, 경계는 모집단 표준편차의 배수입니다. %B = (종가 − 하단) / (상단 − 하단), BBW = (상단 − 하단) / 중심 × 100입니다.</p>
      <p>BBW 백분위는 유효한 과거 BBW 분포의 동률 보정 순위입니다. 종가의 가격 백분위와 다릅니다. 돌파는 완성된 봉의 종가로 확인하고, 피벗은 오른쪽 확인 봉 이후에만 신호로 사용합니다.</p>
      <p>Setup Quality는 이 앱의 규칙 기반 점수이며 수익률·성공 확률이 아닙니다. 제공되지 않은 항목은 가용 점수와 데이터 커버리지에서 제외합니다.</p>
      <p>20/2와 RSI14는 일반 관례이며, 스퀴즈·밴드 워크·패턴 임계값과 가중치는 앱의 설정 가능한 휴리스틱입니다. Fidelity 이름의 프리셋은 기간·배수 조합을 설명하며 독점 공식을 주장하지 않습니다.</p>
    </div>
  </details>;
}

export function BollingerControls({ settings, onChange, disabled = false, portalContainer, onTimeframe }: {
  settings: BollingerSystemSettings;
  onChange: (next: BollingerSystemSettings) => void;
  disabled?: boolean;
  portalContainer?: HTMLElement;
  onTimeframe?: (interval: ChartInterval, minuteSize?: MinuteSize) => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<BollingerSystemSettings>) => onChange(sanitizeBollingerSettings({ ...settings, ...patch }));
  const preset = BOLLINGER_PRESETS.find(item => item.period === settings.period && item.mult === settings.mult)?.id ?? "custom";
  const timeframeChoices: { label: string; interval: ChartInterval; size?: MinuteSize }[] = settings.mode === "trading"
    ? [{ label: "5m", interval: "minute", size: 5 }, { label: "15m", interval: "minute", size: 15 }, { label: "1h", interval: "minute", size: 60 }, { label: "1D", interval: "day" }]
    : [{ label: "1D", interval: "day" }, { label: "1W", interval: "week" }];
  const numeric = (key: keyof BollingerSystemSettings, title: string, min: number, max: number, step: number = 1) => <label className={labelClass} key={key}>{title}<Input type="number" className={fieldClass} min={min} max={max} step={step} value={String(settings[key])} data-testid={`bollinger-field-${key}`} onChange={event => { if (event.target.value !== "" && Number.isFinite(Number(event.target.value))) set({ [key]: Number(event.target.value) }); }} /></label>;
  return <div className="flex min-w-0 flex-wrap items-center gap-1" role="group" aria-label="볼린저 시스템" data-testid="bollinger-controls">
    <Button type="button" size="sm" variant={settings.enabled ? "secondary" : "ghost"} disabled={disabled} aria-pressed={settings.enabled} data-testid="bollinger-master" onClick={() => set({ enabled: !settings.enabled })} className="min-h-11 md:min-h-8" title="시스템 표시와 신규 로컬 알림 평가를 함께 전환합니다. 개별 설정은 유지됩니다.">Bollinger {settings.enabled ? "ON" : "OFF"}</Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button type="button" size="sm" variant="outline" disabled={disabled} data-testid="bollinger-settings" aria-label="볼린저 시스템 설정" className="min-h-11 md:min-h-8"><Settings2 className="size-3.5" />볼린저 설정</Button></SheetTrigger>
      <SheetContent portalContainer={portalContainer} className="overflow-y-auto" data-testid="bollinger-settings-panel">
        <SheetHeader><SheetTitle>볼린저 시스템 설정</SheetTitle><SheetDescription>현재 종목·주기·레이아웃에 저장합니다. 시간축 확대·축소나 모드 전환으로 계산 파라미터를 바꾸지 않습니다.</SheetDescription></SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <fieldset className="space-y-2"><legend className="text-sm font-semibold">표시와 알림</legend>
            <div className="grid grid-cols-2 gap-x-3">{([ ["overlay", "밴드·음영"], ["percentB", "%B 패널"], ["bandwidth", "BBW 패널"], ["status", "상태 요약"], ["badges", "패턴 배지"], ["score", "Setup Quality"], ["alerts", "로컬 볼린저 알림"] ] as const).map(([key, title]) => <Toggle key={key} checked={settings[key]} testId={`bollinger-child-${key}`} onChange={next => set({ [key]: next })}>{title}</Toggle>)}</div>
            <label className={labelClass}>보조 패널 펼침<select className={fieldClass} value={settings.panesExpanded == null ? "auto" : settings.panesExpanded ? "open" : "closed"} data-testid="bollinger-panes" onChange={event => set({ panesExpanded: event.target.value === "auto" ? null : event.target.value === "open" })}><option value="auto">화면에 따라 자동 · 모바일/분할은 접기</option><option value="open">펼침</option><option value="closed">접기</option></select></label>
            <div className="grid grid-cols-2 gap-3">{(["percentB", "bandwidth"] as const).map(key => <label key={key} className={labelClass}>{key === "percentB" ? "%B" : "BBW"} 패널 높이 비중<Input type="number" min={34} max={600} value={settings.paneHeights?.[key] ?? 100} className={fieldClass} onChange={event => { if (event.target.value !== "" && Number.isFinite(Number(event.target.value))) set({ paneHeights: { percentB: settings.paneHeights?.percentB ?? 100, bandwidth: settings.paneHeights?.bandwidth ?? 100, [key]: Number(event.target.value) } }); }} /></label>)}</div>
            <label className={labelClass}>중심선<select className={fieldClass} value={settings.middle} onChange={event => set({ middle: event.target.value as BollingerSystemSettings["middle"] })}><option value="auto">자동 · 같은 SMA20과 중복 방지</option><option value="on">표시</option><option value="off">숨김</option></select></label>
            <label className={labelClass}>경계 색상<select className={fieldClass} value={settings.overlayColor ? "custom" : "auto"} onChange={event => set({ overlayColor: event.target.value === "auto" ? undefined : settings.overlayColor ?? BOLLINGER_CUSTOM_COLOR_DEFAULT })}><option value="auto">테마 자동</option><option value="custom">사용자 지정</option></select></label>
            {settings.overlayColor && <label className={labelClass}>사용자 지정 색<input type="color" value={settings.overlayColor} className={fieldClass} onChange={event => set({ overlayColor: event.target.value })} /></label>}
            <p className="text-xs leading-relaxed text-muted-foreground">배지는 기존 ‘분석 신호’ 표시도 켜져 있을 때 나타납니다. 알림은 열린 화면에서만 평가하며 앱 종료 후 백그라운드 알림을 보장하지 않습니다.</p>
          </fieldset>
          <fieldset className="space-y-3 border-t border-border pt-3"><legend className="text-sm font-semibold">밴드 계산</legend>
            <label className={labelClass}>프리셋<select className={fieldClass} data-testid="bollinger-preset" value={preset} onChange={event => onChange(applyBollingerPreset(settings, event.target.value))}>{BOLLINGER_PRESETS.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}<option value="custom">사용자 지정</option></select></label>
            <div className="grid grid-cols-2 gap-3">{numeric("period", "기간 · 현재 주기의 봉 수", 2, 500)}{numeric("mult", "표준편차 배수", 0.001, 100, 0.001)}
              <label className={labelClass}>소스<select className={fieldClass} value={settings.source} onChange={event => set({ source: event.target.value as BollingerSystemSettings["source"] })}><option value="close">종가</option><option value="hlc3">HLC3 · 고/저/종 평균</option><option value="ohlc4">OHLC4 · 시/고/저/종 평균</option></select></label>
              <label className={labelClass}>중심 계산<select className={fieldClass} value="sma" disabled><option value="sma">SMA · 모집단 표준편차</option></select></label>
            </div>
          </fieldset>
          <fieldset className="space-y-3 border-t border-border pt-3"><legend className="text-sm font-semibold">변동성·확인 임계값</legend><div className="grid grid-cols-2 gap-3">
            {numeric("bbwLookback", "BBW 백분위 유효 표본 수", 10, 1000)}{numeric("extremeThreshold", "극단 스퀴즈 백분위 ≤", 0, 100, 0.5)}{numeric("squeezeThreshold", "스퀴즈 백분위 ≤", 0, 100, 0.5)}{numeric("compressionThreshold", "압축 백분위 ≤", 0, 100, 0.5)}{numeric("expansionRatio", "급확장 BBW 증가 배수", 1.01, 10, 0.1)}{numeric("rvolThreshold", "RVOL 거래량 확인 ≥", 0.1, 10, 0.1)}{numeric("rvolPeriod", "거래량 평균 봉 수", 2, 500)}{numeric("rsiPeriod", "Wilder RSI 기간", 2, 200)}
          </div></fieldset>
          <details className="border-t border-border pt-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">패턴·추세 고급 설정</summary><div className="grid grid-cols-2 gap-3 pt-2">
            {numeric("slopeLookback", "기울기 비교 봉 수", 1, 100)}{numeric("trendTolerance", "추세 비교 허용 비율", 0, 0.1, 0.001)}{numeric("failedWindow", "돌파 실패 확인 봉 수", 1, 10)}{numeric("walkWindow", "밴드 워크 관찰 봉 수", 2, 50)}{numeric("walkCount", "밴드 워크 충족 봉 수", 1, 50)}{numeric("walkThreshold", "상단 워크 %B 기준", 0.5, 1, 0.05)}{numeric("pivotLeft", "피벗 왼쪽 봉 수", 1, 20)}{numeric("pivotRight", "피벗 오른쪽 확인 봉 수", 1, 20)}{numeric("patternMaxBars", "패턴 최대 간격 봉 수", 5, 500)}{numeric("patternTolerance", "W/M 가격 허용 비율", 0, 0.25, 0.01)}
          </div></details>
          <details className="border-t border-border pt-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">로컬 알림 종류</summary>{Object.entries(BOLLINGER_SIGNAL_LABELS).map(([key, title]) => <Toggle key={key} checked={settings.alertSignals.includes(key as BollingerSignal)} onChange={next => set({ alertSignals: next ? [...settings.alertSignals, key as BollingerSignal] : settings.alertSignals.filter(signal => signal !== key) })}>{title}</Toggle>)}<p className="text-xs leading-relaxed text-muted-foreground">완성된 봉의 신규 이벤트만 평가합니다. 브라우저가 닫혀 있으면 평가하지 않습니다.</p></details>
          <Methodology />
        </div>
      </SheetContent>
    </Sheet>
    <select className="min-h-11 min-w-0 rounded-md border border-border bg-background px-2 text-xs text-foreground md:min-h-8" aria-label="볼린저 분석 모드" data-testid="bollinger-mode" disabled={disabled} value={settings.mode} onChange={event => set({ mode: event.target.value as BollingerSystemSettings["mode"] })}><option value="trading">트레이딩</option><option value="investment">투자</option></select>
    {onTimeframe && <div className="flex flex-wrap gap-1" role="group" aria-label="볼린저 주기 선택">{timeframeChoices.map(choice => <Button key={choice.label} type="button" size="sm" variant="ghost" disabled={disabled} className="min-h-11 md:min-h-8" onClick={() => onTimeframe(choice.interval, choice.size)}>{choice.label}</Button>)}</div>}
  </div>;
}

export function BollingerStatus({ point, historical, settings }: { point: BollingerPoint | null; historical: boolean; settings: BollingerSystemSettings }) {
  if (!settings.enabled || !settings.status) return null;
  return <section className="min-w-0 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground" aria-label="볼린저 상태" data-testid="bollinger-status" data-as-of={point?.date} data-historical={historical} data-percent-b={point?.percentB ?? undefined} data-bbw={point?.bbw ?? undefined} data-percentile={point?.bbwPercentile ?? undefined} data-score={point?.quality.normalizedScore ?? undefined} data-coverage={point?.quality.coverage ?? undefined}>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><strong>Bollinger · {historical ? "과거 선택 봉" : "최신 상태"}</strong><span className="text-muted-foreground">{point?.date ?? "데이터 없음"}{point && !point.completed ? " · 미완성 봉 PREVIEW" : ""}</span>{point && <span>{setupLabels[point.setup]}</span>}<span className="text-muted-foreground">{settings.mode === "investment" ? "투자 · 장기 추세·되돌림·변동성 압축" : "트레이딩 · 돌파·RVOL·밴드 워크"}</span></div>
    {!point ? <p className="mt-1 text-muted-foreground">가격 이력이 없거나 지표 계산에 필요한 실제 봉이 부족합니다.</p> : <>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1"><div><dt className="inline text-muted-foreground">추세 </dt><dd className="inline">{point.trend ? trendLabels[point.trend] : "이력 부족"}</dd></div><div><dt className="inline text-muted-foreground">%B </dt><dd className="inline tabular-nums">{number(point.percentB)}</dd></div><div><dt className="inline text-muted-foreground">BBW </dt><dd className="inline tabular-nums">{number(point.bbw)}{point.bbw != null ? "%" : ""}</dd></div><div><dt className="inline text-muted-foreground">BBW 백분위 </dt><dd className="inline tabular-nums">{number(point.bbwPercentile, 1)}{point.bbwPercentile != null ? "%" : ""} · {point.bbwSamples}/{settings.bbwLookback}표본</dd></div><div><dt className="inline text-muted-foreground">변동성 </dt><dd className="inline">{point.volatility ? volatilityLabels[point.volatility] : "표본 부족"}</dd></div><div><dt className="inline text-muted-foreground">RSI </dt><dd className="inline tabular-nums">{number(point.rsi, 1)}</dd></div><div><dt className="inline text-muted-foreground">RVOL </dt><dd className="inline tabular-nums">{number(point.rvol)}{point.rvol != null ? "×" : ""}{point.rvolMethod === "rolling-approximate" ? " · 봉 평균 근사" : point.rvolMethod === "same-slot" ? " · 동일 시간대" : ""}</dd></div></dl>
      {settings.score && <details className="mt-2" data-testid="bollinger-score-details"><summary className="cursor-pointer font-medium">Setup Quality {number(point.quality.normalizedScore, 0)} / 100 · 데이터 커버리지 {number(point.quality.coverage * 100, 0)}%</summary><p className="mt-2 text-muted-foreground">획득 {number(point.quality.earnedScore, 1)} / 가용 {number(point.quality.availableScore, 1)} · 규칙 기반 점수이며 성공 확률이 아닙니다.</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(point.quality.components).map(([key, component]) => <div key={key} className="min-w-0 rounded-md border border-border p-2"><strong>{({ trend: "추세", volatility: "변동성", momentum: "모멘텀", volume: "거래량", flow: "수급 확인", riskReward: "위험/보상" } as Record<string, string>)[key]} · {number(component.score, 1)} / {component.max}</strong><p className="mt-1 break-words text-muted-foreground">{component.reason} · {component.availability}</p><dl className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">{Object.entries(component.inputs).map(([name, value]) => <div key={name}><dt className="inline">{name}: </dt><dd className="inline tabular-nums">{value == null ? "—" : String(value)}</dd></div>)}</dl></div>)}</div></details>}
      <details className="mt-2"><summary className="cursor-pointer text-muted-foreground">확인 상태·BBW 범위·수급 출처</summary><div className="mt-2 space-y-1 text-muted-foreground"><p>돌파: {point.breakout === "upper" ? "상단" : point.breakout === "lower" ? "하단" : "없음"} · 실패: {point.failedBreakout === "upper" ? "상단" : point.failedBreakout === "lower" ? "하단" : "없음"} · 밴드 워크: {point.bandWalk === "upper" ? "상단" : point.bandWalk === "lower" ? "하단" : "없음"}</p><p>BBW 최저 {number(point.bbwMin)}% · 최고 {number(point.bbwMax)}% · 유효 표본 {point.bbwSamples}</p><p>외국인 보유비율 변화 {number(point.flow.foreignOwnershipChange)}%p · 투신 순매수 수량 {number(point.flow.investmentTrustNet, 0)} · {point.flow.availability}</p><p>{point.flow.reason}{point.flow.source ? ` · ${point.flow.source}` : ""}{point.flow.asOf ? ` · ${point.flow.asOf}` : ""}</p><p>공표시각을 알 수 없는 수급은 과거 선택 봉·리플레이 당시 알려진 정보로 사용하지 않습니다.</p></div></details>
    </>}
  </section>;
}
