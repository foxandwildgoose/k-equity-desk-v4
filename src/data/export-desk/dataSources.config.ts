/** Source directory only. Connection health comes from real server provider statuses. */
export interface DataSourceDefinition {
  id: string;
  displayName: string;
  operator: string;
  portal: string;
  baseUrl: string;
  authMode: "SERVICE_KEY_QUERY" | "HEADER_TOKEN" | "NONE";
  classification: "HS" | "HSK" | "MTI" | "NONE";
  geographyLevel:
    "NATIONAL" | "SIDO" | "SIGUNGU" | "CUSTOMS_OFFICE" | "COUNTRY" | "ECONOMIC_BLOC" | "MARKET";
  cadence: "DAILY" | "MONTHLY";
}

export const DATA_SOURCES: DataSourceDefinition[] = [
  {
    id: "customs.total",
    displayName: "수출입총괄",
    operator: "Korea Customs Service",
    portal: "https://www.data.go.kr/data/15102108/openapi.do",
    baseUrl: "https://apis.data.go.kr",
    authMode: "SERVICE_KEY_QUERY",
    classification: "NONE",
    geographyLevel: "NATIONAL",
    cadence: "MONTHLY",
  },
  {
    id: "customs.item",
    displayName: "품목별 수출입실적",
    operator: "Korea Customs Service",
    portal: "https://www.data.go.kr/data/15101609/openapi.do",
    baseUrl: "https://apis.data.go.kr",
    authMode: "SERVICE_KEY_QUERY",
    classification: "HS",
    geographyLevel: "NATIONAL",
    cadence: "MONTHLY",
  },
  {
    id: "customs.item_country",
    displayName: "품목별 국가별 수출입실적",
    operator: "Korea Customs Service",
    portal: "https://www.data.go.kr",
    baseUrl: "https://apis.data.go.kr",
    authMode: "SERVICE_KEY_QUERY",
    classification: "HS",
    geographyLevel: "COUNTRY",
    cadence: "MONTHLY",
  },
  {
    id: "customs.country",
    displayName: "국가별 수출입실적",
    operator: "Korea Customs Service",
    portal: "https://www.data.go.kr/data/15101612/openapi.do",
    baseUrl: "https://apis.data.go.kr",
    authMode: "SERVICE_KEY_QUERY",
    classification: "NONE",
    geographyLevel: "COUNTRY",
    cadence: "MONTHLY",
  },
  {
    id: "customs.sido",
    displayName: "시도별 수출입실적",
    operator: "Korea Customs Service",
    portal: "https://www.data.go.kr",
    baseUrl: "https://apis.data.go.kr",
    authMode: "SERVICE_KEY_QUERY",
    classification: "NONE",
    geographyLevel: "SIDO",
    cadence: "MONTHLY",
  },
  {
    id: "kita.kstat",
    displayName: "KITA K-stat (MTI)",
    operator: "KITA",
    portal: "https://stat.kita.net",
    baseUrl: "https://stat.kita.net",
    authMode: "NONE",
    classification: "MTI",
    geographyLevel: "NATIONAL",
    cadence: "MONTHLY",
  },
  {
    id: "motie.release",
    displayName: "MOTIE 수출입 동향",
    operator: "MOTIE",
    portal: "https://www.motie.go.kr",
    baseUrl: "https://www.motie.go.kr",
    authMode: "NONE",
    classification: "MTI",
    geographyLevel: "NATIONAL",
    cadence: "MONTHLY",
  },
  {
    id: "krx.datasys",
    displayName: "KRX 정보데이터시스템",
    operator: "KRX",
    portal: "https://data.krx.co.kr",
    baseUrl: "https://data.krx.co.kr",
    authMode: "NONE",
    classification: "NONE",
    geographyLevel: "MARKET",
    cadence: "DAILY",
  },
  {
    id: "naver.kospi",
    displayName: "KOSPI / 종목 시세 (Naver·Yahoo)",
    operator: "Naver Finance / Yahoo",
    portal: "https://finance.naver.com/sise/sise_index.naver?code=KOSPI",
    baseUrl: "https://query1.finance.yahoo.com",
    authMode: "NONE",
    classification: "NONE",
    geographyLevel: "MARKET",
    cadence: "DAILY",
  },
  {
    id: "bok.fx",
    displayName: "원/달러 월별 (Yahoo Finance)",
    operator: "Yahoo Finance (월별) / Naver (조회값)",
    portal: "https://finance.yahoo.com/quote/USDKRW=X/history/",
    baseUrl: "https://query1.finance.yahoo.com",
    authMode: "NONE",
    classification: "NONE",
    geographyLevel: "MARKET",
    cadence: "DAILY",
  },
];
