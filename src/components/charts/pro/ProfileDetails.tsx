import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VolumeProfile } from "@/lib/chart-indicators";
import { PROFILE_METHOD_LABEL, type ProfileMetadata } from "@/lib/charts/hts-settings";

export interface ProfileDetailsProps {
  profile: VolumeProfile | null;
  metadata: ProfileMetadata;
  onExport?: () => void;
}

const quantity = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
const exact = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: 12 });
const price = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: 6 });
const range = (from: string | null | undefined, to: string | null | undefined) => `${from ?? "미확인"} ~ ${to ?? "미확인"}`;

/** Accessible full detail remains available when dense canvas labels must be culled. */
export function ProfileDetails({ profile, metadata, onExport }: ProfileDetailsProps) {
  const basis = profile?.basis ?? "volume";
  const unit = basis === "volume" ? metadata.quantityUnit : metadata.currency;
  const approx = metadata.estimated !== false ? "약 " : "";
  const cells = [
    ["종목", `${metadata.name ? `${metadata.name} · ` : ""}${metadata.code} · ${metadata.market} · ${metadata.instrument.toUpperCase()}`],
    ["집계 범위", metadata.rangeMode === "visible" ? "현재 보이는 시간 구간" : metadata.rangeMode === "fixed" ? "지정 시작일~종료일" : "불러온 전체 기간"],
    ["요청 기간", range(metadata.requestedFrom ?? metadata.actualFrom, metadata.requestedTo ?? metadata.actualTo)],
    ["실제 확보 기간", range(metadata.actualFrom, metadata.actualTo)],
    ["원천 해상도", metadata.sourceResolution],
    ["계산 방식", `${PROFILE_METHOD_LABEL}${basis === "turnover" ? " · 종가×거래량 추정 거래대금" : ""}`],
    ["수량 단위 / 가격 통화", `${metadata.quantityUnit} / ${metadata.currency}`],
    ["출처", metadata.source],
    ["원천 기준 시각", metadata.asOf ?? "미확인"],
    ["취득 시각", metadata.fetchedAt ?? "미확인"],
    ["가격·거래량 조정 기준", metadata.adjustment],
    ["전체 유효 거래량", profile ? `${exact(profile.totalVolume)}${metadata.quantityUnit}` : "—"],
    ["선택 기준 전체 합계", profile ? `${approx}${exact(profile.totalValue)}${unit}` : "—"],
    ["유효 봉 / 제외 봉", profile ? `${profile.validBars} / ${profile.excludedBars}` : "—"],
  ];
  return (
    <details className="min-w-0 border-t border-border px-3 py-2 text-xs" data-testid="profile-details">
      <summary className="min-h-11 cursor-pointer content-center font-medium text-foreground">매물대 상세 · 가격 구간별 수량·비율{profile ? ` (${profile.rows.length}구간)` : ""}</summary>
      <div className="space-y-3 pb-2">
        {metadata.adjustmentWarning && <p role="status" className="rounded-md border border-border bg-muted px-3 py-2 leading-relaxed text-foreground">{metadata.adjustmentWarning}</p>}
        <dl className="grid gap-x-4 gap-y-2 text-muted-foreground sm:grid-cols-2">{cells.map(([label, value]) => <div key={label} className="min-w-0"><dt className="font-medium">{label}</dt><dd className="mt-0.5 break-words text-foreground">{value}</dd></div>)}</dl>
        <p className="leading-relaxed text-muted-foreground">비율의 분모는 선택 기간의 전체 유효 {basis === "volume" ? "거래량" : "추정 거래대금"}입니다. 수량은 화면에서만 반올림하며, CSV에는 내부 정밀도를 유지합니다. 제외된 봉은 합계에 포함하지 않습니다.</p>
        {profile?.rows.length ? <div className="max-w-full overflow-x-auto rounded-md border border-border" tabIndex={0} aria-label="매물대 구간 상세표 가로 스크롤">
          <table className="w-full border-collapse text-left tabular-nums">
            <caption className="sr-only">{metadata.name ?? metadata.code} 매물대 가격 구간별 {basis === "volume" ? "거래량" : "거래대금"}, 전체 대비 비율 및 POC·Value Area. {metadata.source} {metadata.asOf ?? "기준 시각 미확인"}</caption>
            <thead className="bg-muted text-muted-foreground"><tr><th scope="col" className="whitespace-nowrap px-3 py-2 font-medium">가격 범위 ({metadata.currency})</th><th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">{basis === "volume" ? "수량" : "거래대금"} ({unit})</th><th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">전체 대비</th><th scope="col" className="whitespace-nowrap px-3 py-2 font-medium">가격대</th></tr></thead>
            <tbody>{profile.rows.map((row, index) => {
              const isPoc = profile.poc != null && profile.poc >= row.low && (profile.poc < row.high || index === profile.rows.length - 1 && profile.poc <= row.high);
              const inValueArea = profile.val != null && profile.vah != null && row.low >= profile.val && row.high <= profile.vah;
              return <tr key={`${row.low}:${index}`} className="border-t border-border text-foreground"><th scope="row" className="whitespace-nowrap px-3 py-2 font-normal">{price(row.low)} ~ {price(row.high)}</th><td className="whitespace-nowrap px-3 py-2 text-right" title={`${approx}${exact(row.volume)}${unit}`}>{approx}{quantity(row.volume)}{unit}</td><td className="whitespace-nowrap px-3 py-2 text-right" title={`${row.percent}%`}>{row.percent.toFixed(1)}%</td><td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{[isPoc ? "POC" : "", inValueArea ? "VA" : ""].filter(Boolean).join(" · ") || "—"}</td></tr>;
            })}</tbody>
          </table>
        </div> : <p role="status" className="rounded-md bg-muted px-3 py-3 text-muted-foreground">선택 기간에 집계할 수 있는 유효 거래량이 없습니다.</p>}
        {profile && <p className="text-muted-foreground">POC {profile.poc == null ? "—" : price(profile.poc)} · VAL {profile.val == null ? "—" : price(profile.val)} · VAH {profile.vah == null ? "—" : price(profile.vah)} ({metadata.currency})</p>}
        {onExport && <Button type="button" variant="outline" size="sm" className="min-h-11 text-xs" onClick={onExport} disabled={!profile}><Download className="size-3.5" />매물대 수량·비율 CSV</Button>}
      </div>
    </details>
  );
}
