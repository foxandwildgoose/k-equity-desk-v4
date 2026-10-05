# 키움 실데이터 수집·웹 연결 설정

확인일: 2026-10-05 (한국시간). 코드 기준: current main `2266d0f`와 이 작업의 로컬 변경.
현재 결과는 `CODE_READY_REAL_DATA_NOT_VERIFIED`입니다. 이번 세션에는 실전 키/DB/기대 IP/배포 URL이 제공되지 않았습니다. 과거 첨부 파일 검증을 현재 실행환경의 인증 성공으로 취급하지 않습니다.

## 권장 구성

`등록 IP PC/NAS → 키움 REST → 공유 영속 PostgreSQL → collector 웹앱 → 기존 차트 패널`

| 서버 전용 설정 | 웹앱 | 등록 IP 수집기 |
| --- | --- | --- |
| KIWOOM_FLOW_ENABLED | true | true |
| KIWOOM_FLOW_MODE | collector | direct |
| KIWOOM_ENV | real | real |
| KIWOOM_DATA_SCOPE_ID | market-global-v1 | 같은 값 |
| DATABASE_URL | 공유 PostgreSQL | 같은 PostgreSQL |
| KIWOOM_APP_KEY / KIWOOM_APP_SECRET | 불필요 | 실행자 전용 파일에서 주입 |
| KIWOOM_EXPECTED_EGRESS_IP | 불필요 | 현재 실제 등록 IPv4 |
| KIWOOM_OWNER_USER_ID | 상세 관리자 진단/비공개 읽기에 사용 | 로컬 CLI에는 불필요 |
| VITE_AUTH_ENABLED | 공개 자료 읽기는 false 가능 | CLI는 OS 실행자 권한 |
| KIWOOM_READ_AUTH_REQUIRED | 기본 false; true면 소유자 읽기만 허용 | 웹 읽기 정책 |
| KIWOOM_TARGET_AUTH_REQUIRED | 기본 false; true면 소유자만 예약 가능 | 수집기의 DB 폴링에는 불필요 |

기본 모드는 collector이며 기능은 기본 비활성입니다. auth-off는 broker 접근 허가가 아닙니다. direct **웹** 접근은 실제 소유자 인증, 서버 자격증명, 일치하는 출발 IP가 모두 필요합니다. 인증 준비에는 기존 Better Auth의 설정과 실제 로그인 세션이 필요합니다. 공개 시장자료 읽기와 상세 관리자 진단의 권한은 다릅니다.

현재 운영자가 제공한 등록 IP는 `220.72.76.41`입니다. 앱의 보편적인 상수가 아니며 실행 전에 키움의 현재 허용 목록을 확인하세요. 실제 수집기에서 두 개 이상의 고정 허용 IP 확인 서비스가 유효한 IPv4에 동의해야 합니다. 불일치/단일 서비스만 성공/확인 불가이면 broker 호출을 막습니다. 인증정보는 IP 확인 서비스로 전송되지 않습니다. 서비스는 ipify, checkip.amazonaws.com, icanhazip.com이며 각 5초 제한, 리다이렉트 금지입니다.

## 운영 DB는 명시적으로 준비

운영 DB 연결 문자열을 서버/운영자의 비밀관리 환경에 주입한 뒤, 한 번 명시적으로 실행합니다.

```powershell
npm run db:migrate
```

관측·작업·조정·수집 대상 테이블과 additive migration `0003_kiwoom_collection_targets.sql`을 적용합니다. 일반 `build`와 `build:bundle`은 마이그레이션을 실행하지 않습니다. DB URL 누락은 성공/메모리 대체가 아니라 실패입니다. Kiwoom 운영 경로는 일반 앱의 PGlite fallback을 초기화하지 않고 PostgreSQL 연결만 사용합니다. 운영 연결·저장·별도 프로세스 재조회는 아직 검증하지 않았습니다.

## Windows 단일 수집 명령

DB 준비 후 저장소 디렉터리에서 실행합니다. 파일은 저장소 밖에 두고 해당 실행자만 읽도록 OS 권한을 제한하세요. App Key, App Secret, PostgreSQL URL은 각각 한 줄 파일입니다.

```powershell
pwsh -NoProfile -File .\scripts\Run-KiwoomCollector.ps1 `
  -AppKeyPath 'C:\Private\kiwoom_appkey.txt' `
  -AppSecretPath 'C:\Private\kiwoom_secretkey.txt' `
  -DatabaseUrlPath 'C:\Private\kiwoom_database.txt' `
  -ExpectedEgressIp '220.72.76.41' `
  -DataScopeId 'market-global-v1' `
  -FromDate '2025-10-05' `
  -Symbols 'stock:005930','etf:069500' `
  -RepeatEverySeconds 600
```

경로와 날짜는 실제 파일·필요 이력에 맞추세요. 이 명령은 키움 주문을 실행하지 않습니다. local CLI는 허위 Better Auth 소유자 ID를 만들지 않습니다. 래퍼는 자식 세션에 비밀값을 주입하고 doctor/IP → 실제 OAuth/005930 세 API 각 1페이지 → 수집 → 별도 프로세스 저장 조회 → 예약 폴링 순서로 실행합니다. partial/실패 시 0이 아닌 종료 코드로 멈춥니다. 다음 실행에서 같은 조건으로 재개합니다.

기본 `RepeatEverySeconds=0`은 1회 실행입니다. 반복 간격은 60초 이상이며 Named Mutex와 DB lease가 중복 실행을 막습니다. 작업 스케줄러를 사용한다면 동일 실행자, 저장소 작업 디렉터리, 새 인스턴스 시작 금지를 설정하세요. 이 작업은 스케줄러나 OS 설정을 설치/변경하지 않았습니다. 종료 후 App Key/Secret/DB 환경값을 지웁니다.

## 안전한 진단과 단계별 실수신 검증

1. `npm run kiwoom:doctor` — enabled/direct/real, 두 키, DB 연결, 네 테이블, egress IP_MATCH. 출력은 boolean/status/짧은 revision/저장 날짜·건수만 포함합니다. 키·토큰·owner ID·DB URL·raw response는 출력하지 않습니다.
2. `npm run verify:kiwoom -- --live --code 005930 --from 2026-09-01 --to 2026-10-05` — 먼저 TOKEN_OK, 그 다음 ka10013/ka10008/ka10059 각각 HTTP/business 성공, 행 수·유효 값 수·최초/최종 날짜를 확인합니다. 유효 값이 없으면 실패입니다.
3. `npm run sync:kiwoom-flow -- --live --code 005930 --from 2026-09-01 --to 2026-10-05 --resume` — bounded 수집으로 영속 저장합니다. 페이지/시간 예산 때문에 partial이면 재개하고 부족분을 숨기지 않습니다.
4. 새 프로세스에서 `npm run verify:kiwoom -- --read-stored --code 005930 --from 2026-09-01 --to 2026-10-05` — 세 지표의 실제 날짜/유효 값/real provider 표기를 확인합니다. 이 표기 자체는 합성 여부의 독립 증거가 아니므로 실제 OAuth/API 실행 증거와 연결해야 합니다.
5. 웹은 위 표의 collector 설정으로 시작합니다. 같은 DB/scope를 읽고 웹 서버에서 Kiwoom OAuth/API/IP 요청이 0회임을 네트워크 계측으로 확인합니다.
6. 기존 005930 차트의 세 패널과 실제 서버 응답을 확인하고 동일 날짜의 DB 값과 대조합니다. 실제 배포의 짧은 revision을 GitHub commit과 비교합니다.

이 작업에서는 Gate 1이 DISABLED/DATABASE_MISSING으로 실패했습니다. 이후 실제 gate는 실행하지 않았습니다. 브라우저/fixture/단위 테스트를 이후 gate의 증거로 대신하지 않습니다.

운영자 전용 IP 진단은 `npm run kiwoom:egress`입니다. 주소가 꼭 필요한 로컬 실행에서만 `-- --show-ip`를 사용합니다. 웹 진단에는 주소를 반환하지 않습니다.

## 임의 종목 수집 예약과 제한

collector 웹의 검증된 국내 stock/ETF/ETN 조회에 저장 이력이 부족하거나 오래되면 수집 대상을 DB에 예약하고 즉시 반환합니다. broker를 호출하지 않습니다. 다음 수집기 실행 또는 `npm run kiwoom:targets -- --live --resume --incremental --limit 10`이 처리합니다.

동일 scope/environment/code/instrument/market_scope는 한 대상입니다. 범위는 최대 1,830일·현재 한국 날짜로 제한합니다. 한 scope의 모든 상태 합계 100개, 한 실행 최대 10개, 순차 처리, 정상 완료 후 최소 1시간, partial 후 15분, 반복 실패 후 1일 간격입니다. 익명 요청은 다음 실행 시각을 앞당기지 못합니다. 수집 중 범위 확대는 완료로 오인하지 않습니다. 크래시 작업은 lease/기한 후 재개하며 기존 연속조회 안전장치를 사용합니다. 상한 도달 시 운영자가 대상 목록을 검토해야 합니다. 임의 URL/API ID/자격증명 입력은 허용하지 않습니다.

개인 사이트에서 공개 예약이 필요 없다면 `KIWOOM_TARGET_AUTH_REQUIRED=true`를 권장합니다. 이때 auth-off 방문자도 저장 자료는 읽지만 새 예약은 만들지 못합니다. 예약하려면 기존 인증과 실제 owner를 설정하거나 명시적 수집 종목을 운영자가 지정해야 합니다.

## 기존 owner-scope 이력 보존

로그인 user ID를 데이터 저장 키로 사용하지 않습니다. 이전 범위가 있다면 서버 전용 `KIWOOM_LEGACY_DATA_SCOPE_ID`에 운영자가 기존 scope를 설정할 수 있습니다. 새 scope에 해당 지표가 없을 때만 읽기 호환 경로를 사용합니다. 브라우저는 scope를 지정하지 못합니다.

`npm run kiwoom:migrate-scope`는 현재 DB/environment에서 legacy 관측을 새 global scope로 additive copy합니다. 기존 행을 삭제하지 않으며 유효 값과 최신 정정을 보호합니다. jobs/cursors는 옮기지 않으므로 새 scope의 수집 작업은 안전하게 다시 시작합니다. 같은 명령을 재실행할 수 있습니다. 이관 후 읽기를 확인하고 legacy 설정을 제거하세요. 다른 scope에만 자료가 있는 경우 DATA_SCOPE_MISMATCH를 표시합니다.

## 표시와 배포 revision

hover는 정확한 날짜만 사용합니다. 최신 요약에 최신 가격일의 관측이 없으면 마지막 **실전 Kiwoom 관측값과 실제 기준일**을 표시하고 최신 가격일 자료 미확인 문구를 붙입니다. 원래 차트 점은 변경하지 않고 빈 날짜를 채우지 않습니다. 투신 누적·주월 합계의 기존 누락/coverage 제한은 유지합니다. 원자료는 signed shares와 percentage points를 보존합니다. 모의 관측은 실전 요약 fallback으로 쓰지 않습니다.

검증된 stock/ETF/ETN route 유형은 외부 메타데이터 실패에도 유지합니다. 모호한 입력은 2회 bounded retry 후 PRODUCT_TYPE_UNKNOWN을 표시하며 주식을 임의로 추정하지 않습니다.

`/status/kiwoom`은 짧은 revision, 설정 여부, 구분된 실패 원인과 다음 조치를 표시합니다. 빌드는 플랫폼 commit SHA 또는 local HEAD를 주입합니다. `KIWOOM_EXPECTED_REVISION=<기대 commit SHA>`와 불일치하면 DEPLOYMENT_REVISION_MISMATCH입니다. 같더라도 이 코드가 실제 배포 접근을 확인한 것은 아니므로 DEPLOYMENT_NOT_VERIFIED를 유지합니다. 로컬 uncommitted 변경의 HEAD 표기는 수정본의 배포 증거가 아닙니다. 운영 배포는 검토·commit 후 대상 플랫폼에서 다시 빌드하세요. Windows prebuilt 결과를 Linux 배포 확인으로 간주하지 않습니다.

## 유지한 계약

ka10013.remn_rt, ka10008.wght, ka10059.invtrt와 공식 수량 조건·시장 선택·연속조회 처리는 기존 구현을 유지했습니다. ka10015는 `verify --live --cross-check`에서만 비교하며 저장/생산 값 대체를 하지 않습니다. 원자료 날짜는 공표일/매매일을 근거 없이 추정하지 않습니다. 다른 가격·뉴스·KIS·차트 기능은 제거하지 않았습니다.

공식 참조: [키움 REST 가이드](https://openapi.kiwoom.com/guide/apiguide), [공식 예제 저장소](https://github.com/Kiwoom-Securities/Kiwoom-REST-API). 현재 제한·상품 지원·계좌 권한은 운영자가 실수신 전에 확인해야 합니다. 현재 코드 테스트와 실제 증거는 [검증 기록](KIWOOM_FLOW_VERIFICATION.md)에 분리했습니다.
