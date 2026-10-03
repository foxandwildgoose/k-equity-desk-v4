import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2, Volume2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageDisclaimer } from "@/components/feed/PageDisclaimer";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { DesktopAlertsButton } from "@/components/wire/LiveWire";
import { TimeStamp } from "@/components/feed/TimeStamp";
import { useAppStore } from "@/lib/store";
import { beep, useWireStore } from "@/lib/wire/use-live-wire";
import type { AlertSettings, ImportanceTierPref } from "@/lib/store-migrate";

export const Route = createFileRoute("/settings/alerts")({
  component: AlertSettingsPage,
  head: () => ({ meta: [{ title: "알림 설정 · Korea Equity Command Center" }] }),
});

const CATEGORY_LABEL: Record<keyof AlertSettings["categories"], string> = {
  news: "뉴스",
  disclosure: "공시",
  research: "리서치",
  policy: "정책",
  filing: "SEC 공시",
  rating: "등급 변경",
  etf: "ETF",
  robotics: "로봇",
};

const TIER_OPTIONS: { value: ImportanceTierPref; label: string }[] = [
  { value: "flash", label: "FLASH만 (80+)" },
  { value: "high", label: "HIGH 이상 (60+)" },
  { value: "normal", label: "전체" },
];

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function Card({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section className="rounded-xl border border-border bg-card px-3 py-2 md:px-4" data-testid={testId}>
      <h2 className="border-b border-border py-2 text-sm font-semibold">{title}</h2>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function TierSelect({ value, onChange, label }: { value: ImportanceTierPref; onChange: (v: ImportanceTierPref) => void; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as ImportanceTierPref)} className="h-9 rounded-md border border-border bg-background px-2 text-xs" aria-label={label}>
      {TIER_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function AlertSettingsPage() {
  const s = useAppStore((st) => st.alertSettings);
  const set = useAppStore((st) => st.setAlertSettings);
  const removePriceAlert = useAppStore((st) => st.removePriceAlert);
  const openWire = useWireStore((st) => st.setDrawerOpen);
  return (
    <div className="page-stack">
      <PageHeader
        kicker="Live Wire · 알림"
        title="알림 설정"
        lead="Live Wire의 앱 내 알림, 데스크톱 알림, 방해 금지 시간, 지역·종류별 알림을 설정합니다. 설정은 이 브라우저에만 저장됩니다."
        aside={
          <button type="button" onClick={() => openWire(true)} className="inline-flex min-h-9 items-center rounded-md border border-border px-2 text-[11px] font-semibold hover:bg-muted/50">
            Live Wire 열기
          </button>
        }
      />
      <PageDisclaimer />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="앱 내 알림 (토스트)" testId="alerts-inapp">
          <Row label="앱 내 알림" hint="화면을 보고 있을 때 오른쪽 아래에 표시">
            <Switch checked={s.inAppEnabled} onCheckedChange={(v) => set({ inAppEnabled: v })} aria-label="앱 내 알림" />
          </Row>
          <Row label="최소 중요도">
            <TierSelect value={s.inAppMinTier} onChange={(v) => set({ inAppMinTier: v })} label="앱 내 알림 최소 중요도" />
          </Row>
          <Row label="일시정지" hint="수신과 알림을 멈춥니다 (Live Wire 드로어에서도 가능)">
            <Switch checked={s.paused} onCheckedChange={(v) => set({ paused: v })} aria-label="일시정지" />
          </Row>
        </Card>

        <Card title="데스크톱 알림 (OS)" testId="alerts-os">
          <Row label="권한" hint="브라우저 권한 요청은 이 버튼을 누를 때만 합니다. 페이지를 열 때 묻지 않습니다.">
            <DesktopAlertsButton />
          </Row>
          <Row label="데스크톱 알림 사용">
            <Switch checked={s.osEnabled} onCheckedChange={(v) => set({ osEnabled: v })} aria-label="데스크톱 알림 사용" />
          </Row>
          <Row label="최소 중요도" hint="기본값: FLASH만">
            <TierSelect value={s.osMinTier} onChange={(v) => set({ osMinTier: v })} label="데스크톱 알림 최소 중요도" />
          </Row>
          <Row label="관심종목·키워드 일치는 항상 알림" hint={<Link to="/watchlist" className="text-primary hover:underline">관심종목·키워드 관리 →</Link>}>
            <Switch checked={s.osWatchMatches} onCheckedChange={(v) => set({ osWatchMatches: v })} aria-label="관심종목 일치 알림" />
          </Row>
          <Row label="속도 제한" hint="10분에 최대 5건, 넘치면 묶음 알림 1건 (변경 불가)">
            <span className="text-[11px] text-muted-foreground">5건 / 10분</span>
          </Row>
        </Card>

        <Card title="방해 금지 시간 (KST)" testId="alerts-quiet">
          <Row label="방해 금지 사용" hint="이 시간에는 데스크톱 알림과 소리를 끕니다. 배지 숫자는 계속 갱신됩니다.">
            <Switch checked={s.quietHours.enabled} onCheckedChange={(v) => set({ quietHours: { ...s.quietHours, enabled: v } })} aria-label="방해 금지 사용" />
          </Row>
          <Row label="시간">
            <Input type="time" value={s.quietHours.start} onChange={(e) => set({ quietHours: { ...s.quietHours, start: e.target.value } })} className="h-9 w-28 text-xs" aria-label="시작" />
            <span className="text-xs text-muted-foreground">~</span>
            <Input type="time" value={s.quietHours.end} onChange={(e) => set({ quietHours: { ...s.quietHours, end: e.target.value } })} className="h-9 w-28 text-xs" aria-label="종료" />
          </Row>
        </Card>

        <Card title="지역 · 종류" testId="alerts-scope">
          <Row label="한국">
            <Switch checked={s.regions.KR} onCheckedChange={(v) => set({ regions: { ...s.regions, KR: v } })} aria-label="한국 알림" />
          </Row>
          <Row label="미국">
            <Switch checked={s.regions.US} onCheckedChange={(v) => set({ regions: { ...s.regions, US: v } })} aria-label="미국 알림" />
          </Row>
          <div className="grid grid-cols-2 gap-x-4 py-1 sm:grid-cols-4">
            {(Object.keys(CATEGORY_LABEL) as (keyof AlertSettings["categories"])[]).map((k) => (
              <label key={k} className="flex min-h-10 items-center justify-between gap-2 text-[12px]">
                {CATEGORY_LABEL[k]}
                <Switch checked={s.categories[k]} onCheckedChange={(v) => set({ categories: { ...s.categories, [k]: v } })} aria-label={`${CATEGORY_LABEL[k]} 알림`} />
              </label>
            ))}
          </div>
        </Card>

        <Card title="소리 · 화면" testId="alerts-misc">
          <Row label="알림 소리" hint="짧은 비프음 (기본 꺼짐)">
            <button type="button" onClick={beep} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-[11px] hover:bg-muted/50">
              <Volume2 className="size-3" /> 미리 듣기
            </button>
            <Switch checked={s.sound} onCheckedChange={(v) => set({ sound: v })} aria-label="알림 소리" />
          </Row>
          <Row label="하단 티커 (데스크톱)" hint="HIGH 이상 항목을 화면 아래에 흘려 보여줍니다 (기본 꺼짐)">
            <Switch checked={s.tickerTape} onCheckedChange={(v) => set({ tickerTape: v })} aria-label="하단 티커" />
          </Row>
        </Card>

        <Card title="차트 가격 알림" testId="alerts-price">
          {s.priceAlerts.length === 0 ? (
            <p className="py-3 text-[12px] text-muted-foreground">차트에서 수평선 가격 알림을 추가하면 여기에 표시됩니다.</p>
          ) : (
            s.priceAlerts.map((a) => (
              <Row
                key={a.id}
                label={`${a.name ?? a.code} · ${a.level?.toLocaleString("ko-KR") ?? "—"} ${a.direction === "up" ? "상향 돌파" : a.direction === "down" ? "하향 돌파" : "돌파"}`}
                hint={
                  <>
                    {a.repeat === "once" ? "한 번" : "매번"} · {a.active ? "대기 중" : "완료"}
                    {a.lastFiredAt ? (
                      <>
                        {" "}
                        · 마지막 <TimeStamp publishedAt={a.lastFiredAt} precision="second" />
                      </>
                    ) : null}
                  </>
                }
              >
                <button type="button" onClick={() => removePriceAlert(a.id)} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground hover:text-foreground" aria-label="가격 알림 삭제">
                  <Trash2 className="size-3" /> 삭제
                </button>
              </Row>
            ))
          )}
        </Card>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        알림은 이 앱을 연 브라우저 탭이 있을 때만 동작합니다(탭 하나가 대표로 수신). 브라우저를 닫은 상태의 푸시 알림(Web Push)은 VAPID 키·구독 저장소·스케줄러가 필요해 향후 과제로 남겨 두었습니다.
      </p>
    </div>
  );
}
