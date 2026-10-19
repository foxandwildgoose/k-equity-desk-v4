/** A disclosure date and its receipt time are different facts. */
export function koreaDisclosureDay(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function holdingsDisclosureStatus(input: {
  asOf: string | null;
  sourceKind: string;
  officialCount: number;
  rowCount: number;
}, now = new Date()) {
  if (!input.asOf || input.officialCount === 0) return {
    status: "unavailable" as const,
    reason: "운용사 공시 자료를 수신·검증하지 못했습니다. 공식 사이트 버튼의 연결 여부와 비중 수신 여부는 별개입니다. 미확인 비중은 추정하지 않습니다.",
  };
  const today = koreaDisclosureDay(now);
  const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${input.asOf}T00:00:00Z`)) / 86_400_000;
  const historical = input.sourceKind === "issuer-file" || age > 7;
  const missing = input.rowCount - input.officialCount;
  return {
    status: historical ? "historical" as const : "current" as const,
    reason: `${input.asOf} 기준 운용사 공표 비중입니다. 실시간 시세나 환율로 다시 계산하지 않습니다.${missing > 0 ? ` 운용사가 비중을 제공하지 않은 ${missing}개 현금 항목은 — 로 남깁니다. 합계는 공표 비중이 있는 항목만 합산합니다.` : ""}${historical ? " 최신 공시를 확보하지 못했으므로 현재 구성과 다를 수 있습니다." : age < 0 ? " 운용사가 미리 게시한 다음 기준일의 구성내역입니다." : ""}`,
  };
}
