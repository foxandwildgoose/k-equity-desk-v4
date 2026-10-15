const KO: Record<string, string> = {
  "export.desk.title": "Korea Export × KOSPI Intelligence Desk",
  "export.total.title": "대한민국 총수출 × KOSPI",
  "export.core20.title": "수출 참고 품목",
  "export.all.title": "전체 수출 산업",
  "export.industry100.title": "산업 × KOSPI Top 100",
  "export.corr.title": "상관관계 / 선후행",
  "export.region.title": "지역 수출",
  "export.qa.title": "데이터 품질 / 출처",
  "export.admin.title": "매핑 관리",
  "export.import.title": "데이터 가져오기",
  "export.empty.exports":
    "공식 시계열을 불러오는 중이거나 소스가 비어 있습니다. 품질 탭에서 출처를 확인하세요.",
  "export.empty.sector": "확인된 시총·노출 자료에서 매칭 기업을 찾지 못했습니다. 관측일이나 근거 자료가 없으면 매칭을 확정하지 않습니다.",
  "export.unverified": "미검증 매핑",
  "export.candidatesHidden": "검증 대기 후보 기업이 숨겨져 있습니다.",
  "export.provenance": "출처",
  "export.insufficient": "Insufficient data",
  "export.preliminary": "PRELIMINARY / PARTIAL MONTH",
  "export.seasonal": "seasonal — for reference",
  "export.spliced": "SPLICED — not an official series",
  "export.aggregated": "AGGREGATED_FROM_HSK",
  "export.taxonomy.badge": "분류체계",
};

const EN: Record<string, string> = {
  "export.desk.title": "Korea Export × KOSPI Intelligence Desk",
  "export.total.title": "Korea Total Exports × KOSPI",
  "export.core20.title": "Reference Export Categories",
  "export.all.title": "All Export Industries",
  "export.industry100.title": "Industry × KOSPI Top 100",
  "export.corr.title": "Correlation / Lead-lag",
  "export.region.title": "Regional exports",
  "export.qa.title": "Data quality / provenance",
  "export.admin.title": "Mapping admin",
  "export.import.title": "Import data",
  "export.empty.exports":
    "Official series is loading or unavailable. Check the quality tab for provenance.",
  "export.empty.sector": "No matching company could be verified from the available dated market-cap and exposure evidence.",
  "export.unverified": "Unverified mapping",
  "export.candidatesHidden": "Candidate companies hidden pending verification.",
  "export.provenance": "Source",
  "export.insufficient": "Insufficient data",
  "export.preliminary": "PRELIMINARY / PARTIAL MONTH",
  "export.seasonal": "seasonal — for reference",
  "export.spliced": "SPLICED — not an official series",
  "export.aggregated": "AGGREGATED_FROM_HSK",
  "export.taxonomy.badge": "Taxonomy",
};

export type DeskLang = "ko" | "en";

export function t(key: string, lang: DeskLang): string {
  const table = lang === "en" ? EN : KO;
  return table[key] ?? key;
}
