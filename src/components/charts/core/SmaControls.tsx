import type { IndicatorInstance } from "@/lib/charts/catalog";
import { resolveSmaStyle, STANDARD_SMA_PERIODS, type SmaThemeMode, type StandardSmaPeriod } from "@/lib/charts/standard-sma";
import { cn } from "@/lib/utils";

export function SmaControls({ instances, mode, onToggle, disabled = false, unavailable = [] }: {
  instances: readonly IndicatorInstance[];
  mode: SmaThemeMode;
  onToggle: (period: StandardSmaPeriod) => void;
  disabled?: boolean;
  unavailable?: readonly number[];
}) {
  return <div className="flex min-w-0 flex-wrap items-center gap-1" role="group" aria-label="표준 SMA 표시" data-testid="sma-controls">
    {STANDARD_SMA_PERIODS.map(period => {
      const matches = instances.filter(i => i.id === "sma" && Number(i.params?.period) === period);
      const instance = matches.find(i => i.visible) ?? matches[0] ?? { uid: "", id: "sma", params: { period }, visible: false };
      const active = matches.some(i => i.visible);
      return <button key={period} type="button" aria-pressed={active} disabled={disabled}
        aria-label={`SMA ${period} ${active ? "끄기" : "켜기"}`} title={`SMA ${period} · 현재 주기의 ${period}봉 평균 · ${active ? "끄기" : "켜기"}`}
        data-testid={`sma-toggle-${period}`} onClick={() => onToggle(period)}
        className={cn("inline-flex min-h-11 items-center gap-1 rounded-md border px-2 text-xs font-medium md:min-h-8", active ? "border-border bg-muted text-foreground" : "border-transparent text-muted-foreground", "disabled:opacity-50 hover:bg-muted")}
      ><span className="h-0.5 w-3 rounded" aria-hidden="true" style={{ backgroundColor: resolveSmaStyle(instance, mode)?.color }} />SMA{period}<span className="sr-only">{active ? "ON" : "OFF"}</span></button>;
    })}
    {unavailable.length > 0 && <span className="text-xs text-muted-foreground" role="status" title="해당 주기의 실제 봉이 충분하지 않거나 계산 구간에 결측이 있습니다. 값을 보충하지 않습니다.">SMA{unavailable.join("/")} · 이력 부족/결측</span>}
  </div>;
}
