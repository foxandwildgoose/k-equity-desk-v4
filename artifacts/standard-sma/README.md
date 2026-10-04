# 표준 SMA 검증 결과 — 2026-10-04

기준 커밋: `3d984f461e279d8ffe34dc089ce9c6a201b0fd05`.
수정 코드 커밋: `4057c48` (`feat(charts): standardize theme-aware SMA bundle and warm-up history`).
구현·변경 파일별 목적·정확한 스타일·워밍업·저장 계약은
[STANDARD_SMA.md](../../docs/upgrade/STANDARD_SMA.md)에 정리했다.

## 실행한 검사

| 검사 | 결과 | 기록 |
|---|---|---|
| `npm run typecheck` | 통과 | [typecheck.log](typecheck.log) |
| `npm test` | 592개 통과, 실패/생략 0 (scripts 207 + TS 385) | [tests.log](tests.log) |
| `npm run lint` | 통과, 오류 0 / 경고 56 | [lint.log](lint.log) |
| `env -u DATABASE_URL npm run build` | 운영 빌드 통과, DB migration 명시적 skip | [build.log](build.log) |
| `npm run qa:sma` | 20/20 통과, 브라우저 JS 오류 0 | [sma-browser.json](sma-browser.json) |
| `npm run qa:chart-hts -- --mode fixture … --interactions` | 8/8 통과 | [hts-browser.json](hts-browser.json) |

Node 22.23.3, 실제 production bundle + `npm run preview -- --port 8183`, 시스템 Chromium을 사용했다.
브라우저 fixture는 테스트 전송 계층에서만 제공한 synthetic 응답이다.
캡처 수치/곡선은 실데이터 수신이나 배포 사이트 검증의 증거가 아니다.
스크립트는 요청한 `innerWidth`도 검사했다: desktop 1440×900 / DPR1, mobile 390×844 / DPR2.

기존 PowerShell 테스트를 생략하지 않도록 다음 테스트 전용 실행 경로를 지정했다.
키 파일을 읽거나 실제 API를 호출하는 설정이 아니다.

```sh
KIWOOM_TEST_PWSH=/tmp/pwsh-kiwoom/pwsh \
XDG_CACHE_HOME=/tmp/pwsh-kiwoom/cache \
XDG_CONFIG_HOME=/tmp/pwsh-kiwoom/config \
XDG_DATA_HOME=/tmp/pwsh-kiwoom/data npm test
```

SMA matrix 실행 빌드 경로는 `/workspace/.onboarding/builds/k-equity-desk-v4`였다.
QA 스크립트의 이식 가능한 server-entry 설정도 별도 workspace 사례로 확인했다.

```sh
npm run qa:sma -- --base http://127.0.0.1:8183 \
  --server-entry /workspace/.onboarding/builds/k-equity-desk-v4/functions/__server.func/index.mjs \
  --out /workspace/screenshots/standard-sma-production

NODE_OPTIONS='--import /workspace/.onboarding/tools/use-system-chromium.mjs' \
npm run qa:chart-hts -- --mode fixture --base http://127.0.0.1:8183 \
  --function-map artifacts/standard-sma/function-map.json \
  --cases stock-403870,etf-069500,us-NVDA,workspace-multi \
  --viewports desktop,mobile --interactions \
  --out /workspace/screenshots/standard-sma-hts-fixture
```

`function-map.json`은 이번 빌드의 서버 함수 ID→함수명이다. 서버 함수가 바뀌는 새 빌드에서는 다시 추출해야 한다.
`qa:sma`는 지정된 build entry에서 직접 추출한다. fixture 모드의 HTS 메타데이터도 테스트에서만 제공한다.

## 브라우저에서 확인한 동작

- 한국 삼성전자, ETF 069500, 미국 NVDA, 2분할 workspace, 수출입 비교 차트에 다섯 기본 SMA가 ON.
- 각 버튼의 OFF가 해당 native 라벨/선만 제거하고 다른 버튼 상태·canvas 수·가격 시간 범위를 유지.
- ON/OFF와 live theme 변경 시 가격 재조회 없음. 저장된 SMA120 OFF가 새로고침 뒤 복원.
- 정확한 Light/Dark 색상과 native CSS line width 1/2/2/2/3 확인.
- 오른쪽 라벨이 chart 안에 있고 22 CSS px 간격 유지. 좁은 화면 기간 숫자 압축 확인.
- KR/ETF/US의 일/분/주/월 전환 뒤에도 다섯 유효 SMA 라벨 유지.
- 표시 60봉 앞의 실제 fixture history로 SMA120/200 계산. 순수 테스트는 첫 표시 봉의 수치까지 검증.
- stock 데스크톱 리플레이에서 cursor 31/60의 SMA200이 과거 200봉 평균과 반올림 허용오차 내 일치.
- 수출입 A→B 전환 시 다섯 평균 값이 바뀌고 대상의 축에 연결. 품목 금액 차트의 기존 focus 연결.
- 밸류에이션 밴드·PER 이력·투자자 수급 차트에서도 다섯 버튼·라벨 확인. 수급 외국인 선택 확인.
- 실제 PNG 다운로드를 decode해 다섯 정확한 스타일 색상 픽셀이 포함되는지 확인.
- HTS 검사에서 기존 pane 순서, 매물대 설정/범위·높이·합계, 그리기/금지 pane,
  가격 알림, CSV/PNG, 키움 결측 누적 제한, 확대/이동, 주기·리플레이·테마·전체화면 확인.

순수 테스트는 SMA5/20/60/120/200 정확도, null 워밍업, 0/음수/결측,
선택 주기별 pre-roll 정렬, 미래 replay 제외, 전체 cap, 기존 SMA50/200과 OFF 보존,
마이그레이션 반복·테마 override·라벨 충돌·비교 대상 선택을 검증했다.
수정주가 주봉의 독립 컴포넌트와 종목 표 sparkline은 공통 계산/상태 구현 및 typecheck로 확인했으며,
이번 브라우저 matrix에서 별도 route 직접 실행 검증은 하지 않았다.

## 캡처

모든 이미지는 해당 production bundle + synthetic transport의 직접 브라우저 캡처다.

| 화면 | Light PC | Dark PC | Light mobile | Dark mobile |
|---|---|---|---|---|
| 한국 종목 | [보기](screenshots/stock-light-desktop.png) | [보기](screenshots/stock-dark-desktop.png) | [보기](screenshots/stock-light-mobile.png) | [보기](screenshots/stock-dark-mobile.png) |
| ETF | [보기](screenshots/etf-light-desktop.png) | [보기](screenshots/etf-dark-desktop.png) | [보기](screenshots/etf-light-mobile.png) | [보기](screenshots/etf-dark-mobile.png) |
| 미국 종목 | [보기](screenshots/us-light-desktop.png) | [보기](screenshots/us-dark-desktop.png) | [보기](screenshots/us-light-mobile.png) | [보기](screenshots/us-dark-mobile.png) |
| 2분할 | [보기](screenshots/workspace-light-desktop.png) | [보기](screenshots/workspace-dark-desktop.png) | [보기](screenshots/workspace-light-mobile.png) | [보기](screenshots/workspace-dark-mobile.png) |
| 수출입 | [보기](screenshots/export-light-desktop.png) | [보기](screenshots/export-dark-desktop.png) | [보기](screenshots/export-light-mobile.png) | [보기](screenshots/export-dark-mobile.png) |

추가 PC 캡처:

- 밸류에이션 밴드 [Light](screenshots/valuation-band-light-desktop.png) / [Dark](screenshots/valuation-band-dark-desktop.png)
- PER 이력 [Light](screenshots/valuation-history-light-desktop.png) / [Dark](screenshots/valuation-history-dark-desktop.png)
- 투자자 수급 [Light](screenshots/investor-flow-light-desktop.png) / [Dark](screenshots/investor-flow-dark-desktop.png)
- 품목 금액 [Light](screenshots/export-amount-light-desktop.png) / [Dark](screenshots/export-amount-dark-desktop.png)
- 실제 PNG 저장 [Light](screenshots/stock-light-export.png) / [Dark](screenshots/stock-dark-export.png)

## 별도 제한 / 미검증 사항

실제 배포 사이트와 모든 공급자의 200봉 제공 여부는 검증하지 않았다. 실데이터/키움 인증을 수행했다고 주장하지 않는다.
기존 분봉 조회 기간 제한, 네이버 월봉 180 cap, 짧은 macro 이력, sparkline 20봉,
신규 상장/연봉은 충분한 이력이 없을 수 있다. null을 유지한다.
사용자가 저장한 과거 색상은 보존하고 `테마 자동` 선택 시 새 팔레트를 적용한다.

일반 `browser-smoke.mjs`도 dev와 built의 PC/mobile을 직접 열고 캡처·시각 확인했다.
두 환경 모두 HTTP200, 화면 내용 있음, 가로 overflow 없음, JS page error 없음.
그러나 strict smoke는 외부 리소스 `ERR_CERT_AUTHORITY_INVALID`와 dashboard의 비동기 지수 문구 차이로 실패했다.
결과를 지우거나 통과 처리하지 않았다: [dev](smoke-dev.json) / [built](smoke-built.json).
SMA·HTS의 deterministic production browser 검사는 각각 20/20, 8/8 통과했다.
외부 인증서 검증이나 앱 보안 정책을 변경하지 않았다.
