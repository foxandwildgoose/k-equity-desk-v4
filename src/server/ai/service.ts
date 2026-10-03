/**
 * AI briefing service (F9): 15-minute cache by input hash, daily cap,
 * cited-bullet validation. In-memory per server instance (stated in UI).
 */
import {
  aiInputHash,
  buildBriefingPrompt,
  buildTranslatePrompt,
  capDayKey,
  normalizeAiInput,
  parseAiBullets,
  parseTranslations,
  type AiBullet,
  type AiInputItem,
} from "@/lib/ai/briefing";
import { aiComplete, AiRefusalError, readAiConfig } from "@/server/ai/provider";

const CACHE_TTL = 15 * 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
let usage = { day: "", count: 0 };

function cached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value as T;
  return null;
}

function store(key: string, value: unknown) {
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
}

function takeQuota(cap: number): boolean {
  const day = capDayKey(Date.now());
  if (usage.day !== day) usage = { day, count: 0 };
  if (usage.count >= cap) return false;
  usage.count += 1;
  return true;
}

export function aiStatus() {
  const cfg = readAiConfig(process.env);
  const day = capDayKey(Date.now());
  return cfg ? { enabled: true as const, provider: cfg.provider, dailyCap: cfg.dailyCap, usedToday: usage.day === day ? usage.count : 0 } : { enabled: false as const };
}

export type AiBriefingResult =
  | { ok: true; bullets: AiBullet[]; rejected: number; items: AiInputItem[]; cached: boolean; inputTokens: number | null; outputTokens: number | null; provider: string; generatedAt: string }
  | { ok: false; error: string };

export async function generateBriefing(rawItems: AiInputItem[], context: string): Promise<AiBriefingResult> {
  const cfg = readAiConfig(process.env);
  if (!cfg) return { ok: false, error: "AI 브리핑이 설정되지 않았습니다." };
  const items = normalizeAiInput(rawItems);
  if (items.length < 2) return { ok: false, error: "요약할 항목이 부족합니다 (2건 이상 필요)." };
  const key = aiInputHash("brief", items, `${cfg.provider}:${cfg.model}:${context}`);
  const hit = cached<AiBriefingResult>(key);
  if (hit && hit.ok) return { ...hit, cached: true };
  if (!takeQuota(cfg.dailyCap)) return { ok: false, error: `오늘 AI 요약 한도(${cfg.dailyCap}회)를 모두 사용했습니다.` };
  try {
    const { system, user } = buildBriefingPrompt(items, context);
    const out = await aiComplete(cfg, { system, user, maxTokens: 1500 });
    const parsed = parseAiBullets(out.text, items);
    if (!parsed.bullets.length) return { ok: false, error: "근거 번호가 달린 요약이 없어 결과를 버렸습니다." };
    const result: AiBriefingResult = {
      ok: true,
      bullets: parsed.bullets,
      rejected: parsed.rejected,
      items,
      cached: false,
      inputTokens: out.inputTokens,
      outputTokens: out.outputTokens,
      provider: cfg.provider,
      generatedAt: new Date().toISOString(),
    };
    store(key, result);
    return result;
  } catch (err) {
    if (err instanceof AiRefusalError) return { ok: false, error: err.message };
    return { ok: false, error: `AI 요청 실패: ${err instanceof Error ? err.message.slice(0, 120) : "error"}` };
  }
}

export async function translateTitles(rawItems: { id: string; title: string }[]): Promise<{ ok: true; translations: Record<string, string>; cached: boolean } | { ok: false; error: string }> {
  const cfg = readAiConfig(process.env);
  if (!cfg) return { ok: false, error: "AI 번역이 설정되지 않았습니다." };
  const items = rawItems.filter((i) => i.id && i.title.trim()).slice(0, 30).map((i) => ({ id: i.id.slice(0, 200), title: i.title.slice(0, 300) }));
  if (!items.length) return { ok: false, error: "번역할 제목이 없습니다." };
  const key = aiInputHash("tr", items.map((i) => ({ id: i.id, title: i.title, source: "", time: "", url: "" })), `${cfg.provider}:${cfg.model}`);
  const hit = cached<Record<string, string>>(key);
  if (hit) return { ok: true, translations: hit, cached: true };
  if (!takeQuota(cfg.dailyCap)) return { ok: false, error: `오늘 AI 한도(${cfg.dailyCap}회)를 모두 사용했습니다.` };
  try {
    const { system, user } = buildTranslatePrompt(items);
    const out = await aiComplete(cfg, { system, user, maxTokens: 2000 });
    const translations = parseTranslations(out.text, items);
    store(key, translations);
    return { ok: true, translations, cached: false };
  } catch (err) {
    return { ok: false, error: `AI 번역 실패: ${err instanceof Error ? err.message.slice(0, 120) : "error"}` };
  }
}
