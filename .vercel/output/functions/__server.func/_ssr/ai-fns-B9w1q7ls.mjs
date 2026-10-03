import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
import { c as string, r as array, s as object } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ai-fns-B9w1q7ls.js
/**
* Server functions for the optional AI layer (F9). Everything is off unless
* AI_BRIEFING_ENABLED=true + AI_MODEL + a provider key are set on the server.
*/
var Item = object({
	id: string().min(1).max(200),
	title: string().min(1).max(400),
	snippet: string().max(400).optional(),
	source: string().max(120),
	time: string().max(60),
	url: string().max(600)
});
var getAiStatus_createServerFn_handler = createServerRpc({
	id: "9dab6ac3b32910830224cd704478463b6f54984cea90a0933913cd57d85bf193",
	name: "getAiStatus",
	filename: "src/lib/ai-fns.ts"
}, (opts) => getAiStatus.__executeServer(opts));
var getAiStatus = createServerFn({ method: "GET" }).handler(getAiStatus_createServerFn_handler, async () => {
	const { aiStatus } = await import("./service-MLYR44OZ.mjs");
	return aiStatus();
});
var generateAiBriefing_createServerFn_handler = createServerRpc({
	id: "726f7c93ce7ded6d1859487d3f50bdd27e07bcea6412a9bdd1282d5d9f786efe",
	name: "generateAiBriefing",
	filename: "src/lib/ai-fns.ts"
}, (opts) => generateAiBriefing.__executeServer(opts));
var generateAiBriefing = createServerFn({ method: "POST" }).validator(object({
	items: array(Item).min(1).max(30),
	context: string().min(1).max(60)
})).handler(generateAiBriefing_createServerFn_handler, async ({ data }) => {
	const { generateBriefing } = await import("./service-MLYR44OZ.mjs");
	return generateBriefing(data.items, data.context);
});
var translateAiHeadlines_createServerFn_handler = createServerRpc({
	id: "70c2a1ac0af9f77fd5793b2149facd7399ac5e63bb7dc6f75407f0b7a88e1f46",
	name: "translateAiHeadlines",
	filename: "src/lib/ai-fns.ts"
}, (opts) => translateAiHeadlines.__executeServer(opts));
var translateAiHeadlines = createServerFn({ method: "POST" }).validator(object({ items: array(object({
	id: string().min(1).max(200),
	title: string().min(1).max(400)
})).min(1).max(30) })).handler(translateAiHeadlines_createServerFn_handler, async ({ data }) => {
	const { translateTitles } = await import("./service-MLYR44OZ.mjs");
	return translateTitles(data.items);
});
//#endregion
export { generateAiBriefing_createServerFn_handler, getAiStatus_createServerFn_handler, translateAiHeadlines_createServerFn_handler };
