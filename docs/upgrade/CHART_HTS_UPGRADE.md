# 국내주식·ETF 공통 HTS 차트 업그레이드

> 아래는 2026-10-03의 HTS 변경 검증 기록입니다. 2026-10-04 키움 전용 수급 전환의 최신 구현·검증 상태는 [KIWOOM_FLOW_SETUP.md](KIWOOM_FLOW_SETUP.md), [KIWOOM_FLOW_VERIFICATION.md](KIWOOM_FLOW_VERIFICATION.md)에 기록했습니다. 이전 공급자의 실수신 결과를 키움 실수신 증거로 사용하지 않습니다.

2026-10-03 · 구현 및 실제 검증 기록. 국내주식·ETF 공통 UI/계산/내보내기는 동작하며, 신용·투신의 실제 인증 연동은 서버 키 미설정으로 부분 완료다. 실데이터와 fixture 검증을 분리하고 원래 실패 기록도 보존했다.

## 적용 범위와 사용

국내 개별주와 국내 상장 ETF는 공통 `ProChart` 엔진, 매물대 primitive, 산식, 설정 및 내보내기를 사용한다. 국내 상장 해외자산 ETF도 상장 시장은 KR이다. 해외자산 이름이나 편입 비중으로 미국 상장 종목으로 바꾸지 않는다. ETF 자체 가격·거래량을 사용하며 구성종목의 거래량, 설정·환매 수량, 순자산 또는 발행좌수로 대체하지 않는다.

기본 순서는 **RSI → 가격·매물대 → 신용잔고율 → 외국인보유비율 → 투신 수량 → 거래량**이다. 각 패널은 같은 시간축을 공유하고 Y축은 독립적이다. 수급 데이터를 얻지 못해도 제목·순서·영역·구체적 상태를 유지한다. 미국 개별주는 기존 레이아웃을 보존하며 공통 매물대 개선만 적용한다. 이미 제공하는 해외 상장 ETF는 6단 구조를 사용하되 지표 정의 및 지원 여부를 개별 확인한다.

| 화면 | 연결 경로 | 확인 대상 | 최종 브라우저 상태 |
| --- | --- | --- | --- |
| 국내주식 상세 | `/stock/$ticker` → `TradingChart` → `ProChart` | 001820, 403870, 036540, 011790 | 실데이터 1440/768/390 통과 |
| 국내자산 ETF 상세 | `/etfs/$code` → `TradingChart` → `ProChart` | 069500 | 실데이터 1440/768/390 통과 |
| 해외자산 국내 상장 ETF | 같은 ETF 상세 경로, KR 시장 | 379800 · KODEX 미국S&P500 | 실데이터 1440/768/390 통과 |
| 영문 포함 국내 ETF | 같은 ETF 상세 경로, 실제 메타데이터 확인 | 0005A0 · KODEX 미국S&P500데일리커버드콜OTM | 실데이터 1440/768/390 통과 |
| 퇴직연금 ETF 목록에서 상세 | `/etfs`의 퇴직연금 후보 → `/etfs/$code` | 실제 목록에 표시되는 ETF | 실데이터 1440/768/390 통과 |
| 관심종목 상세 | `/watchlist`의 종목 링크 → 각 상세 | 실제 별 추가 → 목록 → 001820 상세 | 실데이터 1440/768/390 통과 |
| 확대·워크스페이스 | `/chart?symbols=KR:069500&layout=1` | ETF 1개 | 실데이터 1440/768/390 통과 |
| 다중 워크스페이스 | `/chart?symbols=KR:001820,KR:069500&layout=2` 및 4분할 | 주식·ETF 동시, 4분할은 24 native pane | 실데이터 1440/768/390 통과 |
| 미국 개별주 | `/us/NVDA` | 기존 레이아웃 보존 | 실데이터 1440/768/390 통과 |
| 기존 해외 상장 ETF | `/us/BOTZ` | 6단 구조 및 정의 미확인 상태 | 실데이터 1440/768/390 통과 |

실제 Naver `/basic` 응답의 `stockEndType`, `stockExchangeType.nationCode`, `stockExchangeType.code`로 검증한 메타데이터는 `artifacts/chart-upgrade/security-metadata-live.json`에 기록했다. 네 개 필수 개별주는 stock, 069500·379800·0005A0는 모두 etf/KOR/KOSPI로 확인했다. 메타데이터 조회 성공은 차트·수급 실연동 검증과 별도이다.

퇴직연금 후보 표시는 기존 서비스의 추정·미확정 분류이며 실제 연금계좌 매수 가능 여부를 보장하지 않는다. 미니 스파크라인과 가치평가 전용 차트는 분석용 가격 차트와 역할이 다르므로 일괄 6단으로 바꾸지 않는다.

## 사용 방법과 변경 파일

1. 국내주식 또는 ETF 상세 차트에서 **6단 · 매물대 설정**을 연다. 작은 화면/다중 차트에서는 **차트 도구** 안에 있다.
2. **HTS 상세**에서 구간·폭·불투명도·라벨·집계 범위를 조절한다. **국내주식·ETF HTS 기본 배치 복원**은 기존 드로잉과 사용자가 추가한 지표를 보존한다.
3. 패널 구분선을 끌거나 설정의 높이를 입력한다. 작은 화면은 세로 스크롤을 사용하고, 이벤트 주석이 겹치면 오버레이를 줄이거나 **매물대 상세** 표에서 정확한 수량을 읽는다.
4. 차트 우측 저장 버튼은 전체 차트 PNG와 CSV를 내려받는다. 매물대 상세 안의 별도 CSV 버튼은 구간 데이터만 내보낸다.
5. 신용·투신의 **인증 미설정**은 실제 값이 없다는 상태다. 외국인 비율도 제공된 최근 10거래일만 표시하며 없는 기간을 보간하지 않는다.

| 주요 변경 파일 | 이유 |
| --- | --- |
| `src/components/charts/pro/ProChart.tsx`, `useHtsPanes.ts`, `primitives.ts` | 공통 native 6단, 의미 기반 가격 pane, 캔들 뒤 주황 매물대·라벨·캔버스 상태 표시 |
| `src/lib/chart-indicators.ts`, `charts/hts-flow.ts`, `charts/profile-labels.ts` | 겹침 길이 배분, RSI·RSI 시그널, 결측·날짜별 수급 정렬, 라벨 배치 |
| `charts/hts-settings.ts`, `HtsSettingsPanel.tsx`, `ProfileDetails.tsx` | 버전/범위별 설정, 기존 설정 보존, 복원·키보드 조작·접근 가능한 상세표 |
| `src/server/chart-flow.ts`, `chart-security.ts`, `src/lib/chart-flow-fns.ts`, 관련 hook | 공급자/상품별 계약, 실제 메타데이터, 신용·외국인·투신 독립 상태/인증/취소/캐시 |
| `TradingChart.tsx`, stock/ETF 상세와 `/chart` route | ETF·퇴직연금·확대·다중 화면에서 같은 엔진 및 상장 시장 전달 |
| `charts/core/export.ts`, `create-pro-chart.ts` | PNG 상태/출처 포함, CSV 확장, 화면 이동 때 native chart 정리 순서 |
| `scripts/qa-chart-hts.mjs`, `package.json`, 관련 `*.test.ts` | 실제 실행 목록에 연결한 단위·회귀 테스트 및 실데이터/fixture 브라우저 검증 |

## 매물대 정의와 기본값

HTS 상세 기본값은 10구간, 왼쪽 plot 경계 시작, 최대 폭 85%, 색 `#e7b157`, 불투명도 0.22, 수량·비율 라벨 표시, 현재 보이는 시간 범위다. 폭은 10~90%로 조절한다. 10/16/24/32/48/64 및 범위 내 사용자 구간 수, 색·투명도·라벨·POC·Value Area·기간 설정을 제공한다. 기존 간략·강조·숨김 프리셋도 유지한다.

OHLCV만 제공되는 경우 **OHLCV 기반 추정 매물대**다. 가격별 실제 체결 분포 또는 현재 매도 주문·보유원가·주주 잔고와 같다고 해석하지 않는다. 봉의 저가 L, 고가 H, 거래량 V와 가격 구간 [a,b)에 대해 H > L이면 다음과 같이 배분한다.

```text
구간 배분량 = V × max(0, min(H,b) − max(L,a)) / (H−L)
구간 비율   = 구간 배분량 / 전체 유효 구간 배분량 합 × 100
막대 너비   = 최대 너비 × 구간 배분량 / 최대 구간 배분량
```

막대 길이의 기준과 비율의 분모는 다르다. H=L이면 한 구간에 전량 배분한다. 구간은 하단 포함·상단 제외이며 최상단만 상단을 포함한다. 조기 반올림하지 않고 표시 수량만 반올림한다. 유효 입력량을 보존하고 잘못된 OHLC·음수·비유한 수량은 제외 건수/부분 상태로 알린다. 0 거래량과 결측을 구별한다. 짧은 데이터도 가능한 범위에서 계산한다.

POC 동률은 낮은 가격 구간을 우선한다. Value Area는 POC부터 인접 거래량이 큰 방향으로 70% 이상까지 확장하며 동률은 낮은 가격 쪽을 우선한다. VAL/VAH는 포함 구간의 경계다. 이는 확정 매매 신호가 아니다.

고정 기간과 전체 로드 기간 모드는 시간 스크롤로 계산 대상을 바꾸지 않는다. 가격축만 확대해도 분모·가격 구간을 바꾸지 않는다. 화면 밖 구간은 클리핑하며 남은 구간 비율을 다시 100%로 정규화하지 않는다. 가격 조정과 거래량 조정은 별개이며 공급자 조정 정의를 검증할 수 없는 경우 이를 명시한다.

## RSI와 거래량

RSI는 해당 봉 주기의 실제 종가에 Wilder RMA 14를 적용한다. 빨간 RSI와 초록 **RSI 출력의 SMA 9**가 기본이며 EMA 선택을 제공한다. Signal은 RSI(9) 또는 원래 주가 SMA(9)가 아니다. 상승만 있으면 100, 하락만 있으면 0, 완전 횡보는 50, 워밍업 이전은 null이다. 첫 RSI는 15번째 종가, 첫 SMA 9 시그널은 23번째 종가부터 계산 가능하다. 화면 스크롤이 RSI 워밍업 시작점을 바꾸지 않는다.

RSI 축은 0~100이며 30·50·70 기준선을 표시한다. 거래량은 해당 증권 자체의 봉 주기별 수량이며 SMA 5/20/60을 제공한다. 기본 한국 상승 빨강·하락 파랑과 기존 사용자의 색상 관례를 따른다. 장중 봉은 완성된 종가 데이터와 구별한다.

## 수급 데이터, 단위, 시점

표시 UI가 같다는 사실과 실제 지표가 제공된다는 사실을 분리한다. 지표별 지원 상태는 상장 시장·제공자·종목/상품·지표·요청 기간에 따라 판단한다. 실패 하나를 모든 ETF의 영구 미지원으로 일반화하지 않는다.

| 지표 | 정의와 단위 | 제공자/실제 연결 상태 | 날짜·확정 기준 |
| --- | --- | --- | --- |
| 가격·거래량 | 해당 증권 자체 OHLCV, 원천 수량 단위 유지 | 기존 Naver/Yahoo 경로, 실행 결과로 개별 확인 | 원천 거래일, 공급자 지연·수정 기준 표시 |
| 신용잔고율 | KIS `whol_loan_rmnd_rate`, 전체 융자 잔고 비율 % | 공식 예제 기반 어댑터·fixture 검증; 키 미설정으로 실제 주식/ETF 인증 호출 미검증 | `stlm_date` 결제일; 공표 시각·확정 여부 null |
| 외국인보유비율 | Naver `foreignerHoldRatio`, 내부 0~100 % | 실제 4개 주식·3개 ETF에서 각 10개 관측 확인, partial | 2026-09-17~2026-10-02 영업일; 공표 시각·확정 여부 null |
| 투신 수량 | KIS `ivtr_ntby_qty` 투자신탁 순매수 주; 필요시 `ivtr_shnu_vol−ivtr_seln_vol` | 공식 예제 기반 어댑터·fixture 검증; 키 미설정으로 실제 주식/ETF 인증 호출 미검증 | `stck_bsop_date` 영업일; 고정 누적 기준일, 누락 이후 누적 미확정 |

상세 API/필드 근거, 단위 및 권한 제약은 [수급 제공자 검증 기록](CHART_FLOW_PROVIDERS.md)을 참조한다. 실제 어댑터 호출 증거는 `artifacts/chart-upgrade/actual-flow-verification.json`이다. 외국인 한도소진율(`foreignRate`)과 보유비율은 KT·SK텔레콤 실제 서로 다른 수치로 재확인했다. ETF 069500 원천 종목 화면의 수량 단위는 **주**이며 임의로 좌로 바꾸지 않는다.

투신 기본값은 **최초 분석 기간 시작일에 고정한 누적순매수**다. 사용자가 기준일을 명시적으로 바꿀 수 있다. 일별 순매수는 투신 매수량−매도량이며, +100/−40/+60이면 누적 100/60/120이다. 절대 보유잔고를 뜻하지 않는다. 기관 전체·금융투자·연기금·ETF 설정환매는 투신으로 대체하지 않는다.

비율은 주·월 기간의 마지막 유효 관측, 순매수·거래량은 기간 합, 누적순매수는 기간 마지막 누적값으로 표시한다. 없는 날짜를 직전 값이나 0으로 채우지 않는다. 분봉에서 일별 수급을 당일 실시간 곡선으로 만들지 않는다. 리플레이의 가격·RSI·매물대는 미래 봉을 제외하고, 수급 공표 시각이 미확인인 경우 엄밀한 시점 재현을 제한한다.

`available`, `partial`, `not-configured`, `not-supported`, `not-applicable`, `error`, `unknown`을 구별하고 stale은 취득 시각과 함께 별도 표시한다. 지표별 source/sourceField, unit, asOf/dateBasis, fetchedAt, availableAt, final, derived 및 계산시 formula/denominator를 보존한다.

## 설정·내보내기·회귀 보호

새 설정은 버전과 시장·상품·종목·봉 주기·화면/레이아웃 범위를 포함한 key로 저장한다. 기존 차트 드로잉·사용자 지표 설정을 보존한다. 과거 ETF 축소 기본값인지 사용자의 선택인지 불명확하면 파괴적으로 덮어쓰지 않고 HTS 기본 배치 적용/복원 UI를 제공한다.

가격 pane 숫자를 0으로 가정하지 않는다. 가격 캔들, 이동평균, 매물대, 추세선·피보나치, 마커와 알림은 의미상 price pane에 연결한다. RSI·수급 영역 포인터를 가격으로 해석하지 않는다.

PNG는 실제 6단 차트·라벨·범례·단위·출처·기준일·미제공 상태를 포함해야 한다. CSV는 구간별 수량·전체 비율·기간·산식·단위와 수급 원시/집계·날짜·출처·상태·투신 기준일을 포함한다. 실제 다운로드 검증 결과와 스크린샷을 아래 기록한다. 키보드 설정과 접근 가능한 요약표도 검증 대상이다.

## 요구사항과 검증 연결

| 영역 | 코드 검증 | 브라우저 검증 |
| --- | --- | --- |
| 매물대 | 총량·비율·경계·0·결측·동률 POC/VA·단위 | 10구간, 긴/짧은 막대, 85% 폭, 라벨, POC, 고정/가시 범위 |
| RSI | Wilder 독립 표본·워밍업·횡보·SMA/EMA | 최상단 빨강/초록, 중복 없음, 30/50/70, 스크롤 불변 |
| 수급 | null/0, %/%p, 날짜·단위, 누적·누락, 주월 집계 | 미제공 패널 유지, 상태/원천일 표시, 일별·분봉 제한 |
| 요청 | 입력·인증·429·타임아웃·취소·중복/캐시 key | 종목/ETF 전환 오염 없음, 늦은 응답 안전성 |
| pane | 의미별 인덱스·빈 pane 유지 | 6단 순서·높이 조절·공통 시간축·드로잉 price 한정 |
| 설정 | 검증·마이그레이션·scope 격리 | 저장·재접속 복원, ETF 전환·다중 화면 간 격리 |
| 내보내기 | CSV 정의·상태 보존 | 실제 PNG/CSV 다운로드 및 내용 확인 |
| 호환성 | 기존 지표·미국 주식·인증 테스트 | 1440/768/390, 테마·전체화면·퇴직연금·BOTZ |

## 실행 기록과 증거

안전한 빌드는 `build` 스크립트가 `db:migrate`를 이어 실행한다는 점을 고려해 마이그레이션 없이 수행했다. Node 22.23.3과 `node_modules/.bin`을 PATH에 넣고 **`env -u DATABASE_URL node scripts/with-app-env.mjs vite build`**를 사용했다. 운영 DB 변경·배포는 실행하지 않았다.

| 명령/검증 | 결과 | 증거 |
| --- | --- | --- |
| `npm test` | 통과: 스크립트 201 + TypeScript 318 = 519 | `artifacts/chart-upgrade/validation.json`, `validation-logs/` |
| `npm run typecheck` | 통과 | 같은 validation 기록 |
| `npm run check:auth` | 통과: dev/build sign-in off 일치 | 같은 validation 기록 |
| `npm run lint` | 변경 전부터 존재한 `src/lib/app-data/client.server.ts:214` no-empty 오류 1건으로 실패 | 초기 67 warnings; 최종 경고 수는 validation 기록 참조. 요구와 무관한 원본 오류는 변경하지 않음 |
| `env -u DATABASE_URL node scripts/with-app-env.mjs vite build` | 통과, DB 마이그레이션 생략 | `validation-logs/` |
| `node scripts/qa-chart-hts.mjs --mode real` | 14개 경로/구성 × 3크기 = 42조합 중 처음 40통과/2수신 대기 시간 초과; 해당 2건은 65초 대기로 재검증 통과 | `real-matrix-verdict.json`, `real-sfa-desktop-recheck.json`, `real-sfa-tablet-recheck.json` |
| 관심종목 실제 메뉴 이동 → 상세 | 별 추가·목록 링크를 실제 클릭, 3크기 3/3통과 | `real-watchlist-verdict.json` |
| 실제 주식/ETF `--interactions` | 각각 9개 동작 검증 통과 | `real-interactions-verdict.json` |
| 실제 `--checks 'Local price alert'` | 주식·ETF 모두 통과 | `real-alerts-verdict.json` |
| `--mode fixture --cases stock-001820,etf-069500 --interactions` | 2상품 × 3크기 = 6통과, 각 desktop에서 설정·그리기·기간 전환·내보내기 등 전체 동작 통과 | `fixture-verdict.json` |
| native 구분선·고정 기간·가격축 확대·hover·키보드 | 실제 ETF 069500 전용 검증 5/5통과, 페이지 예외 0 | `geometry-verdict.json` |
| 기존 `browser-smoke.mjs` 개발/production | 양쪽 desktop/mobile HTTP200, 페이지 예외·overflow 없음, 내용 hash 일치. 외부 HTTPS 인증서 오류 별도 남음 | `smoke-dev.json`, `smoke-production.json` |
| production ETF 069500 | 실제 desktop 1/1통과 | `production-chart-verdict.json` |

SFA반도체(036540)는 초기 30초 동안 외부 가격 수신이 완료되지 않았다. UI는 데이터 수신 중을 표시하고 가짜 봉을 만들지 않았다. 재검증의 실제 응답은 **`yahoo-036540.KQ`, 486봉, 2024-10-02~2026-10-02**이며 desktop/tablet/mobile에서 10구간·6단을 확인했다. 원래 시간 초과를 삭제하지 않고 별도 재검증으로 남겼으며, 재사용 하네스의 기본 대기를 65초로 조정했다. 원문 요약은 `sfa-price-live.json`이다.

실제 상호작용 검증은 기본 10구간/85%/RSI14·Signal9, 설정 16구간/EMA/가격 높이 변경 및 재접속 복원, 다른 종목으로 설정 격리, 기본값 복원, 상세표 비율 합계, PNG/CSV 다운로드, 수평선·추세선·피보나치의 가격 pane 한정, 시간 확대/이동, 일·주·월·분 전환, 리플레이 한 봉 전진과 공표 시각 미확인 수급 제한, 테마, 확대 워크스페이스를 포함한다.

추가 geometry 검증에서 Enter로 설정 열기/Escape 종료 후 버튼으로 포커스 복원, native 구분선 RSI 100→135px/가격 400→365px 및 재접속 유지, 시간 이동·가격축 확대 후 구간 수량/비율의 내부 정밀도 불변, 두 날짜 hover에 맞춘 RSI·가격·거래량 및 수급 결측 사유를 확인했다.

별도 알림 검증은 실제 UI에서 수평선을 만든 뒤 가격 알림으로 연결하고 알림 패널의 가격을 확인했다. 알림/수평선과 공시·리서치·시그널 표시를 변경할 때 **price canvas만 바뀌고 나머지 5개 pane canvas는 같은 상태**인지 비교했다.

fixture 모드는 브라우저의 `getChartData`/`getChartFlow` 요청만 명시적으로 합성 데이터로 대체한다. 참값 0, null, 부분 기간, 긴 수량을 포함하며 모든 원천과 결과에 QA SYNTHETIC/fixture를 표시한다. 메타데이터와 나머지 화면 요청은 기존 경로를 유지한다. fixture는 제공자 인증 성공 증거가 아니며 운영 데이터 경로에 가짜 대체값을 추가하지 않았다.

대표 결과:

- `artifacts/chart-upgrade/real/stock-001820-{desktop,tablet,mobile}.png`
- `artifacts/chart-upgrade/real/etf-069500-{desktop,tablet,mobile}.png`
- 같은 디렉터리의 `stock-001820-export.{png,csv}`, `etf-069500-export.{png,csv}`
- `workspace-four-desktop.png`, `us-NVDA-desktop.png`, `us-BOTZ-desktop.png`
- `stock-001820-price-alert-markers.png`, `etf-069500-price-alert-markers.png`
- `artifacts/chart-upgrade/fixture/*-synthetic-export.png` — 합성 시각 테스트 증거

PNG를 직접 확인했다. 국내주식과 ETF 모두 6단·10구간·수량/비율·단위·출처·상태를 포함한다. 390px에서도 매물대 라벨은 각자의 가격 구간에 표시된다. 기존 공시/패턴/고저점 주석이 겹치는 부분은 오버레이 제어와 상세표로 확인할 수 있다. profile 라벨끼리 다른 구간 높이로 이동시키지 않는다.

추가 관심종목 검사에서 React 수화 전에 서버 DOM의 버튼을 클릭한 뒤 hard navigation한 경우 `/watchlist`의 SSR/client 정렬 차이와 hydration mismatch를 관측했다. 이는 변경 전 기준 커밋으로 재현하지 않아 이번 변경의 회귀인지 판정하지 않았다. native pane이 생성되어 수화 완료를 확인한 뒤 **실제 별 추가 → 메뉴 → 관심종목 링크** 흐름은 3크기 모두 예외 없이 통과했다. 별도 초기 관측은 `watchlist-prehydration-observation.json`에 보존한다.

외부 Google Fonts, jsDelivr Pretendard, Grok extensions 요청에는 Chromium의 `ERR_CERT_AUTHORITY_INVALID`가 남는다. 앱의 JS 예외와 별도로 기록했고 TLS 검증 우회·CA 신뢰 저장소 수정은 하지 않았다. 따라서 외부 리소스를 포함한 완전한 무오류 네트워크 검증으로 보고하지 않는다.

## 환경변수·제약·남은 작업

신용·투신 실제 호출에 필요한 서버 환경변수는 **`KIS_APP_KEY`, `KIS_APP_SECRET`**이다. 현재 둘 다 미설정이며, 기존 바인딩의 이름·존재 여부만 확인했다. 값을 환경 설정에 안전하게 주입한 뒤 종목별 권한·ETF 지원 여부를 실제 응답으로 검증해야 한다. 외국인 비율은 기존 공개 Naver 경로로 실제 연동을 검증했다. 키 값은 문서·로그·브라우저·localStorage에 출력하지 않는다. `VITE_` 비밀키나 저장소 `.env` 파일을 만들지 않는다.

- 참조 JPG 원본이 제공되지 않은 경우: 명세 기반 구현이며 이미지 직접 대조는 미실시라고 표시한다.
- 실제 외부 수급 접근 권한이나 공급자 정의가 부족한 지표: UI/계약/모의 응답 검증과 실연동 미검증을 구별한다.
- 신용·투신: 서버 키·계정 권한을 안전하게 설정한 뒤 개별주/ETF별 실제 응답, 분류·단위·이력·게시 조건을 확인해야 한다. 구현 및 fixture 계약 테스트를 실연동 완료로 보고하지 않는다.
- 커밋·push·배포·자동 병합 및 운영 DB 변경은 본 작업 범위가 아니다.
