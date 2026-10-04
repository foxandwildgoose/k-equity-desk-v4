# 환경 변수 (Environment variables)

모든 변수는 **서버 전용**입니다. `VITE_` 접두사를 붙이지 마세요(브라우저로 노출됩니다).
저장소에 `.env` 파일을 만들지 않습니다. 로컬에서는 셸에서 `export` 하거나, Vercel에서는
Project Settings → Environment Variables에 등록합니다. 값이 없으면 각 기능은 아래 표의
동작으로 자연스럽게 축소됩니다.

| 변수 | 용도 | 없을 때 |
|---|---|---|
| `KIS_APP_KEY`, `KIS_APP_SECRET` | 한국투자증권 Open API: 기존 KRX 실시간 체결(WebSocket, `H0STCNT0`) + 선택적 KIS 종합 시황/공시 제목(F1.1, `FHKST01011800`) | 네이버 스냅샷 사용, KIS 뉴스 소스 비활성 |
| `SEC_USER_AGENT` | SEC fair-access User-Agent. 실제 연락처 포함, 예: `KEDesk you@your-domain` | 기존 UA 유지 + 소스 상태 페이지에 `SEC UA 미설정` 표시 |
| `FINNHUB_API_KEY` | 선택: 미국 기업 뉴스 추가 소스 | 소스 비활성 |
| `NEWS_BLOOMBERG_ENABLED` | Bloomberg RSS 킬 스위치. 기본 `true` | `true`로 간주 (`false`면 모든 화면에서 제거) |
| `AI_BRIEFING_ENABLED` | 선택 F9 AI 브리핑 레이어 스위치 (`true`일 때만) | F9 UI 숨김 |
| `AI_PROVIDER` | `anthropic`(기본) 또는 `xai` | `anthropic`으로 간주 |
| `AI_MODEL` | 공급자 모델 ID (코드에 하드코딩하지 않음, 필수) | F9 숨김 |
| `ANTHROPIC_API_KEY` / `XAI_API_KEY` | `AI_PROVIDER`에 맞는 키 (공급자와 다른 키만 있으면 꺼짐) | F9 숨김 |
| `AI_DAILY_CAP` | F9 일일 호출 상한 (UTC 날짜 기준, 서버 인스턴스별 메모리 카운트) | 50 |
| `AI_EFFORT` | 선택: `low`/`medium`/`high` — Anthropic 요청의 `output_config.effort` (지원 모델에서만 설정) | 설정 안 함 |

기존 선택 변수(변경 없음): `KIS_APPROVAL_URL`, `KIS_WS_URL` 등 `src/server/kis-realtime.ts`가
읽는 KIS 엔드포인트 재정의 값.

F9 동작 요약: 네 변수(`AI_BRIEFING_ENABLED=true`, `AI_MODEL`, 공급자 키, 선택적 `AI_PROVIDER`)가
모두 맞아야 버튼이 보입니다. 버튼을 누를 때만 화면의 항목 ≤ 30건을 서버로 보내고, 모델에는
제목·출처 발췌(≤ 240자)·출처·시각만 번호와 함께 전달합니다(원문·PDF·링크는 보내지 않음). 결과는 입력 해시 기준 15분 캐시되고, 호출 타임아웃은 8초·재시도
없음입니다(Vercel 함수 제한 준수).

## 참고
- 소스별 on/off 스위치와 상태: 앱의 `/status/sources` (소스 상태) 페이지.
- Bloomberg 인앱 토글: `알림 설정`/뉴스 설정의 소스 토글(브라우저에 저장).
- 네트워크가 제한된 환경에서 작업했다면, 일반 인터넷이 되는 머신에서
  `npm run verify:sources`를 실행해 `docs/upgrade/SOURCES_STATUS.md`를 갱신하세요.

## 키움 수급 지표 (2026-10-04)

세 차트 지표는 `KIWOOM_APP_KEY`, `KIWOOM_APP_SECRET`을 서버에서만 읽습니다. `KIWOOM_ENV`, `KIWOOM_FLOW_ENABLED`, `KIWOOM_FLOW_MODE`, `KIWOOM_EXPECTED_EGRESS_IP`, `KIWOOM_REQUESTS_PER_SECOND`, `KIWOOM_OWNER_USER_ID`, `DATABASE_URL`의 설정과 PowerShell 주입·수집 명령은 [KIWOOM_FLOW_SETUP.md](KIWOOM_FLOW_SETUP.md)를 참조하세요. 다른 기능의 KIS·네이버 연결은 유지합니다. collector 웹앱은 키 없이 공유 DB만 읽으며, 운영 DB가 없으면 메모리 저장으로 대체하지 않습니다.

개인 사이트의 키움 접근은 실제 Better Auth 소유자 세션이 필요합니다. 웹 배포에는 `VITE_AUTH_ENABLED=true`(인증 스위치만 공개), 서버 전용 `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, 동일 PostgreSQL 및 검증된 `KIWOOM_OWNER_USER_ID`를 설정합니다. `/login`과 `/api/auth/*`를 연결했고 인증 스키마의 동일 복사본을 migration에 추가했습니다. 기본 개발 auth-off 설정을 운영의 소유자 인증으로 사용하지 않습니다. 운영 설정 변경·DB migration은 이번 코드 검증에서 실행하지 않았습니다.
