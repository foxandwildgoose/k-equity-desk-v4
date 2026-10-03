import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { H as notFound, v as Link, y as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { d as normalizeKrTicker, f as shouldRouteToEtf, i as getUniverseItem, o as inferSectorId, r as detectKrMarket, s as isDigitTicker } from "./universe-BLkYDatc.mjs";
import { a as newsItemToFeed, d as sortReportsNewestFirst, l as sortNewestFirst, n as dedupeById, s as reportDay } from "./mappers-DlpCqw-E.mjs";
import { r as SECTOR_BY_ID } from "./sectors-CSrSXBVT.mjs";
import { t as useInfiniteQuery } from "../_libs/tanstack__react-query.mjs";
import { $ as FileText, F as Maximize2, J as Info, T as Radio, dt as ChevronUp, ft as ChevronRight, gt as ChartLine, ht as ChartColumn, i as Users, nt as Factory, ot as Earth, pt as ChevronDown, s as TriangleAlert, t as ZoomIn, v as ShieldAlert, vt as Building2, xt as BookOpen, z as LoaderCircle } from "../_libs/lucide-react.mjs";
import { It as useAppStore, Lt as usePriceColors, O as useStockBundle, Pt as cn, St as formatVolume, Y as FeedList, _t as formatMarketCap, a as Route$3, g as DATA_LABEL, jt as getStockNews, m as PriceValue, p as PriceChange, vt as formatPct, y as useChartData, yt as formatPrice } from "./router-B1V8nj-n.mjs";
import { f as ye, u as nr } from "../_libs/lightweight-charts.mjs";
import { D as createProChart, K as lastNumber, T as computeRangePosition, at as readChartTheme, l as RangePositionStrip, r as ChartShell, v as atr } from "./tools-Cb8-otqN.mjs";
import { t as Badge } from "./badge-CgqpWL27.mjs";
import { t as DisclosureList } from "./DisclosureViewer-BW2Oocm6.mjs";
import { a as useChartChrome, i as exportRowsCsv, n as ScaleToggle, r as exportChartPng, t as RangePresets } from "./chrome-CFMydwn4.mjs";
import { t as TradingChart } from "./TradingChart-BNzBrxV_.mjs";
import { a as reportHasInvestmentView, i as median, r as latestReportPerBroker } from "./research-utils-_RqvZcrM.mjs";
import { t as WatchButton } from "./WatchButton-BIeRlFFv.mjs";
import { n as annotatePrevTargets } from "./naver-v2-C8XzGZTP.mjs";
import { n as ResearchCard } from "./ResearchCard-B9UdtEGW.mjs";
import { t as ResearchDetailSheet } from "./ResearchDetailSheet-Cdb2zg_Q.mjs";
import { t as useMarketStream } from "./use-market-stream-Bd71nqjQ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/stock._ticker-CFPPN8Wh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CONSENSUS_MAX_AGE_DAYS = 180;
var TABS = [
	{
		id: "company",
		label: "기업",
		icon: Building2
	},
	{
		id: "industry",
		label: "산업",
		icon: Factory
	},
	{
		id: "market",
		label: "전략",
		icon: ChartLine
	},
	{
		id: "economy",
		label: "매크로",
		icon: Earth
	}
];
function RatingBadge({ rating }) {
	if (!rating) return null;
	const buy = /매수|비중확대|BUY|OUTPERFORM|OVERWEIGHT/i.test(rating);
	const sell = /매도|비중축소|SELL|UNDERPERFORM|UNDERWEIGHT/i.test(rating);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold", buy && "bg-price-up/15 text-price-up", sell && "bg-price-down/15 text-price-down", !buy && !sell && "bg-amber-500/15 text-amber-400"),
		children: rating
	});
}
function reportList(pack, tab) {
	const raw = pack[tab];
	const sorted = annotatePrevTargets(sortReportsNewestFirst(raw));
	return tab === "company" ? sorted.filter(reportHasInvestmentView) : sorted;
}
function BrokerReports({ pack, companyReports, currentPrice, loading }) {
	const data = pack ?? {
		company: companyReports ?? [],
		industry: [],
		market: [],
		economy: []
	};
	const [tab, setTab] = (0, import_react.useState)("company");
	const [active, setActive] = (0, import_react.useState)(null);
	const colors = usePriceColors();
	const list = (0, import_react.useMemo)(() => reportList(data, tab).slice(0, 30), [data, tab]);
	const consensus = (0, import_react.useMemo)(() => {
		const cutoff = /* @__PURE__ */ new Date();
		cutoff.setDate(cutoff.getDate() - CONSENSUS_MAX_AGE_DAYS);
		const cutoffStr = cutoff.toISOString().slice(0, 10);
		const latestAll = latestReportPerBroker(data.company);
		const latest = latestAll.filter((r) => {
			const day = reportDay(r);
			return !day || day >= cutoffStr;
		});
		const staleDropped = latestAll.length - latest.length;
		const views = latest.filter(reportHasInvestmentView);
		const rated = views.filter((r) => r.rating);
		const targets = views.map((r) => r.targetPrice).filter((x) => x != null && x > 0).sort((a, b) => a - b);
		let buy = 0, hold = 0, sell = 0;
		for (const r of rated) if (/매수|비중확대|BUY|OUTPERFORM|OVERWEIGHT/i.test(r.rating)) buy++;
		else if (/매도|비중축소|SELL|UNDERPERFORM|UNDERWEIGHT/i.test(r.rating)) sell++;
		else hold++;
		const med = median(targets);
		const average = targets.length ? Math.round(targets.reduce((sum, x) => sum + x, 0) / targets.length) : null;
		const upside = med && currentPrice > 0 ? (med / currentPrice - 1) * 100 : null;
		const asOf = sortReportsNewestFirst(views)[0]?.date ?? null;
		return {
			brokerCount: latest.length,
			viewCount: views.length,
			buy,
			hold,
			sell,
			med,
			average,
			low: targets[0] ?? null,
			high: targets[targets.length - 1] ?? null,
			upside,
			rows: sortReportsNewestFirst(views),
			staleDropped,
			maxAgeDays: CONSENSUS_MAX_AGE_DAYS,
			asOf
		};
	}, [data.company, currentPrice]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-border px-3 py-3 md:px-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-start justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "flex items-center gap-1.5 text-sm font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3.5" }), " 리서치 & 컨센서스"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-[11px] text-muted-foreground",
						children: "최신 증권사별 1건만 집계 · 기업 탭은 의견/목표가 확인 가능한 리포트만 표시"
					})] }), loading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3 animate-spin" }), " 수신 중"]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConsensusMetric, {
							label: "커버리지",
							value: `${consensus.viewCount} / ${consensus.brokerCount}사`,
							sub: "투자의견 또는 목표가 확인"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConsensusMetric, {
							label: "의견 분포",
							value: `${consensus.buy} 매수 · ${consensus.hold} 중립 · ${consensus.sell} 매도`,
							sub: `증권사별 최신 · ${consensus.maxAgeDays}일 이내${consensus.staleDropped ? ` · 제외 ${consensus.staleDropped}` : ""}${consensus.asOf ? ` · as-of ${consensus.asOf}` : ""}`
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConsensusMetric, {
							label: "목표가 중앙값",
							value: consensus.med ? formatPrice(consensus.med) : "—",
							sub: consensus.upside == null ? "현재가 대비 계산 대기" : `현재가 대비 ${consensus.upside >= 0 ? "+" : ""}${consensus.upside.toFixed(1)}%`,
							className: consensus.upside == null ? void 0 : consensus.upside >= 0 ? colors.up : colors.down
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConsensusMetric, {
							label: "목표가 범위",
							value: consensus.low && consensus.high ? `${formatPrice(consensus.low)} ~ ${formatPrice(consensus.high)}` : "—",
							sub: consensus.average ? `평균 ${formatPrice(consensus.average)}` : "표본 부족"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "px-3 py-3 md:px-4 space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-1 rounded-lg bg-muted p-1",
						children: TABS.map((t) => {
							const Icon = t.icon;
							const count = reportList(data, t.id).length;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setTab(t.id),
								className: cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium", tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-3" }),
									" ",
									t.label,
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "tabular opacity-70",
										children: count
									})
								]
							}, t.id);
						})
					}),
					tab !== "company" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2 text-[11px] text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: tab === "industry" ? "해당 종목 산업 키워드와 매칭된 리포트" : "전 시장 공통 리서치 피드" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/research",
							search: { tab: tab === "market" ? "invest" : tab },
							className: "text-primary hover:underline",
							children: "리서치 데스크 →"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "flex flex-col gap-2",
						children: list.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground",
							children: loading ? "리포트 수신 중…" : "현재 조건에서 표시할 리포트가 없습니다."
						}) : list.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchCard, {
							report: r,
							onDetail: setActive
						}, `${r.v2Type ?? r.category}-${r.researchId}`))
					}),
					tab === "company" && consensus.rows.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-x-auto rounded-lg border border-border",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "bg-muted/35 text-muted-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-2 py-1.5 text-left",
										children: "증권사"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-2 py-1.5 text-left",
										children: "의견"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-2 py-1.5 text-right",
										children: "목표가"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-2 py-1.5 text-right",
										children: "일자"
									})
								] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
								className: "divide-y divide-border",
								children: consensus.rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-2 py-1.5 font-medium",
										children: r.broker
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-2 py-1.5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RatingBadge, { rating: r.rating })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-2 py-1.5 text-right tabular",
										children: r.targetPrice ? formatPrice(r.targetPrice) : "—"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-2 py-1.5 text-right tabular text-muted-foreground",
										children: r.date
									})
								] }, `cons-${r.broker}`))
							})]
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchDetailSheet, {
				report: active,
				onClose: () => setActive(null),
				onOpenReport: setActive
			})
		]
	});
}
function ConsensusMetric({ label, value, sub, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border bg-muted/20 p-2.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[10px] text-muted-foreground",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("mt-0.5 text-sm font-semibold tabular", className),
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-0.5 text-[10px] text-muted-foreground",
				children: sub
			})
		]
	});
}
var SERIES = [
	{
		key: "foreign",
		name: "외국인",
		color: "#38bdf8",
		icon: Earth
	},
	{
		key: "institution",
		name: "기관",
		color: "#a78bfa",
		icon: Building2
	},
	{
		key: "individual",
		name: "개인",
		color: "#fbbf24",
		icon: Users
	}
];
var WINDOWS = [
	{
		id: 5,
		label: "5일"
	},
	{
		id: 10,
		label: "10일"
	},
	{
		id: 20,
		label: "20일"
	},
	{
		id: 60,
		label: "60일"
	},
	{
		id: 120,
		label: "120일"
	},
	{
		id: 0,
		label: "전체"
	}
];
/** Desk glossary — how pros read each flow statistic */
var STAT_GUIDE = [
	{
		id: "net",
		title: "순매수 합",
		formula: "선택 구간 일별 순매수(주)의 합계",
		meaning: "그 기간 동안 해당 주체가 시장에서 순수하게 사들인(또는 판) 주식 수. 양수=순매수, 음수=순매도.",
		howToUse: "20·60일 순매수 합이 동시에 큰 양수면 추세적 매집 가능성. 외인+기관이 같이 양수면 스마트머니 매집으로 해석하는 경우가 많습니다.",
		caution: "단발성 블록딜·지수 리밸런싱·선물 베이시스 차익이 왜곡할 수 있어 공시·뉴스와 교차 확인하세요."
	},
	{
		id: "avg",
		title: "일평균",
		formula: "순매수 합 ÷ 구간 거래일 수",
		meaning: "하루 평균 얼마나 사고팔았는지. 종목 유동성 대비 수급 강도를 가늠하는 스케일입니다.",
		howToUse: "일평균이 평소 거래량의 수 % 이상을 꾸준히 가져가면 가격 영향력이 커집니다. 구간을 바꿔 평균이 유지되는지 보세요.",
		caution: "거래대금·유통주식 대비 비율은 별도 확인이 필요합니다(절대 주수만으로는 부족)."
	},
	{
		id: "buyRatio",
		title: "매수일%",
		formula: "순매수>0인 날 수 ÷ (순매수≠0인 날) × 100",
		meaning: "방향의 일관성. 합계가 비슷해도 매수일%가 높으면 ‘꾸준한 매집’, 낮으면 ‘하루 몰아사기’에 가깝습니다.",
		howToUse: "매수일% 60%+ & 순매수 합 양수 → 분산 매집 패턴. 매수일% 낮고 합만 크면 이벤트성 수급 가능성.",
		caution: "휴장·이상치 하루가 비율을 흔들 수 있어 5일·20일을 함께 봅니다."
	},
	{
		id: "max",
		title: "최대매수 / 최대매도",
		formula: "구간 내 일별 순매수 최댓값·최솟값",
		meaning: "한 번에 들어온 수급 충격의 크기. 급등·급락 당일 주체를 찾는 데 유용합니다.",
		howToUse: "최대매수일이 갭상승·실적일·정책 발표일과 겹치면 이벤트 매수. 최대매도일이 악재·만기일과 겹치면 일회성 매도 여부 판단.",
		caution: "단일 지표로 추세를 단정하지 마세요. 전후 며칠 흐름을 보세요."
	},
	{
		id: "streak",
		title: "연속 (스트릭)",
		formula: "가장 최근 거래일부터 같은 방향(매수/매도)이 이어진 일수",
		meaning: "지금 이 순간 수급 모멘텀. 3일 이상 연속 순매수는 단기 수급 추세로 자주 인용됩니다.",
		howToUse: "외인 3일+ 연속 매수 + 가격 상승 = 추세 동조. 가격은 오르는데 연속 매도 = 상승 중 매도(디스트리뷰션) 경계.",
		caution: "연속이 길수록 되돌림 가능성도 커집니다. 과열 구간에서는 역추세 함정에 주의."
	},
	{
		id: "corr",
		title: "익일수익 상관",
		formula: "당일 순매수 vs 다음 날 종가 수익률의 피어슨 상관계수 (−1~+1)",
		meaning: "이 구간에 한해, 그 주체가 산 다음 날 주가가 같은 방향으로 움직인 경향. +면 동조, −면 역행.",
		howToUse: "|상관| 0.25 이상이면 구간 내 통계적 연관이 눈에 띕니다. 외인 상관이 꾸준히 양수면 ‘외인 따라가기’ 전략의 참고 신호가 될 수 있습니다.",
		caution: "상관≠인과. 표본이 짧거나 변동성이 크면 불안정합니다. 미래 수익을 보장하지 않으며 투자 권유가 아닙니다."
	},
	{
		id: "smart",
		title: "스마트머니 (외인+기관)",
		formula: "외국인 순매수 + 기관 순매수",
		meaning: "개인을 제외한 상대적 ‘정보·규모 우위’ 수급으로 시장에서 자주 묶는 지표. 금색 라인으로 표시됩니다.",
		howToUse: "누적 모드에서 스마트머니가 우상향인데 가격이 횡보하면 매집 구간 후보. 가격 급등 후 스마트머니 누적 꺾이면 차익 실현 가능성.",
		caution: "기관 안에는 투신·연기금·사모 등 성격이 다른 주체가 섞여 있습니다. ‘전부 스마트’는 아닙니다."
	},
	{
		id: "modes",
		title: "일별 vs 누적 보기",
		formula: "일별=그날 순매수 막대 / 누적=구간 시작부터 합산 곡선",
		meaning: "일별은 충격·이벤트, 누적은 중기 매집·매도 궤적을 보는 데 적합합니다.",
		howToUse: "스윙: 누적 60일 + 종가 오버레이. 단타: 일별 5~10일 + 연속 스트릭. 가격선(왼쪽 축)과 수급(오른쪽 축)을 같이 보세요.",
		caution: "누적 곡선은 시작점(구간의 왼쪽 끝)에 따라 모양이 달라집니다. 기간 버튼을 바꿔 민감도를 확인하세요."
	},
	{
		id: "insight",
		title: "자동 시사점",
		formula: "규칙 기반 패턴 매칭 (동반매수·디커플링·개인홀로매수·연속·상관)",
		meaning: "선택 구간 통계를 읽어 데스크가 자주 쓰는 해석을 한 줄로 요약합니다.",
		howToUse: "시사점은 ‘가설’입니다. 차트 지지/저항·공시·미국 연계 뉴스와 맞춰 채택/기각하세요.",
		caution: "자동 문구만으로 매매하지 마세요. 백테스트·포지션 관리가 없는 휴리스틱입니다."
	}
];
function formatSharesShort(n) {
	const abs = Math.abs(n);
	const sign = n > 0 ? "+" : n < 0 ? "-" : "";
	if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(1)}억`;
	if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(0)}만`;
	return `${sign}${new Intl.NumberFormat("ko-KR").format(abs)}`;
}
function toTime$1(date) {
	return date.slice(0, 10);
}
function sumKeys(days, key) {
	return days.reduce((s, d) => s + d[key], 0);
}
function statsFor(days, key) {
	if (!days.length) return {
		net: 0,
		avg: 0,
		buyDays: 0,
		sellDays: 0,
		buyRatio: 0,
		maxBuy: 0,
		maxSell: 0,
		streak: 0,
		streakDir: 0
	};
	const vals = days.map((d) => d[key]);
	const net = vals.reduce((a, b) => a + b, 0);
	const avg = net / vals.length;
	const buyDays = vals.filter((v) => v > 0).length;
	const sellDays = vals.filter((v) => v < 0).length;
	const maxBuy = Math.max(0, ...vals);
	const maxSell = Math.min(0, ...vals);
	let streak = 0;
	let streakDir = 0;
	const last = vals[vals.length - 1];
	if (last > 0) streakDir = 1;
	else if (last < 0) streakDir = -1;
	if (streakDir !== 0) for (let i = vals.length - 1; i >= 0; i--) if (streakDir === 1 && vals[i] > 0) streak++;
	else if (streakDir === -1 && vals[i] < 0) streak++;
	else break;
	return {
		net,
		avg,
		buyDays,
		sellDays,
		buyRatio: buyDays + sellDays ? buyDays / (buyDays + sellDays) * 100 : 0,
		maxBuy,
		maxSell,
		streak,
		streakDir
	};
}
/** Pearson correlation between flow and next-day return */
function corrFlowPrice(days, key) {
	if (days.length < 8) return null;
	const xs = [];
	const ys = [];
	for (let i = 0; i < days.length - 1; i++) {
		const a = days[i];
		const b = days[i + 1];
		if (!a.close || !b.close) continue;
		xs.push(a[key]);
		ys.push((b.close - a.close) / a.close);
	}
	if (xs.length < 6) return null;
	const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
	const my = ys.reduce((s, v) => s + v, 0) / ys.length;
	let num = 0;
	let dx = 0;
	let dy = 0;
	for (let i = 0; i < xs.length; i++) {
		const ax = xs[i] - mx;
		const ay = ys[i] - my;
		num += ax * ay;
		dx += ax * ax;
		dy += ay * ay;
	}
	const den = Math.sqrt(dx * dy);
	if (!den) return null;
	return num / den;
}
function InvestorFlow({ days, source, loading }) {
	const [windowN, setWindowN] = (0, import_react.useState)(60);
	const [mode, setMode] = (0, import_react.useState)("daily");
	const [visible, setVisible] = (0, import_react.useState)({
		foreign: true,
		institution: true,
		individual: true
	});
	const [showPrice, setShowPrice] = (0, import_react.useState)(true);
	const [hover, setHover] = (0, import_react.useState)(null);
	const [chartH, setChartH] = (0, import_react.useState)(320);
	const [showGuide, setShowGuide] = (0, import_react.useState)(false);
	const colors = usePriceColors();
	useAppStore((s) => s.colorConvention);
	const slice = (0, import_react.useMemo)(() => {
		if (!windowN) return days;
		return days.slice(-windowN);
	}, [days, windowN]);
	const last = days[days.length - 1];
	const display = hover ?? last;
	const rangeStats = (0, import_react.useMemo)(() => {
		const bars = slice.filter((d) => d.close > 0).map((d) => ({
			high: d.close,
			low: d.close,
			close: d.close,
			date: d.date
		}));
		return computeRangePosition(bars);
	}, [slice]);
	const smartMoney = (0, import_react.useMemo)(() => slice.map((d) => ({
		...d,
		smart: d.foreign + d.institution
	})), [slice]);
	const stats = (0, import_react.useMemo)(() => {
		return {
			foreign: statsFor(slice, "foreign"),
			institution: statsFor(slice, "institution"),
			individual: statsFor(slice, "individual"),
			smartNet: sumKeys(slice, "foreign") + sumKeys(slice, "institution"),
			corrF: corrFlowPrice(slice, "foreign"),
			corrI: corrFlowPrice(slice, "institution"),
			corrP: corrFlowPrice(slice, "individual")
		};
	}, [slice]);
	const insight = (0, import_react.useMemo)(() => {
		if (slice.length < 5) return "데이터 부족 — 기간을 늘려 보세요.";
		const f = stats.foreign;
		const i = stats.institution;
		const p = stats.individual;
		const parts = [];
		if (f.net > 0 && i.net > 0) parts.push("스마트머니(외인+기관) 동반 순매수 구간");
		else if (f.net < 0 && i.net < 0) parts.push("스마트머니 동반 순매도 — 수급 약세 경계");
		else if (f.net > 0 && i.net < 0) parts.push("외인 매수 vs 기관 매도 — 수급 디커플링");
		else if (f.net < 0 && i.net > 0) parts.push("기관 매수 vs 외인 매도 — 수급 디커플링");
		if (p.net > 0 && f.net < 0 && i.net < 0) parts.push("개인 홀로 매수(반대매매 패턴 주의)");
		if (f.streak >= 3 && f.streakDir === 1) parts.push(`외인 ${f.streak}일 연속 순매수`);
		if (f.streak >= 3 && f.streakDir === -1) parts.push(`외인 ${f.streak}일 연속 순매도`);
		if (stats.corrF != null && Math.abs(stats.corrF) > .25) parts.push(`외인 수급↔익일 수익률 상관 ${stats.corrF >= 0 ? "+" : ""}${stats.corrF.toFixed(2)}`);
		if (!parts.length) parts.push("뚜렷한 편향 없음 — 추세·가격과 교차 확인");
		return parts.join(" · ");
	}, [slice, stats]);
	const wrapRef = (0, import_react.useRef)(null);
	const [chartApi, setChartApi] = (0, import_react.useState)(null);
	const chartRef = (0, import_react.useRef)(null);
	const histRefs = (0, import_react.useRef)({});
	const lineRefs = (0, import_react.useRef)({});
	const priceRef = (0, import_react.useRef)(null);
	const smartRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const el = wrapRef.current;
		if (!el) return;
		const chart = createProChart(el, readChartTheme(), "KR");
		chart.applyOptions({
			localization: {
				locale: "ko-KR",
				priceFormatter: (v) => Math.round(v).toLocaleString("ko-KR")
			},
			rightPriceScale: { scaleMargins: {
				top: .1,
				bottom: .15
			} },
			leftPriceScale: {
				visible: true,
				borderColor: "rgba(148,163,184,0.15)",
				scaleMargins: {
					top: .1,
					bottom: .15
				}
			},
			timeScale: {
				rightOffset: 4,
				barSpacing: 10,
				minBarSpacing: 3,
				timeVisible: false
			}
		});
		for (const s of SERIES) {
			histRefs.current[s.key] = chart.addSeries(nr, {
				color: s.color,
				priceFormat: { type: "volume" },
				priceScaleId: "right",
				lastValueVisible: true,
				priceLineVisible: false
			});
			lineRefs.current[s.key] = chart.addSeries(ye, {
				color: s.color,
				lineWidth: 2,
				priceScaleId: "right",
				lastValueVisible: true,
				priceLineVisible: false,
				crosshairMarkerVisible: false
			});
		}
		smartRef.current = chart.addSeries(ye, {
			color: "#e5b84c",
			lineWidth: 2,
			priceScaleId: "right",
			lastValueVisible: true,
			priceLineVisible: false,
			crosshairMarkerVisible: false
		});
		priceRef.current = chart.addSeries(ye, {
			color: "#94a3b8",
			lineWidth: 1,
			priceScaleId: "left",
			lastValueVisible: true,
			priceLineVisible: false,
			crosshairMarkerVisible: false
		});
		chartRef.current = chart;
		const onCross = (param) => {
			if (!param.time) {
				setHover(null);
				return;
			}
			const d = days.find((x) => x.date === String(param.time));
			setHover(d ?? null);
		};
		chart.subscribeCrosshairMove(onCross);
		setChartApi(chart);
		return () => {
			setChartApi(null);
			chart.remove();
			chartRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const chart = chartRef.current;
		if (!chart) return;
		for (const s of SERIES) {
			const hist = histRefs.current[s.key];
			const line = lineRefs.current[s.key];
			if (!hist || !line) continue;
			if (!visible[s.key]) {
				hist.setData([]);
				line.setData([]);
				continue;
			}
			if (mode === "daily") {
				hist.setData(slice.map((d) => ({
					time: toTime$1(d.date),
					value: d[s.key],
					color: d[s.key] >= 0 ? s.color + "cc" : s.color + "66"
				})));
				line.setData([]);
			} else {
				hist.setData([]);
				let cum = 0;
				line.setData(slice.map((d) => {
					cum += d[s.key];
					return {
						time: toTime$1(d.date),
						value: cum
					};
				}));
			}
		}
		if (smartRef.current) {
			if (mode === "cumulative") {
				let cum = 0;
				smartRef.current.setData(smartMoney.map((d) => {
					cum += d.smart;
					return {
						time: toTime$1(d.date),
						value: cum
					};
				}));
				smartRef.current.applyOptions({ visible: true });
			} else smartRef.current.setData(smartMoney.map((d) => ({
				time: toTime$1(d.date),
				value: d.smart
			})));
		}
		if (priceRef.current) {
			if (showPrice) priceRef.current.setData(slice.filter((d) => d.close > 0).map((d) => ({
				time: toTime$1(d.date),
				value: d.close
			})));
			else priceRef.current.setData([]);
		}
		chart.timeScale().fitContent();
	}, [
		slice,
		mode,
		visible,
		showPrice,
		smartMoney
	]);
	const fit = () => chartRef.current?.timeScale().fitContent();
	const zoomIn = () => {
		const ts = chartRef.current?.timeScale();
		const r = ts?.getVisibleLogicalRange();
		if (!ts || !r) return;
		const mid = (r.from + r.to) / 2;
		const half = (r.to - r.from) / 2 / 1.35;
		ts.setVisibleLogicalRange({
			from: mid - half,
			to: mid + half
		});
	};
	const zoomOut = () => {
		const ts = chartRef.current?.timeScale();
		const r = ts?.getVisibleLogicalRange();
		if (!ts || !r) return;
		const mid = (r.from + r.to) / 2;
		const half = (r.to - r.from) / 2 * 1.35;
		ts.setVisibleLogicalRange({
			from: mid - half,
			to: mid + half
		});
	};
	const dragH = (0, import_react.useRef)(null);
	const onHeightDown = (e) => {
		dragH.current = {
			y: e.clientY,
			h: chartH
		};
		const move = (ev) => {
			if (!dragH.current) return;
			setChartH(Math.min(640, Math.max(240, dragH.current.h + (ev.clientY - dragH.current.y))));
		};
		const up = () => {
			dragH.current = null;
			window.removeEventListener("mousemove", move);
			window.removeEventListener("mouseup", up);
		};
		window.addEventListener("mousemove", move);
		window.addEventListener("mouseup", up);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "desk-card desk-card-teal overflow-hidden",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 md:px-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-base font-semibold tracking-tight flex items-center gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartColumn, { className: "size-4 text-desk-teal" }), "투자자 수급"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted-foreground mt-0.5",
				children: [
					"개인·기관·외국인 순매수(주) · 휠 줌·드래그 이동 · 출처",
					" ",
					source || "네이버 증권",
					" · ",
					days.length,
					"거래일"
				]
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-0.5 rounded-md bg-muted p-0.5",
						children: [["daily", "일별"], ["cumulative", "누적"]].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setMode(id),
							className: cn("rounded px-2.5 py-1 text-xs font-medium min-h-8", mode === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"),
							children: label
						}, id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-0.5 rounded-md bg-muted p-0.5",
						children: WINDOWS.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setWindowN(w.id),
							className: cn("rounded px-2 py-1 text-xs font-medium min-h-8", windowN === w.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"),
							children: w.label
						}, w.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: zoomIn,
						className: "rounded bg-muted px-2 py-1 min-h-8",
						title: "확대",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ZoomIn, { className: "size-3.5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: zoomOut,
						className: "rounded bg-muted px-2 py-1 min-h-8",
						title: "축소",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ZoomIn, { className: "size-3.5 rotate-180" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: fit,
						className: "inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs min-h-8",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Maximize2, { className: "size-3.5" }), " Fit"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setShowGuide((v) => !v),
						className: cn("inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs min-h-8 font-medium", showGuide ? "bg-desk-teal/20 text-desk-teal ring-1 ring-desk-teal/40" : "bg-muted text-muted-foreground hover:text-foreground"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-3.5" }),
							"통계 설명",
							showGuide ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-3.5" })
						]
					})
				]
			})]
		}), loading && days.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "px-4 py-12 text-center text-sm text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin inline mr-2" }), "수급 불러오는 중…"]
		}) : days.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "px-4 py-12 text-center text-sm text-muted-foreground",
			children: "수급 데이터 없음"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border-b border-border",
				children: [SERIES.map((s) => {
					const v = display?.[s.key] ?? 0;
					const Icon = s.icon;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-border bg-card/60 px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center gap-1 text-xs text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
									className: "size-3",
									style: { color: s.color }
								}), s.name]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "text-[10px] text-muted-foreground flex items-center gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: visible[s.key],
									onChange: () => setVisible((v0) => ({
										...v0,
										[s.key]: !v0[s.key]
									}))
								}), "표시"]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: cn("mt-0.5 text-sm font-semibold tabular", v > 0 ? colors.up : v < 0 ? colors.down : "text-muted-foreground"),
							children: formatSharesShort(v)
						})]
					}, s.key);
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-lg border border-border bg-card/60 px-3 py-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between text-xs text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "종가 · 스마트머니" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex items-center gap-1 text-[10px]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: showPrice,
									onChange: () => setShowPrice((v) => !v)
								}), "가격"]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-0.5 text-sm font-semibold tabular",
							children: display?.close ? display.close.toLocaleString("ko-KR") : "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: cn("text-xs tabular font-medium", stats.smartNet > 0 ? colors.up : stats.smartNet < 0 ? colors.down : "text-muted-foreground"),
							children: ["구간 스마머니 ", formatSharesShort(stats.smartNet)]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RangePositionStrip, {
				stats: rangeStats,
				compact: true,
				caption: "선택 구간 종가 기준 · 기간 고/저는 절대 최고·최저, 최근 고/저는 확인된 스윙."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartShell, {
				title: mode === "daily" ? "주체별 일별 순매수 (주)" : "주체별 누적 순매수 (주)",
				status: days.length ? {
					source: source || "네이버 증권",
					mode: `${slice.length}거래일 · 수량(주) · 좌축 종가`,
					asOfLabel: last?.date ? `${last.date.slice(0, 10)} (일별 집계)` : null
				} : null,
				onExportPng: days.length ? () => exportChartPng(chartApi, "KR", "FLOW", `investor-flow-${mode}`) : void 0,
				onExportCsv: days.length ? () => exportRowsCsv(chartApi, slice.map((d) => ({
					...d,
					time: d.date.slice(0, 10)
				})), [
					{
						name: "foreign",
						get: (r) => r.foreign
					},
					{
						name: "institution",
						get: (r) => r.institution
					},
					{
						name: "individual",
						get: (r) => r.individual
					},
					{
						name: "close",
						get: (r) => r.close
					}
				], "KR", "FLOW", `investor-flow-${mode}`) : void 0,
				height: chartH,
				testId: "investor-flow-chart",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: wrapRef,
					className: "absolute inset-0"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				role: "separator",
				onMouseDown: onHeightDown,
				className: "flex h-3 cursor-ns-resize items-center justify-center border-y border-border bg-muted/30 hover:bg-desk-teal/20",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-0.5 w-10 rounded bg-border" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "p-3 md:p-4 space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-desk-gold/30 bg-desk-gold/5 px-3 py-2.5 text-sm leading-relaxed",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold text-desk-gold",
								children: "시사점 · "
							}),
							insight,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-muted-foreground",
								children: [
									" ",
									"(선택 구간 ",
									slice.length,
									"거래일",
									display ? ` · 커서 ${display.date}` : "",
									")"
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-x-auto scroll-thin rounded-lg border border-border",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full min-w-[720px] text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "bg-muted/40 text-xs text-muted-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									className: "text-left",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "px-3 py-2 font-medium",
											children: "주체"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "px-3 py-2 text-right font-medium",
											title: "선택 구간 일별 순매수 합계",
											children: "순매수 합"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "px-3 py-2 text-right font-medium",
											title: "순매수 합 ÷ 거래일 수",
											children: "일평균"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "px-3 py-2 text-right font-medium",
											title: "순매수 날 비율 — 매집 일관성",
											children: "매수일%"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "px-3 py-2 text-right font-medium",
											title: "구간 내 하루 최대 순매수",
											children: "최대매수"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "px-3 py-2 text-right font-medium",
											title: "구간 내 하루 최대 순매도",
											children: "최대매도"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "px-3 py-2 text-right font-medium",
											title: "최근 같은 방향 연속 일수",
											children: "연속"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "px-3 py-2 text-right font-medium",
											title: "당일 순매수 vs 익일 수익률 피어슨 상관 (인과 아님)",
											children: "익일수익 상관"
										})
									]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
								className: "divide-y divide-border",
								children: SERIES.map((s) => {
									const st = stats[s.key];
									const corr = s.key === "foreign" ? stats.corrF : s.key === "institution" ? stats.corrI : stats.corrP;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3 py-2 font-medium",
											style: { color: s.color },
											children: s.name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: cn("px-3 py-2 text-right tabular font-semibold", st.net > 0 ? colors.up : st.net < 0 ? colors.down : "text-muted-foreground"),
											children: formatSharesShort(st.net)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3 py-2 text-right tabular text-muted-foreground",
											children: formatSharesShort(Math.round(st.avg))
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
											className: "px-3 py-2 text-right tabular",
											children: [
												st.buyRatio.toFixed(0),
												"%",
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-muted-foreground text-xs",
													children: [
														" ",
														"(",
														st.buyDays,
														"/",
														st.buyDays + st.sellDays,
														")"
													]
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: cn("px-3 py-2 text-right tabular", colors.up),
											children: formatSharesShort(st.maxBuy)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: cn("px-3 py-2 text-right tabular", colors.down),
											children: formatSharesShort(st.maxSell)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3 py-2 text-right tabular",
											children: st.streak > 0 ? `${st.streak}일 ${st.streakDir > 0 ? "매수" : "매도"}` : "—"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3 py-2 text-right tabular text-muted-foreground",
											children: corr == null ? "—" : `${corr >= 0 ? "+" : ""}${corr.toFixed(2)}`
										})
									] }, s.key);
								})
							})]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-x-auto scroll-thin rounded-lg border border-border max-h-56",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full min-w-[520px] text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "bg-muted/40 sticky top-0 text-xs text-muted-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-3 py-2 text-left",
										children: "일자"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-3 py-2 text-right",
										children: "외국인"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-3 py-2 text-right",
										children: "기관"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-3 py-2 text-right",
										children: "개인"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-3 py-2 text-right",
										children: "종가"
									})
								] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: [...slice].reverse().map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-t border-border/50 hover:bg-muted/20",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-3 py-1.5 text-xs tabular text-muted-foreground",
										children: row.date
									}),
									[
										"foreign",
										"institution",
										"individual"
									].map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: cn("px-3 py-1.5 text-right tabular text-xs font-medium", row[k] > 0 ? colors.up : row[k] < 0 ? colors.down : "text-muted-foreground"),
										children: formatSharesShort(row[k])
									}, k)),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-3 py-1.5 text-right tabular text-xs",
										children: row.close ? row.close.toLocaleString("ko-KR") : "—"
									})
								]
							}, row.date)) })]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-1.5",
						children: [
							["순매수 합", "구간 순매수 총량"],
							["일평균", "하루 평균 강도"],
							["매수일%", "방향 일관성"],
							["연속", "최근 모멘텀"],
							["익일상관", "다음날 수익 연관(≠인과)"]
						].map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-3 text-desk-teal" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
									className: "text-foreground font-medium",
									children: k
								}),
								v
							]
						}, k))
					}),
					showGuide && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-border bg-card/80 p-4 md:p-5 space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-start justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
									className: "text-base font-semibold flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-4 text-desk-teal" }), "수급 통계 상세 가이드"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 text-sm text-muted-foreground leading-relaxed max-w-3xl",
									children: [
										"Wall Street·국내 기관 데스크에서 수급을 읽을 때 쓰는 해석 프레임입니다. 모든 수치는",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
											className: "text-foreground",
											children: "위에서 고른 기간 버튼"
										}),
										"구간에만 계산됩니다. 투자 권유가 아닌 분석 도구 설명입니다."
									]
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setShowGuide(false),
									className: "text-xs text-muted-foreground hover:text-foreground",
									children: "접기"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid gap-3 md:grid-cols-2",
								children: STAT_GUIDE.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
									className: "rounded-lg border border-border bg-muted/20 p-3.5 space-y-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
											className: "text-[15px] font-semibold tracking-tight",
											children: g.title
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-xs text-desk-teal font-medium leading-snug",
											children: ["계산 · ", g.formula]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-sm leading-relaxed space-y-1.5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground",
													children: "의미 · "
												}), g.meaning] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-medium text-foreground",
													children: ["실전 활용 ·", " "]
												}), g.howToUse] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-desk-rose/90 text-[13px]",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-medium",
														children: "주의 · "
													}), g.caution]
												})
											]
										})
									]
								}, g.id))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg border border-desk-gold/25 bg-desk-gold/5 p-3.5 text-sm leading-relaxed",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-semibold text-desk-gold mb-1.5",
									children: "추천 읽기 순서 (실전)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
									className: "list-decimal pl-4 space-y-1 text-foreground/95",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
											"기간을 ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "20일·60일" }),
											"로 놓고 누적 모드에서 스마트머니 방향 확인"
										] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
											"일별 모드로 전환해 ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "연속 스트릭" }),
											"과 최근 충격(최대매수·매도) 확인"
										] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
											"표에서 ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "매수일%" }),
											"로 매집이 꾸준한지, 이벤트성인지 구분"
										] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "익일상관" }), "은 참고만 — 차트 지지/저항·공시와 반드시 교차"] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "시사점 한 줄을 가설로 두고, 맞으면 유지·틀리면 기간을 바꿔 재검증" })
									]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-[11px] text-muted-foreground leading-relaxed",
						children: [
							"스마트머니 = 외국인+기관. 상관은 당일 순매수와",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "익일" }),
							" 종가 수익률의 피어슨 계수(참고용, 인과 아님). 휠=줌, 드래그=이동, 축 드래그=스케일. 가격선은 왼쪽 축. 상세는",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setShowGuide(true),
								className: "text-primary hover:underline",
								children: "통계 설명"
							}),
							"을 펼치세요."
						]
					})
				]
			})
		] })]
	});
}
function toFeed(list, fetchedAt) {
	return list.map((n) => newsItemToFeed(n, {
		sourceId: "naver-stock-news",
		sourceName: "네이버 종목뉴스",
		tier: 3,
		fetchedAt
	})).filter((x) => x != null);
}
/**
* Per-stock news (F1.4): newest first via the shared kernel, publisher badges
* (tier dot), original links, and 더 보기 for page 2+.
*/
function LiveNews({ news, disclosures, title = "뉴스 · 공시", code }) {
	const more = useInfiniteQuery({
		queryKey: ["stock-news-more", code],
		queryFn: ({ pageParam }) => getStockNews({ data: {
			code,
			page: pageParam
		} }),
		initialPageParam: 2,
		getNextPageParam: (last) => last.hasMore ? last.page + 1 : void 0,
		enabled: false
	});
	const items = (0, import_react.useMemo)(() => {
		const base = toFeed(news, (/* @__PURE__ */ new Date(0)).toISOString());
		const extra = (more.data?.pages ?? []).flatMap((p) => toFeed(p.items, p.fetchedAt));
		return sortNewestFirst(dedupeById([...base, ...extra]));
	}, [news, more.data]);
	const loaded = more.data?.pages.length ?? 0;
	const hasMore = code != null && (loaded === 0 ? news.length >= 20 : Boolean(more.hasNextPage));
	const lastError = more.data?.pages.at(-1)?.error;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DisclosureList, {
			items: disclosures,
			title: `${title.split("·")[0]?.trim() || "공시"} · 공시`
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "overflow-hidden rounded-xl border border-border bg-card",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-border px-3 py-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-semibold",
					children: "뉴스"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] text-muted-foreground",
					children: "네이버 증권 종목뉴스 · 최신순 · 발행 매체와 원문 링크 표시"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "max-h-[520px] overflow-y-auto scroll-thin p-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedList, {
					items,
					emptyReason: lastError ? `뉴스를 받지 못했습니다 (${lastError}).` : "최근 뉴스 없음 — 소스가 응답하지 않았거나 기사가 없습니다.",
					hasMore,
					loadingMore: more.isFetching,
					onLoadMore: () => void (loaded === 0 ? more.refetch() : more.fetchNextPage())
				})
			})]
		})]
	});
}
/**
* Institutional pre-trade strip: levels, gap, RVOL, ATR, data honesty.
* Red Team requirement — never trade header price without knowing session context.
*/
function TradeDeskStrip({ quote, basic, dayBars, liveConnected, dataUpdatedAt, chartSource }) {
	const colors = usePriceColors();
	const metrics = (0, import_react.useMemo)(() => {
		if (!quote) return null;
		const prev = quote.prevClose || quote.price - quote.change;
		const gapPct = prev ? (quote.open - prev) / prev * 100 : 0;
		const dayRange = quote.high > quote.low ? (quote.price - quote.low) / (quote.high - quote.low) * 100 : 50;
		const dayRangePct = quote.low > 0 ? (quote.high - quote.low) / quote.low * 100 : 0;
		const fromHigh52 = quote.high52 > 0 ? (quote.price - quote.high52) / quote.high52 * 100 : null;
		const fromLow52 = quote.low52 > 0 ? (quote.price - quote.low52) / quote.low52 * 100 : null;
		let rvol = null;
		let atr14 = null;
		let atrPct = null;
		if (dayBars && dayBars.length >= 20) {
			const vols = dayBars.map((b) => b.volume);
			const avg20 = vols.slice(-21, -1).reduce((s, v) => s + v, 0) / Math.max(1, Math.min(20, vols.length - 1));
			if (avg20 > 0) rvol = quote.volume / avg20;
			const a = atr(dayBars.map((b) => b.high), dayBars.map((b) => b.low), dayBars.map((b) => b.close), 14);
			atr14 = lastNumber(a);
			if (atr14 && quote.price) atrPct = atr14 / quote.price * 100;
		}
		const last = dayBars?.[dayBars.length - 1];
		const maBias = last ? {
			aboveMa20: last.ma20 != null ? last.close >= last.ma20 : null,
			ma20Above60: last.ma20 != null && last.ma60 != null ? last.ma20 >= last.ma60 : null
		} : null;
		const ageMs = dataUpdatedAt != null ? Date.now() - dataUpdatedAt : null;
		return {
			prev,
			gapPct,
			dayRange,
			dayRangePct,
			fromHigh52,
			fromLow52,
			rvol,
			atr14,
			atrPct,
			maBias,
			ageMs
		};
	}, [
		quote,
		dayBars,
		dataUpdatedAt
	]);
	if (!quote || !metrics) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground",
		children: "시세 로딩 중 — 트레이드 데스크 대기"
	});
	const stale = metrics.ageMs != null && metrics.ageMs > 45e3 && !liveConnected;
	const isLive = liveConnected || quote.source === "kis-krx-websocket";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "desk-card desk-card-navy overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2 text-sm font-semibold",
					children: ["트레이드 데스크", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold", isLive ? "bg-price-up/15 text-price-up" : stale ? "bg-price-down/15 text-price-down" : "bg-muted text-muted-foreground"),
						children: isLive ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-3" }), " LIVE"] }) : stale ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-3" }),
							" STALE",
							" ",
							Math.round((metrics.ageMs ?? 0) / 1e3),
							"s"
						] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: "스냅샷" })
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-[11px] text-muted-foreground",
					children: [
						"차트 소스 ",
						chartSource || "—",
						" · 헤더 시세와 분봉은 공급원이 다를 수 있음"
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-px bg-border",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
						label: "시가",
						value: formatPrice(quote.open)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
						label: "고가",
						value: formatPrice(quote.high)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
						label: "저가",
						value: formatPrice(quote.low)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
						label: "종가/현재",
						value: formatPrice(quote.price),
						emphasize: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
						label: "전일",
						value: formatPrice(metrics.prev)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
						label: "갭",
						value: `${metrics.gapPct >= 0 ? "+" : ""}${metrics.gapPct.toFixed(2)}%`,
						tone: metrics.gapPct > 0 ? "up" : metrics.gapPct < 0 ? "down" : void 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
						label: "일중 위치",
						value: `${metrics.dayRange.toFixed(0)}%`,
						sub: `고저폭 ${metrics.dayRangePct.toFixed(2)}%`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
						label: "거래량",
						value: formatVolume(quote.volume)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "RVOL (20일)",
						value: metrics.rvol != null ? `${metrics.rvol.toFixed(2)}x` : "—",
						hint: "당일 거래량 ÷ 최근 20일 평균",
						hot: metrics.rvol != null && metrics.rvol >= 1.5
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "ATR(14)",
						value: metrics.atr14 != null ? `${formatPrice(Math.round(metrics.atr14))}${metrics.atrPct != null ? ` (${metrics.atrPct.toFixed(2)}%)` : ""}` : "—",
						hint: "변동성 단위 — 손절·목표가 폭 참고"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "52주 고점 대비",
						value: metrics.fromHigh52 != null ? formatPct(metrics.fromHigh52) : "—",
						tone: metrics.fromHigh52 != null && metrics.fromHigh52 < 0 ? "down" : void 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "52주 저점 대비",
						value: metrics.fromLow52 != null ? formatPct(metrics.fromLow52) : "—",
						tone: metrics.fromLow52 != null && metrics.fromLow52 > 0 ? "up" : void 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "추세 (일봉 MA)",
						value: metrics.maBias?.aboveMa20 == null ? "—" : [metrics.maBias.aboveMa20 ? "가≥MA20" : "가<MA20", metrics.maBias.ma20Above60 == null ? "" : metrics.maBias.ma20Above60 ? "· 정배열" : "· 역배열"].join(" "),
						hint: "종가 vs MA20, MA20 vs MA60"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "밸류·수급",
						value: [
							basic?.per ? `PER ${basic.per}` : null,
							basic?.pbr ? `PBR ${basic.pbr}` : null,
							basic?.foreignRate ? `외인 ${basic.foreignRate}` : null
						].filter(Boolean).join(" · ") || "—"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-start gap-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground leading-relaxed",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "size-3.5 shrink-0 mt-0.5 text-desk-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
						className: "text-foreground",
						children: "데스크 주의:"
					}),
					" 본 화면은 리서치·워크플로 도구이며 투자 권유·주문 실행이 아닙니다. 시세는 스냅샷/스트림 혼합, 차트 OHLC는 Yahoo·네이버 비공식 경로일 수 있습니다. 실주문 전 증권사 HTS/MTS 호가·잔량·VI를 재확인하세요.",
					stale && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("ml-1 font-semibold", colors.down),
						children: "데이터가 지연 중입니다 — 매매 판단 보류를 권고합니다."
					})
				] })]
			})
		]
	});
}
function Cell({ label, value, sub, emphasize, tone }) {
	const colors = usePriceColors();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "bg-card px-2.5 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[10px] text-muted-foreground",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("text-sm font-semibold tabular", emphasize && "text-base", tone === "up" && colors.up, tone === "down" && colors.down),
				children: value
			}),
			sub && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[10px] text-muted-foreground tabular",
				children: sub
			})
		]
	});
}
function Mini({ label, value, hint, hot, tone }) {
	const colors = usePriceColors();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("rounded-lg border border-border px-2.5 py-2", hot && "border-desk-gold/50 bg-desk-gold/5"),
		title: hint,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[10px] text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: cn("mt-0.5 text-xs font-semibold tabular leading-snug", tone === "up" && colors.up, tone === "down" && colors.down),
			children: value
		})]
	});
}
var METRICS = [
	{
		id: "per",
		label: "PER",
		unit: "배",
		help: "밴드 = EPS × 배수 (주가와 동일 축)"
	},
	{
		id: "pbr",
		label: "PBR",
		unit: "배",
		help: "밴드 = BPS × 배수"
	},
	{
		id: "psr",
		label: "PSR",
		unit: "배",
		help: "밴드 = SPS × 배수"
	}
];
function fundFor(metric, basis, basic) {
	if (!basic) return {
		fund: 0,
		currentMultiple: null,
		label: "—"
	};
	const price = basic.price ?? 0;
	if (metric === "per") {
		const fund = basis === "cns" ? basic.cnsEps ?? 0 : basic.eps ?? (basic.perNum && price ? price / basic.perNum : 0);
		const mult = basis === "cns" ? basic.cnsPer ?? (fund > 0 && price ? price / fund : null) : basic.perNum ?? (fund > 0 && price ? price / fund : null);
		return {
			fund,
			currentMultiple: mult && Number.isFinite(mult) ? mult : null,
			label: basis === "cns" ? "컨센서스 EPS" : basic.epsSource === "ttm-4q" ? "TTM EPS (최근 4분기 합)" : basic.epsSource === "naver-headline" ? "TTM EPS (네이버)" : basic.epsSource === "fy" ? "FY EPS (연간·TTM 아님)" : basic.epsSource === "implied" ? "암시 EPS (주가÷PER)" : "TTM EPS"
		};
	}
	if (metric === "pbr") {
		const fund = basic.bps ?? (basic.pbrNum && price ? price / basic.pbrNum : 0);
		return {
			fund,
			currentMultiple: basic.pbrNum ?? (fund > 0 && price ? price / fund : null),
			label: "BPS"
		};
	}
	const fund = basic.sps ?? 0;
	return {
		fund,
		currentMultiple: basic.psrNum ?? (fund > 0 && price ? price / fund : null),
		label: "SPS"
	};
}
function toTime(date) {
	return date.slice(0, 10);
}
function zoneOf(price, lo, mid, hi) {
	if (!(price > 0) || !(mid > 0)) return {
		label: "—",
		tone: "text-muted-foreground"
	};
	if (price < lo) return {
		label: "밴드 하단 이탈 · 상대 저평가 구간",
		tone: "text-desk-teal"
	};
	if (price > hi) return {
		label: "밴드 상단 이탈 · 상대 고평가 구간",
		tone: "text-desk-rose"
	};
	if (price < mid) return {
		label: "기준선 아래 · 할인 구간",
		tone: "text-desk-gold"
	};
	return {
		label: "기준선 위 · 할증 구간",
		tone: "text-desk-copper"
	};
}
/**
* Price vs user PER/PBR/PSR fair-value bands on one axis.
*/
function ValuationBandChart({ code, market, bars: barsProp, basic, loading: loadingProp }) {
	const [metric, setMetric] = (0, import_react.useState)("per");
	const [basis, setBasis] = (0, import_react.useState)("ttm");
	const [minStr, setMinStr] = (0, import_react.useState)("0.5");
	const [maxStr, setMaxStr] = (0, import_react.useState)("2");
	const [midStr, setMidStr] = (0, import_react.useState)("1");
	const seeded = (0, import_react.useRef)("");
	const own = useChartData({
		code: code ?? "",
		market: market ?? "KOSPI",
		interval: "day",
		range: "2y",
		enabled: !!code
	});
	const bars = (own.data?.bars?.length ? own.data.bars : null) ?? (barsProp.length > 0 ? barsProp : []);
	const loading = loadingProp || own.isLoading;
	const { fund, currentMultiple, label: fundLabel } = fundFor(metric, basis, basic);
	(0, import_react.useEffect)(() => {
		const key = `${metric}:${basis}`;
		if (currentMultiple == null || currentMultiple <= 0) return;
		if (seeded.current === key) return;
		seeded.current = key;
		if (metric === "per") {
			const mid = currentMultiple;
			setMidStr(mid.toFixed(1));
			setMinStr((mid * .6).toFixed(1));
			setMaxStr((mid * 1.4).toFixed(1));
		} else {
			const mid = currentMultiple;
			setMidStr(mid.toFixed(2));
			setMinStr(Math.max(.05, mid * .5).toFixed(2));
			setMaxStr((mid * 1.5).toFixed(2));
		}
	}, [
		metric,
		basis,
		currentMultiple
	]);
	const minM = Number(minStr);
	const maxM = Number(maxStr);
	const midM = Number(midStr);
	const loM = Number.isFinite(minM) && minM > 0 ? Math.min(minM, Number.isFinite(maxM) ? maxM : minM) : .5;
	const hiM = Number.isFinite(maxM) && maxM > 0 ? Math.max(maxM, Number.isFinite(minM) ? minM : maxM) : 2;
	const midUse = Number.isFinite(midM) && midM > 0 ? midM : 1;
	const wrapRef = (0, import_react.useRef)(null);
	const chartRef = (0, import_react.useRef)(null);
	const priceRef = (0, import_react.useRef)(null);
	const midRef = (0, import_react.useRef)(null);
	const upperRef = (0, import_react.useRef)(null);
	const lowerRef = (0, import_react.useRef)(null);
	const linesRef = (0, import_react.useRef)([]);
	const [chartApi, setChartApi] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const el = wrapRef.current;
		if (!el) return;
		const chart = createProChart(el, readChartTheme(), "KR");
		chart.applyOptions({
			rightPriceScale: { scaleMargins: {
				top: .08,
				bottom: .08
			} },
			timeScale: {
				rightOffset: 4,
				barSpacing: 6,
				timeVisible: false
			}
		});
		priceRef.current = chart.addSeries(ye, {
			color: "#22d3ee",
			lineWidth: 3,
			title: "주가",
			lastValueVisible: true,
			priceLineVisible: false,
			crosshairMarkerRadius: 5
		});
		midRef.current = chart.addSeries(ye, {
			color: "#facc15",
			lineWidth: 3,
			lineStyle: 0,
			title: "기준배수",
			lastValueVisible: true,
			priceLineVisible: false
		});
		upperRef.current = chart.addSeries(ye, {
			color: "#fb7185",
			lineWidth: 3,
			lineStyle: 2,
			title: "상단",
			lastValueVisible: true,
			priceLineVisible: false
		});
		lowerRef.current = chart.addSeries(ye, {
			color: "#c084fc",
			lineWidth: 3,
			lineStyle: 2,
			title: "하단",
			lastValueVisible: true,
			priceLineVisible: false
		});
		chartRef.current = chart;
		setChartApi(chart);
		return () => {
			setChartApi(null);
			chart.remove();
			chartRef.current = null;
			priceRef.current = null;
			midRef.current = null;
			upperRef.current = null;
			lowerRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (!priceRef.current || !midRef.current || !upperRef.current || !lowerRef.current) return;
		const priceData = bars.filter((b) => b.close > 0 && b.date).map((b) => ({
			time: toTime(b.date),
			value: b.close
		}));
		priceRef.current.setData(priceData);
		for (const pl of linesRef.current) try {
			priceRef.current.removePriceLine(pl);
		} catch {}
		linesRef.current = [];
		if (fund > 0 && priceData.length) {
			const times = priceData.map((d) => d.time);
			const midV = fund * midUse;
			const upV = fund * hiM;
			const loV = fund * loM;
			midRef.current.setData(times.map((time) => ({
				time,
				value: midV
			})));
			upperRef.current.setData(times.map((time) => ({
				time,
				value: upV
			})));
			lowerRef.current.setData(times.map((time) => ({
				time,
				value: loV
			})));
			const mk = (price, color, title, style) => {
				const pl = priceRef.current.createPriceLine({
					price,
					color,
					lineWidth: 2,
					lineStyle: style,
					axisLabelVisible: true,
					title
				});
				linesRef.current.push(pl);
			};
			mk(midV, "#facc15", `${midUse}×`, 0);
			mk(upV, "#fb7185", `상단 ${hiM}×`, 2);
			mk(loV, "#c084fc", `하단 ${loM}×`, 2);
		} else {
			midRef.current.setData([]);
			upperRef.current.setData([]);
			lowerRef.current.setData([]);
		}
		chartRef.current?.timeScale().fitContent();
	}, [
		bars,
		fund,
		loM,
		hiM,
		midUse,
		metric,
		basis
	]);
	const lastClose = (0, import_react.useMemo)(() => {
		for (let i = bars.length - 1; i >= 0; i--) if (bars[i].close > 0) return bars[i].close;
		return basic?.price ?? 0;
	}, [bars, basic?.price]);
	const midPrice = fund > 0 ? fund * midUse : null;
	const upPrice = fund > 0 ? fund * hiM : null;
	const loPrice = fund > 0 ? fund * loM : null;
	const zone = zoneOf(lastClose, loPrice ?? 0, midPrice ?? 0, upPrice ?? 0);
	const vsMid = midPrice && lastClose ? (lastClose / midPrice - 1) * 100 : null;
	const vsHi = upPrice && lastClose ? (lastClose / upPrice - 1) * 100 : null;
	const rangeStats = (0, import_react.useMemo)(() => computeRangePosition(bars, { close: lastClose }), [bars, lastClose]);
	const { legend, hud } = useChartChrome(chartApi, [
		{
			id: "price",
			label: "주가",
			color: "#22d3ee",
			api: priceRef.current,
			format: (v) => formatPrice(Math.round(v))
		},
		{
			id: "mid",
			label: `기준 ${midUse}×`,
			color: "#facc15",
			api: midRef.current,
			format: (v) => formatPrice(Math.round(v))
		},
		{
			id: "upper",
			label: `상단 ${hiM}×`,
			color: "#fb7185",
			api: upperRef.current,
			format: (v) => formatPrice(Math.round(v))
		},
		{
			id: "lower",
			label: `하단 ${loM}×`,
			color: "#c084fc",
			api: lowerRef.current,
			format: (v) => formatPrice(Math.round(v))
		}
	]);
	const csvRows = (0, import_react.useMemo)(() => bars.filter((b) => b.close > 0 && b.date).map((b) => ({
		time: b.date.slice(0, 10),
		close: b.close
	})), [bars]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "desk-card desk-card-gold overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-start justify-between gap-3 border-b border-border px-3 py-2.5 md:px-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "text-base font-semibold flex items-center gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartLine, { className: "size-4 text-desk-gold" }), "밸류에이션 밴드"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-0.5 text-xs text-muted-foreground",
						children: [
							"주가와 ",
							METRICS.find((m) => m.id === metric)?.label,
							" 공정가치 밴드를 같은 가격축에 겹침 ·",
							" ",
							METRICS.find((m) => m.id === metric)?.help
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-end gap-2",
					children: [
						metric === "per" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex gap-0.5 rounded-md bg-muted p-0.5",
							children: [["ttm", "TTM"], ["cns", "컨센서스"]].map(([id, lab]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setBasis(id),
								className: cn("rounded px-2.5 py-1.5 text-xs font-semibold min-h-8", basis === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"),
								children: lab
							}, id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex gap-0.5 rounded-md bg-muted p-0.5",
							children: METRICS.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setMetric(m.id),
								className: cn("rounded px-2.5 py-1.5 text-xs font-semibold min-h-8", metric === m.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"),
								children: m.label
							}, m.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-end gap-1.5 rounded-lg border border-border bg-card/80 px-2 py-1.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex flex-col gap-0.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] text-muted-foreground",
										children: "기준(배)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.1",
										min: "0.01",
										value: midStr,
										onChange: (e) => setMidStr(e.target.value),
										className: "w-16 rounded border-2 border-yellow-400/60 bg-background px-1.5 py-1 text-xs tabular font-bold text-yellow-300"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex flex-col gap-0.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] text-muted-foreground",
										children: "최소(배)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.1",
										min: "0.01",
										value: minStr,
										onChange: (e) => setMinStr(e.target.value),
										className: "w-16 rounded border-2 border-violet-400/60 bg-background px-1.5 py-1 text-xs tabular font-bold text-violet-300"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex flex-col gap-0.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] text-muted-foreground",
										children: "최대(배)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.1",
										min: "0.01",
										value: maxStr,
										onChange: (e) => setMaxStr(e.target.value),
										className: "w-16 rounded border-2 border-rose-400/60 bg-background px-1.5 py-1 text-xs tabular font-bold text-rose-300"
									})]
								})
							]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 border-b border-border px-3 py-2.5 md:px-4 text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-muted-foreground",
							children: fundLabel
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-semibold tabular",
							children: fund !== 0 ? formatPrice(Math.round(fund)) : "—"
						}),
						metric === "per" && basis === "ttm" && basic?.ttmQuarters?.length === 4 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[10px] text-muted-foreground tabular",
							children: basic.ttmQuarters.slice().reverse().map((k) => `${k.slice(0, 4)}.${k.slice(4)}`).join(" + ")
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-muted-foreground",
						children: ["현재 ", METRICS.find((m) => m.id === metric)?.label]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-semibold tabular",
						children: currentMultiple != null ? `${currentMultiple.toFixed(2)}배` : "—"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-muted-foreground",
						children: [
							"하단 ",
							loM,
							"×"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-bold tabular text-violet-300",
						children: loPrice != null ? formatPrice(Math.round(loPrice)) : "—"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-muted-foreground",
						children: [
							"기준 ",
							midUse,
							"× / 상단 ",
							hiM,
							"×"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "font-semibold tabular",
						children: [midPrice != null ? formatPrice(Math.round(midPrice)) : "—", upPrice != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-rose-300 ml-1",
							children: ["/ ", formatPrice(Math.round(upPrice))]
						})]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-muted-foreground",
						children: "기준선 대비"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-semibold tabular",
						children: vsMid == null ? "—" : `${vsMid >= 0 ? "+" : ""}${vsMid.toFixed(1)}%`
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-muted-foreground",
						children: "상단까지"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cn("font-semibold tabular", zone.tone),
						children: vsHi == null ? "—" : `${vsHi >= 0 ? "+" : ""}${vsHi.toFixed(1)}%`
					})] })
				]
			}),
			fund > 0 && lastClose > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("px-3 py-2 text-xs font-medium border-b border-border", zone.tone),
				children: [zone.label, vsMid != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-muted-foreground font-normal",
					children: [
						" ",
						"· 주가 ",
						formatPrice(lastClose),
						" vs 기준 ",
						formatPrice(Math.round(midPrice ?? 0))
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RangePositionStrip, {
				stats: rangeStats,
				compact: true,
				caption: "주가 차트 구간 기준 · 기간 고/저는 절대 최고·최저, 최근 고/저는 확인된 스윙."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ChartShell, {
				title: `${METRICS.find((m) => m.id === metric)?.label} 밴드 · ${fundLabel}`,
				toolbar: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RangePresets, {
					chart: chartApi,
					first: csvRows[0]?.time,
					last: csvRows.at(-1)?.time
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScaleToggle, {
					chart: chartApi,
					allowed: ["normal", "log"]
				})] }),
				hud,
				legend,
				status: bars.length ? {
					source: own.data?.source ? `${own.data.source} · 펀더멘털 네이버` : "Yahoo/네이버 · 펀더멘털 네이버",
					mode: `일봉 종가 · 밴드 = ${fundLabel} × 배수`,
					updatedAt: own.dataUpdatedAt || null
				} : null,
				onExportPng: bars.length ? () => exportChartPng(chartApi, "KR", code ?? "", `band-${metric}`) : void 0,
				onExportCsv: bars.length ? () => exportRowsCsv(chartApi, csvRows, [
					{
						name: "close",
						get: (r) => r.close
					},
					{
						name: `mid_${midUse}x`,
						get: () => fund > 0 ? Math.round(fund * midUse) : null
					},
					{
						name: `upper_${hiM}x`,
						get: () => fund > 0 ? Math.round(fund * hiM) : null
					},
					{
						name: `lower_${loM}x`,
						get: () => fund > 0 ? Math.round(fund * loM) : null
					}
				], "KR", code ?? "", `band-${metric}`) : void 0,
				height: 340,
				testId: "valuation-band-chart",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						ref: wrapRef,
						className: "absolute inset-0"
					}),
					loading && bars.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-card/70",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin mr-2" }), " 차트 로딩…"]
					}),
					!loading && bars.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-0 flex items-center justify-center text-sm text-muted-foreground",
						children: "가격 데이터 없음"
					}),
					bars.length > 0 && fund <= 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground",
						children: metric === "per" ? "EPS를 아직 읽지 못했습니다. PBR로 전환하거나 잠시 후 새로고침하세요." : `${fundLabel}가 없어 밴드를 계산할 수 없습니다.`
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-t border-border px-3 py-2 text-[11px] text-muted-foreground leading-relaxed",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold text-sky-300",
						children: "시안 실선"
					}),
					" = 종가 ·",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold text-yellow-300",
						children: "노란 실선"
					}),
					" = 기준 배수(",
					midUse,
					"×) ·",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold text-rose-300",
						children: "로즈 점선"
					}),
					" = 최대 ·",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold text-violet-300",
						children: "보라 점선"
					}),
					" = 최소. PER은 최근 4개 보고 분기 EPS 합(TTM) 또는 컨센서스. 배수는 오른쪽 위 칸에서 입력. 분기 합이 없으면 네이버 헤드라인 → 연간 EPS → 주가÷PER 순으로 대체하며 라벨에 출처를 표시합니다. 투자 권유가 아닙니다."
				]
			})
		]
	});
}
function StockPage() {
	const { ticker } = Route$3.useParams();
	const code = normalizeKrTicker(ticker);
	const validStock = isDigitTicker(code);
	const uni = getUniverseItem(code);
	const [lastHit, setLastHit] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		try {
			const raw = JSON.parse(sessionStorage.getItem("kx-last-security") ?? "null");
			if (raw && raw.code === code) setLastHit(raw);
		} catch {
			setLastHit(null);
		}
	}, [code]);
	const { data, isLoading, isError, dataUpdatedAt } = useStockBundle(code);
	const liveStatus = useMarketStream(validStock ? [code] : []);
	const quote = data && "quote" in data ? data.quote : null;
	const basic = data && "basic" in data ? data.basic : null;
	const flow = data && "flow" in data ? data.flow : null;
	const research = data && "research" in data ? data.research : [];
	const researchPack = data && "researchPack" in data ? data.researchPack : void 0;
	const news = data && "news" in data ? data.news : [];
	const disclosures = data && "disclosures" in data ? data.disclosures : [];
	const serverMeta = data && "meta" in data ? data.meta : null;
	const liveName = serverMeta?.nameKo ?? uni?.nameKo ?? quote?.nameKo ?? lastHit?.nameKo ?? basic?.stockName ?? code;
	const meta = {
		code,
		nameKo: liveName,
		nameEn: serverMeta?.nameEn ?? uni?.nameEn ?? quote?.nameEn ?? lastHit?.nameKo ?? code,
		sectorId: serverMeta?.sectorId ?? uni?.sectorId ?? lastHit?.sectorId ?? inferSectorId(liveName),
		market: detectKrMarket(serverMeta?.market, uni?.market, quote?.market, lastHit?.market, basic?.stockExchangeName)
	};
	const dayChart = useChartData({
		code,
		market: meta.market,
		interval: "day",
		range: "2y",
		enabled: validStock
	});
	if (shouldRouteToEtf(code, liveName, lastHit?.isEtf)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, {
		to: "/etfs/$code",
		params: { code },
		replace: true
	});
	if (!validStock) throw notFound();
	const sector = SECTOR_BY_ID[meta.sectorId];
	const price = quote?.price ?? 0;
	const high52 = quote?.high52 || basic?.high52 || 0;
	const low52 = quote?.low52 || basic?.low52 || 0;
	const rangePos = high52 > low52 ? (price - low52) / (high52 - low52) * 100 : 50;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
				className: "flex flex-wrap items-center gap-1 text-xs text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "hover:text-foreground",
						children: "대시보드"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3" }),
					sector && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/industry/$sectorId",
						params: { sectorId: sector.id },
						className: "hover:text-foreground",
						children: sector.nameKo
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3" })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-foreground font-medium",
						children: meta.nameKo
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "identity-grid page-header",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start gap-2.5 min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WatchButton, {
						code: meta.code,
						size: "icon"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-baseline gap-x-2 gap-y-0.5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
										className: "text-2xl font-bold tracking-tight md:text-3xl lg:text-4xl leading-tight",
										children: meta.nameKo
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-sm text-muted-foreground tabular font-medium",
										children: meta.code
									}),
									isLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3 animate-spin" }), " 시세"]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										variant: "market",
										className: "text-xs font-semibold",
										children: meta.market === "KOSDAQ" ? "코스닥" : "코스피"
									}),
									sector ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/industry/$sectorId",
										params: { sectorId: sector.id },
										className: "font-medium text-foreground/90 hover:underline",
										children: sector.nameKo
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground",
										children: "산업 —"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground",
										children: "·"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "tabular font-semibold",
										children: [
											"PER",
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-desk-gold",
												children: basic?.per ? `${basic.per}${/배$/.test(basic.per) ? "" : "배"}` : basic?.perNum ? `${basic.perNum.toFixed(2)}배` : "—"
											})
										]
									}),
									basic?.pbr && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground",
										children: "·"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "tabular text-muted-foreground text-xs",
										children: [
											"PBR ",
											basic.pbr,
											/배$/.test(basic.pbr) ? "" : "배"
										]
									})] })
								]
							}),
							meta.nameEn && meta.nameEn !== meta.nameKo && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: meta.nameEn
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-[10px] text-muted-foreground",
								children: DATA_LABEL
							})
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-left sm:text-right",
					children: quote ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriceValue, {
							value: quote.price,
							changePct: quote.changePct,
							size: "lg"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-0.5 flex sm:justify-end",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriceChange, {
								change: quote.change,
								changePct: quote.changePct,
								size: "md"
							})
						}),
						quote.afterHoursPrice != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-[11px] text-muted-foreground tabular",
							children: [
								"시간외 ",
								formatPrice(quote.afterHoursPrice),
								quote.afterHoursChangePct != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									" ",
									"(",
									quote.afterHoursChangePct >= 0 ? "+" : "",
									quote.afterHoursChangePct.toFixed(2),
									"%)"
								] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-[10px] text-muted-foreground",
							children: [
								quote.marketStatus || "시세",
								" · ",
								liveStatus.connected || quote.source === "kis-krx-websocket" ? "KIS·KRX 실시간" : liveStatus.enabled && liveStatus.reconnecting ? "재연결 중 · 네이버 스냅샷" : "네이버 스냅샷",
								dataUpdatedAt ? ` · ${new Date(dataUpdatedAt).toLocaleTimeString("ko-KR")}` : ""
							]
						})
					] }) : isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-price-down",
						children: "시세 조회 실패"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "시세 로딩…"
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TradeDeskStrip, {
				quote,
				basic,
				dayBars: dayChart.data?.bars,
				liveConnected: liveStatus.connected || quote?.source === "kis-krx-websocket",
				dataUpdatedAt,
				chartSource: dayChart.data?.source
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TradingChart, {
				code: meta.code,
				market: meta.market,
				name: meta.nameKo,
				eventMarkers: (disclosures ?? []).slice(0, 40).map((d) => ({
					time: d.datetime?.slice(0, 10) ?? "",
					title: d.title
				})),
				researchMarkers: researchTpMarkers(research ?? [])
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ValuationBandChart, {
				code: meta.code,
				market: meta.market,
				bars: dayChart.data?.bars ?? [],
				basic,
				loading: isLoading || dayChart.isLoading
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InvestorFlow, {
				days: flow?.days ?? [],
				source: flow?.source,
				loading: isLoading
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrokerReports, {
				pack: researchPack,
				companyReports: research ?? [],
				currentPrice: price,
				loading: isLoading
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-6 lg:grid-cols-12",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "lg:col-span-8 flex flex-col gap-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "grid grid-cols-2 sm:grid-cols-4 gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "거래량",
									value: quote ? formatVolume(quote.volume) : "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "시가총액",
									value: basic?.marketCapLabel || (quote?.marketCap ? formatMarketCap(quote.marketCap) : "—")
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "52주 최고",
									value: high52 ? formatPrice(high52) : "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "52주 최저",
									value: low52 ? formatPrice(low52) : "—"
								})
							]
						}),
						basic && (basic.per || basic.pbr || basic.psr || basic.foreignRate) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "grid grid-cols-2 sm:grid-cols-4 gap-2",
							children: [
								basic.per && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "PER",
									value: /배$/.test(basic.per) ? basic.per : `${basic.per}배`
								}),
								basic.pbr && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "PBR",
									value: /배$/.test(basic.pbr) ? basic.pbr : `${basic.pbr}배`
								}),
								basic.psr && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "PSR",
									value: /배$/.test(basic.psr) ? basic.psr : `${basic.psr}배`
								}),
								basic.foreignRate && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "외인소진율",
									value: basic.foreignRate
								})
							]
						}),
						high52 > 0 && low52 > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "rounded-xl border border-border bg-card p-3 md:p-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mb-3 text-sm font-semibold",
								children: "52주 범위"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3 text-xs tabular",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground w-16 shrink-0",
										children: formatPrice(low52)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "relative h-1.5 flex-1 rounded-full bg-muted",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "absolute top-1/2 size-3 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-background bg-foreground",
											style: { left: `${Math.min(100, Math.max(0, rangePos))}%` }
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground w-16 shrink-0 text-right",
										children: formatPrice(high52)
									})
								]
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "lg:col-span-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveNews, {
						news: news ?? [],
						disclosures: disclosures ?? [],
						title: `${meta.nameKo}`,
						code: meta.code
					})
				})]
			})
		]
	});
}
function Stat({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border bg-card px-3 py-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[11px] text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-0.5 text-sm font-semibold tabular",
			children: value
		})]
	});
}
/**
* F7.10 research overlay: target-price changes only where the prior
* same-broker target was actually fetched (annotated rows); otherwise a
* plain "리포트" marker with the rating.
*/
function researchTpMarkers(reports) {
	return annotatePrevTargets(reports).slice(0, 40).filter((r) => /^\d{4}-\d{2}-\d{2}/.test(r.date)).map((r) => {
		const up = r.targetPrice != null && r.prevTargetPrice != null && r.targetPrice > r.prevTargetPrice;
		const down = r.targetPrice != null && r.prevTargetPrice != null && r.targetPrice < r.prevTargetPrice;
		return {
			time: r.date.slice(0, 10),
			text: up ? `TP↑ ${r.broker}` : down ? `TP↓ ${r.broker}` : `리포트 ${r.broker}`,
			position: "belowBar",
			shape: up ? "arrowUp" : down ? "arrowDown" : "square",
			color: up ? "#2dd4bf" : down ? "#fb7185" : "#94a3b8"
		};
	});
}
//#endregion
export { StockPage as component };
