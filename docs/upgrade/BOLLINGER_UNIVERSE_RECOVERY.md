# Bollinger 최초 편입 목록·실행 경로 복구

확인일: 2026-10-09 한국시간. 작업 브랜치 `work`, 기준 커밋 `f423716`. 기존 Neon schema `0005`, React/TanStack Start 및 기존 수집·계산 엔진을 확장한다. 새 DB·migration·요금제 변경은 없다.

## 확인한 문제와 해결

| 확인한 문제 | 수정 |
| --- | --- |
| KOSDAQ 스냅샷이 없으면 실행·수집이 모두 `!universeId` 조건으로 비활성화되어 최초 수집이 불가능 | 저장 스냅샷 요청과 최초 편입 요청을 엄격한 union 계약으로 받는다. 지원 시장은 스냅샷 없이도 실행에서 시작한다 |
| 기본 예약 대상은 KOSPI이고 사이트에서 KOSDAQ을 선택해도 예약 Run은 계속 KOSPI | 수동 최초 수집은 사용자가 선택한 시장을 고정한다. 예약 설정과 독립적이다 |
| 상단에 과거 KOSPI 작업을 모든 시장에 표시 | 사용자가 삭제를 요구한 상단 작업 이력을 제거한다. DB의 수집 기록은 유지한다 |
| 완료된 작업에 “상대 강도 최종 계산 전” 문구가 남음 | 완료 후 첫 단계 준비 설명을 표시하지 않고 현재 선택 작업만 표시한다 |
| 최초 수집은 권한 확인 이후 요청 의도가 소실되어 다시 별도 조작이 필요 | 실행에서 열리는 패널은 “권한 확인 후 실행”으로 방금 선택한 요청을 확인·시작한다. 일반 권한 확인은 수집하지 않는다 |
| 편입 저장 후 요청이 스냅샷 수집으로 바뀌면 다른 scope를 만들어 기존 체크포인트를 잃을 위험 | 진행 조회·이어받기는 고정된 최초 수집 요청을 유지한다. 공개 선택만 검증된 sessionStorage에 보관해 같은 탭 새로고침에서 복원한다. 복원만으로 수집하지 않으며 저장된 실제 universeId는 결과 조회에 연결한다 |
| 빈 목록·잘못된 ETF 코드·미지원 공식 지수 편입에 동일한 비활성 버튼 | 버튼 근처에 원인을 표시하고 ETF 수집 코드를 검증한다. SP500/NASDAQ100을 Nasdaq Listed로 대신 수집하지 않는다 |

사용자 캡처에서 KOSDAQ 스냅샷이 없고 버튼이 비활성인 것은 확인된다. 사용자의 CRON_SECRET·DB 연결 실패를 그 캡처만으로 확정하지 않는다. 이 환경에 해당 비밀 설정이 주입되어 있지 않은 것은 사용자의 Vercel 설정 여부와 별개다.

## 경로와 보안

`Universe 실행 → 운영자 확인(필요 시) → POST /api/bollinger/collect → runBootstrapBollingerCloud / runSelectedBollingerCloud → 기존 runBollingerCloud → 편입·벤치마크·일봉 수집 → getSql()/Neon → 최종 계산 → 후보 서버 함수 → React Query → 결과`

- 최초 요청은 `bootstrapTarget`, `configVersion`, `selection`, 선택적인 `symbols`만 받는다. 기존 저장 요청은 `universeId` 계약을 유지한다. 두 형태의 혼합·임의 URL·예산·비밀값은 거부한다.
- KOSPI/KOSDAQ/NASDAQ_LISTED/검증된 `ETF:6자리코드`만 고정된 서버 공급자로 수집한다. 거래 주문·키움 인증정보를 사용하지 않는다.
- HTTPS same-origin·Origin·Fetch Metadata·JSON 크기 제한·서명된 HttpOnly/Secure/Strict 운영자 쿠키와 기존 CRON_SECRET을 유지한다. 미인증 수집은 본문·DB·공급자 실행 이전에 차단한다.
- 최초 작업 scope는 대상·계산 버전·Top N·섹터·비중·종목 교집합을 정규화한 해시다. 예약·다른 선택 범위와 분리하고 전역 DB lease는 공유한다.
- 완전한 편입 목록만 universe로 저장한다. 일부 페이지는 job summary 체크포인트이며 검색 가능한 전체 스냅샷으로 공개하지 않는다.
- 재개할 때 같은 요청과 고정한 종목 키를 사용한다. 부분 편입의 수집 날짜가 바뀌면 기존 공급자 서비스가 새 페이지1부터 시작한다. 누락 가격·기준 이력을 만들지 않는다.
- 공개 원자료의 출처·가격 기준을 보존한다. 가용성 부족과 조건 일치 0건은 다른 상태다.

## 사용자의 다음 순서

1. GitHub 최신 수정으로 만들어진 Vercel **Production / Ready** 배포를 확인한다. 준비되어 있으면 이전 배포를 반복 Redeploy할 필요는 없다.
2. [스크리너](https://k-equity-desk-v4.vercel.app/bollinger)를 새로고침하고 Universe에서 **KOSDAQ → Top20 → 전체 섹터**를 선택한다. 전체 시장 최초 수집 대신 작은 범위부터 확인한다.
3. **실행**을 누른다. 최초 목록이 없으면 안내에 따라 자신의 HTTPS 사이트에서 기존 `CRON_SECRET`으로 **권한 확인 후 실행**한다. 키움 App Key/Secret을 넣는 곳이 아니다. 기존 권한이 유효하면 바로 요청한다.
4. 시간 예산 종료·중단 상태이면 **수집 이어받기**를 누른다. 현재 요청은 종료된 상태이며 무한 백그라운드 수집을 하지 않는다.
5. 목록·최종 계산 완료 후 같은 요청의 결과를 조회한다. 미확보·워밍업·오래된 계산·Coverage·전략 제외를 확인한다. 후보0건은 수집 실패와 다를 수 있다.

기존 Neon/Vercel Hobby 설정을 재사용한다. 이번 변경 때문에 Node.js 재설치·Neon 테이블 재생성·새 migration은 필요하지 않다. 권한 확인에 사용하는 비밀값을 채팅·URL·GitHub·캡처에 넣지 않는다.

## 운영 검증 범위

- 사용자 화면에서 이전 수정의 실행 버튼 배포와 KOSPI 저장 자료가 존재하는 것은 확인된다. 해당 자료의 성공을 KOSDAQ 최초 수집 성공으로 해석하지 않는다.
- 이 프로세스의 DATABASE_URL·CRON_SECRET·BOLLINGER_CLOUD_ENABLED 존재 여부는 false다. 사용자의 Vercel 값을 읽거나 변경하지 않았다.
- 공개 Naver 목록 API의 인증 없는 소량 조회는 성공했다: KOSPI 총2483행, KOSDAQ 총1823행, 각 첫페이지2행. 이는 목록 공급자 연결만 확인하며 실제 Neon 저장·생산 사이트 수집 성공의 증거가 아니다.
- 이 환경에서 운영 Vercel HTTPS 사이트 조회는 네트워크 프록시의 CONNECT HTTP403으로 차단되었다. 실제 배포·Neon 실데이터의 새 경로는 검증 대기다.

## 변경 파일

| 파일 | 목적 |
| --- | --- |
| `src/routes/bollinger.tsx` | 상단 과거 이력 제거, 최초 실행·권한 확인·재개, 명확한 비활성 사유와 현재 선택 상태 |
| `src/lib/bollinger/discovery-execution.ts` 및 테스트 | 선택 요청 고정, 늦은 응답의 다른 선택 덮어쓰기 방지, 공개 재개 정보만 같은 탭에 복원 |
| `src/lib/bollinger/collection-request.ts` | 저장 스냅샷/최초 편입 요청의 엄격한 공통 계약 |
| `src/lib/bollinger-discovery-fns.ts` | 최초 작업의 읽기 전용 진행 조회 |
| `src/server/bollinger-cloud.ts`, `bollinger-cloud-config.ts`, `bollinger-cloud-runtime.ts` 및 테스트 | 기존 제한 시간·DB lease·공급자·저장 엔진을 통한 최초 편입과 정확한 체크포인트 재개 |
| `src/server/bollinger-collection-handler.ts` 및 테스트 | 인증 우선 처리, 허용 대상·선택 검증, 안전한 오류 응답 |
| `scripts/qa-bollinger-discovery.mjs` | 목록 없는 시장 → 권한 → 부분 수집 → 새로고침 → 재개 → 결과의 production UI 회귀 검사 |
| `README.md`, `BOLLINGER_SCREENER_2.md`, `BOLLINGER_EXECUTION_VERIFICATION.md`, 이 문서 | 기존 Neon/Vercel에서 실제 실행하는 순서와 새 검증 범위 |

## 실행한 검사

모든 빌드·테스트에서 `DATABASE_URL`을 제거했다. DB 계약 검사는 격리된 PGlite를 사용하며 운영 Neon을 변경하지 않았다. 현재 `npm run build`는 migration을 실행하지 않는다.

| 검사 | 실제 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm test` | 스크립트 214 통과 / 기존 12 skip / 실패 0, 앱 564 통과 / 실패 0 |
| `npm run lint` | 오류 0 / 기존 경고 56, 종료 코드 0 |
| 변경 소스·QA 스크립트 대상 ESLint | 오류 0 / 경고 0 |
| `env -u DATABASE_URL npm run build` | production 빌드 통과 |
| `npm run check:deploy -- --build-output /workspace/.onboarding/builds/k-equity-desk-v4` | 통과, cron 중복 없음 |
| 생성된 Vercel HTTPS 어댑터의 실제 Request/Response 검사 | 미인증 최초 수집 401, 운영자 확인 200, 허용되지 않은 요청 필드 400, 다른 Origin 403, 인증 후 DB 미설정 503. 외부 네트워크 요청 0 |
| 일반 `browser-smoke.mjs`: dev 8080 / production 8189 | 두 화면 HTTP200, 본문·모바일 표시·가로 overflow 없음·JS 예외 없음. 기존 외부 font/Grok 인증서 실패 및 로컬 운영 설정 부재 때문에 명령 종료 코드 2; 전체 smoke 통과로 기록하지 않음 |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/qa-bollinger-discovery.mjs --base http://127.0.0.1:8189 --server-entry /workspace/.onboarding/builds/k-equity-desk-v4/functions/__server.func/index.mjs --out /workspace/screenshots/bollinger-universe-recovery` | production 빌드 Light/Dark × 데스크톱 1440×900 / 태블릿 768×1024 / 모바일 390×844, 6/6 통과 |

PGlite 디스크 재개 테스트는 별도 DB 인스턴스를 종료·열어 작업 ID·스냅샷·선택 종목·계산 버전이 유지되는 것을 확인했다. 운영 Neon의 재시작 검증을 대체하지 않는다.

브라우저 QA는 격리된 PGlite와 가로챈 테스트 전송 경로로 실제 빌드 UI를 검사했다. 각 화면에서 **KOSDAQ 목록 없음 → 명시적 권한 확인 → 편입 일부 수신(스냅샷 미공개) → 가격20/최종계산5/대기15 → 새로고침(수집 없음) → 같은 요청으로 이어받기 → 저장·최종계산20/대기0**를 확인했다. 세 수집 요청의 대상·Top20·사용자 계산 버전이 동일했다. 권한 취소·실패, 선택만 변경, 새로고침에서는 수집하지 않았다. 브라우저 예외·가로 overflow·비밀값의 browser storage 저장이 없었다. 이전 KOSPI/전략/페이지/근거/설정 JSON 회귀도 유지했다.

이 환경의 브라우저 실행은 준비된 Node22를 PATH에 넣고 `NODE_OPTIONS='--import /workspace/.onboarding/tools/use-system-chromium.mjs'`로 설치된 Chromium을 사용했다. 이는 클라우드 QA 환경 설정이며 사용자의 PC에 새 도구를 설치하라는 지시가 아니다.

### 캡처와 기계 검사 결과

아래 이미지는 **QA SYNTHETIC**이며 실제 종목 수치·운영 저장 성공의 증거가 아니다. [전체 검사 JSON](artifacts/bollinger-universe-recovery/verification.json)과 [캡처 폴더](artifacts/bollinger-universe-recovery/)를 함께 읽는다.

| 화면 | Light | Dark |
| --- | --- | --- |
| 목록 없는 KOSDAQ 실행 가능 | [desktop](artifacts/bollinger-universe-recovery/missing-kosdaq-light-desktop.png) | [desktop](artifacts/bollinger-universe-recovery/missing-kosdaq-dark-desktop.png) |
| 새로고침 후 부분 작업 이어받기 | [desktop](artifacts/bollinger-universe-recovery/persisted-paused-kosdaq-light-desktop.png) | [desktop](artifacts/bollinger-universe-recovery/persisted-paused-kosdaq-dark-desktop.png) |
| 현재 선택 작업 완료 | [desktop](artifacts/bollinger-universe-recovery/completed-kosdaq-light-desktop.png) | [desktop](artifacts/bollinger-universe-recovery/completed-kosdaq-dark-desktop.png) |
| 모바일 버튼·완료 상태 | [mobile](artifacts/bollinger-universe-recovery/completed-kosdaq-light-mobile.png) | [mobile](artifacts/bollinger-universe-recovery/completed-kosdaq-dark-mobile.png) |
| 결과 후보 표시 | [desktop](artifacts/bollinger-universe-recovery/candidates-light-desktop.png) | [desktop](artifacts/bollinger-universe-recovery/candidates-dark-desktop.png) |

최종 판정: **코드·자동 테스트·모의 production 브라우저 검증 완료. 실제 Vercel/Neon 신규 경로의 실수신·저장·표시는 검증 대기.**

## 남은 제한

- SP500/NASDAQ100 공식 편입의 자동 수집은 미지원이다. 저장된 검증 스냅샷 조회와 NASDAQ_LISTED 수집은 별개다.
- Vercel Hobby 한 번의 요청에 전체 시장의 장기 이력을 끝내지 않는다. 중단 상태에는 사용자의 명시적인 이어받기가 필요하다.
- 새 최초 수집 경로가 실제 Vercel에서 Neon에 저장되고 실데이터 후보를 표시하는 운영 검증은 대기다. GitHub 업데이트·자동 테스트·모의 브라우저 결과만으로 운영 성공을 주장하지 않는다.
- 후보가 0개인 것과 저장 자료가 없는 것은 구분한다. 완료된 수집도 전략·기준일·워밍업·Coverage·유동성 기준 때문에 후보 0개일 수 있다.
