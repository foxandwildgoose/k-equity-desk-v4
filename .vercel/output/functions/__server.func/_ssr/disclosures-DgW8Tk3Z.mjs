import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { r as useQuery } from "../_libs/tanstack__react-query.mjs";
import { C as RefreshCw, T as Radio, at as ExternalLink, q as Landmark, s as TriangleAlert, vt as Building2, z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { Et as getKrxDisclosureDesk, Pt as cn } from "./router-B1V8nj-n.mjs";
import { t as Badge } from "./badge-CgqpWL27.mjs";
import { t as DisclosureList } from "./DisclosureViewer-BW2Oocm6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/disclosures-DgW8Tk3Z.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function DisclosuresPage() {
	const [tab, setTab] = (0, import_react.useState)("all");
	const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useQuery({
		queryKey: ["krx-disclosure-desk"],
		queryFn: () => getKrxDisclosureDesk(),
		staleTime: 6e4,
		refetchInterval: 12e4
	});
	const kind = data?.kind;
	const dart = data?.dart ?? [];
	const koscom = data?.koscom ?? [];
	const all = data?.all ?? [];
	const list = tab === "koscom" ? koscom : tab === "dart" ? dart : tab === "kind" ? kind?.items ?? [] : all;
	const tabs = [
		{
			id: "all",
			label: "통합",
			count: all.length
		},
		{
			id: "koscom",
			label: "KRX·KOSCOM",
			count: koscom.length
		},
		{
			id: "dart",
			label: "DART",
			count: dart.length
		},
		{
			id: "kind",
			label: "KIND",
			count: kind?.items?.length ?? 0
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "desk-card desk-card-indigo p-4 md:p-5 relative overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute -right-6 -top-6 size-36 rounded-full bg-desk-indigo/20 blur-2xl" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
							className: "text-xl font-semibold tracking-tight md:text-2xl flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Landmark, { className: "size-5 text-desk-indigo" }), "KRX 공시 데스크"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted-foreground max-w-3xl",
							children: "한국 상장사 공시는 크게 세 갈래입니다. 증권사 단말도 동일 계통을 사용합니다."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 grid gap-2 sm:grid-cols-3 text-[11px]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-border bg-card/60 p-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "font-semibold flex items-center gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-3 text-desk-teal" }), " KRX · KOSCOM"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-muted-foreground mt-0.5",
										children: "시세·시장조치 공시 (가격제한폭, 투자주의 등). 네이버 공시 API가 KOSCOM 피드를 재배포."
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-border bg-card/60 p-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "font-semibold flex items-center gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Building2, { className: "size-3 text-desk-indigo" }), " DART (금감원)"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-muted-foreground mt-0.5",
										children: "사업보고서·주요사항 등 전자공시. 원문 뷰어 직결."
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-border bg-card/60 p-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "font-semibold flex items-center gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Landmark, { className: "size-3 text-desk-gold" }), " KIND (거래소)"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-muted-foreground mt-0.5",
										children: "한국거래소 상장공시 포털. 금일공시·공정공시 허브."
									})]
								})
							]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-1 rounded-lg bg-muted p-1",
					children: tabs.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setTab(t.id),
						className: cn("rounded-md px-2.5 py-1.5 text-[11px] font-medium", tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
						children: [t.label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-1 tabular text-muted-foreground",
							children: t.count
						})]
					}, t.id))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-[11px] text-muted-foreground",
					children: [dataUpdatedAt > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["갱신 ", new Date(dataUpdatedAt).toLocaleTimeString("ko-KR")] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => refetch(),
						className: "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: cn("size-3", isFetching && "animate-spin") }), "새로고침"]
					})]
				})]
			}),
			kind && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("rounded-lg border px-3 py-2 text-[12px] flex items-start gap-2", kind.available ? "border-desk-teal/40 bg-desk-teal/10" : "border-desk-copper/40 bg-desk-copper/10"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-3.5 shrink-0 mt-0.5" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "font-medium",
							children: ["KIND 상태: ", kind.available ? "연결됨" : "대체 모드"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted-foreground mt-0.5",
							children: kind.message
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: kind.portalUrl,
						target: "_blank",
						rel: "noopener noreferrer",
						className: "shrink-0 inline-flex items-center gap-1 text-primary hover:underline",
						children: ["KIND 열기 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3" })]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2 text-[11px]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
						className: "chip-teal border-0",
						children: ["KRX·KOSCOM ", koscom.length]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
						className: "chip-indigo border-0",
						children: ["DART ", dart.length]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
						className: "chip-gold border-0",
						children: ["KIND ", kind?.items?.length ?? 0]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: "https://dart.fss.or.kr/",
						target: "_blank",
						rel: "noopener noreferrer",
						className: "text-primary hover:underline inline-flex items-center gap-0.5",
						children: ["DART 포털 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "text-muted-foreground hover:text-foreground",
						children: "← 대시보드"
					})
				]
			}),
			isLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 text-sm text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), " KRX·DART 공시 수집 중…"]
			}),
			isError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-price-down",
				children: "공시 데스크 조회 실패"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DisclosureList, {
				items: list.map((d) => ({
					id: d.id,
					title: d.title,
					datetime: d.datetime,
					author: d.author,
					code: d.code ?? "",
					nameKo: d.nameKo,
					dartUrl: d.dartUrl,
					dartSearchUrl: d.dartSearchUrl,
					canLoadBody: d.canLoadBody,
					source: d.source,
					sourceLabel: d.sourceLabel,
					rcpNo: d.rcpNo,
					market: d.market
				})),
				title: tab === "koscom" ? "KRX·KOSCOM 시장 공시" : tab === "dart" ? "DART 최근 전자공시" : tab === "kind" ? "KIND 금일 공시" : "통합 공시 피드",
				subtitle: tab === "koscom" ? "커버리지 종목 기준 KRX/KOSCOM 시세·시장조치 공시" : tab === "dart" ? "금융감독원 DART 메인 최근공시 (유가·코스닥 포함)" : tab === "kind" ? "한국거래소 KIND 금일공시 (가용 시)" : "KOSCOM + DART + KIND 병합 · 최신순",
				showStockLink: true
			})
		]
	});
}
//#endregion
export { DisclosuresPage as component };
