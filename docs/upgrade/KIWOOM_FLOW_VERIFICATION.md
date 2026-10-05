# 현재 main 키움 연결 개선·검증 보고서

확인일: 2026-10-05, 한국시간. 작업 경로: `C:\Users\sh\Claude Code\k-equity-desk-v4`.
GitHub current main은 읽기 전용 재확인 시 `2266d0f671391d5fe51211c6c2b6a6b151abb6a9`였습니다.
코드 검증 기록 작성 시점에 이번 수정은 해당 main의 **로컬 변경**이었으며 commit/push/PR을 실행하지 않은 상태였습니다. 이후 GitHub 반영 여부는 원격 commit으로 별도 확인해야 합니다. GitHub 반영은 운영 배포·운영 DB migration·실데이터 검증의 증거가 아닙니다.

## A. 원인과 판정

| 구분 | 확인된 근거 | 적용 또는 남은 조치 |
| --- | --- | --- |
| CONFIRMED CODE BLOCKER | user ID가 자료 scope였고 auth-off가 collector 읽기까지 차단 | 서버 global scope/공개 stored read/owner-only direct·admin 분리 |
| CONFIRMED CODE BLOCKER | 임의 종목의 수집 예약·폴링 경로 부재 | 영속 대상 예약, 100개 상한, 1,830일, 순차·재개·refresh 제한 |
| CONFIRMED CODE BLOCKER | CLI/app-env 차이, 직접 조회 기본, 빌드에 DB migration 결합 | 공통 doctor, collector 기본, 명시적 migration, 전용 PostgreSQL 경로 |
| CONFIRMED CODE BLOCKER | 메타데이터 실패가 known product까지 무효화; 요약이 최신 가격일 일치만 허용 | validated route 유형 보존/unknown 안내·재시도, 실제 기준일 latest 요약 |
| CONFIRMED CODE BLOCKER | 단일 IP echo 의존 | 독립 서비스 2개 이상 동의 + 등록 IPv4 정확 일치; 불일치 fail-closed |
| CONFIRMED RUNTIME BLOCKER | 과거 runtime/smoke/browser 기록은 disabled/no DB/no broker/fixture였음. 이번 doctor도 disabled/no DB/no credentials | 실제 연결 성공으로 보고하지 않음 |
| UNVERIFIED deployment | 이번 작업의 commit/배포·실행 revision 대조 증거 없음 | 짧은 SHA 진단 추가, DEPLOYMENT_NOT_VERIFIED 유지 |
| EXTERNAL CONFIGURATION REQUIRED | 실제 키, 등록-IP 수집기, 공유 PostgreSQL, 배포 접근이 미제공 | 운영자가 보안 파일/실행환경을 지정하고 6 gate 수행 |
| ALREADY FIXED / DO NOT REWRITE | 세 API ID/필드·수량 조건, signed parser, date extent/continuation/repeated cursor | 기존 구현 유지 |

범위별 원본 근거는 [사전 감사](KIWOOM_CURRENT_MAIN_AUDIT.md)에 기록했습니다. 과거 문서는 [2026-10-04 검증 기록](KIWOOM_FLOW_VERIFICATION_2026-10-04.md)과 [과거 설정 문서](KIWOOM_FLOW_SETUP_2026-10-04.md)로 보존했습니다. 이전의 키 파일 수령·fixture 표시 기록은 이번 운영환경의 설정/수신 증거가 아닙니다.

## B. 변경 파일

- `artifacts/kiwoom-current-main/runtime-config.json`
- `artifacts/kiwoom-current-main/verification.json`
- `docs/upgrade/KIWOOM_CURRENT_MAIN_AUDIT.md`
- `docs/upgrade/KIWOOM_FLOW_SETUP.md`
- `docs/upgrade/KIWOOM_FLOW_SETUP_2026-10-04.md`
- `docs/upgrade/KIWOOM_FLOW_VERIFICATION.md`
- `docs/upgrade/KIWOOM_FLOW_VERIFICATION_2026-10-04.md`
- `migrations/0003_kiwoom_collection_targets.sql`
- `package.json`
- `scripts/Run-KiwoomCollector.ps1`
- `scripts/check-auth-invariant.test.mjs`
- `scripts/kiwoom-cli.mjs`
- `scripts/kiwoom-cli.test.mjs`
- `scripts/kiwoom-session.test.mjs`
- `scripts/migrate.mjs`
- `scripts/run-script-tests.mjs`
- `scripts/with-app-env.mjs`
- `scripts/with-app-env.test.mjs`
- `src/components/charts/pro/ProChart.tsx`
- `src/components/charts/pro/useHtsPanes.ts`
- `src/components/stocks/TradingChart.tsx`
- `src/lib/auth/kiwoom-middleware.ts`
- `src/lib/chart-flow-fns.ts`
- `src/lib/charts/hts-flow.ts`
- `src/lib/charts/hts-layout.ts`
- `src/lib/charts/product-resolution.ts`
- `src/lib/charts/use-chart-security.ts`
- `src/lib/use-chart-flow.ts`
- `src/routes/status.kiwoom.tsx`
- `src/routes/stock.$ticker.tsx`
- `src/server/chart-flow.ts`
- `src/server/kiwoom-config.ts`
- `src/server/kiwoom-db.ts`
- `src/server/kiwoom-diagnostics.ts`
- `src/server/kiwoom-runtime.ts`
- `src/server/kiwoom-store.ts`
- `src/server/kiwoom-targets.ts`
- `src/server/kiwoom.test.ts`
- `vite.config.ts`

`Set-KiwoomSession.ps1`, 다른 가격/뉴스/KIS 기능, 기존 차트의 선·패널·시간축·십자선 구현을 유지했습니다.
생성된 로컬 빌드는 `.qa/kiwoom-current-main-build`에 보관하고 추적된 `.vercel/output`의 빌드 부수 변경은 원래 상태로 되돌렸습니다. 문서/코드 변경과 배포 산출물을 혼동하지 않습니다.

## C. 유지한 올바른 구현

- ka10013 → crd_trde_trend.remn_rt (%).
- ka10008 → stk_frgnr.wght (%).
- ka10059 → stk_invsr_orgn.invtrt (부호를 보존하는 주 수량), 기존 amt_qty_tp/trde_tp/unit_tp 조건.
- percentage points, 0과 음수, KST 만료 해석, 원자료 날짜·중복/upsert 정상 값 보호.
- 페이지 날짜 최소/최대, cont-yn/next-key, 중복 커서·진행 중단·예산 제한·재개 안전장치.
- ka10015는 명시적인 cross-check 전용이며 생산 관측으로 대체하지 않음.
- 실제 API 응답이 제공되지 않아 기존 계약을 추측으로 다시 작성하지 않음.

## 코드 실행 검증 — 실데이터 증거 아님

| 명령 | 결과 | 의미 |
| --- | --- | --- |
| npm run typecheck | PASS | 타입 검사 |
| npm run test:kiwoom | 47/47 PASS | 단위/fixture/PGlite 계약 검사 |
| npm test | 604/604 PASS | scripts 207 + TypeScript 397, skipped 0; 위 47개 포함 |
| npm run lint | 종료 0, 오류 0, 경고 56 | 기존 경고를 제거하거나 숨기지 않음 |
| npm run build:bundle | PASS | Windows 로컬 client/server 번들, DB migration/배포 없음 |
| npm run kiwoom:doctor | 종료 1 | DISABLED + DATABASE_MISSING; 현재 환경은 실제 gate 조건 미충족 |
| git diff --check | PASS | 패치 공백 검사 |

Windows에서 quoted test glob이 테스트 0개를 성공으로 반환하던 문제를 파일 목록 runner로 수정했습니다. 실제 실행 후 발견된 두 directory-symlink 테스트는 Windows junction을 사용하도록 바꾸고, CLI/래퍼 기대 결과를 새 정책에 맞춰 갱신했습니다. 보안 검사를 건너뛰거나 실제 API를 테스트로 대체하지 않았습니다.

React 검토 스킬은 중복 조회·bounded retry·접근성·훅 사용을 확인하는 데 사용했고 기존 UI 디자인 기준을 보존했습니다. 실데이터 확인 순서는 사용자가 지정한 gate가 우선입니다. 브라우저를 먼저 열거나 fixture screenshot으로 실제 차트를 검증한 것으로 기록하지 않았습니다.

빌드에는 기존 큰 chunk/native builder OS 경고가 있습니다. Windows prebuilt를 Linux 플랫폼의 배포 성공으로 사용하지 않았습니다. 대상 플랫폼에서 검토된 commit을 다시 빌드해야 합니다.

## D. 이번 실행환경의 실제 증거

다음 boolean은 [현재 doctor 원문](../../artifacts/kiwoom-current-main/runtime-config.json)에 따른 값입니다. false인 DB/IP/OAuth 항목은 실제 운영 시스템 실패를 확인한 값이 아니라 **미설정/미실행**임을 구분합니다.

| 항목 | 이번 세션의 값 |
| --- | --- |
| flowEnabled | false |
| credentialsConfigured | false |
| databaseConnected | false |
| schemaReady | false |
| dataScopeMatched | false |
| ownerAuthorizationRequired | false (collector 공개 읽기 정책) |
| egressMatched | false (collector에서 NOT_REQUIRED; 실제 등록 IP 검사 미실시) |
| oauthSucceeded | false (NOT_TESTED) |
| ka10013 real rows | NOT_TESTED |
| ka10008 real rows | NOT_TESTED |
| ka10059 real rows | NOT_TESTED |
| persistent DB real rows | NOT_TESTED |
| web DB read | NOT_VERIFIED |
| chart real values | NOT_VERIFIED |
| deployed revision | NOT_VERIFIED / DEPLOYMENT_NOT_VERIFIED |

Gate 1은 DISABLED/DATABASE_MISSING으로 중단했습니다. Gate 2 OAuth, Gate 3 실제 3 API, Gate 4 영속 DB+별도 프로세스, Gate 5 collector 웹 DB 읽기+Kiwoom 요청 0회 계측, Gate 6 실제 기존 차트 대조는 실행하지 않았습니다. 실제 배포 revision도 미검증입니다. 이번 작업에서 합성 fixture/PGlite 행은 실수신 건수에 포함하지 않습니다.

## 운영자가 수행할 외부 단계

1. 등록된 출발 IPv4를 사용하는 PC/NAS에서 실제 key/secret/DB 파일을 실행자 전용 권한으로 준비합니다. 현재 제공된 IP 220.72.76.41은 운영자 설정이지 제품 상수가 아닙니다.
2. 웹과 수집기에 같은 영속 PostgreSQL·KIWOOM_DATA_SCOPE_ID를 주입하고 명시적으로 npm run db:migrate를 실행합니다. 기존 owner-scope 행이 있으면 서버-only legacy 설정/비파괴 copy를 먼저 검토합니다.
3. [현재 설정 문서](KIWOOM_FLOW_SETUP.md)의 Windows 명령을 실행해 doctor/IP, OAuth, 005930 실제 세 API, bounded 저장, 별도 프로세스 재조회 증거를 확보합니다. 실패한 gate 뒤로 진행하지 않습니다.
4. 같은 DB/scope의 collector 웹앱에서 broker/OAuth/IP 요청 0회를 계측하고 실제 서버 값·기존 3 패널·동일 날짜 DB 값을 대조합니다.
5. 수정본을 검토/commit한 뒤 대상 플랫폼에서 빌드·배포하고 running short revision과 GitHub commit을 비교합니다. 실제 URL/세션 접근은 별도로 필요합니다.

## E. 최종 상태

`CODE_READY_REAL_DATA_NOT_VERIFIED`
