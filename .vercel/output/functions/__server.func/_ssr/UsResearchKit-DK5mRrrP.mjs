import { o as __toESM } from "../_runtime.mjs";
import { t as PUBLIC_RESEARCH } from "./registry-BWVqhaYN.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as originalUrlForNote } from "./us-street-Dx2s8JR4.mjs";
import { J as Info, st as Download } from "../_libs/lucide-react.mjs";
import { Lt as usePriceColors, Pt as cn, et as TimeStamp } from "./router-B1V8nj-n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/UsResearchKit-DK5mRrrP.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ARROW = /\s*(?:→|->|⇒)\s*/;
function splitFromTo(raw) {
	const s = (raw ?? "").trim();
	if (!s || s === "—") return [null, null];
	const parts = s.split(ARROW).map((x) => x.trim()).filter(Boolean);
	if (parts.length >= 2) return [parts[0], parts[parts.length - 1]];
	return [null, parts[0] ?? null];
}
function money(raw) {
	if (!raw) return null;
	const n = Number(raw.replace(/[$,\s]/g, ""));
	return Number.isFinite(n) && n > 0 ? n : null;
}
function classifyAction(action, ptFrom, ptTo) {
	const a = action.toLowerCase();
	if (a.includes("upgrade")) return "Upgrade";
	if (a.includes("downgrade")) return "Downgrade";
	if (a.includes("initiat") || a.includes("resumed")) return "Initiate";
	if (a.includes("target") || a.includes("price target")) return "PT change";
	if (a.includes("reiterat") || a.includes("maintain")) return ptFrom != null && ptTo != null && ptFrom !== ptTo ? "PT change" : "Reiterate";
	return "Other";
}
function toStreetMove(note, articleUrl = null) {
	const [rFrom, rTo] = splitFromTo(note.rating);
	const [pFrom, pTo] = splitFromTo(note.target);
	const ptFrom = money(pFrom);
	const ptTo = money(pTo);
	return {
		id: note.id,
		date: note.date,
		publishedAt: note.publishedAt,
		precision: note.precision,
		ticker: note.symbol,
		broker: note.broker,
		action: classifyAction(note.action, ptFrom, ptTo),
		ratingFrom: rFrom,
		ratingTo: rTo,
		ptFrom,
		ptTo,
		ptDeltaPct: ptFrom != null && ptTo != null ? Math.round((ptTo - ptFrom) / ptFrom * 1e3) / 10 : null,
		tableUrl: note.pageUrl,
		articleUrl
	};
}
function csvCell(v) {
	const s = v == null ? "" : String(v);
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s;
}
var STREET_CSV_HEADER = [
	"date",
	"ticker",
	"broker",
	"action",
	"rating_from",
	"rating_to",
	"pt_from",
	"pt_to",
	"pt_delta_pct",
	"source_table",
	"source_article"
];
/** CSV of exactly the rows given (the visible, filtered rows). */
function streetMovesCsv(rows) {
	const lines = [STREET_CSV_HEADER.join(",")];
	for (const r of rows) lines.push([
		r.date,
		r.ticker,
		r.broker,
		r.action,
		r.ratingFrom,
		r.ratingTo,
		r.ptFrom,
		r.ptTo,
		r.ptDeltaPct,
		r.tableUrl,
		r.articleUrl
	].map(csvCell).join(","));
	return `${lines.join("\n")}\n`;
}
/** `ked-street-moves-YYYYMMDD-HHmm.csv` style names (symbol/timestamp in name). */
function exportFileName(prefix, now = /* @__PURE__ */ new Date(), ext = "csv") {
	const p = (n) => String(n).padStart(2, "0");
	const kst = new Date(now.getTime() + 324e5);
	return `${prefix}-${kst.getUTCFullYear()}${p(kst.getUTCMonth() + 1)}${p(kst.getUTCDate())}-${p(kst.getUTCHours())}${p(kst.getUTCMinutes())}.${ext}`;
}
/** F4.1 scope banner — exact Korean text. */
var US_RESEARCH_SCOPE_TEXT = "미국 투자은행 리포트 PDF는 고객 전용으로 공개되지 않습니다. 이 화면은 공식 문서(SEC·연준·BEA·BLS), 공개 리서치, 공개된 등급 변경과 관련 기사만 원문으로 연결합니다.";
function UsScopeBanner() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-start gap-2 rounded-lg border border-desk-gold/40 bg-desk-gold/10 px-3 py-2 text-[12px] leading-relaxed",
		"data-testid": "us-scope-banner",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
			className: "mt-0.5 size-4 shrink-0 text-desk-gold",
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: US_RESEARCH_SCOPE_TEXT })]
	});
}
var TIER_STYLE = {
	OFFICIAL: {
		label: "OFFICIAL",
		cls: "chip-teal",
		title: "공식 문서: SEC·연준·BEA·BLS"
	},
	PUBLIC_RESEARCH: {
		label: "PUBLIC",
		cls: "chip-indigo",
		title: "로그인 없이 공개된 기관 리서치"
	},
	STREET: {
		label: "STREET",
		cls: "chip-gold",
		title: "공개된 등급·목표가 (Finviz·Nasdaq)"
	},
	NEWS: {
		label: "NEWS",
		cls: "chip-blue",
		title: "등급 변경 관련 기사"
	}
};
function OriginTierBadge({ tier }) {
	const t = TIER_STYLE[tier];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn(t.cls, "text-[9px] tracking-wide"),
		title: t.title,
		children: t.label
	});
}
/** PUBLIC_RESEARCH tier: shows only entries verified public without login (none yet). */
function PublicResearchNote() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-dashed border-border p-3 text-[11px] text-muted-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-1 flex items-center gap-1.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OriginTierBadge, { tier: "PUBLIC_RESEARCH" }), " 공개 리서치"]
		}), PUBLIC_RESEARCH.length === 0 ? "로그인 없이 공개됨을 검증한 기관 리서치 소스가 아직 없습니다(오프라인 빌드). 검증 후 레지스트리에 추가됩니다." : PUBLIC_RESEARCH.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
			href: p.url,
			target: "_blank",
			rel: "noopener noreferrer",
			className: "mr-3 text-primary hover:underline",
			children: p.name
		}, p.id))]
	});
}
var ACTIONS = [
	"Upgrade",
	"Downgrade",
	"Initiate",
	"Reiterate",
	"PT change",
	"Other"
];
var PERIODS = [
	{
		id: "7",
		label: "7일"
	},
	{
		id: "30",
		label: "30일"
	},
	{
		id: "90",
		label: "90일"
	},
	{
		id: "all",
		label: "전체"
	}
];
function downloadText(name, text, type = "text/csv;charset=utf-8") {
	const blob = new Blob(["﻿", text], { type });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 2e3);
}
/**
* F4.4 Street Moves: date, ticker, broker, action, rating from→to, PT from→to
* (+Δ% only when both are in the row), source links; filters for ticker,
* broker, action, 기간; sticky header; CSV of the visible rows.
*/
function StreetMovesTable({ pack, lockedTicker }) {
	const colors = usePriceColors();
	const [ticker, setTicker] = (0, import_react.useState)(lockedTicker ?? "all");
	const [broker, setBroker] = (0, import_react.useState)("all");
	const [action, setAction] = (0, import_react.useState)("all");
	const [period, setPeriod] = (0, import_react.useState)("30");
	const moves = (0, import_react.useMemo)(() => (pack?.notes ?? []).map((n) => toStreetMove(n, originalUrlForNote(n, pack?.headlines ?? []).articleUrl)), [pack]);
	const tickers = (0, import_react.useMemo)(() => [...new Set(moves.map((m) => m.ticker))].sort(), [moves]);
	const brokers = (0, import_react.useMemo)(() => [...new Set(moves.map((m) => m.broker))].sort(), [moves]);
	const visible = (0, import_react.useMemo)(() => {
		const cutoff = period === "all" ? null : Date.now() - Number(period) * 864e5;
		return moves.filter((m) => {
			if (ticker !== "all" && m.ticker !== ticker) return false;
			if (broker !== "all" && m.broker !== broker) return false;
			if (action !== "all" && m.action !== action) return false;
			if (cutoff != null) {
				const t = m.publishedAt ? Date.parse(m.publishedAt) : NaN;
				if (Number.isNaN(t) || t < cutoff) return false;
			}
			return true;
		});
	}, [
		moves,
		ticker,
		broker,
		action,
		period
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card",
		"aria-label": "Street Moves",
		"data-testid": "street-moves",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-2 border-b border-border px-3 py-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
					className: "mr-auto inline-flex items-center gap-1.5 text-[12px] font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OriginTierBadge, { tier: "STREET" }), " Street Moves · 공개 등급·목표가 변경 (최신순)"]
				}),
				!lockedTicker && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					value: ticker,
					onChange: (e) => setTicker(e.target.value),
					className: "h-9 rounded-md border border-border bg-background px-2 text-xs",
					"aria-label": "티커",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "all",
						children: "전체 티커"
					}), tickers.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: t,
						children: t
					}, t))]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					value: broker,
					onChange: (e) => setBroker(e.target.value),
					className: "h-9 max-w-40 rounded-md border border-border bg-background px-2 text-xs",
					"aria-label": "증권사",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "all",
						children: "전체 증권사"
					}), brokers.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: b,
						children: b
					}, b))]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					value: action,
					onChange: (e) => setAction(e.target.value),
					className: "h-9 rounded-md border border-border bg-background px-2 text-xs",
					"aria-label": "액션",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "all",
						children: "전체 액션"
					}), ACTIONS.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: a,
						children: a
					}, a))]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
					value: period,
					onChange: (e) => setPeriod(e.target.value),
					className: "h-9 rounded-md border border-border bg-background px-2 text-xs",
					"aria-label": "기간",
					children: PERIODS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: p.id,
						children: p.label
					}, p.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => downloadText(exportFileName(`ked-street-moves${lockedTicker ? `-${lockedTicker}` : ""}`), streetMovesCsv(visible)),
					disabled: !visible.length,
					className: "inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-semibold hover:bg-muted/50 disabled:opacity-40",
					"data-testid": "street-csv",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" }), " CSV"]
				})
			]
		}), visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-3 py-6 text-center text-[11px] text-muted-foreground",
			children: moves.length ? "필터에 맞는 등급 변경이 없습니다." : "공개 등급 변경을 받지 못했습니다(소스 미검증일 수 있음). 채워 넣지 않습니다."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "max-h-[420px] overflow-auto",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full min-w-[640px] text-[11px]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "sticky top-0 z-[1] bg-muted/95 text-muted-foreground backdrop-blur",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-1.5 text-left",
							children: "일자"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-1.5 text-left",
							children: "티커"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-1.5 text-left",
							children: "증권사"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-1.5 text-left",
							children: "액션"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-1.5 text-left",
							children: "등급"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-1.5 text-right",
							children: "목표가"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-1.5 text-right",
							children: "Δ%"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-1.5 text-left",
							children: "원문"
						})
					] })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
					className: "divide-y divide-border",
					"data-street-rows": true,
					children: visible.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						"data-published": m.publishedAt ?? "",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "whitespace-nowrap px-2 py-1.5 text-muted-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
									publishedAt: m.publishedAt,
									precision: m.precision,
									tz: "ET",
									withEt: true
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5 font-semibold",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/us/$symbol",
									params: { symbol: m.ticker },
									className: "hover:underline",
									children: m.ticker
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5",
								children: m.broker
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5",
								children: m.action
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5",
								children: m.ratingFrom ? `${m.ratingFrom} → ${m.ratingTo ?? "—"}` : m.ratingTo ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "whitespace-nowrap px-2 py-1.5 text-right tabular",
								children: m.ptFrom != null && m.ptTo != null ? `$${m.ptFrom} → $${m.ptTo}` : m.ptTo != null ? `$${m.ptTo}` : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: cn("px-2 py-1.5 text-right tabular", m.ptDeltaPct == null ? "text-muted-foreground" : m.ptDeltaPct > 0 ? colors.up : colors.down),
								children: m.ptDeltaPct == null ? "—" : `${m.ptDeltaPct > 0 ? "+" : ""}${m.ptDeltaPct.toFixed(1)}%`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "whitespace-nowrap px-2 py-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: m.tableUrl,
									target: "_blank",
									rel: "noopener noreferrer",
									className: "text-primary hover:underline",
									children: "Finviz"
								}), m.articleUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: m.articleUrl,
									target: "_blank",
									rel: "noopener noreferrer",
									className: "ml-2 text-primary hover:underline",
									children: "기사"
								})]
							})
						]
					}, m.id))
				})]
			})
		})]
	});
}
//#endregion
export { toStreetMove as a, UsScopeBanner as i, PublicResearchNote as n, StreetMovesTable as r, OriginTierBadge as t };
