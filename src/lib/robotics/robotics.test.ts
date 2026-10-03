import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countWithin,
  discoverRobotEtfs,
  equalWeightChange,
  federalRegisterRelevant,
  federalRegisterToItem,
  federalRegisterUrl,
  isRobotPolicyText,
  normalizeCompanyName,
  pickExactListing,
  policyStatusesOf,
  position52w,
  robotTopicsOf,
  topMovers,
} from "./classify.ts";
import { ROBOT_ETF_NAME_RE, ROBOTICS_KR, ROBOTICS_US, ROBOTICS_US_ETFS } from "../../data/robotics.ts";

test("AT-24 robot ETF regex matcher over a live-list shaped fixture", () => {
  // synthetic fixture (format sample), not market data
  const list = [
    { code: "A1", nameKo: "TIGER 코리아휴머노이드로봇산업" },
    { code: "A2", nameKo: "KODEX 로봇액티브" },
    { code: "A3", nameKo: "ACE 글로벌로보틱스" },
    { code: "A4", nameKo: "SOL 미국Humanoid테크" },
    { code: "A5", nameKo: "KODEX 200" },
    { code: "A6", nameKo: "TIGER 미국AI빅테크10" },
  ];
  assert.deepEqual(discoverRobotEtfs(list, ROBOT_ETF_NAME_RE).map((e) => e.code), ["A1", "A2", "A3", "A4"]);
});

test("AT-26 Federal Register filter drops premerger/early-termination, keeps robotics/Section 232", () => {
  // synthetic fixture (format sample), not market data
  assert.equal(federalRegisterRelevant({ title: "Early Termination Notices", abstract: "Premerger notification; robotics company listed" }), false);
  assert.equal(federalRegisterRelevant({ title: "Hart-Scott-Rodino waiting period", abstract: "Robot maker" }), false);
  assert.equal(federalRegisterRelevant({ title: "Section 232 National Security Investigation of Imports of Robotics and Industrial Machinery", abstract: null }), true);
  assert.equal(federalRegisterRelevant({ title: "Medical Devices; Surgical Robotic Systems classification", abstract: "" }), true);
  assert.equal(federalRegisterRelevant({ title: "Agency Information Collection", abstract: "Survey of manufacturers" }), false, "term must be in title/abstract");
  const it = federalRegisterToItem(
    {
      document_number: "2026-12345",
      title: "Notice of Request for Public Comments on Section 232 Investigation of Robotics",
      abstract: "The Department requests comments.",
      html_url: "https://www.federalregister.gov/documents/2026/09/01/2026-12345/x",
      pdf_url: "https://www.govinfo.gov/content/pkg/FR-2026-09-01/pdf/2026-12345.pdf",
      publication_date: "2026-09-01",
      type: "Notice",
      agencies: [{ name: "Commerce Department" }, { name: "Industry and Security Bureau" }],
    },
    "2026-09-26T03:00:00.000Z",
  )!;
  assert.equal(it.kind, "policy");
  assert.equal(it.outlet, "Notice · Commerce Department · Industry and Security Bureau");
  assert.equal(it.precision, "day");
  assert.equal(it.publishedAt, "2026-09-01T12:00:00.000Z");
  assert.ok(it.topics.includes("status:review"));
  const url = new URL(federalRegisterUrl(20));
  assert.equal(url.searchParams.get("order"), "newest");
  assert.deepEqual(url.searchParams.getAll("conditions[term]"), ["robot", "robotic", "robotics", "humanoid", "industrial machinery"]);
});

test("AT-27 policy status chips only on keyword presence", () => {
  assert.deepEqual(policyStatusesOf("로봇 산업 현장 방문 간담회"), ["other"], "no keyword → 기타");
  assert.deepEqual(policyStatusesOf("지능형 로봇법 개정안 입법예고"), ["proposed"]);
  assert.deepEqual(policyStatusesOf("로봇 안전 인증 기준 다음달 시행"), ["effective"]);
  assert.deepEqual(policyStatusesOf("Commerce opens Section 232 investigation into robotics imports"), ["review"]);
  assert.deepEqual(policyStatusesOf("정부, 휴머노이드 국가전략 발표"), ["announced"]);
  assert.deepEqual(policyStatusesOf("Final rule takes effect; agency announces guidance").sort(), ["announced", "effective"]);
  assert.equal(isRobotPolicyText("산업통상부, 로봇 규제 샌드박스 확대"), true);
  assert.equal(isRobotPolicyText("레인보우로보틱스 신제품 공개"), false);
});

test("robot topic classifier", () => {
  assert.deepEqual(robotTopicsOf("Figure AI raises Series C for humanoid robots"), ["humanoid", "funding-ma"]);
  assert.deepEqual(robotTopicsOf("두산로보틱스 협동로봇 판매량 증가"), ["cobot", "statistics"]);
  assert.deepEqual(robotTopicsOf("감속기 국산화"), ["components"]);
  assert.deepEqual(robotTopicsOf("오늘 날씨"), []);
});

test("universe config and exact-name resolution (F6.1 / AT-25 helpers)", () => {
  assert.equal(ROBOTICS_KR.find((e) => e.code === "466100")?.nameEn, "CLOBOT");
  assert.equal(ROBOTICS_KR.filter((e) => e.kind === "seed").length, 6);
  assert.ok(ROBOTICS_KR.filter((e) => e.kind === "candidate").every((e) => e.code === undefined), "candidates never hard-code codes");
  assert.ok(ROBOTICS_KR.filter((e) => e.kind === "exposure").every((e) => e.exposure === "indirect"));
  assert.equal(ROBOTICS_US.length, 15);
  assert.deepEqual(ROBOTICS_US_ETFS, ["BOTZ", "ROBO", "ARKQ", "KOID", "HUMN", "BOTT"]);
  assert.equal(normalizeCompanyName("(주) 뉴로 메카"), "뉴로메카");
  // synthetic fixture (format sample), not market data
  const hits = [
    { code: "999990", nameKo: "뉴로메카우", isEtf: false },
    { code: "999991", nameKo: "TIGER 뉴로메카", isEtf: true },
    { code: "999992", nameKo: "뉴로메카", isEtf: false },
  ];
  assert.equal(pickExactListing("뉴로메카", hits)?.code, "999992");
  assert.equal(pickExactListing("없는회사", hits), null, "unresolved → null, never guessed");
});

test("basket stats: equal-weight 1D %, 52w position, movers, time windows", () => {
  assert.equal(equalWeightChange([1, 2, null, undefined, Number.NaN]), 1.5);
  assert.equal(equalWeightChange([null]), null);
  assert.equal(position52w(150, 100, 200), 50);
  assert.equal(position52w(150, null, 200), null);
  assert.equal(position52w(150, 200, 200), null);
  const m = topMovers([{ changePct: 3 }, { changePct: -2 }, { changePct: null }, { changePct: 5 }, { changePct: -7 }], 2);
  assert.deepEqual(m.up.map((r) => r.changePct), [5, 3]);
  assert.deepEqual(m.down.map((r) => r.changePct), [-7, -2]);
  const now = Date.parse("2026-09-26T03:00:00Z");
  assert.equal(countWithin([{ publishedAt: "2026-09-26T01:00:00Z" }, { publishedAt: "2026-09-20T01:00:00Z" }, { publishedAt: null }], now, 24), 1);
});
