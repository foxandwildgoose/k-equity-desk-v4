# Bollinger 선택 실행·수집 수정 검증

> 이 문서는 `f423716`까지의 이전 검사 기록이다. 최초 편입 목록이 없는 KOSDAQ 경로는 후속 수정에서 해결했으며 현재 절차와 검사 결과는 [BOLLINGER_UNIVERSE_RECOVERY.md](BOLLINGER_UNIVERSE_RECOVERY.md)를 참고한다.

확인일: 2026-10-09 한국시간. 기준 커밋: `962e1fb` (`work` 브랜치). 기존 코드와 Neon schema `0005`를 확장했으며 새 migration은 없다.

## 확인한 원인

1. 기존 Universe 변경은 저장 자료 검색 조건만 바꿨다. 예약 수집은 기본 KOSPI Top20이어서 화면의 Top100 선택이 수집 대상으로 전달되지 않았다. 사용자 캡처의 선택 100 / 가용 20이 이 차이를 보여준다.
2. 저장된 `refresh` 단계만 보고 “재계산 중”이라고 표시했다. 당시 Vercel 함수가 살아 있는지는 캡처로 확인할 수 없다. 현재는 해당 작업의 비공개 run token과 만료 전 공유 lease가 일치해야 `RUNNING`이다. 강제 종료 직후에는 lease 만료까지 감지 지연이 있을 수 있다.
3. 첫 단계의 관측 준비와 최종 상대 강도 계산을 같은 완료 수로 세었다. 현재 최종 계산 수는 마지막 features/events 저장을 완료한 종목만 센다. 첫 단계 준비·남은 최종 계산은 별도 표시한다.
4. “돌파 전 1”은 중간 파이프라인 조건이며 Long Pre-Breakout의 최종 ARMED 조건과 다르다. 캡처의 ARMED 0 / 결과 0은 가능한 결과다. 자료 부족·오래된 계산·워밍업·Coverage·전략·점수 제외를 구분해야 이를 판단할 수 있다.
5. 기존 최근 기준은 4달력일이다. 긴 휴장 기간의 영향은 가능하지만 운영 DB의 날짜·제외 사유를 읽지 못했으므로 이번 캡처의 추가 원인으로 확정하지 않는다. 기준을 임의로 완화하지 않고 **조회 기준일**, **저장 최신일로 조회**와 **과거 기준 조회** 표시를 제공한다.

## 실제 수정 경로

- `src/routes/bollinger.tsx`, `src/lib/bollinger/discovery-execution.ts`: 초안과 적용 요청을 분리한다. 선택 변경만으로 후보 검색을 하지 않는다. **실행** 또는 **조건 적용 · 실행**이 선택 조건을 고정해 DB를 검색한다. **선택 범위 수집·계산**은 별도 쓰기 동작이다. 진행 상태·자료 부족·과거 조회를 표시한다.
- `src/lib/bollinger-discovery-fns.ts`: 기존 same-site 읽기 함수에 선택 작업의 안전한 진행 조회를 추가한다.
- `src/routes/api.bollinger.operator.ts`, `src/server/bollinger-operator.ts`: 기존 `CRON_SECRET`을 HTTPS same-origin 요청에서 검증하고 30분의 origin/수집 용도 전용 HttpOnly·Secure·SameSite=Strict 쿠키를 발급한다. 브라우저 owner ID나 개발 사용자를 신뢰하지 않는다. 키움 키를 사용하지 않는다.
- `src/routes/api.bollinger.collect.ts`, `src/server/bollinger-collection-handler.ts`, `src/lib/bollinger/collection-request.ts`: 인증 후 엄격히 제한한 선택만 받는다. 인증·설정 검사 전에는 DB나 공급자를 불러오지 않는다. 임의 URL·시간 예산·인증정보를 수집 요청으로 받지 않는다.
- `src/server/bollinger-cloud-runtime.ts`, `src/routes/api.cron.bollinger.ts`: 예약과 수동 수집이 같은 provider/DB/수집 서비스를 사용한다.
- `src/server/bollinger-cloud.ts`, `bollinger-cloud-config.ts`, `bollinger-discovery-jobs.ts`: 불변 스냅샷·범위·섹터·종목·버전별 scope, 선택 키 저장, 공유 lease, checkpoint 재개, 최종 계산 수를 연결한다. 이전 schema1 작업을 보존하며 이어받는다.
- `src/server/bollinger-discovery-store.ts`, `bollinger-discovery.ts`: 기존 `getSql()`/Neon 테이블을 사용하며 부족·제외 수와 실제 lease 상태를 조회한다.
- `vite.config.ts`, `src/routeTree.gen.ts`: 수집 경로 등록과 bounded collector의 함수 실행시간 설정. 예약은 계속 `vercel.json` 한 곳에만 있다.
- `package.json`, 관련 테스트, `scripts/qa-bollinger-discovery.mjs`: 안전한 인증·선택 전달·재개·브라우저 회귀 검사를 추가했다.

## 실행한 검사

아래 검사는 실제 운영 `DATABASE_URL` 없이 Node 22와 격리된 PGlite로 실행했다. 테스트 응답과 합성 가격은 테스트에서만 사용하며 운영 DB·서비스에는 넣지 않았다.

| 검사 | 실제 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm test` | 스크립트 검사 214 통과 / 기존 skip 12, 앱 단위·통합 검사 551 통과 / skip 0 / 실패 0 |
| `npm run lint` | 종료 코드 0, 오류 0 / 기존 경고 56. 수정한 파일의 대상 ESLint는 오류·경고 0 |
| `env -u DATABASE_URL npm run build` | production 빌드 통과. 현재 build는 migration을 실행하지 않음 |
| `npm run check:deploy -- --build-output /workspace/.onboarding/builds/k-equity-desk-v4` | PASS. 프로젝트+생성 산출물 합계 cron 1개, 중복 없음 |
| 실제 생성된 Vercel HTTPS handler | 인증정보 미설정 503 `CRON_SECRET_MISSING`, 교차 사이트 403 `CROSS_SITE_REQUEST_BLOCKED`; 수집/DB 호출 전 차단 |
| 실제 production HTTP preview | 운영자 조회·수집 모두 403 `SECURE_ORIGIN_REQUIRED`; HTTPS 보안 검사를 우회하지 않음 |
| client bundle 검사 | JS 121개에 운영자 서명 로직·쿠키 이름·서버 인증 함수 없음 |

자동 테스트는 선택 Top100이 예약 Top20 설정과 무관하게 전달됨, 선택 scope 분리·정규화, 다른 DB 프로세스에서 재개, 최종 계산 중 예산 종료와 이어받기, 이전 작업 상태 호환, 다른 작업 lease와의 구분, 가용성 제외 사유를 검증한다. 운영자 인증은 성공·실패·만료·변조·비밀값 변경·origin·body 제한·쿠키 속성·미인증 수집 차단을 검증한다.

브라우저 검사는 production 산출물의 실제 UI에 합성 테스트 서버 응답을 연결하고 격리 DB에서 검색 계약을 실행한다. 실제 Vercel/Neon 수집 성공을 대신하는 검사가 아니다. Light/Dark × desktop 1440×900 / tablet 768×1024 / mobile 390×844에서 다음을 검사한다.

- 실행 전 후보 검색 0회, 선택 변경만으로 후보 검색하지 않음.
- 실행 후 전략·버전·Top100 조건 적용과 이전 조건 표시.
- 선택100 / 저장20 / 미확보80 재현.
- 운영자 입력 제출 후 제거, localStorage에 비밀값 없음, 명시적 추가 클릭으로만 수집 시작.
- 예산 종료 → 이어받기 → 완료 → DB 결과 재조회, 미확보0 확인.
- 저장 최신일의 명시적 과거 조회, 권한 해제, 페이지 넘김·근거·설정 JSON·모바일 overflow·JS 예외 검사.

브라우저 결과와 합성 화면은 [artifacts/bollinger-execution](artifacts/bollinger-execution/)에 보관한다. 이는 실거래 수치나 투자 성과의 증거가 아니다.

일반 `browser-smoke.mjs`도 dev와 production에서 실행했다. 두 버전 모두 HTTP200·Bollinger 본문·가로 overflow 없음·pageErrors 없음이다. 다만 외부 폰트/기존 Grok 리소스의 인증서 오류, production 로컬 HTTP의 의도된 운영자403 때문에 exit2이며 전체 clean smoke 통과로 기록하지 않는다. dev/built 전체 본문 비교는 외부 시세 헤더의 내용 변화로 달랐다. 해당 자원·TLS 검증을 끄거나 기존 마커/시세를 제거하지 않았다.

## 운영 검증과 사용자의 다음 순서

| 구분 | 상태 |
| --- | --- |
| 코드·단위/통합 검사·production 빌드 | 완료 |
| 합성 DB 및 production UI의 명시적 실행·권한·이어받기 | 6/6 통과 (Light/Dark × desktop/tablet/mobile) |
| 기존 운영의 일부 가격/계산 자료 | 사용자 화면에서 20개 표시 확인 |
| 이번 수정의 실제 Vercel 선택 수집·Neon 저장·최신 사이트 결과 | 검증 대기 |

이 실행 환경에는 `DATABASE_URL`, `CRON_SECRET`, `BOLLINGER_CLOUD_ENABLED`가 주입되지 않았다(존재 여부만 확인). 사용자의 Vercel에 해당 값이 없다는 의미가 아니다. 운영 사이트 요청은 이 환경의 네트워크 프록시 HTTP403으로 차단되어 실제 Neon 내용이나 새 배포 상태를 읽지 못했다. 운영 DB·비밀값·배포 설정을 변경하지 않았다.

1. GitHub 최신 수정으로 만들어진 Vercel 배포에서 **Production / Ready**를 확인한다. 예전 배포를 다시 배포하면 새 버튼과 경로가 없다.
2. `/bollinger`에서 Universe·Top N·섹터·전략·결과 조건을 선택한 뒤 **실행**을 누른다. 처음에는 조건을 선택 중이라는 상태가 보이고, 실행 후 적용 완료와 부족·제외 수를 확인할 수 있다.
3. 자료 부족/오래된 계산이면 **실행 권한 확인**에서 보관한 기존 `CRON_SECRET`을 자신의 HTTPS 사이트에 입력해 확인한다. 채팅·URL·GitHub에 넣지 않는다. 키움 App Key/Secret을 입력하지 않는다.
4. **선택 범위 수집·계산**을 누른다. 예산 종료이면 자동 진행 중이 아니므로 **수집 이어받기**를 누른다. 최종 계산·남은 계산·종목 오류 수를 확인한다.
5. 완료 후 결과는 다시 조회된다. 조건을 바꾸려면 **실행**, 같은 조건/진행 기록을 다시 읽으려면 **저장 자료 새로고침**을 사용한다. 이후 후보0이라면 제외 사유를 보고 전략/필터를 선택해 재실행한다. 과거 자료 검토는 **저장 최신일로 조회**를 사용한다.

기존 Neon과 Vercel Hobby를 그대로 사용한다. 이번 수정 때문에 PC·Node.js를 다시 설치하거나 0005를 다시 적용할 필요가 없다. 최초 편입 스냅샷이 없는 경우의 현재 경로는 사이트의 실행에서 시작하는 최초 수집으로 변경되었다. 위 이전 검사는 KOSPI 스냅샷이 있는 상태를 사용했다. 자세한 설정·제한은 [BOLLINGER_SCREENER_2.md 6절](BOLLINGER_SCREENER_2.md#6-현재-사용자-neon--vercel-hobby만-사용하는-순서)을 참조한다.

공개 공급자의 제공 이력, 종목 지원, 호출·Vercel/Neon 무료 할당량은 제한이 있다. KOSPI/KOSDAQ/Nasdaq Listed/확인된 국내 ETF 선택 수집을 지원하며 S&P500/Nasdaq100 manifest는 기존 저장 검색·선택 CLI 경로를 유지한다. 장기 휴장일 달력과 생산 사이트 새 실행은 별도 확인이 필요하다. 자료 확보와 최종 후보 존재는 서로 다른 완료 기준이다.
