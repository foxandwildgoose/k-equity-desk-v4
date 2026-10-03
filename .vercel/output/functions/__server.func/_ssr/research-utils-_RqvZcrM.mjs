import { i as latestPerBrokerByKernel } from "./mappers-DlpCqw-E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/research-utils-_RqvZcrM.js
var DECISION_TERMS = [
	"목표주가",
	"투자의견",
	"매수",
	"중립",
	"매도",
	"실적",
	"영업이익",
	"매출",
	"마진",
	"수요",
	"수주",
	"가격",
	"재고",
	"성장",
	"하향",
	"상향",
	"리스크",
	"모멘텀",
	"밸류",
	"전망",
	"가이던스",
	"CAPEX",
	"환율",
	"정책"
];
function cleanResearchText(text) {
	return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/^[·•\-\s]+/, "").trim();
}
/** Deterministic extractive summary. It never invents facts outside the broker text. */
function buildResearchExecutiveSummary(text, title = "") {
	const clean = cleanResearchText(text);
	if (!clean) return cleanResearchText(title);
	const sentences = clean.split(/(?<=[.!?。]|다\.)\s+|\n+/).map((s) => s.trim()).filter((s) => s.length >= 12);
	if (!sentences.length) return clean.slice(0, 280);
	return sentences.map((sentence, index) => ({
		sentence,
		index,
		score: DECISION_TERMS.reduce((score, term) => score + (sentence.toLowerCase().includes(term.toLowerCase()) ? 2 : 0), 0) + (index < 2 ? 1 : 0)
	})).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 2).sort((a, b) => a.index - b.index).map((x) => x.sentence).join(" ").slice(0, 320);
}
/**
* Extractive bullets for detail sheets (F2.7): the highest-signal source
* sentences, in source order. Never paraphrases; ≤ 4 bullets, each ≤ 240 chars.
*/
function buildResearchBullets(text, title = "", max = 4) {
	const clean = cleanResearchText(text);
	if (!clean) return title ? [cleanResearchText(title)] : [];
	const sentences = clean.split(/(?<=[.!?。]|다\.)\s+|\n+/).map((s) => s.trim()).filter((s) => s.length >= 12);
	if (!sentences.length) return [clean.slice(0, 240)];
	return sentences.map((sentence, index) => ({
		sentence,
		index,
		score: DECISION_TERMS.reduce((acc, term) => acc + (sentence.toLowerCase().includes(term.toLowerCase()) ? 2 : 0), 0) + (index < 2 ? 1 : 0)
	})).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, max).sort((a, b) => a.index - b.index).map((x) => x.sentence.length > 240 ? `${x.sentence.slice(0, 239)}…` : x.sentence);
}
function reportHasInvestmentView(report) {
	return Boolean(report.rating || report.targetPrice != null && report.targetPrice > 0);
}
/** Latest report per broker, newest first via the shared kernel (D1a). */
function latestReportPerBroker(reports) {
	return latestPerBrokerByKernel(reports);
}
function median(values) {
	if (!values.length) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
//#endregion
export { reportHasInvestmentView as a, median as i, buildResearchExecutiveSummary as n, latestReportPerBroker as r, buildResearchBullets as t };
