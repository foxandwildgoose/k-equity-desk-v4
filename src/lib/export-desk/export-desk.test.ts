import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculatePearson,
  calculatePartialCorrelation,
  calculateRolling12MSum,
  calculateYoYGrowth,
  neweyWestStandardError,
  calculateWorkingDayAdjusted,
  normalizeToBase100,
  pearsonWithInference,
  sufficiencyGate,
  convertUsdKrw,
  MIN_SAMPLE,
  fxRateForPeriod,
} from "./stats.ts";
import {
  rankKospiByMarketCap,
  resolvePointInTimeTop100,
  type RankableSecurity,
} from "./ranking.ts";
import {
  resolveCompanySectorExposure,
  validateWeightConservation,
  aggregateHskToMti,
  assertNoMtiInHsParams,
  isEvidenceBackedExposure,
  type CompanyExportExposure,
} from "./exposure.ts";
import { parsePeriod, parseKoreanNumber, importTradeCsv } from "./parse-import.ts";
import { resolveRegionalCapability } from "./taxonomy.ts";
import { assertNoSyntheticLeak, sanitizeExportDeskSnapshot } from "./demo-guard.ts";
import { completeMonthlyObservations } from "./observation-integrity.ts";
import { destinationRows } from "./destinations.ts";
import { capQuoteFromProvider, observedCapRanking } from "./cap-ranking.ts";
import { normalizeNaverListingQuote } from "../quote-normalization.ts";
import { aggregateProxy } from "./hs-map.ts";
import { parseFredCsv } from "./parse-fred.ts";

function exp(
  over: Partial<CompanyExportExposure> & Pick<CompanyExportExposure, "ticker" | "exportCategoryId">,
): CompanyExportExposure {
  return {
    companyName: over.ticker,
    valueChainRole: "DEVICE_MAKER",
    exposureWeight: 0.6,
    mappingConfidence: 0.8,
    mappingType: "PRIMARY",
    verificationStatus: "VERIFIED_MANUAL",
    evidenceSummary: "fixture",
    evidenceSource: [],
    effectiveFrom: "2018-01-01",
    lastReviewedAt: "2026-01-01",
    exportCategoryName: over.exportCategoryId,
    ...over,
  };
}

test("T1 national 12M rolling default series", () => {
  const monthly = Array.from({ length: 24 }, (_, i) => 10 + i);
  const roll = calculateRolling12MSum(monthly);
  assert.equal(
    roll[11],
    monthly.slice(0, 12).reduce((a, b) => a + b, 0),
  );
  const idx = normalizeToBase100(roll.filter(Number.isFinite));
  assert.ok(Math.abs(idx[0]! - 100) < 1e-9);
});

test("T2 semiconductor strict matching", () => {
  const rows = [
    exp({ ticker: "005930", exportCategoryId: "semiconductors" }),
    exp({ ticker: "000660", exportCategoryId: "semiconductors" }),
    exp({ ticker: "010950", exportCategoryId: "petroleum_products" }),
    exp({ ticker: "005380", exportCategoryId: "automobiles" }),
    exp({ ticker: "090430", exportCategoryId: "cosmetics" }),
    exp({ ticker: "055550", exportCategoryId: "banks" }),
    exp({ ticker: "009540", exportCategoryId: "ships" }),
  ];
  const top = new Set(rows.map((r) => r.ticker));
  const got = resolveCompanySectorExposure(rows, {
    categoryId: "semiconductors",
    asOf: "2026-01-01",
    top100Tickers: top,
    minWeight: 0.2,
    minConfidence: 0.7,
    primaryOnly: false,
  }).map((r) => r.ticker);
  assert.deepEqual(got.sort(), ["000660", "005930"]);
});

test("T3 petroleum excludes petrochem-only and semis", () => {
  const rows = [
    exp({ ticker: "010950", exportCategoryId: "petroleum_products" }),
    exp({ ticker: "051910", exportCategoryId: "petrochemicals" }),
    exp({ ticker: "005930", exportCategoryId: "semiconductors" }),
  ];
  const got = resolveCompanySectorExposure(rows, {
    categoryId: "petroleum_products",
    asOf: "2026-01-01",
    top100Tickers: new Set(rows.map((r) => r.ticker)),
    minWeight: 0.2,
    minConfidence: 0.7,
    primaryOnly: false,
  }).map((r) => r.ticker);
  assert.deepEqual(got, ["010950"]);
});

test("T4 point-in-time membership never applies today retroactively", () => {
  const hist: RankableSecurity[] = [
    { ticker: "X", name: "X", marketCap: 9e13, date: "2019-12-31" },
    { ticker: "Y", name: "Y", marketCap: 8e13, date: "2019-12-31" },
  ];
  const now: RankableSecurity[] = [
    { ticker: "Y", name: "Y", marketCap: 9e13, date: "2026-06-30" },
    { ticker: "Z", name: "Z", marketCap: 8e13, date: "2026-06-30" },
  ];
  const snaps = [
    { date: "2019-12-31", members: rankKospiByMarketCap(hist, { n: 100, date: "2019-12-31" }) },
    { date: "2026-06-30", members: rankKospiByMarketCap(now, { n: 100, date: "2026-06-30" }) },
  ];
  const in2019 = resolvePointInTimeTop100(snaps, "2019-12-31").map((m) => m.ticker);
  const in2026 = resolvePointInTimeTop100(snaps, "2026-06-30").map((m) => m.ticker);
  assert.ok(in2019.includes("X"));
  assert.ok(!in2026.includes("X"));
});

test("T5 completeness enumerates non-zero categories beyond core20", () => {
  const csv =
    "기간,품목,코드,수출액\n2024-01,기타,hs-99,1000000\n2024-01,반도체,semiconductors,5000000\n";
  const res = importTradeCsv(csv, "fix.csv", "MTI_MONTHLY_EXPORT");
  assert.equal(res.ok, true);
  const ids = new Set(res.rows.map((r) => r.categoryId));
  assert.ok(ids.has("hs-99"));
  assert.ok(ids.has("semiconductors"));
});

test("T6 no MTI into HS params; aggregated flag", () => {
  assert.throws(() => assertNoMtiInHsParams({ hsCode: "MTI813" }));
  const agg = aggregateHskToMti(
    [{ hsk: "8542320000", value: 10, period: "2024-01" }],
    [{ hsk: "8542320000", mti: "813111", version: "MTI-2026" }],
    "MTI-2026",
  );
  assert.equal(agg[0]?.derivation, "AGGREGATED_FROM_HSK");
});

test("T7 HAC on YoY path", () => {
  const x = Array.from({ length: 36 }, (_, i) => 100 + i + (i % 3));
  const y = x.map((v, i) => v * 1.1 + (i % 2));
  const yx = calculateYoYGrowth(x);
  const yy = calculateYoYGrowth(y);
  const inf = pearsonWithInference(yx, yy, { transform: "yoy" });
  assert.equal(inf.insufficient, false);
  assert.ok(inf.se != null);
  const residuals = yx.filter(Number.isFinite);
  const se = neweyWestStandardError(residuals.map((v, i, a) => (i === 0 ? 0 : v - a[i - 1]!)));
  assert.ok(se === null || se >= 0);
});

test("T8 sufficiency gate N=20", () => {
  const g = sufficiencyGate(20);
  assert.equal(g.ok, false);
  assert.ok(MIN_SAMPLE > 20);
});

test("T9 regional sigungu x HSK10 unavailable", () => {
  const cap = resolveRegionalCapability("SIGUNGU", "HSK10", {
    levels: [{ id: "SIGUNGU", available: false, reason: "not published at HSK-10" }],
  });
  assert.equal(cap.available, false);
  assert.ok(cap.reason);
});

test("T10 provenance fields exist on imported rows", () => {
  const csv = "기간,품목,코드,수출액\n2024-01,총수출,TOTAL,1000000000\n";
  const res = importTradeCsv(csv, "kita.csv", "MTI_MONTHLY_EXPORT");
  assert.equal(res.ok, true);
  assert.ok(res.rows[0]?.sourceFile);
  assert.ok(res.rows[0]?.period);
});

test("T11 demo isolation", () => {
  assert.throws(() => assertNoSyntheticLeak([{ sourceFile: "DEMO", vintage: "DEMO" }]));
});

test("T12 weight conservation rejects 1.3", () => {
  const r = validateWeightConservation([
    { ticker: "005930", exposureWeight: 0.8 },
    { ticker: "005930", exposureWeight: 0.5 },
  ]);
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /1\.300/);
});

test("unverified seed weights and unsupported manual mappings never enter a financial composite", () => {
  const seed = exp({
    ticker: "005930",
    exportCategoryId: "semiconductors",
    verificationStatus: "UNVERIFIED_SEED",
    evidenceSource: ["https://example.com/report"],
  });
  assert.equal(isEvidenceBackedExposure(seed), false);
  assert.equal(
    isEvidenceBackedExposure({
      ...seed,
      verificationStatus: "VERIFIED_MANUAL",
      evidenceSource: [],
    }),
    false,
  );
  assert.equal(isEvidenceBackedExposure({ ...seed, verificationStatus: "VERIFIED_MANUAL" }), true);
  assert.equal(
    validateWeightConservation([{ ticker: "005930", exposureWeight: Number.NaN }]).ok,
    false,
  );
  assert.equal(validateWeightConservation([{ ticker: "005930", exposureWeight: -0.2 }]).ok, false);
});

test("T13 vintage parse + korean units", () => {
  assert.equal(parsePeriod("202406"), "2024-06");
  assert.equal(parseKoreanNumber("1,200", "백만불"), 1_200_000_000);
});

test("T14 FX partial correlation differs from raw", () => {
  const n = 48;
  const fx = Array.from({ length: n }, (_, i) => 1200 + i);
  const expS = Array.from({ length: n }, (_, i) => 50 + i * 0.4 + (i % 7) * 3);
  const k = Array.from({ length: n }, (_, i) => fx[i]! / 20 + (i % 5) * 8);
  const raw = calculatePearson(expS, k);
  const part = calculatePartialCorrelation(expS, k, fx);
  assert.notEqual(raw, null);
  assert.notEqual(part, null);
  assert.notEqual(raw, part);
});

test("T15 FRED parser keeps official monthly USD", () => {
  const csv = [
    "observation_date,XTEXVA01KRM667S",
    "2025-11-01,61330000000",
    "2026-04-01,85811990000",
    "2026-05-01,.",
  ].join("\n");
  const rows = parseFredCsv(csv, "XTEXVA01KRM667S");
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.period, "2025-11");
  assert.equal(rows[1]!.valueUsd, 85811990000);
});

test("T16 HS proxy does not invent missing codes", () => {
  assert.equal(aggregateProxy({ "87": 10 }, ["8542", "8541"]), null);
  assert.equal(aggregateProxy({ "8542": 5, "87": 9 }, ["8542", "8541"]), 5);
  assert.equal(aggregateProxy({ "74": 1, "76": 2 }, ["74", "76"]), 3);
});

test("convertUsdKrw rejects bad fx", () => {
  assert.equal(convertUsdKrw(1, 0), null);
});

test("fxRateForPeriod uses monthly series, not today's spot, for history", () => {
  const series = [
    { date: "2018-01-31", value: 1060 },
    { date: "2018-02-28", value: 1080 },
    { date: "2025-12-31", value: 1450 },
  ];
  assert.equal(fxRateForPeriod("2018-01", series, 1400), 1060);
  assert.equal(fxRateForPeriod("2018-02", series, 1400), 1080);
  assert.equal(fxRateForPeriod("2018-03", series, 1400), null);
  assert.equal(fxRateForPeriod("2026-08", series, 1400), null);
  assert.equal(fxRateForPeriod("2010-01", series, 1400), null);
  assert.equal(fxRateForPeriod("2018-01", [], 1400), null);
});

test("legacy persisted demo state and imports retain only real observations", () => {
  const real = { sourceFile: "official-exports.csv", vintage: "2026-09", valueUsd: 123 };
  const clean = sanitizeExportDeskSnapshot({
    demoMode: true,
    setDemoMode: "legacy",
    observations: [{ sourceFile: "DEMO", vintage: "DEMO" }, real, { sourceFile: "synthetic.csv" }],
    settings: { range: "5Y" },
    exposures: [{ ticker: "005930" }],
  });
  assert.deepEqual(clean.observations, [real]);
  assert.deepEqual(clean.settings, { range: "5Y" });
  assert.deepEqual(clean.exposures, [{ ticker: "005930" }]);
  assert.ok(!("demoMode" in clean));
  assert.ok(!("setDemoMode" in clean));
  assert.doesNotThrow(() => assertNoSyntheticLeak([real]));
});

test("Comtrade destination percentages require a real positive world denominator", () => {
  const countries = [
    { partnerCode: 842, primaryValue: 25 },
    { partnerCode: 156, primaryValue: 75 },
  ];
  assert.ok(destinationRows(countries).every((row) => row.share === null));
  assert.ok(
    destinationRows([{ partnerCode: 0, primaryValue: 0 }, ...countries]).every(
      (row) => row.share === null,
    ),
  );
  const verified = destinationRows([{ partnerCode: 0, primaryValue: 100 }, ...countries]);
  assert.deepEqual(
    verified.map((row) => row.share),
    [0.75, 0.25],
  );
  assert.equal(
    destinationRows([{ partnerCode: 0, primaryValue: 10 }, countries[0]!])[0]?.share,
    null,
  );
  assert.deepEqual(
    destinationRows([{ partnerCode: 842, primaryValue: Number.POSITIVE_INFINITY }]),
    [],
  );
});

test("missing calendar months remain missing in rolling and year-over-year calculations", () => {
  const rows = completeMonthlyObservations([
    {
      period: "2025-01",
      categoryId: "TOTAL",
      valueUsd: 10,
      classification: "TOTAL",
      sourceFile: "official.csv",
    },
    {
      period: "2025-03",
      categoryId: "TOTAL",
      valueUsd: 30,
      classification: "TOTAL",
      sourceFile: "official.csv",
    },
    {
      period: "2026-01",
      categoryId: "TOTAL",
      valueUsd: 20,
      classification: "TOTAL",
      sourceFile: "official.csv",
    },
  ]);
  assert.equal(rows.length, 13);
  assert.equal(rows[1]?.period, "2025-02");
  assert.ok(Number.isNaN(rows[1]!.valueUsd));
  assert.equal(calculateYoYGrowth(rows.map((row) => row.valueUsd))[12], 100);
  assert.ok(Number.isNaN(calculateRolling12MSum(rows.map((row) => row.valueUsd))[12]!));
});

test("market-cap ranking retains Oct 15 observation before the Oct 16 open, never collection date", () => {
  const received = "2026-10-16T08:30:00+09:00";
  const source = { code: "005930", nameKo: "삼성전자", market: "KOSPI" as const, marketCap: 100_000,
    marketCapValid: true, price: 50_000, changePct: -2, changeValid: true, marketStatus: "CLOSE",
    tradedAt: "2026-10-15T15:30:00+09:00", fetchedAt: received };
  const quote = capQuoteFromProvider(source, false);
  assert.equal(quote.tradedAt, source.tradedAt);
  assert.equal(quote.fetchedAt, received);
  const ranked = observedCapRanking([quote], 100, Date.parse(received));
  assert.equal(ranked.asOf, "2026-10-15");
  assert.equal(ranked.members[0]?.asOf, "2026-10-15");
  assert.equal(ranked.verifiedCount, 1);
  assert.equal(observedCapRanking([quote], 100, Date.parse("2026-10-16T10:00:00+09:00")).members.length, 0, "yesterday cannot be today's intraday ranking");
  assert.equal(observedCapRanking([{ ...quote, tradedAt: null }], 100, Date.parse(received)).asOf, null, "collection time cannot date an HTML price/capitalisation");
  const invalid = capQuoteFromProvider({ ...source, changeValid: false }, false);
  assert.equal(invalid.changeValid, false);
  assert.equal(observedCapRanking([invalid], 100, Date.parse(received)).verifiedCount, 0);
  assert.equal(observedCapRanking([{ ...quote, marketCapValid: false }], 100, Date.parse(received)).verifiedCount, 0);
  const fund = capQuoteFromProvider({ ...source, isEtf: true }, false);
  assert.equal(fund.isEtf, true);
  assert.equal(observedCapRanking([fund], 100, Date.parse(received)).members.length, 0, "ETFs in the cap listing are not common-equity issuers");
});

test("dated listing cap units and trading date survive normalization into export rankings", () => {
  // Historical public listing response captured 2026-10-15, not live test data.
  const sourceUrl = "https://m.stock.naver.com/api/stocks/marketValue/KOSPI?page=1&pageSize=100";
  const snapshot = normalizeNaverListingQuote({ itemCode: "005930", stockEndType: "stock", stockName: "삼성전자",
    closePrice: "207,500", compareToPreviousClosePrice: "-24,500", compareToPreviousPrice: { code: "5" },
    fluctuationsRatio: "-10.56", accumulatedTradingVolume: "33,002,824", marketValue: "12,131,028",
    marketValueRaw: "1213102811160000", localTradedAt: "2026-10-15T20:20:22+09:00", marketStatus: "CLOSE" });
  assert(snapshot && snapshot.marketCap != null);
  assert.equal(snapshot.marketCap, 12131028.1116, "KRW raw capitalisation must become 억 KRW exactly once");
  assert.equal(snapshot.volume, 33002824);
  const row = capQuoteFromProvider({ ...snapshot, nameKo: "삼성전자", market: "KOSPI", marketCap: snapshot.marketCap,
    marketCapValid: true, changeValid: true, fetchedAt: "2026-10-16T08:30:00+09:00", sourceUrl }, false);
  const ranking = observedCapRanking([row], 100, Date.parse("2026-10-16T08:30:00+09:00"));
  assert.equal(ranking.members[0]?.marketCap, 12131028.1116);
  assert.equal(ranking.members[0]?.asOf, "2026-10-15");
  assert.equal(row.sourceUrl, sourceUrl);
});

test("WAD with missing workingDays stays null (never invents 21 days)", () => {
  assert.equal(calculateWorkingDayAdjusted(210, 0), null);
  assert.equal(calculateWorkingDayAdjusted(210, 21), 10);
});
