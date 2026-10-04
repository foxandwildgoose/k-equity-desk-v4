# 표준 SMA 5/20/60/120/200 구현 및 검증

작업일: 2026-10-04. 기준 커밋: `3d984f461e279d8ffe34dc089ce9c6a201b0fd05`.
코드 커밋: `4057c48`.
기존 React / TanStack Start / Lightweight Charts 5.2.1 구조를 확장했다.
운영 배포, 증권사 인증정보 변경, 운영 DB 마이그레이션은 수행하지 않았다.

## 차트 조사 범위

`src` 전체에서 Lightweight Charts, Recharts, SVG sparkline, SMA, chart 생성·호출부를 검색했다.

| 차트 | 연결 경로 | SMA 대상 / 이력 |
|---|---|---|
| 한국 종목 상세 | `stock.$ticker` → `TradingChart` → `ProChart` | 선택 주기의 종가, 동일 주기 추가 이력 |
| 한국 ETF 상세 | `etfs.$code` → `TradingChart` → `ProChart` | 동일 |
| 미국 종목·ETF | `us.$symbol` / workspace → `ProChart` | 동일, USD 포맷 유지 |
| 전체화면·1/2/4분할 | `chart.tsx` → `ProChart` | 종목·상품·주기·레이아웃 scope 유지 |
| 밸류에이션 밴드 | `ValuationBandChart` | 실제 주가, 일봉 추가 이력; 공정가격 밴드를 평균하지 않음 |
| 밸류에이션 배수/가격 이력 | `ValuationHistoryChart` | 선택 배수 또는 실제 가격, 전체 pack에서 구간 자르기 전 계산 |
| 수정주가 주봉 컴포넌트 | 동일 파일 `WeeklyPriceChart` | 전체 driver 이력; 기존 컴포넌트 유지 |
| 투자자 수급 | `InvestorFlow` | 스마트머니/외국인/기관/개인/종가 중 선택, 원래 축 사용 |
| 수출입 총액 × KOSPI | `ExportDesk` → `ExportDualChart` | A/B 선택, 전체 월별 이력, A 좌축 / B 우축 |
| 산업 비교 × KOSPI | 동일 `ExportDualChart` | 동일; 전체 overlay 이력 사용 |
| 주력 품목 금액 비교 | `ExportAmountChart` | 기존 `focusId` 대상 한 품목만; 달러 금액 축 유지 |
| 종목 표의 가격 미리보기 | `StockTable` → `Sparkline` | 공급된 실제 순차 관측값; 현재 20봉 데이터 제한 표시 |

목적국 Recharts 막대는 국가별 범주 비교라 SMA를 적용하지 않았다.
가격 차트의 RSI·MACD·키움 하위 pane 구성/정의와 수동 그리기는 유지했다.

## 사용 방법과 상태

차트 가까이의 `SMA5`, `SMA20`, `SMA60`, `SMA120`, `SMA200` 버튼이 각각 ON/OFF를 제어한다.
색상 표시와 `aria-pressed`, 한국어 접근성 이름, 모바일 줄바꿈을 제공한다.
가격 차트에서는 기존 지표 목록·범례·빠른 버튼이 동일한 `IndicatorInstance.visible`을 읽고 수정한다.
기존 지표 편집기에서 SMA50 등 사용자 기간을 계속 추가할 수 있다.

다중 수출입 차트의 `SMA 대상`에서 A/B를 선택한다. 품목 금액 차트는 기존 품목 선택을 따른다.
수급 차트도 `SMA 대상`을 선택한다. 대상이 숨겨져 있으면 해당 SMA를 함께 숨긴다.
실제 봉이 부족하거나 관측값이 결측이면 `이력 부족/결측`을 표시하며 평균을 보충하지 않는다.

## 공통 계산·스타일·저장 계약

- `src/lib/charts/standard-sma.ts`: 표준 기간·스타일, 이력 병합/정렬/정정 우선순위, timestamp 정렬,
  독립 토글, 마이그레이션, 최신 유효 값과 라벨 충돌 배치.
- `src/lib/chart-indicators.ts`: 기존 O(n) `sma()` 재사용. 완전한 기간이 없으면 null.
  0/음수는 유효하며 NaN/결측을 0으로 채우지 않는다. 결측이 기간 밖으로 빠져야 다시 유효하다.
- `catalog.ts`: 일반 SMA 인스턴스 그대로 사용. 표준 UID는 `sma-standard-<period>`이며
  범례 이름은 SMA5처럼 명시적이다. 기본 KR/US 세트는 다섯 표준 기간이다.
- `persistence.ts`, `store-migrate.ts`: 기존 v2 키와 chart template을 확장한다.
  `smaBundleVersion: 1` 없이 저장된 레거시에 없는 표준 기간만 추가한다.
  SMA200 중복 추가를 막으며 SMA50·기존 OFF·색상·드로잉·주기·가격 스케일을 보존한다.
  한 번 이행한 뒤 재로드해도 추가되지 않는다. 새 버전에서 사용자가 삭제한 지표를 매번 되살리지 않는다.
- 신규 표준 색상은 `colorMode: theme`이라는 의미를 저장한다. 사용자 지정은 `custom`을 유지한다.
  레거시 hex에는 사용자 선택 여부의 근거가 없으므로 보존한다. 지표 편집기의 `테마 자동`을 누르면
  아래 표준 색상을 사용한다. localStorage 전체 초기화는 없다. SSR·storage 차단 시에도 차트가 작동한다.
- `ProChart`: 추가 이력은 SMA에만 적용한다. 기존 VWAP 등 다른 지표의 계산 시작점을 유지한다.
  토글·색상 변경은 현재 series 옵션만 변경하며 가격 시리즈를 재생성하거나 fitContent를 호출하지 않는다.
- `core/use-standard-sma.ts`: 별도 시계열 차트에 같은 계산·스타일·기존 chart persistence를 연결한다.
  테마/표시 변경과 시계열/축 연결의 수명주기를 분리하고 정리 시 primitive와 series를 제거한다.

| 기간 | Light | Dark | LWC 지원 폭 | SVG 미리보기 폭 |
|---|---|---|---:|---:|
| 5 | `#B8860B` | `#FFD54F` | 1 | 1.5 |
| 20 | `#A23B8F` | `#E07BCB` | 2 | 1.8 |
| 60 | `#00796B` | `#35D0A0` | 2 | 1.9 |
| 120 | `#1565C0` | `#42A5F5` | 2 | 2.0 |
| 200 | `#C62828` | `#FF5C5C` | 3 | 2.5 |

Lightweight Charts의 `LineWidth`는 정수이므로 1/2/2/2/3을 사용한다. 강제 타입 캐스트는 없다.
봉 상승/하락 색상 규칙은 그대로다. 스타일 토큰은 한 파일에만 있다.

## 시간 주기·워밍업·리플레이

`use-analysis-chart-data.ts`에서 표시 구간과 같은 interval/minuteSize/prePost의 추가 이력을 요청한다.
종목과 공급자 가격 기준이 일치하는 이력만 병합한다. 한국 Yahoo 분봉의 요청 기간 접미사는
가격 기준 비교에서만 제거하며 종목·실제 봉 주기·공급자는 유지한다.

| 선택 주기 / 표시 기간 | 추가 요청 |
|---|---|
| 1/3분 | 7d |
| 5/10/15/30분 | 60d |
| 60분 | 2y |
| 짧은 일봉 | 2y |
| 2y 일봉 | 5y |
| 5y 일봉 | 10y |
| 주/월/연 | max |

SMA200은 선택한 주기의 200봉이다. 주봉에는 주봉을, 월봉에는 월봉을 입력하고 일봉 SMA를 투영하지 않는다.
분봉은 세션 경계에서 SMA를 초기화하지 않는다. 조회 데이터는 기존 React Query 캐시를 사용한다.
테마나 토글은 가격 조회를 발생시키지 않는다.

계산 이력에 표시 봉의 수정값을 우선 적용하고 날짜순으로 정렬한다. 표시 첫 봉 전 최대 499봉을 유지해
일반 SMA 편집기의 최대 500봉도 지원한다. 가격 표시 10,000봉 cap 앞의 pre-roll을 따로 보존한다.
전체 계산 결과를 timestamp로 표시 봉에 맞춰 돌려준다. 확대/이동은 같은 봉의 평균을 바꾸지 않는다.
리플레이 마지막 봉 이후 데이터는 계산 전에 제거한다.

밸류에이션·수출입·수급 차트는 전체 제공 이력에서 계산한 뒤 표시 구간으로 정렬한다.
수출입 지수화는 표시 구간의 원래 기준값을 pre-roll에도 사용한다. YoY도 전체 이력에서 산출한다.
수급 누적 모드는 기존 선택 구간의 누적 시작점을 유지하도록 pre-roll을 같은 기준에 맞춘다.
키움 거래일 대조에는 일별 가격 자료만 전달한다. SMA용 주봉/분봉을 거래일 달력으로 사용하지 않는다.

## 오른쪽 끝값 라벨

`core/sma-labels-primitive.ts`를 가격 pane에 붙인다. 각 SMA의 실제 native priceToCoordinate를 사용하므로
로그/퍼센트 스케일과 A/B의 별도 축을 따른다. 의미 없는 가로 가격선이나 autoscale 변경은 없다.
최신 유효 SMA 값과 기간을 시장 가격 포맷으로 표시한다. OFF/유효 값 없음이면 표시하지 않는다.
가격 시리즈와 함께 연결·해제해 종목/차트 종류/HTS pane 전환 뒤에도 살아 있는 source에 붙는다.

위치순으로 배치하며 보통 22 CSS px 간격을 보장한다. chart 경계 안으로 밀고 짧은 연결 tick을 그린다.
상단 pane 제목 공간을 예약하고 매우 작은 pane에서는 간격을 제한한다. 좁은 화면은 기간 숫자로 압축한다.
캔버스 media 좌표를 사용해 DPR을 중복 적용하지 않는다. 마우스 이벤트를 가로채지 않는다.
native screenshot에 라벨이 포함돼 기존 PNG 내보내기에도 동일하게 나온다. CSV의 원시 행은 보존한다.

## 추가로 수정한 원인

- 초기 SMA 기본값은 5/20/60 위주이며 미국 기본값과 달랐다.
- 조회한 워밍업이 일반 SMA overlay 계산에 사용되지 않았다.
- 전에는 지표 표시/색상 변경 때 모든 지표 series를 다시 생성했다.
- 수급 차트는 초기 로딩 중 DOM이 없으면 한 번뿐인 생성 effect가 끝나서 차트가 생성되지 않았다.
  실제 데이터가 도착해 container가 생길 때 생성하고, 종목/데이터 유무 전환 때 정리하도록 고쳤다.
- 다중 차트 reload 후 pane 전환과 라벨의 별도 attach effect가 엇갈릴 수 있었다.
  라벨을 가격 series 생성/정리와 같은 effect에서 관리한다.
- 전체 lint를 막던 기존 `client.server.ts` 빈 catch에는 기존 fallback 목적의 주석만 추가했다.

## 변경 파일과 목적

| 파일 | 목적 |
|---|---|
| `src/lib/chart-indicators.ts` | 기존 rolling SMA의 완전한 창·결측 처리 |
| `src/lib/charts/standard-sma.ts`, `standard-sma.test.ts` | 표준 스타일/기간, 계산·이행·라벨 배치 및 회귀 검사 |
| `src/lib/charts/catalog.ts` | 기본 인스턴스와 이름·theme/custom 의미 |
| `src/lib/charts/persistence.ts`, `src/lib/store-migrate.ts` | 기존 레이아웃/템플릿의 한 번만 이행 |
| `src/lib/charts/use-analysis-chart-data.ts` | 선택 주기의 warm-up 조회 |
| `src/lib/charts/security.ts`, `security.test.ts` | 한국 분봉의 같은 가격 기준 이력 비교 |
| `src/components/charts/core/SmaControls.tsx` | 공통 빠른 토글 |
| `src/components/charts/core/use-standard-sma.ts` | 독립 시계열의 shared adapter와 기존 저장 경로 |
| `src/components/charts/core/sma-labels-primitive.ts` | native 좌표 라벨/충돌 처리/PNG |
| `src/components/charts/pro/ProChart.tsx` | catalog state 연결, pre-roll 정렬, series 보존, pane 라벨 수명주기 |
| `src/components/charts/pro/ChartPanels.tsx` | 이름/색상 공유, 명시적 색상 편집과 테마 자동 |
| `src/components/export-desk/ExportDesk.tsx` | 자르기 전 이력과 동일 변환 기준 전달 |
| `src/components/export-desk/ExportDualChart.tsx` | A/B와 기존 focus의 다섯 SMA·축·제어 |
| `src/components/stocks/ValuationBandChart.tsx`, `ValuationHistoryChart.tsx` | 주가/배수의 다섯 SMA와 pre-roll |
| `src/components/stocks/InvestorFlow.tsx`, `src/routes/stock.$ticker.tsx` | 대상 선택, 종목별 저장 scope, 늦은 데이터 도착 시 chart 생성 |
| `src/components/stocks/Sparkline.tsx`, `StockTable.tsx` | 실제 제공 관측값의 SMA 미리보기와 종목별 scope |
| `scripts/qa-standard-sma.mjs`, `scripts/qa-chart-hts.mjs`, `package.json` | 실제 실행 QA, 외부 metadata와 분리된 fixture, test/QA 명령 |
| `src/lib/app-data/client.server.ts` | 기존 빈 catch에 목적 주석만 추가 |
| `docs/upgrade/STANDARD_SMA.md`, `artifacts/standard-sma/*` | 구현 설명과 실행한 검사·캡처 증거 |

## 검증과 실행 명령

자동 테스트는 실제 API와 분리된 결정적 데이터로 실행했다. 기본 테스트에서 키움 실호출은 없다.
브라우저 fixture는 QA 스크립트의 네트워크 가로채기에만 있으며 서비스에는 들어가지 않는다.
화면 캡처의 `QA SYNTHETIC` 수치/종목명은 실데이터 증거가 아니다.

```sh
npm run typecheck
npm test
npm run lint

# 이 저장소 build에는 db:migrate가 연결돼 있다. 운영 DB를 연결하지 않고 검사했다.
env -u DATABASE_URL npm run build
npm run preview -- --port 8183

# 기본 server-entry는 NITRO_OUTPUT_DIR 또는 .vercel/output 아래 경로.
# 다른 빌드 디렉터리이면 실제 산출물 경로를 --server-entry로 지정한다.
npm run qa:sma -- --base http://127.0.0.1:8183 \
  --server-entry <build-directory>/functions/__server.func/index.mjs \
  --out /workspace/screenshots/standard-sma-production

npm run qa:chart-hts -- --mode fixture --base http://127.0.0.1:8183 \
  --function-map artifacts/standard-sma/function-map.json \
  --cases stock-403870,etf-069500,us-NVDA,workspace-multi \
  --viewports desktop,mobile --interactions \
  --out /workspace/screenshots/standard-sma-hts-fixture
```

이 환경은 Node 22.23.3과 시스템 Chromium을 사용했다. `qa:sma`는 CHROMIUM_PATH 또는 시스템 Chromium을
선택할 수 있다. 기존 HTS QA에는 이 환경의 Chromium launcher adapter를 사용했다.
기존 PowerShell 파일 주입 테스트도 설치된 PowerShell 경로를 지정해 생략 없이 실행했다.

최종 검사 수치와 화면 증거는 [검증 결과](../../artifacts/standard-sma/README.md)에 기록한다.
단위 검사는 수치/결측/0/음수, pre-roll/정정/리플레이/10,000 cap, 모든 분봉 크기,
기본값·마이그레이션·SMA50·중복·OFF, 정확한 색상/폭, 라벨 충돌, A/B 선택을 포함한다.

## 실제 제공 이력의 제한

SMA 표시 기능을 구현·fixture로 검증했으며 모든 실제 상품에서 200봉 수신을 보장하지 않는다.
공급자 API·가입 기간·상장 시점·장애로 자료가 부족하면 null이다.

- 기존 Yahoo 분봉 경로: 1/3분 약 7일, 5/10/15/30분 약 60일, 60분 약 2년 제한.
- 기존 네이버 fallback: 일봉 1,200 / 주봉 400 / 월봉 180 요청 cap. 월봉 fallback만으로 SMA200을 만들지 않는다.
- 신규 상장·장기 거래정지·연봉 등에는 필요한 실제 관측치가 없을 수 있다.
- 수출입·KOSPI macro의 공급 이력이 120/180개월 등으로 짧으면 SMA200은 결측이다.
- 종목 표 sparkline은 현재 20개 순차 가격만 공급된다. SMA5/20은 계산 가능하지만 60/120/200은
  상태와 null을 유지한다. 표의 모든 종목을 위해 별도 대량 시세 조회를 추가하지 않았다.
- 오래된 사용자 색상은 보존한다. 정확한 새 Light/Dark 자동색을 쓰려면 지표 편집기의 `테마 자동`을 선택한다.

실제 배포 주소의 API 이력·로그인·운영 데이터를 별도 확인해야 한다. 운영 배포를 수행하지 않았다.
