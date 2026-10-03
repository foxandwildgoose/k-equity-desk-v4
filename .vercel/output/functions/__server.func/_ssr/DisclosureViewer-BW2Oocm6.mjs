import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { c as isEtfTicker, d as normalizeKrTicker, s as isDigitTicker } from "./universe-BLkYDatc.mjs";
import { n as formatAbsoluteTime, s as parseSourceTime } from "./time-By5ScNNo.mjs";
import { r as useQuery } from "../_libs/tanstack__react-query.mjs";
import { $ as FileText, at as ExternalLink, z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { Tt as getDisclosureDetail, at as SheetHeader, it as SheetDescription, nt as Sheet, ot as SheetTitle, rt as SheetContent, st as Button } from "./router-B1V8nj-n.mjs";
import { t as Badge } from "./badge-CgqpWL27.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/DisclosureViewer-BW2Oocm6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function fmtTime(raw) {
	const t = parseSourceTime(raw, { zone: "Asia/Seoul" });
	return formatAbsoluteTime({
		publishedAt: t.iso,
		precision: t.precision
	});
}
function sourceBadgeClass(source) {
	switch (source) {
		case "kind-krx": return "chip-gold border-0";
		case "dart-fss": return "chip-indigo border-0";
		case "krx-koscom": return "chip-teal border-0";
		default: return "";
	}
}
function DisclosureList({ items, title = "공시", subtitle, showStockLink = false }) {
	const [active, setActive] = (0, import_react.useState)(null);
	const canBody = Boolean(active?.canLoadBody && active?.code && /^\d+$/.test(String(active.id)));
	const detailQ = useQuery({
		queryKey: [
			"disclosure-detail",
			active?.code,
			active?.id
		],
		queryFn: () => getDisclosureDetail({ data: {
			code: normalizeKrTicker(String(active.code)),
			disclosureId: String(active.id)
		} }),
		enabled: !!active && canBody && isDigitTicker(String(active?.code ?? "")),
		staleTime: 3e5
	});
	const dartOriginal = detailQ.data?.dartUrl || active?.dartUrl || void 0;
	const dartSearch = detailQ.data?.dartSearchUrl || active?.dartSearchUrl || "https://dart.fss.or.kr/";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "desk-card desk-card-navy overflow-hidden",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "border-b border-border px-3 py-2.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-sm font-semibold",
				children: title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-muted-foreground",
				children: subtitle ?? "KRX·KOSCOM 시세공시 / DART 전자공시 · 클릭 시 본문 또는 원문 뷰어"
			})]
		}), items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "px-3 py-8 text-center text-xs text-muted-foreground",
			children: "최근 공시 없음"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "divide-y divide-border max-h-[560px] overflow-y-auto scroll-thin",
			children: items.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setActive(d),
				className: "flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
					variant: d.source ? "secondary" : "disclosure",
					className: `mt-0.5 gap-1 shrink-0 text-[10px] ${sourceBadgeClass(d.source)}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3" }), d.sourceLabel ?? "공시"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm font-medium leading-snug",
						children: d.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground",
						children: [
							showStockLink && d.nameKo && d.code && (isEtfTicker(d.code, d.nameKo) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/etfs/$code",
								params: { code: normalizeKrTicker(d.code) },
								className: "font-medium text-foreground hover:underline",
								onClick: (e) => e.stopPropagation(),
								children: d.nameKo
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/stock/$ticker",
								params: { ticker: normalizeKrTicker(d.code) },
								className: "font-medium text-foreground hover:underline",
								onClick: (e) => e.stopPropagation(),
								children: d.nameKo
							})),
							d.market && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: d.market }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: d.author }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular",
								children: fmtTime(d.datetime)
							}),
							d.rcpNo && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "tabular text-desk-indigo",
								children: ["rcp ", d.rcpNo]
							})
						]
					})]
				})]
			}) }, `${d.source ?? "x"}-${d.code ?? ""}-${d.id}-${i}`))
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!active,
		onOpenChange: (o) => !o && setActive(null),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, {
			side: "right",
			className: "w-full max-w-2xl overflow-y-auto scroll-thin p-0",
			children: active && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, {
				className: "sticky top-0 z-10 bg-card border-b border-border p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, {
						className: "pr-6 text-base leading-snug",
						children: detailQ.data?.title || active.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetDescription, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium text-foreground",
									children: active.nameKo || active.code
								}),
								active.sourceLabel && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									className: sourceBadgeClass(active.source),
									children: active.sourceLabel
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular",
									children: fmtTime(active.datetime)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: active.author })
							]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2 pt-2",
						children: [
							(dartOriginal || active.rcpNo) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								asChild: true,
								size: "sm",
								variant: "default",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: dartOriginal || `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${active.rcpNo}`,
									target: "_blank",
									rel: "noopener noreferrer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" }), "DART 원문"]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								asChild: true,
								size: "sm",
								variant: "outline",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: dartSearch,
									target: "_blank",
									rel: "noopener noreferrer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" }), "DART 검색"]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								asChild: true,
								size: "sm",
								variant: "outline",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: "https://kind.krx.co.kr/disclosure/todaydisclosure.do",
									target: "_blank",
									rel: "noopener noreferrer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" }), "KIND(KRX)"]
								})
							})
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "p-4 space-y-3",
				children: [
					canBody && detailQ.isLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-sm text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), " 본문 로딩…"]
					}),
					canBody && detailQ.data?.text && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
						className: "whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/90",
						children: detailQ.data.text
					}),
					(!canBody || !detailQ.isLoading && !detailQ.data?.text) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: active.source === "dart-fss" ? "DART 전자공시 원문은 금융감독원 뷰어에서 확인하세요." : active.source === "kind-krx" ? "KIND 원문은 한국거래소 KIND 포털에서 확인하세요." : "본문을 인앱으로 불러올 수 없는 항목입니다. 원문 링크를 이용하세요." }), (dartOriginal || active.rcpNo) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							className: "text-primary underline",
							href: dartOriginal || `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${active.rcpNo}`,
							target: "_blank",
							rel: "noopener noreferrer",
							children: "DART 뷰어 열기 →"
						})]
					})
				]
			})] })
		})
	})] });
}
//#endregion
export { DisclosureList as t };
