import assert from "node:assert/strict";
import { test } from "node:test";
import { annotatePrevTargets, isNewCoverage, mapV2ResearchRow, parseGoalPriceSets, parseV2Detail, parseV2List, researchPageUrl, targetDeltaPct } from "./naver-v2.ts";
import { buildResearchBullets } from "../research-utils.ts";
import { classifyResearchSectors, isRoboticsText } from "../../data/research-taxonomy.ts";
import { classifyAction, streetMovesCsv, toStreetMove, exportFileName, STREET_CSV_HEADER } from "../street-moves.ts";
import { sortNotesNewestFirst, type UsStreetNote } from "../us-street.ts";

test("AT-15: v2 list `{hasNext,totalCount,items[]}` → newest first, nid desc tie-break, totalCount kept", () => {
  // synthetic fixture (format sample), not market data
  const payload = {
    hasNext: true,
    totalCount: 1234,
    items: [
      { nid: 101, title: "A", brokerName: "가증권", writeDate: "2026-09-24" },
      { nid: 105, title: "B", brokerName: "나증권", writeDate: "26.09.25" },
      { nid: 103, title: "C", brokerName: "다증권", writeDate: "2026.09.25" },
      { nid: 99, title: "", brokerName: "x", writeDate: "2026-09-25" },
    ],
  };
  const page = parseV2List(payload, "company");
  assert.equal(page.totalCount, 1234);
  assert.equal(page.hasNext, true);
  assert.deepEqual(page.items.map((r) => r.nid), [105, 103, 101]);
  assert.equal(page.items[0]!.pageUrl, "https://finance.naver.com/research/company_read.naver?nid=105");
  assert.equal(researchPageUrl("market", 7), "https://finance.naver.com/research/market_info_read.naver?nid=7");
});

test("v2 row mapping accepts candidate field names and never invents values", () => {
  // synthetic fixture (format sample), not market data
  const r = mapV2ResearchRow({ nid: "96027", title: "<b>제목</b>", brokerName: "한국투자", writeDate: "2026-09-07", itemCode: "005930", itemName: "삼성전자", opinion: "BUY", goalPrice: "120,000", attachUrl: "https://stock.pstatic.net/stock-research/company/1/a.pdf" }, "company");
  assert.ok(r);
  assert.equal(r!.title, "제목");
  assert.equal(r!.rating, "매수");
  assert.equal(r!.targetPrice, 120000);
  assert.equal(r!.pdfUrl, "https://stock.pstatic.net/stock-research/company/1/a.pdf");
  const bare = mapV2ResearchRow({ nid: 1, title: "t" }, "industry");
  assert.equal(bare!.targetPrice, undefined);
  assert.equal(bare!.rating, undefined);
  assert.equal(bare!.publishedAt, null);
});

test("detail-page: researchContent + researchSummaries.prev/next", () => {
  // synthetic fixture (format sample), not market data
  const d = parseV2Detail({ researchContent: { nid: 96027, title: "현재", brokerName: "A", writeDate: "2026-09-07", content: "<p>본문</p>" }, researchSummaries: { prev: { nid: 95868, title: "이전", brokerName: "B", writeDate: "2026-09-01" }, next: null } }, "company");
  assert.equal(d.row!.nid, 96027);
  assert.equal(d.text, "본문");
  assert.equal(d.prev!.nid, 95868);
  assert.equal(d.next, null);
});

test("AT-17: goal-price-changed sets list up/down; Δ% only when both values come from the source", () => {
  // synthetic fixture (format sample), not market data
  const up = parseGoalPriceSets({ researchSets: [
    { nid: 1, itemCode: "005930", itemName: "삼성전자", brokerName: "A", goalPrice: 110000, beforeGoalPrice: 100000, writeDate: "2026-09-25" },
    { nid: 2, itemCode: "000660", itemName: "SK하이닉스", brokerName: "B", goalPrice: 300000, writeDate: "2026-09-25" },
    { researches: [{ nid: 3, itemCode: "373220", brokerName: "C", goalPrice: 500000 }, { nid: 2, brokerName: "C", goalPrice: 400000 }] },
    { researches: [{ nid: 4, itemCode: "207940", brokerName: "D", goalPrice: 900000 }, { nid: 1, brokerName: "E", goalPrice: 800000 }] },
  ] }, "up");
  const byCode = Object.fromEntries(up.map((m) => [m.itemCode, m]));
  assert.equal(byCode["005930"]!.deltaPct, 10);
  assert.equal(byCode["000660"]!.deltaPct, null);
  assert.equal(byCode["373220"]!.deltaPct, 25);
  assert.equal(byCode["207940"]!.deltaPct, null, "different broker → no Δ");
  assert.deepEqual(parseGoalPriceSets({ researchSets: [] }, "down"), []);
});

test("F2.5: Δ% only from an older same-broker, same-ticker fetched report", () => {
  type Row = { researchId: number; broker: string; code: string; targetPrice?: number; rating?: string; prevTargetPrice?: number; prevRating?: string };
  const list = annotatePrevTargets<Row>([
    { researchId: 3, broker: "A", code: "005930", targetPrice: 120000 },
    { researchId: 2, broker: "B", code: "005930", targetPrice: 90000 },
    { researchId: 1, broker: "A", code: "005930", targetPrice: 100000, rating: "매수" },
    { researchId: 0, broker: "A", code: "000660", targetPrice: 50000 },
  ]);
  assert.equal(list[0]!.prevTargetPrice, 100000);
  assert.equal(list[0]!.prevRating, "매수");
  assert.equal(targetDeltaPct(list[0]!), 20);
  assert.equal(list[1]!.prevTargetPrice, undefined);
  assert.equal(targetDeltaPct(list[1]!), null);
  assert.equal(list[3]!.prevTargetPrice, undefined);
});

test("new-coverage heuristic and extractive bullets", () => {
  assert.equal(isNewCoverage("두산로보틱스 신규 커버리지: 협동로봇의 시간"), true);
  assert.equal(isNewCoverage("Initiate coverage with Buy"), true);
  assert.equal(isNewCoverage("3Q 실적 리뷰"), false);
  const b = buildResearchBullets("실적은 컨센서스를 상회했다. 목표주가를 12만원으로 상향한다. 날씨가 좋다. 수요 회복이 확인됐다.", "t", 2);
  assert.equal(b.length, 2);
  assert.ok(b.every((x) => x.length <= 240));
});

test("AT-21: generic AI 반도체 reports are not robotics; robot terms are", () => {
  assert.equal(classifyResearchSectors("AI 반도체 수요 급증과 HBM").includes("robotics"), false);
  assert.equal(classifyResearchSectors("인공지능 서버 투자 확대").includes("robotics"), false);
  assert.equal(isRoboticsText("피지컬 AI와 휴머노이드"), true);
  assert.equal(classifyResearchSectors("협동로봇 수주 확대").includes("robotics"), true);
  assert.equal(classifyResearchSectors("AMR 물류 자동화").includes("robotics"), true);
  assert.equal(isRoboticsText("CAMRY sales"), false, "AMR only on word boundary");
});

function note(p: Partial<UsStreetNote> & { id: string }): UsStreetNote {
  return { symbol: "NVDA", broker: "Goldman", action: "Upgrade", actionKo: "상향", rating: "Neutral → Buy", target: "$150 → $180", date: "2026-09-25", publishedAt: "2026-09-25T12:00:00.000Z", precision: "day", summary: "", pageUrl: "https://finviz.com/quote.ashx?t=NVDA", sourceLabel: "Finviz", ...p };
}

test("AT-20: Street Moves sort newest first; CSV has exactly the visible rows", () => {
  // synthetic fixture (format sample), not market data
  const notes = sortNotesNewestFirst([
    note({ id: "a", date: "2026-09-20", publishedAt: "2026-09-20T12:00:00.000Z" }),
    note({ id: "b", date: "2026-09-25", publishedAt: "2026-09-25T12:00:00.000Z", symbol: "TSLA", action: "Downgrade", rating: "Buy → Hold", target: "$300" }),
    note({ id: "c", date: "2026-09-22", publishedAt: "2026-09-22T12:00:00.000Z", action: "Reiterated", rating: "Buy", target: "$170 → $190" }),
  ]);
  assert.deepEqual(notes.map((n) => n.id), ["b", "c", "a"]);
  const moves = notes.map((n) => toStreetMove(n));
  assert.equal(moves[0]!.action, "Downgrade");
  assert.equal(moves[0]!.ptDeltaPct, null, "only one PT in the row → no Δ%");
  assert.equal(moves[1]!.action, "PT change");
  assert.equal(moves[2]!.ptDeltaPct, 20);
  assert.equal(classifyAction("Initiated", null, null), "Initiate");
  const visible = moves.filter((m) => m.ticker === "NVDA");
  const csv = streetMovesCsv(visible).trim().split("\n");
  assert.equal(csv[0], STREET_CSV_HEADER.join(","));
  assert.equal(csv.length, 1 + visible.length);
  assert.ok(csv[1]!.startsWith("2026-09-22,NVDA,Goldman,PT change,,Buy,170,190,11.8,"));
});

test("AT-41: export names carry the symbol and a timestamp", () => {
  assert.equal(exportFileName("ked-chart-005930-1D", new Date("2026-09-26T03:04:00Z"), "png"), "ked-chart-005930-1D-20260926-1204.png");
});
