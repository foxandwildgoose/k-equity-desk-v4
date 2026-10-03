import type { SectorId } from "@/data/types";

export type ResearchSectorRule = {
  sectorId: SectorId;
  label: string;
  keywords: string[];
  naverUpjongs: string[];
};

/** Official Naver industry_list `upjong` values, EUC-KR encoded. */
export const NAVER_UPJONG_ENC: Record<string, string> = {
  건설: "%B0%C7%BC%B3",
  건자재: "%B0%C7%C0%DA%C0%E7",
  광고: "%B1%A4%B0%ED",
  금융: "%B1%DD%C0%B6",
  기계: "%B1%E2%B0%E8",
  휴대폰: "%C8%DE%B4%EB%C6%F9",
  담배: "%B4%E3%B9%E8",
  유통: "%C0%AF%C5%EB",
  미디어: "%B9%CC%B5%F0%BE%EE",
  바이오: "%B9%D9%C0%CC%BF%C0",
  반도체: "%B9%DD%B5%B5%C3%BC",
  보험: "%BA%B8%C7%E8",
  석유화학: "%BC%AE%C0%AF%C8%AD%C7%D0",
  섬유의류: "%BC%B6%C0%AF%C0%C7%B7%F9",
  소프트웨어: "%BC%D2%C7%C1%C6%AE%BF%FE%BE%EE",
  운수창고: "%BF%EE%BC%F6%C3%A2%B0%ED",
  유틸리티: "%C0%AF%C6%BF%B8%AE%C6%BC",
  은행: "%C0%BA%C7%E0",
  인터넷포탈: "%C0%CE%C5%CD%B3%DD%C6%F7%C5%BB",
  자동차: "%C0%DA%B5%BF%C2%F7",
  전기전자: "%C0%FC%B1%E2%C0%FC%C0%DA",
  제약: "%C1%A6%BE%E0",
  조선: "%C1%B6%BC%B1",
  종이: "%C1%BE%C0%CC",
  증권: "%C1%F5%B1%C7",
  철강금속: "%C3%B6%B0%AD%B1%DD%BC%D3",
  타이어: "%C5%B8%C0%CC%BE%EE",
  통신: "%C5%EB%BD%C5",
  항공운송: "%C7%D7%B0%F8%BF%EE%BC%DB",
  홈쇼핑: "%C8%A8%BC%EE%C7%CE",
  음식료: "%C0%BD%BD%C4%B7%E1",
  여행: "%BF%A9%C7%E0",
  게임: "%B0%D4%C0%D3",
  IT: "IT",
  에너지: "%BF%A1%B3%CA%C1%F6",
  해운: "%C7%D8%BF%EE",
  지주회사: "%C1%F6%C1%D6%C8%B8%BB%E7",
  디스플레이: "%B5%F0%BD%BA%C7%C3%B7%B9%C0%CC",
  화장품: "%C8%AD%C0%E5%C7%B0",
  자동차부품: "%C0%DA%B5%BF%C2%F7%BA%CE%C7%B0",
  교육: "%B1%B3%C0%B0",
};

export const RESEARCH_SECTOR_RULES: ResearchSectorRule[] = [
  {
    sectorId: "us-linked",
    label: "미국 연계",
    keywords: [
      "미국", "IRA", "CHIPS", "바이든", "트럼프", "워싱턴", "연준", "Fed",
      "달러", "나스닥", "S&P", "미중", "수출통제", "관세", "동맹", "FMS",
    ],
    naverUpjongs: ["반도체", "에너지", "자동차", "바이오", "전기전자"],
  },
  { sectorId: "semiconductors", label: "반도체", keywords: ["반도체", "HBM", "DRAM", "NAND", "파운드리", "메모리", "웨이퍼", "후공정", "패키징"], naverUpjongs: ["반도체"] },
  { sectorId: "electronics", label: "전자·IT", keywords: ["전자", "디스플레이", "OLED", "MLCC", "스마트폰", "IT하드웨어", "PCB", "카메라모듈"], naverUpjongs: ["전기전자", "디스플레이", "휴대폰", "IT"] },
  { sectorId: "auto", label: "자동차·부품", keywords: ["자동차", "완성차", "전기차", "EV", "자율주행", "타이어", "자동차부품"], naverUpjongs: ["자동차", "자동차부품", "타이어"] },
  { sectorId: "battery", label: "2차전지", keywords: ["2차전지", "배터리", "양극재", "음극재", "전해액", "분리막", "리튬", "ESS"], naverUpjongs: ["에너지", "전기전자", "석유화학"] },
  { sectorId: "bio", label: "바이오·제약", keywords: ["바이오", "제약", "헬스케어", "CDMO", "CMO", "임상", "신약", "바이오시밀러"], naverUpjongs: ["바이오", "제약"] },
  { sectorId: "finance", label: "금융", keywords: ["은행", "보험", "증권", "금융", "NIM", "대손", "주주환원"], naverUpjongs: ["금융", "은행", "증권", "보험"] },
  { sectorId: "shipbuilding", label: "조선·중공업", keywords: ["조선", "LNG선", "선박", "선가", "해양플랜트", "엔진", "중공업"], naverUpjongs: ["조선", "해운"] },
  { sectorId: "chemicals", label: "화학", keywords: ["화학", "석유화학", "스프레드", "정유", "스페셜티", "PVC", "에틸렌"], naverUpjongs: ["석유화학"] },
  { sectorId: "energy", label: "에너지·유틸리티", keywords: ["원전", "SMR", "전력", "전력기기", "변압기", "유틸리티", "태양광", "풍력", "가스", "발전"], naverUpjongs: ["에너지", "유틸리티"] },
  { sectorId: "telecom", label: "통신·미디어", keywords: ["통신", "5G", "미디어", "플랫폼", "인터넷", "게임", "콘텐츠", "광고"], naverUpjongs: ["통신", "미디어", "인터넷포탈", "게임"] },
  { sectorId: "consumer", label: "소비재·유통", keywords: ["소비", "유통", "화장품", "음식료", "식품", "면세", "리테일", "K-뷰티"], naverUpjongs: ["유통", "음식료", "화장품", "홈쇼핑", "섬유의류"] },
  { sectorId: "construction", label: "건설·부동산", keywords: ["건설", "주택", "분양", "부동산", "PF", "플랜트"], naverUpjongs: ["건설", "건자재"] },
  { sectorId: "steel", label: "철강·금속", keywords: ["철강", "강판", "철광석", "금속", "알루미늄", "구리", "비철"], naverUpjongs: ["철강금속"] },
  // F6.8: robot-specific terms only. Bare "AI"/"인공지능" counts only together with a robot term.
  { sectorId: "robotics", label: "로봇·AI", keywords: ["로봇", "로보틱스", "휴머노이드", "협동로봇", "산업용 로봇", "물류로봇", "AMR", "서비스로봇", "감속기", "액추에이터", "서보", "모션제어", "피지컬 AI", "physical AI", "embodied", "robot", "robotics", "humanoid", "cobot"], naverUpjongs: ["기계", "IT", "소프트웨어"] },
  { sectorId: "defense", label: "방산·항공우주", keywords: ["방산", "국방", "항공우주", "위성", "미사일", "유도무기", "전투기"], naverUpjongs: ["기계"] },
];

/** Robot terms that must be present for bare "AI"/"인공지능" to count as robotics (F6.8). */
export const ROBOT_TERMS = RESEARCH_SECTOR_RULES.find((r) => r.sectorId === "robotics")!.keywords;

const LATIN_ROBOT = /^[a-z ]+$/i;

function hasTerm(normalized: string, keyword: string): boolean {
  const k = keyword.toLowerCase();
  if (LATIN_ROBOT.test(keyword) && keyword.length <= 5) {
    // Short Latin terms (AMR, robot, cobot) match on word boundaries only.
    return new RegExp(`(^|[^a-z])${k.replace(/ /g, "\\s")}($|[^a-z])`).test(normalized);
  }
  return normalized.includes(k);
}

/** Robotics iff a robot-specific term appears (bare AI/인공지능 alone never qualifies). */
export function isRoboticsText(text: string): boolean {
  const normalized = text.toLowerCase();
  return ROBOT_TERMS.some((k) => hasTerm(normalized, k));
}

export function classifyResearchSectors(text: string): SectorId[] {
  const normalized = text.toLowerCase();
  return RESEARCH_SECTOR_RULES.filter((rule) =>
    rule.sectorId === "robotics" ? isRoboticsText(text) : rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  ).map((rule) => rule.sectorId);
}

export function researchSectorLabel(id: SectorId): string {
  return RESEARCH_SECTOR_RULES.find((r) => r.sectorId === id)?.label ?? id;
}
