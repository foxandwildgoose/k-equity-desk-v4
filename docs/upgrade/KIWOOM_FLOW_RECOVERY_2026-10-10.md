# 모든 국내 종목의 키움 세 패널 복구 — 2026-10-10

기준 커밋: `94405aa74ef36ce94cc329f4d0201f21528074b6`. 기존 코드와 API·DB·인증·차트를 유지하여 수정했습니다. 대상은 특정 샘플 종목이 아니라 검증된 모든 코스피·코스닥 개별주가 사용하는 공통 경로입니다. ETF/ETN의 기존 상품·시장 분리도 유지합니다. 기존 검색, Bollinger, SMA, 매물대, 가격·거래량 및 미국 차트는 다시 만들지 않았습니다.

사용자는 App Key와 App Secret을 이미 수령했고 기존 PC 수집기가 PC를 켤 때 PowerShell에서 자동 실행된다고 확인했습니다. 2026-10-05의 운영자 제공 OAuth/IP/세 API/Neon/별도 프로세스 재조회/Vercel/005930 표시 성공 기록은 [검증 문서](KIWOOM_FLOW_VERIFICATION.md)에 보존합니다. 이는 이번 수정본의 모든 국내 종목 실수신을 증명하지 않습니다.

## 확인된 결함과 수정

아래는 코드·결정적 테스트·격리된 브라우저에서 확인한 결함입니다. 현재 배포 서버의 로그나 PC 작업의 실제 실행 인수를 확인한 결과로 확대하지 않습니다.

| 결함 | 결과 | 수정 |
| --- | --- | --- |
| 수집 CLI가 정상적인 부분 수집까지 실패 종료로 처리 | 최초 삼성전자 이력이 부분이면 뒤의 다른 종목 대기열까지 중단 가능 | 부분·종목별 일시 오류는 종료 2로 분리하고 worker가 계속 처리. 인증/IP/DB 등의 전역 오류는 종료 1로 즉시 중단 |
| 직접 실행 래퍼의 기본값이 일회 실행 | PC 전원 ON 시 실행해도 종료 후 새 종목 예약을 소비하지 못할 수 있음 | 기본 300초 반복, 명시적인 `-RepeatEverySeconds 0`만 일회 실행 |
| 완료 종목까지 100개 상한에 포함 | 먼저 완료한 100종목이 이후 종목을 영구 차단 | 미완료 상한 100과 전체 구독 상한 6000 분리. 상한 상태를 `TARGET_LIMIT_REACHED`로 명확히 표시 |
| 예약 범위가 PC 시작 시점의 종료일에 머묾 | 재시작하지 않은 수집기의 새 거래일 누락 가능 | due 대상 처리 시 종료일을 KST 현재일로 갱신하고 기존 백필 범위 제한 유지 |
| 저장값이 있으면 더 긴 요청 범위를 예약하지 않는 경로 | 기간 확대 후 필요한 이력이 채워지지 않음 | 요청 시작/종료 확장과 실제 거래일 결측을 판단하여 재예약 |
| 공개 재조회가 예약 상태로 기존 API 오류를 덮음 | 토큰/API/파싱 실패를 단순 대기로 오해 | 마지막 업무 오류와 현재 대기열 상태를 별도 전달 |
| 증분 시작 판단이 저장 행 또는 최근 좁은 작업에만 의존 | 중간 미수집 구간을 건너뛰거나 공급자 제공 끝을 완료로 오인 가능 | 검증된 전체 범위 완료 작업을 확인한 뒤 14일 겹침 증분. 미완료 커서/시작일 확장 우선, 제공 끝·결측 상태 보존 |
| 선택적 heartbeat 테이블 미설치도 worker 전체 중단 | 기존 0002/0003 저장 경로가 정상이어도 수집 중단 가능 | heartbeat 미확보는 종료 3/UNKNOWN. 필수 네 테이블과 실제 DB 실패는 여전히 중단 |
| 읽기 갱신이 오래 기다리거나 포커스 복귀 시 갱신되지 않음 | DB 저장 뒤 열린 차트가 빈 상태로 남아 보임 | 예약 중 처음 2분은 15초, 이후 60초 재조회. 포커스 복귀 및 수급 자료 새로고침 지원 |
| 월/연봉 max의 20년 초과 읽기 요청 전체 거절 | 가격은 보이지만 세 패널 모두 오류 가능 | 읽기 범위는 최대 100년, 수집 범위는 기존 최근 1830일. 부족한 오래된 이력은 부분으로 표시 |
| 최신 누적값 결측 때 이전 정상 누적값을 caption으로 대체 | 중간 결측 뒤 고정/가용 누적을 확정값처럼 표시 | 누적 요약은 정확한 날짜의 결측을 유지. 비누적 지표의 날짜를 명시한 최근 실제 관측 요약은 보존 |
| 샘플 종목에 머무는 상태 확인 경로 | 다른 종목 원인 파악이 어려움 | 차트의 실제 코드로 `/status/kiwoom?code=...` 이동하고 진단 코드 입력 지원 |

신규 공개 예약은 서버가 고정 URL의 한국 종목 메타데이터로 코드·국가·상품 유형을 확인합니다. 제한·single-flight·시간 제한·최대 응답 크기를 적용합니다. 이 정보는 상품 식별에만 사용하며 세 지표를 Naver/KIS로 대체하지 않습니다. 확인 실패가 이미 저장한 키움 자료의 읽기를 차단하지 않습니다. 운영자 명시 대상과 기존 등록 대상은 기존 절차를 유지합니다.

## 유지한 데이터 계약

| 패널 | API/경로 | 필드·조건 |
| --- | --- | --- |
| 신용잔고율 | `ka10013` `/api/dostk/stkinfo` | `qry_tp="1"`, `crd_trde_trend[].remn_rt`, percentage points |
| 외국인보유비율 | `ka10008` `/api/dostk/frgnistt` | `stk_frgnr[].wght`, 보유 수량 `poss_stkcnt` |
| 투신 일별/누적 순매수 | `ka10059` `/api/dostk/stkinfo` | `amt_qty_tp="2"`, `trde_tp="0"`, `unit_tp="1"`, `stk_invsr_orgn[].invtrt`, 0·음수 유지 |

공식 [예제 저장소](https://github.com/Kiwoom-Securities/Kiwoom-REST-API)의 `953e5dbff123f437ab4d11a78a95191a685eb51f` 명세 및 인증 예제를 다시 대조했습니다. OAuth는 `appkey`/`secretkey`, 토큰 응답 검증·KST 만료·single-flight·요청 제한을 유지합니다. `ka10015`는 기존 진단 대조 전용입니다. 연속조회, 페이지 날짜 최소/최대, 정정 upsert, null이 유효 관측을 지우지 않는 계약을 유지합니다. 누락은 0이 아니며 누적 기준일을 줌으로 변경하지 않습니다.

## 변경 파일과 역할

| 경로 | 목적 |
| --- | --- |
| `scripts/Run-KiwoomCollector.ps1`, `scripts/kiwoom-cli.mjs`, `scripts/kiwoom-collection.mjs` | 기존 PC worker 지속 처리, 부분 종료와 전역 오류 분리, 증분·재개 계약 |
| `src/server/kiwoom-targets.ts`, `src/server/kiwoom-store.ts` | 전체 종목 구독 용량, KST 새 거래일, 범위 확장, 완료 백필 증명 조회 |
| `src/server/kiwoom-target-identity.ts` | 신규 공개 예약의 제한된 실제 상품 유형 검증 |
| `src/server/chart-flow.ts`, `src/server/chart-flow-request.ts` | DB 읽기 → 필요한 범위 예약, 오류·대기 상태 분리, 장기 가격 범위 지원 |
| `src/lib/charts/flow-query-policy.ts`, `src/lib/use-chart-flow.ts` | 공유 React Query 요청·갱신 정책, 캐시 종목/사용자 분리 |
| `src/lib/charts/hts-flow.ts`, `src/lib/charts/hts-layout.ts`, `src/components/charts/pro/ProChart.tsx` | 안전한 상태, 정확한 누적 caption, 수급 새로고침·해당 코드 진단 |
| `src/routes/status.kiwoom.tsx` | 코드별 상태 진단, 기존 소유자 관리 권한 보존 |
| 관련 `.test.ts`/`.test.mjs`, `scripts/qa-kiwoom-recovery.mjs`, `package.json` | 실제 명령·자동 회귀·빌드 앱의 canvas 검증 |
| `KIWOOM_FLOW_SETUP.md`, `KIWOOM_FLOW_VERIFICATION.md`, 이 문서 | 기존 PC 갱신 순서와 실제 검사/운영 검증 구분 |

새 DB/ORM/운영 migration/의존성을 추가하지 않았습니다. `getSql()`과 기존 PostgreSQL/PGlite를 재사용합니다. collector 웹은 키움 키 없이 공유 DB만 읽고, 소유자 관리와 direct 권한은 그대로 유지합니다.

## 기존 PC에서 다음에 할 일

[설정 문서의 기존 자동 수집기 갱신 절차](KIWOOM_FLOW_SETUP.md#이미-pc-자동-수집neonvercel을-사용하는-경우-2026-10-10-갱신)를 실행합니다. 새 설치가 아니라 기존 저장소 코드 갱신과 기존 수집 프로세스 재시작입니다.

1. 기존 저장소에서 변경 파일/현재 브랜치를 확인하고 보존합니다.
2. 기존 수집 작업만 중지 → `git pull --ff-only origin main` → 기존 작업 시작 → 상태 조회를 실행합니다. 기존 작업 이름이 다르면 해당 작업을 사용합니다.
3. Vercel의 최신 수정 커밋이 Production/Ready인지 확인합니다. 웹은 기존 Neon URL·scope와 `collector` 모드를 유지합니다.
4. 서로 다른 코스피·코스닥 종목을 열고 `수급 자료 새로고침` 또는 해당 코드 진단으로 저장일·상태를 확인합니다.
5. 예약 대기가 계속되면 PC의 `Get-KiwoomCollectorStatus.ps1`과 소유자 진단에서 worker/DB/scope/안전한 오류 코드를 확인합니다. 키나 로그의 비밀값을 채팅에 보내지 않습니다.

모든 종목이 공통 경로로 예약·수집될 수 있다는 의미와 모든 상장사 데이터가 이미 저장됐다는 의미를 구분합니다. 첫 조회 대상·긴 최초 백필은 순차 처리됩니다. 기존 2회/초, 최대 10개 batch, backoff, 제공 이력 제한을 유지합니다. PC 종료 중에는 새 수집이 진행되지 않으며 웹은 기존 저장 자료를 읽습니다.

## 이번 실행 환경의 한계

현재 Codex 프로세스의 App Key/Secret/DB 설정은 각각 **false/false/false**입니다. 사용자가 수령한 자격증명이나 기존 PC/Vercel 설정이 없는 것으로 해석하지 않습니다. 설정 확인은 브로커·IP·DB를 호출하지 않았습니다. 실제 배포 사이트 접근은 환경 프록시의 CONNECT 403으로 차단되어 새 배포의 화면은 확인하지 못했습니다.

실제 허용 IP에서 이번 수정본의 수신, 기존 Neon 영속 저장·재시작, 최신 Vercel 표시 검증은 별도로 필요합니다. 아래 자동 검사와 합성 fixture의 PGlite/canvas 성공은 이 세 운영 검증을 대신하지 않습니다. 정확한 최종 실행 결과는 [검증 기록의 8절](KIWOOM_FLOW_VERIFICATION.md#8-모든-국내-종목-수집복구--2026-10-10)에 기록합니다.
