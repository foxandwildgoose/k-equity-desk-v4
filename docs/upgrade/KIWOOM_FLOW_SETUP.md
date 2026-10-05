# 키움 실데이터 수집·웹 연결 설정

확인일: 2026-10-05 (한국시간). 시작 remote main: c563c646fcaa849ca6a7edb106815a0e24287427.

운영자가 검증한 경로는 **고정 출발 IP Windows 수집기 → 키움 실전 REST → 공유 Neon PostgreSQL → Vercel collector 웹앱 → 기존 세 차트 패널**입니다. OAuth·API 수신·영속 저장·별도 프로세스 재조회와 005930 화면은 운영자 검증으로 완료되었습니다. Codex가 실전 broker 호출을 직접 실행했다는 의미는 아닙니다. [출처가 표시된 실수신 기록](../../artifacts/kiwoom-production-live/verification-2026-10-05.json)과 [검증 보고서](KIWOOM_FLOW_VERIFICATION.md)를 참고하세요.

이번 변경을 반영한 배포는 아직 재확인하지 않았으므로 **DEPLOYMENT_RECHECK_REQUIRED**입니다. 과거 sandbox의 DISABLED/DATABASE_MISSING 결과는 [historical notice](../../artifacts/kiwoom-current-main/README.md)에 분리했으며 현재 운영 시스템의 실패로 사용하지 않습니다.

## 운영자가 검증한 구성

| 서버 전용 설정 | Vercel 웹앱 | 고정 출발 IP Windows 수집기 |
| --- | --- | --- |
| KIWOOM_FLOW_ENABLED | true | true |
| KIWOOM_FLOW_MODE | collector | direct |
| KIWOOM_ENV | real | real |
| KIWOOM_DATA_SCOPE_ID | market-global-v1 | 같은 값 |
| DATABASE_URL | 공유 Neon PostgreSQL | 같은 Neon PostgreSQL |
| KIWOOM_APP_KEY / KIWOOM_APP_SECRET | 설정하지 않음 | 실행자 전용 파일에서 주입 |
| KIWOOM_EXPECTED_EGRESS_IP | 설정하지 않음 | `<REGISTERED_KIWOOM_IPV4>` |
| KIWOOM_READ_AUTH_REQUIRED | 공개 시장자료 읽기는 false | 웹 읽기 정책 |
| KIWOOM_OWNER_USER_ID | 상세 관리자 진단/비공개 읽기에 사용 | 로컬 CLI에는 불필요 |
| VITE_AUTH_ENABLED | 공개 읽기는 false 가능 | CLI는 OS 실행자 권한 |
| KIWOOM_TARGET_AUTH_REQUIRED | 기본 false; true면 소유자만 예약 가능 | DB 대기열 폴링에는 불필요 |

Vercel의 collector 경로는 DB만 읽으며 broker client 생성·OAuth·IP 조회를 하지 않습니다. 일반 Vercel 서버의 출발 IP가 등록 IP와 같다고 가정하지 않습니다. 데이터 scope는 서버 설정이며 브라우저가 선택할 수 없습니다. 기능은 설정 전에는 기본 비활성입니다.

collector + KIWOOM_READ_AUTH_REQUIRED=false의 방문자는 공개 시장자료를 읽을 수 있습니다. /status/kiwoom의 **공개 읽기 설정**과 **소유자 전용 운영 진단**은 별개입니다. 방문자에게 PUBLIC_READ_CONFIGURED 및 PUBLIC_READ_ALLOWED를 표시하더라도 DB 연결·스키마·저장 행을 검사했다는 뜻은 아닙니다. 상세 진단은 OWNER_LOGIN_REQUIRED로 분리하고 운영 상세·DB 지표·작업은 실제 소유자 세션으로만 확인합니다. 비공개 collector 읽기와 direct 웹 접근은 여전히 소유자 인증을 요구합니다. direct 웹에는 서버 자격증명과 IP_MATCH도 필요합니다. auth-off를 broker 접근 허가로 사용하지 않습니다.

수집기의 실제 외부 IPv4는 키움에 등록된 주소와 일치해야 합니다. 환경변수는 출발 IP를 변경하지 않습니다. 고정 IP 확인 서비스 두 곳 이상이 같은 유효 IPv4에 동의하고 등록값과 일치해야 broker 호출을 진행합니다. 불일치·확인 불가·한 서비스만 성공한 경우 중단합니다. IP 확인 서비스에 인증정보를 보내지 않습니다. 현재 서비스는 ipify, checkip.amazonaws.com, icanhazip.com이며 각각 5초 제한·리다이렉트 금지를 적용합니다. 실제 주소는 문서·GitHub에 기록하지 않습니다.

## 공유 Neon DB와 명시적인 migration

운영자는 databaseConnected=true, schemaReady=true와 별도 프로세스의 실전 관측 재조회를 확인했습니다. 웹과 수집기는 같은 DB와 scope를 사용합니다. 필요한 네 테이블은 다음과 같습니다.

- kiwoom_flow_observations
- kiwoom_flow_jobs
- kiwoom_flow_coordination
- kiwoom_collection_targets

초기 설치 또는 갱신에는 0002_kiwoom_flow.sql, 0003_kiwoom_collection_targets.sql을 기존 데이터 보존 방식으로 적용합니다. 실행 환경에 DB URL을 비공개 주입한 뒤 운영자가 명시적으로 실행합니다.

~~~powershell
npm.cmd run db:migrate
~~~

이는 npm run db:migrate의 Windows 호출 형태입니다. 일반 build/build:bundle에는 migration 부수효과가 없습니다. 이번 Codex 작업에서 운영 DB migration을 실행하지 않았습니다. 운영 Kiwoom 경로는 DB 누락·연결 실패를 메모리/PGlite 성공으로 대체하지 않습니다.

운영자가 관측한 pg의 sslmode=require 관련 경고는 연결 문자열을 자동 변경하여 해결하지 않습니다. Neon/PostgreSQL과 설치된 pg 버전의 TLS 설정을 검토하고, 지원되는 구성에서는 인증서를 검증하는 verify-full 등의 명시적 방식을 우선 검토하세요. 실제 DB URL·비밀번호를 문서·로그·명령행 인자로 넣지 않습니다.

## Windows 수집기 실행

App Key·App Secret은 모두 수령된 상태입니다. 수령과 현재 프로세스 설정·실제 인증 성공은 별개입니다. 파일은 저장소 밖에 두고 실행자만 읽게 ACL을 제한합니다. Key, Secret, DB URL은 각각 한 값만 담은 파일입니다. App Secret은 *_secretkey.txt를 지원하며 파일 이름을 검색해 임의로 선택하지 않습니다.

저장소 디렉터리에서 아래 자리표시자를 자신의 비공개 경로와 등록 IP로 바꾸어 실행합니다. 기본 수집 종목은 이미 검증된 stock:005930입니다.

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Run-KiwoomCollector.ps1 -AppKeyPath '<PRIVATE_DIRECTORY>\kiwoom_appkey.txt' -AppSecretPath '<PRIVATE_DIRECTORY>\kiwoom_secretkey.txt' -DatabaseUrlPath '<PRIVATE_DIRECTORY>\kiwoom_database.txt' -ExpectedEgressIp '<REGISTERED_KIWOOM_IPV4>' -DataScopeId 'market-global-v1' -RepeatEverySeconds 0
~~~

PowerShell 7은 프로그램 이름을 pwsh.exe로 바꿀 수 있습니다. **ExecutionPolicy Bypass는 이 프로세스에만** 적용하며 시스템/사용자 실행 정책을 영구 변경하지 않습니다. Windows 래퍼는 npm.cmd를 명시적으로 호출하므로 npm.ps1을 잘못 선택하지 않습니다. Node와 npm.cmd는 작업 실행자의 PATH에서 접근 가능해야 합니다. 선택적인 FromDate는 YYYY-MM-DD이며 기본값은 실행일 한국 날짜에서 366일 이전입니다.

래퍼는 같은 자식 세션에 비밀값을 주입한 뒤 **doctor/IP → 실제 OAuth/005930 세 API 각 1페이지 → 종목별 순차 수집 → 별도 프로세스 저장 조회 → 최대 10개 예약 대상 폴링** 순서로 실행합니다. 자식 스크립트가 부모 셸이나 이미 실행 중인 앱 서버의 환경변수를 변경한다고 가정하지 않습니다. 임시 키·Secret·DB 환경값은 종료/오류 시 정리하며 자식 프로세스가 종료됩니다. 파일 내용·토큰·DB URL을 출력하지 않습니다. 주문·정정·취소·이체·잔고조회는 수행하지 않습니다.

RepeatEverySeconds=0은 대기열 처리까지 한 번 실행합니다. 반복 간격은 60초 이상만 허용합니다. 같은 자격증명의 Global Windows mutex와 DB lease는 중복 실행을 막습니다. 재시도도 공통 제한기를 사용합니다. partial/실패는 0이 아닌 종료 코드로 멈추므로 같은 조건으로 재개하고 부족한 이력을 완료로 오인하지 않습니다. 반복 프로세스는 Ctrl+C로 종료할 수 있습니다. 다른 셸에서 시작한 서버에는 새 환경값이 자동 반영되지 않으므로 필요한 경우 재시작합니다.

여러 종목을 명시하려면 process-scoped PowerShell 세션을 시작한 뒤 그 세션에서 래퍼를 호출합니다.

~~~powershell
& .\scripts\Run-KiwoomCollector.ps1 -AppKeyPath '<PRIVATE_DIRECTORY>\kiwoom_appkey.txt' -AppSecretPath '<PRIVATE_DIRECTORY>\kiwoom_secretkey.txt' -DatabaseUrlPath '<PRIVATE_DIRECTORY>\kiwoom_database.txt' -ExpectedEgressIp '<REGISTERED_KIWOOM_IPV4>' -Symbols @('stock:005930','stock:403870','etf:069500') -RepeatEverySeconds 0
~~~

powershell.exe -File의 배열 인자 전달을 추측하여 작업 스케줄러에 넣지 않습니다. 005930 성공만으로 다른 종목·상품의 지원을 보장하지 않습니다.

## 장 마감 후 작업 스케줄러

이 문서는 절차를 제공하며 Codex가 운영자의 작업 스케줄러를 설치·변경하지 않습니다. Windows 시간대를 한국시간으로 확인하고 **평일 16:30~17:00 KST**, 예를 들어 16:30에 실행하는 작업을 만듭니다. 이는 휴장일 달력이 아니므로 휴장·미공표 최신 자료는 실제 이력 상태로 확인합니다.

- 프로그램: powershell.exe (설치된 PowerShell 7은 pwsh.exe)
- 시작 위치: `<REPOSITORY_DIRECTORY>`
- 트리거: 월~금 16:30 KST
- 실행자: 비밀 파일 ACL과 저장소 읽기/실행 권한을 가진 전용 운영자
- 이미 실행 중이면: **새 인스턴스를 시작하지 않음**

인수에는 비밀 **내용** 대신 명시적 파일 **경로**와 설정 자리표시자만 넣습니다.

~~~text
-NoProfile -ExecutionPolicy Bypass -File "<REPOSITORY_DIRECTORY>\scripts\Run-KiwoomCollector.ps1" -AppKeyPath "<PRIVATE_DIRECTORY>\kiwoom_appkey.txt" -AppSecretPath "<PRIVATE_DIRECTORY>\kiwoom_secretkey.txt" -DatabaseUrlPath "<PRIVATE_DIRECTORY>\kiwoom_database.txt" -ExpectedEgressIp "<REGISTERED_KIWOOM_IPV4>" -DataScopeId "market-global-v1" -RepeatEverySeconds 0
~~~

실제 Key·Secret·DB URL을 인수에 넣지 않습니다. 로컬 관리자는 작업 설정을 볼 수 있으므로 실제 파일 경로·등록 IP도 외부 문서나 GitHub에 복사하지 않습니다. 로그에 파일 내용·전체 환경변수·인증 요청·Authorization 헤더를 출력하지 않습니다.

“사용자의 로그온 여부에 관계없이 실행”은 지정 실행자가 로그오프 상태에서도 파일을 안전하게 읽고 Node/npm.cmd/저장소에 접근할 수 있을 때만 선택합니다. 대화형 셸의 임시 환경변수가 스케줄 작업에 전달된다고 가정하지 않습니다. 각 실행에서 지정 파일을 검증하고 주입합니다. 시작 위치·파일 ACL·PATH·네트워크·등록 출발 IP를 해당 실행자 컨텍스트에서 확인하세요. 새 인스턴스 금지에 더해 global mutex와 DB lease를 유지합니다. Vercel은 계속 collector 모드입니다.

수동으로 동적 예약 대상을 처리할 때도 위 래퍼를 RepeatEverySeconds=0으로 실행하면 마지막 단계에서 bounded 폴링합니다. doctor/IP/인증을 이미 확인한 운영자 전용 세션에서는 다음 CLI를 쓸 수 있습니다. 먼저 반복 래퍼·스케줄 작업을 중지하고 같은 파일 검증/비공개 주입 절차를 수행하세요. 래퍼 종료 후 비밀값은 지워지므로 설정 없는 새 셸에서 호출할 수 없습니다.

~~~powershell
npm.cmd run kiwoom:targets -- --live --resume --incremental --limit 10
~~~

직접 CLI는 래퍼의 Windows mutex를 대신하지 않으며 DB lease는 계속 적용됩니다. 운영 기본 명령은 전체 gate·cleanup을 포함한 래퍼입니다. 별도 현재 세션 주입은 Set-KiwoomSession.ps1을 dot-source하고 Read-KiwoomCredentialFile로 명시한 DB 파일을 읽어 DATABASE_URL에 할당하는 방식입니다. 어느 파일도 출력하지 않고 같은 세션에서 CLI를 시작한 뒤 KIWOOM_APP_KEY, KIWOOM_APP_SECRET, DATABASE_URL을 제거합니다. 별도 프로세스가 부모 환경을 바꾼다고 설명하지 않습니다.

## 안전한 단계별 확인 명령

아래는 비공개 파일에서 환경값이 주입된 운영자 세션용 명령입니다. 기본 테스트/설정 점검은 broker API를 호출하지 않으며 실호출은 --live를 명시합니다.

1. npm.cmd run kiwoom:doctor — enabled/direct/real, 키 설정 여부, DB 연결·네 테이블, egress IP_MATCH.
2. npm.cmd run verify:kiwoom -- --live --code 005930 --from 2026-09-01 --to 2026-10-05 — TOKEN_OK, 세 API의 HTTP/business 성공, 유효 값·기간.
3. npm.cmd run sync:kiwoom-flow -- --live --code 005930 --from 2026-09-01 --to 2026-10-05 --resume — bounded 수집/영속 저장; partial이면 재개.
4. 새 프로세스의 npm.cmd run verify:kiwoom -- --read-stored --code 005930 --from 2026-09-01 --to 2026-10-05 — 저장된 실제 관측일·건수·환경 대조.
5. 같은 Neon DB/scope의 collector 웹이 broker/OAuth/IP 요청을 발생시키지 않는지 확인.
6. 005930의 세 패널·기준일·투신 유효 시작일을 서버/DB와 대조.

운영자 제공 기록에서는 이 경로가 실제 완료되었습니다. 이번 수정 이후 배포 확인은 별도로 필요합니다. 단위 테스트·fixture/PGlite·로컬 빌드가 실수신/배포 증거를 대신하지 않습니다. npm.cmd run kiwoom:egress는 주소를 숨긴 로컬 진단입니다. 주소가 필요한 비공개 운영자 진단에서만 -- --show-ip를 사용하며 출력은 공유하지 않습니다.

## 동적 예약·기존 scope 보존

collector 웹은 검증된 국내 stock/ETF/ETN의 부족하거나 오래된 이력을 DB에 예약하고 반환합니다. broker를 호출하지 않습니다. 한 scope 모든 상태 합계 최대 100개, 범위 최대 1,830일·현재 한국 날짜, 한 실행 최대 10개, 순차 처리입니다. 정상 완료 후 최소 1시간, partial 후 15분, 반복 실패 후 1일 간격을 유지합니다. 익명 요청은 다음 실행 시각을 앞당기지 못하며 범위 확대·크래시·예산 종료도 재개 대상으로 기록합니다. 임의 URL/API ID/자격증명을 받지 않습니다.

공개 예약이 필요 없으면 KIWOOM_TARGET_AUTH_REQUIRED=true를 사용합니다. 저장 자료 읽기와 별개이며 새 예약에는 실제 owner 또는 운영자의 명시 종목 설정이 필요합니다. scope/environment/code/instrument/market_scope를 분리합니다.

이전 owner-scope 자료는 서버 전용 KIWOOM_LEGACY_DATA_SCOPE_ID로 읽기 호환할 수 있습니다. 새 scope에 해당 지표가 없을 때만 사용합니다. npm.cmd run kiwoom:migrate-scope는 현재 DB/environment에서 additive copy하며 기존 행을 삭제하지 않습니다. 유효 값·정정을 보호하고 jobs/cursors는 옮기지 않습니다. 이관 후 읽기를 확인하고 legacy 설정을 제거하세요.

## 투신 기본값과 저장 설정

신규 국내 stock/ETF/ETN 및 “기본값 복원”의 trustMode는 **available-cumulative**입니다. 실제 연속 관측의 시작일을 “가용 시작”으로 표시합니다. 운영자 검증 사례의 시작일은 2025-10-10이며 다른 종목·기간의 보장 시작일이 아닙니다.

저장된 명시적 daily/cumulative/available-cumulative는 덮어쓰지 않습니다. 고정 기준일이 제공 이력보다 앞선 cumulative는 계속 null이므로 필요하면 사용자가 “가용한 연속 구간부터 누적”을 선택해야 합니다. 확대/축소가 고정 기준일을 바꾸지 않습니다. invtrt의 0·음수는 유효하며 누락일을 0으로 채우거나 누락을 넘어 확정 누적하지 않습니다. 이는 순매수 수량의 합계이며 보유잔고가 아닙니다. 원래 점/날짜, 일/주/월 집계·coverage 제한을 유지합니다.

hover는 정확한 날짜만 사용합니다. 최신 가격일에 관측이 없으면 실제 마지막 실전 관측값·그 기준일을 요약에 표시하고 최신 자료 미확인 상태를 붙입니다. 모의 값 대체·빈 날짜 채우기를 하지 않습니다. 검증된 route 유형을 유지하며 모호한 입력은 bounded retry 후 PRODUCT_TYPE_UNKNOWN으로 표시합니다.

## 소스 빌드·배포 재확인

현재 main의 tslib production 의존성과 패치된 TanStack Start를 유지하며 .vercel/output/을 무시합니다. 배포 전 npm run check:deploy와 git ls-files .vercel/output을 실행합니다. 후자는 출력이 없어야 합니다. Vercel은 Git 소스로 새로 빌드해야 하며 **Using prebuilt build artifacts from .vercel/output**를 소스 빌드 성공으로 인정하지 않습니다. 로컬 생성 출력은 Git에 추가하지 않습니다. npm run build/build:bundle에는 DB migration이 없습니다.

상태 페이지의 짧은 revision을 배포 commit에 대조합니다. 기대 revision 불일치는 오류지만 일치만으로 URL·DB·화면을 확인한 것은 아닙니다. 이번 수정 배포 후 /, /status/kiwoom, /stock/005930 응답과 세 패널·공개 읽기/관리자 상세 분리를 다시 점검하세요. 현재는 DEPLOYMENT_RECHECK_REQUIRED입니다. Windows 로컬 번들을 Linux Vercel 배포 검증으로 간주하지 않습니다.

## 유지한 공식 계약

신용은 ka10013.crd_trde_trend[].remn_rt (%), 외국인은 ka10008.stk_frgnr[].wght (%), 투신은 ka10059.stk_invsr_orgn[].invtrt (부호 있는 단주; amt_qty_tp=2, trde_tp=0, unit_tp=1)입니다. 연속조회·날짜 최소/최대·중복 커서 보호·KST token 만료를 유지합니다. ka10015는 diagnostic cross-check 전용이며 생산 값을 대체하지 않습니다. 확인되지 않은 공표일/매매일을 추정하지 않습니다.

공식 참조: [키움 REST 가이드](https://openapi.kiwoom.com/guide/apiguide), [서비스 안내](https://openapi.kiwoom.com/intro/serviceInfo), [공식 예제 저장소](https://github.com/Kiwoom-Securities/Kiwoom-REST-API). 이번 작업은 이미 실수신 검증된 매핑을 변경하지 않습니다. 개별 상품·장기 이력·HTS 표 대조는 005930 검증만으로 보장하지 않습니다.
