# 역사 기록 — 현재 실행환경/현재 설정의 증거가 아닙니다

2026-10-04의 기록을 변경 없이 보존합니다. 현재 상태는 KIWOOM_FLOW_VERIFICATION.md / KIWOOM_FLOW_SETUP.md를 참조하세요.

# 키움 REST API 수급 지표 설정

확인일: 2026-10-04 (한국시간). 작업 기준: `225949ec58d602cf1e0b7919bee9dfa06290e95a`, 브랜치 `work`.

## 현재 상태

사용자는 App Key와 App Secret을 **모두 수령**했고 두 파일을 제공했습니다. 첨부를 읽는 격리된 검사 프로세스에서 파일 검증 및 `CREDENTIALS_CONFIGURED`를 확인했습니다. 이는 키 쌍의 유효성·실전/모의 구분·토큰 발급 성공을 뜻하지 않습니다. 실행 중인 웹 서버에 변수가 자동 전달되지 않습니다. 첨부 파일 경로는 앱에 하드코딩하지 않습니다.

등록 IP로 제공된 주소는 `220.72.76.41`입니다. Codex에서 외부 IP 확인은 네트워크 프록시 403으로 `IP_UNVERIFIED`입니다. 키움 인증 요청은 실행하지 않았습니다. 자세한 결과는 [검증 기록](KIWOOM_FLOW_VERIFICATION.md)을 참조하세요.

## 서버 환경변수

실제 값이 없는 아래 설정을 실행 프로세스에 비공개로 주입합니다. `.env` 파일이나 `VITE_` 변수에 키를 넣지 않습니다.

```text
KIWOOM_APP_KEY=<비공개 App Key>
KIWOOM_APP_SECRET=<비공개 App Secret>
KIWOOM_ENV=real
KIWOOM_FLOW_ENABLED=true
KIWOOM_FLOW_MODE=direct
KIWOOM_EXPECTED_EGRESS_IP=220.72.76.41
KIWOOM_REQUESTS_PER_SECOND=2
KIWOOM_OWNER_USER_ID=<기존 로그인에서 검증된 소유자의 user.id>
DATABASE_URL=<공유 영속 PostgreSQL 연결 문자열>
```

`real/direct`는 허용 IP PC에서 최초 실전 조회를 하는 예시입니다. 파일 이름으로 키의 앱·환경을 추정하지 않습니다. 현재 구현은 `real`/`mock`, `direct`/`collector`를 검증하며 호출 속도는 0보다 크고 2 이하로 제한합니다. 초기 상태는 수집 비활성입니다.

키 설정 진단은 `CREDENTIALS_NOT_CONFIGURED`, `APP_KEY_MISSING`, `APP_SECRET_MISSING`, `CREDENTIALS_CONFIGURED`로 구분합니다. 인증 성공은 별도 검증합니다. collector 웹앱에는 키 두 개가 없어도 됩니다.

## IP와 실행 위치

실제 요청이 발생하는 서버의 외부 IP가 키움 허용 조건을 충족해야 합니다. 환경변수의 기대 IP는 출발지 IP를 바꾸지 않습니다. `https://api.ipify.org?format=json`에 인증정보 없이 조회하고 `IP_MATCH`일 때만 API를 호출합니다. IP 불일치와 확인 불가는 별도 상태이며 둘 다 인증 호출을 막습니다. IP 확인 서비스 결과는 키움 토큰 발급 성공의 보장이 아닙니다. API와 IP 확인 서비스가 서로 다른 경로로 나가는 환경도 운영자가 확인해야 합니다.

Codex 환경에서 추가한 네트워크 **초안**: `openapi.kiwoom.com`, `api.kiwoom.com`, `mockapi.kiwoom.com`, `api.ipify.org`. 기존 허용 목록은 보존했습니다. 저장은 현재 환경 적용이 아닙니다. 클라우드에서 계속 검증하려면 환경 설정에서 검토·저장 후 환경 게시가 필요하고, 이후 IP를 다시 대조해야 합니다. 이를 우회하는 공개 프록시는 사용하지 않습니다.

사용한 [cloud-environment-onboarding:setup SKILL.md](skill://plugin_connector_1p_ed5feb9070a08191b08c81c47947bc16/setup/SKILL.md)의 명시적 규칙은 “Saving persists configuration; it does not execute scripts, apply runtime changes, or publish.”입니다. 따라서 초안 저장을 네트워크 개통이나 환경 게시 완료로 기록하지 않았습니다.

## Windows PC 최초 실행 순서

Node 22 이상 및 저장소가 있는 PowerShell 세션에서 실행합니다. `npm ci`는 최초 의존성 설치 때만 필요합니다. 실행 중인 기존 앱 서버는 먼저 Ctrl+C로 종료합니다.

```powershell
Set-Location '<저장소를 받은 폴더>'
npm ci
. .\scripts\Set-KiwoomSession.ps1 `
  -AppKeyPath (Read-Host 'App Key 파일 전체 경로') `
  -AppSecretPath (Read-Host 'App Secret 파일 전체 경로')
$env:KIWOOM_ENV = 'real'
$env:KIWOOM_FLOW_ENABLED = 'true'
$env:KIWOOM_FLOW_MODE = 'direct'
$env:KIWOOM_EXPECTED_EGRESS_IP = '220.72.76.41'
$env:KIWOOM_REQUESTS_PER_SECOND = '2'
npm run verify:kiwoom -- --check-config
```

`Set-KiwoomSession.ps1`은 사용자가 지정한 파일 두 개만 읽습니다. `*_secretkey.txt`와 `*_appsecret.txt` 모두 역할에 따라 읽으며 폴더를 검색하지 않습니다. 일반 파일·읽기·크기·빈 값·BOM·주변 공백·다중 행·동일 값 여부를 검사한 후 두 변수를 설정합니다. 내부 문자와 대소문자는 보존합니다. 실패 시 원문·일부 문자열·파일 경로를 출력하지 않습니다.

앞의 점(`. `)은 **현재 세션에 적용하는 dot-source**입니다. 다른 PowerShell 프로세스에서 스크립트만 실행하면 부모 셸에 전달되지 않습니다. 위 세션에서 시작한 앱·CLI 자식이 값을 받습니다. 이미 실행 중인 서버는 값을 받지 않으므로 재시작합니다.

다른 키움 소비 프로세스(앱 direct 서버, 수집기)를 모두 종료한 상태에서 먼저 삼성전자 소량 진단을 실행합니다. `--single-process`는 이 전제를 실행자가 확인하는 옵션입니다. 진단은 별도 메모리 PGlite에서 토큰/제한 상태만 관리하며 **운영 DB에 연결하거나 변경하지 않습니다**. 같은 PC의 중복 CLI는 자격증명 지문별 파일 잠금으로 막습니다. 다른 머신까지 이 파일 잠금으로 보호된다고 주장하지 않습니다. 다른 프로세스를 중지할 수 없다면 이 독립 진단을 실행하지 마세요. 실제 운영 수집/웹 direct는 공유 DB 제한기를 사용합니다.

```powershell
npm run verify:kiwoom -- --live --single-process `
  --code 005930 --from 2026-09-01 --to 2026-10-02
```

설정 → 외부 IP → 토큰 → 지표별 **1페이지** 순서입니다. 토큰·요청 Body·공급자 메시지 원문은 출력하지 않습니다. 한 페이지 진단은 전체 기간 완료가 아닙니다. 실제 원자료 건수·유효값 수·최초/최종일·연속조회 여부를 확인한 뒤 저장 작업으로 진행합니다. 최초 진단은 `005930`만 허용합니다. `--live`가 없으면 설정 검사만 하고 API를 호출하지 않습니다.

## 영속 DB·로그인 연결

기존 PostgreSQL/PGlite `getSql()`을 재사용했습니다. 웹 direct 및 실제 sync CLI는 `DATABASE_URL`을 요구하고 연결 실패 시 메모리 DB로 바꾸지 않습니다. 개발 테스트의 메모리 DB, 디스크형 PGlite 테스트는 운영 PostgreSQL 검증이 아닙니다. CLI와 웹앱이 **같은 PostgreSQL** 및 같은 소유자 범위·환경·시장·상품을 읽어야 합니다.

서버 키는 개인 소유자용입니다. 기존 Better Auth가 검증한 실제 `user.id`를 `KIWOOM_OWNER_USER_ID`로 설정합니다. auth-off의 `dev-user`는 키움 웹 접근에 사용하지 않습니다. 서명된 로그인 세션의 소유자만 자료 읽기·direct 수집을 할 수 있습니다. `/status/kiwoom`의 진단은 읽기 전용이고 미인증 방문자에게는 설정 여부만 제공합니다. 수집 HTTP 엔드포인트는 없습니다. 로컬 CLI는 키/DB에 접근 가능한 OS 실행자 권한으로 보호합니다.

체크아웃의 `.grok/app-env.json`은 auth-off입니다. 실제 배포의 설정은 확인되지 않았습니다. 기존 Better Auth를 그대로 사용하여 `/api/auth/*`, `/login`, 로그아웃을 연결했고 기존 email/password 옵션을 활성화했습니다. 원본 인증 스키마를 **바이트 동일하게** `migrations/0001_auth.sql`로 복사하여 기존 migration 명령의 적용 대상에 넣었습니다. 운영 DB에는 적용하지 않았으며 기존 데이터는 삭제하지 않습니다.

웹앱 배포 설정에 `VITE_AUTH_ENABLED=true`(공개 인증 스위치만), 서버 전용 `BETTER_AUTH_URL=<웹앱의 실제 HTTPS origin>`, `BETTER_AUTH_SECRET=<안전하게 생성한 비공개 세션 서명 값>`, 공유 `DATABASE_URL`을 등록하고 빌드/서버를 다시 시작합니다. 인증 비활성 또는 운영 DB/세션 설정 누락 시 auth API는 503으로 닫힙니다. Google/X는 기존 per-app `GROK_AUTH_CLIENT_ID/SECRET` 설정이 필요하며 이메일 로그인은 이 broker 자격증명이 없어도 기존 Better Auth로 동작합니다.

`/login`에서 본인의 이메일 계정을 만들고 로그인합니다. 다시 `/login`에서 표시되는 **내 계정 ID**를 운영자가 웹앱 및 수집기의 `KIWOOM_OWNER_USER_ID`로 등록하고 서버를 다시 시작합니다. 가입만으로 소유자가 되지 않습니다. 다른 로그인 계정, 미인증 방문자, `dev-user`, 브라우저가 보낸 owner ID는 허용하지 않습니다. 기존 같은 출처/Fetch-Metadata·세션 검증을 유지합니다. 별도의 로그인 라이브러리나 공개 개인키 프록시는 추가하지 않았습니다.

새 마이그레이션 `migrations/0002_kiwoom_flow.sql`은 키움 원자료·작업·조정 테이블만 추가합니다. 기존 데이터를 삭제하지 않습니다. 운영 DB의 변경 관리/백업 절차를 거쳐 운영자가 명시적으로 적용합니다. 기존 `npm run build`는 `db:migrate`를 실행하므로, 이 작업에서는 다음 격리된 빌드를 사용했습니다.

```powershell
# 격리된 테스트 DB 또는 DATABASE_URL이 없는 검증 세션에서만:
npm run build:dev
# 마이그레이션을 포함하지 않는 production bundling:
npm run build:bundle
# 운영 DB를 연결하는 배포/수집 환경에서는 승인된 마이그레이션 절차로:
npm run db:migrate
```

스키마 적용 전후 확인은 `npm run verify:kiwoom -- --check-database`입니다. 이 명령은 DB에 **조회만** 하고 키움 API나 migration을 실행하지 않습니다. 세 테이블의 존재와 `_migrations`의 `0002_kiwoom_flow.sql` 기록 여부를 출력합니다. `DATABASE_URL`이 없으면 `DATABASE_MISSING`, 테이블 누락이면 `DATABASE_SCHEMA_MISSING`으로 실패합니다. DB 연결 실패를 메모리 DB로 바꾸지 않습니다.

검증에 사용한 실제 Linux 빌드는 `env -u DATABASE_URL node scripts/with-app-env.mjs vite build`입니다. npm의 `node_modules/.bin`을 PATH에 추가했고 운영 DB 연결·마이그레이션은 수행하지 않았습니다.

현재 Nitro/Rolldown의 SSR chunk 분리에서 누락 export가 발생하여 `vite.config.ts`의 지원 옵션 `inlineDynamicImports=true`로 **서버 번들만** 내장합니다. production 미리보기의 실제 진단 요청을 검증했으며 브라우저 chart/code splitting은 유지합니다. 배포 후 서버 시작 및 cold start도 확인하세요.

## 최초 수집·재개·증분·재조회

위 PowerShell 세션에 **공유 영속 DB와 실제 소유자 ID**를 비공개로 설정합니다. DB URL은 관리 UI/비밀 저장소에서 주입하세요. 진단 전용 임시 소유자와 운영 소유자를 혼동하지 않습니다.

```powershell
$env:KIWOOM_OWNER_USER_ID = '<기존 로그인 user.id>'
# DATABASE_URL은 이 세션에 비공개로 주입된 상태여야 합니다.
npm run sync:kiwoom-flow -- --live --code 005930 --instrument stock `
  --from 2025-10-02 --to 2026-10-02 --max-pages 25 --budget-ms 45000
# partial/collecting이면 동일 조건으로 중단 커서를 이어받습니다.
npm run sync:kiwoom-flow -- --live --code 005930 --instrument stock `
  --from 2025-10-02 --to 2026-10-02 --resume
npm run sync:kiwoom-flow -- --live --code 403870 --instrument stock `
  --from 2025-10-02 --to 2026-10-02 --resume
npm run sync:kiwoom-flow -- --live --code 069500 --instrument etf `
  --from 2025-10-02 --to 2026-10-02 --resume
# 신규 날짜 + 최근 14일 정정 구간 갱신 (최초 이력 확보 후)
npm run sync:kiwoom-flow -- --live --code 005930 --instrument stock `
  --from 2025-10-02 --to 2026-10-02 --incremental
# API 호출/DB 쓰기 없이 저장 결과 확인. 별도 프로세스로 다시 실행하세요.
npm run verify:kiwoom -- --read-stored --code 005930 --instrument stock `
  --from 2025-10-02 --to 2026-10-02
```

최근 구간 검증은 같은 수집 명령의 `--from 2026-09-01`로 별도 실행합니다. `--scope KRX|NXT|SOR`는 명시적 선택입니다. 기본은 KRX이며 NXT/SOR 선택에만 공식 `_NX`/`_AL`을 붙입니다. ETF라는 이유로 접미사를 붙이지 않습니다. `069500`은 저장소의 기존 ETF 페이지/검증에서 확인한 국내 ETF입니다. 키움의 각 지표 지원은 실응답 전까지 보장하지 않습니다. 영문 포함 6자리 국내 코드는 문자열로 유지하지만 공급자 실제 지원은 별도입니다.

위 1년은 수집 예시이며 차트의 60d/3mo/6mo/1y/2y/5y와 **고정 투신 누적 기준일**에 맞춰 `--from`을 지정해야 합니다. 2년 기준 차트에 1년만 저장하면 부족한 구간과 누적 미확정이 표시되는 것이 정상입니다. 기준일을 임의로 바꾸지 말고 더 오래 수집하거나 사용자가 `일별` 또는 `가용 연속 구간 누적`을 선택합니다. collector 웹앱에서 범위를 넓혀도 직접 API를 호출하지 않으므로 수집기에서 그 과거 구간을 별도로 확보해야 합니다.

최대 페이지/시간 예산은 작업 단위일 뿐 전체 이력 완료 기준이 아닙니다. 날짜 정렬·중복·이전 구간 진행·반복 커서·빈 페이지·키 누락을 검사합니다. 작업에 조건과 중단 커서를 저장합니다. 거절된 재개 키(`1517`)는 원래 공식 Body로 한 번 재시작하며 중복은 제거합니다. 커서 영구 유효성을 가정하지 않습니다. 재개 시에도 예산을 넘으면 `partial/collecting`입니다. 증분은 기존 이력의 빈 구간을 자동 완성하지 않으므로 최초 수집의 부족분을 먼저 확인해야 합니다.

`--calendar '<가격 일별 날짜 JSON 파일>'`은 실제 가격에서 확인한 `YYYY-MM-DD` 문자열 배열입니다. 값이 없으면 누락 거래일 수는 unknown/null로 보고합니다. 임의의 평일 목록을 생성하지 않습니다. 웹앱은 기존 가격 일별 관측 날짜와 대조합니다. 휴장·거래정지·상장 전·최신 미공표의 이유를 확인할 자료가 없으면 원인을 단정하지 않습니다. 주말 시작 후 월요일 관측이 확인되는 구간은 누적을 막지 않습니다.

## collector와 반복 실행

웹 서버 IP나 실행시간이 적합하지 않으면 웹앱은 `KIWOOM_FLOW_MODE=collector`와 공유 DB/기존 로그인만 설정합니다. 웹앱에 키를 넣을 필요가 없고 웹 요청은 인증/IP 확인/API 조회를 발생시키지 않습니다. 허용 IP의 PC/NAS에서 같은 저장소·수집 서비스를 사용합니다.

### A. 현재 권장: 고정 IP 수집기 + PostgreSQL + Vercel

`허용 IP PC/NAS → 키움 REST API → 공유 PostgreSQL → Vercel 웹앱 → 차트`입니다. 일반 Vercel Hobby 함수가 사용자의 등록 IP `220.72.76.41`에서 통신한다고 가정하지 않습니다.

| 변수 | Vercel 웹앱 | 허용 IP 수집기 |
| --- | --- | --- |
| `KIWOOM_FLOW_ENABLED` | `true` | `true` |
| `KIWOOM_FLOW_MODE` | `collector` | `direct` |
| `KIWOOM_ENV` | `real` | `real` |
| `DATABASE_URL` | 동일 PostgreSQL, 비공개 | 동일 PostgreSQL, 비공개 |
| `KIWOOM_OWNER_USER_ID` | 검증된 본인 계정 ID | 동일 ID |
| `KIWOOM_APP_KEY/SECRET` | 필요 없음 | 지정 파일로 비공개 주입 |
| `KIWOOM_EXPECTED_EGRESS_IP` | 필요 없음 | 실제 등록 IP (`220.72.76.41`인 환경 우선) |
| `KIWOOM_REQUESTS_PER_SECOND` | 기본 2 | `2` |
| 인증 설정 | 앞 절의 실제 로그인/세션 설정 | 로컬 OS 실행자 권한; 웹 로그인 토큰 불필요 |

`npm run kiwoom:collect -- --live --code 005930 --from 2025-10-02 --to 2026-10-02 --resume`는 기존 `sync:kiwoom-flow`의 별칭이며 같은 클라이언트·저장소·수집기를 사용합니다. 최초 수집이 partial이면 같은 조건의 `--resume`을 반복하고 완료/최초·최종 제공일/누락을 확인한 뒤 `--incremental`로 전환합니다. 날짜는 실제 필요한 구간으로 지정합니다. 수집기 중지 후 새 웹 요청이 DB만 읽는지, 별도 프로세스 재조회와 웹 서버 재시작 후 동일 이력이 남는지 확인해야 합니다.

### B. 대안: Vercel Pro Static IPs의 직접 조회

운영자가 Pro 및 Static IPs를 실제 활성화하고 **실제 할당된 외부 IP**를 키움에 등록한 경우에만 `direct`를 고려합니다. 웹앱에 서버 전용 키와 실제 `KIWOOM_EXPECTED_EGRESS_IP`, DB, 소유자 인증을 설정해야 합니다. 등록 IP는 자동 변경하지 않습니다. 각 direct 작업에서 출발 IP를 재확인하며 mismatch/확인 불가면 키움 호출을 막습니다. 일반 Hobby의 고정 IP를 보장하지 않으며 상품 구매·생성을 실행하지 않았습니다. 서버리스 실행 예산을 넘는 초기 이력은 기존 collector CLI로 분리합니다.

최초 이력을 확보한 뒤 Windows에서 아래 **자식 PowerShell 래퍼**를 실행하면, 지정한 파일로 매번 주입하고 동일 DB에 순차 증분 수집합니다. 기본 0초는 1회 실행이며 600초는 이전 실행 종료 후 10분 간격입니다. 실패/부분 수집이면 반복을 멈추고 안전한 진단을 확인합니다.

```powershell
pwsh -NoProfile -File .\scripts\Run-KiwoomCollector.ps1 `
  -AppKeyPath '<App Key 파일 경로>' -AppSecretPath '<App Secret 파일 경로>' `
  -DatabaseUrlPath '<비공개 PostgreSQL URL 한 줄 파일 경로>' `
  -OwnerUserId '<검증된 user.id>' -ExpectedEgressIp '220.72.76.41' `
  -FromDate '2025-10-02' -Symbols 'stock:005930','stock:403870','etf:069500' `
  -RepeatEverySeconds 600
```

키/DB 파일은 해당 실행자만 읽도록 OS 권한을 제한합니다. 파일을 저장소에 두지 않습니다. Windows 작업 스케줄러는 이 래퍼를 **키 파일을 읽을 권한이 있는 본인 실행자**로, 저장소를 작업 디렉터리로 지정해 1회 모드로 실행합니다. 스케줄러의 “새 인스턴스를 시작하지 않음”을 설정합니다. 스케줄러는 대화형 세션의 변수를 상속한다고 가정하지 않고 파일을 명시적으로 읽습니다. 작업 설치/OS 설정 변경은 자동 수행하지 않았습니다.

운영의 모든 direct/수집 프로세스는 같은 DB의 자격증명 지문별 제한기·인증 잠금을 공유해야 합니다. 토큰은 Secret에서 유도한 키로 AES-256-GCM 암호화해 DB에서 공유하고 만료 여유 60초를 둡니다. 환경·기대 IP에 따라 토큰 캐시를 분리합니다. 서로 다른 DB나 다른 프로그램에서 같은 자격증명을 동시에 소비하는 총량은 이 코드가 제어하지 못합니다.

Linux/NAS는 서버 비밀관리 도구로 환경변수를 주입한 후 동일 `npm run sync:kiwoom-flow -- --live ... --incremental` 명령을 실행합니다. 기존 작업 실행 체계의 단일 실행 설정과 OS 실행자 권한을 사용하세요. 스케줄러 서버나 새 유료 서비스는 추가하지 않았습니다.

프로세스 종료는 실행 창의 Ctrl+C입니다. 수집 프로세스가 확실히 종료된 후 잔류 잠금을 처리합니다. 실패 후 잠금 파일을 임의로 삭제하지 않습니다. 수동 dot-source 세션에서 키를 지우려면 다음을 실행합니다. 이미 실행 중인 자식에는 영향을 주지 않으므로 먼저 자식을 종료합니다.

```powershell
Remove-Item Env:KIWOOM_APP_KEY, Env:KIWOOM_APP_SECRET, Env:DATABASE_URL -ErrorAction SilentlyContinue
```

## 계산·표시·제공 범위

저장은 `invtrt` 일별 원자료입니다. 정정 upsert 후 읽을 때 누적을 다시 계산합니다. 고정 기준일 포함 합계를 사용하며 중간 누락 후에는 누적 null과 이유를 표시합니다. 일별 값은 남습니다. 가용 최근 연속 구간 누적은 사용자가 선택할 때만 활성화하고 실제 시작일을 표시합니다. 확대/축소는 고정 기준일을 바꾸지 않습니다. 주/월 비율은 마지막 유효 관측, 순매수는 완전하게 확보한 해당 기간 합계이며 부분합은 null입니다. 분봉과 공표 시각 미확인 리플레이는 비활성입니다.

공식 스키마상 `unit_tp=1`은 1주입니다. ETF 주/좌 해석과 종목별 실제 지원은 응답 및 HTS 대조 전까지 미확인으로 표시합니다. 신용 `remn`은 융자 조건에서 **백만원** 참고값이며 잔고율 계산의 분모로 쓰지 않습니다. 세 `dt`는 스키마에 `일자/YYYYMMDD`만 명시되어 매매일/결제일을 단정할 근거가 없어 `dateBasis=unknown`으로 보존했습니다. `fetchedAt`을 공표 시각으로 사용하지 않습니다.

빈 응답은 0 또는 미지원이 아닙니다. 마지막 정상 값은 일시적 실패/무효 정정으로 지우지 않고 stale/최종 관측/확보 기간/오류 상태를 표시합니다. 키움 실패 시 KIS·네이버로 대체하지 않습니다. 다른 기능의 KIS/네이버 연결은 유지됩니다.

## 공식 근거와 배포 후 점검

- https://openapi.kiwoom.com/guide/apiguide
- https://openapi.kiwoom.com/intro/serviceInfo
- https://openapi.kiwoom.com/intro
- https://github.com/Kiwoom-Securities/Kiwoom-REST-API
- 검토한 공식 저장소 HEAD: `953e5dbff123f437ab4d11a78a95191a685eb51f`
- `kiwoom/_data/kiwoom_api_spec.json`: 세 API의 요청·응답 필드/단위/시장 접미사/연속조회 헤더 및 오류코드 확인.
- `examples/국내주식/종목정보/get_domestic_credit_trade_trend.py`
- `examples/국내주식/기관_외국인/get_domestic_stock_foreign_investor_trade_trend.py`
- `examples/국내주식/종목정보/get_domestic_stock_investor_by_institution.py`
- `examples/국내주식/종목정보/get_domestic_daily_trade_detail.py`: 진단 전용 `ka10015`, `/api/dostk/stkinfo`, `{stk_cd,strt_dt}`와 `daly_trde_dtl[].crd_remn_rt/for_wght` 확인.
- `kiwoom/core/auth.py`: `expires_dt`를 KST로 지정 후 UTC 변환.
- `kiwoom/core/errors.py`와 공식 오류 스키마: 1700/1701/1702 제한, 8005 무효 토큰, 8010 IP, 8031 환경 불일치, 8103 토큰/단말 인증 복합 오류 확인. 모호한 IP/환경 오류는 자동 갱신하지 않습니다.

공식 웹 3개 주소는 Codex 네트워크 CONNECT 403으로 읽지 못했습니다. 국내 조회 제한 5회/초는 사용자 명세와 예제 간격 0.2초에 부합하지만 현재 서비스 정책의 **독립 재확인은 미실시**입니다. 따라서 상한을 2회/초로 보수적으로 제한했고 재시도·토큰도 동일 제한에 포함합니다. 운영 연결 전에 공식 서비스 안내에서 계좌/토큰별 현재 제한을 재확인하세요. 공식 예제의 최대 10페이지나 예시 데이터는 전체 이력/실데이터 증거로 사용하지 않았습니다.

공식 스키마에서 응답 `cont-yn/next-key`는 선택 필드입니다. `Y`이면 반드시 반환 키를 전달하고, 종료 페이지의 누락/빈 `cont-yn`은 `N`으로 처리합니다. 알 수 없는 헤더·Y의 키 누락·중복 페이지·진행 중단은 partial 진단으로 남깁니다. 페이지의 oldest/newest는 원래 행 순서와 무관하게 날짜의 최소/최대로 계산합니다.

### 안전한 진단과 ka10015 대조

도구 메뉴 → **키움 연결 상태**(`/status/kiwoom`)는 설정 boolean, 현재 실전/모의·모드, 소유자 세션 확인 여부를 표시합니다. 소유자에게만 세 테이블 존재, 저장 건수·기간·최근 성공·수집 작업의 안전한 코드/상태를 보여 줍니다. 실제 키, 토큰, 인증 헤더, 등록/관측 IP, owner ID, cursor, 공급자 원문은 반환하지 않습니다. collector 웹의 IP/토큰은 `NOT_REQUIRED`, 실호출하지 않은 API는 `NOT_TESTED`이며 저장 작업 상태는 `STORED_JOB_*`로 분리합니다.

`DISABLED`, `CREDENTIALS_MISSING`, `OWNER_AUTH_FAILED`, `DATABASE_MISSING/SCHEMA_MISSING/FAILED`, `EXPECTED_IP_MISSING`, `IP_MISMATCH/UNVERIFIED`, `TOKEN_FAILED`, `API_FAILED`, `PARSING_FAILED`, `NO_HISTORY`, `READY/PARTIAL/COLLECTING`, `RATE_LIMIT`을 구분합니다. 빈 응답만으로 미지원이라고 판정하지 않습니다.

허용 IP에서 최초 소량 진단이 성공한 뒤 **명시적인 개발/진단 옵션**으로만 다음을 실행합니다.

```powershell
npm run verify:kiwoom -- --live --single-process --cross-check `
  --code 005930 --from 2026-09-01 --to 2026-10-02
```

기본 세 API 진단과 별도로 ka10015를 최대 2페이지/12초 조회하여 겹치는 날짜의 신용/외국인 비율을 비교합니다. 비교 허용차는 앱의 진단 기준 **0.05 percentage points**이며 공식 허용 오차를 뜻하지 않습니다. 불일치 날짜/차이/경고를 출력하지만 저장하거나 차트 값을 대체하지 않습니다. 날짜 기준이 unknown이므로 불일치만으로 어느 API가 잘못됐다고 단정하지 않습니다. 겹치는 유효 값이 없으면 비교 미실시입니다. 이 옵션은 웹 차트·수집 명령에서 호출하지 않습니다.

배포 후에는 인증된 소유자 화면에서 세 패널 순서·시간축·십자선·툴팁·기준일을 확인하고, 서버 재시작/재배포 및 수집기 종료 후에도 DB 재조회가 되는지 검사합니다. 삼성전자/HPSP/국내 ETF 각각 최근·1년 이력의 유효 필드·페이지·범위·저장을 기록하세요. 동일 날짜·시장·단위·기준일의 HTS 자료가 있을 때 대조하고, 없으면 대조 미실시로 남깁니다.
