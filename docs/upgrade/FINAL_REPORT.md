# 최종 보고서 — Korea Equity Command Center v3 업그레이드

- 기준 커밋: `7c154f5` ("Export from Grok")
- 작업 브랜치: `claude/new-session-mz0027` (세션 지정 브랜치 — 스펙의 `feat/v3-briefings-robotics-procharts` 대신 사용, 아래 "편차" 참조)
- 작업 모드: **OFFLINE-BUILD** — 이 작업 환경의 네트워크 정책이 시세·뉴스 호스트를 모두 차단했습니다(프록시 `host_not_allowed`). 모든 소스는 `미검증` 상태로 두었고, 파서는 문서화된 형식과 합성 픽스처로 검증했습니다. 화면은 데이터가 없을 때 `—`와 사유(`소스 미검증` 등)를 표시합니다.
- 투자 권유 아님: 모든 새 페이지에 `RISK_DISCLAIMER`를 표시합니다.

## 1. F1–F10 요약

| 기능 | 상태 | 핵심 파일 | 비고 |
|---|---|---|---|
| F1 한국 뉴스 브리핑 `/news/kr` | 완료 | `src/routes/news.kr.tsx`, `src/routes/api.feed.ts`, `src/server/feeds/{registry,http,runner,aggregate}.ts`, `src/server/feeds/adapters/news.ts`, `src/lib/feed/*` | 최신순 커널(`compareNewestFirst`), 지수·환율 타일, KRX 장 상태, 다이제스트, 네이버 AI 브리핑 카드, 소스 상태 칩. F1.6 한국 일정 스트립은 검증 가능한 소스가 없어 생략 |
| F2 한국 리서치 `/research` | 완료 (일부 대체) | `src/components/research/{KrResearchDesk,ResearchCard,ResearchDetailSheet}.tsx`, `src/server/research-v2.ts`, `src/lib/research/naver-v2.ts` | v2 7개 탭 + 관심종목, 날짜 머리글, 총건수, 더 보기, 목표가 상·하향/주간 인기/신규 커버리지, Δ%는 같은 증권사·종목 이전 리포트를 실제로 받은 경우만. F2.9 산업 필터는 `industryTypes` 미검증으로 고정 분류 사용 |
| F3 미국 뉴스 `/news/us` | 완료 | `src/routes/news.us.tsx`, `src/server/feeds/snapshot.ts`, `src/components/feed/TzToggle.tsx` | Yahoo 지연 타일 11종, 뉴욕 세션 추정, KST/ET 토글, 연준·BEA 7일 일정, Bloomberg 헤드라인 전용(`유료`) + 서킷 브레이커 + GN 대체. F3.7 실적 일정(COULD)은 Nasdaq JSON 미검증으로 미구현 |
| F4 미국 리서치 | 완료 | `src/routes/research.tsx`(`?market=us`), `src/components/research/{UsResearchBriefing,UsResearchKit}.tsx`, `src/lib/us-street.ts`, `/us-research` | OFFICIAL/PUBLIC/STREET/NEWS 등급 배지, Street Moves 표 + 보이는 행 CSV, 공식 원문 기간 필터. PUBLIC_RESEARCH 레지스트리는 오프라인 검증 불가로 비어 있음 |
| F5 국내 ETF 뉴스 `/news/etf` + `/etfs` 탭 | 완료 | `src/routes/news.etf.tsx`, `src/components/etf/EtfNewsDesk.tsx`, `src/lib/etf-news.ts`, `src/routes/etfs.index.tsx` | 단계/운용사/테마/퇴직연금 필터, ETF 매칭(코드·가격·거래량 → `/etfs/$code`), 상장·상장폐지·자금 흐름·퇴직연금 목록. "상장 예정 14일"은 기사 발행일 기준(기계 판독 가능한 상장일이 없음) |
| F6 로봇 `/robotics` | 완료 (일부 대체) | `src/routes/robotics.tsx`, `src/server/robotics.ts`, `src/lib/robotics/classify.ts`, `src/data/robotics.ts` | 6개 탭, 유니버스 런타임 검증(미확인 종목 숨김 + 소스 상태에 표시), 동일가중 바스켓, 정책(Federal Register 필터), 대시보드 카드. F6.5 미국 시가총액은 검증된 무키 소스가 없어 `—`, F6.7 한경 로봇 리서치 별도 분리 없음 |
| F7 프로 차트 | 완료 (COULD 1건 제외) | `src/components/charts/{core,pro}/*`, `src/lib/charts/*`, `src/lib/chart-indicators.ts`, `src/components/stocks/TradingChart.tsx`, `src/routes/chart.tsx` | lightweight-charts v5만 사용. 7종 차트, 4종 스케일, 지표 카탈로그(신규 18종), 그리기 15종 + 잠금/숨김/실행 취소, 비교 ≤ 3, 리플레이, 1/2/4 분할 워크스페이스, PNG/CSV, Tier B/C 공통 크롬. F7.18 TradingView 위젯 탭(COULD) 미구현. F7.11 알림은 차트 데이터 갱신 시 평가 |
| F8 Live Wire | 완료 | `src/routes/api.wire.ts`, `src/lib/wire/*`, `src/components/wire/LiveWire.tsx`, `src/routes/settings.alerts.tsx`, `src/routes/api.market-stream.ts` | Web Locks 리더 탭만 폴링, BroadcastChannel 공유, 토스트 ≤ 5건/10분 + 요약 1건, OS 알림은 버튼 클릭 후 권한 요청, KST 방해 금지 시간, SSE 240초 선제 종료 + `재연결 중`. Web Push(브라우저 종료 상태 알림)는 범위 밖 |
| F9 선택 AI 레이어 | 완료 (기본 꺼짐) | `src/lib/ai/{briefing,config}.ts`, `src/server/ai/{provider,service}.ts`, `src/lib/ai-fns.ts`, `src/components/ai/AiBriefingPanel.tsx` | 서버 env가 모두 설정된 경우에만 버튼 노출. 사용자 클릭 시 화면 항목 ≤ 30건만 사용, `[n]` 인용 없는 문장 거부·입력에 없는 URL 제거, 15분 캐시, 일일 상한, 토큰 표시, 라벨 `AI 요약 · 원문 확인 필요`, 영문 제목 `기계 번역`. anthropic(공식 SDK) + xai 어댑터, 모델은 `AI_MODEL`에서만. 실제 공급자 호출은 키·네트워크가 없어 실행하지 않았고, UI는 모킹으로 검증 |
| F10 내비게이션·스토어·대시보드 | 완료 | `src/components/layout/Sidebar.tsx`, `src/lib/store.ts`, `src/lib/store-migrate.ts`, `src/components/dashboard/{Dashboard,BriefCards}.tsx` | 한국/미국/테마/도구 그룹 사이드바, `/news` → `/news/kr`, 스토어 `version: 2` + 마이그레이션 테스트, 대시보드 카드 4종(Live Wire 최신 5 · 오늘의 리서치 · 미국 스냅샷 · 로봇 스냅샷)을 첫 페인트 뒤(`deferSecondary`) 로드 |

## 2. 소스 표 (`SOURCES_STATUS.md` 기준)

`npm run verify:sources` (2026-09-26 12:53 UTC): 64개 프로브 → 64개 `blocked`, 4개 `skipped`. **검증(verified) 0 · 미검증·활성 53 (그중 Bloomberg 후보 5) · 비활성 후보 15, 총 68.** 차단 사유는 모두 이 작업 환경의 egress 프록시이며, 원본 서버가 거부한 것이 아닙니다. 일반 인터넷에서 다시 실행하면 대부분 판정이 바뀔 것으로 예상합니다.

| id | 이름 | 상태 | 사유 |
|---|---|---|---|
| `naver-flash` | 네이버 증권 속보 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-main` | 네이버 증권 주요뉴스 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-focus-401` | 네이버 포커스 · 시황·전망 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-focus-402` | 네이버 포커스 · 기업·종목분석 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-focus-403` | 네이버 포커스 · 해외증시 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-focus-404` | 네이버 포커스 · 채권·선물 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-focus-406` | 네이버 포커스 · 공시·메모 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-focus-429` | 네이버 포커스 · 환율 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-news-search-etf` | 네이버 뉴스 검색 · ETF | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-worldnews` | 네이버 해외뉴스 (Reuters) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-ai-briefing` | 네이버페이 증권 AI 시장 브리핑 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-market-status` | 네이버 · KRX/NXT 장 상태 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-research-v2` | 네이버 리서치 v2 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-research-goal` | 네이버 리서치 · 목표주가 변경 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-research-weekly` | 네이버 리서치 · 주간 인기 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-research-legacy` | 네이버 리서치 (모바일 레거시) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-industry-html` | 네이버 산업분석 목록 (HTML) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `hankyung-consensus-legacy` | 한경 컨센서스 (레거시) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `hankyung-consensus-new` | 한경 컨센서스 (신규) | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `hankyung-finance` | 한국경제 증권 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `hankyung-economy` | 한국경제 경제 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `hankyung-international` | 한국경제 국제 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `hankyung-it` | 한국경제 IT | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `yonhap-market` | 연합뉴스 마켓+ | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `yonhap-economy` | 연합뉴스 경제 | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `mk-rss` | 매일경제 증권 | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `gn-kr-market` | Google 뉴스 (한국 증시) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `krx-disclosures` | KRX·DART 주요 공시 | 미검증 · 활성 | 프로브 생략: 기존 공시 모듈을 거치는 빌더형 소스(단일 프로브 URL 없음) |
| `kis-news-title` | KIS 종합 시황/공시 제목 | 미검증 · 활성 | 프로브 생략: 토큰 발급이 필요한 소스 — `KIS_APP_KEY`/`KIS_APP_SECRET` 없으면 비활성 |
| `bloomberg-markets` | Bloomberg Markets | 후보 · 활성 (F3.1 MUST: 킬 스위치·서킷 브레이커·GN 대체) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `bloomberg-economics` | Bloomberg Economics | 후보 · 활성 (F3.1 MUST: 킬 스위치·서킷 브레이커·GN 대체) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `bloomberg-technology` | Bloomberg Technology | 후보 · 활성 (F3.1 MUST: 킬 스위치·서킷 브레이커·GN 대체) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `bloomberg-politics` | Bloomberg Politics | 후보 · 활성 (F3.1 MUST: 킬 스위치·서킷 브레이커·GN 대체) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `bloomberg-wealth` | Bloomberg Wealth | 후보 · 활성 (F3.1 MUST: 킬 스위치·서킷 브레이커·GN 대체) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `gn-bloomberg` | Google 뉴스 · Bloomberg | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `gn-us-market` | Google News (US market) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `fed-press` | 연준 보도자료 (Fed) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `sec-8k-atom` | SEC 최신 8-K | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `cnbc-rss` | CNBC Top News | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `marketwatch-rss` | MarketWatch Top Stories | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `yahoo-finance-rss` | Yahoo Finance News | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `finnhub-news` | Finnhub 기업 뉴스 | 미검증 · 활성 | 프로브 생략: `FINNHUB_API_KEY` 필요 — 없으면 비활성 |
| `finviz-ratings` | Finviz 공개 등급 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `nasdaq-consensus` | Nasdaq 컨센서스 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `sec-edgar` | SEC EDGAR (공시 원문) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `us-official-macro` | 연준·BEA·BLS·재무부 공식 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `yahoo-chart` | Yahoo 차트 (지연 시세) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-polling` | 네이버 실시간 스냅샷 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-autocomplete` | 네이버 종목 검색 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-stock-news` | 네이버 종목 뉴스 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `robot-report` | The Robot Report | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `irobotnews` | 로봇신문 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `ieee-spectrum-robotics` | IEEE Spectrum Robotics | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `ifr-press` | IFR 보도자료 | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `a3-press` | A3 보도자료 | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `gn-robotics-kr` | Google 뉴스 (로봇) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `gn-robotics-en` | Google News (robotics) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `federal-register` | Federal Register | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `gn-robot-policy-kr` | Google 뉴스 (로봇 정책) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `gn-robot-policy-en` | Google News (robotics policy) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `robotics-universe` | 로봇 유니버스 검증 | 미검증 · 활성 | 프로브 생략: 유사 소스(시세 조회로 종목 검증, 미확인 종목 목록만 표시) |
| `gn-etf-kr` | Google 뉴스 (ETF) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `gn-etf-brands` | Google 뉴스 (ETF 운용사) | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `naver-etf-list` | 네이버 ETF 목록 | 미검증 · 활성 | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `blackrock-bii-weekly` | BlackRock Investment Institute weekly commentary | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `jpm-guide-to-markets` | J.P. Morgan Asset Management Guide to the Markets | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `vanguard-outlook` | Vanguard economic and market outlook | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |
| `ifr-world-robotics` | IFR World Robotics (press summary) | 비활성 (후보) | 이 세션의 egress 프록시가 호스트 차단 (HTTP 403 host_not_allowed) — 원본 서버 응답 아님 |

## 3. 게이트 결과

| 게이트 | 결과 |
|---|---|
| `npm run typecheck` | 통과 — 오류 0 |
| `npm test` | 통과 — 스크립트 테스트 201 + 앱 테스트 216 = **417개, 실패 0** (기준선 195 + 113) |
| ESLint (변경 파일만) | **오류 0**, 경고 57 (react-refresh/exhaustive-deps 등 기존 패턴의 경고) — 기준선 전체 `eslint .`는 오류 20(기존) |
| `npm run build` | 통과 (Vite + nitro vercel preset). 추적 중인 `.vercel/output/`은 커밋 전 복원 |
| `npm run qa:smoke` | **40/40** (20개 라우트 × 데스크톱 1440×900 / 모바일 390×844) — 모든 라우트에서 면책 문구·차트 출처 표기 확인, 가로 넘침 없음 |
| `npm run qa:acceptance` | **28/28** 브라우저 인수 테스트 통과 (AT-09·11·12·13·15·16(+모바일·대체 경로)·18·19·20·22·23·25·28·29·30·32·34·36·38·41·42·43·44·46, F7.15 성능: 5,000봉 이동·확대 중 long task 0건, F10.3 대시보드 카드). 데이터는 QA 하네스의 합성 픽스처 |
| `npm run verify:sources` | OFFLINE-BUILD — 64 blocked, 4 skipped |

인수 테스트 매핑: AT-01~08 단위 테스트, AT-09~44 브라우저/단위(세부는 `SPEC.md`), AT-45 스모크(면책·출처), AT-46 단위(`src/lib/ai/briefing.test.ts`: 설정 게이트, 인용 없는 문장 거부, 모르는 URL 제거) + 브라우저(설정 없음 → AI UI 없음, 설정 모킹 → 클릭 전 호출 없음·라벨·인용 링크·기계 번역), AT-47 기존 라우트 모두 스모크 통과(KIS 스트림·ETF 보유종목·수출 데스크·공시는 D1 정렬, D9 훅, F8.6 스트림 보강 외 변경 없음), AT-48 빌드 산출물 점검(서버 출력에 파일 쓰기 호출 없음, AI SDK는 서버 함수에만 포함되고 클라이언트 번들에 없음, 모든 외부 호출 타임아웃 ≤ 8초·AI 재시도 없음, `/api/feed`·`/api/wire` 예산 7.5초).

## 4. 편차 · 한계 · 라이선스

**스펙과 다른 점**
- 브랜치 이름: 세션이 지정한 `claude/new-session-mz0027`만 푸시할 수 있어 스펙의 브랜치명을 쓰지 않았습니다.
- 오프라인 빌드: 모든 소스가 `미검증`입니다. 네이버 v2 등은 문서화된 목록 키만 확인되어, 매퍼가 여러 후보 필드명을 허용합니다.
- 생략/대체: F1.6 한국 일정 스트립, F2.9 산업 필터(고정 분류로 대체), F3.7 미국 실적 일정, F6.5 미국 시가총액(`—`), F7.18 TradingView 위젯 탭(COULD).
- F9 비용: 토큰 수만 표시합니다(공급자 가격표를 코드에 넣지 않음). 선택 env `AI_EFFORT`를 추가했습니다.
- 추가 선택 env `FEED_SOURCES_DISABLED`(서버 측 소스 차단 목록). `retrySource`와 AI 서버 함수 2개(`generateAiBriefing`, `translateAiHeadlines`)는 사용자가 누르는 동작이라 POST입니다(모두 zod 검증).
- 소스 상태·AI 캐시·일일 상한은 서버 인스턴스별 메모리 값입니다(서버리스 인스턴스마다 따로 셈).
- 기타 세부 편차는 `docs/upgrade/PROGRESS.md`의 Decisions/Deviations에 있습니다.

**알려진 한계**
- 실제 데이터로 화면을 확인하지 못했습니다(네트워크 차단). QA 하네스의 데이터는 모두 합성 픽스처입니다.
- xAI 어댑터는 문서의 REST 형식을 따랐지만 실행해 보지 못했습니다.
- 차트 알림은 차트 데이터가 갱신될 때 평가되며, KIS 실시간 틱은 봉을 갱신하지 않습니다.
- Web Push(브라우저를 닫은 상태의 알림)는 VAPID 키·구독 저장소·스케줄러가 필요해 범위에서 제외했습니다.

**라이선스·소스 에티켓 (A4)**
- 차트는 오픈소스 `lightweight-charts`(Apache-2.0)만 사용하고, 모든 차트 화면에 "Charts: TradingView Lightweight Charts™" → https://www.tradingview.com/ 링크를 표시합니다(`attributionLogo: false`의 조건). TradingView Advanced Charts/Trading Platform은 쓰지 않았습니다.
- Bloomberg: 공개 RSS의 제목·링크·시각만, 폴링 ≥ 5분, 본문 없음, 403/429 시 서킷 차단, `NEWS_BLOOMBERG_ENABLED` + 앱 내 토글, Google News `site:bloomberg.com` 대체.
- 네이버(`stock.naver.com`, `m.stock.naver.com`): 비공식 엔드포인트를 개인용·저빈도·캐시·읽기 전용으로만 사용. 쿠키 없음, 대량 수집·우회 없음, 조회수 기록 엔드포인트(`/researches/v2/{type}/{id}/view`) 호출 없음.
- 유료/로그인 벽 우회 없음, 원문 전체 재게시 없음: 제목, 출처 발췌 ≤ 240자, 추출 요약, 원문 링크만 표시합니다. AI 요약은 사용자가 누를 때만 만들고 인용·라벨을 붙입니다.

## 5. 다음에 하실 일

1. **환경 변수** (서버 전용, `VITE_` 접두사 금지, 저장소에 `.env` 파일을 만들지 마세요 — 자세한 표는 `docs/upgrade/ENVIRONMENT.md`)
   - 권장: `SEC_USER_AGENT`(실제 연락처 포함, 예 `KEDesk you@your-domain`).
   - 선택: `KIS_APP_KEY`/`KIS_APP_SECRET`(실시간 체결 + KIS 시황 제목), `FINNHUB_API_KEY`, `NEWS_BLOOMBERG_ENABLED`(기본 true).
   - AI(선택): `AI_BRIEFING_ENABLED=true`, `AI_MODEL`(사용할 모델 ID), `AI_PROVIDER`(`anthropic` 기본 또는 `xai`), 해당 키(`ANTHROPIC_API_KEY` 또는 `XAI_API_KEY`), `AI_DAILY_CAP`(기본 50), `AI_EFFORT`(선택).
2. **소스 검증**: 일반 인터넷이 되는 머신(또는 이 환경의 네트워크 접근을 "Full"로 바꾼 뒤)에서 `npm run verify:sources` 실행 → `docs/upgrade/SOURCES_STATUS.md` 갱신 → `ok`가 나온 후보는 `src/server/feeds/registry.ts`에서 `enabled`/`status`를 바꿔 주세요.
3. **배포**: Vercel 프로젝트에 위 env를 등록하고 이 브랜치(또는 병합 후 기본 브랜치)를 배포합니다. `npm run build`가 `.vercel/output/`을 만들며, 로컬 빌드 산출물은 커밋하지 마세요.
4. **토글**
   - 소스 on/off·상태·지금 재시도: 앱의 `/status/sources`(소스 상태).
   - Bloomberg: env `NEWS_BLOOMBERG_ENABLED=false`(전체 제거) 또는 소스 상태 페이지 토글(브라우저별).
   - 알림: `/settings/alerts`(앱 내 토스트, 데스크톱 알림 켜기, 방해 금지 시간, 지역·분류, 소리, 티커 테이프, 가격 알림 목록). 헤더 종 아이콘으로 Live Wire 서랍을 엽니다.

## 6. 브랜치 · 커밋 · PR

- 브랜치: `claude/new-session-mz0027`
- 커밋:
  - `4cd96cf` docs(upgrade): P0 reconnaissance, spec checklist, source registry and environment probe
  - `2daadf8` feat(feed): P1 foundations — time/sort kernel, registry fetch policy, health, UI kit, store v2
  - `b4e5999` feat(news): P2 KR/US news briefings, /api/feed aggregator and grouped sidebar
  - `7e687ce` feat(research): P3 KR research v2 desk and US research tiers with Street Moves
  - `aba21c1` feat(etf,robotics): P4 ETF news briefing and robotics section
  - `cd7c758` feat(wire): P5 Live Wire alerts, alert settings and serverless-safe SSE
  - `9c4a8ca` feat(charts): P6 pro chart core, workspace and Tier B/C chart chrome
  - `cf2675f` feat(ai,dashboard): P7 optional AI briefing layer and dashboard brief cards
  - (이 보고서 커밋) `docs(upgrade): P7 final report`
- PR: https://github.com/foxandwildgoose/k-equity-desk-v2/pull/1 (`main` ← `claude/new-session-mz0027`, 충돌 없음 — `main`이 기준 커밋 `7c154f5`)
