import { o as recordResult, s as setHealthNote } from "./health-z1OjkYee.mjs";
import { n as fetchJsonWithPolicy } from "./http-CCgilygj.mjs";
import { o as kstToday } from "./time-By5ScNNo.mjs";
import { a as classifyResearchSectors } from "./research-taxonomy-BpoDpMeG.mjs";
import { n as buildResearchExecutiveSummary } from "./research-utils-_RqvZcrM.mjs";
import { a as parseGoalPriceSets, c as researchPageUrl, l as sortV2NewestFirst, o as parseV2Detail, r as legacyCategory, s as parseV2List, t as V2_LABEL } from "./naver-v2-C8XzGZTP.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/research-v2-DNVSaUnS.js
/**
* KR research adapter (F2.1): stock.naver.com research v2 first, legacy
* m.stock.naver.com/api/research/* as fallback. The serving path is recorded
* in source health (`v2` / `legacy`). Server-only.
*/
var BASE = "https://stock.naver.com/api/stockSecurity/researches/v2";
/** v2 row → the existing ResearchReport shape (kept for current consumers). */
function v2ToReport(r) {
	const blob = `${r.title} ${r.preview ?? ""} ${r.industry ?? ""}`;
	return {
		researchId: r.nid,
		code: r.itemCode,
		nameKo: r.itemName,
		title: r.title,
		broker: r.broker,
		date: r.date,
		preview: r.preview ?? "",
		rating: r.rating,
		targetPrice: r.targetPrice,
		category: legacyCategory(r.type),
		categoryLabel: V2_LABEL[r.type],
		pdfUrl: r.pdfUrl,
		pageUrl: r.pageUrl,
		readCount: r.readCount,
		summary: buildResearchExecutiveSummary(r.preview ?? "", r.title),
		sectorIds: classifyResearchSectors(blob),
		tags: r.industry ? [r.industry] : [],
		hasInvestmentView: Boolean(r.rating || r.targetPrice),
		sourceKind: "naver",
		sourceLabel: "네이버 리서치 v2",
		v2Type: r.type,
		summarySource: r.preview ? "preview" : "none"
	};
}
function listUrl(q) {
	const params = new URLSearchParams({
		index: String(q.index ?? 0),
		size: String(q.size ?? 20)
	});
	for (const c of q.itemCodes ?? []) params.append("itemCodes", c);
	for (const t of q.industryTypes ?? []) params.append("industryTypes", t);
	if (q.startDate) params.set("startDate", q.startDate);
	if (q.endDate) params.set("endDate", q.endDate);
	return `${BASE}/${q.type}?${params}`;
}
var LEGACY_PATH = {
	company: "company",
	industry: "industry",
	invest: "invest",
	economy: "economy",
	market: "market"
};
async function legacyList(q) {
	const { fetchResearchList, fetchCategoryResearch } = await import("./naver-market-C1ZunDb_.mjs").then((n) => n.f).then((n) => n.f);
	if (q.type === "company" && q.itemCodes?.length === 1) return fetchResearchList(q.itemCodes[0]);
	if (!LEGACY_PATH[q.type] || q.type === "company") return [];
	return (await fetchCategoryResearch(q.type === "invest" || q.type === "market" ? "market" : q.type, 40)).map((r) => ({
		...r,
		v2Type: q.type,
		categoryLabel: V2_LABEL[q.type],
		sourceLabel: "네이버 리서치 (레거시)"
	}));
}
/** One category page: v2 first, legacy fallback (page 0 only; no totalCount). */
async function fetchResearchV2List(q) {
	const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
	const index = q.index ?? 0;
	try {
		const json = await fetchJsonWithPolicy(listUrl(q), {
			sourceId: "naver-research-v2",
			bypassCache: q.bypassCache,
			ttlMs: 18e4
		});
		const page = parseV2List(json, q.type);
		recordResult("naver-research-v2", {
			count: page.items.length,
			newestPublishedAt: page.items[0]?.publishedAt ?? null,
			adapterPath: "v2"
		});
		if (Array.isArray(json?.items) && json.items.length && !page.items.length) setHealthNote("naver-research-v2", "shape", "v2 응답 필드 매핑 실패 — 재검증 필요");
		return {
			type: q.type,
			index,
			reports: page.items.map(v2ToReport),
			totalCount: page.totalCount,
			hasNext: page.hasNext,
			path: "v2",
			error: null,
			fetchedAt
		};
	} catch (v2err) {
		if (index > 0) return {
			type: q.type,
			index,
			reports: [],
			totalCount: null,
			hasNext: false,
			path: "none",
			error: v2err instanceof Error ? v2err.message : "v2 error",
			fetchedAt
		};
		try {
			const reports = await legacyList(q);
			recordResult("naver-research-legacy", {
				count: reports.length,
				adapterPath: "legacy"
			});
			setHealthNote("naver-research-v2", "fallback", reports.length ? "v2 실패 → 레거시 경로로 제공" : null);
			return {
				type: q.type,
				index,
				reports,
				totalCount: null,
				hasNext: false,
				path: reports.length ? "legacy" : "none",
				error: reports.length ? null : v2err instanceof Error ? v2err.message : "v2 error",
				fetchedAt
			};
		} catch (legacyErr) {
			return {
				type: q.type,
				index,
				reports: [],
				totalCount: null,
				hasNext: false,
				path: "none",
				error: legacyErr instanceof Error ? legacyErr.message : "legacy error",
				fetchedAt
			};
		}
	}
}
/** Company reports for many tickers (≤ 10 itemCodes per call — F6.7). */
async function fetchCompanyResearchFor(codes, size = 30) {
	const chunks = [];
	for (let i = 0; i < codes.length; i += 10) chunks.push(codes.slice(i, i + 10));
	return Promise.all(chunks.map((c) => fetchResearchV2List({
		type: "company",
		itemCodes: c,
		size
	})));
}
var detailCache = /* @__PURE__ */ new Map();
var DETAIL_TTL_MS = 6e5;
/** Detail + prev/next for the same ticker (F2.7). Never calls `/view`. */
async function fetchResearchV2Detail(type, nid, itemCode) {
	const key = `${type}:${nid}:${itemCode ?? ""}`;
	const hit = detailCache.get(key);
	if (hit && Date.now() - hit.at < DETAIL_TTL_MS) return hit.data;
	const pageUrl = researchPageUrl(type, nid);
	let data;
	try {
		const detail = parseV2Detail(await fetchJsonWithPolicy(`${BASE}/${type}/${nid}`, {
			sourceId: "naver-research-v2",
			ttlMs: DETAIL_TTL_MS
		}), type);
		let prev = null;
		let next = null;
		if (itemCode && /^[0-9A-Z]{6}$/.test(itemCode)) try {
			const dp = parseV2Detail(await fetchJsonWithPolicy(`${BASE}/${type}/${nid}/detail-page?itemCode=${itemCode}&size=1`, {
				sourceId: "naver-research-v2",
				ttlMs: DETAIL_TTL_MS
			}), type);
			prev = dp.prev;
			next = dp.next;
		} catch {}
		const report = detail.row ? v2ToReport(detail.row) : null;
		data = {
			report,
			bulletsText: detail.text || report?.preview || "",
			prev: prev ? v2ToReport(prev) : null,
			next: next ? v2ToReport(next) : null,
			pdfUrl: detail.row?.pdfUrl ?? null,
			pageUrl,
			summarySource: detail.text ? "detail" : report?.preview ? "preview" : "none",
			path: "v2",
			error: null
		};
	} catch (err) {
		try {
			const { fetchResearchPdf } = await import("./naver-market-C1ZunDb_.mjs").then((n) => n.f).then((n) => n.f);
			const deep = await fetchResearchPdf(nid, legacyCategory(type));
			data = {
				report: null,
				bulletsText: deep.previewExtra ?? "",
				prev: null,
				next: null,
				pdfUrl: deep.pdfUrl ?? null,
				pageUrl: deep.pageUrl || pageUrl,
				summarySource: deep.previewExtra ? "detail" : "none",
				path: "legacy",
				error: null
			};
		} catch {
			data = {
				report: null,
				bulletsText: "",
				prev: null,
				next: null,
				pdfUrl: null,
				pageUrl,
				summarySource: "none",
				path: "none",
				error: err instanceof Error ? err.message : "detail error"
			};
		}
	}
	detailCache.set(key, {
		at: Date.now(),
		data
	});
	if (detailCache.size > 300) detailCache.delete(detailCache.keys().next().value);
	return data;
}
/** F2.6 pre-resolve: PDF URL for a row (10-min server cache via the detail cache). */
async function resolveResearchOriginal(type, nid) {
	const d = await fetchResearchV2Detail(type, nid);
	return {
		pdfUrl: d.pdfUrl,
		pageUrl: d.pageUrl
	};
}
var briefingCache = null;
/** F2.4 strip: today's count per category, TP up/down TOP, weekly-hot, new coverage (heuristic). */
async function fetchResearchBriefing() {
	if (briefingCache && Date.now() - briefingCache.at < 6e5) return briefingCache.data;
	const today = kstToday();
	const weekAgo = (/* @__PURE__ */ new Date(Date.parse(`${today}T00:00:00Z`) - 6048e5)).toISOString().slice(0, 10);
	const errors = [];
	const types = [
		"company",
		"industry",
		"invest",
		"economy",
		"debenture",
		"market"
	];
	const counts = await Promise.all(types.map(async (type) => {
		try {
			const json = await fetchJsonWithPolicy(listUrl({
				type,
				index: 0,
				size: 20,
				startDate: today,
				endDate: today
			}), {
				sourceId: "naver-research-v2",
				ttlMs: 6e5
			});
			const page = parseV2List(json, type);
			return {
				type,
				label: V2_LABEL[type],
				count: page.totalCount ?? page.items.length,
				items: page.items
			};
		} catch (err) {
			errors.push(`${V2_LABEL[type]}: ${err instanceof Error ? err.message : "error"}`);
			return {
				type,
				label: V2_LABEL[type],
				count: null,
				items: []
			};
		}
	}));
	const goal = async (direction) => {
		try {
			return parseGoalPriceSets(await fetchJsonWithPolicy(`${BASE}/company/goal-price-changed?direction=${direction}&size=10`, { sourceId: "naver-research-goal" }), direction);
		} catch (err) {
			errors.push(`목표가 ${direction === "up" ? "상향" : "하향"}: ${err instanceof Error ? err.message : "error"}`);
			return [];
		}
	};
	const [up, down, weekly] = await Promise.all([
		goal("up"),
		goal("down"),
		(async () => {
			try {
				const json = await fetchJsonWithPolicy(`${BASE}/weekly-hot?startDate=${weekAgo}&size=10`, { sourceId: "naver-research-weekly" });
				return parseV2List(json, "company").items.map(v2ToReport);
			} catch (err) {
				errors.push(`주간 인기: ${err instanceof Error ? err.message : "error"}`);
				return [];
			}
		})()
	]);
	const { isNewCoverage } = await import("./naver-v2-C8XzGZTP.mjs").then((n) => n.i).then((n) => n.i);
	const companyToday = counts.find((c) => c.type === "company")?.items ?? [];
	let latestRows = sortV2NewestFirst(counts.flatMap((c) => c.items)).slice(0, 3);
	if (latestRows.length < 3) {
		const pages = await Promise.all(types.map(async (type) => {
			try {
				return parseV2List(await fetchJsonWithPolicy(listUrl({
					type,
					index: 0,
					size: 20
				}), {
					sourceId: "naver-research-v2",
					ttlMs: 18e4
				}), type).items;
			} catch {
				return [];
			}
		}));
		latestRows = sortV2NewestFirst(pages.flat()).slice(0, 3);
	}
	const data = {
		todayCounts: counts.map(({ type, label, count }) => ({
			type,
			label,
			count
		})),
		up: up.slice(0, 5),
		down: down.slice(0, 5),
		weeklyHot: weekly.slice(0, 5),
		newCoverage: sortV2NewestFirst(companyToday.filter((r) => isNewCoverage(r.title))).slice(0, 5).map(v2ToReport),
		latest: latestRows.map(v2ToReport),
		errors,
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	briefingCache = {
		at: Date.now(),
		data
	};
	return data;
}
//#endregion
export { fetchCompanyResearchFor, fetchResearchBriefing, fetchResearchV2Detail, fetchResearchV2List, resolveResearchOriginal };
