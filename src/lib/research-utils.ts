import type { ResearchReport } from "@/server/naver-market";
import { latestPerBrokerByKernel } from "./feed/mappers.ts";

const DECISION_TERMS = [
  "목표주가", "투자의견", "매수", "중립", "매도", "실적", "영업이익", "매출",
  "마진", "수요", "수주", "가격", "재고", "성장", "하향", "상향", "리스크",
  "모멘텀", "밸류", "전망", "가이던스", "CAPEX", "환율", "정책",
];

export function cleanResearchText(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[·•\-\s]+/, "")
    .trim();
}

/** Deterministic extractive summary. It never invents facts outside the broker text. */
export function buildResearchExecutiveSummary(text: string, title = ""): string {
  const clean = cleanResearchText(text);
  if (!clean) return cleanResearchText(title);

  const sentences = clean
    .split(/(?<=[.!?。]|다\.)\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);

  if (!sentences.length) return clean.slice(0, 280);

  const ranked = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score:
        DECISION_TERMS.reduce(
          (score, term) => score + (sentence.toLowerCase().includes(term.toLowerCase()) ? 2 : 0),
          0,
        ) + (index < 2 ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 2)
    .sort((a, b) => a.index - b.index)
    .map((x) => x.sentence)
    .join(" ");

  return ranked.slice(0, 320);
}

/**
 * Extractive bullets for detail sheets (F2.7): the highest-signal source
 * sentences, in source order. Never paraphrases; ≤ 4 bullets, each ≤ 240 chars.
 */
export function buildResearchBullets(text: string, title = "", max = 4): string[] {
  const clean = cleanResearchText(text);
  if (!clean) return title ? [cleanResearchText(title)] : [];
  const sentences = clean
    .split(/(?<=[.!?。]|다\.)\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
  if (!sentences.length) return [clean.slice(0, 240)];
  return sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score:
        DECISION_TERMS.reduce((acc, term) => acc + (sentence.toLowerCase().includes(term.toLowerCase()) ? 2 : 0), 0) +
        (index < 2 ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, max)
    .sort((a, b) => a.index - b.index)
    .map((x) => (x.sentence.length > 240 ? `${x.sentence.slice(0, 239)}…` : x.sentence));
}

export function reportHasInvestmentView(report: ResearchReport): boolean {
  return Boolean(report.rating || (report.targetPrice != null && report.targetPrice > 0));
}

/** Latest report per broker, newest first via the shared kernel (D1a). */
export function latestReportPerBroker(reports: ResearchReport[]): ResearchReport[] {
  return latestPerBrokerByKernel(reports);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}
