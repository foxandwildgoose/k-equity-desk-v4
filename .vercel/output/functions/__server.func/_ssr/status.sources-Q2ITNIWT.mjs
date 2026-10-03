import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { a as useQueryClient, n as useMutation, r as useQuery } from "../_libs/tanstack__react-query.mjs";
import { C as RefreshCw, z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { Ft as BLOOMBERG_SOURCE_IDS, It as useAppStore, Pt as cn, et as TimeStamp, mt as retrySource, pt as getSourceHealth, v as Switch } from "./router-B1V8nj-n.mjs";
import { t as PageDisclaimer } from "./PageDisclaimer-Dk4wCTj5.mjs";
import { t as PageHeader } from "./PageHeader-aQOrmONW.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/status.sources-Q2ITNIWT.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var GROUP_LABEL = {
	"kr-news": "한국 뉴스",
	"us-news": "미국 뉴스",
	"kr-research": "한국 리서치",
	"us-research": "미국 리서치",
	etf: "ETF",
	robotics: "로봇",
	policy: "정책",
	"market-data": "시세·기초 데이터",
	disclosure: "공시"
};
var REGISTRY_LABEL = {
	verified: "검증됨",
	unverified: "미검증",
	candidate: "후보(검증 전)",
	disabled: "폐지·비활성"
};
function statusChip(r, userOff) {
	if (userOff) return {
		label: "사용자 끔",
		tone: "muted"
	};
	if (!r.runnable) return {
		label: r.runnableReason ?? "비활성",
		tone: "muted"
	};
	if (r.health.circuit === "open") return {
		label: "차단(circuit)",
		tone: "bad"
	};
	if (r.health.lastSuccessAt && r.health.consecutiveFailures === 0) return r.health.itemCount === 0 ? {
		label: "정상 · 0건",
		tone: "warn"
	} : {
		label: "정상",
		tone: "ok"
	};
	if (r.health.consecutiveFailures > 0) return {
		label: `실패 ${r.health.consecutiveFailures}회`,
		tone: "bad"
	};
	if (!r.hasAdapter) return {
		label: "기존 모듈 경로",
		tone: "muted"
	};
	return {
		label: "미시도",
		tone: "muted"
	};
}
function SourceStatusPage() {
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["source-health"],
		queryFn: () => getSourceHealth(),
		refetchInterval: 3e4,
		staleTime: 1e4
	});
	const disabled = useAppStore((s) => s.newsPrefs.disabledSources);
	const bloombergEnabled = useAppStore((s) => s.newsPrefs.bloombergEnabled);
	const toggleSource = useAppStore((s) => s.toggleSource);
	const setNewsPrefs = useAppStore((s) => s.setNewsPrefs);
	const [pending, setPending] = (0, import_react.useState)(null);
	const retry = useMutation({
		mutationFn: (id) => retrySource({ data: { id } }),
		onMutate: (id) => setPending(id),
		onSettled: () => {
			setPending(null);
			qc.invalidateQueries({ queryKey: ["source-health"] });
		}
	});
	const rows = q.data?.rows ?? [];
	const groups = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const r of rows) {
			if (!map.has(r.group)) map.set(r.group, []);
			map.get(r.group).push(r);
		}
		return [...map.entries()];
	}, [rows]);
	const allUnverified = rows.length > 0 && rows.every((r) => r.registryStatus !== "verified");
	const userOff = new Set(disabled);
	if (!bloombergEnabled) for (const id of BLOOMBERG_SOURCE_IDS) userOff.add(id);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				kicker: "Source health · 소스 상태",
				title: "소스 상태",
				lead: "뉴스·리서치·공시·시세 소스별 최근 시도, 성공, HTTP 상태, 지연, 건수, 최신 게시 시각, 연속 실패와 차단(circuit) 상태입니다. 서버 인스턴스별 기록이며 배포 환경에서는 인스턴스마다 다를 수 있습니다.",
				aside: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[11px] text-muted-foreground",
					children: q.data ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["갱신 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
						publishedAt: q.data.generatedAt,
						precision: "second"
					})] }) : "불러오는 중…"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageDisclaimer, {}),
			allUnverified && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed",
				"data-testid": "unverified-banner",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "소스 미검증" }),
					" — 이 빌드는 외부 네트워크가 차단된 환경에서 만들어져 레지스트리의 모든 소스가 아직 실제 응답으로 검증되지 않았습니다. 일반 인터넷이 되는 환경에서 ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: "npm run verify:sources" }),
					"를 실행하면",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: " docs/upgrade/SOURCES_STATUS.md" }),
					"가 갱신됩니다. 응답이 없는 패널은 비어 있는 대신 이유를 표시합니다."
				]
			}),
			q.data && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2 text-[11px]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EnvChip, {
						ok: Boolean(q.data.env.secUserAgent),
						label: q.data.env.secUserAgent ? "SEC UA 설정됨" : "SEC UA 미설정"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EnvChip, {
						ok: Boolean(q.data.env.kis),
						label: q.data.env.kis ? "KIS 키 설정됨" : "KIS 키 없음 (네이버 스냅샷)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EnvChip, {
						ok: Boolean(q.data.env.finnhub),
						label: q.data.env.finnhub ? "Finnhub 키 설정됨" : "Finnhub 없음"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EnvChip, {
						ok: Boolean(q.data.env.bloomberg),
						label: q.data.env.bloomberg ? "Bloomberg 서버 스위치 켜짐" : "NEWS_BLOOMBERG_ENABLED=false"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: bloombergEnabled,
							onCheckedChange: (v) => setNewsPrefs({ bloombergEnabled: v }),
							"aria-label": "Bloomberg 표시"
						}), "Bloomberg 표시 (앱 내 토글)"]
					})
				]
			}),
			q.isError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-price-down",
				children: "상태를 불러오지 못했습니다."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-5",
				children: groups.map(([group, list]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "rounded-xl border border-border bg-card",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "border-b border-border px-3 py-2 text-sm font-semibold",
						children: GROUP_LABEL[group] ?? group
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "divide-y divide-border",
						children: list.map((r) => {
							const off = userOff.has(r.id);
							const chip = statusChip(r, off);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "grid gap-2 px-3 py-2.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto]",
								"data-source-row": r.id,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-wrap items-center gap-1.5",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[13px] font-semibold",
														children: r.name
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", chip.tone === "ok" && "bg-emerald-500/15 text-emerald-500", chip.tone === "warn" && "bg-amber-500/15 text-amber-500", chip.tone === "bad" && "bg-price-up/15 text-price-up", chip.tone === "muted" && "bg-muted text-muted-foreground"),
														children: chip.label
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "rounded border border-border px-1 text-[10px] text-muted-foreground",
														children: REGISTRY_LABEL[r.registryStatus] ?? r.registryStatus
													}),
													r.paywalled && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] font-semibold text-desk-gold",
														children: "유료"
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mt-0.5 truncate font-mono text-[10px] text-muted-foreground",
												title: r.url ?? "",
												children: [
													r.id,
													" · ",
													r.format.toUpperCase(),
													" · T",
													r.tier
												]
											}),
											Object.values(r.health.notes).map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "mt-0.5 text-[10px] font-medium text-amber-500",
												children: n
											}, n))
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
										className: "grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10.5px] sm:grid-cols-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
												k: "최근 시도",
												v: r.health.lastAttemptAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
													publishedAt: r.health.lastAttemptAt,
													precision: "second"
												}) : "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
												k: "최근 성공",
												v: r.health.lastSuccessAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
													publishedAt: r.health.lastSuccessAt,
													precision: "second"
												}) : "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
												k: "HTTP · 지연",
												v: `${r.health.httpStatus ?? "—"} · ${r.health.latencyMs != null ? `${r.health.latencyMs}ms` : "—"}`
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
												k: "건수 · 경로",
												v: `${r.health.itemCount ?? "—"} · ${r.health.adapterPath ?? "—"}`
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
												k: "최신 게시",
												v: r.health.newestPublishedAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
													publishedAt: r.health.newestPublishedAt,
													precision: "minute"
												}) : "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
												k: "차단 해제",
												v: r.health.circuitUntil ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
													publishedAt: r.health.circuitUntil,
													precision: "second"
												}) : "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "col-span-2 min-w-0 truncate text-price-down/90",
												title: r.health.lastError ?? "",
												children: r.health.lastError ?? ""
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 md:justify-end",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "inline-flex min-h-9 items-center gap-1.5 text-[11px] text-muted-foreground",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
												checked: !off,
												onCheckedChange: (v) => {
													if (BLOOMBERG_SOURCE_IDS.includes(r.id) && v && !bloombergEnabled) setNewsPrefs({ bloombergEnabled: true });
													toggleSource(r.id, v);
												},
												"aria-label": `${r.name} 표시`
											}), "표시"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											disabled: !r.runnable || !r.hasAdapter || pending === r.id || r.health.circuit === "open",
											onClick: () => retry.mutate(r.id),
											className: "inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-semibold hover:bg-muted/50 disabled:opacity-40",
											title: r.health.circuit === "open" ? "차단 중에는 재시도하지 않습니다" : "캐시를 한 번 건너뛰고 다시 요청",
											children: [pending === r.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-3" }), "지금 재시도"]
										})]
									})
								]
							}, r.id);
						})
					})]
				}, group))
			})
		]
	});
}
function Stat({ k, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "text-[9.5px] text-muted-foreground",
			children: k
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "truncate tabular",
			children: v
		})]
	});
}
function EnvChip({ ok, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex min-h-9 items-center rounded-md border px-2 font-medium", ok ? "border-emerald-500/40 text-emerald-500" : "border-amber-500/40 text-amber-500"),
		children: label
	});
}
//#endregion
export { SourceStatusPage as component };
