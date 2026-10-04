# 차트 표시·매물대 검증 증거

확인일: 2026-10-04. 기준 `7cbb1500072f994f451cae92a7f15feadebb6787`, 구현 `745dbe668d58936b61be94a7b1f2259483992ed9`.

모든 시세·공시·리포트·수급은 브라우저 QA 전용 **QA SYNTHETIC (실데이터 아님)**이다. 실제 가격·수급·인증·운영 사이트 검증으로 해석하지 않는다. 앱 코드의 서비스 fallback이나 운영 캐시에 fixture를 추가하지 않았다.

## 검사 결과

| 증거 | 실제 결과 |
|---|---|
| [전체 테스트](checks/test-current.log) | script 206 + TypeScript 364 = 570 통과, 실패/skip 0. Linux에서 실제 PowerShell 7.5.3도 사용 |
| [타입 검사](checks/typecheck-final.log) | 통과 |
| [안전한 production bundling](checks/build-current.log) | 통과. `DATABASE_URL` 제거, migration 미실행 |
| [수정 파일 lint](checks/changed-lint-current.log) | 오류 0, 기존 경고 6 |
| [전체 lint](checks/lint-final.log) | 기존 빈 catch 오류 1, 경고 60. `src/lib/app-data/client.server.ts:214`는 기준 커밋에도 존재 |
| [기존 HTS 회귀](hts-regression.json), [실행 로그](checks/hts-regression.log) | 한국 주식 403870/ETF 069500/US NVDA × desktop/mobile 6/6 통과 |
| [HTS 가격 알림·주석 회귀](hts-overlay-regression.json), [실행 로그](checks/hts-overlay-regression.log) | 새로운 공통 표시 버튼으로 주석 ON→OFF, 가격 알림/그리기 및 다른 pane 보존. 403870/069500 desktop 2/2 통과 |
| [개발 서버 matrix](verified-dev.json) | 005930/069500/NVDA × desktop/mobile × Light/Dark × DPR 1/2 = 24/24 통과 |
| [production build matrix](verified-build.json) | 같은 24/24 조합 통과. 실제 plot 폭·fill·알파·DPR·PNG 픽셀 검사 |
| [최종 개발 서버 과거 설정](final-legacy-dev.json) | Light/Dark 2/2 케이스, 12/12 추가 검사 통과 |
| [주/월봉·리플레이](period-replay-dev.json) | 원래 리포트 날짜/주기별 scope/미래 공시 숨김 1/1 검사 통과 |
| [mobile 분할](verified-workspace-mobile-dev.json) | 1/1 케이스, 2/2 검사 통과 |
| [최종 production 과거 설정](final-legacy-build.json) | Light/Dark 2/2 케이스, 14/14 추가 검사 통과. 독립 7분류·native hover/click·원본 상세·테마/사용자 색·zoom·기간·scope·리플레이 |
| [최종 production 분할·전체화면](final-workspace-build.json) | desktop/mobile 2/2 케이스, 4/4 검사 통과. 실제 전체화면 안의 표시/설정/지표/그리기/주석 포털 |
| [최종 production UI/PNG](final-ui-build.json) | Light/Dark 2/2 케이스, native canvas 및 독립 분류 검사 2/2 통과 |

matrix의 실제 desktop 최대 막대는 plot 폭 1,070 CSS px × 0.85 = **909.5 CSS px**였으며 관측 오차는 0 px다. mobile/DPR 2에서도 media 좌표와 native transform을 확인했다. 가장 큰 구간의 수량으로 폭을 정규화하며, 전체 대비 비율은 별도 분모를 유지한다. 빈 구간을 부풀리지 않는다.

Git에 보관한 로그는 줄 끝 공백과 파일 끝 빈 줄만 정리했다. 원본 로그는 `/workspace/screenshots/chart-display/checks/`에 유지한다. 검사 결과·오류·경고 내용은 바꾸지 않았다.

전체 폭/테마 matrix 이후 상세 수명과 전체화면 포털을 보완했다. 마지막 소스는 최종 production 추가 검사에서 재검증했다. `rects/texts/arcs/candles/axisTexts` 대규모 원시 호출 배열은 일부 JSON에서 건수로 줄였다. 결과·geometry·assertion detail은 실제 실행값을 유지하고 `evidenceSource`에 원본 JSON 위치를 남겼다. 내부 검증 서버 주소는 사용자용 미리보기 링크로 제공하지 않는다.

## 원본 캡처·PNG

파일은 원본 PNG의 복사본이며 색상/내용을 후처리하지 않았다. Light/Dark ON/OFF는 최종 production build에서 캡처했다. 이미지에 보이는 값은 fixture 값이다.

| 항목 | 파일 |
|---|---|
| Light 주석 OFF / ON, 버튼 포함 | [OFF](screenshots/light-annotations-off.png), [ON](screenshots/light-annotations-on.png) |
| Dark 주석 OFF / ON, 버튼 포함 | [OFF](screenshots/dark-annotations-off.png), [ON](screenshots/dark-annotations-on.png) |
| 넓은 매물대 전체 chart | [Light](screenshots/light-wide-chart.png), [Dark](screenshots/dark-wide-chart.png) |
| 과거 10%·50구간·전체 기간 상태 | [변경 전](screenshots/legacy-narrow-before.png) |
| mobile ETF, 좌 단위/DPR 2 | [Light](screenshots/light-mobile-etf.png), [Dark](screenshots/dark-mobile-etf.png) |
| Light 실제 PNG 내보내기 | [OFF](screenshots/light-annotations-off-export.png), [ON](screenshots/light-annotations-on-export.png) |
| Dark 실제 PNG 내보내기 | [OFF](screenshots/dark-annotations-off-export.png), [ON](screenshots/dark-annotations-on-export.png) |
| native 전체화면 / mobile 분할 UI | [전체화면 메뉴](screenshots/fullscreen-display-menu.png), [mobile 분할](screenshots/mobile-split-controls.png) |

## 제한·이전 실패

운영 배포·실제 사용자 인증 세션·배포된 storage는 검증하지 않았다. 외부 폰트/Grok 확장 스크립트 요청의 기존 인증서 신뢰 오류는 별도 `externalFailures`에 기록했다. TLS 검증을 끄지 않았다. 최종 QA의 앱 `pageerror` 배열은 비어 있다. 하위 수급 pane의 기존 진단 문구/데이터 경로는 이번 작업 범위 밖이며 변경하지 않았다.

중간 실패 원본은 `/workspace/screenshots/chart-display/`에 남아 있다. 테마 줌 초기화, Light PNG 배경, 같은 내용의 SSE 갱신 때 열린 상세 초기화는 실제 코드에서 고쳤다. Sheet 종료 후 포커스 복귀를 즉시 검사한 문제와 mobile 닫기 버튼의 잘못된 selector는 QA를 수정한 뒤 재검증했다. 실패 기준을 삭제하거나 통과로 변조하지 않았다.

실행 명령·버튼 사용법·변경 파일은 [구현·검증 문서](../../docs/upgrade/CHART_DISPLAY_READABILITY.md)에 기록했다. 실제 native Windows, 운영 데이터/배포 버전 검증은 별도 확인이 필요하다.
