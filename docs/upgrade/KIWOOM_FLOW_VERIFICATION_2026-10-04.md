# 역사 기록 — 현재 실행환경/현재 설정의 증거가 아닙니다

2026-10-04의 기록을 변경 없이 보존합니다. 현재 상태는 KIWOOM_FLOW_VERIFICATION.md / KIWOOM_FLOW_SETUP.md를 참조하세요.

# 키움 3개 패널 연결 검증 — 2026-10-04

이번 작업은 기존 서버/클라이언트/DB/React Query/Lightweight Charts 경로를 수정했습니다. **CODE FIXED와 EXTERNAL CONFIGURATION STILL REQUIRED를 분리합니다.** 운영 배포·main 병합·운영 DB migration·등록 IP 변경은 실행하지 않았습니다.

기준: 작업 브랜치 `work`, 시작 HEAD `3ec921c40ff4a430e0e76ea82de8964eaee86246`. 기존 차트 표시 개선 커밋을 보존했습니다. 조사 시 원격 main은 `7cbb1500072f994f451cae92a7f15feadebb6787`입니다. GitHub 검토 브랜치는 `codex/kiwoom-production-path`입니다.

## 완료 상태

| 구분 | 상태 | 실제 확인 범위 |
| --- | --- | --- |
| A. 코드·자동 테스트 | **완료** | 전체 582 통과, 키움 전용 35 통과, typecheck/production bundling 통과. 실제 Better Auth 세션과 합성 API → 격리 DB → 서버 RPC → React Query → 세 canvas를 검사했습니다. 전체 lint의 기존 오류는 아래에 분리합니다. |
| B. 허용 IP의 키움 실수신 | **검증 대기** | 현재 키 두 개 미설정, 기대 IP 미설정. 등록 IP와의 최소 익명 비교는 `IP_UNVERIFIED`. 실전 키움 요청 **0회**, 005930/403870/069500 실제 수신 **0건**. |
| C. 영속 PostgreSQL·재시작 보존 | **검증 대기** | 운영 `DATABASE_URL` 미설정. SQL 계약·upsert·디스크 PGlite 재열기 테스트는 통과했지만 운영 PostgreSQL 또는 collector/웹앱의 공유 영속 DB 검증은 아닙니다. |
| D. 실제 배포 사이트 표시 | **검증 대기** | 개발/로컬 production 빌드 검사는 수행했습니다. 배포 URL·배포 설정·실제 소유자 세션·실전 DB 이력은 확인하지 못했고 배포를 실행하지 않았습니다. |

**세 지표 실연동 완료로 보고하지 않습니다.** HTS 표 대조도 미실시입니다. 제공 기간, 상품별 지원, ETF 주/좌 의미, 실제 최근/1년 다중 페이지 이력은 B/C/D에서 확인해야 합니다.

## 확인된 원인과 변경

| 확인된 내용 | 대응 | 코드 또는 운영 설정 |
| --- | --- | --- |
| 수집 플래그 기본 false | `DISABLED`를 키 누락과 분리하고 진단 boolean을 제공 | 운영에서 명시적 활성화 필요 |
| 체크아웃 auth-off, 실제 owner 검증은 필수인데 login/API 라우트와 적용 대상 auth 스키마가 없었음 | 기존 Better Auth의 `/login`, `/api/auth/*`, 로그아웃, email/password 옵션을 연결. 원본 스키마의 동일 복사본을 기존 migration 목록에 추가 | 코드 수정 + 운영 인증/소유자 설정 필요 |
| `not-configured`를 항상 인증 미설정으로 표시 | 플래그/키/owner/DB/schema/IP/token/API/parser/history 상태를 별도 전달 | 코드 수정 |
| 종료 페이지의 선택적 `cont-yn` 누락을 파싱 오류로 처리 | 공식 스키마에 맞춰 종료의 누락/빈 값은 N, Y의 next-key 누락은 계속 실패/partial | 코드 수정 |
| 같은 페이지의 invalid 중복이 valid 관측을 덮을 수 있었음 | 유효한 0/음수 포함 정상 관측 우선; 저장된 정상 값의 null 보호도 유지 | 코드 수정 |
| direct의 5분 IP 확인 캐시 | 매 direct 작업 재확인; match 이전에 키움 호출 금지 | 코드 수정; 실제 고정 IP 필요 |
| 운영 DB 설정/적용 여부를 진단할 명령 부족 | 세 테이블/마이그레이션 기록을 읽기 전용 검사. DB 누락/연결 실패/스키마 누락 분리 | 코드 수정; 운영 DB 연결/적용은 대기 |
| 현재 Nitro/Rolldown이 빌드 성공 후 SSR chunk에 선언되지 않은 `ssr_exports`를 내보내 실제 서버가 500으로 시작 | Nitro의 지원 옵션 `inlineDynamicImports`로 서버 chunk를 내장하고 실제 production 프로세스를 새로 시작해 진단 페이지/인증 API 확인 | `vite.config.ts` 최소 설정 수정; 브라우저 chart/code splitting 유지 |

**이미 올바르던 부분:** API ID/필드, signed `invtrt`, 퍼센트의 0~100 단위, KST 만료 해석, 공유 DB 제한기·토큰 single-flight, 기본 collector 구조는 존재했습니다. 이를 실패 원인이라고 단정하거나 재작성하지 않았습니다. 파서는 이미 날짜를 정렬했지만 페이지 범위 계산을 명시적 최소/최대로 바꿔 원래 행 순서에 의존하지 않도록 했습니다. 실제 Vercel 설정과 외부 IP는 미확인이며 체크아웃 상태를 운영 상태로 단정하지 않습니다.

## 실제 데이터 경로와 API

`ProChart → useChartFlow → POST getChartFlow → 같은 출처 검사/실제 세션 → assertKiwoomOwner → chart-flow → 기존 getSql/kiwoom-store → 일별 정렬·고정 누적 → useHtsPanes`입니다.

- collector: 웹 요청은 공유 PostgreSQL만 읽습니다. 키움 키·IP 조회·토큰·API 호출이 필요하지 않습니다.
- direct: 설정/DB/schema/소유자 검증과 출발 IP 확인 후 기존 클라이언트/수집기가 조회·저장합니다.
- 로컬 CLI: OS 실행자 권한, 명시적 `--live`, IP match, 토큰, 세 API, bounded continuation/upsert/재개 순서입니다.
- `ka10013`: `/api/dostk/stkinfo`, `qry_tp=1`, `crd_trde_trend[].remn_rt` (%), 참고 `remn`.
- `ka10008`: `/api/dostk/frgnistt`, `stk_frgnr[].wght` (%), 참고 `poss_stkcnt`.
- `ka10059`: `/api/dostk/stkinfo`, 수량/순매수/단주 조건, `stk_invsr_orgn[].invtrt` (일별 signed 주).
- `ka10015`: 명시적 `verify --live --cross-check`에서만 `{stk_cd,strt_dt}`로 `daly_trde_dtl[].crd_remn_rt/for_wght` 대조. 같은 날짜만 비교하고 0.05 percentage points 초과 차이를 경고합니다. 원자료/차트/DB를 대체하지 않습니다.

## 실행 환경·자격증명·접근통제

사용자는 App Key와 App Secret **모두 수령**했습니다. 이전 파일 주입 검사 기록은 기존 `artifacts/kiwoom-flow`에 보존돼 있습니다. 이번의 일반 CLI/앱 프로세스에는 자동으로 주입되지 않았으며 실제 쌍/실전용 여부/토큰 성공을 확인하지 않았습니다. 키를 다시 채팅에 요청하지 않았습니다.

[현재 프로세스 설정](../../artifacts/kiwoom-production-path/runtime-config.json): `appKeyConfigured=false`, `appSecretConfigured=false`, `databaseConfigured=false`, `ownerConfigured=false`, `flowEnabled=false`. CLI의 auth boolean은 해당 셸 환경만 반영하며 `.grok/app-env.json`을 적용한 앱의 auth-off 또는 실제 배포 설정과 동일하다고 단정하지 않습니다.

[익명 IP 점검](../../artifacts/kiwoom-production-path/egress-check.json): `IP_UNVERIFIED`, OAuth `NOT_TESTED`, 키움 요청 0회. 등록 주소를 API 호스트·요청 Body·우회 헤더로 사용하지 않았으며 원격 프록시/IP 우회도 추가하지 않았습니다.

소유자 ID는 실제 Better Auth 세션에서 얻고 서버 값과 비교합니다. 계정 생성은 자동 소유자 등록이 아닙니다. `dev-user`, auth-off, 다른 계정, 미인증 요청을 거절합니다. 운영의 DB/세션 secret/origin 설정이 없으면 새 auth API는 503으로 닫힙니다. 진단 화면은 공개 설정 boolean만 제공하며 저장 데이터는 소유자에게만 제공합니다. 같은 출처 보호의 형제 사이트 스크립트 요청은 브라우저 QA에서 HTTP **403**을 확인했습니다.

세 비밀 파일 패턴과 `.env*`의 Git 추적 파일은 없습니다. 기존 `.gitignore` 보호를 유지했고 새 파일/번들에 실제 키를 넣지 않았습니다. 진단 결과는 키/토큰/헤더/IP/owner ID/cursor/공급자 원문을 반환하지 않습니다.

## 실행한 검사

Node 22.23.3, TypeScript, 시스템 Chromium, PowerShell 7.5.3(Linux) 사용. PowerShell 테스트는 `KIWOOM_TEST_PWSH` 및 쓰기 가능한 XDG 테스트 경로를 지정해 **skip 없이** 실행했습니다. Windows 실전 PC에서의 실행은 별도 대기입니다.

| 실제 명령 | 결과 / 근거 |
| --- | --- |
| `npm test` | scripts 207 + TypeScript 375 = **582 통과**, 실패/skip 0. [로그](../../artifacts/kiwoom-production-path/tests.log) |
| `npm run test:kiwoom` | **35 통과**, 실패/skip 0. [로그](../../artifacts/kiwoom-production-path/kiwoom-tests.log) |
| `npm run typecheck` | 통과. [로그](../../artifacts/kiwoom-production-path/typecheck.log) |
| `npm run lint` | **기존 오류 1, 경고 60**. 변경하지 않은 `src/lib/app-data/client.server.ts:214` no-empty. 기준 HEAD에도 존재. [로그](../../artifacts/kiwoom-production-path/lint.log) |
| 변경 파일 대상 ESLint | **오류 0, 기존 Sidebar fast-refresh 경고 1**. [로그](../../artifacts/kiwoom-production-path/changed-lint.log) |
| `env -u DATABASE_URL npm run build:bundle` | production client/server/Vercel bundling 통과. DB migration 없는 명령. [로그](../../artifacts/kiwoom-production-path/build.log) |
| `npm run verify:kiwoom -- --check-config` | 네트워크/DB 접근 없이 안전한 설정 상태 확인. 현재 프로세스에는 키/DB/소유자 없음 |
| `npm run qa:kiwoom-path` | 실제 인증/저장/RPC/React Query/3개 canvas 및 접근통제 통과. [결과](../../artifacts/kiwoom-production-path/browser/result.json) |
| 로컬 production 진단 화면·auth API | 진단 HTTP 200 / DISABLED, 미설정 auth HTTP 503, 저장 표 비공개 확인. [결과](../../artifacts/kiwoom-production-path/production-smoke.json) |

추가한 회귀 검사는 config/owner/auth readiness, read-only schema, 외부 IP 변화, optional 종료 헤더, 정순/역순 다중 페이지와 키 전달, invalid 중복/0/음수, HTTP401/만료 토큰/안전 여유 갱신, ka10015 비교·미저장, 005930 전체 mock 경로를 포함합니다. 기존 HTTP200 업무 오류/잘못된 Secret/환경 분리/재시도/429/timeout/single-flight/공유 취소/전역 DB 제한기, upsert/정정/누락 누적/주월 집계/종목 분리/분봉/리플레이/CSV 테스트를 유지했습니다.

PowerShell collector의 mode를 수집 머신의 역할에 맞게 direct로 바꾸고 해당 테스트도 같은 동작을 검사하도록 갱신했습니다. 인증 schema opt-in 테스트는 원본 동일성과 이미 적용한 schema의 재적용 방지를 검사합니다. generic 상태 문구 변경 테스트도 정확한 새 문구와 공급자 이유 보존을 검사합니다. 실패를 숨기기 위해 테스트를 삭제하거나 값 허용 범위를 넓히지 않았습니다.

## 브라우저 증거와 한계

`qa:kiwoom-path`는 **제품 코드에 mock 스위치를 추가하지 않고** 명시적인 QA 프로세스의 Vite dependency injection만 사용합니다. 운영 키/DB가 있으면 실행을 거부합니다. 실제 Better Auth로 격리 테스트 계정을 만들고 서명된 세션을 확인한 뒤, 합성 OAuth/세 API 각각 2페이지를 기존 수집기에서 처리합니다. 같은 격리 PGlite에 지표별 180일을 저장하고 collector 웹 경로가 DB만 읽는지 확인합니다. 서버 함수 응답과 React Query/실제 canvas/음수 일별 투신 표시를 검사했습니다. 이 메모리 DB는 C의 영속성 증거가 아닙니다.

- [소유자 진단 화면](../../artifacts/kiwoom-production-path/browser/owner-diagnostic.png)
- [005930 Light — 모의 응답/실제 세션](../../artifacts/kiwoom-production-path/browser/005930-light-mock-authenticated.png)
- [005930 Dark — 모의 응답/실제 세션](../../artifacts/kiwoom-production-path/browser/005930-dark-mock-authenticated.png)

순매수 +120000/-85000 등 화면 숫자는 **합성 fixture**이고 실제 삼성전자 수급으로 사용하지 않습니다. 공개 방문자는 저장 표에 접근하지 못합니다. 인증 검증을 위한 테스트 세션은 실제 broker OAuth나 운영 계정 검증이 아닙니다.

초기 QA에는 잘못된 설정 버튼 locator와 HTTP 테스트 클라이언트의 loopback 시간 초과가 있었습니다. 실제 `open-hts-settings` trigger와 직접 loopback HTTP 요청으로 수정 후 최종 성공했습니다. 개발 서버의 외부 요청 취소/인증서 오류 로그는 전체 홈의 성공 증거로 사용하지 않습니다. 배포 사이트 브라우저·HTS 대조는 미실시입니다.

추가 production 실행에서 SSR `ssr_exports` 오류를 발견하여 서버 bundling 설정을 수정했습니다. 최종 서버 entry는 약 8 MiB의 단일 파일이며 client lazy chunks/차트 라이브러리는 유지합니다. `node --check` 및 새 production 프로세스의 브라우저 점검을 통과했습니다. 원래 빌드 성공만으로 완료 처리하지 않았습니다. 실제 배포의 cold start/메모리 특성은 별도 점검해야 합니다.

## 남은 운영 순서

현재 추천은 **고정 IP collector**입니다. 일반 Vercel Hobby에서 사용자의 등록 IP를 기대하는 direct 모드를 사용하지 않습니다. Vercel Pro Static IPs는 실제 설정/등록이 완료된 경우의 별도 대안입니다.

1. 웹앱과 수집기에 동일 영속 PostgreSQL을 연결하고 기존 데이터 보존/백업 절차 후 `npm run db:migrate`로 auth/키움 schema를 적용합니다. `verify:kiwoom -- --check-database`로 조회 확인합니다.
2. 웹앱에 인증 활성/안전한 세션 설정, collector/real/enabled를 등록하고 빌드·재시작합니다. `/login`에서 본인 계정을 만들고 내 계정 ID를 양쪽 서버의 `KIWOOM_OWNER_USER_ID`로 설정합니다.
3. 등록 IP의 PC/NAS에서 지정 파일로 키 두 개를 dot-source 주입하고 direct/real/enabled/실제 expected IP를 설정합니다. `verify:kiwoom -- --check-config` 후 `--live --single-process`로 005930 소량 검증합니다.
4. 정상 수신 뒤 `kiwoom:collect -- --live ... --resume`으로 최근/1년 구간을 저장합니다. 별도 CLI의 `--read-stored`, 수집기/웹 서버 재시작, 실제 로그인 차트에서 보존/표시를 확인합니다.
5. 실제 확보 범위/누락/ETF 지원/단위/공표 시각 미확인을 점검하고 필요하면 진단 전용 `--cross-check`와 HTS 대조를 수행합니다.

정확한 Windows 명령, 반복 수집, 환경변수 표, 공식 근거는 [KIWOOM_FLOW_SETUP.md](KIWOOM_FLOW_SETUP.md)에 있습니다. 운영 키·DB URL을 채팅이나 Git에 넣지 않습니다.
