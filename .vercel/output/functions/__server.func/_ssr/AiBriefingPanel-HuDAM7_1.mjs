import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as createServerFn } from "./ssr.mjs";
import { c as string, r as array, s as object } from "../_libs/zod.mjs";
import { d as createSsrRpc } from "./classify-DLKCwe5y.mjs";
import { n as useMutation, r as useQuery } from "../_libs/tanstack__react-query.mjs";
import { K as Languages, p as Sparkles, z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { et as TimeStamp } from "./router-B1V8nj-n.mjs";
import { t as MT_LABEL } from "./briefing-CtWXT9FJ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AiBriefingPanel-HuDAM7_1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
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
var getAiStatus = createServerFn({ method: "GET" }).handler(createSsrRpc("9dab6ac3b32910830224cd704478463b6f54984cea90a0933913cd57d85bf193"));
/** User-clicked briefing over ≤ 30 on-screen items (F9.2). */
var generateAiBriefing = createServerFn({ method: "POST" }).validator(object({
	items: array(Item).min(1).max(30),
	context: string().min(1).max(60)
})).handler(createSsrRpc("726f7c93ce7ded6d1859487d3f50bdd27e07bcea6412a9bdd1282d5d9f786efe"));
/** Optional EN→KO headline translation (F9.4), labelled 기계 번역. */
var translateAiHeadlines = createServerFn({ method: "POST" }).validator(object({ items: array(object({
	id: string().min(1).max(200),
	title: string().min(1).max(400)
})).min(1).max(30) })).handler(createSsrRpc("70c2a1ac0af9f77fd5793b2149facd7399ac5e63bb7dc6f75407f0b7a88e1f46"));
function useAiStatus() {
	return useQuery({
		queryKey: ["ai-status"],
		queryFn: () => getAiStatus(),
		staleTime: 3e5,
		refetchOnWindowFocus: false
	});
}
/** On-screen feed items → AI input (title, source snippet unless paywalled, source, time, url, id). */
function feedToAiItems(items) {
	return items.slice(0, 30).map((it) => ({
		id: it.id,
		title: it.title,
		snippet: it.paywalled ? void 0 : it.snippet,
		source: it.outlet ?? it.sourceName,
		time: it.publishedAt ?? "날짜 미상",
		url: it.url
	}));
}
/**
* F9.2 "AI 브리핑 생성": rendered only when the server has the AI layer
* configured; runs only on click; every bullet links to its cited items.
*/
function AiBriefingPanel({ items, context }) {
	const status = useAiStatus();
	const run = useMutation({ mutationFn: () => generateAiBriefing({ data: {
		items: items.slice(0, 30),
		context
	} }) });
	if (!status.data?.enabled) return null;
	const res = run.data;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "space-y-1.5 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2.5 text-[12px]",
		"data-testid": "ai-briefing",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-1 text-[11px] font-semibold text-violet-400",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5" }), " AI 브리핑 (선택)"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => run.mutate(),
					disabled: run.isPending || items.length < 2,
					className: "inline-flex min-h-9 items-center gap-1 rounded-md border border-violet-500/40 px-2 text-[11px] font-semibold hover:bg-violet-500/10 disabled:opacity-50",
					"data-testid": "ai-briefing-button",
					children: [run.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3" }), " AI 브리핑 생성"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-[10px] text-muted-foreground",
				children: [
					"화면의 항목 ",
					Math.min(items.length, 30),
					"건(제목·출처 발췌·시각·링크)만 보냅니다. 원문·PDF는 보내지 않습니다.",
					"usedToday" in status.data ? ` · 오늘 ${status.data.usedToday}/${status.data.dailyCap}회` : ""
				]
			}),
			run.isError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-price-down",
				children: "AI 요청 실패"
			}),
			res && !res.ok && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-price-down",
				children: res.error
			}),
			res && res.ok && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "inline-block rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-400",
						"data-testid": "ai-label",
						children: "AI 요약 · 원문 확인 필요"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "list-disc space-y-1 pl-4",
						children: res.bullets.map((b, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							b.text.replace(/\[\d{1,2}\]/g, "").trim(),
							" ",
							b.cites.map((n) => {
								const it = res.items[n - 1];
								if (!it) return null;
								return it.url ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: it.url,
									target: "_blank",
									rel: "noopener noreferrer",
									className: "text-[10px] font-semibold text-primary hover:underline",
									title: `${it.source} · ${it.title}`,
									children: [
										"[",
										n,
										"]"
									]
								}, n) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[10px] font-semibold text-muted-foreground",
									title: `${it.source} · ${it.title}`,
									children: [
										"[",
										n,
										"]"
									]
								}, n);
							})
						] }, i))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-[10px] text-muted-foreground",
						children: [
							res.cached ? "캐시(15분) · " : "",
							"생성 ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
								publishedAt: res.generatedAt,
								precision: "second"
							}),
							res.inputTokens != null ? ` · 토큰 입력 ${res.inputTokens.toLocaleString("ko-KR")} / 출력 ${res.outputTokens?.toLocaleString("ko-KR") ?? "—"}` : "",
							res.rejected ? ` · 근거 없는 문장 ${res.rejected}개 제외` : ""
						]
					})
				]
			})
		]
	});
}
/** F9.4 optional EN→KO headline translation (labelled 기계 번역). */
function AiTranslateButton({ items, onResult }) {
	const status = useAiStatus();
	const en = items.filter((i) => i.lang === "en").slice(0, 30);
	const [err, setErr] = (0, import_react.useState)(null);
	const run = useMutation({
		mutationFn: () => translateAiHeadlines({ data: { items: en.map((i) => ({
			id: i.id,
			title: i.title
		})) } }),
		onSuccess: (r) => r.ok ? (onResult(r.translations), setErr(null)) : setErr(r.error)
	});
	if (!status.data?.enabled || !en.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "inline-flex items-center gap-1",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => run.mutate(),
			disabled: run.isPending,
			className: "inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-semibold hover:bg-muted disabled:opacity-50",
			"data-testid": "ai-translate-button",
			children: [
				run.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Languages, { className: "size-3" }),
				" 영문 제목 번역 (",
				MT_LABEL,
				")"
			]
		}), err && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-[10px] text-price-down",
			children: err
		})]
	});
}
//#endregion
export { AiTranslateButton as n, feedToAiItems as r, AiBriefingPanel as t };
