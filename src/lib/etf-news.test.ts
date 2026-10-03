import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyEtfNewsFilter,
  buildEtfBriefing,
  EMPTY_ETF_FILTER,
  enrichEtfStory,
  ETF_BRAND_QUERIES,
  ETF_TOPIC_QUERIES,
  etfBrandOf,
  etfStageOf,
  etfThemesOf,
  isEtfStory,
  issuerOfEtfName,
  matchEtf,
  type EtfRowLike,
} from "./etf-news.ts";
import type { FeedItem } from "./feed/types.ts";

// synthetic fixture (format sample), not market data
const ETFS: EtfRowLike[] = [
  { code: "0091P0", nameKo: "TIGER 코리아휴머노이드로봇산업", price: 10450, changePct: 2.1, volume: 812345, amount: 8_500_000_000, marketSum: 2140, retirementEligible: true },
  { code: "0091P9", nameKo: "TIGER 코리아휴머노이드", price: 9900, changePct: 1.1, volume: 1000, amount: 10_000_000, marketSum: 120, retirementEligible: true },
  { code: "0105A0", nameKo: "KODEX 미국AI전력핵심인프라", price: 11200, changePct: -0.4, volume: 300000, amount: 3_300_000_000, marketSum: 5100, retirementEligible: true },
  { code: "122630", nameKo: "KODEX 레버리지", price: 21000, changePct: 1.9, volume: 9_000_000, amount: 190_000_000_000, marketSum: 20000, retirementEligible: false },
  { code: "000001", nameKo: "ACE", price: 1, changePct: 0, volume: 0, amount: 0, marketSum: 0 },
];

function item(id: string, title: string, publishedAt: string | null, extra: Partial<FeedItem> = {}): FeedItem {
  return {
    id,
    kind: "news",
    region: "KR",
    sourceId: "gn-etf-kr",
    sourceName: "Google 뉴스 (ETF)",
    sourceTier: 3,
    title,
    url: `https://example.com/${id}`,
    publishedAt,
    precision: publishedAt ? "minute" : "unknown",
    fetchedAt: "2026-09-26T03:00:00.000Z",
    tickers: [],
    sectors: [],
    topics: ["etf"],
    lang: "ko",
    ...extra,
  };
}

test("AT-22 stage chips from headline keywords (synthetic fixtures)", () => {
  assert.equal(etfStageOf("미래에셋, TIGER 코리아휴머노이드로봇산업 ETF 신규 상장"), "listed");
  assert.equal(etfStageOf("삼성운용 KODEX 美AI전력 ETF 다음주 상장 예정"), "scheduled");
  assert.equal(etfStageOf("한화운용 ETF 3종 상장폐지 … 순자산 50억 미달"), "delisting");
  assert.equal(etfStageOf("커버드콜 ETF 순자산 10조 돌파, 개인 순매수 몰렸다"), "flow");
  assert.equal(etfStageOf("퇴직연금 디폴트옵션 ETF 편입 확대"), "retirement");
  assert.equal(etfStageOf("ETF 수수료 인하 경쟁"), "other");
});

test("ETF story filter, brand and themes", () => {
  assert.equal(isEtfStory("KODEX 200 순자산 10조 돌파"), true);
  assert.equal(isEtfStory("상장지수펀드 시장 200조"), true);
  assert.equal(isEtfStory("삼성전자 3분기 실적 발표"), false);
  assert.equal(isEtfStory("TIGER 그룹 회장 인터뷰"), false, "bare brand-like word without ETF context");
  assert.equal(etfBrandOf("TIGER 미국S&P500 분배금"), "TIGER");
  assert.equal(etfBrandOf("TIGERS 야구단"), null);
  assert.deepEqual(etfThemesOf("월배당 커버드콜 ETF"), ["covered-call", "monthly-dividend"]);
  assert.equal(issuerOfEtfName("KODEX 레버리지"), "삼성자산운용");
  assert.equal(issuerOfEtfName("알수없는 ETF"), null);
  assert.equal(ETF_TOPIC_QUERIES.length, 8);
  assert.deepEqual(ETF_BRAND_QUERIES.slice(0, 2), ["KODEX ETF", "TIGER ETF"]);
  assert.equal(ETF_BRAND_QUERIES.length, 10);
});

test("AT-22 longest-name match attaches code, price, volume, issuer", () => {
  assert.equal(matchEtf("TIGER 코리아휴머노이드로봇산업 ETF 상장", ETFS)?.code, "0091P0", "longest name wins");
  assert.equal(matchEtf("ACE ETF 출시", ETFS), undefined, "names under 4 chars skipped");
  const e = enrichEtfStory(item("a", "TIGER 코리아휴머노이드로봇산업 ETF 신규 상장", "2026-09-25T01:00:00.000Z"), ETFS)!;
  assert.equal(e.etf?.code, "0091P0");
  assert.equal(e.etf?.price, 10450);
  assert.equal(e.etf?.volume, 812345);
  assert.equal(e.etf?.marketSum, 2140);
  assert.equal(e.etf?.issuer, "미래에셋자산운용");
  assert.ok(e.topics.includes("stage:listed"));
  assert.ok(e.topics.includes("theme:robot-ai"));
  assert.ok(e.topics.includes("brand:TIGER"));
  assert.equal(enrichEtfStory(item("b", "코스피 상승 마감", null), ETFS), null);
  const noMatch = enrichEtfStory(item("c", "ETF 순자산 200조 돌파", null), ETFS)!;
  assert.equal(noMatch.etf, undefined, "no fabricated match");
  const zero = enrichEtfStory(item("d", "ETF 상장폐지 예정 ACE 품목", null), [{ ...ETFS[4]!, nameKo: "ACE 테스트품목" }])!;
  assert.equal(zero.etf, undefined);
});

test("F5.4 filters: issuer, stage, theme, retirement-eligible", () => {
  const rows = [
    enrichEtfStory(item("1", "TIGER 코리아휴머노이드로봇산업 ETF 신규 상장", null), ETFS)!,
    enrichEtfStory(item("2", "KODEX 레버리지 ETF 순자산 급증", null), ETFS)!,
    enrichEtfStory(item("3", "월배당 ETF 인기", null), ETFS)!,
  ];
  assert.deepEqual(applyEtfNewsFilter(rows, { ...EMPTY_ETF_FILTER, issuers: ["KODEX"] }).map((r) => r.id), ["2"]);
  assert.deepEqual(applyEtfNewsFilter(rows, { ...EMPTY_ETF_FILTER, stages: ["listed"] }).map((r) => r.id), ["1"]);
  assert.deepEqual(applyEtfNewsFilter(rows, { ...EMPTY_ETF_FILTER, themes: ["monthly-dividend"] }).map((r) => r.id), ["3"]);
  assert.deepEqual(applyEtfNewsFilter(rows, { ...EMPTY_ETF_FILTER, retirementOnly: true }).map((r) => r.id), ["1"], "leverage and unmatched excluded");
  assert.equal(applyEtfNewsFilter(rows, EMPTY_ETF_FILTER).length, 3);
});

test("F5.3 briefing windows, trading-value snapshot and robot/AI chips", () => {
  const now = Date.parse("2026-09-26T03:00:00Z");
  const rows = [
    enrichEtfStory(item("new", "ETF 신규 상장 3종", "2026-09-24T00:00:00.000Z"), ETFS)!,
    enrichEtfStory(item("old", "ETF 신규 상장 옛 기사", "2026-08-01T00:00:00.000Z"), ETFS)!,
    enrichEtfStory(item("undated", "ETF 상장 예정", null), ETFS)!,
    enrichEtfStory(item("del", "ETF 5종 상장폐지", "2026-09-10T00:00:00.000Z"), ETFS)!,
    enrichEtfStory(item("flow", "ETF 자금 유입 1조", "2026-09-25T00:00:00.000Z"), ETFS)!,
  ];
  const b = buildEtfBriefing(rows, ETFS, now);
  assert.deepEqual(b.listing.map((r) => r.id), ["new"], "14-day window, undated excluded");
  assert.deepEqual(b.delisting.map((r) => r.id), ["del"]);
  assert.deepEqual(b.flow.map((r) => r.id), ["flow"]);
  assert.equal(b.topTrading[0]!.code, "122630");
  assert.ok(b.topTrading.every((e) => (e.amount ?? 0) > 0));
  assert.deepEqual(b.robotAi.map((e) => e.code), ["0105A0", "0091P0", "0091P9"]);
});
