import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCrossCorrelation,
  alignByReleaseDate,
  calculateLogReturns,
  calculatePartialCorrelation,
  calculateRolling12MSum,
  calculateRollingCorrelation,
  calculateYoYGrowth,
  convertUsdKrw,
  neweyWestStandardError,
  pearsonWithInference,
  resampleDailyToMonthEnd,
} from "./stats.ts";
import { aggregateProxy } from "./hs-map.ts";
import { destinationRows } from "./destinations.ts";
import { parseFredCsv } from "./parse-fred.ts";
import {
  importIndexCsv,
  importTradeCsv,
  parseCsv,
  parseKoreanNumber,
  parsePeriod,
  type TradeObservation,
} from "./parse-import.ts";
import { completeMonthlyObservations } from "./observation-integrity.ts";
import {
  aggregateHskToMti,
  applyCorporateActionAdjustment,
  deriveExposureFromSegments,
  isEvidenceBackedExposure,
  resolveCompanySectorExposure,
  validateTradeTotals,
  type CompanyExportExposure,
} from "./exposure.ts";
import { resolveRegionalCapability } from "./taxonomy.ts";

const near = (actual: number | null, expected: number, tolerance = 1e-12) => {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(actual! - expected) <= tolerance, `${actual} != ${expected}`);
};
const repeat = (values: number[], n = 6) => Array.from({ length: n }, () => values).flat();

test("Pearson HAC uses the correlation influence, with an exact analytical standard error", () => {
  const x = repeat([-1, -1, 1, 1]);
  const y = repeat([-1, 0, 0, 1]);
  const result = pearsonWithInference(x, y, { transform: "logret" });
  near(result.r, 1 / Math.SQRT2);
  // Influence is [1,-1,-1,1]/(2√2); Bartlett L=3 gives SE=1/(48√2).
  near(result.se, 1 / (48 * Math.SQRT2));
  assert.equal(result.n, 24);
  assert.equal(result.usedHac, true);
  assert.equal(result.insufficient, false);
});

test("correlation inference is invariant to units and origin, with sign reversal", () => {
  const x = repeat([-1, -1, 1, 1]);
  const y = repeat([-1, 0, 0, 1]);
  const base = pearsonWithInference(x, y);
  const scaled = pearsonWithInference(
    x.map((v) => 1000 * v + 12345),
    y.map((v) => -7 * v + 100),
  );
  near(scaled.r, -base.r!);
  near(scaled.se, base.se!);
  const huge = pearsonWithInference(
    x.map((v) => v * 1e200),
    y.map((v) => v * 1e200),
  );
  near(huge.r, base.r!);
  near(huge.se, base.se!);
});

test("monthly YoY HAC includes the eleven overlapping lags", () => {
  const x = [...Array<number>(12).fill(-1), ...Array<number>(12).fill(1)];
  const y = [
    ...Array<number>(6).fill(-1),
    ...Array<number>(6).fill(1),
    ...Array<number>(6).fill(-1),
    ...Array<number>(6).fill(1),
  ];
  // r=0 and ψ=[+1×6,−1×12,+1×6]. Exact Bartlett variance of its mean:
  // L=11 → 73/576; L=3 → 71/576.
  const yoy = pearsonWithInference(x, y, { transform: "yoy" });
  const logret = pearsonWithInference(x, y, { transform: "logret" });
  near(yoy.r, 0);
  near(yoy.se, Math.sqrt(73) / 24);
  near(logret.se, Math.sqrt(71) / 24);
});

test("perfect and constant correlations report their actual inferential availability", () => {
  const x = Array.from({ length: 24 }, (_, i) => i + 1);
  const perfect = pearsonWithInference(
    x,
    x.map((v) => -2 * v + 7),
  );
  near(perfect.r, -1);
  near(perfect.se, 0);
  assert.equal(perfect.usedHac, true);
  const constant = pearsonWithInference(
    x,
    x.map(() => 5),
  );
  assert.equal(constant.r, null);
  assert.equal(constant.se, null);
  assert.equal(constant.usedHac, false);
  assert.equal(constant.insufficient, true);
  assert.equal(pearsonWithInference(x.slice(1), x.slice(1)).r, null);
});

test("Newey–West preserves missing calendar positions instead of compressing time", () => {
  near(neweyWestStandardError([1, 1, NaN, -1, -1], 1), Math.sqrt(1.5 / 4));
  near(neweyWestStandardError([1, 1, -1, -1], 1), Math.sqrt(1.25 / 4));
  assert.equal(neweyWestStandardError([1, 2, 3], -1), null);
});

test("partial correlation uses one common x/y/z observation mask", () => {
  const x = [2, 0, 0, -2],
    y = [3, -1, -1, -1],
    z = [1, 1, -1, -1];
  near(calculatePartialCorrelation(x, y, z), 1 / Math.SQRT2);
  near(
    calculatePartialCorrelation([...x, 99, NaN, 44], [...y, NaN, 77, 55], [...z, 88, 66, NaN]),
    1 / Math.SQRT2,
  );
  assert.equal(
    calculatePartialCorrelation(
      [1, 2, 3, 1, 2, 3, NaN, NaN, NaN],
      [1, 2, 3, NaN, NaN, NaN, 1, 2, 3],
      [NaN, NaN, NaN, 1, 3, 2, 3, 1, 2],
    ),
    null,
  );
});

test("partial correlation is undefined when the control exactly explains one variable", () => {
  const x = Array.from({ length: 24 }, (_, i) => i + 3);
  const y = x.map((_, i) => (i % 5) - (i % 3) * 2);
  assert.equal(calculatePartialCorrelation(x, y, x), null);
  assert.equal(calculatePartialCorrelation(y, x, x), null);
});

test("each displayed correlation window or lag meets its own sample requirement", () => {
  const x = Array.from({ length: 24 }, (_, i) => i);
  const lags = calculateCrossCorrelation(x, x, 1);
  assert.deepEqual(
    lags.map((v) => v.corr),
    [null, 1, null],
  );
  const gapped = [...x];
  gapped[10] = NaN;
  assert.equal(calculateRollingCorrelation(gapped, x).at(-1), null);
});

test("growth and trailing sums do not turn invalid windows or missing months into data", () => {
  assert.deepEqual(calculateLogReturns([]), []);
  assert.ok(calculateLogReturns([Infinity, 1]).every(Number.isNaN));
  assert.ok(calculateYoYGrowth([1, 2], 0).every(Number.isNaN));
  assert.ok(calculateYoYGrowth([Infinity, 2], 1).every(Number.isNaN));
  assert.ok(calculateRolling12MSum([1, NaN, 3], 3).every(Number.isNaN));
  assert.equal(convertUsdKrw(1, Infinity), null);
});

test("month-end sampling rejects impossible dates and non-observed prices", () => {
  assert.deepEqual(
    resampleDailyToMonthEnd([
      { date: "2024-02-28", value: 100 },
      { date: "2024-02-29", value: 101 },
      { date: "2024-02-30", value: 999 },
      { date: "2024-03-31", value: NaN },
      { date: "2024-13-01", value: 500 },
    ]),
    [{ period: "2024-02", value: 101 }],
  );
});

test("HS proxy totals require full coverage and never double count a hierarchy", () => {
  assert.equal(aggregateProxy({ "8542": 5 }, ["8541", "8542"]), null);
  assert.equal(aggregateProxy({ "8541": 0, "8542": 5 }, ["8541", "8542"]), 5);
  assert.equal(aggregateProxy({ "74": 1, "76": 2 }, ["74", "76", "74"]), 3);
  assert.equal(aggregateProxy({ "85": 10, "8542": 5 }, ["85", "8542"]), null);
  assert.equal(aggregateProxy({ "74": -1, "76": 2 }, ["74", "76"]), null);
  assert.equal(aggregateProxy({}, []), null);
});

test("destination shares use the published world denominator, never the top-country subtotal", () => {
  const result = destinationRows([
    { partnerCode: 0, primaryValue: 100 },
    { partnerCode: 840, primaryValue: 30 },
    { partnerCode: 392, primaryValue: 20 },
    { partnerCode: 392, primaryValue: 20 },
  ]);
  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((row) => row.share),
    [0.3, 0.2],
  );
  assert.equal(destinationRows([{ partnerCode: 840, primaryValue: 30 }])[0]!.share, null);
});

test("overlapping or conflicting country coverage cannot produce apparently valid percentages", () => {
  const overlapping = destinationRows([
    { partnerCode: 0, primaryValue: 100 },
    { partnerCode: 840, primaryValue: 70 },
    { partnerCode: 392, primaryValue: 60 },
  ]);
  assert.ok(overlapping.every((row) => row.share == null));
  const conflicting = destinationRows([
    { partnerCode: 0, primaryValue: 100 },
    { partnerCode: 840, primaryValue: 30 },
    { partnerCode: 842, primaryValue: 31 },
    { partnerCode: 392, primaryValue: 20 },
  ]);
  assert.deepEqual(
    conflicting.map((row) => row.partnerCode),
    ["392"],
  );
  assert.equal(conflicting[0]!.share, null);
});

test("period parsing requires a real calendar month in every accepted format", () => {
  for (const raw of ["2024-13", "202413", "202400", "0000-01", "2024-02-29"])
    assert.equal(parsePeriod(raw), null);
  for (const raw of ["202402", "2024.2", "2024년 2월"]) assert.equal(parsePeriod(raw), "2024-02");
});

test("USD import accepts explicit scales but never interprets text, won or quantity as dollars", () => {
  assert.equal(parseKoreanNumber("1,200", "수출액(백만불)"), 1_200_000_000);
  assert.equal(parseKoreanNumber("2.5 백만달러"), 2_500_000);
  assert.equal(parseKoreanNumber("(1,200)"), -1200);
  assert.equal(parseKoreanNumber("0", "USD"), 0);
  for (const raw of ["not available", "12abc34", "12,34", "", "-", "N/A"])
    assert.equal(parseKoreanNumber(raw), null);
  for (const units of ["수출액(원)", "수출량(톤)", "수출액(천달러/백만달러)", "수출액(천만달러)"])
    assert.equal(parseKoreanNumber("100", units), null);
});

test("CSV parsing supports escaped quotes and multiline cells and rejects incomplete quotes", () => {
  assert.deepEqual(parseCsv('name,value\r\n"a ""quoted""\nname",1\r\n'), [
    ["name", "value"],
    ['a "quoted"\nname', "1"],
  ]);
  assert.throws(() => parseCsv('date,value\n2024-01,"100'));
  assert.equal(
    importTradeCsv('date,value\n2024-01,"100', "broken.csv", "MTI_MONTHLY_EXPORT").ok,
    false,
  );
});

test("trade CSV distinguishes item code from amount and quarantines duplicate conflicts", () => {
  const result = importTradeCsv(
    [
      "기간,수출품목코드,품목명,수출액(천달러)",
      "2024-01,8542,집적회로,100",
      "2024-01,8542,집적회로,101",
      "2024-02,8542,집적회로,0",
      "2024-13,8542,집적회로,200",
      "2024-03,8542,집적회로,not available",
    ].join("\n"),
    "hs.csv",
    "HS_MONTHLY_EXPORT",
  );
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]!.period, "2024-02");
  assert.equal(result.rows[0]!.valueUsd, 0);
  assert.ok(result.issues.length >= 3);
  assert.equal(
    importTradeCsv("date,close\n2024-01-02,100", "index.csv", "KOSPI_INDEX_DAILY").ok,
    false,
  );
});

test("daily price imports validate leap days, positive closes and conflicting duplicates", () => {
  const result = importIndexCsv(
    [
      "date,close",
      "2024-02-29,100",
      "2024-02-30,999",
      "2023-02-29,999",
      "20240301,101",
      "2024-03-02,0",
      "2024-03-03,102",
      "2024-03-03,103",
    ].join("\n"),
    "prices.csv",
  );
  assert.deepEqual(
    result.rows.map(({ date, close }) => ({ date, close })),
    [
      { date: "2024-02-29", close: 100 },
      { date: "2024-03-01", close: 101 },
    ],
  );
});

test("daily FX imports use the observed positive exchange rate", () => {
  const result = importIndexCsv(
    "날짜,원/달러 환율\n2024-02-29,1335.7\n2024-03-01,0\n2024-03-02,unavailable",
    "fx.csv",
  );
  assert.deepEqual(result.rows, [{ date: "2024-02-29", close: 1335.7, sourceFile: "fx.csv" }]);
  assert.equal(result.issues.length, 2);
});

test("FRED CSV requires the exact series, actual observations and valid monthly dates", () => {
  const csv = [
    "observation_date,EXPECTED",
    "2024-01-01,",
    "2024-02-30,500",
    "2024-03-01,.",
    "2024-04-01,0",
    "2024-05-01,-1",
    "2024-06-01,100",
  ].join("\n");
  assert.deepEqual(parseFredCsv(csv, "EXPECTED"), [
    { period: "2024-04", valueUsd: 0 },
    { period: "2024-06", valueUsd: 100 },
  ]);
  assert.deepEqual(parseFredCsv(csv, "OTHER"), []);
  assert.deepEqual(parseFredCsv("<html>rate limited</html>", "EXPECTED"), []);
  assert.deepEqual(parseFredCsv("DATE,EXPECTED\n2024-01-01,1\n2024-01-01,2", "EXPECTED"), []);
});

test("FRED unit conversion requires explicit supported series metadata", () => {
  const csv = "DATE,EXPECTED\n2024-01-01,12";
  assert.equal(
    parseFredCsv(csv, "EXPECTED", { units: "Millions of U.S. Dollars", frequency: "Monthly" })[0]!
      .valueUsd,
    12_000_000,
  );
  assert.deepEqual(parseFredCsv(csv, "EXPECTED", { units: "Won" }), []);
  assert.deepEqual(parseFredCsv(csv, "EXPECTED", { units: "Index 2015=100" }), []);
  assert.deepEqual(
    parseFredCsv(csv, "EXPECTED", { units: "U.S. Dollars", frequency: "Quarterly" }),
    [],
  );
});

const observation = (
  period: string,
  valueUsd: number,
  extra: Partial<TradeObservation> = {},
): TradeObservation => ({
  period,
  valueUsd,
  categoryId: "TOTAL",
  classification: "TOTAL",
  sourceFile: "fixture.csv",
  ...extra,
});

test("monthly completion preserves calendar gaps and published zeros without shortening a year", () => {
  const sparse = Array.from({ length: 13 }, (_, i) => {
    const year = 2024 + Math.floor(i / 12),
      month = (i % 12) + 1;
    return observation(
      `${year}-${String(month).padStart(2, "0")}`,
      i === 0 ? 100 : i === 12 ? 150 : 0,
    );
  }).filter((_, i) => i !== 1);
  const completed = completeMonthlyObservations(sparse);
  assert.equal(completed.length, 13);
  assert.ok(Number.isNaN(completed[1]!.valueUsd));
  assert.equal(completed[2]!.valueUsd, 0);
  assert.equal(calculateYoYGrowth(completed.map((row) => row.valueUsd))[12], 50);
  assert.ok(Number.isNaN(calculateRolling12MSum(completed.map((row) => row.valueUsd))[12]!));
});

test("calendar completion rejects mixed series and never silently selects a conflicting revision", () => {
  assert.deepEqual(
    completeMonthlyObservations([
      observation("2024-01", 100, { geo: "서울" }),
      observation("2024-02", 200, { geo: "부산" }),
    ]),
    [],
  );
  const conflict = completeMonthlyObservations([
    observation("2024-01", 100),
    observation("2024-01", 200),
  ]);
  assert.ok(Number.isNaN(conflict[0]!.valueUsd));
  assert.equal(conflict[0]!.vintage, "conflict");
  assert.deepEqual(completeMonthlyObservations([observation("2024-13", 1)]), []);
});

test("a persisted release display setting cannot reorder statistical calendar months", () => {
  const rows = [
    { period: "2024-02", releasedAt: "2024-03-01" },
    { period: "2024-01", releasedAt: "2024-04-01" },
  ];
  assert.deepEqual(
    alignByReleaseDate(rows, "RELEASE").map((row) => row.period),
    ["2024-01", "2024-02"],
  );
});

const exposure = (overrides: Partial<CompanyExportExposure> = {}): CompanyExportExposure => ({
  ticker: "005930",
  companyName: "fixture",
  exportCategoryId: "semiconductors",
  exportCategoryName: "fixture",
  valueChainRole: "DEVICE_MAKER",
  exposureWeight: 0.6,
  mappingConfidence: 0.8,
  mappingType: "PRIMARY",
  verificationStatus: "VERIFIED_MANUAL",
  evidenceSummary: "fixture",
  evidenceSource: ["https://example.com/report"],
  effectiveFrom: "2024-01-01",
  lastReviewedAt: "2024-01-01",
  ...overrides,
});

test("exposure resolution and evidence guard reject nonfinite weights and confidence", () => {
  const valid = exposure();
  const opts = {
    categoryId: "semiconductors",
    asOf: "2024-06-01",
    top100Tickers: new Set(["005930"]),
  };
  assert.deepEqual(resolveCompanySectorExposure([valid], opts), [valid]);
  for (const row of [
    exposure({ exposureWeight: NaN }),
    exposure({ mappingConfidence: NaN }),
    exposure({ exposureWeight: Infinity }),
    exposure({ mappingConfidence: 1.1 }),
  ]) {
    assert.deepEqual(resolveCompanySectorExposure([row], opts), []);
    assert.equal(isEvidenceBackedExposure(row), false);
  }
  assert.deepEqual(resolveCompanySectorExposure([valid], { ...opts, minWeight: NaN }), []);
  assert.equal(isEvidenceBackedExposure(exposure({ effectiveFrom: "2024-02-30" })), false);
  assert.equal(isEvidenceBackedExposure(exposure({ effectiveFrom: "" })), false);
  assert.equal(isEvidenceBackedExposure(exposure({ evidenceSource: ["https://"] })), false);
});

test("segment exposure aggregates categories with a complete finite nonnegative denominator", () => {
  assert.deepEqual(
    deriveExposureFromSegments([
      { categoryId: "a", revenue: 10 },
      { categoryId: "a", revenue: 20 },
      { categoryId: "b", revenue: 70 },
    ]),
    [
      { categoryId: "a", exposureWeight: 0.3 },
      { categoryId: "b", exposureWeight: 0.7 },
    ],
  );
  assert.deepEqual(
    deriveExposureFromSegments([
      { categoryId: "a", revenue: 1 },
      { categoryId: "b", revenue: Infinity },
    ]),
    [],
  );
  assert.deepEqual(
    deriveExposureFromSegments([
      { categoryId: "a", revenue: 1 },
      { categoryId: "b", revenue: -1 },
    ]),
    [],
  );
});

test("HSK-to-MTI aggregation quarantines an incomplete or ambiguous period", () => {
  const crosswalk = [
    { hsk: "8542320000", mti: "813111", version: "v1" },
    { hsk: "8542390000", mti: "813111", version: "v1" },
  ];
  const valid = [
    { hsk: "8542320000", value: 10, period: "2024-01" },
    { hsk: "8542390000", value: 20, period: "2024-01" },
  ];
  assert.deepEqual(aggregateHskToMti(valid, crosswalk, "v1"), [
    { mti: "813111", period: "2024-01", value: 30, derivation: "AGGREGATED_FROM_HSK" },
  ]);
  assert.deepEqual(
    aggregateHskToMti(
      [...valid, { hsk: "9999999999", value: 5, period: "2024-01" }],
      crosswalk,
      "v1",
    ),
    [],
  );
  assert.deepEqual(
    aggregateHskToMti(
      valid,
      [...crosswalk, { hsk: "8542320000", mti: "999999", version: "v1" }],
      "v1",
    ),
    [],
  );
  assert.deepEqual(aggregateHskToMti([...valid, { ...valid[0]!, value: 11 }], crosswalk, "v1"), []);
  assert.equal(aggregateHskToMti([...valid, valid[0]!], crosswalk, "v1")[0]!.value, 30);
  assert.deepEqual(
    aggregateHskToMti(
      [...valid, { hsk: "9999999999", value: 5, period: "2024-02" }],
      crosswalk,
      "v1",
    ).map((row) => row.period),
    ["2024-01"],
  );
});

test("missing totals and invalid corporate-action ratios cannot pass as observed data", () => {
  assert.equal(validateTradeTotals([], 0).pass, false);
  assert.equal(validateTradeTotals([Infinity], Infinity).pass, false);
  assert.equal(validateTradeTotals([0], 0).pass, true);
  assert.equal(applyCorporateActionAdjustment(100, Infinity), null);
  assert.equal(applyCorporateActionAdjustment(100, 2), 50);
});

test("regional capabilities honor the configured classification allowlist", () => {
  const cfg = {
    levels: [
      { id: "NATIONAL", available: true, classifications: ["HS", "HSK", "MTI"] },
      { id: "SIDO", available: true, classifications: ["HS", "MTI"] },
    ],
  };
  assert.equal(resolveRegionalCapability("SIDO", "HSK10", cfg).available, false);
  assert.equal(resolveRegionalCapability("NATIONAL", "HSK10", cfg).available, true);
  assert.equal(resolveRegionalCapability("SIDO", "HS", cfg).available, true);
  assert.equal(resolveRegionalCapability("UNKNOWN", "HS", cfg).available, false);
  assert.equal(resolveRegionalCapability("SIDO", "UNKNOWN", cfg).available, false);
  assert.equal(resolveRegionalCapability("SIGUNGU", "HSK").available, false);
});
