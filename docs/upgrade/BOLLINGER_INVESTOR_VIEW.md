# Bollinger 선택 기업 분석 화면 — 구현·검증 기록

**현재 버튼 동작과 추가 수정·검증은 [BOLLINGER_ACTIONS_VERIFICATION.md](BOLLINGER_ACTIONS_VERIFICATION.md)를 따른다.** 아래는 `b3db39e`까지의 이전 구현·검사 기록이며 이번 수정의 검증 결과로 합산하지 않는다. 현재 **실행**은 부족한 가격·최종 분석을 확인하여 권한 확인과 수집으로 연결하고, 시간 예산 종료 응답은 제한된 자동 이어받기로 처리한다. 전략 탭은 해당 조건 일치 기업으로 전환하며, **전체 선택**에서는 미일치·자료 부족 기업도 검토할 수 있다.

확인일: 2026-10-09. 작업 기준: `fc54e44dd0946782fa81b24e072acd4be4d6911c` (`origin/main`). 기존 Vercel Hobby, Neon 및 차트 코어를 유지했다. 새 DB·마이그레이션·운영 환경변수는 추가하지 않았다.

## 사용자가 보게 되는 결과

1. `/bollinger`에서 시장, 편입 스냅샷, Top 범위를 선택하고 **실행**을 누른다.
2. **전체 선택**이 기본이다. 엄격한 전략 후보가 0개여도 선택 기업의 이름, 완료봉 종가, 상황, 밴드 위치, 압축 정도, 전략 판정과 제외 이유를 보여준다. 계산이 없는 기업도 이름과 미확보 이유를 남긴다.
3. 첫 기업의 **볼린저 가격 차트**를 바로 연다. 다른 기업 이름을 누르면 해당 기업으로 바꾸고 차트 위치로 이동한다. 데스크톱은 표, 모바일은 기업별 카드로 제공한다.
4. **Squeeze Watch** 등 전략 탭은 저장 자료의 판정만 즉시 바꾼다. 시장·Top 범위 변경은 실행으로 적용한다. 전략 탭은 수집을 시작하거나 기존 수집의 재개 범위를 바꾸지 않는다.
5. **조건 일치**에서는 기존 엄격한 후보 표·선정 근거·전체 차트 연결을 볼 수 있다. 조건을 느슨하게 만들어 후보를 억지로 생성하지 않는다.
6. 가격·최종 분석이 부족할 때만 운영자 권한으로 **선택 범위 수집·계산** / **수집 이어받기**를 사용한다. 계산 중에도 기존 저장 차트와 기업 목록을 볼 수 있다. **저장 자료 새로고침**은 목록과 선택 차트를 함께 갱신한다.

차트는 기존 ProChart/Lightweight Charts를 그대로 사용한다. BB(20, 2), 기존 표준 SMA5/20/60/120/200, 거래량, %B, 밴드 폭을 제공한다. 최근 120/250봉을 표시하되 지표에는 그 이전의 저장 이력까지 전달한다. 가격 공급자의 완료 일봉이 부족하면 지표 값을 만들지 않는다. 저장 가격만 있는 경우 밴드는 표시하고 최종 전략 평가 미확보를 따로 알린다.

## 확인된 원인과 수정

| 문제 | 확인한 코드 경로와 해결 |
| --- | --- |
| 선택 20개와 저장 20개인데 아래가 비어 있음 | 기존 SQL이 전략·점수·Coverage를 통과한 후보만 반환했다. `inspection`은 별도로 선택 기업 전체를 LEFT JOIN하여 미일치·미확보도 보존한다. 기존 후보 필터는 유지한다. |
| 볼린저 가격 차트가 없음 | 기존 차트 연결은 후보 행에만 있었다. 저장 일봉을 읽는 서버 함수와 화면의 선택 기업 차트를 연결했다. 후보 0개도 차트 확인이 가능하다. |
| 전략 탭을 바꿔도 이전 결과가 그대로임 | 탭은 초안만 변경했고 요청은 이전 적용 조건이었다. 전략만 적용 조건에 즉시 반영해 DB 조회한다. |
| 전략 변경 후 이어받기가 새 수집처럼 보임 | 전체 조회 조건으로 수집 동일성을 비교했다. 시장·편입·종목·Top·계산 버전 등 수집 조건을 별도로 비교하고 재개 대상은 유지한다. |
| 최종 분석이 시간 예산을 쉽게 소진함 | 종목별 최종 계산에서 전체 상대 강도 컨텍스트를 반복 집계했다. 동일 요청의 갱신 단계에서는 공유 준비를 한 번만 수행하고 남은 종목을 계산한다. 재개 요청에서는 다시 준비하여 정정 자료를 반영한다. 실제 Neon 지연 개선 수치는 별도 운영 검증이 필요하다. |
| 저장 20개와 최종 계산 12개가 모순처럼 보임 | 이전 저장 분석과 이번 실행의 최종 갱신을 구분하고, 미완료 종목에 최종 갱신 대기를 표시한다. 상세 수집·집계는 기본 접힌 영역에 둔다. |
| 새로고침 후 표와 차트가 다를 수 있음 | 페이지 새로고침·수집 종료 시 선택 차트 캐시도 무효화한다. |
| 같은 저장 가격 기준인데 저항선이 보류될 수 있음 | 저장 `priceBasis`를 차트에 명시적으로 전달한다. 출처 표시 이름으로 기준을 추정하지 않으며 명시된 기준이 다르면 계속 보류한다. 기존 차트 호출부의 접두사 호환 경로는 유지한다. |

## 변경 파일

- `src/server/bollinger-discovery-store.ts`, `bollinger-discovery.ts`, `src/lib/bollinger-discovery-fns.ts`: 전체 선택 기업의 상태, 기준일까지 저장된 일봉·분석 조회 계약. 서버 함수는 읽기 전용이며 키움·가격 공급자를 호출하지 않는다.
- `src/lib/bollinger/discovery-inspection.ts`: 상황 해석, 미확보/워밍업/오래된 계산/Coverage/전략/점수 제외 이유의 공통 함수.
- `src/components/charts/BollingerStockStudy.tsx`, `BollingerInspectionList.tsx`, `src/routes/bollinger.tsx`: 선택 기업 차트·표·모바일 카드, 즉시 전략 전환, 조회와 수집의 상태 구분.
- `src/components/charts/pro/ProChart.tsx`: 이 분석 화면 전용 저장 scope와 `analysisOnly`. 기존 차트의 기본값은 유지하며 분석 화면에서는 수급 요청·캐시를 사용하지 않는다.
- `src/lib/bollinger/discovery-execution.ts`: 조회 필터와 수집 범위의 동일성 분리, 기존 최초 수집 범위 유지.
- `src/server/bollinger-discovery-jobs.ts`, `bollinger-cloud.ts`: 최종 상대 강도 준비 공유, 시간 예산·DB lease 검사 및 재개 유지.
- `src/server/bollinger-cloud-config.ts`: 검증된 종목 코드만으로 최종 갱신 대기 식별. 원문 작업 summary나 토큰을 반환하지 않는다.
- 관련 `*.test.ts`, `scripts/qa-bollinger-discovery.mjs`, `package.json`: 의미 있는 회귀 검사와 기존 테스트 명령에 추가.

## 데이터·보안·운영 범위

- 기존 Neon의 `bollinger_daily_bars`, `bollinger_features`, 편입 목록을 그대로 읽는다. 운영 DB 연결 실패를 메모리 DB 성공으로 바꾸지 않는다.
- 종목·시장·스냅샷·분석 버전·조회일별 캐시를 분리한다. 저장된 분석의 가격 기준과 일치하는 일봉만 사용한다. 다른 공급자의 일봉으로 조용히 대체하지 않는다.
- 가격 날짜와 분석 날짜는 조회 기준일 이하로 제한한다. 미래 조회일과 잘못된 달력 날짜는 거부한다. 최대 5,000개 완료 일봉이며 실제 관측 기간을 표시한다.
- 오늘보다 이전의 마지막 완료봉은 조회 실패와 다르다. 최근성 기준은 기존 4달력일이며, 거래소 휴장일을 추정하거나 오늘 봉을 만들어 넣지 않는다.
- 가격 차트·전략 조회는 같은 사이트의 저장 시장자료 읽기이다. 공급자 호출은 기존 운영자 쿠키·same-site·공유 lease를 유지한 별도 수집 POST에 한정한다. 분석용 차트는 키움 개인 키를 소비하지 않는다.
- App Key/App Secret, CRON_SECRET, DATABASE_URL, 허용 IP, 로그인 및 키움 세 지표의 연동을 바꾸지 않았다. 새 비밀값·수집 프로세스·설치 작업을 요구하지 않는다.
- 개별 종목 상태는 저장 완료봉의 조건 설명이다. 수익률 확률이나 미래 돌파를 보장하는 값으로 표현하지 않는다.

## 실제 검사 결과

- `npm run typecheck`: 통과.
- `npm test`: 스크립트 검사 226개 중 214개 통과·Windows PowerShell 관련 12개 건너뜀, 앱 단위/통합 검사 577개 모두 통과. 운영 DATABASE_URL을 제거하고 격리된 테스트 DB를 사용했다.
- `npm run lint`: 오류 0개. 기존 경고 57개는 별도로 남아 있다.
- `npm run build`: 통과. 현재 build 명령에는 DB migration이 없다. 운영 DB를 변경하지 않았다.
- `git diff --check`: 통과.
- `npm run check:deploy -- --build-output /workspace/.onboarding/builds/k-equity-desk-v4`: 통과. Vercel cron이 프로젝트 설정에 한 번만 존재하고 빌드 산출물과 중복되지 않음을 확인했다.
- `npm run qa:bollinger-discovery -- --base http://127.0.0.1:8191 --out /workspace/screenshots/bollinger-investor-analysis/final-basis-production`: **6/6 통과**. 마지막 source 수정 후 새 production 빌드·프로세스를 사용했다. Light/Dark × desktop/tablet/mobile에서 후보 0개 시 선택 20개 보존, 종목별 상황/이유, 실제 canvas의 캔들·BB 상/하단선, 종목 전환·자동 스크롤, 가격 미확보 시 canvas 제거, 기준일 이후 가격 제외, 읽기 전용 전략 전환·새로고침, 중단 후 전략 변경·재로드·정확한 범위 재개, 일치한 명시적 가격 기준을 확인했다. 분석 화면의 시장 가격/키움 수급 직접 조회 호출은 0회였다.
- `npm run qa:chart-hts -- --mode fixture --base http://127.0.0.1:8191 --function-map /workspace/.onboarding/run/bollinger-investor-hts-functions.json --cases stock-001820,etf-069500,workspace-multi --viewports desktop,mobile --out /workspace/screenshots/bollinger-investor-analysis/hts-regression`: **6/6 통과**. 기존 개별주·ETF·분할 차트의 pane 구성과 렌더링을 확인했다.
- 일반 `browser-smoke.mjs`를 dev와 production에서 각각 실행: **exit 2**. 두 화면 모두 HTTP 200, 내용 표시, uncaught page error 0, 페이지 가로 넘침 없음. 외부 리소스 인증서 오류 및 403/503 리소스 오류가 기록되었으며 동적인 전역 시세 헤더의 본문 시작이 달라 baseline 비교도 불일치했다. 이를 깨끗한 smoke 통과로 기록하지 않는다. 운영 DB가 없는 기본 화면 검사이며 실행 후 분석 차트 검사는 별도의 격리 DB 브라우저 검사로 구분했다.

원격 운영 주소의 이 환경 GET은 프록시 CONNECT 403으로 차단되었다. 이것은 사용자의 Vercel 사이트 오류를 증명하지 않는다. 이 환경에는 운영 Neon 연결도 주입되지 않았다. 아래 브라우저 증거는 production 번들을 대상으로 격리된 PGlite 저장 자료를 서버 계약으로 전달한 회귀 검사이며, 실제 운영 시세 수신 캡처와 구분한다.

## GitHub 반영 뒤 사용자 확인 순서

1. Vercel의 **Deployments**에서 이번 새 커밋의 Production이 **Ready**인지 확인한다. 이전 실패한 커밋의 Redeploy를 반복할 필요는 없다.
2. `https://k-equity-desk-v4.vercel.app/bollinger`를 새로고침한다.
3. 기존 KOSDAQ 스냅샷과 Top20을 선택하고 **실행**을 누른다.
4. **전체 선택 20**에서 기업별 이름·상황을 확인하고 이름을 눌러 가격 차트를 바꾼다. 후보가 0개인 전략에서도 이 목록과 가격 차트는 유지되어야 한다.
5. **Squeeze Watch**를 눌러 판정·일치 수가 바로 바뀌는지 확인한다. 이 클릭으로 수집 요청이 발생하지 않아야 한다.
6. 이번 실행의 최종 분석이 남아 있으면 기존 권한으로 **수집 이어받기**를 사용한다. 업데이트 결과와 기존 저장 분석일을 함께 확인한다.

새 Neon migration, Node 설치, 키 재등록은 이번 변경 때문에 필요하지 않다. 실제 배포·운영 DB 검증은 위 화면 확인과 별개이며 production 빌드 성공만으로 완료라고 기록하지 않는다.

## 보존한 검사 증거

모두 격리 테스트 자료로 검사한 production 번들 화면이다. 가격·종목명은 명시적으로 `QA SYNTHETIC`으로 표시하며 실제 시장 관측이나 운영 수신 증거로 사용하지 않는다. 원본 검사 JSON에는 실행 당시의 workspace 경로가 기록되어 있다.

- [검사 요약](artifacts/bollinger-investor-view/validation-summary.json), [분석 화면 6개 검사](artifacts/bollinger-investor-view/qa-bollinger-discovery.json), [기존 차트 6개 검사](artifacts/bollinger-investor-view/qa-chart-hts.json)
- [Light 데스크톱 차트](artifacts/bollinger-investor-view/investor-chart-light-desktop.png), [Dark 데스크톱 차트](artifacts/bollinger-investor-view/investor-chart-dark-desktop.png)
- [Light 모바일 차트](artifacts/bollinger-investor-view/investor-chart-light-mobile.png), [Dark 모바일 차트](artifacts/bollinger-investor-view/investor-chart-dark-mobile.png)
- [후보 0개일 때 전체 기업 목록 — Light](artifacts/bollinger-investor-view/zero-match-analysis-light-desktop.png), [Dark](artifacts/bollinger-investor-view/zero-match-analysis-dark-desktop.png)
- [모바일 기업 카드 — Light](artifacts/bollinger-investor-view/zero-match-analysis-light-mobile.png), [Dark](artifacts/bollinger-investor-view/zero-match-analysis-dark-mobile.png)
- 일반 smoke 실패/제한은 [dev](artifacts/bollinger-investor-view/dev-smoke.json), [production](artifacts/bollinger-investor-view/production-smoke.json)에 별도 보존했다.
