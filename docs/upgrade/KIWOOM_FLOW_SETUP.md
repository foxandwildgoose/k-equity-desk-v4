# 키움 실데이터 수집·웹 연결 설정

갱신일: 2026-10-10. 이번 수정 기준 main: `94405aa74ef36ce94cc329f4d0201f21528074b6`. 2026-10-05 운영자 실수신 확인 기록은 아래에 보존합니다.

운영자가 검증한 경로는 **고정 출발 IP Windows 수집기 → 키움 실전 REST → 공유 Neon PostgreSQL → Vercel collector 웹앱 → 기존 세 차트 패널**입니다. OAuth·API 수신·영속 저장·별도 프로세스 재조회와 005930 화면은 운영자 검증으로 완료되었습니다. Codex가 실전 broker 호출을 직접 실행했다는 의미는 아닙니다. [출처가 표시된 실수신 기록](../../artifacts/kiwoom-production-live/verification-2026-10-05.json)과 [검증 보고서](KIWOOM_FLOW_VERIFICATION.md)를 참고하세요.

운영자는 기존 PC가 켜질 때 PowerShell 수집기가 자동 실행된다고 확인했습니다. 재설치보다 **기존 PC 코드 갱신과 실행 중인 수집기 재시작**이 우선입니다. 자동 실행 자체와 각 종목의 대기열 처리·실저장 성공은 별개이므로 이번 변경 반영 후 **DEPLOYMENT_RECHECK_REQUIRED**입니다. 과거 sandbox의 DISABLED/DATABASE_MISSING 결과는 [historical notice](../../artifacts/kiwoom-current-main/README.md)에 분리했으며 현재 운영 시스템의 실패로 사용하지 않습니다.

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

운영자는 기존 네 테이블의 databaseConnected=true, schemaReady=true와 별도 프로세스의 실전 관측 재조회를 확인했습니다. 웹과 수집기는 같은 DB와 scope를 사용합니다. 기존 자료·대기열 테이블과 이번에 추가하는 heartbeat 테이블은 다음과 같습니다.

- kiwoom_flow_observations
- kiwoom_flow_jobs
- kiwoom_flow_coordination
- kiwoom_collection_targets
- kiwoom_collector_runtime — 이번 0004 migration의 수집기 상태

초기 설치 또는 갱신에는 0002_kiwoom_flow.sql, 0003_kiwoom_collection_targets.sql, 0004_kiwoom_collector_runtime.sql을 기존 데이터 보존 방식으로 적용합니다. 아래 한 번 설정 절차에서 실행 환경에 DB URL을 비공개 주입한 뒤 운영자가 명시적으로 실행합니다.

~~~powershell
npm.cmd run db:migrate
~~~

이는 npm run db:migrate의 Windows 호출 형태입니다. 일반 build/build:bundle에는 migration 부수효과가 없습니다. 이번 Codex 작업에서 운영 DB migration을 실행하지 않았습니다. 운영 Kiwoom 경로는 DB 누락·연결 실패를 메모리/PGlite 성공으로 대체하지 않습니다.

운영자가 관측한 pg의 sslmode=require 관련 경고는 연결 문자열을 자동 변경하여 해결하지 않습니다. Neon/PostgreSQL과 설치된 pg 버전의 TLS 설정을 검토하고, 지원되는 구성에서는 인증서를 검증하는 verify-full 등의 명시적 방식을 우선 검토하세요. 실제 DB URL·비밀번호를 문서·로그·명령행 인자로 넣지 않습니다.

## Windows에서 한 번 설정

정상적인 일상 사용에는 셸을 열거나 환경변수를 다시 export하지 않습니다. **처음 한 번 비밀 파일·DB migration·예약 작업을 설정하고 상태를 확인**합니다. 이후 사용자는 국내주식 차트를 열면 됩니다. PC가 켜져 있고 설치한 사용자가 로그온한 상태이며, 등록된 출발 IP와 네트워크를 유지해야 자동 수집이 진행됩니다.

### 1. 저장소 밖에 비밀 파일 준비

App Key·App Secret은 모두 수령된 상태입니다. 수령과 현재 프로세스 설정·실제 인증 성공은 별개입니다. 저장소 밖의 비공개 디렉터리에 각각 한 값만 담은 Key, Secret, DB URL 파일을 만듭니다. 실행자만 읽고 수정하도록 Windows ACL을 제한하고 공개 공유·동기화 폴더를 사용하지 않습니다. App Secret은 *_secretkey.txt를 지원합니다. 파일 이름을 검색해 임의로 선택하지 않습니다.

아래 경로와 IP는 모두 **자리표시자**입니다. 자신의 비공개 절대 경로와 키움에 등록한 IP로 바꾸어 로컬에서만 실행하세요. 실제 파일 경로·등록 IP·파일 내용을 저장소, 채팅, 작업 XML 또는 공유 로그에 넣지 않습니다. 로컬 관리자는 작업 설정에서 경로·IP를 볼 수 있으므로 작업 설정 자체도 비공개로 관리합니다.

Node 22와 npm.cmd는 작업 실행자의 PATH에서 접근 가능해야 합니다. 저장소 파일을 최신 소스로 갱신하고 의존성을 설치합니다. Windows에서 npm.ps1을 선택하지 않도록 npm.cmd를 사용합니다. 저장소·스크립트·비밀 파일을 다른 일반 사용자가 수정할 수 있게 두지 않습니다. DB TLS 설정은 위 Neon 검토를 따릅니다.

### 2. 명시적으로 한 번 DB migration

기존 운영 DB는 보존합니다. 새 heartbeat 테이블에 필요한 0004를 포함하여 명시적인 migration 명령을 실행합니다. 새 worker나 일반 빌드가 DB schema를 자동 변경하지 않습니다. PowerShell 실행 정책은 다음 **프로세스에만** 적용합니다.

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass
Set-Location -LiteralPath '<REPOSITORY_DIRECTORY>'
try {
    . .\scripts\Set-KiwoomSession.ps1 -AppKeyPath '<PRIVATE_DIRECTORY>\kiwoom_appkey.txt' -AppSecretPath '<PRIVATE_DIRECTORY>\kiwoom_secretkey.txt'
    $env:DATABASE_URL = Read-KiwoomCredentialFile '<PRIVATE_DIRECTORY>\kiwoom_database.txt'
    npm.cmd run db:migrate
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
} finally {
    Remove-Item Env:KIWOOM_APP_KEY, Env:KIWOOM_APP_SECRET, Env:DATABASE_URL -ErrorAction SilentlyContinue
}
~~~

migration 명령에는 비밀 내용을 넣지 않습니다. 파일 검증·로그·진단은 원문을 출력하지 않습니다. 위 주입은 초기 migration을 위한 현재 세션에서만 사용하며 **설치 후 매일 반복할 절차가 아닙니다**. 이후 예약 작업이 파일을 직접 읽습니다.

0004가 아직 적용되지 않아 heartbeat를 읽을 수 없으면 상태는 UNKNOWN입니다. 이 경우 이전 네 테이블의 검증된 자료를 무효화하거나 collector 웹을 broker 직접 호출로 전환하지 않습니다. 0004가 없으면 worker는 안전한 경고 후 기존 네 테이블의 수집을 계속하고 heartbeat는 UNKNOWN으로 남깁니다. 0004는 상태 관측용이며 이번 수정에 새 migration은 없습니다. 이미 적용했다면 반복 적용할 필요가 없습니다.

### 3. 자동 작업 설치 및 즉시 시작

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '<REPOSITORY_DIRECTORY>\scripts\Install-KiwoomCollectorTask.ps1' -RepositoryDirectory '<REPOSITORY_DIRECTORY>' -AppKeyPath '<PRIVATE_DIRECTORY>\kiwoom_appkey.txt' -AppSecretPath '<PRIVATE_DIRECTORY>\kiwoom_secretkey.txt' -DatabaseUrlPath '<PRIVATE_DIRECTORY>\kiwoom_database.txt' -ExpectedEgressIp '<REGISTERED_KIWOOM_IPV4>' -DataScopeId 'market-global-v1' -PollSeconds 300
~~~

설치기는 지정한 저장소·일반 파일·읽기·UTF-8/BOM·주변 공백·한 줄·빈 값과 파일 역할을 검증합니다. 비밀 파일은 저장소 밖이어야 합니다. 검증 후 **KEquityDesk-KiwoomCollector** 작업을 현재 Windows 사용자로 등록하고 즉시 시작합니다. 이 실행자가 파일 ACL, 저장소, Node/npm.cmd에 접근할 수 있어야 합니다. 시스템 전체의 비밀 환경변수나 실행 정책을 변경하지 않습니다. 선택적인 -PowerShellPath에는 설치된 powershell.exe 또는 pwsh.exe를 명시할 수 있습니다.

작업은 저장소를 Start In 디렉터리로 사용하고 명시적인 PowerShell 프로그램에 -NoProfile -ExecutionPolicy Bypass를 전달합니다. 인수에는 파일 경로와 설정만 있으며 Key·Secret·token·DB URL은 없습니다. Run-KiwoomCollector.ps1이 각 시작 시 지정 파일을 읽어 자기 자식 프로세스 환경을 설정합니다. 기존 셸의 일시적 변수나 이미 실행 중인 웹 서버에 의존하지 않습니다.

같은 소유 작업과 같은 설정으로 다시 설치하면 중복 작업을 만들지 않습니다. 설정을 바꿀 때는 아래 제거 후 재설치 절차를 사용합니다. 관련 없는 동명 작업을 덮어쓰지 않습니다. 기본 task 이름을 바꾸려면 설치·조회·제거에 같은 -TaskName을 사용합니다.

### 4. 설치·실행 상태 확인

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '<REPOSITORY_DIRECTORY>\scripts\Get-KiwoomCollectorStatus.ps1'
~~~

이 명령은 작업 상태·최근 실행 시간·다음 실행 시간·안전한 결과 코드만 표시하고 action 인수·비밀 경로·IP·환경값은 출력하지 않습니다. 작업 Running은 PowerShell 프로세스 상태입니다. 실제 DB heartbeat·성공 주기·대기열은 소유자 인증으로 /status/kiwoom의 운영 상세에서 확인합니다. Task 존재나 LastTaskResult만으로 broker 수신/DB 갱신 성공을 단정하지 않습니다.

## 자동 작업의 수명주기와 일상 사용

작업은 **현재 사용자의 로그온 트리거**로 시작하고 재부팅 이후에도 등록이 남습니다. Interactive/Limited 권한으로 실행하며 사용자 암호를 저장하지 않습니다. SYSTEM·높은 권한·로그온 전 부팅 실행을 추가하지 않습니다. PC가 재부팅되어도 사용자가 로그온해야 수집기가 시작됩니다. 수면·전원 끄기·로그오프·네트워크 단절 중에는 수집할 수 없습니다. 이 조건에서 무인 부팅 수집이 필요하면 별도의 안전한 서비스 운영 설계가 필요합니다.

Task Scheduler는 IgnoreNew로 두 번째 인스턴스를 막고, Windows global mutex와 DB lease도 유지합니다. 실행 시간 제한은 없으며 network available/start when available 설정을 사용합니다. 실패 시 5분 간격으로 최대 12회 자동 재시작합니다. 시작 시 네트워크/IP 확인에 실패하면 broker를 호출하지 않고 안전하게 종료합니다. 재시도 소진 후에는 상태를 확인하고 작업을 다시 시작하세요. 등록한 출발 IP가 달라졌다면 IP 조건부터 운영자가 수정·검증해야 합니다.

worker 시작 시 **doctor/IP → 실제 OAuth/005930 세 API 각 1페이지 → 명시 종목 수집 → 별도 프로세스 저장 재조회**를 한 번 수행합니다. 이후에는 **bounded kiwoom:targets → heartbeat → 300초 대기 → 반복**합니다. 비싼 005930 검증을 5분마다 다시 실행하지 않습니다. 기본 명시 종목은 stock:005930입니다. 반복 poll은 60~600초를 허용하며 기본값은 300초입니다. 수집 범위와 partial·재시도·전역 제한을 유지하고 새 주기로 이력을 0으로 채우지 않습니다.

사용자가 국내주식 차트를 열면 웹이 부족하거나 오래된 종목을 DB에 예약합니다. 가동 중인 worker는 현재 주기가 끝난 뒤 다음 poll에서 예약을 찾습니다. **유휴·정상 네트워크·due 대상이면 대기 발견은 최대 약 5분**입니다. 이미 처리 중인 종목, 10개 단위 대기열, 재시도/backoff와 공급자 응답에 따라 완료는 더 걸립니다. collector 차트는 예약/수집 대기 중 처음 2분은 15초, 이후 60초마다 저장 자료를 재조회합니다. direct·완료·인증/IP/DB 오류는 기본 5분 정책을 유지합니다. 수집기를 직접 호출하는 브라우저 명령이 아닙니다. “5분 안에 모든 수집·화면 표시 완료”를 보장하지 않습니다. Vercel은 계속 collector 모드이며 broker 자격증명이 필요하지 않습니다.

새로 예약된 패널은 “키움 수집 예약됨 · 고정 IP 수집기 대기”를 표시합니다. 이는 대기열 등록 상태이며 수집기가 가동 중이라는 확인은 아닙니다. 누락값은 0으로 바꾸지 않습니다. 이전 유효 값은 기존 기준일·stale 상태와 함께 보존합니다.

소유자 전용 /status/kiwoom의 Collector 상태는 마지막 heartbeat 기준입니다.

| 상태 | 의미 |
| --- | --- |
| RUNNING | heartbeat 경과 10분 이하 |
| STALE | 10분 초과, 30분 이하 |
| OFFLINE | 30분 초과 |
| UNKNOWN | runtime migration 미적용, 기록 없음 또는 검사 불가 |

소유자에게 마지막 heartbeat·최근 성공 주기·대기 대상 수·안전한 오류 코드를 제공합니다. RUNNING은 각 종목 데이터가 최신이라는 뜻이 아닙니다. 공개 방문자에게 runtime/DB 작업 상세를 보내지 않으며 공개 읽기와 소유자 상세 분리를 유지합니다. 검증된 소유자 문맥에서만 OFFLINE을 확정해 표시합니다.

기본 공개 차트 읽기는 운영 인증 문맥을 전달하지 않으므로 수집기 상세는 소유자 `/status/kiwoom`에서 확인합니다. 소유자 인증이 필요한 차트 읽기/예약 정책에서는 검증된 문맥에만 OFFLINE 안내를 추가합니다. 공개 차트에는 수집 예약·대기 안내만 표시합니다. 날짜별 결측 안내가 이 수집 상태 설명을 가리지 않도록 함께 표시합니다.

heartbeat는 같은 PostgreSQL의 kiwoom_collector_runtime에 scope/environment/임시 instance 식별자, 시작·마지막 heartbeat·마지막 성공 시간, 안전한 오류 코드와 대기열 수만 저장합니다. scope/environment별 최신 기록 한 개를 유지합니다. Key·Secret·token·DB URL·실제 IP는 저장하지 않습니다. worker 시작과 각 주기 및 긴 실행 중 60초 간격으로 갱신하며 기존 observations/jobs/coordination/targets와 market-global-v1 범위를 보존합니다. 임시 instance 식별자는 운영 상세 응답에 노출하지 않습니다.

## 작업 재시작·제거·긴급 수동 실행

### 중지 및 다시 시작

설치한 사용자 세션에서 실행합니다. 같은 작업을 두 번 시작해도 새 worker가 중복 가동되지 않습니다. 설정 변경은 중지·제거한 후 installer를 다시 실행하고 상태를 확인합니다.

~~~powershell
Stop-ScheduledTask -TaskName 'KEquityDesk-KiwoomCollector'
Start-ScheduledTask -TaskName 'KEquityDesk-KiwoomCollector'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '<REPOSITORY_DIRECTORY>\scripts\Get-KiwoomCollectorStatus.ps1'
~~~

### 제거

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '<REPOSITORY_DIRECTORY>\scripts\Uninstall-KiwoomCollectorTask.ps1'
~~~

이 절차는 해당 소유 작업을 중지·제거합니다. 비밀 파일, DB 관측, 대기열과 앱 설정을 삭제하지 않습니다. 파일 경로나 task 이름이 바뀌었다면 명시적 -TaskName으로 같은 소유 작업을 선택합니다.

### 긴급 수동 수집

먼저 예약 작업을 중지합니다. 저장소 위치에서 아래를 실행하면 필요한 환경값을 파일에서 읽으므로 별도의 export가 필요하지 않습니다. RepeatEverySeconds=0은 시작 검증·명시 종목·bounded 대기열을 한 번 처리하고 종료합니다. 300이면 지속 worker이며 Ctrl+C로 멈춥니다. 비밀 환경값은 종료/오류 시 정리합니다. 운영 중인 작업과 수동 worker를 동시에 돌리지 않습니다.

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '<REPOSITORY_DIRECTORY>\scripts\Run-KiwoomCollector.ps1' -AppKeyPath '<PRIVATE_DIRECTORY>\kiwoom_appkey.txt' -AppSecretPath '<PRIVATE_DIRECTORY>\kiwoom_secretkey.txt' -DatabaseUrlPath '<PRIVATE_DIRECTORY>\kiwoom_database.txt' -ExpectedEgressIp '<REGISTERED_KIWOOM_IPV4>' -DataScopeId 'market-global-v1' -RepeatEverySeconds 0
~~~

PowerShell 7은 실행 프로그램을 pwsh.exe로 바꿀 수 있습니다. 여러 명시 종목은 process-scoped 세션에서 배열로 전달합니다. powershell.exe -File의 배열 변환을 추측하여 작업 action에 넣지 않습니다.

~~~powershell
& .\scripts\Run-KiwoomCollector.ps1 -AppKeyPath '<PRIVATE_DIRECTORY>\kiwoom_appkey.txt' -AppSecretPath '<PRIVATE_DIRECTORY>\kiwoom_secretkey.txt' -DatabaseUrlPath '<PRIVATE_DIRECTORY>\kiwoom_database.txt' -ExpectedEgressIp '<REGISTERED_KIWOOM_IPV4>' -Symbols @('stock:005930','stock:403870','etf:069500') -RepeatEverySeconds 0
~~~

직접 CLI가 필요한 비공개 운영자 세션에는 기존 npm.cmd run kiwoom:targets -- --live --resume --incremental --limit 10을 유지합니다. 해당 세션의 비밀값 주입과 정리가 별도로 필요하므로 일상 사용 명령으로 권하지 않습니다. 기본 운영은 전체 IP gate·mutex·cleanup을 포함한 자동 작업입니다. 주문·정정·취소·이체·잔고조회는 구현·실행하지 않습니다.

## 안전한 단계별 확인 명령

아래는 비공개 파일에서 환경값이 주입된 운영자 세션용 명령입니다. 기본 테스트/설정 점검은 broker API를 호출하지 않으며 실호출은 --live를 명시합니다.

1. npm.cmd run kiwoom:doctor — enabled/direct/real, 키 설정 여부, DB 연결·기존 네 테이블, egress IP_MATCH. runtime heartbeat는 0004와 owner-only 상세에서 별도로 확인합니다.
2. npm.cmd run verify:kiwoom -- --live --code 005930 --from 2026-09-01 --to 2026-10-05 — TOKEN_OK, 세 API의 HTTP/business 성공, 유효 값·기간.
3. npm.cmd run sync:kiwoom-flow -- --live --code 005930 --from 2026-09-01 --to 2026-10-05 --resume — bounded 수집/영속 저장; partial이면 재개.
4. 새 프로세스의 npm.cmd run verify:kiwoom -- --read-stored --code 005930 --from 2026-09-01 --to 2026-10-05 — 저장된 실제 관측일·건수·환경 대조.
5. 같은 Neon DB/scope의 collector 웹이 broker/OAuth/IP 요청을 발생시키지 않는지 확인.
6. 005930의 세 패널·기준일·투신 유효 시작일을 서버/DB와 대조.

운영자 제공 기록에서는 이 경로가 실제 완료되었습니다. 이번 수정 이후 배포 확인은 별도로 필요합니다. 단위 테스트·fixture/PGlite·로컬 빌드가 실수신/배포 증거를 대신하지 않습니다. npm.cmd run kiwoom:egress는 주소를 숨긴 로컬 진단입니다. 주소가 필요한 비공개 운영자 진단에서만 -- --show-ip를 사용하며 출력은 공유하지 않습니다.

## 동적 예약·기존 scope 보존

collector 웹은 검증된 국내 stock/ETF/ETN의 부족하거나 오래된 이력을 DB에 예약하고 반환합니다. broker를 호출하지 않습니다. 한 scope의 미완료 수집은 기본 최대 100개, 등록된 전체 구독은 기본 최대 6000개입니다. 완료·실패 대상은 미완료 상한을 차지하지 않습니다. 범위 최대 1,830일·현재 한국 날짜, 한 실행 최대 10개, 순차 처리는 유지합니다. 정상 완료 후 최소 1시간, partial 후 15분, 반복 실패 후 1일 간격을 유지합니다. 익명 요청은 다음 실행 시각을 앞당기지 못하며 범위 확대·크래시·예산 종료도 재개 대상으로 기록합니다. 임의 URL/API ID/자격증명을 받지 않습니다.

공개 예약이 필요 없으면 KIWOOM_TARGET_AUTH_REQUIRED=true를 사용합니다. 저장 자료 읽기와 별개이며 새 예약에는 실제 owner 또는 운영자의 명시 종목 설정이 필요합니다. scope/environment/code/instrument/market_scope를 분리합니다.

이전 owner-scope 자료는 서버 전용 KIWOOM_LEGACY_DATA_SCOPE_ID로 읽기 호환할 수 있습니다. 새 scope에 해당 지표가 없을 때만 사용합니다. npm.cmd run kiwoom:migrate-scope는 현재 DB/environment에서 additive copy하며 기존 행을 삭제하지 않습니다. 유효 값·정정을 보호하고 jobs/cursors는 옮기지 않습니다. 이관 후 읽기를 확인하고 legacy 설정을 제거하세요.

## 투신 기본값과 저장 설정

신규 국내 stock/ETF/ETN 및 “기본값 복원”의 trustMode는 **available-cumulative**입니다. 실제 연속 관측의 시작일을 “가용 시작”으로 표시합니다. 운영자 검증 사례의 시작일은 2025-10-10이며 다른 종목·기간의 보장 시작일이 아닙니다.

저장된 명시적 daily/cumulative/available-cumulative는 덮어쓰지 않습니다. 고정 기준일이 제공 이력보다 앞선 cumulative는 계속 null이므로 필요하면 사용자가 “가용한 연속 구간부터 누적”을 선택해야 합니다. 확대/축소가 고정 기준일을 바꾸지 않습니다. invtrt의 0·음수는 유효하며 누락일을 0으로 채우거나 누락을 넘어 확정 누적하지 않습니다. 이는 순매수 수량의 합계이며 보유잔고가 아닙니다. 원래 점/날짜, 일/주/월 집계·coverage 제한을 유지합니다.

hover는 정확한 날짜만 사용합니다. 비누적 지표의 최신 가격일에 관측이 없으면 실제 마지막 관측값·그 기준일을 요약에 표시하고 최신 자료 미확인 상태를 붙입니다. 고정/가용 누적의 최신 값이 결측이면 이전 정상 누적값으로 덮지 않고 미확인 상태를 유지합니다. 모의 값 대체·빈 날짜 채우기를 하지 않습니다. 검증된 route 유형을 유지하며 모호한 입력은 bounded retry 후 PRODUCT_TYPE_UNKNOWN으로 표시합니다.

## 소스 빌드·배포 재확인

현재 main의 tslib production 의존성과 패치된 TanStack Start를 유지하며 .vercel/output/을 무시합니다. 배포 전 npm run check:deploy와 git ls-files .vercel/output을 실행합니다. 후자는 출력이 없어야 합니다. Vercel은 Git 소스로 새로 빌드해야 하며 **Using prebuilt build artifacts from .vercel/output**를 소스 빌드 성공으로 인정하지 않습니다. 로컬 생성 출력은 Git에 추가하지 않습니다. npm run build/build:bundle에는 DB migration이 없습니다.

상태 페이지의 짧은 revision을 배포 commit에 대조합니다. 기대 revision 불일치는 오류지만 일치만으로 URL·DB·화면을 확인한 것은 아닙니다. 이번 수정 배포 후 /, /status/kiwoom, /stock/005930 응답과 세 패널·공개 읽기/관리자 상세 분리를 다시 점검하세요. 현재는 DEPLOYMENT_RECHECK_REQUIRED입니다. Windows 로컬 번들을 Linux Vercel 배포 검증으로 간주하지 않습니다.

## 유지한 공식 계약

신용은 ka10013.crd_trde_trend[].remn_rt (%), 외국인은 ka10008.stk_frgnr[].wght (%), 투신은 ka10059.stk_invsr_orgn[].invtrt (부호 있는 단주; amt_qty_tp=2, trde_tp=0, unit_tp=1)입니다. 연속조회·날짜 최소/최대·중복 커서 보호·KST token 만료를 유지합니다. ka10015는 diagnostic cross-check 전용이며 생산 값을 대체하지 않습니다. 확인되지 않은 공표일/매매일을 추정하지 않습니다.

공식 참조: [키움 REST 가이드](https://openapi.kiwoom.com/guide/apiguide), [서비스 안내](https://openapi.kiwoom.com/intro/serviceInfo), [공식 예제 저장소](https://github.com/Kiwoom-Securities/Kiwoom-REST-API). 이번 작업은 이미 실수신 검증된 매핑을 변경하지 않습니다. 개별 상품·장기 이력·HTS 표 대조는 005930 검증만으로 보장하지 않습니다.


## 이미 PC 자동 수집·Neon·Vercel을 사용하는 경우 (2026-10-10 갱신)

새 Node 설치, 새 Neon DB 생성, 키 재발급은 필요하지 않습니다. 기존 비밀 파일·공유 DB·등록 IP·`collector` 웹 설정을 그대로 사용합니다. 새 migration도 없습니다. 아래 절차는 이미 등록한 작업 이름이 `KEquityDesk-KiwoomCollector`인 경우입니다. 다른 이름/시작 프로그램을 사용한다면 해당 기존 작업/PowerShell 프로세스만 중지·재시작합니다. 관련 없는 작업을 바꾸지 않습니다.

1. 기존 PC의 PowerShell에서 **기존 저장소 폴더**로 이동합니다. `git status --short`가 비어 있는지, 브랜치가 `main`인지 확인합니다. 변경 파일이 있으면 덮어쓰거나 reset하지 말고 먼저 보존합니다.
2. 기존 수집 작업을 중지한 뒤 최신 main을 받습니다. `git pull`이 충돌/브랜치 오류로 실패하면 이후 실행을 중지합니다. 이번 변경은 의존성을 추가하지 않아 정상 설치된 Node/npm을 다시 설치할 필요가 없습니다.

~~~powershell
Set-Location -LiteralPath '<EXISTING_REPOSITORY_DIRECTORY>'
git status --short
git branch --show-current
Stop-ScheduledTask -TaskName 'KEquityDesk-KiwoomCollector'
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'Code update failed; preserve local changes.' }
Start-ScheduledTask -TaskName 'KEquityDesk-KiwoomCollector'
.\scripts\Get-KiwoomCollectorStatus.ps1
~~~

3. Vercel GitHub 연동의 **최신 수정 커밋** 배포가 Production/Ready인지 확인합니다. 기존 실패/옛 커밋의 Redeploy로 최신 소스가 적용되었다고 판단하지 않습니다. Vercel은 `KIWOOM_FLOW_MODE=collector`, 기존 공유 `DATABASE_URL`과 같은 `KIWOOM_DATA_SCOPE_ID`를 유지합니다. 일반 Hobby 서버에서 키움 직접 호출을 켜지 않습니다.
4. 국내 개별주 페이지를 엽니다. 모든 코스피·코스닥 종목은 같은 경로를 사용하며 샘플 코드의 전용 처리가 없습니다. 처음 조회하거나 더 긴 기간이 필요한 종목은 검증된 상품 유형으로 예약됩니다. PC 수집기가 대기열을 처리하면 열린 차트도 자동 재조회합니다. **수급 자료 새로고침**은 저장 자료를 즉시 다시 읽습니다.
5. `해당 종목 코드 수급 상태 확인`은 `/status/kiwoom?code=<SIX_CHARACTER_CODE>`로 이동합니다. 소유자 운영 진단은 기존 실제 인증을 유지합니다. 공개 차트의 조회 권한과 소유자 heartbeat 조회 권한을 혼동하지 않습니다. 수집기 프로세스 Running만으로 데이터 저장 성공이라고 판단하지 않습니다.

기존 자동 실행이 한 번의 `sync:kiwoom-flow --code ...`만 실행한다면 웹의 다른 종목 대기열을 소비하지 못합니다. 그 경우 위 설치 절차의 **기존 `Run-KiwoomCollector.ps1` 래퍼**를 실행 대상으로 사용해야 합니다. 래퍼는 기본 300초 반복이며 명시적인 `-RepeatEverySeconds 0`만 일회 실행입니다. 파일 경로·IP는 기존 로컬 비공개 설정을 재사용합니다. 정상적인 종료는 기존 작업 중지 또는 해당 PowerShell에서 Ctrl+C이며 자식 환경 비밀값은 종료 시 제거합니다.

### 모든 종목과 재개 상태의 의미

- 새 미완료 수집은 최대 100개, 완료·실패 포함 등록 구독은 최대 6000개입니다. 완료된 100종목이 이후 코스피·코스닥 종목을 영구 차단하지 않습니다. 상한 도달은 `TARGET_LIMIT_REACHED`이며 `NO_HISTORY`와 구분합니다. 상한이 풀리면 열린 차트가 60초 간격으로 재예약을 시도합니다.
- 신규 공개 예약은 고정 URL의 한국 종목 메타데이터로 코드/상품 유형을 확인합니다. 이 메타데이터는 지표값을 제공하거나 키움 실패를 대체하지 않습니다. 유형 확인이 실패해도 이미 저장된 키움 자료는 계속 읽습니다. 브라우저가 arbitrary 코드로 무제한 개인 API 사용을 만들 수 없습니다.
- 수집기 전체는 기존 전역 2회/초 제한과 한 번 최대 10종목을 유지합니다. 종목이 많거나 긴 최초 이력은 순차로 확보되며 모든 상장사의 데이터를 즉시 내려받는다는 의미가 아닙니다.
- 수집 대상의 종료일은 KST 현재일로 갱신합니다. 최근 완료된 전체 백필을 확인한 뒤 14일 겹침 증분으로 정정을 반영합니다. 더 이른 시작일 요청과 미완료 커서는 전체 백필/동일 조건 재개가 우선입니다.
- CLI 종료 `0`은 해당 범위 완료, `2`는 부분 수집·종목별 일시 오류·재개 필요, `1`은 설정/인증/IP/DB/lease 등의 중단입니다. 지속 worker는 `2`여도 다른 대상 처리를 계속합니다. 잘못된 키나 IP에 대한 인증 반복을 허용하지 않습니다. 선택적 heartbeat 스키마 미적용의 `3`은 상태 관측 불가이며 broker 성공을 뜻하지 않습니다.
- 차트 읽기는 최장 100년의 원래 가격 범위를 허용하여 월/연봉 `max` 요청이 20년 제한으로 전체 실패하지 않게 합니다. 자동 대상 수집은 여전히 최근 1830일로 제한됩니다. 그 이전 이력·공급자 제공 끝·결측은 부분 확보로 표시하며 고정 투신 누적 기준일을 자동 변경하거나 결측을 0으로 채우지 않습니다.

이번 수정의 원인·자동검사·운영 재검증 구분은 [복구 보고서](KIWOOM_FLOW_RECOVERY_2026-10-10.md)에 기록합니다.
