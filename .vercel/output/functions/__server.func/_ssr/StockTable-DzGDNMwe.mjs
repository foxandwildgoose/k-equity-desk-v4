import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { c as isEtfTicker } from "./universe-BLkYDatc.mjs";
import { Dt as ArrowUpDown, Tt as ArrowUp, kt as ArrowDown } from "../_libs/lucide-react.mjs";
import { Lt as usePriceColors, Pt as cn, St as formatVolume, _t as formatMarketCap, m as PriceValue, p as PriceChange } from "./router-B1V8nj-n.mjs";
import { t as Badge } from "./badge-CgqpWL27.mjs";
import { t as WatchButton } from "./WatchButton-BIeRlFFv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/StockTable-DzGDNMwe.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Sparkline({ data, changePct, width = 72, height = 28, className, label }) {
	const colors = usePriceColors();
	const up = (changePct ?? data[data.length - 1] - data[0]) >= 0;
	const path = (0, import_react.useMemo)(() => {
		if (data.length < 2) return "";
		const min = Math.min(...data);
		const range = Math.max(...data) - min || 1;
		const pad = 2;
		const w = width - 4;
		const h = height - 4;
		return data.map((v, i) => {
			const x = pad + i / (data.length - 1) * w;
			const y = pad + h - (v - min) / range * h;
			return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
		}).join(" ");
	}, [
		data,
		width,
		height
	]);
	const stroke = up ? "var(--price-up)" : "var(--price-down)";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width,
		height,
		viewBox: `0 0 ${width} ${height}`,
		className: cn("shrink-0", up ? colors.up : colors.down, className),
		role: "img",
		"aria-label": label ?? `가격 추이 ${data.length}개 점${changePct != null ? `, 등락 ${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` : ""}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: label ?? `가격 추이 (${data.length}개 점)` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: path,
			fill: "none",
			stroke: "currentColor",
			strokeWidth: 1.5,
			strokeLinecap: "round",
			strokeLinejoin: "round",
			style: { stroke }
		})]
	});
}
function SortIcon({ active, dir }) {
	if (!active) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpDown, { className: "size-3 opacity-40" });
	return dir === "asc" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "size-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "size-3" });
}
function StockTable({ stocks, compact = false }) {
	const [sortKey, setSortKey] = (0, import_react.useState)("changePct");
	const [sortDir, setSortDir] = (0, import_react.useState)("desc");
	const sorted = (0, import_react.useMemo)(() => {
		const list = [...stocks];
		list.sort((a, b) => {
			let cmp = 0;
			switch (sortKey) {
				case "name":
					cmp = a.nameKo.localeCompare(b.nameKo, "ko");
					break;
				case "price":
					cmp = a.price - b.price;
					break;
				case "changePct":
					cmp = a.changePct - b.changePct;
					break;
				case "volume":
					cmp = a.volume - b.volume;
					break;
				case "marketCap": cmp = a.marketCap - b.marketCap;
			}
			return sortDir === "asc" ? cmp : -cmp;
		});
		return list;
	}, [
		stocks,
		sortKey,
		sortDir
	]);
	function toggleSort(key) {
		if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
		else {
			setSortKey(key);
			setSortDir(key === "name" ? "asc" : "desc");
		}
	}
	const th = "px-2 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "desk-card overflow-x-auto scroll-thin",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "desk-table min-w-[640px]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
				className: "bg-muted/40",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-b border-border",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: cn(th, "w-8 pl-2") }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: th,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "inline-flex items-center gap-1 hover:text-foreground",
								onClick: () => toggleSort("name"),
								children: ["종목 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortIcon, {
									active: sortKey === "name",
									dir: sortDir
								})]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: cn(th, "text-right"),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "inline-flex items-center gap-1 hover:text-foreground",
								onClick: () => toggleSort("price"),
								children: ["현재가 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortIcon, {
									active: sortKey === "price",
									dir: sortDir
								})]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: cn(th, "text-right"),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "inline-flex items-center gap-1 hover:text-foreground",
								onClick: () => toggleSort("changePct"),
								children: ["등락 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortIcon, {
									active: sortKey === "changePct",
									dir: sortDir
								})]
							})
						}),
						!compact && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: cn(th, "hidden md:table-cell text-center"),
								children: "추이"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: cn(th, "text-right hidden lg:table-cell"),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "inline-flex items-center gap-1 hover:text-foreground",
									onClick: () => toggleSort("volume"),
									children: [
										"거래량",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortIcon, {
											active: sortKey === "volume",
											dir: sortDir
										})
									]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: cn(th, "text-right hidden lg:table-cell"),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "inline-flex items-center gap-1 hover:text-foreground",
									onClick: () => toggleSort("marketCap"),
									children: [
										"시총",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortIcon, {
											active: sortKey === "marketCap",
											dir: sortDir
										})
									]
								})
							})
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: cn(th, "text-right pr-3"),
							children: "시장"
						})
					]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: sorted.map((st) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border/70 last:border-0 hover:bg-muted/30 transition-colors",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "pl-1 py-1.5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WatchButton, { code: st.code })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-2 py-1.5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SecurityLink, {
							code: st.code,
							nameKo: st.nameKo,
							className: "group flex flex-col min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium text-foreground group-hover:underline truncate",
								children: st.nameKo
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[11px] text-muted-foreground tabular",
								children: [
									st.code,
									" · ",
									st.nameEn
								]
							})]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-2 py-1.5 text-right",
						children: st.price > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriceValue, {
							value: st.price,
							changePct: st.changePct,
							size: "sm"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted-foreground",
							children: "—"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-2 py-1.5 text-right",
						children: st.price > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriceChange, {
							change: st.change,
							changePct: st.changePct
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted-foreground",
							children: "—"
						})
					}),
					!compact && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-1.5 hidden md:table-cell",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex justify-center",
								children: st.sparkline.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkline, {
									data: st.sparkline,
									changePct: st.changePct,
									label: `${st.nameKo} 최근 ${st.sparkline.length}개 시세 추이 (네이버 시세)`
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-muted-foreground",
									children: "—"
								})
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-1.5 text-right text-xs tabular text-muted-foreground hidden lg:table-cell",
							children: st.volume ? formatVolume(st.volume) : "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-1.5 text-right text-xs tabular text-muted-foreground hidden lg:table-cell",
							children: st.marketCap ? formatMarketCap(st.marketCap) : "—"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-2 py-1.5 pr-3 text-right",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: "market",
							children: st.market
						})
					})
				]
			}, st.code)) })]
		})
	});
}
function SecurityLink({ code, nameKo, className, children }) {
	if (isEtfTicker(code, nameKo)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/etfs/$code",
		params: { code },
		className,
		children
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/stock/$ticker",
		params: { ticker: code },
		className,
		children
	});
}
function StockMiniRow({ stock }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SecurityLink, {
		code: stock.code,
		nameKo: stock.nameKo,
		className: "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-sm font-medium truncate",
				children: stock.nameKo
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[11px] text-muted-foreground tabular",
				children: stock.code
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "text-right shrink-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriceValue, {
				value: stock.price,
				changePct: stock.changePct,
				size: "sm"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriceChange, {
				change: stock.change,
				changePct: stock.changePct,
				size: "sm"
			})]
		})]
	});
}
//#endregion
export { StockTable as n, StockMiniRow as t };
