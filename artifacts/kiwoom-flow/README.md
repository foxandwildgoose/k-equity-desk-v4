# 키움 작업 검사 산출물 — 2026-10-04

자세한 판정과 실행 조건은 [KIWOOM_FLOW_VERIFICATION.md](../../docs/upgrade/KIWOOM_FLOW_VERIFICATION.md), PC 실행 순서는 [KIWOOM_FLOW_SETUP.md](../../docs/upgrade/KIWOOM_FLOW_SETUP.md)에 있습니다.

- **A 완료 / B·C·D 검증 대기**. 키움 실전 인증·시장정보 요청은 0회입니다. 첨부 파일 검사는 상태만 보존했습니다.
- `all-tests.log`: Node/PowerShell 스크립트 206 + TypeScript 347 = 553 통과, skip/실패 0.
- `build.log`, `typecheck.log`: 운영 DB에 연결하지 않은 최종 빌드와 타입 검사.
- `lint.log`: 전체 lint의 변경하지 않은 빈 catch 오류 1개·경고 61개. `changed-lint.log`: 새 서버/CLI 파일 검사 통과.
- `browser-fixture.json`: 개발 합성 응답 4 화면·22 조작 통과. API → 실제 수집 서비스 → 격리 메모리 PGlite → 기존 차트 연결입니다.
- `browser-current.json`: 개발 현재 설정 6 화면 통과. 가격의 기존 공급자 응답이며 키움 실수신이 아닙니다.
- `browser-production-verified.json`: POST 변경 및 QA dialog 닫힘 대기 보완 후 로컬 빌드의 합성 4 화면·22 조작 통과.
- `browser-production-current.json`: 로컬 빌드 현재 설정 6 화면 통과. 키움 비활성/미설정 사유를 표시합니다.
- `browser-final-build.json`: SQL DATE 시간대 독립 처리까지 포함한 마지막 재빌드의 합성 4 화면 통과. `synthetic-final-*.png`가 해당 실제 캡처입니다.
- `synthetic-*.png`, `synthetic-built-*.png`: **합성 테스트용 화면 캡처**. 실제 투자 데이터·키움 수신·운영 영속 저장·배포 사이트 증거가 아닙니다.
- `browser-production.json`: 최초 빌드에서 긴 GET 요청이 431로 거절되기 전 QA가 대기 실패한 원래 결과입니다.
- `browser-post-dev.json`, `browser-production-post.json`, `browser-production-final.json`: 설정 창 애니메이션 대기 보완 전 일부 조작 실패를 보존했습니다.
- `home-smoke-*.json`: 추가 홈 스모크에서 관측된 외부 인증서 오류·Dashboard/PriceValue hydration 불일치·개발/빌드 비교 차이입니다. 홈 전체 스모크는 통과하지 않았습니다.
- `production-function-map.json`: 검사한 빌드의 RPC 메타데이터에서 읽은 함수 ID/이름. 합성 응답용 라우트 식별에만 사용하며 비밀정보나 운영 인증 우회를 포함하지 않습니다. 다른 빌드에서는 다시 생성해야 할 수 있습니다.

예시 재검사 명령 (빌드가 로컬 QA 서버에서 실행되는 환경):

```text
npm run qa:chart-hts -- --mode fixture --cases stock-403870,etf-069500 --viewports desktop,mobile --interactions
npm run qa:chart-hts -- --base <로컬 빌드 QA 주소> --function-map artifacts/kiwoom-flow/production-function-map.json --mode fixture --cases stock-403870,etf-069500 --viewports desktop,mobile --interactions
```

검사 JSON의 로컬 기본 주소는 게시용 산출물에서 제거했습니다. 브라우저 콘솔의 애플리케이션 오류와 외부 리소스 인증서 실패는 별도 항목입니다. 원래 실패를 최종 성공으로 덮어 표시하지 않습니다.
