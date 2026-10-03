/**
 * Optional AI briefing layer (F9) — pure helpers: input normalization,
 * prompts, and output validation. Bullets must cite input items as `[n]`;
 * uncited bullets are rejected and any URL not present in the input is
 * stripped. Nothing here calls a provider.
 */

export const AI_LABEL = "AI 요약 · 원문 확인 필요";
export const MT_LABEL = "기계 번역";
export const AI_MAX_ITEMS = 30;
export const AI_MAX_BULLETS = 8;

export interface AiInputItem {
  id: string;
  title: string;
  snippet?: string;
  source: string;
  /** ISO time or "날짜 미상". */
  time: string;
  url: string;
}

export interface AiBullet {
  text: string;
  /** 1-based indexes into the input list. */
  cites: number[];
}

const clamp = (s: string | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** ≤ 30 items, de-duplicated by id, fields clamped (titles 300, snippets 240); non-http(s) links dropped. */
export function normalizeAiInput(items: readonly AiInputItem[]): AiInputItem[] {
  const seen = new Set<string>();
  const out: AiInputItem[] = [];
  for (const it of items) {
    if (!it.id || seen.has(it.id) || !it.title?.trim()) continue;
    seen.add(it.id);
    const url = clamp(it.url, 500);
    out.push({ id: clamp(it.id, 200), title: clamp(it.title, 300), snippet: clamp(it.snippet, 240) || undefined, source: clamp(it.source, 80), time: clamp(it.time, 40), url: /^https?:\/\//i.test(url) ? url : "" });
    if (out.length >= AI_MAX_ITEMS) break;
  }
  return out;
}

/** FNV-1a 32-bit over the normalized input (cache key; not security-relevant). */
export function aiInputHash(kind: string, items: readonly AiInputItem[], extra = ""): string {
  const s = `${kind}|${extra}|${JSON.stringify(items.map((i) => [i.id, i.title, i.snippet ?? "", i.source, i.time, i.url]))}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function buildBriefingPrompt(items: readonly AiInputItem[], context: string): { system: string; user: string } {
  const system = [
    "당신은 금융 뉴스 데스크의 편집 보조입니다.",
    "입력으로 받은 기사 목록만 근거로 한국어 브리핑 글머리표를 작성합니다.",
    `규칙: 글머리표는 최대 ${AI_MAX_BULLETS}개, 각 줄은 "- "로 시작합니다.`,
    "각 글머리표 끝에 근거 기사 번호를 [3] 또는 [2][5]처럼 표기합니다. 번호 없는 문장은 쓰지 않습니다.",
    "입력에 없는 사실·수치·전망·투자 권유를 추가하지 않습니다. URL을 쓰지 않습니다.",
    "영문 제목은 뜻을 한국어로 요약하되 고유명사는 그대로 둡니다.",
  ].join("\n");
  const lines = items.map((it, i) => `[${i + 1}] ${it.title}${it.snippet ? ` — ${it.snippet}` : ""} (출처: ${it.source}, 시각: ${it.time})`);
  const user = `주제: ${context}\n기사 ${items.length}건:\n${lines.join("\n")}\n\n위 기사만 근거로 브리핑을 작성하세요.`;
  return { system, user };
}

const URL_RE = /https?:\/\/[^\s)\]]+/g;

/**
 * Parse model output into cited bullets (AT-46): lines without at least one
 * valid `[n]` citation are rejected; out-of-range citations are removed;
 * URLs not present in the input are stripped.
 */
export function parseAiBullets(raw: string, items: readonly AiInputItem[]): { bullets: AiBullet[]; rejected: number } {
  const allowedUrls = new Set(items.map((i) => i.url).filter(Boolean));
  const bullets: AiBullet[] = [];
  let rejected = 0;
  for (const line0 of raw.split(/\r?\n/)) {
    const line = line0.trim().replace(/^(?:[-*•·]|\d+[.)])\s*/, "");
    if (!line) continue;
    const cites: number[] = [];
    for (const m of line.matchAll(/\[(\d{1,2})\]/g)) {
      const n = Number(m[1]);
      if (n >= 1 && n <= items.length && !cites.includes(n)) cites.push(n);
    }
    if (!cites.length) {
      rejected += 1;
      continue;
    }
    const text = line
      .replace(URL_RE, (u) => (allowedUrls.has(u) ? u : ""))
      .replace(/\[(\d{1,2})\]/g, (all, d: string) => (Number(d) >= 1 && Number(d) <= items.length ? all : ""))
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 400);
    bullets.push({ text, cites });
    if (bullets.length >= AI_MAX_BULLETS) break;
  }
  return { bullets, rejected };
}

export function buildTranslatePrompt(items: readonly { id: string; title: string }[]): { system: string; user: string } {
  return {
    system: "영문 금융 기사 제목을 자연스러운 한국어로 번역합니다. 각 줄을 입력과 같은 번호 [n]으로 시작하고, 설명이나 추가 정보 없이 번역문만 씁니다. 고유명사·티커는 그대로 둡니다.",
    user: items.map((it, i) => `[${i + 1}] ${it.title}`).join("\n"),
  };
}

/** `[n] 번역` lines → id → Korean title (unknown numbers ignored). */
export function parseTranslations(raw: string, items: readonly { id: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*\[(\d{1,2})\]\s*(.+)$/.exec(line);
    if (!m) continue;
    const n = Number(m[1]);
    const it = items[n - 1];
    if (it && m[2]!.trim()) out[it.id] = m[2]!.replace(URL_RE, "").trim().slice(0, 300);
  }
  return out;
}

/** UTC day key for the daily cap. */
export function capDayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}
