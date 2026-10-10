import assert from "node:assert/strict";
import { test } from "node:test";
import {
  annualsFromCompanyFacts,
  buildValuationPack,
  expandingPercentile,
  extractEncparam,
  fairPriceFromEvMultiple,
  fairPriceFromPer,
  netDebtEok,
  parseAnnualFundamentals,
  parseBandMonthPrices,
  parseNasdaqEarningsForecast,
  parseRatioColumns,
  parseYahooAdjCloses,
  parseYahooSplits,
  percentileRank,
  quartersFromCumulative,
  resliceValuation,
  sampleMean,
  sampleSigma,
  sharesOnPriceBasis,
  trailingMultiple,
  evMultiple,
  yahooUsSymbol,
} from "./valuation-series.ts";

test("sample sigma is n-1 and percentile counts values at or below current", () => {
  assert.equal(sampleMean([2, 4, 6]), 4);
  assert.equal(sampleSigma([2, 4, 6]), 2);
  assert.equal(sampleSigma([5]), null);
  assert.equal(percentileRank([10, 20, 30, 40], 25), 50);
  assert.equal(percentileRank([10, 20, 30, 40], 10), 25);
  assert.equal(percentileRank([10, 20, 30, 40], 40), 100);
  assert.equal(percentileRank([10, -5, 20], -5), null);
});

test("expanding percentile ignores the future and waits for 8 prints", () => {
  const values = [10, 20, 30, 40, 50, 60, 70, 15, 1];
  const pct = expandingPercentile(values);
  assert.equal(pct[6], null);
  assert.equal(pct[7], (2 / 8) * 100);
  assert.equal(pct[8], (1 / 9) * 100);
  const prefix = expandingPercentile(values.slice(0, 8));
  assert.equal(prefix[7], pct[7]);
});

test("PER is undefined on non-positive EPS; EV/EBITDA undefined on non-positive EBITDA", () => {
  assert.equal(trailingMultiple(1000, -50), null);
  assert.equal(trailingMultiple(1000, 0), null);
  assert.equal(trailingMultiple(1000, 100), 10);
  assert.equal(evMultiple(-10, 5), -2);
  assert.equal(evMultiple(10, 0), null);
  assert.equal(evMultiple(10, -4), null);
});

test("net debt matches reported EV at the fiscal price, and fair prices round-trip", () => {
  const shares = 5_919_637_922;
  const price = 119_900;
  const ev = 6_819_415.52;
  const ebitda = 905_276.43;
  const sales = 3_336_059.38;
  const nd = netDebtEok(ev, price, shares);
  assert.ok(nd != null);
  assert.ok(Math.abs(nd! - (ev - (price * shares) / 1e8)) < 1e-6);
  const evEb = ev / ebitda;
  const back = fairPriceFromEvMultiple(ebitda, evEb, nd, shares);
  assert.ok(back != null && Math.abs(back - price) < 1);
  const eps = 6_563.5686;
  const per = price / eps;
  const perPx = fairPriceFromPer(eps, per);
  assert.ok(perPx != null && Math.abs(perPx - price) < 1e-6);
  assert.equal(fairPriceFromPer(-1, 10), null);
  assert.equal(fairPriceFromEvMultiple(100, 1, 500, shares), null);
});

test("parser keeps actual years, skips YoY, and takes consensus EPS from (E)", () => {
  const yymm = [
    "2024/12<br />(IFRS연결)",
    "2025/03<br />(IFRS연결)",
    "2026/12(E)<br />(IFRS연결)",
    "전년대비<br />(YoY)",
  ];
  const cols = parseRatioColumns(yymm);
  assert.deepEqual(
    cols.map((c) => [c.periodEnd, c.estimate, c.index]),
    [
      ["2024-12-31", false, 1],
      ["2025-03-31", false, 2],
      ["2026-12-31", true, 3],
    ],
  );
  const rpt5 = {
    YYMM: yymm,
    DATA: [
      { ACC_NM: "EPS", DATA1: 100, DATA2: -20, DATA3: 400, DATA4: 999 },
      { ACC_NM: "PER", DATA1: 10, DATA2: null, DATA3: 5, DATA4: 1 },
      { ACC_NM: "EBITDA＜당기＞", DATA1: 50, DATA2: -5, DATA3: 80 },
      { ACC_NM: "EV＜당기＞", DATA1: 200, DATA2: 100, DATA3: 900 },
      { ACC_NM: "매출액＜당기＞", DATA1: 80, DATA2: 90, DATA3: 100 },
      { ACC_NM: "보통주.수정주가(기말)＜당기＞", DATA1: 1000, DATA2: 800, DATA3: 2000 },
      { ACC_NM: "EV/EBITDA", DATA1: 4, DATA2: null, DATA3: 11 },
    ],
  };
  const rpt0 = {
    YYMM: yymm,
    DATA: [
      { ACC_NM: "발행주식수(보통주)", DATA1: 1_000_000, DATA2: 1_000_000, DATA3: null },
      { ACC_NM: "이자발생부채", DATA1: 10, DATA2: 10, DATA3: null },
    ],
  };
  const { annuals, consensus } = parseAnnualFundamentals(rpt5, rpt0);
  assert.equal(annuals.length, 2);
  assert.equal(annuals[0]!.eps, 100);
  assert.equal(annuals[1]!.eps, -20);
  assert.equal(annuals[1]!.periodEnd, "2025-03-31");
  assert.deepEqual(consensus, { year: 2026, eps: 400, per: 5 });
  assert.equal(extractEncparam("encparam: 'abc+def=='"), "abc+def==");
});

test("trailing PER steps on reported EPS; forward PER uses only latest consensus", () => {
  const shares = 1_000_000_000;
  const annuals = [
    {
      year: 2024,
      periodEnd: "2024-12-31",
      estimate: false,
      eps: 1000,
      per: 10,
      ebitdaEok: 0,
      salesEok: 5000,
      evEok: 20_000,
      price: 10_000,
      shares,
      debtEok: 999_999,
      evEbitda: null,
    },
    {
      year: 2025,
      periodEnd: "2025-12-31",
      estimate: false,
      eps: 2000,
      per: 8,
      ebitdaEok: 4000,
      salesEok: 8000,
      evEok: 12_000,
      price: 16_000,
      shares,
      debtEok: 1,
      evEbitda: 3,
    },
  ];
  const months = [
    { date: "2024-06-30", price: 9_000 },
    { date: "2025-06-30", price: 15_000 },
    { date: "2025-12-30", price: 16_000 },
    { date: "2025-12-31", price: 16_000 },
    { date: "2026-09-30", price: 28_000 },
  ];
  const pack = buildValuationPack({
    code: "005930",
    annuals,
    consensus: { year: 2026, eps: 4000, per: 7 },
    months,
  });

  const perAt = (d: string) => pack.per.points.find((p) => p.date === d)!.value;
  assert.equal(perAt("2024-06-30"), null);
  assert.equal(perAt("2025-06-30"), 15);
  assert.equal(perAt("2025-12-30"), 8);
  assert.equal(perAt("2025-12-31"), 8);
  assert.equal(perAt("2026-09-30"), 14);
  assert.notEqual(perAt("2026-09-30"), 7);

  const fwdAt = (d: string) => pack.forwardPer.points.find((p) => p.date === d)!.value;
  assert.equal(fwdAt("2026-09-30"), 7);
  assert.equal(fwdAt("2025-12-31"), 4);
  assert.match(pack.forwardPer.basis, /최신 컨센서스/);
  assert.match(pack.forwardPer.basis, /당시 컨센서스가 아니다/);

  assert.equal(pack.evEbitda.points.find((p) => p.date === "2025-06-30")!.value, null);
  const fyEv = pack.evEbitda.points.find((p) => p.date === "2025-12-31")!.value;
  assert.ok(fyEv != null && Math.abs(fyEv - 3) < 1e-9);
  const later = pack.evEbitda.points.find((p) => p.date === "2026-09-30")!.value;
  const nd = netDebtEok(12_000, 16_000, shares)!;
  const evLater = (28_000 * shares) / 1e8 + nd;
  assert.ok(later != null && Math.abs(later - evLater / 4000) < 1e-9);
  assert.ok((pack.evSales.points.find((p) => p.date === "2025-06-30")!.value ?? 0) > 0);

  const bandPx = pack.per.priceBands.find((p) => p.date === "2025-12-31")!;
  assert.equal(bandPx.price, 16_000);
  assert.ok(pack.valuationBand.basis === "per" || pack.valuationBand.basis === "evSales");
  assert.ok(pack.valuationBand.stats.n >= 2);
});

test("loss-making name drops PER bands and still builds EV/Sales", () => {
  const shares = 1_000_000;
  const annuals = [2022, 2023, 2024, 2025].map((year) => ({
    year,
    periodEnd: `${year}-12-31`,
    estimate: false,
    eps: -100,
    per: null,
    ebitdaEok: -10,
    salesEok: 1000 + year,
    evEok: 500,
    price: 5000,
    shares,
    debtEok: 50,
    evEbitda: null,
  }));
  const months = annuals.map((a, i) => ({ date: a.periodEnd, price: 4000 + i * 100 }));
  const pack = buildValuationPack({
    code: "000000",
    annuals,
    consensus: null,
    months,
  });
  assert.equal(pack.per.stats.n, 0);
  assert.equal(pack.forwardPer.stats.n, 0);
  assert.equal(pack.evEbitda.stats.n, 0);
  assert.ok(pack.evSales.stats.n >= 4);
  assert.equal(pack.valuationBand.basis, "evSales");
  assert.match(pack.valuationBand.basisLabel, /EPS≤0|PER 표본/);
});

test("band chart prices ignore null future points and do not invent EPS", () => {
  const months = parseBandMonthPrices({
    bandChart1: {
      price: [
        { x: Date.parse("2024-12-31T00:00:00Z"), y: 10000 },
        { x: Date.parse("2025-01-31T00:00:00Z"), y: null },
      ],
      val4: [{ x: 1, y: 40000 }],
    },
  });
  assert.deepEqual(months, [{ date: "2024-12-31", price: 10000 }]);
});

test("US ticker parsing, Yahoo closes, and SEC TTM including synthesized Q4", () => {
  assert.equal(yahooUsSymbol("nvda.o"), "NVDA");
  assert.equal(yahooUsSymbol("BRK.B"), "BRK-B");
  assert.equal(yahooUsSymbol("BRK.A"), "BRK-A");
  assert.equal(yahooUsSymbol("BRK-B"), "BRK-B");
  assert.equal(yahooUsSymbol("ABCDEF"), "ABCDEF");
  assert.equal(yahooUsSymbol("F"), "F");
  assert.equal(yahooUsSymbol("ABC-"), null);
  assert.equal(yahooUsSymbol("https://example.com"), null);
  assert.equal(yahooUsSymbol("005930"), null);
  assert.equal(yahooUsSymbol("0238C0"), null);

  const closes = parseYahooAdjCloses({
    chart: {
      result: [
        {
          timestamp: [1_700_000_000, 1_700_604_800],
          indicators: { adjclose: [{ adjclose: [10.5, null] }], quote: [{ close: [10, 11] }] },
        },
      ],
    },
  });
  assert.equal(closes.length, 1);
  assert.equal(closes[0]!.price, 10.5);

  const facts = {
    entityName: "NVIDIA CORP",
    facts: {
      "us-gaap": {
        EarningsPerShareDiluted: {
          units: {
            "USD/shares": [
              { start: "2024-01-29", end: "2024-04-28", val: 0.6, form: "10-Q", filed: "2024-05-29" },
              { start: "2024-04-29", end: "2024-07-28", val: 0.67, form: "10-Q", filed: "2024-08-28" },
              { start: "2024-07-29", end: "2024-10-27", val: 0.81, form: "10-Q", filed: "2024-11-20" },
              { start: "2024-01-29", end: "2025-01-26", val: 2.94, form: "10-K", filed: "2025-02-26" },
              { start: "2025-01-27", end: "2025-04-27", val: 0.76, form: "10-Q", filed: "2025-05-28" },
            ],
          },
        },
        Revenues: {
          units: {
            USD: [
              { start: "2024-01-29", end: "2024-04-28", val: 26e9, form: "10-Q", filed: "2024-05-29" },
              { start: "2024-04-29", end: "2024-07-28", val: 30e9, form: "10-Q", filed: "2024-08-28" },
              { start: "2024-07-29", end: "2024-10-27", val: 35e9, form: "10-Q", filed: "2024-11-20" },
              { start: "2024-01-29", end: "2025-01-26", val: 130e9, form: "10-K", filed: "2025-02-26" },
              { start: "2025-01-27", end: "2025-04-27", val: 44e9, form: "10-Q", filed: "2025-05-28" },
            ],
          },
        },
      },
      dei: {
        EntityCommonStockSharesOutstanding: {
          units: {
            shares: [
              { end: "2025-01-26", val: 24e9, form: "10-K", filed: "2025-02-26" },
            ],
          },
        },
      },
    },
  };
  const { annuals, name } = annualsFromCompanyFacts(facts);
  assert.equal(name, "NVIDIA CORP");
  assert.ok(annuals.length >= 1);
  const fy = annuals.find((row) => row.periodEnd === "2025-02-26");
  assert.ok(fy);
  assert.ok(Math.abs((fy!.eps ?? 0) - 2.94) < 0.02);
  assert.equal(fy!.shares, 24e9);
  const pack = buildValuationPack({
    code: "NVDA",
    annuals,
    consensus: null,
    months: [
      { date: "2025-02-21", price: 100 },
      { date: "2025-03-07", price: 120 },
    ],
    currency: "USD",
    name,
  });
  assert.equal(pack.per.points[0]!.value, null);
  assert.ok(Math.abs((pack.per.points[1]!.value ?? 0) - 120 / 2.94) < 0.05);
  assert.equal(pack.forwardPer.stats.n, 0);
  const sliced = resliceValuation(pack, "2025-03-01");
  assert.equal(sliced.per.stats.n, 1);
});

test("YTD depreciation becomes quarters that sum back to the fiscal year", () => {
  const quarters = quartersFromCumulative([
    { start: "2024-01-29", end: "2024-04-28", filed: "2024-05-29", val: 410 },
    { start: "2024-01-29", end: "2024-07-28", filed: "2024-08-28", val: 843 },
    { start: "2024-01-29", end: "2024-10-27", filed: "2024-11-20", val: 1321 },
    { start: "2024-01-29", end: "2025-01-26", filed: "2025-02-26", val: 1864 },
  ]);
  assert.deepEqual(
    quarters.map((row) => row.val),
    [410, 433, 478, 543],
  );
  assert.equal(
    quarters.reduce((sum, row) => sum + row.val, 0),
    1864,
  );
});

test("Nasdaq forecast uses the next four quarters as NTM, not a made-up history", () => {
  const consensus = parseNasdaqEarningsForecast({
    data: {
      quarterlyForecast: {
        rows: [
          { fiscalEnd: "Oct 2026", consensusEPSForecast: 2.47 },
          { fiscalEnd: "Jan 2027", consensusEPSForecast: 2.71 },
          { fiscalEnd: "Apr 2027", consensusEPSForecast: 3.15 },
          { fiscalEnd: "Jul 2027", consensusEPSForecast: 3.58 },
        ],
      },
      yearlyForecast: { rows: [{ fiscalEnd: "Jan 2027", consensusEPSForecast: 9.25, noOfEstimates: 17 }] },
    },
  });
  assert.ok(consensus);
  assert.equal(consensus!.horizon, "ntm");
  assert.equal(consensus!.year, 2027);
  assert.ok(Math.abs(consensus!.eps - (2.47 + 2.71 + 3.15 + 3.58)) < 1e-9);
  const yearlyOnly = parseNasdaqEarningsForecast({
    data: {
      quarterlyForecast: { rows: [{ fiscalEnd: "Oct 2026", consensusEPSForecast: 1.1 }] },
      yearlyForecast: { rows: [{ fiscalEnd: "Jan 2027", consensusEPSForecast: 9.25, noOfEstimates: 17 }] },
    },
  });
  assert.equal(yearlyOnly?.horizon, "fy1");
  assert.equal(yearlyOnly?.eps, 9.25);
});

test("US sales join a nearby period end and an alternate revenue tag", () => {
  const facts = {
    entityName: "EXAMPLE INC",
    facts: {
      "us-gaap": {
        EarningsPerShareDiluted: {
          units: {
            "USD/shares": [
              { start: "2024-01-01", end: "2024-03-31", val: 1, form: "10-Q", filed: "2024-05-01" },
              { start: "2024-04-01", end: "2024-06-30", val: 1, form: "10-Q", filed: "2024-08-01" },
              { start: "2024-07-01", end: "2024-09-30", val: 1, form: "10-Q", filed: "2024-11-01" },
              { start: "2024-01-01", end: "2024-12-31", val: 4, form: "10-K", filed: "2025-02-15" },
            ],
          },
        },
        RevenueFromContractWithCustomerExcludingAssessedTax: {
          units: {
            USD: [
              { start: "2024-01-01", end: "2024-04-02", val: 10e9, form: "10-Q", filed: "2024-05-01" },
              { start: "2024-04-03", end: "2024-07-02", val: 10e9, form: "10-Q", filed: "2024-08-01" },
              { start: "2024-07-03", end: "2024-10-02", val: 10e9, form: "10-Q", filed: "2024-11-01" },
              { start: "2024-01-01", end: "2025-01-02", val: 40e9, form: "10-K", filed: "2025-02-15" },
            ],
          },
        },
        OperatingIncomeLoss: {
          units: {
            USD: [
              { start: "2024-01-01", end: "2024-03-31", val: 4e9, form: "10-Q", filed: "2024-05-01" },
              { start: "2024-04-01", end: "2024-06-30", val: 4e9, form: "10-Q", filed: "2024-08-01" },
              { start: "2024-07-01", end: "2024-09-30", val: 4e9, form: "10-Q", filed: "2024-11-01" },
              { start: "2024-01-01", end: "2024-12-31", val: 16e9, form: "10-K", filed: "2025-02-15" },
            ],
          },
        },
        DepreciationAndAmortization: {
          units: {
            USD: [
              { start: "2024-01-01", end: "2024-03-31", val: 1e9, form: "10-Q", filed: "2024-05-01" },
              { start: "2024-01-01", end: "2024-06-30", val: 2e9, form: "10-Q", filed: "2024-08-01" },
              { start: "2024-01-01", end: "2024-09-30", val: 3e9, form: "10-Q", filed: "2024-11-01" },
              { start: "2024-01-01", end: "2024-12-31", val: 4e9, form: "10-K", filed: "2025-02-15" },
            ],
          },
        },
        LongTermDebtNoncurrent: {
          units: { USD: [{ end: "2024-12-31", val: 8e9, form: "10-K", filed: "2025-02-15" }] },
        },
        CashAndCashEquivalentsAtCarryingValue: {
          units: { USD: [{ end: "2024-12-31", val: 3e9, form: "10-K", filed: "2025-02-15" }] },
        },
      },
      dei: {
        EntityCommonStockSharesOutstanding: {
          units: { shares: [{ end: "2024-12-31", val: 1e9, form: "10-K", filed: "2025-02-15" }] },
        },
      },
    },
  };
  const { annuals } = annualsFromCompanyFacts(facts);
  const fy = annuals.find((row) => row.periodEnd === "2025-02-15");
  assert.ok(fy);
  assert.ok(fy!.salesEok != null && fy!.salesEok > 0);
  assert.ok(fy!.ebitdaEok != null && fy!.ebitdaEok > 0);
  assert.equal(fy!.netDebtEok, (8e9 - 3e9) / 1e8);
  const pack = buildValuationPack({
    code: "EX",
    annuals,
    consensus: { year: 2026, eps: 5, per: null, horizon: "ntm" },
    months: [
      { date: "2025-02-20", price: 100 },
      { date: "2025-03-01", price: 110 },
    ],
    currency: "USD",
  });
  assert.ok((pack.evSales.stats.n ?? 0) >= 1);
  assert.ok((pack.evEbitda.stats.n ?? 0) >= 1);
  assert.ok((pack.forwardPer.stats.n ?? 0) >= 1);
  assert.match(pack.forwardPer.basis, /NTM/);
  assert.match(pack.forwardPer.basis, /달러/);
  assert.match(pack.forwardPer.basis, /당시 컨센서스가 아니다/);
});

test("split-adjusted prices need shares scaled by later splits only", () => {
  const splits = [
    { date: "2021-07-20", factor: 4 },
    { date: "2024-06-10", factor: 10 },
  ];
  assert.equal(sharesOnPriceBasis(2.5e9, "2024-05-29", splits), 25e9);
  assert.equal(sharesOnPriceBasis(24.5e9, "2024-08-28", splits), 24.5e9);
  assert.equal(sharesOnPriceBasis(0.62e9, "2021-05-26", splits), 0.62e9 * 4 * 10);
  const parsed = parseYahooSplits({
    chart: {
      result: [
        {
          events: {
            splits: { "1": { date: 1718026200, numerator: 10, denominator: 1 } },
          },
        },
      ],
    },
  });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]!.factor, 10);
  assert.equal(parsed[0]!.date, "2024-06-10");
});
