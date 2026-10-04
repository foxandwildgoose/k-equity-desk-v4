import { useId, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { resolveProfileStyle } from "@/lib/charts/profile-style";
import {
  applyHtsProfilePreset,
  HTS_PANEL_LABELS,
  HTS_PANEL_ORDER,
  type HtsProfilePreset,
  type HtsProfileSettings,
  type HtsSettings,
} from "@/lib/charts/hts-settings";

const fieldClass = "min-h-11 w-full min-w-0 rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelClass = "flex min-w-0 flex-col gap-1 text-xs text-muted-foreground";

function Toggle({ checked, onChange, children, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-foreground"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4 shrink-0 accent-primary" />{children}</label>;
}

export interface HtsSettingsPanelProps {
  settings: HtsSettings;
  onChange: (next: HtsSettings) => void;
  onRestore: () => void;
  /** US individual stocks keep their existing layout and use profile controls. */
  allowHts?: boolean;
}

/** Shared by stock/ETF routes and workspace. Native controls retain keyboard support. */
export function HtsSettingsPanel({ settings, onChange, onRestore, allowHts = true }: HtsSettingsPanelProps) {
  const rowOptionsId = useId();
  const theme = useAppStore((state) => state.theme);
  const profile = settings.profile;
  const profileStyle = resolveProfileStyle(profile, theme);
  const set = (patch: Partial<HtsSettings>) => onChange({ ...settings, ...patch });
  const setProfile = (patch: Partial<HtsProfileSettings>) => set({ profile: { ...profile, ...patch } });
  const number = (raw: string, min: number, max: number, fallback: number) => raw === "" || !Number.isFinite(Number(raw)) ? fallback : Math.min(max, Math.max(min, Number(raw)));
  const invalidDates = profile.rangeMode === "fixed" && (!profile.startDate || !profile.endDate || profile.startDate > profile.endDate);

  return (
    <section className="space-y-4 text-foreground" aria-label="HTS 차트 설정" data-testid="hts-settings">
      {allowHts && <div className="border-b border-border pb-3">
        <Toggle checked={settings.enabled} onChange={(enabled) => set({ enabled })}>국내주식·ETF 공통 6단 배치</Toggle>
        <Button type="button" variant="outline" size="sm" onClick={onRestore} className="min-h-11 h-auto w-full justify-start whitespace-normal py-2 text-left text-xs"><RotateCcw className="size-3.5 shrink-0" />국내주식·ETF HTS 기본 배치 복원</Button>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">RSI → 가격·매물대 → 신용잔고율 → 외국인보유비율 → 투신 수량 → 거래량. 데이터가 없는 패널도 사유와 함께 유지합니다.</p>
      </div>}

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">매물대</legend>
        <Toggle checked={profile.enabled} onChange={(enabled) => setProfile({ enabled })}>매물대 표시</Toggle>
        <label className={labelClass}>표시 프리셋
          <select className={fieldClass} value={profile.preset} onChange={(e) => set({ profile: applyHtsProfilePreset(e.target.value as HtsProfilePreset, profile) })}>
            <option value="hts">HTS 상세</option><option value="ref">간략 표시</option><option value="emph">강조 표시</option><option value="hide">숨기기</option>
          </select>
        </label>
        <label className={labelClass}>매물대 색상 방식
          <select className={fieldClass} value={profile.colorMode} onChange={(e) => setProfile({ colorMode: e.target.value as HtsProfileSettings["colorMode"], color: profileStyle.color, opacity: profileStyle.opacity })}>
            <option value="auto">테마 자동</option><option value="custom">사용자 지정</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>가격 구간 수
            <Input type="number" min={1} max={200} step={1} list={rowOptionsId} value={profile.rows} onChange={(e) => setProfile({ rows: Math.round(number(e.target.value, 1, 200, profile.rows)) })} className={fieldClass} />
            <datalist id={rowOptionsId}>{[10, 16, 24, 32, 48, 64].map((n) => <option key={n} value={n} />)}</datalist>
          </label>
          <label className={labelClass}>집계 기준
            <select className={fieldClass} value={profile.basis} onChange={(e) => setProfile({ basis: e.target.value as HtsProfileSettings["basis"] })}><option value="volume">거래량 수량</option><option value="turnover">추정 거래대금</option></select>
          </label>
          <label className={labelClass}>최대 폭 ({Math.round(profile.widthRatio * 100)}%)
            <input type="range" min={10} max={90} step={1} value={Math.round(profile.widthRatio * 100)} onChange={(e) => setProfile({ widthRatio: Number(e.target.value) / 100 })} className="min-h-11 w-full accent-primary" />
          </label>
          <label className={labelClass}>불투명도 ({Math.round(profileStyle.opacity * 100)}%)
            <input type="range" min={5} max={60} step={1} value={Math.round(profileStyle.opacity * 100)} onChange={(e) => setProfile({ colorMode: "custom", color: profileStyle.color, opacity: Number(e.target.value) / 100 })} className="min-h-11 w-full accent-primary" />
          </label>
          <label className={labelClass}>막대 색상
            <input type="color" value={profileStyle.color} onChange={(e) => setProfile({ colorMode: "custom", color: e.target.value, opacity: profileStyle.opacity })} className="min-h-11 w-full cursor-pointer rounded-md border border-border bg-background p-1" />
          </label>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">테마 자동은 라이트·다크 모드에 따라 색과 불투명도를 바꿉니다. 색상이나 불투명도를 직접 조정하면 사용자 지정으로 저장합니다.</p>
        <Toggle checked={profile.showLabels} onChange={(showLabels) => setProfile({ showLabels })}>막대별 수량·전체 대비 비율 라벨</Toggle>
        <div className="grid grid-cols-2 gap-x-3"><Toggle checked={profile.showPoc} onChange={(showPoc) => setProfile({ showPoc })}>POC 표시</Toggle><Toggle checked={profile.showVa} onChange={(showVa) => setProfile({ showVa })}>Value Area 표시</Toggle></div>
        <label className={labelClass}>매물대 집계 범위
          <select className={fieldClass} value={profile.rangeMode} onChange={(e) => setProfile({ rangeMode: e.target.value as HtsProfileSettings["rangeMode"] })}><option value="visible">현재 보이는 시간 구간</option><option value="fixed">지정 시작일~종료일</option><option value="all">불러온 전체 기간</option></select>
        </label>
        {profile.rangeMode === "fixed" && <div className="space-y-2"><div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>매물대 시작일<Input type="date" value={profile.startDate} max={profile.endDate || undefined} onChange={(e) => setProfile({ startDate: e.target.value })} className={fieldClass} /></label>
          <label className={labelClass}>매물대 종료일<Input type="date" value={profile.endDate} min={profile.startDate || undefined} onChange={(e) => setProfile({ endDate: e.target.value })} className={fieldClass} /></label>
        </div><p className="text-xs leading-relaxed text-muted-foreground">고정 기간에서는 화면을 이동해도 집계 기간을 바꾸지 않습니다. 실제 확보한 데이터 범위는 상세표에서 확인하세요.</p>{invalidDates && <p role="status" className="text-xs text-destructive">유효한 시작일과 종료일을 선택하세요. 날짜가 지정되기 전에는 집계하지 않습니다.</p>}</div>}
      </fieldset>

      <fieldset className="space-y-2 border-t border-border pt-3">
        <legend className="text-sm font-semibold">고저점 자동 주석</legend>
        <Toggle checked={profile.rangeOn} onChange={(rangeOn) => setProfile({ rangeOn })}>고저점·고저점 대비 문구·자동 연결선</Toggle>
        <label className={labelClass}>최근 고저 창
          <select className={fieldClass} value={profile.recentSpan} onChange={(e) => setProfile({ recentSpan: e.target.value as HtsProfileSettings["recentSpan"] })}>
            <option value="3M">최근 3M</option><option value="6M">최근 6M</option><option value="52W">최근 52W</option><option value="all">최근=전체</option><option value="swing">최근 스윙</option>
          </select>
        </label>
      </fieldset>

      {allowHts && <>
        <fieldset className="space-y-3 border-t border-border pt-3">
          <legend className="text-sm font-semibold">RSI · 종가 · Wilder</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>RSI 기간<Input type="number" min={2} max={200} value={settings.rsiPeriod} onChange={(e) => set({ rsiPeriod: Math.round(number(e.target.value, 2, 200, settings.rsiPeriod)) })} className={fieldClass} /></label>
            <label className={labelClass}>시그널 기간<Input type="number" min={1} max={200} value={settings.signalPeriod} onChange={(e) => set({ signalPeriod: Math.round(number(e.target.value, 1, 200, settings.signalPeriod)) })} className={fieldClass} /></label>
          </div>
          <label className={labelClass}>RSI 출력값의 시그널 방식<select className={fieldClass} value={settings.signalMethod} onChange={(e) => set({ signalMethod: e.target.value as "sma" | "ema" })}><option value="sma">SMA · 단순이동평균</option><option value="ema">EMA · 지수이동평균</option></select></label>
          <Toggle checked={settings.rsiZones} onChange={(rsiZones) => set({ rsiZones })}>30 아래·70 위 배경 음영</Toggle>
        </fieldset>

        <fieldset className="space-y-3 border-t border-border pt-3">
          <legend className="text-sm font-semibold">투신 수량</legend>
          <label className={labelClass}>투신 표시 방식<select className={fieldClass} value={settings.trustMode} onChange={(e) => set({ trustMode: e.target.value as HtsSettings["trustMode"] })}><option value="cumulative">기준일 이후 누적순매수</option><option value="daily">일별 순매수</option><option value="available-cumulative">가용한 최근 연속 구간부터 누적 (실제 시작일 표시)</option></select></label>
          <label className={labelClass}>투신 누적 기준일<Input type="date" value={settings.trustStartDate} onChange={(e) => set({ trustStartDate: e.target.value })} className={fieldClass} /></label>
          <p className="text-xs leading-relaxed text-muted-foreground">기준일은 스크롤·줌과 무관하게 고정됩니다. 누적순매수는 절대 보유수량이 아니며, 누락된 날은 0으로 채우지 않습니다.</p>
        </fieldset>

        <fieldset className="border-t border-border pt-3">
          <legend className="text-sm font-semibold">거래량 이동평균</legend>
          <div className="flex flex-wrap gap-x-4">{([5, 20, 60] as const).map((period) => <Toggle key={period} checked={settings.volumeMa[period]} onChange={(enabled) => set({ volumeMa: { ...settings.volumeMa, [period]: enabled } })}>SMA {period}</Toggle>)}</div>
        </fieldset>

        <fieldset className="space-y-2 border-t border-border pt-3">
          <legend className="text-sm font-semibold">패널 높이·접기</legend>
          <p className="text-xs leading-relaxed text-muted-foreground">차트의 구분선을 끌거나 높이를 입력하세요. 작은 화면에서는 세로로 스크롤해 모든 패널을 볼 수 있습니다.</p>
          {HTS_PANEL_ORDER.map((panel) => <div key={panel} className="grid grid-cols-2 items-center gap-3">
            <Toggle checked={!settings.collapsed[panel]} onChange={(visible) => set({ collapsed: { ...settings.collapsed, [panel]: !visible } })}>{HTS_PANEL_LABELS[panel]} 펼치기</Toggle>
            <label className={labelClass}>{HTS_PANEL_LABELS[panel]} 높이 (px)<Input type="number" min={panel === "price" ? 180 : 48} max={1200} step={10} value={settings.panelHeights[panel]} onChange={(e) => set({ panelHeights: { ...settings.panelHeights, [panel]: Math.round(number(e.target.value, panel === "price" ? 180 : 48, 1200, settings.panelHeights[panel])) } })} className={fieldClass} /></label>
          </div>)}
        </fieldset>
      </>}
    </section>
  );
}
