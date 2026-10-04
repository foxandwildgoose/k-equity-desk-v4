import { useEffect, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Layers } from "lucide-react";
import type { ChartLayoutState } from "@/lib/charts/persistence";
import { cn } from "@/lib/utils";

type Category = keyof ChartLayoutState["overlays"];
const categories: { key: Category; label: string }[] = [
  { key: "disclosures", label: "공시" }, { key: "research", label: "리포트" },
  { key: "targets", label: "목표가 변경" }, { key: "signals", label: "분석 신호" },
  { key: "news", label: "뉴스" }, { key: "dividends", label: "배당" }, { key: "splits", label: "분할" },
];
const control = (on: boolean) => cn("inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium md:min-h-8", on ? "bg-desk-gold/15 text-foreground ring-1 ring-desk-gold/40" : "bg-muted text-muted-foreground hover:text-foreground");

export function ChartDisplayControls({ overlays, rangeOn, profileOn, legacyProfile, ready, onToggle, onRange, onProfile, onAll, onReadability, onSettings, onIndicators, onObjects, eventCount, onEvents }: {
  overlays: ChartLayoutState["overlays"]; rangeOn: boolean; profileOn: boolean; legacyProfile: boolean; ready: boolean;
  onToggle: (key: Category) => void; onRange: () => void; onProfile: () => void;
  onAll: (on: boolean) => void; onReadability: () => void; onSettings: (trigger: HTMLButtonElement) => void;
  onIndicators: () => void; onObjects: () => void; eventCount: number; onEvents: (trigger: HTMLButtonElement) => void;
}) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | undefined>();
  useEffect(() => {
    const update = () => setPortalContainer(document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : undefined);
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const active = Object.values(overlays).filter(Boolean).length + Number(rangeOn);
  return <>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={control(active > 0)} data-testid="chart-display-menu" aria-label={`차트 표시 · 자동 주석 ${active}종 ON`}>
        <Layers className="size-3.5" /> 차트 표시 <ChevronDown className="size-3.5" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalContainer}>
        <DropdownMenu.Content align="start" sideOffset={5} collisionPadding={8} className="z-50 max-h-96 w-60 max-w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          <DropdownMenu.Label className="px-2 py-2 text-xs text-muted-foreground">자동 주석 · 원본 자료는 유지</DropdownMenu.Label>
          {categories.map(({ key, label }) => <DropdownMenu.CheckboxItem key={key} checked={overlays[key]} onCheckedChange={() => onToggle(key)} onSelect={event => event.preventDefault()} className="flex min-h-11 cursor-pointer items-center justify-between rounded px-2 text-xs outline-none focus:bg-accent" data-testid={`overlay-menu-${key}`}>
            <span>{label}</span><span>{overlays[key] ? "ON" : "OFF"}</span>
          </DropdownMenu.CheckboxItem>)}
          <DropdownMenu.CheckboxItem checked={rangeOn} onCheckedChange={onRange} onSelect={event => event.preventDefault()} className="flex min-h-11 items-center justify-between rounded px-2 text-xs outline-none focus:bg-accent" data-testid="overlay-toggle-range"><span>고저점·자동 연결선</span><span>{rangeOn ? "ON" : "OFF"}</span></DropdownMenu.CheckboxItem>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item onSelect={() => onAll(false)} className="min-h-11 cursor-pointer rounded p-2 text-xs outline-none focus:bg-accent" data-testid="annotations-hide-all">주석 모두 숨김</DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => onAll(true)} className="min-h-11 cursor-pointer rounded p-2 text-xs outline-none focus:bg-accent" data-testid="annotations-show-all">주석 모두 표시</DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item onSelect={onIndicators} className="min-h-11 cursor-pointer rounded p-2 text-xs outline-none focus:bg-accent">기술지표 표시 설정</DropdownMenu.Item>
          <DropdownMenu.Item onSelect={onObjects} className="min-h-11 cursor-pointer rounded p-2 text-xs outline-none focus:bg-accent">수동 그리기 객체 관리</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    {categories.slice(0, 4).map(({ key, label }) => <button type="button" key={key} className={control(overlays[key])} onClick={() => onToggle(key)} aria-pressed={overlays[key]} data-testid={`overlay-toggle-${key}`}>{label === "목표가 변경" ? "목표가" : label === "분석 신호" ? "신호" : label} {overlays[key] ? "ON" : "OFF"}</button>)}
    <button type="button" className={control(profileOn)} aria-pressed={profileOn} onClick={onProfile} data-testid="profile-toggle">매물대 {profileOn ? "ON" : "OFF"}</button>
    <button type="button" className={control(false)} onClick={event => onSettings(event.currentTarget)} data-testid="open-hts-settings">매물대 설정</button>
    <button type="button" className={control(false)} disabled={!ready} onClick={onReadability} data-testid="chart-readability" title="현재 차트의 자동 주석만 숨기고 매물대를 10구간·폭 85%·보이는 시간 구간·테마 자동으로 적용합니다. 줌·그리기·기술지표·하위 패널은 유지합니다.">차트 정리</button>
    {eventCount > 0 && <button type="button" className={control(false)} onClick={event => onEvents(event.currentTarget)} data-testid="chart-event-list">주석 상세 {eventCount}</button>}
    {legacyProfile && <span className="basis-full text-xs text-muted-foreground" data-testid="profile-readability-notice">저장된 좁은 폭·전체 기간 설정을 유지 중입니다. ‘차트 정리’로 가독성 기본값을 적용할 수 있습니다.</span>}
  </>;
}
