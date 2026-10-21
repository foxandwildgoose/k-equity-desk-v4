/** HS chapter / heading proxies for MOTIE 20대 주력. Not MTI codes. */

export interface HsProxy {
  key: string;
  codes: string[];
  label: string;
  note: string;
}

export const CORE20_HS_PROXY: HsProxy[] = [
  {
    key: "semiconductors",
    codes: ["8542", "8541"],
    label: "HS 8541–8542",
    note: "반도체 소자·집적회로. MOTIE 반도체(메모리/시스템)와 정의가 다를 수 있음",
  },
  {
    key: "electrical_equipment",
    codes: ["85"],
    label: "HS 85",
    note: "전기기기 전체(반도체 포함). 반도체와 이중계산하지 말 것",
  },
  {
    key: "automobiles",
    codes: ["87"],
    label: "HS 87",
    note: "차량 및 부분품 전체. 신차만 집계한 MOTIE 자동차와 다를 수 있음",
  },
  {
    key: "auto_parts",
    codes: ["8708"],
    label: "HS 8708",
    note: "자동차 부분품",
  },
  {
    key: "general_machinery",
    codes: ["84"],
    label: "HS 84",
    note: "보일러·기계류(컴퓨터 포함 가능)",
  },
  {
    key: "computers",
    codes: ["8471"],
    label: "HS 8471",
    note: "자동자료처리기계",
  },
  {
    key: "wireless_devices",
    codes: ["8517"],
    label: "HS 8517",
    note: "전화기·통신기기",
  },
  {
    key: "petrochemicals",
    codes: ["29"],
    label: "HS 29",
    note: "유기화학품. MOTIE 석유화학과 범위 차이 가능",
  },
  {
    key: "petroleum_products",
    codes: ["27"],
    label: "HS 27",
    note: "광물성 연료·석유제품",
  },
  {
    key: "steel",
    codes: ["72"],
    label: "HS 72",
    note: "철강",
  },
  {
    key: "ships",
    codes: ["89"],
    label: "HS 89",
    note: "선박·수상 구조물",
  },
  {
    key: "bio_health",
    codes: ["30"],
    label: "HS 30",
    note: "의료용품. 의료기기(HS 90)는 별도",
  },
  {
    key: "secondary_batteries",
    codes: ["8507"],
    label: "HS 8507",
    note: "축전지",
  },
  {
    key: "cosmetics",
    codes: ["33"],
    label: "HS 33",
    note: "정유·화장품류",
  },
  {
    key: "non_ferrous_metals",
    codes: ["74", "76"],
    label: "HS 74+76",
    note: "구리+알루미늄 (집계)",
  },
  {
    key: "agri_fishery_food",
    codes: [
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "20",
      "21",
      "22",
      "23",
      "24",
    ],
    label: "HS 01–24",
    note: "농수산식품 합산",
  },
  {
    key: "textiles",
    codes: ["50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62", "63"],
    label: "HS 50–63",
    note: "섬유·의류 합산",
  },
  {
    key: "home_appliances",
    codes: ["8418", "8450", "8516"],
    label: "HS 8418/8450/8516",
    note: "가전 일부 헤드. 불완전 커버리지",
  },
  {
    key: "displays",
    codes: ["8524"],
    label: "HS 8524",
    note: "디스플레이 모듈 근사. 미확인 시 N/A",
  },
  {
    key: "household_goods",
    codes: ["94", "96"],
    label: "HS 94+96",
    note: "가구·잡화 근사",
  },
];

export const HS2_KO: Record<string, string> = {
  "01": "산동물",
  "02": "육·식용설육",
  "03": "어패류",
  "04": "낙농품",
  "05": "기타 동물성 생산품",
  "06": "산수목·꽃",
  "07": "채소",
  "08": "과실·견과",
  "09": "커피·차·향신료",
  "10": "곡물",
  "11": "제분공업 생산품",
  "12": "채유용 종자",
  "13": "식물성 엑스",
  "14": "기타 식물성",
  "15": "동식물성 유지",
  "16": "육·어류 조제품",
  "17": "당류·설탕과자",
  "18": "코코아",
  "19": "곡물·베이커리",
  "20": "채소·과실 조제품",
  "21": "기타 조제식료품",
  "22": "음료·주류",
  "23": "사료",
  "24": "담배",
  "25": "광물성 생산품",
  "26": "광석",
  "27": "광물성 연료·석유",
  "28": "무기화학품",
  "29": "유기화학품",
  "30": "의료용품",
  "31": "비료",
  "32": "염료·페인트",
  "33": "향료·화장품",
  "34": "비누·세제",
  "35": "단백질·변성전분",
  "36": "화약류",
  "37": "사진·영화 재료",
  "38": "각종 화학공업 생산품",
  "39": "플라스틱",
  "40": "고무",
  "41": "원피",
  "42": "가죽제품",
  "43": "모피",
  "44": "목재",
  "45": "코르크",
  "46": "조물재료 제품",
  "47": "펄프",
  "48": "지·판지",
  "49": "서적·신문",
  "50": "견",
  "51": "양모",
  "52": "면",
  "53": "기타 식물성 방직용 섬유",
  "54": "인조필라멘트",
  "55": "인조스테이플섬유",
  "56": "워딩·부직포",
  "57": "양탄자",
  "58": "특수직물",
  "59": "침투·도포 직물",
  "60": "편물",
  "61": "의류(편물)",
  "62": "의류(직물)",
  "63": "기타 방직용 섬유제품",
  "64": "신발",
  "65": "모자",
  "66": "우산",
  "67": "조제우모",
  "68": "석·시멘트 제품",
  "69": "도자제품",
  "70": "유리",
  "71": "귀석·귀금속",
  "72": "철강",
  "73": "철강제품",
  "74": "구리",
  "75": "니켈",
  "76": "알루미늄",
  "78": "납",
  "79": "아연",
  "80": "주석",
  "81": "기타 비철금속",
  "82": "공구",
  "83": "비금속제의 각종 제품",
  "84": "보일러·기계류",
  "85": "전기기기",
  "86": "철도차량",
  "87": "차량",
  "88": "항공기",
  "89": "선박",
  "90": "광학·의료기기",
  "91": "시계",
  "92": "악기",
  "93": "무기",
  "94": "가구·조명",
  "95": "완구·운동용구",
  "96": "잡품",
  "97": "예술품·골동품",
};

export const ISO_NUMERIC: Record<string, string> = {
  "0": "전세계",
  "156": "중국",
  "158": "대만",
  "344": "홍콩",
  "392": "일본",
  "410": "한국",
  "704": "베트남",
  "764": "태국",
  "458": "말레이시아",
  "702": "싱가포르",
  "360": "인도네시아",
  "608": "필리핀",
  "356": "인도",
  "036": "호주",
  "554": "뉴질랜드",
  "840": "미국",
  "842": "미국",
  "124": "캐나다",
  "484": "멕시코",
  "076": "브라질",
  "276": "독일",
  "250": "프랑스",
  "380": "이탈리아",
  "724": "스페인",
  "826": "영국",
  "528": "네덜란드",
  "056": "벨기에",
  "616": "폴란드",
  "792": "튀르키예",
  "784": "UAE",
  "682": "사우디",
  "048": "바레인",
  "634": "카타르",
  "490": "기타 아시아(대만 포함 가능)",
  "643": "러시아",
  "710": "남아공",
  "566": "나이지리아",
};

export function hsName(code: string): string {
  if (code.length >= 2 && HS2_KO[code.slice(0, 2)]) {
    const base = HS2_KO[code.slice(0, 2)]!;
    return code.length === 2 ? `${base} (HS ${code})` : `${base} HS ${code}`;
  }
  return `HS ${code}`;
}

export function partnerName(code: string | number | null | undefined): string {
  const k = String(code ?? "");
  return ISO_NUMERIC[k] ?? ISO_NUMERIC[k.padStart(3, "0")] ?? `국가 ${k}`;
}

export function proxyForKey(key: string): HsProxy | undefined {
  return CORE20_HS_PROXY.find((p) => p.key === key);
}

/** Sum a fully observed, non-overlapping HS basket. Missing is never zero. */
export function aggregateProxy(byCode: Record<string, number>, codes: string[]): number | null {
  const unique = [...new Set(codes)];
  if (!unique.length || unique.some((code) => !/^(?:\d{2}|\d{4}|\d{6}|\d{10})$/.test(code)))
    return null;
  // A chapter and a heading within it already include the same exports.
  if (unique.some((code) => unique.some((other) => other !== code && code.startsWith(other))))
    return null;
  let sum = 0;
  for (const c of unique) {
    const v = byCode[c];
    if (v == null || !Number.isFinite(v) || v < 0) return null;
    sum += v;
  }
  return Number.isFinite(sum) ? sum : null;
}
