import { useMemo, useState } from "react";
import { Bell, BellOff, Eye, EyeOff, Lock, Plus, Search, Trash2, Unlock, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  INDICATOR_BY_ID,
  PALETTE,
  sanitizeParams,
  searchIndicators,
  type IndicatorDef,
  type IndicatorInstance,
} from "@/lib/charts/catalog";
import { DRAWING_TOOLS, type Drawing } from "@/lib/charts/drawings";
import type { PriceAlert } from "@/lib/store-migrate";
import { cn } from "@/lib/utils";

export function instanceLabel(inst: IndicatorInstance): string {
  const def = INDICATOR_BY_ID.get(inst.id);
  if (!def) return inst.id;
  const short = def.label.split(" ")[0]!;
  const ps = def.params.filter((p) => p.type !== "select").map((p) => inst.params[p.key]);
  const sel = def.params.filter((p) => p.type === "select").map((p) => inst.params[p.key]);
  const all = [...ps, ...sel];
  return all.length ? `${short}(${all.join(",")})` : short;
}

/** Searchable catalog + per-instance params / color / visibility / remove + templates (F7.6). */
export function IndicatorPanel({
  open,
  onOpenChange,
  instances,
  onAdd,
  onChange,
  onRemove,
  templates,
  onSaveTemplate,
  onApplyTemplate,
  onDeleteTemplate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  instances: IndicatorInstance[];
  onAdd: (def: IndicatorDef) => void;
  onChange: (uid: string, patch: Partial<IndicatorInstance>) => void;
  onRemove: (uid: string) => void;
  templates: string[];
  onSaveTemplate: (name: string) => void;
  onApplyTemplate: (name: string) => void;
  onDeleteTemplate: (name: string) => void;
}) {
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [tplName, setTplName] = useState("");
  const results = useMemo(() => searchIndicators(q), [q]);
  const groups = useMemo(() => {
    const m = new Map<string, IndicatorDef[]>();
    for (const d of results) m.set(d.group, [...(m.get(d.group) ?? []), d]);
    return [...m.entries()];
  }, [results]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0" data-testid="indicator-panel">
        <SheetHeader className="border-b border-border">
          <SheetTitle>지표</SheetTitle>
          <SheetDescription>검색해서 추가하고, 매개변수·색·표시를 바꿉니다. 설정은 이 차트 레이아웃에 저장됩니다.</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 p-3">
          <section>
            <h4 className="mb-1 text-[11px] font-semibold text-muted-foreground">사용 중 ({instances.length})</h4>
            <ul className="space-y-1">
              {instances.map((inst) => {
                const def = INDICATOR_BY_ID.get(inst.id);
                return (
                  <li key={inst.uid} className="rounded-md border border-border p-1.5 text-[12px]">
                    <div className="flex items-center gap-1">
                      <input
                        type="color"
                        value={inst.color ?? PALETTE[0]}
                        onChange={(e) => onChange(inst.uid, { color: e.target.value })}
                        className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
                        aria-label="색"
                      />
                      <button type="button" className="min-w-0 flex-1 truncate text-left font-medium" onClick={() => setEdit(edit === inst.uid ? null : inst.uid)}>
                        {instanceLabel(inst)}
                        {def?.anchored && <span className="ml-1 text-[10px] text-muted-foreground">{inst.anchorTime != null ? `기준 ${inst.anchorTime}` : "기준봉 미지정"}</span>}
                      </button>
                      <button type="button" onClick={() => onChange(inst.uid, { visible: !inst.visible })} className="inline-flex size-9 items-center justify-center rounded hover:bg-muted" aria-label={inst.visible ? "숨기기" : "표시"}>
                        {inst.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                      </button>
                      <button type="button" onClick={() => onRemove(inst.uid)} className="inline-flex size-9 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="삭제">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    {edit === inst.uid && def && def.params.length > 0 && (
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {def.params.map((p) => (
                          <label key={p.key} className="flex flex-col gap-0.5 text-[10.5px] text-muted-foreground">
                            {p.label}
                            {p.type === "select" ? (
                              <select
                                value={String(inst.params[p.key])}
                                onChange={(e) => onChange(inst.uid, { params: sanitizeParams(def, { ...inst.params, [p.key]: e.target.value }) })}
                                className="h-9 rounded-md border border-border bg-background px-1 text-xs text-foreground"
                              >
                                {p.options?.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <Input
                                type="number"
                                value={String(inst.params[p.key])}
                                min={p.min}
                                max={p.max}
                                step={p.step}
                                onChange={(e) => onChange(inst.uid, { params: sanitizeParams(def, { ...inst.params, [p.key]: e.target.value }) })}
                                className="h-9 text-xs"
                              />
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          <section>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="지표 검색 (예: RSI, 볼린저, vwap)" className="h-9 pl-8 text-xs" aria-label="지표 검색" />
            </div>
            <div className="mt-2 space-y-2">
              {groups.map(([g, defs]) => (
                <div key={g}>
                  <div className="mb-0.5 text-[10px] font-semibold text-muted-foreground">{g}</div>
                  <div className="flex flex-wrap gap-1">
                    {defs.map((d) => (
                      <button key={d.id} type="button" onClick={() => onAdd(d)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-[11px] hover:bg-muted" data-indicator={d.id}>
                        <Plus className="size-3" /> {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="border-t border-border pt-2">
            <h4 className="mb-1 text-[11px] font-semibold text-muted-foreground">템플릿</h4>
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (tplName.trim()) onSaveTemplate(tplName.trim().slice(0, 40));
                setTplName("");
              }}
            >
              <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="현재 지표·차트 종류를 템플릿으로 저장" className="h-9 text-xs" aria-label="템플릿 이름" />
              <button type="submit" className="inline-flex min-h-9 items-center rounded-md border border-border px-2 text-[11px] font-semibold hover:bg-muted">
                저장
              </button>
            </form>
            <div className="mt-1 flex flex-wrap gap-1">
              {templates.map((t) => (
                <span key={t} className="inline-flex items-center rounded-md border border-border text-[11px]">
                  <button type="button" onClick={() => onApplyTemplate(t)} className="min-h-9 px-2 hover:bg-muted">
                    {t}
                  </button>
                  <button type="button" onClick={() => onDeleteTemplate(t)} className="inline-flex size-9 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={`${t} 삭제`}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const TYPE_LABEL = Object.fromEntries(DRAWING_TOOLS.map((t) => [t.type, t.label]));

/** Object manager (F7.7): select, color, width, lock, hide, delete, hline alerts. */
export function ObjectManager({
  open,
  onOpenChange,
  drawings,
  selectedId,
  onSelect,
  onUpdate,
  onRemove,
  onToggleAlert,
  formatPrice,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  drawings: Drawing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Drawing>) => void;
  onRemove: (id: string) => void;
  onToggleAlert: (d: Drawing) => void;
  formatPrice: (p: number) => string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0" data-testid="object-manager">
        <SheetHeader className="border-b border-border">
          <SheetTitle>그리기 목록</SheetTitle>
          <SheetDescription>선택·색·두께·잠금·숨김·삭제. 수평선은 가격 알림으로 바꿀 수 있습니다. 실행 취소 Ctrl/⌘+Z.</SheetDescription>
        </SheetHeader>
        {drawings.length === 0 ? (
          <p className="p-4 text-[12px] text-muted-foreground">그린 도형이 없습니다.</p>
        ) : (
          <ul className="space-y-1 p-3">
            {drawings.map((d) => (
              <li key={d.id} className={cn("flex flex-wrap items-center gap-1 rounded-md border p-1.5 text-[12px]", selectedId === d.id ? "border-amber-500/60" : "border-border")} data-drawing={d.id}>
                <button type="button" onClick={() => onSelect(d.id)} className="min-h-9 min-w-0 flex-1 truncate text-left">
                  <span className="font-medium">{TYPE_LABEL[d.type] ?? d.type}</span>{" "}
                  <span className="text-muted-foreground">{formatPrice(d.anchors[0]?.p ?? 0)}</span>
                </button>
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(d.color) ? d.color : "#f59e0b"} onChange={(e) => onUpdate(d.id, { color: e.target.value })} disabled={d.locked} className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="색" />
                <select value={d.width} onChange={(e) => onUpdate(d.id, { width: Number(e.target.value) })} disabled={d.locked} className="h-9 rounded-md border border-border bg-background px-1 text-xs" aria-label="두께">
                  {[1, 2, 3, 4].map((w) => (
                    <option key={w} value={w}>
                      {w}px
                    </option>
                  ))}
                </select>
                {d.type === "hline" && (
                  <button type="button" onClick={() => onToggleAlert(d)} className="inline-flex size-9 items-center justify-center rounded hover:bg-muted" aria-label={d.alertId ? "가격 알림 해제" : "가격 알림 만들기"} title={d.alertId ? "가격 알림 해제" : "이 가격을 넘으면 알림"}>
                    {d.alertId ? <Bell className="size-3.5 text-amber-500" /> : <BellOff className="size-3.5" />}
                  </button>
                )}
                <button type="button" onClick={() => onUpdate(d.id, { locked: !d.locked })} className="inline-flex size-9 items-center justify-center rounded hover:bg-muted" aria-label={d.locked ? "잠금 해제" : "잠금"}>
                  {d.locked ? <Lock className="size-3.5 text-amber-500" /> : <Unlock className="size-3.5" />}
                </button>
                <button type="button" onClick={() => onUpdate(d.id, { hidden: !d.hidden })} className="inline-flex size-9 items-center justify-center rounded hover:bg-muted" aria-label={d.hidden ? "표시" : "숨기기"}>
                  {d.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
                <button type="button" onClick={() => onRemove(d.id)} className="inline-flex size-9 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="삭제">
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Alerts for this symbol (F7.11): add RSI / MA-cross alerts; list + remove. */
export function AlertsPanel({
  open,
  onOpenChange,
  alerts,
  onAddRsi,
  onAddMa,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  alerts: PriceAlert[];
  onAddRsi: () => void;
  onAddMa: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0" data-testid="alerts-panel">
        <SheetHeader className="border-b border-border">
          <SheetTitle>차트 알림</SheetTitle>
          <SheetDescription>데이터가 새로 들어올 때 이 브라우저에서 확인합니다. 알림은 Live Wire(토스트·데스크톱 알림 설정)로 보냅니다.</SheetDescription>
        </SheetHeader>
        <div className="space-y-2 p-3 text-[12px]">
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={onAddRsi} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 hover:bg-muted">
              <Plus className="size-3" /> RSI 70·30 돌파
            </button>
            <button type="button" onClick={onAddMa} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 hover:bg-muted">
              <Plus className="size-3" /> 이평 20·60 교차
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">수평선 가격 알림은 그리기 목록에서 수평선의 종 아이콘으로 만듭니다.</p>
          {alerts.length === 0 ? (
            <p className="text-muted-foreground">이 종목의 알림이 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-md border border-border p-1.5">
                  <span className="min-w-0 flex-1 truncate">
                    {a.kind === "price-cross" ? `가격 ${a.level?.toLocaleString("ko-KR")}` : a.kind === "rsi-cross" ? `RSI ${a.level}` : `이평 ${a.fast}/${a.slow}`} ·{" "}
                    {a.direction === "up" ? "상향" : a.direction === "down" ? "하향" : "양방향"} · {a.repeat === "once" ? "한 번" : "매번"} · {a.active ? "대기" : "완료"}
                  </span>
                  <button type="button" onClick={() => onRemove(a.id)} className="inline-flex size-9 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="알림 삭제">
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
