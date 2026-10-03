import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { l as Trash2, r as Volume2 } from "../_libs/lucide-react.mjs";
import { It as useAppStore, Nt as Input, U as useWireStore, V as beep, et as TimeStamp, f as DesktopAlertsButton, v as Switch } from "./router-B1V8nj-n.mjs";
import { t as PageDisclaimer } from "./PageDisclaimer-Dk4wCTj5.mjs";
import { t as PageHeader } from "./PageHeader-aQOrmONW.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.alerts-BOrmt7DD.js
var import_jsx_runtime = require_jsx_runtime();
var CATEGORY_LABEL = {
	news: "뉴스",
	disclosure: "공시",
	research: "리서치",
	policy: "정책",
	filing: "SEC 공시",
	rating: "등급 변경",
	etf: "ETF",
	robotics: "로봇"
};
var TIER_OPTIONS = [
	{
		value: "flash",
		label: "FLASH만 (80+)"
	},
	{
		value: "high",
		label: "HIGH 이상 (60+)"
	},
	{
		value: "normal",
		label: "전체"
	}
];
function Row({ label, hint, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center justify-between gap-2 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[13px] font-medium",
				children: label
			}), hint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[11px] text-muted-foreground",
				children: hint
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex shrink-0 items-center gap-2",
			children
		})]
	});
}
function Card({ title, children, testId }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card px-3 py-2 md:px-4",
		"data-testid": testId,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "border-b border-border py-2 text-sm font-semibold",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "divide-y divide-border",
			children
		})]
	});
}
function TierSelect({ value, onChange, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
		value,
		onChange: (e) => onChange(e.target.value),
		className: "h-9 rounded-md border border-border bg-background px-2 text-xs",
		"aria-label": label,
		children: TIER_OPTIONS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: o.value,
			children: o.label
		}, o.value))
	});
}
function AlertSettingsPage() {
	const s = useAppStore((st) => st.alertSettings);
	const set = useAppStore((st) => st.setAlertSettings);
	const removePriceAlert = useAppStore((st) => st.removePriceAlert);
	const openWire = useWireStore((st) => st.setDrawerOpen);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				kicker: "Live Wire · 알림",
				title: "알림 설정",
				lead: "Live Wire의 앱 내 알림, 데스크톱 알림, 방해 금지 시간, 지역·종류별 알림을 설정합니다. 설정은 이 브라우저에만 저장됩니다.",
				aside: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => openWire(true),
					className: "inline-flex min-h-9 items-center rounded-md border border-border px-2 text-[11px] font-semibold hover:bg-muted/50",
					children: "Live Wire 열기"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageDisclaimer, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 lg:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						title: "앱 내 알림 (토스트)",
						testId: "alerts-inapp",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								label: "앱 내 알림",
								hint: "화면을 보고 있을 때 오른쪽 아래에 표시",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: s.inAppEnabled,
									onCheckedChange: (v) => set({ inAppEnabled: v }),
									"aria-label": "앱 내 알림"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								label: "최소 중요도",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TierSelect, {
									value: s.inAppMinTier,
									onChange: (v) => set({ inAppMinTier: v }),
									label: "앱 내 알림 최소 중요도"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								label: "일시정지",
								hint: "수신과 알림을 멈춥니다 (Live Wire 드로어에서도 가능)",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: s.paused,
									onCheckedChange: (v) => set({ paused: v }),
									"aria-label": "일시정지"
								})
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						title: "데스크톱 알림 (OS)",
						testId: "alerts-os",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								label: "권한",
								hint: "브라우저 권한 요청은 이 버튼을 누를 때만 합니다. 페이지를 열 때 묻지 않습니다.",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DesktopAlertsButton, {})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								label: "데스크톱 알림 사용",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: s.osEnabled,
									onCheckedChange: (v) => set({ osEnabled: v }),
									"aria-label": "데스크톱 알림 사용"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								label: "최소 중요도",
								hint: "기본값: FLASH만",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TierSelect, {
									value: s.osMinTier,
									onChange: (v) => set({ osMinTier: v }),
									label: "데스크톱 알림 최소 중요도"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								label: "관심종목·키워드 일치는 항상 알림",
								hint: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/watchlist",
									className: "text-primary hover:underline",
									children: "관심종목·키워드 관리 →"
								}),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: s.osWatchMatches,
									onCheckedChange: (v) => set({ osWatchMatches: v }),
									"aria-label": "관심종목 일치 알림"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								label: "속도 제한",
								hint: "10분에 최대 5건, 넘치면 묶음 알림 1건 (변경 불가)",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[11px] text-muted-foreground",
									children: "5건 / 10분"
								})
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						title: "방해 금지 시간 (KST)",
						testId: "alerts-quiet",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							label: "방해 금지 사용",
							hint: "이 시간에는 데스크톱 알림과 소리를 끕니다. 배지 숫자는 계속 갱신됩니다.",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
								checked: s.quietHours.enabled,
								onCheckedChange: (v) => set({ quietHours: {
									...s.quietHours,
									enabled: v
								} }),
								"aria-label": "방해 금지 사용"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, {
							label: "시간",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "time",
									value: s.quietHours.start,
									onChange: (e) => set({ quietHours: {
										...s.quietHours,
										start: e.target.value
									} }),
									className: "h-9 w-28 text-xs",
									"aria-label": "시작"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted-foreground",
									children: "~"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "time",
									value: s.quietHours.end,
									onChange: (e) => set({ quietHours: {
										...s.quietHours,
										end: e.target.value
									} }),
									className: "h-9 w-28 text-xs",
									"aria-label": "종료"
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						title: "지역 · 종류",
						testId: "alerts-scope",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								label: "한국",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: s.regions.KR,
									onCheckedChange: (v) => set({ regions: {
										...s.regions,
										KR: v
									} }),
									"aria-label": "한국 알림"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								label: "미국",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: s.regions.US,
									onCheckedChange: (v) => set({ regions: {
										...s.regions,
										US: v
									} }),
									"aria-label": "미국 알림"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-2 gap-x-4 py-1 sm:grid-cols-4",
								children: Object.keys(CATEGORY_LABEL).map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex min-h-10 items-center justify-between gap-2 text-[12px]",
									children: [CATEGORY_LABEL[k], /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
										checked: s.categories[k],
										onCheckedChange: (v) => set({ categories: {
											...s.categories,
											[k]: v
										} }),
										"aria-label": `${CATEGORY_LABEL[k]} 알림`
									})]
								}, k))
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						title: "소리 · 화면",
						testId: "alerts-misc",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, {
							label: "알림 소리",
							hint: "짧은 비프음 (기본 꺼짐)",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: beep,
								className: "inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-[11px] hover:bg-muted/50",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-3" }), " 미리 듣기"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
								checked: s.sound,
								onCheckedChange: (v) => set({ sound: v }),
								"aria-label": "알림 소리"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							label: "하단 티커 (데스크톱)",
							hint: "HIGH 이상 항목을 화면 아래에 흘려 보여줍니다 (기본 꺼짐)",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
								checked: s.tickerTape,
								onCheckedChange: (v) => set({ tickerTape: v }),
								"aria-label": "하단 티커"
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						title: "차트 가격 알림",
						testId: "alerts-price",
						children: s.priceAlerts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "py-3 text-[12px] text-muted-foreground",
							children: "차트에서 수평선 가격 알림을 추가하면 여기에 표시됩니다."
						}) : s.priceAlerts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							label: `${a.name ?? a.code} · ${a.level?.toLocaleString("ko-KR") ?? "—"} ${a.direction === "up" ? "상향 돌파" : a.direction === "down" ? "하향 돌파" : "돌파"}`,
							hint: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								a.repeat === "once" ? "한 번" : "매번",
								" · ",
								a.active ? "대기 중" : "완료",
								a.lastFiredAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									" ",
									"· 마지막 ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeStamp, {
										publishedAt: a.lastFiredAt,
										precision: "second"
									})
								] }) : null
							] }),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => removePriceAlert(a.id),
								className: "inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground hover:text-foreground",
								"aria-label": "가격 알림 삭제",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3" }), " 삭제"]
							})
						}, a.id))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] leading-relaxed text-muted-foreground",
				children: "알림은 이 앱을 연 브라우저 탭이 있을 때만 동작합니다(탭 하나가 대표로 수신). 브라우저를 닫은 상태의 푸시 알림(Web Push)은 VAPID 키·구독 저장소·스케줄러가 필요해 향후 과제로 남겨 두었습니다."
			})
		]
	});
}
//#endregion
export { AlertSettingsPage as component };
