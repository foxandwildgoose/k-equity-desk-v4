# 키움 실전 경로·코드 변경 검증 기록

기록일: 2026-10-05 (한국시간). 이번 자동 수집 개선의 시작 remote main: 8f570097d03c277a6f3fcd0b5c5015953dc75d6d. 아래 3~6절은 이전 hardening 변경의 시작 c563c646fcaa849ca6a7edb106815a0e24287427과 최종 8f570097 기준 기록입니다. 이번 자동화 변경은 7절에 분리합니다.

**실전 경로는 운영자가 확인했습니다.** 이 기록은 운영자가 제공한 production logs/browser 검증과 Codex의 코드·로컬 검증을 구분합니다. Codex가 직접 live broker 호출을 실행했다고 주장하지 않습니다. 이번 변경을 반영한 배포와 Windows 자동 작업 설치는 **DEPLOYMENT_RECHECK_REQUIRED**, 최종 운영 상태는 **CODE_UPDATED_PRODUCTION_RECHECK_REQUIRED**입니다. 과거 674개 PASS는 이번 자동화 수정의 재실행 결과가 아닙니다.

## 1. 과거 Codex 코드 검증의 출처

[artifacts/kiwoom-current-main/README.md](../../artifacts/kiwoom-current-main/README.md)의 두 JSON은 당시 환경의 pre-live snapshot입니다. 당시 baseline은 2266d0f671391d5fe51211c6c2b6a6b151abb6a9, 로컬 변경만 있던 시점으로 기록되었습니다. 테스트 47/604개, lint 경고 56개, Windows 로컬 bundle과 DISABLED/DATABASE_MISSING·OAuth NOT_TESTED는 **그 실행 환경·시점**의 기록이며 현재 운영 실패로 읽으면 안 됩니다.

두 JSON은 byte 단위로 보존하고 새 성공 값으로 덮어쓰지 않습니다. 과거 [2026-10-04 설정](KIWOOM_FLOW_SETUP_2026-10-04.md), [2026-10-04 검증](KIWOOM_FLOW_VERIFICATION_2026-10-04.md), [당시 감사](KIWOOM_CURRENT_MAIN_AUDIT.md)도 역사적 기록입니다. 현재 문서의 실제 등록 IP는 자리표시자로 비식별화했습니다. 과거 fixture/PGlite 행은 실수신 건수가 아닙니다.

## 2. 운영자 제공 실전 검증 — REAL_DATA_VERIFIED

출처는 **operator-verified production logs and browser verification**, 날짜는 2026-10-05입니다. [새 비밀값 없는 증거 JSON](../../artifacts/kiwoom-production-live/verification-2026-10-05.json)은 이번 지시문이 제공한 건수·날짜만 전사했습니다. 원본 로그의 독립 수집/재실행을 뜻하지 않습니다. **codexExecutedLiveBrokerCalls=false**입니다.

구성은 **고정 출발 IP Windows 수집기 → 키움 실전 REST → 공유 Neon PostgreSQL → Vercel collector 웹 → 기존 세 패널**입니다.

| 항목 | 운영자 확인 결과 |
| --- | --- |
| flowEnabled / environment / mode | true / real / direct (Windows 수집기) |
| App Key / App Secret 설정 여부 | true / true; 값 기록 없음 |
| databaseConfigured / databaseConnected / schemaReady | true / true / true |
| egressStatus / issues | IP_MATCH / [] |
| OAuth | TOKEN_OK / real |
| Vercel | collector / real; broker 자격증명 불필요 |

### 005930 실제 1페이지 수신

| API | HTTP / 업무 성공 | 행 수 | 유효 값 | 최초 날짜 | 최종 날짜 |
| --- | --- | ---: | ---: | --- | --- |
| ka10013 | true / true | 100 | 100 | 2026-05-08 | 2026-10-02 |
| ka10008 | true / true | 50 | 50 | 2026-07-22 | 2026-10-02 |
| ka10059 | true / true | 100 | 100 | 2026-05-08 | 2026-10-02 |

### 005930 약 1년 수집과 영속 DB 재조회

| 지표 | 행 수 / 유효 값 | 최초~최종 날짜 | 페이지 | 수집 상태 | 별도 프로세스 |
| --- | --- | --- | ---: | --- | --- |
| 신용잔고율 | 241 / 241 | 2025-10-10~2026-10-02 | 3 | ready / complete=true / errorCode=null | STORED / 241 / 241 |
| 외국인보유비율 | 241 / 241 | 2025-10-10~2026-10-02 | 5 | ready / complete=true / errorCode=null | STORED / 241 / 241 |
| 투신 일별 순매수 | 241 / 241 | 2025-10-10~2026-10-02 | 3 | ready / complete=true / errorCode=null | STORED / 241 / 241 |

세 수집·재조회 결과 모두 providerReal=true입니다. 이 표기의 의미는 실제 OAuth/API/저장 실행 증거에 연결되며 표기만으로 독립적인 실수신 증명을 만들지 않습니다. 같은 Neon DB의 네 테이블 준비를 운영자가 확인했습니다: kiwoom_flow_observations, kiwoom_flow_jobs, kiwoom_flow_coordination, kiwoom_collection_targets. migration은 0002/0003이며 일반 빌드의 부수효과로 실행하지 않습니다.

### 운영자 확인 당시 Vercel과 화면

운영자는 당시 current main에서 배포된 canonical 앱의 /, /status/kiwoom, /stock/005930이 각각 HTTP 200이고 collector 서버가 공유 DB를 읽으며 세 실제 패널이 표시됨을 확인했습니다. Vercel에는 broker 자격증명이 필요하지 않았습니다.

2026-10-02 dataset의 역사적 화면 관측은 신용 약 **0.37%**, 외국인 보유 약 **46.41%**, 투신 가용 구간 누적 약 **-8,904,915주**였습니다. 표시 시작은 **2025-10-10**, 모드는 **available-cumulative**였습니다. 이는 **검증 문서의 과거 관측**이며 앱 계산/서비스/fixture의 상수로 사용하지 않습니다. 다른 시점·종목의 현재 값도 아닙니다.

이 경로에 대해서만 **REAL_DATA_VERIFIED — operator-verified real production path**로 기록합니다. sandbox의 과거 미설정 상태로 운영자 증거를 부정하지 않으며, 운영자 성공으로 Codex의 미실행 broker 검사를 실행했다고 바꾸지도 않습니다.

## 3. 이번 코드 변경의 원인과 범위

| 확인된 원인 | 이번 변경 |
| --- | --- |
| 새 기본 cumulative와 오래된 고정 시작일이 실제 최초 제공일보다 앞서면 누적 null | 신규 국내 stock/ETF/ETN 및 기본값 복원은 available-cumulative; 저장된 명시적 세 모드는 보존 |
| 공개 collector 읽기가 정상이어도 방문자 OWNER_AUTH_FAILED가 전체 장애처럼 표시 | PUBLIC_READ_CONFIGURED와 시장 읽기/운영 상세 권한을 분리; 상세·비공개 읽기·direct 인증은 유지 |
| Windows npm.ps1 선택 또는 PowerShell 정책으로 명령 중단 | Windows npm.cmd 호출과 process-scoped 실행·작업 스케줄러 절차 |
| 추적 .vercel/output이 오래된 Windows prebuilt를 배포했던 기존 장애 | tslib production 의존성·패치 버전·ignored/untracked output을 check:deploy로 보호 |

ka10013.remn_rt, ka10008.wght, ka10059.invtrt의 실수신 검증된 매핑, signed quantity·0, KST token 만료, 날짜 extent, continuation, 커서/중복 보호, 날짜별 저장을 보존합니다. 투신은 일별 순매수 원자료이며 보유잔고가 아닙니다. fixed-start 이력 부족·거래일 누락은 계속 null이고 0으로 채우지 않습니다. ka10015는 diagnostic-only입니다.

Bollinger·SMA·매물대·가격·뉴스·리서치·다른 공급자 기능을 변경하지 않습니다. 새 DB/ORM·주문 기능·공개 broker proxy·Vercel direct 호출을 추가하지 않습니다. 운영 비밀값·실제 등록 IP·owner ID·DB URL·token·raw response는 새 증거/문서에 기록하지 않습니다.

## 4. 이번 변경 후 배포 재확인

**DEPLOYMENT_RECHECK_REQUIRED.** 운영자 확인 HTTP 200·차트 표시는 위 변경 전 시점의 사실입니다. 이번 수정본의 URL·revision·화면 확인으로 확대하지 않습니다. 코드 push는 운영 배포나 DB migration의 증거가 아닙니다.

운영자가 새 source deployment 후 확인할 항목:

1. Git source로 재빌드하고 배포 로그에 Using prebuilt build artifacts from .vercel/output가 소스 경로로 사용되지 않는지 확인합니다. generated output을 Git에 추가하지 않습니다.
2. /, /status/kiwoom, /stock/005930 실제 응답과 짧은 revision을 배포 commit에 대조합니다.
3. 공개 collector 방문자의 자료 읽기 설정과 owner-only 상세가 분리되는지 확인합니다. visitor DB 상태는 미점검이며 owner 세션에서 실제 저장 지표를 확인합니다.
4. 신규 차트/기본값 복원은 available-cumulative와 실제 시작일을 표시하는지 확인합니다. 기존 명시 daily/cumulative/available-cumulative도 보존하는지 확인합니다.
5. Windows doctor/IP→OAuth→세 API→수집→별도 DB read→bounded targets 순서와 작업 실행자/ACL/출발 IP를 확인합니다. Vercel은 같은 Neon DB의 collector 모드입니다.

005930 외 ETF/ETN·HPSP의 이번 production 실수신, 동일 HTS 표 대조, 모든 상품의 장기 제공 기간은 위 운영자 증거에 포함되지 않습니다. 공표시각·단위 확인이 없는 자료를 더 강한 증거로 취급하지 않습니다. 유료 서비스·OS 작업 설치·운영 비밀값 변경은 하지 않습니다.

이번 소스의 로컬 검사 결과는 아래에 별도로 기록하며 테스트를 새 실전 호출/운영 배포 성공으로 사용하지 않습니다.


## 5. Codex가 실행한 이번 로컬 검사

실행 환경은 Linux, Node 22.23.3입니다. 아래는 이번 수정본의 실제 로컬 검사 결과이며 운영자 실전 증거와 별개입니다. 현재 Codex 프로세스의 App Key/App Secret/DATABASE_URL 설정 여부는 각각 false/false/false였습니다. collector 모드에서 egress/token은 NOT_REQUIRED이며 broker 호출, 운영 DB 변경, migration, 작업 스케줄러 설치 또는 운영 배포를 실행하지 않았습니다.

| 실제 실행 명령 | 결과 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run test:kiwoom` | PASS — 52 tests, 0 failed/skipped |
| `npm run test:bollinger` | PASS — 55 tests, 0 failed/skipped |
| `npm test` | PASS — script 214 + TypeScript 460 = 674 tests, 0 failed/skipped |
| `npm run lint` | PASS — 0 errors, 기존 경고 56개 |
| `npm run build:bundle` | PASS — Linux source bundle, tslib 2.8.1 tracing 확인; DB migration 없음 |
| `npm run check:deploy` | PASS — ignored/untracked output, production tslib, manifest/lock 보안 버전 하한 |
| `npm run verify:kiwoom -- --check-config` | PASS — API/DB 호출 없는 설정 진단; 현재 local DISABLED/DATABASE_MISSING |
| `git diff --check` | PASS |
| `git ls-files .vercel/output` | PASS — 출력 없음 |

새 회귀 검사는 신규 국내 stock/ETF/ETN 기본값, 저장된 세 명시 모드 유지, 실제 가용 시작일, 이전 고정 시작의 null, 0·음수 보존, 공개/비공개/direct 진단 권한, 소유자 SELECT-only 상세와 비밀 미노출을 확인합니다. Windows 분기는 Linux PowerShell 7에서 mocked npm.cmd로 실행했고 관련 Windows/deploy 10 tests가 모두 통과했습니다. 실제 Windows 작업 실행을 대신하지 않습니다. 기존 수집·페이지·토큰·저장·시장/환경 분리 및 Bollinger/SMA 테스트도 유지합니다.

과거 artifacts/kiwoom-current-main의 JSON 두 파일은 시작 main의 bytes와 직접 비교하여 일치했습니다. 자격증명 파일 패턴과 .vercel/output은 추적되지 않습니다. 실제 등록 IP는 현재 추적 문서에서 자리표시자로 교체했습니다. package-lock과 기존 API/client/store/middleware/migration은 변경하지 않았습니다.

## 6. 빌드된 앱의 합성 fixture 브라우저 검사

기존 collector/parser/store/정렬 경로를 isolated PGlite fixture로 사용하고 테스트 RPC만 가로챘습니다. 운영 시세·공시·키움 응답을 fixture로 대체한 배포가 아니며, 캡처에는 QA SYNTHETIC 표시가 있습니다.

실제 실행:

~~~sh
node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/qa-kiwoom-production.mjs --base http://127.0.0.1:8186 --server-entry /workspace/.onboarding/builds/k-equity-desk-v4/functions/__server.func/index.mjs
npm run qa:chart-hts -- --mode fixture --base http://127.0.0.1:8186 --function-map /workspace/screenshots/kiwoom-production-hardening/function-map.json --cases stock-403870,etf-069500 --viewports desktop,mobile --interactions --checks 'HTS defaults,Kiwoom daily values' --out /workspace/screenshots/kiwoom-production-hardening/hts-regression
~~~

재실행용 npm 별칭은 `npm run qa:kiwoom-production -- ...`이며 위 node 명령과 동일 실행 경로입니다. focused QA는 desktop/mobile **2/2 PASS**, 기존 HTS stock/ETF QA는 **4/4 PASS**입니다. 공개 읽기/소유자 상세 분리, visitor DB 미점검, private/direct 권한 유지, 신규 available-cumulative, saved daily/cumulative 새로고침·종목 왕복, 복원·재로드와 6개 pane 순서를 확인했습니다. synthetic 요청 시작 2025-01-02와 실제 유효 시작 2025-03-28을 구분하며 null·0·음수·누적을 검증했습니다. runtime errors=0, operational DB opens=0, IP checks=0, brokerCalled=false입니다.

로컬 브라우저 증거(실전 캡처 아님):

- `/workspace/screenshots/kiwoom-production-hardening/verdict.json`
- `/workspace/screenshots/kiwoom-production-hardening/public-status-desktop.png`
- `/workspace/screenshots/kiwoom-production-hardening/public-status-mobile.png`
- `/workspace/screenshots/kiwoom-production-hardening/available-default-desktop.png`
- `/workspace/screenshots/kiwoom-production-hardening/available-default-mobile.png`
- `/workspace/screenshots/kiwoom-production-hardening/hts-regression/verdict.json`

이 캡처와 source bundle은 실제 Vercel deployment 검증이 아닙니다. canonical 배포 URL·Vercel 접근 권한이 이 실행 환경에 확인되지 않아 새 revision의 실제 배포/Neon 화면은 **DEPLOYMENT_RECHECK_REQUIRED**로 남깁니다.


추가 일반 smoke 명령도 실행했습니다:

~~~sh
node scripts/browser-smoke.mjs http://127.0.0.1:8080/ /workspace/screenshots/kiwoom-production-hardening/dev-smoke.png
node scripts/browser-smoke.mjs http://127.0.0.1:8186/ /workspace/screenshots/kiwoom-production-hardening/built-smoke.png --baseline /workspace/screenshots/kiwoom-production-hardening/dev-smoke.json
~~~

이 두 일반 smoke는 exit 2로 **PASS가 아닙니다**. 기존 custom og.jpg 부재 경고, 실행 환경의 외부 리소스 `ERR_CERT_AUTHORITY_INVALID`, desktop의 비동기 지수 수신 문구에 따른 baseline prefix 차이를 기록했습니다. 두 viewport 모두 HTTP 200, visible content, horizontalOverflow=false, pageErrors=[]이며 네 실제 screenshot을 시각적으로 확인했습니다. 인증서 검증을 끄거나 branding/기존 시세 기능을 수정하여 통과시키지 않았습니다. 이는 위 fixture 기반 키움 기능 검사 통과와 별도로 남기는 일반 smoke의 제한입니다.

## 7. 지속 Windows 수집기 자동화 — 이번 변경

시작 main은 **8f570097d03c277a6f3fcd0b5c5015953dc75d6d**입니다. GitHub의 현재 main을 fetch하여 이 기준을 확인했습니다. 운영자가 이미 확인한 OAuth·세 API·Neon 영속 저장·Vercel 화면과 위 실수신 JSON은 보존하며 새 자동화 성공 기록으로 덮어쓰지 않습니다.

### 원인과 변경 범위

수동 collector가 종료되면 Vercel은 DB 대기열에 예약할 수 있지만 예약을 소비할 지속 프로세스가 없습니다. 이는 자동 실행·복구의 문제이며 verified API 매핑이 잘못되었다는 증거가 아닙니다. 이번 변경은 기존 Run-KiwoomCollector.ps1의 지속 poll을 Windows 로그온 작업으로 설치하고, PostgreSQL에 가동 상태를 저장해 소유자가 확인하도록 합니다.

- Install-KiwoomCollectorTask.ps1: 저장소 밖 비밀 파일과 명시 설정을 검증하고 현재 사용자의 로그온 작업을 등록·즉시 시작합니다. FILE PATH 인수만 사용하며 작업의 저장 비밀값은 없습니다.
- Get-KiwoomCollectorStatus.ps1 / Uninstall-KiwoomCollectorTask.ps1: 해당 소유 작업의 비식별 상태 조회와 안전한 제거를 제공합니다.
- Run-KiwoomCollector.ps1: 시작 gate를 한 번 실행하고 bounded targets를 기본 300초마다 처리합니다. npm.cmd, global mutex, DB lease, 실패 시 정리를 보존합니다.
- 0004_kiwoom_collector_runtime.sql: 기존 데이터 보존 additive migration입니다. scope/environment별 마지막 heartbeat·성공 주기·안전한 오류 코드·대기 수를 저장합니다. core 네 테이블의 기존 자료를 변경하지 않습니다.
- owner-only /status/kiwoom: RUNNING(10분 이하), STALE(30분 이하), OFFLINE(30분 초과), UNKNOWN(미검사·migration 없음·기록 없음)을 표시합니다. 공개 방문자에게 DB 작업 상세나 instance ID를 전달하지 않습니다.
- chart: collector DB 예약을 “키움 수집 예약됨 · 고정 IP 수집기 대기”로 표시합니다. queue 등록을 실제 worker 가동으로 표현하거나 결측을 0으로 채우지 않습니다.

변경 파일은 총 26개입니다.

| 목적 | 파일 |
| --- | --- |
| 일회 설치·조회·제거와 지속 worker | `scripts/Install-KiwoomCollectorTask.ps1`, `scripts/Get-KiwoomCollectorStatus.ps1`, `scripts/Uninstall-KiwoomCollectorTask.ps1`, `scripts/KiwoomCollectorHelpers.ps1`, `scripts/Run-KiwoomCollector.ps1`, `scripts/Set-KiwoomSession.ps1` |
| 영속 heartbeat·안전한 수집 상태 | `migrations/0004_kiwoom_collector_runtime.sql`, `src/server/kiwoom-collector-runtime.ts`, `src/server/kiwoom-store.ts`, `scripts/kiwoom-cli.mjs`, `package.json` |
| 소유자 진단·실제 차트 상태 전달 | `src/server/kiwoom-runtime.ts`, `src/routes/status.kiwoom.tsx`, `src/server/chart-flow.ts`, `src/lib/charts/hts-flow.ts`, `src/lib/charts/hts-layout.ts` |
| 회귀·브라우저 검사 | `scripts/kiwoom-heartbeat.test.mjs`, `scripts/kiwoom-scheduler.test.mjs`, `scripts/kiwoom-session.test.mjs`, `scripts/qa-kiwoom-production.mjs`, `src/server/kiwoom-collector-runtime.test.ts`, `src/server/kiwoom-diagnostics.test.ts`, `src/server/kiwoom.test.ts`, `src/lib/charts/hts-layout.test.ts` |
| 설정·검증 기록 | `docs/upgrade/KIWOOM_FLOW_SETUP.md`, `docs/upgrade/KIWOOM_FLOW_VERIFICATION.md` |

작업은 재부팅 후에도 남지만 설치한 사용자가 로그온해야 실행합니다. Network available/start when available 설정, 실패 후 5분 간격 최대 12회 재시작, IgnoreNew 및 기존 mutex/lease를 사용합니다. SYSTEM·저장 암호·로그온 전 부팅 서비스는 만들지 않습니다. 여기서 Windows 작업을 실제 등록하지 않았습니다.

비싼 005930 실전 검증은 매 시작 한 번이며 매 poll마다 실행하지 않습니다. due 예약의 발견은 유휴·정상 네트워크 상태에서 기본 5분 이내를 목표로 합니다. 최대 10개씩의 bounded 순차 처리, 이미 실행 중인 수집, backoff·일시 장애·공급자 이력과 별도 차트 5분 재조회에 따른 추가 시간은 그대로 적용합니다. 전체 데이터가 5분 안에 표시된다고 보장하지 않습니다.

### 운영자에게 남은 한 번 작업

[설정 문서의 정확한 명령](KIWOOM_FLOW_SETUP.md#windows에서-한-번-설정)으로 0004를 포함한 명시적 migration → installer → task status 확인을 수행합니다. 파일은 저장소 밖 실행자 전용 ACL로 관리하고 수집기·웹은 같은 Neon DB와 market-global-v1을 사용합니다. 설치 후에는 manual DATABASE_URL/key/secret/mode export 또는 sync 실행 없이 차트를 여는 흐름입니다. PC 전원·로그온·등록 출발 IP·네트워크는 계속 필요합니다.

Vercel에는 새 source revision을 배포한 뒤 기존 collector 설정으로 /status/kiwoom 소유자 상세·공개 방문자 분리·부족한 국내 종목 예약과 실제 자동 수집 결과를 확인해야 합니다. 0004 미적용 상태의 UNKNOWN은 기존 운영자 실수신 증거를 취소하지 않습니다. Codex가 운영 DB migration, Windows 작업 설치, 실제 broker 호출 또는 운영 배포를 실행했다고 보고하지 않습니다.

### 이번 로컬 검증 결과

Linux, Node 22.23.3, PowerShell 7의 격리된 테스트에서 실행했습니다. 현재 Codex 프로세스의 App Key/App Secret/DATABASE_URL 설정 여부는 각각 false/false/false입니다. 사용자의 자격증명 수령 또는 과거 운영 설정을 부정하는 상태가 아닙니다. 운영 API·DB·migration·예약 작업 등록은 실행하지 않았습니다.

| 실제 실행 명령 | 결과 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run test:kiwoom` | PASS — 64 tests, 0 failed/skipped |
| `npm test` | PASS — script 224 + TypeScript 473 = 697 tests, 0 failed/skipped |
| `npm run lint` | PASS — 0 errors, 기존 경고 56개 |
| `npm run check:deploy` | PASS |
| `npm run build:bundle` | PASS — Linux production bundle; DB migration 없음 |
| `npm run verify:kiwoom -- --check-config` | PASS — API/DB 호출 없음; 현재 local DISABLED/DATABASE_MISSING |
| `git diff --check` | PASS |
| `git ls-files .vercel/output` 및 비밀 파일 세 패턴 | PASS — 추적 파일 없음 |

PowerShell/worker 12개 검사는 실제 Linux PowerShell 7과 mocked ScheduledTasks/npm.cmd를 사용하여 모두 통과했습니다. 파일 내용 미출력, literal 인수/공백·특수문자 경로, poll 60~600초, 타 사용자 작업·보안/트리거 설정 변경 거부, Windows 호환 구문, 실제 두 프로세스의 global mutex, startup 한 번/동일 worker GUID/지속 queue 처리를 검사했습니다. 실제 Windows 예약 작업 등록·로그온·재부팅 검증을 대신하지 않습니다.

11개 runtime 검사는 10/30분 경계·UNKNOWN, 안전한 오류 enum, scope/environment 분리, 100개 상한과 due 대상 수, 기존 데이터 보존/idempotent migration, 오래된 worker 갱신 거부, 격리된 파일형 PGlite 재시작 보존, target lease 상실 시 완료 기록 차단을 검사했습니다. 파일형 PGlite 검사는 운영 Neon 영속성의 새 증거가 아닙니다. 기존 API 필드·부호/0·연속조회·IP_MATCH gate와 collector 웹 broker 호출 금지 검사는 유지합니다. 일반 수동 CLI sync는 지속 worker heartbeat를 바꾸지 않습니다.

브라우저 검사에서 날짜별 결측 사유가 실제 수집 대기 사유를 덮어쓰는 문제를 발견했습니다. `hts-layout.ts`에서 둘을 보존하고 회귀 테스트를 추가했습니다. 기본 공개 차트는 운영 인증 문맥을 전달하지 않으므로 소유자는 `/status/kiwoom`에서 OFFLINE 상세를 확인합니다. 인증된 차트 문맥의 경고는 서버가 검증한 소유자에게만 반환하며 공개 방문자에게 heartbeat를 보내지 않습니다.

새 Linux production build를 별도 preview에서 실행한 브라우저 재검사는 desktop/mobile **2/2 PASS**, 소유자 heartbeat 네 상태 **8/8 PASS**, 공개/인증 문맥의 실제 대기 안내 **4/4 PASS**입니다. 기존 daily/cumulative/available-cumulative, 새로고침·종목 왕복, 6개 canvas pane도 유지합니다. 최초 실행의 누락된 대기 안내를 수정한 후 재빌드·재검사했으며, 오래된 preview 재사용으로 발생한 로드 실패는 새 preview 프로세스로 재검사했습니다.

~~~sh
node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/qa-kiwoom-production.mjs --base http://127.0.0.1:8188 --server-entry /workspace/.onboarding/builds/k-equity-desk-v4/functions/__server.func/index.mjs --out /workspace/screenshots/kiwoom-collector-automation
~~~

재실행 시 동일 경로의 npm 별칭 `npm run qa:kiwoom-production -- ...`을 사용할 수 있습니다.

캡처·판정: `/workspace/screenshots/kiwoom-collector-automation/verdict.json`, `collector-running-desktop.png`, `collector-offline-mobile.png`, `collector-public-mobile.png`, `queue-public-desktop.png`, `queue-owner-mobile.png`. 모든 캡처에 QA SYNTHETIC 표기가 있습니다. 실제 키움/운영 DB/IP 요청은 0이며 소유자 fixture는 실제 authorization guard를 통과하는 합성 identity입니다. 실제 Better Auth 소유자 로그인 검증, Windows 로그인/재부팅, 새 Neon heartbeat 및 운영 Vercel 확인을 대신하지 않습니다. 위 5~6절의 이전 검사·캡처는 역사적 기록으로 보존합니다.

현재 자동 작업 실설치·고정 IP 연속 가동·Neon heartbeat 실저장·이번 Vercel revision 화면은 **검증 대기**입니다. 이전 세 API의 실수신 경로는 계속 **REAL_DATA_VERIFIED — operator-verified**입니다. 이번 최종 운영 상태는 **CODE_UPDATED_PRODUCTION_RECHECK_REQUIRED**입니다.
