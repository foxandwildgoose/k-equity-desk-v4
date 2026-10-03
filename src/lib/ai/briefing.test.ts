import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AI_LABEL,
  AI_MAX_BULLETS,
  AI_MAX_ITEMS,
  aiInputHash,
  buildBriefingPrompt,
  buildTranslatePrompt,
  capDayKey,
  MT_LABEL,
  normalizeAiInput,
  parseAiBullets,
  parseTranslations,
  type AiInputItem,
} from "./briefing.ts";
import { readAiConfig } from "./config.ts";

// synthetic fixture (format sample), not market data
const ITEMS: AiInputItem[] = [
  { id: "a", title: "Sample headline one", snippet: "Sample snippet one.", source: "Example Wire", time: "2026-01-02T01:00:00.000Z", url: "https://example.com/a" },
  { id: "b", title: "샘플 제목 둘", source: "예시 매체", time: "날짜 미상", url: "https://example.com/b" },
  { id: "c", title: "Sample headline three", source: "Example Wire", time: "2026-01-01T23:00:00.000Z", url: "https://example.com/c" },
];

test("AT-46: F9 is off unless enabled + model + provider key are all set", () => {
  assert.equal(readAiConfig({}), null);
  assert.equal(readAiConfig({ AI_MODEL: "m", ANTHROPIC_API_KEY: "k" }), null, "flag unset → off");
  assert.equal(readAiConfig({ AI_BRIEFING_ENABLED: "false", AI_MODEL: "m", ANTHROPIC_API_KEY: "k" }), null);
  assert.equal(readAiConfig({ AI_BRIEFING_ENABLED: "true", ANTHROPIC_API_KEY: "k" }), null, "no model → off");
  assert.equal(readAiConfig({ AI_BRIEFING_ENABLED: "true", AI_MODEL: "m" }), null, "no key → off");
  assert.equal(readAiConfig({ AI_BRIEFING_ENABLED: "true", AI_MODEL: "m", AI_PROVIDER: "xai", ANTHROPIC_API_KEY: "k" }), null, "key must match provider");
  const on = readAiConfig({ AI_BRIEFING_ENABLED: "true", AI_MODEL: " m ", ANTHROPIC_API_KEY: "k" });
  assert.deepEqual(on, { provider: "anthropic", model: "m", dailyCap: 50, effort: null });
  assert.equal(JSON.stringify(on).includes('"k"'), false, "config never carries the key");
  const x = readAiConfig({ AI_BRIEFING_ENABLED: "TRUE", AI_MODEL: "m", AI_PROVIDER: "xai", XAI_API_KEY: "k", AI_DAILY_CAP: "7", AI_EFFORT: "low" });
  assert.deepEqual(x, { provider: "xai", model: "m", dailyCap: 7, effort: "low" });
  assert.equal(readAiConfig({ AI_BRIEFING_ENABLED: "true", AI_MODEL: "m", ANTHROPIC_API_KEY: "k", AI_DAILY_CAP: "-3" })?.dailyCap, 50);
});

test("AT-46: bullets without a valid [n] citation are rejected", () => {
  const raw = [
    "- 첫 번째 요약 [1]",
    "- 근거 없는 전망 문장",
    "- 범위를 벗어난 인용만 있음 [9]",
    "* 두 기사 종합 [2][3]",
    "1. 번호 목록도 허용 [3]",
    "",
  ].join("\n");
  const { bullets, rejected } = parseAiBullets(raw, ITEMS);
  assert.equal(rejected, 2);
  assert.deepEqual(
    bullets.map((b) => b.cites),
    [[1], [2, 3], [3]],
  );
  assert.equal(bullets[0]!.text, "첫 번째 요약 [1]");
});

test("AT-46: out-of-range cites and unknown URLs are stripped from kept bullets", () => {
  const raw = "- 요약 https://evil.example/x 참고 https://example.com/a [1][12]";
  const { bullets } = parseAiBullets(raw, ITEMS);
  assert.equal(bullets.length, 1);
  assert.deepEqual(bullets[0]!.cites, [1]);
  assert.ok(!bullets[0]!.text.includes("evil.example"));
  assert.ok(bullets[0]!.text.includes("https://example.com/a"), "input URLs may stay");
  assert.ok(!bullets[0]!.text.includes("[12]"));
});

test("bullets are capped", () => {
  const raw = Array.from({ length: 20 }, (_, i) => `- 항목 ${i} [1]`).join("\n");
  assert.equal(parseAiBullets(raw, ITEMS).bullets.length, AI_MAX_BULLETS);
});

test("input: ≤ 30 items, de-duplicated, clamped, empty titles dropped", () => {
  const many: AiInputItem[] = Array.from({ length: 45 }, (_, i) => ({ id: `id${i % 40}`, title: `T${i}`, snippet: "x".repeat(500), source: "S", time: "날짜 미상", url: `https://example.com/${i}` }));
  many.push({ id: "blank", title: "  ", source: "S", time: "t", url: "https://example.com/z" });
  const out = normalizeAiInput(many);
  assert.equal(out.length, AI_MAX_ITEMS);
  assert.equal(new Set(out.map((i) => i.id)).size, out.length);
  assert.ok(out.every((i) => (i.snippet ?? "").length <= 240));
  assert.ok(!out.some((i) => i.id === "blank"));
  const [js] = normalizeAiInput([{ id: "x", title: "t", source: "s", time: "t", url: "javascript:alert(1)" }]);
  assert.equal(js!.url, "", "only http(s) links survive");
});

test("hash is stable and input-sensitive", () => {
  assert.equal(aiInputHash("brief", ITEMS, "ctx"), aiInputHash("brief", ITEMS.map((i) => ({ ...i })), "ctx"));
  assert.notEqual(aiInputHash("brief", ITEMS, "ctx"), aiInputHash("brief", ITEMS.slice(1), "ctx"));
  assert.notEqual(aiInputHash("brief", ITEMS, "ctx"), aiInputHash("tr", ITEMS, "ctx"));
  assert.match(aiInputHash("brief", ITEMS), /^[0-9a-f]{8}$/);
});

test("prompt numbers every item and carries only on-screen fields", () => {
  const { system, user } = buildBriefingPrompt(ITEMS, "테스트");
  assert.ok(system.includes("[3]"));
  assert.ok(user.includes("[1] Sample headline one — Sample snippet one."));
  assert.ok(user.includes("[2] 샘플 제목 둘 (출처: 예시 매체, 시각: 날짜 미상)"));
  assert.ok(!user.includes("https://"), "URLs are not sent to the model");
});

test("translation: numbered lines map back to ids; unknown numbers and URLs dropped", () => {
  const { user } = buildTranslatePrompt(ITEMS);
  assert.equal(user.split("\n").length, 3);
  const map = parseTranslations("[1] 샘플 헤드라인 1\n[7] 없음\n잡담\n[3] 셋 https://evil.example", ITEMS);
  assert.deepEqual(map, { a: "샘플 헤드라인 1", c: "셋" });
});

test("labels and cap day key", () => {
  assert.equal(AI_LABEL, "AI 요약 · 원문 확인 필요");
  assert.equal(MT_LABEL, "기계 번역");
  assert.equal(capDayKey(Date.UTC(2026, 0, 2, 23, 59)), "2026-01-02");
});
