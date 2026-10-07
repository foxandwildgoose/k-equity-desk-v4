# Neon + Vercel Hobby 수집 경로 검증

확인일: 2026-10-06. 기준 커밋: `cbef1db4149fd9168902035e0c2a454684bd0e68`, 브랜치 `work`. 운영 설정 순서는 [BOLLINGER_SCREENER_2.md 6절](BOLLINGER_SCREENER_2.md#6-현재-사용자-neon--vercel-hobby만-사용하는-순서)에 있다.

## 확인한 원인

사용자 화면에서 Neon은 `screener_tables=9`, `migration_recorded=t`였지만 `/bollinger`에는 편입 스냅샷이 없었다. 테이블 준비와 실제 데이터 수집은 별개다. 당시 코드는 DB 읽기 화면과 로컬 CLI만 제공했으며 Vercel에서 실행할 수집 경로/예약이 없었다. 기존 키움 세 지표의 정상 운영을 이 스크리너의 실패로 해석하지 않는다.

이번 변경은 기존 공개가격 수집·SQL·계산 서비스를 재사용해 보호된 `/api/cron/bollinger`, 하루 1회 예약, 편입 페이지·가격·미완료 계산의 DB 재개, UI의 안전한 진행 상태를 연결한다. 새 migration이나 DB/차트 라이브러리 도입은 없다.

## 검증 상태 구분

| 단계 | 결과 | 증거/제한 |
| --- | --- | --- |
| 코드·자동 테스트 | 완료 | 아래 명령과 격리 DB/브라우저 검사 |
| 운영 Neon 0005 테이블·적용 기록 | 사용자 화면으로 확인 | 9개 테이블 / 적용 기록 t. 수집 성공과 별개 |
| 공개 API → 계산 → 격리 영속 DB → 재시작 조회 | 완료 | 실제 KOSPI Top10 수신, file PGlite 재개방. Neon에 쓰지 않음 |
| 실제 운영 Vercel → Neon 저장 | 검증 대기 | 최신 Production 배포·cloud flag·서버 CRON_SECRET·Cron Jobs Run 필요 |
| 실제 운영 화면 후보·예약 실행 | 검증 대기 | 배포 사이트 접근은 이 환경의 프록시 HTTP403으로 차단. fixture 화면을 운영 성공으로 인정하지 않음 |

현재 Codex 프로세스에는 운영 `DATABASE_URL`이 없다. 사용자 Vercel 환경의 값이 없다는 뜻은 아니다. 키움 키·고정 IP·로그인 설정을 변경하거나 새 키를 요청하지 않았다.

## 실제 실행한 검사

| 명령 | 최종 결과 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS: script 212 통과 / 12 PowerShell skip, 앱 522 통과 / 0 실패. 합계 734 통과 |
| `npm run test:bollinger` | PASS: 104/104 (새 cloud 검사 17개 포함) |
| `npm run lint` | PASS: 0 errors / 기존 56 warnings |
| `npm run build` | PASS: migration 없는 production bundle |
| `npm run check:auth` | PASS: dev/build의 기존 sign-in OFF 일치 |
| `npm run check:deploy` | PASS: 기존 packaging/security 계약 유지 |
| `npm run qa:bollinger-discovery -- --base <dev> --out <isolated QA>` | PASS: Light/Dark × desktop/tablet/mobile 6/6 |
| 같은 QA 명령, 최종 production preview | PASS: 6/6. 실제 SSR/client bundle과 격리 SQL/browser transport |
| `node scripts/browser-smoke.mjs <dev 및 final-production>/bollinger <screenshot> --baseline <dev>` | 앱 본문/JS/가로 폭 정상, pageerror 0. 비동기 수신 문구·렌더 시점에 따른 본문 길이/시작문구 baseline 차이와 외부 font/Grok TLS 오류·기존 OG placeholder note는 남음 |

새 검사 범위: 설정 검증·비밀값 비직렬화, 인증 전 DB/외부 호출 차단, URL query/Preview 쓰기 거부, 공개 오류 allowlist, 페이지 재개/반복/빈 페이지/total 변경/한국 날짜 전환, full pre-roll 계산 후 25봉 저장, 계산 중 신호 미발행, Top20 범위와 전체 membership 구분, 동일 날짜 no-op, 시간 예산·file DB 재시작·미완료 계산 재개, 다음 날짜 membership 재개의 중복 수집 방지, CLI와 공유 lease, 실패 종목만 재시도, 시장 지표 실패 명시, 무효 OHLC가 저장 성공으로 계산되지 않음, Hobby 하루 1회 cron.

날짜 경계를 보완한 뒤 과거 `knownAt`을 사용하던 두 cloud fixture가 실패했다. 공급자 테스트 receipt를 실제 계약처럼 현재 수집 시각으로 수정하고 같은 날짜 no-op/실패 종목 재시도 기대값을 유지했다. 새 날짜 경계 회귀 검사와 전체 검사를 다시 통과했다. 테스트를 삭제하거나 정상 기대값을 완화하지 않았다.

초기 `0f7653e`의 빌드 결과에는 예약이 포함됐지만, 실제 Vercel이 저장소와 build output의 예약을 합칠 때의 중복을 당시 검사하지 못했다. 2026-10-07 사용자 배포 화면에서 중복 예약 오류가 확인됐으며 아래 후속 수정에서 해결했다. 예약은 `vercel.json`에만 두고 Nitro build output에는 복사하지 않는다. 해당 함수의 `.vc-config.json`에는 Node22와 `maxDuration="max"`가 생성됐다. 실제 Vercel이 허용한 상한과 최초 Run 성공은 운영 확인 대상이다. fixture 없는 production 브라우저에서도 실제 GET 서버 함수 응답 후 수집 비활성 안내를 확인했다. 환경변수 없는 local production endpoint는 안전한 `CRON_SECRET_MISSING` HTTP503을 반환했고 DB/시장 수집을 시작하지 않았다.

## 실제 공개 수신 결과

검사 명령은 비밀값 없는 Codex 전용 helper에서 기존 provider와 `runBollingerCloud`를 호출하고 `/tmp`의 격리 file PGlite에만 저장했다. 현재 환경의 Node fetch에 필요한 관리형 proxy 설정을 적용한 뒤 수신했다. 이 설정은 Vercel 앱 코드에 추가하지 않았고 Kiwoom/IP 제한 우회에 사용하지 않았다.

- KOSPI 전체 편입 response: 2,482행, 지원 보통주 834개.
- Top10: 가격 저장 10/10, 계산 10/10, 지표 오류 0, 종목 오류 0.
- 각 종목 feature 저장: 최근 25봉. 원래 확보한 실제 가격 이력으로 계산한다.
- 격리 DB 종료 후 재개방: universe 복원, 현재 가용 10개, 상승 추세 7개, 압축 6개, 돌파 전 2개.
- 저장 최신 관측일: 2026-10-02. 최신 Squeeze Watch 일치 4개. 이는 수익성 검증이나 운영 Vercel 결과가 아니다.
- 원자료의 source/basis를 보존했다. 삼성전자 `005930`은 `yahoo-005930.KS` / `yahoo-kr-raw-ohlcv`, 키움으로 재라벨링하지 않았다.

[실제 수신·재개방 receipt](artifacts/bollinger-cloud/public-receipt.json). HTML/UI 테스트에서는 `QA SYNTHETIC` fixture만 격리 transport에 사용했으며 서비스 코드나 운영 DB에 fixture를 넣지 않았다.

## 변경 파일과 캡처

| 파일 | 목적 |
| --- | --- |
| `src/server/bollinger-cloud-config.ts`, `bollinger-cloud-handler.ts` | 서버 설정·Bearer 운영자 권한·안전한 상태·Production 쓰기 제한 |
| `src/server/bollinger-cloud.ts`, `bollinger-membership.ts` | 제한시간·공유 lease·날짜별 페이지/가격/계산 재개 |
| `src/server/bollinger-discovery-{providers,jobs,store}.ts` | 기존 수집/SQL/계산 재사용, 최근 저장 범위와 임시 신호 분리 |
| `src/routes/api.cron.bollinger.ts`, `vercel.json`, `vite.config.ts`, `src/routeTree.gen.ts` | 기존 TanStack 서버 경로·Hobby 예약·전용 함수 설정 |
| `src/server/bollinger-discovery.ts`, `src/routes/bollinger.tsx` | DB-only 검색 유지·단계별 상태·설정 안내 |
| `src/server/bollinger-cloud.test.ts`, `package.json`, `scripts/qa-bollinger-discovery.mjs` | 실행 가능한 자동/브라우저 회귀 검사 |
| `scripts/bollinger-discovery-cli.mjs`, README와 설정 문서 | 선택적 CLI와 Vercel만 사용하는 순서 구분 |

캡처: [Light desktop](artifacts/bollinger-cloud/screener-light-desktop.png), [Dark desktop](artifacts/bollinger-cloud/screener-dark-desktop.png), [Light mobile](artifacts/bollinger-cloud/screener-light-mobile.png), [Dark mobile](artifacts/bollinger-cloud/screener-dark-mobile.png). [개발 matrix](artifacts/bollinger-cloud/development-verification.json), [최종 production matrix](artifacts/bollinger-cloud/production-verification.json). 캡처에 쓰인 값은 QA SYNTHETIC으로 실제 투자 데이터 증거가 아니다.

운영 환경변수 변경·운영 DB migration·유료 서비스 생성·수동 배포는 실행하지 않았다. GitHub push에 따른 자동 배포 여부는 사용자의 기존 Vercel 연결 설정에 따른다. Hobby는 하루 1회 예약, 기본 Top20은 선택 범위이며 전체 시장·정시 실행·24시간 감시·신호 즉시 전송을 보장하지 않는다.

## 2026-10-07: Vercel 중복 예약 배포 오류 수정

기준 커밋 `0f7653e7728774422677cbb4601e66ac5aab95f6`. 사용자 첨부 로그에서 Vite/Nitro build는 완료됐지만, 출력 배포 단계에서 `A duplicated cron job`으로 실패했다. 경로 `/api/cron/bollinger`와 예약 `30 9 * * *`가 `vercel.json`과 Nitro `vercel.config.crons` 양쪽에 존재한 것이 원인이다. 캐시 해제, Neon 테이블, 사용자의 환경변수 입력 문제가 아니다.

`vite.config.ts`에서 예약 전달만 제거했다. 루트 `vercel.json`의 하루 1회 예약, 보호된 서버 경로, 함수별 최대 실행시간, 기존 수집·재개·DB·인증은 유지했다. 이전의 실제 배포 검증 부족을 인정하고, 검사에서는 두 입력을 함께 검증하도록 보완했다.

- 새 `inspectVercelCrons()`와 `check:deploy -- --build-output <디렉터리>`는 루트 설정과 실제 생성된 Build Output API `config.json`을 읽어 동일 경로/예약 중복을 거부한다. 수정 전 실제 local output에서는 `VERCEL_CRON_DUPLICATED`로 실패했고, 수정 후 출력에서는 PASS다.
- 사용자 로그와 같은 공식 Vercel CLI `62.1.0` npm 패키지의 SHA512를 registry integrity와 대조했다. CLI의 실제 `mergeCrons()` 함수를 격리 실행해 수정 후 최종 예약이 1개임을 확인했다. 동일 예약을 양쪽에 넣은 회귀 fixture는 2개로 합쳐진다. CLI 전체 배포나 운영 사이트 호출을 실행한 것은 아니다.
- 생성된 전용 collector 함수 경로와 `maxDuration="max"`가 그대로 남아 있다. 예약은 UTC `30 9 * * *`, 한국시간 18:30 전후다.
- `npm run typecheck`, `npm test`(script 214 PASS / PowerShell 12 skip, 앱 522 PASS, 총 736 PASS), `npm run lint`(0 errors / 기존 56 warnings), `npm run build`, `npm run check:deploy -- --build-output /workspace/.onboarding/builds/k-equity-desk-v4` 모두 PASS.
- 개발·production preview의 desktop/mobile 브라우저를 확인했다. 본문 HTTP200, 가로 넘침 없음, uncaught pageerror 0이며 빈 화면이 아니다. 일반 browser-smoke는 외부 리소스 TLS `ERR_CERT_AUTHORITY_INVALID` 때문에 exit2다. 개발 mobile에는 Sidebar Switch 스타일 hydration 경고도 관찰됐다. production에는 그 경고가 없었으며, 이번 수정은 Sidebar·차트·스타일을 변경하지 않는다. smoke 전체를 PASS로 기록하지 않는다. 캡처는 `/workspace/screenshots/cron-fix-dev{,-mobile}.png`, `/workspace/screenshots/cron-fix-production{,-mobile}.png`에 있다.
- 운영 키·환경변수·Neon migration을 변경하지 않았다. 인증 설정 없는 production preview에서 endpoint는 HTTP503을 반환했으며, 실제 수집 성공으로 보고하지 않는다.

[빌드 출력 및 공식 CLI 병합 증거](artifacts/bollinger-cloud/cron-packaging-verification.json). 수정 커밋의 실제 Vercel 배포와 최초 수집은 여전히 운영 검증 대상이다. `0f7653e` 실패 배포를 다시 Redeploy하면 수정 코드가 반영되지 않으므로 최신 `main`의 `fix: register Bollinger cron only once for Vercel` 배포를 선택해야 한다.
