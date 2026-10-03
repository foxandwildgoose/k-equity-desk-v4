import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as originalUrlForNote, r as safeExternalUrl } from "./us-street-Dx2s8JR4.mjs";
import { t as matchesSearchQuery } from "./search-match-BMQS9B1C.mjs";
import { at as ExternalLink, b as Search, z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { F as useUsStreet, Nt as Input, Pt as cn, at as SheetHeader, et as TimeStamp, it as SheetDescription, k as useStreetUniverse, nt as Sheet, ot as SheetTitle, rt as SheetContent, st as Button } from "./router-B1V8nj-n.mjs";
import { t as Badge } from "./badge-CgqpWL27.mjs";
import { t as OriginTierBadge } from "./UsResearchKit-DK5mRrrP.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/UsResearchDesk-Du-FOQ6b.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function hostOf(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "원문";
	}
}
function plain(raw) {
	if (!raw) return "";
	return raw.replace(/\u0026amp;/g, "&").replace(/\u0026quot;/g, "\"").replace(/\u0026#39;|\u0026apos;/g, "'").replace(/\u0026nbsp;/g, " ");
}
function Tone({ text }) {
	const buy = /buy|outperform|overweight|상향|매수/i.test(text);
	const sell = /sell|underperform|underweight|하향|매도/i.test(text);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold", buy && "bg-price-up/15 text-price-up", sell && "bg-price-down/15 text-price-down", !buy && !sell && "bg-amber-500/15 text-amber-400"),
		children: text
	});
}
function UsResearchDesk({ symbol, compact = false }) {
	const locked = symbol?.trim().toUpperCase() || "";
	const universe = useStreetUniverse();
	const query = useUsStreet(locked || void 0, { symbols: universe });
	const pack = query.data;
	const [ticker, setTicker] = (0, import_react.useState)(locked || "all");
	const [broker, setBroker] = (0, import_react.useState)("all");
	const [q, setQ] = (0, import_react.useState)("");
	const [active, setActive] = (0, import_react.useState)(null);
	const notes = pack?.notes ?? [];
	const headlines = pack?.headlines ?? [];
	const consensus = pack?.consensus ?? [];
	const brokers = (0, import_react.useMemo)(() => [...new Set(notes.map((note) => note.broker).filter(Boolean))].sort(), [notes]);
	const visibleNotes = (0, import_react.useMemo)(() => {
		const needle = q.trim();
		return notes.filter((note) => locked ? note.symbol === locked : ticker === "all" || note.symbol === ticker).filter((note) => broker === "all" || note.broker === broker).filter((note) => !needle || matchesSearchQuery(needle, [
			note.symbol,
			note.broker,
			note.action,
			note.rating,
			note.summary,
			note.target ?? ""
		]));
	}, [
		notes,
		locked,
		ticker,
		broker,
		q
	]);
	const visibleHeads = (0, import_react.useMemo)(() => {
		const needle = q.trim();
		return headlines.filter((item) => {
			if (locked && item.symbol !== locked) return false;
			if (!locked && ticker !== "all" && item.symbol !== ticker) return false;
			if (!needle) return true;
			return matchesSearchQuery(needle, [
				item.symbol,
				item.title,
				item.source,
				item.when
			]);
		});
	}, [
		headlines,
		locked,
		ticker,
		q
	]);
	const visibleConsensus = (0, import_react.useMemo)(() => {
		return consensus.filter((row) => {
			if (locked) return row.symbol === locked;
			return ticker === "all" || row.symbol === ticker;
		});
	}, [
		consensus,
		locked,
		ticker
	]);
	const noteLimit = compact ? 4 : 40;
	const headLimit = compact ? 3 : 16;
	const activeOriginal = active?.kind === "note" ? originalUrlForNote(active.note, headlines) : null;
	const activeHref = active?.kind === "note" ? safeExternalUrl(activeOriginal?.url) : active?.kind === "headline" ? safeExternalUrl(active.item.url) : active?.kind === "consensus" ? safeExternalUrl(active.row.pageUrl) : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] leading-relaxed text-muted-foreground",
				children: pack?.note ?? "미국 투자은행 PDF는 고객에게만 배포됩니다. 공개된 등급·목표가·기사만 요약하고, 없는 보고서는 만들지 않습니다."
			}),
			!compact && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2 rounded-lg border border-border bg-muted/15 p-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-1",
					children: [!locked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
						active: ticker === "all",
						onClick: () => setTicker("all"),
						children: "전체"
					}), (locked ? [locked] : universe).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
						active: ticker === item || locked === item,
						onClick: () => setTicker(item),
						children: item
					}, item))]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-2 sm:grid-cols-[1fr_auto]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: q,
							onChange: (event) => setQ(event.target.value),
							placeholder: "증권사·등급·종목 검색",
							className: "h-8 pl-8 text-xs"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: broker,
						onChange: (event) => setBroker(event.target.value),
						className: "h-8 rounded-md border border-border bg-background px-2 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "all",
							children: "전체 증권사"
						}), brokers.map((name) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: name,
							children: plain(name)
						}, name))]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2 text-[10px] text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					"등급 ",
					visibleNotes.length,
					" · 컨센서스 ",
					visibleConsensus.length,
					" · 기사 ",
					visibleHeads.length,
					query.isFetching && " · 수신 중"
				] }), compact && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/research",
					search: { market: "us" },
					className: "font-medium text-primary hover:underline",
					children: "미국 리서치 전체"
				})]
			}),
			query.isLoading && !pack ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-8 text-xs text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }), " 월가 공개 피드 수신 중"]
			}) : query.isError && !pack ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-lg border border-dashed border-border py-8 text-center text-xs text-price-down",
				children: "월가 피드를 받지 못했습니다. 등급을 채워 넣지 않습니다."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [
					visibleConsensus.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "space-y-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-[11px] font-semibold",
							children: "컨센서스 요약"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid gap-2 sm:grid-cols-2",
							children: (compact ? visibleConsensus.slice(0, 2) : visibleConsensus).map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "overflow-hidden rounded-lg border border-border bg-card",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setActive({
										kind: "consensus",
										row
									}),
									className: "w-full px-3 py-2.5 text-left hover:bg-muted/35",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OriginTierBadge, { tier: "STREET" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs font-semibold",
												children: row.symbol
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
												variant: "outline",
												className: "text-[10px]",
												children: "Nasdaq"
											}),
											row.mean != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "ml-auto text-[11px] font-semibold tabular",
												children: ["$", row.mean.toFixed(2)]
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 line-clamp-2 text-[12px] leading-relaxed text-foreground/90",
										children: plain(row.summary)
									})]
								}), safeExternalUrl(row.pageUrl) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "border-t border-border bg-muted/20 px-3 py-1.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
										href: safeExternalUrl(row.pageUrl),
										target: "_blank",
										rel: "noopener noreferrer",
										className: "inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline",
										children: ["Nasdaq 원문 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3" })]
									})
								})]
							}, row.symbol))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "space-y-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-[11px] font-semibold",
							children: "투자은행 · 월가 등급"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "flex flex-col gap-2",
							children: visibleNotes.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground",
								children: "이 필터에 공개된 등급 변경이 없습니다."
							}) : visibleNotes.slice(0, noteLimit).map((note) => {
								const original = originalUrlForNote(note, headlines);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "overflow-hidden rounded-lg border border-border bg-card",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setActive({
											kind: "note",
											note
										}),
										className: "w-full px-3 py-3 text-left hover:bg-muted/35",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center gap-1.5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OriginTierBadge, { tier: "STREET" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
													variant: "outline",
													className: "text-[10px]",
													children: note.symbol
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-xs font-medium",
													children: plain(note.broker)
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, { text: plain(note.actionKo) }),
												note.rating && note.rating !== "—" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, { text: plain(note.rating) }),
												note.target && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[10px] font-semibold tabular",
													children: ["TP ", note.target]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
													to: "/us/$symbol",
													params: { symbol: note.symbol },
													onClick: (event) => event.stopPropagation(),
													className: "text-[10px] text-primary hover:underline",
													children: "차트"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "ml-auto text-[10px] text-muted-foreground",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
														publishedAt: note.publishedAt,
														precision: note.precision,
														tz: "ET",
														withEt: true
													})
												})
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-2 border-l-2 border-foreground/20 pl-2.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[10px] font-semibold text-muted-foreground",
												children: "핵심요약"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "mt-0.5 line-clamp-3 text-[12px] leading-relaxed",
												children: plain(note.summary)
											})]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap gap-2 border-t border-border bg-muted/20 px-3 py-2",
										children: [
											original.articleUrl && safeExternalUrl(original.articleUrl) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
												href: safeExternalUrl(original.articleUrl),
												target: "_blank",
												rel: "noopener noreferrer",
												className: "inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline",
												children: [
													"기사 원문 · ",
													hostOf(original.articleUrl),
													" ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3" })
												]
											}) : null,
											safeExternalUrl(original.tableUrl) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
												href: safeExternalUrl(original.tableUrl),
												target: "_blank",
												rel: "noopener noreferrer",
												className: "inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline",
												children: ["등급 원문 · Finviz ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3" })]
											}) : null,
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => setActive({
													kind: "note",
													note
												}),
												className: "ml-auto inline-flex min-h-8 items-center text-xs text-muted-foreground hover:text-foreground",
												children: "상세"
											})
										]
									})]
								}, note.id);
							})
						})]
					}),
					visibleHeads.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "space-y-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-[11px] font-semibold",
							children: "기사 원문"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "flex flex-col gap-1.5",
							children: visibleHeads.slice(0, headLimit).map((item) => {
								const href = safeExternalUrl(item.url);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "rounded-lg border border-border bg-card",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setActive({
											kind: "headline",
											item
										}),
										className: "flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/35",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "mt-0.5 flex shrink-0 flex-col items-start gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OriginTierBadge, { tier: "NEWS" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
												variant: "outline",
												className: "text-[10px]",
												children: item.symbol
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "min-w-0 flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "block text-[12px] leading-snug",
												children: plain(item.title)
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "mt-0.5 block text-[10px] text-muted-foreground",
												children: [
													href ? hostOf(href) : "원문",
													" ·",
													" ",
													item.publishedAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
														publishedAt: item.publishedAt,
														precision: item.precision,
														tz: "ET",
														withEt: true
													}) : item.when
												]
											})]
										})]
									}), href ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "border-t border-border bg-muted/20 px-3 py-1.5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
											href,
											target: "_blank",
											rel: "noopener noreferrer",
											className: "inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline",
											children: [
												"원문 링크 · ",
												hostOf(href),
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3" })
											]
										})
									}) : null]
								}, item.id);
							})
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
				open: !!active,
				onOpenChange: (open) => !open && setActive(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
					side: "right",
					className: "w-full max-w-lg overflow-y-auto p-0",
					children: [
						active?.kind === "note" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, {
							className: "sticky top-0 z-10 border-b border-border bg-card",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetTitle, {
								className: "pr-6 text-base leading-snug",
								children: [
									active.note.symbol,
									" · ",
									plain(active.note.broker)
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetDescription, {
								asChild: true,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: active.note.date }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, { text: plain(active.note.actionKo) }),
										active.note.rating !== "—" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, { text: plain(active.note.rating) })
									]
								})
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-4 px-4 py-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2",
									children: [activeOriginal?.articleUrl && safeExternalUrl(activeOriginal.articleUrl) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										asChild: true,
										size: "sm",
										className: "gap-1.5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
											href: safeExternalUrl(activeOriginal.articleUrl),
											target: "_blank",
											rel: "noopener noreferrer",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" }),
												" 기사 원문 · ",
												hostOf(activeOriginal.articleUrl)
											]
										})
									}), safeExternalUrl(active.note.pageUrl) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										asChild: true,
										size: "sm",
										variant: activeOriginal?.articleUrl ? "outline" : "default",
										className: "gap-1.5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
											href: safeExternalUrl(active.note.pageUrl),
											target: "_blank",
											rel: "noopener noreferrer",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" }), " 등급 원문 · Finviz"]
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-lg border border-border bg-muted/25 p-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[10px] text-muted-foreground",
											children: "표시 등급"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-1 text-sm font-semibold",
											children: plain(active.note.rating)
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-lg border border-border bg-muted/25 p-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[10px] text-muted-foreground",
											children: "목표가"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-1 text-sm font-semibold tabular",
											children: active.note.target ?? "이 행에 없음"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-border bg-muted/20 p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[11px] font-semibold",
										children: "핵심요약"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-sm leading-relaxed",
										children: plain(active.note.summary)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[10px] leading-relaxed text-muted-foreground",
									children: "증권사 PDF 원문은 공개되어 있지 않습니다. 위 링크는 등급이 게시된 공개 페이지이거나, 제목에 해당 증권사가 들어간 기사입니다."
								})
							]
						})] }),
						active?.kind === "headline" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, {
							className: "sticky top-0 z-10 border-b border-border bg-card",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, {
								className: "pr-6 text-base leading-snug",
								children: plain(active.item.title)
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetDescription, { children: [
								active.item.symbol,
								" · ",
								active.item.when
							] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-3 px-4 py-4",
							children: [activeHref && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								asChild: true,
								size: "sm",
								className: "gap-1.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: activeHref,
									target: "_blank",
									rel: "noopener noreferrer",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" }),
										" ",
										hostOf(activeHref),
										" 원문"
									]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm leading-relaxed text-muted-foreground",
								children: "제목에 등급 변경·목표가·증권사 이름이 들어간 기사만 모았습니다. 본문은 원문 페이지에 있습니다."
							})]
						})] }),
						active?.kind === "consensus" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, {
							className: "sticky top-0 z-10 border-b border-border bg-card",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetTitle, {
								className: "pr-6 text-base",
								children: [active.row.symbol, " 컨센서스"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetDescription, { children: "Nasdaq 공개 추정치" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-4 px-4 py-4",
							children: [
								activeHref && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									asChild: true,
									size: "sm",
									className: "gap-1.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
										href: activeHref,
										target: "_blank",
										rel: "noopener noreferrer",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" }), " Nasdaq 애널리스트 원문"]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-3 gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
											label: "평균",
											value: active.row.mean == null ? "—" : `$${active.row.mean.toFixed(2)}`
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
											label: "하단",
											value: active.row.low == null ? "—" : `$${active.row.low.toFixed(2)}`
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
											label: "상단",
											value: active.row.high == null ? "—" : `$${active.row.high.toFixed(2)}`
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm leading-relaxed",
									children: plain(active.row.summary)
								})
							]
						})] })
					]
				})
			})
		]
	});
}
function Stat({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border bg-muted/25 p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[10px] text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-1 text-sm font-semibold tabular",
			children: value
		})]
	});
}
function FilterChip({ active, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: cn("min-h-8 rounded-md border px-2 py-1 text-[10px] font-medium", active ? "border-foreground/30 bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:text-foreground"),
		children
	});
}
//#endregion
export { UsResearchDesk as t };
