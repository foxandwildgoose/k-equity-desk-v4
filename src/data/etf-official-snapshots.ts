/**
 * Dated issuer documents supplied by the user. These are historical records,
 * never a substitute for a successful retrieval of the issuer's latest basket.
 * Only the exact ETF code below is eligible for this snapshot.
 */
export type UploadedIssuerHoldingSnapshot = {
  code: string;
  fundName: string;
  issuerName: string;
  asOf: string;
  issuerUrl: null;
  source: string;
  provenance: {
    filename: string;
    sha256: string;
    byteLength: number;
    format: "xls";
  };
  rows: {
    nameKo: string;
    weight: number;
    quantity: number;
    valuationKrw: number;
    code: string | null;
    isin: string | null;
    asOf: string;
  }[];
};

const AS_OF = "2026-10-08";

export const SOL_DRAM_20261008_SNAPSHOT: UploadedIssuerHoldingSnapshot = {
  code: "0246X0",
  fundName: "신한SOL글로벌DRAM반도체플러스증권상장지수투자신탁[주식]",
  issuerName: "신한자산운용",
  asOf: AS_OF,
  issuerUrl: null,
  source: "신한자산운용 SOL · 사용자 첨부 공식 구성종목 XLS (2026-10-08 기준, 과거 자료)",
  provenance: {
    filename: "PDF_DATA_신한SOL글로벌DRAM반도체플러스증권상장지수투자신탁[주식].xls",
    sha256: "8181d3c7bf15076729cf0293acc7bb0fc7b447e02dd5fbb12a60610e58a9b730",
    byteLength: 6144,
    format: "xls",
  },
  rows: [
    {
      nameKo: "삼성전자",
      code: "005930",
      isin: null,
      quantity: 457,
      valuationKrw: 122704500,
      weight: 25.23,
      asOf: AS_OF,
    },
    {
      nameKo: "Micron Technology Inc",
      code: null,
      isin: "US5951121038",
      quantity: 85.06,
      valuationKrw: 119208921,
      weight: 24.51,
      asOf: AS_OF,
    },
    {
      nameKo: "SK하이닉스",
      code: "000660",
      isin: null,
      quantity: 69,
      valuationKrw: 118887000,
      weight: 24.45,
      asOf: AS_OF,
    },
    {
      nameKo: "Sandisk Corp/DE",
      code: null,
      isin: "US80004C2008",
      quantity: 10.48,
      valuationKrw: 23325132,
      weight: 4.8,
      asOf: AS_OF,
    },
    {
      nameKo: "APPLIED MATERIALS INC",
      code: null,
      isin: "US0382221051",
      quantity: 28.73,
      valuationKrw: 20420534,
      weight: 4.2,
      asOf: AS_OF,
    },
    {
      nameKo: "LAM RESEARCH CORP",
      code: null,
      isin: "US5128073062",
      quantity: 45.31,
      valuationKrw: 20278316,
      weight: 4.17,
      asOf: AS_OF,
    },
    {
      nameKo: "Kioxia Holdings Corp",
      code: null,
      isin: "JP3236330001",
      quantity: 119.18,
      valuationKrw: 18911908,
      weight: 3.89,
      asOf: AS_OF,
    },
    {
      nameKo: "Seagate Technology Holdings",
      code: null,
      isin: "IE00BKVD2N49",
      quantity: 12.44,
      valuationKrw: 13433538,
      weight: 2.76,
      asOf: AS_OF,
    },
    {
      nameKo: "KLA-TENCOR CORP",
      code: null,
      isin: "US4824801009",
      quantity: 47.25,
      valuationKrw: 12505911,
      weight: 2.57,
      asOf: AS_OF,
    },
    {
      nameKo: "WESTERN_DIGITAL",
      code: null,
      isin: "US9581021055",
      quantity: 19.58,
      valuationKrw: 10787757,
      weight: 2.22,
      asOf: AS_OF,
    },
    {
      nameKo: "현금성자산",
      code: null,
      isin: "KRD010010001",
      quantity: 5834001,
      valuationKrw: 5834001,
      weight: 1.2,
      asOf: AS_OF,
    },
  ],
};

/** Return copies so a caller cannot mutate the shared historical record. */
export function findUploadedIssuerHoldingsSnapshot(
  code: string,
): UploadedIssuerHoldingSnapshot | null {
  if (code.trim().toUpperCase() !== SOL_DRAM_20261008_SNAPSHOT.code) return null;
  return {
    ...SOL_DRAM_20261008_SNAPSHOT,
    provenance: { ...SOL_DRAM_20261008_SNAPSHOT.provenance },
    rows: SOL_DRAM_20261008_SNAPSHOT.rows.map((row) => ({ ...row })),
  };
}
