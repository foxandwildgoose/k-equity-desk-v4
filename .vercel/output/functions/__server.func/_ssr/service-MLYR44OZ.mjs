import { a as capDayKey, c as parseTranslations, i as buildTranslatePrompt, n as aiInputHash, o as normalizeAiInput, r as buildBriefingPrompt, s as parseAiBullets } from "./briefing-CtWXT9FJ.mjs";
import { t as Anthropic } from "../_libs/@anthropic-ai/sdk+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/service-MLYR44OZ.js
/** Enabled only when switched on AND a model + the provider's key exist; otherwise null (no UI). */
function readAiConfig(env) {
	if (env.AI_BRIEFING_ENABLED?.trim().toLowerCase() !== "true") return null;
	const model = env.AI_MODEL?.trim();
	if (!model) return null;
	const provider = env.AI_PROVIDER?.trim().toLowerCase() === "xai" ? "xai" : "anthropic";
	if (!(provider === "xai" ? env.XAI_API_KEY : env.ANTHROPIC_API_KEY)?.trim()) return null;
	const cap = Number(env.AI_DAILY_CAP);
	const effort = env.AI_EFFORT?.trim().toLowerCase();
	return {
		provider,
		model,
		dailyCap: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 50,
		effort: effort === "low" || effort === "medium" || effort === "high" ? effort : null
	};
}
/**
* AI provider interface (F9.3) with `anthropic` and `xai` adapters.
* Server-only: keys never leave the server and never use a VITE_ prefix.
* Model IDs are never hard-coded — `AI_MODEL` is required.
*
* Env: AI_BRIEFING_ENABLED=true, AI_MODEL, AI_PROVIDER (anthropic|xai,
* default anthropic), ANTHROPIC_API_KEY or XAI_API_KEY, optional
* AI_DAILY_CAP (default 50) and AI_EFFORT (low|medium|high; Anthropic only).
*/
var AiRefusalError = class extends Error {};
/** Outbound timeout (A6: ≤ 8 s) — keeps the server function inside the platform limit. */
var TIMEOUT_MS = 8e3;
async function anthropicComplete(cfg, req) {
	const res = await new Anthropic({
		apiKey: process.env.ANTHROPIC_API_KEY,
		maxRetries: 0,
		timeout: TIMEOUT_MS
	}).messages.create({
		model: cfg.model,
		max_tokens: req.maxTokens,
		system: req.system,
		messages: [{
			role: "user",
			content: req.user
		}],
		...cfg.effort ? { output_config: { effort: cfg.effort } } : {}
	});
	if (res.stop_reason === "refusal") throw new AiRefusalError("모델이 요청을 처리하지 않았습니다 (refusal).");
	return {
		text: res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n"),
		inputTokens: res.usage.input_tokens,
		outputTokens: res.usage.output_tokens,
		stopReason: res.stop_reason
	};
}
/** xAI chat completions (docs.x.ai REST shape; not re-verified here — egress blocked). */
async function xaiComplete(cfg, req) {
	const res = await fetch("https://api.x.ai/v1/chat/completions", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${process.env.XAI_API_KEY ?? ""}`
		},
		body: JSON.stringify({
			model: cfg.model,
			max_tokens: req.maxTokens,
			messages: [{
				role: "system",
				content: req.system
			}, {
				role: "user",
				content: req.user
			}]
		}),
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	if (!res.ok) throw new Error(`xAI HTTP ${res.status}`);
	const json = await res.json();
	const choice = json.choices?.[0];
	return {
		text: choice?.message?.content ?? "",
		inputTokens: json.usage?.prompt_tokens ?? null,
		outputTokens: json.usage?.completion_tokens ?? null,
		stopReason: choice?.finish_reason ?? null
	};
}
async function aiComplete(cfg, req) {
	return cfg.provider === "xai" ? xaiComplete(cfg, req) : anthropicComplete(cfg, req);
}
/**
* AI briefing service (F9): 15-minute cache by input hash, daily cap,
* cited-bullet validation. In-memory per server instance (stated in UI).
*/
var CACHE_TTL = 9e5;
var cache = /* @__PURE__ */ new Map();
var usage = {
	day: "",
	count: 0
};
function cached(key) {
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value;
	return null;
}
function store(key, value) {
	cache.set(key, {
		at: Date.now(),
		value
	});
	if (cache.size > 200) cache.delete(cache.keys().next().value);
}
function takeQuota(cap) {
	const day = capDayKey(Date.now());
	if (usage.day !== day) usage = {
		day,
		count: 0
	};
	if (usage.count >= cap) return false;
	usage.count += 1;
	return true;
}
function aiStatus() {
	const cfg = readAiConfig(process.env);
	const day = capDayKey(Date.now());
	return cfg ? {
		enabled: true,
		provider: cfg.provider,
		dailyCap: cfg.dailyCap,
		usedToday: usage.day === day ? usage.count : 0
	} : { enabled: false };
}
async function generateBriefing(rawItems, context) {
	const cfg = readAiConfig(process.env);
	if (!cfg) return {
		ok: false,
		error: "AI 브리핑이 설정되지 않았습니다."
	};
	const items = normalizeAiInput(rawItems);
	if (items.length < 2) return {
		ok: false,
		error: "요약할 항목이 부족합니다 (2건 이상 필요)."
	};
	const key = aiInputHash("brief", items, `${cfg.provider}:${cfg.model}:${context}`);
	const hit = cached(key);
	if (hit && hit.ok) return {
		...hit,
		cached: true
	};
	if (!takeQuota(cfg.dailyCap)) return {
		ok: false,
		error: `오늘 AI 요약 한도(${cfg.dailyCap}회)를 모두 사용했습니다.`
	};
	try {
		const { system, user } = buildBriefingPrompt(items, context);
		const out = await aiComplete(cfg, {
			system,
			user,
			maxTokens: 1500
		});
		const parsed = parseAiBullets(out.text, items);
		if (!parsed.bullets.length) return {
			ok: false,
			error: "근거 번호가 달린 요약이 없어 결과를 버렸습니다."
		};
		const result = {
			ok: true,
			bullets: parsed.bullets,
			rejected: parsed.rejected,
			items,
			cached: false,
			inputTokens: out.inputTokens,
			outputTokens: out.outputTokens,
			provider: cfg.provider,
			generatedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		store(key, result);
		return result;
	} catch (err) {
		if (err instanceof AiRefusalError) return {
			ok: false,
			error: err.message
		};
		return {
			ok: false,
			error: `AI 요청 실패: ${err instanceof Error ? err.message.slice(0, 120) : "error"}`
		};
	}
}
async function translateTitles(rawItems) {
	const cfg = readAiConfig(process.env);
	if (!cfg) return {
		ok: false,
		error: "AI 번역이 설정되지 않았습니다."
	};
	const items = rawItems.filter((i) => i.id && i.title.trim()).slice(0, 30).map((i) => ({
		id: i.id.slice(0, 200),
		title: i.title.slice(0, 300)
	}));
	if (!items.length) return {
		ok: false,
		error: "번역할 제목이 없습니다."
	};
	const key = aiInputHash("tr", items.map((i) => ({
		id: i.id,
		title: i.title,
		source: "",
		time: "",
		url: ""
	})), `${cfg.provider}:${cfg.model}`);
	const hit = cached(key);
	if (hit) return {
		ok: true,
		translations: hit,
		cached: true
	};
	if (!takeQuota(cfg.dailyCap)) return {
		ok: false,
		error: `오늘 AI 한도(${cfg.dailyCap}회)를 모두 사용했습니다.`
	};
	try {
		const { system, user } = buildTranslatePrompt(items);
		const out = await aiComplete(cfg, {
			system,
			user,
			maxTokens: 2e3
		});
		const translations = parseTranslations(out.text, items);
		store(key, translations);
		return {
			ok: true,
			translations,
			cached: false
		};
	} catch (err) {
		return {
			ok: false,
			error: `AI 번역 실패: ${err instanceof Error ? err.message.slice(0, 120) : "error"}`
		};
	}
}
//#endregion
export { aiStatus, generateBriefing, translateTitles };
